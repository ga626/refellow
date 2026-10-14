import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fetchCollectorPackage} from '../public/collector-ui.js';
import {crc32} from '../public/collector/zip.js';
import {pagesHeaders,downloadHeaders} from '../scripts/pages-config.mjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5192';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('采集器 GET 和 HEAD 提供一致的完整 ZIP、长度和下载文件名',async()=>{
  const source=await readFile(new URL('../public/assets/collector.zip',import.meta.url));
  const head=await fetch(base+'/assets/collector.zip',{method:'HEAD'});
  assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),source.length);
  assert.equal((await head.arrayBuffer()).byteLength,0);
  assert.equal(head.headers.get('content-disposition'),downloadHeaders['Content-Disposition']);
  assert.equal(head.headers.get('content-type'),'application/zip');
  const blob=await fetchCollectorPackage((url,options)=>fetch(base+url,options));
  assert.equal(hash(Buffer.from(await blob.arrayBuffer())),hash(source));
  const missing=await fetch(base+'/assets/missing.zip',{method:'HEAD'});
  assert.equal(missing.status,404);assert.equal((await missing.arrayBuffer()).byteLength,0);
  assert.ok(pagesHeaders().includes('/assets/collector.zip'));
  assert.ok(pagesHeaders().includes('Content-Disposition: '+downloadHeaders['Content-Disposition']));
});

test('空响应、错误页、截断下载均拒绝，不能生成伪下载成功',async()=>{
  const response=(bytes,status=200,headers={})=>async()=>new Response(bytes,{status,headers});
  await assert.rejects(fetchCollectorPackage(response(null,204)),/HTTP 204/);
  await assert.rejects(fetchCollectorPackage(response('missing',404)),/HTTP 404/);
  await assert.rejects(fetchCollectorPackage(response('')),/为空/);
  await assert.rejects(fetchCollectorPackage(response('<html>not an archive</html>')),/不是完整/);
  const source=await readFile(new URL('../public/assets/collector.zip',import.meta.url));
  await assert.rejects(fetchCollectorPackage(response(source.subarray(0,100),200,{'content-length':source.length})),/不完整/);
});

test('可下载 ZIP 每个条目的 CRC 与扩展源码一致，manifest 入口均在包内',async()=>{
  const bytes=await readFile(new URL('../public/assets/collector.zip',import.meta.url)),entries=new Map();
  let offset=0;
  while(bytes.readUInt32LE(offset)===0x04034b50){
    assert.equal(bytes.readUInt16LE(offset+8),0);
    const size=bytes.readUInt32LE(offset+18),nameSize=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
    const name=bytes.subarray(offset+30,offset+30+nameSize).toString(),start=offset+30+nameSize+extra;
    const data=bytes.subarray(start,start+size);assert.equal(crc32(data),bytes.readUInt32LE(offset+14),name);
    if(name==='release-identity.json'){const identity=JSON.parse(data);assert.equal(identity.version,'0.5.1');assert.ok(['git-source-candidate','local-development-source-not-store-release'].includes(identity.kind));}
    else assert.deepEqual(data,await readFile(new URL(name==='LICENSE'?'../LICENSE':'../采集器/'+name,import.meta.url)),name);
    assert.ok(!entries.has(name));entries.set(name,data);offset=start+size;
  }
  assert.equal(entries.size,bytes.readUInt16LE(bytes.length-12));
  const manifest=JSON.parse(entries.get('manifest.json'));
  for(const name of [manifest.background.service_worker,'floating.js','floating-background.js','capture.js','desk.js','recorder.js','shared/media-store.js'])assert.ok(entries.has(name),name);
  assert.equal(manifest.version,'0.5.1');
});
