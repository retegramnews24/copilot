// Zona Operativa: le regole del gioco in un file solo (docs/zona-operativa.md). Niente three.js e niente pagina:
// le usa il telefono e, dalla tappa 2, il server. Coordinate di three.js: y in alto, metri, secondi.
// Calcoli uguali su ogni dispositivo: numeri a caso solo con il seme (rng), mai Math.random.

export const PLAYER = {
  radius: 0.3, // mezzo lato del corpo (scatola) per gli urti
  height: 1.8,
  crouchHeight: 1.25,
  eye: 1.65,
  crouchEye: 1.12,
  run: 5.2, // m/s
  walk: 2.6, // con Maiusc
  crouch: 2.0,
  accel: 40,
  friction: 10,
  airControl: 0.35,
  gravity: 20,
  jump: 6.2, // salto di circa 1 m
  step: 0.4, // gradino che si sale da soli
  stairs: 0.65, // più gradini di fila nello stesso passo (scala presa di lato, il corpo tocca due gradini)
  health: 100
};

// Danni del bilanciamento «Duro, la testa conta»: testa ×4, gambe ×0,75.
export const ZONES = { testa: 4, corpo: 1, gambe: 0.75 };

// rate: colpi al secondo; reload: secondi (Tuono: per cartuccia); range: distanza buona in metri;
// spread: dispersione in radianti (Falco: senza mirino / con mirino).
export const WEAPONS = {
  baretta: { name: 'Baretta', slot: 2, damage: 25, rate: 5, auto: false, mag: 10, reload: 1.4, range: 25, spread: 0.006, pellets: 1 },
  calabrone: { name: 'Calabrone', slot: 1, damage: 18, rate: 12, auto: true, mag: 20, reload: 2.0, range: 20, spread: 0.014, pellets: 1 },
  tuono: { name: 'Tuono', slot: 1, damage: 14, rate: 1 / 0.9, auto: false, mag: 5, reload: 0.5, perShell: true, range: 10, spread: 0.06, pellets: 8 },
  ruggito: { name: 'Ruggito', slot: 1, damage: 28, rate: 9, auto: true, mag: 25, reload: 2.3, range: 40, spread: 0.007, pellets: 1 },
  falco: { name: 'Falco', slot: 1, damage: 110, rate: 1 / 1.6, auto: false, mag: 1, reload: 2.6, range: Infinity, spread: 0.035, scopedSpread: 0.0006, zoom: 4, pellets: 1 },
  coltello: { name: 'Coltello', slot: 3, damage: 50, backDamage: 100, rate: 2, auto: false, mag: Infinity, reload: 0, range: 1.7, melee: true, spread: 0, pellets: 1 }
};

// Danno a una certa distanza: pieno fino alla distanza buona, poi scende fino al 60% al doppio della distanza.
// Il Tuono oltre 10 m scende fino a quasi niente a 15 m.
export function falloff(weapon, distance) {
  const w = WEAPONS[weapon];
  if (!isFinite(w.range) || distance <= w.range) return 1;
  if (weapon === 'tuono') return Math.max(0.05, 1 - ((distance - w.range) / 5) * 0.95);
  return Math.max(0.6, 1 - ((distance - w.range) / w.range) * 0.4);
}

export function damage(weapon, zone, distance) {
  return Math.round(WEAPONS[weapon].damage * (ZONES[zone] ?? 1) * falloff(weapon, distance));
}

// Numeri a caso ripetibili (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- arma in mano: colpi, cadenza, ricarica ----------

export function newGun(weapon) {
  return { weapon, ammo: WEAPONS[weapon].mag, cooldown: 0, reloading: 0 };
}

// Avanza il tempo. Ritorna 'ricaricata' quando finisce una ricarica (o una cartuccia del Tuono).
export function tickGun(gun, dt) {
  const w = WEAPONS[gun.weapon];
  // può scendere un poco sotto zero: il resto passa al colpo dopo, così la cadenza non dipende dagli fps
  gun.cooldown = Math.max(-0.05, gun.cooldown - dt);
  if (gun.reloading > 0) {
    gun.reloading -= dt;
    if (gun.reloading <= 0) {
      if (w.perShell) {
        gun.ammo = Math.min(w.mag, gun.ammo + 1);
        gun.reloading = gun.ammo < w.mag ? w.reload : 0;
      } else {
        gun.ammo = w.mag;
        gun.reloading = 0;
      }
      return 'ricaricata';
    }
  }
  return null;
}

export function startReload(gun) {
  const w = WEAPONS[gun.weapon];
  if (w.melee || gun.reloading > 0 || gun.ammo >= w.mag) return false;
  gun.reloading = w.reload;
  return true;
}

// Prova a sparare: 'spara', 'vuoto' (scatto a vuoto, parte la ricarica) o null (non ancora).
export function tryFire(gun) {
  const w = WEAPONS[gun.weapon];
  if (gun.cooldown > 1e-9) return null;
  if (gun.reloading > 0) {
    if (!w.perShell || gun.ammo === 0) return null;
    gun.reloading = 0; // il Tuono può sparare a metà ricarica
  }
  if (gun.ammo <= 0) {
    startReload(gun);
    gun.cooldown = 0.25;
    return 'vuoto';
  }
  if (!w.melee) gun.ammo -= 1;
  gun.cooldown = Math.max(gun.cooldown, -1 / 60) + 1 / w.rate;
  if (gun.ammo === 0 && !w.melee && w.mag > 1) startReload(gun);
  if (w.mag === 1) startReload(gun); // Falco: un colpo e si ricarica
  return 'spara';
}

// Direzioni dei pallini/colpi: dir è {x,y,z} normalizzato; spread in radianti; random: funzione rng.
export function pelletDirs(dir, spread, pellets, random) {
  const out = [];
  // due assi perpendicolari alla direzione
  const up = Math.abs(dir.y) > 0.95 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  let ax = cross(dir, up);
  ax = norm(ax);
  const ay = cross(ax, dir);
  for (let i = 0; i < pellets; i++) {
    const a = random() * Math.PI * 2;
    const r = spread * Math.sqrt(random());
    const dx = Math.cos(a) * r;
    const dy = Math.sin(a) * r;
    out.push(norm({ x: dir.x + ax.x * dx + ay.x * dy, y: dir.y + ax.y * dx + ay.y * dy, z: dir.z + ax.z * dx + ay.z * dy }));
  }
  return out;
}

const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = v => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

// ---------- raggi e scatole ----------

// Scatola: {min:[x,y,z], max:[x,y,z]}. Ritorna la distanza t (>=0) dove il raggio entra, oppure null.
export function rayBox(o, d, box, maxT = Infinity) {
  let t0 = 0;
  let t1 = maxT;
  const O = [o.x, o.y, o.z];
  const D = [d.x, d.y, d.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(D[i]) < 1e-12) {
      if (O[i] < box.min[i] || O[i] > box.max[i]) return null;
    } else {
      let a = (box.min[i] - O[i]) / D[i];
      let b = (box.max[i] - O[i]) / D[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return null;
    }
  }
  return t0;
}

export function raySphere(o, d, c, r, maxT = Infinity) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 && t <= maxT ? t : null;
}

// Il primo muro colpito dal raggio: {t, box} oppure null.
export function rayWorld(o, d, boxes, maxT = 300) {
  let best = null;
  for (const box of boxes) {
    if (box.noShot) continue;
    const t = rayBox(o, d, box, maxT);
    if (t !== null && (!best || t < best.t)) best = { t, box };
  }
  return best;
}

// ---------- movimento ----------

export function newBody(x, y, z, yaw = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, pitch: 0, onGround: false, crouch: false };
}

// Mappa grande (deserto): scatole divise in celle per cercare solo quelle vicine, più l'altezza del terreno a
// griglia (map-deserto.js), letta con un'interpolazione tra i quattro punti vicini. boxes: [minX,minY,minZ,maxX,
// maxY,maxZ] oppure {min,max}. Si passa a moveStep al posto dell'elenco di scatole.
export function makeWorld(rawBoxes, ground = null, cell = 4) {
  const boxes = rawBoxes.map(b => (Array.isArray(b) ? { min: [b[0], b[1], b[2]], max: [b[3], b[4], b[5]], noShot: b[6] === 1 } : b));
  const grid = new Map();
  const key = (i, j) => i * 4096 + j;
  boxes.forEach((b, n) => {
    for (let i = Math.floor(b.min[0] / cell); i <= Math.floor(b.max[0] / cell); i++)
      for (let j = Math.floor(b.min[2] / cell); j <= Math.floor(b.max[2] / cell); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(n);
      }
  });
  const seen = new Int32Array(boxes.length);
  let stamp = 0;
  const near = (x, z, r = 1) => {
    stamp += 1;
    const out = [];
    for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++)
      for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) {
        const list = grid.get(key(i, j));
        if (!list) continue;
        for (const n of list)
          if (seen[n] !== stamp) {
            seen[n] = stamp;
            out.push(boxes[n]);
          }
      }
    return out;
  };
  const height = (x, z) => {
    if (!ground) return 0;
    const g = ground;
    const fx = Math.max(0, Math.min(g.nx - 1.001, (x - g.x0) / g.step));
    const fz = Math.max(0, Math.min(g.nz - 1.001, (z - g.z0) / g.step));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const h = (a, c) => g.h[c * g.nx + a];
    return ((h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v) / 100;
  };
  // raggio: scatole lungo il percorso, cella per cella (più veloce che provarle tutte)
  const ray = (o, d, maxT = 300) => {
    let best = null;
    const len = Math.min(maxT, 200);
    const stepT = cell * 0.5;
    stamp += 1;
    for (let t = 0; t <= len + stepT; t += stepT) {
      const x = o.x + d.x * Math.min(t, len);
      const z = o.z + d.z * Math.min(t, len);
      const i0 = Math.floor(x / cell);
      const j0 = Math.floor(z / cell);
      for (let i = i0 - 1; i <= i0 + 1; i++)
        for (let j = j0 - 1; j <= j0 + 1; j++) {
          const list = grid.get(key(i, j));
          if (!list) continue;
          for (const n of list) {
            if (seen[n] === stamp) continue;
            seen[n] = stamp;
            const box = boxes[n];
            if (box.noShot) continue;
            const hit = rayBox(o, d, box, maxT);
            if (hit !== null && (!best || hit < best.t)) best = { t: hit, box };
          }
        }
      if (best && best.t < t - cell) break;
    }
    return best;
  };
  return { boxes, near, height, ray };
}

// input: {fwd, side (-1..1), jump, crouch, walk, yaw, pitch}. boxes: elenco di scatole oppure un mondo (makeWorld).
export function moveStep(b, input, dt, where) {
  const world = where && where.near ? where : null;
  const boxes = world ? world.near(b.x, b.z, 1.2) : where;
  const wasOnGround = b.onGround;
  b.yaw = input.yaw;
  b.pitch = Math.max(-1.5, Math.min(1.5, input.pitch));
  const wantCrouch = !!input.crouch;
  if (!wantCrouch && b.crouch && blocked(b, boxes, PLAYER.height)) b.crouch = true;
  else b.crouch = wantCrouch;
  const speed = b.crouch ? PLAYER.crouch : input.walk ? PLAYER.walk : PLAYER.run;
  // direzione voluta (avanti = -z quando yaw = 0, come la camera di three.js)
  const sin = Math.sin(b.yaw);
  const cos = Math.cos(b.yaw);
  let wx = -sin * input.fwd + cos * input.side;
  let wz = -cos * input.fwd - sin * input.side;
  const l = Math.hypot(wx, wz);
  if (l > 1) {
    wx /= l;
    wz /= l;
  }
  const tx = wx * speed;
  const tz = wz * speed;
  const k = b.onGround ? 1 : PLAYER.airControl;
  if (b.onGround && !l) {
    const f = Math.max(0, 1 - PLAYER.friction * dt);
    b.vx *= f;
    b.vz *= f;
  }
  b.vx += clamp(tx - b.vx, PLAYER.accel * k * dt);
  b.vz += clamp(tz - b.vz, PLAYER.accel * k * dt);
  let jumped = false;
  if (input.jump && b.onGround && !b.crouch) {
    b.vy = PLAYER.jump;
    b.onGround = false;
    jumped = true;
  }
  b.vy -= PLAYER.gravity * dt;
  const h = b.crouch ? PLAYER.crouchHeight : PLAYER.height;
  slide(b, 0, b.vx * dt, boxes, h);
  slide(b, 2, b.vz * dt, boxes, h);
  b.onGround = false;
  slide(b, 1, b.vy * dt, boxes, h);
  // terreno (nel poligono è il pavimento a y = 0): si sale da soli e, scendendo a piedi, si resta attaccati
  const g = world ? world.height(b.x, b.z) : 0;
  if (b.y < g) {
    b.y = g;
    b.vy = 0;
    b.onGround = true;
  } else if (!b.onGround && wasOnGround && !jumped && b.vy <= 0 && b.y - g < 0.3) {
    b.y = g;
    b.vy = 0;
    b.onGround = true;
  }
  return b;
}

const clamp = (v, m) => Math.max(-m, Math.min(m, v));

function bodyBox(b, h) {
  const r = PLAYER.radius;
  return { min: [b.x - r, b.y, b.z - r], max: [b.x + r, b.y + h, b.z + r] };
}

const overlap = (a, c) =>
  a.min[0] < c.max[0] && a.max[0] > c.min[0] && a.min[1] < c.max[1] && a.max[1] > c.min[1] && a.min[2] < c.max[2] && a.max[2] > c.min[2];

function blocked(b, boxes, h) {
  const me = bodyBox(b, h);
  return boxes.some(c => !c.noWalk && overlap(me, c));
}

// Muove lungo un asse e si ferma contro le scatole; sugli assi orizzontali sale da solo i gradini bassi.
function slide(b, axis, delta, boxes, h) {
  if (!delta) return;
  const key = axis === 0 ? 'x' : axis === 1 ? 'y' : 'z';
  b[key] += delta;
  for (const c of boxes) {
    if (c.noWalk) continue;
    const me = bodyBox(b, h);
    if (!overlap(me, c)) continue;
    if (axis === 1) {
      if (delta < 0) {
        b.y = c.max[1];
        b.onGround = true;
      } else b.y = c.min[1] - h;
      b.vy = 0;
      continue;
    }
    // gradino: se la scatola finisce poco sopra i piedi e sopra c'è posto, si sale
    const rise = c.max[1] - b.y;
    if (rise > 0 && rise <= PLAYER.step && (b.onGround || b.vy <= 0)) {
      const oldY = b.y;
      // si sale; se lì sopra si tocca un altro gradino basso, si sale anche su quello (al massimo 3, PLAYER.stairs in tutto)
      let top = c.max[1];
      let ok = false;
      for (let k = 0; k < 3; k++) {
        b.y = top + 0.001;
        const body = bodyBox(b, h);
        const next = boxes.find(o => !o.noWalk && overlap(body, o));
        if (!next) {
          ok = true;
          break;
        }
        if (next.max[1] - top > PLAYER.step || next.max[1] - oldY > PLAYER.stairs) break;
        top = next.max[1];
      }
      if (ok) continue;
      b.y = oldY;
    }
    const r = PLAYER.radius;
    if (axis === 0) b.x = delta > 0 ? c.min[0] - r - 1e-4 : c.max[0] + r + 1e-4;
    else b.z = delta > 0 ? c.min[2] - r - 1e-4 : c.max[2] + r + 1e-4;
    if (axis === 0) b.vx = 0;
    else b.vz = 0;
  }
}

export function eyeHeight(b) {
  return b.y + (b.crouch ? PLAYER.crouchEye : PLAYER.eye);
}

export function lookDir(yaw, pitch) {
  const c = Math.cos(pitch);
  return { x: -Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

// ---------- giocatori (online) ----------

// Dove si colpisce un giocatore: testa (sfera), busto e gambe (scatole dritte, uguali da ogni lato).
// p: {x, y, z, crouch}. Ritorna {t, zone} oppure null.
export function playerHit(o, d, p, maxT = 300) {
  const k = (p.crouch ? PLAYER.crouchHeight : PLAYER.height) / PLAYER.height;
  const head = raySphere(o, d, { x: p.x, y: p.y + 1.62 * k, z: p.z }, 0.16, maxT);
  const body = rayBox(o, d, { min: [p.x - 0.26, p.y + 0.85 * k, p.z - 0.26], max: [p.x + 0.26, p.y + 1.48 * k, p.z + 0.26] }, maxT);
  const legs = rayBox(o, d, { min: [p.x - 0.2, p.y, p.z - 0.2], max: [p.x + 0.2, p.y + 0.85 * k, p.z + 0.2] }, maxT);
  let best = null;
  for (const [t, zone] of [
    [head, 'testa'],
    [body, 'corpo'],
    [legs, 'gambe']
  ])
    if (t !== null && (!best || t < best.t)) best = { t, zone };
  return best;
}

// Dispersione dell'arma secondo come ci si muove (uguale per il telefono e il server). aimed: si mira con il tasto
// destro (Falco: cannocchiale; le altre armi: metà dispersione).
export const AIM_SPREAD = 0.5;
export function spreadFor(weapon, body, aimed) {
  const w = WEAPONS[weapon];
  let spread = !aimed ? w.spread : weapon === 'falco' ? w.scopedSpread : w.spread * AIM_SPREAD;
  if (w.melee) return 0;
  const moving = Math.hypot(body.vx, body.vz) > 1;
  if (!body.onGround) spread *= 3;
  else if (moving && weapon !== 'tuono') spread *= 2;
  if (body.crouch) spread *= 0.7;
  return spread;
}

// Il coltello alle spalle: chi colpisce sta dietro (entro 60° dalla schiena di chi è colpito).
export function fromBehind(attacker, victim) {
  const dx = victim.x - attacker.x;
  const dz = victim.z - attacker.z;
  const l = Math.hypot(dx, dz) || 1;
  const f = lookDir(victim.yaw, 0);
  return (f.x * dx + f.z * dz) / l > 0.5;
}

// ---------- sagome del poligono ----------

// Sagoma: cerniera in (x,y,z); il cartone guarda verso -z. Zone per i colpi: testa (sfera) e busto (scatola sottile).
export function targetHit(o, d, t, maxT = 300) {
  const head = raySphere(o, d, { x: t.x, y: t.y + 1.43, z: t.z }, 0.13, maxT);
  const body = rayBox(o, d, { min: [t.x - 0.27, t.y + 0.46, t.z - 0.03], max: [t.x + 0.27, t.y + 1.3, t.z + 0.03] }, maxT);
  if (head !== null && (body === null || head <= body)) return { t: head, zone: 'testa' };
  if (body !== null) return { t: body, zone: 'corpo' };
  return null;
}
