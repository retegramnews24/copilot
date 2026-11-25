// Pagina Giochi (public/games-filter.js): ogni gioco finisce nei filtri giusti guardando i suoi tasti e la sezione,
// e la ricerca trova le parole anche senza accenti.
import assert from 'node:assert/strict';
import { kinds, matches } from '../public/games-filter.js';

// scheda finta: titolo, descrizione, tasti, se sta tra i giochi da tavolo
const card = (title, text, buttons, board = false) => ({
  querySelectorAll: () =>
    buttons.map(([label, kind]) => ({ textContent: label, dataset: kind ? { creationKind: kind } : {} })),
  querySelector: s => (s === 'h3' ? { textContent: title } : text == null ? null : { textContent: text }),
  closest: () => (board ? {} : null)
});
const lander = card('Lunar Lander 3D', 'Atterra sulla Luna', [['Singolo']]);
const cinema = card('Cinema Streamer', 'TV live in sale condivise', [['Apri una sala']]);
const moto = card('Moto Trial', '10 livelli', [['Singolo'], ['Multiplayer']]);
const chess = card(
  'Checkmate!',
  'Scacchi · 2 giocatori',
  [
    ['Singolo', 'solo'],
    ['Multiplayer', 'people']
  ],
  true
);
const acqua = card('Acquedotto!', "Gira le tessere e porta l'acqua dal rubinetto al vaso", [['Singolo']]);
// come il Golf in index.html: scheda senza descrizione
const golf = card('Golf with your gay friends', null, [['Singolo'], ['Multiplayer']]);

assert.deepEqual(kinds(lander), { solo: true, together: false, turns: false });
assert.deepEqual(kinds(cinema), { solo: false, together: true, turns: false });
assert.deepEqual(kinds(moto), { solo: true, together: true, turns: false });
assert.deepEqual(kinds(chess), { solo: true, together: true, turns: true });

const pick = (filter, query = '') =>
  [lander, cinema, moto, chess, acqua]
    .filter(c => matches(c, filter, query))
    .map(c => c.querySelector('h3').textContent);
assert.equal(pick('all').length, 5);
assert.deepEqual(pick('solo'), ['Lunar Lander 3D', 'Moto Trial', 'Checkmate!', 'Acquedotto!']);
assert.deepEqual(pick('together'), ['Cinema Streamer', 'Moto Trial', 'Checkmate!']);
assert.deepEqual(pick('turns'), ['Checkmate!']);
assert.deepEqual(pick('all', 'scacchi'), ['Checkmate!'], 'search in the description');
assert.deepEqual(pick('all', 'LUNA atterra'), ['Lunar Lander 3D'], 'any case, every word');
assert.deepEqual(pick('together', 'luna'), [], 'filter and search together');
assert.deepEqual(pick('all', 'acquedotto'), ['Acquedotto!']);
assert.ok(matches(golf, 'all', 'golf'), 'card without description is still found by its title');
for (const word of ['un', 'fine', 'def', 'undefined'])
  assert.ok(!matches(golf, 'all', word), `card without description must not match «${word}»`);

console.log(
  'PASS games filter: solo, together and turn-based from the card buttons, search without case or accents.'
);
