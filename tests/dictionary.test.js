import test from 'node:test';
import assert from 'node:assert/strict';
import {createDictionaryLookup} from '../dist/dictionary.js';
const entry={ipa:'test',zh:'测试',forms:''};
const ok=data=>({ok:true,json:async()=>data});
test('common lookup only downloads the matching small shard and deduplicates concurrent requests',async()=>{
 const calls=[];const lookup=createDictionaryLookup({fetcher:async url=>{calls.push(url);return ok({concert:entry});}});
 const result=await Promise.all([lookup('concert'),lookup('CONCERT')]);lookup.flush();
 assert.deepEqual(result,[entry,entry]);assert.deepEqual(calls,['./data/common/co.json']);
});
test('failed common shard falls back to full shard without the old monolithic prerequisite',async()=>{
 const calls=[];const lookup=createDictionaryLookup({fetcher:async url=>{calls.push(url);return url.includes('/common/')?{ok:false}:ok({concert:entry});}});
 assert.deepEqual(await lookup('concert'),entry);lookup.flush();assert.deepEqual(calls,['./data/common/co.json','./data/dict-co.json']);
});
test('cached definitions survive a new page and work without network; corrupt cache is ignored',async()=>{
 let saved='broken';const storage={getItem:()=>saved,setItem:(key,value)=>saved=value};
 const first=createDictionaryLookup({storage,fetcher:async()=>ok({concert:entry})});await first('concert');first.flush();
 const second=createDictionaryLookup({storage,fetcher:async()=>{throw Error('offline');}});assert.deepEqual(await second('concert'),entry);second.flush();
});
test('hung fetch or JSON body times out and later retry starts a fresh request',async()=>{
 for(const hang of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
  let retry=false;const lookup=createDictionaryLookup({timeout:10,fetcher:url=>retry?Promise.resolve(ok({concert:entry})):hang()});
  await assert.rejects(lookup('concert'));retry=true;assert.deepEqual(await lookup('concert'),entry);lookup.flush();
 }
});
test('missing entries differ from network errors and storage failures do not break lookup',async()=>{
 const lookup=createDictionaryLookup({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('quota');}},fetcher:async()=>ok({concert:entry})});
 assert.equal(await lookup('unknown'),null);assert.deepEqual(await lookup('concert'),entry);lookup.flush();
});
test('theatre fills missing IPA from its dictionary spelling variant without changing its meaning',async()=>{
 const lookup=createDictionaryLookup({fetcher:async()=>ok({theatre:{zh:'剧场',ipa:'',forms:'s:theatres'},theater:entry})});
 assert.deepEqual(await lookup('theatre'),{zh:'剧场',ipa:entry.ipa,forms:'s:theatres'});lookup.flush();
});
