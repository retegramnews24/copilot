// Disegni dei cabinati della sala giochi (docs/cabinati.md): insegna, fianchi e pannello dei comandi, a tema per ogni
// gioco, con i suoi colori e la sua scritta. Tutto disegnato su canvas: le facce dei modelli (models/cabinati.glb)
// hanno le UV da 0 a 1.
import { canvasTex } from './textures.js';

const TAU = Math.PI * 2;
const lin = (ctx, x0, y0, x1, y1, stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};
// scritta con contorno, ombra colorata e (se c'è) un secondo colore sotto, come le insegne anni '80
function title(ctx, text, x, y, maxW, o) {
  ctx.save();
  ctx.font = o.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (o.italic) { ctx.translate(x, y); ctx.transform(1, 0, -0.18, 1, 0, 0); x = 0; y = 0; }
  const size = parseInt(/(\d+)px/.exec(o.font)[1], 10);
  if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(text, x + size * 0.06, y + size * 0.07, maxW); }
  if (o.stroke) { ctx.lineWidth = size * 0.14; ctx.lineJoin = 'round'; ctx.strokeStyle = o.stroke; ctx.strokeText(text, x, y, maxW); }
  ctx.shadowColor = o.glow || 'transparent'; ctx.shadowBlur = o.glow ? size * 0.35 : 0;
  ctx.fillStyle = Array.isArray(o.fill) ? lin(ctx, 0, y - size / 2, 0, y + size / 2, o.fill) : o.fill;
  ctx.fillText(text, x, y, maxW);
  ctx.restore();
}
const stars = (ctx, w, h, n, seed = 7) => {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.3 + r() * 0.7; ctx.fillRect(r() * w, r() * h, 1.5 + r() * 1.5, 1.5 + r() * 1.5); }
  ctx.globalAlpha = 1;
};
const grid = (ctx, w, h, step, color, lw = 1) => {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
};
const sun = (ctx, x, y, r, top, bottom, bands = 5) => {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = lin(ctx, 0, y - r, 0, y + r, [top, bottom]); ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.fillStyle = 'rgba(0,0,0,.85)';
  for (let i = 0; i < bands; i++) { const yy = y + r * (0.15 + i * 0.17); ctx.fillRect(x - r, yy, 2 * r, r * 0.03 * (i + 1)); }
  ctx.restore();
};

// ---------- un tema per gioco: colori, scritta e disegno (scena) ----------
// scene(ctx, w, h, verticale): il disegno di fondo; verticale = fianco del cabinato
const THEMES = {
  pong: {
    bg: ['#020202', '#0b0b0b'], text: 'PONG', font: 'bold 150px "Courier New", monospace', fill: '#ffffff', glow: '#9ffff6', stroke: null,
    scene(ctx, w, h, v) {
      ctx.fillStyle = '#ffffff';
      ctx.setLineDash([h * 0.04, h * 0.03]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(4, w * 0.012);
      ctx.beginPath(); if (v) { ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5); } else { ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); } ctx.stroke(); ctx.setLineDash([]);
      const pw = v ? w * 0.3 : w * 0.018, ph = v ? h * 0.025 : h * 0.42;
      if (v) { ctx.fillRect(w * 0.15, h * 0.1, pw, ph); ctx.fillRect(w * 0.55, h * 0.86, pw, ph); ctx.fillRect(w * 0.62, h * 0.33, w * 0.07, w * 0.07); }
      else { ctx.fillRect(w * 0.04, h * 0.18, pw, ph); ctx.fillRect(w * 0.942, h * 0.4, pw, ph); ctx.fillRect(w * 0.75, h * 0.25, h * 0.1, h * 0.1); }
      ctx.fillStyle = '#5bc0be'; ctx.font = `bold ${Math.round((v ? w : h) * 0.16)}px "Courier New", monospace`; ctx.textAlign = 'center';
      if (v) { ctx.fillText('3', w * 0.3, h * 0.42); ctx.fillText('5', w * 0.7, h * 0.6); }
    },
  },
  'moto-trial': {
    bg: ['#2a0d02', '#c2410c', '#fbbf24'], text: 'MOTO TRIAL', font: '900 120px "Arial Black", Arial, sans-serif', italic: true,
    fill: ['#fff7d6', '#ffb02e', '#e85d04'], stroke: '#1a0700', shadow: '#000', glow: null,
    scene(ctx, w, h, v) {
      sun(ctx, w * (v ? 0.5 : 0.82), h * (v ? 0.32 : 0.55), Math.min(w, h) * (v ? 0.32 : 0.5), '#ffe066', '#ff5d2a');
      ctx.fillStyle = '#3b1405'; ctx.beginPath(); ctx.moveTo(0, h);
      const n = 9; for (let i = 0; i <= n; i++) ctx.lineTo(w * i / n, h * (v ? 0.62 : 0.55) + Math.sin(i * 1.9) * h * 0.08 - (i % 3 === 1 ? h * 0.12 : 0));
      ctx.lineTo(w, h); ctx.fill();
      // la moto che salta
      const cx = w * (v ? 0.5 : 0.18), cy = h * (v ? 0.55 : 0.45), r = Math.min(w, h) * (v ? 0.09 : 0.17);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.35); ctx.strokeStyle = '#120400'; ctx.fillStyle = '#120400'; ctx.lineWidth = r * 0.28;
      for (const sx of [-1.25, 1.25]) { ctx.beginPath(); ctx.arc(sx * r, r * 0.4, r * 0.7, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-1.25 * r, r * 0.4); ctx.lineTo(-0.2 * r, -0.4 * r); ctx.lineTo(0.9 * r, -0.3 * r); ctx.lineTo(1.25 * r, r * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -1.3 * r, r * 0.32, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -1 * r); ctx.lineTo(-0.1 * r, -0.4 * r); ctx.lineTo(0.9 * r, -0.85 * r); ctx.stroke();
      ctx.restore();
    },
  },
  acquedotto: {
    bg: ['#04223f', '#0a5aa0', '#3fb7f0'], text: 'ACQUEDOTTO!', font: '900 112px "Trebuchet MS", "Arial Black", sans-serif',
    fill: ['#ffffff', '#bfe9ff', '#5cc8ff'], stroke: '#022646', shadow: '#011a30', glow: '#7fdcff',
    scene(ctx, w, h, v) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const s = Math.min(w, h);
      for (const [col, lw] of [['#8a5a2b', s * 0.16], ['#d99a4e', s * 0.11], ['#2f8fd8', s * 0.05]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        if (v) { ctx.moveTo(w * 0.2, 0); ctx.lineTo(w * 0.2, h * 0.3); ctx.lineTo(w * 0.8, h * 0.3); ctx.lineTo(w * 0.8, h * 0.62); ctx.lineTo(w * 0.35, h * 0.62); ctx.lineTo(w * 0.35, h * 0.82); }
        else { ctx.moveTo(0, h * 0.25); ctx.lineTo(w * 0.12, h * 0.25); ctx.lineTo(w * 0.12, h * 0.8); ctx.moveTo(w, h * 0.75); ctx.lineTo(w * 0.88, h * 0.75); ctx.lineTo(w * 0.88, h * 0.2); }
        ctx.stroke();
      }
      ctx.fillStyle = '#ffd23f';
      const drop = (x, y, r) => { ctx.beginPath(); ctx.moveTo(x, y - r * 1.6); ctx.quadraticCurveTo(x + r, y - r * 0.2, x, y + r); ctx.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.6); ctx.fill(); };
      if (v) { drop(w * 0.62, h * 0.47, s * 0.07); drop(w * 0.3, h * 0.16, s * 0.05); } else { drop(w * 0.05, h * 0.7, h * 0.08); drop(w * 0.95, h * 0.35, h * 0.08); }
    },
  },
  'lunar-lander-3d': {
    bg: ['#000005', '#0c0f2e', '#24206a'], text: 'LUNAR LANDER', font: '300 108px "Trebuchet MS", Verdana, sans-serif',
    fill: '#e6ecff', stroke: null, glow: '#9aa7ff', spacing: true,
    scene(ctx, w, h, v) {
      stars(ctx, w, h, v ? 90 : 120);
      const s = Math.min(w, h);
      // la Terra e la Luna
      ctx.fillStyle = lin(ctx, 0, 0, w, 0, ['#2a6fdb', '#3ddc84']); ctx.beginPath(); ctx.arc(w * (v ? 0.75 : 0.9), h * (v ? 0.12 : 0.25), s * (v ? 0.1 : 0.16), 0, TAU); ctx.fill();
      ctx.fillStyle = '#b9bccb'; ctx.beginPath(); ctx.ellipse(w / 2, h * (v ? 1.05 : 1.4), w * 0.8, h * (v ? 0.22 : 0.55), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8b8fa3';
      for (const [x, y, r] of [[0.2, v ? 0.92 : 0.95, 0.05], [0.6, v ? 0.95 : 0.98, 0.035], [0.8, v ? 0.9 : 0.93, 0.03]]) { ctx.beginPath(); ctx.ellipse(w * x, h * y, s * r * 1.6, s * r * 0.6, 0, 0, TAU); ctx.fill(); }
      // il modulo che scende con la fiamma
      const lx = w * (v ? 0.4 : 0.05), ly = h * (v ? 0.55 : 0.4), r = s * (v ? 0.1 : 0.13);
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(lx - r * 0.3, ly + r * 0.8); ctx.lineTo(lx, ly + r * 1.9); ctx.lineTo(lx + r * 0.3, ly + r * 0.8); ctx.fill();
      ctx.fillStyle = '#d8d8e0'; ctx.fillRect(lx - r * 0.6, ly - r * 0.2, r * 1.2, r * 0.8);
      ctx.fillStyle = '#ffd236'; ctx.beginPath(); ctx.arc(lx, ly - r * 0.35, r * 0.45, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(lx - r * 0.5, ly + r * 0.6); ctx.lineTo(lx - r * 0.95, ly + r * 1.2); ctx.moveTo(lx + r * 0.5, ly + r * 0.6); ctx.lineTo(lx + r * 0.95, ly + r * 1.2); ctx.stroke();
    },
  },
  'number-connect': {
    bg: ['#1b1030', '#3a1c5c', '#7a2e8e'], text: 'NUMBER CONNECT', font: '900 96px "Arial Black", Arial, sans-serif',
    fill: ['#fff3c4', '#ffc93c', '#f08a24'], stroke: '#2a0f3a', shadow: '#12051c', glow: null,
    scene(ctx, w, h, v) {
      const cols = ['#f0a202', '#ff6b6b', '#4da3ff', '#3ddc84', '#c77dff', '#ffd23f'], nums = [2, 4, 8, 16, 32, 64, 128, 256];
      const s = v ? w * 0.26 : h * 0.34, step = s * 1.18;
      const nx = Math.ceil(w / step), ny = Math.ceil(h / step);
      let k = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!v && j === Math.floor(ny / 2) && i > 1 && i < nx - 2) continue;
        if ((i * 7 + j * 3) % 3 === 0) continue;
        const x = i * step + (step - s) / 2, y = j * step + (step - s) / 2, c = cols[k % cols.length];
        ctx.globalAlpha = 0.85; ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, s, s, s * 0.18); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#1b1030'; ctx.font = `900 ${Math.round(s * 0.42)}px "Arial Black", Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(nums[k % nums.length]), x + s / 2, y + s / 2, s * 0.85); k++;
      }
    },
  },
  'f1-on-paper': {
    bg: ['#f7f5ec', '#efeadb'], text: 'F1 on paper!', font: 'italic bold 118px "Comic Sans MS", "Segoe Print", "Trebuchet MS", cursive',
    fill: '#1f6fd1', stroke: '#ffffff', shadow: 'rgba(0,0,0,.25)', glow: null,
    scene(ctx, w, h, v) {
      grid(ctx, w, h, Math.min(w, h) * (v ? 0.06 : 0.1), 'rgba(80,140,220,.35)', 2);
      // pista disegnata a matita e la bandiera a scacchi
      ctx.strokeStyle = '#333'; ctx.lineWidth = Math.min(w, h) * 0.02; ctx.beginPath();
      if (v) ctx.ellipse(w / 2, h * 0.45, w * 0.36, h * 0.3, 0.1, 0, TAU); else ctx.ellipse(w / 2, h / 2, w * 0.47, h * 0.4, 0, 0, TAU);
      ctx.stroke(); ctx.beginPath();
      if (v) ctx.ellipse(w / 2, h * 0.45, w * 0.2, h * 0.2, 0.1, 0, TAU); else ctx.ellipse(w / 2, h / 2, w * 0.38, h * 0.2, 0, 0, TAU);
      ctx.stroke();
      const q = Math.min(w, h) * 0.045, fx = v ? w * 0.1 : w * 0.02, fy = v ? h * 0.82 : h * 0.06;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; ctx.fillRect(fx + i * q, fy + j * q, q, q); }
      // le auto: puntini rossi, blu e verdi con la scia di mosse
      for (const [c, a] of [['#e23', 0.3], ['#1f6fd1', 1.1], ['#1fae5f', 2.0]]) {
        ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath();
        for (let k = 0; k < 5; k++) { const t = a + k * 0.22, x = w / 2 + Math.cos(t) * w * (v ? 0.28 : 0.43), y = (v ? h * 0.45 : h / 2) + Math.sin(t) * h * (v ? 0.25 : 0.3); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); ctx.fillRect(x - 5, y - 5, 10, 10); }
        ctx.stroke();
      }
    },
  },
  'golf-with-your-gay-friends': {
    bg: ['#05301a', '#0f6b35', '#4caf50'], text: 'GOLF', font: 'italic 900 150px Georgia, "Times New Roman", serif',
    fill: ['#ffffff', '#fff6c8'], stroke: '#05301a', shadow: '#021a0e', glow: null, rainbow: true,
    scene(ctx, w, h, v) {
      // arcobaleno, prato, buca con la bandierina e la pallina
      const s = Math.min(w, h), rx = w * (v ? 0.5 : 0.8), ry = h * (v ? 0.45 : 1.05), R = s * (v ? 0.45 : 0.9);
      ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = R * 0.08; ctx.beginPath(); ctx.arc(rx, ry, R - i * R * 0.08, Math.PI, 0); ctx.stroke(); });
      ctx.fillStyle = '#7fd36a'; ctx.beginPath(); ctx.ellipse(w * (v ? 0.5 : 0.2), h * (v ? 0.8 : 0.85), w * (v ? 0.55 : 0.3), h * (v ? 0.14 : 0.35), 0, 0, TAU); ctx.fill();
      const hx = w * (v ? 0.62 : 0.24), hy = h * (v ? 0.8 : 0.78);
      ctx.fillStyle = '#05140a'; ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.06, s * 0.02, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#eee'; ctx.lineWidth = s * 0.012; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - s * 0.35); ctx.stroke();
      ctx.fillStyle = '#ff2bd6'; ctx.beginPath(); ctx.moveTo(hx, hy - s * 0.35); ctx.lineTo(hx + s * 0.14, hy - s * 0.3); ctx.lineTo(hx, hy - s * 0.25); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w * (v ? 0.32 : 0.1), h * (v ? 0.84 : 0.8), s * 0.025, 0, TAU); ctx.fill();
    },
  },
  'giulio-simulator': {
    bg: ['#0c2f6b', '#1f56b5', '#3a7bd5'], text: 'GIULIO SIMULATOR', font: 'bold 92px Verdana, Arial, sans-serif',
    fill: '#ffffff', stroke: null, glow: null, sign: true,
    scene(ctx, w, h, v) {
      // laghi, montagne e il regionale che passa
      const hz = h * (v ? 0.55 : 0.62);
      ctx.fillStyle = '#9fc7ef'; ctx.fillRect(0, 0, w, hz);
      ctx.fillStyle = '#5a7fa8'; ctx.beginPath(); ctx.moveTo(0, hz);
      for (let i = 0; i <= 6; i++) ctx.lineTo(w * i / 6, hz - h * (i % 2 ? 0.25 : 0.1)); ctx.lineTo(w, hz); ctx.fill();
      ctx.fillStyle = '#ffffff'; for (let i = 1; i < 6; i += 2) { ctx.beginPath(); ctx.moveTo(w * (i - 0.25) / 6, hz - h * 0.19); ctx.lineTo(w * i / 6, hz - h * 0.25); ctx.lineTo(w * (i + 0.25) / 6, hz - h * 0.19); ctx.fill(); }
      ctx.fillStyle = '#2d6fbf'; ctx.fillRect(0, hz, w, h - hz);
      const ty = hz + (h - hz) * 0.15, th = (h - hz) * 0.35, tw = w * (v ? 0.9 : 0.5), tx = v ? w * 0.05 : w * 0.45;
      ctx.fillStyle = '#444'; ctx.fillRect(0, ty + th, w, th * 0.12);
      ctx.fillStyle = '#e9edf2'; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, [th * 0.5, th * 0.15, th * 0.15, th * 0.15]); ctx.fill();
      ctx.fillStyle = '#1aa364'; ctx.fillRect(tx, ty + th * 0.62, tw, th * 0.16);
      ctx.fillStyle = '#20324d'; for (let k = 0; k < 6; k++) ctx.fillRect(tx + tw * (0.15 + k * 0.13), ty + th * 0.18, tw * 0.09, th * 0.3);
    },
  },
  'ruggine-89': {
    bg: ['#1a0c05', '#4a2410', '#8a4a1c'], text: 'RUGGINE 89', font: '900 124px Impact, "Arial Black", sans-serif',
    fill: ['#ffd9a0', '#ffb448', '#b85a1a'], stroke: '#1a0c05', shadow: '#000', glow: '#ff7a1a',
    scene(ctx, w, h, v) {
      // deserto al tramonto, ruggine e bulloni
      sun(ctx, w * (v ? 0.5 : 0.85), h * (v ? 0.35 : 0.5), Math.min(w, h) * (v ? 0.3 : 0.45), '#ffcc55', '#d2361c', 6);
      ctx.fillStyle = '#2b1408'; ctx.fillRect(0, h * (v ? 0.62 : 0.72), w, h);
      ctx.strokeStyle = 'rgba(120,60,20,.45)'; ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) { const x = (i * 97) % w, y = (i * 53) % h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 6); ctx.stroke(); }
      ctx.fillStyle = '#c9c2b8'; const s = Math.min(w, h) * 0.03;
      for (const [x, y] of [[0.05, 0.08], [0.95, 0.08], [0.05, 0.92], [0.95, 0.92]]) { ctx.beginPath(); ctx.arc(w * x, h * y, s, 0, TAU); ctx.fill(); }
      // l'auto corazzata
      const cx = w * (v ? 0.5 : 0.2), cy = h * (v ? 0.68 : 0.7), r = Math.min(w, h) * (v ? 0.12 : 0.2);
      ctx.fillStyle = '#120804'; ctx.beginPath(); ctx.moveTo(cx - r * 1.6, cy); ctx.lineTo(cx - r * 1.2, cy - r * 0.6); ctx.lineTo(cx + r * 0.4, cy - r * 0.7); ctx.lineTo(cx + r * 1.6, cy - r * 0.2); ctx.lineTo(cx + r * 1.6, cy + r * 0.2); ctx.lineTo(cx - r * 1.6, cy + r * 0.2); ctx.fill();
      ctx.fillRect(cx + r * 0.1, cy - r * 1.05, r * 1.2, r * 0.12);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * r, cy + r * 0.25, r * 0.38, 0, TAU); ctx.fill(); }
    },
  },
  'binotto-simulator': {
    bg: ['#0b0b0b', '#1c1a12', '#3a3010'], text: 'BINOTTO SIMULATOR', font: 'italic 900 96px "Arial Black", Arial, sans-serif',
    fill: ['#fff3a0', '#ffd236', '#e0a800'], stroke: '#000', shadow: null, glow: '#ffd236',
    scene(ctx, w, h, v) {
      // fibra di carbonio, bandiera a scacchi e strisce gialle
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < w; x += 16) ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = '#ffd236'; ctx.save(); ctx.translate(w * 0.5, h * 0.5); ctx.rotate(-0.35);
      for (let k = -1; k <= 1; k++) ctx.fillRect(-w, k * h * 0.12 - h * 0.02, w * 2, h * 0.035);
      ctx.restore();
      const q = Math.min(w, h) * 0.06;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#eee'; ctx.fillRect(w - q * 5.5 + i * q, h * 0.08 + j * q, q, q); }
    },
  },
};

const generic = color => ({
  bg: ['#08080c', '#16162a'], font: '900 110px "Arial Black", Arial, sans-serif', fill: color, stroke: '#000', glow: color,
  scene(ctx, w, h) { grid(ctx, w, h, Math.min(w, h) * 0.12, color + '33', 2); },
});
const themeOf = (key, color) => THEMES[key] || generic(color);

function background(ctx, w, h, t, v) {
  ctx.fillStyle = t.bg.length > 1 ? lin(ctx, 0, 0, 0, h, v ? t.bg : t.bg) : t.bg[0];
  ctx.fillRect(0, 0, w, h);
  t.scene?.(ctx, w, h, v);
}

// insegna in alto: larga quanto il cabinato (aspetto w/h dato dal modello)
export function marqueeArt(key, label, color, aspect) {
  const W = 1024, H = Math.max(160, Math.round(W / aspect));
  return canvasTex(W, H, (ctx, w, h) => {
    const t = themeOf(key, color);
    background(ctx, w, h, t, false);
    // fascia scura dietro la scritta, così si legge sempre
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, h * 0.18, w, h * 0.64);
    const size = Math.round(h * 0.42);
    const font = t.font.replace(/\d+px/, size + 'px');
    if (t.sign) { // cartello da stazione: riquadro bianco col bordo
      ctx.fillStyle = '#ffffff'; ctx.fillRect(w * 0.06, h * 0.2, w * 0.88, h * 0.6);
      ctx.fillStyle = '#0c2f6b'; ctx.fillRect(w * 0.07, h * 0.23, w * 0.86, h * 0.54);
    }
    title(ctx, t.text || label.toUpperCase(), w / 2, h * 0.52, w * 0.86, { ...t, font });
    // filo luminoso sopra e sotto
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillRect(0, 2, w, 6); ctx.fillRect(0, h - 8, w, 6);
  });
}

// fianchi: disegno del gioco dall'alto in basso, scritta in fondo, «N GIOCATORI» in alto
export function sideArt(key, label, color, seats) {
  return canvasTex(256, 512, (ctx, w, h) => {
    const t = themeOf(key, color);
    background(ctx, w, h, t, true);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, h * 0.87, w, h * 0.13);
    const font = t.font.replace(/\d+px/, '34px');
    title(ctx, t.text || label.toUpperCase(), w / 2, h * 0.935, w * 0.9, { ...t, font });
    if (seats > 1) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, w, 44);
      ctx.fillStyle = color; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(seats + ' GIOCATORI', w / 2, 23, w * 0.9);
    }
    // bordo luminoso lungo il davanti
    ctx.fillStyle = color; ctx.fillRect(0, 0, 5, h); ctx.fillRect(w - 5, 0, 5, h);
  });
}

// pannello dei comandi: colori del gioco, numero e colore di ogni posto
export function panelArt(key, color, seats, aspect) {
  const W = 512, H = Math.max(64, Math.round(W / aspect));
  return canvasTex(W, H, (ctx, w, h) => {
    const t = themeOf(key, color);
    ctx.fillStyle = '#0d0d12'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.35; background(ctx, w, h, t, false); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,8,12,.55)'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color; ctx.fillRect(0, h - 7, w, 7);
    if (seats > 1) for (let k = 0; k < seats; k++) {
      const c = ['#ff5252', '#4da3ff', '#ffd23f', '#3ddc84'][k];
      ctx.fillStyle = c; ctx.font = `900 ${Math.round(h * 0.22)}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((k + 1) + 'P', (k + 0.5) * w / seats, h * 0.8);
    }
  });
}
