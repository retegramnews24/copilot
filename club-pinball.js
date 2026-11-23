// Classifiche dei flipper della Lobby 3D ("Binottoland Grand Prix" e "Binotto GT"): per ogni tavolo i 10 punteggi
// migliori con il nome del giocatore, uno per persona (il suo migliore). Il punteggio arriva dalla Lobby a fine
// partita; al massimo uno ogni 20 secondi per tavolo.
export const PINBALL_TOP = 10;
export const PINBALL_MAX = 50_000_000;
// tavolo → chiave nello storage (il Grand Prix tiene la chiave di prima)
export const PINBALL_KEYS = { gp: 'pinballTop', gt: 'pinballTopGT' };

export async function recordPinball(ctx, attachment, score, table = 'gp') {
  const user = attachment?.user,
    key = PINBALL_KEYS[table];
  if (!key || !user?.id || !Number.isInteger(score) || score <= 0 || score > PINBALL_MAX) return false;
  const now = Date.now(),
    stamp = table === 'gp' ? 'pinballAt' : 'pinballAt_' + table;
  if (now - (attachment[stamp] || 0) < 20000) return false;
  attachment[stamp] = now;
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
