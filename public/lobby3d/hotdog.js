// Macchinetta automatica degli hot dog della Lobby 3D (docs/macchinetta.md, «Macchinetta automatica degli hot dog»).
// Solo visiva: niente soldi. Modello di Blender: blender/hotdog.blend → models/hotdog.glb (davanti verso +z, base a
// terra, larga 1,15 m). I pezzi che si muovono arrivano già al loro posto, con l'origine dove girano o si attaccano.
// createHotdog(gltf) restituisce la macchinetta (root) e i comandi:
//   hit(object)  → che cosa è stato toccato: un tasto ({type:'key', key}) e lo esegue, o l'hot dog pronto ({type:'item'})
//   play(code)   → prepara l'hot dog del codice: 'c' classico o 'v' vegano, poi le salse 'm', 's', 'k' (es. 'vsk')
//   typed()      → il codice di quello che è scelto adesso; typing(code) mostra la scelta di un altro
//   update(dt)   → braccio, rulli, panino, salse, carta, botola, sportello
//   take()       → prende l'hot dog pronto: {k: codice}, o null
//   reset()      → torna a «scegli» (chi la usava è andato via)
//   onChange(fn) → chiamata a ogni cambio di stato (scegli, prepara, pronto)
// L'hot dog in mano (makeHeldHotdog) è a parte, perché in Lobby lo porta il personaggio.
import * as THREE from 'three';

export const HOTDOG_KEYS = ['classico', 'vegano', 'maionese', 'senape', 'ketchup', 'prepara'];
const SAUCES = [
  { c: 'm', key: 'maionese', name: 'maionese', color: '#f3ead0' },
  { c: 's', key: 'senape', name: 'senape', color: '#e0a20c' },
  { c: 'k', key: 'ketchup', name: 'ketchup', color: '#a3150f' }
];
export const hotdogProduct = code => {
  const veg = String(code || '').startsWith('v');
  return { id: 'hotdog-' + cleanCode(code), name: veg ? 'Hot dog vegano' : 'Hot dog', pack: 'carta', bites: 4 };
};
// codice pulito: tipo e salse nell'ordine dei tasti
export function cleanCode(code) {
  const s = String(code || '');
  return (s.startsWith('v') ? 'v' : 'c') + SAUCES.filter(x => s.slice(1).includes(x.c)).map(x => x.c).join('');
}
const sauceText = code => {
  const list = SAUCES.filter(x => code.slice(1).includes(x.c)).map(x => x.name);
  return list.length ? list.join(', ') : 'senza salse';
};

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
function fitFont(g, text, max, size, family = '"Arial Black", Arial, sans-serif') {
  g.font = 'bold ' + size + 'px ' + family;
  while (g.measureText(text).width > max && size > 10) g.font = 'bold ' + --size + 'px ' + family;
}
// un piccolo hot dog disegnato: panino, würstel e la riga di senape
function doodle(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#e8a64a';
  g.beginPath();
  g.ellipse(0, 6, 46, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b8461f';
  g.beginPath();
  g.ellipse(0, -2, 52, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffd23a';
  g.lineWidth = 4;
  g.beginPath();
  for (let i = 0; i <= 8; i++) g.lineTo(-40 + i * 10, -4 + (i % 2 ? -4 : 3));
  g.stroke();
  g.restore();
}
const signTexture = () =>
  canvasTexture(1024, 152, (g, W, H) => {
    g.fillStyle = '#b3121b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#c8202a';
    for (let x = -H; x < W; x += 60) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 30, H);
      g.lineTo(x + 30 + H, 0);
      g.lineTo(x + H, 0);
      g.fill();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    fitFont(g, 'HOT DOG', W - 300, 118);
    g.fillStyle = '#5a0608';
    g.fillText('HOT DOG', W / 2 + 5, H / 2 + 8);
    g.lineWidth = 12;
    g.strokeStyle = '#ffffff';
    g.strokeText('HOT DOG', W / 2, H / 2 + 3);
    g.fillStyle = '#ffd23a';
    g.fillText('HOT DOG', W / 2, H / 2 + 3);
    doodle(g, 95, H / 2, 1.2);
    doodle(g, W - 95, H / 2, 1.2);
  });
const veganTexture = () =>
  canvasTexture(512, 56, (g, W, H) => {
    g.fillStyle = '#2f8f2a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, 'VEGANO', W - 40, 40);
    g.fillText('VEGANO', W / 2, H / 2 + 2);
  });
const KEY_LOOK = {
  classico: { label: 'CLASSICO', bg: '#8c3418', w: 240, h: 120 },
  vegano: { label: 'VEGANO', bg: '#2f8f2a', w: 240, h: 120 },
  maionese: { label: 'MAIONESE', bg: '#efe4c2', fg: '#3a2a10', w: 160, h: 140 },
  senape: { label: 'SENAPE', bg: '#d99a0a', fg: '#2a1a00', w: 160, h: 140 },
  ketchup: { label: 'KETCHUP', bg: '#a3150f', w: 160, h: 140 },
  prepara: { label: 'PREPARA', bg: '#1d8a35', w: 160, h: 280 }
};
const keyTexture = key => {
  const k = KEY_LOOK[key];
  return canvasTexture(k.w, k.h, (g, W, H) => {
    g.fillStyle = k.bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.55)';
    g.lineWidth = 6;
    g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = k.fg || '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (key === 'prepara') {
      g.beginPath();
      g.moveTo(W * 0.38, H * 0.3);
      g.lineTo(W * 0.68, H * 0.42);
      g.lineTo(W * 0.38, H * 0.54);
      g.fill();
      fitFont(g, k.label, W - 26, 34, 'Arial, sans-serif');
      g.fillText(k.label, W / 2, H * 0.74);
    } else {
      fitFont(g, k.label, W - 26, 40, 'Arial, sans-serif');
      g.fillText(k.label, W / 2, H / 2 + 2);
    }
  });
};

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
const ease = t => t * t * (3 - 2 * t);
const clamp01 = t => Math.min(1, Math.max(0, t));

// braccio (metri, coordinate della macchinetta in three: davanti +z): spalla, gomito, polso e punto di presa
const L1 = 0.27,
  L2 = 0.25,
  GRIP = 0.06;
const SPEED = 1.35; // m/s della pinza (con due salse l'hot dog è pronto in circa 20 secondi)
const HOME = new THREE.Vector3(0.3, 1.3, 0.04);
const SHELF = new THREE.Vector3(-0.46, 1.3, -0.05); // base del panino davanti sulla mensola
const SPIKE = new THREE.Vector3(-0.36, 1.02, 0.12); // base del panino infilzato
const TRAY = new THREE.Vector3(0.3, 0.96, 0.14); // base dell'hot dog sul foglio
const NICHE = new THREE.Vector3(0.3, 0.556, 0.245); // nel vano di ritiro
const BUN_GRIP = 0.125; // la pinza prende il panino dall'alto, 12,5 cm sopra la base
const BUN_TOP = 0.14;
const DOG_GRIP = 0.055; // il würstel dritto si tiene 5,5 cm sopra il centro
const DOG_IN = 0.08; // centro del würstel infilato, sopra la base del panino
const BOTTLE_GRIP = 0.05; // il flacone si prende 5 cm sopra il centro; capovolto, il beccuccio è 6,5 cm sotto la pinza

export function createHotdog(gltf, { sound = () => {} } = {}) {
  const root = new THREE.Group();
  const fixed = ['macchina', 'vetro', 'insegna', 'display', 'griglia_vegana', 'punzone', 'panini_scorta', 'sportello'];
  for (const n of fixed) root.add(piece(gltf, n));
  const glass = root.getObjectByName('vetro');
  setMaterial(
    glass,
    () => new THREE.MeshStandardMaterial({ color: '#e4f2f8', transparent: true, opacity: 0.07, depthWrite: false, roughness: 0.03 })
  );
  noRay(glass);
  const flap = root.getObjectByName('sportello');
  noRay(flap);
  const sign = signTexture(),
    veg = veganTexture();
  const heat = {};
  root.traverse(o => {
    if (!o.isMesh) return;
    const n = o.material.name;
    if (n === 'insegna_hotdog')
      o.material = new THREE.MeshStandardMaterial({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.4 });
    if (n === 'verde_vegano') o.material = new THREE.MeshStandardMaterial({ map: veg, emissiveMap: veg, emissive: 0xffffff, emissiveIntensity: 0.3 });
    if (n === 'fume') o.material = new THREE.MeshStandardMaterial({ color: '#16171a', transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.1 });
    if (n.startsWith('resistenza_')) {
      o.material = new THREE.MeshStandardMaterial({ color: '#3a0c02', emissive: '#ff4a10', emissiveIntensity: 0.6 });
      heat[n.slice(11)] = o.material;
    }
  });
  // display: dice cosa è scelto e cosa sta facendo
  const screen = document.createElement('canvas');
  screen.width = 512;
  screen.height = 472;
  const screenTex = new THREE.CanvasTexture(screen);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.flipY = false;
  root.getObjectByName('display').traverse(o => {
    if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  });
  function show(line1, line2 = '', line3 = '') {
    const g = screen.getContext('2d'),
      W = screen.width,
      H = screen.height;
    g.fillStyle = '#071214';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ffb43a';
    g.lineWidth = 6;
    g.strokeRect(14, 14, W - 28, H - 28);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd23a';
    fitFont(g, line1, W - 60, 74);
    g.fillText(line1, W / 2, H * 0.3);
    g.fillStyle = '#e8f4f0';
    fitFont(g, line2, W - 60, 44, 'Arial, sans-serif');
    g.fillText(line2, W / 2, H * 0.56);
    g.fillStyle = '#9fc7bf';
    fitFont(g, line3, W - 60, 34, 'Arial, sans-serif');
    g.fillText(line3, W / 2, H * 0.77);
    screenTex.needsUpdate = true;
  }

  // tasti
  const buttons = [],
    keyMat = {},
    keyRest = {};
  for (const key of HOTDOG_KEYS) {
    const b = piece(gltf, 'tasto_' + key);
    const tex = keyTexture(key);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.4 });
    setMaterial(b, () => m);
    keyMat[key] = m;
    keyRest[key] = b.position.z;
    b.userData.hotdog = { type: 'key', key };
    root.add(b);
    buttons.push(b);
  }

  // griglie: rulli che girano e würstel che rotolano
  const rollers = [],
    franks = [];
  for (let i = 0; i < 5; i++) rollers.push(piece(gltf, 'rullo_' + i));
  for (let i = 0; i < 3; i++) rollers.push(piece(gltf, 'rullo_vegano_' + i));
  for (let i = 0; i < 4; i++) franks.push(piece(gltf, 'wurstel_' + i));
  for (let i = 0; i < 2; i++) franks.push(piece(gltf, 'wurstel_vegano_' + i));
  for (const o of [...rollers, ...franks]) {
    o.userData.rest = o.position.clone();
    root.add(o);
    noRay(o);
  }
  const frankFor = veg => franks[veg ? 4 : 0];

  // panino (con le salse) in un gruppo con l'origine alla base del panino
  const dog = new THREE.Group();
  dog.userData.hotdog = { type: 'item' };
  root.add(dog);
  const bun = piece(gltf, 'panino');
  const bunRest = bun.position.clone();
  bun.position.set(0, 0, 0);
  dog.add(bun);
  const sauce = {};
  for (const s of SAUCES) {
    const o = piece(gltf, 'salsa_' + s.name);
    o.position.sub(bunRest);
    o.visible = false;
    dog.add(o);
    sauce[s.c] = o;
  }
  const wrap = piece(gltf, 'carta_avvolta');
  wrap.position.set(0, -0.001, 0);
  wrap.visible = false;
  dog.add(wrap);
  dog.visible = false;
  // flaconi, carta, botola, braccio
  const bottles = {};
  for (const s of SAUCES) {
    const o = piece(gltf, 'flacone_' + s.name);
    o.userData.rest = o.position.clone();
    root.add(o);
    noRay(o);
    bottles[s.c] = o;
  }
  const roll = piece(gltf, 'rotolo_carta');
  const sheet = piece(gltf, 'carta');
  const hatch = piece(gltf, 'botola');
  const cart = piece(gltf, 'carrello');
  root.add(roll, sheet, hatch, cart);
  sheet.visible = false;
  for (const o of [roll, sheet, hatch, cart]) noRay(o);
  const sheetRest = sheet.position.clone();
  const arm = {
    base: cart.getObjectByName('braccio_base'),
    shoulder: cart.getObjectByName('braccio_spalla'),
    elbow: cart.getObjectByName('braccio_gomito'),
    wrist: cart.getObjectByName('braccio_polso'),
    left: cart.getObjectByName('dito_sx'),
    right: cart.getObjectByName('dito_dx')
  };
  const shoulderY = cart.position.y + arm.base.position.y + arm.shoulder.position.y;
  const shoulderZ = cart.position.z;
  // getto di salsa dal beccuccio al panino
  const streamMat = new THREE.MeshStandardMaterial({ color: '#a3150f', roughness: 0.3 });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 8), streamMat);
  stream.visible = false;
  noRay(stream);
  root.add(stream);

  // braccio: la pinza va sul punto T, sempre rivolta in giù (le dita stringono lungo z)
  const T = HOME.clone();
  let fingers = 0.045;
  function solveArm() {
    cart.position.x = THREE.MathUtils.clamp(T.x, -0.5, 0.5);
    arm.base.rotation.y = -Math.PI / 2; // il braccio si piega avanti e indietro (verso il vetro e verso il fondo)
    const s = T.z - shoulderZ,
      v = shoulderY - (T.y + GRIP);
    const d = Math.min(L1 + L2 - 1e-4, Math.max(Math.abs(L1 - L2) + 1e-4, Math.hypot(s, v)));
    const a2 = -Math.acos(THREE.MathUtils.clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
    const a1 = Math.atan2(s, v) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
    arm.shoulder.rotation.z = a1;
    arm.elbow.rotation.z = a2;
    arm.wrist.rotation.z = -(a1 + a2);
    arm.left.position.x = -fingers;
    arm.right.position.x = fingers;
  }
  // quello che la pinza tiene: segue T con uno scarto
  let carry = null;
  const carryAt = () => {
    if (carry) carry.obj.position.copy(T).add(carry.off);
  };

  // passi della preparazione: ognuno dura dur secondi e fa tick(f) con f da 0 a 1
  let steps = [],
    stepT = 0,
    fx = [];
  const move = (to, opt = {}) => {
    let from;
    return {
      dur: opt.dur,
      start() {
        from = T.clone();
        this.dur ??= Math.max(0.2, from.distanceTo(to) / SPEED);
        if (this.dur > 0.4) sound('servo');
      },
      tick(f) {
        T.lerpVectors(from, to, ease(f));
        opt.tick?.(f);
      }
    };
  };
  const grip = w => {
    let from;
    return { dur: 0.2, start: () => (from = fingers), tick: f => (fingers = from + (w - from) * f) };
  };
  const wait = (dur, tick) => ({ dur, tick });
  const call = fn => ({ dur: 0, start: fn });
  const hold = (obj, off) => call(() => (carry = { obj, off: off ?? obj.position.clone().sub(T) }));
  const drop = () => call(() => (carry = null));
  const anim = (dur, tick) => fx.push({ t: 0, dur, tick });

  let state = 'scegli',
    choice = 'c',
    job = null,
    heating = 0;
  const listeners = [];
  const emit = () => listeners.forEach(fn => fn({ state, code: job?.code || null }));
  function lightKeys(code) {
    for (const key of HOTDOG_KEYS) {
      const on =
        (key === 'classico' && code[0] === 'c') ||
        (key === 'vegano' && code[0] === 'v') ||
        SAUCES.some(s => s.key === key && code.slice(1).includes(s.c));
      keyMat[key].emissiveIntensity = on ? 0.95 : 0.2;
    }
  }
  function idle() {
    const code = cleanCode(choice);
    lightKeys(code);
    show(code[0] === 'v' ? 'VEGANO' : 'CLASSICO', sauceText(code), 'scegli le salse, poi PREPARA');
  }
  function restAll() {
    for (const o of [...franks, ...Object.values(bottles)]) {
      o.position.copy(o.userData.rest);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(1);
      if (o.parent !== root) root.add(o);
    }
    dog.visible = false;
    dog.position.copy(SHELF);
    dog.rotation.set(0, 0, 0);
    for (const c in sauce) sauce[c].visible = false;
    wrap.visible = false;
    sheet.visible = false;
    stream.visible = false;
    hatch.rotation.x = 0;
    flap.rotation.x = 0;
    T.copy(HOME);
    fingers = 0.045;
    carry = null;
    heating = 0;
    steps = [];
    fx = [];
  }
  restAll();
  idle();

  // il flacone gira tra le dita (attorno a z): f = 0 dritto, 1 capovolto; il centro gira attorno alla presa
  function turnBottle(b, off, f) {
    const a = ease(f) * Math.PI;
    b.rotation.z = a;
    off.set(BOTTLE_GRIP * Math.sin(a), -BOTTLE_GRIP * Math.cos(a), 0);
  }
  function sauceSteps(s) {
    const b = bottles[s.c],
      at = b.userData.rest,
      off = new THREE.Vector3(0, -BOTTLE_GRIP, 0);
    const up = new THREE.Vector3(at.x, 1.53, at.z),
      grab = new THREE.Vector3(at.x, at.y + BOTTLE_GRIP, at.z);
    const over = new THREE.Vector3(SPIKE.x, SPIKE.y + BUN_TOP + 0.03 + 0.065, SPIKE.z); // beccuccio 3 cm sopra il panino
    return [
      move(up),
      grip(0.045),
      move(grab),
      grip(0.024),
      hold(b, off),
      move(up),
      move(new THREE.Vector3(at.x, 1.53, SPIKE.z)),
      move(new THREE.Vector3(SPIKE.x, 1.45, SPIKE.z), { tick: f => turnBottle(b, off, f) }),
      move(over),
      call(() => {
        show('SALSE…', s.name, '');
        streamMat.color.set(s.color);
        sauce[s.c].visible = true;
        sauce[s.c].scale.setScalar(0.01);
        sound('spremi');
      }),
      wait(0.75, f => {
        sauce[s.c].scale.setScalar(Math.max(0.01, ease(f)));
        b.scale.set(1 - 0.12 * Math.sin(f * Math.PI), 1, 1 - 0.12 * Math.sin(f * Math.PI));
        stream.visible = f < 0.85;
        const tip = T.y - 0.065,
          top = SPIKE.y + BUN_TOP;
        stream.scale.y = Math.max(0.001, tip - top);
        stream.position.set(T.x, (tip + top) / 2, T.z);
      }),
      call(() => (stream.visible = false)),
      move(new THREE.Vector3(SPIKE.x, 1.45, SPIKE.z)),
      move(new THREE.Vector3(at.x, 1.53, SPIKE.z), { tick: f => turnBottle(b, off, 1 - f) }),
      move(up),
      move(grab),
      drop(),
      grip(0.045),
      move(up)
    ];
  }

  function play(code) {
    if (state !== 'scegli') return false;
    code = cleanCode(code);
    restAll();
    state = 'prepara';
    job = { code };
    choice = code;
    lightKeys(code);
    const veg = code[0] === 'v';
    const frank = frankFor(veg),
      fr = frank.userData.rest;
    const above = new THREE.Vector3(SPIKE.x, 1.5, SPIKE.z);
    steps = [
      call(() => {
        show('PREPARO…', veg ? 'hot dog vegano' : 'hot dog', sauceText(code));
        dog.visible = true;
        dog.position.copy(SHELF);
      }),
      // il panino dalla mensola al punzone (la pinza scende dall'alto)
      move(new THREE.Vector3(SHELF.x, 1.5, SHELF.z)),
      move(new THREE.Vector3(SHELF.x, SHELF.y + BUN_GRIP, SHELF.z)),
      grip(0.035),
      hold(dog),
      move(new THREE.Vector3(SHELF.x, 1.5, SHELF.z)),
      move(above),
      move(new THREE.Vector3(SPIKE.x, SPIKE.y + BUN_GRIP, SPIKE.z), { dur: 0.9 }),
      drop(),
      grip(0.045),
      move(new THREE.Vector3(SPIKE.x, 1.4, SPIKE.z)),
      // il panino scalda infilzato, il würstel gira
      call(() => {
        show('SCALDO…', 'il panino sul punzone', veg ? 'il würstel vegano gira' : 'il würstel gira');
        heating = 1;
        sound('sfrigolio');
      }),
      wait(2.2),
      // le salse scelte, una per volta
      ...SAUCES.filter(s => code.slice(1).includes(s.c)).flatMap(sauceSteps),
      // il würstel dalla griglia dentro il panino
      call(() => show('PREPARO…', veg ? 'il würstel vegano' : 'il würstel', 'nel panino')),
      move(fr.clone().add(new THREE.Vector3(0, 0.1, 0))),
      grip(0.045),
      move(fr.clone()),
      grip(0.013),
      call(() => (frank.rotation.x = 0)),
      hold(frank, new THREE.Vector3()),
      move(fr.clone().add(new THREE.Vector3(0, 0.12, 0))),
      // si raddrizza andando sopra il panino, poi scende dentro
      move(new THREE.Vector3(SPIKE.x, SPIKE.y + BUN_TOP + 0.075 + DOG_GRIP, SPIKE.z), {
        tick: f => {
          frank.rotation.z = (ease(f) * Math.PI) / 2;
          carry.off.set(0, -DOG_GRIP * ease(f), 0);
        }
      }),
      move(new THREE.Vector3(SPIKE.x, SPIKE.y + DOG_IN + DOG_GRIP, SPIKE.z), { dur: 0.8 }),
      drop(),
      call(() => {
        dog.attach(frank);
        heating = 0;
        sound('presa');
      }),
      grip(0.045),
      move(new THREE.Vector3(SPIKE.x, 1.4, SPIKE.z)),
      // il foglio di carta esce dal rotolo; l'hot dog va sul foglio
      call(() => {
        show('CARTA…', 'incarto l\'hot dog', '');
        sheet.visible = true;
        const from = new THREE.Vector3(TRAY.x, sheetRest.y, -0.12);
        anim(0.9, f => {
          sheet.position.lerpVectors(from, sheetRest, ease(f));
          sheet.scale.set(1, 1, Math.max(0.05, f));
          roll.rotation.x = -f * 3;
        });
      }),
      move(new THREE.Vector3(SPIKE.x, SPIKE.y + BUN_GRIP, SPIKE.z)),
      grip(0.035),
      hold(dog),
      move(new THREE.Vector3(SPIKE.x, 1.37, SPIKE.z), { dur: 0.6 }),
      move(new THREE.Vector3(TRAY.x, 1.37, TRAY.z)),
      move(new THREE.Vector3(TRAY.x, TRAY.y + BUN_GRIP, TRAY.z)),
      drop(),
      grip(0.045),
      move(HOME.clone()),
      // la carta lo avvolge
      call(() => {
        sheet.visible = false;
        wrap.visible = true;
        sound('presa');
      }),
      wait(0.55, f => wrap.scale.set(1, Math.max(0.05, ease(f)), 1)),
      // botola: scende nel vano di ritiro, poi si apre lo sportello
      wait(0.35, f => (hatch.rotation.x = 1.25 * ease(f))),
      call(() => sound('caduta')),
      wait(0.45, f => {
        dog.position.lerpVectors(TRAY, NICHE, f * f);
        dog.rotation.x = 0.25 * Math.sin(f * Math.PI);
      }),
      wait(0.35, f => (hatch.rotation.x = 1.25 * (1 - ease(f)))),
      call(() => sound('sportello')),
      wait(0.4, f => (flap.rotation.x = -1.15 * ease(f))),
      call(() => {
        state = 'pronto';
        show('PRONTO!', veg ? 'hot dog vegano' : 'hot dog', 'tocca l\'hot dog per prenderlo');
        sound('pronto');
        emit();
      })
    ];
    stepT = 0;
    steps[0].start?.();
    sound('tasto');
    emit();
    return true;
  }

  function press(o, key) {
    o.position.z = keyRest[key] - 0.007; // il tasto si abbassa
    setTimeout(() => (o.position.z = keyRest[key]), 140);
  }
  function hit(obj) {
    let o = obj;
    while (o && !o.userData.hotdog) o = o.parent;
    const v = o?.userData.hotdog;
    if (!v) return null;
    if (v.type === 'key') {
      press(o, v.key);
      sound('tasto');
      if (state !== 'scegli') return v;
      const s = SAUCES.find(x => x.key === v.key);
      if (v.key === 'classico' || v.key === 'vegano') choice = (v.key === 'vegano' ? 'v' : 'c') + choice.slice(1);
      else if (s) choice = choice.includes(s.c, 1) ? choice.replace(s.c, '') : choice + s.c;
      if (v.key === 'prepara') play(choice);
      else idle();
    }
    return v;
  }
  function typing(code) {
    if (state !== 'scegli') return;
    const c = cleanCode(code);
    if (c !== cleanCode(choice)) {
      choice = c;
      idle();
    }
  }
  function take() {
    if (state !== 'pronto') return null;
    const got = { k: job.code };
    sound('presa');
    restAll();
    state = 'scegli';
    job = null;
    idle();
    emit();
    return got;
  }
  function reset() {
    if (state === 'scegli') return;
    restAll();
    state = 'scegli';
    job = null;
    idle();
    emit();
  }

  let clock = 0;
  function update(dt) {
    clock += dt;
    dt = Math.min(dt, 0.1);
    // i rulli girano sempre; più svelti mentre prepara
    const spin = dt * (state === 'prepara' ? 5 : 2.2);
    for (const r of rollers) r.rotation.x -= spin;
    for (const f of franks) if (f.parent === root && carry?.obj !== f && f.position.equals(f.userData.rest)) f.rotation.x += spin * 1.1;
    // resistenze: la griglia sempre calda, il punzone acceso mentre scalda il panino
    const glow = 0.8 + 0.25 * Math.sin(clock * 4);
    if (heat.griglia) heat.griglia.emissiveIntensity = glow;
    if (heat.vegano) heat.vegano.emissiveIntensity = glow;
    if (heat.punzone) heat.punzone.emissiveIntensity = state === 'prepara' && heating ? 1.6 + 0.6 * Math.sin(clock * 9) : 0.35;
    // passi della preparazione
    let left = dt;
    while (steps.length && left > 0) {
      const s = steps[0];
      const need = s.dur - stepT;
      const use = Math.min(left, Math.max(0, need));
      stepT += use;
      left -= use;
      s.tick?.(s.dur ? clamp01(stepT / s.dur) : 1);
      if (stepT >= s.dur) {
        steps.shift();
        stepT = 0;
        steps[0]?.start?.();
        if (steps[0] && !steps[0].dur) continue;
      }
      if (use === 0 && need > 0) break;
    }
    for (const a of fx) {
      a.t += dt;
      a.tick(clamp01(a.t / a.dur));
    }
    fx = fx.filter(a => a.t < a.dur);
    solveArm();
    carryAt();
  }
  solveArm();
  return {
    root,
    buttons,
    hit,
    play,
    take,
    reset,
    typing,
    typed: () => cleanCode(choice),
    update,
    state: () => state,
    onChange: fn => listeners.push(fn)
  };
}

// In mano: l'hot dog nella carta, quattro morsi; si accorcia dall'alto, la carta resta fino alla fine.
// bite() restituisce quanti ne restano (0 = finito)
export function makeHeldHotdog(gltf, code) {
  code = cleanCode(code);
  const group = new THREE.Group();
  const food = new THREE.Group();
  group.add(food);
  const bun = piece(gltf, 'panino');
  const bunAt = bun.position.clone();
  bun.position.set(0, 0, 0);
  food.add(bun);
  const frank = piece(gltf, code[0] === 'v' ? 'wurstel_vegano_0' : 'wurstel_0');
  frank.position.set(0, DOG_IN, 0);
  frank.rotation.z = Math.PI / 2;
  food.add(frank);
  for (const s of SAUCES) {
    if (!code.slice(1).includes(s.c)) continue;
    const o = piece(gltf, 'salsa_' + s.name);
    o.position.sub(bunAt);
    food.add(o);
  }
  const wrap = piece(gltf, 'carta_avvolta');
  wrap.position.set(0, 0, 0);
  wrap.visible = true;
  group.add(wrap);
  const product = hotdogProduct(code);
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
      food.scale.y = 0.35 + 0.65 * (left / product.bites);
      food.visible = left > 0;
      return left;
    },
    update(dt) {
      pulse = Math.max(0, pulse - dt * 3);
      group.rotation.x = -Math.sin(pulse * Math.PI) * 0.4;
    }
  };
}
