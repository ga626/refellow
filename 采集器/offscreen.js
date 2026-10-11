import {pixelRegion} from './shared/capture-region.js';
import {uploadCapture} from './cloud-connection.js';
let current;
async function begin(message){
 if(current)throw Error('正在录制，先停止当前片段。');
 let source,output,video,recorder,canvas,frame,ended=false,started=performance.now();
 const chunks=[],job={id:message.id,page:message.page};current=job;
 const cleanup=()=>{if(ended)return;ended=true;source?.getTracks().forEach(t=>t.stop());output?.getTracks().forEach(t=>t.stop());if(frame!==undefined)video?.cancelVideoFrameCallback?.(frame);video?.pause();if(video)video.srcObject=null;};
 try{
  source=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}}});
  video=document.createElement('video');video.muted=true;video.srcObject=source;await video.play();
  const r=pixelRegion(message.region,video.videoWidth,video.videoHeight);canvas=document.createElement('canvas');canvas.width=r.width;canvas.height=r.height;const context=canvas.getContext('2d',{alpha:false});
  const paint=()=>{if(ended)return;const p=pixelRegion(message.region,video.videoWidth,video.videoHeight);context.drawImage(video,p.x,p.y,p.width,p.height,0,0,r.width,r.height);frame=video.requestVideoFrameCallback(paint);};paint();output=canvas.captureStream(30);
  const mime=['video/webm;codecs=vp8','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)throw Error('当前Edge没有可用录制编码。');
  recorder=new MediaRecorder(output,{mimeType:mime,videoBitsPerSecond:2500000});let bytes=0,cancelled=false,error;
  let duration;job.stop=()=>{if(recorder.state!=='inactive'){duration=(performance.now()-started)/1000;recorder.stop();}};job.cancel=()=>{cancelled=true;job.stop();};
  recorder.ondataavailable=e=>{if(!e.data.size)return;chunks.push(e.data);bytes+=e.data.size;if(bytes>60*1024*1024)job.stop();};
  recorder.onerror=e=>{error=e.error?.message||'录制失败。';cancelled=true;job.stop();};
  recorder.onstop=async()=>{
   cleanup();job.uploading=true;
   try{if(error)throw Error(error);if(!cancelled){if(!bytes)throw Error('没有录到画面。');const blob=new Blob(chunks,{type:mime});await uploadCapture(message.credentials,{...message.page,captureMethod:'tab-region-recording',duration},blob,'record-'+job.id);}}
   catch(e){error=e.message;job.retryBlob=chunks.length?new Blob(chunks,{type:mime}):null;job.error=error;job.retry=async()=>{if(job.uploading)return;job.uploading=true;try{if(!job.retryBlob)throw Error(job.error);await uploadCapture(message.credentials,{...message.page,captureMethod:'tab-region-recording',duration},job.retryBlob,'record-'+job.id);current=null;await chrome.runtime.sendMessage({type:'refellow/record-finished',id:message.id,page:message.page});}finally{job.uploading=false;}};}
   job.uploading=false;if(error){await chrome.runtime.sendMessage({type:'refellow/record-failed',id:message.id,error});return;}
   current=null;await chrome.runtime.sendMessage({type:'refellow/record-finished',id:message.id,page:message.page,cancelled});
  };
  source.getVideoTracks()[0].addEventListener('ended',job.stop,{once:true});started=performance.now();recorder.start(1000);return {ok:true};
 }catch(e){cleanup();current=null;throw e;}
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
 if(m.target!=='refellow/offscreen'||sender.id!==chrome.runtime.id||sender.tab)return false;
 const run=async()=>{if(m.action==='status')return {ok:true,recording:current?{id:current.id,page:current.page}:null};if(m.action==='start')return begin(m);if(current?.id!==m.id)throw Error('录制身份已改变。');if(current.uploading)return {ok:true};if(m.action==='cancel'){if(current.error){const page=current.page;current=null;await chrome.runtime.sendMessage({type:'refellow/record-finished',id:m.id,page,cancelled:true});}else current.cancel();}else if(m.action==='stop'){if(current.error)await current.retry();else current.stop();}return {ok:true};};
 run().then(reply,e=>reply({ok:false,error:e.message}));return true;
});
