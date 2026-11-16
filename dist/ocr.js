// Adapter for the pinned Tesseract.js 6.0.1 worker protocol; owns the worker during initialization.
export class OcrWorker{
 constructor(logger=()=>{},options={}){
  if(typeof Worker==='undefined'||typeof WebAssembly==='undefined')throw Error('此浏览器不支持本地识别，请用较新版本的 Safari、Chrome 或 Edge 打开。');
  this.logger=logger;this.jobs=new Map();this.sequence=0;this.timeout=options.timeout??90000;this.closed=false;this.abort=new AbortController();
  this.base=options.baseURL||new URL('./vendor/',import.meta.url).href;this.raw=new Worker(new URL('worker.min.js',this.base));
  this.raw.onmessage=({data:m})=>{
   if(this.closed)return;if(m.status==='progress'){this.logger(m.data);return;}
   const job=this.jobs.get(m.jobId);if(!job)return;clearTimeout(job.timer);this.jobs.delete(m.jobId);
   if(m.status==='resolve')job.resolve({data:m.data});else job.reject(new Error('识别线程处理失败，请重试；若持续失败，请换清晰图片或系统浏览器。'));
  };
  this.raw.onerror=event=>{event.preventDefault?.();this.fail(new Error('识别引擎加载失败，请检查网络后重试，或用 Safari / Chrome 打开。'));};
 }
 fail(error){if(this.closed)return;this.closed=true;this.failureError=error;this.abort.abort();this.raw.terminate();for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(error);}this.jobs.clear();}
 async terminate(){this.fail(new DOMException('已取消识别','AbortError'));}
 request(action,payload){
  if(this.closed)return Promise.reject(new DOMException('已取消识别','AbortError'));
  const jobId=`word-ocr-${++this.sequence}`;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.fail(new Error('识别资源加载或处理超时，请换 Wi-Fi 后重试。')),this.timeout);this.jobs.set(jobId,{resolve,reject,timer});this.raw.postMessage({workerId:'word-ocr',jobId,action,payload});});
 }
 async initialize(){
  this.logger({status:'model download',progress:0});const timeout=setTimeout(()=>this.abort.abort(),120000);let bytes;
  try{
   const response=await fetch(new URL('lang/eng-lstm-v1.traineddata.gz',this.base),{signal:this.abort.signal});
   if(!response.ok)throw Error(`英语模型下载失败（HTTP ${response.status}），请检查网络后重试。`);
   const total=Number(response.headers.get('Content-Length'))||2952873;
   if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;this.logger({status:'model download',progress:Math.min(size/total,1),loaded:size,total});}
    bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   }else bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes[0]!==31||bytes[1]!==139)throw Error('英语模型内容不完整，请检查网络后重试。');
  }catch(error){if(this.closed)throw this.failureError||new DOMException('已取消识别','AbortError');if(error.name==='AbortError')throw Error('英语模型下载超时，请换 Wi-Fi 后重试。');throw error;}
  finally{clearTimeout(timeout);}
  if(this.closed)throw new DOMException('已取消识别','AbortError');
  await this.request('load',{options:{lstmOnly:true,corePath:new URL('core/',this.base).href,logging:false}});
  // Bypass IndexedDB language-cache hangs by passing the downloaded model bytes directly.
  await this.request('loadLanguage',{langs:[{code:'eng',data:bytes}],options:{cacheMethod:'none',gzip:true,lstmOnly:true}});
  await this.request('initialize',{langs:'eng',oem:1,config:{}});
 }
 setParameters(params){return this.request('setParameters',{params});}
 async recognize(canvas,options={}){const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片转换失败，请换一张图片。')),'image/png'));const image=new Uint8Array(await blob.arrayBuffer());return this.request('recognize',{image,options,output:{text:true}});}
}
export function loadingProgress(m){
 if(m.status==='model download')return {label:`下载英语模型 ${((m.loaded||0)/1048576).toFixed(1)} / ${((m.total||2952873)/1048576).toFixed(1)} MB`,value:Math.min(.4,(m.progress||0)*.4)};
 const stages={'loading tesseract core':['下载并启动识别引擎',.4,.2],'initializing tesseract':['准备识别内存',.6,.1],'loading language traineddata':['装载英语模型',.7,.15],'initializing api':['初始化识别器',.85,.1]};
 const stage=stages[m.status]||['正在准备识别…',.4,0];return {label:`${stage[0]}${m.progress===undefined?'':` ${Math.round(m.progress*100)}%`}`,value:stage[1]+(m.progress||0)*stage[2]};
}
