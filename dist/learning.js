let seedRequest;
import {phraseKey} from './phrases.js';
export {dictionaryKey,lookupWord} from './dictionary.js';
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('数据暂时不可用，请稍后重试');return response.json();}
export function exampleTerms(word,forms=''){
 return [...new Set([word.toLowerCase(),...forms.split('/').filter(s=>/^[pdi3srt]:/.test(s)).flatMap(s=>s.slice(2).split(','))])].filter(Boolean);
}
export function containsTerm(sentence,term){
 const grammar=phraseKey(term).match(/^have (trouble|difficulty)(?: \(in\)| in)? doing(?: sth| something)?$/);
 if(grammar)return new RegExp(`\\b(?:have|has|had) ${grammar[1]} (?:in )?[a-z]+ing\\b`,'i').test(sentence);
 const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');
 return new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`,'i').test(sentence);
}
export function normalizeExamples(data,word,forms=''){
 const seen=new Set(),terms=exampleTerms(word,forms);
 return (Array.isArray(data)?data:[]).flatMap(s=>{
  if(typeof s.text!=='string'||s.is_unapproved||!s.owner||s.lang!=='eng'||!/^CC (?:BY|0)/.test(s.license||''))return [];
  const count=s.text.match(/[a-z]+(?:'[a-z]+)?/gi)?.length||0;
  if(count<6||count>27||s.text.length>230||!/[.!?]$/.test(s.text)||!terms.some(t=>containsTerm(s.text,t)))return [];
  const translations=(s.translations||[]).filter(t=>t.lang==='cmn'&&t.is_direct&&!t.is_unapproved&&t.owner&&typeof t.text==='string');
  const translation=translations.find(t=>t.script==='Hans')||translations[0];
  if(!translation||seen.has(s.text.toLowerCase()))return [];seen.add(s.text.toLowerCase());
  return [{id:String(s.id),en:s.text,zh:translation.text,owner:s.owner,translationOwner:translation.owner,translationId:String(translation.id),license:s.license,translationLicense:translation.license}];
 });
}
export async function loadExamples(word,forms=''){
 if(!seedRequest)seedRequest=json('./data/example-seeds.json').catch(e=>{seedRequest=null;throw e;});
 let seeds;try{seeds=await seedRequest;}catch{seeds={};}
 const {curatedExamples}=await import('./curated.js');
 const exampleKey=phraseKey(word).replace(/\(\s*in\s*\)\s*(?=doing\b)/g,'').replace(/ in doing\b/g,' doing').replace(/ doing(?: sth| something)?$/,' doing');
 const authored=(Object.hasOwn(curatedExamples,exampleKey)?curatedExamples[exampleKey]:[]).map(([en,zh],i)=>({id:`local-${word}-${i}`,en,zh,owner:'词声例句库',translationOwner:'词声例句库',license:'CC0 1.0',translationLicense:'CC0 1.0',local:true}));
 const local=[...authored,...(Object.hasOwn(seeds,word.toLowerCase())?normalizeExamples(seeds[word.toLowerCase()].data,word,forms):[])];
 if(local.length)return local;
 const params=new URLSearchParams({lang:'eng',q:word,sort:'relevance',limit:'40',word_count:'6-27','trans:lang':'cmn','trans:is_direct':'yes',showtrans:'matching',is_unapproved:'no',is_orphan:'no',is_native:'yes'});
 const response=await json('https://api.tatoeba.org/v1/sentences?'+params);
 return normalizeExamples(response.data,word,forms);
}
export function pickExamples(pool,previous=[],count=2,random=Math.random){
 const old=new Set(previous.map(s=>s.en));const fresh=pool.filter(s=>!old.has(s.en));
 const candidates=fresh.length>=Math.min(count,pool.length)?fresh:[...fresh,...pool.filter(s=>old.has(s.en))];
 // Shuffle only the unseen portion first; exhausted pools may repeat.
 const n=fresh.length||candidates.length;
 for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 return candidates.slice(0,count);
}
