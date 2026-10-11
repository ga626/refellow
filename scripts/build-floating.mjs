import {readFile,writeFile} from 'node:fs/promises';
// 无运行时动态import和远程代码：共享源被明确打包为一个ISOLATED内容脚本。
export async function buildFloating(){
  const source=await readFile(new URL('../采集器/floating-entry.js',import.meta.url),'utf8');
  const modules=await Promise.all(['floating-ui.js','capture-region.js'].map(name=>readFile(new URL('../public/collector/'+name,import.meta.url),'utf8')));
  const bundled='// Generated from public/collector and floating-entry.js; do not edit.\n(()=>{\n'+modules.map(s=>s.replace(/^export /gm,'')).join('\n')+'\n'+source.replace(/^import .*;\r?\n/gm,'')+'\n})();\n';
  await writeFile(new URL('../采集器/floating.js',import.meta.url),bundled);
}
