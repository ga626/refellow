import {mountAuthForm} from './account-ui.js';
import {emptyState,normalizeWorkspace} from './store.js';
import {setMediaBackend} from './collector/media-store.js';
import {uploadCloudMedia,readCloudMedia} from './collector/cloud-media.js';
let user=null,revision=0,chain=Promise.resolve(),generation=0,pending=0,mediaPending=0,failed=false,lastSnapshot=null,callbacks={};
let savedMessage='已保存到网站';
export const cloudAccount=()=>user;
export const cloudGeneration=()=>generation;
function assertGeneration(expected){if(expected!==generation)throw Error('账户已改变，请重新操作。');}
export async function cloudAPI(path,{method='GET',body,headers={}}={}){
 const expected=generation;
 if(user&&!['/login','/register','/password/reset','/email/code','/status'].includes(path))headers={...headers,'X-Refellow-Account':user.username};
 let response;try{response=await fetch('/api'+path,{method,credentials:'same-origin',headers,body,signal:AbortSignal.timeout(30000)});}catch(e){throw Error(e.name==='TimeoutError'?'连接超时，请重试；输入内容仍然保留。':'无法连接账户服务，请检查网络后重试。');}
 assertGeneration(expected);
 if(!response.ok){if(user&&response.status===401&&(!['/login','/password/reset','/account'].includes(path)||(path==='/account'&&method==='GET'))){generation++;user=null;callbacks.onAuth?.(null);callbacks.onError?.('登录已过期。未保存内容仍在页面中，请先导出备份，再重新登录。');callbacks.onStatus?.('登录已过期 · 请重新登录');notifyCollector();}let message;try{message=(await response.json()).error;}catch{}throw Object.assign(Error(message||'网站暂时无法保存（HTTP '+response.status+'）。'),{status:response.status});}return response;
}
async function cloudUpload(blob,id){
 const expected=generation;mediaPending++;try{const api=async(path,options)=>{if(generation!==expected)throw Error('账户已改变，请重新添加媒体。');const response=await cloudAPI(path,options);if(generation!==expected)throw Error('账户已改变，请重新添加媒体。');return response;};const result=await uploadCloudMedia(api,blob,{id,storageOnly:true});return result.id;}finally{mediaPending--;}
}
function installBackend(){setMediaBackend({identity:()=>generation,async get(id){const expected=generation;try{const api=async(path,options)=>{assertGeneration(expected);const response=await cloudAPI(path,options);assertGeneration(expected);return response;};const blob=await readCloudMedia(api,id);assertGeneration(expected);return blob;}catch(e){assertGeneration(expected);if(e.status===404)return undefined;throw e;}},put:cloudUpload,async remove(id){await cloudAPI('/media/'+encodeURIComponent(id),{method:'DELETE'});}});}
export function saveCloudState(state){
 if(!user)throw Error('请先登录后保存。');if(failed)throw Error('仍有未保存修改，请点击“重试保存”或先导出备份。');const expectedGeneration=generation,snapshot=JSON.stringify(normalizeWorkspace(state));lastSnapshot=snapshot;pending++;callbacks.onStatus?.('正在保存到网站…');
 const task=chain.then(async()=>{if(expectedGeneration!==generation||failed)throw Error('账户已改变或有尚未保存的修改，请先处理。');const result=await(await cloudAPI('/workspace',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(revision)},body:snapshot})).json();assertGeneration(expectedGeneration);revision=result.revision;});
 chain=task.catch(e=>{if(expectedGeneration===generation){failed=true;callbacks.onError?.(e.message+' 修改仍保留在本页面，可先导出备份。');callbacks.onStatus?.('尚未保存 · 可重试或导出备份');document.querySelector('#cloud-retry').hidden=false;}}).finally(()=>{pending--;if(expectedGeneration===generation&&!pending&&!failed)callbacks.onStatus?.(savedMessage);});return task;
}
async function retrySave(){if(!failed||!lastSnapshot||pending)return;const state=JSON.parse(lastSnapshot);failed=false;try{await saveCloudState(state);await chain;document.querySelector('#cloud-retry').hidden=failed;if(!failed)callbacks.onAuth?.(user);}catch{} }
async function loadState(){const expected=generation;const result=await(await cloudAPI('/workspace')).json();assertGeneration(expected);revision=result.revision;savedMessage=result.development?'已保存到本机测试空间 · 尚未上线':'已保存到网站';callbacks.onState?.(normalizeWorkspace(result.state));}
export async function initializeCloudSpace(options){
 callbacks=options;installBackend();document.addEventListener('refellow:collector-status',event=>{try{collectorStatus=JSON.parse(event.detail);updateCollectorStatus();}catch{}});
 try{user=await(await cloudAPI('/account')).json();await loadState();callbacks.onAuth?.(user);callbacks.onStatus?.(savedMessage);notifyCollector();}
 catch(e){user=null;callbacks.onState?.(emptyState());callbacks.onAuth?.(null);callbacks.onStatus?.(e.status===401?'登录后保存到个人空间':e.message);}
 setInterval(async()=>{if(!user||pending||failed||document.hidden||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;const expected=generation;try{const data=await(await cloudAPI('/workspace')).json();if(expected!==generation||pending||mediaPending||failed)return;if(data.revision!==revision){revision=data.revision;callbacks.onState?.(normalizeWorkspace(data.state));}}catch(e){if(expected===generation)callbacks.onStatus?.(e.message);}},5000);
 const accountButton=document.querySelector('#cloud-account');accountButton?.addEventListener('click',showAccount);document.querySelector('#mobile-account')?.addEventListener('click',showAccount);document.querySelector('#cloud-retry')?.addEventListener('click',retrySave);if(location.hash==='#account')showAccount();addEventListener('hashchange',()=>{if(location.hash==='#account')showAccount();});
}
function clearAccount(message){
 generation++;callbacks.onAccountChange?.();user=null;revision=0;chain=Promise.resolve();failed=false;lastSnapshot=null;callbacks.onState?.(emptyState());callbacks.onAuth?.(null);callbacks.onStatus?.(message);notifyCollector();
}

let collectorStatus=null;
const notifyCollector=()=>document.dispatchEvent(new Event('refellow:account-changed'));
function updateCollectorStatus(){const target=document.querySelector('[data-collector-status]');if(target)target.textContent=collectorStatus?.connected?'采集器已连接，截图和录像会进入这个账户。':collectorStatus?.unavailable?'采集器暂未同步，请刷新网站；已保存的收藏不受影响。':'已安装新版采集器时会自动识别登录。开发版首次需允许访问本机。';}
export function showAccount(options={}){
 const dialog=document.querySelector('#form-dialog'),content=document.querySelector('#form-content');if(dialog.open&&dialog.classList.contains('account-dialog')&&!options.replace)return;
 dialog.classList.remove('wide-dialog');dialog.classList.add('account-dialog');content.replaceChildren();
 dialog.addEventListener('close',()=>dialog.classList.remove('account-dialog'),{once:true});
 const header=document.createElement('div');header.className='account-brand';header.innerHTML='<span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span><span>参伴 <small>Refellow</small></span>';
 const close=document.createElement('button');close.type='button';close.className='icon-button';close.setAttribute('aria-label','关闭账户窗口');close.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';close.onclick=()=>dialog.close();header.append(close);content.append(header);
 const heading=document.createElement('h2');heading.id='form-title';heading.textContent=user?'你的个人空间':'欢迎回到参伴';content.append(heading);
 const description=document.createElement('p');description.className='account-description';content.append(description);
 const environment=document.createElement('p');environment.className='account-environment';content.append(environment);
 if(user&&!options.reset){
  description.textContent='管理你的资料与登录安全。采集后，到“我的收藏”查看。';environment.textContent=user.development?'本机测试空间 · 与线上账户及收藏分开。':'';environment.hidden=!user.development;
  const identity=document.createElement('div');identity.className='account-identity';const avatar=document.createElement('span');avatar.className='account-avatar large';avatar.setAttribute('aria-hidden','true');avatar.textContent=Array.from(user.displayName||'参')[0];const name=document.createElement('strong');name.textContent=user.displayName||'参伴用户';identity.append(avatar,name);content.append(identity);
  const status=document.createElement('p');status.className='account-status';status.setAttribute('role','status');
  const profile=document.createElement('form');profile.className='account-profile';profile.innerHTML='<label for="profile-name">昵称</label><div class="auth-code-row"><input id="profile-name" name="displayName" autocomplete="nickname" required maxlength="24"><button class="button secondary" type="submit">保存昵称</button></div>';profile.elements.displayName.value=user.displayName||'';content.append(profile);
  profile.onsubmit=async e=>{e.preventDefault();e.stopImmediatePropagation();const button=profile.querySelector('button');button.disabled=true;try{user=await(await cloudAPI('/account',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:profile.elements.displayName.value})})).json();callbacks.onAuth?.(user);name.textContent=user.displayName;avatar.textContent=Array.from(user.displayName)[0];status.textContent='昵称已保存。';notifyCollector();}catch(err){status.textContent=err.message;}finally{button.disabled=false;}};
  const email=document.createElement('section');email.className='account-email';const emailLabel=document.createElement('h3');emailLabel.textContent='账户安全';email.append(emailLabel);
  const address=document.createElement('p');address.textContent=user.emailVerified?'已验证邮箱：'+user.email:'旧账户尚未绑定邮箱。验证后可通过邮件重置密码，原有收藏保持不变。';email.append(address);
  if(!user.emailVerified){
   const bind=document.createElement('form');bind.className='auth-form';bind.innerHTML='<label for="bind-email">邮箱地址</label><input id="bind-email" name="email" type="email" autocomplete="email" required maxlength="254"><label for="bind-code">邮箱验证码</label><div class="auth-code-row"><input id="bind-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required><button class="button secondary" type="button">发送验证码</button></div><button class="button secondary" type="submit">验证并绑定邮箱</button>';email.append(bind);let resendAt=0;
   bind.querySelector('[type=button]').onclick=async e=>{if(Date.now()<resendAt){status.textContent='请稍后再发送验证码。';return;}if(!bind.elements.email.checkValidity()){bind.elements.email.reportValidity();return;}e.target.disabled=true;try{await cloudAPI('/email/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:bind.elements.email.value,purpose:'bind'})});resendAt=Date.now()+60000;status.textContent='验证码已发送，10分钟有效。';}catch(err){status.textContent=err.message;}finally{e.target.disabled=false;}};
   bind.onsubmit=async e=>{e.preventDefault();e.stopImmediatePropagation();const button=bind.querySelector('[type=submit]');button.disabled=true;try{user=await(await cloudAPI('/email/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(bind)))})).json();callbacks.onAuth?.(user);showAccount({replace:true});}catch(err){status.textContent=err.message;}finally{button.disabled=false;}};
  }else{const reset=document.createElement('button');reset.type='button';reset.className='auth-link';reset.textContent='通过邮箱重置密码';reset.onclick=()=>{if(pending||mediaPending||failed){status.textContent='请先保存或导出未保存的修改。';return;}showAccount({replace:true,reset:true});};email.append(reset);}
  content.append(email);
  const collector=document.createElement('section');collector.className='account-connection';collector.innerHTML='<h3>页面采集器</h3><p data-collector-status role="status"></p><a href="#collector" class="auth-link">安装与使用说明</a>';content.append(collector);collector.querySelector('a').onclick=()=>dialog.close();updateCollectorStatus();notifyCollector();
  content.append(status);
  const actions=document.createElement('div');actions.className='account-actions';actions.innerHTML='<button type="button" class="button secondary" data-logout>退出登录</button>';content.append(actions);
  actions.querySelector('[data-logout]').onclick=async e=>{if(pending||mediaPending||failed){status.textContent='还有未保存修改，请先完成保存或导出备份。';return;}e.target.disabled=true;try{await cloudAPI('/logout',{method:'POST'});clearAccount('登录后保存到个人空间');dialog.close();}catch(err){status.textContent=err.message;e.target.disabled=false;}};
  const deletion=document.createElement('details');deletion.className='account-danger';deletion.innerHTML='<summary>删除账户</summary><p>永久删除账户、项目和全部媒体，无法撤销。请先导出备份。</p><label>输入密码确认<input type="password" autocomplete="current-password" maxlength="128"></label><button class="button secondary" type="button">永久删除我的账户</button>';content.append(deletion);
  deletion.querySelector('button').onclick=async e=>{if(pending||mediaPending||failed){status.textContent='请先处理未保存修改。';return;}e.target.disabled=true;try{await cloudAPI('/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:deletion.querySelector('input').value})});clearAccount('账户已删除');dialog.close();}catch(err){status.textContent=err.message;e.target.disabled=false;}};
 }
 if(!user||options.reset){
  if(options.reset)content.replaceChildren(header,heading,description,environment);
  const form=mountAuthForm(content,{api:cloudAPI,heading,description,environment,close,async onAuthenticated(result){
   generation++;callbacks.onAccountChange?.();revision=0;lastSnapshot=null;failed=false;chain=Promise.resolve();user=result;
   notifyCollector();try{await loadState();callbacks.onAuth?.(user);callbacks.onStatus?.(savedMessage);return '';}
   catch{callbacks.onAuth?.(user);callbacks.onError?.('收藏尚未加载，请刷新重试；暂不能保存修改。');callbacks.onStatus?.('已登录，空间尚未加载；请刷新重试。');return '已登录，但收藏暂未加载。请刷新重试。';}
  },onComplete(result,warning){if(!warning){dialog.close();return;}content.replaceChildren(header,heading);heading.textContent='登录成功';const info=document.createElement('p');info.className='account-description';info.textContent=warning;const retry=document.createElement('button');retry.className='button primary';retry.textContent='刷新重试';retry.onclick=()=>location.reload();content.append(info,retry);}});
  if(options.reset)form.setMode('reset');
 }
 if(!dialog.open)dialog.showModal();
}
