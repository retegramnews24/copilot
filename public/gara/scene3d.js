// La pista in 3D, costruita dagli stessi punti usati dalle regole.
// Mondo: x = colonna della casella, z = riga della casella, y = altezza. 1 unità = 1 casella.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { Sky } from '../vendor/three/addons/objects/Sky.js';
import { Water } from '../vendor/three/addons/objects/Water.js';
import { Lensflare, LensflareElement } from '../vendor/three/addons/objects/Lensflare.js';

// qualità grafica: alta = bagliori, acqua che riflette, erba fitta, riflesso del sole; bassa = il minimo per i telefoni lenti
export const QUALITY = {
  alta: { post: true, ratio: 2, shadow: 2048, grass: 1, water: true, flare: true },
  media: { post: false, ratio: 1.5, shadow: 1024, grass: 0.45, water: false, flare: false },
  bassa: { post: false, ratio: 1, shadow: 512, grass: 0, water: false, flare: false }
};
import { inTrack, clearance, pointInPoly } from './rules.js?v=b5d4680e25';

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

// mappa delle increspature dell'acqua, creata al momento (onde morbide sovrapposte, poi convertite in normali)
let WN = null;
function waterNormals() {
  if (WN) return WN;
  const N = 256, h = new Float32Array(N * N), r = rng(31), waves = [];
  for (let i = 0; i < 14; i++) waves.push([Math.round(1 + r() * 7), Math.round(1 + r() * 7) * (r() < 0.5 ? -1 : 1), r() * 6.28, 0.3 + r()]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0; for (const [a, b, p, w] of waves) v += Math.sin(((a * x + b * y) / N) * Math.PI * 2 + p) * w / (a + Math.abs(b));
    h[y * N + x] = v;
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)], dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    let nx = -dx * 6, ny = -dy * 6, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * N + x) * 4; img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  WN = new THREE.CanvasTexture(c); WN.wrapS = WN.wrapT = THREE.RepeatWrapping;
  return WN;
}

// erba alta mossa dal vento: migliaia di fili, il movimento lo calcola la scheda grafica
function grassMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.userData.time = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 ip = vec2(0.0);
      #endif
      float hh = position.y * position.y;
      float gust = sin(uTime * 1.3 + ip.x * 0.11 + ip.y * 0.07) * 0.5 + 0.5;
      float w = sin(uTime * 2.4 + ip.x * 0.6 + ip.y * 0.45) * (0.35 + gust * 0.65);
      transformed.x += w * hh * 1.4;
      transformed.z += w * hh * 0.5;`);
  };
  return mat;
}

// ---------- sponsor anni '80 ----------
// ogni cartellone: colore di fondo del marchio, la scritta e un carattere simile (disegnati qui, nessuna immagine scaricata)
// binottoland = logo della community (scritta BINOTTO bianca e LAND gialla); binottocorsa = club "Binotto Corsa Competizione"
const SPONSORS = ['binottoland', 'elf', 'goodyear', 'marlboro', 'binottocorsa', 'denim', 'michelin', 'parmalat', 'benetton', 'motul', 'binottoland', 'rothmans', 'camel', 'bridgestone', 'barclay', 'binottocorsa', 'jps', 'shell', 'firestone', 'tag'];
const SPONSOR_TEX = new Map();

// logo del club Binotto Corsa Competizione: la scritta ritagliata dall'avatar del club (public/gara/binotto-corsa.png)
let LOGO = null;
function withLogo(cb) {
  if (!LOGO) { LOGO = new Image(); LOGO.src = new URL('./binotto-corsa.png', import.meta.url).href; LOGO.cbs = []; LOGO.onload = () => LOGO.cbs.forEach((f) => f(LOGO)); }
  if (LOGO.complete && LOGO.naturalWidth) cb(LOGO); else LOGO.cbs.push(cb);
}
// disegna il logo al centro di una texture, il più grande possibile, sul suo rosso scuro
function paintLogo(tex, pad = 0.04) {
  withLogo((im) => {
    const c = tex.image, g = c.getContext('2d'), W = c.width, H = c.height;
    g.fillStyle = '#700b0b'; g.fillRect(0, 0, W, H);
    const s = Math.min((W * (1 - pad * 2)) / im.width, (H * (1 - pad * 2)) / im.height), w = im.width * s, h = im.height * s;
    g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    tex.needsUpdate = true;
  });
}

function fitText(c, txt, font, maxW, size) {
  let s = size;
  do { c.font = font.replace('#', s); s -= 2; } while (c.measureText(txt).width > maxW && s > 10);
}

function sponsorTex(key) {
  if (SPONSOR_TEX.has(key)) return SPONSOR_TEX.get(key);
  const W = 512, H = 122;
  const tex = texCanvas(W, H, (c) => {
    const txt = (t, color, font, size, y = H / 2 + 4, maxW = W - 60, x = W / 2) => { c.fillStyle = color; fitText(c, t, font, maxW, size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y); };
    const bg = (col) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };
    switch (key) {
      case 'binottocorsa':
        bg('#700b0b');
        break;
      case 'binottoland': {
        // logo della community: base blu scura, bandierine a scacchi, BINOTTO bianco e LAND giallo, tondo e grosso
        bg('#151826');
        c.fillStyle = '#23283d'; c.beginPath(); c.roundRect(10, 12, W - 20, H - 24, 30); c.fill();
        const chk = (x0) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#ffffff' : '#111111'; c.fillRect(x0 + i * 9, 40 + j * 9, 9, 9); } };
        chk(30); chk(W - 66);
        const font = '900 #px "Arial Rounded MT Bold", "Arial Black", system-ui, sans-serif';
        fitText(c, 'BINOTTOLAND', font, W - 150, 64);
        const wB = c.measureText('BINOTTO').width, wL = c.measureText('LAND').width, x0 = W / 2 - (wB + wL) / 2, y = H / 2 + 4;
        c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
        c.lineWidth = 9; c.strokeStyle = '#7f1d1d'; c.strokeText('BINOTTO', x0, y + 3); c.strokeStyle = '#9a3412'; c.strokeText('LAND', x0 + wB, y + 3);
        c.fillStyle = '#ffffff'; c.fillText('BINOTTO', x0, y); c.fillStyle = '#facc15'; c.fillText('LAND', x0 + wB, y);
        break;
      }
      case 'rolex': {
        // sopra il semaforo: Rolex (verde, corona e scritta oro) e il nome del gioco
        bg('#00603b');
        c.strokeStyle = '#c9a227'; c.lineWidth = 4; c.strokeRect(6, 6, W - 12, H - 12);
        const cx = 70, cy = H / 2 - 8;
        c.fillStyle = '#d4af37'; c.beginPath();
        c.moveTo(cx - 34, cy + 22); c.lineTo(cx - 40, cy - 14); c.lineTo(cx - 20, cy + 4); c.lineTo(cx - 12, cy - 22); c.lineTo(cx, cy + 2); c.lineTo(cx + 12, cy - 22); c.lineTo(cx + 20, cy + 4); c.lineTo(cx + 40, cy - 14); c.lineTo(cx + 34, cy + 22); c.closePath(); c.fill();
        for (const dx of [-40, -12, 12, 40]) { c.beginPath(); c.arc(cx + dx, cy - (Math.abs(dx) > 20 ? 16 : 25), 5, 0, 7); c.fill(); }
        c.fillRect(cx - 34, cy + 26, 68, 7);
        c.fillStyle = '#e8d48a'; c.font = 'bold 30px Georgia, "Times New Roman", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ROLEX', cx, H - 20);
        c.fillStyle = '#c9a227'; c.fillRect(150, 22, 3, H - 44);
        txt('F1 on paper!', '#ffffff', 'italic 900 #px "Arial Black", Impact, sans-serif', 64, H / 2 + 4, W - 200, 150 + (W - 150) / 2);
        break;
      }
      case 'elf':
        bg('#ffffff');
        c.fillStyle = '#e4002b'; c.beginPath(); c.ellipse(W / 2, H / 2 + 6, 150, 44, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(W / 2, H / 2 + 6, 132, 34, 0, 0, Math.PI * 2); c.fill();
        txt('elf', '#0033a0', 'italic 900 #px "Arial Black", Arial, sans-serif', 84, H / 2 + 2);
        break;
      case 'marlboro':
        bg('#ffffff');
        c.fillStyle = '#d2001f'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 30); c.lineTo(W / 2, 64); c.lineTo(0, 30); c.closePath(); c.fill();
        txt('Marlboro', '#111111', 'bold #px Georgia, "Times New Roman", serif', 46, H - 28);
        break;
      case 'denim':
        bg('#0d0d0d');
        txt('DENIM', '#ffffff', '900 #px "Arial Black", Impact, sans-serif', 74, H / 2 - 4);
        txt('for men', '#bdbdbd', 'italic #px Georgia, serif', 22, H - 16);
        break;
      case 'parmalat':
        bg('#ffffff');
        c.fillStyle = '#0050a0'; c.fillRect(0, H - 14, W, 14);
        txt('parmalat', '#0050a0', 'bold #px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif', 76, H / 2 - 4, W - 120, W / 2 + 26);
        c.fillStyle = '#e4002b'; for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; c.beginPath(); c.arc(70 + Math.cos(a) * 14, H / 2 - 4 + Math.sin(a) * 14, 9, 0, 7); c.fill(); }
        c.fillStyle = '#ffd200'; c.beginPath(); c.arc(70, H / 2 - 4, 8, 0, 7); c.fill();
        break;
      case 'benetton':
        bg('#00843d');
        txt('UNITED COLORS OF', '#ffffff', 'bold #px Arial, sans-serif', 22, 26);
        txt('BENETTON.', '#ffffff', '900 #px "Arial Narrow", "Arial Black", sans-serif', 60, H / 2 + 18);
        break;
      case 'rothmans':
        bg('#ffffff');
        c.fillStyle = '#0b2d6b'; c.fillRect(0, 0, W, 22); c.fillRect(0, H - 22, W, 22);
        c.fillStyle = '#c9a227'; c.fillRect(0, 22, W, 4); c.fillRect(0, H - 26, W, 4);
        txt('Rothmans', '#0b2d6b', 'bold #px Georgia, "Times New Roman", serif', 54, H / 2 + 2);
        break;
      case 'camel':
        bg('#f6c900');
        txt('CAMEL', '#00205b', '900 #px "Arial Black", Impact, sans-serif', 84, H / 2 + 4);
        break;
      case 'barclay':
        bg('#ffffff');
        c.fillStyle = '#c8102e'; c.fillRect(0, 0, 18, H); c.fillRect(W - 18, 0, 18, H);
        txt('Barclay', '#c8102e', 'italic bold #px Georgia, "Times New Roman", serif', 66, H / 2 + 4);
        break;
      case 'jps':
        bg('#050505');
        c.strokeStyle = '#c9a227'; c.lineWidth = 3; c.strokeRect(10, 10, W - 20, H - 20);
        txt('JPS', '#c9a227', 'bold #px Georgia, "Times New Roman", serif', 60, H / 2 - 8);
        txt('JOHN PLAYER SPECIAL', '#c9a227', '#px Georgia, "Times New Roman", serif', 20, H - 26);
        break;
      case 'shell':
        bg('#ffd100');
        c.fillStyle = '#dd1d21'; c.beginPath(); c.arc(86, H / 2 + 22, 44, Math.PI, 0); c.lineTo(110, H / 2 + 34); c.lineTo(62, H / 2 + 34); c.closePath(); c.fill();
        txt('Shell', '#dd1d21', 'bold #px Arial, Helvetica, sans-serif', 76, H / 2 + 4, W - 200, W / 2 + 50);
        break;
      case 'firestone':
        bg('#d71920');
        txt('Firestone', '#ffffff', 'italic 900 #px "Arial Black", Arial, sans-serif', 66, H / 2 + 4);
        break;
      case 'goodyear':
        // blu con la scritta gialla e il piede alato in mezzo
        bg('#0d3a8c');
        c.fillStyle = '#fdd20e'; c.fillRect(0, H - 12, W, 12);
        txt('GOOD', '#fdd20e', 'italic 900 #px "Arial Black", Impact, sans-serif', 60, H / 2 - 2, 190, W / 2 - 112);
        txt('YEAR', '#fdd20e', 'italic 900 #px "Arial Black", Impact, sans-serif', 60, H / 2 - 2, 190, W / 2 + 112);
        c.fillStyle = '#fdd20e'; c.beginPath(); c.ellipse(W / 2, H / 2 - 2, 18, 10, -0.3, 0, 7); c.fill();
        c.beginPath(); c.moveTo(W / 2 - 6, H / 2 - 10); c.lineTo(W / 2 + 22, H / 2 - 30); c.lineTo(W / 2 + 10, H / 2 - 6); c.closePath(); c.fill();
        break;
      case 'bridgestone':
        bg('#ffffff');
        c.fillStyle = '#e4002b'; c.fillRect(0, H - 14, W, 14);
        txt('BRIDGESTONE', '#111111', 'bold #px "Arial Black", Arial, sans-serif', 52, H / 2 - 2);
        break;
      case 'michelin':
        bg('#27509b');
        c.fillStyle = '#fce500'; c.fillRect(0, 0, W, 10); c.fillRect(0, H - 10, W, 10);
        txt('MICHELIN', '#fce500', 'italic 900 #px "Arial Black", Impact, sans-serif', 70, H / 2 + 2);
        break;
      case 'motul':
        bg('#e30613');
        c.fillStyle = '#ffffff'; c.fillRect(30, 18, 6, H - 36); c.fillRect(W - 36, 18, 6, H - 36);
        txt('MOTUL', '#ffffff', 'italic 900 #px "Arial Black", Impact, sans-serif', 84, H / 2 + 4);
        break;
      case 'tag':
        bg('#00573f');
        c.fillStyle = '#e4002b'; c.fillRect(W / 2 - 150, H / 2 - 4, 300, 8);
        txt('TAG', '#ffffff', 'bold #px Arial, Helvetica, sans-serif', 42, H / 2 - 28);
        txt('Heuer', '#ffffff', 'italic bold #px Georgia, serif', 44, H / 2 + 32);
        break;
    }
  });
  tex.anisotropy = 8;
  if (key === 'binottocorsa') paintLogo(tex);
  SPONSOR_TEX.set(key, tex);
  return tex;
}

function bboxOf(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
}

// frasi del pubblico (scritte come le ha volute la community)
const SHOUTS = ['MAAII!!', 'MAI PIUU!!', 'Gooodoo !', 'Grazie Ragazi !', "Guarda papa' un pollo", 'Schiacciaaa!!', 'O O O O MAX VERSTAPPEN !!', "I'm stupid", 'Steeering Wheel HEEEY!!', 'Eccocci qua!', "Tomma' vedi che li sotto si scivola", 'Dimmi tu chi ce di fari', 'SBATTEMU AH e namaffirmari !!', 'ACCENDI ACCENDII !!!'];

// bandiere delle squadre in mano al pubblico (disegnate, solo colori e nome)
const TEAMS = ['ferrari', 'lotus', 'mclaren', 'brabham', 'andreamoda', 'binottocorsa'];
const TEAM_TEX = new Map();
function teamFlagTex(key) {
  if (TEAM_TEX.has(key)) return TEAM_TEX.get(key);
  const W = 256, H = 160;
  const tex = texCanvas(W, H, (c) => {
    const txt = (t, color, font, size, y, maxW = W - 30) => { c.fillStyle = color; fitText(c, t, font, maxW, size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, W / 2, y); };
    const bg = (col) => { c.fillStyle = col; c.fillRect(0, 0, W, H); };
    switch (key) {
      case 'ferrari':
        bg('#d40000');
        c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(W / 2 - 34, 18); c.lineTo(W / 2 + 34, 18); c.lineTo(W / 2 + 34, 70); c.quadraticCurveTo(W / 2, 102, W / 2 - 34, 70); c.closePath(); c.fill();
        c.fillStyle = '#009246'; c.fillRect(W / 2 - 34, 18, 23, 7); c.fillStyle = '#fff'; c.fillRect(W / 2 - 11, 18, 22, 7); c.fillStyle = '#ce2b37'; c.fillRect(W / 2 + 11, 18, 23, 7);
        txt('F', '#111', 'italic 900 #px Georgia, serif', 48, 54);
        txt('FERRARI', '#ffd400', 'italic 900 #px "Arial Black", Impact, sans-serif', 36, 130);
        break;
      case 'lotus':
        bg('#004225');
        c.fillStyle = '#ffd100'; c.beginPath(); c.arc(W / 2, 62, 42, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#004225'; c.beginPath(); c.arc(W / 2, 62, 34, 0, Math.PI * 2); c.fill();
        txt('LOTUS', '#ffd100', 'bold #px Arial, Helvetica, sans-serif', 24, 62, 62);
        txt('TEAM LOTUS', '#ffd100', 'bold #px Arial, Helvetica, sans-serif', 30, 132);
        break;
      case 'mclaren':
        bg('#ffffff');
        c.fillStyle = '#e8002d'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.62, 0); c.lineTo(W * 0.38, H * 0.55); c.lineTo(0, H * 0.55); c.closePath(); c.fill();
        txt('McLAREN', '#111827', 'italic 900 #px "Arial Black", Impact, sans-serif', 40, 122);
        break;
      case 'brabham':
        bg('#0b3d91'); c.fillStyle = '#fff'; c.fillRect(0, H * 0.55, W, H * 0.45);
        txt('BRABHAM', '#ffffff', 'bold #px Arial, Helvetica, sans-serif', 40, 50);
        txt('RACING', '#0b3d91', 'bold #px Arial, Helvetica, sans-serif', 30, 122);
        break;
      case 'andreamoda':
        bg('#0a0a0a'); c.fillStyle = '#fff'; c.fillRect(14, 74, W - 28, 3);
        txt('ANDREA', '#ffffff', 'italic #px Georgia, serif', 46, 44);
        txt('MODA', '#ffffff', 'italic bold #px Georgia, serif', 46, 112);
        break;
      default:
        bg('#700b0b');
    }
  });
  if (key === 'binottocorsa') paintLogo(tex, 0.08);
  TEAM_TEX.set(key, tex);
  return tex;
}

// corsia box: distanze dal bordo interno (muretto, corsia, box)
const PIT = { wall: 0.9, lane0: 1.25, lane1: 3.7, g0: 3.95, g1: 6.3 };

// ora della gara: colori del cielo, luci e nebbia
const TIMES = {
  day: { skyTop: '#3f86d6', skyBot: '#a9c8de', fog: 0xa9c8de, hemiSky: 0xd6e9f7, hemiGround: 0x4a6e36, hemiI: 1.15, sunCol: 0xfff1d6, sunI: 2.4, sunDir: [0.6, 1.4, 0.45], exp: 0.92, cloud: '#ffffff', clouds: 14, env: 0.55, hills: '#5f8a6c', bloom: 0.3, sky: { turbidity: 3, rayleigh: 2.4, mie: 0.003, mieG: 0.8, gain: 0.42 } },
  sunset: { skyTop: '#2f3f86', skyBot: '#e0956a', fog: 0xd99068, hemiSky: 0xffd9bd, hemiGround: 0x5d6a40, hemiI: 1.3, sunCol: 0xffb070, sunI: 2.5, sunDir: [1.3, 0.62, 0.35], exp: 1.0, cloud: '#ffcfae', clouds: 10, env: 0.45, hills: '#6d4c68', bloom: 0.5, sky: { turbidity: 10, rayleigh: 2.8, mie: 0.006, mieG: 0.85, gain: 0.55 } },
  night: { skyTop: '#03060f', skyBot: '#1a2a4c', fog: 0x111a30, hemiSky: 0x6a84c8, hemiGround: 0x1c261c, hemiI: 0.8, sunCol: 0xb4c4ff, sunI: 0.75, sunDir: [-0.5, 1.2, -0.4], exp: 1.25, night: true, clouds: 0, env: 0.12, hills: '#141c30', bloom: 0.9 }
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
    this.flags = [];
    // riflessi: un ambiente luminoso che si specchia sulla vernice delle auto e sul metallo
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // post-produzione (qualità alta): scena in alta gamma, bagliore sulle luci forti, poi colori finali
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.5, 1.0);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.quality = 'alta';
    this.resize();
    // auto fatta in Blender (public/gara/models/auto.glb, sorgente in blender/auto.blend)
    this.ready = new GLTFLoader().loadAsync(new URL('./models/auto.glb', import.meta.url).href)
      .then((g) => { this.carProto = g.scene; })
      .catch((e) => { console.warn('auto.glb non caricata, uso l’auto semplice', e); });
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const b = this.host.getBoundingClientRect();
    if (!b.width) return;
    this.renderer.setSize(b.width, b.height, false);
    this.camera.aspect = b.width / b.height; this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(b.width, b.height);
      // il bagliore si calcola a metà risoluzione: costa meno e non si nota
      this.bloom.resolution.set(b.width / 2, b.height / 2);
    }
  }

  // cambia la qualità al volo, senza rifare la pista
  setQuality(q) {
    this.quality = QUALITY[q] ? q : 'alta';
    const Q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.ratio));
    this.resize();
    if (this.sun) { this.sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    if (this.grass) this.grass.count = Math.round(this.grass.userData.max * Q.grass);
    if (this.water && this.waterHi) { this.waterHi.visible = Q.water; this.water.visible = !Q.water; }
    if (this.flare) this.flare.visible = Q.flare;
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
    S.environment = this.envTex; S.environmentIntensity = T.env;
    this.grass = null; this.water = null; this.waterHi = null; this.flare = null;
    this.flags = []; this.fans = []; this.userMoved = false;
    this.talking = null; if (this.talkEl) this.talkEl.hidden = true;
    this.sky(T, span);
    this.mountains(T, span);
    S.add(new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI));
    const sun = new THREE.DirectionalLight(T.sunCol, T.sunI);
    const half = span / 2 + 14;
    sun.position.set(this.center.x + half * T.sunDir[0], half * T.sunDir[1], this.center.z + half * T.sunDir[2]);
    sun.target.position.set(this.center.x, 0, this.center.z);
    sun.castShadow = true;
    const Q = QUALITY[this.quality];
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    Object.assign(sun.shadow.camera, { left: -half * 1.2, right: half * 1.2, top: half * 1.2, bottom: -half * 1.2, near: 1, far: half * 4 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    S.add(sun, sun.target);
    this.sun = sun;
    this.renderPass.scene = S;
    // di giorno brillano solo le luci vere (sole, semafori), non il bianco dei cordoli
    this.bloom.strength = T.bloom; this.bloom.threshold = T.night ? 1.0 : 1.6; this.bloom.radius = 0.55;

    // prato
    const grassTex = texCanvas(256, 256, (g) => {
      g.fillStyle = '#5f9c45'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(255,255,210,.07)'; g.fillRect(0, 0, 128, 256); // strisce dell'erba tagliata
      const r = rng(5);
      for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(80,140,55,.55)' : 'rgba(120,170,80,.45)'; g.fillRect(r() * 256, r() * 256, 2, 2); }
    });
    // prato grande fino alle colline lontane (una ripetizione dell'erba ogni 13 caselle circa)
    const big = Math.max(800, (span * 3 + 200) * 1.6);
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(big / 13, big / 13);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(big, big), new THREE.MeshLambertMaterial({ map: grassTex }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(this.center.x, 0, this.center.z); ground.receiveShadow = true;
    S.add(ground);
    this.ground = ground;

    // asfalto: forma esterna con il buco interno
    const shape = new THREE.Shape(track.outer.map((p) => new THREE.Vector2(p.x, -p.y)));
    shape.holes.push(new THREE.Path(track.inner.map((p) => new THREE.Vector2(p.x, -p.y))));
    // asfalto: grana fine, chiazze più scure e qualche crepa sottile (si ripete ogni 8 caselle)
    const asphaltTex = texCanvas(256, 256, (g) => {
      g.fillStyle = '#42474e'; g.fillRect(0, 0, 256, 256);
      const r = rng(9);
      for (let i = 0; i < 14; i++) {
        const x = r() * 256, y = r() * 256, rad = 20 + r() * 50, l = g.createRadialGradient(x, y, 2, x, y, rad);
        const dark = r() < 0.6; l.addColorStop(0, dark ? 'rgba(20,22,26,.22)' : 'rgba(110,112,118,.12)'); l.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = l; g.fillRect(0, 0, 256, 256);
      }
      for (let i = 0; i < 4200; i++) { const v = 50 + r() * 55; g.fillStyle = `rgba(${v},${v},${v + 5},.55)`; g.fillRect(r() * 256, r() * 256, 1.4, 1.4); }
      g.strokeStyle = 'rgba(25,27,30,.45)'; g.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { let x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    });
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping; asphaltTex.repeat.set(0.125, 0.125);
    const ag = new THREE.ShapeGeometry(shape);
    ag.rotateX(-Math.PI / 2);
    const asphalt = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92 }));
    asphalt.position.y = 0.02; asphalt.receiveShadow = true;
    S.add(asphalt);

    // bordi: cordoli in rilievo nelle curve strette, riga bianca sui rettilinei,
    // sabbia fuori dalle curve del bordo esterno, barriere dietro
    this.gravelW = new Map();
    // corsia box: dove la rampa entra in pista la barriera interna resta aperta
    this.pit = this.pitRange(track);
    const gap = new Set(this.pit ? [...this.pit.rampA.slice(2), ...this.pit.rampB.slice(2)] : []);
    for (const [poly, inside] of [[track.outer, true], [track.inner, false]]) {
      const nor = inwardNormals(poly, inside), bend = bends(poly);
      const gw = inside ? bend.map((b) => b.out * 2.4) : bend.map(() => 0);
      this.gravelW.set(poly, gw);
      S.add(this.kerb(poly, nor, bend));
      if (inside) S.add(this.gravel(poly, nor, gw));
      S.add(this.barrier(poly, nor, gw, inside ? null : gap));
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
    // sopra il semaforo: un solo sponsor, Rolex, con il nome del gioco
    const banner = sponsorTex('rolex');
    const dark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L + 0.9, 0.5, 0.16), dark);
    beam.position.set(mx, 2.75, mz); beam.rotation.y = ang; beam.castShadow = true; gantry.add(beam);
    // pannello Rolex sopra la trave, nelle sue proporzioni (largo al massimo 6 caselle)
    const sw = Math.min(L + 0.9, 6), sh = sw / 4.2, signMat = new THREE.MeshStandardMaterial({ map: banner, roughness: 0.45, metalness: 0.1 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.14), [dark, dark, dark, dark, signMat, signMat]);
    sign.position.set(mx, 3.0 + sh / 2, mz); sign.rotation.y = ang; sign.castShadow = true; gantry.add(sign);
    // semaforo: 5 colonne di luci, spente finché non parte la gara (vedi startLights)
    this.lampMats = [];
    for (let k = -2; k <= 2; k++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a0d0d, emissive: 0x000000, emissiveIntensity: 1.6 });
      this.lampMats.push(mat);
      for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat);
        const nx = -uz * side * 0.1, nz = ux * side * 0.1;
        lamp.position.set(mx + ux * k * 0.22 + nx, 2.42, mz + uz * k * 0.22 + nz); gantry.add(lamp);
      }
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
    const dir = new THREE.Vector3(...T.sunDir).normalize();
    if (T.sky) {
      // cielo fisico (diffusione della luce nell'aria): colori veri del giorno e del tramonto, in base a dove sta il sole
      const sky = new Sky(); sky.scale.setScalar(R * 0.98); sky.position.set(c.x, 0, c.z);
      const u = sky.material.uniforms;
      u.turbidity.value = T.sky.turbidity; u.rayleigh.value = T.sky.rayleigh; u.mieCoefficient.value = T.sky.mie; u.mieDirectionalG.value = T.sky.mieG;
      u.sunPosition.value.copy(dir);
      sky.material.depthWrite = false; sky.renderOrder = -10;
      // il cielo fisico è pensato per un'esposizione molto più bassa della nostra: lo scuriamo noi
      sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', `gl_FragColor = vec4( retColor * ${T.sky.gain.toFixed(2)}, 1.0 );`);
      // gli stessi colori del cielo si riflettono su auto, metallo e acqua
      const envScene = new THREE.Scene(), skyEnv = sky.clone(); skyEnv.position.set(0, 0, 0); skyEnv.scale.setScalar(10); envScene.add(skyEnv);
      if (this.skyEnv) this.skyEnv.dispose();
      this.skyEnv = this.pmrem.fromScene(envScene);
      S.environment = this.skyEnv.texture;
      S.environmentIntensity = T.env * 0.7;
      S.add(sky);
    } else {
      const grad = texCanvas(4, 256, (g) => { const l = g.createLinearGradient(0, 0, 0, 256); l.addColorStop(0, T.skyTop); l.addColorStop(0.47, T.skyBot); l.addColorStop(1, T.skyBot); g.fillStyle = l; g.fillRect(0, 0, 4, 256); });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16), new THREE.MeshBasicMaterial({ map: grad, side: THREE.BackSide, fog: false, depthWrite: false }));
      dome.position.set(c.x, 0, c.z); dome.renderOrder = -10; S.add(dome);
    }
    // sole (o luna) nella direzione della luce
    const disc = texCanvas(128, 128, (g) => {
      const l = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      l.addColorStop(0, T.night ? 'rgba(235,240,255,1)' : 'rgba(255,250,235,1)'); l.addColorStop(0.25, T.night ? 'rgba(220,230,255,.9)' : 'rgba(255,230,170,.9)'); l.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = l; g.fillRect(0, 0, 128, 128);
    });
    // il disco è più luminoso del bianco: con la qualità alta fa il bagliore
    const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: disc, fog: false, depthWrite: false, transparent: true, color: T.night ? new THREE.Color(1.3, 1.3, 1.5) : new THREE.Color(2.4, 2.2, 1.9), opacity: T.sky ? 0.75 : 1 }));
    sunS.position.set(c.x + dir.x * R * 0.9, dir.y * R * 0.9, c.z + dir.z * R * 0.9);
    sunS.scale.setScalar(R * (T.night ? 0.12 : 0.16)); sunS.renderOrder = -9; S.add(sunS);
    // riflesso del sole nell'obiettivo (cerchi colorati quando guardi verso il sole)
    if (!T.night) {
      const ring = (a, inner) => texCanvas(128, 128, (g) => { const l = g.createRadialGradient(64, 64, inner, 64, 64, 62); l.addColorStop(0, `rgba(255,255,255,${a})`); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, 128, 128); });
      const fl = new Lensflare();
      fl.addElement(new LensflareElement(ring(0.9, 0), 380, 0, new THREE.Color(1, 0.95, 0.85)));
      fl.addElement(new LensflareElement(ring(0.35, 20), 60, 0.4, new THREE.Color(0.7, 0.9, 1)));
      fl.addElement(new LensflareElement(ring(0.3, 10), 90, 0.65, new THREE.Color(1, 0.8, 0.6)));
      fl.addElement(new LensflareElement(ring(0.25, 30), 140, 0.9, new THREE.Color(0.8, 1, 0.8)));
      fl.position.copy(sunS.position);
      fl.visible = QUALITY[this.quality].flare;
      S.add(fl); this.flare = fl;
    }
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

  // colline lontane tutto intorno all'orizzonte, sfumate nel colore del cielo
  mountains(T, span) {
    const c = this.center, R = Math.max(400, span * 3 + 200), seg = 180, r = rng(21);
    const pos = [], cols = [], idx = [], hill = new THREE.Color(T.hills), haze = new THREE.Color(T.fog);
    for (const [rad, hmul, mix] of [[R * 0.72, 1, 0.55], [R * 0.6, 0.55, 0.3]]) {
      const base = pos.length / 3, p1 = r() * 10, p2 = r() * 10;
      const top = hill.clone().lerp(haze, mix), bottom = hill.clone().lerp(haze, Math.min(1, mix + 0.3));
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const h = (R * 0.03 + R * 0.06 * (0.5 + 0.5 * Math.sin(a * 3 + p1)) * (0.55 + 0.45 * Math.sin(a * 8 + p2)) + R * 0.012 * r()) * hmul;
        pos.push(c.x + Math.cos(a) * rad, -2, c.z + Math.sin(a) * rad, c.x + Math.cos(a) * rad * 1.03, h, c.z + Math.sin(a) * rad * 1.03);
        cols.push(bottom.r, bottom.g, bottom.b, top.r, top.g, top.b);
      }
      for (let i = 0; i < seg; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -7; this.scene.add(m);
  }

  // bandiera su un'asta: il telo ondeggia col vento (si muovono i vertici, vedi frame)
  flag(x, z, h, tex, yaw, parent, w = 1.1, hh = 0.7) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 8), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.7, roughness: 0.3 }));
    pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
    const geo = new THREE.PlaneGeometry(w, hh, 16, 3); geo.translate(w / 2, 0, 0);
    const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.FrontSide, roughness: 0.8 }));
    cloth.position.y = h - hh / 2 - 0.03; cloth.castShadow = true; g.add(cloth);
    // retro del telo: stessi vertici (ondeggia insieme), immagine girata così la scritta si legge anche da dietro
    const back = new THREE.BufferGeometry();
    back.setAttribute('position', geo.attributes.position); back.setAttribute('normal', geo.attributes.normal); back.setIndex(geo.index);
    const uv = geo.attributes.uv.array.slice(); for (let i = 0; i < uv.length; i += 2) uv[i] = 1 - uv[i];
    back.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const cloth2 = new THREE.Mesh(back, new THREE.MeshStandardMaterial({ map: tex, side: THREE.BackSide, roughness: 0.8 }));
    cloth2.position.y = cloth.position.y; g.add(cloth2);
    g.position.set(x, 0, z); g.rotation.y = yaw;
    (parent || this.scene).add(g);
    this.flags.push({ geo, w, base: Float32Array.from(geo.attributes.position.array), phase: Math.random() * 6 });
    return g;
  }

  // tifoso in prima fila che sventola la bandiera con la sua immagine (public/gara/tifoso.png)
  // tex: immagine del telo; yaw: il telo va verso il +z del tifoso ruotato di yaw (cioè lontano dalla pista)
  fan(parent, x, y, z, shirt, tex = null, yaw = 0, h = 2.0, w = 1.7, hh = 1.05) {
    if (!tex) { tex = new THREE.TextureLoader().load(new URL('./tifoso.png', import.meta.url).href); tex.colorSpace = THREE.SRGBColorSpace; }
    const man = new THREE.Group(); man.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.26, 3, 8), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 })); body.position.y = 0.26; body.castShadow = true; man.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf1c27d })); head.position.y = 0.55; man.add(head);
    // braccia alzate che tengono l'asta
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 2, 6), body.material); arm.position.set(s * 0.12, 0.5, 0); arm.rotation.z = s * -0.5; man.add(arm); }
    const holder = new THREE.Group(); holder.position.set(0.05, 0.62, 0); man.add(holder);
    const f = this.flag(0, 0, h, tex, -Math.PI / 2, holder, w, hh); // il telo va verso l'esterno
    f.position.y = -0.55;
    man.position.set(x, y, z);
    parent.add(man);
    // l'asta oscilla avanti e indietro, il tifoso saltella
    this.fans = this.fans || [];
    this.fans.push({ man, holder, y, phase: Math.random() * 6 });
  }

  // tribuna (roof: con sedili colorati e tetto) o gradoni di cemento. Fronte verso -z, retro verso +z.
  // In userData.seats i posti del pubblico (coordinate locali). I tifosi con la bandiera stanno nell'ultima fila:
  // il telo va dietro, fuori dalla tribuna, sotto il tetto; le bandiere del tetto stanno sopra il tetto.
  stand(L, rows, roof, r, pc, mainFan) {
    const g = new THREE.Group(), seats = [], D = rows * 0.6, z0 = -D / 2 + 0.3, sh = roof ? 0.35 : 0.3;
    if (!this.standMats) this.standMats = {
      conc: new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.8 }),
      steps: new THREE.MeshStandardMaterial({ color: 0xb9b3a7, roughness: 0.9 }),
      seat: [0x2563eb, 0xf8fafc, 0xdc2626, 0xfacc15, 0x16a34a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
      roof: [0x2563eb, 0xdc2626, 0x16a34a, 0xf8fafc].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }))
    };
    const M = this.standMats;
    for (let i = 0; i < rows; i++) {
      const h = sh * (i + 1), s = new THREE.Mesh(new THREE.BoxGeometry(L, h, 0.6), roof ? M.conc : M.steps);
      s.position.set(0, h / 2, z0 + i * 0.6); s.castShadow = s.receiveShadow = true; g.add(s);
      if (roof) { const seat = new THREE.Mesh(new THREE.BoxGeometry(L - 0.2, 0.1, 0.22), M.seat[(i + Math.floor(r() * 5)) % 5]); seat.position.set(0, h + 0.05, z0 + i * 0.6 - 0.12); seat.receiveShadow = true; g.add(seat); }
    }
    const topY = sh * rows, topZ = z0 + (rows - 1) * 0.6;
    // tifosi con la bandiera: nell'ultima fila, lontani dai pali e tra loro
    const fx = [];
    if (mainFan) fx.push(0.8);
    const nf = mainFan ? 0 : 1 + Math.floor(r() * 2);
    for (let i = 0; i < 20 && fx.length < nf + (mainFan ? 1 : 0); i++) { const x = (r() - 0.5) * (L - 3.4); if (fx.every((o) => Math.abs(o - x) > 2.6)) fx.push(x); }
    for (let i = 0; i < rows; i++) for (let x = -L / 2 + 0.35; x <= L / 2 - 0.3; x += 0.52) {
      if (i === rows - 1 && fx.some((o) => Math.abs(o - x) < 0.45)) continue;
      if (r() < 0.9) seats.push(new THREE.Vector3(x + (r() - 0.5) * 0.1, sh * (i + 1) + 0.25, z0 + i * 0.6 - 0.05));
    }
    const fh = roof ? 2.0 : 1.8, fw = roof ? 1.4 : 1.4, fhh = roof ? 0.85 : 0.88;
    fx.forEach((x, i) => {
      const tex = mainFan && i === 0 ? null : teamFlagTex(TEAMS[Math.floor(r() * TEAMS.length)]);
      this.fan(g, x, topY, topZ, mainFan && i === 0 ? 0xdc2626 : pc[Math.floor(r() * pc.length)], tex, 0, fh, fw, fhh);
    });
    if (roof) {
      // il tetto copre tutte le file tranne l'ultima: lì stanno i tifosi con la bandiera, all'aperto
      const roofY = topY + 1.75, z1 = -D / 2 - 0.3, z2 = topZ - 0.35, rd = z2 - z1;
      const top = new THREE.Mesh(new THREE.BoxGeometry(L + 0.6, 0.12, rd), M.roof[Math.floor(r() * M.roof.length)]);
      top.position.set(0, roofY, (z1 + z2) / 2); top.castShadow = true; g.add(top);
      for (const x of [-(L / 2 - 0.1), L / 2 - 0.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, roofY, 0.15), M.conc); p.position.set(x, roofY / 2, z2 - 0.1); p.castShadow = true; g.add(p); }
      // bandiere sopra il tetto, sul bordo davanti: il telo va verso fuori, sopra il tetto
      const cols = ['#dc2626', '#facc15', '#2563eb', '#16a34a', '#ffffff'], n = Math.max(2, Math.floor(L / 3));
      for (let k = 0; k < n; k++) {
        const x = -L / 2 + 0.6 + (k * (L - 1.2)) / (n - 1), fc = cols[(k + Math.floor(r() * 5)) % 5];
        const fl = this.flag(x, z1 + 0.15, 1.3, texCanvas(8, 8, (c) => { c.fillStyle = fc; c.fillRect(0, 0, 8, 8); }), -Math.PI / 2, g, 0.9, 0.55);
        fl.position.y = roofY + 0.06;
      }
    }
    g.userData.seats = seats;
    return g;
  }

  waveFlags(now) {
    const t = now * 0.001;
    for (const fn of this.fans || []) {
      fn.holder.rotation.z = Math.sin(t * 2.2 + fn.phase) * 0.3;
      fn.man.position.y = fn.y + Math.abs(Math.sin(t * 4.4 + fn.phase)) * 0.06;
    }
    for (const f of this.flags) {
      const p = f.geo.attributes.position, b = f.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3], k = x / f.w;
        p.setZ(i, Math.sin(x * 4.2 - t * 6 + f.phase) * 0.13 * k);
        p.setY(i, b[i * 3 + 1] - k * k * 0.05 + Math.sin(x * 3 - t * 4 + f.phase) * 0.03 * k);
      }
      p.needsUpdate = true;
    }
  }

  // laghetto nel campo interno, dove c'è più spazio libero
  pond(t, S, taken, take, r) {
    let best = null;
    const bb = bboxOf(t.inner);
    for (let i = 0; i < 500; i++) {
      const x = bb.minX + r() * (bb.maxX - bb.minX), z = bb.minY + r() * (bb.maxY - bb.minY), p = { x, y: z };
      if (!pointInPoly(p, t.inner)) continue;
      let room = clearance(t, p, 16);
      for (const o of taken) room = Math.min(room, Math.hypot(o.x - x, o.z - z) - o.r);
      if (!best || room > best.room) best = { x, z, room };
    }
    if (!best || best.room < 6) return;
    const R = Math.min(best.room - 2.5, 9), ph = r() * 6;
    const shape = (k) => {
      const geo = new THREE.CircleGeometry(1, 48), pa = geo.attributes.position;
      for (let i = 1; i < pa.count; i++) { const a = Math.atan2(pa.getY(i), pa.getX(i)), s = R * k * (1 + 0.13 * Math.sin(3 * a + ph) + 0.06 * Math.sin(5 * a + ph * 2)); pa.setXY(i, Math.cos(a) * s, Math.sin(a) * s); }
      geo.rotateX(-Math.PI / 2); return geo;
    };
    const sand = new THREE.Mesh(shape(1.18), new THREE.MeshStandardMaterial({ color: 0xd8c38f, roughness: 1 })); sand.position.set(best.x, 0.012, best.z); sand.receiveShadow = true; S.add(sand);
    const water = new THREE.Mesh(shape(1), new THREE.MeshStandardMaterial({ color: this.night ? 0x0d2238 : 0x2f80b8, roughness: 0.05, metalness: 0.35 }));
    water.position.set(best.x, 0.03, best.z); water.receiveShadow = true; S.add(water);
    this.water = water;
    // acqua vera (qualità alta): riflette cielo, alberi e auto, con le onde che si muovono
    const flat = shape(1); flat.rotateX(Math.PI / 2); // Water vuole la forma nel piano verticale e la gira da sé
    const hi = new Water(flat, {
      textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(),
      sunDirection: new THREE.Vector3(...this.time.sunDir).normalize(), sunColor: this.night ? 0x8899cc : 0xffffff,
      waterColor: this.night ? 0x061426 : 0x1d5c86, distortionScale: 2.2, fog: true, alpha: 1
    });
    hi.rotation.x = -Math.PI / 2; hi.position.set(best.x, 0.035, best.z);
    hi.material.uniforms.size.value = 3;
    S.add(hi); this.waterHi = hi;
    const wq = QUALITY[this.quality].water; hi.visible = wq; water.visible = !wq;
    // ninfee
    const lily = new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.6 });
    for (let i = 0; i < 7; i++) {
      const a = r() * 6.28, d = R * (0.3 + r() * 0.5), l = new THREE.Mesh(new THREE.CircleGeometry(0.28 + r() * 0.15, 12, 0.4, 5.6), lily);
      l.rotation.x = -Math.PI / 2; l.rotation.z = r() * 6; l.position.set(best.x + Math.cos(a) * d, 0.04, best.z + Math.sin(a) * d); S.add(l);
    }
    take(best.x, best.z, R * 1.25);
  }

  // prato di fili d'erba al vento, a ciuffi, lontano da pista, laghetto e costruzioni
  grassField(t, S, taken, r) {
    const bb = t.bbox, pts = [], MAX = 14000;
    const blocked = (x, z) => taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r * 0.9);
    for (let i = 0; i < 9000 && pts.length < MAX; i++) {
      const x = bb.minX - 18 + r() * (bb.maxX - bb.minX + 36), z = bb.minY - 18 + r() * (bb.maxY - bb.minY + 36), p = { x, y: z };
      if (inTrack(t, p) || clearance(t, p, 2) < 1.3 || blocked(x, z)) continue;
      const n = 6 + Math.floor(r() * 8);
      for (let k = 0; k < n && pts.length < MAX; k++) pts.push({ x: x + (r() - 0.5) * 1.2, z: z + (r() - 0.5) * 1.2, s: 0.6 + r() * 0.8, rot: r() * 6.28, lean: (r() - 0.5) * 0.4, tint: r() });
    }
    // un filo: lama sottile che si stringe verso la punta, scura alla base e chiara in cima
    const geo = new THREE.BufferGeometry(), w = 0.035, h = 0.42;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.6, h * 0.5, 0, w * 0.6, h * 0.5, 0, 0, h, 0], 3));
    const dark = [0.16, 0.32, 0.1], mid = [0.3, 0.52, 0.18], tip = [0.55, 0.72, 0.3];
    geo.setAttribute('color', new THREE.Float32BufferAttribute([...dark, ...dark, ...mid, ...mid, ...tip], 3));
    geo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]); geo.computeVertexNormals();
    const mat = grassMaterial(), im = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    pts.forEach((u, i) => {
      e.set(u.lean, u.rot, u.lean * 0.5); m4.compose(p.set(u.x, 0, u.z), q.setFromEuler(e), s.set(u.s, u.s * (0.8 + u.tint * 0.6), u.s));
      im.setMatrixAt(i, m4); im.setColorAt(i, col.setHSL(0.22 + u.tint * 0.08, 0.35, 0.85 + u.tint * 0.3));
    });
    im.frustumCulled = false; im.receiveShadow = true;
    im.userData.max = pts.length; im.count = Math.round(pts.length * QUALITY[this.quality].grass);
    S.add(im); this.grass = im; this.grassMat = mat;
  }

  // ciuffi d'erba alta dietro le barriere
  tufts(t, S, free, r) {
    const pts = [], gwo = this.gravelW.get(t.outer) || [];
    for (let i = 0; i < 4000 && pts.length < 600; i++) {
      const k = Math.floor(r() * t.outer.length), p = t.outer[k], back = 0.55 + (gwo[k] || 0) + 0.3;
      const ang = r() * Math.PI * 2, d = back + r() * 3, x = p.x + Math.cos(ang) * d, z = p.y + Math.sin(ang) * d;
      if (free(x, z, 0.1, back - 0.1)) pts.push({ x, z, s: 0.6 + r() * 0.7, tint: r(), rot: r() * 6 });
    }
    const im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.4, 4), new THREE.MeshStandardMaterial({ roughness: 0.9 }), Math.max(1, pts.length * 3));
    im.count = pts.length * 3;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    pts.forEach((u, i) => {
      for (let k = 0; k < 3; k++) {
        e.set((k - 1) * 0.35, u.rot + k * 2.1, (k - 1) * 0.25);
        m4.compose(p.set(u.x + (k - 1) * 0.06, 0.18 * u.s, u.z), q.setFromEuler(e), s.setScalar(u.s));
        im.setMatrixAt(i * 3 + k, m4); im.setColorAt(i * 3 + k, col.setHSL(0.25 + u.tint * 0.07, 0.55, 0.28 + u.tint * 0.12));
      }
    });
    S.add(im);
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

  barrier(poly, nor, gw, gap) {
    const pos = [], n = poly.length, h = 0.45;
    for (let i = 0; i < n; i++) {
      if (gap && (gap.has(i) || gap.has((i + 1) % n))) continue;
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

    const gwo = this.gravelW.get(t.outer) || [];
    const no = t.outer.length;

    // tribune e gradoni: fuori dal bordo esterno, paralleli al bordo, con il fronte verso la pista
    const arc = [0];
    for (let k = 1; k <= no; k++) arc.push(arc[k - 1] + Math.hypot(t.outer[k % no].x - t.outer[k - 1].x, t.outer[k % no].y - t.outer[k - 1].y));
    const perim = arc[no];
    const standAt = (p, k, L, D) => {
      const a = t.outer[(k - 2 + no) % no], b = t.outer[(k + 2) % no];
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / tl, uz = (b.y - a.y) / tl;
      for (const sgn of [1, -1]) {
        const nx = -uz * sgn, nz = ux * sgn;
        if (pointInPoly({ x: p.x + nx * 1.2, y: p.y + nz * 1.2 }, t.outer)) continue; // solo verso fuori
        const minC = 1.6 + (gwo[k] || 0);
        for (let off = minC + D / 2; off < minC + D / 2 + 7; off += 0.7) {
          const x = p.x + nx * off, z = p.y + nz * off;
          let ok = true;
          // tutta l'area, compreso lo spazio dietro per le bandiere, deve essere libera
          for (let u = -L / 2; u <= L / 2 + 1e-6 && ok; u += L / 8) for (let v = -D / 2; v <= D / 2 + 1.7 && ok; v += 0.8) {
            const px = x + ux * u + nx * v, pz = z + uz * u + nz * v, q = { x: px, y: pz };
            if (pointInPoly(q, t.outer) || clearance(t, q) < minC) ok = false;
            else if (taken.some((o) => Math.hypot(o.x - px, o.z - pz) < o.r + 0.3)) ok = false;
          }
          if (ok) return { x, z, nx, nz, ux, uz };
        }
      }
      return null;
    };
    const standKs = [];
    const putStand = (p, k, roof, L, rows, mainFan) => {
      const D = rows * 0.6, s = standAt(p, k, L, D);
      if (!s) return false;
      const g = this.stand(L, rows, roof, r, pc, mainFan);
      g.position.set(s.x, 0, s.z); g.rotation.y = Math.atan2(s.nx, s.nz); // il retro (+z) va verso fuori
      S.add(g); g.updateMatrixWorld();
      for (const v of g.userData.seats) { const w = v.applyMatrix4(g.matrixWorld); people.push([w.x, w.y, w.z]); }
      const half = Math.max(1, Math.round(L / 3));
      for (let j = -half; j <= half; j++) { const u = (j / half) * (L / 2 - 0.5); take(s.x + s.ux * u + s.nx * 0.5, s.z + s.uz * u + s.nz * 0.5, D / 2 + 1.3); }
      standKs.push(k);
      return true;
    };
    // la tribuna principale: accanto alla linea
    {
      const k = f.outerSeg, a = t.outer[k];
      const ex = Math.hypot(f.a.x - a.x, f.a.y - a.y) < Math.hypot(f.b.x - a.x, f.b.y - a.y) ? f.a : f.b;
      let done = putStand(ex, k, true, 10, 4, true);
      for (let d = 2; d <= 12 && !done; d += 2) for (const s of [1, -1]) { const kk = (k + s * d + no) % no; if (!done) done = putStand(t.outer[kk], kk, true, 10, 4, true); }
    }
    // altre tribune (3 in tutto) e, se la pista è grande, qualcuna in più e i gradoni
    const wantRoof = 2 + (perim > 170 ? 1 : 0) + (perim > 300 ? 1 : 0);
    const wantSteps = perim > 110 ? Math.min(3, 1 + Math.floor((perim - 110) / 130)) : 0;
    const kinds = []; for (let i = 0; i < Math.max(wantRoof, wantSteps); i++) { if (i < wantRoof) kinds.push(true); if (i < wantSteps) kinds.push(false); }
    const gap = perim / (kinds.length + 2) * 0.7;
    for (const roof of kinds) {
      for (let tries = 0; tries < 160; tries++) {
        const k = Math.floor(r() * no);
        if (standKs.some((j) => { const d = Math.abs(arc[j] - arc[k]); return Math.min(d, perim - d) < gap; })) continue;
        const L = roof ? 8 + Math.floor(r() * 3) * 2 : 10 + Math.floor(r() * 4) * 2, rows = roof ? 4 + Math.floor(r() * 2) : 5 + Math.floor(r() * 2);
        if (putStand(t.outer[k], k, roof, L, rows, false)) break;
      }
    }


    // corsia box e box: dentro il bordo interno, lungo la linea di partenza
    if (!this.pitLane(t, S, take, r)) this.oneBox(t, S, take, free, r);

    // ponti sopra la pista, ognuno con il suo sponsor
    this.bridges(t, S, taken, take);
    // cartelloni degli sponsor anni '80, fitti lungo tutta la pista, fuori e dentro
    this.sponsorBoards(t, S, taken);

    this.water = null;
    this.pond(t, S, taken, take, r);

    // bandiere sulla linea, dal lato del bordo esterno
    const oe = Math.hypot(f.a.x - t.outer[f.outerSeg].x, f.a.y - t.outer[f.outerSeg].y) < Math.hypot(f.b.x - t.outer[f.outerSeg].x, f.b.y - t.outer[f.outerSeg].y) ? f.a : f.b;
    const ie2 = oe === f.a ? f.b : f.a, fl = Math.hypot(oe.x - ie2.x, oe.y - ie2.y), ox = (oe.x - ie2.x) / fl, oz = (oe.y - ie2.y) / fl;
    const checker = texCanvas(64, 40, (c) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { c.fillStyle = (i + j) % 2 ? '#fff' : '#111'; c.fillRect(i * 8, j * 8, 8, 8); } });
    const brand = texCanvas(128, 80, (c) => { c.fillStyle = '#facc15'; c.fillRect(0, 0, 128, 80); c.fillStyle = '#111827'; c.font = 'bold 22px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BINOTTO', 64, 30); c.fillText('LAND', 64, 54); });
    // le aste stanno in fila parallela alla pista, così un telo non tocca l'asta vicina
    [[-1.8, checker], [0, brand], [1.8, checker]].forEach(([s, tex]) => {
      const x = oe.x + ox * 2.0 - oz * s, z = oe.y + oz * 2.0 + ox * s;
      if (!pointInPoly({ x, y: z }, t.outer) && clearance(t, { x, y: z }) > 0.9) { this.flag(x, z, 3.4, tex, Math.atan2(-oz, ox), S); take(x, z, 0.5); } // il telo va verso l'esterno, lontano dalla pista
    });

    // ruota panoramica: dove c'è più spazio
    const bb = t.bbox;
    let wheel = null;
    for (let i = 0; i < 500 && !wheel; i++) {
      const x = bb.minX - 8 + r() * (bb.maxX - bb.minX + 16), z = bb.minY - 8 + r() * (bb.maxY - bb.minY + 16);
      if (free(x, z, 3.4, 3.4)) wheel = { x, z };
    }
    this.wheel = null; this.cabins = [];
    if (wheel) { S.add(this.ferrisWheel(wheel, r() * Math.PI, pc)); take(wheel.x, wheel.z, 3.6); }

    // alberi: pini a tre piani e latifoglie a ciuffi, con colori un po' diversi uno dall'altro
    const trees = [];
    for (let i = 0; i < 2600 && trees.length < 110; i++) {
      const x = bb.minX - 16 + r() * (bb.maxX - bb.minX + 32), z = bb.minY - 16 + r() * (bb.maxY - bb.minY + 32);
      const sc = 0.7 + r() * 0.9;
      if (free(x, z, 0.8 * sc, 3.4)) { trees.push({ x, z, sc, kind: r() < 0.5 ? 0 : 1, rot: r() * 6.28, tint: r() }); take(x, z, 0.8 * sc); }
    }
    S.add(this.forest(trees, r));

    // cespugli e fiori nei prati
    const bushes = [], flowers = [];
    for (let i = 0; i < 1500 && bushes.length < 120; i++) {
      const x = bb.minX - 12 + r() * (bb.maxX - bb.minX + 24), z = bb.minY - 12 + r() * (bb.maxY - bb.minY + 24);
      if (free(x, z, 0.4, 1.6)) { bushes.push({ x, z, s: 0.25 + r() * 0.3, tint: r() }); take(x, z, 0.4); }
    }
    for (let i = 0; i < 1500 && flowers.length < 70; i++) {
      const x = bb.minX - 10 + r() * (bb.maxX - bb.minX + 20), z = bb.minY - 10 + r() * (bb.maxY - bb.minY + 20);
      if (free(x, z, 0.6, 1.4)) { flowers.push({ x, z }); take(x, z, 0.5); }
    }
    S.add(this.shrubs(bushes, flowers, r));

    // pubblico sparso lungo il bordo esterno
    const ground = [];
    for (let i = 0; i < 6000 && ground.length < 380; i++) {
      const k = Math.floor(r() * t.outer.length), p = t.outer[k];
      // sempre dietro la barriera (che nelle curve è più lontana per via della sabbia)
      const back = 0.55 + (gwo[k] || 0) + 0.45;
      const ang = r() * Math.PI * 2, d = back + r() * 2.5, x = p.x + Math.cos(ang) * d, z = p.y + Math.sin(ang) * d;
      if (free(x, z, 0.2, back - 0.2)) { ground.push([x, 0.32, z]); take(x, z, 0.25); }
    }
    // qualcuno sventola la bandiera della sua squadra: il telo va lontano dalla pista e non tocca alberi o altre bandiere
    const flagMen = [];
    for (const g of ground) {
      if (flagMen.length >= 14) { people.push(g); continue; }
      const [x, , z] = g, c0 = clearance(t, { x, y: z }, 16);
      let best = null;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang), tip = { x: x + dx * 1.4, y: z + dz * 1.4 };
        const c1 = clearance(t, tip, 16);
        if (!best || c1 > best.c1) best = { dx, dz, c1, tip };
      }
      const ok = r() < 0.12 && best.c1 > c0 + 0.8 && !inTrack(t, best.tip)
        && !flagMen.some((m) => Math.hypot(m[0] - x, m[1] - z) < 3.2)
        && !taken.some((o) => o.r > 0.3 && Math.hypot(o.x - best.tip.x, o.z - best.tip.y) < o.r + 0.4);
      if (!ok) { people.push(g); continue; }
      flagMen.push([x, z]);
      this.fan(S, x, 0.06, z, pc[Math.floor(r() * pc.length)], teamFlagTex(TEAMS[flagMen.length % TEAMS.length]), Math.atan2(best.dx, best.dz), 1.7, 1.15, 0.72);
    }
    S.add(this.crowd(people, r, pc));
    this.tufts(t, S, free, r);
    this.grassField(t, S, taken, r);
    if (this.night) this.lamps(t, S, taken);
  }

  // ---------- cartelloni degli sponsor ----------
  // come nei circuiti degli anni '80: non tutti in fila lungo la pista.
  // Nelle curve stanno di traverso, rivolti verso le auto che arrivano; sui rettilinei alcuni sono più indietro,
  // alcuni di sbieco e alcuni in alto su un'impalcatura. Sulle barriere, striscioni solo a tratti.
  sponsorBoards(t, S, taken) {
    const geo = new THREE.BoxGeometry(2.6, 0.62, 0.07), postGeo = new THREE.BoxGeometry(0.06, 1, 0.06);
    const back = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 }), postMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.5, roughness: 0.4 });
    const mats = SPONSORS.map((s) => new THREE.MeshStandardMaterial({ map: sponsorTex(s), roughness: 0.55 }));
    const R = rng(hashTrack(t) + 7);
    let k = 0;
    const board = (x, z, yaw, high) => {
      const g = new THREE.Group(), m = mats[k++ % mats.length], h = high ? 2.4 : 0.35;
      const panel = new THREE.Mesh(geo, [back, back, back, back, m, m]); panel.position.y = h + 0.31; panel.castShadow = true; panel.receiveShadow = true; g.add(panel);
      for (const s of [-1.15, 1.15]) for (const dz of high ? [-0.35, 0.35] : [0]) {
        const post = new THREE.Mesh(postGeo, postMat); post.scale.y = h + 0.1; post.position.set(s, (h + 0.1) / 2, dz); g.add(post);
      }
      if (high) for (const s of [-1.15, 1.15]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), postMat); br.position.set(s, h * 0.5, 0); br.rotation.x = 0.9; g.add(br); }
      g.position.set(x, 0, z); g.rotation.y = yaw;
      S.add(g); taken.push({ x, z, r: 1.4, board: true });
    };
    const free = (x, z, d) => !inTrack(t, { x, y: z }) && clearance(t, { x, y: z }, 3) >= d - 0.4 && !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.3);
    // direzione di gara lungo un bordo, nel punto i
    const along = (poly, sign, i) => { const n = poly.length, a = poly[(i - 2 + n) % n], b = poly[(i + 2) % n], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: ((b.x - a.x) / l) * sign, y: ((b.y - a.y) / l) * sign }; };
    const faceYaw = (f) => Math.atan2(f.x, f.y); // la faccia stampata guarda nella direzione f
    const tanYaw = (d) => -Math.atan2(d.y, d.x); // cartellone parallelo alla direzione d

    const O = t.outer, no = inwardNormals(O, true), bo = bends(O), gwo = this.gravelW.get(O) || [], n = O.length, so = t.outerSign;
    // 1) curve: all'entrata, sul lato esterno, di traverso verso chi arriva
    for (let s = 0; s < n; s++) {
      const i = (so > 0 ? s : n - s) % n, prev = (i - so + n) % n;
      if (!(bo[i].tight > 0.55 && bo[prev].tight <= 0.55)) continue;
      const j = (i + so * 6 + n) % n, d = 0.55 + (gwo[j] || 0) + 1.6, x = O[j].x - no[j].x * d, z = O[j].y - no[j].y * d;
      const come = along(O, so, (i - so * 8 + n) % n);
      if (free(x, z, d)) board(x, z, faceYaw({ x: -come.x, y: -come.y }), R() < 0.3);
    }
    // 2) rettilinei: uno ogni 7 caselle circa, ogni volta in modo diverso
    for (let i = 0; i < n; i += 14) {
      if (bo[i].tight > 0.1) continue;
      const style = R(), dir = along(O, so, i);
      const d = 0.55 + (gwo[i] || 0) + (style < 0.66 ? 1.1 + R() * 2.5 : 1.8 + R() * 1.5);
      const x = O[i].x - no[i].x * d, z = O[i].y - no[i].y * d;
      if (!free(x, z, d)) continue;
      if (style < 0.33) board(x, z, tanYaw(dir), false); // parallelo, un po' indietro
      else if (style < 0.66) board(x, z, tanYaw(dir) + (0.35 + R() * 0.3) * (R() < 0.5 ? 1 : -1), false); // di sbieco
      else board(x, z, tanYaw(dir), true); // in alto sull'impalcatura
    }
    // 3) dentro il campo: pochi, di sbieco verso chi arriva
    const I = t.inner, ni = inwardNormals(I, false), si = t.innerSign;
    for (let i = 10; i < I.length; i += 22) {
      const d = 1.4 + R() * 2, x = I[i].x - ni[i].x * d, z = I[i].y - ni[i].y * d, come = along(I, si, i);
      if (free(x, z, d)) board(x, z, faceYaw({ x: -come.x * 0.7 + ni[i].x * 0.7, y: -come.y * 0.7 + ni[i].y * 0.7 }), R() < 0.25);
    }
    // striscioni sulle barriere: a tratti (circa 3 su 10)
    this.barrierBanners(O, no, gwo, 3);
    this.barrierBanners(I, ni, [], 7, this.pit ? new Set([...this.pit.rampA, ...this.pit.rampB]) : null);
  }

  // partenza: le luci rosse si accendono una colonna alla volta, poi tutte verdi e via
  startLights(onRed) {
    const M = this.lampMats || [];
    const set = (m, col, em) => { m.color.set(col); m.emissive.set(em); };
    M.forEach((m) => set(m, 0x3a0d0d, 0x000000));
    return new Promise((res) => {
      let i = 0;
      const step = () => {
        if (i < M.length) { set(M[i], 0xff3b3b, 0xff1a1a); onRed && onRed(i); i++; setTimeout(step, 550); return; }
        setTimeout(() => { M.forEach((m) => set(m, 0x4ade80, 0x22ff66)); res(); }, 650);
      };
      setTimeout(step, 300);
    });
  }

  // ---------- ponti degli sponsor ----------
  // uno ogni 45 caselle di pista circa (da 1 a 5), sui tratti dritti e lontani dalla linea; ogni ponte ha uno sponsor suo
  bridges(t, S, taken, take) {
    const no = inwardNormals(t.outer, true), ni = inwardNormals(t.inner, false), bo = bends(t.outer), n = t.outer.length;
    let per = 0; for (let i = 0; i < n; i++) { const a = t.outer[i], b = t.outer[(i + 1) % n]; per += Math.hypot(b.x - a.x, b.y - a.y); }
    // la metà di prima: uno ogni 90 caselle circa, da 1 a 2
    const count = Math.max(1, Math.floor(Math.min(5, Math.round(per / 45)) / 2));
    const order = ['binottoland', 'binottocorsa', 'marlboro', 'shell', 'tag', 'elf', 'camel', 'parmalat', 'jps', 'firestone', 'rothmans', 'benetton', 'barclay', 'denim'];
    const fm = t.finish, k0 = fm.outerSeg, used = [];
    const steel = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.7, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
    for (let b = 0; b < count; b++) {
      // punto di partenza: diviso in parti uguali lungo il giro, poi si cerca lì vicino un tratto dritto
      let best = -1, bestS = Infinity;
      const want = (k0 + Math.round(((b + 0.5) / count) * n)) % n;
      for (let d = -20; d <= 20; d++) {
        const i = (want + d + n) % n;
        if (bo[i].tight > 0.1) continue;
        const p = t.outer[i];
        if (Math.hypot(p.x - (fm.a.x + fm.b.x) / 2, p.y - (fm.a.y + fm.b.y) / 2) < 14) continue;
        if (used.some((u) => Math.abs(u - i) < 30)) continue;
        if (Math.abs(d) < bestS) { bestS = Math.abs(d); best = i; }
      }
      if (best < 0) continue;
      // dall'altra parte della pista: il punto del bordo interno più vicino
      const po = t.outer[best];
      let j = 0, dj = Infinity;
      t.inner.forEach((q, k) => { const d = Math.hypot(q.x - po.x, q.y - po.y); if (d < dj) { dj = d; j = k; } });
      if (dj > 40) continue;
      const pi = t.inner[j];
      const A = { x: po.x - no[best].x * 1.4, y: po.y - no[best].y * 1.4 }, B = { x: pi.x - ni[j].x * 1.4, y: pi.y - ni[j].y * 1.4 };
      if (inTrack(t, A) || inTrack(t, B) || taken.some((o) => Math.hypot(o.x - A.x, o.z - A.y) < o.r + 0.6 || Math.hypot(o.x - B.x, o.z - B.y) < o.r + 0.6)) continue;
      used.push(best);
      const brand = order[b % order.length], len = Math.hypot(B.x - A.x, B.y - A.y);
      const g = new THREE.Group(), H = 3.6;
      for (const P of [A, B]) for (const s of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, H, 0.22), steel); leg.position.set(0, H / 2, s); leg.castShadow = true;
        const holder = new THREE.Group(); holder.add(leg); holder.position.set(P === A ? -len / 2 : len / 2, 0, 0); g.add(holder);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.25, 1.1), dark); beam.position.y = H + 0.05; beam.castShadow = true; g.add(beam);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.06, 1.1), steel); rail.position.y = H + 1.55; g.add(rail);
      // pannello dello sponsor sui due lati: un solo marchio, allargato su tutta la lunghezza del ponte
      const face = new THREE.MeshStandardMaterial({ map: sponsorTex(brand), roughness: 0.5 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 1.35, 0.9), [dark, dark, dark, dark, face, face]);
      panel.position.y = H + 0.85; panel.castShadow = true; g.add(panel);
      g.position.set((A.x + B.x) / 2, 0, (A.y + B.y) / 2);
      g.rotation.y = -Math.atan2(B.y - A.y, B.x - A.x);
      S.add(g);
      take(A.x, A.y, 1); take(B.x, B.y, 1);
    }
  }

  barrierBanners(poly, nor, gw, start, gap) {
    const n = poly.length, L = 2.7, mats = SPONSORS.map((s) => new THREE.MeshStandardMaterial({ map: sponsorTex(s), roughness: 0.6 }));
    const geo = new THREE.PlaneGeometry(L - 0.1, 0.36);
    let acc = 0, k = start, i0 = 0;
    for (let i = 1; i <= n; i++) {
      const a = poly[(i - 1) % n], b = poly[i % n];
      acc += Math.hypot(b.x - a.x, b.y - a.y);
      if (acc < L) continue;
      // a tratti: tre striscioni sì, sette no
      if (((k - start) % 10) >= 3 || (gap && (gap.has(i0 % n) || gap.has(i % n)))) { k++; acc = 0; i0 = i; continue; }
      // striscione tra il punto i0 e il punto i, appoggiato alla faccia della barriera
      const pa = poly[i0 % n], pb = poly[i % n], na = nor[i0 % n], nb = nor[i % n];
      const oa = 0.55 + (gw[i0 % n] || 0) - 0.03, ob = 0.55 + (gw[i % n] || 0) - 0.03;
      const ax = pa.x - na.x * oa, az = pa.y - na.y * oa, bx = pb.x - nb.x * ob, bz = pb.y - nb.y * ob;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az);
      const nx = (na.x + nb.x) / 2, nz = (na.y + nb.y) / 2;
      const m = new THREE.Mesh(len > L * 1.4 ? new THREE.PlaneGeometry(len - 0.1, 0.36) : geo, mats[k++ % mats.length]);
      m.position.set(mx, 0.24, mz);
      m.rotation.y = Math.atan2(nx, nz); // la faccia stampata guarda la pista (così la scritta si legge sempre dritta)
      m.receiveShadow = true;
      this.scene.add(m);
      acc = 0; i0 = i;
    }
  }

  // ---------- pubblico che si muove ----------
  // corpo e testa separati; saltellano piano, e di più quando passa un'auto vicino
  crowd(people, r, pc) {
    const g = new THREE.Group(), n = Math.max(1, people.length);
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.12, 0.22, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    const skin = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
    body.count = head.count = people.length;
    const col = new THREE.Color();
    people.forEach((p, i) => { body.setColorAt(i, col.set(pc[Math.floor(r() * pc.length)])); head.setColorAt(i, col.set(skin[Math.floor(r() * skin.length)])); });
    body.castShadow = true;
    g.add(body, head);
    this.crowdData = { body, head, base: people.map((p) => p.slice()), phase: people.map(() => r() * 6.28), speed: people.map(() => 5 + r() * 4), heat: people.map(() => 0) };
    this.animCrowd(0, 0);
    return g;
  }

  // ---------- spettatori che parlano ----------
  // una decina di persone del pubblico, scelte a caso; ogni tanto una dice una frase in un fumetto sopra la testa
  setTalkElement(el) { this.talkEl = el; }

  animTalk(now) {
    const C = this.crowdData, el = this.talkEl;
    if (!C || !el || !C.base.length) return;
    if (!C.talkers) {
      const pool = C.base.map((_, i) => i).sort(() => Math.random() - 0.5);
      C.talkers = pool.slice(0, Math.min(10, pool.length));
      this.talkNext = now + 2500;
    }
    const screen = (i) => {
      const [x, y, z] = C.base[i], v = new THREE.Vector3(x, y + 0.75, z).project(this.camera);
      const r = this.renderer.domElement.getBoundingClientRect();
      return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, ok: v.z < 1 && Math.abs(v.x) < 0.85 && v.y < 0.7 && v.y > -0.75 };
    };
    if (!this.talking && now > this.talkNext) {
      // qualcuno che si vede sullo schermo
      const vis = C.talkers.filter((i) => screen(i).ok);
      if (vis.length) {
        const i = vis[Math.floor(Math.random() * vis.length)];
        let line; do { line = SHOUTS[Math.floor(Math.random() * SHOUTS.length)]; } while (line === this.lastShout && SHOUTS.length > 1);
        this.lastShout = line;
        el.textContent = line; el.hidden = false;
        this.talking = { i, until: now + 3200 };
      } else this.talkNext = now + 1500;
    }
    if (this.talking) {
      const s = screen(this.talking.i);
      el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -100%)`;
      el.style.visibility = s.ok ? 'visible' : 'hidden';
      if (now > this.talking.until) { el.hidden = true; this.talking = null; this.talkNext = now + 3500 + Math.random() * 6000; }
    }
  }

  animCrowd(now, dt) {
    const C = this.crowdData;
    if (!C || !C.base.length) return;
    const m4 = new THREE.Matrix4(), cars = (this.cars || []).filter((c) => c.visible).map((c) => c.position);
    for (let i = 0; i < C.base.length; i++) {
      const [x, y, z] = C.base[i];
      // entusiasmo: sale se un'auto passa entro 7 caselle, poi si calma piano
      let near = 0;
      for (const p of cars) { const d = Math.hypot(p.x - x, p.z - z); if (d < 7) near = Math.max(near, 1 - d / 7); }
      C.heat[i] = Math.max(near, C.heat[i] - dt * 0.6);
      const amp = 0.02 + C.heat[i] * 0.16, j = Math.abs(Math.sin(now * 0.001 * C.speed[i] + C.phase[i])) * amp;
      m4.makeTranslation(x, y + j, z); C.body.setMatrixAt(i, m4);
      m4.makeTranslation(x, y + j + 0.28, z); C.head.setMatrixAt(i, m4);
    }
    C.body.instanceMatrix.needsUpdate = true; C.head.instanceMatrix.needsUpdate = true;
  }

  // ---------- alberi, cespugli, fiori ----------
  forest(trees, r) {
    const g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const pines = trees.filter((t) => !t.kind), leafy = trees.filter((t) => t.kind);
    const pineMat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), leafMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
    // pini: tre coni uno sopra l'altro
    const levels = [[0.85, 1.1, 0.85], [0.66, 0.95, 1.45], [0.45, 0.8, 1.98]];
    for (const [rad, h, y0] of levels) {
      const im = new THREE.InstancedMesh(new THREE.ConeGeometry(rad, h, 9), pineMat, Math.max(1, pines.length));
      im.count = pines.length;
      pines.forEach((t, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot); m4.compose(p.set(t.x, y0 * t.sc, t.z), q, s.setScalar(t.sc)); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHSL(0.33 + t.tint * 0.06, 0.45, 0.2 + t.tint * 0.08)); });
      im.castShadow = im.receiveShadow = true; g.add(im);
    }
    // latifoglie: tre palle di foglie per albero
    const blobs = [[0, 1.55, 0, 0.8], [0.45, 1.3, 0.2, 0.55], [-0.35, 1.35, -0.3, 0.6]];
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafMat, Math.max(1, leafy.length * 3));
    im.count = leafy.length * 3;
    leafy.forEach((t, i) => blobs.forEach(([dx, dy, dz, rr], k) => {
      const c = Math.cos(t.rot), sn = Math.sin(t.rot);
      m4.compose(p.set(t.x + (dx * c - dz * sn) * t.sc, dy * t.sc, t.z + (dx * sn + dz * c) * t.sc), q.identity(), s.setScalar(rr * t.sc));
      im.setMatrixAt(i * 3 + k, m4); im.setColorAt(i * 3 + k, col.setHSL(0.24 + t.tint * 0.1, 0.5, 0.3 + t.tint * 0.1 + k * 0.02));
    }));
    im.castShadow = im.receiveShadow = true; g.add(im);
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, 1, 7), new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.95 }), Math.max(1, trees.length));
    tr.count = trees.length;
    trees.forEach((t, i) => { m4.compose(p.set(t.x, 0.45 * t.sc, t.z), q.identity(), s.set(t.sc, t.sc * 0.9, t.sc)); tr.setMatrixAt(i, m4); });
    tr.castShadow = true; g.add(tr);
    return g;
  }

  shrubs(bushes, flowers, r) {
    const g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), Math.max(1, bushes.length * 2));
    bm.count = bushes.length * 2;
    bushes.forEach((b, i) => {
      for (let k = 0; k < 2; k++) {
        m4.compose(p.set(b.x + (k ? 0.22 : -0.1) * b.s * 2, b.s * 0.7, b.z + (k ? -0.12 : 0.1) * b.s * 2), q.identity(), s.set(b.s * (k ? 0.8 : 1), b.s * 0.75, b.s * (k ? 0.8 : 1)));
        bm.setMatrixAt(i * 2 + k, m4); bm.setColorAt(i * 2 + k, col.setHSL(0.28 + b.tint * 0.08, 0.5, 0.26 + b.tint * 0.08));
      }
    });
    bm.castShadow = bm.receiveShadow = true; g.add(bm);
    // fiori: macchie di petali colorati
    const fc = [0xfacc15, 0xf472b6, 0xffffff, 0xa78bfa, 0xf87171, 0x60a5fa];
    const per = 9, fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshStandardMaterial({ roughness: 0.6 }), Math.max(1, flowers.length * per));
    fm.count = flowers.length * per;
    flowers.forEach((f, i) => {
      const c = fc[Math.floor(r() * fc.length)];
      for (let k = 0; k < per; k++) { m4.compose(p.set(f.x + (r() - 0.5) * 0.9, 0.06, f.z + (r() - 0.5) * 0.9), q.identity(), s.setScalar(0.8 + r() * 0.6)); fm.setMatrixAt(i * per + k, m4); fm.setColorAt(i * per + k, col.set(c)); }
    });
    g.add(fm);
    return g;
  }

  // ---------- ruota panoramica ----------
  ferrisWheel(at, yaw, pc) {
    const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.7, roughness: 0.28 });
    const red = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.4 });
    const R = 2.8, H = 3.6, rot = new THREE.Group();
    for (const zz of [-0.32, 0.32]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 8, 64), steel); rim.position.z = zz; rot.add(rim);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.04, 6, 48), red); inner.position.z = zz; rot.add(inner);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 16), red); hub.rotation.x = Math.PI / 2; rot.add(hub);
    const bulbs = new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd36b, emissiveIntensity: this.night ? 2.5 : 0.25 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (const zz of [-0.32, 0.32]) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, R, 0.035), steel); sp.position.set(c * R / 2, s * R / 2, zz); sp.rotation.z = a - Math.PI / 2; rot.add(sp);
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), bulbs); b.position.set(c * R, s * R, zz * 1.25); rot.add(b);
      }
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.7), steel); tie.position.set(c * R, s * R, 0); rot.add(tie);
    }
    // cabine appese: restano dritte mentre la ruota gira
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, cab = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.5), new THREE.MeshStandardMaterial({ color: pc[i % pc.length], roughness: 0.5 })); body.position.y = -0.32; body.castShadow = true; cab.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.18, 4), new THREE.MeshStandardMaterial({ color: 0xffffff })); roof.position.y = -0.06; roof.rotation.y = Math.PI / 4; cab.add(roof);
      const hang = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), steel); hang.position.y = 0.03; cab.add(hang);
      cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); rot.add(cab); this.cabins.push(cab);
    }
    rot.position.y = H; g.add(rot);
    // gambe ad A e basamento
    for (const zz of [-0.55, 0.55]) for (const k of [-1, 1]) {
      const lg = new THREE.Mesh(new THREE.BoxGeometry(0.12, H / Math.cos(0.3) + 0.2, 0.12), steel);
      lg.position.set(k * Math.tan(0.3) * H / 2, H / 2, zz); lg.rotation.z = k * 0.3; lg.castShadow = true; g.add(lg);
    }
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), steel); axle.rotation.x = Math.PI / 2; axle.position.y = H; g.add(axle);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.8), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 })); base.position.y = 0.08; base.receiveShadow = true; g.add(base);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.6), red); booth.position.set(1.4, 0.45, 0.6); booth.castShadow = true; g.add(booth);
    g.position.set(at.x, 0, at.z); g.rotation.y = yaw;
    this.wheel = rot;
    return g;
  }

  // ---------- corsia box ----------
  // muretto, corsia d'asfalto e una fila di box colorati, che seguono il bordo interno vicino alla linea
  // dove sta la corsia box: tratto del bordo interno attorno alla linea, più le due rampe di ingresso e uscita
  // (serve prima di costruire le barriere, per lasciare l'apertura dove la corsia si collega alla pista)
  pitRange(t) {
    const n = t.inner.length, k0 = t.finish.innerSeg, nor = inwardNormals(t.inner, false);
    const fits = (k, ds) => {
      const p = t.inner[(k + n) % n], m = nor[(k + n) % n];
      return ds.every((d) => { const q = { x: p.x - m.x * d, y: p.y - m.y * d }; return pointInPoly(q, t.inner) && clearance(t, q, 8) >= d - 0.4; });
    };
    const ok = (k) => fits(k, [PIT.wall, PIT.lane1, PIT.g1]);
    // tratto valido più lungo attorno alla linea (al massimo 14 caselle per parte)
    if (!ok(k0)) return null;
    let a = k0, b = k0;
    while (b - k0 < 28 && ok(b + 1)) b++;
    while (k0 - a < 28 && ok(a - 1)) a--;
    if (b - a < 20) return null;
    const idx = []; for (let k = a; k <= b; k++) idx.push((k + n) % n);
    // rampe: dalla fine della corsia la striscia d'asfalto scende fino al bordo della pista, in 6 caselle
    const ramp = (from, dir) => {
      const out = [];
      for (let j = 0; j <= 12; j++) { const k = (from + dir * j + n * 4) % n; if (!fits(k, [PIT.lane1 * (1 - j / 12) + 0.5])) return []; out.push(k); }
      return out;
    };
    return { idx, rampA: ramp(a, -1), rampB: ramp(b, 1) };
  }

  pitLane(t, S, take, r) {
    const nor = inwardNormals(t.inner, false), OFF = PIT, pr = this.pit;
    if (!pr) return false;
    const idx = pr.idx;
    const P = (k, d, y = 0) => { const p = t.inner[k], m = nor[k]; return [p.x - m.x * d, y, p.y - m.y * d]; };
    // rampe di ingresso e uscita: solo figurative, le auto non le usano
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x4b5058, roughness: 0.9, side: THREE.DoubleSide });
    for (const ramp of [pr.rampA, pr.rampB]) {
      if (ramp.length < 2) continue;
      const pos = [], band = (j) => { const q = j / (ramp.length - 1), d0 = OFF.lane0 * (1 - q), w = (OFF.lane1 - OFF.lane0) * (1 - 0.25 * q); return [d0 - 0.1, d0 + w + 0.1]; };
      for (let j = 0; j < ramp.length - 1; j++) {
        const [a0, a1] = band(j), [b0, b1] = band(j + 1), k = ramp[j], l = ramp[j + 1];
        const A = P(k, a0, 0.023), B = P(l, b0, 0.023), C = P(k, a1, 0.023), D = P(l, b1, 0.023);
        pos.push(...A, ...B, ...C, ...C, ...B, ...D);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rampMat); m.receiveShadow = true; S.add(m);
      for (let j = 0; j < ramp.length; j += 3) { const c = P(ramp[j], (band(j)[0] + band(j)[1]) / 2); take(c[0], c[2], 1.4); }
    }
    const strip = (d0, d1, y, mat, yTop) => {
      const pos = [];
      for (let i = 0; i < idx.length - 1; i++) {
        const k = idx[i], j = idx[i + 1];
        const A = P(k, d0, y), B = P(j, d0, y), C = P(k, d1, yTop ?? y), D = P(j, d1, yTop ?? y);
        pos.push(...A, ...B, ...C, ...C, ...B, ...D);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
    };
    const conc = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.85, side: THREE.DoubleSide });
    const lane = new THREE.MeshStandardMaterial({ color: 0x4b5058, roughness: 0.9, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, side: THREE.DoubleSide });
    // corsia e righe
    S.add(strip(OFF.lane0 - 0.1, OFF.lane1 + 0.1, 0.022, lane));
    S.add(strip(OFF.lane1 - 0.08, OFF.lane1, 0.03, white));
    S.add(strip((OFF.lane0 + OFF.lane1) / 2 - 0.04, (OFF.lane0 + OFF.lane1) / 2 + 0.04, 0.03, new THREE.MeshStandardMaterial({ color: 0xfacc15, side: THREE.DoubleSide })));
    // muretto con la fascia bianca e rossa in cima
    const p0 = [], stripes = [];
    for (let i = 0; i < idx.length - 1; i++) {
      const k = idx[i], j = idx[i + 1];
      const A = P(k, OFF.wall, 0), B = P(j, OFF.wall, 0), A2 = P(k, OFF.wall, 0.55), B2 = P(j, OFF.wall, 0.55);
      p0.push(...A, ...B, ...A2, ...A2, ...B, ...B2);
      const C = P(k, OFF.wall + 0.25, 0), D = P(j, OFF.wall + 0.25, 0), C2 = P(k, OFF.wall + 0.25, 0.55), D2 = P(j, OFF.wall + 0.25, 0.55);
      p0.push(...C, ...D, ...C2, ...C2, ...D, ...D2, ...A2, ...B2, ...C2, ...C2, ...B2, ...D2);
      if (i % 2 === 0) stripes.push(...P(k, OFF.wall - 0.002, 0.42), ...P(j, OFF.wall - 0.002, 0.42), ...A2, ...A2, ...P(j, OFF.wall - 0.002, 0.42), ...B2);
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(p0, 3)); wg.computeVertexNormals();
    const wall = new THREE.Mesh(wg, conc); wall.castShadow = wall.receiveShadow = true; S.add(wall);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stripes, 3)); sg.computeVertexNormals();
    S.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xdc2626, side: THREE.DoubleSide })));
    // rete di protezione sopra il muretto, con i pali e il corrimano
    {
      const fp = [], dW = OFF.wall + 0.12;
      for (let i = 0; i < idx.length - 1; i++) {
        const k = idx[i], j = idx[i + 1];
        fp.push(...P(k, dW, 0.55), ...P(j, dW, 0.55), ...P(k, dW, 1.5), ...P(k, dW, 1.5), ...P(j, dW, 0.55), ...P(j, dW, 1.5));
      }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
      const net = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x1f2937, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      net.renderOrder = 2; S.add(net);
      const postMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.6, roughness: 0.35 });
      const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), postMat, Math.ceil(idx.length / 2) + 1);
      let pi = 0; const pm = new THREE.Matrix4();
      for (let i = 0; i < idx.length; i += 2) { const c = P(idx[i], dW, 1.02); pm.makeTranslation(c[0], c[1], c[2]); posts.setMatrixAt(pi++, pm); }
      posts.count = pi; S.add(posts);
    }
    // box: uno ogni 3,4 caselle, aperti verso la corsia, con il colore e il numero di una squadra
    const teams = ['#facc15', '#ef4444', '#2563eb', '#16a34a', '#f97316', '#9333ea', '#06b6d4', '#ec4899'];
    let acc = 0, num = 1;
    const mech = [];
    for (let i = 2; i < idx.length - 3; i++) {
      const k = idx[i], pk = t.inner[k], pp = t.inner[idx[i - 1]];
      acc += Math.hypot(pk.x - pp.x, pk.y - pp.y);
      if (acc < 3.4) continue;
      acc = 0;
      const c = P(k, (OFF.g0 + OFF.g1) / 2), m = nor[k], yaw = Math.atan2(m.x, m.y); // la facciata guarda la corsia
      const team = teams[(num - 1) % teams.length];
      S.add(this.garage(c[0], c[2], yaw, team, num));
      take(c[0], c[2], 2.2);
      // postazione della squadra al muretto: tettoia col colore del box, schermi e due ingegneri che guardano la pista
      {
        const w = P(k, OFF.wall + 0.55), booth = this.pitStand(team);
        booth.position.set(w[0], 0, w[2]); booth.rotation.y = Math.atan2(-m.x, -m.y);
        S.add(booth);
        const tx = -m.y, tz = m.x;
        for (const s of [-0.35, 0.35]) mech.push([w[0] + tx * s + m.x * -0.12, 0.3, w[2] + tz * s + m.y * -0.12, team]);
      }
      // due meccanici davanti al box
      for (const s of [-0.6, 0.6]) {
        const tx = -m.y, tz = m.x, mx = c[0] + m.x * 1.55 + tx * s, mz = c[2] + m.y * 1.55 + tz * s;
        mech.push([mx, 0.3, mz, team]);
      }
      num++;
    }
    for (let i = 0; i < idx.length; i += 4) { const c = P(idx[i], (OFF.lane0 + OFF.lane1) / 2); take(c[0], c[2], 1.6); }
    if (mech.length) {
      const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, 0.22, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), mech.length);
      const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf1c27d }), mech.length);
      const m4 = new THREE.Matrix4(), col = new THREE.Color();
      mech.forEach(([x, y, z, tc], i) => { m4.makeTranslation(x, y, z); body.setMatrixAt(i, m4); body.setColorAt(i, col.set(tc)); m4.makeTranslation(x, y + 0.27, z); head.setMatrixAt(i, m4); });
      body.castShadow = true; S.add(body, head);
    }
    void r;
    return true;
  }

  // postazione al muretto dei box (fronte verso -z, cioè verso la pista)
  pitStand(team) {
    const g = new THREE.Group();
    if (!this.pitMats) this.pitMats = {
      metal: new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.4 }),
      desk: new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 }),
      screen: new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: 0x2563eb, emissiveIntensity: 0.9, roughness: 0.3 })
    };
    const M = this.pitMats, team3 = new THREE.MeshStandardMaterial({ color: team, roughness: 0.5 });
    const box = (w, h, d, x, y, z, mat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
    box(1.4, 0.08, 0.55, 0, 0.04, 0, M.metal);
    box(1.4, 0.42, 0.16, 0, 0.29, -0.2, M.desk);
    for (const x of [-0.35, 0.35]) box(0.4, 0.24, 0.03, x, 0.66, -0.22, M.screen).rotation.x = -0.25;
    for (const x of [-0.66, 0.66]) box(0.05, 1.3, 0.05, x, 0.65, 0.22, M.metal);
    box(1.6, 0.06, 0.75, 0, 1.32, 0.02, team3);
    return g;
  }

  garage(x, z, yaw, team, num) {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 });
    const teamMat = new THREE.MeshStandardMaterial({ color: team, roughness: 0.5 });
    const W = 3.1, D = 2.3, H = 2.2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.15), wallMat); back.position.set(0, H / 2, -D / 2); g.add(back);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, H, D), wallMat); side.position.set(s * W / 2, H / 2, 0); g.add(side); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.16, D + 0.4), wallMat); roof.position.set(0, H, 0.1); g.add(roof);
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.45, 0.08), teamMat); band.position.set(0, H - 0.25, D / 2 + 0.25); g.add(band);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.15, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.6 })); floor.position.y = 0.015; g.add(floor);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, H - 0.3), dark); inside.position.set(0, H / 2 - 0.1, -D / 2 + 0.09); g.add(inside);
    // cartello con il numero e una gomma appoggiata
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.36), new THREE.MeshBasicMaterial({ map: texCanvas(96, 48, (c) => { c.fillStyle = '#111827'; c.fillRect(0, 0, 96, 48); c.fillStyle = team; c.fillRect(0, 40, 96, 8); c.fillStyle = '#fff'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(num), 48, 21); }) }));
    sign.position.set(0, H - 0.25, D / 2 + 0.3); g.add(sign);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.08, 8, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }));
    tyre.rotation.x = Math.PI / 2; tyre.position.set(W / 2 - 0.4, 0.08, D / 2 - 0.3); g.add(tyre);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, 0, z); g.rotation.y = yaw;
    return g;
  }

  // se non c'è spazio per la corsia box: un solo box vicino alla linea
  oneBox(t, S, take, free, r) {
    const f = t.finish;
    const ie = Math.hypot(f.a.x - t.inner[f.innerSeg].x, f.a.y - t.inner[f.innerSeg].y) < Math.hypot(f.b.x - t.inner[f.innerSeg].x, f.b.y - t.inner[f.innerSeg].y) ? f.a : f.b;
    for (let tries = 0; tries < 80; tries++) {
      const ang = r() * Math.PI * 2, d = 3 + tries * 0.12, x = ie.x + Math.cos(ang) * d, z = ie.y + Math.sin(ang) * d;
      if (pointInPoly({ x, y: z }, t.inner) && free(x, z, 1.8, 1)) {
        S.add(this.garage(x, z, Math.atan2(ie.x - x, ie.y - z), '#ef4444', 1));
        take(x, z, 2.2);
        return;
      }
    }
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

  // auto subito al suo posto, senza animazione (entrando in una gara online già iniziata): posizione,
  // direzione, marcia e scia degli ultimi due giri
  jumpCar(i, car) {
    const m = this.cars[i];
    if (!car.pos) return;
    m.visible = true; m.position.set(car.pos.x, 0, car.pos.y);
    m.rotation.y = Math.atan2(-car.dir.y, car.dir.x);
    this.setGear(i, car.gear);
    const lap = Math.max(1, car.progress);
    for (let k = 1; k < car.path.length; k++) if (car.path[k].lap >= lap - 1) this.addTrail(i, car.path[k - 1], car.path[k], car.path[k].lap);
    this.trailFade(i, lap);
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

  moveCar(i, from, to, aim, crash, follow = true) {
    const m = this.cars[i], yaw0 = m.rotation.y;
    let yaw1 = Math.atan2(-aim.y, aim.x);
    while (yaw1 - yaw0 > Math.PI) yaw1 -= Math.PI * 2;
    while (yaw1 - yaw0 < -Math.PI) yaw1 += Math.PI * 2;
    const len = Math.hypot(to.x - from.x, to.y - from.y), steps = Math.max(1, len);
    const dur = 260 + steps * 70, turn = yaw1 - yaw0;
    let lastE = 0, lastDust = 0;
    // la telecamera segue l'auto finché si muove (se tocchi lo schermo smette)
    if (follow && !this.userMoved) { this.follow = m; this.rig.goal = null; }
    return this.tween(dur, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      m.position.set(from.x + (to.x - from.x) * e, 0, from.y + (to.y - from.y) * e);
      m.rotation.y = yaw0 + turn * Math.min(1, k * 2.5);
      // sterzo: forte all'inizio della curva, torna dritto mentre l'auto si allinea
      const steer = Math.max(-0.5, Math.min(0.5, turn * 0.9)) * (k < 0.4 ? 1 : Math.max(0, 1 - (k - 0.4) / 0.4));
      this.rollWheels(m, (e - lastE) * len, steer);
      lastE = e;
      // polvere dietro le ruote quando si va forte
      if (len >= 4 && this.quality !== 'bassa' && e - lastDust > 0.1 && e < 0.9) { lastDust = e; this.dust(m); }
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

  // sbuffi di polvere chiara dietro le ruote posteriori
  dust(m) {
    if (!this.puffTex) this.puffTex = texCanvas(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(235,235,235,.9)'); g.addColorStop(1, 'rgba(200,200,200,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    const fx = new THREE.Group(), yaw = m.rotation.y, bx = -Math.cos(yaw), bz = Math.sin(yaw), sx = Math.sin(yaw), sz = Math.cos(yaw), parts = [];
    for (const s of [-0.22, 0.22]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, color: this.night ? 0x667080 : 0xcfc6b8, transparent: true, depthWrite: false, opacity: 0.35 }));
      sp.position.set(m.position.x + bx * 0.45 + sx * s, 0.1, m.position.z + bz * 0.45 + sz * s); sp.scale.setScalar(0.2);
      parts.push({ o: sp, v: new THREE.Vector3(bx * 0.4 + (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.2, bz * 0.4 + (Math.random() - 0.5) * 0.3), grow: 0.9 + Math.random() * 0.5, life: 0.8 + Math.random() * 0.4, smoke: true, op: 0.32 });
      fx.add(sp);
    }
    this.scene.add(fx); this.fx.push({ group: fx, parts, t: 0 });
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
        else { p.o.scale.setScalar(0.25 + k * p.grow); p.o.material.opacity = (p.op ?? 0.75) * (1 - k); p.v.multiplyScalar(0.97); }
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
      m.opacity = l >= lap ? 1 : l === lap - 1 ? 0.25 : 0;
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
  // centra la vista su un punto. Se la vista l'hai spostata tu, resta dov'è finché non premi "Centra" (force)
  focus(p, near, force) {
    if (this.userMoved && !force) return;
    this.userMoved = false;
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
        if (this.tap && this.tap.moved > 10) this.userMoved = true;
        if (this.tap && this.tap.rot) { this.rig.yaw -= dx * 0.008; this.tilt(-dy * 0.006); return; }
        this.panBy(dx, dy);
      } else if (P.size === 2 && this.pinch) {
        const [a, b] = [...P.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.userMoved = true;
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
      e.preventDefault(); this.rig.goal = null; this.userMoved = true;
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
    this.animCrowd(now, dt);
    this.animTalk(now);
    if (this.flags.length) this.waveFlags(now);
    if (this.grassMat) this.grassMat.userData.time.value = now * 0.001;
    if (this.waterHi && this.waterHi.visible) this.waterHi.material.uniforms.time.value += dt * 0.6;
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
    if (QUALITY[this.quality].post) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
