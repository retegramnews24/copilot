export const nodes = [
  ...Array.from({ length: 7 }, (_, i) => ({ x: i * 3 - 9, y: 0, fixed: i === 0 || i === 6 })),
  ...[-6, -3, 0, 3, 6].map((x) => ({ x, y: -2.5 })),
  ...[-6, -3, 0, 3, 6].map((x) => ({ x, y: 2.5 })),
  { x: -9, y: -2.5, fixed: true }, { x: 9, y: -2.5, fixed: true },
  { x: -9, y: 2.5, fixed: true }, { x: 9, y: 2.5, fixed: true },
];

export function member(a, b, type) {
  if (!nodes[a] || !nodes[b] || a === b) return null;
  const rest = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
  if (rest > (type === 'rope' ? 10 : 4.4)) return null;
  return { a, b, type, rest, deck: type === 'beam' && a < 7 && b < 7 };
}

export function makeTrial(links) {
  const members = links.map((link) => ({ ...link, load: 0, broken: false }));
  const connected = new Set(members.flatMap(({ a, b }) => [a, b]));
  const joints = nodes.map((node, i) => ({ ...node, vx: 0, vy: 0, active: connected.has(i) }));
  const deck = Array.from({ length: 6 }, (_, i) => members.find((edge) =>
    edge.deck && Math.min(edge.a, edge.b) === i && Math.max(edge.a, edge.b) === i + 1));
  return { members, joints, deck, time: 0, position: 0, result: null };
}

export function advance(trial, dt) {
  if (trial.result) return;
  trial.time += dt;
  trial.position = Math.max(0, (trial.time - 0.7) * 0.78);
  const index = Math.min(5, Math.floor(trial.position));
  const fraction = Math.min(1, trial.position - index);
  const loaded = trial.time >= 0.7;
  if (loaded && (!trial.deck[index] || trial.deck[index].broken)) {
    trial.result = 'gap';
    return;
  }

  const forces = trial.joints.map(() => ({ x: 0, y: -2.4 }));
  if (loaded) {
    forces[index].y -= 19 * (1 - fraction);
    forces[index + 1].y -= 19 * fraction;
  }
  for (const edge of trial.members) {
    if (edge.broken) continue;
    const a = trial.joints[edge.a], b = trial.joints[edge.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.max(0.0001, Math.hypot(dx, dy));
    const rope = edge.type === 'rope';
    const stretch = length - edge.rest * (rope ? 1.025 : 1);
    const velocity = ((b.vx - a.vx) * dx + (b.vy - a.vy) * dy) / length;
    const tension = rope ? Math.max(0, stretch > 0 ? stretch * 195 + velocity * 5 : 0)
      : stretch * 300 + velocity * 6;
    const capacity = rope ? 55 : tension < 0 ? 73 / (edge.rest / 3) : 110;
    edge.load = tension / capacity;
    if (Math.abs(edge.load) > 1) {
      edge.broken = true;
      continue;
    }
    const fx = tension * dx / length, fy = tension * dy / length;
    forces[edge.a].x += fx;
    forces[edge.a].y += fy;
    forces[edge.b].x -= fx;
    forces[edge.b].y -= fy;
  }
  for (const [i, joint] of trial.joints.entries()) {
    if (joint.fixed || !joint.active) continue;
    joint.vx = (joint.vx + forces[i].x * dt) * Math.exp(-2 * dt);
    joint.vy = (joint.vy + forces[i].y * dt) * Math.exp(-2 * dt);
    joint.x += joint.vx * dt;
    joint.y += joint.vy * dt;
  }
  if (loaded && (trial.deck[index].broken || trial.joints[index].y < -1.8 || trial.joints[index + 1].y < -1.8)) {
    trial.result = 'collapse';
  } else if (trial.position >= 6) {
    trial.result = 'success';
  }
}

export const road = () => Array.from({ length: 6 }, (_, i) => member(i, i + 1, 'beam'));
export function example() {
  return [...road(),
    ...[[0,7],[7,8],[8,9],[9,10],[10,11],[11,6],
      [7,1],[7,2],[8,2],[8,3],[9,3],[9,4],[10,4],[10,5],[11,5],[11,4]]
      .map(([a,b]) => member(a,b,'beam'))];
}
