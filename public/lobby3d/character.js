// Lobby 3D: il personaggio a blocchi fatto in Blender (blender/personaggio.blend → models/personaggio.glb):
// felpa con cappuccio, lacci e logo del lupo, pantaloni con riga e tasca, sneakers. Colori scelti in Settings:
// felpa = maglietta, pantaloni = pantaloncini, dettagli (lacci, righe, scarpe), capelli e pelle.
// Ogni parte (testa, busto, braccia, gambe) ha il suo perno, così cammina, saluta e tiene le manopole.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

export const SPEED = 3.1;
export const ARM_LEN = 0.6; // dalla spalla alla punta della mano
export const EYE_Y = 1.56;
const DEFAULT = { shirt: '#1d1f23', shorts: '#1d1f23', accent: '#d62828', hair: '#4a2a17', skin: '#d79a6b' };
// nomi dei pezzi nel modello e perni (in metri, personaggio con i piedi a terra, guarda verso -Z)
const PARTS = {
  gamba_R: ['legs', 0, -0.11, 0.66],
  gamba_L: ['legs', 1, 0.11, 0.66],
  braccio_R: ['arms', 0, -0.33, 1.27],
  braccio_L: ['arms', 1, 0.33, 1.27],
  busto: ['torso', 0, 0, 0.66],
  testa: ['head', 0, 0, 1.32]
};
// materiali del modello che prendono i colori scelti
const COLOR_OF = { pg_hoodie: 'shirt', pg_pants: 'shorts', pg_accent: 'accent', pg_hair: 'hair', pg_skin: 'skin' };

let model = null;
const waiting = [];
new GLTFLoader().load(new URL('models/personaggio.glb', import.meta.url).href, gltf => {
  model = gltf.scene;
  for (const c of waiting.splice(0)) fill(c);
});

// logo del lupo sul petto (disegnato qui: un profilo di lupo stilizzato, bianco con il colore dei dettagli)
let emblemTex = null;
function emblem() {
  if (emblemTex) return emblemTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.translate(64, 66);
  const wolf = [[-34, 30], [-26, -6], [-34, -40], [-12, -22], [6, -44], [12, -18], [40, -4], [22, 4], [30, 14], [8, 12], [2, 34], [-10, 18]];
  g.beginPath();
  wolf.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = '#f2f0ea';
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = '#2a2a2e';
  g.stroke();
  g.fillStyle = '#d62828';
  g.beginPath();
  g.moveTo(10, -12);
  g.lineTo(20, -8);
  g.lineTo(10, -6);
  g.fill();
  emblemTex = new THREE.CanvasTexture(cv);
  emblemTex.colorSpace = THREE.SRGBColorSpace;
  return emblemTex;
}

function fill(c) {
  model.traverse(node => {
    const spec = PARTS[node.name];
    if (!spec) return;
    const [kind, index] = spec;
    const pivot = kind === 'legs' || kind === 'arms' ? c[kind][index] : c[kind];
    const copy = node.clone(true);
    copy.position.set(0, 0, 0);
    copy.traverse(o => {
      if (!o.isMesh) return;
      const name = o.material.name;
      if (name === 'pg_emblem') {
        // il piano del logo: coordinate di texture dalla sua forma, materiale con il disegno
        const pos = o.geometry.attributes.position;
        o.geometry = o.geometry.clone();
        const box = new THREE.Box3().setFromBufferAttribute(pos);
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = 1 - (pos.getX(i) - box.min.x) / Math.max(1e-6, box.max.x - box.min.x);
          uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / Math.max(1e-6, box.max.y - box.min.y);
        }
        o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        o.material = new THREE.MeshStandardMaterial({ map: emblem(), transparent: true, roughness: 0.6 });
        c.emblem = o;
        return;
      }
      const part = COLOR_OF[name];
      if (part) {
        if (!c.mats[name]) {
          c.mats[name] = o.material.clone();
          c.mats[name].userData.part = part;
        }
        o.material = c.mats[name];
      }
      o.castShadow = true;
    });
    pivot.add(copy);
  });
  setLook(c, c.look);
}

export function setLook(c, look = {}) {
  c.look = { ...DEFAULT, ...look };
  for (const m of Object.values(c.mats)) m.color.set(c.look[m.userData.part]);
  if (c.emblem) c.emblem.material.color.set('#ffffff');
}

export function makeCharacter(look) {
  const root = new THREE.Group();
  const group = (x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    root.add(g);
    return g;
  };
  const c = { root, legs: [], arms: [], torso: null, head: null, mats: {}, look: { ...DEFAULT, ...look }, phase: 0, expressionEnd: 0 };
  for (const [kind, index, x, y] of Object.values(PARTS)) {
    const g = group(x, y);
    if (kind === 'legs' || kind === 'arms') c[kind][index] = g;
    else c[kind] = g;
  }
  if (model) fill(c);
  else waiting.push(c);
  return c;
}

export function animateCharacter(c, speed, dt, t) {
  const amt = Math.min(1, speed / SPEED);
  c.phase += dt * (4 + (6 * speed) / SPEED);
  const sw = Math.sin(c.phase) * 0.7 * amt;
  c.legs[0].rotation.x = sw;
  c.legs[1].rotation.x = -sw;
  c.arms[0].rotation.x = -sw * 0.8;
  c.arms[1].rotation.x = sw * 0.8;
  c.arms[0].rotation.z = -0.04;
  c.arms[1].rotation.z = 0.04;
  // a blocchi: si muove a scatti morbidi, fermo respira e si guarda intorno
  c.root.position.y = Math.abs(Math.cos(c.phase)) * 0.03 * amt + (1 - amt) * Math.sin(t * 2) * 0.004;
  c.torso.rotation.y = Math.sin(c.phase) * 0.05 * amt;
  const remaining = Math.max(0, c.expressionEnd - t);
  const envelope = Math.min(1, remaining * 4, Math.max(0, (1.2 - remaining) * 7));
  const laugh = c.expression === 'laugh';
  // espressioni: la testa ride (su e giù) o si stupisce (indietro)
  c.head.rotation.x = envelope * (laugh ? -0.12 * (0.6 + 0.4 * Math.cos(remaining * 24)) : -0.16);
  c.head.rotation.y = (1 - amt) * Math.sin(t * 0.6) * 0.25;
  c.head.position.y = 1.32 + envelope * (laugh ? 0.01 * Math.abs(Math.sin(remaining * 20)) : 0.012);
}
