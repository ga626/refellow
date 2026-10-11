import {safeURL,identity} from './lib.js';
import {normalizeAttachments,normalizeProvenance,normalizeAnnotations,normalizeClip,mergeAttachments,sameReference} from './collector/attachments.js';
export function groupMoveTarget(entries,refId,direction){const at=entries.findIndex(en=>en.refId===refId);if(at<0||![1,-1].includes(direction))return -1;for(let to=at+direction;to>=0&&to<entries.length;to+=direction)if(entries[to].group===entries[at].group)return to;return -1;}
export function moveEntryWithinGroup(entries,refId,direction){const next=entries.slice();const to=groupMoveTarget(entries,refId,direction);if(to<0)return next;const at=entries.findIndex(en=>en.refId===refId);[next[at],next[to]]=[next[to],next[at]];return next;}
export const KEY='inspiration-library/v2';
export const emptyState=()=>({schema:'inspiration-workspace/v2',siteSaved:[],siteRatings:{},customSites:[],customCategories:[],references:[],projects:[]});
const text=(x,max=2000)=>String(x??'').slice(0,max);
const list=(x,fallback=[])=>Array.isArray(x)?x:fallback;
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
export function imageData(value){if(!value)return '';if(typeof value!=='string'||value.length>650000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new Error('图片格式不受支持或太大，请使用较小的 PNG / JPEG / WebP 截图。');return value;}
export function normalizeReference(raw){if(!raw||typeof raw!=='object')throw new Error('参考格式无效。');const url=safeURL(text(raw.url,2049));const id=raw.id||'ref-'+crypto.randomUUID();if(!validId(id))throw new Error('参考编号无效。');const attachments=normalizeAttachments(raw.attachments);const annotations=normalizeAnnotations(raw.annotations);if(annotations.some(a=>a.attachmentId!=='legacy-image'&&!attachments.some(x=>x.id===a.attachmentId&&x.kind==='image')))throw Error('圈选没有对应截图。');return {id,name:text(raw.name||raw.title||new URL(url).hostname,120),url,source:text(raw.source||new URL(url).hostname,120),description:text(raw.description||raw.selection,3000),image:imageData(raw.image||raw.screenshot),capturedAt:text(raw.capturedAt||new Date().toISOString(),50),captureMethod:text(raw.captureMethod||'manual',80),selection:text(raw.selection,3000),avoid:text(raw.avoid,2000),categories:list(raw.categories).filter(validId).slice(0,20),tags:list(raw.tags).filter(x=>typeof x==='string').map(x=>text(x,40)).slice(0,20),licenseStatus:'not_verified',attachments,provenance:normalizeProvenance(raw.provenance,url),annotations};}
export function normalizeSite(raw,known=[]){if(!raw||typeof raw!=='object')throw new Error('网站格式无效。');const url=safeURL(text(raw.url,2049));if(known.some(x=>identity(x.url)===identity(url)))throw new Error('这个网站已经在目录中。');const id=raw.id||'site-'+crypto.randomUUID();if(!validId(id)||!id.startsWith('site-'))throw new Error('个人网站编号无效。');const categories=list(raw.categories).filter(validId).slice(0,20);return {id,name:text(raw.name||new URL(url).hostname,120),url,description:text(raw.description,2000),tagline:text(raw.tagline||'你加入的灵感来源',160),bestFor:text(raw.bestFor||'可在详情里继续补充用途',600),caveat:'个人加入，尚未验证费用、嵌入和素材许可。',categories,type:'个人来源',access:'未核验',embedStatus:'unknown',embedNote:'未经嵌入核验，可尝试；不保证显示。',image:imageData(raw.image),capturedAt:text(raw.capturedAt||new Date().toISOString(),50),previewKind:raw.image?'你的截图 · 静态预览':'尚未添加截图'};}
export function normalizeWorkspace(raw){
  if(!raw||raw.schema!=='inspiration-workspace/v2')throw Error('请导入参伴 v2 备份文件。');
  const out=emptyState();for(const key of ['siteSaved','references','projects','customSites','customCategories'])if(!Array.isArray(raw[key]))throw Error('备份结构不完整，原数据未改变。');
  if(raw.references.length>500||raw.projects.length>100||raw.customSites.length>200||raw.customCategories.length>100)throw Error('导入内容超过本地版本上限。');
  out.siteSaved=[...new Set(raw.siteSaved.filter(validId))];out.references=raw.references.map(normalizeReference);out.customSites=raw.customSites.map(x=>normalizeSite(x));
  out.customCategories=raw.customCategories.map(c=>{if(!c||!validId(c.id)||!c.id.startsWith('category-'))throw Error('个人分类编号无效。');return {id:c.id,name:text(c.name,40),description:text(c.description||'你的个人分类，可用于多个网站。',400)};});
  const ids=new Set(out.references.map(x=>x.id));
  out.projects=raw.projects.map(p=>{if(!p||!validId(p.id))throw Error('项目编号无效。');return {id:p.id,name:text(p.name,120),brief:text(p.brief,3000),groups:[...new Set(list(p.groups,['待整理']).filter(x=>typeof x==='string'&&x.trim()).map(x=>text(x,60)))].slice(0,30),entries:list(p.entries).filter(x=>x&&ids.has(x.refId)).slice(0,500).map(x=>({refId:x.refId,group:text(x.group||'待整理',60),role:['主方向','辅助','布局','动效','排版','配色','材质','交互'].includes(x.role)?x.role:'辅助',like:text(x.like,2000),avoid:text(x.avoid,2000),...(x.clip?{clip:normalizeClip(x.clip)}:{})}))};});
  for(const p of out.projects){if(!p.groups.length)p.groups=['待整理'];for(const en of p.entries)if(!p.groups.includes(en.group))en.group=p.groups[0];if(new Set(p.entries.map(x=>x.refId)).size!==p.entries.length)throw Error('项目包含重复参考。');}
  for(const k of ['references','projects','customSites','customCategories'])if(new Set(out[k].map(x=>x.id)).size!==out[k].length)throw Error('备份包含重复编号。');
  if(raw.siteRatings&&typeof raw.siteRatings==='object'&&!Array.isArray(raw.siteRatings))for(const [id,n] of Object.entries(raw.siteRatings))if(validId(id)&&Number.isFinite(n)&&n>=.5&&n<=5&&Number.isInteger(n*2))out.siteRatings[id]=n;
  return validateProjectClips(out);
}
export function loadWorkspace(storage){try{const raw=storage.getItem(KEY);if(raw)return {state:normalizeWorkspace(JSON.parse(raw)),error:null};return {state:emptyState(),error:null};}catch{return {state:emptyState(),error:'旧数据读取失败，已进入只读临时模式；原存储未覆盖。请先检查备份或存储权限。'};}}
export function migrateLegacy(old,cases,sites){const out=emptyState();if(!old)return out;out.siteSaved=list(old.saved).filter(x=>sites.some(s=>s.id===x));const chosen=new Set([...list(old.saved),...list(old.selected)]);for(const c of [...list(cases),...list(old.custom)]){if(!chosen.has(c.id))continue;try{out.references.push(normalizeReference({...c,image:'',captureMethod:'legacy_user_saved',description:old.notes?.[c.id]?.like||c.description}));}catch{}}if(out.references.length)out.projects=[{id:'project-legacy',name:'以前收藏的参考',brief:'从旧版本迁移的真实个人收藏，不是预填案例。',groups:['待整理'],entries:out.references.map(r=>({refId:r.id,group:'待整理',role:'辅助',like:old.notes?.[r.id]?.like||'',avoid:old.notes?.[r.id]?.avoid||''}))}];return out;}
export function mergeWorkspaces(current,incoming){
  const next=structuredClone(current),mapping=new Map();
  for(const r of incoming.references){const existing=next.references.find(x=>x.id===r.id||sameReference(x,r));if(existing){if(!sameReference(existing,r))throw Error('参考编号冲突，网址不同；原数据未覆盖。');existing.attachments=mergeAttachments(existing.attachments,r.attachments);if(!existing.image&&r.image)existing.image=r.image;mapping.set(r.id,existing.id);}else{next.references.push(r);mapping.set(r.id,r.id);}}
  for(const k of ['projects','customSites','customCategories']){const byId=new Map(next[k].map(x=>[x.id,x]));for(const x of incoming[k])if(!byId.has(x.id)){const record=structuredClone(x);if(k==='projects')record.entries.forEach(en=>en.refId=mapping.get(en.refId)||en.refId);byId.set(x.id,record);}next[k]=[...byId.values()];}
  next.siteSaved=[...new Set([...next.siteSaved,...incoming.siteSaved])];next.siteRatings={...incoming.siteRatings,...next.siteRatings};return normalizeWorkspace(next);
}
export function addReference(state,ref,projectId){const next=structuredClone(state);const incoming=normalizeReference(ref);let record=next.references.find(x=>sameReference(x,incoming));if(!record){record=incoming;next.references.push(record);}else {record.attachments=mergeAttachments(record.attachments,incoming.attachments);if(!record.image&&incoming.image)record.image=incoming.image;if(!record.provenance?.discoveryURL&&incoming.provenance.discoveryURL)record.provenance=incoming.provenance;}const project=next.projects.find(x=>x.id===projectId);if(project&&!project.entries.some(en=>en.refId===record.id))project.entries.push({refId:record.id,group:project.groups[0]||'待整理',role:'辅助',like:'',avoid:''});return {state:next,reference:record};}
export function projectText(project,references){return '项目：'+project.name+'\n目标：'+(project.brief||'待讨论')+'\n这是参考组合，不是资产许可或已完成设计。截图不能证明动效；短录制仅代表所录时段，参数以所附资料为准。\n先读真实画面和项目意图，再判断实现技术。只借鉴指定部分，不复制品牌、文案或无许可资产。\n\n'+project.entries.map((entry,i)=>{const r=references.find(r=>r.id===entry.refId);return (i+1)+'. '+r.name+'\n原页面：'+r.url+'\n发现出处：'+(r.provenance?.discoveryURL||'未另记')+'\n分组：'+entry.group+'；角色：'+entry.role+'\n喜欢：'+(entry.like||'待讨论')+'\n避免：'+(entry.avoid||'待讨论')+(entry.clip?'\n视频片段：'+entry.clip.start+'—'+entry.clip.end+'秒':'')+'\n圈选：'+(r.annotations||[]).map(a=>a.label||'未命名区域').join('、')+'\n附件：'+(r.attachments||[]).map(a=>a.name).join('、');}).join('\n\n');}
export function validateProjectClips(state){for(const p of state.projects)for(const en of p.entries)if(en.clip){const clip=normalizeClip(en.clip),r=state.references.find(r=>r.id===en.refId),a=r?.attachments?.find(a=>a.id===clip.attachmentId&&a.kind==='video');if(!a||a.duration>0&&clip.end>a.duration+.1)throw Error('项目片段没有对应视频，或超过视频长度。');en.clip=clip;}return state;}

export function removeReferencePart(current,refId,kind,id){
  const state=structuredClone(current),r=state.references.find(r=>r.id===refId);if(!r)throw Error('参考未找到。');
  const key=kind==='attachment'?'attachments':'annotations',index=r[key].findIndex(x=>x.id===id);if(index<0)throw Error('待移除内容未找到。');
  const receipt={refId,kind,index,item:structuredClone(r[key][index]),annotations:[],clips:[]};r[key].splice(index,1);
  if(kind==='attachment'){
    receipt.annotations=r.annotations.map((item,index)=>({item,index})).filter(x=>x.item.attachmentId===id);r.annotations=r.annotations.filter(x=>x.attachmentId!==id);
    for(const p of state.projects)for(const en of p.entries)if(en.refId===refId&&en.clip?.attachmentId===id){receipt.clips.push({projectId:p.id,clip:structuredClone(en.clip)});delete en.clip;}
  }
  return {state:normalizeWorkspace(state),receipt};
}
export function restoreReferencePart(current,receipt){
  const state=structuredClone(current),r=state.references.find(r=>r.id===receipt.refId);if(!r)throw Error('参考已移除，请先恢复这份参考。');
  const key=receipt.kind==='attachment'?'attachments':'annotations';if(!r[key].some(x=>x.id===receipt.item.id))r[key].splice(Math.min(receipt.index,r[key].length),0,structuredClone(receipt.item));
  for(const x of receipt.annotations)if(!r.annotations.some(a=>a.id===x.item.id))r.annotations.splice(Math.min(x.index,r.annotations.length),0,structuredClone(x.item));
  for(const x of receipt.clips){const en=state.projects.find(p=>p.id===x.projectId)?.entries.find(en=>en.refId===r.id);if(en&&!en.clip)en.clip=structuredClone(x.clip);}
  return normalizeWorkspace(state);
}

