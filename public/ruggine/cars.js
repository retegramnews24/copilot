// Le auto di Ruggine 89: modelli 3D (telaio, roll-bar, ruote che girano e sterzano), guida arcade, avversari, colpi.
import * as THREE from 'three';
import { N, HALF, WALL, at, frame, nearest } from './world.js?v=63baabd3ac';

const box = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 18); wheelGeo.rotateX(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.38, 8); rimGeo.rotateX(Math.PI / 2);
const barGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);

function numberTex(n, col) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f3ead2'; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill();
  g.fillStyle = '#1b1a17'; g.font = 'italic 900 70px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 68);
  // graffi e ruggine
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},50,30,${Math.random() * 0.35})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// modello: l'auto guarda verso +x
export function carModel(color, num) {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, metalness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2a27', roughness: 0.7, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: '#8a8b86', roughness: 0.35, metalness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1d2a2e', roughness: 0.08, metalness: 0.2, clearcoat: 1 });
  const part = (mat, x, y, z, w, h, d, rz = 0) => { const m = new THREE.Mesh(box, mat); m.position.set(x, y, z); m.scale.set(w, h, d); m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; body.add(m); return m; };
  part(dark, 0.05, 0.42, 0, 3.5, 0.16, 1.9);                       // pianale
  part(paint, 0, 0.78, 0, 3.3, 0.6, 1.7);                          // scocca
  part(paint, 1.25, 0.95, 0, 1.1, 0.3, 1.6, -0.18);               // cofano inclinato
  part(glass, -0.25, 1.28, 0, 1.45, 0.42, 1.42);                   // abitacolo
  const roof = part(new THREE.MeshStandardMaterial({ map: numberTex(num, '#' + new THREE.Color(color).getHexString()), roughness: 0.5 }), -0.3, 1.52, 0, 1.25, 0.08, 1.36);
  roof.castShadow = true;
  part(dark, -1.62, 1.15, 0, 0.18, 0.12, 2.0);                     // alettone
  for (const z of [-0.8, 0.8]) part(dark, -1.55, 0.95, z, 0.12, 0.4, 0.08);
  part(steel, 1.78, 0.62, 0, 0.18, 0.28, 1.75);                     // paraurti a tubi
  for (const z of [-0.55, 0.55]) part(steel, 1.86, 0.85, z, 0.1, 0.55, 0.1);
  // roll-bar
  for (const z of [-0.62, 0.62]) { const b = new THREE.Mesh(barGeo, steel); b.scale.y = 0.75; b.position.set(-0.95, 1.45, z); b.castShadow = true; body.add(b); }
  const rb = new THREE.Mesh(barGeo, steel); rb.rotation.x = Math.PI / 2; rb.scale.y = 1.3; rb.position.set(-0.95, 1.82, 0); body.add(rb);
  // scarichi
  for (const z of [-0.5, 0.5]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), steel); e.rotation.z = Math.PI / 2; e.position.set(-1.85, 0.55, z); body.add(e); }
  // fari
  const headM = new THREE.MeshStandardMaterial({ color: '#fff1c8', emissive: '#ffd98a', emissiveIntensity: 1.6 });
  for (const z of [-0.6, 0.6]) part(headM, 1.66, 0.86, z, 0.06, 0.18, 0.32);
  const tailM = new THREE.MeshStandardMaterial({ color: '#4a0f0b', emissive: '#ff2a1a', emissiveIntensity: 0.4 });
  const tails = [-0.62, 0.62].map((z) => part(tailM, -1.66, 0.86, z, 0.05, 0.14, 0.3));
  // ruote
  const tyreM = new THREE.MeshStandardMaterial({ color: '#1b1b1c', roughness: 0.92 });
  const wheels = [];
  for (const [x, z, front] of [[1.08, -0.92, true], [1.08, 0.92, true], [-1.05, -0.92, false], [-1.05, 0.92, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z);
    const spin = new THREE.Group();
    const t = new THREE.Mesh(wheelGeo, tyreM); t.castShadow = true;
    const r = new THREE.Mesh(rimGeo, steel);
    spin.add(t, r); pivot.add(spin); g.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  g.userData = { body, wheels, tailM };
  return g;
}

export class Car {
  constructor(scene, color, num, name, ai) {
    this.mesh = carModel(color, num);
    scene.add(this.mesh);
    this.name = name; this.ai = ai; this.color = color;
    this.lane = 0; this.skill = 1;
  }
  place(progress, lane) {
    const f = frame(progress);
    Object.assign(this, {
      x: f.x + lane * f.nx, z: f.z + lane * f.nz, a: f.a, v: 0, vx: 0, vz: 0, steer: 0, idx: ((progress % N) + N) % N,
      progress, stun: 0, spin: 0, cool: 0, finish: 0, boost: 0, lane: lane * 0.6, roll: 0, pitch: 0, slide: 0, offroad: false,
      lastLap: 0, best: 0,
    });
    this.pose(0);
  }
  pose(dt) {
    const m = this.mesh, u = m.userData;
    m.position.set(this.x, 0, this.z);
    m.rotation.y = -this.a + this.spin;
    // carrozzeria che si inclina in curva e beccheggia in accelerazione
    u.body.rotation.x = THREE.MathUtils.lerp(u.body.rotation.x, -this.roll * 0.08, 0.2);
    u.body.rotation.z = THREE.MathUtils.lerp(u.body.rotation.z, this.pitch * 0.03, 0.15);
    u.body.position.y = Math.sin(performance.now() * 0.03 + this.x) * 0.012 * Math.min(1, Math.abs(this.v) / 10);
    for (const w of u.wheels) {
      w.spin.rotation.z -= (this.v * dt) / 0.42;
      if (w.front) w.pivot.rotation.y = -this.steer * 0.45;
    }
    u.tailM.emissiveIntensity = this.braking ? 2.2 : 0.4;
    m.visible = this.stun <= 0 || Math.floor(this.stun * 16) % 2 === 0;
  }
}

// input: { steer -1..1, gas, brake, fire }
export function drive(c, input, dt, cars) {
  if (c.finish) { c.v *= Math.exp(-dt * 1.2); input = { steer: 0, gas: false, brake: false }; }
  c.stun = Math.max(0, c.stun - dt); c.cool = Math.max(0, c.cool - dt); c.boost = Math.max(0, c.boost - dt);
  c.spin *= Math.exp(-dt * 5);
  const p = at(c.idx), off = Math.hypot(c.x - p.x, c.z - p.z);
  c.offroad = off > HALF + 0.6;
  const gas = input.gas && c.stun <= 0, top = (c.boost > 0 ? 33 : 26) * (c.offroad ? 0.62 : 1);
  c.braking = !!input.brake;
  c.v += (gas ? (c.boost > 0 ? 22 : 14) * dt : 0) - (input.brake ? 24 * dt : 0);
  c.v *= Math.exp(-dt * (c.stun > 0 ? 3.5 : c.offroad ? 1.6 : gas ? 0.32 : 0.5));
  c.v = THREE.MathUtils.clamp(c.v, -6, top);
  c.steer = THREE.MathUtils.lerp(c.steer, input.steer, 1 - Math.exp(-dt * 10));
  const turn = c.steer * 2.6 * Math.min(1, Math.abs(c.v) / 6) * Math.sign(c.v) * (c.offroad ? 0.8 : 1);
  c.a += turn * dt;
  // aderenza: sullo sterrato e in frenata la macchina scivola di più (derapata)
  const grip = 1 - Math.exp(-dt * (input.brake ? 3.4 : c.offroad ? 3 : 6.4));
  const fx = Math.cos(c.a) * c.v, fz = Math.sin(c.a) * c.v;
  c.slide = Math.hypot(c.vx - fx, c.vz - fz);
  c.vx += (fx - c.vx) * grip; c.vz += (fz - c.vz) * grip;
  c.x += c.vx * dt; c.z += c.vz * dt;
  c.roll = THREE.MathUtils.lerp(c.roll, turn * Math.min(1, Math.abs(c.v) / 14), 0.2);
  c.pitch = THREE.MathUtils.lerp(c.pitch, gas ? -1 : input.brake ? 1.4 : 0, 0.08);
  // muro di gomme: rimbalzo morbido
  const idx = nearest(c.x, c.z, c.idx), q = at(idx), dx = c.x - q.x, dz = c.z - q.z, d = Math.hypot(dx, dz);
  c.hitWall = 0;
  if (d > WALL) {
    c.x = q.x + (dx / d) * WALL; c.z = q.z + (dz / d) * WALL;
    const outv = (c.vx * dx + c.vz * dz) / d;
    if (outv > 0) { c.vx -= (dx / d) * outv * 1.5; c.vz -= (dz / d) * outv * 1.5; c.hitWall = outv; }
    c.v *= Math.exp(-2.2 * dt);
  }
  // avanzamento lungo il tracciato (giri)
  const step = ((idx - c.idx + N * 1.5) % N) - N / 2;
  c.progress += step; c.idx = idx;
  if (c.progress >= 3 * N && !c.finish) c.finish = true;
}

// pilota automatico: segue la sua corsia, frena prima delle curve, spara a chi ha davanti
export function aiInput(c, cars, dt) {
  const look = 9 + Math.abs(c.v) * 0.35;
  const f = frame(c.idx + Math.round(look)), far = frame(c.idx + Math.round(look * 2.2));
  const ang = Math.atan2(f.z + f.nz * c.lane - c.z, f.x + f.nx * c.lane - c.x);
  const delta = Math.atan2(Math.sin(ang - c.a), Math.cos(ang - c.a));
  const curve = Math.abs(Math.atan2(Math.sin(far.a - f.a), Math.cos(far.a - f.a)));
  const target = (24 - curve * 16) * c.skill;
  // ogni tanto cambia corsia, per sorpassare o schivare
  c.laneT = (c.laneT || 0) - dt;
  if (c.laneT <= 0) { c.lane = (Math.random() * 2 - 1) * (HALF - 1.6); c.laneT = 2 + Math.random() * 3; }
  let fire = false;
  for (const o of cars) {
    if (o === c || o.finish) continue;
    const rx = o.x - c.x, rz = o.z - c.z, fwd = Math.cos(c.a) * rx + Math.sin(c.a) * rz, side = Math.abs(Math.sin(c.a) * rx - Math.cos(c.a) * rz);
    if (fwd > 2 && fwd < 22 && side < 1.3) fire = Math.random() < 0.08;
  }
  return { steer: THREE.MathUtils.clamp(delta * 2.2, -1, 1), gas: c.v < target, brake: c.v > target + 4, fire };
}

// urti fra auto: si spingono e si scambiano un po' di velocità
export function bump(cars, onHit) {
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
    const c = cars[a], o = cars[b], dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
    if (d >= 2.1 || d < 0.001) continue;
    const nx = dx / d, nz = dz / d, push = (2.1 - d) / 2;
    c.x -= nx * push; c.z -= nz * push; o.x += nx * push; o.z += nz * push;
    const rel = (c.vx - o.vx) * nx + (c.vz - o.vz) * nz;
    if (rel > 0) { c.vx -= nx * rel * 0.6; c.vz -= nz * rel * 0.6; o.vx += nx * rel * 0.6; o.vz += nz * rel * 0.6; onHit && onHit((c.x + o.x) / 2, (c.z + o.z) / 2, rel); }
  }
}

// colpi: proiettili luminosi che stordiscono e fanno girare l'auto colpita
const shotGeo = new THREE.CapsuleGeometry(0.22, 1.2, 4, 8); shotGeo.rotateZ(Math.PI / 2);
const shotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe27a').multiplyScalar(2.5) });
export class Shots {
  constructor(scene) { this.scene = scene; this.list = []; }
  fire(c) {
    if (c.cool > 0 || c.stun > 0 || c.finish) return false;
    c.cool = 0.7;
    const dx = Math.cos(c.a), dz = Math.sin(c.a);
    const mesh = new THREE.Mesh(shotGeo, shotMat);
    mesh.position.set(c.x + 2.2 * dx, 0.95, c.z + 2.2 * dz); mesh.rotation.y = -c.a;
    this.scene.add(mesh);
    this.list.push({ mesh, owner: c, dx, dz, life: 0.75, v: 52 + Math.max(0, c.v) });
    return true;
  }
  update(dt, cars, onHit) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i], p = s.mesh.position;
      p.x += s.dx * s.v * dt; p.z += s.dz * s.v * dt; s.life -= dt;
      const hit = cars.find((c) => c !== s.owner && !c.finish && Math.hypot(c.x - p.x, c.z - p.z) < 1.6);
      if (hit) { hit.stun = 0.9; hit.v *= 0.45; hit.spin = (Math.random() < 0.5 ? -1 : 1) * 2.4; onHit(hit, p.x, p.z); }
      if (hit || s.life <= 0) { this.scene.remove(s.mesh); this.list.splice(i, 1); }
    }
  }
  clear() { for (const s of this.list) this.scene.remove(s.mesh); this.list.length = 0; }
}
