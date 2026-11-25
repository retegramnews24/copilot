// Nomi dei giochi (analisi 9.2 e 9.3): ogni scheda della pagina Giochi ha la sua chiave scritta in index.html
// (data-game), la Lobby 3D la scrive a mano (public/lobby3d/lobby3d.js). Se le due non combaciano, la Lavagna
// sparisce dall'atrio e nasce un cabinato «sconosciuto» (difetto V1). Questa prova legge i file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RENAMED, migrateKeys } from '../public/games-catalog.js';

const read = path => readFileSync(new URL('../public/' + path, import.meta.url), 'utf8');
const html = read('index.html');
const lobby = read('lobby3d/lobby3d.js');
const catalog = read('games-catalog.js');

const articles = [...html.matchAll(/<article class="catalog-card[^"]*"([^>]*)>/g)];
assert.ok(articles.length >= 15, 'schede della pagina Giochi trovate in index.html: ' + articles.length);
const cards = articles.map(([tag, attrs]) => {
  const key = attrs.match(/data-game="([a-z0-9-]+)"/)?.[1];
  assert.ok(key, 'scheda senza data-game in index.html: ' + tag);
  return key;
});
const cardSet = new Set(cards);
assert.equal(cardSet.size, cards.length, 'due schede con lo stesso data-game');

const list = name => {
  const body = lobby.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];'))?.[1];
  assert.ok(body, name + ' trovato in lobby3d.js');
  return [...body.matchAll(/\[\s*'([a-z0-9-]+)'/g)].map(m => m[1]);
};
const arcade = list('ARCADE');
const board = list('BOARD');
const knownLine = lobby.match(
  /const known = new Set\(\[\.\.\.ARCADE,\.\.\.BOARD\][^\n]*?concat\(\[([^\]]*)\]\)/
)?.[1];
assert.ok(knownLine, 'elenco dei giochi conosciuti (known) trovato in lobby3d.js');
const extra = [...knownLine.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]);
const known = new Set([...arcade, ...board, ...extra]);

// 1. ogni gioco che la 3D conosce ha la sua scheda nella pagina Giochi
for (const key of known)
  assert.ok(cardSet.has(key), `la 3D usa «${key}» ma nessuna scheda di index.html ha data-game="${key}"`);

// 2. nessuna scheda finisce tra i cabinati sconosciuti della sala giochi
for (const key of cards)
  assert.ok(known.has(key), `la scheda «${key}» diventerebbe un cabinato sconosciuto nella 3D`);

// 3. ogni chiave scritta a mano altrove in lobby3d.js (avail.has, app.open) esiste tra le schede
for (const [, key] of lobby.matchAll(/(?:avail\.has|app\.open)\('([a-z0-9-]+)'\)/g))
  assert.ok(cardSet.has(key), `lobby3d.js cerca «${key}», che non è il data-game di nessuna scheda`);

// 4. i colori delle copertine usano chiavi vere
const covers = catalog.match(/const COVERS = \{([\s\S]*?)\};/)?.[1];
assert.ok(covers, 'COVERS trovato in games-catalog.js');
for (const [, key] of covers.matchAll(/^\s*'?([a-z0-9-]+)'?\s*:/gm))
  assert.ok(
    cardSet.has(key),
    `games-catalog.js dà un colore a «${key}», che non è il data-game di nessuna scheda`
  );

// 5. le chiavi vecchie portano a schede vere, e stella, ordine e «giocato da poco» passano alla chiave nuova
for (const [old, now] of Object.entries(RENAMED)) {
  assert.ok(!cardSet.has(old), `«${old}» è stato rinominato ma una scheda lo usa ancora`);
  assert.ok(
    cardSet.has(now),
    `«${old}» viene spostato su «${now}», che non è il data-game di nessuna scheda`
  );
}
const moved = migrateKeys({
  fav: ['uno', 'blackboard-spazio-libero'],
  order: ['blackboard-spazio-libero', 'pong', 'lavagna-spazio-libero'],
  recent: { 'blackboard-spazio-libero': 5, 'lavagna-spazio-libero': 3, pong: 1 }
});
assert.deepEqual(moved.fav, ['uno', 'lavagna-spazio-libero']);
assert.deepEqual(
  moved.order,
  ['lavagna-spazio-libero', 'pong'],
  'la chiave vecchia prende il suo posto, senza doppioni'
);
assert.deepEqual(moved.recent, { 'lavagna-spazio-libero': 5, pong: 1 });

console.log(
  `PASS game keys: ${cards.length} schede con data-game, ${known.size} giochi della Lobby 3D, colori e chiavi rinominate.`
);
