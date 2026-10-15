// 账户表单只负责交互；会话、空间和账户切换由 cloud-space 管理。
export function credentialError({username,password,recoveryCode},mode){
 const normalized=String(username||'').normalize('NFKC').trim().toLowerCase();
 if(!/^[\p{L}\p{N}_.@-]{3,64}$/u.test(normalized))return {field:'username',message:'请输入3–64个字符，可使用中文、字母、数字及 . _ - @。'};
 if(typeof password!=='string'||password.length<12||password.length>128)return {field:'password',message:'密码需为12–128个字符，可使用一段容易记住的短语。'};
 if(mode==='recover'&&!/^[a-f0-9]{32}$/i.test(String(recoveryCode||'').trim()))return {field:'recoveryCode',message:'请输入注册时保存的32位恢复码。'};
 return null;
}
export function mountAuthForm(content,{api,onAuthenticated,onComplete,heading,description,environment,close}){
 let mode='login',busy=false,ready=false;
 const tabs=document.createElement('div');tabs.className='auth-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','选择登录或注册');
 tabs.innerHTML='<button type="button" data-mode="login" aria-pressed="true">登录</button><button type="button" data-mode="register" aria-pressed="false">注册账户</button>';
 const form=document.createElement('form');form.className='auth-form';form.noValidate=true;
 form.innerHTML='<label for="auth-username">用户名</label><input id="auth-username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="64" aria-describedby="username-hint username-error"><p class="auth-hint" id="username-hint"></p><p class="auth-field-error" id="username-error"></p><div class="auth-label-row"><label for="current-password">密码</label><button class="auth-link" type="button" data-recover>忘记密码？</button></div><div class="auth-password"><input id="current-password" name="password" type="password" autocomplete="current-password" required minlength="12" maxlength="128" aria-describedby="password-hint password-error caps-hint"><button type="button" class="auth-visibility" aria-label="显示密码，文字将出现在屏幕上" aria-pressed="false">显示</button></div><p class="auth-hint" id="password-hint"></p><p class="auth-hint" id="caps-hint" hidden>大写锁定已开启</p><p class="auth-field-error" id="password-error"></p><div class="auth-recovery-field" hidden><label for="auth-recovery">恢复码</label><input id="auth-recovery" name="recoveryCode" autocomplete="off" spellcheck="false" maxlength="40" aria-describedby="recovery-hint recoveryCode-error"><p class="auth-hint" id="recovery-hint">使用注册时保存的恢复码重设密码，原有收藏会保留。</p><p class="auth-field-error" id="recoveryCode-error"></p></div><p class="auth-error" role="alert" tabindex="-1"></p><button class="button primary auth-submit" type="submit" disabled>正在检查服务…</button><p class="auth-footnote">不需要手机号或邮箱验证。<a href="/privacy.html" target="_blank" rel="noopener">了解隐私政策</a></p>';
 content.append(tabs,form);
 const input=name=>form.elements.namedItem(name),error=form.querySelector('.auth-error'),submit=form.querySelector('[type=submit]'),visibility=form.querySelector('.auth-visibility');
 function clearErrors(){error.textContent='';form.querySelectorAll('.auth-field-error').forEach(el=>el.textContent='');form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));}
 function setMode(next){
  if(busy)return;mode=next;clearErrors();input('password').value='';input('password').type='password';input('recoveryCode').value='';visibility.textContent='显示';visibility.setAttribute('aria-pressed','false');visibility.setAttribute('aria-label','显示密码，文字将出现在屏幕上');
  const login=mode==='login',recover=mode==='recover';
  heading.textContent=recover?'找回你的账户':login?'欢迎回到参伴':'创建你的参伴账户';
  description.textContent=recover?'重设密码，继续整理你的参考。':login?'登录后，查看和整理你的个人收藏。':'把喜欢的画面，收进自己的参考空间。';
  tabs.hidden=recover;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  input('password').id=login?'current-password':'new-password';form.querySelector('.auth-label-row label').htmlFor=input('password').id;form.querySelector('.auth-label-row label').textContent=recover?'设置新密码':'密码';input('password').autocomplete=login?'current-password':'new-password';
  form.querySelector('[data-recover]').textContent=recover?'返回登录':'忘记密码？';form.querySelector('[data-recover]').hidden=mode==='register';
  form.querySelector('#username-hint').textContent=login?'输入注册时使用的用户名。':'3–64个字符，支持中文、字母、数字及 . _ - @。邮箱也可作用户名。';
  form.querySelector('#password-hint').textContent=login?'':'12–128个字符，无需强制混用大小写或符号。';
  form.querySelector('#caps-hint').hidden=true;form.querySelector('.auth-recovery-field').hidden=!recover;input('recoveryCode').required=recover;
  if(ready)submit.textContent=recover?'重设密码并登录':login?'登录':'创建账户';
 }
 tabs.onclick=e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode);};
 form.querySelector('[data-recover]').onclick=()=>setMode(mode==='recover'?'login':'recover');
 visibility.onclick=()=>{const show=input('password').type==='password';input('password').type=show?'text':'password';visibility.textContent=show?'隐藏':'显示';visibility.setAttribute('aria-pressed',String(show));visibility.setAttribute('aria-label',show?'隐藏密码':'显示密码，文字将出现在屏幕上');};
 for(const event of ['keydown','keyup'])input('password').addEventListener(event,e=>{form.querySelector('#caps-hint').hidden=!e.getModifierState?.('CapsLock');});
 form.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');const field=form.querySelector('#'+e.target.name+'-error');if(field)field.textContent='';error.textContent='';});
 function lock(value){busy=value;form.setAttribute('aria-busy',String(value));for(const el of form.elements)el.disabled=value;tabs.querySelectorAll('button').forEach(b=>b.disabled=value);close.disabled=value;}
 const preventCancel=e=>{if(busy)e.preventDefault();};const dialog=content.closest('dialog');dialog.addEventListener('cancel',preventCancel);dialog.addEventListener('close',()=>dialog.removeEventListener('cancel',preventCancel),{once:true});
 form.onsubmit=async e=>{
  e.preventDefault();e.stopImmediatePropagation();if(busy||!ready)return;clearErrors();
  const body={username:input('username').value.normalize('NFKC').trim().toLowerCase(),password:input('password').value,recoveryCode:input('recoveryCode').value.trim().toLowerCase()};
  const invalid=credentialError(body,mode);if(invalid){form.querySelector('#'+invalid.field+'-error').textContent=invalid.message;input(invalid.field).setAttribute('aria-invalid','true');input(invalid.field).focus();return;}
  lock(true);submit.textContent=mode==='login'?'正在登录…':mode==='register'?'正在创建账户…':'正在重设密码…';
  try{const result=await(await api('/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();input('password').value='';const warning=await onAuthenticated(result);onComplete(result,warning);}
  catch(e){lock(false);error.textContent=e.message;if(e.status===409&&mode==='register'){input('username').setAttribute('aria-invalid','true');input('username').focus();}else error.focus();}
  finally{lock(false);submit.textContent=mode==='login'?'登录':mode==='register'?'创建账户':'重设密码并登录';}
 };
 async function checkService(){
  ready=false;submit.disabled=true;submit.textContent='正在检查服务…';environment.textContent='正在连接账户服务…';
  try{const status=await(await api('/status')).json();if(!form.isConnected)return;
   if(!status.ready)throw Error('账户服务暂不可用，请稍后重试。无需修改你的用户名或密码。');
   ready=true;submit.disabled=false;environment.textContent=status.development?'本机测试空间 · 账户和媒体仅保存在这台电脑，与线上空间分开。':'';environment.hidden=!status.development;setMode(mode);
  }catch(e){if(!form.isConnected)return;environment.hidden=false;environment.textContent=e.message;const retry=document.createElement('button');retry.className='auth-link';retry.type='button';retry.textContent='重试连接';retry.onclick=checkService;environment.append(' ',retry);submit.textContent='等待账户服务恢复';}
 }
 setMode('login');checkService();return {setMode};
}
