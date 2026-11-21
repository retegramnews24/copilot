import assert from 'node:assert/strict';
import { initial, act, advance, view, refreshMarket, TRACKS } from '../simulator/engine.js';

// One full race with four teams and different plans: commentary, podium and private reports.
const now = Date.parse('2026-11-12T12:00:00Z');
const users = ['Claudio', 'Giulio', 'Anna', 'Marco'].map((name, i) => ({ id: String(101 + i), name }));
const s = initial(now);
for (const u of users) act(s, u, { action: 'create' }, now);
refreshMarket(s, now);
for (const [i, u] of users.entries()) {
  for (const [role, slot] of [
    ['driver', 0],
    ['driver', 1],
    ['motor', 0],
    ['aero', 0],
    ['mechanic', 0],
    ['engine', 0]
  ]) {
    const o = s.offers.filter(o => o.role === role && o.tier === 1 && !o.sold)[i % 2];
    act(s, u, { action: 'hire', offer: o.id, slot }, now);
  }
  act(s, u, { action: 'enroll', enrolled: true }, now);
  if (i)
    for (const slot of [0, 1]) {
      const p = view(s, u, now).engineering.drivers[slot].presets[(i + slot) % 3];
      act(s, u, { action: 'strategy', slot, strategy: p.strategy }, now);
    }
}
act(
  s,
  users[0],
  { action: 'proposal', days: [0, 1, 2, 3, 4, 5, 6], times: ['21:00'], start: '2026-11-13' },
  now
);
for (const u of users) act(s, u, { action: 'vote', proposal: s.proposals[0].id }, now);
for (const u of users) act(s, u, { action: 'calendar-ready', ready: true }, now);
for (const u of users) act(s, u, { action: 'calendar-start' }, now);
const at = s.schedule.dates[0];
for (let t = at; t <= at + 4300000; t += 1000) {
  s.teams['102'].seen = t; // one team follows the whole race from the pit wall
  advance(s, t);
}
const r = s.race,
  texts = r.events.map(e => e.text).join('\n');
assert.equal(r.active, false);
for (const pattern of [
  /Metà gara: .+ guida con \d+,\d s su /,
  /Ultimo giro! /,
  /Bandiera a scacchi: vince /,
  / ai box · /
])
  assert.match(texts, pattern);
assert(
  r.events.every(e => Number.isInteger(e.lap) && e.lap >= 1 && e.lap <= r.laps),
  'every event has a lap'
);
assert(r.events.length <= 30);
const winner = s.results[0].rows[0];
assert.match(
  s.events[0].text,
  new RegExp(`^${TRACKS[0][0]}: vince ${winner.name} \\(${winner.teamName}\\), 2° `)
);
for (const u of users) {
  const d = s.teams[u.id].lastDebrief;
  assert.equal(d.race, r.id);
  assert.equal(d.cars.length, 2);
  for (const c of d.cars) {
    assert(c.key.length > 20, 'key lesson for ' + c.name);
    assert(c.notes.length >= 3);
    assert(c.dnf || c.positions.length >= r.laps - 1, 'positions per lap');
    const row = s.results[0].rows.find(x => x.name === c.name && x.team === u.id);
    assert.equal(c.position, row.position);
  }
  // Private: only the owner receives it; the public team list and results never carry it.
  const v = view(s, u, at + 4300000);
  assert.equal(v.me.lastDebrief.race, r.id);
  assert(v.teams.every(t => !('lastDebrief' in t)));
  assert(JSON.stringify(v.results).indexOf('Il punto chiave') < 0);
}
// The default plan of team 101 carries a lot of unused fuel: its report must say so.
assert.match(s.teams['101'].lastDebrief.cars[0].notes.join(' '), /benzina non usata/);
// The team on the pit wall is not told it was offline.
assert(!s.teams['102'].lastDebrief.cars.some(c => c.notes.some(n => /non collegato/.test(n))));
console.log(
  'PASS commentary/debrief: half distance, last lap, chequered flag, pits with lap numbers, podium on the board, private report per team with key lesson and positions.'
);
