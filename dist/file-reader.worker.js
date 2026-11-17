import {decodeFileText,parseDelimited,ROW_LIMIT} from './file-words.js';

self.onmessage=async({data:{bytes,type}})=>{
 try{
  if(['txt','csv','tsv'].includes(type)){
   const text=decodeFileText(bytes);
   const rows=type==='txt'?text.split(/\r?\n/).filter(s=>s.trim()).map(s=>[s]):parseDelimited(text,type==='tsv'?'\t':text.split(/\r?\n/)[0].includes(';')&&!text.split(/\r?\n/)[0].includes(',')?';':',');
   if(rows.length>ROW_LIMIT)throw Error('词表超过 20,000 行，请拆分后导入。');
   self.postMessage({sources:[{name:'词表',type:type==='txt'?'text':'table',rows}]});return;
  }
  const {unzipSync,strFromU8}=await import('./vendor/documents/fflate.mjs');let total=0;
  const files=unzipSync(bytes,{filter:file=>{
   const wanted=type==='docx'?file.name==='word/document.xml':/^(?:xl\/(?:workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/[^/]+\.xml))$/.test(file.name);
   if(!wanted)return false;
   total+=file.originalSize;
   if(file.originalSize>32*1024*1024||total>64*1024*1024)throw Error('解压后的词表过大，请拆分文件后导入。');
   return true;
  }});
  if(type==='docx'&&!files['word/document.xml'])throw Error('没有找到 Word 正文，请确认文件确实为 .docx 格式。');
  if(type==='xlsx'&&!files['xl/workbook.xml'])throw Error('没有找到 Excel 工作簿，请确认文件确实为 .xlsx 格式。');
  self.postMessage({xml:Object.fromEntries(Object.entries(files).map(([name,data])=>[name,strFromU8(data)]))});
 }catch(error){self.postMessage({error:/[\u3400-\u9fff]/.test(error.message)?error.message:error instanceof TypeError?'文件读取组件未能加载，请检查网络后重试。':'文件内容无效或损坏，请重新另存为对应格式后导入。'});}
};
