import assert from 'node:assert/strict';
import { initial, act, advance, refreshMarket } from '../simulator/engine.js';
import { collectNotices } from '../simulator/notify.js';
import { SimulatorLeague } from '../simulator/server.js';

// Group notices: calendar, qualifying, result. Each one exactly once; sent only when enabled.
const now = Date.parse('2026-11-12T12:00:00Z');
const users = [
  { id: '301', name: 'A' },
  { id: '302', name: 'B' }
];
const s = initial(now);
for (const u of users) act(s, u, { action: 'create' }, now);
refreshMarket(s, now);
for (const u of users) {
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
  act(s, u, { action: 'enroll', enrolled: true }, now);
}
assert.deepEqual(collectNotices(s, now), [], 'nothing before the calendar');
act(
  s,
  users[0],
  { action: 'proposal', days: [0, 1, 2, 3, 4, 5, 6], times: ['21:00'], start: '2026-11-13' },
  now
);
for (const u of users) act(s, u, { action: 'vote', proposal: s.proposals[0].id }, now);
for (const u of users) act(s, u, { action: 'calendar-ready', ready: true }, now);
for (const u of users) act(s, u, { action: 'calendar-start' }, now);
let out = collectNotices(s, now);
assert.equal(out.length, 1);
assert.match(out[0], /Calendario pubblicato: 13 Gran Premi.+Spa/s);
assert.match(out[0], /t\.me\/checkmategame_bot/);
assert.deepEqual(collectNotices(s, now), [], 'calendar notice only once');
const at = s.schedule.dates[0];
assert.deepEqual(collectNotices(s, at - 31 * 60000), [], 'not before qualifying');
out = collectNotices(s, at - 29 * 60000);
assert.equal(out.length, 1);
assert.match(out[0], /Qualifiche aperte · Spa.+entro le 20:50.+Partenza alle 21:00/s);
assert.deepEqual(collectNotices(s, at - 20 * 60000), []);
for (let t = at; t <= at + 4300000; t += 5000) advance(s, t);
out = collectNotices(s, at + 4300000);
assert.equal(out.length, 1);
assert.match(out[0], /Spa · ordine d’arrivo\n🥇 .+\n🥈 .+\n🥉 .+\nCostruttori: 1\. /);
assert.deepEqual(collectNotices(s, at + 4300000), [], 'result only once');
assert(s.notified.length <= 60);

// Sending: off by default, on with SIMULATOR_NOTIFY=true, to the configured group.
const sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url, body: JSON.parse(init.body) });
  return new Response('{"ok":true}');
};
await new SimulatorLeague({}, { BOT_TOKEN: 'x' }).notify(['ciao']);
assert.equal(sent.length, 0, 'disabled unless SIMULATOR_NOTIFY is true');
await new SimulatorLeague({}, { BOT_TOKEN: 'x', SIMULATOR_NOTIFY: 'true' }).notify(['ciao']);
assert.equal(sent.length, 1);
assert.match(sent[0].url, /\/botx\/sendMessage$/);
assert.deepEqual(sent[0].body, { chat_id: '-1001803941686', text: 'ciao', disable_web_page_preview: true });
console.log(
  'PASS notify: calendar, qualifying and result notices once each; sent to the group only with SIMULATOR_NOTIFY=true.'
);
