// Nomi dei giochi (analisi 9.3): la pagina Giochi ricava la chiave di ogni gioco dal titolo della scheda
// (public/games-catalog.js), la Lobby 3D la scrive a mano (public/lobby3d/lobby3d.js). Se un titolo cambia e la 3D
// no, la Lavagna sparisce dall'atrio e nasce un cabinato «sconosciuto» (difetto V1). Questa prova legge i due file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../public/' + path, import.meta.url), 'utf8');
const html = read('index.html');
const lobby = read('lobby3d/lobby3d.js');
const catalog = read('games-catalog.js');

// stessa funzione di games-catalog.js
const slug = text =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const unescape = text =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const cards = [...html.matchAll(/<article class="catalog-card[^"]*"[\s\S]*?<h3>([\s\S]*?)<\/h3>/g)].map(m =>
  slug(unescape(m[1].replace(/<[^>]*>/g, '')))
);
assert.ok(cards.length >= 15, 'schede della pagina Giochi trovate in index.html: ' + cards.length);
const cardSet = new Set(cards);

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
  assert.ok(cardSet.has(key), `la 3D usa «${key}» ma nessuna scheda di index.html ha quel titolo`);

// 2. nessuna scheda finisce tra i cabinati sconosciuti della sala giochi
for (const key of cards)
  assert.ok(known.has(key), `la scheda «${key}» diventerebbe un cabinato sconosciuto nella 3D`);

// 3. ogni chiave scritta a mano altrove in lobby3d.js (avail.has, app.open) esiste tra le schede
for (const [, key] of lobby.matchAll(/(?:avail\.has|app\.open)\('([a-z0-9-]+)'\)/g))
  assert.ok(cardSet.has(key), `lobby3d.js cerca «${key}», che non è il titolo di nessuna scheda`);

// 4. i colori delle copertine usano chiavi vere
const covers = catalog.match(/const COVERS = \{([\s\S]*?)\};/)?.[1];
assert.ok(covers, 'COVERS trovato in games-catalog.js');
for (const [, key] of covers.matchAll(/^\s*'?([a-z0-9-]+)'?\s*:/gm))
  assert.ok(
    cardSet.has(key),
    `games-catalog.js dà un colore a «${key}», che non è il titolo di nessuna scheda`
  );

console.log(
  `PASS game keys: ${cards.length} schede, ${known.size} giochi della Lobby 3D e i colori combaciano.`
);
