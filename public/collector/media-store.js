import {MEDIA_LIMIT, validId} from './attachments.js';
const DB = 'inspiration-media/v1'; // 主站与扩展分别按origin隔离。
// 工作台最多500份参考，每份40附件；导入与导出使用同一数量合同。
export const MEDIA_PACKAGE_COUNT_LIMIT = 500 * 40;
let opening;
let mediaBackend=null;
export function setMediaBackend(backend){mediaBackend=backend;}
function database() {
  if (!globalThis.indexedDB) return Promise.reject(Error('浏览器不允许媒体存储，请检查权限后重试。'));
  if (!opening) opening = new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore('media',{keyPath:'id'});
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
    req.onerror=()=>{opening=null;reject(Error('媒体数据库打不开；原收藏未覆盖。'));};
    req.onblocked=()=>{opening=null;reject(Error('媒体数据库被另一页占用，请关闭旧的采集预览后重试。'));};
  });
  return opening;
}
async function transaction(mode, fn) {
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction('media',mode);let value;
    tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(Error('媒体存储失败，可能空间不足；请先备份。'));
    try {const req=fn(tx.objectStore('media'));if(req)req.onsuccess=()=>{value=req.result;};} catch(err){tx.abort();reject(err);}
  });
}
export async function validateBlob(blob) {
  if (!(blob instanceof Blob) || blob.size<1 || blob.size>MEDIA_LIMIT) throw Error('媒体不能为空，且每份不超过64MB。');
  const b=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  const mime=blob.type.split(';')[0];
  const match = mime==='image/png' ? b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71 :
    mime==='image/jpeg' ? b[0]===255&&b[1]===216 :
    mime==='image/webp' ? String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP' :
    mime==='video/webm' ? b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163 :
    mime==='video/mp4' ? String.fromCharCode(...b.slice(4,8))==='ftyp' : false;
  if (!match) throw Error('媒体内容与文件格式不符；仅支持 PNG/JPEG/WebP、WebM/MP4。');
  return blob;
}
export async function putMedia(blob,id='media-'+crypto.randomUUID()) {
  await validateBlob(blob);if(!validId(id))throw Error('媒体编号无效。');
  if(mediaBackend)return mediaBackend.put(blob,id);
  const previous=await getMedia(id);
  if(previous){if(previous.size!==blob.size||previous.type!==blob.type||await digest(previous)!==await digest(blob))throw Error('同编号媒体不同，拒绝覆盖。');return id;}
  await transaction('readwrite',s=>s.add({id,blob}));return id;
}
export async function getMedia(id) {return mediaBackend?mediaBackend.get(id):(await transaction('readonly',s=>s.get(id)))?.blob;}
export async function getLegacyMedia(id){return (await transaction('readonly',s=>s.get(id)))?.blob;}
export const deleteMedia=id=>mediaBackend?mediaBackend.remove(id):transaction('readwrite',s=>s.delete(id));
export async function digest(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
export async function blobBase64(blob) {const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(binary);}
export function fromBase64(raw) {
  if (!raw || !validId(raw.id) || typeof raw.data!=='string' || raw.data.length>MEDIA_LIMIT*1.4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw.data) || raw.data.length%4!==0) throw Error('备份媒体数据无效。');
  const data=atob(raw.data), bytes=Uint8Array.from(data,c=>c.charCodeAt(0));
  return new Blob([bytes],{type:raw.mime});
}
export async function packMedia(references,read=getMedia) {
  const output=[];const seen=new Set();let size=0;
  for(const r of references)for(const a of r.attachments||[]){
    if(!a.mediaId||seen.has(a.mediaId))continue;seen.add(a.mediaId);
    if(seen.size>MEDIA_PACKAGE_COUNT_LIMIT)throw Error('媒体数量超过工作台上限。');
    const blob=await read(a.mediaId);
    if(!blob||blob.size!==a.size||blob.type!==a.mime)throw Error('“'+a.name+'”媒体缺失或不一致；未导出空壳备份。');
    size+=blob.size;if(size>60*1024*1024)throw Error('本次媒体超过60MB，请按项目分别导出。');
    output.push({id:a.mediaId,mime:blob.type,data:await blobBase64(blob)});
  }return output;
}
export async function inspectMediaPackage(references,raw,read=getMedia) {
  if(!Array.isArray(raw)||raw.length>MEDIA_PACKAGE_COUNT_LIMIT)throw Error('媒体包结构无效或数量超过工作台上限。');
  const expected=new Map();for(const r of references)for(const a of r.attachments||[])if(a.mediaId){const prior=expected.get(a.mediaId);if(prior&&(prior.size!==a.size||prior.mime!==a.mime))throw Error('媒体编号合同冲突。');expected.set(a.mediaId,a);}
  if(expected.size>MEDIA_PACKAGE_COUNT_LIMIT)throw Error('媒体数量超过工作台上限。');
  const result=[];const seen=new Set();let total=0;
  for(const item of raw){if(!item||seen.has(item.id)||!expected.has(item.id))throw Error('媒体编号重复或不属于该包。');seen.add(item.id);
    const blob=await validateBlob(fromBase64(item));const a=expected.get(item.id);
    if(blob.size!==a.size||blob.type!==a.mime)throw Error('媒体元数据与实际内容不符。');
    total+=blob.size;if(total>60*1024*1024)throw Error('媒体包超过60MB。');
    const existing=await read(item.id);if(existing&&await digest(existing)!==await digest(blob))throw Error('同编号媒体内容冲突；原文件未覆盖。');
    result.push({id:item.id,blob});
  }
  for(const [id,a] of expected)if(!seen.has(id)){const blob=await read(id);if(!blob||blob.size!==a.size||blob.type!==a.mime)throw Error('缺少媒体“'+a.name+'”，请导入带文件的完整包。');}
  return result;
}
export async function stageMedia(items) {
  const backend=mediaBackend,identity=backend?.identity?.();const assertIdentity=()=>{if(backend!==mediaBackend||identity!==backend?.identity?.())throw Error('账户已改变，请重新导入。');};const created=[];try{for(const {id,blob} of items){assertIdentity();const existing=await getMedia(id);assertIdentity();if(!existing){await putMedia(blob,id);assertIdentity();created.push(id);}}}
  catch(err){if(backend===mediaBackend&&identity===backend?.identity?.())await Promise.all(created.map(deleteMedia));throw err;}
  return async()=>{assertIdentity();await Promise.all(created.map(deleteMedia));};
}
