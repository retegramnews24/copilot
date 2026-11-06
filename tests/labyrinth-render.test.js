// Geometry/API contract test. Actual GPU shader compilation still needs WebGL hardware.
import assert from 'node:assert/strict';
import {projectPoint,Renderer} from '../public/labyrinth/render.js';
import {worldFor} from '../public/labyrinth/adventure.js';
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){}},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>context})};globalThis.devicePixelRatio=1;
let allocated=0,released=0,draws=0;const uniforms=new Map();
const gl=new Proxy({createBuffer:()=>{allocated++;return {}},deleteBuffer:()=>released++,createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(p,n)=>n,
 bufferData:(t,data)=>{assert.ok(data.length>=0);assert.ok(data.every(Number.isFinite));assert.equal(data.length%8,0)},uniform3fv:(n,data)=>{assert.ok([...data].every(Number.isFinite));uniforms.set(n,[...data])},uniform1f:(n,v)=>{assert.ok(Number.isFinite(v));uniforms.set(n,v)},uniformMatrix4fv:(n,t,data)=>assert.ok([...data].every(Number.isFinite)),drawArrays:(t,start,count)=>{assert.ok(count>0);assert.equal(count%3,0);draws++}
},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>{}});
const canvas={width:0,height:0,style:{},getContext:type=>type==='webgl'?gl:context,getBoundingClientRect:()=>({width:300,height:180})};const renderer=new Renderer(canvas);
for(let level=1;level<=6;level++){
 const w=worldFor(231,level);renderer.load(w);renderer.scene={items:[{...w.keyPosition,color:w.palette.stripe}],appearance:{shirt:'#66b8cf',shorts:'#3c62a3'},showcaseOpen:false,backpack:false,swordTaken:false,players:[{player:{...w.spawn,x:w.spawn.x+.4,height:.2},appearance:{shirt:'#cf514d',shorts:'#529766'},backpack:true,weapon:'sword',actionAt:Date.now()}],...(level===6?{cases:[0,3,-3,6].map(dx=>({...w.showcase,x:w.showcase.x+dx,open:false}))}:{})};renderer.draw({...w.spawn,pitch:-.4},false,0);assert.deepEqual(uniforms.get('uAmbient'),w.palette.ambient);assert.equal(uniforms.get('uPower'),w.palette.power);
 renderer.scene={...renderer.scene,showcaseOpen:true,backpack:true,swordTaken:true,doorOpen:true};renderer.draw({...w.spawn,pitch:0},false,2,2.5);
}
renderer.destroy();assert.equal(allocated,released,'All GPU buffers released across floor changes and shutdown');assert.ok(draws>60);
const fallbackCanvas={...canvas,width:0,height:0,getContext:type=>type==='webgl'?null:context};const software=new Renderer(fallbackCanvas);assert.ok(software.software);for(let level=1;level<=6;level++){const w=worldFor(231,level);software.load(w);software.scene={items:[{...w.keyPosition,color:w.palette.stripe}],appearance:{shirt:'#66b8cf',shorts:'#3c62a3'},players:[{player:{...w.spawn,z:w.spawn.z-1,height:0},appearance:{shirt:'#cf514d',shorts:'#529766'},weapon:'sword',actionAt:Date.now()}],...(level===6?{cases:[0,3,-3,6].map(dx=>({...w.showcase,x:w.showcase.x+dx,open:false}))}:{})};software.draw({...w.spawn,pitch:-1},false,0);software.scene={...software.scene,showcaseOpen:true,swordTaken:true,backpack:true};software.draw({...w.spawn,pitch:0},false,1,3.3);if(level>1&&level<6)software.draw({...w.spawn,yaw:-Math.PI/2,pitch:0},false,2)}software.destroy();
console.log('PASS rendering contract: six floors, finite geometry/matrices, per-floor uniforms, solo body, cards, case/equipment/springs, GPU resource cleanup and software draw paths. GPU compilation not simulated.');

assert.ok(projectPoint({x:0,z:0,yaw:0,pitch:0},{x:0,y:1.62,z:-3},850,390));assert.equal(projectPoint({x:0,z:0,yaw:0,pitch:0},{x:0,y:1.62,z:3},850,390),null);
