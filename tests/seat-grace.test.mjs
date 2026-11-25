// Balilla e sgabelli quando qualcuno si allontana (analisi Fable, area 2, punti D, E, F): pausa, posto tenuto per un
// po', punteggio ritrovato da chi torna, posti e sgabelli dei collegamenti morti che si liberano.
import assert from 'node:assert/strict';
import { BalillaHub, PAUSE, SEAT_GRACE } from '../balilla-hub.js';
import { holdsStool, STOOL_GRACE, STOOL_SILENT } from '../club-stools.js';

const realNow = Date.now;
let clock = 5_000_000;
Date.now = () => clock;
try {
  const hub = new BalillaHub();
  const player = id => ({
    id,
    send(raw) {
      this.state = JSON.parse(raw);
    }
  });
  const a = player('a'),
    b = player('b');
  const send = (who, action, data = {}) => hub.message(who, who.id, { action, ...data });
  const join = (who, slot) => {
    send(who, 'watch');
    send(who, 'join', { mode: 2, slot, target: 10, bar: true });
  };
  join(a, 0);
  join(b, 2);
  assert.equal(hub.field.practice, false);
  hub.field.score = [4, 3];

  // B guarda un'altra app: dopo PAUSE la partita è in pausa, il posto è ancora suo
  clock += PAUSE + 1000;
  send(a, 'watch');
  assert.equal(hub.paused(), true);
  assert.equal(a.state.paused, true);
  assert.deepEqual(hub.field.score, [4, 3]);
  assert.equal(hub.seated().length, 2);
  // B torna prima di SEAT_GRACE: si riprende, punteggio intatto
  send(b, 'watch');
  assert.equal(hub.paused(), false);
  assert.deepEqual(hub.field.score, [4, 3]);

  // B si alza e torna entro SEAT_GRACE: ritrova il punteggio
  send(b, 'leave');
  assert.equal(hub.field.practice, true);
  join(b, 2);
  assert.deepEqual(hub.field.score, [4, 3], 'same person back: score kept');
  // B si alza e al suo posto si siede C: la partita continua com'è (si riparte da zero solo a tavolo vuoto)
  send(b, 'leave');
  const c = player('c');
  join(c, 2);
  assert.deepEqual(hub.field.score, [4, 3], 'someone else sits: the match goes on');

  // il telefono di C tace (rete caduta, collegamento rimasto aperto): dopo SEAT_GRACE il posto si libera
  clock += SEAT_GRACE + 1000;
  send(a, 'watch');
  assert.deepEqual(
    hub.seated().map(v => v.id),
    ['a']
  );
  hub.stop();
} finally {
  Date.now = realNow;
}

// Sgabelli: con l'app nascosta resta tuo per STOOL_GRACE; un collegamento muto da STOOL_SILENT non lo tiene più
{
  const now = 9_000_000;
  const held = { inClub: true, seen: now - 1000, stool: { id: 3, action: 'sit' } };
  assert.equal(holdsStool(held, 3, now), true);
  assert.equal(holdsStool(held, 4, now), false);
  assert.equal(holdsStool({ ...held, seen: now - STOOL_SILENT - 1 }, 3, now), false, 'silent connection');
  const hidden = { inClub: false, closed: true, closedAt: now - 5000, stool: { id: 3, action: 'sit' } };
  assert.equal(holdsStool(hidden, 3, now), true, 'app hidden for a moment');
  assert.equal(holdsStool({ ...hidden, closedAt: now - STOOL_GRACE - 1 }, 3, now), false, 'hidden too long');
}

console.log(
  'PASS Seat grace: balilla pause, seat kept and score back for who returns, ghost seats and stools freed.'
);
