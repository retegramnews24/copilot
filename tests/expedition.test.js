import assert from 'node:assert/strict';
import {createExpedition,joinExpedition,connectPlayer,disconnectPlayer,sweep,act,pose,snapshot,participants,expeditionWorld,runFor,casePosition,cases,GRACE,STALE} from '../expedition-model.js';
import {itemsAt,floorState} from '../public/labyrinth/adventure.js';
const user=i=>({id:String(i),name:'Pilota '+i});let now=1000000;
const s=createExpedition('room',1,71,user(1),now);for(let i=2;i<=4;i++)joinExpedition(s,user(i),now);for(let i=1;i<=4;i++)connectPlayer(s,String(i),'conn'+i,now);
const [a,b,c,d]=Object.values(s.players),w=expeditionWorld(s,1),r=runFor(s,a);floorState(r,w);assert.equal(cases(s).length,4);assert.equal(new Set(cases(s).map(c=>c.x+','+c.z)).size,4);
function at(p,pos,pitch=0){p.player={x:pos.x,z:pos.z,yaw:0,pitch,height:0};p.lastMove=now}
// Concurrent contenders are serialized: the second pickup cannot duplicate the card.
at(a,w.keyPosition,-1);at(b,w.keyPosition,-1);act(s,a,{kind:'pickup',item:'key:1'},now);assert.throws(()=>act(s,b,{kind:'pickup',item:'key:1'},now));assert.deepEqual(a.inventory,['key:1']);assert.equal(itemsAt(runFor(s,b),w).length,0);
at(a,{x:w.door.x-w.door.dx*.7,z:w.door.z-w.door.dz*.7});act(s,a,{kind:'open'},now);assert.equal(a.inventory.length,0);assert.ok(s.floors[1].open);at(b,a.player);act(s,b,{kind:'forward'},now);assert.equal(b.level,2);assert.equal(a.level,1);act(s,a,{kind:'close'},now);assert.equal(itemsAt(runFor(s,a),w).filter(i=>i.type==='key').length,1);assert.equal(b.level,2);
// Creator leaves with the respawned card: room and other players continue, item drops after grace.
at(a,s.floors[1].key,-1);act(s,a,{kind:'pickup',item:'key:1'},now);disconnectPlayer(s,'1','conn1',now);for(const p of [b,c,d])p.lastSeen=now+GRACE;sweep(s,now+GRACE-1);assert.equal(a.inventory.length,1);for(const p of [b,c,d])p.lastSeen=now+GRACE;assert.equal(sweep(s,now+GRACE),true);assert.equal(a.inventory.length,0);assert.equal(a.counted,false);assert.equal(itemsAt(runFor(s,b),w).filter(i=>i.type==='key').length,1);assert.equal(s.players['2'].online,true);
connectPlayer(s,'1','new-conn',now+GRACE+1);assert.equal(a.counted,true);assert.equal(a.inventory.length,0);disconnectPlayer(s,'1','conn1',now+GRACE+2);assert.equal(a.online,true,'Old socket close cannot disconnect a newer session');
// Four-player barrier: first arrival closes entry, no premature opening, last opens all.
for(const p of [a,b,c,d]){p.level=5;const ww=expeditionWorld(s,5);at(p,{x:ww.door.x-ww.door.dx*.7,z:ww.door.z-ww.door.dz*.7});floorState(runFor(s,p),ww).open=true}
act(s,a,{kind:'forward'},now);assert.equal(s.entryLocked,true);assert.equal(s.showcaseOpen,false);assert.throws(()=>joinExpedition(s,user(5),now));for(const p of [b,c,d])act(s,p,{kind:'forward'},now);assert.equal(s.showcaseOpen,true);
for(const p of [a,b,c,d]){const box=casePosition(s,p);at(p,{x:box.x,z:box.z+2});act(s,p,{kind:'backpack'},now);act(s,p,{kind:'sword'},now);assert.deepEqual(p.inventory,['sword']);assert.throws(()=>act(s,p,{kind:'sword'},now));}
assert.equal(cases(s).every(c=>c.backpack&&c.swordTaken&&c.open),true);assert.equal(snapshot(s).players.some(p=>'connection' in p),false);
// Solo arena waits explicitly; a late player creates another case and removes solo opening.
const solo=createExpedition('solo',2,44,user(8),now);connectPlayer(solo,'8','solo',now);const p=solo.players['8'];p.level=6;const box=casePosition(solo,p);at(p,{x:box.x,z:box.z+2});joinExpedition(solo,user(9),now);assert.equal(cases(solo).length,2);assert.throws(()=>act(solo,p,{kind:'showcase'},now));assert.equal(solo.showcaseOpen,false);
disconnectPlayer(solo,'9',undefined,now);solo.players['9'].offlineAt=now;solo.players['9'].online=false;p.lastSeen=now+GRACE;sweep(solo,now+GRACE);assert.equal(participants(solo).length,1);assert.equal(solo.entryLocked,false);act(solo,p,{kind:'showcase'},now+GRACE);assert.equal(solo.showcaseOpen,true);assert.throws(()=>joinExpedition(solo,user(10),now));
// A master card drops on its actual floor, no duplicates on reconnect.
const black=expeditionWorld(s,5);a.level=5;a.inventory=[];s.floors[5].pass={...black.spawn};at(a,black.spawn,-1);act(s,a,{kind:'pickup',item:'pass'},now);disconnectPlayer(s,'1','new-conn',now);for(const p of [b,c,d])p.lastSeen=now+GRACE;sweep(s,now+GRACE);assert.equal(a.inventory.length,0);assert.ok(s.floors[5].pass);connectPlayer(s,'1','again',now+GRACE+1);assert.equal(a.inventory.length,0);
// Movement and appearance are bounded by server rules.
a.level=1;at(a,w.spawn);a.seq=0;assert.equal(pose(s,a,{seq:1,x:999,z:999,yaw:0,pitch:0},now+200),false);assert.equal(pose(s,a,{seq:2,x:a.player.x,z:a.player.z,yaw:0,pitch:99},now+200),true);assert.equal(a.player.pitch,1.15);act(s,a,{kind:'appearance',appearance:{shirt:'javascript:evil',shorts:'#3c62a3'}},now);assert.match(a.appearance.shirt,/^#[0-9a-f]{6}$/);
// Nobody online does not delete the expedition or its shared state.
for(const p of Object.values(s.players)){p.online=false;p.offlineAt=now;p.counted=true}sweep(s,now+GRACE);assert.equal(participants(s).length,0);assert.equal(s.deleted,false);assert.ok(s.floors[1].key);const revived=JSON.parse(JSON.stringify(s));joinExpedition(revived,user(2),now+GRACE+1);assert.equal(revived.players['2'].backpack,true);assert.deepEqual(revived.players['2'].inventory,['sword']);
console.log('PASS multiplayer: four players, atomic card/door actions, independent floors, creator disconnect, grace/drop/reconnect, solo and grouped arena barriers, personal cases/equipment, bounded poses and persistent empty expeditions.');
