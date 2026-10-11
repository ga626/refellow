import test from 'node:test';import assert from 'node:assert/strict';
const subject={url:'https://example.org/visible',title:'QA native recording',id:7,windowId:2};
function fixture(){const messages=[],badges=[];let active=subject.id,document=false,job=null;
 const api={runtime:{id:'qa-extension',getURL:file=>'chrome-extension://qa-extension/'+file,async sendMessage(message){messages.push(message);if(message.action==='status')return {ok:true,recording:job};if(message.action==='start'){job={id:message.id,page:message.page};return {ok:true};}if(message.action==='stop')return {ok:true};return {ok:true};}},tabs:{async get(){return subject;},async query(){return [{id:active}];},async sendMessage(tabId,message){messages.push({tabId,...message});}},storage:{local:{async get(){return {'refellow/cloud-connection':{origin:'https://lingganji.pages.dev',token:'a'.repeat(64)}};}}},offscreen:{async hasDocument(){return document;},async createDocument(){document=true;},async closeDocument(){document=false;}},tabCapture:{async getMediaStreamId(options){assert.equal(options.targetTabId,subject.id);return 'qa-stream-id';}},action:{async setBadgeText(value){badges.push(value);},async setBadgeBackgroundColor(){},async setTitle(){}}};
 return {api,messages,badges,sender:{id:api.runtime.id,tab:subject,frameId:0,url:subject.url},setActive:id=>active=id,setJob:value=>job=value,hasDocument:()=>document};
}
test('当前网页录制绑定用户授权、区域与停止动作，后台休眠后恢复任务',async()=>{
 const f=fixture(),native=await import('../采集器/native-recording.js?test-start');
 const region={x:.2,y:.1,width:.5,height:.4};const started=await native.startTabRecording(f.api,f.sender,{pageURL:subject.url,region});
 assert.ok(started.id);assert.equal(f.messages.find(m=>m.action==='start').region,region);assert.deepEqual(f.badges[0],{tabId:subject.id,text:'STOP'});
 const resumed=await import('../采集器/native-recording.js?test-resumed');
 assert.equal(await resumed.stopTabRecording(f.api,subject.id),true);assert.equal(f.messages.at(-1).action,'stop');assert.equal(f.messages.at(-1).id,started.id);
 const sender={id:f.api.runtime.id,url:f.api.runtime.getURL('offscreen.html')};await resumed.failedTabRecording(f.api,{id:started.id,error:'QA offline'},sender);assert.deepEqual(f.badges.at(-1),{tabId:subject.id,text:'!'});
 f.setJob(null);await resumed.finishTabRecording(f.api,{id:started.id,page:{tabId:subject.id}},sender);assert.equal(f.hasDocument(),false);assert.ok(f.messages.some(m=>m.type==='refellow/record-complete'&&m.tabId===subject.id));
});
test('非当前网页和非录制文档不能启动或完成录像',async()=>{
 const f=fixture(),native=await import('../采集器/native-recording.js?test-reject');f.setActive(9);
 await assert.rejects(()=>native.startTabRecording(f.api,f.sender,{pageURL:subject.url}),/回到要录制/);assert.equal(f.hasDocument(),false);
 await assert.rejects(()=>native.finishTabRecording(f.api,{id:'qa'},{id:f.api.runtime.id,url:'https://attacker.test/'}),/拒绝/);
});
