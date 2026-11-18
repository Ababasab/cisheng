import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences} from '../dist/preferences.js';
import {ProfileStore,DATA_KEY} from '../dist/sync-store.js';
import {snapshotOf} from '../dist/sync-model.js';

test('remember durable choices while rejecting invalid controls and unsafe position values',()=>{
 const prefs=normalizePreferences({sort:'original',layout:'triple',extract:'all',fileMode:'all',fileColumn:'2',fileSourceName:'学习表',details:{'voice-info':true},views:{one:{query:'research',range:'28-32',position:{anchor:'w28',offset:-15,scrollTop:4200}},bad:{position:{scrollTop:Infinity}}},password:'do-not-store'});
 assert.equal(prefs.sort,'original');assert.equal(prefs.fileColumn,'2');assert.equal(prefs.details['voice-info'],true);assert.equal(prefs.views.one.position.anchor,'w28');assert.equal(prefs.views.bad.position,null);assert.ok(!JSON.stringify(prefs).includes('do-not-store'));
 const invalid=normalizePreferences({sort:'unknown',layout:'unknown',extract:'unknown',fileColumn:'-1',views:null});assert.equal(invalid.sort,'az');assert.equal(invalid.layout,'auto');assert.equal(invalid.extract,'auto');assert.equal(invalid.fileColumn,'auto');
});
test('preferences stay in account device drafts and never enter cloud vocabulary snapshots',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},store=new ProfileStore(storage);
 store.save({folders:[],words:[],uiPreferences:{sort:'original'}});store.enter('alice');store.save({folders:[],words:[],uiPreferences:{sort:'az'}});store.leave();assert.equal(JSON.parse(storage.getItem(DATA_KEY)).uiPreferences.sort,'original');store.enter('alice');assert.equal(store.account().current.uiPreferences.sort,'az');assert.ok(!Object.hasOwn(snapshotOf(store.account().current),'uiPreferences'));
});
test('a second tab boot does not reset ownership, and an old tab cannot overwrite another account',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},a=new ProfileStore(storage);a.save({folders:[],words:[],marker:'guest'});a.enter('alice');a.save({folders:[],words:[],marker:'alice'});
 const second=new ProfileStore(storage);assert.equal(second.boot().marker,'guest');assert.equal(storage.getItem('word-notes-owner-v1'),'alice');assert.equal(JSON.parse(storage.getItem(DATA_KEY)).marker,'alice');second.save({marker:'guest preference change'});assert.equal(JSON.parse(storage.getItem(DATA_KEY)).marker,'alice');
 second.enter('bob');assert.throws(()=>a.save({marker:'private alice draft'}),/账号已变更/);assert.throws(()=>a.synchronized({folders:[],words:[]},1,{marker:'private alice draft'}));assert.ok(!storage.getItem(DATA_KEY).includes('private alice'));
});
test('saving a UI choice cannot overwrite words saved by another tab',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},first=new ProfileStore(storage);first.save({folders:[],words:[]});first.enter('alice');
 const second=new ProfileStore(storage);second.boot();second.enter('alice');second.save({folders:[{id:'f',name:'词库'}],words:[{id:'w',text:'apple',folderId:'f',number:1}]});first.savePreferences({sort:'original'});
 assert.equal(first.account().current.words[0].text,'apple');assert.equal(first.account().current.uiPreferences.sort,'original');
});
