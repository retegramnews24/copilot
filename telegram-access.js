const allowed = new Set(['creator', 'administrator', 'member']);
const cache = new Map();
const pending = new Map();
const ACCESS_TTL = 60_000;
const CACHE_LIMIT = 1024;
export const GROUP_DENIED = 'Binottoland è riservato ai membri di Binotto Corsa Competizione.';
export const GROUP_UNAVAILABLE = 'Verifica del gruppo Telegram non disponibile. Riprova tra poco.';
export const GROUP_FORBIDDEN_CLOSE = 4403;

export function groupPolicy(env) {
  if (env.TELEGRAM_ALLOWED_GROUP_ID == null && env.TELEGRAM_GROUP_ACCESS_REQUIRED !== '1') return null;
  const id = String(env.TELEGRAM_ALLOWED_GROUP_ID ?? '').trim();
  return /^-\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) < 0 ? id : '';
}

export function isTelegramMember(member) {
  return allowed.has(member?.status) || (member?.status === 'restricted' && member.is_member === true);
}

export async function telegramBotResult(token, method, payload) {
  try {
    const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST', redirect: 'manual', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload), signal: AbortSignal.timeout(5500)
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.ok === true ? data.result : null;
  } catch {
    return null;
  }
}

function cachedAccess(key) {
  const saved = cache.get(key);
  return saved?.until > Date.now() ? saved : null;
}

function lookupGroupAccess(env, group, user, key) {
  const request = pending.get(key);
  if (request) return request;
  if (pending.size >= CACHE_LIMIT) return Promise.resolve({status: 503, until: Date.now()});
  const lookup = telegramBotResult(env.BOT_TOKEN, 'getChatMember', {chat_id: Number(group), user_id: Number(user)})
    .then(member => {
      const status = isTelegramMember(member) ? 200
        : ['left', 'kicked', 'restricted'].includes(member?.status) ? 403 : 503;
      const until = Date.now() + (status === 200 ? ACCESS_TTL : status === 403 ? 15_000 : 3000);
      const result = {status, until};
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
      cache.set(key, result);
      return result;
    }).finally(() => pending.delete(key));
  pending.set(key, lookup);
  return lookup;
}

export function checkGroupAccess(env, user, proofUntil = 0) {
  const group = groupPolicy(env);
  if (group === null) return {status: 200, until: 0};
  if (!group || !env.BOT_TOKEN || !/^[1-9]\d*$/.test(user ?? '') ||
      !Number.isSafeInteger(Number(user))) return {status: 503, until: 0};
  const key = env.BOT_TOKEN + ':' + group + ':' + user;
  const saved = cachedAccess(key);
  if (saved) return saved;
  if (proofUntil > Date.now()) return {status: 200, until: proofUntil};
  return lookupGroupAccess(env, group, user, key);
}

export function socketGroupAccess(req) {
  const raw = req.headers.get('X-Group-Access');
  return raw ? JSON.parse(raw) : null;
}

export class GroupSockets {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.queue = new WeakMap();
    this.checked = new WeakMap();
  }

  authorize(socket) {
    const group = groupPolicy(this.env);
    if (group === null) return true;
    const proof = socket.deserializeAttachment()?.groupAccess;
    if (!proof || proof.group !== group || proof.expires <= Date.now()) {
      this.close(socket, 4001, 'Riapri la Mini App');
      return false;
    }
    const checkedUntil = this.checked.get(socket) ?? proof.until;
    const access = checkGroupAccess(this.env, proof.user, checkedUntil);
    const apply = result => {
      if (result.status === 200 && proof.expires > Date.now()) {
        this.checked.set(socket, result.until);
        return true;
      }
      if (result.status === 403) this.close(socket, GROUP_FORBIDDEN_CLOSE, 'Accesso al gruppo richiesto');
      else if (proof.expires <= Date.now()) this.close(socket, 4001, 'Riapri la Mini App');
      else this.close(socket, 1013, 'Verifica Telegram non disponibile');
      return false;
    };
    return access instanceof Promise ? access.then(apply) : apply(access);
  }

  close(socket, code, reason) {
    try { socket.close(code, reason); } catch {}
  }

  send(socket, data, closeAfter = false) {
    const deliver = permitted => {
      if (!permitted) return;
      try {
        socket.send(data);
        if (closeAfter) socket.close(1000, 'Partita eliminata');
      } catch {}
    };
    const access = this.authorize(socket);
    if (!(access instanceof Promise)) {
      deliver(access);
      return;
    }
    // A slow Telegram check must not leave an unbounded queue of game frames.
    const queued = this.queue.get(socket) ?? 0;
    if (queued >= 128) {
      this.close(socket, 1013, 'Verifica Telegram in corso');
      return;
    }
    this.queue.set(socket, queued + 1);
    this.ctx.waitUntil(access.then(deliver).finally(() => {
      const remaining = this.queue.get(socket) - 1;
      if (remaining) this.queue.set(socket, remaining);
      else this.queue.delete(socket);
    }));
  }
}
