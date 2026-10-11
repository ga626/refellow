import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {headers,collectorHeaders,downloadHeaders} from './pages-config.mjs';
const directory=process.argv[2], port=Number(process.env.PORT||5190);
if(!directory)throw Error('请指定冻结发布包目录');
const manifest=JSON.parse(await readFile(directory+'.manifest.json','utf8'));
const allowed=new Set(manifest.files.map(file=>'/'+file.path));
for(const file of manifest.files){const bytes=await readFile(path.join(directory,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('冻结包身份错误：'+file.path);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.zip':'application/zip'};
http.createServer(async(req,res)=>{
  for(const [key,value] of Object.entries(headers))res.setHeader(key,value);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/collector/'))for(const [key,value] of Object.entries(collectorHeaders))res.setHeader(key,value);
  const file=pathname==='/'?'/index.html':pathname;
  const found=allowed.has(file)&&file!=='/_headers';
  const target=found?file.slice(1):'404.html';
  try{const bytes=await readFile(path.join(directory,target));res.writeHead(found?200:404,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':bytes.length,...(found&&file==='/assets/collector.zip'?downloadHeaders:{})});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(500);res.end('页面读取失败');}
}).listen(port,'127.0.0.1',()=>console.log(JSON.stringify({service:'frozen-pages-preview',pid:process.pid,port,packageHash:manifest.packageHash,url:'http://127.0.0.1:'+port+'/#discover'})));
