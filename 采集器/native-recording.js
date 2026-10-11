import {trustedPage} from './floating-background.js';
const recordings=new Map();let opening;
async function restore(api){
 if(api.offscreen?.hasDocument&&await api.offscreen.hasDocument()){
  const result=await api.runtime.sendMessage({target:'refellow/offscreen',action:'status'});const job=result?.recording;if(job?.page?.tabId)recordings.set(job.page.tabId,job);
 }
}
export async function startTabRecording(api,sender,message){
 const page=await trustedPage(api,sender,message.pageURL),active=await api.tabs.query({active:true,currentWindow:true});
 if(active[0]?.id!==page.tabId)throw Error('请回到要录制的网页。');
 await restore(api);if(recordings.size)throw Error('已有正在录制或待保存的网页；点击原网页工具栏参伴图标停止或重试。');
 if(!api.tabCapture?.getMediaStreamId||!api.offscreen?.createDocument)throw Error('当前Edge不支持标签页录制，请更新浏览器。');
 const credentials=(await api.storage.local.get('refellow/cloud-connection'))['refellow/cloud-connection'];
 if(!credentials?.token)throw Error('请先在网站登录并连接采集器。');
 if(!await api.offscreen.hasDocument()){opening??=api.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'按用户框选录制当前标签页的可见画面，不录音'}).finally(()=>opening=null);await opening;}
 const id=crypto.randomUUID(),streamId=await api.tabCapture.getMediaStreamId({targetTabId:page.tabId});
 recordings.set(page.tabId,{id,page});
 try{const r=await api.runtime.sendMessage({target:'refellow/offscreen',action:'start',id,streamId,page,region:message.region,credentials});if(!r?.ok)throw Error(r?.error||'录制无法启动。');await api.action.setBadgeText({tabId:page.tabId,text:'STOP'});await api.action.setBadgeBackgroundColor({tabId:page.tabId,color:'#ad1e37'});await api.action.setTitle({tabId:page.tabId,title:'参伴：点击停止录制并保存到网站'});return {id};}
 catch(e){recordings.delete(page.tabId);throw e;}
}
export async function stopTabRecording(api,tabId,cancel=false){
 if(!recordings.has(tabId))await restore(api);
 const recording=recordings.get(tabId);if(!recording)return false;const result=await api.runtime.sendMessage({target:'refellow/offscreen',action:cancel?'cancel':'stop',id:recording.id});if(!result?.ok)throw Error(result?.error||'无法停止录制或保存，请重试。');return true;
}
export async function failedTabRecording(api,message,sender){
 if(sender.id!==api.runtime.id||sender.url!==api.runtime.getURL('offscreen.html'))throw Error('拒绝非录制文档消息。');
 await restore(api);const entry=[...recordings.entries()].find(([,r])=>r.id===message.id);if(!entry)return;
 const [tabId]=entry;await api.action.setBadgeText({tabId,text:'!'}).catch(()=>{});await api.action.setTitle({tabId,title:'参伴：上传失败，点击重试；录像仍保留'}).catch(()=>{});
 await api.tabs.sendMessage(tabId,{type:'refellow/record-error',error:message.error}).catch(()=>{});
}
export async function finishTabRecording(api,message,sender){
 if(sender.id!==api.runtime.id||sender.url!==api.runtime.getURL('offscreen.html'))throw Error('拒绝非录制文档消息。');
 const entry=[...recordings.entries()].find(([,r])=>r.id===message.id)||[message.page?.tabId,{id:message.id}];if(!entry[0])return;
 const [tabId]=entry;if(recordings.get(tabId)&&recordings.get(tabId).id!==message.id)return;recordings.delete(tabId);
 await api.action.setBadgeText({tabId,text:message.error?'!':''}).catch(()=>{});
 await api.action.setTitle({tabId,title:message.error?'保存失败：'+message.error:'参伴：显示悬浮采集器'}).catch(()=>{});
 await api.tabs.sendMessage(tabId,{type:'refellow/record-complete',...message}).catch(()=>{});
 if(!recordings.size&&await api.offscreen.hasDocument()){const state=await api.runtime.sendMessage({target:'refellow/offscreen',action:'status'});if(!state?.recording)await api.offscreen.closeDocument();}
}
