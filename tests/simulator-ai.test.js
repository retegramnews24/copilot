import assert from 'node:assert/strict';
import { initial, act, advance, view, refreshMarket } from '../simulator/engine.js';

// AI teams complete the grid to 10 cars when the calendar is published, race with ready-made plans,
// never vote or receive private reports, and leave at the next season.
const now = Date.parse('2026-11-12T12:00:00Z');
function season(humans) {
  const users = Array.from({ length: humans }, (_, i) => ({ id: String(201 + i), name: 'P' + i }));
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
      const o = s.offers.filter(o => o.role === role && o.tier === 1 && !o.sold)[0];
      act(s, u, { action: 'hire', offer: o.id, slot }, now);
    }
    act(s, u, { action: 'enroll', enrolled: true }, now);
  }
  act(
    s,
    users[0],
    { action: 'proposal', days: [0, 1, 2, 3, 4, 5, 6], times: ['21:00'], start: '2026-11-13' },
    now
  );
  for (const u of users) act(s, u, { action: 'vote', proposal: s.proposals[0].id }, now);
  for (const u of users) act(s, u, { action: 'calendar-ready', ready: true }, now);
  for (const u of users.slice(0, -1)) act(s, u, { action: 'calendar-start' }, now);
  assert(!Object.keys(s.teams).some(id => id.startsWith('ai:')), 'no AI before the calendar is published');
  act(s, users.at(-1), { action: 'calendar-start' }, now);
  return { s, users };
}
for (const [humans, ai] of [
  [2, 3],
  [4, 1],
  [5, 0]
]) {
  const { s, users } = season(humans);
  const aiTeams = Object.values(s.teams).filter(t => t.ai);
  assert.equal(aiTeams.length, ai, humans + ' humans');
  assert.equal(s.schedule.participants.length, humans);
  assert.equal((s.schedule.ai || []).length, ai);
  if (ai)
    assert.match(
      s.events[0].text,
      new RegExp(`In griglia anche ${ai} scuder.+ AI: ${(humans + ai) * 2} vetture`)
    );
  // AI teams are not part of the human approval and are flagged in the public list.
  const v = view(s, users[0], now);
  assert.equal(v.approval.members.length, humans);
  assert.equal(v.teams.filter(t => t.ai).length, ai);
  if (!ai) continue;
  const at = s.schedule.dates[0];
  for (let t = at; t <= at + 4300000; t += 5000) advance(s, t);
  const rows = s.results[0].rows;
  assert.equal(rows.length, (humans + ai) * 2);
  const aiRows = rows.filter(r => r.team.startsWith('ai:'));
  assert(aiRows.filter(r => !r.dnf).length >= aiRows.length - 1, 'AI cars reach the finish');
  // Competitive but beatable: at least one AI car and one human car score points.
  assert(aiRows.some(r => r.points > 0) && rows.some(r => !r.team.startsWith('ai:') && r.points > 0));
  for (const t of aiTeams) {
    assert.equal(t.lastDebrief, undefined, 'no private report for AI');
    assert.equal(t.strategies.length, 2);
    assert(
      t.strategies.every(st => st.stops?.length >= 1),
      'AI uses a ready-made plan'
    );
  }
  assert(!s.events.some(e => /AI centra l’obiettivo sponsor/.test(e.text)));
  // A human sponsor goal counts all cars on the grid.
  const goal = view(s, users[0], at + 4300000).objective;
  if (goal?.type === 'top') assert.equal(goal.n, Math.ceil(((humans + ai) * 2) / 2));
  // Next season: AI teams leave; they come back only with the next published calendar.
  for (let round = 1; round < 13; round++) {
    const d = s.schedule.dates[round];
    for (let t = d; t <= d + 4300000; t += 20000) advance(s, t);
  }
  assert.equal(s.round, 13);
  act(s, users[0], { action: 'next-season' }, s.schedule.dates[12] + 4400000);
  assert(!Object.values(s.teams).some(t => t.ai), 'AI removed at the new season');
  assert(s.championships?.length >= 1, 'season archived with the AI results');
}
console.log(
  'PASS AI teams: fill the grid to 10 cars (2→3, 4→1, 5→0), race with ready-made plans, score points, no vote/report/goal, leave at the next season.'
);
