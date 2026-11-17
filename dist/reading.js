import {visibleWords} from './words.js';

export function numberedWords(words,sort='az'){
 return visibleWords(words,'',sort).map((word,index)=>({...word,number:index+1}));
}

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
  this.items=[];this.index=-1;this.status='idle';this.run=0;
 }
 get active(){return this.status==='reading'||this.status==='waiting';}
 snapshot(){return {status:this.status,active:this.active,index:this.index,total:this.items.length,current:this.active?this.items[this.index]:null};}
 emit(){this.onChange(this.snapshot());}
 start(items){
  this.stop(false);this.items=items.map(w=>({...w}));this.index=0;
  if(!this.items.length){this.status='idle';this.emit();return;}
  this.status='reading';this.emit();this.play(this.items[0]);
 }
 stop(notify=true){
  this.run++;clearTimeout(this.timer);this.cancelSpeech();
  if(this.status!=='idle')this.status='stopped';
  if(notify)this.emit();
 }
 reset(){this.stop(false);this.items=[];this.index=-1;this.status='idle';this.emit();}
 handleSpeechState(state){
  if(!this.active)return;
  if(state==='done'){
   if(this.status!=='reading')return;
   if(this.index+1>=this.items.length){this.status='complete';this.emit();return;}
   this.status='waiting';this.emit();const run=this.run;
   this.timer=setTimeout(()=>{if(run!==this.run||!this.active)return;this.index++;this.status='reading';this.emit();this.play(this.items[this.index]);},this.gap);
  }else if(state==='error'||state==='idle'){
   this.run++;clearTimeout(this.timer);this.status=state==='error'?'error':'stopped';this.emit();
  }
 }
}
