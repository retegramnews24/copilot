// Blocco reciproco tra tavolo e Lobby: il tavolo, salvando una partita finita, mandava il risultato alla Lobby e
// restava bloccato ad aspettarla. Se intanto la Lobby (bloccata) chiamava quel tavolo, nessuno rispondeva per 30 s.
// Qui la Lobby non risponde mai: il salvataggio del tavolo deve finire lo stesso, e il risultato deve partire.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'table-result-'));
try {
  const out = join(dir, 'worker.mjs');
  await build({
    entryPoints: [resolve(process.env.TEST_WORKER || 'worker.js')],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    logLevel: 'silent',
    plugins: [
      {
        name: 'cloudflare-stub',
        setup(b) {
          b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'cf', namespace: 'stub' }));
          b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
            contents:
              'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }'
          }));
        }
      }
    ]
  });
  const { Room } = await import(pathToFileURL(out).href);
  const sent = [],
    kept = [];
  const lobby = {
    fetch(req) {
      sent.push(new URL(req.url).pathname);
      return new Promise(() => {}); // la Lobby è bloccata e non risponde
    }
  };
  const room = Object.create(Room.prototype);
  room.ctx = {
    storage: { put: async () => {}, deleteAlarm: async () => {}, setAlarm: async () => {} },
    waitUntil: p => kept.push(p),
    getWebSockets: () => []
  };
  room.env = { ROOMS: { idFromName: name => name, get: () => lobby } };
  const finished = {
    room: 'r1',
    game: 'connect4',
    mode: 'people',
    phase: 'finished',
    players: [
      { id: 'tg:1', name: 'Anna' },
      { id: 'tg:2', name: 'Bruno' }
    ],
    connect4: { result: '1-0' }
  };
  const done = await Promise.race([
    room.saveState(finished).then(() => 'salvato'),
    new Promise(r => setTimeout(() => r('bloccato'), 1000))
  ]);
  assert.equal(done, 'salvato', 'il tavolo non aspetta la Lobby');
  assert.deepEqual(sent, ['/lobby/result'], 'il risultato parte lo stesso');
  assert.equal(kept.length, 1, 'e il tavolo lo tiene in vita finché arriva');
  console.log(
    'PASS tavolo e Lobby: salvando una partita finita il tavolo non resta bloccato ad aspettare la Lobby.'
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
