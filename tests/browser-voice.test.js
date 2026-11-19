import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserVoice,browserVoice} from '../dist/browser-voice.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const messages=[],sources=[],states=[];let worker;
 class Worker{constructor(){worker=this;}postMessage(message){messages.push(message);}terminate(){this.terminated=true;}}
 class Context{constructor(){this.state='running';}resume(){this.state='running';return Promise.resolve();}createBuffer(channels,length,rate){return {length,sampleRate:rate,copyToChannel(data){this.samples=data.slice();}};}createBufferSource(){const source={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};sources.push(source);return source;}}
 const voice=new BrowserVoice({WorkerClass:Worker,AudioContextClass:Context,timeout:1000});
 return {voice,messages,sources,states,worker:()=>worker,play(text,lang='en-US',rate=1){voice.play(text,{lang,rate,onState:(state,detail)=>states.push({state,detail})});},finish(){const job=messages.findLast(m=>m.text);worker.onmessage({data:{id:job.id,type:'audio',sampleRate:22050,pcm:new Float32Array([.1,.2,.3]).buffer}});}};
}
test('browser voices identify both accents and play generated PCM at the original sample rate',async()=>{
 const x=setup();x.play('water','en-GB',.25);assert.equal(x.messages.at(-1).rate,.25);assert.equal(x.messages.at(-1).lang,'en-GB');x.finish();await tick();
 assert.equal(x.sources[0].started,true);assert.equal(x.sources[0].buffer.sampleRate,22050);assert.equal(x.sources[0].buffer.length,3);assert.equal(x.states.at(-1).state,'speaking');x.sources[0].onended();assert.equal(x.states.at(-1).state,'done');assert.equal(browserVoice('en-GB').lang,'en-GB');x.voice.reset();
});
test('stopping model loading or playback prevents late events from starting or completing old audio',async()=>{
 const x=setup();x.play('old');x.voice.cancel();x.finish();await tick();assert.equal(x.sources.length,0);
 x.play('new');x.finish();await tick();x.voice.cancel();assert.equal(x.sources[0].stopped,true);assert.notEqual(x.states.at(-1).state,'done');x.voice.reset();
});
test('repeat utterances use page audio cache and loading errors are recoverable',async()=>{
 const x=setup();x.play('cached');x.finish();await tick();x.sources[0].onended();const count=x.messages.filter(m=>m.text).length;
 x.play('cached');await tick();assert.equal(x.messages.filter(m=>m.text).length,count);assert.equal(x.sources[1].started,true);
 x.play('missing');const id=x.messages.at(-1).id;x.worker().onmessage({data:{id,type:'error',message:'test network failure'}});await tick();assert.equal(x.states.at(-1).state,'error');
 x.play('retry');x.finish();await tick();assert.equal(x.states.at(-1).state,'speaking');x.voice.reset();
});
