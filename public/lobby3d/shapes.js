// Lobby 3D: forme con gli spigoli arrotondati (scatole smussate), per mobili, cornici e tavoli.
import * as THREE from 'three';

const cache = new Map();
// Scatola larga w, alta h, profonda d, con raggio r su tutti gli spigoli (centrata come BoxGeometry).
// Le geometrie uguali si riusano.
export function roundBoxGeometry(w, h, d, r = 0.01, segments = 3) {
  r = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  const key = [w, h, d, r, segments].map(v => Math.round(v * 1e4)).join(',');
  if (cache.has(key)) return cache.get(key);
  const iw = w / 2 - r,
    ih = h / 2 - r;
  const s = new THREE.Shape();
  s.moveTo(-iw, -ih);
  s.lineTo(iw, -ih);
  s.lineTo(iw, ih);
  s.lineTo(-iw, ih);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.0001, d - 2 * r),
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: segments,
    curveSegments: 1
  });
  g.translate(0, 0, -(d - 2 * r) / 2);
  g.computeVertexNormals();
  cache.set(key, g);
  return g;
}
