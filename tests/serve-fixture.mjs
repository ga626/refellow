import http from 'node:http';import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./media-fixture.html',import.meta.url));
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}).listen(5193,'127.0.0.1',()=>console.log('合成媒体QA夹具 http://127.0.0.1:5193/'));
