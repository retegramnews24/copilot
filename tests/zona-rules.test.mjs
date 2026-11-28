// Zona Operativa: regole del gioco (public/zona/rules.js) e scatole del poligono (public/zona/map-poligono.js).
import assert from 'node:assert/strict';
import {
  PLAYER,
  WEAPONS,
  damage,
  falloff,
  rng,
  newGun,
  tickGun,
  tryFire,
  startReload,
  pelletDirs,
  rayBox,
  rayWorld,
  newBody,
  moveStep,
  lookDir,
  targetHit,
  eyeHeight
} from '../public/zona/rules.js';
import { POLIGONO } from '../public/zona/map-poligono.js';

const run = (body, input, seconds, boxes) => {
  for (let i = 0; i < seconds * 60; i++) moveStep(body, input, 1 / 60, boxes);
  return body;
};

// Danni: «Duro, la testa conta»
assert.equal(damage('ruggito', 'testa', 10), 112, 'Ruggito in testa elimina');
assert.equal(damage('baretta', 'testa', 10), 100, 'Baretta in testa elimina');
assert.ok(damage('calabrone', 'testa', 10) * 2 >= 100 && damage('calabrone', 'testa', 10) < 100, 'Calabrone: due colpi in testa');
assert.equal(Math.ceil(100 / damage('ruggito', 'corpo', 10)), 4, 'Ruggito: 4 colpi al corpo');
assert.equal(Math.ceil(100 / damage('baretta', 'corpo', 10)), 4, 'Baretta: 4 colpi al corpo');
assert.equal(Math.ceil(100 / damage('calabrone', 'corpo', 10)), 6, 'Calabrone: 6 colpi al corpo');
assert.ok(damage('falco', 'corpo', 200) >= 100, 'Falco: un colpo al corpo, a qualsiasi distanza');
assert.ok(damage('tuono', 'corpo', 5) * 8 >= 100, 'Tuono: un colpo da vicino');
assert.equal(damage('ruggito', 'gambe', 10), 21);
assert.equal(falloff('ruggito', 40), 1);
assert.ok(Math.abs(falloff('ruggito', 80) - 0.6) < 1e-9, 'oltre il doppio della distanza resta il 60%');
assert.ok(falloff('tuono', 15) <= 0.06, 'Tuono oltre 15 m quasi niente');

// Caricatori come deciso dal proprietario
assert.deepEqual(
  Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.mag])),
  { baretta: 10, calabrone: 20, tuono: 5, ruggito: 25, falco: 1, coltello: Infinity }
);

// Numeri a caso ripetibili
const a = rng(42);
const b = rng(42);
assert.deepEqual([a(), a(), a()], [b(), b(), b()]);

// Cadenza, munizioni, ricarica
{
  const g = newGun('calabrone');
  let shots = 0;
  for (let i = 0; i < 60; i++) {
    if (tryFire(g) === 'spara') shots++;
    tickGun(g, 1 / 60);
  }
  assert.ok(shots >= 11 && shots <= 13, 'Calabrone: circa 12 colpi in un secondo, sparati ' + shots);
  const r = newGun('ruggito');
  r.ammo = 1;
  assert.equal(tryFire(r), 'spara');
  assert.ok(r.reloading > 0, 'caricatore vuoto: parte la ricarica');
  let t = 0;
  while (r.reloading > 0) {
    tickGun(r, 0.01);
    t += 0.01;
  }
  assert.ok(Math.abs(t - 2.3) < 0.05, 'Ruggito: ricarica 2,3 s');
  assert.equal(r.ammo, 25);
  const f = newGun('falco');
  assert.equal(tryFire(f), 'spara');
  assert.ok(f.reloading > 0, 'Falco: un colpo e si ricarica');
  assert.equal(tryFire(f), null);
  const s = newGun('tuono');
  s.ammo = 2;
  assert.ok(startReload(s));
  for (let i = 0; i < 55; i++) tickGun(s, 0.01);
  assert.equal(s.ammo, 3, 'Tuono: una cartuccia ogni 0,5 s');
  s.cooldown = 0;
  assert.equal(tryFire(s), 'spara', 'Tuono: si spara anche a metà ricarica');
  const k = newGun('coltello');
  assert.equal(tryFire(k), 'spara');
  assert.equal(k.ammo, Infinity);
  const e = newGun('baretta');
  e.ammo = 0;
  assert.equal(tryFire(e), 'vuoto');
}

// Dispersione: i pallini restano nel cono
{
  const dirs = pelletDirs({ x: 0, y: 0, z: -1 }, 0.06, 8, rng(1));
  assert.equal(dirs.length, 8);
  for (const d of dirs) assert.ok(Math.acos(-d.z) <= 0.0601);
}

// Raggi
assert.equal(rayBox({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { min: [-1, 0, 5], max: [1, 2, 6] }), 5);
assert.equal(rayBox({ x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: 1 }, { min: [-1, 0, 5], max: [1, 2, 6] }), null);

// Movimento nel poligono: si parte nella sala, si cammina fino al bancone, i muri fermano
{
  const s = POLIGONO.start;
  const body = newBody(s.x, s.y, s.z, s.yaw);
  run(body, { fwd: 0, side: 0, yaw: s.yaw, pitch: 0 }, 0.5, POLIGONO.boxes);
  assert.ok(body.onGround && Math.abs(body.y) < 1e-6, 'si sta in piedi sul pavimento');
  const walker = newBody(-5, 0, -7, s.yaw);
  run(walker, { fwd: 0, side: -1, walk: true, yaw: s.yaw, pitch: 0 }, 1, POLIGONO.boxes);
  assert.ok(walker.x > -0.5 && walker.x < 0.5, 'camminando in un secondo si fanno circa 5 m: ' + walker.x);
  const runner = newBody(-5, 0, -7, s.yaw);
  run(runner, { fwd: 0, side: -1, yaw: s.yaw, pitch: 0 }, 1, POLIGONO.boxes);
  assert.ok(runner.x > 1.2 && runner.x < 2.2, 'correndo in un secondo si fanno circa 7 m: ' + runner.x);
  // saltando contro una pietra di 1,2 m si sale sopra, anche sbattendo contro il bordo mentre si sale
  for (const from of [0.4, 0.9, 1.4]) {
    const rock = [{ min: [-1, 0, -3], max: [1, 1.2, -2] }];
    const r = newBody(0, 0, -2 + PLAYER.radius + from, 0);
    r.onGround = true;
    let landed = false;
    for (let i = 0; i < 90 && !landed; i++) {
      moveStep(r, { fwd: 1, side: 0, walk: true, jump: i === 0, yaw: 0, pitch: 0 }, 1 / 60, rock);
      landed = r.onGround && Math.abs(r.y - 1.2) < 0.01;
    }
    assert.ok(landed, 'sulla pietra saltando a ' + from + ' m dal bordo: ' + r.y);
  }
  // un muro di 1,6 m invece non si sale
  {
    const wall = [{ min: [-1, 0, -3], max: [1, 1.6, -2] }];
    const r = newBody(0, 0, -2 + PLAYER.radius + 0.6, 0);
    r.onGround = true;
    let top = 0;
    for (let i = 0; i < 90; i++) {
      moveStep(r, { fwd: 1, side: 0, walk: true, jump: i === 0, yaw: 0, pitch: 0 }, 1 / 60, wall);
      if (r.onGround) top = Math.max(top, r.y);
    }
    assert.ok(top < 0.01 && r.z > -2, 'un muro di 1,6 m non si sale: ' + top);
  }
  run(body, { fwd: 1, side: 0, yaw: s.yaw, pitch: 0 }, 8, POLIGONO.boxes);
  assert.ok(Math.abs(body.z - (-5.4 - PLAYER.radius)) < 0.01, 'il bancone delle armi ferma: ' + body.z);
  const lane = newBody(5.6, 0, -1.2, s.yaw);
  run(lane, { fwd: 1, side: 0, yaw: s.yaw, pitch: 0 }, 4, POLIGONO.boxes);
  assert.ok(Math.abs(lane.z - (-0.05 - PLAYER.radius)) < 0.01, 'la mensola della linea di tiro ferma: ' + lane.z);
  run(lane, { fwd: 0, side: -1, yaw: s.yaw, pitch: 0 }, 3, POLIGONO.boxes);
  assert.ok(Math.abs(lane.x - (7 - PLAYER.radius)) < 0.01, 'il muro ferma: ' + lane.x);
  run(lane, { fwd: 0, side: 1, yaw: s.yaw, pitch: 0 }, 3, POLIGONO.boxes); // guardando verso +z la destra è -x
  assert.ok(lane.x > 4.26 + PLAYER.radius - 0.01 && lane.x < 4.6, 'il separatore ferma di lato: ' + lane.x);
  const j = newBody(0, 0, 3, 0);
  run(j, { fwd: 0, side: 0, yaw: 0, pitch: 0 }, 0.2, POLIGONO.boxes);
  j.onGround = true;
  moveStep(j, { fwd: 0, side: 0, yaw: 0, pitch: 0, jump: true }, 1 / 60, POLIGONO.boxes);
  let top = 0;
  for (let i = 0; i < 90; i++) {
    moveStep(j, { fwd: 0, side: 0, yaw: 0, pitch: 0 }, 1 / 60, POLIGONO.boxes);
    top = Math.max(top, j.y);
  }
  assert.ok(top > 0.85 && top < 1.15, 'il salto alza di circa 1 m: ' + top);
  const c = newBody(0, 0, 3, 0);
  moveStep(c, { fwd: 0, side: 0, yaw: 0, pitch: 0, crouch: true }, 1 / 60, POLIGONO.boxes);
  assert.ok(eyeHeight(c) < 1.2, 'accucciati si guarda più in basso');
}

// Colpi: il raggio si ferma sul muro; la sagoma ha testa e busto
{
  const o = { x: 0, y: 1.5, z: 0 };
  const hitWall = rayWorld(o, { x: 1, y: 0, z: 0 }, POLIGONO.boxes);
  assert.ok(hitWall && Math.abs(hitWall.t - 7) < 1e-6, 'il muro di destra è a 7 m');
  const shot = rayWorld({ x: 0, y: 1.5, z: 1 }, { x: 0, y: 0, z: 1 }, POLIGONO.boxes);
  assert.ok(shot.t > 30, 'oltre la linea di tiro si spara: la barriera invisibile non ferma i colpi');
  const target = { x: 0, y: 0.22, z: 20 };
  const dHead = lookDir(Math.PI, Math.atan2(1.65 - 1.65, 20));
  assert.equal(targetHit({ x: 0, y: 1.65, z: 0 }, dHead, target).zone, 'testa');
  const dBody = { x: 0, y: (1.1 - 1.65) / 20, z: 1 };
  const l = Math.hypot(dBody.y, 1);
  assert.equal(targetHit({ x: 0, y: 1.65, z: 0 }, { x: 0, y: dBody.y / l, z: 1 / l }, target).zone, 'corpo');
  assert.equal(targetHit({ x: 0, y: 1.65, z: 0 }, { x: 1, y: 0, z: 0 }, target), null);
}

console.log('PASS Zona Operativa: regole, armi, movimento e colpi del poligono');
