import assert from 'node:assert/strict';
import { COURSES } from '../public/golf/courses.js';
import { simulateShot } from '../public/golf/physics.js';
import { makeMatch, joinMatch, startMatch, takeShot, advanceMatch, HOLE_TIME, BREAK } from '../public/golf/match.js';

const routes=[
  [],
  [[8,12],[14,12],[15.5,5],[20,5]],
  [],
  [[8,8],[17,8.4]],
  [[8,6.1],[18,6.1]],
  [[8,2.4],[18,2.4]],
  [[8,5],[16.15,5],[16.15,9],[19.5,9]],
  [[8,4.6],[16,4.6],[16,8],[21,8]],
  [[8,12],[10.7,12],[11,6.7],[16,6.7],[20,5],[23,5]]
];
for(const [i,course] of COURSES.entries()){
  let position=course.tee;
  const goals=[...routes[i],course.cup];
  for(const target of goals){
    const dx=target[0]-position[0],dz=target[1]-position[1];
    const power=Math.max(0,(Math.sqrt(4.5*Math.hypot(dx,dz))+.07-1.7)/18);
    const choices=Array.from({length:24},(_,phase)=>simulateShot(course,...position,Math.atan2(dz,dx),power,phase*.18));
    const error=shot=>shot.penalty?Infinity:Math.hypot(shot.end[0]-target[0],shot.end[1]-target[1]);
    const best=choices.sort((a,b)=>error(a)-error(b))[0];
    assert.ok(error(best)<.68,course.name+' has a playable route toward '+target);
    position=best.end;
    if(target===course.cup)assert.equal(best.sunk,true,course.name);
  }
}
for(const power of [.43,.65,1])assert.equal(simulateShot(COURSES[0],3,8,0,power).sunk,true);
assert.equal(simulateShot(COURSES[0],22.6,8.53,0,.04).sunk,true,'A slow putt catches the lip');
assert.equal(simulateShot(COURSES[0],22.3,8.55,0,1).sunk,false,'A hard glancing shot can pass the lip');
const water=simulateShot(COURSES[2],3,2,0,.6);
assert.equal(water.penalty,true);assert.deepEqual(water.end,[3,2]);
const wall=simulateShot(COURSES[0],3,8,Math.PI,.45);
assert.ok(wall.end[0]>3,'A shot rebounds from the perimeter');

const a={player:'tg:1',name:'Uno'},b={player:'tg:2',name:'Due'},match=makeMatch('golf',1,a,0);
assert.throws(()=>startMatch(match,a.player,0),/Aspetta/);
joinMatch(match,b);assert.throws(()=>startMatch(match,b.player,0),/Solo/);
startMatch(match,a.player,0);assert.throws(()=>joinMatch(match,{player:'tg:3',name:'Tre'}),/iniziata/);
const input={hole:0,strokes:0,angle:0,power:.43};
takeShot(match,a.player,input,1);takeShot(match,b.player,input,1);
assert.equal(match.players.every(p=>p.shot.sunk),true);
assert.throws(()=>takeShot(match,a.player,input,2),/Attendi/);
const landed=match.players[0].shot.until;
assert.equal(advanceMatch(match,landed-1),false);
advanceMatch(match,landed);
assert.equal(match.players.every(p=>p.total===1),true);
advanceMatch(match,landed+BREAK);
assert.equal(match.hole,1);
for(let i=1;i<COURSES.length;i++){
  advanceMatch(match,match.deadline);
  if(match.nextAt)advanceMatch(match,match.nextAt);
}
assert.equal(match.phase,'finished');assert.equal(match.winners.length,2);
assert.equal(match.players[0].total,1+8*11);
console.log('PASS Golf: all nine courses, bank shots, water reset, simultaneous shots, scoring and automatic transitions.');
