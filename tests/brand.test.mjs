import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KEY,emptyState,normalizeWorkspace} from '../public/store.js';
const read = name => readFile(new URL('../'+name,import.meta.url),'utf8');
test('Refellow · 参伴品牌覆盖网页、扩展与构建入口',async()=>{
  const html=await read('public/index.html');
  assert.match(html,/<title>Refellow · 参伴/);
  assert.match(html,/参伴<small>Refellow · 与 AI 共创/);
  assert.ok(!html.includes('灵感集'));
  assert.equal(JSON.parse(await read('package.json')).name,'refellow');
  assert.equal(JSON.parse(await read('采集器/manifest.json')).name,'Refellow · 参伴 · 页面采集器');
  assert.match(await read('public/app.js'),/Refellow · 参伴/);
  assert.match(await read('public/handoff.js'),/Refellow · 参伴 · 项目参考包/);
  assert.match(await read('scripts/build-pages.mjs'),/返回Refellow · 参伴/);
});
test('品牌改名保留原有收藏与备份合同',()=>{
  assert.equal(KEY,'inspiration-library/v2');
  const state=emptyState();
  assert.equal(state.schema,'inspiration-workspace/v2');
  assert.doesNotThrow(()=>normalizeWorkspace(state));
});
