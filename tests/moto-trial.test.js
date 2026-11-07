import assert from 'node:assert/strict';
import {makeCourse, ground, resetBike, turnBike, stepBike, FIXED_STEP} from '../public/moto-trial/physics.js';

assert.deepEqual(makeCourse(71), makeCourse(71));
assert.notDeepEqual(makeCourse(71).tiers, makeCourse(72).tiers);
for (let seed = 0; seed < 320; seed++) {
  const course = makeCourse(seed);
  const bike = resetBike(course);
  const landings = [];
  let airSteps = 0;
  for (let steps = 0; steps < 70 / FIXED_STEP && bike.status === 'ride'; steps++) {
    const previousTier = bike.tier;
    if (bike.onGround && bike.facing !== course.tiers[bike.tier].direction) turnBike(bike);
    stepBike(course, bike, {throttle: true});
    if (!bike.onGround) airSteps++;
    if (bike.tier !== previousTier) landings.push(bike.tier);
  }
  assert.equal(bike.status, 'finish', 'Seed ' + seed + ' must be possible to finish');
  assert.deepEqual(landings, [1, 2, 3, 4]);
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
const airborne = {...resetBike(course), x: first.end + 1, y: ground(first, first.end), onGround: false, angle: Math.PI, vy: 3};
for (let i = 0; i < 200 && airborne.status === 'ride'; i++) stepBike(course, airborne, {});
assert.equal(airborne.status, 'crash', 'An upside-down landing is a crash');
for (const lean of [-1, 1]) {
  const tilted = resetBike(course);
  for (let i = 0; i < 34; i++) stepBike(course, tilted, {lean});
  assert.equal(tilted.onGround, true);
  assert.ok(Math.sign(tilted.angle) === lean && Math.abs(tilted.angle) > .29);
  assert.ok(tilted.y < resetBike(course).y, 'Tilting lifts one wheel while the other stays on the ground');
  for (let i = 0; i < 200 && tilted.status === 'ride'; i++) stepBike(course, tilted, {lean});
  assert.equal(tilted.status, 'crash', 'Holding either direction too far tips the bike over');
  assert.equal(resetBike(course).x, course.tiers[0].marker);
}
console.log('PASS Moto Trial: 320 full procedural descents, turns, brakes, wheelies, crashes and restart at the beginning.');
