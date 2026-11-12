// Safe stylised pit corridors, in the same 1000x650 coordinate system as the track.
// Entry/exit intentionally join the circuit; the service lane must never cross it.
import { shapes, position } from "./geometry.js";
function distance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    f = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p[0] - a[0] - dx * f, p[1] - a[1] - dy * f);
}
export const trackPoint = (f, pts) => {
  const p = position(f, pts);
  return [p[0] * 1000, p[1] * 650, p[2]];
};
export function clearance(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++)
    best = Math.min(best, distance(p, pts[i], pts[(i + 1) % pts.length]));
  return best;
}
const cache = new Map();
export function pitLayout(idx) {
  if (cache.has(idx)) return cache.get(idx);
  const pts = shapes[idx],
    line = pts.map((p) => [p[0] * 1000, p[1] * 650]);
  let chosen = null;
  // Try the start/finish vicinity first, then a clear straight. Never draw an unsafe fallback.
  for (let k = 0; k < 100 && !chosen; k++) {
    const f = k / 100;
    for (const side of [-1, 1]) {
      const center = trackPoint(f, pts),
        lane = [],
        garage = [];
      let safe = true;
      for (let j = 0; j <= 40; j++) {
        const u = j / 40,
          q = trackPoint(f + (u - 0.5) * 0.045, pts);
        const offset = side * 23 * Math.sin(Math.PI * u) ** 0.5;
        const p = [
          q[0] - Math.sin(center[2]) * offset,
          q[1] + Math.cos(center[2]) * offset,
        ];
        lane.push(p);
        if (p[0] < 15 || p[0] > 985 || p[1] < 15 || p[1] > 635) {
          safe = false;
          break;
        }
        const gap = clearance(p, line);
        if (j > 5 && j < 35 && gap < 11) {
          safe = false;
          break;
        }
      }
      if (!safe) continue;
      const a = lane[15],
        b = lane[25],
        angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let j = 12; j <= 28; j += 4) {
        const q = lane[j],
          g = [
            q[0] - Math.sin(angle) * side * 15,
            q[1] + Math.cos(angle) * side * 15,
          ];
        if (clearance(g, line) < 16) {
          safe = false;
          break;
        }
        garage.push(g);
      }
      if (safe) {
        chosen = { phase: f, lane, garage, angle, side };
        break;
      }
    }
  }
  if (!chosen) throw Error("No safe pit corridor for circuit " + idx);
  cache.set(idx, chosen);
  return chosen;
}
export function pitPosition(idx, t) {
  const p = pitLayout(idx),
    f = Math.max(0, Math.min(1, t)) * (p.lane.length - 1),
    i = Math.min(p.lane.length - 2, Math.floor(f)),
    a = p.lane[i],
    b = p.lane[i + 1],
    u = f - i;
  return [
    (a[0] + (b[0] - a[0]) * u) / 1000,
    (a[1] + (b[1] - a[1]) * u) / 650,
    Math.atan2(b[1] - a[1], b[0] - a[0]),
  ];
}
