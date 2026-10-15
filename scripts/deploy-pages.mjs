import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,mkdtemp,rm,open,cp,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {repository,project,accountId,environments,assertExecutionScope,assertRun,selectArtifact,assertPolicy,assertProject,verifyCandidate,verifyBranchBuild,verifyOnline} from './pages-deployment.mjs';
import {buildPages} from './build-pages.mjs';
const exec=promisify(execFile);
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const command=async (exe,args,cwd=root)=>(await exec(exe,args,{cwd,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:16*1024*1024})).stdout;
const api=async route=>JSON.parse(await command('gh',['api','repos/'+repository+'/'+route]));

export function parseOptions(args){
  const options={target:'preview',execute:false,closeout:false};
  const seen=new Set();
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--execute'){if(options.execute)throw Error('重复 --execute');options.execute=true;continue;}
    if(arg==='--closeout'){if(options.closeout)throw Error('重复 --closeout');options.closeout=true;continue;}
    const key={'--run':'run','--target':'target','--approve-preview':'approvedPackageHash'}[arg];
    if(!key||seen.has(key)||!args[i+1]||args[i+1].startsWith('--'))throw Error('无效或重复参数：'+arg);
    seen.add(key);
    options[key]=args[++i];
  }
  if(!Object.hasOwn(environments,options.target)||(options.run!==undefined&&(!/^\d+$/.test(options.run)||!Number.isSafeInteger(Number(options.run))||Number(options.run)<1))||(options.target==='production'&&!options.run))throw Error('开发默认使用当前分支干净提交；正式需要 --target production --run <成功的PR CI运行号>；默认只核对');
  if(options.target==='preview'&&options.approvedPackageHash)throw Error('开发部署不接受正式验收参数');
  assertExecutionScope(options);
  return options;
}
async function assertController(){
  const remote=(await command('git',['remote','get-url','origin'])).trim();
  if(!/^(?:https:\/\/github[.]com\/|git@github[.]com:)ga626\/refellow(?:[.]git)?$/.test(remote))throw Error('部署控制器仓库身份不匹配');
  await command('git',['ls-files','--error-unmatch','scripts/deploy-pages.mjs','scripts/pages-deployment.mjs']);
  if((await command('git',['status','--porcelain','--untracked-files=no'])).trim())throw Error('部署控制器必须来自干净提交；本地未提交改动不会上传');
  if(process.env.GITHUB_ACTIONS==='true'&&(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_REPOSITORY!==repository))throw Error('云端部署控制器只能从本仓库 main 手动触发');
}
let localToken;
async function platform(route){
  const account=process.env.CLOUDFLARE_ACCOUNT_ID||accountId;
  if(account!==accountId)throw Error('Cloudflare 账号与参伴固定部署账号不符');
  let token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token&&process.env.GITHUB_ACTIONS!=='true'){
    if(!localToken){
      try{const credential=JSON.parse(await command(process.execPath,[await officialWrangler(),'auth','token','--json'],tmpdir()));localToken=credential.token;if(typeof localToken!=='string'||!localToken)throw Error();}
      catch{throw Error('现有官方 Wrangler 登录不可用；不读取认证文件、不输出秘密');}
    }
    token=localToken;
  }
  if(!token)throw Error('缺少 Cloudflare 部署环境凭据，已停止');
  const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+project+route,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Cloudflare 配置核对失败：HTTP '+response.status);
  const body=await response.json();if(body.success!==true)throw Error('Cloudflare 拒绝配置核对');return body.result;
}
async function officialWrangler(){
  const wrangler=process.env.REFELLOW_WRANGLER_JS;
  if(!wrangler||!path.isAbsolute(wrangler))throw Error('请指定现有官方 Wrangler 的绝对脚本路径 REFELLOW_WRANGLER_JS；不会自动安装');
  await readFile(wrangler);return wrangler;
}
async function releaseIdentity(origin){
  const response=await fetch(origin+'/release.json',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(response.status!==200)throw Error('正式版身份读取失败，停止开发部署');
  return response.text();
}
async function cleanBranch(){
  await assertController();
  const branch=(await command('git',['branch','--show-current'])).trim();
  if(!branch.startsWith('codex/'))throw Error('日常开发部署只能来自 codex/ 分支，不能在 main 或游离提交上传');
  return {branch,sourceCommit:(await command('git',['rev-parse','HEAD'])).trim()};
}

export async function deployBranchPreview(options){
  if(options.target!=='preview'||options.run||options.closeout||options.approvedPackageHash||process.env.GITHUB_ACTIONS==='true')throw Error('分支开发入口只能更新 preview；正式版必须走 PR 收口');
  if(process.env.REFELLOW_PR_NUMBER)throw Error('日常分支开发不使用 REFELLOW_PR_NUMBER，不能冒充 PR 候选');
  const source=await cleanBranch(),built=await buildPages();
  await verifyBranchBuild(built.directory,built.manifestPath,source.sourceCommit);
  const operation={schema:'refellow-branch-preview-deployment/v1',kind:'branch-development',target:'preview',branch:'preview',developmentBranch:source.branch,origin:environments.preview.origin,repository,sourceCommit:source.sourceCommit,pullRequest:null,packageHash:built.packageHash,state:'dry-run',checkedAt:new Date().toISOString()};
  if(!options.execute){console.log(JSON.stringify(operation,null,2));return operation;}
  const wrangler=await officialWrangler(),temporary=await mkdtemp(path.join(tmpdir(),'refellow-pages-deployment-'));
  const receiptPath=path.join(root,'local/verification/pages-deployment/preview.json');
  const save=async()=>{await mkdir(path.dirname(receiptPath),{recursive:true});await writeFile(receiptPath,JSON.stringify(operation,null,2)+String.fromCharCode(10));};
  let lock;
  try{
    await mkdir(path.join(root,'local/runtime'),{recursive:true});
    lock=await open(path.join(root,'local/runtime/pages-deployment.lock'),'wx');
    await lock.writeFile(JSON.stringify({pid:process.pid,target:'preview',sourceCommit:source.sourceCommit}));
    const pages=path.join(temporary,'pages'),manifestPath=path.join(temporary,'pages-manifest.json');
    await cp(built.directory,pages,{recursive:true});await copyFile(built.manifestPath,manifestPath);
    const manifest=await verifyBranchBuild(pages,manifestPath,source.sourceCommit);
    const settings=await platform('');assertProject(settings);
    const before=await releaseIdentity(environments.production.origin);
    operation.productionBefore={deploymentId:settings.canonical_deployment?.id||null,release:JSON.parse(before)};
    const current=await cleanBranch();
    if(current.branch!==source.branch||current.sourceCommit!==source.sourceCommit)throw Error('开发源码在核对期间发生变化，停止上传');
    assertProject(await platform(''));
    await verifyBranchBuild(pages,manifestPath,source.sourceCommit);
    operation.state='upload-requested';await save();
    await command(process.execPath,[wrangler,'pages','deploy',pages,'--project-name',project,'--branch','preview','--commit-hash',source.sourceCommit,'--commit-dirty=false','--install-skills=false'],temporary);
    operation.state='uploaded-awaiting-verification';await save();
    operation.onlineVerification=await verifyOnline(environments.preview.origin,manifest);
    const [deployments,afterSettings,after]=await Promise.all([platform('/deployments?per_page=10'),platform(''),releaseIdentity(environments.production.origin)]);
    assertProject(afterSettings);
    const deployment=deployments.find(d=>d.environment==='preview'&&d.deployment_trigger?.metadata?.branch==='preview'&&d.deployment_trigger?.metadata?.commit_hash===source.sourceCommit);
    if(!deployment)throw Error('没有查到对应开发源码的 Preview 部署');
    if(before!==after||settings.canonical_deployment?.id!==afterSettings.canonical_deployment?.id)throw Error('开发部署期间正式版发生变化，停止并核对其他发布入口');
    operation.deploymentId=deployment.id;operation.productionUnchanged=true;operation.state='verified';operation.completedAt=new Date().toISOString();await save();
    console.log(JSON.stringify(operation,null,2));return operation;
  }catch(error){
    operation.state=operation.state==='upload-requested'?'upload-result-unknown':operation.state==='uploaded-awaiting-verification'?'published-verification-failed':'failed';operation.error=error.message;await save();throw error;
  }finally{
    if(lock){await lock.close();await rm(path.join(root,'local/runtime/pages-deployment.lock'));}
    if(path.dirname(path.resolve(temporary))!==path.resolve(tmpdir())||!path.basename(temporary).startsWith('refellow-pages-deployment-'))throw Error('临时目录身份不符，停止清理');
    await rm(temporary,{recursive:true});
  }
}
async function facts(receipt,target){
  const [pr,main,source]=await Promise.all([api('pulls/'+receipt.pullRequest),target==='production'?api('commits/main'):null,target==='production'?api('commits/'+receipt.sourceCommit):null]);
  return {pr,main,source};
}
export async function deploy(options){
  assertExecutionScope(options);
  if(!options.run)return deployBranchPreview(options);
  if(options.execute)await assertController();
  const run=await api('actions/runs/'+options.run);assertRun(run);
  const artifactName='refellow-candidate-'+run.head_sha;
  const listing=await api('actions/runs/'+options.run+'/artifacts?per_page=100');
  const frozenArtifact=selectArtifact(listing,run);
  const temporary=await mkdtemp(path.join(tmpdir(),'refellow-pages-deployment-'));
  let lock,operation;
  const receiptPath=path.join(root,'local/verification/pages-deployment',options.target+'.json');
  const save=async()=>{await mkdir(path.dirname(receiptPath),{recursive:true});await writeFile(receiptPath,JSON.stringify(operation,null,2)+'\n');};
  try{
    const artifact=path.join(temporary,'candidate');await mkdir(artifact);
    await command('gh',['run','download',options.run,'--repo',repository,'--name',artifactName,'--dir',artifact]);
    selectArtifact(await api('actions/runs/'+options.run+'/artifacts?per_page=100'),run,frozenArtifact);
    const {receipt,manifest}=await verifyCandidate(artifact);
    const github=await facts(receipt,options.target);
    const plan=assertPolicy({...options,...github,receipt,run});
    let preview=null;
    if(options.target==='production')preview=await verifyOnline(environments.preview.origin,manifest);
    operation={schema:'refellow-pages-deployment/v1',target:plan.target,branch:plan.branch,origin:plan.origin,repository,sourceCommit:receipt.sourceCommit,pullRequest:receipt.pullRequest,packageHash:receipt.pagesPackageHash,ciRun:Number(options.run),artifactId:frozenArtifact.id,artifactDigest:frozenArtifact.digest||null,previewVerification:preview,previewApproval:options.approvedPackageHash?{packageHash:options.approvedPackageHash,method:'explicit-operator-argument',actor:process.env.GITHUB_ACTOR||'local-operator'}:null,state:options.execute?'preflight':'dry-run',checkedAt:new Date().toISOString()};
    if(!options.execute){console.log(JSON.stringify(operation,null,2));return operation;}
    await mkdir(path.join(root,'local/runtime'),{recursive:true});
    lock=await open(path.join(root,'local/runtime/pages-deployment.lock'),'wx');
    await lock.writeFile(JSON.stringify({pid:process.pid,target:plan.target,sourceCommit:receipt.sourceCommit}));
    assertProject(await platform(''));
    if(options.target==='production'){
      const localHead=(await command('git',['rev-parse','HEAD'])).trim();
      if(localHead!==github.main.sha)throw Error('正式控制器必须位于当前 main 提交');
    }
    const wrangler=await officialWrangler();
    const before=options.target==='preview'?await (await fetch(environments.production.origin+'/release.json',{cache:'no-store',signal:AbortSignal.timeout(30000)})).text():null;
    assertPolicy({...options,...await facts(receipt,options.target),receipt,run:await api('actions/runs/'+options.run)});
    await verifyCandidate(artifact);
    operation.state='upload-requested';await save();
    // 独立临时 cwd 无 Wrangler 配置：沿用后台的原 DB 和秘密，不重写绑定或迁移数据。
    await command(process.execPath,[wrangler,'pages','deploy',path.join(artifact,'pages'),'--project-name',project,'--branch',plan.branch,'--commit-hash',receipt.sourceCommit,'--commit-dirty=false','--install-skills=false'],temporary);
    operation.state='uploaded-awaiting-verification';await save();
    operation.onlineVerification=await verifyOnline(plan.origin,manifest);
    const deployments=await platform('/deployments?per_page=10');
    const matched=deployments.find(d=>d.environment===plan.target&&d.deployment_trigger?.metadata?.branch===plan.branch&&d.deployment_trigger?.metadata?.commit_hash===receipt.sourceCommit);
    if(!matched)throw Error('Cloudflare 未返回匹配源码与环境的部署身份');
    operation.deploymentId=matched.id;
    if(options.target==='preview'){
      const after=await (await fetch(environments.production.origin+'/release.json',{cache:'no-store',signal:AbortSignal.timeout(30000)})).text();
      if(after!==before)throw Error('开发部署期间正式版身份发生变化，请检查其他发布入口');
    }
    operation.state='verified';operation.completedAt=new Date().toISOString();await save();
    console.log(JSON.stringify(operation,null,2));return operation;
  }catch(error){
    if(operation&&options.execute){operation.state=operation.state==='uploaded-awaiting-verification'?'published-verification-failed':operation.state==='upload-requested'?'upload-result-unknown':'failed';operation.error=error.message;await save();}
    throw error;
  }finally{
    if(lock){await lock.close();await rm(path.join(root,'local/runtime/pages-deployment.lock'));}
    const resolved=path.resolve(temporary),parent=path.resolve(tmpdir());
    if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('refellow-pages-deployment-'))throw Error('临时目录身份不符，停止清理');
    await rm(resolved,{recursive:true});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--help'))console.log('开发：npm run deploy:preview -- --execute；正式：--target production --run <PR CI run> --approve-preview <包摘要> --execute --closeout；不加 --execute 仅核对');
  else try{await deploy(parseOptions(process.argv.slice(2)));}catch(error){console.error(error.message);process.exitCode=1;}
}
