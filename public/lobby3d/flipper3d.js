// Flipper della sala giochi della Lobby 3D: due tavoli con lo stesso motore 3D, comandi, suoni e classifica.
// - "Binottoland Grand Prix" (F1): blender/flipper.blend → models/flipper.glb, fisica ../flipper/physics.js
// - "Binotto GT" (24 ore endurance, tre rampe di filo): blender/binotto-gt.blend → models/binotto-gt.glb,
//   fisica ../flipper/physics-gt.js
// Il cabinet è fatto in Blender: mobile, tabellone con il display, piano. Si muovono i tre flipper (girano sul perno),
// la leva del lancio con la molla e i pulsanti. La fisica è sul piano inclinato: qui la pallina viene messa sul piano 3D.
import * as THREE from 'three';
import { isTouchDevice } from '../touch-device.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { paintPlayfield, paintBackglass } from './flipper-art.js?v=bfd8725542';
import { paintPlayfieldGT, paintBackglassGT } from './gt-art.js?v=0105a1455e';
import * as GP from '../flipper/physics.js?v=fa74a615d3';
import * as GT from '../flipper/physics-gt.js?v=99f8d6367a';

// contro la parete in fondo della sala giochi, a destra della scritta ARCADE (a sinistra c'è il quadro);
// il Binotto GT accanto, verso l'angolo
const now0 = () => performance.now() / 1000;
export const FLIPPER_AT = { x: -18.05, z: -3.0, ry: Math.PI / 2 };
export const GT_AT = { x: -18.05, z: -4.4, ry: Math.PI / 2 };
const STAND = 1.15; // dove sta il personaggio, davanti alla barra (in metri dal centro del cabinet)
const LEVER_RUN = 0.06; // quanto torna indietro la leva tirata tutta

// cosa cambia da un tavolo all'altro
const TABLES = {
  gp: {
    physics: GP,
    model: 'models/flipper.glb',
    at: FLIPPER_AT,
    recordKey: 'binottoland-flipper-record',
    title: 'GRAND PRIX',
    paintPlayfield,
    paintBackglass,
    rampPos: p => GP.rampPoint(p.ramp.s),
    pit: [0.4, 0.95],
    lamps: (table, lamp) => ({
      lanes: table.lanes.map(x => lamp(x, 0.905, 0.016, '#ffd23f')),
      mult: [0, 1, 2, 3].map(i => lamp(0.15 + i * 0.062, 0.36, 0.016, '#ffb020')),
      lights: [0, 1, 2].map(i => lamp(0.205 + i * 0.035, 0.555, 0.013, '#ff2a2a')),
      ramps: [lamp(0.105, 0.46, 0.028, '#ff8a1c')],
      orbit: lamp(0.032, 0.63, 0.022, '#3cd8ff'),
      save: lamp(0.241, 0.05, 0.03, '#3cff7a'),
      extra: lamp(0.36, 0.92, 0.018, '#ff60ff'),
      superj: lamp(0.44, 0.92, 0.018, '#ff60ff'),
      pitArrow: lamp(0.37, 0.85, 0.024, '#3cff7a')
    })
  },
  gt: {
    physics: GT,
    model: 'models/binotto-gt.glb?v=3', // cambiare il numero a ogni nuova esportazione (il browser tiene il vecchio)
    at: GT_AT,
    recordKey: 'binottoland-gt-record',
    title: 'BINOTTO GT',
    paintPlayfield: paintPlayfieldGT,
    paintBackglass: paintBackglassGT,
    rampPos: p => GT.rampPoint(p.ramp.k, p.ramp.s),
    pit: [0.11, 0.76],
    lamps: (table, lamp) => ({
      lanes: table.lanes.map(x => lamp(x, 0.885, 0.015, '#c6ff1a')),
      mult: [0, 1, 2, 3].map(i => lamp(0.15 + i * 0.062, 0.36, 0.016, '#ff9a2a')),
      lights: table.targets.map(t => lamp((t.ax + t.bx) / 2, 0.655, 0.012, '#ffd23f')),
      ramps: GT.RAMPS.map((r, k) =>
        lamp(r.pts[0][0], r.pts[0][1] - 0.075, 0.02, ['#c6ff1a', '#ff9a2a', '#3ee7ff'][k])
      ),
      orbit: lamp(0.24, 0.5, 0.018, '#3cd8ff'),
      save: lamp(0.241, 0.05, 0.03, '#3cff7a'),
      extra: lamp(0.18, 0.7, 0.016, '#ff60ff'),
      superj: lamp(0.06, 0.7, 0.016, '#ff60ff'),
      pitArrow: lamp(0.15, 0.7, 0.02, '#3cff7a')
    })
  }
};

export function buildFlipper(
  scene,
  el,
  { audio, allowed, top = () => [], sendScore = () => {}, sendStart = () => {}, me = () => null, kind = 'gp' }
) {
  // scritte del display adatte al dispositivo: sul telefono non ci sono i tasti E e S
  const touchUI = isTouchDevice();
  const PLAY_TEXT = touchUI ? 'TOCCA PER GIOCARE' : 'PREMI E PER GIOCARE',
    PLAY_SHORT = touchUI ? 'Tocca per giocare' : 'E per giocare',
    AGAIN_TEXT = touchUI ? 'Tocca per ricominciare' : 'S per ricominciare';
  const T = TABLES[kind];
  const { newGame, makeTable, simulate, setFlipper, pull, drag, nudge, R, LANE_X, BALLS } = T.physics;
  const paintPlayfield = T.paintPlayfield,
    paintBackglass = T.paintBackglass;
  const AT = T.at;
  const root = new THREE.Group();
  root.position.set(AT.x, 0, AT.z);
  root.rotation.y = AT.ry;
  scene.add(root);
  const glow = {},
    inner = { spring: null, tip: null, last: 0, slam: 0 };
  // grafica: vetro del tabellone (ridisegnato per la cornice di lampadine) e inserti del piano
  const art = { lamps: null, bgCanvas: document.createElement('canvas'), lastBg: 0 };
  art.bgCanvas.width = 768;
  art.bgCanvas.height = 579;
  paintBackglass(art.bgCanvas, 0, true);
  art.bgTexture = new THREE.CanvasTexture(art.bgCanvas);
  art.bgTexture.colorSpace = THREE.SRGBColorSpace;
  // si ridisegna di continuo: senza versioni rimpicciolite (mipmap), che andrebbero rifatte a ogni invio
  art.bgTexture.generateMipmaps = false;
  art.bgTexture.minFilter = THREE.LinearFilter;
  let record = 0;
  try {
    record = Number(localStorage.getItem(T.recordKey)) || 0;
  } catch {}
  let piano = null,
    flips = [],
    lever = null,
    leverZ = 0,
    knobLocal = new THREE.Vector3(0, 0, 0.13),
    buttons = [],
    buttonX = [],
    spring = null,
    camera = null;
  // display a punti del tabellone: un canvas disegnato ogni tanto
  const dmdCanvas = document.createElement('canvas');
  dmdCanvas.width = 256;
  dmdCanvas.height = 64;
  const dmd = dmdCanvas.getContext('2d');
  const dmdTexture = new THREE.CanvasTexture(dmdCanvas);
  dmdTexture.colorSpace = THREE.SRGBColorSpace;
  dmdTexture.generateMipmaps = false;
  dmdTexture.minFilter = THREE.LinearFilter;
  let dmdText = '';
  function drawDmd(top, bottom) {
    const key = top + '|' + bottom;
    if (key === dmdText) return;
    dmdText = key;
    dmd.fillStyle = '#120600';
    dmd.fillRect(0, 0, 256, 64);
    dmd.fillStyle = '#ff8a1c';
    dmd.textAlign = 'center';
    dmd.textBaseline = 'middle';
    // numero grande (si restringe solo se non ci sta), riga di testo sotto
    let size = 40;
    dmd.font = `900 ${size}px "Courier New", monospace`;
    const wide = dmd.measureText(top).width;
    if (wide > 248) size = Math.floor((size * 248) / wide);
    dmd.font = `900 ${size}px "Courier New", monospace`;
    dmd.fillText(top, 128, 24);
    dmd.font = '700 12px "Courier New", monospace';
    dmd.fillText(bottom, 128, 55);
    // griglia dei punti luminosi
    dmd.fillStyle = '#120600aa';
    for (let x = 0; x < 256; x += 3) dmd.fillRect(x, 0, 1, 64);
    for (let y = 0; y < 64; y += 3) dmd.fillRect(0, y, 256, 1);
    dmdTexture.needsUpdate = true;
  }
  drawDmd(T.title, PLAY_TEXT);
  // pallina d'acciaio (fino a 3 col multiball), figlie del piano: coordinate del gioco → piano
  const steel = new THREE.MeshStandardMaterial({ color: '#d8dde2', metalness: 1, roughness: 0.12 });
  const balls = [0, 1, 2].map(() => new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), steel));
  // molla attorno all'asta della leva (si comprime quando la tiri)
  const coil = [];
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * 14 * Math.PI;
    coil.push(new THREE.Vector3(0.0142 * Math.cos(a), 0.0142 * Math.sin(a), (i / 160) * 0.087));
  }
  spring = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 320, 0.002, 6),
    new THREE.MeshStandardMaterial({ color: '#c9d2da', metalness: 0.9, roughness: 0.25 })
  );
  new GLTFLoader().load(new URL(T.model, import.meta.url).href, gltf => {
    root.add(gltf.scene);
    piano = gltf.scene.getObjectByName('piano');
    flips = ['flipper_sx', 'flipper_dx', 'flipper_alto'].map(n => gltf.scene.getObjectByName(n));
    lever = gltf.scene.getObjectByName('leva');
    leverZ = lever.position.z;
    lever.geometry?.computeBoundingBox?.();
    const box = new THREE.Box3().setFromObject(lever);
    knobLocal = lever.worldToLocal(
      new THREE.Vector3(box.getCenter(new THREE.Vector3()).x, box.getCenter(new THREE.Vector3()).y, box.max.z)
    );
    spring.position.copy(lever.position);
    gltf.scene.add(spring);
    buttons = ['pulsante_sx', 'pulsante_dx'].map(n => gltf.scene.getObjectByName(n));
    buttonX = buttons.map(b => b.position.x);
    const display = gltf.scene.getObjectByName('display');
    if (display) {
      // pannello piatto grande quanto il display, rivolto verso chi gioca: il punteggio non si stira
      display.geometry.computeBoundingBox();
      const bb = display.geometry.boundingBox;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(bb.max.x - bb.min.x, bb.max.y - bb.min.y),
        new THREE.MeshBasicMaterial({ map: dmdTexture, toneMapped: false })
      );
      screen.position.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.max.z + 0.001);
      gltf.scene.add(screen);
      display.material = new THREE.MeshBasicMaterial({ color: '#120600' });
      // vetro dipinto del tabellone (collage della gara di notte) con la cornice di lampadine
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7085, 0.534),
        new THREE.MeshBasicMaterial({ map: art.bgTexture, toneMapped: false })
      );
      glass.position.set(screen.position.x, screen.position.y + 0.414, bb.max.z + 0.014); // davanti alle luci del modello
      gltf.scene.add(glass);
    }
    {
    }
    // superfici luminose (luci, neon, inserti) più vive
    gltf.scene.traverse(o => {
      if (o.isMesh && o.material?.emissiveIntensity) o.material.emissiveIntensity *= 1.4;
    });
    const table = makeTable();
    const halo = (x, y, z, r, color) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(r, 28),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      m.position.set(x - 0.26, z, -(y - 0.53));
      m.rotation.x = -Math.PI / 2;
      piano.add(m);
      return m;
    };
    glow.bumpers = table.bumpers.map(b => halo(b.x, b.y, 0.075, 0.05, '#ff5a2a'));
    glow.slings = table.walls
      .filter(w => w.kicker)
      .map(w =>
        halo((w.ax + w.bx) / 2 + (w.sling ? 0.02 : -0.02), (w.ay + w.by) / 2 - 0.02, 0.045, 0.05, '#ff2a3a')
      );
    glow.targets = table.targets.map(t => halo((t.ax + t.bx) / 2, t.ay, 0.04, 0.03, '#ffd23f'));
    glow.pit = halo(T.pit[0], T.pit[1], 0.03, 0.04, '#3cff7a');
    glow.light = new THREE.PointLight('#ffb070', 0, 0.6, 1.6);
    piano.add(glow.light);
    // piano dipinto (asfalto, cordoli, frecce dei tiri, logo): appena sopra il piano di Blender
    const pf = document.createElement('canvas');
    pf.width = 1024;
    pf.height = 2088;
    paintPlayfield(pf);
    const pfTex = new THREE.CanvasTexture(pf);
    pfTex.colorSpace = THREE.SRGBColorSpace;
    pfTex.anisotropy = 8;
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 1.06),
      new THREE.MeshStandardMaterial({ map: pfTex, roughness: 0.55, metalness: 0.05 })
    );
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0.0011;
    piano.add(field);
    // inserti luminosi: lampadine sotto il piano che si accendono con il gioco
    const lamp = (x, y, r, color) => halo(x, y, 0.0014, r, color);
    art.lamps = T.lamps(table, lamp);
    {
      const coil = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * 12 * Math.PI;
        coil.push(new THREE.Vector3(0.0075 * Math.cos(a), 0.0075 * Math.sin(a), i / 120));
      }
      const metal = new THREE.MeshStandardMaterial({ color: '#c9d2da', metalness: 0.9, roughness: 0.25 });
      inner.spring = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 240, 0.0013, 6),
        metal
      );
      inner.spring.position.set(0.501 - 0.26, R * 0.7, 0.53);
      inner.spring.rotation.y = Math.PI; // dal fondo della corsia verso la pallina
      piano.add(inner.spring);
      inner.tip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 16), metal);
      inner.tip.rotation.x = Math.PI / 2;
      inner.tip.position.set(0.501 - 0.26, R * 0.7, 0.5);
      piano.add(inner.tip);
    }
    for (const b of balls) {
      b.visible = false;
      piano.add(b);
    }
  });

  // ---------- suoni (sintetizzati, come nell'anteprima) ----------
  let noise = null,
    ownAudio = null,
    volume = 0.8; // cursore "Flipper" del mixer della Lobby
  function wakeAudio() {
    try {
      if (!audio()) ownAudio ??= new AudioContext();
      for (const ac of [audio(), ownAudio]) if (ac?.state === 'suspended') ac.resume().catch(() => {});
    } catch {}
  }
  // l'audio della Lobby se è acceso, altrimenti il nostro (sul telefono quello della Lobby può restare sospeso)
  const ctx = () => [audio(), ownAudio].find(ac => ac?.state === 'running') || audio() || ownAudio;
  function sound(type, power = 0.6) {
    const ac = ctx();
    if (!ac || ac.state !== 'running' || !allowed() || volume <= 0) return;
    const now = ac.currentTime,
      out = ac.createGain();
    out.gain.value = 0.3 * volume;
    out.connect(ac.destination);
    if (!noise) {
      noise = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const hit = (freq, q, decay, level, delay = 0) => {
      const s = ac.createBufferSource(),
        f = ac.createBiquadFilter(),
        g = ac.createGain();
      s.buffer = noise;
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      g.gain.setValueAtTime(level, now + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
      s.connect(f).connect(g).connect(out);
      s.start(now + delay);
      s.stop(now + delay + decay + 0.02);
    };
    const tone = (hz, decay, level, delay = 0, end = hz, kind = 'square') => {
      const o = ac.createOscillator(),
        g = ac.createGain();
      o.type = kind;
      o.frequency.setValueAtTime(hz, now + delay);
      o.frequency.exponentialRampToValueAtTime(end, now + delay + decay);
      g.gain.setValueAtTime(level, now + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay);
      o.connect(g).connect(out);
      o.start(now + delay);
      o.stop(now + delay + decay + 0.02);
    };
    const p = Math.max(0.2, Math.min(1, power));
    if (type === 'flip') {
      hit(900, 2, 0.05, 0.5);
      tone(120, 0.06, 0.15, 0, 70, 'sine');
    } else if (type === 'bumper') {
      hit(420, 1.5, 0.09, 0.7);
      tone(660, 0.12, 0.08, 0, 330);
    } else if (type === 'sling') {
      hit(1600, 3, 0.05, 0.6);
      tone(240, 0.06, 0.08, 0, 160);
    } else if (type === 'target') {
      hit(1200, 4, 0.07, 0.6);
      tone(880, 0.1, 0.06);
    } else if (type === 'lane') tone(1320, 0.15, 0.06, 0, 1320, 'sine');
    else if (type === 'launch') {
      hit(300, 1, 0.2, 0.5 * p);
      tone(90, 0.15, 0.1, 0, 50, 'sine');
    } else if (type === 'lap') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 0.06, i * 0.07));
    else if (type === 'pit') {
      hit(200, 1.2, 0.15, 0.7);
      tone(150, 0.2, 0.1, 0, 90, 'sine');
    } else if (type === 'eject') hit(500, 1.5, 0.1, 0.6);
    else if (type === 'drain')
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 0.06, i * 0.12, f * 0.95, 'triangle'));
    else if (type === 'tilt') tone(110, 0.8, 0.12, 0, 100, 'sawtooth');
    else if (type === 'nudge') hit(150, 1, 0.12, 0.5);
    else if (type === 'hit') hit(1100, 3, 0.04, 0.4 * p);
    else if (type === 'ramp' || type === 'rampUp') {
      // fruscio della pallina sulla rampa e "vroom" che sale
      hit(2600, 1, type === 'ramp' ? 0.35 : 0.5, 0.25);
      tone(180, 0.5, 0.07, 0, type === 'ramp' ? 540 : 360, 'sawtooth');
    } else if (type === 'rampFail') tone(400, 0.4, 0.06, 0, 160, 'triangle');
    else if (type === 'combo') [660, 880].forEach((f, i) => tone(f, 0.1, 0.07, i * 0.06));
    else if (type === 'skill' || type === 'extra' || type === 'jackpot' || type === 'super') {
      const notes =
        type === 'super'
          ? [523, 659, 784, 1047, 1319, 1568]
          : type === 'jackpot'
            ? [523, 659, 784, 1047]
            : [784, 988, 1175];
      notes.forEach((f, i) => tone(f, 0.16, 0.08, i * 0.08, f, 'square'));
      hit(5000, 1, 0.5, 0.15, 0.1);
    } else hit(2200, 5, 0.03, 0.25 * p);
    // la voce del tavolo (sintesi vocale del browser, in italiano)
    const words = {
      skill: 'Tiro di precisione!',
      jackpot: 'Jackpot!',
      super: 'Super jackpot!',
      extra: 'Palla extra!',
      tilt: 'Tilt!'
    };
    if (words[type]) say(words[type]);
    if (type === 'combo' && power >= 0.75) say('Combo!');
  }
  let lastVoice = 0;
  function say(text) {
    try {
      const now = performance.now();
      if (!allowed() || volume <= 0 || now - lastVoice < 1200 || !window.speechSynthesis) return;
      lastVoice = now;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT';
      u.rate = 1.15;
      u.pitch = 0.9;
      u.volume = Math.min(1, volume);
      speechSynthesis.speak(u);
    } catch {}
  }
  let motor = null;
  function engine(g) {
    const ac = ctx();
    if (!g || g.over || !active || !ac || ac.state !== 'running' || !allowed()) {
      if (motor) {
        motor.gain.gain.setTargetAtTime(0, ac?.currentTime || 0, 0.2);
        const m = motor;
        setTimeout(() => {
          try {
            m.osc.stop();
            m.osc.disconnect();
            m.gain.disconnect();
          } catch {}
        }, 600);
        motor = null;
      }
      return;
    }
    if (!motor) {
      const osc = ac.createOscillator(),
        lp = ac.createBiquadFilter(),
        gain = ac.createGain();
      osc.type = 'sawtooth';
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      gain.gain.value = 0;
      osc.connect(lp).connect(gain).connect(ac.destination);
      osc.start();
      motor = { osc, gain };
    }
    const v = Math.max(0, ...g.balls.map(b => (b.ramp ? b.ramp.v : Math.hypot(b.vx, b.vy))));
    motor.osc.frequency.setTargetAtTime(42 + v * 22, ac.currentTime, 0.15);
    motor.gain.gain.setTargetAtTime((0.018 + Math.min(0.03, v * 0.008)) * volume, ac.currentTime, 0.2);
  }

  // ---------- partita ----------
  const hud = document.createElement('div');
  hud.style.cssText =
    'position:absolute;left:50%;bottom:calc(var(--ui-safe-bottom,0px) + 10px);transform:translateX(-50%);display:none;gap:10px;align-items:flex-end;font:600 12px system-ui,sans-serif;color:#ffe2b8;text-shadow:0 1px 2px #000;pointer-events:none;z-index:4';
  const bar = label => {
    const w = document.createElement('div');
    w.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px';
    const b = document.createElement('div');
    b.style.cssText =
      'width:84px;height:9px;border-radius:5px;background:#0009;border:1px solid #ffffff40;overflow:hidden';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:0;background:linear-gradient(90deg,#ffd23f,#ff5a2a)';
    b.append(fill);
    const t = document.createElement('span');
    t.textContent = label;
    w.append(b, t);
    hud.append(w);
    return { w, fill };
  };
  const bars = [bar('Flipper sinistro'), bar('Leva'), bar('Flipper destro')];
  const tip = document.createElement('div');
  tip.style.cssText =
    'position:absolute;left:50%;bottom:calc(var(--ui-safe-bottom,0px) + 46px);transform:translateX(-50%);display:none;font:600 12px system-ui,sans-serif;color:#ffe2b8cc;text-shadow:0 1px 2px #000;pointer-events:none;white-space:nowrap;z-index:4';
  tip.textContent =
    'Tocco breve = colpo morbido · Tenuto = colpo pieno · Leva: trascina il pomello (più tiri, più forte) · Spazio scossa';
  el.append(hud, tip);
  const leverZone = document.createElement('div');
  // telefono: le tre scritte in basso diventano tasti veri (la zona del tocco è più grande del tasto)
  if (touchUI) {
    tip.textContent =
      'Tocca a sinistra e a destra i flipper · Leva: tieni premuto o trascina giù, lascia per lanciare';
    tip.style.whiteSpace = 'normal';
    tip.style.width = '92%';
    tip.style.textAlign = 'center';
    tip.style.bottom = 'calc(var(--ui-safe-bottom,0px) + 70px)';
    for (const { w } of bars)
      w.style.cssText +=
        ';padding:8px 10px 6px;border-radius:14px;background:rgba(255,200,40,.5);border:1px solid rgba(255,200,40,.75);color:#2a1600;text-shadow:none;font-size:12px';
    // la zona della leva (in basso al centro, vedi il tocco più sotto) segnata da un bordo tratteggiato
    leverZone.style.cssText =
      'position:absolute;left:34%;width:32%;top:75%;bottom:0;border:2px dashed rgba(255,200,40,.6);border-bottom:0;border-radius:18px 18px 0 0;pointer-events:none;z-index:3;display:none';
    leverZone.setAttribute('aria-hidden', 'true');
    el.append(leverZone);
  }
  const touchSide = new Map(); // dito → flipper che sta tenendo (si lascia lo stesso anche se il dito scivola)
  addEventListener('mouseup', e => {
    if (!active || !game) return;
    if (!((e.buttons ?? 0) & 1) && pressed[0] && !grab) flip(0, false);
    if (!((e.buttons ?? 0) & 2) && pressed[1]) flip(1, false);
  });
  const look = { yaw: 0, pitch: 0 }; // la testa di chi gioca: si gira muovendo il mouse
  const turn = new THREE.Quaternion(),
    UP = new THREE.Vector3(0, 1, 0);
  let game = null,
    active = false,
    pressed = [false, false],
    pulling = false,
    lastDmd = 0,
    idle = false,
    grab = null;
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  function flip(side, down) {
    if (!game) return;
    setFlipper(game, side, down);
    pressed[side] = down;
  }
  function setPull(on) {
    if (!game) return;
    pull(game, on);
    pulling = on;
  }
  function onLever(e) {
    if (!camera || !lever) return false;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(lever, true).length > 0;
  }
  const api = {
    get active() {
      return active;
    },
    // dove sta chi gioca (davanti alla barra) e verso dove guarda
    stand() {
      const p = root.localToWorld(new THREE.Vector3(0, 0, STAND));
      return { x: p.x, z: p.z, yaw: AT.ry };
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
    },
    wake: wakeAudio,
    open() {
      active = true;
      look.yaw = look.pitch = 0;
      game = newGame();
      sendStart(); // il server segna l'inizio: a fine partita accetta solo un punteggio possibile in quel tempo
      pressed = [false, false];
      pulling = false;
    },
    close() {
      active = false;
      if (game) drawDmd(game.score.toLocaleString('it-IT'), 'ULTIMA PARTITA');
      game = null;
      pressed = [false, false];
      pulling = false;
      grab = null;
      touchSide.clear();
    },
    // tastiera: Z / M (o Maiusc, frecce) i flipper, S o Freccia giù o Invio tirano la leva, Spazio la scossa, E o Esc escono
    input(e) {
      wakeAudio();
      const down = e.type === 'keydown';
      if (e.repeat) return true;
      const c = e.code;
      if (down && (c === 'KeyE' || c === 'Escape')) return 'exit';
      if (['KeyZ', 'ShiftLeft', 'ArrowLeft'].includes(c)) flip(0, down);
      else if (['KeyM', 'Slash', 'ShiftRight', 'ArrowRight'].includes(c)) flip(1, down);
      else if (['KeyS', 'ArrowDown', 'Enter'].includes(c)) {
        if (game?.over && down) api.open();
        else setPull(down);
      } else if (c === 'Space') {
        if (down) nudge(game, 0);
      } else return false;
      return true;
    },
    // mouse: tasto sinistro e destro i flipper; trascinando il pomello della leva la si tira (più la tiri, più parte forte)
    pointer(e) {
      if (!game) return false;
      // sul telefono l'audio si sblocca solo quando il dito si alza (il tocco giù non basta al browser)
      if (e.type === 'pointerdown' || e.type === 'pointerup') wakeAudio();
      // Mouse: i flipper seguono i tasti davvero premuti (e.buttons). Con un tasto già giù il browser non manda il
      // "giù" e il "su" dell'altro tasto: leggendo lo stato dei tasti a ogni evento i flipper non restano mai bloccati.
      if (e.pointerType === 'mouse' && !game.over) {
        const down = e.buttons ?? 0;
        if (e.type === 'pointerdown' && e.button === 0 && onLever(e) && !grab) {
          grab = { id: e.pointerId, y: e.clientY };
          drag(game, 0);
          pulling = true;
        }
        const left = !grab && (down & 1) !== 0,
          right = (down & 2) !== 0;
        if (left !== pressed[0]) flip(0, left);
        if (right !== pressed[1]) flip(1, right);
      }
      if (e.type === 'pointerdown') {
        if (game.over) {
          api.open();
          return true;
        }
        if (e.pointerType !== 'mouse') {
          // telefono: in basso al centro (sopra la scritta "Leva") si tiene la leva: tenuto carica, trascinato
          // in giù tira di più, lasciato lancia; a sinistra e a destra di quella zona i due flipper
          const r = el.getBoundingClientRect(),
            fx = (e.clientX - r.left) / r.width,
            fy = (e.clientY - r.top) / r.height;
          if (fy > 0.75 && fx > 0.34 && fx < 0.66) {
            if (!grab) {
              grab = { id: e.pointerId, y: e.clientY, moved: false };
              setPull(true);
            }
          } else {
            touchSide.set(e.pointerId, fx < 0.5 ? 0 : 1);
            flip(fx < 0.5 ? 0 : 1, true);
          }
          return true;
        }
        return true;
      }
      if (e.type === 'pointermove') {
        if (grab?.id === e.pointerId) {
          // col dito si comincia a trascinare solo dopo qualche pixel: un tocco tenuto fermo carica da solo
          if (e.pointerType === 'mouse' || grab.moved || Math.abs(e.clientY - grab.y) > 8) {
            grab.moved = true;
            drag(game, (e.clientY - grab.y) / 110);
          }
        } else if (e.pointerType === 'mouse') {
          // muovendo il mouse si gira la testa (entro un limite naturale), i tasti restano per i flipper
          look.yaw = Math.max(-0.75, Math.min(0.75, look.yaw - (e.movementX || 0) * 0.003));
          look.pitch = Math.max(-0.45, Math.min(0.35, look.pitch - (e.movementY || 0) * 0.003));
        }
        return true;
      }
      if (e.type === 'pointerup' || e.type === 'pointercancel') {
        if (grab?.id === e.pointerId && (e.pointerType !== 'mouse' || !((e.buttons ?? 0) & 1))) {
          grab = null;
          setPull(false);
        } else if (e.pointerType !== 'mouse' && touchSide.has(e.pointerId)) {
          const side = touchSide.get(e.pointerId);
          touchSide.delete(e.pointerId);
          // l'altro dito può tenere ancora lo stesso flipper
          if (![...touchSide.values()].includes(side)) flip(side, false);
        }
        return true;
      }
      return false;
    },
    blur() {
      if (!game) return;
      flip(0, false);
      flip(1, false);
      if (pulling) setPull(false);
      grab = null;
    },
    // posa per gli altri: slot = pulsanti premuti (1 sinistro, 2 destro) o 4 se tira la leva
    slot() {
      return pulling ? 4 : (pressed[0] ? 1 : 0) + (pressed[1] ? 2 : 0);
    },
    // dove vanno le mani: sui pulsanti (premuti: un paio di centimetri dentro) o la destra sul pomello della leva
    hands(slot = 0, plunger = 0) {
      if (!buttons.length) return null;
      const left = buttons[0].localToWorld(new THREE.Vector3(slot & 1 ? 0.012 : -0.01, 0, 0));
      let right = buttons[1].localToWorld(new THREE.Vector3(slot & 2 ? -0.012 : 0.01, 0, 0));
      if (slot === 4)
        right = lever.localToWorld(
          knobLocal.clone().add(new THREE.Vector3(0, 0, 0.012 + plunger * LEVER_RUN * 0))
        );
      return [left, right];
    },
    plunger: () => game?.plunger ?? 0,
    // live: chi guarda è in sala giochi lì vicino (o sta giocando). Da lontano, senza partita, il flipper resta com'è:
    // prima tabellone, lampadine e display si ridisegnavano 30 volte al secondo anche dall'altra parte della Lobby.
    update(cam, dt, live = true) {
      camera = cam;
      const g = game;
      if (g) {
        simulate(g, dt);
        for (const ev of g.events.splice(0)) sound(ev.type, ev.power);
      }
      if (!piano) return;
      if (!live && !g) {
        // l'ultima cosa da sistemare dopo una partita: palline via, barre nascoste, motore spento
        if (!idle) {
          idle = true;
          for (const b of balls) b.visible = false;
          hud.style.display = tip.style.display = leverZone.style.display = 'none';
          engine(null);
        }
        return;
      }
      idle = false;
      // pallina sul piano
      balls.forEach((b, i) => {
        const p = g?.balls[i];
        b.visible = !!p;
        if (p?.ramp) {
          const q = T.rampPos(p);
          b.position.set(q.x - 0.26, q.z + 0.006 + R, -(q.y - 0.53));
        } else if (p) b.position.set(p.x - 0.26, R, -(p.y - 0.53));
      });
      // flipper: girano sul perno (stesso angolo della fisica)
      if (g) g.t.flippers.forEach((f, i) => flips[i] && (flips[i].rotation.y = f.a - f.rest));
      // leva e molla: tirata torna indietro verso chi gioca e la molla si accorcia
      const pullNow = g?.plunger ?? 0;
      lever.position.z = leverZ + pullNow * LEVER_RUN;
      // molla esterna: viaggia con il pomello senza schiacciarsi; quando la leva torna indietro di colpo ammortizza
      if (inner.last > 0.08 && pullNow === 0) inner.slam = 0.22;
      inner.last = pullNow;
      inner.slam = Math.max(0, inner.slam - dt);
      spring.position.z = lever.position.z;
      spring.scale.z = 1 - 0.45 * Math.sin((inner.slam / 0.22) * Math.PI);
      // molla interna (nella corsia di lancio): più tiri, più si comprime, e il pistone scende con lei
      if (inner.spring) {
        const tipY = 0.0225 - pullNow * 0.02;
        inner.spring.scale.z = Math.max(0.004, tipY);
        inner.tip.position.z = -(tipY - 0.53);
      }
      // pulsanti premuti
      buttons.forEach((b, i) => (b.position.x = buttonX[i] + (pressed[i] ? (i ? -0.008 : 0.008) : 0)));
      // luci sui colpi
      if (g && glow.bumpers) {
        let best = 0,
          at = null;
        const set = (m, v, x, y) => {
          m.material.opacity = Math.min(1, v);
          if (v > best) {
            best = v;
            at = [x, y];
          }
        };
        g.t.bumpers.forEach((b, i) => set(glow.bumpers[i], b.flash / 0.12, b.x, b.y));
        g.t.walls
          .filter(w => w.kicker)
          .forEach((w, i) =>
            set(glow.slings[i], (w.flash || 0) / 0.15, (w.ax + w.bx) / 2, (w.ay + w.by) / 2)
          );
        g.t.targets.forEach((t, i) =>
          set(glow.targets[i], (t.flash || 0) / 0.25 + (t.down ? 0.25 : 0), (t.ax + t.bx) / 2, t.ay)
        );
        set(glow.pit, g.pitFlash, T.pit[0], T.pit[1]);
        glow.light.intensity = best * 0.8;
        if (at) glow.light.position.set(at[0] - 0.26, 0.08, -(at[1] - 0.53));
      }
      // barre della potenza
      hud.style.display = tip.style.display = active ? 'flex' : 'none';
      if (active) tip.style.display = 'block';
      leverZone.style.display = active ? 'block' : 'none';
      if (g) {
        g.t.flippers.slice(0, 2).forEach((f, i) => {
          const k = Math.max(0, Math.min(1, (f.a - f.rest) / (f.up - f.rest)));
          bars[i ? 2 : 0].fill.style.width = (k * 100).toFixed(0) + '%';
        });
        bars[1].fill.style.width = (g.plunger * 100).toFixed(0) + '%';
      }
      // inserti luminosi: accesi dal gioco, in attesa fanno un giro di luci
      const tt = now0();
      if (art.lamps) {
        const L = art.lamps,
          blink = Math.sin(tt * 9) > 0,
          set = (m, v) => (m.material.opacity = v ? 0.95 : 0.06);
        if (!g) {
          const all = [
            ...L.lanes,
            ...L.mult,
            ...L.lights,
            ...L.ramps,
            L.orbit,
            L.save,
            L.extra,
            L.superj,
            L.pitArrow
          ];
          all.forEach((m, i) => set(m, (Math.floor(tt * 8) + i) % 5 === 0));
        } else {
          L.lanes.forEach((m, i) =>
            set(
              m,
              g.lanes[i] || (g.balls.some(b => b.y < 0.06 && b.x > LANE_X) && i === g.skillLane && blink)
            )
          );
          L.mult.forEach((m, i) => set(m, g.mult >= i + 2));
          L.lights.forEach((m, i) => set(m, g.lights > i || (g.lights >= 3 && blink)));
          // rampe: lampeggiano in multiball e durante la combo, quella appena presa lampeggia per un secondo
          L.ramps.forEach((m, k) =>
            set(
              m,
              g.multiball || g.comboTimer > 0 || (g.rampFlash?.k === k && g.clock - (g.rampFlash.at ?? 0) < 1)
                ? blink
                : true
            )
          );
          set(L.orbit, g.comboTimer > 0 ? blink : g.laps > 0);
          set(L.save, g.save > 0 && (g.save > 2 || blink));
          set(L.extra, g.extraLit && blink);
          set(L.superj, g.superLit && blink);
          set(L.pitArrow, (g.lights >= 3 || g.extraLit || g.superLit) && blink);
        }
      }
      // vetro del tabellone: punteggio grande che sale in diretta, con un lampo quando arrivano punti
      // (in partita 30 volte al secondo, in attesa 12: il giro di lampadine si vede lo stesso)
      if (tt - art.lastBg > (g ? 1 / 30 : 1 / 12)) {
        const dt = tt - art.lastBg;
        art.lastBg = tt;
        let info;
        if (g) {
          if (g !== art.shownGame) ((art.shownGame = g), (art.shown = 0));
          const gap = g.score - art.shown;
          if (gap > 0) {
            art.shown = Math.min(g.score, art.shown + Math.max(gap * Math.min(1, dt * 9), 37));
            if (gap > 400) art.flash = 1;
          } else art.shown = g.score;
          art.flash = Math.max(0, (art.flash || 0) - dt * 3);
          info = {
            label: g.over ? 'PUNTEGGIO FINALE' : g.multiball ? 'MULTIBALL!' : 'PUNTEGGIO',
            score: Math.round(art.shown),
            ball: Math.min(g.ball, BALLS),
            balls: BALLS,
            mult: g.mult || 1,
            flash: art.flash,
            message: g.messageTime > 0 ? g.message : g.over ? AGAIN_TEXT : '',
            hour: g.hour
          };
        } else {
          const best = top()[0];
          info = best
            ? { label: 'RECORD', score: best.score, message: best.name, flash: 0 }
            : record
              ? { label: 'IL TUO RECORD', score: record, message: PLAY_SHORT, flash: 0 }
              : null;
        }
        paintBackglass(art.bgCanvas, tt, !g, info);
        art.bgTexture.needsUpdate = true;
      }
      // motore in sottofondo: sale di giri con la velocità della pallina
      engine(g);
      // fine partita: il punteggio va in classifica (una volta sola) e il display dice in che posizione sei
      if (g?.over && !g.sent) {
        g.sent = true;
        const list = top(),
          myId = String(me()?.id ?? '');
        g.rank = list.filter(e => e.score > g.score && e.id !== myId).length + 1;
        const mine = list.find(e => e.id === myId);
        if (g.score > 0 && (!mine || g.score > mine.score)) sendScore(g.score);
        if (g.score > record) {
          record = g.score;
          try {
            localStorage.setItem(T.recordKey, String(record));
          } catch {}
        }
        if (g.rank === 1 && g.score > 0) say('Nuovo record della classifica!');
        else if (g.rank <= 10 && g.score > 0) say('Sei in classifica!');
      }
      // in attesa: la classifica a rotazione (1. NOME · punti), poi "E PER GIOCARE"
      if (!g && tt - (art.lastTop || 0) > 2.2) {
        art.lastTop = tt;
        const list = top();
        art.topIndex = ((art.topIndex ?? -1) + 1) % (list.length + 1);
        const e = list[art.topIndex];
        if (e)
          drawDmd(
            e.score.toLocaleString('it-IT'),
            art.topIndex + 1 + '. ' + e.name.toUpperCase().slice(0, 20)
          );
        else drawDmd(list.length ? 'CLASSIFICA' : T.title, PLAY_TEXT + ' · 5 PALLINE');
      }
      // display
      const now = performance.now();
      if (g && now - lastDmd > 120) {
        lastDmd = now;
        const msg =
          g.messageTime > 0
            ? g.message
            : g.over
              ? (g.rank <= 10 && g.score > 0 ? g.rank + '° IN CLASSIFICA · ' : 'FINE · ') +
                'S PER RICOMINCIARE'
              : 'PALLINA ' + g.ball + '/' + BALLS;
        drawDmd(g.score.toLocaleString('it-IT'), msg.toUpperCase().slice(0, 30));
      }
      // vista: dagli occhi di chi gioca, sul piano inclinato
      if (active) {
        const eye = root.localToWorld(new THREE.Vector3(0, 1.62, 1.08));
        const target = root.localToWorld(new THREE.Vector3(0, 0.98, -0.12));
        cam.position.copy(eye);
        cam.lookAt(target);
        cam.quaternion.premultiply(turn.setFromAxisAngle(UP, look.yaw));
        cam.rotateX(look.pitch);
        if (g?.nudge > 0) cam.position.x += (Math.random() - 0.5) * 0.01;
      }
    }
  };
  return api;
}
