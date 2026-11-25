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

  // 2 contro 1: chi arriva dal lato già occupato prende il secondo posto di quel lato, con la sua coppia di aste
  const c = player('c');
  join(c, 0);
  const sc = hub.viewers.get(c).slot;
  assert.equal(sc, 1, 'second player on the red side');
  assert.equal(c.state.occupied.length, 3);
  assert.equal(hub.field.practice, false);
  // c muove: si muove solo la sua coppia (attacco), la difesa di a non viene bloccata
  send(a, 'input', { pair: 1, slide: 0.5, angle: 0 }); // a chiede l'attacco ma col compagno comanda la difesa
  send(c, 'input', { pair: 0, slide: -0.5, angle: 0 }); // c chiede la difesa ma comanda l'attacco
  const { rows } = await import('../public/lobby3d/balilla-rules.js');
  const rod = (team, attack) => hub.field.rods[rows.findIndex(r => r.team === team && r.attack === attack)];
  assert.equal(rod(0, 0).tShift, 0.5, 'a (first seat) has the defence');
  assert.equal(rod(0, 1).tShift, -0.5, 'c (second seat) has the attack');

  // 2 contro 2
  const d = player('d');
  join(d, 2);
  assert.equal(hub.viewers.get(d).slot, 3);
  // un quarto/quinto dallo stesso lato non trova posto
  const e = player('e');
  join(e, 2);
  assert.equal(hub.viewers.get(e).slot, -1, 'side full');

  // chi va via non cambia la partita; tutti via dal lato blu: allenamento, punteggio fermo ma non azzerato
  send(b, 'leave');
  send(d, 'leave');
  assert.equal(hub.field.practice, true);
  assert.deepEqual(hub.field.score, [1, 0], 'score kept while one side is empty');
  join(d, 2);
  assert.equal(hub.field.practice, false, 'points count again');
  assert.deepEqual(hub.field.score, [1, 0]);
} finally {
  hub.stop();
}
console.log('PASS Balilla serve: anyone seated brings the ball out, no points alone, no reset.');
