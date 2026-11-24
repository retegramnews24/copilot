// F1 e Biliardo con chi esce a metà (analisi Fable, area 2, punto B): chi non si fa sentire viene guidato subito dal
// pilota automatico, chi abbandona non vince, nel Biliardo la squadra che se ne va perde a tavolino.
import assert from 'node:assert/strict';
import * as R from '../public/gara/rules.js';
import {
  makeTrack,
  makeRace,
  joinRace,
  startRace,
  playRace,
  advanceRace,
  abandonRace,
  AWAY as F1_AWAY,
  GAP as F1_GAP
} from '../f1-server.js';
import {
  makeMatch,
  joinMatch,
  startMatch,
  advanceMatch,
  abandonMatch,
  AWAY,
  GAP,
  FORFEIT
} from '../biliardo-server.js';

const anna = { player: 'p-anna', name: 'Anna' },
  bruno = { player: 'p-bruno', name: 'Bruno' };

// ---- F1 ----
{
  const ring = (rx, ry, n = 96) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i - 0.5) / n) * Math.PI * 2;
      return { x: Math.cos(a) * rx, y: Math.sin(a) * ry };
    });
  const track = makeTrack({
    outer: ring(40, 26),
    inner: ring(30, 16),
    finish: { a: { x: 30, y: 0 }, b: { x: 40, y: 0 }, outerSeg: 0, innerSeg: 0 },
    normal: { x: 0, y: 1 },
    players: 2
  });
  let now = 1_000_000;
  const m = makeRace('r1', 1, anna, now, { laps: 1 }, track);
  joinRace(m, bruno);
  startRace(m, anna.player, now, track);
  const present = () => false,
    brunoAway = id => id === bruno.player;
  // nessuno assente: prima del minuto non succede niente
  assert.equal(advanceRace(m, now + 5000, track, present), false);
  // tocca a Bruno (gli ospiti vanno sulla linea prima), assente: il pilota automatico mette subito la sua auto
  assert.equal(m.seats[m.race.turn], bruno.player);
  assert.equal(advanceRace(m, (now += F1_GAP + 1), track, brunoAway), true);
  assert.equal(m.moves.at(-1).auto, true);
  // Anna mette la sua; in gara Anna sceglie, e per Bruno assente si gioca dopo GAP, senza aspettare il minuto
  const slot = R.placeable({ ...m.race, track })[0];
  playRace(m, anna.player, slot, (now += 1000), track);
  assert.equal(m.phase, 'race');
  const opt = (await import('../f1-server.js')).roundOpts({ ...m.race, track }, 0)[0];
  playRace(m, anna.player, { x: opt.x, y: opt.y }, (now += 500), track);
  assert.equal(advanceRace(m, now + 500, track, brunoAway), false, 'the phones get GAP to animate first');
  const rounds = m.moves.filter(e => e.kind === 'round').length;
  assert.equal(advanceRace(m, (now += F1_GAP + 1), track, brunoAway), true);
  assert.equal(m.moves.filter(e => e.kind === 'round').length, rounds + 1, 'round played at once');
  assert.ok(m.turnAt - now <= 60000 && now < m.turnAt);
  // abbandono: solo a gara partita, chi ha abbandonato non vince mai
  assert.equal(abandonRace(m, bruno.player), true);
  assert.equal(abandonRace(m, bruno.player), false);
  assert.throws(() => abandonRace(m, 'p-other'), /Non sei/);
  for (let i = 0; i < 400 && m.phase !== 'finished'; i++) {
    const free = (await import('../f1-server.js')).roundOpts({ ...m.race, track }, 0);
    if (!m.race.cars[0].crash && !m.pending?.[0]) {
      const safe = free.find(o => !o.crash) || free[0];
      try {
        playRace(m, anna.player, { x: safe.x, y: safe.y }, (now += 100), track);
      } catch {}
    }
    advanceRace(m, (now += F1_GAP + 1), track, id => id === bruno.player);
  }
  assert.equal(m.phase, 'finished');
  assert.ok(!m.winners.some(w => w.id === bruno.player), 'who abandoned does not win');
  assert.ok(F1_AWAY >= 15000);
}

// ---- Biliardo ----
{
  let now = 2_000_000;
  const fresh = () => {
    const m = makeMatch('b1', 1, anna, now, { variant: 'otto', seed: 7 });
    joinMatch(m, bruno);
    startMatch(m, anna.player, now);
    return m;
  };
  const shooterId = m => m.seats[m.match.cur];
  // chi deve tirare è assente da AWAY: tira subito il pilota automatico (dopo GAP dal colpo prima)
  {
    const m = fresh(),
      away = shooterId(m);
    const absence = id => (id === away ? AWAY : 0);
    assert.equal(advanceMatch(m, now + GAP + 1, absence), true);
    assert.equal(m.last.auto, true);
    assert.equal(m.phase, 'playing');
    // assente da troppo (FORFEIT): perde a tavolino, vince chi è rimasto
    const m2 = fresh(),
      leaver = shooterId(m2);
    assert.equal(
      advanceMatch(m2, now + 1000, id => (id === leaver ? FORFEIT : 0)),
      true
    );
    assert.equal(m2.phase, 'finished');
    assert.equal(m2.forfeit, true);
    assert.equal(m2.match.over, true);
    assert.deepEqual(
      m2.winners.map(p => p.id),
      [leaver === anna.player ? bruno.player : anna.player]
    );
    // tutti e due assenti a lungo: nessuno vince a tavolino (non c'è nessuno a reclamare la vittoria)
    const m3 = fresh();
    advanceMatch(m3, now + 1000, () => FORFEIT);
    assert.equal(m3.forfeit, undefined);
  }
  // abbandono: in due, chi abbandona perde subito
  {
    const m = fresh();
    assert.throws(() => abandonMatch(m, 'p-other', now), /Non sei/);
    abandonMatch(m, bruno.player, now);
    assert.equal(m.phase, 'finished');
    assert.deepEqual(
      m.winners.map(p => p.id),
      [anna.player]
    );
    assert.match(m.match.msg, /Bruno/);
  }
}

console.log(
  'PASS Absent players: F1 and Biliardo autopilot at once for who is away, abandon, forfeit to who stays.'
);
