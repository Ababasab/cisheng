import {visibleWords} from './words.js';

export function numberedWords(words,sort='az'){
 return visibleWords(words,'',sort).map((word,index)=>({...word,number:index+1}));
}
export const SPEECH_RATES=[0.5,0.75,1,1.25,1.5,1.75,2];

export function readingList(words,{mode='forward',query='',sort='az',range=''}={}){
 if(!words.length)throw Error('这个文件夹还没有单词，请先添加。');
 const ordered=numberedWords(words,sort);
 if(mode==='range'){
  const match=range.trim().match(/^(\d+)\s*[-－–—]\s*(\d+)$/);
  if(!match)throw Error('请输入起止编号，例如 203-260。');
  const start=Number(match[1]),end=Number(match[2]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<1)throw Error('单词编号必须是大于 0 的整数。');
  const numbers=new Set(ordered.map(w=>w.number));
  for(const number of [start,end])if(!numbers.has(number))throw Error(`编号 ${number} 不存在，请检查当前文件夹的单词编号。`);
  const direction=start<=end?1:-1,low=Math.min(start,end),high=Math.max(start,end);
  return ordered.filter(w=>w.number>=low&&w.number<=high).sort((a,b)=>(a.number-b.number)*direction);
 }
 const result=visibleWords(ordered,query,'original');
 if(!result.length)throw Error('当前搜索结果没有单词，请先清空或修改搜索。');
 return mode==='reverse'?result.reverse():result;
}

// Advance only on a real speech onend event. Never estimate a word's duration.
export class ReadingQueue{
 constructor({play,cancel,onChange=()=>{},gap=300}){
  this.play=play;this.cancelSpeech=cancel;this.onChange=onChange;this.gap=gap;
  this.items=[];this.index=-1;this.status='idle';this.run=0;this.resumeIndex=0;
 }
 get active(){return this.status==='reading'||this.status==='waiting';}
 get canResume(){return ['stopped','error'].includes(this.status)&&this.resumeIndex<this.items.length;}
 snapshot(){return {status:this.status,active:this.active,canResume:this.canResume,index:this.index,total:this.items.length,current:this.active?this.items[this.index]:null};}
 emit(){this.onChange(this.snapshot());}
 start(items){
  this.stop(false);this.items=items.map(w=>({...w}));this.index=0;this.resumeIndex=0;
  if(!this.items.length){this.status='idle';this.emit();return;}
  this.status='reading';this.emit();this.play(this.items[0]);
 }
 stop(notify=true){
  if(this.active)this.resumeIndex=this.status==='waiting'?this.index+1:this.index;
  this.run++;clearTimeout(this.timer);this.cancelSpeech();
  if(this.active)this.status='stopped';
  if(notify)this.emit();
 }
 resume(){if(!this.canResume)return;this.run++;clearTimeout(this.timer);this.index=this.resumeIndex;this.status='reading';this.emit();this.play(this.items[this.index]);}
 reset(){this.stop(false);this.items=[];this.index=-1;this.status='idle';this.emit();}
 handleSpeechState(state){
  if(!this.active)return;
  if(state==='done'){
   if(this.status!=='reading')return;
   this.resumeIndex=this.index+1;
   if(this.index+1>=this.items.length){this.status='complete';this.emit();return;}
   this.status='waiting';this.emit();const run=this.run;
   this.timer=setTimeout(()=>{if(run!==this.run||!this.active)return;this.index++;this.status='reading';this.emit();this.play(this.items[this.index]);},this.gap);
  }else if(state==='error'||state==='idle'){
   this.resumeIndex=this.status==='waiting'?this.index+1:this.index;this.run++;clearTimeout(this.timer);this.status=state==='error'?'error':'stopped';this.emit();
  }
 }
}
