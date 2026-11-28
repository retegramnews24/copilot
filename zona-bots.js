// Zona Operativa, tappa 3: i bot che riempiono i posti vuoti (docs/zona-operativa.md). Girano sul server dentro
// ZonaRoom e si muovono con gli stessi comandi dei giocatori veri (stesse regole, stessi muri). Livello scelto dal
// proprietario: «medi», poi (28 novembre) un po' più facili: reagiscono in circa 0,7 s, mirano al corpo, sbagliano
// di più, soprattutto da lontano, si girano più piano e vedono un po' meno.
import { eyeHeight, WEAPONS } from './public/zona/rules.js';

export const BOT = {
  react: 700, // ms prima di sparare a un nemico appena visto (± reactVar)
  reactVar: 250,
  see: 55, // m: oltre non si vede
  fov: 1.0, // rad da ogni lato dello sguardo (circa 115° in tutto)
  hear: 8, // m: più vicino di così si sente anche alle spalle
  turn: 4.2, // rad/s al massimo per girarsi
  errBase: 0.04, // errore di mira (rad) che cambia ogni errEvery ms, più grande da lontano
  errDist: 0.0018,
  errEvery: 350,
  think: 250, // ms tra un controllo della vista e l'altro
  memory: 4000, // ms: dove si è visto un nemico l'ultima volta
  close: { tuono: 6, calabrone: 12, ruggito: 18 } // m: più vicino si sta fermi e ci si sposta di lato
};
export const BOT_NAMES = ['Aldo', 'Bruna', 'Ciro', 'Dora', 'Ezio', 'Fede', 'Gino', 'Lia'];
export const BOT_WEAPONS = ['calabrone', 'ruggito', 'tuono'];
// a ogni rinascita l'arma principale successiva di questo giro (le persone; i bot girano fra BOT_WEAPONS)
export const SPAWN_ROTATION = ['calabrone', 'tuono', 'ruggito', 'falco'];

// ---------- mappa dei passaggi ----------

// Celle di mezzo metro: libera se un giocatore ci sta in piedi (dai 45 cm in su niente scatole, così soglie e
// gradini bassi non contano). I bot restano a terra: niente piani alti né terrazze.
export function createNav(world, { from = -63, size = 126, cell = 0.5 } = {}) {
  const n = Math.round(size / cell) + 1;
  const free = new Uint8Array(n * n);
  const r = 0.32;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = from + i * cell;
      const z = from + j * cell;
      const y = world.height(x, z);
      const blocked = world
        .near(x, z, 0.8)
        .some(
          c =>
            x + r > c.min[0] &&
            x - r < c.max[0] &&
            z + r > c.min[2] &&
            z - r < c.max[2] &&
            y + 1.75 > c.min[1] &&
            y + 0.45 < c.max[1]
        );
      free[j * n + i] = blocked ? 0 : 1;
    }
  const toCell = (x, z) => [Math.round((x - from) / cell), Math.round((z - from) / cell)];
  const ok = (i, j) => i >= 0 && j >= 0 && i < n && j < n && free[j * n + i] === 1;
  const center = (i, j) => ({ x: from + i * cell, z: from + j * cell });
  // la cella libera più vicina (a spirale)
  function nearest(x, z) {
    const [ci, cj] = toCell(x, z);
    for (let d = 0; d < 12; d++)
      for (let j = cj - d; j <= cj + d; j++)
        for (let i = ci - d; i <= ci + d; i++)
          if ((Math.abs(i - ci) === d || Math.abs(j - cj) === d) && ok(i, j)) return [i, j];
    return null;
  }
  // linea dritta tutta libera (per accorciare la strada)
  function clear(a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (cell * 0.5));
    for (let s = 1; s < steps; s++) {
      const [i, j] = toCell(a.x + ((b.x - a.x) * s) / steps, a.z + ((b.z - a.z) * s) / steps);
      if (!ok(i, j)) return false;
    }
    return true;
  }
  // A* con 8 vicini (in diagonale solo se i due lati sono liberi); ritorna punti da seguire o null
  function path(fromX, fromZ, toX, toZ, limit = 40000) {
    const s = nearest(fromX, fromZ);
    const g = nearest(toX, toZ);
    if (!s || !g) return null;
    const start = s[1] * n + s[0];
    const goal = g[1] * n + g[0];
    const cost = new Map([[start, 0]]);
    const prev = new Map();
    const heap = [[0, start]];
    const h = k => Math.hypot((k % n) - g[0], Math.floor(k / n) - g[1]);
    const push = item => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r2 = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r2 < heap.length && heap[r2][0] < heap[m][0]) m = r2;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    let seen = 0;
    while (heap.length && seen++ < limit) {
      const [, k] = pop();
      if (k === goal) break;
      const i = k % n;
      const j = Math.floor(k / n);
      const c0 = cost.get(k);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!ok(ni, nj)) continue;
          if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
          const nk = nj * n + ni;
          const c = c0 + (di && dj ? Math.SQRT2 : 1);
          if (c < (cost.get(nk) ?? Infinity)) {
            cost.set(nk, c);
            prev.set(nk, k);
            push([c + h(nk), nk]);
          }
        }
    }
    if (!cost.has(goal)) return null;
    const cells = [];
    for (let k = goal; k !== undefined; k = prev.get(k)) cells.push(center(k % n, Math.floor(k / n)));
    cells.reverse();
    // si tengono solo i punti dove si deve girare
    const out = [];
    let from0 = { x: fromX, z: fromZ };
    for (let i = 1; i < cells.length; i++)
      if (!clear(from0, cells[i])) {
        out.push(cells[i - 1]);
        from0 = cells[i - 1];
      }
    out.push(cells[cells.length - 1]);
    return out;
  }
  return { n, cell, from, free, ok: (x, z) => ok(...toCell(x, z)), nearest, path, clear };
}

// ---------- vista ----------

const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

// Il bot vede il nemico? Dentro la distanza, davanti (o molto vicino) e senza muri in mezzo (raggio dagli occhi al
// petto e alla testa).
export function canSee(world, bot, enemy) {
  const b = bot.body;
  const e = enemy.body;
  const dx = e.x - b.x;
  const dz = e.z - b.z;
  const dist = Math.hypot(dx, dz);
  if (dist > BOT.see) return false;
  if (dist > BOT.hear) {
    const toward = Math.atan2(-dx, -dz);
    if (Math.abs(angle(toward - b.yaw)) > BOT.fov) return false;
  }
  const eye = { x: b.x, y: eyeHeight(b), z: b.z };
  for (const h of [1.25, 1.6]) {
    const tx = e.x - eye.x;
    const ty = e.y + h * (e.crouch ? 0.7 : 1) - eye.y;
    const tz = e.z - eye.z;
    const l = Math.hypot(tx, ty, tz);
    const wall = world.ray(eye, { x: tx / l, y: ty / l, z: tz / l }, l);
    if (!wall || wall.t > l - 0.2) return true;
  }
  return false;
}

// ---------- pensiero (una volta per passo del server, 20 al secondo) ----------

// Ritorna il comando da ripetere per il passo: {fwd, side, jump, yaw, pitch, fire}.
export function botThink(room, bot, now, dt) {
  const ai = (bot.ai ??= {
    path: null,
    step: 0,
    goal: null,
    replanAt: 0,
    target: null,
    reactAt: 0,
    seenAt: 0
  });
  const b = bot.body;
  const random = room.random;
  const enemies = room.all().filter(o => o.alive && o.team !== bot.team);
  // vista: ogni BOT.think ms
  if (now >= (ai.lookAt ?? 0)) {
    ai.lookAt = now + BOT.think;
    let best = null;
    for (const e of enemies) {
      if (!canSee(room.world, bot, e)) continue;
      const d = Math.hypot(e.body.x - b.x, e.body.z - b.z);
      if (!best || d < best.d) best = { e, d };
    }
    if (best) {
      if (ai.target !== best.e) ai.reactAt = now + BOT.react + (random() * 2 - 1) * BOT.reactVar;
      ai.target = best.e;
      ai.seenAt = now;
      ai.last = { x: best.e.body.x, z: best.e.body.z };
    } else if (ai.target && now - ai.seenAt > BOT.think * 2) ai.target = null;
  }
  const target = ai.target && ai.target.alive ? ai.target : null;
  let wantYaw = b.yaw;
  let wantPitch = 0;
  let fwd = 0;
  let side = 0;
  let fire = false;
  if (target) {
    // mira al petto, con un errore che cambia ogni tanto ed è più grande da lontano
    const e = target.body;
    const dx = e.x - b.x;
    const dz = e.z - b.z;
    const dist = Math.hypot(dx, dz);
    if (now >= (ai.errUntil ?? 0)) {
      const size = BOT.errBase + dist * BOT.errDist;
      ai.errYaw = (random() + random() - 1) * size;
      ai.errPitch = (random() + random() - 1) * size * 0.6;
      ai.errUntil = now + BOT.errEvery;
    }
    wantYaw = Math.atan2(-dx, -dz) + ai.errYaw;
    wantPitch = Math.atan2(e.y + 1.2 * (e.crouch ? 0.7 : 1) - eyeHeight(b), dist) + ai.errPitch;
    const close = BOT.close[bot.current] ?? 12;
    if (dist > close) fwd = 1;
    if (now >= (ai.strafeUntil ?? 0)) {
      ai.strafe = random() < 0.5 ? -1 : 1;
      ai.strafeUntil = now + 500 + random() * 700;
    }
    side = ai.strafe;
    const aimed = Math.abs(angle(wantYaw - b.yaw)) < 0.08;
    fire = now >= ai.reactAt && aimed;
    ai.path = null;
  } else {
    // nessuno in vista: verso dove si è visto qualcuno, se no in giro per la mappa
    if (!ai.path || ai.step >= ai.path.length || now >= ai.replanAt) {
      let goal = null;
      if (ai.last && now - ai.seenAt < BOT.memory) goal = ai.last;
      else {
        const spots = room.goals();
        goal = spots[Math.floor(random() * spots.length)];
        ai.last = null;
      }
      ai.path = room.nav.path(b.x, b.z, goal.x, goal.z) || [];
      ai.step = 0;
      ai.replanAt = now + 8000;
    }
    const wp = ai.path[ai.step];
    if (wp) {
      const dx = wp.x - b.x;
      const dz = wp.z - b.z;
      if (Math.hypot(dx, dz) < 0.6) ai.step += 1;
      else {
        wantYaw = Math.atan2(-dx, -dz);
        fwd = Math.abs(angle(wantYaw - b.yaw)) < 1 ? 1 : 0.3;
      }
    }
  }
  // bloccato: salta e rifà la strada
  let jump = false;
  if (fwd || side) {
    const moved = ai.from ? Math.hypot(b.x - ai.from.x, b.z - ai.from.z) : 1;
    if (now >= (ai.checkAt ?? 0)) {
      if (moved < 0.3) {
        jump = true;
        ai.replanAt = 0;
        ai.strafe = -(ai.strafe || 1);
      }
      ai.from = { x: b.x, z: b.z };
      ai.checkAt = now + 1000;
    }
  }
  // si gira piano verso dove vuole guardare
  const maxTurn = BOT.turn * dt;
  const yaw = b.yaw + Math.max(-maxTurn, Math.min(maxTurn, angle(wantYaw - b.yaw)));
  const pitch = b.pitch + Math.max(-maxTurn, Math.min(maxTurn, wantPitch - b.pitch));
  return { fwd, side, jump, yaw, pitch, fire, auto: WEAPONS[bot.current]?.auto };
}
