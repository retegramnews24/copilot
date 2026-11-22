// Lobby 3D: il personaggio a blocchi fatto in Blender (blender/personaggio.blend → models/personaggio.glb):
// felpa con cappuccio, lacci e logo del lupo, pantaloni con riga e tasca, sneakers. Colori scelti in Settings:
// felpa = maglietta, pantaloni = pantaloncini, dettagli (lacci, righe, scarpe), capelli e pelle.
// Ogni parte ha il suo perno: testa (collo), busto, braccia con il gomito (braccio + avambraccio), gambe con il
// ginocchio (coscia + stinco). Così cammina piegando le ginocchia, si abbassa, si siede, si para e tiene le manopole.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

export const SPEED = 3.1;
export const ARM_LEN = 0.6; // dalla spalla alla punta della mano
export const EYE_Y = 1.56;
const DEFAULT = { shirt: '#1d1f23', shorts: '#1d1f23', accent: '#d62828', hair: '#4a2a17', skin: '#d79a6b' };
// nomi dei pezzi nel modello e perni (in metri, personaggio con i piedi a terra, guarda verso -Z)
const PARTS = {
  coscia_R: ['legs', 0, -0.11, 0.66],
  coscia_L: ['legs', 1, 0.11, 0.66],
  braccio_R: ['arms', 0, -0.33, 1.27],
  braccio_L: ['arms', 1, 0.33, 1.27],
  busto: ['torso', 0, 0, 0.66],
  testa: ['head', 0, 0, 1.32]
};
// materiali del modello che prendono i colori scelti
const COLOR_OF = {
  pg_hoodie: 'shirt',
  pg_pants: 'shorts',
  pg_accent: 'accent',
  pg_hair: 'hair',
  pg_skin: 'skin'
};

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
  const wolf = [
    [-34, 30],
    [-26, -6],
    [-34, -40],
    [-12, -22],
    [6, -44],
    [12, -18],
    [40, -4],
    [22, 4],
    [30, 14],
    [8, 12],
    [2, 34],
    [-10, 18]
  ];
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
    // ginocchio e gomito: lo stinco è figlio della coscia, l'avambraccio del braccio (perni fatti in Blender)
    const side = index ? 'L' : 'R';
    if (kind === 'legs') c.knees[index] = copy.getObjectByName('stinco_' + side) || c.knees[index];
    if (kind === 'arms') c.elbows[index] = copy.getObjectByName('avambraccio_' + side) || c.elbows[index];
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
  const c = {
    root,
    legs: [],
    arms: [],
    knees: [new THREE.Object3D(), new THREE.Object3D()],
    elbows: [new THREE.Object3D(), new THREE.Object3D()],
    torso: null,
    head: null,
    mats: {},
    look: { ...DEFAULT, ...look },
    phase: 0,
    expressionEnd: 0,
    lookYaw: 0,
    lookPitch: 0
  };
  for (const [kind, index, x, y] of Object.values(PARTS)) {
    const g = group(x, y);
    if (kind === 'legs' || kind === 'arms') c[kind][index] = g;
    else c[kind] = g;
  }
  if (model) fill(c);
  else waiting.push(c);
  return c;
}

// stelline che girano sopra la testa di chi ha preso un colpo (solo un effetto, niente salute)
let starGeo = null;
function stars(c) {
  if (c.stars) return c.stars;
  if (!starGeo) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.022 : 0.05,
        a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false });
  }
  const g = new THREE.Group(),
    mat = new THREE.MeshBasicMaterial({ color: '#ffd84a', toneMapped: false });
  for (let i = 0; i < 5; i++) g.add(new THREE.Mesh(starGeo, mat));
  g.visible = false;
  c.root.add(g);
  return (c.stars = g);
}
// Azioni (solo visive): a.crouch = abbassato, a.guard = in parata; c.fx.punch = secondi dall'ultimo colpo,
// c.fx.starsUntil = fino a quando girano le stelline. Da chiamare dopo animateCharacter.
const mix = (v, to, k) => v * (1 - k) + to * k;
export function actCharacter(c, a, dt, t) {
  const fx = c.fx || (c.fx = { crouch: 0, guard: 0, punch: 9, starsUntil: 0 });
  fx.crouch += ((a.crouch ? 1 : 0) - fx.crouch) * Math.min(1, dt * 12);
  fx.guard += ((a.guard ? 1 : 0) - fx.guard) * Math.min(1, dt * 14);
  fx.punch += dt;
  // abbassato: cosce avanti, ginocchia piegate in avanti (stinchi indietro), il corpo scende e si sporge un po'
  if (fx.crouch > 0.005) {
    const k = fx.crouch;
    c.root.position.y -= 0.3 * k;
    for (let i = 0; i < 2; i++) {
      c.legs[i].rotation.x = mix(c.legs[i].rotation.x, 1.25, k);
      c.knees[i].rotation.x = mix(c.knees[i].rotation.x, -2.05, k);
    }
    c.torso.rotation.x = -0.18 * k;
    c.head.rotation.x += 0.12 * k;
  }
  // parata: braccia avanti con i gomiti piegati, avambracci davanti al viso
  if (fx.guard > 0.005) {
    const g = fx.guard;
    for (let i = 0; i < 2; i++) {
      c.arms[i].rotation.x = mix(c.arms[i].rotation.x, 0.95, g);
      c.arms[i].rotation.z = mix(c.arms[i].rotation.z, i ? -0.28 : 0.28, g);
      c.elbows[i].rotation.x = mix(c.elbows[i].rotation.x, 1.75, g);
      c.elbows[i].rotation.z = mix(c.elbows[i].rotation.z, i ? -0.35 : 0.35, g);
    }
  }
  // colpo con il braccio destro, dall'alto in basso: il braccio sale sopra la testa con il gomito piegato (0,15 s),
  // cala distendendosi con il colpo davanti a sé (0,12 s) e poi torna giù lungo il fianco (0,23 s)
  if (fx.punch < 0.5) {
    const p = fx.punch,
      arm = c.arms[1],
      elbow = c.elbows[1];
    const up = p < 0.15 ? p / 0.15 : 1,
      down = p < 0.15 ? 0 : p < 0.27 ? (p - 0.15) / 0.12 : 1;
    const back = p < 0.27 ? 1 : 1 - (p - 0.27) / 0.23;
    arm.rotation.x = mix(arm.rotation.x, (3.0 * up - 2.2 * down) * back + 0.8 * down * back, back);
    arm.rotation.z = mix(arm.rotation.z, -0.12, back);
    elbow.rotation.x = mix(elbow.rotation.x, 1.1 * up * (1 - down), back);
    c.torso.rotation.y = -0.2 * back * up;
    c.head.rotation.x += -0.08 * down * back;
  }
  // stelline
  const st = fx.starsUntil > t ? stars(c) : c.stars;
  if (st) {
    st.visible = fx.starsUntil > t;
    if (st.visible) {
      st.position.y = 1.98 - 0.3 * fx.crouch;
      st.children.forEach((m, i) => {
        const ang = t * 4 + (i / 5) * Math.PI * 2;
        m.position.set(Math.cos(ang) * 0.27, 0.04 * Math.sin(t * 6 + i), Math.sin(ang) * 0.27);
        m.rotation.y = -ang;
      });
    }
  }
}

// Camminata con ginocchia e gomiti; il collo gira la testa verso dove si guarda (c.lookYaw, c.lookPitch),
// da fermo respira e si guarda un po' intorno.
export function animateCharacter(c, speed, dt, t) {
  const amt = Math.min(1, speed / SPEED);
  c.phase += dt * (4 + (6 * speed) / SPEED);
  const sw = Math.sin(c.phase) * 0.7 * amt;
  c.legs[0].rotation.x = sw;
  c.legs[1].rotation.x = -sw;
  // ginocchio: si piega quando la gamba va indietro e quando torna avanti (mai al contrario)
  c.knees[0].rotation.x = -(Math.max(0, -Math.sin(c.phase)) * 1.1 + 0.08) * amt;
  c.knees[1].rotation.x = -(Math.max(0, Math.sin(c.phase)) * 1.1 + 0.08) * amt;
  c.arms[0].rotation.x = -sw * 0.8;
  c.arms[1].rotation.x = sw * 0.8;
  c.arms[0].rotation.z = -0.04;
  c.arms[1].rotation.z = 0.04;
  // gomiti un po' piegati, di più camminando
  for (const e of c.elbows) {
    e.rotation.x = 0.12 + 0.45 * amt;
    e.rotation.z = 0;
  }
  c.root.position.y = Math.abs(Math.cos(c.phase)) * 0.03 * amt + (1 - amt) * Math.sin(t * 2) * 0.004;
  c.torso.rotation.y = Math.sin(c.phase) * 0.05 * amt;
  c.torso.rotation.x = 0;
  const remaining = Math.max(0, c.expressionEnd - t);
  const envelope = Math.min(1, remaining * 4, Math.max(0, (1.2 - remaining) * 7));
  const laugh = c.expression === 'laugh';
  // collo: la testa segue lo sguardo (morbida), più un piccolo dondolio da fermo
  const yaw = Math.max(-0.9, Math.min(0.9, c.lookYaw || 0)),
    pitch = Math.max(-0.5, Math.min(0.5, c.lookPitch || 0));
  c.neckYaw = (c.neckYaw || 0) + (yaw - (c.neckYaw || 0)) * Math.min(1, dt * 6);
  c.neckPitch = (c.neckPitch || 0) + (pitch - (c.neckPitch || 0)) * Math.min(1, dt * 6);
  c.head.rotation.x =
    c.neckPitch + envelope * (laugh ? -0.12 * (0.6 + 0.4 * Math.cos(remaining * 24)) : -0.16);
  c.head.rotation.y = c.neckYaw + (1 - amt) * Math.sin(t * 0.6) * 0.12;
  c.head.position.y = 1.32 + envelope * (laugh ? 0.01 * Math.abs(Math.sin(remaining * 20)) : 0.012);
}
