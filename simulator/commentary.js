// Public race commentary and private per-car statistics for the post-race report.
// Called once per simulated second, after every car has moved. Pure: reads and annotates the race.

export const lapTime = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const say = (r, at, text) => {
  const lap = Math.min(r.laps, Math.floor(Math.max(0, ...r.cars.map(c => c.progress))) + 1);
  r.events.unshift({ text, at, lap });
};
// Running order: finished cars by arrival, then by distance; retired cars last.
export function runningOrder(r) {
  const arrival = new Map(r.classification.map((id, i) => [id, i]));
  return [...r.cars].sort(
    (a, b) =>
      a.dnf - b.dnf ||
      (a.finished && b.finished ? arrival.get(a.id) - arrival.get(b.id) : 0) ||
      !!b.finished - !!a.finished ||
      b.progress - a.progress
  );
}
// Seconds between two cars, estimated from the distance and the chaser's last lap.
const gapSeconds = (front, back) => Math.max(0, (front.progress - back.progress) * (back.lastLap || 90));

export function trackRace(r, at, dt) {
  const order = runningOrder(r),
    ids = order.map(c => c.id),
    position = new Map(ids.map((id, i) => [id, i + 1])),
    pitting = new Set(r.cars.filter(c => c.pitTime > 0).map(c => c.id)),
    prev = r.order,
    prevPitting = new Set(r.pitting || []);
  // Private statistics, accumulated per car.
  for (const c of r.cars) {
    if (c.finished || c.dnf) continue;
    if (c.blocked) c.trafficSeconds = (c.trafficSeconds || 0) + dt;
    if (c.wear < 40 && !(c.pitTime > 0)) {
      // Same degradation curve as physics.metrics: extra lap time compared with a tyre at 40%.
      const deg = w => (100 - w) * 0.017 + Math.max(0, 40 - w) ** 2 * 0.006;
      c.wornSeconds = (c.wornSeconds || 0) + dt;
      c.wornLoss = (c.wornLoss || 0) + ((deg(c.wear) - deg(40)) * dt) / (c.lastLap || 90);
    }
    const lap = Math.floor(c.progress);
    if (lap > (c.positionsLogged || 0)) {
      c.positions = [...(c.positions || []), position.get(c.id)];
      c.positionsLogged = lap;
    }
  }
  if (prev) {
    const before = new Map(prev.map((id, i) => [id, i]));
    const cars = new Map(r.cars.map(c => [c.id, c]));
    const steady = id =>
      !pitting.has(id) && !prevPitting.has(id) && !cars.get(id)?.dnf && !cars.get(id)?.finished;
    // Lead change on track (not because the leader stopped).
    if (ids[0] !== prev[0] && steady(ids[0]) && steady(prev[0]) && before.has(ids[0]))
      say(r, at, `${cars.get(ids[0]).name} passa in testa!`);
    else if (ids[0] !== prev[0] && pitting.has(prev[0]) && steady(ids[0]))
      say(r, at, `${cars.get(ids[0]).name} in testa durante la sosta di ${cars.get(prev[0]).name}.`);
    // Overtakes for position, at most two per second, with a cooldown per pair.
    r.passes ??= {};
    let told = 0;
    for (let i = 1; i < ids.length && told < 2; i++) {
      const a = ids[i - 1],
        b = ids[i];
      if (!before.has(a) || !before.has(b) || before.get(a) < before.get(b)) continue;
      if (!steady(a) || !steady(b) || (i === 1 && ids[0] !== prev[0])) continue;
      const key = a + '>' + b;
      if (at - (r.passes[key] || 0) < 30000) continue;
      r.passes[key] = at;
      say(r, at, `${cars.get(a).name} supera ${cars.get(b).name}: ora è ${i}°.`);
      told++;
    }
  }
  // Fastest lap of the race (from lap 2, to skip the standing start).
  for (const c of r.cars) {
    if (!c.best || c.progress < 2) continue;
    if (!r.fastest || c.best < r.fastest.time - 1e-6) {
      const first = !r.fastest;
      r.fastest = { id: c.id, name: c.name, time: c.best };
      if (!first) say(r, at, `Giro più veloce: ${c.name} in ${lapTime(c.best)}.`);
    }
  }
  const leader = order[0];
  if (leader && !leader.dnf) {
    if (!r.saidHalf && leader.progress >= r.laps / 2 && order[1]) {
      r.saidHalf = true;
      say(
        r,
        at,
        `Metà gara: ${leader.name} guida con ${gapSeconds(leader, order[1]).toFixed(1).replace('.', ',')} s su ${order[1].name}.`
      );
    }
    if (!r.saidLast && leader.progress >= r.laps - 1 && !leader.finished) {
      r.saidLast = true;
      say(
        r,
        at,
        order[1]
          ? `Ultimo giro! ${leader.name} davanti a ${order[1].name} di ${gapSeconds(leader, order[1]).toFixed(1).replace('.', ',')} s.`
          : `Ultimo giro per ${leader.name}.`
      );
    }
  }
  if (r.classification.length && !r.saidWinner) {
    r.saidWinner = true;
    say(r, at, `Bandiera a scacchi: vince ${r.cars.find(c => c.id === r.classification[0]).name}!`);
  }
  if (r.wasWet !== undefined && r.wasWet !== r.wet)
    say(
      r,
      at,
      r.wet
        ? 'Inizia a piovere: è il momento delle gomme intermedie.'
        : 'La pista si asciuga: tornano le slick.'
    );
  r.wasWet = r.wet;
  r.order = ids;
  r.pitting = [...pitting];
  r.events = r.events.slice(0, 30);
}
