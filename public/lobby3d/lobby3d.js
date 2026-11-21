// Lobby 3D (prova su staging): un "guscio" facoltativo della Lobby. Si cammina con il proprio personaggio tra
// l'atrio (la lavagna apre Settings, il cartellone apre Giochi), la sala biliardo (vicino a un tavolo "Apri" apre
// il Biliardo, con i tavoli veri del gioco) e la sala arcade (ogni cabinato apre il suo gioco).
// Non rifà nessuna schermata: chiede all'app di aprire quelle che ci sono già, e intanto il mondo 3D si ferma.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { Table3D, CLOTHS } from '../biliardo/scene3d.js?v=47e47e2969';
import * as E from '../biliardo/engine.js?v=2db7d98a7f';
import { readAppearance } from '../appearance.js?v=3bf8d2e2ca';

const H = 3.4; // altezza delle stanze
const DOOR = 1.3, DOOR_H = 2.5; // mezza larghezza e altezza delle porte
const R = 0.3; // ingombro del personaggio
const SPEED = 3.1;
// cabinati della sala arcade: chiave del gioco nel catalogo (games-catalog.js), nome, colore
const ARCADE = [
  ['pong', 'Pong', '#5bc0be'],
  ['moto-trial', 'Moto Trial', '#e07b39'],
  ['acquedotto', 'Acquedotto!', '#2f8fd8'],
  ['lunar-lander-3d', 'Lunar Lander 3D', '#9aa7ff'],
  ['number-connect', 'Number Connect', '#f0a202'],
  ['f1-on-paper', 'F1 on paper!', '#1fae5f'],
  ['golf-with-your-gay-friends', 'Golf', '#4caf50'],
  ['labyrinth', 'Labyrinth', '#7d6bd6'],
  ['giulio-simulator', 'Giulio Simulator', '#3a7bd5'],
  ['binotto-simulator', 'Binotto Simulator', '#ffd236'],
];

const CSS = `
.l3d{position:fixed;inset:0;z-index:60;background:#0b0810;color:#fff;font:15px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
.l3d[hidden]{display:none}
.l3d-gl,.l3d-gl canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.l3d-top{position:absolute;left:calc(var(--ui-safe-left,0px) + 10px);right:calc(var(--ui-safe-right,0px) + 10px);top:calc(var(--ui-safe-top,0px) + 10px);display:flex;gap:8px;align-items:center;pointer-events:none}
.l3d-top>*{pointer-events:auto;flex:none;width:auto;margin:0}
.l3d button{font:inherit;color:#fff;background:rgba(18,14,28,.72);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:9px 13px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer}
.l3d-where{margin-left:auto;padding:7px 12px;border-radius:999px;background:rgba(18,14,28,.6);font-weight:600;font-size:14px}
.l3d-hint{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--ui-safe-top,0px) + 58px);padding:6px 12px;border-radius:10px;background:rgba(0,0,0,.45);font-size:13px;color:#e7e1f3;text-align:center;max-width:86vw;transition:opacity .6s;pointer-events:none}
.l3d-act{position:absolute;left:50%;bottom:calc(var(--ui-safe-bottom,0px) + 34px);transform:translateX(-50%);width:auto!important;max-width:90vw;margin:0;font-weight:700!important;font-size:17px!important;padding:13px 24px!important;background:linear-gradient(180deg,#ffcf4a,#f29d1c)!important;color:#2a1600!important;border:0!important;box-shadow:0 6px 24px rgba(255,180,40,.45);white-space:nowrap}
.l3d-act[hidden]{display:none}
.l3d-stick{position:absolute;left:calc(var(--ui-safe-left,0px) + 26px);bottom:calc(var(--ui-safe-bottom,0px) + 26px);width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);pointer-events:none}
.l3d-stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.6)}
.l3d-stick[hidden]{display:none}
.l3d-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;color:#cfc6e6;pointer-events:none}
`;

// ---------- texture disegnate al volo ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function neonText(text, color, w = 1024, h = 256, font = 'bold 140px "Arial Black", Arial, sans-serif') {
  return canvasTex(w, h, (g) => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 36; g.fillStyle = color; g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 10; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(text, w / 2, h / 2);
  });
}
function parquet() {
  return canvasTex(512, 512, (g, w, h) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) {
      const l = 34 + Math.random() * 10;
      g.fillStyle = `hsl(${26 + Math.random() * 6},45%,${l}%)`;
      const off = (i % 2) * s;
      g.fillRect(i * s, j * s - off, s, s * 2);
      g.strokeStyle = 'rgba(40,20,8,.55)'; g.lineWidth = 2; g.strokeRect(i * s, j * s - off, s, s * 2);
    }
  });
}
function tiles(hue, l1, l2) {
  return canvasTex(512, 512, (g, w) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(${hue},14%,${((i + j) % 2 ? l1 : l2) + Math.random() * 2}%)`; g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(i * s, j * s, s, s);
    }
  });
}
function neonGrid() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0a0614'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7c3aed'; g.lineWidth = 4; g.shadowColor = '#a855f7'; g.shadowBlur = 12;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}
function blackboard() {
  return canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#1f3a2c'); gr.addColorStop(1, '#17291f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // polvere di gesso
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1 + Math.random() * 3); }
    g.fillStyle = '#f3f1e6'; g.textBaseline = 'top';
    g.font = 'bold 96px "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive';
    g.fillText('⚙ Settings', 60, 46);
    g.font = '52px "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive';
    ['• Tema e colori', '• Il tuo personaggio', '• Avvisi e notifiche', '• Archivio · Informazioni'].forEach((t, i) => g.fillText(t, 80, 200 + i * 86));
    g.strokeStyle = 'rgba(243,241,230,.8)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(60, 168); g.bezierCurveTo(300, 158, 520, 176, 640, 162); g.stroke();
    // un disegnino: la palla 8
    g.beginPath(); g.arc(860, 470, 80, 0, 7); g.stroke();
    g.beginPath(); g.arc(860, 470, 32, 0, 7); g.stroke();
    g.font = 'bold 44px "Segoe Print", "Comic Sans MS", cursive'; g.fillText('8', 846, 444);
  });
}
function gamesPoster() {
  const list = [['Scacchi', '#c9b27c'], ['Dama', '#b0745a'], ['Forza 4', '#d9534f'], ['UNO', '#e94b3c'], ['Scarabeo', '#d6a648'], ['Scopa', '#3f8f5c'], ['Briscola', '#8c4b8a'], ['Navale', '#2f6f9f'], ['Cinema', '#d64575']];
  return canvasTex(640, 900, (g, w, h) => {
    g.fillStyle = '#f6efe1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2140'; g.font = 'bold 76px "Arial Black", Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('Tutti', w / 2, 110); g.fillText('i giochi', w / 2, 196);
    list.forEach(([t, c], i) => {
      const x = 60 + (i % 3) * 180, y = 260 + Math.floor(i / 3) * 200;
      g.fillStyle = c; g.beginPath(); g.roundRect(x, y, 160, 150, 26); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.fillText(t, x + 80, y + 88);
    });
  });
}
function cabinetScreen(title, color) {
  return canvasTex(256, 200, (g, w, h) => {
    const c = new THREE.Color(color);
    const hsl = {}; c.getHSL(hsl);
    const hue = Math.round(hsl.h * 360);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `hsl(${hue},70%,22%)`); gr.addColorStop(1, `hsl(${hue + 50},70%,7%)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) { g.fillStyle = `hsl(${hue + Math.random() * 90},100%,${55 + Math.random() * 20}%)`; const s = 6 + Math.random() * 6; g.fillRect(Math.random() * w, 60 + Math.random() * (h - 110), s, s); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${title.length > 12 ? 24 : 30}px "Arial Black", Arial, sans-serif`;
    g.shadowColor = color; g.shadowBlur = 12; g.fillText(title.toUpperCase(), w / 2, 32);
    g.shadowBlur = 0; g.font = 'bold 18px monospace'; g.fillText('▶ PREMI APRI', w / 2, h - 22);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, w, 1); }
  });
}
function nameTag(text) {
  return canvasTex(512, 96, (g, w, h) => {
    g.font = 'bold 44px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(w - 8, g.measureText(text).width + 40);
    g.fillStyle = 'rgba(10,8,20,.62)'; g.beginPath(); g.roundRect((w - tw) / 2, 10, tw, h - 20, 30); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function blobTex() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

// ---------- il personaggio (lo stesso del Labyrinth: maglia e pantaloncini scelti in Settings) ----------
function makeCharacter(look) {
  const root = new THREE.Group();
  const ball = new THREE.SphereGeometry(1, 20, 14);
  const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const skin = mat('#dc9f88', 0.65), shirt = mat(look.shirt, 0.8), shorts = mat(look.shorts, 0.8);
  // maglia e pantaloncini si ricolorano se li cambi in Settings
  shirt.userData.part = 'shirt'; shorts.userData.part = 'shorts';
  const hairM = mat('#3a2a1e', 0.9), shoeM = mat('#232b28', 0.6), soleM = mat('#a5a189', 0.8), white = mat('#f5f1e4', 0.4), dark = mat('#1b1512', 0.3);
  const blob = (parent, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(ball, m); o.position.set(x, y, z); o.scale.set(rx, ry, rz); parent.add(o); return o; };
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.119, 0.66, 0); root.add(hip);
    blob(hip, shorts, 0, -0.15, 0.008, 0.115, 0.19, 0.135);
    blob(hip, skin, 0, -0.42, 0, 0.068, 0.25, 0.075);
    blob(hip, shoeM, 0, -0.62, -0.06, 0.085, 0.062, 0.16);
    blob(hip, soleM, 0, -0.655, -0.06, 0.088, 0.02, 0.165);
    blob(hip, white, 0, -0.52, -0.01, 0.072, 0.03, 0.08); // calzino
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * 0.27, 1.22, 0); root.add(sh);
    blob(sh, shirt, 0, -0.09, 0, 0.088, 0.14, 0.088);
    blob(sh, skin, 0, -0.33, 0, 0.056, 0.2, 0.058);
    blob(sh, skin, 0, -0.55, -0.01, 0.055, 0.07, 0.048);
    arms.push(sh);
  }
  blob(root, shorts, 0, 0.66, 0.01, 0.22, 0.11, 0.135);
  blob(root, shirt, 0, 0.9, 0.008, 0.24, 0.3, 0.15);
  blob(root, shirt, 0, 1.12, 0, 0.235, 0.15, 0.143);
  blob(root, skin, 0, 1.27, 0, 0.07, 0.08, 0.07);
  const head = new THREE.Group(); head.position.y = 1.47; root.add(head);
  blob(head, skin, 0, 0, 0, 0.165, 0.195, 0.155);
  for (const s of [-1, 1]) {
    blob(head, skin, s * 0.16, -0.01, 0.01, 0.028, 0.055, 0.026); // orecchie
    blob(head, white, s * 0.059, 0.02, -0.14, 0.032, 0.025, 0.014);
    blob(head, dark, s * 0.059, 0.02, -0.152, 0.015, 0.016, 0.006);
    blob(head, hairM, s * 0.062, 0.08, -0.142, 0.032, 0.008, 0.008); // sopracciglia
  }
  blob(head, skin, 0, -0.04, -0.155, 0.024, 0.034, 0.03); // naso
  blob(head, mat('#b5655c', 0.5), 0, -0.1, -0.135, 0.045, 0.01, 0.012); // bocca
  blob(head, hairM, 0, 0.065, 0.02, 0.178, 0.16, 0.168);
  blob(head, hairM, -0.04, 0.17, -0.1, 0.07, 0.035, 0.04); // ciuffo
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, legs, arms, head, phase: 0 };
}
function animateCharacter(c, speed, dt, t) {
  const amt = Math.min(1, speed / SPEED);
  c.phase += dt * (4 + 6 * amt);
  const sw = Math.sin(c.phase) * 0.65 * amt;
  c.legs[0].rotation.x = sw; c.legs[1].rotation.x = -sw;
  c.arms[0].rotation.x = -sw * 0.8; c.arms[1].rotation.x = sw * 0.8;
  c.arms[0].rotation.z = -0.06; c.arms[1].rotation.z = 0.06;
  // fermo: respira e si guarda un po' intorno
  c.root.position.y = Math.abs(Math.cos(c.phase)) * 0.035 * amt + (1 - amt) * Math.sin(t * 2) * 0.004;
  c.head.rotation.y = (1 - amt) * Math.sin(t * 0.6) * 0.25;
}

// ---------- il mondo ----------
export function createLobby3D(app) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = document.createElement('div');
  el.className = 'l3d'; el.hidden = true;
  el.innerHTML = `<div class="l3d-gl"></div><div class="l3d-load">Carico la Lobby 3D…</div>
<div class="l3d-top"><button class="l3d-exit" aria-label="Torna alla Lobby classica">✕ Lobby classica</button><span class="l3d-where">Atrio</span></div>
<div class="l3d-hint"></div><button class="l3d-act" hidden></button><div class="l3d-stick" hidden><i></i></div>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const host = $('.l3d-gl'), actB = $('.l3d-act'), whereEl = $('.l3d-where'), hint = $('.l3d-hint'), stick = $('.l3d-stick'), knob = stick.firstChild;
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  stick.hidden = !touch;
  hint.textContent = touch ? 'Muoviti con il cerchio in basso, trascina il dito per girare la vista' : 'WASD o frecce per camminare · trascina per girare la vista · E per aprire';

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0810');
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);

  const colliders = [], spots = [], wallMeshes = [], anim = [];
  const std = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const glow = (c, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
  const box = (sx, sy, sz, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); parent.add(o); return o; };
  const solid = (x0, x1, z0, z1) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  const plane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); scene.add(o); return o; };
  // muro lungo x (nord/sud) o lungo z (est/ovest), con la collisione
  const wallX = (x0, x1, z, m, t = 0.3) => { const o = box(x1 - x0, H, t, m, (x0 + x1) / 2, H / 2, z); wallMeshes.push(o); solid(x0, x1, z - t / 2, z + t / 2); };
  const wallZ = (z0, z1, x, m, t = 0.3) => { const o = box(t, H, z1 - z0, m, x, H / 2, (z0 + z1) / 2); wallMeshes.push(o); solid(x - t / 2, x + t / 2, z0, z1); };
  // parete tra due stanze con la porta in mezzo: due facce, una per stanza
  const doorWall = (x, mA, mB) => {
    for (const [m, off] of [[mA, -0.08], [mB, 0.08]]) {
      for (const [z0, z1] of [[-6, -DOOR], [DOOR, 6]]) { const o = box(0.16, H, z1 - z0, m, x + off, H / 2, (z0 + z1) / 2); wallMeshes.push(o); }
      box(0.16, H - DOOR_H, DOOR * 2, m, x + off, DOOR_H + (H - DOOR_H) / 2, 0);
    }
    solid(x - 0.16, x + 0.16, -6, -DOOR); solid(x - 0.16, x + 0.16, DOOR, 6);
    const frame = std('#3b2416', 0.5);
    for (const z of [-DOOR, DOOR]) box(0.42, DOOR_H, 0.08, frame, x, DOOR_H / 2, z);
    box(0.42, 0.1, DOOR * 2 + 0.08, frame, x, DOOR_H, 0);
  };
  const room = (x0, x1, floorTex, rep, wallM, ceilC) => {
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(rep[0], rep[1]);
    const f = plane(x1 - x0, 12, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.05 }), (x0 + x1) / 2, 0, 0, 0, -Math.PI / 2);
    f.receiveShadow = true;
    plane(x1 - x0, 12, std(ceilC, 1), (x0 + x1) / 2, H, 0, 0, Math.PI / 2);
    wallX(x0, x1, -6.15, wallM); wallX(x0, x1, 6.15, wallM);
    // zoccolo
    const sk = std('#2a1a12', 0.6);
    box(x1 - x0, 0.14, 0.04, sk, (x0 + x1) / 2, 0.07, -5.98); box(x1 - x0, 0.14, 0.04, sk, (x0 + x1) / 2, 0.07, 5.98);
  };

  // --- luci di base
  scene.add(new THREE.HemisphereLight('#fff4e6', '#1a1020', 0.55));
  const point = (c, i, x, y, z, d = 12) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); scene.add(l); return l; };

  // ========== ATRIO (x -7…7) ==========
  const atriumWall = new THREE.MeshStandardMaterial({ color: '#d9ccb4', roughness: 0.9 });
  const billiardWall = new THREE.MeshStandardMaterial({ color: '#2a1c26', roughness: 0.85 });
  const arcadeWall = new THREE.MeshStandardMaterial({ color: '#16112a', roughness: 0.85 });
  room(-7, 7, parquet(), [3.5, 3], atriumWall, '#efe6d6');
  room(7, 19, tiles(250, 9, 14), [3, 3], billiardWall, '#0b070d');
  room(-19, -7, neonGrid(), [3, 3], arcadeWall, '#07050c');
  wallZ(-6.3, 6.3, 19.15, billiardWall); wallZ(-6.3, 6.3, -19.15, arcadeWall);
  doorWall(7, atriumWall, billiardWall); doorWall(-7, arcadeWall, atriumWall);
  point('#ffe2b8', 9, -3.5, 3.0, 0, 13); point('#ffe2b8', 9, 3.5, 3.0, 0, 13); point('#fff1dd', 5, 0, 3.0, -4, 9);
  // lampadari
  for (const x of [-3.5, 3.5]) {
    box(0.02, 0.5, 0.02, std('#222', 0.4, 0.8), x, H - 0.25, 0);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 0.32, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#f3e3c6', roughness: 0.8, side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: 0.5 }));
    shade.position.set(x, H - 0.62, 0); scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow('#fff2d0', 3)); bulb.position.set(x, H - 0.68, 0); scene.add(bulb);
  }
  // scritta sulla parete di fondo
  plane(4.4, 1.1, new THREE.MeshBasicMaterial({ map: canvasTex(1024, 256, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#2b2140'; g.font = 'bold 120px "Arial Black", Arial, sans-serif'; g.fillText('BINOTTOLAND', w / 2, 96);
    g.fillStyle = '#c07a2c'; g.font = 'bold 64px Arial, sans-serif'; g.fillText('P L A Y G R O U N D', w / 2, 206);
  }), transparent: true }), 0, 2.95, -5.99);
  // lavagna = Settings
  const bbX = -3.6;
  box(2.7, 1.75, 0.08, std('#5a3a22', 0.55), bbX, 1.55, -5.95);
  plane(2.5, 1.56, new THREE.MeshStandardMaterial({ map: blackboard(), roughness: 0.95 }), bbX, 1.55, -5.9);
  box(2.6, 0.05, 0.12, std('#5a3a22', 0.55), bbX, 0.68, -5.86);
  for (let i = 0; i < 3; i++) box(0.07, 0.016, 0.016, std(['#f5f5f0', '#f7d36b', '#9ad0f5'][i], 0.9), bbX - 0.9 + i * 0.12, 0.712, -5.86);
  spots.push({ x: bbX, z: -5.6, hx: 1.35, hz: 0.3, pad: 1.1, label: 'Impostazioni', where: 'Atrio', act: () => app.openSettings() });
  // cartellone = Giochi
  const gpX = 3.4;
  box(1.5, 2.05, 0.06, std('#3b2416', 0.5), gpX, 1.45, -5.96);
  plane(1.36, 1.92, new THREE.MeshStandardMaterial({ map: gamesPoster(), roughness: 0.7 }), gpX, 1.45, -5.92);
  spots.push({ x: gpX, z: -5.6, hx: 0.75, hz: 0.3, pad: 1.1, label: 'Tutti i giochi', where: 'Atrio', act: () => app.openGames() });
  // tappeto, divani, piante
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7a2e3a'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
    g.strokeStyle = '#e2b866'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 24, 0, 7); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 54, 0, 7); g.stroke();
    g.fillStyle = '#e2b866'; g.font = 'bold 230px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', w / 2, h / 2 + 12);
  }), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.6); scene.add(rug);
  const sofaM = std('#3f5d7a', 0.9), legM = std('#2a1a12', 0.5);
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    box(2.2, 0.42, 0.9, sofaM, 0, 0.3, 0, g); box(2.2, 0.62, 0.22, sofaM, 0, 0.62, 0.36, g);
    for (const ax of [-1.02, 1.02]) box(0.2, 0.55, 0.9, sofaM, ax, 0.42, 0, g);
    for (const lx of [-0.95, 0.95]) for (const lz of [-0.35, 0.35]) box(0.06, 0.1, 0.06, legM, lx, 0.05, lz, g);
    g.position.set(sx * 3.6, 0, 5.3); scene.add(g);
    solid(sx * 3.6 - 1.12, sx * 3.6 + 1.12, 4.85, 5.8);
  }
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: '#6b4226', roughness: 0.35, clearcoat: 0.8 }));
  table.position.set(0, 0.45, 4.6); scene.add(table);
  box(0.08, 0.44, 0.08, legM, 0, 0.22, 4.6); solid(-0.58, 0.58, 4.02, 5.18);
  const plant = (x, z) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 20), std('#b5633d', 0.8)); pot.position.set(x, 0.25, z); scene.add(pot);
    const leafM = std('#2f7a3d', 0.8);
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.1, 10, 8), leafM);
      l.position.set(x + (Math.random() - 0.5) * 0.35, 0.75 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.35); scene.add(l);
    }
    solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  };
  plant(-6.4, -5.4); plant(6.4, -5.4); plant(-6.4, 5.4); plant(6.4, 5.4);
  // cartelli sopra le porte
  const doorSign = (text, color, x, ry) => plane(2.2, 0.5, new THREE.MeshBasicMaterial({ map: neonText(text, color, 1024, 232, 'bold 110px "Arial Black", Arial, sans-serif'), transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) }), x, 2.92, 0, ry);
  doorSign('Sala biliardo →', '#ff5fd8', 6.88, -Math.PI / 2);
  doorSign('← Sala arcade', '#3ee7ff', -6.88, Math.PI / 2);
  doorSign('← Atrio', '#ffd23f', 7.12, Math.PI / 2);
  doorSign('Atrio →', '#ffd23f', -7.12, -Math.PI / 2);

  // ========== SALA BILIARDO (x 7…19): i tavoli veri del gioco ==========
  const pools = [];
  const addTable = (variant, cloth, x, z) => {
    const game = E.newGame(variant, [{ name: 'A' }, { name: 'B' }]);
    const T = E.tableOf(game);
    const holder = new THREE.Group(); holder.position.set(x, 0.78, z); scene.add(holder);
    // il disegno del tavolo è quello di public/biliardo/scene3d.js, messo in questa stanza
    const view = { tableGroup: new THREE.Group(), ballGroup: new THREE.Group(), scene: holder, lamp: { scale: {} } };
    holder.add(view.tableGroup, view.ballGroup);
    Table3D.prototype.setTable.call(view, T, cloth);
    Table3D.prototype.setBalls.call(view, game.balls.map((b) => ({ id: b.id, r: b.r, look: E.ballLook(game, b) })));
    Table3D.prototype.syncBalls.call(view, game.balls, 0, new Map());
    if (game.pins) Table3D.prototype.setPins.call(view, game.pins);
    const hx = T.L + T.cush + T.rail, hz = T.W + T.cush + T.rail;
    solid(x - hx, x + hx, z - hz, z + hz);
    spots.push({ x, z, hx, hz, pad: 0.85, label: 'Biliardo', where: 'Sala biliardo', act: () => app.open('biliardo') });
    // lampada sopra il tavolo
    const lampW = hx * 1.6;
    box(lampW, 0.1, 0.44, std('#1d2a22', 0.35, 0.7), x, 2.25, z);
    const pan = plane(lampW - 0.1, 0.34, glow('#fff3dc', 2.2), x, 2.198, z, 0, Math.PI / 2);
    pan.rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) box(0.01, H - 2.25, 0.01, std('#b08d57', 0.3, 1), x + sx * lampW * 0.4, (H + 2.25) / 2, z);
    for (const lx of [-0.55, 0.55]) {
      const sp = new THREE.SpotLight('#fff2df', 9, 4, Math.PI / 3.6, 0.7, 1.3);
      sp.position.set(x + lx * hx, 2.15, z); sp.target.position.set(x + lx * hx, 0.78, z); scene.add(sp, sp.target);
    }
    pools.push(view);
  };
  addTable('otto', CLOTHS.verde.c, 13, -2.6);
  addTable('italiana', CLOTHS.blu.c, 13, 2.7);
  point('#ff2bd6', 7, 9, 2.6, -5.2, 10); point('#22d3ee', 7, 18, 2.6, 0, 10); point('#8b5cf6', 6, 9, 2.6, 5.2, 10);
  plane(3.2, 0.8, new THREE.MeshBasicMaterial({ map: neonText('Biliardo', '#ff3fd8', 1024, 256, 'bold 150px "Brush Script MT", "Segoe Script", cursive'), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }), 13, 2.6, -5.99);
  plane(0.7, 0.7, new THREE.MeshBasicMaterial({ map: neonText('8', '#ffd23f', 256, 256, 'bold 190px Arial, sans-serif'), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }), 15.8, 2.6, -5.99);
  // strisce LED, rastrelliera delle stecche, jukebox
  for (const [c, z] of [['#ff2bd6', -5.96], ['#8b5cf6', 5.96]]) box(11.8, 0.03, 0.03, glow(c, 3), 13, H - 0.12, z);
  box(0.03, 0.03, 11.8, glow('#22d3ee', 3), 18.96, H - 0.12, 0);
  const rack = new THREE.Group();
  box(0.05, 1.3, 1.3, std('#3b1608', 0.5), 0, 1.4, 0, rack);
  const cueM = std('#d8b77f', 0.4);
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 1.45, 8), cueM); c.position.set(-0.05, 0.98, -0.55 + i * 0.18); rack.add(c); }
  rack.position.set(18.95, 0, 0); scene.add(rack);
  const jb = new THREE.Group();
  box(0.9, 1.4, 0.55, std('#3a0d22', 0.4, 0.3), 0, 0.7, 0, jb);
  ['#ff2bd6', '#ffd23f', '#22d3ee'].forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.06, 0.014, 8, 32, Math.PI), glow(c, 3)); t.position.set(0, 1.4, 0.28); jb.add(t); });
  jb.position.set(17.9, 0, -5.55); scene.add(jb); solid(17.4, 18.4, -6, -5.2);

  // ========== SALA ARCADE (x -19…-7) ==========
  const avail = new Set(app.games ? app.games() : ARCADE.map((a) => a[0]));
  const list = ARCADE.filter(([k]) => avail.has(k));
  const cabinet = (key, title, color, x, z, ry) => {
    const g = new THREE.Group();
    const c = new THREE.Color(color), hsl = {}; c.getHSL(hsl);
    const bodyM = std(new THREE.Color().setHSL(hsl.h, 0.5, 0.13), 0.5);
    box(0.8, 1.9, 0.75, bodyM, 0, 0.95, 0, g);
    // fianchi colorati
    for (const sx of [-1, 1]) box(0.02, 1.7, 0.6, glow(color, 0.9), sx * 0.41, 1.0, 0, g);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.47), new THREE.MeshBasicMaterial({ map: cabinetScreen(title, color), color: new THREE.Color(1.5, 1.5, 1.5) }));
    scr.position.set(0, 1.36, 0.385); scr.rotation.x = -0.12; g.add(scr);
    const mq = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.2), new THREE.MeshBasicMaterial({ map: neonText(title, color, 768, 208, `bold ${title.length > 12 ? 92 : 120}px "Arial Black", Arial, sans-serif`), transparent: true, color: new THREE.Color(1.8, 1.8, 1.8) }));
    mq.position.set(0, 1.78, 0.385); g.add(mq);
    const pan = box(0.76, 0.06, 0.3, std('#111', 0.5), 0, 1.0, 0.48, g); pan.rotation.x = 0.28;
    const stickM = std('#e23', 0.3);
    const knobS = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), stickM); knobS.position.set(-0.18, 1.1, 0.48); g.add(knobS);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), glow(['#ffd23f', '#22d3ee', '#ff2bd6'][i], 1.5)); b.position.set(0.05 + i * 0.09, 1.065, 0.47); b.rotation.x = 0.28; g.add(b); }
    g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const along = Math.abs(Math.sin(ry)) > 0.5;
    if (along) solid(x - 0.4, x + 0.4, z - 0.42, z + 0.42); else solid(x - 0.42, x + 0.42, z - 0.4, z + 0.4);
    const fx = x + Math.sin(ry) * 0.75, fz = z + Math.cos(ry) * 0.75;
    spots.push({ x: fx, z: fz, hx: 0.2, hz: 0.2, pad: 0.6, label: title, where: 'Sala arcade', act: () => app.open(key), mq });
  };
  // in fila lungo le pareti, rivolti verso il centro della sala
  const north = list.slice(0, 4), south = list.slice(4, 8), west = list.slice(8);
  north.forEach(([k, t, c], i) => cabinet(k, t, c, -9.2 - i * 1.15 - (i > 1 ? 1.8 : 0), -5.6, 0));
  south.forEach(([k, t, c], i) => cabinet(k, t, c, -9.2 - i * 1.15 - (i > 1 ? 1.8 : 0), 5.6, Math.PI));
  west.forEach(([k, t, c], i) => cabinet(k, t, c, -18.6, -0.8 + i * 1.6 - (west.length === 1 ? -0.8 : 0), Math.PI / 2));
  plane(3.4, 0.85, new THREE.MeshBasicMaterial({ map: neonText('ARCADE', '#3ee7ff'), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }), -18.98, 2.75, 0, Math.PI / 2);
  point('#a855f7', 7, -13, 2.8, 0, 11); point('#22d3ee', 5, -17, 2.4, -4, 8); point('#ff2bd6', 5, -17, 2.4, 4, 8); point('#ffb347', 4, -9, 2.4, 0, 8);
  for (const [c, z] of [['#22d3ee', -5.96], ['#ff2bd6', 5.96]]) box(11.8, 0.03, 0.03, glow(c, 3), -13, H - 0.12, z);

  // ========== il personaggio ==========
  const me = makeCharacter(readAppearance());
  scene.add(me.root);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);
  let tag = null, tagName = '';
  const setTag = () => {
    const n = (app.me && app.me()?.name) || '';
    if (n === tagName) return;
    tagName = n;
    if (tag) { me.root.remove(tag); tag.material.map.dispose(); tag.material.dispose(); }
    tag = null;
    if (!n) return;
    tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTag(n.slice(0, 22)), depthWrite: false, transparent: true }));
    tag.scale.set(1.1, 0.21, 1); tag.position.y = 1.95; me.root.add(tag);
  };
  // anello che indica cosa si può aprire
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf4a').multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

  const pos = { x: 0, z: 1.8 }, cam = { yaw: 0, pitch: 0.42, dist: 4.6 };
  let heading = 0, near = null, last = 0, t = 0, raf = 0, active = false, moving = 0;
  const ray = new THREE.Raycaster(), tmp = new THREE.Vector3(), tgt = new THREE.Vector3();

  // ---------- comandi ----------
  const keys = new Set();
  const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
  const drags = new Map();
  let pinch = 0;
  const onKey = (e) => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      if ((k === 'e' || k === 'enter') && near) { e.preventDefault(); launch(near); return; }
      keys.add(k);
    } else keys.delete(k);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  addEventListener('blur', () => keys.clear());
  host.addEventListener('pointerdown', (e) => {
    if (!active) return;
    const r = stick.getBoundingClientRect();
    const inStick = touch && e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.45 && joy.id === null;
    try { host.setPointerCapture(e.pointerId); } catch (err) { /* puntatore finto */ }
    if (inStick) {
      joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
      moveJoy(e);
    } else drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const moveJoy = (e) => {
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.x = dx / max; joy.y = dy / max;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  host.addEventListener('pointermove', (e) => {
    if (e.pointerId === joy.id) return moveJoy(e);
    const d = drags.get(e.pointerId);
    if (!d) return;
    if (drags.size === 2) {
      const [a, b] = [...drags.values()];
      d.x = e.clientX; d.y = e.clientY;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.dist = Math.max(1.8, Math.min(9, cam.dist * (pinch / dist)));
      pinch = dist;
      return;
    }
    const k = e.pointerType === 'mouse' ? 0.006 : 0.008;
    cam.yaw -= (e.clientX - d.x) * k;
    cam.pitch = Math.max(0.08, Math.min(1.25, cam.pitch + (e.clientY - d.y) * k * 0.7));
    d.x = e.clientX; d.y = e.clientY;
  });
  const up = (e) => {
    if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
    drags.delete(e.pointerId);
    if (drags.size < 2) pinch = 0;
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) host.addEventListener(ev, up);
  host.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(1.8, Math.min(9, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  host.addEventListener('contextmenu', (e) => e.preventDefault());
  actB.onclick = () => near && launch(near);
  $('.l3d-exit').onclick = () => { hide(); app.exit && app.exit(); };

  // ---------- movimento e collisioni ----------
  function collide(p) {
    for (let pass = 0; pass < 2; pass++) for (const b of colliders) {
      const cx = Math.max(b.x0, Math.min(b.x1, p.x)), cz = Math.max(b.z0, Math.min(b.z1, p.z));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * R; p.z = cz + (dz / d) * R; }
      else {
        // dentro la scatola: fuori dal lato più vicino
        const o = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        p.x += o[1] * (o[0] + R); p.z += o[2] * (o[0] + R);
      }
    }
  }
  const rectDist = (s, x, z) => Math.hypot(Math.max(0, Math.abs(x - s.x) - s.hx), Math.max(0, Math.abs(z - s.z) - s.hz));
  function step(dt) {
    let ix = 0, iz = 0;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (joy.id !== null) { ix += joy.x; iz += joy.y; }
    const mag = Math.min(1, Math.hypot(ix, iz));
    let speed = 0;
    if (mag > 0.12) {
      // avanti = lontano dalla telecamera
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      const n = Math.hypot(ix, iz);
      const dx = ((ix * c + iz * s) / n) * mag, dz = ((-ix * s + iz * c) / n) * mag;
      speed = SPEED * mag;
      pos.x += dx * SPEED * dt; pos.z += dz * SPEED * dt;
      collide(pos);
      const want = Math.atan2(-dx, -dz);
      let d = want - heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      heading += d * Math.min(1, dt * 12);
      if (hint.style.opacity !== '0' && t > 1.5) hint.style.opacity = '0';
    }
    moving += (speed - moving) * Math.min(1, dt * 10);
    me.root.position.x = pos.x; me.root.position.z = pos.z; me.root.rotation.y = heading;
    animateCharacter(me, moving, dt, t);
    blob.position.set(pos.x, 0.008, pos.z);
    // cosa c'è vicino
    let best = null, bd = 1e9;
    for (const s of spots) { const d = rectDist(s, pos.x, pos.z); if (d < s.pad && d < bd) { bd = d; best = s; } }
    if (best !== near) {
      near = best;
      actB.hidden = !near;
      if (near) actB.textContent = 'Apri · ' + near.label + (touch ? '' : '  (E)');
    }
    ring.visible = !!near && !!near.mq;
    for (const s of spots) if (s.mq) s.mq.material.color.setScalar(s === near ? 2.4 + Math.sin(t * 6) * 0.5 : 1.8);
    if (near && near.mq) { ring.position.set(near.x, 0.012, near.z); ring.rotation.z = t; }
    const where = pos.x > 7 ? 'Sala biliardo' : pos.x < -7 ? 'Sala arcade' : 'Atrio';
    if (whereEl.textContent !== where) whereEl.textContent = where;
    // telecamera dietro il personaggio, che non passa i muri
    tgt.set(pos.x, 1.45, pos.z);
    tmp.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    ray.set(tgt, tmp); ray.far = cam.dist;
    const hit = ray.intersectObjects(wallMeshes, false)[0];
    const d = hit ? Math.max(0.6, hit.distance - 0.25) : cam.dist;
    camera.position.copy(tgt).addScaledVector(tmp, d);
    camera.position.y = Math.min(H - 0.15, camera.position.y);
    camera.lookAt(tgt);
  }

  function frame(now) {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; t += dt;
    step(dt);
    renderer.render(scene, camera);
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- apri, mostra, nascondi ----------
  function launch(s) {
    hide();
    s.act();
    if (app.launched) app.launched(s);
  }
  function show() {
    if (active) return;
    el.hidden = false; active = true; last = 0;
    setTag();
    // l'aspetto può essere cambiato in Settings
    const look = readAppearance();
    me.root.traverse((o) => { if (o.isMesh && o.material.userData.part) o.material.color.set(look[o.material.userData.part]); });
    resize();
    renderer.render(scene, camera);
    $('.l3d-load').hidden = true;
    raf = requestAnimationFrame(frame);
  }
  function hide() {
    active = false; cancelAnimationFrame(raf);
    keys.clear(); drags.clear(); joy.id = null; joy.x = joy.y = 0; knob.style.transform = '';
    el.hidden = true;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); last = 0; } else if (active) raf = requestAnimationFrame(frame); });
  // place(): sposta il personaggio (per le prove), near(): cosa si può aprire adesso
  const place = (x, z, yaw = cam.yaw) => { pos.x = x; pos.z = z; cam.yaw = yaw; collide(pos); };
  const api = { show, hide, place, near: () => near && near.label, where: () => ({ ...pos }), get active() { return active; }, el };
  el.lobby3d = api;
  return api;
}
