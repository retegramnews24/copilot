// Casi limite della fisica trovati da Fable (analisi, area 4): ognuno resta controllato da qui in poi.
import assert from 'node:assert/strict';
import * as F from '../public/flipper/physics.js';
import * as E from '../public/biliardo/engine.js';
import { L, R, GOAL, newField, simulate, HOLD_MAX } from '../public/lobby3d/balilla-rules.js';

// Flipper Grand Prix (G2): leva lasciata a forza zero → la pallina entra in campo, non resta sul cancelletto
for (const force of [0, 0.001, 0.3, 1]) {
  const g = F.newGame();
  F.drag(g, force);
  F.pull(g, false);
  let field = false;
  for (let i = 0; i < 1200 && !field; i++) {
    F.simulate(g, 1 / 120);
    field = g.balls.some(b => b.x < F.LANE_X - 0.02);
  }
  assert.ok(field, 'launch at force ' + force + ' reaches the field');
}

// Flipper (G7): una pallina sulla rampa passa sopra quella del piano senza spostarla
{
  const plane = { x: 0.2, y: 0.6, vx: 0, vy: 0, held: 0, lap: 0 };
  const alone = F.newGame(),
    both = F.newGame();
  alone.balls = [{ ...plane }];
  both.balls = [{ ...plane }, { ...plane, x: plane.x + 0.005, ramp: { s: 0.3, v: 0 } }];
  F.simulate(alone, 1 / 600);
  F.simulate(both, 1 / 600);
  assert.ok(
    Math.abs(alone.balls[0].x - both.balls[0].x) < 1e-6 &&
      Math.abs(alone.balls[0].y - both.balls[0].y) < 1e-6,
    'ball on the playfield not pushed by the one on the ramp'
  );
}

// Biliardo, snooker (G1): bianca in mano nella D mai dentro un'altra bilia
{
  const m = E.newGame('snooker', [{ name: 'A' }, { name: 'B' }], { seed: 3, reds: 6 });
  const T = E.tableOf(m),
    bx = E.baulkX(T),
    red = m.balls.find(b => b.id !== 0 && b.on);
  Object.assign(red, { x: bx - 0.12, z: 0 }); // proprio sul punto dove prima andava sempre la bianca
  E.placeInD(m);
  const c = m.balls[0];
  for (const b of m.balls)
    if (b.on && b.id !== 0)
      assert.ok(Math.hypot(b.x - c.x, b.z - c.z) >= b.r + c.r, 'cue ball not inside ball ' + b.id);
  assert.equal(m.inHand, 'D');
  assert.ok(E.canPlace(m, c.x, c.z), 'inside the D, on a free spot');
}

// Biliardo (G6): direzione esattamente di traverso (dx = 0) → la bilia parte di traverso, non a 45 gradi
{
  const m = E.newGame('otto', [{ name: 'A' }, { name: 'B' }], { seed: 1 });
  const b = E.beginShot(m, { dx: 0, dz: 1, speed: 1 });
  assert.ok(Math.abs(b.vx) < 0.05 && b.vz > 0.9, 'straight across: ' + b.vx + ', ' + b.vz);
}

// Calcio balilla (G5): palla lenta che supera la riga di porta → gol
{
  const f = newField({}, () => 0);
  f.phase = 'play';
  Object.assign(f.ball, { x: L - R, z: 0, vx: 0.12, vz: 0 });
  simulate(f, 3, () => 0.5);
  assert.deepEqual(f.score, [1, 0], 'slow ball over the line is a goal');
}

// Calcio balilla (G3): palla ferma che arriva a una sola squadra → dopo HOLD_MAX secondi rimette l'altra squadra
{
  let found = null;
  for (let x = -L + 0.05; x < L - 0.05 && !found; x += 0.01) {
    const f = newField({}, () => 0);
    f.phase = 'play';
    f.lastThrower = 0;
    Object.assign(f.ball, { x, z: GOAL * 2, vx: 0, vz: 0 });
    simulate(f, HOLD_MAX - 1, () => 0.5);
    if (f.phase !== 'play') continue; // irraggiungibile (si rimette subito) o raggiunta da tutte e due
    simulate(f, 2, () => 0.5);
    if (f.phase === 'throw') found = { x, thrower: f.thrower };
  }
  assert.ok(found, 'a ball held still by one team is given to the other after HOLD_MAX seconds');
}

console.log(
  'PASS Physics edges: flipper gate and ramp, snooker cue ball in the D, straight-across shot, slow goal, possession limit.'
);
