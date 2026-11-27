// Run after Wrangler --dry-run: F1 on paper! online in the real worker (workerd, SQLite Durable Objects).
// A big drawn track goes through /api/create, the bell notice says how many drivers are wanted,
// the race starts by itself when full, moves are checked, and the Lobby shows the race.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import * as R from '../public/gara/rules.js';

const directory = await mkdtemp(join(tmpdir(), 'binottoland-f1-')),
  bot = 'synthetic-test-bot',
  script = resolve(process.argv[2] || '.test-bundle/worker.js');
const mac = (k, v) => createHmac('sha256', k).update(v).digest('hex');
const token = id => {
  const user = { id: String(id), player: 'tg:' + id, name: 'Pilota ' + id },
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
// a big track: many points, like one drawn with the finger (0.5 cell apart)
const C = 500; // dentro la griglia del gioco, come una pista vera
const ring = (rx, ry, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((i - 0.5) / n) * Math.PI * 2;
    return {
      x: C + Math.round(Math.cos(a) * rx * 100) / 100,
      y: C + Math.round(Math.sin(a) * ry * 100) / 100
    };
  });
const track = {
  outer: ring(120, 80, 1300),
  inner: ring(108, 68, 1100),
  finish: { a: { x: C + 108, y: C }, b: { x: C + 120, y: C }, outerSeg: 0, innerSeg: 0 },
  normal: { x: 0, y: 1 },
  players: 2
};

try {
  const big = await call(8001, '/api/create', { game: 'f1', track, laps: 1, time: 'sunset' });
  assert.equal(big.status, 200, JSON.stringify(big.data));
  assert.ok(JSON.stringify({ game: 'f1', track }).length > 50000, 'the track is really big');
  const room = big.data.state.room;
  assert.equal(big.data.state.phase, 'waiting');
  // una pista sbagliata si ferma in api.js, prima del blocco della Lobby (analisi 10.3)
  const far = { ...track.finish, a: { x: C - 4000, y: C }, b: { x: C + 4000, y: C } };
  const bad = await call(8001, '/api/create', { game: 'f1', track: { ...track, finish: far }, laps: 1 });
  assert.equal(bad.status, 400, JSON.stringify(bad.data));
  assert.match(bad.data.error, /Linea di partenza/);
  // other games keep the small limit
  const huge = await call(8001, '/api/create', { game: 'golf', pad: 'x'.repeat(5000) });
  assert.equal(huge.status, 413);
  // the bell notice and the Lobby
  const lobby = (await call(8002, '/api/lobby')).data;
  const notice = lobby.notices.find(n => n.room === room);
  assert.match(
    notice.text,
    /Pilota 8001 ha aperto F1 on paper! · sala \d+ · cerca 1 pilota \(2 auto, 1 giro\)/
  );
  assert.equal(lobby.games.find(g => g.room === room).capacity, 2);
  // the track for the phones
  const got = await call(8002, '/api/f1/' + room + '/track');
  assert.equal(got.data.track.outer.length, 1300);
  // the second driver joins: full, the race starts by itself (guest first on the line)
  const joined = await call(8002, '/api/f1/' + room + '/join', {});
  assert.equal(joined.status, 200, JSON.stringify(joined.data));
  assert.equal(joined.data.state.phase, 'place');
  assert.deepEqual(joined.data.state.seats, ['tg:8002', 'tg:8001']);
  // a third one can only watch
  assert.equal((await call(8003, '/api/f1/' + room + '/join', {})).status, 409);
  assert.equal((await call(8003, '/api/f1/' + room + '/state')).status, 200);
  // turns
  const t = got.data.track;
  assert.equal((await call(8001, '/api/f1/' + room + '/play', { x: 0, y: 0 })).status, 409, 'not your turn');
  const slot = R.placeable({ ...joined.data.state.race, track: t })[0];
  const placed = await call(8002, '/api/f1/' + room + '/play', { x: slot.x, y: slot.y });
  assert.equal(placed.status, 200, JSON.stringify(placed.data));
  assert.equal(placed.data.state.moves.length, 1);
  // unchanged state: nothing to download
  const same = await call(8001, '/api/f1/' + room + '/state?after=' + placed.data.state.revision);
  assert.equal(same.data.state, undefined);
  // the second car on the line, then the race: both choose at the same time, the cars move together
  const slot2 = R.placeable({ ...placed.data.state.race, track: t })[0];
  const placed2 = await call(8001, '/api/f1/' + room + '/play', { x: slot2.x, y: slot2.y });
  assert.equal(placed2.data.state.phase, 'race');
  const choose = async (id, state, i) => {
    const o = R.roundOptions({ ...state.race, track: t }, i).find(x => !x.crash);
    return call(id, '/api/f1/' + room + '/play', { x: o.x, y: o.y });
  };
  const first = await choose(8001, placed2.data.state, 1);
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.state.moves.length, 2, 'nobody moves before the last choice');
  assert.deepEqual(first.data.state.chosen, [false, true]);
  assert.equal(first.data.state.pending, undefined, 'the choice of the others stays secret');
  const second = await choose(8002, first.data.state, 0);
  assert.equal(second.data.state.moves.at(-1).kind, 'round');
  assert.deepEqual(second.data.state.chosen, [false, false]);
  // solo le mosse nuove attraverso api.js (analisi 10.4)
  const all = second.data.state.moves.length;
  const light = await call(8001, '/api/f1/' + room + '/state?moves=' + (all - 1));
  assert.equal(light.data.state.movesFrom, all - 1);
  assert.equal(light.data.state.moves.length, 1, 'only the last move');
  assert.ok(
    light.data.state.race.cars.every(c => c.path === undefined),
    'no paths'
  );
  // «Abbandona la gara» passa da api.js e arriva al gioco (analisi 10.1: prima era «Indirizzo sconosciuto»)
  const left = await call(8002, '/api/f1/' + room + '/abandon', {});
  assert.equal(left.status, 200, JSON.stringify(left.data));
  assert.deepEqual(left.data.state.gone, ['tg:8002'], 'the server knows who abandoned');
  assert.equal(
    (await call(8003, '/api/f1/' + room + '/abandon', {})).status,
    409,
    'who watches cannot abandon'
  );
  // the creator closes the race: gone from the Lobby
  assert.equal(
    (await call(8002, '/api/f1/' + room + '/close', {})).status,
    403,
    'only the creator while racing'
  );
  assert.equal((await call(8001, '/api/f1/' + room + '/close', {})).status, 200);
  assert.equal((await call(8001, '/api/f1/' + room + '/state')).status, 404);
  assert.ok(!(await call(8002, '/api/lobby')).data.games.some(g => g.room === room));
  // con un bot: chi crea lo sceglie, lo cambia in sala d'attesa; il bot mette l'auto e sceglie da solo
  const withBot = await call(8001, '/api/create', { game: 'f1', track, laps: 1, bots: 1 });
  assert.equal(withBot.status, 200, JSON.stringify(withBot.data));
  const room2 = withBot.data.state.room;
  assert.equal(withBot.data.state.bots, 1);
  const inLobby = (await call(8002, '/api/lobby')).data.games.find(g => g.room === room2);
  assert.equal(inLobby.capacity, 1, 'for the Lobby the seats are the people’s');
  assert.equal(inLobby.bots, 1);
  assert.equal((await call(8002, '/api/f1/' + room2 + '/join', {})).status, 409, 'full with the bot');
  assert.equal((await call(8002, '/api/f1/' + room2 + '/bots', { bots: 0 })).status, 409, 'only the creator');
  const noBot = await call(8001, '/api/f1/' + room2 + '/bots', { bots: 0 });
  assert.equal(noBot.status, 200, JSON.stringify(noBot.data));
  assert.equal(noBot.data.state.bots, 0);
  await call(8001, '/api/f1/' + room2 + '/bots', { bots: 1 });
  const go = await call(8001, '/api/f1/' + room2 + '/start', {});
  assert.deepEqual(go.data.state.seats, ['tg:8001', 'bot:1']);
  const slot3 = R.placeable({ ...go.data.state.race, track: t })[0];
  const onLine = await call(8001, '/api/f1/' + room2 + '/play', { x: slot3.x, y: slot3.y });
  assert.equal(onLine.data.state.phase, 'race', 'the bot has put its car on the line');
  assert.deepEqual(onLine.data.state.chosen, [false, true], 'the bot has already chosen');
  const o = R.roundOptions({ ...onLine.data.state.race, track: t }, 0).find(x => !x.crash);
  const mine = await call(8001, '/api/f1/' + room2 + '/play', { x: o.x, y: o.y });
  assert.equal(mine.status, 200, JSON.stringify(mine.data));
  assert.equal(mine.data.state.moves.at(-1).kind, 'round', 'the creator chooses: the cars move');
  assert.equal((await call(8001, '/api/f1/' + room2 + '/close', {})).status, 200);
  console.log(
    'PASS F1 runtime: big track create, small limit for others, notice, join, auto start, moves together, bots, close.'
  );
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
