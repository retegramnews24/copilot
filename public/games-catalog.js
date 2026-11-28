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
  'f1-on-paper': '#0b6b3a',
  'ruggine-89': '#b5651d',
  pong: '#5bc0be',
  'golf-with-your-gay-friends': '#4caf50',
  'giulio-simulator': '#3a7bd5',
  'binotto-simulator': '#ffd236',
  'number-connect': '#f0a202',
  acquedotto: '#2f8fd8',
  'cinema-streamer': '#d64575',
  'lavagna-spazio-libero': '#6c8a6b'
};
const slug = text =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
// Keys of renamed games: the ★, the order and "recently played" saved on the phone move to the new key.
export const RENAMED = { 'blackboard-spazio-libero': 'lavagna-spazio-libero' };
export function migrateKeys(state) {
  const to = key => RENAMED[key] || key;
  const unique = list => [...new Set((list || []).map(to))];
  const recent = {};
  for (const [key, at] of Object.entries(state.recent || {})) recent[to(key)] = Math.max(recent[to(key)] || 0, at);
  return { ...state, fav: unique(state.fav), order: unique(state.order), recent };
}
const read = () => {
  try {
    // order: the Giochi icons in the order chosen by dragging (this device only).
    return migrateKeys({ fav: [], recent: {}, order: [], ...JSON.parse(localStorage.getItem(STORE) || '{}') });
  } catch {
    return { fav: [], recent: {}, order: [] };
  }
};
const write = value => {
  try {
    localStorage.setItem(STORE, JSON.stringify(value));
  } catch {}
};
const homes = new Map();
let cards = [];
// Giochi a gettone (docs/gettoni.md): i tasti che fanno partire il gioco («Singolo», «Multiplayer», «Gioca»…,
// id play-… e create-…) chiedono prima il gettone a payGate(chiave); senza gettoni il tasto non fa niente.
// Dalla Lobby 3D il gettone è già pagato: openGame(chiave, {paid: true}).
let payGate = () => true,
  paidKey = null;
export function setPayGate(fn) {
  payGate = fn;
}
export function markCoinButtons(isCoin) {
  for (const card of cards)
    if (isCoin(card.dataset.game))
      for (const b of card.querySelectorAll('button[id^="play-"], button[id^="create-"]'))
        if (!b.querySelector('.coin-cost')) {
          const cost = document.createElement('small');
          cost.className = 'coin-cost';
          cost.textContent = ' · 1 gettone';
          b.append(cost);
        }
}

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
    // The key is written in the card (data-game in index.html): renaming a game no longer changes it.
    const key = card.dataset.game || slug(title);
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
    // gettone prima del gioco: si controlla prima che il tasto faccia partire il gioco (fase di cattura)
    card.addEventListener(
      'click',
      event => {
        if (!event.target.closest('button[id^="play-"], button[id^="create-"]')) return;
        if (paidKey === key) return void (paidKey = null);
        if (!payGate(key)) {
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      },
      true
    );
    // Any real action on the card counts as "played".
    card.addEventListener('click', event => {
      if (!event.target.closest('button') || event.target.closest('.fav-toggle')) return;
      const state = read();
      state.recent[key] = Date.now();
      write(state);
      renderCatalog();
    });
  }
  buildAppGrid(page);
  renderCatalog();
}

// Android-style Giochi page: one grid of square icons with the game's name (two lines). The original cards stay in
// the page (hidden) and are moved into a bottom sheet when needed, so buttons keep ids and handlers.
// Tap: open the game (or the sheet when it has several modes). Long press: sheet with the ★. Long press and move:
// drag the icon; the order is saved on this device.
const LONG_PRESS = 450;
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
  const order = read().order || [],
    rank = card => {
      const i = order.indexOf(card.dataset.game);
      return i < 0 ? order.length + cards.indexOf(card) : i;
    };
  grid.append(
    ...cards
      .filter(visible)
      .sort((a, b) => rank(a) - rank(b))
      .map(card => appTile(card, 'app-tile'))
  );
  page.prepend(grid);
  enableDrag(grid);
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
export function openGame(key, { options = false, paid = false } = {}) {
  const card = cards.find(c => c.dataset.game === key);
  if (!visible(card)) return;
  paidKey = paid ? key : null;
  const list = actions(card);
  if (!options && list.length === 1 && !list[0].disabled) return list[0].click();
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
  name.textContent = title(card);
  tile.append(icon, name);
  tile.onclick = () => {
    if (tile.dataset.held) return delete tile.dataset.held;
    openGame(card.dataset.game);
  };
  return tile;
}
// Long press → options sheet (with ★); long press then move → drag to a new place.
function enableDrag(grid) {
  let tile = null,
    timer = 0,
    start = null,
    lifted = false,
    dragged = false;
  const reset = () => {
    clearTimeout(timer);
    if (tile) {
      tile.classList.remove('lifted', 'dragging');
      tile.style.transform = '';
    }
    tile = null;
    lifted = dragged = false;
  };
  grid.addEventListener('pointerdown', event => {
    const target = event.target.closest('.app-tile');
    if (!target || event.button > 0) return;
    reset();
    tile = target;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      lifted = true;
      tile.classList.add('lifted');
      try {
        tile.setPointerCapture(event.pointerId);
        navigator.vibrate?.(15);
      } catch {}
    }, LONG_PRESS);
  });
  grid.addEventListener('pointermove', event => {
    if (!tile) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (!lifted) {
      if (Math.hypot(dx, dy) > 10) reset(); // scrolling, not a long press
      return;
    }
    if (!dragged && Math.hypot(dx, dy) < 8) return;
    dragged = true;
    tile.classList.add('dragging');
    tile.style.transform = `translate(${dx}px, ${dy}px)`;
    // Move the tile in the grid under the finger, keeping it under the finger visually.
    tile.style.visibility = 'hidden';
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('.app-tile');
    tile.style.visibility = '';
    if (over && over !== tile && over.parentElement === grid) {
      const before = tile.getBoundingClientRect();
      const tiles = [...grid.children];
      grid.insertBefore(tile, tiles.indexOf(over) > tiles.indexOf(tile) ? over.nextSibling : over);
      const after = tile.getBoundingClientRect();
      start = { x: start.x + after.left - before.left, y: start.y + after.top - before.top };
      tile.style.transform = `translate(${event.clientX - start.x}px, ${event.clientY - start.y}px)`;
    }
  });
  const finish = () => {
    if (!tile) return;
    const held = tile;
    if (lifted) held.dataset.held = '1'; // swallow the click that follows the long press
    if (dragged) {
      const state = read();
      state.order = [...grid.querySelectorAll('.app-tile')].map(t => t.dataset.game);
      write(state);
    } else if (lifted) openGame(held.dataset.game, { options: true });
    reset();
    setTimeout(() => delete held.dataset.held, 400);
  };
  grid.addEventListener('pointerup', finish);
  grid.addEventListener('pointercancel', reset);
  // While an icon is lifted the page must not scroll, and no system menu should appear.
  grid.addEventListener(
    'touchmove',
    event => {
      if (lifted) event.preventDefault();
    },
    { passive: false }
  );
  grid.addEventListener('contextmenu', event => {
    event.preventDefault();
    const target = event.target.closest('.app-tile');
    if (target && event.pointerType !== 'touch' && !lifted) openGame(target.dataset.game, { options: true });
  });
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
