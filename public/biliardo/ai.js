// Il computer: prepara tanti colpi candidati (palla fantasma verso le buche, colpi sulla bilia avversaria,
// accosti al pallino…), li simula con la fisica vera e le stesse regole, e sceglie il migliore.
// Il livello decide quanto sbaglia la mira.
import * as P from './physics.js?v=ba3146227c';
import * as E from './engine.js?v=7a6dafd8ad';

const LEVELS = {
  facile: { err: 0.022, pick: 5, spin: false, budget: 24 },
  medio: { err: 0.012, pick: 3, spin: true, budget: 40 },
  difficile: { err: 0.003, pick: 1, spin: true, budget: 64 },
};

const clone = (m) => JSON.parse(JSON.stringify(m));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const wait = () => new Promise((r) => setTimeout(r, 0));

function pocketAim(p) {
  if (p.corner) return { x: p.x - Math.sign(p.x) * 0.024, z: p.z - Math.sign(p.z) * 0.024 };
  return { x: p.x, z: p.z - Math.sign(p.z) * 0.045 };
}

function clear(m, ax, az, bx, bz, skip, rr) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
  for (const b of m.balls) {
    if (!b.on || skip.includes(b.id)) continue;
    let t = ((b.x - ax) * dx + (b.z - az) * dz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t - b.x, pz = az + dz * t - b.z;
    if (px * px + pz * pz < (rr * 0.98) ** 2) return false;
  }
  return true;
}

// colpi "palla fantasma" verso le buche (palla 8 e snooker)
function pocketShots(m, cue, ids) {
  const T = E.tableOf(m), R = T.R, out = [];
  for (const id of ids) {
    const o = m.balls[id];
    if (!o.on) continue;
    for (let k = 0; k < T.pockets.length; k++) {
      const p = T.pockets[k];
      const a = pocketAim(p);
      const ox = a.x - o.x, oz = a.z - o.z, od = Math.hypot(ox, oz);
      const gx = o.x - (ox / od) * 2 * R, gz = o.z - (oz / od) * 2 * R;
      const cx = gx - cue.x, cz = gz - cue.z, cd = Math.hypot(cx, cz);
      if (cd < 1e-4) continue;
      const cut = Math.acos(Math.max(-1, Math.min(1, (cx * ox + cz * oz) / (cd * od))));
      if (cut > 1.3) continue;
      if (!clear(m, cue.x, cue.z, gx, gz, [cue.id, id], 2 * R) || !clear(m, o.x, o.z, a.x, a.z, [cue.id, id], 2 * R)) continue;
      const base = Math.sqrt(0.9 * (cd + od * 1.6)) * (1 + cut * 0.6) + 0.5;
      out.push({ dx: cx / cd, dz: cz / cd, base, ease: Math.cos(cut) / (0.4 + cd + od * 1.4), call: k });
    }
  }
  return out.sort((a, b) => b.ease - a.ease);
}

// colpi diretti su una bilia, pieni o di taglio
function hitShots(m, cue, id, cuts = [-0.6, -0.3, 0, 0.3, 0.6]) {
  const o = m.balls[id], out = [];
  const dx = o.x - cue.x, dz = o.z - cue.z, d = Math.hypot(dx, dz);
  for (const c of cuts) {
    const off = c * (o.r + cue.r) / Math.max(d, 0.05);
    const ang = Math.atan2(dz, dx) + Math.asin(Math.max(-0.95, Math.min(0.95, off)));
    out.push({ dx: Math.cos(ang), dz: Math.sin(ang), base: 0.8 + d * 1.2, ease: 0.5 - Math.abs(c) * 0.2 });
  }
  return out;
}

function candidates(m, lv) {
  const id = E.cueId(m), cue = m.balls[id];
  const tries = [];
  const spins = lv.spin ? [[0, 0], [-0.6, 0], [0.5, 0]] : [[0, 0]];
  // la nera si chiama: la buca del colpo, altrimenti quella più vicina alla nera
  const eight = E.onEight(m), b8 = m.balls[8];
  const near8 = eight ? E.tableOf(m).pockets.reduce((best, p, k, a) => (Math.hypot(p.x - b8.x, p.z - b8.z) < Math.hypot(a[best].x - b8.x, a[best].z - b8.z) ? k : best), 0) : -1;
  const push = (list, ks, sp = spins) => { for (const c of list) for (const k of ks) for (const [sy, sx] of sp) tries.push({ dx: c.dx, dz: c.dz, speed: Math.min(E.maxSpeed(m), c.base * k), sy, sx, ...(eight ? { call: c.call ?? near8 } : {}) }); };
  if (m.variant === 'otto' || m.variant === 'snooker') {
    const legal = E.legalFirst(m);
    push(pocketShots(m, cue, legal).slice(0, Math.ceil(lv.budget / 9)), [0.75, 1.1, 1.6]);
    if (tries.length < 6) for (const t of legal.slice(0, 4)) push(hitShots(m, cue, t, [-0.4, 0, 0.4]), [1.3, 2]);
  } else if (m.variant === 'italiana') {
    const opp = m.cur === 0 ? 1 : 0;
    push(hitShots(m, cue, opp, [-0.7, -0.45, -0.2, 0, 0.2, 0.45, 0.7]), [1.4, 2.2, 3.2], lv.spin ? [[0, 0], [0.4, 0]] : [[0, 0]]);
  } else if (m.acchito) {
    // boccette, bocciata d'acchito: il pallino va colpito direttamente
    push(hitShots(m, cue, 0, [-0.5, -0.2, 0, 0.2, 0.5]), [1.4, 2.1, 2.8], [[0, 0]]);
  } else {
    // boccette: accosto al pallino, oppure bocciata sulle bilie avversarie / sul pallino (solo oltre la metà)
    const p = m.balls[0];
    const d = Math.hypot(p.x - cue.x, p.z - cue.z);
    const toP = { dx: (p.x - cue.x) / d, dz: (p.z - cue.z) / d };
    const stop = Math.sqrt(2 * 0.5 * d) + 0.1; // velocità per arrivarci rotolando, più o meno
    for (const k of [0.8, 0.9, 1, 1.1]) for (const a of [-0.03, 0, 0.03]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      tries.push({ dx: toP.dx * ca - toP.dz * sa, dz: toP.dx * sa + toP.dz * ca, speed: stop * k, sy: 0, sx: 0 });
    }
    const opp = m.cur === 0 ? [5, 6, 7, 8] : [1, 2, 3, 4];
    for (const id2 of [0, ...opp]) if (m.balls[id2].on && E.bocciabile(m.balls[id2])) push(hitShots(m, cue, id2, [-0.4, 0, 0.4]), [1.6, 2.6], [[0, 0]]);
  }
  if (!tries.length) for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2; tries.push({ dx: Math.cos(a), dz: Math.sin(a), speed: 1.5 + Math.random() * 2, sy: 0, sx: 0 }); }
  return tries.slice(0, lv.budget);
}

function score(m, before, out, pi) {
  if (out.win === pi) return 1000;
  if (out.win >= 0) return -1000;
  let s = (m.scores[pi] - before[pi]) * 12 - (m.scores[1 - pi] - before[1 - pi]) * 12;
  if (out.foul) s -= 60;
  if (out.keep) s += 50;
  if (m.variant === 'boccette') {
    const p = m.balls[0];
    let mine = 9, theirs = 9;
    for (const b of m.balls) if (b.id && b.on) { const d = Math.hypot(b.x - p.x, b.z - p.z); if ((b.id <= 4) === (pi === 0)) mine = Math.min(mine, d); else theirs = Math.min(theirs, d); }
    s += mine < theirs ? 25 : 0;
    s -= mine * 10;
  }
  return s + Math.random() * 0.5;
}

// Dove mettere la bilia in mano: varie posizioni valide, il computer prova i colpi da ognuna
function placements(m) {
  const T = E.tableOf(m), id = E.cueId(m), out = [];
  if (m.inHand === 'any' && m.variant === 'otto') {
    for (const t of E.legalFirst(m)) {
      const o = m.balls[t];
      for (const p of T.pockets) {
        const a = pocketAim(p), ox = a.x - o.x, oz = a.z - o.z, od = Math.hypot(ox, oz);
        for (const back of [0.25, 0.4]) {
          const x = o.x - (ox / od) * (2 * T.R + back), z = o.z - (oz / od) * (2 * T.R + back);
          if (E.canPlace(m, x, z) && clear(m, x, z, o.x, o.z, [id, t], 2 * T.R) && clear(m, o.x, o.z, a.x, a.z, [id, t], 2 * T.R)) out.push({ x, z, s: 1 / (od + back) });
        }
      }
    }
    out.sort((a, b) => b.s - a.s);
  }
  for (let i = 0; out.length < 3 && i < 600; i++) {
    const x = (Math.random() * 2 - 1) * (T.L - T.R * 2);
    const z = (Math.random() * 2 - 1) * (T.W - T.R * 2) * (m.inHand === 'D' ? 0.4 : 1);
    if (E.canPlace(m, x, z)) out.push({ x, z });
  }
  if (!out.length) { const c = m.balls[id]; out.push({ x: c.x, z: c.z }); }
  return out.slice(0, 3);
}

// Sceglie il colpo. Ritorna { dx, dz, speed, sy, sx, px?, pz? }
export async function plan(m, level = 'medio') {
  const lv = LEVELS[level] || LEVELS.medio;
  const pi = m.cur;
  if (m.variant === 'otto' && m.breakShot) {
    const c = m.balls[0], apex = m.balls.filter((b) => b.on && b.id).reduce((a, b) => (b.x < a.x ? b : a));
    const z = (Math.random() - 0.5) * 0.2, px = c.x, a = Math.atan2(apex.z - z, apex.x - px) + gauss() * 0.004;
    return { dx: Math.cos(a), dz: Math.sin(a), speed: 6.6, sy: 0.1, sx: 0, px, pz: z };
  }
  const places = m.inHand ? placements(m) : [null];
  // boccette: chi ha l'acchito mette anche il pallino (oltre la metà, lontano dai birilli)
  let q = null;
  if (m.variant === 'boccette' && m.acchito) {
    const T = E.tableOf(m);
    for (let i = 0; i < 200 && !q; i++) {
      const x = 0.2 + Math.random() * (T.L - 0.45), z = (Math.random() * 2 - 1) * (T.W - 0.15);
      if (E.canPlacePallino(m, x, z) && Math.hypot(x, z) > 0.18) q = { x, z };
    }
    q = q || { x: T.L / 2, z: 0 };
  }
  const res = [];
  let n = 0;
  for (const pl of places) {
    const mm = clone(m);
    if (pl) { const b = mm.balls[E.cueId(mm)]; b.x = pl.x; b.z = pl.z; }
    if (q) { mm.balls[0].x = q.x; mm.balls[0].z = q.z; }
    for (const t of candidates(mm, lv)) {
      const s = { ...t, ...(pl ? { px: pl.x, pz: pl.z } : {}), ...(q ? { qx: q.x, qz: q.z } : {}) };
      let total = 0;
      for (const e of [0, 0.005, -0.005]) {
        const sim = clone(mm);
        const before = [...sim.scores];
        const ca = Math.cos(e), sa = Math.sin(e);
        const { out } = E.playShot(sim, { ...s, dx: s.dx * ca - s.dz * sa, dz: s.dx * sa + s.dz * ca });
        total += score(sim, before, out, pi) * (e ? 0.25 : 0.5);
      }
      res.push({ ...s, total });
      if (++n % 4 === 0) await wait();
    }
  }
  res.sort((a, b) => b.total - a.total);
  const pick = res[Math.floor(Math.random() * Math.min(lv.pick, res.length))] || { dx: 1, dz: 0, speed: 2, sy: 0, sx: 0 };
  const e = gauss() * lv.err, ca = Math.cos(e), sa = Math.sin(e);
  return { ...pick, dx: pick.dx * ca - pick.dz * sa, dz: pick.dx * sa + pick.dz * ca, speed: pick.speed * (1 + gauss() * lv.err * 2) };
}
