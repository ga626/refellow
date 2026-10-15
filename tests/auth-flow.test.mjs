import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,rm,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {openLocalCloud} from '../scripts/local-cloud.mjs';
import {handleCloudRequest} from '../cloud/api.js';
import {credentialError} from '../public/account-ui.js';
import {captureOrigin,LOCAL_ORIGIN,CLOUD_ORIGIN,PREVIEW_ORIGIN,ACCOUNT_MATCHES} from '../采集器/cloud-connection.js';
import {synchronizeAccount} from '../采集器/account-session.js';
import {uploadCloudMedia,readCloudMedia} from '../public/collector/cloud-media.js';
import {registerVerified} from './helpers/email-account.mjs';
import {runInNewContext} from 'node:vm';
import {mailReady,sendAccountMail} from '../cloud/mail.js';
import {buildCloudWorker} from '../scripts/build-cloud.mjs';
async function setup(){const root=await mkdtemp(path.join(os.tmpdir(),'refellow-auth-'));await mkdir(path.join(root,'cloud'));await copyFile(new URL('../cloud/schema.sql',import.meta.url),path.join(root,'cloud/schema.sql'));let env=await openLocalCloud(root),cookie='';const raw=(route,options={})=>handleCloudRequest(new Request(LOCAL_ORIGIN+'/api'+route,{...options,headers:{Origin:LOCAL_ORIGIN,Cookie:cookie,...options.headers}}),env);return {root,get env(){return env;},setCookie:r=>cookie=r.headers.get('Set-Cookie').split(';')[0],raw,async reopen(){env.close();env=await openLocalCloud(root);},async close(){env.close();await rm(root,{recursive:true,force:true});}};}
const post=body=>({method:'POST',body:JSON.stringify(body)}),password='QA-only-password-2026';
const body=async r=>{assert.ok(r.ok,await r.clone().text());return r.json();};
test('邮件适配器按官方API合同提交，失败不泄漏服务响应或密钥',async()=>{
 const original=globalThis.fetch,requests=[];globalThis.fetch=async(url,options)=>{requests.push({url,options});return new Response('{}',{status:201});};
 try{assert.equal(mailReady({}),false);await sendAccountMail({MAIL_FROM:'sender@example.test',BREVO_API_KEY:'qa-key-only'},'to@example.test','123456','reset');assert.equal(requests[0].url,'https://api.brevo.com/v3/smtp/email');assert.equal(requests[0].options.headers['api-key'],'qa-key-only');assert.equal(JSON.parse(requests[0].options.body).to[0].email,'to@example.test');
  await sendAccountMail({MAIL_FROM:'sender@example.test',RESEND_API_KEY:'qa-key-only'},'to@example.test','123456','register');assert.equal(requests[1].url,'https://api.resend.com/emails');assert.equal(JSON.parse(requests[1].options.body).to[0],'to@example.test');
  globalThis.fetch=async()=>new Response('private-provider-error',{status:403});await assert.rejects(()=>sendAccountMail({MAIL_FROM:'sender@example.test',RESEND_API_KEY:'qa-key-only'},'to@example.test','123456','register'),error=>error.status===502&&!error.message.includes('private-provider-error'));
 }finally{globalThis.fetch=original;}
});
test('邮箱注册校验、密码确认和验证码；旧用户名仅保留登录',()=>{
 const good={email:'qa@example.com',password,confirmPassword:password,code:'123456'};
 assert.equal(credentialError(good,'register'),null);
 assert.equal(credentialError({...good,email:'中文用户名'},'register').field,'email');
 assert.equal(credentialError({...good,code:'bad'},'reset').field,'code');
 assert.equal(credentialError({...good,confirmPassword:'different'},'register').field,'confirmPassword');
 assert.equal(credentialError({username:'旧用户名',password},'login'),null);
});
test('开发连接只接受固定回环和受信正式／预览地址',()=>{
 assert.equal(captureOrigin(LOCAL_ORIGIN),LOCAL_ORIGIN);
 assert.equal(CLOUD_ORIGIN,'https://refellow.pages.dev');assert.equal(PREVIEW_ORIGIN,'https://preview.refellow.pages.dev');
 for(const origin of [CLOUD_ORIGIN,PREVIEW_ORIGIN,'https://lingganji.pages.dev','https://refellow-qa-de025a6c.lingganji.pages.dev'])assert.equal(captureOrigin(origin),origin);
 for(const origin of ['https://refellow.pages.dev.evil.test','https://other.pages.dev','https://other.refellow.pages.dev','http://refellow.pages.dev','https://refellow.pages.dev:8443','https://refellow.pages.dev/?token=x','https://user@refellow.pages.dev','https://preview.refellow.pages.dev/path'])assert.throws(()=>captureOrigin(origin));
 assert.deepEqual(ACCOUNT_MATCHES,['https://refellow.pages.dev/*','https://preview.refellow.pages.dev/*','https://lingganji.pages.dev/*','https://*.lingganji.pages.dev/*']);
 for(const origin of ['http://localhost:5192','http://127.0.0.1:5193','http://127.0.0.1.evil.test:5192','http://192.168.1.1:5192','http://127.0.0.1:5192/?token=x','http://user@127.0.0.1:5192','https://evil.test'])assert.throws(()=>captureOrigin(origin));
});
test('换址兼容新旧受信站点的自动同步，仿冒域名不发出会话请求',async()=>{
 const script=await readFile(new URL('../采集器/account-bridge.js',import.meta.url),'utf8');
 for(const origin of [CLOUD_ORIGIN,PREVIEW_ORIGIN,'https://lingganji.pages.dev','https://other.refellow.pages.dev','https://refellow.pages.dev.evil.test']){
  const allowed=[CLOUD_ORIGIN,PREVIEW_ORIGIN,'https://lingganji.pages.dev'].includes(origin),calls=[],document=new EventTarget();document.hasFocus=()=>true;document.hidden=false;
  let done;const finished=new Promise(resolve=>done=resolve);document.addEventListener('refellow:collector-status',()=>done());
  runInNewContext(script,{location:{origin},document,chrome:{runtime:{id:'a'.repeat(32),sendMessage:async message=>{calls.push(message);return {ok:true};}}},fetch:async(route,options)=>{calls.push({route,options});return new Response('{}',{status:401});},AbortSignal,CustomEvent,Event,setInterval:()=>0,addEventListener:()=>{}});
  if(allowed){await finished;assert.equal(calls[0].route,'/api/collector/session');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[1].origin,origin);assert.equal(calls[1].account,null);}else assert.equal(calls.length,0);
 }
});
test('扩展换址更新不清除原连接、待保存媒体或其他设置',async()=>{
 const script=(await readFile(new URL('../采集器/service-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?$/gm,'');
 const data={'refellow/cloud-connection':{origin:'https://lingganji.pages.dev',token:'a'.repeat(64),username:'existing'},pending:{id:'existing-media'},theme:'blue'},before=structuredClone(data),injected=[];
 let installed;
 const event={addListener:()=>{}};
 const api={runtime:{onInstalled:{addListener:f=>installed=f},onMessage:event},permissions:{onAdded:event},action:{onClicked:event},tabs:{onRemoved:event,onUpdated:event,query:async options=>{assert.deepEqual([...options.url],ACCOUNT_MATCHES);return [{id:1}];}},scripting:{executeScript:async options=>injected.push(options)},storage:{local:{get:async()=>data,set:async value=>Object.assign(data,value),remove:async key=>delete data[key],clear:async()=>Object.keys(data).forEach(key=>delete data[key])}}};
 runInNewContext(script,{chrome:api,ACCOUNT_MATCHES,enableLocalBridge:async()=>{},clearExpiredShots:async()=>{},Promise});
 await installed();assert.deepEqual(data,before);assert.deepEqual([...injected[0].files],['account-bridge.js']);
});
test('邮箱注册→自动采集会话→媒体保存→重开持久库；退出同步撤销采集身份',async()=>{
 const f=await setup();try{
  let r=await registerVerified(f.raw,f.env,{email:'QA@example.com',displayName:'小参',password});assert.equal(r.status,201);f.setCookie(r);const account=await body(r);assert.equal(account.displayName,'小参');assert.equal(account.emailVerified,true);assert.equal(account.recoveryCode,undefined);assert.doesNotMatch(r.headers.get('Set-Cookie'),/Secure/);
  const session=await body(await f.raw('/collector/session',post({extensionId:'a'.repeat(32)})));assert.equal(session.username,'qa@example.com');
  const again=await body(await f.raw('/collector/session',post({extensionId:'a'.repeat(32)})));assert.equal(again.token,session.token);
  const device=async(route,options={})=>{const r=await f.raw(route,{...options,headers:{Origin:'chrome-extension://'+'a'.repeat(32),Authorization:'Bearer '+session.token,...options.headers}});assert.ok(r.ok,await r.clone().text());return r;};
  const image=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3])],{type:'image/png'});
  await uploadCloudMedia(device,image,{id:'local-auth-media',page:{url:'https://example.org/qa',title:'QA capture'}});
  const api=async(route,options)=>{const r=await f.raw(route,options);assert.ok(r.ok,await r.clone().text());return r;};
  assert.deepEqual(new Uint8Array(await(await readCloudMedia(api,'local-auth-media')).arrayBuffer()),new Uint8Array(await image.arrayBuffer()));
  await f.reopen();assert.equal((await body(await f.raw('/account'))).displayName,'小参');assert.equal((await body(await f.raw('/workspace'))).state.references.length,1);
  await body(await f.raw('/logout',post({})));assert.equal((await f.raw('/account')).status,401);assert.equal((await f.raw('/account',{headers:{Authorization:'Bearer '+session.token}})).status,401);
  r=await f.raw('/login',post({email:account.email,password}));f.setCookie(r);assert.equal(r.status,200);assert.equal((await body(await f.raw('/workspace'))).state.references.length,1);
  r=await handleCloudRequest(new Request('https://refellow.test/api/login',{...post({email:account.email,password}),headers:{Origin:'https://refellow.test'}}),f.env);assert.match(r.headers.get('Set-Cookie'),/; Secure;/);
 }finally{await f.close();}
});
test('验证码错误、用途隔离、一次性、频率和邮件失败均不创建账户',async()=>{
 const f=await setup();try{
  let mail;f.env.MAIL_SEND=async value=>{mail=value;};const email='verify@example.com';
  assert.equal((await f.raw('/email/code',post({email,purpose:'register'}))).status,200);
  assert.equal((await f.raw('/email/code',post({email,purpose:'reset'}))).status,429);
  assert.equal((await f.raw('/password/reset',post({email,password,code:mail.code}))).status,400);
  assert.equal((await f.raw('/register',post({email,password,code:'wrong'}))).status,400);
  let r=await f.raw('/register',post({email,password,code:mail.code}));assert.equal(r.status,201);
  assert.equal((await f.raw('/register',post({email:'other@example.com',password,code:mail.code}))).status,400);
  assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS count FROM email_codes').first()).count,0);
  f.env.MAIL_SEND=async()=>{throw Object.assign(Error('发送失败'),{status:502});};assert.equal((await f.raw('/email/code',post({email:'fail@example.com',purpose:'register'}))).status,502);
  assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS count FROM email_codes').first()).count,0);
  assert.equal((await f.raw('/recover',post({}))).status,410);assert.equal((await f.raw('/pair',post({}))).status,410);
 }finally{await f.close();}
});
test('五次错误后验证码失效，过期验证码拒绝，不能绕过验证注册',async()=>{
 const f=await setup();try{
  let mail;f.env.MAIL_SEND=async value=>mail=value;const email='tries@example.com';await f.raw('/email/code',post({email,purpose:'register'}));
  const wrong=mail.code==='000000'?'111111':'000000';for(let i=0;i<5;i++)assert.equal((await f.raw('/register',post({email,password,code:wrong}))).status,400);
  assert.equal((await f.raw('/register',post({email,password,code:mail.code}))).status,400);
  await f.env.DB.prepare('DELETE FROM rate_limits').run();await f.env.DB.prepare('UPDATE email_codes SET attempts=0,expires=0').run();assert.equal((await f.raw('/register',post({email,password,code:mail.code}))).status,400);
  assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()).count,0);
 }finally{await f.close();}
});
test('旧账户邮箱不自动获得信任，登录后验证绑定；昵称独立于邮箱',async()=>{
 const f=await setup();try{
  const r=await registerVerified(f.raw,f.env,{email:'legacy@example.com',password});f.setCookie(r);await f.env.DB.prepare('DELETE FROM account_profiles').run();
  const account=await body(await f.raw('/account'));assert.equal(account.emailVerified,false);assert.doesNotMatch(account.displayName,/@/);
  const changed=await body(await f.raw('/account',{method:'PATCH',body:JSON.stringify({displayName:'拾光'})}));assert.equal(changed.displayName,'拾光');
  await f.env.DB.prepare('DELETE FROM rate_limits').run();let mail;f.env.MAIL_SEND=async value=>{mail=value;};await f.raw('/email/code',post({email:'legacy@example.com',purpose:'bind'}));
  const bound=await body(await f.raw('/email/bind',post({email:'legacy@example.com',code:mail.code})));assert.equal(bound.emailVerified,true);assert.equal(bound.displayName,'拾光');
  assert.equal((await f.raw('/collector/session',{...post({extensionId:'a'.repeat(32)}),headers:{Origin:'https://evil.test'}})).status,403);
 }finally{await f.close();}
});
test('自动连接只接受本扩展受信网站顶层消息，后台另一环境不能覆盖',async()=>{
 const data={},id='a'.repeat(32),origin=LOCAL_ORIGIN;
 const api={runtime:{id},tabs:{get:async()=>({url:origin+'/',active:true})},storage:{local:{get:async()=>data,set:async value=>Object.assign(data,value),remove:async key=>delete data[key]}}};
 const sender={id,frameId:0,url:origin+'/',tab:{id:1}},message={origin,focused:true,account:{token:'a'.repeat(64),username:'one@example.com',displayName:'小参'}};
 await synchronizeAccount(api,message,sender);assert.equal(data['refellow/cloud-connection'].displayName,'小参');
 await assert.rejects(synchronizeAccount(api,message,{...sender,frameId:1}));await assert.rejects(synchronizeAccount(api,message,{...sender,url:'https://evil.test'}));await assert.rejects(synchronizeAccount(api,message,{...sender,id:'b'.repeat(32)}));
 await synchronizeAccount(api,{...message,account:null},sender);assert.equal(data['refellow/cloud-connection'],undefined);
 data['refellow/cloud-connection']={origin:CLOUD_ORIGIN,token:'b'.repeat(64),username:'two'};await synchronizeAccount(api,{...message,focused:false},sender);assert.equal(data['refellow/cloud-connection'].username,'two');
});
test('无发件服务时不伪造发送成功，已有账号登录可用；未配置云端不透露秘密',async()=>{
 const f=await setup();try{assert.equal((await body(await f.raw('/status'))).emailReady,false);assert.equal((await f.raw('/email/code',post({email:'a@example.com',purpose:'register'}))).status,503);}finally{await f.close();}
 const r=await handleCloudRequest(new Request('https://refellow.test/api/status'),{});assert.deepEqual(await r.json(),{ready:false,development:false,emailReady:false});
 assert.equal((await handleCloudRequest(new Request('https://refellow.test/api/account'),{})).status,503);
});
test('隔离脚本→真实账户API→后台存储：登录、切换、退出完整传递链',async()=>{
 const f=await setup();try{
  let r=await registerVerified(f.raw,f.env,{email:'bridge-a@example.test',password});f.setCookie(r);
  const data={},id='a'.repeat(32),document=new EventTarget();document.hasFocus=()=>true;document.hidden=false;
  const api={runtime:{id},tabs:{get:async()=>({url:LOCAL_ORIGIN+'/',active:true})},storage:{local:{get:async()=>data,set:async value=>Object.assign(data,value),remove:async key=>delete data[key]}}};
  let finished;const wait=()=>new Promise(resolve=>finished=resolve),events=[];document.addEventListener('refellow:collector-status',event=>{events.push(JSON.parse(event.detail));finished?.();});
  const first=wait();runInNewContext(await readFile(new URL('../采集器/account-bridge.js',import.meta.url),'utf8'),{location:{origin:LOCAL_ORIGIN},document,chrome:{runtime:{id,sendMessage:message=>synchronizeAccount(api,message,{id,frameId:0,url:LOCAL_ORIGIN+'/',tab:{id:1}})}},fetch:async(route,options)=>{assert.equal(options.credentials,'same-origin');return f.raw(route.replace('/api',''),options);},AbortSignal,CustomEvent,Event,setInterval:()=>0,addEventListener:()=>{}});await first;
  const original=data['refellow/cloud-connection'];assert.equal(original.username,'bridge-a@example.test');assert.ok(original.token);assert.equal(events[0].token,undefined);
  r=await registerVerified(f.raw,f.env,{email:'bridge-b@example.test',password});f.setCookie(r);const second=wait();document.dispatchEvent(new Event('refellow:account-changed'));await second;assert.equal(data['refellow/cloud-connection'].username,'bridge-b@example.test');
  assert.equal((await f.raw('/account',{headers:{Authorization:'Bearer '+original.token}})).status,401);
  await f.raw('/logout',post({}));const third=wait();document.dispatchEvent(new Event('refellow:account-changed'));await third;assert.equal(data['refellow/cloud-connection'],undefined);assert.equal(events.at(-1).connected,false);
 }finally{await f.close();}
});
test('实际Pages worker打包后保留邮件与自动连接接口，不残留模块导入',async()=>{
 const f=await setup();try{
  const bytes=await buildCloudWorker(process.cwd()),worker=(await import('data:text/javascript;base64,'+bytes.toString('base64'))).default;
  const call=(route,options={})=>worker.fetch(new Request('https://refellow.test/api'+route,{...options,headers:{Origin:'https://refellow.test',...options.headers}}),f.env);
  const r=await registerVerified(call,f.env,{email:'bundle@example.test',password});assert.equal(r.status,201);const cookie=r.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await call('/collector/session',{...post({extensionId:'a'.repeat(32)}),headers:{Cookie:cookie}})).status,200);
 }finally{await f.close();}
});
