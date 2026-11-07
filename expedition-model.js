import {worldFor,floorState,itemsAt,pickup,drop,openDoor,putInHand,takeGear,hasPass,CLOTHES,SHOWCASE_GEAR,clearSlot,migrateInventory,equipment,takeDamage,strikeDamage,FRAME_DAMAGE} from './public/labyrinth/adventure.js';
import {crossedDoor,free,move,RADIUS} from './public/labyrinth/core.js';
import {struckFrame,settledFrames,triggerFrames} from './public/labyrinth/traps.js';
export const GRACE=60000,STALE=45000,MAX_PLAYERS=16;
const fail=m=>{throw Error(m)},palette=new Set(CLOTHES.map(c=>c[1]));
export const clothes=a=>({shirt:palette.has(a?.shirt)?a.shirt:CLOTHES[6][1],shorts:palette.has(a?.shorts)?a.shorts:CLOTHES[7][1]});
export function createExpedition(room,number,seed,user,now){const s={room,number,seed,version:1,game:'labyrinth',created:now,revision:0,players:{},floors:{},entryLocked:false,showcaseOpen:false,archived:false,deleted:false};joinExpedition(s,user,now);ensureKeycards(s);return s}
export function participants(s){return Object.values(s.players).filter(p=>p.counted)}
export function casePosition(s,p){const w=worldFor(s.seed,6),i=p.caseIndex;return {x:w.showcase.x+[0,3,-3,6][i%4],z:w.showcase.z+Math.floor(i/4)*3.2}}
export function cases(s){return participants(s).map(p=>({id:p.id,name:p.name,...casePosition(s,p),...equipment(p),open:s.showcaseOpen}))}
const mazeCache=new WeakMap();
export function expeditionWorld(s,level){
 if(level!==6){
  if(!mazeCache.has(s))mazeCache.set(s,new Map());
  const levels=mazeCache.get(s);if(!levels.has(level))levels.set(level,worldFor(s.seed,level));
  return levels.get(level);
 }
 const w=worldFor(s.seed,level);if(level===6){w.obstacles=w.obstacles.filter(b=>b.type);w.obstacles.push(...cases(s).map(c=>({...c,halfWidth:1.08,halfDepth:.5})))}return w}
export function runFor(s,p){return {seed:s.seed,level:p.level,inventory:p.inventory,...equipment(p),floors:s.floors,showcaseOpen:s.showcaseOpen,test:false}}
// Initialize shared cards on the server, including persisted rooms from older builds.
// A held card suppresses ground respawn; repairing missing data must never clone it.
export function ensureKeycards(s){
 let changed=false;const people=Object.values(s.players),first=people[0];if(!first)return false;
 for(const p of people)if(migrateInventory(p)){p.health=100;p.guard=false;changed=true}
 for(let level=1;level<=5;level++){
  const w=expeditionWorld(s,level),missing=!s.floors[level],f=floorState(runFor(s,first),w);if(missing)changed=true;
  const key='key:'+level;
  if(f.open)for(const p of people){
   const slot=p.inventory.indexOf(key);
   if(slot>=0){clearSlot(p.inventory,slot);changed=true}
  }
  const held=people.some(p=>p.inventory.includes(key));
  if(f.open||held){if(f.key){f.key=null;changed=true}}
  else if(!f.key||!free(w,f.key.x,f.key.z,.28)){f.key={...w.keyPosition};changed=true}
 }
 return changed;
}
export function joinExpedition(s,user,now){
 if(s.archived||s.deleted)fail('Spedizione non attiva.');let p=s.players[user.id];
 if(!p){if(s.entryLocked||s.showcaseOpen)fail('Ingressi chiusi: puoi assistere.');const list=Object.values(s.players);if(list.length>=MAX_PLAYERS)fail('Spedizione piena: puoi assistere.');const w=worldFor(s.seed,1);p=s.players[user.id]={id:user.id,name:user.name.slice(0,60),level:1,player:{...w.spawn,pitch:0,height:0},inventory:[],inventoryLayout:2,health:100,guard:false,backpack:false,swordTaken:false,appearance:clothes(),caseIndex:list.length,joined:now,online:false,counted:true,lastSeen:now,offlineAt:now,lastMove:now,seq:0};}
 p.counted=true;barrier(s);s.revision++;return p;
}
export function barrier(s){
 const arena=expeditionWorld(s,6);for(const p of Object.values(s.players))if(p.level===6&&!free(arena,p.player.x,p.player.z))relocate(p,arena.spawn,p.lastMove);
 if(s.showcaseOpen||s.archived)return;const members=participants(s),arrived=members.filter(p=>p.level===6);
 if(arrived.length&&members.length>1){s.entryLocked=true;if(arrived.length===members.length&&members.every(p=>p.online)){s.showcaseOpen=true;s.entryLocked=true}}
 else if(members.length<=1)s.entryLocked=false;
}
export function connectPlayer(s,id,connection,now){const p=s.players[id];if(!p)return;p.online=true;p.guard=false;p.counted=true;p.offlineAt=null;p.lastSeen=now;p.lastMove=now;p.connection=connection;barrier(s);s.revision++}
export function disconnectPlayer(s,id,connection,now){const p=s.players[id];if(!p||p.connection!==connection)return;p.online=false;p.guard=false;p.offlineAt=now;s.revision++;barrier(s)}
export function sweep(s,now){if(s.archived||s.deleted)return false;let changed=false;for(const p of Object.values(s.players)){
 if(p.online&&now-p.lastSeen>=STALE){p.online=false;p.guard=false;p.offlineAt=p.lastSeen+STALE;changed=true}
 if(!p.online&&p.counted&&now-(p.offlineAt??now)>=GRACE){const w=expeditionWorld(s,p.level),r=runFor(s,p);for(let i=p.inventory.length-1;i>=0;i--)if(p.inventory[i]!=='sword')drop(r,w,i,free(w,p.player.x,p.player.z)?p.player:w.spawn);p.counted=false;changed=true}
 }if(changed){barrier(s);s.revision++}return changed}
function relocate(p,position,now){
 p.player={...position,pitch:0,height:0};
 p.guard=false;
 p.lastMove=now;
 p.warp=(p.warp||0)+1;
}
export function pose(s,p,b,now){
 if(s.archived||!p.online||!Number.isInteger(b.seq)||b.seq<=p.seq)return false;
 if((b.level!==undefined&&b.level!==p.level)||(b.warp!==undefined&&b.warp!==(p.warp||0)))return false;
 if(![b.x,b.z,b.yaw,b.pitch].every(Number.isFinite))return false;
 const previous=p.player,dx=b.x-previous.x,dz=b.z-previous.z,distance=Math.hypot(dx,dz);
 const elapsed=Math.max(.025,Math.min(.7,(now-p.lastMove)/1000));
 p.lastSeen=now;
 if(distance>4.1*elapsed+.16)return false;

 const w=expeditionWorld(s,p.level),floor=floorState(runFor(s,p),w);
 const height=Number.isFinite(b.height)?Math.max(0,Math.min(w.arena?7.2:.92,b.height)):0;
 const people=Object.values(s.players).filter(other=>other!==p&&other.online&&other.level===p.level).map(other=>other.player);
 const candidate={...previous,height};
 move(w,candidate,dx,dz,{doorOpen:floor.open,people,frames:settledFrames(w,floor,now),height,fromHeight:previous.height||0});
 p.seq=b.seq;
 const triggered=triggerFrames(w,floor,candidate,now);
 const frame=struckFrame(w,floor,previous,candidate,p.lastMove,now,RADIUS,p.frameHits);
 let impact;
 if(frame){
  (p.frameHits??=[]).push(frame);
  impact=takeDamage(p,'frame',FRAME_DAMAGE,now);
  if(impact?.fatal){relocate(p,w.spawn,now);s.revision++;return 'warp'}
 }
 if(floor.open&&crossedDoor(w,previous,candidate)){
  p.level++;relocate(p,expeditionWorld(s,p.level).spawn,now);barrier(s);s.revision++;
  return 'level';
 }
 p.player={...candidate,yaw:Math.atan2(Math.sin(b.yaw),Math.cos(b.yaw)),pitch:Math.max(-1.15,Math.min(1.15,b.pitch))};
 p.guard=b.guard===true;
 p.lastMove=now;
 if(triggered||frame){s.revision++;return 'trap'}
 return Math.hypot(candidate.x-b.x,candidate.z-b.z)>.025?'clipped':true;
}
const near=(p,t,d)=>Math.hypot(p.player.x-t.x,p.player.z-t.z)<d;
const facing=(p,t)=>{const dx=t.x-p.player.x,dz=t.z-p.player.z;return (dx*Math.sin(p.player.yaw)-dz*Math.cos(p.player.yaw))/Math.max(.001,Math.hypot(dx,dz))>.65};
function strike(s,p,w,floor,now){
 if(p.guard||now-(p.actionAt??-Infinity)<550)return false;
 const kind=equipment(p).weapon||'fist',reach=kind==='sword'?1.8:1.25;
 const from=p.player;
 const candidates=Object.values(s.players).filter(other=>other!==p&&other.online&&other.level===p.level)
  .map(other=>({other,distance:Math.hypot(other.player.x-from.x,other.player.z-from.z)}))
  .sort((a,b)=>a.distance-b.distance);
 p.actionAt=now;
 for(const {other,distance} of candidates){
  if(distance>reach)break;
  const to=other.player;
  if(Math.abs((from.height||0)-(to.height||0))>.85||!facing(p,to))continue;
  let clear=true;
  for(let t=.05;t<1;t+=.05){
   if(!free(w,from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t,.04,floor.open)){clear=false;break}
  }
  if(!clear)continue;
  const guarded=other.guard&&now-other.lastMove<750&&facing(other,from);
  const gear=equipment(other),damage=strikeDamage(kind,guarded,gear);
  const impact=takeDamage(other,kind,damage,now,p.id);
  if(impact){
   impact.guarded=!!guarded;impact.shielded=gear.shield&&(!!guarded||damage===2&&kind==='sword');
   if(impact.fatal)relocate(other,w.spawn,now);
  }
  break;
 }
 return true;
}
function aimCard(p,t){return near(p,t,.38)||(p.player.pitch<-.35&&facing(p,t))}
export function act(s,p,b,now){
 if(!p||!p.online||s.archived||s.deleted)fail('Non puoi agire in questa spedizione.');
 const w=expeditionWorld(s,p.level),r=runFor(s,p);floorState(r,w);
 if(b.kind==='pickup'){const item=itemsAt(r,w).find(i=>i.id===b.item);if(!item||!near(p,item,item.type==='pass'?.95:1.25)||!aimCard(p,item))fail('Avvicinati alla carta e guardala.');if(pickup(r,w,item.id)!=='ok')fail('Inventario pieno o carta già raccolta.');}
 else if(b.kind==='drop'){if(!Number.isInteger(b.slot)||!drop(r,w,b.slot,p.player))fail('Oggetto non lasciabile.');}
 else if(b.kind==='equip'){if((b.item!==undefined&&r.inventory[b.slot]!==b.item)||!putInHand(r,b.slot))fail('Questo posto è vuoto.');}
 else if(b.kind==='open'){
  if(w.arena||!near(p,w.door,1.9)||!openDoor(r,w))fail('Avvicinati alla porta con la keycard del piano o il passe-partout.');
  for(const other of Object.values(s.players)){
   const slot=other.inventory.indexOf('key:'+p.level);
   if(slot>=0)clearSlot(other.inventory,slot);
  }
 }
 else if(b.kind==='back'){const entrance=w.arena?w.door:w.spawn;if(p.level<=1||!hasPass(r)||!near(p,entrance,w.arena?1.9:1.1))fail('Per tornare serve il passe-partout.');const slot=p.inventory.indexOf('key:'+p.level);if(slot>=0)drop(r,w,slot,p.player);p.level--;const previous=expeditionWorld(s,p.level);relocate(p,{x:previous.door.x-previous.door.dx*1.25,z:previous.door.z-previous.door.dz*1.25,yaw:Math.atan2(-previous.door.dx,previous.door.dz)},now);}
 else if(b.kind==='showcase'||SHOWCASE_GEAR.some(([id])=>id===b.kind)){
 const box=casePosition(s,p);if(p.level!==6||!near(p,box,2.5)||!facing(p,box))fail('Avvicinati alla tua vetrina.');
 if(b.kind==='showcase'){if(s.showcaseOpen)fail('Vetrina già aperta.');if(participants(s).length!==1)fail('Attendi gli altri partecipanti.');s.showcaseOpen=true;s.entryLocked=true;}
 else{
  if(!takeGear(r,b.kind))fail('Oggetto già raccolto o inventario pieno.');
  Object.assign(p,{backpack:r.backpack,swordTaken:r.swordTaken,shieldTaken:r.shieldTaken,helmet:r.helmet,armor:r.armor});
 }
 }
 else if(b.kind==='appearance')p.appearance=clothes(b.appearance);
 else if(b.kind==='strike'){if(!strike(s,p,w,floorState(r,w),now))return false;}
 else fail('Azione non valida.');p.weapon=equipment(p).weapon;s.revision++;return true;
}
export function snapshot(s){return {room:s.room,number:s.number,seed:s.seed,revision:s.revision,created:s.created,archived:s.archived,deleted:s.deleted,entryLocked:s.entryLocked,showcaseOpen:s.showcaseOpen,floors:s.floors,cases:cases(s),players:Object.values(s.players).map(({connection,lastMove,...p})=>({...p,...equipment(p)})),grace:GRACE}}
export function expeditionSummary(s){return {room:s.room,number:s.number,game:'labyrinth',archived:s.archived,phase:s.archived?'finished':s.entryLocked?'playing':'waiting',players:Object.values(s.players).map(p=>({id:'tg:'+p.id,name:p.name})),turn:0,revision:s.revision,created:s.created,expires:null,online:participants(s).filter(p=>p.online).length,arrived:participants(s).filter(p=>p.level===6).length,entryLocked:s.entryLocked}}
