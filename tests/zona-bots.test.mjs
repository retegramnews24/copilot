// Zona Operativa, tappa 3: bot e squadre (zona-bots.js, zona-server.js).
import assert from 'node:assert/strict';
import { ZonaRoom, ZONA, BIT } from '../zona-server.js';
import { createNav, canSee } from '../zona-bots.js';
import { eyeHeight, PLAYER } from '../public/zona/rules.js';

// ---------- finta Durable Object ----------
class FakeSocket {
  constructor() {
    this.readyState = 1;
    this.sent = [];
    this.att = null;
  }
  send(d) {
    this.sent.push(JSON.parse(d));
  }
  serializeAttachment(a) {
    this.att = a;
  }
  deserializeAttachment() {
    return this.att;
  }
  close() {
    this.readyState = 3;
  }
  last(type = 's') {
    return this.sent.filter(m => m.t === type).at(-1);
  }
}
const sockets = [];
const ctx = {
  acceptWebSocket: s => sockets.push(s),
  getWebSockets: () => sockets.filter(s => s.readyState === 1)
};
globalThis.WebSocketPair = class {
  constructor() {
    this[0] = {};
    this[1] = new FakeSocket();
  }
};
const RealResponse = globalThis.Response;
globalThis.Response = class extends RealResponse {
  constructor(body, init = {}) {
    super(body, init.status === 101 ? { status: 200 } : init);
  }
};
let clock = 2_000_000;
const room = new ZonaRoom(ctx, {}, { now: () => clock, autoTick: false, seed: 3 });
const join = (id, name) => {
  const before = sockets.length;
  const res = room.fetch(
    new Request('https://internal/zona/ws', {
      headers: { Upgrade: 'websocket', 'X-Checkmate-User': JSON.stringify({ player: 'tg:' + id, id, name }) }
    })
  );
  assert.equal(res.status, 200);
  return sockets[before];
};
const P = s => room.players.get(s);
const tick = (n = 1) => {
  for (let i = 0; i < n; i++) {
    clock += ZONA.tick;
    room.tick();
  }
};
const inside = p => {
  const b = p.body;
  const h = b.crouch ? PLAYER.crouchHeight : PLAYER.height;
  return room.world
    .near(b.x, b.z, 1)
    .some(
      c =>
        !c.noWalk &&
        b.x + 0.29 > c.min[0] &&
        b.x - 0.29 < c.max[0] &&
        b.z + 0.29 > c.min[2] &&
        b.z - 0.29 < c.max[2] &&
        b.y + h - 0.02 > c.min[1] &&
        b.y + 0.02 < c.max[1]
    );
};

// ---------- mappa dei passaggi ----------
const t0 = Date.now();
const nav = room.nav;
const navMs = Date.now() - t0;
assert.ok(navMs < 3000, 'mappa dei passaggi pronta in ' + navMs + ' ms');
const blu = room.starts.blu[0];
const rossa = room.starts.rossa[0];
const path = nav.path(blu.x, blu.z, rossa.x, rossa.z);
assert.ok(path && path.length > 2, 'da una partenza all’altra c’è una strada');
let prev = { x: blu.x, z: blu.z };
for (const wp of path) {
  assert.ok(nav.clear(prev, wp), 'ogni tratto della strada è libero');
  prev = wp;
}
// nessun punto della strada dentro un muro
for (const wp of path) {
  const y = room.world.height(wp.x, wp.z);
  assert.ok(!inside({ body: { x: wp.x, y: y + 0.45, z: wp.z, crouch: true } }), 'punto libero');
}

// ---------- vista: niente attraverso i muri ----------
let wallSpot = null;
for (const c of room.world.boxes) {
  if (c.noShot || c.max[1] - c.min[1] < 2.6 || c.max[0] - c.min[0] > 1.2 || c.max[2] - c.min[2] < 2) continue;
  const z = (c.min[2] + c.max[2]) / 2;
  const x1 = c.min[0] - 2;
  const x2 = c.max[0] + 2;
  if (nav.ok(x1, z) && nav.ok(x2, z)) {
    wallSpot = { x1, x2, z };
    break;
  }
}
assert.ok(wallSpot);
const body = (x, z, yaw = 0) => ({ body: { x, y: room.world.height(x, z), z, yaw, crouch: false } });
const look = Math.atan2(-(wallSpot.x2 - wallSpot.x1), 0); // verso +x
assert.equal(
  canSee(room.world, body(wallSpot.x1, wallSpot.z, look), body(wallSpot.x2, wallSpot.z)),
  false,
  'il muro nasconde'
);
// in campo aperto si vede, di spalle (lontano) no
let open = null;
for (let x = -40; x <= 40 && !open; x += 2)
  for (let z = -40; z <= 40 && !open; z += 2)
    if (nav.ok(x, z) && nav.ok(x + 15, z) && canSee(room.world, body(x, z, look), body(x + 15, z)))
      open = { x, z };
assert.ok(open, 'due punti a vista a 15 m');
assert.equal(
  canSee(room.world, body(open.x, open.z, look + Math.PI), body(open.x + 15, open.z)),
  false,
  'alle spalle a 15 m no'
);

// ---------- squadre e bot ----------
const a = join(1, 'Anna');
tick();
assert.equal(room.players.size, 1);
assert.equal(room.bots.length, 7, 'da soli: 7 bot');
assert.deepEqual(
  ['blu', 'rossa'].map(t => room.all().filter(p => p.team === t).length),
  [4, 4],
  '4 contro 4'
);
assert.equal(a.last().ph, 'partita', 'con i bot si gioca subito');
assert.equal(a.last().sc.length, 8);
assert.equal(a.last().p.length, 8, 'si vedono tutti');
const b = join(2, 'Bruno');
tick();
assert.equal(room.bots.length, 6, 'in due: 6 bot');
assert.notEqual(P(a).team, P(b).team, 'automatica: uno per squadra');
// Bruno sceglie la squadra di Anna
room.message(b, JSON.stringify({ t: 'squadra', s: P(a).team }));
tick();
assert.equal(P(b).team, P(a).team, 'squadra scelta');
assert.equal(room.all().filter(p => p.team === P(a).team).length, 4, 'la squadra resta di 4: un bot esce');
assert.equal(room.bots.length, 6);
// nella squadra piena non si entra: con 4 persone di là si finisce nell'altra
const full = P(a).team;
const c3 = join(3, 'Carla');
const c4 = join(4, 'Dario');
for (const s of [c3, c4]) room.message(s, JSON.stringify({ t: 'squadra', s: full }));
tick();
const c5 = join(5, 'Elio');
room.message(c5, JSON.stringify({ t: 'squadra', s: full }));
tick();
assert.equal(
  [...room.players.values()].filter(p => p.team === full).length,
  4,
  'al massimo 4 persone per squadra'
);
assert.notEqual(P(c5).team, full);
for (const s of [c3, c4, c5]) {
  s.readyState = 3;
  room.close(s);
}
tick();
assert.equal(room.bots.length, 6, 'chi esce lascia il posto a un bot');

// ---------- niente fuoco amico ----------
const mate = room.bots.find(o => o.team === P(a).team);
const pa = P(a);
for (const p of [pa, mate]) Object.assign(p.body, { vx: 0, vy: 0, vz: 0, onGround: true, yaw: look });
Object.assign(pa.body, { x: open.x, z: open.z, y: room.world.height(open.x, open.z) });
Object.assign(mate.body, { x: open.x + 4, z: open.z, y: room.world.height(open.x + 4, open.z) });
mate.hp = 100;
pa.history = [];
mate.history = [];
const aimAt = { yaw: look, pitch: Math.atan2(mate.body.y + 1.2 - eyeHeight(pa.body), 4) };
for (let i = 0; i < 5; i++) {
  room.message(
    a,
    JSON.stringify({ t: 'in', s: 100 + i, v: clock, c: [[0, 0, BIT.fire, aimAt.yaw, aimAt.pitch, 0]] })
  );
  room.message(
    a,
    JSON.stringify({ t: 'in', s: 200 + i, v: clock, c: [[0, 0, 0, aimAt.yaw, aimAt.pitch, 0]] })
  );
  clock += 300;
}
assert.equal(mate.hp, 100, 'il compagno non si colpisce');

// ---------- una partita con i bot: si muovono, sparano, non entrano nei muri ----------
let shots = 0;
let hits = 0;
let worst = 0;
let insideCount = 0;
const start = room.bots.map(o => ({ o, x: o.body.x, z: o.body.z }));
let maxMove = 0;
for (let i = 0; i < 20 * 90; i++) {
  const t = Date.now();
  // le persone stanno ferme (mandano comandi vuoti)
  for (const s of [a, b])
    room.message(s, JSON.stringify({ t: 'in', s: 1000 + i, v: clock, c: [[0, 0, 0, 0, 0, 0]] }));
  tick();
  worst = Math.max(worst, Date.now() - t);
  const ev = a.last().ev;
  shots += ev.filter(e => e.e === 'spara' && e.id.startsWith('bot:')).length;
  hits += ev.filter(e => e.e === 'colpo' && e.a.startsWith('bot:')).length;
  for (const o of room.bots) if (o.alive && inside(o)) insideCount++;
  for (const s of start)
    if (s.o.alive) maxMove = Math.max(maxMove, Math.hypot(s.o.body.x - s.x, s.o.body.z - s.z));
}
assert.ok(maxMove > 20, 'i bot girano per la mappa: ' + maxMove.toFixed(0) + ' m');
assert.ok(shots > 0, 'i bot sparano: ' + shots);
assert.ok(hits > 0, 'e colpiscono: ' + hits);
assert.equal(insideCount, 0, 'nessun bot dentro un muro');
assert.ok(worst < 200, 'un passo con 6 bot dura al massimo ' + worst + ' ms');
const score = a.last().sq;
assert.ok(score[0] + score[1] > 0, 'ci sono eliminazioni: ' + score.join('-'));

// tutte le persone fuori: via anche i bot
for (const s of [a, b]) {
  s.readyState = 3;
  room.close(s);
}
assert.equal(room.bots.length, 0);
assert.equal(room.timer, null);

console.log(
  `PASS zona-bots: strada tra le partenze, vista che si ferma ai muri, 4 contro 4 con i bot, scelta della squadra, niente fuoco amico; in 90 s ${shots} spari dei bot, ${hits} colpi, punteggio ${score.join('-')}, passo più lento ${worst} ms, mappa dei passaggi ${navMs} ms`
);
