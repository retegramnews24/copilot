// Lobby 3D: il personaggio (lo stesso del Labyrinth: maglia e pantaloncini scelti in Settings) e la sua camminata.
import * as THREE from 'three';

export const SPEED = 3.1;

export function makeCharacter(look) {
  const root = new THREE.Group();
  const ball = new THREE.SphereGeometry(1, 20, 14);
  const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const skin = mat('#dc9f88', 0.65), shirt = mat(look.shirt, 0.8), shorts = mat(look.shorts, 0.8);
  // maglia e pantaloncini si ricolorano se li cambi in Settings
  shirt.userData.part = 'shirt'; shorts.userData.part = 'shorts';
  const hairM = mat('#3a2a1e', 0.9), shoeM = mat('#232b28', 0.6), soleM = mat('#a5a189', 0.8), white = mat('#f5f1e4', 0.4), dark = mat('#1b1512', 0.3);
  const blob = (parent, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(ball, m); o.position.set(x, y, z); o.scale.set(rx, ry, rz); parent.add(o); return o; };
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.119, 0.66, 0); root.add(hip);
    blob(hip, shorts, 0, -0.15, 0.008, 0.115, 0.19, 0.135);
    blob(hip, skin, 0, -0.42, 0, 0.068, 0.25, 0.075);
    blob(hip, shoeM, 0, -0.62, -0.06, 0.085, 0.062, 0.16);
    blob(hip, soleM, 0, -0.655, -0.06, 0.088, 0.02, 0.165);
    blob(hip, white, 0, -0.52, -0.01, 0.072, 0.03, 0.08); // calzino
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(s * 0.27, 1.22, 0); root.add(sh);
    blob(sh, shirt, 0, -0.09, 0, 0.088, 0.14, 0.088);
    blob(sh, skin, 0, -0.33, 0, 0.056, 0.2, 0.058);
    blob(sh, skin, 0, -0.55, -0.01, 0.055, 0.07, 0.048);
    arms.push(sh);
  }
  blob(root, shorts, 0, 0.66, 0.01, 0.22, 0.11, 0.135);
  blob(root, shirt, 0, 0.9, 0.008, 0.24, 0.3, 0.15);
  blob(root, shirt, 0, 1.12, 0, 0.235, 0.15, 0.143);
  blob(root, skin, 0, 1.27, 0, 0.07, 0.08, 0.07);
  const brows = [], eyes = [];
  const head = new THREE.Group(); head.position.y = 1.47; root.add(head);
  blob(head, skin, 0, 0, 0, 0.165, 0.195, 0.155);
  for (const s of [-1, 1]) {
    blob(head, skin, s * 0.16, -0.01, 0.01, 0.028, 0.055, 0.026); // orecchie
    eyes.push(blob(head, white, s * 0.059, 0.02, -0.14, 0.032, 0.025, 0.014));
    eyes.push(blob(head, dark, s * 0.059, 0.02, -0.152, 0.015, 0.016, 0.006));
    brows.push(blob(head, hairM, s * 0.062, 0.08, -0.142, 0.032, 0.008, 0.008)); // sopracciglia
  }
  blob(head, skin, 0, -0.04, -0.155, 0.024, 0.034, 0.03); // naso
  const mouth = blob(head, mat('#7b3939', 0.5), 0, -0.1, -0.135, 0.045, 0.01, 0.012); // bocca
  blob(head, hairM, 0, 0.065, 0.02, 0.178, 0.16, 0.168);
  blob(head, hairM, -0.04, 0.17, -0.1, 0.07, 0.035, 0.04); // ciuffo
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, legs, arms, head, eyes, brows, mouth, expressionEnd: 0, phase: 0 };
}
export function animateCharacter(c, speed, dt, t) {
  const amt = Math.min(1, speed / SPEED);
  c.phase += dt * (4 + 6 * speed / SPEED);
  const sw = Math.sin(c.phase) * 0.65 * amt;
  c.legs[0].rotation.x = sw; c.legs[1].rotation.x = -sw;
  c.arms[0].rotation.x = -sw * 0.8; c.arms[1].rotation.x = sw * 0.8;
  c.arms[0].rotation.z = -0.06; c.arms[1].rotation.z = 0.06;
  // fermo: respira e si guarda un po' intorno
  c.root.position.y = Math.abs(Math.cos(c.phase)) * 0.035 * amt + (1 - amt) * Math.sin(t * 2) * 0.004;
  const remaining = Math.max(0, c.expressionEnd - t);
  const envelope = Math.min(1, remaining * 4, Math.max(0, (1.2 - remaining) * 7));
  const laugh = c.expression === 'laugh';
  const pulse = laugh ? .68 + .32 * Math.cos(remaining * 24) : 1;
  c.mouth.scale.set(.045 + envelope * (laugh ? .028 : -.019), .01 + envelope * pulse * .034, .012 + envelope * .012);
  for (const brow of c.brows) brow.position.y = .08 + envelope * (laugh ? .008 : .034);
  for (const eye of c.eyes) eye.scale.y = (eye.material === c.eyes[0].material ? .025 : .016) * (1 + envelope * (laugh ? -.7 : .4));
  c.head.rotation.x = envelope * (laugh ? -.09 * pulse : -.12);
  c.head.rotation.y = (1 - amt) * Math.sin(t * 0.6) * 0.25;
}

