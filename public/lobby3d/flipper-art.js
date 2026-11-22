// Flipper "Binottoland Grand Prix": grafica disegnata al volo (originale, niente immagini esterne).
// - paintPlayfield: il piano dipinto (asfalto, cordoli, segni delle gomme, frecce dei tiri, bandiera, logo, fiamme)
// - paintBackglass: il vetro del tabellone (città di notte, pista in prospettiva, monoposto, bandiere, titolo al neon)
// Coordinate del gioco: x da 0 a W (0,52 m), y da 0 (flipper) a H (1,06 m) come in ../flipper/physics.js.
const PW = 0.52,
  PH = 1.06;

export function paintPlayfield(canvas) {
  const g = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  const X = x => (x / PW) * w,
    Y = y => (1 - y / PH) * h,
    S = v => (v / PW) * w;
  // asfalto con la grana e una luce calda al centro
  g.fillStyle = '#1b1c22';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) {
    const v = 22 + Math.random() * 34;
    g.fillStyle = `rgb(${v},${v},${v + 6})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  const glow = g.createRadialGradient(X(0.24), Y(0.55), 10, X(0.24), Y(0.55), S(0.42));
  glow.addColorStop(0, 'rgba(255,170,80,.22)');
  glow.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  // zona dei bumper: neon viola e blu
  const neon = g.createRadialGradient(X(0.24), Y(0.78), 10, X(0.24), Y(0.78), S(0.2));
  neon.addColorStop(0, 'rgba(160,80,255,.55)');
  neon.addColorStop(0.6, 'rgba(60,120,255,.25)');
  neon.addColorStop(1, 'rgba(60,120,255,0)');
  g.fillStyle = neon;
  g.fillRect(0, 0, w, h);
  // segni delle gomme (frenate in curva)
  g.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.2})`;
    g.lineWidth = S(0.006 + Math.random() * 0.004);
    g.beginPath();
    const cx = 0.24 + (Math.random() - 0.5) * 0.12,
      cy = 0.45 + Math.random() * 0.3,
      r = 0.12 + Math.random() * 0.1;
    g.arc(X(cx), Y(cy), S(r), Math.PI * (0.9 + Math.random() * 0.3), Math.PI * (1.4 + Math.random() * 0.4));
    g.stroke();
  }
  // cordoli bianchi e rossi lungo la pista (ellisse attorno al centro)
  const kerb = (cx, cy, rx, ry, a0, a1, n) => {
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n,
        t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      g.strokeStyle = i % 2 ? '#f2f2f2' : '#e01f2b';
      g.lineWidth = S(0.012);
      g.beginPath();
      g.ellipse(X(cx), Y(cy), S(rx), S(ry), 0, -t1, -t0);
      g.stroke();
    }
  };
  kerb(0.241, 0.6, 0.2, 0.33, Math.PI * 0.05, Math.PI * 0.95, 26);
  kerb(0.241, 0.6, 0.2, 0.33, Math.PI * 1.15, Math.PI * 1.85, 20);
  // bandiera a scacchi che sventola sotto il logo
  for (let i = 0; i < 14; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#f5f5f5' : '#111';
      const wave = Math.sin(i * 0.7) * S(0.006);
      g.fillRect(X(0.12 + i * 0.0175), Y(0.47 - j * 0.0175) + wave, S(0.0175) + 1, S(0.0175) + 1);
    }
  // logo grande al centro
  g.save();
  g.translate(X(0.241), Y(0.495));
  g.textAlign = 'center';
  g.font = `900 ${S(0.042)}px Impact, "Arial Black", sans-serif`;
  g.fillStyle = '#ffd23f';
  g.shadowColor = '#ff7a00';
  g.shadowBlur = 18;
  g.fillText('BINOTTOLAND', 0, -S(0.012));
  g.font = `900 ${S(0.056)}px Impact, "Arial Black", sans-serif`;
  g.fillStyle = '#ff2a3a';
  g.fillText('GRAND PRIX', 0, S(0.04));
  g.restore();
  g.shadowBlur = 0;
  // frecce colorate verso i tiri (sotto gli inserti luminosi)
  const arrow = (x, y, ang, len, color, label) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-ang);
    g.fillStyle = color;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(S(len), 0);
    g.lineTo(0, -S(0.018));
    g.lineTo(S(0.012), 0);
    g.lineTo(0, S(0.018));
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    g.restore();
    g.fillStyle = '#fff';
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.font = `900 ${S(0.016)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(label, X(x), Y(y) + S(0.03));
    g.shadowBlur = 0;
  };
  arrow(0.105, 0.43, Math.PI / 2, 0.06, '#ff8a1c', 'RAMPA');
  arrow(0.032, 0.6, Math.PI / 2, 0.06, '#3cd8ff', 'GIRO');
  arrow(0.24, 0.55, Math.PI / 2, 0.04, '#ffd23f', 'SEMAFORI');
  arrow(0.37, 0.83, Math.PI * 0.3, 0.06, '#3cff7a', 'BOX');
  // griglia di partenza tra i flipper: caselle bianche numerate su un fondo rosso e arancio
  const grid = g.createLinearGradient(0, Y(0.3), 0, Y(0.06));
  grid.addColorStop(0, 'rgba(255,60,40,0)');
  grid.addColorStop(0.5, 'rgba(255,90,30,.28)');
  grid.addColorStop(1, 'rgba(255,40,80,.35)');
  g.fillStyle = grid;
  g.beginPath();
  g.moveTo(X(0.13), Y(0.3));
  g.lineTo(X(0.352), Y(0.3));
  g.lineTo(X(0.3), Y(0.06));
  g.lineTo(X(0.18), Y(0.06));
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.75)';
  g.lineWidth = S(0.003);
  g.font = `900 ${S(0.014)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  [
    [0.205, 0.25, '1'],
    [0.277, 0.22, '2'],
    [0.205, 0.18, '3'],
    [0.277, 0.15, '4']
  ].forEach(([x, y, n]) => {
    g.strokeRect(X(x) - S(0.022), Y(y) - S(0.012), S(0.044), S(0.024));
    g.fillStyle = '#fff';
    g.fillText(n, X(x), Y(y) + S(0.005));
  });
  // strisce colorate nei corridoi: azzurro a sinistra (orbita), arancio a destra (rampa che scende)
  const band = (x0, x1, c0, c1) => {
    const gr = g.createLinearGradient(0, Y(0.9), 0, Y(0.2));
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fillRect(X(x0), Y(0.9), S(x1 - x0), S(0.7));
  };
  band(0.004, 0.058, 'rgba(60,216,255,.35)', 'rgba(60,216,255,0)');
  band(0.43, 0.478, 'rgba(255,138,28,.0)', 'rgba(255,138,28,.35)');
  // fiamme vicino ai flipper
  for (const sx of [0.1, 0.38]) {
    for (let k = 0; k < 5; k++) {
      const grad = g.createLinearGradient(X(sx), Y(0.11), X(sx), Y(0.2));
      grad.addColorStop(0, 'rgba(255,60,20,.0)');
      grad.addColorStop(0.5, 'rgba(255,120,20,.45)');
      grad.addColorStop(1, 'rgba(255,220,60,.0)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(
        X(sx + (k - 2) * 0.008),
        Y(0.15),
        S(0.006),
        S(0.05 - Math.abs(k - 2) * 0.01),
        0,
        0,
        Math.PI * 2
      );
      g.fill();
    }
  }
  // scritte degli inserti (sotto le luci): KICK, SALVA, moltiplicatori
  g.font = `800 ${S(0.012)}px system-ui, sans-serif`;
  g.fillStyle = '#9fe8b5';
  g.textAlign = 'center';
  g.fillText('SALVA', X(0.241), Y(0.035));
  g.fillStyle = '#ffe08a';
  ['×2', '×3', '×4', '×5'].forEach((t, i) => g.fillText(t, X(0.15 + i * 0.062), Y(0.33)));
  g.fillStyle = '#ffb0ff';
  g.fillText('EXTRA', X(0.36), Y(0.905));
  g.fillText('SUPER', X(0.44), Y(0.905));
}

// Vetro del tabellone: il collage della gara di notte. lamps: 0…1 per la cornice di lampadine che si rincorrono.
// riquadro del punteggio sul vetro: cifre grandi in diretta (salgono mentre fai punti), pallina, bonus e messaggio;
// in attesa mostra il record della classifica
function scorePanel(g, w, h, time, info) {
  const x0 = w * 0.07,
    y0 = h * 0.43,
    pw = w * 0.86,
    ph = h * 0.45;
  g.save();
  g.fillStyle = 'rgba(8,4,20,.82)';
  g.strokeStyle = info.flash > 0 ? '#fff3b0' : '#ffb347';
  g.lineWidth = 5;
  g.shadowColor = '#ff7a2a';
  g.shadowBlur = 18 + (info.flash > 0 ? 22 : 0);
  g.beginPath();
  g.roundRect(x0, y0, pw, ph, 22);
  g.fill();
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = w / 2;
  // etichetta in alto
  g.shadowBlur = 0;
  g.font = `800 ${h * 0.052}px "Arial Black", Impact, sans-serif`;
  g.fillStyle = '#7fe8ff';
  g.fillText(info.label, cx, y0 + ph * 0.13);
  // punteggio grande
  const text = info.score.toLocaleString('it-IT');
  let size = h * 0.2;
  g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  const fit = (pw * 0.92) / Math.max(1, g.measureText(text).width);
  if (fit < 1) size *= fit;
  const pop = 1 + Math.max(0, info.flash) * 0.12;
  g.translate(cx, y0 + ph * 0.45);
  g.scale(pop, pop);
  g.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  g.shadowColor = info.flash > 0 ? '#ffffff' : '#ffb347';
  g.shadowBlur = 26;
  g.lineWidth = 7;
  g.strokeStyle = '#5a1a00';
  g.strokeText(text, 0, 0);
  const grad = g.createLinearGradient(0, -size / 2, 0, size / 2);
  grad.addColorStop(0, '#fff7c2');
  grad.addColorStop(0.5, '#ffd23f');
  grad.addColorStop(1, '#ff8a1c');
  g.fillStyle = grad;
  g.fillText(text, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // riga sotto: pallina, bonus, messaggio
  g.shadowBlur = 8;
  g.shadowColor = '#000';
  g.font = `800 ${h * 0.05}px "Arial Black", Impact, sans-serif`;
  if (info.balls) {
    for (let i = 0; i < info.balls; i++) {
      g.fillStyle = i < info.ball - 1 ? '#3a3448' : i === info.ball - 1 ? '#ffffff' : '#9aa4b0';
      g.beginPath();
      g.arc(x0 + 34 + i * 30, y0 + ph * 0.78, 10, 0, Math.PI * 2);
      g.fill();
    }
    g.textAlign = 'right';
    g.fillStyle = info.mult > 1 ? '#ff5ad1' : '#c9c2e0';
    g.fillText('BONUS ×' + info.mult, x0 + pw - 24, y0 + ph * 0.78);
    g.textAlign = 'center';
  }
  if (info.message) {
    const blink = Math.floor(time * 4) % 2 === 0;
    g.fillStyle = blink ? '#ffffff' : '#7fe8ff';
    g.font = `800 ${h * 0.045}px "Arial Black", Impact, sans-serif`;
    g.fillText(info.message.toUpperCase().slice(0, 34), cx, y0 + ph * (info.balls ? 0.93 : 0.82));
  }
  g.restore();
}

export function paintBackglass(canvas, time = 0, idle = true, info = null) {
  const g = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  if (!canvas._base) {
    const b = document.createElement('canvas');
    b.width = w;
    b.height = h;
    const c = b.getContext('2d');
    // cielo al tramonto e stelle
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0630');
    sky.addColorStop(0.55, '#5a1660');
    sky.addColorStop(0.8, '#ff6a3a');
    sky.addColorStop(1, '#ffb04a');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`;
      c.fillRect(Math.random() * w, Math.random() * h * 0.5, 1.5, 1.5);
    }
    // sole che tramonta a righe
    const sun = c.createLinearGradient(0, h * 0.45, 0, h * 0.75);
    sun.addColorStop(0, '#ffe36b');
    sun.addColorStop(1, '#ff3a6a');
    c.fillStyle = sun;
    c.beginPath();
    c.arc(w * 0.5, h * 0.66, h * 0.2, Math.PI, 0);
    c.fill();
    c.fillStyle = '#5a1660';
    for (let i = 0; i < 6; i++) c.fillRect(w * 0.3, h * (0.5 + i * 0.028), w * 0.4, 2 + i);
    // città di notte con le finestre accese
    for (let x = 0; x < w; x += 18 + Math.random() * 20) {
      const bh = h * (0.08 + Math.random() * 0.18),
        bw = 16 + Math.random() * 26;
      c.fillStyle = '#140a24';
      c.fillRect(x, h * 0.72 - bh, bw, bh);
      c.fillStyle = 'rgba(255,210,120,.75)';
      for (let yy = h * 0.72 - bh + 4; yy < h * 0.72 - 4; yy += 7)
        for (let xx = x + 3; xx < x + bw - 3; xx += 6) if (Math.random() < 0.35) c.fillRect(xx, yy, 2, 3);
    }
    // pista in prospettiva con i cordoli
    c.fillStyle = '#202028';
    c.beginPath();
    c.moveTo(w * 0.42, h * 0.72);
    c.lineTo(w * 0.58, h * 0.72);
    c.lineTo(w * 1.05, h);
    c.lineTo(-w * 0.05, h);
    c.fill();
    for (let i = 0; i < 12; i++) {
      const t0 = i / 12,
        t1 = (i + 1) / 12;
      c.fillStyle = i % 2 ? '#fff' : '#e01f2b';
      for (const side of [-1, 1]) {
        const x0 = w * (0.5 + side * (0.08 + 0.47 * t0)),
          x1 = w * (0.5 + side * (0.08 + 0.47 * t1));
        c.beginPath();
        c.moveTo(x0, h * (0.72 + 0.28 * t0));
        c.lineTo(x1, h * (0.72 + 0.28 * t1));
        c.lineTo(x1 - side * 10, h * (0.72 + 0.28 * t1));
        c.lineTo(x0 - side * 6, h * (0.72 + 0.28 * t0));
        c.fill();
      }
    }
    // due monoposto (sagome originali) in volata
    const car = (x, y, s, color) => {
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.fillStyle = '#111';
      for (const [wx, wy] of [
        [-34, 6],
        [30, 6],
        [-30, -8],
        [26, -8]
      ])
        c.fillRect(wx - 7, wy - 6, 14, 12);
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-40, 0);
      c.lineTo(46, -2);
      c.lineTo(46, 3);
      c.lineTo(-40, 6);
      c.fill();
      c.fillRect(-48, -10, 10, 22);
      c.fillRect(42, -8, 6, 18);
      c.fillStyle = '#ffd23f';
      c.beginPath();
      c.arc(-6, -2, 5, 0, Math.PI * 2);
      c.fill();
      c.restore();
    };
    car(w * 0.36, h * 0.88, 1.3, '#e01f2b');
    car(w * 0.66, h * 0.84, 1.1, '#2f7fe0');
    // bandiere a scacchi agli angoli
    for (const [fx, flip] of [
      [w * 0.06, 1],
      [w * 0.94, -1]
    ]) {
      c.strokeStyle = '#ccc';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(fx, h * 0.9);
      c.lineTo(fx, h * 0.35);
      c.stroke();
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 4; j++) {
          c.fillStyle = (i + j) % 2 ? '#fff' : '#111';
          c.fillRect(fx + flip * i * 9, h * 0.35 + j * 9 + Math.sin(i) * 3, flip * 9, 9);
        }
    }
    // titolo al neon
    c.textAlign = 'center';
    c.font = `900 ${h * 0.13}px Impact, "Arial Black", sans-serif`;
    c.shadowColor = '#ffb347';
    c.shadowBlur = 24;
    c.fillStyle = '#ffd23f';
    c.fillText('BINOTTOLAND', w / 2, h * 0.2);
    c.shadowColor = '#ff2a3a';
    c.font = `900 ${h * 0.17}px Impact, "Arial Black", sans-serif`;
    c.fillStyle = '#ff3a4a';
    c.fillText('GRAND PRIX', w / 2, h * 0.38);
    c.shadowBlur = 0;
    canvas._base = b;
  }
  g.drawImage(canvas._base, 0, 0);
  if (info) scorePanel(g, w, h, time, info);
  // cornice di lampadine che si rincorrono (più veloci in attesa)
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
    g.fillStyle = on ? '#fff3b0' : '#5a4a20';
    g.shadowColor = '#ffcc55';
    g.shadowBlur = on ? 12 : 0;
    g.beginPath();
    g.arc(x, y, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  g.shadowBlur = 0;
}
