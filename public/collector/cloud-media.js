const CHUNK=512*1024;
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function uploadCloudMedia(api,blob,{id,page,storageOnly=false}={}){
 if(!blob?.size||blob.size>64*1024*1024)throw Error('媒体为空或超过首版单份空间。');
 const sha256=await digest(await blob.arrayBuffer()),chunkHashes=[];
 for(let offset=0;offset<blob.size;offset+=CHUNK)chunkHashes.push(await digest(await blob.slice(offset,offset+CHUNK).arrayBuffer()));
 const init=await(await api('/uploads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,page,storageOnly,mime:blob.type,size:blob.size,sha256,chunkHashes})})).json();
 if(!init.completed){
  for(let offset=0,index=0;offset<blob.size;offset+=CHUNK,index++)await api('/uploads/'+init.id+'/'+index,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:blob.slice(offset,offset+CHUNK)});
  await api('/uploads/'+init.id+'/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 }return {ok:true,id:init.id};
}
export async function readCloudMedia(api,id){
 const path='/media/'+encodeURIComponent(id),meta=await(await api(path)).json();
 if(!Number.isInteger(meta.size)||meta.size<1||meta.size>64*1024*1024||!Array.isArray(meta.chunkHashes)||meta.chunkHashes.length!==Math.ceil(meta.size/CHUNK))throw Error('网站媒体信息不完整。');
 const chunks=[];
 for(let i=0;i<meta.chunkHashes.length;i++){
  const bytes=await(await api(path+'/'+i)).arrayBuffer();
  if(bytes.byteLength!==Math.min(CHUNK,meta.size-i*CHUNK)||await digest(bytes)!==meta.chunkHashes[i])throw Error('媒体下载不完整，请重试。');chunks.push(bytes);
 }
 const blob=new Blob(chunks,{type:meta.mime});if(await digest(await blob.arrayBuffer())!==meta.sha256)throw Error('媒体完整摘要不一致，请重试。');return blob;
}
