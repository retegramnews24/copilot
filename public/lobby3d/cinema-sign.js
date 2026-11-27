// Schermo del cinema spento: insegna su sipario di velluto rosso, con cornice déco dorata e la scritta
// «BINOTTOLAND · PLAYGROUND · CINEMA» (CINEMA tra due stelle). Si disegna una volta su un canvas 1024 × 576.
const W = 1024,
  H = 576,
  BOX = { x0: 110, y0: 110, x1: 914, y1: 466 };

function glowText(g, text, x, y, font, color, blur) {
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
}
function spaced(g, text, x, y, font, color, spacing) {
  g.font = font;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const chars = [...text],
    widths = chars.map(c => g.measureText(c).width);
  let cx = x - (widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)) / 2;
  chars.forEach((c, i) => {
    g.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
}
function star(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  g.closePath();
  g.fill();
}

// g: contesto 2D di un canvas 1024 × 576
export function drawCinemaSign(g) {
  const bg = g.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= 24; i++) bg.addColorStop(i / 24, i % 2 ? '#5a0f1e' : '#7d1a2c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.75)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(12,6,10,.82)';
  g.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
  g.strokeStyle = '#d8b25e';
  g.lineWidth = 4;
  g.strokeRect(BOX.x0 + 30, BOX.y0 + 30, BOX.x1 - BOX.x0 - 60, BOX.y1 - BOX.y0 - 60);
  g.lineWidth = 1.5;
  g.strokeRect(BOX.x0 + 42, BOX.y0 + 42, BOX.x1 - BOX.x0 - 84, BOX.y1 - BOX.y0 - 84);
  glowText(g, 'BINOTTOLAND', W / 2, 228, 'bold 88px Georgia, serif', '#f3cf86', 24);
  spaced(g, 'PLAYGROUND', W / 2, 296, '600 34px Georgia, serif', '#d8b25e', 14);
  star(g, W / 2 - 150, 360, 14, '#f3cf86');
  star(g, W / 2 + 150, 360, 14, '#f3cf86');
  spaced(g, 'CINEMA', W / 2, 362, '600 40px Georgia, serif', '#f3e2bd', 18);
}
