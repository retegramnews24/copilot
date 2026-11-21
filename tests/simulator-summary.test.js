import assert from 'node:assert/strict';
import { initial, act, refreshMarket } from '../simulator/engine.js';
import { lobbySummary } from '../simulator/summary.js';

// Lobby "Adesso": the next thing to do in Binotto Simulator, step by step.
const now = Date.parse('2026-11-12T12:00:00Z');
const a = { id: '401', name: 'A' },
  b = { id: '402', name: 'B' };
const s = initial(now);
const text = id => lobbySummary(s, id, now).items.map(i => i.text).join(' | ');
assert.match(text('401'), /crea la tua scuderia/);
for (const u of [a, b]) act(s, u, { action: 'create' }, now);
refreshMarket(s, now);
assert.match(text('401'), /completa la scuderia/);
for (const u of [a, b]) {
  for (const [role, slot] of [
    ['driver', 0],
    ['driver', 1],
    ['motor', 0],
    ['aero', 0],
    ['mechanic', 0],
    ['engine', 0]
  ]) {
    const o = s.offers.find(o => o.role === role && o.tier === 1 && !o.sold);
    act(s, u, { action: 'hire', offer: o.id, slot }, now);
  }
}
assert.match(text('401'), /iscrivi la scuderia/);
for (const u of [a, b]) act(s, u, { action: 'enroll', enrolled: true }, now);
assert.match(text('401'), /proponi giorni e orari/);
act(s, a, { action: 'proposal', days: [0, 1, 2, 3, 4, 5, 6], times: ['21:00'], start: '2026-11-13' }, now);
assert.match(text('401'), /accetta una proposta/);
act(s, a, { action: 'vote', proposal: s.proposals[0].id }, now);
assert.match(text('401'), /Pronto!/);
act(s, a, { action: 'calendar-ready', ready: true }, now);
assert.match(text('401'), /in attesa degli altri/);
act(s, b, { action: 'vote', proposal: s.proposals[0].id }, now);
act(s, b, { action: 'calendar-ready', ready: true }, now);
assert.match(text('401'), /Si parte!!/);
for (const u of [a, b]) act(s, u, { action: 'calendar-start' }, now);
const at = s.schedule.dates[0];
assert.match(lobbySummary(s, '401', at - 20 * 60000).items[0].text, /qualifiche aperte a Spa.+entro le 20:50/);
assert.match(lobbySummary(s, '401', at - 3 * 3600000).items[0].text, /prossima gara a Spa alle 21:00/);
assert.equal(lobbySummary(s, '401', now).debrief, null);
console.log('PASS summary: create, complete, enrol, calendar steps, qualifying open and next race for the Lobby.');
