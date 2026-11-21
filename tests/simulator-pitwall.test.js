import assert from 'node:assert/strict';
import {initial,act,advance,view,calendar,strategy} from '../simulator/engine.js';
const now=Date.parse('2026-11-12T12:00Z'),u={id:'pitwall',name:'Principal'};
function setup(){const s=initial(now);act(s,u,{action:'create'},now);const t=s.teams[u.id];t.drivers=[0,1].map(i=>({id:'driver'+i,name:'Driver '+i,skill:75,consistency:100,tyres:75}));t.crew={motor:{skill:75},aero:{skill:75},mechanic:{skill:75}};t.engine={skill:75};t.enrolled=true;t.strategies=[strategy({fuel:70}),strategy({fuel:70})];s.schedule={dates:[now+2*86400000],participants:[u.id]};return s;}
let s=setup(),t=s.teams[u.id];const config={wing:63,brake:56,fuel:65,stintLaps:4,compound:'soft',pace:'normal'};
const send=(body,at=now)=>{advance(s,at);act(s,u,body,at)};
send({action:'session-setup',mode:'practice',slot:0,event:'1:0',setup:config});assert.equal(t.strategies[0].wing,50,'session setup cannot overwrite race plan');
s=JSON.parse(JSON.stringify(s));t=s.teams[u.id];assert.equal(view(s,u,now).sessions.setups.practice[0].wing,63);assert.notEqual(view(s,u,now).sessions.setups.qualifying[0].fuel,65,'qualifying independent');
assert.throws(()=>send({action:'session-setup',mode:'practice',slot:0,event:'0:0',setup:config}),/sessione è cambiata/);
send({action:'session-start',mode:'practice',slot:0});const c=s.sessions.practice[u.id].cars[0];assert.equal(c.fuel,65);assert.equal(c.strategy.wing,63);
send({action:'session-setup',mode:'practice',slot:0,event:'1:0',setup:{...config,wing:70}});assert.equal(c.strategy.wing,63);assert.equal(c.pendingSetup.wing,70);
send({action:'session-setup',mode:'practice',slot:0,event:'1:0',setup:{...config,pace:'push',brake:58}});assert.equal(c.strategy.pace,'push');assert.equal(c.strategy.brake,58);assert.equal(c.pendingSetup,null,'reverting the plan cancels queued changes');
send({action:'strategy',slot:0,strategy:strategy({wing:80})});assert.equal(c.strategy.wing,63,'race plan edits do not change running practice car');
send({action:'session-setup',mode:'practice',slot:0,event:'1:0',setup:{...config,wing:76,fuel:45,compound:'hard'}});assert.equal(c.strategy.wing,63);assert.equal(c.compound,'soft');assert.equal(c.fuel,65);const persisted=JSON.parse(JSON.stringify(s));assert.equal(persisted.sessions.practice[u.id].cars[0].pendingSetup.wing,76);
c.outLap=false;c.progress=.80;c.lapElapsed=90;c.consumption=3;c.lastLap=120;
send({action:'session-pit',mode:'practice',slot:0});assert(c.onTrack&&c.pitRequested,'pit call is not teleportation');
send({action:'session-extend',mode:'practice',slot:0});assert.equal(c.targetLaps,5);assert.equal(c.pitRequested,false);
send({action:'session-pit',mode:'practice',slot:0});for(let sec=1;sec<=90&&c.onTrack;sec++)send({action:'presence',visible:true},now+sec*1000);assert(!c.onTrack);assert.equal(c.strategy.wing,76);assert.equal(c.fuel,45);assert.equal(c.compound,'hard');assert.equal(c.pendingSetup,null);assert.match(c.reason,/fine giro/);assert.equal(c.laps,1,'timed lap recorded before return');assert(c.history[0].consumption>0);
send({action:'session-start',mode:'practice',slot:0},now+100000);const c2=s.sessions.practice[u.id].cars[0];c2.fuel=2;c2.consumption=3;assert.throws(()=>send({action:'session-extend',mode:'practice',slot:0},now+100000),/Riserva/);
// Distinct times on each selected day, default one race, explicit second race.
const p=calendar({slots:[{day:4,times:['21:00']},{day:6,times:['18:00']}],start:'2026-11-13'},now);assert.equal(p.daily,1);assert.equal(p.dates[0],Date.parse('2026-11-13T20:00Z'));assert.equal(p.dates[1],Date.parse('2026-11-15T17:00Z'));assert.equal(p.dates.length,13);
const two=calendar({slots:[{day:4,times:['21:00','22:30']}],start:'2026-11-13'},now);assert.equal(two.daily,2);assert.equal(two.dates[1]-two.dates[0],5400000);
for(const slots of [[{day:4,times:['21:00','21:40']}],[{day:4,times:['21:00']},{day:4,times:['22:00']}],[{day:4,times:['25:00']}],[{day:4,times:['21:00','22:30','23:59']}]])assert.throws(()=>calendar({slots,start:'2026-11-13'},now));
console.log('PASS pitwall: independent persisted session setup, live allowed controls, next-lap return, lap retained, extend/cancel, fuel reserve, per-day calendars and validation.');

// Race changes alter pace/brakes immediately, wing and service only at pit entry.
s=setup();const at=s.schedule.dates[0];advance(s,at);let car=s.race.cars[0];car.incidents=[];const originalFuel=car.fuel;act(s,u,{action:'live',slot:0,strategy:strategy({wing:92,brake:61,pace:'push',compound:'hard',refuel:12}),pit:true},at);assert.equal(car.appliedWing,50);assert.equal(car.strategy.wing,92);assert.equal(car.strategy.brake,61);assert.equal(car.fuel,originalFuel);assert.equal(car.compound,'medium');assert.equal(view(s,{id:'spectator'},at).race.cars[0].appliedWing,undefined);s=JSON.parse(JSON.stringify(s));car=s.race.cars[0];assert.equal(car.appliedWing,50);car.progress=.99;advance(s,at+5000);assert.equal(car.appliedWing,92);assert.equal(car.compound,'hard');assert.equal(car.pits,1);assert(car.fuel>originalFuel+10);assert.equal(s.race.cars[1].appliedWing,50,'second driver unchanged');
