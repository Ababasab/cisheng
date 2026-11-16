import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateFolders,folderWords,addToFolder} from '../dist/folders.js';
test('legacy words migrate losslessly with stable word ids and other metadata',()=>{
 const legacy={words:[{id:'old-a',text:'apple',custom:'keep'},{id:'old-p',text:'passport'}]};
 const result=migrateFolders(legacy);assert.equal(result.folders.length,1);assert.equal(result.activeFolderId,'default');assert.deepEqual(result.words.map(w=>w.id),['old-a','old-p']);assert.equal(result.words[0].custom,'keep');assert.ok(result.words.every(w=>w.folderId==='default'));assert.equal(legacy.words[0].folderId,undefined);
});
test('deduplication stays inside a folder and permits the same word in another folder',()=>{
 const words=[{id:'a',text:'Apple',folderId:'one'}];let n=0;
 assert.deepEqual(addToFolder(words,['apple'],'one',()=>String(++n)),[]);
 const added=addToFolder(words,['apple','apple','banana'],'two',()=>String(++n));assert.equal(added.length,2);assert.equal(folderWords([...words,...added],'one').length,1);assert.equal(folderWords([...words,...added],'two').length,2);
});
test('all-archived state persists without creating empty folders or losing words',()=>{
 const stored={folders:[{id:'one',name:'旅行 🧳',archived:true}],words:[{id:'a',text:'apple',folderId:'one'}],activeFolderId:null};
 const result=migrateFolders(stored);assert.equal(result.activeFolderId,null);assert.equal(result.folders.length,1);assert.equal(result.words.length,1);assert.equal(result.folders[0].name,'旅行 🧳');
 assert.equal(migrateFolders({...stored,activeFolderId:'one'}).activeFolderId,'one');
});
test('orphaned words are preserved in a default folder and folder ids remain unique',()=>{
 const result=migrateFolders({folders:[{id:'one',name:'学习',archived:false},{id:'one',name:'重复',archived:false}],words:[{id:'a',text:'apple',folderId:'missing'}]});
 assert.equal(result.folders.length,2);assert.equal(result.words[0].folderId,'default');assert.ok(result.folders.some(f=>f.id==='default'));
});
