// Sale cinema: quali restano in uso quando se ne apre una nuova. La Sala 1 resta sempre; una sala vuota con la
// proiezione accesa resta fino a 12 ore dall'ultimo cambio, poi si libera (altrimenti le 24 sale finirebbero).
import assert from 'node:assert/strict';
import { liveRooms, ROOM_KEEP } from '../cinema-server.js';

const now = 100 * 3600_000,
  hour = 3600_000;
const rooms = [
  { id: 'principale', number: 1, updated: 0 },
  { id: 'dentro', updated: now - 30 * hour },
  { id: 'recente', updated: now - 0.5 * hour },
  { id: 'vecchia', updated: now - 2 * hour },
  { id: 'proiezione', updated: now - 5 * hour, channel: { url: 'x' } },
  { id: 'dimenticata', updated: now - ROOM_KEEP - 1, channel: { url: 'x' } },
  { id: 'coda', updated: now - 3 * hour, queue: [{}] },
  { id: 'coda-vecchia', updated: now - 13 * hour, queue: [{}] }
];
const live = liveRooms(rooms, new Set(['dentro']), now).map(r => r.id);
assert.deepEqual(live, ['principale', 'dentro', 'recente', 'proiezione', 'coda']);

console.log(
  'PASS Sale cinema: la Sala 1 sempre, occupate, recenti, proiezione accesa fino a 12 ore, poi libere.'
);
