// Scarabeo vero sul suo tavolo della sala tavoli.
// I pezzi vengono da Blender (blender/scarabeo.blend → models/scarabeo.glb): plancia (72 cm, griglia di 68 cm con
// 17 × 17 caselle), tessera (3,7 cm, 6 mm, faccia con UV su tutta la tessera), leggio e sacchetto di tela.
// Le tessere sono DATI: sulla plancia [riga, colonna, lettera], nei leggii le lettere di ciascun giocatore; così più
// avanti si può mostrare la partita vera. Le facce delle tessere stanno in un unico atlante e i pezzi uguali sono
// uniti in un oggetto per materiale.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { SIZE, VALUES, premium } from '../scarabeo-data.js?v=13ed831283';

const CLOTH = 0.835,
  BOARD_TOP = 0.012,
  PITCH = 0.04,
  TILE = 0.037,
  THICK = 0.006;
const LETTERS = Object.keys(VALUES); // 21 lettere e il jolly '?'
const CELL = 128,
  COLS = 8;

// partita di esempio: PAROLA in orizzontale sulla stella centrale, SALE in verticale sulla L
export const SCARABEO_LAYOUT = {
  board: [...[...'PAROLA'].map((l, i) => [8, 5 + i, l]), [6, 9, 'S'], [7, 9, 'A'], [9, 9, 'E']],
  // leggii: x del centro e rotazione (verso il giocatore seduto a x ± 1,24), lettere da sinistra a destra
  racks: [
    { x: 0.62, a: Math.PI / 2, letters: 'EINTRCOA' },
    { x: -0.62, a: -Math.PI / 2, letters: 'MUSIC?EV' }
  ],
  bag: { x: -0.5, z: -0.43, a: 0.6 }
};

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // come le texture del glb: v = 0 in alto
  t.anisotropy = 4;
  return t;
}

// tessere: avorio, lettera grande scura, punti piccoli in basso a destra
function tileAtlas() {
  const c = document.createElement('canvas');
  c.width = COLS * CELL;
  c.height = Math.ceil(LETTERS.length / COLS) * CELL;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  LETTERS.forEach((l, i) => {
    const x = (i % COLS) * CELL,
      y = Math.floor(i / COLS) * CELL;
    g.fillStyle = '#efe2bf';
    g.fillRect(x, y, CELL, CELL);
    g.fillStyle = '#3a2a1a';
    g.font = 'bold 84px Georgia, serif';
    g.fillText(l, x + CELL / 2 - 6, y + CELL / 2 + 2);
    g.font = 'bold 26px Georgia, serif';
    g.fillText(String(VALUES[l]), x + CELL - 20, y + CELL - 20);
  });
  return texture(c);
}

// caselle della plancia con i premi (stessa regola dell'app: premium in scarabeo-data.js)
function boardTexture() {
  const px = 60,
    c = document.createElement('canvas');
  c.width = c.height = SIZE * px;
  const g = c.getContext('2d');
  const color = { '3P': '#b84a3f', '2P': '#d9a0a0', '3L': '#4f7fa3', '2L': '#9cc0d6', '': '#d8cba5' };
  g.fillStyle = '#5a1620';
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 19px Arial, sans-serif';
  for (let r = 0; r < SIZE; r++)
    for (let col = 0; col < SIZE; col++) {
      const p = r === 8 && col === 8 ? '★' : premium(r, col);
      g.fillStyle = p === '★' ? '#e0b44c' : color[p];
      g.fillRect(col * px + 2, r * px + 2, px - 4, px - 4);
      if (p) {
        g.fillStyle = p === '★' ? '#6b4a16' : '#fff8e6';
        g.font = p === '★' ? '38px serif' : 'bold 19px Arial, sans-serif';
        g.fillText(p, col * px + px / 2, r * px + px / 2);
      }
    }
  return texture(c);
}

// pezzi del glb per materiale (geometria già nella posizione del file)
function parts(gltf) {
  const out = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (o.isMesh)
      out[o.material.name] = { geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: o.material };
  });
  return out;
}

export function buildScarabeoTable(gltf, layout, tx, tz) {
  const P = parts(gltf);
  if (!P.tessera_faccia || !P.plancia_caselle) return [];
  const lists = {}; // materiale → geometrie da unire
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    p = new THREE.Vector3(),
    one = new THREE.Vector3(1, 1, 1);
  const put = (name, matrix, uvCell) => {
    if (!P[name]) return;
    const geo = P[name].geo.clone().applyMatrix4(matrix);
    if (uvCell != null) {
      const uv = geo.attributes.uv,
        rows = Math.ceil(LETTERS.length / COLS),
        cx = uvCell % COLS,
        cy = Math.floor(uvCell / COLS);
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (cx + uv.getX(v)) / COLS, (cy + uv.getY(v)) / rows);
    }
    (lists[name] ||= []).push(geo);
  };
  const tile = (letter, matrix) => {
    put('tessera_faccia', matrix, Math.max(0, LETTERS.indexOf(letter)));
    put('tessera_lato', matrix);
  };
  // plancia: girata come il leggio di chi siede a x positivo, così le parole si leggono dal suo posto
  const boardYaw = Math.PI / 2;
  const boardM = new THREE.Matrix4().compose(
    p.set(tx, CLOTH, tz),
    q.setFromEuler(e.set(0, boardYaw, 0)),
    one
  );
  put('plancia_caselle', boardM);
  put('plancia_bordo', boardM);
  for (const [r, c, l] of layout.board) {
    const local = new THREE.Matrix4().makeTranslation((c - 8) * PITCH, BOARD_TOP + 0.0003, (r - 8) * PITCH);
    tile(l, boardM.clone().multiply(local));
  }
  // leggii: le tessere poggiano sul fondo e si appoggiano alla parete inclinata di 15 gradi (leggio in scarabeo.blend)
  const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (75 * Math.PI) / 180);
  for (const rack of layout.racks) {
    const rackM = new THREE.Matrix4().compose(
      p.set(tx + rack.x, CLOTH, tz),
      q.setFromEuler(e.set(0, rack.a, 0)),
      one
    );
    put('leggio_legno', rackM);
    [...rack.letters].forEach((l, k) => {
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3((k - 3.5) * PITCH, 0.0259, 0.0072),
        lean,
        one
      );
      tile(l, rackM.clone().multiply(local));
    });
  }
  const bag = layout.bag;
  if (bag) {
    m.compose(p.set(tx + bag.x, CLOTH, tz + bag.z), q.setFromEuler(e.set(0, bag.a, 0)), one);
    put('sacchetto_tela', m);
    put('sacchetto_laccio', m);
  }
  const maps = { tessera_faccia: tileAtlas(), plancia_caselle: boardTexture() };
  const out = [];
  for (const [name, list] of Object.entries(lists)) {
    let mat = P[name].mat;
    if (maps[name]) mat = new THREE.MeshStandardMaterial({ map: maps[name], roughness: 0.6 });
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    mesh.castShadow = name !== 'plancia_caselle' && name !== 'tessera_faccia';
    mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}
