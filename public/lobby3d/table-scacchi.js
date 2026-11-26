// Scacchi e Dama veri sui loro tavoli della sala tavoli.
// I pezzi vengono da Blender (blender/scacchi.blend → models/scacchi.glb): scacchiera di legno intarsiato (50 cm,
// caselle da 5,5 cm, cornice di 3 cm; il piano ha le UV e si disegna qui), pezzi Staunton torniti (re 10 cm) e pedina
// della dama col bordo a righe. Le partite sono DATI (pezzo e casella), così più avanti si può mostrare quella vera.
// Il Bianco siede a x positivo: la traversa 1 è dal suo lato e la colonna «a» alla sua sinistra.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';

const CLOTH = 0.835,
  TOP = 0.0221, // piano della scacchiera
  SQ = 0.055,
  HALF = 0.248, // mezzo lato del piano disegnato
  DISC = 0.0094; // spessore di una pedina
const WOOD = { white: '#d9b980', black: '#2a1c14' };
const DISCS = { white: '#ece6d8', black: '#1c1a19' };

// Partita Italiana: 1.e4 e5 2.Cf3 Cc6 3.Ac4 Ac5 4.c3 Cf6 5.d4 exd4 6.cxd4 Ab4+ 7.Ad2 Axd2+ 8.Cbxd2 d5 9.exd5 Cxd5
// 10.Db3 Cce7 11.O-O O-O. Maiuscole bianchi, minuscole neri (K re, Q donna, R torre, B alfiere, N cavallo, P pedone)
export const CHESS_LAYOUT = {
  board:
    'Kg1 Qb3 Ra1 Rf1 Bc4 Nf3 Nd2 Pa2 Pb2 Pd4 Pf2 Pg2 Ph2 kg8 qd8 ra8 rf8 bc8 nd5 ne7 pa7 pb7 pc7 pf7 pg7 ph7',
  // pezzi mangiati, in fila accanto alla scacchiera alla destra di chi li ha presi
  taken: { white: 'bpp', black: 'BPP' }
};

// Dama italiana a metà partita: caselle scure come nell'app ((colonna + traversa) pari, con a = 0).
// D e d sono dame (due pedine impilate); taken: pedine mangiate da ciascuno, in pila accanto alla scacchiera
export const DAMA_LAYOUT = {
  board: 'Pb1 Pd1 Ph1 Pc2 Pe2 Pg2 Pd3 Ph3 Pe4 Dg6 pa8 pe8 pg8 pb7 pd7 ph7 pc6 pe6 pd5',
  taken: { white: 3, black: 2 }
};

const MODEL = { K: 're', Q: 'donna', R: 'torre', B: 'alfiere', N: 'cavallo', P: 'pedone' };
// centro di una casella, nel sistema della scacchiera
const square = s => ({ x: (4.5 - Number(s[1])) * SQ, z: (3.5 - 'abcdefgh'.indexOf(s[0])) * SQ });

// piano: caselle di acero e noce, cornice scura; per gli scacchi lettere e numeri letti dal posto del Bianco
function boardTexture(darkOf, labels) {
  const W = 1024,
    k = W / (2 * HALF),
    c = document.createElement('canvas');
  c.width = c.height = W;
  const g = c.getContext('2d');
  const px = (x, z) => [(x + HALF) * k, (HALF + z) * k]; // immagine: in alto z negativo, a sinistra x negativo
  g.fillStyle = '#3b2414';
  g.fillRect(0, 0, W, W);
  const grain = (x, y, w, h, base) => {
    g.fillStyle = base;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 0.08;
    g.strokeStyle = '#000';
    for (let i = 0; i < 6; i++) {
      const yy = y + ((i + 0.5) * h) / 6 + Math.sin(x + i) * 2;
      g.beginPath();
      g.moveTo(x, yy);
      g.lineTo(x + w, yy + Math.cos(y + i) * 3);
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  for (let f = 0; f < 8; f++)
    for (let r = 1; r <= 8; r++) {
      const { x, z } = square('abcdefgh'[f] + r),
        [cx, cy] = px(x, z),
        s = SQ * k;
      grain(cx - s / 2, cy - s / 2, s, s, darkOf(f, r) ? '#6b4527' : '#e3c99a');
    }
  g.strokeStyle = '#c9a25a';
  g.lineWidth = 3;
  g.strokeRect((HALF - 4 * SQ) * k, (HALF - 4 * SQ) * k, 8 * SQ * k, 8 * SQ * k);
  if (labels) {
    g.fillStyle = '#d8b77a';
    g.font = 'bold 30px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const text = (t, x, z) => {
      const [cx, cy] = px(x, z);
      g.save();
      g.translate(cx, cy);
      g.rotate(-Math.PI / 2); // in alto verso il Nero
      g.fillText(t, 0, 0);
      g.restore();
    };
    const edge = 4 * SQ + 0.015;
    for (let i = 0; i < 8; i++) {
      const { x, z } = square('abcdefgh'[i] + (i + 1));
      text('abcdefgh'[i], edge, z);
      text('abcdefgh'[i], -edge, z);
      text(String(i + 1), x, edge);
      text(String(i + 1), x, -edge);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // come le texture del glb: v = 0 in alto
  t.anisotropy = 8;
  return t;
}

function parts(gltf) {
  const out = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const owner = o.parent && o.parent !== gltf.scene ? o.parent.name : o.name;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (o.material.name === 'pezzo' || o.material.name === 'pedina') geo.deleteAttribute('uv'); // senza texture
    out[owner + '|' + o.material.name] = { geo, mat: o.material };
  });
  return out;
}

function builder(P, tx, tz) {
  const lists = {};
  const one = new THREE.Vector3(1, 1, 1),
    up = new THREE.Vector3(0, 1, 0);
  const put = (part, key, x, y, z, yaw = 0) => {
    if (!P[part]) return;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(tx + x, CLOTH + y, tz + z),
      new THREE.Quaternion().setFromAxisAngle(up, yaw),
      one
    );
    (lists[key] ||= []).push(P[part].geo.clone().applyMatrix4(m));
  };
  const finish = (board, colors, partMat) => {
    const out = [];
    for (const [key, list] of Object.entries(lists)) {
      let mat;
      if (key === 'piano')
        mat = new THREE.MeshStandardMaterial({ map: board, roughness: 0.32, metalness: 0 });
      else if (key === 'legno') mat = P['scacchiera|legno'].mat;
      else {
        mat = P[partMat].mat.clone();
        mat.color.set(colors[key]);
      }
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      mesh.castShadow = key !== 'piano';
      mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  };
  return { put, finish };
}

export function buildChessTable(gltf, layout, tx, tz) {
  const P = parts(gltf);
  if (!P['scacchiera|piano'] || !P['re|pezzo']) return [];
  const { put, finish } = builder(P, tx, tz);
  put('scacchiera|legno', 'legno', 0, 0, 0);
  put('scacchiera|piano', 'piano', 0, 0, 0);
  for (const item of layout.board.split(' ')) {
    const letter = item[0],
      side = letter === letter.toUpperCase() ? 'white' : 'black',
      { x, z } = square(item.slice(1));
    // il cavallo guarda l'avversario: nel modello il muso è verso +x
    put(MODEL[letter.toUpperCase()] + '|pezzo', side, x, TOP, z, side === 'white' ? Math.PI : 0);
  }
  // mangiati: il Bianco li mette alla sua destra (z negativo), il Nero alla sua (z positivo)
  for (const [side, pieces] of Object.entries(layout.taken)) {
    const s = side === 'white' ? 1 : -1;
    [...pieces].forEach((letter, i) => {
      const owner = letter === letter.toUpperCase() ? 'white' : 'black';
      put(MODEL[letter.toUpperCase()] + '|pezzo', owner, s * (0.16 - i * 0.045), 0, -s * 0.33);
    });
  }
  return finish(
    boardTexture((f, r) => (f + r) % 2 === 1, true),
    WOOD,
    're|pezzo'
  );
}

export function buildDamaTable(gltf, layout, tx, tz) {
  const P = parts(gltf);
  if (!P['scacchiera|piano'] || !P['pedina|pedina']) return [];
  const { put, finish } = builder(P, tx, tz);
  put('scacchiera|legno', 'legno', 0, 0, 0);
  put('scacchiera|piano', 'piano', 0, 0, 0);
  for (const item of layout.board.split(' ')) {
    const side = item[0] === item[0].toUpperCase() ? 'white' : 'black',
      { x, z } = square(item.slice(1)),
      height = item[0].toUpperCase() === 'D' ? 2 : 1;
    for (let k = 0; k < height; k++) put('pedina|pedina', side, x, TOP + k * DISC, z, k * 0.7);
  }
  // pedine mangiate: in pila alla destra di chi le ha prese
  for (const [side, count] of Object.entries(layout.taken)) {
    const s = side === 'white' ? 1 : -1,
      color = side === 'white' ? 'black' : 'white';
    for (let k = 0; k < count; k++) put('pedina|pedina', color, s * 0.12, k * DISC, -s * 0.33, k);
  }
  return finish(
    boardTexture((f, r) => (f + r) % 2 === 0, false),
    DISCS,
    'pedina|pedina'
  );
}
