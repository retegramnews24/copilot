export const SPRING_HEIGHT = .37;
const GRAVITY = 13;
const CONTACT_TIME = .18;
const MAX_LAUNCH_SPEED = 10.8;

export function springAt(world, player) {
  return world.nets?.find(net => Math.abs(player.x - net.x) < net.halfWidth - .10 &&
    Math.abs(player.z - net.z) < net.halfDepth - .10);
}

export function resetJump(state, height = 0) {
  Object.assign(state, {height, velocity: 0, pumping: false, contact: null});
}

export function jumpFromSpring(state) {
  if (state.contact || state.velocity !== 0 || Math.abs(state.height - SPRING_HEIGHT) > .001) return false;
  state.pumping = true;
  state.velocity = 4.1;
  return true;
}

// At impact the net absorbs momentum, then returns it after a short compression.
export function advanceSpring(state, dt, net, player, stop) {
  dt = Math.max(0, Math.min(.1, dt));
  const surface = net ? SPRING_HEIGHT : 0;
  if (!net || stop) state.pumping = false;
  if (!net && state.contact) resetJump(state, state.height);

  if (!state.contact) {
    if (state.velocity === 0 && state.height <= surface) {
      state.height = surface;
      return;
    }
    const next = state.height + state.velocity * dt - .5 * GRAVITY * dt * dt;
    if (next > surface) {
      state.height = next;
      state.velocity -= GRAVITY * dt;
      return;
    }
    const incoming = Math.sqrt(Math.max(0, state.velocity ** 2 + 2 * GRAVITY * (state.height - surface)));
    const flight = Math.max(0, (state.velocity + incoming) / GRAVITY);
    dt = Math.max(0, dt - flight);
    state.height = surface;
    state.velocity = 0;
    if (!net || !state.pumping) return 'land';
    const edge = Math.min(net.halfWidth - Math.abs(player.x - net.x), net.halfDepth - Math.abs(player.z - net.z));
    const support = Math.max(.25, Math.min(1, edge / 1.5));
    state.contact = {time: 0, depth: Math.min(.29, incoming * .028) * support,
      launch: Math.min(MAX_LAUNCH_SPEED, incoming * (.88 + .09 * support) + 1.22 * support)};
  }

  const contact = state.contact;
  contact.time += dt;
  if (contact.time < CONTACT_TIME) {
    state.height = SPRING_HEIGHT - contact.depth * Math.sin(Math.PI * contact.time / CONTACT_TIME);
    return;
  }
  state.contact = null;
  state.height = SPRING_HEIGHT;
  if (!state.pumping) return 'land';
  state.velocity = contact.launch;
  const remainder = contact.time - CONTACT_TIME;
  state.height += state.velocity * remainder - .5 * GRAVITY * remainder ** 2;
  state.velocity -= GRAVITY * remainder;
  return 'bounce';
}

export function netDeflection(net, player, scene) {
  let dip = [0, 0, 0];
  for (const position of [scene.spring && {...player, height: SPRING_HEIGHT - scene.spring},
    ...(scene.players || []).map(p => p.player)]) {
    if (!position || !Number.isFinite(position.height) || position.height < .075 ||
        Math.abs(position.x - net.x) >= net.halfWidth - .10 || Math.abs(position.z - net.z) >= net.halfDepth - .10) continue;
    const depth = SPRING_HEIGHT - position.height;
    if (depth > dip[2]) dip = [position.x, position.z, depth];
  }
  return dip;
}
