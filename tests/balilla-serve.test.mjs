// Calcio balilla al tavolo del bar: la pallina esce dal buco quando la chiede chiunque sia seduto (Spazio da PC, tocco al
// centro da telefono), anche dopo un gol; da soli i punti non contano; il punteggio non si azzera a metà.
import assert from 'node:assert/strict';
import { BalillaHub } from '../balilla-hub.js';
import { L } from '../public/lobby3d/balilla-rules.js';

const hub = new BalillaHub();
const player = id => ({
  id,
  send(raw) {
    this.state = JSON.parse(raw);
  }
});
const a = player('a'),
  b = player('b');
const send = (who, action, data = {}) => hub.message(who, who.id, { action, ...data });
const join = (who, slot) => {
  send(who, 'watch');
  send(who, 'join', { mode: 2, slot, target: 10, bar: true });
};
try {
  // da soli: la pallina esce con «ready», un gol non conta
  join(a, 0);
  assert.equal(hub.field.practice, true);
  send(a, 'ready', { pair: 1 });
  assert.equal(hub.field.phase, 'play', 'alone: the ball comes out');
  Object.assign(hub.field.ball, { x: L + 0.03, z: 0, vx: 1, vz: 0 });
  hub.field.phase = 'play';
  // un passo di simulazione come fa il server
  const { simulate } = await import('../public/lobby3d/balilla-rules.js');
  simulate(hub.field, 0.01);
  assert.deepEqual(hub.field.score, [0, 0], 'alone: no points');

  // in due: i punti contano; dopo il gol la pallina la fa uscire anche chi ha segnato
  join(b, 2);
  assert.equal(hub.field.practice, false);
  hub.field.phase = 'play';
  Object.assign(hub.field.ball, { x: L + 0.03, z: 0, vx: 1, vz: 0 });
  simulate(hub.field, 0.01);
  assert.deepEqual(hub.field.score, [1, 0], 'two at the table: the goal counts');
  simulate(hub.field, 2); // fine della pausa del gol: pallina nel buco
  assert.equal(hub.field.phase, 'throw');
  const scorer = hub.field.thrower === 0 ? b : a; // rimette chi ha subito: chiede l'altro
  send(scorer, 'ready', { pair: 1 });
  assert.equal(hub.field.phase, 'play', 'the scorer can bring the ball out too');

  // niente azzeramento a metà partita
  send(a, 'reset');
  assert.deepEqual(hub.field.score, [1, 0], 'reset is ignored');
} finally {
  hub.stop();
}
console.log('PASS Balilla serve: anyone seated brings the ball out, no points alone, no reset.');
