import { initial, act, advance, nextAlarm, view } from './engine.js';
import { collectNotices } from './notify.js';
import { lobbySummary } from './summary.js';
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
// The existing Room namespace routes one dedicated object here. No changes to game-table storage.
export class SimulatorLeague {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
  }
  // Group notices are opt-in: secret/var SIMULATOR_NOTIFY=true on the Worker. Best effort, at most once:
  // notices are always marked as produced, so switching it on later never replays old ones.
  async notify(messages) {
    if (!messages.length || this.env.SIMULATOR_NOTIFY !== 'true' || !this.env.BOT_TOKEN) return;
    const chat = String(this.env.TELEGRAM_ALLOWED_GROUP_ID || '-1001803941686');
    for (const text of messages)
      await fetch('https://api.telegram.org/bot' + this.env.BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);
  }
  async load(tx, now) {
    const count = await tx.get('simulator:parts');
    if (!count) return initial(now);
    const keys = Array.from({ length: count }, (_, i) => 'simulator:part:' + i);
    const pieces = await tx.get(keys);
    return JSON.parse(keys.map(k => pieces.get(k)).join(''));
  }
  async save(tx, s, now, data = JSON.stringify(s)) {
    const parts = Math.ceil(data.length / 40000),
      old = (await tx.get('simulator:parts')) || 0;
    const values = { 'simulator:parts': parts };
    for (let i = 0; i < parts; i++) values['simulator:part:' + i] = data.slice(i * 40000, (i + 1) * 40000);
    await tx.put(values);
    if (old > parts)
      await tx.delete(Array.from({ length: old - parts }, (_, i) => 'simulator:part:' + (parts + i)));
    const alarm = nextAlarm(s, now);
    if (alarm) await tx.setAlarm(alarm);
    else await tx.deleteAlarm();
  }
  async fetch(req) {
    const u = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
    if (!u?.id) return json({ error: 'Accesso richiesto.' }, 401);
    const path = new URL(req.url).pathname;
    // Lobby summary: read-only, no save, no presence update.
    if (path === '/simulator/summary') {
      if (req.method !== 'GET') return json({ error: 'Metodo non consentito.' }, 405);
      const now = Date.now(),
        s = await this.ctx.storage.transaction(tx => this.load(tx, now));
      return json(lobbySummary(s, u.id, now));
    }
    if (!['/simulator/state', '/simulator/action'].includes(path))
      return json({ error: 'Percorso non trovato.' }, 404);
    if (
      (path.endsWith('state') && req.method !== 'GET') ||
      (path.endsWith('action') && req.method !== 'POST')
    )
      return json({ error: 'Metodo non consentito.' }, 405);
    let body = null;
    try {
      if (req.method === 'POST') {
        const raw = await req.text();
        if (raw.length > 4096) return json({ error: 'Richiesta troppo grande.' }, 413);
        body = JSON.parse(raw);
        if (!body || typeof body !== 'object') throw Error('Richiesta non valida.');
      }
      let notices = [];
      const response = await this.ctx.storage.transaction(async tx => {
        const now = Date.now(),
          s = await this.load(tx, now),
          before = JSON.stringify(s);
        advance(s, now);
        s.visitors ??= {};
        for (const [id, v] of Object.entries(s.visitors)) if (v.seen < now - 86400000) delete s.visitors[id];
        // The visitor list counts as online for 25 s: refresh it every 10 s, not on every request.
        const name = u.name || 'Utente Telegram',
          seen = body?.action === 'presence' && !body.visible ? 0 : now,
          old = s.visitors[u.id];
        if (!old || old.name !== name || !seen !== !old.seen || seen - old.seen >= 10000)
          s.visitors[u.id] = { id: u.id, name, seen };
        if (body) {
          act(s, u, body, now);
          if (body.action !== 'presence') s.revision++;
        }
        notices = collectNotices(s, now);
        // A request that changed nothing (a plain read) writes nothing: Durable Object writes are billed per row.
        const after = JSON.stringify(s);
        if (after !== before) await this.save(tx, s, now, after);
        return json(view(s, u, now));
      });
      if (notices.length) this.ctx.waitUntil?.(this.notify(notices));
      return response;
    } catch (e) {
      return json({ error: e.message || 'Richiesta non valida.' }, 400);
    }
  }
  async alarm() {
    let notices = [];
    await this.ctx.storage.transaction(async tx => {
      const now = Date.now(),
        s = await this.load(tx, now);
      advance(s, now);
      s.revision++;
      notices = collectNotices(s, now);
      await this.save(tx, s, now);
    });
    await this.notify(notices);
  }
}
