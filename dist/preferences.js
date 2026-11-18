const choice=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
const text=(value,max=200)=>typeof value==='string'?value.slice(0,max):'';
export function normalizePreferences(value={}){
 value=value&&typeof value==='object'?value:{};
 const details=Object.create(null),views=Object.create(null);
 for(const [key,open] of Object.entries(value.details||{}).slice(0,50))if(/^[\w-]{1,80}$/.test(key)&&typeof open==='boolean')details[key]=open;
 for(const [key,view] of Object.entries(value.views||{}).slice(-200)){
  if(!key||key.length>200||!view||typeof view!=='object')continue;
  const position=view.position,valid=position&&Number.isFinite(position.scrollTop)&&position.scrollTop>=0&&position.scrollTop<=1e7;
  views[key]={query:text(view.query),range:text(view.range,40),position:valid?{anchor:text(position.anchor,256),offset:Number.isFinite(position.offset)?Math.max(-2000,Math.min(2000,position.offset)):0,scrollTop:position.scrollTop}:null};
 }
 const column=typeof value.fileColumn==='string'&&(/^(?:auto|all)$/.test(value.fileColumn)||/^\d{1,2}$/.test(value.fileColumn))?value.fileColumn:'auto';
 return {sort:choice(value.sort,['az','original'],'az'),layout:choice(value.layout,['auto','single','double','triple'],'auto'),extract:choice(value.extract,['auto','headwords','all'],'auto'),fileMode:choice(value.fileMode,['entries','all'],'entries'),fileColumn:column,fileSourceName:text(value.fileSourceName),details,views};
}

export function captureListPosition(list){
 if(!list.children.length)return null;
 const box=list.getBoundingClientRect(),rows=list.children;let low=0,high=rows.length;
 while(low<high){const mid=(low+high)>>1;if(rows[mid].getBoundingClientRect().bottom<=box.top)low=mid+1;else high=mid;}
 const row=rows[Math.min(low,rows.length-1)];return {anchor:row.dataset.wordId,offset:row.getBoundingClientRect().top-box.top,scrollTop:list.scrollTop};
}
export function restoreListPosition(list,position){
 if(!position){list.scrollTop=0;return;}
 const row=position.anchor?list.querySelector(`[data-word-id="${CSS.escape(position.anchor)}"]`):null;
 if(row)list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-position.offset;
 else list.scrollTop=position.scrollTop||0;
}
