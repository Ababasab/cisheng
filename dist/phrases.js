export function phraseKey(text){return text.toLowerCase().trim().replace(/[’‘]/g,"'").replace(/\b(sb|sth)\./g,'$1').replace(/(?:\.{3,}|…+)/g,' … ').replace(/\s+/g,' ');}
export function oxfordSearchURL(text){return 'https://www.oxfordlearnersdictionaries.com/search/english/?q='+encodeURIComponent(phraseKey(text));}
export function phraseMatches(text,entries){
 const key=phraseKey(text);if(!key.includes('…'))return [];
 const escape=s=>s.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');
 const pattern=new RegExp('^'+key.split('…').map(escape).join("(?: [a-z'-]+){0,5} ")+'$','i');
 return Object.entries(entries).filter(([word,entry])=>pattern.test(word)&&typeof entry?.zh==='string').slice(0,6).map(([text,entry])=>({text,zh:entry.zh}));
}
export function componentMeaning(parts){
 return '未找到完整短语释义；以下为单词释义参考，不等于短语翻译：\n'+parts.map(({word,entry})=>`${word}：${entry.zh.split('\n').slice(0,2).join('；').slice(0,180)}`).join('\n');
}
