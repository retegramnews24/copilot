// F1 on paper! seen from the app: the game (draw a track, race it in 3D, vs the AI or on the same phone) in its iframe.
// Telegram stays here: the iframe receives safe-area insets and Back by postMessage ("f1:..."), and asks the app
// for haptics, for the closing confirmation while racing, and to exit.
const $ = id => document.getElementById(id);

export function createF1Link({ tg, enterFullscreen, safeInsets }) {
  const overlay = $('f1-overlay'),
    frame = $('f1-frame');
  const post = (type, payload = {}) => {
    if (!overlay.hidden) frame.contentWindow?.postMessage({ type: 'f1:' + type, ...payload }, location.origin);
  };
  function open() {
    if (!overlay.hidden) return;
    enterFullscreen();
    try {
      tg?.disableVerticalSwipes?.();
    } catch {}
    overlay.hidden = false;
    frame.src = '/gara/index.html?v=1';
    tg?.BackButton?.show();
  }
  function close() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    frame.src = 'about:blank';
    tg?.BackButton?.hide();
    try {
      tg?.disableClosingConfirmation?.();
      tg?.enableVerticalSwipes?.();
    } catch {}
    $('play-f1').focus();
  }
  $('play-f1').onclick = open;
  frame.addEventListener('load', () => {
    if (!overlay.hidden) {
      frame.focus();
      post('insets', { insets: safeInsets(tg) });
    }
  });
  window.addEventListener('message', event => {
    if (overlay.hidden || event.origin !== location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.type === 'f1:ready') post('insets', { insets: safeInsets(tg) });
    else if (data?.type === 'f1:exit') close();
    else if (data?.type === 'f1:racing') {
      try {
        if (data.on) tg?.enableClosingConfirmation?.();
        else tg?.disableClosingConfirmation?.();
      } catch {}
    } else if (data?.type === 'f1:haptic') {
      const hf = tg?.HapticFeedback;
      try {
        if (data.kind === 'selection') hf?.selectionChanged();
        else if (data.kind === 'impact' && ['light', 'medium', 'heavy'].includes(data.style))
          hf?.impactOccurred(data.style);
        else if (data.kind === 'notification' && ['error', 'success', 'warning'].includes(data.style))
          hf?.notificationOccurred(data.style);
      } catch {}
    }
  });
  return {
    close,
    back: () => post('back'),
    visible: () => !overlay.hidden,
    insets: insets => post('insets', { insets })
  };
}
