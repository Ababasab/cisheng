// Uses local PostgreSQL WASM for real RLS/transaction tests, not string matching.
// Install @electric-sql/pglite under qa/pglite/package (ignored) or pass PGLITE_MODULE.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'../qa/pglite/package/dist/index.js');
const db=new PGlite();
const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002';
await db.exec(`create schema auth; create role anon; create role authenticated;
 create table auth.users(id uuid primary key);
 insert into auth.users values('${alice}'),('${bob}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon, authenticated;
 grant execute on function auth.uid() to anon, authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/202611180001_word_notes_sync.sql',import.meta.url),'utf8'));
const login=async id=>{await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);};
const payload=text=>({folders:[{id:'f',name:'词库'}],words:[{id:'w',text,folderId:'f',number:1}]});
const commit=async(revision,value)=>{const {rows}=await db.query('select public.word_notes_commit($1,$2::jsonb) as result',[revision,JSON.stringify(value)]);return rows[0].result;};
await login(alice);assert.equal((await commit(0,payload('apple'))).saved,true);
const conflict=await commit(0,payload('overwritten'));assert.equal(conflict.saved,false);assert.equal(conflict.payload.words[0].text,'apple');assert.equal(conflict.revision,1);
await login(bob);assert.deepEqual((await db.query('select * from public.word_notes_snapshots')).rows,[]);assert.equal((await commit(0,payload('banana'))).saved,true);
assert.equal((await db.query('select * from public.word_notes_snapshots')).rows.length,1);
assert.equal((await db.query('select user_id from public.word_notes_snapshots')).rows[0].user_id,bob);
assert.equal((await db.query('update public.word_notes_snapshots set revision=100 where user_id=$1 returning *',[alice])).rows.length,0);
await assert.rejects(db.query('insert into public.word_notes_snapshots(user_id) values($1)',[alice]));
await assert.rejects(commit(1,{folders:[]}));
await assert.rejects(commit(1,{folders:[],words:[],extra:'x'.repeat(12582913)}));
await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from public.word_notes_snapshots'));await assert.rejects(commit(0,payload('forbidden')));
await login(alice);assert.equal((await db.query('select payload from public.word_notes_snapshots')).rows[0].payload.words[0].text,'apple');
await db.close();console.log('PASS: real PostgreSQL migration, revision conflict, per-user RLS, no anonymous access, cross-user insert/update denied, malformed/oversized payload rejected. Hosted project still requires deployment verification.');
