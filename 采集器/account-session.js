import {captureOrigin,LOCAL_ORIGIN,LOCAL_PERMISSION} from './cloud-connection.js';
const KEY='refellow/cloud-connection';
export async function synchronizeAccount(api,message,sender){
 if(sender.id!==api.runtime.id||sender.frameId!==0||!sender.tab?.id)throw Error('拒绝不受信任的账户消息。');
 const origin=captureOrigin(message.origin),actual=new URL(sender.url).origin;if(actual!==origin)throw Error('账户来源不符。');
 const tab=await api.tabs.get(sender.tab.id);if(new URL(tab.url).origin!==origin)throw Error('网站已改变。');
 const current=(await api.storage.local.get(KEY))[KEY],account=message.account;
 if(tab.active&&message.focused)await api.storage.local.set({'refellow/account-origin':origin});
 if(account){
  if(!/^[a-f0-9]{64}$/.test(account.token||'')||typeof account.username!=='string')throw Error('账户身份无效。');
  // 不让后台打开的另一环境覆盖正在使用的空间；切换到该网站后自动更新。
  if(current?.origin&&current.origin!==origin&&(!tab.active||!message.focused))return {ok:false};
  await api.storage.local.set({[KEY]:{origin,token:account.token,username:account.username,displayName:account.displayName||'参伴用户'}});
 }else if(current?.origin===origin)await api.storage.local.remove(KEY);
 return {ok:true};
}
export async function enableLocalBridge(api){
 if(!await api.permissions.contains({origins:[LOCAL_PERMISSION]}))return;
 const scripts=await api.scripting.getRegisteredContentScripts({ids:['refellow-local-account']});
 if(!scripts.length)await api.scripting.registerContentScripts([{id:'refellow-local-account',matches:[LOCAL_PERMISSION],js:['account-bridge.js'],runAt:'document_idle'}]);
 const tabs=await api.tabs.query({url:LOCAL_PERMISSION});
 for(const tab of tabs)if(new URL(tab.url).origin===LOCAL_ORIGIN)await api.scripting.executeScript({target:{tabId:tab.id},files:['account-bridge.js']}).catch(()=>{});
}
