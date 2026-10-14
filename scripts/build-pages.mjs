import {readFile,writeFile,mkdir,readdir,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {pagesHeaders} from './pages-config.mjs';
import {sourceIdentity} from './source-identity.mjs';
import {buildCloudWorker} from './build-cloud.mjs';
export const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sensitive = /(?:[CD]:[\\/]Users[\\/]|[CD]:[\\/](?:Projects|奥树)|\.codex[\\/]|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{30,})/;
const utf8 = text => Buffer.from(text,'utf8');
const containsSensitive = bytes => {
  const text = bytes.toString('utf8');
  return sensitive.test(text) || [projectRoot, projectRoot.split(path.sep).join('/')].some(root => text.toLowerCase().includes(root.toLowerCase()));
};

export async function preparePagesFiles(root=projectRoot) {
  const files=new Map(), source=[];
  async function include(input,output=input) {
    const bytes=await readFile(path.join(root,'public',input));
    if(containsSensitive(bytes)) throw Error('发布文件含本机路径或疑似秘密：'+input);
    files.set(output,bytes);source.push({path:'public/'+input,sha256:hash(bytes),bytes:bytes.length});
  }
  for(const name of ['index.html','app.js','style.css','lib.js','store.js','collector-ui.js','collector-transfer.js','workspace-ui.js','workspace.css','handoff.js','collector/attachments.js','collector/media-store.js','collector/recipes.js','collector/zip.js','collector/screen-recorder.js']) await include(name);
  for(const name of ['privacy.html','privacy.css','cloud-space.js','collector/capture-region.js','collector/cloud-media.js']) await include(name);
  files.set('_worker.js',await buildCloudWorker(root));
  files.set('_routes.json',utf8(JSON.stringify({version:1,include:['/api/*'],exclude:[]})+'\n'));
  for(const name of ['cloud/api.js','cloud/schema.sql','scripts/build-cloud.mjs']){const bytes=await readFile(path.join(root,name));if(containsSensitive(bytes))throw Error('云端源码含敏感内容：'+name);source.push({path:name,sha256:hash(bytes),bytes:bytes.length});}
  for(const name of ['sidepanel.html','sidepanel.css','sidepanel.js','core.js','browser.js','catalog.json','popup.html','capture.js','capture.css','desk.js','inbox.js','lib.js','recorder.html','recorder.js','shared/attachments.js','shared/media-store.js','shared/recipes.js','shared/zip.js','shared/screen-recorder.js']) {
    const bytes=await readFile(path.join(root,'采集器',name));
    if(containsSensitive(bytes)) throw Error('侧栏文件含本机路径或疑似秘密：'+name);
    files.set('collector/'+name,bytes);source.push({path:'采集器/'+name,sha256:hash(bytes),bytes:bytes.length});
  }
  for(const size of [16,32,48,128]){const name='icons/icon-'+size+'.png',bytes=await readFile(path.join(root,'采集器',name));files.set('collector/'+name,bytes);source.push({path:'采集器/'+name,sha256:hash(bytes),bytes:bytes.length});}
  for(const name of ['floating-preview.html','floating-preview.css','floating-preview.js','shared/floating-ui.js']){const bytes=await readFile(path.join(root,'采集器',name));if(containsSensitive(bytes))throw Error('预览含本机路径或秘密：'+name);files.set('collector/'+name,bytes);source.push({path:'采集器/'+name,sha256:hash(bytes),bytes:bytes.length});}
  const raw=await readFile(path.join(root,'public/sites.json'));
  const catalog=JSON.parse(raw);
  if(catalog.schema!=='inspiration-directory/v2'||!Array.isArray(catalog.sites)||!Array.isArray(catalog.categories)) throw Error('网站目录合同不一致');
  const replacements=new Map();
  for(const site of catalog.sites) {
    if(!/^https:\/\//.test(site.url)||!/^\/assets\/[a-z0-9-]+\.(?:png|jpg|webp)$/.test(site.image)) throw Error('来源地址或图片不是公开白名单：'+site.id);
    const input=site.image.slice(1), bytes=await readFile(path.join(root,'public',input));
    // 既有浏览器实拍是 JPEG，但曾使用 .png 名称。发布时按签名纠正扩展名，保留像素和出处。
    const output=bytes[0]===0xff&&bytes[1]===0xd8 ? input.replace(/\.png$/,'.jpg') : input;
    if(!files.has(output)) await include(input,output);
    replacements.set(site.image,'/'+output);site.image='/'+output;
  }
  source.push({path:'public/sites.json',sha256:hash(raw),bytes:raw.length});
  files.set('sites.json',utf8(JSON.stringify(catalog,null,2)+'\n'));
  const casesRaw=await readFile(path.join(root,'public/cases.json'));
  const cases=JSON.parse(casesRaw).map(item=>({id:item.id,name:item.name,url:item.url,source:item.source,description:item.description,categories:item.categories,image:''}));
  source.push({path:'public/cases.json',sha256:hash(casesRaw),bytes:casesRaw.length});
  files.set('legacy-cases.json',utf8(JSON.stringify(cases,null,2)+'\n'));
  await include('assets/collector.zip');
  files.set('_headers',utf8(pagesHeaders()));
  // 有真实 404.html 时未知路径不会被 Pages 当成单页应用返回首页。本站路由由 URL hash 承担。
  files.set('404.html',utf8('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>页面没有找到 · Refellow · 参伴</title><link rel="stylesheet" href="/style.css"></head><body><main><h1>这个页面没有找到</h1><p>登录后可查看你的个人收藏。</p><a href="/#discover">返回Refellow · 参伴</a></main></body></html>\n'));
  const identity=sourceIdentity(root,['scripts/build-pages.mjs','scripts/source-identity.mjs',...source.filter(f=>f.path!=='public/assets/collector.zip').map(f=>f.path)]);
  files.set('source-identity.json',utf8(JSON.stringify(identity||{kind:'local-development-source-not-release'},null,2)+'\n'));
  const packageHash=hash(utf8([...files.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,bytes])=>name+':'+hash(bytes)).join('\n')));
  files.set('release.json',utf8(JSON.stringify({schema:'inspiration-static-release/v1',appVersion:2,packageHash,siteCount:catalog.sites.length,storage:'cloud-private-account'},null,2)+'\n'));
  return {files,source,identity,packageHash,replacements:Object.fromEntries(replacements),siteCount:catalog.sites.length};
}

export async function buildPages({archive=false}={}) {
  const prepared=await preparePagesFiles(), buildRoot=path.join(projectRoot,archive?'部署':'local/build'), id=prepared.packageHash;
  await mkdir(buildRoot,{recursive:true});
  const directory=path.join(buildRoot,archive?'包-'+id.slice(0,16):'pages');
  const manifestPath=directory+'.manifest.json';
  if(!archive){
    let prior;try{prior=await lstat(directory);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(prior){
      if(prior.isSymbolicLink()||!prior.isDirectory())throw Error('构建目录身份无效');
      const previous=JSON.parse(await readFile(manifestPath,'utf8'));
      if(previous.schema!=='inspiration-pages-package/v1')throw Error('拒绝覆盖非本项目构建目录');
      if(previous.packageHash!==id){await rm(directory,{recursive:true});await rm(manifestPath);}
    }
  }
  let existing=false;try{await mkdir(directory);}catch(err){if(err.code!=='EEXIST')throw err;existing=true;}
  for(const [name,bytes] of prepared.files) {
    const target=path.join(directory,name);
    if(existing){if(hash(await readFile(target))!==hash(bytes))throw Error('既有冻结包不匹配，不覆盖：'+name);}
    else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
  }
  async function entries(dir,prefix=''){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isSymbolicLink())throw Error('拒绝符号链接');if(entry.isDirectory())result.push(...await entries(path.join(dir,entry.name),name+'/'));else result.push(name);}return result;}
  const actual=await entries(directory);if(actual.length!==prepared.files.size||actual.some(name=>!prepared.files.has(name)))throw Error('发布目录含非白名单文件');
  const manifest={schema:'inspiration-pages-package/v1',createdAt:new Date().toISOString(),packageHash:id,appVersion:2,sourceIdentity:prepared.identity||'local-development-source-not-release',siteCount:prepared.siteCount,sourceFiles:prepared.source,files:[...prepared.files.entries()].map(([name,bytes])=>({path:name,sha256:hash(bytes),bytes:bytes.length})),imageRenames:prepared.replacements,exclusions:['个人收藏/项目/评分','认证、账号与本机配置','源码工具、测试、日志和调研证据'],limitations:['第三方截图公开展示许可未独立核验','云端需要DB绑定与服务端秘密；未配置时明确失败','真实Edge采集与云空间需同候选验收']};
  if(!existing)await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {directory,manifestPath,packageHash:id,fileCount:prepared.files.size,siteCount:prepared.siteCount,reused:existing};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildPages(),null,2));
