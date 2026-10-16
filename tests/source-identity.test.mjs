import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sourceIdentity} from '../scripts/source-identity.mjs';
test('候选身份拒绝未跟踪或脏源码，干净提交绑定真实 HEAD',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'refellow-identity-'));
 const git=args=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 try{
  git(['init']);git(['config','user.name','Identity QA']);git(['config','user.email','qa@example.invalid']);
  await writeFile(path.join(root,'source.js'),'export const version=1;');
  assert.equal(sourceIdentity(root,['source.js']),null);
  git(['add','source.js']);git(['commit','-m','test baseline']);
  const identity=sourceIdentity(root,['source.js']);assert.equal(identity.sourceCommit,git(['rev-parse','HEAD']));
  assert.equal(sourceIdentity(root,['missing.js']),null);
  await writeFile(path.join(root,'source.js'),'export const version=2;');assert.equal(sourceIdentity(root,['source.js']),null);
 }finally{await rm(root,{recursive:true,force:true});}
});
