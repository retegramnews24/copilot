// Calcio balilla: il computer (sempre i blu se giochi tu con i rossi). Muove tutte e quattro le sue aste:
// mette la figura giusta sulla traiettoria della palla, alza le aste davanti ai tiri dei compagni,
// ferma la palla e tira. Il livello si adatta: sale quando vinci un punto, scende quando lo perdi.
import { rows, figureZ, W } from './balilla-rules.js?v=9dcbd53479';

const KEY = 'binottoland-balilla-ai';
export function loadSkill() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v >= 0.1 && v <= 1 ? v : 0.4;
  } catch {
    return 0.4;
  }
}
export function saveSkill(v) {
  try {
    localStorage.setItem(KEY, String(Math.round(v * 1000) / 1000));
  } catch {}
}
// Dopo un gol: se segni tu il computer migliora, se segna lui gioca un po' peggio.
export function adapt(skill, humanScored) {
  return Math.max(0.1, Math.min(1, skill + (humanScored ? 0.06 : -0.04)));
}
export const skillName = s => (s < 0.3 ? 'principiante' : s < 0.5 ? 'facile' : s < 0.7 ? 'medio' : s < 0.85 ? 'forte' : 'campione');

// Dove sarà la palla (z) quando arriva all'asta x, con i rimbalzi sulle sponde.
function predictZ(b, x) {
  if (Math.abs(b.vx) < 0.05 || (x - b.x) * b.vx < 0) return b.z;
  const t = Math.min(1.2, (x - b.x) / b.vx);
  let z = b.z + b.vz * t;
  const span = 2 * W;
  z = ((((z + W) % (2 * span)) + 2 * span) % (2 * span)) - W;
  return z > W ? 2 * W - z : z;
}

export function createAI(team, skill) {
  const forward = team === 0 ? 1 : -1;
  const mem = rows.map(() => ({ slide: 0, angle: 0, kick: 0, wait: 0, noise: 0 }));
  let think = 0;
  return {
    skill,
    // Ogni passo: decide i comandi delle sue quattro aste (scritti direttamente nel campo).
    step(f, dt) {
      const s = this.skill,
        b = f.ball;
      const reaction = 0.2 - 0.15 * s; // secondi tra una decisione e l'altra
      think -= dt;
      const decide = think <= 0;
      if (decide) think = reaction * (0.7 + Math.random() * 0.6);
      rows.forEach((row, i) => {
        if (row.team !== team) return;
        const m = mem[i],
          rod = f.rods[i];
        // la palla è davanti a quest'asta (verso la porta avversaria) o dietro?
        const ahead = (b.x - row.x) * forward;
        if (decide) {
          m.noise = (Math.random() - 0.5) * 0.035 * (1 - s);
          const z = predictZ(b, row.x) + m.noise;
          // figura più vicina alla traiettoria, dentro la corsa dell'asta
          let best = 0,
            bd = 1e9;
          for (let n = 0; n < row.count; n++) {
            const shift = Math.max(-row.travel, Math.min(row.travel, z - figureZ(row, n, 0)));
            const d = Math.abs(z - figureZ(row, n, shift));
            if (d < bd) {
              bd = d;
              best = shift;
            }
          }
          m.slide = best / row.travel;
        }
        // palla dietro l'asta (tira un compagno da dietro): alza le figure per lasciarla passare
        // (tiro in avanti di un compagno, o palla ferma tenuta da un'asta dietro): così non si tira addosso
        const ownBehind = rows.some(
          (r, k) => r.team === team && (r.x - row.x) * forward < 0 && Math.abs(b.x - r.x) < 0.08 && (f.rods[k].pin || Math.abs(b.vx) < 0.4)
        );
        const teammateBehind = ahead < -0.04 && f.phase === 'play' && (b.vx * forward > 0.3 || ownBehind);
        if (m.kick > 0) {
          m.kick -= dt;
          m.angle = forward * 1.45; // tiro: rotazione in avanti alla velocità massima
          if (m.kick <= 0) m.wait = 0.12;
        } else if (m.wait > 0) {
          m.wait -= dt;
          m.angle = 0;
        } else if (teammateBehind && row !== rows.find(r => r.team === team && r.count === 1)) {
          m.angle = -forward * 1.4;
        } else if (
          ahead > 0 &&
          ahead < 0.075 &&
          Math.hypot(b.vx, b.vz) < 1.2 &&
          Math.abs(b.z - nearestFigure(row, rod, b.z)) < 0.034 &&
          f.phase === 'play'
        ) {
          // (solo palla lenta o ferma: un tiro che arriva forte si para, non si ribatte al volo)
          // palla appena davanti al piede: caricamento indietro e tiro (più spesso se è bravo)
          if (rod.angle * forward < -0.6) {
            if (Math.random() < 0.35 + 0.6 * s) m.kick = 0.05 + 0.04 * s;
          } else m.angle = -forward * 0.9;
        } else if (
          ahead < 0 &&
          ahead > -0.07 &&
          Math.hypot(b.vx, b.vz) < 0.15 &&
          Math.abs(b.z - nearestFigure(row, rod, b.z)) < 0.034 &&
          f.phase === 'play'
        ) {
          // palla ferma appena dietro le figure: tocco all'indietro, verso l'asta di dietro che poi la gioca
          m.kick = 0;
          m.angle = -forward * 0.75;
        } else if (ahead > 0 && ahead < 0.2 && b.vx * forward < -0.3) {
          // palla che arriva contro: figure giù per parare
          m.angle = 0;
        } else m.angle = rod.pin ? m.angle : 0;
        rod.tShift = m.slide;
        rod.tAngle = m.angle;
      });
    }
  };
}
function nearestFigure(row, rod, z) {
  let best = 0,
    bd = 1e9;
  for (let n = 0; n < row.count; n++) {
    const fz = figureZ(row, n, rod.shift);
    if (Math.abs(fz - z) < bd) {
      bd = Math.abs(fz - z);
      best = fz;
    }
  }
  return best;
}
