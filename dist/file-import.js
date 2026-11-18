import {documentType,pdfTextRows,ROW_LIMIT} from './file-words.js';
import {OcrWorker,loadingProgress} from './ocr.js';
import {findColumns,colouredText,removeTableRules} from './layout.js';
import {readOcrEntries,mergeOcrEntries} from './ocr-entries.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function check(signal){if(signal.aborted)throw new DOMException('已取消导入','AbortError');}
function cancellable(promise,signal,timeout=90000){
 return new Promise((resolve,reject)=>{
  const abort=()=>{cleanup();reject(new DOMException('已取消导入','AbortError'));};
  const timer=setTimeout(()=>{cleanup();reject(Error('文件读取超时，请重试或拆分文件后导入。'));},timeout);
  const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  promise.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
 });
}
function xmlDocument(text){
 if(!text || /<!DOCTYPE/i.test(text))throw Error('文件正文无效，请重新另存文件再导入。');
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('文件正文损坏，请重新另存文件再导入。');
 return doc;
}
const nodes=(el,name)=>Array.from(el.getElementsByTagNameNS('*',name));
const child=(el,name)=>Array.from(el.children).find(node=>node.localName===name);
const wordText=el=>{
 let text='';
 const walk=node=>{
  if(node.localName==='del')return;
  if(node.localName==='t')text+=node.textContent;
  else if(node.localName==='tab')text+='\t';
  else if(['br','cr'].includes(node.localName))text+='\n';
  else {for(const c of node.children)walk(c);if(node.localName==='p')text+='\n';}
 };
 walk(el);return text.trim();
};
async function docxSources(xml,signal){
 const doc=xmlDocument(xml['word/document.xml']),body=nodes(doc,'body')[0];
 if(!body)throw Error('Word 文档没有正文。');
 const sources=[];let paragraphs=[],table=0,processed=0;
 const flush=()=>{if(paragraphs.length){sources.push({name:`正文 ${sources.length+1}`,type:'text',rows:paragraphs});paragraphs=[];}};
 for(const node of body.children){
  check(signal);
  if(node.localName==='tbl'){
   flush();const rows=nodes(node,'tr').map(row=>Array.from(row.children).filter(c=>c.localName==='tc').map(wordText));
   sources.push({name:`表格 ${++table}`,type:'table',rows});
  }else if(node.localName==='p'){const text=wordText(node);if(text)paragraphs.push(...text.split('\n').map(line=>line.split('\t')));}
  else if(node.localName==='sdt')for(const p of nodes(node,'p')){const text=wordText(p);if(text)paragraphs.push(...text.split('\n').map(line=>line.split('\t')));}
  if(sources.length>100)throw Error('Word 表格过多，请拆分后导入。');
  if(++processed%200===0)await tick();
 }
 flush();return sources;
}
function colIndex(address){let index=0;for(const c of address.match(/^[A-Z]+/i)?.[0]||'')index=index*26+c.toUpperCase().charCodeAt(0)-64;return index-1;}
async function xlsxSources(xml,signal){
 const workbook=xmlDocument(xml['xl/workbook.xml']);
 const rels=xmlDocument(xml['xl/_rels/workbook.xml.rels']);
 const paths=new Map(nodes(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>{
  const path=new URL(r.getAttribute('Target'),'https://local.invalid/xl/workbook.xml').pathname.slice(1);
  return [r.getAttribute('Id'),path];
 }));
 const strings=xml['xl/sharedStrings.xml']?nodes(xmlDocument(xml['xl/sharedStrings.xml']),'si').map(si=>nodes(si,'t').map(t=>t.textContent).join('')):[];
 const sources=[];
 for(const sheet of nodes(workbook,'sheet')){
  check(signal);
  if(['hidden','veryHidden'].includes(sheet.getAttribute('state')))continue;
  const id=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const path=paths.get(id);if(!xml[path])throw Error('Excel 工作表不完整，请重新另存为 .xlsx 文件。');
  const doc=xmlDocument(xml[path]),rows=[];
  for(const row of nodes(doc,'row')){
   const values=[];
   for(const cell of Array.from(row.children).filter(c=>c.localName==='c')){
    const index=colIndex(cell.getAttribute('r')||'')>=0?colIndex(cell.getAttribute('r')):values.length;
    if(index>=100)throw Error('表格超过 100 列，请只保留词表区域。');
    const type=cell.getAttribute('t'),value=child(cell,'v')?.textContent||'';
    values[index]=type==='s'?(strings[Number(value)]||''):type==='inlineStr'?nodes(cell,'t').map(t=>t.textContent).join(''):type==='e'?'':value;
   }
   if(values.some(value=>String(value||'').trim()))rows.push(values);
   if(rows.length>ROW_LIMIT)throw Error('工作表超过 20,000 行，请拆分后导入。');
   if(rows.length%500===0){await tick();check(signal);}
  }
  if(rows.length)sources.push({name:sheet.getAttribute('name')||`工作表 ${sources.length+1}`,type:'table',rows});
  if(sources.length>50)throw Error('工作表超过 50 个，请拆分后导入。');
 }
 return sources;
}
async function readWorker(bytes,type,signal){
 const worker=new Worker(new URL('./file-reader.worker.js',import.meta.url),{type:'module'});
 try{
  return await cancellable(new Promise((resolve,reject)=>{
   worker.onmessage=({data})=>data.error?reject(Error(data.error)):resolve(data);
   worker.onerror=event=>{event.preventDefault();reject(Error('文件读取组件未能加载，请刷新网页后重试。'));};
   worker.postMessage({bytes,type},[bytes.buffer]);
  }),signal,60000);
 }finally{worker.terminate();}
}
async function pdfSources(bytes,{signal,onProgress}){
 const pdfjs=await cancellable(import('./vendor/documents/pdfjs/pdf.mjs'),signal);
 check(signal);pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/documents/pdfjs/pdf.worker.mjs',import.meta.url).href;
 const base=new URL('./vendor/documents/pdfjs/',import.meta.url).href;
 const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/'});
 let ocr=null;const cancel=()=>{task.destroy().catch(()=>{});ocr?.terminate().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 let pageNumber=0,scannedPages=0;
 try{
  const pdf=await cancellable(task.promise,signal,60000);check(signal);
  if(pdf.numPages>200)throw Error('PDF 超过 200 页，请先按章节拆分后导入。');
  const rows=[];
  for(pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
   check(signal);onProgress(`读取 PDF 第 ${pageNumber} / ${pdf.numPages} 页`,(pageNumber-1)/pdf.numPages);
   const page=await cancellable(pdf.getPage(pageNumber),signal);
   const content=await cancellable(page.getTextContent(),signal);
   const text=content.items.map(item=>item.str||'').join(''),letters=text.replace(/[^A-Za-z]/g,'').length;
   let scan=false;
   if(letters<80){const ops=await cancellable(page.getOperatorList(),signal);scan=ops.fnArray.some(op=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageMaskXObject].includes(op));}
   if(!scan){rows.push(...pdfTextRows(content.items));}
   else{
    scannedPages++;
    onProgress(`识别扫描页 ${pageNumber} / ${pdf.numPages} · 正在准备`,(pageNumber-1)/pdf.numPages);
    const unit=page.getViewport({scale:1}),scale=Math.min(3,2600/Math.max(unit.width,unit.height));
    const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    try{
     const rendering=page.render({canvasContext:canvas.getContext('2d'),viewport});
     const abortRender=()=>rendering.cancel();signal.addEventListener('abort',abortRender,{once:true});
     try{await cancellable(rendering.promise,signal);}finally{signal.removeEventListener('abort',abortRender);}
     check(signal);
     if(!ocr){ocr=new OcrWorker(m=>{if(!signal.aborted)onProgress(`扫描页 ${pageNumber} / ${pdf.numPages} · ${m.status==='recognizing text'?`识别 ${Math.round(m.progress*100)}%`:loadingProgress(m).label}`,(pageNumber-1)/pdf.numPages);});await ocr.initialize({mixed:true});await ocr.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});}
     removeTableRules(canvas);const columns=findColumns(canvas),colour=colouredText(canvas);
     for(const rect of columns){check(signal);const result=await ocr.recognize(canvas,{rectangle:rect});let entries=readOcrEntries(result.data);if(colour){check(signal);const alternate=await ocr.recognize(colour,{rectangle:rect});entries=mergeOcrEntries(entries,readOcrEntries(alternate.data));}rows.push(...entries.map(entry=>[entry.text]));}
     if(colour)colour.width=colour.height=0;
    }finally{canvas.width=canvas.height=0;}
   }
   page.cleanup();
   if(rows.length>ROW_LIMIT)throw Error('PDF 词表超过 20,000 行，请拆分后导入。');
   await tick();
  }
  return {sources:[{name:'全部页面',type:'text',rows}],scannedPages};
 }catch(error){
  if(signal.aborted)throw new DOMException('已取消导入','AbortError');
  if(error.name==='PasswordException')throw Error('PDF 有密码保护，请先解锁并另存后导入。');
  if(['InvalidPDFException','MissingPDFException'].includes(error.name))throw Error('PDF 内容无效或损坏，请重新另存后导入。');
  throw error;
 }finally{signal.removeEventListener('abort',cancel);await ocr?.terminate().catch(()=>{});await task.destroy().catch(()=>{});}
}
export async function readDocument(file,{signal,onProgress=()=>{}}){
 const type=documentType(file);check(signal);onProgress('读取文件…',0);
 const bytes=new Uint8Array(await cancellable(file.arrayBuffer(),signal));check(signal);
 let result;
 if(type==='pdf')result=await pdfSources(bytes,{signal,onProgress});
 else{
  onProgress('整理文件中的词表…',.25);
  const data=await readWorker(bytes,type,signal);check(signal);
  result={sources:data.sources||(type==='docx'?await docxSources(data.xml,signal):await xlsxSources(data.xml,signal)),scannedPages:0};
 }
 check(signal);
 if(!result.sources.length || !result.sources.some(s=>s.rows.length))throw Error('文件里没有可读取的文字或词表，请检查文件内容。');
 if(result.sources.reduce((count,source)=>count+source.rows.length,0)>ROW_LIMIT)throw Error('文件总行数超过 20,000，请拆分后导入。');
 onProgress('词表已读取，请校对后添加。',1);return result;
}
