// Classifiche dei flipper della Lobby 3D: top 10 con il nome, il migliore di ognuno, al massimo un invio ogni 20 s,
// partita annunciata all'inizio e punteggio possibile per il tempo giocato; amministrazione che toglie un punteggio.
// L'inizio è salvato per persona (non nel collegamento): vale anche se il punteggio arriva da un collegamento nuovo.
import assert from 'node:assert/strict';
import {
  recordPinball,
  startPinball,
  removePinball,
  pinballStartKey,
  PINBALL_TOP,
  PINBALL_RATE,
  PINBALL_GAME_MAX
} from '../club-pinball.js';

const store = new Map();
const ctx = {
  storage: {
    get: async k => store.get(k),
    put: async (k, v) => store.set(k, v),
    delete: async k => store.delete(k)
  }
};
// partita iniziata "seconds" secondi fa
const played = async (a, seconds, table = 'gp') => {
  const key = pinballStartKey(a.user.id);
  store.set(key, { ...store.get(key), [table]: 0 }); // nessun annuncio recente: quello nuovo passa
  assert.equal(await startPinball(ctx, a, table), true, 'inizio annunciato');
  store.get(key)[table] -= seconds * 1000;
  a[table === 'gp' ? 'pinballAt' : 'pinballAt_' + table] = 0;
};
const anna = { user: { id: '1', name: 'Anna' } },
  bruno = { user: { id: '2', name: 'Bruno' } };

// senza partita annunciata il punteggio non entra
assert.equal(await recordPinball(ctx, anna, 1200), false, 'partita non annunciata');
await played(anna, 60);
assert.equal(await recordPinball(ctx, anna, 1200), true);
assert.equal(store.has(pinballStartKey('1')), false, 'inizio consumato: la chiave non resta nello spazio');
await played(bruno, 60);
assert.equal(await recordPinball(ctx, bruno, 5000), true);
// un punteggio per partita annunciata
assert.equal(await recordPinball(ctx, anna, 9000), false, 'serve una nuova partita');
await played(anna, 60);
assert.equal(await recordPinball(ctx, anna, 9000), true);
await played(anna, 60);
assert.equal(await recordPinball(ctx, anna, 100), false, 'un punteggio peggiore non sostituisce il migliore');
assert.deepEqual(
  store.get('pinballTop').map(e => [e.name, e.score]),
  [
    ['Anna', 9000],
    ['Bruno', 5000]
  ]
);
// impossibile per il tempo giocato: 50 milioni dopo 10 secondi
await played(bruno, 10);
assert.equal(await recordPinball(ctx, bruno, 50_000_000), false, 'troppi punti per 10 secondi');
await played(bruno, 10);
assert.equal(await recordPinball(ctx, bruno, 10 * PINBALL_RATE), true, 'possibile per 10 secondi');
for (const bad of [-5, 0, 1.5, 1e9, '100']) {
  await played(anna, 3600);
  assert.equal(await recordPinball(ctx, anna, bad), false, 'punteggio non valido: ' + bad);
}
for (let i = 0; i < 15; i++) {
  const p = { user: { id: 'p' + i, name: 'P' + i } };
  await played(p, 60);
  await recordPinball(ctx, p, 100 + i);
}
assert.equal(store.get('pinballTop').length, PINBALL_TOP);
assert.equal(store.get('pinballTop')[0].name, 'Bruno');
// il Binotto GT ha la sua classifica, separata da quella del Grand Prix
const carla = { user: { id: '9', name: 'Carla' } };
await played(carla, 60, 'gt');
assert.equal(await recordPinball(ctx, carla, 777, 'gt'), true);
await played(carla, 60, 'gp');
assert.equal(await recordPinball(ctx, carla, 999, 'gp'), true, 'un tavolo non blocca l’altro');
assert.deepEqual(
  store.get('pinballTopGT').map(e => e.name),
  ['Carla']
);
assert.equal(await recordPinball(ctx, carla, 5, 'xx'), false, 'tavolo sconosciuto');
// collegamento cambiato a metà partita (app tornata in primo piano, rete caduta un attimo): l'inizio annunciato dal
// collegamento vecchio vale per il punteggio che arriva da quello nuovo
const dario = { user: { id: '10', name: 'Dario' } },
  darioNuovo = { user: { id: '10', name: 'Dario' } };
await played(dario, 300);
assert.equal(await recordPinball(ctx, darioNuovo, 250_000), true, 'punteggio dal collegamento nuovo');
// le due partite insieme (una per tavolo): finire la prima non cancella l'inizio dell'altra
const darioTerzo = { user: { id: '10', name: 'Dario' } };
await played(dario, 300, 'gp');
await played(dario, 300, 'gt');
assert.equal(await recordPinball(ctx, darioTerzo, 300_000, 'gp'), true);
assert.equal(await recordPinball(ctx, darioTerzo, 4000, 'gt'), true, 'l’inizio dell’altro tavolo resta');
// due annunci di fila: il secondo non riscrive (freno alle scritture)
const elsa = { user: { id: '11', name: 'Elsa' } };
assert.equal(await startPinball(ctx, elsa), true);
assert.equal(await startPinball(ctx, elsa), false, 'annuncio troppo vicino al precedente');
assert.equal(await startPinball(ctx, { user: {} }), false, 'senza persona niente inizio');
// un inizio vecchissimo (partita mai finita) non vale più
await played(elsa, PINBALL_GAME_MAX / 1000 + 60);
assert.equal(await recordPinball(ctx, elsa, 1000), false, 'inizio scaduto');
// amministrazione: si toglie il punteggio di una persona
assert.equal(await removePinball(ctx, 'gp', '2'), true);
assert.ok(!store.get('pinballTop').some(e => e.id === '2'));
assert.equal(await removePinball(ctx, 'gp', '2'), false, 'già tolto');
console.log(
  'PASS classifica del flipper: top 10, partita annunciata (anche da un collegamento precedente), punteggi impossibili rifiutati, punteggio tolto da amministrazione.'
);
