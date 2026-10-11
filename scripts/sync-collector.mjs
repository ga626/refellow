import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function syncCollector(){
  const destination=path.join(root,'采集器/shared');await mkdir(destination,{recursive:true});
  for(const name of ['attachments.js','media-store.js','recipes.js','zip.js','screen-recorder.js','floating-ui.js','capture-region.js','cloud-media.js']){const bytes=await readFile(path.join(root,'public/collector',name));await writeFile(path.join(destination,name),bytes);}
  await writeFile(path.join(root,'采集器/lib.js'),await readFile(path.join(root,'public/lib.js')));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await syncCollector();console.log('已从public同步采集器共享模块；勿手改派生副本。');}
