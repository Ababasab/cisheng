export function phraseKey(text){return text.toLowerCase().trim().replace(/[’‘]/g,"'").replace(/\b(sb|sth)\./g,'$1').replace(/(?:\.{3,}|…+)/g,' … ').replace(/\s+/g,' ');}
// Expand only grammatical placeholders, never guess a different content word.
export function phraseVariants(text){
 const key=phraseKey(text),variants=new Set([key]);
 const placeholders=key.replace(/\bsomething\b/g,'sth').replace(/\b(?:somebody|someone)\b/g,'sb');
 variants.add(placeholders);
 for(const value of [...variants]){
  const optional=value.replace(/\(\s*in\s*\)\s*(?=doing\b)/g,'').replace(/\(\s*sth\s*\)/g,'sth').replace(/\s+/g,' ').trim();
  variants.add(optional);
  if(/\bdoing(?: sth)?$/.test(optional)){
   const stem=optional.replace(/(?: in)? doing(?: sth)?$/,'');
   for(const ending of [' doing',' doing sth',' in doing',' in doing sth'])variants.add(stem+ending);
  }
 }
 variants.delete(key);return [...variants];
}
export function grammaticalPhrase(text,entries){
 for(const candidate of phraseVariants(text)){
  const entry=Object.hasOwn(entries,candidate)&&entries[candidate];
  if(typeof entry?.zh==='string'&&typeof entry?.ipa==='string')return {...entry,ipa:'',kind:'grammar',matchedText:candidate,source:'ECDICT'};
 }
 return null;
}
export function phraseMatches(text,entries){
 const key=phraseKey(text);if(!key.includes('…'))return [];
 const escape=s=>s.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');
 const pattern=new RegExp('^'+key.split('…').map(escape).join("(?: [a-z'-]+){0,5} ")+'$','i');
 return Object.entries(entries).filter(([word,entry])=>pattern.test(word)&&typeof entry?.zh==='string').slice(0,6).map(([text,entry])=>({text,zh:entry.zh}));
}
export function componentMeaning(parts){
 return '未找到完整短语释义；以下为单词释义参考，不等于短语翻译：\n'+parts.map(({word,entry})=>`${word}：${entry.zh.split('\n').slice(0,2).join('；').slice(0,180)}`).join('\n');
}
