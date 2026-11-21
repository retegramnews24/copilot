import assert from 'node:assert/strict';
import {makeCourse, ground, bikeSupport, helmetSupport, COURSE_VERSION, resetBike, turnBike, stepBike, FIXED_STEP} from '../public/moto-trial/physics.js';

import {helmetPosition,riderPose} from '../public/moto-trial/rider.js';
import {FIXED_COURSES} from '../public/moto-trial/courses.js';

function drive(course, bike = resetBike(course)) {
  const landings = [];
  let airSteps = 0, lean = 0, jumps = 0;
  let steps = 0;
  for (; steps < 210 / FIXED_STEP && bike.status === 'ride'; steps++) {
    const previousTier = bike.tier;
    const tier = course.tiers[bike.tier], cleared = bike.clearedJump;
    let throttle = true, brake = false;
    if (bike.onGround && bike.facing !== tier.direction) {
      if (bike.vx * tier.direction < -1.25) { brake = true; throttle = false; }
      else turnBike(bike);
    }
    const distance = (tier.end - bike.x) * tier.direction;
    if (bike.onGround && tier.precisionDrop && distance < 9 && distance >= -1 && bike.facing === tier.direction) {
      const speed = bike.vx * tier.direction;
      if (speed > 8.15) brake = true;
      if (speed > 7.6) throttle = false;
    }
    if (bike.onGround && tier.jump?.short && bike.facing === tier.direction) {
      const approach = (tier.jump.lip - bike.x) * tier.direction;
      if (approach > 0 && approach < 7) {
        const target = Math.sqrt((Math.abs(tier.jump.landing - tier.jump.lip) + 2.8) * 13.6 / (2 * tier.jump.launch));
        const speed = bike.vx * tier.direction;
        if (speed > target + .18) brake = true;
        if (speed > target - .25) throttle = false;
      }
    }
    if (steps % 4 === 0) {
      const preview = bike.x + bike.vx * .15;
      const front = ground(tier, preview + .7), back = ground(tier, preview - .7);
      const target = front === null || back === null ? 0 : Math.atan2(front - back, 1.4);
      const spin = bike.spin + bike.turnTorque * .000205;
      const error = Math.atan2(Math.sin(target - bike.angle), Math.cos(target - bike.angle)) - .36 * spin;
      lean = !bike.onGround && Math.abs(error) > .37 ? Math.sign(error) : 0;
    }
    stepBike(course, bike, {throttle, brake, lean});
    if (!cleared && bike.clearedJump) jumps++;
    if (!bike.onGround) airSteps++;
    else {
      const tier = course.tiers[bike.tier];
      assert.ok(bike.y <= bikeSupport(tier, bike.x, bike.angle, bike.leftSpring, bike.rightSpring) + 1e-8, 'Wheels clear the solid surface');
    }
    if (bike.tier !== previousTier) landings.push(bike.tier);
  }
  return {bike, landings, jumps, airSteps, duration: steps * FIXED_STEP};
}

assert.deepEqual(makeCourse(71, 4), makeCourse(71, 4));
assert.notDeepEqual(makeCourse(71, 4).tiers, makeCourse(72, 4).tiers);
const durations = [];
for (let seed = 0; seed < 320; seed++) {
  const course = makeCourse(seed, 4);
  const {bike, landings, jumps, airSteps, duration} = drive(course);
  assert.equal(bike.status, 'finish', 'Seed ' + seed + ' must be possible to finish');
  assert.equal(course.tiers.length, 16);
  assert.equal(jumps, 12);
  assert.equal(course.tiers.filter(tier => tier.precisionDrop).length, 4);
  assert.deepEqual(landings, course.tiers.slice(1).map((_, i) => i + 1));
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

const course = makeCourse(72, 4), bike = resetBike(course);
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
assert.equal(rideRamp(3).jumping.status, 'offCourse', 'A slow jump cannot bridge the gap or skip to the next tier');
const safeJump = rideRamp(12.8);
assert.equal(safeJump.jumping.clearedJump, true);
assert.ok(safeJump.compression > .15, 'A hard landing compresses the suspension');
assert.equal(makeCourse(71, 2).tiers.length, 17);
assert.ok(makeCourse(71, 2).tiers.every(tier => !tier.jump));
const cliff = {version: 4, tiers: [flat(0, 10, 0), flat(-5, 20, 12)], finish: 18, bottom: 24};
for (const direction of [-1, 1]) {
  const x = direction > 0 ? 9.6 : .4;
  const tipping = {...resetBike(cliff), x, y: bikeSupport(cliff.tiers[0], x, 0), vx: direction * 2.5};
  for (let i = 0; i < 12; i++) stepBike(cliff, tipping, {});
  assert.equal(tipping.onGround, true, 'The second wheel is still supported');
  assert.ok(tipping.angle * direction > .03, 'The free wheel drops before the second wheel leaves');
}
const speedTest = {version: 4, tiers: [flat(0, 90, 0)], finish: 85, bottom: 12};
const flatBike = {...resetBike(speedTest), x: 10, y: -.38, vx: 12.8};
const angle = .45, oneWheel = {...flatBike, angle, balance: angle, y: bikeSupport(speedTest.tiers[0], 10, angle)};
stepBike(speedTest, flatBike, {throttle: true});
stepBike(speedTest, oneWheel, {throttle: true});
assert.ok(oneWheel.vx > flatBike.vx);

const freeFlight = {...resetBike(cliff), x: 30, y: -60, onGround: false};
stepBike(cliff, freeFlight, {lean: 1}, .01);
assert.equal(freeFlight.turnTorque, 7500);
stepBike(cliff, freeFlight, {lean: 1}, .01);
assert.equal(freeFlight.turnTorque, 5625);
stepBike(cliff, freeFlight, {lean: -1}, .01);
assert.equal(freeFlight.turnTorque, -7500, 'Opposite input immediately retriggers the Classic impulse');
for (let i = 0; i < 26; i++) stepBike(cliff, freeFlight, {}, .01);
assert.equal(freeFlight.turnTorque, 0);
const inertialSpin = freeFlight.spin;
stepBike(cliff, freeFlight, {}, .01);
assert.equal(freeFlight.spin, inertialSpin, 'Free flight has no artificial self-leveling or angular drag');
assert.equal(makeCourse(71, 3).tiers.filter(tier => tier.jump).length, 9);
const flatOut = makeCourse(4, 4), unbraked = resetBike(flatOut);
for (let i = 0; i < 24000 && unbraked.status === 'ride'; i++) {
  if (unbraked.onGround && unbraked.facing !== flatOut.tiers[unbraked.tier].direction) turnBike(unbraked);
  stepBike(flatOut, unbraked, {throttle: true});
  assert.ok(Number.isFinite(unbraked.y), 'A clipped suspension at the lip keeps a finite pose');
}
assert.ok(['crash','offCourse'].includes(unbraked.status));
const legacy = makeCourse(71, 1);
assert.equal(legacy.tiers.length, 5);
assert.notEqual(legacy.finish, makeCourse(71, 4).finish);
console.log('PASS Moto Trial: 320 descents (' + Math.round(Math.min(...durations)) + '–' +
  Math.round(Math.max(...durations)) + ' s), twelve gaps, precision drops, edge pivots and Classic air impulses.');

assert.equal(FIXED_COURSES.length, 10);
assert.equal(new Set(FIXED_COURSES.map(track => track.name)).size, 10);
assert.throws(() => makeCourse(11), RangeError);
assert.ok(makeCourse(1).tiers.length < makeCourse(10).tiers.length);
assert.ok(makeCourse(1).tiers.every(tier=>!tier.precisionDrop&&!tier.jump.short));
assert.equal(makeCourse(10).tiers.filter(tier=>tier.jump.short).length,2);
for (let id = 1; id <= FIXED_COURSES.length; id++) {
  const course = makeCourse(id);
  assert.deepEqual(course, makeCourse(id, COURSE_VERSION));
  assert.ok(FIXED_COURSES.some(track => track.name === course.name));
  const {bike, landings, jumps, duration} = drive(course);
  assert.equal(bike.status, 'finish', course.name);
  assert.deepEqual(landings, course.tiers.slice(1).map((_, i) => i + 1));
  assert.equal(jumps, course.tiers.length);
  assert.ok(duration >= 18 && duration <= 65, course.name + ': ' + duration + ' s');
  for (const {jump} of course.tiers) {
    assert.ok(jump.launch > 0);
  }
  assert.ok(course.tiers.every(tier => ground(tier, (tier.jump.lip + tier.jump.landing) / 2) === null));
}
console.log('PASS Moto Trial fixed circuits: ten distinct courses, all jumps and finishes verified.');


const current = makeCourse(1), neutral = riderPose(0), forward = riderPose(1), rearward = riderPose(-1);
assert.deepEqual(neutral.hand, forward.hand);
assert.deepEqual(neutral.foot, rearward.foot);
assert.ok(forward.head[0] - rearward.head[0] > .9);
assert.deepEqual(forward.head, helmetPosition(1));
const upsideDown = {...resetBike(current), y:-4, angle:Math.PI, onGround:false};
for(let i=0;i<250&&upsideDown.status==='ride';i++)stepBike(current,upsideDown,{});
assert.equal(upsideDown.status,'crash');
assert.ok(Math.abs(upsideDown.y-helmetSupport(current.tiers[0],upsideDown.x,upsideDown.angle,upsideDown.facing,upsideDown.lean,6))<.01);
const voidRide = {...resetBike(current), x:-80, y:current.bottom-4, vy:2, onGround:false};
for(let i=0;i<250&&voidRide.status==='ride';i++)stepBike(current,voidRide,{});
assert.equal(voidRide.status,'offCourse');
const wheelsFirst = {...resetBike(current), y:-4, angle:.4, onGround:false};
for(let i=0;i<180;i++)stepBike(current,wheelsFirst,{});
assert.equal(wheelsFirst.status,'ride');
assert.equal(wheelsFirst.onGround,true);
console.log('PASS articulated Moto Trial: fixed hand and foot anchors, wheel-first recovery, helmet contact and distinct out-of-course reset.');

// Releasing the throttle at the start of the first ramp must still allow a tyre-first landing.
const earlyCoast = resetBike(current);
for(let i=0;i<900&&earlyCoast.status==='ride'&&!earlyCoast.clearedJump;i++){
  stepBike(current,earlyCoast,{throttle:earlyCoast.x<19.5});
}
assert.equal(earlyCoast.status,'ride');
assert.equal(earlyCoast.clearedJump,true);
assert.ok(earlyCoast.x<current.tiers[0].jump.landing,'The front tyre lands before the chassis reaches the lip');

const below = current.tiers[1];
const missX = current.tiers[0].jump.lip + 1.2;
const incoming = {...resetBike(current),x:missX,y:ground(below,missX)-3.5,vy:9,onGround:false};
const missed = {...incoming,vx:2}, headFirst = {...incoming,angle:Math.PI};
for (const bike of [missed,headFirst]) {
  for(let i=0;i<500&&bike.status==='ride'&&!bike.onGround;i++)stepBike(current,bike,{});
}
assert.equal(missed.status,'ride');
assert.equal(missed.onGround,true);
assert.equal(missed.tier,1,'Landing on the lower deck adopts it as the new route');
assert.equal(missed.vx,2,'Safe landings preserve horizontal motion');
assert.equal(missed.y,bikeSupport(below,missed.x,missed.angle,missed.leftSpring,missed.rightSpring));
assert.equal(drive(current,{...missed}).bike.status,'finish','The rider can finish from the lower route');
assert.equal(headFirst.status,'crash','Helmet contact still counts when it occurs on the lower deck');
assert.ok(Math.abs(headFirst.y-helmetSupport(below,headFirst.x,headFirst.angle,headFirst.facing,headFirst.lean,COURSE_VERSION))<.01);

const skipCourse = {version:COURSE_VERSION,tiers:[flat(-4,0,0),flat(4,6,4),flat(-8,20,9)],finish:15,bottom:24};
const skip = {...resetBike(skipCourse),x:12,y:0,vx:1,onGround:false};
for(let i=0;i<500&&!skip.onGround&&skip.status==='ride';i++)stepBike(skipCourse,skip,{});
assert.equal(skip.status,'ride');
assert.equal(skip.tier,2,'A safe landing can skip multiple decks');
const pastGate = {...resetBike(skipCourse),x:17,y:8.62,tier:2,vx:0};
stepBike(skipCourse,pastGate,{});
assert.equal(pastGate.status,'ride','Being beyond the flag is not a finish');
Object.assign(pastGate,{x:15.04,vx:-8,facing:-1});
stepBike(skipCourse,pastGate,{throttle:true});
assert.equal(pastGate.status,'finish','The flag can be crossed from either side');

assert.equal(current.tiers[1].start,makeCourse(1,7).tiers[1].start+8);
assert.ok(ground(current.tiers[1],current.tiers[1].recovery)!==null);
assert.equal(makeCourse(10).tiers.filter(tier=>tier.recovery!==undefined).length,1);
console.log('PASS Moto Trial alternate routes: front tyre contact, recovery from lower decks, finish from either direction and helmet-only crash.');
