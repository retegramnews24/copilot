// Classifiche dei flipper della Lobby 3D ("Binottoland Grand Prix" e "Binotto GT"): per ogni tavolo i 10 punteggi
// migliori con il nome del giocatore, uno per persona (il suo migliore). Il punteggio arriva dalla Lobby a fine
// partita; al massimo uno ogni 20 secondi per tavolo.
// Contro i punteggi inventati: la partita va annunciata all'inizio (messaggio "pinball-start") e il punteggio di fine
// partita non può superare quello che si fa in quel tempo (PINBALL_RATE punti al secondo, molto più di una partita
// vera). Un punteggio falso già in classifica si toglie con il comando di amministrazione (removePinball).
// L'inizio si salva per persona nello spazio della Lobby (chiave "pinballStart:<id>"), non nel collegamento: il
// telefono apre un collegamento nuovo ogni volta che torna in primo piano o che la rete cade un attimo, e con
// l'inizio scritto nel collegamento vecchio il punteggio di fine partita veniva scartato.
export const PINBALL_TOP = 10;
export const PINBALL_MAX = 50_000_000;
export const PINBALL_RATE = 20000; // punti al secondo al massimo, più PINBALL_GRACE
export const PINBALL_GRACE = 5000;
export const PINBALL_GAME_MAX = 3 * 3600000; // un inizio più vecchio di 3 ore non vale più
export const PINBALL_START_GAP = 2000; // al massimo un annuncio ogni 2 secondi per tavolo (ogni annuncio è una scrittura)
// tavolo → chiave nello storage (il Grand Prix tiene la chiave di prima)
export const PINBALL_KEYS = { gp: 'pinballTop', gt: 'pinballTopGT' };
export const pinballStartKey = id => 'pinballStart:' + id;

// inizio partita (dal telefono): si segna l'ora, per persona e per tavolo. Il telefono rimanda l'inizio dopo una
// riapertura finché non riceve la conferma (public/lobby-link.js), con lo stesso numero (ref): un inizio rimandato
// non sposta l'ora, altrimenti il punteggio di fine partita sembrerebbe fatto in meno tempo.
export async function startPinball(ctx, attachment, table = 'gp', ref = null) {
  const id = attachment?.user?.id;
  if (!PINBALL_KEYS[table] || id == null) return false;
  const now = Date.now(),
    starts = (await ctx.storage.get(pinballStartKey(id))) ?? {};
  if (ref != null && starts.refs?.[table] === ref && now - starts[table] < PINBALL_GAME_MAX) return false;
  if (now - (starts[table] || 0) < PINBALL_START_GAP) return false;
  const refs = { ...starts.refs };
  if (ref != null) refs[table] = ref;
  else delete refs[table];
  await ctx.storage.put(pinballStartKey(id), { ...starts, [table]: now, refs });
  return true;
}

// valid(score): chiamata quando il punteggio è buono (partita annunciata e punteggio possibile), anche se non entra
// in classifica: serve al premio del record personale (club-wallet.js)
export async function recordPinball(ctx, attachment, score, table = 'gp', valid = null) {
  const user = attachment?.user,
    key = PINBALL_KEYS[table];
  if (!key || !user?.id || !Number.isInteger(score) || score <= 0 || score > PINBALL_MAX) return false;
  const now = Date.now(),
    stamp = table === 'gp' ? 'pinballAt' : 'pinballAt_' + table;
  // partita annunciata (da questo collegamento o da uno precedente della stessa persona) e punteggio possibile
  // per la sua durata
  const { [table]: started, refs = {}, ...others } = (await ctx.storage.get(pinballStartKey(user.id))) ?? {};
  if (!Number.isFinite(started) || started > now || now - started > PINBALL_GAME_MAX) return false;
  if (score > PINBALL_GRACE + (PINBALL_RATE * (now - started)) / 1000) return false;
  if (now - (attachment[stamp] || 0) < 20000) return false;
  attachment[stamp] = now;
  // un punteggio per partita annunciata
  if (Object.keys(others).length) await ctx.storage.put(pinballStartKey(user.id), { ...others, refs });
  else await ctx.storage.delete(pinballStartKey(user.id));
  await valid?.(score);
  const list = (await ctx.storage.get(key)) ?? [];
  const id = String(user.id),
    name = String(user.name || 'Giocatore').slice(0, 24);
  const best = list.find(entry => entry.id === id);
  if (best && best.score >= score) return false;
  const next = [...list.filter(entry => entry.id !== id), { id, name, score, at: now }]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, PINBALL_TOP);
  await ctx.storage.put(key, next);
  return true;
}

// amministrazione: toglie dalla classifica di un tavolo il punteggio di una persona
export async function removePinball(ctx, table, id) {
  const key = PINBALL_KEYS[table];
  if (!key || id == null) return false;
  const list = (await ctx.storage.get(key)) ?? [];
  const next = list.filter(entry => entry.id !== String(id));
  if (next.length === list.length) return false;
  await ctx.storage.put(key, next);
  return true;
}
