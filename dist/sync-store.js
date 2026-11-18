import {snapshotOf,mergeInitial} from './sync-model.js';

export const DATA_KEY='word-notes-v1';
const OWNER='word-notes-owner-v1',GUEST='word-notes-guest-v1',PREFIX='word-notes-account-v1:';
const read=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')||fallback;}catch{return fallback;}};

// Keep separate device drafts per account; signing out never hands account data to another user.
export class ProfileStore{
 constructor(storage){this.storage=storage;this.owner=null;}
 boot(){
  const previous=this.storage.getItem(OWNER);
  if(previous){
   const cached=read(this.storage,PREFIX+previous,null),latest=read(this.storage,DATA_KEY,null);
   if(latest)this.writeAccount(previous,{...(cached||{base:null,revision:0}),current:latest});
   this.storage.setItem(DATA_KEY,JSON.stringify(read(this.storage,GUEST,{})));this.storage.removeItem(OWNER);
  }
  return read(this.storage,DATA_KEY,{});
 }
 save(state){
  this.storage.setItem(DATA_KEY,JSON.stringify(state));
  if(this.owner){const cached=this.account();this.writeAccount(this.owner,{...cached,current:state});}
  else this.storage.setItem(GUEST,JSON.stringify(state));
 }
 account(){return read(this.storage,PREFIX+this.owner,{current:{},base:null,revision:0});}
 writeAccount(owner,state){this.storage.setItem(PREFIX+owner,JSON.stringify(state));}
 enter(owner){
  if(this.owner===owner)return this.account().current;
  const guest=read(this.storage,GUEST,read(this.storage,DATA_KEY,{}));
  let cached=read(this.storage,PREFIX+owner,null);
  if(!cached)cached={current:{...guest,...mergeInitial(snapshotOf(guest),{folders:[],words:[]})},base:null,revision:0};
  this.writeAccount(owner,cached);this.owner=owner;this.storage.setItem(OWNER,owner);this.storage.setItem(DATA_KEY,JSON.stringify(cached.current));
  return cached.current;
 }
 leave(){
  this.owner=null;this.storage.removeItem(OWNER);const guest=read(this.storage,GUEST,{});this.storage.setItem(DATA_KEY,JSON.stringify(guest));return guest;
 }
 synchronized(base,revision,current){this.writeAccount(this.owner,{...this.account(),base,revision,current});this.storage.setItem(DATA_KEY,JSON.stringify(current));}
}
