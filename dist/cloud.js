import {CLOUD_CONFIG} from './cloud-config.js';
import {emptySnapshot} from './sync-model.js';

export function validateCloudConfig(config=CLOUD_CONFIG){
 if(!config.url&&!config.publishableKey)return false;
 let url;try{url=new URL(config.url);}catch{throw Error('同步服务地址配置有误。');}
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/')throw Error('同步服务必须使用 HTTPS 项目地址。');
 const key=config.publishableKey;
 if(typeof key!=='string'||!key)throw Error('同步服务尚未配置公开访问凭据。');
 if(key.startsWith('sb_secret_'))throw Error('禁止在网页配置服务端密钥。');
 if(!key.startsWith('sb_publishable_')){
  try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw Error();}
  catch{throw Error('网页只能使用 publishable 或 anon 公开凭据。');}
 }
 return true;
}

function loadSDK(){
 if(globalThis.supabase?.createClient)return Promise.resolve();
 return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('./vendor/supabase/supabase.js',import.meta.url);script.onload=resolve;script.onerror=()=>reject(Error('账号组件加载失败，请刷新后重试。'));document.head.append(script);});
}

export async function createCloud(config=CLOUD_CONFIG){
 if(!validateCloudConfig(config))return null;
 await loadSDK();
 const client=globalThis.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
 async function request(owner,path,options={}){
  const {data,error}=await client.auth.getSession(),session=data?.session;
  if(error||!session||session.user.id!==owner)throw Error('请重新登录后同步。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
  try{
   const response=await fetch(new URL(path,config.url),{...options,signal:controller.signal,headers:{apikey:config.publishableKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'}});
   if(!response.ok){if(response.status===401)throw Error('登录已过期，请重新登录。');throw Error(response.status===404?'云端词库尚未初始化，请联系网站管理员。':'暂时无法同步，更改已保存在此设备。');}
   return await response.json();
  }finally{clearTimeout(timer);}
 }
 return {client,registrationLimited:config.registrationLimited!==false,remote:{
  async read(owner,knownRevision){
   const params=new URLSearchParams({select:knownRevision===undefined?'revision,payload':'revision',user_id:`eq.${owner}`});
   const data=await request(owner,`/rest/v1/word_notes_snapshots?${params}`);
   if(knownRevision!==undefined&&data[0]?.revision===knownRevision)return {revision:knownRevision,unchanged:true};
   if(data[0]&&knownRevision!==undefined){params.set('select','revision,payload');return (await request(owner,`/rest/v1/word_notes_snapshots?${params}`))[0]||{revision:0,payload:emptySnapshot()};}
   return data[0]||{revision:0,payload:emptySnapshot()};
  },
  async commit(revision,payload,owner){return request(owner,'/rest/v1/rpc/word_notes_commit',{method:'POST',body:JSON.stringify({p_expected_revision:revision,p_payload:payload})});}
 }};
}

export function authMessage(error){
 const code=error?.code||'',message=String(error?.message||'');
 if(code==='invalid_credentials'||/invalid login credentials/i.test(message))return '邮箱或密码不正确，请重试。';
 if(code==='email_not_confirmed')return '请先打开邮箱中的确认链接，再登录。';
 if(['flow_state_not_found','flow_state_expired','bad_code_verifier'].includes(code))return '请用发起操作的同一浏览器打开邮件链接，或重新发送邮件。';
 if(code==='otp_expired')return '邮件链接已失效，请重新发送确认或找回邮件。';
 if(code==='email_address_invalid')return '请填写有效的邮箱地址。';
 if(['signup_disabled','email_provider_disabled'].includes(code))return '邮箱注册暂未开放，请联系网站管理员。';
 if(code==='user_already_exists')return '这个邮箱已注册，请直接登录或找回密码。';
 if(code==='weak_password'||/password.*least/i.test(message))return '请使用至少 8 位、包含字母和数字的密码。';
 if(/rate|too many/i.test(code+' '+message))return '操作较频繁，请稍后再试。';
 if(code==='email_address_not_authorized'||/email.*(authorized|sending)|smtp|email address not authorized/i.test(message)||code==='unexpected_failure')return '验证邮件暂时无法发送，请稍后重试或联系网站管理员。';
 return '账号服务暂时无法连接，请检查网络后重试。';
}
