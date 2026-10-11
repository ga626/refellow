import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {headers} from '../scripts/pages-config.mjs';

test('公网校验核对真实资产，平台配置不当网页请求，内容损坏拒绝',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'refellow-public-verification-'));
 const requested=[];let corrupt=false;
 const server=http.createServer((request,response)=>{
  requested.push(request.url);
  for(const [key,value] of Object.entries(headers))response.setHeader(key,value);
  if(request.url==='/'){response.end(corrupt?'changed':'real page');return;}
  response.writeHead(404);response.end('missing');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const manifestPath=path.join(directory,'manifest.json'),output=path.join(directory,'receipt.json');
 const files=['index.html','_headers','_worker.js','_routes.json'].map(name=>({path:name,sha256:createHash('sha256').update(name==='index.html'?'real page':'platform configuration').digest('hex')}));
 await writeFile(manifestPath,JSON.stringify({packageHash:'fixture',files}));
 const run=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/verify-pages.mjs','http://127.0.0.1:'+server.address().port,manifestPath,output],{stdio:'ignore',windowsHide:true});child.on('error',reject);child.on('exit',resolve);});
 try{assert.equal(await run(),0);let receipt=JSON.parse(await readFile(output,'utf8'));assert.equal(receipt.pass,true);assert.equal(receipt.files.length,1);assert.equal(receipt.headerPass,true);assert.equal(receipt.missingPathStatus,404);assert.ok(!requested.some(url=>url.startsWith('/_')));
  corrupt=true;assert.equal(await run(),1);receipt=JSON.parse(await readFile(output,'utf8'));assert.equal(receipt.pass,false);assert.equal(receipt.files[0].pass,false);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
});
