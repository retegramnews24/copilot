// Lobby 3D: un "guscio" facoltativo della Lobby. Si cammina con il proprio personaggio tra
// l'atrio (la lavagna apre Settings, il cartellone apre Giochi), la sala biliardo (vicino a un tavolo "Apri" apre
// il Biliardo, con i tavoli veri del gioco) e la sala arcade (ogni cabinato apre il suo gioco).
// Non rifà nessuna schermata: chiede all'app di aprire quelle che ci sono già, e intanto il mondo 3D si ferma.
import {buildFlipper, FLIPPER_AT, GT_AT} from './flipper3d.js?v=a7281ff79e';
import {buildBalilla} from './balilla.js?v=d09a655c05';
import {playBalillaSound} from './balilla-sounds.js?v=b6a48f4677';
import {helpFor, helpList} from './help.js?v=d35882a376';
import {soundAllowed} from '../sound-pref.js';
import {isTouchDevice} from '../touch-device.js';
import * as THREE from 'three';
import {BOARD_WIDTH,BOARD_HEIGHT,CHALKS,ERASER,DEFAULT_SIZE} from '../blackboard/chalk.js?v=4027e504f0';
import {embedYouTube} from '../cinema/youtube.js?v=c237aa9fc5';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from '../vendor/three/addons/utils/BufferGeometryUtils.js';
import { Table3D, CLOTHS } from '../biliardo/scene3d.js?v=5022d34425';
import * as E from '../biliardo/engine.js?v=5d4ddc53d2';
import { readAppearance, readLook } from '../appearance.js?v=784dba932c';
import { canvasTex, neonText, parquet, wallFinish, tiles, neonGrid, blackboard, gamesPoster, cabinetScreen, nameTag, blobTex } from './textures.js?v=6d79d0e827';
import { makeCharacter, animateCharacter, actCharacter, setLook, SPEED, ARM_LEN, EYE_Y } from './character.js?v=a5078a2ed5';
import { gameTitle } from '../game-info.js?v=637e9e8793';
import { roundBoxGeometry } from './shapes.js?v=acaec08552';
import { SCARABEO_LAYOUT, buildScarabeoTable } from './table-scarabeo.js?v=ea7100a3a8';
import { CARD_LAYOUTS, cardParts, buildCardTable } from './table-cards.js?v=e5eb1ca41c';
import { NAVALE_LAYOUT, buildNavaleTable } from './table-navale.js?v=d3cd66386e';
import { CHESS_LAYOUT, DAMA_LAYOUT, buildChessTable, buildDamaTable } from './table-scacchi.js?v=7ecc7d5df1';
import { createTableLive } from './table-live.js?v=df2df46159';
import { createVending, makeHeld, vendingSounds, SNACKS, DRINKS } from './vending.js?v=226700b87f';
import { createPopcorn, makeHeldPopcorn, makeHeldCola } from './popcorn.js?v=476f889a23';
import { drawCinemaSign } from './cinema-sign.js?v=3984411176';
import { buildCorridor, inZone, ZONE } from './corridor.js?v=0fb346722b';

const H = 3.4; // altezza delle stanze
// sala cinema più lunga e più alta delle altre: parete dello schermo a z 20,55, tetto a 5,5 m. Si entra in piano
// dalla Lobby e le file scendono verso lo schermo: la prima fila e il fondo sala sono 60 cm più in basso
// (CINEMA_DROP). Schermo 7 × 3,94 m con il bordo basso a 1,3 m dal pavimento davanti, sopra le poltrone
const CINEMA_H = 5.5, CINEMA_END = 20.55, CINEMA_DROP = 0.6;
const SCREEN_W = 7, SCREEN_H = 3.9375, SCREEN_Y = -CINEMA_DROP + 1.3 + SCREEN_H / 2;
const DOOR = 1.3, DOOR_H = 2.5; // mezza larghezza e altezza delle porte
const R = 0.3; // ingombro del personaggio
// cabinati della sala arcade: chiave del gioco nel catalogo (games-catalog.js), nome, colore
const ARCADE = [
  ['pong', 'Pong', '#5bc0be'],
  ['moto-trial', 'Moto Trial', '#e07b39'],
  ['acquedotto', 'Acquedotto!', '#2f8fd8'],
  ['lunar-lander-3d', 'Lunar Lander 3D', '#9aa7ff'],
  ['number-connect', 'Number Connect', '#f0a202'],
  ['f1-on-paper', 'F1 on paper!', '#1fae5f'],
  ['golf-with-your-gay-friends', 'Golf', '#4caf50'],
  ['giulio-simulator', 'Giulio Simulator', '#3a7bd5'],
  ['binotto-simulator', 'Binotto Simulator', '#ffd236'],
];

const BOARD = [
  ['checkmate','Checkmate!'], ['dama-italiana','Dama italiana'], ['forza-4','Forza 4'],
  ['uno','UNO'], ['scarabeo','Scarabeo'], ['scopa','Scopa'],
  ['battaglia-navale','Battaglia navale'], ['briscola','Briscola'], ['briscola-in-cinque','Briscola in cinque']
];

const CSS = `
.l3d{position:fixed;inset:0;z-index:60;background:#0b0810;color:#fff;font:15px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
.l3d[hidden]{display:none}
.l3d-gl,.l3d-gl canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.l3d-top{position:absolute;left:calc(var(--ui-safe-left,0px) + 10px);right:calc(var(--ui-safe-right,0px) + 10px);top:calc(var(--ui-safe-top,0px) + 10px);display:flex;gap:8px;align-items:center;pointer-events:none}
.l3d-top>*{pointer-events:auto;flex:none;width:auto;margin:0}
@media (max-width:520px){.l3d-top{gap:5px}.l3d-top>*{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:clamp(12px,3.3vw,14px)!important;padding:7px 9px!important}.l3d-where{padding:6px 8px!important}}
.l3d button{font:inherit;color:#fff;background:rgba(18,14,28,.72);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:9px 13px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer}
/* telefono: tutti i tasti uguali, gialli trasparenti al 50% e a pillola o tondi, il più piccoli possibile; al tocco
   diventano gialli pieni. Niente sfocatura dietro (con la scena che cambia andrebbe rifatta a ogni fotogramma) */
.l3d-touch button{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(255,200,40,.5);border:1px solid rgba(255,200,40,.75);color:#2a1600;font-weight:600;text-shadow:0 0 2px rgba(255,230,150,.8);border-radius:999px;min-width:38px;min-height:38px;width:auto;margin:0;padding:0 12px;font-size:13px;display:inline-flex;align-items:center;justify-content:center;transition:background .2s,color .2s}
.l3d-touch button[hidden]{display:none}
.l3d-touch button:active,.l3d-touch button.on{background:rgba(255,200,40,.95)!important;color:#2a1600!important;text-shadow:none}
.l3d-dock{position:absolute;left:calc(var(--ui-safe-left,0px) + 12px);bottom:calc(var(--ui-safe-bottom,0px) + 158px);display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:70vw;pointer-events:none;z-index:2}
.l3d-dock>*{pointer-events:auto}
.l3d-where{margin-left:auto;padding:7px 12px;border-radius:999px;background:rgba(18,14,28,.6);font-weight:600;font-size:14px}
.l3d-act{position:absolute;left:50%;bottom:calc(var(--ui-safe-bottom,0px) + 34px);transform:translateX(-50%);width:auto!important;max-width:90vw;margin:0;font-weight:700!important;font-size:17px!important;padding:13px 24px!important;background:linear-gradient(180deg,#ffcf4a,#f29d1c)!important;color:#2a1600!important;border:0!important;box-shadow:0 6px 24px rgba(255,180,40,.45);white-space:nowrap}
/* telefono: il tasto d'azione sta nella colonna in basso a sinistra, sopra il joystick (con volumi e sgabello),
   come gli altri tasti; in alto restano solo le informazioni */
.l3d-touch .l3d-act{position:static;order:4;transform:none;max-width:60vw;font-size:14px!important;font-weight:600!important;padding:0 14px!important;min-height:38px;background:rgba(255,200,40,.5)!important;color:#2a1600!important;border:1px solid rgba(255,200,40,.75)!important;box-shadow:none;white-space:normal;text-align:left}
.l3d-act[hidden]{display:none}
.l3d-stick{position:absolute;left:calc(var(--ui-safe-left,0px) + 26px);bottom:calc(var(--ui-safe-bottom,0px) + 26px);width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);pointer-events:none}
.l3d-stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.6)}
.l3d-stick[hidden]{display:none}
.l3d-stick.l3d-look{left:auto;right:calc(var(--ui-safe-right,0px) + 26px)}
.l3d-load[hidden]{display:none}
.l3d-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;color:#cfc6e6;pointer-events:none}
`;

// ---------- il mondo ----------
// Per lo spegnimento vero (destroy, Zona operativa): mentre la 3D si costruisce, ogni ascoltatore messo su window o
// document e ogni setInterval vengono annotati, così destroy() li toglie tutti, anche quelli dei moduli dei flipper e
// del balilla. Si annota solo durante la costruzione: lì ci sono tutte queste chiamate.
export function createLobby3D(app) {
  const life = [], every = window.setInterval;
  window.addEventListener = (type, fn, opt) => { life.push(() => window.removeEventListener(type, fn, opt)); EventTarget.prototype.addEventListener.call(window, type, fn, opt); };
  document.addEventListener = (type, fn, opt) => { life.push(() => document.removeEventListener(type, fn, opt)); EventTarget.prototype.addEventListener.call(document, type, fn, opt); };
  window.setInterval = (...args) => { const id = every(...args); life.push(() => clearInterval(id)); return id; };
  try { return buildLobby3D(app, life); }
  finally { delete window.addEventListener; delete document.addEventListener; window.setInterval = every; }
}
function buildLobby3D(app, life) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = document.createElement('div');
  el.className = 'l3d'; el.hidden = true;
  el.innerHTML = `<div class="l3d-gl"></div><div class="l3d-load">Carico la Lobby 3D…</div>
<div class="l3d-top"><button class="l3d-exit" aria-label="Torna alla Lobby classica">✕ Lobby classica</button><span class="l3d-where">Lobby</span></div>
<button class="l3d-act" hidden></button><div class="l3d-stick" hidden><i></i></div><div class="l3d-stick l3d-look" hidden><i></i></div>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const host = $('.l3d-gl'), actB = $('.l3d-act'), whereEl = $('.l3d-where'), stick = $('.l3d-stick'), knob = stick.firstChild, lookStick = $('.l3d-look'), lookKnob = lookStick.firstChild, topBar = $('.l3d-top');
  const touch = isTouchDevice();
  if (touch) el.classList.add('l3d-touch');
  // telefono: colonna dei tasti in basso a sinistra sopra il joystick (dall'alto: volumi, sgabello, seduto, azione)
  const dock = document.createElement('div'); dock.className = 'l3d-dock';
  if (touch) { el.append(dock); dock.append(actB); }
  stick.hidden = !touch;
  // nero della Zona operativa: sale in fondo al corridoio e copre lo spegnimento della Lobby
  const zoneFade = document.createElement('div');
  zoneFade.style.cssText = 'position:absolute;inset:0;z-index:4;background:#000;opacity:0;pointer-events:none;display:flex;align-items:center;justify-content:center;color:#c9c2b0;font:600 16px/1.3 ui-monospace,monospace;letter-spacing:.08em';
  el.append(zoneFade);
  let zoneArmed = true, zoneLeaving = false, destroyed = false;
  // caricamento: modelli e texture passano tutti dal gestore predefinito di three.js. Lo splash ne mostra
  // l'avanzamento; finito tutto si preparano subito le luci di ogni sala, così aprendo la Lobby non scatta
  const loading = { done: 0, total: 0, idle: false, warm: false };
  THREE.DefaultLoadingManager.onProgress = (_, done, total) => { loading.done = done; loading.total = total; loading.idle = false; };
  THREE.DefaultLoadingManager.onLoad = () => { loading.idle = true; setTimeout(() => Promise.resolve(prepareLights()).finally(() => { loading.warm = true; }), 0); };
  const dot = document.createElement('div');
  dot.style.cssText = 'position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:rgba(255,255,255,.4);box-shadow:0 0 1px rgba(0,0,0,.5);pointer-events:none;z-index:3';
  dot.hidden = touch; host.append(dot);

  // la grafica 3D può non partire (telefono vecchio, scheda grafica esclusa, memoria finita): si toglie quello che
  // è già stato aggiunto alla pagina e l'app passa alla Lobby classica (prima restava un pezzo di pagina a ogni tentativo)
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha:true, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { el.remove(); style.remove(); throw Error('grafica 3D non disponibile su questo telefono'); }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0810');
  // un filo di foschia: le sale lontane sfumano e la luce sembra più calda
  scene.fog = new THREE.FogExp2('#120c16', 0.014);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pm.dispose();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);

  const colliders = [], spots = [], wallMeshes = [], anim = [];
  const std = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const glow = (c, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
  // come box, ma con gli spigoli arrotondati (raggio r)
  const rbox = (sx, sy, sz, r, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(roundBoxGeometry(sx, sy, sz, r), m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (sx, sy, sz, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); parent.add(o); return o; };
  // Cornici dei quadri fatte in Blender (blender/cornici.blend → models/cornici.glb, stile «Circolo»): cassetta dorata,
  // ottone sottile e neon, ognuna alla misura del suo quadro. Si caricano una volta; finché non arrivano resta la
  // cornice semplice (standIn), poi la si sostituisce.
  const frameKit = new Promise((done) => new GLTFLoader().load(new URL('models/cornici.glb', import.meta.url).href, (g) => done(g.scene), undefined, () => done(null)));
  // name: cornice_panorama, _dorata, _ottone, _neon; x, y, z: centro della cornice semplice, spessa depth; angle: dove guarda
  const frameFor = (name, standIn, x, y, z, angle, depth) => frameKit.then((kit) => {
    const src = kit?.getObjectByName(name);
    if (!src) return;
    const f = src.clone();
    f.position.set(x - (depth / 2) * Math.sin(angle), y, z - (depth / 2) * Math.cos(angle));
    f.rotation.y = angle;
    f.traverse((o) => { if (o.isMesh && o.material.name === 'cf_neon') o.material = glow('#ff4fd8', 1.6); });
    scene.add(f);
    scene.remove(standIn);
  });
  const solid = (x0, x1, z0, z1) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  const plane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); scene.add(o); return o; };
  // muro lungo x (nord/sud) o lungo z (est/ovest), con la collisione
  const wallX = (x0, x1, z, m, t = 0.3) => { const o = box(x1 - x0, H, t, m, (x0 + x1) / 2, H / 2, z); wallMeshes.push(o); solid(x0, x1, z - t / 2, z + t / 2); };
  const wallZ = (z0, z1, x, m, t = 0.3) => { const o = box(t, H, z1 - z0, m, x, H / 2, (z0 + z1) / 2); wallMeshes.push(o); solid(x - t / 2, x + t / 2, z0, z1); };
  // parete tra due stanze con la porta in mezzo: due facce, una per stanza
  const doorWall = (x, mA, mB) => {
    for (const [m, off] of [[mA, -0.08], [mB, 0.08]]) {
      for (const [z0, z1] of [[-6, -DOOR], [DOOR, 6]]) { const o = box(0.16, H, z1 - z0, m, x + off, H / 2, (z0 + z1) / 2); wallMeshes.push(o); }
      wallMeshes.push(box(0.16, H - DOOR_H, DOOR * 2, m, x + off, DOOR_H + (H - DOOR_H) / 2, 0));
    }
    solid(x - 0.16, x + 0.16, -6, -DOOR); solid(x - 0.16, x + 0.16, DOOR, 6);
    const frame = std('#3b2416', 0.5);
    // stipiti e architrave arrotondati, con il filo d'ottone all'interno
    for (const z of [-DOOR, DOOR]) { rbox(0.42, DOOR_H, 0.09, 0.022, frame, x, DOOR_H / 2, z); box(0.43, DOOR_H - 0.04, 0.012, std('#b8925a', 0.35, 0.7), x, DOOR_H / 2 - 0.02, z - Math.sign(z) * 0.047); }
    rbox(0.44, 0.12, DOOR * 2 + 0.1, 0.022, frame, x, DOOR_H + 0.02, 0);
  };
  const room = (x0, x1, floorTex, rep, wallM, ceilC) => {
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(rep[0], rep[1]);
    const f = plane(x1 - x0, 12, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.05 }), (x0 + x1) / 2, 0, 0, 0, -Math.PI / 2);
    f.receiveShadow = true;
    plane(x1 - x0, 12, std(ceilC, 1), (x0 + x1) / 2, H, 0, 0, Math.PI / 2);
    const finish = new THREE.MeshStandardMaterial({ map: wallFinish(x0 === -7 ? 'atrium' : x0 > 0 ? 'pool' : 'arcade'), roughness: 0.84 });
    if(x0===-7){
      wallX(x0,-DOOR,-6.15,finish);wallX(DOOR,x1,-6.15,finish);
      // architrave della porta della sala tavoli: anche lui ferma la telecamera
      wallMeshes.push(box(2*DOOR,H-DOOR_H,.3,wallM,0,(H+DOOR_H)/2,-6.15));
    }else if(x0===-19){
      // sala giochi: la porta blindata della Zona operativa (corridor.js) accanto al quadro «INSERT COIN»
      wallX(x0,ZONE.x-ZONE.door,-6.15,finish);wallX(ZONE.x+ZONE.door,x1,-6.15,finish);
      wallMeshes.push(box(2*ZONE.door,H-ZONE.doorH,.3,wallM,ZONE.x,(H+ZONE.doorH)/2,-6.15));
    }else wallX(x0, x1, -6.15, finish);
    if(x0===-7){
      // porte della sala tavoli (nord) e del cinema (sud): stipiti e architrave arrotondati che attraversano il muro
      const jamb = std('#3b2416', 0.5);
      for (const [hw, zz] of [[DOOR, -6.15], [1.65, 6.15]]) {
        for (const sx of [-1, 1]) rbox(0.1, DOOR_H, 0.38, 0.02, jamb, sx * (hw + 0.03), DOOR_H / 2, zz);
        rbox(hw * 2 + 0.16, 0.1, 0.38, 0.02, jamb, 0, DOOR_H + 0.03, zz);
      }
    }
    if(x0===-7){wallX(-7,-1.65,6.15,finish);wallX(1.65,7,6.15,finish);wallMeshes.push(box(3.3,H-DOOR_H,.3,wallM,0,(H+DOOR_H)/2,6.15))}
    else wallX(x0,x1,6.15,finish);
    // zoccolo, boiserie, battisedia e cornice sotto il soffitto: trimWall più sotto, per tutte le stanze
  };

  // ---------- rifiniture delle pareti: stile «Circolo italiano anni '60» (docs/finiture-lobby.md) ----------
  // Lungo ogni parete, saltando le porte: zoccoletto, parte bassa (boiserie di noce, velluto nel cinema, una riga di
  // neon nella sala giochi), battisedia e cornice sotto il soffitto. I pezzi con lo stesso materiale si uniscono alla
  // fine in un solo oggetto (mergeTrim): poche cose da disegnare anche sul telefono.
  const trimGeo = new Map(), trimMeshes = new Map(), boiserie = [];
  // pannello di boiserie, rastrelliera delle stecche e applique (blender/arredi_lobby.blend → models/finiture.glb)
  const finishKit = new Promise((done) => new GLTFLoader().load(new URL('models/finiture.glb', import.meta.url).href, (g) => done(g.scene), undefined, () => done(null)));
  // un pezzo di finishKit appoggiato a una parete: x, y, z sul muro, angle dove guarda; standIn sparisce quando arriva
  const finishPiece = (name, x, y, z, angle, standIn = []) => finishKit.then((kit) => {
    const src = kit?.getObjectByName(name);
    if (!src) return;
    const o = src.clone();
    o.position.set(x, y, z);
    o.rotation.y = angle;
    o.traverse((m) => { if (m.isMesh && m.material.name === 'ap_vetro') m.material = glow('#ffd2a0', 1.28); });
    scene.add(o);
    for (const s of standIn) s.parent?.remove(s);
  });
  const trimPiece = (m, sx, sy, sz, x, y, z) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    if (!trimGeo.has(m)) trimGeo.set(m, []);
    trimGeo.get(m).push(g);
  };
  // axis 'x': parete lungo x, con la faccia verso la stanza a z = face; 'z': parete lungo z, faccia a x = face.
  // n: verso la stanza (+1 o -1). gaps: porte, come [centro, mezza larghezza].
  const trimWall = (T, axis, a, b, face, n, gaps = []) => {
    let cuts = [[a, b]];
    for (const [c, w] of gaps)
      cuts = cuts.flatMap(([s, e]) => (c + w <= s || c - w >= e ? [[s, e]] : [[s, c - w], [c + w, e]].filter(([p, q]) => q - p > 0.05)));
    // T.base: dove parte la parete (nel cinema il pavimento davanti è più in basso della Lobby)
    const base = T.base ?? 0;
    const put = (m, len, h, depth, y, at, out) =>
      axis === 'x'
        ? trimPiece(m, len, h, depth, at, y + base, face + n * out)
        : trimPiece(m, depth, h, len, face + n * out, y + base, at);
    for (const [s, e] of cuts) {
      const len = e - s, mid = (s + e) / 2, low = (T.railH - 0.14) / 2 + 0.14;
      put(T.skirt, len, 0.14, 0.035, 0.07, mid, 0.0175);
      put(T.crown, len, 0.1, 0.07, (T.top ?? H) - base - 0.05, mid, 0.035);
      if (T.neon) { put(T.neon, len, 0.035, 0.02, T.railH, mid, 0.01); continue; }
      put(T.lower, len, T.railH - 0.14, 0.02, low, mid, 0.01);
      put(T.rail, len, 0.05, 0.045, T.railH, mid, 0.0225);
      // montanti della boiserie: un riquadro ogni 0,9 m circa
      const panels = Math.max(1, Math.round(len / 0.9));
      for (let k = 0; k <= panels; k++) put(T.lower, 0.045, T.railH - 0.2, 0.03, low, s + (len * k) / panels, 0.02);
      // pannelli di Blender (boiserie_pannello) al posto di questi, quando arrivano: uno per riquadro
      if (T.wood)
        for (let k = 0; k < panels; k++)
          boiserie.push({ axis, face, n, at: s + (len * (k + 0.5)) / panels, w: len / panels, h: T.railH - 0.14, color: T.wood, flat: T.lower });
      // lucine di cortesia nello zoccolo (cinema)
      if (T.lights) for (let p = s + 0.6; p < e - 0.3; p += 1.2) put(T.lights, 0.06, 0.03, 0.012, 0.1, p, 0.04);
    }
  };

  // --- luci di base
  scene.add(new THREE.HemisphereLight('#fff4e6', '#1a1020', 0.55));
  const point = (c, i, x, y, z, d = 12) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); scene.add(l); return l; };

  // ========== ATRIO (x -7…7) ==========
  // colori dello stile «Circolo»: atrio crema, biliardo rosso pompeiano, giochi blu notte (la boiserie è in trimWall)
  const atriumWall = new THREE.MeshStandardMaterial({ color: '#e6d7bc', roughness: 0.9 });
  const billiardWall = new THREE.MeshStandardMaterial({ color: '#6e2a26', roughness: 0.85 });
  const arcadeWall = new THREE.MeshStandardMaterial({ color: '#141634', roughness: 0.85 });
  room(-7, 7, parquet(), [3.5, 3], atriumWall, '#efe6d6');
  room(7, 19, tiles(158, 19, 21), [3, 3], billiardWall, '#0b070d');
  room(-19, -7, neonGrid(), [3, 3], arcadeWall, '#07050c');
  wallZ(-6.3, 6.3, 19.15, billiardWall); wallZ(-6.3, 6.3, -19.15, arcadeWall);
  doorWall(7, atriumWall, billiardWall); doorWall(-7, arcadeWall, atriumWall);
  point('#ffe0b3',7,-3.5,2.85,0,12);point('#ffe1ba',7,3.5,2.85,0,12);point('#ffd39b',4,0,2.85,-4,9);
  // applique d'ottone a tulipano di Blender (finishPiece), mai sopra quadri o lavagna: a nord tra la cassa e la
  // lavagna e a destra del cartellone, a sud a destra dei divani, e sulla parete della sala giochi (al posto di quella
  // che cadeva sul panorama)
  for(const [x,z,angle] of [[-5.6,-6.0,0],[4.9,-6.0,0],[4.9,6.0,Math.PI],[-6.84,3.3,Math.PI/2]])finishPiece('applique',x,2.05,z,angle);
  const shadeMap = canvasTex(128,128,(g)=>{
    const shade=g.createRadialGradient(64,64,7,64,64,62);
    shade.addColorStop(0,'rgba(255,255,255,.85)');shade.addColorStop(.58,'rgba(255,255,255,.38)');shade.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=shade;g.fillRect(0,0,128,128);
  });
  const contact = new THREE.MeshBasicMaterial({map:shadeMap,color:0x211b18,transparent:true,opacity:.52,depthWrite:false});
  const groundTint = (x,z,w,d,material) => plane(w,d,material,x,.003,z,0,-Math.PI/2);
  for(const x of [-3.6,3.6])groundTint(x,5.22,3.15,1.75,contact);
  // A continuous, framed mountain landscape above the seating.
  const panorama=canvasTex(1024,256,(g,w,h)=>{
    const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#617c88');sky.addColorStop(1,'#efd09d');
    g.fillStyle=sky;g.fillRect(0,0,w,h);g.fillStyle='#f5cf90';g.beginPath();g.arc(710,76,35,0,Math.PI*2);g.fill();
    ['#939f99','#677f78','#3c5c59','#293f40'].forEach((c,i)=>{
      g.beginPath();g.moveTo(0,h);for(let x=0;x<=w;x+=8)g.lineTo(x,112+i*29+28*Math.sin(x*.011+i)+16*Math.sin(x*.027+i*4)+8*Math.cos(x*.059+i));g.lineTo(w,h);g.fillStyle=c;g.fill();
    });
  });
  frameFor('cornice_panorama',box(4.15,1.55,.07,std('#84663e',.38,.55),-4,2.12,5.94),-4,2.12,5.94,Math.PI,.07);
  plane(4.04,1.43,new THREE.MeshStandardMaterial({map:panorama,roughness:.92}),-4,2.12,5.895,Math.PI);
  // lampadari
  for (const x of [-3.5, 3.5]) {
    box(0.02, 0.5, 0.02, std('#222', 0.4, 0.8), x, H - 0.25, 0);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 0.32, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#f3e3c6', roughness: 0.8, side: THREE.DoubleSide, emissive: '#ffcf8a', emissiveIntensity: 0.5 }));
    shade.position.set(x, H - 0.62, 0); scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow('#fff2d0', 3)); bulb.position.set(x, H - 0.68, 0); scene.add(bulb);
  }
  // lavagna = Settings
  const bbX = -3.6;
  // sopra la lavagna: logo tondo di Binottoland e la scritta "Binottoland Playground" (la porta centrale resta libera)
  {
    // lo SVG non ha misure fisse: si disegna su una tela quadrata, ritagliato tondo
    const logo = canvasTex(512, 512, (g) => { g.fillStyle = '#f4ead8'; g.fillRect(0, 0, 512, 512); });
    const logoImg = new Image();
    logoImg.onload = () => {
      const g = logo.image.getContext('2d');
      g.save(); g.beginPath(); g.arc(256, 256, 256, 0, 7); g.clip();
      g.drawImage(logoImg, 0, 0, 512, 512); g.restore();
      logo.needsUpdate = true;
    };
    logoImg.src = new URL('../binottoland-avatar.svg', import.meta.url).href;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.25, 48), new THREE.MeshBasicMaterial({ map: logo, toneMapped: false }));
    disc.position.set(bbX - 1.08, 2.93, -5.965); scene.add(disc);
    const rimLogo = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.275, 48), std('#ba935e', 0.36, 0.6));
    rimLogo.position.set(bbX - 1.08, 2.93, -5.966); scene.add(rimLogo);
    plane(2.05, 0.5, new THREE.MeshBasicMaterial({ map: canvasTex(1024, 250, (g, w) => {
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = '#2b2140'; g.font = 'bold 132px "Arial Black", Arial, sans-serif'; g.fillText('BINOTTOLAND', 8, 90, w - 16);
      g.fillStyle = '#c07a2c'; g.font = 'bold 66px Arial, sans-serif'; g.fillText('P L A Y G R O U N D', 12, 200, w - 24);
    }), transparent: true }), bbX + 0.27, 2.93, -5.975);
  }
  rbox(2.7, 1.75, 0.08, 0.03, std('#5a3a22', 0.55), bbX, 1.55, -5.95);
  plane(2.5, 1.56, new THREE.MeshStandardMaterial({ map: blackboard(), roughness: 0.95 }), bbX, 1.55, -5.9);
  rbox(2.6, 0.05, 0.12, 0.015, std('#5a3a22', 0.55), bbX, 0.68, -5.86);
  for (let i = 0; i < 3; i++) box(0.07, 0.016, 0.016, std(['#f5f5f0', '#f7d36b', '#9ad0f5'][i], 0.9), bbX - 0.9 + i * 0.12, 0.712, -5.86);
  spots.push({ x: bbX, z: -5.6, hx: 1.35, hz: 0.3, pad: 1.1, label: 'Impostazioni', where: 'Lobby', act: () => app.openSettings() });
  // cartellone = Giochi
  const gpX = 3.4;
  rbox(1.5, 2.05, 0.06, 0.025, std('#3b2416', 0.5), gpX, 1.45, -5.96);
  plane(1.36, 1.92, new THREE.MeshStandardMaterial({ map: gamesPoster(), roughness: 0.7 }), gpX, 1.45, -5.92);
  spots.push({ x: gpX, z: -5.6, hx: 0.75, hz: 0.3, pad: 1.1, label: 'Tutti i giochi', where: 'Lobby', act: () => app.openGames() });
  // ---------- bacheca e avvisi (parete di sinistra dell'atrio, a sinistra della lavagna dei Settings) ----------
  // Da lontano si vedono i foglietti appuntati sul sughero: avvisi, chat, podio e top 5. Con "Apri" la vista si mette
  // davanti alla bacheca e la bacheca diventa vera: la chat e gli avvisi dell'app stanno sopra il sughero (si legge,
  // si scrive, si apre un avviso), senza finestre a parte. Esc o ✕ sulla bacheca per tornare a camminare.
  const bdX = -6.765, bdZ = -3.6, bdW = 1.62, bdH = 1.5, BW = 1024, BH = 948; // guarda verso +x (il centro dell'atrio)
  rbox(bdW + 0.1, bdH + 0.1, 0.07, 0.025, std('#5a3a22', 0.55), bdX - 0.04, 1.5, bdZ).rotation.y = Math.PI / 2;
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = BW; boardCanvas.height = BH;
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  const boardMesh = plane(bdW, bdH, new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), bdX, 1.5, bdZ, Math.PI / 2);
  spots.push({ x: bdX + 0.32, z: bdZ, hx: 0.3, hz: bdW / 2, pad: 1.1, label: 'Bacheca e avvisi', where: 'Lobby', board: true, act: () => openBoard() });
  const firstName = n => String(n || '').split(' ')[0].slice(0, 14);
  const cork = (() => {
    const c = document.createElement('canvas'); c.width = BW; c.height = BH; const g = c.getContext('2d');
    g.fillStyle = '#b98a5a'; g.fillRect(0, 0, BW, BH);
    for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (90 + Math.random() * 60 | 0) + ',' + (55 + Math.random() * 40 | 0) + ',25,' + (0.18 + Math.random() * 0.25) + ')'; g.fillRect(Math.random() * BW, Math.random() * BH, 3 + Math.random() * 5, 2 + Math.random() * 4); }
    return c;
  })();
  const PODIUM = [[1, '#c3c7cf', 0.66], [0, '#d9b44a', 1], [2, '#c98b52', 0.48]]; // 2°, 1°, 3°
  let boardKey = '', boardAt = 0;
  // disegno della bacheca vista da lontano (sughero, foglietti, podio)
  function paintBoard(force) {
    const data = app.board?.() || {};
    const notices = (app.notices?.() || (data.notices || []).slice().reverse()).slice(0, 4), chat = (data.messages || []).slice(-6), top = (data.leaderboard || []).slice(0, 5);
    const key = JSON.stringify([notices.map(n => n.id), chat.map(m => m.id || m.at), top.map(r => [r.id, r.wins])]);
    if (!force && key === boardKey) return;
    boardKey = key;
    const g = boardCanvas.getContext('2d');
    g.drawImage(cork, 0, 0);
    g.fillStyle = '#2b2140'; g.font = 'bold 60px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.fillText('Bacheca e avvisi', BW / 2, 70);
    const note = (x, y, nw, nh, color, title, tilt, body) => {
      g.save(); g.translate(x + nw / 2, y + nh / 2); g.rotate(tilt); g.translate(-nw / 2, -nh / 2);
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 6; g.fillStyle = color; g.fillRect(0, 0, nw, nh); g.shadowColor = 'transparent';
      g.fillStyle = '#d62828'; g.beginPath(); g.arc(nw / 2, 16, 11, 0, 7); g.fill();
      g.fillStyle = '#2a2230'; g.textAlign = 'left'; g.font = 'bold 38px Arial, sans-serif'; g.fillText(title, 22, 68);
      body(nw, nh); g.restore();
    };
    const lines = (list, nw, y0, step, font) => {
      g.font = font; g.fillStyle = '#2a2230'; g.textAlign = 'left';
      list.forEach((t, i) => { let s2 = String(t); while (g.measureText(s2).width > nw - 44 && s2.length > 3) s2 = s2.slice(0, -2); if (s2 !== String(t)) s2 += '…'; g.fillText(s2, 22, y0 + i * step); });
    };
    note(30, 105, 450, 420, '#fff6b8', '🔔 Avvisi', -0.02, nw => lines(notices.length ? notices.map(n => n.text) : ['Nessun avviso'], nw, 118, 72, '28px Arial, sans-serif'));
    note(505, 100, 490, 815, '#d8f1ff', '💬 Chat', 0.012, nw => lines(chat.length ? chat.flatMap(m => [firstName(m.name) + ':', '  ' + (m.text || '')]) : ['Scrivi alla Lobby'], nw, 118, 56, '28px "Segoe Print", "Comic Sans MS", Arial, sans-serif'));
    note(30, 545, 450, 375, '#e6ffd8', '🏆 Classifica', -0.012, () => {
      // podio disegnato: 2° · 1° · 3°, con il nome sopra ogni gradino
      PODIUM.forEach(([i, color, k], col) => {
        const x = 30 + col * 132, hgt = 120 * k, y = 250 - hgt;
        g.fillStyle = color; g.fillRect(x, y, 120, hgt); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + hgt - 6, 120, 6);
        g.fillStyle = '#fff'; g.font = 'bold 44px "Arial Black", Arial'; g.textAlign = 'center'; g.fillText(String(i + 1), x + 60, y + hgt / 2 + 16);
        g.fillStyle = '#2a2230'; g.font = 'bold 24px Arial'; g.fillText(top[i] ? firstName(top[i].name) : '—', x + 60, y - 12);
      });
      g.textAlign = 'left'; g.font = '24px Arial';
      top.slice(3, 5).forEach((r, i) => g.fillText((i + 4) + '. ' + r.name + ' · ' + r.wins, 30, 300 + i * 34));
      if (!top.length) g.fillText('Nessuna vittoria', 30, 300);
    });
    boardTex.needsUpdate = true;
  }
  paintBoard(true);
  // la bacheca "vera": un foglio grande come la bacheca, messo sul sughero con la prospettiva della telecamera
  const boardDom = document.createElement('div');
  boardDom.className = 'l3d-cork'; boardDom.hidden = true;
  boardDom.innerHTML = '<div class="cork-title">Bacheca e avvisi<button class="cork-close" aria-label="Torna a camminare">✕</button></div>'
    + '<section class="cork-note cork-yellow cork-notices"><h3>🔔 Avvisi</h3><div data-slot="notices"></div></section>'
    + '<section class="cork-note cork-blue cork-chat"><h3>💬 Chat</h3><div data-slot="chat"></div></section>'
    + '<section class="cork-note cork-green cork-rank"><h3>🏆 Classifica</h3><div class="cork-podium"></div><ol class="cork-top"></ol></section>';
  el.append(boardDom);
  const boardStyle = document.createElement('style');
  boardStyle.textContent = '.l3d-cork{position:absolute;left:0;top:0;width:' + BW + 'px;height:' + BH + 'px;transform-origin:0 0;z-index:2;background:url(' + cork.toDataURL('image/jpeg', 0.8) + ');color:#2a2230;font:26px/1.3 system-ui,Arial,sans-serif}'
    + '.l3d-cork[hidden]{display:none}.cork-title{position:absolute;left:0;right:0;top:14px;text-align:center;font:bold 56px "Arial Black",Arial,sans-serif;color:#2b2140}'
    + '.l3d-cork .cork-close{position:absolute;right:20px;top:0;width:68px!important;height:68px;min-height:68px;padding:0!important;font-size:34px!important;border-radius:50%;background:#2b2140!important;color:#fff!important;border:0!important}'
    + '.cork-note{position:absolute;box-shadow:0 8px 18px #0006;padding:14px 20px;overflow:hidden;display:flex;flex-direction:column}.cork-note h3{margin:0 0 8px;font:bold 36px Arial,sans-serif}'
    + '.cork-yellow{background:#fff6b8;left:30px;top:105px;width:450px;height:420px;transform:rotate(-1deg)}.cork-blue{background:#d8f1ff;left:505px;top:100px;width:490px;height:815px;transform:rotate(.6deg)}.cork-green{background:#e6ffd8;left:30px;top:545px;width:450px;height:375px;transform:rotate(-.6deg)}'
    + '.cork-note [data-slot]{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px}'
    + '.l3d-cork #chat-messages{flex:1;min-height:0;max-height:none;overflow:auto;font-size:24px}'
    + '.l3d-cork .chat-message{display:flex;gap:10px;align-items:flex-start;margin:6px 0}.l3d-cork .chat-message.mine{flex-direction:row-reverse}'
    + '.l3d-cork .chat-copy{background:#fffdf4!important;color:#2a2230!important;border:2px solid #2a2230;border-radius:16px;padding:8px 14px;box-shadow:2px 3px 0 #2a223055;max-width:80%;font-family:\"Comic Sans MS\",\"Comic Neue\",\"Segoe Print\",cursive}'
    + '.l3d-cork .chat-message.mine .chat-copy{background:#fff1c2!important}.l3d-cork .chat-copy small{display:block;font-size:18px;color:#6a5d70!important}.l3d-cork .chat-copy p{margin:2px 0 0;font-size:25px;color:#2a2230!important}'
    + '.l3d-cork #chat-form{display:flex;gap:8px;order:2}.l3d-cork #chat-input{flex:1;font-size:26px;padding:10px;border-radius:10px;border:2px solid #8fb3c9;background:#fff;color:#111}.l3d-cork #chat-send{width:auto!important;font-size:24px!important;padding:8px 16px!important}'
    + '.l3d-cork #notices-list{font-size:22px;color:#2a2230}.l3d-cork #notices-list *{color:#2a2230}.l3d-cork #notices-list button{font-size:20px!important;width:auto!important}'
    + '.cork-podium{display:flex;align-items:flex-end;gap:10px;height:190px}.cork-podium div{flex:1;text-align:center;border-radius:10px 10px 0 0;font:bold 24px Arial;color:#231400;padding-top:8px;position:relative}.cork-podium div span{position:absolute;left:0;right:0;top:-34px;font:bold 22px Arial;color:#2a2230}'
    + '.cork-top{margin:8px 0 0;padding-left:34px;font-size:22px}.cork-top li{margin:2px 0}';
  document.head.append(boardStyle);
  const moved = [];
  let boardOpen = false;
  function moveInto(node, slot) { if (!node) return; moved.push([node, node.parentNode, node.nextSibling]); slot.append(node); }
  function paintRank() {
    const rows = (app.board?.() || {}).leaderboard || [];
    const pod = boardDom.querySelector('.cork-podium'); pod.replaceChildren();
    for (const [i, color, k] of PODIUM) {
      const d = document.createElement('div'); d.style.background = color; d.style.height = Math.round(150 * k) + 'px'; d.textContent = String(i + 1);
      const n = document.createElement('span'); n.textContent = rows[i] ? firstName(rows[i].name) + ' · ' + rows[i].wins : '—'; d.append(n); pod.append(d);
    }
    const ol = boardDom.querySelector('.cork-top'); ol.replaceChildren(); ol.start = 4;
    rows.slice(3, 5).forEach(r => { const li = document.createElement('li'); li.textContent = r.name + ' · ' + r.wins; ol.append(li); });
  }
  function openBoard() {
    if (boardOpen) return;
    if (document.pointerLockElement) document.exitPointerLock?.();
    boardOpen = true; resetMovement();
    const chatSlot = boardDom.querySelector('[data-slot="chat"]');
    moveInto(document.getElementById('chat-messages'), chatSlot);
    moveInto(document.getElementById('chat-form'), chatSlot);
    moveInto(document.getElementById('notices-list'), boardDom.querySelector('[data-slot="notices"]'));
    app.noticesSeen?.(); // bacheca aperta: avvisi letti e lista aggiornata
    paintRank();
    boardDom.hidden = false; actB.hidden = true;
  }
  function closeBoard() {
    if (!boardOpen) return;
    boardOpen = false; boardDom.hidden = true;
    for (const [node, parent, next] of moved.splice(0).reverse()) parent.insertBefore(node, next && next.parentNode === parent ? next : null);
  }
  boardDom.addEventListener('click', e => { if (e.target.closest('.cork-close')) closeBoard(); });
  // la vista davanti alla bacheca e il foglio sopra il sughero, con la stessa prospettiva della scena
  const boardM = new THREE.Matrix4(), boardVp = new THREE.Matrix4();
  const boardPx = new THREE.Matrix4().set(bdW / BW, 0, 0, -bdW / 2, 0, -bdH / BH, 0, bdH / 2, 0, 0, 1, 0, 0, 0, 0, 1);
  function focusBoard() {
    const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const d = Math.max((bdH / 2 + 0.05) / Math.tan(vf / 2), (bdW / 2 + 0.04) / Math.tan(hf / 2));
    camera.up.set(0, 1, 0); camera.position.set(bdX + d, 1.5, bdZ); camera.lookAt(bdX, 1.5, bdZ); camera.updateMatrixWorld();
    const w = host.clientWidth / 2, h = host.clientHeight / 2;
    boardVp.set(w, 0, 0, w, 0, -h, 0, h, 0, 0, 1, 0, 0, 0, 0, 1);
    boardMesh.updateMatrixWorld();
    boardM.copy(boardVp).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(boardMesh.matrixWorld).multiply(boardPx);
    boardDom.style.transform = 'matrix3d(' + boardM.elements.join(',') + ')';
  }
  for (const ev of ['pointerdown', 'keydown', 'keyup', 'wheel']) boardDom.addEventListener(ev, e => e.stopPropagation());
  // tappeto, divani, piante
  const loader=new THREE.TextureLoader();
  function loadPrint(file){
    const map=loader.load(new URL(file,import.meta.url).href);
    map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return map;
  }
  const clubArt=loadPrint('binottoland.jpg'),racingArt=loadPrint('corsa-competizione.jpg');
  const brassEdge=std('#ba935e',.36);
  const rug=new THREE.Mesh(new THREE.CircleGeometry(2.32,96),new THREE.MeshStandardMaterial({map:clubArt,roughness:.81,emissiveMap:clubArt,emissive:0xffffff,emissiveIntensity:.18}));
  rug.rotation.x=-Math.PI/2;rug.position.set(0,.012,.6);scene.add(rug);
  const rim=new THREE.Mesh(new THREE.RingGeometry(2.32,2.39,96),brassEdge);
  rim.rotation.copy(rug.rotation);rim.position.copy(rug.position);scene.add(rim);
  function framedPrint(map,x,z,yaw){
    const frame=new THREE.Group();frame.position.set(x,1.82,z);frame.rotation.y=yaw;scene.add(frame);
    rbox(1.30,1.30,.055,.02,brassEdge,0,0,0,frame);box(1.25,1.25,.034,std('#201d23',.76),0,0,.038,frame);
    const print=new THREE.Mesh(new THREE.PlaneGeometry(1.13,1.13),new THREE.MeshBasicMaterial({map,toneMapped:false}));print.position.z=.058;frame.add(print);
    box(.65,.04,.11,brassEdge,0,.72,.08,frame);box(.58,.014,.09,glow('#ffe0ad',1.3),0,.696,.08,frame);
  }
  framedPrint(clubArt,-18.88,3.25,Math.PI/2);framedPrint(racingArt,18.88,-3.25,-Math.PI/2);
  const sofaM = std('#3f5d7a', 0.9), legM = std('#2a1a12', 0.5);
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    // divani morbidi: spigoli tondi e cuscini
    rbox(2.2, 0.3, 0.9, 0.06, sofaM, 0, 0.24, 0, g); rbox(2.2, 0.62, 0.22, 0.08, sofaM, 0, 0.62, 0.36, g);
    for (const cx of [-0.5, 0.5]) rbox(0.98, 0.13, 0.7, 0.05, std('#4a6c8c', 0.95), cx, 0.45, -0.07, g);
    for (const ax of [-1.02, 1.02]) rbox(0.2, 0.55, 0.9, 0.07, sofaM, ax, 0.42, 0, g);
    for (const lx of [-0.95, 0.95]) for (const lz of [-0.35, 0.35]) box(0.06, 0.1, 0.06, legM, lx, 0.05, lz, g);
    g.position.set(sx * 3.6, 0, 5.3); scene.add(g);
    // divani capitonné in pelle a due colori fatti in Blender (blender/divano_lobby.blend): petrolio e senape, bordeaux e crema
    new GLTFLoader().load(new URL(sx < 0 ? 'models/divano_lobby.glb' : 'models/divano_lobby_bordeaux.glb', import.meta.url).href, (gltf) => {
      g.clear(); gltf.scene.rotation.y = Math.PI; g.add(gltf.scene);
    });
    for (const o of [-0.5, 0.5]) spots.push({ x: sx * 3.6 + o, z: 4.75, hx: 0.25, hz: 0.12, pad: 0.45, label: 'Siediti', where: 'Lobby', seat: true, px: sx * 3.6 + o, pz: 5.2, yaw: 0 });
    solid(sx * 3.6 - 1.12, sx * 3.6 + 1.12, 4.85, 5.8);
  }
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), new THREE.MeshPhysicalMaterial({ color: '#6b4226', roughness: 0.35, clearcoat: 0.8 }));
  table.position.set(-2, 0.45, 4.6); scene.add(table);
  box(0.08, 0.44, 0.08, legM, -2, 0.22, 4.6); solid(-2.58, -1.42, 4.02, 5.18);
  const plant = (x, z) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 20), std('#b5633d', 0.8)); pot.position.set(x, 0.25, z); scene.add(pot);
    // Lance-shaped leaves grow in fans from the crown.
    const vertices=[], indices=[], colors=[];
    for(let i=0;i<22;i++){
      const angle=i*2.4, spread=.19+.27*(i%5)/4, height=.53+.48*((i*7)%11)/10;
      const dx=Math.cos(angle), dz=Math.sin(angle);
      const tint=new THREE.Color(['#456d43','#63834b','#385d42','#739156'][i%4]);
      const start=vertices.length/3;
      for(let ring=0;ring<=6;ring++){
        const t=ring/6, r=t*t*spread, half=.065*Math.sin(Math.PI*t)+.001;
        const y=.44+height*Math.sin(t*1.85);
        for(const side of [-1,0,1]){
          vertices.push(dx*r-dz*side*half,y+(side===0?.024:0)*Math.sin(Math.PI*t),dz*r+dx*side*half);
          const light=side===0?1.14:.82;colors.push(tint.r*light,tint.g*light,tint.b*light);
        }
        if(ring>0){const n=start+ring*3;indices.push(n-3,n,n-2,n-2,n,n+1,n-2,n+1,n-1,n-1,n+1,n+2)}
      }
    }
    const foliage=new THREE.BufferGeometry();
    foliage.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));foliage.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));foliage.setIndex(indices);foliage.computeVertexNormals();
    const leaves=new THREE.Mesh(foliage,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.81}));
    leaves.position.set(x,0,z);scene.add(leaves);groundTint(x,z,.85,.85,contact);
    solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  };
  plant(-6.4, -5.4); plant(6.4, -5.4); plant(-6.4, 5.4);
  // cartelli sopra le porte
  function doorSign(title,color,x,yaw){
    const group=new THREE.Group();group.position.set(x,2.92,0);group.rotation.y=yaw;scene.add(group);
    const board=box(2.78,.44,.055,std('#161723',.45),0,0,0,group);
    const map=canvasTex(1024,164,(g,w,h)=>{
      g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.font='600 88px "Trebuchet MS", sans-serif';
      g.shadowColor=color;g.shadowBlur=15;g.strokeStyle=color;g.lineWidth=4;g.strokeText(title.toUpperCase(),w/2,h/2);
      g.shadowBlur=2;g.lineWidth=1.5;g.strokeStyle='#fff7eb';g.strokeText(title.toUpperCase(),w/2,h/2);
    });
    const letters=new THREE.Mesh(new THREE.PlaneGeometry(2.70,.42),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
    letters.position.z=.035;board.add(letters);
    for(const y of [-.206,.206])box(2.62,.012,.014,glow(color,1.45),0,y,.03,group);
    return group;
  }
  // ogni porta ha il cartello da tutte e due le parti: dall'atrio il nome della sala, dalla sala "Atrio"
  // (staccati di qualche centimetro dalla parete, sopra l'architrave a 2,5 m)
  doorSign('Sala biliardo','#82ddbd',6.8,-Math.PI/2);
  doorSign('Sala giochi','#61d7ff',-6.8,Math.PI/2);
  doorSign('Lobby', '#ffd23f', 7.2, Math.PI / 2);
  doorSign('Lobby', '#ffd23f', -7.2, -Math.PI / 2);
  doorSign('Lobby', '#ffd23f', 0, Math.PI).position.set(0, 2.92, -6.34);
  doorSign('Lobby', '#ffd23f', 0, 0).position.set(0, 2.92, 6.34);

  // ========== SALA BILIARDO (x 7…19): i tavoli veri del gioco ==========
  const pools = [];
  const addTable = (variant, cloth, x, z) => {
    const game = E.newGame(variant, [{ name: 'A' }, { name: 'B' }]);
    const T = E.tableOf(game);
    const holder = new THREE.Group(); holder.position.set(x, 0.78, z); scene.add(holder);
    // il disegno del tavolo è quello di public/biliardo/scene3d.js, messo in questa stanza
    const view = { tableGroup: new THREE.Group(), ballGroup: new THREE.Group(), scene: holder, lamp: { scale: {} } };
    holder.add(view.tableGroup, view.ballGroup);
    Table3D.prototype.setTable.call(view, T, cloth);
    Table3D.prototype.setBalls.call(view, game.balls.map((b) => ({ id: b.id, r: b.r, look: E.ballLook(game, b) })));
    Table3D.prototype.syncBalls.call(view, game.balls, 0, new Map());
    if (game.pins) Table3D.prototype.setPins.call(view, game.pins);
    const hx = T.L + T.cush + T.rail, hz = T.W + T.cush + T.rail;
    solid(x - hx, x + hx, z - hz, z + hz);
    spots.push({ x, z, hx, hz, pad: 0.85, label: 'Biliardo', key: 'biliardo', where: 'Sala biliardo', act: () => app.open('biliardo') });
    // lampada sopra il tavolo
    const lampW = hx * 1.6;
    box(lampW, 0.065, 0.095, std('#1d2a22', 0.35, 0.7), x, 2.25, z);
    for (const sx of [-1, 1]) box(0.01, H - 2.25, 0.01, std('#b08d57', 0.3, 1), x + sx * lampW * 0.4, (H + 2.25) / 2, z);
    // un faretto per tavolo, più aperto (prima due: ogni luce in più pesa su tutto quello che si disegna)
    {
      const sp = new THREE.SpotLight('#fff2df', 14, 4.4, Math.PI / 2.9, 0.75, 1.3);
      sp.position.set(x, 2.15, z); sp.target.position.set(x, 0.78, z); scene.add(sp, sp.target);
    }
    const enamel=new THREE.MeshStandardMaterial({color:'#1b5647',metalness:.35,roughness:.32,side:THREE.DoubleSide});
    const shadeGeometry=new THREE.CylinderGeometry(.13,.35,.23,24,1,true);
    const lipGeometry=new THREE.TorusGeometry(.35,.014,6,32);
    const brass=std('#c19855',.32,.63);
    for(const offset of [-.32,.32]){
      const shade=new THREE.Mesh(shadeGeometry,enamel);shade.position.set(x+offset*lampW,2.14,z);scene.add(shade);
      const lip=new THREE.Mesh(lipGeometry,brass);lip.rotation.x=Math.PI/2;lip.position.set(shade.position.x,2.025,z);scene.add(lip);
      plane(.39,.25,glow('#fff1c9',2),shade.position.x,2.06,z,0,Math.PI/2);
    }
    groundTint(x,z,2.9*hx,3.1*hz,contact);
    pools.push(view);
  };
  addTable('otto', CLOTHS.verde.c, 13, -2.6);
  addTable('italiana', CLOTHS.blu.c, 13, 2.7);
  point('#ffd598', 10, 9, 2.6, -5.2, 10); point('#c4efdc', 9, 18, 2.6, 0, 10); point('#ffc992', 9, 9, 2.6, 5.2, 10);
  plane(3.2, 0.8, new THREE.MeshBasicMaterial({ map: neonText('Biliardo', '#ffe1a5', 1024, 256, 'bold 150px "Brush Script MT", "Segoe Script", cursive'), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }), 13, 2.6, -5.99);
  plane(0.7, 0.7, new THREE.MeshBasicMaterial({ map: neonText('8', '#ffd23f', 256, 256, 'bold 190px Arial, sans-serif'), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }), 15.8, 2.6, -5.99);
  // strisce LED, rastrelliera delle stecche, jukebox
  for (const [c, z] of [['#ffc880', -5.96], ['#cca272', 5.96]]) box(11.8, 0.03, 0.03, glow(c, 3), 13, H - 0.12, z);
  box(0.03, 0.03, 11.8, glow('#eac481', 2), 18.96, H - 0.12, 0);
  const rack = new THREE.Group();
  box(0.05, 1.3, 1.3, std('#3b1608', 0.5), 0, 1.4, 0, rack);
  const cueM = std('#d8b77f', 0.4);
  for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 1.45, 8), cueM); c.position.set(-0.05, 0.98, -0.55 + i * 0.18); rack.add(c); }
  rack.position.set(18.95, 0, 0); scene.add(rack);
  // rastrelliera vera di Blender: noce, mensola a coppette, otto stecche con il manico scuro e l'anello d'ottone
  finishPiece('rastrelliera', 19.0, 0, 0, -Math.PI / 2, [rack]);
  // applique anche qui, ai lati della porta (pareti nord e sud)
  finishPiece('applique', 9.5, 2.05, -6.0, 0);
  finishPiece('applique', 9.5, 2.05, 6.0, Math.PI);
  const jb = new THREE.Group();
  box(0.9, 1.4, 0.55, std('#3a0d22', 0.4, 0.3), 0, 0.7, 0, jb);
  ['#ff2bd6', '#ffd23f', '#22d3ee'].forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.06, 0.014, 8, 32, Math.PI), glow(c, 3)); t.position.set(0, 1.4, 0.28); jb.add(t); });
  jb.position.set(17.9, 0, -5.55); scene.add(jb); solid(17.4, 18.4, -6, -5.2);

  // Card room beyond the north doorway. Aisles run between all nine tables.
  const avail = new Set(app.games ? app.games() : [...ARCADE,...BOARD].map(a=>a[0]).concat(['cinema-streamer','lavagna-spazio-libero','biliardo']));
  const walnut=std('#583828',.42), brassTrim=std('#c3a064',.32,.64), chairLeather=std('#773e36',.68);
  // sgabelli in pelle di tutti i colori (blender/sgabello.blend): quando ci si siede il pistone scende con un piccolo rimbalzo
  const stools=[],stoolColors=['#b3101a','#d2520a','#e0a412','#1f7a2a','#0f8a84','#1a3fa8','#5a1c8c','#d8456f'];
  new GLTFLoader().load(new URL('models/sgabello.glb',import.meta.url).href,gltf=>{
    stools.forEach((st,i)=>{
      const m=gltf.scene.clone(true);st.model=m;st.placeholder.visible=false;m.position.set(st.x,0,st.z);scene.add(m);
      st.lift=m.getObjectByName('sgabello_alzata');st.base=st.lift?.position.y||0;
      st.lift?.traverse(o=>{if(o.isMesh&&/^pelle_/.test(o.material.name)){o.material=o.material.clone();o.material.color.set(stoolColors[i%stoolColors.length])}});
    });
  });
  const addStool=(x,z,yaw,where)=>{
    const id=stools.length,spot={x,z,hx:.18,hz:.18,pad:.65,label:'Siediti',where,seat:true,px:x,pz:z,yaw,stool:id};
    const placeholder=new THREE.Group();
    box(.42,.10,.42,std(stoolColors[id%stoolColors.length],.7),0,.64,0,placeholder);
    box(.08,.59,.08,brassTrim,0,.31,0,placeholder);
    scene.add(placeholder);
    stools.push({id,x,z,homeX:x,homeZ:z,y:0,v:0,height:0,spot,placeholder});
    spots.push(spot);
  };
  for(const x of [9,11.6,14.4,17])for(const side of [-1,1])addStool(x,side*5.6,side>0?0:Math.PI,'Sala biliardo');
  for(const side of [-1,1])for(const end of [-1,1])addStool(-13+side*1.7,end*1.9,end>0?0:Math.PI,'Sala giochi');
  let carrying=null,requested=null;
  const stoolBar=document.createElement('div');
  // tasti dello sgabello: sul telefono nella colonna in basso a sinistra, sopra il joystick
  stoolBar.style.cssText=touch?'display:flex;flex-wrap:wrap;gap:5px;order:2':'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--ui-safe-bottom,0px) + 112px);display:flex;gap:4px;white-space:nowrap';
  (touch?dock:el).append(stoolBar);
  function stoolButton(label,fn,name){
    const b=document.createElement('button');b.textContent=label;b.onclick=fn;if(name)b.setAttribute('aria-label',name);stoolBar.append(b);return b;
  }
  function changeHeight(delta){
    const st=stools[seating?.stool];if(st)st.height=THREE.MathUtils.clamp(st.height+delta,-.12,.26); // oltre, lo stelo uscirebbe dal tubo
  }
  function stoolRequest(id,action,extra={}){
    if(requested)return;
    if(app.stoolSend?.({type:'stool',id,action,...extra}))requested={id,action,at:performance.now()};
  }
  function stoolResult({id,action,ok}){
    if(requested?.id!==id||requested.action!==action)return;
    requested=null;
    if(!ok)return;
    if(action==='drop'){carrying=null;near=null;actB.hidden=true;return} // l'avviso si ricalcola
    if(action!=='carry'&&action!=='sit')return;
    if(!active||boardOpen||playing()||seating||carrying!==null){app.stoolSend?.({type:'stool',action:'cancel',id});return}
    if(action==='carry')carrying=id;
    else launch(stools[id].spot,true);
  }
  function carryPoint(x,z,yaw){return {x:x-.63*Math.sin(yaw),z:z-.63*Math.cos(yaw)}}
  function toggleCarry(){
    if(seating)return;
    if(carrying===null){if(near?.stool!=null)stoolRequest(near.stool,'carry');return}
    const to=carryPoint(pos.x,pos.z,cam.yaw),test={...to};
    collide(test);
    if(Math.hypot(test.x-to.x,test.z-to.z)>.025||stools.some(st=>st.id!==carrying&&Math.hypot(st.x-to.x,st.z-to.z)<.50))return;
    stoolRequest(carrying,'drop',to);
  }
  // sul telefono senza le lettere dei tasti (G, W, S sono della tastiera)
  const carryButton=stoolButton(touch?'Prendi':'Prendi · G',toggleCarry);
  // sul telefono solo il simbolo (tasti tondi, il meno spazio possibile); il nome resta per chi usa la lettura vocale
  const raise=stoolButton(touch?'↑':'↑ W',()=>changeHeight(.05),'Alza lo sgabello'),lower=stoolButton(touch?'↓':'↓ S',()=>changeHeight(-.05),'Abbassa lo sgabello');
  function bounceStool(){
    const st=stools[seating?.stool];
    if(st)st.v=-.30;
  }
  const rock=stoolButton(touch?'〰':'Molleggia',bounceStool,'Molleggia');
  if(touch)for(const b of [raise,lower,rock]){b.style.fontSize='19px';b.style.padding='0'} // simboli più grandi, tasto tondo
  function stepStools(dt){
    const people=app.peers?.()||[],layout=app.stoolLayout?.()||{};
    if(requested&&performance.now()-requested.at>4500){app.stoolSend?.({type:'stool',action:'cancel',id:requested.id});requested=null}
    const mine=stools[seating?.stool];
    if(mine)changeHeight((Number(keys.has('w'))-Number(keys.has('s')))*dt*.27); // W alza, S abbassa
    for(const st of stools){
      const owner=people.find(u=>u.stool?.id===st.id),remote=owner&&String(owner.id)!==String(app.me?.()?.id);
      const carried=carrying===st.id||remote&&owner.stool.action==='carry'&&owner.clubPose?.station==='walk';
      const saved=layout[st.id];
      const point=carried?(carrying===st.id?carryPoint(pos.x,pos.z,cam.yaw):carryPoint(owner.clubPose.x,owner.clubPose.z,owner.clubPose.yaw)):(saved??{x:st.homeX,z:st.homeZ});
      st.x=point.x;st.z=point.z;
      Object.assign(st.spot,{x:st.x,z:st.z,px:st.x,pz:st.z});
      const seated=mine===st||remote&&owner.stool.action==='sit';
      const floor=cinemaFloor(st.x,st.z);
      if(mine!==st)st.height=saved?.height??0;
      const level=remote&&seated&&owner.clubPose?.station==='seat'?owner.clubPose.y-floor:st.height-(seated?.02:0);
      if(remote&&seated){st.y=level;st.v=0}
      else{
        st.v+=((level-st.y)*100-st.v*6)*dt;
        st.y=THREE.MathUtils.clamp(st.y+st.v*dt,level-.03,level+.03);
      }
      const model=st.model??st.placeholder;
      model.position.set(st.x,floor+(carried?.48:0)+(st.lift?0:st.y),st.z);
      if(st.lift)st.lift.position.y=st.base+st.y;
    }
    const showCarry=!seating&&(carrying!==null||near?.stool!=null)&&!playing()&&!boardOpen;
    stoolBar.style.display=(mine&&touch)||showCarry?'flex':'none';
    carryButton.hidden=!showCarry;carryButton.textContent=carrying===null?(touch?'Prendi':'Prendi · G'):(touch?'Posa':'Posa · G');
    if(!touch){
      stoolBar.style.display='none';
      if(carrying!==null&&!playing()){actB.hidden=false;actB.textContent='Posa lo sgabello (G)'}
    }
    lower.hidden=raise.hidden=rock.hidden=!mine;
  }
  const darkWood=std('#2b211d',.55);
  box(2.89,.04,.45,brassTrim,0,.002,-6.16);
  const cardWall=std('#2f4a3a',.92); // verde bottiglia, come il panno dei tavoli
  const carpet=tiles(157,23,24);carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(3,3);
  plane(14,11.85,new THREE.MeshStandardMaterial({map:carpet,roughness:.96}),0,0,-12.2,0,-Math.PI/2);
  plane(14,12,std('#d0bfa6',1),0,H,-12.2,0,Math.PI/2);
  wallZ(-18.3,-6.13,-7.15,cardWall);wallZ(-18.3,-6.13,7.15,cardWall);
  wallX(-7.3,7.3,-18.28,cardWall);
  point('#ffe0af',16,0,2.95,-11.2,14);
  const opal=glow('#ffe6bc',1.45);
  // applique d'ottone sulle pareti laterali, a metà sala
  finishPiece('applique',-7.0,2.05,-12.2,Math.PI/2);finishPiece('applique',7.0,2.05,-12.2,-Math.PI/2);
  for(const x of [-4,0,4]){
    box(.025,.23,.025,brassTrim,x,H-.115,-12.1);
    box(1.6,.09,.18,opal,x,H-.27,-12.1);
  }
  const tabletop=(key,title)=>canvasTex(512,384,(g,w,h)=>{
    g.fillStyle='#255348';g.fillRect(0,0,w,h);
    g.fillStyle='#e1c995';g.textAlign='center';g.font='bold 26px Georgia';g.fillText(title,w/2,360);
    // sul panno solo il nome del gioco: su ogni tavolo ci sono i pezzi veri (modelli di Blender, più sotto)
  });
  // tavoli e sedie moderni di Blender (blender/sala_tavoli.blend → models/sala_tavoli.glb), più sotto: queste liste
  // dicono dove vanno; i blocchi di prima (cardStandIns) restano finché il modello non arriva
  const cardTables=[],cardChairs=[],cardStandIns=[];
  let connectFour=null; // [x, z] del tavolo di Forza 4, se c'è
  const cardGames=[]; // [gioco, x, z] dei tavoli di carte
  let wordTable=null; // [x, z] del tavolo di Scarabeo, se c'è
  let navalTable=null; // [x, z] del tavolo di Battaglia navale, se c'è
  let chessTable=null,damaTable=null; // [x, z] dei tavoli di Scacchi e Dama, se ci sono
  BOARD.forEach(([key,title],i)=>{
    if(!avail.has(key))return;
    const x=(i%3-1)*4.1,z=-8.8-Math.floor(i/3)*3.55;
    groundTint(x,z,2.75,2.35,contact);
    cardStandIns.push(box(.48,.63,.48,darkWood,x,.34,z),box(1.98,.13,1.4,walnut,x,.74,z));
    cardTables.push([x,z,0]);
    if(key==='forza-4')connectFour=[x,z];
    if(CARD_LAYOUTS[key])cardGames.push([key,x,z]);
    if(key==='scarabeo')wordTable=[x,z];
    if(key==='battaglia-navale')navalTable=[x,z];
    if(key==='checkmate')chessTable=[x,z];
    if(key==='dama-italiana')damaTable=[x,z];
    box(1.91,.022,1.33,brassTrim,x,.816,z);
    plane(1.84,1.27,new THREE.MeshStandardMaterial({map:tabletop(key,title),roughness:.86}),x,.834,z,0,-Math.PI/2);
    for(const side of [-1,1]){
      cardStandIns.push(box(.46,.39,.4,walnut,x+side*1.24,.2,z),box(.52,.09,.49,chairLeather,x+side*1.24,.44,z),box(.07,.39,.49,chairLeather,x+side*1.47,.63,z));
      cardChairs.push([x+side*1.24,z,-side*Math.PI/2]); // la sedia guarda il tavolo
      spots.push({x:x+side*1.24,z:z+.62,hx:.2,hz:.12,pad:.5,label:'Siediti',where:'Sala tavoli',seat:true,px:x+side*1.24,pz:z,yaw:side*Math.PI/2});
    }
    solid(x-1.51,x+1.51,z-.72,z+.72);
    spots.push({x,z,hx:1.50,hz:.72,pad:.81,label:title,key,where:'Sala tavoli',act:()=>app.open(key)});
  });
  // tavolo su colonna centrale e sedia a guscio girevole: tutti a istanze, un oggetto per materiale (pochi da disegnare)
  new GLTFLoader().load(new URL('models/sala_tavoli.glb',import.meta.url).href,gltf=>{
    gltf.scene.updateMatrixWorld(true);
    const up=new THREE.Vector3(0,1,0),one=new THREE.Vector3(1,1,1),q=new THREE.Quaternion(),m=new THREE.Matrix4();
    const place=(name,list)=>{
      const src=gltf.scene.getObjectByName(name);if(!src||!list.length)return;
      src.traverse(o=>{
        if(!o.isMesh)return;
        const set=new THREE.InstancedMesh(o.geometry,o.material,list.length);
        list.forEach(([x,z,a],i)=>set.setMatrixAt(i,m.compose(new THREE.Vector3(x,0,z),q.setFromAxisAngle(up,a),one).multiply(o.matrixWorld)));
        set.castShadow=true;set.receiveShadow=true;scene.add(set);
      });
    };
    place('tavolo_carte',cardTables);place('sedia_carte',cardChairs);
    for(const o of cardStandIns)scene.remove(o);
  });
  // Forza 4 sul suo tavolo (blender/forza4.blend → models/forza4.glb): la griglia in piedi al centro, di taglio, così
  // ognuno dei due giocatori la vede dal suo lato; i gettoni della partita nei fori e quelli di riserva nel vassoio
  // davanti a ciascuno (rossi a sinistra, gialli a destra). Nella griglia la partita vera (table-live.js): la tua, se
  // no quella con l'ultima mossa; senza partite la griglia è vuota. Un solo oggetto: 12 di riserva, poi fino a 42.
  let connectFourBoard=null,paintConnectFour=()=>{};
  if(connectFour)new GLTFLoader().load(new URL('models/forza4.glb',import.meta.url).href,gltf=>{
    const [tx,tz]=connectFour,top=.834,P=.06,ROW0=.079; // passo dei fori e centro della riga più bassa (forza4.blend)
    const grid=gltf.scene.getObjectByName('f4_griglia'),disc=gltf.scene.getObjectByName('f4_gettone'),tray=gltf.scene.getObjectByName('f4_vassoio');
    if(grid){const g=grid.clone();g.position.set(tx,top,tz);g.rotation.y=Math.PI/2;g.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(g)}
    for(const side of [-1,1])if(tray){const t=tray.clone();t.position.set(tx+side*.62,top,tz);scene.add(t)}
    const discMesh=disc?.isMesh?disc:disc?.children.find(o=>o.isMesh);if(!discMesh)return;
    const COLORS=[new THREE.Color('#d9372f'),new THREE.Color('#f2c230')]; // Rosso (giocatore 0), Giallo (giocatore 1)
    const SPARE=12,set=new THREE.InstancedMesh(discMesh.geometry,discMesh.material,SPARE+42);
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1);
    // nel vassoio: distesi, in fila
    q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
    for(let i=0;i<SPARE;i++){const side=i<6?-1:1;set.setMatrixAt(i,m.compose(new THREE.Vector3(tx+side*.62,top+.012,tz-.11+(i%6)*.044),q,one));set.setColorAt(i,COLORS[i<6?0:1])}
    // nella griglia: il disco guarda i giocatori (asse lungo x). board: 42 caselle, riga 0 in alto (connect4.js)
    const face=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
    paintConnectFour=board=>{
      let n=SPARE;
      (board||[]).forEach((who,at)=>{
        if(who!==0&&who!==1)return;
        const col=at%7,row=5-Math.floor(at/7);
        set.setMatrixAt(n,m.compose(new THREE.Vector3(tx,top+ROW0+row*P,tz-(col-3)*P),face,one));set.setColorAt(n,COLORS[who]);n++;
      });
      set.count=n;set.instanceMatrix.needsUpdate=true;if(set.instanceColor)set.instanceColor.needsUpdate=true;
    };
    paintConnectFour(connectFourBoard);
    set.castShadow=true;scene.add(set);
  });
  // collegamento alle partite vere, solo nella sala tavoli o davanti alla sua porta (watch, vicino a frame più sotto)
  const tableLive=createTableLive({games:()=>app.tables?.()||[],player:()=>app.me?.()?.player,token:()=>app.token?.(),onState:(game,s)=>{
    if(game==='connect4'){connectFourBoard=s?.connect4?.board||null;paintConnectFour(connectFourBoard)}
  }});
  // carte sui tavoli di UNO, Scopa, Briscola e Briscola in cinque (blender/carte.blend → models/carte.glb): le
  // posizioni sono dati in table-cards.js; per tavolo un atlante delle facce e tre oggetti soltanto
  if(cardGames.length)new GLTFLoader().load(new URL('models/carte.glb',import.meta.url).href,gltf=>{
    const parts=cardParts(gltf);
    for(const [key,x,z] of cardGames)for(const mesh of buildCardTable(parts,CARD_LAYOUTS[key],x,z))scene.add(mesh);
  });
  // Scarabeo (blender/scarabeo.blend → models/scarabeo.glb): plancia al centro con le parole, un leggio con le tessere
  // davanti a ciascun giocatore, sacchetto in un angolo; le tessere sono dati in table-scarabeo.js
  if(wordTable)new GLTFLoader().load(new URL('models/scarabeo.glb',import.meta.url).href,gltf=>{
    for(const o of buildScarabeoTable(gltf,SCARABEO_LAYOUT,...wordTable))scene.add(o);
  });
  // Battaglia navale (blender/navale.blend → models/navale.glb): una valigetta aperta davanti a ciascun giocatore,
  // blu e rossa, con i coperchi in piedi schiena contro schiena; flotte e colpi sono dati in table-navale.js
  if(navalTable)new GLTFLoader().load(new URL('models/navale.glb',import.meta.url).href,gltf=>{
    for(const o of buildNavaleTable(gltf,NAVALE_LAYOUT,...navalTable))scene.add(o);
  });
  // Scacchi e Dama (blender/scacchi.blend → models/scacchi.glb): scacchiera di legno intarsiato, pezzi Staunton e
  // pedine bianche e nere; due partite a metà, come dati in table-scacchi.js. Il Bianco siede a x positivo
  if(chessTable||damaTable)new GLTFLoader().load(new URL('models/scacchi.glb',import.meta.url).href,gltf=>{
    if(chessTable)for(const o of buildChessTable(gltf,CHESS_LAYOUT,...chessTable))scene.add(o);
    if(damaTable)for(const o of buildDamaTable(gltf,DAMA_LAYOUT,...damaTable))scene.add(o);
  });
  // frameName: la cornice di Blender per la stanza (dorata nel biliardo, neon nella sala giochi, ottone altrove)
  // y: altezza del centro (nel biliardo più su: il battisedia è a 1,2 m e la cornice dorata è più grande)
  function poster(x,z,angle,title,subtitle,palette,motif,frameName='cornice_ottone',y=1.92){
    const map=canvasTex(384,512,(g,w,h)=>{
      g.fillStyle=palette[0];g.fillRect(0,0,w,h);g.strokeStyle=palette[1];g.lineWidth=3;g.strokeRect(14,14,w-28,h-28);
      g.save();g.translate(192,210);g.rotate(-.17);
      if(motif==='film'){
        for(const x of [-61,61]){g.fillStyle=palette[1];g.beginPath();g.arc(x,-22,54,0,7);g.fill();for(let i=0;i<5;i++){g.fillStyle=palette[0];g.beginPath();g.arc(x+28*Math.cos(i*1.256),-22+28*Math.sin(i*1.256),9,0,7);g.fill()}}
        g.fillStyle=palette[2];g.fillRect(-90,39,177,66);
      }else if(motif==='cards'){for(let i=0;i<3;i++){g.rotate(.18);g.fillStyle=i%2?palette[2]:palette[1];g.fillRect(-100+i*37,-100,91,151);g.fillStyle=palette[0];g.font='38px Georgia';g.fillText('♦',-84+i*37,-48)}}
      else if(motif==='chalk'){g.strokeStyle=palette[1];g.lineWidth=8;for(let i=0;i<4;i++){g.beginPath();g.moveTo(-102,78-i*28);g.quadraticCurveTo(-30,-125+i*30,105,42-i*29);g.stroke()}}
      else if(motif==='pool'){for(let i=0;i<3;i++){g.beginPath();g.arc(-60+i*54,-43+(i%2)*63,44,0,7);g.fillStyle=[palette[1],palette[2],'#9c4736'][i];g.fill();g.fillStyle='#fff1c9';g.beginPath();g.arc(-73+i*54,-55+(i%2)*63,8,0,7);g.fill()}}
      else {g.strokeStyle=palette[2];g.lineWidth=6;for(let i=0;i<6;i++)g.strokeRect(-95+i*9,-105+i*9,185-i*18,185-i*18)}
      g.restore();g.fillStyle=palette[1];g.textAlign='center';g.font='900 44px Arial';g.fillText(title,192,378,338);g.font='bold 21px monospace';g.fillText(subtitle,192,430,338);
    });
    const frame=box(1.25,1.66,.055,brassTrim,x,y,z);frame.rotation.y=angle;
    frameFor(frameName,frame,x,y,z,angle,.055);
    plane(1.19,1.59,new THREE.MeshBasicMaterial({map}),x+.033*Math.sin(angle),y,z+.033*Math.cos(angle),angle);
    return map;
  }
  poster(0,-18.09,0,'SALA TAVOLI','BINOTTOLAND',['#263e38','#efcf98','#bd6749'],'cards');
  doorSign('Sala tavoli','#f5ce86',0,0).position.set(0,2.92,-5.96);
  let boardRoom=null,boardEpoch=-1,boardSeq=0,nextBoard=0;
  const artwork=canvasTex(576,432,g=>{g.fillStyle='#233f37';g.fillRect(0,0,576,432)});
  const paint=artwork.image.getContext('2d');
  function drawGallery(packet){
    if(!active)return;
    if(boardRoom!==packet.room||boardEpoch!==packet.epoch){
      boardSeq=0;paint.fillStyle='#233f37';paint.fillRect(0,0,576,432);artwork.needsUpdate=true;
    }
    boardRoom=packet.room;boardEpoch=packet.epoch;
    if(!boardRoom){
      paint.fillStyle='#233f37';paint.fillRect(0,0,576,432);
      paint.fillStyle='#ecd7ad';paint.textAlign='center';paint.font='italic 44px Georgia';paint.fillText('Lavagna',288,224);artwork.needsUpdate=true;return;
    }
    paint.save();paint.scale(576/BOARD_WIDTH,432/BOARD_HEIGHT);
    for(const stroke of packet.strokes){
      if(stroke.seq<=boardSeq)continue;
      const color=stroke.color===ERASER?'#233f37':CHALKS[stroke.color]?.[1];
      if(!color||!stroke.points.length)continue;
      paint.strokeStyle=color;paint.lineWidth=(stroke.size||DEFAULT_SIZE)*(stroke.color===ERASER?3:.72);paint.lineCap=paint.lineJoin='round';paint.beginPath();
      const [x,y]=stroke.points[0];paint.moveTo(x,y);paint.lineTo(x+.01,y);
      for(const [px,py] of stroke.points.slice(1))paint.lineTo(px,py);
      paint.stroke();boardSeq=stroke.seq;artwork.needsUpdate=true;
    }
    paint.restore();if(packet.more)nextBoard=0;
  }
  if(avail.has('lavagna-spazio-libero')){
    box(.075,1.52,2.00,brassTrim,6.78,1.75,3.6);
    plane(1.91,1.433,new THREE.MeshBasicMaterial({map:artwork}),6.73,1.75,3.6,-Math.PI/2);
    spots.push({x:6.65,z:3.6,hx:.12,hz:.95,pad:1,label:'Lavagna',act:()=>app.enterGallery?app.enterGallery(boardRoom):app.open('lavagna-spazio-libero')});
  }
  poster(-17.85,-5.95,0,'INSERT COIN','ARCADE CLUB',['#18182e','#8bd9d5','#d16699'],'vector','cornice_neon');
  poster(16.2,5.94,Math.PI,'CARAMBOLA','SALA BILIARDO',['#23433d','#eadaad','#bd8f50'],'pool','cornice_dorata',2.15);
  // The south auditorium opens onto a centre aisle, with five pairs of loveseats.
  // Sala buia: i materiali del cinema sono più scuri (CINEMA_DIM) invece di abbassare la luce di tutta la scena
  // quando si entra; così la sala è buia uguale vista dalla Lobby e da dentro. È la luce che si aveva abbassando, solo
  // dentro, luce d'ambiente (0,55 → 0,1) e riflesso della scena (0,35 → 0,12): un quarto, e lampade di sala
  // quattro volte più forti per compensare. Col film i materiali scendono ancora (cinemaShade).
  const CINEMA_DIM=.18,darkened=new Map();
  // anche il riflesso dell'ambiente scende: i riflessi non dipendono dal colore e la sala sembrava lucida
  const dark=m=>{if(m?.color&&!darkened.has(m)){darkened.set(m,m.color.clone());m.color.multiplyScalar(CINEMA_DIM);if('envMapIntensity' in m)m.envMapIntensity=CINEMA_DIM}return m};
  const cinemaShade=k=>{for(const [m,base] of darkened)m.color.copy(base).multiplyScalar(CINEMA_DIM*k)};
  const velvet=dark(std('#6f2033',.97)), piping=dark(std('#a5535f',.89)), cinemaWall=dark(std('#1b1e2a',.98));
  const cinemaLen=CINEMA_END-6.06,cinemaMid=(CINEMA_END+6.06)/2;
  plane(14,cinemaLen,dark(std('#4c2935',.98)),0,-CINEMA_DROP,cinemaMid,0,-Math.PI/2);
  plane(14,cinemaLen,cinemaWall,0,CINEMA_H,cinemaMid,0,Math.PI/2); // tetto dello stesso colore delle pareti
  // pareti dal pavimento più basso fino al tetto del cinema (wallZ e wallX sono alte H)
  const wallTall=CINEMA_H+CINEMA_DROP,wallMidY=(CINEMA_H-CINEMA_DROP)/2;
  for(const x of [-7.15,7.15]){wallMeshes.push(box(.3,wallTall,CINEMA_END-6.12,cinemaWall,x,wallMidY,(CINEMA_END+6.12)/2));solid(x-.15,x+.15,6.12,CINEMA_END)}
  wallMeshes.push(box(14.6,wallTall,.3,cinemaWall,0,wallMidY,CINEMA_END));solid(-7.3,7.3,CINEMA_END-.15,CINEMA_END+.15);
  doorSign('Sala cinema','#ffd496',0,Math.PI).position.set(0,2.92,5.96);
  // A pleated velvet panel, gathered halfway up and fuller at the hem.
  const curtains=[],doorCurtains=[];
  const curtainMat=dark(new THREE.MeshStandardMaterial({color:'#791e38',roughness:.94,side:THREE.DoubleSide}));
  for(const side of [-1,1]){
    const fabric=new THREE.PlaneGeometry(1,1,44,12),vertices=fabric.attributes.position;
    for(let n=0;n<vertices.count;n++){
      const u=vertices.getX(n)+.5,v=vertices.getY(n)+.5;
      const gather=Math.exp(-((v-.42)**2)/.04);
      vertices.setXYZ(n,-side*u*(1.15-.5*gather),.06+v*(DOOR_H-.07)+.035*Math.cos(u*36)*(1-v),.13*Math.cos(u*Math.PI*12)*(.9-.25*gather));
    }
    fabric.computeVertexNormals();const panel=new THREE.Mesh(fabric,curtainMat);
    panel.position.set(side*1.62,0,6.23);scene.add(panel);curtains.push(panel);
  }
  for(let i=0;i<7;i++){
    const drape=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),curtainMat);
    drape.position.set((i-3)*.48,DOOR_H+.10,6.13);drape.scale.set(.39,.16+(i%2)*.04,.13);scene.add(drape);
  }
  for(const side of [-1,1])box(.42,.045,.25,brassTrim,side*1.50,1.10,6.23);
  box(3.55,.17,.24,velvet,0,DOOR_H+.05,6.23);
  // Dark acoustic lining on the entrance wall, either side of the passage.
  for(const side of [-1,1]){
    box(5.35,H,.07,cinemaWall,side*4.325,H/2,6.34);
    for(let row=0;row<5;row++)box(.09,1.72,1.35,dark(std('#241e29',1)),side*6.94,1.85,8.3+row*1.92);
  }
  box(3.30,H-DOOR_H,.07,cinemaWall,0,(H+DOOR_H)/2,6.34);
  // sopra l'atrio la parete d'ingresso sale fino al tetto del cinema, con il vano della cabina di proiezione
  // (models/proiettore.glb, più sotto): l'apertura è ±0,8 m e da BOOTH_Y-0,5 a BOOTH_Y+0,6, la chiude la cabina
  const BOOTH_Y=4.3,boothLow=BOOTH_Y-.5,boothHigh=BOOTH_Y+.6;
  box(14.6,boothLow-H,.07,cinemaWall,0,(boothLow+H)/2,6.34);
  box(14.6,CINEMA_H-boothHigh,.07,cinemaWall,0,(CINEMA_H+boothHigh)/2,6.34);
  for(const side of [-1,1])box(6.5,boothHigh-boothLow,.07,cinemaWall,side*4.05,(boothLow+boothHigh)/2,6.34);
  const rugMap=canvasTex(256,512,(g,w,h)=>{
    g.fillStyle='#502030';g.fillRect(0,0,w,h);
    for(const x of [9,17,w-18,w-10]){g.fillStyle='#b08b59';g.fillRect(x,0,2,h)}
    g.strokeStyle='#754050';g.lineWidth=2;
    for(let j=-1;j<9;j++)for(let i=0;i<4;i++){const x=35+i*61,y=j*64+(i%2)*32;g.beginPath();g.moveTo(x,y-17);g.lineTo(x+12,y);g.lineTo(x,y+17);g.lineTo(x-12,y);g.closePath();g.stroke()}
  });
  rugMap.wrapT=THREE.RepeatWrapping;rugMap.repeat.y=5;
  const aisleMat=dark(new THREE.MeshStandardMaterial({map:rugMap,roughness:1}));
  // Si entra in piano dalla Lobby (pianerottolo a quota 0), poi una rampa continua, senza gradini, scende di
  // CINEMA_DROP fino alla prima fila; davanti allo schermo il pavimento è in piano
  const RAMP0=7.285,RAMP1=15.44,rampLen=Math.hypot(RAMP1-RAMP0,CINEMA_DROP),rampTilt=Math.atan2(CINEMA_DROP,RAMP1-RAMP0);
  const rampMid=(RAMP0+RAMP1)/2;
  function cinemaFloor(x,z){
    if(Math.abs(x)>=7||z<RAMP0)return 0;
    if(z>=RAMP1)return -CINEMA_DROP;
    return -CINEMA_DROP*(z-RAMP0)/(RAMP1-RAMP0);
  }
  const tierCarpet=dark(std('#482435',.98));
  box(13.95,CINEMA_DROP,RAMP0-6.06,tierCarpet,0,-CINEMA_DROP/2,(6.06+RAMP0)/2); // pianerottolo d'ingresso
  plane(13.94,rampLen,tierCarpet,0,-CINEMA_DROP/2,rampMid,0,-Math.PI/2+rampTilt); // rampa
  // corsie: sul pianerottolo, sulla rampa e in piano davanti allo schermo
  for(const x of [0,-5.12,5.12]){
    const w=x===0?2.13:1.27;
    plane(w,RAMP0-6.55,aisleMat,x,.008,(6.55+RAMP0)/2,0,-Math.PI/2);
    plane(w,rampLen,aisleMat,x,.008-CINEMA_DROP/2,rampMid,0,-Math.PI/2+rampTilt);
    plane(w,17.35-RAMP1,aisleMat,x,.008-CINEMA_DROP,(RAMP1+17.35)/2,0,-Math.PI/2);
  }
  const amber=glow('#ffbb6b',1.5);
  for(const x of [-1.06,1.06]){
    box(.028,.015,RAMP0-6.35,amber,x,.014,(6.35+RAMP0)/2);
    box(.028,.015,rampLen,amber,x,.014-CINEMA_DROP/2,rampMid).rotation.x=rampTilt;
  }
  const cinemaSofas=[];
  for(let row=0;row<5;row++){
    const z=8.1+row*1.63;
    // per fila due divanetti doppi a sinistra e due a destra (4 posti per parte), vicini alla corsia centrale;
    // ognuno in piano, all'altezza della rampa
    for(const x of [-3.37,-1.85,1.85,3.37]){
      const level=cinemaFloor(x,z);
      const sofa=new THREE.Group();sofa.position.set(x,level,z);scene.add(sofa);cinemaSofas.push(sofa);
      // finché non arriva il divanetto in pelle nera fatto in Blender, una sagoma semplice
      const standIn=new THREE.Group();sofa.add(standIn);
      box(1.28,.19,.88,darkWood,0,.18,0,standIn);
      for(const off of [-.30,.30])box(.5,.16,.62,velvet,off,.42,-.07,standIn),box(.5,.66,.2,velvet,off,.82,-.33,standIn);
      for(const off of [-.66,.66])box(.15,.58,.86,velvet,off,.4,0,standIn);
      solid(x-.74,x+.74,z-.56,z+.51);
      spots.push({x,z,hx:.74,hz:.5,pad:.68,label:'Siediti · Cinema',sit:true,act:()=>app.sit?app.sit(app.projection()?.id):app.open('cinema-streamer')});
    }
  }
  // Applique del cinema di Blender (blender/applique_cinema.blend → models/applique_cinema.glb): mezzo cilindro di
  // bronzo con anelli d'ottone, luce che esce sopra e sotto; una tra ogni coppia di pannelli fonoassorbenti, 5 per
  // parete, a istanze. Sul muro un ventaglio di luce calda sopra e uno sotto; col film si abbassano.
  const sconceSpots=[];
  for(const z of [9.26,11.18,13.1,15.02,16.94])for(const side of [-1,1])sconceSpots.push([side*7.0,2.05,z,-side*Math.PI/2]);
  const washMat=new THREE.MeshBasicMaterial({
    map:canvasTex(64,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h,0,w/2,h,h);r.addColorStop(0,'rgba(255,190,120,.9)');r.addColorStop(.45,'rgba(255,160,90,.28)');r.addColorStop(1,'rgba(255,150,80,0)');g.fillStyle=r;g.fillRect(0,0,w,h)}),
    transparent:true,opacity:.165,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false
  });
  for(const [x,y,z,yaw] of sconceSpots){
    const off=Math.sign(x)*-.012;
    plane(.7,.9,washMat,x+off,y+.71,z,yaw);
    const down=plane(.7,.9,washMat,x+off,y-.71,z,yaw);down.rotation.z=Math.PI;
  }
  let sconceLight=null;
  new GLTFLoader().load(new URL('models/applique_cinema.glb',import.meta.url).href,gltf=>{
    gltf.scene.updateMatrixWorld(true);
    const up=new THREE.Vector3(0,1,0),one=new THREE.Vector3(1,1,1),q=new THREE.Quaternion(),m=new THREE.Matrix4();
    gltf.scene.traverse(o=>{
      if(!o.isMesh)return;
      if(o.material.name==='luce_applique'){sconceLight=o.material;o.material.toneMapped=false}
      const set=new THREE.InstancedMesh(o.geometry,o.material,sconceSpots.length);
      sconceSpots.forEach(([x,y,z,yaw],i)=>set.setMatrixAt(i,m.compose(new THREE.Vector3(x,y,z),q.setFromAxisAngle(up,yaw),one).multiply(o.matrixWorld)));
      scene.add(set);
    });
    setProjector(filmOn);
  });
  // divanetti reclinabili in pelle nera fatti in Blender (blender/divanetto.blend → models/divanetto.glb):
  // due posti con cuciture a canali, poggiatesta, braccioli con portabicchiere cromato e tasto di regolazione
  new GLTFLoader().load(new URL('models/divanetto.glb',import.meta.url).href,gltf=>{
    gltf.scene.traverse(o=>{if(!o.isMesh)return;dark(o.material);
      // pelle opaca: niente macchie di luce delle lampade di sala (le parti di metallo restano come sono)
      if(o.material.metalness<.5)o.material.roughness=Math.max(o.material.roughness,.85);
      if(o.material.name==='tasto'){o.material.emissive=new THREE.Color('#3a8cff');o.material.emissiveIntensity=.9}});
    for(const sofa of cinemaSofas){sofa.clear();sofa.add(gltf.scene.clone())}
  });
  // luci di sala basse, da cinema; col film in proiezione si abbassano ancora (setProjector)
  const hallLights=[point('#ffb782',2.4,0,2.55,10,11),point('#bac9f0',2.8,0,2.7,16,9)];
  const screenPleats=[];
  for(const side of [-1,1])for(let i=0;i<8;i++)screenPleats.push(box(.18,wallTall,.18,velvet,side*(4.06+i*.32),wallMidY,CINEMA_END-.42+(i%2)*.12));
  new GLTFLoader().load(new URL('models/tende.glb',import.meta.url).href,gltf=>{
    const door=gltf.scene.getObjectByName('tenda_porta'),wide=gltf.scene.getObjectByName('tenda_schermo');
    gltf.scene.traverse(o=>{if(o.isMesh){o.material.side=THREE.DoubleSide;o.material.color?.multiplyScalar(1.15)}});
    // ingresso: ogni pannello si apre ancora quando ci si avvicina (scala in larghezza)
    curtains.forEach((panel,i)=>{
      const side=i?1:-1,m=door.clone();m.position.set(0,.04,0);m.scale.x=-side;
      panel.geometry=new THREE.BufferGeometry();panel.add(m);
    });
    // tende colorate nei passaggi delle altre sale (stesso velluto, un colore per sala); si aprono avvicinandosi
    for(const [cx,cz,ry,color] of [[-7,0,Math.PI/2,'#5a1f96'],[7,0,Math.PI/2,'#1d6a3a'],[0,-6.23,0,'#1c4a9c']]){
      const tint=door.material.clone();tint.color.set(color);tint.side=THREE.DoubleSide;
      const panels=[];
      for(const side of [-1,1]){
        const pivot=new THREE.Group(),m=door.clone();m.material=tint;
        // lungo il muro: verso il centro della porta (il pannello è largo 1,15 m, la porta 2,6 m)
        const along=ry?new THREE.Vector3(0,0,side*(DOOR+.02)):new THREE.Vector3(side*(DOOR+.02),0,0);
        pivot.position.set(cx+along.x,.04,cz+along.z);pivot.rotation.y=ry;
        // Lascia una fessura al centro e registra il pivot per l'apertura di prossimità.
        m.scale.x=(ry?side:-side)*.74;
        pivot.add(m);
        scene.add(pivot);
        panels.push(pivot);
      }
      doorCurtains.push({cx,cz,panels});
    }
    // ai lati dello schermo: una tenda larga per parte al posto delle pieghe a blocchi
    for(const b of screenPleats)b.removeFromParent();
    // alte fino al tetto del cinema (il modello è alto quanto le altre stanze)
    // Tende ai lati dello schermo: velluto a pieghe alto dal pavimento al tetto, contro la parete dello schermo, dal
    // bordo dello schermo al muro. Fatte qui (il modello tenda_schermo era alto come le altre stanze e andava stirato).
    const wideMat=wide.material.clone();wideMat.side=THREE.DoubleSide;dark(wideMat);
    const curtainW=7-(SCREEN_W/2+.12),folds=11;
    const cloth=new THREE.PlaneGeometry(curtainW,wallTall,folds*10,30),cp=cloth.attributes.position;
    for(let k=0;k<cp.count;k++){
      const u=cp.getX(k)/curtainW+.5,v=cp.getY(k)/wallTall+.5;
      // pieghe più fitte in alto (arricciate al bastone), più morbide e larghe in basso; orlo appena mosso
      const depth=.07+.06*(1-v),wave=Math.sin(u*folds*2*Math.PI+.6*Math.sin(v*3.1))*depth;
      cp.setZ(k,wave+.02*Math.sin(u*37+v*5)*(1-v));
      if(v<.02)cp.setY(k,cp.getY(k)+.03*Math.sin(u*23));
    }
    cloth.computeVertexNormals();
    for(const side of [-1,1]){
      const m=new THREE.Mesh(cloth,wideMat),cx=side*(SCREEN_W/2+.12+curtainW/2);
      m.position.set(cx,wallMidY,CINEMA_END-.3);m.rotation.y=Math.PI;scene.add(m);
      solid(cx-curtainW/2,cx+curtainW/2,CINEMA_END-.55,CINEMA_END); // stanno contro il muro: non ci si entra
    }
  });
  box(SCREEN_W+.12,SCREEN_H+.135,.12,darkWood,0,SCREEN_Y,CINEMA_END-.47);
  // cinema spento: insegna con sipario di velluto e cornice déco dorata (cinema-sign.js)
  const standby=new THREE.MeshBasicMaterial({map:canvasTex(1024,576,drawCinemaSign),color:new THREE.Color(.85,.85,.85)});
  const screenMesh=plane(SCREEN_W,SCREEN_H,standby,0,SCREEN_Y,CINEMA_END-.56,Math.PI);
  const aperture=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,blending:THREE.NoBlending,depthWrite:false});
  const projection=document.createElement('div');
  projection.style.cssText='position:absolute;left:0;top:0;width:960px;height:540px;background:black;overflow:hidden;transform-origin:0 0;pointer-events:none';
  projection.hidden=true;host.prepend(projection);
  // Cabina di proiezione incassata sopra l'ingresso (blender/proiettore.blend → models/proiettore.glb): vano buio con
  // la finestrella e il vetro, dentro il proiettore digitale, inclinato verso il centro dello schermo. Col film in
  // proiezione (setProjector) si accendono obiettivo e lucina e parte il fascio di luce, largo quanto lo schermo.
  const lensPos=new THREE.Vector3(0,BOOTH_Y,6.375-.25),screenZ=CINEMA_END-.57;
  const lensTilt=Math.atan2(BOOTH_Y-SCREEN_Y,screenZ-lensPos.z);
  const beam=(()=>{
    const a=.04,b=.025,sw=SCREEN_W/2,sh=SCREEN_H/2,near=.3,far=.025;
    const lens=[[-a,-b],[a,-b],[a,b],[-a,b]].map(([x,y])=>[lensPos.x+x,lensPos.y+y,lensPos.z]);
    const wall=[[-sw,-sh],[sw,-sh],[sw,sh],[-sw,sh]].map(([x,y])=>[x,SCREEN_Y+y,screenZ]);
    const pos=[],col=[];
    for(let i=0;i<4;i++){
      const j=(i+1)%4;
      for(const [p,c] of [[lens[i],near],[wall[i],far],[wall[j],far],[lens[i],near],[wall[j],far],[lens[j],near]]){pos.push(...p);col.push(c*.85,c*.9,c)}
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    // disegnato prima dello schermo (renderOrder 5): sul film non si vede, il video resta pulito
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
    m.visible=false;m.renderOrder=4;scene.add(m);return m;
  })();
  let filmOn=false,lensMat=null,ledMat=null;
  // Il film anima il proiettore: 10 volte al secondo il video si copia in piccolo (128 × 72) su un canvas, specchiato,
  // che si vede dentro l'obiettivo (lensScreen); dal canvas si ricava il colore medio della scena, che dà colore e
  // forza al fascio, con passaggi morbidi e un leggero tremolio. Se il video non si può leggere (YouTube, o un
  // indirizzo di un altro sito) il fascio tremola da solo con una luce calda e l'obiettivo resta solo acceso.
  const lensCanvas=document.createElement('canvas');lensCanvas.width=128;lensCanvas.height=72;
  const lensCtx=lensCanvas.getContext('2d',{willReadFrequently:true});
  const lensTexture=new THREE.CanvasTexture(lensCanvas);lensTexture.colorSpace=THREE.SRGBColorSpace;
  const lensScreen=new THREE.Mesh(new THREE.CircleGeometry(.08,32),new THREE.MeshBasicMaterial({map:lensTexture,toneMapped:false}));
  lensScreen.visible=false;
  const beamTarget=new THREE.Color(1,.95,.85),beamNow=new THREE.Color(1,.95,.85);
  let filmVideo=null,filmReadable=false,lastSample=0,nextFlicker=0;
  function sampleFilm(){
    lensCtx.save();lensCtx.scale(-1,1);lensCtx.drawImage(filmVideo,-128,0,128,72);lensCtx.restore();
    const d=lensCtx.getImageData(0,0,128,72).data;
    let r=0,g=0,b=0;
    for(let i=0;i<d.length;i+=64){r+=d[i];g+=d[i+1];b+=d[i+2]}
    const n=d.length/64,lum=(r+g+b)/(3*255*n);
    // colore della scena, schiarito (la luce del proiettore è bianca) e più forte nelle scene chiare
    const k=.45+1.1*lum;beamTarget.setRGB((.55+.45*r/(255*n))*k,(.55+.45*g/(255*n))*k,(.55+.45*b/(255*n))*k);
    lensTexture.needsUpdate=true;
  }
  function projectorTick(now){
    if(!filmOn){loc.last=0;return}
    locandinaTick(now);
    if(now-lastSample>100){
      lastSample=now;
      if(filmVideo&&filmReadable&&filmVideo.readyState>=2){
        try{sampleFilm()}catch{filmReadable=false;lensScreen.visible=false}
      }else if(now>nextFlicker){
        // senza video leggibile: luce calda che cambia ogni tanto, come i cambi di scena
        nextFlicker=now+400+Math.random()*1200;const k=.6+Math.random()*.7;
        beamTarget.setRGB(k,k*(.9+Math.random()*.08),k*(.78+Math.random()*.15));
      }
    }
    beamNow.lerp(beamTarget,.18);
    const f=.96+Math.random()*.08; // tremolio della lampada
    beam.material.color.copy(beamNow).multiplyScalar(f);
    if(lensMat)lensMat.emissive.copy(beamNow);
  }
  function useFilm(video){
    filmVideo=video||null;filmReadable=false;lensScreen.visible=false;
    if(!filmVideo)return;
    try{lensCtx.drawImage(filmVideo,0,0,4,4);lensCtx.getImageData(0,0,1,1);filmReadable=true;lensScreen.visible=true}catch{}
  }
  // col film le luci di sala si abbassano ancora (la sala è già buia per i suoi materiali, vedi CINEMA_DIM)
  function setProjector(on){
    filmOn=on;beam.visible=on;if(!on)useFilm(null);
    if(lensMat)lensMat.emissiveIntensity=on?2.5:0;
    if(ledMat)ledMat.emissiveIntensity=on?2:.4;
    hallLights[0].intensity=on?1:2.4;hallLights[1].intensity=on?1.2:2.8;
    cinemaShade(on?.55:1); // col film, come quando la luce d'ambiente scendeva da 0,1 a 0,05
    washMat.opacity=on?.075:.165;if(sconceLight)sconceLight.emissiveIntensity=on?.15:.3; // applique basse (−70%)
  }
  new GLTFLoader().load(new URL('models/proiettore.glb',import.meta.url).href,gltf=>{
    const booth=gltf.scene;booth.position.set(0,BOOTH_Y,6.375);
    const pivot=new THREE.Group();pivot.position.set(0,0,-.25);pivot.rotation.x=lensTilt;booth.add(pivot);
    for(const name of ['proiettore_corpo','proiettore_lente','proiettore_led']){
      const part=booth.getObjectByName(name);if(!part)continue;part.position.z+=.25;pivot.add(part);
    }
    lensScreen.position.z=.006;pivot.add(lensScreen); // il film in piccolo, davanti alla lente
    booth.traverse(o=>{
      if(!o.isMesh)return;
      const n=o.material.name;
      if(n==='vetro'){o.material.transparent=true;o.material.opacity=.18;o.material.depthWrite=false}
      if(n==='cabina_interno')o.material=cinemaWall; // la cabina ha lo stesso colore delle pareti: niente riquadro
      if(n==='lente')lensMat=o.material;
      if(n==='led')ledMat=o.material;
    });
    scene.add(booth);setProjector(filmOn);
  });
  let previewKey='',hls=null,previewVideo=null,yt=null,disposeYT=null;
  let soundEnabled=true, audioContext=null, mediaNodes=[], audibleZone=false, mixEligible=false, cinemaGain=null;
  function unlockCinemaSound(){
    if(!active)return;
    try{audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume().then(()=>{if(mixEligible&&previewVideo)cinemaMix(previewVideo)}).catch(()=>{});else if(mixEligible&&previewVideo)cinemaMix(previewVideo)}catch{}
  }
  el.addEventListener('pointerdown',unlockCinemaSound);
  el.addEventListener('pointerup',unlockCinemaSound); // sul telefono l'audio si sblocca solo quando il dito si alza
  window.addEventListener('keydown',unlockCinemaSound);
  function volumeControl(label,key,fallback,onInput){
    const wrap=document.createElement('label'),input=document.createElement('input'),out=document.createElement('span');
    // sul telefono senza riquadro scuro, giallo come i tasti
    wrap.style.cssText=touch?'display:flex;align-items:center;gap:6px;color:#ffd77a;text-shadow:0 0 3px #000,0 1px 2px #000;font:600 13px system-ui':'display:flex;align-items:center;gap:6px;padding:5px 9px;background:#18151ded;color:white;border-radius:8px;font:12px system-ui';
    if(touch)label='🔊 '+label;
    wrap.append(document.createTextNode(label),input,out);input.type='range';input.min=0;input.max=100;input.style.width='80px';
    function read(){if(!key)return fallback;try{const v=localStorage.getItem(key);return v===null?fallback:Math.max(0,Math.min(1,Number(v)))}catch{return fallback}}
    function sync(){input.value=String(Math.round(read()*100));out.textContent=input.value+'%'}
    input.oninput=()=>{const v=Number(input.value)/100;try{if(key)localStorage.setItem(key,String(v))}catch{}out.textContent=input.value+'%';onInput(v)};
    sync();return {wrap,input,out,read,sync};
  }
  let cinemaLevel=1,heard=0,lastYT=-1;
  // volumi: sul telefono in cima alla colonna dei tasti, in basso a sinistra (compaiono solo vicino a chi suona)
  const mixPanel=document.createElement('div');mixPanel.style.cssText=touch?'display:grid;gap:4px;justify-items:start;order:1':'position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 48px);right:8px;display:grid;gap:4px';
  const cinemaVolume=volumeControl('Cinema','club3d-cinema-volume',.85,v=>{cinemaLevel=v;unlockCinemaSound()});
  const radioVolume=volumeControl('Radio','club3d-radio-volume',.7,v=>window.binottolandClubRadio?.setClubVolume(v));
  cinemaLevel=cinemaVolume.read();mixPanel.append(cinemaVolume.wrap,radioVolume.wrap);(touch?dock:el).append(mixPanel);
  // Avvisi dentro la 3D (prima gli errori finivano nella pagina sotto, coperta): un messaggio che resta qualche secondo
  // e, finché il collegamento della Lobby è caduto, «Riconnessione…» (gli altri si fermano: ora si capisce perché)
  const alerts=document.createElement('div');
  alerts.setAttribute('role','alert');
  alerts.style.cssText='position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--ui-safe-top,0px) + '+(touch?118:104)+'px);display:grid;gap:6px;justify-items:center;max-width:88vw;pointer-events:none;z-index:6';
  const noticeBox=document.createElement('div'),linkBox=document.createElement('div');
  const chip='padding:8px 14px;border-radius:12px;font:600 14px/1.35 system-ui,sans-serif;text-align:center;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.35)';
  noticeBox.style.cssText=chip+';background:rgba(150,28,40,.92)';linkBox.style.cssText=chip+';background:rgba(20,16,30,.85)';
  noticeBox.hidden=linkBox.hidden=true;linkBox.textContent='Riconnessione…';
  alerts.append(noticeBox,linkBox);el.append(alerts);
  let noticeTimer=0;
  // kind 'info': avviso neutro (scuro) invece che di errore (rosso)
  function notice(text,kind){noticeBox.textContent=String(text||'');noticeBox.hidden=!text;noticeBox.style.background=kind==='info'?'rgba(20,16,30,.85)':'rgba(150,28,40,.92)';clearTimeout(noticeTimer);if(text)noticeTimer=setTimeout(()=>{noticeBox.hidden=true},kind==='info'?3500:5000)}
  // la prima volta che il mouse si aggancia alla vista: come si libera (non era scritto da nessuna parte)
  let escHint=false;
  document.addEventListener('pointerlockchange',()=>{if(active&&!escHint&&document.pointerLockElement){escHint=true;notice('Esc libera il mouse','info')}});
  function connection(on){linkBox.hidden=!!on}
  window.addEventListener('club-volume-change',radioVolume.sync);
  // Keep direct sound in stereo; short, asymmetric reflections widen the room.
  function cinemaMix(video){
    if(!audioContext||mediaNodes.length)return;
    const ctx=audioContext;
    const source=ctx.createMediaElementSource(video),bass=ctx.createBiquadFilter(),limiter=ctx.createDynamicsCompressor();
    // volume del film come regolatore di Web Audio: su iPhone il volume dell'elemento video resta sempre al massimo
    cinemaGain=ctx.createGain();cinemaGain.gain.value=THREE.MathUtils.clamp(heard,0,1);video.volume=1;
    bass.type='lowshelf';bass.frequency.value=145;bass.gain.value=3;
    limiter.threshold.value=-9;limiter.ratio.value=5;
    source.connect(cinemaGain);cinemaGain.connect(bass);bass.connect(limiter);limiter.connect(ctx.destination);
    mediaNodes.push(source,cinemaGain,bass,limiter);
    for(const [seconds,pan,level] of [[.023,-.83,.18],[.037,.84,.15],[.067,-.4,.07]]){
      const delay=ctx.createDelay(.1),gain=ctx.createGain(),speaker=ctx.createStereoPanner();
      delay.delayTime.value=seconds;gain.gain.value=level;speaker.pan.value=pan;
      bass.connect(delay);delay.connect(gain);gain.connect(speaker);speaker.connect(limiter);
      mediaNodes.push(delay,gain,speaker);
    }
  }
  function stopProjection(){
    mixEligible=false;disposeYT?.();disposeYT=null;yt=null;
    mediaNodes.forEach(node=>node.disconnect());mediaNodes=[];projection.style.zIndex='';
    lastYT=-1;previewKey='';screenMesh.material=standby;projection.hidden=true;setProjector(false);
    hls?.destroy();hls=null;
    if(previewVideo){previewVideo.pause();previewVideo.srcObject=null;previewVideo.removeAttribute('src');previewVideo.load();previewVideo=null}
    projection.replaceChildren();
  }
  let currentProgram=null,playbackVersion='';
  function syncTransport(force=false){
    const p=currentProgram;if(!p)return;
    const play=p.playback;
    const version=JSON.stringify([play?.playing,play?.seek,play?.playRevision,play?.updated]);
    if(!force && playbackVersion===version)return;
    const seconds=(play?.position||0)+(play?.playing&&play.updated?Math.max(0,(Date.now()-play.updated)/1000):0);
    if(yt){
      if(play&&!p.live && Math.abs((yt.getCurrentTime?.()||0)-seconds)>.8)yt.seekTo(seconds,true);
      if(play?.playing===false)yt.pauseVideo();else yt.playVideo();
    }else if(previewVideo?.readyState>=2){
      const v=previewVideo;
      if(play&&!p.live&&Math.abs(v.currentTime-seconds)>.8&&Number.isFinite(v.duration))v.currentTime=Math.min(seconds,v.duration);
      if(play?.playing===false)v.pause();
      else if(v.paused)v.play().catch(()=>{if(v===previewVideo){v.muted=true;v.play().catch(()=>{})}});
    }else return;
    playbackVersion=version;
  }
  function quietProjection(){
    heard=0;audibleZone=false;
    if(previewVideo){previewVideo.volume=0;previewVideo.muted=true}
    if(yt){yt.setVolume(0);yt.mute();lastYT=0}
  }
  let clubInRange=false;
  let projectionReady='',filmAwayAt=0,asleep=false;
  // Il film si scarica e si decodifica solo in sala cinema o davanti alla porta (clubInRange), con la 3D aperta e
  // l'app in primo piano; uscendo resta 3 secondi (per non ripartire da capo sulla soglia) e poi si ferma e si libera.
  // Prima girava ovunque nella Lobby, già durante lo splash, e con l'app nascosta era solo azzittito.
  function filmWanted(){
    if(!active||document.hidden||asleep){filmAwayAt=0;return false}
    if(clubInRange){filmAwayAt=0;return true}
    if(!previewKey)return false;
    const now=performance.now();if(!filmAwayAt)filmAwayAt=now;
    return now-filmAwayAt<3000;
  }
  function playProjection(data){
    if(!filmWanted())data=null;
    const share=data?.screenId;
    const stream=app.clubStream?.(share&&active&&clubInRange&&!document.hidden?data:null);
    const p=share?(stream?{live:true,share,stream}:null):data?.projection;
    const play=p?.playback;
    currentProgram=p;
    const key=p?JSON.stringify([data.id,p.share,p.url,p.youtube]):'';
    if(key===previewKey&&(!stream||previewVideo?.srcObject===stream)){syncTransport();return}
    playbackVersion='';
    stopProjection();if(!key)return;
    previewKey=key;
    const ready=()=>{if(previewKey===key){projection.hidden=false;screenMesh.material=aperture;screenMesh.renderOrder=5;projectionReady=key;setProjector(true);useFilm(previewVideo)}};
    if(p.youtube&&/^[\w-]{11}$/.test(p.youtube)){
      disposeYT=embedYouTube(projection,p.youtube,{
        ready(player){
          yt=player;const frame=projection.querySelector('iframe');if(frame)frame.style.cssText='width:100%;height:100%;border:0';
          ready();player.setVolume(Math.round(heard*100));if(soundEnabled&&audibleZone)player.unMute();else player.mute();
          syncTransport(true);
        },
        state(){},blocked(){if(!soundEnabled)return;soundEnabled=false;yt?.mute();if(currentProgram?.playback?.playing!==false)yt?.playVideo()},error(){screenMesh.material=standby}
      });return;
    }
    const v=document.createElement('video');previewVideo=v;v.volume=heard;v.muted=!(soundEnabled&&audibleZone);v.playsInline=true;v.autoplay=play?.playing!==false;
    v.style.cssText='width:100%;height:100%;object-fit:contain';projection.append(v);
    v.onloadeddata=()=>{if(v===previewVideo){ready();syncTransport(true)}};
    if(stream){v.srcObject=stream;return}
    const canMix=()=>{mixEligible=true;try{if(audioContext?.state==='running')cinemaMix(v)}catch{}};
    if(new URL(p.url,location.href).origin===location.origin)canMix();
    if(/\.m3u8?(?:[?#]|$)/i.test(p.url)&&!v.canPlayType('application/vnd.apple.mpegurl')){
      window.binottolandClubRadio?.loadHls().then(Hls=>{
        if(previewVideo!==v||!Hls.isSupported())return;
        canMix();hls=new Hls({backBufferLength:10});hls.loadSource(p.url);hls.attachMedia(v);
      }).catch(()=>{});
    }else v.src=p.url;
  }
  const mediaTransform=new THREE.Matrix4(),pixelPlane=new THREE.Matrix4(),viewport=new THREE.Matrix4();
  function alignProjection(){
    if(projection.hidden)return;
    const w=host.clientWidth/2,h=host.clientHeight/2;
    screenMesh.getWorldPosition(tmp);tmp.project(camera);
    // schermo alle spalle: il film continua (si sente) ma non si vede da nessuna parte (niente riquadro piccolo)
    const behind=tmp.z>1||tmp.z< -1;
    projection.style.visibility=behind?'hidden':'';
    if(behind)return;
    pixelPlane.set(SCREEN_W/960,0,0,-SCREEN_W/2,0,-SCREEN_H/540,0,SCREEN_H/2,0,0,1,0,0,0,0,1);
    viewport.set(w,0,0,w,0,-h,0,h,0,0,1,0,0,0,0,1);
    camera.updateMatrixWorld();screenMesh.updateMatrixWorld();
    mediaTransform.copy(viewport).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(screenMesh.matrixWorld).multiply(pixelPlane);
    projection.style.transform='matrix3d('+mediaTransform.elements.join(',')+')';
  }

  // Locandina fuori dal cinema, nell'atrio (parete della porta del cinema, tra la porta e l'applique). Mostra il
  // titolo di quello che si proietta (canale, file, finestra condivisa) e, dopo 10 secondi di film continui sullo
  // stesso canale, un fotogramma preso dal video (con YouTube la copertina, se il sito la lascia leggere). Resta così
  // anche uscendo dal cinema; torna quella di base quando non si proietta niente.
  const locMap=poster(3.3,5.94,Math.PI,'CINEMA','PROIEZIONE IN SALA',['#442333','#ffe2ab','#c58461'],'film');
  const loc={key:'',title:null,youtube:null,played:0,shot:false,last:0};
  function drawLocandina(image){
    const g=locMap.image.getContext('2d'),w=384,h=512,cream='#ffe2ab';
    g.fillStyle='#442333';g.fillRect(0,0,w,h);g.strokeStyle=cream;g.lineWidth=3;g.strokeRect(14,14,w-28,h-28);
    g.textAlign='center';g.textBaseline='alphabetic';
    if(image){
      const bx=32,by=78,bw=320,bh=180,iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;
      const s=Math.max(bw/iw,bh/ih);
      g.save();g.beginPath();g.rect(bx,by,bw,bh);g.clip();g.drawImage(image,bx+(bw-iw*s)/2,by+(bh-ih*s)/2,iw*s,ih*s);g.restore();
      g.strokeStyle='#c58461';g.lineWidth=4;g.strokeRect(bx,by,bw,bh);
    }else{
      // bobine, come la locandina di prima
      g.save();g.translate(192,loc.title?170:210);g.rotate(-.17);
      for(const x of [-61,61]){g.fillStyle=cream;g.beginPath();g.arc(x,-22,54,0,7);g.fill();for(let i=0;i<5;i++){g.fillStyle='#442333';g.beginPath();g.arc(x+28*Math.cos(i*1.256),-22+28*Math.sin(i*1.256),9,0,7);g.fill()}}
      g.fillStyle='#c58461';g.fillRect(-90,39,177,66);g.restore();
    }
    g.fillStyle=cream;
    if(!loc.title){g.font='900 44px Arial';g.fillText('CINEMA',192,378,338);g.font='bold 21px monospace';g.fillText('PROIEZIONE IN SALA',192,430,338)}
    else{
      g.font='bold 20px monospace';g.fillText('ORA IN PROIEZIONE',192,image?56:62,338);
      // titolo su due righe al massimo, il più grande che ci sta
      const words=String(loc.title).split(/\s+/);let size=40,lines;
      for(;size>=20;size-=2){
        g.font='900 '+size+'px Arial';lines=[''];
        for(const word of words){const t=(lines.at(-1)+' '+word).trim();if(g.measureText(t).width<=330)lines[lines.length-1]=t;else lines.push(word)}
        if(lines.length<=2&&lines.every(l=>g.measureText(l).width<=330))break;
      }
      lines=lines.slice(0,2);lines.forEach((l,i)=>g.fillText(l,192,330+i*(size+6)+(lines.length===1?18:0),338));
      g.font='bold 18px monospace';g.fillText('SALA CINEMA · BINOTTOLAND',192,450,338);
    }
    locMap.needsUpdate=true;
  }
  function locandina(data){
    const key=data?JSON.stringify([data.id,data.channel,data.screenId,data.projection?.url,data.projection?.youtube]):'';
    if(key===loc.key)return;
    loc.key=key;loc.title=data?(data.channel||'Proiezione in sala'):null;loc.youtube=data?.projection?.youtube||null;
    loc.played=0;loc.shot=false;loc.last=0;drawLocandina(null);
  }
  // chiamata da projectorTick mentre il film è in proiezione: conta i secondi continui, poi il fotogramma
  function locandinaTick(now){
    if(loc.shot||!loc.key){loc.last=0;return}
    if(loc.last)loc.played+=Math.min(now-loc.last,250);
    loc.last=now;
    if(loc.played<10000)return;
    loc.shot=true;
    if(filmVideo&&filmReadable&&filmVideo.readyState>=2){try{drawLocandina(filmVideo)}catch{drawLocandina(null)}return}
    if(/^[\w-]{11}$/.test(loc.youtube||'')){
      const img=new Image(),key=loc.key;img.crossOrigin='anonymous';
      // prima su una tela a parte: se l'immagine non si lascia leggere non tocca la locandina (resterebbe bloccata)
      img.onload=()=>{
        if(loc.key!==key)return;
        try{const t=document.createElement('canvas').getContext('2d');t.drawImage(img,0,0,2,2);t.getImageData(0,0,1,1);drawLocandina(img)}catch{}
      };
      img.src='https://i.ytimg.com/vi/'+loc.youtube+'/hqdefault.jpg';
    }
  }
  drawLocandina(null);

  // Macchinette dell'atrio, contro la parete del cinema (docs/macchinetta.md): a destra della porta caffè e snack
  // (vending.js, models/macchinetta.glb), a sinistra, tra la pianta e il divano, il carrello dei popcorn e della Binotto
  // Cola (popcorn.js, models/popcorn.glb). «Usa (E)»: la visuale va davanti e si toccano i tasti; il prodotto pronto si
  // prende toccandolo. Una persona alla volta: chi la usa lo dice nella posa (use: macchinetta, scelta, ordini, prese),
  // il server la lascia al primo (club-machines.js) e tutti vedono sulla loro macchinetta quello che fa.
  // In mano: lo snack o il cartoccio nella destra («Mangia», F), la cola nella sinistra («Bevi», B); seduti al cinema
  // la cola sta nel portabicchiere del bracciolo. Anche questo viaggia nella posa (snack, drink).
  const VEND={x:6.15,z:5.22},POP={x:-5.475,z:5.62},HELD_SCALE=2.2,CUP_SCALE=1.4; // in mano più grandi del vero: i personaggi sono a blocchi
  let vend=null,vendGltf=null,pop=null,popGltf=null,vendMode=false,atMachine=null,held=null,heldBites=0,drink=null,drinkSips=0,mySip=9;
  let useN=0,useT=0,useK=''; // alla macchinetta che stai usando: ordini fatti, prodotti presi, ultima scelta
  const vendSound=vendingSounds(()=>soundAllowed()&&audioContext?.state==='running'?audioContext:null);
  // i suoni di una macchinetta usata da un altro si sentono solo da vicino
  const nearSound=at=>name=>{if(vendMode||Math.hypot(pos.x-at.x,pos.z-at.z)<7)vendSound(name)};
  solid(VEND.x-.57,VEND.x+.57,VEND.z,6.0);
  spots.push({x:VEND.x,z:VEND.z-.3,hx:.55,hz:.2,pad:.7,label:'Macchinetta',where:'Lobby',vend:true,machine:'vend',act:()=>{}});
  solid(POP.x-.43,POP.x+.43,POP.z-.3,6.0);
  spots.push({x:POP.x,z:POP.z-.42,hx:.45,hz:.14,pad:.7,label:'Popcorn',where:'Lobby',vend:true,machine:'pop',act:()=>{}});
  new GLTFLoader().load(new URL('models/macchinetta.glb',import.meta.url).href,gltf=>{
    vendGltf=gltf;vend=createVending(gltf,'grafite',{sound:nearSound(VEND)});
    vend.root.position.set(VEND.x,0,VEND.z);vend.root.rotation.y=Math.PI;scene.add(vend.root);
    vend.onChange(e=>{if(atMachine==='vend'&&e.state==='scende'){useN++;useK=e.order||''}});
  });
  new GLTFLoader().load(new URL('models/popcorn.glb',import.meta.url).href,gltf=>{
    popGltf=gltf;pop=createPopcorn(gltf,{sound:nearSound(POP)});
    pop.root.position.set(POP.x,0,POP.z);pop.root.rotation.y=Math.PI;scene.add(pop.root);
    pop.onChange(e=>{if(atMachine==='pop'&&e.state==='prepara'){useN++;useK=e.key||''}});
  });
  const machineOf=m=>m==='pop'?pop:vend;
  const vendExit=document.createElement('button'),eatButton=document.createElement('button'),drinkButton=document.createElement('button');
  vendExit.textContent='Esci'+(touch?'':' (Esc)');vendExit.hidden=eatButton.hidden=drinkButton.hidden=true;
  // sul computer «Mangia» e «Bevi» stanno sopra il tasto d'azione, così non si coprono
  for(const [b,up] of [[vendExit,8],[eatButton,60],[drinkButton,112]])b.style.cssText=touch?'order:3':'position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + '+up+'px);left:50%;transform:translateX(-50%);white-space:nowrap';
  (touch?dock:el).append(vendExit,eatButton,drinkButton);
  // chi sta usando una macchinetta (un altro): il suo nome, o null
  function machineBusy(m){for(const c of peers.values())if(c.useWanted?.m===m)return c.userName||'un amico';return null}
  function enterMachine(m){
    const machine=machineOf(m);
    if(!machine||machineBusy(m)||(m==='vend'&&held))return;
    if(document.pointerLockElement)document.exitPointerLock?.();
    atMachine=m;useK='';
    vendMode=true;resetMovement();me.root.visible=false;actB.hidden=true;stick.hidden=true;vendExit.hidden=false;near=null;
  }
  function exitVend(){
    if(!vendMode)return;
    // andando via senza prendere il prodotto, la macchinetta torna libera e pronta per il prossimo
    const machine=machineOf(atMachine);if(machine&&machine.state()!=='scegli')machine.reset();
    vendMode=false;atMachine=null;vendExit.hidden=true;me.root.visible=true;stick.hidden=!touch;near=null;restoreActivityView();
  }
  vendExit.onclick=exitVend;
  // un tocco sulla macchinetta: tasto, bevanda, oppure il prodotto pronto
  const vendRay=new THREE.Raycaster(),vendNDC=new THREE.Vector2();
  el.addEventListener('pointerdown',e=>{
    const machine=machineOf(atMachine);
    if(!vendMode||!machine||e.target.tagName!=='CANVAS')return;
    e.stopPropagation();e.preventDefault();
    const b=host.getBoundingClientRect();vendNDC.set(2*(e.clientX-b.left)/b.width-1,1-2*(e.clientY-b.top)/b.height);
    vendRay.setFromCamera(vendNDC,camera);
    const hit=vendRay.intersectObject(machine.root,true)[0];if(!hit)return;
    if(atMachine==='pop'){
      // le mani: il cartoccio va nella destra, la cola nella sinistra; se sono già piene, il tasto non parte
      let o=hit.object;while(o&&!o.userData.popcorn)o=o.parent;
      const v=o?.userData.popcorn;if(!v)return;
      if(v.type==='key'&&pop.state()==='scegli'&&((v.key!=='cola'&&held)||(v.key!=='popcorn'&&drink))){vendSound('errore');return}
      pop.hit(hit.object);
      if(v.type==='item'){const got=pop.take();if(got){useT++;for(const p of got)p.id==='popcorn'?holdPopcorn():holdCola();exitVend()}}
      return;
    }
    const readyMesh=vend.ready()?.mesh;let onReady=false;
    for(let q=hit.object;q;q=q.parent)if(q===readyMesh)onReady=true;
    const v=vend.hit(hit.object);
    if(onReady||v?.type==='flap'||v?.type==='cup'){const product=vend.take();if(product){useT++;holdProduct(makeHeld(vendGltf,product));exitVend()}}
  },true);
  function holdProduct(item){
    held=item;heldBites=0;held.group.scale.setScalar(HELD_SCALE);scene.add(held.group);
    const product=item.product;
    eatButton.textContent=(product.pack?'Mangia':'Bevi')+' · '+product.name+(touch?'':' (F)');eatButton.hidden=false;
  }
  const holdPopcorn=()=>popGltf&&holdProduct(makeHeldPopcorn(popGltf));
  function holdCola(){
    if(!popGltf)return;
    drink=makeHeldCola(popGltf);drinkSips=0;drink.group.scale.setScalar(HELD_SCALE);scene.add(drink.group);
    drinkButton.textContent='Bevi · '+drink.product.name+(touch?'':' (B)');drinkButton.hidden=false;
  }
  function eat(){
    if(!held||!held.left())return;
    const left=held.bite();heldBites++;vendSound(held.product.pack?'morso':'sorso');
    (me.fx||(me.fx={crouch:0,guard:0,punch:9,starsUntil:0})).bite=0;
    if(!left){const done=held;held=null;eatButton.hidden=true;setTimeout(()=>done.group.removeFromParent(),450)}
  }
  eatButton.onclick=eat;
  function drinkCola(){
    if(!drink||!drink.left())return;
    const left=drink.bite();drinkSips++;vendSound('sorso');mySip=0;
    (me.fx||(me.fx={crouch:0,guard:0,punch:9,starsUntil:0})).sip=0;
    if(!left){const done=drink;drink=null;drinkButton.hidden=true;setTimeout(()=>done.group.removeFromParent(),700)}
  }
  drinkButton.onclick=drinkCola;
  // il prodotto segue la mano del personaggio (0 la destra, 1 la sinistra): in piedi, dritto, girato come lui
  const handPoint=new THREE.Vector3();
  function toHand(c,group,hand=0){
    c.elbows[hand].updateWorldMatrix(true,false);
    handPoint.set(0,-.3,.12);c.elbows[hand].localToWorld(handPoint);
    group.position.set(handPoint.x,handPoint.y-.1,handPoint.z);group.rotation.set(0,c.root.rotation.y,0);
    group.visible=c.root.visible;
  }
  // portabicchiere del divanetto del cinema più vicino, dalla parte del posto (models/divanetto.glb: braccioli a
  // ±0,665 m, 64 cm d'altezza, 18 cm verso lo schermo)
  const holderPoint=new THREE.Vector3();
  function holderAt(x,z){
    let best=null,bd=1e9;
    for(const s of cinemaSofas){const d=Math.hypot(s.position.x-x,s.position.z-z);if(d<bd){bd=d;best=s}}
    if(!best||bd>1.2)return null;
    return holderPoint.set(best.position.x+(x>=best.position.x?.665:-.665),best.position.y+.632,best.position.z+.18);
  }
  // la cola nel portabicchiere; a ogni sorso sale per un attimo verso la bocca (sip = secondi dal sorso)
  const mouth=new THREE.Vector3();
  function cupInHolder(group,at,sip,head){
    group.scale.setScalar(CUP_SCALE);group.rotation.set(0,Math.PI,0);group.position.copy(at);group.visible=true;
    if(sip<1.2&&head){const k=Math.sin(Math.min(1,sip/1.2)*Math.PI);group.position.lerp(head,k*.85)}
  }
  const seatedCup=()=>!!(seating&&seating.sit&&drink);
  const heldPose=()=>({
    ...(held&&held.left()?{snack:{id:held.product.id,left:held.left(),n:heldBites}}:{}),
    ...(drink&&drink.left()?{drink:{id:'cola',left:drink.left(),n:drinkSips,...(seatedCup()?{cup:1}:{})}}:{}),
    ...(atMachine?{use:{m:atMachine,k:atMachine==='vend'&&vend?.state()==='scegli'?vend.typed():useK,n:useN,t:useT}}:{})
  });
  const PRODUCTS=new Map([...SNACKS,...DRINKS].map(p=>[p.id,p]));
  const heldFor=id=>id==='popcorn'?(popGltf?makeHeldPopcorn(popGltf):null):PRODUCTS.has(id)&&vendGltf?makeHeld(vendGltf,PRODUCTS.get(id)):null;
  // gli altri: il prodotto in mano come nella loro posa; a ogni morso nuovo il braccio sale alla bocca
  function peerSnack(c){
    const want=c.snackWanted;
    if(c.snack&&(!want||c.snack.product.id!==want.id)){c.snack.group.removeFromParent();c.snack=null}
    if(want&&!c.snack){c.snack=heldFor(want.id);if(c.snack){c.snack.group.scale.setScalar(HELD_SCALE);scene.add(c.snack.group);c.snackN=want.n}}
    if(!c.snack)return;
    if(want.n!==c.snackN){c.snackN=want.n;(c.fx||(c.fx={crouch:0,guard:0,punch:9,starsUntil:0})).bite=0}
    while(c.snack.left()>want.left)c.snack.bite();
    c.snack.update(peerDt);toHand(c,c.snack.group);
  }
  function peerDrink(c){
    const want=c.drinkWanted;
    if(c.drink&&!want){c.drink.group.removeFromParent();c.drink=null}
    if(want&&!c.drink&&popGltf){c.drink=makeHeldCola(popGltf);scene.add(c.drink.group);c.drinkN=want.n;c.sip=9}
    if(!c.drink)return;
    if(want.n!==c.drinkN){c.drinkN=want.n;c.sip=0;(c.fx||(c.fx={crouch:0,guard:0,punch:9,starsUntil:0})).sip=0}
    c.sip=(c.sip??9)+peerDt;
    while(c.drink.left()>want.left)c.drink.bite();
    c.drink.update(peerDt);
    const at=want.cup&&c.pose?.station==='seat'?holderAt(c.pose.x,c.pose.z):null;
    if(at){c.head.updateWorldMatrix(true,false);c.head.getWorldPosition(mouth);mouth.y-=.05;cupInHolder(c.drink.group,at,c.sip,mouth)}
    else{c.drink.group.scale.setScalar(HELD_SCALE);toHand(c,c.drink.group,1)}
  }
  // le macchinette usate dagli altri: la tua fa quello che fa la loro (scelte, prodotto che scende, preso)
  const remote={vend:null,pop:null};
  function peerMachines(){
    for(const m of ['vend','pop']){
      const machine=machineOf(m);if(!machine)continue;
      let user=null;for(const c of peers.values())if(c.useWanted?.m===m){user=c;break}
      if(atMachine===m){
        remote[m]=null;
        // l'ha presa un altro un attimo prima: si lascia a lui
        if(user){exitVend();notice('La sta usando '+(user.userName||'un amico'),'info')}
        continue;
      }
      const u=user?.useWanted,r=remote[m];
      if(!u){if(r){remote[m]=null;if(machine.state()!=='scegli')machine.reset()}continue}
      if(!r||r.who!==user){remote[m]={who:user,n:u.n,t:u.t};continue} // si comincia a guardare da adesso
      if(u.n!==r.n){r.n=u.n;if(machine.state()!=='scegli')machine.reset();machine.play(u.k)}
      else if(m==='vend'&&machine.state()==='scegli')machine.typing(u.k);
      if(u.t!==r.t){r.t=u.t;machine.take()}
    }
  }
  // Reception counter and tabletop receiver on the east side of the atrium.
  const counterX=5.95,counterZ=-3.35;
  // il mobile della radio: credenza di noce anni '60 con ante a doghe, gambe affusolate e filo d'ottone
  // (blender/credenza_radio.blend → models/credenza_radio.glb, stile «Circolo»); finché non arriva, la scatola di prima
  const counterStandIn=[box(1.14,.9,2.15,walnut,counterX,.45,counterZ),box(1.25,.09,2.29,brassTrim,counterX,.94,counterZ)];
  new GLTFLoader().load(new URL('models/credenza_radio.glb',import.meta.url).href,gltf=>{
    const credenza=gltf.scene;credenza.position.set(counterX,0,counterZ);credenza.rotation.y=-Math.PI/2; // ante verso la stanza
    credenza.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    scene.add(credenza);for(const o of counterStandIn)scene.remove(o);
  });
  solid(counterX-.63,counterX+.63,counterZ-1.15,counterZ+1.15);
  const receiver=new THREE.Group();receiver.position.set(counterX,1.00,counterZ);receiver.rotation.y=-Math.PI/2;scene.add(receiver);
  // radio vintage fatta in Blender (blender/radio.blend → models/radio.glb): cupola in legno, griglia in stoffa,
  // quadrante illuminato, manopole godronate e antenna; finché non arriva, una sagoma semplice
  const radioStandIn=box(.89,.44,.25,walnut,0,.22,0,receiver);
  new GLTFLoader().load(new URL('models/radio.glb',import.meta.url).href,gltf=>{
    gltf.scene.traverse(o=>{if(o.isMesh&&o.material.name==='rd_dial'){o.material.emissive=new THREE.Color('#ffa040');o.material.emissiveIntensity=1.4;o.material.toneMapped=false}});
    receiver.remove(radioStandIn);receiver.add(gltf.scene);
  });
  spots.push({x:counterX-.64,z:counterZ,hx:.05,hz:.97,pad:.88,label:'Radio del bancone',radio:true,act:()=>app.tune?.()});
  // ========== SALA ARCADE (x -19…-7) ==========
  const list = ARCADE.filter(([k]) => avail.has(k));
  list.push(['ruggine-89','Ruggine 89','#ffb448']);
  const known = new Set([...ARCADE,...BOARD].map(([key])=>key).concat(['ruggine-89','biliardo','lavagna-spazio-libero','cinema-streamer']));
  for(const key of avail)if(key&&!known.has(key))list.push([key,key.replaceAll('-',' '),'#82becd']);
  let tableLevel=.8,tableRoomGain=0,tableBus=null;
  const tableVolume=volumeControl('Calcio balilla · tutti',null,.8,v=>{tableLevel=v;unlockCinemaSound()});
  function setTableVolume(percent){
    tableLevel=percent/100;tableVolume.input.value=String(percent);tableVolume.out.textContent=percent+'%';
  }
  setTableVolume(app.tableVolume?.()??80);
  tableVolume.input.onchange=()=>app.balillaSend?.({type:'table-volume',percent:Number(tableVolume.input.value)});
  mixPanel.append(tableVolume.wrap);
  // Suoni del calcio balilla, più forti o più piano secondo il colpo (power 0…1):
  // piede = plastica dura "toc", sponda = legno sordo, palo = metallo, gol = colpo in fondo e palla che scende nel canale,
  // rimessa = palla che cade nel foro e rotola.
  let tableNoise=null;
  function tableSound(type,power=.6){
    const ctx=audioContext;if(!active||!tableRoomGain||!soundAllowed()||ctx?.state!=='running')return;
    if(!tableBus){tableBus=ctx.createGain();tableBus.connect(ctx.destination)}
    tableBus.gain.value=tableLevel*tableRoomGain;
    // suoni veri registrati al tavolo (finché non sono caricati resta il suono sintetizzato qui sotto)
    const intensity=THREE.MathUtils.clamp(power,0,1);
    const p=.035+.965*Math.pow(intensity,1.3);
    if(playBalillaSound(ctx,tableBus,type,p))return;
    if(!tableNoise){
      tableNoise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.3),ctx.sampleRate);
      const d=tableNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    const now=ctx.currentTime;
    const hit=(freq,q,decay,level,delay=0)=>{
      const src=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),g=ctx.createGain();
      src.buffer=tableNoise;bp.type='bandpass';bp.frequency.value=freq;bp.Q.value=q;
      g.gain.setValueAtTime(Math.max(.0002,level),now+delay);g.gain.exponentialRampToValueAtTime(.0001,now+delay+decay);
      src.connect(bp).connect(g).connect(tableBus);src.onended=()=>{src.disconnect();bp.disconnect();g.disconnect()};
      src.start(now+delay,Math.random()*.1);src.stop(now+delay+decay+.02);
    };
    const tone=(hz,decay,level,delay=0)=>{
      const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='sine';
      osc.frequency.setValueAtTime(hz,now+delay);osc.frequency.exponentialRampToValueAtTime(hz*.7,now+delay+decay);
      g.gain.setValueAtTime(Math.max(.0002,level),now+delay);g.gain.exponentialRampToValueAtTime(.0001,now+delay+decay);
      osc.connect(g).connect(tableBus);osc.onended=()=>{osc.disconnect();g.disconnect()};osc.start(now+delay);osc.stop(now+delay+decay+.02);
    };
    if(type==='kick'){hit(2600,2.5,.022,.32*p);hit(950,5,.045,.22*p);tone(460,.035,.07*p)}
    else if(type==='stop'){hit(1600,4,.018,.11*p);tone(320,.03,.05*p)}
    else if(type==='rail'){hit(520,3.5,.075,.28*p);tone(170,.09,.11*p)}
    else if(type==='post'){hit(1900,12,.14,.17*p);tone(1180,.18,.06*p);tone(2650,.12,.025*p)}
    else if(type==='goal'){
      hit(320,2.5,.14,.5*p);tone(105,.16,.2*p);
      for(let i=0;i<8;i++)hit(1450-i*70,6,.03,.11*p*(1-i/9),.2+i*.075+Math.random()*.02);
    }else if(type==='throw'){
      hit(1300,6,.03,.12,0);hit(1200,6,.03,.09,.06);hit(800,3,.18,.06,.1);
    }else hit(900,4,.04,.15*p);
  }
  const tableFootball=buildBalilla(scene,el,app.balillaSend,tableSound);
  // flipper "Binottoland Grand Prix" (cabinet fatto in Blender, gioco in ../flipper/physics.js)
  // due flipper uno accanto all'altro: Grand Prix (F1) e Binotto GT (endurance), ognuno con la sua classifica.
  // "pinball" è quello a cui stai giocando (o il Grand Prix se non giochi): il resto della Lobby parla con lui
  const tables={gp:null,gt:null};
  for(const kind of ['gp','gt'])tables[kind]=buildFlipper(scene,el,{kind,audio:()=>audioContext,allowed:soundAllowed,top:()=>app.pinballTop?.(kind)||[],sendScore:score=>app.pinballScore?.(score,kind),sendStart:()=>app.pinballStart?.(kind),me:()=>app.me?.()});
  let pinballKind='gp';
  const pinball=new Proxy({},{get:(_,k)=>{const t=tables[pinballKind];const v=t[k];return typeof v==='function'?v.bind(t):v}});
  // volume dei flipper nel mixer (compare avvicinandosi) e, sul telefono, la X in alto a destra per lasciarli
  const pinballVolume=volumeControl('Flipper','club3d-flipper-volume',.8,v=>{for(const t of Object.values(tables)){t.setVolume(v);t.wake()}});
  for(const t of Object.values(tables))t.setVolume(pinballVolume.read());mixPanel.append(pinballVolume.wrap);
  const pinballExit=document.createElement('button');
  pinballExit.textContent='✕';pinballExit.setAttribute('aria-label','Lascia il flipper');
  pinballExit.style.cssText='position:absolute;top:calc(var(--ui-safe-top,0px) + 10px);right:calc(var(--ui-safe-right,0px) + 14px);width:46px!important;min-width:0!important;height:46px;min-height:0!important;padding:0!important;margin:0!important;border-radius:50%;font-size:20px!important;background:rgba(18,14,28,.6)!important;z-index:5;display:none';
  pinballExit.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pinball.close();resetMovement()});
  el.append(pinballExit);
  const playing=()=>tableFootball.active||pinball.active; // si gioca al tavolo: niente camminata né avvisi
  scene.updateMatrixWorld(true);
  for(const [kind,at,label] of [['gp',FLIPPER_AT,'Flipper Grand Prix · Gioca'],['gt',GT_AT,'Flipper Binotto GT · Gioca']]){
    const st=tables[kind].stand(); spots.push({x:st.x,z:st.z,hx:.3,hz:.14,pad:.55,label,where:'Sala giochi',pinball:kind});
    const c=Math.cos(at.ry),sn=Math.sin(at.ry),xs=[],zs=[];
    for(const [lx,lz] of [[-.43,-.82],[.43,-.82],[-.43,.8],[.43,.8]]){xs.push(at.x+lx*c+lz*sn);zs.push(at.z-lx*sn+lz*c)}
    solid(Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs));
  }
  solid(-13.73,-12.27,-.62,.62); // tavolo con manopole e manicotti
  for (const team of [0,1]) for (const pair of [0,1]) {
    const anchor = tableFootball.pose(team*2,2,pair);
    const station = {x:anchor.x,z:anchor.z,hx:.13,hz:.14,pad:.35,label:pair?'Balilla · Attacco':'Balilla · Difesa',balilla:true,team,pair};
    spots.push(station);
  }
  const speakers=[];
  const grille=std('#15171a',.88),cone=std('#333941',.55);
  for(const [cx,cz,halfX,halfZ] of [[0,0,6.4,5.5],[-13,0,5.4,5.5],[13,0,5.4,5.5],[0,-12,6.4,5.4]]){
    for(const side of [-1,1])for(const end of [-1,1]){
      const x=cx+side*halfX,z=cz+end*halfZ;
      const g=new THREE.Group();g.position.set(x,2.63,z);g.lookAt(cx,1.2,cz);scene.add(g);
      box(.34,.53,.23,grille,0,0,0,g);
      for(const [y,r] of [[-.085,.108],[.136,.05]]){
        const driver=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.82,.025,24),cone);
        driver.rotation.x=Math.PI/2;driver.position.set(0,y,.123);g.add(driver);
      }
      box(.055,.012,.012,amber,.1,-.22,.12,g);speakers.push({x,z});
    }
  }
  const demoMaterials = [];
  // Overhead gantries lead from the doorway to the cabinets. Diffuse strips
  // share their materials, including the slow two-colour dimmer.
  const steel=std('#293041',.4,.62);
  const banks=['#56c6dd','#e778ac'].map(color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.9,roughness:.35}));
  for(const [n,x] of [-9.5,-12.6,-15.7,-18.1].entries()){
    box(.17,.12,10.8,steel,x,H-.13,0);
    for(const side of [-1,1]){
      const strip=banks[(n+Number(side>0))%2];
      box(.082,.026,3.4,strip,x,H-.204,side*3.18);
    }
  }
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Cabinati: uno per gioco. Per i giochi a più giocatori il cabinato è più largo, con un posto e una pulsantiera
  // per ognuno (come i cabinati veri a 2, 4 e 5 giocatori): chi apre il gioco prende il primo posto libero
  // e gli altri lo vedono lì, alla sua pulsantiera.
  const SEATS = { pong: 2, 'golf-with-your-gay-friends': 4, 'f1-on-paper': 5, 'moto-trial': 5 };
  const PLAYER_COLORS = ['#ff5252', '#4da3ff', '#ffd23f', '#3ddc84', '#c77dff'];
  const cabWidth = n => (n >= 5 ? 2.3 : n >= 4 ? 1.9 : n >= 2 ? 1.25 : 0.8);
  // angoli arrotondati: profilo laterale estruso con smusso morbido
  const cabinet = (key, title, color, x, z, ry) => {
    const seats = SEATS[key] || 1, cw = cabWidth(seats), half = cw / 2;
    const g = new THREE.Group();
    const c = new THREE.Color(color), hsl = {}; c.getHSL(hsl);
    const bodyM = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setHSL(hsl.h, 0.5, 0.13), roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    const outline=new THREE.Shape();
    [[-.38,0],[.34,0],[.38,.82],[.59,.94],[.59,1.02],[.34,1.11],[.25,1.56],[.45,1.62],[.45,1.88],[.33,1.96],[-.38,1.96]].forEach(([depth,y],i)=>i?outline.lineTo(depth,y):outline.moveTo(depth,y));outline.closePath();
    const shell=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:cw-.03,bevelEnabled:true,bevelThickness:.016,bevelSize:.018,bevelSegments:3,curveSegments:8}),bodyM);
    shell.rotation.y=-Math.PI/2;shell.position.x=half-.015;g.add(shell);
    // fianchi in legno scuro con il bordo a T luminoso (come i cabinati veri)
    const sideM = std('#1a1420', 0.55);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.02, bevelEnabled: true, bevelThickness: .006, bevelSize: .008, bevelSegments: 2 }), sideM);
      side.rotation.y = -Math.PI / 2; side.position.x = sx * (half + 0.012) + 0.01; g.add(side);
    }
    const screenW = cw - (seats > 1 ? 0.22 : 0.08), screenH = seats > 2 ? 0.56 : 0.47;
    box(screenW+.04,screenH,.10,std('#121722',.35),0,1.35,.33,g);
    box(cw-.03,.215,.06,bodyM,0,1.78,.46,g);
    box(cw-.1,.055,.04,glow(color,1.35),0,1.625,.45,g);
    // porta delle monete: una fessura illuminata per ogni giocatore
    const coinMetal=std('#343744',.38,.56);
    const doorW = Math.min(cw - 0.2, 0.2 + 0.16 * seats);
    box(doorW,.45,.035,coinMetal,0,.55,.386,g);
    for (let k = 0; k < seats; k++) {
      const cx = (k - (seats - 1) / 2) * (doorW / seats);
      box(.07,.045,.018,glow(seats > 1 ? PLAYER_COLORS[k] : '#ed8252',1.4),cx,.66,.411,g);
      box(.075,.06,.022,bodyM,cx,.44,.411,g);
    }
    box(cw-.02,.065,.15,bodyM,0,1.63,.4,g);
    const spill = new THREE.MeshBasicMaterial({map:shadeMap,color,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false});
    groundTint(x+Math.sin(ry)*.42,z+Math.cos(ry)*.42,cw+.8,1.6,spill);
    for (const sx of [-1, 1]) box(0.025, 1.7, 0.035, glow(color, 1.6), sx * (half + 0.013), 1.0, .36, g);
    const sideArt=canvasTex(160,320,(ctx,w,h)=>{
      ctx.clearRect(0,0,w,h);ctx.strokeStyle=color;ctx.lineWidth=7;
      for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(4,276-n*16);ctx.lineTo(91,159-n*16);ctx.lineTo(49,159-n*16);ctx.lineTo(148,34-n*6);ctx.stroke()}
      ctx.fillStyle=color;ctx.font='bold 20px monospace';ctx.textAlign='center';ctx.fillText(title.toUpperCase(),78,299,140);
      if(seats>1){ctx.font='bold 26px monospace';ctx.fillText(seats+' GIOCATORI',78,24,150)}
    });
    const decal=new THREE.MeshBasicMaterial({map:sideArt,transparent:true,depthWrite:false});
    for(const side of [-1,1]){
      const badge=new THREE.Mesh(new THREE.PlaneGeometry(.62,1.47),decal);
      badge.position.set(side*(half+.035),1,0);badge.rotation.y=side*Math.PI/2;g.add(badge);
    }
    // cornice del monitor con gli angoli arrotondati
    const bezel = new THREE.Shape();
    { const w = screenW / 2 + 0.035, h = screenH / 2 + 0.035, r = 0.04;
      bezel.moveTo(-w + r, -h); bezel.lineTo(w - r, -h); bezel.quadraticCurveTo(w, -h, w, -h + r); bezel.lineTo(w, h - r); bezel.quadraticCurveTo(w, h, w - r, h);
      bezel.lineTo(-w + r, h); bezel.quadraticCurveTo(-w, h, -w, h - r); bezel.lineTo(-w, -h + r); bezel.quadraticCurveTo(-w, -h, -w + r, -h);
      const hole = new THREE.Path(); const iw = screenW / 2, ih = screenH / 2;
      hole.moveTo(-iw, -ih); hole.lineTo(iw, -ih); hole.lineTo(iw, ih); hole.lineTo(-iw, ih); hole.closePath(); bezel.holes.push(hole); }
    const bez = new THREE.Mesh(new THREE.ExtrudeGeometry(bezel, { depth: 0.012, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2 }), std('#0c0d12', 0.3, 0.4));
    bez.position.set(0, 1.36, .41); bez.rotation.x = -.12; g.add(bez);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), new THREE.MeshBasicMaterial({ map: cabinetScreen(title, color), color: new THREE.Color(1.5, 1.5, 1.5) }));
    scr.position.set(0, 1.36, .417); scr.rotation.x = -.12; g.add(scr);
    const sweep=new THREE.Mesh(new THREE.PlaneGeometry(screenW-.03,.011),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.32,depthWrite:false}));
    sweep.position.set(0,1.36,.456);g.add(sweep);demoMaterials.push({sweep,x,z,ax:x+.48*Math.sin(ry),az:z+.48*Math.cos(ry),offset:demoMaterials.length*.31});
    const mq = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(cw - .06, .74 + (seats - 1) * .3), 0.2), new THREE.MeshBasicMaterial({ map: neonText(title, color, 768, 208, `bold ${title.length > 12 ? 92 : 120}px "Arial Black", Arial, sans-serif`), transparent: true, color: new THREE.Color(1.8, 1.8, 1.8) }));
    mq.position.set(0, 1.78, .497); g.add(mq);
    // pulsantiera: un joystick e due pulsanti per giocatore, con il numero e il colore del posto
    const pan = box(cw - 0.04, 0.06, 0.3, std('#111', 0.5), 0, 1.0, 0.48, g); pan.rotation.x = 0.28;
    box(cw - 0.03, 0.012, 0.012, std('#bcc3cc', 0.3, 0.8), 0, 1.035, 0.625, g);
    const gap = (cw - 0.12) / seats, handles = [];
    for (let k = 0; k < seats; k++) {
      const ox = (k - (seats - 1) / 2) * gap, pc = seats > 1 ? PLAYER_COLORS[k] : '#e23';
      box(.027,.13,.027,coinMetal,ox-.13*Math.min(1,gap/.7),1.1,.50,g);
      const knobS = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), std(pc, 0.3)); knobS.position.set(ox - 0.13*Math.min(1,gap/.7), 1.175, 0.50); g.add(knobS);
      for (let i = 0; i < 2; i++) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 14), glow(i ? pc : '#f4f4f4', 1.4)); bt.position.set(ox + 0.03 + i * 0.075, 1.065, 0.47); bt.rotation.x = 0.28; g.add(bt); }
      if (seats > 1) {
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(.08,.04), new THREE.MeshBasicMaterial({ map: neonText((k + 1) + 'P', pc, 256, 128, 'bold 96px "Arial Black", Arial, sans-serif'), transparent: true, depthWrite: false }));
        tag.position.set(ox + 0.12, 1.08, 0.5); tag.rotation.x = -1.29; g.add(tag);
      }
      handles.push([[ox - 0.13*Math.min(1,gap/.7), 1.15], [ox + 0.07, 1.07]]);
    }
    g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const along = Math.abs(Math.sin(ry)) > 0.5;
    if (along) solid(x - 0.4, x + 0.4, z - half - .03, z + half + .03); else solid(x - half - .03, x + half + .03, z - 0.4, z + 0.4);
    const fx = x + Math.sin(ry) * 0.75, fz = z + Math.cos(ry) * 0.75;
    spots.push({ x: fx, z: fz, hx: along ? 0.2 : Math.max(.2, half - .15), hz: along ? Math.max(.2, half - .15) : 0.2, pad: 0.6, label: title + (seats > 1 ? ' (' + seats + ' posti)' : ''), where: 'Sala giochi', station:key,seats,gap,handles,yaw:ry,pong:key==='pong',screen:scr,sweep,act: () => app.open(key), mq });
  };
  // lungo le pareti, rivolti verso il centro della sala: a nord i grandi a 4 e 5 posti, a sud gli altri
  const byKey = new Map(list.map(e => [e[0], e]));
  const northKeys = ['moto-trial', 'f1-on-paper', 'golf-with-your-gay-friends'].filter(k => byKey.has(k));
  const southKeys = ['pong', ...list.map(e => e[0]).filter(k => !['moto-trial', 'f1-on-paper', 'golf-with-your-gay-friends', 'pong'].includes(k))].filter(k => byKey.has(k));
  const row = (keys, zz, ry, from, limit) => {
    let xx = from;
    const rest = [];
    for (const k of keys) {
      const w = cabWidth(SEATS[k] || 1);
      if (xx - w < limit) { rest.push(k); continue; }
      const [kk, tt, cc] = byKey.get(k);
      cabinet(kk, tt, cc, xx - w / 2, zz, ry);
      xx -= w + 0.32;
    }
    return rest;
  };
  const left = [...row(northKeys, -5.55, 0, -7.9, -15.9), ...row(southKeys, 5.55, Math.PI, -7.9, -18.6)];
  left.forEach((k, i) => { const [kk, tt, cc] = byKey.get(k); cabinet(kk, tt, cc, -18.55, -2.2 + i * 1.1, Math.PI / 2); });
  // pulviscolo che galleggia nella luce delle sale (gira piano attorno al centro della stanza)
  const motes = [];
  for (const [cx, cz, tint] of [[-13, 0, '#c9b6ff'], [13, 0, '#fff0d4']]) {
    const n = 320, pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pts[i * 3] = (Math.random() - 0.5) * 11; pts[i * 3 + 1] = 0.3 + Math.random() * (H - 0.5); pts[i * 3 + 2] = (Math.random() - 0.5) * 11; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dots = new THREE.Points(geo, new THREE.PointsMaterial({ color: tint, size: 0.012, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    dots.position.set(cx, 0, cz); scene.add(dots); motes.push(dots);
  }
  plane(3.4, 0.85, new THREE.MeshBasicMaterial({ map: neonText('ARCADE', '#3ee7ff'), transparent: true, depthWrite: false, color: new THREE.Color(2, 2, 2) }), -18.98, 2.75, 0, Math.PI / 2);
  point('#a855f7', 7, -13, 2.8, 0, 11); point('#22d3ee', 5, -17, 2.4, -4, 8); point('#ff2bd6', 5, -17, 2.4, 4, 8); point('#ffb347', 4, -9, 2.4, 0, 8);
  for (const [c, z] of [['#22d3ee', -5.96], ['#ff2bd6', 5.96]]) box(11.8, 0.03, 0.03, glow(c, 3), -13, H - 0.12, z);
  // ========== ZONA OPERATIVA: porta blindata e corridoio di cemento (corridor.js) ==========
  function zoneSound(type){
    const ac=audioContext;if(!active||!soundAllowed()||ac?.state!=='running')return;
    const now=ac.currentTime,g=ac.createGain();g.connect(ac.destination);
    if(type==='door'){ // la porta che scorre: soffio d'aria e rombo sordo
      const n=ac.createBufferSource(),b=ac.createBuffer(1,Math.floor(ac.sampleRate*.7),ac.sampleRate),d=b.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
      const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;n.buffer=b;
      g.gain.setValueAtTime(.12,now);g.gain.exponentialRampToValueAtTime(.0001,now+.7);n.connect(lp).connect(g);n.start();n.onended=()=>{n.disconnect();lp.disconnect();g.disconnect()};
    }else{ // un neon che si spegne: clic secco
      const o=ac.createOscillator();o.type='square';o.frequency.setValueAtTime(1400,now);o.frequency.exponentialRampToValueAtTime(200,now+.04);
      g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.0001,now+.06);o.connect(g);o.start();o.stop(now+.07);o.onended=()=>{o.disconnect();g.disconnect()};
    }
  }
  const corridor=buildCorridor({scene,box,plane,wallX,wallZ,colliders,H,sound:zoneSound});

  // ========== rifiniture delle pareti, stanza per stanza (trimWall, stile «Circolo») ==========
  const TRIM = {
    // atrio: crema sopra, boiserie di noce sotto, battisedia d'ottone, cornice avorio
    atrium: { wood: '#5a3a28', lower: std('#5a3a28', 0.5), rail: std('#b8925a', 0.32, 0.7), skirt: std('#2e1d14', 0.55), crown: std('#f2e8d5', 0.7), railH: 1.0 },
    // sala tavoli: verde bottiglia, boiserie di noce, filo d'ottone
    cards: { wood: '#583828', lower: std('#583828', 0.5), rail: std('#c3a064', 0.32, 0.64), skirt: std('#2e1d14', 0.55), crown: std('#5a3a28', 0.5), railH: 1.0 },
    // biliardo: rosso pompeiano, boiserie scura più alta (le stecche ci si appoggiano), oro brunito
    pool: { wood: '#3e2519', lower: std('#3e2519', 0.5), rail: std('#8a6a3a', 0.35, 0.6), skirt: std('#22140d', 0.55), crown: std('#8a6a3a', 0.4, 0.5), railH: 1.2 },
    // sala giochi: niente legno, una riga di neon azzurro a metà parete e lo zoccolo che brilla
    arcade: { neon: glow('#33e1ff', 1.6), skirt: glow('#ff4fd8', 1.3), crown: std('#0b0a18', 0.6), railH: 1.0 },
    // cinema: pannelli in velluto come le poltrone, lucine di cortesia nello zoccolo
    cinema: { lower: dark(std('#6f2033', 0.97)), rail: dark(std('#a5535f', 0.89)), skirt: dark(std('#14161f', 0.8)), crown: dark(std('#14161f', 0.8)), railH: 1.0, lights: glow('#e7b866', 1.4), top: CINEMA_H, base: -CINEMA_DROP }
  };
  // atrio (x -7…7): porte a nord (sala tavoli), a sud (cinema), a est (biliardo) e a ovest (giochi)
  trimWall(TRIM.atrium, 'x', -6.84, 6.84, -6.0, 1, [[0, DOOR]]);
  trimWall(TRIM.atrium, 'x', -6.84, 6.84, 6.0, -1, [[0, 1.65]]);
  trimWall(TRIM.atrium, 'z', -6.0, 6.0, 6.84, -1, [[0, DOOR]]);
  trimWall(TRIM.atrium, 'z', -6.0, 6.0, -6.84, 1, [[0, DOOR]]);
  // sala biliardo (x 7…19)
  trimWall(TRIM.pool, 'x', 7.16, 19, -6.0, 1);
  trimWall(TRIM.pool, 'x', 7.16, 19, 6.0, -1);
  trimWall(TRIM.pool, 'z', -6.0, 6.0, 19.0, -1);
  trimWall(TRIM.pool, 'z', -6.0, 6.0, 7.16, 1, [[0, DOOR]]);
  // sala giochi (x -19…-7)
  trimWall(TRIM.arcade, 'x', -19, -7.16, -6.0, 1, [[ZONE.x, ZONE.door + 0.14]]);
  trimWall(TRIM.arcade, 'x', -19, -7.16, 6.0, -1);
  trimWall(TRIM.arcade, 'z', -6.0, 6.0, -19.0, 1);
  trimWall(TRIM.arcade, 'z', -6.0, 6.0, -7.16, -1, [[0, DOOR]]);
  // sala tavoli (z -18…-6)
  trimWall(TRIM.cards, 'z', -18.13, -6.3, -7.0, 1);
  trimWall(TRIM.cards, 'z', -18.13, -6.3, 7.0, -1);
  trimWall(TRIM.cards, 'x', -7.0, 7.0, -18.13, 1);
  trimWall(TRIM.cards, 'x', -7.0, 7.0, -6.3, -1, [[0, DOOR]]);
  // cinema (z 6…20,5): pareti laterali e quella d'ingresso; la parete dello schermo resta libera
  trimWall(TRIM.cinema, 'z', 6.375, CINEMA_END - 0.15, -7.0, 1);
  trimWall(TRIM.cinema, 'z', 6.375, CINEMA_END - 0.15, 7.0, -1);
  trimWall({ ...TRIM.cinema, base: 0 }, 'x', -7.0, 7.0, 6.375, 1, [[0, 1.65]]); // l'ingresso è in piano
  // un oggetto per materiale
  for (const [m, list] of trimGeo) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m);
    mesh.receiveShadow = true;
    scene.add(mesh);
    trimMeshes.set(m, mesh);
    for (const g of list) g.dispose();
  }
  trimGeo.clear();
  // pannelli di boiserie veri: tutti in un oggetto a istanze (uno da disegnare), ognuno alla misura del suo riquadro e
  // con il legno della sua stanza; i pannelli piatti di trimWall restano finché non arrivano
  finishKit.then((kit) => {
    const src = kit?.getObjectByName('boiserie_pannello');
    const geo = src?.isMesh ? src.geometry : src?.children.find((c) => c.isMesh)?.geometry;
    if (!geo || !boiserie.length) return;
    const panels = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }), boiserie.length);
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4();
    boiserie.forEach((b, i) => {
      const angle = b.axis === 'x' ? (b.n > 0 ? 0 : Math.PI) : b.n > 0 ? Math.PI / 2 : -Math.PI / 2;
      const at = b.axis === 'x' ? new THREE.Vector3(b.at, 0.14, b.face) : new THREE.Vector3(b.face, 0.14, b.at);
      m4.compose(at, q.setFromAxisAngle(up, angle), new THREE.Vector3(b.w, b.h, 1));
      panels.setMatrixAt(i, m4);
      panels.setColorAt(i, new THREE.Color(b.color));
    });
    panels.receiveShadow = true;
    scene.add(panels);
    for (const b of boiserie) if (trimMeshes.get(b.flat)) trimMeshes.get(b.flat).visible = false;
  });

  // ========== il personaggio ==========
  const me = makeCharacter(readLook());
  scene.add(me.root);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);
  let tag = null, tagName = '';
  function shirtName(n){
    // nome stampato sulla schiena della felpa (busto a blocchi: dietro è piatto)
    const cloth=new THREE.PlaneGeometry(.38,.08);cloth.translate(0,1.17,.1145);
    return new THREE.Mesh(cloth,new THREE.MeshBasicMaterial({map:nameTag(n),transparent:true,depthWrite:false}));
  }
  const setTag = () => {
    const n = (app.me && app.me()?.name) || '';
    if (n === tagName) return;
    tagName = n;
    if (tag) { me.root.remove(tag); tag.geometry.dispose(); tag.material.map.dispose(); tag.material.dispose(); }
    tag = null;
    if (!n) return;
    tag=shirtName(n);
    me.root.add(tag);
  };
  // anello che indica cosa si può aprire
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf4a').multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

  const pos = { x: 0, z: 1.8 }, cam = { yaw: 0, pitch: 0.42, dist: 4.6 };
  let heading = 0, near = null, last = 0, t = 0, raf = 0, active = false, moving = 0;
  const ray = new THREE.Raycaster(), tmp = new THREE.Vector3(), tgt = new THREE.Vector3();

  // ---------- comandi ----------
  const keys = new Set();
  let firstPerson=false,parked=null,pongAnchor=null,localPose=null,lastPoseKey='',lastPoseSent=0,peerList=null;
  // azioni (solo visive): Ctrl sinistro abbassato, clic sinistro colpo col braccio destro, tasto destro parata
  let crouching=false,guarding=false,punchCount=0,jumpCount=0,hitN=0,lastHit=null,fxNoise=null;
  const peers=new Map(),downArm=new THREE.Vector3(0,-1,0);
  const viewButton=document.createElement('button');
  $('.l3d-top').append(viewButton);
  function setFirst(value){
    // sul telefono niente "(V)": la tastiera non c'è e la barra in alto deve stare nella larghezza
    firstPerson=value;viewButton.textContent=(value?'Vista esterna':'Vista dagli occhi')+(touch?'':' (V)');
    viewButton.setAttribute('aria-pressed',String(value));
  }
  let activityView = null;
  function saveActivityView() {
    activityView ??= { firstPerson, cam: { ...cam } };
  }
  function restoreActivityView() {
    if (!activityView) return;
    setFirst(activityView.firstPerson);
    Object.assign(cam, activityView.cam);
    activityView = null;
  }
  setFirst(false);
  viewButton.onclick=()=>{if(!activityView)setFirst(!firstPerson)};
  function currentPose(){
    if(parked)return parked;
    if(!active)return null;
    if(tableFootball.seat)return tableFootball.seat;
    if(pinball.active)return {station:pinballKind==='gt'?'flipper-gt':'flipper',slot:pinball.slot()};
    if(monitor&&pongAnchor&&Math.hypot(pos.x-pongAnchor.x,pos.z-pongAnchor.z)<.24)return {station:'pong',slot:pongAnchor.slot||0};
    // seduto al cinema: gli altri ti vedono seduto sul tuo posto del divano, con la testa che guarda dove guardi
    if(seating){
      const r=v=>Math.round(v*20)/20;
      let look=cam.yaw-Math.PI;look=Math.atan2(Math.sin(look),Math.cos(look));
      const yaw=seating.seat?seating.yaw:Math.PI;
      look=cam.yaw-yaw;look=Math.atan2(Math.sin(look),Math.cos(look));
      return {station:'seat',x:r(pos.x),z:r(pos.z),y:Math.round((cinemaFloor(pos.x,pos.z)+(stools[seating.stool]?.y??0))*1000)/1000,yaw:r(yaw),look:r(look),pitch:r(cam.pitch),...heldPose()};
    }
    // in giro per il club: posizione e direzione (arrotondate), così gli altri ti vedono camminare
    const r=v=>Math.round(v*20)/20;
    return {station:'walk',x:r(pos.x),z:r(pos.z),yaw:Math.round(heading*20)/20,...(Math.abs(me.lookYaw||0)>.05?{look:r(me.lookYaw)}:{}),...(crouching?{crouch:1}:{}),...(guarding?{guard:1}:{}),...(punchCount?{punch:punchCount}:{}),...(jumpCount?{jump:jumpCount}:{}),...(lastHit?{hit:lastHit}:{}),...heldPose()};
  }
  function descriptor(){
    const pose=currentPose();if(!pose)return null;
    const look=readLook();return {...pose,shirt:look.shirt,shorts:look.shorts,accent:look.accent,hair:look.hair,skin:look.skin};
  }
  // gli altri che camminano: il personaggio va verso l'ultima posizione ricevuta, gira piano e muove le gambe
  let peerDt=1/60;
  function walkPose(c,p){
    if(c===me)return null; // il tuo personaggio lo muovi tu
    const w=c.walk||(c.walk={x:p.x,z:p.z,yaw:p.yaw});
    const k=1-Math.exp(-peerDt*7);
    const ox=w.x,oz=w.z;
    w.x+=(p.x-w.x)*k;w.z+=(p.z-w.z)*k;
    let d=p.yaw-w.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));w.yaw+=d*Math.min(1,peerDt*10);
    const speed=Math.hypot(w.x-ox,w.z-oz)/Math.max(1e-3,peerDt);
    w.speed=(w.speed||0)+(speed-(w.speed||0))*Math.min(1,peerDt*8);
    c.root.position.set(w.x,0,w.z);c.root.rotation.set(0,w.yaw,0);
    for(const arm of c.arms){arm.quaternion.identity();arm.scale.y=1}
    c.lookYaw=Number(p.look)||0;c.lookPitch=0;
    animateCharacter(c,w.speed<.15?0:w.speed,peerDt,t);
    actCharacter(c,{crouch:p.crouch,guard:p.guard,hold:!!p.snack,hold2:!!p.drink&&!p.drink.cup},peerDt,t);
    peerJump(c);
    return {x:w.x,z:w.z,yaw:w.yaw};
  }
  function seatPose(c,p){
    if(c===me)return null;
    c.walk=null;
    c.root.position.set(p.x,(Number(p.y)||0)-.16,p.z);c.root.rotation.set(0,Number.isFinite(p.yaw)?p.yaw:Math.PI,0);
    sitJoints(c);
    const k=Math.min(1,peerDt*8);
    c.head.rotation.y+=(Math.max(-1.2,Math.min(1.2,Number(p.look)||0))-c.head.rotation.y)*k;
    c.head.rotation.x+=(-(Number(p.pitch)||0)*.8-c.head.rotation.x)*k;
    c.torso.rotation.y=0;c.root.updateMatrixWorld(true);
    return {x:p.x,z:p.z};
  }
  // seduto: cosce in avanti, ginocchia piegate ad angolo retto, mani appoggiate sulle gambe
  function sitJoints(c){
    for(const leg of c.legs)leg.rotation.set(Math.PI/2,0,0);
    for(const knee of c.knees)knee.rotation.set(-Math.PI/2,0,0);
    for(const arm of c.arms){arm.quaternion.identity();arm.scale.y=1;arm.rotation.set(.3,0,0)}
    for(const elbow of c.elbows)elbow.rotation.set(.85,0,0);
  }
  function modelPose(c,p){
    if(!p)return null;
    if(p.station==='seat')return Number.isFinite(p.x)&&Number.isFinite(p.z)?seatPose(c,p):null;
    if(p.station==='walk')return Number.isFinite(p.x)&&Number.isFinite(p.z)?walkPose(c,p):null;
    if(c!==me)c.walk=null;
    let anchor;
    if(p.station==='balilla')anchor=tableFootball.pose(p.slot,p.mode,p.pair);
    else if(p.station==='flipper'||p.station==='flipper-gt'){
      // mani sui pulsanti dei flipper (o la destra sul pomello della leva), braccia sempre attaccate
      const t=tables[p.station==='flipper-gt'?'gt':'gp'];
      const st=t.stand(),hs=t.hands(p.slot|0,c===me?t.plunger():0);if(!hs)return null;
      const lx=v=>(v.x-st.x)*Math.cos(st.yaw)-(v.z-st.z)*Math.sin(st.yaw);
      hs.sort((a,b)=>lx(a)-lx(b));
      anchor={x:st.x,z:st.z,yaw:st.yaw,handles:hs};
    }
    else{
      const station=spots.find(s=>s.station===p.station);if(!station)return null;
      const yaw=station.yaw,cs=Math.cos(yaw),sn=Math.sin(yaw);
      // cabinati a più posti: ognuno davanti alla sua pulsantiera
      const n=station.seats||1,slot=Math.min(n-1,Math.max(0,p.slot|0)),ox=(slot-(n-1)/2)*(station.gap||0);
      const hs=station.handles?.[slot]||[[-.18,1.15],[.12,1.07]];
      anchor={x:station.x+.13*sn+ox*cs,z:station.z+.13*cs-ox*sn,yaw,handles:hs.map(([x,y])=>new THREE.Vector3(station.x+x*cs-.25*sn,y,station.z-x*sn-.25*cs))};
    }
    c.root.position.set(anchor.x,0,anchor.z);c.root.rotation.y=anchor.yaw;
    for(const e of c.elbows)e.rotation.set(0,0,0); // braccia tese fino alle manopole
    for(const k of c.knees)k.rotation.set(0,0,0);
    c.root.updateMatrixWorld(true);
    c.arms.forEach((arm,i)=>{
      const tip=c.root.worldToLocal(anchor.handles[i].clone()).sub(arm.position);
      arm.quaternion.setFromUnitVectors(downArm,tip.clone().normalize());
      arm.scale.y=tip.length()/ARM_LEN;
    });
    return anchor;
  }
  // dove sta chi gioca: tavolo o cabinato del suo gioco (dalle partite aperte nella Lobby)
  const slugOf=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  function activityPose(user){
    const room=user.game||user.viewingRoom;if(!room)return null;
    const g=(app.board?.()?.games||[]).find(x=>x.room===room);if(!g)return null;
    const key=slugOf(gameTitle(g));
    let h=0;for(const ch of String(user.id))h=(h*31+ch.charCodeAt(0))>>>0;
    const seat=Math.max(0,(g.players||[]).findIndex(pl=>String(pl.id)===String(user.player)));
    const cab=spots.find(sp=>sp.station===key);
    if(cab)return {station:key,slot:seat%(cab.seats||1)};
    const tables=spots.filter(sp=>sp.key===key);if(!tables.length)return null;
    const sp=tables[h%tables.length];
    if(sp.where==='Sala tavoli'&&seat<2){
      // seduto su una delle due sedie, rivolto al tavolo
      const side=seat?1:-1;
      return {station:'seat',x:sp.x+side*1.24,z:sp.z,y:0,yaw:side*Math.PI/2,look:0,pitch:.35};
    }
    // in piedi lungo il lato lungo del tavolo, rivolto al tavolo
    const zs=(seat%2?1:-1),x=sp.x+(((seat>>1)%3)-1)*.6,z=sp.z+zs*(sp.hz+.45);
    return {station:'walk',x,z,yaw:Math.atan2(0,zs)};
  }
  // Colpo (solo un effetto): prende chi è davanti, vicino (entro un metro e poco più). Se si sta riparando è parato.
  function punch(){
    if(seating||boardOpen||playing()||!active)return;
    (me.fx||(me.fx={crouch:0,guard:0,punch:9,starsUntil:0})).punch=0;punchCount++;
    const fx=-Math.sin(heading),fz=-Math.cos(heading);
    let best=null,bd=1.15;
    for(const [id,c] of peers){
      if(!c.root.visible||c.pose?.station!=='walk')continue;
      const dx=c.root.position.x-pos.x,dz=c.root.position.z-pos.z,d=Math.hypot(dx,dz);
      if(d<bd&&d>.01&&(dx*fx+dz*fz)/d>.45){bd=d;best=[id,c]}
    }
    // il colpo arriva quando il braccio cala (dopo circa 0,2 s), non al clic
    if(best)setTimeout(()=>{
      const blocked=!!best[1].pose?.guard;
      lastHit={id:String(best[0]),n:++hitN,blocked};
      struck(String(best[0]),blocked,me);
    },200);
  }
  // colpo arrivato a qualcuno (anche a te): stelline se non era parato, e il suo suono
  function struck(id,blocked,from){
    const mine=String(app.me?.()?.id??'')===id, target=mine?me:peers.get(id);
    if(!target)return;
    if(!blocked)(target.fx||(target.fx={crouch:0,guard:0,punch:9,starsUntil:0})).starsUntil=t+2.6;
    const near=Math.hypot(target.root.position.x-pos.x,target.root.position.z-pos.z);
    if(mine||from===me||near<6)fxSound(blocked?'block':'hit',mine||from===me?1:Math.max(.2,1-near/6));
  }
  function fxSound(kind,level=1){
    const ctx=audioContext;if(!active||!soundAllowed()||ctx?.state!=='running')return;
    if(!fxNoise){fxNoise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.25),ctx.sampleRate);const d=fxNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
    const now=ctx.currentTime,out=ctx.createGain();out.gain.value=.5*level;out.connect(ctx.destination);
    const burst=(freq,q,decay,lvl,delay=0)=>{const src=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=fxNoise;bp.type='bandpass';bp.frequency.value=freq;bp.Q.value=q;g.gain.setValueAtTime(lvl,now+delay);g.gain.exponentialRampToValueAtTime(.0001,now+delay+decay);src.connect(bp).connect(g).connect(out);src.start(now+delay);src.stop(now+delay+decay+.02)};
    const tone=(hz,decay,lvl,end=hz*.6)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(hz,now);o.frequency.exponentialRampToValueAtTime(end,now+decay);g.gain.setValueAtTime(lvl,now);g.gain.exponentialRampToValueAtTime(.0001,now+decay);o.connect(g).connect(out);o.start(now);o.stop(now+decay+.02)};
    // colpo a segno: "pof" morbido e un piccolo tintinnio di stelline; parato: "tac" secco
    if(kind==='hit'){burst(170,1.2,.13,.9);tone(110,.12,.5);tone(1800,.25,.06,2600);tone(2400,.2,.04,3200)}
    else if(kind==='step'){burst(105+Math.random()*35,1,.1,.2);burst(210,1.6,.05,.05)}
    else if(kind==='land'){burst(150,1.1,.16,.9);tone(85,.12,.45,55)}
    else{burst(1500,5,.06,.6);tone(820,.05,.18,600)}
  }
  // nome sopra la testa degli altri (si legge da ogni lato)
  function headName(n){
    const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:nameTag(String(n).slice(0,22)),depthWrite:false,transparent:true}));
    tag.scale.set(.9,.17,1);tag.position.y=2.05;return tag;
  }
  function placePeers(){
    const list=app.peers?.();if(!list)return;
    if(peerList!==list){
      peerList=list;const present=new Set();
      for(const user of list){
        if(String(user.id)===String(app.me?.()?.id))continue;
        // chi gioca senza la 3D aperta (dalla Lobby classica) compare accanto al suo gioco: seduto al tavolo della sala
        // tavoli, in piedi al tavolo del biliardo, alla pulsantiera del cabinato. Chi è nella Lobby classica e basta sta
        // in piedi nell'atrio, attorno al tappeto, rivolto al centro.
        let pose=user.clubPose||activityPose(user);
        if(!pose&&user.status==='In Lobby'&&!user.game&&!user.viewingRoom){
          let h=0;for(const ch of String(user.id))h=(h*31+ch.charCodeAt(0))>>>0;
          const a=(h%360)*Math.PI/180,x=Math.cos(a)*3.1,z=.6+Math.sin(a)*2.7;
          pose={station:'walk',x,z,yaw:Math.atan2(x,z-.6)};
        }
        if(!pose)continue;
        present.add(user.id);let c=peers.get(user.id);
        if(!c){c=makeCharacter(pose);c.root.add(shirtName(user.name||''));c.root.add(headName(user.name||''));scene.add(c.root);peers.set(user.id,c)}
        c.pose=pose;if(user.clubPose)setLook(c,user.clubPose);
        // un colpo nuovo di questo giocatore: si vede il braccio; se ha preso qualcuno, stelline e suono
        const cp=user.clubPose||{};
        if(c.seenPunch===undefined){c.seenPunch=cp.punch||0;c.seenHit=cp.hit?.n||0;c.seenJump=cp.jump||0}
        if((cp.jump||0)!==c.seenJump){c.seenJump=cp.jump||0;if(!c.jumping)c.jumping={prep:.12,h:0,v:0};c.landBend=.28}
        if((cp.punch||0)!==c.seenPunch){c.seenPunch=cp.punch||0;(c.fx||(c.fx={crouch:0,guard:0,punch:9,starsUntil:0})).punch=0}
        if(cp.hit&&cp.hit.n!==c.seenHit){c.seenHit=cp.hit.n;struck(String(cp.hit.id),!!cp.hit.blocked,c)}
        c.snackWanted=cp.snack||null; // prodotto della macchinetta o cartoccio in mano (peerSnack)
        c.drinkWanted=cp.drink||null;c.useWanted=cp.use||null;c.userName=user.name||''; // cola (peerDrink), macchinetta in uso (peerMachines)
      }
      for(const [id,c] of peers)if(!present.has(id)){
        c.root.removeFromParent();c.snack?.group.removeFromParent();c.drink?.group.removeFromParent();
        const geometries=new Set(),materials=new Set();c.root.traverse(o=>{if(o.isMesh||o.isSprite){geometries.add(o.geometry);materials.add(o.material)}});
        for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose()}peers.delete(id);
      }
    }
    for(const c of peers.values()){c.root.visible=!!modelPose(c,c.pose);peerSnack(c);peerDrink(c)}
    peerMachines();
  }
  let jumpHeight = 0, verticalSpeed = 0, lastFoot = 0, jumpPrep = 0;
  // salto: prima le ginocchia si piegano un poco (0,12 s, la spinta) e poi si stacca da terra
  function startJump() {
    if (seating || jumpHeight !== 0 || verticalSpeed !== 0 || jumpPrep > 0) return;
    jumpPrep = 0.12;
    me.landBend = 0.28;
    jumpCount++; // gli altri lo vedono saltare (peerJump)
  }
  // gli altri che saltano: alla notizia di un salto nuovo il loro personaggio fa lo stesso salto (spinta, volo, atterraggio)
  function peerJump(c){
    const j=c.jumping;if(!j)return;
    if(j.prep>0){j.prep-=peerDt;if(j.prep<=0)j.v=4.1;return}
    j.h=Math.max(0,j.h+j.v*peerDt-.5*13*peerDt*peerDt);j.v-=13*peerDt;
    if(j.h===0&&j.v<0){c.jumping=null;c.landBend=.28;return}
    c.root.position.y+=j.h;
  }
  function resetMovement() {
    tableFootball.blur();
    crouching = false; guarding = false; // finestra persa (Alt+Tab): nessun tasto resta premuto
    monitor?.frame.contentWindow.cabinetMonitor?.clear();
    keys.clear();
    jumpHeight = verticalSpeed = moving = 0;
    me.root.position.y = 0;
  }
  const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
  const lookJoy = { id: null, x: 0, y: 0, cx: 0, cy: 0 }; // telefono: joystick a destra per girare la visuale
  const drags = new Map();
  let pinch = 0;
  const onKey = (e) => {
    if (!active || document.querySelector('dialog[open]')) return;
    // bacheca aperta: si scrive nella chat; Esc la chiude
    if (boardOpen) { if (e.type === 'keydown' && e.code === 'Escape') closeBoard(); return; }
    // davanti alla macchinetta si usano solo i tasti sul pannello; Esc per andare via
    if (vendMode) { if (e.type === 'keydown' && e.code === 'Escape') exitVend(); e.preventDefault(); return; }
    if (held && e.code === 'KeyF') { if (e.type === 'keydown' && !e.repeat) eat(); e.preventDefault(); return; }
    if (drink && e.code === 'KeyB') { if (e.type === 'keydown' && !e.repeat) drinkCola(); e.preventDefault(); return; }
    if(e.altKey||e.key==='Alt'){if(e.type==='keydown')return}
    if(e.code==='KeyV'){if(e.type==='keydown'&&!e.repeat&&!activityView)setFirst(!firstPerson);e.preventDefault();return}
    if(e.code==='KeyH'){if(e.type==='keydown'&&!e.repeat)toggleHelp();e.preventDefault();return} // i comandi
    if(pinball.active){const r=pinball.input(e);if(r==='exit'){pinball.close();resetMovement()}else if(r)e.preventDefault();return}
    if(tableFootball.active){if(tableFootball.input(e))e.preventDefault();return}
    if (seating && e.type==='keydown' && e.code==='Escape'){e.preventDefault();stand();return}
    if(e.target?.matches?.('input,select'))return;
    if(e.code==='KeyG'&&!seating){if(e.type==='keydown'&&!e.repeat)toggleCarry();return}
    if(seating?.stool!=null&&e.code==='Space'){ // seduti sullo sgabello: Spazio fa molleggiare
      if(e.type==='keydown'&&!e.repeat)bounceStool();
      e.preventDefault();return;
    }
    if(monitor && ['KeyI','KeyK'].includes(e.code)){
      e.preventDefault();monitor.frame.contentWindow.cabinetMonitor?.key(e.code,e.type==='keydown');return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.type === 'keydown' && !e.repeat) startJump();
      return;
    }
    if (e.code === 'ControlLeft') { crouching = e.type === 'keydown'; e.preventDefault(); return; }
    const k = e.code === 'ShiftLeft' ? 'sprint' : e.key.toLowerCase();
    if (e.type === 'keydown') {
      if ((k === 'e' || k === 'enter') && seating) { e.preventDefault(); if(!e.repeat)stand(); return; } // seduti: E per alzarsi
      if ((k === 'e' || k === 'enter') && near) { e.preventDefault(); if(!e.repeat)launch(near); return; }
      keys.add(k);
    } else keys.delete(k);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  addEventListener('blur', resetMovement);
  const locked = () => document.pointerLockElement === host;
  let lockFailed = false;
  document.addEventListener('pointerlockerror', () => { lockFailed = true; });
  host.addEventListener('pointerdown', (e) => {
    if (active && pinball.active) { if (pinball.pointer(e)) e.preventDefault(); return; } // flipper: tasti del mouse e leva
    if (!active || tableFootball.active) return;
    // primo clic col mouse: la vista si aggancia al mouse (Esc per liberarlo); quel clic non tira il colpo
    if (e.pointerType === 'mouse' && !locked() && !boardOpen && !lockFailed && host.requestPointerLock && !e.target.closest?.('button,input,select,a,label')) {
      try { const r = host.requestPointerLock(); r?.catch?.(() => { lockFailed = true; }); } catch (err) { lockFailed = true; }
      if (e.button === 0) return;
    }
    const r = stick.getBoundingClientRect();
    const inStick = touch && e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.45 && joy.id === null;
    const lr = lookStick.getBoundingClientRect();
    const inLook = !inStick && !lookStick.hidden && e.pointerType !== 'mouse' && lookJoy.id === null && Math.hypot(e.clientX - (lr.left + lr.width / 2), e.clientY - (lr.top + lr.height / 2)) < lr.width * 0.75;
    try { host.setPointerCapture(e.pointerId); } catch (err) { /* puntatore finto */ }
    if (inLook) {
      lookJoy.id = e.pointerId; lookJoy.cx = lr.left + lr.width / 2; lookJoy.cy = lr.top + lr.height / 2;
      moveStick(lookJoy, lookKnob, e);
    } else if (inStick) {
      joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
      moveJoy(e);
    } else drags.set(e.pointerId, { x: e.clientX, y: e.clientY, startX:e.clientX,startY:e.clientY, moved:false, paddle:e.button===0&&aimAtMonitor(e) });
    if (e.pointerType === 'mouse' && e.button === 2) guarding = true;
  });
  const moveStick = (j, k, e) => {
    let dx = e.clientX - j.cx, dy = e.clientY - j.cy;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx *= max / d; dy *= max / d; }
    j.x = dx / max; j.y = dy / max;
    k.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const moveJoy = (e) => moveStick(joy, knob, e);
  host.addEventListener('pointermove', (e) => {
    if(pinball.active){pinball.pointer(e);return}
    if(tableFootball.active){tableFootball.move(e,host.getBoundingClientRect());return}
    if (e.pointerId === joy.id) return moveJoy(e);
    if (e.pointerId === lookJoy.id) return moveStick(lookJoy, lookKnob, e);
    // mouse agganciato (dopo un clic): la vista lo segue; libero (Esc): si trascina per guardarsi intorno, come prima
    if (e.pointerType === 'mouse' && locked() && !boardOpen) {
      cam.yaw -= e.movementX * 0.0035;
      cam.pitch = Math.max(firstPerson?-.95:seating?-.65:.08, Math.min(1.25, cam.pitch + e.movementY * 0.0025));
      if (drags.get(e.pointerId)?.paddle) aimAtMonitor(e);
      return;
    }
    const d = drags.get(e.pointerId);
    if (!d) return;
    if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>5)d.moved=true;
    if(d.paddle){aimAtMonitor(e);return}
    if (drags.size === 2) {
      const [a, b] = [...drags.values()];
      d.x = e.clientX; d.y = e.clientY;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) cam.dist = Math.max(1.8, Math.min(9, cam.dist * (pinch / dist)));
      pinch = dist;
      return;
    }
    const k = e.pointerType === 'mouse' ? 0.006 : 0.008;
    cam.yaw -= (e.clientX - d.x) * k;
    cam.pitch = Math.max(firstPerson?-.95:seating?-.65:.08, Math.min(1.25, cam.pitch + (e.clientY - d.y) * k * 0.7));
    d.x = e.clientX; d.y = e.clientY;
  });
  const up = (e) => {
    if (pinball.active) { pinball.pointer(e); return; }
    if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
    if (e.pointerId === lookJoy.id) { lookJoy.id = null; lookJoy.x = lookJoy.y = 0; lookKnob.style.transform = ''; }
    const drag=drags.get(e.pointerId);
    // clic sinistro (senza trascinare): colpo; tasto destro lasciato: fine della parata
    if(e.type==='pointerup' && e.pointerType==='mouse' && drag && !drag.moved && e.button===0 && !drag.paddle)punch();
    if(e.pointerType==='mouse' && (e.button===2 || e.type!=='pointerup'))guarding=false;
    drags.delete(e.pointerId);
    if (drags.size < 2) pinch = 0;
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) host.addEventListener(ev, up);
  host.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(1.8, Math.min(9, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  host.addEventListener('contextmenu', (e) => e.preventDefault());
  actB.onclick = () => near && launch(near);
  // sul telefono: salto, colpo, parata e abbassarsi, su un arco attorno al joystick della visuale (in basso a
  // destra), dall'alto verso sinistra. Parata e abbassarsi valgono finché tieni premuto: lasciando ci si rialza.
  const moves = document.createElement('div');
  moves.className = 'l3d-moves'; moves.hidden = true;
  const ARC = [['jump', '⤒', 'Salta', 90], ['punch', '👊', 'Colpo', 128], ['guard', '🛡️', 'Parata (tieni premuto)', 166], ['crouch', '⬇️', 'Abbassati (tieni premuto)', 204]];
  // centro del joystick della visuale: 26 px dal bordo + metà dei suoi 120 px; tasti a 92 px dal centro, attaccati
  // al cerchio del joystick (38 gradi tra un tasto e l'altro: da 58 px non si toccano)
  moves.innerHTML = ARC.map(([m, icon, label, deg]) => {
    const a = (deg * Math.PI) / 180, right = 86 - Math.cos(a) * 92 - 29, bottom = 86 + Math.sin(a) * 92 - 29;
    return `<button data-m="${m}" aria-label="${label}" style="right:calc(var(--ui-safe-right,0px) + ${right.toFixed(0)}px);bottom:calc(var(--ui-safe-bottom,0px) + ${bottom.toFixed(0)}px)">${icon}</button>`;
  }).join('');
  el.append(moves);
  const movesCss = document.createElement('style');
  movesCss.textContent = '.l3d-moves{position:absolute;inset:0;pointer-events:none;z-index:3}.l3d-moves[hidden]{display:none}.l3d-moves button{position:absolute;pointer-events:auto;width:58px!important;height:58px;min-height:58px;padding:0!important;margin:0!important;border-radius:50%;font-size:26px!important;background:rgba(255,200,40,.5)!important;touch-action:none}.l3d-moves button.on{background:rgba(255,200,40,.95)!important}';
  document.head.append(movesCss);
  const holdMove = (m, on) => {
    if (m === 'guard') guarding = on;
    if (m === 'crouch') crouching = on;
    moves.querySelector(`[data-m="${m}"]`)?.classList.toggle('on', on);
  };
  moves.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return; e.stopPropagation(); e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch {}
    const m = b.dataset.m;
    if (m === 'punch') punch();
    if (m === 'jump') startJump();
    if (m === 'guard' || m === 'crouch') holdMove(m, true);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) moves.addEventListener(ev, (e) => {
    const b = e.target.closest?.('[data-m]'); if (b && (b.dataset.m === 'guard' || b.dataset.m === 'crouch')) holdMove(b.dataset.m, false);
  });
  $('.l3d-exit').onclick = () => { hide(); app.exit && app.exit(); };

  // ---------- movimento e collisioni ----------
  function collide(p) {
    for (let pass = 0; pass < 2; pass++) for (const b of colliders) {
      const cx = Math.max(b.x0, Math.min(b.x1, p.x)), cz = Math.max(b.z0, Math.min(b.z1, p.z));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * R; p.z = cz + (dz / d) * R; }
      else {
        // dentro la scatola: fuori dal lato più vicino
        const o = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        p.x += o[1] * (o[0] + R); p.z += o[2] * (o[0] + R);
      }
    }
  }
  const rectDist = (s, x, z) => Math.hypot(Math.max(0, Math.abs(x - s.x) - s.hx), Math.max(0, Math.abs(z - s.z) - s.hz));
  function step(dt) {
    // joystick della visuale: destra/sinistra gira, su/giù alza e abbassa lo sguardo (più veloce verso il bordo)
    if (lookJoy.id !== null) {
      const lx = lookJoy.x * Math.abs(lookJoy.x), ly = lookJoy.y * Math.abs(lookJoy.y);
      cam.yaw -= lx * 2.6 * dt;
      cam.pitch = Math.max(firstPerson?-.95:seating?-.65:.08, Math.min(1.25, cam.pitch + ly * 1.6 * dt));
    }
    let ix = 0, iz = 0;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (joy.id !== null) { ix += joy.x; iz += joy.y; }
    const mag = Math.min(1, Math.hypot(ix, iz));
    let speed = 0;
    if (!seating && !playing() && mag > 0.12) {
      // avanti = lontano dalla telecamera
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      const n = Math.hypot(ix, iz);
      const dx = ((ix * c + iz * s) / n) * mag, dz = ((-ix * s + iz * c) / n) * mag;
      const pace = (keys.has('sprint') ? SPEED * 1.75 : SPEED) * (crouching ? 0.45 : 1);
      speed = pace * mag;
      pos.x += dx * pace * dt; pos.z += dz * pace * dt;
      collide(pos);
      const want = Math.atan2(-dx, -dz);
      let d = want - heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      heading += d * Math.min(1, dt * 12);
    }
    moving += (speed - moving) * Math.min(1, dt * 10);
    me.root.position.x = pos.x; me.root.position.z = pos.z; me.root.rotation.set(0,heading,0);
    // collo: in terza persona la testa guarda verso dove guarda la telecamera
    { let lk = cam.yaw - heading; lk = Math.atan2(Math.sin(lk), Math.cos(lk)); me.lookYaw = seating ? 0 : Math.max(-0.9, Math.min(0.9, lk)); me.lookPitch = 0; }
    animateCharacter(me, moving, dt, t);
    // un passo a ogni appoggio del piede (più piano abbassati, più forte correndo)
    { const foot = Math.floor(me.phase / Math.PI); if (foot !== lastFoot) { lastFoot = foot; if (moving > 0.4 && !seating && jumpHeight === 0) fxSound('step', Math.min(1.2, moving / SPEED) * (crouching ? 0.45 : 1)); } }
    actCharacter(me, { crouch: crouching && !seating, guard: guarding && !seating, hold: !!held, hold2: !!drink && !seatedCup() }, dt, t);
    if (jumpPrep > 0 && (jumpPrep -= dt) <= 0) { jumpPrep = 0; if (!seating) verticalSpeed = 4.1; } // finita la spinta: si salta
    if (verticalSpeed !== 0 || jumpHeight > 0) {
      const gravity = 13, inAir = jumpHeight > 0;
      jumpHeight = Math.max(0, jumpHeight + verticalSpeed * dt - .5 * gravity * dt * dt);
      verticalSpeed = jumpHeight > 0 ? verticalSpeed - gravity * dt : 0;
      if (inAir && jumpHeight === 0) { fxSound('land', 0.9); me.landBend = 0.28; } // si tocca terra: suono e ginocchia piegate
      me.root.position.y += jumpHeight;
    }
    const floor=cinemaFloor(pos.x,pos.z)+(stools[seating?.stool]?.y??0);
    me.root.position.y+=floor;
    blob.scale.setScalar(1 - jumpHeight * .24);
    if(seating){
      me.root.position.y=floor-.16;
      sitJoints(me);
    }
    blob.position.set(pos.x, floor+0.008, pos.z);
    // cosa c'è vicino
    let best = null, bd = 1e9;
    for (const s of spots) { const d = rectDist(s, pos.x, pos.z); if (d < s.pad && d < bd) { bd = d; best = s; } }
    if (!touch && !best?.balilla) {
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
      let ba = 0.45;
      for (const s of spots) {
        const d = rectDist(s, pos.x, pos.z); if (d > s.pad * 1.8) continue;
        const qx = Math.max(s.x - s.hx, Math.min(s.x + s.hx, pos.x + fx * 0.8)) - pos.x, qz = Math.max(s.z - s.hz, Math.min(s.z + s.hz, pos.z + fz * 0.8)) - pos.z;
        const l = Math.hypot(qx, qz); if (l < 0.05) continue;
        const a = Math.acos(Math.max(-1, Math.min(1, (qx * fx + qz * fz) / l)));
        if (a < ba) { ba = a; best = s; }
      }
    }
    if (best !== near) {
      near = best;
      actB.hidden = !near;
      if (near?.pong) actB.textContent = monitor ? 'Spegni Pong · '+(touch?'tocca il monitor':'racchetta I/K') : 'Avvia Pong'+(touch?'':' (E)');
      else if (near?.balilla) actB.textContent = near.label + (touch ? ' · Gioca' : ' · Gioca (E)');
      else if (near) actB.textContent = (near.sit||near.seat?'':near.vend?'Usa · ':'Apri · ') + near.label + (touch ? '' : '  (E)') + (near.stool!=null&&!touch ? ' · Prendi (G)' : '');
    }
    // macchinetta che sta usando un altro: si vede chi, e non si può usare
    if (near?.machine) { const who = machineBusy(near.machine), text = who ? near.label + ' · la sta usando ' + who : 'Usa · ' + near.label + (touch ? '' : '  (E)'); if (actB.textContent !== text) actB.textContent = text; }
    if (vendMode) { near = null; actB.hidden = true; } // davanti alla macchinetta c'è solo «Esci»
    ring.visible = !!near && !!near.mq;
    for (const s of spots) if (s.mq) s.mq.material.color.setScalar(s === near ? 2.4 + Math.sin(t * 6) * 0.5 : 1.8);
    if (near && near.mq) { ring.position.set(near.x, 0.012, near.z); ring.rotation.z = t; }
    if(!reducedMotion&&pos.x < -6){
      banks[0].emissiveIntensity=.85+.22*Math.sin(t*.84);
      banks[1].emissiveIntensity=.85+.22*Math.sin(t*.84+Math.PI);
    }
    if(!reducedMotion)for(const m of motes)m.rotation.y+=dt*.012;
    if(t-boardAt>2){boardAt=t;paintBoard()}
    for(const demo of demoMaterials){
      if(reducedMotion||Math.abs(pos.x-demo.x)>12)continue;
      demo.sweep.position.y=1.16+((t*.29+demo.offset)%1)*.39;
    }
    const where = roomOf(pos.x, pos.z);
    if (whereEl.textContent !== where) whereEl.textContent = where;
    lightRoom(where);
    // Zona operativa: porta, neon e il nero che sale verso il fondo; in fondo la Lobby si spegne (app.enterZone)
    const zoneDepth=corridor.update(pos,dt,t);
    if(zoneDepth<.3)zoneArmed=true; // tornando dal gioco si parte già in fondo: si riparte solo dopo essere tornati indietro
    if(!zoneLeaving)zoneFade.style.opacity=zoneArmed?String(Math.max(0,zoneDepth-.55)/.45*.75):'0';
    if(!zoneLeaving&&zoneArmed&&pos.z<ZONE.end&&inZone(pos.x,pos.z)&&app.enterZone){
      zoneLeaving=true;resetMovement();zoneFade.style.transition='opacity .9s';zoneFade.style.opacity='1';
      zoneFade.textContent='Spengo la Lobby…';setTimeout(()=>app.enterZone(),950);
    }
    // telecamera dietro il personaggio, che non passa i muri
    tgt.set(pos.x, floor+1.45 + jumpHeight * .42, pos.z);
    tmp.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    ray.set(tgt, tmp); ray.far = cam.dist;
    const hit = ray.intersectObjects(wallMeshes, false)[0];
    const d = hit ? Math.max(0.6, hit.distance - 0.25) : cam.dist;
    camera.position.copy(tgt).addScaledVector(tmp, d);
    camera.position.y = Math.min(H - 0.15, camera.position.y); // stessa altezza in tutte le sale, anche nel cinema più alto
    camera.lookAt(tgt);
    // macchinetta: davanti al pannello, a un metro, all'altezza degli occhi; si anima solo da vicino
    if(vendMode){
      // abbastanza lontano da vedere tutta la larghezza (1,1 m) anche su uno schermo stretto, almeno 1,15 m
      const half=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
      const d=Math.max(1.15,.62/Math.tan(half));
      if(atMachine==='pop'){
        // carrello: largo 0,9 m col tetto, alto 1,9 m
        const dp=Math.max(1.25,.5/Math.tan(half));
        camera.position.set(POP.x,1.32,POP.z-dp);camera.lookAt(POP.x,1.08,POP.z);
      }else{camera.position.set(VEND.x-.05,1.3+.1*Math.min(1,d/2),VEND.z-d);camera.lookAt(VEND.x-.05,1.02,VEND.z)}
    }
    if(vend&&(atMachine==='vend'||Math.hypot(pos.x-VEND.x,pos.z-VEND.z)<9))vend.update(dt,performance.now());
    if(pop&&(atMachine==='pop'||Math.hypot(pos.x-POP.x,pos.z-POP.z)<10))pop.update(dt);
    if(held){held.update(dt);toHand(me,held.group)}
    if(drink){
      drink.update(dt);mySip+=dt;
      // seduti al cinema la cola sta nel portabicchiere e a ogni sorso sale verso di te; se no in mano (sinistra)
      const at=seatedCup()?holderAt(pos.x,pos.z):null;
      if(at){mouth.copy(camera.position).y-=.18;cupInHolder(drink.group,at,mySip,mouth)}
      else{drink.group.scale.setScalar(HELD_SCALE);toHand(me,drink.group,1)}
    }
    if(seating){
      standButton.hidden=!touch;seatActions.hidden=!touch&&enterButton.hidden;
      actB.hidden=true;
      cam.yaw+=(Number(keys.has('arrowleft'))-Number(keys.has('arrowright')))*dt*1.7;
      cam.pitch=THREE.MathUtils.clamp(cam.pitch+(Number(keys.has('arrowdown'))-Number(keys.has('arrowup')))*dt,-.65,.8);
      stick.hidden=true;camera.position.set(pos.x,floor+1.12,pos.z+.06);
      camera.lookAt(pos.x-Math.sin(cam.yaw)*Math.cos(cam.pitch),floor+1.12-Math.sin(cam.pitch),camera.position.z-Math.cos(cam.yaw)*Math.cos(cam.pitch));
    }

  }

  // Fotogrammi: al massimo 60 al secondo (30 sui telefoni lenti) anche sugli schermi a 90-120 Hz; da fermi
  // (telecamera immobile da più di un secondo e mezzo, niente partita, niente film) 30. Prima sempre al massimo.
  const slowPhone = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency || 8) <= 4;
  let lastDraw = 0, frameGap = 0, stillSince = 0, drawnAt = 0;
  // guardia: con la 3D aperta e visibile, se per più di un secondo e mezzo non si è disegnato niente il ciclo riparte
  setInterval(() => { if (active && !document.hidden && !asleep && performance.now() - drawnAt > 1500) { cancelAnimationFrame(raf); lastDraw = 0; raf = requestAnimationFrame(frame); } }, 1000);
  // partite vere sui tavoli: collegate solo con la 3D visibile e tu nella sala tavoli o davanti alla porta (z < -4,5)
  setInterval(() => tableLive.watch(active && !document.hidden && !asleep && pos.z < -4.5 && pos.x > -7.3), 1000);
  const camWas = new THREE.Vector3(), camLook = new THREE.Quaternion();
  function frame(now) {
    if (!active) return;
    if (lastDraw && now >= lastDraw && now - lastDraw < frameGap - 2) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now; drawnAt = performance.now();
    if (!seating && !playing() && !monitor && !boardOpen) restoreActivityView();
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; t += dt;
    stepStools(dt);
    step(dt);
    const listenerYaw=Math.atan2(-camera.matrixWorld.elements[2],camera.matrixWorld.elements[0]);
    window.binottolandClubRadio?.locate?.(speakers,pos,listenerYaw);
    for(const [index,demo] of demoMaterials.entries()){
      const dx=demo.ax-pos.x,dz=demo.az-pos.z;
      const distance=Math.hypot(dx,dz),fall=Math.max(0,1-distance);
      const gain=fall*fall*(3-2*fall);
      const pan=THREE.MathUtils.clamp((dx*Math.cos(listenerYaw)-dz*Math.sin(listenerYaw))/Math.max(.25,distance),-1,1);
      if(monitor?.spot.sweep===demo.sweep){monitor.frame.contentWindow.cabinetMonitor?.mix(gain,pan);continue}
      if(gain<=0||!soundAllowed()||audioContext?.state!=='running'||now<(demo.nextTone||0))continue;
      demo.nextTone=now+420+(index%5)*140;
      const ac=audioContext,note=ac.createOscillator(),amp=ac.createGain(),stereo=ac.createStereoPanner();
      note.type=index%2?'triangle':'sine';note.frequency.value=[196,262,330,392][(index+Math.floor(t*1.5))%4];
      stereo.pan.value=pan;const at=ac.currentTime;amp.gain.setValueAtTime(.0001,at);
      amp.gain.exponentialRampToValueAtTime(Math.max(.00011,gain*.034),at+.008);amp.gain.exponentialRampToValueAtTime(.0001,at+.10);
      note.connect(amp).connect(stereo).connect(ac.destination);note.start();note.stop(at+.11);
    }
    if(monitor?.texture && now-monitor.last>=32){monitor.texture.needsUpdate=true;monitor.last=now}
    if(!active)return;
    const opening=THREE.MathUtils.clamp(1-Math.hypot(pos.x,pos.z-6.22)/2.4,0,1);
    for(const panel of curtains)panel.scale.x=THREE.MathUtils.lerp(panel.scale.x,1-opening*.67,1-Math.exp(-dt*7));
    for(const d of doorCurtains)for(const p of d.panels)p.scale.x=.33; // tende delle sale sempre aperte (raccolte ai lati)
    const inRange=pos.z>6.15 || (pos.z>0 && Math.abs(pos.x)<1.65);
    clubInRange=inRange && Math.abs(pos.x)<7 && pos.z<CINEMA_END-.25;
    const depth=pos.z-6.23;
    const signedDistance=depth>0 && Math.abs(pos.x)<7 ? depth : -Math.hypot(Math.max(0,Math.abs(pos.x)-1.45),Math.min(0,depth));
    const blend=THREE.MathUtils.clamp((signedDistance+1)/2,0,1);
    const target=cinemaLevel*Math.sin(blend*Math.PI/2);
    heard=target;
    window.binottolandClubRadio?.setClubGain?.(blend===1?0:Math.cos(blend*Math.PI/2));
    if(previewVideo){const v=THREE.MathUtils.clamp(heard,0,1);if(mediaNodes.length&&cinemaGain){cinemaGain.gain.value=v;previewVideo.volume=1}else previewVideo.volume=v}
    const ytLevel=Math.round(heard*100);
    if(yt&&ytLevel!==lastYT){yt.setVolume(ytLevel);lastYT=ytLevel}
    const audible=heard>.001 || target>.001;
    cinemaVolume.wrap.style.display=depth>0&&Math.abs(pos.x)<7&&previewKey?'flex':'none'; // solo dentro la Sala Cinema
    radioVolume.wrap.style.display=(Math.hypot(pos.x-counterX,pos.z-counterZ)<3)?'flex':'none';
    if(avail.has('lavagna-spazio-libero')&&t>nextBoard&&Math.abs(pos.x)<7&&Math.abs(pos.z)<6.3){
      nextBoard=t+2;app.gallery?.({room:boardRoom,epoch:boardEpoch,since:boardSeq},drawGallery);
    }
    if(audibleZone!==audible){
      audibleZone=audible;
      if(previewVideo)previewVideo.muted=!(audible&&soundEnabled);
      if(yt){if(audible&&soundEnabled)yt.unMute();else yt.mute()}
    }
    locandina(app.projection?.());playProjection(app.projection?.());
    const insideArcade=pos.x< -7&&Math.abs(pos.z)<6.15;
    const doorDepth=insideArcade?-7-pos.x:-Math.hypot(Math.max(0,pos.x+7),Math.max(0,Math.abs(pos.z)-1.3));
    const mix=THREE.MathUtils.clamp((doorDepth+1)/2,0,1);
    tableRoomGain=mix*mix*(3-2*mix);
    if(tableBus)tableBus.gain.value=tableLevel*tableRoomGain;
    tableVolume.wrap.style.display=tableRoomGain>0&&!pinball.active&&!(touch&&tableFootball.active)&&Math.hypot(pos.x+13,pos.z)<3?'flex':'none'; // vicino al calcio balilla; da telefono non mentre giochi (coprirebbe il tavolo)
    const nearPinball=Object.values(tables).some(t=>{const s=t.stand();return Math.hypot(pos.x-s.x,pos.z-s.z)<3});
    pinballVolume.wrap.style.display=!tableFootball.active&&!(touch&&pinball.active)&&nearPinball?'flex':'none'; // vicino ai flipper
    pinballExit.style.display=touch&&pinball.active?'':'none';
    // flipper: tabellone, lampadine e display solo se sei in sala giochi lì vicino (o ci stai giocando)
    peerDt=dt;tableFootball.update(camera,dt,tableRoomGain>0);for(const t of Object.values(tables)){const s=t.stand();t.update(camera,dt,pinball.active||(tableRoomGain>0&&Math.hypot(pos.x-s.x,pos.z-s.z)<9))}placePeers();
    localPose=currentPose();const poseKey=JSON.stringify(localPose);
    // la posa va al server quando cambia, al massimo 5 volte al secondo (l'ultima arriva sempre)
    const nowMs=performance.now();
    if(poseKey!==lastPoseKey&&nowMs-lastPoseSent>=200){lastPoseKey=poseKey;lastPoseSent=nowMs;app.poseChanged?.()}
    if(!localPose||localPose.station==='walk')for(const arm of me.arms){arm.scale.y=1;arm.rotation.y=0}
    const anchor=modelPose(me,localPose);
    me.head.visible=!firstPerson;
    // al calcio balilla il tuo personaggio non copre il tavolo nella tua vista (gli altri lo vedono alle manopole)
    if(!seating&&!vendMode)me.root.visible=!playing()&&!boardOpen;
    // al calcio balilla la telecamera la decide il tavolo (dal tuo lato, o dall'alto sullo stesso telefono)
    if(firstPerson&&!seating&&!playing()&&!boardOpen){
      const yaw=anchor?.yaw??cam.yaw;
      if(!anchor)me.root.rotation.y=yaw;
      const eyeY=anchor?EYE_Y:me.root.position.y+EYE_Y;
      camera.position.set(me.root.position.x-.09*Math.sin(yaw),eyeY,me.root.position.z-.09*Math.cos(yaw));
      if(anchor){
        const target=localPose.station==='balilla'?new THREE.Vector3(-13,.74,0):new THREE.Vector3(anchor.x-.55*Math.sin(yaw),1.34,anchor.z-.55*Math.cos(yaw));
        camera.lookAt(target);
      }else camera.lookAt(camera.position.x-Math.sin(yaw),eyeY-Math.tan(cam.pitch),camera.position.z-Math.cos(yaw));
    }
    if(playing()){stick.hidden=true;actB.hidden=true}else if(!seating){stick.hidden=!touch||boardOpen;actB.hidden=!near||boardOpen}
    moves.hidden=!touch||seating||playing()||boardOpen||!!parked;
    if(!helpPanel.hidden)renderHelp(); // l'elenco segue quello che stai facendo
    topBar.style.visibility=touch&&playing()?'hidden':''; // da telefono al calcio balilla e al flipper la barra in alto sparisce
    if(lookStick.hidden!==stick.hidden){lookStick.hidden=stick.hidden;if(stick.hidden){lookJoy.id=null;lookJoy.x=lookJoy.y=0;lookKnob.style.transform=''}}
    if(boardOpen)focusBoard();alignProjection();projectorTick(now);renderer.render(scene, camera);
    if(camWas.distanceToSquared(camera.position)>1e-8||1-Math.abs(camLook.dot(camera.quaternion))>1e-8){camWas.copy(camera.position);camLook.copy(camera.quaternion);stillSince=now}
    const busy=playing()||pinball.active||tableFootball.active||!!monitor||boardOpen||!projection.hidden||joy.id!==null||keys.size>0;
    frameGap=slowPhone||(!busy&&now-stillSince>1500)?1000/30:1000/60;
    countStats(now);
  }
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- apri, mostra, nascondi ----------
  let seating=null,returnPoint=null,monitor=null;
  function toggleMonitor(spot) {
    if(monitor){stopMonitor();return}
    const frame=document.createElement('iframe');
    frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:absolute;top:0;left:0;width:2px;height:2px;opacity:0;pointer-events:none;border:0';
    const session={frame,spot,idle:spot.screen.material.map,texture:null,last:-Infinity};
    monitor=session;pongAnchor={...pos,slot:freeSeat(spot)};setFirst(true);
    frame.onload=()=>{
      if(monitor!==session)return;
      const canvas=frame.contentWindow.cabinetMonitor?.canvas;
      if(!canvas){stopMonitor();return}
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
      session.texture=texture;spot.screen.material.map=texture;spot.sweep.visible=false;
    };
    frame.src='/arcade/pong.html?monitor=1';el.append(frame);near=null;
  }
  function stopMonitor(){
    if(!monitor)return;
    const {frame,spot,idle,texture}=monitor;monitor=null;pongAnchor=null;
    spot.screen.material.map=idle;spot.sweep.visible=true;texture?.dispose();frame.remove();near=null;
  }
  const monitorRay=new THREE.Raycaster(),pointerNDC=new THREE.Vector2();
  function aimAtMonitor(e){
    if(!monitor?.texture || Math.hypot(pos.x-monitor.spot.x,pos.z-monitor.spot.z)>2.4)return false;
    const bounds=host.getBoundingClientRect();
    if(locked())pointerNDC.set(0,0); // col mouse agganciato si mira con il centro della vista
    else pointerNDC.set(2*(e.clientX-bounds.left)/bounds.width-1,1-2*(e.clientY-bounds.top)/bounds.height);
    monitorRay.setFromCamera(pointerNDC,camera);
    const hit=monitorRay.intersectObject(monitor.spot.screen,false)[0];
    if(!hit)return false;
    monitor.frame.contentWindow.cabinetMonitor.aim(1-hit.uv.y);return true;
  }
  const seatActions=document.createElement('div');
  // seduti: "Entra nel cinema" / "Alzati"; sul telefono nella colonna in basso a sinistra, al posto del tasto d'azione
  seatActions.style.cssText=touch?'display:flex;gap:6px;flex-wrap:wrap;order:3':'position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 8px);left:50%;transform:translateX(-50%);white-space:nowrap';
  const enterButton=document.createElement('button'),standButton=document.createElement('button');
  enterButton.textContent='Entra nel cinema';standButton.textContent='Alzati';seatActions.append(enterButton,standButton);(touch?dock:el).append(seatActions);seatActions.hidden=true;
  function stand(){
    if(!seating)return;
    if(seating.stool!=null)app.stoolSend?.({type:'stool',action:'stand',id:seating.stool,height:stools[seating.stool].height});
    camera.up.set(0,1,0);seating=null;seatActions.hidden=true;Object.assign(pos,returnPoint);collide(pos);me.root.visible=true;
    stick.hidden=!touch;near=null;resetMovement();
  }
  // tasto «?»: i comandi di quello che stai facendo (camminare, sgabello, flipper, balilla, Pong), diversi per
  // telefono e computer; l'elenco completo è in Impostazioni. Stesse righe in help.js
  const helpButton=document.createElement('button');helpButton.textContent='?';
  helpButton.setAttribute('aria-label','Comandi');helpButton.setAttribute('aria-expanded','false');if(!touch)helpButton.title='Comandi (H)';
  helpButton.style.cssText='position:absolute;right:calc(var(--ui-safe-right,0px) + 12px);top:calc(var(--ui-safe-top,0px) + 64px);z-index:6;width:38px;min-width:38px;height:38px;min-height:38px;padding:0;margin:0;border-radius:50%;font-weight:700;font-size:17px';
  const helpPanel=document.createElement('div');helpPanel.setAttribute('role','dialog');helpPanel.setAttribute('aria-label','Comandi');helpPanel.hidden=true;
  helpPanel.style.cssText='position:absolute;right:calc(var(--ui-safe-right,0px) + 12px);top:calc(var(--ui-safe-top,0px) + 110px);z-index:6;width:min(340px,calc(100vw - 24px));max-height:60vh;overflow:auto;padding:10px 14px;border-radius:12px;background:rgba(10,8,16,.9);color:#fff;font:13px/1.45 system-ui,sans-serif;touch-action:pan-y;user-select:text';
  el.append(helpButton,helpPanel);
  let helpKey='';
  function helpContext(){return tableFootball.active?'balilla':pinball.active?'pinball':monitor?'pong':(seating?.stool!=null||carrying!==null||near?.stool!=null)?'stool':'walk'}
  function renderHelp(){
    const key=helpContext();if(key===helpKey)return;helpKey=key;
    const {title,rows}=helpFor(key,touch),head=document.createElement('b'),list=helpList(rows),more=document.createElement('p');
    head.style.cssText='display:block;font-size:15px;margin-bottom:4px';head.textContent=title;
    list.style.cssText='margin:0;padding-left:18px';
    more.style.cssText='margin:6px 0 0;color:#cfc6e6;font-size:12px';more.textContent='Tutti i comandi: Impostazioni → Personaggio e pallina';
    helpPanel.replaceChildren(head,list,more);
  }
  function toggleHelp(open=helpPanel.hidden){
    helpPanel.hidden=!open;helpButton.setAttribute('aria-expanded',String(open));helpButton.classList.toggle('on',open);
    if(open){helpKey='';renderHelp()}
  }
  helpButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();toggleHelp()});
  helpButton.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggleHelp()}});
  helpPanel.addEventListener('pointerdown',e=>e.stopPropagation());
  enterButton.onclick=()=>{if(seating){const seat=seating;parked=currentPose();hide();seat.act();app.launched?.(seat)}};
  standButton.onclick=stand;
  // primo posto libero al cabinato (gli altri giocatori del club lo occupano con la loro posa)
  function freeSeat(s){
    const mine=String(app.me?.()?.id??'');
    const taken=new Set((app.peers?.()||[]).filter(u=>u.clubPose?.station===s.station&&String(u.id)!==mine).map(u=>u.clubPose.slot|0));
    for(let k=0;k<(s.seats||1);k++)if(!taken.has(k))return k;
    return 0;
  }
  function launch(s,approved=false) {
    if(carrying!==null||requested)return;
    if(s.stool!=null&&!approved){if(!seating)stoolRequest(s.stool,'sit');return}
    if(document.pointerLockElement&&!s?.balilla&&!s?.seat&&!s?.sit)document.exitPointerLock?.();
    if(seating||playing())return;
    saveActivityView();
    if (s.board) { s.act(); return; }
    if(s.balilla){resetMovement();tableFootball.open(s.team,s.pair);return}
    if(s.pinball){resetMovement();pinballKind=s.pinball;pinball.open();near=null;return} // al flipper: si gioca dalla barra
    if(s.pong){toggleMonitor(s);return}
    if(s.seat){
      // divani dell'atrio e sedie dei tavoli: ci si siede (se il posto è libero), "Alzati" per tornare a camminare
      const taken=(app.peers?.()||[]).some(u=>u.clubPose?.station==='seat'&&Math.abs(u.clubPose.x-s.px)<.15&&Math.abs(u.clubPose.z-s.pz)<.15);
      if(taken)return;
      resetMovement();returnPoint={...pos};seating=s;seatActions.hidden=false;enterButton.hidden=true;actB.hidden=true;stick.hidden=true;cam.pitch=.12;
      pos.x=s.px;pos.z=s.pz;heading=s.yaw;cam.yaw=s.yaw;me.root.visible=false;
      return;
    }
    if(s.sit){
      resetMovement();returnPoint={...pos};seating=s;seatActions.hidden=false;enterButton.hidden=false;actB.hidden=true;stick.hidden=true;cam.pitch=.03;
      pos.x=s.x;pos.z=s.z;heading=Math.PI;cam.yaw=Math.PI;
      // posto libero sul divano da due: a sinistra se non c'è già qualcuno
      const free=[-.3,.3].find(off=>!(app.peers?.()||[]).some(u=>u.clubPose?.station==='seat'&&Math.abs(u.clubPose.x-(s.x+off))<.12&&Math.abs(u.clubPose.z-s.z)<.3));
      if(free===undefined){stand();return}
      s.side=free;pos.x=s.x+s.side;
      me.root.visible=false;
      return;
    }
    if(s.radio){resetMovement();s.act();return}
    if(s.vend){enterMachine(s.machine);return} // macchinetta: visuale davanti al pannello, la 3D resta aperta
    if(s.station)parked={station:s.station,slot:freeSeat(s)};
    hide();
    s.act();
    // anche Ruggine 89 passa da app.open (margini di Telegram, tasto Indietro, 3D ferma): analisi 10.7
    if (app.launched) app.launched(s);
  }
  function show() {
    if (active) return;
    restoreActivityView();
    parked=null;playProjection(app.projection?.());syncTransport(true);el.hidden = false; active = true; last = 0;
    classicPage(true);
    app.clubVisibility?.();setTag();
    // trascinare in giù (joystick, pad dei giochi) non deve chiudere o ridurre la mini app di Telegram
    try { const tg = window.Telegram?.WebApp; if (tg?.isVersionAtLeast?.('7.7')) tg.disableVerticalSwipes(); } catch {}
    // l'aspetto può essere cambiato in Settings
    const look = readAppearance();
    setLook(me, readLook());
    resize();
    lightRoom(roomOf(pos.x, pos.z));
    renderer.render(scene, camera);
    $('.l3d-load').hidden = true;
    raf = requestAnimationFrame(frame);
    // prepara subito le luci di tutte le sale: entrando per la prima volta in una sala non si blocca
    setTimeout(() => { prepareLights(); }, 1200);
    setTimeout(prepareLights, 1500);
  }
  // la pagina classica sotto la 3D si spegne (inert): con Tab il fuoco resta nella 3D invece di finire su tasti che
  // non si vedono. Solo le schede e le pagine, non i riquadri dei giochi e i dialoghi che si aprono sopra
  function classicPage(off){
    for(const node of document.querySelectorAll('#app-shell>nav.tabs,#app-shell>section.page'))node.inert=off;
  }
  function hide() {
    classicPage(false);toggleHelp(false);
    if (document.pointerLockElement) document.exitPointerLock?.();
    if(carrying!==null||requested)app.stoolSend?.({type:'stool',action:'cancel',id:carrying??requested.id});
    carrying=null;requested=null;closeBoard();
    tableRoomGain=0;if(tableBus)tableBus.gain.value=0;tableFootball.close();if(pinball.active)pinball.close();stand();stopMonitor();heard=0;
    try { const tg = window.Telegram?.WebApp; if (tg?.isVersionAtLeast?.('7.7')) tg.enableVerticalSwipes(); } catch {}
    active = false;clubInRange=false;app.clubStream?.(null);audibleZone=false;app.clubVisibility?.();quietProjection();cancelAnimationFrame(raf);
    resetMovement(); drags.clear(); joy.id = null; joy.x = joy.y = 0; knob.style.transform = '';
    el.hidden = true;
  }
  // Spegnimento vero (in fondo al corridoio della Zona operativa): via tutto, perché il gioco abbia il telefono per
  // sé. Ascoltatori e intervalli (annotati in createLobby3D), collegamenti, film, audio, poi geometrie, materiali e
  // texture e infine la grafica stessa (contesto WebGL perso apposta). Dopo, questa Lobby non si usa più: per
  // tornare app.js ne costruisce una nuova. Restituisce quanta memoria grafica c'era e quanta ne resta.
  function destroy() {
    if (destroyed) return null;
    hide(); destroyed = true; active = false;
    cancelAnimationFrame(raf); tableLive.close(); playProjection(null);
    for (const undo of life.splice(0)) try { undo(); } catch {}
    THREE.DefaultLoadingManager.onProgress = THREE.DefaultLoadingManager.onLoad = () => {};
    const before = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    const freeMaterial = m => { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); };
    scene.traverse(o => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) freeMaterial(m);
      if (o.isInstancedMesh) o.dispose();
    });
    scene.environment?.dispose(); scene.clear();
    const after = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    try { audioContext?.close(); } catch {}
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    el.remove(); style.remove(); boardStyle.remove();
    return { before, after };
  }
  // di ritorno dal gioco: in fondo al corridoio, rivolto verso la sala giochi, con i neon che si riaccendono
  function fromZone() {
    place(ZONE.x, ZONE.end + 0.9, Math.PI, 0.12); heading = Math.PI;
    zoneArmed = false; corridor.wake(t);
  }
  // app nascosta, o mini app ridotta a icona in Telegram (sleep/wake chiamati da app.js): niente disegno, niente film
  function sleep(){app.clubStream?.(null);quietProjection();playProjection(null);resetMovement();cancelAnimationFrame(raf);last=0}
  function wake(){if(document.hidden||asleep)return;playProjection(app.projection?.());syncTransport(true);if(active){cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}}
  document.addEventListener('visibilitychange', () => { if(document.hidden)sleep();else wake() });
  // addormentata da Telegram ma qualcuno tocca o preme un tasto: chiaramente la mini app è davanti, si riparte
  const rouse = () => { if (asleep && !document.hidden) { asleep = false; wake(); app.awake?.(); } };
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, rouse, true);
  // Misure (Debug → Misure della Lobby 3D): fotogrammi al secondo, comandi di disegno, triangoli, texture
  let statsBox=null,statsFrames=0,statsAt=0;
  try{if(localStorage.getItem('binottoland-3d-stats')==='1')setStats(true)}catch{}
  function setStats(on){
    if(on&&!statsBox){statsBox=document.createElement('div');statsBox.style.cssText='position:absolute;left:calc(var(--ui-safe-left,0px) + 8px);bottom:calc(var(--ui-safe-bottom,0px) + 160px);z-index:5;padding:5px 8px;border-radius:8px;background:rgba(0,0,0,.6);font:11px/1.35 ui-monospace,monospace;color:#bff5c8;white-space:pre;pointer-events:none';el.append(statsBox);statsFrames=0;statsAt=performance.now()}
    else if(!on&&statsBox){statsBox.remove();statsBox=null}
  }
  function countStats(now){
    if(!statsBox)return;statsFrames++;
    if(now-statsAt<1000)return;
    const i=renderer.info,fps=Math.round(statsFrames*1000/(now-statsAt));statsFrames=0;statsAt=now;
    statsBox.textContent=`${fps} fps · max ${Math.round(1000/(frameGap||16.7))}${slowPhone?' (telefono lento)':''}\ndisegni ${i.render.calls} · triangoli ${Math.round(i.render.triangles/1000)}k\ntexture ${i.memory.textures} · geometrie ${i.memory.geometries} · programmi ${i.programs?.length??'?'}\nluci accese ${roomLights.filter(r=>r.light.visible).length} · ${litRoom||'-'}`;
  }
  // place(): sposta il personaggio (per le prove), near(): cosa si può aprire adesso
  const place = (x, z, yaw = cam.yaw, pitch = cam.pitch) => { pos.x = x; pos.z = z; cam.yaw = yaw; cam.pitch = pitch; collide(pos); };
  // Luci per stanza: ogni luce in più pesa su ogni oggetto disegnato (sui telefoni si sente). Si accendono solo
  // quelle della stanza dove sei e dell'atrio; dall'atrio, che vede tutte le porte, la luce principale di ogni sala.
  // Le combinazioni si preparano subito dopo l'apertura, così cambiare stanza non dà scatti.
  const roomOf = (x, z) => (inZone(x, z) ? 'Zona operativa' : z > 6.15 ? 'Sala cinema' : z < -6.15 ? 'Sala tavoli' : x > 7 ? 'Sala biliardo' : x < -7 ? 'Sala giochi' : 'Lobby');
  const roomLights = [];
  const mainLight = new Map();
  let litRoom = '';
  // l'elenco si rifà quando arrivano i modelli: le luci dei flipper nascono dopo e prima restavano accese ovunque
  function collectLights() {
    roomLights.length = 0; mainLight.clear();
    const at = new THREE.Vector3();
    scene.traverse((o) => { if (o.isLight && !o.isHemisphereLight) { o.getWorldPosition(at); roomLights.push({ light: o, room: roomOf(at.x, at.z) }); } });
    for (const r of roomLights) if (r.room !== 'Lobby' && !r.light.isSpotLight && r.light.intensity > 0 && (!mainLight.has(r.room) || r.light.intensity > mainLight.get(r.room).intensity)) mainLight.set(r.room, r.light);
    const keep = litRoom; litRoom = ''; if (keep) lightRoom(keep);
  }
  collectLights();
  function lightRoom(where) {
    if (where === litRoom) return;
    litRoom = where;
    for (const { light, room } of roomLights) light.visible = room === where || room === 'Lobby' || (where === 'Lobby' && mainLight.get(room) === light);
  }
  let lightsReady = false;
  async function prepareLights() {
    if (destroyed) return;
    collectLights();
    if (lightsReady || !renderer.compileAsync) return;
    lightsReady = true;
    const keep = litRoom;
    for (const room of ['Lobby', 'Sala biliardo', 'Sala giochi', 'Sala tavoli', 'Sala cinema', 'Zona operativa']) {
      if (destroyed) return;
      if (room === keep) continue;
      // compileAsync legge le luci subito: si rimettono quelle giuste prima di aspettare, così non si vede niente
      lightRoom(room);
      const done = renderer.compileAsync(scene, camera);
      lightRoom(keep);
      try { await done; } catch (e) { /* si compila al primo passaggio */ }
    }
  }
  // per lo splash: quanto è caricato, da 0 a 1. Modelli e texture, poi le luci di tutte le sale preparate, poi il
  // film del cinema se ce n'è uno in proiezione (la radio no: il browser la fa suonare solo dopo il primo tocco)
  function loadingState() {
    // il film non si prepara più durante lo splash: parte quando entri in sala cinema
    const models = loading.total ? loading.done / loading.total : 0;
    const lights = loading.warm || (loading.idle && !renderer.compileAsync);
    const film = !previewKey || projectionReady === previewKey;
    const progress = Math.min(models, 1) * 0.8 + (lights ? 0.12 : 0) + (film ? 0.08 : 0);
    return { progress, ready: loading.idle && lights && film };
  }
  const api = { loading: loadingState, stoolDisconnected(){carrying=null;requested=null;if(seating?.stool!=null)stand()}, stoolResult, setTableVolume, syncProjection:()=>playProjection(app.projection?.()), pose:descriptor, balillaState:data=>tableFootball.receive(data), lobbyReconnected(){tableFootball.reconnected?.()}, stats:setStats, notice, connection, sleep(){asleep=true;sleep()}, wake(){asleep=false;wake()}, show, hide, destroy, fromZone, place, near: () => near && near.label, where: () => ({ ...pos }), dazed: () => (me.fx?.starsUntil || 0) > t, get active() { return active; }, el };
  el.lobby3d = api;
  return api;
}
