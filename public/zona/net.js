// Zona Operativa: il collegamento con il server della partita (zona-server.js), passando dall'app (zona-link.js).
// - Il proprio movimento si vede subito: il telefono lo calcola con le stesse regole del server (previsione) e,
//   quando arriva la posizione vera, riparte da lì rifacendo i comandi non ancora confermati (correzione).
// - Gli altri si disegnano un attimo nel passato (100 ms), a metà tra due fotografie del server: scorrono lisci.
// - Al server si dice anche quale momento si sta guardando, così i colpi si controllano dove si vedevano gli altri.
import { moveStep } from './rules.js?v=b7541a7935';

export const DT = 1 / 60; // un comando ogni 1/60 di secondo, come sul server
const DELAY = 100; // ms nel passato per gli altri
const SEND_EVERY = 50; // ms

export function createNet({ world, body, onMessage, onStatus }) {
  const pending = []; // comandi non ancora confermati: {seq, input}
  let outbox = [];
  let seq = 0;
  let offset = null; // tempo del server - performance.now()
  let sentAt = 0;
  const snaps = []; // {time, players: Map}
  const error = { x: 0, y: 0, z: 0 }; // differenza dopo una correzione, che si smaltisce piano
  let alive = true;
  let open = false;
  let inFrame = parent !== window;

  const post = data => parent.postMessage(data, location.origin);
  addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const d = e.data;
    if (d?.type === 'zona:status') {
      open = !!d.open;
      onStatus?.(d);
    } else if (d?.type === 'zona:packet') {
      let m;
      try {
        m = JSON.parse(d.data);
      } catch {
        return;
      }
      if (m.t === 's') snapshot(m);
      onMessage?.(m);
    }
  });

  function snapshot(m) {
    const sample = m.time - performance.now();
    // la stima più alta è quella arrivata più in fretta; scende piano se la rete rallenta
    offset = offset === null || sample > offset ? sample : offset + (sample - offset) * 0.02;
    const players = new Map();
    for (const p of m.p)
      players.set(p[0], {
        id: p[0],
        x: p[1],
        y: p[2],
        z: p[3],
        yaw: p[4],
        pitch: p[5],
        crouch: !!(p[6] & 1),
        dead: !!(p[6] & 2),
        ground: !!(p[6] & 4),
        weapon: p[7],
        color: p[8]
      });
    snaps.push({ time: m.time, players });
    while (snaps.length > 30) snaps.shift();
    if (m.me) reconcile(m.me, m.ack);
  }

  function reconcile(me, ack) {
    alive = me.al;
    while (pending.length && pending[0].seq <= ack) pending.shift();
    const before = { x: body.x, y: body.y, z: body.z };
    Object.assign(body, {
      x: me.x,
      y: me.y,
      z: me.z,
      vx: me.vx,
      vy: me.vy,
      vz: me.vz,
      onGround: me.g,
      crouch: me.c
    });
    if (alive) for (const p of pending) if (p.input) moveStep(body, p.input, DT, world);
    const ex = before.x - body.x;
    const ey = before.y - body.y;
    const ez = before.z - body.z;
    if (Math.hypot(ex, ey, ez) > 2) error.x = error.y = error.z = 0;
    else {
      error.x += ex;
      error.y += ey;
      error.z += ez;
    }
  }

  return {
    get open() {
      return open;
    },
    inFrame,
    error,
    connect: (room = 'deserto') => post({ type: 'zona:connect', room }),
    // un messaggio semplice (nel poligono condiviso: dove si sta e quando si spara)
    send: obj => post({ type: 'zona:send', data: JSON.stringify(obj) }),
    disconnect: () => post({ type: 'zona:disconnect' }),
    serverNow: () => (offset === null ? 0 : performance.now() + offset),
    viewTime() {
      return this.serverNow() - DELAY;
    },
    // un comando: si muove subito (se vivi) e parte con il prossimo invio
    command(input, cmd, live) {
      seq += 1;
      if (live && alive) moveStep(body, input, DT, world);
      pending.push({ seq, input: live && alive ? input : null });
      if (pending.length > 240) pending.shift();
      outbox.push(cmd);
    },
    flush(now = performance.now()) {
      if (!outbox.length || (now - sentAt < SEND_EVERY && outbox.length < 6)) return;
      sentAt = now;
      post({
        type: 'zona:send',
        data: JSON.stringify({ t: 'in', s: seq, v: Math.round(this.viewTime()), c: outbox.slice(-20) })
      });
      outbox = [];
    },
    // la correzione si smaltisce in un decimo di secondo circa
    smooth(dt) {
      const k = Math.max(0, 1 - dt * 12);
      error.x *= k;
      error.y *= k;
      error.z *= k;
    },
    // gli altri giocatori al momento t (tempo del server), a metà tra due fotografie
    others(t, me) {
      if (!snaps.length) return [];
      let a = snaps[0];
      let b = snaps[snaps.length - 1];
      for (let i = snaps.length - 1; i > 0; i--)
        if (snaps[i - 1].time <= t) {
          a = snaps[i - 1];
          b = snaps[i];
          break;
        }
      const k = b.time === a.time ? 1 : Math.max(0, Math.min(1, (t - a.time) / (b.time - a.time)));
      const out = [];
      for (const [id, pb] of b.players) {
        if (id === me) continue;
        const pa = a.players.get(id);
        // appena rinato (salto di posto) o appena arrivato: niente scivolata attraverso la mappa
        if (!pa || Math.hypot(pa.x - pb.x, pa.z - pb.z) > 4 || pa.dead !== pb.dead) {
          out.push({ ...(k < 0.5 && pa ? pa : pb) });
          continue;
        }
        const turn = Math.atan2(Math.sin(pb.yaw - pa.yaw), Math.cos(pb.yaw - pa.yaw));
        out.push({
          ...pb,
          x: pa.x + (pb.x - pa.x) * k,
          y: pa.y + (pb.y - pa.y) * k,
          z: pa.z + (pb.z - pa.z) * k,
          yaw: pa.yaw + turn * k,
          pitch: pa.pitch + (pb.pitch - pa.pitch) * k,
          crouch: k < 0.5 ? pa.crouch : pb.crouch
        });
      }
      return out;
    }
  };
}
