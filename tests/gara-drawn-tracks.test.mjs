// Piste disegnate come nel gioco (analisi 11.3): tratti finti fatti di tanti punti, chiusi da closeBorder come quando
// si alza il dito, linea di partenza da makeFinish, poi arrotondati a due decimali come fa il gioco prima di mandarli.
// Ogni pista che il gioco accetta deve essere accettata anche dal server (f1-server.js, makeTrack). Prima, con uno
// spigolo vivo, circa 1 pista su 400 passava nel gioco e veniva rifiutata alla creazione online.
import assert from 'node:assert/strict';
import * as R from '../public/gara/rules.js';
import { makeTrack } from '../f1-server.js';

// generatore con seme (mulberry32): sempre le stesse piste
const seeded = seed => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r2 = p => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });

// un tratto col dito: si passa per i vertici dati, con un punto ogni `step` caselle e un po' di tremolio
function stroke(vertices, rnd, step = 0.35, shake = 0.05) {
  const out = [];
  const all = [...vertices, vertices[0]];
  for (let k = 1; k < all.length; k++) {
    const a = all[k - 1],
      b = all[k],
      n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let i = 0; i < n; i++)
      out.push({
        x: a.x + ((b.x - a.x) * i) / n + (rnd() - 0.5) * shake,
        y: a.y + ((b.y - a.y) * i) / n + (rnd() - 0.5) * shake
      });
  }
  out.push({ ...out[0] });
  return out;
}
// forma attorno a (cx, cy): raggio che cambia con l'angolo; `sharp` aggiunge punte (spigoli vivi)
function shape(cx, cy, r, rnd, sides, sharp) {
  const at = (a, k) => ({ x: cx + Math.cos(a) * k * 1.4, y: cy + Math.sin(a) * k });
  const out = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2,
      k = r * (0.92 + rnd() * 0.16);
    // spigolo vivo: il dito va verso una punta e torna quasi sulla stessa strada (sharp > 0: verso fuori, < 0: dentro)
    if (sharp && rnd() < 0.08) {
      const w = 0.002 + rnd() * 0.01;
      out.push(at(a - w, k), at(a, k * (1 + sharp * (0.08 + rnd() * 0.1))), at(a + w, k));
    } else out.push(at(a, k));
  }
  return out;
}

// prova una pista: se il gioco la accetta, il server deve accettarla
function check(name, outerV, innerV, rnd, players = 2) {
  const outer = R.closeBorder(stroke(outerV, rnd));
  const inner = R.closeBorder(stroke(innerV, rnd));
  if (outer.error || inner.error) return 'gioco: ' + (outer.error || inner.error);
  for (const poly of [outer.poly, inner.poly]) {
    const shapeError = R.checkBorderShape(poly);
    if (shapeError) return 'gioco: ' + shapeError;
  }
  {
    const e = R.checkInner(outer.poly, inner.poly, R.MIN_WIDTH).error;
    if (e) return 'gioco: ' + e;
  }
  if (R.checkTrackSize(outer.poly, inner.poly)) return 'gioco: troppo grande';
  // linea di partenza da un punto del bordo interno verso l'esterno, a destra del centro
  const cx = (Math.min(...outer.poly.map(p => p.x)) + Math.max(...outer.poly.map(p => p.x))) / 2,
    cy = outerV.reduce((s, p) => s + p.y, 0) / outerV.length;
  const line = [];
  for (let x = cx; x <= cx + 200; x += 0.5) line.push({ x, y: cy + 0.3 });
  const fin = R.makeFinish(line, outer.poly, inner.poly);
  if (fin.error) return 'gioco: linea';
  const normal = R.finishNormals(fin.finish).find(
    n => R.capacityFor(outer.poly, inner.poly, fin.finish, n) >= players
  );
  if (!normal) return 'gioco: posti';
  if (R.buildTrack(outer.poly, inner.poly, fin.finish, normal, players).error) return 'gioco: giro';
  // accettata dal gioco: arrotondata come la manda il gioco, il server deve accettarla
  const sent = {
    outer: outer.poly.map(r2),
    inner: inner.poly.map(r2),
    finish: {
      a: r2(fin.finish.a),
      b: r2(fin.finish.b),
      outerSeg: fin.finish.outerSeg,
      innerSeg: fin.finish.innerSeg
    },
    normal,
    players
  };
  assert.equal(R.onlineTrackError(sent), null, name + ': the game check on the rounded track');
  assert.doesNotThrow(() => makeTrack(sent), name + ': accepted by the game, refused by the server');
  return 'ok';
}

const rnd = seeded(2026);
const results = {};
const count = r => (results[r] = (results[r] || 0) + 1);
// ovale, isola a punta, chicane (rientranze), poi 300 forme a caso con e senza spigoli vivi
count(check('ovale', shape(500, 500, 40, rnd, 48, 0), shape(500, 500, 18, rnd, 40, 0), rnd));
count(check('isola a punta', shape(800, 800, 45, rnd, 40, 0), shape(800, 800, 18, rnd, 12, -1), rnd));
count(check('chicane', shape(1200, 700, 60, rnd, 16, 1), shape(1200, 700, 22, rnd, 24, 0), rnd));
for (let i = 0; i < 300; i++) {
  const cx = 300 + rnd() * 1400,
    cy = 300 + rnd() * 1400,
    r = 25 + rnd() * 60;
  count(
    check(
      'forma ' + i,
      shape(cx, cy, r, rnd, 8 + Math.floor(rnd() * 30), rnd() < 0.6 ? 1 : 0),
      shape(cx, cy, r * (0.25 + rnd() * 0.1), rnd, 6 + Math.floor(rnd() * 20), rnd() < 0.6 ? -1 : 0),
      rnd
    )
  );
}
assert.ok(results.ok >= 80, 'most shapes are real tracks: ' + JSON.stringify(results));

console.log(
  `PASS drawn tracks: ${results.ok} tracks accepted by the game are accepted by the server too (rounded as sent).`
);
