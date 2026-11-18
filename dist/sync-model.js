import {migrateFolders} from './folders.js';

export const emptySnapshot=()=>({folders:[],words:[]});
const copy=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function snapshotOf(value={}){
 value=value||{};
 if(!Array.isArray(value.folders)||!Array.isArray(value.words))return emptySnapshot();
 if(!value.folders.length&&!value.words.length)return emptySnapshot();
 const state=migrateFolders(value);
 return {folders:state.folders.map(f=>({id:f.id,name:f.name,archived:f.archived,nextNumber:f.nextNumber})),words:state.words.map(w=>({id:w.id,text:w.text,folderId:w.folderId,number:w.number}))};
}

function coalesce(state){
 const names=new Map(),aliases=new Map(),folders=[];
 for(const f of state.folders){const key=f.name.toLocaleLowerCase();if(names.has(key))aliases.set(f.id,names.get(key));else{names.set(key,f.id);folders.push(f);}}
 const seen=new Set(),words=[];
 for(const w of state.words){const folderId=aliases.get(w.folderId)||w.folderId,key=`${folderId}\0${w.text.toLocaleLowerCase()}`;if(seen.has(key))continue;seen.add(key);words.push({...w,folderId});}
 return snapshotOf({folders,words});
}

// First login adopts guest words conservatively: names/text deduplicate; different content survives.
export function mergeInitial(local,remote,createId=()=>crypto.randomUUID()){
 local=snapshotOf(local);remote=copy(snapshotOf(remote));
 const aliases=new Map(),folderIds=new Set(remote.folders.map(f=>f.id)),wordIds=new Set(remote.words.map(w=>w.id));
 for(const f of local.folders){
  if(!local.words.length&&local.folders.length===1&&f.id==='default'&&f.name==='默认单词本'&&remote.folders.length)continue;
  const found=remote.folders.find(r=>r.name.toLocaleLowerCase()===f.name.toLocaleLowerCase());
  const id=found?.id||(folderIds.has(f.id)?createId():f.id);aliases.set(f.id,id);
  if(!found){remote.folders.push({...f,id});folderIds.add(id);}
 }
 for(const w of local.words){
  const folderId=aliases.get(w.folderId);if(!folderId)continue;
  if(remote.words.some(r=>r.folderId===folderId&&r.text.toLocaleLowerCase()===w.text.toLocaleLowerCase()))continue;
  const id=wordIds.has(w.id)?createId():w.id;remote.words.push({...w,id,folderId});wordIds.add(id);
 }
 return coalesce(remote);
}

function mergeRows(base,local,remote){
 const b=new Map(base.map(row=>[row.id,row])),l=new Map(local.map(row=>[row.id,row])),r=new Map(remote.map(row=>[row.id,row])),result=[];
 for(const id of new Set([...r.keys(),...l.keys()])){
  const before=b.get(id),left=l.get(id),right=r.get(id);
  // A deletion on either device wins over an old edit, until a new entry is explicitly added.
  if(before&&(!left||!right))continue;
  if(!left||!right){result.push(copy(left||right));continue;}
  const row={};for(const key of new Set([...Object.keys(right),...Object.keys(left)]))row[key]=same(left[key],before?.[key])?right[key]:left[key];
  result.push(row);
 }
 return result;
}

export function mergeSnapshots(base,local,remote){
 if(base===null)return mergeInitial(local,remote);
 base=snapshotOf(base);local=snapshotOf(local);remote=snapshotOf(remote);
 const folders=mergeRows(base.folders,local.folders,remote.folders),ids=new Set(folders.map(f=>f.id));
 const words=mergeRows(base.words,local.words,remote.words).filter(w=>ids.has(w.folderId));
 return coalesce({folders,words});
}
export const sameSnapshot=(a,b)=>same(snapshotOf(a),snapshotOf(b));
