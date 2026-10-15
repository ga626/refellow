import {cleanURL} from './core.js';
import {captureCurrentPage} from './browser.js';
import {fromBase64,validateBlob} from './shared/media-store.js';
import {saveCapture} from './inbox.js';
import {recipeFor} from './shared/recipes.js';
import {cropScreenshot,pixelRegion} from './shared/capture-region.js';
import {uploadCapture,CLOUD_ORIGIN,captureOrigin} from './cloud-connection.js';
import {startTabRecording,stopTabRecording} from './native-recording.js';
import {readPendingShot,removePendingShot,savePendingShot} from './pending-shots.js';
const POSITION='refellow-collector/floating-position-v1';
export async function trustedPage(api,sender,expectedURL){
  if(sender.id!==api.runtime.id||!sender.tab?.id||sender.frameId!==0)throw Error('拒绝非当前扩展顶层网页请求。');
  const tab=await api.tabs.get(sender.tab.id),url=cleanURL(tab.url||sender.url||'');
  let title=tab.title||sender.tab.title||'';
  if(cleanURL(sender.url||'')!==url||expectedURL&&cleanURL(expectedURL)!==url)throw Error('页面网址已改变，请重新打开采集器。');
  if(expectedURL&&sender.documentId&&api.tabs.sendMessage){
    const current=await api.tabs.sendMessage(tab.id,{type:'refellow/context'},{documentId:sender.documentId,frameId:0}).catch(()=>{throw Error('页面已刷新或关闭，请在当前网页重新打开采集器。');});
    if(current?.url!==url)throw Error('页面网址已改变，请重新打开采集器。');
    title=current.title||title;
  }
  return {url,title:String(title).slice(0,120),tabId:tab.id,windowId:tab.windowId};
}
export async function handleFloatingMessage(message,sender,api=chrome,save=saveCapture){
  const page=await trustedPage(api,sender,message.pageURL);
  if(message.action==='connect'){const data=await api.storage.local.get(['refellow/cloud-connection','refellow/account-origin']);await api.tabs.create({url:captureOrigin(data['refellow/cloud-connection']?.origin||data['refellow/account-origin']||CLOUD_ORIGIN)+'/#account'});return {};}
  if(message.action==='website'){const connection=(await api.storage.local.get('refellow/cloud-connection'))['refellow/cloud-connection'];await api.tabs.create({url:captureOrigin(connection?.origin||CLOUD_ORIGIN)+'/#collection'});return {};}
  if(message.action==='record-start'){pixelRegion(message.region,1000,1000);return startTabRecording(api,sender,message);}
  if(message.action==='record-stop'){await stopTabRecording(api,page.tabId,message.cancel===true);return {};}
  if(message.action==='shot-start'){
    const connection=(await api.storage.local.get('refellow/cloud-connection'))['refellow/cloud-connection'];if(!connection?.token)throw Error('请先登录参伴网站，采集器会自动识别账户。点击菜单中的“账户”前往登录。');
    const [active]=await api.tabs.query({active:true,currentWindow:true});if(active?.id!==page.tabId)throw Error('请回到要截图的网页。');
    let data;try{data=await api.tabs.captureVisibleTab(page.windowId,{format:'png'});}catch(e){throw Error('当前网页尚未授权截图。请在 Edge 右上角扩展菜单点一次参伴，再回小球截图。'+(e.message?'（'+e.message+'）':''));}await trustedPage(api,sender,page.url);
    const [after]=await api.tabs.query({active:true,currentWindow:true});if(after?.id!==page.tabId)throw Error('截图时切换了网页，请重试。');
    const ticket=crypto.randomUUID();await savePendingShot({ticket,data,page,connection,expires:Date.now()+5*60*1000});return {data,ticket};
  }
  if(message.action==='shot-cancel'){if((await readPendingShot(message.ticket))?.page.tabId===page.tabId)await removePendingShot(message.ticket);return {};}
  if(message.action==='shot-save'){
    const shot=await readPendingShot(message.ticket);if(!shot||shot.expires<Date.now()||shot.page.tabId!==page.tabId||shot.page.url!==page.url)throw Object.assign(Error('截图已过期，请重新框选。'),{code:'shot-invalid'});
    const image=await cropScreenshot(fromBase64({id:'capture',mime:'image/png',data:shot.data.split(',')[1]}),message.region);
    const connection=(await api.storage.local.get('refellow/cloud-connection'))['refellow/cloud-connection'];
    if(connection?.token!==shot.connection.token){await removePendingShot(message.ticket);throw Object.assign(Error('连接的账户已改变，请重新截图。'),{code:'shot-invalid'});}
    const result=await uploadCapture(connection,{...page,captureMethod:'region-screenshot'},image,'shot-'+message.ticket);await removePendingShot(message.ticket);return result;
  }
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
