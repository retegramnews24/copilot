// Collegamento della Lobby dal telefono (public/lobby-link.js) con un collegamento e un orologio finti: si riapre
// solo se chiuso o muto, riprova dopo una caduta, e i messaggi in coda partono dopo la riapertura.
import assert from 'node:assert/strict';
import { createLobbyLink, PROBE, RETRY, FLUSH, QUEUE } from '../public/lobby-link.js';

// orologio finto: i timer partono solo quando si fa avanzare il tempo
let clock = 0,
  timers = [],
  nextId = 1;
const fakeTimers = {
  setTimeout(fn, ms) {
    const id = nextId++;
    timers.push({ id, at: clock + ms, fn });
    return id;
  },
  clearTimeout(id) {
    timers = timers.filter(t => t.id !== id);
  }
};
function advance(ms) {
  const end = clock + ms;
  for (;;) {
    const due = timers.filter(t => t.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers = timers.filter(t => t !== due);
    clock = due.at;
    due.fn();
  }
  clock = end;
}
// collegamento finto
const opened = [];
function fakeSocket() {
  const s = {
    readyState: 0,
    sent: [],
    closed: false,
    send(text) {
      this.sent.push(text);
    },
    close() {
      this.closed = true;
      this.readyState = 3;
    },
    serverOpens() {
      this.readyState = 1;
      this.onopen?.();
    },
    serverSays(data) {
      this.onmessage?.({ data });
    },
    drop() {
      this.readyState = 3;
      this.onclose?.();
    }
  };
  opened.push(s);
  return s;
}
const events = [];
const link = createLobbyLink({
  open: fakeSocket,
  timers: fakeTimers,
  now: () => clock,
  hooks: {
    opened: () => events.push('opened'),
    message: d => events.push('message:' + d),
    closed: () => events.push('closed'),
    dropped: () => events.push('dropped'),
    trace: t => events.push('trace:' + t)
  }
});

// apertura; mentre si apre, «vivo?» non fa niente
link.connect();
assert.equal(opened.length, 1);
link.alive();
assert.equal(opened.length, 1, 'connecting: no second socket');
const first = opened[0];
first.serverOpens();

// vivo: «ping», il server risponde «pong» in tempo, niente riapertura (e «pong» non arriva all'app)
link.alive();
assert.deepEqual(first.sent, ['ping']);
advance(1000);
first.serverSays('pong');
advance(PROBE);
assert.equal(opened.length, 1, 'answered in time: same socket');
assert.ok(!events.includes('message:pong'), 'pong stays inside the link');

// muto: nessuna risposta entro PROBE, si riapre e il vecchio si chiude senza far ripartire il tentativo
link.alive();
advance(PROBE + 1);
assert.equal(opened.length, 2, 'silent: reopened');
assert.ok(first.closed && events.includes('trace:Sala muta: la riapro') && events.includes('dropped'));
assert.equal(link.socket(), opened[1]);
opened[1].serverOpens();
advance(RETRY * 2);
assert.equal(opened.length, 2, 'the old socket closing does not start another attempt');

// caduto: si riprova dopo RETRY, non prima
opened[1].drop();
advance(RETRY - 1);
assert.equal(opened.length, 2);
advance(1);
assert.equal(opened.length, 3, 'retry after a drop');

// «vivo?» con il collegamento chiuso: si riapre subito
opened[2].close();
link.alive();
assert.equal(opened.length, 4, 'closed: reopened at once');

// coda: con il collegamento giù i messaggi aspettano, uno nuovo dello stesso tipo sostituisce il vecchio, al massimo
// QUEUE; partono FLUSH ms dopo la riapertura
const same = m => n => n.type === m.type && n.table === m.table;
const pinball = (type, table, score) => ({ type, table, score });
for (const m of [
  pinball('pinball-start', 'gp'),
  pinball('pinball-score', 'gp', 10),
  pinball('pinball-score', 'gp', 20)
])
  assert.equal(link.send(m, same(m)), false);
assert.equal(link.waiting(), 2, 'same kind replaced');
for (let i = 0; i < 5; i++)
  link.send(pinball('pinball-score', 't' + i, i), same(pinball('pinball-score', 't' + i)));
assert.equal(link.waiting(), QUEUE, 'at most QUEUE waiting');
const fourth = opened[3];
fourth.serverOpens();
assert.deepEqual(fourth.sent, [], 'not before the presence');
advance(FLUSH);
assert.equal(fourth.sent.length, QUEUE, 'sent after the reopening');
assert.equal(link.waiting(), 0);
// collegamento aperto: si manda subito; senza keep un messaggio a collegamento giù si perde
assert.equal(link.send({ type: 'x' }), true);
fourth.drop();
assert.equal(link.send({ type: 'y' }), false);
assert.equal(link.waiting(), 0);

console.log(
  'PASS lobby link: reopens only when closed or silent, retries after a drop, queued messages go after the reopening.'
);
