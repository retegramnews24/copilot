import {worldFor,floorState,itemsAt,pickup,drop,openDoor,closeDoor,capacity,hasPass,CLOTHES} from './public/labyrinth/adventure.js';
import {free,move} from './public/labyrinth/core.js';
export const GRACE=60000,STALE=45000,MAX_PLAYERS=16;
const fail=m=>{throw Error(m)},palette=new Set(CLOTHES.map(c=>c[1]));
export const clothes=a=>({shirt:palette.has(a?.shirt)?a.shirt:CLOTHES[6][1],shorts:palette.has(a?.shorts)?a.shorts:CLOTHES[7][1]});
export function createExpedition(room,number,seed,user,now){const s={room,number,seed,version:1,game:'labyrinth',created:now,revision:0,players:{},floors:{},entryLocked:false,showcaseOpen:false,archived:false,deleted:false};joinExpedition(s,user,now);return s}
export function participants(s){return Object.values(s.players).filter(p=>p.counted)}
export function casePosition(s,p){const w=worldFor(s.seed,6),i=p.caseIndex;return {x:w.showcase.x+[0,3,-3,6][i%4],z:w.showcase.z+Math.floor(i/4)*3.2}}
export function cases(s){return participants(s).map(p=>({id:p.id,name:p.name,...casePosition(s,p),backpack:p.backpack,swordTaken:p.swordTaken,open:s.showcaseOpen}))}
export function expeditionWorld(s,level){const w=worldFor(s.seed,level);if(level===6){w.obstacles=w.obstacles.filter(b=>b.type);w.obstacles.push(...cases(s).map(c=>({...c,halfWidth:1.08,halfDepth:.5})))}return w}
export function runFor(s,p){return {seed:s.seed,level:p.level,inventory:p.inventory,backpack:p.backpack,floors:s.floors,showcaseOpen:s.showcaseOpen,swordTaken:p.swordTaken,test:false}}
export function joinExpedition(s,user,now){
 if(s.archived||s.deleted)fail('Spedizione non attiva.');let p=s.players[user.id];
 if(!p){if(s.entryLocked||s.showcaseOpen)fail('Ingressi chiusi: puoi assistere.');const list=Object.values(s.players);if(list.length>=MAX_PLAYERS)fail('Spedizione piena: puoi assistere.');const w=worldFor(s.seed,1);p=s.players[user.id]={id:user.id,name:user.name.slice(0,60),level:1,player:{...w.spawn,pitch:0,height:0},inventory:[],backpack:false,swordTaken:false,appearance:clothes(),caseIndex:list.length,joined:now,online:false,counted:true,lastSeen:now,offlineAt:now,lastMove:now,seq:0};}
 p.counted=true;barrier(s);s.revision++;return p;
}
export function barrier(s){
 const arena=expeditionWorld(s,6);for(const p of Object.values(s.players))if(p.level===6&&!free(arena,p.player.x,p.player.z))p.player={...arena.spawn,pitch:0,height:0};
 if(s.showcaseOpen||s.archived)return;const members=participants(s),arrived=members.filter(p=>p.level===6);
 if(arrived.length&&members.length>1){s.entryLocked=true;if(arrived.length===members.length&&members.every(p=>p.online)){s.showcaseOpen=true;s.entryLocked=true}}
 else if(members.length<=1)s.entryLocked=false;
}
export function connectPlayer(s,id,connection,now){const p=s.players[id];if(!p)return;p.online=true;p.counted=true;p.offlineAt=null;p.lastSeen=now;p.lastMove=now;p.connection=connection;barrier(s);s.revision++}
export function disconnectPlayer(s,id,connection,now){const p=s.players[id];if(!p||p.connection!==connection)return;p.online=false;p.offlineAt=now;s.revision++;barrier(s)}
export function sweep(s,now){if(s.archived||s.deleted)return false;let changed=false;for(const p of Object.values(s.players)){
 if(p.online&&now-p.lastSeen>=STALE){p.online=false;p.offlineAt=p.lastSeen+STALE;changed=true}
 if(!p.online&&p.counted&&now-(p.offlineAt??now)>=GRACE){const w=expeditionWorld(s,p.level),r=runFor(s,p);for(let i=p.inventory.length-1;i>=0;i--)if(p.inventory[i]!=='sword')drop(r,w,i,free(w,p.player.x,p.player.z)?p.player:w.spawn);p.counted=false;changed=true}
 }if(changed){barrier(s);s.revision++}return changed}
export function pose(s,p,b,now){
 if(s.archived||!p.online||!Number.isInteger(b.seq)||b.seq<=p.seq)return false;
 if(![b.x,b.z,b.yaw,b.pitch].every(Number.isFinite))return false;
 const elapsed=Math.max(.025,Math.min(.7,(now-p.lastMove)/1000)),distance=Math.hypot(b.x-p.player.x,b.z-p.player.z),w=expeditionWorld(s,p.level);
 p.lastSeen=now;
 if(distance>4.1*elapsed+.16)return false;
 const candidate={...p.player};move(w,candidate,b.x-candidate.x,b.z-candidate.z);if(Math.hypot(candidate.x-b.x,candidate.z-b.z)>.02)return false;
 p.player={x:b.x,z:b.z,yaw:((b.yaw%(2*Math.PI))+2*Math.PI)%(2*Math.PI),pitch:Math.max(-1.15,Math.min(1.15,b.pitch)),height:Number.isFinite(b.height)?Math.max(0,Math.min(p.level===6?3.5:.92,b.height)):0};p.weapon=p.inventory.includes('sword')&&b.weapon==='sword'?'sword':null;p.seq=b.seq;p.lastMove=now;return true;
}
const near=(p,t,d)=>Math.hypot(p.player.x-t.x,p.player.z-t.z)<d;
const facing=(p,t)=>{const dx=t.x-p.player.x,dz=t.z-p.player.z;return (dx*Math.sin(p.player.yaw)-dz*Math.cos(p.player.yaw))/Math.max(.001,Math.hypot(dx,dz))>.65};
function aimCard(p,t){return near(p,t,.38)||(p.player.pitch<-.35&&facing(p,t))}
export function act(s,p,b,now){
 if(!p||!p.online||s.archived||s.deleted)fail('Non puoi agire in questa spedizione.');
 const w=expeditionWorld(s,p.level),r=runFor(s,p);floorState(r,w);
 if(b.kind==='pickup'){const item=itemsAt(r,w).find(i=>i.id===b.item);if(!item||!near(p,item,item.type==='pass'?.95:1.25)||!aimCard(p,item))fail('Avvicinati alla carta e guardala.');if(pickup(r,w,item.id)!=='ok')fail('Tasca piena o carta già raccolta.');}
 else if(b.kind==='drop'){if(!Number.isInteger(b.slot)||!drop(r,w,b.slot,p.player))fail('Oggetto non lasciabile.');}
 else if(b.kind==='open'){if(w.arena||!near(p,w.door,1.9)||!openDoor(r,w))fail('Serve la keycard vicino alla porta.');}
 else if(b.kind==='close'){if(w.arena||!near(p,w.door,2.2)||!closeDoor(r,w))fail('Porta non richiudibile.');}
 else if(b.kind==='forward'){if(w.arena||!near(p,w.door,1.9)||!floorState(r,w).open)fail('La porta non è aperta.');p.level++;p.player={...expeditionWorld(s,p.level).spawn,pitch:0,height:0};p.lastMove=now;barrier(s);}
 else if(b.kind==='back'){const entrance=w.arena?w.door:w.spawn;if(p.level<=1||!hasPass(r)||!near(p,entrance,w.arena?1.9:1.1))fail('Per tornare serve il passe-partout.');const slot=p.inventory.indexOf('key:'+p.level);if(slot>=0)drop(r,w,slot,p.player);p.level--;const previous=expeditionWorld(s,p.level);p.player={x:previous.door.x-previous.door.dx*1.25,z:previous.door.z-previous.door.dz*1.25,yaw:Math.atan2(-previous.door.dx,previous.door.dz),pitch:0,height:0};p.lastMove=now;}
 else if(['showcase','backpack','sword'].includes(b.kind)){
 const box=casePosition(s,p);if(p.level!==6||!near(p,box,2.5)||!facing(p,box))fail('Avvicinati alla tua vetrina.');
 if(b.kind==='showcase'){if(s.showcaseOpen)fail('Vetrina già aperta.');if(participants(s).length!==1)fail('Attendi gli altri partecipanti.');s.showcaseOpen=true;s.entryLocked=true;}
 if(b.kind==='backpack'){if(!s.showcaseOpen||p.backpack)fail('Zaino non disponibile.');p.backpack=true;}
 if(b.kind==='sword'){if(!s.showcaseOpen||p.swordTaken||p.inventory.length>=capacity(r))fail('Spada non disponibile o inventario pieno.');p.swordTaken=true;p.inventory.push('sword');p.weapon='sword';}
 }
 else if(b.kind==='appearance')p.appearance=clothes(b.appearance);
 else if(b.kind==='strike'){if(now-(p.actionAt||0)<550)return false;p.actionAt=now;p.weapon=p.inventory.includes('sword')&&b.weapon==='sword'?'sword':null;}
 else fail('Azione non valida.');s.revision++;return true;
}
export function snapshot(s){return {room:s.room,number:s.number,seed:s.seed,revision:s.revision,created:s.created,archived:s.archived,deleted:s.deleted,entryLocked:s.entryLocked,showcaseOpen:s.showcaseOpen,floors:s.floors,cases:cases(s),players:Object.values(s.players).map(({connection,lastMove,...p})=>p),grace:GRACE}}
export function expeditionSummary(s){return {room:s.room,number:s.number,game:'labyrinth',archived:s.archived,phase:s.archived?'finished':s.entryLocked?'playing':'waiting',players:Object.values(s.players).map(p=>({id:'tg:'+p.id,name:p.name})),turn:0,revision:s.revision,created:s.created,expires:null,online:participants(s).filter(p=>p.online).length,arrived:participants(s).filter(p=>p.level===6).length,entryLocked:s.entryLocked}}
