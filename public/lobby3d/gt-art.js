// Flipper "Binotto GT" (24 ore endurance, GT3 e GT4): grafica disegnata al volo, originale, niente immagini esterne
// e niente marchi veri. Coordinate del gioco come in ../flipper/physics-gt.js: x da 0 a 0,52 m, y da 0 (flipper)
// a 1,06 m.
// - paintPlayfieldGT: il piano (fibra di carbonio, livrea blu notte e lime, mappa del circuito, frecce delle tre rampe)
// - paintBackglassGT: il vetro del tabellone; il cielo segue le ore di gara (giorno, tramonto, notte coi fari, alba)
import { scorePanel } from './flipper-art.js?v=bfd8725542';

const PW = 0.52,
  PH = 1.06;
const LIME = '#c6ff1a',
  ORANGE = '#ff9a2a',
  CYAN = '#3ee7ff';

export function paintPlayfieldGT(canvas) {
  const g = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  const X = x => (x / PW) * w,
    Y = y => (1 - y / PH) * h,
    S = v => (v / PW) * w;
  // fibra di carbonio: trama a quadretti diagonali scuri
  g.fillStyle = '#0c0f15';
  g.fillRect(0, 0, w, h);
  const cell = 14;
  for (let y = 0; y < h; y += cell)
    for (let x = 0; x < w; x += cell) {
      const on = ((x / cell) | 0) % 2 === ((y / cell) | 0) % 2;
      const gr = g.createLinearGradient(x, y, x + cell, y + cell);
      gr.addColorStop(0, on ? '#1a1f29' : '#11151d');
      gr.addColorStop(1, on ? '#0d1017' : '#181d26');
      g.fillStyle = gr;
      g.fillRect(x, y, cell, cell);
    }
  // livrea: due fasce diagonali blu notte e una lama lime che attraversa il piano
  g.save();
  g.globalAlpha = 0.85;
  const band = (x0, y0, x1, y1, width, color) => {
    g.strokeStyle = color;
    g.lineWidth = S(width);
    g.beginPath();
    g.moveTo(X(x0), Y(y0));
    g.lineTo(X(x1), Y(y1));
    g.stroke();
  };
  band(-0.05, 0.25, 0.6, 0.62, 0.09, '#0b2350');
  band(-0.05, 0.36, 0.6, 0.73, 0.03, '#123a80');
  g.globalAlpha = 0.6;
  band(-0.05, 0.31, 0.6, 0.68, 0.008, LIME);
  g.restore();
  // mappa del circuito endurance (un tracciato inventato) in alto al centro, linea bianca sottile
  g.save();
  g.translate(X(0.235), Y(0.79));
  g.strokeStyle = 'rgba(255,255,255,.35)';
  g.lineWidth = S(0.004);
  g.lineJoin = 'round';
  g.beginPath();
  const track = [
    [-0.06, 0.0],
    [0.05, 0.0],
    [0.08, 0.03],
    [0.06, 0.07],
    [0.0, 0.08],
    [-0.02, 0.05],
    [-0.06, 0.06],
    [-0.09, 0.03],
    [-0.06, 0.0]
  ];
  track.forEach(([x, y], i) => (i ? g.lineTo(S(x), -S(y)) : g.moveTo(S(x), -S(y))));
  g.stroke();
  g.restore();
  // logo al centro: BINOTTO GT con il numero 24
  g.save();
  g.translate(X(0.24), Y(0.42));
  g.textAlign = 'center';
  g.font = `900 ${S(0.05)}px Impact, "Arial Black", sans-serif`;
  g.shadowColor = '#000';
  g.shadowBlur = 12;
  g.fillStyle = '#ffffff';
  g.fillText('BINOTTO', 0, 0);
  g.font = `900 ${S(0.062)}px Impact, "Arial Black", sans-serif`;
  g.fillStyle = LIME;
  g.shadowColor = LIME;
  g.shadowBlur = 16;
  g.fillText('GT', 0, S(0.058));
  g.restore();
  // tondo del numero di gara
  g.fillStyle = '#f2f2f2';
  g.beginPath();
  g.arc(X(0.4), Y(0.42), S(0.032), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.font = `900 ${S(0.036)}px Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.fillText('24', X(0.4), Y(0.42) + S(0.013));
  // frecce delle tre rampe e del box, col colore della rampa
  const arrow = (x, y, ang, len, color, label) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-ang);
    g.fillStyle = color;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(S(len), 0);
    g.lineTo(0, -S(0.02));
    g.lineTo(S(0.014), 0);
    g.lineTo(0, S(0.02));
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = '#fff';
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.font = `900 ${S(0.015)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(label, X(x), Y(y) + S(0.034));
    g.shadowBlur = 0;
  };
  arrow(0.09, 0.47, Math.PI / 2, 0.06, LIME, 'ESSE');
  arrow(0.22, 0.51, Math.PI / 2, 0.06, ORANGE, 'SOPRAELEVATA');
  arrow(0.395, 0.41, Math.PI / 2, 0.06, CYAN, 'PIT LANE');
  // box: corsia dei box tratteggiata verso la buca
  g.strokeStyle = 'rgba(62,231,255,.55)';
  g.setLineDash([S(0.01), S(0.008)]);
  g.lineWidth = S(0.004);
  g.beginPath();
  g.moveTo(X(0.06), Y(0.7));
  g.lineTo(X(0.16), Y(0.7));
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#9ff3ff';
  g.font = `900 ${S(0.016)}px system-ui, sans-serif`;
  g.fillText('BOX', X(0.11), Y(0.805));
  // corsie in alto: le gomme L · M · S
  g.font = `900 ${S(0.016)}px system-ui, sans-serif`;
  [
    ['L', '#ffffff'],
    ['M', '#ffd23f'],
    ['S', '#ff3a4a']
  ].forEach(([t, c], i) => {
    g.fillStyle = c;
    g.fillText(t, X(0.12 + i * 0.05), Y(0.855));
  });
  // bersagli: GT · 2 · 4
  g.fillStyle = '#ffe08a';
  g.font = `800 ${S(0.013)}px system-ui, sans-serif`;
  ['GT', '2', '4'].forEach((t, i) => g.fillText(t, X(0.29 + i * 0.035), Y(0.635)));
  // targhe di classe ai lati del logo
  const plate = (x, y, text, bg, fg) => {
    g.fillStyle = bg;
    g.fillRect(X(x) - S(0.03), Y(y) - S(0.012), S(0.06), S(0.024));
    g.fillStyle = fg;
    g.font = `900 ${S(0.016)}px Impact, "Arial Black", sans-serif`;
    g.fillText(text, X(x), Y(y) + S(0.006));
  };
  plate(0.07, 0.34, 'GT4', '#1f5fd6', '#fff');
  plate(0.41, 0.34, 'GT3', ORANGE, '#111');
  // griglia tra i flipper: linea di partenza con le caselle sfalsate
  g.strokeStyle = 'rgba(255,255,255,.7)';
  g.lineWidth = S(0.003);
  [
    [0.205, 0.25],
    [0.277, 0.22],
    [0.205, 0.18],
    [0.277, 0.15]
  ].forEach(([x, y]) => g.strokeRect(X(x) - S(0.022), Y(y) - S(0.012), S(0.044), S(0.024)));
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#fff' : '#111';
    g.fillRect(X(0.17 + i * 0.009), Y(0.29), S(0.009), S(0.009));
    g.fillStyle = i % 2 ? '#111' : '#fff';
    g.fillRect(X(0.17 + i * 0.009), Y(0.281), S(0.009), S(0.009));
  }
  // scritte degli inserti
  g.font = `800 ${S(0.012)}px system-ui, sans-serif`;
  g.fillStyle = '#9fe8b5';
  g.fillText('SAFETY CAR', X(0.241), Y(0.035));
  g.fillStyle = '#ffe08a';
  ['×2', '×3', '×4', '×5'].forEach((t, i) => g.fillText(t, X(0.15 + i * 0.062), Y(0.33)));
  g.fillStyle = '#ffb0ff';
  g.fillText('EXTRA', X(0.18), Y(0.685));
  g.fillText('SUPER', X(0.06), Y(0.685));
}

// cielo e luce per l'ora di gara (0 … 24): partenza di giorno, tramonto, notte, alba
function sky(hour) {
  const k = ((hour % 24) + 24) % 24;
  if (k < 7) return { top: '#3c8ce8', bottom: '#bfe3ff', night: 0, sun: '#fff3b0' };
  if (k < 11) return { top: '#3a2a78', bottom: '#ff8a4a', night: 0.3, sun: '#ff6a3a' };
  if (k < 19) return { top: '#05060f', bottom: '#1a1440', night: 1, sun: null };
  return { top: '#2d2a6e', bottom: '#ffb3c8', night: 0.4, sun: '#ffd6a0' };
}

export function paintBackglassGT(canvas, time = 0, idle = true, info = null) {
  const g = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  const hour = info?.hour ?? (idle ? (time * 0.8) % 24 : 0);
  const bucket = Math.floor(((hour % 24) + 24) % 24);
  if (canvas._bucket !== bucket) {
    canvas._bucket = bucket;
    const s = sky(hour);
    const b = (canvas._base ??= document.createElement('canvas'));
    b.width = w;
    b.height = h;
    const c = b.getContext('2d');
    const gr = c.createLinearGradient(0, 0, 0, h * 0.75);
    gr.addColorStop(0, s.top);
    gr.addColorStop(1, s.bottom);
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
    if (s.night > 0.5) {
      let seed = 3;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 140; i++) {
        c.fillStyle = `rgba(255,255,255,${rnd() * 0.8})`;
        c.fillRect(rnd() * w, rnd() * h * 0.55, 1.5, 1.5);
      }
    }
    if (s.sun) {
      c.fillStyle = s.sun;
      c.beginPath();
      c.arc(w * 0.78, h * 0.5, h * 0.09, 0, Math.PI * 2);
      c.fill();
    }
    // colline e tribune in controluce
    c.fillStyle = s.night > 0.5 ? '#07080f' : '#1d2a3a';
    c.beginPath();
    c.moveTo(0, h * 0.68);
    for (let x = 0; x <= w; x += 24)
      c.lineTo(x, h * (0.62 + 0.04 * Math.sin(x * 0.013) + 0.02 * Math.sin(x * 0.041)));
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.fill();
    // ruota panoramica e torre del cronometraggio (luci accese di notte)
    c.strokeStyle = s.night > 0.5 ? '#ffcf6a' : '#c8d0d8';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(w * 0.16, h * 0.5, h * 0.11, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.moveTo(w * 0.16, h * 0.5);
      c.lineTo(w * 0.16 + Math.cos(i * 0.785) * h * 0.11, h * 0.5 + Math.sin(i * 0.785) * h * 0.11);
      c.stroke();
    }
    c.fillStyle = '#20262e';
    c.fillRect(w * 0.86, h * 0.36, w * 0.06, h * 0.32);
    c.fillStyle = s.night > 0.5 ? '#ffd56a' : '#6fa8d8';
    for (let y = 0; y < 5; y++) c.fillRect(w * 0.87, h * (0.39 + y * 0.055), w * 0.04, h * 0.02);
    // pista in prospettiva con il cordolo
    c.fillStyle = '#25262c';
    c.beginPath();
    c.moveTo(w * 0.35, h * 0.7);
    c.lineTo(w * 0.65, h * 0.7);
    c.lineTo(w * 1.1, h);
    c.lineTo(-w * 0.1, h);
    c.fill();
    for (let i = 0; i < 12; i++) {
      const t0 = i / 12,
        t1 = (i + 1) / 12;
      c.fillStyle = i % 2 ? '#fff' : '#1f5fd6';
      c.beginPath();
      c.moveTo(w * (0.35 - 0.45 * t0), h * (0.7 + 0.3 * t0));
      c.lineTo(w * (0.35 - 0.45 * t1), h * (0.7 + 0.3 * t1));
      c.lineTo(w * (0.35 - 0.45 * t1) + 12, h * (0.7 + 0.3 * t1));
      c.lineTo(w * (0.35 - 0.45 * t0) + 8, h * (0.7 + 0.3 * t0));
      c.fill();
    }
    // due GT (sagome originali, coupé chiuse): una GT3 arancio e una GT4 blu, fari accesi di notte
    const gt = (x, y, sc, body, stripe) => {
      c.save();
      c.translate(x, y);
      c.scale(sc, sc);
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-60, 10);
      c.lineTo(-58, -2);
      c.quadraticCurveTo(-40, -8, -22, -10);
      c.quadraticCurveTo(-8, -26, 14, -24);
      c.quadraticCurveTo(34, -20, 46, -8);
      c.lineTo(62, -4);
      c.lineTo(62, 10);
      c.closePath();
      c.fill();
      c.fillStyle = '#9fc8ff';
      c.beginPath();
      c.moveTo(-14, -11);
      c.quadraticCurveTo(-4, -22, 12, -21);
      c.quadraticCurveTo(26, -18, 34, -9);
      c.closePath();
      c.fill();
      c.fillStyle = stripe;
      c.fillRect(-56, -1, 116, 4);
      c.fillStyle = '#111';
      c.fillRect(48, -12, 14, 3); // alettone
      for (const wx of [-36, 38]) {
        c.beginPath();
        c.arc(wx, 10, 9, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(4, -2, 7, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#111';
      c.font = '900 9px Impact, sans-serif';
      c.textAlign = 'center';
      c.fillText('24', 4, 1);
      c.restore();
      if (s.night > 0.3) {
        const beam = c.createLinearGradient(x - 60 * sc, 0, x - 260 * sc, 0);
        beam.addColorStop(0, 'rgba(255,250,210,.55)');
        beam.addColorStop(1, 'rgba(255,250,210,0)');
        c.fillStyle = beam;
        c.beginPath();
        c.moveTo(x - 58 * sc, y);
        c.lineTo(x - 260 * sc, y - 30 * sc);
        c.lineTo(x - 260 * sc, y + 30 * sc);
        c.fill();
      }
    };
    gt(w * 0.62, h * 0.86, 1.6, ORANGE, '#111');
    gt(w * 0.32, h * 0.8, 1.15, '#1f5fd6', LIME);
    // titolo al neon
    c.textAlign = 'center';
    c.font = `900 ${h * 0.13}px Impact, "Arial Black", sans-serif`;
    c.shadowColor = '#000';
    c.shadowBlur = 16;
    c.fillStyle = '#ffffff';
    c.fillText('BINOTTO', w / 2, h * 0.19);
    c.font = `900 ${h * 0.2}px Impact, "Arial Black", sans-serif`;
    c.shadowColor = LIME;
    c.shadowBlur = 26;
    c.fillStyle = LIME;
    c.fillText('GT', w / 2, h * 0.38);
    c.shadowBlur = 0;
  }
  g.drawImage(canvas._base, 0, 0);
  // orologio della 24 ore in alto a destra
  g.save();
  g.translate(w * 0.86, h * 0.17);
  g.fillStyle = 'rgba(5,8,16,.8)';
  g.beginPath();
  g.arc(0, 0, h * 0.1, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = LIME;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(0, 0, h * 0.1, -Math.PI / 2, -Math.PI / 2 + ((hour % 24) / 24) * Math.PI * 2);
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${h * 0.06}px Impact, sans-serif`;
  g.fillText(Math.floor(hour % 24) + 'H', 0, 0);
  g.restore();
  if (info) scorePanel(g, w, h, time, info);
  // cornice di lampadine lime che si rincorrono
  const n = 36,
    step = Math.floor(time * (idle ? 10 : 5));
  for (let i = 0; i < n; i++) {
    const t = i / n,
      on = (i + step) % 4 === 0 || (!idle && (i + step) % 4 === 2);
    let x, y;
    if (t < 0.25) [x, y] = [8 + (t / 0.25) * (w - 16), 8];
    else if (t < 0.5) [x, y] = [w - 8, 8 + ((t - 0.25) / 0.25) * (h - 16)];
    else if (t < 0.75) [x, y] = [w - 8 - ((t - 0.5) / 0.25) * (w - 16), h - 8];
    else [x, y] = [8, h - 8 - ((t - 0.75) / 0.25) * (h - 16)];
    g.fillStyle = on ? '#efffb0' : '#3a4a10';
    g.shadowColor = LIME;
    g.shadowBlur = on ? 12 : 0;
    g.beginPath();
    g.arc(x, y, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
}
