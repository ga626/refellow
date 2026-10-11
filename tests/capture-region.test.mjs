import test from 'node:test';import assert from 'node:assert/strict';
import {captureRegion,pixelRegion,cropScreenshot} from '../public/collector/capture-region.js';
test('框选按实际画面比例裁切，125%缩放和不同DPR不偏移',async()=>{
 const region=captureRegion({x:80,y:60,width:400,height:240},{width:800,height:600});
 assert.deepEqual(pixelRegion(region,1600,1200),{x:160,y:120,width:800,height:480});
 let draw,closed=false;class Canvas{constructor(w,h){assert.equal(w,1000);assert.equal(h,600);}getContext(){return {drawImage:(...args)=>draw=args};}async convertToBlob(options){assert.equal(options.type,'image/png');return new Blob(['pixels'],options);}}
 const blob=await cropScreenshot(new Blob(['source']),region,{Canvas,decode:async()=>({width:2000,height:1500,close:()=>closed=true})});
 assert.deepEqual(draw.slice(1),[200,150,1000,600,0,0,1000,600]);assert.equal(blob.type,'image/png');assert.equal(closed,true);
});
test('框选不得越界或产生空画面，整屏明确覆盖整个可见区域',()=>{
 assert.deepEqual(captureRegion(null,{width:320,height:640}),{x:0,y:0,width:1,height:1});
 assert.throws(()=>captureRegion({x:12,y:12,width:0,height:20},{width:800,height:600}),/8像素/);
 assert.throws(()=>pixelRegion({x:.8,y:0,width:.8,height:1},1000,1000),/无效/);
 assert.throws(()=>captureRegion(null,{width:0,height:600}),/无效/);
});
