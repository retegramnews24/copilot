// Run after Wrangler --dry-run (like table-ai-runtime): the real worker in workerd with SQLite Durable Objects,
// Telegram simulated. Time to move shortened to TURN_LIMIT_MS so reminder and timeout happen in seconds.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const LIMIT = 2500;
const directory = await mkdtemp(join(tmpdir(), 'binottoland-clock-')),
  bot = 'synthetic-test-bot',
  script = resolve(process.argv[2] || '.test-bundle/worker.js');
const mac = (k, v) => createHmac('sha256', k).update(v).digest('hex');
const token = id => {
  const user = { id: String(id), player: 'tg:' + id, name: 'Test ' + id },
    payload = Buffer.from(
      JSON.stringify({ user, expires: Date.now() + 3600000, accessTag: mac(bot, 'telegram-session-v1') })
    ).toString('base64url');
  return 'session.' + payload + '.' + mac(bot, 'session.' + payload);
};
const botMessages = [];
const mf = new Miniflare(
  convertV4MiniflareOptions({
    rootPath: dirname(script),
    modulesRoot: dirname(script),
    modules: true,
    scriptPath: script,
    compatibilityDate: '2026-11-04',
    durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
    resourcePersistencePath: directory,
    bindings: {
      BOT_TOKEN: bot,
      TURN_NOTICE_DELAY_MS: '0',
      TURN_QUIET_HOURS: 'off',
      TURN_LIMIT_MS: String(LIMIT)
    },
    outboundService: async req => {
      const path = new URL(req.url).pathname;
      if (path.endsWith('/sendMessage')) {
        botMessages.push(await req.json());
        return Response.json({ ok: true, result: {} });
      }
      assert(path.endsWith('/getChatMember'));
      return Response.json({ ok: true, result: { status: 'member' } });
    }
  })
);
async function call(id, path, body) {
  const res = await mf.dispatchFetch('https://unit.test' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + token(id), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: res.status, data: await res.json() };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function messageFor(chat, match, timeout = 15000) {
  for (let t = 0; t < timeout; t += 100) {
    const m = botMessages.find(x => x.chat_id === chat && match.test(x.text));
    if (m) return m;
    await wait(100);
  }
  assert.fail(
    'no bot message for ' +
      chat +
      ' matching ' +
      match +
      ': ' +
      JSON.stringify(botMessages.map(m => [m.chat_id, m.text]))
  );
}
async function stateUntil(id, room, test, timeout = 15000) {
  for (let t = 0; t < timeout; t += 200) {
    const s = (await call(id, '/api/room/' + room + '/state')).data;
    if (test(s)) return s;
    await wait(200);
  }
  assert.fail('state never reached for ' + room);
}

try {
  // Chess: the player on turn gets a reminder, then loses on time; the winner is told and it counts in the ranking.
  {
    const made = await call(6000, '/api/create', { game: 'chess' }),
      room = made.data.state.room;
    let s = (await call(6001, '/api/room/' + room + '/claim', {})).data.state;
    assert.ok(s.clock && s.clock.deadline > Date.now(), 'the clock runs once both are seated');
    s = (await call(6000, '/api/room/' + room + '/move', { from: 'e2', to: 'e4', revision: s.revision }))
      .data;
    const since = s.clock.since;
    const reminder = await messageFor(6001, /^⏳ Promemoria: tocca a te contro Test 6000 da 2 giorni/);
    assert.match(reminder.text, /partita è persa a tavolino/);
    assert.ok(Date.now() - since >= LIMIT - 200, 'not before the limit');
    const done = await stateUntil(6000, room, x => x.phase === 'finished');
    assert.equal(done.chess.result, '1-0');
    assert.equal(done.chess.reason, 'Tempo scaduto · Test 6000 vince a tavolino');
    await messageFor(6001, /^⌛ Tempo scaduto: hai perso a tavolino contro Test 6000/);
    await messageFor(6000, /^🏆 Test 6001 non ha mosso in tempo: vinci a tavolino/);
    assert.equal(
      botMessages.filter(m => m.chat_id === 6001 && /Promemoria/.test(m.text)).length,
      1,
      'one reminder'
    );
    const leaders = (await call(6000, '/api/leaderboard')).data.leaders;
    assert.equal(leaders.find(p => p.id === 'tg:6000')?.wins, 1);
    console.log('PASS runtime turn clock: chess reminder, loss on time, both told, counted in the ranking');
  }
  // A move in time restarts the clock: no reminder for the old turn.
  {
    const made = await call(6200, '/api/create', { game: 'connect4' }),
      room = made.data.state.room;
    let s = (await call(6201, '/api/room/' + room + '/claim', {})).data.state;
    await wait(LIMIT * 0.6);
    s = (await call(6200, '/api/room/' + room + '/move', { column: 3, revision: s.revision })).data;
    await wait(LIMIT * 0.6);
    s = (await call(6201, '/api/room/' + room + '/move', { column: 3, revision: s.revision })).data;
    await wait(LIMIT * 0.5);
    assert.equal(
      botMessages.filter(m => [6200, 6201].includes(m.chat_id) && /Promemoria|Tempo scaduto/.test(m.text))
        .length,
      0
    );
    assert.equal((await call(6200, '/api/room/' + room + '/state')).data.phase, 'playing');
    console.log('PASS runtime turn clock: moving in time restarts it');
  }
  // Scarabeo with three players: whoever runs out of time skips the turn, the game goes on.
  {
    const made = await call(6100, '/api/create', { game: 'scarabeo' }),
      room = made.data.state.room;
    for (const id of [6101, 6102])
      assert.equal((await call(id, '/api/room/' + room + '/claim', {})).status, 200);
    let s = (
      await call(6100, '/api/room/' + room + '/start', {
        revision: (await call(6100, '/api/room/' + room + '/state')).data.revision
      })
    ).data;
    const first = s.turn,
      firstId = 6100 + first;
    await messageFor(firstId, /^⏳ Promemoria: .* Se non giochi entro 2 giorni salti il turno/);
    s = await stateUntil(6100, room, x => x.turn !== first);
    assert.equal(s.phase, 'playing');
    assert.match(s.moves.at(-1).description, /salta il turno: tempo scaduto/);
    await messageFor(firstId, /^⌛ Tempo scaduto: hai saltato il turno/);
    console.log('PASS runtime turn clock: Scarabeo in three skips the turn');
  }
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
