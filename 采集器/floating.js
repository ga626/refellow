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
function selectCaptureRegion(doc,{image=null,kind='截图',signal,inspectable=false}={}){
 return new Promise((resolve,reject)=>{
  const win=doc.defaultView,viewport={width:win.innerWidth,height:win.innerHeight},previous=doc.activeElement,events=new AbortController();
  const host=doc.createElement('div');host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;';
  const root=host.attachShadow({mode:inspectable?'open':'closed'});const template='<style>:host{font-family:Segoe UI,Microsoft YaHei,sans-serif;color-scheme:light}.surface{position:fixed;inset:0;touch-action:none;cursor:crosshair;background:#18243b66;user-select:none}.surface img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.box{position:absolute;border:2px solid #2455e8;box-sizing:border-box;box-shadow:0 0 0 99999px #18243b66;pointer-events:none}.bar{position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:#fff;padding:10px 12px;border-radius:10px;box-shadow:0 4px 20px #17202c26;cursor:default;max-width:calc(100vw - 32px);box-sizing:border-box;flex-wrap:wrap;justify-content:center}.bar span{font:13px Segoe UI,Microsoft YaHei,sans-serif;color:#18243b}.bar button{font:13px Segoe UI,Microsoft YaHei,sans-serif;min-height:36px;border:0;border-radius:6px;padding:8px 12px;background:#f3f5fa;color:#18243b;cursor:pointer}.bar button.primary{background:#2455e8;color:white}.bar button:focus-visible{outline:2px solid #18243b;outline-offset:2px}.bar button:disabled{opacity:.45;cursor:default}[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{transition:none!important}}</style><div class="surface" tabindex="-1" role="dialog" aria-modal="true" aria-label="选择采集区域"><div class="box" hidden></div><div class="bar"><span>拖动框选 · Esc取消</span><button data-do="all">整个可见画面</button><button class="primary" data-do="confirm" disabled></button><button data-do="cancel" aria-label="取消采集">取消</button></div></div>';
  root.innerHTML=template.slice(template.indexOf('</style>')+8);const sheet=new win.CSSStyleSheet();sheet.replaceSync(template.slice(7,template.indexOf('</style>')));root.adoptedStyleSheets=[sheet];
  const surface=root.querySelector('.surface'),box=root.querySelector('.box'),confirm=root.querySelector('[data-do=confirm]'),bar=root.querySelector('.bar');confirm.textContent=kind==='录制'?'开始录制':'保存截图';
  if(image){const img=doc.createElement('img');img.src=image;img.alt='待截取的当前画面';surface.prepend(img);}
  let start,rect,finished=false;
  const finish=(result,error)=>{if(finished)return;finished=true;events.abort();signal?.removeEventListener('abort',cancel);host.remove();previous?.focus?.({preventScroll:true});error?reject(error):resolve(result);};
  const cancel=()=>finish(null);
  const paint=()=>{surface.style.background='transparent';box.hidden=false;Object.assign(box.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});confirm.disabled=rect.width<8||rect.height<8;root.querySelector('.bar span').textContent=Math.round(rect.width)+' × '+Math.round(rect.height)+' · 拖动重新选择';};
  surface.addEventListener('pointerdown',e=>{if(e.button!==0||e.composedPath().includes(bar))return;e.preventDefault();start={x:Math.max(0,Math.min(viewport.width,e.clientX)),y:Math.max(0,Math.min(viewport.height,e.clientY))};surface.setPointerCapture(e.pointerId);rect={x:start.x,y:start.y,width:0,height:0};paint();},{signal:events.signal});
  surface.addEventListener('pointermove',e=>{if(!start)return;const x=Math.max(0,Math.min(viewport.width,e.clientX)),y=Math.max(0,Math.min(viewport.height,e.clientY));rect={x:Math.min(x,start.x),y:Math.min(y,start.y),width:Math.abs(x-start.x),height:Math.abs(y-start.y)};paint();},{signal:events.signal});
  surface.addEventListener('pointerup',e=>{if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);start=null;},{signal:events.signal});
  surface.addEventListener('pointercancel',()=>{start=null;},{signal:events.signal});
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(!b||b.disabled)return;if(b.dataset.do==='cancel')cancel();else finish({region:captureRegion(b.dataset.do==='all'?null:rect,viewport),viewport});},{signal:events.signal});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}else if(e.key==='Enter'&&!confirm.disabled){e.preventDefault();finish({region:captureRegion(rect,viewport),viewport});}else if(e.key==='Tab'){const buttons=[...bar.querySelectorAll('button')].filter(b=>!b.disabled),i=buttons.indexOf(root.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}},{capture:true,signal:events.signal});
  win.addEventListener('resize',()=>finish(null,Error('页面尺寸改变，请重新框选。')),{signal:events.signal});win.addEventListener('pagehide',cancel,{once:true,signal:events.signal});
  if(signal?.aborted){cancel();return;}signal?.addEventListener('abort',cancel,{once:true});doc.documentElement.append(host);surface.focus({preventScroll:true});
 });
}

// 由共享源打包为单个 ISOLATED 内容脚本。
(() => {
 if(globalThis.__refellowFloating){globalThis.__refellowFloating.show();return;}
 let ui,recording=null,busy=false,closed=false,pendingShot=null;const lifetime=new AbortController();
 const request=async(action,data={})=>{const response=await chrome.runtime.sendMessage({type:'refellow/floating',action,pageURL:location.href,...data});if(!response?.ok)throw Error(response?.error||'连接已断开，请重新点击工具栏。');return response;};
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
  }catch(e){if(!closed){ui.resume();ui.open(true);ui.notice(e.message+(pendingShot?' 当前截图未丢失，点击截图可重试保存。':''),true);}}
  finally{busy=false;sync();}
 }
 ui=mountFloatingCollector(document,{onAction:action,onPosition:position=>request('position',{position}).catch(e=>ui.notice(e.message,true))});globalThis.__refellowFloating=ui;
 chrome.runtime.onMessage.addListener(message=>{if(message?.type==='refellow/show')ui.show();if(message?.type==='refellow/record-error'){ui.resume();sync();ui.open(true);ui.notice(message.error+' 录像暂留内存，点击工具栏重试保存。',true);}if(message?.type==='refellow/record-complete'){recording=null;ui.resume();sync();ui.open(true);ui.notice(message.cancelled?'录制已取消。':'录像已保存到网站“我的收藏”。');}});
 request('preferences').then(({position})=>{if(position&&!closed)ui.setPosition(position);}).catch(e=>ui.notice(e.message,true));
 window.addEventListener('pagehide',()=>{closed=true;lifetime.abort();if(recording)request('record-stop').catch(()=>{});ui.dispose();delete globalThis.__refellowFloating;},{once:true});
})();

})();
