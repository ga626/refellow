import {mountFloatingCollector} from './shared/floating-ui.js';
import {startSilentRecording} from './shared/screen-recorder.js';
import {saveCapture} from './inbox.js';
let session,result,previewURL,busy=false,closed=false;
const sync=()=>ui.state({pending:busy,isRecording:!!session,review:!!result});
const clear=()=>{result=null;ui.clearPreview();if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;};
async function action(name){
  if(name==='hide'){ui.hide();return;}
  if(name==='inbox'){location.href='sidepanel.html#inbox';return;}
  if(name==='shot'){ui.notice('网页预览没有扩展截图权限。安装并授权扩展后，在真实网页使用。',true);return;}
  if(name==='discard-record'){clear();ui.notice('本段已丢弃。');return;}
  if(name==='record'&&session){busy=true;sync();session.stop();return;}
  if(name==='cancel-record'){busy=true;sync();session?.cancel();return;}
  if(busy)return;
  if(name==='record'){
    busy=true;sync();try{
      session=await startSilentRecording({onStatus:ui.notice,onProgress:p=>ui.tick(p.duration)});
      if(closed){session.cancel();await session.done;return;}
      busy=false;sync();result=await session.done;session=null;
      if(closed){result=null;return;}
      if(result){previewURL=URL.createObjectURL(result.blob);ui.preview(previewURL);ui.notice('已录下 '+result.duration.toFixed(1)+' 秒，请确认测试画面再保存。');}else ui.notice('已取消，没有保存。');
    }catch(e){session=null;ui.notice(e.name==='NotAllowedError'?'共享已取消，可以重试。':e.message,true);}finally{busy=false;sync();}return;
  }
  if(name==='save-record'){
    busy=true;sync();try{const id='media-'+crypto.randomUUID();await saveCapture({url:location.href,title:'悬浮采集器预览画面（用户选择共享目标）',attachments:[{id:'att-'+crypto.randomUUID(),kind:'video',mediaId:id,name:'预览静音录制',mime:result.blob.type,size:result.blob.size,duration:result.duration}]},[{id,blob:result.blob}]);clear();ui.notice('已保存到本地预览收件箱。');}catch(e){ui.notice(e.message,true);}finally{busy=false;sync();}
  }
}
let position;try{position=JSON.parse(localStorage.getItem('refellow-preview/floating-position')||'null');}catch{}
const ui=mountFloatingCollector(document,{position:position||{},onAction:action,onPosition:p=>localStorage.setItem('refellow-preview/floating-position',JSON.stringify(p))});
document.querySelector('#restore').addEventListener('click',()=>ui.show());
window.addEventListener('pagehide',()=>{closed=true;session?.cancel();if(previewURL)URL.revokeObjectURL(previewURL);ui.dispose();},{once:true});
