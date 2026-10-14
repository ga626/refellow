import {cleanURL} from './core.js';
import {handleFloatingMessage} from './floating-background.js';
import {stopTabRecording,finishTabRecording,failedTabRecording} from './native-recording.js';
import {clearExpiredShots} from './pending-shots.js';
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
  if(message?.type==='refellow/record-finished'){finishTabRecording(chrome,message,sender).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if(message?.type==='refellow/record-failed'){failedTabRecording(chrome,message,sender).then(()=>respond({ok:true}),e=>respond({ok:false,error:e.message}));return true;}
  if(message?.type!=='refellow/floating')return false;
  handleFloatingMessage(message,sender).then(result=>respond({ok:true,...result}),error=>respond({ok:false,error:error.message,code:error.code}));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId=>stopTabRecording(chrome,tabId).catch(()=>{}));
