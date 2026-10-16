import {readFile,mkdir,copyFile,cp,writeFile,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sourceIdentity} from './source-identity.mjs';
import {buildPages} from './build-pages.mjs';
const root=process.cwd(),identity=sourceIdentity(root,['package.json','scripts/prepare-candidate.mjs']);
if(!identity||!Number.isInteger(identity.pullRequest)||identity.pullRequest<1)throw Error('候选须绑定干净源码和真实 PR');
const pages=await buildPages(),zip=await readFile('public/assets/collector.zip');
const version=JSON.parse(await readFile('采集器/manifest.json','utf8')).version;
let old;try{old=await lstat('local/candidate');}catch(e){if(e.code!=='ENOENT')throw e;}
if(old){
 if(old.isSymbolicLink()||!old.isDirectory())throw Error('候选目录身份无效');
 const prior=JSON.parse(await readFile('local/candidate/receipt.json','utf8'));
 if(prior.schema!=='refellow-candidate/v1')throw Error('拒绝覆盖非候选目录');
 await rm('local/candidate',{recursive:true});
}
await mkdir('local/candidate',{recursive:true});
await copyFile('public/assets/collector.zip','local/candidate/refellow-collector-'+version+'.zip');
await cp(pages.directory,'local/candidate/pages',{recursive:true});
await copyFile(pages.manifestPath,'local/candidate/pages-manifest.json');
await copyFile('cloud/schema.sql','local/candidate/cloud-schema.sql');
await mkdir('local/candidate/cloud-migrations',{recursive:true});
await cp('cloud/migrations','local/candidate/cloud-migrations',{recursive:true});
const receipt={schema:'refellow-candidate/v1',...identity,version,collectorSha256:createHash('sha256').update(zip).digest('hex'),collectorBytes:zip.length,pagesPackageHash:pages.packageHash,realEdgeAcceptance:'pending',cloudAcceptance:'pending'};
await writeFile('local/candidate/receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
