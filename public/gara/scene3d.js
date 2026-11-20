// La pista in 3D, costruita dagli stessi punti usati dalle regole.
// Mondo: x = colonna della casella, z = riga della casella, y = altezza. 1 unità = 1 casella.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { inTrack, clearance, pointInPoly } from './rules.js';

const GEAR_COL = { down: '#ef4444', same: '#22c55e', up: '#3b82f6' };

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function hashTrack(t) {
  let h = 2166136261;
  for (const p of t.outer) h = Math.imul(h ^ Math.round(p.x * 10 + p.y * 7), 16777619);
  return h >>> 0;
}

function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}

// normali per vertice, rivolte verso l'asfalto
function inwardNormals(poly, towardInside) {
  const ccw = signedArea(poly) > 0 ? 1 : -1, k = towardInside ? ccw : -ccw, n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
    let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    return { x: -dy * k, y: dx * k };
  });
}

// per ogni punto del bordo: quanto è stretta la curva (0..1) e se ci va la sabbia (curva verso l'interno del poligono)
function bends(poly) {
  // si misura la svolta su 8 punti per lato (4 caselle): stretta se il raggio è sotto le 16 caselle circa
  const n = poly.length, w = 8, ccw = signedArea(poly) > 0 ? 1 : -1;
  const raw = poly.map((p, i) => {
    const a = poly[(i - w + n) % n], b = poly[(i + w) % n];
    const d1x = p.x - a.x, d1y = p.y - a.y, d2x = b.x - p.x, d2y = b.y - p.y;
    return Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y);
  });
  const tight = raw.map((ang) => (Math.abs(ang) > 0.5 ? 1 : 0));
  const conv = raw.map((ang, i) => (tight[i] && ang * ccw > 0 ? 1 : 0));
  // allarga e ammorbidisce, così cordoli e sabbia entrano ed escono dolcemente
  const soft = (arr, grow, blur) => {
    const g = arr.map((_, i) => { for (let k = -grow; k <= grow; k++) if (arr[(i + k + n) % n]) return 1; return 0; });
    return g.map((_, i) => { let s = 0; for (let k = -blur; k <= blur; k++) s += g[(i + k + n) % n]; return s / (2 * blur + 1); });
  };
  const t = soft(tight, 5, 4), o = soft(conv, 6, 6);
  return poly.map((_, i) => ({ tight: t[i], out: o[i] }));
}

function texCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// telecamera: quanto ci si può avvicinare e allontanare
const MIN_DIST = 2.5, MAX_DIST = 400;

// ora della gara: colori del cielo, luci e nebbia
const TIMES = {
  day: { skyTop: '#3f86d6', skyBot: '#cbe9fb', fog: 0xcbe9fb, hemiSky: 0xe3f3ff, hemiGround: 0x52763d, hemiI: 1.5, sunCol: 0xfff1d6, sunI: 2.6, sunDir: [0.6, 1.4, 0.45], exp: 1.05, cloud: '#ffffff', clouds: 14 },
  sunset: { skyTop: '#2f3f86', skyBot: '#ffab66', fog: 0xf0a173, hemiSky: 0xffd9bd, hemiGround: 0x5d6a40, hemiI: 1.45, sunCol: 0xffb070, sunI: 2.6, sunDir: [1.3, 0.62, 0.35], exp: 1.05, cloud: '#ffcfae', clouds: 10 },
  night: { skyTop: '#03060f', skyBot: '#1a2a4c', fog: 0x111a30, hemiSky: 0x6a84c8, hemiGround: 0x1c261c, hemiI: 0.8, sunCol: 0xb4c4ff, sunI: 0.75, sunDir: [-0.5, 1.2, -0.4], exp: 1.25, night: true, clouds: 0 }
};

export class Race3D {
  constructor(host) {
    this.host = host;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.domElement.className = 'gl';
    host.prepend(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
    this.rig = { tx: 0, tz: 0, dist: 26, yaw: 0, pitch: 0.95, goal: null };
    this.view = 'tilt';
    this.anims = [];
    this.texCache = new Map();
    this.onPick = null;
    this.pointers = new Map();
    this.input();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.clock = new THREE.Clock();
    this.fx = [];
    // auto fatta in Blender (public/gara/models/auto.glb, sorgente in blender/auto.blend)
    this.ready = new GLTFLoader().loadAsync('gara/models/auto.glb')
      .then((g) => { this.carProto = g.scene; })
      .catch((e) => { console.warn('auto.glb non caricata, uso l’auto semplice', e); });
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const b = this.host.getBoundingClientRect();
    if (!b.width) return;
    this.renderer.setSize(b.width, b.height, false);
    this.camera.aspect = b.width / b.height; this.camera.updateProjectionMatrix();
  }

  // ---------- costruzione della pista ----------
  build(track, time = 'day') {
    this.track = track;
    const T = (this.time = TIMES[time] || TIMES.day);
    this.night = !!T.night;
    const S = (this.scene = new THREE.Scene());
    const bb = track.bbox, span = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
    this.center = { x: (bb.minX + bb.maxX) / 2, z: (bb.minY + bb.maxY) / 2 };
    S.background = new THREE.Color(T.fog);
    S.fog = new THREE.Fog(T.fog, span * (T.night ? 1.4 : 0.9) + 30, span * (T.night ? 3 : 2.2) + 80);
    this.renderer.toneMappingExposure = T.exp;
    this.sky(T, span);
    S.add(new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI));
    const sun = new THREE.DirectionalLight(T.sunCol, T.sunI);
    const half = span / 2 + 14;
    sun.position.set(this.center.x + half * T.sunDir[0], half * T.sunDir[1], this.center.z + half * T.sunDir[2]);
    sun.target.position.set(this.center.x, 0, this.center.z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -half * 1.2, right: half * 1.2, top: half * 1.2, bottom: -half * 1.2, near: 1, far: half * 4 });
    sun.shadow.bias = -0.0005;
    S.add(sun, sun.target);

    // prato
    const grassTex = texCanvas(256, 256, (g) => {
      g.fillStyle = '#5f9c45'; g.fillRect(0, 0, 256, 256);
      const r = rng(5);
      for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(80,140,55,.55)' : 'rgba(120,170,80,.45)'; g.fillRect(r() * 256, r() * 256, 2, 2); }
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ map: grassTex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(this.center.x, 0, this.center.z); ground.receiveShadow = true;
    S.add(ground);
    this.ground = ground;

    // asfalto: forma esterna con il buco interno
    const shape = new THREE.Shape(track.outer.map((p) => new THREE.Vector2(p.x, -p.y)));
    shape.holes.push(new THREE.Path(track.inner.map((p) => new THREE.Vector2(p.x, -p.y))));
    const asphaltTex = texCanvas(128, 128, (g) => {
      g.fillStyle = '#41464d'; g.fillRect(0, 0, 128, 128);
      const r = rng(9);
      for (let i = 0; i < 900; i++) { const v = 55 + r() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},.5)`; g.fillRect(r() * 128, r() * 128, 1.5, 1.5); }
    });
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping; asphaltTex.repeat.set(0.25, 0.25);
    const ag = new THREE.ShapeGeometry(shape);
    ag.rotateX(-Math.PI / 2);
    const asphalt = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92 }));
    asphalt.position.y = 0.02; asphalt.receiveShadow = true;
    S.add(asphalt);

    // bordi: cordoli in rilievo nelle curve strette, riga bianca sui rettilinei,
    // sabbia fuori dalle curve del bordo esterno, barriere dietro
    this.gravelW = new Map();
    for (const [poly, inside] of [[track.outer, true], [track.inner, false]]) {
      const nor = inwardNormals(poly, inside), bend = bends(poly);
      const gw = inside ? bend.map((b) => b.out * 2.4) : bend.map(() => 0);
      this.gravelW.set(poly, gw);
      S.add(this.kerb(poly, nor, bend));
      if (inside) S.add(this.gravel(poly, nor, gw));
      S.add(this.barrier(poly, nor, gw));
    }

    // linea di partenza a scacchi
    const f = track.finish, L = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
    const flag = texCanvas(128, 16, (g) => { for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(i * 4, j * 4, 4, 4); } });
    flag.magFilter = THREE.NearestFilter; flag.wrapS = THREE.RepeatWrapping; flag.repeat.set(L / 8, 1);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.55), new THREE.MeshStandardMaterial({ map: flag, roughness: 0.8 }));
    fl.rotation.x = -Math.PI / 2; fl.rotation.z = -Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x);
    fl.position.set((f.a.x + f.b.x) / 2, 0.04, (f.a.y + f.b.y) / 2); fl.receiveShadow = true;
    S.add(fl);
    // portale sopra la linea: trave scura con la scritta e i semafori (dall'alto non sembra un'altra linea)
    const gantry = new THREE.Group(), gm = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.6, roughness: 0.35 });
    const ang = -Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x), mx = (f.a.x + f.b.x) / 2, mz = (f.a.y + f.b.y) / 2;
    const ux = (f.b.x - f.a.x) / L, uz = (f.b.y - f.a.y) / L;
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.9, 0.2), gm); post.position.set(mx + ux * (L / 2 + 0.35) * s, 1.45, mz + uz * (L / 2 + 0.35) * s); post.castShadow = true; gantry.add(post); }
    const banner = texCanvas(512, 64, (c) => {
      c.fillStyle = '#111827'; c.fillRect(0, 0, 512, 64);
      c.fillStyle = '#facc15'; c.fillRect(0, 0, 512, 5); c.fillRect(0, 59, 512, 5);
      c.fillStyle = '#fff'; c.font = 'bold 34px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BINOTTOLAND', 256, 34);
    });
    banner.repeat.set(Math.max(1, Math.round(L / 9)), 1); banner.wrapS = THREE.RepeatWrapping;
    const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L + 0.9, 0.5, 0.16), [dark, dark, dark, dark, new THREE.MeshStandardMaterial({ map: banner, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: banner, roughness: 0.5 })]);
    beam.position.set(mx, 2.75, mz); beam.rotation.y = ang; beam.castShadow = true; gantry.add(beam);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 1.2 });
    for (let k = -2; k <= 2; k++) for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lampMat);
      const nx = -uz * side * 0.1, nz = ux * side * 0.1;
      lamp.position.set(mx + ux * k * 0.22 + nx, 2.42, mz + uz * k * 0.22 + nz); gantry.add(lamp);
    }
    S.add(gantry);

    // griglia delle caselle: le auto stanno sugli incroci
    const gx0 = Math.floor(bb.minX) - 1, gx1 = Math.ceil(bb.maxX) + 1, gz0 = Math.floor(bb.minY) - 1, gz1 = Math.ceil(bb.maxY) + 1;
    const gp = [];
    for (let x = gx0; x <= gx1; x++) gp.push(x, 0.05, gz0, x, 0.05, gz1);
    for (let z = gz0; z <= gz1; z++) gp.push(gx0, 0.05, z, gx1, 0.05, z);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: this.night ? 0.12 : 0.22, depthWrite: false }));
    this.grid.visible = this.gridOn !== false;
    S.add(this.grid);

    this.decor(track);

    this.markers = new THREE.Group(); S.add(this.markers);
    this.trails = new THREE.Group(); S.add(this.trails);
    this.trailMats = new Map();
    this.cars = [];
    this.rig.tx = this.center.x; this.rig.tz = this.center.z;
    this.rig.dist = Math.max(18, span * 1.05); this.rig.goal = null;
  }

  // cordolo: dove la curva è stretta è a strisce rosse e bianche e rialzato verso il bordo; altrove una riga bianca
  // cielo sfumato, sole o luna, nuvole che si muovono piano, stelle di notte
  sky(T, span) {
    const S = this.scene, c = this.center, R = Math.max(400, span * 3 + 200);
    this.camera.far = R * 2.2; this.camera.updateProjectionMatrix();
    const grad = texCanvas(4, 256, (g) => { const l = g.createLinearGradient(0, 0, 0, 256); l.addColorStop(0, T.skyTop); l.addColorStop(0.47, T.skyBot); l.addColorStop(1, T.skyBot); g.fillStyle = l; g.fillRect(0, 0, 4, 256); });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16), new THREE.MeshBasicMaterial({ map: grad, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.position.set(c.x, 0, c.z); dome.renderOrder = -10; S.add(dome);
    // sole (o luna) nella direzione della luce
    const dir = new THREE.Vector3(...T.sunDir).normalize();
    const disc = texCanvas(128, 128, (g) => {
      const l = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      l.addColorStop(0, T.night ? 'rgba(235,240,255,1)' : 'rgba(255,250,235,1)'); l.addColorStop(0.25, T.night ? 'rgba(220,230,255,.9)' : 'rgba(255,230,170,.9)'); l.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = l; g.fillRect(0, 0, 128, 128);
    });
    const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, fog: false, depthWrite: false, transparent: true }));
    sunS.position.set(c.x + dir.x * R * 0.9, dir.y * R * 0.9, c.z + dir.z * R * 0.9);
    sunS.scale.setScalar(R * (T.night ? 0.12 : 0.22)); sunS.renderOrder = -9; S.add(sunS);
    // stelle
    if (T.night) {
      const p = [], r = rng(3);
      for (let i = 0; i < 900; i++) { const a = r() * Math.PI * 2, e = Math.asin(0.08 + r() * 0.92), d = R * 0.95; p.push(c.x + Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, c.z + Math.sin(a) * Math.cos(e) * d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      S.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 })));
    }
    // nuvole
    this.clouds = [];
    if (T.clouds) {
      const tex = texCanvas(256, 128, (g) => {
        const r = rng(11);
        for (let i = 0; i < 9; i++) { const x = 50 + r() * 156, y = 50 + r() * 40, rad = 26 + r() * 30, l = g.createRadialGradient(x, y, 2, x, y, rad); l.addColorStop(0, 'rgba(255,255,255,.95)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, 256, 128); }
      });
      const r = rng(7);
      for (let i = 0; i < T.clouds; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: T.cloud, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
        const a = r() * Math.PI * 2, d = R * (0.25 + r() * 0.55);
        s.position.set(c.x + Math.cos(a) * d, R * (0.12 + r() * 0.18), c.z + Math.sin(a) * d);
        const w = R * (0.18 + r() * 0.16); s.scale.set(w, w / 2, 1); s.renderOrder = -8;
        S.add(s); this.clouds.push({ s, v: R * (0.004 + r() * 0.006), R, cx: c.x });
      }
    }
  }

  // lampioni accesi di notte lungo il bordo esterno, con la luce che cade sull'asfalto
  lamps(t, S, taken) {
    const onor = inwardNormals(t.outer, true), gwo = this.gravelW.get(t.outer) || [];
    const glow = texCanvas(128, 128, (g) => { const l = g.createRadialGradient(64, 64, 2, 64, 64, 62); l.addColorStop(0, 'rgba(255,214,140,.55)'); l.addColorStop(0.5, 'rgba(255,190,110,.2)'); l.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = l; g.fillRect(0, 0, 128, 128); });
    const glowMat = new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.4 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffd28a, emissiveIntensity: 2.2 });
    const step = Math.max(40, Math.round(t.outer.length / 40));
    for (let i = Math.floor(step / 2); i < t.outer.length; i += step) {
      const p = t.outer[i], nn = onor[i], d = 0.55 + (gwo[i] || 0) + 0.35;
      const x = p.x - nn.x * d, z = p.y - nn.y * d;
      if (taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.4)) continue;
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 8), postMat); post.position.y = 1.5; post.castShadow = true; g.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.05), postMat); arm.position.set(0.45, 2.95, 0); g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.16), headMat); head.position.set(0.85, 2.9, 0); g.add(head);
      g.position.set(x, 0, z); g.rotation.y = Math.atan2(-nn.y, nn.x); // il braccio punta verso la pista
      S.add(g);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), glowMat);
      pool.rotation.x = -Math.PI / 2; pool.position.set(x + nn.x * 1.6, 0.06, z + nn.y * 1.6); pool.renderOrder = 3;
      S.add(pool);
      taken.push({ x, z, r: 0.5 });
    }
  }

  kerb(poly, nor, bend) {
    const pos = [], col = [], n = poly.length, red = new THREE.Color(0xd92b2b), white = new THREE.Color(0xf5f5f5), line = new THREE.Color(0xf1f1f1);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = poly[i], b = poly[j], na = nor[i], nb = nor[j];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ka = bend[i].tight, kb = bend[j].tight, on = (ka + kb) / 2 > 0.25;
      const wa = 0.12 + 0.36 * ka, wb = 0.12 + 0.36 * kb, ha = 0.036 + 0.04 * ka, hb = 0.036 + 0.04 * kb;
      const c = on ? (Math.floor(acc / 0.9) % 2 ? red : white) : line;
      acc += len;
      const A = [a.x, ha, a.y], B = [b.x, hb, b.y], A2 = [a.x + na.x * wa, 0.034, a.y + na.y * wa], B2 = [b.x + nb.x * wb, 0.034, b.y + nb.y * wb];
      pos.push(...A, ...B, ...A2, ...A2, ...B, ...B2);
      // fianco verso l'esterno
      pos.push(a.x, 0.02, a.y, b.x, 0.02, b.y, ...A, ...A, b.x, 0.02, b.y, ...B);
      for (let k = 0; k < 12; k++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }

  // via di fuga in sabbia, fuori dal bordo esterno nelle curve
  gravel(poly, nor, gw) {
    const pos = [], uv = [], n = poly.length;
    const tex = texCanvas(128, 128, (g) => {
      g.fillStyle = '#d9c38f'; g.fillRect(0, 0, 128, 128);
      const r = rng(17);
      for (let i = 0; i < 1600; i++) { const v = r(); g.fillStyle = v < 0.5 ? 'rgba(150,120,70,.35)' : 'rgba(255,240,200,.4)'; g.fillRect(r() * 128, r() * 128, 1.6, 1.6); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (gw[i] < 0.05 && gw[j] < 0.05) continue;
      const a = poly[i], b = poly[j];
      const P = (p, nn, d) => [p.x - nn.x * d, 0.014, p.y - nn.y * d];
      const A = P(a, nor[i], 0.05), B = P(b, nor[j], 0.05), A2 = P(a, nor[i], 0.3 + gw[i]), B2 = P(b, nor[j], 0.3 + gw[j]);
      pos.push(...A, ...B, ...A2, ...A2, ...B, ...B2);
      for (const q of [A, B, A2, A2, B, B2]) uv.push(q[0] / 3, q[2] / 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }

  barrier(poly, nor, gw) {
    const pos = [], n = poly.length, h = 0.45;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = poly[i], b = poly[j], oa = 0.55 + gw[i], ob = 0.55 + gw[j];
      const ax = a.x - nor[i].x * oa, az = a.y - nor[i].y * oa, bx = b.x - nor[j].x * ob, bz = b.y - nor[j].y * ob;
      pos.push(ax, 0, az, bx, 0, bz, ax, h, az, ax, h, az, bx, 0, bz, bx, h, bz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // addobbi: tribuna con pubblico, box, alberi, persone, ruota panoramica. Sempre uguali per la stessa pista.
  decor(t) {
    const S = this.scene, r = rng(hashTrack(t)), taken = [];
    const free = (x, z, rad, minClear) => {
      const p = { x, y: z };
      if (inTrack(t, p) || clearance(t, p) < minClear + rad) return false;
      return !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + rad);
    };
    const take = (x, z, rad) => taken.push({ x, z, r: rad });
    const pc = [0xef4444, 0xf59e0b, 0x3b82f6, 0xa855f7, 0x10b981, 0xec4899, 0xffffff, 0x0ea5e9];
    const f = t.finish, m4 = new THREE.Matrix4(), col = new THREE.Color();
    const people = [];

    // tribuna: fuori dal bordo esterno, accanto alla linea, parallela al bordo
    const tryStand = () => {
      const k = f.outerSeg, a = t.outer[k], b = t.outer[(k + 1) % t.outer.length];
      const tx = b.x - a.x, tz = b.y - a.y, l = Math.hypot(tx, tz), ux = tx / l, uz = tz / l;
      for (const sgn of [1, -1]) {
        const nx = -uz * sgn, nz = ux * sgn;
        // estremo della linea che tocca il bordo esterno
        const ex = Math.hypot(f.a.x - a.x, f.a.y - a.y) < Math.hypot(f.b.x - a.x, f.b.y - a.y) ? f.a : f.b;
        for (let off = 3.8; off < 10; off += 0.8) {
          const x = ex.x + nx * off, z = ex.y + nz * off;
          const corners = [[-5, -1.3], [5, -1.3], [-5, 1.3], [5, 1.3], [0, 0]].map(([u, v]) => ({ x: x + ux * u + nx * v, y: z + uz * u + nz * v }));
          if (corners.every((c) => !pointInPoly(c, t.outer) && clearance(t, c) > 2.2)) return { x, z, ang: Math.atan2(uz, ux), nx, nz, ux, uz };
        }
      }
      return null;
    };
    const st = tryStand();
    if (st) {
      const g = new THREE.Group();
      const steps = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.8 });
      for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35 + i * 0.35, 0.6), steps); s.position.set(0, (0.35 + i * 0.35) / 2, -0.9 + i * 0.6); s.castShadow = s.receiveShadow = true; g.add(s); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.12, 3), new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }));
      roof.position.set(0, 2.8, 0.4); roof.castShadow = true; g.add(roof);
      for (const x of [-5, 5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.8, 0.15), steps); p.position.set(x, 1.4, 1.7); g.add(p); }
      g.position.set(st.x, 0, st.z);
      g.rotation.y = -st.ang;
      // la tribuna guarda la pista: il lato con i gradini bassi verso la linea
      const toTrack = new THREE.Vector3(-st.nx, 0, -st.nz), front = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y);
      if (front.dot(toTrack) < 0) g.rotation.y += Math.PI;
      S.add(g);
      g.updateMatrixWorld();
      for (let i = 0; i < 4; i++) for (let j = 0; j < 18; j++) if (r() < 0.85) {
        const v = new THREE.Vector3(-4.5 + j * 0.53 + r() * 0.1, 0.35 + i * 0.35 + 0.25, -0.9 + i * 0.6).applyMatrix4(g.matrixWorld);
        people.push([v.x, v.y, v.z]);
      }
      take(st.x, st.z, 5.6);
    }

    // cartelloni lungo i rettilinei, dietro la barriera esterna, rivolti verso la pista
    const ob = bends(t.outer), onor = inwardNormals(t.outer, true), gwo = this.gravelW.get(t.outer) || [];
    const ads = [['BINOTTOLAND', '#111827', '#facc15'], ['GARA A QUADRETTI', '#2563eb', '#ffffff'], ['MARCIA 7', '#dc2626', '#ffffff'], ['GIRO VELOCE', '#16a34a', '#ffffff'], ['PIT STOP', '#f97316', '#111827'], ['PLAYGROUND', '#9333ea', '#ffffff']];
    const adMat = ads.map(([txt, bg, fg]) => new THREE.MeshStandardMaterial({ roughness: 0.6, map: texCanvas(256, 64, (c) => { c.fillStyle = bg; c.fillRect(0, 0, 256, 64); c.fillStyle = fg; c.font = `bold ${txt.length > 12 ? 26 : 32}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 128, 34); }) }));
    const backMat = new THREE.MeshStandardMaterial({ color: 0x374151 }), postMat = new THREE.MeshStandardMaterial({ color: 0x6b7280 });
    let adN = 0, sinceLast = 99;
    for (let i = 0; i < t.outer.length; i++) {
      sinceLast++;
      if (sinceLast < 34 || ob[i].tight > 0.05) continue;
      const p = t.outer[i], nn = onor[i], d = 0.55 + (gwo[i] || 0) + 0.7;
      const x = p.x - nn.x * d, z = p.y - nn.y * d;
      if (taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.4)) continue;
      const q = t.outer[(i + 2) % t.outer.length], yaw = -Math.atan2(q.y - p.y, q.x - p.x);
      const g = new THREE.Group();
      const m = adMat[adN++ % adMat.length];
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.06), [backMat, backMat, backMat, backMat, m, m]);
      panel.position.y = 0.75; panel.castShadow = true; g.add(panel);
      for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.06), postMat); post.position.set(s * 1.05, 0.37, 0); g.add(post); }
      g.position.set(x, 0, z); g.rotation.y = yaw;
      S.add(g); take(x, z, 1.3); sinceLast = 0;
    }

    // box dei meccanici: dentro il bordo interno, vicino alla linea
    const ie = Math.hypot(f.a.x - t.inner[f.innerSeg].x, f.a.y - t.inner[f.innerSeg].y) < Math.hypot(f.b.x - t.inner[f.innerSeg].x, f.b.y - t.inner[f.innerSeg].y) ? f.a : f.b;
    for (let tries = 0; tries < 80; tries++) {
      const ang = r() * Math.PI * 2, d = 3 + tries * 0.12, x = ie.x + Math.cos(ang) * d, z = ie.y + Math.sin(ang) * d;
      if (pointInPoly({ x, y: z }, t.inner) && free(x, z, 1.6, 1)) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.3, 1.8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }));
        body.position.y = 0.65; body.castShadow = body.receiveShadow = true; g.add(body);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshBasicMaterial({ map: texCanvas(128, 40, (c) => { c.fillStyle = '#111'; c.fillRect(0, 0, 128, 40); c.fillStyle = '#fff'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.fillText('BOX', 64, 30); }) }));
        sign.position.set(0, 1.0, 0.91); g.add(sign);
        const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = -0.91; g.add(back);
        g.position.set(x, 0, z); g.rotation.y = Math.atan2(ie.x - x, ie.y - z);
        S.add(g); take(x, z, 1.9);
        break;
      }
    }

    // ruota panoramica: dove c'è più spazio
    const bb = t.bbox;
    let wheel = null;
    for (let i = 0; i < 400 && !wheel; i++) {
      const x = bb.minX - 8 + r() * (bb.maxX - bb.minX + 16), z = bb.minY - 8 + r() * (bb.maxY - bb.minY + 16);
      if (free(x, z, 3, 3.4)) wheel = { x, z };
    }
    if (wheel) {
      const g = new THREE.Group(), wm = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.6, roughness: 0.3 });
      const rot = new THREE.Group();
      rot.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.08, 8, 56), wm));
      this.cabins = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), wm); sp.position.set(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0); sp.rotation.z = a - Math.PI / 2; rot.add(sp);
        const cb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: pc[i % 6] })); cb.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6 - 0.2, 0); cb.castShadow = true; rot.add(cb); this.cabins.push(cb);
      }
      rot.position.y = 3.3; g.add(rot);
      for (const s of [-0.5, 0.5]) for (const k of [-1, 1]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.6, 0.14), wm); lg.position.set(k * 0.9, 1.7, s); lg.rotation.z = k * 0.25; lg.castShadow = true; g.add(lg); }
      g.position.set(wheel.x, 0, wheel.z); g.rotation.y = r() * Math.PI;
      S.add(g); take(wheel.x, wheel.z, 3.2);
      this.wheel = rot;
    } else this.wheel = null;

    // alberi
    const trees = [];
    for (let i = 0; i < 2000 && trees.length < 90; i++) {
      const x = bb.minX - 14 + r() * (bb.maxX - bb.minX + 28), z = bb.minY - 14 + r() * (bb.maxY - bb.minY + 28);
      const sc = 0.7 + r() * 0.8;
      if (free(x, z, 0.8 * sc, 3.4)) { trees.push({ x, z, sc, kind: r() < 0.5 ? 0 : 1 }); take(x, z, 0.8 * sc); }
    }
    const cone = new THREE.ConeGeometry(0.75, 1.9, 8), ball = new THREE.IcosahedronGeometry(0.85, 1), trunk = new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6);
    const cones = trees.filter((q) => !q.kind), balls = trees.filter((q) => q.kind);
    const T1 = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0x2d6a32, roughness: 0.9, flatShading: true }), Math.max(1, cones.length));
    const T2 = new THREE.InstancedMesh(ball, new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9, flatShading: true }), Math.max(1, balls.length));
    const TT = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x6b4423 }), Math.max(1, trees.length));
    T1.count = cones.length; T2.count = balls.length; TT.count = trees.length;
    cones.forEach((q, i) => { m4.makeScale(q.sc, q.sc, q.sc); m4.setPosition(q.x, (0.7 + 0.95) * q.sc, q.z); T1.setMatrixAt(i, m4); });
    balls.forEach((q, i) => { m4.makeScale(q.sc, q.sc * 1.1, q.sc); m4.setPosition(q.x, (0.7 + 0.7) * q.sc, q.z); T2.setMatrixAt(i, m4); });
    trees.forEach((q, i) => { m4.makeScale(q.sc, q.sc, q.sc); m4.setPosition(q.x, 0.35 * q.sc, q.z); TT.setMatrixAt(i, m4); });
    for (const m of [T1, T2, TT]) { m.castShadow = true; m.receiveShadow = true; S.add(m); }

    // pubblico sparso lungo il bordo esterno
    for (let i = 0; i < 3000 && people.length < 180; i++) {
      const k = Math.floor(r() * t.outer.length), p = t.outer[k];
      // sempre dietro la barriera (che nelle curve è più lontana per via della sabbia)
      const back = 0.55 + (gwo[k] || 0) + 0.45;
      const ang = r() * Math.PI * 2, d = back + r() * 2.5, x = p.x + Math.cos(ang) * d, z = p.y + Math.sin(ang) * d;
      if (free(x, z, 0.2, back - 0.2)) { people.push([x, 0.32, z]); take(x, z, 0.25); }
    }
    const PP = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.13, 0.28, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), Math.max(1, people.length));
    PP.count = people.length;
    people.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); PP.setMatrixAt(i, m4); PP.setColorAt(i, col.set(pc[Math.floor(r() * pc.length)])); });
    PP.castShadow = true; S.add(PP);
    if (this.night) this.lamps(t, S, taken);
  }

  // ---------- auto ----------
  makeCar(hex, num) {
    if (this.carProto) return this.makeModelCar(hex, num);
    const g = new THREE.Group(), body = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.45, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.15 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
    add(new THREE.BoxGeometry(0.62, 0.16, 0.34), paint, 0, 0.17, 0);
    add(new THREE.BoxGeometry(0.28, 0.1, 0.18), paint, 0.42, 0.14, 0);
    add(new THREE.BoxGeometry(0.08, 0.03, 0.5), paint, 0.58, 0.08, 0);
    add(new THREE.BoxGeometry(0.22, 0.12, 0.2), dark, -0.04, 0.3, 0);
    add(new THREE.BoxGeometry(0.06, 0.12, 0.44), paint, -0.36, 0.33, 0);
    const wg = new THREE.CylinderGeometry(0.1, 0.1, 0.09, 14);
    for (const [x, z] of [[0.24, 0.22], [0.24, -0.22], [-0.24, 0.24], [-0.24, -0.24]]) { const w = add(wg, tyre, x, 0.1, z); w.rotation.x = Math.PI / 2; }
    // numero di gara sul cofano
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: this.numTex(num), transparent: true }));
    nm.rotation.x = -Math.PI / 2; nm.rotation.z = -Math.PI / 2; nm.position.set(0.18, 0.252, 0); body.add(nm);
    g.add(body);
    g.userData.body = body;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.gearTex('N', hex), depthTest: false, transparent: true }));
    label.scale.set(0.55, 0.55, 1); label.position.y = 0.95; label.renderOrder = 10;
    g.add(label); g.userData.label = label;
    return g;
  }

  // auto dal modello di Blender: la vernice ("Paint") prende il colore dell'auto, le ruote girano e sterzano
  makeModelCar(hex, num) {
    const g = new THREE.Group(), body = new THREE.Group(), model = this.carProto.clone(true);
    const paint = new THREE.Color(hex);
    const light = paint.getHSL({}).l > 0.75; // auto chiara: alettoni e paratie scure
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const fix = mats.map((m) => {
        if (m.name === 'Paint') { const c = m.clone(); c.color.copy(paint); return c; }
        if (m.name === 'Accent' && light) { const c = m.clone(); c.color.set(0x1f2937); return c; }
        return m;
      });
      o.material = Array.isArray(o.material) ? fix : fix[0];
    });
    const wheels = { front: [], rear: [] };
    model.traverse((o) => { if (/^Ruota_A/.test(o.name)) wheels.front.push(o); else if (/^Ruota_P/.test(o.name)) wheels.rear.push(o); });
    body.add(model);
    // numero di gara sul muso
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: this.numTex(num), transparent: true, depthWrite: false }));
    nm.rotation.x = -Math.PI / 2; nm.rotation.z = -Math.PI / 2; nm.position.set(0.3, 0.142, 0); nm.renderOrder = 2;
    body.add(nm);
    g.add(body);
    g.userData.body = body; g.userData.wheels = wheels;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.gearTex('N', hex), depthTest: false, transparent: true }));
    label.scale.set(0.5, 0.5, 1); label.position.y = 0.85; label.renderOrder = 10;
    g.add(label); g.userData.label = label;
    return g;
  }

  // ruote: girano in base alla strada fatta, le anteriori sterzano
  rollWheels(car, dist, steer) {
    const w = car.userData.wheels;
    if (!w) return;
    for (const o of w.front) { o.rotation.z -= dist / 0.085; o.rotation.y = steer; }
    for (const o of w.rear) o.rotation.z -= dist / 0.095;
  }

  numTex(n) {
    const k = 'n' + n;
    if (!this.texCache.has(k))
      this.texCache.set(k, texCanvas(64, 64, (c) => {
        c.fillStyle = '#fff'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill();
        c.fillStyle = '#111'; c.font = `bold ${n > 9 ? 30 : 40}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 32, 35);
      }));
    return this.texCache.get(k);
  }

  gearTex(txt, hex) {
    const k = 'g' + txt + hex;
    if (!this.texCache.has(k))
      this.texCache.set(k, texCanvas(64, 64, (c) => {
        c.fillStyle = 'rgba(15,23,42,.85)'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill();
        c.strokeStyle = hex; c.lineWidth = 5; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 32, 34);
      }));
    return this.texCache.get(k);
  }

  setCars(race, colors) {
    for (const c of this.cars) this.scene.remove(c);
    this.cars = race.cars.map((car, i) => {
      const m = this.makeCar(colors[i].hex, colors[i].num);
      if (this.night) this.headlights(m);
      m.visible = !!car.pos;
      if (car.pos) m.position.set(car.pos.x, 0, car.pos.y);
      // in partenza le auto guardano esattamente perpendicolari alla linea
      m.rotation.y = Math.atan2(-race.track.normal.y, race.track.normal.x);
      this.scene.add(m);
      return m;
    });
    this.colors = colors;
  }

  // fari di notte: due luci davanti, due rosse dietro e il fascio di luce sull'asfalto
  headlights(car) {
    if (!this.beamTex) this.beamTex = texCanvas(128, 128, (g) => {
      const l = g.createLinearGradient(0, 0, 128, 0); l.addColorStop(0, 'rgba(255,245,210,.7)'); l.addColorStop(1, 'rgba(255,245,210,0)');
      g.fillStyle = l; g.beginPath(); g.moveTo(0, 54); g.lineTo(128, 10); g.lineTo(128, 118); g.lineTo(0, 74); g.closePath(); g.fill();
    });
    const front = new THREE.MeshBasicMaterial({ color: 0xfff7d6 }), rear = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), front); f.position.set(0.47, 0.09, 0.07 * s); car.add(f);
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), rear); r.position.set(-0.4, 0.2, 0.12 * s); car.add(r);
    }
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: this.beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.rotation.x = -Math.PI / 2; beam.position.set(0.45 + 1.6, 0.05, 0); beam.renderOrder = 3;
    car.add(beam);
  }

  setGear(i, gear) { this.cars[i].userData.label.material.map = this.gearTex(gear ? String(gear) : 'N', this.colors[i].hex); }

  placeCar(i, p, normal) {
    const m = this.cars[i]; m.visible = true;
    m.position.set(p.x, 0, p.y); m.rotation.y = Math.atan2(-normal.y, normal.x);
  }

  // gira l'auto ferma verso una direzione (anteprima della mossa), con le ruote che sterzano
  aimCar(i, yaw) {
    const m = this.cars[i], yaw0 = m.rotation.y;
    let turn = yaw - yaw0;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    if (Math.abs(turn) < 0.01) return Promise.resolve();
    return this.tween(220, (k) => { m.rotation.y = yaw0 + turn * k; this.rollWheels(m, 0, Math.max(-0.5, Math.min(0.5, turn)) * (1 - k * 0.5)); })
      .then(() => this.rollWheels(m, 0, 0));
  }

  moveCar(i, from, to, aim, crash) {
    const m = this.cars[i], yaw0 = m.rotation.y;
    let yaw1 = Math.atan2(-aim.y, aim.x);
    while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;
    const len = Math.hypot(to.x - from.x, to.y - from.y), steps = Math.max(1, len);
    const dur = 260 + steps * 70, turn = yaw1 - yaw0;
    let lastE = 0;
    // la telecamera segue l'auto finché si muove (se tocchi lo schermo smette)
    this.follow = m; this.rig.goal = null;
    return this.tween(dur, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.position.set(from.x + (to.x - from.x) * e, 0, from.y + (to.y - from.y) * e);
      m.rotation.y = yaw0 + turn * Math.min(1, k * 2.5);
      // sterzo: forte all'inizio della curva, torna dritto mentre l'auto si allinea
      const steer = Math.max(-0.5, Math.min(0.5, turn * 0.9)) * (k < 0.4 ? 1 : Math.max(0, 1 - (k - 0.4) / 0.4));
      this.rollWheels(m, (e - lastE) * len, steer);
      lastE = e;
    }).then(() => { this.rollWheels(m, 0, 0); return crash ? this.shake(i) : null; }).then(() => { if (this.follow === m) this.follow = null; });
  }

  turnCar(i, dir) {
    const m = this.cars[i], yaw0 = m.rotation.y;
    let yaw1 = Math.atan2(-dir.y, dir.x);
    while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;
    const turn = yaw1 - yaw0;
    return this.tween(600, (k) => { m.rotation.y = yaw0 + turn * k; this.rollWheels(m, 0, Math.max(-0.5, Math.min(0.5, turn)) * Math.sin(k * Math.PI)); });
  }

  shake(i) {
    const car = this.cars[i], b = car.userData.body;
    this.crashFx(car.position, car.rotation.y);
    return this.tween(650, (k) => { const a = Math.sin(k * 40) * (1 - k); b.rotation.y = a * 0.35; b.rotation.z = a * 0.12; }).then(() => { b.rotation.set(0, 0, 0); });
  }

  // segni di frenata: due righe scure sulla seconda metà della mossa, quando si scala o si sbatte
  skid(a, b) {
    const dx = b.x - a.x, dz = b.y - a.y, l = Math.hypot(dx, dz);
    if (l < 0.5) return;
    if (!this.skidMat) this.skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.32, depthWrite: false });
    if (!this.skids || this.skids.parent !== this.scene) { this.skids = new THREE.Group(); this.scene.add(this.skids); }
    const nx = -dz / l, nz = dx / l, from = 0.45, len = l * (1 - from);
    for (const s of [-0.17, 0.17]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.07), this.skidMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(dz, dx);
      m.position.set(a.x + dx * (from + (1 - from) / 2) + nx * s, 0.026, a.y + dz * (from + (1 - from) / 2) + nz * s);
      this.skids.add(m);
    }
    while (this.skids.children.length > 400) { const o = this.skids.children[0]; o.geometry.dispose(); this.skids.remove(o); }
  }

  // urto: scintille arancioni e sbuffi di fumo davanti all'auto
  crashFx(p, yaw) {
    const fx = new THREE.Group(); this.scene.add(fx);
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), at = p.clone().addScaledVector(fwd, 0.4);
    if (!this.puffTex) this.puffTex = texCanvas(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(235,235,235,.9)'); g.addColorStop(1, 'rgba(200,200,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    const parts = [];
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.15 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3));
      s.scale.setScalar(0.25);
      parts.push({ o: s, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4), grow: 1.6 + Math.random(), life: 1.4 + Math.random() * 0.6, smoke: true });
      fx.add(s);
    }
    const sg = new THREE.BoxGeometry(0.03, 0.03, 0.03);
    for (let k = 0; k < 26; k++) {
      const s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: k % 3 ? 0xffb020 : 0xfff3b0, transparent: true }));
      s.position.copy(at).setY(0.12);
      const a = Math.random() * Math.PI * 2;
      parts.push({ o: s, v: new THREE.Vector3(Math.cos(a) * 1.6, 1 + Math.random() * 1.6, Math.sin(a) * 1.6).addScaledVector(fwd, -1), life: 0.5 + Math.random() * 0.4, spark: true });
      fx.add(s);
    }
    this.fx.push({ group: fx, parts, t: 0 });
  }

  stepFx(dt) {
    this.fx = this.fx.filter((f) => {
      f.t += dt;
      let alive = false;
      for (const p of f.parts) {
        const k = f.t / p.life;
        if (k >= 1) { p.o.visible = false; continue; }
        alive = true;
        p.o.position.addScaledVector(p.v, dt);
        if (p.spark) { p.v.y -= 6 * dt; if (p.o.position.y < 0.02) { p.o.position.y = 0.02; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; } p.o.material.opacity = 1 - k; }
        else { p.o.scale.setScalar(0.25 + k * p.grow); p.o.material.opacity = 0.75 * (1 - k); p.v.multiplyScalar(0.97); }
      }
      if (!alive) { f.group.traverse((o) => { if (o.material) o.material.dispose(); }); this.scene.remove(f.group); }
      return alive;
    });
  }

  tween(ms, fn) {
    return new Promise((res) => this.anims.push({ t0: performance.now(), ms, fn, res }));
  }

  // ---------- scie ----------
  trailMat(i, lap) {
    const k = i + ':' + lap;
    if (!this.trailMats.has(k)) this.trailMats.set(k, new THREE.MeshBasicMaterial({ color: this.colors[i].hex, transparent: true, depthWrite: false }));
    return this.trailMats.get(k);
  }

  addTrail(i, a, b, lap) {
    const mat = this.trailMat(i, lap), dx = b.x - a.x, dz = b.y - a.y, l = Math.hypot(dx, dz);
    if (l > 0.01) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(l, 0.09), mat);
      s.rotation.x = -Math.PI / 2; s.rotation.z = -Math.atan2(dz, dx);
      s.position.set((a.x + b.x) / 2, 0.07 + i * 0.004, (a.y + b.y) / 2);
      s.userData.key = i + ':' + lap; this.trails.add(s);
    }
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), mat);
    d.rotation.x = -Math.PI / 2; d.position.set(b.x, 0.075 + i * 0.004, b.y); d.userData.key = i + ':' + lap;
    this.trails.add(d);
  }

  // giro in corso 100%, giro prima 50%, i più vecchi spariscono
  trailFade(i, lap) {
    for (const [k, m] of this.trailMats) {
      const [ci, l] = k.split(':').map(Number);
      if (ci !== i) continue;
      m.opacity = l >= lap ? 1 : l === lap - 1 ? 0.5 : 0;
    }
    for (const c of [...this.trails.children]) {
      const [ci, l] = c.userData.key.split(':').map(Number);
      if (ci === i && l < lap - 1) this.trails.remove(c);
    }
  }

  // ---------- segnali sulle caselle ----------
  markTex(kind, txt) {
    const k = 'm' + kind + txt;
    if (!this.texCache.has(k))
      this.texCache.set(k, texCanvas(128, 128, (c) => {
        if (kind === 'crash') {
          c.fillStyle = 'rgba(17,17,17,.88)'; c.beginPath(); c.arc(64, 64, 52, 0, 7); c.fill();
          c.strokeStyle = '#f87171'; c.lineWidth = 8; c.stroke();
          c.strokeStyle = '#fff'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(42, 42); c.lineTo(86, 86); c.moveTo(86, 42); c.lineTo(42, 86); c.stroke();
          return;
        }
        c.fillStyle = kind === 'slot' ? 'rgba(255,255,255,.9)' : GEAR_COL[kind];
        c.beginPath(); c.arc(64, 64, 54, 0, 7); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 8; c.stroke();
        c.fillStyle = kind === 'slot' ? '#0f172a' : '#fff'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 64, 68);
      }));
    return this.texCache.get(k);
  }

  showMarks(list) {
    this.clearMarks();
    const geo = new THREE.PlaneGeometry(0.82, 0.82);
    for (const o of list) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.markTex(o.kind, o.txt || ''), transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(o.x, 0.12, o.y); m.renderOrder = 5;
      m.userData = o;
      this.markers.add(m);
    }
  }
  // si toglie tutto quando la mossa parte: l'auto resta girata come nell'anteprima
  clearMarks() { for (const c of [...this.markers.children]) { c.material.dispose(); this.markers.remove(c); } this.clearPreview(false); }

  // anteprima della mossa scelta: puntini dall'auto al punto, un'auto "fantasma" dove arriverà,
  // e l'auto vera che si gira sulla bisettrice tra la direzione di prima e quella nuova
  showPreview(i, from, opt) {
    const keep = this.aimed && this.aimed.i === i ? this.aimed.yaw0 : this.cars[i].rotation.y;
    this.clearPreview(false);
    this.aimed = { i, yaw0: keep };
    const g = (this.preview = new THREE.Group());
    const dotGeo = new THREE.CircleGeometry(0.07, 10);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
    const red = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.95, depthWrite: false });
    const line = (a, b, mat) => {
      const l = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.floor(l / 0.3));
      for (let k = 1; k < n; k++) { const d = new THREE.Mesh(dotGeo, mat); d.rotation.x = -Math.PI / 2; d.position.set(a.x + ((b.x - a.x) * k) / n, 0.13, a.y + ((b.y - a.y) * k) / n); d.renderOrder = 6; g.add(d); }
    };
    if (opt.crash) { line(from, opt.stop, white); line(opt.stop, opt, red); } else line(from, opt, white);
    // auto fantasma
    const ghost = this.cars[i].clone(true);
    ghost.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = o.isSprite ? 0 : 0.6; o.material.depthWrite = false; } o.castShadow = false; o.renderOrder = 8; });
    // i dischi si attenuano, così l'auto fantasma si vede bene
    for (const m of this.markers.children) m.material.opacity = m.userData.x === opt.x && m.userData.y === opt.y ? 0.25 : 0.55;
    ghost.position.set(opt.stop.x, 0, opt.stop.y);
    const aim = { x: opt.x - from.x, y: opt.y - from.y };
    // rotazione impostata per intero: la copia dell'auto girata di 180° porta con sé x e z capovolti
    ghost.rotation.set(0, Math.atan2(-aim.y, aim.x), 0);
    g.add(ghost);
    // anello attorno al disco scelto
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 32), new THREE.MeshBasicMaterial({ color: opt.crash ? 0xf87171 : 0xffffff, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(opt.x, 0.14, opt.y); ring.renderOrder = 7; g.add(ring);
    this.ring = ring;
    this.scene.add(g);
    let half = ghost.rotation.y - keep;
    while (half > Math.PI) half -= Math.PI * 2;
    while (half < -Math.PI) half += Math.PI * 2;
    this.aimCar(i, keep + half / 2);
  }

  // restore: rimette l'auto com'era (quando si annulla la scelta)
  clearPreview(restore = true) {
    if (this.markers) for (const m of this.markers.children) m.material.opacity = 1;
    if (this.preview) {
      this.preview.traverse((o) => { if (o.material) o.material.dispose(); });
      this.scene.remove(this.preview); this.preview = null; this.ring = null;
    }
    if (this.aimed) {
      if (restore && this.cars[this.aimed.i]) this.aimCar(this.aimed.i, this.aimed.yaw0);
      this.aimed = null;
    }
  }

  // ---------- telecamera e tocchi ----------
  focus(p, near) {
    const cur = this.rig.goal ? this.rig.goal.dist : this.rig.dist;
    this.rig.goal = { tx: p.x, tz: p.y, dist: near ? Math.min(cur, 16) : cur };
  }
  setView(v) { this.view = v; }
  setGrid(on) { this.gridOn = on; if (this.grid) this.grid.visible = on; }

  input() {
    const el = this.renderer.domElement, P = this.pointers;
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* alcuni browser rifiutano: si va avanti lo stesso */ }
      P.set(e.pointerId, pos(e));
      this.rig.goal = null; this.follow = null;
      // mouse: tasto destro, rotellina premuta o Maiusc + sinistro = gira e inclina la vista
      this.tap = P.size === 1 ? { p: pos(e), moved: 0, btn: e.button, rot: e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey) } : null;
      if (P.size === 2) { const [a, b] = [...P.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }
    });
    el.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) return;
      const old = P.get(e.pointerId), p = pos(e);
      P.set(e.pointerId, p);
      if (P.size === 1) {
        const dx = p.x - old.x, dy = p.y - old.y;
        if (this.tap) this.tap.moved += Math.abs(dx) + Math.abs(dy);
        if (this.tap && this.tap.rot) { this.rig.yaw -= dx * 0.008; this.tilt(-dy * 0.006); return; }
        this.panBy(dx, dy);
      } else if (P.size === 2 && this.pinch) {
        const [a, b] = [...P.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.rig.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, this.rig.dist * (this.pinch.d / (d || 1))));
        this.rig.yaw += ang - this.pinch.ang;
        // due dita insieme in su o in giù inclinano la vista (come nelle mappe); di lato spostano
        this.tilt((m.y - this.pinch.m.y) * 0.006);
        this.panBy(m.x - this.pinch.m.x, 0);
        this.pinch = { d, ang, m };
      }
    });
    const end = (e) => {
      if (!P.has(e.pointerId)) return;
      const p = P.get(e.pointerId);
      P.delete(e.pointerId);
      if (P.size < 2) this.pinch = null;
      if (this.tap && this.tap.moved < 10 && P.size === 0 && this.tap.btn === 0 && !this.tap.rot) this.pick(p);
      if (P.size === 0) this.tap = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => { P.delete(e.pointerId); this.tap = null; this.pinch = null; });
    // rotellina: avvicina e allontana verso il punto sotto il mouse; con Maiusc inclina
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.rig.goal = null;
      if (e.shiftKey) { this.tilt(-e.deltaY * 0.002); return; }
      const R = this.rig, old = R.dist, hit = this.groundHit(pos(e));
      R.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, R.dist * Math.exp(e.deltaY * 0.0016)));
      if (hit) { const k = 1 - R.dist / old; R.tx += (hit.x - R.tx) * k; R.tz += (hit.z - R.tz) * k; }
    }, { passive: false });
  }

  // inclinazione: da quasi rasoterra a vista dall'alto
  tilt(d) {
    this.rig.pitch = this.userPitch = Math.min(1.52, Math.max(0.08, this.rig.pitch + d));
    if (this.view === 'top') { this.view = 'tilt'; this.onViewChange && this.onViewChange('tilt'); }
  }

  groundHit(p) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((p.x / r.width) * 2 - 1, -(p.y / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), hit) ? hit : null;
  }

  panBy(dx, dy) {
    const k = (this.rig.dist * 0.0021) * (900 / Math.max(500, this.host.clientHeight));
    const c = Math.cos(this.rig.yaw), s = Math.sin(this.rig.yaw);
    // destra dello schermo e "in su" sul terreno
    this.rig.tx -= (dx * c + dy * s) * k;
    this.rig.tz -= (-dx * s + dy * c) * k;
  }

  pick(p) {
    if (!this.onPick || !this.ground) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((p.x / r.width) * 2 - 1, -(p.y / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1), hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return;
    // segnale più vicino entro mezza casella e qualcosa
    let best = null, bd = 0.75;
    for (const m of this.markers.children) { const d = Math.hypot(m.position.x - hit.x, m.position.z - hit.z); if (d < bd) { bd = d; best = m.userData; } }
    this.onPick(best, { x: hit.x, y: hit.z });
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), now = performance.now();
    this.anims = this.anims.filter((a) => { const k = Math.min(1, (now - a.t0) / a.ms); a.fn(k); if (k >= 1) { a.res(); return false; } return true; });
    if (this.fx.length) this.stepFx(dt);
    for (const c of this.clouds || []) { c.s.position.x += c.v * dt; if (c.s.position.x > c.cx + c.R * 0.85) c.s.position.x = c.cx - c.R * 0.85; }
    if (this.wheel) { this.wheel.rotation.z += dt * 0.25; for (const c of this.cabins || []) c.rotation.z = -this.wheel.rotation.z; }
    const pulse = 1 + Math.sin(now * 0.006) * 0.08;
    if (this.markers) for (const m of this.markers.children) m.scale.set(pulse, pulse, 1);
    if (this.ring) { const k = 1 + Math.sin(now * 0.01) * 0.12; this.ring.scale.set(k, k, 1); }
    const R = this.rig;
    // inseguimento morbido dell'auto in movimento, un po' avanti nel verso in cui va
    if (this.follow) {
      const f = this.follow, y = f.rotation.y, ax = f.position.x + Math.cos(y) * 1.2, az = f.position.z - Math.sin(y) * 1.2;
      R.tx += (ax - R.tx) * 0.12; R.tz += (az - R.tz) * 0.12;
    }
    if (R.goal) { R.tx += (R.goal.tx - R.tx) * 0.08; R.tz += (R.goal.tz - R.tz) * 0.08; R.dist += (R.goal.dist - R.dist) * 0.08; if (Math.hypot(R.goal.tx - R.tx, R.goal.tz - R.tz) < 0.02) R.goal = null; }
    const pitchGoal = this.view === 'top' ? 1.5 : this.userPitch ?? 0.95;
    if (this.view === 'top' || !(this.tap && this.tap.rot)) R.pitch += (pitchGoal - R.pitch) * 0.08;
    const cp = Math.cos(R.pitch), sp = Math.sin(R.pitch);
    this.camera.position.set(R.tx + Math.sin(R.yaw) * cp * R.dist, sp * R.dist, R.tz + Math.cos(R.yaw) * cp * R.dist);
    this.camera.lookAt(R.tx, 0, R.tz);
    this.renderer.render(this.scene, this.camera);
  }
}
