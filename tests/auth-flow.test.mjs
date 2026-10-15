import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {openLocalCloud} from '../scripts/local-cloud.mjs';
import {handleCloudRequest} from '../cloud/api.js';
import {credentialError} from '../public/account-ui.js';
import {captureOrigin,LOCAL_ORIGIN} from '../采集器/cloud-connection.js';
import {uploadCloudMedia,readCloudMedia} from '../public/collector/cloud-media.js';
test('注册输入规则明确，邮箱格式与中文用户名可用，密码和恢复码就近校验',()=>{
 for(const username of ['qa@example.com','参伴测试','test-user_01'])assert.equal(credentialError({username,password:'qa-long-password-2026'},'register'),null);
 assert.equal(credentialError({username:'a b',password:'qa-long-password-2026'},'register').field,'username');
 assert.equal(credentialError({username:'valid',password:'short'},'register').field,'password');
 assert.equal(credentialError({username:'valid',password:'qa-long-password-2026',recoveryCode:'bad'},'recover').field,'recoveryCode');
});
test('开发连接仅放行固定回环地址，拒绝任意HTTP主机、端口与伪造地址',()=>{
 assert.equal(captureOrigin(LOCAL_ORIGIN),LOCAL_ORIGIN);assert.equal(captureOrigin('https://refellow-qa-de025a6c.lingganji.pages.dev'),'https://refellow-qa-de025a6c.lingganji.pages.dev');
 for(const origin of ['http://localhost:5192','http://127.0.0.1:5193','http://127.0.0.1.evil.test:5192','http://192.168.1.1:5192','http://127.0.0.1:5192/?token=x','http://user@127.0.0.1:5192','https://evil.test'])assert.throws(()=>captureOrigin(origin));
});
test('本机注册→会话→配对→媒体→重开数据库→重新登录：完整持久与隔离合同',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'refellow-auth-'));await mkdir(path.join(root,'cloud'));await copyFile(new URL('../cloud/schema.sql',import.meta.url),path.join(root,'cloud/schema.sql'));
 let env=await openLocalCloud(root),cookie='';const origin=LOCAL_ORIGIN,password='QA-only-password-2026';
 const raw=(route,options={})=>handleCloudRequest(new Request(origin+'/api'+route,{...options,headers:{Origin:origin,Cookie:cookie,...options.headers}}),env);
 const api=async(route,options)=>{const r=await raw(route,options);assert.ok(r.ok,await r.clone().text());return r;};
 try{
  assert.deepEqual(await(await api('/status')).json(),{ready:true,development:true});
  let r=await api('/register',{method:'POST',body:JSON.stringify({username:' QA.Test@Example.com ',password})});assert.equal(r.status,201);assert.doesNotMatch(r.headers.get('Set-Cookie'),/Secure/);cookie=r.headers.get('Set-Cookie').split(';')[0];const account=await r.json();assert.equal(account.username,'qa.test@example.com');assert.equal(account.development,true);
  r=await raw('/register',{method:'POST',body:JSON.stringify({username:account.username,password})});assert.equal(r.status,409);
  const pair=await(await api('/pair',{method:'POST'})).json();r=await api('/pair/redeem',{method:'POST',headers:{Origin:'chrome-extension://'+'a'.repeat(32)},body:JSON.stringify(pair)});const {token}=await r.json();
  const device=async(route,options={})=>{const r=await raw(route,{...options,headers:{Origin:'chrome-extension://'+'a'.repeat(32),Authorization:'Bearer '+token,...options.headers}});assert.ok(r.ok,await r.clone().text());return r;};
  const image=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3])],{type:'image/png'});
  await uploadCloudMedia(device,image,{id:'local-auth-media',page:{url:'https://example.org/qa',title:'QA capture'}});
  assert.deepEqual(new Uint8Array(await(await readCloudMedia(api,'local-auth-media')).arrayBuffer()),new Uint8Array(await image.arrayBuffer()));
  env.close();env=await openLocalCloud(root);r=await api('/account');assert.equal((await r.json()).username,account.username);assert.equal((await(await api('/workspace')).json()).state.references.length,1);
  await api('/logout',{method:'POST'});assert.equal((await raw('/account')).status,401);
  r=await api('/login',{method:'POST',body:JSON.stringify({username:account.username,password})});cookie=r.headers.get('Set-Cookie').split(';')[0];assert.equal((await(await api('/workspace')).json()).state.references.length,1);
  r=await handleCloudRequest(new Request('https://refellow.test/api/login',{method:'POST',headers:{Origin:'https://refellow.test'},body:JSON.stringify({username:account.username,password})}),env);assert.match(r.headers.get('Set-Cookie'),/; Secure;/);
 }finally{env.close();await rm(root,{recursive:true,force:true});}
});
test('线上未配置保持失败，状态接口不透露秘密、不伪造登录',async()=>{
 const r=await handleCloudRequest(new Request('https://refellow.test/api/status'),{});assert.deepEqual(await r.json(),{ready:false,development:false});
 assert.equal((await handleCloudRequest(new Request('https://refellow.test/api/account'),{})).status,503);
});
