// F1 on paper! online: track check, joining, start order, turns, the autopilot and the end of the race.
import assert from 'node:assert/strict';
import * as R from '../public/gara/rules.js';
import { makeTrack, makeRace, joinRace, leaveRace, startRace, playRace, advanceRace, autoMove } from '../f1-server.js';
import { tableNotice } from '../lobby-hub.js';

const ring = (rx, ry, n = 96) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i - 0.5) / n) * Math.PI * 2;
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
  });
const drawn = players => ({
  outer: ring(40, 26),
  inner: ring(30, 16),
  finish: { a: { x: 30, y: 0 }, b: { x: 40, y: 0 }, outerSeg: 0, innerSeg: 0 },
  normal: { x: 0, y: 1 },
  players
});

// track: checked again on the server
const track = makeTrack(drawn(3));
assert.ok(track.startSlots.length >= 3, 'start slots');
assert.throws(() => makeTrack({ ...drawn(3), outer: [{ x: 0, y: 0 }] }), /Pista non valida/);
assert.throws(() => makeTrack(drawn(9)), /Da 2 a 8/);
assert.throws(() => makeTrack({ ...drawn(2), inner: ring(41, 27) }), /bordi|dentro/);

const anna = { player: 'p-anna', name: 'Anna' },
  bruno = { player: 'p-bruno', name: 'Bruno' },
  carla = { player: 'p-carla', name: 'Carla' },
  dario = { player: 'p-dario', name: 'Dario' };
let now = 1000;
const m = makeRace('room-1', 4, anna, now, { laps: 1, time: 'night' }, track);
assert.equal(m.phase, 'waiting');
assert.equal(m.capacity, 3);
assert.throws(() => makeRace('r', 1, anna, now, { laps: 0 }, track), /giri/);

// notice: how many drivers the race is waiting for
assert.match(tableNotice(anna, 'f1', 4, 'room-1', { capacity: 3, laps: 1 }).text, /sala 4 · cerca 2 piloti \(3 auto, 1 giro\)/);

// joining: once each, not beyond the cars of the track; a guest can leave the waiting room
assert.equal(joinRace(m, bruno), true);
assert.equal(joinRace(m, bruno), false);
assert.equal(leaveRace(m, bruno.player), true);
assert.throws(() => leaveRace(m, anna.player), /chiude/);
assert.equal(joinRace(m, bruno), true);
assert.throws(() => startRace(m, bruno.player, now, track), /Solo chi ha creato/);
joinRace(m, carla);
assert.throws(() => joinRace(m, dario), /completo/);

// start: guests first, creator last; the cars go on the line in that order
startRace(m, anna.player, now, track);
assert.deepEqual(m.seats, ['p-bruno', 'p-carla', 'p-anna']);
assert.equal(m.phase, 'place');
assert.throws(() => joinRace(m, dario), /già partita/);
assert.throws(() => playRace(m, anna.player, { x: 0, y: 0 }, now, track), /Non tocca a te/);
const slots = R.placeable({ ...m.race, track });
playRace(m, bruno.player, slots[0], now, track);
assert.equal(m.moves[0].kind, 'place');
// Carla is away: after a minute the autopilot places her car
assert.equal(advanceRace(m, now + 59000, track), false);
assert.equal(advanceRace(m, now + 61000, track), true);
assert.equal(m.moves[1].auto, true);
now += 61000;
playRace(m, anna.player, R.placeable({ ...m.race, track })[0], now, track);
assert.equal(m.phase, 'race');

// moves: only the options of the rules
assert.throws(() => playRace(m, bruno.player, { x: 999, y: 999 }, now, track), /Mossa non valida/);
const before = m.revision;
const opt = R.options({ ...m.race, track })[0];
playRace(m, bruno.player, { x: opt.x, y: opt.y }, now, track);
assert.equal(m.revision, before + 1);
assert.equal(m.moves.at(-1).kind, 'move');

// a client replaying the move list gets exactly the server race
const replay = R.newRace(track, m.laps, m.seats.length);
for (const e of m.moves) {
  if (e.kind === 'place') R.placeCar(replay, { x: e.x, y: e.y });
  else R.applyMove(replay, { x: e.x, y: e.y, gear: e.gear, crash: e.crash, stop: e.stop });
}
assert.deepEqual(
  replay.cars.map(c => [c.pos, c.gear, c.progress]),
  m.race.cars.map(c => [c.pos, c.gear, c.progress])
);
assert.equal(replay.turn, m.race.turn);

// autopilot: a legal move
const a = autoMove({ ...m.race, track });
assert.ok(R.options({ ...m.race, track }).some(o => o.x === a.x && o.y === a.y));

// nobody plays any more: after three rounds of autopilot the race ends without a winner
let guard = 0;
while (m.phase !== 'finished' && guard++ < 50) {
  now += 61000;
  advanceRace(m, now, track);
}
assert.equal(m.phase, 'finished');
assert.ok(m.abandoned || m.winners.length === 1);

// a full race with people playing: someone wins
const m2 = makeRace('room-2', 5, anna, 0, { laps: 1 }, makeTrack(drawn(2)));
const t2 = makeTrack(drawn(2));
joinRace(m2, bruno);
startRace(m2, anna.player, 0, t2);
for (let i = 0; i < 2000 && m2.phase !== 'finished'; i++) {
  const race = { ...m2.race, track: t2 },
    who = m2.seats[race.turn];
  const target = m2.phase === 'place' ? R.placeable(race)[0] : autoMove(race);
  playRace(m2, who, { x: target.x, y: target.y }, i, t2);
}
assert.equal(m2.phase, 'finished');
assert.equal(m2.abandoned, false);
assert.equal(m2.winners.length, 1);

console.log('PASS F1 on paper! online: track check, join, start order, turns, autopilot, replay, finish.');
