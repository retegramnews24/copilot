// Portafoglio del circolo (club-wallet.js, docs/gettoni.md): 100 BTN a testa all'inizio, cambio 1 · 5 · 10 BTN in
// gettoni (5 per BTN), cibo a 1 BTN (popcorn e cola insieme 2), mai sotto zero, un messaggio rimandato non si paga
// due volte.
import assert from 'node:assert/strict';
import { readWallet, useWallet, walletCost, walletKey, WALLET_START } from '../club-wallet.js';
import { MACHINES, machineUse } from '../club-machines.js';

const store = new Map();
const ctx = { storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
const anna = { user: { id: 11, name: 'Anna' } },
  bruno = { user: { id: 12, name: 'Bruno' } };

// all'inizio: 100 BTN, 0 gettoni, senza scrivere niente
assert.deepEqual(await readWallet(ctx, anna), { btn: WALLET_START, gettoni: 0, refs: [] });
assert.equal(store.size, 0);
assert.equal(await readWallet(ctx, {}), null);

// cambio: 5 BTN → 25 gettoni
let w = await useWallet(ctx, anna, { type: 'wallet-change', btn: 5, ref: 1 });
assert.equal(w.ok, true);
assert.equal(w.btn, 95);
assert.equal(w.gettoni, 25);
// lo stesso messaggio rimandato dopo una riapertura non si paga due volte
w = await useWallet(ctx, anna, { type: 'wallet-change', btn: 5, ref: 1 });
assert.equal(w.btn, 95);
assert.equal(w.gettoni, 25);
// importi che non esistono: niente
assert.equal(await useWallet(ctx, anna, { type: 'wallet-change', btn: 3, ref: 2 }), null);
assert.equal(await useWallet(ctx, anna, { type: 'wallet-change', btn: -10, ref: 3 }), null);
assert.equal(await useWallet(ctx, anna, { type: 'wallet-change', btn: '10', ref: 4 }), null);

// cibo: 1 BTN, popcorn e cola insieme 2
assert.deepEqual(walletCost({ type: 'wallet-pay', m: 'vend' }), { btn: 1, gettoni: 0 });
assert.deepEqual(walletCost({ type: 'wallet-pay', m: 'dog' }), { btn: 1, gettoni: 0 });
assert.deepEqual(walletCost({ type: 'wallet-pay', m: 'pop', k: 'cola' }), { btn: 1, gettoni: 0 });
assert.deepEqual(walletCost({ type: 'wallet-pay', m: 'pop', k: 'tutti' }), { btn: 2, gettoni: 0 });
assert.equal(walletCost({ type: 'wallet-pay', m: 'coin' }), null);
w = await useWallet(ctx, anna, { type: 'wallet-pay', m: 'pop', k: 'tutti', ref: 5 });
assert.equal(w.btn, 93);
assert.equal(w.gettoni, 25);

// ognuno ha il suo
assert.equal((await readWallet(ctx, bruno)).btn, 100);

// mai sotto zero: con 3 BTN non si cambiano 5
store.set(walletKey(12), { btn: 3, gettoni: 0, refs: [] });
w = await useWallet(ctx, bruno, { type: 'wallet-change', btn: 5, ref: 6 });
assert.equal(w.ok, false);
assert.equal(w.btn, 3);
w = await useWallet(ctx, bruno, { type: 'wallet-change', btn: 1, ref: 7 });
assert.equal(w.ok, true);
assert.equal(w.btn, 2);
assert.equal(w.gettoni, 5);
for (let i = 0; i < 3; i++) await useWallet(ctx, bruno, { type: 'wallet-pay', m: 'vend', ref: 10 + i });
assert.equal((await readWallet(ctx, bruno)).btn, 0);

// dati rovinati nello storage: si riparte da valori validi
store.set(walletKey(13), { btn: -4, gettoni: 1.5, refs: 'x' });
assert.deepEqual(await readWallet(ctx, { user: { id: 13 } }), { btn: WALLET_START, gettoni: 0, refs: [] });

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
