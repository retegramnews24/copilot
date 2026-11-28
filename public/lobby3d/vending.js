// Macchinetta caffè e snack della Lobby 3D (docs/macchinetta.md). Solo visiva: niente soldi.
// Modello di Blender: blender/macchinetta.blend → models/macchinetta.glb (davanti verso +z, base a terra, larga 1,1 m).
// createVending(gltf) restituisce la macchinetta pronta (root) e i comandi:
//   hit(object)      → che cosa è stato toccato (tasto, bevanda, sportello, bicchiere) e lo esegue
//   update(dt, now)  → anima spirali, caduta, caffè, vapore, display
//   take()           → prende il prodotto pronto (vano o bicchiere): restituisce il prodotto, o null
//   onChange(fn)     → chiamata a ogni cambio di stato (scegli, scende, pronto, ritirato)
// La scelta: per gli snack una lettera (fila A…D, dall'alto) e un numero (1…3), poi OK; per il caffè un tasto bevanda.
// Il prodotto in mano e il consumo (makeHeld) sono a parte, perché in Lobby li porta il personaggio.
import * as THREE from 'three';

export const DRINKS = [
  { id: 'espresso', name: 'Espresso', color: '#3b2112' },
  { id: 'cappuccino', name: 'Cappuccino', color: '#b98a5e' },
  { id: 'cioccolata', name: 'Cioccolata calda', color: '#4a2a17' },
  { id: 'te', name: 'Tè al limone', color: '#c98b2b' }
];
// fila A in alto; tipo del pacco: busta, scatola, bottiglia
export const SNACKS = [
  ['A1', 'Patatine', 'busta', '#d8342b'],
  ['A2', 'Cioccolato', 'scatola', '#5b3420'],
  ['A3', 'Wafer', 'scatola', '#e8b730'],
  ['B1', 'Cracker', 'scatola', '#e07b25'],
  ['B2', 'Crostatina', 'scatola', '#d4588c'],
  ['B3', 'Caramelle', 'busta', '#7b4bb8'],
  ['C1', 'Taralli', 'busta', '#c9a46b'],
  ['C2', 'Biscotti', 'scatola', '#2f6fbf'],
  ['C3', 'Merendina', 'scatola', '#4e9a3a'],
  ['D1', 'Mentine', 'scatola', '#2aa39a'],
  ['D2', 'Acqua', 'bottiglia', '#9fd3f0'],
  ['D3', 'Aranciata', 'bottiglia', '#f08a1c']
].map(([code, name, pack, color]) => ({ id: code, code, name, pack, color }));

const SHELF_Y = [1.39, 1.12, 0.85, 0.58]; // ripiani A…D (dall'alto)
const SLOT_X = [-0.4, -0.17, 0.06];
const KEYS = [
  ['A', 0.285, 1.42],
  ['B', 0.343, 1.42],
  ['C', 0.401, 1.42],
  ['D', 0.459, 1.42],
  ['1', 0.285, 1.372],
  ['2', 0.343, 1.372],
  ['3', 0.401, 1.372],
  ['OK', 0.459, 1.372]
];
const CUP = new THREE.Vector3(0.37, 0.6, -0.12),
  NOZZLE_Y = 0.81;

// turned: per le facce stampate dei pezzi di Blender (tasti, confezioni, insegna, display), le cui UV arrivano
// capovolte in verticale (come le texture del glb: v = 0 in alto)
function canvasTexture(w, h, draw, turned = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (turned) t.flipY = false;
  return t;
}
const label = (text, bg, fg, w = 128, h = 96, size = 44, turned = true) =>
  canvasTexture(
    w,
    h,
    (g, W, H) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'bold ' + size + 'px Arial, sans-serif';
      g.fillText(text, W / 2, H / 2 + 2, W - 10);
    },
    turned
  );
// faccia di una confezione: colore pieno, fascia bianca col nome
function packTexture(p) {
  return canvasTexture(
    128,
    192,
    (g, W, H) => {
      g.fillStyle = p.color;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.88)';
      g.fillRect(0, 70, W, 52);
      g.fillStyle = '#222';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = 26;
      g.font = 'bold ' + size + 'px Arial, sans-serif';
      while (g.measureText(p.name).width > W - 12 && size > 12)
        g.font = 'bold ' + --size + 'px Arial, sans-serif';
      g.fillText(p.name, W / 2, 97);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath();
      g.arc(W / 2, 36, 18, 0, 7);
      g.fill();
    },
    true
  );
}

// pezzi del glb per nome (nel glb ogni pezzo è all'origine o già al suo posto)
function piece(gltf, name) {
  const o = gltf.scene.getObjectByName(name);
  return o ? o.clone(true) : new THREE.Group();
}
function setMaterial(obj, fn) {
  obj.traverse(o => {
    if (o.isMesh) o.material = fn(o.material) || o.material;
  });
}

export function packMesh(gltf, product, materials) {
  const name = product.pack ? 'prodotto_' + product.pack : 'bicchiere';
  const m = piece(gltf, name);
  m.position.set(0, 0, 0);
  setMaterial(m, mat => {
    if (mat.name === 'confezione') return materials.body;
    if (mat.name === 'etichetta') return materials.face;
  });
  return m;
}
export function productMaterials(product) {
  const tint = new THREE.Color(product.color);
  return {
    body: new THREE.MeshStandardMaterial({ color: tint, roughness: 0.4 }),
    face:
      product.pack === 'bottiglia'
        ? new THREE.MeshStandardMaterial({
            color: tint.clone().lerp(new THREE.Color('#ffffff'), 0.4),
            roughness: 0.4
          })
        : new THREE.MeshStandardMaterial({ map: packTexture(product), roughness: 0.45 })
  };
}

// Colori: scocca, finiture (cornici, maniglia, erogatore), luce LED, interno della vetrina, insegna, display e tasti
export const THEMES = {
  grafite: {
    body: ['#16181c', 0.6, 0.35],
    trim: ['#b9bec6', 1, 0.25],
    led: '#8fd3ff',
    accent: '#ff8a3d', // linee luminose arancio sul davanti (scelta del proprietario)
    inside: '#c4c8ce',
    sign: ['#0d1117', '#cfe6ff'],
    screen: ['#071521', '#7fd4ff', '#b8e6ff'],
    keys: ['#1c2027', '#e8eef6'],
    drinks: ['#3a2716', '#ffe2bd']
  },
  espresso: {
    body: ['#7a1420', 0.25, 0.28],
    trim: ['#d6d9de', 1, 0.2],
    led: '#ffb35c',
    inside: '#f1e8dc',
    sign: ['#1a0b0c', '#ffd9a0'],
    screen: ['#140906', '#ffb35c', '#ffd9a8'],
    keys: ['#2a1214', '#ffe7d6'],
    drinks: ['#5a1a16', '#ffe2bd']
  },
  rame: {
    body: ['#e9e6e1', 0.1, 0.3],
    trim: ['#b8734a', 1, 0.3],
    led: '#ffd7a8',
    inside: '#ffffff',
    sign: ['#2b2522', '#f3d2b3'],
    screen: ['#1d1512', '#ffcf9a', '#ffe4c4'],
    keys: ['#3a302b', '#fff1e6'],
    drinks: ['#b8734a', '#fff4ea']
  }
};

// sound(nome): suoni della macchinetta (vendingSounds), se chi la usa li vuole
export function createVending(gltf, theme = 'grafite', { sound = () => {} } = {}) {
  const T = THEMES[theme] || THEMES.grafite;
  const root = new THREE.Group();
  for (const n of [
    'macchinetta_corpo',
    'macchinetta_interno',
    'macchinetta_led',
    'macchinetta_erogatore',
    'macchinetta_vetro',
    'macchinetta_display',
    'macchinetta_insegna'
  ])
    root.add(piece(gltf, n));
  // materiali propri di questa macchinetta, con i colori del tema
  const std = ([color, metalness, roughness]) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const themed = {
    scocca_macchinetta: std(T.body),
    acciaio: std(T.trim),
    interno_vetrina: new THREE.MeshStandardMaterial({ color: T.inside, roughness: 0.5 }),
    led_macchinetta: new THREE.MeshBasicMaterial({ color: T.led, toneMapped: false }),
    vetro_macchinetta: new THREE.MeshStandardMaterial({
      color: '#cfe2f0',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      roughness: 0.05
    })
  };
  root.traverse(o => {
    if (o.isMesh && themed[o.material.name]) o.material = themed[o.material.name];
  });
  // linee luminose sul davanti: sotto l'insegna, lungo i fianchi, sotto la vetrina, sopra il vano di ritiro e
  // attorno al vano tazza (un solo oggetto)
  if (T.accent) {
    const parts = [];
    const line = (x0, x1, y0, y1, z) => {
      const g = new THREE.BoxGeometry(Math.max(0.006, x1 - x0), Math.max(0.006, y1 - y0), 0.004);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
      parts.push(g);
    };
    line(-0.53, 0.53, 1.708, 1.714, 0.013);
    for (const x of [-0.538, 0.532]) line(x, x + 0.006, 0.1, 1.82, 0.004);
    line(-0.53, 0.19, 0.515, 0.521, 0.013);
    line(-0.45, 0.1, 0.455, 0.461, 0.013);
    line(0.255, 0.485, 0.885, 0.891, 0.009);
    line(0.255, 0.485, 0.555, 0.561, 0.009);
    for (const x of [0.255, 0.479]) line(x, x + 0.006, 0.555, 0.891, 0.009);
    const merged = new THREE.BufferGeometry();
    const pos = [];
    for (const g of parts) pos.push(...g.toNonIndexed().attributes.position.array);
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    root.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: T.accent, toneMapped: false })));
  }
  // insegna
  const sign = label('CAFFÈ · SNACK', T.sign[0], T.sign[1], 1024, 96, 58);
  setMaterial(
    root.getObjectByName('macchinetta_insegna'),
    () => new THREE.MeshBasicMaterial({ map: sign, toneMapped: false })
  );
  // display: si ridisegna a ogni cambio
  const screen = document.createElement('canvas');
  screen.width = 256;
  screen.height = 154;
  const screenTex = new THREE.CanvasTexture(screen);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.flipY = false; // come le altre facce stampate di Blender
  setMaterial(
    root.getObjectByName('macchinetta_display'),
    () => new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false })
  );
  function show(line1, line2 = '') {
    const g = screen.getContext('2d');
    g.fillStyle = T.screen[0];
    g.fillRect(0, 0, 256, 154);
    g.fillStyle = T.screen[1];
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 40px monospace';
    g.fillText(line1, 128, 58, 240);
    g.font = '24px monospace';
    g.fillStyle = T.screen[2];
    g.fillText(line2, 128, 112, 240);
    screenTex.needsUpdate = true;
  }

  // tasti: uno per lettera e numero, uno per bevanda; ognuno con la sua scritta
  const buttons = [];
  for (const [key, x, y] of KEYS) {
    const b = piece(gltf, 'tasto');
    b.position.set(x, y, 0.006);
    const tex = label(key, T.keys[0], T.keys[1], 96, 72, key === 'OK' ? 36 : 46);
    setMaterial(b, mat =>
      mat.name === 'etichetta' ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }) : mat
    );
    b.userData.vending = { type: 'key', key };
    root.add(b);
    buttons.push(b);
  }
  DRINKS.forEach((d, k) => {
    const b = piece(gltf, 'tasto_bevanda');
    b.position.set(0.32 + (k % 2) * 0.105, 1.2 - Math.floor(k / 2) * 0.055, 0.006);
    const tex = label(d.name, T.drinks[0], T.drinks[1], 192, 80, 30);
    setMaterial(b, mat =>
      mat.name === 'etichetta' ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }) : mat
    );
    b.userData.vending = { type: 'drink', drink: d };
    root.add(b);
    buttons.push(b);
  });

  // spirali e confezioni: tre per spirale
  const slots = new Map();
  SNACKS.forEach((p, i) => {
    const row = Math.floor(i / 3),
      x = SLOT_X[i % 3],
      y = SHELF_Y[row];
    // i ripiani partono 12 cm dietro il vetro: davanti resta lo spazio dove cadono le confezioni
    const spiral = piece(gltf, 'spirale');
    spiral.position.set(x, y + 0.045, -0.13);
    root.add(spiral);
    const materials = productMaterials(p),
      items = [];
    for (let k = 0; k < 3; k++) {
      const m = packMesh(gltf, p, materials);
      m.position.set(x, y, -0.18 - k * 0.1);
      root.add(m);
      items.push(m);
    }
    slots.set(p.code, { p, x, y, spiral, items, materials });
  });

  // sportello del vano di ritiro (incernierato in alto) e bicchiere del caffè
  const flap = piece(gltf, 'sportello');
  flap.position.set(-0.175, 0.43, 0);
  flap.traverse(o => {
    if (o.isMesh) Object.assign(o.material, { transparent: true, opacity: 0.6 });
  });
  flap.userData.vending = { type: 'flap' };
  root.add(flap);
  const cup = piece(gltf, 'bicchiere');
  const liquid = piece(gltf, 'bicchiere_liquido');
  const liquidMat = new THREE.MeshStandardMaterial({ color: '#3b2112', roughness: 0.25 });
  setMaterial(liquid, () => liquidMat);
  liquid.position.set(0, 0.004, 0);
  cup.add(liquid);
  cup.visible = false;
  cup.userData.vending = { type: 'cup' };
  root.add(cup);
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 1, 8),
    new THREE.MeshBasicMaterial({ color: '#3b2112' })
  );
  stream.visible = false;
  root.add(stream);
  // vapore: qualche sbuffo trasparente che sale dal bicchiere
  const steamTex = canvasTexture(64, 64, (g, W) => {
    const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    r.addColorStop(0, 'rgba(255,255,255,.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, W, W);
  });
  const puffs = [];
  for (let k = 0; k < 8; k++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })
    );
    s.scale.setScalar(0.05);
    s.userData.t = k / 8;
    s.raycast = () => {}; // il vapore non prende i tocchi (sotto c'è il bicchiere da prendere)
    root.add(s);
    puffs.push(s);
  }

  // stato: 'scegli' → 'scende' → 'pronto' → (ritirato) 'scegli'
  let state = 'scegli',
    typed = '',
    job = null,
    ready = null,
    listeners = [];
  let order = null; // l'ultima scelta: codice dello snack o id della bevanda (la vedono anche gli altri)
  const emit = () => listeners.forEach(fn => fn({ state, ready: ready?.product || null, order }));
  const idle = () => show(typed || 'SCEGLI', typed ? 'premi OK' : 'snack A1…D3 o caffè');
  idle();

  function vendSnack(code) {
    const slot = slots.get(code);
    if (!slot) {
      show('???', 'codice sbagliato');
      sound('errore');
      typed = '';
      return;
    }
    state = 'scende';
    order = code;
    sound('motore');
    job = { kind: 'snack', slot, t: 0, item: slot.items[0], fall: null };
    show(code, slot.p.name);
    emit();
  }
  function vendDrink(d) {
    state = 'scende';
    order = d.id;
    liquidMat.color.set(d.color);
    cup.visible = true;
    cup.position.copy(CUP).add(new THREE.Vector3(0, 0.2, 0));
    liquid.scale.setScalar(0.85);
    liquid.position.y = 0.004;
    sound('bicchiere');
    job = { kind: 'drink', drink: d, t: 0, pouring: false };
    show('CAFFÈ', d.name);
    emit();
  }
  function hit(obj) {
    let o = obj;
    while (o && !o.userData.vending) o = o.parent;
    const v = o?.userData.vending;
    if (!v) return null;
    if (v.type === 'key' || v.type === 'drink') {
      o.position.z = -0.002; // il tasto si abbassa
      sound('tasto');
      setTimeout(() => (o.position.z = 0.006), 140);
      if (state !== 'scegli') return v;
      if (v.type === 'drink') vendDrink(v.drink);
      else if (v.key === 'OK') {
        if (typed.length === 2) vendSnack(typed);
        typed = '';
      } else if (/[A-D]/.test(v.key)) typed = v.key;
      else if (typed.length === 1) typed += v.key;
      if (state === 'scegli') idle();
    }
    return v;
  }
  function take() {
    if (state !== 'pronto' || !ready) return null;
    const got = ready;
    sound(got.product.pack ? 'sportello' : 'presa');
    ready.mesh.removeFromParent();
    ready = null;
    state = 'scegli';
    typed = '';
    idle();
    emit();
    return got.product;
  }

  // Per far vedere quello che fa chi la sta usando (lo stesso, sulla macchinetta di chi guarda):
  // play(scelta) fa scendere lo snack o il caffè, typing(testo) mostra il codice che sta scrivendo,
  // reset() la rimette a «scegli» se chi la usava se ne va senza prendere il prodotto
  function play(code) {
    if (state !== 'scegli') return false;
    const d = DRINKS.find(x => x.id === code);
    if (d) vendDrink(d);
    else if (slots.has(code)) vendSnack(code);
    else return false;
    typed = '';
    return true;
  }
  function typing(text) {
    if (state !== 'scegli' || typed === text || !/^([A-D][1-3]?)?$/.test(text || '')) return;
    typed = text || '';
    idle();
  }
  function reset() {
    if (ready) ready.mesh.removeFromParent();
    ready = null;
    if (job?.kind === 'snack') {
      if (job.fall) job.item.removeFromParent();
      job.slot.spiral.rotation.z = 0;
      job.slot.items.forEach((m, k) => (m.position.z = -0.18 - k * 0.1));
    }
    job = null;
    cup.visible = stream.visible = false;
    state = 'scegli';
    typed = '';
    idle();
    emit();
  }

  const ease = t => t * t * (3 - 2 * t);
  function update(dt, now) {
    flap.rotation.x +=
      ((ready && ready.mesh.userData.inTray ? 0.25 : 0) - flap.rotation.x) * Math.min(1, dt * 8);
    if (job?.kind === 'snack') {
      const { slot } = job;
      job.t += dt;
      const turn = Math.min(1, job.t / 1.6);
      slot.spiral.rotation.z = -ease(turn) * Math.PI * 2; // un giro: tutte le confezioni avanzano di un posto
      slot.items.forEach((m, k) => (m.position.z = -0.18 - k * 0.1 + ease(turn) * 0.1));
      if (turn >= 1 && !job.fall) {
        // la prima cade: esce dalla spirale e precipita nello spazio tra ripiani e vetro, fino al vano
        job.fall = { v: new THREE.Vector3(0, 0, 0.12), spin: (Math.random() - 0.5) * 6 };
        const fresh = packMesh(gltf, slot.p, slot.materials); // ne arriva una nuova in fondo
        fresh.position.set(slot.x, slot.y, -0.38);
        root.add(fresh);
        slot.items.shift();
        slot.items.push(fresh);
      }
      if (job.fall) {
        const m = job.item,
          f = job.fall;
        f.v.y -= 9.8 * dt;
        m.position.addScaledVector(f.v, dt);
        m.position.z = Math.min(m.position.z, -0.06); // non passa il vetro
        m.rotation.x += f.spin * dt;
        const floor = 0.18;
        if (m.position.y <= floor) {
          m.position.y = floor;
          m.position.x = THREE.MathUtils.clamp(m.position.x, -0.4, 0.05);
          m.position.z = -0.15;
          m.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.6); // sdraiata nel vano
          m.userData.inTray = true;
          sound('caduta');
          ready = { product: slot.p, mesh: m };
          state = 'pronto';
          job = null;
          show('RITIRA', slot.p.name);
          emit();
        }
      }
    } else if (job?.kind === 'drink') {
      job.t += dt;
      const t = job.t;
      // 0–0,5 s il bicchiere scende; 0,6–3 s il getto riempie; poi pronto
      cup.position.y = CUP.y + 0.2 * (1 - ease(Math.min(1, t / 0.5)));
      const pouring = t > 0.6 && t < 3;
      if (pouring && !job.pouring) {
        job.pouring = true;
        sound('erogazione');
      }
      const level = Math.min(1, Math.max(0, (t - 0.6) / 2.4));
      liquid.position.y = 0.004 + level * 0.07;
      liquid.scale.setScalar(0.85 + level * 0.25);
      stream.visible = pouring;
      if (pouring) {
        const top = NOZZLE_Y,
          bottom = cup.position.y + liquid.position.y;
        stream.scale.y = top - bottom;
        stream.position.set(CUP.x, (top + bottom) / 2, CUP.z);
      }
      if (t >= 3.2) {
        ready = { product: { ...job.drink, pack: null }, mesh: cup.clone(true) };
        cup.visible = false;
        ready.mesh.visible = true;
        ready.mesh.userData.vending = { type: 'cup' };
        root.add(ready.mesh);
        state = 'pronto';
        job = null;
        show('PRONTO', 'prendi il bicchiere');
        sound('pronto');
        emit();
      }
    }
    // vapore sopra il bicchiere pieno (anche finché non lo prendi)
    const hot =
      ready && !ready.product.pack ? ready.mesh.position : job?.kind === 'drink' ? cup.position : null;
    for (const s of puffs) {
      s.userData.t = (s.userData.t + dt * 0.5) % 1;
      const t = s.userData.t;
      s.visible = !!hot;
      if (!hot) continue;
      s.position.set(hot.x + Math.sin(t * 9 + s.id) * 0.01, hot.y + 0.09 + t * 0.18, hot.z);
      s.material.opacity = 0.5 * Math.sin(t * Math.PI);
      s.scale.setScalar(0.03 + t * 0.06);
    }
  }
  return {
    root,
    buttons,
    hit,
    take,
    play,
    typing,
    reset,
    update,
    state: () => state,
    typed: () => typed,
    ready: () => ready,
    onChange: fn => listeners.push(fn)
  };
}

// Il prodotto in mano: la confezione o il bicchiere, che si consuma in tre morsi o sorsi.
// bite() restituisce quanti ne restano (0 = finito: la confezione va tolta)
export function makeHeld(gltf, product) {
  const drink = !product.pack;
  const group = new THREE.Group();
  let mesh;
  if (drink) {
    mesh = piece(gltf, 'bicchiere');
    const liquid = piece(gltf, 'bicchiere_liquido');
    setMaterial(liquid, () => new THREE.MeshStandardMaterial({ color: product.color, roughness: 0.25 }));
    liquid.position.y = 0.074;
    liquid.scale.setScalar(1.1);
    mesh.add(liquid);
    mesh.userData.liquid = liquid;
  } else mesh = packMesh(gltf, product, productMaterials(product));
  group.add(mesh);
  let left = 3,
    pulse = 0;
  return {
    group,
    product,
    left: () => left,
    bite() {
      if (left <= 0) return 0;
      left--;
      pulse = 1;
      if (drink) {
        const l = mesh.userData.liquid;
        l.position.y = 0.004 + 0.07 * (left / 3);
        l.scale.setScalar(0.85 + 0.25 * (left / 3));
        l.visible = left > 0;
      } else {
        // un morso: la confezione si accorcia dall'alto
        mesh.scale.y = 0.25 + 0.75 * (left / 3);
      }
      return left;
    },
    update(dt) {
      // piccolo scatto verso la bocca a ogni morso
      pulse = Math.max(0, pulse - dt * 3);
      group.rotation.x = -Math.sin(pulse * Math.PI) * 0.5;
    }
  };
}

// Suoni della macchinetta, fatti al momento con Web Audio (niente file). ctx(): l'AudioContext da usare, o null se
// i suoni sono spenti. Nomi: tasto, errore, motore, caduta, sportello, presa, bicchiere, erogazione, pronto, morso, sorso;
// per il carrello dei popcorn anche scoppio, sfrigolio, versa
export function vendingSounds(ctx) {
  let noiseBuf = null;
  const noise = ac => {
    if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  };
  // inviluppo: sale in `a` secondi, resta fino a `d`, poi si spegne in `r`
  const env = (ac, t, peak, a, d, r) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + r);
    g.connect(ac.destination);
    return g;
  };
  const tone = (ac, t, type, freq, peak, dur, to) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    o.connect(env(ac, t, peak, 0.005, dur * 0.3, dur * 0.7));
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const hiss = (ac, t, type, freq, q, peak, a, d, r, sweep) => {
    const s = noise(ac),
      f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + d + r);
    f.Q.value = q;
    s.connect(f).connect(env(ac, t, peak, a, d, r));
    s.start(t, Math.random());
    s.stop(t + d + r + 0.05);
  };
  const SOUNDS = {
    tasto: (ac, t) => tone(ac, t, 'sine', 1320, 0.06, 0.07),
    errore: (ac, t) => (
      tone(ac, t, 'square', 300, 0.03, 0.12),
      tone(ac, t + 0.16, 'square', 240, 0.03, 0.16)
    ),
    motore(ac, t) {
      // il motorino della spirale: ronzio basso che oscilla, poi uno scatto
      for (const [f, v] of [
        [70, 0.05],
        [140, 0.025]
      ]) {
        const o = ac.createOscillator(),
          lp = ac.createBiquadFilter(),
          g = env(ac, t, v, 0.08, 1.4, 0.15),
          wob = ac.createOscillator(),
          depth = ac.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        wob.frequency.value = 7;
        depth.gain.value = f * 0.04;
        wob.connect(depth).connect(o.frequency);
        o.connect(lp).connect(g);
        o.start(t);
        wob.start(t);
        o.stop(t + 1.7);
        wob.stop(t + 1.7);
      }
      hiss(ac, t + 1.55, 'bandpass', 2500, 3, 0.05, 0.003, 0.01, 0.05);
    },
    caduta: (ac, t) => (
      tone(ac, t, 'sine', 110, 0.12, 0.18, 45),
      hiss(ac, t, 'lowpass', 500, 0.7, 0.12, 0.003, 0.02, 0.12)
    ),
    sportello: (ac, t) => (
      hiss(ac, t, 'bandpass', 1400, 2, 0.08, 0.003, 0.02, 0.06),
      tone(ac, t + 0.05, 'sine', 180, 0.05, 0.08, 90)
    ),
    presa: (ac, t) => hiss(ac, t, 'bandpass', 900, 1.5, 0.04, 0.01, 0.03, 0.08),
    bicchiere: (ac, t) => (
      tone(ac, t, 'triangle', 950, 0.05, 0.05),
      hiss(ac, t, 'highpass', 3000, 1, 0.03, 0.002, 0.01, 0.04)
    ),
    erogazione(ac, t) {
      // pompa che ronza e getto che scende nel bicchiere (2,4 secondi)
      const o = ac.createOscillator(),
        lp = ac.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = 52;
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      o.connect(lp).connect(env(ac, t, 0.05, 0.1, 2.1, 0.25));
      o.start(t);
      o.stop(t + 2.5);
      hiss(ac, t + 0.1, 'bandpass', 700, 0.9, 0.05, 0.2, 1.9, 0.3, 1100);
    },
    pronto: (ac, t) => (tone(ac, t, 'sine', 880, 0.07, 0.25), tone(ac, t + 0.18, 'sine', 1320, 0.07, 0.4)),
    morso(ac, t) {
      for (let k = 0; k < 4; k++)
        hiss(ac, t + k * 0.05 + Math.random() * 0.02, 'highpass', 1800, 1, 0.07, 0.002, 0.015, 0.04);
    },
    // carrello dei popcorn: uno scoppio (colpetto secco e un clic), l'olio che sfrigola nel pentolino (4,5 s),
    // i popcorn versati che frusciano
    scoppio: (ac, t) => (
      hiss(
        ac,
        t,
        'bandpass',
        1500 + Math.random() * 1800,
        2.5,
        0.06 + Math.random() * 0.05,
        0.001,
        0.005,
        0.03
      ),
      tone(ac, t, 'sine', 380 + Math.random() * 380, 0.025, 0.03, 180)
    ),
    sfrigolio: (ac, t) => hiss(ac, t, 'highpass', 4200, 0.7, 0.025, 0.6, 3.4, 0.5),
    versa: (ac, t) => hiss(ac, t, 'bandpass', 2600, 0.8, 0.05, 0.05, 0.7, 0.4, 1200),
    sorso: (ac, t) => (
      hiss(ac, t, 'bandpass', 350, 3, 0.07, 0.03, 0.12, 0.12, 900),
      tone(ac, t + 0.2, 'sine', 160, 0.03, 0.12, 110)
    )
  };
  return name => {
    const ac = ctx();
    if (!ac || ac.state !== 'running' || !SOUNDS[name]) return;
    try {
      SOUNDS[name](ac, ac.currentTime + 0.01);
    } catch {}
  };
}
