// Tetto di collegamenti per persona (socket-limits.js): una persona non può occupare tutti i posti, e chi si
// ricollega entra sempre (si chiude il suo collegamento più vecchio, non quello nuovo né quelli degli altri).
import assert from 'node:assert/strict';
import { makeRoomFor, socketPerson, PER_PERSON } from '../socket-limits.js';

const sockets = [];
const socket = attachment => {
  const ws = {
    a: attachment,
    closedWith: null,
    deserializeAttachment() {
      return this.a;
    },
    serializeAttachment(v) {
      this.a = v;
    },
    close(code) {
      this.closedWith = code;
    }
  };
  sockets.push(ws);
  return ws;
};
const ctx = { getWebSockets: () => sockets.filter(ws => ws.closedWith === null) };

assert.equal(socketPerson({ memberId: 7 }), '7');
assert.equal(socketPerson({ player: 'tg:7' }), '7');
assert.equal(socketPerson({ user: { id: 7 } }), '7');

// Anna apre 10 collegamenti alla Lobby: ne restano aperti al massimo 3, sempre i più nuovi
for (let i = 0; i < 10; i++) {
  makeRoomFor(ctx, 1, 'lobby');
  socket({ kind: 'lobby', memberId: 1, n: i });
}
const anna = ctx.getWebSockets().filter(ws => socketPerson(ws.a) === '1');
assert.equal(anna.length, PER_PERSON);
assert.deepEqual(
  anna.map(ws => ws.a.n),
  [7, 8, 9],
  'restano i più nuovi'
);
assert.ok(sockets.filter(ws => ws.closedWith === 4008).length === 7);

// gli altri non vengono toccati, e gli altri tipi della stessa persona nemmeno
const bruno = socket({ kind: 'lobby', memberId: 2 });
const lavagna = socket({ kind: 'blackboard', player: 'tg:1' });
makeRoomFor(ctx, 1, 'lobby');
assert.equal(bruno.closedWith, null);
assert.equal(lavagna.closedWith, null);

// tavoli (collegamenti senza tipo)
for (let i = 0; i < 5; i++) {
  makeRoomFor(ctx, 3);
  socket({ memberId: '3', player: 'tg:3' });
}
assert.equal(ctx.getWebSockets().filter(ws => socketPerson(ws.a) === '3').length, PER_PERSON);
console.log(
  'PASS collegamenti: al massimo 3 per persona, si chiude il più vecchio, gli altri non vengono toccati.'
);
