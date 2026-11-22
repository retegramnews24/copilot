// Classifica del flipper della Lobby 3D: top 10 con il nome, il migliore di ognuno, al massimo un invio ogni 20 s.
import assert from 'node:assert/strict';
import { recordPinball, PINBALL_TOP } from '../club-pinball.js';

const store = new Map();
const ctx = { storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } };
const anna = { user: { id: '1', name: 'Anna' } },
  bruno = { user: { id: '2', name: 'Bruno' } };

assert.equal(await recordPinball(ctx, anna, 1200), true);
assert.equal(await recordPinball(ctx, bruno, 5000), true);
assert.equal(await recordPinball(ctx, anna, 9000), false, 'troppo presto dopo l’ultimo invio');
anna.pinballAt = 0;
assert.equal(await recordPinball(ctx, anna, 9000), true);
anna.pinballAt = 0;
assert.equal(await recordPinball(ctx, anna, 100), false, 'un punteggio peggiore non sostituisce il migliore');
assert.deepEqual(
  store.get('pinballTop').map(e => [e.name, e.score]),
  [
    ['Anna', 9000],
    ['Bruno', 5000]
  ]
);
for (const bad of [-5, 0, 1.5, 1e9, '100']) {
  anna.pinballAt = 0;
  assert.equal(await recordPinball(ctx, anna, bad), false, 'punteggio non valido: ' + bad);
}
for (let i = 0; i < 15; i++) await recordPinball(ctx, { user: { id: 'p' + i, name: 'P' + i } }, 100 + i);
assert.equal(store.get('pinballTop').length, PINBALL_TOP);
assert.equal(store.get('pinballTop')[0].name, 'Anna');
console.log(
  'PASS classifica del flipper: top 10 con il nome, il migliore di ognuno, invii limitati e punteggi validi.'
);
