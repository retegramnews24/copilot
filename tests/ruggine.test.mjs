// Ruggine 89 senza grafica (analisi 10.5 e 10.6): guida, avversari, urti e colpi sono funzioni di public/ruggine/cars.js
// che non disegnano niente. Qui girano in Node con un generatore con seme (sempre le stesse corse) e tre auto guidate
// dal gioco. Prima il 15% delle auto restava ferma per sempre davanti alla curva dei punti 430-433.
import assert from 'node:assert/strict';
import { register } from 'node:module';

// 'three' nel gioco arriva dalla mappa degli import della pagina: qui si indica il file a mano
const three = new URL('../public/vendor/three/three.module.min.js', import.meta.url).href;
register(
  'data:text/javascript,' +
    encodeURIComponent(
      `export async function resolve(s, c, next) { return s === 'three' ? { url: ${JSON.stringify(three)}, shortCircuit: true } : next(s, c); }`
    )
);
const { Car, drive, aiInput, bump, Shots, setRandom, MIN_TARGET, STUN, GUARD } =
  await import('../public/ruggine/cars.js');
const W = await import('../public/ruggine/world.js');
const { N } = W;
const { levelSetup, PLAYER_START } = await import('../public/ruggine/cars.js');

// generatore con seme (mulberry32)
const seeded = seed => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const scene = { add() {}, remove() {} };
// un'auto senza modello 3D: stessi campi di Car.place
const car = (name, progress, lane, skill) => {
  const c = { name, ai: true, pose() {} };
  Car.prototype.place.call(c, progress, lane);
  c.skill = skill;
  return c;
};
const DT = 1 / 60; // come il gioco (analisi 11.9)

// una corsa come in main.js: tre auto guidate dal gioco, colpi e urti; ritorna quanto ci mette ogni auto
function race(seed, limit = 8 * 60) {
  setRandom(seeded(seed));
  const cars = [car('A', -14, 1.8, 1), car('B', -6, -1.8, 0.99), car('C', -22, -1.8, 1.01)];
  const shots = new Shots(scene);
  for (let time = 0; time < limit && cars.some(c => !c.finish); time += DT) {
    for (const c of cars) {
      const input = aiInput(c, cars, DT);
      if (input.fire) shots.fire(c);
      drive(c, input, DT, cars);
      if (c.finish && !c.time) c.time = time;
    }
    bump(cars);
    shots.update(DT, cars, () => {});
  }
  setRandom(null);
  return cars;
}

// 1. tutte le auto finiscono la corsa, in ogni corsa di prova
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
for (const seed of SEEDS) {
  const cars = race(seed);
  for (const c of cars)
    assert.ok(c.finish, `corsa ${seed}: l'auto ${c.name} non finisce (ferma al punto ${c.idx})`);
}

// 1b. livelli: ogni pista generata rispetta le regole (curve non più strette del minimo, le parti lontane non si
// toccano, la raffineria resta nel prato) e tutte le auto, con gli avversari e la bravura del livello, finiscono
const LEVELS = 20;
for (let level = 1; level <= LEVELS; level++) {
  W.useLevel(level);
  const P = W.track;
  assert.equal(P.length, N);
  assert.ok(Math.min(...W.radii(P)) >= W.minRadius(level) - 0.05, `livello ${level}: curva troppo stretta`);
  assert.ok(W.selfGap(P) >= 2 * W.WALL + 1, `livello ${level}: due parti della pista si toccano`);
  if (level > 1)
    assert.ok(
      P.every(p => Math.abs(p.x) > 46 || Math.abs(p.z) > 22),
      `livello ${level}: la pista passa nella raffineria`
    );
  const rivals = levelSetup(level);
  assert.equal(rivals.length, Math.min(5, 2 + Math.floor((level - 1) / 3)));
  setRandom(seeded(level));
  const cars = [car('Tu', ...PLAYER_START, 1), ...rivals.map(r => car(r.name, ...r.start, r.skill))];
  rivals.forEach((r, k) => (cars[k + 1].aggr = r.aggr));
  const shots = new Shots(scene);
  for (let time = 0; time < 8 * 60 && cars.some(c => !c.finish); time += DT) {
    for (const c of cars) {
      const input = aiInput(c, cars, DT);
      if (input.fire) shots.fire(c);
      drive(c, input, DT, cars);
    }
    bump(cars);
    shots.update(DT, cars, () => {});
  }
  for (const c of cars)
    assert.ok(c.finish, `livello ${level}: l'auto ${c.name} non finisce (ferma al punto ${c.idx})`);
}
setRandom(null);
W.useLevel(1);

// 2. il punto della curva stretta: da ferma l'auto riparte (prima l'obiettivo era zero e non dava gas)
setRandom(seeded(99));
for (const at of [430, 431, 432, 433]) {
  const c = car('ferma', at, 0, 0.97);
  const input = aiInput(c, [c], DT);
  assert.equal(input.gas, true, `ferma al punto ${at}: deve dare gas`);
  for (let i = 0; i < 180; i++) drive(c, aiInput(c, [c], DT), DT, [c]);
  assert.ok(c.v > 2, `al punto ${at} riparte (velocità ${c.v.toFixed(2)})`);
}
assert.ok(MIN_TARGET > 0);

// 3. colpi: dopo uno stordimento un secondo senza colpi (prima un avversario allineato ti teneva fermo a lungo)
const shooter = car('spara', 100, 0, 1),
  target = car('colpita', 104, 0, 1);
const shots = new Shots(scene);
const hits = [];
const hitOnce = () => {
  shooter.cool = 0;
  shooter.stun = 0;
  shots.fire(shooter);
  for (let i = 0; i < 20; i++) shots.update(DT, [shooter, target], c => hits.push(c.name));
};
hitOnce();
assert.equal(hits.length, 1, 'first shot hits');
assert.ok(target.stun > 0 && target.guard > STUN);
hitOnce();
assert.equal(hits.length, 1, 'no second hit while stunned');
for (let t = 0; t < STUN + GUARD + 0.1; t += DT)
  drive(target, { steer: 0, gas: false, brake: true }, DT, [target]);
Car.prototype.place.call(target, 104, 0); // di nuovo davanti a chi spara
hitOnce();
assert.equal(hits.length, 2, 'after the guard second it can be hit again');
setRandom(null);
assert.ok(N > 400);

console.log(
  `PASS Ruggine 89: ${SEEDS.length} races with three cars driven by the game all finish, a stopped car restarts, one second without hits after a stun.`
);
