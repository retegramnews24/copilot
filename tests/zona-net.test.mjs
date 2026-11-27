// Zona Operativa, tappa 2: previsione e correzione (public/zona/net.js) contro il server vero (zona-server.js), con
// 60 ms di ritardo di rete finto per parte. Il telefono deve finire dove lo mette il server, senza scatti.
import assert from 'node:assert/strict';
import { ZonaRoom, ZONA } from '../zona-server.js';
import { makeWorld, newBody } from '../public/zona/rules.js';
import { BOXES, GROUND } from '../public/zona/map-deserto.js';

// ---------- finta pagina: parent, postMessage, orologio ----------
let now = 5_000_000; // ms, uguale per server e telefono (il telefono stima la differenza da solo)
const LAG = 60;
const queue = []; // {at, fn}
const later = (fn, ms = LAG) => queue.push({ at: now + ms, fn });
const listeners = [];
const parentWin = {
  postMessage(d) {
    if (d.type === 'zona:send') later(() => room.message(socket, d.data));
  }
};
globalThis.parent = parentWin;
globalThis.window = {};
globalThis.location = { origin: 'https://app' };
globalThis.addEventListener = (type, fn) => type === 'message' && listeners.push(fn);
globalThis.performance = { now: () => now - 4_000_000 }; // un altro zero, come nel browser
const deliver = data =>
  listeners.forEach(fn =>
    fn({ source: parentWin, origin: 'https://app', data: { type: 'zona:packet', data } })
  );

// ---------- server ----------
class FakeSocket {
  readyState = 1;
  att = null;
  send(d) {
    later(() => deliver(d));
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
}
const sockets = [];
const room = new ZonaRoom(
  { acceptWebSocket: s => sockets.push(s), getWebSockets: () => sockets.filter(s => s.readyState === 1) },
  {},
  { now: () => now, autoTick: false }
);
const socket = new FakeSocket();
socket.serializeAttachment({ kind: 'zona', id: 'tg:1', name: 'Anna' });
sockets.push(socket);
room.sync();

// ---------- telefono ----------
const { createNet, DT } = await import('../public/zona/net.js');
const world = makeWorld(BOXES, GROUND);
const body = newBody(0, 0, 0);
let me = null;
const net = createNet({ world, body, onMessage: m => m.t === 'ciao' && (me = m.id) });
// il primo stato arriva con la prima fotografia del server
let nextTick = now + ZONA.tick;
let acc = 0;
let maxJump = 0;
let t = 0;
for (let frame = 0; frame < 60 * 8; frame++) {
  now += 1000 / 60;
  while (now >= nextTick) {
    room.tick();
    nextTick += ZONA.tick;
  }
  queue.sort((a, b) => a.at - b.at);
  while (queue.length && queue[0].at <= now) queue.shift().fn();
  acc += 1 / 60;
  while (acc >= DT - 1e-9) {
    acc -= DT;
    t += DT;
    // corre a zig-zag e salta ogni tanto
    const yaw = Math.sin(t * 0.7) * 2;
    const input = {
      fwd: 1,
      side: Math.sin(t * 2) > 0.5 ? 1 : 0,
      jump: Math.floor(t * 60) % 90 === 0,
      crouch: false,
      walk: false,
      yaw,
      pitch: 0
    };
    const before = { x: body.x + net.error.x, z: body.z + net.error.z };
    net.command(input, [input.fwd, input.side, input.jump ? 1 : 0, yaw, 0, 0], true);
    net.flush(performance.now());
    const after = { x: body.x + net.error.x, z: body.z + net.error.z };
    if (frame > 30) maxJump = Math.max(maxJump, Math.hypot(after.x - before.x, after.z - before.z));
  }
  net.smooth(1 / 60);
}
// si ferma e lascia arrivare tutto
for (let i = 0; i < 40; i++) {
  now += 1000 / 60;
  if (now >= nextTick) {
    room.tick();
    nextTick += ZONA.tick;
  }
  queue.sort((a, b) => a.at - b.at);
  while (queue.length && queue[0].at <= now) queue.shift().fn();
  net.command(
    { fwd: 0, side: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 },
    [0, 0, 0, 0, 0, 0],
    true
  );
  net.flush(performance.now());
}
const server = [...room.players.values()][0].body;
assert.equal(me, 'tg:1');
const d = Math.hypot(server.x - body.x, server.z - body.z);
assert.ok(d < 0.05, 'telefono e server nello stesso posto: ' + d.toFixed(3) + ' m');
assert.ok(Math.hypot(server.x, server.z) > 3, 'si è mosso davvero');
// in un comando (1/60 s) di corsa si fanno 9 cm: una correzione forte si vedrebbe come un salto molto più grande
assert.ok(maxJump < 0.2, 'nessuno scatto visibile: ' + maxJump.toFixed(3) + ' m');
// gli altri: il momento guardato è circa 100 ms prima del server (più il ritardo)
const behind = room.now() - net.viewTime();
assert.ok(behind > 90 && behind < 200, 'gli altri nel passato di ' + behind.toFixed(0) + ' ms');
console.log(
  'PASS zona-net: previsione uguale al server (' +
    d.toFixed(3) +
    ' m), niente scatti, altri a ' +
    behind.toFixed(0) +
    ' ms'
);
