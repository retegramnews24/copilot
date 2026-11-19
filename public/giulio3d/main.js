// Giuliosim 3D (test page): the Linea dei Due Laghi in real 3D with three.js. The train physics, stops and track
// come unchanged from ../giulio/line.js (classic script loaded first: train, tick, command, trackAt, stops…).
import * as THREE from '../vendor/three/three.module.min.js';
import { buildCab } from './cab3d.js?v=e2666062a3';

const $ = id => document.getElementById(id);
const noise = n => {
  const f = Math.sin(n * 78.233 + 36.7) * 43758.5453;
  return f - Math.floor(f);
};
const easeIn = x => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// ---- World coordinates: line.js uses forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw).
// three.js is right-handed with the camera looking along -z, so x is mirrored to keep left and right correct.
function frame(s) {
  const p = trackAt(s);
  return { p, rx: Math.cos(p.yaw), rz: -Math.sin(p.yaw) };
}
function at(s, x = 0, y = 0) {
  const f = frame(s);
  return new THREE.Vector3(-(f.p.x + f.rx * x), f.p.y + y, f.p.z + f.rz * x);
}
const heading = s => Math.PI - trackAt(s).yaw; // rotation.y of an object whose -z points forward

// ---- Renderer, scene, light.
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#cfdde3');
scene.fog = new THREE.Fog(HORIZON, 120, 1500);
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2600);
camera.rotation.order = 'YXZ';

// Sky dome: gradient from deep blue to the hazy horizon, warm near the sun.
const SUN_DIR = new THREE.Vector3(-Math.sin(0.57) * Math.cos(0.62), Math.sin(0.62), Math.cos(0.57) * Math.cos(0.62)).normalize();
scene.add(
  new THREE.Mesh(
    new THREE.SphereGeometry(2400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { sun: { value: SUN_DIR } },
      vertexShader: 'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform vec3 sun;varying vec3 d;void main(){float h=max(d.y,0.);vec3 top=vec3(.18,.36,.66),hor=vec3(.81,.87,.89);' +
        'vec3 c=mix(hor,top,pow(h,.55));float s=max(dot(d,sun),0.);c+=vec3(1.,.85,.6)*pow(s,24.)*.6+vec3(1.,.95,.8)*pow(s,900.)*4.;' +
        'if(d.y<0.)c=hor*.95;gl_FragColor=vec4(c,1.);}'
    })
  )
);
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#bcd6ee', '#4d5a33', 1.1));

// ---- Terrain and track as ribbons that follow the line (heights from the track, gentle swells outward).
const S0 = trackStart + 10,
  S1 = trackEnd - 10;
function terrainY(s, x) {
  const base = trackAt(s).y;
  const ax = Math.abs(x);
  const edge = easeIn((ax - 8) / 140);
  const swell = 0.7 + Math.sin(s * 0.013 + x * 0.051) * 0.8 + Math.cos(s * 0.006 - x * 0.073) * 0.55;
  const far = ax > 160 ? (ax - 160) * 0.12 * (0.6 + 0.4 * Math.sin(s * 0.004 + x * 0.01)) : 0;
  return base - 0.42 + edge * swell * 9 + far;
}
function ribbon(xs, step, height, color) {
  const rows = Math.floor((S1 - S0) / step) + 1,
    cols = xs.length;
  const pos = new Float32Array(rows * cols * 3),
    col = color ? new Float32Array(rows * cols * 3) : null,
    idx = [];
  const tmp = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const s = S0 + r * step,
      f = frame(s);
    for (let c = 0; c < cols; c++) {
      const x = xs[c],
        i = (r * cols + c) * 3;
      pos[i] = -(f.p.x + f.rx * x);
      pos[i + 1] = height(s, x);
      pos[i + 2] = f.p.z + f.rz * x;
      if (col) {
        color(s, x, tmp);
        col[i] = tmp.r;
        col[i + 1] = tmp.g;
        col[i + 2] = tmp.b;
      }
      if (r && c) {
        const a = (r - 1) * cols + c - 1,
          b = a + 1,
          d = r * cols + c - 1,
          e = d + 1;
        // Winding for the mirrored x axis, so the faces point up.
        idx.push(a, b, d, b, e, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const terrainXs = [-420, -300, -210, -150, -110, -80, -56, -38, -26, -17, -11, -7, -4.2, 4.2, 7, 11, 17, 26, 38, 56, 80, 110, 150, 210, 300, 420];
const grass = new THREE.Color('#5f8a43'),
  meadow = new THREE.Color('#86a24f'),
  dry = new THREE.Color('#a39a5c'),
  dark = new THREE.Color('#3f6a35');
const terrain = new THREE.Mesh(
  ribbon(terrainXs, 6, terrainY, (s, x, out) => {
    const n = noise(Math.floor(s / 37) * 13 + Math.floor(x / 23));
    const field = Math.sin(s * 0.014 + Math.sin(x * 0.096) * 0.8) * 0.5 + 0.5;
    out.copy(grass).lerp(field > 0.6 ? meadow : dark, 0.5).lerp(dry, n > 0.82 ? 0.45 : 0);
  }),
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })
);
terrain.receiveShadow = true;
scene.add(terrain);
const ballast = new THREE.Mesh(
  ribbon([-2.3, -1.6, 1.6, 2.3], 3, (s, x) => trackAt(s).y + (Math.abs(x) > 2 ? -0.35 : -0.06)),
  new THREE.MeshStandardMaterial({ color: '#8a8478', roughness: 1 })
);
ballast.receiveShadow = true;
scene.add(ballast);
const railMat = new THREE.MeshStandardMaterial({ color: '#c9c6bd', metalness: 0.85, roughness: 0.32 });
for (const r of [-0.7175, 0.7175]) {
  const rail = new THREE.Mesh(ribbon([r - 0.035, r + 0.035], 2, s => trackAt(s).y + 0.16), railMat);
  rail.receiveShadow = true;
  scene.add(rail);
}
// Sleepers: one instanced mesh along the whole line.
{
  const step = 0.75,
    count = Math.floor((S1 - S0) / step);
  const sleepers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.4, 0.16, 0.24),
    new THREE.MeshStandardMaterial({ color: '#5d554a', roughness: 0.9 }),
    count
  );
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    const s = S0 + i * step;
    q.setFromAxisAngle(up, heading(s));
    m.compose(at(s, 0, 0.02), q, one);
    sleepers.setMatrixAt(i, m);
  }
  sleepers.receiveShadow = true;
  scene.add(sleepers);
}
// Catenary: masts every 50 m on the right, contact wire above the track.
{
  const mastGeo = new THREE.CylinderGeometry(0.11, 0.14, 6.4, 8),
    armGeo = new THREE.BoxGeometry(3.4, 0.09, 0.09);
  const mat = new THREE.MeshStandardMaterial({ color: '#7d8781', metalness: 0.6, roughness: 0.5 });
  const n = Math.floor((S1 - S0) / 50);
  const masts = new THREE.InstancedMesh(mastGeo, mat, n),
    arms = new THREE.InstancedMesh(armGeo, mat, n);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    one = new THREE.Vector3(1, 1, 1);
  const wire = [];
  for (let i = 0; i < n; i++) {
    const s = S0 + i * 50;
    q.setFromAxisAngle(up, heading(s));
    m.compose(at(s, 3.2, 3.2), q, one);
    masts.setMatrixAt(i, m);
    m.compose(at(s, 1.6, 6.1), q, one);
    arms.setMatrixAt(i, m);
  }
  for (let s = S0; s < S1; s += 8) wire.push(at(s, 0, 5.85));
  masts.castShadow = true;
  scene.add(masts, arms, new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: '#2b302e' })));
}

// ---- Trees: conifers and broadleaf, instanced, low-poly with flat shading.
{
  const coneGeo = new THREE.ConeGeometry(1.7, 5.6, 7).translate(0, 4.4, 0);
  const cone2Geo = new THREE.ConeGeometry(2.2, 4.2, 7).translate(0, 2.6, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6).translate(0, 1.1, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.6, 1);
  {
    const p = crownGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (noise(i * 3.1) - 0.5) * 0.35;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85 + 4.4, p.getZ(i) * k);
    }
    crownGeo.computeVertexNormals();
  }
  const pines = [],
    broad = [];
  for (let s = S0; s < S1; s += 5) {
    for (let k = 0; k < 3; k++) {
      const r = noise(s * 1.7 + k * 31);
      if (r < 0.35) continue;
      const side = noise(s * 0.3 + k) > 0.5 ? 1 : -1,
        x = side * (9 + noise(s * 2.3 + k * 7) * 170);
      if (stops.some(st => Math.abs(st.s - s) < 140 && Math.abs(x) < 50)) continue;
      const scale = 0.7 + noise(s + k * 13) * 0.8;
      (noise(s * 0.11 + k * 5) > 0.45 ? pines : broad).push({ s, x, scale, rot: noise(s * 9 + k) * 6.28 });
    }
  }
  const place = (list, geo, mat) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0),
      sc = new THREE.Vector3();
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      sc.setScalar(t.scale);
      const p = at(t.s, t.x, 0);
      p.y = terrainY(t.s, t.x) - 0.1;
      m.compose(p, q, sc);
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };
  const leaf = new THREE.MeshStandardMaterial({ color: '#3f6b3b', flatShading: true, roughness: 0.9 });
  const needle = new THREE.MeshStandardMaterial({ color: '#2d5238', flatShading: true, roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ color: '#5a4634', roughness: 1 });
  place(pines, coneGeo, needle);
  place(pines, cone2Geo, needle);
  place(pines, trunkGeo, bark);
  place(broad, crownGeo, leaf);
  place(broad, trunkGeo, bark);
}

// ---- Stations: platform, shelter, STOP board, and a village of houses around each one.
function textBoard(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
}
function boxAt(s, x, y, w, h, d, mat, rot = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.copy(at(s, x, y));
  mesh.rotation.y = heading(s) + rot;
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
const platformMat = new THREE.MeshStandardMaterial({ color: '#b3aca0', roughness: 0.95 });
const edgeMat = new THREE.MeshStandardMaterial({ color: '#e9dfa2', roughness: 0.8 });
const roofMats = ['#9c4a3a', '#6e4b3c', '#7f3f33', '#4f5b5e'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }));
const wallMats = ['#e6dcc6', '#d8c7a4', '#e2d6c0', '#c9b48e'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
const windowMat = new THREE.MeshStandardMaterial({ color: '#2f4148', roughness: 0.3, metalness: 0.2 });
const shutterMat = new THREE.MeshStandardMaterial({ color: '#3f6b4a', roughness: 0.8 });
function roofGeometry(w, d, h) {
  const g = new THREE.BufferGeometry(),
    W = w / 2 + 0.35,
    D = d / 2 + 0.3;
  const v = [-W, 0, -D, W, 0, -D, 0, h, -D, -W, 0, D, W, 0, D, 0, h, D];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4]);
  g.computeVertexNormals();
  return g;
}
function house(s, x, seed) {
  const w = 6 + noise(seed) * 3,
    d = 8 + noise(seed * 3) * 4,
    ht = noise(seed * 5) > 0.6 ? 5.8 : 3.4,
    rh = w * 0.42;
  const ground = terrainY(s, x);
  const group = new THREE.Group();
  group.position.copy(at(s, x, 0));
  group.position.y = ground;
  group.rotation.y = heading(s) + (noise(seed * 7) > 0.5 ? 0 : Math.PI / 2);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), wallMats[Math.floor(noise(seed * 2) * 4)]);
  walls.position.y = ht / 2;
  const roof = new THREE.Mesh(roofGeometry(w, d, rh), roofMats[Math.floor(noise(seed * 4) * 4)]);
  roof.position.y = ht;
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), wallMats[1]);
  chimney.position.set(w * 0.2, ht + rh * 0.7, d * 0.25);
  group.add(walls, roof, chimney);
  for (const side of [-1, 1])
    for (let k = 0; k < Math.max(2, Math.round(d / 3.2)); k++) {
      const z = -d / 2 + (k + 0.5) * (d / Math.max(2, Math.round(d / 3.2)));
      for (let f = 0; f < (ht > 5 ? 2 : 1); f++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.8), windowMat);
        win.position.set(side * (w / 2 + 0.02), 1.6 + f * 2.5, z);
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.34), shutterMat);
        sh.position.set(side * (w / 2 + 0.03), 1.6 + f * 2.5, z - 0.6);
        const sh2 = sh.clone();
        sh2.position.z = z + 0.6;
        group.add(win, sh, sh2);
      }
    }
  group.traverse(o => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(group);
}
for (const [index, stop] of stops.entries()) {
  const side = stop.side === 'left' ? -1 : 1;
  // Platform from 100 m before the STOP to 20 m after it.
  for (let s = stop.s - 100; s < stop.s + 20; s += 10) {
    boxAt(s + 5, side * 3.9, 0.45, 3.2, 0.9, 10.2, platformMat);
    boxAt(s + 5, side * 2.36, 0.91, 0.25, 0.03, 10.2, edgeMat);
  }
  const shelterRoof = boxAt(stop.s - 36, side * 4.6, 3.1, 2.6, 0.12, 8, new THREE.MeshStandardMaterial({ color: '#56625d' }));
  shelterRoof.castShadow = true;
  for (const dz of [-3.6, 3.6]) boxAt(stop.s - 36 + dz, side * 5.6, 2, 0.12, 2.2, 0.12, new THREE.MeshStandardMaterial({ color: '#3c4643' }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), textBoard('STOP', '#f2f0ea', '#c0392b'));
  board.position.copy(at(stop.s, side * 2.6, 2.2));
  board.rotation.y = heading(stop.s) + Math.PI;
  scene.add(board);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), textBoard(stop.name, '#1f4e7a', '#ffffff'));
  name.position.copy(at(stop.s - 44, side * 5.2, 2.8));
  name.rotation.y = heading(stop.s) + Math.PI;
  scene.add(name);
  for (let k = 0; k < 7; k++) {
    const away = k % 3 === 0 ? -side : side;
    house(stop.s - 150 + k * 55 + noise(index * 17 + k) * 30, away * (18 + noise(index * 5 + k * 3) * 28), index * 31 + k);
  }
}
for (let s = 600; s < TERMINUS; s += 640 + noise(s) * 300) {
  if (stops.some(st => Math.abs(st.s - s) < 260)) continue;
  house(s, (noise(s * 3) > 0.5 ? 1 : -1) * (26 + noise(s * 7) * 40), s);
}

// ---- Cab (see cab3d.js): instruments, handles, timetable, displays; the camera sits at the driver's eye.
const cab = buildCab({ stops });
const rig = cab.rig,
  eye = cab.eye;
scene.add(rig);
eye.add(camera);

// ---- Settings (pause menu), kept on this device: interface full / essential / hidden, invert look, cab lights.
const settings = { hud: 'full', invertX: false, invertY: false, lights: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('giuliosim3d-settings') || '{}'));
} catch {}
function applySettings() {
  document.body.dataset.hud = settings.hud;
  cab.setLights(settings.lights);
  for (const b of document.querySelectorAll('[data-hud]')) b.setAttribute('aria-pressed', String(b.dataset.hud === settings.hud));
  $('invert-x').checked = settings.invertX;
  $('invert-y').checked = settings.invertY;
  $('cab-lights').checked = settings.lights;
  try {
    localStorage.setItem('giuliosim3d-settings', JSON.stringify(settings));
  } catch {}
}
for (const b of document.querySelectorAll('[data-hud]'))
  b.onclick = () => {
    settings.hud = b.dataset.hud;
    applySettings();
  };
$('invert-x').onchange = e => ((settings.invertX = e.target.checked), applySettings());
$('invert-y').onchange = e => ((settings.invertY = e.target.checked), applySettings());
$('cab-lights').onchange = e => ((settings.lights = e.target.checked), applySettings());
applySettings();
// ---- Look around (drag), zoom (pinch / wheel).
let lookYaw = 0,
  lookPitch = -0.04,
  fov = 62;
const touches = new Map();
let drag = null,
  pinch = null;
canvas.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov };
    drag = null;
  } else drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: lookYaw, pitch: lookPitch };
});
canvas.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    fov = Math.min(90, Math.max(28, (pinch.fov * pinch.d) / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
    return;
  }
  if (drag?.id !== e.pointerId) return;
  lookYaw = drag.yaw + (settings.invertX ? -1 : 1) * ((e.clientX - drag.x) / innerWidth) * Math.PI * 1.4;
  lookPitch = Math.max(-1.3, Math.min(1.3, drag.pitch + (settings.invertY ? -1 : 1) * ((e.clientY - drag.y) / innerHeight) * 1.8));
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  canvas.addEventListener(type, e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (drag?.id === e.pointerId) drag = null;
  });
canvas.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    fov = Math.min(90, Math.max(28, fov * Math.exp(e.deltaY * 0.001)));
  },
  { passive: false }
);

// ---- Controls (same commands as Giulio Simulator).
function leverDrag(id, max, up, down, downwards) {
  const el = $(id),
    value = () => (id === 'traction-lever' ? train.traction : train.brake);
  const move = e => {
    const r = el.getBoundingClientRect();
    let f = Math.min(1, Math.max(0, (r.bottom - e.clientY) / r.height));
    if (downwards) f = 1 - f;
    const want = Math.round(f * max);
    let guard = 12;
    while (value() !== want && guard--) {
      const before = value();
      command(want > before ? up : down);
      if (value() === before) break;
    }
  };
  el.addEventListener('pointerdown', e => {
    if (mode !== 'run') return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    move(e);
    el.onpointermove = move;
    el.onpointerup = el.onpointercancel = () => (el.onpointermove = null);
  });
}
leverDrag('traction-lever', 4, 'powerUp', 'powerDown', false);
leverDrag('brake-lever', 5, 'brakeUp', 'brakeDown', true);
$('doors').onclick = () => {
  const stop = stops[train.docked >= 0 ? train.docked : train.next] ?? stops[train.next - 1];
  command(train.doors || stop?.side || 'left');
};
$('reverser').onclick = () => command('reverse');
$('emergency').onclick = () => command('emergency');
const keys = { KeyW: 'powerUp', ArrowUp: 'powerUp', KeyS: 'powerDown', ArrowDown: 'powerDown', KeyD: 'brakeUp', KeyA: 'brakeDown', KeyR: 'reverse', KeyX: 'emergency' };
addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') return togglePause();
  if (keys[e.code] && !e.repeat) command(keys[e.code]);
  if (e.code === 'KeyQ' || e.code === 'KeyE') $('doors').click();
});

// line.js calls these at the end of a run and for the horn.
window.end = complete => {
  if (mode !== 'run') return;
  mode = 'result';
  $('kicker').textContent = complete ? 'Capolinea raggiunto' : 'Corsa interrotta';
  $('title').textContent = complete ? 'Corsa completata' : 'Fine prova';
  $('text').textContent = train.stopResults.map(r => r.name + ' · scarto ' + Math.abs(r.offset).toFixed(1) + ' m').join(' · ') || 'Nessuna fermata registrata.';
  $('continue').hidden = true;
  $('restart').hidden = false;
  $('overlay').hidden = false;
};
window.horn = () => {};
function togglePause() {
  if (mode === 'run') {
    mode = 'paused';
    $('kicker').textContent = 'Cabina in pausa';
    $('title').textContent = 'Pausa';
    $('text').textContent = 'Il tempo della corsa è fermo.';
    $('continue').textContent = 'Riprendi';
    $('continue').hidden = false;
    $('restart').hidden = false;
    $('overlay').hidden = false;
  } else if (mode === 'paused') {
    mode = 'run';
    $('overlay').hidden = true;
  }
}
$('pause').onclick = togglePause;
$('continue').onclick = () => {
  if (mode === 'intro') reset();
  mode = 'run';
  $('overlay').hidden = true;
};
$('restart').onclick = () => {
  reset();
  mode = 'run';
  $('overlay').hidden = true;
};
// Quality: HD (sharper, soft shadows) or light (lower resolution, faster on older phones).
$('quality').onclick = () => {
  const hd = $('quality').textContent !== 'HD';
  $('quality').textContent = hd ? 'HD' : 'Leggero';
  pixelRatio = hd ? Math.min(devicePixelRatio || 1, 1.75) : 1;
  renderer.setPixelRatio(pixelRatio);
  sun.shadow.mapSize.set(hd ? 2048 : 1024, hd ? 2048 : 1024);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  resize();
};
// Inside Binottoland: Telegram margins and the exit button.
if (window.parent !== window) {
  $('exit').hidden = false;
  $('exit').onclick = () => parent.postMessage({ type: 'arcade:exit' }, location.origin);
  addEventListener('message', e => {
    if (e.origin !== location.origin || e.source !== parent || e.data?.type !== 'arcade:insets') return;
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const v = e.data.insets?.[side],
        px = n => (Number.isFinite(n) ? Math.min(180, Math.max(0, n)) : 0);
      document.documentElement.style.setProperty('--g3-safe-' + side, px(v?.system) + px(v?.content) + 'px');
    }
  });
  parent.postMessage({ type: 'arcade:ready' }, location.origin);
}

// ---- HUD and main loop.
const cabInfo = { name: '', detail: '' };
const fmt = (v, d = 0) => v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
function hud() {
  const t = train,
    v = Math.abs(t.v) * 3.6,
    index = sectionAt(limits, t.s),
    limit = limits[index][1],
    next = stops[t.next];
  $('speed').textContent = fmt(v);
  $('limit').textContent = limit;
  document.querySelector('.g3-speed').classList.toggle('warn', v > limit + 2);
  $('traction').textContent = t.traction + ' / 4';
  $('brake').textContent = t.emergency ? 'EMG' : t.brake + ' / 5';
  $('traction-lever').style.setProperty('--lever', t.traction / 4);
  $('brake-lever').style.setProperty('--lever', t.emergency ? 1 : t.brake / 5);
  $('doors').textContent = t.doors ? 'Chiudi porte' : 'Apri porte';
  $('doors').classList.toggle('on', !!t.doors);
  $('reverser').textContent = t.direction > 0 ? 'Avanti' : 'Indietro';
  $('emergency').classList.toggle('on', t.emergency);
  const docking = t.doors && t.docked >= 0,
    diff = (next?.s ?? TERMINUS) - t.s;
  $('info').innerHTML = '';
  const name = document.createElement('b');
  name.textContent = docking ? stops[t.docked].name : next?.name ?? 'Arrivo';
  const detail = document.createElement('span');
  detail.textContent =
    ' · ' +
    (docking
      ? t.docked === 0
        ? 'porte a sinistra'
        : t.dwell < DWELL
          ? 'sosta ' + Math.ceil(DWELL - t.dwell) + ' s'
          : 'chiudi le porte'
      : diff < -STOP_TOL
        ? 'oltre lo STOP di ' + fmt(-diff) + ' m'
        : fmt(Math.max(0, diff)) + ' m · porte ' + (next ? sideName(next.side) : '')) +
    ' · ' +
    fmt(t.pipe, 2) +
    ' bar';
  $('info').append(name, detail);
  cabInfo.name = name.textContent;
  cabInfo.detail = docking ? (t.dwell < DWELL ? 'sosta ' + Math.ceil(DWELL - t.dwell) + ' s' : 'chiudi porte') : diff < -STOP_TOL ? 'oltre STOP' : fmt(Math.max(0, diff)) + ' m';
  let hint = t.elapsed < noteUntil ? note : '';
  if (!hint && v > limit + 2) hint = 'Limite superato · riduci la velocità.';
  if (!hint && !docking && diff <= STOP_TOL && diff >= -STOP_TOL && v < 0.22 && next) hint = 'Fermata valida · apri le porte a ' + sideName(next.side) + '.';
  $('message').textContent = hint;
}
function resize() {
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
let last = 0,
  acc = 0,
  hudAt = 0;
const DT = 1 / 60;
function loop(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  if (mode === 'run') {
    acc += dt;
    while (acc >= DT && mode === 'run') {
      tick(DT);
      acc -= DT;
    }
  } else acc = 0;
  // Cab follows the track; a gentle sway with speed.
  const s = train.s + 0.55,
    sway = Math.sin(now * 0.004) * Math.min(1, Math.abs(train.v) / 25) * 0.004;
  rig.position.copy(at(s));
  rig.rotation.set(0, heading(s), sway);
  camera.rotation.set(lookPitch, -lookYaw, 0);
  // Portrait screens get a wider vertical view, so the desk does not fill half of the screen.
  const wanted = Math.min(100, fov * (camera.aspect < 1 ? 1.32 : 1));
  if (Math.abs(camera.fov - wanted) > 0.01) {
    camera.fov = wanted;
    camera.updateProjectionMatrix();
  }
  // Instruments, handles, lamps, clock and next-stop display.
  cab.update(train, cabInfo);
  // Sun and its shadow box follow the train.
  const c = at(train.s);
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(SUN_DIR, 220);
  if (now - hudAt > 100) {
    hudAt = now;
    hud();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
mode = 'intro';
requestAnimationFrame(loop);
