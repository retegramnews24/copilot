import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  `<main id="app-shell"><section class="page" id="page-game"><button id="b">x</button><input id="vol" type="range"></section>
   <section class="page" id="page-games" hidden></section><section class="page" id="page-settings" hidden></section>
   <div id="table" hidden></div></main><button id="window-mode" hidden></button>`,
  { url: 'https://example.test/', pretendToBeVisual: true }
);
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  getComputedStyle: window.getComputedStyle,
  localStorage: window.localStorage
});
const { installSwipe } = await import('../public/swipe.js');
const { initWindowMode } = await import('../public/window-mode.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const touch = (type, target, x, y = 100) => {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  target.dispatchEvent(e);
};

// Swipe: a horizontal drag that starts on a button moves to the next page, then the late click is swallowed.
const pages = [],
  shown = [];
let haptics = 0;
const selectPage = page => {
  pages.push(page);
  for (const p of document.querySelectorAll('.page')) p.hidden = p.id !== 'page-' + page;
};
installSwipe({ selectPage, beforeShow: p => shown.push(p), haptic: () => haptics++ });
const button = document.getElementById('b');
let clicks = 0;
button.addEventListener('click', () => clicks++);
touch('touchstart', button, 300);
touch('touchmove', button, 250);
touch('touchmove', button, 120);
touch('touchend', button, 120);
button.click();
assert.equal(clicks, 0, 'click after a swipe is swallowed');
await wait(320);
assert.deepEqual(pages, ['games']);
assert.deepEqual(shown, ['games']);
assert.equal(haptics, 1);

// Dragging right from Giochi goes back to the Lobby.
touch('touchstart', document.getElementById('page-games'), 100);
touch('touchmove', document.getElementById('page-games'), 150);
touch('touchmove', document.getElementById('page-games'), 280);
touch('touchend', document.getElementById('page-games'), 280);
await wait(320);
assert.deepEqual(pages, ['games', 'game']);

// A vertical drag (scrolling) and a drag on the volume slider never swipe.
touch('touchstart', button, 200, 100);
touch('touchmove', button, 195, 180);
touch('touchend', button, 195, 180);
touch('touchstart', document.getElementById('vol'), 300);
touch('touchmove', document.getElementById('vol'), 100);
touch('touchend', document.getElementById('vol'), 100);
await wait(320);
assert.deepEqual(pages, ['games', 'game']);

// Window mode: on Telegram Desktop the button switches and the choice is remembered.
const calls = [];
const desktop = {
  platform: 'tdesktop',
  isFullscreen: true,
  requestFullscreen() {
    calls.push('full');
    this.isFullscreen = true;
  },
  exitFullscreen() {
    calls.push('exit');
    this.isFullscreen = false;
  },
  onEvent() {}
};
const windowButton = document.getElementById('window-mode');
const { enterFullscreen } = initWindowMode(desktop, windowButton);
assert.equal(windowButton.hidden, false);
assert.equal(windowButton.getAttribute('aria-label'), 'Modalità finestra');
windowButton.click();
assert.deepEqual(calls, ['exit']);
assert.equal(localStorage.getItem('binottoland-window-mode'), '1');
enterFullscreen();
assert.deepEqual(calls, ['exit'], 'window mode is not overridden by games');
windowButton.click();
assert.deepEqual(calls, ['exit', 'full']);
assert.equal(localStorage.getItem('binottoland-window-mode'), '0');

// On phones the button stays hidden and the app still goes full screen.
const phoneButton = document.createElement('button');
phoneButton.hidden = true;
const phoneCalls = [];
initWindowMode(
  { platform: 'android', isFullscreen: false, requestFullscreen: () => phoneCalls.push('full') },
  phoneButton
).enterFullscreen();
assert.equal(phoneButton.hidden, true);
assert.deepEqual(phoneCalls, ['full']);

console.log(
  'PASS Lobby modules: swipe between pages (button, back, vertical scroll, slider) and PC window mode.'
);
