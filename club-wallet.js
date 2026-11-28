// Portafoglio del circolo (docs/gettoni.md): Binottocoin (BTN) e gettoni, per persona, nello spazio della Lobby
// (chiave "wallet:<id>"). Chi non ce l'ha ancora parte con 100 BTN e 0 gettoni.
// - Cambio alla macchinetta dei gettoni: 1, 5 o 10 BTN, ogni BTN 5 gettoni.
// - Macchinette del cibo: 1 BTN a prodotto (popcorn e cola insieme 2).
// I messaggi arrivano dalla Lobby con un numero (ref): il telefono li rimanda finché non riceve la conferma
// (public/lobby-link.js), quindi un numero già visto non si paga due volte. Il saldo non va mai sotto zero.
export const WALLET_START = 100;
export const COIN_RATE = 5;
export const CHANGE_STEPS = [1, 5, 10];
export const FOOD_PRICE = { vend: 1, dog: 1, pop: 1, 'pop-tutti': 2 };
const REFS = 12; // numeri recenti ricordati
export const walletKey = id => 'wallet:' + id;

const clean = w => ({
  btn: Number.isInteger(w?.btn) && w.btn >= 0 ? w.btn : WALLET_START,
  gettoni: Number.isInteger(w?.gettoni) && w.gettoni >= 0 ? w.gettoni : 0,
  refs: Array.isArray(w?.refs) ? w.refs.filter(Number.isFinite).slice(-REFS) : []
});

export async function readWallet(ctx, attachment) {
  const id = attachment?.user?.id;
  if (id == null) return null;
  return clean(await ctx.storage.get(walletKey(id)));
}

// prezzo di un messaggio: {type:'wallet-change', btn} → cambio; {type:'wallet-pay', m, k} → cibo
export function walletCost(b) {
  if (b?.type === 'wallet-change') {
    if (!CHANGE_STEPS.includes(b.btn)) return null;
    return { btn: b.btn, gettoni: b.btn * COIN_RATE };
  }
  if (b?.type === 'wallet-pay') {
    const key = b.m === 'pop' && b.k === 'tutti' ? 'pop-tutti' : b.m;
    const price = FOOD_PRICE[key];
    return price ? { btn: price, gettoni: 0 } : null;
  }
  return null;
}

// fa il cambio o il pagamento; risponde con il saldo e se è andato (ok) o se il saldo non bastava
export async function useWallet(ctx, attachment, b) {
  const id = attachment?.user?.id,
    cost = walletCost(b);
  if (id == null || !cost) return null;
  const w = clean(await ctx.storage.get(walletKey(id))),
    ref = Number.isFinite(b.ref) ? b.ref : null;
  if (ref != null && w.refs.includes(ref)) return { ...w, ok: true, again: true };
  if (w.btn < cost.btn) return { ...w, ok: false };
  const next = {
    btn: w.btn - cost.btn,
    gettoni: w.gettoni + cost.gettoni,
    refs: ref != null ? [...w.refs, ref].slice(-REFS) : w.refs
  };
  await ctx.storage.put(walletKey(id), next);
  return { ...next, ok: true };
}

// messaggio per il telefono (senza i numeri ricordati)
export const walletMessage = (w, extra = {}) => ({
  type: 'wallet',
  btn: w.btn,
  gettoni: w.gettoni,
  ...extra
});
