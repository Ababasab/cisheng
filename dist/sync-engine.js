import {snapshotOf,mergeSnapshots,sameSnapshot} from './sync-model.js';

export class SyncEngine{
 constructor({store,remote,apply,onStatus=()=>{},delay=900,timeout=15000}){Object.assign(this,{store,remote,apply,onStatus,delay,timeout});this.generation=0;this.running=false;this.again=false;}
 attach(){this.generation++;this.onStatus('pending');return this.sync();}
 detach(){this.generation++;clearTimeout(this.timer);this.again=false;}
 changed(){if(!this.store.owner)return;const cached=this.store.account();if(cached.base&&sameSnapshot(cached.current,cached.base))return;this.onStatus('pending');clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),this.delay);}
 async call(job){let timer;try{return await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('同步连接超时，更改已保存在此设备。')),this.timeout);})]);}finally{clearTimeout(timer);}}
 async sync(){
  if(!this.store.owner)return;
  if(this.running){this.again=true;return;}
  const generation=this.generation,owner=this.store.owner,valid=()=>this.generation===generation&&this.store.owner===owner;
  this.running=true;this.again=false;this.onStatus('syncing');
  try{
   for(let attempt=0;attempt<5;attempt++){
    const before=this.store.account();
    const server=await this.call(this.remote.read(owner,before.base===null?undefined:before.revision));if(!valid())return;
    if(server.unchanged)server.payload=before.base;
    const cached=this.store.account(),sent=snapshotOf(cached.current),merged=mergeSnapshots(cached.base,sent,server.payload);
    let result=server;
    if(!sameSnapshot(merged,server.payload)){
     result=await this.call(this.remote.commit(server.revision,merged,owner));if(!valid())return;
     if(!result.saved)continue;
    }
    const current=this.store.account().current,latest=mergeSnapshots(sent,snapshotOf(current),result.payload);
    this.store.synchronized(result.payload,result.revision,{...current,...latest});
    // Only rebuild the list if cloud content changed. Playback must survive background polling.
    if(!sameSnapshot(snapshotOf(current),latest))this.apply({...current,...latest});
    const dirty=!sameSnapshot(latest,result.payload);this.again=this.again||dirty;
    this.onStatus(dirty?'pending':'synced');return;
   }
   throw Error('两端正在同时修改，请稍后重试同步。');
  }catch(error){if(valid())this.onStatus('error',error.message||'同步失败，更改已保存在此设备。');}
  finally{this.running=false;if(this.again&&this.store.owner){this.again=false;clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),this.delay);}}
 }
}
