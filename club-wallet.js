// Portafoglio del circolo (docs/gettoni.md): Binottocoin (BTN) e gettoni, per persona, nello spazio della Lobby
// (chiave "wallet:<id>", id = numero Telegram). Chi non ce l'ha ancora parte con 50 BTN e 0 gettoni.
// - Cambio alla macchinetta dei gettoni: 1, 5 o 10 BTN, ogni BTN 5 gettoni.
// - Macchinette del cibo: 1 BTN a prodotto (popcorn e cola insieme 2).
// - Giochi: 1 gettone a partita (play). Ogni partita pagata lascia un «biglietto» per quel gioco: a fine partita il
//   telefono può dire il punteggio (record) e, se batte il record personale, prende 1 BTN.
// - Chi vince una partita (tavoli, biliardo, F1, golf, balilla, flipper…) prende 1 BTN (prize, dal server).
// - Lega Giochi Binottoland (sala tavoli): 1 BTN a settimana, pagato in anticipo, rinnovo automatico ogni 7 giorni.
//   Al rinnovo senza 1 BTN, una settimana di credito (saldo a -1, si paga col prossimo BTN che arriva); se il saldo è
//   già sotto zero l'iscrizione si sospende.
// I messaggi arrivano dalla Lobby con un numero (ref): il telefono li rimanda finché non riceve la conferma
// (public/lobby-link.js), quindi un numero già visto non si paga due volte. Il saldo va sotto zero solo per il
// credito della Lega (al massimo -1).
import { COIN_GAMES } from './public/coin-games.js';

export const WALLET_START = 50;
export const COIN_RATE = 5;
export const CHANGE_STEPS = [1, 5, 10];
export const FOOD_PRICE = { vend: 1, dog: 1, pop: 1, 'pop-tutti': 2 };
export const LEAGUE_PRICE = 1;
export const WEEK = 7 * 24 * 3600 * 1000;
// giochi che si pagano con un gettone: l'elenco è uno solo, in public/coin-games.js
export { COIN_GAMES };
const REFS = 12; // numeri recenti ricordati
const TICKETS = 5; // biglietti tenuti per gioco
export const walletKey = id => 'wallet:' + id;
// id del portafoglio da un giocatore dei tavoli ('tg:123' → 123); i bot non hanno portafoglio
export const walletId = player => {
  const s = String(player ?? '');
  return /^tg:\d+$/.test(s) ? s.slice(3) : /^\d+$/.test(s) ? s : null;
};

const intOr = (v, d, min = 0) => (Number.isInteger(v) && v >= min ? v : d);
const clean = w => ({
  btn: intOr(w?.btn, WALLET_START, -1),
  gettoni: intOr(w?.gettoni, 0),
  refs: Array.isArray(w?.refs) ? w.refs.filter(Number.isFinite).slice(-REFS) : [],
  lega:
    w?.lega && Number.isFinite(w.lega.until)
      ? { until: w.lega.until, ...(w.lega.off ? { off: true } : {}) }
      : null,
  best: w?.best && typeof w.best === 'object' ? { ...w.best } : {},
  tickets: w?.tickets && typeof w.tickets === 'object' ? { ...w.tickets } : {}
});

// rinnovo automatico della Lega: una settimana alla volta, finché si arriva a oggi
export function renewLeague(w, now = Date.now()) {
  let changed = false;
  for (let i = 0; i < 520 && w.lega && !w.lega.off && w.lega.until <= now; i++) {
    if (w.btn >= LEAGUE_PRICE) w.btn -= LEAGUE_PRICE;
    else if (w.btn === 0)
      w.btn = -1; // una settimana di credito
    else {
      w.lega = { until: w.lega.until, off: true }; // ancora sotto zero: sospesa
      changed = true;
      break;
    }
    w.lega = { until: w.lega.until + WEEK };
    changed = true;
  }
  return changed;
}
export const leagueActive = (w, now = Date.now()) => !!w?.lega && !w.lega.off && w.lega.until > now;

async function load(ctx, id, now) {
  const w = clean(await ctx.storage.get(walletKey(id)));
  if (renewLeague(w, now)) await ctx.storage.put(walletKey(id), w);
  return w;
}

export async function readWallet(ctx, attachment, now = Date.now()) {
  const id = attachment?.user?.id;
  if (id == null) return null;
  return load(ctx, id, now);
}

// cosa fa un messaggio del telefono: {btn: BTN da togliere, gettoni: da aggiungere (o togliere), …}
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
  if (b?.type === 'wallet-play')
    return COIN_GAMES.includes(b.game) ? { btn: 0, gettoni: -1, game: b.game } : null;
  if (b?.type === 'wallet-league') return { btn: LEAGUE_PRICE, gettoni: 0, league: true };
  // record (score) o vittoria (win: gara vinta contro l'IA, per esempio a Ruggine 89)
  if (b?.type === 'wallet-record' && COIN_GAMES.includes(b.game)) {
    if (b.win === true) return { btn: 0, gettoni: 0, game: b.game, record: -1, win: true };
    return Number.isFinite(b.score) && b.score >= 0
      ? { btn: 0, gettoni: 0, game: b.game, record: b.score }
      : null;
  }
  return null;
}

// fa il cambio, il pagamento, la partita, l'iscrizione o il record; risponde con il saldo, se è andato (ok) e se ha
// dato un premio (prize)
export async function useWallet(ctx, attachment, b, now = Date.now()) {
  const id = attachment?.user?.id,
    cost = walletCost(b);
  if (id == null || !cost) return null;
  const w = await load(ctx, id, now),
    ref = Number.isFinite(b.ref) ? b.ref : null;
  if (ref != null && w.refs.includes(ref)) return { ...w, ok: true, again: true };
  let prize = 0;
  if (cost.league) {
    if (leagueActive(w, now)) return { ...w, ok: true };
    if (w.btn < LEAGUE_PRICE) return { ...w, ok: false };
    w.btn -= LEAGUE_PRICE;
    w.lega = { until: now + WEEK };
  } else if (cost.record != null) {
    // un punteggio per partita pagata; il primo fissa il record, poi ogni record battuto vale 1 BTN
    if (!(w.tickets[cost.game] > 0)) return { ...w, ok: false };
    w.tickets[cost.game]--;
    const best = w.best[cost.game];
    if (cost.win) prize = 1;
    else {
      if (Number.isFinite(best) && cost.record > best) prize = 1;
      if (!Number.isFinite(best) || cost.record > best) w.best[cost.game] = cost.record;
    }
    w.btn += prize;
  } else {
    if (w.btn < cost.btn || w.gettoni + cost.gettoni < 0) return { ...w, ok: false };
    w.btn -= cost.btn;
    w.gettoni += cost.gettoni;
    if (cost.game) w.tickets[cost.game] = Math.min(TICKETS, (w.tickets[cost.game] || 0) + 1);
  }
  if (ref != null) w.refs = [...w.refs, ref].slice(-REFS);
  await ctx.storage.put(walletKey(id), w);
  return { ...w, ok: true, ...(prize ? { prize } : {}) };
}

// dal server: premio di n BTN a una persona (id Telegram); paga anche il debito della Lega
export async function prize(ctx, id, n = 1, now = Date.now()) {
  if (id == null) return null;
  const w = await load(ctx, id, now);
  w.btn += n;
  await ctx.storage.put(walletKey(id), w);
  return w;
}
// i vincitori di un risultato (tavoli, biliardo, F1, golf): 1 BTN a ognuno che non è un bot
export async function prizeWinners(ctx, winners, now = Date.now()) {
  const paid = [];
  for (const p of Array.isArray(winners) ? winners : []) {
    const id = walletId(p?.id);
    if (id && !paid.includes(id)) {
      await prize(ctx, id, 1, now);
      paid.push(id);
    }
  }
  return paid;
}
// dal server: una partita pagata con un gettone (flipper, balilla); false se non ha gettoni
export async function payGame(ctx, id, game, now = Date.now()) {
  if (id == null || !COIN_GAMES.includes(game)) return false;
  const w = await load(ctx, id, now);
  if (w.gettoni < 1) return false;
  w.gettoni--;
  await ctx.storage.put(walletKey(id), w);
  return true;
}
// dal server: punteggio di fine partita già controllato (flipper); 1 BTN se batte il record personale
export async function serverRecord(ctx, id, game, score, now = Date.now()) {
  if (id == null || !Number.isFinite(score)) return 0;
  const w = await load(ctx, id, now),
    best = w.best[game];
  if (Number.isFinite(best) && score <= best) return 0;
  const won = Number.isFinite(best) ? 1 : 0;
  w.best[game] = score;
  w.btn += won;
  await ctx.storage.put(walletKey(id), w);
  return won;
}
export async function hasLeague(ctx, id, now = Date.now()) {
  return id != null && leagueActive(await load(ctx, id, now), now);
}

// messaggio per il telefono (senza i numeri ricordati e i biglietti)
export const walletMessage = (w, extra = {}, now = Date.now()) => ({
  type: 'wallet',
  btn: w.btn,
  gettoni: w.gettoni,
  lega: leagueActive(w, now) ? w.lega.until : 0,
  ...(w.lega?.off ? { legaSospesa: true } : {}),
  ...extra
});
