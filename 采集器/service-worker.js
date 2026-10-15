import {cleanURL} from './core.js';
import {handleFloatingMessage} from './floating-background.js';
import {stopTabRecording,finishTabRecording,failedTabRecording,processingTabRecording} from './native-recording.js';
import {clearExpiredShots} from './pending-shots.js';
import {synchronizeAccount,enableLocalBridge} from './account-session.js';
let accountQueue=Promise.resolve();
enableLocalBridge(chrome).catch(()=>{});
chrome.permissions.onAdded.addListener(()=>enableLocalBridge(chrome).catch(()=>{}));
chrome.runtime.onInstalled.addListener(async()=>{await enableLocalBridge(chrome).catch(()=>{});const tabs=await chrome.tabs.query({url:['https://lingganji.pages.dev/*','https://*.lingganji.pages.dev/*']});for(const tab of tabs)await chrome.scripting.executeScript({target:{tabId:tab.id},files:['account-bridge.js']}).catch(()=>{});});
clearExpiredShots().catch(()=>{});
// 黄页18站由manifest自动注入，其余网页由工具栏手势注入；无侧栏。
chrome.action.onClicked.addListener(async tab=>{
  try{
    if(await stopTabRecording(chrome,tab.id))return;
    cleanURL(tab.url||'');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['floating.js']});
    await chrome.action.setBadgeText({tabId:tab.id,text:''});
    await chrome.action.setTitle({tabId:tab.id,title:'参伴：显示悬浮采集器'});
  }catch(error){
    await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
    await chrome.action.setBadgeBackgroundColor({tabId:tab.id,color:'#ad1e37'});
    await chrome.action.setTitle({tabId:tab.id,title:'参伴：'+error.message});
  }
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type==='refellow/account-sync'){accountQueue=accountQueue.catch(()=>{}).then(()=>synchronizeAccount(chrome,message,sender));accountQueue.then(respond,e=>respond({ok:false,error:e.message}));return true;}
  if(message?.type==='refellow/record-processing'){processingTabRecording(chrome,message,sender).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if(message?.type==='refellow/record-finished'){finishTabRecording(chrome,message,sender).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if(message?.type==='refellow/record-failed'){failedTabRecording(chrome,message,sender).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if(message?.type!=='refellow/floating')return false;
  handleFloatingMessage(message,sender).then(result=>respond({ok:true,...result}),error=>respond({ok:false,error:error.message,code:error.code}));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId=>stopTabRecording(chrome,tabId).catch(()=>{}));
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url)stopTabRecording(chrome,tabId).catch(()=>{});});
