import assert from 'node:assert/strict';
import { COURSES, COURSE_VERSION, CAMPAIGNS, coursesFor, courseFor, ballColors } from '../public/golf/courses.js';
import { upright, rollBy, rotateVector } from '../public/golf/roll.js';
import { simulateShot, estimateRoll } from '../public/golf/physics.js';
import { makeMatch, joinMatch, startMatch, takeShot, advanceMatch, ballRolling, HOLE_TIME, BREAK } from '../public/golf/match.js';

const quarter=Math.PI*.24/2;
const rolled=rollBy(upright,quarter,0,.24);
const near=(a,b)=>assert.ok(a.every((value,i)=>Math.abs(value-b[i])<1e-9));
near(rotateVector(rolled,[0,1,0]),[1,0,0]);
near(rollBy(rolled,-quarter,0,.24),upright);
near(rotateVector(rollBy(upright,0,quarter,.24),[0,1,0]),[0,0,1]);

function powerFor(distance){
  let low=0,high=1;
  for(let step=0;step<20;step++){
    const power=(low+high)/2;
    if(estimateRoll(COURSES[0],0,0,power)<distance+.06)low=power;else high=power;
  }
  return high;
}
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
for(const version of [undefined,2,3])for(const i of COURSES.keys()){
  const course=courseFor(i,version),scale=course.scale??1;
  let position=course.tee;
  const goals=[...routes[i].map(point=>point.map(value=>value*scale)),course.cup];
  for(const target of goals){
    const dx=target[0]-position[0],dz=target[1]-position[1];
    const power=powerFor(Math.hypot(dx,dz)/scale);
    const choices=Array.from({length:24},(_,phase)=>simulateShot(course,...position,Math.atan2(dz,dx),power,phase*.18));
    const error=shot=>shot.penalty?Infinity:Math.hypot(shot.end[0]-target[0],shot.end[1]-target[1]);
    const best=choices.sort((a,b)=>error(a)-error(b))[0];
    assert.ok(error(best)<.68*scale,course.name+' has a playable route toward '+target);
    position=best.end;
    if(target===course.cup)assert.equal(best.sunk,true,course.name);
  }
}
for(const set of CAMPAIGNS){
  const courses=coursesFor(COURSE_VERSION,set.id);
  assert.equal(courses.length,10);
  for(const [i,course] of courses.entries()){
    assert.ok(course.width>courseFor(0,3).width&&course.depth>courseFor(0,3).depth);
    let position=course.tee;
    const gates=set.holes[i].at(-1);
    const goals=[...gates.flatMap(([x,z,,kind])=>kind==='water'?[[x-1,z],[x+4.25,z]]:[[x+.65,z]])
      .map(point=>point.map(value=>value*set.scale)),course.cup];
    assert.ok(goals.length<=10);
    for(const target of goals){
      const dx=target[0]-position[0],dz=target[1]-position[1];
      const error=shot=>shot.penalty?Infinity:Math.hypot(shot.end[0]-target[0],shot.end[1]-target[1]);
      const candidates=Array.from({length:16},(_,phase)=>simulateShot(course,...position,Math.atan2(dz,dx),
        powerFor(Math.hypot(dx,dz)/set.scale),phase*.27));
      const best=candidates.sort((a,b)=>error(a)-error(b))[0];
      assert.ok(error(best)<.8*set.scale,course.name+' has a playable route toward '+target);
      position=best.end;
      if(target===course.cup)assert.equal(best.sunk,true,course.name);
    }
  }
}
for(const power of [.43,.65,1])assert.equal(simulateShot(COURSES[0],3,8,0,power).sunk,true);
assert.equal(simulateShot(COURSES[0],22.6,8.53,0,.04).sunk,true,'A slow putt catches the lip');
assert.equal(simulateShot(COURSES[0],22.3,8.55,0,1).sunk,false,'A hard glancing shot can pass the lip');
const tap=simulateShot(COURSES[0],22.37,8,0,.015);
assert.equal(tap.sunk,true,'A 1.5% tap can reach the lip from just outside the cup');
assert.ok(simulateShot(COURSES[0],3,8,0,.01).end[0]-3<.04,'A 1% tap travels only a few centimetres');
const water=simulateShot(COURSES[2],3,2,0,.6);
assert.equal(water.penalty,true);assert.deepEqual(water.end,[3,2]);
const wall=simulateShot(COURSES[0],3,8,Math.PI,.45);
assert.ok(wall.end[0]>3,'A shot rebounds from the perimeter');

const a={player:'tg:1',name:'Uno'},b={player:'tg:2',name:'Due'},match=makeMatch('golf',1,a,0);
assert.deepEqual(match.players[0].position,courseFor(0,COURSE_VERSION).tee);
assert.ok(courseFor(0,COURSE_VERSION).width>35);
assert.deepEqual(ballColors(['red','#123456'],1),['#ff82b6','#455aa7']);
assert.throws(()=>makeMatch('golf',1,a,0,undefined,'park'),/Percorso/);
match.campaign='park'; // Stored matches keep the retired layout.
const skin=['#abcdef','#012345'];
joinMatch(match,a,skin);
assert.deepEqual(match.players[0].appearance,skin);
assert.throws(()=>startMatch(match,a.player,0),/Aspetta/);
joinMatch(match,b);assert.throws(()=>startMatch(match,b.player,0),/Solo/);
startMatch(match,a.player,0);assert.throws(()=>joinMatch(match,{player:'tg:3',name:'Tre'}),/iniziata/);
const input={hole:0,strokes:0,angle:0,power:.54};
takeShot(match,a.player,input,1);takeShot(match,b.player,input,1);
assert.equal(match.players.every(p=>p.shot.sunk),true);
assert.throws(()=>takeShot(match,a.player,input,2),/Attendi/);
const landed=match.players[0].shot.until;
assert.equal(advanceMatch(match,landed-1),false);
advanceMatch(match,landed);
assert.equal(match.players.every(p=>p.total===1),true);
advanceMatch(match,landed+BREAK);
assert.equal(match.hole,1);
for(let i=1;i<10;i++){
  advanceMatch(match,match.deadline);
  if(match.nextAt)advanceMatch(match,match.nextAt);
}
assert.equal(match.phase,'finished');assert.equal(match.winners.length,2);
assert.equal(match.players[0].total,1+9*11);
function collisionMatch(collisions){
  const match=makeMatch('collision',1,a,0,undefined,undefined,collisions);
  match.campaign='park';
  joinMatch(match,b);startMatch(match,a.player,0);
  return match;
}
const hit={hole:0,strokes:0,angle:0,power:.45};
for(const collisions of [false,true]){
  const round=collisionMatch(collisions),[first,second]=round.players;
  const [x,z]=first.position;
  second.position=[x+8,z];
  takeShot(round,a.player,hit,10);
  assert.equal(second.strokes,0,'A collision is not a stroke for the other player');
  if(collisions){
    assert.ok(second.position[0]>x+8);
    assert.ok(second.shot.moveAt>10);
    assert.equal(ballRolling(second,10),false,'A predicted impact does not block a shot');
    assert.equal(ballRolling(second,second.shot.moveAt),true);
    assert.ok(first.position[0]<x+8);
    takeShot(round,b.player,{...hit,angle:Math.PI/2,power:.22},30);
    assert.equal(second.strokes,1);
    assert.ok(first.position[0]>x+8,'A second shot can clear the path before impact');
    assert.ok(second.position[1]>z);
  }else{
    assert.deepEqual(second.position,[x+8,z]);
    assert.equal(second.shot,null);
    assert.ok(first.position[0]>x+8);
  }
}
const tee=collisionMatch(true);
takeShot(tee,a.player,hit,10);
assert.equal(tee.players[1].shot,null,'Players can leave the shared tee freely');
takeShot(tee,b.player,{...hit,angle:Math.PI/2,power:.3},10);
assert.equal(tee.players.every(p=>p.strokes===1),true);
const moving=collisionMatch(true),[left,right]=moving.players;
right.position=[left.position[0]+15,left.position[1]];
takeShot(moving,a.player,{...hit,power:.4},10);
takeShot(moving,b.player,{...hit,angle:Math.PI,power:.4},10);
assert.ok(left.position[0]<right.position[0],'Head-on balls rebound instead of passing through each other');
console.log('PASS Golf: all 30 campaign holes and nine legacy courses, bank shots, water reset, simultaneous shots, scoring and automatic transitions.');
