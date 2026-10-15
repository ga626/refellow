// 表单不保存密码或验证码；会话由 cloud-space 管理。
export function credentialError({email,username,password,code,confirmPassword,displayName},mode){
 const identifier=String(email||username||'').normalize('NFKC').trim();
 if(!identifier||identifier.length>254||(mode!=='login'&&!/^\S+@[^\s@]+\.[^\s@]+$/.test(identifier)))return {field:'email',message:mode==='login'?'请输入邮箱；旧账户可填写原用户名。':'请输入有效的邮箱地址。'};
 if(typeof password!=='string'||password.length<12||password.length>128)return {field:'password',message:'密码需为12–128个字符，可以使用容易记住的短语。'};
 if(mode!=='login'&&!/^\d{6}$/.test(String(code||'')))return {field:'code',message:'请输入邮件中的6位验证码。'};
 if(mode!=='login'&&password!==confirmPassword)return {field:'confirmPassword',message:'两次输入的密码不一致。'};
 if(String(displayName||'').trim().length>24)return {field:'displayName',message:'昵称最多24个字符。'};
 return null;
}
export function mountAuthForm(content,{api,onAuthenticated,onComplete,heading,description,environment,close}){
 let mode='login',busy=false,ready=false,emailReady=false,resendAt=0;
 const tabs=document.createElement('div');tabs.className='auth-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','登录或注册');
 tabs.innerHTML='<button type="button" data-mode="login" aria-pressed="true">登录</button><button type="button" data-mode="register" aria-pressed="false">注册账户</button>';
 const form=document.createElement('form');form.className='auth-form';form.noValidate=true;
 form.innerHTML='<label for="auth-email">邮箱</label><input id="auth-email" name="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" required aria-describedby="email-hint email-error"><p class="auth-hint" id="email-hint"></p><p class="auth-field-error" id="email-error"></p><div data-register hidden><label for="auth-name">昵称 <span class="auth-optional">选填</span></label><input id="auth-name" name="displayName" autocomplete="nickname" maxlength="24" placeholder="怎么称呼你？"><p class="auth-hint">留空会生成默认昵称，之后随时可以修改。</p><p class="auth-field-error" id="displayName-error"></p></div><div data-code hidden><label for="auth-code">邮箱验证码</label><div class="auth-code-row"><input id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6位数字" aria-describedby="code-hint code-error"><button type="button" class="button secondary" data-send>发送验证码</button></div><p class="auth-hint" id="code-hint">10分钟有效，请勿向他人提供。</p><p class="auth-field-error" id="code-error"></p></div><div class="auth-label-row"><label for="auth-password">密码</label><button class="auth-link" type="button" data-recover>忘记密码？</button></div><div class="auth-password"><input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="12" maxlength="128" aria-describedby="password-hint password-error caps-hint"><button type="button" class="auth-visibility" aria-label="显示密码" aria-pressed="false">显示</button></div><p class="auth-hint" id="password-hint"></p><p class="auth-hint" id="caps-hint" hidden>大写锁定已开启</p><p class="auth-field-error" id="password-error"></p><div data-confirm hidden><label for="auth-confirm">确认密码</label><input id="auth-confirm" name="confirmPassword" type="password" autocomplete="new-password" maxlength="128" aria-describedby="confirmPassword-error"><p class="auth-field-error" id="confirmPassword-error"></p></div><p class="auth-error" role="alert" tabindex="-1"></p><p class="auth-mail-status" role="status"></p><button class="button primary auth-submit" type="submit" disabled>正在连接…</button><p class="auth-footnote">仅用于登录和你主动请求的账户邮件。<a href="/privacy.html" target="_blank" rel="noopener">隐私政策</a></p>';
 content.append(tabs,form);
 const input=name=>form.elements.namedItem(name),error=form.querySelector('.auth-error'),submit=form.querySelector('[type=submit]'),send=form.querySelector('[data-send]'),notice=form.querySelector('.auth-mail-status');
 const label=()=>mode==='login'?'登录':mode==='register'?'创建账户':'重设密码并登录';
 function clearErrors(){error.textContent='';form.querySelectorAll('.auth-field-error').forEach(el=>el.textContent='');form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));}
 function tick(){const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));send.disabled=busy||!emailReady||seconds>0;send.textContent=seconds?seconds+'秒后重发':'发送验证码';}
 const timer=setInterval(tick,1000),dialog=content.closest('dialog');dialog.addEventListener('close',()=>clearInterval(timer),{once:true});
 function setMode(next){
  if(busy)return;mode=next;clearErrors();notice.textContent='';input('password').value='';input('confirmPassword').value='';input('code').value='';input('password').type='password';form.querySelector('.auth-visibility').textContent='显示';form.querySelector('.auth-visibility').setAttribute('aria-pressed','false');
  const login=mode==='login',reset=mode==='reset';heading.textContent=reset?'找回你的账户':login?'欢迎回到参伴':'创建你的参伴账户';description.textContent=reset?'验证邮箱后设置新密码，原有收藏会保留。':login?'登录一次，网页与采集器就能一起使用。':'把喜欢的画面，收进自己的参考空间。';
  tabs.hidden=reset;tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  form.querySelector('[data-register]').hidden=true;form.querySelector('[data-code]').hidden=login;form.querySelector('[data-confirm]').hidden=login;
  input('code').required=!login;input('confirmPassword').required=!login;input('password').autocomplete=login?'current-password':'new-password';
  form.querySelector('[data-recover]').textContent=reset?'返回登录':'忘记密码？';form.querySelector('[data-recover]').hidden=mode==='register';
  form.querySelector('#email-hint').textContent=login?'旧账户可继续用原用户名登录，登录后绑定邮箱。':'验证邮箱可在忘记密码时找回账户。';form.querySelector('#password-hint').textContent=login?'':'12–128个字符，无需强制混用特殊符号。';
  form.querySelector('#caps-hint').hidden=true;submit.disabled=!ready||(!login&&!emailReady);submit.textContent=ready?label():'等待账户服务';
  if(ready&&!login&&!emailReady){error.textContent='邮件服务尚未开通，暂不能注册或重置密码。已有账户可切回登录。';submit.textContent='等待邮件服务开通';}tick();
 }
 tabs.onclick=e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode);};form.querySelector('[data-recover]').onclick=()=>setMode(mode==='reset'?'login':'reset');
 form.querySelector('.auth-visibility').onclick=e=>{const show=input('password').type==='password';input('password').type=show?'text':'password';e.target.textContent=show?'隐藏':'显示';e.target.setAttribute('aria-pressed',String(show));e.target.setAttribute('aria-label',show?'隐藏密码':'显示密码');};
 for(const event of ['keydown','keyup'])input('password').addEventListener(event,e=>{form.querySelector('#caps-hint').hidden=!e.getModifierState?.('CapsLock');});
 form.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');const field=form.querySelector('#'+e.target.name+'-error');if(field)field.textContent='';error.textContent='';});
 function lock(value){busy=value;form.setAttribute('aria-busy',String(value));for(const el of form.elements)el.disabled=value;tabs.querySelectorAll('button').forEach(b=>b.disabled=value);close.disabled=value;tick();}
 const preventCancel=e=>{if(busy)e.preventDefault();};dialog.addEventListener('cancel',preventCancel);dialog.addEventListener('close',()=>dialog.removeEventListener('cancel',preventCancel),{once:true});
 send.onclick=async()=>{
  const email=input('email').value.trim();if(!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)){form.querySelector('#email-error').textContent='请先填写有效的邮箱地址。';input('email').focus();return;}
  lock(true);notice.textContent='正在发送…';try{await api('/email/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,purpose:mode==='reset'?'reset':'register'})});resendAt=Date.now()+60000;notice.textContent='验证码已发送，请检查邮箱和垃圾邮件。';}catch(e){notice.textContent=e.message;}finally{lock(false);input('code').focus();}
 };
 form.onsubmit=async e=>{
  e.preventDefault();e.stopImmediatePropagation();if(busy||!ready||(mode!=='login'&&!emailReady))return;clearErrors();
  const body=Object.fromEntries(new FormData(form));body.email=String(body.email).normalize('NFKC').trim().toLowerCase();const invalid=credentialError(body,mode);
  if(invalid){form.querySelector('#'+invalid.field+'-error').textContent=invalid.message;input(invalid.field).setAttribute('aria-invalid','true');input(invalid.field).focus();return;}
  lock(true);submit.textContent='正在处理…';try{const result=await(await api(mode==='reset'?'/password/reset':'/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();input('password').value='';input('confirmPassword').value='';input('code').value='';const warning=await onAuthenticated(result);onComplete(result,warning);}catch(e){error.textContent=e.message;error.focus();}finally{lock(false);submit.textContent=label();}
 };
 async function checkService(){
  ready=false;submit.disabled=true;environment.hidden=false;environment.textContent='正在连接账户服务…';
  try{const status=await(await api('/status')).json();if(!form.isConnected)return;if(!status.ready)throw Error('账户服务暂不可用，请稍后重试。');ready=true;emailReady=status.emailReady===true;environment.textContent=status.development?'本机测试空间 · 与线上账户及收藏分开。':'';environment.hidden=!status.development;setMode(mode);}
  catch(e){if(!form.isConnected)return;environment.textContent=e.message;const retry=document.createElement('button');retry.className='auth-link';retry.type='button';retry.textContent='重试连接';retry.onclick=checkService;environment.append(' ',retry);submit.textContent='等待账户服务恢复';}
 }
 setMode('login');checkService();return {setMode};
}