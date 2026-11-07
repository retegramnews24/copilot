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

export const COURSE_VERSION = 2;

export function makeCourse(seed, version = COURSE_VERSION) {
  const rng = random(seed), tiers = [], count = version === 1 ? 5 : 17;
  let start = 0, base = 0, overlap = 0;
  for (let i = 0; i < count; i++) {
    const direction = i % 2 ? -1 : 1;
    const pad = i ? overlap + 7 : 10;
    const ridge = 48 + rng() * 29;
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
    const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y));
    tiers.push({start, end, direction, marker, top, bottom, points: direction > 0 ? points : points.reverse()});
    overlap = (version === 1 ? 23 : 32) + rng() * 5;
    start = end + direction * overlap;
    base = Math.max(y + 1.15 + 7.1 + rng() * 2.1, bottom + 6.6);
  }
  const last = tiers.at(-1);
  return {seed: seed >>> 0, tiers, finish: last.end - last.direction * 5, bottom: base};
}

export function ground(tier, x) {
  const points = tier.points;
  if (x < points[0].x || x > points.at(-1).x) return null;
  const lo = segmentIndex(points, x);
  const a = points[lo], b = points[lo + 1], t = (x - a.x) / (b.x - a.x);
  return a.y + (b.y - a.y) * t;
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
  return Math.atan2(ground(tier, right) - ground(tier, left), right - left);
}

// Highest wheel centre that clears the whole segment, including lips and crests.
function circleSupport(tier, x, radius) {
  const points = tier.points, left = x - radius, right = x + radius;
  if (left > points.at(-1).x || right < points[0].x) return Infinity;
  let support = Infinity;
  for (let i = segmentIndex(points, left); i < points.length - 1 && points[i].x <= right; i++) {
    const a = points[i], b = points[i + 1], slope = (b.y - a.y) / (b.x - a.x);
    const touch = clamp(x - slope * radius / Math.hypot(1, slope), Math.max(left, a.x), Math.min(right, b.x));
    const height = a.y + slope * (touch - a.x) - Math.sqrt(Math.max(0, radius ** 2 - (touch - x) ** 2));
    support = Math.min(support, height);
  }
  return support;
}

export function bikeSupport(tier, x, angle) {
  const dx = Math.cos(angle) * AXLE, dy = Math.sin(angle) * AXLE;
  return Math.min(circleSupport(tier, x - dx, WHEEL) + dy, circleSupport(tier, x + dx, WHEEL) - dy);
}

export function helmetSupport(tier, x, angle, facing, lean) {
  const px = (HELMET.x + lean * .16) * facing;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = px * cos - HELMET.y * sin, dy = px * sin + HELMET.y * cos;
  return circleSupport(tier, x + dx, HELMET.radius) - dy;
}

function contact(tier, x) {
  const angle = terrainAngle(tier, x);
  return {y: bikeSupport(tier, x, angle), angle};
}

export function resetBike(course) {
  const tier = course.tiers[0], x = tier.marker;
  return {x, y: contact(tier, x).y, vx: 0, vy: 0, angle: 0, spin: 0, balance: 0,
    lean: 0, roll: 0, facing: tier.direction, tier: 0, onGround: true, status: 'ride'};
}

export function turnBike(bike) {
  if (bike.status === 'ride') bike.facing *= -1;
}

const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function findLanding(course, bike, from, leaving) {
  const angleDelta = wrap(bike.angle - from.angle);
  let firstHit = null;
  // Only the current path and its receiving platform can be part of this drop.
  for (let i = bike.tier; i <= Math.min(bike.tier + 1, course.tiers.length - 1); i++) {
    const tier = course.tiers[i];
    if (Math.max(from.y, bike.y) + 1.6 < tier.top ||
        Math.min(from.y, bike.y) - 1.6 > tier.bottom) continue;
    const at = t => {
      const x = from.x + (bike.x - from.x) * t, angle = from.angle + angleDelta * t;
      const lean = from.lean + (bike.lean - from.lean) * t;
      const y = from.y + (bike.y - from.y) * t;
      const wheels = bikeSupport(tier, x, angle), helmet = helmetSupport(tier, x, angle, bike.facing, lean);
      return {x, angle, lean, y, wheels, helmet};
    };
    const gap = t => {
      const {y, wheels, helmet} = at(t);
      return y - Math.min(wheels, helmet);
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
  const tier = course.tiers[bike.tier];
  const surface = bike.onGround && contact(tier, bike.x);
  if (surface) {
    if (input.brake) bike.vx *= Math.exp(-6.8 * dt);
    else {
      const drive = input.throttle ? bike.facing * 8.1 : 0;
      bike.vx += (drive + Math.sin(surface.angle) * 5.5 - bike.vx * (input.throttle ? .35 : .86)) * dt;
    }
    bike.vx = clamp(bike.vx, -12.8, 12.8);
  } else if (input.throttle) {
    bike.vx = clamp(bike.vx + bike.facing * .85 * dt, -12.8, 12.8);
  }
  bike.x += bike.vx * dt;
  bike.roll = (bike.roll + bike.vx * dt / WHEEL) % (Math.PI * 2);
  bike.lean += (lean * bike.facing - bike.lean) * Math.min(1, dt * 10);

  const next = surface && contact(tier, bike.x);
  const spin = bike.spin + (lean * 25 - bike.spin * 5.4 - bike.balance * 9.2) * dt;
  const balance = bike.balance + spin * dt;
  const nextAngle = next ? next.angle + balance : bike.angle;
  const support = !next ? Infinity : balance === 0 ? next.y : bikeSupport(tier, bike.x, nextAngle);
  const withinTier = bike.x > tier.points[0].x + AXLE + WHEEL &&
    bike.x < tier.points.at(-1).x - AXLE - WHEEL;
  const liftsAtCrest = withinTier && Number.isFinite(support) && bike.vy < -2.4 && Math.abs(bike.vx) > 6.5 &&
    surface.y + (bike.vy + GRAVITY * dt) * dt < next.y - .018;
  if (Number.isFinite(support) && !liftsAtCrest) {
    bike.spin = spin;
    bike.balance = balance;
    bike.y = support;
    bike.vy = clamp((next.y - surface.y) / dt, -5.2, 7.8);
    bike.angle = nextAngle;
    const helmet = helmetSupport(tier, bike.x, bike.angle, bike.facing, bike.lean);
    if (bike.y >= helmet) {
      bike.y = helmet;
      bike.status = 'crash';
    }
  } else {
    const leaving = bike.onGround;
    if (leaving && !liftsAtCrest) {
      const lip = (bike.x - tier.end) * tier.direction >= 0 ? tier.end : tier.start;
      const at = lip + Math.sign((tier.start + tier.end) / 2 - lip) * AXLE;
      bike.vy = clamp(Math.tan(terrainAngle(tier, at)) * bike.vx, -5.2, 7.8);
      if ((bike.x - tier.end) * tier.direction < 0) bike.vy = Math.max(0, bike.vy);
    }
    bike.onGround = false;
    bike.vy = Math.min(22, bike.vy + GRAVITY * dt);
    bike.y += bike.vy * dt;
    bike.spin = clamp((bike.spin + lean * 12.4 * dt) * Math.exp(-1.7 * dt), -4.4, 4.4);
    bike.angle = wrap(bike.angle + bike.spin * dt);
    const hit = findLanding(course, bike, from, leaving);
    if (hit) {
      if (hit.helmet <= hit.wheels) {
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
        bike.vy = 0;
        bike.spin *= .35;
        bike.balance = wrap(hit.angle - angle);
        bike.tier = hit.tier;
        bike.onGround = true;
      }
    } else if (bike.tier + 1 < course.tiers.length &&
        bike.y - AXLE - WHEEL > course.tiers[bike.tier + 1].bottom) {
      // A missed receiving platform ends the attempt before a later tier can be skipped.
      bike.status = 'crash';
    }
  }
  if (bike.y > course.bottom) bike.status = 'crash';
  if (bike.status === 'ride' && bike.tier === course.tiers.length - 1) {
    const last = course.tiers.at(-1);
    const crossed = (from.x - course.finish) * last.direction < 0;
    if ((bike.x - course.finish) * last.direction >= 0 &&
        (bike.onGround || crossed && Math.abs(bike.y - ground(last, course.finish)) < 3)) {
      bike.status = 'finish';
    }
  }
}
