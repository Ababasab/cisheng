export const browserVoice=lang=>({name:lang==='en-GB'?'网页英式 · Alba':'网页美式 · Joe',lang,voiceURI:'__builtin__',localService:true,builtin:true});
export class BrowserVoice{
 constructor({WorkerClass=globalThis.Worker,AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,timeout=240000}={}){this.WorkerClass=WorkerClass;this.AudioContextClass=AudioContextClass;this.timeout=timeout;this.sequence=0;this.run=0;this.jobs=new Map();this.audioCache=new Map();}
 unlock(){
  if(!this.context&&this.AudioContextClass)this.context=new this.AudioContextClass();
  if(this.context?.state==='suspended'){
   this.context.resume().catch(()=>{});
   // Unlock Web Audio during the tap, before an asynchronous model download (iOS).
   const pulse=this.context.createBufferSource();pulse.buffer=this.context.createBuffer(1,1,22050);pulse.connect(this.context.destination);pulse.onended=()=>pulse.disconnect();pulse.start();
  }
 }
 cancel(){
  this.run++;try{this.source?.stop();}catch{}this.source=null;
  this.worker?.postMessage({type:'cancel',id:++this.sequence});
  for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(new DOMException('Canceled','AbortError'));}this.jobs.clear();
 }
 reset(){this.cancel();this.worker?.terminate();this.worker=null;this.audioCache.clear();}
 request(text,lang,rate,progress){
  if(!this.worker){
   this.worker=new this.WorkerClass(new URL('./browser-voice.worker.js',import.meta.url));
   this.worker.onmessage=({data})=>{const job=this.jobs.get(data.id);if(!job)return;if(data.type==='progress'){job.progress(data.message);return;}clearTimeout(job.timer);this.jobs.delete(data.id);if(data.type==='audio')job.resolve(data);else job.reject(Error(data.message));};
   this.worker.onerror=event=>{event.preventDefault?.();for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(Error('网页声音引擎启动失败，请刷新后重试。'));}this.jobs.clear();this.worker?.terminate();this.worker=null;};
  }
  const id=++this.sequence;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.jobs.delete(id);this.worker?.terminate();this.worker=null;reject(Error('网页声音加载超时，请换稳定网络后重试。'));},this.timeout);this.jobs.set(id,{resolve,reject,timer,progress});this.worker.postMessage({id,text,lang,rate});});
 }
 play(text,{lang,rate,onState}){
  this.cancel();this.unlock();const run=this.run,voice=browserVoice(lang),active=()=>run===this.run;
  onState('loading',{voice,progressMessage:'正在准备网页声音…'});
  (async()=>{
   if(!this.context||!this.WorkerClass)throw Error('此浏览器不支持网页发音，请使用较新版本的浏览器。');
   const key=JSON.stringify([lang,text,rate]);let result=this.audioCache.get(key);
   if(!result){result=await this.request(text,lang,rate,message=>{if(active())onState('loading',{voice,progressMessage:message});});if(!active())return;
    if(result.pcm.byteLength<4*1024*1024){this.audioCache.set(key,result);while([...this.audioCache.values()].reduce((size,item)=>size+item.pcm.byteLength,0)>8*1024*1024)this.audioCache.delete(this.audioCache.keys().next().value);}
   }
   if(!active())return;if(this.context.state==='suspended')await this.context.resume();if(!active())return;
   if(this.context.state!=='running')throw Error('请再点一次朗读，允许浏览器播放声音。');
   const samples=new Float32Array(result.pcm);if(!samples.length)throw Error('网页声音未生成，请重试。');
   const buffer=this.context.createBuffer(1,samples.length,result.sampleRate);buffer.copyToChannel(samples,0);
   const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);this.source=source;
   source.onended=()=>{source.disconnect();if(active()){this.source=null;onState('done',{voice});}};
   source.start();onState('speaking',{voice});
  })().catch(error=>{if(active()&&error.name!=='AbortError')onState('error',{code:'browser-voice-failed',message:error.message,voice});});
 }
}
