// Scena 3D: la sala giochi (neon, luci colorate, altri tavoli, cabinati), il tavolo della specialità scelta,
// bilie, birilli, stecca, linee di mira e la telecamera libera (ruota, sposta, zoom a mano).
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { PIN_R } from './physics.js?v=ba3146227c';

export const CLOTHS = {
  verde: { c: '#0c5e38', name: 'Verde' },
  blu: { c: '#174c86', name: 'Blu' },
  rosso: { c: '#7e1a26', name: 'Bordeaux' },
  grigio: { c: '#3f4652', name: 'Grafite' },
  viola: { c: '#4b2a7a', name: 'Viola' },
};
const FLOOR_Y = -0.78;

// ---------- texture disegnate al volo ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function ballTexture(look) {
  return canvasTex(512, 256, (g, w, h) => {
    const base = look.stripe ? '#f4f1e6' : look.color;
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (look.stripe) { g.fillStyle = look.color; g.fillRect(0, h * 0.3, w, h * 0.4); }
    if (look.ring) { g.fillStyle = look.ring; g.fillRect(0, h * 0.46, w, h * 0.08); }
    if (look.dot) {
      g.fillStyle = '#c0262d';
      for (const [u, v] of [[0.25, 0.5], [0.75, 0.5], [0.5, 0.15], [0, 0.85]]) { g.beginPath(); g.ellipse(u * w, v * h, 10, 10 / Math.max(0.3, Math.sin(v * Math.PI)), 0, 0, 7); g.fill(); }
    }
    if (look.num) for (const u of [0.25, 0.75]) {
      const x = u * w, y = h / 2;
      g.fillStyle = '#f4f1e6'; g.beginPath(); g.ellipse(x, y, 40, 40, 0, 0, 7); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 50px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(look.num), x, y + 3);
      if (look.num === 6 || look.num === 9) g.fillRect(x - 13, y + 26, 26, 4);
    }
  });
}

function noiseTex(size = 512, lo = 118, hi = 20) {
  return canvasTex(size, size, (g, w, h) => {
    const im = g.createImageData(w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = lo + Math.random() * hi; d[i] = d[i + 1] = d[i + 2] = n; d[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }, false);
}

function woodTexture() {
  return canvasTex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#4a2412'); gr.addColorStop(0.5, '#5c2e17'); gr.addColorStop(1, '#43200f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const y = Math.random() * h, a = 0.04 + Math.random() * 0.1;
      g.strokeStyle = Math.random() < 0.5 ? `rgba(20,8,2,${a})` : `rgba(140,80,40,${a * 0.6})`;
      g.lineWidth = 0.5 + Math.random() * 2.5;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 + Math.sin(x * 0.043 + i * 3) * 1.5);
      g.stroke();
    }
  });
}

function tileTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const l = (i + j) % 2 ? 9 : 14;
      g.fillStyle = `hsl(250, 12%, ${l + Math.random() * 2}%)`; g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(i * s, j * s, s, s);
    }
  });
}

function wallTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1a1219'; g.fillRect(0, 0, w, h);
    // pannelli
    for (let x = 0; x < w; x += 128) {
      const gr = g.createLinearGradient(x, 0, x + 128, 0);
      gr.addColorStop(0, '#22171f'); gr.addColorStop(0.5, '#2a1c26'); gr.addColorStop(1, '#1d141b');
      g.fillStyle = gr; g.fillRect(x + 4, 20, 120, h - 40);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeRect(x + 4, 20, 120, h - 40);
    }
  });
}

function neonText(text, color, w = 1024, h = 256, font = 'bold 150px "Brush Script MT", "Segoe Script", cursive') {
  return canvasTex(w, h, (g) => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 40; g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 12; g.fillStyle = '#ffffff'; g.globalAlpha = 0.85;
    g.fillText(text, w / 2, h / 2);
  });
}

function arcadeScreen(hue) {
  return canvasTex(256, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `hsl(${hue},80%,18%)`); gr.addColorStop(1, `hsl(${hue + 60},80%,8%)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.fillStyle = `hsl(${hue + Math.random() * 120},100%,60%)`; g.fillRect(Math.random() * w, Math.random() * h, 8, 8); }
    g.fillStyle = '#fff'; g.font = 'bold 22px monospace'; g.textAlign = 'center'; g.fillText('INSERT COIN', w / 2, h - 24);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, w, 1); }
  });
}

// ---------- geometria del tavolo ----------
function shapeFrom(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}
function pathFrom(pts) {
  const s = new THREE.Path();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}
function flatExtrude(shape, depth, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// lunette delle buche sul bordo interno del legno (A, B = bordo interno)
function pocketArcs(T, A, B, rad) {
  const out = [];
  for (const p of T.pockets) {
    const pts = [];
    const lineZ = Math.sign(p.z) * B, lineX = Math.sign(p.x || 1) * A;
    const dz = lineZ - p.z;
    if (Math.abs(dz) < rad) { const dx = Math.sqrt(rad * rad - dz * dz); pts.push([p.x - dx, lineZ], [p.x + dx, lineZ]); }
    if (p.corner) { const dx = lineX - p.x; if (Math.abs(dx) < rad) { const d = Math.sqrt(rad * rad - dx * dx); pts.push([lineX, p.z - d], [lineX, p.z + d]); } }
    const on = pts.filter(([x, z]) => Math.abs(x) <= A + 1e-6 && Math.abs(z) <= B + 1e-6);
    if (on.length < 2) continue;
    const [a, b] = on;
    const a1 = Math.atan2(a[1] - p.z, a[0] - p.x), a2 = Math.atan2(b[1] - p.z, b[0] - p.x);
    let e2 = a2; while (e2 < a1) e2 += Math.PI * 2;
    let e3 = a2; while (e3 > a1) e3 -= Math.PI * 2;
    const far = (e) => { const m = (a1 + e) / 2; return Math.hypot(p.x + Math.cos(m) * rad, p.z + Math.sin(m) * rad); };
    const end = far(e2) > far(e3) ? e2 : e3;
    const arc = [];
    for (let i = 0; i <= 24; i++) { const t = a1 + (end - a1) * (i / 24); arc.push([p.x + Math.cos(t) * rad, p.z + Math.sin(t) * rad]); }
    out.push({ p, arc });
  }
  return out;
}
function innerOutline(T, A, B, rad) {
  if (!T.pockets.length) return [[-A, -B], [A, -B], [A, B], [-A, B]];
  const P = 4 * A + 4 * B;
  const per = (x, z) => {
    if (Math.abs(z + B) < 1e-6) return x + A;
    if (Math.abs(x - A) < 1e-6) return 2 * A + (z + B);
    if (Math.abs(z - B) < 1e-6) return 2 * A + 2 * B + (A - x);
    return 4 * A + 2 * B + (B - z);
  };
  const segs = pocketArcs(T, A, B, rad).map((a) => {
    let s = per(...a.arc[0]), e = per(...a.arc[a.arc.length - 1]), arc = a.arc;
    if ((((e - s) % P) + P) % P > P / 2) { arc = arc.slice().reverse(); s = e; }
    return { s, arc };
  }).sort((x, y) => x.s - y.s);
  const pts = [];
  for (const sg of segs) for (const q of sg.arc) pts.push(q);
  return pts;
}

// poligoni delle sponde
function cushionPieces(T) {
  const { L, W, cush } = T, out = [];
  if (!T.pockets.length) {
    const c = cush;
    out.push([[-L, -W], [L, -W], [L + c, -W - c], [-L - c, -W - c]]);
    out.push([[-L, W], [L, W], [L + c, W + c], [-L - c, W + c]]);
    out.push([[-L, -W], [-L, W], [-L - c, W + c], [-L - c, -W - c]]);
    out.push([[L, -W], [L, W], [L + c, W + c], [L + c, -W - c]]);
    return out;
  }
  const mains = T.rails.filter((s) => (s.x1 === s.x2 ? Math.abs(s.x1) === L && Math.abs(s.z1) < W : Math.abs(s.z1) === W && s.z1 === s.z2));
  for (const m of mains) {
    const horiz = m.z1 === m.z2;
    const ends = [[m.x1, m.z1], [m.x2, m.z2]];
    const back = ends.map(([x, z]) => {
      const j = T.rails.find((s) => s !== m && s.x1 === x && s.z1 === z);
      const dx = j.x2 - j.x1, dz = j.z2 - j.z1;
      const t = horiz ? cush / Math.abs(dz) : cush / Math.abs(dx);
      return [x + dx * t, z + dz * t];
    });
    out.push([ends[0], ends[1], back[1], back[0]]);
  }
  return out;
}

export class Table3D {
  constructor(host, opts = {}) {
    this.host = host;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#07050a');
    this.scene.fog = new THREE.FogExp2('#0a0610', 0.022);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 60);
    // telecamera "a orbita": imbardata, inclinazione, distanza attorno a un punto del tavolo
    this.cam = { yaw: 0, pitch: 0.95, dist: 3.2, tx: 0, tz: 0 };
    this.goal = { ...this.cam };
    this.view = 'over';
    this.userYaw = 0;
    this.clock = 0;

    this.buildEnv();
    this.buildRoom();
    this.tableGroup = new THREE.Group(); this.scene.add(this.tableGroup);
    this.ballGroup = new THREE.Group(); this.scene.add(this.ballGroup);
    this.buildCue();
    this.buildAim();
    this.setQuality(opts.quality || (this.mobile ? 'media' : 'alta'));
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // luminosità (0.3 … 1.5): esposizione della scena e forza del bagliore dei neon
  setBrightness(v) {
    this.bright = v;
    this.renderer.toneMappingExposure = 0.95 * v;
    if (this.bloom) this.bloom.strength = 0.5 * Math.min(1, v);
  }

  // ---------- qualità grafica ----------
  setQuality(q) {
    this.quality = q;
    const r = this.renderer;
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(Math.min(dpr, q === 'alta' ? 2 : q === 'media' ? 1.5 : 1));
    r.shadowMap.enabled = q !== 'bassa';
    const size = q === 'alta' ? 2048 : 1024;
    for (const l of this.lights) if (l.castShadow) { l.shadow.mapSize.set(size, size); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    if (q !== 'bassa') {
      if (!this.composer) {
        this.composer = new EffectComposer(r);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // soglia alta: si illuminano solo neon, lampade e schermi, non il panno
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 1.0);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());
      }
      if (this.bright) this.setBrightness(this.bright);
    }
    this.dust.visible = q === 'alta';
    this.resize();
  }

  // riflessi: una "stanza" buia con i pannelli della lampada e strisce colorate, così le bilie riflettono la sala
  buildEnv() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const es = new THREE.Scene();
    es.background = new THREE.Color('#050307');
    const room = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 14), new THREE.MeshBasicMaterial({ color: '#140c16', side: THREE.BackSide }));
    room.position.y = 2; es.add(room);
    const panel = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(9) });
    for (const x of [-0.75, 0, 0.75]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), panel);
      m.rotation.x = Math.PI / 2; m.position.set(x, 1.3, 0); es.add(m);
    }
    const strip = (color, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3) })); m.position.set(x, 3, z); m.rotation.y = ry; es.add(m); };
    strip('#ff2bd6', 0, -6.9, 0); strip('#22d3ee', -6.9, 0, Math.PI / 2); strip('#22d3ee', 6.9, 0, -Math.PI / 2); strip('#8b5cf6', 0, 6.9, Math.PI);
    this.scene.environment = pm.fromScene(es, 0.03).texture;
    pm.dispose();
  }

  // ---------- sala giochi ----------
  buildRoom() {
    const s = this.scene;
    const RW = 9, RD = 7, RH = 3.8;
    s.add(new THREE.HemisphereLight('#ffe7f5', '#120914', 0.22));
    // lampada sopra il tavolo: 3 faretti, i due laterali fanno ombra
    this.lights = [];
    [-0.8, 0.8, 0].forEach((x, i) => {
      const sp = new THREE.SpotLight('#fff2df', i === 2 ? 4.5 : 7, 4, Math.PI / 4.4, 0.8, 1.4);
      sp.position.set(x, 1.3, 0);
      sp.target.position.set(x * 1.05, 0, 0);
      if (i < 2) {
        sp.castShadow = true;
        sp.shadow.bias = -0.00012; sp.shadow.normalBias = 0.01; sp.shadow.radius = 4;
        sp.shadow.camera.near = 0.6; sp.shadow.camera.far = 2.6;
      }
      s.add(sp, sp.target);
      this.lights.push(sp);
    });
    const lamp = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#1d2a22', metalness: 0.7, roughness: 0.35 });
    const shade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.44), metal);
    shade.position.y = 1.42; lamp.add(shade);
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff3dc').multiplyScalar(2.4) });
    for (const x of [-0.8, 0, 0.8]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), glow); p.rotation.x = Math.PI / 2; p.position.set(x, 1.368, 0); lamp.add(p); }
    const brass = new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 1, roughness: 0.3 });
    for (const x of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 2.4, 6), brass); c.position.set(x, 2.65, 0); lamp.add(c); }
    s.add(lamp);
    this.lamp = lamp;
    // coni di luce finti (volumetrici) e pulviscolo che ci galleggia dentro
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: new THREE.Color('#fff1d6') } },
      vertexShader: 'varying float vy; void main(){ vy = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 c; varying float vy; void main(){ gl_FragColor = vec4(c, 0.05*pow(vy,1.6)); }',
    });
    this.cones = [];
    for (const x of [-0.8, 0, 0.8]) {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.75, 1.32, 32, 1, true), coneMat);
      cone.position.set(x, 0.7, 0); s.add(cone); this.cones.push(cone);
    }
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 2.6; pos[i * 3 + 1] = 0.1 + Math.random() * 1.2; pos[i * 3 + 2] = (Math.random() - 0.5) * 1.2; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#fff3dc', size: 0.005, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.dust);

    // pavimento lucido e tappeto
    const ft = tileTexture(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(4, 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.22, metalness: 0.2, envMapIntensity: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; s.add(floor);
    const rugT = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#3a0d22'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c99a3c'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      g.strokeStyle = 'rgba(201,154,60,0.5)'; g.lineWidth = 2; g.strokeRect(28, 28, w - 56, h - 56);
    });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.4), new THREE.MeshStandardMaterial({ map: rugT, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR_Y + 0.003; rug.receiveShadow = true; s.add(rug);
    // pareti e soffitto
    const wt = wallTexture(); wt.wrapS = THREE.RepeatWrapping; wt.repeat.set(4, 1);
    const wallM = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.8 });
    const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), wallM); m.position.set(x, FLOOR_Y + RH / 2, z); m.rotation.y = ry; m.receiveShadow = true; s.add(m); };
    wall(RW * 2, 0, -RD, 0); wall(RW * 2, 0, RD, Math.PI); wall(RD * 2, -RW, 0, Math.PI / 2); wall(RD * 2, RW, 0, -Math.PI / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, RD * 2), new THREE.MeshStandardMaterial({ color: '#0b070d', roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = FLOOR_Y + RH; s.add(ceil);
    // zoccolo in legno
    const wood = woodTexture(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    const woodM = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5 });
    for (const [w, x, z, ry] of [[RW * 2, 0, -RD + 0.03, 0], [RW * 2, 0, RD - 0.03, Math.PI], [RD * 2, -RW + 0.03, 0, Math.PI / 2], [RD * 2, RW - 0.03, 0, -Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), woodM); m.position.set(x, FLOOR_Y + 0.45, z); m.rotation.y = ry; s.add(m);
    }
    // strisce LED colorate sotto il soffitto
    const neon = (color, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
    const strip = (color, w, x, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.03), neon(color)); m.position.set(x, FLOOR_Y + RH - 0.12, z); m.rotation.y = ry; s.add(m); };
    strip('#ff2bd6', RW * 2 - 0.2, 0, -RD + 0.06, 0);
    strip('#8b5cf6', RW * 2 - 0.2, 0, RD - 0.06, 0);
    strip('#22d3ee', RD * 2 - 0.2, -RW + 0.06, 0, Math.PI / 2);
    strip('#22d3ee', RD * 2 - 0.2, RW - 0.06, 0, Math.PI / 2);
    // luci colorate della sala
    for (const [c, x, y, z, i] of [['#ff2bd6', -5, 2.2, -5.5, 9], ['#22d3ee', 6.5, 2, -3, 8], ['#8b5cf6', -6, 2, 4.5, 8], ['#ffb347', 5, 1.6, 5, 5]]) {
      const l = new THREE.PointLight(c, i, 11, 1.6); l.position.set(x, y, z); s.add(l);
    }
    // insegne al neon
    const sign = (tex, w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2) }));
      m.position.set(x, y, z); m.rotation.y = ry; s.add(m); return m;
    };
    this.signs = [
      sign(neonText('Biliardo', '#ff3fd8'), 3.4, 0.85, -1.5, 1.85, -RD + 0.05, 0),
      sign(neonText('SALA GIOCHI', '#3ee7ff', 1024, 256, 'bold 120px "Arial Black", Arial, sans-serif'), 3, 0.75, 0, 1.9, RD - 0.05, Math.PI),
      sign(neonText('8', '#ffd23f', 256, 256, 'bold 190px Arial, sans-serif'), 0.7, 0.7, 2.2, 1.9, -RD + 0.05, 0),
    ];
    this.buildProps(RW, RD);
  }

  buildProps(RW, RD) {
    const s = this.scene;
    const std = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    // altri tavoli sullo sfondo, con la loro lampada
    const felt = [std('#0b4f8a', 0.95), std('#6d1830', 0.95)];
    const body = new THREE.MeshPhysicalMaterial({ color: '#3a1a0c', roughness: 0.4, clearcoat: 0.8 });
    [[-5.4, -3.6, 0], [5.2, 3.4, 1]].forEach(([x, z, k]) => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.22, 1.6), body); b.position.y = -0.1; g.add(b);
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 1.32), felt[k]); t.position.y = 0.02; g.add(t);
      for (const lx of [-1.2, 1.2]) for (const lz of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), body); l.position.set(lx, -0.5, lz); g.add(l); }
      const lampB = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.36), std('#151515', 0.4, 0.6)); lampB.position.y = 1.4; g.add(lampB);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d8').multiplyScalar(2) })); glow.rotation.x = Math.PI / 2; glow.position.y = 1.358; g.add(glow);
      const pl = new THREE.PointLight('#ffe8c8', 2.2, 3, 2); pl.position.y = 1.1; g.add(pl);
      g.position.set(x, 0, z); g.rotation.y = 0.05; s.add(g);
    });
    // cabinati arcade lungo la parete destra
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(), hue = [300, 190, 40][i];
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.85, 0.8), std(`hsl(${hue},55%,14%)`, 0.5));
      cab.position.y = FLOOR_Y + 0.925; g.add(cab);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: arcadeScreen(hue), color: new THREE.Color(1.6, 1.6, 1.6) }));
      scr.position.set(0, FLOOR_Y + 1.32, 0.41); scr.rotation.x = -0.15; g.add(scr);
      const mq = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${hue},100%,60%)`).multiplyScalar(2) }));
      mq.position.set(0, FLOOR_Y + 1.72, 0.405); g.add(mq);
      const pan = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.25), std('#111', 0.5)); pan.position.set(0, FLOOR_Y + 1.0, 0.48); pan.rotation.x = 0.3; g.add(pan);
      g.position.set(RW - 0.5, 0, -2 + i * 1.0); g.rotation.y = -Math.PI / 2; s.add(g);
    }
    // bancone del bar con bottiglie illuminate
    const bar = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 0.6), new THREE.MeshPhysicalMaterial({ color: '#2a1408', roughness: 0.35, clearcoat: 1 }));
    counter.position.y = FLOOR_Y + 0.525; bar.add(counter);
    const ledBar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(3) }));
    ledBar.position.set(0, FLOOR_Y + 0.1, 0.31); bar.add(ledBar);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.25), std('#3b2416')); shelf.position.set(0, FLOOR_Y + 1.6, -0.9); bar.add(shelf);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a3d').multiplyScalar(0.9) })); back.position.set(0, FLOOR_Y + 1.85, -0.99); bar.add(back);
    const bottleG = new THREE.CylinderGeometry(0.035, 0.04, 0.3, 10);
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(bottleG, new THREE.MeshPhysicalMaterial({ color: `hsl(${(i * 47) % 360},70%,45%)`, roughness: 0.05, transmission: 0.6, thickness: 0.05 }));
      b.position.set(-1.5 + i * 0.175, FLOOR_Y + 1.77, -0.9); bar.add(b);
    }
    bar.position.set(-RW + 2.6, 0, RD - 1.6); bar.rotation.y = Math.PI; s.add(bar);
    // jukebox
    const jb = new THREE.Group();
    const jbody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.55), std('#3a0d22', 0.4, 0.3)); jbody.position.y = FLOOR_Y + 0.7; jb.add(jbody);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.55, 24, 1, false, 0, Math.PI), std('#3a0d22', 0.4, 0.3)); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.y = FLOOR_Y + 1.4; jb.add(arch);
    const bands = ['#ff2bd6', '#ffd23f', '#22d3ee'];
    bands.forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.06, 0.012, 8, 32, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(3) })); t.position.set(0, FLOOR_Y + 1.4, 0.28); jb.add(t); });
    jb.position.set(4.6, 0, -RD + 0.45); s.add(jb);
    // rastrelliera delle stecche sulla parete sinistra
    const rack = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 1.2), std('#3b1608', 0.5)); board.position.y = FLOOR_Y + 1.2; rack.add(board);
    const cueM = std('#d8b77f', 0.4);
    for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 1.45, 8), cueM); c.position.set(0.05, FLOOR_Y + 0.8, -0.5 + i * 0.165); rack.add(c); }
    rack.position.set(-RW + 0.05, 0, -1); s.add(rack);
  }

  // ---------- tavolo per la specialità ----------
  setTable(T, cloth) {
    this.T = T;
    const g = this.tableGroup;
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    g.clear();
    const { L, W, cush, rail } = T;
    const A = L + cush, B = W + cush;
    const CUSH_H = T.R * 1.3, RAIL_TOP = CUSH_H + 0.007;
    this.A = A; this.B = B; this.RAIL_W = rail;
    const felt = noiseTex(); felt.wrapS = felt.wrapT = THREE.RepeatWrapping; felt.repeat.set(10, 5);
    this.clothMat = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.92, bumpMap: felt, bumpScale: 0.6, roughnessMap: felt, envMapIntensity: 0.25 });
    this.cushMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cloth).multiplyScalar(0.92), roughness: 0.85, bumpMap: felt, bumpScale: 0.5, envMapIntensity: 0.3 });
    const holeR = (p) => p.r + 0.006;
    const bed = shapeFrom([[-A - 0.06, -B - 0.06], [A + 0.06, -B - 0.06], [A + 0.06, B + 0.06], [-A - 0.06, B + 0.06]]);
    for (const p of T.pockets) { const h = new THREE.Path(); h.absarc(p.x, -p.z, holeR(p), 0, Math.PI * 2, true); bed.holes.push(h); }
    const bedG = flatExtrude(bed, 0.03); bedG.translate(0, -0.03, 0);
    const bedM = new THREE.Mesh(bedG, this.clothMat); bedM.receiveShadow = true; g.add(bedM);
    const holeMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 1, side: THREE.DoubleSide });
    const basket = new THREE.MeshStandardMaterial({ color: T.kind === 'snooker' ? '#3a2213' : '#1b1310', roughness: 0.7, side: THREE.DoubleSide });
    for (const p of T.pockets) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(holeR(p), p.r * 0.8, 0.14, 28, 1, true), holeMat);
      c.position.set(p.x, -0.07, p.z); g.add(c);
      const bot = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.8, 24), holeMat); bot.rotation.x = -Math.PI / 2; bot.position.set(p.x, -0.139, p.z); g.add(bot);
      // tasca in cuoio che pende sotto la buca (si vede guardando il tavolo da basso)
      const cup = new THREE.Mesh(new THREE.SphereGeometry(holeR(p) * 1.15, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), basket);
      cup.position.set(p.x, -0.16, p.z); cup.scale.y = 0.8; cup.castShadow = true; g.add(cup);
    }
    // sponde: il naso (dove batte la bilia) è basso, il retro sale fino al legno, come la gomma vera
    for (const poly of cushionPieces(T)) {
      const geo = flatExtrude(shapeFrom(poly), CUSH_H - 0.004, 0.004);
      const [a, b] = poly, ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < CUSH_H * 0.5) continue;
        const d = Math.abs((pos.getX(i) - a[0]) * ez - (pos.getZ(i) - a[1]) * ex) / el; // distanza dal naso
        pos.setY(i, y + Math.min(1, d / cush) * (RAIL_TOP - CUSH_H - 0.002));
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.cushMat);
      m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    // anelli per chiamare la buca della nera (palla 8)
    this.callRings = T.pockets.map((p) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(p.r + 0.012, p.r + 0.026, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf4a').multiplyScalar(1.6), transparent: true, opacity: 0.9, depthWrite: false }));
      r.rotation.x = -Math.PI / 2; r.position.set(p.x, RAIL_TOP + 0.003, p.z); r.visible = false; r.renderOrder = 6;
      g.add(r); return r;
    });
    const wood = woodTexture(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(2.5, 2.5);
    const woodMat = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 });
    const outer = shapeFrom([[-A - rail, -B - rail], [A + rail, -B - rail], [A + rail, B + rail], [-A - rail, B + rail]]);
    const rad = T.pockets.length ? Math.max(...T.pockets.map(holeR)) : 0;
    outer.holes.push(pathFrom(innerOutline(T, A, B, rad)));
    const railG = flatExtrude(outer, 0.18, 0.008); railG.translate(0, RAIL_TOP - 0.188, 0);
    const p = railG.attributes.position, uv = railG.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + p.getY(i) * 0.7) * 0.6, (p.getZ(i) + p.getY(i) * 0.7) * 0.6);
    const railM = new THREE.Mesh(railG, woodMat); railM.castShadow = true; railM.receiveShadow = true; g.add(railM);
    const leather = new THREE.MeshPhysicalMaterial({ color: T.kind === 'snooker' ? '#2b1a10' : '#141414', roughness: 0.4, clearcoat: 0.6, metalness: 0.2 });
    for (const a of pocketArcs(T, A, B, rad)) {
      const curve = new THREE.CatmullRomCurve3(a.arc.map(([x, z]) => new THREE.Vector3(x, RAIL_TOP - 0.004, z)));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.011, 10, false), leather); tube.castShadow = true; g.add(tube);
    }
    // diamanti (mire)
    const pearl = new THREE.MeshPhysicalMaterial({ color: '#f3efe6', roughness: 0.25, clearcoat: 1 });
    const dg = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 4); dg.rotateY(Math.PI / 4);
    const dy = RAIL_TOP + 0.0005, off = cush + rail * 0.45;
    for (let i = 1; i < 8; i++) {
      if (i === 4 && T.pockets.length) continue;
      const x = -L + (2 * L * i) / 8;
      for (const sz of [-1, 1]) { const d = new THREE.Mesh(dg, pearl); d.position.set(x, dy, sz * (W + off)); d.scale.z = 0.6; g.add(d); }
    }
    for (let i = 1; i < 4; i++) {
      const z = -W + (2 * W * i) / 4;
      for (const sx of [-1, 1]) { const d = new THREE.Mesh(dg, pearl); d.position.set(sx * (L + off), dy, z); d.scale.x = 0.6; g.add(d); }
    }
    // corpo e gambe
    const bodyM = new THREE.MeshPhysicalMaterial({ map: wood, color: '#b58a6a', roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    const aw = 2 * (A + rail) - 0.06, ad = 2 * (B + rail) - 0.06;
    const apron = new THREE.Mesh(new THREE.BoxGeometry(aw, 0.2, ad), bodyM);
    apron.position.y = -0.26; apron.castShadow = true; apron.receiveShadow = true; g.add(apron);
    // filetto in ottone lungo la fascia e cornice in fondo
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 1, roughness: 0.28 });
    for (const y of [-0.19, -0.33]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(aw + 0.004, 0.006, ad + 0.004), brass);
      strip.position.y = y; g.add(strip);
    }
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(aw + 0.03, 0.04, ad + 0.03), bodyM);
    plinth.position.y = -0.37; g.add(plinth);
    // gambe tornite con il piedino in ottone
    const legProf = [[0, 0], [0.06, 0], [0.065, 0.02], [0.05, 0.05], [0.045, 0.12], [0.06, 0.2], [0.05, 0.28], [0.04, 0.33], [0.045, 0.36], [0.07, 0.38], [0.075, 0.4], [0, 0.4]];
    const legG = new THREE.LatheGeometry(legProf.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    const footG = new THREE.CylinderGeometry(0.068, 0.072, 0.02, 20);
    const nx = T.kind === 'snooker' ? [-1, -1 / 3, 1 / 3, 1] : [-1, 0, 1];
    for (const x of nx) for (const z of [-1, 1]) {
      const leg = new THREE.Mesh(legG, bodyM); leg.position.set(x * (A - 0.05), FLOOR_Y + 0.02, z * (B - 0.02)); leg.castShadow = true; g.add(leg);
      const foot = new THREE.Mesh(footG, brass); foot.position.set(x * (A - 0.05), FLOOR_Y + 0.01, z * (B - 0.02)); g.add(foot);
    }
    // targhetta del costruttore sulla fascia
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.05), new THREE.MeshStandardMaterial({ map: canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#c9a45c'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a2410'; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BINOTTOLAND', w / 2, h / 2 + 2); }), metalness: 0.8, roughness: 0.3 }));
    plate.position.set(0, -0.26, ad / 2 + 0.002); g.add(plate);
    // gessetto blu sul legno e (palla 8) il triangolo appoggiato
    const chalk = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), [
      ...Array(2).fill(new THREE.MeshStandardMaterial({ color: '#1f5fc8', roughness: 0.9 })),
      new THREE.MeshStandardMaterial({ color: '#5b8ee0', roughness: 1 }),
      ...Array(3).fill(new THREE.MeshStandardMaterial({ color: '#1f5fc8', roughness: 0.9 })),
    ]);
    chalk.position.set(-L * 0.6, RAIL_TOP + 0.011, W + cush + rail * 0.5); chalk.rotation.y = 0.4; chalk.castShadow = true; g.add(chalk);
    if (T.kind === 'pool') {
      const tri = new THREE.Shape(); const s = 0.17;
      tri.moveTo(0, s); tri.lineTo(-s * 0.866, -s / 2); tri.lineTo(s * 0.866, -s / 2); tri.closePath();
      const hole = new THREE.Path(); const s2 = s - 0.02; hole.moveTo(0, s2); hole.lineTo(-s2 * 0.866, -s2 / 2); hole.lineTo(s2 * 0.866, -s2 / 2); hole.closePath(); tri.holes.push(hole);
      const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }); tg.rotateX(-Math.PI / 2);
      const triM = new THREE.Mesh(tg, new THREE.MeshPhysicalMaterial({ color: '#3b1608', roughness: 0.35, clearcoat: 0.8 }));
      triM.position.set(A + rail * 0.5, RAIL_TOP, -W * 0.55); triM.rotation.y = 0.3; triM.scale.setScalar(0.45); triM.castShadow = true; g.add(triM);
    }
    // segni sul panno
    const mark = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false });
    const dot = (x, z, r = 0.004) => { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mark); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.0006, z); g.add(d); };
    this.kitchen = new THREE.Mesh(new THREE.PlaneGeometry(0.0025, 2 * W), mark.clone());
    this.kitchen.rotation.x = -Math.PI / 2; this.kitchen.position.set(-L / 2, 0.0006, 0); this.kitchen.material.opacity = 0.18;
    this.kitchen.visible = false;
    g.add(this.kitchen);
    if (T.kind === 'snooker') {
      const bx = -L + 0.737;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.003, 2 * W), mark); line.rotation.x = -Math.PI / 2; line.position.set(bx, 0.0006, 0); g.add(line);
      const arc = new THREE.Mesh(new THREE.RingGeometry(0.2905, 0.2935, 64, 1, Math.PI / 2, Math.PI), mark); arc.rotation.x = -Math.PI / 2; arc.position.set(bx, 0.0006, 0); g.add(arc);
      for (const [x, z] of [[bx, 0.292], [bx, -0.292], [bx, 0], [0, 0], [L / 2, 0], [L - 0.324, 0]]) dot(x, z, 0.003);
    } else if (T.kind === 'pool') { dot(-L / 2, 0); dot(L / 2, 0); }
    else {
      // carambola (FIBiS): linea di mezzeria, sedi dei birilli (croce da 66 mm), penitenze e punti di partenza
      const mid = new THREE.Mesh(new THREE.PlaneGeometry(0.0022, 2 * W), mark); mid.rotation.x = -Math.PI / 2; mid.position.set(0, 0.0006, 0); g.add(mid);
      for (const [x, z] of [[0, 0], [-0.066, 0], [0.066, 0], [0, -0.066], [0, 0.066]]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0045, 16), mark); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.0007, z); g.add(ring);
      }
      for (const x of [L - 0.1, L / 2, -L / 2, -L + 0.1]) dot(x, 0, 0.0035);
    }
    // la lampada copre il tavolo: lunga quanto serve
    this.lamp.scale.x = T.kind === 'snooker' ? 1.35 : 1.1;
  }

  setCloth(color) {
    if (!this.clothMat) return;
    this.clothMat.color.set(color);
    this.cushMat.color.set(color).multiplyScalar(0.92);
  }

  // bilie: una mesh per bilia, con il suo aspetto
  setBalls(list) {
    const g = this.ballGroup;
    g.traverse((o) => { if (o.material?.map) o.material.map.dispose(); if (o.geometry) o.geometry.dispose(); });
    g.clear();
    this.ballMeshes = {}; this.blobs = {};
    const sh = this._shadowTex || (this._shadowTex = canvasTex(64, 64, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }));
    const shm = new THREE.MeshBasicMaterial({ map: sh, transparent: true, depthWrite: false });
    for (const { id, r, look } of list) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshPhysicalMaterial({ map: ballTexture(look), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.15 }));
      m.castShadow = true; m.receiveShadow = true;
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      m.userData.r = r;
      g.add(m);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, r * 2.6), shm); b.rotation.x = -Math.PI / 2; g.add(b);
      this.ballMeshes[id] = m; this.blobs[id] = b;
    }
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3();
  }

  // posiziona le bilie (e le fa ruotare): show = id da mostrare anche se non è sul tavolo (bilia in mano)
  syncBalls(balls, dt, falling, show = -1) {
    for (const b of balls) {
      const m = this.ballMeshes[b.id], blob = this.blobs[b.id];
      if (!m) continue;
      const f = falling.get(b.id);
      if (f) { m.visible = true; blob.visible = false; m.position.set(f.x, f.y, f.z); continue; }
      const vis = b.on || b.id === show;
      m.visible = vis; blob.visible = vis;
      if (!vis) continue;
      m.position.set(b.x, b.r, b.z);
      blob.position.set(b.x, 0.0008, b.z);
      const w = this._v.set(b.uz, b.side, -b.ux);
      const sp = w.length();
      if (sp > 1e-5 && dt > 0) { this._q.setFromAxisAngle(w.multiplyScalar(1 / sp), (sp * dt) / b.r); m.quaternion.premultiply(this._q); }
    }
  }

  // birilli: bianchi con la testa rossa, quello al centro tutto rosso
  setPins(pins) {
    if (this.pinGroup) { this.scene.remove(this.pinGroup); this.pinGroup.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.pinGroup = null; this.pinMeshes = [];
    if (!pins) return;
    this.pinGroup = new THREE.Group(); this.scene.add(this.pinGroup);
    const prof = [[0, 0], [0.004, 0], [0.0052, 0.004], [0.0055, 0.009], [0.0042, 0.015], [0.0024, 0.019], [0.0026, 0.021], [0.0038, 0.0245], [0.0034, 0.0275], [0, 0.029]];
    // misure FIBiS: alto 25 mm, pancia 10 mm, base 7 mm, testa 6 mm
    const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * (PIN_R / 0.0055), y * (0.025 / 0.029))), 20);
    const tex = (red) => canvasTex(8, 128, (c) => { c.fillStyle = red ? '#d01820' : '#f4f1e6'; c.fillRect(0, 0, 8, 128); c.fillStyle = '#d01820'; c.fillRect(0, 0, 8, 30); if (!red) { c.fillRect(0, 50, 8, 6); } });
    const white = new THREE.MeshPhysicalMaterial({ map: tex(false), roughness: 0.3, clearcoat: 1 }), red = new THREE.MeshPhysicalMaterial({ map: tex(true), roughness: 0.3, clearcoat: 1 });
    const uvFix = geo.attributes.uv; for (let i = 0; i < uvFix.count; i++) uvFix.setX(i, 0.5);
    for (const p of pins) {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(geo, p.red ? red : white); m.castShadow = true;
      m.scale.set(1.15, 1.2, 1.15); // un filo più grandi del vero, così si vedono anche da lontano
      pivot.add(m); pivot.position.set(p.x, 0, p.z);
      this.pinGroup.add(pivot);
      this.pinMeshes.push({ pivot, t: 0 });
    }
  }
  syncPins(pins, dt) {
    if (!pins || !this.pinMeshes.length) return;
    pins.forEach((p, i) => {
      const pm = this.pinMeshes[i];
      if (p.up) { pm.t = 0; pm.pivot.rotation.set(0, 0, 0); pm.pivot.position.set(p.x, 0, p.z); return; }
      pm.t = Math.min(1, pm.t + dt * 4);
      const k = pm.t * pm.t;
      // cade nella direzione della bilia che l'ha colpito
      const ang = (Math.PI / 2) * k;
      pm.pivot.position.set(p.x + p.fx * 0.012 * k, 0.0035 * k, p.z + p.fz * 0.012 * k);
      pm.pivot.rotation.set(p.fz * ang, 0, -p.fx * ang);
    });
  }

  buildCue() {
    const prof = [[0, 0], [0.0062, 0], [0.0062, 0.009], [0.0064, 0.01], [0.0064, 0.034], [0.0066, 0.035],
      [0.0085, 0.6], [0.0112, 0.85], [0.0125, 0.9], [0.0135, 1.3], [0.0152, 1.44], [0.012, 1.46], [0, 1.46]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    g.rotateZ(-Math.PI / 2);
    const tex = canvasTex(1024, 8, (c, w) => {
      const zone = (a, b, col) => { c.fillStyle = col; c.fillRect((a / 1.46) * w, 0, ((b - a) / 1.46) * w + 1, 8); };
      zone(0, 0.009, '#2f6fd6'); zone(0.009, 0.034, '#f1ede2'); zone(0.034, 0.85, '#e5c99b'); zone(0.85, 0.87, '#111');
      zone(0.87, 1.05, '#3b1608'); for (let i = 0; i < 4; i++) zone(0.9 + i * 0.035, 0.91 + i * 0.035, '#d9b25c');
      zone(1.05, 1.07, '#d9b25c'); zone(1.07, 1.4, '#1a1a1a'); zone(1.4, 1.46, '#3b1608');
    });
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.46, 0.5);
    this.cueStick = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
    this.cueStick.castShadow = true;
    this.cuePivot = new THREE.Group(); this.cueTilt = new THREE.Group();
    this.cueTilt.rotation.z = 0.07;
    this.cueTilt.add(this.cueStick); this.cuePivot.add(this.cueTilt);
    this.scene.add(this.cuePivot);
  }

  placeCue(x, z, r, angle, pull, spinX, spinY, visible) {
    this.cuePivot.visible = visible;
    if (!visible) return;
    this.cuePivot.position.set(x, r, z);
    this.cuePivot.rotation.y = Math.PI - angle;
    this.cueStick.position.set(r + 0.012 + pull, spinY * r * 0.5, -spinX * r * 0.5);
  }

  buildAim() {
    const mk = (op, c = '#ffffff') => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false });
    const plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2); plane.translate(0.5, 0, 0);
    this.aimLine = new THREE.Mesh(plane, mk(0.75));
    this.objLine = new THREE.Mesh(plane, mk(0.65));
    this.cueLine = new THREE.Mesh(plane, mk(0.35));
    const ring = new THREE.RingGeometry(0.78, 1, 40); ring.rotateX(-Math.PI / 2);
    this.ghost = new THREE.Mesh(ring, mk(0.85));
    this.ghostBall = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mk(0.16));
    const hr = new THREE.RingGeometry(1.25, 1.45, 40); hr.rotateX(-Math.PI / 2);
    this.handRing = new THREE.Mesh(hr, mk(0.85, '#fcd34d'));
    this.badRing = new THREE.Mesh(ring.clone(), mk(0.9, '#ef4444'));
    // freccia per le boccette (niente stecca)
    const arrow = new THREE.Shape([new THREE.Vector2(0, -0.012), new THREE.Vector2(0.1, -0.012), new THREE.Vector2(0.1, -0.026), new THREE.Vector2(0.15, 0), new THREE.Vector2(0.1, 0.026), new THREE.Vector2(0.1, 0.012), new THREE.Vector2(0, 0.012)]);
    const ag = new THREE.ShapeGeometry(arrow); ag.rotateX(-Math.PI / 2);
    this.arrow = new THREE.Mesh(ag, mk(0.8, '#fcd34d'));
    for (const m of [this.aimLine, this.objLine, this.cueLine, this.ghost, this.ghostBall, this.handRing, this.badRing, this.arrow]) { m.renderOrder = 5; m.visible = false; this.scene.add(m); }
  }

  line(m, x, z, ang, len, w) {
    m.visible = len > 0.002;
    m.position.set(x, 0.004, z);
    m.rotation.y = -ang;
    m.scale.set(len, 1, w);
  }

  showAim(a) {
    for (const m of [this.aimLine, this.objLine, this.cueLine, this.ghost, this.ghostBall, this.badRing, this.arrow]) m.visible = false;
    if (!a) return;
    const r = a.r;
    this.line(this.aimLine, a.x, a.z, a.angle, a.len, 0.006);
    this.ghost.visible = true; this.ghost.position.set(a.gx, 0.001, a.gz); this.ghost.scale.setScalar(r);
    this.ghostBall.visible = true; this.ghostBall.position.set(a.gx, r, a.gz); this.ghostBall.scale.setScalar(r);
    if (a.obj) {
      this.line(this.objLine, a.obj.x, a.obj.z, a.obj.ang, a.obj.len, 0.006);
      this.line(this.cueLine, a.gx, a.gz, a.cueAng, a.cueLen, 0.004);
      if (a.bad) { this.badRing.visible = true; this.badRing.position.set(a.obj.x, 0.0012, a.obj.z); this.badRing.scale.setScalar(a.obj.r); }
    }
    if (a.arrow) {
      this.arrow.visible = true;
      this.arrow.position.set(a.x - Math.cos(a.angle) * (r + 0.17), 0.003, a.z - Math.sin(a.angle) * (r + 0.17));
      this.arrow.rotation.y = -a.angle;
      this.arrow.scale.setScalar(0.8 + a.power * 0.8);
    }
  }

  // palla 8: cerchio dorato sulla buca chiamata; se non è ancora chiamata, tutte le buche lampeggiano piano
  showCall(chosen, all) {
    if (!this.callRings) return;
    const pockets = this.T.pockets, blink = 0.35 + 0.3 * Math.sin(this.clock * 4);
    this.callRings.forEach((r, k) => {
      const on = chosen === pockets[k];
      r.visible = on || !!all;
      r.material.opacity = on ? 0.95 : blink;
    });
  }

  showHand(on, x, z, r) {
    this.handRing.visible = on;
    if (on) { this.handRing.position.set(x, 0.001, z); const s = r * (1 + Math.sin(this.clock * 5) * 0.08); this.handRing.scale.set(s, 1, s); }
  }

  // ---------- telecamera ----------
  resize() {
    const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    if (!w || !h) return; // pagina nascosta: niente misure, si rifà al prossimo resize
    this.renderer.setSize(w, h, false);
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const portrait = h > w * 1.05;
    if (portrait !== this.portrait) { this.portrait = portrait; if (this.T) this.preset(this.view, true); }
  }

  // inquadrature pronte: panoramica, dall'alto, dietro la stecca
  preset(v, snap) {
    this.view = v;
    this.userYaw = 0;
    const T = this.T || { L: 1.27, W: 0.635, cush: 0.05, rail: 0.13 };
    const cam = this.camera, fov = THREE.MathUtils.degToRad(cam.fov) / 2;
    const ex = T.L + T.cush + T.rail + 0.04, ez = T.W + T.cush + T.rail + 0.04;
    const port = this.portrait;
    const sx = port ? ez : ex, sy = port ? ex : ez;
    const fit = (hx, hy) => Math.max(hy / Math.tan(fov), hx / (Math.tan(fov) * cam.aspect));
    const yaw = port ? -Math.PI / 2 : 0;
    if (v === 'top') Object.assign(this.goal, { yaw, pitch: 1.553, dist: fit(sx, sy * 1.12) + 0.05, tx: 0, tz: 0 });
    else if (v === 'cue') Object.assign(this.goal, { pitch: 0.33, dist: 0.85 });
    else { const tilt = 0.62; Object.assign(this.goal, { yaw, pitch: Math.PI / 2 - tilt, dist: fit(sx, sy * Math.cos(tilt) + 0.12) * 1.08 + 0.2, tx: port ? 0.06 : 0, tz: port ? 0 : 0.06 }); }
    if (snap) Object.assign(this.cam, this.goal);
  }

  // comandi a mano
  orbit(dyaw, dpitch) {
    if (this.view === 'cue') this.userYaw += dyaw; else this.goal.yaw += dyaw;
    this.goal.pitch = Math.max(0.08, Math.min(1.553, this.goal.pitch + dpitch));
  }
  zoom(f) { this.goal.dist = Math.max(0.25, Math.min(9, this.goal.dist * f)); }
  pan(dx, dy) {
    // sposta il punto guardato sul piano del tavolo, nel verso dello schermo
    const k = this.goal.dist * 0.0016, y = this.cam.yaw;
    const rx = Math.cos(y), rz = -Math.sin(y), fx = -Math.sin(y), fz = -Math.cos(y);
    const lim = 3.5;
    this.goal.tx = Math.max(-lim, Math.min(lim, this.goal.tx - (rx * dx - fx * dy) * k));
    this.goal.tz = Math.max(-lim, Math.min(lim, this.goal.tz - (rz * dx - fz * dy) * k));
  }

  // la vista "stecca" segue la mira
  follow(x, z, angle) {
    if (this.view !== 'cue') return;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    this.goal.yaw = Math.atan2(-dx, -dz) + this.userYaw;
    this.goal.tx = x + dx * 0.35; this.goal.tz = z + dz * 0.35;
  }

  render(dt) {
    this.clock += dt;
    const k = 1 - Math.exp(-dt * 7);
    const c = this.cam, g = this.goal;
    let dy = g.yaw - c.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    c.yaw += dy * k; c.pitch += (g.pitch - c.pitch) * k; c.dist += (g.dist - c.dist) * k;
    c.tx += (g.tx - c.tx) * k; c.tz += (g.tz - c.tz) * k;
    const cp = Math.cos(c.pitch);
    this.camera.position.set(c.tx + c.dist * cp * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.tz + c.dist * cp * Math.cos(c.yaw));
    this.camera.lookAt(c.tx, 0, c.tz);
    // la lampada sparisce quando la telecamera ci passa sopra
    this.lamp.visible = c.pitch < 0.8;
    for (const cone of this.cones) cone.visible = this.lamp.visible;
    // pulviscolo e insegne che respirano
    if (this.dust.visible) { const a = this.dust.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * 0.02; if (y > 1.3) y = 0.1; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(this.clock * 0.5 + i) * dt * 0.004); } a.needsUpdate = true; }
    const f = 1.9 + Math.sin(this.clock * 2.1) * 0.15 + (Math.random() < 0.01 ? -0.8 : 0);
    this.signs[0].material.color.setScalar(f);
    if (this.composer && this.quality !== 'bassa') this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  }

  pick(clientX, clientY, y = 0.03) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = this._rc || (this._rc = new THREE.Raycaster());
    rc.setFromCamera(v, this.camera);
    const t = (y - rc.ray.origin.y) / rc.ray.direction.y;
    if (!(t > 0)) return null;
    return { x: rc.ray.origin.x + rc.ray.direction.x * t, z: rc.ray.origin.z + rc.ray.direction.z * t };
  }
}
