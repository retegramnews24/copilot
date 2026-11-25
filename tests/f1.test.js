// F1 on paper! online: track check, joining, start order, cars on the line one at a time, then rounds where everybody
// chooses together and the cars move when the last one has chosen, the autopilot and the end of the race.
import assert from 'node:assert/strict';
import * as R from '../public/gara/rules.js';
import {
  makeTrack,
  makeRace,
  joinRace,
  leaveRace,
  startRace,
  playRace,
  advanceRace,
  autoMove,
  roundOpts,
  publicRace,
  stateFor
} from '../f1-server.js';
import { tableNotice } from '../lobby-hub.js';

// piste come quelle del gioco: dentro la griglia (centro a C) e un punto ogni 1,3 caselle al massimo
const C = 500;
const ring = (rx, ry, n = 200) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i - 0.5) / n) * Math.PI * 2;
    return { x: C + Math.cos(a) * rx, y: C + Math.sin(a) * ry };
  });
const drawn = players => ({
  outer: ring(40, 26),
  inner: ring(30, 16),
  finish: { a: { x: C + 30, y: C }, b: { x: C + 40, y: C }, outerSeg: 0, innerSeg: 0 },
  normal: { x: 0, y: 1 },
  players
});

// track: checked again on the server
const track = makeTrack(drawn(3));
assert.ok(track.startSlots.length >= 3, 'start slots');
assert.throws(() => makeTrack({ ...drawn(3), outer: [{ x: 0, y: 0 }] }), /Pista non valida/);
assert.throws(() => makeTrack(drawn(9)), /Da 2 a 8/);
assert.throws(() => makeTrack({ ...drawn(2), inner: ring(41, 27) }), /bordi|dentro/);
// limiti prima di ogni calcolo pesante (analisi 10.2): ognuno di questi teneva il server occupato a lungo
const far = { ...drawn(2).finish, a: { x: C - 4000, y: C }, b: { x: C + 4000, y: C } };
assert.throws(
  () => makeTrack({ ...drawn(2), finish: far }),
  /Linea di partenza/,
  'line ends far from the borders'
);
const shifted = list => list.map(p => ({ x: p.x - 600, y: p.y }));
assert.throws(
  () => makeTrack({ ...drawn(2), outer: shifted(ring(40, 26)) }),
  /fuori dalla griglia/,
  'off the grid'
);
assert.throws(
  () => makeTrack({ ...drawn(2), inner: ring(1.2, 1.2, 2400) }),
  /disegnato male/,
  'border far too dense'
);
assert.throws(
  () => makeTrack({ ...drawn(2), outer: ring(40, 26, 40) }),
  /disegnato male/,
  'points too far apart'
);
const big = ring(450, 450, 3000),
  island = ring(50, 50, 400);
assert.throws(
  () =>
    makeTrack({
      ...drawn(2),
      outer: big,
      inner: island,
      finish: { a: { x: C + 50, y: C }, b: { x: C + 450, y: C }, outerSeg: 0, innerSeg: 0 }
    }),
  /troppo grande/,
  'huge track: the autopilot map would not fit in memory'
);
assert.ok(
  R.trackCells(ring(200, 200, 1400), ring(30, 30, 200)) < R.MAX_TRACK_CELLS,
  'a large normal track fits'
);

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
assert.match(
  tableNotice(anna, 'f1', 4, 'room-1', { capacity: 3, laps: 1 }).text,
  /sala 4 · cerca 2 piloti \(3 auto, 1 giro\)/
);

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

// racing: everybody chooses at the same time; only the options of the rules
assert.throws(() => playRace(m, bruno.player, { x: 999, y: 999 }, now, track), /Mossa non valida/);
assert.throws(() => playRace(m, dario.player, { x: 0, y: 0 }, now, track), /Non sei in questa gara/);
const pick = (who, i) => {
  const o = roundOpts({ ...m.race, track }, i).find(x => !x.crash) || roundOpts({ ...m.race, track }, i)[0];
  return playRace(m, who, { x: o.x, y: o.y }, now, track);
};
const movesBefore = m.moves.length,
  turnAt = m.turnAt;
pick(bruno.player, 0);
// nobody moves until the last one has chosen; the others only see who has chosen, never where
assert.equal(m.moves.length, movesBefore);
assert.equal(m.turnAt, turnAt, 'choosing does not restart the minute');
assert.deepEqual(publicRace(m).chosen, [true, false, false]);
assert.equal(publicRace(m).pending, undefined);
assert.throws(() => pick(bruno.player, 0), /Hai già scelto/);
pick(anna.player, 2);
assert.equal(m.moves.length, movesBefore, 'Carla still has to choose');
now += 5000;
pick(carla.player, 1);
// the last one has chosen: one round, all the cars together
assert.equal(m.moves.length, movesBefore + 1);
assert.equal(m.moves.at(-1).kind, 'round');
assert.equal(m.moves.at(-1).moves.filter(Boolean).length, 3);
assert.deepEqual(publicRace(m).chosen, [false, false, false]);
assert.ok(m.turnAt > turnAt, 'a new round: one more minute');

// a client replaying the move list gets exactly the server race
const replay = R.newRace(track, m.laps, m.seats.length);
for (const e of m.moves) {
  if (e.kind === 'place') R.placeCar(replay, { x: e.x, y: e.y });
  else R.applyRound(replay, e.moves);
}
assert.deepEqual(
  replay.cars.map(c => [c.pos, c.gear, c.progress]),
  m.race.cars.map(c => [c.pos, c.gear, c.progress])
);

// time runs out with someone still to choose: the autopilot chooses for them and the round is played
pick(bruno.player, 0);
const n = m.moves.length;
assert.equal(advanceRace(m, m.turnAt + 1, track), true);
assert.equal(m.moves.length, n + 1);
assert.deepEqual(m.moves.at(-1).auto, [false, true, true]);
now = m.turnAt - 60000;

// autopilot: a legal move for each car
for (let i = 0; i < 3; i++) {
  const a = autoMove({ ...m.race, track }, i);
  assert.ok(roundOpts({ ...m.race, track }, i).some(o => o.x === a.x && o.y === a.y));
}

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
  const race = { ...m2.race, track: t2 };
  if (m2.phase === 'place') {
    const target = R.placeable(race)[0];
    playRace(m2, m2.seats[race.turn], { x: target.x, y: target.y }, i, t2);
    continue;
  }
  // each driver who still has to choose (not stopped after a crash) chooses
  const k = race.cars.findIndex((c, j) => !c.crash && !m2.pending[j]);
  const target = autoMove(race, k);
  playRace(m2, m2.seats[k], { x: target.x, y: target.y }, i, t2);
}
assert.equal(m2.phase, 'finished');
assert.equal(m2.abandoned, false);
assert.equal(m2.winners.length, 1);

// solo le mosse nuove (analisi 10.4): con ?moves=N arrivano le mosse dalla N in poi e le auto senza percorso;
// attaccate a quelle già avute danno la stessa gara di prima, molto più leggera
const full = publicRace(m2),
  known = m2.moves.length - 3;
const part = stateFor(m2, String(known));
assert.equal(part.movesFrom, known);
assert.equal(part.moves.length, 3, 'only the new moves');
assert.ok(
  part.race.cars.every(c => c.path === undefined),
  'no paths: the phone rebuilds them'
);
assert.deepEqual(full.moves.slice(0, known).concat(part.moves), full.moves, 'joined, the same moves');
assert.ok(JSON.stringify(part).length < JSON.stringify(full).length / 3, 'much lighter');
assert.deepEqual(stateFor(m2, null), full, 'without ?moves: everything, as before');
for (const bad of ['', '-1', 'x', String(m2.moves.length + 1)])
  assert.deepEqual(stateFor(m2, bad), full, bad);

console.log(
  'PASS F1 on paper! online: track check, join, start order, turns, autopilot, replay, finish, only new moves.'
);
