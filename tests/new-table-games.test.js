import assert from 'node:assert/strict';
import {initialScarabeo,scarabeoView,playScarabeo,VALUES} from '../scarabeo.js';
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
for(const target of [3,5]){const s={game:'connect4',players:[{id:'a'},{id:'b'}],series:createSeries(target),phase:'finished',connect4:{result:'1-0'}};for(let i=1;i<=target;i++){settleSeries(s);assert.equal(s.series.wins[0],i);settleSeries(s);assert.equal(s.series.wins[0],i);if(i<target){assert.ok(activeTable(s));s.series.round++;s.series.recorded=false}}assert.equal(s.series.done,true);assert.equal(activeTable(s),false)}
assert.throws(()=>createSeries(7));console.log('PASS new table games: 60 word boards, rack privacy, 130 tiles, center/turn/vote validation, first-to-3/5 series.');
