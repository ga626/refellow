import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {downloadHeaders} from './scripts/pages-config.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||5192);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.zip':'application/zip'};
const files={'/privacy.html':'privacy.html','/privacy.css':'privacy.css','/':'index.html','/app.js':'app.js','/store.js':'store.js','/lib.js':'lib.js','/collector-ui.js':'collector-ui.js','/collector-transfer.js':'collector-transfer.js','/workspace-ui.js':'workspace-ui.js','/handoff.js':'handoff.js','/workspace.css':'workspace.css','/style.css':'style.css','/sites.json':'sites.json','/legacy-cases.json':'cases.json'};
function json(res,status,value){const body=Buffer.from(JSON.stringify(value));res.writeHead(status,{'Content-Type':types['.json'],'Content-Length':body.length});res.end(res.req.method==='HEAD'?undefined:body);}
http.createServer(async(req,res)=>{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return json(res,405,{error:'本地服务只读，个人数据保存在浏览器中。'});}
let url;try{url=new URL(req.url,'http://localhost');}catch{return json(res,400,{error:'无效地址'});}
try{
if(url.pathname==='/health')return json(res,200,{status:'ok',service:'refellow',version:2,pid:process.pid,port,projectRoot:root});
if(url.pathname==='/api/catalog'){const raw=await readFile(path.join(root,'public/sites.json'),'utf8');return json(res,200,{...JSON.parse(raw),hash:createHash('sha256').update(raw).digest('hex')});}
if(url.pathname.startsWith('/api/'))return json(res,404,{error:'未找到接口'});
if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
let file=files[url.pathname];if(/^\/assets\/[a-z0-9-]+\.(png|jpg|zip)$/.test(url.pathname))file=url.pathname.slice(1);
if(/^\/collector\/(sidepanel\.(html|css|js)|popup\.html|capture\.(js|css)|desk\.js|inbox\.js|recorder\.(html|js)|lib\.js|core\.js|browser\.js|catalog\.json|shared\/(attachments|media-store|recipes|zip|screen-recorder)\.js)$/.test(url.pathname))file=url.pathname.slice(1);
if(/^\/collector\/(attachments|media-store|recipes|zip|screen-recorder)\.js$/.test(url.pathname))file='public-shared/'+url.pathname.split('/').pop();
if(url.pathname.startsWith('/collector/'))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
if(['/collector/icons/icon-16.png','/collector/icons/icon-32.png','/collector/icons/icon-48.png','/collector/icons/icon-128.png'].includes(url.pathname))file=url.pathname.slice(1);
if(['/collector/floating-preview.html','/collector/floating-preview.js','/collector/floating-preview.css','/collector/shared/floating-ui.js'].includes(url.pathname))file=url.pathname.slice(1);
if(!file)return json(res,404,{error:'未找到页面'});
const content=await readFile(file.startsWith('public-shared/')?path.join(root,'public/collector',file.split('/').pop()):file.startsWith('collector/')?path.join(root,'采集器',file.slice('collector/'.length)):path.join(root,'public',file));const mime=content[0]===0xff&&content[1]===0xd8?'image/jpeg':types[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Content-Length':content.length,...(url.pathname==='/assets/collector.zip'?downloadHeaders:{})});res.end(req.method==='HEAD'?undefined:content);
}catch(err){return json(res,err.code==='ENOENT'?404:500,{error:err.code==='ENOENT'?'资源不存在':'本地资料读取失败'});}
}).listen(port,'127.0.0.1',()=>console.log('Refellow · 参伴 v2 http://127.0.0.1:'+port+'/ pid='+process.pid));
