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
 if(!connection?.origin||typeof connection?.token!=='string'||connection.token.length<32)throw Error('请在网站登录并连接采集器。');const origin=captureOrigin(connection.origin);
 const response=await fetch(origin+'/api'+path,{method,headers:{Authorization:'Bearer '+connection.token,...headers},body,signal:AbortSignal.timeout(30000)});
 if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw Error(error||'网站保存失败（HTTP '+response.status+'），请重试。');}return response;
}
export async function uploadCapture(connection,page,blob,id){
 return uploadCloudMedia((path,options)=>cloudRequest(connection,path,options),blob,{page,id});
}
