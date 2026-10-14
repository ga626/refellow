// Generated from public/collector and floating-entry.js; do not edit.
(()=>{
const FLOAT_SIZE=44;
function dockPosition(raw={},viewport={width:800,height:600}){
  const width=Math.max(FLOAT_SIZE,viewport.width),height=Math.max(FLOAT_SIZE,viewport.height);
  const side=raw.side==='left'?'left':'right';
  const ratio=Number.isFinite(raw.ratio)?Math.max(0,Math.min(1,raw.ratio)):.64;
  return {side,ratio,x:side==='left'?8:Math.max(0,width-FLOAT_SIZE-8),y:Math.max(8,Math.min(height-FLOAT_SIZE-8,ratio*(height-FLOAT_SIZE)))};
}
function mountFloatingCollector(doc,{position={},onAction=()=>{},onPosition=()=>{},inspectable=false}={}){
  const win=doc.defaultView,abort=new AbortController();
  const host=doc.createElement('div');host.setAttribute('data-refellow-floating','');
  host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;color-scheme:light!important;';
  const root=host.attachShadow({mode:inspectable?'open':'closed'});
  const icons={shot:'<path d="M8 5l1-2h6l1 2h4v14H4V5z"/><circle cx="12" cy="12" r="4"/>',record:'<rect x="3" y="5" width="13" height="14" rx="3"/><path d="M16 9l5-3v12l-5-3"/>',inbox:'<path d="M4 4h16v16H4zM4 13h5l1 3h4l1-3h5"/>',hide:'<path d="M3 3l18 18M10 5c6-1 10 7 10 7l-3 3M14 19c-6 1-10-7-10-7l3-3"/>',check:'<path d="M5 12l4 4L19 6"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>'};
  const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>';
  root.innerHTML='<div class="dock"><button class="orb" aria-label="参伴采集菜单；可拖动或用方向键移动" aria-expanded="false" aria-controls="refellow-menu"><svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1.5"/><rect x="18" y="6" width="8" height="8" rx="1.5"/><rect x="6" y="18" width="8" height="8" rx="1.5"/><rect x="18" y="18" width="8" height="8" rx="1.5"/></svg><span class="record-led" hidden></span></button><section class="menu" id="refellow-menu" aria-label="参伴采集" hidden><header><strong>参伴</strong><span>随看随收</span><button class="close" aria-label="收起菜单">'+icon('close')+'</button></header><div class="actions"><button data-action="shot">'+icon('shot')+'<span>截一张<small>框选或整个可见画面</small></span></button><button data-action="record">'+icon('record')+'<span class="record-label">录一段<small>点击开始，再点停止</small></span><output class="timer" hidden>00:00</output></button></div><p class="status" role="status" aria-live="polite" hidden></p><section class="review" hidden><video controls playsinline muted></video><label><input type="checkbox">确认画面和来源，可保存</label><div class="review-actions"><button data-action="save-record">'+icon('check')+'保存到我的收藏</button><button data-action="connect">连接账户</button><button data-action="discard-record">丢弃</button></div></section><button class="cancel" data-action="cancel-record" hidden>取消本次录制</button><footer><button data-action="website">'+icon('inbox')+'收藏</button><button data-action="connect">连接账户</button><button data-action="hide">'+icon('hide')+'隐藏</button></footer><p class="privacy">保存到个人网站空间 · 不录音</p></section></div>';
  const sheet=new win.CSSStyleSheet();sheet.replaceSync(FLOAT_CSS);root.adoptedStyleSheets=[sheet];
  doc.documentElement.append(host);
  const $=s=>root.querySelector(s),dock=$('.dock'),orb=$('.orb'),menu=$('.menu');
  let saved=position,drag=null,suppressClick=false,opened=false,busy=false,recording=false,hasReview=false,hidden=false,suspended=false;
  function place(raw=saved){saved=raw;const p=dockPosition(saved,{width:win.innerWidth,height:win.innerHeight});dock.style.left=p.x+'px';dock.style.top=p.y+'px';dock.dataset.side=p.side;layout();return p;}
  function layout(){menu.style.top='auto';menu.style.bottom='0';if(!opened)return;const bounds=menu.getBoundingClientRect();if(bounds.top<8){menu.style.bottom='auto';menu.style.top='0';}const b=menu.getBoundingClientRect();if(b.bottom>win.innerHeight-8){menu.style.top=(win.innerHeight-8-b.height-dock.getBoundingClientRect().top)+'px';menu.style.bottom='auto';}}
  function open(value= !opened){if(hidden)return;opened=value;menu.hidden=!value;orb.setAttribute('aria-expanded',String(value));dock.dataset.open=String(value);if(value){layout();}else orb.focus({preventScroll:true});}
  function act(name){Promise.resolve().then(()=>onAction(name)).catch(e=>notice(e.message,true));}
  function notice(text,error=false){$('.status').textContent=text;$('.status').hidden=!text;$('.status').dataset.error=String(error);layout();}
  orb.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}open();},{signal:abort.signal});
  orb.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:parseFloat(dock.style.left),top:parseFloat(dock.style.top),moved:false,opened};orb.setPointerCapture(e.pointerId);},{signal:abort.signal});
  orb.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;menu.hidden=true;dock.dataset.dragging='true';dock.style.left=Math.max(0,Math.min(win.innerWidth-FLOAT_SIZE,drag.left+dx))+'px';dock.style.top=Math.max(8,Math.min(win.innerHeight-FLOAT_SIZE-8,drag.top+dy))+'px';},{signal:abort.signal});
  function endDrag(e){if(!drag||e.pointerId!==drag.id)return;const was=drag;drag=null;delete dock.dataset.dragging;if(orb.hasPointerCapture(e.pointerId))orb.releasePointerCapture(e.pointerId);if(was.moved){suppressClick=e.type==='pointerup';const left=parseFloat(dock.style.left),top=parseFloat(dock.style.top);saved={side:left+FLOAT_SIZE/2<win.innerWidth/2?'left':'right',ratio:top/Math.max(1,win.innerHeight-FLOAT_SIZE)};place();menu.hidden=!opened;onPosition(saved);}}
  orb.addEventListener('pointerup',endDrag,{signal:abort.signal});orb.addEventListener('pointercancel',endDrag,{signal:abort.signal});
  orb.addEventListener('keydown',e=>{if(e.key==='Escape'){open(false);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')saved={...saved,side:'left'};if(e.key==='ArrowRight')saved={...saved,side:'right'};if(e.key==='ArrowUp'||e.key==='ArrowDown')saved={...saved,ratio:Math.max(0,Math.min(1,(saved.ratio??.64)+(e.key==='ArrowUp'?-.06:.06)))};place();onPosition(saved);},{signal:abort.signal});
  $('.close').addEventListener('click',()=>open(false),{signal:abort.signal});
  menu.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button&&!button.disabled)act(button.dataset.action);},{signal:abort.signal});
  $('.review input').addEventListener('change',()=>$('.review-actions button').disabled=!$('.review input').checked||busy,{signal:abort.signal});
  doc.addEventListener('pointerdown',e=>{if(opened&&!e.composedPath().includes(host))open(false);},{capture:true,signal:abort.signal});
  root.addEventListener('keydown',e=>{if(e.key==='Escape')open(false);if(e.key==='Tab'&&opened){const stops=[...root.querySelectorAll('button,input,video')].filter(x=>!x.disabled&&x.getClientRects().length);const current=root.activeElement,index=stops.indexOf(current);if(e.shiftKey&&index<=0){e.preventDefault();stops.at(-1)?.focus();}else if(!e.shiftKey&&index===stops.length-1){e.preventDefault();stops[0]?.focus();}}},{signal:abort.signal});
  win.addEventListener('resize',()=>place(),{signal:abort.signal});
  function state({pending=busy,isRecording=recording,review=hasReview}={}){busy=pending;recording=isRecording;hasReview=review;dock.dataset.recording=String(recording);$('.record-led').hidden=!recording;$('.timer').hidden=!recording;$('.cancel').hidden=!recording;$('.record-label').innerHTML=recording?'停止录制<small>再点一次，留下这段</small>':'录一段<small>点击开始，再点停止</small>';for(const b of menu.querySelectorAll('[data-action]'))b.disabled=busy||(recording&& !['record','cancel-record'].includes(b.dataset.action))||(hasReview&&['record','shot','hide'].includes(b.dataset.action));$('.review-actions button').disabled=busy||!$('.review input').checked;layout();}
  place();
  return {host,open,notice,state,suspend(){suspended=true;host.style.setProperty("visibility","hidden","important");},resume(){suspended=false;host.style.setProperty("visibility",hidden?"hidden":"visible","important");},position:()=>saved,setPosition:place,show(){hidden=false;host.style.setProperty('visibility','visible','important');place();},hide(){if(recording||busy||hasReview){notice('请先结束录制并保存或丢弃画面。');return false;}open(false);hidden=true;host.style.setProperty('visibility','hidden','important');return true;},tick(seconds){const value=Math.floor(seconds);$('.timer').textContent=String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');},preview(url){$('.review input').checked=false;$('.review video').src=url;$('.review').hidden=false;hasReview=true;state({review:true});open(true);},clearPreview(){const v=$('.review video');v.pause();v.removeAttribute('src');v.load();$('.review').hidden=true;hasReview=false;state({review:false});},async withoutOverlay(fn){const previous=host.style.visibility;host.style.setProperty('visibility','hidden','important');try{await new Promise((resolve,reject)=>{const timeout=win.setTimeout(()=>reject(Error('网页未能刷新画面，请回到当前标签页再截图。')),1500);win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{win.clearTimeout(timeout);resolve();}));});if(doc.hidden)throw Error('请回到当前标签页再截图。');return await fn();}finally{host.style.setProperty('visibility',hidden||suspended?'hidden':previous||'visible','important');}},dispose(){abort.abort();$('.review video').pause();host.remove();}};
}
const FLOAT_CSS=String.raw`
:host{all:initial;--blue:#2348f4;--ink:#17202c;--muted:#566272;--line:#e0e5ed;font:14px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;color:var(--ink);color-scheme:light}
*{box-sizing:border-box}button,input,output{font:inherit}button{cursor:pointer;border:0;color:inherit}button:focus-visible,input:focus-visible{outline:3px solid var(--blue);outline-offset:3px}button:disabled{cursor:default;color:var(--muted);background:#f3f5fa}button:active:not(:disabled){transform:scale(.97)}[hidden]{display:none!important}
.dock{position:absolute;width:44px;height:44px;pointer-events:none}.orb{pointer-events:auto;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:white;box-shadow:0 3px 16px #17202c26;touch-action:none;user-select:none;opacity:.64;transition:opacity 120ms,transform 160ms cubic-bezier(.2,0,0,1)}.orb:hover,.orb:focus-visible,[data-open=true] .orb,[data-recording=true] .orb{opacity:1}.mark{width:27px;height:27px;fill:var(--blue)}.record-led{position:absolute;right:0;top:0;width:9px;height:9px;background:#ad1e37;border:2px solid #fff;border-radius:50%;animation:pulse 1.5s ease-in-out infinite}[data-dragging=true] .orb{opacity:1;cursor:grabbing}
.menu{position:absolute;bottom:0;right:54px;width:min(264px,calc(100vw - 72px));max-height:calc(100vh - 16px);overflow:auto;pointer-events:auto;background:#fff;border-radius:14px;box-shadow:0 8px 30px #17202c24;padding:16px;animation:unfold 180ms cubic-bezier(.2,0,0,1);transform-origin:right bottom;scrollbar-width:thin;scrollbar-color:#cad1dd #fff}
[data-side=left] .menu{right:auto;left:54px;transform-origin:left bottom}header{display:flex;align-items:center;gap:8px;margin:0 0 12px}header strong{font-size:16px;font-weight:650}header span{font-size:11px;color:var(--muted)}.close{margin-left:auto;width:28px;height:28px;background:transparent;display:grid;place-items:center;border-radius:6px}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}.close svg{width:16px;height:16px}
.actions{display:grid;gap:6px}.actions button{min-height:58px;background:#f3f5fa;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:9px;text-align:left;transition:background 100ms,transform 160ms}.actions button:hover:not(:disabled){background:#eef2ff;color:var(--blue)}.actions small{display:block;font-size:11px;color:var(--muted);margin-top:2px}.actions span{font-size:14px;font-weight:600}.timer{margin-left:auto;font-size:13px;font-variant-numeric:tabular-nums}[data-recording=true] [data-action=record]{background:#fff0f2;color:#ad1e37}[data-recording=true] [data-action=record] small{color:#ad1e37}.status{font-size:12px;line-height:1.65;background:#eef2ff;color:#183bd4;border-radius:7px;padding:10px;margin:10px 0;overflow-wrap:anywhere}.status[data-error=true]{color:#9d2137;background:#fff0f2}.review{margin:12px 0}.review video{width:100%;max-height:150px;background:#f3f5fa;border-radius:8px}.review label{display:flex;align-items:flex-start;gap:6px;font-size:11px;margin:8px 0;color:var(--muted)}input{accent-color:var(--blue)}.review-actions{display:flex;gap:6px;flex-wrap:wrap}.review-actions button{display:flex;gap:5px;align-items:center;min-height:40px;padding:8px;border-radius:7px;background:#f3f5fa;font-size:12px}.review-actions button:first-child:not(:disabled){background:var(--blue);color:#fff}.review-actions svg{width:16px;height:16px}.cancel{font-size:12px;color:#ad1e37;background:transparent;min-height:40px;width:100%}footer{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:12px;padding-top:8px}footer button{display:flex;align-items:center;gap:6px;font-size:12px;background:transparent;min-height:36px;padding:6px;color:var(--muted)}footer svg{width:16px;height:16px}.privacy{font-size:10px;color:var(--muted);margin:8px 0 0;text-align:center}@keyframes unfold{from{opacity:.6;transform:translateX(3px) scale(.98)}to{opacity:1;transform:none}}@keyframes pulse{50%{opacity:.4;transform:scale(.8)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}button:active:not(:disabled){transform:none}}
`;

function captureRegion(rect,viewport){
  if(!viewport||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0)throw Error('页面尺寸无效。');
  if(!rect)return {x:0,y:0,width:1,height:1};
  if(!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))throw Error('框选坐标无效。');
  const x=Math.max(0,Math.min(viewport.width,rect.x)),y=Math.max(0,Math.min(viewport.height,rect.y));
  const width=Math.min(viewport.width-x,rect.width),height=Math.min(viewport.height-y,rect.height);
  if(width<8||height<8)throw Error('请拖出至少8像素的区域。');
  return {x:x/viewport.width,y:y/viewport.height,width:width/viewport.width,height:height/viewport.height};
}
function pixelRegion(region,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!region||!['x','y','width','height'].every(k=>Number.isFinite(region[k]))||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>1.000001||region.y+region.height>1.000001)throw Error('画面裁切范围无效。');
  const x=Math.floor(region.x*width),y=Math.floor(region.y*height);
  return {x,y,width:Math.max(1,Math.min(width-x,Math.round(region.width*width))),height:Math.max(1,Math.min(height-y,Math.round(region.height*height)))};
}
async function cropScreenshot(blob,region,{decode=createImageBitmap,Canvas=OffscreenCanvas}={}){
  const image=await decode(blob);
  try{const r=pixelRegion(region,image.width,image.height),canvas=new Canvas(r.width,r.height);canvas.getContext('2d').drawImage(image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);return await canvas.convertToBlob({type:'image/png'});}finally{image.close();}
}
function dragCaptureRect(original,handle,dx,dy,viewport){
  const clamp=(v,max)=>Math.max(0,Math.min(max,v));
  if(handle==='move')return {...original,x:clamp(original.x+dx,viewport.width-original.width),y:clamp(original.y+dy,viewport.height-original.height)};
  let left=original.x,right=left+original.width,top=original.y,bottom=top+original.height;
  if(handle.includes('w'))left=clamp(left+dx,right-8);
  if(handle.includes('e'))right=Math.max(left+8,Math.min(viewport.width,right+dx));
  if(handle.includes('n'))top=clamp(top+dy,bottom-8);
  if(handle.includes('s'))bottom=Math.max(top+8,Math.min(viewport.height,bottom+dy));
  return {x:left,y:top,width:right-left,height:bottom-top};
}
function recordingControlPosition(region,viewport,size={width:200,height:40}){
  const r={x:region.x*viewport.width,y:region.y*viewport.height,width:region.width*viewport.width,height:region.height*viewport.height};
  const candidates=[{x:8,y:8},{x:8,y:viewport.height-size.height-8},{x:viewport.width-size.width-8,y:8},{x:viewport.width-size.width-8,y:viewport.height-size.height-8}];
  return candidates.find(p=>p.x>=0&&p.y>=0&&(p.x+size.width+4<=r.x||p.x-4>=r.x+r.width||p.y+size.height+4<=r.y||p.y-4>=r.y+r.height))||null;
}
function mountRecordingControls(doc,{region,onStop,onCancel,inspectable=false}){
  const win=doc.defaultView,host=doc.createElement('div'),events=new AbortController();
  host.setAttribute('data-refellow-recording','');host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
  const root=host.attachShadow({mode:inspectable?'open':'closed'});
  root.innerHTML='<div role="status" class="controls"><output>00:00</output><button data-stop>停止并保存</button><button data-cancel>取消</button></div>';
  const sheet=new win.CSSStyleSheet();sheet.replaceSync(':host{font:13px Segoe UI,Microsoft YaHei,sans-serif;color:#18243b}.controls{position:absolute;display:flex;align-items:center;gap:8px;box-sizing:border-box;width:200px;height:40px;background:white;border:1px solid #e3e8f0;border-radius:8px;pointer-events:auto;padding:4px 8px}output{font-variant-numeric:tabular-nums}button{font:inherit;border:0;background:transparent;color:#2348f4;cursor:pointer;padding:4px 0}button:last-child{color:#58657b}button:focus-visible{outline:2px solid #2348f4}[hidden]{display:none!important}');root.adoptedStyleSheets=[sheet];
  const bar=root.querySelector('.controls'),started=Date.now();
  const place=()=>{const p=recordingControlPosition(region,{width:win.innerWidth,height:win.innerHeight});bar.hidden=!p;if(p){bar.style.left=p.x+'px';bar.style.top=p.y+'px';}};
  const run=async fn=>{const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){bar.title=e.message;root.querySelector('output').textContent='重试';}finally{buttons.forEach(b=>b.disabled=false);}};
  root.querySelector('[data-stop]').addEventListener('click',()=>run(onStop),{signal:events.signal});root.querySelector('[data-cancel]').addEventListener('click',()=>run(onCancel),{signal:events.signal});win.addEventListener('resize',place,{signal:events.signal});
  const timer=win.setInterval(()=>{const n=Math.floor((Date.now()-started)/1000);root.querySelector('output').textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');},1000);
  doc.documentElement.append(host);place();return {dispose(){events.abort();win.clearInterval(timer);host.remove();}};
}
function selectCaptureRegion(doc,{image=null,kind='截图',signal,inspectable=false}={}){
 return new Promise((resolve,reject)=>{
  const win=doc.defaultView,viewport={width:win.innerWidth,height:win.innerHeight},previous=doc.activeElement,events=new AbortController();
  const host=doc.createElement('div');host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;';
  const root=host.attachShadow({mode:inspectable?'open':'closed'});const template='<style>:host{font-family:Segoe UI,Microsoft YaHei,sans-serif;color-scheme:light}.surface{position:fixed;inset:0;touch-action:none;cursor:crosshair;background:#18243b66;user-select:none}.surface:before,.surface:after{content:"";position:absolute;pointer-events:none;background:#fff8}.surface:before{top:0;bottom:0;width:1px;left:var(--cx,-100px)}.surface:after{left:0;right:0;height:1px;top:var(--cy,-100px)}.surface img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.box{position:absolute;border:2px solid #2455e8;box-sizing:border-box;box-shadow:0 0 0 99999px #18243b66;pointer-events:none}.box .handle{position:absolute;width:8px;height:8px;border:2px solid #fff;background:#2455e8;border-radius:2px;box-sizing:border-box}.nw{left:-5px;top:-5px}.n{left:calc(50% - 5px);top:-5px}.ne{right:-5px;top:-5px}.e{right:-5px;top:calc(50% - 5px)}.se{right:-5px;bottom:-5px}.s{left:calc(50% - 5px);bottom:-5px}.sw{left:-5px;bottom:-5px}.w{left:-5px;top:calc(50% - 5px)}.measure{position:absolute;left:8px;top:8px;background:#2455e8;color:#fff;border-radius:4px;padding:3px 6px;font:12px Segoe UI,Microsoft YaHei,sans-serif;white-space:nowrap}.bar{position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:#fff;padding:10px 12px;border-radius:10px;box-shadow:0 4px 20px #17202c26;cursor:default;max-width:calc(100vw - 32px);box-sizing:border-box;flex-wrap:wrap;justify-content:center}.bar span{font:13px Segoe UI,Microsoft YaHei,sans-serif;color:#18243b}.bar button{font:13px Segoe UI,Microsoft YaHei,sans-serif;min-height:36px;border:0;border-radius:6px;padding:8px 12px;background:#f3f5fa;color:#18243b;cursor:pointer}.bar button.primary{background:#2455e8;color:white}.bar button:focus-visible{outline:2px solid #18243b;outline-offset:2px}.bar button:disabled{opacity:.45;cursor:default}[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{transition:none!important}}</style><div class="surface" tabindex="-1" role="dialog" aria-modal="true" aria-label="选择采集区域"><div class="box" hidden><i class="handle nw"></i><i class="handle n"></i><i class="handle ne"></i><i class="handle e"></i><i class="handle se"></i><i class="handle s"></i><i class="handle sw"></i><i class="handle w"></i><b class="measure"></b></div><div class="bar"><span>拖动框选 · Esc取消</span><button data-do="all">整个可见画面</button><button class="primary" data-do="confirm" disabled></button><button data-do="cancel" aria-label="取消采集">取消</button></div></div>';
  root.innerHTML=template.slice(template.indexOf('</style>')+8);const sheet=new win.CSSStyleSheet();sheet.replaceSync(template.slice(7,template.indexOf('</style>')));root.adoptedStyleSheets=[sheet];
  const surface=root.querySelector('.surface'),box=root.querySelector('.box'),measure=root.querySelector('.measure'),confirm=root.querySelector('[data-do=confirm]'),bar=root.querySelector('.bar');confirm.textContent=kind==='录制'?'开始录制':'保存截图';
  if(image){const img=doc.createElement('img');img.src=image;img.alt='待截取的当前画面';surface.prepend(img);}
  const adjustments=new win.CSSStyleSheet();adjustments.replaceSync('.box{pointer-events:auto;cursor:move}.box .handle{pointer-events:auto;touch-action:none;width:12px;height:12px}.nw,.se{cursor:nwse-resize}.ne,.sw{cursor:nesw-resize}.n,.s{cursor:ns-resize}.e,.w{cursor:ew-resize}.bar{z-index:2}.measure{pointer-events:none;top:12px;left:12px}.surface:before,.surface:after{z-index:1}.surface{overflow:hidden}');root.adoptedStyleSheets=[sheet,adjustments];
  for(const h of root.querySelectorAll('.handle')){h.dataset.handle=[...h.classList].find(c=>c!=='handle');h.setAttribute('aria-label','拖动调整选区');}
  let start,rect,finished=false;
  const finish=(result,error)=>{if(finished)return;finished=true;events.abort();signal?.removeEventListener('abort',cancel);host.remove();previous?.focus?.({preventScroll:true});error?reject(error):resolve(result);};
  const cancel=()=>finish(null);
  const paint=()=>{surface.style.background='transparent';surface.style.setProperty('--cx',rect.x+'px');surface.style.setProperty('--cy',rect.y+'px');box.hidden=false;Object.assign(box.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});measure.textContent=Math.round(rect.width)+' × '+Math.round(rect.height);confirm.disabled=rect.width<8||rect.height<8;root.querySelector('.bar span').textContent=Math.round(rect.width)+' × '+Math.round(rect.height)+' · 拖内部移动，拖边角缩放';};
  surface.addEventListener('pointerdown',e=>{if(e.button!==0||e.composedPath().includes(bar))return;e.preventDefault();const handle=e.target.closest?.('[data-handle]')?.dataset.handle,move=e.composedPath().includes(box);start={x:Math.max(0,Math.min(viewport.width,e.clientX)),y:Math.max(0,Math.min(viewport.height,e.clientY)),id:e.pointerId,handle:handle||(move?'move':null),original:rect?{...rect}:null};surface.setPointerCapture(e.pointerId);if(!start.handle)rect={x:start.x,y:start.y,width:0,height:0};paint();},{signal:events.signal});
  surface.addEventListener('pointermove',e=>{surface.style.setProperty('--cx',Math.max(0,Math.min(viewport.width,e.clientX))+'px');surface.style.setProperty('--cy',Math.max(0,Math.min(viewport.height,e.clientY))+'px');if(!start||start.id!==e.pointerId)return;const x=Math.max(0,Math.min(viewport.width,e.clientX)),y=Math.max(0,Math.min(viewport.height,e.clientY));rect=start.handle?dragCaptureRect(start.original,start.handle,x-start.x,y-start.y,viewport):{x:Math.min(x,start.x),y:Math.min(y,start.y),width:Math.abs(x-start.x),height:Math.abs(y-start.y)};paint();},{signal:events.signal});
  surface.addEventListener('pointerup',e=>{if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);start=null;},{signal:events.signal});
  surface.addEventListener('pointercancel',()=>{start=null;},{signal:events.signal});
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b||b.disabled)return;if(b.dataset.do==='cancel')cancel();else finish({region:captureRegion(b.dataset.do==='all'?null:rect,viewport),viewport});},{signal:events.signal});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}else if(e.key==='Enter'&&root.activeElement?.tagName!=='BUTTON'&&!confirm.disabled){e.preventDefault();finish({region:captureRegion(rect,viewport),viewport});}else if(e.key==='Tab'){const buttons=[...bar.querySelectorAll('button')].filter(b=>!b.disabled),i=buttons.indexOf(root.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}},{capture:true,signal:events.signal});
  win.addEventListener('resize',()=>finish(null,Error('页面尺寸改变，请重新框选。')),{signal:events.signal});win.addEventListener('pagehide',cancel,{once:true,signal:events.signal});
  if(signal?.aborted){cancel();return;}signal?.addEventListener('abort',cancel,{once:true});doc.documentElement.append(host);surface.focus({preventScroll:true});
 });
}

// 由共享源打包为单个 ISOLATED 内容脚本。
function bootCollector(){
 if(globalThis.__refellowFloating){globalThis.__refellowFloating.show();return;}
 let ui,recording=null,recordingControls,busy=false,closed=false,pendingShot=null;const lifetime=new AbortController();
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
    await ui.withoutOverlay(async()=>{const selected=await selectCaptureRegion(document,{kind:'录制',signal:lifetime.signal});if(!selected)return;ui.suspend();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));recording=await request('record-start',{region:selected.region});});
    if(recording){ui.suspend();recordingControls=mountRecordingControls(document,{region:recording.region,onStop:()=>action('record'),onCancel:()=>action('cancel-record')});}
   }
   if(name==='website'||name==='inbox')await request('website');
   if(name==='connect')await request('connect');
  }catch(e){if(e.code==='shot-invalid')pendingShot=null;if(!closed){ui.resume();ui.open(true);ui.notice(e.message+(pendingShot?' 当前截图未丢失，点击截图可重试保存。':''),true);}}
  finally{busy=false;sync();}
 }
 ui=mountFloatingCollector(document,{onAction:action,onPosition:position=>request('position',{position}).catch(e=>ui.notice(e.message,true))});globalThis.__refellowFloating=ui;
 const onMessage=(message,sender,respond)=>{if(message?.type==='refellow/context'){respond({url:location.href,title:document.title});return;}if(message?.type==='refellow/record-processing'){recordingControls?.dispose();ui.resume();ui.open(true);ui.notice('录制已停止，正在保存到网站…');}if(message?.type==='refellow/show'&&!recording)ui.show();if(message?.type==='refellow/record-error'){recordingControls?.dispose();ui.resume();sync();ui.open(true);ui.notice(message.error+' 录像暂留内存，点击工具栏重试保存。',true);}if(message?.type==='refellow/record-complete'){recordingControls?.dispose();recording=null;ui.resume();sync();ui.open(true);ui.notice(message.cancelled?'录制已取消。':'录像已保存到网站“我的收藏”。');}};
 chrome.runtime.onMessage.addListener(onMessage);
 request('preferences').then(({position})=>{if(position&&!closed)ui.setPosition(position);}).catch(e=>ui.notice(e.message,true));
 window.addEventListener('pagehide',()=>{closed=true;lifetime.abort();recordingControls?.dispose();chrome.runtime.onMessage.removeListener(onMessage);if(recording)request('record-stop').catch(()=>{});ui.dispose();delete globalThis.__refellowFloating;},{once:true});
}
bootCollector();
window.addEventListener('pageshow',e=>{if(e.persisted)bootCollector();});

})();
