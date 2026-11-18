import {cleanEntries,extractHeadwords,extractWords} from './words.js';

// TSV keeps confidence and line positions so Chinese lookalikes don't become vocabulary.
export function ocrLines(data){
 if(!data.tsv)return data.text.split(/\r?\n/).filter(s=>s.trim()).map((text,i)=>({text,top:i*30,height:20,words:[],confidence:75}));
 const lines=new Map();
 for(const row of data.tsv.split('\n')){
  const s=row.replace(/\r$/,'').split('\t');if(s[0]!=='5'||!s[11]?.trim())continue;
  const key=s.slice(1,5).join(':');
  if(!lines.has(key))lines.set(key,{words:[],top:Number(s[7]),height:Number(s[9])});
  const line=lines.get(key);line.words.push({text:s[11],confidence:Number(s[10])});
  const bottom=Math.max(line.top+line.height,Number(s[7])+Number(s[9]));line.top=Math.min(line.top,Number(s[7]));line.height=bottom-line.top;
 }
 return [...lines.values()].map(line=>({...line,text:line.words.map(w=>w.text).join(' ')}));
}

const pos=/^(?:n|v|a|adj|adv|vt|vi|ad|pron|prep|conj|num|art|aux|interj)[./]$/i;
export function entryFromLine(line,mode='auto'){
 if(/^\s*[—–=]+\s*[.、]/.test(line.text)&&/(?:短语|词组|词汇|单词|单元)/.test(line.text))return null;
 const source=line.words.length?line.words:line.text.split(/\s+/).map(text=>({text,confidence:75}));
 const parts=[],scores=[];
 for(const word of source){
  let s=word.text.replace(/[‘’]/g,"'");
  if(!parts.length)s=s.replace(/^[\s\d.,、:;|)({}\[\]•·—–-]+/,'');
  if(!s)continue;
  if(word.confidence<55&&!(parts.length&&word.confidence>=20&&/^[a-z]{2,}(?:['/-][a-z]+)*$/.test(s)))break;
  if(parts.length&&/^[A-Z]{2,}[^a-z]*$/.test(s)&&word.confidence<85)break;
  const cut=s.search(/[\u3400-\u9fff(（【\[\]:：;；=→]/);const boundary=cut>=0;if(boundary)s=s.slice(0,cut);
  if(!s)break;
  if(pos.test(s)||/^\//.test(s))break;
  s=s.replace(/[,，.!?]+$/g,match=>/^\.{3,}$/.test(match)?match:'');
  if(!/^[a-z]+(?:['/-][a-z]+)*(?:(?:\.{3,}|…+)[a-z]+(?:['/-][a-z]+)*)*$|^(?:sb|sth)\.$|^(?:\.{3,}|…+)$/i.test(s))break;
  parts.push(s);scores.push(word.confidence);
  if(boundary)break;
 }
 let text=parts.join(' ').replace(/\s+(?:n|v|adj|adv|vt|vi|prep|pron)\..*$/i,'');
 if(mode==='headwords')text=extractHeadwords(text);
 if(mode==='all')text=extractWords(text);
 const entries=cleanEntries(text);
 if(!entries.length||/^(?:vocabulary list|english words|unit \d+|lesson \d+|page \d+)$/i.test(text))return null;
 return {...line,text:entries.join('\n'),confidence:scores.reduce((a,b)=>a+b,0)/scores.length};
}

export function readOcrEntries(data,mode='auto'){
 const lines=ocrLines(data),heights=lines.map(l=>l.height).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||20;
 return lines.filter(l=>l.height<median*1.8).map(line=>entryFromLine(line,mode)).filter(Boolean);
}

// A colour pass can repair fused/low-confidence words, but never replaces strong original text.
export function mergeOcrEntries(original,coloured){
 if(coloured.length<4)return original;
 const close=(a,b)=>Math.abs((a.top+a.height/2)-(b.top+b.height/2))<Math.max(a.height,b.height)*.7;
 if(coloured.filter(c=>original.some(o=>close(o,c))).length<coloured.length*.6)return original;
 const count=text=>(text.match(/[a-z]+(?:['/-][a-z]+)*/gi)||[]).length;
 const merged=original.map(o=>{const c=coloured.find(c=>close(o,c));return c&&o.confidence<90&&c.confidence>o.confidence+4&&count(c.text)>=count(o.text)&&(!o.text.includes('…')||c.text.includes('…'))?c:o;});
 for(const c of coloured)if(c.confidence>=75&&!original.some(o=>close(o,c)))merged.push(c);
 return merged.sort((a,b)=>a.top-b.top);
}
