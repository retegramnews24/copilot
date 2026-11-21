import assert from 'node:assert/strict';
import {initialUno,playUno,unoView} from '../uno.js';
import {chooseAction} from '../table-ai.js';
let seed=91;
const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

for(let n=2;n<=10;n++)for(let match=0;match<8;match++){
 let g=initialUno(n,rng);
 assert.equal(g.hands.length,n);
 assert.ok(g.hands.every(h=>h.length===7||h.length===9&&g.discard[0].value==='draw2'));
 for(let k=0;k<5000&&!g.result;k++){
  const all=[...g.deck,...g.discard,...g.hands.flat()];
  assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108);
  const seat=g.turn,v=unoView(g,seat),watch=unoView(g);
  assert.deepEqual(watch.hand,[]);assert.ok(!('deck' in v)&&!('hands' in v));
  assert.throws(()=>playUno(g,(seat+1)%n,{kind:'draw'},rng));
  const action=chooseAction('uno',v,seat,k%2===0);
  const old=JSON.stringify(g);const next=playUno(g,seat,action,rng);assert.equal(JSON.stringify(g),old);g=next;
 }
 assert.equal(g.result,'win');assert.equal(g.hands[g.winner].length,0);assert.ok(g.scores[g.winner]>=500);
}
const c=(id,color,value)=>({id,color,value});
function fixture(n=2){
 const g=initialUno(n,rng);
 return {...g,turn:0,color:'red',direction:1,openingWild:false,discard:[c(203,'red','2')],hands:[[c(200,null,'wild4'),c(201,'red','3')],...Array.from({length:n-1},()=>[c(202,'green','4')])]};
}
let g=fixture();
assert.throws(()=>playUno(g,0,{kind:'play',card:200,color:'invalid'},rng));
const bluff=playUno(g,0,{kind:'play',card:200,color:'blue'},rng);
assert.equal(unoView(bluff,1).decidePenalty,true);
assert.equal(unoView(bluff).decidePenalty,false);
assert.throws(()=>playUno(bluff,1,{kind:'draw'},rng));
const challenged=playUno(bluff,1,{kind:'challenge-four'},rng);
assert.equal(challenged.hands[0].length,5);assert.equal(challenged.turn,1);
assert.deepEqual(unoView(challenged,1).shownHand,[c(201,'red','3')]);
assert.deepEqual(unoView(challenged,-1).shownHand,[]);

g=fixture(3);g.hands[0][1]=c(201,'green','3');
const legal=playUno(g,0,{kind:'play',card:200,color:'blue',uno:true},rng);
const penalized=playUno(legal,1,{kind:'challenge-four'},rng);
assert.equal(penalized.hands[1].length,7);assert.equal(penalized.turn,2);
assert.equal(unoView(legal,2).canCatch,false);
g=fixture(3);g.hands[0]=[c(210,'red','reverse'),c(211,'blue','2')];
const reversed=playUno(g,0,{kind:'play',card:210},rng);
assert.equal(reversed.turn,2);assert.equal(unoView(reversed,0).canDeclare,true);
assert.equal(playUno(reversed,1,{kind:'catch-uno'},rng).hands[0].length,3);
assert.equal(unoView(playUno(reversed,0,{kind:'uno'},rng),1).canCatch,false);

g=fixture();g.hands[0]=[c(210,'red','reverse'),c(211,'blue','2')];
assert.equal(playUno(g,0,{kind:'play',card:210},rng).turn,0);
g=fixture();g.hands[0]=[c(210,'red','draw2')];g.scores[0]=499;
const won=playUno(g,0,{kind:'play',card:210},rng);
assert.equal(won.winner,0);assert.ok(won.scores[0]>=503);
console.log('PASS UNO: 72 matches to 500, 2–10 players, deck conservation, starting effects, UNO calls, +4 disputes and private hand reveals.');
