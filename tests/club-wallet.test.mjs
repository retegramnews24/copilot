// Portafoglio del circolo (club-wallet.js, docs/gettoni.md): 50 BTN a testa all'inizio, cambio 1 · 5 · 10 BTN in
// gettoni (5 per BTN), cibo a 1 BTN (popcorn e cola insieme 2), 1 gettone a partita, 5 gettoni nel vassoio della macchinetta a chi
// vince o batte il record personale, Lega Giochi a 1 BTN a settimana con una settimana di credito; un messaggio rimandato non si paga
// due volte.
import assert from 'node:assert/strict';
import {
  readWallet,
  useWallet,
  walletCost,
  walletKey,
  walletId,
  prizeWinners,
  payGame,
  serverRecord,
  hasLeague,
  walletMessage,
  PRIZE_GETTONI,
  WALLET_START,
  WEEK
} from '../club-wallet.js';
import { MACHINES, machineUse } from '../club-machines.js';

const store = new Map();
const ctx = { storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
const anna = { user: { id: 11, name: 'Anna' } },
  bruno = { user: { id: 12, name: 'Bruno' } };
const S = WALLET_START;
assert.equal(S, 50);

// all'inizio: 50 BTN, 0 gettoni, senza scrivere niente
const first = await readWallet(ctx, anna);
assert.equal(first.btn, S);
assert.equal(first.gettoni, 0);
assert.equal(store.size, 0);
assert.equal(await readWallet(ctx, {}), null);

// cambio: 5 BTN → 25 gettoni; rimandato non si paga due volte
let w = await useWallet(ctx, anna, { type: 'wallet-change', btn: 5, ref: 1 });
assert.equal(w.ok, true);
assert.equal(w.btn, S - 5);
// i gettoni cadono nel vassoio della macchinetta: si prendono (wallet-take) e vanno nel saldo
assert.equal(w.gettoni, 0);
assert.deepEqual(w.vassoio, { coin: { gettoni: 25, btn: 0 } });
w = await useWallet(ctx, anna, { type: 'wallet-take', m: 'coin', ref: 2 });
assert.equal(w.gettoni, 25);
assert.deepEqual(w.vassoio, {});
w = await useWallet(ctx, anna, { type: 'wallet-change', btn: 5, ref: 1 });
assert.equal(w.btn, S - 5);
for (const bad of [3, -10, '10'])
  assert.equal(await useWallet(ctx, anna, { type: 'wallet-change', btn: bad }), null);

// cibo: 1 BTN, popcorn e cola insieme 2
assert.deepEqual(walletCost({ type: 'wallet-pay', m: 'vend' }), { btn: 1, gettoni: 0 });
assert.deepEqual(walletCost({ type: 'wallet-pay', m: 'pop', k: 'tutti' }), { btn: 2, gettoni: 0 });
assert.equal(walletCost({ type: 'wallet-pay', m: 'coin' }), null);
w = await useWallet(ctx, anna, { type: 'wallet-pay', m: 'pop', k: 'tutti', ref: 5 });
assert.equal(w.btn, S - 7);

// giochi: 1 gettone a partita; un gioco che non esiste non costa niente e non si accetta
w = await useWallet(ctx, anna, { type: 'wallet-play', game: 'acquedotto', ref: 6 });
assert.equal(w.ok, true);
assert.equal(w.gettoni, 24);
assert.equal(await useWallet(ctx, anna, { type: 'wallet-play', game: 'cinema' }), null);
// premio: 5 gettoni nel vassoio della macchinetta del cambio, solo per chi vince
assert.equal(PRIZE_GETTONI, 5);
// record: il primo punteggio fissa il record, il secondo (con un'altra partita pagata) se più alto vince il premio
w = await useWallet(ctx, anna, { type: 'wallet-record', game: 'acquedotto', score: 3, ref: 7 });
assert.equal(w.ok, true);
assert.equal(w.prize, undefined);
assert.equal(w.btn, S - 7);
// senza un'altra partita pagata il punteggio non conta
w = await useWallet(ctx, anna, { type: 'wallet-record', game: 'acquedotto', score: 9, ref: 8 });
assert.equal(w.ok, false);
await useWallet(ctx, anna, { type: 'wallet-play', game: 'acquedotto', ref: 9 });
w = await useWallet(ctx, anna, { type: 'wallet-record', game: 'acquedotto', score: 5, ref: 10 });
assert.equal(w.prize, 5);
assert.equal(w.btn, S - 7);
assert.deepEqual(w.vassoio, { coin: { gettoni: 5, btn: 0 } });
// punteggio più basso: niente
await useWallet(ctx, anna, { type: 'wallet-play', game: 'acquedotto', ref: 11 });
w = await useWallet(ctx, anna, { type: 'wallet-record', game: 'acquedotto', score: 4, ref: 12 });
assert.equal(w.prize, undefined);
assert.equal(w.vassoio.coin.gettoni, 5);
// gara vinta (Ruggine 89, Pong contro il computer): il premio
await useWallet(ctx, anna, { type: 'wallet-play', game: 'ruggine-89', ref: 13 });
w = await useWallet(ctx, anna, { type: 'wallet-record', game: 'ruggine-89', win: true, ref: 14 });
assert.equal(w.prize, 5);
assert.equal(w.btn, S - 7);
assert.equal(w.vassoio.coin.gettoni, 10);

// senza gettoni non si gioca
store.set(walletKey(12), { btn: 3, gettoni: 0 });
w = await useWallet(ctx, bruno, { type: 'wallet-play', game: 'pong', ref: 20 });
assert.equal(w.ok, false);
assert.equal(await payGame(ctx, 12, 'balilla'), false);
store.set(walletKey(12), { btn: 3, gettoni: 1 });
assert.equal(await payGame(ctx, 12, 'balilla'), true);
assert.equal((await readWallet(ctx, bruno)).gettoni, 0);
// mai sotto zero con cibo o cambio
w = await useWallet(ctx, bruno, { type: 'wallet-change', btn: 5, ref: 21 });
assert.equal(w.ok, false);
assert.equal(w.btn, 3);

// vincitori dei tavoli, biliardo, F1, golf: il premio a ognuno, i bot no
assert.equal(walletId('tg:12'), '12');
assert.equal(walletId('bot:1'), null);
const paid = await prizeWinners(ctx, [{ id: 'tg:12' }, { id: 'bot:1' }, { id: 'tg:12' }]);
assert.deepEqual(paid, ['12']);
assert.equal((await readWallet(ctx, bruno)).btn, 3);
assert.deepEqual((await readWallet(ctx, bruno)).vassoio, { coin: { gettoni: 5, btn: 0 } });
// flipper: record personale controllato dal server
assert.equal(await serverRecord(ctx, 12, 'flipper-gp', 1000), 0);
assert.equal(await serverRecord(ctx, 12, 'flipper-gp', 900), 0);
assert.equal(await serverRecord(ctx, 12, 'flipper-gp', 2000), 5);
assert.equal((await readWallet(ctx, bruno)).btn, 3);
assert.equal((await readWallet(ctx, bruno)).vassoio.coin.gettoni, 10);

// Lega Giochi: 1 BTN per 7 giorni, rinnovo automatico, una settimana di credito, poi sospesa
const t0 = Date.UTC(2026, 10, 30),
  carla = { user: { id: 13 } };
store.set(walletKey(13), { btn: 2, gettoni: 0 });
assert.equal(await hasLeague(ctx, 13, t0), false);
w = await useWallet(ctx, carla, { type: 'wallet-league' }, t0);
assert.equal(w.ok, true);
assert.equal(w.btn, 1);
assert.equal(await hasLeague(ctx, 13, t0 + WEEK - 1), true);
assert.equal(walletMessage(w, {}, t0).lega, t0 + WEEK);
// una settimana dopo: si rinnova da solo con l'ultimo BTN
assert.equal(await hasLeague(ctx, 13, t0 + WEEK + 1), true);
assert.equal((await readWallet(ctx, carla, t0 + WEEK + 1)).btn, 0);
// due settimane dopo: senza BTN, una settimana di credito (saldo a -1)
assert.equal(await hasLeague(ctx, 13, t0 + 2 * WEEK + 1), true);
assert.equal((await readWallet(ctx, carla, t0 + 2 * WEEK + 1)).btn, -1);
// col credito non si compra niente
assert.equal((await useWallet(ctx, carla, { type: 'wallet-pay', m: 'vend' }, t0 + 2 * WEEK + 2)).ok, false);
// tre settimane dopo, ancora sotto zero: sospesa
assert.equal(await hasLeague(ctx, 13, t0 + 3 * WEEK + 1), false);
assert.equal((await readWallet(ctx, carla, t0 + 3 * WEEK + 1)).btn, -1);
// riscriversi serve 1 BTN vero
assert.equal((await useWallet(ctx, carla, { type: 'wallet-league' }, t0 + 3 * WEEK + 2)).ok, false);
// i premi sono gettoni nel vassoio: presi e cambiati in BTN pagano il debito e la Lega
await prizeWinners(ctx, [{ id: 'tg:13' }, { id: 'tg:13' }]);
await prizeWinners(ctx, [{ id: 'tg:13' }]);
assert.equal((await readWallet(ctx, carla, t0 + 3 * WEEK + 2)).btn, -1);
await useWallet(ctx, carla, { type: 'wallet-take', m: 'coin', ref: 30 }, t0 + 3 * WEEK + 2);
await useWallet(ctx, carla, { type: 'wallet-change', btn: 1, back: true, ref: 31 }, t0 + 3 * WEEK + 2);
await useWallet(ctx, carla, { type: 'wallet-change', btn: 1, back: true, ref: 32 }, t0 + 3 * WEEK + 2);
w = await useWallet(ctx, carla, { type: 'wallet-take', m: 'coin', ref: 33 }, t0 + 3 * WEEK + 2);
assert.equal(w.btn, 1);
assert.equal(w.gettoni, 0);
w = await useWallet(ctx, carla, { type: 'wallet-league' }, t0 + 3 * WEEK + 3);
assert.equal(w.ok, true);
assert.equal(w.btn, 0);

// dati rovinati nello storage: si riparte da valori validi
store.set(walletKey(14), { btn: -4, gettoni: 1.5, refs: 'x', lega: 'no' });
const fixed = await readWallet(ctx, { user: { id: 14 } });
assert.equal(fixed.btn, S);
assert.equal(fixed.gettoni, 0);
assert.equal(fixed.lega, null);

// la macchinetta dei gettoni si usa una persona alla volta, come le altre
assert.ok(MACHINES.includes('coin'));
const now = Date.now(),
  me = { user: { id: 1 }, inClub: true, seen: now },
  other = { user: { id: 2 }, inClub: true, seen: now, clubPose: { use: { m: 'coin' } } };
assert.equal(
  machineUse({ station: 'walk', use: { m: 'coin', k: '10', n: 1 } }, me, [me, other], now),
  undefined
);
assert.deepEqual(machineUse({ station: 'walk', use: { m: 'coin', k: '10', n: 1 } }, me, [me], now), {
  m: 'coin',
  k: '10',
  n: 1,
  t: 0
});
console.log('club-wallet: ok');
