// Controllo del gruppo Telegram (auth.js memberAccess): una sola domanda alla volta per persona, e se Telegram non
// risponde vale l'ultima risposta recente ("non so" solo se non ce n'è nessuna). Telegram qui è finto.
import assert from 'node:assert/strict';
import { memberAccess } from '../auth.js';

const env = { BOT_TOKEN: 'x', TELEGRAM_ALLOWED_GROUP_ID: '-100' };
let calls = 0,
  mode = 'member';
globalThis.fetch = async () => {
  calls++;
  await new Promise(r => setTimeout(r, 20));
  if (mode === 'down') throw new Error('rete');
  if (mode === 'slow-down')
    return new Response(JSON.stringify({ ok: false, error_code: 429 }), { status: 429 });
  return new Response(JSON.stringify({ ok: true, result: { status: mode } }));
};
const realNow = Date.now;
let shift = 0;
Date.now = () => realNow() + shift;

// due domande insieme per la stessa persona: una sola chiamata a Telegram
assert.deepEqual(await Promise.all([memberAccess({ id: 1 }, env), memberAccess({ id: 1 }, env)]), [
  true,
  true
]);
assert.equal(calls, 1, 'una sola domanda a Telegram');
// entro il minuto risponde la memoria
assert.equal(await memberAccess({ id: 1 }, env), true);
assert.equal(calls, 1);

// passato il minuto Telegram non risponde: chi era dentro resta dentro (non viene buttato fuori)
shift = 2 * 60000;
mode = 'down';
assert.equal(await memberAccess({ id: 1 }, env), true, 'Telegram giù: vale l’ultima risposta');
mode = 'slow-down';
assert.equal(
  await memberAccess({ id: 1 }, env),
  true,
  'Telegram chiede di rallentare: vale l’ultima risposta'
);

// mai visto prima e Telegram giù: "non so" (null), non "fuori"
mode = 'down';
assert.equal(await memberAccess({ id: 2 }, env), null);

// dopo 10 minuti senza risposte la memoria non vale più
shift = 13 * 60000;
assert.equal(await memberAccess({ id: 1 }, env), null);

// Telegram dice davvero che è uscito dal gruppo: fuori
mode = 'left';
assert.equal(await memberAccess({ id: 3 }, env), false);

Date.now = realNow;
console.log(
  'PASS gruppo Telegram: una domanda alla volta, Telegram giù non butta fuori chi era dentro, "non so" ≠ fuori.'
);
