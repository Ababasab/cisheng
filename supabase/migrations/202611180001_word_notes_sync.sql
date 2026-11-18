-- Apply once in the project's SQL editor. No service-role key belongs in the website.
create table if not exists public.word_notes_snapshots (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check (revision >= 0),
 payload jsonb not null default '{"folders":[],"words":[]}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint valid_word_notes_payload check (
  jsonb_typeof(payload) = 'object'
  and jsonb_typeof(payload -> 'folders') = 'array'
  and jsonb_typeof(payload -> 'words') = 'array'
  and payload ? 'folders' and payload ? 'words'
  and jsonb_array_length(payload -> 'folders') <= 1000
  and jsonb_array_length(payload -> 'words') <= 100000
  and octet_length(payload::text) <= 12582912
 )
);
alter table public.word_notes_snapshots enable row level security;
revoke all on table public.word_notes_snapshots from anon, authenticated;
grant select, insert, update on table public.word_notes_snapshots to authenticated;
drop policy if exists word_notes_owner on public.word_notes_snapshots;
create policy word_notes_owner on public.word_notes_snapshots
 for all to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);

-- Compare-and-swap: never silently overwrite a newer phone/computer snapshot.
create or replace function public.word_notes_commit(p_expected_revision bigint, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 current_row public.word_notes_snapshots;
 account_id uuid := auth.uid();
begin
 if account_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 insert into public.word_notes_snapshots(user_id) values(account_id) on conflict(user_id) do nothing;
 select * into strict current_row from public.word_notes_snapshots where user_id = account_id for update;
 if current_row.revision <> p_expected_revision then
  return jsonb_build_object('saved', false, 'revision', current_row.revision, 'payload', current_row.payload);
 end if;
 update public.word_notes_snapshots set payload = p_payload, revision = revision + 1, updated_at = now()
  where user_id = account_id returning * into current_row;
 return jsonb_build_object('saved', true, 'revision', current_row.revision, 'payload', current_row.payload);
end;
$$;
revoke all on function public.word_notes_commit(bigint, jsonb) from public, anon;
grant execute on function public.word_notes_commit(bigint, jsonb) to authenticated;
