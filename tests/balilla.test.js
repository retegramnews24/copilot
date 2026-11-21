// Calcio balilla della Lobby 3D (docs/balilla.md): rimessa dal foro, tiro fino a 6,5 m/s, palla fermata sotto il piede
// e trascinata, rullata impossibile, gol e formati (5/8/10, al meglio di 3), palla morta, computer che si adatta,
// server: posti, partenza, rimessa, cambio campo nel 2 contro 2, messaggi compatti, posti dopo l'ibernazione.
import assert from 'node:assert/strict';
import * as B from '../public/lobby3d/balilla-rules.js';
import { createAI, adapt } from '../public/lobby3d/balilla-ai.js';
import { BalillaHub, publicField } from '../balilla-hub.js';

const run = (f, s, random) => {
  for (let k = 0; k < s * 120 && !f.finished; k++) B.simulate(f, 1 / 120, random);
};

// --- rimessa: la palla aspetta nel foro di chi rimette, poi entra e rotola verso il centro
{
  const f = B.newField({ target: 8 }, () => 0.2);
  assert.equal(f.thrower, 0);
  assert.equal(f.phase, 'throw');
  assert.ok(f.ball.z > B.W, 'palla nel foro dei rossi');
  assert.ok(B.throwIn(f, () => 0.5));
  assert.equal(f.phase, 'play');
  assert.ok(f.ball.vz < 0, 'rotola verso il centro');
  assert.equal(B.throwIn(f), false, 'rimessa solo quando tocca');
  // se nessuno rimette, dopo 4 secondi entra da sola
  const g = B.newField({}, () => 0.9);
  run(g, 4.2);
  assert.equal(g.phase, 'play');
}

// --- tiro, palla fermata sotto il piede, trascinata e tirata
{
  const f = B.newField({}, () => 0.2);
  B.throwIn(f);
  const i = 5,
    row = B.rows[i],
    rod = f.rods[i];
  rod.angle = rod.tAngle = 0.5;
  rod.tShift = 0.6;
  rod.shift = 0.6 * row.travel;
  Object.assign(f.ball, { x: row.x + 0.06, z: B.figureZ(row, 2, rod.shift), vx: -0.3, vz: 0 });
  run(f, 0.3);
  assert.ok(rod.pin, 'palla ferma sotto il piede');
  rod.tShift = -0.2;
  run(f, 0.2);
  assert.ok(rod.pin && Math.abs(f.ball.z - B.figureZ(row, 2, rod.shift)) < 0.02, 'la palla segue il piede');
  rod.tAngle = -1;
  run(f, 0.1);
  rod.tAngle = 1.4;
  let top = 0;
  for (let k = 0; k < 30; k++) {
    B.simulate(f, 1 / 120);
    top = Math.max(top, Math.hypot(f.ball.vx, f.ball.vz));
  }
  assert.ok(top > 4 && top <= 6.51, 'tiro forte ma realistico, al massimo 6,5 m/s: ' + top);
}

// --- rullata impossibile: l'asta non supera mai il limite, qualunque comando arrivi
{
  const f = B.newField();
  B.control(f, 0, null, 0, 99);
  run(f, 0.5);
  assert.ok(f.rods.every(r => Math.abs(r.angle) <= B.MAX_ANGLE + 1e-9));
  assert.equal(f.rods[0].angle, B.MAX_ANGLE);
  // figure alzate: la palla passa sotto
  const g = B.newField();
  B.throwIn(g);
  B.control(g, 1, null, 0, -1.5);
  run(g, 0.2);
  Object.assign(g.ball, { x: 0.26, z: 0.0, vx: 1.5, vz: 0 }); // davanti all'attacco rosso
  let passed = false;
  for (let k = 0; k < 120 && g.phase === 'play'; k++) {
    B.simulate(g, 1 / 120);
    if (g.ball.x > B.rows[6].x + 0.05) passed = true;
  }
  assert.ok(passed || g.score[0] === 1, 'palla passata sotto le figure alzate');
}

// --- gol, rimessa a chi ha subito, fine partita e al meglio di 3
{
  const f = B.newField({ target: 5, bestOf: 3 }, () => 0.2);
  B.throwIn(f);
  const shoot = () => {
    f.phase = 'play';
    Object.assign(f.ball, { x: 0.45, z: 0.06, vx: 1.5, vz: 0 });
    for (let k = 0; k < 120 && f.phase === 'play'; k++) B.simulate(f, 1 / 120);
  };
  shoot();
  assert.deepEqual(f.score, [1, 0]);
  assert.equal(f.phase, 'goal');
  run(f, 1.5);
  assert.equal(f.phase, 'throw');
  assert.equal(f.thrower, 1, 'rimette chi ha subito');
  for (let n = 0; n < 4; n++) shoot();
  assert.deepEqual(f.games, [1, 0]);
  assert.equal(f.phase, 'over');
  run(f, 3.2);
  assert.deepEqual(f.score, [0, 0]);
  assert.equal(f.gameNo, 2);
  assert.equal(f.swap, 1);
  for (let n = 0; n < 5; n++) shoot();
  assert.equal(f.finished, true);
  assert.equal(f.phase, 'match');
  assert.deepEqual(f.games, [2, 0]);
  // formati: solo 5, 8 o 10 gol
  assert.equal(B.newField({ target: 7 }).target, 5);
  assert.equal(B.newField({ target: 10, bestOf: 2 }).bestOf, 1);
}

// --- palla ferma dove nessuno arriva: si rimette dal foro
{
  const f = B.newField({}, () => 0.9);
  B.throwIn(f);
  Object.assign(f.ball, { x: -0.45, z: 0.335, vx: 0, vz: 0 }); // tra portiere e difesa, vicino alla sponda
  run(f, 2);
  assert.equal(f.phase, 'throw');
  assert.equal(f.thrower, 1, 'rimette chi aveva rimesso');
}

// --- computer: gioca, la partita finisce, il più bravo vince; il livello si adatta
{
  let s = 3;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const old = Math.random;
  Math.random = random;
  const f = B.newField({ target: 5 }, random);
  const strong = createAI(0, 0.95),
    weak = createAI(1, 0.15);
  for (let k = 0; k < 120 * 240 && !f.finished; k++) {
    strong.step(f, 1 / 120);
    weak.step(f, 1 / 120);
    B.simulate(f, 1 / 120, random);
  }
  Math.random = old;
  assert.equal(f.finished, true, 'partita finita in 4 minuti');
  assert.ok(f.score[0] > f.score[1], 'vince il più bravo: ' + f.score);
  assert.ok(adapt(0.5, true) > 0.5 && adapt(0.5, false) < 0.5);
  assert.equal(adapt(1, true), 1);
}

// --- server
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
    b = socket('2');
  const hub = new BalillaHub({ getWebSockets: () => [a, b] });
  hub.message(a, '1', { action: 'join', slot: 0, mode: 2 });
  assert.equal(a.sent.length, 0, 'senza "watch" non succede niente');
  hub.message(a, '1', { action: 'watch' });
  assert.deepEqual(Object.keys(last(a).field.rods[0]), ['shift', 'angle'], 'campo compatto');
  hub.message(a, '1', { action: 'join', slot: 0, mode: 2, target: 8, bestOf: 3 });
  assert.equal(last(a).slot, 0);
  assert.equal(last(a).field.target, 8);
  assert.equal(a.att.balilla.target, 8, 'formato scritto nella connessione');
  // tavolo occupato da una partita sul telefono: online non ci si siede
  hub.message(b, '2', { action: 'watch' });
  hub.message(b, '2', { action: 'local', on: true });
  assert.equal(hub.busy(), false, 'con qualcuno seduto online la partita sul telefono non parte');
  hub.message(b, '2', { action: 'join', slot: 2, mode: 2 });
  assert.equal(last(b).playing, true, 'parte con due giocatori');
  hub.stop();
  // rimessa: solo chi deve rimettere
  const thrower = hub.field.thrower;
  const other = thrower === 0 ? b : a,
    mine = thrower === 0 ? a : b;
  hub.timer = 1;
  hub.message(other, '?', { action: 'ready' });
  assert.equal(hub.field.phase, 'throw');
  hub.message(mine, '?', { action: 'ready' });
  assert.equal(hub.field.phase, 'play');
  hub.timer = null;
  // comandi: la coppia scelta della propria squadra
  hub.message(a, '1', { action: 'input', slide: 0.5, angle: 9, pair: 0 });
  assert.equal(hub.field.rods[0].tShift, 0.5);
  assert.equal(hub.field.rods[0].tAngle, B.MAX_ANGLE);
  assert.equal(hub.field.rods[3].tAngle, 0, 'l\'altra coppia non cambia');
  // niente invii uguali di fila
  hub.broadcast();
  const n = a.sent.length;
  hub.broadcast();
  assert.equal(a.sent.length, n);
  hub.leave(b);
  assert.equal(b.att.balilla, null);
  assert.deepEqual(last(a).occupied, [0]);
}
// cambio campo nel 2 contro 2: tutti passano dall'altra parte e le partite vinte li seguono
{
  const s = [1, 2, 3, 4].map(n => socket(String(n)));
  const hub = new BalillaHub({ getWebSockets: () => s });
  s.forEach((ws, i) => {
    hub.message(ws, String(i + 1), { action: 'watch' });
    hub.message(ws, String(i + 1), { action: 'join', slot: i, mode: 4, target: 5, bestOf: 3 });
  });
  hub.stop();
  hub.field.games = [1, 0];
  hub.changeSides();
  assert.deepEqual(
    s.map(ws => hub.viewers.get(ws).slot),
    [2, 3, 0, 1]
  );
  assert.deepEqual(hub.field.games, [0, 1]);
  assert.equal(s[0].att.balilla.slot, 2);
}
// ibernazione: chi era seduto in attesa ritrova il posto
{
  const a = socket('1'),
    c = socket('3');
  a.att.balilla = { slot: 0, mode: 4, target: 10, bestOf: 1 };
  c.att.balilla = { slot: -1, mode: 4 };
  const hub = new BalillaHub({ getWebSockets: () => [a, c] });
  hub.message(c, '3', { action: 'watch' });
  assert.equal(hub.mode, 4);
  assert.equal(hub.field.target, 10);
  assert.deepEqual(last(c).occupied, [0]);
  hub.message(c, '3', { action: 'join', slot: 0, mode: 4 });
  assert.equal(last(c).slot, -1, 'il posto ritrovato non si ruba');
}
assert.ok('phase' in publicField(B.newField()) && 'vx' in publicField(B.newField()).ball);

console.log(
  'PASS Calcio balilla: rimessa dal foro, tiro, palla sotto il piede, rullata impossibile, gol e formati, palla morta, computer, server, cambio campo, ibernazione.'
);
