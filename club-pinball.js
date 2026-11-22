// Classifica del flipper "Binottoland Grand Prix" (Lobby 3D): i 10 punteggi migliori con il nome del giocatore,
// uno per persona (il suo migliore). Il punteggio arriva dalla Lobby a fine partita; al massimo uno ogni 20 secondi.
export const PINBALL_TOP = 10;
export const PINBALL_MAX = 50_000_000;

export async function recordPinball(ctx, attachment, score) {
  const user = attachment?.user;
  if (!user?.id || !Number.isInteger(score) || score <= 0 || score > PINBALL_MAX) return false;
  const now = Date.now();
  if (now - (attachment.pinballAt || 0) < 20000) return false;
  attachment.pinballAt = now;
  const list = (await ctx.storage.get('pinballTop')) ?? [];
  const id = String(user.id),
    name = String(user.name || 'Giocatore').slice(0, 24);
  const best = list.find(entry => entry.id === id);
  if (best && best.score >= score) return false;
  const next = [...list.filter(entry => entry.id !== id), { id, name, score, at: now }]
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, PINBALL_TOP);
  await ctx.storage.put('pinballTop', next);
  return true;
}
