import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadingQueue,readingList,numberedWords} from '../dist/reading.js';
import {migrateFolders,addToFolder} from '../dist/folders.js';
import {SpeechPlayer} from '../dist/speech.js';
const words=[{id:'z',text:'zoo',number:1},{id:'a',text:'apple',number:2},{id:'b',text:'banana',number:3}];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await wait(5);}assert.ok(check(),'Expected playback event did not arrive');}
test('legacy numbers migrate by folder and import order, surviving sorting, editing and deletion gaps',()=>{
 const old={folders:[{id:'one',name:'单词'},{id:'two',name:'第二本'}],words:[{id:'z',text:'zoo',folderId:'one'},{id:'a',text:'apple',folderId:'one'},{id:'b',text:'banana',folderId:'two'}]};
 const data=migrateFolders(old);assert.deepEqual(data.words.map(w=>w.number),[1,2,1]);assert.equal(old.words[0].number,undefined);
 const folder=data.folders[0];assert.equal(folder.nextNumber,3);data.words=data.words.filter(w=>w.id!=='a');
 const added=addToFolder(data.words,['zoo','passport'],'one',()=> 'p',folder.nextNumber);assert.deepEqual(added.map(w=>w.number),[3]);
 folder.nextNumber=4;data.words.push(...added);data.words[0].text='zebra';
 const again=migrateFolders(data);assert.deepEqual(again.words.map(w=>w.number),[1,1,3]);assert.equal(again.folders[0].nextNumber,4);
});
test('duplicate and invalid saved numbers are repaired while valid numbers are retained',()=>{
 const data=migrateFolders({words:[{id:'a',text:'apple',number:7},{id:'b',text:'banana',number:7},{id:'c',text:'cat',number:-1}]});
 assert.deepEqual(data.words.map(w=>w.number),[7,8,9]);assert.equal(data.folders[0].nextNumber,10);
});
test('display numbering restarts at one for each sort and reading uses the same view numbers',()=>{
 assert.deepEqual(numberedWords(words).map(w=>[w.text,w.number]),[['apple',1],['banana',2],['zoo',3]]);
 assert.deepEqual(readingList(words).map(w=>w.number),[1,2,3]);
 assert.deepEqual(readingList(words,{mode:'reverse'}).map(w=>[w.text,w.number]),[['zoo',3],['banana',2],['apple',1]]);
 assert.deepEqual(readingList(words,{sort:'original'}).map(w=>w.number),[1,2,3]);
 assert.deepEqual(readingList(words,{sort:'original'}).map(w=>w.text),['zoo','apple','banana']);
 assert.deepEqual(readingList(words,{query:'a'}).map(w=>w.number),[1,2]);
 assert.deepEqual(words.map(w=>w.number),[1,2,3]);
});
test('range uses current sorted positions, not stored import numbers, and search preserves full-list numbers',()=>{
 assert.deepEqual(readingList(words,{mode:'range',range:'1-2'}).map(w=>w.text),['apple','banana']);
 assert.deepEqual(readingList(words,{mode:'range',range:'1-2',sort:'original'}).map(w=>w.text),['zoo','apple']);
 assert.deepEqual(readingList(words,{query:'z'}).map(w=>[w.text,w.number]),[['zoo',3]]);
 const deleted=words.filter(w=>w.id!=='a');assert.deepEqual(numberedWords(deleted).map(w=>[w.text,w.number]),[['banana',1],['zoo',2]]);
 assert.deepEqual(readingList(deleted,{mode:'range',range:'1-2'}).map(w=>w.text),['banana','zoo']);
});
test('203-260 includes both endpoints, with reversed ranges supported',()=>{
 const many=Array.from({length:300},(_,i)=>({id:String(i),text:'word',number:i+1}));
 const result=readingList(many,{mode:'range',range:'203-260',query:'no-match',sort:'az'});
 assert.equal(result.length,58);assert.equal(result[0].number,203);assert.equal(result.at(-1).number,260);
 assert.deepEqual(readingList(words,{mode:'range',range:' 3－1 '}).map(w=>w.number),[3,2,1]);
 assert.equal(readingList(words,{mode:'range',range:'2-2'}).length,1);
});
test('bad ranges, missing endpoints and empty search results do not produce an unintended batch',()=>{
 for(const range of ['','203','1-4','0-2','-1-2','1.5-2','2-3-4','9007199254740999-2'])assert.throws(()=>readingList(words,{mode:'range',range}));
 assert.throws(()=>readingList([]));assert.throws(()=>readingList(words,{query:'missing'}));
});
function setup(){
 const calls=[],states=[];let queue;
 class Utterance{constructor(text){this.text=text;}}
 const engine={getVoices:()=>[],cancel(){},speak(u){calls.push(u);}};
 const speech=new SpeechPlayer(engine,Utterance,state=>queue.handleSpeechState(state));
 queue=new ReadingQueue({play:word=>speech.play(word.text),cancel:()=>speech.cancel(),onChange:state=>states.push(state),gap:10});
 return {queue,calls,states,speech};
}
test('batch waits for each utterance end and reports current word, index and completion',async t=>{
 const x=setup();t.after(()=>x.queue.stop());x.queue.start(words);assert.equal(x.calls.length,1);assert.equal(x.queue.snapshot().current.number,1);
 await wait(20);assert.equal(x.calls.length,1);x.calls[0].onend();await until(()=>x.calls.length===2);
 assert.equal(x.calls[1].text,'apple');assert.equal(x.queue.snapshot().index,1);
 x.calls[0].onend();await wait(20);assert.equal(x.calls.length,2);
 x.calls[1].onend();await until(()=>x.calls.length===3);x.calls[2].onend();assert.equal(x.queue.status,'complete');assert.equal(x.queue.active,false);
});
test('stopping between words or restarting prevents stale completion from starting old words',async t=>{
 const x=setup();t.after(()=>x.queue.stop());x.queue.start(words);const old=x.calls[0];old.onend();x.queue.stop();await wait(30);assert.equal(x.calls.length,1);
 x.queue.start(words);const active=x.calls[1];x.queue.start([...words].reverse());active.onend();await wait(30);assert.equal(x.calls.length,3);assert.equal(x.calls[2].text,'banana');
 x.queue.stop();x.calls[2].onend();await wait(20);assert.equal(x.calls.length,3);
});
test('fatal speech failure stops the batch without silently skipping a word',async t=>{
 const x=setup();t.after(()=>x.queue.stop());x.queue.start(words);x.calls[0].onerror({error:'audio-hardware'});await wait(30);assert.equal(x.queue.status,'error');assert.equal(x.calls.length,1);
});
test('resume repeats an interrupted word, skips a finished word and cannot resume after completion/reset',async t=>{
 const x=setup();t.after(()=>x.queue.stop());x.queue.start(words);const old=x.calls[0];
 x.queue.stop();assert.equal(x.queue.canResume,true);x.queue.resume();assert.equal(x.calls.at(-1).text,'zoo');
 old.onend();assert.equal(x.queue.index,0);
 x.calls.at(-1).onend();x.queue.stop();x.queue.stop();x.queue.resume();assert.equal(x.calls.at(-1).text,'apple');
 x.calls.at(-1).onend();await until(()=>x.calls.at(-1).text==='banana');x.calls.at(-1).onend();
 x.queue.stop();assert.equal(x.queue.canResume,false);const count=x.calls.length;x.queue.resume();assert.equal(x.calls.length,count);
 x.queue.start(words);x.queue.stop();x.queue.reset();assert.equal(x.queue.canResume,false);
});
