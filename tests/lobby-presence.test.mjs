// Movimenti nella Lobby 3D (lobby-hub.js presenceBroadcast): a ogni passo partiva verso tutti l'intera Lobby (tavoli,
// chat, classifiche). Ora parte un messaggio piccolo con le sole persone, al massimo ogni 200 ms, e solo se cambiano.
import assert from 'node:assert/strict';
import { LobbyHub } from '../lobby-hub.js';
import { telegramAccessTag } from '../auth.js';

const env = { BOT_TOKEN: 'prova' };
const tag = await telegramAccessTag(env);
const storage = new Map([
  ['chat', Array.from({ length: 100 }, (_, i) => ({ id: i, text: 'messaggio ' + i }))],
  ['game:1', { room: 'r1', number: 1, game: 'uno', phase: 'playing', players: [], expires: Date.now() + 1e6 }]
]);
let reads = 0;
const ctx = {
  storage: {
    get: async k => storage.get(k),
    list: async ({ prefix }) => {
      reads++;
      return new Map([...storage].filter(([k]) => k.startsWith(prefix)));
    }
  },
  getWebSockets: () => sockets
};
const sockets = Array.from({ length: 20 }, (_, i) => ({
  a: {
    kind: 'lobby',
    accessTag: tag,
    seen: Date.now(),
    user: { id: String(i), player: 'tg:' + i, name: 'P' + i },
    clubPose: { station: 'walk', x: 0, z: 0 }
  },
  sent: [],
  deserializeAttachment() {
    return this.a;
  },
  send(m) {
    this.sent.push(m);
  }
}));
const hub = new LobbyHub(ctx, env);
const sentTotal = () => sockets.reduce((n, ws) => n + ws.sent.length, 0);

// 10 persone fanno 5 passi ciascuna, tutti insieme: 50 messaggi di posizione
for (let step = 0; step < 5; step++)
  for (let p = 0; p < 10; p++) {
    sockets[p].a.clubPose = { station: 'walk', x: step, z: p };
    await hub.presenceBroadcast();
  }
assert.equal(sentTotal(), 20, 'un solo invio (20 collegati) per 50 passi nello stesso istante');
await new Promise(r => setTimeout(r, 260));
assert.equal(sentTotal(), 40, 'i passi raccolti partono in un solo invio dopo 200 ms');
const msg = JSON.parse(sockets[0].sent.at(-1));
assert.equal(msg.type, 'users');
assert.ok(!('messages' in msg) && !('games' in msg) && !('leaderboard' in msg), 'solo le persone');
assert.equal(msg.users.find(u => u.id === '9').clubPose.x, 4, 'con l’ultima posizione');
assert.ok(JSON.stringify(msg).length < 5000, 'messaggio piccolo');
// niente di nuovo: non parte niente
await new Promise(r => setTimeout(r, 210));
await hub.presenceBroadcast();
assert.equal(sentTotal(), 40);

// classifiche: si rileggono i risultati solo la prima volta, non a ogni invio
const before = reads;
await hub.lobbyPayload();
await hub.lobbyPayload();
// 2 elenchi dei tavoli + i risultati una volta sola (prima: anche i risultati a ogni invio, 4 letture)
assert.equal(reads - before, 3, 'i risultati si leggono una volta sola');
console.log('PASS presenze: passi raccolti ogni 200 ms in un messaggio piccolo, classifiche in memoria.');
