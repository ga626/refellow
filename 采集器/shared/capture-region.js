export function captureRegion(rect,viewport){
  if(!viewport||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0)throw Error('页面尺寸无效。');
  if(!rect)return {x:0,y:0,width:1,height:1};
  if(!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))throw Error('框选坐标无效。');
  const x=Math.max(0,Math.min(viewport.width,rect.x)),y=Math.max(0,Math.min(viewport.height,rect.y));
  const width=Math.min(viewport.width-x,rect.width),height=Math.min(viewport.height-y,rect.height);
  if(width<8||height<8)throw Error('请拖出至少8像素的区域。');
  return {x:x/viewport.width,y:y/viewport.height,width:width/viewport.width,height:height/viewport.height};
}
export function pixelRegion(region,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!region||!['x','y','width','height'].every(k=>Number.isFinite(region[k]))||region.x<0||region.y<0||region.width<=0||region.height<=0||region.x+region.width>1.000001||region.y+region.height>1.000001)throw Error('画面裁切范围无效。');
  const x=Math.floor(region.x*width),y=Math.floor(region.y*height);
  return {x,y,width:Math.max(1,Math.min(width-x,Math.round(region.width*width))),height:Math.max(1,Math.min(height-y,Math.round(region.height*height)))};
}
export async function cropScreenshot(blob,region,{decode=createImageBitmap,Canvas=OffscreenCanvas}={}){
  const image=await decode(blob);
  try{const r=pixelRegion(region,image.width,image.height),canvas=new Canvas(r.width,r.height);canvas.getContext('2d').drawImage(image,r.x,r.y,r.width,r.height,0,0,r.width,r.height);return await canvas.convertToBlob({type:'image/png'});}finally{image.close();}
}
export function dragCaptureRect(original,handle,dx,dy,viewport){
  const clamp=(v,max)=>Math.max(0,Math.min(max,v));
  if(handle==='move')return {...original,x:clamp(original.x+dx,viewport.width-original.width),y:clamp(original.y+dy,viewport.height-original.height)};
  let left=original.x,right=left+original.width,top=original.y,bottom=top+original.height;
  if(handle.includes('w'))left=clamp(left+dx,right-8);
  if(handle.includes('e'))right=Math.max(left+8,Math.min(viewport.width,right+dx));
  if(handle.includes('n'))top=clamp(top+dy,bottom-8);
  if(handle.includes('s'))bottom=Math.max(top+8,Math.min(viewport.height,bottom+dy));
  return {x:left,y:top,width:right-left,height:bottom-top};
}
export function recordingControlPosition(region,viewport,size={width:200,height:40}){
  const r={x:region.x*viewport.width,y:region.y*viewport.height,width:region.width*viewport.width,height:region.height*viewport.height};
  const candidates=[{x:8,y:8},{x:8,y:viewport.height-size.height-8},{x:viewport.width-size.width-8,y:8},{x:viewport.width-size.width-8,y:viewport.height-size.height-8}];
  return candidates.find(p=>p.x>=0&&p.y>=0&&(p.x+size.width+4<=r.x||p.x-4>=r.x+r.width||p.y+size.height+4<=r.y||p.y-4>=r.y+r.height))||null;
}
export function mountRecordingControls(doc,{region,onStop,onCancel,inspectable=false}){
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
export function selectCaptureRegion(doc,{image=null,kind='截图',signal,inspectable=false}={}){
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
