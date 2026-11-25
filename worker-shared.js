// Small helpers shared by the Worker entry, the Room Durable Object and the route modules.
export const BOT_USERNAME = 'checkmategame_bot';
export const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
// Errori nelle richieste dei giochi e dei tavoli: i messaggi voluti («Non tocca a te») sono Error semplici e arrivano
// al giocatore così come sono; gli errori di programmazione (TypeError, ReferenceError, RangeError…) si scrivono nei
// log e il giocatore vede un messaggio generico. Prima diventavano tutti un 409 con il testo grezzo in inglese e nei
// log non restava niente.
export function failure(e, status = 409, where = '') {
  if (e instanceof SyntaxError) return json({ error: 'Richiesta non valida.' }, 400);
  if (!(e instanceof Error) || e.constructor !== Error) {
    console.error(
      JSON.stringify({
        type: 'game-error',
        where,
        message: String(e?.message || e).slice(0, 500),
        stack: String(e?.stack || '').slice(0, 2000)
      })
    );
    return json({ error: 'Errore del server: riprova tra poco.' }, 500);
  }
  return json({ error: e.message }, status);
}
export const id = () => crypto.randomUUID();
export const bad = message => {
  throw new Error(message);
};
export const name = x => {
  if (typeof x !== 'string' || !x.trim()) bad('Inserisci un nome.');
  return x.trim().slice(0, 30);
};
// Singleton Durable Objects (all of class Room, addressed by name).
// Long-turn games: one queue of private bot messages ("tocca a te"), see turn-notices.js.
export const noticeHub = env => env.ROOMS.get(env.ROOMS.idFromName('turn-notices-v1'));
export const lobbyHub = env => env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));

// Percorsi interni (tra oggetti del server): ripristino dei backup, risultati, coda degli avvisi, rimozione dal
// flipper. Chi li chiama mette la chiave interna (derivata dal segreto del bot) e l'oggetto la controlla: se un giorno
// una riga di api.js li esponesse per errore, da fuori risponderebbero comunque "non trovato". api.js toglie
// sempre questa intestazione dalle richieste dei telefoni.
export const INTERNAL_HEADER = 'X-Binottoland-Internal';
export const INTERNAL_PATHS = new Set([
  '/backup/import',
  '/lobby/result',
  '/notices/queue',
  '/pinball/remove'
]);
let internalCache = null;
export async function internalKey(env) {
  if (!env?.BOT_TOKEN) return null;
  if (internalCache?.token === env.BOT_TOKEN) return internalCache.key;
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.BOT_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('internal-v1')));
  const key = [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
  internalCache = { token: env.BOT_TOKEN, key };
  return key;
}
// intestazioni per una chiamata interna
export async function internalHeaders(env, extra = {}) {
  const key = await internalKey(env);
  return key ? { ...extra, [INTERNAL_HEADER]: key } : extra;
}
export async function isInternal(req, env) {
  const key = await internalKey(env);
  const got = req.headers.get(INTERNAL_HEADER) || '';
  if (!key || got.length !== key.length) return false;
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
