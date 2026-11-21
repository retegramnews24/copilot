import assert from 'node:assert/strict';
import {initialCheckers,checkersMoves,playCheckers,checkersSnapshot,checkersKey,squareNumber} from '../checkers.js';
const initial=initialCheckers();
assert.equal(Object.values(initial.board).filter(p=>p==='M').length,12);assert.equal(Object.values(initial.board).filter(p=>p==='m').length,12);
assert.equal(initial.board.h1,'M');assert.equal(initial.board.a8,'m');assert.equal(squareNumber('a8'),1);assert.equal(squareNumber('h1'),32);
assert.equal(checkersMoves(initial.board,0).length,7);assert.ok(checkersMoves(initial.board,0).every(m=>m.path[0][1]==='3'&&m.path[1][1]==='4'));
assert.throws(()=>playCheckers(initial,['a8','b7']));assert.throws(()=>playCheckers(initial,['a3','d6']));assert.throws(()=>playCheckers(initial,'a3-b4'));
let board={b3:'M',c4:'m',e6:'m',h1:'M',h7:'m'};
assert.deepEqual(checkersMoves(board,0).map(m=>m.path),[['b3','d5','f7']]);assert.throws(()=>playCheckers({board,turn:0},['b3','d5']));
let played=playCheckers({board,turn:0},['b3','d5','f7']);assert.equal(played.game.board.f7,'M');assert.equal(played.game.board.c4,undefined);assert.equal(played.game.board.e6,undefined);assert.equal(played.move.san,'21x14x7');assert.equal(played.game.turn,1);
// Men cannot capture backwards or capture a king.
assert.ok(checkersMoves({d5:'M',c4:'m',h7:'m'},0).every(m=>!m.captures.length));
assert.ok(checkersMoves({b3:'M',c4:'k'},0).every(m=>!m.captures.length));
// Kings are short, may capture in both directions.
assert.ok(checkersMoves({d5:'K',c4:'m'},0).some(m=>m.path.join(',')==='d5,b3'));
assert.ok(checkersMoves({d5:'K'},0).every(m=>Math.abs(Number(m.path[0][1])-Number(m.path[1][1]))===1));
// Promotion completes the turn, even if new king would have a backwards capture.
played=playCheckers({board:{a6:'M',b7:'m',d7:'m'},turn:0},['a6','c8']);assert.equal(played.game.board.c8,'K');assert.equal(played.move.promoted,true);
// Ranking: most captures, then king mover, then most kings, then earliest king.
assert.deepEqual(checkersMoves({b3:'M',c4:'m',e6:'m',f3:'K',g4:'m'},0).map(m=>m.path),[['b3','d5','f7']]);
assert.deepEqual(checkersMoves({b3:'M',c4:'m',f3:'K',g4:'m'},0).map(m=>m.path),[['f3','h5']]);
assert.deepEqual(checkersMoves({d3:'K',c4:'k',e4:'m'},0).map(m=>m.path),[['d3','b5']]);
assert.deepEqual(checkersMoves({d1:'K',c2:'k',c4:'m',e4:'k',e2:'m'},0).map(m=>m.path),[['d1','b3','d5','f3','d1']]);
assert.equal(checkersSnapshot({board:{a8:'M',h1:'m'},turn:0,quiet:0}).result,'0-1');
assert.equal(checkersSnapshot({board:{b3:'K'},turn:1,quiet:0}).result,'1-0');
assert.equal(checkersSnapshot({board:{b3:'K',g6:'k'},turn:0,quiet:80}).result,'1/2-1/2');
assert.equal(checkersSnapshot(initial,null,3).reason,'Triplice ripetizione');
// Deterministic complete games: every move preserves board parity and removes only captures.
let seed=71;for(let g=0;g<30;g++){let game=initialCheckers();const seen=new Map();for(let ply=0;ply<400;ply++){
 const snapshot=checkersSnapshot(game,null,seen.get(checkersKey(game))||1);if(snapshot.result)break;
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const m=snapshot.legalMoves[seed%snapshot.legalMoves.length],before=Object.keys(game.board).length;
 const {game:next}=playCheckers(game,m.path);assert.equal(Object.keys(next.board).length,before-m.captures.length);
 for(const s of Object.keys(next.board))assert.equal(('abcdefgh'.indexOf(s[0])+Number(s[1]))%2,0);
 assert.equal(next.turn,1-game.turn);game=next;const key=checkersKey(game);seen.set(key,(seen.get(key)||0)+1);
}}
console.log('PASS engine: Italian placement, forward men, short kings, forced complete captures, all capture priorities, promotion, win/draw and 30 deterministic games.');
