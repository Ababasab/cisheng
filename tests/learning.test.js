import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dictionaryKey,containsTerm,normalizeExamples,pickExamples,exampleTerms} from '../dist/learning.js';
import {curatedExamples} from '../dist/curated.js';
test('dictionary handles case and short phrases with safe shard names',()=>{assert.equal(dictionaryKey('Apple'),'ap');assert.equal(dictionaryKey('a lot'),'a_');assert.equal(dictionaryKey('I'),'i_');const data=JSON.parse(readFileSync(new URL('../dist/data/dict-pa.json',import.meta.url)));assert.match(data.passport.zh,/护照/);assert.ok(data.passport.ipa);});
test('word matching uses boundaries and documented inflections',()=>{assert.ok(containsTerm('I have my passport with me.','passport'));assert.ok(!containsTerm('The railway station is close.','rail'));assert.ok(containsTerm('I look forward to hearing from you.','look forward to'));assert.deepEqual(exampleTerms('apply','p:applied/i:applying/3:applies/0:apply'),['apply','applied','applying','applies']);});
test('examples require complete attributed English sentences and direct Chinese translations',()=>{
 const valid={id:1,text:'I need to renew my passport.',lang:'eng',owner:'Author',license:'CC BY 2.0 FR',translations:[{id:2,text:'我需要换发护照。',lang:'cmn',owner:'Translator',license:'CC BY 2.0 FR',is_direct:true}]};
 const result=normalizeExamples([valid,{...valid,id:3},{...valid,text:'Passport, please.'},{...valid,text:'I left my wallet on the table.'},{...valid,translations:[]},{...valid,is_unapproved:true}],'passport');
 assert.equal(result.length,1);assert.equal(result[0].owner,'Author');assert.equal(result[0].zh,'我需要换发护照。');assert.equal(result[0].translationId,'2');
});
test('random selection avoids the previous group when enough alternatives exist',()=>{
 const pool=['a','b','c','d','e'].map(en=>({en}));const previous=pool.slice(0,2);const next=pickExamples(pool,previous,2,()=>.2);assert.equal(next.length,2);assert.ok(next.every(s=>!previous.includes(s)));assert.deepEqual(pool.map(s=>s.en),['a','b','c','d','e']);assert.deepEqual(pickExamples([],previous),[]);
});
test('all seed words have at least three relevant bilingual examples, including uncommon book words',()=>{
 const seeds=JSON.parse(readFileSync(new URL('../dist/data/example-seeds.json',import.meta.url)));
 const common=JSON.parse(readFileSync(new URL('../dist/data/dict-common.json',import.meta.url)));
 for(const[word,pairs]of Object.entries(curatedExamples))for(const[en,zh]of pairs){assert.ok(containsTerm(en,word),word);assert.match(zh,/[\u4e00-\u9fff]/);}
 for(const[word,result]of Object.entries(seeds)){const size=normalizeExamples(result.data,word,common[word]?.forms||'').length+(curatedExamples[word]?.length||0);assert.ok(size>=3,`${word}: ${size}`);if(!word.includes(' '))assert.ok(common[word]?.ipa,`missing IPA: ${word}`);}
});
