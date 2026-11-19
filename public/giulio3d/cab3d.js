// Giuliosim 3D cab: a regional EMU driver's cab in the style of Japanese rural railcars (original design).
// Local frame of the rig: x right, y up, -z forward; rail level y = 0, cab floor y = 0.96, eye at (-0.6, 2.3, -0.55).
// Driver's side on the left: instrument hood with speedometer and double pressure gauge, pilot lamps, clock,
// next-stop display; brake handle on the left, traction handle on the right (like the on-screen levers);
// timetable holder in the middle of the desk, roller sun blinds, wipers, driver's seat, ceiling lights.
import * as THREE from '../vendor/three/three.module.min.js';

const START = 8 * 3600 + 17 * 60; // 08:17:00, as in Giulio Simulator
const hhmmss = s => {
  const t = START + Math.max(0, Math.floor(s));
  return [Math.floor(t / 3600) % 24, Math.floor(t / 60) % 60, t % 60].map(v => String(v).padStart(2, '0')).join(':');
};

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, g, c };
}
// Dial face: ticks every minor step, numbers every major step, over an arc of 270°.
function dialFace({ max, major, minor, label, red = [], size = 512 }) {
  return canvasTexture(size, size, (g, w) => {
    const c = w / 2,
      r = w * 0.46;
    g.fillStyle = '#1a1f1d';
    g.beginPath();
    g.arc(c, c, w / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f3f0e6';
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.fill();
    const ang = v => Math.PI * 0.75 + (v / max) * Math.PI * 1.5;
    for (const [from, to, color] of red) {
      g.strokeStyle = color;
      g.lineWidth = w * 0.03;
      g.beginPath();
      g.arc(c, c, r * 0.9, ang(from), ang(to));
      g.stroke();
    }
    g.strokeStyle = '#1c1c1c';
    g.fillStyle = '#1c1c1c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `bold ${Math.round(w * 0.075)}px sans-serif`;
    for (let v = 0; v <= max + 1e-6; v += minor) {
      const a = ang(v),
        isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
      g.lineWidth = isMajor ? w * 0.012 : w * 0.005;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r * (isMajor ? 0.78 : 0.84), c + Math.sin(a) * r * (isMajor ? 0.78 : 0.84));
      g.lineTo(c + Math.cos(a) * r * 0.94, c + Math.sin(a) * r * 0.94);
      g.stroke();
      if (isMajor) g.fillText(String(Math.round(v * 10) / 10), c + Math.cos(a) * r * 0.62, c + Math.sin(a) * r * 0.62);
    }
    g.font = `${Math.round(w * 0.06)}px sans-serif`;
    g.fillText(label, c, c + r * 0.5);
  });
}
function textPanel(w, h, draw) {
  const t = canvasTexture(w, h, draw);
  return { ...t, mat: new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false }) };
}

export function buildCab({ stops }) {
  const rig = new THREE.Group();
  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    rig.add(mesh);
    return mesh;
  };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
  const wall = M('#d9d6cb', { roughness: 0.85 }), // light cream interior panels
    trim = M('#3a4340'),
    dark = M('#1f2523', { roughness: 0.6 }),
    deskTop = M('#55605b', { roughness: 0.55 }),
    metal = M('#9aa19c', { metalness: 0.7, roughness: 0.35 });

  // Floor: ribbed rubber.
  const floorTex = canvasTexture(64, 64, (g, w) => {
    g.fillStyle = '#2c3330';
    g.fillRect(0, 0, w, w);
    g.fillStyle = '#3a423e';
    for (let y = 0; y < w; y += 8) g.fillRect(0, y, w, 3);
  }).tex;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(6, 8);
  box(2.7, 0.06, 3.5, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }), 0, 0.93, 0.15);
  // Ceiling with two light strips and an air vent.
  box(2.7, 0.06, 3.5, wall, 0, 3.44, 0.15);
  const lightMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff4dc', emissiveIntensity: 0.6 });
  for (const x of [-0.5, 0.5]) box(0.18, 0.02, 2.4, lightMat, x, 3.4, 0.2);
  box(0.9, 0.03, 0.25, dark, 0, 3.4, -1.2);
  // Back wall with the door to the passenger area and its window.
  box(2.7, 2.5, 0.06, wall, 0, 2.2, 1.9);
  box(0.84, 2.0, 0.04, M('#b9b4a6'), 0.3, 1.96, 1.86);
  box(0.5, 0.45, 0.02, new THREE.MeshStandardMaterial({ color: '#7b9aa3', roughness: 0.2, metalness: 0.3 }), 0.3, 2.45, 1.84);
  box(0.06, 0.16, 0.05, metal, 0.6, 1.95, 1.82);
  // Front and side walls below/above the windows, pillars with trim.
  box(2.7, 0.98, 0.06, wall, 0, 1.45, -1.86);
  box(2.7, 0.46, 0.06, wall, 0, 3.21, -1.86);
  for (const x of [-1.31, 1.31]) {
    box(0.06, 0.98, 3.5, wall, x, 1.45, 0.15);
    box(0.06, 0.46, 3.5, wall, x, 3.21, 0.15);
    box(0.14, 1.06, 0.16, trim, x * 0.98, 2.46, -1.8);
    box(0.06, 1.06, 0.22, trim, x, 2.46, 0.25);
  }
  box(0.12, 1.06, 0.12, trim, 0, 2.46, -1.84);
  // Window rubber seals.
  for (const [x, w] of [[-0.66, 1.2], [0.66, 1.2]]) {
    box(w, 0.04, 0.05, dark, x, 1.95, -1.84);
    box(w, 0.04, 0.05, dark, x, 2.97, -1.84);
  }
  // Windscreen glass: very light tint, slightly reflective.
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe3e6', transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.9, depthWrite: false });
  for (const x of [-0.66, 0.66]) box(1.18, 1.0, 0.01, glass, x, 2.46, -1.87);
  // Roller sun blinds, half down, in front of the upper windscreen.
  const blind = M('#7d6f55', { transparent: true, opacity: 0.88, roughness: 0.95 });
  box(1.1, 0.3, 0.01, blind, -0.66, 2.83, -1.8);
  box(1.1, 0.12, 0.01, blind, 0.66, 2.91, -1.8);
  for (const x of [-0.66, 0.66]) box(1.16, 0.05, 0.05, metal, x, 2.99, -1.79);
  // Wipers outside the glass, parked low.
  for (const x of [-0.9, 0.42]) {
    const arm = box(0.62, 0.025, 0.02, dark, x + 0.25, 2.0, -1.9);
    arm.rotation.z = 0.12;
  }

  // Desk: top, front fascia, edge trim; instrument hood on the driver's side.
  box(2.6, 0.06, 0.74, deskTop, 0, 1.8, -1.48);
  box(2.6, 0.84, 0.06, M('#3f4844'), 0, 1.38, -1.12);
  box(2.6, 0.03, 0.04, metal, 0, 1.83, -1.12);
  const hood = new THREE.Group();
  hood.position.set(-0.62, 1.98, -1.58);
  hood.rotation.x = -0.75;
  rig.add(hood);
  const hoodBoard = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.5, 0.04), dark);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.04, 0.16), dark);
  visor.position.set(0, 0.27, 0.06);
  hood.add(hoodBoard, visor);
  // Gauges on the hood: speedometer (red over 100) and brake gauge (pipe / cylinders).
  const gaugeLight = new THREE.PointLight('#fff1cc', 0.25, 1.2);
  gaugeLight.position.set(0, 0.2, 0.25);
  hood.add(gaugeLight);
  function gauge(face, x, r) {
    const g = new THREE.Group();
    g.position.set(x, 0.02, 0.03);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.08, 8, 32), metal);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ map: face.tex, toneMapped: false }));
    plate.position.z = 0.002;
    g.add(rim, plate);
    hood.add(g);
    const needle = (color, len) => {
      const n = new THREE.Mesh(new THREE.BoxGeometry(r * 0.05, len, 0.004).translate(0, len / 2 - r * 0.08, 0), new THREE.MeshBasicMaterial({ color }));
      n.position.z = 0.01;
      g.add(n);
      return n;
    };
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.08, 16), dark);
    cap.position.z = 0.014;
    g.add(cap);
    return needle;
  }
  const speedFace = dialFace({ max: 120, major: 20, minor: 5, label: 'km/h', red: [[100, 120, '#c0392b']] });
  const pressFace = dialFace({ max: 10, major: 2, minor: 0.5, label: 'kgf/cm²·bar', red: [] });
  const speedNeedleMesh = gauge(speedFace, -0.3, 0.17)('#d8452f', 0.15);
  const pressureGauge = gauge(pressFace, 0.12, 0.12);
  const pipeNeedle = pressureGauge('#1c1c1c', 0.105),
    cylNeedle = pressureGauge('#d8452f', 0.1);
  // Pilot lamps with labels: doors closed, brake, EB, sand.
  const lampLabels = textPanel(256, 48, (g, w, h) => {
    g.fillStyle = '#1f2523';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e6da';
    g.font = 'bold 20px sans-serif';
    g.textAlign = 'center';
    ['PORTE', 'FRENO', 'EB', 'SABBIA'].forEach((t, i) => g.fillText(t, 32 + i * 64, 30));
  });
  const labelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.064), lampLabels.mat);
  labelPlate.position.set(0.36, -0.16, 0.025);
  hood.add(labelPlate);
  const lamps = ['#3ddc84', '#ffb347', '#ff4b3a', '#f2f2f2'].map((color, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#333', emissive: color, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), mat);
    lamp.position.set(0.36 - 0.1275 + i * 0.085, -0.1, 0.025);
    hood.add(lamp);
    return mat;
  });
  // Clock and next-stop display (canvas textures redrawn when their text changes).
  const clock = textPanel(256, 72, () => {});
  const clockPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.056), clock.mat);
  clockPlate.position.set(0.38, 0.16, 0.025);
  hood.add(clockPlate);
  const display = textPanel(512, 200, () => {});
  const displayPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.117), display.mat);
  displayPlate.position.set(0.38, 0.03, 0.025);
  hood.add(displayPlate);
  // Timetable holder in the middle of the desk.
  const table = textPanel(400, 520, (g, w, h) => {
    g.fillStyle = '#f4efe1';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#20302b';
    g.font = 'bold 30px sans-serif';
    g.fillText('Regionale 01', 24, 48);
    g.font = '20px sans-serif';
    g.fillText('Linea dei Due Laghi', 24, 78);
    g.strokeStyle = '#20302b';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(20, 92);
    g.lineTo(w - 20, 92);
    g.stroke();
    g.font = '22px monospace';
    stops.forEach((s, i) => {
      g.fillText(hhmmss(s.time).slice(0, 5), 24, 130 + i * 44);
      g.fillText(s.name.slice(0, 18), 112, 130 + i * 44);
    });
  });
  const holder = new THREE.Group();
  holder.position.set(0.32, 1.86, -1.5);
  holder.rotation.x = -1.05;
  rig.add(holder);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.012), M('#5b4632'));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.3), new THREE.MeshStandardMaterial({ map: table.tex, roughness: 0.9 }));
  sheet.position.z = 0.008;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), metal);
  clip.position.set(0, 0.16, 0.012);
  holder.add(board, sheet, clip);
  // Handles: brake on the left of the driver, traction on the right, each on a notched quadrant.
  function handle(x, color) {
    const base = box(0.16, 0.06, 0.24, dark, x, 1.86, -1.36);
    const quadrant = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24, 1, false, -Math.PI / 2, Math.PI), metal);
    quadrant.rotation.z = Math.PI / 2;
    quadrant.position.set(x, 1.9, -1.36);
    rig.add(quadrant);
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.9, -1.36);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.26, 10), metal);
    stick.position.y = 0.13;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    grip.rotation.z = Math.PI / 2;
    grip.position.y = 0.27;
    pivot.add(stick, grip);
    rig.add(pivot);
    void base;
    return pivot;
  }
  const brakeHandle = handle(-1.12, '#e0902f'),
    tractionHandle = handle(-0.05, '#4f9d48');
  // EB reset button and horn pedal-like button on the desk.
  box(0.05, 0.02, 0.05, M('#c0392b', { emissive: '#400' }), -0.9, 1.84, -1.2);
  // Driver's seat behind the eye point (seen when looking back).
  const seat = M('#2f4260', { roughness: 0.95 });
  box(0.5, 0.1, 0.5, seat, -0.6, 1.45, 0.05);
  box(0.5, 0.62, 0.1, seat, -0.6, 1.84, 0.33);
  box(0.3, 0.2, 0.09, seat, -0.6, 2.28, 0.34);
  box(0.06, 0.5, 0.06, metal, -0.6, 1.17, 0.05);
  // Lights: a soft cab light and the gauge light.
  const cabLight = new THREE.PointLight('#fff2d8', 0.5, 4.5);
  cabLight.position.set(0, 3.3, 0);
  rig.add(cabLight);

  const eye = new THREE.Object3D();
  eye.position.set(-0.6, 2.3, -0.55);
  rig.add(eye);

  let lastClock = '',
    lastDisplay = '';
  function draw(panel, lines, colors) {
    const { g, c, tex } = panel;
    g.fillStyle = '#0b1512';
    g.fillRect(0, 0, c.width, c.height);
    lines.forEach((line, i) => {
      g.fillStyle = colors[i] || '#7fe0c2';
      g.font = line.font;
      g.fillText(line.text, 14, line.y);
    });
    tex.needsUpdate = true;
  }
  return {
    rig,
    eye,
    setLights(on) {
      cabLight.intensity = on ? 0.5 : 0;
      gaugeLight.intensity = on ? 0.25 : 0;
      lightMat.emissiveIntensity = on ? 0.6 : 0.05;
    },
    update(train, info) {
      // Needle angle: the dial face is drawn clockwise from 135° (0) to 405° (max); the needle mesh points up.
      const kmh = Math.abs(train.v) * 3.6,
        a = f => -1.25 * Math.PI - f * 1.5 * Math.PI + Math.PI / 2;
      speedNeedleMesh.rotation.z = a(Math.min(1, kmh / 120)) - Math.PI / 2;
      pipeNeedle.rotation.z = a(Math.min(1, (train.pipe * 1.0) / 10)) - Math.PI / 2;
      cylNeedle.rotation.z = a(Math.min(1, ((train.front + train.rear) * 1.8) / 10)) - Math.PI / 2;
      brakeHandle.rotation.x = (((train.emergency ? 5 : train.brake) / 5) * 2 - 1) * 0.6;
      tractionHandle.rotation.x = -((train.traction / 4) * 2 - 1) * 0.6;
      lamps[0].emissiveIntensity = train.doors ? 0 : 2.2;
      lamps[1].emissiveIntensity = train.brake || train.emergency ? 2.2 : 0;
      lamps[2].emissiveIntensity = train.emergency ? 2.6 : 0;
      lamps[3].emissiveIntensity = train.sand > 0 ? 2.2 : 0;
      const time = hhmmss(train.elapsed);
      if (time !== lastClock) {
        lastClock = time;
        draw(clock, [{ text: time, font: 'bold 50px monospace', y: 54 }], ['#ff8a3d']);
      }
      const text = info.name + '|' + info.detail;
      if (text !== lastDisplay) {
        lastDisplay = text;
        draw(
          display,
          [
            { text: 'PROSSIMA', font: 'bold 30px sans-serif', y: 42 },
            { text: info.name, font: 'bold 54px sans-serif', y: 110 },
            { text: info.detail, font: '34px monospace', y: 170 }
          ],
          ['#7fe0c2', '#ffffff', '#ffd166']
        );
      }
    }
  };
}
