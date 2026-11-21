// Full screen and, on PC (Telegram Desktop, macOS, Web), a small Lobby button to switch to window mode.
// The choice is remembered: in window mode the app no longer goes full screen by itself.
const DESKTOP = ['tdesktop', 'macos', 'web', 'weba', 'webk', 'unigram'];
const KEY = 'binottoland-window-mode';

export function initWindowMode(tg, button) {
  const read = () => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  };
  const save = on => {
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {}
  };
  const desktop = DESKTOP.includes(tg?.platform) && typeof tg?.requestFullscreen === 'function';
  const windowMode = () => desktop && read();
  function enterFullscreen() {
    try {
      if (tg?.requestFullscreen && !tg.isFullscreen && !windowMode()) tg.requestFullscreen();
    } catch {}
  }
  if (button && desktop) {
    const paint = () => {
      const full = !!tg.isFullscreen,
        label = full ? 'Modalità finestra' : 'Schermo intero';
      button.textContent = full ? '⤡' : '⤢';
      button.title = label;
      button.setAttribute('aria-label', label);
    };
    button.hidden = false;
    paint();
    tg.onEvent?.('fullscreenChanged', paint);
    button.onclick = () => {
      try {
        if (tg.isFullscreen) {
          save(true);
          tg.exitFullscreen();
        } else {
          save(false);
          tg.requestFullscreen();
        }
      } catch {}
      setTimeout(paint, 300);
    };
  }
  return { enterFullscreen, desktop };
}
