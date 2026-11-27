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

// input: {fwd, side (-1..1), jump, crouch, walk, yaw, pitch}
export function moveStep(b, input, dt, boxes) {
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
  if (input.jump && b.onGround && !b.crouch) {
    b.vy = PLAYER.jump;
    b.onGround = false;
  }
  b.vy -= PLAYER.gravity * dt;
  const h = b.crouch ? PLAYER.crouchHeight : PLAYER.height;
  slide(b, 0, b.vx * dt, boxes, h);
  slide(b, 2, b.vz * dt, boxes, h);
  b.onGround = false;
  slide(b, 1, b.vy * dt, boxes, h);
  if (b.y < 0) {
    b.y = 0;
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
      b.y = c.max[1] + 0.001;
      if (!blocked(b, boxes, h)) continue;
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

// ---------- sagome del poligono ----------

// Sagoma: cerniera in (x,y,z); il cartone guarda verso -z. Zone per i colpi: testa (sfera) e busto (scatola sottile).
export function targetHit(o, d, t, maxT = 300) {
  const head = raySphere(o, d, { x: t.x, y: t.y + 1.43, z: t.z }, 0.13, maxT);
  const body = rayBox(o, d, { min: [t.x - 0.27, t.y + 0.46, t.z - 0.03], max: [t.x + 0.27, t.y + 1.3, t.z + 0.03] }, maxT);
  if (head !== null && (body === null || head <= body)) return { t: head, zone: 'testa' };
  if (body !== null) return { t: body, zone: 'corpo' };
  return null;
}
