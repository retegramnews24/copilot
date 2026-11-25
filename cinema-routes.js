// Cinema routes handled by the Worker: Telegram group media and inbox files, arming a room to receive group media.
import { telegramCinemaId } from './cinema-telegram.js';
import { json, BOT_USERNAME } from './worker-shared.js';
import { MSG } from './public/messages.js';
export const cinemaHub = env => env.ROOMS.get(env.ROOMS.idFromName('cinema-streamer-v1'));
function telegramCinemaDirectory(env, origin, op, params = {}, user = null, body) {
  const query = new URLSearchParams({ op, ...params });
  const target = env.ROOMS.get(env.ROOMS.idFromName('cinema-telegram-v1'));
  return target.fetch(origin + '/cinema/group-directory?' + query, {
    method: body ? 'POST' : 'GET',
    headers: user ? { 'X-Checkmate-User': JSON.stringify(user) } : {},
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}
function cinemaForwardHub(env, origin, action, user, body = {}) {
  return cinemaHub(env).fetch(origin + '/cinema/group-' + action, {
    method: 'POST',
    headers: { 'X-Checkmate-User': JSON.stringify(user) },
    body: JSON.stringify(body)
  });
}
export async function receiveCinemaSubmission(env, origin, submission) {
  const user = { id: submission.user, player: 'tg:' + submission.user };
  try {
    const queued = await cinemaForwardHub(env, origin, 'enqueue', user, submission);
    return queued.status >= 500 ? json({ error: 'Coda Cinema non raggiungibile.' }, 503) : json({ ok: true });
  } catch {
    return json({ error: 'Ricezione Telegram interrotta.' }, 503);
  }
}
async function telegramMedia(req, env, u, asset, key, ready) {
  if (!asset.ok) return asset;
  const { file, type, loading } = await asset.json();
  const target = env.ROOMS.get(env.ROOMS.idFromName(key));
  const address = u.origin + '/cinema/group-file';
  const prepared = await target.fetch(address, { method: 'POST', body: JSON.stringify({ file, type }) });
  if (!prepared.ok) return prepared;
  if (loading && ready) {
    const confirmed = await ready();
    if (!confirmed.ok) return confirmed;
  }
  const headers = new Headers();
  if (req.headers.has('Range')) headers.set('Range', req.headers.get('Range'));
  const media = await target.fetch(address, { method: req.method, headers });
  const secured = new Headers(media.headers);
  secured.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(media.body, { status: media.status, headers: secured });
}
export async function groupCinema(req, env, u, user) {
  const match = u.pathname.match(/^\/api\/cinema\/group\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/);
  if (match && ['GET', 'HEAD'].includes(req.method)) {
    const [, group, item] = match;
    const asset = await telegramCinemaDirectory(env, u.origin, 'asset', { group, item }, user);
    return telegramMedia(req, env, u, asset, 'cinema-telegram-file:' + group + ':' + item + ':media');
  }
  const inbox = u.pathname.match(/^\/api\/cinema\/inbox\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/);
  if (inbox && ['GET', 'HEAD'].includes(req.method)) {
    const [, room, item] = inbox;
    const asset = await cinemaForwardHub(env, u.origin, 'asset', user, { room, item });
    return telegramMedia(req, env, u, asset, 'cinema-inbox-file:' + item, () =>
      cinemaForwardHub(env, u.origin, 'asset-ready', user, { room, item })
    );
  }
  if (u.pathname === '/api/cinema/group/arm' && ['POST', 'DELETE'].includes(req.method)) {
    const room = u.searchParams.get('room');
    if (!telegramCinemaId.test(room ?? '')) return json({ error: 'Entra prima in una sala.' }, 400);
    if (req.method === 'DELETE') return cinemaForwardHub(env, u.origin, 'disarm', user, { room });
    const armed = await cinemaForwardHub(env, u.origin, 'arm', user, { room });
    if (!armed.ok) return armed;
    return json({ bot: BOT_USERNAME });
  }
  return json({ error: MSG.notFound }, 404);
}
