// The frames are placed in straight corridors, away from cards and entrances.
export const FRAME_WIDTH=.52, FRAME_LENGTH=2.60;
const WARNING_MS=920, FALL_MS=480, REST_ANGLE=Math.asin(2.565/FRAME_LENGTH), BASE=.045;
export function placeFrames(world,cell,distances,random){
 if(world.level<2||world.arena)return [];
 const fromStart=distances(world.grid,world.n,world.start);
 const fromKey=distances(world.grid,world.n,world.key);
 const fromExit=distances(world.grid,world.n,world.exit);
 const rng=random(world.seed^Math.imul(world.level,7649)),candidates=[];
 for(let i=0;i<world.grid.length;i++){
  if(world.grid[i]||fromStart[i]<4||fromKey[i]<3||fromExit[i]<3)continue;
  const horizontal=world.grid[i-world.n]&&world.grid[i+world.n]&&!world.grid[i-1]&&!world.grid[i+1];
  const vertical=world.grid[i-1]&&world.grid[i+1]&&!world.grid[i-world.n]&&!world.grid[i+world.n];
  if(!horizontal&&!vertical)continue;
  const side=rng()<.5?-1:1,dx=vertical?side:0,dz=horizontal?side:0;
  const onRoute=fromStart[i]+fromKey[i]===fromStart[world.key]||fromKey[i]+fromExit[i]===fromKey[world.exit];
  candidates.push({id:i,x:(i%world.n+.5)*cell-dx*(cell/2-.035),z:(Math.floor(i/world.n)+.5)*cell-dz*(cell/2-.035),dx,dz,order:rng()+(onRoute?0:1)});
 }
 candidates.sort((a,b)=>a.order-b.order);
 const frames=[];
 for(const frame of candidates){
  if(frames.every(f=>Math.hypot(f.x-frame.x,f.z-frame.z)>6))frames.push(frame);
  if(frames.length===(world.level<4?1:2))break;
 }
 return frames;
}
export function framePose(start,now){
 const age=start===undefined?-1:now-start;
 if(age<0)return {phase:'hung',angle:0,y:BASE};
 if(age<WARNING_MS)return {phase:'warning',angle:.018+.016*Math.sin(age*.10),y:BASE};
 const t=Math.min(1,(age-WARNING_MS)/FALL_MS);
 return {phase:t===1?'fallen':'falling',angle:REST_ANGLE*t*t,y:BASE};
}
export function triggerFrames(world,floor,player,now){
 let triggered=false;
 for(const f of world.frames||[]){
  if(floor.traps?.[f.id]!==undefined)continue;
  const u=(player.x-f.x)*f.dx+(player.z-f.z)*f.dz;
  const along=(player.x-f.x)*-f.dz+(player.z-f.z)*f.dx;
  if(u>=0&&u<2.6&&Math.abs(along)<2.15){
   (floor.traps??={})[f.id]=now;
   triggered=true;
  }
 }
 return triggered;
}
export function settledFrames(world,floor,now){
 return (world.frames||[]).filter(f=>floor.traps?.[f.id]!==undefined&&now-floor.traps[f.id]>=WARNING_MS+FALL_MS);
}
function frameHeight(f,x,z,r,angle){
 const u=(x-f.x)*f.dx+(z-f.z)*f.dz;
 const along=(x-f.x)*-f.dz+(z-f.z)*f.dx;
 if(Math.abs(along)>FRAME_WIDTH/2+r||u< -r||u>Math.sin(angle)*FRAME_LENGTH+r)return 0;
 return BASE+Math.max(0,u)*Math.cos(angle)/Math.max(.001,Math.sin(angle))+.075;
}
export function frameSupport(frames,x,z,r){
 let height=0;
 for(const f of frames||[])height=Math.max(height,frameHeight(f,x,z,r,REST_ANGLE));
 return height;
}
export function frameStrike(world,floor,from,to,since,now,r){
 for(const f of world.frames||[]){
  const start=floor.traps?.[f.id];
  if(start===undefined)continue;
  const first=Math.max(since,start+WARNING_MS),last=Math.min(now,start+WARNING_MS+FALL_MS-1);
  if(first>last)continue;
  const steps=Math.max(1,Math.ceil((last-first)/20));
  for(let i=0;i<=steps;i++){
   const time=first+(last-first)*i/steps,t=(time-since)/Math.max(1,now-since);
   const x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
   const feet=(from.height||0)+((to.height||0)-(from.height||0))*t;
   const y=frameHeight(f,x,z,r,framePose(start,time).angle);
   if(y>feet-.02&&y>0&&y<feet+1.78)return true;
  }
 }
 return false;
}
