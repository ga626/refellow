// 由共享源打包为单个 ISOLATED 内容脚本。
import {mountFloatingCollector} from './shared/floating-ui.js';
import {selectCaptureRegion} from './shared/capture-region.js';
(() => {
 if(globalThis.__refellowFloating){globalThis.__refellowFloating.show();return;}
 let ui,recording=null,busy=false,closed=false,pendingShot=null;const lifetime=new AbortController();
 const request=async(action,data={})=>{const response=await chrome.runtime.sendMessage({type:'refellow/floating',action,pageURL:location.href,...data});if(!response?.ok)throw Object.assign(Error(response?.error||'连接已断开，请重新点击工具栏。'),{code:response?.code});return response;};
 const sync=()=>ui.state({pending:busy,isRecording:!!recording,review:false});
 async function action(name){
  if(name==='hide'){ui.hide();return;}
  if(name==='record'&&recording||name==='cancel-record'){await request('record-stop',{cancel:name==='cancel-record'});return;}
  if(busy)return;busy=true;sync();
  try{
   if(name==='shot'){
    if(!pendingShot){await ui.withoutOverlay(async()=>{const shot=await request('shot-start');const selected=await selectCaptureRegion(document,{image:shot.data,kind:'截图',signal:lifetime.signal});if(!selected){await request('shot-cancel',{ticket:shot.ticket});return;}pendingShot={ticket:shot.ticket,region:selected.region};});}
    if(pendingShot){ui.notice('正在保存到网站…');await request('shot-save',pendingShot);pendingShot=null;ui.notice('截图已保存到网站“我的收藏”。');}
   }
   if(name==='record'){
    await ui.withoutOverlay(async()=>{const selected=await selectCaptureRegion(document,{kind:'录制',signal:lifetime.signal});if(!selected)return;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));recording=await request('record-start',{region:selected.region});ui.suspend();});
    if(recording)ui.notice('正在录制，点击浏览器工具栏的参伴图标停止并保存。');
   }
   if(name==='website'||name==='inbox')await request('website');
   if(name==='connect')await request('connect');
  }catch(e){if(e.code==='shot-invalid')pendingShot=null;if(!closed){ui.resume();ui.open(true);ui.notice(e.message+(pendingShot?' 当前截图未丢失，点击截图可重试保存。':''),true);}}
  finally{busy=false;sync();}
 }
 ui=mountFloatingCollector(document,{onAction:action,onPosition:position=>request('position',{position}).catch(e=>ui.notice(e.message,true))});globalThis.__refellowFloating=ui;
 chrome.runtime.onMessage.addListener(message=>{if(message?.type==='refellow/show')ui.show();if(message?.type==='refellow/record-error'){ui.resume();sync();ui.open(true);ui.notice(message.error+' 录像暂留内存，点击工具栏重试保存。',true);}if(message?.type==='refellow/record-complete'){recording=null;ui.resume();sync();ui.open(true);ui.notice(message.cancelled?'录制已取消。':'录像已保存到网站“我的收藏”。');}});
 request('preferences').then(({position})=>{if(position&&!closed)ui.setPosition(position);}).catch(e=>ui.notice(e.message,true));
 window.addEventListener('pagehide',()=>{closed=true;lifetime.abort();if(recording)request('record-stop').catch(()=>{});ui.dispose();delete globalThis.__refellowFloating;},{once:true});
})();
