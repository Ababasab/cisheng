import {cleanEntries,extractWords} from './words.js';

export const FILE_LIMIT = 20 * 1024 * 1024;
export const ROW_LIMIT = 20000;
export function documentType(file) {
 const ext = file.name.toLowerCase().split('.').pop();
 if (['doc','xls'].includes(ext)) throw Error('旧版 .doc / .xls 请先另存为 .docx / .xlsx，再导入。');
 if (!['txt','csv','tsv','docx','xlsx','pdf'].includes(ext)) throw Error('请选择 PDF、Word (.docx)、Excel (.xlsx)、TXT、CSV 或 TSV 文件。');
 if (!file.size) throw Error('文件是空的，请重新选择。');
 if (file.size > FILE_LIMIT) throw Error('文件超过 20 MB，请拆分或压缩后导入。');
 return ext;
}
export function decodeFileText(bytes) {
 let encoding = 'utf-8';
 if (bytes[0]===255 && bytes[1]===254) encoding='utf-16le';
 else if (bytes[0]===254 && bytes[1]===255) encoding='utf-16be';
 try {return new TextDecoder(encoding,{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');}
 catch {return new TextDecoder('gb18030').decode(bytes).replace(/^\uFEFF/,'');}
}
export function parseDelimited(text, delimiter=',') {
 const rows=[];let row=[],cell='',quoted=false;
 const push=()=>{row.push(cell);cell='';if(row.some(value=>value.trim()))rows.push(row);row=[];if(rows.length>ROW_LIMIT)throw Error('词表超过 20,000 行，请分成几个文件导入。');};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"' && (quoted || !cell)) {if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted && c===delimiter){row.push(cell);cell='';if(row.length>100)throw Error('表格超过 100 列，请只保留词表区域。');}
  else if(!quoted && (c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;push();}
  else cell+=c;
 }
 if(quoted)throw Error('CSV 的引号不完整，请重新导出文件。');
 if(cell || row.length)push();
 return rows;
}
const header=/^(?:words?|headwords?|vocabulary|english(?: words?)?|词汇|词条|单词|英文|英语|英文单词|中文|释义|翻译|meaning|definition|translation|序号|编号|no\.?|index|phonetics?|音标|词性)$/i;
export function fileEntry(value) {
 let s=String(value??'').trim().replace(/[‘’]/g,"'").replace(/^[\d\s.,、:;|)({}\[\]•·—–-]+/,'');
 if(!s || header.test(s) || /^(?:unit|lesson|chapter|page|cet)\b\s*[-:：]?\s*\d/i.test(s))return '';
 s=s.replace(/\/[^/\n]*\//g,' ').replace(/\[[^\]\n]*\]/g,' ');
 // Keep phrases, but stop before IPA, Chinese, POS labels or annotations.
 s=s.split(/[\u3400-\u9fff(（【:：;；=→\t]/)[0];
 s=s.replace(/\s+(?:n|v|a|adj|adv|vt|vi|ad|pron|prep|conj|num|art|aux|interj)\s*[./].*$/i,'');
 s=s.trim().replace(/[,，]+$/,'');
 if(s!=='a' && /^(?:n|v|a|adj|adv|vt|vi|ad|pron|prep|conj|num|art|aux|interj)\.?$/i.test(s))return '';
 if(s.split(/\s+/).length>8 || /[.!?。！？]$/.test(s))return '';
 return cleanEntries(s)[0]||'';
}
export function autoColumns(rows) {
 const width=Math.min(100,Math.max(0,...rows.slice(0,200).map(r=>r.length)));
 const named=[];
 for(const row of rows.slice(0,5))for(let i=0;i<row.length;i++)
  if(/^(?:words?|headwords?|vocabulary|english(?: words?)?|词汇|词条|单词|英文|英语|英文单词)$/i.test(String(row[i]??'').trim()))named.push(i);
 if(named.length)return [...new Set(named)];
 const scores=Array.from({length:width},(_,index)=>rows.slice(0,200).reduce((score,row)=>{
  const value=String(row[index]??'');const entry=fileEntry(value);
  return score+(entry?1+(entry.split(' ').length===1?0.5:0):0);
 },0));
 const best=Math.max(...scores);
 return best>0?[scores.indexOf(best)]:[];
}
export function extractFileEntries(sources,{source='all',column='auto',mode='entries'}={}) {
 const entries=[];
 for(let i=0;i<sources.length;i++){
  if(source!=='all'&&String(i)!==source)continue;
  const part=sources[i];
  const columns=column==='auto'?(part.type==='text'?null:autoColumns(part.rows)):column==='all'?null:[Number(column)];
  for(const row of part.rows){
   const cells=columns?columns.map(c=>row[c]):row;
   for(const cell of cells)for(const line of String(cell??'').split(/\r?\n/)){
    if(header.test(line.trim()))continue;
    if(mode==='all')entries.push(...extractWords(line).split('\n'));
    else {const word=fileEntry(line);if(word)entries.push(word);}
   }
  }
 }
 const result=cleanEntries(entries.join('\n'));
 if(result.length>ROW_LIMIT)throw Error('提取的词条超过 20,000 个，请拆分词表后导入。');
 return result;
}
export function pdfTextRows(items) {
 const lines=[];
 const sorted=items.filter(item=>item.str?.trim()).map(item=>({text:item.str,x:item.transform[4],y:item.transform[5],height:Math.max(1,Math.hypot(item.transform[2],item.transform[3])),width:item.width||0})).sort((a,b)=>b.y-a.y||a.x-b.x);
 for(const item of sorted){
  let line=lines.slice(-3).find(line=>Math.abs(line.y-item.y)<=Math.min(line.height,item.height)*.35);
  if(!line){line={y:item.y,height:item.height,items:[]};lines.push(line);}
  line.items.push(item);
 }
 return lines.map(line=>{
  line.items.sort((a,b)=>a.x-b.x);const cells=[];let text='',last=null;
  for(const item of line.items){
   const gap=last?item.x-last.x-last.width:0;
   if(last && gap>Math.max(last.height,item.height)*2){cells.push(text.trim());text='';}
   else if(last && gap>Math.min(last.height,item.height)*.12 && text && !/\s$/.test(text))text+=' ';
   text+=item.text;last=item;
  }
  if(text.trim())cells.push(text.trim());return cells;
 });
}
