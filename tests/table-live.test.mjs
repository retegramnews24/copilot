// Partita vera sul tavolo 3D (public/lobby3d/table-live.js): quale partita si mostra e quando ci si collega.
import assert from 'node:assert/strict';
import { pickTable, createTableLive } from '../public/lobby3d/table-live.js';

globalThis.location = { origin: 'https://club.test' };
const g = (room, extra) => ({
  room,
  game: 'connect4',
  phase: 'playing',
  mode: 'people',
  players: [],
  expires: 0,
  ...extra
});

// la mia prima di tutto, anche se un'altra ha mosso dopo
const games = [
  g('a', { expires: 300, players: [{ id: 'x' }, { id: 'y' }] }),
  g('b', { expires: 100, players: [{ id: 'me' }, { id: 'y' }] }),
  g('c', { expires: 900, mode: 'ai', players: [{ id: 'z' }, { id: 'bot', bot: true }] }),
  g('d', { expires: 999, phase: 'finished' }),
  g('e', { expires: 999, game: 'chess' })
];
assert.equal(pickTable(games, 'me', 'connect4').room, 'b');
// se no l'ultima mossa; le partite degli altri contro l'AI, quelle finite e gli altri giochi no
assert.equal(pickTable(games, 'nobody', 'connect4').room, 'a');
// la mia anche contro l'AI
assert.equal(pickTable(games, 'z', 'connect4').room, 'c');
assert.equal(pickTable([], 'me', 'connect4'), null);
assert.equal(pickTable(null, null, 'connect4'), null);

// collegamento: si apre solo vicino, con ?look=1; lontano si chiude; senza partite la griglia torna vuota
let list = [g('a', { players: [{ id: 'x' }] })];
const opened = [],
  shown = [];
const fake = url => {
  const s = {
    url,
    closed: false,
    close() {
      this.closed = true;
    },
    send() {}
  };
  opened.push(s);
  return s;
};
const live = createTableLive({
  games: () => list,
  player: () => 'me',
  token: () => 't',
  onState: (game, s) => shown.push([game, s?.room ?? null]),
  open: fake
});
live.watch(false);
assert.equal(opened.length, 0, 'lontano: nessun collegamento');
live.watch(true);
assert.equal(opened.length, 1);
assert.equal(opened[0].url, 'wss://club.test/api/room/a/ws?look=1');
live.watch(true);
assert.equal(opened.length, 1, 'stessa partita: stesso collegamento');
opened[0].onmessage({ data: JSON.stringify({ room: 'a', connect4: { board: [] } }) });
assert.deepEqual(shown.at(-1), ['connect4', 'a']);
opened[0].onmessage({ data: JSON.stringify({ room: 'other' }) });
assert.equal(shown.length, 1, 'pacchetti di un altro tavolo ignorati');
// partita cambiata: chiude la vecchia e apre la nuova
list = [g('b', { players: [{ id: 'me' }] }), ...list];
live.watch(true);
assert.ok(opened[0].closed);
assert.equal(opened.length, 2);
assert.equal(opened[1].url, 'wss://club.test/api/room/b/ws?look=1');
// tavolo eliminato: griglia vuota
opened[1].onmessage({ data: JSON.stringify({ room: 'b', deleted: true }) });
assert.deepEqual(shown.at(-1), ['connect4', null]);
assert.ok(opened[1].closed);
// lontano dal tavolo: chiuso
list = [g('a', { players: [{ id: 'x' }] })];
live.watch(true);
assert.equal(opened.length, 3);
live.watch(false);
assert.ok(opened[2].closed);
// chiuso dal server: si riprova solo dopo qualche secondo
live.watch(true);
assert.equal(opened.length, 4);
opened[3].onmessage({ data: JSON.stringify({ room: 'a', connect4: { board: [] } }) });
opened[3].onclose();
live.watch(true);
assert.equal(opened.length, 4, 'niente nuovo tentativo subito');
// nessuna partita: una sola volta "vuota"
list = [];
const before = shown.length;
live.watch(true);
live.watch(true);
assert.equal(shown.length, before + 1);
assert.deepEqual(shown.at(-1), ['connect4', null]);
console.log('table-live: ok');
