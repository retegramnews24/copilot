import assert from 'node:assert/strict';
import { publicTable, newTable, applyMove, botSeat, tableSummary, resetRound } from '../table-rules.js';

const ROOM = '0f8fad5b-d9cb-469f-a165-70867728950e';

// A new table between people waits for the second player; against the AI the bots sit and it starts.
const waiting = newTable(ROOM, { game: 'chess', name: 'Ada', playerId: 'tg:1', number: 2 }, 'tok');
assert.equal(waiting.phase, 'waiting');
assert.equal(waiting.players.length, 1);
assert.ok(waiting.expires - waiting.created === 7 * 86400000);
assert.throws(() => newTable(ROOM, { game: 'cluedo', name: 'Ada' }, 't'), /Gioco non disponibile/);
assert.throws(() => newTable(ROOM, { game: 'chess', name: '  ' }, 't'), /Inserisci un nome/);
const solo = newTable(ROOM, { game: 'uno', mode: 'ai', seats: 3, name: 'Ada', playerId: 'tg:1' }, 'tok');
assert.equal(solo.phase, 'playing');
assert.deepEqual(
  solo.players.map(p => !!p.bot),
  [false, true, true]
);
assert.throws(() => newTable(ROOM, { game: 'uno', mode: 'ai', seats: 11, name: 'Ada' }, 't'), /Numero posti/);

// Privacy: each viewer sees only their own hand; tokens never leave the server.
const own = publicTable(solo, 'tg:1'),
  stranger = publicTable(solo, 'tg:9');
assert.equal(own.uno.hand.length, 7);
assert.deepEqual(stranger.uno.hand, []);
assert.ok(!JSON.stringify(own).includes('tok'), 'player token not exposed');

// The AI seat that must act.
solo.turn = 1;
solo.uno.turn = 1;
assert.equal(botSeat(solo), 1);
assert.equal(botSeat({ ...solo, mode: 'people' }), -1);

// Moves: turn guard, legal move, the clock deadline uses the time limit.
const chess = newTable(ROOM, { game: 'chess', name: 'Ada', playerId: 'tg:1' }, 'tok');
chess.players.push({ id: 'tg:2', name: 'Bruno' });
chess.phase = 'playing';
assert.throws(() => applyMove(chess, 1, { from: 'e7', to: 'e5' }), /Non è il tuo turno/);
assert.throws(() => applyMove(chess, 0, { from: 'e2', to: 'e5' }), /Mossa non consentita/);
applyMove(chess, 0, { from: 'e2', to: 'e4' });
assert.equal(chess.turn, 1);
assert.equal(chess.moves.at(-1).san, 'e4');
chess.clock = { since: 1000, reminded: false };
assert.equal(publicTable(chess, 'tg:1', 5000).clock.deadline, 11000);
assert.equal(publicTable({ ...chess, clock: null }, 'tg:1').clock, null);

// Lobby record and a fresh round.
assert.deepEqual(Object.keys(tableSummary(publicTable(chess))).slice(0, 6), [
  'room',
  'number',
  'game',
  'archived',
  'phase',
  'players'
]);
resetRound(chess);
assert.deepEqual(chess.moves, []);
assert.equal(chess.turn, 0);

console.log(
  'PASS table rules: new tables (people, AI seats), private hands and tokens, AI seat, turn guard, legal moves, clock deadline, summary and reset.'
);
