// 共享的零依赖、无压缩 ZIP；不解析或执行外部归档内容。
const encoder=new TextEncoder();
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const header=n=>({bytes:new Uint8Array(n),view:null});
export async function makeZip(files){
  if(!Array.isArray(files)||files.length>1000)throw Error('导出文件数量无效。');
  const names=new Set(),parts=[],central=[];let offset=0;
  for(const f of files){
    if(!/^[a-zA-Z0-9_./-]+$/.test(f.name)||f.name.startsWith('/')||f.name.split('/').includes('..')||names.has(f.name))throw Error('导出路径无效或重复。');names.add(f.name);
    const name=encoder.encode(f.name),data=typeof f.data==='string'?encoder.encode(f.data):f.data instanceof Blob?new Uint8Array(await f.data.arrayBuffer()):f.data;
    if(!(data instanceof Uint8Array))throw Error('导出内容无效。');
    const crc=crc32(data),h=header(30);h.view=new DataView(h.bytes.buffer);const v=h.view;v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
    parts.push(h.bytes,name,data);
    const c=header(46);c.view=new DataView(c.bytes.buffer);const w=c.view;w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);central.push(c.bytes,name);offset+=30+name.length+data.length;
  }
  const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'});
}
export function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
