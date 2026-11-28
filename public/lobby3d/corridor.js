// Corridoio della «Zona operativa»: dalla sala giochi (porta blindata sulla parete nord, accanto al quadro
// «INSERT COIN») un tunnel di cemento di 12 m verso nord, nello spazio vuoto dietro la sala giochi. Camminando i neon
// dietro di te si spengono uno dopo l'altro; in fondo la Lobby 3D si spegne davvero e parte il gioco (lobby3d.js,
// app.js). Tornando dal gioco i neon si riaccendono dal fondo verso la porta.
import * as THREE from 'three';
import { canvasTex, neonText } from './textures.js?v=0545bdbd8d';

export const ZONE = {
  x: -15.95, // centro della porta e del corridoio
  door: 0.6, // mezza larghezza del vano della porta
  doorH: 2.3,
  half: 0.8, // mezza larghezza del corridoio (dentro)
  z0: -6.3, // inizio (dietro la parete della sala giochi)
  z1: -18.3, // fondo
  end: -17.2 // qui la Lobby si spegne
};
export const inZone = (x, z) => z < -6.15 && x < -7.3;

// helpers dalla Lobby 3D: scene, box, plane, wallX, wallZ, solid (collisione), H (altezza delle stanze)
export function buildCorridor({ scene, box, plane, wallX, wallZ, colliders, H, sound }) {
  const { x, door, doorH, half, z0, z1 } = ZONE;
  // cemento a casseri: pannelli con i fori dei tiranti e qualche macchia
  const concrete = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6b6a66';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 80 + Math.random() * 50;
      g.fillStyle = `rgba(${v},${v},${v - 4},${0.15 + Math.random() * 0.2})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(40,38,34,${0.05 + Math.random() * 0.08})`;
      g.beginPath();
      g.ellipse(
        Math.random() * w,
        Math.random() * h,
        20 + Math.random() * 60,
        30 + Math.random() * 90,
        0,
        0,
        7
      );
      g.fill();
    }
    g.strokeStyle = 'rgba(30,30,28,.55)';
    g.lineWidth = 3;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.fillStyle = 'rgba(25,25,24,.8)';
    for (const px of [0.25, 0.75])
      for (const py of [0.25, 0.75]) {
        g.beginPath();
        g.arc(px * w, py * h, 7, 0, 7);
        g.fill();
      }
  });
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  const wallTex = concrete.clone();
  wallTex.repeat.set(8, 2.3);
  wallTex.needsUpdate = true;
  const floorTex = concrete.clone();
  floorTex.repeat.set(1.2, 8);
  floorTex.needsUpdate = true;
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
  const floorM = new THREE.MeshStandardMaterial({ map: floorTex, color: '#8a8780', roughness: 0.8 });
  const len = z0 - z1;
  // pareti, fondo, pavimento e soffitto (alto come le sale: la telecamera dietro il personaggio ci sta)
  wallZ(z1 - 0.15, z0, x - half - 0.15, wall);
  wallZ(z1 - 0.15, z0, x + half + 0.15, wall);
  wallX(x - half - 0.3, x + half + 0.3, z1 - 0.15, wall);
  plane(half * 2, len, floorM, x, 0.002, (z0 + z1) / 2, 0, -Math.PI / 2);
  plane(
    half * 2,
    len,
    new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 1 }),
    x,
    H - 0.001,
    (z0 + z1) / 2,
    0,
    Math.PI / 2
  );
  // tubi e canalina portacavi lungo il soffitto
  const pipeM = new THREE.MeshStandardMaterial({ color: '#4d5257', roughness: 0.5, metalness: 0.6 });
  const rustM = new THREE.MeshStandardMaterial({ color: '#7a4a2c', roughness: 0.7, metalness: 0.3 });
  for (const [px, py, r, m] of [
    [x - half + 0.12, H - 0.28, 0.07, pipeM],
    [x - half + 0.3, H - 0.22, 0.045, rustM],
    [x + half - 0.1, H - 0.35, 0.05, pipeM]
  ]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m);
    p.rotation.x = Math.PI / 2;
    p.position.set(px, py, (z0 + z1) / 2);
    scene.add(p);
  }
  box(0.3, 0.05, len, pipeM, x + half - 0.25, H - 0.12, (z0 + z1) / 2);
  // striscia gialla e nera a terra lungo le pareti
  const hazard = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#e8b81e';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#16140f';
    for (let i = -2; i < 18; i++) {
      g.beginPath();
      g.moveTo(i * 32, h);
      g.lineTo(i * 32 + 16, h);
      g.lineTo(i * 32 + 48, 0);
      g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
  });
  hazard.wrapS = THREE.RepeatWrapping;
  const sideStrip = hazard.clone();
  sideStrip.repeat.set(len / 1.6, 1);
  sideStrip.needsUpdate = true;
  const stripM = new THREE.MeshStandardMaterial({ map: sideStrip, roughness: 0.7 });
  for (const s of [-1, 1])
    plane(0.12, len, stripM, x + s * (half - 0.06), 0.004, (z0 + z1) / 2, 0, -Math.PI / 2);

  // neon industriali: uno ogni 2 m; quelli che hai alle spalle si spengono
  const on = new THREE.MeshBasicMaterial({ color: new THREE.Color('#dff3ff').multiplyScalar(1.6) });
  const off = new THREE.MeshStandardMaterial({ color: '#3a3f45', roughness: 0.4 });
  const housing = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.6, metalness: 0.5 });
  const tubes = [];
  for (let z = z0 - 1; z > z1 + 0.5; z -= 2) {
    box(0.16, 0.05, 1.3, housing, x, H - 0.04, z);
    tubes.push({ z, lit: true, mesh: box(0.07, 0.05, 1.2, on, x, H - 0.09, z) });
  }
  // una sola luce vera, che sta sul neon acceso davanti a te (pesa poco anche sul telefono)
  const light = new THREE.PointLight('#d8ecff', 5, 7, 1.5);
  light.position.set(x, H - 0.4, z0 - 2);
  scene.add(light);
  // lampada rossa sopra il portellone in fondo
  const red = new THREE.PointLight('#ff3a2e', 2.2, 4, 1.5);
  red.position.set(x, 2.6, z1 + 0.6);
  scene.add(red);

  // portellone chiuso in fondo, con la scritta a stampino
  const hatch = canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#3c4146';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#23272b';
    g.lineWidth = 12;
    g.strokeRect(20, 20, w - 40, h - 40);
    g.fillStyle = '#5a6066';
    for (let i = 0; i < 2; i++) g.fillRect(70, 150 + i * 280, w - 140, 18);
    g.fillStyle = '#16181a';
    for (let px = 46; px < w; px += 105)
      for (const py of [46, h - 46]) {
        g.beginPath();
        g.arc(px, py, 9, 0, 7);
        g.fill();
      }
    g.fillStyle = '#d9d2c0';
    g.textAlign = 'center';
    g.font = '900 64px "Arial Black", Arial, sans-serif';
    g.fillText('ZONA', w / 2, 290);
    g.fillText('OPERATIVA', w / 2, 370);
    g.font = 'bold 26px monospace';
    g.fillText('ACCESSO · AREA 01', w / 2, 420);
  });
  plane(
    half * 2 - 0.2,
    2.2,
    new THREE.MeshStandardMaterial({ map: hatch, roughness: 0.55, metalness: 0.4 }),
    x,
    1.1,
    z1 + 0.005
  );
  box(
    0.4,
    0.06,
    0.06,
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a2e').multiplyScalar(2) }),
    x,
    2.42,
    z1 + 0.05
  );

  // porta blindata: lastra d'acciaio con bulloni e la fascia di pericolo, scorre verso ovest dentro il muro
  const slabTex = canvasTex(512, 960, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#2c3136');
    grad.addColorStop(0.5, '#3d4349');
    grad.addColorStop(1, '#2a2f34');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1b1e21';
    g.lineWidth = 6;
    for (const y of [300, 620]) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = '#16191c';
    for (let px = 34; px < w; px += 74)
      for (const py of [30, 280, 320, 600, 640, h - 150]) {
        g.beginPath();
        g.arc(px, py, 8, 0, 7);
        g.fill();
      }
    g.fillStyle = '#e8b81e';
    g.fillRect(0, h - 120, w, 120);
    g.fillStyle = '#16140f';
    for (let i = -4; i < 20; i++) {
      g.beginPath();
      g.moveTo(i * 60, h);
      g.lineTo(i * 60 + 30, h);
      g.lineTo(i * 60 + 150, h - 120);
      g.lineTo(i * 60 + 120, h - 120);
      g.fill();
    }
    g.fillStyle = '#c9c2b0';
    g.font = 'bold 34px monospace';
    g.textAlign = 'center';
    g.fillText('ZO-01', w / 2, 470);
  });
  const slabM = new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.45, metalness: 0.65 });
  const slab = box(door * 2 + 0.1, doorH + 0.04, 0.08, slabM, x, (doorH + 0.04) / 2, -6.38);
  // telaio d'acciaio dal lato della sala giochi, con la luce rossa sopra e l'insegna
  const frameM = new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.4, metalness: 0.7 });
  for (const s of [-1, 1])
    box(0.14, doorH + 0.14, 0.36, frameM, x + s * (door + 0.07), (doorH + 0.14) / 2, -6.15);
  box(door * 2 + 0.28, 0.14, 0.36, frameM, x, doorH + 0.07, -6.15);
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1e').multiplyScalar(2.2) });
  box(door * 2, 0.05, 0.05, lampM, x, doorH + 0.19, -5.96);
  const sign = plane(
    1.9,
    0.48,
    new THREE.MeshBasicMaterial({
      map: neonText('ZONA OPERATIVA', '#ff3b30', 1024, 256, 'bold 92px "Arial Black", Arial, sans-serif'),
      transparent: true,
      depthWrite: false,
      color: new THREE.Color(2, 2, 2)
    }),
    x,
    2.86,
    -5.97
  );
  sign.renderOrder = 2;
  // la porta chiusa blocca il passaggio (si toglie quando è aperta abbastanza)
  const block = { x0: x - door, x1: x + door, z0: -6.42, z1: -6.0 };
  colliders.push(block);

  let open = 0,
    lastDir = -1,
    wakeAt = -1,
    lastTube = -1;
  return {
    // pos: il personaggio; t: secondi da quando è partita la 3D
    update(pos, dt, t) {
      // la porta si apre avvicinandosi (dai due lati), si richiude quando sei lontano
      const near = Math.abs(pos.x - x) < 1.6 && pos.z < -3.9 && pos.z > -8.6;
      open = THREE.MathUtils.clamp(open + (near ? dt * 2.2 : -dt * 1.4), 0, 1);
      const eased = open * open * (3 - 2 * open);
      slab.position.x = x - eased * (door * 2 + 0.15);
      const passable = open > 0.85;
      block.x0 = passable ? 1e5 : x - door;
      block.x1 = passable ? 1e5 : x + door;
      const dir = near ? 1 : -1;
      if (dir !== lastDir) {
        lastDir = dir;
        sound?.('door');
      }
      // neon: spenti quelli alle spalle (più a sud di te di oltre 1,2 m); al ritorno si riaccendono dal fondo
      const inside = inZone(pos.x, pos.z);
      let ahead = null;
      tubes.forEach((tube, i) => {
        let lit = !inside || tube.z < pos.z + 1.2;
        if (wakeAt >= 0) lit = t - wakeAt > 0.25 + (tube.z - z1) * 0.12;
        if (lit !== tube.lit) {
          tube.lit = lit;
          tube.mesh.material = lit ? on : off;
          if (!lit && inside && i !== lastTube) {
            lastTube = i;
            sound?.('click');
          }
        }
        if (lit && tube.z < pos.z + 0.5 && (!ahead || tube.z > ahead.z)) ahead = tube;
      });
      if (wakeAt >= 0 && t - wakeAt > 0.25 + (z0 - z1) * 0.12) wakeAt = -1;
      const goal = ahead ? ahead.z : pos.z - 1;
      light.position.z += (goal - light.position.z) * Math.min(1, dt * 4);
      light.intensity = ahead ? 5 : 1.2;
      // quanto manca alla fine (0 alla porta, 1 in fondo): per il nero che sale
      return inside ? THREE.MathUtils.clamp((z0 - 1 - pos.z) / (z0 - 1 - ZONE.end), 0, 1) : 0;
    },
    // di ritorno dal gioco: tutto spento, poi i neon si riaccendono dal fondo verso la porta
    wake(t) {
      wakeAt = t;
      for (const tube of tubes) {
        tube.lit = false;
        tube.mesh.material = off;
      }
    }
  };
}
