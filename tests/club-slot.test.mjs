// Slot machine della sala giochi (docs/slot.md, public/slot-rules.js, club-wallet.js): puntata 1 · 2 · 3 gettoni,
// vincite in gettoni per la puntata, jackpot in BTN uno solo per le tre macchine (parte da 5, +1 ogni 25 gettoni
// giocati), circa il 110% restituito; un giro rimandato non si rifà. Più il cambio indietro, gettoni → BTN.
import assert from 'node:assert/strict';
import { useWallet, walletCost, readJackpot, JACKPOT_KEY, WALLET_START } from '../club-wallet.js';
import { slotWin, slotOdds, pickSymbol, SYMBOLS, WEIGHTS, WEIGHT_TOTAL, PAYS } from '../public/slot-rules.js';

const store = new Map();
const ctx = { storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
const anna = { user: { id: 21, name: 'Anna' } },
  bruno = { user: { id: 22, name: 'Bruno' } };

// regole
const odds = slotOdds();
assert.ok(odds.total > 1.08 && odds.total < 1.12, 'restituisce circa il 110%: ' + odds.total);
assert.ok(odds.jackpot > 1 / 3300 && odds.jackpot < 1 / 2700, 'jackpot circa 1 su 3.000');
assert.equal(SYMBOLS.length, 10);
assert.equal(WEIGHT_TOTAL, 144);
assert.deepEqual(slotWin(['pagliaccio', 'pagliaccio', 'pagliaccio']), { gettoni: 0, jackpot: true, combo: 'jackpot' });
assert.equal(slotWin(['sette', 'sette', 'sette']).gettoni, PAYS.sette);
assert.equal(slotWin(['bar', 'barbar', 'bar']).gettoni, PAYS.barMisti);
assert.equal(slotWin(['limone', 'ciliegia', 'ciliegia']).gettoni, PAYS.ciliegia2);
assert.equal(slotWin(['limone', 'arancia', 'prugna']).gettoni, 0);
assert.equal(pickSymbol(0), 'ciliegia');
assert.equal(pickSymbol(0.99999), 'pagliaccio');
assert.equal(pickSymbol((WEIGHT_TOTAL - WEIGHTS.pagliaccio - 0.5) / WEIGHT_TOTAL), 'btn');

// messaggi
assert.deepEqual(walletCost({ type: 'wallet-slot', bet: 2, m: 'oro' }), { slot: true, bet: 2, m: 'oro' });
for (const bad of [{ bet: 4, m: 'oro' }, { bet: 1, m: 'blu' }, { bet: '1', m: 'rossa' }])
  assert.equal(walletCost({ type: 'wallet-slot', ...bad }), null);

// senza gettoni non gira
let w = await useWallet(ctx, anna, { type: 'wallet-slot', bet: 1, m: 'rossa', ref: 1 });
assert.equal(w.ok, false);
await useWallet(ctx, anna, { type: 'wallet-change', btn: 10, ref: 2 }); // 50 gettoni nel vassoio
await useWallet(ctx, anna, { type: 'wallet-take', m: 'coin', ref: 20 }); // presi
// un giro che perde: limone, arancia, prugna
const seq = list => {
  let i = 0;
  return () => list[i++ % list.length];
};
const at = s => (SYMBOLS.slice(0, SYMBOLS.indexOf(s)).reduce((a, x) => a + WEIGHTS[x], 0) + 0.5) / WEIGHT_TOTAL;
w = await useWallet(ctx, anna, { type: 'wallet-slot', bet: 3, m: 'rossa', ref: 3 }, Date.now(), seq([at('limone'), at('arancia'), at('prugna')]));
assert.equal(w.ok, true);
assert.equal(w.gettoni, 47);
assert.deepEqual(w.slot.r, ['limone', 'arancia', 'prugna']);
assert.equal(w.slot.gettoni, 0);
// rimandato: stesso risultato, niente pagato due volte
w = await useWallet(ctx, anna, { type: 'wallet-slot', bet: 3, m: 'rossa', ref: 3 });
assert.equal(w.again, true);
assert.equal(w.gettoni, 47);
assert.deepEqual(w.slot.r, ['limone', 'arancia', 'prugna']);
// tre 7 con 2 gettoni: 200 gettoni
w = await useWallet(ctx, anna, { type: 'wallet-slot', bet: 2, m: 'oro', ref: 4 }, Date.now(), () => at('sette'));
assert.equal(w.slot.gettoni, PAYS.sette * 2);
// la vincita cade nel vassoio della slot: si prende a parte
assert.equal(w.gettoni, 45);
assert.deepEqual(w.vassoio['slot-oro'], { gettoni: PAYS.sette * 2, btn: 0 });
w = await useWallet(ctx, anna, { type: 'wallet-take', m: 'slot-oro', ref: 40 });
assert.equal(w.gettoni, 45 + PAYS.sette * 2);
assert.equal(w.vassoio['slot-oro'], undefined);
// jackpot: 5 BTN + 1 ogni 25 gettoni giocati (finora 5)
assert.deepEqual(await readJackpot(ctx), { btn: 5, resto: 5 });
for (let i = 0; i < 10; i++)
  await useWallet(ctx, bruno, { type: 'wallet-change', btn: 10, ref: 100 + i });
await useWallet(ctx, bruno, { type: 'wallet-take', m: 'coin', ref: 150 });
for (let i = 0; i < 10; i++)
  await useWallet(ctx, bruno, { type: 'wallet-slot', bet: 3, m: 'nera', ref: 200 + i }, Date.now(), () => at('limone'));
// 5 + 30 = 35 gettoni giocati: 6 BTN e 10 verso il prossimo
assert.deepEqual(await readJackpot(ctx), { btn: 6, resto: 10 });
const before = (await useWallet(ctx, anna, { type: 'wallet-slot', bet: 1, m: 'rossa', ref: 5 }, Date.now(), () => at('pagliaccio')));
assert.equal(before.slot.combo, 'jackpot');
assert.equal(before.slot.btn, 6);
assert.equal(before.btn, WALLET_START - 10); // il jackpot è nel vassoio
assert.deepEqual(before.vassoio['slot-rossa'], { gettoni: 0, btn: 6 });
assert.equal(before.slot.jackpot, 5); // riparte da 5
assert.equal((await readJackpot(ctx)).btn, 5);
assert.ok(store.has(JACKPOT_KEY));

// cambio indietro: 5 gettoni = 1 BTN, solo se i gettoni bastano
assert.deepEqual(walletCost({ type: 'wallet-change', btn: 5, back: true }), { btn: 0, gettoni: -25, tray: { m: 'coin', btn: 5 } });
const c = { user: { id: 23 } };
await useWallet(ctx, c, { type: 'wallet-change', btn: 1, ref: 1 });
await useWallet(ctx, c, { type: 'wallet-take', m: 'coin', ref: 9 }); // 49 BTN, 5 gettoni
w = await useWallet(ctx, c, { type: 'wallet-change', btn: 5, back: true, ref: 2 });
assert.equal(w.ok, false);
w = await useWallet(ctx, c, { type: 'wallet-change', btn: 1, back: true, ref: 3 });
assert.equal(w.ok, true);
assert.equal(w.gettoni, 0);
assert.equal(w.btn, WALLET_START - 1); // il BTN è uscito nel vassoio
w = await useWallet(ctx, c, { type: 'wallet-take', m: 'coin', ref: 4 });
assert.equal(w.btn, WALLET_START);
assert.deepEqual(w.taken, { m: 'coin', gettoni: 0, btn: 1 });
assert.equal(walletCost({ type: 'wallet-take', m: 'cassa' }), null);

console.log('slot: ok');
