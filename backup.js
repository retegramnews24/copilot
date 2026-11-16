// Weekly backup of all game data, with restore.
// Every Durable Object (class Room) can export and import its whole storage (/backup/export, /backup/import).
// The backup hub ('backup-v1') collects the singletons and every table listed in the Lobby into one snapshot,
// keeps the last KEEP snapshots (in chunks), and if BACKUP_CHAT_ID is set the bot also sends the file privately.
// Started by the weekly cron (worker.js `scheduled`) or by the admin API (api.js, needs ADMIN_TOKEN).

export const SINGLETONS = [
  'checkmate-lobby-v1',
  'binotto-simulator-league-v1',
  'turn-notices-v1',
  'cinema-streamer-v1',
  'cinema-telegram-v1',
  'blackboard-spazio-libero-v1'
];
export const KEEP = 8;
const CHUNK = 900000;
const ARCADE_PREFIX = { labyrinth: 'lab:', golf: 'golf:', pong: 'pong:', 'moto-trial': 'moto:' };
const json = (data, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

// Storage values are plain data, sometimes bytes: JSON with bytes as base64.
export function encode(value) {
  return JSON.stringify(value, (_, v) => {
    if (v instanceof ArrayBuffer) v = new Uint8Array(v);
    if (ArrayBuffer.isView(v)) {
      let s = '';
      for (const b of new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) s += String.fromCharCode(b);
      return { __bytes: btoa(s) };
    }
    return v;
  });
}
export function decode(text) {
  return JSON.parse(text, (_, v) =>
    v && typeof v === 'object' && typeof v.__bytes === 'string' && Object.keys(v).length === 1
      ? Uint8Array.from(atob(v.__bytes), c => c.charCodeAt(0))
      : v
  );
}

// The Durable Object names to save: the singletons, then each table the Lobby knows.
export function objectNames(lobbyEntries) {
  const names = [...SINGLETONS];
  for (const [key, game] of lobbyEntries) {
    if (!key.startsWith('game:')) continue;
    const room = key.slice(5);
    if (!/^[a-f0-9-]{36}$/.test(room)) continue;
    names.push((ARCADE_PREFIX[game?.game] || '') + room);
  }
  return [...new Set(names)];
}

// Inside any Room: export or replace its own storage.
export async function exportStorage(storage) {
  return { entries: [...(await storage.list())], alarm: await storage.getAlarm() };
}
export async function importStorage(storage, data) {
  await storage.deleteAlarm();
  await storage.deleteAll();
  const entries = data.entries || [];
  for (let i = 0; i < entries.length; i += 100)
    await storage.put(Object.fromEntries(entries.slice(i, i + 100)));
  if (Number.isFinite(data.alarm)) await storage.setAlarm(Math.max(data.alarm, Date.now() + 1000));
}

export class BackupHub {
  // deps (tests): now(), object(name) -> stub with fetch, telegram(file, caption)
  constructor(ctx, env, deps = {}) {
    this.ctx = ctx;
    this.env = env;
    this.now = deps.now || (() => Date.now());
    this.object = deps.object || (name => env.ROOMS.get(env.ROOMS.idFromName(name)));
    this.telegram =
      deps.telegram ||
      (async (text, filename, caption) => {
        const form = new FormData();
        form.append('chat_id', String(env.BACKUP_CHAT_ID));
        form.append('caption', caption);
        form.append('document', new Blob([text], { type: 'application/json' }), filename);
        const r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendDocument', {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(30000)
        });
        return r.ok;
      });
  }
  async index() {
    return (await this.ctx.storage.get('index')) || [];
  }
  async read(id) {
    const item = (await this.index()).find(s => s.id === id);
    if (!item) return null;
    let text = '';
    for (let i = 0; i < item.chunks; i++) text += await this.ctx.storage.get('snap:' + id + ':' + i);
    return text;
  }
  async run() {
    const at = this.now(),
      id = new Date(at).toISOString().replace(/[:.]/g, '-');
    const lobby = await (
      await this.object('checkmate-lobby-v1').fetch('https://internal/backup/export')
    ).json();
    const objects = {},
      failed = [];
    for (const name of objectNames(lobby.entries)) {
      try {
        const r = await this.object(name).fetch('https://internal/backup/export');
        if (!r.ok) throw Error('HTTP ' + r.status);
        const data = await r.json();
        if (data.entries.length) objects[name] = data;
      } catch (e) {
        failed.push(name);
      }
    }
    const text = encode({ format: 'binottoland-backup-1', at, objects });
    const chunks = Math.ceil(text.length / CHUNK);
    for (let i = 0; i < chunks; i++)
      await this.ctx.storage.put('snap:' + id + ':' + i, text.slice(i * CHUNK, (i + 1) * CHUNK));
    const index = [
      { id, at, size: text.length, chunks, objects: Object.keys(objects).length, failed },
      ...(await this.index())
    ];
    for (const old of index.slice(KEEP))
      for (let i = 0; i < old.chunks; i++) await this.ctx.storage.delete('snap:' + old.id + ':' + i);
    await this.ctx.storage.put('index', index.slice(0, KEEP));
    let sent = false;
    if (this.env.BACKUP_CHAT_ID && /^-?\d+$/.test(String(this.env.BACKUP_CHAT_ID))) {
      try {
        sent = await this.telegram(
          text,
          'binottoland-backup-' + id + '.json',
          '🗄 Backup Binottoland · ' +
            Object.keys(objects).length +
            ' archivi · ' +
            Math.round(text.length / 1024) +
            ' KB'
        );
      } catch {}
    }
    return { ...index[0], sent };
  }
  async restore(id, only) {
    const text = await this.read(id);
    if (!text) return null;
    const snapshot = decode(text),
      restored = [];
    for (const [name, data] of Object.entries(snapshot.objects)) {
      if (Array.isArray(only) && only.length && !only.includes(name)) continue;
      const r = await this.object(name).fetch(
        new Request('https://internal/backup/import', { method: 'POST', body: encode(data) })
      );
      if (r.ok) restored.push(name);
    }
    return { id, restored };
  }
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === '/backups/list') return json(await this.index());
    if (path === '/backups/run' && req.method === 'POST') return json(await this.run());
    const one = path.match(/^\/backups\/([\w-]{10,40})$/);
    if (one && req.method === 'GET') {
      const text = await this.read(one[1]);
      return text
        ? new Response(text, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
        : json({ error: 'Backup non trovato.' }, 404);
    }
    const restore = path.match(/^\/backups\/([\w-]{10,40})\/restore$/);
    if (restore && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const result = await this.restore(restore[1], body.objects);
      return result ? json(result) : json({ error: 'Backup non trovato.' }, 404);
    }
    return json({ error: 'Percorso non trovato.' }, 404);
  }
}
