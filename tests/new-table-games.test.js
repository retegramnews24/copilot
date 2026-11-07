import assert from 'node:assert/strict';
import {initialScarabeo,scarabeoView,playScarabeo,VALUES} from '../scarabeo.js';
import {initialCluedo,cluedoView,playCluedo} from '../cluedo.js';
import {createSeries,settleSeries,activeTable} from '../match-series.js';
let seed=77;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let n=2;n<=4;n++)for(let round=0;round<20;round++){
 let g=initialScarabeo(n,rng);const all=[...g.bag,...g.racks.flat()];assert.equal(all.length,130);assert.equal(new Set(all.map(t=>t.id)).size,130);assert.deepEqual(scarabeoView(g).rack,[]);assert.ok(!('bag' in scarabeoView(g,0))&&!('racks' in scarabeoView(g,0)));
 const word=g.racks[0].filter(t=>t.letter!=='?').slice(0,2).map(t=>t.letter).join('');const original=JSON.stringify(g);assert.throws(()=>playScarabeo(g,0,{kind:'place',word,row:0,col:0},rng));g=playScarabeo(g,0,{kind:'place',word,row:8,col:8},rng);assert.ok(g.pending);assert.equal(g.board.filter(Boolean).length,0);assert.equal(g.pending.score,2*[...word].reduce((s,l)=>s+VALUES[l],0));
 assert.throws(()=>playScarabeo(g,0,{kind:'vote',accept:true},rng));assert.throws(()=>playScarabeo(g,1,{kind:'place',word,row:8,col:8},rng));
 for(let who=1;g.pending;who++)g=playScarabeo(g,who,{kind:'vote',accept:true},rng);assert.equal(g.turn,1);assert.equal(g.board.filter(Boolean).length,2);assert.equal(g.racks[0].length,8);assert.equal(g.scores[0],2*[...word].reduce((s,l)=>s+VALUES[l],0));assert.equal([...g.bag,...g.racks.flat(),...g.board.filter(Boolean)].length,130);assert.ok(original.includes('"board"'));
}
let g=initialScarabeo(2,rng),word=g.racks[0].filter(t=>t.letter!=='?').slice(0,2).map(t=>t.letter).join('');g=playScarabeo(g,0,{kind:'place',word,row:8,col:8},rng);g=playScarabeo(g,1,{kind:'vote',accept:false},rng);assert.equal(g.pending,null);assert.equal(g.board.filter(Boolean).length,0);assert.equal(g.turn,0);
for(let i=0;i<4;i++)g=playScarabeo(g,g.turn,{kind:'pass'},rng);assert.ok(g.result);
for(let n=3;n<=6;n++)for(let round=0;round<25;round++){
 const state=initialCluedo(n,rng),all=[...state.envelope,...state.hands.flat()];assert.equal(all.length,21);assert.equal(new Set(all).size,21);for(let seat=-1;seat<n;seat++){const v=cluedoView(state,seat);assert.equal(v.solution,null);assert.ok(!('envelope' in v)&&!('hands' in v)&&!('deck' in v));if(seat<0)assert.deepEqual(v.hand,[])}
 let c=playCluedo(state,0,{kind:'roll'},()=>.99);assert.equal(c.dice,6);assert.throws(()=>playCluedo(c,0,{kind:'roll'},rng));c=playCluedo(c,0,{kind:'move',room:4},rng);c=playCluedo(c,0,{kind:'suggest',suspect:0,weapon:6},rng);assert.throws(()=>playCluedo(c,0,{kind:'suggest',suspect:0,weapon:6},rng));assert.deepEqual(cluedoView(c).evidence,[]);if(c.evidence[0].length){const e=c.evidence[0][0];assert.ok(c.hands[e.refuter].includes(e.card));assert.ok(c.suggestion.cards.includes(e.card))}
 const solved=playCluedo(state,0,{kind:'accuse',suspect:state.envelope[0],weapon:state.envelope[1],room:state.envelope[2]},rng);assert.equal(solved.winner,0);assert.deepEqual(cluedoView(solved).solution,state.envelope);
 const wrong=playCluedo(state,0,{kind:'accuse',suspect:(state.envelope[0]+1)%6,weapon:state.envelope[1],room:state.envelope[2]},rng);assert.equal(wrong.eliminated[0],true);assert.equal(wrong.turn,1);assert.equal(cluedoView(wrong,0).solution,null);
}
for(const target of [3,5]){const s={game:'connect4',players:[{id:'a'},{id:'b'}],series:createSeries(target),phase:'finished',connect4:{result:'1-0'}};for(let i=1;i<=target;i++){settleSeries(s);assert.equal(s.series.wins[0],i);settleSeries(s);assert.equal(s.series.wins[0],i);if(i<target){assert.ok(activeTable(s));s.series.round++;s.series.recorded=false}}assert.equal(s.series.done,true);assert.equal(activeTable(s),false)}
assert.throws(()=>createSeries(7));console.log('PASS new table games: 60 word boards, rack privacy, 130 tiles, center/turn/vote validation, 100 Cluedo deals and private evidence, accusation/elimination, and first-to-3/5 series.');
