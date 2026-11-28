// Carrello dei popcorn e della Binotto Cola della Lobby 3D (docs/macchinetta.md, «Carrello dei popcorn»).
// Solo visivo: niente soldi. Modello di Blender: blender/popcorn.blend → models/popcorn.glb (davanti verso +z, base a
// terra, largo 0,85 m). createPopcorn(gltf) restituisce il carrello (root) e i comandi:
//   hit(object)     → che cosa è stato toccato: un tasto ({type:'key', key}) e lo esegue, o il prodotto pronto
//   play(key)       → prepara 'popcorn', 'cola' o 'tutti' (anche per far vedere quello che fa un altro)
//   update(dt)      → anima pentolino, chicchi che scoppiano, cartoccio, bicchiere, lampadine
//   take()          → prende quello che è pronto: la lista dei prodotti, o null
//   reset()         → torna a «scegli» togliendo quello che era pronto (chi lo usava è andato via)
//   onChange(fn)    → chiamata a ogni cambio di stato (scegli, prepara, pronto)
// I prodotti in mano (makeHeldPopcorn, makeHeldCola) sono a parte, perché in Lobby li porta il personaggio.
import * as THREE from 'three';

export const POPCORN = { id: 'popcorn', name: 'Popcorn', pack: 'cartoccio', bites: 6 };
export const COLA = { id: 'cola', name: 'Binotto Cola', pack: null, bites: 4 };
export const POPCORN_KEYS = [
  { key: 'popcorn', label: 'POPCORN', x: -0.2 },
  { key: 'cola', label: 'COLA', x: 0 },
  { key: 'tutti', label: 'TUTTI E DUE', x: 0.2 }
];

// facce stampate dei pezzi di Blender: le UV arrivano con v = 0 in alto (flipY = false)
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.flipY = false;
  return t;
}
function fitFont(g, text, max, size, family = 'Georgia, serif') {
  g.font = 'bold ' + size + 'px ' + family;
  while (g.measureText(text).width > max && size > 10) g.font = 'bold ' + --size + 'px ' + family;
}
// scritta da circo: crema con l'ombra scura e il filo d'oro
function circus(g, text, x, y, max, size) {
  fitFont(g, text, max, size);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.fillStyle = '#3a0508';
  g.fillText(text, x + size * 0.05, y + size * 0.06);
  g.lineWidth = size * 0.09;
  g.strokeStyle = '#d4a640';
  g.strokeText(text, x, y);
  g.fillStyle = '#fff4d6';
  g.fillText(text, x, y);
}
const signTexture = () =>
  canvasTexture(1024, 224, (g, W, H) => {
    g.fillStyle = '#9e0f17';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#b8141d';
    for (let x = -H; x < W; x += 56) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 28, H);
      g.lineTo(x + 28 + H, 0);
      g.lineTo(x + H, 0);
      g.fill();
    }
    circus(g, 'POPCORN', W / 2, H / 2 + 6, W - 120, 150);
    g.fillStyle = '#d4a640';
    for (const x of [44, W - 44]) {
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5 - Math.PI / 2,
          r = k % 2 ? 12 : 28;
        g.lineTo(x + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
      }
      g.fill();
    }
  });
const sideTexture = () =>
  canvasTexture(512, 448, (g, W, H) => {
    g.fillStyle = '#9e0f17';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d4a640';
    g.lineWidth = 10;
    g.strokeRect(22, 22, W - 44, H - 44);
    circus(g, 'POP', W / 2, H * 0.33, W - 90, 150);
    circus(g, 'CORN', W / 2, H * 0.68, W - 90, 150);
  });
const colaLabel = () =>
  canvasTexture(384, 224, (g, W, H) => {
    g.fillStyle = '#b3121b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, H * 0.72);
    g.bezierCurveTo(W * 0.3, H * 0.5, W * 0.6, H * 0.95, W, H * 0.68);
    g.lineTo(W, H * 0.78);
    g.bezierCurveTo(W * 0.6, H * 1.05, W * 0.3, H * 0.6, 0, H * 0.82);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, 'BINOTTO', W - 30, 72);
    g.fillText('BINOTTO', W / 2, H * 0.24);
    fitFont(g, 'COLA', W - 30, 96);
    g.fillText('COLA', W / 2, H * 0.5);
  });
// bicchierone: il disegno gira tutto intorno (u = 0,5 sul davanti)
const cupTexture = () =>
  canvasTexture(1024, 384, (g, W, H) => {
    g.fillStyle = '#f6f1e7';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#c8141e';
    g.fillRect(0, H * 0.82, W, H * 0.18);
    g.fillRect(0, 0, W, H * 0.08);
    for (const cx of [W * 0.5, 0, W]) {
      g.fillStyle = '#c8141e';
      g.beginPath();
      g.ellipse(cx, H * 0.45, W * 0.17, H * 0.3, 0, 0, 7);
      g.fill();
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitFont(g, 'BINOTTO', W * 0.28, 58);
      g.fillText('BINOTTO', cx, H * 0.36);
      fitFont(g, 'COLA', W * 0.28, 84);
      g.fillText('COLA', cx, H * 0.56);
    }
  });
const keyTexture = label =>
  canvasTexture(128, 128, (g, W, H) => {
    g.fillStyle = '#b3121b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff4d6';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = label.split(' ');
    if (words.length > 2) {
      fitFont(g, words.slice(0, 2).join(' '), 96, 26, 'Arial, sans-serif');
      g.fillText(words.slice(0, 2).join(' '), W / 2, H * 0.4);
      g.fillText(words[2], W / 2, H * 0.64);
    } else {
      fitFont(g, label, 100, 34, 'Arial, sans-serif');
      g.fillText(label, W / 2, H / 2 + 2);
    }
  });

function piece(gltf, name) {
  const o = gltf.scene.getObjectByName(name);
  return o ? o.clone(true) : new THREE.Group();
}
function setMaterial(obj, fn) {
  obj.traverse(o => {
    if (o.isMesh) o.material = fn(o.material) || o.material;
  });
}
const noRay = o => o.traverse(m => (m.raycast = () => {}));
let cupMap = null; // una sola texture del bicchierone per tutti i bicchieri
function cupMesh(gltf) {
  const cup = piece(gltf, 'bicchiere_cola');
  cupMap ||= cupTexture();
  setMaterial(cup, m =>
    m.name === 'bicchiere_cola' ? new THREE.MeshStandardMaterial({ map: cupMap, roughness: 0.45 }) : m
  );
  return cup;
}

// punti del carrello (in metri, davanti verso +z)
const PIVOT = new THREE.Vector3(-0.12, 1.33, -0.03); // perno del pentolino
const CASE = { x0: -0.345, x1: 0.105, z0: -0.205, z1: 0.135, floor: 0.875, top: 1.4 };
const LEDGE = new THREE.Vector3(-0.12, 0.85, 0.215); // dove arriva il cartoccio
const TRAY = new THREE.Vector3(0.25, 0.866, 0.18); // dove si riempie il bicchiere
const NOZZLE_Y = 1.035;
const MOUND = 0.13; // il bordo del cartoccio

export function createPopcorn(gltf, { sound = () => {} } = {}) {
  const root = new THREE.Group();
  for (const n of ['carrello', 'tetto', 'vetro', 'pila_cartocci']) root.add(piece(gltf, n));
  const glass = root.getObjectByName('vetro');
  setMaterial(
    glass,
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e4f2f8',
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        roughness: 0.03
      })
  );
  noRay(glass);
  const sign = signTexture(),
    side = sideTexture(),
    label = colaLabel();
  root.traverse(o => {
    if (!o.isMesh) return;
    const n = o.material.name;
    if (n === 'insegna') o.material = new THREE.MeshStandardMaterial({ map: sign, roughness: 0.45 });
    if (n === 'insegna_lato') o.material = new THREE.MeshStandardMaterial({ map: side, roughness: 0.45 });
    if (n === 'etichetta_cola') o.material = new THREE.MeshStandardMaterial({ map: label, roughness: 0.4 });
    if (n === 'luce_popcorn')
      o.material = new THREE.MeshBasicMaterial({ color: '#ffe3a3', toneMapped: false });
  });
  // lampadine attorno all'insegna: si accendono a ondate
  const bulbs = piece(gltf, 'lampadine');
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false });
  setMaterial(bulbs, () => bulbMat);
  root.add(bulbs);
  // targhetta smaltata: dice cosa sta facendo il carrello
  const plate = document.createElement('canvas');
  plate.width = 384;
  plate.height = 176;
  const plateTex = new THREE.CanvasTexture(plate);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.flipY = false;
  root.traverse(o => {
    if (o.isMesh && o.material.name === 'targhetta')
      o.material = new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false });
  });
  function show(line1, line2 = '') {
    const g = plate.getContext('2d'),
      W = plate.width,
      H = plate.height;
    g.fillStyle = '#f4ead2';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#9e0f17';
    g.lineWidth = 8;
    g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#9e0f17';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, line1, W - 50, 58);
    g.fillText(line1, W / 2, H * 0.4);
    g.fillStyle = '#3a2a1a';
    fitFont(g, line2, W - 50, 28, 'Arial, sans-serif');
    g.fillText(line2, W / 2, H * 0.72);
    plateTex.needsUpdate = true;
  }

  // tasti
  const buttons = [];
  for (const k of POPCORN_KEYS) {
    const b = piece(gltf, 'tasto');
    b.position.set(k.x, 0.72, 0.214);
    const tex = keyTexture(k.label);
    setMaterial(b, m =>
      m.name === 'etichetta' ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }) : m
    );
    b.userData.popcorn = { type: 'key', key: k.key };
    root.add(b);
    buttons.push(b);
  }

  // vetrina: mucchio (cresce mentre scoppiano), pentolino, chicchi
  const pile = new THREE.Group();
  pile.position.y = 0.85;
  const pileMesh = piece(gltf, 'mucchio');
  pileMesh.position.y = -0.85;
  pile.add(pileMesh);
  pile.scale.y = 0.85;
  root.add(pile);
  noRay(pile);
  const kettle = piece(gltf, 'pentola');
  kettle.position.copy(PIVOT);
  root.add(kettle);
  noRay(kettle);
  // un chicco: prima il seme giallo scuro (il cuore), poi scoppia e si apre il popcorn; quattro forme, a giro
  const kernels = [];
  for (let i = 0; i < 48; i++) {
    const m = piece(gltf, 'chicco_' + (i % 4));
    const parts = { corn: [], core: [] };
    m.traverse(o => o.isMesh && parts[o.material.name === 'popcorn_cuore' ? 'core' : 'corn'].push(o));
    m.visible = false;
    noRay(m);
    m.userData.k = { v: new THREE.Vector3(), life: 0, pop: 0, rest: false, parts, grow: 1 };
    root.add(m);
    kernels.push(m);
  }
  let nextKernel = 0;
  function setPopped(k, popped) {
    for (const o of k.parts.corn) o.visible = popped;
    k.grow = popped ? 0.3 : 1;
  }
  function launch(from, v, popped) {
    const m = kernels[nextKernel++ % kernels.length],
      k = m.userData.k;
    m.position.copy(from);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    k.v.copy(v);
    k.life = 0;
    k.pop = popped ? 1 : 0;
    k.rest = false;
    k.into = null;
    m.visible = true;
    setPopped(k, popped);
    if (popped) {
      k.grow = 1;
      for (const o of k.parts.corn) o.scale.setScalar(1);
    }
    return m;
  }
  // altezza del mucchio in un punto (la cupola del modello, alzata o abbassata con pile.scale)
  function pileTop(x, z) {
    const dx = (x - (CASE.x0 + CASE.x1) / 2) / ((CASE.x1 - CASE.x0) / 2),
      dz = (z - (CASE.z0 + CASE.z1) / 2) / ((CASE.z1 - CASE.z0) / 2);
    return 0.85 + (0.04 + Math.max(0, 1 - 0.6 * (dx * dx + dz * dz)) * 0.075) * pile.scale.y;
  }

  // cartoccio sul banco e bicchiere sul vassoio (quando si preparano)
  const box = piece(gltf, 'cartoccio');
  const boxCorn = piece(gltf, 'cartoccio_popcorn');
  boxCorn.position.y = MOUND;
  box.add(boxCorn);
  box.position.copy(LEDGE);
  box.visible = false;
  box.userData.popcorn = { type: 'item' };
  root.add(box);
  const cup = cupMesh(gltf);
  const lid = piece(gltf, 'bicchiere_coperchio');
  const liquid = piece(gltf, 'cola_liquido');
  setMaterial(liquid, () => new THREE.MeshStandardMaterial({ color: '#2a0d06', roughness: 0.2 }));
  cup.add(lid, liquid);
  cup.position.copy(TRAY);
  cup.visible = false;
  cup.userData.popcorn = { type: 'item' };
  root.add(cup);
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 1, 8),
    new THREE.MeshBasicMaterial({ color: '#3a140a' })
  );
  stream.visible = false;
  stream.raycast = () => {};
  root.add(stream);

  // stato: 'scegli' → 'prepara' → 'pronto' → (preso) 'scegli'
  let state = 'scegli',
    job = null,
    ready = [];
  const listeners = [];
  const emit = () => listeners.forEach(fn => fn({ state, key: job?.key || null }));
  const idle = () => show('POPCORN · COLA', 'scegli: popcorn, cola o tutti e due');
  idle();

  function play(key) {
    if (state !== 'scegli' || !POPCORN_KEYS.some(k => k.key === key)) return false;
    state = 'prepara';
    const corn = key !== 'cola',
      drink = key !== 'popcorn';
    job = {
      key,
      t: 0,
      corn: corn ? { t: 0, next: 1.2, poured: false, filled: 0 } : null,
      drink: drink ? { t: 0 } : null
    };
    show(
      corn ? 'SCOPPIANO…' : 'SPILLO…',
      corn && drink ? 'popcorn e Binotto Cola' : corn ? 'popcorn caldi' : 'Binotto Cola'
    );
    if (corn) sound('sfrigolio');
    if (drink) {
      cup.visible = true;
      cup.scale.setScalar(0.01);
      lid.visible = false;
      liquid.position.y = 0.004;
      liquid.scale.setScalar(0.8);
      sound('bicchiere');
    }
    emit();
    return true;
  }
  function hit(obj) {
    let o = obj;
    while (o && !o.userData.popcorn) o = o.parent;
    const v = o?.userData.popcorn;
    if (!v) return null;
    if (v.type === 'key') {
      o.position.z = 0.206; // il tasto si abbassa
      sound('tasto');
      setTimeout(() => (o.position.z = 0.214), 140);
      if (state === 'scegli') play(v.key);
    }
    return v;
  }
  function clear() {
    box.visible = cup.visible = stream.visible = false;
    ready = [];
    state = 'scegli';
    job = null;
    idle();
  }
  function take() {
    if (state !== 'pronto' || !ready.length) return null;
    const got = ready;
    sound('presa');
    clear();
    emit();
    return got;
  }
  function reset() {
    if (state === 'scegli') return;
    clear();
    pile.scale.y = Math.min(pile.scale.y, 1);
    emit();
  }

  const ease = t => t * t * (3 - 2 * t);
  const tmp = new THREE.Vector3();
  let clock = 0;
  function update(dt) {
    clock += dt;
    bulbMat.color.setScalar(0.75 + 0.25 * Math.max(0, Math.sin(clock * 3)));
    bulbMat.color.multiply(new THREE.Color('#ffd27a'));
    kettle.rotation.set(0, 0, 0);
    if (job?.corn) {
      const c = job.corn;
      c.t += dt;
      const t = c.t;
      // 0–1,2 s si scalda; 1,2–4,6 s scoppiano sempre più fitti, poi più radi; 4,8–6 s si inclina e versa
      if (t < 4.8) kettle.rotation.z = Math.sin(clock * 38) * (t < 1.2 ? 0.01 : 0.03);
      if (t > 1.2 && t < 4.6 && t >= c.next) {
        const busy = Math.sin(((t - 1.2) / 3.4) * Math.PI); // fitti a metà
        c.next = t + 0.05 + (1 - busy) * 0.22 + Math.random() * 0.06;
        // il seme salta fuori dal pentolino e scoppia in aria
        tmp.set(
          PIVOT.x + (Math.random() - 0.5) * 0.12,
          PIVOT.y - 0.085,
          PIVOT.z + (Math.random() - 0.5) * 0.1
        );
        const m = launch(
          tmp,
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.7,
            0.5 + Math.random() * 0.7,
            (Math.random() - 0.5) * 0.5
          ),
          false
        );
        m.userData.k.popAt = 0.03 + Math.random() * 0.05;
        pile.scale.y = Math.min(1.15, pile.scale.y + 0.006);
      }
      if (t > 4.8 && t < 6.2) {
        // si inclina in avanti e versa quelli rimasti
        const tilt = t < 5.3 ? ease((t - 4.8) / 0.5) : t < 5.7 ? 1 : 1 - ease((t - 5.7) / 0.5);
        kettle.rotation.x = 1.05 * tilt;
        if (tilt > 0.8 && Math.random() < 0.6) {
          tmp.set(PIVOT.x + (Math.random() - 0.5) * 0.1, PIVOT.y - 0.1, PIVOT.z + 0.08);
          launch(tmp, new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.1, 0.25 + Math.random() * 0.2), true);
        }
        if (!c.poured && t > 5.0) {
          c.poured = true;
          sound('versa');
        }
      }
      if (t > 6.2 && t < 7.6) {
        // il cartoccio arriva sul banco e si riempie: chicchi che cadono dentro, la cupola che sale
        if (!box.visible) {
          box.visible = true;
          sound('presa');
        }
        const f = Math.min(1, (t - 6.2) / 1.1);
        box.scale.setScalar(0.3 + 0.7 * ease(Math.min(1, (t - 6.2) / 0.25)));
        boxCorn.scale.set(0.6 + 0.4 * f, Math.max(0.01, f), 0.6 + 0.4 * f);
        boxCorn.position.y = MOUND - 0.05 * (1 - f);
        if (Math.random() < 0.5) {
          tmp.set(
            LEDGE.x + (Math.random() - 0.5) * 0.04,
            LEDGE.y + 0.32,
            LEDGE.z + (Math.random() - 0.5) * 0.03
          );
          const m = launch(tmp, new THREE.Vector3(0, -0.4, 0), true);
          m.userData.k.into = LEDGE.y + MOUND;
        }
        pile.scale.y = Math.max(0.85, pile.scale.y - dt * 0.12);
      }
      if (t >= 7.6 && !c.done) {
        c.done = true;
        boxCorn.scale.setScalar(1);
        boxCorn.position.y = MOUND;
        box.scale.setScalar(1);
      }
    }
    if (job?.drink) {
      const d = job.drink;
      d.t += dt;
      const t = d.t;
      // 0–0,3 s arriva il bicchiere; 0,5–3 s si riempie; 3–3,4 s scende il coperchio
      cup.scale.setScalar(Math.max(0.01, ease(Math.min(1, t / 0.3))));
      const pouring = t > 0.5 && t < 3;
      if (pouring && !d.pouring) {
        d.pouring = true;
        sound('erogazione');
      }
      const level = Math.min(1, Math.max(0, (t - 0.5) / 2.5));
      liquid.position.y = 0.004 + level * 0.135;
      liquid.scale.setScalar(0.8 + level * 0.22);
      stream.visible = pouring;
      if (pouring) {
        const bottom = TRAY.y + liquid.position.y;
        stream.scale.y = NOZZLE_Y - bottom;
        stream.position.set(TRAY.x, (NOZZLE_Y + bottom) / 2, 0.155 + (TRAY.z - 0.155) * 0.5);
      }
      if (t > 3) {
        lid.visible = true;
        lid.position.y = 0.08 * (1 - ease(Math.min(1, (t - 3) / 0.4)));
      }
      if (t >= 3.4 && !d.done) {
        d.done = true;
        lid.position.y = 0;
      }
    }
    if (job && (!job.corn || job.corn.done) && (!job.drink || job.drink.done)) {
      ready = [];
      if (job.corn) ready.push(POPCORN);
      if (job.drink) ready.push(COLA);
      state = 'pronto';
      job = null;
      show('PRONTO!', ready.length > 1 ? 'prendi popcorn e cola' : 'tocca per prendere');
      sound('pronto');
      emit();
    }
    // chicchi in volo: scoppiano, sbattono sul vetro, si fermano sul mucchio (o dentro il cartoccio) e spariscono
    for (const m of kernels) {
      if (!m.visible) continue;
      const k = m.userData.k;
      k.life += dt;
      if (!k.pop && k.life >= k.popAt) {
        // scoppia: il popcorn si apre dal seme in un attimo e fa un balzo
        k.pop = 1;
        setPopped(k, true);
        k.v
          .multiplyScalar(1.4)
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.4));
        if (Math.random() < 0.7) sound('scoppio');
      }
      if (k.grow < 1) {
        k.grow = Math.min(1, k.grow + dt * 12);
        for (const o of k.parts.corn) o.scale.setScalar(k.grow);
      }
      if (k.rest) {
        if (k.life > 2.5) m.visible = false;
        continue;
      }
      k.v.y -= 9.8 * dt;
      m.position.addScaledVector(k.v, dt);
      m.rotation.x += dt * 6;
      if (k.into != null) {
        if (m.position.y < k.into) m.visible = false;
        continue;
      }
      // dentro la vetrina
      if (m.position.x < CASE.x0 || m.position.x > CASE.x1) k.v.x *= -0.4;
      if (m.position.z < CASE.z0 || m.position.z > CASE.z1) k.v.z *= -0.4;
      if (m.position.y > CASE.top) k.v.y = -Math.abs(k.v.y) * 0.3;
      m.position.x = THREE.MathUtils.clamp(m.position.x, CASE.x0, CASE.x1);
      m.position.z = THREE.MathUtils.clamp(m.position.z, CASE.z0, CASE.z1);
      m.position.y = Math.min(m.position.y, CASE.top);
      const floor = pileTop(m.position.x, m.position.z);
      if (m.position.y <= floor) {
        m.position.y = floor;
        k.rest = true;
        k.life = 0;
      }
    }
  }
  return {
    root,
    buttons,
    hit,
    play,
    take,
    reset,
    update,
    state: () => state,
    ready: () => (state === 'pronto' ? ready : []),
    onChange: fn => listeners.push(fn)
  };
}

// In mano: il cartoccio che si svuota in sei manciate. bite() restituisce quante ne restano (0 = finito)
export function makeHeldPopcorn(gltf) {
  const group = new THREE.Group();
  const box = piece(gltf, 'cartoccio'),
    corn = piece(gltf, 'cartoccio_popcorn');
  corn.position.y = MOUND;
  box.add(corn);
  group.add(box);
  const product = POPCORN;
  let left = product.bites,
    pulse = 0;
  return {
    group,
    product,
    left: () => left,
    bite() {
      if (left <= 0) return 0;
      left--;
      pulse = 1;
      // la cupola scende dentro il cartoccio a ogni manciata
      const f = left / product.bites;
      corn.position.y = MOUND - 0.1 * (1 - f);
      corn.scale.set(0.85 + 0.15 * f, 0.4 + 0.6 * f, 0.85 + 0.15 * f);
      corn.visible = left > 0;
      return left;
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 3);
      group.rotation.x = -Math.sin(pulse * Math.PI) * 0.4;
    }
  };
}
// In mano: il bicchierone col coperchio e la cannuccia, quattro sorsi
export function makeHeldCola(gltf) {
  const group = new THREE.Group();
  const cup = cupMesh(gltf);
  cup.add(piece(gltf, 'bicchiere_coperchio'));
  group.add(cup);
  const product = COLA;
  let left = product.bites,
    pulse = 0;
  return {
    group,
    product,
    left: () => left,
    bite() {
      if (left <= 0) return 0;
      left--;
      pulse = 1;
      return left;
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 3);
      group.rotation.x = -Math.sin(pulse * Math.PI) * 0.4;
    }
  };
}
