// Calcio balilla della Lobby 3D: il tavolo (italiano a portiere singolo), i comandi e le partite.
// Decisioni in docs/balilla.md: regole ITSF, rullata impossibile, rimessa dal foro laterale, 5/8/10 gol,
// secca o al meglio di 3; contro il computer (si adatta), stesso telefono, 1 contro 1 e 2 contro 2 online.
// Comandi: dito o mouse su e giù sposta le aste, di lato le ruota (uno scatto verso la porta avversaria tira).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { rows, newField, simulate, throwIn, control, nearPair, figureZ, L, W, GOAL, ROD_H, ROD_R, MAX_ANGLE, TARGETS } from './balilla-rules.js?v=94bb99f54f';
import { createAI, loadSkill, saveSkill, adapt, skillName } from './balilla-ai.js?v=5d0eba09ec';

const TX = -13; // posizione del tavolo nella sala giochi
const TOP = 0.733; // piano del campo
const TEAM = ['Rossi', 'Blu'];

export function buildBalilla(scene, el, send, playSound) {
  // ---------- il tavolo ----------
  const table = new THREE.Group();
  table.position.set(TX, 0, 0);
  scene.add(table);
  const material = (color, metalness = 0) => new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.3 : 0.56 });
  const frame = material('#23384a'),
    chrome = material('#bccbd4', 0.82),
    rubber = material('#202228'),
    white = material('#fff1cc'),
    pitch = material('#207b63');
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
  function cylinder(radius, length, m, x, y, z, parent) {
    const c = mesh(new THREE.CylinderGeometry(radius, radius, length, 16), m, x, y, z, parent);
    c.rotation.x = Math.PI / 2;
    return c;
  }
  // misure: campo 120 × 70 cm (L, W), porta 20 cm, aste da 16 mm ogni 15 cm, asse a 8,5 cm dal campo
  const AXIS = TOP + ROD_H,
    RAIL = W + 0.015, // sponda laterale
    END = L + 0.06; // fondo con la porta
  for (const x of [-(L - 0.03), L - 0.03])
    for (const z of [-0.29, 0.29]) {
      box(0.08, 0.59, 0.08, chrome, x, 0.31, z);
      box(0.095, 0.03, 0.095, rubber, x, 0.016, z);
    }
  box(2 * END + 0.04, 0.17, 2 * RAIL + 0.06, frame, 0, 0.645, 0);
  for (const sign of [-1, 1]) {
    box(2 * END, 0.016, 0.013, brass, 0, 0.585, (RAIL + 0.032) * sign);
    for (const x of [-(L - 0.01), L - 0.01]) box(0.1, 0.2, 0.013, chrome, x, 0.675, (RAIL + 0.033) * sign);
  }
  box(2 * L, 0.014, 2 * W, pitch, 0, TOP, 0);
  for (const s of [-1, 1]) {
    const z = s * RAIL;
    box(2 * END + 0.04, 0.16, 0.03, frame, 0, 0.82, z);
    box(2 * END + 0.04, 0.011, 0.034, chrome, 0, 0.895, z);
    // foro laterale di centrocampo da cui entra la palla
    const h = mesh(new THREE.CircleGeometry(0.022, 20), hole, 0, TOP + 0.026, z - s * 0.0155);
    h.rotation.y = s > 0 ? Math.PI : 0;
    mesh(new THREE.TorusGeometry(0.023, 0.003, 8, 24), chrome, 0, TOP + 0.026, z - s * 0.016);
  }
  for (const sign of [-1, 1]) {
    // fondo: due spalle ai lati della porta, porta larga 20 cm con la rete in gomma dietro
    for (const z of [-1, 1]) box(END - L, 0.16, W + 0.03 - GOAL, frame, sign * (L + (END - L) / 2), 0.82, z * (GOAL + (W + 0.03 - GOAL) / 2));
    box(0.018, 0.16, 2 * GOAL, rubber, sign * (END - 0.009), 0.82, 0);
    box(END - L, 0.02, 2 * GOAL, chrome, sign * (L + (END - L) / 2), 0.89, 0);
    box(END - L, 0.004, 2 * GOAL, hole, sign * (L + (END - L) / 2), TOP - 0.002, 0);
    // righe: fondo, area di porta e area grande
    box(2 * L - 0.04, 0.001, 0.003, white, 0, TOP + 0.008, sign * (W - 0.05));
    box(0.003, 0.001, 2 * W - 0.1, white, sign * (L - 0.02), TOP + 0.008, 0);
    for (const z of [-1, 1]) box(0.08, 0.001, 0.003, white, sign * (L - 0.06), TOP + 0.009, z * (GOAL + 0.04));
    box(0.003, 0.001, 2 * (GOAL + 0.04), white, sign * (L - 0.1), TOP + 0.009, 0);
    for (const z of [-1, 1]) box(0.16, 0.001, 0.003, white, sign * (L - 0.1), TOP + 0.009, z * (GOAL + 0.11));
    box(0.003, 0.001, 2 * (GOAL + 0.11), white, sign * (L - 0.18), TOP + 0.009, 0);
    // rialzi negli angoli: la palla non resta ferma nell'angolo
    for (const z of [-1, 1]) {
      const ramp = mesh(new THREE.CylinderGeometry(0.001, 0.05, 0.012, 3, 1), pitch, sign * (L - 0.02), TOP + 0.012, z * (W - 0.02));
      ramp.rotation.y = Math.atan2(-z, -sign) + Math.PI / 6;
    }
  }
  box(0.003, 0.001, 2 * W - 0.1, white, 0, TOP + 0.009, 0);
  mesh(new THREE.RingGeometry(0.076, 0.079, 48), white, 0, TOP + 0.009, 0).rotation.x = -Math.PI / 2;
  // pallottoliere del punteggio sulla sponda dal lato dei rossi: 10 palline per squadra
  const beads = [0, 1].map(team => {
    const sign = team ? 1 : -1,
      list = [];
    for (let n = 0; n < 10; n++) list.push(box(0.01, 0.014, 0.014, kits[team], sign * (L - 0.16 + n * 0.0115), 0.912, RAIL));
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
  const sticks = rows.map(row => {
    const dir = row.team ? -1 : 1,
      group = new THREE.Group();
    table.add(group);
    group.position.set(row.x, AXIS, 0);
    for (const side of [-1, 1]) {
      cylinder(0.02, 0.025, brass, row.x, AXIS, side * (RAIL + 0.017));
      cylinder(0.013, 0.012, rubber, row.x, AXIS, side * (RAIL - 0.021));
    }
    // asta da 16 mm, telescopica: dentro il campo da sponda a sponda, non esce dall'altra parte
    cylinder(ROD_R, 2 * RAIL + 0.13, chrome, 0, 0, dir * 0.065, group);
    cylinder(0.019, 0.105, rubber, 0, 0, dir * 0.49, group);
    for (let n = 0; n < 6; n++) cylinder(0.02, 0.004, sole, 0, 0, dir * (0.45 + n * 0.015), group);
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

  // ---------- pannello ----------
  const ui = document.createElement('section');
  ui.hidden = true;
  ui.className = 'bal-ui';
  const css = document.createElement('style');
  css.textContent = `.bal-ui{position:absolute;top:calc(var(--ui-safe-top,0px) + 56px);left:50%;transform:translateX(-50%);width:max-content;max-width:94%;padding:8px 10px;border-radius:12px;background:#101924e6;color:#fff;text-align:center;font-size:14px;touch-action:none;z-index:3}
.bal-ui .row{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:6px}
.bal-ui .lbl{opacity:.75;font-size:12px;align-self:center}
.bal-ui button{padding:7px 11px!important;font-size:14px!important;width:auto!important;margin:0}
.bal-ui button.on{background:#f0b429!important;color:#231400!important;border-color:#f0b429!important}
.bal-ui .big{font-weight:700;font-size:16px}
.bal-ui small{display:block;opacity:.7;margin-top:6px;font-size:12px}`;
  document.head.append(css);
  el.append(ui);
  const div = (cls, text = '') => {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    return d;
  };
  const button = (parent, title, fn, on = false) => {
    const b = document.createElement('button');
    b.textContent = title;
    b.onclick = fn;
    if (on) b.classList.add('on');
    parent.append(b);
    return b;
  };

  // ---------- stato ----------
  let active = false, // sei al tavolo con il pannello aperto
    watching = false, // sei vicino al tavolo (ricevi la partita online)
    net = null, // ultimo stato del server
    mode = null, // null (menu) · 'ai' · 'same' · 'net'
    local = null, // campo della partita sul telefono
    ai = null,
    skill = loadSkill(),
    lastUI = '',
    lastSend = 0,
    lastInput = '',
    lastWatch = 0,
    lastHit = 0,
    netBall = null;
  const opts = { target: 5, bestOf: 1, online: 2 };
  const pairs = [1, 1];
  const ctl = [0, 1].map(() => ({ slide: 0, angle: 0, held: 0, keyKick: 0, raise: false, up: 0 }));
  const pointers = new Map();
  const post = (action, data = {}) => send?.({ type: 'balilla', action, ...data });
  const mySlot = () => (mode === 'net' ? (net?.slot ?? -1) : 0);
  const myTeam = () => Math.floor(Math.max(0, mySlot()) / 2);
  const field = () => (mode === 'net' ? net?.field : local);
  const playing = () => (mode === 'ai' || mode === 'same' ? !!local : mode === 'net' && mySlot() >= 0);
  const topView = () => mode === 'same';

  // ---------- pannello: menu, partita, fine ----------
  function render() {
    if (!active) return;
    const f = field();
    const key = JSON.stringify([
      mode,
      opts,
      net && [net.slot, net.occupied, net.mode, net.busy, net.playing],
      f && [f.score, f.games, f.phase === 'throw' ? f.thrower : -1, f.phase, f.finished],
      mode === 'ai' && skillName(skill)
    ]);
    if (key === lastUI) return;
    lastUI = key;
    ui.replaceChildren();
    if (!mode) return menu();
    const status = div('big');
    const sc = f ? f.score : [0, 0];
    status.textContent = `${TEAM[0]} ${sc[0]} – ${sc[1]} ${TEAM[1]}`;
    ui.append(status);
    const info = div('');
    const fmt = f ? `a ${f.target} gol` + (f.bestOf === 3 ? ` · partita ${f.gameNo} di 3 (vinte ${f.games[0]}–${f.games[1]})` : '') : '';
    info.textContent = (mode === 'ai' ? `Contro il computer (${skillName(skill)}) · ` : mode === 'same' ? 'Stesso telefono · ' : '') + fmt;
    ui.append(info);
    const row = div('row');
    ui.append(row);
    if (mode === 'net' && mySlot() < 0) {
      // online: posti liberi
      const occ = net?.occupied ?? [],
        m = net?.mode ?? 2;
      const msg = div('', net?.busy ? 'Il tavolo è occupato da una partita sul telefono.' : `Online ${m === 4 ? '2 contro 2' : '1 contro 1'}: scegli un posto`);
      ui.insertBefore(msg, row);
      for (let n = 0; n < 4; n++) {
        if (m === 2 && n % 2) continue;
        const b = button(row, TEAM[n >> 1] + (m === 4 ? (n % 2 ? ' attacco' : ' difesa') : ''), () =>
          post('join', { slot: n, mode: m, target: opts.target, bestOf: opts.bestOf })
        );
        b.disabled = occ.includes(n) || net?.busy;
      }
    } else if (f) {
      const t = myTeam();
      const phase = div('');
      if (f.finished) {
        const w = f.bestOf === 3 ? (f.games[0] > f.games[1] ? 0 : 1) : f.score[0] > f.score[1] ? 0 : 1;
        phase.textContent = mode === 'same' ? `Vincono i ${TEAM[w]}!` : w === t ? 'Hai vinto!' : 'Hai perso';
        button(row, 'Rivincita', again);
      } else if (f.phase === 'throw') {
        const mine = mode === 'same' || f.thrower === t;
        phase.textContent = mine ? `Rimettono i ${TEAM[f.thrower]}: tocca Rimetti (o aspetta)` : `Rimettono i ${TEAM[f.thrower]}…`;
        if (mine && !(mode === 'ai' && f.thrower === 1)) button(row, 'Rimetti', doThrow);
      } else if (f.phase === 'goal') phase.textContent = 'Gol!';
      else if (f.phase === 'over') phase.textContent = `Partita ai ${TEAM[f.games[0] > f.games[1] ? 0 : 1]}… si cambia campo`;
      else if (mode === 'net' && !net?.playing) phase.textContent = 'In attesa degli altri giocatori…';
      ui.insertBefore(phase, row);
    }
    button(row, 'Esci', close);
    const hint = document.createElement('small');
    hint.textContent = topView()
      ? 'Rossi a sinistra, Blu a destra: su e giù sposta, di lato ruota e tira'
      : 'Su e giù sposta le aste · scatto verso la porta avversaria tira · indietro alza le figure';
    ui.append(hint);
  }
  function menu() {
    ui.append(div('big', 'Calcio balilla'));
    const occ = net?.occupied ?? [];
    if (net?.busy) ui.append(div('', 'Il tavolo è occupato da una partita sul telefono.'));
    else if (occ.length) {
      // c'è già una partita online aperta: ci si siede nei posti liberi
      const m = net.mode;
      ui.append(div('', `Partita online ${m === 4 ? '2 contro 2' : '1 contro 1'} · a ${net.field.target} gol${net.field.bestOf === 3 ? ' · al meglio di 3' : ''}`));
      const row = div('row');
      ui.append(row);
      for (let n = 0; n < 4; n++) {
        if (m === 2 && n % 2) continue;
        const b = button(row, TEAM[n >> 1] + (m === 4 ? (n % 2 ? ' attacco' : ' difesa') : ''), () => {
          mode = 'net';
          post('join', { slot: n, mode: m });
        });
        b.disabled = occ.includes(n);
      }
      const r2 = div('row');
      ui.append(r2);
      button(r2, 'Esci', close);
      return;
    }
    const modes = div('row');
    ui.append(modes);
    const pick = (label, v) => button(modes, label, () => { opts.mode = v; lastUI = ''; render(); }, opts.mode === v);
    opts.mode ??= 'ai';
    pick('Contro il computer', 'ai');
    pick('Stesso telefono', 'same');
    pick('Online 1 contro 1', 'net2');
    pick('Online 2 contro 2', 'net4');
    const goals = div('row');
    goals.append(div('lbl', 'Gol'));
    for (const g of TARGETS) button(goals, String(g), () => { opts.target = g; lastUI = ''; render(); }, opts.target === g);
    goals.append(div('lbl', 'Partita'));
    button(goals, 'Secca', () => { opts.bestOf = 1; lastUI = ''; render(); }, opts.bestOf === 1);
    button(goals, 'Al meglio di 3', () => { opts.bestOf = 3; lastUI = ''; render(); }, opts.bestOf === 3);
    ui.append(goals);
    const go = div('row');
    ui.append(go);
    button(go, 'Gioca', start, true);
    button(go, 'Esci', close);
    if (opts.mode === 'ai') ui.append(Object.assign(document.createElement('small'), { textContent: `Il computer si adatta: ora è ${skillName(skill)}` }));
  }
  function start() {
    resetControls();
    if (opts.mode === 'ai' || opts.mode === 'same') {
      mode = opts.mode;
      local = newField({ target: opts.target, bestOf: opts.bestOf });
      ai = mode === 'ai' ? createAI(1, skill) : null;
      lastHit = local.hit;
      post('local', { on: true });
    } else {
      mode = 'net';
      post('join', { slot: 0, mode: opts.mode === 'net4' ? 4 : 2, target: opts.target, bestOf: opts.bestOf });
    }
    lastUI = '';
    render();
  }
  function again() {
    if (mode === 'net') post('again');
    else {
      local = newField({ target: local.target, bestOf: local.bestOf });
      if (ai) ai.skill = skill;
      lastHit = local.hit;
    }
    lastUI = '';
    render();
  }
  function doThrow() {
    if (mode === 'net') post('ready');
    else if (local) throwIn(local);
    render();
  }
  function stopGame() {
    if (mode === 'net') post('leave');
    if (mode === 'ai' || mode === 'same') post('local', { on: false });
    mode = null;
    local = null;
    ai = null;
    resetControls();
  }
  function close() {
    if (!active && !watching) return;
    stopGame();
    watching = active = false;
    ui.hidden = true;
    net = null;
    lastUI = '';
    restoreCamera = true;
  }
  function resetControls() {
    pointers.clear();
    for (const c of ctl) Object.assign(c, { slide: 0, angle: 0, held: 0, keyKick: 0, raise: false, up: 0 });
  }

  // ---------- comandi ----------
  // segni: nella vista dal proprio lato, giù sullo schermo = verso di te; a destra = verso la porta avversaria
  const slideSign = team => (topView() ? 1 : team === 0 ? 1 : -1);
  const angleSign = team => (topView() ? 1 : team === 0 ? 1 : -1);
  const host = el.querySelector('.l3d-gl') || el;
  const teamAt = x => (topView() ? (x < innerWidth / 2 ? 0 : 1) : myTeam());
  host.addEventListener('pointerdown', e => {
    if (!active || !playing()) return;
    if (e.pointerType === 'mouse' && host.requestPointerLock && document.pointerLockElement !== host && !topView()) {
      try {
        host.requestPointerLock();
      } catch {}
    }
    const team = teamAt(e.clientX),
      c = ctl[team];
    try {
      host.setPointerCapture(e.pointerId);
    } catch {}
    pointers.set(e.pointerId, { team, x: e.clientX, y: e.clientY, s0: c.slide, a0: c.angle, mouse: e.pointerType === 'mouse' });
    c.held++;
    // clic del mouse: tiro secco
    if (e.pointerType === 'mouse' && e.button === 0) c.keyKick = 0.09;
    if (e.pointerType === 'mouse' && e.button === 2) c.raise = true;
  });
  function onMove(e) {
    if (!active || !playing()) return;
    const h = Math.max(320, host.clientHeight || innerHeight);
    const p = pointers.get(e.pointerId);
    if (p && !p.mouse) {
      const c = ctl[p.team];
      c.slide = Math.max(-1, Math.min(1, p.s0 + ((e.clientY - p.y) * slideSign(p.team) * 2.4) / (h * 0.6)));
      c.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, p.a0 + (e.clientX - p.x) * angleSign(p.team) * 0.028));
      return;
    }
    // mouse (anche senza tasti): spostamenti relativi
    if (e.pointerType === 'mouse') {
      const team = topView() ? teamAt(e.clientX) : myTeam(),
        c = ctl[team];
      c.slide = Math.max(-1, Math.min(1, c.slide + ((e.movementY || 0) * slideSign(team) * 2.4) / (h * 0.6)));
      c.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, c.angle + (e.movementX || 0) * angleSign(team) * 0.022));
      c.up = 0.12; // la rotazione resta finché muovi il mouse, poi torna giù
    }
  }
  host.addEventListener('pointermove', onMove);
  const lift = e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    const c = ctl[p.team];
    c.held = Math.max(0, c.held - 1);
    if (e.button === 2) c.raise = false;
  };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) host.addEventListener(t, lift);
  host.addEventListener('contextmenu', e => active && e.preventDefault());
  // tastiera: W/S o frecce su e giù spostano, D o → tira, A o ← alza (stesso telefono: blu con le frecce)
  const keys = new Set();
  function input(e) {
    if (!active) return false;
    if (e.target.closest?.('button') && ['Space', 'Enter', 'Tab'].includes(e.code)) return false;
    if (e.code === 'Escape' && e.type === 'keydown') {
      if (document.pointerLockElement === host) document.exitPointerLock?.();
      else close();
      return true;
    }
    if (e.code === 'Space' && e.type === 'keydown' && field()?.phase === 'throw') doThrow();
    if (e.type === 'keydown') keys.add(e.code);
    else keys.delete(e.code);
    return true;
  }
  function keyControl(dt) {
    const sets = topView()
      ? [
          [0, 'KeyW', 'KeyS', 'KeyD', 'KeyA'],
          [1, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
        ]
      : [[myTeam(), ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], ['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']]];
    for (const [team, up, down, kick, raise] of sets) {
      const has = k => (Array.isArray(k) ? k.some(x => keys.has(x)) : keys.has(k));
      const c = ctl[team];
      const v = (has(down) ? 1 : 0) - (has(up) ? 1 : 0);
      if (v) c.slide = Math.max(-1, Math.min(1, c.slide + v * slideSign(team) * dt * 3));
      if (has(kick) && !c.kickHeld) c.keyKick = 0.09;
      c.kickHeld = has(kick);
      c.keyRaise = has(raise);
    }
  }
  // angolo voluto di ogni squadra: dito/mouse, tiro da tasto, alzata
  function wantedAngle(team, dt) {
    const c = ctl[team],
      fwd = team === 0 ? 1 : -1;
    if (c.keyKick > 0) {
      c.keyKick -= dt;
      return fwd * 1.45;
    }
    if (c.raise || c.keyRaise) return -fwd * 1.45;
    if (c.held === 0) {
      if (c.up > 0) c.up -= dt;
      else c.angle *= Math.exp(-9 * dt); // senza mano le figure tornano giù
    }
    return c.angle;
  }

  // ---------- partita sul telefono ----------
  function stepLocal(dt) {
    const f = local;
    if (!f) return;
    keyControl(dt);
    const humans = mode === 'same' ? [0, 1] : [0];
    for (const t of humans) {
      pairs[t] = nearPair(f, t, pairs[t]);
      control(f, t, pairs[t], ctl[t].slide, wantedAngle(t, dt));
    }
    if (ai) {
      ai.step(f, dt);
      // il computer rimette in fretta
      if (f.phase === 'throw' && f.thrower === 1 && f.wait > 1.2) f.wait = 1.2;
    }
    const before = f.score.slice();
    simulate(f, dt);
    if (ai && (f.score[0] !== before[0] || f.score[1] !== before[1])) {
      skill = adapt(skill, f.score[0] > before[0]);
      ai.skill = skill;
      saveSkill(skill);
    }
    if (f.hit !== lastHit) {
      lastHit = f.hit;
      playSound?.(f.sound);
      post('practice-sound', { sound: f.sound });
    }
  }
  function sendNet(dt) {
    if (mode !== 'net' || mySlot() < 0 || !net?.field) return;
    keyControl(dt);
    const t = myTeam(),
      f = net.field;
    if (net.mode !== 4) pairs[t] = nearPair(f, t, pairs[t]);
    const pair = net.mode === 4 ? mySlot() % 2 : pairs[t];
    const data = { slide: Math.round(ctl[t].slide * 100) / 100, angle: Math.round(wantedAngle(t, dt) * 100) / 100, pair };
    const key = JSON.stringify(data),
      now = performance.now();
    if (key !== lastInput && now - lastSend > 33) {
      post('input', data);
      lastInput = key;
      lastSend = now;
    }
  }

  // ---------- disegno ----------
  let restoreCamera = false;
  function draw(f, dt) {
    const smooth = 1 - Math.exp(-dt * 30);
    if (!f) {
      sticks.forEach(s => {
        s.position.z += (0 - s.position.z) * smooth;
        s.rotation.z += (0 - s.rotation.z) * smooth;
      });
      return;
    }
    let bx = f.ball.x,
      bz = f.ball.z;
    if (mode !== 'ai' && mode !== 'same' && netBall) {
      // online: tra un aggiornamento e l'altro la palla continua con la sua velocità
      const e = Math.min(0.08, (performance.now() - netBall.t) / 1000);
      if (f.phase === 'play') {
        bx = netBall.x + netBall.vx * e;
        bz = Math.max(-W + 0.017, Math.min(W - 0.017, netBall.z + netBall.vz * e));
      }
    }
    const k = mode === 'ai' || mode === 'same' ? 1 : 1 - Math.exp(-dt * 40);
    ball.position.x += (bx - ball.position.x) * k;
    ball.position.z += (bz - ball.position.z) * k;
    ball.position.y = Math.abs(bz) > W ? 0.758 : 0.75;
    sticks.forEach((s, i) => {
      const kk = mode === 'ai' || mode === 'same' ? 1 : smooth;
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
    if (topView()) {
      const d = Math.max((L + 0.18) / Math.tan(hf / 2), 0.46 / Math.tan(vf / 2)) + 0.1;
      camera.up.set(0, 0, -1);
      camera.position.set(TX, TOP + d, 0.0001);
      camera.lookAt(TX, TOP, 0);
      return;
    }
    camera.up.set(0, 1, 0);
    const dir = myTeam() === 0 ? 1 : -1,
      p = 0.95;
    const d = Math.max(1.2, (L + 0.16) / Math.tan(hf / 2));
    camera.position.set(TX, TOP + d * Math.sin(p), dir * d * Math.cos(p));
    camera.lookAt(TX, TOP, dir * 0.05);
  }

  function pose(slot, poseMode, pairIndex) {
    const team = Math.floor(slot / 2),
      pair = rows
        .map((r, i) => (r.team === team && r.attack === (poseMode === 4 ? slot % 2 : (pairIndex ?? 1)) ? i : -1))
        .filter(i => i >= 0);
    const handles = pair.map(i => new THREE.Vector3(TX + rows[i].x, 0.818, (team ? -1 : 1) * 0.49 + sticks[i].position.z));
    const x = (handles[0].x + handles[1].x) / 2;
    return {
      x,
      z: (team ? -1 : 1) * 0.77,
      yaw: team ? Math.PI : 0,
      handles: team ? handles.sort((a, b) => b.x - a.x) : handles.sort((a, b) => a.x - b.x)
    };
  }

  return {
    pose,
    get seat() {
      if (!active || !playing()) return null;
      const slot = mySlot(),
        m = mode === 'net' ? (net?.mode ?? 2) : 2;
      return { station: 'balilla', slot, mode: m, pair: m === 4 ? slot % 2 : pairs[myTeam()] };
    },
    get active() {
      return active;
    },
    open() {
      active = true;
      watching = true;
      mode = null;
      local = null;
      ui.hidden = false;
      lastUI = '';
      lastWatch = performance.now();
      post('watch');
      resetControls();
      render();
    },
    close,
    input,
    move() {}, // i movimenti li legge il tavolo stesso (pointermove su .l3d-gl)
    receive(data) {
      if (!active && !watching) return;
      if (data.sound) {
        if (mode !== 'ai' && mode !== 'same') playSound?.(data.sound);
        return;
      }
      const old = net?.field;
      if (data.field?.hit > 0 && old && data.field.hit > old.hit && (mode === 'net' || !mode)) playSound?.(data.field.sound);
      net = data;
      netBall = { ...data.field.ball, t: performance.now() };
      // seduto online da un altro telefono o al cambio campo: la vista segue il posto
      if (active && !mode && data.slot >= 0) mode = 'net';
      render();
    },
    update(camera, dt, nearby) {
      if (!active && !nearby) {
        if (watching) close();
        return;
      }
      if (!active && !watching) {
        watching = true;
        post('watch');
        lastWatch = performance.now();
      }
      const now = performance.now();
      if (now - lastWatch > 3000) {
        post('watch');
        lastWatch = now;
      }
      if (mode === 'ai' || mode === 'same') stepLocal(dt);
      else sendNet(dt);
      if (restoreCamera) {
        camera.up.set(0, 1, 0);
        restoreCamera = false;
      }
      if (active) {
        placeCamera(camera);
        render();
      }
      draw(mode === 'ai' || mode === 'same' ? local : net?.playing || net?.occupied?.length ? net.field : null, dt);
    },
    blur() {
      keys.clear();
      for (const c of ctl) c.held = 0;
      pointers.clear();
    }
  };
}
