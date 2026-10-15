import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export const repository='ga626/refellow';
export const project='refellow';
export const accountId='e64e6cc040bfc0ddc75fea29157a9217';
export const environments={
  preview:{branch:'preview',origin:'https://preview.refellow.pages.dev',database:'2710d71f-47ad-423e-860d-8227ea4c0840'},
  production:{branch:'main',origin:'https://refellow.pages.dev',database:'259f91b0-4364-4e58-9e28-df20f8354221'}
};
const sha=b=>createHash('sha256').update(b).digest('hex');
const commit=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const json=async p=>{const s=await lstat(p);requireThat(s.isFile()&&!s.isSymbolicLink(),'候选元数据不允许链接');return JSON.parse(await readFile(p,'utf8'));};
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const sameIdentity=(a,b)=>a?.repository===b.repository&&a?.sourceCommit===b.sourceCommit&&a?.pullRequest===b.pullRequest;

export function assertExecutionScope(options){
  requireThat(Object.hasOwn(environments,options.target),'部署环境只能是 preview 或 production');
  requireThat(options.target!=='preview'||!options.closeout,'开发部署不接受正式收口参数');
  if(options.execute&&options.target==='production')requireThat(options.closeout===true,'正式上传仅限用户明确要求的 PR 收口；需要 --closeout，普通开发禁止更新正式版');
}

export function assertRun(run){
  requireThat(run.repository?.full_name===repository&&run.head_repository?.full_name===repository,'仅允许本仓库的候选，拒绝 fork');
  requireThat(run.path?.split('@')[0]==='.github/workflows/quality.yml'&&run.event==='pull_request','候选必须来自产品 PR 的 quality 工作流');
  requireThat(run.status==='completed'&&run.conclusion==='success'&&commit(run.head_sha),'候选 CI 尚未成功');
}
export function selectArtifact(listing,run,expected){
  const name='refellow-candidate-'+run.head_sha;
  requireThat(Number.isInteger(listing.total_count)&&listing.total_count<=100&&Array.isArray(listing.artifacts),'CI 制品列表无效或未完整读取');
  const found=listing.artifacts.filter(a=>a.name===name&&!a.expired);
  requireThat(found.length===1&&Number.isSafeInteger(found[0].id)&&found[0].id>0,'成功 CI 的不可变候选不存在、过期或不唯一；禁止本地重建替代');
  const artifact=found[0];
  if(expected)requireThat(artifact.id===expected.id&&artifact.digest===expected.digest,'下载期间 CI 候选被替换，已停止部署');
  return artifact;
}
export function assertPolicy({target,receipt,run,pr,main,source,approvedPackageHash}){
  requireThat(Object.hasOwn(environments,target),'部署环境只能是 preview 或 production');
  assertRun(run);
  requireThat(receipt.repository===repository&&receipt.sourceCommit===run.head_sha,'候选与 CI 源码不一致');
  requireThat(pr.number===receipt.pullRequest&&pr.head?.sha===receipt.sourceCommit&&pr.head?.repo?.full_name===repository&&pr.base?.repo?.full_name===repository&&pr.base.ref==='main','候选不是该 PR 的最新代码或目标不是 main');
  requireThat(pr.state==='open'||pr.merged===true,'PR 已关闭且未合并');
  if(target==='production'){
    requireThat(pr.merged===true&&commit(pr.merge_commit_sha),'正式部署拒绝：PR 尚未合并 main');
    requireThat(main?.sha===pr.merge_commit_sha,'正式部署拒绝：该 PR 不是当前 main，请重新准备候选');
    requireThat(source?.sha===receipt.sourceCommit&&commit(source?.commit?.tree?.sha)&&source.commit.tree.sha===main?.commit?.tree?.sha,'正式部署拒绝：main 内容与已验候选不同');
    requireThat(digest(approvedPackageHash)&&approvedPackageHash===receipt.pagesPackageHash,'正式部署需要明确确认开发版验收的完整包摘要');
  }
  return {...environments[target],target,sourceCommit:receipt.sourceCommit,pullRequest:receipt.pullRequest,packageHash:receipt.pagesPackageHash};
}
export function assertProject(settings){
  requireThat(settings?.name===project&&settings.production_branch==='main','Cloudflare 正式分支必须为 main，已停止以防误发正式版');
  for(const [name,expected] of Object.entries(environments)){
    requireThat(settings.deployment_configs?.[name]?.d1_databases?.DB?.id===expected.database,'Cloudflare '+name+' 数据库绑定不符合固定环境');
  }
}

export async function verifyCandidate(directory){
  const stat=await lstat(directory);requireThat(stat.isDirectory()&&!stat.isSymbolicLink(),'候选根目录不能是链接');
  const receipt=await json(path.join(directory,'receipt.json'));
  requireThat(receipt.schema==='refellow-candidate/v1'&&receipt.repository===repository&&commit(receipt.sourceCommit)&&Number.isInteger(receipt.pullRequest)&&receipt.pullRequest>0&&/^\d+\.\d+\.\d+$/.test(receipt.version)&&digest(receipt.pagesPackageHash)&&digest(receipt.collectorSha256),'候选身份不完整');
  const manifest=await json(path.join(directory,'pages-manifest.json'));
  requireThat(manifest.schema==='inspiration-pages-package/v1'&&sameIdentity(manifest.sourceIdentity,receipt)&&manifest.packageHash===receipt.pagesPackageHash&&Array.isArray(manifest.files),'网站 manifest 与候选不一致');
  const files=await verifyPagesPackage(path.join(directory,'pages'),manifest,receipt);
  const zipPath=path.join(directory,'refellow-collector-'+receipt.version+'.zip'),zipStat=await lstat(zipPath);
  requireThat(zipStat.isFile()&&!zipStat.isSymbolicLink(),'扩展候选不允许链接');
  const zip=await readFile(zipPath);
  requireThat(zip.length===receipt.collectorBytes&&sha(zip)===receipt.collectorSha256&&files.get('assets/collector.zip')?.equals(zip),'扩展下载包与候选不一致');
  return {receipt,manifest};
}

export async function verifyBranchBuild(directory,manifestPath,sourceCommit){
  const manifest=await json(manifestPath),identity=manifest.sourceIdentity;
  requireThat(manifest.schema==='inspiration-pages-package/v1'&&Array.isArray(manifest.files)&&digest(manifest.packageHash),'开发包 manifest 不完整');
  requireThat(commit(sourceCommit)&&identity?.repository===repository&&identity.sourceCommit===sourceCommit&&identity.pullRequest===null,'开发包必须绑定当前干净提交，且不冒充 PR 候选');
  await verifyPagesPackage(directory,manifest,{...identity,pagesPackageHash:manifest.packageHash});
  return manifest;
}

async function verifyPagesPackage(directory,manifest,receipt){
  const actual=await walk(directory);
  const names=new Set(),files=new Map();
  for(const entry of manifest.files){
    requireThat(typeof entry.path==='string'&&/^[a-zA-Z0-9_./-]+$/.test(entry.path)&&!entry.path.startsWith('/')&&!entry.path.split('/').some(p=>!p||p==='.'||p==='..')&&!names.has(entry.path),'网站候选路径无效或重复');
    names.add(entry.path);
    const file=path.join(directory,entry.path),st=await lstat(file);
    requireThat(st.isFile()&&!st.isSymbolicLink(),'网站候选不允许链接');
    const bytes=await readFile(file);
    requireThat(bytes.length===entry.bytes&&sha(bytes)===entry.sha256,'网站候选内容改变：'+entry.path);
    files.set(entry.path,bytes);
  }
  async function walk(dir,prefix=''){
    const found=[];const st=await lstat(dir);requireThat(st.isDirectory()&&!st.isSymbolicLink(),'网站候选不允许链接');
    for(const e of await readdir(dir,{withFileTypes:true})){
      requireThat(!e.isSymbolicLink(),'网站候选不允许链接');
      const name=prefix+e.name;
      if(e.isDirectory())found.push(...await walk(path.join(dir,e.name),name+'/'));else found.push(name);
    }
    return found;
  }
  requireThat(actual.length===names.size&&actual.every(n=>names.has(n)),'网站候选含额外文件');
  const packageHash=sha(Buffer.from([...files].filter(([n])=>n!=='release.json').sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>n+':'+sha(b)).join('\n')));
  requireThat(packageHash===receipt.pagesPackageHash,'网站包摘要不匹配');
  requireThat(sameIdentity(JSON.parse(files.get('source-identity.json')),receipt)&&JSON.parse(files.get('release.json')).packageHash===packageHash,'公开源码身份不匹配');
  return files;
}

export async function verifyOnline(origin,manifest,{fetchImpl=fetch}={}){
  const platform=new Set(['_headers','_worker.js','_routes.json']);
  const checks=[],canonicalRedirects=[];
  for(const file of manifest.files.filter(f=>!platform.has(f.path))){
    const address=origin+'/'+(file.path==='index.html'?'':file.path);
    let response=await fetchImpl(address,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(response.status===301||response.status===308){
      const location=response.headers.get('location'),target=location?new URL(location,address):null;
      requireThat(file.path.endsWith('.html')&&target?.href===origin+'/'+file.path.slice(0,-5),'在线候选出现非预期跳转：'+address);
      canonicalRedirects.push(file.path);
      response=await fetchImpl(target.href,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
    }
    const bytes=Buffer.from(await response.arrayBuffer());
    requireThat(response.status===200&&sha(bytes)===file.sha256,'在线候选不一致：'+origin+'/'+file.path);
    checks.push(file.path);
  }
  const home=await fetchImpl(origin+'/',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  requireThat(home.status===200&&home.headers.get('content-security-policy')?.includes("frame-ancestors 'none'")&&home.headers.get('x-content-type-options')==='nosniff'&&home.headers.get('x-frame-options')==='DENY','在线安全响应头不符合合同');
  const missing=await fetchImpl(origin+'/private-nonexistent-deployment-check',{redirect:'error',signal:AbortSignal.timeout(30000)});
  requireThat(missing.status===404,'在线未知路径未返回404');
  const status=await fetchImpl(origin+'/api/status',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  requireThat(status.status===200&&(await status.json()).ready===true,'在线账户空间尚未就绪');
  return {origin,packageHash:manifest.packageHash,checkedAt:new Date().toISOString(),publicFiles:checks.length,canonicalRedirects,pass:true};
}
