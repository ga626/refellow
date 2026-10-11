import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFile} from 'node:fs/promises';
import {handleCloudRequest} from '../cloud/api.js';
import {emptyState} from '../public/store.js';
import {uploadCloudMedia,readCloudMedia} from '../public/collector/cloud-media.js';
function fixture(schema){const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);const statement=(sql,args=[])=>({bind:(...values)=>statement(sql,values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v)),async run(){const info=sqlite.prepare(sql).run(...args);return {meta:{changes:info.changes}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}});return {env:{DB:{prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},AUTH_PEPPER:'fixture-only-private-pepper-do-not-deploy'},close:()=>sqlite.close()};}
test('云端个人空间：两个账户隔离、跨端持久、陈旧保存拒绝、设备只可采集',async()=>{
 const f=fixture(await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'));
 const call=(path,options={})=>handleCloudRequest(new Request('https://refellow.test/api'+path,{...options,headers:{Origin:'https://refellow.test',...options.headers}}),f.env);
 const register=async username=>{const r=await call('/register',{method:'POST',body:JSON.stringify({username,password:'QA-Password-DoNotDeploy-2026'})});assert.equal(r.status,201);return {cookie:r.headers.get('Set-Cookie').split(';')[0],body:await r.json()};};
 try{
  const alice=await register('alice'),bob=await register('bob');assert.match(alice.cookie,/refellow_session=/);assert.ok(alice.body.recoveryCode);
  let response=await call('/workspace',{headers:{Cookie:alice.cookie}});assert.deepEqual((await response.json()).state,emptyState());
  const next=emptyState();next.siteSaved.push('test-site');response=await call('/workspace',{method:'PUT',headers:{Cookie:alice.cookie,'If-Match':'0'},body:JSON.stringify(next)});assert.equal(response.status,200);
  response=await call('/workspace',{method:'PUT',headers:{Cookie:alice.cookie,'If-Match':'0'},body:JSON.stringify(emptyState())});assert.equal(response.status,409);
  response=await call('/workspace',{headers:{Cookie:bob.cookie}});assert.equal((await response.json()).state.siteSaved.length,0);
  response=await call('/workspace',{method:'PUT',headers:{Cookie:bob.cookie,'If-Match':'0','X-Refellow-Account':'alice'},body:JSON.stringify(next)});assert.equal(response.status,409);response=await call('/workspace',{headers:{Cookie:bob.cookie}});assert.equal((await response.json()).state.siteSaved.length,0);
  response=await call('/workspace',{headers:{Cookie:bob.cookie,'X-Refellow-Account':'alice'}});assert.equal(response.status,409);

  response=await call('/pair',{method:'POST',headers:{Cookie:alice.cookie}});const {code}=await response.json();
  response=await call('/pair/redeem',{method:'POST',headers:{Origin:'chrome-extension://'+'a'.repeat(32)},body:JSON.stringify({code})});assert.equal(response.status,200);const {token}=await response.json();
  response=await call('/pair/redeem',{method:'POST',headers:{Origin:'chrome-extension://'+'a'.repeat(32)},body:JSON.stringify({code})});assert.equal(response.status,401);
  response=await call('/workspace',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,403);
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10]),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  response=await call('/uploads',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({page:{url:'https://example.org/real-page',title:'QA screenshot'},mime:'image/png',size:bytes.length,sha256:sha,chunkHashes:[sha]})});assert.equal(response.status,201);const {id}=await response.json();
  response=await call('/uploads/'+id+'/0',{method:'PUT',headers:{Authorization:'Bearer '+token},body:bytes});assert.equal(response.status,200);
  response=await call('/uploads/'+id+'/complete',{method:'POST',headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200,await response.clone().text());
  response=await call('/media/'+id,{headers:{Cookie:bob.cookie}});assert.equal(response.status,404);
  response=await call('/media/'+id+'/0',{headers:{Cookie:alice.cookie}});assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
  response=await call('/workspace',{headers:{Cookie:alice.cookie}});const workspace=await response.json();assert.equal(workspace.state.references.length,1);assert.equal(workspace.state.references[0].attachments[0].mediaId,id);
  response=await call('/workspace',{method:'PUT',headers:{Cookie:bob.cookie,'If-Match':'0'},body:JSON.stringify(workspace.state)});assert.equal(response.status,404);
  response=await call('/logout',{method:'POST',headers:{Cookie:alice.cookie}});assert.equal(response.status,200);response=await call('/workspace',{headers:{Cookie:alice.cookie}});assert.equal(response.status,401);
 }finally{f.close();}
});
test('云端未配置时必须明确失败，不冒充本地保存或登录成功',async()=>{const r=await handleCloudRequest(new Request('https://refellow.test/api/account'),{});assert.equal(r.status,503);});
test('分块媒体真实往返、损坏拒绝与重复保存幂等',async()=>{
 const f=fixture(await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'));
 let cookie;const raw=(path,options={})=>handleCloudRequest(new Request('https://refellow.test/api'+path,{...options,headers:{Origin:'https://refellow.test',Cookie:cookie||'',...options.headers}}),f.env);
 const api=async(path,options)=>{const response=await raw(path,options);if(!response.ok)throw Object.assign(Error((await response.json()).error),{status:response.status});return response;};
 try{
  const account=await raw('/register',{method:'POST',body:JSON.stringify({username:'media-test',password:'QA-Media-Password-2026'})});cookie=account.headers.get('Set-Cookie').split(';')[0];
  const data=new Uint8Array(700000);data.set([137,80,78,71,13,10,26,10]);for(let i=8;i<data.length;i++)data[i]=i%251;
  const blob=new Blob([data],{type:'image/png'}),input={id:'qa-stable-media',page:{url:'https://example.org/multi-chunk',title:'QA only'}};
  await uploadCloudMedia(api,blob,input);await uploadCloudMedia(api,blob,input);
  assert.deepEqual(new Uint8Array(await(await readCloudMedia(api,input.id)).arrayBuffer()),data);
  const workspace=await(await api('/workspace')).json();assert.equal(workspace.state.references.length,1);assert.equal(workspace.revision,1);
  const other=await raw('/uploads',{method:'POST',body:JSON.stringify({id:input.id,mime:'image/png',size:8,sha256:'a'.repeat(64),chunkHashes:['a'.repeat(64)]})});assert.equal(other.status,409);
  const missing=await raw('/uploads',{method:'POST',body:JSON.stringify({id:'qa-corrupt',mime:'image/png',size:8,sha256:'a'.repeat(64),chunkHashes:['a'.repeat(64)]})});assert.equal(missing.status,201);
  let response=await raw('/uploads/qa-corrupt/0',{method:'PUT',body:data.slice(0,8)});assert.equal(response.status,409);
  response=await raw('/uploads/qa-corrupt/complete',{method:'POST'});assert.equal(response.status,409);
  response=await raw('/workspace',{method:'PUT',headers:{'If-Match':'1'},body:JSON.stringify(workspace.state)});assert.equal(response.status,200);
  const tampered=async(path,options)=>{const result=await api(path,options);if(path.endsWith('/0'))return new Response(new Uint8Array(512*1024));return result;};
  await assert.rejects(()=>readCloudMedia(tampered,input.id),/下载不完整/);
 }finally{f.close();}
});
test('密码恢复撤销旧登录、设备撤销、删除账户级联，跨源写入拒绝',async()=>{
 const f=fixture(await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'));
 const call=(path,options={})=>handleCloudRequest(new Request('https://refellow.test/api'+path,{...options,headers:{Origin:'https://refellow.test',...options.headers}}),f.env);
 const password='QA-Recovery-Password-2026';
 try{
  let r=await call('/register',{method:'POST',body:JSON.stringify({username:'recovery-test',password})});const cookie=r.headers.get('Set-Cookie').split(';')[0],registered=await r.json();
  r=await call('/pair',{method:'POST',headers:{Cookie:cookie}});const pair=await r.json();
  r=await call('/pair/redeem',{method:'POST',headers:{Origin:'chrome-extension://'+'a'.repeat(32)},body:JSON.stringify(pair)});const {token}=await r.json();
  r=await call('/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.test'}});assert.equal(r.status,403);
  r=await call('/devices/revoke',{method:'POST',headers:{Cookie:cookie}});assert.equal(r.status,200);
  r=await call('/account',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,401);
  r=await call('/recover',{method:'POST',body:JSON.stringify({username:'recovery-test',password:password+'new',recoveryCode:registered.recoveryCode})});assert.equal(r.status,200);const newCookie=r.headers.get('Set-Cookie').split(';')[0];
  r=await call('/account',{headers:{Cookie:cookie}});assert.equal(r.status,401);
  r=await call('/login',{method:'POST',body:JSON.stringify({username:'recovery-test',password})});assert.equal(r.status,401);
  r=await call('/account',{method:'DELETE',headers:{Cookie:newCookie},body:JSON.stringify({password:password+'new'})});assert.equal(r.status,200);
  for(const table of ['users','workspaces','pair_codes','sessions','uploads','chunks'])assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS count FROM '+table).first()).count,0);
 }finally{f.close();}
});
test('请求超额与非法媒体摘要在读取和存储前拒绝',async()=>{
 const f=fixture(await readFile(new URL('../cloud/schema.sql',import.meta.url),'utf8'));
 try{
  const request=new Request('https://refellow.test/api/register',{method:'POST',headers:{Origin:'https://refellow.test'},body:'x'.repeat(300000)});const response=await handleCloudRequest(request,f.env);assert.equal(response.status,413);
  assert.equal((await f.env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()).count,0);
 }finally{f.close();}
});
