// Find a clear page gutter only when there is substantial printed content on both sides.
export function findGutter(canvas) {
 const {width:w,height:h}=canvas;
 const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
 const ink=new Uint32Array(w);
 for(let y=Math.floor(h*.03);y<h*.97;y+=3)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(data[i]+data[i+1]+data[i+2]<420)ink[x]++;
 }
 const total=ink.reduce((a,b)=>a+b,0);if(!total)return null;
 let best=null,start=null;
 for(let x=Math.floor(w*.40);x<=w*.60;x++){
  if(ink[x]<=h*.0015){if(start===null)start=x;}
  else if(start!==null){if(!best||x-start>best.end-best.start)best={start,end:x};start=null;}
 }
 if(start!==null&&(!best||w*.60-start>best.end-best.start))best={start,end:Math.floor(w*.60)};
 if(!best||best.end-best.start<w*.015)return null;
 const split=Math.round((best.start+best.end)/2);
 const left=ink.slice(0,split).reduce((a,b)=>a+b,0);
 if(left/total<.20||left/total>.80)return null;
 return split;
}
export function headwordInset(canvas, rect) {
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const {data}=ctx.getImageData(rect.left,rect.top,rect.width,rect.height);
 const w=rect.width,h=rect.height,ink=new Uint32Array(w);
 // Ignore top-page decorations while looking for the gap after entry numbers.
 for(let y=Math.floor(h*.12);y<h*.94;y+=3)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(data[i]+data[i+1]+data[i+2]<420)ink[x]++;
 }
 let best=null,start=null;
 for(let x=Math.floor(w*.05);x<w*.25;x++){
  if(ink[x]<=h*.0015){if(start===null)start=x;}
  else if(start!==null){if(!best||x-start>best.end-best.start)best={start,end:x};start=null;}
 }
 if(!best||best.end-best.start<w*.012)return 0;
 const total=ink.reduce((a,b)=>a+b,0),before=ink.slice(0,best.start).reduce((a,b)=>a+b,0);
 if(!total||before/total<.005||before/total>.12)return 0;
 return best.end-2;
}
