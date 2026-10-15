import {emptyState,normalizeWorkspace,normalizeReference,addReference} from '../public/store.js';
import {safeURL} from '../public/lib.js';
import {mailReady,sendAccountMail} from './mail.js';
const text=new TextEncoder(),MAX_MEDIA=64*1024*1024,CHUNK=512*1024;
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const MAX_WORKSPACE=1024*1024;
const mediaKey=(id,position)=>'media/'+id+'/'+position;
const hash=async value=>hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?text.encode(value):value));
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
async function passwordHash(password,salt,pepper){
 const key=await crypto.subtle.importKey('raw',text.encode(password+pepper),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:text.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
function constantEqual(a,b){let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0;}
export async function handleCloudRequest(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin'),website=origin===url.origin,extension=!!origin&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin);
 const development=env.LOCAL_DEVELOPMENT===true&&url.origin==='http://127.0.0.1:5192';
 const cookie=(token,maxAge=2592000)=>'refellow_session='+token+'; HttpOnly;'+(development?'':' Secure;')+' SameSite=Strict; Path=/api; Max-Age='+maxAge;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
 if(extension)Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type, If-Match','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS'});
 const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
 const db=env.DB,now=Date.now(),q=(sql,...params)=>db.prepare(sql).bind(...params);
 async function readBytes(max){
  if(Number(request.headers.get('Content-Length'))>max)fail('请求太大。',413);
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();fail('请求太大。',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
 }
 async function readJSON(max=256*1024){const raw=new TextDecoder().decode(await readBytes(max));try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))fail('请求格式错误。');return value;}catch{fail('请求格式错误。');}}
 function workspaceBody(state){const body=JSON.stringify(state);if(text.encode(body).length>MAX_WORKSPACE)fail('参考文字和项目资料已达到首版空间上限，请精简后保存。',413);return body;}
 async function rate(key,max=10,window=5*60*1000){
  const id=await hash(key+env.AUTH_PEPPER);
  await q('DELETE FROM rate_limits WHERE reset_at<?',now).run();
  await q('INSERT INTO rate_limits(key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END',id,now+window,now,now).run();
  const row=await q('SELECT attempts FROM rate_limits WHERE key=?',id).first();if(row.attempts>max)fail('尝试过于频繁，请稍后重试。',429);
 }
 async function authenticate(){
  const bearer=request.headers.get('Authorization'),raw=bearer?.startsWith('Bearer ')?bearer.slice(7):request.headers.get('Cookie')?.match(/(?:^|;\s*)refellow_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!raw||!/^[a-f0-9]{64}$/.test(raw))fail('请先登录。',401);
  const row=await q('SELECT sessions.user_id,sessions.scope,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires>?',await hash(raw),now).first();if(!row)fail('登录已过期，请重新登录。',401);
  if(row.scope==='capture'){const parent=await q('SELECT s.expires FROM capture_sessions c JOIN sessions s ON s.token_hash=c.parent_hash WHERE c.token_hash=? AND s.expires>?',await hash(raw),now).first();if(!parent)fail('网站登录已失效，请回参伴重新登录。',401);}
  const expected=request.headers.get('X-Refellow-Account');if(expected&&expected!==row.username)fail('其他页面已切换账户，请刷新后重新操作；未保存到其他账户。',409);
  if(!bearer&&request.method!=='GET'&&!website)fail('来源不受信任。',403);return {...row,raw};
 }
 async function newSession(user,scope){const token=random(32);await q('DELETE FROM sessions WHERE expires<?',now).run();await q('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires LIMIT (SELECT MAX(COUNT(*)-19,0) FROM sessions WHERE user_id=?))',user,user).run();await q('INSERT INTO sessions VALUES(?,?,?,?)',await hash(token),user,scope,now+30*24*60*60*1000).run();return token;}
 async function ownedUpload(user,id){const row=await q('SELECT * FROM uploads WHERE id=? AND user_id=?',id,user).first();if(!row)fail('没有这份媒体。',404);return row;}
 const emailValue=value=>{const email=String(value||'').normalize('NFKC').trim().toLowerCase();if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))fail('请输入有效的邮箱地址。');return email;};
 const displayValue=value=>{const name=String(value||'').normalize('NFKC').trim();if(name.length>24||/[\p{Cc}\p{Cf}]/u.test(name))fail('昵称最多24个字符，请勿使用控制字符。');return name;};
 async function profile(id,username){const p=await q('SELECT email,display_name FROM account_profiles WHERE user_id=?',id).first();return {username,displayName:p?.display_name||'参伴用户'+id.slice(-4),email:p?.email||null,emailVerified:!!p?.email,development};}
 async function consumeCode(email,purpose,code){
  const row=await q('SELECT * FROM email_codes WHERE email=? AND purpose=?',email,purpose).first();
  if(!row||!row.sent||row.expires<=now||row.attempts>=5)fail('验证码已失效，请重新获取。',400);
  await q('UPDATE email_codes SET attempts=attempts+1 WHERE email=? AND purpose=? AND digest=?',email,purpose,row.digest).run();
  if(!/^\d{6}$/.test(String(code))||!constantEqual(row.digest,await hash(email+':'+purpose+':'+code+env.AUTH_PEPPER)))fail('验证码不正确，请检查邮件。');
  const result=await q('DELETE FROM email_codes WHERE email=? AND purpose=? AND digest=? AND attempts<=5 AND expires>? AND sent=1',email,purpose,row.digest,now).run();if(result.meta.changes!==1)fail('验证码已使用，请重新获取。',409);
 }
 async function retireBrowserSession(){const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)refellow_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(raw)await q("DELETE FROM sessions WHERE token_hash=? AND scope='website'",await hash(raw)).run();}
 try{
  if(request.method==='OPTIONS')return extension?new Response(null,{status:204,headers}):json({error:'来源不受信任。'},403);
  const path=url.pathname.replace(/^\/api/,'');
  if(path==='/status'&&request.method==='GET')return json({ready:!!db&&typeof env.AUTH_PEPPER==='string'&&env.AUTH_PEPPER.length>=32,development,emailReady:mailReady(env)});
  if(!/^\/(register|login|recover|logout|account|email\/(code|bind)|password\/reset|collector\/session|devices\/revoke|pair(?:\/redeem)?|workspace|uploads(?:\/[a-zA-Z0-9_-]+\/(?:\d+|complete))?|media\/[a-zA-Z0-9_-]+(?:\/\d+)?)$/.test(path))return json({error:'没有此接口。'},404);
  if(!db||typeof env.AUTH_PEPPER!=='string'||env.AUTH_PEPPER.length<32)return json({error:'个人云空间尚未配置，暂不能登录或保存。'},503);
  if(path==='/recover'||path.startsWith('/pair'))return json({error:'请在参伴网站登录；密码通过已验证邮箱重置。无需连接码或恢复码。'},410);
  if(path==='/email/code'){
   if(request.method!=='POST'||!website)fail('请从参伴网站操作。',403);
   if(!mailReady(env))fail('邮件服务尚未配置，暂不能发送验证码。已有账户仍可登录。',503);
   const body=await readJSON(),email=emailValue(body.email),purpose=body.purpose;if(!['register','reset','bind'].includes(purpose))fail('验证码用途无效。');
   if(purpose==='bind'){const session=await authenticate();if(session.scope!=='website')fail('请在网站绑定邮箱。',403);}
   await rate('email-ip:'+request.headers.get('CF-Connecting-IP'),10);await rate('email-minute:'+email,1,60000);await rate('email-day',90,24*60*60*1000);
   const bytes=new Uint32Array(1);do{crypto.getRandomValues(bytes);}while(bytes[0]>=4294000000);const code=String(bytes[0]%1000000).padStart(6,'0'),digest=await hash(email+':'+purpose+':'+code+env.AUTH_PEPPER);
   await q('DELETE FROM email_codes WHERE expires<?',now).run();
   await q('INSERT INTO email_codes VALUES(?,?,?,?,0,0) ON CONFLICT(email,purpose) DO UPDATE SET digest=excluded.digest,expires=excluded.expires,attempts=0,sent=0',email,purpose,digest,now+10*60*1000).run();
   try{await sendAccountMail(env,email,code,purpose);await q('UPDATE email_codes SET sent=1 WHERE email=? AND purpose=? AND digest=?',email,purpose,digest).run();}catch(e){await q('DELETE FROM email_codes WHERE email=? AND purpose=? AND digest=?',email,purpose,digest).run();throw e;}
   return json({ok:true,retryAfter:60});
  }
  if(path==='/register'||path==='/login'||path==='/password/reset'){
   if(request.method!=='POST'||!website)fail('请从参伴网站操作。',403);
   const body=await readJSON(),identifier=String(body.email||body.username||'').normalize('NFKC').trim().toLowerCase();
   if(!identifier||identifier.length>254)fail('请输入邮箱；旧账户也可使用原用户名登录。');
   if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)fail('密码需为12–128个字符，可使用密码短语，无需特殊符号。');
   await rate('auth-ip:'+request.headers.get('CF-Connecting-IP'));await rate('auth-user:'+identifier,12);
   const existing=await q('SELECT u.* FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id WHERE u.username=? OR p.email=?',identifier,identifier).first();
   if(path==='/register'){
    const email=emailValue(body.email),displayName=displayValue(body.displayName)||'参伴用户'+random(2);
    if(existing)fail('此邮箱已有账户，请登录；旧账户请先登录再绑定邮箱。',409);
    if((await q('SELECT COUNT(*) AS count FROM users').first()).count>=500)fail('首版免费空间的账户名额已满，请联系支持。',503);
    await consumeCode(email,'register',body.code);
    const id='user-'+crypto.randomUUID(),salt=random(16),derived=await passwordHash(body.password,salt,env.AUTH_PEPPER);
    const created=await db.batch([q('INSERT INTO users SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM users)<500',id,email,salt,derived,'disabled',now),q('INSERT INTO workspaces SELECT ?,?,0 WHERE EXISTS(SELECT 1 FROM users WHERE id=?)',id,JSON.stringify(emptyState()),id),q('INSERT INTO account_profiles SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)',id,email,displayName,id)]);if(created[0].meta.changes!==1)fail('免费空间账户名额已满。',503);
    await retireBrowserSession();return json(await profile(id,email),201,{'Set-Cookie':cookie(await newSession(id,'website'))});
   }
   if(path==='/password/reset'){
    const email=emailValue(body.email);await consumeCode(email,'reset',body.code);
    const account=await q('SELECT u.* FROM users u JOIN account_profiles p ON p.user_id=u.id WHERE p.email=?',email).first();if(!account)fail('此邮箱尚未绑定账户。旧账户请使用原用户名登录后绑定邮箱。');
    const salt=random(16);await db.batch([q('UPDATE users SET salt=?,password_hash=?,recovery_hash=? WHERE id=?',salt,await passwordHash(body.password,salt,env.AUTH_PEPPER),'disabled',account.id),q('DELETE FROM sessions WHERE user_id=?',account.id),q('DELETE FROM pair_codes WHERE user_id=?',account.id)]);
    await retireBrowserSession();return json(await profile(account.id,account.username),200,{'Set-Cookie':cookie(await newSession(account.id,'website'))});
   }
   const derived=await passwordHash(body.password,existing?.salt||'invalid-account-dummy-salt',env.AUTH_PEPPER);if(!existing||!constantEqual(derived,existing.password_hash))fail('邮箱或密码错误。旧账户也可使用原用户名登录。',401);
   await retireBrowserSession();return json(await profile(existing.id,existing.username),200,{'Set-Cookie':cookie(await newSession(existing.id,'website'))});
  }
  const session=await authenticate(),user=session.user_id;
  if(path==='/collector/session'&&request.method==='POST'){
   if(!website||session.scope!=='website')fail('请从参伴网站登录。',403);const body=await readJSON();if(!/^[a-p]{32}$/.test(body.extensionId||''))fail('采集器身份无效。');
   const parent=await hash(session.raw),token=await hash('capture:'+session.raw+':'+body.extensionId+':'+env.AUTH_PEPPER),digest=await hash(token);
   const parentRow=await q('SELECT expires FROM sessions WHERE token_hash=?',parent).first();
   await db.batch([q("INSERT INTO sessions VALUES(?,?,'capture',?) ON CONFLICT(token_hash) DO NOTHING",digest,user,parentRow.expires),q('INSERT INTO capture_sessions VALUES(?,?) ON CONFLICT(token_hash) DO NOTHING',digest,parent)]);
   return json({token,...await profile(user,session.username)});
  }
  if(path==='/logout'&&request.method==='POST'){await q('DELETE FROM sessions WHERE token_hash=?',await hash(session.raw)).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
  if(path==='/account'&&request.method==='GET')return json(await profile(user,session.username));
  if(path==='/account'&&request.method==='PATCH'){
   if(!website||session.scope!=='website')fail('请在网站修改昵称。',403);const body=await readJSON(),name=displayValue(body.displayName);if(!name)fail('请填写昵称。');
   await q('INSERT INTO account_profiles(user_id,email,display_name) VALUES(?,NULL,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name',user,name).run();return json(await profile(user,session.username));
  }
  if(path==='/email/bind'&&request.method==='POST'){
   if(!website||session.scope!=='website')fail('请在网站绑定邮箱。',403);const body=await readJSON(),email=emailValue(body.email);
   const old=await q('SELECT email FROM account_profiles WHERE user_id=?',user).first();if(old?.email)fail('邮箱已验证，无需重复绑定。',409);
   if(await q('SELECT user_id FROM account_profiles WHERE email=? AND user_id<>?',email,user).first()||await q('SELECT id FROM users WHERE username=? AND id<>?',email,user).first())fail('此邮箱已关联其他账户。',409);
   await consumeCode(email,'bind',body.code);await q('INSERT INTO account_profiles VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email',user,email,'参伴用户'+user.slice(-4)).run();return json(await profile(user,session.username));
  }
  if(path==='/devices/revoke'&&request.method==='POST'){if(session.scope!=='website')fail('请在网站管理设备。',403);await q("DELETE FROM sessions WHERE user_id=? AND scope='capture'",user).run();await q('DELETE FROM pair_codes WHERE user_id=?',user).run();return json({ok:true});}
  if(path==='/account'&&request.method==='DELETE'){if(session.scope!=='website')fail('请在网站删除账户。',403);const body=await readJSON();if(typeof body.password!=='string'||body.password.length>128)fail('密码错误。',401);const account=await q('SELECT salt,password_hash FROM users WHERE id=?',user).first();if(!constantEqual(await passwordHash(body.password,account.salt,env.AUTH_PEPPER),account.password_hash))fail('密码错误。',401);if(env.MEDIA){const objects=(await q('SELECT c.storage_key FROM chunk_meta c JOIN uploads u ON u.id=c.upload_id WHERE u.user_id=?',user).all()).results;for(const object of objects)await env.MEDIA.delete(object.storage_key);}await q('DELETE FROM users WHERE id=?',user).run();return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
  if(path==='/workspace'){
   if(session.scope!=='website')fail('没有网站管理权限。',403);
   const current=await q('SELECT * FROM workspaces WHERE user_id=?',user).first();
   if(request.method==='GET')return json({state:JSON.parse(current.body),revision:current.revision,development:env.LOCAL_DEVELOPMENT===true});
   if(request.method==='PUT'){
    const expected=Number(request.headers.get('If-Match'));if(!request.headers.has('If-Match')||!Number.isSafeInteger(expected))fail('缺少保存版本。');
    const state=normalizeWorkspace(await readJSON(MAX_WORKSPACE)),body=workspaceBody(state),attachments=state.references.flatMap(r=>r.attachments).filter(a=>a.mediaId);
    if(attachments.length){
     const ids=JSON.stringify([...new Set(attachments.map(a=>a.mediaId))]);
     const owned=(await q('SELECT id,size,mime,completed FROM uploads WHERE user_id=? AND id IN (SELECT value FROM json_each(?))',user,ids).all()).results;
     const byId=new Map(owned.map(row=>[row.id,row]));for(const a of attachments){const media=byId.get(a.mediaId);if(!media)fail('没有这份媒体。',404);if(!media.completed||media.size!==a.size||media.mime!==a.mime)fail('参考媒体不属于当前账户或内容不完整。',403);}
    }
    const budget=await q('SELECT COALESCE(SUM(length(CAST(body AS BLOB))),0) AS size FROM workspaces WHERE user_id<>?',user).first();if(budget.size+text.encode(body).length>48*1024*1024)fail('首版免费空间的文字资料容量已满，请联系支持。',413);
    const result=await q('UPDATE workspaces SET body=?,revision=revision+1 WHERE user_id=? AND revision=? AND (SELECT COALESCE(SUM(length(CAST(body AS BLOB))),0) FROM workspaces WHERE user_id<>?)+length(CAST(? AS BLOB))<=?',body,user,expected,user,body,48*1024*1024).run();if(result.meta.changes!==1)fail('另一页面已经保存，请刷新后再修改；未覆盖较新内容。',409);return json({revision:expected+1});
   }
  }
  if(path==='/uploads'&&request.method==='POST'){
   const data=await readJSON(),storageOnly=data.storageOnly===true;if(storageOnly&&session.scope!=='website')fail('设备只可保存采集内容。',403);
   const page={url:safeURL(data.page?.url||url.origin+'/#collection'),title:String(data.page?.title||'').slice(0,120),captureMethod:String(data.page?.captureMethod||'').slice(0,80),duration:Number(data.page?.duration)||0,storageOnly};
   if(!Number.isInteger(data.size)||data.size<1||data.size>MAX_MEDIA||!/^([a-f0-9]{64})$/.test(data.sha256||'')||!(/^(image\/(png|jpeg|webp)|video\/(webm|mp4)(;codecs=[\w., -]+)?)$/).test(data.mime||''))fail('媒体格式或大小无效。');
   if(!Array.isArray(data.chunkHashes)||data.chunkHashes.length!==Math.ceil(data.size/CHUNK)||data.chunkHashes.some(h=>!/^[a-f0-9]{64}$/.test(h)))fail('媒体分块摘要无效。');
   const id=typeof data.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(data.id)?data.id:'media-'+crypto.randomUUID();
   const prior=await q('SELECT id,user_id,sha256,size,mime,chunk_hashes,completed FROM uploads WHERE id=?',id).first();if(prior){if(prior.user_id!==user||prior.sha256!==data.sha256||prior.size!==data.size||prior.mime!==data.mime||prior.chunk_hashes!==JSON.stringify(data.chunkHashes))fail('已有同编号媒体，不能覆盖。',409);return json({id,completed:!!prior.completed},200);}
   await q('DELETE FROM uploads WHERE completed=0 AND created<?',now-24*60*60*1000).run();
   const reserved=await q('INSERT INTO uploads SELECT ?,?,?,?,?,?,?,?,0 WHERE (SELECT COALESCE(SUM(size),0) FROM uploads)+?<=? AND (SELECT COALESCE(SUM(size),0) FROM uploads WHERE user_id=?)+?<=?',id,user,JSON.stringify(page),data.mime,data.size,data.sha256,JSON.stringify(data.chunkHashes),now,data.size,300*1024*1024,user,data.size,128*1024*1024).run();
   if(reserved.meta.changes!==1)fail('免费空间已满，未产生付费或覆盖已有内容。',413);return json({id},201);
  }
  const part=path.match(/^\/uploads\/([a-zA-Z0-9_-]+)\/(\d+|complete)$/);
  if(part){
   const row=await ownedUpload(user,part[1]);if(row.completed&&part[2]==='complete')return json({ok:true,id:row.id});if(row.completed)fail('这份媒体已保存，不能改写。',409);
   if(part[2]!=='complete'&&request.method==='PUT'){
    const position=Number(part[2]),bytes=await readBytes(CHUNK);if(position>=Math.ceil(row.size/CHUNK)||bytes.byteLength!==Math.min(CHUNK,row.size-position*CHUNK))fail('媒体分块大小不一致。');
    if(await hash(bytes)!==JSON.parse(row.chunk_hashes)[position])fail('媒体分块摘要不一致，请重试。',409);
    if(position===0){const s=bytes,ascii=(a,b)=>new TextDecoder().decode(s.slice(a,b));const signatures={'image/png':s[0]===137&&ascii(1,4)==='PNG','image/jpeg':s[0]===255&&s[1]===216,'image/webp':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP','video/webm':s[0]===26&&s[1]===69&&s[2]===223&&s[3]===163,'video/mp4':ascii(4,8)==='ftyp'};if(!signatures[row.mime.split(';')[0]])fail('文件内容与声明格式不符。');}
    const key=mediaKey(row.id,position);
    if(env.MEDIA){await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:row.mime},customMetadata:{uploadId:row.id,position:String(position)}});await q('INSERT INTO chunk_meta(upload_id,position,storage_key,chunk_size) VALUES(?,?,?,?) ON CONFLICT(upload_id,position) DO UPDATE SET storage_key=excluded.storage_key,chunk_size=excluded.chunk_size',row.id,position,key,bytes.byteLength).run();}
    else await q('INSERT INTO chunks VALUES(?,?,?) ON CONFLICT(upload_id,position) DO UPDATE SET bytes=excluded.bytes',row.id,position,bytes.buffer).run();
    return json({ok:true});
   }
   if(part[2]==='complete'&&request.method==='POST'){
    const pieces=env.MEDIA?await q('SELECT COUNT(*) AS count,COALESCE(SUM(chunk_size),0) AS size FROM chunk_meta WHERE upload_id=?',row.id).first():await q('SELECT COUNT(*) AS count,COALESCE(SUM(length(bytes)),0) AS size FROM chunks WHERE upload_id=?',row.id).first();
    if(pieces.count!==Math.ceil(row.size/CHUNK)||pieces.size!==row.size)fail('媒体没有完整上传，请重试。',409);
    const page=JSON.parse(row.page);if(page.storageOnly){await q('UPDATE uploads SET completed=1 WHERE id=? AND user_id=?',row.id,user).run();return json({ok:true,id:row.id});}
    const reference=normalizeReference({url:page.url,title:page.title,captureMethod:page.captureMethod,attachments:[{id:'att-'+crypto.randomUUID(),mediaId:row.id,kind:row.mime.startsWith('video/')?'video':'image',mime:row.mime,size:row.size,duration:page.duration,name:row.mime.startsWith('video/')?'网页录制':'框选截图'}]});
    for(let retry=0;retry<4;retry++){
     if((await ownedUpload(user,row.id)).completed)return json({ok:true,id:row.id});
     const before=await q('SELECT body,revision FROM workspaces WHERE user_id=?',user).first(),next=addReference(JSON.parse(before.body),reference).state;
     const body=workspaceBody(next);
     const budget=await q('SELECT COALESCE(SUM(length(CAST(body AS BLOB))),0) AS size FROM workspaces WHERE user_id<>?',user).first();if(budget.size+text.encode(body).length>48*1024*1024)fail('首版免费空间的文字资料容量已满，请联系支持。',413);
     const results=await db.batch([q('UPDATE workspaces SET body=?,revision=revision+1 WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM uploads WHERE id=? AND completed=0) AND (SELECT COALESCE(SUM(length(CAST(body AS BLOB))),0) FROM workspaces WHERE user_id<>?)+length(CAST(? AS BLOB))<=?',body,user,before.revision,row.id,user,body,48*1024*1024),q('UPDATE uploads SET completed=1 WHERE id=? AND user_id=? AND EXISTS(SELECT 1 FROM workspaces WHERE user_id=? AND body=?)',row.id,user,user,body)]);
     if(results[0].meta.changes===1)return json({ok:true,id:row.id});
    }fail('另一页面正在保存，请重试。',409);
   }
  }
  const media=path.match(/^\/media\/([a-zA-Z0-9_-]+)(?:\/(\d+))?$/);
  if(media&&session.scope==='website'){
   const row=await ownedUpload(user,media[1]);if(!row.completed)fail('媒体尚未保存完整。',404);
   if(request.method==='GET'){if(media[2]===undefined)return json({mime:row.mime,size:row.size,sha256:row.sha256,chunkHashes:JSON.parse(row.chunk_hashes)});const meta=env.MEDIA?await q('SELECT storage_key FROM chunk_meta WHERE upload_id=? AND position=?',row.id,Number(media[2])).first():null;if(meta?.storage_key&&env.MEDIA){const object=await env.MEDIA.get(meta.storage_key);if(!object)fail('媒体分块不存在。',404);return new Response(object.body,{headers:{...headers,'Content-Type':'application/octet-stream','Cache-Control':'private, no-store'}});}const piece=await q('SELECT bytes FROM chunks WHERE upload_id=? AND position=?',row.id,Number(media[2])).first();if(!piece)fail('没有这个媒体分块。',404);return new Response(new Uint8Array(piece.bytes),{headers:{...headers,'Content-Type':'application/octet-stream','Cache-Control':'private, no-store'}});}
   if(request.method==='DELETE'&&media[2]===undefined){const workspace=await q('SELECT body FROM workspaces WHERE user_id=?',user).first();if(JSON.parse(workspace.body).references.some(r=>r.attachments.some(a=>a.mediaId===row.id)))fail('媒体仍被参考使用，请先移除对应附件。',409);if(env.MEDIA){const pieces=(await q('SELECT storage_key FROM chunk_meta WHERE upload_id=?',row.id).all()).results;for(const piece of pieces)await env.MEDIA.delete(piece.storage_key);}await q('DELETE FROM uploads WHERE id=? AND user_id=?',row.id,user).run();return json({ok:true});}
  }
  return json({error:'没有此接口。'},404);
 }catch(error){return json({error:error.status?error.message:'网站保存暂时失败，请稍后重试。'},error.status||500);}
}
