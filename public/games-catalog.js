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
  buildAppGrid(page);
  renderCatalog();
}

// Android-style Giochi page: one grid of square icons with a short name. The original cards stay in the page
// (hidden) and are moved into a bottom sheet when a game has more than one mode, so buttons keep ids and handlers.
const SHORT = {
  checkmate: 'Scacchi',
  'dama-italiana': 'Dama',
  'golf-with-your-gay-friends': 'Golf',
  'cinema-streamer': 'Cinema',
  'blackboard-spazio-libero': 'Blackboard',
  'giulio-simulator': 'Giulio',
  'binotto-simulator': 'Binotto',
  'number-connect': 'Number',
  'battaglia-navale': 'Navale',
  'briscola-in-cinque': 'Briscola 5'
};
const visible = card => card && !card.hidden;
const title = card => card.querySelector('.catalog-card-title h3')?.textContent || '';
const actions = card => [...card.querySelectorAll('.catalog-card-content button')].filter(b => !b.hidden);
let sheet = null,
  sheetCard = null;
function buildAppGrid(page) {
  page.classList.add('app-mode');
  const grid = document.createElement('div');
  grid.id = 'app-grid';
  grid.className = 'app-grid';
  grid.setAttribute('role', 'list');
  grid.append(...cards.filter(visible).map(card => appTile(card, 'app-tile')));
  page.prepend(grid);
  // "Riprendi tavolo" lived inside a catalog section: keep it visible under the grid.
  const owned = document.getElementById('owned-table');
  if (owned) grid.after(owned);
  sheet = document.createElement('div');
  sheet.id = 'game-sheet';
  sheet.className = 'game-sheet';
  sheet.hidden = true;
  sheet.innerHTML = '<div class="game-sheet-panel" role="dialog" aria-modal="true"></div>';
  sheet.onclick = event => {
    if (event.target === sheet) closeSheet();
  };
  // An action inside the sheet (not the star) starts the game: close the sheet.
  sheet.firstChild.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button && !button.closest('.fav-toggle') && !button.disabled) setTimeout(closeSheet, 0);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !sheet.hidden) closeSheet();
  });
  document.body.append(sheet);
}
function closeSheet() {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  if (sheetCard) homes.get(sheetCard).append(sheetCard);
  sheetCard = null;
}
// Tap on a game: one mode → start it at once; several modes (or not ready yet) → bottom sheet with the buttons.
export function openGame(key) {
  const card = cards.find(c => c.dataset.game === key);
  if (!visible(card)) return;
  const list = actions(card);
  if (list.length === 1 && !list[0].disabled) return list[0].click();
  closeSheet();
  sheetCard = card;
  sheet.firstChild.setAttribute('aria-label', title(card));
  sheet.firstChild.append(card);
  sheet.hidden = false;
}
function appTile(card, className) {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = className;
  tile.dataset.game = card.dataset.game;
  tile.setAttribute('role', 'listitem');
  tile.style.setProperty('--cover', card.style.getPropertyValue('--cover'));
  const icon = card.querySelector('.catalog-icon')?.cloneNode(true) || document.createElement('span');
  icon.removeAttribute('id');
  const name = document.createElement('span');
  name.className = 'app-name';
  name.textContent = SHORT[card.dataset.game] || title(card);
  tile.setAttribute('aria-label', title(card));
  tile.append(icon, name);
  tile.onclick = () => openGame(card.dataset.game);
  return tile;
}

// Back on the Giochi page with the game's icon briefly highlighted.
export function showGame(key) {
  const tile = document.querySelector(`#app-grid [data-game="${key}"]`);
  if (!tile) return;
  const tab = document.getElementById('tab-games');
  if (tab?.getAttribute('aria-selected') !== 'true') tab?.click();
  requestAnimationFrame(() => {
    tile.scrollIntoView({ block: 'center', behavior: 'smooth' });
    tile.classList.remove('flash');
    void tile.offsetWidth;
    tile.classList.add('flash');
  });
}
// Lobby favourites: same icons, and a tap opens the game directly.
function tiles(picks) {
  return picks
    .map(key => cards.find(c => c.dataset.game === key))
    .filter(visible)
    .map(card => appTile(card, 'game-tile'));
}
export function renderCatalog() {
  if (!cards.length) return;
  const state = read();
  // Cards stay at home, except the one shown in the bottom sheet.
  for (const card of cards)
    if (card !== sheetCard && card.parentElement !== homes.get(card)) homes.get(card).append(card);
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
    document.querySelector(`#app-grid [data-game="${card.dataset.game}"]`)?.classList.toggle('favourite', on);
  }
}
