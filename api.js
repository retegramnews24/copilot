// Every HTTP request reaches this function first (Worker entry): static assets, Telegram webhook, session,
// then authenticated /api/ routes, forwarded to the right Durable Object.
import {
  secureEqual,
  requireMember,
  isOwner,
  telegramAccessTag,
  login,
  issueSession,
  sessionUser
} from './auth.js';
import { radioNowPlaying } from './radio-metadata.js';
import { json, noticeHub, internalHeaders, INTERNAL_HEADER, lobbyHub } from './worker-shared.js';
import { setupTelegram, telegramWebhook } from './telegram-bot.js';
import { cinemaHub, groupCinema } from './cinema-routes.js';
import { seatLimit, longLimitText } from './table-rules.js';
import { MSG } from './public/messages.js';
import { makeTrack } from './f1-server.js';

// Unexpected server errors are logged (Workers Logs) instead of disappearing; the player gets a short message.
// Grandezza delle richieste: il contenuto si legge a pezzi e la lettura si ferma appena supera il limite, anche se
// la richiesta non dichiara quanto è grande (prima bastava non mandare Content-Length per far leggere tutto in
// memoria). Il limite è quello della richiesta più grande ammessa (pista di F1 da 400 kB, partita di Number
// Connect); i controlli più stretti dei singoli percorsi restano.
export const BODY_LIMIT = 420000;
export async function readLimited(req, limit = BODY_LIMIT) {
  if (!req.body) return null;
  const reader = req.body.getReader(),
    parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return false;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) (out.set(p, at), (at += p.byteLength));
  return out;
}
export async function handleRequest(req, env) {
  try {
    if (req.body && !['GET', 'HEAD'].includes(req.method)) {
      if (Number(req.headers.get('Content-Length') || 0) > BODY_LIMIT)
        return json({ error: MSG.tooBig }, 413);
      const body = await readLimited(req);
      if (body === false) return json({ error: MSG.tooBig }, 413);
      req = new Request(req, { body });
    }
    // la chiave interna non arriva mai dai telefoni (vedi worker-shared.js)
    if (req.headers.has(INTERNAL_HEADER)) {
      const headers = new Headers(req.headers);
      headers.delete(INTERNAL_HEADER);
      req = new Request(req, { headers });
    }
    return await route(req, env);
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'server-error',
        path: new URL(req.url).pathname,
        message: String(error?.message || error).slice(0, 500),
        stack: String(error?.stack || '').slice(0, 2000)
      })
    );
    return json({ error: 'Errore interno del server. Riprova tra poco.' }, 500);
  }
}

// Errors reported by the app: at most 10 a minute per person (per server instance), stored in the logs only.
const reports = new Map();
async function clientError(req, user) {
  const raw = await req.text();
  if (raw.length > 4096) return json({ error: MSG.tooBig }, 413);
  const now = Date.now(),
    seen = (reports.get(user.id) || []).filter(at => now - at < 60000);
  if (seen.length >= 10) return new Response(null, { status: 429 });
  if (reports.size > 500) reports.clear();
  reports.set(user.id, [...seen, now]);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ error: MSG.unreadable }, 400);
  }
  const text = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  console.error(
    JSON.stringify({
      type: 'client-error',
      user: user.id,
      message: text(data.message, 400),
      source: text(data.source, 200),
      line: Number.isInteger(data.line) ? data.line : null,
      page: text(data.page, 40),
      version: text(data.version, 20),
      platform: text(data.platform, 20)
    })
  );
  return new Response(null, { status: 204 });
}

// Backups for the administrator: only with the ADMIN_TOKEN secret (at least 24 characters); otherwise it does not exist.
async function admin(req, env, u) {
  const supplied = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24 || !secureEqual(supplied, env.ADMIN_TOKEN))
    return json({ error: MSG.notFound }, 404);
  const hub = env.ROOMS.get(env.ROOMS.idFromName('backup-v1'));
  const one = u.pathname.match(/^\/api\/admin\/backups\/([\w-]{10,40})(\/restore)?$/);
  if (u.pathname === '/api/admin/backups')
    return hub.fetch('https://internal/backups/' + (req.method === 'POST' ? 'run' : 'list'), {
      method: req.method
    });
  if (one && !one[2] && req.method === 'GET') return hub.fetch('https://internal/backups/' + one[1]);
  // togliere un punteggio dalla classifica di un flipper: POST {"table":"gp"|"gt","id":"<numero Telegram>"}
  if (u.pathname === '/api/admin/pinball' && req.method === 'POST') {
    const body = await req.text();
    if (body.length > 256) return json({ error: MSG.tooBig }, 413);
    return lobbyHub(env).fetch('https://internal/pinball/remove', {
      method: 'POST',
      headers: await internalHeaders(env),
      body
    });
  }
  if (one && one[2] && req.method === 'POST') {
    const body = await req.text();
    if (body.length > 65536) return json({ error: MSG.tooBig }, 413);
    return hub.fetch('https://internal/backups/' + one[1] + '/restore', {
      method: 'POST',
      body: body || '{}'
    });
  }
  return json({ error: MSG.notFound }, 404);
}

// Backup dall'app, solo per il proprietario (isOwner): per gli altri queste pagine non esistono.
// GET /api/backup elenco · POST /api/backup/run copia adesso, il bot la manda in privato al proprietario ·
// POST /api/backup/<id>/send rimanda quella copia · POST /api/backup/<id>/restore rimette tutto com'era.
async function ownerBackup(req, env, u, user) {
  if (!(await isOwner(user, env))) return json({ error: MSG.notFound }, 404);
  const hub = env.ROOMS.get(env.ROOMS.idFromName('backup-v1'));
  if (u.pathname === '/api/backup' && req.method === 'GET') return hub.fetch('https://internal/backups/list');
  if (u.pathname === '/api/backup/run' && req.method === 'POST')
    return hub.fetch('https://internal/backups/run', {
      method: 'POST',
      body: JSON.stringify({ chat: user.id })
    });
  const one = u.pathname.match(/^\/api\/backup\/([\w-]{10,40})\/(send|restore)$/);
  if (one && req.method === 'POST')
    return hub.fetch('https://internal/backups/' + one[1] + '/' + one[2], {
      method: 'POST',
      body: JSON.stringify(one[2] === 'send' ? { chat: user.id } : {})
    });
  return json({ error: MSG.notFound }, 404);
}

async function route(req, env) {
  const u = new URL(req.url);
  if (u.pathname.startsWith('/api/admin/')) return admin(req, env, u);
  if (u.pathname === '/api/telegram/setup' && req.method === 'POST') {
    if (req.headers.get('Origin') && req.headers.get('Origin') !== u.origin)
      return json({ error: 'Origine non consentita.' }, 403);
    return setupTelegram(req, env, u);
  }
  if (u.pathname === '/api/telegram/webhook' && req.method === 'POST') return telegramWebhook(req, env);
  if (!u.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
  if (req.headers.get('Origin') && req.headers.get('Origin') !== u.origin)
    return json({ error: 'Origine non consentita.' }, 403);
  if (u.pathname === '/api/health')
    return json({ ok: true, version: '1.0.68', env: env.APP_ENV || 'production' });

  if (u.pathname === '/api/session' && req.method === 'POST') return login(req, env);
  const groupMedia = /^\/api\/cinema\/(?:group|inbox)\/media\//.test(u.pathname);
  let authRequest = req;
  if (groupMedia && !req.headers.has('Authorization')) {
    const cookie = req.headers.get('Cookie')?.match(/(?:^|;\s*)binottoland_cinema=([^;]+)/)?.[1];
    if (cookie) authRequest = new Request(req, { headers: { Authorization: 'Bearer ' + cookie } });
  }
  const user = await sessionUser(authRequest, env);
  if (!user) return json({ error: MSG.openFromTelegram }, 401);
  const denied = await requireMember(user, env);
  if (denied) return denied;
  if (u.pathname === '/api/session/refresh' && req.method === 'POST') return issueSession(user, env);
  if (u.pathname === '/api/client-error' && req.method === 'POST') return clientError(req, user);
  if (u.pathname === '/api/backup' || u.pathname.startsWith('/api/backup/'))
    return ownerBackup(req, env, u, user);
  if (u.pathname.startsWith('/api/simulator/')) {
    const headers = new Headers({
      'X-Checkmate-User': JSON.stringify(user),
      'Content-Type': 'application/json'
    });
    return env.ROOMS.get(env.ROOMS.idFromName('binotto-simulator-league-v1')).fetch(
      new Request(u.origin + u.pathname.slice(4), {
        method: req.method,
        headers,
        ...(req.method === 'POST' ? { body: req.body } : {})
      })
    );
  }
  if (/^\/api\/cinema\/(?:group|inbox)\//.test(u.pathname)) return groupCinema(req, env, u, user);
  if (u.pathname === '/api/radio/now-playing' && req.method === 'GET') {
    const data = await radioNowPlaying(u.searchParams.get('station'), user.id);
    return data ? json(data) : json({ error: 'Stazione non valida.' }, 400);
  }
  const trustedHeaders = new Headers(req.headers);
  trustedHeaders.set('X-Checkmate-User', JSON.stringify(user));
  trustedHeaders.set('X-Access-Tag', await telegramAccessTag(env));
  trustedHeaders.set('X-Session-Expires', String(user.sessionExpires));
  req = new Request(req, { headers: trustedHeaders });
  if (
    (u.pathname === '/api/blackboard/ws' && req.method === 'GET') ||
    (u.pathname === '/api/blackboard/create' && req.method === 'POST')
  ) {
    const board = env.ROOMS.get(env.ROOMS.idFromName('blackboard-spazio-libero-v1'));
    return board.fetch(new Request(u.origin + u.pathname.slice(4) + u.search, req));
  }
  if (u.pathname === '/api/cinema/ws' && req.method === 'GET')
    return cinemaHub(env).fetch(new Request(u.origin + '/cinema/ws', req));
  if (u.pathname === '/api/cinema/youtube' && req.method === 'GET')
    return env.ROOMS.get(env.ROOMS.idFromName('cinema-youtube-v1')).fetch(
      new Request(u.origin + '/cinema/youtube' + u.search, req)
    );

  const bil = u.pathname.match(
    /^\/api\/biliardo\/([a-f0-9-]{36})\/(state|join|leave|start|play|close|team|abandon)$/
  );
  if (bil)
    return env.ROOMS.get(env.ROOMS.idFromName('biliardo:' + bil[1])).fetch(
      new Request(u.origin + '/biliardo/' + bil[2] + u.search, req)
    );
  const f1 = u.pathname.match(
    /^\/api\/f1\/([a-f0-9-]{36})\/(state|track|join|leave|start|play|close|abandon)$/
  );
  if (f1)
    return env.ROOMS.get(env.ROOMS.idFromName('f1:' + f1[1])).fetch(
      new Request(u.origin + '/f1/' + f1[2] + u.search, req)
    );
  const golf = u.pathname.match(/^\/api\/golf\/([a-f0-9-]{36})\/(state|join|start|shot|close)$/);
  if (golf)
    return env.ROOMS.get(env.ROOMS.idFromName('golf:' + golf[1])).fetch(
      new Request(u.origin + '/golf/' + golf[2] + u.search, req)
    );
  const pong = u.pathname.match(/^\/api\/pong\/([a-f0-9-]{36})\/(state|ws)$/);
  if (pong)
    return env.ROOMS.get(env.ROOMS.idFromName('pong:' + pong[1])).fetch(
      new Request(u.origin + '/pong/' + pong[2], req)
    );
  const moto = u.pathname.match(/^\/api\/moto-trial\/([a-f0-9-]{36})\/(state|ws)$/);
  if (moto)
    return env.ROOMS.get(env.ROOMS.idFromName('moto:' + moto[1])).fetch(
      new Request(u.origin + '/moto-trial/' + moto[2], req)
    );
  const lobby = lobbyHub(env);
  if (u.pathname === '/api/chat' && req.method === 'POST')
    return lobby.fetch(new Request(u.origin + '/lobby/chat', req));
  if (u.pathname === '/api/notices' && ['GET', 'POST'].includes(req.method)) {
    const raw = req.method === 'POST' ? await req.text() : undefined;
    if (raw && raw.length > 256) return json({ error: MSG.tooBig }, 413);
    return noticeHub(env).fetch(
      new Request(u.origin + '/notices/status', {
        method: req.method,
        headers: { 'X-Checkmate-User': JSON.stringify(user) },
        body: raw
      })
    );
  }
  if (u.pathname === '/api/number-connect/score' && req.method === 'POST') {
    if (Number(req.headers.get('Content-Length')) > 320000)
      return json({ error: 'Partita troppo lunga.' }, 413);
    const raw = await req.text();
    if (raw.length > 320000) return json({ error: 'Partita troppo lunga.' }, 413);
    return lobby.fetch(
      new Request(u.origin + '/lobby/number-connect-score', {
        method: 'POST',
        body: raw,
        headers: trustedHeaders
      })
    );
  }
  if (u.pathname === '/api/leaderboard' && req.method === 'GET')
    return lobby.fetch(new Request(u.origin + '/lobby/leaderboard' + u.search));
  if (u.pathname === '/api/lobby' && req.method === 'GET')
    return lobby.fetch(new Request(u.origin + '/lobby/list'));
  if (u.pathname === '/api/lobby/ws' && req.method === 'GET')
    return lobby.fetch(new Request(u.origin + '/lobby/ws', req));
  if (req.method === 'POST' && u.pathname === '/api/create') {
    const raw = await req.text();
    // F1 on paper! sends the drawn track with the race (up to 400 kB); every other game a few settings.
    if (raw.length > (/^\{"game":"f1"/.test(raw) ? 400000 : 4096)) return json({ error: MSG.tooBig }, 413);
    // La pista si controlla qui, prima di entrare nella Lobby (analisi 10.3): la creazione gira dentro il blocco della
    // Lobby, e finché il controllo non finiva nessun altro veniva servito. Una pista sbagliata non arriva più lì.
    if (/^\{"game":"f1"/.test(raw)) {
      try {
        makeTrack(JSON.parse(raw).track);
      } catch (error) {
        return json({ error: error instanceof SyntaxError ? MSG.unreadable : error.message }, 400);
      }
    }
    return lobby.fetch(
      new Request(u.origin + '/lobby/create', {
        method: 'POST',
        body: raw,
        headers: { 'X-Checkmate-User': JSON.stringify(user) }
      })
    );
  }
  const match = u.pathname.match(
    /^\/api\/room\/([a-f0-9-]{36})\/(state|claim|start|rematch|next-round|move|pass|finish|archive|dismiss|delete|replay|offer-draw|accept-draw|reject-draw|ws)$/
  );
  if (!match) return json({ error: MSG.notFound }, 404);

  if (match[2] === 'claim' && req.method === 'POST')
    return lobby.fetch(
      new Request(u.origin + '/lobby/join', {
        method: 'POST',
        headers: { 'X-Checkmate-User': JSON.stringify(user) },
        body: JSON.stringify({ room: match[1] })
      })
    );
  if (match[2] === 'rematch' && req.method === 'POST') {
    const { games } = await (await lobby.fetch(new Request(u.origin + '/lobby/list'))).json();
    const limit = seatLimit(games, user.player, games.find(g => g.room === match[1]) || { room: match[1] });
    if (limit)
      return json({ error: limit === 'long' ? longLimitText : 'Hai già un altro tavolo aperto.' }, 409);
  }
  const response = await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(req);
  if (response.ok && (req.method === 'POST' || match[2] === 'state')) {
    const result = await response.clone().json();
    const s = result.state || result;
    if (match[2] !== 'dismiss' || s.deleted)
      await lobby.fetch(
        new Request(u.origin + (s.deleted ? '/lobby/remove' : '/lobby/update'), {
          method: 'POST',
          body: JSON.stringify({
            room: s.room,
            number: s.number,
            game: s.game || 'chess',
            archived: !!s.archived,
            phase: s.phase,
            players: s.players,
            turn: s.turn,
            revision: s.revision,
            series: s.series || null,
            mode: s.mode || 'people',
            created: s.created,
            expires: s.expires,
            deadline: s.clock?.deadline ?? null
          })
        })
      );
  }
  return response;
}
