import {createCloud,authMessage} from './cloud.js';
import {SyncEngine} from './sync-engine.js';

export function setupAccount({store,getState,applyState,notice}){
 const $=id=>document.getElementById(id),dialog=$('account-dialog');
 let cloud=null,engine=null,user=null,mode='login',busy=false,poll=null,lastStatus='local';
 const setBusy=value=>{busy=value;for(const id of ['account-submit','account-signout','account-mode','account-forgot','account-email','account-password'])$(id).disabled=value;};
 const showMessage=(text,error=false)=>{const e=$('account-message');e.textContent=text;e.classList.toggle('form-error',error);};
 const status=(value,message)=>{
  lastStatus=value;
  const text={local:'单词保存在此设备',pending:'更改已保存在此设备，等待同步',syncing:'正在同步…',synced:'已同步',error:message||'暂时无法同步，更改已保存在此设备。'}[value];
  $('sync-status').textContent=text;$('account-open').textContent=user?(value==='error'?'同步重试':value==='pending'?'待同步':'我的账号'):'登录同步';
  $('sync-now').disabled=busy||value==='syncing';
 };
 function setMode(value){
  mode=value;showMessage('');$('account-auth').hidden=!!user&&value!=='update';$('account-info').hidden=!user||value==='update';
  $('account-title').textContent=value==='register'?'注册词声账号':value==='reset'?'找回密码':value==='update'?'设置新密码':user?'我的账号':'登录词声';
  $('account-password-wrap').hidden=value==='reset';$('account-password').required=value!=='reset';$('account-email-wrap').hidden=value==='update';$('account-email').required=value!=='update';
  $('account-password').autocomplete=value==='register'||value==='update'?'new-password':'current-password';
  $('account-registration-note').hidden=value!=='register'||!cloud?.registrationLimited;
  $('account-submit').textContent=value==='register'?'注册':value==='reset'?'发送找回邮件':value==='update'?'保存新密码':'登录';
  $('account-mode').textContent=value==='register'?'已有账号，去登录':value==='reset'?'返回登录':'还没有账号？注册';$('account-mode').hidden=value==='update';$('account-forgot').hidden=value!=='login';
 }
 function switchUser(next){
  if(user?.id===next?.id)return;
  engine?.detach();clearInterval(poll);
  for(const d of document.querySelectorAll('dialog[open]'))if(d!==dialog){d.returnValue='cancel';d.close();}
  user=next;
  try{
   const state=user?store.enter(user.id):store.leave();applyState(state,true);store.save(getState());
  }catch{showMessage('无法保存账号词库，请检查浏览器存储空间。',true);return;}
  $('account-email-display').textContent=user?.email||'';setMode('login');
  if(user){engine.attach();poll=setInterval(()=>{if(document.visibilityState!=='hidden'&&navigator.onLine)engine.sync();},20000);}
  else status('local');
 }
 function changed(){if(user)engine?.changed();}
 function retry(){if(user&&navigator.onLine)engine?.sync();}
 $('account-open').onclick=()=>{showMessage(cloud?'':'账号同步正在开通，暂时可继续使用本机词库。');setMode(mode==='update'?'update':'login');if(!cloud)showMessage('账号同步正在开通，暂时可继续使用本机词库。');dialog.showModal();};
 $('account-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{$('account-password').value='';});
 $('account-mode').onclick=()=>setMode(mode==='login'?'register':'login');$('account-forgot').onclick=()=>setMode('reset');
 $('account-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  if(!cloud)return showMessage('账号同步尚未启用，请稍后再试。当前词库保存在此设备。',true);
  const email=$('account-email').value.trim(),password=$('account-password').value;
  if(['register','update'].includes(mode)&&(password.length<8||!/[a-z]/i.test(password)||!/[0-9]/.test(password)))return showMessage('密码至少 8 位，并包含字母和数字。',true);
  setBusy(true);showMessage('正在处理…');
  try{
   const redirect=new URL('./',location.href).href;
   if(mode==='login'){
    const {data,error}=await cloud.client.auth.signInWithPassword({email,password});if(error)throw error;switchUser(data.user);showMessage('登录成功，正在合并并同步词库。');
   }else if(mode==='register'){
    const {data,error}=await cloud.client.auth.signUp({email,password,options:{emailRedirectTo:redirect}});if(error)throw error;
    if(data.session){switchUser(data.user);showMessage('注册成功，正在同步词库。');}
    else showMessage('若该邮箱可注册，确认邮件会发送到邮箱。请确认后返回这里登录；未收到时可检查垃圾邮件或尝试找回密码。');
   }else if(mode==='reset'){
    const {error}=await cloud.client.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(error)throw error;
    showMessage('若该邮箱已注册，找回邮件会发送到邮箱。请用当前浏览器打开邮件中的链接。');
   }else{
    const {error}=await cloud.client.auth.updateUser({password});if(error)throw error;setMode('login');showMessage('密码已更新。');
   }
  }catch(error){showMessage(authMessage(error),true);}
  finally{setBusy(false);$('account-password').value='';}
 };
 $('sync-now').onclick=()=>engine?.sync();
 $('account-signout').onclick=async()=>{
  if(busy||!cloud)return;setBusy(true);
  try{const {error}=await cloud.client.auth.signOut({scope:'local'});if(error)throw error;switchUser(null);showMessage('已退出账号。账号中的未同步更改仍保留在此设备，重新登录后继续同步。');}
  catch(error){showMessage(authMessage(error),true);}finally{setBusy(false);}
 };
 window.addEventListener('online',retry);window.addEventListener('focus',retry);document.addEventListener('visibilitychange',()=>{if(!document.hidden)retry();});
 window.addEventListener('storage',event=>{if(event.key==='word-notes-owner-v1'&&event.newValue!==store.owner)location.reload();});
 const ready=(async()=>{
  try{
   cloud=await createCloud();if(!cloud){status('local');return;}
   engine=new SyncEngine({store,remote:cloud.remote,apply:applyState,onStatus:status});
   cloud.client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(event==='PASSWORD_RECOVERY'){switchUser(session?.user||null);setMode('update');if(!dialog.open)dialog.showModal();}else switchUser(session?.user||null);},0);});
   const {data,error}=await cloud.client.auth.getSession();if(error)throw error;switchUser(data.session?.user||null);
  }catch(error){status('error','账号服务暂时无法连接，本机词库仍可使用。');showMessage(authMessage(error),true);}
 })();
 return {changed,ready,get status(){return lastStatus;}};
}
