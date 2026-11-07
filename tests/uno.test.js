import assert from 'node:assert/strict';
import {initialUno,playUno,unoView} from '../uno.js';
let seed=91;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let wins=0;
for(let n=2;n<=8;n++)for(let match=0;match<15;match++){
 let g=initialUno(n,rng);assert.equal(g.hands.length,n);assert.ok(g.hands.every(h=>h.length===7));
 for(let k=0;k<3500&&!g.result;k++){
  const all=[...g.deck,...g.discard,...g.hands.flat()];assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108);
  const seat=g.turn,v=unoView(g,seat),watch=unoView(g);assert.deepEqual(watch.hand,[]);assert.ok(!('deck' in v)&&!('hands' in v));assert.throws(()=>playUno(g,(seat+1)%n,{kind:'draw'},rng));
  const action=v.legalMoves.length?{kind:'play',card:v.legalMoves[Math.floor(rng()*v.legalMoves.length)],color:['red','yellow','green','blue'][Math.floor(rng()*4)]}:v.canPass?{kind:'pass'}:{kind:'draw'};
  const old=JSON.stringify(g);const next=playUno(g,seat,action,rng);assert.equal(JSON.stringify(g),old);g=next;
 }if(g.winner!==null){assert.equal(g.hands[g.winner].length,0);wins++}
}
assert.ok(wins>=100);
const c=(id,color,value)=>({id,color,value});
let g=initialUno(2,rng);g.hands=[[c(200,'red','reverse'),c(201,'blue','3')],[c(202,'green','4')]];g.color='red';g.discard=[c(203,'red','2')];assert.equal(playUno(g,0,{kind:'play',card:200},rng).turn,0);
g.hands[0]=[c(200,null,'wild4'),c(201,'red','3')];assert.throws(()=>playUno(g,0,{kind:'play',card:200,color:'blue'},rng));assert.throws(()=>playUno(g,0,{kind:'play',card:999,color:'blue'},rng));
g.hands[0]=[c(200,null,'wild'),c(201,'red','3')];assert.throws(()=>playUno(g,0,{kind:'play',card:200,color:'invalid'},rng));
console.log('PASS UNO: 105 games with 2–8 players, 108 unique cards conserved through recycling, private projections, immutable actions, turn and wild restrictions, two-player Reverse, completed wins.');

let three=initialUno(3,rng);three.color='red';three.discard=[c(210,'red','1')];three.hands=[[c(211,'red','reverse'),c(212,'blue','2')],[c(213,'yellow','3')],[c(214,'green','4')]];assert.equal(playUno(three,0,{kind:'play',card:211},rng).turn,2);three.hands[0]=[c(211,'red','draw2'),c(212,'blue','2')];const penalty=playUno(three,0,{kind:'play',card:211},rng);assert.equal(penalty.hands[1].length,3);assert.equal(penalty.turn,2);assert.throws(()=>playUno(three,0,{kind:'pass'},rng));
