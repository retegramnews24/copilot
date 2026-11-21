import assert from 'node:assert/strict';
import {makeLevel,distances,index,CELL,VERSION,move,free,interaction,restoreProgress,doorBasis,beginJump,advanceJump,HEIGHT} from '../public/labyrinth/core.js';
function path(world,start,end){const ds=distances(world.grid,world.n,start);assert.ok(ds[end]>=0);const result=[end];let p=end;while(p!==start){const x=p%world.n,z=Math.floor(p/world.n);p=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>index(x+a,z+b,world.n)).find(i=>ds[i]===ds[p]-1);assert.notEqual(p,undefined);result.unshift(p)}return result}
function walk(world,player,cells){for(const cell of cells){const x=(cell%world.n+.5)*CELL,z=(Math.floor(cell/world.n)+.5)*CELL;for(let j=0;j<80&&Math.hypot(x-player.x,z-player.z)>.001;j++){const dx=x-player.x,dz=z-player.z,length=Math.hypot(dx,dz),scale=Math.min(1,.15/length);move(world,player,dx*scale,dz*scale)}assert.ok(Math.hypot(x-player.x,z-player.z)<.01);assert.ok(free(world,player.x,player.z))}}
for(let seed=0;seed<100;seed++)for(const level of [1,2,4,8,20]){
 const w=makeLevel(seed,level),same=makeLevel(seed,level);assert.deepEqual(w.grid,same.grid);assert.equal(w.key,same.key);assert.equal(w.exit,same.exit);assert.notEqual(w.key,w.exit);assert.notEqual(w.key,w.start);
 const ds=distances(w.grid,w.n,w.start);let open=0;for(let i=0;i<w.grid.length;i++)if(!w.grid[i]){open++;assert.ok(ds[i]>=0,'No disconnected room')}
 for(let i=0;i<w.n;i++)for(const cell of [i,(w.n-1)*w.n+i,i*w.n,i*w.n+w.n-1])assert.equal(w.grid[cell],1,'Boundary remains closed');
 assert.ok(open>70);assert.ok(ds[w.exit]>12);assert.ok(free(w,w.spawn.x,w.spawn.z));const p={...w.spawn};walk(w,p,path(w,w.start,w.key));assert.equal(interaction(w,p,false),'key');
 walk(w,p,path(w,w.key,w.exit));assert.equal(interaction(w,p,false),'locked');assert.equal(interaction(w,p,true),'exit');
 // Rapid movement cannot cross walls or leave the map.
 move(w,p,50,0);assert.ok(free(w,p.x,p.z));move(w,p,0,-50);assert.ok(free(w,p.x,p.z));
}
const world=makeLevel(71,3),saved={version:VERSION,seed:71,level:3,hasKey:true,seconds:120,player:{...world.spawn,pitch:.2}};assert.deepEqual(restoreProgress(saved).player,saved.player);assert.equal(restoreProgress(saved).hasKey,true);
assert.equal(restoreProgress({...saved,version:0}),null);assert.equal(restoreProgress({...saved,seed:-1}),null);assert.equal(restoreProgress({...saved,level:Infinity}),null);
const recovered=restoreProgress({...saved,player:{x:0,z:NaN,pitch:Infinity,yaw:Infinity}});assert.equal(recovered.player.x,world.spawn.x);assert.equal(recovered.player.z,world.spawn.z);assert.equal(recovered.player.pitch,0);
assert.equal(restoreProgress({...saved,hasKey:'false'}).hasKey,false);const p={...world.spawn};move(world,p,Infinity,0);assert.equal(p.x,world.spawn.x);
assert.notDeepEqual(makeLevel(71,1).grid,makeLevel(71,2).grid);
console.log('PASS Labyrinth: 500 deterministic levels, connected rooms, closed boundaries, physically walkable key/exit routes, locked/unlocked door, anti-tunnelling and validated save recovery.');

// Read the door from inside, in every cardinal orientation.
for(const [dx,dz,rx,rz] of [[0,-1,1,0],[1,0,0,1],[0,1,-1,0],[-1,0,0,-1]]){
 const basis=doorBasis({dx,dz});assert.equal(basis.rightX||0,rx);assert.equal(basis.rightZ||0,rz);
 const yaw=Math.atan2(dx,-dz),cameraRight=[Math.cos(yaw),Math.sin(yaw)];assert.ok(cameraRight[0]*basis.rightX+cameraRight[1]*basis.rightZ>.999);
 assert.equal(basis.normalX||0,-dx||0);assert.equal(basis.normalZ||0,-dz||0);
}
for(const hz of [20,30,60,120]){
 const state={height:0,velocity:0};assert.equal(beginJump(state),true);let peak=0,airborne=0;
 for(let i=0;i<hz;i++){advanceJump(state,1/hz);peak=Math.max(peak,state.height);if(state.height>0){airborne++;assert.equal(beginJump(state),false)}}
 assert.ok(peak>.60&&peak<.67);assert.ok(airborne/hz>.55&&airborne/hz<.70);assert.equal(state.height,0);assert.equal(state.velocity,0);assert.equal(beginJump(state),true);
}
const ceiling={height:HEIGHT-1.81,velocity:100};advanceJump(ceiling,.1);assert.ok(ceiling.height<=HEIGHT-1.8);assert.equal(ceiling.velocity,0);
console.log('PASS correction: door UV direction faces the viewer in all four orientations; jump rises and lands consistently, blocks double jumps and respects ceiling height.');

// A diagonal input against a corner slides along the exposed wall, then releases immediately.
const corner={n:5,grid:new Uint8Array(25)};corner.grid[index(2,2,5)]=1;
const runner={x:2*CELL-.3,z:3*CELL-.5};
for(let i=0;i<28;i++){move(corner,runner,.04,.04);assert.ok(free(corner,runner.x,runner.z))}
assert.ok(runner.x>2*CELL&&runner.z>3*CELL);
const before={...runner};move(corner,runner,-.2,.2);assert.ok(runner.x<before.x-.19&&runner.z>before.z+.19);
