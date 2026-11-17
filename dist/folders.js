import {cleanEntries} from './words.js';
export const DEFAULT_FOLDER_ID='default';
export function folderName(value){return typeof value==='string'?value.trim().slice(0,60):'';}
export function migrateFolders(stored={}){
 const folders=[],ids=new Set();
 for(const folder of Array.isArray(stored.folders)?stored.folders:[]){
  if(!folder||typeof folder.id!=='string'||!folder.id||ids.has(folder.id)||!folderName(folder.name))continue;
  folders.push({id:folder.id,name:folderName(folder.name),archived:folder.archived===true,nextNumber:Number.isSafeInteger(folder.nextNumber)&&folder.nextNumber>0?folder.nextNumber:1});ids.add(folder.id);
 }
 const words=(Array.isArray(stored.words)?stored.words:[]).filter(w=>w&&typeof w.id==='string'&&typeof w.text==='string'&&cleanEntries(w.text).length===1).map(w=>({...w}));
 const needsDefault=!folders.length||words.some(w=>!ids.has(w.folderId));
 if(needsDefault&&!ids.has(DEFAULT_FOLDER_ID)){folders.unshift({id:DEFAULT_FOLDER_ID,name:'默认单词本',archived:false,nextNumber:1});ids.add(DEFAULT_FOLDER_ID);}
 for(const word of words)if(!ids.has(word.folderId))word.folderId=DEFAULT_FOLDER_ID;
 // Preserve valid existing numbers; assign legacy/invalid entries in import order.
 const state=new Map(folders.map(f=>[f.id,{used:new Set(),next:f.nextNumber}]));
 for(const word of words){const s=state.get(word.folderId);if(Number.isSafeInteger(word.number)&&word.number>0&&!s.used.has(word.number)){s.used.add(word.number);s.next=Math.max(s.next,word.number+1);}else delete word.number;}
 for(const word of words)if(!word.number){const s=state.get(word.folderId);word.number=s.next++;}
 for(const folder of folders)folder.nextNumber=state.get(folder.id).next;
 const activeFolderId=ids.has(stored.activeFolderId)?stored.activeFolderId:folders.find(f=>!f.archived)?.id||null;
 return {folders,words,activeFolderId};
}
export function folderWords(words,folderId){return words.filter(w=>w.folderId===folderId);}
export function addToFolder(words,entries,folderId,createId=()=>crypto.randomUUID(),firstNumber=1){
 const keys=new Set(folderWords(words,folderId).map(w=>w.text.toLowerCase()));const added=[];
 let next=Number.isSafeInteger(firstNumber)&&firstNumber>0?firstNumber:1;
 for(const word of folderWords(words,folderId))if(Number.isSafeInteger(word.number))next=Math.max(next,word.number+1);
 for(const text of entries){if(keys.has(text.toLowerCase()))continue;keys.add(text.toLowerCase());added.push({id:createId(),text,folderId,number:next++});}
 return added;
}
