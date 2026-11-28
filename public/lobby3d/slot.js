// Slot machine della sala giochi (docs/slot.md): tre Las Vegas classiche, rossa, oro e nera, contro la parete
// «ARCADE». Regole in ../slot-rules.js; il giro lo fa il server (club-wallet.js, messaggio wallet-slot), qui si
// vedono la leva, i rulli che girano e le monete che cadono nel vassoio.
// Modello: blender/slot.blend → models/slot.glb (solo la rossa, davanti verso +z, base sul pavimento: le altre due
// sono copie ricolorate). I pezzi che si muovono hanno l'origine dove girano.
// createSlots(gltf, {sound, audio, pay}) restituisce {root, machines: {rossa, oro, nera}, jackpot(n), update(dt)}.
// Ogni macchina ha i comandi delle macchinette della Lobby (hit, play, reset, update, state, onChange…) più
// pull() (tira la leva), bet(n) (puntata 1 · 2 · 3), result(slot) (il giro arrivato dal server), wallet(w).
import * as THREE from 'three';
import { SYMBOLS, SLOT_BETS, SLOT_MACHINES, PAYS, JACKPOT_START } from '../slot-rules.js?v=7ddf0061c8';

const COLORS = {
  rossa: { paint: '#8c0a10', metal: 0.2, rough: 0.18, sign: ['#4a0408', '#ff3b30'], candle: '#ff2a1a' },
  oro: { paint: '#d39a34', metal: 0.95, rough: 0.25, sign: ['#3a2606', '#ffd04a'], candle: '#ff9a1a' },
  nera: { paint: '#050506', metal: 0.3, rough: 0.12, sign: ['#08080c', '#d8d8e0'], candle: '#ff2a1a' }
};
// da centro a centro (rossa a sinistra guardandole): 10 cm tra una slot e l'altra nella Lobby, dove sono ingrandite
// del 25% (la slot con la leva è larga 0,732; scelta del proprietario: lo stesso spazio che c'è dal muro)
const SPACING = 0.732 + 0.1 / 1.25;
const N = SYMBOLS.length;
const STEP = (Math.PI * 2) / N;
// dove sono le cose in una macchina (metri, davanti +z)
const TRAY = { x: 0.2, z0: 0.21, z1: 0.3, y: 0.687 }; // fondo del vassoio (le monete verso il fondo, che si vedono)
const MOUTH = new THREE.Vector3(0, 0.735, 0.2); // bocca da cui escono le monete
const MAX_IN_TRAY = 50;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw?.(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.flipY = false; // UV di Blender: v = 0 in alto nel disegno
  t.userData.canvas = c;
  return t;
}
function fitFont(g, text, max, size, family = '"Arial Black", Arial, sans-serif') {
  g.font = 'bold ' + size + 'px ' + family;
  while (g.measureText(text).width > max && size > 8) g.font = 'bold ' + --size + 'px ' + family;
}

// ---------- i simboli, disegnati (s = mezza altezza disponibile) ----------
let clownImg = null;
function drawSymbol(g, name, s) {
  g.save();
  g.lineJoin = 'round';
  const circle = (x, y, r, fill, stroke) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = s * 0.05;
      g.stroke();
    }
  };
  const shine = (x, y, r) => {
    g.globalAlpha = 0.45;
    circle(x - r * 0.35, y - r * 0.35, r * 0.28, '#fff');
    g.globalAlpha = 1;
  };
  if (name === 'ciliegia') {
    g.strokeStyle = '#3d5a14';
    g.lineWidth = s * 0.07;
    g.beginPath();
    g.moveTo(-s * 0.42, s * 0.25);
    g.quadraticCurveTo(-s * 0.2, -s * 0.5, s * 0.15, -s * 0.78);
    g.moveTo(s * 0.42, s * 0.3);
    g.quadraticCurveTo(s * 0.3, -s * 0.3, s * 0.15, -s * 0.78);
    g.stroke();
    g.fillStyle = '#3f9a24';
    g.beginPath();
    g.ellipse(s * 0.42, -s * 0.72, s * 0.3, s * 0.13, -0.4, 0, Math.PI * 2);
    g.fill();
    for (const [x, y] of [[-s * 0.42, s * 0.42], [s * 0.42, s * 0.47]]) {
      circle(x, y, s * 0.36, '#d0101e', '#6a0008');
      shine(x, y, s * 0.36);
    }
  } else if (name === 'limone') {
    g.fillStyle = '#ffe23a';
    g.strokeStyle = '#a88a00';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.ellipse(0, 0, s * 0.82, s * 0.6, -0.15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    circle(-s * 0.84, s * 0.12, s * 0.1, '#ffe23a', '#a88a00');
    circle(s * 0.84, -s * 0.12, s * 0.1, '#ffe23a', '#a88a00');
    shine(0, 0, s * 0.7);
  } else if (name === 'arancia') {
    circle(0, s * 0.08, s * 0.72, '#ff8a10', '#a04a00');
    g.fillStyle = '#3f9a24';
    g.beginPath();
    g.ellipse(s * 0.22, -s * 0.7, s * 0.3, s * 0.12, -0.5, 0, Math.PI * 2);
    g.fill();
    circle(0, -s * 0.6, s * 0.07, '#5a3a10');
    shine(0, s * 0.08, s * 0.72);
  } else if (name === 'prugna') {
    g.fillStyle = '#6a1e8a';
    g.strokeStyle = '#2e0a40';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.ellipse(0, s * 0.05, s * 0.6, s * 0.75, 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = '#4a1060';
    g.beginPath();
    g.moveTo(-s * 0.1, -s * 0.6);
    g.quadraticCurveTo(-s * 0.3, 0, -s * 0.05, s * 0.7);
    g.stroke();
    g.strokeStyle = '#5a3a10';
    g.lineWidth = s * 0.07;
    g.beginPath();
    g.moveTo(s * 0.05, -s * 0.68);
    g.lineTo(s * 0.2, -s * 0.92);
    g.stroke();
    shine(s * 0.1, 0, s * 0.6);
  } else if (name === 'anguria') {
    g.beginPath();
    g.arc(0, -s * 0.25, s * 0.95, 0, Math.PI);
    g.closePath();
    g.fillStyle = '#2f8a1c';
    g.fill();
    g.beginPath();
    g.arc(0, -s * 0.25, s * 0.82, 0, Math.PI);
    g.closePath();
    g.fillStyle = '#f2f5d0';
    g.fill();
    g.beginPath();
    g.arc(0, -s * 0.25, s * 0.74, 0, Math.PI);
    g.closePath();
    g.fillStyle = '#ff3048';
    g.fill();
    g.fillStyle = '#1a0a0a';
    for (const [x, y] of [[-0.4, 0.05], [0, 0.15], [0.4, 0.05], [-0.2, 0.28], [0.2, 0.28]]) {
      g.beginPath();
      g.ellipse(x * s, y * s, s * 0.05, s * 0.09, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (name === 'bar' || name === 'barbar') {
    const plates = name === 'bar' ? [0] : [-0.42, 0.42],
      h = name === 'bar' ? 0.62 : 0.5;
    for (const y of plates) {
      g.fillStyle = '#111';
      g.strokeStyle = '#f2c14a';
      g.lineWidth = s * 0.06;
      g.beginPath();
      g.roundRect(-s * 1.05, y * s - (h * s) / 2, s * 2.1, h * s, s * 0.12);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitFont(g, 'BAR', s * 1.7, Math.round(h * s * 0.85));
      g.fillText('BAR', 0, y * s + s * 0.03);
    }
  } else if (name === 'sette') {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold ' + Math.round(s * 2) + 'px "Arial Black", Arial, sans-serif';
    g.lineWidth = s * 0.16;
    g.strokeStyle = '#f2c14a';
    g.strokeText('7', 0, s * 0.08);
    g.fillStyle = '#d8101c';
    g.fillText('7', 0, s * 0.08);
  } else if (name === 'btn') {
    const r = s * 0.85;
    circle(0, 0, r, '#f2c14a', '#9a6a10');
    g.strokeStyle = '#c8901c';
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#8a5a08';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold ' + Math.round(r * 1.15) + 'px "Arial Black", Arial, sans-serif';
    // la B con tre aste che escono sopra e sotto (il simbolo del Binottocoin)
    for (const dx of [-0.22, 0, 0.22]) g.fillRect(dx * r - r * 0.05, -r * 0.7, r * 0.1, r * 1.4);
    g.fillText('B', 0, r * 0.05);
  } else if (name === 'pagliaccio') {
    const r = s * 0.9;
    circle(0, 0, r, '#ffd04a', '#a06a00');
    g.save();
    g.beginPath();
    g.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    g.clip();
    if (clownImg?.complete && clownImg.naturalWidth) {
      const k = (r * 1.72) / Math.min(clownImg.naturalWidth, clownImg.naturalHeight);
      g.drawImage(clownImg, (-clownImg.naturalWidth * k) / 2, (-clownImg.naturalHeight * k) / 2, clownImg.naturalWidth * k, clownImg.naturalHeight * k);
    } else {
      // finché l'icona non è arrivata: una faccia da pagliaccio
      circle(0, 0, r, '#fff3e0');
      circle(0, r * 0.1, r * 0.2, '#e8101c');
      circle(-r * 0.35, -r * 0.25, r * 0.1, '#222');
      circle(r * 0.35, -r * 0.25, r * 0.1, '#222');
    }
    g.restore();
  }
  g.restore();
}

// la striscia dei rulli: un simbolo ogni 36°, il simbolo i al centro della finestra quando il rullo è girato di
// i·36°. Nel glTF v è capovolta (v = 0 in cima al disegno = in basso sul rullo… girata): sul rullo l'alto del
// disegno sta in alto, e il simbolo i sta a (N - i) celle dall'inizio del disegno.
function reelTexture() {
  const W = 320,
    H = 2048,
    cell = H / N;
  return canvasTexture(W, H, (g) => {
    g.fillStyle = '#f6f0de';
    g.fillRect(0, 0, W, H);
    for (let k = 0; k < N; k++) {
      const i = (N - k) % N;
      for (const y of k === 0 ? [0, H] : [k * cell]) {
        g.save();
        g.translate(W / 2, y);
        drawSymbol(g, SYMBOLS[i], cell * 0.4);
        g.restore();
      }
      // riga sottile tra un simbolo e l'altro
      g.fillStyle = 'rgba(120,100,70,.25)';
      g.fillRect(0, (k + 0.5) * cell - 1, W, 2);
    }
  });
}

// ---------- suoni: sintetizzati come una slot meccanica (cricchetto, scatti dei rulli, colpi, campanello) ----------
// Se un giorno arrivano registrazioni vere, basta che sound(name) le suoni e restituisca true.
function slotSounds(audio) {
  let noiseBuf = null;
  const noise = ac => {
    if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  };
  const click = (ac, out, at, freq, q, decay, level) => {
    const src = ac.createBufferSource(),
      bp = ac.createBiquadFilter(),
      g = ac.createGain();
    src.buffer = noise(ac);
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    g.gain.setValueAtTime(Math.max(0.0002, level), at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(bp).connect(g).connect(out);
    src.start(at, Math.random() * 0.3);
    src.stop(at + decay + 0.02);
  };
  const tone = (ac, out, at, hz, decay, level, type = 'sine', drop = 1) => {
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, at);
    if (drop !== 1) o.frequency.exponentialRampToValueAtTime(hz * drop, at + decay);
    g.gain.setValueAtTime(Math.max(0.0002, level), at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + decay + 0.02);
  };
  let whir = null;
  return {
    play(name, level = 1) {
      const ac = audio();
      if (!ac) return;
      const out = ac.destination,
        t = ac.currentTime;
      if (name === 'leva') {
        // il cricchetto della leva che scende, poi il colpo in fondo e la molla che la riporta su
        for (let i = 0; i < 9; i++) click(ac, out, t + i * 0.034 + Math.random() * 0.006, 2600 + Math.random() * 600, 9, 0.025, 0.16 * level);
        click(ac, out, t + 0.33, 700, 2, 0.12, 0.4 * level);
        tone(ac, out, t + 0.33, 95, 0.16, 0.35 * level, 'sine', 0.6);
        for (let i = 0; i < 5; i++) click(ac, out, t + 0.5 + i * 0.05, 2000, 8, 0.02, 0.07 * level);
      } else if (name === 'scatto') {
        // un simbolo che passa: il dente del rullo sulla molla
        click(ac, out, t, 3200 + Math.random() * 800, 12, 0.012, 0.05 * level);
      } else if (name === 'stop') {
        // il rullo che si ferma: colpo sordo e metallico
        click(ac, out, t, 1400, 3, 0.07, 0.35 * level);
        click(ac, out, t + 0.004, 4200, 10, 0.03, 0.12 * level);
        tone(ac, out, t, 130, 0.12, 0.3 * level, 'sine', 0.7);
      } else if (name === 'campanello') {
        // campana d'ottone a parziali non armoniche, battuta dal martelletto
        const f = 1180;
        for (const [k, l, d] of [[1, 0.24, 1.1], [2.76, 0.1, 0.7], [5.4, 0.05, 0.4], [8.93, 0.025, 0.25]]) tone(ac, out, t, f * k, d, l * level);
        click(ac, out, t, 5000, 6, 0.015, 0.1 * level);
      } else if (name === 'suspense') {
        tone(ac, out, t, 220, 0.5, 0.06 * level, 'triangle', 1.5);
      }
    },
    // il ronzio dei rulli che girano (fermo quando nessun rullo gira)
    whir(on) {
      const ac = audio();
      if (on && ac && !whir) {
        const src = ac.createBufferSource(),
          bp = ac.createBiquadFilter(),
          g = ac.createGain();
        src.buffer = noise(ac);
        src.loop = true;
        bp.type = 'bandpass';
        bp.frequency.value = 380;
        bp.Q.value = 1.4;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.25);
        src.connect(bp).connect(g).connect(ac.destination);
        src.start();
        whir = { src, g, ac };
      } else if (!on && whir) {
        const w = whir;
        whir = null;
        try {
          w.g.gain.setTargetAtTime(0.0001, w.ac.currentTime, 0.06);
          w.src.stop(w.ac.currentTime + 0.3);
        } catch {}
      }
    }
  };
}

const ease = t => t * t * (3 - 2 * t);
const encode = s => s.bet + ':' + s.r.map(x => SYMBOLS.indexOf(x)).join(',') + ':' + (s.gettoni | 0) + ':' + (s.btn | 0);
function decode(k) {
  const [b, r, g, j] = String(k || '').split(':');
  const reels = (r || '').split(',').map(Number);
  if (reels.length !== 3 || reels.some(i => !(i >= 0 && i < N))) return null;
  return { bet: Number(b) || 1, r: reels.map(i => SYMBOLS[i]), gettoni: Number(g) || 0, btn: Number(j) || 0 };
}
const COMBO_TEXT = { jackpot: 'JACKPOT!', btn: 'TRE BTN!', sette: 'TRIS DI 7!', bar: 'BAR!', barbar: 'DOPPIO BAR!', ciliegia: 'CILIEGIE!' };

export function createSlots(gltf, { sound = () => {}, audio = () => null, pay = () => false } = {}) {
  const root = new THREE.Group();
  const reelTex = reelTexture();
  const reelMat = new THREE.MeshStandardMaterial({ map: reelTex, emissiveMap: reelTex, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.55 });
  const redrawReels = () => {
    const c = reelTex.userData.canvas,
      fresh = reelTexture();
    c.getContext('2d').drawImage(fresh.userData.canvas, 0, 0);
    fresh.dispose();
    reelTex.needsUpdate = true;
  };
  if (!clownImg) {
    clownImg = new Image();
    clownImg.src = new URL('corsa-competizione.jpg', import.meta.url).href;
  }
  const redrawAll = () => {
    redrawReels();
    for (const m of Object.values(machines)) m.sign();
  };
  clownImg.complete ? setTimeout(redrawAll) : clownImg.addEventListener('load', redrawAll, { once: true });
  const coinMat = new THREE.MeshStandardMaterial({ color: '#d8a64a', metalness: 1, roughness: 0.3 });
  const coinGeo = new THREE.CylinderGeometry(0.0175, 0.0175, 0.003, 20);
  // moneta BTN del jackpot: d'oro, un po' più grande
  const btnMat = new THREE.MeshStandardMaterial({ color: '#f2c14a', metalness: 1, roughness: 0.22 });
  const btnGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.0035, 24);
  let jackpot = JACKPOT_START;

  const machines = {};
  const template = gltf.scene.getObjectByName('slot_rossa') || gltf.scene;
  SLOT_MACHINES.forEach((name, idx) => {
    const m = makeMachine(name, template.clone(true));
    m.root.position.x = (idx - 1) * SPACING;
    root.add(m.root);
    machines[name] = m;
  });

  function makeMachine(name, group) {
    const look = COLORS[name];
    const sfx = slotSounds(audio); // ogni macchina il suo ronzio dei rulli
    group.position.set(0, 0, 0);
    // materiali propri (le copie li dividerebbero) e colori della macchina
    const parts = {};
    group.traverse(o => {
      const base = o.name.replace(/_rossa$/, '');
      if (o !== group && !parts[base]) parts[base] = o;
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      const fix = mat => {
        const m = mat.clone();
        const n = mat.name.replace(/_rossa$/, '');
        if (n === 'vernice') {
          m.color.set(look.paint);
          m.metalness = look.metal;
          m.roughness = look.rough;
        } else if (n === 'rullo') return reelMat;
        else if (n === 'candela') {
          m.color.set(look.candle);
          m.emissive.set(look.candle);
        }
        m.name = n;
        return m;
      };
      o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    });
    const mats = n => {
      const out = [];
      group.traverse(o => o.isMesh && (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.name === n && out.push(m)));
      return out;
    };
    const bulbs = [mats('lampadina_a'), mats('lampadina_b')];
    bulbs.flat().forEach(m => {
      m.emissive.set('#ffc860');
      m.toneMapped = false;
    });
    const candle = mats('candela');
    candle.forEach(m => (m.toneMapped = false));

    // facce da stampare
    const setFace = (obj, tex, basic = false, glow = 0.5) =>
      obj?.traverse(o => {
        if (o.isMesh) o.material = basic ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.4 });
      });
    const signTex = canvasTexture(768, 316);
    function drawSign() {
      const g = signTex.userData.canvas.getContext('2d'),
        W = 768,
        H = 316;
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, look.sign[0]);
      bg.addColorStop(1, '#000');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = look.sign[1];
      fitFont(g, 'BINOTTO SLOT', W - 60, 92);
      g.lineWidth = 8;
      g.strokeStyle = '#000';
      g.strokeText('BINOTTO SLOT', W / 2, 88);
      g.fillText('BINOTTO SLOT', W / 2, 88);
      g.fillStyle = '#ffd04a';
      fitFont(g, 'JACKPOT', W - 60, 46);
      g.fillText('JACKPOT', W / 2, 172);
      g.fillStyle = '#fff6d0';
      fitFont(g, jackpot + ' BTN', W - 200, 96);
      g.fillText(jackpot + ' BTN', W / 2, 250);
      g.save();
      g.translate(96, 250);
      drawSymbol(g, 'pagliaccio', 52);
      g.restore();
      g.save();
      g.translate(W - 96, 250);
      drawSymbol(g, 'btn', 52);
      g.restore();
      signTex.needsUpdate = true;
    }
    drawSign();
    setFace(parts.insegna, signTex, false, 0.75);

    const screenTex = canvasTexture(640, 100);
    let shown = '';
    function show(line1, line2) {
      if (shown === line1 + '|' + line2) return;
      shown = line1 + '|' + line2;
      const g = screenTex.userData.canvas.getContext('2d');
      g.fillStyle = '#060406';
      g.fillRect(0, 0, 640, 100);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ff5a2a';
      fitFont(g, line1, 600, 46, '"Courier New", monospace');
      g.fillText(line1, 320, 32);
      g.fillStyle = '#7dffa0';
      fitFont(g, line2, 600, 30, '"Courier New", monospace');
      g.fillText(line2, 320, 76);
      screenTex.needsUpdate = true;
    }
    setFace(parts.display, screenTex, true);

    // tabella delle vincite sulla pancia (per 1 gettone, si moltiplica per la puntata)
    const payTex = canvasTexture(768, 276, (g, W, H) => {
      g.fillStyle = '#120a04';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#f2c14a';
      g.lineWidth = 5;
      g.strokeRect(5, 5, W - 10, H - 10);
      g.fillStyle = '#f2c14a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      fitFont(g, 'VINCITE PER 1 GETTONE · × LA PUNTATA', W - 40, 22, 'Arial, sans-serif');
      g.fillText('VINCITE PER 1 GETTONE · × LA PUNTATA', W / 2, 24);
      const rows = [
        [['pagliaccio', 'pagliaccio', 'pagliaccio'], 'JACKPOT'],
        [['btn', 'btn', 'btn'], PAYS.btn],
        [['sette', 'sette', 'sette'], PAYS.sette],
        [['barbar', 'barbar', 'barbar'], PAYS.barbar],
        [['bar', 'bar', 'bar'], PAYS.bar],
        [['bar', 'barbar', 'bar'], PAYS.barMisti],
        [['anguria', 'anguria', 'anguria'], PAYS.anguria],
        [['prugna', 'prugna', 'prugna'], PAYS.prugna],
        [['arancia', 'arancia', 'arancia'], PAYS.arancia],
        [['limone', 'limone', 'limone'], PAYS.limone],
        [['ciliegia', 'ciliegia', 'ciliegia'], PAYS.ciliegia3],
        [['ciliegia', 'ciliegia'], PAYS.ciliegia2],
        [['ciliegia'], PAYS.ciliegia1]
      ];
      rows.forEach(([syms, pay], i) => {
        const col = i < 7 ? 0 : 1,
          row = i < 7 ? i : i - 7,
          x = 30 + col * 384,
          y = 58 + row * 32;
        syms.forEach((s, k) => {
          g.save();
          g.translate(x + 18 + k * 40, y);
          drawSymbol(g, s, 13);
          g.restore();
        });
        g.fillStyle = pay === 'JACKPOT' ? '#ffd04a' : '#fff6d0';
        g.textAlign = 'right';
        g.font = 'bold 24px "Arial Black", Arial, sans-serif';
        g.fillText(String(pay), x + 330, y + 1);
      });
    });
    setFace(parts.pannello, payTex, false, 0.6);

    // pannello basso del mobile: 7 grande, il pagliaccio e le stelle
    const lowTex = canvasTexture(384, 492, (g, W, H) => {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, look.sign[0]);
      bg.addColorStop(1, '#000');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#f2c14a';
      for (let i = 0; i < 26; i++) {
        const x = (i * 97) % W,
          y = (i * 173) % H;
        g.globalAlpha = 0.25 + ((i * 7) % 10) / 20;
        g.fillRect(x, y, 4, 4);
      }
      g.globalAlpha = 1;
      g.save();
      g.translate(W / 2, 150);
      drawSymbol(g, 'sette', 110);
      g.restore();
      g.save();
      g.translate(W / 2, 360);
      drawSymbol(g, 'pagliaccio', 80);
      g.restore();
      g.fillStyle = look.sign[1];
      g.textAlign = 'center';
      fitFont(g, 'LAS VEGAS · BINOTTOLAND', W - 30, 26);
      g.fillText('LAS VEGAS · BINOTTOLAND', W / 2, H - 26);
    });
    setFace(parts.pannello_basso, lowTex, false, 0.3);

    const reels = [1, 2, 3].map(i => parts['rullo_' + i]).filter(Boolean);
    const lever = parts.leva;
    // si parte con simboli diversi, così le tre non sono uguali
    reels.forEach((r, i) => {
      r.userData.theta = STEP * ((idxOf(name) * 3 + i * 4) % N);
      r.rotation.x = r.userData.theta;
    });

    const tray = new THREE.Group();
    group.add(tray);
    const noRay = o => o.traverse(x => (x.raycast = () => {}));
    for (const r of reels) noRay(r);
    group.traverse(o => o.name.startsWith('vetro') && noRay(o));

    let state = 'scegli',
      bet = 1,
      wallet = null,
      spin = null,
      clock = 0;
    const listeners = [];
    const emit = (st, key = null) => listeners.forEach(fn => fn({ state: st, key }));
    const idle = () => show('TIRA LA LEVA', 'PUNTATA ' + bet + (wallet && Number.isInteger(wallet.btn) ? ' · GETTONI ' + wallet.gettoni : ''));
    idle();

    // un giro: own = tiri tu (aspetta il risultato dal server), altrimenti il risultato c'è già
    function start(result) {
      state = 'gira';
      const t0 = clock;
      spin = {
        t: 0,
        result,
        known: result ? 0 : null,
        paid: null,
        reels: reels.map((r, i) => ({
          r,
          phase: 'attesa',
          start: 0.08 + i * 0.05 + Math.random() * 0.04,
          from: r.userData.theta,
          w: 14.5 + i * 1.3 + (Math.random() - 0.5) * 1.6, // ognuno la sua velocità: girano sfasati
          v: 0,
          stopAt: 1.25 + i * 0.6,
          tick: Math.floor(r.userData.theta / STEP)
        })),
        lever: 0,
        end: 0,
        coins: [],
        out: 0,
        next: 0,
        t0
      };
      if (result) planStops();
      sfx.play('leva');
      show('BUONA FORTUNA!', 'PUNTATA ' + (result?.bet || bet));
    }
    function planStops() {
      const s = spin,
        r = s.result.r;
      s.reels.forEach((x, i) => (x.stopAt = Math.max(x.stopAt, (s.known || 0) + 0.3 + i * 0.6)));
      // vincita in vista (primi due uguali): il terzo gira più a lungo, fino a circa 6 secondi
      if (r[0] === r[1]) s.reels[2].stopAt = Math.max(s.reels[2].stopAt, 4.6);
      s.suspense = r[0] === r[1];
    }
    function pull() {
      if (state !== 'scegli') return false;
      swingLever();
      if (!pay(bet, name)) {
        shown = '';
        show('INSERT COIN', wallet && Number.isInteger(wallet.btn) ? 'servono ' + bet + ' gettoni' : 'saldo in arrivo…');
        sound('errore');
        return false;
      }
      start(null); // le monete già nel vassoio restano: si accumulano
      emit('gira');
      return true;
    }
    let leverT = 9;
    const swingLever = () => (leverT = 0);
    function result(slot) {
      if (!spin || spin.result) return false;
      spin.result = { bet: slot.bet, r: slot.r, gettoni: slot.gettoni | 0, btn: slot.btn | 0, combo: slot.combo };
      spin.known = spin.t;
      planStops();
      emit('risultato', encode(spin.result));
      return true;
    }
    function play(k) {
      const res = decode(k);
      if (!res) return false;
      if (state !== 'scegli') reset();
      swingLever();
      start(res);
      return true;
    }
    function clearTray() {
      for (const c of [...tray.children]) c.removeFromParent();
    }
    function reset() {
      if (!spin && state === 'scegli') return;
      if (spin) {
        // fermo subito sul risultato (o dov'è)
        spin.reels.forEach((x, i) => {
          if (spin.result) x.r.userData.theta = STEP * SYMBOLS.indexOf(spin.result.r[i]);
          x.r.rotation.x = x.r.userData.theta;
        });
        spin.coins.forEach(c => c.obj.removeFromParent());
      }
      spin = null;
      sfx.whir(false);
      state = 'scegli';
      shown = '';
      idle();
      filled = '';
      fill(mine);
    }
    // il vassoio fa vedere quello che c'è dentro per te ({gettoni, btn}); rifatto solo quando cambia
    let mine = null,
      filled = '',
      lifting = [];
    function fill(t) {
      mine = t || null;
      const g = Math.min(MAX_IN_TRAY, t?.gettoni | 0),
        b = Math.min(20, t?.btn | 0),
        key = g + ':' + b;
      if (state !== 'scegli' || key === filled) return;
      filled = key;
      clearTray();
      for (let i = 0; i < g + b; i++) {
        const c = new THREE.Mesh(i < b ? btnGeo : coinGeo, i < b ? btnMat : coinMat);
        c.position.set((Math.random() - 0.5) * 2 * TRAY.x, TRAY.y + Math.floor(i / 14) * 0.003, TRAY.z0 + Math.random() * (TRAY.z1 - TRAY.z0));
        c.rotation.y = Math.random() * 6;
        tray.add(c);
      }
    }
    // prendi: tutto sale verso di te e sparisce
    function collect() {
      for (const o of tray.children) lifting.push({ obj: o, t: -Math.random() * 0.3, from: o.position.clone() });
      filled = '0:0';
      mine = null;
    }
    function dropCoin(isBtn = false) {
      if (tray.children.length >= MAX_IN_TRAY) tray.remove(tray.children[0]);
      const c = new THREE.Mesh(isBtn ? btnGeo : coinGeo, isBtn ? btnMat : coinMat);
      c.position.copy(MOUTH);
      c.position.x += (Math.random() - 0.5) * 0.12;
      tray.add(c);
      const x = Math.max(-TRAY.x, Math.min(TRAY.x, c.position.x * 1.6 + (Math.random() - 0.5) * 0.08)),
        z = TRAY.z0 + Math.random() * (TRAY.z1 - TRAY.z0);
      const under = tray.children.filter(o => o !== c && Math.hypot(o.position.x - x, o.position.z - z) < 0.03).length;
      spin.coins.push({ obj: c, t: 0, from: c.position.clone(), to: new THREE.Vector3(x, TRAY.y + Math.min(under, 8) * 0.003, z), spin: new THREE.Euler(Math.random() * 3, 0, Math.random() * 3), yaw: Math.random() * 6 });
    }

    function update(dt) {
      clock += dt;
      // leva: giù col cricchetto (0,35 s), poi torna su con la molla
      if (lever) {
        leverT += dt;
        const a = leverT < 0.35 ? ease(leverT / 0.35) : leverT < 0.85 ? 1 - ease((leverT - 0.35) / 0.5) : 0;
        lever.rotation.x = a * 1.0;
      }
      // lampadine a turno: più svelte mentre gira, tutte accese alla vincita
      const win = spin?.end && (spin.result?.gettoni || spin.result?.btn);
      const fast = state === 'gira' ? 8 : 2.2,
        on = Math.floor(clock * fast) % 2;
      bulbs[0].forEach(m => (m.emissiveIntensity = win ? 2.4 : on ? 2.2 : 0.25));
      bulbs[1].forEach(m => (m.emissiveIntensity = win ? (on ? 2.4 : 0.4) : on ? 0.25 : 2.2));
      const big = spin?.end && spin.result?.btn;
      candle.forEach(m => (m.emissiveIntensity = big ? (Math.floor(clock * 6) % 2 ? 4 : 0.3) : win ? 2.5 : 1.2));
      liftUpdate(dt);
      if (!spin) return;
      const s = spin;
      s.t += dt;
      let spinning = false;
      s.reels.forEach((x, i) => {
        const r = x.r;
        let th = r.userData.theta;
        if (x.phase === 'attesa' && s.t >= x.start) {
          x.phase = 'indietro';
          x.p0 = s.t;
          x.from = th;
        }
        if (x.phase === 'indietro') {
          // quando scende la leva i rulli vanno un po' indietro, come nelle slot vere
          const u = Math.min(1, (s.t - x.p0) / 0.22);
          th = x.from - 0.2 * Math.sin(u * Math.PI * 0.5);
          if (u >= 1) {
            x.phase = 'gira';
            x.p0 = s.t;
          }
        } else if (x.phase === 'gira') {
          x.v = Math.min(x.w, x.v + dt * x.w * 4);
          th += x.v * dt;
          spinning = true;
          // dopo stopAt si aspetta il punto giusto del giro e si frena in T secondi senza scatti di velocità
          if (s.result && s.t >= x.stopAt && x.v >= x.w) {
            if (x.brakeAt == null) {
              x.T = i === 2 && s.suspense ? 1.6 : 1.0;
              const target = STEP * SYMBOLS.indexOf(s.result.r[i]),
                d = (x.v * x.T) / 3;
              x.brakeAt = target - d + Math.ceil((th - (target - d)) / (Math.PI * 2)) * Math.PI * 2;
              x.to = x.brakeAt + d;
            }
            if (th >= x.brakeAt) {
              x.phase = 'frena';
              x.p0 = s.t;
              x.from = th = x.brakeAt;
              if (i === 2 && s.suspense) sfx.play('suspense');
            }
          }
        } else if (x.phase === 'frena') {
          const u = Math.min(1, (s.t - x.p0) / x.T);
          th = x.from + (x.to - x.from) * (1 - Math.pow(1 - u, 3));
          spinning = true;
          if (u >= 1) {
            x.phase = 'rimbalzo';
            x.p0 = s.t;
            th = x.to;
            sfx.play('stop');
          }
        } else if (x.phase === 'rimbalzo') {
          const u = Math.min(1, (s.t - x.p0) / 0.16);
          th = x.to - 0.05 * Math.sin(u * Math.PI);
          if (u >= 1) {
            x.phase = 'fermo';
            th = x.to % (Math.PI * 2);
          }
        }
        // ogni simbolo che passa: uno scatto (solo quando è veloce, per non fare troppo rumore)
        const tk = Math.floor(th / STEP);
        if (tk !== x.tick && x.phase !== 'rimbalzo' && x.phase !== 'fermo') {
          if (Math.random() < 0.5) sfx.play('scatto');
          x.tick = tk;
        }
        r.userData.theta = th;
        r.rotation.x = th;
      });
      sfx.whir(spinning);
      // giro lungo senza risposta dal server (collegamento lento): si aspetta, poi si ferma dov'è
      if (!s.result && s.t > 15) {
        reset();
        show('COLLEGAMENTO…', 'il giro arriva col saldo');
        return;
      }
      if (!s.reels.every(x => x.phase === 'fermo')) return;
      // pagamento: monete nel vassoio, campanello per le vincite grosse
      const res = s.result,
        total = res.gettoni;
      if (!s.end) {
        s.end = s.t;
        s.next = 0.25;
        if (res.btn) {
          show('JACKPOT!', '+' + res.btn + ' BTN');
          s.bells = 14;
        } else if (total) {
          show(COMBO_TEXT[res.combo] || 'VINCITA!', 'VINCITA ' + total + ' GETTONI');
          s.bells = total >= 10 * res.bet ? 4 : 0;
        } else show('RITENTA', 'PUNTATA ' + res.bet);
        s.bellT = 0;
        emit('fermo');
      }
      if (s.bells > 0) {
        s.bellT -= dt;
        if (s.bellT <= 0) {
          sfx.play('campanello');
          s.bells--;
          s.bellT = 0.16;
        }
      }
      // prima le monete BTN del jackpot, poi i gettoni: cadono e si accumulano nel vassoio
      const btnCoins = Math.min(res.btn, 20),
        shownCoins = Math.min(total, 60) + btnCoins;
      if (s.out < shownCoins) {
        s.next -= dt;
        while (s.next <= 0 && s.out < shownCoins) {
          dropCoin(s.out < btnCoins);
          s.out++;
          s.next += total > 20 ? 0.06 : 0.12;
          if (!res.btn) show(COMBO_TEXT[res.combo] || 'VINCITA!', 'NEL VASSOIO ' + Math.round((total * s.out) / shownCoins) + ' / ' + total);
        }
      }
      for (const c of s.coins) {
        c.t += dt;
        const t = Math.min(1, c.t / 0.25);
        c.obj.position.lerpVectors(c.from, c.to, t);
        c.obj.position.y = c.from.y + (c.to.y - c.from.y) * t * t;
        c.obj.rotation.set(c.spin.x * (1 - t), c.yaw * t, c.spin.z * (1 - t));
        if (t >= 1 && !c.done) {
          c.done = true;
          sound('gettone');
        }
      }
      s.coins = s.coins.filter(c => !c.done);
      if (s.out >= shownCoins && !s.coins.length && s.t - s.end > (res.btn ? 4 : total ? 2 : 1)) {
        spin = null;
        state = 'scegli';
        shown = '';
        idle();
        filled = ''; // il vassoio torna a quello che c'è davvero per te
        fill(mine);
        emit('scegli');
      }
    }
    // monete prese: salgono verso di te e spariscono (anche a macchina ferma)
    function liftUpdate(dt) {
      for (const l of lifting) {
        l.t += dt;
        const t = Math.max(0, Math.min(1, l.t / 0.35));
        l.obj.position.set(l.from.x * (1 - t), l.from.y + 0.3 * ease(t), l.from.z + 0.4 * ease(t));
        if (t >= 1 && !l.done) {
          l.done = true;
          l.obj.removeFromParent();
          if (Math.random() < 0.3) sound('gettone');
        }
      }
      lifting = lifting.filter(l => !l.done);
    }

    function hit(obj) {
      // la leva (o il pomello) fa girare; un tocco sul vassoio prende le monete; il resto della macchina no
      for (let o = obj; o; o = o.parent) {
        if (o === lever) return state === 'scegli' ? pull() : null;
        if (o === tray) return { type: 'tray' };
      }
      return null;
    }
    return {
      root: group,
      hit,
      pull,
      play,
      reset,
      update,
      result,
      bet: n => {
        if (SLOT_BETS.includes(n)) bet = n;
        if (state === 'scegli') idle();
        return bet;
      },
      betNow: () => bet,
      typing: () => {},
      take: () => null,
      ready: () => null,
      typed: () => '',
      state: () => state,
      spinning: () => !!spin,
      waiting: () => !!spin && !spin.result,
      fill,
      collect,
      wallet: w => {
        wallet = w;
        if (state === 'scegli') idle();
      },
      sign: drawSign,
      onChange: fn => listeners.push(fn)
    };
  }

  return {
    root,
    machines,
    jackpot(n) {
      if (!Number.isInteger(n) || n === jackpot) return;
      jackpot = n;
      for (const m of Object.values(machines)) m.sign();
    },
    update(dt) {
      for (const m of Object.values(machines)) m.update(dt);
    }
  };
}
function idxOf(name) {
  return Math.max(0, SLOT_MACHINES.indexOf(name));
}
