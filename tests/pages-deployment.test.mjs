import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertExecutionScope,assertPolicy,assertProject,selectArtifact,verifyCandidate,verifyBranchBuild,verifyOnline,environments} from '../scripts/pages-deployment.mjs';
import {parseOptions,deploy,deployBranchPreview} from '../scripts/deploy-pages.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const sha='a'.repeat(40),merged='b'.repeat(40),tree='c'.repeat(40),packageHash='d'.repeat(64);
async function cleanup(directory){const resolved=path.resolve(directory);if(path.dirname(resolved)!==path.resolve(tmpdir())||!path.basename(resolved).startsWith('refellow-deployment-test-'))throw Error('Unexpected test cleanup target');await rm(resolved,{recursive:true});}
function facts(){return {
 target:'production',approvedPackageHash:packageHash,
 receipt:{repository:'ga626/refellow',sourceCommit:sha,pullRequest:2,pagesPackageHash:packageHash},
 run:{repository:{full_name:'ga626/refellow'},head_repository:{full_name:'ga626/refellow'},path:'.github/workflows/quality.yml',event:'pull_request',status:'completed',conclusion:'success',head_sha:sha},
 pr:{number:2,state:'closed',merged:true,merge_commit_sha:merged,head:{sha,repo:{full_name:'ga626/refellow'}},base:{ref:'main',repo:{full_name:'ga626/refellow'}}},
 main:{sha:merged,commit:{tree:{sha:tree}}},source:{sha,commit:{tree:{sha:tree}}}
};}

test('开发部署允许未合并候选，正式部署在PR未合并时拒绝；合并及同一制品满足时才通过',()=>{
 const f=facts();f.pr.state='open';f.pr.merged=false;
 assert.equal(assertPolicy({...f,target:'preview'}).branch,'preview');
 assert.throws(()=>assertPolicy(f),/尚未合并/);
 f.pr.merged=true;f.pr.state='closed';
 assert.equal(assertPolicy(f).branch,'main');
});
for(const [name,mutate,pattern] of [
 ['main已前进',f=>f.main.sha='e'.repeat(40),/当前 main/],
 ['合并内容改变',f=>f.main.commit.tree.sha='e'.repeat(40),/内容与已验候选不同/],
 ['PR有更新',f=>f.pr.head.sha='e'.repeat(40),/最新代码/],
 ['没有确认验收',f=>delete f.approvedPackageHash,/明确确认/],
 ['确认了另一个包',f=>f.approvedPackageHash='e'.repeat(64),/明确确认/],
 ['CI失败',f=>f.run.conclusion='failure',/CI 尚未成功/],
 ['fork候选',f=>f.run.head_repository.full_name='other/refellow',/拒绝 fork/],
 ['错误工作流',f=>f.run.path='.github/workflows/other.yml',/quality 工作流/],
 ['main的重新构建代替PR制品',f=>f.run.event='push',/产品 PR/],
 ['PR目标错误',f=>f.pr.base.ref='other',/目标不是 main/],
 ['关闭未合并的候选',f=>{f.target='preview';f.pr.merged=false;},/已关闭且未合并/]
])test('拒绝旁路：'+name,()=>{const f=facts();mutate(f);assert.throws(()=>assertPolicy(f),pattern);});

test('云端正式分支和两个DB身份必须匹配，不能把preview当production',()=>{
 const settings={name:'refellow',production_branch:'main',deployment_configs:Object.fromEntries(Object.entries(environments).map(([n,v])=>[n,{d1_databases:{DB:{id:v.database}}}]))};
 assert.doesNotThrow(()=>assertProject(settings));settings.production_branch='preview';assert.throws(()=>assertProject(settings),/正式分支/);
 settings.production_branch='main';settings.deployment_configs.preview.d1_databases.DB.id=environments.production.database;
 assert.throws(()=>assertProject(settings),/preview 数据库/);
});
test('CI候选须唯一、未过期且下载前后身份不变',()=>{
 const run=facts().run,artifact={name:'refellow-candidate-'+sha,id:123,digest:'sha256:'+packageHash,expired:false};
 const list={total_count:1,artifacts:[artifact]};
 assert.equal(selectArtifact(list,run).id,123);
 for(const changed of [{...artifact,id:124},{...artifact,digest:'sha256:'+'e'.repeat(64)}])assert.throws(()=>selectArtifact({total_count:1,artifacts:[changed]},run,artifact),/被替换/);
 assert.throws(()=>selectArtifact({total_count:1,artifacts:[{...artifact,expired:true}]},run),/过期/);
 assert.throws(()=>selectArtifact({total_count:2,artifacts:[artifact,{...artifact,id:124}]},run),/不唯一/);
});

async function fixture(pullRequest=2){
 const dir=await mkdtemp(path.join(tmpdir(),'refellow-deployment-test-'));
 const zip=Buffer.from('immutable collector archive fixture');
 const identity={repository:'ga626/refellow',sourceCommit:sha,pullRequest};
 const files=new Map(Object.entries({'index.html':'<main>fixture</main>','privacy.html':'<main>privacy fixture</main>','_worker.js':'worker fixture','_headers':'headers fixture','_routes.json':'{}','source-identity.json':JSON.stringify(identity),'assets/collector.zip':zip}).map(([n,b])=>[n,Buffer.from(b)]));
 const packageHash=hash(Buffer.from([...files].sort(([a],[b])=>a.localeCompare(b)).map(([n,b])=>n+':'+hash(b)).join('\n')));
 files.set('release.json',Buffer.from(JSON.stringify({packageHash})));
 for(const [name,bytes] of files){await mkdir(path.dirname(path.join(dir,'pages',name)),{recursive:true});await writeFile(path.join(dir,'pages',name),bytes);}
 const receipt={schema:'refellow-candidate/v1',...identity,version:'0.5.5',pagesPackageHash:packageHash,collectorSha256:hash(zip),collectorBytes:zip.length};
 const manifest={schema:'inspiration-pages-package/v1',sourceIdentity:identity,packageHash,files:[...files].map(([name,b])=>({path:name,bytes:b.length,sha256:hash(b)}))};
 await writeFile(path.join(dir,'receipt.json'),JSON.stringify(receipt));await writeFile(path.join(dir,'pages-manifest.json'),JSON.stringify(manifest));await writeFile(path.join(dir,'refellow-collector-0.5.5.zip'),zip);
 return {dir,files,manifest};
}
test('候选逐文件、ZIP及完整包摘要核对；篡改后连manifest一起改也拒绝',async()=>{
 const f=await fixture();try{
  assert.equal((await verifyCandidate(f.dir)).receipt.sourceCommit,sha);
  await writeFile(path.join(f.dir,'pages/index.html'),'changed');
  await assert.rejects(()=>verifyCandidate(f.dir),/内容改变/);
  const entry=f.manifest.files.find(e=>e.path==='index.html');entry.bytes=7;entry.sha256=hash('changed');
  await writeFile(path.join(f.dir,'pages-manifest.json'),JSON.stringify(f.manifest));
  await assert.rejects(()=>verifyCandidate(f.dir),/网站包摘要/);
 }finally{await cleanup(f.dir);}
});
test('候选多余文件与路径穿越拒绝',async()=>{
 const f=await fixture();try{
  await writeFile(path.join(f.dir,'pages/extra.txt'),'extra');await assert.rejects(()=>verifyCandidate(f.dir),/额外文件/);
  await rm(path.join(f.dir,'pages/extra.txt'));f.manifest.files[0].path='../outside';
  await writeFile(path.join(f.dir,'pages-manifest.json'),JSON.stringify(f.manifest));await assert.rejects(()=>verifyCandidate(f.dir),/路径无效/);
 }finally{await cleanup(f.dir);}
});
test('日常开发包绑定干净源码、无需PR；不能冒充正式候选或接受旧提交和篡改文件',async()=>{
 const f=await fixture(null);try{
  assert.equal((await verifyBranchBuild(path.join(f.dir,'pages'),path.join(f.dir,'pages-manifest.json'),sha)).sourceIdentity.pullRequest,null);
  await assert.rejects(()=>verifyCandidate(f.dir),/候选身份不完整/);
  await assert.rejects(()=>verifyBranchBuild(path.join(f.dir,'pages'),path.join(f.dir,'pages-manifest.json'),'e'.repeat(40)),/当前干净提交/);
  await writeFile(path.join(f.dir,'pages/index.html'),'corrupted');
  await assert.rejects(()=>verifyBranchBuild(path.join(f.dir,'pages'),path.join(f.dir,'pages-manifest.json'),sha),/内容改变/);
 }finally{await cleanup(f.dir);}
 const pr=await fixture();try{await assert.rejects(()=>verifyBranchBuild(path.join(pr.dir,'pages'),path.join(pr.dir,'pages-manifest.json'),sha),/冒充 PR/);}finally{await cleanup(pr.dir);}
});
test('在线验收核对公开文件、安全头、404和账户就绪，平台文件不当公开资产读取',async()=>{
 const f=await fixture(),requested=[];let corrupt=false,ready=true;
 const headers={'content-security-policy':"frame-ancestors 'none'",'x-content-type-options':'nosniff','x-frame-options':'DENY'};
 const fetchImpl=async url=>{const name=new URL(url).pathname.slice(1)||'index.html';requested.push(name);
  if(name==='api/status')return new Response(JSON.stringify({ready}));
  if(name==='private-nonexistent-deployment-check')return new Response('missing',{status:404});
  return new Response(corrupt&&name==='index.html'?'changed':f.files.get(name),{headers});
 };
 try{
  assert.equal((await verifyOnline('https://preview.refellow.pages.dev',f.manifest,{fetchImpl})).pass,true);
  assert.ok(!requested.some(n=>n.startsWith('_')));
  corrupt=true;await assert.rejects(()=>verifyOnline(environments.preview.origin,f.manifest,{fetchImpl}),/在线候选不一致/);
  corrupt=false;ready=false;await assert.rejects(()=>verifyOnline(environments.preview.origin,f.manifest,{fetchImpl}),/尚未就绪/);
 }finally{await cleanup(f.dir);}
});
test('入口默认开发分支只核对，正式仍要求CI运行号；禁止任意分支与重复参数',()=>{
 assert.deepEqual(parseOptions([]),{target:'preview',execute:false,closeout:false});
 assert.equal(parseOptions(['--execute']).run,undefined);
 assert.equal(parseOptions(['--target','preview','--run','123']).execute,false);
 for(const args of [['--target','main','--run','123'],['--target','preview','--run','1','--branch','main'],['--target','preview','--run','1','--run','2'],['--target','production']])assert.throws(()=>parseOptions(args));
 assert.equal(parseOptions(['--target','production','--run','123','--approve-preview',packageHash,'--closeout','--execute']).execute,true);
});

test('接受Pages的站内HTML规范地址跳转并验证相同字节，拒绝外站或不对应的目标',async()=>{
 const f=await fixture();let location='/privacy';
 const fetchImpl=async url=>{const name=new URL(url).pathname.slice(1)||'index.html';
  if(name==='privacy.html')return new Response(null,{status:308,headers:{Location:location}});
  if(name==='api/status')return new Response(JSON.stringify({ready:true}));
  if(name==='private-nonexistent-deployment-check')return new Response(null,{status:404});
  return new Response(f.files.get(name==='privacy'?'privacy.html':name),{headers:{'content-security-policy':"frame-ancestors 'none'",'x-content-type-options':'nosniff','x-frame-options':'DENY'}});
 };
 try{
  assert.deepEqual((await verifyOnline(environments.preview.origin,f.manifest,{fetchImpl})).canonicalRedirects,['privacy.html']);
  for(location of ['https://evil.test/privacy','/other','/privacy?changed=true'])await assert.rejects(()=>verifyOnline(environments.preview.origin,f.manifest,{fetchImpl}),/非预期跳转/);
 }finally{await cleanup(f.dir);}
});

test('无PR的日常开发入口不能上传正式版，也不接受伪造的收口或PR参数',async()=>{
 for(const options of [{target:'production',execute:true},{target:'preview',run:'1'},{target:'preview',closeout:true},{target:'preview',approvedPackageHash:packageHash}])await assert.rejects(()=>deployBranchPreview(options),/只能更新 preview/);
});

test('普通部署默认开发版；未明确进入收口时正式执行在任何网络请求前拒绝',async()=>{
 assert.equal(parseOptions(['--run','123','--execute']).target,'preview');
 assert.equal(parseOptions(['--target','production','--run','123']).execute,false);
 assert.throws(()=>parseOptions(['--target','production','--run','123','--execute']),/需要 --closeout/);
 assert.throws(()=>parseOptions(['--run','123','--closeout']),/开发部署/);
 assert.throws(()=>parseOptions(['--run','123','--target','preview','--target','production']),/重复/);
 assert.doesNotThrow(()=>assertExecutionScope({target:'preview',execute:true}));
 await assert.rejects(()=>deploy({target:'production',execute:true}),/需要 --closeout/);
});

test('工作流只从main手动部署，不重建产品；所有环境串行且凭据只供部署步骤',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/if: github.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/group: refellow-pages-deployment/);assert.match(workflow,/cancel-in-progress: false/);
 assert.ok(!workflow.includes('pull_request_target')&&!workflow.includes('npm run build')&&!workflow.includes('prepare-candidate.mjs'));
 assert.match(workflow,/node scripts\/deploy-pages.mjs/);
 assert.match(workflow,/closeout_authorized:/);assert.match(workflow,/default: false/);
 assert.match(workflow,/test "\$CLOSEOUT_AUTHORIZED" = true/);
 assert.match(workflow,/arguments\+=\(--closeout/);
});
