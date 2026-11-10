const splash = document.getElementById('playground-intro');
const info = document.getElementById('playground-info');
const duration = 2000;
let timer;
let opening = false;

const artwork = Promise.allSettled(
  [...splash.querySelectorAll('img')].map(image => image.decode?.())
);

function closeSplash() {
  clearTimeout(timer);
  if (typeof splash.close === 'function') splash.close();
  else splash.removeAttribute('open');
}

async function showSplash() {
  if (opening || splash.hasAttribute('open')) return;
  opening = true;
  // On a slow connection, show the intro without holding the app for the image.
  await Promise.race([artwork, new Promise(resolve => setTimeout(resolve, 250))]);
  opening = false;
  clearTimeout(timer);
  if (typeof splash.showModal === 'function') splash.showModal();
  else splash.setAttribute('open', '');
  timer = setTimeout(closeSplash, duration);
}

splash.style.setProperty('--bp-duration', duration + 'ms');
splash.addEventListener('cancel', () => clearTimeout(timer));
info.addEventListener('click', showSplash);
info.hidden = false;

if (document.hidden) {
  const startWhenVisible = () => {
    if (document.hidden) return;
    document.removeEventListener('visibilitychange', startWhenVisible);
    showSplash();
  };
  document.addEventListener('visibilitychange', startWhenVisible);
} else {
  showSplash();
}
