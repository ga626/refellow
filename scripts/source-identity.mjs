import {spawnSync} from 'node:child_process';
export function sourceIdentity(root,paths){
  const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});return r.status===0?r.stdout:null;};
  const sha=git(['rev-parse','HEAD']);
  if(!sha||!/^[a-f0-9]{40}$/.test(sha.trim()))return null;
  const tracked=git(['ls-files','-z']);
  if(tracked===null)return null;
  const names=new Set(tracked.split(String.fromCharCode(0)));
  if(paths.some(p=>!names.has(p)))return null;
  const dirty=git(['status','--porcelain','--untracked-files=no']);
  if(dirty===null||dirty.trim())return null;
  return {repository:'ga626/refellow',sourceCommit:sha.trim(),pullRequest:process.env.REFELLOW_PR_NUMBER?Number(process.env.REFELLOW_PR_NUMBER):null};
}
