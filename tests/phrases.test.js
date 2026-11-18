import test from 'node:test';
import assert from 'node:assert/strict';
import {phraseKey,phraseMatches,oxfordSearchURL} from '../dist/phrases.js';
import {createDictionaryLookup} from '../dist/dictionary.js';
const data={'keep sth quiet':{zh:'将某事保密',ipa:'',forms:''},'look forward to':{zh:'期望，盼望',ipa:'reference',forms:''},keep:{zh:'vt. 保持；保存',ipa:'ki:p'},quick:{zh:'a. 快的；迅速的',ipa:'kwik'}};
test('ellipsis matches related dictionary patterns without pretending an arbitrary phrase is translated',()=>{
 assert.equal(phraseKey(' Keep...quick '),'keep … quick');assert.equal(phraseKey('keep sth. quiet'),'keep sth quiet');
 assert.deepEqual(phraseMatches('keep … quiet',data).map(m=>m.text),['keep sth quiet']);assert.deepEqual(phraseMatches('keep … quick',data),[]);
 assert.ok(oxfordSearchURL('keep … quick').startsWith('https://www.oxfordlearnersdictionaries.com/search/english/?q='));
});
test('whole phrase definitions win; unknown phrases show labelled word references, not fake Oxford definitions',async()=>{
 const lookup=createDictionaryLookup({fetcher:async()=>({ok:true,json:async()=>data})});
 assert.equal((await lookup('look forward to')).zh,'期望，盼望');assert.equal((await lookup('keep sth. quiet')).zh,'将某事保密');
 const related=await lookup('keep … quiet');assert.equal(related.kind,'related');assert.match(related.zh,/keep sth quiet/);
 const unknown=await lookup('keep ... quick');assert.equal(unknown.kind,'components');assert.match(unknown.zh,/不等于短语翻译/);assert.match(unknown.zh,/quick：/);assert.equal(unknown.ipa,'');lookup.flush();
});
