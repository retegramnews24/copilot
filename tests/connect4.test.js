import assert from 'node:assert/strict';
import {initialConnect4,playConnect4} from '../connect4.js';
const play=seq=>seq.reduce((s,c)=>playConnect4(s,c),initialConnect4());
for(const seq of [[0,0,1,1,2,2,3],[0,1,0,1,0,1,0]]){const s=play(seq);assert.equal(s.result,'1-0');assert.equal(s.winning.length,4);assert.equal(s.legalMoves.length,0);assert.throws(()=>playConnect4(s,6))}
let full=play([0,0,0,0,0,0]);assert.throws(()=>playConnect4(full,0));for(const v of [-1,7,NaN,'2',1.5])assert.throws(()=>playConnect4(initialConnect4(),v));const start=initialConnect4();playConnect4(start,2);assert.ok(start.board.every(x=>x===null));
// Independent exhaustive line scan checks gravity and all winning directions after random legal drops.
let seed=7,diagonal=0,draws=0;
for(let game=0;game<600;game++){let s=initialConnect4();while(!s.result){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const col=s.legalMoves[seed%s.legalMoves.length],before=s;s=playConnect4(s,col);assert.equal(s.board.filter(x=>x!==null).length,before.board.filter(x=>x!==null).length+1);
 let win=false;for(let y=0;y<6;y++)for(let x=0;x<7;x++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){const cells=Array.from({length:4},(_,i)=>[x+dx*i,y+dy*i]);if(cells.every(([a,b])=>a>=0&&a<7&&b>=0&&b<6&&s.board[b*7+a]===before.turn)){win=true;if(dx&&dy)diagonal++}}
 assert.equal(s.winning.length>=4,win);for(let x=0;x<7;x++){let piece=false;for(let y=0;y<6;y++){if(s.board[y*7+x]!==null)piece=true;else assert.equal(piece,false)}}
 }if(s.result==='1/2-1/2')draws++}
assert.ok(diagonal>0);assert.ok(draws>0);console.log('PASS Forza 4: gravity, full/invalid columns, immutability, horizontal/vertical/diagonal victories, terminal states and draws in 600 complete games.');
