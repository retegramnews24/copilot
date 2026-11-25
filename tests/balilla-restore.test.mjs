// Calcio balilla dopo una pausa del server (ibernazione): il tavolo si ricostruisce dalle connessioni ancora aperte
// (attachment.balilla) e chi era seduto ritrova il suo posto, con le regole del tavolo del bar. Posti doppi o non
// validi tornano spettatori; le connessioni fuori dal club o chiuse non contano.
import assert from 'node:assert/strict';
import { BalillaHub } from '../balilla-hub.js';

const socket = attachment => ({
  attachment,
  sent: [],
  deserializeAttachment() {
    return this.attachment;
  },
  serializeAttachment(a) {
    this.attachment = a;
  },
  send(text) {
    this.sent.push(text);
  }
});
const seat = (memberId, slot) =>
  socket({
    kind: 'lobby',
    inClub: true,
    memberId,
    balilla: { slot, bar: true, mode: 2, target: 8, bestOf: 1 }
  });
const sockets = [
  seat('1', 0),
  seat('2', 1),
  seat('3', 2),
  seat('4', 2), // stesso posto di 3: torna spettatore
  socket({ kind: 'lobby', inClub: true, memberId: '5', balilla: { slot: -1 } }), // guardava
  socket({ kind: 'lobby', inClub: false, memberId: '6', balilla: { slot: 3 } }), // uscito dal club
  socket({ kind: 'lobby', inClub: true, closed: true, memberId: '7', balilla: { slot: 3 } }), // chiuso
  socket({ kind: 'cinema', memberId: '8' })
];
const hub = new BalillaHub({ getWebSockets: () => sockets });
hub.restore();
try {
  const slots = [...hub.viewers.values()].map(v => [v.id, v.slot]);
  assert.deepEqual(slots, [
    ['1', 0],
    ['2', 1],
    ['3', 2],
    ['4', -1],
    ['5', -1]
  ]);
  assert.equal(hub.field.bar, true, 'bar table rebuilt');
  assert.equal(hub.field.target, 8, 'same goals to win');
  assert.equal(hub.field.practice, false, 'both sides seated: goals count');
  assert.ok(hub.timer, 'the table runs again');
  // una seconda chiamata non duplica niente
  hub.restore();
  assert.equal(hub.viewers.size, 5);
} finally {
  hub.stop();
}
console.log(
  'PASS balilla restore: after hibernation seats come back from the connections, duplicates become viewers.'
);
