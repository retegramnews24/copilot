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

// Accesso non riuscito (app aperta fuori da Telegram, utente non della community…): lo splash resta aperto e al posto
// della barra mostra il motivo, con "Riprova" (se si può) e "Apri in Telegram". Lo chiama l'app (app.js).
let accessError = false;
window.binottolandAccessError = (message, retry) => {
  accessError = true;
  clearTimeout(timer);
  clearInterval(poll);
  if (!splash.hasAttribute('open')) {
    if (typeof splash.showModal === 'function') splash.showModal();
    else splash.setAttribute('open', '');
  }
  bar.hidden = false;
  track.hidden = true;
  label.textContent = message;
  label.style.color = '#ffb4a6';
  bar.querySelector('.bp-actions')?.remove();
  const actions = document.createElement('div');
  actions.className = 'bp-actions';
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:4px';
  const button = (text, onClick, href) => {
    const b = document.createElement(href ? 'a' : 'button');
    b.textContent = text;
    if (href) b.href = href;
    b.style.cssText =
      'padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:600 13px system-ui,sans-serif;text-decoration:none;cursor:pointer';
    if (onClick)
      b.onclick = () => {
        accessError = false;
        track.hidden = false;
        label.style.color = '';
        label.textContent = 'Collegamento a Telegram…';
        actions.remove();
        onClick();
        followLobby(Date.now()); // riprova: lo splash torna ad aspettare la Lobby
      };
    actions.append(b);
  };
  if (retry) button('Riprova', retry);
  button('Apri in Telegram', null, 'https://t.me/checkmategame_bot?startapp');
  bar.append(actions);
};

function closeSplash() {
  if (accessError) return; // senza accesso lo splash resta, con il messaggio
  clearTimeout(timer);
  clearInterval(poll);
  if (typeof splash.close === 'function') splash.close();
  else splash.removeAttribute('open');
  document.documentElement.classList.remove('boot'); // finito l'avvio scuro: ora la pagina si vede
}
// chiuso in qualunque modo (anche con Esc): l'avvio scuro finisce
splash.addEventListener('close', () => document.documentElement.classList.remove('boot'));

// lo splash sfuma in 0,6 secondi (sulla Lobby 3D già aperta sotto, o sulla Lobby classica)
function fadeOut() {
  if (accessError) return; // senza accesso lo splash resta, con il messaggio
  clearInterval(poll);
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
    if (accessError) return; // c'è il messaggio d'accesso: la barra non lo copre
    const now = Date.now() - started;
    const s = state();
    if (!s) {
      // Lobby classica (o accesso non riuscito): i soliti 2 secondi, poi si vede la pagina
      if (now >= duration) fadeOut();
      return;
    }
    bar.hidden = false;
    const p = s.ready ? 1 : Math.min(0.99, s.progress);
    fill.style.width = Math.round(p * 100) + '%';
    label.textContent = s.ready ? 'Lobby pronta' : 'Carico la Lobby… ' + Math.round(p * 100) + '%';
    // pronta: barra piena per 2 secondi, poi si entra
    if (s.ready) readyAt ??= now;
    if (readyAt !== null && now >= readyAt + 2000) fadeOut();
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
  } else timer = setTimeout(fadeOut, duration); // riaperto dal tasto info: solo i 2 secondi
}

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
