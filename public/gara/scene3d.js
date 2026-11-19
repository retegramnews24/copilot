// La pista in 3D, costruita dagli stessi punti usati dalle regole.
// Mondo: x = colonna della casella, z = riga della casella, y = altezza. 1 unità = 1 casella.
import * as THREE from '../vendor/three/three.module.min.js';
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

function texCanvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

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
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const b = this.host.getBoundingClientRect();
    if (!b.width) return;
    this.renderer.setSize(b.width, b.height, false);
    this.camera.aspect = b.width / b.height; this.camera.updateProjectionMatrix();
  }

  // ---------- costruzione della pista ----------
  build(track) {
    this.track = track;
    const S = (this.scene = new THREE.Scene());
    const sky = 0xa8d8f5;
    S.background = new THREE.Color(sky);
    const bb = track.bbox, span = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
    this.center = { x: (bb.minX + bb.maxX) / 2, z: (bb.minY + bb.maxY) / 2 };
    S.fog = new THREE.Fog(sky, span * 0.9 + 30, span * 2.2 + 80);
    S.add(new THREE.HemisphereLight(0xe3f3ff, 0x52763d, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    const half = span / 2 + 14;
    sun.position.set(this.center.x + half * 0.6, half * 1.4, this.center.z + half * 0.45);
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

    // cordoli bianchi e rossi, verso l'asfalto
    for (const [poly, inside] of [[track.outer, true], [track.inner, false]]) {
      S.add(this.kerb(poly, inwardNormals(poly, inside)));
      S.add(this.barrier(poly, inwardNormals(poly, inside)));
    }

    // linea di partenza a scacchi
    const f = track.finish, L = Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
    const flag = texCanvas(128, 16, (g) => { for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(i * 4, j * 4, 4, 4); } });
    flag.magFilter = THREE.NearestFilter; flag.wrapS = THREE.RepeatWrapping; flag.repeat.set(L / 8, 1);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.55), new THREE.MeshStandardMaterial({ map: flag, roughness: 0.8 }));
    fl.rotation.x = -Math.PI / 2; fl.rotation.z = -Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x);
    fl.position.set((f.a.x + f.b.x) / 2, 0.04, (f.a.y + f.b.y) / 2); fl.receiveShadow = true;
    S.add(fl);
    // portale sopra la linea
    const gantry = new THREE.Group(), gm = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.5, roughness: 0.4 });
    for (const e of [f.a, f.b]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), gm); post.position.set(e.x, 1.3, e.y); post.castShadow = true; gantry.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.45, 0.14), new THREE.MeshStandardMaterial({ map: flag }));
    beam.position.set((f.a.x + f.b.x) / 2, 2.6, (f.a.y + f.b.y) / 2); beam.rotation.y = -Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x); beam.castShadow = true;
    gantry.add(beam); S.add(gantry);

    // griglia delle caselle: le auto stanno sugli incroci
    const gx0 = Math.floor(bb.minX) - 1, gx1 = Math.ceil(bb.maxX) + 1, gz0 = Math.floor(bb.minY) - 1, gz1 = Math.ceil(bb.maxY) + 1;
    const gp = [];
    for (let x = gx0; x <= gx1; x++) gp.push(x, 0.05, gz0, x, 0.05, gz1);
    for (let z = gz0; z <= gz1; z++) gp.push(gx0, 0.05, z, gx1, 0.05, z);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
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

  kerb(poly, nor) {
    const pos = [], col = [], n = poly.length, w = 0.38, red = new THREE.Color(0xd92b2b), white = new THREE.Color(0xf5f5f5);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = poly[i], b = poly[j], na = nor[i], nb = nor[j];
      const c = Math.floor(acc / 0.9) % 2 ? red : white;
      acc += Math.hypot(b.x - a.x, b.y - a.y);
      const A = [a.x, 0.045, a.y], B = [b.x, 0.045, b.y], A2 = [a.x + na.x * w, 0.045, a.y + na.y * w], B2 = [b.x + nb.x * w, 0.045, b.y + nb.y * w];
      pos.push(...A, ...B, ...A2, ...A2, ...B, ...B2);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }

  barrier(poly, nor) {
    const pos = [], n = poly.length, off = 0.55, h = 0.45;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = poly[i], b = poly[j];
      const ax = a.x - nor[i].x * off, az = a.y - nor[i].y * off, bx = b.x - nor[j].x * off, bz = b.y - nor[j].y * off;
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
        for (let off = 3.2; off < 9; off += 0.8) {
          const x = ex.x + nx * off, z = ex.y + nz * off;
          const corners = [[-5, -1.3], [5, -1.3], [-5, 1.3], [5, 1.3], [0, 0]].map(([u, v]) => ({ x: x + ux * u + nx * v, y: z + uz * u + nz * v }));
          if (corners.every((c) => !pointInPoly(c, t.outer) && clearance(t, c) > 1.4)) return { x, z, ang: Math.atan2(uz, ux), nx, nz, ux, uz };
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
      if (free(x, z, 3, 1.5)) wheel = { x, z };
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
      if (free(x, z, 0.8 * sc, 1.6)) { trees.push({ x, z, sc, kind: r() < 0.5 ? 0 : 1 }); take(x, z, 0.8 * sc); }
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
      const ang = r() * Math.PI * 2, d = 1.6 + r() * 2.5, x = p.x + Math.cos(ang) * d, z = p.y + Math.sin(ang) * d;
      if (free(x, z, 0.2, 1.2)) { people.push([x, 0.32, z]); take(x, z, 0.25); }
    }
    const PP = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.13, 0.28, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), Math.max(1, people.length));
    PP.count = people.length;
    people.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); PP.setMatrixAt(i, m4); PP.setColorAt(i, col.set(pc[Math.floor(r() * pc.length)])); });
    PP.castShadow = true; S.add(PP);
  }

  // ---------- auto ----------
  makeCar(hex, num) {
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
      m.visible = !!car.pos;
      if (car.pos) m.position.set(car.pos.x, 0, car.pos.y);
      m.rotation.y = Math.atan2(-car.dir.y, car.dir.x);
      this.scene.add(m);
      return m;
    });
    this.colors = colors;
  }

  setGear(i, gear) { this.cars[i].userData.label.material.map = this.gearTex(gear ? String(gear) : 'N', this.colors[i].hex); }

  placeCar(i, p, dir) {
    const m = this.cars[i]; m.visible = true;
    m.position.set(p.x, 0, p.y); m.rotation.y = Math.atan2(-dir.y, dir.x);
  }

  moveCar(i, from, to, aim, crash) {
    const m = this.cars[i], yaw0 = m.rotation.y;
    let yaw1 = Math.atan2(-aim.y, aim.x);
    while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;
    const steps = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    const dur = 260 + steps * 70;
    return this.tween(dur, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.position.set(from.x + (to.x - from.x) * e, 0, from.y + (to.y - from.y) * e);
      m.rotation.y = yaw0 + (yaw1 - yaw0) * Math.min(1, k * 2.5);
    }).then(() => crash ? this.shake(i) : null);
  }

  turnCar(i, dir) {
    const m = this.cars[i], yaw0 = m.rotation.y;
    let yaw1 = Math.atan2(-dir.y, dir.x);
    while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;
    return this.tween(600, (k) => { m.rotation.y = yaw0 + (yaw1 - yaw0) * k; });
  }

  shake(i) {
    const b = this.cars[i].userData.body;
    return this.tween(650, (k) => { const a = Math.sin(k * 40) * (1 - k); b.rotation.y = a * 0.35; b.rotation.z = a * 0.12; }).then(() => { b.rotation.set(0, 0, 0); });
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
  clearMarks() { for (const c of [...this.markers.children]) { c.material.dispose(); this.markers.remove(c); } }

  // ---------- telecamera e tocchi ----------
  focus(p, near) {
    this.rig.goal = { tx: p.x, tz: p.y, dist: near ? Math.min(this.rig.dist, 16) : this.rig.dist };
  }
  setView(v) { this.view = v; }
  setGrid(on) { this.gridOn = on; if (this.grid) this.grid.visible = on; }

  input() {
    const el = this.renderer.domElement, P = this.pointers;
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      P.set(e.pointerId, pos(e));
      this.rig.goal = null;
      this.tap = P.size === 1 ? { p: pos(e), moved: 0, btn: e.button } : null;
      if (P.size === 2) { const [a, b] = [...P.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; }
    });
    el.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) return;
      const old = P.get(e.pointerId), p = pos(e);
      P.set(e.pointerId, p);
      if (P.size === 1) {
        const dx = p.x - old.x, dy = p.y - old.y;
        if (this.tap) this.tap.moved += Math.abs(dx) + Math.abs(dy);
        if (this.tap && this.tap.btn === 2) { this.rig.yaw -= dx * 0.008; this.rig.pitch = this.userPitch = Math.min(1.5, Math.max(0.35, this.rig.pitch - dy * 0.005)); return; }
        this.panBy(dx, dy);
      } else if (P.size === 2 && this.pinch) {
        const [a, b] = [...P.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.rig.dist = Math.min(220, Math.max(5, this.rig.dist * (this.pinch.d / (d || 1))));
        this.rig.yaw += ang - this.pinch.ang;
        this.panBy(m.x - this.pinch.m.x, m.y - this.pinch.m.y);
        this.pinch = { d, ang, m };
      }
    });
    const end = (e) => {
      if (!P.has(e.pointerId)) return;
      const p = P.get(e.pointerId);
      P.delete(e.pointerId);
      if (P.size < 2) this.pinch = null;
      if (this.tap && this.tap.moved < 10 && P.size === 0 && this.tap.btn === 0) this.pick(p);
      if (P.size === 0) this.tap = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => { P.delete(e.pointerId); this.tap = null; this.pinch = null; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.goal = null; this.rig.dist = Math.min(220, Math.max(5, this.rig.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
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
    if (this.wheel) { this.wheel.rotation.z += dt * 0.25; for (const c of this.cabins || []) c.rotation.z = -this.wheel.rotation.z; }
    const pulse = 1 + Math.sin(now * 0.006) * 0.08;
    if (this.markers) for (const m of this.markers.children) m.scale.set(pulse, pulse, 1);
    const R = this.rig;
    if (R.goal) { R.tx += (R.goal.tx - R.tx) * 0.08; R.tz += (R.goal.tz - R.tz) * 0.08; R.dist += (R.goal.dist - R.dist) * 0.08; if (Math.hypot(R.goal.tx - R.tx, R.goal.tz - R.tz) < 0.02) R.goal = null; }
    const pitchGoal = this.view === 'top' ? 1.5 : this.userPitch ?? 0.95;
    if (this.view === 'top' || !this.tap || this.tap.btn !== 2) R.pitch += (pitchGoal - R.pitch) * 0.08;
    const cp = Math.cos(R.pitch), sp = Math.sin(R.pitch);
    this.camera.position.set(R.tx + Math.sin(R.yaw) * cp * R.dist, sp * R.dist, R.tz + Math.cos(R.yaw) * cp * R.dist);
    this.camera.lookAt(R.tx, 0, R.tz);
    this.renderer.render(this.scene, this.camera);
  }
}
