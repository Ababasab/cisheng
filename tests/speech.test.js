import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechPlayer,matchingVoices} from '../dist/speech.js';
class Utterance{constructor(text){this.text=text;}}
const local={name:'Zira',lang:'en-US',voiceURI:'zira',localService:true};
const online={name:'Ava Online',lang:'en-US',voiceURI:'ava',localService:false};
function setup(voices=[online,local],options={}){const calls=[],states=[],listeners=new Set();const engine={getVoices:()=>voices,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),cancel(){},speak(u){calls.push(u);},resume(){this.paused=false;this.resumed=true;}};const player=new SpeechPlayer(engine,Utterance,(s,d)=>states.push([s,d]),options);return{calls,states,engine,player,listeners};}
test('auto selects local voice before an online voice, preserving accent and rate',()=>{const x=setup();x.player.play('passport',{lang:'en-US',rate:.7});assert.equal(x.calls[0].voice,local);assert.equal(x.calls[0].rate,.7);assert.equal(x.calls[0].volume,1);x.calls[0].onend();assert.equal(x.player.current,null);});
test('failed selected online voice retries local; old canceled events cannot cancel retry',()=>{const x=setup();x.player.play('sentence',{preferred:'ava'});const old=x.calls[0];old.onerror({error:'network'});assert.equal(x.calls[1].voice,local);old.onerror({error:'interrupted'});assert.equal(x.player.current,x.calls[1]);x.calls[1].onend();assert.equal(x.states.at(-1)[0],'done');});
test('cancellation prevents late events from restarting or replacing another utterance',()=>{const x=setup();x.player.play('first');const old=x.calls[0];x.player.play('second');old.onerror({error:'network'});assert.equal(x.calls.length,2);assert.equal(x.player.current.text,'second');x.player.cancel();assert.equal(x.player.current,null);});
test('empty voice lists wait for the requested accent instead of sending an unbound default voice',()=>{const x=setup([]);x.player.play('hello');assert.equal(x.calls.length,0);assert.equal(x.states.at(-1)[1].waitingVoices,true);x.engine.getVoices=()=>[local];for(const changed of [...x.listeners])changed();assert.equal(x.calls[0].voice,local);assert.equal(x.calls[0].lang,'en-US');assert.equal(x.listeners.size,0);x.calls[0].onend();});
test('legacy system recommendation is bound to an explicit voice of the selected accent and paused engine resumes',()=>{const uk={name:'UK',lang:'en-GB',voiceURI:'uk',localService:true};const x=setup([{...local,default:true},uk]);x.engine.paused=true;x.player.play('hello',{lang:'en-GB',preferred:'__system__'});assert.equal(x.calls[0].voice,uk);assert.equal(x.engine.resumed,true);x.player.cancel();});
test('a silent engine reports an error without retrying a default voice of unknown accent',async()=>{const x=setup([online],{startTimeout:10});x.player.play('hello');await new Promise(r=>setTimeout(r,60));assert.equal(x.calls.length,1);assert.equal(x.states.at(-1)[0],'error');assert.equal(x.states.at(-1)[1].code,'timeout');x.player.cancel();});
test('permission and output hardware errors are reported without cycling or rejecting healthy voices',()=>{for(const code of ['not-allowed','audio-hardware']){const x=setup();x.player.play('hello');x.calls[0].onerror({error:code});assert.equal(x.calls.length,1);assert.equal(x.states.at(-1)[1].code,code);assert.equal(x.player.failed.size,0);}});
test('language filtering never selects a voice from another accent',()=>assert.deepEqual(matchingVoices([online,{name:'UK',lang:'en-GB',localService:true}], 'en-US'),[online]));
test('locale extensions and underscore tags match their actual region, other English regions do not',()=>{
 const uk={name:'UK',lang:'en_GB',voiceURI:'uk'},extended={name:'UK regional',lang:'en-GB-x-rp',voiceURI:'uk-rp'};
 assert.deepEqual(matchingVoices([uk,extended,local,{name:'AU',lang:'en-AU'},{name:'generic',lang:'en'}],'en-GB'),[uk,extended]);
});
test('missing British voice never speaks with the American global default',async()=>{
 const x=setup([{...local,default:true}],{voicesTimeout:10});x.player.play('water',{lang:'en-GB'});await new Promise(r=>setTimeout(r,40));
 assert.equal(x.calls.length,0);assert.equal(x.states.at(-1)[1].code,'accent-unavailable');assert.match(x.states.at(-1)[1].message,/英式（en-GB）/);assert.equal(x.listeners.size,0);x.player.cancel();
});
test('British voice failure retries only British alternatives, then reports failure',()=>{
 const uk={name:'UK online',lang:'en-GB',voiceURI:'uk-online'},ukLocal={name:'UK local',lang:'en-GB',voiceURI:'uk-local',localService:true};
 const x=setup([local,uk,ukLocal]);x.player.play('water',{lang:'en-GB',preferred:'uk-online'});x.calls[0].onerror({error:'network'});assert.equal(x.calls[1].voice,ukLocal);
 x.calls[1].onerror({error:'synthesis-failed'});assert.equal(x.calls.length,2);assert.equal(x.states.at(-1)[0],'error');x.player.cancel();
});
test('switching accents cancels a pending voice-list wait and rejects late old events',async()=>{
 const uk={name:'UK',lang:'en-GB',voiceURI:'uk'};const x=setup([],{voicesTimeout:20});x.player.play('old',{lang:'en-US'});const oldListener=[...x.listeners][0];
 x.engine.getVoices=()=>[uk];x.player.play('new',{lang:'en-GB'});oldListener();await new Promise(r=>setTimeout(r,40));assert.equal(x.calls.length,1);assert.equal(x.calls[0].text,'new');assert.equal(x.calls[0].voice,uk);assert.equal(x.listeners.size,0);x.player.cancel();
});
test('failed voice identifiers are scoped to their accent when a browser reuses a URI',()=>{
 const us={...local,voiceURI:'shared'},uk={name:'UK',lang:'en-GB',voiceURI:'shared'};const x=setup([us,uk]);x.player.play('US');x.calls[0].onerror({error:'network'});
 x.player.play('UK',{lang:'en-GB'});assert.equal(x.calls[1].voice,uk);x.player.cancel();
});
test('built-in fallback speaks the requested accent when no native voice exists, and stop cancels late events',()=>{
 const x=setup([]),calls=[];x.player.fallback={unlock(){},cancel(){},play(text,options){calls.push({text,options});}};
 x.player.play('water',{lang:'en-GB',rate:.25});assert.equal(x.calls.length,0);assert.equal(calls[0].options.lang,'en-GB');assert.equal(calls[0].options.rate,.25);
 const stateCount=x.states.length;x.player.cancel();calls[0].options.onState('done',{voice:{name:'builtin'}});assert.equal(x.states.length,stateCount);
});
test('native voice failures use browser synthesis, and selecting built-in bypasses native voices',()=>{
 const x=setup([local]),calls=[];x.player.fallback={unlock(){},cancel(){},play(text,options){calls.push({text,options});}};
 x.player.play('passport');x.calls[0].onerror({error:'network'});assert.equal(calls.length,1);assert.equal(calls[0].options.lang,'en-US');
 x.player.play('car',{lang:'en-GB',preferred:'__builtin__'});assert.equal(x.calls.length,1);assert.equal(calls.at(-1).options.lang,'en-GB');x.player.cancel();
});
test('built-in voice works even without the native speech API',()=>{
 const calls=[];const x=new SpeechPlayer(null,null,()=>{},{fallback:{unlock(){},cancel(){},play(text,options){calls.push({text,options});}}});x.play('hello',{lang:'en-US'});assert.equal(calls[0].text,'hello');x.cancel();
});
