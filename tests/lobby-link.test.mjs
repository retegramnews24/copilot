// Collegamento della Lobby dal telefono (public/lobby-link.js) con un collegamento e un orologio finti: si riapre
// solo se chiuso o muto, riprova dopo una caduta, e i messaggi in coda partono dopo la riapertura.
import assert from 'node:assert/strict';
import {
  createLobbyLink,
  PROBE,
  RETRY,
  FLUSH,
  QUEUE,
  OPEN_MAX,
  BEAT,
  KEEP_MAX
} from '../public/lobby-link.js';

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
// QUEUE; partono FLUSH ms dopo la riapertura e restano finché il server non conferma
const same = m => n => n.type === m.type && n.table === m.table;
const pinball = (type, table, score) => ({ type, table, score });
const ack = (socket, text) => socket.serverSays(JSON.stringify({ type: 'ack', ref: JSON.parse(text).ref }));
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
const refs = fourth.sent.map(t => JSON.parse(t).ref);
assert.equal(new Set(refs).size, QUEUE, 'every kept message has its own number');
assert.equal(link.waiting(), QUEUE, 'kept until the server confirms');
for (const text of fourth.sent) ack(fourth, text);
assert.equal(link.waiting(), 0, 'confirmed: out of the queue');
assert.ok(!events.some(e => e.startsWith('message:{"type":"ack"')), 'acks stay inside the link');
// collegamento aperto: si manda subito; senza keep un messaggio a collegamento giù si perde
assert.equal(link.send({ type: 'x' }), true);
fourth.drop();
assert.equal(link.send({ type: 'y' }), false);
assert.equal(link.waiting(), 0);
advance(RETRY);
const fifth = opened[4];
fifth.serverOpens();

// 9.6: collegamento aperto ma muto. L'inizio del flipper «parte» ma non arriva: resta in coda, la prova di vita
// riapre e il nuovo collegamento lo rimanda con lo stesso numero
const start = pinball('pinball-start', 'gt');
assert.equal(link.send(start, same(start)), true, 'sent at once on an open socket');
const lost = fifth.sent.at(-1);
assert.equal(link.waiting(), 1, 'still waiting for the confirmation');
advance(1000);
link.alive();
advance(PROBE + 1);
const sixth = opened[5];
assert.equal(link.socket(), sixth, 'silent: reopened');
sixth.serverOpens();
advance(FLUSH);
assert.deepEqual(sixth.sent, [lost], 'the same message (same number) is sent again');
ack(sixth, lost);
assert.equal(link.waiting(), 0);

// un messaggio mai confermato si lascia andare dopo KEEP_MAX
link.send(start, same(start));
advance(KEEP_MAX + 1);
sixth.drop();
advance(RETRY);
opened.at(-1).serverOpens();
advance(FLUSH);
assert.deepEqual(opened.at(-1).sent, [], 'too old: not sent again');
assert.equal(link.send({ type: 'z' }), true);
assert.equal(link.waiting(), 0, 'dropped from the queue');

// collegamento che resta «in apertura»: dopo OPEN_MAX si chiude e se ne apre un altro
opened.at(-1).drop();
advance(RETRY);
const stuck = opened.at(-1);
const count = opened.length;
advance(OPEN_MAX - 1);
assert.equal(opened.length, count, 'not before OPEN_MAX');
advance(1);
assert.equal(opened.length, count + 1, 'stuck while opening: reopened');
assert.ok(stuck.closed && events.includes('trace:Sala ancora in apertura: la riapro'));
opened.at(-1).serverOpens();
advance(OPEN_MAX * 2);
assert.equal(opened.length, count + 1, 'an open socket is not reopened by the opening timer');

// il giro dei 25 secondi: presenza e prova di vita solo con l'app in vista
let shown = true,
  beats = 0;
const quiet = [];
const beating = createLobbyLink({
  open: () => {
    const s = fakeSocket();
    quiet.push(s);
    return s;
  },
  visible: () => shown,
  timers: fakeTimers,
  now: () => clock,
  hooks: { beat: () => beats++ }
});
beating.connect();
quiet[0].serverOpens();
beating.startBeat();
advance(BEAT - 1);
assert.equal(beats, 0);
advance(1);
assert.equal(beats, 1, 'beat after BEAT ms');
assert.deepEqual(quiet[0].sent, ['ping'], 'and the socket is checked');
quiet[0].serverSays('pong');
shown = false;
advance(BEAT * 3);
assert.equal(beats, 1, 'app hidden: no beat');
shown = true;
advance(BEAT);
assert.equal(beats, 2, 'back in view: beats again');
beating.startBeat();
advance(BEAT);
assert.equal(beats, 3, 'starting again does not double the beat');

console.log(
  'PASS lobby link: reopens when closed, silent or stuck opening, kept messages until the server confirms, 25 s beat.'
);
