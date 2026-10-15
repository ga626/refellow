// 仅运行在参伴站点的 isolated world；凭据不经 window/DOM 传递。
(()=>{
 if(globalThis.__refellowAccountBridge)return;globalThis.__refellowAccountBridge=true;
 if(!['http://127.0.0.1:5192','https://refellow.pages.dev','https://preview.refellow.pages.dev','https://lingganji.pages.dev'].includes(location.origin)&&!/^https:\/\/[a-z0-9-]+\.lingganji\.pages\.dev$/.test(location.origin))return;
 let running=false,again=false;
 async function sync(){
  if(running){again=true;return;}running=true;
  try{
   const response=await fetch('/api/collector/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({extensionId:chrome.runtime.id}),signal:AbortSignal.timeout(15000)});
   if(!response.ok&&response.status!==401)throw Error('账户暂未同步');
   const account=response.ok?await response.json():null;
   const result=await chrome.runtime.sendMessage({type:'refellow/account-sync',origin:location.origin,account,focused:document.hasFocus()});
   if(result?.ok)document.dispatchEvent(new CustomEvent('refellow:collector-status',{detail:JSON.stringify({connected:!!account,displayName:account?.displayName||''})}));
  }catch{document.dispatchEvent(new CustomEvent('refellow:collector-status',{detail:JSON.stringify({connected:false,unavailable:true})}));}
  finally{running=false;if(again){again=false;sync();}}
 }
 document.addEventListener('refellow:account-changed',sync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
 addEventListener('focus',sync);setInterval(()=>{if(!document.hidden)sync();},30000);sync();
})();
