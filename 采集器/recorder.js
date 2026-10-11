import {cleanURL} from './core.js';
import {startSilentRecording} from './shared/screen-recorder.js';
import {recipeFor} from './shared/recipes.js';
import {saveCapture} from './inbox.js';
const $=s=>document.querySelector(s),status=t=>$('#status').textContent=t;
const params=new URLSearchParams(location.search);$('#url').value=params.get('url')||'';$('#title').value=params.get('title')||'';
let session,result,previewURL,phase='idle',closed=false;
function controls(next){
  phase=next;const recording=next==='recording',waiting=['selecting','finishing'].includes(next);
  document.body.dataset.recording=String(recording);$('#toggle-record').disabled=waiting;
  $('#toggle-record').setAttribute('aria-pressed',String(recording));$('#cancel').hidden=!recording;
  $('#url').disabled=$('#title').disabled=recording||waiting;
  $('#toggle-label').textContent={idle:'开始录制',selecting:'选择共享网页…',recording:'停止录制',finishing:'正在完成…',review:'重新录制',saved:'再录一段'}[next];
  $('#record-state').textContent={idle:'准备好了',selecting:'等待选择',recording:'正在录制',finishing:'处理画面',review:'已结束',saved:'已收下'}[next];
}
function clearPreview(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('#preview').removeAttribute('src');$('#preview').load();}
$('#toggle-record').addEventListener('click',async()=>{
  if(phase==='recording'){controls('finishing');session?.stop();return;}
  if(['selecting','finishing'].includes(phase))return;
  if(result&&!window.confirm('这段录像还没有保存。重新录制会丢弃它，继续吗？'))return;
  try{
    cleanURL($('#url').value);if(!navigator.mediaDevices?.getDisplayMedia)throw Error('当前环境不支持屏幕选择器，请在Chrome / Edge中录制。');
    result=null;clearPreview();$('#review').hidden=true;$('#confirmed').checked=false;$('#save').disabled=true;$('#elapsed').textContent='00:00';controls('selecting');status('请选择要记录的共享网页。');
    session=await startSilentRecording({onStatus:status,onProgress:({duration})=>{const seconds=Math.floor(duration);$('#elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}});
    if(closed){session.cancel();await session.done;return;}
    controls('recording');result=await session.done;session=null;
    if(!result){controls('idle');if(!$('#status').textContent.includes('12MB'))status('本次录制已取消，没有保存文件。');return;}
    const seconds=Math.floor(result.duration);$('#elapsed').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    controls('review');previewURL=URL.createObjectURL(result.blob);$('#preview').src=previewURL;$('#review').hidden=false;
    status('已录下 '+result.duration.toFixed(1)+' 秒 · '+Math.ceil(result.blob.size/1024)+' KB，请核对画面和网址。');
  }catch(e){session=null;controls('idle');status(e.name==='NotAllowedError'?'没有开始录制：共享已取消或权限未获允许，可以重试。':e.message);}
});
$('#cancel').addEventListener('click',()=>{controls('finishing');session?.cancel();});
$('#confirmed').addEventListener('change',()=>$('#save').disabled=!$('#confirmed').checked||!result);
$('#save').addEventListener('click',async()=>{const b=$('#save');b.disabled=true;$('#toggle-record').disabled=true;try{if(!result||!$('#confirmed').checked)throw Error('请先核对画面与网址。');const url=cleanURL($('#url').value),recipe=recipeFor(url),id='media-'+crypto.randomUUID();await saveCapture({url,title:$('#title').value,attachments:[{id:'att-'+crypto.randomUUID(),kind:'video',name:'短录制',mediaId:id,mime:result.blob.type,size:result.blob.size,duration:result.duration}],provenance:{recipeId:recipe.id,section:recipe.section} },[{id,blob:result.blob}]);result=null;$('#review').hidden=true;clearPreview();controls('saved');status('已存到本地收件箱。回采集器导出，再到收藏夹整理。');}catch(e){status(e.message);b.disabled=!result||!$('#confirmed').checked;$('#toggle-record').disabled=false;}});
window.addEventListener('pagehide',()=>{closed=true;session?.cancel();clearPreview();});
$('#recipe').textContent=recipeFor($('#url').value).hint;
