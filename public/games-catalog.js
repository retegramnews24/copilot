// Giochi page: favourites (★), recently played, colour covers. Cards are moved, never rebuilt,
// so every button keeps its id and handler.
const STORE = 'binottoland-games-v1';
const COVERS = {
  checkmate: '#c9b27c',
  'dama-italiana': '#b0745a',
  'forza-4': '#d9534f',
  uno: '#e94b3c',
  scarabeo: '#d6a648',
  scopa: '#3f8f5c',
  'battaglia-navale': '#2f6f9f',
  briscola: '#8c4b8a',
  'briscola-in-cinque': '#6b4a9a',
  'moto-trial': '#e07b39',
  pong: '#5bc0be',
  labyrinth: '#7d6bd6',
  'golf-with-your-gay-friends': '#4caf50',
  'giulio-simulator': '#3a7bd5',
  'binotto-simulator': '#ffd236',
  'number-connect': '#f0a202',
  'cinema-streamer': '#d64575',
  'blackboard-spazio-libero': '#6c8a6b'
};
const slug = text =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const read = () => {
  try {
    return { fav: [], recent: {}, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch {
    return { fav: [], recent: {} };
  }
};
const write = value => {
  try {
    localStorage.setItem(STORE, JSON.stringify(value));
  } catch {}
};
const homes = new Map();
let cards = [];

export function isDevMode() {
  try {
    return localStorage.getItem('binottoland-dev') === '1';
  } catch {
    return false;
  }
}

export function initCatalog() {
  const page = document.getElementById('page-games');
  if (!page || cards.length) return;
  cards = [...page.querySelectorAll('.catalog-card')];
  for (const card of cards) {
    const title = card.querySelector('.catalog-card-title h3')?.textContent || '';
    const key = slug(title);
    card.dataset.game = key;
    card.style.setProperty('--cover', COVERS[key] || 'var(--accent)');
    homes.set(card, card.parentElement);
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'fav-toggle';
    star.setAttribute('aria-label', 'Preferito: ' + title);
    star.onclick = event => {
      event.stopPropagation();
      const state = read();
      state.fav = state.fav.includes(key) ? state.fav.filter(k => k !== key) : [...state.fav, key];
      write(state);
      renderCatalog();
    };
    card.querySelector('.catalog-card-title').append(star);
    // Any real action on the card counts as "played".
    card.addEventListener('click', event => {
      if (!event.target.closest('button') || event.target.closest('.fav-toggle')) return;
      const state = read();
      state.recent[key] = Date.now();
      write(state);
      renderCatalog();
    });
  }
  // Developer shortcuts stay out of sight unless enabled from the Debug page.
  const dev = document.getElementById('solo-labyrinth');
  if (dev) dev.hidden = !isDevMode();
  renderCatalog();
}

// Bring a game card into view and make it flash, switching to the Giochi tab if needed.
export function showGame(key) {
  const card = cards.find(c => c.dataset.game === key);
  if (!card) return;
  const tab = document.getElementById('tab-games');
  if (tab?.getAttribute('aria-selected') !== 'true') tab?.click();
  requestAnimationFrame(() => {
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
  });
}
// Small icon tiles (favourites first, then recently played), used in Giochi and in the Lobby.
function tiles(picks) {
  return picks
    .map(key => cards.find(c => c.dataset.game === key))
    .filter(Boolean)
    .map(card => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'game-tile';
      tile.style.setProperty('--cover', card.style.getPropertyValue('--cover'));
      const icon = card.querySelector('.catalog-icon')?.cloneNode(true) || document.createElement('span');
      icon.removeAttribute('id');
      const name = document.createElement('span');
      name.textContent = card.querySelector('.catalog-card-title h3')?.textContent || '';
      tile.append(icon, name);
      tile.onclick = () => showGame(card.dataset.game);
      return tile;
    });
}
export function renderCatalog() {
  if (!cards.length) return;
  const state = read();
  // Cards never move: "I tuoi giochi" and the Lobby show icon tiles that lead to them.
  for (const card of cards) if (card.parentElement !== homes.get(card)) homes.get(card).append(card);
  // Only the games marked ★: removing the star removes the tile, in Giochi and in the Lobby.
  const picks = state.fav.slice(0, 12);
  // Favourites appear only in the Lobby; the Giochi page keeps its sections unchanged.
  document.getElementById('recent-games').replaceChildren();
  document.getElementById('recent-games-section').hidden = true;
  const lobby = document.getElementById('lobby-favourites-list');
  if (lobby) {
    lobby.replaceChildren(...tiles(picks));
    document.getElementById('lobby-favourites').hidden = !lobby.children.length;
  }
  for (const card of cards) {
    const on = state.fav.includes(card.dataset.game);
    const star = card.querySelector('.fav-toggle');
    star.textContent = on ? '★' : '☆';
    star.setAttribute('aria-pressed', String(on));
    card.classList.toggle('favourite', on);
  }
}
