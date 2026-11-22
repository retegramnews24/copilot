// Lobby 3D: un "guscio" facoltativo della Lobby. Si cammina con il proprio personaggio tra
// l'atrio (la lavagna apre Settings, il cartellone apre Giochi), la sala biliardo (vicino a un tavolo "Apri" apre
// il Biliardo, con i tavoli veri del gioco) e la sala arcade (ogni cabinato apre il suo gioco).
// Non rifà nessuna schermata: chiede all'app di aprire quelle che ci sono già, e intanto il mondo 3D si ferma.
import {buildFlipper, FLIPPER_AT} from './flipper3d.js?v=112a64ec4e';
import {buildBalilla} from './balilla.js?v=38634e7426';
import {playBalillaSound} from './balilla-sounds.js?v=b6a48f4677';
import {soundAllowed} from '../sound-pref.js';
import * as THREE from 'three';
import {BOARD_WIDTH,BOARD_HEIGHT,CHALKS,ERASER,DEFAULT_SIZE} from '../blackboard/chalk.js?v=4027e504f0';
import {embedYouTube} from '../cinema/youtube.js?v=c237aa9fc5';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { Table3D, CLOTHS } from '../biliardo/scene3d.js?v=47e47e2969';
import * as E from '../biliardo/engine.js?v=725086e1a6';
import { readAppearance, readLook } from '../appearance.js?v=a866c9e8ce';
import { canvasTex, neonText, parquet, wallFinish, tiles, neonGrid, blackboard, gamesPoster, cabinetScreen, nameTag, blobTex } from './textures.js?v=faa543f96e';
import { makeCharacter, animateCharacter, actCharacter, setLook, SPEED, ARM_LEN, EYE_Y } from './character.js?v=8c167441b8';
import { gameTitle } from '../game-info.js?v=dab50e1d8e';
import { roundBoxGeometry } from './shapes.js?v=acaec08552';

const H = 3.4; // altezza delle stanze
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
  ['labyrinth', 'Labyrinth', '#7d6bd6'],
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
.l3d button{font:inherit;color:#fff;background:rgba(18,14,28,.72);border:1px solid rgba(255,255,255,.22);border-radius:12px;padding:9px 13px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer}
.l3d-where{margin-left:auto;padding:7px 12px;border-radius:999px;background:rgba(18,14,28,.6);font-weight:600;font-size:14px}
.l3d-hint{position:absolute;left:50%;transform:translateX(-50%);top:calc(var(--ui-safe-top,0px) + 58px);padding:6px 12px;border-radius:10px;background:rgba(0,0,0,.45);font-size:13px;color:#e7e1f3;text-align:center;max-width:86vw;transition:opacity .6s;pointer-events:none}
.l3d-act{position:absolute;left:50%;bottom:calc(var(--ui-safe-bottom,0px) + 34px);transform:translateX(-50%);width:auto!important;max-width:90vw;margin:0;font-weight:700!important;font-size:17px!important;padding:13px 24px!important;background:linear-gradient(180deg,#ffcf4a,#f29d1c)!important;color:#2a1600!important;border:0!important;box-shadow:0 6px 24px rgba(255,180,40,.45);white-space:nowrap}
.l3d-act[hidden]{display:none}
.l3d-stick{position:absolute;left:calc(var(--ui-safe-left,0px) + 26px);bottom:calc(var(--ui-safe-bottom,0px) + 26px);width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.25);pointer-events:none}
.l3d-stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.6)}
.l3d-stick[hidden]{display:none}
.l3d-load[hidden]{display:none}
.l3d-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:16px;color:#cfc6e6;pointer-events:none}
`;

// ---------- il mondo ----------
export function createLobby3D(app) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const el = document.createElement('div');
  el.className = 'l3d'; el.hidden = true;
  el.innerHTML = `<div class="l3d-gl"></div><div class="l3d-load">Carico la Lobby 3D…</div>
<div class="l3d-top"><button class="l3d-exit" aria-label="Torna alla Lobby classica">✕ Lobby classica</button><span class="l3d-where">Lobby</span></div>
<div class="l3d-hint"></div><button class="l3d-act" hidden></button><div class="l3d-stick" hidden><i></i></div>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const host = $('.l3d-gl'), actB = $('.l3d-act'), whereEl = $('.l3d-where'), hint = $('.l3d-hint'), stick = $('.l3d-stick'), knob = stick.firstChild;
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  stick.hidden = !touch;
  const dot = document.createElement('div');
  dot.style.cssText = 'position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:rgba(255,255,255,.4);box-shadow:0 0 1px rgba(0,0,0,.5);pointer-events:none;z-index:3';
  dot.hidden = touch; host.append(dot);
  hint.hidden = true; // i comandi sono spiegati in Settings → Personaggio e pallina
  hint.textContent = touch ? 'Muoviti con il cerchio in basso, trascina il dito per girare la vista' : 'WASD o frecce · Shift sinistro per correre · Spazio per saltare · trascina per guardarti intorno · E per aprire';

  const renderer = new THREE.WebGLRenderer({ alpha:true, antialias: true, powerPreference: 'high-performance' });
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
    // zoccolo
    const sk = std('#2a1a12', 0.6);
    // cornice sotto il soffitto, arrotondata
    const crown = x0 === -7 ? std('#efe4cf', 0.7) : std('#241c2a', 0.6);
    for (const zz of [-5.97, 5.97]) rbox(x1 - x0, 0.1, 0.07, 0.025, crown, (x0 + x1) / 2, H - 0.05, zz);
    box(x1 - x0, 0.14, 0.04, sk, (x0 + x1) / 2, 0.07, -5.98); box(x1 - x0, 0.14, 0.04, sk, (x0 + x1) / 2, 0.07, 5.98);
  };

  // --- luci di base
  scene.add(new THREE.HemisphereLight('#fff4e6', '#1a1020', 0.55));
  const point = (c, i, x, y, z, d = 12) => { const l = new THREE.PointLight(c, i, d, 1.5); l.position.set(x, y, z); scene.add(l); return l; };

  // ========== ATRIO (x -7…7) ==========
  const atriumWall = new THREE.MeshStandardMaterial({ color: '#d9ccb4', roughness: 0.9 });
  const billiardWall = new THREE.MeshStandardMaterial({ color: '#2a1c26', roughness: 0.85 });
  const arcadeWall = new THREE.MeshStandardMaterial({ color: '#16112a', roughness: 0.85 });
  room(-7, 7, parquet(), [3.5, 3], atriumWall, '#efe6d6');
  room(7, 19, tiles(158, 19, 21), [3, 3], billiardWall, '#0b070d');
  room(-19, -7, neonGrid(), [3, 3], arcadeWall, '#07050c');
  wallZ(-6.3, 6.3, 19.15, billiardWall); wallZ(-6.3, 6.3, -19.15, arcadeWall);
  doorWall(7, atriumWall, billiardWall); doorWall(-7, arcadeWall, atriumWall);
  point('#ffe0b3',7,-3.5,2.85,0,12);point('#ffe1ba',7,3.5,2.85,0,12);point('#ffd39b',4,0,2.85,-4,9);
  const sconceBrass=std('#a58052',.32,.72),sconceGlass=glow('#ffd2a0',1.28);
  for(const x of [-4.9,4.9])for(const end of [-1,1]){
    const z=end*5.89;
    box(.20,.53,.07,sconceBrass,x,2.12,z);
    box(.115,.36,.13,sconceGlass,x,2.12,z-end*.05);
    for(const y of [1.92,2.32])box(.17,.035,.16,sconceBrass,x,y,z-end*.05);
  }
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
  box(4.15,1.55,.07,std('#84663e',.38,.55),-4,2.12,5.94);
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
    for (const lx of [-0.55, 0.55]) {
      const sp = new THREE.SpotLight('#fff2df', 9, 4, Math.PI / 3.6, 0.7, 1.3);
      sp.position.set(x + lx * hx, 2.15, z); sp.target.position.set(x + lx * hx, 0.78, z); scene.add(sp, sp.target);
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
  const jb = new THREE.Group();
  box(0.9, 1.4, 0.55, std('#3a0d22', 0.4, 0.3), 0, 0.7, 0, jb);
  ['#ff2bd6', '#ffd23f', '#22d3ee'].forEach((c, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.4 - i * 0.06, 0.014, 8, 32, Math.PI), glow(c, 3)); t.position.set(0, 1.4, 0.28); jb.add(t); });
  jb.position.set(17.9, 0, -5.55); scene.add(jb); solid(17.4, 18.4, -6, -5.2);

  // Card room beyond the north doorway. Aisles run between all nine tables.
  const avail = new Set(app.games ? app.games() : [...ARCADE,...BOARD].map(a=>a[0]).concat(['cinema-streamer','blackboard-spazio-libero','biliardo']));
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
  stoolBar.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--ui-safe-bottom,0px) + 112px);display:flex;gap:4px;white-space:nowrap';
  el.append(stoolBar);
  function stoolButton(label,fn){
    const b=document.createElement('button');b.textContent=label;b.onclick=fn;stoolBar.append(b);return b;
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
  const carryButton=stoolButton('Prendi · G',toggleCarry);
  const raise=stoolButton('↑ W',()=>changeHeight(.05)),lower=stoolButton('↓ S',()=>changeHeight(-.05));
  function bounceStool(){
    const st=stools[seating?.stool];
    if(st)st.v=-.30;
  }
  const rock=stoolButton('Molleggia',bounceStool);
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
    carryButton.hidden=!showCarry;carryButton.textContent=carrying===null?'Prendi · G':'Posa · G';
    if(!touch){
      stoolBar.style.display='none';
      if(carrying!==null&&!playing()){actB.hidden=false;actB.textContent='Posa lo sgabello (G)'}
    }
    lower.hidden=raise.hidden=rock.hidden=!mine;
  }
  const darkWood=std('#2b211d',.55);
  box(2.89,.04,.45,brassTrim,0,.002,-6.16);
  const cardWall=std('#8d7665',.92);
  const carpet=tiles(157,23,24);carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(3,3);
  plane(14,11.85,new THREE.MeshStandardMaterial({map:carpet,roughness:.96}),0,0,-12.2,0,-Math.PI/2);
  plane(14,12,std('#d0bfa6',1),0,H,-12.2,0,Math.PI/2);
  wallZ(-18.3,-6.13,-7.15,cardWall);wallZ(-18.3,-6.13,7.15,cardWall);
  wallX(-7.3,7.3,-18.28,cardWall);
  point('#ffe0af',16,0,2.95,-11.2,14);
  const opal=glow('#ffe6bc',1.45);
  for(const x of [-4,0,4]){
    box(.025,.23,.025,brassTrim,x,H-.115,-12.1);
    box(1.6,.09,.18,opal,x,H-.27,-12.1);
  }
  const tabletop=(key,title)=>canvasTex(512,384,(g,w,h)=>{
    g.fillStyle='#255348';g.fillRect(0,0,w,h);
    g.fillStyle='#e1c995';g.textAlign='center';g.font='bold 26px Georgia';g.fillText(title,w/2,360);
    const disc=(x,y,r,c)=>{g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,2*Math.PI);g.fill()};
    if(['checkmate','dama-italiana','scarabeo','battaglia-navale'].includes(key)){
      const n=key==='scarabeo'?13:key==='battaglia-navale'?10:8, tile=260/n;
      for(let row=0;row<n;row++)for(let col=0;col<n;col++){
        const x=126+col*tile,y=26+row*tile;
        g.fillStyle=key==='battaglia-navale'?'#507b93':key==='scarabeo'?((row+col)%5?'#bbac88':'#bb7970'):(row+col)%2?'#715138':'#dfcba7';
        g.fillRect(x,y,tile-.8,tile-.8);
      }
      if(key==='scarabeo'){g.fillStyle='#493527';g.font='bold 19px monospace';[...'PAROLA'].forEach((v,i)=>g.fillText(v,196+i*tile,164))}
      if(key==='battaglia-navale'){g.fillStyle='#354854';g.fillRect(152,80,101,19);g.fillRect(263,134,19,75);disc(220,90,6,'#f66b41')}
    }else if(key==='forza-4'){
      g.fillStyle='#346998';g.fillRect(100,34,312,246);
      for(let y=0;y<6;y++)for(let x=0;x<7;x++)disc(130+x*42,58+y*39,15,y>=5-(x%3)?((x+y)%2?'#d95141':'#f5cb62'):'#183d40');
    }else{
      for(let i=0;i<5;i++){g.save();g.translate(150+i*52,164+Math.abs(i-2)*11);g.rotate((i-2)*.14);g.fillStyle='#182f29';g.fillRect(-35,-61,86,130);g.fillStyle=key==='uno'?['#ca4b41','#d9aa37','#43855b','#407ca2','#bb4740'][i]:'#f3e1bc';g.fillRect(-38,-65,84,127);
        g.fillStyle=key==='uno'?'#fff1d8':i%2?'#a84035':'#39332d';g.font='bold 42px Georgia';g.fillText(key==='uno'?String(i+3):['♦','♣','♥','♠','♦'][i],4,13);g.restore()}
    }
  });
  const draughtGeometry=new THREE.CylinderGeometry(.036,.04,.022,12);
  const pawnGeometry=new THREE.LatheGeometry([[.047,0],[.047,.014],[.026,.034],[.018,.064],[.031,.075],[.036,.092],[.021,.115],[.001,.121]].map(([r,y])=>new THREE.Vector2(r,y)),12);
  const pieces=(geometry,material,locations)=>{
    const set=new THREE.InstancedMesh(geometry,material,locations.length),matrix=new THREE.Matrix4();
    locations.forEach(([x,y,z],index)=>set.setMatrixAt(index,matrix.makeTranslation(x,y,z)));scene.add(set);
  };
  BOARD.forEach(([key,title],i)=>{
    if(!avail.has(key))return;
    const x=(i%3-1)*4.1,z=-8.8-Math.floor(i/3)*3.55;
    groundTint(x,z,2.75,2.35,contact);
    box(.48,.63,.48,darkWood,x,.34,z);box(1.98,.13,1.4,walnut,x,.74,z);
    box(1.91,.022,1.33,brassTrim,x,.816,z);
    plane(1.84,1.27,new THREE.MeshStandardMaterial({map:tabletop(key,title),roughness:.86}),x,.834,z,0,-Math.PI/2);
    if(key==='checkmate'||key==='dama-italiana'){
      for(let side=0;side<2;side++){
        const locations=[];
        for(let row=0;row<(key==='checkmate'?2:3);row++)for(let col=0;col<8;col++){
          const rank=side?7-row:row;if(key==='dama-italiana'&&(rank+col)%2===0)continue;
          locations.push([x+((126+(col+.5)*32.5)/512-.5)*1.84,.85,z+((26+(rank+.5)*32.5)/384-.5)*1.27]);
        }
        pieces(key==='checkmate'?pawnGeometry:draughtGeometry,side?brassTrim:darkWood,locations);
      }
    }
    for(const side of [-1,1]){
      box(.46,.39,.4,walnut,x+side*1.24,.2,z);
      box(.52,.09,.49,chairLeather,x+side*1.24,.44,z);
      box(.07,.39,.49,chairLeather,x+side*1.47,.63,z);
      spots.push({x:x+side*1.24,z:z+.62,hx:.2,hz:.12,pad:.5,label:'Siediti',where:'Sala tavoli',seat:true,px:x+side*1.24,pz:z,yaw:side*Math.PI/2});
    }
    solid(x-1.51,x+1.51,z-.72,z+.72);
    spots.push({x,z,hx:1.50,hz:.72,pad:.81,label:title,key,where:'Sala tavoli',act:()=>app.open(key)});
  });
  function poster(x,z,angle,title,subtitle,palette,motif){
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
    const frame=box(1.25,1.66,.055,brassTrim,x,1.92,z);frame.rotation.y=angle;
    plane(1.19,1.59,new THREE.MeshBasicMaterial({map}),x+.033*Math.sin(angle),1.92,z+.033*Math.cos(angle),angle);
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
  if(avail.has('blackboard-spazio-libero')){
    box(.075,1.52,2.00,brassTrim,6.78,1.75,3.6);
    plane(1.91,1.433,new THREE.MeshBasicMaterial({map:artwork}),6.73,1.75,3.6,-Math.PI/2);
    spots.push({x:6.65,z:3.6,hx:.12,hz:.95,pad:1,label:'Lavagna',act:()=>app.enterGallery?app.enterGallery(boardRoom):app.open('blackboard-spazio-libero')});
  }
  poster(-16.7,-5.95,0,'INSERT COIN','ARCADE CLUB',['#18182e','#8bd9d5','#d16699'],'vector');
  poster(16.2,5.94,Math.PI,'CARAMBOLA','SALA BILIARDO',['#23433d','#eadaad','#bd8f50'],'pool');
  // The south auditorium opens onto a centre aisle, with five pairs of loveseats.
  const velvet=std('#6f2033',.97), piping=std('#a5535f',.89), cinemaWall=std('#16131c',.98);
  plane(14,12.4,std('#4c2935',.98),0,0,12.26,0,-Math.PI/2);
  plane(14,12.4,std('#101118',1),0,H,12.26,0,Math.PI/2);
  wallZ(6.12,18.55,-7.15,cinemaWall);wallZ(6.12,18.55,7.15,cinemaWall);
  wallX(-7.3,7.3,18.55,cinemaWall);
  doorSign('Sala cinema','#ffd496',0,Math.PI).position.set(0,2.92,5.96);
  // A pleated velvet panel, gathered halfway up and fuller at the hem.
  const curtains=[],doorCurtains=[];
  const curtainMat=new THREE.MeshStandardMaterial({color:'#791e38',roughness:.94,side:THREE.DoubleSide});
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
    for(let row=0;row<5;row++)box(.09,1.72,1.35,std('#241e29',1),side*6.94,1.85,8.3+row*1.92);
  }
  box(3.30,H-DOOR_H,.07,cinemaWall,0,(H+DOOR_H)/2,6.34);
  const rugMap=canvasTex(256,512,(g,w,h)=>{
    g.fillStyle='#502030';g.fillRect(0,0,w,h);
    for(const x of [9,17,w-18,w-10]){g.fillStyle='#b08b59';g.fillRect(x,0,2,h)}
    g.strokeStyle='#754050';g.lineWidth=2;
    for(let j=-1;j<9;j++)for(let i=0;i<4;i++){const x=35+i*61,y=j*64+(i%2)*32;g.beginPath();g.moveTo(x,y-17);g.lineTo(x+12,y);g.lineTo(x,y+17);g.lineTo(x-12,y);g.closePath();g.stroke()}
  });
  rugMap.wrapT=THREE.RepeatWrapping;rugMap.repeat.y=5;
  const aisleMat=new THREE.MeshStandardMaterial({map:rugMap,roughness:1});
  const tierRise=.15;
  function cinemaFloor(x,z){
    if(Math.abs(x)>=7||z<=6.4||z>=15.44)return 0;
    if(z<7.285)return 4*tierRise*(z-6.4)/.885;
    return Math.max(0,(4-Math.floor((z-7.285)/1.63))*tierRise);
  }
  const tierCarpet=std('#482435',.98);
  for(let i=0;i<6;i++){
    const h=(i+1)*4*tierRise/6,z=6.4+(i+.5)*.1475;
    box(13.95,h,.148,tierCarpet,0,h/2,z);
    box(1.85,.012,.021,brassTrim,0,h+.006,z-.06);
  }
  for(const x of [0,-5.12,5.12])plane(x===0?2.13:1.27,10.8,aisleMat,x,.008,11.95,0,-Math.PI/2);
  const amber=glow('#ffbb6b',1.5);
  for(const x of [-1.06,1.06])box(.028,.015,9.6,amber,x,.014,11.15);
  const cinemaSofas=[];
  for(let row=0;row<5;row++){
    const z=8.1+row*1.63,level=(4-row)*tierRise;
    if(level)box(13.94,level,1.631,tierCarpet,0,level/2,z);
    for(const x of [-5.12,0,5.12]){
      plane(x===0?2.13:1.27,1.626,aisleMat,x,level+.009,z,0,-Math.PI/2);
      box(x===0?1.96:1.12,.014,.025,amber,x,level+.014,z+.79);
    }
    for(const side of [-1,1]){
      const x=side*2.66;
      const sofa=new THREE.Group();sofa.position.set(x,level,z);scene.add(sofa);cinemaSofas.push(sofa);
      // finché non arriva il divanetto in pelle nera fatto in Blender, una sagoma semplice
      const standIn=new THREE.Group();sofa.add(standIn);
      box(1.28,.19,.88,darkWood,0,.18,0,standIn);
      for(const off of [-.30,.30])box(.5,.16,.62,velvet,off,.42,-.07,standIn),box(.5,.66,.2,velvet,off,.82,-.33,standIn);
      for(const off of [-.66,.66])box(.15,.58,.86,velvet,off,.4,0,standIn);
      solid(x-.74,x+.74,z-.56,z+.51);
      spots.push({x,z,hx:.74,hz:.5,pad:.68,label:'Siediti · Cinema',sit:true,act:()=>app.sit?app.sit(app.projection()?.id):app.open('cinema-streamer')});
    }
    for(const side of [-1,1]){
      box(.11,.54,.20,brassTrim,side*6.94,1.9,z);
      box(.13,.37,.15,amber,side*6.86,1.91,z);
    }
  }
  // divanetti reclinabili in pelle nera fatti in Blender (blender/divanetto.blend → models/divanetto.glb):
  // due posti con cuciture a canali, poggiatesta, braccioli con portabicchiere cromato e tasto di regolazione
  new GLTFLoader().load(new URL('models/divanetto.glb',import.meta.url).href,gltf=>{
    gltf.scene.traverse(o=>{if(o.isMesh&&o.material.name==='tasto'){o.material.emissive=new THREE.Color('#3a8cff');o.material.emissiveIntensity=.9}});
    for(const sofa of cinemaSofas){sofa.clear();sofa.add(gltf.scene.clone())}
  });
  point('#ffb782',3.2,0,2.55,10,11);point('#bac9f0',4.1,0,2.7,16,9);
  const screenPleats=[];
  for(const side of [-1,1])for(let i=0;i<8;i++)screenPleats.push(box(.18,H,.18,velvet,side*(4.06+i*.32),H/2,18.13+(i%2)*.12));
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
    for(const side of [-1,1]){const m=wide.clone();m.position.set(side*6.42,.02,18.2);m.scale.x=-side;scene.add(m)}
  });
  box(5.16,2.97,.12,darkWood,0,1.77,18.08);
  const standby=new THREE.MeshBasicMaterial({map:neonText('BINOTTOLAND CINEMA','#f3c485',1024,576,'bold 69px Georgia'),color:0xccb99b});
  const screenMesh=plane(5.04,2.835,standby,0,1.77,17.99,Math.PI);
  const aperture=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,blending:THREE.NoBlending,depthWrite:false});
  const projection=document.createElement('div');
  projection.style.cssText='position:absolute;left:0;top:0;width:960px;height:540px;background:black;overflow:hidden;transform-origin:0 0;pointer-events:none';
  projection.hidden=true;host.prepend(projection);
  let previewKey='',hls=null,previewVideo=null,yt=null,disposeYT=null;
  let soundEnabled=true, audioContext=null, mediaNodes=[], audibleZone=false, mixEligible=false;
  const audioButton=document.createElement('button');
  audioButton.style.cssText='position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 10px);right:8px;font-size:12px;padding:7px';
  audioButton.hidden=true; // non va nella pagina: il volume del cinema compare già entrando (Cinema nel mixer)
  function updateSoundButton(){
    audioButton.textContent=soundEnabled?'Audio cinema · On':'Attiva audio cinema';
    audioButton.setAttribute('aria-pressed',String(soundEnabled));
  }
  function unlockCinemaSound(){
    if(!active)return;
    try{audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume().then(()=>{if(mixEligible&&previewVideo)cinemaMix(previewVideo)}).catch(()=>{});else if(mixEligible&&previewVideo)cinemaMix(previewVideo)}catch{}
  }
  el.addEventListener('pointerdown',unlockCinemaSound);
  window.addEventListener('keydown',unlockCinemaSound);
  audioButton.onclick=()=>{
    soundEnabled=!soundEnabled;updateSoundButton();
    if(soundEnabled)unlockCinemaSound();
    if(previewVideo){previewVideo.muted=!(soundEnabled&&audibleZone);if(soundEnabled&&currentProgram?.playback?.playing!==false)previewVideo.play().catch(()=>{})}
    if(yt){if(soundEnabled&&audibleZone){yt.unMute();if(currentProgram?.playback?.playing!==false)yt.playVideo()}else yt.mute()}
  };
  updateSoundButton();
  function volumeControl(label,key,fallback,onInput){
    const wrap=document.createElement('label'),input=document.createElement('input'),out=document.createElement('span');
    wrap.style.cssText='display:flex;align-items:center;gap:6px;padding:5px 9px;background:#18151ded;color:white;border-radius:8px;font:12px system-ui';
    wrap.append(document.createTextNode(label),input,out);input.type='range';input.min=0;input.max=100;input.style.width='80px';
    function read(){if(!key)return fallback;try{const v=localStorage.getItem(key);return v===null?fallback:Math.max(0,Math.min(1,Number(v)))}catch{return fallback}}
    function sync(){input.value=String(Math.round(read()*100));out.textContent=input.value+'%'}
    input.oninput=()=>{const v=Number(input.value)/100;try{if(key)localStorage.setItem(key,String(v))}catch{}out.textContent=input.value+'%';onInput(v)};
    sync();return {wrap,input,out,read,sync};
  }
  let cinemaLevel=1,heard=0,lastYT=-1;
  const mixPanel=document.createElement('div');mixPanel.style.cssText='position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 48px);right:8px;display:grid;gap:4px';
  const cinemaVolume=volumeControl('Cinema','club3d-cinema-volume',.85,v=>{cinemaLevel=v;unlockCinemaSound()});
  const radioVolume=volumeControl('Radio','club3d-radio-volume',.7,v=>window.binottolandClubRadio?.setClubVolume(v));
  cinemaLevel=cinemaVolume.read();mixPanel.append(cinemaVolume.wrap,radioVolume.wrap);el.append(mixPanel);
  window.addEventListener('club-volume-change',radioVolume.sync);
  // Keep direct sound in stereo; short, asymmetric reflections widen the room.
  function cinemaMix(video){
    if(!audioContext||mediaNodes.length)return;
    const ctx=audioContext;
    const source=ctx.createMediaElementSource(video),bass=ctx.createBiquadFilter(),limiter=ctx.createDynamicsCompressor();
    bass.type='lowshelf';bass.frequency.value=145;bass.gain.value=3;
    limiter.threshold.value=-9;limiter.ratio.value=5;
    source.connect(bass);bass.connect(limiter);limiter.connect(ctx.destination);
    mediaNodes.push(source,bass,limiter);
    for(const [seconds,pan,level] of [[.023,-.83,.18],[.037,.84,.15],[.067,-.4,.07]]){
      const delay=ctx.createDelay(.1),gain=ctx.createGain(),speaker=ctx.createStereoPanner();
      delay.delayTime.value=seconds;gain.gain.value=level;speaker.pan.value=pan;
      bass.connect(delay);delay.connect(gain);gain.connect(speaker);speaker.connect(limiter);
      mediaNodes.push(delay,gain,speaker);
    }
  }
  function stopProjection(){
    mixEligible=false;disposeYT?.();disposeYT=null;yt=null;audioButton.hidden=true;
    mediaNodes.forEach(node=>node.disconnect());mediaNodes=[];projection.style.zIndex='';
    lastYT=-1;previewKey='';screenMesh.material=standby;projection.hidden=true;
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
  function playProjection(data){
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
    const ready=()=>{if(previewKey===key){projection.hidden=false;screenMesh.material=aperture;screenMesh.renderOrder=5}};
    if(p.youtube&&/^[\w-]{11}$/.test(p.youtube)){
      disposeYT=embedYouTube(projection,p.youtube,{
        ready(player){
          yt=player;const frame=projection.querySelector('iframe');if(frame)frame.style.cssText='width:100%;height:100%;border:0';
          ready();player.setVolume(Math.round(heard*100));if(soundEnabled&&audibleZone)player.unMute();else player.mute();
          syncTransport(true);
        },
        state(){},blocked(){if(!soundEnabled)return;soundEnabled=false;updateSoundButton();yt?.mute();if(currentProgram?.playback?.playing!==false)yt?.playVideo()},error(){screenMesh.material=standby}
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
    const inset=pos.z>6.15 && (tmp.z>1||tmp.z< -1||Math.abs(tmp.x)>.94||Math.abs(tmp.y)>.94);
    projection.style.zIndex=inset?'1':'';
    if(inset){
      const width=Math.min(220,w*.72),scale=width/960;
      projection.style.transform='translate('+Math.max(0,2*w-width-10)+'px,64px) scale('+scale+')';
      return;
    }
    pixelPlane.set(5.04/960,0,0,-2.52,0,-2.835/540,0,1.4175,0,0,1,0,0,0,0,1);
    viewport.set(w,0,0,w,0,-h,0,h,0,0,1,0,0,0,0,1);
    camera.updateMatrixWorld();screenMesh.updateMatrixWorld();
    mediaTransform.copy(viewport).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(screenMesh.matrixWorld).multiply(pixelPlane);
    projection.style.transform='matrix3d('+mediaTransform.elements.join(',')+')';
  }

  poster(-6.94,12,Math.PI/2,'CINEMA','PROIEZIONE IN SALA',['#442333','#ffe2ab','#c58461'],'film');
  // Reception counter and tabletop receiver on the east side of the atrium.
  const counterX=5.95,counterZ=-3.35;
  box(1.14,.9,2.15,walnut,counterX,.45,counterZ);
  box(1.25,.09,2.29,brassTrim,counterX,.94,counterZ);
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
  const known = new Set([...ARCADE,...BOARD].map(([key])=>key).concat(['ruggine-89','biliardo','blackboard-spazio-libero','cinema-streamer']));
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
  const pinball=buildFlipper(scene,el,{audio:()=>audioContext,allowed:soundAllowed,top:()=>app.pinballTop?.()||[],sendScore:score=>app.pinballScore?.(score),me:()=>app.me?.()});
  const playing=()=>tableFootball.active||pinball.active; // si gioca al tavolo: niente camminata né avvisi
  scene.updateMatrixWorld(true);
  { const st=pinball.stand(); spots.push({x:st.x,z:st.z,hx:.3,hz:.14,pad:.55,label:'Flipper · Gioca',where:'Sala giochi',pinball:true}); }
  { const c=Math.cos(FLIPPER_AT.ry),sn=Math.sin(FLIPPER_AT.ry),xs=[],zs=[];
    for(const [lx,lz] of [[-.43,-.82],[.43,-.82],[-.43,.8],[.43,.8]]){xs.push(FLIPPER_AT.x+lx*c+lz*sn);zs.push(FLIPPER_AT.z-lx*sn+lz*c)}
    solid(Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)); }
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
  function openRuggine(){
    const panel=document.createElement('div');panel.className='l3d';panel.style.zIndex='100';
    const frame=document.createElement('iframe');frame.title='Ruggine 89';frame.src='/ruggine/';frame.style.cssText='width:100%;height:100%;border:0';
    function exitGame(event){
      if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='ruggine:exit')return;
      window.removeEventListener('message',exitGame);panel.remove();show();
    }
    window.addEventListener('message',exitGame);panel.append(frame);document.body.append(panel);
  }
  // Cabinati: uno per gioco. Per i giochi a più giocatori il cabinato è più largo, con un posto e una pulsantiera
  // per ognuno (come i cabinati veri a 2, 4 e 5 giocatori): chi apre il gioco prende il primo posto libero
  // e gli altri lo vedono lì, alla sua pulsantiera.
  const SEATS = { pong: 2, 'golf-with-your-gay-friends': 4, labyrinth: 4, 'f1-on-paper': 5, 'moto-trial': 5 };
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
    spots.push({ x: fx, z: fz, hx: along ? 0.2 : Math.max(.2, half - .15), hz: along ? Math.max(.2, half - .15) : 0.2, pad: 0.6, label: title + (seats > 1 ? ' (' + seats + ' posti)' : ''), where: 'Sala giochi', station:key,seats,gap,handles,yaw:ry,pong:key==='pong',screen:scr,sweep,act: key==='ruggine-89'?openRuggine:() => app.open(key), mq });
  };
  // lungo le pareti, rivolti verso il centro della sala: a nord i grandi a 4 e 5 posti, a sud gli altri
  const byKey = new Map(list.map(e => [e[0], e]));
  const northKeys = ['moto-trial', 'f1-on-paper', 'golf-with-your-gay-friends'].filter(k => byKey.has(k));
  const southKeys = ['labyrinth', 'pong', ...list.map(e => e[0]).filter(k => !['moto-trial', 'f1-on-paper', 'golf-with-your-gay-friends', 'labyrinth', 'pong'].includes(k))].filter(k => byKey.has(k));
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
  let crouching=false,guarding=false,punchCount=0,hitN=0,lastHit=null,fxNoise=null;
  const peers=new Map(),downArm=new THREE.Vector3(0,-1,0);
  const viewButton=document.createElement('button');
  $('.l3d-top').append(viewButton);
  function setFirst(value){
    firstPerson=value;viewButton.textContent=value?'Vista esterna (V)':'Vista dagli occhi (V)';
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
    if(pinball.active)return {station:'flipper',slot:pinball.slot()};
    if(monitor&&pongAnchor&&Math.hypot(pos.x-pongAnchor.x,pos.z-pongAnchor.z)<.24)return {station:'pong',slot:pongAnchor.slot||0};
    // seduto al cinema: gli altri ti vedono seduto sul tuo posto del divano, con la testa che guarda dove guardi
    if(seating){
      const r=v=>Math.round(v*20)/20;
      let look=cam.yaw-Math.PI;look=Math.atan2(Math.sin(look),Math.cos(look));
      const yaw=seating.seat?seating.yaw:Math.PI;
      look=cam.yaw-yaw;look=Math.atan2(Math.sin(look),Math.cos(look));
      return {station:'seat',x:r(pos.x),z:r(pos.z),y:Math.round((cinemaFloor(pos.x,pos.z)+(stools[seating.stool]?.y??0))*1000)/1000,yaw:r(yaw),look:r(look),pitch:r(cam.pitch)};
    }
    // in giro per il club: posizione e direzione (arrotondate), così gli altri ti vedono camminare
    const r=v=>Math.round(v*20)/20;
    return {station:'walk',x:r(pos.x),z:r(pos.z),yaw:Math.round(heading*20)/20,...(Math.abs(me.lookYaw||0)>.05?{look:r(me.lookYaw)}:{}),...(crouching?{crouch:1}:{}),...(guarding?{guard:1}:{}),...(punchCount?{punch:punchCount}:{}),...(lastHit?{hit:lastHit}:{})};
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
    actCharacter(c,{crouch:p.crouch,guard:p.guard},peerDt,t);
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
    else if(p.station==='flipper'){
      // mani sui pulsanti dei flipper (o la destra sul pomello della leva), braccia sempre attaccate
      const st=pinball.stand(),hs=pinball.hands(p.slot|0,c===me?pinball.plunger():0);if(!hs)return null;
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
        if(c.seenPunch===undefined){c.seenPunch=cp.punch||0;c.seenHit=cp.hit?.n||0}
        if((cp.punch||0)!==c.seenPunch){c.seenPunch=cp.punch||0;(c.fx||(c.fx={crouch:0,guard:0,punch:9,starsUntil:0})).punch=0}
        if(cp.hit&&cp.hit.n!==c.seenHit){c.seenHit=cp.hit.n;struck(String(cp.hit.id),!!cp.hit.blocked,c)}
      }
      for(const [id,c] of peers)if(!present.has(id)){
        c.root.removeFromParent();
        const geometries=new Set(),materials=new Set();c.root.traverse(o=>{if(o.isMesh||o.isSprite){geometries.add(o.geometry);materials.add(o.material)}});
        for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose()}peers.delete(id);
      }
    }
    for(const c of peers.values())c.root.visible=!!modelPose(c,c.pose);
  }
  let jumpHeight = 0, verticalSpeed = 0, lastFoot = 0;
  function resetMovement() {
    tableFootball.blur();
    crouching = false; guarding = false; // finestra persa (Alt+Tab): nessun tasto resta premuto
    monitor?.frame.contentWindow.cabinetMonitor?.clear();
    keys.clear();
    jumpHeight = verticalSpeed = moving = 0;
    me.root.position.y = 0;
  }
  const joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
  const drags = new Map();
  let pinch = 0;
  const onKey = (e) => {
    if (!active || document.querySelector('dialog[open]')) return;
    // bacheca aperta: si scrive nella chat; Esc la chiude
    if (boardOpen) { if (e.type === 'keydown' && e.code === 'Escape') closeBoard(); return; }
    if(e.altKey||e.key==='Alt'){if(e.type==='keydown')return}
    if(e.code==='KeyV'){if(e.type==='keydown'&&!e.repeat&&!activityView)setFirst(!firstPerson);e.preventDefault();return}
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
      if (!seating && e.type === 'keydown' && !e.repeat && jumpHeight === 0 && verticalSpeed === 0) verticalSpeed = 4.1;
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
    try { host.setPointerCapture(e.pointerId); } catch (err) { /* puntatore finto */ }
    if (inStick) {
      joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
      moveJoy(e);
    } else drags.set(e.pointerId, { x: e.clientX, y: e.clientY, startX:e.clientX,startY:e.clientY, moved:false, paddle:e.button===0&&aimAtMonitor(e) });
    if (e.pointerType === 'mouse' && e.button === 2) guarding = true;
  });
  const moveJoy = (e) => {
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.x = dx / max; joy.y = dy / max;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  host.addEventListener('pointermove', (e) => {
    if(pinball.active){pinball.pointer(e);return}
    if(tableFootball.active){tableFootball.move(e,host.getBoundingClientRect());return}
    if (e.pointerId === joy.id) return moveJoy(e);
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
  // sul telefono: tasti per colpo, parata (tenere premuto) e abbassarsi (acceso/spento)
  const moves = document.createElement('div');
  moves.className = 'l3d-moves'; moves.hidden = true;
  moves.innerHTML = '<button data-m="punch" aria-label="Colpo">👊</button><button data-m="guard" aria-label="Parata (tieni premuto)">🛡️</button><button data-m="crouch" aria-label="Abbassati">⬇️</button>';
  el.append(moves);
  const movesCss = document.createElement('style');
  movesCss.textContent = '.l3d-moves{position:absolute;right:calc(var(--ui-safe-right,0px) + 16px);bottom:calc(var(--ui-safe-bottom,0px) + 96px);display:flex;flex-direction:column;gap:10px;z-index:3}.l3d-moves[hidden]{display:none}.l3d-moves button{width:58px!important;height:58px;min-height:58px;padding:0!important;border-radius:50%;font-size:26px!important;background:rgba(18,14,28,.6)!important;touch-action:none}.l3d-moves button.on{background:#f0b429!important}';
  document.head.append(movesCss);
  moves.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return; e.stopPropagation(); e.preventDefault();
    if (b.dataset.m === 'punch') punch();
    if (b.dataset.m === 'guard') { guarding = true; b.classList.add('on'); }
    if (b.dataset.m === 'crouch') { crouching = !crouching; b.classList.toggle('on', crouching); }
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) moves.addEventListener(ev, (e) => {
    const b = e.target.closest('[data-m="guard"]'); if (b) { guarding = false; b.classList.remove('on'); }
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
      if (hint.style.opacity !== '0' && t > 1.5) hint.style.opacity = '0';
    }
    moving += (speed - moving) * Math.min(1, dt * 10);
    me.root.position.x = pos.x; me.root.position.z = pos.z; me.root.rotation.set(0,heading,0);
    // collo: in terza persona la testa guarda verso dove guarda la telecamera
    { let lk = cam.yaw - heading; lk = Math.atan2(Math.sin(lk), Math.cos(lk)); me.lookYaw = seating ? 0 : Math.max(-0.9, Math.min(0.9, lk)); me.lookPitch = 0; }
    animateCharacter(me, moving, dt, t);
    // un passo a ogni appoggio del piede (più piano abbassati, più forte correndo)
    { const foot = Math.floor(me.phase / Math.PI); if (foot !== lastFoot) { lastFoot = foot; if (moving > 0.4 && !seating && jumpHeight === 0) fxSound('step', Math.min(1.2, moving / SPEED) * (crouching ? 0.45 : 1)); } }
    actCharacter(me, { crouch: crouching && !seating, guard: guarding && !seating }, dt, t);
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
      else if (near) actB.textContent = (near.sit||near.seat?'':'Apri · ') + near.label + (touch ? '' : '  (E)') + (near.stool!=null&&!touch ? ' · Prendi (G)' : '');
    }
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
    const where = pos.z > 6.15 ? 'Sala cinema' : pos.z < -6.15 ? 'Sala tavoli' : pos.x > 7 ? 'Sala biliardo' : pos.x < -7 ? 'Sala giochi' : 'Lobby';
    if (whereEl.textContent !== where) whereEl.textContent = where;
    lightRoom(where);
    // telecamera dietro il personaggio, che non passa i muri
    tgt.set(pos.x, floor+1.45 + jumpHeight * .42, pos.z);
    tmp.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    ray.set(tgt, tmp); ray.far = cam.dist;
    const hit = ray.intersectObjects(wallMeshes, false)[0];
    const d = hit ? Math.max(0.6, hit.distance - 0.25) : cam.dist;
    camera.position.copy(tgt).addScaledVector(tmp, d);
    camera.position.y = Math.min(H - 0.15, camera.position.y);
    if(pos.z>6.45)camera.position.z=Math.max(6.43,camera.position.z);
    camera.lookAt(tgt);
    if(seating){
      standButton.hidden=!touch;seatActions.hidden=!touch&&enterButton.hidden;
      actB.hidden=true;
      cam.yaw+=(Number(keys.has('arrowleft'))-Number(keys.has('arrowright')))*dt*1.7;
      cam.pitch=THREE.MathUtils.clamp(cam.pitch+(Number(keys.has('arrowdown'))-Number(keys.has('arrowup')))*dt,-.65,.8);
      stick.hidden=true;camera.position.set(pos.x,floor+1.12,pos.z+.06);
      camera.lookAt(pos.x-Math.sin(cam.yaw)*Math.cos(cam.pitch),floor+1.12-Math.sin(cam.pitch),camera.position.z-Math.cos(cam.yaw)*Math.cos(cam.pitch));
    }

  }

  function frame(now) {
    if (!active) return;
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
    clubInRange=inRange && Math.abs(pos.x)<7 && pos.z<18.3;
    const depth=pos.z-6.23;
    const signedDistance=depth>0 && Math.abs(pos.x)<7 ? depth : -Math.hypot(Math.max(0,Math.abs(pos.x)-1.45),Math.min(0,depth));
    const blend=THREE.MathUtils.clamp((signedDistance+1)/2,0,1);
    const target=cinemaLevel*Math.sin(blend*Math.PI/2);
    heard=target;
    window.binottolandClubRadio?.setClubGain?.(blend===1?0:Math.cos(blend*Math.PI/2));
    if(previewVideo)previewVideo.volume=THREE.MathUtils.clamp(heard,0,1);
    const ytLevel=Math.round(heard*100);
    if(yt&&ytLevel!==lastYT){yt.setVolume(ytLevel);lastYT=ytLevel}
    const audible=heard>.001 || target>.001;
    cinemaVolume.wrap.style.display=inRange&&previewKey?'flex':'none';
    radioVolume.wrap.style.display=(Math.hypot(pos.x-counterX,pos.z-counterZ)<3)?'flex':'none';
    if(avail.has('blackboard-spazio-libero')&&t>nextBoard&&Math.abs(pos.x)<7&&Math.abs(pos.z)<6.3){
      nextBoard=t+2;app.gallery?.({room:boardRoom,epoch:boardEpoch,since:boardSeq},drawGallery);
    }
    if(audibleZone!==audible){
      audibleZone=audible;
      if(previewVideo)previewVideo.muted=!(audible&&soundEnabled);
      if(yt){if(audible&&soundEnabled)yt.unMute();else yt.mute()}
    }
    playProjection(app.projection?.());
    audioButton.hidden=!inRange||!previewKey;
    const insideArcade=pos.x< -7&&Math.abs(pos.z)<6.15;
    const doorDepth=insideArcade?-7-pos.x:-Math.hypot(Math.max(0,pos.x+7),Math.max(0,Math.abs(pos.z)-1.3));
    const mix=THREE.MathUtils.clamp((doorDepth+1)/2,0,1);
    tableRoomGain=mix*mix*(3-2*mix);
    if(tableBus)tableBus.gain.value=tableLevel*tableRoomGain;
    tableVolume.wrap.style.display=tableRoomGain>0&&!pinball.active&&Math.hypot(pos.x+13,pos.z)<3?'flex':'none'; // solo vicino al calcio balilla
    peerDt=dt;tableFootball.update(camera,dt,tableRoomGain>0);pinball.update(camera,dt);placePeers();
    localPose=currentPose();const poseKey=JSON.stringify(localPose);
    // la posa va al server quando cambia, al massimo 5 volte al secondo (l'ultima arriva sempre)
    const nowMs=performance.now();
    if(poseKey!==lastPoseKey&&nowMs-lastPoseSent>=200){lastPoseKey=poseKey;lastPoseSent=nowMs;app.poseChanged?.()}
    if(!localPose||localPose.station==='walk')for(const arm of me.arms){arm.scale.y=1;arm.rotation.y=0}
    const anchor=modelPose(me,localPose);
    me.head.visible=!firstPerson;
    // al calcio balilla il tuo personaggio non copre il tavolo nella tua vista (gli altri lo vedono alle manopole)
    if(!seating)me.root.visible=!playing()&&!boardOpen;
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
    if(boardOpen)focusBoard();alignProjection();renderer.render(scene, camera);
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
  seatActions.style.cssText='position:absolute;bottom:calc(var(--ui-safe-bottom,0px) + 8px);left:50%;transform:translateX(-50%);white-space:nowrap';
  const enterButton=document.createElement('button'),standButton=document.createElement('button');
  enterButton.textContent='Entra nel cinema';standButton.textContent='Alzati';seatActions.append(enterButton,standButton);el.append(seatActions);seatActions.hidden=true;
  function stand(){
    if(!seating)return;
    if(seating.stool!=null)app.stoolSend?.({type:'stool',action:'stand',id:seating.stool,height:stools[seating.stool].height});
    camera.up.set(0,1,0);seating=null;seatActions.hidden=true;Object.assign(pos,returnPoint);collide(pos);me.root.visible=true;
    stick.hidden=!touch;near=null;resetMovement();
  }
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
    if(s.pinball){resetMovement();pinball.open();near=null;return} // al flipper: si gioca dalla barra
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
    if(s.station)parked={station:s.station,slot:freeSeat(s)};
    hide();
    s.act();
    if (app.launched && s.label!=='Ruggine 89') app.launched(s);
  }
  function show() {
    if (active) return;
    restoreActivityView();
    parked=null;playProjection(app.projection?.());syncTransport(true);el.hidden = false; active = true; last = 0;
    app.clubVisibility?.();setTag();
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
  function hide() {
    if (document.pointerLockElement) document.exitPointerLock?.();
    if(carrying!==null||requested)app.stoolSend?.({type:'stool',action:'cancel',id:carrying??requested.id});
    carrying=null;requested=null;closeBoard();
    tableRoomGain=0;if(tableBus)tableBus.gain.value=0;tableFootball.close();if(pinball.active)pinball.close();stand();stopMonitor();heard=0;
    active = false;clubInRange=false;app.clubStream?.(null);audibleZone=false;app.clubVisibility?.();quietProjection();cancelAnimationFrame(raf);
    resetMovement(); drags.clear(); joy.id = null; joy.x = joy.y = 0; knob.style.transform = '';
    el.hidden = true;
  }
  document.addEventListener('visibilitychange', () => { if(document.hidden){app.clubStream?.(null);quietProjection();resetMovement();cancelAnimationFrame(raf);last=0}
    else {playProjection(app.projection?.());syncTransport(true);if(active){cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}} });
  // place(): sposta il personaggio (per le prove), near(): cosa si può aprire adesso
  const place = (x, z, yaw = cam.yaw) => { pos.x = x; pos.z = z; cam.yaw = yaw; collide(pos); };
  // Luci per stanza: ogni luce in più pesa su ogni oggetto disegnato (sui telefoni si sente). Si accendono solo
  // quelle della stanza dove sei e dell'atrio; dall'atrio, che vede tutte le porte, la luce principale di ogni sala.
  // Le combinazioni si preparano subito dopo l'apertura, così cambiare stanza non dà scatti.
  const roomOf = (x, z) => (z > 6.15 ? 'Sala cinema' : z < -6.15 ? 'Sala tavoli' : x > 7 ? 'Sala biliardo' : x < -7 ? 'Sala giochi' : 'Lobby');
  const roomLights = [];
  scene.traverse((o) => { if (o.isLight && !o.isHemisphereLight) roomLights.push({ light: o, room: roomOf(o.getWorldPosition(new THREE.Vector3()).x, o.getWorldPosition(new THREE.Vector3()).z) }); });
  const mainLight = new Map();
  for (const r of roomLights) if (r.room !== 'Lobby' && !r.light.isSpotLight && (!mainLight.has(r.room) || r.light.intensity > mainLight.get(r.room).intensity)) mainLight.set(r.room, r.light);
  let litRoom = '';
  function lightRoom(where) {
    if (where === litRoom) return;
    litRoom = where;
    for (const { light, room } of roomLights) light.visible = room === where || room === 'Lobby' || (where === 'Lobby' && mainLight.get(room) === light);
  }
  let lightsReady = false;
  async function prepareLights() {
    if (lightsReady || !renderer.compileAsync) return;
    lightsReady = true;
    const keep = litRoom;
    for (const room of ['Lobby', 'Sala biliardo', 'Sala giochi', 'Sala tavoli', 'Sala cinema']) {
      if (room === keep) continue;
      // compileAsync legge le luci subito: si rimettono quelle giuste prima di aspettare, così non si vede niente
      lightRoom(room);
      const done = renderer.compileAsync(scene, camera);
      lightRoom(keep);
      try { await done; } catch (e) { /* si compila al primo passaggio */ }
    }
  }
  const api = { stoolDisconnected(){carrying=null;requested=null;if(seating?.stool!=null)stand()}, stoolResult, setTableVolume, syncProjection:()=>playProjection(app.projection?.()), pose:descriptor, balillaState:data=>tableFootball.receive(data), show, hide, place, near: () => near && near.label, where: () => ({ ...pos }), dazed: () => (me.fx?.starsUntil || 0) > t, get active() { return active; }, el };
  el.lobby3d = api;
  return api;
}
