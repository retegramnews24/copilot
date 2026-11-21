// Geometry/API contract test. Actual GPU shader compilation still needs WebGL hardware.
import assert from 'node:assert/strict';
import {avatarTransform,projectPoint,Renderer} from '../public/labyrinth/render.js';
import {armPose,limbModel} from '../public/labyrinth/character.js';
import {mirrorSide,reflectPoint} from '../public/labyrinth/mirrors.js';
import {worldFor} from '../public/labyrinth/adventure.js';
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){}},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({width:1,height:1,getContext:()=>context})};globalThis.devicePixelRatio=1;
let allocated=0,released=0,draws=0,offscreen=0,framebuffers=0,deletedFramebuffers=0;const uniforms=new Map();
const gl=new Proxy({createBuffer:()=>{allocated++;return {}},deleteBuffer:()=>released++,createShader:()=>({}),createProgram:()=>({}),createTexture:()=>({}),createFramebuffer:()=>{framebuffers++;return {}},deleteFramebuffer:()=>deletedFramebuffers++,createRenderbuffer:()=>({}),checkFramebufferStatus:()=>1,bindFramebuffer:(kind,target)=>{if(target)offscreen++},getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(p,n)=>n,
 bufferData:(t,data)=>{assert.ok(data.length>=0);assert.ok(data.every(Number.isFinite));assert.equal(data.length%8,0)},uniform3fv:(n,data)=>{assert.ok([...data].every(Number.isFinite));uniforms.set(n,[...data])},uniform1f:(n,v)=>{assert.ok(Number.isFinite(v));uniforms.set(n,v)},uniform2f:(n,x,y)=>uniforms.set(n,[x,y]),uniform4fv:(n,value)=>uniforms.set(n,[...value]),uniformMatrix4fv:(n,t,data)=>assert.ok([...data].every(Number.isFinite)),drawArrays:(t,start,count)=>{assert.ok(count>0);assert.equal(count%3,0);draws++}
},{get:(o,k)=>k in o?o[k]:k.toUpperCase()===k?1:()=>{}});
const canvas={width:0,height:0,style:{},getContext:(type,options)=>{if(type==='webgl'){assert.equal(options.antialias,true);return gl}return context},getBoundingClientRect:()=>({width:300,height:180})};const renderer=new Renderer(canvas);
for(let level=1;level<=6;level++){
 const w=worldFor(231,level);renderer.load(w);renderer.scene={items:[{...w.keyPosition,color:w.palette.stripe}],appearance:{shirt:'#66b8cf',shorts:'#3c62a3'},showcaseOpen:false,backpack:false,swordTaken:false,players:[{player:{...w.spawn,x:w.spawn.x+.4,height:.2},appearance:{shirt:'#cf514d',shorts:'#529766'},backpack:true,weapon:'sword',actionAt:Date.now()}],...(level===6?{cases:[0,3,-3,6].map(dx=>({...w.showcase,x:w.showcase.x+dx,open:false}))}:{})};renderer.draw({...w.spawn,pitch:-.4},false,0);assert.deepEqual(uniforms.get('uAmbient'),w.palette.ambient);assert.equal(uniforms.get('uPower'),w.palette.power);
 renderer.scene={...renderer.scene,showcaseOpen:true,backpack:true,swordTaken:true,doorOpen:true,traps:Object.fromEntries(w.frames.map(f=>[f.id,1000])),serverNow:2450};
 renderer.draw({...w.spawn,pitch:0},false,2,2.5);
 if(w.frames.length){const f=w.frames[0];renderer.draw({x:f.x+f.dx,z:f.z+f.dz,yaw:Math.atan2(-f.dx,f.dz),pitch:-.25},false,2.5)}

}
const maze=worldFor(231,2),mirror=maze.mirrors[0];
const viewer={x:mirror.x+mirror.nx*1.5,z:mirror.z+mirror.nz*1.5,yaw:Math.atan2(-mirror.nx,mirror.nz),pitch:0};
renderer.load(maze);renderer.scene={appearance:{shirt:'#66b8cf',shorts:'#3c62a3'},items:[],weapon:'sword',swing:.22,players:[]};
renderer.draw(viewer,false,3);
assert.ok(renderer.reflection);assert.ok(offscreen>=2);assert.deepEqual(uniforms.get('uClip'),[0,0,0,1]);assert.deepEqual(uniforms.get('uMirrorScale'),[0,0]);
const count=offscreen;renderer.draw({...viewer,yaw:viewer.yaw+Math.PI},false,4);assert.equal(offscreen,count);
renderer.draw({...viewer,pitch:-1.1},false,5);
assert.ok(renderer.hand.count>0&&renderer.upperArm.count>0&&renderer.lowerArm.count>0);
renderer.destroy();assert.equal(framebuffers,deletedFramebuffers);assert.equal(allocated,released,'All GPU buffers released across floor changes and shutdown');assert.ok(draws>60);
const fallbackCanvas={...canvas,width:0,height:0,getContext:type=>type==='webgl'?null:context};const software=new Renderer(fallbackCanvas);assert.ok(software.software);for(let level=1;level<=6;level++){const w=worldFor(231,level);software.load(w);software.scene={items:[{...w.keyPosition,color:w.palette.stripe}],appearance:{shirt:'#66b8cf',shorts:'#3c62a3'},players:[{player:{...w.spawn,z:w.spawn.z-1,height:0},appearance:{shirt:'#cf514d',shorts:'#529766'},weapon:'sword',actionAt:Date.now()}],...(level===6?{cases:[0,3,-3,6].map(dx=>({...w.showcase,x:w.showcase.x+dx,open:false}))}:{})};software.draw({...w.spawn,pitch:-1},false,0);software.scene={...software.scene,showcaseOpen:true,swordTaken:true,backpack:true};software.draw({...w.spawn,pitch:0},false,1,3.3);if(level>1&&level<6)software.draw({...w.spawn,yaw:-Math.PI/2,pitch:0},false,2)}software.load(maze);software.scene=renderer.scene;software.draw(viewer,false,3);software.draw({...viewer,pitch:-1.1},false,4);software.destroy();
console.log('PASS rendering contract: six floors, finite geometry/matrices, per-floor uniforms, solo body, cards, case/equipment/springs, GPU resource cleanup and software draw paths. GPU compilation not simulated.');

assert.ok(projectPoint({x:0,z:0,yaw:0,pitch:0},{x:0,y:1.62,z:-3},850,390));assert.equal(projectPoint({x:0,z:0,yaw:0,pitch:0},{x:0,y:1.62,z:3},850,390),null);

for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){const m=avatarTransform({x:0,z:0,yaw});assert.ok(Math.abs(-m[8]-Math.sin(yaw))<1e-7);assert.ok(Math.abs(-m[10]+Math.cos(yaw))<1e-7)}

const reflected=reflectPoint(mirror,viewer);
assert.ok(Math.abs(mirrorSide(mirror,viewer)+mirrorSide(mirror,reflected))<1e-8);
for(const side of [-1,1])for(const holding of [false,true])for(const swing of [0,.25,.5,.75,1]){
 const {shoulder,elbow,wrist}=armPose(side,holding,swing,.07);
 const model=limbModel(elbow,wrist);
 assert.ok([...model,...shoulder].every(Number.isFinite));
 for(let i=0;i<3;i++)assert.ok(Math.abs(model[12+i]+model[4+i]-wrist[i])<1e-7);
}
