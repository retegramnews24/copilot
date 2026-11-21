// Run after Wrangler --dry-run: Biliardo online in the real worker (workerd, SQLite Durable Objects).
// /api/create opens the match with its specialty, the bell notice says which one, the second player starts it,
// shots are replayed by the server with the game's own physics, the Lobby shows the room, the creator closes it.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import * as E from '../public/biliardo/engine.js';

const directory = await mkdtemp(join(tmpdir(), 'binottoland-biliardo-')),
  bot = 'synthetic-test-bot',
  script = resolve(process.argv[2] || '.test-bundle/worker.js');
const mac = (k, v) => createHmac('sha256', k).update(v).digest('hex');
const token = id => {
  const user = { id: String(id), player: 'tg:' + id, name: 'Giocatore ' + id },
    payload = Buffer.from(
      JSON.stringify({ user, expires: Date.now() + 3600000, accessTag: mac(bot, 'telegram-session-v1') })
    ).toString('base64url');
  return 'session.' + payload + '.' + mac(bot, 'session.' + payload);
};
const mf = new Miniflare(
  convertV4MiniflareOptions({
    rootPath: dirname(script),
    modulesRoot: dirname(script),
    modules: true,
    scriptPath: script,
    compatibilityDate: '2026-11-04',
    durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
    resourcePersistencePath: directory,
    bindings: { BOT_TOKEN: bot, TURN_NOTIFY: 'false' },
    outboundService: async req => {
      assert(new URL(req.url).pathname.endsWith('/getChatMember'), 'unexpected call ' + req.url);
      return Response.json({ ok: true, result: { status: 'member' } });
    }
  })
);
const call = async (id, path, body) => {
  const res = await mf.dispatchFetch('https://unit.test' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + token(id), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

try {
  const made = await call(9001, '/api/create', {
    game: 'biliardo',
    variant: 'italiana',
    points: 25,
    cloth: 'blu'
  });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  const room = made.data.state.room;
  assert.equal(made.data.state.phase, 'waiting');
  assert.equal(made.data.state.opts.target, 25);
  // il panno scelto da chi crea arriva a tutti (anche a chi guarda)
  assert.equal((await call(9003, '/api/biliardo/' + room + '/state')).data.state.opts.cloth, 'blu');
  // bad specialty refused
  assert.notEqual((await call(9001, '/api/create', { game: 'biliardo', variant: 'bowling' })).status, 200);
  // the bell notice and the Lobby
  const lobby = (await call(9002, '/api/lobby')).data;
  const notice = lobby.notices.find(n => n.room === room);
  assert.match(notice.text, /Giocatore 9001 ha aperto Biliardo · sala \d+ · 5 birilli · cerca 1 giocatore/);
  const card = lobby.games.find(g => g.room === room);
  assert.equal(card.variant, 'italiana');
  assert.equal(card.capacity, 2);
  // the second player joins: full, the match starts by itself
  const joined = await call(9002, '/api/biliardo/' + room + '/join', {});
  assert.equal(joined.status, 200, JSON.stringify(joined.data));
  assert.equal(joined.data.state.phase, 'playing');
  assert.equal(
    (await call(9003, '/api/biliardo/' + room + '/join', {})).status,
    409,
    'third one only watches'
  );
  // a shot from who is on turn, replayed by the server like on the phone
  const st = joined.data.state,
    shooter = st.seats[st.match.cur],
    id = Number(shooter.slice(3)),
    other = id === 9001 ? 9002 : 9001;
  const shot = E.autoShot(st.match);
  assert.equal((await call(other, '/api/biliardo/' + room + '/play', shot)).status, 409, 'not your turn');
  const played = await call(id, '/api/biliardo/' + room + '/play', shot);
  assert.equal(played.status, 200, JSON.stringify(played.data));
  assert.equal(played.data.state.n, 1);
  const replay = JSON.parse(JSON.stringify(played.data.state.prev));
  E.playShot(replay, played.data.state.last.input);
  assert.deepEqual(replay.balls, played.data.state.match.balls, 'same table on the phone and in the worker');
  // unchanged state: nothing to download
  const same = await call(other, '/api/biliardo/' + room + '/state?after=' + played.data.state.revision);
  assert.equal(same.data.state, undefined);
  // only the creator closes a match in progress; then it is gone
  const owner = 9001;
  assert.equal((await call(9002, '/api/biliardo/' + room + '/close', {})).status, 403);
  assert.equal((await call(owner, '/api/biliardo/' + room + '/close', {})).status, 200);
  assert.equal((await call(owner, '/api/biliardo/' + room + '/state')).status, 404);
  assert.ok(!(await call(9002, '/api/lobby')).data.games.some(g => g.room === room));
  console.log(
    'PASS Biliardo runtime: create with specialty, notice, join and auto start, turn guard, server replay, close.'
  );
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
