import {readFile,writeFile,mkdir,cp,rename,rm,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32} from '../public/collector/zip.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const exists=async f=>{try{return await lstat(f);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const safe=n=>typeof n==='string'&&/^[a-zA-Z0-9_./-]+$/.test(n)&&!n.startsWith('/')&&!n.split('/').some(p=>!p||p==='.'||p==='..');
export function unpackCollector(b){
 const files=new Map();let o=0;
 while(o+30<=b.length&&b.readUInt32LE(o)===0x04034b50){
  const size=b.readUInt32LE(o+18),ns=b.readUInt16LE(o+26),extra=b.readUInt16LE(o+28),n=b.subarray(o+30,o+30+ns).toString(),start=o+30+ns+extra,end=start+size;
  if(!safe(n)||files.has(n)||b.readUInt16LE(o+8)!==0||b.readUInt32LE(o+22)!==size||end>b.length)throw Error('ZIP结构或路径无效');
  const data=b.subarray(start,end);if(crc32(data)!==b.readUInt32LE(o+14))throw Error('ZIP内容损坏');files.set(n,data);o=end;
 }
 if(b.length<22||b.readUInt32LE(b.length-22)!==0x06054b50||files.size!==b.readUInt16LE(b.length-12)||o!==b.readUInt32LE(b.length-6))throw Error('ZIP不完整');
 return files;
}
async function managed(dir){
 const stat=await exists(dir);if(!stat)return false;
 if(stat.isSymbolicLink()||!stat.isDirectory()||(await json(path.join(dir,'acceptance.json'))).schema!=='refellow-local-acceptance/v1')throw Error('拒绝覆盖非受管目录：'+dir);
 return true;
}
export async function stageAcceptance(source,root){
 source=path.resolve(source);root=path.resolve(root);
 if(source===root||source.startsWith(root+path.sep))throw Error('源目录不能位于验收目录中');
 const r=await json(path.join(source,'receipt.json'));
 if(r.schema!=='refellow-candidate/v1'||r.repository!=='ga626/refellow'||!/^[a-f0-9]{40}$/.test(r.sourceCommit)||!Number.isInteger(r.pullRequest)||r.pullRequest<1||!/^([0-9]+[.]){2}[0-9]+$/.test(r.version))throw Error('候选须绑定源码和PR身份');
 const zipName='refellow-collector-'+r.version+'.zip',zip=await readFile(path.join(source,zipName));
 if(zip.length!==r.collectorBytes||hash(zip)!==r.collectorSha256)throw Error('候选ZIP摘要不匹配');
 const files=unpackCollector(zip),identity=JSON.parse(files.get('release-identity.json')),manifest=JSON.parse(files.get('manifest.json'));
 if(identity.kind!=='git-source-candidate'||identity.sourceCommit!==r.sourceCommit||identity.repository!==r.repository||identity.pullRequest!==r.pullRequest||identity.version!==r.version||manifest.version!==r.version)throw Error('扩展候选身份不一致');
 const pm=await json(path.join(source,'pages-manifest.json'));
 if(pm.packageHash!==r.pagesPackageHash||pm.sourceIdentity?.sourceCommit!==r.sourceCommit)throw Error('网站候选身份不一致');
 const names=new Set();for(const f of pm.files){if(!safe(f.path)||names.has(f.path))throw Error('网站路径无效');names.add(f.path);const b=await readFile(path.join(source,'pages',f.path));if(b.length!==f.bytes||hash(b)!==f.sha256)throw Error('网站候选摘要不匹配：'+f.path);}
 async function scan(dir,prefix=''){const found=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('候选不允许链接');const n=prefix+e.name;if(e.isDirectory())found.push(...await scan(path.join(dir,e.name),n+'/'));else found.push(n);}return found;}
 const actual=await scan(path.join(source,'pages'));if(actual.length!==names.size||actual.some(n=>!names.has(n)))throw Error('网站候选含额外文件');
 await mkdir(root,{recursive:true});if((await lstat(root)).isSymbolicLink())throw Error('验收根不能是链接');
 const current=path.join(root,'current'),previous=path.join(root,'previous'),next=path.join(root,'next'),hasCurrent=await managed(current),hasPrevious=await managed(previous);
 if(hasCurrent){const installed=await json(path.join(current,'acceptance.json'));if(installed.sourceCommit===r.sourceCommit&&installed.collectorSha256===r.collectorSha256){for(const f of installed.files){if(!safe(f.path)||hash(await readFile(path.join(current,'edge-extension',f.path)))!==f.sha256)throw Error('已加载目录内容变化，请核对身份');}return {...installed,reused:true};}}
 if(await exists(next))throw Error('上次准备未完成，请先检查 next 目录');
 await mkdir(next);const acceptance={...r,schema:'refellow-local-acceptance/v1',preparedAt:new Date().toISOString(),edgeDirectory:path.join(current,'edge-extension'),publication:'local-only; pending PR CI and user acceptance',files:[...files].map(([n,b])=>({path:n,sha256:hash(b),bytes:b.length}))};
 try{
  for(const [n,b] of files){const target=path.join(next,'edge-extension',n);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,b,{flag:'wx'});}
  await cp(source,path.join(next,'artifact'),{recursive:true});
  await writeFile(path.join(next,'acceptance.json'),JSON.stringify(acceptance,null,2));
  if(hasCurrent){if(hasPrevious)await rm(previous,{recursive:true});await rename(current,previous);}
  try{await rename(next,current);}catch(e){if(hasCurrent)await rename(previous,current);throw e;}
 }catch(e){await rm(next,{recursive:true,force:true});throw e;}
 return acceptance;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=await stageAcceptance('local/candidate','local/acceptance');
 console.log(JSON.stringify({version:r.version,sourceCommit:r.sourceCommit,collectorSha256:r.collectorSha256,edgeDirectory:r.edgeDirectory,reused:r.reused||false},null,2));
}
