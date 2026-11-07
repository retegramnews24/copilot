import assert from 'node:assert/strict';
import {makeCourse, ground, bikeSupport, helmetSupport, resetBike, turnBike, stepBike, FIXED_STEP} from '../public/moto-trial/physics.js';

assert.deepEqual(makeCourse(71), makeCourse(71));
assert.notDeepEqual(makeCourse(71).tiers, makeCourse(72).tiers);
const durations = [];
for (let seed = 0; seed < 320; seed++) {
  const course = makeCourse(seed);
  const bike = resetBike(course);
  const landings = [];
  let airSteps = 0;
  let steps = 0;
  for (; steps < 210 / FIXED_STEP && bike.status === 'ride'; steps++) {
    const previousTier = bike.tier;
    if (bike.onGround && bike.facing !== course.tiers[bike.tier].direction) turnBike(bike);
    stepBike(course, bike, {throttle: true});
    if (!bike.onGround) airSteps++;
    else {
      const tier = course.tiers[bike.tier];
      assert.ok(bike.y <= bikeSupport(tier, bike.x, bike.angle) + 1e-8, 'Wheels clear the solid surface');
    }
    if (bike.tier !== previousTier) landings.push(bike.tier);
  }
  assert.equal(bike.status, 'finish', 'Seed ' + seed + ' must be possible to finish');
  assert.equal(course.tiers.length, 17);
  assert.deepEqual(landings, course.tiers.slice(1).map((_, i) => i + 1));
  const duration = steps * FIXED_STEP;
  assert.ok(duration >= 165 && duration <= 200, 'Completion should be around three minutes: ' + duration);
  durations.push(duration);
  assert.ok(ground(course.tiers.at(-1), course.finish) !== null);
  assert.ok(airSteps > 0);
  for (const [index, tier] of course.tiers.entries()) {
    assert.ok(ground(tier, tier.marker) !== null);
    if (index) {
      const above = course.tiers[index - 1];
      assert.equal(tier.direction, -above.direction);
      assert.ok(ground(tier, above.end) > ground(above, above.end) + 6);
    }
  }
}

const course = makeCourse(72), bike = resetBike(course);
for (let i = 0; i < 100; i++) stepBike(course, bike, {throttle: true});
assert.ok(bike.vx > 0);
const {x, vx} = bike;
turnBike(bike);
assert.equal(bike.facing, -1);
assert.equal(bike.x, x);
assert.equal(bike.vx, vx, 'Turning must preserve momentum');
for (let i = 0; i < 200; i++) stepBike(course, bike, {brake: true, throttle: true});
assert.ok(Math.abs(bike.vx) < .01, 'Brake overrides the throttle');

const first = course.tiers[0];
const airborne = {...resetBike(course), x: first.end + 3, y: ground(first, first.end), onGround: false, angle: Math.PI, vy: 3};
for (let i = 0; i < 200 && airborne.status === 'ride'; i++) stepBike(course, airborne, {});
assert.equal(airborne.status, 'crash', 'An upside-down landing is a crash');
for (const lean of [-1, 1]) {
  const tilted = resetBike(course);
  for (let i = 0; i < 34; i++) stepBike(course, tilted, {lean});
  assert.equal(tilted.onGround, true);
  assert.ok(Math.sign(tilted.angle) === lean && Math.abs(tilted.angle) > .29);
  assert.ok(tilted.y < resetBike(course).y, 'Tilting lifts one wheel while the other stays on the ground');
  while (Math.abs(tilted.angle) < 1.25 && tilted.status === 'ride') stepBike(course, tilted, {lean});
  assert.equal(tilted.status, 'ride', 'A steep wheelie remains recoverable with the helmet clear');
  const recovered = {...tilted};
  for (let i = 0; i < 150; i++) stepBike(course, recovered, {});
  assert.equal(recovered.status, 'ride');
  assert.ok(Math.abs(recovered.angle) < .15);
  for (let i = 0; i < 200 && tilted.status === 'ride'; i++) stepBike(course, tilted, {lean});
  assert.equal(tilted.status, 'crash', 'Holding either direction eventually touches the helmet');
  assert.ok(Math.abs(tilted.y - helmetSupport(course.tiers[0], tilted.x, tilted.angle, tilted.facing, tilted.lean)) < 1e-8);
  assert.equal(resetBike(course).x, course.tiers[0].marker);
}
// The front wheel reaches the lip while the centre of the bike is still outside.
const flat = (a, b, y) => ({start: a, end: b, top: y, bottom: y, direction: 1, marker: a, points: [{x: a, y}, {x: b, y}]});
const edge = {tiers: [flat(-5, -4, 0), flat(1, 10, 8)], finish: 9, bottom: 18};
const edgeBike = {...resetBike(course), x: -.23, y: 7.41, vx: 12.8, vy: -.20, angle: .55, onGround: false};
for (let i = 0; i < 12 && !edgeBike.onGround; i++) stepBike(edge, edgeBike, {});
assert.equal(edgeBike.tier, 1);
assert.equal(edgeBike.status, 'ride');
assert.ok(edgeBike.x < 1);
assert.equal(edgeBike.y, bikeSupport(edge.tiers[1], edgeBike.x, edgeBike.angle));

const gate = {tiers: [flat(0, 10, 4)], finish: 8, bottom: 12};
const jumper = {...resetBike(gate), x: 7.95, y: 2, vx: 12.8, vy: .3, onGround: false};
stepBike(gate, jumper, {});
assert.equal(jumper.status, 'finish', 'Jumping through the final gate counts as finishing');

const legacy = makeCourse(71, 1);
assert.equal(legacy.tiers.length, 5);
assert.notEqual(legacy.finish, makeCourse(71).finish);
console.log('PASS Moto Trial: 320 descents (' + Math.round(Math.min(...durations)) + '–' +
  Math.round(Math.max(...durations)) + ' s), wheel contact at lips and recoverable wheelies until helmet impact.');
