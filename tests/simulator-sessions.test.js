import assert from 'node:assert/strict';
import {initial,act,advance,view,nextAlarm,strategy} from '../simulator/engine.js';
import {sessionDay} from '../simulator/sessions.js';
const now=Date.parse('2026-11-12T12:00Z'),race=Date.parse('2026-11-13T20:00Z'),u={id:'1',name:'Uno'},v={id:'2',name:'Due'};
function setup(){const s=initial(now);for(const user of [u,v]){act(s,user,{action:'create'},now);const t=s.teams[user.id];t.drivers=[0,1].map(i=>({id:user.id+'d'+i,name:'Pilota '+user.id+i,skill:75,consistency:100,tyres:75,salary:10,points:0}));t.crew={motor:{skill:75,salary:10},aero:{skill:75,salary:10},mechanic:{skill:75,salary:10}};t.engine={skill:75};t.enrolled=true;t.strategies=[strategy({fuel:70}),strategy({fuel:70})]}return s}
function action(s,user,b,at){advance(s,at);act(s,user,b,at)}
let s=setup();action(s,u,{action:'session-start',mode:'practice',slot:0},now);const money=s.teams['1'].cash;
for(let i=1;i<=30;i++)action(s,u,{action:'presence',visible:true},now+i*1000);
assert.equal(view(s,u,now+30000).sessions.practice.remaining,1770000);
action(s,u,{action:'presence',visible:false},now+30000);advance(s,now+3600000);assert.equal(view(s,u,now+3600000).sessions.practice.remaining,1770000,'closed clock pauses');
// Reload from persisted JSON and automatically resume on visible heartbeat.
s=JSON.parse(JSON.stringify(s));action(s,u,{action:'presence',visible:true},now+3600000);advance(s,now+3605000);assert.equal(view(s,u,now+3605000).sessions.practice.remaining,1765000);advance(s,now+3700000);assert.equal(view(s,u,now+3700000).sessions.practice.remaining,1760000,'unexpected disconnect consumes at most ten seconds');assert.equal(s.teams['1'].cash,money);
assert.equal(view(s,v,now+3700000).sessions.practice.cars.length,0,'practice private');
action(s,u,{action:'session-pit',mode:'practice',slot:0},now+3700000);action(s,u,{action:'strategy',slot:0,strategy:strategy({wing:80})},now+3700000);
// Budget is shared by both cars, not consumed twice.
s=setup();action(s,u,{action:'session-start',mode:'practice',slot:0},now);action(s,u,{action:'session-start',mode:'practice',slot:1},now);for(let i=1;i<=1800;i++){action(s,u,{action:'presence',visible:true},now+i*1000)}assert.equal(view(s,u,now+1800000).sessions.practice.remaining,0);assert(s.sessions.practice['1'].cars.every(c=>!c.onTrack));assert(s.sessions.practice['1'].cars[0].best>0);assert.throws(()=>action(s,u,{action:'session-resume',mode:'practice'},now+1800000),/terminati/);assert.equal(view(s,u,now+86400000).sessions.practice.remaining,1800000,'daily reset');
// Race days use the league timezone, including the midnight UTC boundary.
s=setup();s.schedule={dates:[race],participants:['1','2']};assert.equal(sessionDay(Date.parse('2026-11-12T23:30Z')),'2026-11-13');assert.throws(()=>action(s,u,{action:'session-start',mode:'practice',slot:0},Date.parse('2026-11-12T23:30Z')),/giorni di gara/);
const start=race-1800000,end=race-600000;assert.equal(nextAlarm(s,now),start);assert.throws(()=>action(s,u,{action:'session-start',mode:'qualifying',slot:0},start-1),/Qualifiche/);
action(s,u,{action:'session-start',mode:'qualifying',slot:0},start);action(s,v,{action:'session-start',mode:'qualifying',slot:1},start);
for(let i=1;i<=300;i++){action(s,u,{action:'presence',visible:true},start+i*1000);action(s,v,{action:'presence',visible:true},start+i*1000)}assert(s.sessions.qualifying.cars.every(c=>c.best>0));
let q=view(s,u,start+300000).sessions.qualifying;assert.equal(q.cars.length,2);assert(!('strategy' in q.cars.find(c=>!c.own)));assert(!('fuel' in q.cars.find(c=>!c.own)));
const best=s.sessions.qualifying.cars[0].best;advance(s,start+309999);assert(s.sessions.qualifying.cars[0].onTrack);advance(s,start+310000);assert(!s.sessions.qualifying.cars[0].onTrack);assert.equal(s.sessions.qualifying.cars[0].best,best,'valid lap retained on timeout');action(s,u,{action:'presence',visible:true},start+311000);assert(!s.sessions.qualifying.cars[0].onTrack,'reconnect must not automatically leave pits');
assert.throws(()=>action(s,u,{action:'upgrade',part:'aero'},start+311000),/bloccati/);action(s,u,{action:'session-start',mode:'qualifying',slot:0},end-5000);advance(s,end);assert(!s.sessions.qualifying.cars[0].onTrack);assert.throws(()=>action(s,u,{action:'session-start',mode:'qualifying',slot:0},end),/Qualifiche/);
// Fastest timed driver leads; nonparticipants behind; no salary or points during qualifying.
s.sessions.qualifying.cars[0].best=110;s.sessions.qualifying.cars[1].best=100;advance(s,race);assert.equal(s.race.cars[0].id,'2:1');assert.equal(s.race.cars[1].id,'1:0');assert.equal(s.race.cars[2].qualifyingTime,null);assert.equal(s.race.cars[0].grid,1);assert.equal(s.results.length,0);
console.log('PASS sessions: personal paused clock, restart/resume, daily 30-minute budget, private practice, race-day lock, qualifying windows/concurrency, exact 10-second timeout, pit reconnect, private setup, grid order.');
