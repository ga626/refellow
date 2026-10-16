// 原创四格参伴徽记；纯Node生成PNG，不引入字体、网络素材或依赖。
import {mkdir,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {crc32} from '../public/collector/zip.js';
const destination=new URL('../采集器/icons/',import.meta.url);
function inside(x,y,left,top,width,radius){const cx=Math.max(left+radius,Math.min(x,left+width-radius)),cy=Math.max(top+radius,Math.min(y,top+width-radius));return (x-cx)**2+(y-cy)**2<=radius**2;}
function chunk(type,data){const label=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));return Buffer.concat([size,label,data,crc]);}
export function iconPNG(size){
  const pixels=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let alpha=0,white=0;for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
      const px=(x+(sx+.5)/4)/size*128,py=(y+(sy+.5)/4)/size*128;
      if(!inside(px,py,4,4,120,25))continue;alpha++;
      if([[32,32],[72,32],[32,72],[72,72]].some(([a,b])=>inside(px,py,a,b,24,5)))white++;
    }
    const at=y*(size*4+1)+1+x*4;const t=alpha?white/alpha:0;
    pixels[at]=Math.round(35+(255-35)*t);pixels[at+1]=Math.round(72+(255-72)*t);pixels[at+2]=Math.round(244+(255-244)*t);pixels[at+3]=Math.round(alpha/16*255);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export async function buildCollectorIcons(){await mkdir(destination,{recursive:true});for(const size of [16,32,48,128])await writeFile(new URL('icon-'+size+'.png',destination),iconPNG(size));}
