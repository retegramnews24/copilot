import assert from 'node:assert/strict';
import {makeCourse, ground, bikeSupport, helmetSupport, resetBike, turnBike, stepBike, FIXED_STEP} from '../public/moto-trial/physics.js';

assert.deepEqual(makeCourse(71), makeCourse(71));
assert.notDeepEqual(makeCourse(71).tiers, makeCourse(72).tiers);
const durations = [];
for (let seed = 0; seed < 320; seed++) {
  const course = makeCourse(seed);
  const bike = resetBike(course);
  const landings = [];
  let airSteps = 0, lean = 0, jumps = 0;
  let steps = 0;
  for (; steps < 210 / FIXED_STEP && bike.status === 'ride'; steps++) {
    const previousTier = bike.tier;
    if (bike.onGround && bike.facing !== course.tiers[bike.tier].direction) turnBike(bike);
    const tier = course.tiers[bike.tier], cleared = bike.clearedJump;
    if (steps % 6 === 0) {
      const preview = bike.x + bike.vx * .18;
      const front = ground(tier, preview + .7), back = ground(tier, preview - .7);
      const target = front === null || back === null ? 0 : Math.atan2(front - back, 1.4);
      const error = Math.atan2(Math.sin(target - bike.angle), Math.cos(target - bike.angle)) - .21 * bike.spin;
      lean = !bike.onGround && Math.abs(error) > .23 ? Math.sign(error) : 0;
    }
    stepBike(course, bike, {throttle: true, lean});
    if (!cleared && bike.clearedJump) jumps++;
    if (!bike.onGround) airSteps++;
    else {
      const tier = course.tiers[bike.tier];
      assert.ok(bike.y <= bikeSupport(tier, bike.x, bike.angle, bike.leftSpring, bike.rightSpring) + 1e-8, 'Wheels clear the solid surface');
    }
    if (bike.tier !== previousTier) landings.push(bike.tier);
  }
  assert.equal(bike.status, 'finish', 'Seed ' + seed + ' must be possible to finish');
  assert.equal(course.tiers.length, 16);
  assert.equal(jumps, 9);
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
      if (tier.jump) assert.equal(ground(tier, (tier.jump.lip + tier.jump.landing) / 2), null);
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

const ramp = course.tiers[1];
function rideRamp(speed) {
  const x = ramp.jump.lip - ramp.direction * .015;
  const angle = Math.atan(-.66 * ramp.direction);
  const jumping = {...resetBike(course), tier: 1, x, y: bikeSupport(ramp, x, angle), angle,
    roadPitch: angle, vx: speed * ramp.direction, facing: ramp.direction};
  let compression = 0;
  for (let i = 0; i < 400 && jumping.status === 'ride' && !jumping.clearedJump; i++) {
    stepBike(course, jumping, {throttle: speed > 10});
    compression = Math.max(compression, jumping.leftSpring, jumping.rightSpring);
  }
  return {jumping, compression};
}
assert.equal(rideRamp(3).jumping.status, 'crash', 'A slow jump cannot bridge the gap or skip to the next tier');
const safeJump = rideRamp(12.8);
assert.equal(safeJump.jumping.clearedJump, true);
assert.ok(safeJump.compression > .15, 'A hard landing compresses the suspension');
assert.equal(makeCourse(71, 2).tiers.length, 17);
assert.ok(makeCourse(71, 2).tiers.every(tier => !tier.jump));
const legacy = makeCourse(71, 1);
assert.equal(legacy.tiers.length, 5);
assert.notEqual(legacy.finish, makeCourse(71).finish);
console.log('PASS Moto Trial: 320 descents (' + Math.round(Math.min(...durations)) + '–' +
  Math.round(Math.max(...durations)) + ' s), nine gaps, speed-sensitive jumps, suspension travel and recoverable wheelies.');
