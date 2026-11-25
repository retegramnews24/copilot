// «È un telefono?» deciso in un solo punto (analisi 9.8), per la Lobby 3D, i flipper, il calcio balilla e la pagina
// dei comandi. Prima bastava che lo schermo accettasse il tocco: un portatile con schermo tattile, usato con mouse e
// tastiera, riceveva joystick, scritte e comandi del telefono.
// Ora conta il puntatore principale ((pointer: coarse)). In più il dispositivo ricorda come è stato usato l'ultima
// volta: un tocco vero con il dito su un computer, o il mouse su un telefono, vale dalla prossima apertura.
const KEY = 'binottoland-touch';

function remembered() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// coarse: il puntatore principale è il dito; last: '1' / '0' / null, l'ultimo uso ricordato
export function decideTouch(coarse, last) {
  return last === '1' ? true : last === '0' ? false : !!coarse;
}

export function isTouchDevice() {
  return decideTouch(globalThis.matchMedia?.('(pointer: coarse)').matches, remembered());
}

// pointerType di un tocco o di un clic vero → cosa ricordare (null: niente da cambiare)
export function rememberPointer(pointerType, touchNow) {
  if (pointerType === 'touch' && !touchNow) return '1';
  if (pointerType === 'mouse' && touchNow) return '0';
  return null;
}

if (typeof addEventListener === 'function')
  addEventListener(
    'pointerdown',
    event => {
      const next = rememberPointer(event.pointerType, isTouchDevice());
      if (next)
        try {
          localStorage.setItem(KEY, next);
        } catch {}
    },
    { capture: true, passive: true }
  );
