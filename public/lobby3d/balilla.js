import * as THREE from 'three';
import { isTouchDevice } from '../touch-device.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { roundBoxGeometry } from './shapes.js?v=acaec08552';
import {
  rows,
  figureZ,
  L,
  W,
  R,
  GOAL,
  ROD_H,
  ROD_R,
  MAX_ANGLE,
  TUNING_LIMITS,
  rodTurnStep,
  rodStep,
  cornerHeight,
  CORNER_RUN,
  CORNER_RISE
} from './balilla-rules.js?v=704daa16f5';

const TX = -13; // posizione del tavolo nella sala giochi
const TOP = 0.733; // piano del campo

// pay(): paga 1 gettone per la partita nuova (docs/gettoni.md); false se non ci sono gettoni
export function buildBalilla(scene, el, send, playSound, pay = () => true) {
  // ---------- il tavolo ----------
  const table = new THREE.Group();
  table.position.set(TX, 0, 0);
  scene.add(table);
  const material = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.3 : 0.56 });
  const frame = material('#111214'),
    chrome = material('#bccbd4', 0.82),
    rubber = material('#202228'),
    white = material('#fff1cc'),
    pitch = material('#267943'),
    railLining = material('#3e6591');
  const brass = material('#c7a16c', 0.7),
    sole = material('#17202c'),
    skin = material('#e0b390'),
    hole = material('#07090c');
  const kits = [material('#ef4438'), material('#388cec')];
  function mesh(geo, mat, x, y, z, parent = table) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const box = (w, h, d, m, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  // spigoli arrotondati per il mobile del tavolo
  const rbox = (w, h, d, r, m, x, y, z, parent) => mesh(roundBoxGeometry(w, h, d, r), m, x, y, z, parent);
  function cylinder(radius, length, m, x, y, z, parent) {
    const c = mesh(new THREE.CylinderGeometry(radius, radius, length, 16), m, x, y, z, parent);
    c.rotation.x = Math.PI / 2;
    return c;
  }
  // misure: campo 120 × 70 cm (L, W), porta 20 cm, aste da 16 mm ogni 15 cm, asse a 8,5 cm dal campo
  const AXIS = TOP + ROD_H,
    RAIL = W + 0.015, // sponda laterale
    OUT = 0.43, // fianco esterno del mobile
    END = L + 0.06; // fondo con la porta
  // mobile disegnato qui finché non arriva quello fatto in Blender (blender/tavolo-balilla.blend → models/tavolo-balilla.glb)
  const cabinetStart = table.children.length;
  for (const x of [-(L - 0.03), L - 0.03])
    for (const z of [-0.29, 0.29]) {
      rbox(0.08, 0.59, 0.08, 0.012, chrome, x, 0.31, z);
      box(0.095, 0.03, 0.095, rubber, x, 0.016, z);
    }
  rbox(2 * END + 0.04, 0.17, 2 * RAIL + 0.06, 0.02, frame, 0, 0.645, 0);
  for (const sign of [-1, 1]) {
    box(2 * END, 0.016, 0.013, brass, 0, 0.585, (RAIL + 0.032) * sign);
    for (const x of [-(L - 0.01), L - 0.01]) box(0.1, 0.2, 0.013, chrome, x, 0.675, (RAIL + 0.033) * sign);
  }
  const fallbackLines = [];
  box(2 * L, 0.014, 2 * W, pitch, 0, TOP, 0);
  for (const s of [-1, 1]) {
    const z = s * RAIL;
    rbox(2 * END + 0.04, 0.16, 0.03, 0.008, railLining, 0, 0.82, z);
    rbox(2 * END + 0.04, 0.012, 0.036, 0.005, chrome, 0, 0.895, z);
    // foro laterale di centrocampo da cui entra la palla
    const h = mesh(new THREE.CircleGeometry(0.022, 20), hole, 0, TOP + 0.026, z - s * 0.0155);
    h.rotation.y = s > 0 ? Math.PI : 0;
    mesh(new THREE.TorusGeometry(0.023, 0.003, 8, 24), chrome, 0, TOP + 0.026, z - s * 0.016);
  }
  for (const sign of [-1, 1]) {
    // fondo: due spalle ai lati della porta, porta larga 20 cm con la rete in gomma dietro
    for (const z of [-1, 1])
      rbox(
        END - L,
        0.16,
        W + 0.03 - GOAL,
        0.008,
        frame,
        sign * (L + (END - L) / 2),
        0.82,
        z * (GOAL + (W + 0.03 - GOAL) / 2)
      );
    box(0.018, 0.16, 2 * GOAL, rubber, sign * (END - 0.009), 0.82, 0);
    box(END - L, 0.02, 2 * GOAL, chrome, sign * (L + (END - L) / 2), 0.89, 0);
    box(END - L, 0.004, 2 * GOAL, hole, sign * (L + (END - L) / 2), TOP - 0.002, 0);
    const lineStart = table.children.length;
    // righe: fondo, area di porta e area grande
    box(2 * L - 0.04, 0.001, 0.003, white, 0, TOP + 0.008, sign * (W - 0.05));
    box(0.003, 0.001, 2 * W - 0.1, white, sign * (L - 0.02), TOP + 0.008, 0);
    for (const z of [-1, 1])
      box(0.08, 0.001, 0.003, white, sign * (L - 0.06), TOP + 0.009, z * (GOAL + 0.04));
    box(0.003, 0.001, 2 * (GOAL + 0.04), white, sign * (L - 0.1), TOP + 0.009, 0);
    for (const z of [-1, 1]) box(0.16, 0.001, 0.003, white, sign * (L - 0.1), TOP + 0.009, z * (GOAL + 0.11));
    box(0.003, 0.001, 2 * (GOAL + 0.11), white, sign * (L - 0.18), TOP + 0.009, 0);
    fallbackLines.push(...table.children.slice(lineStart));
    // rialzi negli angoli: la palla non resta ferma nell'angolo
    for (const z of [-1, 1]) {
      const geometry = new THREE.BufferGeometry();
      const vertices = [
        sign * L,
        CORNER_RISE,
        z * W,
        sign * (L - CORNER_RUN),
        0,
        z * W,
        sign * L,
        0,
        z * (W - CORNER_RUN)
      ];
      if (sign * z > 0) vertices.push(...vertices.splice(3, 3));
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      mesh(geometry, pitch, 0, TOP + 0.008, 0);
    }
  }
  const middleStart = table.children.length;
  box(0.003, 0.001, 2 * W - 0.1, white, 0, TOP + 0.009, 0);
  mesh(new THREE.RingGeometry(0.076, 0.079, 48), white, 0, TOP + 0.009, 0).rotation.x = -Math.PI / 2;
  fallbackLines.push(...table.children.slice(middleStart));
  const cabinetParts = table.children.slice(cabinetStart);
  // tavolo da bar fatto in Blender: mobile nero con gambe squadrate e piedini, sponde blu, campo verde
  // con le righe, rialzi negli angoli, bulloni in ottone, targhette Binottoland e Calcio balilla, uscita della palla
  new GLTFLoader().load(new URL('models/tavolo-balilla.glb', import.meta.url).href, gltf => {
    for (const part of cabinetParts) part.removeFromParent();
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      if (o.material.name === 'bal_campo') o.material.color.copy(pitch.color);
      if (o.material.name === 'bal_sponda') o.material.color.copy(railLining.color);
    });
    table.add(gltf.scene);
  });
  // pallottoliere del punteggio sulla sponda dal lato dei rossi: 10 palline per squadra
  const beads = [0, 1].map(team => {
    const sign = team ? 1 : -1,
      list = [];
    for (let n = 0; n < 10; n++)
      list.push(box(0.01, 0.014, 0.014, kits[team], sign * (L - 0.16 + n * 0.0115), 0.912, RAIL));
    box(0.17, 0.003, 0.003, chrome, sign * (L - 0.1), 0.912, RAIL);
    return list;
  });
  // omino fatto in Blender (blender/omino.blend → models/omino.glb); finché non arriva, figure semplici
  const figures = [];
  function placeholder(team) {
    const g = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.015, 12, 10), skin, 0, 0.03, 0, g);
    box(0.024, 0.036, 0.036, kits[team], 0, -0.004, 0, g);
    box(0.023, 0.016, 0.034, white, 0, -0.028, 0, g);
    box(0.015, 0.037, 0.026, kits[team], 0, -0.054, 0, g);
    box(0.025, 0.011, 0.028, sole, 0.003, -0.0725, 0, g);
    return g;
  }
  const grips = [];
  const sticks = rows.map(row => {
    const dir = row.team ? -1 : 1,
      group = new THREE.Group();
    table.add(group);
    group.position.set(row.x, AXIS, 0);
    const t = row.travel;
    // boccole in ottone nelle due sponde: l'asta ci scorre dentro e non ne esce mai
    // boccole nere sul fianco esterno, rondelle bianche sulla sponda interna (come il tavolo vero)
    for (const side of [-1, 1]) {
      cylinder(0.022, 0.018, rubber, row.x, AXIS, side * (OUT + 0.009));
      cylinder(0.016, 0.004, white, row.x, AXIS, side * (W - 0.002));
    }
    // dal lato opposto alla manopola: manicotto telescopico fisso, lungo quanto tutta la corsa (l'asta ci rientra)
    const sleeve = 2 * t + 0.05;
    cylinder(0.012, sleeve, chrome, row.x, AXIS, -dir * (RAIL + 0.036 + sleeve / 2));
    cylinder(0.014, 0.012, rubber, row.x, AXIS, -dir * (RAIL + 0.036 + sleeve));
    // asta da 16 mm, sempre dentro tutte e due le boccole: dal fondo del manicotto alla manopola
    const far = -dir * (RAIL + 0.045 + t),
      grip = dir * (RAIL + 0.1 + t);
    cylinder(ROD_R, Math.abs(grip - far), chrome, 0, 0, (grip + far) / 2, group);
    // manopola in gomma con le scanalature
    grips.push(cylinder(0.019, 0.11, rubber, 0, 0, grip + dir * 0.055, group));
    for (let n = 0; n < 6; n++) cylinder(0.0205, 0.004, sole, 0, 0, grip + dir * (0.012 + n * 0.017), group);
    cylinder(0.015, 0.01, chrome, 0, 0, grip + dir * 0.004, group);
    // paracolpi in gomma sull'asta: a fine corsa toccano la sponda (la spalla dell'omino resta a mezzo centimetro)
    for (const side of [-1, 1]) cylinder(0.016, 0.01, rubber, 0, 0, side * (W - 0.005 - t), group);
    for (let n = 0; n < row.count; n++) {
      const z = figureZ(row, n, 0);
      const holder = new THREE.Group();
      holder.position.z = z;
      holder.rotation.y = row.team ? Math.PI : 0; // guardano la porta avversaria
      holder.add(placeholder(row.team));
      group.add(holder);
      figures.push({ holder, team: row.team });
    }
    return group;
  });
  new GLTFLoader().load(new URL('models/omino.glb', import.meta.url).href, gltf => {
    const base = gltf.scene;
    const paint = team => {
      const copy = base.clone(true);
      copy.traverse(o => {
        if (!o.isMesh) return;
        const name = o.material.name || '';
        const m = o.material.clone();
        if (name === 'bal_kit' || name === 'bal_sock') m.color.set(team ? '#2f7fe0' : '#e23b2e');
        if (name === 'bal_shorts') m.color.set(team ? '#14233f' : '#f4f1e8');
        o.material = m;
      });
      return copy;
    };
    const models = [paint(0), paint(1)];
    for (const f of figures) f.holder.clear().add(models[f.team].clone(true));
  });
  const ball = mesh(new THREE.SphereGeometry(0.017, 16, 12), white, 0, 0.758, 0);

  // niente pannello: sul computer tasti (Spazio, Q, E, + e -), sul telefono gesti sul tavolo
  // col dito si trascina per giocare, un tocco veloce butta la pallina, l'asta più vicina al dito sceglie difesa o attacco
  const touchUI = isTouchDevice();
  const exitChip = document.createElement('button');
  exitChip.textContent = '✕';
  exitChip.setAttribute('aria-label', 'Lascia il tavolo');
  exitChip.style.cssText =
    'position:absolute;right:calc(var(--ui-safe-right,0px) + 14px);bottom:calc(var(--ui-safe-bottom,0px) + 18px);width:46px!important;min-width:0!important;height:46px;min-height:0!important;padding:0!important;margin:0!important;border-radius:50%;font-size:20px!important;background:rgba(18,14,28,.6)!important;z-index:4';
  exitChip.hidden = true;
  el.append(exitChip);
  // riga di stato sempre visibile al tavolo (telefono e computer): punteggio, lato e coppia, pausa, chi fa uscire la
  // pallina. Prima non c'era niente: chi arrivava a un lato pieno non capiva perché le aste non rispondevano.
  const statusBar = document.createElement('div');
  statusBar.setAttribute('role', 'status');
  statusBar.style.cssText =
    'position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--ui-safe-top,0px) + ' +
    (touchUI ? 12 : 58) +
    'px);max-width:92vw;padding:6px 12px;border-radius:10px;background:rgba(10,8,16,.72);color:#fff;font:600 13px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none;z-index:4;white-space:pre-line';
  statusBar.hidden = true;
  el.append(statusBar);
  // telefono: tasto per cambiare coppia (a sinistra, simmetrico alla X), pad di gioco sotto il tavolo
  // e, alla sua sinistra, un pad verticale stretto per inclinare la visuale sul campo
  const chipCss =
    'position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 18px);width:46px!important;min-width:0!important;height:46px;min-height:0!important;padding:0!important;margin:0!important;border-radius:50%;font-size:22px!important;background:rgba(255,200,40,.5)!important;border:1px solid rgba(255,200,40,.75)!important;z-index:4';
  const swapChip = document.createElement('button');
  swapChip.textContent = '🔄';
  swapChip.setAttribute('aria-label', 'Cambia coppia (difesa/attacco)');
  swapChip.style.cssText = chipCss + ';left:calc(var(--ui-safe-left,0px) + 14px)';
  const padCss =
    'position:absolute;z-index:4;touch-action:none;border:2px solid rgba(255,255,255,.28);background:rgba(255,255,255,.07);border-radius:16px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.45);font:600 12px system-ui,sans-serif;text-align:center;user-select:none;-webkit-user-select:none';
  const pad = document.createElement('div');
  pad.style.cssText = padCss + ';left:30%;width:38%;top:72%;bottom:calc(var(--ui-safe-bottom,0px) + 18px)';
  const viewPad = document.createElement('div');
  // i due pad laterali con il simbolo e il nome sotto (prima solo ↕ e 🔍, senza nome per la lettura vocale)
  const namePad = (el, icon, name, help) => {
    el.style.flexDirection = 'column';
    el.innerHTML = `<span style="font-size:18px;line-height:1">${icon}</span><span style="font-size:12px">${name}</span>`;
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-label', name + ': ' + help);
  };
  viewPad.style.cssText = padCss + ';left:13%;width:13%;top:72%;height:14%';
  namePad(viewPad, '↕', 'Vista', 'trascina su e giù per inclinare la vista');
  const zoomPad = document.createElement('div');
  zoomPad.style.cssText = padCss + ';left:72%;width:13%;top:72%;height:14%';
  namePad(zoomPad, '🔍', 'Zoom', 'trascina su e giù per avvicinare o allontanare');
  const padLabel = document.createElement('span');
  pad.append(padLabel);
  // taratura da telefono: con l'ingranaggio si aprono i cursori (pad, visuale, zoom), i valori restano sul telefono
  const tune = { slide: 1, spin: 1, pitch: 60, zoom: 1 };
  try {
    Object.assign(tune, JSON.parse(localStorage.getItem('balilla.touchTune') || '{}'));
  } catch {}
  const saveTune = () => {
    try {
      localStorage.setItem('balilla.touchTune', JSON.stringify(tune));
    } catch {}
  };
  const gear = document.createElement('button');
  gear.textContent = '⚙';
  gear.setAttribute('aria-label', 'Taratura');
  gear.style.cssText =
    chipCss +
    ';bottom:auto;top:calc(var(--ui-safe-top,0px) + 64px);left:calc(var(--ui-safe-left,0px) + 14px)';
  const tunePanel = document.createElement('div');
  tunePanel.style.cssText =
    'position:absolute;left:calc(var(--ui-safe-left,0px) + 14px);top:calc(var(--ui-safe-top,0px) + 118px);z-index:5;background:#142026ee;color:#fff;padding:8px 10px;border-radius:12px;font:600 12px system-ui,sans-serif;display:none;gap:6px;flex-direction:column;width:min(260px,80vw)';
  const sliders = [
    ['slide', 'Scorrimento delle stecche', 0.3, 3, 0.05],
    ['spin', 'Rotazione delle stecche', 0.3, 3, 0.05],
    ['pitch', 'Vista', 30, 88, 1],
    ['zoom', 'Zoom', 0.5, 1.5, 0.01]
  ].map(([key, label, min, max, step]) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center';
    const name = document.createElement('span');
    name.textContent = label;
    const out = document.createElement('b');
    out.style.textAlign = 'right';
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min, max, step });
    input.style.cssText = 'grid-column:1/3;width:100%';
    const sync = () => {
      input.value = String(tune[key]);
      // parole al posto dei numeri grezzi
      const v = Number(tune[key]);
      out.textContent =
        key === 'pitch'
          ? v > 72
            ? "dall'alto"
            : v < 48
              ? 'di lato'
              : 'normale'
          : key === 'zoom'
            ? v > 1.1
              ? 'vicino'
              : v < 0.9
                ? 'lontano'
                : 'normale'
            : v > 1.15
              ? 'veloce'
              : v < 0.85
                ? 'lenta'
                : 'normale';
    };
    input.oninput = () => {
      tune[key] = Number(input.value);
      sync();
      saveTune();
    };
    row.append(name, out, input);
    tunePanel.append(row);
    return sync;
  });
  const syncTune = () => sliders.forEach(s => s());
  gear.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    syncTune();
    tunePanel.style.display = tunePanel.style.display === 'flex' ? 'none' : 'flex';
  });
  const touchControls = [swapChip, pad, viewPad, zoomPad, gear];
  const showTouch = on => {
    for (const c of touchControls) c.style.visibility = on ? 'visible' : 'hidden';
    if (!on) tunePanel.style.display = 'none';
  };
  for (const c of touchControls) el.append(c);
  el.append(tunePanel);
  showTouch(false);
  // sensibilità del mouse (tasti + e -), ricordata sul computer
  const sensitivity = {
    value: 1,
    step(d) {
      this.value = Math.round(Math.max(0.3, Math.min(2.5, this.value + d)) * 10) / 10;
      try {
        localStorage.setItem('balilla.sensitivity', String(this.value));
      } catch {}
    }
  };
  try {
    sensitivity.value = Number(localStorage.getItem('balilla.sensitivity')) || 1;
  } catch {}
  const host = el.querySelector('.l3d-gl') || el;
  let active = false,
    watching = false,
    team = 0,
    pair = 0,
    net = null,
    netBall = null;
  let lastWatch = 0,
    dirty = false,
    lastInput = 0,
    finger = null,
    tap = null,
    lastCamera = null;
  // valori fissi del tavolo (tarati a mano): nessuna zona morta, vista inclinata di 60° verso il campo
  const localSettings = { deadSlide: 0, deadSpin: 0, cameraPitch: 60 };
  const deadState = { deadSlide: { sum: 0, time: -Infinity }, deadSpin: { sum: 0, time: -Infinity } };
  function deadZone(key, delta, now) {
    const limit = localSettings[key];
    if (!limit || !delta) return delta;
    const state = deadState[key];
    if (now - state.time > 120) {
      state.sum = 0;
      state.passed = false;
    }
    state.time = now;
    if (state.passed) return delta;
    state.sum += delta;
    if (Math.abs(state.sum) <= limit) return 0;
    state.passed = true;
    return state.sum - Math.sign(state.sum) * limit;
  }
  const mouseLocked = () => document.pointerLockElement === host;
  let hadLock = false,
    blurredAt = -1e9;
  addEventListener('blur', () => (blurredAt = performance.now()));
  function lockMouse() {
    if (mouseLocked()) {
      hadLock = true;
      return;
    }
    try {
      host.requestPointerLock?.()?.then?.(
        () => {
          if (!active && mouseLocked()) document.exitPointerLock();
        },
        () => {}
      );
    } catch {}
  }
  document.addEventListener('pointerlockchange', () => {
    if (!active) return;
    // Esc libera il mouse ma non fa più alzare dal tavolo (prima si perdeva il posto): ci si alza con E o con la X;
    // per giocare di nuovo col mouse basta un clic sul campo
    if (mouseLocked()) hadLock = true;
    else hadLock = false;
    renderStatus();
  });
  const targets = [
    { slide: 0, angle: 0 },
    { slide: 0, angle: 0 }
  ];
  const post = (action, data = {}) => send?.({ type: 'balilla', action, ...data });
  const seated = () => active && net?.slot >= 0;
  // compagno dallo stesso lato (2 contro 1, 2 contro 2): allora ognuno ha la sua coppia di aste, fissa
  const mate = () => !!net && net.slot >= 0 && net.occupied.includes(net.slot ^ 1);
  // da soli al tavolo, o tutti dallo stesso lato: allenamento (i gol non contano)
  const alone = () => !!net && new Set(net.occupied.map(s => s >> 1)).size < 2;
  const join = () => post('join', { slot: team * 2, mode: 2, target: 10, bar: true });
  function selectPair(next) {
    if (mate()) next = net.slot % 2;
    pair = next;
    const i = rows.findIndex(r => r.team === team && r.attack === pair);
    const rod = net?.field?.rods[i];
    targets[pair] = { slide: (rod?.shift || 0) / rows[i].travel, angle: rod?.angle || 0 };
    dirty = true;
    grips.forEach((g, i) => {
      g.material = active && rows[i].team === team && rows[i].attack === pair ? brass : rubber;
    });
    padLabel.textContent = pair ? 'ATTACCO' : 'DIFESA';
    renderStatus();
  }
  function renderStatus() {
    if (!active) {
      statusBar.hidden = true;
      return;
    }
    statusBar.hidden = false;
    if (!net) {
      statusBar.textContent = 'Collegamento al tavolo…';
      return;
    }
    const f = net.field,
      side = team ? 'Blu' : 'Rossi',
      score = 'Rossi ' + f.score[0] + ' – ' + f.score[1] + ' Blu';
    const out = touchUI ? 'tocca il centro del campo' : 'premi Spazio';
    let line;
    if (!seated())
      line = net.elsewhere
        ? 'Stai già giocando da un altro dispositivo'
        : net.occupied.includes(team * 2) && net.occupied.includes(team * 2 + 1)
          ? 'Lato pieno: stai guardando'
          : 'Aspetto il posto…';
    else if (net.paused) line = 'In pausa: aspettiamo chi si è allontanato';
    else if (f.finished) line = 'Partita finita: ' + out + ' per una nuova partita';
    else if (alone())
      line = side + ' · allenamento, i gol non contano' + (f.phase === 'throw' ? ' · ' + out : '');
    else if (f.phase === 'throw') line = side + ' · pallina nel buco: ' + out;
    else line = side + ' · ' + (pair ? 'attacco' : 'difesa') + (mate() ? '' : touchUI ? '' : ' (Q cambia)');
    if (!touchUI && seated() && !mouseLocked()) line += ' · clicca sul campo per giocare col mouse';
    statusBar.textContent = score + '\n' + line + (touchUI ? '' : ' · E lascia il tavolo');
  }
  function serve() {
    if (!seated()) return;
    if (net.field.finished) {
      if (pay()) post('again'); // un'altra partita: un altro gettone
    }
    else if (alone() || net.field.phase === 'throw') post('ready', { pair });
  }
  function close() {
    if (active && mouseLocked()) document.exitPointerLock();
    hadLock = false;
    if (watching) post('leave');
    active = watching = dirty = false;
    exitChip.hidden = true;
    statusBar.hidden = true;
    showTouch(false);
    net = netBall = finger = tap = null;
    grips.forEach(g => (g.material = rubber));
  }
  exitChip.onclick = close;
  // cambio coppia: scatta appena il dito tocca il tasto, anche con l'altro dito ancora sul pad
  swapChip.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    if (seated()) selectPair(1 - pair);
  });
  // pad di gioco: su/giù sposta l'asta (tutta l'altezza del pad = tutta la corsa), destra/sinistra la ruota
  // (tutta la larghezza del pad = un giro e mezzo); i cursori della taratura cambiano queste misure
  pad.addEventListener('pointerdown', e => {
    e.preventDefault();
    finger = { id: e.pointerId, x: e.clientX, y: e.clientY, pad: pad.getBoundingClientRect() };
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {}
  });
  pad.addEventListener('pointermove', e => {
    if (finger?.id !== e.pointerId || !seated()) return;
    const dx = e.clientX - finger.x,
      dy = e.clientY - finger.y;
    finger.x = e.clientX;
    finger.y = e.clientY;
    const t = targets[pair],
      side = team ? -1 : 1;
    t.slide = clamp(t.slide + (dy / Math.max(60, finger.pad.height)) * 2 * tune.slide * side, 1);
    t.angle = clamp(
      t.angle + (dx / Math.max(60, finger.pad.width)) * 3 * Math.PI * tune.spin * side,
      MAX_ANGLE
    );
    dirty = true;
  });
  for (const ev of ['pointerup', 'pointercancel'])
    pad.addEventListener(ev, e => {
      if (finger?.id === e.pointerId) finger = null;
    });
  // pad verticali della visuale (in su più dall'alto) e dello zoom (in su più vicino): si usano solo
  // col pad di gioco libero, così mentre giochi non cambiano per sbaglio
  const sidePad = (node, apply) => {
    let f = null;
    node.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (finger) return;
      f = { id: e.pointerId, y: e.clientY };
      try {
        node.setPointerCapture(e.pointerId);
      } catch {}
    });
    node.addEventListener('pointermove', e => {
      if (f?.id !== e.pointerId) return;
      apply(e.clientY - f.y);
      f.y = e.clientY;
      if (tunePanel.style.display === 'flex') syncTune();
      saveTune();
    });
    for (const ev of ['pointerup', 'pointercancel'])
      node.addEventListener(ev, e => {
        if (f?.id === e.pointerId) f = null;
      });
  };
  sidePad(viewPad, dy => {
    tune.pitch = Math.max(30, Math.min(88, tune.pitch - dy * 0.3));
  });
  sidePad(zoomPad, dy => {
    tune.zoom = Math.max(0.5, Math.min(1.5, tune.zoom + dy * 0.004));
  });
  const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));
  function move(e) {
    if (!seated() || (e.type === 'pointermove' && e.pointerType === 'mouse')) return;
    let dx = e.movementX || 0,
      dy = e.movementY || 0;
    if (e.type !== 'mousemove') {
      if (!finger || finger.id !== e.pointerId) return;
      dx = e.clientX - finger.x;
      dy = e.clientY - finger.y;
      finger.x = e.clientX;
      finger.y = e.clientY;
    }
    const t = targets[pair],
      gain = sensitivity.value * (team ? -1 : 1);
    const now = performance.now();
    t.slide = clamp(t.slide + (deadZone('deadSlide', dy, now) * gain * 0.7) / 170, 1);
    t.angle = clamp(t.angle + (deadZone('deadSpin', dx, now) * gain * 0.7 * Math.PI) / 210, MAX_ANGLE);
    dirty = true;
  }
  host.addEventListener('mousemove', e => {
    if (active && mouseLocked()) move(e);
  });
  host.addEventListener('pointerdown', e => {
    if (active && e.pointerType === 'mouse' && !mouseLocked()) lockMouse();
    if (active && e.pointerType !== 'mouse')
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() };
  });
  // telefono: un tocco veloce al centro del tavolo butta (o rimette) la pallina, come Spazio
  function onField(x, y) {
    if (!lastCamera) return false;
    const r = host.getBoundingClientRect(),
      p = new THREE.Vector3();
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const [cx, cz] of [
      [-L, -W],
      [L, -W],
      [-L, W],
      [L, W]
    ]) {
      p.set(TX + cx, TOP, cz).project(lastCamera);
      const sx = r.left + ((p.x + 1) / 2) * r.width,
        sy = r.top + ((1 - p.y) / 2) * r.height;
      ((x0 = Math.min(x0, sx)), (x1 = Math.max(x1, sx)), (y0 = Math.min(y0, sy)), (y1 = Math.max(y1, sy)));
    }
    // la parte centrale del campo (senza le porte)
    const mx = (x1 - x0) * 0.2;
    return x > x0 + mx && x < x1 - mx && y > y0 && y < y1;
  }
  for (const ev of ['pointerup', 'pointercancel'])
    host.addEventListener(ev, e => {
      if (tap?.id !== e.pointerId) return;
      if (
        e.type === 'pointerup' &&
        performance.now() - tap.at < 350 &&
        Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12 &&
        onField(e.clientX, e.clientY)
      )
        serve();
      tap = null;
    });
  function input(e) {
    if (e.type !== 'keydown' || e.repeat) return false;
    if (e.code === 'KeyE') close();
    else if (e.code === 'KeyQ' && seated()) selectPair(1 - pair);
    else if (e.code === 'Digit1' || e.code === 'Digit2') selectPair(Number(e.code.slice(-1)) - 1);
    else if (e.key === '+' || e.key === '-') {
      sensitivity.step(e.key === '+' ? 0.1 : -0.1);
    } else if (e.code === 'Space') serve();
    else return false;
    return true;
  }
  function draw(f, dt) {
    const smooth = 1 - Math.exp(-dt * 30);
    if (!f) {
      ball.visible = false;
      sticks.forEach(s => {
        s.position.z += (0 - s.position.z) * smooth;
        s.rotation.z += (0 - s.rotation.z) * smooth;
      });
      return;
    }
    ball.visible = true;
    let bx = f.ball.x,
      bz = f.ball.z;
    if (netBall) {
      // online: tra un aggiornamento e l'altro la palla continua con la sua velocità
      const e = Math.min(0.033, (performance.now() - netBall.t) / 1000);
      if (f.phase === 'play') {
        bx = netBall.x + netBall.vx * e;
        bz = Math.max(-W + 0.017, Math.min(W - 0.017, netBall.z + netBall.vz * e));
      }
    }
    const k = 1 - Math.exp(-dt * 40);
    ball.position.x += (bx - ball.position.x) * k;
    ball.position.z += (bz - ball.position.z) * k;
    ball.position.y = TOP + 0.007 + R + (Math.abs(bz) <= W ? cornerHeight(bx, bz) : 0);
    sticks.forEach((s, i) => {
      const row = rows[i];
      if (seated() && row.team === team && row.attack === pair) {
        const target = targets[pair];
        const slide = f.tuning?.slide ?? TUNING_LIMITS.slide.initial;
        s.position.z = rodStep(s.position.z, target.slide * row.travel, slide * dt);
        s.rotation.z = rodTurnStep(s.rotation.z, target.angle, dt, f.tuning?.spin);
        return;
      }
      const kk = smooth;
      s.position.z += (f.rods[i].shift - s.position.z) * kk;
      s.rotation.z += (f.rods[i].angle - s.rotation.z) * kk;
    });
    beads.forEach((list, team) =>
      list.forEach((b, n) => {
        const sign = team ? 1 : -1;
        b.position.x = sign * (L - 0.16 + n * 0.0115) + (n < f.score[team] ? -sign * 0.03 : 0);
      })
    );
  }
  function placeCamera(camera) {
    const w = innerWidth,
      h = innerHeight,
      aspect = w / h;
    const vf = THREE.MathUtils.degToRad(camera.fov),
      hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    camera.up.set(0, 1, 0);
    const dir = team === 0 ? 1 : -1;
    const pitch = THREE.MathUtils.degToRad(localSettings.cameraPitch);
    if (touchUI) localSettings.cameraPitch = tune.pitch;
    const d = Math.max(1.2, (L + 0.16) / Math.tan(hf / 2)) * (touchUI ? tune.zoom : 1);
    const focusZ = dir * 0.05;
    camera.position.set(TX, TOP + d * Math.sin(pitch), focusZ + dir * d * Math.cos(pitch));
    camera.lookAt(TX, TOP, focusZ);
  }

  function pose(slot, poseMode, pairIndex) {
    const team = Math.floor(slot / 2),
      pair = rows
        .map((r, i) =>
          r.team === team && r.attack === (poseMode === 4 ? slot % 2 : (pairIndex ?? 1)) ? i : -1
        )
        .filter(i => i >= 0);
    // mani sulle manopole (che sono più o meno fuori secondo la corsa dell'asta)
    const handles = pair.map(
      i =>
        new THREE.Vector3(
          TX + rows[i].x,
          TOP + ROD_H,
          (team ? -1 : 1) * (W + 0.015 + 0.155 + rows[i].travel) + sticks[i].position.z
        )
    );
    const x = (handles[0].x + handles[1].x) / 2;
    return {
      x,
      z: (team ? -1 : 1) * 0.98,
      yaw: team ? Math.PI : 0,
      handles: team ? handles.sort((a, b) => b.x - a.x) : handles.sort((a, b) => a.x - b.x)
    };
  }

  return {
    pose,
    get seat() {
      return seated() ? { station: 'balilla', slot: net.slot, mode: mate() ? 4 : 2, pair } : null;
    },
    get active() {
      return active;
    },
    open(side, pairIndex) {
      active = watching = true;
      team = side;
      for (const state of Object.values(deadState)) state.time = -Infinity;
      if (matchMedia('(any-pointer: fine)').matches || mouseLocked()) lockMouse();
      selectPair(pairIndex);
      exitChip.hidden = !touchUI;
      showTouch(touchUI);
      renderStatus();
      lastWatch = performance.now();
      post('watch');
      join();
    },
    close,
    input,
    move,
    // collegamento della Lobby riaperto: il server non ci conosce più, ci si risiede subito (senza aspettare i 3 s)
    reconnected() {
      if (!watching) return;
      net = null;
      lastWatch = performance.now();
      post('watch');
      if (active) join();
    },
    receive(data) {
      if (!watching) return;
      if (data.sound) {
        playSound?.(data.sound, data.power);
        return;
      }
      if (!data.field) return;
      const wasSeated = seated(),
        old = net?.field;
      if (old && data.field.hit > old.hit) playSound?.(data.field.sound, data.field.power);
      net = data;
      netBall = { ...data.field.ball, t: performance.now() };
      if (!active) return;
      if ((!wasSeated && seated()) || (mate() && pair !== net.slot % 2)) selectPair(pair);
      renderStatus();
    },
    update(camera, dt, nearby) {
      if (!active && !nearby) {
        if (watching) close();
        return;
      }
      const now = performance.now();
      if (!watching || now - lastWatch > 3000) {
        watching = true;
        lastWatch = now;
        post('watch');
        if (active && !seated()) join();
      }
      if (dirty && seated() && now - lastInput >= 1000 / 60) {
        post('input', { pair, ...targets[pair] });
        dirty = false;
        lastInput = now;
      }
      if (active) (placeCamera(camera), (lastCamera = camera));
      draw(net?.field, dt);
    },
    blur() {
      finger = null;
    }
  };
}
