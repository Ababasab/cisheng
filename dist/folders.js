import {cleanEntries} from './words.js';
export const DEFAULT_FOLDER_ID='default';
export function folderName(value){return typeof value==='string'?value.trim().slice(0,60):'';}
export function migrateFolders(stored={}){
 const folders=[],ids=new Set();
 for(const folder of Array.isArray(stored.folders)?stored.folders:[]){
  if(!folder||typeof folder.id!=='string'||!folder.id||ids.has(folder.id)||!folderName(folder.name))continue;
  folders.push({id:folder.id,name:folderName(folder.name),archived:folder.archived===true});ids.add(folder.id);
 }
 const words=(Array.isArray(stored.words)?stored.words:[]).filter(w=>w&&typeof w.id==='string'&&typeof w.text==='string'&&cleanEntries(w.text).length===1).map(w=>({...w}));
 const needsDefault=!folders.length||words.some(w=>!ids.has(w.folderId));
 if(needsDefault&&!ids.has(DEFAULT_FOLDER_ID)){folders.unshift({id:DEFAULT_FOLDER_ID,name:'默认单词本',archived:false});ids.add(DEFAULT_FOLDER_ID);}
 for(const word of words)if(!ids.has(word.folderId))word.folderId=DEFAULT_FOLDER_ID;
 const activeFolderId=ids.has(stored.activeFolderId)?stored.activeFolderId:folders.find(f=>!f.archived)?.id||null;
 return {folders,words,activeFolderId};
}
export function folderWords(words,folderId){return words.filter(w=>w.folderId===folderId);}
export function addToFolder(words,entries,folderId,createId=()=>crypto.randomUUID()){
 const keys=new Set(folderWords(words,folderId).map(w=>w.text.toLowerCase()));const added=[];
 for(const text of entries){if(keys.has(text.toLowerCase()))continue;keys.add(text.toLowerCase());added.push({id:createId(),text,folderId});}
 return added;
}
