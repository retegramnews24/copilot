// Geometry/API contract test. Actual GPU shader compilation still needs WebGL hardware.
import assert from 'node:assert/strict';
import {Renderer} from '../public/labyrinth/render.js';
import {worldFor} from '../public/labyrinth/adventure.js';
const context=new Proxy({createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){}},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>context})};globalThis.devicePixelRatio=1;
let allocated=0,released=0,draws=0;const uniforms=new Map();
const gl=new Proxy({createBuffer:()=>{allocated++;return {}},deleteBuffer:()=>released++,createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(p,n)=>n,
 bufferData:(t,data)=>{assert.ok(data.length>=0);assert.ok(data.every(Number.isFinite));assert.equal(data.length%8,0)},uniform3fv:(n,data)=>{assert.ok([...data].every(Number.isFinite));uniforms.set(n,[...data])},uniform1f:(n,v)=>{assert.ok(Number.isFinite(v));uniforms.set(n,v)},uniformMatrix4fv:(n,t,data)=>assert.ok([...data].every(Number.isFinite)),drawArrays:(t,start,count)=>{assert.ok(count>0);assert.equal(count%3,0);draws++}
},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>{}});
const canvas={width:0,height:0,style:{},getContext:type=>type==='webgl'?gl:context,getBoundingClientRect:()=>({width:300,height:180})};const renderer=new Renderer(canvas);
for(let level=1;level<=6;level++){
 const w=worldFor(231,level);renderer.load(w);renderer.scene={items:[{...w.keyPosition,color:w.palette.stripe}],appearance:{shirt:'#66b8cf',shorts:'#3c62a3'},showcaseOpen:false,backpack:false,swordTaken:false};renderer.draw({...w.spawn,pitch:-.4},false,0);assert.deepEqual(uniforms.get('uAmbient'),w.palette.ambient);assert.equal(uniforms.get('uPower'),w.palette.power);
 renderer.scene={...renderer.scene,showcaseOpen:true,backpack:true,swordTaken:true,doorOpen:true};renderer.draw({...w.spawn,pitch:0},false,2,2.5);
}
renderer.destroy();assert.equal(allocated,released,'All GPU buffers released across floor changes and shutdown');assert.ok(draws>60);
const fallbackCanvas={...canvas,width:0,height:0,getContext:type=>type==='webgl'?null:context};const software=new Renderer(fallbackCanvas);assert.ok(software.software);for(let level=1;level<=6;level++){const w=worldFor(231,level);software.load(w);software.scene={items:[{...w.keyPosition,color:w.palette.stripe}],appearance:{shirt:'#66b8cf',shorts:'#3c62a3'}};software.draw({...w.spawn,pitch:-1},false,0);software.scene={...software.scene,showcaseOpen:true,swordTaken:true,backpack:true};software.draw({...w.spawn,pitch:0},false,1,3.3);if(level>1&&level<6)software.draw({...w.spawn,yaw:-Math.PI/2,pitch:0},false,2)}software.destroy();
console.log('PASS rendering contract: six floors, finite geometry/matrices, per-floor uniforms, solo body, cards, case/equipment/springs, GPU resource cleanup and software draw paths. GPU compilation not simulated.');
