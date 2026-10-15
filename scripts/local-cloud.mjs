// 默认启用的持久本机开发数据库；不是公网或跨电脑云空间。
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
export async function openLocalCloud(root){
 const directory=path.join(root,'local/runtime/cloud-development');await mkdir(directory,{recursive:true});
 const secretPath=path.join(directory,'pepper');let pepper;try{pepper=await readFile(secretPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;pepper=randomBytes(32).toString('hex');await writeFile(secretPath,pepper,{flag:'wx',mode:0o600});}
 const sqlite=new DatabaseSync(path.join(directory,'qa.sqlite'));sqlite.exec(await readFile(path.join(root,'cloud/schema.sql'),'utf8'));
 const statement=(sql,args=[])=>({bind:(...values)=>statement(sql,values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v)),async run(){const info=sqlite.prepare(sql).run(...args);return {meta:{changes:info.changes}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}});
 return {close:()=>sqlite.close(),LOCAL_DEVELOPMENT:true,DB:{prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}},AUTH_PEPPER:pepper};
}
