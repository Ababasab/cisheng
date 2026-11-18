import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapshotOf,mergeInitial,mergeSnapshots} from '../dist/sync-model.js';
import {ProfileStore,DATA_KEY} from '../dist/sync-store.js';
import {SyncEngine} from '../dist/sync-engine.js';
import {validateCloudConfig} from '../dist/cloud.js';

const state=(texts=[],name='默认单词本',id='default')=>snapshotOf({folders:[{id,name}],words:texts.map((text,i)=>({id:`${text}-id`,text,folderId:id,number:i+1}))});
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('first phone/computer login merges folder names and vocabulary without changing valid ids',()=>{
 const a=state(['apple','banana'],'四级','phone'),b=state(['banana','concert'],'四级','computer');
 const merged=mergeInitial(a,b);assert.equal(merged.folders.length,1);assert.deepEqual(merged.words.map(w=>w.text),['banana','concert','apple']);
 assert.ok(merged.words.every(w=>w.folderId==='computer'));assert.equal(new Set(merged.words.map(w=>w.number)).size,3);
 assert.equal(mergeInitial(state([]),b).folders.length,1);
 const conflict=mergeInitial(state(['apple'],'手机','default'),state(['banana'],'电脑','default'),()=> 'unique');
 assert.equal(conflict.folders.length,2);assert.equal(conflict.words.find(w=>w.text==='apple').folderId,'unique');
});
test('three-way merge preserves independent offline edits and deletions do not resurrect',()=>{
 const base=state(['apple','banana']),local=structuredClone(base),remote=structuredClone(base);
 local.words.push({id:'new',text:'concert',folderId:'default',number:3});remote.words[0].text='apples';remote.folders[0].name='核心词';
 let merged=mergeSnapshots(base,local,remote);assert.deepEqual(merged.words.map(w=>w.text),['apples','banana','concert']);assert.equal(merged.folders[0].name,'核心词');
 local.words=local.words.filter(w=>w.text!=='banana');remote.words[1].text='bananas';merged=mergeSnapshots(base,local,remote);assert.ok(!merged.words.some(w=>w.text.startsWith('banana')));
 remote.words=[];assert.deepEqual(mergeSnapshots(base,base,remote).words,[]);
 remote.folders=[];assert.deepEqual(mergeSnapshots(base,local,remote),{folders:[],words:[]});
});
test('simultaneous additions deduplicate by word inside one folder while preserving other folders',()=>{
 const base=state([]),local=state(['apple']),remote=state(['apple']);remote.words[0].id='remote';
 assert.equal(mergeSnapshots(base,local,remote).words.length,1);
 local.folders.push({id:'other',name:'旅行'});local.words.push({id:'different',text:'apple',folderId:'other',number:1});assert.equal(mergeSnapshots(base,local,remote).words.length,2);
});
test('account switching, reload and signing out never adopt another account draft as guest data',()=>{
 const storage=memory(),store=new ProfileStore(storage),guest=state(['guest']);storage.setItem(DATA_KEY,JSON.stringify(guest));store.boot();store.save(guest);
 assert.equal(store.enter('alice').words[0].text,'guest');store.save(state(['private']));store.leave();assert.equal(JSON.parse(storage.getItem(DATA_KEY)).words[0].text,'guest');
 assert.equal(store.enter('bob').words[0].text,'guest');assert.ok(!store.account().current.words.some(w=>w.text==='private'));
 store.enter('alice');assert.equal(store.account().current.words[0].text,'private');
 const reloaded=new ProfileStore(storage);assert.equal(reloaded.boot().words[0].text,'guest');reloaded.save(guest);assert.equal(reloaded.enter('alice').words[0].text,'private');
});
test('sync retries a server revision conflict and preserves edits made during upload',async()=>{
 const store=new ProfileStore(memory());store.save(state(['apple']));store.enter('alice');let revision=0,payload=state(['banana']),commits=0;let applied;
 const engine=new SyncEngine({store,delay:5,remote:{read:async()=>({revision,payload}),commit:async(expected,next,owner)=>{assert.equal(owner,'alice');commits++;if(commits===1){payload=state(['banana','gallery']);revision++;return {saved:false,revision,payload};}assert.equal(expected,revision);const now=store.account().current;store.save({...now,words:[...now.words,{id:'late',text:'concert',folderId:'default',number:9}]});payload=next;return {saved:true,revision:++revision,payload};}},apply:value=>{applied=value;}});
 await engine.attach();engine.detach();assert.equal(commits,2);assert.deepEqual(new Set(store.account().current.words.map(w=>w.text)),new Set(['apple','banana','gallery','concert']));assert.ok(applied.words.some(w=>w.text==='gallery'));
});
test('late network responses cannot apply an old account snapshot after account switching',async()=>{
 const store=new ProfileStore(memory());store.save(state(['guest']));store.enter('alice');let resolve,applied=0;
 const engine=new SyncEngine({store,remote:{read:()=>new Promise(r=>resolve=r)},apply:()=>applied++});const pending=engine.attach();engine.detach();store.leave();store.enter('bob');resolve({revision:1,payload:state(['private'])});await pending;
 assert.equal(applied,0);assert.equal(store.owner,'bob');assert.ok(!store.account().current.words.some(w=>w.text==='private'));
});
test('hung requests time out without discarding the local draft and remain retryable',async()=>{
 const store=new ProfileStore(memory());store.save(state(['apple']));store.enter('alice');let status;
 const engine=new SyncEngine({store,timeout:15,delay:5,remote:{read:()=>new Promise(()=>{})},apply:()=>assert.fail(),onStatus:s=>status=s});await engine.attach();assert.equal(status,'error');assert.equal(store.account().current.words[0].text,'apple');engine.detach();
});
test('cloud configuration rejects server-only keys and keeps unconfigured builds local',()=>{
 assert.equal(validateCloudConfig({url:'',publishableKey:''}),false);assert.equal(validateCloudConfig({url:'https://example.supabase.co',publishableKey:'sb_publishable_example'}),true);
 assert.throws(()=>validateCloudConfig({url:'https://example.supabase.co',publishableKey:'sb_secret_example'}),/禁止/);
 const jwt=role=>'a.'+btoa(JSON.stringify({role}))+'.c';assert.throws(()=>validateCloudConfig({url:'https://example.supabase.co',publishableKey:jwt('service_role')}));
 assert.throws(()=>validateCloudConfig({url:'http://example.supabase.co',publishableKey:'sb_publishable_example'}));
});
