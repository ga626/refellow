import {uploadCloudMedia} from './shared/cloud-media.js';
export const LOCAL_ORIGIN='http://127.0.0.1:5192';
export const LOCAL_PERMISSION='http://127.0.0.1/*';
export const CLOUD_ORIGIN='https://lingganji.pages.dev';
export function captureOrigin(value=CLOUD_ORIGIN){
 let url;try{url=new URL(value);}catch{throw Error('网站地址无效。');}
 if(url.origin===LOCAL_ORIGIN&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username&&!url.password)return url.origin;
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.hostname==='lingganji.pages.dev'||/^[a-z0-9-]+\.lingganji\.pages\.dev$/.test(url.hostname)))throw Error('只能连接参伴正式站、测试站或本机开发地址 http://127.0.0.1:5192。');return url.origin;
}
export async function cloudRequest(connection,path,{method='GET',body,headers={}}={}){
 if(!connection?.origin||typeof connection?.token!=='string'||connection.token.length<32)throw Error('请先登录参伴网站，采集器会自动识别账户。');const origin=captureOrigin(connection.origin);
 const response=await fetch(origin+'/api'+path,{method,headers:{Authorization:'Bearer '+connection.token,...headers},body,signal:AbortSignal.timeout(30000)});
 if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw Object.assign(Error(error||'网站保存失败（HTTP '+response.status+'），请重试。'),{status:response.status});}return response;
}
export async function uploadCapture(connection,page,blob,id){
 if(globalThis.chrome?.storage?.local){const current=(await chrome.storage.local.get('refellow/cloud-connection'))['refellow/cloud-connection'];if(!current||current.origin!==connection.origin||current.username!==connection.username)throw Error('账户已退出或切换。内容尚未保存，请回原账户登录后重试。');connection=current;}
 return uploadCloudMedia((path,options)=>cloudRequest(connection,path,options),blob,{page,id});
}
