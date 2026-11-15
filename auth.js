// Accesso a Binottoland: identità Telegram firmata, sessioni e appartenenza al gruppo.
// Tutte le richieste /api/ passano da qui (vedi worker.js) prima di raggiungere giochi e servizi.
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
export function secureEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Membri ammessi: creator, administrator, member, oppure restricted ancora nel gruppo. Cache di 60 secondi per isolate.
const membershipCache = new Map();
export async function memberAccess(user, env) {
  const group = String(env.TELEGRAM_ALLOWED_GROUP_ID || '-1001803941686'),
    key = group + ':' + user.id;
  const cached = membershipCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.allowed;
  try {
    const response = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/getChatMember', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: group, user_id: Number(user.id) }),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) return null;
    const member = data.result;
    const allowed =
      ['creator', 'administrator', 'member'].includes(member.status) ||
      (member.status === 'restricted' && member.is_member === true);
    if (membershipCache.size > 1000) membershipCache.clear();
    membershipCache.set(key, { allowed, expires: Date.now() + 60000 });
    return allowed;
  } catch {
    return null;
  }
}
export async function requireMember(user, env) {
  const allowed = await memberAccess(user, env);
  return allowed === true
    ? null
    : json(
        {
          error:
            allowed === false
              ? 'Binottoland è riservato ai membri del gruppo.'
              : 'Verifica del gruppo temporaneamente non disponibile.'
        },
        allowed === false ? 403 : 503
      );
}

const encoder = new TextEncoder();
async function mac(key, text) {
  const k = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(text)));
}
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
export const telegramAccessTag = async env =>
  env.BOT_TOKEN ? hex(await mac(env.BOT_TOKEN, 'telegram-session-v1')) : null;
export async function login(req, env) {
  try {
    if (!env.BOT_TOKEN) return json({ error: 'BOT_TOKEN mancante.' }, 503);
    const body = await req.json();
    if (typeof body.initData !== 'string' || body.initData.length > 16384) throw Error();
    const p = new URLSearchParams(body.initData);
    if (p.getAll('hash').length !== 1) throw Error();
    const hash = p.get('hash');
    p.delete('hash');
    const keys = [...p.keys()];
    if (new Set(keys).size !== keys.length) throw Error();
    const checked = [...p.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => k + '=' + v)
      .join('\n');
    const secret = await mac('WebAppData', env.BOT_TOKEN);
    if (!hash || !secureEqual(hex(await mac(secret, checked)), hash)) throw Error();
    const age = Date.now() / 1000 - Number(p.get('auth_date'));
    if (!Number.isFinite(age) || age < -60 || age > 300) throw Error();
    const u = JSON.parse(p.get('user') || 'null');
    if (!u || !Number.isSafeInteger(u.id) || u.id <= 0) throw Error();
    const user = {
      id: String(u.id),
      player: 'tg:' + u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 60) || 'Utente Telegram',
      username: typeof u.username === 'string' ? u.username.slice(0, 40) : '',
      photo:
        typeof u.photo_url === 'string' && u.photo_url.startsWith('https://') && u.photo_url.length <= 512
          ? u.photo_url
          : ''
    };
    return issueSession(user, env);
  } catch {
    return json(
      { error: 'Accesso Telegram non valido o scaduto. Chiudi e riapri la Mini App dal bot.' },
      401
    );
  }
}
export async function issueSession(user, env) {
  const denied = await requireMember(user, env);
  if (denied) return denied;
  const accessTag = await telegramAccessTag(env);
  const payload = btoa(
    String.fromCharCode(
      ...encoder.encode(JSON.stringify({ user, accessTag, expires: Date.now() + 12 * 3600000 }))
    )
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  const token = 'session.' + payload + '.' + hex(await mac(env.BOT_TOKEN, 'session.' + payload));
  const response = json({ user, token });
  response.headers.append(
    'Set-Cookie',
    'binottoland_cinema=' +
      token +
      '; Max-Age=43200; Path=/api/cinema/; HttpOnly; Secure; SameSite=None; Partitioned'
  );
  return response;
}
export async function sessionUser(req, env) {
  try {
    const offered = (req.headers.get('Sec-WebSocket-Protocol') || '').split(',').map(x => x.trim());
    const token =
      (req.headers.get('Authorization') || '').replace(/^Bearer /, '') ||
      offered.find(x => x.startsWith('session.'));
    const m = String(token || '').match(/^session\.([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/);
    if (!m || !env.BOT_TOKEN || !secureEqual(hex(await mac(env.BOT_TOKEN, 'session.' + m[1])), m[2]))
      return null;
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(m[1].replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
      )
    );
    if (payload.accessTag !== (await telegramAccessTag(env))) return null;
    if (
      !Number.isFinite(payload.expires) ||
      payload.expires <= Date.now() ||
      !/^\d{1,20}$/.test(payload.user?.id) ||
      payload.user?.player !== 'tg:' + payload.user.id
    )
      return null;
    return { ...payload.user, sessionExpires: payload.expires };
  } catch {
    return null;
  }
}
