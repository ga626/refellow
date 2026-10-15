import {captureOrigin,CLOUD_ORIGIN,LOCAL_ORIGIN,LOCAL_PERMISSION} from './cloud-connection.js';
const form=document.querySelector('#connect'),environment=document.querySelector('#environment'),originInput=document.querySelector('#origin'),status=document.querySelector('#status'),button=form.querySelector('[type=submit]');
function updateEnvironment(){
 const local=environment.value==='local',preview=environment.value==='preview';document.querySelector('#origin-field').hidden=!preview;
 if(!preview)originInput.value=local?LOCAL_ORIGIN:CLOUD_ORIGIN;
 document.querySelector('#environment-note').textContent=local?'本机测试：账户与截图保存在这台电脑。请先启动本地参伴网站，不会上传到正式站。':'正式、线上测试与本机账户相互独立，请使用当前网站生成的连接码。';
 try{document.querySelector('#site-link').href=captureOrigin(originInput.value)+'/#account';status.textContent='';}catch(e){status.textContent=e.message;}
}
environment.onchange=()=>{form.elements.code.value='';updateEnvironment();};originInput.oninput=updateEnvironment;
form.addEventListener('submit',async e=>{
 e.preventDefault();if(button.disabled)return;button.disabled=true;status.textContent='';
 try{
  const origin=captureOrigin(originInput.value),code=form.elements.code.value.trim();
  if(!/^[a-f0-9]{16}$/i.test(code.replace(/[-\s]/g,'')))throw Error('请填写网站生成的连接码，不是用户名或密码。');
  // 可选权限仅在明确选择本机测试并点击连接时申请，不扩大普通用户的安装权限。
  if(origin===LOCAL_ORIGIN&&!await chrome.permissions.request({origins:[LOCAL_PERMISSION]}))throw Error('尚未允许连接本机测试空间。请再次点击连接并允许访问。');
  button.disabled=true;button.textContent='正在连接…';
  const response=await fetch(origin+'/api/pair/redeem',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'连接失败，请重新生成连接码。');
  await chrome.storage.local.set({'refellow/cloud-connection':{origin,token:result.token,username:result.username}});form.elements.code.value='';showConnection({origin,username:result.username});status.textContent='已连接 '+result.username+' · '+(origin===LOCAL_ORIGIN?'本机测试空间':'网站个人空间')+'。回到参考网页即可采集。';
 }catch(e){status.textContent=e.name==='TimeoutError'?'连接超时，请重试。':e instanceof TypeError?'无法连接所选网站。本机测试请先运行 start.cmd；线上网站请检查网络。':e.message;}finally{button.disabled=false;button.textContent='连接账户';}
});
document.querySelector('#disconnect').onclick=async e=>{e.target.disabled=true;try{const connection=(await chrome.storage.local.get('refellow/cloud-connection'))['refellow/cloud-connection'];if(connection?.token){const response=await fetch(captureOrigin(connection.origin)+'/api/logout',{method:'POST',headers:{Authorization:'Bearer '+connection.token},signal:AbortSignal.timeout(15000)});if(!response.ok&&response.status!==401)throw Error('网站暂时无法撤销连接，请稍后重试。');}await chrome.storage.local.remove('refellow/cloud-connection');showConnection(null);status.textContent='已断开。';}catch(e){status.textContent=e.message;}finally{e.target.disabled=false;}};
function showConnection(connection){const origin=captureOrigin(connection?.origin);environment.value=origin===LOCAL_ORIGIN?'local':origin===CLOUD_ORIGIN?'production':'preview';originInput.value=origin;updateEnvironment();document.querySelector('#disconnect').hidden=!connection;status.textContent=connection?'当前连接：'+connection.username+' · '+origin:'尚未连接账户。';}
chrome.storage.local.get('refellow/cloud-connection').then(data=>showConnection(data['refellow/cloud-connection'])).catch(e=>status.textContent=e.message);
