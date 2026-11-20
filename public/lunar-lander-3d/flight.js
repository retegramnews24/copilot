export const degrees = (radians) => Math.abs(radians * 180 / Math.PI);
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function newFlight(mission) {
  const { x, y, vx, vy, fuel } = mission;
  return { x, y, vx, vy, fuel, angle: 0, throttle: 0, result: null };
}

export function safeSpeed(flight, mission) {
  return Math.abs(flight.vy) < mission.down &&
    Math.abs(flight.vx) < mission.sideways && degrees(flight.angle) < mission.tilt;
}

export function altitude(flight, mission, ground) {
  const floor = Math.abs(flight.x - mission.padX) < mission.pad + 0.9 ? 0.18 : ground(flight.x, 0);
  return flight.y - floor;
}

export function step(flight, controls, dt, ground, mission) {
  flight.throttle = clamp(flight.throttle + controls.power * dt * 0.95, 0, 1);
  // Releasing the rotation controls lets the attitude controller level the cabin.
  const target = controls.turn * 0.65;
  flight.angle += clamp(target - flight.angle, -1.4 * dt, 1.4 * dt);
  const burn = Math.min(flight.fuel, flight.throttle * 4.2 * dt);
  const thrust = burn / (4.2 * dt) * 5.1;
  flight.fuel -= burn;
  flight.vx += Math.sin(flight.angle) * thrust * dt;
  flight.vy += (Math.cos(flight.angle) * thrust - 1.62) * dt;
  flight.x += flight.vx * dt;
  flight.y += flight.vy * dt;
  const clearance = altitude(flight, mission, ground);
  if (clearance <= 0) {
    flight.y -= clearance;
    const onPad = Math.abs(flight.x - mission.padX) <= mission.pad;
    flight.result = onPad && safeSpeed(flight, mission) ? 'landed' : 'crashed';
  } else if (Math.abs(flight.x - mission.padX) > 205 || flight.y > 210) {
    flight.result = 'lost';
  }
}
