import assert from 'node:assert/strict';
import { initial, act, advance, view, refreshMarket, TRACKS } from '../simulator/engine.js';
import { objectiveFor, SPONSOR_REWARD } from '../simulator/sponsor.js';

// A full 13-race season with four teams: goals are shown before the race, frozen at the start,
// paid exactly once, and neither trivial nor impossible.
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
}
assert.equal(view(s, users[0], now).objective, null, 'no goal before the calendar');
act(s, users[0], { action: 'proposal', days: [0, 1, 2, 3, 4, 5, 6], times: ['21:00'], start: '2026-11-13' }, now);
for (const u of users) act(s, u, { action: 'vote', proposal: s.proposals[0].id }, now);
for (const u of users) act(s, u, { action: 'calendar-ready', ready: true }, now);
for (const u of users) act(s, u, { action: 'calendar-start' }, now);
// Plenty of cash so nobody misses a start for salaries.
for (const t of Object.values(s.teams)) t.cash += 50000000;

const types = new Set();
let met = 0,
  total = 0;
for (let round = 0; round < 13; round++) {
  const at = s.schedule.dates[round];
  const before = Object.fromEntries(users.map(u => [u.id, view(s, u, at - 60000).objective]));
  for (const u of users) {
    assert(before[u.id], 'goal visible before the race');
    assert.deepEqual(before[u.id], objectiveFor(s, u.id, round), 'deterministic');
    types.add(before[u.id].type);
    // Each team uses a ready-made plan.
    for (const slot of [0, 1]) {
      const p = view(s, u, at - 60000).engineering.drivers[slot].presets[(round + slot) % 3];
      act(s, u, { action: 'strategy', slot, strategy: p.strategy }, at - 60000);
    }
  }
  const cash = Object.fromEntries(users.map(u => [u.id, s.teams[u.id].cash]));
  advance(s, at + 1000);
  for (const u of users) assert.deepEqual(view(s, u, at + 1000).objective, before[u.id], 'frozen at start');
  for (let t = at + 1000; t <= at + 4300000; t += 5000) advance(s, t);
  assert.equal(s.race.active, false);
  for (const u of users) {
    const d = s.teams[u.id].lastDebrief;
    assert.equal(d.objective.text, before[u.id].text);
    // Payment: sponsor base, points, and the goal reward exactly when met.
    const row = s.results[0].rows.filter(x => x.team === u.id),
      pointsCash = row.reduce((n, x) => n + x.points * 6000, 0);
    const salaries = cash[u.id] - s.teams[u.id].cash + 350000 + pointsCash + (d.objective.met ? SPONSOR_REWARD : 0);
    // The last race also pays the season prizes, so the cash check covers rounds 1–12.
    assert(
      round === 12 || salaries > 0,
      `only salaries are left unexplained: round ${round} team ${u.id} before ${cash[u.id]} after ${s.teams[u.id].cash} points ${pointsCash} met ${d.objective.met} rows ${row.length} race ${s.results[0].id} debrief ${d.race}`
    );
    total++;
    if (d.objective.met) met++;
  }
  const paid = s.events.filter(e => e.text.includes('obiettivo sponsor')).length;
  advance(s, at + 4300000);
  assert.equal(s.events.filter(e => e.text.includes('obiettivo sponsor')).length, paid, 'paid once');
}
assert(types.size >= 4, 'varied goals: ' + [...types].join(','));
const rate = met / total;
assert(rate > 0.2 && rate < 0.85, 'goal success rate ' + rate.toFixed(2));
console.log(
  `PASS sponsor: 13 GP × 4 teams, goals visible before the race, frozen at the start, paid once; ${types.size} goal types, success ${Math.round(rate * 100)}%.`
);
void TRACKS;
