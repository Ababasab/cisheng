import {OXFORD_CONFIG} from './oxford-config.js';
import {CLOUD_CONFIG} from './cloud-config.js';
import {phraseKey} from './phrases.js';
export async function lookupOxford(text,{token,config=OXFORD_CONFIG,fetcher=globalThis.fetch,timeout=12000}={}){
 if(!config.enabled)throw Error('牛津查询尚未开通，需要网站管理员配置官方接口；当前中文来自本地词库。');
 if(!token)throw Error('请先登录，再查询牛津。');
 const controller=new AbortController();let timer;
 try{
  const result=await Promise.race([
   Promise.resolve().then(()=>fetcher(new URL('/functions/v1/oxford-lookup',CLOUD_CONFIG.url),{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:CLOUD_CONFIG.publishableKey,Authorization:`Bearer ${token}`},body:JSON.stringify({word:phraseKey(text)})})).then(async response=>{
    const data=await response.json();if(!response.ok)throw Error(({401:'请先登录，再查询牛津。',403:'此账号尚未开放牛津查询权限。',404:'牛津未返回这条完整词条的释义。',429:'牛津查询次数已达限制，请稍后再试。',503:'牛津官方接口尚未开通。'})[response.status]||'牛津查询暂时失败，请重试。');
    if(data.source!=='oxford'||!['en','zh'].includes(data.language)||!Array.isArray(data.definitions)||!data.definitions.length||data.definitions.some(v=>typeof v!=='string'||!v.trim()))throw Error('牛津返回数据不完整，请重试。');
    return data;
   }),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('牛津查询超时，请重试。'));},timeout);})
  ]);return result;
 }finally{clearTimeout(timer);}
}
