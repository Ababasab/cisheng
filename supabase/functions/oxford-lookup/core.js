// Official API adapter. Disabled without server secrets and an explicit user allowlist.
const key=s=>String(s||'').toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ').trim();
export function parseOxfordResponse(data,word,language){
 const definitions=[],add=text=>{if(typeof text==='string'&&text.trim()&&!definitions.includes(text))definitions.push(text);};
 const visit=sense=>{
  if(language==='zh')for(const translation of sense.translations||[])add(translation.text);
  else for(const text of sense.definitions||[])add(text);
  for(const child of sense.subsenses||[])visit(child);
 };
 // Do not label a parent word's unrelated senses as the definition of a phrase.
 for(const result of data?.results||[]){
  for(const lexical of result.lexicalEntries||[]){
   if(![lexical.text,result.word,result.id].some(text=>key(text)===key(word)))continue;
   for(const entry of lexical.entries||[])for(const sense of entry.senses||[])visit(sense);
  }
 }
 return {source:'oxford',word,language,definitions:definitions.slice(0,4)};
}
export function createOxfordHandler({env,fetcher=fetch,now=Date.now}={}){
 const recent=new Map();
 async function json(url,options,timeout=5000){
  const controller=new AbortController();let timer;
  try{return await Promise.race([
   Promise.resolve().then(()=>fetcher(url,{...options,signal:controller.signal})).then(async response=>({status:response.status,ok:response.ok,data:response.ok?await response.json():null})),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},timeout);})
  ]);}finally{clearTimeout(timer);}
 }
 return async request=>{
  const origin=request.headers.get('origin'),allowedOrigins=(env('OXFORD_ALLOWED_ORIGINS')||'https://ababasab.github.io').split(',').map(s=>s.trim());
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origin&&allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!allowedOrigins.includes(origin))return reply(403,{error:'origin_not_allowed'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type'}});
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const appID=env('OXFORD_APP_ID'),appKey=env('OXFORD_APP_KEY');
  if(!appID||!appKey)return reply(503,{error:'oxford_not_configured'});
  const auth=request.headers.get('authorization');if(!/^Bearer \S+$/.test(auth||''))return reply(401,{error:'login_required'});
  try{
   const authResult=await json(new URL('/auth/v1/user',env('SUPABASE_URL')),{headers:{Authorization:auth,apikey:env('SUPABASE_ANON_KEY')}},4000);
   if(!authResult.ok||!authResult.data?.id)return reply(401,{error:'login_required'});
   const owner=authResult.data.id,allowlist=(env('OXFORD_ALLOWED_USER_IDS')||'').split(',').map(s=>s.trim()).filter(Boolean);
   if(!allowlist.includes(owner))return reply(403,{error:'account_not_enabled'});
   if(Number(request.headers.get('content-length')||0)>1024)return reply(400,{error:'invalid_query'});
   const body=await request.text();if(body.length>1024)return reply(400,{error:'invalid_query'});
   let word;try{word=key(JSON.parse(body).word);}catch{return reply(400,{error:'invalid_query'});}
   if(!word||word.length>160||!/[a-z]/.test(word)||!/^[a-z\s'’().…\/-]+$/.test(word))return reply(400,{error:'invalid_query'});
   const current=now();for(const [id,events] of recent)if(!events.some(time=>time>current-60000))recent.delete(id);
   const events=(recent.get(owner)||[]).filter(time=>time>current-60000);
   if(events.length>=10)return reply(429,{error:'rate_limited'});recent.set(owner,[...events,current]);
   const base=env('OXFORD_SANDBOX')==='true'?'https://od-api-sandbox.oxforddictionaries.com':'https://od-api.oxforddictionaries.com';
   for(const [path,language] of [['translations/en/zh/','zh'],['entries/en-gb/','en']]){
    const result=await json(`${base}/api/v2/${path}${encodeURIComponent(word)}`,{headers:{app_id:appID,app_key:appKey,Accept:'application/json'}});
    if([401,403].includes(result.status)){if(language==='zh')continue;return reply(503,{error:'oxford_access_unavailable'});}
    if(result.status===429)return reply(429,{error:'oxford_limit_reached'});
    if(result.status===404)continue;
    if(!result.ok)return reply(502,{error:'oxford_unavailable'});
    const parsed=parseOxfordResponse(result.data,word,language);if(parsed.definitions.length)return reply(200,parsed);
   }
   return reply(404,{error:'entry_not_found'});
  }catch{return reply(502,{error:'lookup_failed'});}
 };
}
