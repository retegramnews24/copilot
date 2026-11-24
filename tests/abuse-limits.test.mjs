// Freni e permessi dell'analisi (area 1, terzo gruppo): lavagne, tavoli, cinema, percorsi interni.
import assert from 'node:assert/strict';
import { canDeleteBoard, BOARD_LIMITS } from '../blackboard-server.js';
import { createTooFast, CREATE_LIMIT } from '../lobby-hub.js';
import { cinemaTooFast } from '../cinema-server.js';
import { internalHeaders, isInternal, INTERNAL_HEADER, INTERNAL_PATHS } from '../worker-shared.js';

// Lavagne: la numero 1 non si elimina mai; le altre solo chi le ha aperte (o nessuno le possiede).
assert.equal(canDeleteBoard({ number: 1, owner: 'tg:1' }, 'tg:1'), false);
assert.equal(canDeleteBoard({ number: 2, owner: 'tg:1' }, 'tg:1'), true);
assert.equal(canDeleteBoard({ number: 2, owner: 'tg:1' }, 'tg:2'), false);
assert.equal(canDeleteBoard({ number: 3 }, 'tg:2'), true, 'old boards without owner');
assert.equal(canDeleteBoard(null, 'tg:1'), false);
assert.ok(BOARD_LIMITS.perPerson >= 1 && BOARD_LIMITS.total > BOARD_LIMITS.perPerson);

// Tavoli: al massimo CREATE_LIMIT.count in una finestra, per persona; poi si riparte.
{
  const hub = {};
  const t = 1_000_000;
  for (let i = 0; i < CREATE_LIMIT.count; i++) assert.equal(createTooFast(hub, 'tg:1', t + i), false);
  assert.equal(createTooFast(hub, 'tg:1', t + 10), true, 'one too many');
  assert.equal(createTooFast(hub, 'tg:2', t + 10), false, 'others are not affected');
  assert.equal(createTooFast(hub, 'tg:1', t + CREATE_LIMIT.windowMs + 100), false, 'window over');
}

// Cinema: comandi a raffica rifiutati, sale nuove al massimo 2 al minuto.
{
  const socket = {};
  const t = 5_000_000;
  let refused = 0;
  for (let i = 0; i < 10; i++) if (cinemaTooFast(socket, 'playback', t + i)) refused++;
  assert.ok(refused > 0 && refused < 10, 'some commands pass, the flood does not');
  assert.equal(cinemaTooFast(socket, 'playback', t + 5000), false, 'a second later it works again');
  const other = {};
  assert.equal(cinemaTooFast(other, 'create', t), false);
  assert.equal(cinemaTooFast(other, 'create', t + 1000), false);
  assert.equal(cinemaTooFast(other, 'create', t + 2000), true, 'third room in a minute');
}

// Percorsi interni: valgono solo con la chiave derivata dal token del bot.
{
  const env = { BOT_TOKEN: '123:test-token' };
  const good = new Request('https://internal/lobby/result', {
    method: 'POST',
    headers: await internalHeaders(env)
  });
  assert.equal(await isInternal(good, env), true);
  assert.equal(await isInternal(new Request('https://internal/lobby/result'), env), false, 'no key');
  const forged = new Request('https://internal/lobby/result', { headers: { [INTERNAL_HEADER]: 'abc' } });
  assert.equal(await isInternal(forged, env), false, 'wrong key');
  assert.equal(await isInternal(good, { BOT_TOKEN: 'altro' }), false, 'other bot, other key');
  for (const p of ['/backup/import', '/lobby/result', '/notices/queue', '/pinball/remove'])
    assert.ok(INTERNAL_PATHS.has(p), p);
}

console.log('PASS Abuse limits: board owners, table and cinema rate limits, internal paths key.');
