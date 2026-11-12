import assert from "node:assert/strict";
import {
  TRACKS,
  PROFILES,
  lapsFor,
  metrics,
  deltaFor,
  consume,
  estimate,
  pitService,
  weatherAt,
} from "../simulator/physics.js";
import { initial, act, advance, strategy } from "../simulator/engine.js";
import { shapes } from "../public/simulator/geometry.js";
import { pitLayout, clearance } from "../public/simulator/pit-layout.js";
const dry = { water: 0, trackTemp: 30 };
const car = (i = 0, change = {}) => ({
  id: "reference",
  progress: 0,
  skill: 65,
  consistency: 100,
  tyres: 65,
  engine: 65,
  motor: 65,
  mechanic: 65,
  aerodynamic: 65,
  aero: 1,
  chassis: 1,
  fuel: 45,
  wear: 100,
  compound: "medium",
  strategy: strategy({
    fuel: 45,
    refuel: 12,
    wing: TRACKS[i][2],
    brake: TRACKS[i][3],
    pitLap: Math.round(lapsFor(i) / 2),
  }),
  ...change,
});
let c = car(),
  m = metrics(c, TRACKS[0], dry);
assert(metrics({ ...c, fuel: 90 }, TRACKS[0], dry).lap > m.lap);
assert(metrics({ ...c, fuel: 90 }, TRACKS[0], dry).wearPerLap > m.wearPerLap);
assert(
  metrics({ ...c, strategy: { ...c.strategy, wing: 100 } }, TRACKS[0], dry)
    .consumption > m.consumption,
);
assert(
  metrics({ ...c, strategy: { ...c.strategy, pace: "push" } }, TRACKS[0], dry)
    .wearPerLap > m.wearPerLap,
);
assert(metrics({ ...c, temperature: 120 }, TRACKS[0], dry).lap > m.lap);
assert(
  metrics({ ...c, wear: 20 }, TRACKS[0], dry).lap >
    metrics({ ...c, wear: 50 }, TRACKS[0], dry).lap + 2,
);
assert(
  metrics({ ...c, compound: "wet" }, TRACKS[0], { water: 0.8, trackTemp: 20 })
    .lap < metrics(c, TRACKS[0], { water: 0.8, trackTemp: 20 }).lap,
);
assert(
  pitService({ ...c, strategy: { ...c.strategy, refuel: 60 } }, 0).seconds >
    pitService({ ...c, strategy: { ...c.strategy, refuel: 5 } }, 0).seconds +
      10,
);
const full = deltaFor(c, TRACKS[0], dry, 30);
let integrated = 0;
for (let i = 0; i < 300; i++)
  integrated += deltaFor({ ...c, progress: integrated }, TRACKS[0], dry, 0.1);
assert(
  Math.abs(full - integrated) < 1e-7,
  "sector integration independent of tick duration",
);
// Numeric calibration: representative cars, matching weather tyres, all 13 tracks.
for (let i = 0; i < 13; i++) {
  const x = car(i),
    w = weatherAt(i, 0, 1);
  if (w.water > 0.5) {
    x.compound = "wet";
    x.strategy.compound = "wet";
  }
  if (w.rain === "Pioggia in aumento") x.strategy.compound = "wet";
  if (w.rain === "Pista in asciugatura") {
    x.compound = "inter";
    x.strategy.compound = "medium";
  }
  const result = estimate(x, i, lapsFor(i), 1);
  assert(!result.dnf, TRACKS[i][0]);
  assert(
    result.seconds > 33 * 60 && result.seconds < 46 * 60,
    TRACKS[i][0] + " duration " + result.seconds,
  );
  assert(result.fuelNeeded > 15 && result.fuelNeeded < 70);
  assert(result.stops < 5);
}
function setup() {
  const s = initial(0);
  act(s, { id: "1", name: "Test" }, { action: "create" }, 0);
  const t = s.teams["1"];
  t.drivers = [0, 1].map((i) => ({
    id: "d" + i,
    name: "Driver " + i,
    skill: 65,
    consistency: 100,
    tyres: 65,
    points: 0,
    salary: 1,
  }));
  t.crew = {
    motor: { skill: 65, salary: 1 },
    aero: { skill: 65, salary: 1 },
    mechanic: { skill: 65, salary: 1 },
  };
  t.engine = { skill: 65 };
  t.enrolled = true;
  t.strategies = [car().strategy, car().strategy];
  s.schedule = { dates: [1000], participants: ["1"] };
  advance(s, 1000);
  return s;
}
let s = setup();
for (const x of s.race.cars) {
  x.startDelay = 0;
  x.progress = s.race.laps - 0.0001;
  x.fuel = 1e-8;
}
advance(s, 2000);
assert(
  s.race.cars.every((x) => x.dnf && !x.finished),
  "fuel exhaustion before finish cannot score an arrival",
);
s = setup();
for (const x of s.race.cars) {
  x.startDelay = 0;
  x.progress = 0.99999;
  x.fuel = 0.0001;
  x.pitRequested = true;
}
advance(s, 2000);
assert(
  s.race.cars.every((x) => !x.dnf && x.pits === 1),
  "fuel sufficient to reach pit entry must refuel before exhaustion",
);
assert(
  s.race.cars[1].pitTime > s.race.cars[0].pitTime,
  "double stack queues same-team service",
);
// Projected run and authoritative solo race share the same model, within sampling/queue margin.
s = setup();
s.race.cars = s.race.cars.slice(0, 1);
s.race.cars[0].startDelay = 0;
const expected = estimate(car(), 0, lapsFor(0), 1);
for (let sec = 1; sec <= 3600 && s.race.active; sec++) {
  s.teams["1"].seen = 1000 + sec * 1000;
  advance(s, 1000 + sec * 1000);
}
assert(!s.race.active);
assert(
  Math.abs(s.results[0].rows[0].time - expected.seconds) < 15,
  "forecast agrees with race",
);
function cross(a, b, c, d) {
  const det = (p, q, r) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return (
    det(a, b, c) * det(a, b, d) < -1e-8 && det(c, d, a) * det(c, d, b) < -1e-8
  );
}
for (let i = 0; i < 13; i++) {
  const p = pitLayout(i),
    line = shapes[i].map((q) => [q[0] * 1000, q[1] * 650]);
  for (let j = 1; j < p.lane.length; j++)
    for (let k = 0; k < line.length; k++)
      assert(
        !cross(p.lane[j - 1], p.lane[j], line[k], line[(k + 1) % line.length]),
        "pit crossing " + i,
      );
  for (const g of p.garage)
    assert(clearance(g, line) >= 6 + p.garageSize / 2 + 1, "garage clearance");
  for (let j = 10; j < p.lane.length - 10; j++)
    assert(clearance(p.lane[j], line) > 6 + p.width / 2, "pit lane clearance");
}
console.log(
  "PASS physics: 13 calibrated races, fuel/weight/aero/temperature/degradation, variable refuelling, tick integration, forecast vs live, boundary fuel DNF, double stack, all pit corridors non-intersecting.",
);
