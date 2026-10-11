import {readCurrentPage,captureCurrentPage} from './browser.js';
import {INBOX,CONTEXT,extension,readStorage,saveCapture} from './inbox.js';
import {recipeFor} from './shared/recipes.js';
import {fromBase64} from './shared/media-store.js';
import {cleanURL} from './core.js';
const $=s=>document.querySelector(s);
const status=text=>$('#status').textContent=text;
let context;
async function refresh(){const items=await readStorage(INBOX,[]);$('#count').textContent=items.length;}
function withRecipe(page){const r=recipeFor(page.url);$('#recipe').textContent=r.hint;return {...page,provenance:{recipeId:r.id,section:r.section,sourceName:new URL(page.url).hostname}};}
async function page(){if(extension)return withRecipe(await readCurrentPage(chrome));const value=$('#url').value.trim();try{new URL(value);}catch{throw Error('请输入完整的 HTTP / HTTPS 具体网址。');}return withRecipe({url:cleanURL(value),title:$('#title').value,captureMethod:'manual'});}
function workbench(event){if(extension){event.preventDefault();chrome.tabs.create({url:context?.workbenchURL||'https://lingganji.pages.dev/#collection'}).catch(e=>status(e.message));}}
$('#home').addEventListener('click',workbench);
$('#shot').addEventListener('click',async()=>{const b=$('#shot');b.disabled=true;try{const p=await page(),data=await captureCurrentPage(chrome,p),blob=fromBase64({id:'shot',mime:'image/jpeg',data:data.split(',')[1]}),mediaId='media-'+crypto.randomUUID();await saveCapture({...p,attachments:[{id:'att-'+crypto.randomUUID(),kind:'image',name:'可见区域截图',mediaId,mime:blob.type,size:blob.size}]},[{id:mediaId,blob}]);status('截图已收下。分类和命名回收藏夹再做。');await refresh();}catch(e){status(e.message);}finally{b.disabled=false;}});
$('#record').addEventListener('click',async()=>{const b=$('#record');b.disabled=true;try{const p=await page();const params=new URLSearchParams({url:p.url,title:p.title||''});const url='recorder.html?'+params;if(extension)await chrome.windows.create({url:chrome.runtime.getURL(url),type:'popup',width:460,height:680});else window.open(url,'inspiration-recorder','width=460,height=680');}catch(e){status('请先填具体网址：'+e.message);}finally{b.disabled=false;}});
$('#save-link').addEventListener('submit',async event=>{event.preventDefault();const b=event.target.querySelector('button');b.disabled=true;try{const fd=new FormData(event.target);const p=withRecipe({url:fd.get('url'),title:fd.get('title'),captureMethod:'manual'});p.provenance.discoveryURL=fd.get('discoveryURL');await saveCapture(p);status('网址已收下，之后可追加画面或实现资料。');await refresh();}catch(e){status(e.message);}finally{b.disabled=false;}});
$('#open-panel').textContent='打开收件箱';
$('#open-panel').addEventListener('click',async()=>{try{if(extension)await chrome.tabs.create({url:chrome.runtime.getURL('sidepanel.html#inbox')});else location.href='sidepanel.html#inbox';}catch(e){status(e.message);}});
$('#inbox-link').addEventListener('click',async event=>{if(extension){event.preventDefault();await chrome.tabs.create({url:chrome.runtime.getURL('sidepanel.html#inbox')});}});
try{context=await readStorage(CONTEXT,null);if(context?.workbenchURL)$('#home').href=context.workbenchURL;$('#mode').textContent=extension?'点击扩展图标后，仅授权这个标签页。':'网页预览无扩展权限：可以手动记网址；无法读取其他网页。';$('#shot').disabled=!extension;await refresh();}catch(e){status(e.message);}
