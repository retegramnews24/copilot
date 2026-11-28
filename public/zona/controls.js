// Zona Operativa: comandi. Computer: W A S D, mouse (puntatore bloccato), clic sinistro spara, clic destro mirino
// (Falco), R ricarica, E prendi, 1-2-3 armi, rotella cambia arma, Spazio salta, Ctrl o C accucciato, si cammina e
// Maiusc tenuto corre (come nella Lobby 3D), Esc menù. Telefono: levetta a sinistra, trascinare a destra per guardare (mira libera), tasti.
import { isTouchDevice } from '../touch-device.js';

export function createControls(canvas, ui, { onMenu }) {
  const touch = isTouchDevice();
  const keys = new Set();
  const s = {
    touch,
    yaw: 0,
    pitch: 0,
    fire: false,
    aim: false,
    sens: 1,
    pressed: new Set(), // tasti a una botta: ricarica, prendi, salta, slot1…
    stick: { x: 0, y: 0 },
    touchCrouch: false,
    locked: false
  };
  const press = name => s.pressed.add(name);
  s.take = name => s.pressed.delete(name);

  // ---------- tastiera e mouse ----------
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyR') press('ricarica');
    if (e.code === 'KeyE') press('prendi');
    if (e.code === 'Space') press('salta');
    if (/^Digit[1-3]$/.test(e.code)) press('slot' + e.code.slice(5));
    if (e.code === 'KeyQ') press('ultima');
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => {
    keys.clear();
    s.fire = false;
    s.aim = false;
  });
  // Puntatore bloccato quando si può; se il browser non lo permette (alcune finestre di Telegram, riquadri senza il
  // permesso) si gioca a «mouse libero»: la vista segue il mouse dentro la finestra e il cursore sparisce.
  s.free = !canvas.requestPointerLock;
  s.lock = () => {
    if (touch || s.free) return;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => (s.free = true));
    } catch {
      s.free = true;
    }
  };
  document.addEventListener('pointerlockerror', () => (s.free = true));
  const steering = () => s.locked || (s.free && s.active);
  // a mouse libero, a ogni clic (al massimo ogni 3 s) si riprova a bloccare il puntatore: se Telegram ora lo
  // permette si torna al puntatore bloccato
  let retryAt = 0;
  const retryLock = () => {
    if (touch || s.locked || !canvas.requestPointerLock || performance.now() < retryAt) return;
    retryAt = performance.now() + 3000;
    try {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch {}
  };
  canvas.addEventListener('mousedown', e => {
    if (touch) return;
    if (!steering()) {
      s.lock();
      return;
    }
    if (s.free) retryLock();
    if (e.button === 0) s.fire = true;
    if (e.button === 2) s.aim = true; // si mira tenendo premuto il tasto destro
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) s.fire = false;
    if (e.button === 2) s.aim = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => {
    if (steering()) press(e.deltaY > 0 ? 'prossima' : 'precedente');
  });
  document.addEventListener('pointerlockchange', () => {
    s.locked = document.pointerLockElement === canvas;
    if (s.locked) s.free = false;
    else if (!touch && !s.free) {
      s.fire = false;
      onMenu(true);
    }
  });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && s.free && s.active) {
      s.fire = false;
      onMenu(true);
    }
  });
  // A mouse libero il cursore non si può trattenere: arrivato al bordo (o sull'altro monitor) la vista si fermava e
  // non si girava a 360°. Ora vicino al bordo sinistro o destro della finestra la vista continua a girare, più in
  // fretta più si è vicini al bordo; se il mouse esce dalla finestra si ferma.
  let cursorX = null;
  const EDGE = 0.15; // parte della larghezza della finestra, per lato
  const hint = document.createElement('div');
  hint.id = 'bordo-giro';
  hint.hidden = true;
  document.body.append(hint);
  addEventListener('mousemove', e => {
    canvas.style.cursor = s.free && s.active ? 'none' : '';
    cursorX = e.clientX;
    if (!steering()) return;
    const k = 0.0022 * s.sens * (s.zoom || 1);
    s.yaw -= e.movementX * k;
    s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch - e.movementY * k));
  });
  document.addEventListener('mouseleave', () => (cursorX = null));
  addEventListener('blur', () => (cursorX = null));
  let lastEdge = performance.now();
  const edgeTurn = now => {
    requestAnimationFrame(edgeTurn);
    const dt = Math.min(0.05, (now - lastEdge) / 1000);
    lastEdge = now;
    let k = 0;
    if (!touch && s.free && s.active && !s.locked && cursorX !== null) {
      const zone = innerWidth * EDGE;
      if (cursorX < zone) k = -(1 - cursorX / zone);
      else if (cursorX > innerWidth - zone) k = (cursorX - (innerWidth - zone)) / zone;
    }
    s.edge = k;
    // fino a circa 3 rad/s (un giro in 2 secondi) proprio sul bordo
    s.yaw -= k * Math.abs(k) * 3.2 * s.sens * (s.zoom || 1) * dt;
    const side = k < -0.05 ? 'sinistra' : k > 0.05 ? 'destra' : '';
    hint.hidden = !side;
    if (side && hint.className !== side) hint.className = side;
  };
  requestAnimationFrame(edgeTurn);

  // ---------- telefono ----------
  if (touch) {
    ui.touch.hidden = false;
    let stickId = null;
    let lookId = null;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    const R = 55;
    const base = ui.stickBase;
    const knob = ui.stickKnob;
    canvas.addEventListener(
      'touchstart',
      e => {
        for (const t of e.changedTouches) {
          if (t.clientX < innerWidth * 0.42 && stickId === null) {
            stickId = t.identifier;
            sx = t.clientX;
            sy = t.clientY;
            base.style.left = sx - R + 'px';
            base.style.top = sy - R + 'px';
            base.hidden = false;
          } else if (lookId === null) {
            lookId = t.identifier;
            lx = t.clientX;
            ly = t.clientY;
          }
        }
        e.preventDefault();
      },
      { passive: false }
    );
    canvas.addEventListener(
      'touchmove',
      e => {
        for (const t of e.changedTouches) {
          if (t.identifier === stickId) {
            let dx = t.clientX - sx;
            let dy = t.clientY - sy;
            const l = Math.hypot(dx, dy);
            if (l > R) {
              dx *= R / l;
              dy *= R / l;
            }
            s.stick.x = dx / R;
            s.stick.y = -dy / R;
            knob.style.transform = `translate(${dx}px,${dy}px)`;
          } else if (t.identifier === lookId) {
            const k = 0.0055 * s.sens * (s.zoom || 1);
            s.yaw -= (t.clientX - lx) * k;
            s.pitch = Math.max(-1.5, Math.min(1.5, s.pitch - (t.clientY - ly) * k));
            lx = t.clientX;
            ly = t.clientY;
          }
        }
        e.preventDefault();
      },
      { passive: false }
    );
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null;
          s.stick.x = s.stick.y = 0;
          knob.style.transform = '';
          base.hidden = true;
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    const hold = (el, on, off) => {
      el.addEventListener('touchstart', e => (e.preventDefault(), on()), { passive: false });
      el.addEventListener('touchend', e => (e.preventDefault(), off && off()), { passive: false });
      el.addEventListener('touchcancel', () => off && off());
    };
    hold(ui.btnFire, () => (s.fire = true), () => (s.fire = false));
    hold(ui.btnAim, () => (s.aim = !s.aim));
    hold(ui.btnReload, () => press('ricarica'));
    hold(ui.btnJump, () => press('salta'));
    hold(ui.btnCrouch, () => {
      s.touchCrouch = !s.touchCrouch;
      ui.btnCrouch.classList.toggle('on', s.touchCrouch);
    });
    hold(ui.btnSwitch, () => press('prossima'));
    hold(ui.btnTake, () => press('prendi'));
  }

  // Lo stato da usare a ogni fotogramma.
  s.read = () => {
    const k = c => keys.has(c);
    let fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    let side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    if (touch) {
      fwd = s.stick.y;
      side = s.stick.x;
    }
    return {
      fwd,
      side,
      // al computer si cammina e si corre tenendo Maiusc; sul telefono la levetta corre come prima
      walk: !touch && !(k('ShiftLeft') || k('ShiftRight')),
      crouch: k('ControlLeft') || k('KeyC') || s.touchCrouch,
      jump: s.take('salta'),
      yaw: s.yaw,
      pitch: s.pitch
    };
  };
  return s;
}
