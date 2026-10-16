import {captureRecord,referenceKey} from './core.js';
import {normalizeAttachments,normalizeProvenance,mergeAttachments} from './shared/attachments.js';
import {packMedia,stageMedia} from './shared/media-store.js';
export const INBOX='inspiration-collector/inbox-v1';
export const CONTEXT='inspiration-collector/context-v1';
export const extension=!!globalThis.chrome?.runtime?.id;
export async function readStorage(key,fallback){if(extension)return (await chrome.storage.local.get(key))[key]??fallback;try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{throw Error('本地收件箱读取失败，未覆盖原数据。');}}
export async function writeStorage(key,value){if(extension)await chrome.storage.local.set({[key]:value});else localStorage.setItem(key,JSON.stringify(value));}
export function continuousRecord(raw){const old=captureRecord({...raw,tags:Array.isArray(raw.tags)?raw.tags.join(','):raw.tags});return {...old,id:raw.id||'capture-'+crypto.randomUUID(),attachments:normalizeAttachments(raw.attachments),provenance:normalizeProvenance(raw.provenance,old.url),capturedAt:raw.capturedAt||old.capturedAt,captureMethod:raw.captureMethod||old.captureMethod};}
export function mergeInbox(items,raw){
  if(!Array.isArray(items))throw Error('收件箱数据损坏。');const incoming=continuousRecord(raw),next=items.map(x=>({...x}));
  const found=next.find(r=>referenceKey(r.url)===referenceKey(incoming.url));
  if(found){found.attachments=mergeAttachments(found.attachments,incoming.attachments);if(!found.screenshot&&incoming.screenshot)found.screenshot=incoming.screenshot;else if(found.screenshot&&incoming.screenshot&&found.screenshot!==incoming.screenshot)throw Error('已有截图，请以图片附件追加，原记录未覆盖。');}
  else next.unshift(incoming);
  if(next.length>50||new TextEncoder().encode(JSON.stringify(next)).length>4*1024*1024)throw Error('收件箱已达50条或4MB文字容量，请先导出整理。');return next;
}
let saving=Promise.resolve();
export function saveCapture(raw,media=[]){
  const run=async()=>{const before=await readStorage(INBOX,[]),next=mergeInbox(before,raw);const rollback=await stageMedia(media);try{await writeStorage(INBOX,next);}catch(err){await rollback();throw err;}return next;};
  const job=saving.then(()=>globalThis.navigator?.locks?navigator.locks.request('inspiration-collector-save',run):run());
  saving=job.catch(()=>{});return job;
}
export async function exportInbox(items){return {schema:'inspiration-capture-batch/v1',exportedAt:new Date().toISOString(),items:items.map(continuousRecord),media:await packMedia(items)};}
