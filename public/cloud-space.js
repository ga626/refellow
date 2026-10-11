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
 if(user&&!['/login','/register','/recover'].includes(path))headers={...headers,'X-Refellow-Account':user.username};
 const response=await fetch('/api'+path,{method,credentials:'same-origin',headers,body,signal:AbortSignal.timeout(30000)});
 assertGeneration(expected);
 if(!response.ok){let message;try{message=(await response.json()).error;}catch{}throw Object.assign(Error(message||'网站暂时无法保存（HTTP '+response.status+'）。'),{status:response.status});}return response;
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
 callbacks=options;installBackend();
 try{user=await(await cloudAPI('/account')).json();await loadState();callbacks.onAuth?.(user);callbacks.onStatus?.(savedMessage);}
 catch(e){user=null;callbacks.onState?.(emptyState());callbacks.onAuth?.(null);callbacks.onStatus?.(e.status===401?'登录后保存到个人空间':e.message);}
 setInterval(async()=>{if(!user||pending||failed||document.hidden||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;const expected=generation;try{const data=await(await cloudAPI('/workspace')).json();if(expected!==generation||pending||mediaPending||failed)return;if(data.revision!==revision){revision=data.revision;callbacks.onState?.(normalizeWorkspace(data.state));}}catch(e){if(expected===generation)callbacks.onStatus?.(e.message);}},5000);
 const accountButton=document.querySelector('#cloud-account');accountButton?.addEventListener('click',showAccount);document.querySelector('#cloud-retry')?.addEventListener('click',retrySave);if(location.hash==='#account')showAccount();addEventListener('hashchange',()=>{if(location.hash==='#account')showAccount();});
}
export function showAccount(){
 const dialog=document.querySelector('#form-dialog'),content=document.querySelector('#form-content');content.replaceChildren();
 const heading=document.createElement('h2');heading.id='form-title';heading.textContent=user?'你的个人空间':'登录参伴';content.append(heading);
 if(user){
  const description=document.createElement('p');description.textContent='已登录 '+user.username+'。截图和录像仅保存在你的账户中。';content.append(description);
  const pair=document.createElement('button');pair.className='button primary';pair.textContent='连接采集器';content.append(pair);
  const status=document.createElement('p');status.setAttribute('role','status');content.append(status);pair.onclick=async()=>{pair.disabled=true;try{const result=await(await cloudAPI('/pair',{method:'POST'})).json();status.textContent='连接码：'+result.code+'（5分钟有效，只能使用一次）。在采集器“连接账户”页粘贴。';}catch(e){status.textContent=e.message;}finally{pair.disabled=false;}};
  const revoke=document.createElement('button');revoke.className='button secondary';revoke.textContent='断开所有采集器';content.append(revoke);revoke.onclick=async()=>{revoke.disabled=true;try{await cloudAPI('/devices/revoke',{method:'POST'});status.textContent='采集器已全部断开。需要时重新生成连接码。';}catch(e){status.textContent=e.message;}finally{revoke.disabled=false;}};
  const logout=document.createElement('button');logout.className='button secondary';logout.textContent='退出登录';content.append(logout);logout.onclick=async()=>{if(pending||mediaPending||failed){status.textContent='还有未保存修改，请先完成保存或导出备份。';return;}try{await cloudAPI('/logout',{method:'POST'});generation++;callbacks.onAccountChange?.();user=null;revision=0;chain=Promise.resolve();failed=false;lastSnapshot=null;callbacks.onState?.(emptyState());callbacks.onAuth?.(null);callbacks.onStatus?.('登录后保存到个人空间');dialog.close();}catch(e){status.textContent=e.message;}};
  const deletion=document.createElement('details');deletion.innerHTML='<summary>删除账户与云端收藏</summary><p>永久删除你的账户、项目和全部云端媒体。先导出需要保留的备份。</p><label>输入密码确认<input type="password" autocomplete="current-password" maxlength="128"></label><button class="button secondary" type="button">永久删除我的账户</button>';content.append(deletion);
  deletion.querySelector('button').onclick=async()=>{if(pending||mediaPending||failed){status.textContent='请先处理未保存修改。';return;}const b=deletion.querySelector('button');b.disabled=true;try{await cloudAPI('/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:deletion.querySelector('input').value})});generation++;callbacks.onAccountChange?.();user=null;revision=0;chain=Promise.resolve();lastSnapshot=null;callbacks.onState?.(emptyState());callbacks.onAuth?.(null);callbacks.onStatus?.('账户已删除');dialog.close();}catch(e){status.textContent=e.message;b.disabled=false;}};
 }else{
  const form=document.createElement('form');form.className='form-grid';form.innerHTML='<label>操作<select name="mode"><option value="login">登录</option><option value="register">创建免费账户</option><option value="recover">用恢复码找回账户</option></select></label><label>用户名<input name="username" required autocomplete="username" minlength="3" maxlength="32"></label><label>密码<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="current-password"></label><label class="recovery-field" hidden>恢复码<input name="recoveryCode" autocomplete="off"></label><p class="form-error" role="status"></p><button class="button primary" type="submit">继续</button>';content.append(form);
  form.elements.mode.onchange=()=>{form.querySelector('.recovery-field').hidden=form.elements.mode.value!=='recover';form.elements.password.autocomplete=form.elements.mode.value==='login'?'current-password':'new-password';};
  form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const button=form.querySelector('button'),error=form.querySelector('.form-error');button.disabled=true;try{const fields=new FormData(form),mode=fields.get('mode');const result=await(await cloudAPI('/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:fields.get('username'),password:fields.get('password'),recoveryCode:fields.get('recoveryCode')})})).json();form.reset();generation++;callbacks.onAccountChange?.();revision=0;lastSnapshot=null;failed=false;chain=Promise.resolve();user={username:result.username};await loadState();callbacks.onAuth?.(user);callbacks.onStatus?.(savedMessage);if(result.recoveryCode){content.replaceChildren(heading);const p=document.createElement('p');p.textContent='请妥善保存恢复码，忘记密码时可用它找回账户。它只显示这一次：';content.append(p);const code=document.createElement('code');code.textContent=result.recoveryCode;content.append(code);const done=document.createElement('button');done.className='button primary';done.textContent='已保存恢复码';done.onclick=()=>dialog.close();content.append(done);}else dialog.close();}catch(err){error.textContent=err.message;}finally{button.disabled=false;}});
 }
 const close=document.createElement('button');close.className='button secondary';close.textContent='关闭';close.onclick=()=>dialog.close();content.append(close);if(!dialog.open)dialog.showModal();
}
