// Zona Operativa: braccia e arma in prima persona (blender/zona_armi.blend → models/armi.glb).
// Il modello ha lo scheletro «braccia» con l'osso «arma»: l'arma si attacca lì, e le azioni tiene_/spara_/ricarica_
// di ogni arma mettono a posto arma e mani. Si disegna in una scena a parte, sopra il resto (niente braccia nei muri).
import * as THREE from 'three';

export const WEAPON_NAMES = ['baretta', 'calabrone', 'tuono', 'ruggito', 'falco', 'coltello'];

// punto di mira di ogni arma (tacca, mirino o lente del punto rosso), nelle coordinate dell'arma come MUZZLE
// (misurati in blender/zona_armi.blend): mirando va al centro della vista. Baretta: altezza dei tre puntini;
// Calabrone: centro dell'anello della diottra (e cima del mirino a palo); Tuono: centro della perlina in punta
const SIGHT = {
  baretta: [0, 0.0868, 0],
  calabrone: [0, 0.0935, 0],
  tuono: [0, 0.0605, 0.3],
  ruggito: [0, 0.108, 0.05],
  falco: [0, 0.13, 0.15]
};
const sight = new THREE.Vector3();
// finestrella del mirino a punto rosso del Ruggito (coordinate dell'arma): mirando, lì dentro si vede ingrandito
const LENS = { ruggito: { x: 0.0135, y0: 0.0965, y1: 0.1195, z: 0.0105 } };
const corner = new THREE.Vector3();
// la canna senza mirare punta al mirino a questa distanza (metri davanti agli occhi)
const HIP_CONVERGE = 15;

// bocca della canna nelle coordinate dell'arma (da Blender: x, z, -y)

const MUZZLE = {
  baretta: [0, 0.063, 0.183],
  calabrone: [0, 0.036, 0.34],
  tuono: [0, 0.04, 0.745],
  ruggito: [0, 0.046, 0.615],
  falco: [0, 0.035, 1.005]
};

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,250,220,1)');
  r.addColorStop(0.3, 'rgba(255,190,80,0.9)');
  r.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createViewmodel(gltf, aspect, team = 'blu') {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x404048, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(0.5, 1, 0.3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(60, aspect, 0.01, 10);
  const hfov = THREE.MathUtils.degToRad(75); // come la camera «occhio» di Blender
  const setAspect = a => {
    camera.aspect = a;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / a));
    camera.fov = Math.min(camera.fov, 80);
    camera.updateProjectionMatrix();
  };
  setAspect(aspect);

  // modelli delle armi da mettere nel mondo (bancone, a terra): copie prese prima di attaccarle all'osso
  const worldModels = {};
  for (const n of [...WEAPON_NAMES, 'cassa_medica']) {
    const o = gltf.scene.getObjectByName(n);
    if (o) worldModels[n] = o.clone(true);
  }

  const holder = new THREE.Group(); // segue la camera; dentro, il modello ruotato (in Blender guarda verso -y)
  scene.add(holder);
  const rig = gltf.scene.getObjectByName('braccia');
  const pivot = new THREE.Group();
  // In Blender lo scheletro guarda verso -y con la mano destra a +x, cioè a sinistra di chi guarda: qui si specchia
  // avanti/indietro (z → -z), così guarda verso -z con la destra a destra.
  pivot.scale.z = -1;
  pivot.add(rig);
  holder.add(pivot);
  rig.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;
      if (o.name.startsWith('braccia_')) o.visible = o.name === 'braccia_' + team;
    }
  });
  holder.updateMatrixWorld(true);
  const bone = rig.getObjectByName('arma');
  const rigInv = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const boneRel = new THREE.Matrix4().multiplyMatrices(rigInv, bone.matrixWorld);
  const headRel = new THREE.Vector3().setFromMatrixPosition(boneRel);
  // in posa di riposo l'arma sta nella testa dell'osso con gli assi dello scheletro: offset = osso⁻¹ · arma
  const offset = new THREE.Matrix4()
    .copy(boneRel)
    .invert()
    .multiply(new THREE.Matrix4().makeTranslation(headRel.x, headRel.y, headRel.z));

  const tex = flashTexture();
  const guns = {};
  for (const n of WEAPON_NAMES) {
    const g = gltf.scene.getObjectByName(n);
    if (!g) continue;
    g.removeFromParent();
    offset.decompose(g.position, g.quaternion, g.scale);
    g.visible = false;
    g.traverse(o => o.isMesh && (o.frustumCulled = false));
    bone.add(g);
    if (MUZZLE[n]) {
      const f = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true
        })
      );
      f.position.set(...MUZZLE[n]);
      f.scale.setScalar(n === 'falco' || n === 'tuono' ? 0.32 : 0.2);
      f.visible = false;
      g.add(f);
      g.userData.flash = f;
    }
    guns[n] = g;
  }

  const mixer = new THREE.AnimationMixer(rig);
  const clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
  let current = null;
  let idle = null;
  let flashT = 0;
  let base = null;
  let lastAim = 0;

  // Raddrizzare l'arma: nella posa fatta in Blender la canna non punta dritta verso il centro. Per ogni arma si
  // misura una volta (posa «tiene_», arma ferma) dove punta la canna, e si tengono due rotazioni dell'arma in mano:
  // mirando la canna sta dritta lungo lo sguardo (così tacca e mirino sono in fila con il centro); senza mirare la
  // canna punta al mirino, HIP_CONVERGE metri più avanti.
  const straight = {};
  function measure(n) {
    const m = MUZZLE[n];
    if (!m || !guns[n]) return null;
    const pos = holder.position.clone();
    const quat = holder.quaternion.clone();
    holder.position.set(0, 0, 0);
    holder.quaternion.identity();
    mixer.update(0);
    holder.updateMatrixWorld(true);
    const back = guns[n].localToWorld(new THREE.Vector3(m[0], m[1], m[2] - 0.3));
    const tip = guns[n].localToWorld(new THREE.Vector3(...m));
    const dir = tip.clone().sub(back).normalize();
    const want = new THREE.Vector3(0, 0, -HIP_CONVERGE).sub(tip).normalize();
    holder.position.copy(pos);
    holder.quaternion.copy(quat);
    return {
      hip: new THREE.Quaternion().setFromUnitVectors(dir, want),
      aim: new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, 0, -1))
    };
  }

  function playIdle(fade = 0.15) {
    const a = mixer.clipAction(clips['tiene_' + current]);
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.reset().fadeIn(fade).play();
    if (idle && idle !== a) idle.fadeOut(fade);
    idle = a;
  }
  function once(name, duration) {
    const clip = clips[name];
    if (!clip) return;
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.timeScale = duration ? clip.duration / duration : 1;
    a.reset().setEffectiveWeight(1).fadeIn(0.03).play();
    if (idle) idle.fadeOut(0.03);
    a.weight = 1;
    a.userData = { back: true };
  }
  mixer.addEventListener('finished', () => {
    if (idle) {
      idle.reset().fadeIn(0.12).play();
    }
  });

  return {
    scene,
    camera,
    worldModels,
    setAspect,
    // maniche della squadra: 'blu' o 'rossi'
    setTeam(t) {
      rig.traverse(o => {
        if (o.isMesh && o.name.startsWith('braccia_')) o.visible = o.name === 'braccia_' + t;
      });
    },
    setWeapon(name) {
      if (current === name) return;
      mixer.stopAllAction();
      idle = null;
      for (const [n, g] of Object.entries(guns)) g.visible = n === name;
      current = name;
      playIdle(0);
      if (!(name in straight)) straight[name] = measure(name);
      // l'arma entra dal basso
      holder.position.y = -0.25;
    },
    fire() {
      once('spara_' + current);
      const f = guns[current]?.userData.flash;
      if (f) {
        f.visible = true;
        f.material.rotation = Math.random() * Math.PI;
        flashT = 0.05;
      }
    },
    reload(duration) {
      once('ricarica_' + current, duration);
    },
    setVisible(v) {
      holder.visible = v;
    },
    // dt in secondi; move: velocità orizzontale (0..1) per il dondolio del passo; lookDelta: quanto si è girata la vista
    // aim (0..1): mirando l'arma si porta al centro, con le mire sulla linea dello sguardo
    update(dt, move, lookDelta, t, aim = 0) {
      mixer.update(dt);
      lastAim = aim;
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0)
          for (const g of Object.values(guns)) if (g.userData.flash) g.userData.flash.visible = false;
      }
      base = base || { x: 0, y: 0 };
      // mirando a fondo l'arma sta ferma: niente dondolio del passo né ritardo quando si gira la vista
      const bob = move * 0.012 * (1 - aim);
      let tx = Math.sin(t * 9) * bob - lookDelta.x * 0.6 * (1 - aim);
      let ty = -Math.abs(Math.cos(t * 9)) * bob - lookDelta.y * 0.6 * (1 - aim);
      const g = guns[current];
      // l'arma raddrizzata: verso il mirino senza mirare, dritta lungo lo sguardo mirando
      const s = straight[current];
      if (s) holder.quaternion.copy(s.hip).slerp(s.aim, aim);
      else holder.quaternion.identity();
      holder.updateMatrixWorld(true);
      if (aim > 0 && g && SIGHT[current]) {
        // il punto di mira (senza lo spostamento attuale) va al centro della vista
        g.localToWorld(sight.set(...SIGHT[current])).sub(holder.position);
        tx += (-sight.x - tx) * aim;
        ty += (-sight.y - ty) * aim;
      }
      holder.position.x += (tx - holder.position.x) * Math.min(1, dt * 10);
      holder.position.y += (ty - holder.position.y) * Math.min(1, dt * 8);
    },
    // mirando con un'arma che ha la lente: il rettangolo della finestrella sullo schermo, in pixel con l'origine in
    // basso a sinistra (come setScissor), altrimenti null
    lensRect(w, h) {
      const L = LENS[current];
      const g = guns[current];
      if (!L || !g || lastAim < 0.9 || !holder.visible) return null;
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
      for (const sx of [-L.x, L.x])
        for (const sy of [L.y0, L.y1]) {
          g.localToWorld(corner.set(sx, sy, L.z)).project(camera);
          x0 = Math.min(x0, corner.x);
          x1 = Math.max(x1, corner.x);
          y0 = Math.min(y0, corner.y);
          y1 = Math.max(y1, corner.y);
        }
      const x = ((x0 + 1) / 2) * w;
      const y = ((y0 + 1) / 2) * h;
      return { x, y, w: ((x1 - x0) / 2) * w, h: ((y1 - y0) / 2) * h };
    },
    muzzleWorld(target) {
      const f = guns[current]?.userData.flash;
      return f ? f.getWorldPosition(target) : null;
    }
  };
}
