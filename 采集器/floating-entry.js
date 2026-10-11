// 此源由构建脚本和共享模块打包为单个ISOLATED内容脚本；不使用网页消息桥。
import {mountFloatingCollector} from './shared/floating-ui.js';
import {startSilentRecording} from './shared/screen-recorder.js';
(() => {
  if(globalThis.__refellowFloating){globalThis.__refellowFloating.show();return;}
  let ui,session,result,previewURL,closed=false,busy=false,recordURL;
  const request=async(action,data={})=>{const response=await chrome.runtime.sendMessage({type:'refellow/floating',action,...data});if(!response?.ok)throw Error(response?.error||'采集器连接已断开，请重新点击工具栏图标。');return response;};
  const base64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('录像读取失败，请重试。'));reader.readAsDataURL(blob);});
  const clear=()=>{result=null;ui.clearPreview();if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;};
  const sync=(pending=busy)=>ui.state({pending,isRecording:!!session,review:!!result});
  async function action(name){
    if(name==='hide'){ui.hide();return;}
    if(name==='discard-record'){clear();ui.notice('本段已丢弃。');return;}
    if(name==='cancel-record'){if(session){busy=true;sync();session.cancel();}return;}
    if(name==='record'&&session){busy=true;sync();session.stop();return;}
    if(busy)return;
    if(name==='record'){
      if(result)throw Error('请先保存或丢弃这段录像。');
      busy=true;sync();ui.notice('请选择要记录的共享网页。单段最多2分钟 / 12MB。');
      const startedURL=location.href;
      try{
        // getDisplayMedia必须在本次用户手势中调用，不能等待后台往返。
        session=await startSilentRecording({onStatus:t=>ui.notice(t),onProgress:p=>ui.tick(p.duration)});
        if(closed){session.cancel();await session.done;return;}
        recordURL=startedURL;busy=false;sync();
        const recording=await session.done;session=null;
        if(closed)return;
        if(!recording){ui.notice('录制已取消，没有保存。');return;}
        if(location.href!==startedURL){ui.notice('录制期间页面网址改变，本段已丢弃，请在新页面重录。',true);return;}
        result=recording;previewURL=URL.createObjectURL(result.blob);ui.preview(previewURL);
        ui.notice('已录下 '+result.duration.toFixed(1)+' 秒。请核对画面，再保存。');
      }catch(e){session=null;ui.notice(e.name==='NotAllowedError'?'共享已取消或权限未允许；可以重试。':e.message,true);}
      finally{busy=false;sync();}
      return;
    }
    busy=true;sync();
    try{
      if(name==='shot'){ui.notice('正在保存当前可见画面…');await ui.withoutOverlay(()=>request('shot',{pageURL:location.href}));ui.notice('截图已收下。回收件箱再整理。');}
      if(name==='save-record'){
        if(!result)throw Error('没有可保存的录像。');
        ui.notice('正在保存录像…');await request('save-record',{pageURL:recordURL,media:{mime:result.blob.type,data:await base64(result.blob),duration:result.duration}});clear();ui.notice('录像已收下，仍保留原网址。');
      }
      if(name==='inbox'){await request('inbox');ui.open(false);}
    }catch(e){ui.notice(e.message,true);}
    finally{busy=false;sync();}
  }
  ui=mountFloatingCollector(document,{onAction:action,onPosition:position=>request('position',{position}).catch(e=>ui.notice('位置没有记住：'+e.message,true))});
  globalThis.__refellowFloating=ui;
  chrome.runtime.onMessage.addListener(message=>{if(message?.type==='refellow/show'){ui.show();return;}});
  request('preferences').then(({position})=>{if(position&&!closed)ui.setPosition(position);}).catch(e=>ui.notice(e.message,true));
  window.addEventListener('pagehide',()=>{closed=true;session?.cancel();if(previewURL)URL.revokeObjectURL(previewURL);ui.dispose();delete globalThis.__refellowFloating;},{once:true});
})();
