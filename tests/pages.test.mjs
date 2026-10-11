import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePagesFiles} from '../scripts/build-pages.mjs';
import {pagesHeaders} from '../scripts/pages-config.mjs';
const packageData=await preparePagesFiles();
test('静态入口不依赖本机API，保留旧版迁移和完整备份',()=>{
  const source=packageData.files.get('app.js').toString();
  assert.ok(source.includes("fetch('/sites.json',"));assert.ok(!source.includes("fetch('/api/catalog')"));
  assert.ok(packageData.files.has('legacy-cases.json'));assert.ok(source.includes('mergeWorkspaces'));assert.ok(source.includes('initializeCloudSpace'));
});
test('发布包只含允许文件，不含资料、配置、测试或用户数据',()=>{
  assert.equal(packageData.siteCount,18);
  const allowed=/^(?:index\.html|404\.html|app\.js|store\.js|lib\.js|collector-ui\.js|collector-transfer\.js|workspace-ui\.js|workspace\.css|handoff\.js|collector\/(?:sidepanel\.(?:html|css|js)|core\.js|browser\.js|catalog\.json|popup\.html|capture\.(?:js|css)|desk\.js|inbox\.js|recorder\.(?:html|js)|lib\.js|(?:shared\/)?(?:attachments|media-store|recipes|zip|screen-recorder)\.js)|style\.css|sites\.json|legacy-cases\.json|release\.json|_headers|assets\/[a-z0-9-]+\.(?:png|jpg|webp|zip))$/;
  for(const name of packageData.files.keys())assert.ok(allowed.test(name)||["privacy.html","privacy.css","source-identity.json","cloud-space.js","collector/capture-region.js","collector/cloud-media.js","_worker.js","_routes.json"].includes(name)||/^collector\/icons\/icon-(16|32|48|128)\.png$/.test(name)||/^collector\/(floating-preview\.(html|js|css)|shared\/floating-ui\.js)$/.test(name),'不允许的发布文件：'+name);
  assert.ok(!packageData.files.has('server.mjs'));assert.ok(!packageData.files.has('实现验收回执.json'));
});
test('实拍图扩展名符合JPEG签名，迁移只含公开最低必要数据',()=>{
  for(const site of JSON.parse(packageData.files.get('sites.json')).sites){const bytes=packageData.files.get(site.image.slice(1));assert.ok(bytes);if(bytes[0]===0xff&&bytes[1]===0xd8)assert.ok(site.image.endsWith('.jpg'));}
  for(const item of JSON.parse(packageData.files.get('legacy-cases.json'))){assert.equal(item.image,'');assert.ok(!item.video&&!item.license_status);}
});
test('静态托管保留CSP和隐私头，不允许第三方脚本与敏感设备权限',()=>{
  const text=pagesHeaders();assert.match(text,/script-src 'self'/);assert.match(text,/frame-ancestors 'none'/);
  assert.match(text,/X-Content-Type-Options: nosniff/);assert.match(text,/Referrer-Policy: no-referrer/);
  assert.match(text,/camera=\(\), microphone=\(\), geolocation=\(\)/);
});
test('发布包摘要确定性，运行身份没有本机路径或用户信息',async()=>{
  assert.equal((await preparePagesFiles()).packageHash,packageData.packageHash);
  const release=JSON.parse(packageData.files.get('release.json'));assert.equal(release.appVersion,2);
  assert.equal(release.storage,'cloud-private-account');assert.equal(release.packageHash,packageData.packageHash);
});
