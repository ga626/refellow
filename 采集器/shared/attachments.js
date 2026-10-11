import {safeURL as cleanURL} from '../lib.js';
function referenceKey(value){const u=new URL(cleanURL(value));for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$)/i.test(key))u.searchParams.delete(key);u.searchParams.sort();return u.href;}
export const MEDIA_LIMIT = 12 * 1024 * 1024;
export const attachmentKinds = ['image', 'video', 'prompt', 'code', 'parameters', 'link', 'note'];
export const attachmentLabels = {image:'截图',video:'短录制',prompt:'原提示词',code:'代码资料',parameters:'效果参数',link:'官方入口',note:'补充说明'};
const text = (v, n) => String(v ?? '').slice(0, n);
export const validId = v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v) && !['__proto__','constructor','prototype'].includes(v);
export function normalizeAttachment(a) {
  if (!a || !attachmentKinds.includes(a.kind)) throw Error('附件类型不受支持。');
  const id = a.id || 'att-' + crypto.randomUUID();
  if (!validId(id)) throw Error('附件编号无效。');
  const out = {id, kind:a.kind, name:text(a.name || attachmentLabels[a.kind],120)};
  if (a.kind === 'image' || a.kind === 'video') {
    if (!validId(a.mediaId) || !Number.isInteger(a.size) || a.size < 1 || a.size > MEDIA_LIMIT) throw Error('媒体附件无效或超过12MB。');
    const allowed = a.kind === 'image' ? /^image\/(png|jpeg|webp)$/ : /^video\/(webm|mp4)(;codecs=[a-zA-Z0-9., -]+)?$/;
    if (!allowed.test(a.mime || '')) throw Error('媒体格式不受支持。');
    Object.assign(out, {mediaId:a.mediaId, mime:a.mime, size:a.size});
    if (a.kind === 'video') out.duration = Math.max(0, Math.min(120, Number(a.duration) || 0));
  } else if (a.kind === 'link') out.url = cleanURL(text(a.url,2049));
  else {
    out.content = text(a.content,30000);
    if (!out.content.trim()) throw Error('请填写附件内容。');
  }
  return out;
}
export function normalizeAttachments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 40) throw Error('每份参考最多40个附件。');
  const out = value.map(normalizeAttachment);
  if (new Set(out.map(a => a.id)).size !== out.length) throw Error('附件编号重复。');
  return out;
}
export function mergeAttachments(old = [], incoming = []) {
  const result = [...old];
  for (const a of incoming) {
    if (!result.some(x => x.id === a.id || (x.kind === a.kind && (a.mediaId ? x.mediaId === a.mediaId : a.url ? x.url === a.url : x.content === a.content)))) result.push(a);
  }
  return normalizeAttachments(result);
}
export function normalizeProvenance(raw = {}, url) {
  return {discoveryURL:raw.discoveryURL ? cleanURL(text(raw.discoveryURL,2049)) : '',
    referenceURL:cleanURL(url), sourceName:text(raw.sourceName,120),
    recipeId:text(raw.recipeId || 'generic',100), section:text(raw.section,120)};
}
export function normalizeAnnotations(value = []) {
  if (!Array.isArray(value) || value.length > 30) throw Error('每份参考最多30处标记。');
  return value.map(a => {
    const id = a.id || 'mark-' + crypto.randomUUID();
    if (!validId(id) || (a.attachmentId && a.attachmentId !== 'legacy-image' && !validId(a.attachmentId))) throw Error('标记编号无效。');
    const rect = ['x','y','w','h'].map(k=>Number(a[k]));
    if (rect.some(n=>!Number.isFinite(n)||n<0||n>1) || rect[2] < .005 || rect[3] < .005 || rect[0]+rect[2]>1.001 || rect[1]+rect[3]>1.001) throw Error('圈选范围无效。');
    return {id,attachmentId:a.attachmentId || 'legacy-image',x:rect[0],y:rect[1],w:rect[2],h:rect[3],label:text(a.label,500)};
  });
}
export function normalizeClip(clip) {
  if (!clip) return undefined;
  const start=Number(clip.start), end=Number(clip.end);
  if (!validId(clip.attachmentId) || !Number.isFinite(start) || !Number.isFinite(end) || start<0 || end<=start || end>120) throw Error('片段时间无效：结束应大于开始，且不超过120秒。');
  return {attachmentId:clip.attachmentId,start,end};
}
export function sameReference(a,b) {return referenceKey(a.url) === referenceKey(b.url);}
