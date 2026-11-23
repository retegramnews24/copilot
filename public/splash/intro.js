const splash = document.getElementById('playground-intro');
const info = document.getElementById('playground-info');
// Splash di apertura: almeno 2 secondi. Se si entra nella Lobby 3D resta aperto mentre la Lobby si carica di
// nascosto (codice, modelli, luci di ogni sala, film del cinema) e la barra ne mostra l'avanzamento vero. Pronta, la
// Lobby si apre sotto lo splash, che si chiude 2 secondi dopo (al massimo dopo 25 secondi).
const duration = 2000;
const longest = 25000;
let timer;
let poll;
let opening = false;
let firstShow = true;

const artwork = Promise.allSettled([...splash.querySelectorAll('img')].map(image => image.decode?.()));

// barra di caricamento della Lobby 3D (sotto il testo dello splash)
const bar = document.createElement('div');
bar.className = 'bp-loading';
bar.hidden = true;
bar.innerHTML = '<span>Carico la Lobby…</span><i><b></b></i>';
bar.style.cssText =
  'margin-top:14px;display:grid;gap:6px;font:600 13px system-ui,sans-serif;color:rgba(255,255,255,.8)';
const track = bar.querySelector('i'),
  fill = bar.querySelector('b'),
  label = bar.querySelector('span');
track.style.cssText =
  'display:block;height:7px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden';
fill.style.cssText =
  'display:block;height:100%;width:0;border-radius:4px;background:linear-gradient(90deg,#ff3a4a,#ffd23f);transition:width .25s';
(splash.querySelector('.bp-copy') || splash).append(bar);

function closeSplash() {
  clearTimeout(timer);
  clearInterval(poll);
  if (typeof splash.close === 'function') splash.close();
  else splash.removeAttribute('open');
}

// verso la Lobby 3D: lo splash sfuma in 0,6 secondi e intanto la telecamera comincia già a scendere
function fadeIntoLobby() {
  clearInterval(poll);
  splash.dispatchEvent(new Event('fading'));
  splash.style.transition = 'opacity .6s';
  splash.style.opacity = '0';
  setTimeout(() => {
    closeSplash();
    splash.style.opacity = '';
    splash.style.transition = '';
  }, 600);
}

function followLobby(started) {
  // la Lobby 3D si prepara solo per chi la usa: senza, lo splash fa i suoi 2 secondi e basta
  // Chi usa la 3D si legge subito qui (come fa l'app): il codice dell'app sul telefono può arrivare dopo qualche
  // secondo, e intanto lo splash deve aspettare invece di chiudersi sulla Lobby classica.
  let want3D = true;
  try {
    want3D = localStorage.getItem('binottoland-lobby3d') !== '0';
  } catch {}
  const state = () => window.binottolandLobbyLoading?.() ?? (want3D ? { progress: 0, ready: false } : null);
  let readyAt = null;
  clearInterval(poll);
  poll = setInterval(() => {
    const now = Date.now() - started;
    const s = state();
    if (!s) {
      if (now >= duration) closeSplash(); // Lobby classica: i soliti 2 secondi
      return;
    }
    bar.hidden = false;
    const p = s.ready ? 1 : Math.min(0.99, s.progress);
    fill.style.width = Math.round(p * 100) + '%';
    label.textContent = s.ready ? 'Lobby pronta' : 'Carico la Lobby… ' + Math.round(p * 100) + '%';
    // pronta: barra piena per 2 secondi, poi si entra
    if (s.ready) readyAt ??= now;
    if (readyAt !== null && now >= readyAt + 2000) fadeIntoLobby();
    else if (now >= longest) closeSplash();
  }, 100);
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
  if (firstShow) {
    // all'apertura dell'app: lo splash aspetta la Lobby 3D
    firstShow = false;
    followLobby(Date.now());
  } else timer = setTimeout(closeSplash, duration); // riaperto dal tasto info: solo i 2 secondi
}

splash.style.setProperty('--bp-duration', duration + 'ms');
splash.addEventListener('cancel', () => {
  clearTimeout(timer);
  clearInterval(poll);
});
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
