// Zona Operativa, tappa 2: il server della partita online (zona-server.js) con due giocatori finti.
import assert from 'node:assert/strict';
import { ZonaRoom, ZONA, BIT, ARMI } from '../zona-server.js';
import { PLAYER, eyeHeight } from '../public/zona/rules.js';

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
  events() {
    return this.sent.filter(m => m.t === 's').flatMap(m => m.ev);
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
// Response con status 101 non è permessa in Node: basta un oggetto
const RealResponse = globalThis.Response;
globalThis.Response = class extends RealResponse {
  constructor(body, init = {}) {
    super(body, init.status === 101 ? { status: 200 } : init);
    if (init.status === 101) this.webSocket = init.webSocket;
  }
};

let clock = 1_000_000;
const room = new ZonaRoom(ctx, {}, { now: () => clock, autoTick: false, seed: 1 });
const req = (path, id, name) =>
  new Request('https://internal' + path, {
    headers: {
      Upgrade: 'websocket',
      'X-Checkmate-User': JSON.stringify({ player: 'tg:' + id, id, name }),
      'X-Session-Expires': String(clock + 3600_000)
    }
  });
const join = (id, name) => {
  const before = sockets.length;
  const res = room.fetch(req('/zona/ws', id, name));
  assert.equal(res.status, 200);
  return sockets[before];
};
const tick = (n = 1) => {
  for (let i = 0; i < n; i++) {
    clock += ZONA.tick;
    room.tick();
  }
};
const P = s => room.players.get(s);
let seq = 0;
// manda n comandi (1/60 s ciascuno), al ritmo vero: 3 comandi ogni 50 ms
const drive = (s, n, { fwd = 0, side = 0, bits = 0, yaw, pitch = 0, arma = 0 } = {}) => {
  const p = P(s);
  for (let done = 0; done < n; done += 3) {
    const k = Math.min(3, n - done);
    const y = yaw ?? p.body.yaw;
    room.message(
      s,
      JSON.stringify({
        t: 'in',
        s: ++seq,
        v: clock - 100,
        c: Array.from({ length: k }, () => [fwd, side, bits, y, pitch, arma])
      })
    );
    tick();
  }
};
// mette un giocatore in un punto, fermo a terra
const place = (s, x, z, yaw = 0) => {
  const b = P(s).body;
  Object.assign(b, { x, z, y: room.world.height(x, z), vx: 0, vy: 0, vz: 0, yaw, onGround: true });
  P(s).history = [];
};
// angoli per guardare da a verso un punto
const aim = (from, to) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dy = to.y - eyeHeight(from);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
};

// ---------- collegamento ----------
assert.equal(room.fetch(new Request('https://internal/zona/ws')).status, 401, 'senza accesso no');
const a = join(1, 'Anna');
assert.equal(a.last('ciao').id, 'tg:1');
assert.equal(a.last('ciao').items.length, 12, '8 armi e 4 casse mediche a terra');
tick();
assert.equal(a.last().ph, 'attesa', 'da soli si aspetta');
const b = join(2, 'Bruno');
tick();
assert.equal(a.last().ph, 'partita', 'in due parte la partita');
assert.equal(a.last().left, ZONA.match - ZONA.tick, '5 minuti');
assert.equal(a.last().p.length, 2, 'ognuno vede tutti e due');
assert.ok(P(a).alive && P(b).alive && P(a).hp === 100);
const dist0 = Math.hypot(P(a).body.x - P(b).body.x, P(a).body.z - P(b).body.z);
assert.ok(dist0 > 30, 'si rinasce lontano dagli altri: ' + dist0.toFixed(1));

// ---------- colpi ----------
// in campo aperto vicino al centro-est, a 8 m l'uno dall'altro
const spot = { x: 30, z: 30 };
const free = (x, z) =>
  !room.world
    .near(x, z, 0.5)
    .some(c => x + 0.3 > c.min[0] && x - 0.3 < c.max[0] && z + 0.3 > c.min[2] && z - 0.3 < c.max[2]);
// cerca due punti liberi a vista
let found = null;
for (let x = -40; x <= 40 && !found; x += 2)
  for (let z = -40; z <= 40 && !found; z += 2) {
    if (!free(x, z) || !free(x + 8, z)) continue;
    place(a, x, z);
    place(b, x + 8, z);
    const eye = { x, y: eyeHeight(P(a).body), z };
    const tgt = { x: x + 8, y: P(b).body.y + 1.2, z };
    const d = { x: 1, y: (tgt.y - eye.y) / 8, z: 0 };
    const l = Math.hypot(d.x, d.y);
    const wall = room.world.ray(eye, { x: d.x / l, y: d.y / l, z: 0 }, 9);
    if (!wall) found = { x, z };
  }
assert.ok(found, 'due punti a vista');
Object.assign(spot, found);
place(a, spot.x, spot.z);
place(b, spot.x + 8, spot.z);
tick(6); // storia delle posizioni
const toBody = aim(P(a).body, { x: spot.x + 8, y: P(b).body.y + 1.15, z: spot.z });
drive(a, 1, { bits: BIT.fire, ...toBody });
assert.equal(P(b).hp, 75, 'Baretta al corpo: 25');
// il colpo in aria non conta
drive(a, 30, { ...toBody }); // lascia il grilletto e aspetta la cadenza
drive(a, 1, { bits: BIT.fire, yaw: toBody.yaw + 0.5, pitch: 0 });
assert.equal(P(b).hp, 75, 'colpo a vuoto');
// in testa: 100 -> eliminato
drive(a, 30, { ...toBody });
const toHead = aim(P(a).body, { x: spot.x + 8, y: P(b).body.y + 1.62, z: spot.z });
drive(a, 1, { bits: BIT.fire, ...toHead });
assert.equal(P(b).alive, false, 'Baretta in testa elimina');
assert.equal(P(a).kills, 1);
assert.equal(P(b).deaths, 1);
const ev = a.events();
assert.ok(
  ev.some(e => e.e === 'elimina' && e.a === 'tg:1' && e.v === 'tg:2' && e.h),
  'eliminazione con colpo in testa'
);
// rinascita dopo 3 secondi
tick(Math.floor(ZONA.respawn / ZONA.tick) - 2);
assert.equal(P(b).alive, false, 'ancora a terra');
tick(3);
assert.equal(P(b).alive, true, 'rinato');
assert.equal(P(b).hp, 100);

// ---------- dietro un muro il colpo non arriva ----------
// un muro alto: scatola più alta di 2,5 m con spazio libero sui due lati
let wallSpot = null;
for (const c of room.world.boxes) {
  if (c.max[1] - c.min[1] < 2.6 || c.max[0] - c.min[0] > 1.2 || c.max[2] - c.min[2] < 2) continue;
  const z = (c.min[2] + c.max[2]) / 2;
  const x1 = c.min[0] - 2;
  const x2 = c.max[0] + 2;
  if (free(x1, z) && free(x2, z) && Math.abs(room.world.height(x1, z) - room.world.height(x2, z)) < 0.3) {
    wallSpot = { x1, x2, z };
    break;
  }
}
assert.ok(wallSpot, 'trovato un muro');
place(a, wallSpot.x1, wallSpot.z);
place(b, wallSpot.x2, wallSpot.z);
tick(6);
const hpBefore = P(b).hp;
drive(a, 30);
drive(a, 1, { bits: BIT.fire, ...aim(P(a).body, { x: wallSpot.x2, y: P(b).body.y + 1.2, z: wallSpot.z }) });
assert.equal(P(b).hp, hpBefore, 'il muro ferma il colpo');

// ---------- ritorno indietro: al massimo 0,2 s ----------
place(a, spot.x, spot.z);
place(b, spot.x + 8, spot.z);
const old = { x: spot.x + 8, z: spot.z };
const aimOld = aim(P(a).body, { x: old.x, y: P(b).body.y + 1.15, z: old.z });
drive(a, 30, aimOld); // pronto a sparare
place(b, spot.x + 8, spot.z);
tick(8);
// Bruno era lì; ora si sposta di lato di 2 m (fuori dal punto di mira) da 0,1 s
P(b).body.z = spot.z + 2;
clock += 100;
room.tick();
// chi spara vedeva Bruno 0,16 s fa: colpito
let hp = P(b).hp;
room.message(
  a,
  JSON.stringify({ t: 'in', s: ++seq, v: clock - 160, c: [[0, 0, BIT.fire, aimOld.yaw, aimOld.pitch, 0]] })
);
assert.ok(P(b).hp < hp, 'col ritorno indietro si colpisce dove si vedeva');
// troppo indietro (1 s): il server non va oltre 0,2 s e Bruno non c'era più
tick(10);
hp = P(b).hp;
drive(a, 30, aimOld);
room.message(
  a,
  JSON.stringify({ t: 'in', s: ++seq, v: clock - 1000, c: [[0, 0, BIT.fire, aimOld.yaw, aimOld.pitch, 0]] })
);
assert.equal(P(b).hp, hp, 'non oltre 0,2 s');

// ---------- tasti impossibili: troppo veloce ----------
place(a, spot.x, spot.z, -Math.PI / 2);
tick(1);
const x0 = P(a).body.x;
// 600 comandi (10 secondi di corsa) in un messaggio solo, senza che passi tempo: quasi tutti scartati
for (let i = 0; i < 30; i++)
  room.message(
    a,
    JSON.stringify({
      t: 'in',
      s: ++seq,
      v: clock,
      c: Array.from({ length: 20 }, () => [1, 0, 0, -Math.PI / 2, 0, 0])
    })
  );
const moved = Math.abs(P(a).body.x - x0);
assert.ok(
  moved < PLAYER.run * 0.35,
  'troppi comandi tutti insieme: spostato solo ' + moved.toFixed(2) + ' m'
);
assert.equal(a.last().ack <= seq, true);
tick(1);
assert.equal(a.last().ack, seq, 'il server conferma l’ultimo comando visto');
// numeri strani: niente NaN
room.message(a, JSON.stringify({ t: 'in', s: ++seq, c: [[1e9, 'x', 'y', null, 1e9, 99]] }));
assert.ok(Number.isFinite(P(a).body.x) && Number.isFinite(P(a).body.yaw));
// attraverso i muri non si passa: si corre contro il muro per 3 s
place(a, wallSpot.x1, wallSpot.z, -Math.PI / 2); // yaw -90°: avanti = +x, verso il muro
tick(1);
drive(a, 180, { fwd: 1, yaw: -Math.PI / 2 });
assert.ok(P(a).body.x < wallSpot.x1 + 2, 'fermato dal muro: x ' + P(a).body.x.toFixed(2));

// ---------- armi a terra ----------
const item = room.items.find(i => i.kind === 'ruggito');
place(a, item.x, item.z);
P(a).body.y = item.y;
tick(1);
drive(a, 1, { bits: BIT.take });
assert.equal(P(a).current, 'ruggito', 'preso il Ruggito');
assert.ok(item.readyAt > clock, 'sparito da terra');
assert.ok(a.last().it.includes(room.items.indexOf(item)), 'gli altri lo vedono sparire');
const taken = clock;
tick(Math.ceil(ZONA.weaponBack / ZONA.tick) + 1);
assert.ok(
  clock - taken > ZONA.weaponBack && !a.last().it.includes(room.items.indexOf(item)),
  'torna dopo 20 s'
);
// cambio d'arma: il server accetta solo armi che si hanno
drive(a, 1, { arma: ARMI.indexOf('falco') });
assert.equal(P(a).current, 'ruggito', 'il Falco non ce l’ha');
drive(a, 1, { arma: ARMI.indexOf('coltello') });
assert.equal(P(a).current, 'coltello');

// ---------- casse mediche ----------
const med = room.items.find(i => i.kind === 'cassa_medica');
P(b).hp = 30;
place(b, med.x + 0.3, med.z);
tick(1);
drive(b, 1);
assert.equal(P(b).hp, 80, 'cassa medica +50');
assert.ok(med.readyAt > clock);
drive(b, 1);
assert.equal(P(b).hp, 80, 'una volta sola');

// ---------- fine partita ----------
P(a).kills = 3;
P(b).kills = 1;
clock = room.endsAt + 1;
room.tick();
const end = a.last();
assert.equal(end.ph, 'fine');
const fine = a.events().find(e => e.e === 'fine');
assert.equal(fine.r.winner, 'tg:1', 'vince chi ha più eliminazioni');
assert.deepEqual(
  fine.r.rows.map(r => [r.name, r.kills]),
  [
    ['Anna', 3],
    ['Bruno', 1]
  ]
);
// durante la classifica non ci si muove
const xf = P(a).body.x;
drive(a, 6, { fwd: 1 });
assert.equal(P(a).body.x, xf);
// poi ne comincia un'altra, da zero
clock += ZONA.results;
room.tick();
assert.equal(a.last().ph, 'partita');
assert.equal(P(a).kills, 0);

// ---------- uscite ----------
b.readyState = 3;
room.close(b);
tick(1);
assert.equal(a.last().ph, 'attesa', 'da soli si torna ad aspettare');
// la stessa persona da un'altra finestra prende il posto del vecchio collegamento
const a2 = join(1, 'Anna');
assert.equal(a.readyState, 3, 'il vecchio collegamento si chiude');
assert.equal(room.players.size, 1);
a2.readyState = 3;
room.close(a2);
assert.equal(room.players.size, 0);
// tutti fuori: niente passi
assert.equal(room.timer, null);

// dopo un risveglio (memoria vuota) i giocatori si rifanno dai collegamenti aperti
const c = join(3, 'Carla');
const fresh = new ZonaRoom(ctx, {}, { now: () => clock, autoTick: false });
fresh.message(c, JSON.stringify({ t: 'in', s: 1, c: [[0, 0, 0, 0, 0, 0]] }));
assert.equal(fresh.players.size, 1, 'ricostruito');

console.log(
  'PASS zona-server: collegamento, colpi, muri, ritorno indietro, comandi impossibili, armi a terra, casse, fine partita'
);
