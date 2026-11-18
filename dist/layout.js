// Ignore page-wide titles and footers when measuring persistent column gutters.
export function findColumns(canvas,layout='auto') {
 const {width:w,height:h}=canvas;
 let splits=[];
 if(layout==='double'||layout==='triple'){
  const n=layout==='triple'?3:2;for(let i=1;i<n;i++)splits.push(Math.round(w*i/n));
 }else if(layout!=='single'){
  const {data}=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),ink=new Uint32Array(w);
  for(let y=Math.floor(h*.14);y<h*.94;y+=3)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;if(Math.min(data[i],data[i+1],data[i+2])<170)ink[x]++;
  }
  const valleys=[];let start=null;
  for(let x=Math.floor(w*.16);x<=w*.84;x++){
   if(ink[x]<=h*.002){if(start===null)start=x;}
   else if(start!==null){if(x-start>=w*.012)valleys.push({x:Math.round((start+x)/2),width:x-start});start=null;}
  }
  if(start!==null&&w*.84-start>=w*.012)valleys.push({x:Math.round((start+w*.84)/2),width:w*.84-start});
  const total=ink.reduce((a,b)=>a+b,0);
  const sum=(a,b)=>ink.slice(a,b).reduce((x,y)=>x+y,0);
  // Repeated column spacing beats a wider gap between English and its translation.
  for(let n=4;n>=2;n--){
   const candidates=[];
   for(let i=1;i<n;i++){
    const target=w*i/n,near=valleys.filter(v=>Math.abs(v.x-target)<w/n*.24).sort((a,b)=>Math.abs(a.x-target)-Math.abs(b.x-target));
    if(near.length)candidates.push(near[0].x);
   }
   if(candidates.length!==n-1)continue;
   const bounds=[0,...candidates,w];
   if(bounds.slice(0,-1).every((left,i)=>sum(left,bounds[i+1])>total*.07)){splits=candidates;break;}
  }
  for(const v of splits.length?[]:valleys.sort((a,b)=>b.width-a.width)){
   const bounds=[0,...splits,w].sort((a,b)=>a-b),left=bounds.filter(x=>x<v.x).at(-1),right=bounds.find(x=>x>v.x);
   if(v.x-left>=w*.16&&right-v.x>=w*.16&&sum(left,v.x)>total*.10&&sum(v.x,right)>total*.10)splits.push(v.x);
   if(splits.length===3)break;
  }
 }
 const bounds=[0,...splits.sort((a,b)=>a-b),w];
 return bounds.slice(0,-1).map((left,i)=>({left,top:0,width:bounds[i+1]-left,height:h}));
}

// Remove long table rules while leaving letter strokes and colour intact.
export function removeTableRules(canvas){
 const {width:w,height:h}=canvas,ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,w,h),d=image.data;
 const rows=[],cols=[];
 const dark=(x,y)=>{const i=(y*w+x)*4;return Math.max(d[i],d[i+1],d[i+2])<150;};
 for(let y=0;y<h;y++){let run=0;for(let x=0;x<w;x++){run=dark(x,y)?run+1:0;if(run>w*.55){rows.push(y);break;}}}
 for(let x=0;x<w;x++){let run=0;for(let y=0;y<h;y++){run=dark(x,y)?run+1:0;if(run>h*.65){cols.push(x);break;}}}
 const white=(x,y)=>{const i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=255;};
 for(const y of rows)for(let dy=-1;dy<=1;dy++)if(y+dy>=0&&y+dy<h)for(let x=0;x<w;x++)white(x,y+dy);
 for(const x of cols)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<w)for(let y=0;y<h;y++)white(x+dx,y);
 if(rows.length||cols.length)ctx.putImageData(image,0,0);
}

export function colouredText(canvas){
 const {width:w,height:h}=canvas,ctx=canvas.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,w,h),d=image.data,bins=new Uint32Array(12);
 const hue=(r,g,b)=>{const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;if(delta<20||min>210)return -1;let v=max===r?(g-b)/delta:max===g?2+(b-r)/delta:4+(r-g)/delta;return (v*2+12)%12;};
 let ink=0,total=0;
 for(let y=Math.floor(h*.14);y<h*.94;y+=3)for(let x=0;x<w;x+=2){const i=(y*w+x)*4;if(Math.min(d[i],d[i+1],d[i+2])<180)ink++;const v=hue(d[i],d[i+1],d[i+2]);if(v>=0){bins[Math.round(v)%12]++;total++;}}
 const peak=bins.indexOf(Math.max(...bins)),support=bins[peak]+bins[(peak+1)%12]+bins[(peak+11)%12];
 if(total<ink*.08||support<total*.65||total<100)return null;
 for(let i=0;i<d.length;i+=4){const v=hue(d[i],d[i+1],d[i+2]),distance=Math.min(Math.abs(v-peak),12-Math.abs(v-peak));const value=v>=0&&distance<=1.6?Math.min(d[i],d[i+1],d[i+2]):255;d[i]=d[i+1]=d[i+2]=value;}
 const result=document.createElement('canvas');result.width=w;result.height=h;result.getContext('2d').putImageData(image,0,0);return result;
}

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
