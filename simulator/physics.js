// Tunable game model, not a reconstruction of any current F1 technical regulation.
import { shapes, position } from "../public/simulator/geometry.js";
import { pitLayout } from "../public/simulator/pit-layout.js";
export const TRACKS = [
  ["Spa", 7.004, 65, 55],
  ["Monza", 5.793, 18, 59],
  ["Imola", 4.909, 70, 57],
  ["Suzuka", 5.807, 78, 56],
  ["Canada", 4.361, 45, 60],
  ["Melbourne", 5.278, 58, 57],
  ["Barcellona", 4.657, 75, 54],
  ["Silverstone", 5.891, 73, 55],
  ["Hockenheim", 4.574, 55, 59],
  ["Nürburgring", 5.148, 67, 56],
  ["Interlagos", 4.309, 65, 57],
  ["Red Bull Ring", 4.318, 40, 60],
  ["Monaco", 3.337, 95, 53],
];
// Baseline seconds, abrasion, full-throttle proportion, pit transit loss, overtaking opportunity.
const specs = [
  [112, 1.05, 0.72, 22, 0.8],
  [86, 0.8, 0.82, 23, 0.95],
  [90, 1.04, 0.62, 25, 0.4],
  [101, 1.24, 0.65, 22, 0.5],
  [79, 0.88, 0.72, 20, 0.8],
  [85, 0.92, 0.73, 22, 0.75],
  [84, 1.28, 0.61, 22, 0.55],
  [95, 1.2, 0.7, 23, 0.7],
  [81, 0.95, 0.69, 21, 0.8],
  [94, 1.02, 0.6, 22, 0.6],
  [76, 1.04, 0.65, 20, 0.8],
  [69, 0.9, 0.78, 20, 0.9],
  [78, 0.72, 0.38, 19, 0.12],
];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const PROFILES = specs.map((s, i) => {
  const p = {
    base: s[0],
    abrasion: s[1],
    throttle: s[2],
    pitLoss: s[3],
    passing: s[4],
    laps: Math.round(2280 / (s[0] + 5)),
  };
  const offset = pitLayout(i).phase;
  const raw = Array.from({ length: 120 }, (_, j) => {
    const a = position(offset + (j - 0.8) / 120, shapes[i]),
      b = position(offset + (j + 0.8) / 120, shapes[i]);
    const angle = Math.abs(
      Math.atan2(Math.sin(b[2] - a[2]), Math.cos(b[2] - a[2])),
    );
    return 0.7 + Math.min(1.8, angle * 1.35);
  });
  const mean = raw.reduce((a, b) => a + b) / raw.length;
  p.sectors = raw.map((x) => x / mean);
  return p;
});
export const lapsFor = (round) => PROFILES[Math.min(round, 12)].laps;
export const tyreTypes = {
  soft: { offset: -1, wear: 1.2, opt: 94 },
  medium: { offset: 0, wear: 0.8, opt: 91 },
  hard: { offset: 0.7, wear: 0.43, opt: 88 },
  inter: { offset: 2, wear: 0.88, opt: 75 },
  wet: { offset: 4, wear: 0.8, opt: 65 },
};
export function weatherAt(round, seconds = 0, season = 1) {
  const seed = (round * 7 + season * 3) % 13,
    base = 25 + ((round * 3 + season) % 13);
  const phase = clamp(seconds / 2400, 0, 1);
  const water =
    seed === 4
      ? clamp(phase * 1.6, 0, 1)
      : seed === 9
        ? clamp(0.85 - phase, 0, 1)
        : seed === 1
          ? 0.65
          : 0;
  return {
    water,
    wet: water > 0.18,
    trackTemp: base - water * 12,
    rain:
      seed === 4
        ? "Pioggia in aumento"
        : seed === 9
          ? "Pista in asciugatura"
          : seed === 1
            ? "Pioggia stabile"
            : "Asciutto",
    forecast:
      seed === 4
        ? "Pioggia crescente nella seconda parte"
        : seed === 9
          ? "Pioggia iniziale, progressiva asciugatura"
          : seed === 1
            ? "Pioggia per la gara"
            : "Asciutto previsto",
  };
}
export function metrics(c, track, weather) {
  const i = TRACKS.findIndex((t) => t[0] === track[0]),
    p = PROFILES[Math.max(0, i)],
    w =
      typeof weather === "boolean"
        ? { water: weather ? 0.7 : 0, trackTemp: 30 }
        : weather;
  const st = c.strategy,
    tyre = tyreTypes[c.compound] || tyreTypes.medium,
    pace = st.pace || "normal",
    load = st.wing / 100,
    water = w.water || 0;
  const target =
    tyre.opt +
    (w.trackTemp - 30) * 0.5 +
    { save: -8, normal: 0, push: 12 }[pace] +
    c.fuel * 0.025 +
    (p.abrasion - 1) * 8 -
    water * 20;
  const temp = c.temperature ?? tyre.opt,
    heat = Math.max(0, temp - tyre.opt - 8),
    cold = Math.max(0, tyre.opt - temp - 10);
  const slip = Math.max(0, (track[2] - st.wing) / 100),
    brakeError = Math.abs(track[3] - st.brake);
  const consumption =
    track[1] *
    (0.24 + 0.095 * p.throttle) *
    (1 + (load - 0.5) * 0.1) *
    (1 + (70 - c.engine) * 0.0012) *
    (1 + (70 - c.motor) * 0.0007) *
    { save: 0.87, normal: 1, push: 1.13 }[pace] *
    (1 - water * 0.13);
  const wetTyre = c.compound === "wet" || c.compound === "inter";
  const mismatch =
    c.compound === "wet"
      ? Math.max(0, 0.55 - water) * 20
      : c.compound === "inter"
        ? Math.max(0, 0.18 - water) * 18 + Math.max(0, water - 0.65) * 18
        : water * 30;
  const wearPerLap =
    track[1] *
    tyre.wear *
    p.abrasion *
    (1.3 - (c.tyres ?? 60) / 200) *
    (1 + c.fuel / 400) *
    (1 + slip * 0.4 + brakeError * 0.012) *
    (1 + heat * 0.035) *
    { save: 0.78, normal: 1, push: 1.27 }[pace] *
    (wetTyre ? 1 + Math.max(0, 0.3 - water) * 4 : 1 - water * 0.18);
  const remaining = c.wear,
    deg = (100 - remaining) * 0.017 + Math.max(0, 40 - remaining) ** 2 * 0.006;
  // Aero has both drag and corner grip; the best compromise varies with track and weather.
  const ideal = clamp(track[2] + water * 12, 0, 100) / 100;
  const aero = 9 * (load - ideal) ** 2;
  const base =
    p.base +
    (75 - c.skill) * 0.12 +
    (70 - c.engine) * 0.035 -
    (c.aero + c.chassis - 2) * 0.13 -
    (c.motor + c.aerodynamic - 140) * 0.006 +
    c.fuel * (0.018 + track[1] * 0.002) +
    aero +
    brakeError * 0.1 +
    tyre.offset +
    deg +
    heat * 0.11 +
    cold * 0.045 +
    mismatch +
    { save: 1.8, normal: 0, push: -1.2 }[pace] +
    water * 9;
  return {
    consumption,
    wearPerLap,
    target,
    temperature: temp,
    lap: Math.max(50, base),
    grip: clamp(100 - deg * 5 - heat * 1.2 - cold * 0.5 - mismatch * 2, 5, 100),
    profile: p,
    load,
    ideal,
  };
}
export function deltaFor(c, track, weather, dt) {
  const m = metrics(c, track, weather);
  let h = 0;
  for (const ch of String(c.id) + ":" + Math.floor(c.progress))
    h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const variation =
    (((h >>> 0) % 1000) / 1000 - 0.5) * (100 - c.consistency) * 0.025;
  const lap = Math.max(45, m.lap + variation);
  let progress = c.progress,
    left = dt;
  // Integrate sector crossings exactly: the result cannot depend on server tick size.
  for (let guard = 0; left > 1e-9 && guard < 240; guard++) {
    const phase = ((progress % 1) + 1) % 1,
      index = Math.min(119, Math.floor((phase + 1e-10) * 120)),
      sector = m.profile.sectors[index],
      factor =
        sector > 1
          ? 1 - (m.load - m.ideal) * 0.09
          : 1 + (m.load - m.ideal) * 0.09;
    const distance = Math.max(1e-9, (index + 1) / 120 - phase),
      seconds = distance * lap * sector * factor;
    if (left < seconds) {
      progress += left / (lap * sector * factor);
      break;
    }
    progress += distance;
    left -= seconds;
  }
  return progress - c.progress;
}
export function consume(c, track, weather, delta, dt) {
  const m = metrics(c, track, weather);
  c.consumption = m.consumption;
  c.wearPerLap = m.wearPerLap;
  c.temperature =
    (c.temperature ?? tyreTypes[c.compound].opt) +
    (m.target - (c.temperature ?? tyreTypes[c.compound].opt)) *
      (1 - Math.exp(-dt / 65));
  c.fuel = Math.max(0, c.fuel - delta * m.consumption);
  c.wear = Math.max(0, c.wear - delta * m.wearPerLap);
  c.grip = m.grip;
  return m;
}
export function stopPlan(c) {
  const next = c.strategy.stops?.[c.pits || 0];
  return (
    next || {
      lap: c.pits || 0 ? Infinity : c.strategy.pitLap,
      compound: c.strategy.compound,
      refuel: c.strategy.refuel,
    }
  );
}
export function pitService(c, round) {
  const plan = stopPlan(c),
    added = Math.max(0, Math.min(110 - c.fuel, plan.refuel));
  const service = Math.max(2.3 + (100 - c.mechanic) * 0.025, added / 3.5);
  return { plan, added, service, seconds: PROFILES[round].pitLoss + service };
}
export function estimate(c, round, laps, season = 1) {
  c = structuredClone(c);
  c.progress = 0;
  c.pits = 0;
  c.temperature = tyreTypes[c.compound].opt;
  c.wear = 100;
  let elapsed = 0,
    last = 0,
    stops = 0,
    used = 0;
  while (c.progress < laps && elapsed < 4200) {
    const weather = weatherAt(round, elapsed, season),
      m = metrics(c, TRACKS[round], weather);
    let d = Math.min(deltaFor(c, TRACKS[round], weather, 2), laps - c.progress),
      dt = 2;
    if (d * m.consumption > c.fuel)
      return {
        seconds: elapsed,
        stops,
        fuelNeeded: used,
        finishFuel: 0,
        dnf: true,
      };
    used += d * m.consumption;
    consume(c, TRACKS[round], weather, d, dt);
    c.progress += d;
    elapsed += dt;
    if (Math.floor(c.progress) > last && c.progress < laps) {
      last = Math.floor(c.progress);
      if (
        last >= stopPlan(c).lap ||
        c.wear <= c.strategy.wearAt ||
        c.fuel < m.consumption * 1.7
      ) {
        const service = pitService(c, round);
        elapsed += service.seconds;
        c.fuel += service.added;
        c.compound = service.plan.compound;
        c.wear = 100;
        c.temperature = 65;
        c.pits++;
        stops++;
      }
    }
  }
  return {
    seconds: elapsed,
    stops,
    fuelNeeded: used,
    finishFuel: c.fuel,
    dnf: c.progress < laps,
  };
}
