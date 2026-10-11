import {cleanURL} from './core.js';
import {captureCurrentPage} from './browser.js';
import {fromBase64,validateBlob} from './shared/media-store.js';
import {saveCapture} from './inbox.js';
import {recipeFor} from './shared/recipes.js';
const POSITION='refellow-collector/floating-position-v1';
export async function trustedPage(api,sender,expectedURL){
  if(sender.id!==api.runtime.id||!sender.tab?.id||sender.frameId!==0)throw Error('拒绝非当前扩展顶层网页请求。');
  const tab=await api.tabs.get(sender.tab.id),url=cleanURL(tab.url||'');
  if(cleanURL(sender.url||'')!==url||expectedURL&&cleanURL(expectedURL)!==url)throw Error('页面网址已改变，请重新打开采集器。');
  return {url,title:String(tab.title||'').slice(0,120),tabId:tab.id,windowId:tab.windowId};
}
export async function handleFloatingMessage(message,sender,api=chrome,save=saveCapture){
  const page=await trustedPage(api,sender,message.pageURL);
  if(message.action==='preferences')return {position:(await api.storage.local.get(POSITION))[POSITION]||null};
  if(message.action==='position'){
    const p=message.position;if(!p||!['left','right'].includes(p.side)||!Number.isFinite(p.ratio)||p.ratio<0||p.ratio>1)throw Error('悬浮位置无效。');
    await api.storage.local.set({[POSITION]:{side:p.side,ratio:p.ratio}});return {};
  }
  if(message.action==='inbox'){await api.tabs.create({url:api.runtime.getURL('sidepanel.html#inbox')});return {};}
  let blob,duration=0;
  if(message.action==='shot'){
    const data=await captureCurrentPage(api,page);blob=fromBase64({id:'capture',mime:'image/jpeg',data:data.split(',')[1]});
  }else if(message.action==='save-record'){
    const media=message.media;duration=media?.duration;
    if(!Number.isFinite(duration)||duration<=0||duration>120||!/^video\/(webm|mp4)(;codecs=[a-zA-Z0-9., -]+)?$/.test(media?.mime||''))throw Error('录像长度或格式无效。');
    blob=await validateBlob(fromBase64({id:'capture',...media}));
  }else throw Error('未知采集操作。');
  await trustedPage(api,sender,page.url);
  const recipe=recipeFor(page.url),id='media-'+crypto.randomUUID();
  await save({...page,captureMethod:message.action==='shot'?'floating-screenshot':'floating-recording',attachments:[{id:'att-'+crypto.randomUUID(),kind:duration?'video':'image',name:duration?'静音录制':'可见区域截图',mediaId:id,mime:blob.type,size:blob.size,...(duration?{duration}:{})}],provenance:{recipeId:recipe.id,section:recipe.section} },[{id,blob}]);
  return {};
}
