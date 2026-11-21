// Il mondo di Ruggine 89: deserto al tramonto, la raffineria e il circuito (asfalto, cordoli, barriere, portale).
import * as THREE from 'three';

export const N = 520;          // punti del tracciato
export const HALF = 4.9;       // metà larghezza della carreggiata
export const WALL = 6.2;       // oltre questa distanza dal centro c'è il muro di gomme
const CONTROLS = [[-12, 22], [13, 22], [29, 17], [39, 21], [49, 15], [48, 3], [39, -4], [45, -16], [36, -23], [17, -22], [7, -13], [-5, -13], [-15, -23], [-34, -21], [-47, -13], [-48, 0], [-36, 7], [-39, 16], [-30, 22]];
const S = 1.25; // il circuito originale, un po' più grande

// generatore pseudo-casuale con seme (scenario sempre uguale)
let seed = 1989;
export const rnd = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);

// ---------- tracciato ----------
const curve = new THREE.CatmullRomCurve3(CONTROLS.map(([x, z]) => new THREE.Vector3(x * S, 0, z * S)), true, 'centripetal');
export const track = curve.getSpacedPoints(N).slice(0, N);
export const at = (i) => track[((i % N) + N) % N];
export function frame(i) {
  const p = at(i), q = at(i + 1), a = Math.atan2(q.z - p.z, q.x - p.x);
  return { x: p.x, z: p.z, a, nx: -Math.sin(a), nz: Math.cos(a) };
}
export function nearest(x, z, around = null) {
  let idx = 0, best = Infinity;
  const from = around === null ? 0 : around - 18, end = around === null ? N : around + 19;
  for (let i = from; i < end; i++) { const p = at(i), d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < best) { idx = ((i % N) + N) % N; best = d; } }
  return idx;
}
// curvatura locale (per i cordoli: solo dove la strada gira)
function bend(i) {
  const a = frame(i - 6).a, b = frame(i + 6).a;
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

// ---------- texture disegnate ----------
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function noise(g, w, h, n, cols, size) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; const s = Math.random() * size + 0.5; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
}
const asphaltTex = () => tex(512, 512, (g, w, h) => {
  g.fillStyle = '#46484a'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 26000, ['#3c3e40', '#55575a', '#2f3133', '#606264'], 2.2);
  // crepe e rattoppi
  g.strokeStyle = 'rgba(20,20,22,0.55)'; g.lineWidth = 1.4;
  for (let k = 0; k < 9; k++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 40; g.lineTo(x, y); } g.stroke(); }
  for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(30,31,33,0.5)'; g.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 30 + Math.random() * 60); }
  // segni di gomma al centro
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(15,15,15,0.28)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, true);
const curbTex = () => tex(64, 256, (g, w, h) => {
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#e9dfc6' : '#b8432f'; g.fillRect(0, (i * h) / 4, w, h / 4); }
  noise(g, w, h, 900, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.08)'], 2);
}, true);
const sandTex = () => tex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#a5784e'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 90000, ['#9a6d45', '#b88a5c', '#8c6341', '#c39a6a', '#7d583a'], 2.6);
  for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 30},${40},0.12)`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 90, 10 + Math.random() * 40, Math.random() * 3, 0, 7); g.fill(); }
}, true);
const rustTex = () => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#8a8a80'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(${130 + Math.random() * 60},${60 + Math.random() * 30},${30},${0.15 + Math.random() * 0.4})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 18, 2 + Math.random() * 30, 0, 0, 7); g.fill(); }
  for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y, w, 2); }
  noise(g, w, h, 4000, ['rgba(0,0,0,0.15)', 'rgba(255,240,220,0.08)'], 1.5);
}, true);

// ---------- costruzione della scena ----------
export function buildWorld(scene, renderer, quality) {
  const out = { flames: [], smokers: [], lights: [] };
  // cielo: gradiente al tramonto su una sfera
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5a6f8f') }, mid: { value: new THREE.Color('#e7a86b') }, low: { value: new THREE.Color('#c97b4e') } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vp; void main(){ float h = vp.y; vec3 c = mix(mid, top, smoothstep(0.02, 0.5, h)); c = mix(low, c, smoothstep(-0.1, 0.05, h)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog('#c99267', 110, 330);
  // riflessi: ambiente ricavato dal cielo
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene(); es.add(sky.clone());
  scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();

  // luci: sole basso e caldo, con ombre sul circuito
  scene.add(new THREE.HemisphereLight('#ffe2bf', '#6b4a33', 0.9));
  const sun = new THREE.DirectionalLight('#ffd09a', 2.6);
  sun.position.set(-70, 85, -45);
  sun.castShadow = quality !== 'bassa';
  const sz = quality === 'alta' ? 2048 : 1024;
  sun.shadow.mapSize.set(sz, sz);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 60, bottom: -60, near: 10, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  out.sun = sun;

  // terreno: sabbia rossiccia con qualche duna lontana
  const sand = sandTex(); sand.repeat.set(24, 24);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), new THREE.MeshStandardMaterial({ map: sand, roughness: 0.96 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
  const duneM = new THREE.MeshStandardMaterial({ map: sand, roughness: 1, color: '#d9b28a' });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd() * 0.2, r = 150 + rnd() * 90;
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), duneM);
    d.scale.set(30 + rnd() * 40, 6 + rnd() * 14, 18 + rnd() * 20); d.position.set(Math.cos(a) * r, -1, Math.sin(a) * r); d.rotation.y = rnd() * 3;
    scene.add(d);
  }

  // strada: nastro con asfalto, banchina di terra battuta e cordoli nelle curve
  const ribbon = (inner, outer, mat, y, vScale, keep = () => true) => {
    const pos = [], uv = [], idx = [];
    let dist = 0;
    for (let i = 0; i <= N; i++) {
      const f = frame(i);
      if (i) dist += Math.hypot(f.x - at(i - 1).x, f.z - at(i - 1).z);
      for (const [o, u] of [[inner, 0], [outer, 1]]) { pos.push(f.x + f.nx * o, y, f.z + f.nz * o); uv.push(u, dist / vScale); }
    }
    // verso dei triangoli: la faccia deve guardare in alto (dipende da che lato è "inner")
    const ax = pos[3] - pos[0], az = pos[5] - pos[2], bx = pos[6] - pos[0], bz = pos[8] - pos[2];
    const up = az * bx - ax * bz > 0;
    for (let i = 0; i < N; i++) if (keep(i)) { const a = i * 2; if (up) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
  };
  const dirt = new THREE.MeshStandardMaterial({ color: '#8c6b4c', map: sand, roughness: 1 });
  ribbon(-WALL - 1.4, WALL + 1.4, dirt, 0.004, 6);
  const asphalt = asphaltTex();
  ribbon(-HALF, HALF, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.82, metalness: 0.05 }), 0.012, 9.8);
  const curb = new THREE.MeshStandardMaterial({ map: curbTex(), roughness: 0.7 });
  for (const s of [-1, 1]) ribbon(s * HALF, s * (HALF + 0.9), curb, 0.02, 3.2, (i) => Math.abs(bend(i)) > 0.09);
  // righe bianche ai bordi
  const lineM = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.6 });
  for (const s of [-1, 1]) ribbon(s * (HALF - 0.35), s * (HALF - 0.2), lineM, 0.018, 4);

  // linea del traguardo a scacchi
  const gate = frame(0);
  const chk = tex(256, 64, (g, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#1c1d1d' : '#f1e6cc'; g.fillRect(i * 16, j * 16, 16, 16); } });
  const fin = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 1.6), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.7 }));
  fin.rotation.x = -Math.PI / 2; fin.rotation.z = -gate.a + Math.PI / 2; fin.position.set(gate.x, 0.025, gate.z); fin.receiveShadow = true; scene.add(fin);

  // ---------- oggetti (instanced per andare veloci) ----------
  const rust = rustTex();
  const M = {
    tyre: new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.9 }),
    tyreRed: new THREE.MeshStandardMaterial({ color: '#8e2d24', roughness: 0.85 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#b9ad97', roughness: 0.95 }),
    tank: new THREE.MeshStandardMaterial({ map: rust, color: '#d8d3c6', roughness: 0.55, metalness: 0.55 }),
    tankRed: new THREE.MeshStandardMaterial({ map: rust, color: '#b0563a', roughness: 0.6, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: '#5f6461', roughness: 0.45, metalness: 0.8 }),
    pipe: new THREE.MeshStandardMaterial({ color: '#9b8d78', roughness: 0.5, metalness: 0.6 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#d9a531', roughness: 0.55, metalness: 0.3 }),
    rock: new THREE.MeshStandardMaterial({ color: '#7d5a40', roughness: 1, flatShading: true }),
    shed: new THREE.MeshStandardMaterial({ map: rust, color: '#8f7d68', roughness: 0.7, metalness: 0.3 }),
    barrel: new THREE.MeshStandardMaterial({ color: '#4f6f5c', roughness: 0.6, metalness: 0.4 }),
    barrelR: new THREE.MeshStandardMaterial({ color: '#9b3b2a', roughness: 0.6, metalness: 0.4 }),
  };
  const G = {
    box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 24), cylLo: new THREE.CylinderGeometry(1, 1, 1, 10),
    torus: new THREE.TorusGeometry(0.42, 0.2, 8, 16), rock: new THREE.DodecahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 1, 16),
  };
  const batches = new Map(), dummy = new THREE.Object3D();
  const put = (geo, mat, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => {
    const k = geo.uuid + mat.uuid;
    if (!batches.has(k)) batches.set(k, { geo, mat, list: [] });
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    batches.get(k).list.push(dummy.matrix.clone());
  };
  out.put = put; out.M = M; out.G = G;

  // muri di gomme all'esterno delle curve, blocchi di cemento sui rettilinei
  for (let i = 0; i < N; i += 2) {
    const f = frame(i), b = bend(i);
    for (const s of [-1, 1]) {
      const x = f.x + f.nx * s * (WALL + 0.6), z = f.z + f.nz * s * (WALL + 0.6);
      if (Math.abs(b) > 0.07 && Math.sign(b) !== s) {
        for (let k = 0; k < 2; k++) put(G.torus, (i / 2 + k) % 3 ? M.tyre : M.tyreRed, x, 0.2 + k * 0.4, z, 1.5, 1.5, 1.5, 0, Math.PI / 2);
      } else if (i % 6 === 0 && i % 72 < 48) put(G.box, M.concrete, x, 0.45, z, 2.8, 0.9, 0.7, -f.a);
    }
  }

  // portale di partenza con il semaforo
  const gf = frame(0);
  const portal = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(G.box, M.steel); p.scale.set(0.6, 7, 0.6); p.position.set(0, 3.5, s * (HALF + 1.4)); p.castShadow = true; portal.add(p); }
  const beam = new THREE.Mesh(G.box, M.yellow); beam.scale.set(1.1, 1.2, HALF * 2 + 3.4); beam.position.y = 7.1; beam.castShadow = true; portal.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 1.1), new THREE.MeshStandardMaterial({ map: tex(512, 64, (g, w, h) => { g.fillStyle = '#1e1c19'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffba4a'; g.font = 'italic 900 44px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RUGGINE 89 · RAFFINERIA', w / 2, h / 2 + 2); }), roughness: 0.6 }));
  banner.position.set(-0.56, 6.1, 0); banner.rotation.y = -Math.PI / 2; portal.add(banner);
  out.lamps = [];
  for (let k = 0; k < 5; k++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshStandardMaterial({ color: '#2a0d0b', emissive: '#ff2a12', emissiveIntensity: 0 }));
    l.position.set(-0.6, 7.1, (k - 2) * 0.8); portal.add(l); out.lamps.push(l);
  }
  portal.position.set(gf.x, 0, gf.z); portal.rotation.y = -gf.a; scene.add(portal);

  // la raffineria al centro del circuito e intorno
  const tank = (x, z, r, h, red) => {
    put(G.cyl, M.concrete, x, 0.2, z, r + 0.6, 0.4, r + 0.6);
    put(G.cyl, red ? M.tankRed : M.tank, x, h / 2 + 0.4, z, r, h, r);
    put(G.cyl, M.steel, x, h + 0.5, z, r * 1.01, 0.2, r * 1.01);
    put(G.cone, red ? M.tankRed : M.tank, x, h + 0.85, z, r, 0.7, r);
    // scaletta a spirale
    for (let k = 0; k < 8; k++) { const a = k * 0.5; put(G.box, M.yellow, x + Math.cos(a) * (r + 0.15), 0.6 + (k * h) / 8, z + Math.sin(a) * (r + 0.15), 0.12, 0.12, 1.1, -a); }
  };
  tank(-23, -2.5, 4.2, 5.5); tank(-33, -3.6, 3.8, 6.4, true); tank(-28.5, -12.5, 2.8, 4.2); tank(-14, -8, 2.2, 3.6, true);
  // torre di distillazione con piattaforme
  const tower = (x, z, r, h) => {
    put(G.cyl, M.pipe, x, h / 2, z, r, h, r);
    for (let y = 3; y < h; y += 3.2) { put(G.cylLo, M.steel, x, y, z, r + 1.1, 0.15, r + 1.1); for (let a = 0; a < 6; a++) put(G.box, M.yellow, x + Math.cos(a) * (r + 1.05), y + 0.55, z + Math.sin(a) * (r + 1.05), 0.06, 1, 1.2, -a - Math.PI / 2); }
    put(G.cone, M.pipe, x, h + 0.6, z, r, 1.2, r);
  };
  tower(14, -3.5, 1.2, 15); tower(19, -1, 0.9, 11.5); tower(9.5, 1.8, 0.75, 9);
  // tubi lungo il terreno (fasci) con supporti
  for (const [x1, z1, x2, z2] of [[-14, 5, 10, 5], [10, 5, 10, -7], [-18, 8, -18, -16], [22, -8, 40, -8]]) {
    const len = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(z2 - z1, x2 - x1);
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * 0.55, ox = -Math.sin(a) * off, oz = Math.cos(a) * off;
      put(G.cylLo, k === 1 ? M.tankRed : M.pipe, (x1 + x2) / 2 + ox, 1.3 + k * 0.05, (z1 + z2) / 2 + oz, 0.22, len, 0.22, -a, 0, Math.PI / 2);
    }
    for (let t = 0; t <= len; t += 4) put(G.box, M.steel, x1 + Math.cos(a) * t, 0.6, z1 + Math.sin(a) * t, 0.25, 1.2, 1.8, -a);
  }
  // capannoni e container
  for (const [x, z, w, d, h, r] of [[2, 10, 12, 6, 3.4, 0], [-5, -4, 7, 4.5, 2.6, 0.1], [30, 5, 8, 5, 3, 0.4]]) {
    put(G.box, M.shed, x, h / 2, z, w, h, d, r);
    put(G.box, M.steel, x, h + 0.25, z, w + 0.4, 0.5, d * 0.6, r);
  }
  const cont = [M.tankRed, M.barrel, M.shed, M.yellow];
  for (let k = 0; k < 9; k++) put(G.box, cont[k % 4], 24 + (k % 3) * 2.6, 1.3 + Math.floor(k / 3) * 0 + (k > 5 ? 2.6 : 0), -14 + (k % 3) * 0.3 + (k > 5 ? 1.3 : Math.floor(k / 3) * 2.8), 6, 2.6, 2.4, 0.05);
  // barili sparsi
  for (let k = 0; k < 40; k++) {
    const x = -10 + rnd() * 30, z = -8 + rnd() * 18;
    const p = at(nearest(x, z));
    if (Math.hypot(x - p.x, z - p.z) < WALL + 2.5) continue;
    put(G.cylLo, k % 3 ? M.barrel : M.barrelR, x, 0.45, z, 0.32, 0.9, 0.32, rnd() * 3);
  }
  // rocce nel deserto (non sul circuito)
  for (let k = 0; k < 260; k++) {
    const x = rnd() * 220 - 110, z = rnd() * 150 - 75, p = at(nearest(x, z));
    if (Math.hypot(x - p.x, z - p.z) < WALL + 3 || (Math.abs(x) < 36 && Math.abs(z) < 16)) continue;
    const r = 0.4 + rnd() * 1.6;
    put(G.rock, M.rock, x, 0.2 * r, z, r, 0.7 * r, r * 0.85, rnd() * 6, rnd() * 0.4);
  }
  // tralicci dell'alta tensione verso l'orizzonte
  for (let k = 0; k < 7; k++) {
    const x = -90 + k * 30, z = 62;
    for (const s of [-1, 1]) put(G.box, M.steel, x + s * 0.9, 7, z, 0.25, 14, 0.25, 0, 0, s * 0.06);
    put(G.box, M.steel, x, 13, z, 4.5, 0.25, 0.3);
  }
  for (const { geo, mat, list } of batches.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.castShadow = mat !== M.rock || true; im.receiveShadow = true;
    scene.add(im);
  }

  // ciminiere con la fiaccola (fiamma che tremola e illumina) e camini che fumano
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(2.2), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z, h] of [[-40, -6, 14], [5, -8.5, 11]]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 12), M.steel);
    stack.position.set(x, h / 2, z); stack.castShadow = true; scene.add(stack);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 12, 1, true), flameMat);
    fl.position.set(x, h + 1.3, z); scene.add(fl);
    const light = new THREE.PointLight('#ff9a40', 18, 28, 1.6); light.position.set(x, h + 1.5, z); scene.add(light);
    out.flames.push({ mesh: fl, light, h });
  }
  for (const [x, z, h] of [[-26, 8, 9], [21, -12.5, 8]]) {
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, h, 14), M.tankRed); ch.position.set(x, h / 2, z); ch.castShadow = true; scene.add(ch);
    out.smokers.push({ x, y: h + 0.3, z });
  }
  out.ground = ground;
  return out;
}

// minimappa: il tracciato su un canvas 2D
export function drawTrack(g, w, h) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const s = Math.min((w - 16) / (maxX - minX), (h - 16) / (maxZ - minZ));
  const ox = w / 2 - ((minX + maxX) / 2) * s, oz = h / 2 - ((minZ + maxZ) / 2) * s;
  const map = (x, z) => [ox + x * s, oz + z * s];
  g.clearRect(0, 0, w, h);
  g.lineJoin = 'round';
  for (const [col, lw] of [['rgba(0,0,0,0.55)', 9], ['#d9c9a6', 5]]) {
    g.beginPath(); track.forEach((p, i) => { const [x, y] = map(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  }
  const [sx, sy] = map(track[0].x, track[0].z);
  g.fillStyle = '#ffba4a'; g.fillRect(sx - 2, sy - 5, 4, 10);
  return map;
}
