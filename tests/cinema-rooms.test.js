// Durata delle sale vuote e delle proiezioni.
import assert from 'node:assert/strict';
import { liveRooms } from '../cinema-server.js';

const now = 100 * 3600_000,
  hour = 3600_000;
const rooms = [
  { id: 'principale', number: 1, updated: 0 },
  { id: 'dentro', updated: now - 30 * hour },
  { id: 'recente', updated: now - 0.5 * hour },
  { id: 'vecchia', updated: now - 2 * hour },
  { id: 'proiezione', updated: now - 5 * hour, channel: { url: 'x' } },
  { id: 'dimenticata', updated: now - 72 * hour, channel: { url: 'x' } },
  { id: 'coda', updated: now - 3 * hour, queue: [{}] },
  { id: 'coda-vecchia', updated: now - 13 * hour, queue: [{}] }
];
const live = liveRooms(rooms, new Set(['dentro']), now).map(r => r.id);
assert.deepEqual(live, ['principale', 'dentro', 'recente', 'proiezione', 'dimenticata', 'coda', 'coda-vecchia']);

console.log('PASS Sale cinema: occupate, recenti, proiezioni conservate anche dopo giorni senza spettatori.');
