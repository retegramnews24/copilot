import {fixedCourse} from './courses.js?v=9';
import {HEAD_RADIUS, helmetPosition} from './rider.js?v=6';

export const WHEEL = .38;
export const AXLE = .86;
export const HELMET = {x: -.01, y: -1.31, radius: .22};
export const FIXED_STEP = 1 / 120;
const GRAVITY = 13.6;

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const COURSE_VERSION = 8;

// X-Moto Classic: original.xml, Scene.h and BikePlayer.cpp.
const CLASSIC_STEP = .01, CLASSIC_SPEED = .6;
const CLASSIC_TORQUE = 10000, CLASSIC_DECAY = .75, CLASSIC_REPEAT_STEPS = 60;
const CLASSIC_FRAME_INERTIA = 90 * (1.2 ** 2 + 1.8 ** 2) / 12;
const CLASSIC_WHEEL_INERTIA = 2 * 10 * (.7 ** 2 + .55 ** 2 + .4 * .35 ** 2);
const CLASSIC_RIDER_INERTIA = 2 * 5 * [
  [-.25, .75], [.10, .525], [-.15, .85], [.15, -.085], [0, .30], [0, -.37], [.30, .45]
].reduce((sum, [x, y]) => sum + x * x + y * y + .4 * .4 ** 2, 0);
// Rigid aggregate of the Classic masses at rest. X-Moto solves the individual joints.
const CLASSIC_INERTIA = CLASSIC_FRAME_INERTIA + CLASSIC_WHEEL_INERTIA + CLASSIC_RIDER_INERTIA;

function classicTurn(bike, lean, dt, airborne) {
  let slice = CLASSIC_STEP - bike.turnClock, rotation = 0;
  bike.turnClock += dt;
  while (bike.turnClock + 1e-10 >= CLASSIC_STEP) {
    bike.turnClock -= CLASSIC_STEP;
    bike.turnTick++;
    if (lean && (bike.turnTick > bike.nextTurn || lean !== bike.turnDirection)) {
      bike.turnTorque = lean * CLASSIC_TORQUE;
      bike.nextTurn = bike.turnTick + CLASSIC_REPEAT_STEPS;
      bike.turnDirection = lean;
    }
    if (airborne) rotation += bike.spin * slice;
    slice = CLASSIC_STEP;
    if (airborne) bike.spin += bike.turnTorque / CLASSIC_INERTIA * CLASSIC_STEP * CLASSIC_SPEED ** 2;
    bike.turnTorque *= CLASSIC_DECAY;
    if (Math.abs(bike.turnTorque) < 100) bike.turnTorque = 0;
  }
  return rotation + bike.spin * Math.min(dt, Math.max(0, bike.turnClock));
}

function addJump(tier, ridgeStart, ridge, rng, index, expert) {
  const direction = tier.direction;
  const approach = ridgeStart + direction * (ridge * (.27 + rng() * .07));
  const ramp = 7, lip = approach + direction * ramp;
  const width = (index < 5 ? 7.8 : expert ? 10.45 : 9.8) + rng() * 1.9;
  const landing = lip + direction * width, exit = landing + direction * 17;
  const runupY = ground(tier, approach);
  const lipY = runupY - 3.85;
  const landingY = lipY + (index < 5 ? 2 : expert && index % 4 === 2 ? -.20 : 1.1);
  const exitY = landingY + 1.45, offset = exitY - ground(tier, exit);
  tier.points = tier.points.filter(p => (p.x - approach) * direction < 0 || (p.x - exit) * direction > 0);
  for (const p of tier.points) if ((p.x - exit) * direction > 0) p.y += offset;
  tier.points.push({x: approach, y: runupY}, {x: approach + direction * 2, y: runupY - .55},
    {x: lip, y: lipY}, {x: landing, y: landingY},
    {x: landing + direction * 4, y: landingY + .65}, {x: exit, y: exitY});
  tier.points.sort((a, b) => a.x - b.x);
  tier.points.find(p => p.x === Math.min(lip, landing)).gapAfter = true;
  tier.jump = {approach, lip, landing};
}

export function makeCourse(seed, version = COURSE_VERSION) {
  if (version >= 5) return fixedCourse(seed, version);
  const rng = random(seed), tiers = [], count = version === 1 ? 5 : version === 2 ? 17 : 16;
  let start = 0, base = 0, overlap = 0;
  for (let i = 0; i < count; i++) {
    const direction = i % 2 ? -1 : 1;
    const pad = i ? overlap + 7 : 10;
    const ridge = (version >= 4 ? 68 : 48) + rng() * 29;
    const end = start + direction * (pad + ridge + 9);
    const points = [{x: start, y: base}, {x: start + direction * pad, y: base}];
    const bumps = Math.ceil(ridge / 4.2);
    const frequency = version === 1 ? 0 : [1.26, .71, .97][Math.floor(rng() * 3)];
    const phase = version === 1 ? 0 : rng() * Math.PI * 2;
    const difficulty = i < 2 ? .65 : 1;
    let y = base, slope = .13;
    for (let j = 1; j <= bumps; j++) {
      if (version === 1) {
        slope = clamp(slope * .42 + (rng() - .38) * .65, -.37, .45);
        y += slope * ridge / bumps;
      } else {
        const wave = Math.sin(j * frequency + phase);
        slope = clamp(slope * .32 + (rng() - .40) * .73 + wave * .23 * difficulty,
          -.38 - .16 * difficulty, .45 + .17 * difficulty);
        y = Math.max(base - 1.5, y + slope * ridge / bumps);
      }
      points.push({x: start + direction * (pad + j * ridge / bumps), y});
    }
    points.push({x: end, y: y + (i === count - 1 ? 0 : 1.15)});
    const marker = start + direction * (i ? overlap - 5 : 4);
    const tier = {start, end, direction, marker, points: direction > 0 ? points : points.reverse()};
    const expert = version >= 4;
    if (expert && [2, 5, 9, 12].includes(i)) tier.precisionDrop = true;
    if (version >= 3 && i >= 1 && i < count - 1 && (expert ? i !== 4 && i !== 11 : i % 2 || i === 8 || i === 12)) {
      addJump(tier, start + direction * pad, ridge, rng, i, expert);
    }
    tier.top = Math.min(...tier.points.map(p => p.y));
    tier.bottom = Math.max(...tier.points.map(p => p.y));
    tiers.push(tier);
    overlap = (version === 1 ? 23 : version === 2 ? 32 : tier.precisionDrop ? 21.5 : 39) + rng() * 5;
    start = end + direction * overlap;
    base = Math.max(y + 1.15 + 7.1 + rng() * 2.1, tier.bottom + (version >= 3 ? 12.6 : 6.6));
  }
  const last = tiers.at(-1);
  return {seed: seed >>> 0, version, tiers, finish: last.end - last.direction * 5, bottom: base};
}

export function ground(tier, x) {
  const points = tier.points;
  if (x < points[0].x || x > points.at(-1).x) return null;
  const lo = segmentIndex(points, x);
  const a = points[lo], b = points[lo + 1], t = (x - a.x) / (b.x - a.x);
  return a.gapAfter && t > 0 && t < 1 ? null : a.y + (b.y - a.y) * t;
}

function segmentIndex(points, x) {
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x < points[mid].x) hi = mid;
    else lo = mid;
  }
  return lo;
}

function terrainAngle(tier, x) {
  const left = Math.max(tier.points[0].x, x - AXLE);
  const right = Math.min(tier.points.at(-1).x, x + AXLE);
  if (right <= left) return 0;
  const y1 = ground(tier, left), y2 = ground(tier, right);
  if (y1 !== null && y2 !== null) return Math.atan2(y2 - y1, right - left);
  const {jump, direction} = tier;
  if (!jump) return 0;
  if ((x - jump.lip) * direction < AXLE) return Math.atan(-direction * .66);
  return Math.atan(direction * .65 / 3);
}

// Highest wheel centre that clears the whole segment, including lips and crests.
function circleSupport(tier, x, radius) {
  const points = tier.points, left = x - radius, right = x + radius;
  if (left > points.at(-1).x || right < points[0].x) return Infinity;
  let support = Infinity;
  for (let i = segmentIndex(points, left); i < points.length - 1 && points[i].x <= right; i++) {
    const a = points[i], b = points[i + 1];
    if (a.gapAfter) continue;
    const slope = (b.y - a.y) / (b.x - a.x);
    const touch = clamp(x - slope * radius / Math.hypot(1, slope), Math.max(left, a.x), Math.min(right, b.x));
    const height = a.y + slope * (touch - a.x) - Math.sqrt(Math.max(0, radius ** 2 - (touch - x) ** 2));
    support = Math.min(support, height);
  }
  return support;
}

function wheelLimits(tier, x, angle, left = 0, right = 0) {
  const cos = Math.cos(angle), sin = Math.sin(angle), dx = cos * AXLE, dy = sin * AXLE;
  return [circleSupport(tier, x - dx + sin * left, WHEEL) + dy + cos * left,
    circleSupport(tier, x + dx + sin * right, WHEEL) - dy + cos * right];
}

export function bikeSupport(tier, x, angle, left = 0, right = 0) {
  return Math.min(...wheelLimits(tier, x, angle, left, right));
}

function helmetCentre(angle, facing, lean, version) {
  const [headX, headY] = version >= 6 ? helmetPosition(lean) : [HELMET.x + lean * .16, HELMET.y];
  const px = headX * facing, cos = Math.cos(angle), sin = Math.sin(angle);
  return [px * cos - headY * sin, px * sin + headY * cos];
}

export function helmetSupport(tier, x, angle, facing, lean, version = 4) {
  const [dx, dy] = helmetCentre(angle, facing, lean, version);
  return circleSupport(tier, x + dx, version >= 6 ? HEAD_RADIUS : HELMET.radius) - dy;
}

function helmetOverlap(tier, x, y, angle, facing, lean) {
  const [dx, dy] = helmetCentre(angle, facing, lean, 6);
  const px = x + dx, py = y + dy, radius = HEAD_RADIUS, points = tier.points;
  let nearest = Infinity;
  for (let i = segmentIndex(points, px - radius); i < points.length - 1 && points[i].x <= px + radius; i++) {
    const a = points[i], b = points[i + 1];
    if (a.gapAfter || b.x < px - radius) continue;
    const sx = b.x - a.x, sy = b.y - a.y;
    const t = clamp(((px - a.x) * sx + (py - a.y) * sy) / (sx * sx + sy * sy), 0, 1);
    nearest = Math.min(nearest, Math.hypot(px - a.x - sx * t, py - a.y - sy * t));
  }
  return radius - nearest;
}

function contact(tier, x) {
  const angle = terrainAngle(tier, x);
  return {y: bikeSupport(tier, x, angle), angle};
}

export function resetBike(course) {
  const tier = course.tiers[0], x = tier.marker;
  return {x, y: contact(tier, x).y, vx: 0, vy: 0, angle: 0, spin: 0, balance: 0,
    lean: 0, roll: 0, leftSpring: 0, rightSpring: 0, pitchRate: 0, roadPitch: 0, edgePivot: 0,
    clearedJump: false, jumping: false, turnClock: 0, turnTick: 0, nextTurn: 0, turnTorque: 0,
    turnDirection: 0, version: course.version, facing: tier.direction, tier: 0, onGround: true, status: 'ride'};
}

export function turnBike(bike) {
  if (bike.status !== 'ride') return;
  bike.facing *= -1;
  if (bike.version >= 6) bike.lean *= -1;
}

const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function findLanding(course, bike, from, leaving) {
  const angleDelta = wrap(bike.angle - from.angle);
  let firstHit = null;
  const current = course.tiers[bike.tier], solidLedges = course.version >= 6;
  const next = bike.tier + 1;
  const last = solidLedges ? course.tiers.length - 1 : Math.min(next, course.tiers.length - 1);
  for (let i = bike.tier; i <= last; i++) {
    if (!solidLedges && i === next && course.version >= 3 &&
        ((bike.x - current.end) * current.direction < -AXLE || current.jump && !bike.clearedJump)) continue;
    const tier = course.tiers[i];
    const reach = course.version >= 6 ? 2.6 : 1.6;
    if (Math.max(from.y, bike.y) + reach < tier.top || Math.min(from.y, bike.y) - reach > tier.bottom ||
        solidLedges && (Math.max(from.x, bike.x) + reach < tier.points[0].x ||
          Math.min(from.x, bike.x) - reach > tier.points.at(-1).x)) continue;
    const at = t => {
      const x = from.x + (bike.x - from.x) * t, angle = from.angle + angleDelta * t;
      const lean = from.lean + (bike.lean - from.lean) * t;
      const y = from.y + (bike.y - from.y) * t;
      // When launching from a ramp the rear wheel can still graze its edge.
      // Keep the launch velocity until the bike reaches the receiving ledge.
      const stillAtLaunch = i === bike.tier && bike.jumping &&
        (x - tier.jump.landing) * tier.direction < -(AXLE + WHEEL + .26);
      const wheels = stillAtLaunch ? Infinity : bikeSupport(tier, x, angle, bike.leftSpring, bike.rightSpring);
      const helmet = course.version >= 6 ? y : helmetSupport(tier, x, angle, bike.facing, lean);
      const head = course.version >= 6 ? helmetOverlap(tier, x, y, angle, bike.facing, lean) : y - helmet;
      return {x, angle, lean, y, wheels, helmet, head};
    };
    const gap = t => {
      const {y, wheels, head} = at(t);
      return Math.max(y - wheels, head);
    };
    let previous = gap(0);
    // A wheel already touching at take-off can separate from the track.
    const initialContact = leaving && i === bike.tier;
    for (let sample = 1; sample <= 4; sample++) {
      const t = sample / 4, distance = gap(t);
      if (distance >= 0 && (previous < 0 || !initialContact || distance > previous + .00001)) {
        let low = (sample - 1) / 4, high = t;
        for (let pass = 0; pass < 8; pass++) {
          const mid = (low + high) / 2;
          if (gap(mid) >= 0) high = mid;
          else low = mid;
        }
        if (!firstHit || high < firstHit.t) firstHit = {...at(high), t: high, tier: i};
        break;
      }
      previous = distance;
    }
  }
  return firstHit;
}

export function stepBike(course, bike, input, dt = FIXED_STEP) {
  if (bike.status !== 'ride') return;
  const from = {x: bike.x, y: bike.y, angle: bike.angle, lean: bike.lean}, lean = input.lean || 0;
  const tier = course.tiers[bike.tier], technical = course.version >= 3, expert = course.version >= 4;
  const previousSpeed = bike.vx, articulated = course.version >= 6;
  const surface = bike.onGround && contact(tier, bike.x);
  if (surface) {
    const [left, right] = technical ? wheelLimits(tier, bike.x, bike.angle, bike.leftSpring, bike.rightSpring) : [];
    const oneWheel = expert && Math.abs(left - right) > .14;
    if (input.brake) bike.vx *= Math.exp(-6.8 * dt);
    else {
      let traction = 1;
      if (technical && input.throttle) {
        const rear = bike.facing > 0 ? left : right;
        if (!expert && rear - Math.min(left, right) > .24) traction = .22;
        if (oneWheel) traction = 1.08;
      }
      const drive = input.throttle ? bike.facing * 8.1 * traction : 0;
      bike.vx += (drive + Math.sin(surface.angle) * 5.5 - bike.vx * (input.throttle ? .35 : .86)) * dt;
    }
    const limit = expert ? Math.max(oneWheel ? 13.4 : 12.8, Math.abs(previousSpeed) - dt * 3) : 12.8;
    bike.vx = clamp(bike.vx, -limit, limit);
  } else if (!technical && input.throttle) {
    bike.vx = clamp(bike.vx + bike.facing * .85 * dt, -12.8, 12.8);
  }
  bike.x += bike.vx * dt;
  bike.roll = (bike.roll + bike.vx * dt / WHEEL) % (Math.PI * 2);
  bike.lean += (lean * bike.facing - bike.lean) * (articulated ? 1 - Math.exp(-dt * 10) : Math.min(1, dt * 10));

  if (technical) {
    const effort = surface ? (bike.vx - previousSpeed) / dt * bike.facing : 0;
    const frontLoad = clamp(-effort * .009, 0, .15), rearLoad = clamp(effort * .008, 0, .12);
    const springResponse = Math.min(1, dt * (surface ? 6.5 : 11));
    bike.leftSpring += ((bike.facing > 0 ? rearLoad : frontLoad) - bike.leftSpring) * springResponse;
    bike.rightSpring += ((bike.facing > 0 ? frontLoad : rearLoad) - bike.rightSpring) * springResponse;
  }
  const next = surface && contact(tier, bike.x);
  const weightShift = technical ? clamp((previousSpeed - bike.vx) / dt, -12, 12) * .27 : 0;
  const riderTorque = articulated ? lean * 22 + bike.lean * bike.facing * 3 : lean * 25;
  let spin = bike.spin + (riderTorque + weightShift - bike.spin * 5.4 - bike.balance * 9.2) * dt;
  let balance = bike.balance + spin * dt;
  const roadPitch = next && technical ? bike.roadPitch + wrap(next.angle - bike.roadPitch) * Math.min(1, dt * 14) : next?.angle;
  let nextAngle = next ? roadPitch + balance : bike.angle;
  let pivot = 0;
  if (expert && next) {
    const [left, right] = wheelLimits(tier, bike.x, bike.angle, bike.leftSpring, bike.rightSpring);
    if (Number.isFinite(left) !== Number.isFinite(right)) {
      pivot = Number.isFinite(left) ? 1 : -1;
      spin = bike.spin + (pivot * 11.8 + lean * 11 - bike.spin * 1.4) * dt;
      nextAngle = bike.angle + spin * dt;
      balance = wrap(nextAngle - roadPitch);
    }
  }
  const support = !next ? Infinity : balance === 0 && !technical ? next.y : bikeSupport(tier, bike.x, nextAngle, bike.leftSpring, bike.rightSpring);
  const withinTier = bike.x > tier.points[0].x + AXLE + WHEEL &&
    bike.x < tier.points.at(-1).x - AXLE - WHEEL;
  const jump = tier.jump;
  const onRamp = jump && (bike.x - jump.approach) * tier.direction > -5 &&
    (bike.x - jump.lip) * tier.direction < 2;
  const liftsAtCrest = !onRamp && withinTier && Number.isFinite(support) && bike.vy < -2.4 && Math.abs(bike.vx) > 6.5 &&
    surface.y + (bike.vy + GRAVITY * dt) * dt < next.y - .018;
  const overLip = surface && jump && (from.x - jump.lip) * tier.direction < 0 &&
    (bike.x - jump.lip) * tier.direction >= 0;
  const rebound = technical && !onRamp && surface && bike.vy < -1 && bike.rebound;
  if (Number.isFinite(support) && !liftsAtCrest && !overLip && !rebound) {
    if (expert) classicTurn(bike, lean, dt, false);
    bike.edgePivot = pivot;
    bike.spin = spin;
    bike.balance = balance;
    bike.roadPitch = roadPitch;
    bike.y = support;
    bike.vy = clamp((pivot ? bike.y - from.y : next.y - surface.y) / dt, -5.2, 7.8);
    bike.pitchRate = clamp(wrap(nextAngle - bike.angle) / dt, -2, 2);
    bike.angle = nextAngle;
    const helmet = helmetSupport(tier, bike.x, bike.angle, bike.facing, bike.lean, course.version);
    if (bike.y >= helmet && (!articulated || helmetOverlap(tier, bike.x, bike.y, bike.angle, bike.facing, bike.lean) >= 0)) {
      if (!articulated) bike.y = helmet;
      bike.status = 'crash';
    }
  } else {
    const leaving = bike.onGround;
    if (overLip) {
      bike.jumping = true;
      bike.vy = -Math.abs(bike.vx) * (jump.launch ?? .67);
    } else if (leaving && !liftsAtCrest && !rebound && !(expert && bike.edgePivot)) {
      const lip = (bike.x - tier.end) * tier.direction >= 0 ? tier.end : tier.start;
      const at = lip + Math.sign((tier.start + tier.end) / 2 - lip) * AXLE;
      bike.vy = clamp(Math.tan(terrainAngle(tier, at)) * bike.vx, -5.2, 7.8);
      if ((bike.x - tier.end) * tier.direction < 0) bike.vy = Math.max(0, bike.vy);
    }
    if (leaving && technical && !rebound) {
      bike.spin = bike.pitchRate * (expert && bike.edgePivot ? 1 : .32);
      bike.edgePivot = 0;
    }
    bike.rebound = false;
    bike.onGround = false;
    bike.vy = Math.min(22, bike.vy + GRAVITY * dt);
    bike.y += bike.vy * dt;
    const wheelTorque = technical ? (input.brake ? .85 : input.throttle ? -.18 : 0) * bike.facing : 0;
    const classicRotation = expert ? classicTurn(bike, lean, dt, true) : 0;
    if (!expert) bike.spin = clamp((bike.spin + (lean * (technical ? 15.8 : 12.4) + wheelTorque) * dt) * Math.exp(-(technical ? .8 : 1.7) * dt), -4.4, 4.4);
    bike.angle = wrap(bike.angle + (course.version >= 5 ? classicRotation : bike.spin * dt));
    const hit = findLanding(course, bike, from, leaving);
    if (hit) {
      if (articulated ? hit.head >= 0 : hit.helmet <= hit.wheels) {
        bike.x = hit.x;
        bike.angle = wrap(hit.angle);
        bike.lean = hit.lean;
        bike.y = hit.helmet;
        bike.status = 'crash';
      } else if (hit.y - hit.wheels > WHEEL) {
        // The wheel met the side of a ledge from below. Stop the horizontal motion.
        bike.x = from.x;
        bike.vx = 0;
      } else {
        const landing = course.tiers[hit.tier], angle = terrainAngle(landing, hit.x);
        bike.x = hit.x;
        bike.y = hit.wheels;
        bike.angle = wrap(hit.angle);
        bike.lean = hit.lean;
        const impact = bike.vy;
        let landingTorque = 0;
        if (technical && impact > 2) {
          const [left, right] = wheelLimits(landing, hit.x, hit.angle, bike.leftSpring, bike.rightSpring);
          const travel = Math.min(.26, impact * .026);
          if (Math.abs(right - left) > .16) landingTorque = Math.sign(right - left) * Math.min(.65, impact * .057);
          const leftSpring = left < right + .13 ? Math.max(bike.leftSpring, travel) : bike.leftSpring;
          const rightSpring = right < left + .13 ? Math.max(bike.rightSpring, travel) : bike.rightSpring;
          const compressed = bikeSupport(landing, hit.x, hit.angle, leftSpring, rightSpring);
          if (Number.isFinite(compressed)) {
            bike.leftSpring = leftSpring;
            bike.rightSpring = rightSpring;
            bike.y = compressed;
          }
          const helmet = helmetSupport(landing, hit.x, hit.angle, bike.facing, bike.lean, course.version);
          if (bike.y >= helmet && (!articulated || hit.y <= helmet ||
              helmetOverlap(landing, hit.x, bike.y, hit.angle, bike.facing, bike.lean) >= 0)) {
            bike.y = helmet;
            bike.status = 'crash';
          }
        }
        bike.rebound = technical && impact > 12;
        bike.vy = bike.rebound ? -Math.min(1.85, impact * .14) : 0;
        bike.spin = bike.spin * (technical ? .61 : .35) + landingTorque;
        bike.roadPitch = angle;
        bike.balance = wrap(hit.angle - angle);
        if (hit.tier !== bike.tier) bike.clearedJump = false;
        bike.tier = hit.tier;
        // The tyre can touch the lip while the chassis is still behind it.
        const landingReach = course.version >= 7 ? AXLE + WHEEL + .26 : AXLE;
        if (landing.jump && (bike.x - landing.jump.landing) * landing.direction >= -landingReach) bike.clearedJump = true;
        bike.jumping = false;
        bike.onGround = true;
      }
    } else if (!articulated && technical && jump && (bike.x - tier.end) * tier.direction < -AXLE &&
        (bike.x - jump.lip) * tier.direction > -AXLE && bike.y > tier.bottom + 2.5) {
      bike.status = 'offCourse';
    } else if (!articulated && bike.tier + 1 < course.tiers.length &&
        bike.y - AXLE - WHEEL > course.tiers[bike.tier + 1].bottom) {
      // A missed receiving platform ends the attempt before a later tier can be skipped.
      bike.status = 'offCourse';
    }
  }
  if (bike.status === 'ride' && bike.y > course.bottom) bike.status = 'offCourse';
  if (bike.status === 'ride' && bike.tier === course.tiers.length - 1) {
    const last = course.tiers.at(-1);
    const before = (from.x - course.finish) * last.direction;
    const past = (bike.x - course.finish) * last.direction;
    const gateHeight = ground(last, course.finish);
    const reached = course.version >= 8
      ? before !== past && before * past <= 0 && Math.abs(bike.y - gateHeight) < 3
      : past >= 0 && (bike.onGround || before < 0 && Math.abs(bike.y - gateHeight) < 3);
    if (reached) {
      bike.status = 'finish';
    }
  }
}
