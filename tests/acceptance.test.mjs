import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {makeZip} from '../public/collector/zip.js';
import {stageAcceptance} from '../scripts/stage-acceptance.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function candidate(dir,n){
 await mkdir(path.join(dir,'pages'),{recursive:true});
 const identity={kind:'git-source-candidate',repository:'ga626/refellow',pullRequest:2,sourceCommit:String(n).repeat(40),version:'0.5.1'};
 const zip=Buffer.from(await (await makeZip([{name:'manifest.json',data:JSON.stringify({version:identity.version})},{name:'release-identity.json',data:JSON.stringify(identity)}])).arrayBuffer());
 const page=Buffer.from('page '+n);await writeFile(path.join(dir,'pages/index.html'),page);
 await writeFile(path.join(dir,'refellow-collector-0.5.1.zip'),zip);
 await writeFile(path.join(dir,'pages-manifest.json'),JSON.stringify({sourceIdentity:identity,packageHash:'pages-'+n,files:[{path:'index.html',bytes:page.length,sha256:hash(page)}]}));
 await writeFile(path.join(dir,'receipt.json'),JSON.stringify({...identity,schema:'refellow-candidate/v1',collectorBytes:zip.length,collectorSha256:hash(zip),pagesPackageHash:'pages-'+n}));
 return identity;
}
test('验收目录固定、重复准备复用，仅保留当前与上一版；损坏候选不替换当前',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'refellow-acceptance-')),source=path.join(dir,'source'),root=path.join(dir,'slots');
 try{
  await candidate(source,1);const first=await stageAcceptance(source,root);assert.equal((await stageAcceptance(source,root)).reused,true);
  await candidate(source,2);await stageAcceptance(source,root);
  await candidate(source,3);await stageAcceptance(source,root);
  assert.deepEqual((await readdir(root)).sort(),['current','previous']);
  const read=async slot=>JSON.parse(await readFile(path.join(root,slot,'acceptance.json'),'utf8'));
  assert.equal((await read('current')).sourceCommit,'3'.repeat(40));assert.equal((await read('previous')).sourceCommit,'2'.repeat(40));
  assert.equal(first.edgeDirectory,path.join(root,'current/edge-extension'));
  await writeFile(path.join(source,'pages/index.html'),'corrupt');await assert.rejects(stageAcceptance(source,root),/摘要/);
  assert.equal((await read('current')).sourceCommit,'3'.repeat(40));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('不覆盖未知目录，不接受未绑定源码的包或额外网站文件',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'refellow-acceptance-')),source=path.join(dir,'source'),root=path.join(dir,'slots');
 try{
  await candidate(source,1);await writeFile(path.join(source,'pages/unexpected.txt'),'extra');await assert.rejects(stageAcceptance(source,root),/额外/);await rm(path.join(source,'pages/unexpected.txt'));
  await mkdir(path.join(root,'current'),{recursive:true});await writeFile(path.join(root,'current/user.txt'),'keep');await assert.rejects(stageAcceptance(source,root));assert.equal(await readFile(path.join(root,'current/user.txt'),'utf8'),'keep');
  const receipt=JSON.parse(await readFile(path.join(source,'receipt.json'),'utf8'));delete receipt.sourceCommit;await writeFile(path.join(source,'receipt.json'),JSON.stringify(receipt));await assert.rejects(stageAcceptance(source,root),/源码/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
