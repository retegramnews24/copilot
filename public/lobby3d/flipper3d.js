// Flipper "Binottoland Grand Prix" nella sala giochi della Lobby 3D. Il cabinet è fatto in Blender
// (blender/flipper.blend → models/flipper.glb): mobile, tabellone con il display, piano con rampa, bumper,
// respingenti e semafori. Si muovono i tre flipper (girano sul perno), la leva del lancio con la molla e i pulsanti.
// La fisica è quella di ../flipper/physics.js (sul piano inclinato): qui la pallina d'acciaio viene messa sul piano 3D.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import {
  newGame,
  simulate,
  setFlipper,
  pull,
  drag,
  nudge,
  R,
  LANE_X,
  BALLS
} from '../flipper/physics.js?v=1724735c0d';

export const FLIPPER_AT = { x: -9.2, z: 3.6, ry: Math.PI }; // nella sala giochi, rivolto verso il centro
const STAND = 1.15; // dove sta il personaggio, davanti alla barra (in metri dal centro del cabinet)
const LEVER_RUN = 0.06; // quanto torna indietro la leva tirata tutta

export function buildFlipper(scene, el, { audio, allowed }) {
  const root = new THREE.Group();
  root.position.set(FLIPPER_AT.x, 0, FLIPPER_AT.z);
  root.rotation.y = FLIPPER_AT.ry;
  scene.add(root);
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
    dmd.font = '700 26px "Courier New", monospace';
    dmd.fillText(top, 128, 22);
    dmd.font = '700 13px "Courier New", monospace';
    dmd.fillText(bottom, 128, 50);
    // griglia dei punti luminosi
    dmd.fillStyle = '#120600aa';
    for (let x = 0; x < 256; x += 3) dmd.fillRect(x, 0, 1, 64);
    for (let y = 0; y < 64; y += 3) dmd.fillRect(0, y, 256, 1);
    dmdTexture.needsUpdate = true;
  }
  drawDmd('GRAND PRIX', 'PREMI E PER GIOCARE');
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
  new GLTFLoader().load(new URL('models/flipper.glb', import.meta.url).href, gltf => {
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
    }
    // superfici luminose (luci, neon, inserti) più vive
    gltf.scene.traverse(o => {
      if (o.isMesh && o.material?.emissiveIntensity) o.material.emissiveIntensity *= 1.4;
    });
    for (const b of balls) {
      b.visible = false;
      piano.add(b);
    }
  });

  // ---------- suoni (sintetizzati, come nell'anteprima) ----------
  let noise = null;
  function sound(type, power = 0.6) {
    const ac = audio();
    if (!ac || ac.state !== 'running' || !allowed()) return;
    const now = ac.currentTime,
      out = ac.createGain();
    out.gain.value = 0.3;
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
    else hit(2200, 5, 0.03, 0.25 * p);
  }

  // ---------- partita ----------
  let game = null,
    active = false,
    pressed = [false, false],
    pulling = false,
    lastDmd = 0,
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
      return { x: p.x, z: p.z, yaw: FLIPPER_AT.ry };
    },
    open() {
      active = true;
      game = newGame();
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
    },
    // tastiera: Z / M (o Maiusc, frecce) i flipper, S o Freccia giù o Invio tirano la leva, Spazio la scossa, E o Esc escono
    input(e) {
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
      if (e.type === 'pointerdown') {
        if (game.over) {
          api.open();
          return true;
        }
        if (e.pointerType !== 'mouse') {
          const r = el.getBoundingClientRect();
          if (
            e.clientX > r.left + r.width * 0.62 &&
            e.clientY > r.top + r.height * 0.7 &&
            game.balls.some(b => b.x > LANE_X && b.y < 0.06)
          ) {
            grab = { id: e.pointerId, y: e.clientY };
            drag(game, 0);
            pulling = true;
          } else flip(e.clientX < r.left + r.width / 2 ? 0 : 1, true);
          return true;
        }
        if (e.button === 0 && onLever(e)) {
          grab = { id: e.pointerId, y: e.clientY };
          drag(game, 0);
          pulling = true;
        } else if (e.button === 0) flip(0, true);
        else if (e.button === 2) flip(1, true);
        return true;
      }
      if (e.type === 'pointermove') {
        if (grab?.id === e.pointerId) drag(game, (e.clientY - grab.y) / 110);
        return !!grab;
      }
      if (e.type === 'pointerup' || e.type === 'pointercancel') {
        if (grab?.id === e.pointerId) {
          grab = null;
          setPull(false);
        } else if (e.pointerType !== 'mouse') {
          const r = el.getBoundingClientRect();
          flip(e.clientX < r.left + r.width / 2 ? 0 : 1, false);
        } else if (e.button === 0) flip(0, false);
        else if (e.button === 2) flip(1, false);
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
    update(cam, dt) {
      camera = cam;
      const g = game;
      if (g) {
        simulate(g, dt);
        for (const ev of g.events.splice(0)) sound(ev.type, ev.power);
      }
      if (!piano) return;
      // pallina sul piano
      balls.forEach((b, i) => {
        const p = g?.balls[i];
        b.visible = !!p;
        if (p) b.position.set(p.x - 0.26, R, -(p.y - 0.53));
      });
      // flipper: girano sul perno (stesso angolo della fisica)
      if (g) g.t.flippers.forEach((f, i) => flips[i] && (flips[i].rotation.y = f.a - f.rest));
      // leva e molla: tirata torna indietro verso chi gioca e la molla si accorcia
      const pullNow = g?.plunger ?? 0;
      lever.position.z = leverZ + pullNow * LEVER_RUN;
      spring.scale.z = 1 - pullNow * 0.55;
      // pulsanti premuti
      buttons.forEach((b, i) => (b.position.x = buttonX[i] + (pressed[i] ? (i ? -0.008 : 0.008) : 0)));
      // display
      const now = performance.now();
      if (g && now - lastDmd > 120) {
        lastDmd = now;
        const msg =
          g.messageTime > 0
            ? g.message
            : g.over
              ? 'FINE · S PER RICOMINCIARE'
              : 'PALLINA ' + g.ball + '/' + BALLS;
        drawDmd(g.score.toLocaleString('it-IT'), msg.toUpperCase().slice(0, 30));
      }
      // vista: dagli occhi di chi gioca, sul piano inclinato
      if (active) {
        const eye = root.localToWorld(new THREE.Vector3(0, 1.62, 1.08));
        const look = root.localToWorld(new THREE.Vector3(0, 0.98, -0.12));
        cam.position.copy(eye);
        cam.lookAt(look);
        if (g?.nudge > 0) cam.position.x += (Math.random() - 0.5) * 0.01;
      }
    }
  };
  return api;
}
