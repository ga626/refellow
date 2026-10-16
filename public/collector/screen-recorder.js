// 用户主动选择共享目标、手动停止；上限与工作台的视频合同相同。
export const RECORDING_LIMIT_SECONDS = 120;
export async function startSilentRecording({onStatus=()=>{},onProgress=()=>{},limit=RECORDING_LIMIT_SECONDS,display=()=>navigator.mediaDevices.getDisplayMedia({video:{frameRate:12},audio:false}),Recorder=MediaRecorder,now=()=>Date.now()}={}){
  if(!Number.isFinite(limit)||limit<=0||limit>RECORDING_LIMIT_SECONDS)throw Error('录制保护上限应在120秒以内。');
  const stream=await display();
  const release=()=>stream.getTracks().forEach(t=>t.stop());
  for(const t of stream.getAudioTracks())t.stop();
  const mime=['video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>Recorder.isTypeSupported(t));
  if(!mime){release();throw Error('当前浏览器没有可用录制格式；请改用截图。');}
  let recorder;try{recorder=new Recorder(stream,{mimeType:mime,videoBitsPerSecond:700000});}catch(err){release();throw err;}
  const chunks=[];let bytes=0,discard=false,timer,ticker,started,settled=false,stopping=false;
  const elapsed=()=>Math.min(limit,Math.max(0,(now()-started)/1000));
  const cleanup=()=>{clearTimeout(timer);clearInterval(ticker);release();};
  const done=new Promise((resolve,reject)=>{
    recorder.ondataavailable=e=>{if(settled||!e.data.size)return;chunks.push(e.data);bytes+=e.data.size;if(bytes>12*1024*1024){discard=true;onStatus('视频超过12MB，本次已取消，请录更短片段。');stop();}};
    recorder.onerror=()=>{if(settled)return;settled=true;discard=true;try{stop();}finally{cleanup();reject(Error('录制失败，请重试或改用截图。'));}};
    recorder.onstop=()=>{if(settled)return;settled=true;const duration=elapsed();cleanup();if(discard){resolve(null);return;}if(!bytes){reject(Error('没有录到视频内容，请重新选择共享网页。'));return;}resolve({blob:new Blob(chunks,{type:mime}),duration});};
  });
  function stop(){if(!stopping&&recorder.state!=='inactive'){stopping=true;recorder.stop();}}
  function cancel(){discard=true;stop();}
  stream.getVideoTracks()[0]?.addEventListener('ended',stop,{once:true});
  try{started=now();recorder.start(250);}catch(err){cleanup();throw err;}
  timer=setTimeout(()=>{onStatus('已到录制保护上限，正在完成录制。');stop();},limit*1000);
  ticker=setInterval(()=>onProgress({duration:elapsed(),bytes}),250);
  onProgress({duration:0,bytes:0});onStatus('正在录制，再点一次按钮即可停止。');
  return {stop,cancel,done};
}
