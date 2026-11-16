// Long-turn games: a private Telegram message from the bot when it is your turn and you are not at the table.
// Games: chess, checkers, Forza 4, Scarabeo, people only. One message per turn, quiet hours 23-8 (Rome time),
// a short delay so live games (both players at the table) never get messages.
// The queue lives in one Durable Object ('turn-notices-v1'); before sending it asks the table whether the
// turn is still the same and the Lobby whether the player is looking at the table right now.

export const LONG_GAMES = ['chess', 'checkers', 'connect4', 'scarabeo'];
export const BOT_USERNAME = 'checkmategame_bot';
const GAME_NAMES = {
  chess: '♟ Scacchi',
  checkers: '⛀ Dama',
  connect4: '🔴 Forza 4',
  scarabeo: '🔤 Scarabeo'
};
export const SEND_DELAY = 60000;
const QUIET_FROM = 23,
  QUIET_TO = 8;
const telegramId = player =>
  typeof player === 'string' && /^tg:\d{1,20}$/.test(player) ? player.slice(3) : null;

// Who must act now: the player on turn, or in Scarabeo the players still voting on a contested word.
export function turnTargets(s) {
  if (!s || !LONG_GAMES.includes(s.game || 'chess') || (s.mode || 'people') !== 'people') return [];
  if (s.archived || s.phase !== 'playing') return [];
  let seats;
  if (s.scarabeo?.pending) {
    const p = s.scarabeo.pending;
    seats = s.players.map((_, i) => i).filter(i => i !== p.by && !Object.hasOwn(p.votes || {}, i));
  } else seats = [s.turn];
  return seats
    .map(i => s.players[i])
    .filter(p => p && !p.bot && telegramId(p.id))
    .map(p => p.id);
}
// Identifies one turn: a new move or a new vote round is a new turn.
export const turnKey = s => s.room + ':' + s.moves.length + (s.scarabeo?.pending ? ':vote' : '');

// Rome wall-clock hour (DST handled by Intl).
const romeHour = at =>
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(
      at
    )
  );
export const isQuiet = at => {
  const h = romeHour(at);
  return h >= QUIET_FROM || h < QUIET_TO;
};
// First moment, at or after `at`, outside quiet hours (steps of 5 minutes: lands between 8:00 and 8:05).
export function outsideQuiet(at) {
  let t = at;
  for (let i = 0; i < 200 && isQuiet(t); i++) t = Math.ceil((t + 1) / 300000) * 300000;
  return t;
}

export function noticeText({ game, number, opponent, vote, seated, started }) {
  const where = (GAME_NAMES[game] || 'Partita') + (number ? ' · Tavolo ' + number : '');
  if (started) return 'La partita è iniziata: tocca a te.\n' + where;
  if (seated) return opponent + ' si è seduto al tuo tavolo: tocca a te.\n' + where;
  if (vote) return 'Scarabeo: ' + opponent + ' ha proposto una parola, serve il tuo voto.\n' + where;
  return 'Tocca a te' + (opponent ? ' contro ' + opponent : '') + '.\n' + where;
}
export const openLink = room => 'https://t.me/' + BOT_USERNAME + '?startapp=t-' + room;

// What the table tells the queue after a change. Returns null when nobody needs a message.
const game = s => s.game || 'chess';
export function noticeRequest(s) {
  const targets = turnTargets(s);
  if (!targets.length) return null;
  const last = s.moves.at(-1);
  return {
    room: s.room,
    key: turnKey(s),
    game: game(s),
    number: s.number || null,
    vote: !!s.scarabeo?.pending,
    // No moves yet: a two-player table just got its opponent, a Scarabeo table was just started.
    seated: !last && game(s) !== 'scarabeo',
    started: !last && game(s) === 'scarabeo',
    targets: targets.map(player => ({
      player,
      opponent: last?.by || s.players.find(p => p.id !== player && !p.bot)?.name || ''
    }))
  };
}

const json = (data, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export class TurnNotices {
  // deps (for tests): now(), telegram(method, payload) -> {ok, status}, table(room, query), presence(player, room)
  constructor(ctx, env, deps = {}) {
    this.ctx = ctx;
    this.env = env;
    this.now = deps.now || (() => Date.now());
    // Test-only knobs (runtime tests): shorter delay, quiet hours off. Production uses the defaults.
    this.delay = /^\d+$/.test(env.TURN_NOTICE_DELAY_MS || '') ? Number(env.TURN_NOTICE_DELAY_MS) : SEND_DELAY;
    this.quiet = env.TURN_QUIET_HOURS !== 'off';
    this.telegram =
      deps.telegram ||
      (async (method, payload) => {
        const response = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        });
        const result = await response.json().catch(() => null);
        return { ok: response.ok && result?.ok === true, status: response.status };
      });
    this.table =
      deps.table ||
      (async (room, query) => {
        const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
        const response = await stub.fetch(
          new Request('https://internal/turn-check?' + new URLSearchParams(query))
        );
        return response.ok ? response.json() : { due: false };
      });
    this.presence =
      deps.presence ||
      (async (player, room) => {
        const lobby = env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));
        const response = await lobby.fetch(
          new Request('https://internal/lobby/presence?' + new URLSearchParams({ player, room }))
        );
        return response.ok ? (await response.json()).present === true : false;
      });
  }
  async user(id) {
    return (await this.ctx.storage.get('user:' + id)) || null;
  }
  async setUser(id, enabled, reason) {
    await this.ctx.storage.put('user:' + id, { enabled, reason, at: this.now() });
  }
  async schedule() {
    const queue = await this.ctx.storage.list({ prefix: 'queue:' });
    const due = Math.min(...[...queue.values()].map(n => n.due));
    if (Number.isFinite(due)) await this.ctx.storage.setAlarm(Math.max(due, this.now() + 1000));
    else await this.ctx.storage.deleteAlarm();
  }
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    if (path === '/notices/queue' && req.method === 'POST') {
      if (!body.room || !body.key || !Array.isArray(body.targets))
        return json({ error: 'Richiesta non valida.' }, 400);
      for (const target of body.targets.slice(0, 4)) {
        const userId = telegramId(target.player);
        if (!userId) continue;
        const key = 'queue:' + body.key + ':' + target.player;
        // Already queued, or already handled (sent or skipped): one message per turn at most.
        if (
          (await this.ctx.storage.get(key)) ||
          (await this.ctx.storage.get('done:' + body.key + ':' + target.player))
        )
          continue;
        // A newer turn of the same table replaces any older message still waiting.
        for (const [old, item] of await this.ctx.storage.list({ prefix: 'queue:' + body.room + ':' }))
          if (item.player === target.player) await this.ctx.storage.delete(old);
        await this.ctx.storage.put(key, {
          key: body.key,
          room: body.room,
          player: target.player,
          userId,
          game: body.game,
          number: body.number,
          vote: !!body.vote,
          seated: !!body.seated,
          started: !!body.started,
          opponent: String(target.opponent || '').slice(0, 60),
          due: this.quiet ? outsideQuiet(this.now() + this.delay) : this.now() + this.delay
        });
      }
      await this.schedule();
      return json({ ok: true });
    }
    // The bot's private chat: /start turns messages on.
    if (path === '/notices/start' && req.method === 'POST') {
      if (!/^\d{1,20}$/.test(String(body.userId || ''))) return json({ error: 'Utente non valido.' }, 400);
      await this.setUser(String(body.userId), true, 'start');
      return json({ ok: true });
    }
    // From the app: read or change the user's own choice.
    const viewer = JSON.parse(req.headers.get('X-Checkmate-User') || 'null');
    if (path === '/notices/status' && viewer?.id) {
      if (req.method === 'POST') {
        if (typeof body.enabled !== 'boolean') return json({ error: 'Valore non valido.' }, 400);
        const old = await this.user(viewer.id);
        // Turning them on from the app only works once the bot's chat was started (Telegram rule).
        await this.setUser(
          viewer.id,
          body.enabled && old?.reason !== 'blocked' && !!old,
          body.enabled ? old?.reason || 'unknown' : 'app'
        );
      }
      const u = await this.user(viewer.id);
      return json({
        enabled: u?.enabled === true,
        started: !!u && u.reason !== 'blocked',
        bot: BOT_USERNAME
      });
    }
    return json({ error: 'Percorso non trovato.' }, 404);
  }
  async alarm() {
    const now = this.now();
    for (const [key, item] of await this.ctx.storage.list({ prefix: 'queue:' })) {
      if (item.due > now) continue;
      // Quiet hours started while waiting: move it to the morning.
      if (this.quiet && isQuiet(now)) {
        await this.ctx.storage.put(key, { ...item, due: outsideQuiet(now) });
        continue;
      }
      await this.ctx.storage.delete(key);
      await this.ctx.storage.put('done:' + item.key + ':' + item.player, now);
      try {
        const u = await this.user(item.userId);
        if (u && !u.enabled) continue;
        const turn = await this.table(item.room, { player: item.player, key: item.key });
        if (!turn?.due) continue;
        if (await this.presence(item.player, item.room)) continue;
        const sent = await this.telegram('sendMessage', {
          chat_id: Number(item.userId),
          text: noticeText(item),
          reply_markup: { inline_keyboard: [[{ text: 'Apri la partita', url: openLink(item.room) }]] }
        });
        if (sent.ok) {
          if (!u?.enabled) await this.setUser(item.userId, true, u?.reason || 'start');
        } else if (sent.status === 403) await this.setUser(item.userId, false, 'blocked');
      } catch {}
    }
    // Forget handled turns after two weeks.
    for (const [key, at] of await this.ctx.storage.list({ prefix: 'done:' }))
      if (now - at > 14 * 86400000) await this.ctx.storage.delete(key);
    await this.schedule();
  }
}
