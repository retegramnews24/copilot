import assert from 'node:assert/strict';
import {initialNaval,playNaval,validateFleet,navalView} from '../naval.js';
import {randomFleet} from '../public/naval-data.js';
import {initialBriscola,playBriscola,briscolaView} from '../briscola.js';
import {makeDeck,POINTS,ORDER,trickWinner} from '../public/briscola-data.js';
import {createSeries,settleSeries} from '../match-series.js';
let seed=71;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let match=0;match<60;match++){const a=randomFleet(rng),b=randomFleet(rng);validateFleet(a);validateFleet(b);let g=initialNaval();g=playNaval(g,1,{kind:'deploy',fleet:b});assert.equal(g.phase,'placement');assert.equal(navalView(g,0).fleet,null);g=playNaval(g,0,{kind:'deploy',fleet:a});assert.equal(g.phase,'battle');assert.deepEqual(navalView(g).fleet,null);assert.throws(()=>playNaval(g,0,{kind:'deploy',fleet:a}));
 const targets=b.flat(),misses=Array.from({length:100},(_,i)=>i).filter(i=>!a.flat().includes(i));for(let i=0;i<17;i++){const prev=JSON.stringify(g);const next=playNaval(g,0,{kind:'fire',cell:targets[i]});assert.equal(JSON.stringify(g),prev);g=next;assert.equal(g.shots[0].at(-1).hit,true);assert.equal(g.turn,1);if(i<16){assert.throws(()=>playNaval(g,0,{kind:'fire',cell:99}));g=playNaval(g,1,{kind:'fire',cell:misses[i]});assert.throws(()=>playNaval(g,0,{kind:'fire',cell:targets[i]}))}}assert.equal(g.winner,0);assert.equal(navalView(g).sunk[1],5);assert.throws(()=>playNaval(g,1,{kind:'fire',cell:99}));}
assert.throws(()=>validateFleet([[8,9,10,11,12],...randomFleet(rng).slice(1)]));const overlap=randomFleet(rng);overlap[1]=overlap[0].slice(0,4);assert.throws(()=>validateFleet(overlap));
const deck=makeDeck();assert.equal(deck.reduce((s,c)=>s+POINTS[c.rank],0),120);for(const a of deck)for(const b of deck)if(a.id!==b.id)for(let trump=0;trump<4;trump++){const expected=a.suit===b.suit?(ORDER.indexOf(a.rank)<ORDER.indexOf(b.rank)?0:1):b.suit===trump?1:0;assert.equal(trickWinner([{seat:0,card:a},{seat:1,card:b}],trump),expected)}
for(const n of [2,3,4,5])for(let match=0;match<60;match++){
 let g=initialBriscola(n,rng,0),count=n===3?39:40;if(n===3)assert.ok(![...g.hands.flat(),...g.deck,g.bottom].filter(Boolean).some(c=>c.id===1));
 if(n===5){g=playBriscola(g,1,{kind:'bid',rank:2,target:61},rng);for(const seat of [2,3,4,0])g=playBriscola(g,seat,{kind:'bid-pass'},rng);assert.equal(g.phase,'call');assert.equal(g.caller,1);const option=briscolaView(g,1).callOptions[Math.floor(rng()*4)];g=playBriscola(g,1,{kind:'call',suit:option.suit,rank:2},rng);assert.equal(briscolaView(g).partner,null);assert.ok(!('partner' in g.hands));}
 let steps=0,redeals=g.redeals;while(!g.result){const all=[...g.hands.flat(),...g.deck,...(g.bottom?[g.bottom]:[]),...g.trick.map(p=>p.card),...g.captured.flat()];assert.equal(all.length,count);assert.equal(new Set(all.map(c=>c.id)).size,count);const seat=g.turn,v=briscolaView(g,seat),watch=briscolaView(g);assert.deepEqual(watch.hand,[]);assert.equal(watch.points,null);assert.ok(!('deck' in v)&&!('hands' in v)&&!('captured' in v));assert.throws(()=>playBriscola(g,(seat+1)%n,{kind:'play',card:g.hands[seat][0].id},rng));const card=g.hands[seat][Math.floor(rng()*g.hands[seat].length)];g=playBriscola(g,seat,{kind:'play',card:card.id},rng);if(g.called?.id===card.id)assert.equal(briscolaView(g).partner,seat);steps=g.redeals>redeals?0:steps+1;redeals=g.redeals;assert.ok(steps<=40)}
 assert.equal(steps,count);assert.equal(g.points.reduce((a,b)=>a+b),120);assert.equal(g.hands.flat().length,0);assert.equal(g.captured.flat().length,count);if(n===4&&g.winners.length)assert.equal(g.winners[1]-g.winners[0],2);if(n===5){assert.equal(g.deltas.reduce((a,b)=>a+b),0);assert.equal(g.tricks.reduce((a,b)=>a+b),8);const team=[...new Set([g.caller,g.partner])],success=team.reduce((s,i)=>s+g.points[i],0)>=g.target;assert.deepEqual(g.winners,Array.from({length:5},(_,i)=>i).filter(i=>team.includes(i)===success))}
}
let g=initialBriscola(5,rng,4);g=playBriscola(g,0,{kind:'bid',rank:2,target:61},rng);g=playBriscola(g,1,{kind:'bid',rank:2,target:62},rng);assert.throws(()=>playBriscola(g,2,{kind:'bid',rank:2,target:62},rng));assert.throws(()=>playBriscola(g,2,{kind:'bid',rank:1,target:61},rng));g=playBriscola(g,2,{kind:'bid',rank:2,target:120},rng);for(const seat of [3,4,0,1])g=playBriscola(g,seat,{kind:'bid-pass'},rng);assert.equal(g.caller,2);const self=g.hands[2].find(c=>c.rank===2);if(self){g=playBriscola(g,2,{kind:'call',suit:self.suit,rank:2},rng);assert.equal(g.partner,2);assert.equal(briscolaView(g).partner,null);assert.ok(briscolaView(g,2).role.includes('solo'))}
let fresh=initialBriscola(5,rng,4);for(let seat=0;seat<5;seat++)fresh=playBriscola(fresh,seat,{kind:'bid-pass'},rng);assert.equal(fresh.redeals,1);assert.equal(fresh.phase,'auction');
const c=(suit,rank)=>deck[suit*10+rank-1];let last=initialBriscola(2,rng,1);last.hands=[[c(1,1)],[c(1,2)]];last.deck=[c(2,3)];last.bottom=c(0,7);last.trumpCard=last.bottom;last.trump=0;last=playBriscola(last,0,{kind:'play',card:c(1,1).id});last=playBriscola(last,1,{kind:'play',card:c(1,2).id});assert.equal(last.hands[0][0].id,c(2,3).id);assert.equal(last.hands[1][0].id,c(0,7).id);assert.equal(last.bottom,null);
// Deterministic special calls: own two, lowest missing trump, and invalid alternatives.
let special;
for(let attempt=0;attempt<100&&!special;attempt++){
 let deal=initialBriscola(5,rng,4);
 if(!deal.hands[0].some(c=>c.rank===2))continue;
 deal=playBriscola(deal,0,{kind:'bid',rank:2,target:61},rng);
 for(const seat of [1,2,3,4])deal=playBriscola(deal,seat,{kind:'bid-pass'},rng);
 special=deal;
}
assert.ok(special);
const ownTwo=special.hands[0].find(c=>c.rank===2), options=briscolaView(special,0).callOptions.find(o=>o.suit===ownTwo.suit);
const missing=[...ORDER].reverse().find(rank=>!special.hands[0].some(c=>c.suit===ownTwo.suit&&c.rank===rank));
assert.deepEqual(options.ranks,[2,missing]);
const solo=playBriscola(special,0,{kind:'call',suit:ownTwo.suit,rank:2},rng);assert.equal(solo.partner,0);assert.equal(briscolaView(solo).partner,null);
const paired=playBriscola(special,0,{kind:'call',suit:ownTwo.suit,rank:missing},rng);assert.notEqual(paired.partner,0);assert.equal(briscolaView(paired).partner,null);
assert.throws(()=>playBriscola(special,0,{kind:'call',suit:ownTwo.suit,rank:ORDER.find(r=>!options.ranks.includes(r))},rng));
const series={game:'briscola',players:Array(4).fill({}),phase:'finished',series:createSeries(3),briscola:{winners:[0,2]}};for(let i=0;i<3;i++){settleSeries(series);if(i<2){series.series.recorded=false;series.series.round++}}assert.deepEqual(series.series.winners,[0,2]);

for(const points of [[60,60],[40,40,40],[30,30,30,30]]){
 const n=points.length,starting=initialBriscola(n,rng,n-1);
 starting.hands=Array.from({length:n},(_,i)=>[c(i,2)]);
 starting.deck=[];starting.bottom=null;starting.trump=0;starting.points=points;
 let game=starting;
 for(let i=0;i<n;i++)game=playBriscola(game,i,{kind:'play',card:c(i,2).id},rng);
 assert.equal(game.dealer,n-1);assert.equal(game.redeals,1);assert.equal(game.result,null);assert.equal(game.hands[0].length,3);
}

console.log('PASS sea/cards: 60 complete naval battles, secret fleets, placements and duplicate shots; 240 complete Briscola deals, 120 points, 39/40 unique cards, all trick comparisons, called partner secrecy, auction/redeal, final trump draw and shared tournament winners.');
