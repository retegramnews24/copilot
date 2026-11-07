import {placeMirrors} from './mirrors.js';
import {placeFrames} from './traps.js';
import {CELL,makeLevel,random,distances,index,free} from './core.js';
export const FLOORS=[
 {name:'Giallo',stripe:'#ddc267',light:[1,.96,.77],ambient:[.29,.275,.215],fog:[.20,.18,.115],power:1.15,visibility:18,brightness:1},
 {name:'Verde',stripe:'#70b87a',light:[.32,1,.44],ambient:[.065,.12,.065],fog:[.025,.06,.03],power:.85,visibility:15,brightness:.67},
 {name:'Rosso',stripe:'#c54a49',light:[1,.12,.09],ambient:[.065,.018,.015],fog:[.035,.006,.006],power:.65,visibility:12,brightness:.43},
 {name:'Blu',stripe:'#426ab5',light:[.16,.3,1],ambient:[.014,.023,.055],fog:[.005,.01,.027],power:.47,visibility:9,brightness:.26},
 {name:'Nero',stripe:'#191b1e',light:[.62,.68,.74],ambient:[.008,.01,.014],fog:[.002,.003,.005],power:.21,visibility:7,brightness:.105}
];
export const ARENA_LIGHT={name:'Colosseo',stripe:'#cead73',light:[1,.92,.78],ambient:[.78,.69,.55],fog:[.65,.60,.51],power:.65,visibility:88,brightness:1};
export const STANDS_WAIT=5000, CROUCH_OFFSET=.46;
export const CLOTHES=[['Panna','#eee4c9'],['Giallo','#e5be43'],['Arancio','#d6813c'],['Corallo','#cf514d'],['Rosa','#d58da9'],['Viola','#8662b1'],['Celeste','#66b8cf'],['Blu','#3c62a3'],['Verde','#529766'],['Antracite','#333b42']];
export const centre=(i,n)=>({x:(i%n+.5)*CELL,z:(Math.floor(i/n)+.5)*CELL});
export function makeArena(seed){
 const n=17,grid=new Uint8Array(n*n),cx=n*CELL/2,cz=n*CELL/2,rx=20,rz=17.6;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(((x+.5)*CELL-cx)**2/rx**2+((z+.5)*CELL-cz)**2/rz**2>1)grid[index(x,z,n)]=1;
 const spawn={x:cx,z:cz+rz-3.6},showcase={x:cx,z:cz-rz+5.8},nets=[{x:cx,z:cz+2.2,halfWidth:9.25,halfDepth:2.9}],decor=[];
 for(let i=0;i<12;i++){const angle=i/12*Math.PI*2,x=cx+Math.cos(angle)*rx*.86,z=cz+Math.sin(angle)*rz*.86;if(Math.abs(x-cx)<3)continue;decor.push({x,z,type:i%2?'amphora':'brazier'})}
 const obstacles=[{x:showcase.x,z:showcase.z,halfWidth:1.08,halfDepth:.5},...decor.map(d=>({...d,halfWidth:.47,halfDepth:.47}))];
 return {seed,level:6,arena:true,n,grid,rooms:[],start:index(Math.floor(spawn.x/CELL),Math.floor(spawn.z/CELL),n),spawn:{...spawn,yaw:0},exit:0,key:0,keyPosition:{x:-99,z:-99},door:{x:cx,z:cz+rz-.025,dx:0,dz:1},lamps:[{...showcase,y:5},{...spawn,y:5},...decor.filter(d=>d.type==='brazier').map(d=>({...d,y:1.8}))],showcase,nets,decor,obstacles,oval:{cx,cz,rx,rz}};

}
export function standsView(world,seat=0){
 const {cx,cz,rx,rz}=world.oval,angle=Math.PI/2+(seat%5-2)*.16;
 const x=cx+Math.cos(angle)*(rx+3.05),z=cz+Math.sin(angle)*(rz+3.05);
 return {x,z,yaw:Math.atan2(cx-x,z-cz),pitch:-.25,height:3.1};
}
export function worldFor(seed,level){const w=level===6?makeArena(seed):makeLevel(seed,level);if(level>1&&level<6)w.lamps=w.lamps.filter((p,i)=>{const x=Math.floor(p.x/CELL),z=Math.floor(p.z/CELL),cell=index(x,z,w.n);return cell===w.exit||((x+z)%4===2&&(level<4||i%(level===5?4:2)===0))});w.palette=level===6?ARENA_LIGHT:FLOORS[level-1];w.frames=placeFrames(w,CELL,distances,random);w.mirrors=placeMirrors(w);return w}
export function newRun(seed,test=true){return {version:2,seed:seed>>>0,level:1,seconds:0,player:null,inventory:[],inventoryLayout:2,health:100,kitRemoved:true,backpack:false,floors:{},showcaseOpen:false,swordTaken:false,test};}
function randomSpot(world,salt){const rng=random(world.seed^Math.imul(world.level,7717)^salt),choices=[];for(let i=0;i<world.grid.length;i++)if(!world.grid[i]&&i!==world.start&&i!==world.exit&&i!==world.key&&!world.frames.some(f=>f.id===i))choices.push(i);return centre(choices[Math.floor(rng()*choices.length)],world.n)}
export function floorState(run,world){
 if(!run.floors[world.level])run.floors[world.level]={open:false,cycle:0,key:{...world.keyPosition},pass:world.level===5&&!hasPass(run)&&!Object.values(run.floors).some(f=>f.pass)?randomSpot(world,823):null};
 return run.floors[world.level];
}
export const capacity=run=>run.backpack?8:4;
export const hasPass=run=>run.inventory.includes('pass');
export function itemsAt(run,world){const f=floorState(run,world),items=[];if(!world.arena&&!f.open&&f.key)items.push({id:'key:'+world.level,type:'key',...f.key,color:world.palette.stripe});if(f.pass)items.push({id:'pass',type:'pass',...f.pass,color:'#16181b'});return items}
const freeSlot=(run,from=0)=>Array.from({length:capacity(run)},(_,i)=>i).find(i=>i>=from&&!run.inventory[i]);
function setSlot(inventory,slot,item){
 while(inventory.length<slot)inventory.push(null);
 inventory[slot]=item;
}
export function clearSlot(inventory,slot){
 inventory[slot]=null;
 while(inventory.length&&!inventory.at(-1))inventory.pop();
}
export function migrateInventory(run){
 if(run.inventoryLayout===2)return false;
 run.inventory.splice(1,0,null);
 if(run.inventory.length>3)run.inventory.splice(3,0,null);
 while(run.inventory.length&&!run.inventory.at(-1))run.inventory.pop();
 run.inventoryLayout=2;
 return true;
}
export function pickup(run,world,itemId){
 const slot=freeSlot(run);if(slot===undefined)return 'full';const f=floorState(run,world);
 if(itemId==='pass'&&f.pass&&!hasPass(run)){f.pass=null;setSlot(run.inventory,slot,'pass');return 'ok'}
 if(itemId==='key:'+world.level&&f.key&&!f.open){f.key=null;setSlot(run.inventory,slot,itemId);return 'ok'}return 'missing';
}
export function drop(run,world,slot,player){
 const id=run.inventory[slot];if(!id)return false;const f=floorState(run,world),p={x:player.x,z:player.z};
 if(id==='pass')f.pass=p;else if(id==='key:'+world.level&&!f.open)f.key=p;else return false;
 clearSlot(run.inventory,slot);return true;
}
export function putInHand(run,slot){
 if(!Number.isInteger(slot)||slot<0||slot>=capacity(run)||!run.inventory[slot])return false;
 const id=run.inventory[slot],hand=id==='shield'?1:0;
 if(slot===hand){
  const pocket=freeSlot(run,2);if(pocket===undefined)return false;
  setSlot(run.inventory,pocket,id);clearSlot(run.inventory,slot);return true;
 }
 const previous=run.inventory[hand];
 if(slot===1&&previous==='sword'){
  const pocket=freeSlot(run,2);if(pocket===undefined)return false;
  setSlot(run.inventory,pocket,previous);run.inventory[hand]=id;clearSlot(run.inventory,slot);return true;
 }
 setSlot(run.inventory,hand,id);
 if(previous)setSlot(run.inventory,slot,previous);else clearSlot(run.inventory,slot);
 return true;
}
export function openDoor(run,world){
 if(world.arena)return false;
 const f=floorState(run,world);if(f.open)return true;
 const i=run.inventory.indexOf('key:'+world.level);
 if(i<0&&!hasPass(run))return false;
 if(i>=0)clearSlot(run.inventory,i);
 f.key=null;
 f.open=true;return true;
}
export function openShowcase(run){if(run.level!==6||run.showcaseOpen)return false;run.showcaseOpen=true;return true}
export const SHOWCASE_GEAR=[['backpack','Zaino'],['sword','Spada'],['shield','Scudo'],['helmet','Elmetto'],['armor','Corazza']];
const gearFlag=kind=>kind==='sword'||kind==='shield'?kind+'Taken':kind;
export const hasGear=(run,kind)=>!!run[gearFlag(kind)];
export function takeGear(run,kind){
 if(run.level!==6||!run.showcaseOpen||!SHOWCASE_GEAR.some(([id])=>id===kind)||hasGear(run,kind)||kind==='sword'&&!run.backpack)return false;
 if(kind==='sword'||kind==='shield'){
  const hand=kind==='sword'?0:1,previous=run.inventory[hand];
  if(previous){
   const slot=freeSlot(run,2)??freeSlot(run);
   if(slot===undefined)return false;
   setSlot(run.inventory,slot,previous);
  }
  setSlot(run.inventory,hand,kind);
 }
 run[gearFlag(kind)]=true;
 return true;
}
export const takeBackpack=run=>takeGear(run,'backpack');
export const takeSword=run=>takeGear(run,'sword');
export const equipment=run=>({
 backpack:!!run.backpack,helmet:!!run.helmet,armor:!!run.armor,
 swordTaken:!!run.swordTaken,shieldTaken:!!run.shieldTaken,
 weapon:run.inventory[0]==='sword'?'sword':null,
 shield:run.inventory[1]==='shield'
});
export const healthValue=value=>Number.isFinite(value)?Math.max(1,Math.min(100,Math.round(value))):100;
export const FRAME_DAMAGE=25;
export function takeDamage(target,kind,damage,now,attacker=null){
 if(now<(target.protectedUntil||0))return null;
 const remaining=Math.max(0,healthValue(target.health)-damage);
 const fatal=remaining===0;
 target.health=fatal?100:remaining;
 if(fatal)target.protectedUntil=now+1250;
 return target.impact={kind,damage,fatal,attacker,number:(target.impact?.number||0)+1};
}
export function strikeDamage(kind,guarded,gear){
 if(kind==='fist')return guarded?0:2;
 if(gear.helmet&&gear.armor&&gear.shield)return 2;
 return guarded?7:10;
}
export function nextWaypoint(world,player,target){
 const start=index(Math.floor(player.x/CELL),Math.floor(player.z/CELL),world.n),end=index(Math.floor(target.x/CELL),Math.floor(target.z/CELL),world.n),ds=distances(world.grid,world.n,end);
 if(ds[start]<0)return null;if(start===end)return {...target,steps:0};const x=start%world.n,z=Math.floor(start/world.n),next=[[1,0],[-1,0],[0,1],[0,-1]].map(([a,b])=>index(x+a,z+b,world.n)).find(i=>ds[i]>=0&&ds[i]===ds[start]-1);return next===undefined?null:{...centre(next,world.n),steps:ds[start]};
}
export function readRun(raw){
 if(!raw||raw.version!==2||!Number.isInteger(raw.seed)||raw.seed<0||raw.seed>4294967295||!Number.isInteger(raw.level)||raw.level<1||raw.level>6)return null;
 const r=newRun(raw.seed,raw.test===true);r.level=raw.level;r.seconds=Number.isFinite(raw.seconds)?Math.max(0,Math.min(1e8,raw.seconds)):0;r.backpack=raw.backpack===true;r.showcaseOpen=raw.showcaseOpen===true;r.swordTaken=r.showcaseOpen&&raw.swordTaken===true;
 if(!r.showcaseOpen)r.backpack=false;
  for(const gear of ['armor','helmet','shieldTaken'])r[gear]=r.showcaseOpen&&raw[gear]===true;
 r.health=healthValue(raw.health);r.frameHits=(Array.isArray(raw.frameHits)?raw.frameHits:[]).filter(v=>typeof v==='string').slice(-12);
 const allowed=new Set(['pass',...(raw.floors?.[r.level]?.open?[]:['key:'+r.level]),...(r.swordTaken?['sword']:[]),...(r.shieldTaken?['shield']:[])]);
 const inventory={inventory:Array.isArray(raw.inventory)?raw.inventory.slice(0,8):[],inventoryLayout:raw.inventoryLayout};
 migrateInventory(inventory);
 r.inventory=inventory.inventory.slice(0,capacity(r)).map(id=>allowed.delete(id)?id:null);
 while(r.inventory.length&&!r.inventory.at(-1))r.inventory.pop();
 r.floors={};for(let level=1;level<=6;level++){const w=worldFor(r.seed,level),s=raw.floors?.[level];if(!s)continue;const valid=p=>p&&free(w,p.x,p.z)?{x:p.x,z:p.z}:null;const cycle=Number.isInteger(s.cycle)?Math.max(0,Math.min(1e6,s.cycle)):0;r.floors[level]={open:s.open===true,cycle,key:s.open?null:valid(s.key),pass:valid(s.pass),traps:Object.fromEntries(w.frames.filter(f=>Number.isFinite(s.traps?.[f.id])).map(f=>[f.id,s.traps[f.id]]))};if(!w.arena&&!s.open&&!r.floors[level].key&&!r.inventory.includes('key:'+level))r.floors[level].key=randomSpot(w,cycle*104729);}
 for(const [level,f] of Object.entries(r.floors))if(r.inventory.includes('key:'+level))f.key=null;
 if(r.test&&raw.kitRemoved!==true){r.inventory=r.inventory.includes('sword')?['sword']:[];r.floors={};r.frameHits=[]}
 // One master card throughout the expedition, including carried/dropped state.
 let found=hasPass(r);for(let level=1;level<=6;level++){const f=r.floors[level];if(!f?.pass)continue;if(found)f.pass=null;else found=true}
 if(found&&!r.floors[5]){const w=worldFor(r.seed,5);floorState(r,w).pass=null}
 const w=worldFor(r.seed,r.level),p=raw.player;r.player=p&&free(w,p.x,p.z,undefined,r.floors[r.level]?.open)?{x:p.x,z:p.z,yaw:Number.isFinite(p.yaw)?p.yaw:w.spawn.yaw,pitch:Number.isFinite(p.pitch)?Math.max(-1.15,Math.min(1.15,p.pitch)):0}:{...w.spawn,pitch:0};
 return r;
}
export function advanceBounce(state,dt,arena=false){dt=Math.min(.1,Math.max(0,dt));state.height+=state.velocity*dt-6.5*dt*dt;state.velocity-=13*dt;const max=arena?7.2:.92;if(state.height>max){state.height=max;state.velocity=Math.min(0,state.velocity)}if(state.height<0){state.height=0;state.velocity=0}return state}

export function onSpring(world,player){return !!world.arena&&world.nets.some(n=>Math.abs(player.x-n.x)<n.halfWidth-.12&&Math.abs(player.z-n.z)<n.halfDepth-.12)}
export function advanceAction(state,dt){state.remaining=Math.max(0,state.remaining-Math.max(0,Math.min(.1,dt)));state.cooldown=Math.max(0,state.cooldown-Math.max(0,Math.min(.1,dt)))}
export function beginAction(state){if(state.cooldown>0)return false;state.remaining=.42;state.cooldown=.55;return true}
