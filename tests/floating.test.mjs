import test from 'node:test';import assert from 'node:assert/strict';
import {dockPosition} from '../public/collector/floating-ui.js';
import {trustedPage,handleFloatingMessage} from '../采集器/floating-background.js';
const api={runtime:{id:'qa-extension',getURL:p=>'chrome-extension://qa-extension/'+p},tabs:{get:async()=>({id:7,url:'https://qa.example/page',windowId:2,title:'QA'})},storage:{local:{get:async()=>({}),set:async()=>{}}}};
const sender={id:'qa-extension',frameId:0,tab:{id:7},url:'https://qa.example/page'};
test('贴边位置跨视口保存比例，恶意／过期位置仍保持可见',()=>{
  for(const width of [320,800,1920])for(const height of [200,600,1080])for(const ratio of [-10,0,.64,1,20,NaN])for(const side of ['left','right']){
    const p=dockPosition({side,ratio},{width,height});assert.ok(p.x>=0&&p.x+44<=width);assert.ok(p.y>=0&&p.y+44<=height);
  }
});
test('消息仅接受本扩展顶层网页，切页和网址伪造均拒绝',async()=>{
  assert.equal((await trustedPage(api,sender,'https://qa.example/page')).tabId,7);
  for(const bad of [{...sender,id:'other-extension'},{...sender,frameId:1},{...sender,tab:null},{...sender,url:'https://evil.example/'}])await assert.rejects(trustedPage(api,bad));
  await assert.rejects(trustedPage(api,sender,'https://qa.example/changed'),/改变/);
  await assert.rejects(trustedPage({...api,tabs:{get:async()=>({id:7,url:'edge://settings'})}},sender),/HTTP/);
});
test('消息位置／录像输入在写存储前验明，未知动作拒绝',async()=>{
  for(const position of [{side:'up',ratio:.5},{side:'left',ratio:-1},{side:'right',ratio:Infinity},null])await assert.rejects(handleFloatingMessage({action:'position',position},sender,api),/无效/);
  for(const media of [{duration:121,mime:'video/webm',data:'AAAA'},{duration:0,mime:'video/webm',data:'AAAA'},{duration:2,mime:'image/png',data:'AAAA'}])await assert.rejects(handleFloatingMessage({action:'save-record',media},sender,api),/无效/);
  await assert.rejects(handleFloatingMessage({action:'arbitrary'},sender,api),/未知/);
});
test('悬浮截图穿过活动页校验并保存媒体；截图期间切页不写入',async()=>{
  const jpeg=Buffer.from([255,216,255,224,1,2,3,4]).toString('base64');
  let current='https://qa.example/page',saved=[];
  const tabs={...api.tabs,query:async()=>[{id:7,url:current}],captureVisibleTab:async(windowId,options)=>{assert.equal(windowId,2);assert.equal(options.format,'jpeg');return 'data:image/jpeg;base64,'+jpeg;}};
  await handleFloatingMessage({action:'shot',pageURL:current},sender,{...api,tabs},async(raw,media)=>saved.push({raw,media}));
  assert.equal(saved.length,1);assert.equal(saved[0].raw.url,current);assert.equal(saved[0].media[0].blob.size,8);assert.equal(saved[0].raw.attachments[0].mediaId,saved[0].media[0].id);
  tabs.captureVisibleTab=async()=>{current='https://qa.example/changed';return 'data:image/jpeg;base64,'+jpeg;};
  await assert.rejects(handleFloatingMessage({action:'shot',pageURL:'https://qa.example/page'},sender,{...api,tabs},()=>{throw Error('不应保存');}),/切换/);
});
test('悬浮录像保留来源和时长，坏签名不会写入',async()=>{
  const media={mime:'video/webm',duration:22.6,data:Buffer.from([26,69,223,163,1,2,3,4]).toString('base64')};
  let saved;
  await handleFloatingMessage({action:'save-record',pageURL:sender.url,media},sender,api,async(raw,blobs)=>{saved={raw,blobs};});
  assert.equal(saved.raw.url,sender.url);assert.equal(saved.raw.attachments[0].duration,22.6);assert.equal(saved.blobs[0].blob.type,'video/webm');
  await assert.rejects(handleFloatingMessage({action:'save-record',pageURL:sender.url,media:{...media,data:'AAAA'}},sender,api,()=>{throw Error('不应保存');}));
});
