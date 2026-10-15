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
 if(user&&!['/login','/register','/recover'].includes(path))headers={...headers,'X-Refellow-Account':user.username};
 let response;try{response=await fetch('/api'+path,{method,credentials:'same-origin',headers,body,signal:AbortSignal.timeout(30000)});}catch(e){throw Error(e.name==='TimeoutError'?'连接超时，请重试；输入内容仍然保留。':'无法连接账户服务，请检查网络后重试。');}
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
 const accountButton=document.querySelector('#cloud-account');accountButton?.addEventListener('click',showAccount);document.querySelector('#mobile-account')?.addEventListener('click',showAccount);document.querySelector('#cloud-retry')?.addEventListener('click',retrySave);if(location.hash==='#account')showAccount();addEventListener('hashchange',()=>{if(location.hash==='#account')showAccount();});
}
function clearAccount(message){
 generation++;callbacks.onAccountChange?.();user=null;revision=0;chain=Promise.resolve();failed=false;lastSnapshot=null;callbacks.onState?.(emptyState());callbacks.onAuth?.(null);callbacks.onStatus?.(message);
}
export function showAccount(options={}){
 const dialog=document.querySelector('#form-dialog'),content=document.querySelector('#form-content');if(dialog.open&&dialog.classList.contains('account-dialog')&&!options.replace)return;
 dialog.classList.remove('wide-dialog');dialog.classList.add('account-dialog');content.replaceChildren();
 dialog.addEventListener('close',()=>dialog.classList.remove('account-dialog'),{once:true});
 const header=document.createElement('div');header.className='account-brand';header.innerHTML='<span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span><span>参伴 <small>Refellow</small></span>';
 const close=document.createElement('button');close.type='button';close.className='icon-button';close.setAttribute('aria-label','关闭账户窗口');close.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';close.onclick=()=>dialog.close();header.append(close);content.append(header);
 const heading=document.createElement('h2');heading.id='form-title';heading.textContent=user?'你的个人空间':'欢迎回到参伴';content.append(heading);
 const description=document.createElement('p');description.className='account-description';content.append(description);
 const environment=document.createElement('p');environment.className='account-environment';content.append(environment);
 if(user){
  description.textContent='已登录 '+user.username+'。采集的截图和录像会出现在“我的收藏”。';environment.textContent=user.development?'本机测试空间 · 仅保存在这台电脑，与线上空间分开。':'';environment.hidden=!user.development;
  const connection=document.createElement('section');connection.className='account-connection';connection.innerHTML='<h3>连接页面采集器</h3><p>首次连接一次，之后截图和录像直接保存到这个账户。</p><button type="button" class="button primary">生成一次性连接码</button><div class="account-pair-result" hidden><label>连接码<input readonly aria-label="采集器连接码"></label><button type="button" class="button secondary">复制连接码</button><p>5分钟有效，仅可使用一次。在采集器“连接账户”页粘贴。</p></div><label class="account-address">当前网站地址<input readonly aria-label="采集器网站地址"></label>';content.append(connection);
  connection.querySelector('.account-address input').value=location.origin;
  const status=document.createElement('p');status.className='account-status';status.setAttribute('role','status');content.append(status);
  const pair=connection.querySelector('.primary'),result=connection.querySelector('.account-pair-result'),code=result.querySelector('input');pair.onclick=async()=>{pair.disabled=true;pair.textContent='正在生成…';try{const data=await(await cloudAPI('/pair',{method:'POST'})).json();code.value=data.code;result.hidden=false;status.textContent='连接码已生成。';pair.textContent='重新生成连接码';}catch(e){status.textContent=e.message;pair.textContent='重新生成连接码';}finally{pair.disabled=false;}};
  result.querySelector('button').onclick=async()=>{try{await navigator.clipboard.writeText(code.value);status.textContent='已复制，在采集器连接页粘贴即可。';}catch{code.select();status.textContent='请按 Ctrl+C 复制连接码。';}};
  const actions=document.createElement('div');actions.className='account-actions';actions.innerHTML='<button type="button" class="button secondary" data-revoke>断开所有采集器</button><button type="button" class="button secondary" data-logout>退出登录</button>';content.append(actions);
  actions.querySelector('[data-revoke]').onclick=async e=>{e.target.disabled=true;try{await cloudAPI('/devices/revoke',{method:'POST'});status.textContent='采集器已全部断开。需要时重新生成连接码。';}catch(err){status.textContent=err.message;}finally{e.target.disabled=false;}};
  actions.querySelector('[data-logout]').onclick=async e=>{if(pending||mediaPending||failed){status.textContent='还有未保存修改，请先完成保存或导出备份。';return;}e.target.disabled=true;try{await cloudAPI('/logout',{method:'POST'});clearAccount('登录后保存到个人空间');dialog.close();}catch(err){status.textContent=err.message;e.target.disabled=false;}};
  const deletion=document.createElement('details');deletion.className='account-danger';deletion.innerHTML='<summary>删除账户</summary><p>永久删除账户、项目和全部媒体，无法撤销。请先导出备份。</p><label>输入密码确认<input type="password" autocomplete="current-password" maxlength="128"></label><button class="button secondary" type="button">永久删除我的账户</button>';content.append(deletion);
  deletion.querySelector('button').onclick=async e=>{if(pending||mediaPending||failed){status.textContent='请先处理未保存修改。';return;}e.target.disabled=true;try{await cloudAPI('/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:deletion.querySelector('input').value})});clearAccount('账户已删除');dialog.close();}catch(err){status.textContent=err.message;e.target.disabled=false;}};
 }else mountAuthForm(content,{api:cloudAPI,heading,description,environment,close,async onAuthenticated(result){
  generation++;callbacks.onAccountChange?.();revision=0;lastSnapshot=null;failed=false;chain=Promise.resolve();user={username:result.username,development:result.development===true};
  try{await loadState();callbacks.onAuth?.(user);callbacks.onStatus?.(savedMessage);return '';}
  catch(e){callbacks.onAuth?.(user);callbacks.onError?.('收藏尚未加载，请刷新重试；暂不能保存修改。');callbacks.onStatus?.('已登录，空间尚未加载；请刷新重试。');return '已登录，但收藏暂未加载。保存恢复码后刷新页面重试。';}
 },onComplete(result,warning){
  if(!result.recoveryCode&&!warning){dialog.close();return;}
  // 恢复码只存在当前界面，不写日志或浏览器存储。
  content.replaceChildren(header,heading);heading.textContent=result.recoveryCode?'账户已准备好':'登录成功';
  const info=document.createElement('p');info.className='account-description';info.textContent=warning||'你已自动登录。接下来可连接采集器，开始保存参考。';content.append(info);
  if(result.recoveryCode){const box=document.createElement('section');box.className='account-recovery';box.innerHTML='<h3>请保存账户恢复码</h3><p>忘记密码时用它找回账户，只显示这一次。请勿分享给他人。</p><input readonly aria-label="账户恢复码"><button type="button" class="button secondary">复制恢复码</button><p role="status"></p>';box.querySelector('input').value=result.recoveryCode;box.querySelector('button').onclick=async()=>{try{await navigator.clipboard.writeText(result.recoveryCode);box.querySelector('[role=status]').textContent='已复制，请妥善保存。';}catch{box.querySelector('input').select();box.querySelector('[role=status]').textContent='请按 Ctrl+C 复制。';}};content.append(box);}
  const done=document.createElement('button');done.className='button primary auth-submit';done.textContent=warning?'保存后刷新重试':'已保存，连接采集器';done.onclick=()=>{if(warning){dialog.close();location.reload();}else showAccount({replace:true});};content.append(done);
 }});
 if(!dialog.open)dialog.showModal();
}
