export const voiceId=v=>v?.voiceURI||`${v?.name}|${v?.lang}`;
function accentTag(lang){
 const tag=String(lang||'').replace(/_/g,'-');
 try{const locale=new Intl.Locale(tag);return `${locale.language}-${locale.region||''}`.toLowerCase();}catch{return tag.toLowerCase();}
}
export const accentLabel=lang=>accentTag(lang)==='en-gb'?'英式':'美式';
const failureId=v=>`${accentTag(v.lang)}|${voiceId(v)}`;
export function matchingVoices(voices,lang){return voices.filter(v=>accentTag(v.lang)===accentTag(lang)).sort((a,b)=>Number(b.localService===true)-Number(a.localService===true)||Number(b.default===true)-Number(a.default===true));}
export function orderedVoices(voices,lang,preferred='',failed=new Set()){
 const candidates=matchingVoices(voices,lang).filter(v=>!failed.has(failureId(v)));
 // Legacy "system default" preferences now choose a voice within this accent.
 const chosen=preferred==='__system__'?candidates.find(v=>v.default):candidates.find(v=>voiceId(v)===preferred);
 return chosen?[chosen,...candidates.filter(v=>v!==chosen)]:candidates;
}
export function speechErrorMessage(code){return ({network:'在线声音连接失败','synthesis-failed':'语音引擎合成失败','synthesis-unavailable':'设备语音引擎不可用','voice-unavailable':'所选声音不可用','language-unavailable':'设备没有可用的英语语音','audio-busy':'音频设备正被其他应用占用','audio-hardware':'没有可用的音频输出设备','not-allowed':'浏览器阻止了声音播放，请再次点击试听',timeout:'语音引擎没有开始播放'})[code]||`播放失败（${code||'unknown'}）`;}
export class SpeechPlayer{
 constructor(engine,Utterance,onState=()=>{},options={}){this.engine=engine;this.Utterance=Utterance;this.onState=onState;this.run=0;this.failed=new Set();this.startTimeout=options.startTimeout??7000;this.voicesTimeout=options.voicesTimeout??2500;this.fallback=options.fallback;}
 cancel(){this.run++;this.voiceCleanup?.();clearTimeout(this.startTimer);clearTimeout(this.endTimer);this.current=null;this.engine?.cancel();this.fallback?.cancel();}
 play(text,{lang='en-US',rate=.9,preferred=''}={}){
  this.cancel();const run=this.run;
  let candidates=[],index=0,attempt=0;
  try{this.fallback?.unlock();}catch{}
  const fallback=()=>{
   if(!this.fallback||run!==this.run)return false;
   attempt++;this.voiceCleanup?.();clearTimeout(this.startTimer);clearTimeout(this.endTimer);this.current={text,lang};
   try{this.fallback.play(text,{lang,rate,onState:(state,detail)=>{if(run!==this.run)return;if(['done','error','idle'].includes(state))this.current=null;else if(this.current&&detail.voice)this.current.voice=detail.voice;this.onState(state,detail);}});}
   catch{this.current=null;this.onState('error',{code:'browser-voice-failed',message:'网页声音启动失败，请刷新后重试。'});}
   return true;
  };
  if(preferred==='__builtin__'&&fallback())return;
  if(!this.engine||!this.Utterance){if(!fallback())this.onState('error',{code:'unsupported',message:'此浏览器不支持朗读，请用较新版本的浏览器打开。'});return;}
  const next=()=>{
   if(run!==this.run)return;
   const voice=candidates[index++],token=++attempt;clearTimeout(this.startTimer);clearTimeout(this.endTimer);
   const utterance=new this.Utterance(text);this.current=utterance;utterance.lang=lang;utterance.rate=rate;utterance.pitch=1;utterance.volume=1;utterance.voice=voice;
   const active=()=>run===this.run&&token===attempt;
   const fail=code=>{
    if(!active())return;attempt++;clearTimeout(this.startTimer);clearTimeout(this.endTimer);
    if(['canceled','interrupted'].includes(code)){this.current=null;this.onState('idle',{});return;}
    const retryable=!['not-allowed','audio-busy','audio-hardware'].includes(code);
    if(voice&&retryable)this.failed.add(failureId(voice));this.engine.cancel();
    if(retryable&&index<candidates.length){this.onState('retry',{code,message:speechErrorMessage(code)});next();}
    else if(!retryable||!fallback()){this.current=null;this.onState('error',{code,message:speechErrorMessage(code)});}
   };
   utterance.onstart=()=>{if(!active())return;clearTimeout(this.startTimer);this.onState('speaking',{voice});this.endTimer=setTimeout(()=>fail('synthesis-failed'),Math.max(15000,Math.min(150000,text.length*180/rate)));};
   utterance.onend=()=>{if(!active())return;attempt++;clearTimeout(this.startTimer);clearTimeout(this.endTimer);this.current=null;this.onState('done',{voice});};
   utterance.onerror=event=>fail(event.error||'synthesis-failed');this.onState('loading',{voice});this.startTimer=setTimeout(()=>fail('timeout'),this.startTimeout);
   try{this.engine.speak(utterance);if(this.engine.paused)this.engine.resume?.();}catch{fail('synthesis-failed');}
  };
  const begin=()=>{
   if(run!==this.run)return false;
   candidates=orderedVoices(this.engine.getVoices()||[],lang,preferred,this.failed);
   if(!candidates.length)return false;
   this.voiceCleanup?.();next();return true;
  };
  if(begin())return;
  if(fallback())return;
  this.onState('loading',{voice:null,lang,waitingVoices:true});
  let poll,timer;
  const changed=()=>begin();
  this.voiceCleanup=()=>{clearInterval(poll);clearTimeout(timer);this.engine.removeEventListener?.('voiceschanged',changed);this.voiceCleanup=null;};
  this.engine.addEventListener?.('voiceschanged',changed);
  poll=setInterval(changed,100);
  timer=setTimeout(()=>{
   if(run!==this.run)return;this.voiceCleanup?.();
   if(begin())return;
   const present=matchingVoices(this.engine.getVoices()||[],lang).length>0;
   this.onState('error',{code:present?'voice-unavailable':'accent-unavailable',lang,message:present?`${accentLabel(lang)}声音暂时不可用，请重新读取声音列表或选择其他${accentLabel(lang)}声音。`:`未检测到${accentLabel(lang)}（${lang}）声音，请安装对应英语语音包后重新读取声音列表。`});
  },this.voicesTimeout);
 }
}
