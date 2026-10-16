// 表单不保存密码或验证码；会话由 cloud-space 管理。
export function credentialError({email,username,password,code,recoveryCode,confirmPassword,displayName},mode){
 const identifier=String(email||username||'').normalize('NFKC').trim();
 const emailMode=['register','reset'].includes(mode);
 if(!identifier||identifier.length>254||/[\p{Cc}\p{Cf}]/u.test(identifier)||(emailMode&&!/^\S+@[^\s@]+\.[^\s@]+$/.test(identifier)))return {field:'email',message:emailMode?'请输入有效的邮箱地址。':'请输入账号，可使用用户名、邮箱或手机号。'};
 if(mode==='register-key'&&!/^[\p{L}\p{N}_.@+-]{3,64}$/u.test(identifier)&&!/^\S+@[^\s@]+\.[^\s@]+$/.test(identifier))return {field:'email',message:'账号需为3–64个中文、字母、数字或 . _ - @ +，也可以使用邮箱地址。'};
 if(typeof password!=='string'||password.length<12||password.length>128)return {field:'password',message:'密码需为12–128个字符，可以使用容易记住的短语。'};
 if(emailMode&&!/^\d{6}$/.test(String(code||'')))return {field:'code',message:'请输入邮件中的6位验证码。'};
 if(mode==='recover'&&!/^[a-f0-9]{32}$/i.test(String(recoveryCode||'').replace(/[\s-]/g,'')))return {field:'recoveryCode',message:'请输入保存的32位恢复密钥，可以直接粘贴。'};
 if(mode!=='login'&&password!==confirmPassword)return {field:'confirmPassword',message:'两次输入的密码不一致。'};
 if(String(displayName||'').trim().length>24)return {field:'displayName',message:'昵称最多24个字符。'};
 return null;
}

// 仅在当前窗口显示一次；用户确认保存后清除，不写入浏览器存储。
export function mountRecoveryKey(content,{code,username,close,onDone}){
 const section=document.createElement('section');section.className='account-recovery';
 section.innerHTML='<p>忘记密码时，用账号和这份密钥找回。密钥只在这里显示一次，请存入密码管理器或下载保存，勿发给他人。新密钥会替代旧密钥。</p><label for="recovery-key-once">个人恢复密钥</label><input id="recovery-key-once" readonly autocomplete="off" spellcheck="false"><div class="recovery-actions"><button type="button" class="button secondary" data-copy>复制密钥</button><button type="button" class="button secondary" data-download>下载备份</button></div><p class="account-status" role="status"></p><label class="recovery-confirm"><input type="checkbox">我已妥善保存这份密钥</label><button type="button" class="button primary auth-submit" data-done disabled>完成</button>';
 const field=section.querySelector('input'),status=section.querySelector('[role=status]'),check=section.querySelector('[type=checkbox]'),done=section.querySelector('[data-done]'),dialog=content.closest('dialog');field.value=code.match(/.{1,8}/g).join('-');content.append(section);close.disabled=true;
 const preventCancel=e=>e.preventDefault();dialog.addEventListener('cancel',preventCancel);
 const cleanup=()=>{field.value='';code='';section.remove();close.disabled=false;dialog.removeEventListener('cancel',preventCancel);};dialog.addEventListener('close',cleanup,{once:true});
 section.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(field.value);status.textContent='已复制，请粘贴到安全的地方保存。';}catch{field.focus();field.select();status.textContent='复制未完成，请按 Ctrl+C 或下载备份。';}};
 section.querySelector('[data-download]').onclick=()=>{const blob=new Blob(['参伴 Refellow · 账户恢复备份\n账号：'+username+'\n恢复密钥：'+field.value+'\n\n请勿分享此文件；重设密码后需保存新密钥。\n'],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='refellow-recovery.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='已请求下载，请确认备份文件保存成功。';};
 check.onchange=()=>done.disabled=!check.checked;done.onclick=()=>{dialog.removeEventListener('close',cleanup);cleanup();onDone();};field.focus();field.select();
}
export function mountAuthForm(content,{api,onAuthenticated,onComplete,heading,description,environment,close}){
 let mode='login',busy=false,ready=false,emailReady=false,resendAt=0,registerByEmail=true;
 const tabs=document.createElement('div');tabs.className='auth-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','登录或注册');
 tabs.innerHTML='<button type="button" data-mode="login" aria-pressed="true">登录</button><button type="button" data-mode="register" aria-pressed="false">注册账户</button>';
 const form=document.createElement('form');form.className='auth-form';form.noValidate=true;
 form.innerHTML='<label for="auth-email">邮箱</label><input id="auth-email" name="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" required aria-describedby="email-hint email-error"><p class="auth-hint" id="email-hint"></p><p class="auth-field-error" id="email-error"></p><div data-register hidden><label for="auth-name">昵称 <span class="auth-optional">选填</span></label><input id="auth-name" name="displayName" autocomplete="nickname" maxlength="24" placeholder="怎么称呼你？"><p class="auth-hint">留空会生成默认昵称，之后随时可以修改。</p><p class="auth-field-error" id="displayName-error"></p></div><div data-code hidden><label for="auth-code">邮箱验证码</label><div class="auth-code-row"><input id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6位数字" aria-describedby="code-hint code-error"><button type="button" class="button secondary" data-send>发送验证码</button></div><p class="auth-hint" id="code-hint">10分钟有效，请勿向他人提供。</p><p class="auth-field-error" id="code-error"></p></div><div class="auth-label-row"><label for="auth-password">密码</label><button class="auth-link" type="button" data-recover>忘记密码？</button></div><div class="auth-password"><input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="12" maxlength="128" aria-describedby="password-hint password-error caps-hint"><button type="button" class="auth-visibility" aria-label="显示密码" aria-pressed="false">显示</button></div><p class="auth-hint" id="password-hint"></p><p class="auth-hint" id="caps-hint" hidden>大写锁定已开启</p><p class="auth-field-error" id="password-error"></p><div data-confirm hidden><label for="auth-confirm">确认密码</label><input id="auth-confirm" name="confirmPassword" type="password" autocomplete="new-password" maxlength="128" aria-describedby="confirmPassword-error"><p class="auth-field-error" id="confirmPassword-error"></p></div><p class="auth-error" role="alert" tabindex="-1"></p><p class="auth-mail-status" role="status"></p><button class="button primary auth-submit" type="submit" disabled>正在连接…</button><p class="auth-footnote">仅用于登录和你主动请求的账户邮件。<a href="/privacy.html" target="_blank" rel="noopener">隐私政策</a></p>';
 form.querySelector('[data-register]').remove();
 const recovery=document.createElement('div');recovery.dataset.recovery='';recovery.className='auth-recovery-field';recovery.hidden=true;recovery.innerHTML='<label for="auth-recovery">个人恢复密钥</label><input id="auth-recovery" name="recoveryCode" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="80" placeholder="粘贴你保存的恢复密钥" aria-describedby="recoveryCode-hint recoveryCode-error"><p class="auth-hint" id="recoveryCode-hint">注册或在账户设置生成的个人密钥，使用后会换成新密钥。</p><p class="auth-field-error" id="recoveryCode-error"></p>';form.querySelector('[data-code]').before(recovery);
 const emailReset=document.createElement('button');emailReset.type='button';emailReset.className='auth-link';emailReset.textContent='改用已验证邮箱找回';emailReset.hidden=true;form.querySelector('.auth-footnote').before(emailReset);
 form.querySelector('.auth-footnote').firstChild.textContent='个人恢复密钥仅用于找回账户。';content.append(tabs,form);
 const registerMethod=document.createElement('button');registerMethod.type='button';registerMethod.className='auth-link';registerMethod.hidden=true;form.querySelector('.auth-footnote').before(registerMethod);
 const emailRegistration=()=>mode==='register'&&emailReady&&registerByEmail;
 const input=name=>form.elements.namedItem(name),error=form.querySelector('.auth-error'),submit=form.querySelector('[type=submit]'),send=form.querySelector('[data-send]'),notice=form.querySelector('.auth-mail-status');
 const label=()=>mode==='login'?'登录':mode==='register'?'创建账户':'重设密码并登录';
 function clearErrors(){error.textContent='';form.querySelectorAll('.auth-field-error').forEach(el=>el.textContent='');form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));}
 function tick(){const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));send.disabled=busy||!emailReady||seconds>0;send.textContent=seconds?seconds+'秒后重发':'发送验证码';}
 const timer=setInterval(tick,1000),dialog=content.closest('dialog');dialog.addEventListener('close',()=>clearInterval(timer),{once:true});
 function setMode(next){
  if(busy)return;mode=next;clearErrors();notice.textContent='';for(const name of ['password','confirmPassword','code','recoveryCode'])input(name).value='';input('password').type='password';form.querySelector('.auth-visibility').textContent='显示';form.querySelector('.auth-visibility').setAttribute('aria-pressed','false');form.querySelector('.auth-visibility').setAttribute('aria-label','显示密码');
  const login=mode==='login',reset=mode==='reset',recover=mode==='recover',finding=reset||recover,mailRegister=emailRegistration(),usesCode=reset||mailRegister;heading.textContent=finding?'找回密码':login?'欢迎回到参伴':'创建你的参伴账户';description.textContent=recover?'已有账户忘记密码时，才需要输入保存过的恢复密钥。':reset?'验证邮箱后设置新密码，原有收藏会保留。':login?'登录一次，网页与采集器就能一起使用。':mailRegister?'验证邮箱并设置密码，之后可通过邮件找回。':'只需设置账号和密码，注册成功后会自动生成恢复密钥。';
  tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  recovery.hidden=!recover;form.querySelector('[data-code]').hidden=!usesCode;form.querySelector('[data-confirm]').hidden=login;
  input('code').required=usesCode;input('recoveryCode').required=recover;input('confirmPassword').required=!login;input('password').autocomplete=login?'current-password':'new-password';
  form.querySelector('[data-recover]').textContent=finding?'返回登录':'忘记密码？';form.querySelector('[data-recover]').hidden=mode==='register';emailReset.hidden=!finding||!emailReady;emailReset.textContent=recover?'改用已验证邮箱找回':'改用个人恢复密钥找回';
  form.querySelector('label[for=auth-email]').textContent=reset?'已验证邮箱':mailRegister?'邮箱':'账号';input('email').inputMode=usesCode?'email':'text';form.querySelector('#email-hint').textContent=reset?'仅支持已经验证并绑定的邮箱。':mailRegister?'填写你的邮箱，验证码用于确认邮箱归你所有。':mode==='register'?'用户名、邮箱或手机号均可作为账号，不需要验证码。':'请输入注册时使用的用户名、邮箱或手机号。';form.querySelector('#password-hint').textContent=login?'':'12–128个字符，可以使用容易记住的短语。';form.querySelector('label[for=auth-password]').textContent=finding?'新密码':'密码';
  registerMethod.hidden=mode!=='register'||!emailReady;registerMethod.textContent=registerByEmail?'改用账号注册，保存恢复密钥':'改用邮箱验证注册';form.querySelector('.auth-footnote').firstChild.textContent=usesCode?'仅用于登录和你主动请求的账户邮件。':'个人恢复密钥仅用于找回账户。';
  form.querySelector('#caps-hint').hidden=true;submit.disabled=!ready||(reset&&!emailReady);submit.textContent=ready?label():'等待账户服务';tick();
 }
 registerMethod.onclick=()=>{if(busy)return;registerByEmail=!registerByEmail;setMode('register');};
 tabs.onclick=e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode);};form.querySelector('[data-recover]').onclick=()=>setMode(['recover','reset'].includes(mode)?'login':emailReady?'reset':'recover');emailReset.onclick=()=>setMode(mode==='recover'?'reset':'recover');
 form.querySelector('.auth-visibility').onclick=e=>{const show=input('password').type==='password';input('password').type=show?'text':'password';e.target.textContent=show?'隐藏':'显示';e.target.setAttribute('aria-pressed',String(show));e.target.setAttribute('aria-label',show?'隐藏密码':'显示密码');};
 for(const event of ['keydown','keyup'])input('password').addEventListener(event,e=>{form.querySelector('#caps-hint').hidden=!e.getModifierState?.('CapsLock');});
 form.addEventListener('input',e=>{e.target.removeAttribute('aria-invalid');const field=form.querySelector('#'+e.target.name+'-error');if(field)field.textContent='';error.textContent='';});
 function lock(value){busy=value;form.setAttribute('aria-busy',String(value));for(const el of form.elements)el.disabled=value;tabs.querySelectorAll('button').forEach(b=>b.disabled=value);close.disabled=value;tick();}
 const preventCancel=e=>{if(busy)e.preventDefault();};dialog.addEventListener('cancel',preventCancel);dialog.addEventListener('close',()=>{dialog.removeEventListener('cancel',preventCancel);for(const name of ['password','confirmPassword','code','recoveryCode'])input(name).value='';},{once:true});
 send.onclick=async()=>{
  const email=input('email').value.trim();if(!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)){form.querySelector('#email-error').textContent='请先填写有效的邮箱地址。';input('email').focus();return;}
  lock(true);notice.textContent='正在发送…';try{await api('/email/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,purpose:mode==='reset'?'reset':'register'})});resendAt=Date.now()+60000;notice.textContent='验证码已发送，请检查邮箱和垃圾邮件。';}catch(e){notice.textContent=e.message;}finally{lock(false);input('code').focus();}
 };
 form.onsubmit=async e=>{
  e.preventDefault();e.stopImmediatePropagation();if(busy||!ready||(mode==='reset'&&!emailReady))return;clearErrors();
  const values=Object.fromEntries(new FormData(form)),invalid=credentialError(values,mode==='register'?(emailRegistration()?'register':'register-key'):mode);
  if(invalid){form.querySelector('#'+invalid.field+'-error').textContent=invalid.message;input(invalid.field).setAttribute('aria-invalid','true');input(invalid.field).focus();return;}
  const identifier=String(values.email).normalize('NFKC').trim().toLowerCase(),body=mode==='reset'||emailRegistration()?{email:identifier,password:values.password,code:values.code}:{username:identifier,password:values.password,...(mode==='register'?{recoveryMethod:'key'}:{}),...(mode==='recover'?{recoveryCode:values.recoveryCode}:{})};
  lock(true);submit.textContent='正在处理…';try{const result=await(await api(mode==='reset'?'/password/reset':'/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();for(const name of ['password','confirmPassword','code','recoveryCode'])input(name).value='';const warning=await onAuthenticated(result);lock(false);clearInterval(timer);onComplete(result,warning);}catch(e){error.textContent=e.message;error.focus();}finally{if(form.isConnected){lock(false);submit.textContent=label();}}
 };
 async function checkService(){
  ready=false;submit.disabled=true;environment.hidden=false;environment.textContent='正在连接账户服务…';
  try{const status=await(await api('/status')).json();if(!form.isConnected)return;if(!status.ready)throw Error('账户服务暂不可用，请稍后重试。');ready=true;emailReady=status.emailReady===true;environment.textContent=status.development?'本机测试空间 · 与线上账户及收藏分开。':'';environment.hidden=!status.development;setMode(mode);}
  catch(e){if(!form.isConnected)return;environment.textContent=e.message;const retry=document.createElement('button');retry.className='auth-link';retry.type='button';retry.textContent='重试连接';retry.onclick=checkService;environment.append(' ',retry);submit.textContent='等待账户服务恢复';}
 }
 setMode('login');checkService();return {setMode};
}
