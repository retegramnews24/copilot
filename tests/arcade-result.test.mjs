// Le vittorie delle sale arcade (Biliardo, F1 on paper!, Golf) devono arrivare alla Lobby con la chiave interna.
// La Lobby accetta "/lobby/result" solo così (worker-shared.js, INTERNAL_PATHS): senza chiave risponde "non trovato"
// e la vittoria non entra né in classifica né negli avvisi. Qui una finta Lobby fa lo stesso controllo di quella vera.
import assert from 'node:assert/strict';
import { isInternal, INTERNAL_PATHS } from '../worker-shared.js';
import { BiliardoRoom } from '../biliardo-server.js';
import { F1Room } from '../f1-server.js';
import { GolfRoom } from '../golf-server.js';

const env = { BOT_TOKEN: '123:test-token' };
const recorded = [],
  refused = [];
const lobby = {
  async fetch(url, init) {
    const req = new Request(url, init),
      path = new URL(req.url).pathname;
    if (INTERNAL_PATHS.has(path) && !(await isInternal(req, env))) {
      refused.push(path);
      return Response.json({ error: 'Percorso non trovato.' }, { status: 404 });
    }
    if (path === '/lobby/result') recorded.push(await req.json());
    return Response.json({ ok: true });
  }
};
env.ROOMS = { idFromName: name => name, get: () => lobby };

const winners = [{ id: 'tg:1', name: 'Anna' }];
for (const [Room, game] of [
  [BiliardoRoom, 'biliardo'],
  [F1Room, 'f1'],
  [GolfRoom, 'golf']
]) {
  const room = new Room({}, env);
  room.summary = () => ({ room: 'r-' + game, revision: 2 }); // qui interessa solo il risultato
  await room.update({ room: 'r-' + game, phase: 'finished', winners });
}
assert.deepEqual(refused, [], 'nessuna richiesta rifiutata dalla Lobby');
assert.deepEqual(
  recorded.map(r => [r.key, r.game, r.mode, r.winners[0].name]),
  [
    ['r-biliardo:biliardo', 'biliardo', 'people', 'Anna'],
    ['r-f1:f1', 'f1', 'people', 'Anna'],
    ['r-golf:golf', 'golf', 'people', 'Anna']
  ]
);
console.log(
  'PASS sale arcade: le vittorie di Biliardo, F1 e Golf arrivano alla Lobby con la chiave interna.'
);
