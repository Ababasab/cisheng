export const dictionaryKey=word=>(word.toLowerCase()+'__').slice(0,2).replace(/[^a-z]/g,'_');
const CACHE_KEY='word-notes-dictionary-v1';
const ipaAliases={theatre:'theater'};
const valid=entry=>entry&&typeof entry.zh==='string'&&typeof entry.ipa==='string';
export function createDictionaryLookup({fetcher=globalThis.fetch,storage=null,timeout=10000}={}){
 const requests=new Map(),cache=new Map();let saveTimer;
 try{for(const [word,entry] of Object.entries(JSON.parse(storage?.getItem(CACHE_KEY)||'{}')).slice(-3000))if(valid(entry))cache.set(word,entry);}catch{}
 const flush=()=>{clearTimeout(saveTimer);try{storage?.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(cache)));}catch{}};
 const remember=(word,entry)=>{cache.delete(word);cache.set(word,entry);if(cache.size>3000)cache.delete(cache.keys().next().value);clearTimeout(saveTimer);saveTimer=setTimeout(flush,100);};
 function request(url){
  if(requests.has(url))return requests.get(url);
  const controller=new AbortController();let timer;
  const promise=Promise.race([
   Promise.resolve().then(()=>fetcher(url,{signal:controller.signal})).then(response=>{if(!response.ok)throw Error('词典下载失败');return response.json();}),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('词典加载超时，请重试'));},timeout);})
  ]).then(data=>{if(!data||typeof data!=='object'||Array.isArray(data))throw Error('词典数据无效');return data;}).catch(error=>{requests.delete(url);throw error;}).finally(()=>clearTimeout(timer));
  requests.set(url,promise);return promise;
 }
 async function lookup(text){
  const word=text.toLowerCase(),key=dictionaryKey(word);
  if(cache.has(word)&&(!ipaAliases[word]||cache.get(word).ipa))return cache.get(word);
  let entry;
  try{const common=await request(`./data/common/${key}.json`);if(Object.hasOwn(common,word)&&valid(common[word]))entry=common[word];}catch{}
  if(!entry){const full=await request(`./data/dict-${key}.json`);if(Object.hasOwn(full,word)&&valid(full[word]))entry=full[word];}
  if(entry&&!entry.ipa&&ipaAliases[word]){try{const alias=await lookup(ipaAliases[word]);if(alias?.ipa)entry={...entry,ipa:alias.ipa};}catch{}}
  if(entry)remember(word,entry);
  return entry||null;
 }
 lookup.flush=flush;return lookup;
}
let storage;try{storage=globalThis.localStorage;}catch{}
export const lookupWord=createDictionaryLookup({storage});
globalThis.addEventListener?.('pagehide',lookupWord.flush);
