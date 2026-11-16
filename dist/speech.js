export const voiceId=v=>v?.voiceURI||`${v?.name}|${v?.lang}`;
export function matchingVoices(voices,lang){return voices.filter(v=>v.lang?.replace(/_/g,'-').toLowerCase()===lang.toLowerCase()).sort((a,b)=>Number(b.localService===true)-Number(a.localService===true)||Number(b.default===true)-Number(a.default===true));}
export function speechErrorMessage(code){return ({network:'在线声音连接失败','synthesis-failed':'语音引擎合成失败','synthesis-unavailable':'设备语音引擎不可用','voice-unavailable':'所选声音不可用','language-unavailable':'设备没有可用的英语语音','audio-busy':'音频设备正被其他应用占用','audio-hardware':'没有可用的音频输出设备','not-allowed':'浏览器阻止了声音播放，请再次点击试听',timeout:'语音引擎没有开始播放'})[code]||`播放失败（${code||'unknown'}）`;}
export class SpeechPlayer{
 constructor(engine,Utterance,onState=()=>{},options={}){this.engine=engine;this.Utterance=Utterance;this.onState=onState;this.run=0;this.failed=new Set();this.startTimeout=options.startTimeout??7000;}
 cancel(){this.run++;clearTimeout(this.startTimer);clearTimeout(this.endTimer);this.current=null;this.engine?.cancel();}
 play(text,{lang='en-US',rate=.9,preferred=''}={}){
  this.cancel();const run=this.run;
  if(!this.engine||!this.Utterance){this.onState('error',{code:'unsupported',message:'此浏览器不支持朗读，请用 Edge、Chrome 或 Safari 打开。'});return;}
  let candidates=preferred==='__system__'?[]:matchingVoices(this.engine.getVoices(),lang).filter(v=>!this.failed.has(voiceId(v)));
  const chosen=candidates.find(v=>voiceId(v)===preferred);if(chosen)candidates=[chosen,...candidates.filter(v=>v!==chosen)];
  candidates.push(null);let index=0,attempt=0;
  const next=()=>{
   if(run!==this.run)return;
   const voice=candidates[index++],token=++attempt;clearTimeout(this.startTimer);clearTimeout(this.endTimer);
   const utterance=new this.Utterance(text);this.current=utterance;utterance.lang=lang;utterance.rate=rate;utterance.pitch=1;utterance.volume=1;if(voice)utterance.voice=voice;
   const active=()=>run===this.run&&token===attempt;
   const fail=code=>{
    if(!active())return;attempt++;clearTimeout(this.startTimer);clearTimeout(this.endTimer);
    if(['canceled','interrupted'].includes(code)){this.current=null;this.onState('idle',{});return;}
    const retryable=!['not-allowed','audio-busy','audio-hardware'].includes(code);
    if(voice&&retryable)this.failed.add(voiceId(voice));this.engine.cancel();
    if(retryable&&index<candidates.length){this.onState('retry',{code,message:speechErrorMessage(code)});next();}
    else{this.current=null;this.onState('error',{code,message:speechErrorMessage(code)});}
   };
   utterance.onstart=()=>{if(!active())return;clearTimeout(this.startTimer);this.onState('speaking',{voice});this.endTimer=setTimeout(()=>fail('synthesis-failed'),Math.max(15000,Math.min(150000,text.length*180/rate)));};
   utterance.onend=()=>{if(!active())return;attempt++;clearTimeout(this.startTimer);clearTimeout(this.endTimer);this.current=null;this.onState('done',{voice});};
   utterance.onerror=event=>fail(event.error||'synthesis-failed');this.onState('loading',{voice});this.startTimer=setTimeout(()=>fail('timeout'),this.startTimeout);
   try{this.engine.speak(utterance);if(this.engine.paused)this.engine.resume?.();}catch{fail('synthesis-failed');}
  };next();
 }
}
