// Pagina Giochi: ricerca per nome e filtri «Da solo», «In compagnia», «A turni». Con più di 20 giochi sul telefono
// serviva un modo per trovarli. Il tipo di ogni gioco si ricava dalla scheda stessa, così un gioco nuovo entra da
// solo nel filtro giusto:
// - da solo: ha un tasto «Singolo» (o contro il computer);
// - in compagnia: ha un tasto che non è «Singolo» (Multiplayer, sala, scuderia online…);
// - a turni: sta tra i giochi da tavolo.
// Le icone filtrate prendono la classe filtered-out e non l'attributo hidden, che l'app usa per i giochi spenti.
const fold = s =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function kinds(card) {
  // solo i tasti del gioco (non la stellina dei preferiti), come games-catalog.js
  const buttons = [...card.querySelectorAll('.catalog-card-content button')].filter(b => !b.hidden);
  // «Gioca» (F1, Biliardo) apre una scelta con tutte e due le cose: contro il computer e con altri
  const label = b => b.textContent.trim();
  const solo = buttons.some(
    b => ['Singolo', 'Gioca'].includes(label(b)) || b.dataset.creationKind === 'solo'
  );
  const together = buttons.some(b => label(b) !== 'Singolo' && b.dataset.creationKind !== 'solo');
  const turns = !!card.closest('[aria-labelledby="catalog-board-title"]');
  return { solo, together, turns };
}

export function matches(card, filter, query) {
  const k = kinds(card);
  if (filter === 'solo' && !k.solo) return false;
  if (filter === 'together' && !k.together) return false;
  if (filter === 'turns' && !k.turns) return false;
  if (!query) return true;
  const text = fold(card.querySelector('h3')?.textContent + ' ' + card.querySelector('p')?.textContent);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every(word => text.includes(word));
}

export function initGamesFilter(doc = document) {
  const page = doc.getElementById?.('page-games'),
    search = doc.getElementById?.('games-search'),
    none = doc.getElementById?.('games-none');
  if (!page || !search) return null;
  const chips = [...page.querySelectorAll('[data-games-filter]')];
  let filter = 'all';
  const bar = search.closest('.games-filter');
  // la pagina mostra una griglia di icone (games-catalog.js); ogni icona ha accanto la sua scheda nascosta, con i
  // tasti da cui si capisce il tipo di gioco
  const cardOf = tile => doc.querySelector(`.catalog-card[data-game="${tile.dataset.game}"]`);
  function apply() {
    const query = search.value.trim(),
      grid = doc.getElementById('app-grid');
    if (!grid) return;
    if (bar && bar.nextElementSibling !== grid) grid.before(bar); // la ricerca sopra le icone
    let shown = 0;
    for (const tile of grid.querySelectorAll('.app-tile')) {
      const card = cardOf(tile),
        ok = !card || matches(card, filter, query);
      tile.classList.toggle('filtered-out', !ok);
      if (ok) shown++;
    }
    if (none) none.hidden = shown > 0;
  }
  for (const chip of chips)
    chip.addEventListener('click', () => {
      filter = chip.dataset.gamesFilter;
      for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
      apply();
    });
  search.addEventListener('input', apply);
  // la griglia si costruisce dopo: alla prima apertura della pagina Giochi la ricerca va sopra le icone
  doc.getElementById?.('tab-games')?.addEventListener?.('click', () => setTimeout(apply, 0));
  apply();
  return { apply };
}
