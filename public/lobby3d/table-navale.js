// Battaglia navale vera sul suo tavolo della sala tavoli.
// I pezzi vengono da Blender (blender/navale.blend → models/navale.glb): valigetta di plastica classica (base 26 × 25
// cm e coperchio in piedi che fa da paravento), griglia 10 × 10 da 1,9 cm, navi da 2 a 5 caselle e piolo.
// La partita è fatta di DATI: la flotta di ciascuno e i colpi ricevuti. Sul coperchio di un giocatore ci sono i
// colpi che ha sparato (rossi se hanno preso una nave dell'altro), sulla base i colpi ricevuti; così più avanti si
// può mostrare la partita vera. I pezzi uguali sono uniti in un oggetto per materiale.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

const CLOTH = 0.835,
  PITCH = 0.019,
  BASE_TOP = 0.0303, // piano della griglia sulla base
  HINGE_Y = 0.03, // cerniera del coperchio, sul bordo lontano della base
  HINGE_X = 0.1, // distanza della cerniera dal centro del tavolo
  TILT = -0.2, // il coperchio pende un poco all'indietro, verso il centro
  HULL = 0.007; // altezza dello scafo: i pioli rossi sulla base stanno sopra la nave
const RED = '#d8312a',
  WHITE = '#f2f0ea';

// x e z del centro di una casella nel sistema della valigetta (+z verso il giocatore, +x alla sua destra)
const cellX = c => -0.085 + PITCH * (c + 0.5);
const cellZ = r => 0.045 + PITCH * (r + 0.5);
const cellUp = r => 0.21 - PITCH * (r + 0.5); // sul coperchio, dal basso

// flotta: [riga, colonna, lunghezza, verticale]; shots: caselle (riga * 10 + colonna) colpite dall'avversario
export const NAVALE_LAYOUT = [
  {
    side: 1,
    color: '#2659b0',
    fleet: [
      [1, 1, 5, false],
      [3, 8, 4, true],
      [6, 2, 3, false],
      [8, 5, 3, false],
      [4, 0, 2, true]
    ],
    shots: [12, 13, 48, 64, 55, 22, 70, 99, 5, 36, 91]
  },
  {
    side: -1,
    color: '#b8322c',
    fleet: [
      [2, 7, 5, true],
      [8, 1, 4, false],
      [0, 2, 3, false],
      [5, 3, 3, true],
      [3, 0, 2, false]
    ],
    shots: [37, 47, 3, 81, 15, 44, 60, 92, 29, 66, 19]
  }
];

const cellsOf = fleet =>
  new Set(
    fleet.flatMap(([r, c, n, v]) =>
      Array.from({ length: n }, (_, k) => (r + (v ? k : 0)) * 10 + c + (v ? 0 : k))
    )
  );

// griglia: mare blu con i fori, lettere A-J a sinistra e numeri 1-10 in alto (stessa per base e coperchio)
function gridTexture() {
  const px = 440,
    m = 50,
    cell = 38,
    c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e4da';
  g.fillRect(0, 0, px, px);
  g.fillStyle = '#2d6597';
  g.fillRect(m - 3, m - 3, cell * 10 + 6, cell * 10 + 6);
  g.strokeStyle = '#7fa7c9';
  g.lineWidth = 1.5;
  for (let k = 0; k <= 10; k++) {
    g.beginPath();
    g.moveTo(m + k * cell, m);
    g.lineTo(m + k * cell, m + cell * 10);
    g.moveTo(m, m + k * cell);
    g.lineTo(m + cell * 10, m + k * cell);
    g.stroke();
  }
  for (let r = 0; r < 10; r++)
    for (let col = 0; col < 10; col++) {
      const x = m + (col + 0.5) * cell,
        y = m + (r + 0.5) * cell;
      g.fillStyle = '#163552';
      g.beginPath();
      g.arc(x, y, 7, 0, 2 * Math.PI);
      g.fill();
      g.fillStyle = '#0b1c2c';
      g.beginPath();
      g.arc(x + 1, y + 1, 5, 0, 2 * Math.PI);
      g.fill();
    }
  g.fillStyle = '#26364a';
  g.font = 'bold 24px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 10; k++) {
    g.fillText('ABCDEFGHIJ'[k], m / 2, m + (k + 0.5) * cell);
    g.fillText(String(k + 1), m + (k + 0.5) * cell, m / 2 + 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // le UV della piastra in navale.blend hanno v = 0 in alto (riga A); l'esportazione glb le capovolge
  t.flipY = true;
  t.anisotropy = 4;
  return t;
}

// pezzi del glb: "oggetto|materiale" (base e coperchio hanno due materiali, plastica e griglia)
function parts(gltf) {
  const out = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const owner = o.parent && o.parent !== gltf.scene ? o.parent.name : o.name;
    out[owner + '|' + o.material.name] = {
      geo: o.geometry.clone().applyMatrix4(o.matrixWorld),
      mat: o.material
    };
  });
  return out;
}

export function buildNavaleTable(gltf, layout, tx, tz) {
  const P = parts(gltf);
  if (!P['valigia_base|plastica'] || !P['piolo|piolo']) return [];
  const lists = {}; // chiave → geometrie da unire
  const put = (part, key, matrix) => {
    if (P[part]) (lists[key] ||= []).push(P[part].geo.clone().applyMatrix4(matrix));
  };
  const one = new THREE.Vector3(1, 1, 1),
    up = new THREE.Vector3(0, 1, 0),
    xAxis = new THREE.Vector3(1, 0, 0);
  const at = (x, y, z, q = new THREE.Quaternion()) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, one);
  const peg = (frame, local, hit) =>
    put('piolo|piolo', hit ? 'piolo_rosso' : 'piolo_bianco', frame.clone().multiply(local));
  for (const player of layout) {
    const enemy = layout.find(p => p !== player);
    // valigetta: origine sulla cerniera, +z locale verso il giocatore seduto a x = side * 1,24
    const frame = at(
      tx + player.side * HINGE_X,
      CLOTH,
      tz,
      new THREE.Quaternion().setFromAxisAngle(up, (player.side * Math.PI) / 2)
    );
    put('valigia_base|plastica', 'plastica' + player.color, frame);
    put('valigia_base|griglia', 'griglia', frame);
    const lid = frame
      .clone()
      .multiply(at(0, HINGE_Y, 0, new THREE.Quaternion().setFromAxisAngle(xAxis, TILT)));
    put('valigia_coperchio|plastica', 'plastica' + player.color, lid);
    put('valigia_coperchio|griglia', 'griglia', lid);
    // navi sulla base: il modello è lungo x, le verticali girano di 90 gradi
    for (const [r, c, n, v] of player.fleet) {
      const mid = (n - 1) / 2;
      const q = new THREE.Quaternion().setFromAxisAngle(up, v ? Math.PI / 2 : 0);
      put(
        'nave_' + n + '|nave',
        'nave',
        frame.clone().multiply(at(cellX(v ? c : c + mid), BASE_TOP, cellZ(v ? r + mid : r), q))
      );
    }
    // colpi ricevuti, sulla base (rossi sopra la nave colpita)
    const mine = cellsOf(player.fleet);
    for (const cell of player.shots) {
      const hit = mine.has(cell);
      peg(frame, at(cellX(cell % 10), BASE_TOP + (hit ? HULL : 0), cellZ(Math.floor(cell / 10))), hit);
    }
    // colpi sparati, sul coperchio: sono i colpi ricevuti dall'avversario; il piolo esce verso il giocatore
    const theirs = cellsOf(enemy.fleet),
      out = new THREE.Quaternion().setFromAxisAngle(xAxis, Math.PI / 2);
    for (const cell of enemy.shots)
      peg(lid, at(cellX(cell % 10), cellUp(Math.floor(cell / 10)), 0.0003, out), theirs.has(cell));
  }
  const grid = new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.45 });
  const out = [];
  for (const [key, list] of Object.entries(lists)) {
    let mat;
    if (key === 'griglia') mat = grid;
    else if (key === 'nave') mat = P['nave_2|nave'].mat;
    else if (key.startsWith('piolo')) {
      mat = P['piolo|piolo'].mat.clone();
      mat.color.set(key === 'piolo_rosso' ? RED : WHITE);
    } else {
      mat = P['valigia_base|plastica'].mat.clone();
      mat.color.set(key.slice('plastica'.length));
    }
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    mesh.castShadow = key !== 'griglia';
    mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}
