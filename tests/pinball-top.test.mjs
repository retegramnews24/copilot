// Classifiche dei flipper della Lobby 3D: top 10 con il nome, il migliore di ognuno, al massimo un invio ogni 20 s,
// partita annunciata all'inizio e punteggio possibile per il tempo giocato; amministrazione che toglie un punteggio.
import assert from 'node:assert/strict';
import { recordPinball, startPinball, removePinball, PINBALL_TOP, PINBALL_RATE } from '../club-pinball.js';

const store = new Map();
const ctx = { storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
// partita iniziata "seconds" secondi fa
const played = (a, seconds, table = 'gp') => {
  startPinball(a, table);
  a[table === 'gp' ? 'pinballStart' : 'pinballStart_' + table] -= seconds * 1000;
  a[table === 'gp' ? 'pinballAt' : 'pinballAt_' + table] = 0;
};
const anna = { user: { id: '1', name: 'Anna' } },
  bruno = { user: { id: '2', name: 'Bruno' } };

// senza partita annunciata il punteggio non entra
assert.equal(await recordPinball(ctx, anna, 1200), false, 'partita non annunciata');
played(anna, 60);
assert.equal(await recordPinball(ctx, anna, 1200), true);
played(bruno, 60);
assert.equal(await recordPinball(ctx, bruno, 5000), true);
// un punteggio per partita annunciata
assert.equal(await recordPinball(ctx, anna, 9000), false, 'serve una nuova partita');
played(anna, 60);
assert.equal(await recordPinball(ctx, anna, 9000), true);
played(anna, 60);
assert.equal(await recordPinball(ctx, anna, 100), false, 'un punteggio peggiore non sostituisce il migliore');
assert.deepEqual(
  store.get('pinballTop').map(e => [e.name, e.score]),
  [
    ['Anna', 9000],
    ['Bruno', 5000]
  ]
);
// impossibile per il tempo giocato: 50 milioni dopo 10 secondi
played(bruno, 10);
assert.equal(await recordPinball(ctx, bruno, 50_000_000), false, 'troppi punti per 10 secondi');
played(bruno, 10);
assert.equal(await recordPinball(ctx, bruno, 10 * PINBALL_RATE), true, 'possibile per 10 secondi');
for (const bad of [-5, 0, 1.5, 1e9, '100']) {
  played(anna, 3600);
  assert.equal(await recordPinball(ctx, anna, bad), false, 'punteggio non valido: ' + bad);
}
for (let i = 0; i < 15; i++) {
  const p = { user: { id: 'p' + i, name: 'P' + i } };
  played(p, 60);
  await recordPinball(ctx, p, 100 + i);
}
assert.equal(store.get('pinballTop').length, PINBALL_TOP);
assert.equal(store.get('pinballTop')[0].name, 'Bruno');
// il Binotto GT ha la sua classifica, separata da quella del Grand Prix
const carla = { user: { id: '9', name: 'Carla' } };
played(carla, 60, 'gt');
assert.equal(await recordPinball(ctx, carla, 777, 'gt'), true);
played(carla, 60, 'gp');
assert.equal(await recordPinball(ctx, carla, 999, 'gp'), true, 'un tavolo non blocca l’altro');
assert.deepEqual(
  store.get('pinballTopGT').map(e => e.name),
  ['Carla']
);
assert.equal(await recordPinball(ctx, carla, 5, 'xx'), false, 'tavolo sconosciuto');
// amministrazione: si toglie il punteggio di una persona
assert.equal(await removePinball(ctx, 'gp', '2'), true);
assert.ok(!store.get('pinballTop').some(e => e.id === '2'));
assert.equal(await removePinball(ctx, 'gp', '2'), false, 'già tolto');
console.log(
  'PASS classifica del flipper: top 10, partita annunciata, punteggi impossibili rifiutati, punteggio tolto da amministrazione.'
);
