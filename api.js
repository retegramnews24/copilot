// Every HTTP request reaches this function first (Worker entry): static assets, Telegram webhook, session,
// then authenticated /api/ routes, forwarded to the right Durable Object.
import { requireMember, telegramAccessTag, login, issueSession, sessionUser } from './auth.js';
import { radioNowPlaying } from './radio-metadata.js';
import { json, noticeHub } from './worker-shared.js';
import { setupTelegram, telegramWebhook } from './telegram-bot.js';
import { cinemaHub, groupCinema } from './cinema-routes.js';
import { seatLimit, longLimitText } from './table-rules.js';

export async function handleRequest(req, env) {
  const u = new URL(req.url);
  if (u.pathname === '/api/telegram/setup' && req.method === 'POST') {
    if (req.headers.get('Origin') && req.headers.get('Origin') !== u.origin)
      return json({ error: 'Origine non consentita.' }, 403);
    return setupTelegram(req, env, u);
  }
  if (u.pathname === '/api/telegram/webhook' && req.method === 'POST') return telegramWebhook(req, env);
  if (!u.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
  if (req.headers.get('Origin') && req.headers.get('Origin') !== u.origin)
    return json({ error: 'Origine non consentita.' }, 403);
  if (u.pathname === '/api/health') return json({ ok: true, version: '1.0.24' });

  if (u.pathname === '/api/session' && req.method === 'POST') return login(req, env);
  const groupMedia = /^\/api\/cinema\/(?:group|inbox)\/media\//.test(u.pathname);
  let authRequest = req;
  if (groupMedia && !req.headers.has('Authorization')) {
    const cookie = req.headers.get('Cookie')?.match(/(?:^|;\s*)binottoland_cinema=([^;]+)/)?.[1];
    if (cookie) authRequest = new Request(req, { headers: { Authorization: 'Bearer ' + cookie } });
  }
  const user = await sessionUser(authRequest, env);
  if (!user) return json({ error: 'Apri Binottoland da Telegram per accedere.' }, 401);
  const denied = await requireMember(user, env);
  if (denied) return denied;
  if (u.pathname === '/api/session/refresh' && req.method === 'POST') return issueSession(user, env);
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
  const lab = u.pathname.match(/^\/api\/labyrinth\/([a-f0-9-]{36})\/(state|join|archive|delete|ws)$/);
  if (lab)
    return env.ROOMS.get(env.ROOMS.idFromName('lab:' + lab[1])).fetch(
      new Request(u.origin + '/labyrinth/' + lab[2] + u.search, req)
    );
  const lobby = env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));
  if (u.pathname === '/api/chat' && req.method === 'POST')
    return lobby.fetch(new Request(u.origin + '/lobby/chat', req));
  if (u.pathname === '/api/notices' && ['GET', 'POST'].includes(req.method)) {
    const raw = req.method === 'POST' ? await req.text() : undefined;
    if (raw && raw.length > 256) return json({ error: 'Richiesta troppo grande.' }, 413);
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
    if (raw.length > 4096) return json({ error: 'Richiesta troppo grande.' }, 413);
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
  if (!match) return json({ error: 'Percorso non trovato.' }, 404);

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
