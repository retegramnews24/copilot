import {CELL,distances,random} from './core.js';

export const MIRROR_HALF=.82, MIRROR_BOTTOM=.19, MIRROR_TOP=2.32;
export const mirrorSide=(mirror,p)=>(p.x-mirror.x)*mirror.nx+(p.z-mirror.z)*mirror.nz;

export function reflectPoint(mirror,p){
 const distance=2*mirrorSide(mirror,p);
 return {x:p.x-distance*mirror.nx,y:p.y,z:p.z-distance*mirror.nz};
}
export function mirrorCorners(mirror,margin=0){
 const half=MIRROR_HALF+margin;
 return [[-half,MIRROR_BOTTOM-margin],[half,MIRROR_BOTTOM-margin],[half,MIRROR_TOP+margin],[-half,MIRROR_TOP+margin]].map(([u,y])=>({
  x:mirror.x+mirror.nz*u,y,z:mirror.z-mirror.nx*u
 }));
}
export function placeMirrors(world){
 if(world.arena)return [];
 const {n,grid,start,key,exit}=world,fromStart=distances(grid,n,start),fromExit=distances(grid,n,exit),rng=random(world.seed^Math.imul(world.level,9137));
 const frames=new Set(world.frames.map(frame=>frame.id)),candidates=[];
 for(let i=0;i<grid.length;i++){
  if(grid[i]||fromStart[i]<1||i===key||i===exit||frames.has(i))continue;
  const walls=[[1,0],[-1,0],[0,1],[0,-1]].filter(([nx,nz])=>grid[i-nx-nz*n]);
  if(!walls.length)continue;
  const [nx,nz]=walls[Math.floor(rng()*walls.length)];
  candidates.push({
   x:(i%n+.5)*CELL-nx*(CELL/2-.038),z:(Math.floor(i/n)+.5)*CELL-nz*(CELL/2-.038),nx,nz,
   cell:i,steps:fromStart[i],score:rng()+(fromStart[i]+fromExit[i]===fromStart[exit]?0:1)
  });
 }
 candidates.sort((a,b)=>a.steps-b.steps);
 const mirrors=candidates.splice(0,1);
 candidates.sort((a,b)=>a.score-b.score);
 for(const mirror of candidates){
  if(mirrors.every(other=>Math.hypot(other.x-mirror.x,other.z-mirror.z)>7))mirrors.push(mirror);
  if(mirrors.length===3)break;
 }
 return mirrors;
}
