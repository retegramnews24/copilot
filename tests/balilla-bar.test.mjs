import test from 'node:test';
import assert from 'node:assert/strict';
import { BalillaHub } from '../balilla-hub.js';
import { L, W, R, rows, control, newField, simulate, cornerHeight } from '../public/lobby3d/balilla-rules.js';

test('Le quattro rampe fanno uscire una pallina ferma', () => {
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const f = newField();
      f.phase = 'play';
      Object.assign(f.ball, { x: x * (L - R), z: z * (W - R) });
      assert.ok(cornerHeight(f.ball.x, f.ball.z) > 0);
      simulate(f, 0.55);
      assert.equal(cornerHeight(f.ball.x, f.ball.z), 0);
      assert.ok(f.ball.vx * x < 0 && f.ball.vz * z < 0);
    }
});

test('Ingresso libero, rimessa manuale, cambio aste e segnapunti condiviso', t => {
  const hub = new BalillaHub();
  t.after(() => hub.stop());
  const player = id => ({
    id,
    send(raw) {
      this.state = JSON.parse(raw);
    }
  });
  const a = player('a'),
    b = player('b');
  const send = (who, action, data = {}) => hub.message(who, who.id, { action, ...data });
  function join(who, slot) {
    send(who, 'watch');
    send(who, 'join', { mode: 2, slot, target: 10, bar: true });
  }
  function score() {
    Object.assign(hub.field.ball, { x: L + 0.016, z: 0, vx: 1, vz: 0 });
    hub.field.phase = 'play';
    simulate(hub.field, 0.008);
  }
  join(a, 0);
  simulate(hub.field, 5);
  assert.equal(hub.field.phase, 'throw');
  send(a, 'ready');
  assert.equal(hub.field.phase, 'play');
  send(a, 'input', { pair: 0, slide: 0.9, angle: Math.PI });
  simulate(hub.field, 0.025);
  send(a, 'input', { pair: 1, slide: -0.8, angle: -Math.PI });
  const defense = hub.field.rods[0];
  const saved = [defense.shift, defense.angle];
  simulate(hub.field, 0.35);
  assert.deepEqual([defense.shift, defense.angle], saved);
  assert.equal(hub.field.rods[3].angle, -Math.PI);
  rows.forEach((row, i) => {
    if (row.team === 1) assert.equal(hub.field.rods[i].shift, 0);
  });
  score();
  assert.deepEqual(hub.field.score, [0, 0]);
  join(b, 2);
  score();
  hub.broadcast();
  assert.deepEqual(a.state.field.score, [1, 0]);
  assert.deepEqual(b.state.field.score, [1, 0]);
  hub.leave(a);
  assert.equal(hub.field.practice, true);
  assert.equal(b.state.playing, true);
});

test('Il tocco lento imprime meno velocità di un tiro rapido', () => {
  function shot(angle) {
    const field = newField();
    field.phase = 'play';
    Object.assign(field.ball, { x: rows[0].x + R + 0.0111, z: 0 });
    control(field, 0, 0, 0, angle);
    simulate(field, 0.02);
    return field.ball.vx;
  }
  const soft = shot(0.012);
  const hard = shot(0.9);
  assert.ok(soft > 0 && soft < 0.15);
  assert.ok(hard > 0.8 && hard > soft * 5);
});
