import assert from 'node:assert/strict';
import {free,move,CELL,index} from '../public/labyrinth/core.js';
import {FLOORS,worldFor,newRun,readRun,floorState,itemsAt,pickup,drop,hasPass,capacity,openDoor,closeDoor,openShowcase,takeBackpack,takeSword,nextWaypoint,advanceBounce,onSpring,beginAction,advanceAction} from '../public/labyrinth/adventure.js';
assert.equal(FLOORS.length,5);assert.deepEqual(FLOORS[0].ambient,[.29,.275,.215]);for(let i=1;i<5;i++)assert.ok(FLOORS[i].brightness<FLOORS[i-1].brightness);
for(let seed=0;seed<80;seed++){
 const r=newRun(seed,false);assert.equal(capacity(r),1);assert.equal(r.inventory.length,0);
 for(let level=1;level<=5;level++){
  r.level=level;const w=worldFor(seed,level),f=floorState(r,w);assert.equal(openDoor(r,w),false);assert.equal(itemsAt(r,w).filter(i=>i.type==='key').length,1);
  assert.equal(pickup(r,w,'key:'+level),'ok');assert.equal(pickup(r,w,'key:'+level),'full');assert.equal(itemsAt(r,w).filter(i=>i.type==='key').length,0);
  r.player={...w.spawn,pitch:0};const restored=readRun(JSON.parse(JSON.stringify(r)));assert.deepEqual(restored.inventory,r.inventory);assert.equal(itemsAt(restored,w).filter(i=>i.type==='key').length,0);
  assert.equal(openDoor(r,w),true);assert.equal(r.inventory.length,0);assert.equal(itemsAt(r,w).filter(i=>i.type==='key').length,0);
  for(let cycle=0;cycle<5;cycle++){assert.equal(closeDoor(r,w),true);assert.equal(closeDoor(r,w),false);assert.ok(free(w,f.key.x,f.key.z));assert.equal(itemsAt(r,w).filter(i=>i.type==='key').length,1);assert.equal(pickup(r,w,'key:'+level),'ok');assert.equal(openDoor(r,w),true)}
  // Guide walks reachable adjacent cells, eventually reaching the exit cell.
  const p={...w.spawn};let count=0;while(count++<w.n*w.n){const q=nextWaypoint(w,p,w.door);assert.ok(q);if(q.steps===0)break;assert.ok(free(w,q.x,q.z));move(w,p,q.x-p.x,q.z-p.z);assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<.01)}assert.ok(count<w.n*w.n);
 }
 const black=worldFor(seed,5);assert.ok(floorState(r,black).pass);assert.equal(pickup(r,black,'pass'),'ok');assert.ok(hasPass(r));closeDoor(r,black);assert.equal(openDoor(r,black),false,'In a normal run the master grants return access, not forward keycard replacement');assert.equal(drop(r,black,0,black.spawn),true);assert.equal(pickup(r,black,'pass'),'ok');
 r.level=6;const arena=worldFor(seed,6);assert.ok(arena.arena);assert.equal(takeBackpack(r),false);assert.equal(takeSword(r),false);assert.equal(openShowcase(r),true);assert.equal(openShowcase(r),false);assert.equal(takeSword(r),false);assert.equal(takeBackpack(r),true);assert.equal(capacity(r),5);assert.equal(takeBackpack(r),false);assert.equal(takeSword(r),true);assert.equal(takeSword(r),false);assert.deepEqual(r.inventory,['pass','sword']);
 r.player={...arena.spawn,pitch:0};assert.deepEqual(readRun(JSON.parse(JSON.stringify(r))).inventory,['pass','sword']);assert.equal(drop(r,arena,0,arena.spawn),true);const revived=readRun(JSON.parse(JSON.stringify(r)));assert.equal(itemsAt(revived,arena).filter(i=>i.type==='pass').length,1);assert.equal(itemsAt(revived,black).filter(i=>i.type==='pass').length,0);
}
const test=newRun(77,true);assert.equal(hasPass(test),false);const w=worldFor(77,1);floorState(test,w);assert.equal(openDoor(test,w),false);assert.equal(itemsAt(test,w).filter(i=>i.type==='key').length,1);
const legacy={...test,kitRemoved:undefined,inventory:['pass'],floors:{1:{open:true,key:null,pass:null,cycle:0}}};const migrated=readRun(legacy);assert.equal(hasPass(migrated),false);assert.equal(itemsAt(migrated,w).filter(i=>i.type==='key').length,1);assert.equal(floorState(migrated,w).open,false);const black=worldFor(77,5);assert.equal(itemsAt(migrated,black).filter(i=>i.type==='pass').length,1);
assert.equal(pickup(migrated,black,'pass'),'ok');migrated.level=5;migrated.player={...black.spawn};assert.equal(hasPass(readRun(JSON.parse(JSON.stringify(migrated)))),true,'A genuinely collected master survives future loads');assert.equal(readRun({version:2,seed:0,level:99}),null);
const arena=worldFor(17,6),o=arena.oval;assert.ok(o.rx>o.rz);assert.ok(Math.PI*o.rx*o.rz>1000);assert.equal(arena.nets.length,1);assert.equal(arena.nets[0].halfDepth*2,5.8);assert.equal(arena.nets[0].halfWidth*2,18.5);assert.ok(free(arena,arena.spawn.x,arena.spawn.z));
for(let a=0;a<Math.PI*2;a+=.05){assert.equal(free(arena,o.cx+Math.cos(a)*o.rx*1.01,o.cz+Math.sin(a)*o.rz*1.01),false);const p={...arena.spawn};move(arena,p,Math.cos(a)*100,Math.sin(a)*100);assert.ok(free(arena,p.x,p.z))}
const net=arena.nets[0];for(const dx of [-8,0,8])assert.ok(onSpring(arena,{x:net.x+dx,z:net.z}));assert.equal(onSpring(arena,{x:net.x,z:net.z+3.1}),false);assert.equal(free(arena,arena.showcase.x,arena.showcase.z),false);
const action={remaining:0,cooldown:0};assert.equal(beginAction(action),true);assert.equal(beginAction(action),false);for(let i=0;i<6;i++)advanceAction(action,.1);assert.equal(action.remaining,0);assert.equal(action.cooldown,0);assert.equal(beginAction(action),true);
for(const arena of [false,true]){const jump={height:0,velocity:9.3};let peak=0;for(let i=0;i<180;i++){advanceBounce(jump,1/60,arena);peak=Math.max(peak,jump.height)}assert.equal(jump.height,0);assert.ok(peak<=(arena?7.2:.92));if(arena)assert.ok(peak>3)}
console.log('PASS adventure: 80 expeditions × five floors, unique cards through pickup/open/close/drop/save, reachable guidance, black master card, solo showcase gating, backpack capacity, unique sword, arena persistence and safe spring physics.');
