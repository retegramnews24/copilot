// X-Moto Classic neutral anchors, scaled from a 1.4-unit wheelbase to 1.72.
// Canvas uses a downward Y axis. Hands and feet stay on the frame during weight shifts.
const scale = 1.72 / 1.4;
const anchor = (x, y) => [x * scale, (-y - (.9 - .35)) * scale];
const hipRest = anchor(-.3, .4), shoulderRest = anchor(-.2, 1.1);
const hand = anchor(.3, .45), elbowRest = anchor(-.1, .6);
const foot = anchor(0, -.37), kneeRest = anchor(.3, .2);
export const SUSPENSION = {rear: anchor(-.11, -.3), front: anchor(.4, .4)};
export const HEAD_RADIUS = .18 * scale;
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const arm = [length(shoulderRest, elbowRest), length(elbowRest, hand)];
const leg = [length(hipRest, kneeRest), length(kneeRest, foot)];

function torso(lean) {
  const tilt = lean * .39, sin = Math.sin(tilt), cos = Math.cos(tilt);
  const hip = [hipRest[0] + lean * .13, hipRest[1] + Math.abs(lean) * .14];
  const dx = shoulderRest[0] - hipRest[0], dy = shoulderRest[1] - hipRest[1];
  const x = dx * cos - dy * sin, y = dx * sin + dy * cos;
  return {hip, shoulder: [hip[0] + x, hip[1] + y],
    head: [hip[0] + x * (1 + .22 / Math.hypot(.1, .7)), hip[1] + y * (1 + .22 / Math.hypot(.1, .7))]};
}

export function helmetPosition(lean) {
  return torso(lean).head;
}

function bend(a, b, [first, second], side) {
  const dx = b[0] - a[0], dy = b[1] - a[1], distance = Math.hypot(dx, dy);
  const along = Math.min(distance, (distance ** 2 + first ** 2 - second ** 2) / (2 * distance));
  const offset = Math.sqrt(Math.max(0, first ** 2 - along ** 2)) * side;
  return [a[0] + (dx * along - dy * offset) / distance, a[1] + (dy * along + dx * offset) / distance];
}

export function riderPose(lean) {
  const body = torso(lean);
  return {...body, hand, foot, elbow: bend(body.shoulder, hand, arm, 1), knee: bend(body.hip, foot, leg, -1)};
}
