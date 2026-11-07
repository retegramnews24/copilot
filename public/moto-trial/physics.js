export const WHEEL = .38;
export const AXLE = .86;
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

export function makeCourse(seed) {
  const rng = random(seed), tiers = [];
  let start = 0, base = 0, overlap = 0;
  for (let i = 0; i < 5; i++) {
    const direction = i % 2 ? -1 : 1;
    const pad = i ? overlap + 7 : 10;
    const ridge = 48 + rng() * 29;
    const end = start + direction * (pad + ridge + 9);
    const points = [{x: start, y: base}, {x: start + direction * pad, y: base}];
    const bumps = Math.ceil(ridge / 4.2);
    let y = base, slope = .13;
    for (let j = 1; j <= bumps; j++) {
      slope = Math.max(-.37, Math.min(.45, slope * .42 + (rng() - .38) * .65));
      y += slope * ridge / bumps;
      points.push({x: start + direction * (pad + j * ridge / bumps), y});
    }
    points.push({x: end, y: y + (i === 4 ? 0 : 1.15)});
    const marker = start + direction * (i ? overlap - 5 : 4);
    tiers.push({start, end, direction, marker, points: direction > 0 ? points : points.reverse()});
    overlap = 23 + rng() * 5;
    start = end + direction * overlap;
    const deepest = Math.max(...points.map(p => p.y));
    base = Math.max(y + 1.15 + 7.1 + rng() * 2.1, deepest + 6.6);
  }
  const last = tiers.at(-1);
  return {seed: seed >>> 0, tiers, finish: last.end - last.direction * 5, bottom: base};
}

export function ground(tier, x) {
  const points = tier.points;
  if (x < points[0].x || x > points.at(-1).x) return null;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x < points[mid].x) hi = mid;
    else lo = mid;
  }
  const a = points[lo], b = points[hi], t = (x - a.x) / (b.x - a.x);
  return a.y + (b.y - a.y) * t;
}

function contact(tier, x) {
  const y = ground(tier, x);
  if (y === null) return null;
  const left = ground(tier, x - AXLE), right = ground(tier, x + AXLE);
  const slope = (right ?? y) - (left ?? y);
  const angle = Math.atan2(slope, (left === null || right === null) ? AXLE : 2 * AXLE);
  return {y: (left !== null && right !== null ? (left + right) / 2 : y) - WHEEL, angle};
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

export function stepBike(course, bike, input, dt = FIXED_STEP) {
  if (bike.status !== 'ride') return;
  const previousX = bike.x, previousY = bike.y, lean = input.lean || 0;
  const surface = bike.onGround && contact(course.tiers[bike.tier], bike.x);
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

  const next = surface && contact(course.tiers[bike.tier], bike.x);
  const liftsAtCrest = next && bike.vy < -2.4 && Math.abs(bike.vx) > 6.5 &&
    previousY + (bike.vy + GRAVITY * dt) * dt < next.y - .018;
  if (next && !liftsAtCrest) {
    bike.spin += (lean * 13.4 - bike.spin * 5.4 - bike.balance * 9.2) * dt;
    bike.balance += bike.spin * dt;
    bike.y = next.y - Math.abs(Math.sin(bike.balance)) * AXLE * .96;
    bike.vy = clamp((next.y - surface.y) / dt, -5.2, 7.8);
    bike.angle = next.angle + bike.balance;
    if (Math.abs(bike.balance) > 1.17) bike.status = 'crash';
  } else {
    if (bike.onGround && !liftsAtCrest) {
      const edge = course.tiers[bike.tier];
      // The approach to each lip is continuous. An outward drop starts from its actual tangent.
      bike.vy = clamp(Math.tan(surface?.angle || 0) * bike.vx, -5.2, 7.8);
      if ((bike.x - edge.end) * edge.direction < 0) bike.vy = Math.max(0, bike.vy);
    }
    bike.onGround = false;
    bike.vy = Math.min(22, bike.vy + GRAVITY * dt);
    bike.y += bike.vy * dt;
    bike.spin = clamp((bike.spin + lean * 12.4 * dt) * Math.exp(-1.7 * dt), -4.4, 4.4);
    bike.angle = wrap(bike.angle + bike.spin * dt);
    for (let i = 0; i < course.tiers.length; i++) {
      const tier = course.tiers[i], landing = contact(tier, bike.x);
      if (!landing || bike.vy < 0 || bike.y < landing.y) continue;
      const before = contact(tier, previousX);
      if (previousY > (before?.y ?? landing.y) + .045) continue;
      if (Math.abs(wrap(bike.angle - landing.angle)) > 1.16) {
        bike.status = 'crash';
      } else {
        bike.y = landing.y;
        bike.vy = 0;
        bike.angle = landing.angle;
        bike.spin *= .35;
        bike.balance = 0;
        bike.tier = i;
        bike.onGround = true;
      }
      break;
    }
  }
  if (bike.y > course.bottom) bike.status = 'crash';
  if (bike.status === 'ride' && bike.onGround && bike.tier === course.tiers.length - 1 &&
      (bike.x - course.finish) * course.tiers.at(-1).direction >= 0) bike.status = 'finish';
}
