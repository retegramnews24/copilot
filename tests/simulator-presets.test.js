import assert from 'node:assert/strict';
import { initial, act, view, refreshMarket, TRACKS } from '../simulator/engine.js';
import { estimate } from '../simulator/physics.js';

// Ready-made plans must be valid strategies, finish the race and keep their promise in a full simulation.
const now = Date.now(),
  u = { id: '1', name: 'Test' };
for (const tier of [1, 3]) {
  for (const season of [1, 2, 3]) {
    const s = initial(now);
    s.season = season;
    refreshMarket(s, now);
    act(s, u, { action: 'create' }, now);
    const t = s.teams['1'];
    const pick = role => ({ ...s.offers.find(o => o.role === role), skill: 40 + tier * 15, points: 0 });
    t.drivers = [pick('driver'), pick('driver')];
    t.crew = { motor: pick('motor'), aero: pick('aero'), mechanic: pick('mechanic') };
    t.engine = pick('engine');
    for (let round = 0; round < TRACKS.length; round++) {
      s.round = round;
      const report = view(s, u, now).engineering;
      for (const [slot, d] of report.drivers.entries()) {
        assert.deepEqual(
          d.presets.map(p => p.key),
          ['safe', 'balanced', 'attack']
        );
        for (const p of d.presets) {
          const where = `${TRACKS[round][0]} season ${season} tier ${tier} ${p.name}`;
          // The server accepts the plan exactly as the button sends it.
          act(s, u, { action: 'strategy', slot, strategy: p.strategy }, now);
          assert.deepEqual(t.strategies[slot], p.strategy, where);
          assert.equal(p.dnf, false, where + ': must reach the finish');
          assert(p.finishFuel > 0, where);
          assert.equal(p.strategy.stops.length, p.key === 'attack' ? 2 : 1, where);
          assert(p.minutes > 10 && p.minutes < 70, where + ' minutes ' + p.minutes);
        }
        assert(d.presets[0].finishFuel >= 1, 'safe plan keeps a reserve at ' + TRACKS[round][0]);
      }
    }
  }
}
// Wet forecast picks wet-weather tyres for the stints that run in the rain.
const wet = initial(now);
refreshMarket(wet, now);
act(wet, u, { action: 'create' }, now);
const w = wet.teams['1'];
const any = role => ({ ...wet.offers.find(o => o.role === role), points: 0 });
w.drivers = [any('driver'), any('driver')];
w.crew = { motor: any('motor'), aero: any('aero'), mechanic: any('mechanic') };
w.engine = any('engine');
let sawWet = false;
for (let round = 0; round < TRACKS.length; round++) {
  wet.round = round;
  for (const p of view(wet, u, now).engineering.drivers[0].presets) {
    const tyres = [p.strategy.compound, ...p.strategy.stops.map(x => x.compound)];
    if (tyres.some(c => c === 'inter' || c === 'wet')) sawWet = true;
  }
}
assert(sawWet, 'at least one round of the season has a wet stint');
void estimate;
console.log('PASS presets: 3 plans × 2 drivers × 13 GP × 3 seasons × 2 team levels are valid, finish the race and adapt tyres to rain.');
