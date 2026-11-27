// Zona Operativa: i soldati degli altri giocatori in terza persona (blender/zona_soldato.blend → models/soldati.glb).
// Li usano la partita sul deserto (online.js) e il poligono condiviso (zona.js). Gambe: fermo, cammina, corre,
// accucciato, cade; busto sopra: spara, colpito. Il petto si piega per la mira; l'arma segue la mano destra e lo
// sguardo; il nome sta sopra la testa. Colori pari Blu, dispari Rossi.
import * as THREE from 'three';

export const ARMI = ['baretta', 'calabrone', 'tuono', 'ruggito', 'falco', 'coltello'];
export const COLORS = [
  '#4aa3ff',
  '#ff5a4a',
  '#e8b81e',
  '#5fd17a',
  '#c77dff',
  '#ff9f43',
  '#4dd6d0',
  '#f2f2f2'
];
const UPPER = [
  'schiena',
  'petto',
  'collo',
  'testa',
  'spallaL',
  'braccioL',
  'avambraccioL',
  'manoL',
  'spallaR',
  'braccioR',
  'avambraccioR',
  'manoR'
];

function cloneSkinned(src) {
  const c = src.clone(true);
  const bones = {};
  c.traverse(o => o.isBone && (bones[o.name] = o));
  c.traverse(o => {
    if (o.isSkinnedMesh) {
      o.bind(
        new THREE.Skeleton(
          o.skeleton.bones.map(b => bones[b.name]),
          o.skeleton.boneInverses
        ),
        o.bindMatrix
      );
      o.frustumCulled = false;
    }
  });
  return c;
}

function nameSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 30px system-ui,sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,.7)';
  g.strokeText(text, 128, 42);
  g.fillStyle = color;
  g.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.4, 0.35, 1);
  s.position.y = 2.15;
  return s;
}

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,245,200,1)');
  r.addColorStop(1, 'rgba(255,140,30,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// soldati: il gltf di soldati.glb; worldModels: le armi da tenere in mano (viewmodel.js)
export function createSoldiers(scene, soldati, worldModels) {
  // GLTFLoader rinomina le ossa doppie (petto_1…): si tolgono i numeri, così le azioni valgono per tutti e due
  const clean = n => n.replace(/_\d+$/, '');
  soldati.scene.traverse(o => (o.name = clean(o.name)));
  const clips = {};
  for (const c of soldati.animations) {
    for (const t of c.tracks) t.name = t.name.replace(/_\d+(?=\.)/, '');
    clips[c.name] = c;
    // per spara, ricarica e colpito solo il busto: le gambe continuano a camminare
    if (['spara', 'ricarica', 'colpito'].includes(c.name))
      clips[c.name + '_busto'] = new THREE.AnimationClip(
        c.name + '_busto',
        c.duration,
        c.tracks.filter(t => UPPER.includes(t.name.split('.')[0]))
      );
  }
  const rigs = {
    blu: soldati.scene.getObjectByName('scheletro_blu'),
    rossi: soldati.scene.getObjectByName('scheletro_rossi')
  };
  const flashTex = flashTexture();
  const all = new Map(); // id -> soldato
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const axis = new THREE.Vector3();

  function soldierFor(p, name) {
    let s = all.get(p.id);
    if (s) return s;
    const team = p.color % 2 ? 'rossi' : 'blu';
    const root = new THREE.Group();
    const model = cloneSkinned(rigs[team]);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    root.add(model);
    model.traverse(o => o.isSkinnedMesh && (o.visible = o.name.startsWith('soldato_' + team)));
    const mixer = new THREE.AnimationMixer(model);
    s = {
      root,
      model,
      mixer,
      act: n => mixer.clipAction(clips[n]),
      base: null,
      petto: model.getObjectByName('petto'),
      hand: model.getObjectByName('manoR'),
      guns: {},
      gun: null,
      flashT: 0,
      last: null,
      speed: 0,
      label: nameSprite(name || 'Giocatore', COLORS[p.color % COLORS.length])
    };
    root.add(s.label);
    scene.add(root);
    all.set(p.id, s);
    return s;
  }
  function setBase(s, name, timeScale = 1) {
    const a = s.act(name);
    a.timeScale = timeScale;
    if (s.base === a) return;
    a.reset();
    if (name === 'cade') {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    } else a.setLoop(THREE.LoopRepeat, Infinity);
    a.fadeIn(0.15).play();
    s.base?.fadeOut(0.15);
    s.base = a;
  }
  function upperOnce(s, name) {
    const a = s.act(name + '_busto');
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = false;
    a.reset().setEffectiveWeight(1.4).play();
  }
  function gunFor(s, weapon) {
    if (s.gun?.userData.weapon === weapon) return;
    if (s.gun) s.gun.visible = false;
    if (!s.guns[weapon] && worldModels[weapon]) {
      const g = worldModels[weapon].clone(true);
      g.userData.weapon = weapon;
      const f = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flashTex,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true
        })
      );
      f.position.set(
        0,
        0.05,
        weapon === 'falco' ? 1.0 : weapon === 'tuono' || weapon === 'ruggito' ? 0.7 : 0.35
      );
      f.scale.setScalar(0.4);
      f.visible = false;
      g.add(f);
      g.userData.flash = f;
      s.root.add(g);
      s.guns[weapon] = g;
    }
    s.gun = s.guns[weapon] || null;
    if (s.gun) s.gun.visible = true;
  }
  function updateSoldier(s, p, dt) {
    s.root.position.set(p.x, p.y, p.z);
    s.root.rotation.y = p.yaw + Math.PI; // il modello guarda verso +z, la vista con yaw 0 verso -z
    const moved = s.last ? Math.hypot(p.x - s.last.x, p.z - s.last.z) / Math.max(dt, 1e-3) : 0;
    s.speed += (Math.min(8, moved) - s.speed) * Math.min(1, dt * 8);
    s.last = { x: p.x, z: p.z };
    if (p.dead) setBase(s, 'cade');
    else if (p.crouch) setBase(s, 'accucciato');
    else if (s.speed < 0.6) setBase(s, 'fermo');
    else if (s.speed < 3.6) setBase(s, 'cammina', s.speed / 2.6);
    else setBase(s, 'corre', s.speed / 5.2);
    s.label.visible = !p.dead;
    s.mixer.update(dt);
    // mira in alto e in basso: si piega il petto attorno all'asse destra del soldato
    if (!p.dead && s.petto) {
      s.root.updateMatrixWorld(true);
      axis.set(-1, 0, 0).applyQuaternion(s.root.quaternion);
      s.petto.parent.getWorldQuaternion(tmpQ);
      axis.applyQuaternion(tmpQ.invert());
      s.petto.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, p.pitch * 0.8));
    }
    gunFor(s, ARMI[p.weapon] || 'baretta');
    if (s.gun) {
      s.gun.visible = !p.dead;
      s.model.updateMatrixWorld(true);
      s.hand.getWorldPosition(tmpV);
      s.root.worldToLocal(tmpV);
      s.gun.position.copy(tmpV);
      s.gun.rotation.set(-p.pitch, 0, 0);
      if (s.flashT > 0 && (s.flashT -= dt) <= 0) s.gun.userData.flash.visible = false;
    }
  }

  return {
    all,
    get: id => all.get(id),
    // list: giocatori da disegnare (da net.others); names: id -> nome
    update(list, dt, names) {
      for (const p of list) updateSoldier(soldierFor(p, names.get(p.id)), p, dt);
    },
    // via chi non c'è più (ids: quelli ancora presenti)
    prune(ids) {
      for (const [id, s] of all)
        if (!ids.has(id)) {
          scene.remove(s.root);
          all.delete(id);
        }
    },
    // ha sparato: busto che rincula e fiammata; ritorna la distanza dalla camera (per il volume)
    shot(id, weapon, from) {
      const s = all.get(id);
      if (!s) return null;
      upperOnce(s, 'spara');
      if (s.gun?.userData.flash && weapon !== 'coltello') {
        s.gun.userData.flash.visible = true;
        s.flashT = 0.06;
      }
      return s.root.position.distanceTo(from);
    },
    hit(id) {
      const s = all.get(id);
      if (s) upperOnce(s, 'colpito');
    }
  };
}
