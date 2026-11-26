// Carte vere sui tavoli di UNO, Scopa, Briscola e Briscola in cinque della sala tavoli.
// I pezzi vengono da Blender (blender/carte.blend → models/carte.glb): una carta sottile (7,5 × 12 cm, 1,5 mm) e un
// mazzo (stessa pianta, 2,5 cm, bordo a righe). Le carte sul tavolo sono DATI: {c: carta o null se coperta e ignota,
// x, z: metri dal centro del tavolo, a: rotazione, up: scoperta, y: strato}; i mazzi {x, z, a, h: altezza, y}.
// Così più avanti si può mostrare la partita vera cambiando solo i dati.
// Per ogni tavolo tutte le facce scoperte stanno in un unico atlante (canvas) e le carte diventano tre oggetti:
// facce (atlante), retri (un'immagine per tipo di mazzo) e bordi dei mazzi.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { sicilianSVG } from '../sicilian-cards.js?v=76f57bc2d0';

const T = 0.0015,
  DECK = 0.025,
  TOP = 0.836,
  LAYER = 0.0016;
const CELL_W = 160,
  CELL_H = 256; // stesso rapporto della carta (100 × 160 nell'SVG delle napoletane)

const N = (rank, suit) => ({ rank, suit }),
  U = (color, value) => ({ color, value });
const ROT = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

// giocatori: [x, z, rotazione] della mano; la rotazione porta il fondo della carta verso il giocatore
const SIDES = [
  [0.7, 0, Math.PI / 2],
  [-0.7, 0, -Math.PI / 2]
];
const LONG = [
  [-0.36, -0.42, Math.PI],
  [0.36, -0.42, Math.PI],
  [0, 0.42, 0]
];

// mano coperta a ventaglio davanti a un giocatore (perno 10 cm verso di lui)
function fan(n, [hx, hz, yaw]) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * 0.15,
      [dx, dz] = ROT(-0.1 * Math.sin(t), 0.1 - 0.1 * Math.cos(t), yaw);
    out.push({ c: null, x: hx + dx, z: hz + dz, a: yaw + t, up: false, y: i });
  }
  return out;
}
// mucchietto delle prese, coperto e di traverso, alla destra del giocatore
function taken([hx, hz, yaw], h) {
  const [dx, dz] = ROT(0.22, -0.02, yaw);
  return { x: hx + dx, z: hz + dz, a: yaw + Math.PI / 2, h, y: 0 };
}

export const CARD_LAYOUTS = {
  uno: {
    kind: 'uno',
    cards: [
      { c: U('green', '7'), x: 0.09, z: 0.005, a: -0.3, up: true, y: 0 },
      { c: U('blue', '7'), x: 0.1, z: -0.01, a: 0.16, up: true, y: 1 },
      { c: U('blue', 'reverse'), x: 0.085, z: 0, a: -0.05, up: true, y: 2 },
      ...fan(7, SIDES[0]),
      ...fan(5, SIDES[1])
    ],
    decks: [{ x: -0.1, z: 0, a: 0, h: 0.03, y: 0 }]
  },
  scopa: {
    kind: 'napoletane',
    cards: [
      ...[N(7, 1), N(3, 0), N(10, 2), N(5, 3)].map((c, i) => ({
        c,
        x: 0.05,
        z: -0.15 + i * 0.1,
        a: Math.PI / 2,
        up: true,
        y: 0
      })),
      ...fan(3, SIDES[0]),
      ...fan(3, SIDES[1])
    ],
    decks: [{ x: -0.2, z: 0, a: Math.PI / 2, h: 0.016, y: 0 }, taken(SIDES[0], 0.006), taken(SIDES[1], 0.01)]
  },
  briscola: {
    kind: 'napoletane',
    cards: [
      { c: N(4, 3), x: -0.17, z: 0, a: 0, up: true, y: 0 }, // la briscola, sotto il mazzo e di traverso
      { c: N(1, 1), x: 0.1, z: -0.05, a: Math.PI / 2 + 0.12, up: true, y: 0 },
      { c: N(10, 0), x: 0.14, z: 0.06, a: -Math.PI / 2 - 0.1, up: true, y: 1 },
      ...fan(3, SIDES[0]),
      ...fan(3, SIDES[1])
    ],
    decks: [{ x: -0.22, z: 0, a: Math.PI / 2, h: 0.02, y: 1 }, taken(SIDES[0], 0.008), taken(SIDES[1], 0.005)]
  },
  'briscola-in-cinque': {
    kind: 'napoletane',
    cards: [
      // le 5 carte giocate ad arco al centro
      ...[N(3, 2), N(1, 2), N(8, 2), N(2, 1), N(10, 3)].map((c, k) => {
        const f = -1 + k * 0.5;
        return { c, x: 0.2 * Math.sin(f), z: -0.14 + 0.2 * Math.cos(f), a: f, up: true, y: k };
      }),
      ...[...SIDES, ...LONG].flatMap(p => fan(6, p))
    ],
    decks: []
  }
};

const cardId = c => (c.rank ? c.rank + '-' + c.suit : c.color + '-' + c.value);

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
const UNO = { red: '#a8443c', yellow: '#ecc34f', blue: '#376ba7', green: '#408463' };
const UNO_SYMBOLS = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '✦', wild4: '+4' };
// faccia UNO nello stile dell'app (.uno-card in app.css): bordo crema, angoli tondi, simbolo grande al centro
function drawUno(g, x, y, c) {
  g.fillStyle = '#f5efdf';
  g.fillRect(x, y, CELL_W, CELL_H);
  g.save();
  roundRect(g, x + 9, y + 9, CELL_W - 18, CELL_H - 18, 20);
  g.clip();
  if (UNO[c.color]) {
    g.fillStyle = UNO[c.color];
    g.fillRect(x, y, CELL_W, CELL_H);
  } else {
    const grad = g.createLinearGradient(x, y, x + CELL_W, y + CELL_H);
    ['#bd4e47', '#4b8b62', '#426da8', '#d1aa43'].forEach((col, i) => {
      grad.addColorStop(i / 4, col);
      grad.addColorStop((i + 1) / 4, col);
    });
    g.fillStyle = grad;
    g.fillRect(x, y, CELL_W, CELL_H);
  }
  g.restore();
  const sym = UNO_SYMBOLS[c.value] || c.value;
  g.fillStyle = c.color === 'yellow' ? '#342d18' : '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 72px system-ui, Arial, sans-serif';
  g.fillText(sym, x + CELL_W / 2, y + CELL_H / 2);
  g.font = '900 28px system-ui, Arial, sans-serif';
  g.fillText(sym, x + 30, y + 34);
  g.save();
  g.translate(x + CELL_W - 30, y + CELL_H - 34);
  g.rotate(Math.PI);
  g.fillText(sym, 0, 0);
  g.restore();
}

// retri: margine bianco (lo usano anche i bordi della carta), napoletane bordeaux con un motivo a rombi, UNO scuro
function backTexture(kind) {
  const c = document.createElement('canvas');
  c.width = CELL_W;
  c.height = CELL_H;
  const g = c.getContext('2d');
  g.fillStyle = '#f5efdf';
  g.fillRect(0, 0, CELL_W, CELL_H);
  roundRect(g, 9, 9, CELL_W - 18, CELL_H - 18, 14);
  g.save();
  g.clip();
  if (kind === 'uno') {
    g.fillStyle = '#1e1b22';
    g.fillRect(0, 0, CELL_W, CELL_H);
    g.translate(CELL_W / 2, CELL_H / 2);
    g.rotate(-0.5);
    g.fillStyle = '#a8443c';
    g.beginPath();
    g.ellipse(0, 0, 58, 96, 0, 0, 2 * Math.PI);
    g.fill();
    g.fillStyle = '#ecc34f';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 900 50px system-ui, Arial, sans-serif';
    g.fillText('UNO', 0, 0);
  } else {
    g.fillStyle = '#741f2c';
    g.fillRect(0, 0, CELL_W, CELL_H);
    g.strokeStyle = '#9a3b47';
    g.lineWidth = 3;
    for (let k = -CELL_H; k < CELL_W + CELL_H; k += 18) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + CELL_H, CELL_H);
      g.moveTo(k, 0);
      g.lineTo(k - CELL_H, CELL_H);
      g.stroke();
    }
    g.strokeStyle = '#d1aa5c';
    g.lineWidth = 3;
    roundRect(g, 20, 20, CELL_W - 40, CELL_H - 40, 8);
    g.stroke();
    g.fillStyle = '#d1aa5c';
    g.beginPath();
    g.moveTo(CELL_W / 2, CELL_H / 2 - 34);
    g.lineTo(CELL_W / 2 + 22, CELL_H / 2);
    g.lineTo(CELL_W / 2, CELL_H / 2 + 34);
    g.lineTo(CELL_W / 2 - 22, CELL_H / 2);
    g.fill();
  }
  g.restore();
  return texture(c);
}

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // come le texture del glb: v = 0 in alto
  t.anisotropy = 4;
  return t;
}

// atlante delle facce scoperte di un tavolo; le napoletane sono SVG, si disegnano quando l'immagine è pronta
function atlas(kind, faces) {
  const cols = Math.max(1, Math.min(8, faces.length)),
    rows = Math.max(1, Math.ceil(faces.length / cols));
  const canvas = document.createElement('canvas');
  canvas.width = cols * CELL_W;
  canvas.height = rows * CELL_H;
  const g = canvas.getContext('2d'),
    tex = texture(canvas);
  faces.forEach((c, i) => {
    const x = (i % cols) * CELL_W,
      y = Math.floor(i / cols) * CELL_H;
    if (kind === 'uno') return drawUno(g, x, y, c);
    g.fillStyle = '#fff7e0';
    g.fillRect(x, y, CELL_W, CELL_H);
    const img = new Image();
    img.onload = () => {
      g.drawImage(img, x, y, CELL_W, CELL_H);
      tex.needsUpdate = true;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sicilianSVG(c));
  });
  return { tex, cols, rows };
}

// pezzi del glb: geometria (già nella posizione del file) e materiale, per oggetto e materiale
export function cardParts(gltf) {
  const parts = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const obj = o.name.startsWith('mazzo') ? 'mazzo' : 'carta';
    parts[obj + ':' + o.material.name] = {
      geo: o.geometry.clone().applyMatrix4(o.matrixWorld),
      mat: o.material
    };
  });
  return parts;
}

// le carte di un tavolo (centro tx, tz) in tre oggetti; restituisce i Mesh da aggiungere alla scena
export function buildCardTable(parts, layout, tx, tz) {
  const front = parts['carta:carta_fronte'],
    back = parts['carta:carta_retro'];
  const deckBack = parts['mazzo:carta_retro'],
    deckEdge = parts['mazzo:mazzo_bordo'];
  if (!front || !back) return [];
  const ids = [],
    faces = [];
  for (const k of layout.cards)
    if (k.up && !ids.includes(cardId(k.c))) {
      ids.push(cardId(k.c));
      faces.push(k.c);
    }
  const { tex, cols, rows } = atlas(layout.kind, faces);
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    p = new THREE.Vector3(),
    s = new THREE.Vector3();
  const fronts = [],
    backs = [],
    edges = [];
  for (const k of layout.cards) {
    // coperta: girata sul lato lungo, così il fondo resta dalla stessa parte
    e.set(0, k.a, k.up ? 0 : Math.PI, 'YXZ');
    m.compose(
      p.set(tx + k.x, TOP + k.y * LAYER + (k.up ? 0 : T), tz + k.z),
      q.setFromEuler(e),
      s.set(1, 1, 1)
    );
    backs.push(back.geo.clone().applyMatrix4(m));
    if (!k.up) continue;
    const geo = front.geo.clone().applyMatrix4(m),
      uv = geo.attributes.uv,
      i = ids.indexOf(cardId(k.c));
    const cx = i % cols,
      cy = Math.floor(i / cols);
    for (let v = 0; v < uv.count; v++) uv.setXY(v, (cx + uv.getX(v)) / cols, (cy + uv.getY(v)) / rows);
    fronts.push(geo);
  }
  for (const d of layout.decks) {
    e.set(0, d.a, 0, 'YXZ');
    m.compose(p.set(tx + d.x, TOP + d.y * LAYER, tz + d.z), q.setFromEuler(e), s.set(1, d.h / DECK, 1));
    if (deckBack) backs.push(deckBack.geo.clone().applyMatrix4(m));
    if (deckEdge) edges.push(deckEdge.geo.clone().applyMatrix4(m));
  }
  const out = [];
  const add = (list, mat, cast) => {
    if (!list.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    mesh.receiveShadow = true;
    mesh.castShadow = cast;
    out.push(mesh);
  };
  add(fronts, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), false);
  add(backs, new THREE.MeshStandardMaterial({ map: backTexture(layout.kind), roughness: 0.55 }), false);
  if (deckEdge) add(edges, deckEdge.mat, true);
  return out;
}
