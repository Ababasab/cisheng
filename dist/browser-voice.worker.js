// Piper inference is isolated from the page and does not send text off the device.
const base=new URL('./vendor/speech/',self.location.href),CACHE='word-notes-speech-v1';
let runtime,phonemizer,config,session,loadedLang,phonemeResult,pending=null,busy=false,latest=0;
const send=(id,data)=>{if(id===latest)postMessage({id,...data});};
async function asset(path,id,label){
 const url=new URL(path,base).href;let cache;
 try{cache=await caches.open(CACHE);const hit=await cache.match(url);if(hit)return await hit.arrayBuffer();}catch{}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
 try{
  const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('asset download');
  const reader=response.body?.getReader(),total=Number(response.headers.get('content-length'))||0,chunks=[];let loaded=0,last=0;
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;if(Date.now()-last>150){last=Date.now();send(id,{type:'progress',message:`加载${label}${total?' '+Math.min(100,Math.round(loaded/total*100))+'%':''}`});}}}
  else chunks.push(new Uint8Array(await response.arrayBuffer()));
  const blob=new Blob(chunks);try{await cache?.put(url,new Response(blob));}catch{}
  return await blob.arrayBuffer();
 }finally{clearTimeout(timer);}
}
async function init(id){
 if(!runtime){
  send(id,{type:'progress',message:'加载网页发音引擎…'});
  runtime=await import(new URL('ort/ort.wasm.min.mjs',base).href);
  runtime.env.wasm.numThreads=1;runtime.env.wasm.proxy=false;runtime.env.wasm.wasmPaths=new URL('ort/',base).href;
 }
 if(!phonemizer){
  importScripts(new URL('phonemizer/piper_phonemize.js',base).href);
  const [data,wasm]=await Promise.all([asset('phonemizer/piper_phonemize.data',id,'发音数据'),asset('phonemizer/piper_phonemize.wasm',id,'发音引擎')]);
  phonemizer=await self.createPiperPhonemize({noInitialRun:true,noExitRuntime:true,wasmBinary:wasm,getPreloadedPackage:()=>data,locateFile:path=>new URL('phonemizer/'+path,base).href,print:line=>{try{const parsed=JSON.parse(line);if(Array.isArray(parsed.phoneme_ids))phonemeResult=parsed.phoneme_ids;}catch{}},printErr:()=>{}});
 }
}
async function synthesize(job){
 const {id,text,lang,rate}=job;if(!['en-US','en-GB'].includes(lang)||typeof text!=='string'||!text.trim()||text.length>500||!Number.isFinite(rate)||rate<.1||rate>2)throw Error('invalid input');
 await init(id);if(id!==latest)return;
 if(!session||loadedLang!==lang){
  if(session){await session.release();session=null;loadedLang=null;}
  const key=lang==='en-GB'?'gb':'us-amy-v2',label=lang==='en-GB'?'英式声音':'美式声音';
  const model=await asset(`models/${key}.onnx`,id,label);if(id!==latest)return;
  config=JSON.parse(new TextDecoder().decode(await asset(`models/${key}.onnx.json`,id,label+'配置')));
  send(id,{type:'progress',message:'正在准备'+label+'…'});
  session=await runtime.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});loadedLang=lang;
  if(lang==='en-US')try{const cache=await caches.open(CACHE);for(const path of ['models/us.onnx','models/us.onnx.json'])await cache.delete(new URL(path,base).href);}catch{}
 }
 if(id!==latest)return;send(id,{type:'progress',message:'正在生成发音…'});
 phonemeResult=null;
 try{phonemizer.callMain(['-l',config.espeak.voice,'--input',JSON.stringify([{text:text.trim()}]),'--espeak_data','/espeak-ng-data']);}catch(error){if(error?.status!==0)throw error;}
 if(!phonemeResult?.length)throw Error('phonemizer failed');
 const ids=BigInt64Array.from(phonemeResult,BigInt),feeds={input:new runtime.Tensor('int64',ids,[1,ids.length]),input_lengths:new runtime.Tensor('int64',BigInt64Array.of(BigInt(ids.length)),[1]),scales:new runtime.Tensor('float32',Float32Array.of(config.inference.noise_scale,config.inference.length_scale/rate,config.inference.noise_w),[3])};
 if(config.num_speakers>1)feeds.sid=new runtime.Tensor('int64',BigInt64Array.of(0n),[1]);
 const output=await session.run(feeds),pcm=new Float32Array(output.output.data);
 if(id===latest)postMessage({id,type:'audio',pcm:pcm.buffer,sampleRate:config.audio.sample_rate,lang},[pcm.buffer]);
 for(const tensor of Object.values(output))tensor.dispose?.();for(const tensor of Object.values(feeds))tensor.dispose?.();
}
self.onmessage=({data})=>{
 latest=data.id;if(data.type==='cancel'){pending=null;return;}
 pending=data;if(busy)return;busy=true;
 (async()=>{while(pending){const job=pending;pending=null;try{await synthesize(job);}catch{send(job.id,{type:'error',message:'网页声音加载或生成失败，请检查网络后重试。'});}}})().finally(()=>busy=false);
};
