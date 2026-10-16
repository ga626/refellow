import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyState,normalizeWorkspace} from '../public/store.js';
import {packMedia,inspectMediaPackage,MEDIA_PACKAGE_COUNT_LIMIT,digest} from '../public/collector/media-store.js';
import {startSilentRecording} from '../public/collector/screen-recorder.js';
const image=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4])],{type:'image/png'});
const references=(count,attachments=1)=>Array.from({length:count},(_,i)=>({id:'ref-'+i,url:'https://qa.example/page/'+i,attachments:Array.from({length:attachments},(_,j)=>({id:'att-'+i+'-'+j,kind:'image',name:'QA截图',mediaId:'media-'+i+'-'+j,size:image.size,mime:image.type}))}));
test('201份媒体与工作台最大500×40附件均可完整备份恢复',async()=>{
  for(const [count,attachments] of [[201,1],[500,40]]){
    const workspace=normalizeWorkspace({...emptyState(),references:references(count,attachments)});
    const packed=await packMedia(workspace.references,async()=>image);
    const restored=await inspectMediaPackage(workspace.references,packed,async()=>undefined);
    assert.equal(packed.length,count*attachments);assert.equal(restored.length,packed.length);
    assert.equal(await digest(restored.at(-1).blob),await digest(image));
    assert.deepEqual(normalizeWorkspace(workspace),workspace);
  }
});
test('媒体数量保护一致，重复、缺件和多余媒体仍拒绝',async()=>{
  const refs=references(1),packed=await packMedia(refs,async()=>image);
  await assert.rejects(inspectMediaPackage(refs,[...packed,...packed],async()=>undefined),/重复/);
  await assert.rejects(inspectMediaPackage(refs,[],async()=>undefined),/缺少/);
  await assert.rejects(inspectMediaPackage(refs,[{...packed[0],id:'media-extra'}],async()=>undefined),/不属于/);
  await assert.rejects(inspectMediaPackage(refs,Array(MEDIA_PACKAGE_COUNT_LIMIT+1).fill(packed[0])),/上限/);
  await assert.rejects(packMedia(references(501,40),async()=>image),/上限/);
});
class Recorder{
  static instance;static isTypeSupported=()=>true;
  constructor(){Recorder.instance=this;this.state='inactive';this.stops=0;}
  start(){this.state='recording';}
  stop(){this.stops++;this.state='inactive';this.ondataavailable({data:new Blob([Uint8Array.from([26,69,223,163,1])],{type:'video/webm'})});this.onstop();}
}
function stream(){const events={};const track={stopped:false,stop(){this.stopped=true;},addEventListener(name,fn){events[name]=fn;}};return {track,events,getAudioTracks:()=>[],getVideoTracks:()=>[track],getTracks:()=>[track]};}
test('录制超过15秒继续运行，手动停止保留真实时长并释放轨道',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:0});
  const s=stream(),progress=[];const session=await startSilentRecording({display:async()=>s,Recorder,onProgress:p=>progress.push(p.duration)});
  t.mock.timers.tick(16000);assert.equal(Recorder.instance.state,'recording');assert.ok(progress.at(-1)>=16);
  session.stop();session.stop();const result=await session.done;assert.equal(result.duration,16);assert.equal(s.track.stopped,true);assert.equal(Recorder.instance.stops,1);
});
test('两分钟保护停止、共享结束、空录像与录制错误均安全收尾',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:0});
  const s=stream(),session=await startSilentRecording({display:async()=>s,Recorder});t.mock.timers.tick(120000);assert.equal((await session.done).duration,120);assert.equal(s.track.stopped,true);
  const e=stream(),ended=await startSilentRecording({display:async()=>e,Recorder});e.events.ended();assert.ok(await ended.done);assert.equal(e.track.stopped,true);
  class Empty extends Recorder{stop(){this.state='inactive';this.onstop();}}
  const emptyStream=stream(),empty=await startSilentRecording({display:async()=>emptyStream,Recorder:Empty});empty.stop();await assert.rejects(empty.done,/没有录到/);assert.equal(emptyStream.track.stopped,true);
  const badStream=stream(),bad=await startSilentRecording({display:async()=>badStream,Recorder});Recorder.instance.onerror();await assert.rejects(bad.done,/录制失败/);assert.equal(badStream.track.stopped,true);
});
test('超12MB录像取消，选择器取消与格式不支持均不产生伪成功',async()=>{
  const s=stream(),session=await startSilentRecording({display:async()=>s,Recorder});Recorder.instance.ondataavailable({data:new Blob([new Uint8Array(12*1024*1024+1)])});assert.equal(await session.done,null);assert.equal(s.track.stopped,true);
  await assert.rejects(startSilentRecording({display:async()=>{throw new DOMException('cancelled','NotAllowedError');},Recorder}),/cancelled/);
  class Unsupported extends Recorder{static isTypeSupported=()=>false;}
  const u=stream();await assert.rejects(startSilentRecording({display:async()=>u,Recorder:Unsupported}),/格式/);assert.equal(u.track.stopped,true);
});
test('扩展图标尺寸、PNG内容和打包声明一致',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../采集器/manifest.json',import.meta.url)));
  for(const size of [16,32,48,128]){const path=manifest.icons[size];assert.equal(path,manifest.action.default_icon[size]);const png=await readFile(new URL('../采集器/'+path,import.meta.url));assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
});
