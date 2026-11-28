// Cabinati della sala giochi della Lobby 3D (docs/cabinati.md): uno per gioco, dal modello di Blender
// (blender/cabinati.blend → models/cabinati.glb), con i disegni a tema di cabinet-art.js. Mette i cabinati lungo le
// pareti, gli ingombri (solid), i posti davanti (spots) e le righe e scritte animate degli schermi (demoMaterials).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { cabinetScreen, insertCoin } from './textures.js?v=0545bdbd8d';
import { marqueeArt, sideArt, panelArt, monitorArt } from './cabinet-art.js?v=e5bf87ed98';

// list: [chiave, nome, colore] dei giochi da mettere; open(chiave) apre il gioco
export function buildCabinets({ scene, list, spots, solid, groundTint, shadeMap, demoMaterials, open }) {
  // Cabinati: uno per gioco, fatti in Blender (docs/cabinati.md, blender/cabinati.blend → models/cabinati.glb). Anni '80
  // laccati neri col bordo luminoso del colore del gioco, schermo a tubo dietro un vetro. Tre modelli: 1 posto, 2 posti
  // (Pong, grande come il singolo) e 4 posti (Moto Trial, F1, Golf, largo 1,5 m); Binotto Simulator ha il muretto dei
  // box. Chi apre il gioco prende il primo posto libero e gli altri lo vedono lì, alla sua pulsantiera; dal quinto in
  // poi si guarda. Posti, ingombri e tasti si sanno subito; i pezzi arrivano quando il modello è caricato.
  const SEATS = { pong: 2, 'golf-with-your-gay-friends': 4, 'f1-on-paper': 4, 'moto-trial': 4 };
  const MURETTO = 'binotto-simulator';
  const cabWidth = n => (n >= 4 ? 1.5 : .66);
  const widthOf = key => key === MURETTO ? 1.4 : cabWidth(SEATS[key] || 1);
  const cabKit = new Promise(done => new GLTFLoader().load(new URL('models/cabinati.glb', import.meta.url).href, gltf => {
    // UV come quelle di three (v dal basso): così le tele disegnate qui e il Pong sul monitor stanno dritte
    gltf.scene.traverse(o => { const uv = o.geometry?.attributes.uv; if (uv) { for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); uv.needsUpdate = true; } });
    done(gltf.scene);
  }, undefined, () => done(null)));
  // x, z: dove sta il dietro del cabinato (contro il muro); da lì si va avanti della sua profondità dietro al centro
  const cabinet = (key, title, color, x, z, ry) => {
    const muretto = key === MURETTO;
    const back = muretto ? .34 : .48;
    x += Math.sin(ry) * back; z += Math.cos(ry) * back;
    const seats = muretto ? 1 : SEATS[key] || 1, cw = widthOf(key), half = cw / 2;
    const iw = cw / 2 - .02, g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    // un po' di luce del cabinato sul pavimento: poca, perché i cabinati vicini si sommano
    const spill = new THREE.MeshBasicMaterial({ map: shadeMap, color, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false });
    groundTint(x + Math.sin(ry) * .55, z + Math.cos(ry) * .55, cw + .2, 1.1, spill);
    // schermo, insegna, riga che scorre e «INSERT COIN»: ci sono subito (i tasti e il Pong sul monitor li usano),
    // la loro forma arriva dal modello
    const scr = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: cabinetScreen(title, color), color: new THREE.Color(1.15, 1.15, 1.15) }));
    const mq = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: marqueeArt(key, title, color, 2 * iw / (muretto ? .022 : .24)) }));
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(1, .011), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .32, depthWrite: false }));
    const coinText = new THREE.Mesh(new THREE.PlaneGeometry(1, .066), new THREE.MeshBasicMaterial({ map: insertCoin(), transparent: true, depthWrite: false, toneMapped: false }));
    sweep.visible = coinText.visible = false;
    const demo = { sweep, coinText, x, z, ax: x + .48 * Math.sin(ry), az: z + .48 * Math.cos(ry), offset: demoMaterials.length * .31, lo: 0, span: 0, ready: false };
    if (!muretto) demoMaterials.push(demo);
    cabKit.then(kit => {
      const src = kit?.getObjectByName(muretto ? 'muretto' : 'cabinato_' + seats); if (!src) return;
      const m = src.clone(true); m.position.set(0, 0, 0); g.add(m);
      const neon = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .75, roughness: .3 });
      const side = new THREE.MeshStandardMaterial({ map: sideArt(key, title, color, seats), roughness: .45 });
      m.traverse(o => {
        if (!o.isMesh) return;
        const n = o.name.replace(/_\d+$|_muretto$/, ''), mats = Array.isArray(o.material) ? o.material : [o.material];
        const swap = mt => mt.name === 'neon' ? neon : mt.name === 'fianco' ? side
          : mt.name === 'vetro' ? Object.assign(mt, { transparent: true, opacity: .14, depthWrite: false })
          // joystick e tasti: colorati, non accesi (scelta del proprietario)
          : /^(giocatore_\d|tasto_bianco)$/.test(mt.name) ? Object.assign(mt, { emissiveIntensity: .12 }) : mt;
        o.material = Array.isArray(o.material) ? mats.map(swap) : swap(o.material);
        if (n === 'pannello') o.material = new THREE.MeshStandardMaterial({ map: panelArt(key, color, seats, 2 * iw / .218), roughness: .5 });
        if (/^schermo_(tempi|meteo)$/.test(o.name)) o.material = new THREE.MeshBasicMaterial({ map: monitorArt(o.name.slice(8)) });
      });
      const take = (name, mesh) => {
        const o = m.getObjectByName(name); if (!o) return;
        mesh.geometry.dispose(); mesh.geometry = o.geometry; mesh.position.copy(o.position); mesh.quaternion.copy(o.quaternion);
        o.parent.add(mesh); o.removeFromParent();
      };
      take(muretto ? 'schermo_pista' : 'schermo_' + seats, scr);
      take(muretto ? 'insegna_muretto' : 'insegna_' + seats, mq);
      if (muretto) return;
      // riga e scritta seguono il tubo (inclinato 18° più del vetro): centro, sotto e sopra presi dalle UV del modello
      const pos = scr.geometry.attributes.position, uv = scr.geometry.attributes.uv, at = (u, v) => {
        let best = 0, d = Infinity;
        for (let i = 0; i < uv.count; i++) { const e = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2; if (e < d) { d = e; best = i; } }
        return new THREE.Vector3().fromBufferAttribute(pos, best);
      };
      const c0 = at(.5, .5), bottom = at(.5, 0), top = at(.5, 1), left = at(0, .5), right = at(1, .5);
      const tube = new THREE.Object3D(); tube.position.copy(c0);
      // assi del tubo: y in su (dal basso all'alto), x verso destra, z fuori
      const ay = top.clone().sub(bottom).normalize(), ax = right.clone().sub(left).normalize(), az = ax.clone().cross(ay).normalize();
      tube.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, az));
      scr.add(tube);
      const tw = right.distanceTo(left), th = top.distanceTo(bottom);
      sweep.scale.x = tw * .9; coinText.scale.x = Math.min(tw * .9, .42);
      coinText.position.set(0, -th * .38, .002); sweep.position.z = .004;
      tube.add(sweep, coinText);
      demo.lo = -th * .45; demo.span = th * .9; demo.ready = true; sweep.visible = true; coinText.visible = true;
    });
    // pulsantiere: joystick e due tasti per posto, come nel modello (cabinati_build.py)
    const gap = 2 * iw / seats, handles = [];
    for (let k = 0; k < seats; k++) {
      const ox = -iw + gap * (k + .5), jx = ox - .33 * Math.min(gap, .5) * .5;
      handles.push(muretto ? [[-.1, 1.03], [.1, 1.03]] : [[jx, 1.12], [ox + .07, 1.05]]);
    }
    const depth = muretto ? .38 : .47;
    const along = Math.abs(Math.sin(ry)) > 0.5;
    if (along) solid(x - depth, x + depth, z - half - .03, z + half + .03); else solid(x - half - .03, x + half + .03, z - depth, z + depth);
    const front = muretto ? .6 : .7;
    const fx = x + Math.sin(ry) * front, fz = z + Math.cos(ry) * front;
    spots.push({ x: fx, z: fz, hx: along ? 0.2 : Math.max(.2, half - .15), hz: along ? Math.max(.2, half - .15) : 0.2, pad: 0.6, label: title + (seats > 1 ? ' (' + seats + ' posti)' : ''), where: 'Sala giochi', station:key,seats,gap,handles,yaw:ry,pong:key==='pong',screen:scr,sweep,act: () => open(key), mq });
  };
  // lungo le pareti, rivolti verso il centro della sala: a nord i tre a 4 posti, a sud gli altri
  const byKey = new Map(list.map(e => [e[0], e]));
  const northKeys = ['moto-trial', 'f1-on-paper', 'golf-with-your-gay-friends'].filter(k => byKey.has(k));
  // a sud, dall'angolo verso l'atrio: prima i giochi da 1, poi Pong da 2, in fondo il muretto (scelta del proprietario)
  const southKeys = [...list.map(e => e[0]).filter(k => !['moto-trial', 'f1-on-paper', 'golf-with-your-gay-friends', 'pong', MURETTO].includes(k)), 'pong', MURETTO].filter(k => byKey.has(k));
  const row = (keys, zz, ry, from, limit) => {
    let xx = from;
    const rest = [];
    for (const k of keys) {
      const w = widthOf(k);
      if (xx - w < limit) { rest.push(k); continue; }
      const [kk, tt, cc] = byKey.get(k);
      cabinet(kk, tt, cc, xx - w / 2, zz, ry);
      xx -= w + 0.25; // vicini, ma con lo spazio per vedere i fianchi disegnati (scelta del proprietario)
    }
    return rest;
  };
  // si parte dall'angolo verso l'atrio (parete a x -7)
  // tutti con il dietro a 10 cm dal muro (le pareti finiscono a z ±6 e x -19), come flipper e slot
  const WALL_GAP = .1;
  const left = [...row(northKeys, -6 + WALL_GAP, 0, -7.2, -15.3), ...row(southKeys, 6 - WALL_GAP, Math.PI, -7.2, -18.6)];
  left.forEach((k, i) => { const [kk, tt, cc] = byKey.get(k); cabinet(kk, tt, cc, -19 + WALL_GAP, -2.2 + i * 1.1, Math.PI / 2); });
}
