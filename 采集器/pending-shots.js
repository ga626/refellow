// MV3后台会休眠；框选中的画面只作临时缓冲，保存/取消后删除。
let opening;
function database(){return opening??=new Promise((resolve,reject)=>{const r=indexedDB.open('refellow-pending-shots/v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('shots',{keyPath:'ticket'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opening=null;reject(Error('临时截图缓冲无法打开，请重试。'));};});}
async function operation(mode,fn){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('shots',mode);let result;const r=fn(tx.objectStore('shots'));r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(Error('临时截图缓冲失败，请重新截图。'));});}
export async function readPendingShot(ticket){const shot=await operation('readonly',s=>s.get(ticket));if(shot?.expires<Date.now()){await removePendingShot(ticket);return undefined;}return shot;}
export const removePendingShot=ticket=>operation('readwrite',s=>s.delete(ticket));
export async function clearExpiredShots(){const items=await operation('readonly',s=>s.getAll());for(const shot of items)if(shot.expires<Date.now())await removePendingShot(shot.ticket);}
export async function savePendingShot(shot){
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('shots','readwrite'),store=tx.objectStore('shots'),r=store.getAll();r.onsuccess=()=>{const items=r.result.filter(v=>v.expires>Date.now()&&v.page.tabId!==shot.page.tabId);for(const v of r.result)if(!items.includes(v))store.delete(v.ticket);while(items.length>=3)store.delete(items.shift().ticket);store.put(shot);};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(Error('截图缓冲空间不足，请重试。'));});
}
