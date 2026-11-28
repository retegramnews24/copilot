// Macchinetta cambia-gettoni della Lobby 3D (docs/gettoni.md): sul mobile della radio, cromata e arancio da sala
// giochi. Si sceglie quanti BTN cambiare (1, 5 o 10), la moneta BTN entra nella fessura e i gettoni (5 per BTN)
// cadono uno alla volta nella vaschetta. Modello: blender/gettoni.blend → models/gettoni.glb (davanti verso +z, base
// sul piano del mobile, larga 35 cm). I pezzi che si muovono arrivano già al loro posto.
// createCoinChanger(gltf, {sound, pay}) restituisce la macchinetta (root) e i comandi:
//   hit(object)  → tocco su un tasto: paga con pay(BTN) (false = saldo che non basta) e fa il cambio
//   play(k)      → fa vedere il cambio di k BTN (anche quello di un altro: senza pagare)
//   wallet(w)    → saldo da mostrare sul display quando è ferma ({btn, gettoni})
//   update(dt)   → moneta, gettoni che cadono, lampadine, display
//   state()      → 'scegli' o 'cambia'; reset() torna a «scegli» e svuota la vaschetta
//   onChange(fn) → chiamata a ogni cambio di stato ({state, key})
import * as THREE from 'three';

export const COIN_KEYS = [1, 5, 10];
export const COIN_RATE = 5;
const MAX_IN_TRAY = 40; // gettoni che si vedono al massimo nella vaschetta

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.flipY = false; // UV di Blender: v = 0 in alto
  t.userData.canvas = c;
  return t;
}
function fitFont(g, text, max, size, family = '"Arial Black", Arial, sans-serif') {
  g.font = 'bold ' + size + 'px ' + family;
  while (g.measureText(text).width > max && size > 10) g.font = 'bold ' + --size + 'px ' + family;
}
// gettone disegnato: ottone con il foro
function coinIcon(g, x, y, r, gold = false) {
  g.fillStyle = gold ? '#f2c14a' : '#d8a64a';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = gold ? '#9a6a10' : '#8a5f1c';
  g.lineWidth = Math.max(2, r * 0.12);
  g.beginPath();
  g.arc(x, y, r * 0.62, 0, Math.PI * 2);
  g.stroke();
  if (gold) {
    g.fillStyle = '#9a6a10';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold ' + Math.round(r * 1.1) + 'px "Arial Black", Arial, sans-serif';
    g.fillText('B', x, y + 1);
    // simbolo BTN: tre aste che escono sopra e sotto la B (come la ₿ del Bitcoin, che ne ha due)
    for (const dx of [-0.22, 0, 0.22]) g.fillRect(x + dx * r - r * 0.05, y - r * 0.68, r * 0.1, r * 1.38);
    g.fillText('B', x, y + 1);
  } else {
    g.fillStyle = '#1a1208';
    g.beginPath();
    g.arc(x, y, r * 0.22, 0, Math.PI * 2);
    g.fill();
  }
}
const signTexture = () =>
  canvasTexture(768, 132, (g, W, H) => {
    g.fillStyle = '#1b0d04';
    g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ffd04a');
    grad.addColorStop(1, '#ff7a10');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, 'GETTONI', W - 220, 96);
    g.lineWidth = 10;
    g.strokeStyle = '#7a2a00';
    g.strokeText('GETTONI', W / 2, H / 2 + 4);
    g.fillStyle = grad;
    g.fillText('GETTONI', W / 2, H / 2 + 4);
    coinIcon(g, 62, H / 2, 40);
    coinIcon(g, W - 62, H / 2, 40);
  });
const plateTexture = () =>
  canvasTexture(256, 208, (g, W, H) => {
    g.fillStyle = '#f4ead2';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e0601a';
    g.lineWidth = 8;
    g.strokeRect(8, 8, W - 16, H - 16);
    coinIcon(g, 70, 64, 34, true);
    g.fillStyle = '#3a2410';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 44px "Arial Black", Arial, sans-serif';
    g.fillText('=', 128, 64);
    coinIcon(g, 186, 64, 30);
    fitFont(g, '1 BTN = 5 GETTONI', W - 30, 28);
    g.fillText('1 BTN = 5 GETTONI', W / 2, 136);
    g.fillStyle = '#a04010';
    fitFont(g, 'scegli e inserisci', W - 40, 22, 'Arial, sans-serif');
    g.fillText('scegli e inserisci', W / 2, 176);
  });
const keyTexture = k =>
  canvasTexture(160, 116, (g, W, H) => {
    g.fillStyle = '#ffe2a6';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e0601a';
    g.lineWidth = 6;
    g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#3a1a04';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, k + ' BTN', W - 24, 44);
    g.fillText(k + ' BTN', W / 2, H * 0.42);
    g.fillStyle = '#a04010';
    fitFont(g, k * COIN_RATE + ' gettoni', W - 24, 24, 'Arial, sans-serif');
    g.fillText(k * COIN_RATE + ' gettoni', W / 2, H * 0.76);
  });

function piece(gltf, name) {
  const o = gltf.scene.getObjectByName(name);
  return o ? o.clone(true) : new THREE.Group();
}
const setMaterial = (obj, m) => obj.traverse(o => o.isMesh && (o.material = m));
const ease = t => t * t * (3 - 2 * t);

// punti della macchinetta (metri, davanti +z)
const SLOT_Z = 0.15; // dentro la fessura: la moneta qui sparisce
const MOUTH = new THREE.Vector3(0, 0.085, 0.14); // da dove escono i gettoni
const TRAY = { x: 0.082, z0: 0.17, z1: 0.198, y: 0.0195, h: 0.003 }; // vaschetta: metà larghezza, profondità, fondo

export function createCoinChanger(gltf, { sound = () => {}, pay = () => true } = {}) {
  const root = new THREE.Group();
  for (const n of ['corpo', 'pannello', 'insegna', 'targa']) root.add(piece(gltf, n));
  const sign = signTexture(),
    plate = plateTexture();
  root.getObjectByName('insegna') &&
    setMaterial(
      root.getObjectByName('insegna'),
      new THREE.MeshStandardMaterial({
        map: sign,
        emissiveMap: sign,
        emissive: 0xffffff,
        emissiveIntensity: 0.6,
        roughness: 0.4
      })
    );
  root.getObjectByName('targa') &&
    setMaterial(
      root.getObjectByName('targa'),
      new THREE.MeshStandardMaterial({
        map: plate,
        emissiveMap: plate,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.5
      })
    );
  root.traverse(o => {
    if (o.isMesh && o.material.name === 'luce_arancio')
      o.material = new THREE.MeshStandardMaterial({
        color: '#ff7a1a',
        emissive: '#ff6a10',
        emissiveIntensity: 1.2
      });
  });

  // lampadine: due gruppi che si accendono a turno (più veloci mentre cambia)
  const bulbs = ['lampadine_a', 'lampadine_b'].map(n => {
    const b = piece(gltf, n),
      m = new THREE.MeshStandardMaterial({
        color: '#fff0c8',
        emissive: '#ffc860',
        emissiveIntensity: 1.5,
        toneMapped: false
      });
    setMaterial(b, m);
    root.add(b);
    return m;
  });

  // display
  const screenTex = canvasTexture(640, 120, () => {});
  const screen = screenTex.userData.canvas;
  const display = piece(gltf, 'display');
  setMaterial(display, new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  root.add(display);
  let shown = '';
  function show(line1, line2 = '') {
    if (shown === line1 + '|' + line2) return;
    shown = line1 + '|' + line2;
    const g = screen.getContext('2d'),
      W = screen.width,
      H = screen.height;
    g.fillStyle = '#060d06';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffb02a';
    fitFont(g, line1, W - 40, 56, '"Courier New", monospace');
    g.fillText(line1, W / 2, H * 0.34);
    g.fillStyle = '#7dffa0';
    fitFont(g, line2, W - 40, 36, '"Courier New", monospace');
    g.fillText(line2, W / 2, H * 0.74);
    screenTex.needsUpdate = true;
  }
  let wallet = null;
  const idle = () =>
    wallet && Number.isInteger(wallet.btn)
      ? show('SALDO ' + wallet.btn + ' BTN', wallet.gettoni + ' GETTONI')
      : show('1 BTN = 5 GETTONI', 'scegli 1 · 5 · 10');

  // tasti
  const keys = [];
  for (const k of COIN_KEYS) {
    const b = piece(gltf, 'tasto_' + k),
      tex = keyTexture(k);
    const m = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
      roughness: 0.4
    });
    setMaterial(b, m);
    b.userData.coin = { type: 'key', key: k };
    b.userData.rest = b.position.z;
    b.userData.mat = m;
    root.add(b);
    keys.push(b);
  }
  const press = b => {
    b.position.z = b.userData.rest - 0.006; // il tasto rientra
    setTimeout(() => (b.position.z = b.userData.rest), 140);
  };

  // moneta BTN davanti alla fessura (nascosta finché non serve) e gettone da copiare
  const coin = piece(gltf, 'moneta_btn');
  const coinRest = coin.position.clone();
  coin.visible = false;
  root.add(coin);
  // (sulla faccia +x il pagliaccio di Binotto Corsa Competizione coniato in rilievo, già nel modello)
  const token = piece(gltf, 'gettone');
  token.visible = false;
  const tray = new THREE.Group();
  root.add(tray);
  const noRay = o => o.traverse(m => (m.raycast = () => {}));
  noRay(coin);
  noRay(tray);

  // stato: 'scegli' → 'cambia' → 'scegli'
  let state = 'scegli',
    job = null,
    clock = 0;
  const listeners = [];
  const emit = () => listeners.forEach(fn => fn({ state, key: job ? String(job.k) : null }));
  idle();

  function play(k) {
    k = Number(k);
    if (state !== 'scegli' || !COIN_KEYS.includes(k)) return false;
    state = 'cambia';
    // una moneta per BTN, al massimo tre (con 5 e 10 BTN entrano tre monete e il display conta il resto)
    job = { k, coins: Math.min(3, k), coinT: 0, coinN: 0, out: 0, next: 0, falling: [], end: 0 };
    keys.forEach(b => (b.userData.mat.emissiveIntensity = b.userData.coin.key === k ? 1 : 0.1));
    show(k + ' BTN', 'inserisci la moneta');
    emit();
    return true;
  }
  function hit(obj) {
    let o = obj;
    while (o && !o.userData.coin) o = o.parent;
    const v = o?.userData.coin;
    if (!v) return null;
    press(o);
    sound('tasto');
    if (state !== 'scegli') return v;
    if (pay(v.key)) play(v.key);
    else {
      shown = '';
      show(
        'SALDO',
        wallet && Number.isInteger(wallet.btn) ? 'servono ' + v.key + ' BTN' : 'saldo in arrivo…'
      );
      sound('errore');
    }
    return v;
  }
  function clearTray() {
    for (const c of [...tray.children]) c.removeFromParent();
  }
  function finish() {
    state = 'scegli';
    job = null;
    keys.forEach(b => (b.userData.mat.emissiveIntensity = 0.25));
    shown = '';
    idle();
    emit();
  }
  function reset() {
    coin.visible = false;
    if (job) for (const f of job.falling) f.obj.removeFromParent();
    clearTray();
    if (state !== 'scegli') finish();
  }

  // un gettone che cade dalla bocca nella vaschetta
  function drop() {
    if (tray.children.length >= MAX_IN_TRAY) tray.remove(tray.children[0]);
    const g = token.clone(true);
    g.visible = true;
    g.position.copy(MOUTH);
    g.position.x += (Math.random() - 0.5) * 0.12;
    g.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    tray.add(g);
    const x = Math.max(-TRAY.x, Math.min(TRAY.x, g.position.x + (Math.random() - 0.5) * 0.03)),
      z = TRAY.z0 + Math.random() * (TRAY.z1 - TRAY.z0);
    // gettoni già lì sotto: si impilano
    const under = tray.children.filter(
      o => o !== g && !o.userData.falling && Math.hypot(o.position.x - x, o.position.z - z) < 0.03
    ).length;
    g.userData.falling = true;
    job.falling.push({
      obj: g,
      t: 0,
      from: g.position.clone(),
      to: new THREE.Vector3(x, TRAY.y + Math.min(under, 6) * TRAY.h, z),
      spin: g.rotation.clone(),
      yaw: Math.random() * Math.PI * 2
    });
  }

  function update(dt) {
    clock += dt;
    // lampadine a turno
    const fast = state === 'cambia' ? 7 : 2.2,
      on = Math.floor(clock * fast) % 2;
    bulbs[0].emissiveIntensity = on ? 2.2 : 0.25;
    bulbs[1].emissiveIntensity = on ? 0.25 : 2.2;
    if (!job) return;
    // le monete entrano una alla volta: compaiono davanti, scorrono dentro la fessura
    if (job.coinN < job.coins) {
      job.coinT += dt;
      // la prima moneta si fa vedere: arriva col pagliaccio verso chi guarda, poi si gira di taglio ed entra
      const slow = job.coinN === 0 ? 1.3 : 0.55,
        t = Math.min(1, job.coinT / slow),
        phase = (from, len) => ease(Math.min(1, Math.max(0, (t - from) / len))),
        a = phase(0, 0.45), // arriva davanti alla fessura
        turn = phase(0.45, 0.2), // si gira di taglio
        b = phase(0.65, 0.35); // entra
      coin.visible = true;
      coin.position.copy(coinRest);
      coin.position.z = coinRest.z + 0.05 * (1 - a) - (coinRest.z - SLOT_Z) * b;
      coin.rotation.y = job.coinN === 0 ? -(Math.PI / 2) * (1 - turn) : 0;
      if (job.coinT - dt <= slow * 0.8 && job.coinT > slow * 0.8) sound('moneta');
      if (t >= 1) {
        coin.visible = false;
        job.coinN++;
        job.coinT = -0.12;
        if (job.coinN === job.coins) {
          job.next = 0.35;
          show(job.k + ' BTN → ' + job.k * COIN_RATE, 'GETTONI 0');
        }
      }
      return;
    }
    // poi i gettoni, uno dopo l'altro (più svelti quando sono tanti)
    const total = job.k * COIN_RATE,
      gap = total > 20 ? 0.07 : 0.14;
    if (job.out < total) {
      job.next -= dt;
      while (job.next <= 0 && job.out < total) {
        drop();
        job.out++;
        job.next += gap;
        show(job.k + ' BTN → ' + total, 'GETTONI ' + job.out);
      }
    }
    for (const f of job.falling) {
      f.t += dt;
      const t = Math.min(1, f.t / 0.22);
      f.obj.position.lerpVectors(f.from, f.to, t);
      f.obj.position.y = f.from.y + (f.to.y - f.from.y) * t * t; // cade sempre più veloce
      f.obj.rotation.set(f.spin.x * (1 - t), f.yaw * t, f.spin.z * (1 - t));
      if (t >= 1 && f.obj.userData.falling) {
        f.obj.userData.falling = false;
        sound('gettone');
      }
    }
    job.falling = job.falling.filter(f => f.obj.userData.falling);
    if (job.out >= total && !job.falling.length) {
      if (!job.end) {
        job.end = clock;
        sound('cambio');
        shown = '';
        show('FATTO!', '+' + total + ' GETTONI');
      } else if (clock - job.end > 2.2) finish();
    }
  }

  return {
    root,
    hit,
    play,
    reset,
    update,
    typing: () => {},
    take: () => null,
    typed: () => (job ? String(job.k) : ''),
    state: () => state,
    ready: () => null,
    wallet: w => {
      wallet = w;
      if (state === 'scegli') idle();
    },
    onChange: fn => listeners.push(fn)
  };
}
