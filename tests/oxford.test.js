import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupOxford} from '../dist/oxford.js';
import {createOxfordHandler,parseOxfordResponse} from '../supabase/functions/oxford-lookup/core.js';
// Synthetic adapter fixture, not a quotation or a real Oxford API result.
const fixture=(word,language='zh')=>({results:[{word,lexicalEntries:[{text:word,entries:[{senses:[language==='zh'?{translations:[{text:'合成中文释义'}]}:{definitions:['Synthetic English definition.']}]}]}]}]});
const request=(word='test phrase',token='test-session')=>new Request('https://project.test/functions/v1/oxford-lookup',{method:'POST',headers:{origin:'https://ababasab.github.io',...(token?{authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:JSON.stringify({word})});
const values={OXFORD_APP_ID:'fixture-id',OXFORD_APP_KEY:'fixture-key',SUPABASE_URL:'https://project.test',SUPABASE_ANON_KEY:'public-fixture',OXFORD_ALLOWED_USER_IDS:'allowed-user'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
test('unconfigured Oxford never calls a paid endpoint or stamps local data as Oxford',async()=>{
 let calls=0;await assert.rejects(lookupOxford('have trouble doing',{fetcher:()=>{calls++;}}),/尚未开通/);assert.equal(calls,0);
 const handler=createOxfordHandler({env:()=>undefined,fetcher:()=>{calls++;}});assert.equal((await handler(request())).status,503);assert.equal(calls,0);
});
test('Oxford frontend handles authenticated results, missing entries, body timeout and bad provenance',async()=>{
 const options={config:{enabled:true},token:'fixture-session'};
 assert.equal((await lookupOxford('TEST PHRASE',{...options,fetcher:async(url,init)=>{assert.equal(JSON.parse(init.body).word,'test phrase');assert.equal(init.headers.Authorization,'Bearer fixture-session');assert.match(String(url),/functions\/v1\/oxford-lookup$/);return json({source:'oxford',language:'zh',definitions:['合成中文释义']});}})).source,'oxford');
 await assert.rejects(lookupOxford('test',{...options,fetcher:async()=>json({},404)}),/完整词条/);
 await assert.rejects(lookupOxford('test',{...options,fetcher:async()=>json({source:'ECDICT',language:'zh',definitions:['示例']})}),/数据不完整/);
 await assert.rejects(lookupOxford('test',{...options,timeout:10,fetcher:async()=>({ok:true,json:()=>new Promise(()=>{})})}),/超时/);
});
test('Oxford parser reads full-entry translations/subsenses and rejects unrelated parent word',()=>{
 assert.deepEqual(parseOxfordResponse(fixture('trouble'),'have trouble doing','zh').definitions,[]);
 const data=fixture('test phrase');data.results[0].lexicalEntries[0].entries[0].senses[0].subsenses=[{translations:[{text:'子释义'}]}];
 assert.deepEqual(parseOxfordResponse(data,'test phrase','zh').definitions,['合成中文释义','子释义']);
});
test('Oxford proxy verifies user and whitelist before any Oxford request, no credentials in response',async()=>{
 const calls=[];const handler=createOxfordHandler({env:key=>values[key],fetcher:async url=>{calls.push(String(url));return String(url).includes('/auth/')?json({id:'other-user'}):json(fixture('test phrase'));}});
 assert.equal((await handler(request('test phrase',null))).status,401);
 const denied=await handler(request());assert.equal(denied.status,403);assert.equal(calls.length,1);assert.ok(!JSON.stringify(await denied.json()).includes('fixture-key'));
});
test('Oxford proxy falls back from unavailable Chinese to labelled English, CORS and rate limits hold',async()=>{
 const calls=[];const handler=createOxfordHandler({env:key=>values[key],fetcher:async(url,init)=>{
  calls.push(String(url));if(String(url).includes('/auth/'))return json({id:'allowed-user'});
  assert.equal(init.headers.app_key,'fixture-key');return String(url).includes('/translations/')?json({},403):json(fixture('test phrase','en'));
 }});
 const response=await handler(request());assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://ababasab.github.io');assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(await response.json(),{source:'oxford',word:'test phrase',language:'en',definitions:['Synthetic English definition.']});assert.equal(calls.length,3);
 assert.equal((await handler(new Request('https://project.test',{method:'OPTIONS',headers:{origin:'https://evil.test'}}))).status,403);
 for(let i=0;i<9;i++)assert.equal((await handler(request())).status,200);
 assert.equal((await handler(request())).status,429);
});
