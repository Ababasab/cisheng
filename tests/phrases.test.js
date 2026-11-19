import test from 'node:test';
import assert from 'node:assert/strict';
import {phraseKey,phraseMatches,phraseVariants} from '../dist/phrases.js';
import {readFileSync} from 'node:fs';
import {createDictionaryLookup} from '../dist/dictionary.js';
const data={'keep sth quiet':{zh:'将某事保密',ipa:'',forms:''},'look forward to':{zh:'期望，盼望',ipa:'reference',forms:''},keep:{zh:'vt. 保持；保存',ipa:'ki:p'},quick:{zh:'a. 快的；迅速的',ipa:'kwik'}};
test('ellipsis matches related dictionary patterns without pretending an arbitrary phrase is translated',()=>{
 assert.equal(phraseKey(' Keep...quick '),'keep … quick');assert.equal(phraseKey('keep sth. quiet'),'keep sth quiet');
 assert.deepEqual(phraseMatches('keep … quiet',data).map(m=>m.text),['keep sth quiet']);assert.deepEqual(phraseMatches('keep … quick',data),[]);
});
test('grammar placeholders resolve actual dictionary phrases without translating words independently',async()=>{
 const ha=JSON.parse(readFileSync(new URL('../dist/data/dict-ha.json',import.meta.url),'utf8'));
 const lookup=createDictionaryLookup({fetcher:async()=>({ok:true,json:async()=>ha})});
 for(const phrase of ['have trouble doing','have trouble in doing','have trouble (in) doing sth.','have trouble doing something','have difficulty doing']){
  const entry=await lookup(phrase);assert.equal(entry.kind,'grammar');assert.match(entry.zh,/做某事有困难/);assert.equal(entry.source,'ECDICT');assert.equal(entry.ipa,'');
 }
 const exact=await lookup('have trouble doing sth');assert.equal(exact.zh,ha['have trouble doing sth'].zh);assert.equal(exact.kind,undefined);
 assert.ok(phraseVariants('have trouble doing').includes('have trouble doing sth'));
 assert.equal((await lookup('have quick doing')).kind,'components');lookup.flush();
});
test('old component cache cannot hide a newly resolved whole phrase; unrelated cached words still work offline',async()=>{
 let saved=JSON.stringify({'have trouble doing':{zh:'old component fallback',ipa:'',kind:'components'},concert:{zh:'音乐会',ipa:'test'}});
 const lookup=createDictionaryLookup({storage:{getItem:()=>saved,setItem:(_,value)=>saved=value},fetcher:async()=>({ok:true,json:async()=>({'have trouble doing sth':{zh:'做某事有困难',ipa:'',forms:''}})})});
 assert.equal((await lookup('have trouble doing')).zh,'做某事有困难');assert.equal((await lookup('concert')).zh,'音乐会');lookup.flush();
 assert.equal(JSON.parse(saved)['have trouble doing'].kind,'grammar');
});
test('whole phrase definitions win; unknown phrases show labelled word references, not fake Oxford definitions',async()=>{
 const lookup=createDictionaryLookup({fetcher:async()=>({ok:true,json:async()=>data})});
 assert.equal((await lookup('look forward to')).zh,'期望，盼望');assert.equal((await lookup('keep sth. quiet')).zh,'将某事保密');
 const related=await lookup('keep … quiet');assert.equal(related.kind,'related');assert.match(related.zh,/keep sth quiet/);
 const unknown=await lookup('keep ... quick');assert.equal(unknown.kind,'components');assert.match(unknown.zh,/不等于短语翻译/);assert.match(unknown.zh,/quick：/);assert.equal(unknown.ipa,'');lookup.flush();
});
