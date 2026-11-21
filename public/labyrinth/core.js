import {frameSupport} from './traps.js';

// Pure deterministic world/physics. No DOM, networking or external assets.
export const CELL=2.6,HEIGHT=2.72,RADIUS=.23,VERSION=1;
export function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
export const index=(x,z,n)=>z*n+x;
export function distances(grid,n,start){
 const dist=new Int32Array(n*n).fill(-1),queue=[start];dist[start]=0;
 for(let h=0;h<queue.length;h++){const p=queue[h],x=p%n,z=Math.floor(p/n);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=n||nz>=n)continue;const q=index(nx,nz,n);if(!grid[q]&&dist[q]<0){dist[q]=dist[p]+1;queue.push(q)}}}
 return dist;
}
export function makeLevel(seed,level=1){
 level=Number.isFinite(level)?Math.max(1,Math.min(999,Math.floor(level))):1;const rng=random((seed>>>0)^Math.imul(level,0x45d9f3b)),n=17+2*Math.min(5,Math.floor((level-1)/2)),grid=new Uint8Array(n*n).fill(1),stack=[[1,1]];
 grid[index(1,1,n)]=0;
 while(stack.length){const [x,z]=stack.at(-1),options=[];for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]]){const xx=x+dx,zz=z+dz;if(xx>0&&zz>0&&xx<n-1&&zz<n-1&&grid[index(xx,zz,n)])options.push([xx,zz])}if(!options.length){stack.pop();continue}const [xx,zz]=options[Math.floor(rng()*options.length)];grid[index((x+xx)/2,(z+zz)/2,n)]=0;grid[index(xx,zz,n)]=0;stack.push([xx,zz])}
 // Small offices break up corridors; a central column preserves the uncanny layout.
 const rooms=[];
 for(let k=0;k<4+Math.min(level,4);k++){const x=3+2*Math.floor(rng()*((n-5)/2)),z=3+2*Math.floor(rng()*((n-5)/2));for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)grid[index(x+dx,z+dz,n)]=0;if(k%3===2&&x>5&&z>5)grid[index(x,z,n)]=1;rooms.push([x,z])}
 const start=index(1,1,n),fromStart=distances(grid,n,start);let exit=start;
 for(let i=0;i<grid.length;i++)if(fromStart[i]>fromStart[exit]&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>{const x=i%n+dx,z=Math.floor(i/n)+dz;return x>=0&&z>=0&&x<n&&z<n&&grid[index(x,z,n)]}))exit=i;
 const fromExit=distances(grid,n,exit);let key=start,best=-1;
 for(let i=0;i<grid.length;i++){if(grid[i]||i===exit||i===start)continue;const score=Math.min(fromStart[i],fromExit[i])+.2*(fromStart[i]+fromExit[i]);if(score>best){best=score;key=i}}
 const centre=i=>({x:(i%n+.5)*CELL,z:(Math.floor(i/n)+.5)*CELL});
 const exitX=exit%n,exitZ=Math.floor(exit/n);let facing=[0,-1];for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]])if(grid[index(exitX+dx,exitZ+dz,n)]===1){facing=[dx,dz];break}
 const spawn=centre(start),door={...centre(exit),dx:facing[0],dz:facing[1]};door.x+=door.dx*(CELL/2-.06);door.z+=door.dz*(CELL/2-.06);
 const startDirections=[[1,0],[0,1],[-1,0],[0,-1]].filter(([dx,dz])=>!grid[index(1+dx,1+dz,n)]),direction=startDirections[0]||[1,0];
 const lamps=[];for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)if(!grid[index(x,z,n)]&&((x+z)%4===2||index(x,z,n)===key||index(x,z,n)===exit))lamps.push({x:(x+.5)*CELL,y:HEIGHT-.07,z:(z+.5)*CELL,phase:rng()*6.28});
 return {seed:seed>>>0,level,n,grid,rooms,start,exit,key,spawn:{...spawn,yaw:Math.atan2(direction[0],-direction[1])},keyPosition:centre(key),door,lamps};
}
export const DOOR_HALF=.61, DOOR_HEIGHT=2.2, PLAYER_CLEARANCE=.58;
export const forwardVector=yaw=>({x:Math.sin(yaw),z:-Math.cos(yaw)});
const doorDepth=(door,x,z)=>(x-door.x)*door.dx+(z-door.z)*door.dz;
const doorOffset=(door,x,z)=>(z-door.z)*door.dx-(x-door.x)*door.dz;
export function crossedDoor(world,from,to){
 const door=world.door,wall=0,old=doorDepth(door,from.x,from.z),next=doorDepth(door,to.x,to.z);
 if(world.arena||old>=wall||next<wall)return false;
 const t=(wall-old)/(next-old),offset=doorOffset(door,from.x,from.z)*(1-t)+doorOffset(door,to.x,to.z)*t;
 return Math.abs(offset)<=DOOR_HALF-RADIUS;
}
export function free(world,x,z,radius=RADIUS,doorOpen=false){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<radius||z<radius||x>=world.n*CELL-radius||z>=world.n*CELL-radius)return false;
 if(world.oval){const o=world.oval;if(((x-o.cx)/(o.rx-radius))**2+((z-o.cz)/(o.rz-radius))**2>1)return false;for(const b of world.obstacles||[])if(Math.abs(x-b.x)<b.halfWidth+radius&&Math.abs(z-b.z)<b.halfDepth+radius)return false;return true}
 for(let zz=Math.floor((z-radius)/CELL);zz<=Math.floor((z+radius)/CELL);zz++)for(let xx=Math.floor((x-radius)/CELL);xx<=Math.floor((x+radius)/CELL);xx++){
  if(!world.grid[index(xx,zz,world.n)])continue;
  const door=world.door;
  if(doorOpen&&door&&xx===Math.floor((door.x+door.dx*.12)/CELL)&&zz===Math.floor((door.z+door.dz*.12)/CELL)&&
   doorDepth(door,x,z)<=.055&&Math.abs(doorOffset(door,x,z))<=DOOR_HALF-radius)continue;
  const px=Math.max(xx*CELL,Math.min(x,(xx+1)*CELL)),pz=Math.max(zz*CELL,Math.min(z,(zz+1)*CELL));if((x-px)**2+(z-pz)**2<radius*radius)return false;
 }
 return true;
}
export function move(world,player,dx,dz,{doorOpen=false,people=[],frames=[],height=player.height||0,fromHeight=height}={}){
 if(!Number.isFinite(dx)||!Number.isFinite(dz)||(!dx&&!dz))return player;
 const steps=Math.ceil(Math.hypot(dx,dz)/.045),sx=dx/steps,sz=dz/steps;
 let feet=fromHeight;
 const canMove=(x,z)=>{
  if(!free(world,x,z,RADIUS,doorOpen))return false;
  if(frames.length){
   const surface=frameSupport(frames,x,z,RADIUS);
   if(surface>feet+.001&&surface>frameSupport(frames,player.x,player.z,RADIUS)+.001)return false;
  }
  for(const other of people){
   if(Math.abs(feet-(other.height||0))>=1.75)continue;
   const before=(player.x-other.x)**2+(player.z-other.z)**2,after=(x-other.x)**2+(z-other.z)**2;
   // Players sharing a spawn may separate freely.
   if(after<PLAYER_CLEARANCE**2&&after<before-1e-9)return false;
  }
  return true;
 };
 for(let i=0;i<steps;i++){
  feet=fromHeight+(height-fromHeight)*(i+1)/steps;
  const x=player.x+sx,z=player.z+sz;
  if(canMove(x,z)){player.x=x;player.z=z;continue}
  if(Math.abs(sx)>=Math.abs(sz)){
   if(sx&&canMove(x,player.z))player.x=x;
   if(sz&&canMove(player.x,z))player.z=z;
  }else{
   if(sz&&canMove(player.x,z))player.z=z;
   if(sx&&canMove(x,player.z))player.x=x;
  }
 }
 return player;
}
export function interaction(world,player,hasKey){
 if(!hasKey&&Math.hypot(player.x-world.keyPosition.x,player.z-world.keyPosition.z)<1.55)return 'key';
 if(Math.hypot(player.x-world.door.x,player.z-world.door.z)<1.9)return hasKey?'exit':'locked';
 return null;
}
export function restoreProgress(raw){
 if(!raw||raw.version!==VERSION||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>4294967295||!Number.isInteger(raw.level)||raw.level<1||raw.level>999)return null;
 const world=makeLevel(raw.seed,raw.level),p=raw.player||{},valid=free(world,p.x,p.z);
 return {seed:raw.seed,level:raw.level,hasKey:raw.hasKey===true,seconds:Number.isFinite(raw.seconds)?Math.max(0,Math.min(raw.seconds,1e8)):0,player:{x:valid?p.x:world.spawn.x,z:valid?p.z:world.spawn.z,yaw:Number.isFinite(p.yaw)?p.yaw:world.spawn.yaw,pitch:Number.isFinite(p.pitch)?Math.max(-1.15,Math.min(1.15,p.pitch)):0}};
}

// A readable door's U axis points to the viewer's right from inside the room.
export function doorBasis(door){return {rightX:-door.dz,rightZ:door.dx,normalX:-door.dx,normalZ:-door.dz}}
export function beginJump(state){
 if(state.height>.001||state.velocity>0)return false;
 state.height=0;state.velocity=4.1;return true;
}
export function advanceJump(state,dt){
 if(!Number.isFinite(dt)||dt<=0)return state;
 dt=Math.min(dt,.1);const gravity=13,ceiling=HEIGHT-1.8;
 state.height+=state.velocity*dt-.5*gravity*dt*dt;state.velocity-=gravity*dt;
 if(state.height>=ceiling){state.height=ceiling;state.velocity=Math.min(0,state.velocity)}
 if(state.height<=0){state.height=0;state.velocity=0}
 return state;
}
