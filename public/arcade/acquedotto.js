// Acquedotto! (puzzle, 1 giocatore): gira le tessere e porta l'acqua dal rubinetto al vaso.
// Gira nell'iframe arcade di Binottoland: Telegram (vibrazione, Indietro, margini) resta all'app,
// che riceve 'arcade:haptic' / 'arcade:exit' e manda 'arcade:insets' (vedi bridge.js e arcade-link.js).
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

// ---------- Vibrazione (tramite l'app) ----------
const embedded = window.parent !== window;
const haptic = (k = 'light') => {
  const kind = ['success', 'warning', 'error'].includes(k) ? 'notification' : 'impact';
  if (embedded) parent.postMessage({ type: 'arcade:haptic', kind, style: k }, location.origin);
  else if (navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(kind === 'notification' ? 40 : 12); } catch {}
};
const params = new URLSearchParams(location.search);
const ICON = params.has('icon');                       // ?icon: inquadratura per l'icona del gioco
const SAVE = 'binottoland-acquedotto';
const saved = (() => { try { return JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch { return {}; } })();
const store = patch => { try { localStorage.setItem(SAVE, JSON.stringify(Object.assign(saved, patch))); } catch {} };

// ---------- Suoni (tutti sintetizzati, nessun file) ----------
const Sound = (() => {
  let ctx = null, master, noiseBuf, flowGain, flowFilter, gurgleGain, gurgleFilter, pourGain, fillGain, fillFilter;
  let grainAcc = 0, glugAcc = 0, pourAcc = 0, fillAcc = 0, gurgleT = 0;
  let muted = !!saved.muted;
  const loop = (filterType, freq, Q) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.loopStart = Math.random();
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = Q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master); src.start(); return [g, f];
  };
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    [flowGain, flowFilter] = loop('lowpass', 320, 0.7);      // fondo cupo dell'acqua che scorre
    [gurgleGain, gurgleFilter] = loop('bandpass', 300, 7);   // gorgoglio: risonanza che salta
    [pourGain] = loop('lowpass', 700, 0.5);                   // getto del rubinetto (morbido)
    [fillGain, fillFilter] = loop('bandpass', 400, 10);       // vaso che si riempie: il tono sale
  }
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  function tone(type, f0, f1, dur, vol, when = 0) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, type, freq, Q, vol, when = 0, freqEnd) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loopStart = Math.random();
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = Q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, vol, dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const bubble = (vol = 0.08) => { const f = 300 + Math.random() * 500; tone('sine', f, f * (2 + Math.random()), 0.05 + Math.random() * 0.04, vol); };
  // bollicina d'acqua: sinusoide breve che sale un poco di tono e si spegne in fretta
  const grain = (fLo, fHi, rise, dur, vol, when) => {
    const f = fLo * Math.pow(fHi / fLo, Math.random());
    tone('sine', f, f * (1 + rise * Math.random()), dur * (0.6 + Math.random() * 0.8), vol * (0.4 + Math.random() * 0.6), when);
  };
  return {
    init,
    get muted() { return muted; },
    toggle() { muted = !muted; store({ muted });
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05); return muted; },
    suspend(on) { if (ctx) on ? ctx.suspend() : ctx.resume(); },
    turn() { noise(0.16, 'bandpass', 1800, 2, 0.12, 0, 700); tone('sine', 220, 160, 0.06, 0.08); },
    clack() { noise(0.05, 'bandpass', 2600, 3, 0.25); tone('triangle', 140, 90, 0.08, 0.18); },
    locked() { tone('square', 110, 70, 0.12, 0.08); noise(0.08, 'lowpass', 600, 1, 0.2); tone('square', 104, 66, 0.12, 0.06, 0.1); },
    valve(open) { tone('sawtooth', open ? 650 : 1000, open ? 1000 : 600, 0.22, 0.035); noise(0.06, 'highpass', 4000, 1, 0.12, 0.2); tone('sine', 2400, 2300, 0.15, 0.04, 0.2); },
    star() { [1047, 1319, 1568, 2093].forEach((f, i) => { tone('sine', f, f, 0.5, 0.09, i * 0.07); tone('triangle', f * 2, f * 2, 0.2, 0.02, i * 0.07); }); },
    splash() { noise(0.5, 'lowpass', 2500, 0.7, 0.35, 0, 400); for (let i = 0; i < 8; i++) setTimeout(() => bubble(0.06), i * 40 + Math.random() * 60); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.7 : 0.18, 0.14, i * 0.13));
      [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, 0.6, 0.05, 0.55 + i * 0.08));
    },
    tick(dt, s) {
      if (!ctx || ctx.state !== 'running') return; const t = ctx.currentTime;
      const flow = s.wet ? Math.min(1, 0.4 + s.wet * 0.03) : 0;
      // fondo: scorrere morbido che "respira" lentamente
      flowFilter.frequency.setTargetAtTime(280 + 60 * Math.sin(t * 0.4), t, 0.5);
      flowGain.gain.setTargetAtTime(flow * (0.08 + 0.025 * Math.sin(t * 0.5) * Math.sin(t * 0.23)), t, 0.6);
      // gorgoglio: risonanza che si sposta piano, senza scatti
      gurgleT -= dt;
      if (gurgleT <= 0) {
        gurgleT = 0.25 + Math.random() * 0.4;
        gurgleFilter.frequency.setTargetAtTime(200 + Math.random() * 220, t, 0.18);
        gurgleGain.gain.setTargetAtTime(flow * (0.02 + Math.random() * 0.04), t, 0.25);
      }
      // poche bollicine, basse e morbide
      grainAcc += dt * (flow * 2.5 + s.fronts * 1.5);
      while (grainAcc >= 1) { grainAcc -= 1; grain(380, 900, 0.25, 0.08, 0.016, Math.random() * 0.1); }
      glugAcc += dt * (flow * 0.2 + s.fronts * 0.2);
      while (glugAcc >= 1) { glugAcc -= 1; grain(150, 260, 0.8, 0.18, 0.035, Math.random() * 0.1); }
      // getto: fruscio morbido + pochi schizzi leggeri
      pourGain.gain.setTargetAtTime(s.pour ? 0.03 : 0, t, 0.15);
      pourAcc += dt * (s.pour ? 3 : 0);
      while (pourAcc >= 1) { pourAcc -= 1; grain(700, 1600, 0.2, 0.04, 0.012, Math.random() * 0.06); }
      // vaso: risonanza e bolle che salgono di tono col livello
      const fr = 300 + s.basin * 900;
      fillGain.gain.setTargetAtTime(s.out ? 0.06 : 0, t, 0.2);
      fillFilter.frequency.setTargetAtTime(fr, t, 0.2);
      fillAcc += dt * (s.out ? 3 : 0);
      while (fillAcc >= 1) { fillAcc -= 1; grain(fr * 0.8, fr * 1.3, 0.4, 0.09, 0.03, Math.random() * 0.08); }
      if (s.leaking && Math.random() < dt * 6) { const f = 900 + Math.random() * 900; tone('sine', f, f * 0.5, 0.06, 0.05); }
    },
  };
})();
addEventListener('pointerdown', () => Sound.init(), { capture: true });
document.addEventListener('visibilitychange', () => Sound.suspend(document.hidden));

// ---------- Texture procedurali ----------
function canvasTex(size, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const stoneTex = canvasTex(256, (g, s) => {
  g.fillStyle = '#e8e2da'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) {
    const v = 150 + Math.random() * 105 | 0; g.fillStyle = `rgba(${v},${v - 8},${v - 16},${0.15 + Math.random() * 0.25})`;
    const r = 0.5 + Math.random() * 2.2; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(90,70,55,.18)'; g.lineWidth = 1;
  for (let i = 0; i < 6; i++) { g.beginPath(); let x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - .5) * 40; y += (Math.random() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
}, 2);
const woodDraw = (base, dark) => (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    const y0 = Math.random() * s, a = Math.random() * 6, f = 0.01 + Math.random() * 0.02;
    g.strokeStyle = `rgba(${dark},${0.08 + Math.random() * 0.22})`; g.lineWidth = 0.5 + Math.random() * 2.5;
    g.beginPath(); for (let x = 0; x <= s; x += 8) g.lineTo(x, y0 + Math.sin(x * f + a) * 6); g.stroke();
  }
};
const tableTex = canvasTex(512, woodDraw('#9a6f4a', '70,40,20'), 8);
const frameTex = canvasTex(256, woodDraw('#5a3b28', '30,15,8'), 2);

// ---------- Scena ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6e5038);
scene.fog = new THREE.Fog(0x6e5038, 14, 32);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x6b4a30, 0.9));
const sun = new THREE.DirectionalLight(0xffe6c4, 2.8);
sun.position.set(-4, 10, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun);
const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.7 }));
table.rotation.x = -Math.PI / 2; table.position.y = -0.5; table.receiveShadow = true; scene.add(table);

// ---------- Costanti ----------
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];            // N E S O  (dx, dz) = (dc, dr)
const TS = 0.96, SUB = TS / 3, FLOOR_H = 0.12, WALL_H = 0.2;
const WW = 0.24, WH = 0.085;                                 // larghezza/altezza acqua nel canale
const Y_LOW = FLOOR_H + WH / 2, Y_TOP = FLOOR_H + WALL_H + 0.16;
const SPOUT_Y = 1.5, FILL = 2.2, DRAIN = 1.6;
const rotMask = (m, k) => ((m << k) | (m >> (4 - k))) & 15;
const rand = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bits = dirs => dirs.reduce((m, d) => m | (1 << d), 0);

// Tipi di tessera: celle aperte nella griglia 3x3 (i = x, j = z, j=0 nord) e canali indipendenti
const TYPES = {
  dritta:  { open: [[1, 0], [1, 1], [1, 2]], ch: [{ dirs: [0, 2] }] },
  curva:   { open: [[1, 0], [1, 1], [2, 1]], ch: [{ dirs: [0, 1] }] },
  ti:      { open: [[1, 0], [1, 1], [2, 1], [1, 2]], ch: [{ dirs: [0, 1, 2] }] },
  croce:   { open: [[1, 0], [1, 1], [2, 1], [1, 2], [0, 1]], ch: [{ dirs: [0, 1, 2, 3] }] },
  ponte:   { open: [[1, 0], [1, 1], [2, 1], [1, 2], [0, 1]], ch: [{ dirs: [0, 2] }, { dirs: [1, 3], bridge: true }] },
  doppia:  { open: [[1, 0], [2, 0], [2, 1], [1, 2], [0, 2], [0, 1]], ch: [{ dirs: [0, 1], hub: [SUB, -SUB] }, { dirs: [2, 3], hub: [-SUB, SUB] }] },
};
for (const T of Object.values(TYPES)) { T.ch.forEach(c => c.mask = bits(c.dirs)); T.mask = T.ch.reduce((m, c) => m | c.mask, 0); }

// ---------- Materiali ----------
const uTime = { value: 0 };
function waterMat(wave = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime, uLen: { value: 1 }, uStart: { value: 0 }, uFlow: { value: 1 }, uWave: { value: wave },
      uA: { value: 0 }, uB: { value: 1 }, uHead: { value: -9 } },
    vertexShader: `attribute float aAlong, aAcross; uniform float uTime,uLen,uStart,uWave,uFlow,uHead;
      varying float vAl, vAc; varying vec3 vN,vW;
      void main(){ vec3 p=position; vAl=aAlong; vAc=aAcross; float s=aAlong*uLen+uStart, f=uFlow;
        if(uWave>0.5 && uWave<1.5 && normal.y>0.5){
          float crown=(1.0-aAcross*aAcross)*0.014;                       // superficie bombata
          float waves=sin(s*17.0-uTime*5.5*f)*0.005+sin(s*7.0+aAcross*2.5-uTime*3.2*f)*0.006;
          float swell=uHead>-1.0 ? exp(-abs(aAlong-uHead)*uLen*22.0)*0.022 : 0.0;   // gonfiore sul fronte
          p.y+=crown+waves*(0.6+0.4*(1.0-aAcross*aAcross))+swell;
        }
        if(uWave>1.5){                                                      // getto che cade: pulsa e ondeggia
          float k=1.0+0.18*sin(s*22.0-uTime*26.0)+0.08*sin(s*9.0-uTime*13.0);
          p.x=p.x*k+sin(s*6.0-uTime*9.0)*0.012; p.y=p.y*k+cos(s*5.0-uTime*7.0)*0.01;
        }
        vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(p,1.0); vW=w.xyz;
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime,uFlow,uLen,uStart,uA,uB,uHead,uWave; varying float vAl, vAc; varying vec3 vN,vW;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      void main(){
        if(vAl<uA||vAl>uB) discard;
        float lag=vAc*vAc*0.08/max(uLen,0.05);                              // fronte a lingua arrotondata
        if(uHead>-1.0){ if(uFlow>0.0 && vAl>uHead-lag) discard; if(uFlow<0.0 && vAl<uHead+lag) discard; }
        vec3 N=normalize(vN), V=normalize(cameraPosition-vW); float s=vAl*uLen+uStart;
        float sp=uWave>1.5 ? 3.0 : 1.1;
        vec2 q=vec2(s*7.0-uTime*sp*uFlow*7.0, vAc*1.6+uTime*0.25);
        float n1=vnoise(q), n2=vnoise(q*2.3+vec2(uTime*0.7,3.1));
        float h=n1*0.65+n2*0.35;
        float glint=pow(1.0-abs(h*2.0-1.0),9.0);                             // filamenti di luce che scorrono
        float fres=pow(1.0-max(dot(N,V),0.0),3.0);
        float depth=1.0-vAc*vAc;
        vec3 deep=vec3(0.02,0.22,0.48), shallow=vec3(0.22,0.62,0.86), sky=vec3(0.78,0.9,1.0);
        vec3 col=mix(shallow,deep,depth*0.75+h*0.15);
        col=mix(col,sky,clamp(fres*0.8+0.08,0.0,1.0));
        col+=glint*0.32*(0.5+0.5*N.y);
        vec3 L=normalize(vec3(-0.4,1.0,0.4)); vec3 H=normalize(L+V);
        vec3 Np=normalize(N+vec3(n1-0.5,0.0,n2-0.5)*0.5);
        col+=pow(max(dot(Np,H),0.0),90.0)*1.1;
        // riflessi di luce tremolanti sul fondo (caustiche), visti attraverso l'acqua
        vec2 cp=vW.xz*9.0;
        float c1=vnoise(cp+vec2(uTime*0.55,-uTime*0.4)), c2=vnoise(cp*1.6-vec2(uTime*0.45,uTime*0.6)+5.0);
        float caus=pow(1.0-abs(c1-c2),14.0);
        col+=caus*0.4*(0.4+0.6*depth)*(uWave<1.5?1.0:0.3)*vec3(0.8,0.95,1.0);
        float foam=uHead>-1.0 ? 1.0-smoothstep(0.0,0.05,abs(vAl-uHead-(uFlow>0.0?-lag:lag))*uLen) : 0.0;
        foam*=0.55+0.45*vnoise(vW.xz*60.0+uTime*6.0);
        col=mix(col,vec3(0.93,0.97,1.0),clamp(foam,0.0,1.0)*0.8);
        float alpha=mix(0.62,0.9,clamp(fres+depth*0.25+foam,0.0,1.0));
        gl_FragColor=vec4(col,alpha); }`,
  });
}
const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 1, roughness: 0.22 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 1, roughness: 0.3 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x4e3528, roughness: 0.95, map: stoneTex });
const frameMat = new THREE.MeshStandardMaterial({ map: frameTex, roughness: 0.55 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdff3ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc534, metalness: 0.9, roughness: 0.2, emissive: 0x6a4500, emissiveIntensity: 0.4 });

// ---------- Geometrie ----------
function withAlong(g, fn) {
  const p = g.attributes.position, a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn(i, p);
  g.setAttribute('aAlong', new THREE.BufferAttribute(a, 1)); return g;
}
// box d'acqua che segue una spezzata nel piano xz (punti dal centro del canale al bordo)
function sweepBox(pts) {
  const lens = [], parts = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); tot += l; }
  let cum = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], l = lens[i], ux = (x1 - x0) / l, uz = (z1 - z0) / l;
    const g = new THREE.BoxGeometry(WW, WH, l + WW, 8, 1, Math.max(4, Math.ceil(l * 40)));
    { const pp = g.attributes.position, ac = new Float32Array(pp.count);
      for (let k = 0; k < pp.count; k++) ac[k] = pp.getX(k) / (WW / 2);
      g.setAttribute('aAcross', new THREE.BufferAttribute(ac, 1)); }
    g.translate(0, WH / 2, 0).rotateY(Math.atan2(ux, uz)).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const c0 = cum; cum += l;
    withAlong(g, (k, p) => (c0 + Math.min(l, Math.max(0, (p.getX(k) - x0) * ux + (p.getZ(k) - z0) * uz))) / tot);
    parts.push(g);
  }
  const g = mergeGeometries(parts); g.userData.len = tot; return g;
}
function bridgeCurve(sx) { // mezzo arco dal centro (in alto) al bordo est (sx=1) o ovest (sx=-1)
  return new THREE.CubicBezierCurve3(new THREE.Vector3(0, Y_TOP, 0), new THREE.Vector3(0.22 * sx, Y_TOP, 0),
    new THREE.Vector3(0.3 * sx, Y_LOW, 0), new THREE.Vector3(0.5 * sx, Y_LOW, 0));
}
const segCache = new Map();
function segGeo(typeKey, ci, d) {
  const key = typeKey + ci + d; if (segCache.has(key)) return segCache.get(key);
  const ch = TYPES[typeKey].ch[ci]; let g;
  if (ch.bridge) {
    const tube = new THREE.TubeGeometry(bridgeCurve(d === 1 ? 1 : -1), 24, 0.055, 10);
    const uv = tube.attributes.uv; g = withAlong(tube, k => uv.getX(k)); g.userData.len = 0.62;
    g.setAttribute('aAcross', new THREE.BufferAttribute(Float32Array.from({ length: uv.count }, (_, k) => Math.cos(uv.getY(k) * Math.PI * 2) * 0.8), 1));
  } else {
    const [hx, hz] = ch.hub || [0, 0], ex = DIRS[d][0] * 0.5, ez = DIRS[d][1] * 0.5;
    const pts = [[hx, hz]];
    if (hx || hz) pts.push(DIRS[d][0] === 0 ? [0, hz] : [hx, 0]);
    pts.push([ex, ez]);
    g = sweepBox(pts);
  }
  segCache.set(key, g); return g;
}
// contorno smussato dei muretti a partire dalle celle chiuse
function wallGeo(typeKey) {
  const T = TYPES[typeKey]; if (T.wallGeo) return T.wallGeo;
  const open = new Set(T.open.map(c => c.join()));
  const closed = (i, j) => i >= 0 && j >= 0 && i < 3 && j < 3 && !open.has(i + ',' + j);
  const out = new Map(), K = p => p.join();
  const add = (a, b) => { (out.get(K(a)) || out.set(K(a), []).get(K(a))).push(b); };
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (closed(i, j)) {
    if (!closed(i, j - 1)) add([i, j], [i + 1, j]);
    if (!closed(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
    if (!closed(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
    if (!closed(i - 1, j)) add([i, j + 1], [i, j]);
  }
  const loops = [];
  while (out.size) {
    const start = out.keys().next().value.split(',').map(Number); const loop = [];
    let cur = start, prev = null;
    do {
      loop.push(cur); const arr = out.get(K(cur));
      let idx = 0;
      if (arr.length > 1 && prev) { // in un punto di contatto diagonale gira verso l'interno
        const dx = cur[0] - prev[0], dz = cur[1] - prev[1], nx = -dz, nz = dx;
        idx = Math.max(0, arr.findIndex(b => b[0] - cur[0] === nx && b[1] - cur[1] === nz));
      }
      const nxt = arr.splice(idx, 1)[0]; if (!arr.length) out.delete(K(cur));
      prev = cur; cur = nxt;
    } while (K(cur) !== K(start));
    loops.push(loop);
  }
  const INSET = 0.04, BS = 0.025, BT = 0.025, parts = [];
  for (let loop of loops) {
    loop = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; });
    const pts = loop.map((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length];
      const d1 = [Math.sign(p[0] - a[0]), Math.sign(p[1] - a[1])], d2 = [Math.sign(b[0] - p[0]), Math.sign(b[1] - p[1])];
      const x = (p[0] - 1.5) * SUB + INSET * (-d1[1] - d2[1]), z = (p[1] - 1.5) * SUB + INSET * (d1[0] + d2[0]);
      return new THREE.Vector2(x, -z);
    });
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: WALL_H - 2 * BT, bevelEnabled: true, bevelThickness: BT, bevelSize: BS, bevelSegments: 2, curveSegments: 2 });
    g.rotateX(-Math.PI / 2).translate(0, FLOOR_H + BT, 0); parts.push(g);
  }
  T.wallGeo = mergeGeometries(parts); return T.wallGeo;
}
const floorGeo = (() => {
  const h = TS / 2 - 0.03, s = new THREE.Shape([new THREE.Vector2(-h, -h), new THREE.Vector2(h, -h), new THREE.Vector2(h, h), new THREE.Vector2(-h, h)]);
  return new THREE.ExtrudeGeometry(s, { depth: FLOOR_H - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
})();
const streamGeo = withAlong(new THREE.CylinderGeometry(0.055, 0.07, 1, 18, 40, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), (k, p) => p.getZ(k));
{ const p = streamGeo.attributes.position; streamGeo.setAttribute('aAcross', new THREE.BufferAttribute(Float32Array.from({ length: p.count }, (_, k) => p.getX(k) / 0.07), 1)); }
const troughGeo = sweepBox([[0, 0], [0, 0.66]]);
const surfGeo = (() => {
  const g = new THREE.RingGeometry(0.001, 0.465, 48, 16).rotateX(-Math.PI / 2), p = g.attributes.position;
  withAlong(g, k => Math.hypot(p.getX(k), p.getZ(k)) / 0.465);
  g.setAttribute('aAcross', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  return g;
})();
const glassGeo = (() => {
  const w = bridgeCurve(-1), p = new THREE.CurvePath();
  p.add(new THREE.CubicBezierCurve3(w.v3, w.v2, w.v1, w.v0)); p.add(bridgeCurve(1));
  return new THREE.TubeGeometry(p, 48, 0.085, 14);
})();

// ---------- Particelle ----------
const PMAX = 600;
const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 7, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05 }), PMAX);
drops.frustumCulled = false; scene.add(drops);
const WATER_C = new THREE.Color(0x5ab4ff), GOLD_C = new THREE.Color(0xffc534);
const P = Array.from({ length: PMAX }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
let pNext = 0;
const dummy = new THREE.Object3D();
function spawn(x, y, z, vx, vy, vz, life = 1, color = WATER_C) {
  const i = pNext; pNext = (pNext + 1) % PMAX;
  Object.assign(P[i], { x, y, z, vx, vy, vz, life }); drops.setColorAt(i, color); drops.instanceColor.needsUpdate = true;
}
drops.setColorAt(0, WATER_C);
function updateDrops(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = P[i];
    if (p.life > 0) {
      p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
      const onBoard = Math.abs(p.x) < N / 2 && Math.abs(p.z) < N / 2;
      if (p.y < (onBoard ? 0.14 : -0.5)) p.life = 0;
    }
    dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(p.life > 0 ? Math.min(1, p.life * 3) : 0);
    dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
  }
  drops.instanceMatrix.needsUpdate = true;
}

// ---------- Stato livello ----------
let level = 1, N = 4, inCol = 2, outCol = 2, tiles = [], stars = [], moves = 0, won = false, t0 = 0;
let board = null, pickables = [];
let faucetOpen = false, autoOpenAt = 0;
const fs = { a: 0, b: 0 }, os = { a: 0, b: 0 };
let basin = 0, outFlow = false, leakTimer = 0, leakWarned = false, leakingNow = false;
let handle, streamMesh, outStream, troughWater, basinWater, basinSurf, basinGroup;
const tileAt = (r, c) => (r >= 0 && c >= 0 && r < N && c < N) ? tiles[r * N + c] : null;
const rotOf = t => ((t.turns % 4) + 4) % 4;
const spinning = t => Math.abs(t.angle - (-t.turns * Math.PI / 2)) > 1e-3;
const localDir = (t, wd) => { const ld = ((wd - rotOf(t)) % 4 + 4) % 4; return (t.T.mask >> ld) & 1 ? ld : -1; };
const tilePos = (r, c) => new THREE.Vector3(c - (N - 1) / 2, 0, r - (N - 1) / 2);
const pick = w => { let x = Math.random() * Object.values(w).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(w)) if ((x -= v) < 0) return k; };

function findPath() {
  for (let tries = 0; tries < 400; tries++) {
    const minLen = Math.max(N, N + 2 + rand(N) - Math.floor(tries / 40));
    const path = [], seen = new Set(); let budget = 4000;
    const dfs = (r, c) => {
      if (--budget < 0) return false;
      path.push([r, c]); seen.add(r * N + c);
      if (r === N - 1 && c === outCol && path.length >= minLen) return true;
      for (const d of shuffle([0, 1, 2, 3])) {
        const nr = r + DIRS[d][1], nc = c + DIRS[d][0];
        if (nr < 0 || nc < 0 || nr >= N || nc >= N || seen.has(nr * N + nc)) continue;
        if (dfs(nr, nc)) return true;
      }
      path.pop(); seen.delete(r * N + c); return false;
    };
    if (dfs(0, inCol)) return path;
  }
  return null;
}
const dirTo = (a, b) => DIRS.findIndex(([dx, dz]) => a[1] + dx === b[1] && a[0] + dz === b[0]);

function isSolved() {
  const start = tileAt(0, inCol), q = [], seen = new Set();
  const enter = (t, wd) => { const ld = localDir(t, wd); if (ld < 0) return; const k = t.r * N + t.c + ':' + t.chOf[ld];
    if (!seen.has(k)) { seen.add(k); q.push([t, t.chOf[ld], ld]); } };
  enter(start, 0);
  while (q.length) {
    const [t, ci, ldIn] = q.shift();
    for (const ld of t.T.ch[ci].dirs) {
      if (ld === ldIn) continue;
      const wd = (ld + rotOf(t)) % 4;
      if (t.r === N - 1 && t.c === outCol && wd === 2) return true;
      const n = tileAt(t.r + DIRS[wd][1], t.c + DIRS[wd][0]); if (n) enter(n, (wd + 2) % 4);
    }
  }
  return false;
}

function buildLevel() {
  N = level <= 3 ? 4 : level <= 6 ? 5 : 6;
  inCol = level === 1 ? 2 : rand(N); outCol = level === 1 ? 2 : rand(N);
  const path = findPath(), onPath = new Map();
  path.forEach((p, i) => {
    const a = i === 0 ? 0 : dirTo(p, path[i - 1]), b = i === path.length - 1 ? 2 : dirTo(p, path[i + 1]);
    const want = (1 << a) | (1 << b), straight = (a + 2) % 4 === b;
    const typeKey = straight ? (level > 1 && Math.random() < 0.2 ? 'ponte' : 'dritta') : (level > 1 && Math.random() < 0.2 ? 'doppia' : 'curva');
    const sol = [0, 1, 2, 3].find(k => TYPES[typeKey].ch.some(c => rotMask(c.mask, k) === want));
    onPath.set(p[0] * N + p[1], { typeKey, sol, idx: i });
  });
  if (board) scene.remove(board);
  board = new THREE.Group(); scene.add(board); pickables = []; tiles = []; stars = [];
  const frame = new THREE.Mesh(new THREE.BoxGeometry(N + 0.3, 0.5, N + 0.3), frameMat);
  frame.position.y = -0.25; frame.castShadow = frame.receiveShadow = true; board.add(frame);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(N + 0.42, 0.06, N + 0.42), frameMat); lip.position.y = -0.03; lip.receiveShadow = true; board.add(lip);

  // tessere bloccate (mostrano un pezzo di soluzione) e gocce d'oro sul percorso
  const inner = path.slice(1, -1).map(p => p[0] * N + p[1]);
  const locks = new Set(shuffle([...inner]).slice(0, level <= 1 ? 0 : level <= 3 ? 1 : 2));
  const free = shuffle(inner.filter(k => !locks.has(k)));
  const starSet = new Set(free.slice(0, Math.min(3, free.length)));

  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const info = onPath.get(r * N + c);
    const typeKey = info ? info.typeKey : pick(level === 1 ? { curva: 4, dritta: 3, ti: 2, croce: 0.5 } : { curva: 3, dritta: 2.5, ti: 2, croce: 0.5, ponte: 1, doppia: 1 });
    const T = TYPES[typeKey], locked = locks.has(r * N + c);
    const g = new THREE.Group(); g.position.copy(tilePos(r, c));
    const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: 1.5, roughness: 0.85,
      color: locked ? new THREE.Color(0x8a9aab) : new THREE.Color().setHSL(0.055 + Math.random() * 0.03, 0.55, 0.48 + Math.random() * 0.08) });
    const fl = new THREE.Mesh(floorGeo, floorMat), wl = new THREE.Mesh(wallGeo(typeKey), wallMat);
    fl.receiveShadow = wl.receiveShadow = wl.castShadow = true;
    g.add(fl, wl);
    const t = { r, c, T, typeKey, turns: 0, angle: 0, lift: 0, land: 0, shake: 0, bounceAt: 0, group: g, segs: [], chOf: [], locked,
      sol: info ? info.sol : rand(4) };
    T.ch.forEach((ch, ci) => ch.dirs.forEach(d => {
      t.chOf[d] = ci;
      const geo = segGeo(typeKey, ci, d), m = new THREE.Mesh(geo, waterMat(ch.bridge ? 0 : 1));
      m.material.uniforms.uLen.value = geo.userData.len; m.visible = false; m.frustumCulled = false;
      if (!ch.bridge) m.position.y = FLOOR_H + d * 0.0015;   // piccoli scalini: niente sfarfallio dove i rami si sovrappongono
      g.add(m); t.segs[d] = { mesh: m, fill: 0, feed: null, ch: ci };
    }));
    if (T.ch.some(c => c.bridge)) {
      const arch = new THREE.Mesh(glassGeo, glassMat); arch.renderOrder = 2; g.add(arch);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), brass);
        post.position.set(0.12 * sx, Y_TOP - 0.1, 0.075 * sz); g.add(post);
      }
    }
    if (locked) for (const [bx, bz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), metal);
      bolt.position.set(bx * SUB, FLOOR_H + WALL_H + 0.01, bz * SUB); bolt.castShadow = true; g.add(bolt);
    }
    fl.userData.tile = wl.userData.tile = t; pickables.push(fl, wl);
    board.add(g); tiles.push(t);
    if (starSet.has(r * N + c)) {
      const s = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), goldMat);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.087, 0.15, 20), goldMat); tip.position.y = 0.11;
      s.add(body, tip); s.traverse(o => { if (o.isMesh) o.castShadow = true; });
      s.scale.setScalar(1.5); s.position.copy(tilePos(r, c)).setY(0.75); board.add(s);
      stars.push({ tile: t, mesh: s, lit: false });
    }
  }
  do { tiles.forEach(t => { t.turns = t.locked ? t.sol : rand(4); }); } while (isSolved());
  tiles.forEach(t => { t.start = t.turns; t.angle = -t.turns * Math.PI / 2; t.group.rotation.y = t.angle; });
  buildFixtures();
  resetFlow();
  document.getElementById('lvl').textContent = 'Livello ' + level;
  fit();
}

function buildFixtures() {
  const ix = inCol - (N - 1) / 2, nz = -N / 2, sz = N / 2, ox = outCol - (N - 1) / 2;
  const faucet = new THREE.Group(); board.add(faucet);
  const top = SPOUT_Y + 0.25, postZ = nz - 0.9, spoutZ = nz + 0.18;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, top + 0.5, 24), metal);
  post.position.set(ix, (top - 0.5) / 2, postZ);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 32), metal); base.position.set(ix, -0.47, postZ);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, spoutZ - postZ, 24).rotateX(Math.PI / 2), metal);
  arm.position.set(ix, top, (postZ + spoutZ) / 2);
  const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), metal); elbow.position.set(ix, top, postZ);
  const elbow2 = new THREE.Mesh(new THREE.SphereGeometry(0.082, 24, 16), metal); elbow2.position.set(ix, top, spoutZ);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 24), metal); nose.position.set(ix, top - 0.12, spoutZ);
  handle = new THREE.Group(); handle.position.set(ix, top + 0.22, (postZ + spoutZ) / 2);
  const red = new THREE.MeshStandardMaterial({ color: 0xd8342c, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 12, 36).rotateX(Math.PI / 2), red);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), metal); stem.position.y = -0.11;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), red);
  handle.add(ring, stem, cap);
  for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), red); sp.rotation.y = k * Math.PI / 4; handle.add(sp); }
  faucet.add(post, base, arm, elbow, elbow2, nose, handle);
  faucet.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.faucet = true; pickables.push(o); } });
  streamMesh = new THREE.Mesh(streamGeo, waterMat(2)); streamMesh.rotation.x = Math.PI / 2; streamMesh.frustumCulled = false;
  streamMesh.userData.base = new THREE.Vector3(ix, SPOUT_Y, spoutZ); board.add(streamMesh);
  // scolo + vaso
  const trough = new THREE.Group(); trough.position.set(ox, 0, sz);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.7), metal); tb.position.set(0, 0.1, 0.35);
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.7), metal); s1.position.set(-0.2, 0.16, 0.35);
  const s2 = s1.clone(); s2.position.x = 0.2;
  troughWater = new THREE.Mesh(troughGeo, waterMat()); troughWater.position.set(0, 0.12, 0); troughWater.visible = false;
  troughWater.material.uniforms.uLen.value = troughGeo.userData.len;
  trough.add(tb, s1, s2, troughWater); trough.traverse(o => { if (o.isMesh && o !== troughWater) o.castShadow = true; });
  board.add(trough);
  basinGroup = new THREE.Group(); basinGroup.position.set(ox, -0.5, sz + 0.9); board.add(basinGroup);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.44, 0.55, 48, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 0.275; glass.renderOrder = 3;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 48).rotateX(Math.PI / 2), metal); rim.position.y = 0.55;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 48), metal); bottom.position.y = 0.015;
  basinWater = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.43, 1, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f6fb8, roughness: 0.06, transparent: true, opacity: 0.7 }));
  basinWater.visible = false;
  // superficie del vaso: onde che partono dal centro dove cade il getto
  basinSurf = new THREE.Mesh(surfGeo, waterMat(1)); basinSurf.material.uniforms.uLen.value = 0.46; basinSurf.visible = false;
  basinGroup.add(glass, rim, bottom, basinWater, basinSurf);
  outStream = new THREE.Mesh(streamGeo, waterMat(2)); outStream.rotation.x = Math.PI / 2; outStream.frustumCulled = false;
  outStream.userData.base = new THREE.Vector3(ox, 0.14, sz + 0.68); board.add(outStream);
}

function resetFlow() {
  tiles.forEach(t => t.segs.forEach(s => { if (s) { s.fill = 0; s.feed = null; s.mesh.visible = false; } }));
  stars.forEach(s => s.lit = false);
  Object.assign(fs, { a: 0, b: 0 }); Object.assign(os, { a: 0, b: 0 });
  basin = 0; outFlow = false; won = false; moves = 0; leakWarned = false;
  faucetOpen = false; autoOpenAt = performance.now() + 900; t0 = performance.now();
  document.getElementById('moves').textContent = 'Mosse 0';
  document.getElementById('tap').textContent = '🚰 Apri';
  document.getElementById('win').hidden = true;
}

function setFaucet(open) {
  faucetOpen = open; autoOpenAt = 0;
  document.getElementById('tap').textContent = open ? '🚰 Chiudi' : '🚰 Apri';
  haptic('medium'); Sound.valve(open);
}

// ---------- Simulazione acqua ----------
const streamFull = () => SPOUT_Y - FLOOR_H - WH;
function edgeIn(t, wd) {
  if (t.r === 0 && t.c === inCol && wd === 0) return faucetOpen && fs.a === 0 && fs.b >= streamFull();
  const n = tileAt(t.r + DIRS[wd][1], t.c + DIRS[wd][0]);
  if (!n || spinning(n)) return false;
  const ld = localDir(n, (wd + 2) % 4); if (ld < 0) return false;
  const s = n.segs[ld]; return s.fill >= 1 && s.feed === 'center';
}

function simulate(dt) {
  for (const t of tiles) {
    const spin = spinning(t);
    t.segs.forEach((s, ld) => {
      if (!s) return;
      if (spin) { s.fill = Math.max(0, s.fill - dt * DRAIN * 4); if (!s.fill) s.feed = null; return; }
      const wd = (ld + rotOf(t)) % 4;
      const fromEdge = edgeIn(t, wd);
      const fromCenter = t.segs.some((o, k) => o && k !== ld && o.ch === s.ch && o.fill >= 1 && o.feed === 'edge');
      const fed = s.feed === 'edge' ? fromEdge : s.feed === 'center' ? fromCenter : false;
      if (fed) s.fill = Math.min(1, s.fill + dt * FILL / s.mesh.geometry.userData.len * 0.6);
      else if (s.fill > 0) { s.fill = Math.max(0, s.fill - dt * DRAIN); if (!s.fill) s.feed = null; }
      else if (fromEdge) {
        s.feed = 'edge';
        // schizzo dove l'acqua entra nella tessera nuova
        const p = tilePos(t.r, t.c), [dx, dz] = DIRS[wd];
        for (let i = 0; i < 7; i++) spawn(p.x + dx * 0.48 + (Math.random() - .5) * 0.12, FLOOR_H + 0.1, p.z + dz * 0.48 + (Math.random() - .5) * 0.12,
          -dx * Math.random() * 0.6 + (Math.random() - .5) * 0.7, 0.7 + Math.random() * 0.9, -dz * Math.random() * 0.6 + (Math.random() - .5) * 0.7, 0.45);
      }
      else if (fromCenter) s.feed = 'center';
    });
  }
  outFlow = false; leakTimer += dt; const doLeak = leakTimer > 0.03; if (doLeak) leakTimer = 0;
  let leaking = false;
  for (const t of tiles) {
    if (spinning(t)) continue;
    t.segs.forEach((s, ld) => {
      if (!s || s.fill < 1 || s.feed !== 'center') return;
      const wd = (ld + rotOf(t)) % 4;
      if (t.r === N - 1 && t.c === outCol && wd === 2) { outFlow = true; return; }
      const n = tileAt(t.r + DIRS[wd][1], t.c + DIRS[wd][0]);
      if (n && !spinning(n) && localDir(n, (wd + 2) % 4) >= 0) return;
      leaking = true;
      if (doLeak) {
        const p = tilePos(t.r, t.c); const [dx, dz] = DIRS[wd];
        spawn(p.x + dx * 0.5 + (Math.random() - .5) * 0.15, FLOOR_H + 0.15, p.z + dz * 0.5 + (Math.random() - .5) * 0.15,
          dx * (0.6 + Math.random() * 0.6) + (Math.random() - .5) * 0.5, 1 + Math.random(), dz * (0.6 + Math.random() * 0.6) + (Math.random() - .5) * 0.5, 1.2);
      }
    });
  }
  const first = tileAt(0, inCol);
  if (faucetOpen && fs.b >= streamFull() && (spinning(first) || localDir(first, 0) < 0) && doLeak) {
    const b = streamMesh.userData.base; leaking = true;
    spawn(b.x, FLOOR_H + WALL_H + 0.02, b.z, (Math.random() - .5) * 1.6, 0.8 + Math.random(), (Math.random() - .5) * 1.6, 1);
  }
  leakingNow = leaking;
  if (leaking && !leakWarned && moves > 0) { leakWarned = true; haptic('warning'); }
  if (!leaking) leakWarned = false;
  // gocce d'oro: accese quando l'acqua passa nella loro tessera
  for (const s of stars) {
    const wet = !spinning(s.tile) && s.tile.segs.some(x => x && x.fill >= 1);
    if (wet && !s.lit) {
      haptic('medium'); Sound.star();
      for (let i = 0; i < 24; i++) { const a = Math.random() * 7; spawn(s.mesh.position.x, s.mesh.position.y, s.mesh.position.z, Math.cos(a) * 1.2, 1 + Math.random() * 1.5, Math.sin(a) * 1.2, 0.8, GOLD_C); }
    }
    s.lit = wet;
  }
}

function updateStream(st, mesh, open, full, dt) {
  if (open) { st.a = 0; st.b = Math.min(full, st.b + dt * 7); }
  else { st.a = Math.min(st.b, st.a + dt * 7); if (st.a >= st.b) { st.a = 0; st.b = 0; } }
  const len = st.b - st.a; mesh.visible = len > 0.01;
  const base = mesh.userData.base; mesh.position.set(base.x, base.y - st.a, base.z);
  mesh.scale.set(1, 1, Math.max(len, 0.001));
  const u = mesh.material.uniforms; u.uLen.value = len; u.uStart.value = st.a; u.uFlow.value = 1;
}

function drawWater() {
  for (const t of tiles) t.segs.forEach(s => {
    if (!s) return;
    s.mesh.visible = s.fill > 0.001; if (!s.mesh.visible) return;
    const u = s.mesh.material.uniforms, f = s.fill;
    if (s.feed === 'edge') { u.uA.value = 1 - f; u.uB.value = 1.01; u.uHead.value = f < 1 ? 1 - f : -9; u.uFlow.value = -1; }
    else { u.uA.value = -0.01; u.uB.value = f; u.uHead.value = f < 1 ? f : -9; u.uFlow.value = 1; }
  });
}

// ---------- Input ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return; down = null;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0]; if (!hit) return;
  if (hit.object.userData.faucet) { setFaucet(!faucetOpen); return; }
  const t = hit.object.userData.tile; if (!t || won) return;
  if (t.locked) { t.shake = 1; haptic('error'); Sound.locked(); return; }
  t.turns++; moves++; haptic('light'); Sound.turn();
  document.getElementById('moves').textContent = 'Mosse ' + moves;
  document.getElementById('hint').style.opacity = 0;
});
document.getElementById('tap').onclick = () => setFaucet(!faucetOpen);
document.getElementById('reset').onclick = () => {
  tiles.forEach(t => { t.turns = t.start; t.angle = -t.turns * Math.PI / 2; t.group.rotation.y = t.angle; });
  resetFlow();
};
document.getElementById('next').onclick = () => { level++; buildLevel(); };
const muteBtn = document.getElementById('mute');
muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
muteBtn.onclick = () => { Sound.init(); muteBtn.textContent = Sound.toggle() ? '🔇' : '🔊'; };

// ---------- Camera ----------
function fit() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const el = THREE.MathUtils.degToRad(60);
  const needW = (N + 1.4) / 2 / Math.tan(hf / 2);
  const needH = ((N + 3.6) * Math.sin(el) + 1.2) / 2 / Math.tan(vf / 2);
  const dist = Math.max(needW, needH) * 1.08;
  camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist + 0.15);
  camera.lookAt(0, 0.1, 0.15);
  camera.updateProjectionMatrix();
}
addEventListener('resize', fit);

// ---------- Loop ----------
const clock = new THREE.Clock();
let lastHud = '';
let simNow = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function update(dt) {
  const now = performance.now() + simNow;
  uTime.value += dt;
  if (autoOpenAt && now > autoOpenAt) setFaucet(true);
  for (const t of tiles) {
    const target = -t.turns * Math.PI / 2, d = target - t.angle, was = spinning(t);
    const step = dt * (Math.PI / 2) / 0.2;
    t.angle = Math.abs(d) <= step ? target : t.angle + Math.sign(d) * step;
    if (was && !spinning(t)) { t.land = 1; Sound.clack(); }
    t.lift += ((spinning(t) ? 0.22 : 0) - t.lift) * Math.min(1, dt * 18);
    t.land = Math.max(0, t.land - dt * 5); t.shake = Math.max(0, t.shake - dt * 3);
    let bounce = 0;
    if (t.bounceAt && now > t.bounceAt) { const ph = (now - t.bounceAt) / 450; if (ph < 1) bounce = Math.sin(ph * Math.PI) * 0.22; else t.bounceAt = 0; }
    const sq = Math.sin(t.land * Math.PI) * 0.12;
    t.group.rotation.y = t.angle; t.group.position.y = t.lift + bounce;
    t.group.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.4);
    t.group.position.x = tilePos(t.r, t.c).x + Math.sin(t.shake * 30) * t.shake * 0.05;
  }
  handle.rotation.y += ((faucetOpen ? -Math.PI * 1.5 : 0) - handle.rotation.y) * Math.min(1, dt * 6);
  updateStream(fs, streamMesh, faucetOpen, streamFull(), dt);
  simulate(dt);
  drawWater();
  for (const s of stars) {
    s.mesh.rotation.y += dt * (s.lit ? 6 : 1.2);
    s.mesh.position.y = 0.75 + Math.sin(uTime.value * 2 + s.tile.c) * 0.05 + (s.lit ? 0.1 : 0);
    s.mesh.scale.setScalar(s.lit ? 1.9 : 1.5);
  }
  goldMat.emissiveIntensity = stars.some(s => s.lit) ? 0.9 : 0.4;
  const hud = `💧 ${stars.filter(s => s.lit).length}/${stars.length}`;
  if (hud !== lastHud) { document.getElementById('starsHud').textContent = lastHud = hud; }
  // uscita e vaso
  troughWater.visible = outFlow || os.b > 0;
  const surf = 0.05 + basin * 0.45, outFull = 0.14 - (-0.5 + surf);
  updateStream(os, outStream, outFlow, outFull, dt);
  if (outFlow && os.b >= outFull - 0.01 && !won) {
    basin = Math.min(1, basin + dt * 0.35);
    if (Math.random() < 0.5) { const b = outStream.userData.base; spawn(b.x, -0.5 + surf, b.z, (Math.random() - .5) * 1.2, 0.6 + Math.random() * 0.8, (Math.random() - .5) * 1.2, 0.5); }
    if (basin >= 1) win();
  }
  basinWater.visible = basin > 0.001;
  basinWater.scale.y = Math.max(basin * 0.45, 0.001); basinWater.position.y = 0.03 + basin * 0.225;
  basinSurf.visible = basinWater.visible; basinSurf.position.y = 0.03 + basin * 0.45 - 0.012;
  if (faucetOpen && fs.b >= streamFull() && Math.random() < 0.35) {
    const b = streamMesh.userData.base; spawn(b.x, FLOOR_H + WH, b.z, (Math.random() - .5) * 0.8, 0.5 + Math.random() * 0.5, (Math.random() - .5) * 0.8, 0.35);
  }
  updateDrops(dt);
  let wet = 0, fronts = 0;
  for (const t of tiles) for (const s of t.segs) if (s) { if (s.fill >= 1) wet++; else if (s.fill > 0) fronts++; }
  Sound.tick(dt, { wet, fronts, pour: fs.b - fs.a > 0.05, out: outFlow && !won, basin, leaking: leakingNow });
}

function win() {
  won = true; haptic('success'); Sound.splash(); setTimeout(() => Sound.win(), 250);
  const now = performance.now();
  tiles.forEach(t => { if (t.segs.some(s => s && s.fill >= 1)) t.bounceAt = now + (t.r + Math.abs(t.c - inCol)) * 90; });
  const b = basinGroup.position;
  for (let i = 0; i < 90; i++) { const a = Math.random() * Math.PI * 2, v = 0.5 + Math.random() * 1.5; spawn(b.x, 0.05, b.z, Math.cos(a) * v, 3 + Math.random() * 2, Math.sin(a) * v, 2); }
  const got = stars.filter(s => s.lit).length, secs = Math.round((now - t0) / 1000);
  if (!ICON && !params.has('dev')) store({ level: Math.max(saved.level || 1, level + 1) });   // si riparte dal livello successivo
  // record personale (livello finito più alto): se lo batti, premio in gettoni (docs/gettoni.md)
  if (embedded && !ICON && !params.has('dev')) parent.postMessage({ type: 'arcade:record', game: 'acquedotto', score: level }, location.origin);
  document.getElementById('winStars').textContent = stars.length ? '💧'.repeat(got) + '○'.repeat(stars.length - got) : '';
  document.getElementById('winTxt').textContent = `Gocce d'oro ${got}/${stars.length} · ${moves} mosse · ${secs} s`;
  setTimeout(() => { document.getElementById('win').hidden = false; }, 1400);
}

const solve = () => tiles.forEach(t => { while (rotOf(t) !== t.sol) t.turns++; });
const run = sec => { for (let i = 0; i < sec * 60; i++) { simNow += 1000 / 60; update(1 / 60); } renderer.render(scene, camera); };
// solo per le prove (?dev): risolvi il livello e fai avanzare il tempo senza animazione
if (params.has('dev')) window.__acq = { get tiles() { return tiles; }, solve, next() { level++; buildLevel(); },
  run(sec) { run(sec); return { won, basin, level, stars: stars.filter(s => s.lit).length + '/' + stars.length }; } };

level = Math.min(99, Math.max(1, Number(saved.level) || 1));
if (ICON) {
  // icona: livello con ponte, acqua già arrivata, inquadratura ravvicinata e quadrata
  document.body.classList.add('icon');
  level = 1; buildLevel(); solve(); run(9);
  const ix = inCol - (N - 1) / 2;
  camera.fov = 42; camera.position.set(ix + 2.0, 3.6, 1.5); camera.lookAt(ix - 0.2, 0.45, -1.15); camera.updateProjectionMatrix();
  removeEventListener('resize', fit);
}
else buildLevel();
frame();
