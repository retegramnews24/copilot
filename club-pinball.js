// Classifiche dei flipper della Lobby 3D ("Binottoland Grand Prix" e "Binotto GT"): per ogni tavolo i 10 punteggi
// migliori con il nome del giocatore, uno per persona (il suo migliore). Il punteggio arriva dalla Lobby a fine
// partita; al massimo uno ogni 20 secondi per tavolo.
// Contro i punteggi inventati: la partita va annunciata all'inizio (messaggio "pinball-start") e il punteggio di fine
// partita non può superare quello che si fa in quel tempo (PINBALL_RATE punti al secondo, molto più di una partita
// vera). Un punteggio falso già in classifica si toglie con il comando di amministrazione (removePinball).
export const PINBALL_TOP = 10;
export const PINBALL_MAX = 50_000_000;
export const PINBALL_RATE = 20000; // punti al secondo al massimo, più PINBALL_GRACE
export const PINBALL_GRACE = 5000;
// tavolo → chiave nello storage (il Grand Prix tiene la chiave di prima)
export const PINBALL_KEYS = { gp: 'pinballTop', gt: 'pinballTopGT' };
const startKey = table => (table === 'gp' ? 'pinballStart' : 'pinballStart_' + table);

// inizio partita (dal telefono): si segna l'ora nel collegamento
export function startPinball(attachment, table = 'gp') {
  if (!PINBALL_KEYS[table]) return false;
  attachment[startKey(table)] = Date.now();
  return true;
}

export async function recordPinball(ctx, attachment, score, table = 'gp') {
  const user = attachment?.user,
    key = PINBALL_KEYS[table];
  if (!key || !user?.id || !Number.isInteger(score) || score <= 0 || score > PINBALL_MAX) return false;
  const now = Date.now(),
    stamp = table === 'gp' ? 'pinballAt' : 'pinballAt_' + table;
  // partita annunciata e punteggio possibile per la sua durata
  const started = attachment[startKey(table)];
  if (!Number.isFinite(started) || started > now) return false;
  if (score > PINBALL_GRACE + (PINBALL_RATE * (now - started)) / 1000) return false;
  if (now - (attachment[stamp] || 0) < 20000) return false;
  attachment[stamp] = now;
  delete attachment[startKey(table)]; // un punteggio per partita annunciata
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
