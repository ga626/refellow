import {mountFloatingCollector} from './shared/floating-ui.js';
import {selectCaptureRegion} from './shared/capture-region.js';
let busy=false;const lifetime=new AbortController();
async function action(name){
 if(name==='hide'){ui.hide();return;}
 if(name==='inbox'||name==='website'||name==='connect'){location.href='/#account';return;}
 if(busy)return;
 if(name==='shot'||name==='record'){
  busy=true;ui.state({pending:true});
  try{await ui.withoutOverlay(async()=>{const selected=await selectCaptureRegion(document,{kind:name==='record'?'录制':'截图',signal:lifetime.signal,inspectable:true});if(selected)ui.notice('已选择区域。此页仅验证框选交互；实际截图、录像与云端保存请在Edge扩展中验证。');});}
  catch(e){ui.notice(e.message,true);}finally{busy=false;ui.state({pending:false});}
 }
}
let position;try{position=JSON.parse(localStorage.getItem('refellow-preview/floating-position')||'null');}catch{}
const ui=mountFloatingCollector(document,{inspectable:true,position:position||{},onAction:action,onPosition:p=>localStorage.setItem('refellow-preview/floating-position',JSON.stringify(p))});
document.querySelector('#restore').addEventListener('click',()=>ui.show());
window.addEventListener('pagehide',()=>{lifetime.abort();ui.dispose();},{once:true});
