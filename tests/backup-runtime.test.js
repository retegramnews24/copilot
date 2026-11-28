// Run after Wrangler --dry-run: the real worker in workerd with SQLite Durable Objects, Telegram simulated.
// Backup and restore of real data, admin protection, weekly cron, and error reports from the app.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const ADMIN = 'test-admin-token-0123456789abcdef';
const directory = await mkdtemp(join(tmpdir(), 'binottoland-backup-')),
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
const documents = [];
const mf = new Miniflare(
  convertV4MiniflareOptions({
    rootPath: dirname(script),
    modulesRoot: dirname(script),
    modules: true,
    scriptPath: script,
    compatibilityDate: '2026-11-04',
    durableObjects: { ROOMS: { className: 'Room', useSQLite: true } },
    resourcePersistencePath: directory,
    bindings: { BOT_TOKEN: bot, ADMIN_TOKEN: ADMIN, BACKUP_CHAT_ID: '424242', TURN_NOTIFY: 'false' },
    outboundService: async req => {
      const path = new URL(req.url).pathname;
      if (path.endsWith('/sendDocument')) {
        const form = await req.formData();
        documents.push({
          chat: form.get('chat_id'),
          caption: form.get('caption'),
          file: await form.get('document').text()
        });
        return Response.json({ ok: true, result: {} });
      }
      assert(path.endsWith('/getChatMember'), 'unexpected call ' + path);
      // 8888 ha creato il gruppo: è il proprietario (Impostazioni → Backup)
      const { user_id } = await req.json();
      return Response.json({ ok: true, result: { status: user_id === 8888 ? 'creator' : 'member' } });
    }
  })
);
const leagued = new Set(); // tavoli: prima l'iscrizione alla Lega Giochi (docs/gettoni.md)
const call = async (id, path, body) => {
  if (id && body !== undefined && (path === '/api/create' || /\/claim$/.test(path)) && !leagued.has(id)) {
    leagued.add(id);
    await mf.dispatchFetch('https://unit.test/api/league', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token(id), 'Content-Type': 'application/json' },
      body: '{}'
    });
  }
  const res = await mf.dispatchFetch('https://unit.test' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(id ? { Authorization: 'Bearer ' + token(id) } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: res.status, data: res.status === 204 ? null : await res.json().catch(() => null) };
};
const admin = async (path, method = 'GET', body, secret = ADMIN) => {
  const res = await mf.dispatchFetch('https://unit.test/api/admin/backups' + path, {
    method,
    headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: res.status, text: await res.text() };
};
const wait = ms => new Promise(r => setTimeout(r, ms));

try {
  // Admin pages do not exist without the right key.
  assert.equal((await admin('', 'GET', undefined, 'wrong-token-wrong-token-wrong')).status, 404);
  assert.equal((await call(7000, '/api/admin/backups')).status, 404, 'a player session is not enough');

  // Real data: a table with a move, a notice preference.
  const made = await call(7000, '/api/create', { game: 'chess' }),
    room = made.data.state.room;
  let s = (await call(7001, '/api/room/' + room + '/claim', {})).data.state;
  s = (await call(7000, '/api/room/' + room + '/move', { from: 'e2', to: 'e4', revision: s.revision })).data;
  await call(7001, '/api/notices', { enabled: false });

  // Backup now: stored, listed, downloadable, and sent privately by the bot.
  const run = JSON.parse((await admin('', 'POST')).text);
  assert.ok(run.objects >= 3, 'lobby, table and notices saved: ' + JSON.stringify(run));
  assert.equal(run.sent, true);
  assert.equal(documents.length, 1);
  assert.equal(documents[0].chat, '424242');
  assert.match(documents[0].caption, /Backup Binottoland/);
  const list = JSON.parse((await admin('')).text);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, run.id);
  const file = JSON.parse((await admin('/' + run.id)).text);
  assert.equal(file.format, 'binottoland-backup-1');
  assert.ok(file.objects[room], 'the table is in the backup');
  assert.ok(file.objects['checkmate-lobby-v1']);
  assert.equal(documents[0].file, JSON.stringify(file), 'the Telegram copy is the same file');

  // Damage: the table is deleted.
  assert.equal((await call(7000, '/api/room/' + room + '/delete', { revision: s.revision })).status, 200);
  assert.equal((await call(7000, '/api/room/' + room + '/state')).status, 404);

  // Restore: the table and the Lobby come back as they were.
  const restored = JSON.parse((await admin('/' + run.id + '/restore', 'POST', {})).text);
  assert.ok(restored.restored.includes(room) && restored.restored.includes('checkmate-lobby-v1'));
  await wait(300);
  const back = await call(7000, '/api/room/' + room + '/state');
  assert.equal(back.status, 200);
  assert.equal(back.data.moves.length, 1);
  assert.equal(back.data.moves[0].san, 'e4');
  assert.ok(
    (await call(7000, '/api/lobby')).data.games.some(g => g.room === room),
    'listed again in the Lobby'
  );
  assert.equal((await call(7001, '/api/notices')).data.enabled, false, 'preferences restored too');
  // Only some archives.
  const partial = JSON.parse((await admin('/' + run.id + '/restore', 'POST', { objects: [room] })).text);
  assert.deepEqual(partial.restored, [room]);
  assert.equal((await admin('/nonexistent-id-123/restore', 'POST', {})).status, 404);

  // The weekly cron makes a backup by itself.
  const worker = await mf.getWorker();
  await worker.scheduled({ cron: '0 3 * * 1' });
  await wait(500);
  assert.equal(JSON.parse((await admin('')).text).length, 2);
  assert.equal(documents.at(-1).chat, '424242', 'the weekly copy still goes to BACKUP_CHAT_ID');
  console.log(
    'PASS runtime backup: admin key required, snapshot stored/listed/downloaded/sent, delete then restore (all or some), weekly cron'
  );

  // From the app (Impostazioni → Backup): only the owner (the group creator, no OWNER_ID here).
  assert.equal((await call(7000, '/api/backup')).status, 404, 'a member does not see it');
  assert.equal((await call(7000, '/api/backup/run', {})).status, 404);
  assert.equal((await call(7000, '/api/backup/' + run.id + '/restore', {})).status, 404);
  const mine = await call(8888, '/api/backup');
  assert.equal(mine.status, 200);
  assert.equal(mine.data.length, 2);
  const now = await call(8888, '/api/backup/run', {});
  assert.equal(now.data.sent, true);
  assert.equal(documents.at(-1).chat, '8888', 'the bot sends it to the owner');
  assert.equal(JSON.parse(documents.at(-1).file).format, 'binottoland-backup-1');
  const again = await call(8888, '/api/backup/' + run.id + '/send', {});
  assert.deepEqual(again.data, { id: run.id, sent: true });
  assert.equal(documents.at(-1).chat, '8888');
  assert.equal((await call(8888, '/api/backup/nonexistent-id-123/send', {})).status, 404);
  // restore from the app: the table deleted again comes back
  s = (await call(7000, '/api/room/' + room + '/state')).data;
  assert.equal((await call(7000, '/api/room/' + room + '/delete', { revision: s.revision })).status, 200);
  const fromApp = await call(8888, '/api/backup/' + run.id + '/restore', {});
  assert.ok(fromApp.data.restored.includes(room));
  await wait(300);
  assert.equal((await call(7000, '/api/room/' + room + '/state')).status, 200);
  console.log('PASS runtime backup from the app: owner only, copy sent to the owner, send again, restore');

  // Errors reported by the app: logged, at most 10 a minute per person, only when signed in.
  assert.equal((await call(null, '/api/client-error', { message: 'x' })).status, 401);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await call(7002, '/api/client-error', { message: 'Errore ' + i, line: i, page: 'page-game' })).status,
      204
    );
  assert.equal((await call(7002, '/api/client-error', { message: 'troppi' })).status, 429);
  console.log('PASS runtime client errors: signed in only, limited to 10 a minute');
} finally {
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
}
