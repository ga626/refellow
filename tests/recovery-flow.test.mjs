import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {openLocalCloud} from '../scripts/local-cloud.mjs';
import {handleCloudRequest} from '../cloud/api.js';
import {credentialError} from '../public/account-ui.js';
import {registerVerified} from './helpers/email-account.mjs';
import {uploadCloudMedia,readCloudMedia} from '../public/collector/cloud-media.js';
const origin='http://127.0.0.1:5192',password='QA-only-recovery-2026',nextPassword=password+'-new';
const post=body=>({method:'POST',body:JSON.stringify(body)}),cookie=r=>r.headers.get('Set-Cookie').split(';')[0];
async function value(r){assert.ok(r.ok,await r.clone().text());return r.json();}
async function setup(){const root=await mkdtemp(path.join(os.tmpdir(),'refellow-recovery-'));await mkdir(path.join(root,'cloud'));await copyFile(new URL('../cloud/schema.sql',import.meta.url),path.join(root,'cloud/schema.sql'));const env=await openLocalCloud(root);return {env,call:(route,options={})=>handleCloudRequest(new Request(origin+'/api'+route,{...options,headers:{Origin:origin,...options.headers}}),env),async close(){env.close();await rm(root,{recursive:true,force:true});}};}

test('临时注册和密钥找回校验独立于邮箱验证码，兼容邮箱、手机号和中文账号',()=>{
 for(const username of ['中文用户名','friend@example.com','18700000000','+8618700000000'])assert.equal(credentialError({username,password,confirmPassword:password},'register-key'),null);
 assert.equal(credentialError({username:'a b',password,confirmPassword:password},'register-key').field,'email');
 assert.equal(credentialError({username:'中文用户名',password,confirmPassword:password},'register').field,'email');
 assert.equal(credentialError({username:'someone',password,confirmPassword:password,recoveryCode:'A'.repeat(8)+'-'+ 'b'.repeat(24)},'recover'),null);
 assert.equal(credentialError({username:'someone',password,confirmPassword:password,recoveryCode:'生日1995'},'recover').field,'recoveryCode');
 assert.equal(credentialError({username:'someone',password,confirmPassword:'different'},'register-key').field,'confirmPassword');
});

test('无邮件也能注册，密钥只在生成时返回，邮箱形式账号不自动成为已验证邮箱',async()=>{
 const f=await setup();try{
  assert.equal((await value(await f.call('/status'))).emailReady,false);
  const r=await f.call('/register',post({username:'New@example.com',password,recoveryMethod:'key'}));assert.equal(r.status,201);const account=await value(r),headers={Cookie:cookie(r)};
  assert.equal(account.username,'new@example.com');assert.match(account.recoveryCode,/^[a-f0-9]{32}$/);assert.equal(account.recoveryReady,true);assert.equal(account.emailVerified,false);assert.equal(account.email,null);
  const stored=await f.env.DB.prepare('SELECT * FROM users').first();assert.notEqual(stored.recovery_hash,account.recoveryCode);assert.equal(stored.recovery_hash.length,64);assert.notEqual(stored.password_hash,password);
  for(const route of ['/account','/collector/session']){const info=await value(await f.call(route,{...(route.includes('collector')?post({extensionId:'a'.repeat(32)}):{}),headers}));assert.equal(info.recoveryCode,undefined);}
  assert.equal((await value(await f.call('/login',post({username:account.username,password})))).recoveryCode,undefined);
  assert.equal((await f.call('/register',post({username:account.username,password,recoveryMethod:'key'}))).status,409);
  assert.equal((await f.call('/register',{...post({username:'another',password,recoveryMethod:'key'}),headers:{Origin:'https://untrusted.test'}})).status,403);
  assert.equal((await f.call('/register',post({email:'unverified@example.com',password}))).status,400);
 }finally{await f.close();}
});

test('密钥找回轮换密钥、撤销网站与采集会话，用户ID和实际媒体不变',async()=>{
 const f=await setup();try{
  const registered=await f.call('/register',post({username:'collector-user',password,recoveryMethod:'key'})),account=await value(registered),oldCookie=cookie(registered);
  const oldID=(await f.env.DB.prepare('SELECT id FROM users').first()).id;
  const session=await value(await f.call('/collector/session',{...post({extensionId:'a'.repeat(32)}),headers:{Cookie:oldCookie}}));
  const device=(route,options={})=>f.call(route,{...options,headers:{Origin:'chrome-extension://'+'a'.repeat(32),Authorization:'Bearer '+session.token,...options.headers}});
  const image=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,11,22,33])],{type:'image/png'});
  await uploadCloudMedia(device,image,{id:'recovery-media',page:{url:'https://example.org/reference',title:'Retained capture'}});
  const before=await value(await f.call('/workspace',{headers:{Cookie:oldCookie}}));
  assert.equal((await f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:'f'.repeat(32)}))).status,401);
  const r=await f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:account.recoveryCode.toUpperCase().match(/.{8}/g).join('-')}));assert.equal(r.status,200);const reset=await value(r),newCookie=cookie(r);assert.notEqual(reset.recoveryCode,account.recoveryCode);
  assert.equal((await f.call('/account',{headers:{Cookie:oldCookie}})).status,401);assert.equal((await device('/account')).status,401);
  assert.equal((await f.call('/login',post({username:account.username,password}))).status,401);
  assert.equal((await f.call('/recover',post({username:account.username,password,recoveryCode:account.recoveryCode}))).status,401);
  assert.equal((await f.env.DB.prepare('SELECT id FROM users').first()).id,oldID);
  assert.deepEqual(await value(await f.call('/workspace',{headers:{Cookie:newCookie}})),before);
  const api=(route,options={})=>f.call(route,{...options,headers:{Cookie:newCookie,...options.headers}});
  assert.deepEqual(new Uint8Array(await(await readCloudMedia(api,'recovery-media')).arrayBuffer()),new Uint8Array(await image.arrayBuffer()));
  assert.equal((await f.call('/login',post({username:account.username,password:nextPassword}))).status,200);
 }finally{await f.close();}
});

test('既有邮箱账号可用密码设置和更换密钥，保留邮箱昵称；采集身份不可管理密钥',async()=>{
 const f=await setup();try{
  const registered=await registerVerified(f.call,f.env,{email:'existing@example.com',password,displayName:'小参'}),headers={Cookie:cookie(registered)},account=await value(registered);
  assert.equal(account.recoveryReady,false);
  assert.equal((await f.call('/account/recovery',{...post({password:'wrong-password'}),headers})).status,401);
  const first=await value(await f.call('/account/recovery',{...post({password}),headers}));
  assert.match(first.recoveryCode,/^[a-f0-9]{32}$/);
  const profile=await value(await f.call('/account',{headers}));assert.equal(profile.recoveryReady,true);assert.equal(profile.displayName,'小参');assert.equal(profile.emailVerified,true);assert.equal(profile.recoveryCode,undefined);
  const capture=await value(await f.call('/collector/session',{...post({extensionId:'a'.repeat(32)}),headers}));
  assert.equal((await f.call('/account/recovery',{...post({password}),headers:{Origin:origin,Authorization:'Bearer '+capture.token}})).status,403);
  assert.equal((await f.call('/account/recovery',{...post({password}),headers:{...headers,Origin:'https://evil.test'}})).status,403);
  const second=await value(await f.call('/account/recovery',{...post({password}),headers}));assert.notEqual(first.recoveryCode,second.recoveryCode);
  assert.equal((await f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:first.recoveryCode}))).status,401);
  const recovered=await value(await f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:second.recoveryCode})));assert.equal(recovered.displayName,'小参');assert.equal(recovered.emailVerified,true);
 }finally{await f.close();}
});

test('兼容原版恢复密钥摘要；同一密钥并发找回仅成功一次，失败不撤销成功后的会话',async()=>{
 const f=await setup();try{
  const r=await f.call('/register',post({username:'legacy-user',password,recoveryMethod:'key'}));const account=await value(r),legacy='1'.repeat(32);
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(legacy+f.env.AUTH_PEPPER))).toString('hex');
  await f.env.DB.prepare('UPDATE users SET recovery_hash=? WHERE username=?').bind(digest,account.username).run();
  const responses=await Promise.all([f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:legacy})),f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:legacy}))]);
  assert.equal(responses.filter(r=>r.status===200).length,1);assert.ok(responses.some(r=>[401,409].includes(r.status)));
  const success=responses.find(r=>r.status===200);assert.equal((await f.call('/account',{headers:{Cookie:cookie(success)}})).status,200);
 }finally{await f.close();}
});

test('未生成密钥与猜测失败不重置密码；重复尝试受到频率保护',async()=>{
 const f=await setup();try{
  const r=await registerVerified(f.call,f.env,{email:'disabled@example.com',password}),account=await value(r);
  await f.env.DB.prepare('DELETE FROM rate_limits').run();
  const unchanged=(await f.env.DB.prepare('SELECT password_hash FROM users').first()).password_hash;
  for(let i=0;i<10;i++)assert.equal((await f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:'a'.repeat(32)}))).status,401);
  assert.equal((await f.call('/recover',post({username:account.username,password:nextPassword,recoveryCode:'a'.repeat(32)}))).status,429);
  assert.equal((await f.env.DB.prepare('SELECT password_hash FROM users').first()).password_hash,unchanged);
 }finally{await f.close();}
});
