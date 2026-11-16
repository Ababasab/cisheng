import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadingProgress,OcrWorker} from '../dist/ocr.js';
test('loading reports model bytes and separate initialization stages',()=>{const p=loadingProgress({status:'model download',loaded:1048576,total:2952873,progress:.35});assert.match(p.label,/1\.0 \/ 2\.8 MB/);assert.ok(p.value>0);assert.match(loadingProgress({status:'loading tesseract core',progress:0}).label,/启动识别引擎/);assert.match(loadingProgress({status:'initializing api',progress:1}).label,/初始化识别器/);});
test('pending initialization can be terminated immediately; late responses do nothing',async()=>{
 const original=globalThis.Worker;let raw;
 globalThis.Worker=class{constructor(){raw=this;}postMessage(){}terminate(){this.stopped=true;}};
 try{const w=new OcrWorker(()=>{},{baseURL:'https://example.com/vendor/',timeout:1000});const job=w.request('load',{});const rejected=assert.rejects(job,{name:'AbortError'});await w.terminate();await rejected;assert.ok(raw.stopped);assert.equal(w.jobs.size,0);raw.onmessage({data:{jobId:'word-ocr-1',status:'resolve',data:{}}});assert.equal(w.jobs.size,0);}finally{globalThis.Worker=original;}
});
test('worker errors and timeouts reject pending stages instead of hanging',async()=>{
 const original=globalThis.Worker;let raw;globalThis.Worker=class{constructor(){raw=this;}postMessage(){}terminate(){this.stopped=true;}};
 try{let w=new OcrWorker(()=>{},{baseURL:'https://example.com/vendor/',timeout:10});await assert.rejects(w.request('load',{}),/超时/);assert.ok(raw.stopped);
 w=new OcrWorker(()=>{},{baseURL:'https://example.com/vendor/',timeout:1000});const job=w.request('load',{}),rejected=assert.rejects(job,/引擎加载失败/);raw.onerror({preventDefault(){}});await rejected;assert.ok(raw.stopped);}finally{globalThis.Worker=original;}
});
