import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupMoveTarget,moveEntryWithinGroup} from '../public/store.js';

test('分组排序跳过其他组，首尾边界与原数据保留',()=>{
 const entries=[{refId:'A',group:'g1'},{refId:'B',group:'g2'},{refId:'C',group:'g1'}];
 const moved=moveEntryWithinGroup(entries,'C',-1);
 assert.deepEqual(moved.filter(e=>e.group==='g1').map(e=>e.refId),['C','A']);
 assert.deepEqual(moved.filter(e=>e.group==='g2').map(e=>e.refId),['B']);
 assert.deepEqual(entries.map(e=>e.refId),['A','B','C']);
 assert.equal(groupMoveTarget(entries,'A',-1),-1);
 assert.equal(groupMoveTarget(entries,'C',1),-1);
 assert.equal(groupMoveTarget(entries,'B',1),-1);
 assert.equal(groupMoveTarget(entries,'missing',-1),-1);
 assert.deepEqual(moveEntryWithinGroup(moved,'C',1),entries);
});
test('工作台网站收藏局部更新，不重建采集表单',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.ok(source.includes("if(route==='visit'){const saved="));
 const branch=source.split("if(route==='visit'){const saved=")[1].split('}else{render();')[0];
 assert.ok(!branch.includes('render()'));
 assert.ok(branch.includes("setAttribute('aria-pressed'"));
 assert.match(branch,/#saved-count/);
});
test('编辑参考明确保持项目关联，不提供无效项目下拉',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.ok(source.includes("openForm('编辑参考',captureForm(null,true))"));
 assert.ok(source.includes('这里修改参考本身，已有关联项目保持不变。'));
});

