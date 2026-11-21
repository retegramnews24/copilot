// Calcio balilla della Lobby 3D: regole (gol, sponde), posti al tavolo, partenza, messaggi compatti,
// niente invii uguali di fila e posti ritrovati dopo l'ibernazione del server.
import assert from 'node:assert/strict';
import { newField, simulate, rows } from '../public/lobby3d/balilla-rules.js';
import { BalillaHub, publicField } from '../balilla-hub.js';

// --- regole: un tiro dritto verso la porta blu fa gol ai rossi
{
  const f = newField();
  f.restart = '';
  f.hold = 0;
  Object.assign(f.ball, { x: 0.42, z: 0.06, vx: 1.2, vz: 0 }); // accanto al portiere
  for (let i = 0; i < 240 && !f.score[0]; i++) simulate(f, 1 / 120);
  assert.deepEqual(f.score, [1, 0], 'gol dei rossi');
  assert.equal(f.restart, 'announce', 'dopo il gol si riparte con la battuta');
  assert.equal(f.finished, false);
  // la palla contro la sponda laterale torna indietro
  const g = newField();
  g.restart = '';
  g.hold = 0;
  Object.assign(g.ball, { x: 0.3, z: 0.3, vx: 0, vz: 0.8 });
  for (let i = 0; i < 30; i++) simulate(g, 1 / 120);
  assert.ok(g.ball.vz < 0, 'rimbalzo sulla sponda');
  // a 8 gol la partita è finita
  const h = newField();
  h.score = [7, 0];
  h.restart = '';
  h.hold = 0;
  Object.assign(h.ball, { x: 0.42, z: -0.06, vx: 1.5, vz: 0 });
  for (let i = 0; i < 240 && !h.finished; i++) simulate(h, 1 / 120);
  assert.equal(h.finished, true);
}

// --- connessioni finte, come quelle del server della Lobby
function socket(memberId) {
  return {
    sent: [],
    att: { kind: 'lobby', memberId, inClub: true, closed: false },
    send(text) {
      this.sent.push(JSON.parse(text));
    },
    deserializeAttachment() {
      return structuredClone(this.att);
    },
    serializeAttachment(a) {
      this.att = structuredClone(a);
    }
  };
}
const last = ws => ws.sent[ws.sent.length - 1];

{
  const a = socket('1'),
    b = socket('2'),
    c = socket('3');
  const hub = new BalillaHub({ getWebSockets: () => [a, b, c] });
  // senza "watch" non succede niente
  hub.message(a, '1', { action: 'join', slot: 0, mode: 2 });
  assert.equal(a.sent.length, 0);
  hub.message(a, '1', { action: 'watch' });
  assert.equal(last(a).slot, -1);
  assert.deepEqual(last(a).occupied, []);
  // il campo mandato è compatto: niente comandi delle aste, numeri arrotondati
  assert.deepEqual(Object.keys(last(a).field.rods[0]), ['shift', 'angle']);
  assert.equal(last(a).field.rods.length, rows.length);
  hub.message(a, '1', { action: 'join', slot: 0, mode: 2 });
  assert.equal(last(a).slot, 0);
  assert.deepEqual(a.att.balilla, { slot: 0, mode: 2 }, 'il posto è scritto nella connessione');
  // posto dispari in 1 contro 1 o già preso: rifiutato
  hub.message(b, '2', { action: 'watch' });
  hub.message(b, '2', { action: 'join', slot: 1, mode: 2 });
  hub.message(b, '2', { action: 'join', slot: 0, mode: 2 });
  assert.equal(last(b).slot, -1);
  // la stessa persona non può sedersi due volte
  const a2 = socket('1');
  hub.message(a2, '1', { action: 'watch' });
  hub.message(a2, '1', { action: 'join', slot: 2, mode: 2 });
  assert.equal(last(a2).slot, -1);
  hub.leave(a2);
  // il secondo giocatore fa partire la partita
  hub.message(b, '2', { action: 'join', slot: 2, mode: 2 });
  assert.equal(last(b).playing, true);
  hub.stop();
  // se non cambia niente non si manda di nuovo lo stesso campo
  hub.broadcast();
  const before = a.sent.length;
  hub.broadcast();
  assert.equal(a.sent.length, before, 'nessun invio uguale di fila');
  hub.field.ball.x += 0.01;
  hub.broadcast();
  assert.equal(a.sent.length, before + 1);
  // chi esce libera il posto e la connessione non lo ricorda più
  hub.leave(b);
  assert.equal(b.att.balilla, null);
  assert.deepEqual(last(a).occupied, [0]);
}

// --- ibernazione: un server nuovo ritrova chi era seduto (in attesa dell'avversario) dalle connessioni
{
  const a = socket('1'),
    c = socket('3');
  a.att.balilla = { slot: 0, mode: 4 };
  c.att.balilla = { slot: -1, mode: 4 };
  const hub = new BalillaHub({ getWebSockets: () => [a, c] });
  hub.message(c, '3', { action: 'watch' });
  assert.equal(hub.mode, 4, 'modo 2 contro 2 ritrovato');
  assert.deepEqual(last(c).occupied, [0], 'il posto di chi era seduto è ancora suo');
  hub.message(c, '3', { action: 'join', slot: 0, mode: 4 });
  assert.equal(last(c).slot, -1, 'il posto ritrovato non si può rubare');
  // connessioni chiuse o fuori dal club non tornano
  const d = socket('4');
  d.att.closed = true;
  d.att.balilla = { slot: 1, mode: 4 };
  const hub2 = new BalillaHub({ getWebSockets: () => [d] });
  hub2.restore();
  assert.equal(hub2.viewers.size, 0);
}

assert.deepEqual(Object.keys(publicField(newField())).sort(), [
  'ball',
  'defence',
  'finished',
  'hit',
  'restart',
  'rods',
  'score',
  'serve',
  'sound'
]);

console.log(
  'PASS Calcio balilla: gol, sponde, fine a 8, posti, partenza, campo compatto, niente invii doppi, posti dopo ibernazione.'
);
