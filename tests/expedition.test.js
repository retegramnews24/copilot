import assert from 'node:assert/strict';
import {createExpedition,joinExpedition,connectPlayer,disconnectPlayer,sweep,act,pose,snapshot,participants,expeditionWorld,runFor,casePosition,cases,ensureKeycards,barrier,expeditionSummary,GRACE,STALE} from '../expedition-model.js';
import {itemsAt,floorState,STANDS_WAIT,standsView} from '../public/labyrinth/adventure.js';
import {free,distances,index,CELL,PLAYER_CLEARANCE} from '../public/labyrinth/core.js';
import {ExpeditionRoom} from '../labyrinth-server.js';
import {framePose} from '../public/labyrinth/traps.js';
const user=i=>({id:String(i),name:'Pilota '+i});let now=1000000;
const s=createExpedition('room',1,71,user(1),now);for(let i=2;i<=4;i++)joinExpedition(s,user(i),now);for(let i=1;i<=4;i++)connectPlayer(s,String(i),'conn'+i,now);
const [a,b,c,d]=Object.values(s.players),w=expeditionWorld(s,1),r=runFor(s,a);floorState(r,w);assert.equal(cases(s).length,4);assert.equal(new Set(cases(s).map(c=>c.x+','+c.z)).size,4);
function at(p,pos,pitch=0){p.player={x:pos.x,z:pos.z,yaw:0,pitch,height:0};p.lastMove=now}
function walkThrough(p,w,room=s){
 at(p,{x:w.door.x-w.door.dx*.7,z:w.door.z-w.door.dz*.7});
 const out=pose(room,p,{seq:p.seq+1,level:p.level,warp:p.warp||0,x:w.door.x+w.door.dx*.025,z:w.door.z+w.door.dz*.025,yaw:0,pitch:0},now+220);
 assert.equal(out,'level');
}
// Concurrent contenders are serialized: the second pickup cannot duplicate the card.
at(a,w.keyPosition,-1);at(b,w.keyPosition,-1);act(s,a,{kind:'pickup',item:'key:1'},now);assert.throws(()=>act(s,b,{kind:'pickup',item:'key:1'},now));assert.deepEqual(a.inventory,['key:1']);assert.equal(itemsAt(runFor(s,b),w).length,0);
at(a,{x:w.door.x-w.door.dx*.7,z:w.door.z-w.door.dz*.7});act(s,a,{kind:'open'},now);assert.equal(a.inventory.length,0);assert.ok(s.floors[1].open);
assert.throws(()=>act(s,b,{kind:'forward'},now));walkThrough(b,w);assert.equal(b.level,2);assert.equal(a.level,1);
assert.equal(pose(s,b,{seq:b.seq+1,level:1,warp:0,x:w.door.x,z:w.door.z,yaw:0,pitch:0},now+230),false,'Old poses cannot move the player on the next floor');
assert.throws(()=>act(s,a,{kind:'close'},now));assert.equal(itemsAt(runFor(s,a),w).filter(i=>i.type==='key').length,0);assert.equal(b.level,2);
// The creator can leave and rejoin without resetting the door or the other players.
disconnectPlayer(s,'1','conn1',now);for(const p of [b,c,d])p.lastSeen=now+GRACE;sweep(s,now+GRACE-1);assert.equal(a.counted,true);assert.equal(sweep(s,now+GRACE),true);assert.equal(a.counted,false);assert.equal(s.floors[1].open,true);assert.equal(s.players['2'].online,true);
connectPlayer(s,'1','new-conn',now+GRACE+1);assert.equal(a.counted,true);assert.equal(a.inventory.length,0);disconnectPlayer(s,'1','conn1',now+GRACE+2);assert.equal(a.online,true,'Old socket close cannot disconnect a newer session');
// Four-player barrier: first arrival closes entry, no premature opening, last opens all.
const group=structuredClone(s),groupMembers=participants(group);
for(const p of groupMembers){p.level=5;const ww=expeditionWorld(group,5);floorState(runFor(group,p),ww).open=true}
walkThrough(groupMembers[0],expeditionWorld(group,5),group);
assert.equal(group.entryLocked,true);assert.equal(group.showcaseOpen,false);assert.throws(()=>joinExpedition(group,user(5),now));
for(const p of groupMembers.slice(1))walkThrough(p,expeditionWorld(group,5),group);
assert.equal(group.showcaseOpen,true);
for(const p of groupMembers){const box=casePosition(group,p);at(p,{x:box.x,z:box.z+2});act(group,p,{kind:'backpack'},now);act(group,p,{kind:'sword'},now);assert.deepEqual(p.inventory,['sword']);assert.throws(()=>act(group,p,{kind:'sword'},now));}
assert.equal(cases(group).every(c=>c.backpack&&c.swordTaken&&c.open),true);assert.equal(snapshot(group).players.some(p=>'connection' in p),false);
const revived=JSON.parse(JSON.stringify(group));
joinExpedition(revived,user(2),now+1);
assert.equal(revived.players['2'].backpack,true);assert.deepEqual(revived.players['2'].inventory,['sword']);
for(const p of groupMembers){p.online=false;p.offlineAt=now}
sweep(group,now+GRACE);assert.equal(group.deleted,true);assert.equal(snapshot(group).arenaResult.winner,null);
// Solo arena waits explicitly; a late player creates another case and removes solo opening.
const solo=createExpedition('solo',2,44,user(8),now);connectPlayer(solo,'8','solo',now);const p=solo.players['8'];p.level=6;const box=casePosition(solo,p);at(p,{x:box.x,z:box.z+2});joinExpedition(solo,user(9),now);assert.equal(cases(solo).length,2);assert.throws(()=>act(solo,p,{kind:'showcase'},now));assert.equal(solo.showcaseOpen,false);
disconnectPlayer(solo,'9',undefined,now);solo.players['9'].offlineAt=now;solo.players['9'].online=false;p.lastSeen=now+GRACE;sweep(solo,now+GRACE);assert.equal(participants(solo).length,1);assert.equal(solo.entryLocked,false);act(solo,p,{kind:'showcase'},now+GRACE);assert.equal(solo.showcaseOpen,true);assert.equal(snapshot(solo).arenaResult,null);assert.throws(()=>joinExpedition(solo,user(10),now));
// A master card drops on its actual floor, no duplicates on reconnect.
const black=expeditionWorld(s,5);a.level=5;a.inventory=[];s.floors[5].pass={...black.spawn};at(a,black.spawn,-1);act(s,a,{kind:'pickup',item:'pass'},now);disconnectPlayer(s,'1','new-conn',now);for(const p of [b,c,d])p.lastSeen=now+GRACE;sweep(s,now+GRACE);assert.equal(a.inventory.length,0);assert.ok(s.floors[5].pass);connectPlayer(s,'1','again',now+GRACE+1);assert.equal(a.inventory.length,0);
// Movement and appearance are bounded by server rules.
a.level=1;at(a,w.spawn);a.seq=0;assert.equal(pose(s,a,{seq:1,x:999,z:999,yaw:0,pitch:0},now+200),false);assert.equal(pose(s,a,{seq:2,x:a.player.x,z:a.player.z,yaw:0,pitch:99},now+200),true);assert.equal(a.player.pitch,1.15);act(s,a,{kind:'appearance',appearance:{shirt:'javascript:evil',shorts:'#3c62a3'}},now);assert.match(a.appearance.shirt,/^#[0-9a-f]{6}$/);
// An unfinished exploration remains saved with nobody online.
for(const p of Object.values(s.players)){p.online=false;p.offlineAt=now;p.counted=true}sweep(s,now+GRACE);assert.equal(participants(s).length,0);assert.equal(s.deleted,false);assert.equal(s.floors[1].key,null);
// Head-on movement is clipped without penetration. Shared respawn positions can separate.
const openSpace=expeditionWorld(s,6),nx=openSpace.spawn.x,nz=openSpace.spawn.z-5;
for(const p of [a,b]){p.level=6;p.online=true;at(p,{x:nx+(p===b?.63:0),z:nz})}
assert.equal(pose(s,a,{seq:a.seq+1,x:nx+.4,z:nz,yaw:Math.PI/2,pitch:0},now+200),'clipped');
assert.ok(b.player.x-a.player.x>=PLAYER_CLEARANCE-1e-6);
at(b,a.player);assert.equal(pose(s,a,{seq:a.seq+1,x:a.player.x-.3,z:nz,yaw:Math.PI/2,pitch:0},now+400),true);
assert.equal(a.player.yaw,Math.PI/2);
const trapWorld=expeditionWorld(s,3),frame=trapWorld.frames[0];a.level=3;
at(a,{x:frame.x+frame.dx*.5,z:frame.z+frame.dz*.5});
const step=(time)=>pose(s,a,{seq:a.seq+1,level:a.level,warp:a.warp||0,x:a.player.x,z:a.player.z,yaw:0,pitch:0,height:0},time);
const warp=a.warp||0;assert.equal(step(now),'trap');
assert.equal(framePose(s.floors[3].traps[frame.id],now+400).phase,'warning');
assert.equal(step(now+1000),true);assert.equal(step(now+1500),'trap');
assert.equal(a.warp||0,warp);assert.equal(a.level,3);assert.equal(a.health,75);assert.equal(a.impact.kind,'frame');
step(now+1510);assert.equal(a.health,75,'A falling frame can only hit once per player');
console.log('PASS multiplayer: four players, atomic card/door actions, independent floors, creator disconnect, grace/drop/reconnect, solo and grouped arena barriers, personal cases/equipment, bounded poses and persistent empty expeditions.');

// Cards must be authoritative before any pickup, even with two clients and after restore.
for(let seed=1;seed<=100;seed++){
 const room=createExpedition('spawn-'+seed,seed,seed,user(1),now);joinExpedition(room,user(2),now);
 for(let level=1;level<=5;level++){const w=expeditionWorld(room,level);assert.ok(room.floors[level].key);const k=room.floors[level].key;assert.ok(free(w,k.x,k.z,.28));assert.ok(distances(w.grid,w.n,w.start)[index(Math.floor(k.x/CELL),Math.floor(k.z/CELL),w.n)]>=0);for(const p of Object.values(room.players))assert.equal(itemsAt(runFor(room,p),w).filter(i=>i.type==='key').length,1)}
 assert.equal(ensureKeycards(room),false);
 const restored=JSON.parse(JSON.stringify(room));restored.floors[1].key=null;restored.floors[2].key={x:-99,z:-99};assert.equal(ensureKeycards(restored),true);assert.ok(restored.floors[1].key);assert.ok(restored.floors[2].key);
 restored.players['2'].inventory=['key:1'];restored.floors[1].key=null;ensureKeycards(restored);assert.equal(restored.floors[1].key,null);
 restored.floors[3].open=true;ensureKeycards(restored);assert.equal(restored.floors[3].key,null);
}
console.log('PASS shared card spawning: 100 seeds × five floors × two clients, authoritative initial snapshots, missing/invalid spawn repair, no respawn while held or open.');

const masterRoom=createExpedition('master',1,415,user(1),now);
const holder=masterRoom.players['1'];joinExpedition(masterRoom,user(2),now);
const teammate=masterRoom.players['2'];
connectPlayer(masterRoom,holder.id,'master-1',now);connectPlayer(masterRoom,teammate.id,'master-2',now);
const blackFloor=expeditionWorld(masterRoom,5);
holder.level=teammate.level=5;
at(holder,masterRoom.floors[5].pass,-1);act(masterRoom,holder,{kind:'pickup',item:'pass'},now);
at(teammate,blackFloor.keyPosition,-1);act(masterRoom,teammate,{kind:'pickup',item:'key:5'},now);
at(holder,{x:blackFloor.door.x-blackFloor.door.dx*.8,z:blackFloor.door.z-blackFloor.door.dz*.8});
act(masterRoom,holder,{kind:'open'},now);
assert.ok(masterRoom.floors[5].open);assert.equal(masterRoom.floors[5].key,null);
assert.deepEqual(holder.inventory,['pass']);assert.deepEqual(teammate.inventory,[]);
const green=expeditionWorld(masterRoom,2);holder.level=2;
at(holder,green.keyPosition,-1);act(masterRoom,holder,{kind:'pickup',item:'key:2'},now);
assert.deepEqual(holder.inventory,['pass','key:2']);
act(masterRoom,holder,{kind:'equip',slot:1},now);
assert.deepEqual(holder.inventory,['key:2','pass']);assert.throws(()=>act(masterRoom,holder,{kind:'equip',slot:2},now));
at(holder,{x:green.door.x-green.door.dx*.8,z:green.door.z-green.door.dz*.8});
act(masterRoom,holder,{kind:'open'},now);assert.deepEqual(holder.inventory,[null,'pass']);assert.ok(masterRoom.floors[2].open);
console.log('PASS master key and hand slot: reusable black door access, obsolete shared key removal and authoritative equip.');

const duel=createExpedition('duel',1,172,user(1),now);
const attacker=duel.players['1'],defender=joinExpedition(duel,user(2),now);
for(const p of [attacker,defender]){connectPlayer(duel,p.id,'duel-'+p.id,now);p.level=6;}
const arena=expeditionWorld(duel,6),origin={x:arena.spawn.x,z:arena.spawn.z-3};
at(attacker,origin);at(defender,{x:origin.x,z:origin.z-1});
function guard(active,faces=true){
 const {x,z,height}=defender.player;
 return pose(duel,defender,{seq:defender.seq+1,x,z,yaw:faces?Math.PI:0,pitch:0,height,guard:active},now);
}
function hit(){
 now+=600;
 return act(duel,attacker,{kind:'strike',weapon:'forged-sword'},now);
}
hit();assert.equal(defender.health,98);assert.equal(defender.impact.kind,'fist');
guard(true);hit();assert.equal(defender.health,98);assert.equal(defender.impact.damage,0);
guard(true,false);hit();assert.equal(defender.health,96);
attacker.inventory=['sword'];guard(false);hit();assert.equal(defender.health,86);
guard(true);hit();assert.equal(defender.health,79);
Object.assign(defender,{inventory:[null,'shield'],helmet:true,armor:true});
guard(true);hit();assert.equal(defender.health,77);
guard(false);hit();assert.equal(defender.health,75);
attacker.guard=true;hit();assert.equal(defender.health,73,'The right hand attacks while the left stays on guard');
assert.equal(attacker.guard,true);
defender.health=2;const beforeWarp=defender.warp||0;
hit();assert.equal(defender.health,0);assert.equal(defender.impact.fatal,true);
assert.equal(defender.warp,beforeWarp+1);assert.equal(defender.level,6);
assert.deepEqual(defender.player,standsView(arena,defender.caseIndex));
assert.equal(defender.standsUntil,now+STANDS_WAIT);
assert.throws(()=>act(duel,defender,{kind:'strike'},now+100),/spalti/);
const seat={...defender.player};
assert.equal(pose(duel,defender,{seq:defender.seq+1,x:10,z:10,yaw:1,pitch:.3,height:5,crouch:true,guard:true},now+200),true);
assert.deepEqual(defender.player,{...seat,yaw:1,pitch:.3});
assert.equal(defender.guard,false);
const end=defender.standsUntil;sweep(duel,end-1);assert.equal(defender.standsUntil,end);
const saved=JSON.parse(JSON.stringify(duel));sweep(saved,end);assert.equal(saved.players['2'].health,100);
assert.equal(sweep(duel,end),true);now=end;
assert.equal(defender.standsUntil,undefined);assert.equal(defender.health,100);assert.equal(defender.warp,beforeWarp+2);
assert.equal(defender.player.x,arena.spawn.x);assert.equal(defender.player.z,arena.spawn.z);
assert.deepEqual(defender.inventory,[null,'shield']);assert.equal(defender.helmet,true);assert.equal(defender.armor,true);
at(defender,{x:origin.x,z:origin.z-1});hit();assert.equal(defender.health,100,'Brief spawn protection applies');
at(defender,{x:origin.x,z:origin.z-1});defender.player.height=2;hit();hit();assert.equal(defender.health,100,'A jumping player beyond the reach is missed');
assert.equal(act(duel,attacker,{kind:'strike'},now+5),false);
assert.equal(pose(duel,defender,{seq:defender.seq+1,x:defender.player.x,z:defender.player.z,yaw:0,pitch:0,height:0,crouch:true},now+10),true);
assert.equal(defender.player.crouch,true);
assert.equal(pose(duel,defender,{seq:defender.seq+1,x:defender.player.x+.65,z:defender.player.z,yaw:0,pitch:0,height:0,crouch:true},now+140),false);
console.log('PASS Labyrinth combat: guarded attacks, five seconds in the stands with head-only movement, persistent respawn, crouch speed and intact gear.');

let scheduled,stored,broadcast;
const ctx={storage:{
 getAlarm:async()=>scheduled,setAlarm:async value=>{scheduled=value},
 put:async(_key,value)=>{stored=structuredClone(value)}
},blockConcurrencyWhile:task=>task(),getWebSockets:()=>[{deserializeAttachment:()=>({accessTag:'test'}),send:payload=>{broadcast=JSON.parse(payload)}}]};
const env={ROOMS:{idFromName:()=>'',get:()=>({fetch:async()=>({ok:true})})}};
const expedition=new ExpeditionRoom(ctx,env,async()=>'test');
expedition.state=duel;
const wallClock=Date.now();
for(const p of Object.values(duel.players))p.lastSeen=wallClock;
defender.standsUntil=wallClock+STANDS_WAIT;defender.health=0;
await expedition.schedule();assert.equal(scheduled,defender.standsUntil);
defender.standsUntil=wallClock-1;
await expedition.alarm();
assert.equal(stored.players['2'].health,100);assert.equal(stored.players['2'].standsUntil,undefined);
assert.equal(broadcast.state.players.find(p=>p.id==='2').health,100);


const match=createExpedition('last-standing',7,172,user(1),now);
for(const i of [2,3])joinExpedition(match,user(i),now);
for(const p of Object.values(match.players)){connectPlayer(match,p.id,'match-'+p.id,now);p.level=6;}
barrier(match);
assert.equal(snapshot(match).arenaLive,true);
const [winner,first,last]=Object.values(match.players);
const matchWorld=expeditionWorld(match,6),point={x:matchWorld.spawn.x,z:matchWorld.spawn.z-3};
at(winner,point);
at(first,{x:point.x,z:point.z-1});
at(last,{x:point.x+2,z:point.z-1});
winner.inventory=['sword'];first.health=last.health=10;
act(match,winner,{kind:'strike'},now);
assert.equal(first.eliminated,true);
assert.equal(snapshot(match).arenaResult,null);
now+=STANDS_WAIT+100;
sweep(match,now);
assert.equal(first.health,0);
assert.deepEqual(first.player,standsView(matchWorld,first.caseIndex));
at(last,{x:point.x,z:point.z-1});
act(match,winner,{kind:'strike'},now);
assert.deepEqual(snapshot(match).arenaResult,{winner:user(1)});
assert.equal(expeditionSummary(match).phase,'finished');
assert.throws(()=>act(match,winner,{kind:'strike'},now+600),/concluso/);
disconnectPlayer(match,first.id,'match-'+first.id,now);
connectPlayer(match,first.id,'match-reconnect',now+1);
assert.equal(first.eliminated,true);
assert.deepEqual(snapshot(JSON.parse(JSON.stringify(match))).arenaResult,{winner:user(1)});
const indexed=[];
expedition.env={ROOMS:{idFromName:()=>'',get:()=>({fetch:async req=>{indexed.push({path:new URL(req.url).pathname,body:await req.json()});return {ok:true}}})}};
expedition.state=match;
await expedition.index();await expedition.index();
assert.deepEqual(indexed.filter(e=>e.path==='/lobby/result').map(e=>e.body),[
 {key:'last-standing:arena',game:'labyrinth',mode:'people',winners:[{id:'tg:1',name:'Pilota 1'}]}
]);
console.log('PASS Arena: persistent eliminations, only the last survivor wins, reconnect preserves result, one ranking record and no solo award.');
