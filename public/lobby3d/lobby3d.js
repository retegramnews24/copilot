// Lobby 3D (prova su staging): un "guscio" facoltativo della Lobby. Si cammina con il proprio personaggio tra
// l'atrio (la lavagna apre Settings, il cartellone apre Giochi), la sala biliardo (vicino a un tavolo "Apri" apre
// il Biliardo, con i tavoli veri del gioco) e la sala arcade (ogni cabinato apre il suo gioco).
// Non rifà nessuna schermata: chiede all'app di aprire quelle che ci sono già, e intanto il mondo 3D si ferma.
import {buildBalilla} from './balilla.js?v=b36e517ea0';
import {soundAllowed} from '../sound-pref.js';
import * as THREE from 'three';
import {BOARD_WIDTH,BOARD_HEIGHT,CHALKS,ERASER,DEFAULT_SIZE} from '../blackboard/chalk.js?v=4027e504f0';
import {embedYouTube} from '../cinema/youtube.js?v=c237aa9fc5';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { Table3D, CLOTHS } from '../biliardo/scene3d.js?v=47e47e2969';
import * as E from '../biliardo/engine.js?v=2db7d98a7f';
import { readAppearance, readLook } from '../appearance.js?v=a866c9e8ce';
import { canvasTex, neonText, parquet, wallFinish, tiles, neonGrid, blackboard, gamesPoster, cabinetScreen, nameTag, blobTex } from './textures.js?v=faa543f96e';
import { makeCharacter, animateCharacter, setLook, SPEED, ARM_LEN, EYE_Y } from './character.js?v=4dedab54c1';
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
<div class="l3d-top"><button class="l3d-exit" aria-label="Torna alla Lobby classica">✕ Lobby classica</button><span class="l3d-where">Atrio</span></div>
<div class="l3d-hint"></div><button class="l3d-act" hidden></button><div class="l3d-stick" hidden><i></i></div>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const host = $('.l3d-gl'), actB = $('.l3d-act'), whereEl = $('.l3d-where'), hint = $('.l3d-hint'), stick = $('.l3d-stick'), knob = stick.firstChild;
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  stick.hidden = !touch;
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
      wallX(x0,-1.45,-6.15,finish);wallX(1.45,x1,-6.15,finish);
      // architrave della porta della sala tavoli: anche lui ferma la telecamera
      wallMeshes.push(box(2.9,H-DOOR_H,.3,wallM,0,(H+DOOR_H)/2,-6.15));
    }else wallX(x0, x1, -6.15, finish);
    if(x0===-7){
      // porte della sala tavoli (nord) e del cinema (sud): stipiti e architrave arrotondati che attraversano il muro
      const jamb = std('#3b2416', 0.5);
      for (const [hw, zz] of [[1.45, -6.15], [1.65, 6.15]]) {
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
  spots.push({ x: bbX, z: -5.6, hx: 1.35, hz: 0.3, pad: 1.1, label: 'Impostazioni', where: 'Atrio', act: () => app.openSettings() });
  // cartellone = Giochi
  const gpX = 3.4;
  rbox(1.5, 2.05, 0.06, 0.025, std('#3b2416', 0.5), gpX, 1.45, -5.96);
  plane(1.36, 1.92, new THREE.MeshStandardMaterial({ map: gamesPoster(), roughness: 0.7 }), gpX, 1.45, -5.92);
  spots.push({ x: gpX, z: -5.6, hx: 0.75, hz: 0.3, pad: 1.1, label: 'Tutti i giochi', where: 'Atrio', act: () => app.openGames() });
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
  plant(-6.4, -5.4); plant(6.4, -5.4); plant(-6.4, 5.4); plant(6.4, 5.4);
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
  doorSign('Atrio', '#ffd23f', 7.2, Math.PI / 2);
  doorSign('Atrio', '#ffd23f', -7.2, -Math.PI / 2);
  doorSign('Atrio', '#ffd23f', 0, Math.PI).position.set(0, 2.92, -6.34);
  doorSign('Atrio', '#ffd23f', 0, 0).position.set(0, 2.92, 6.34);

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
    spots.push({ x, z, hx, hz, pad: 0.85, label: 'Biliardo', where: 'Sala biliardo', act: () => app.open('biliardo') });
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
    }
    solid(x-1.51,x+1.51,z-.72,z+.72);
    spots.push({x,z,hx:1.50,hz:.72,pad:.81,label:title,where:'Sala tavoli',act:()=>app.open(key)});
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
  const curtains=[];
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
  function cinemaFloor(x,z){
    if(Math.abs(x)>=7||z<=6.4||z>=15.44)return 0;
    if(z<7.285)return Math.min(.6,(z-6.4)*.68);
    return Math.max(0,(4-Math.floor((z-7.285)/1.63))*.15);
  }
  const tierCarpet=std('#482435',.98);
  for(let i=0;i<6;i++){
    const h=(i+1)*.10,z=6.4+(i+.5)*.1475;
    box(13.95,h,.148,tierCarpet,0,h/2,z);
    box(1.85,.012,.021,brassTrim,0,h+.006,z-.06);
  }
  for(const x of [0,-5.12,5.12])plane(x===0?2.13:1.27,10.8,aisleMat,x,.008,11.95,0,-Math.PI/2);
  const amber=glow('#ffbb6b',1.5);
  for(const x of [-1.06,1.06])box(.028,.015,9.6,amber,x,.014,11.15);
  for(let row=0;row<5;row++){
    const z=8.1+row*1.63,level=(4-row)*.15;
    if(level)box(13.94,level,1.631,tierCarpet,0,level/2,z);
    for(const x of [-5.12,0,5.12]){
      plane(x===0?2.13:1.27,1.626,aisleMat,x,level+.009,z,0,-Math.PI/2);
      box(x===0?1.96:1.12,.014,.025,amber,x,level+.014,z+.79);
    }
    for(const side of [-1,1]){
      const x=side*2.66;
      const sofa=new THREE.Group();sofa.position.set(x,level,z);scene.add(sofa);
      box(1.28,.19,.88,darkWood,0,.18,0,sofa);
      for(const off of [-.30,.30]){
        const cushion=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),velvet);
        cushion.scale.set(.326,.145,.46);cushion.position.set(off,.39,0);sofa.add(cushion);
        const back=cushion.clone();back.scale.set(.33,.35,.13);back.position.set(off,.67,-.35);back.rotation.x=-.14;sofa.add(back);
        for(const u of [-.09,.09])box(.022,.022,.013,piping,off+u,.67,-.224,sofa);
      }
      for(const off of [-.66,.66]){
        box(.14,.36,.87,velvet,off,.44,0,sofa);box(.15,.045,.80,walnut,off,.636,0,sofa);
        const cup=new THREE.Mesh(new THREE.RingGeometry(.035,.047,20),brassTrim);
        cup.rotation.x=-Math.PI/2;cup.position.set(off,.66,.26);sofa.add(cup);
      }
      solid(x-.74,x+.74,z-.56,z+.51);
      spots.push({x,z,hx:.74,hz:.5,pad:.68,label:'Siediti · Cinema',sit:true,act:()=>app.sit?app.sit(app.projection()?.id):app.open('cinema-streamer')});
    }
    for(const side of [-1,1]){
      box(.11,.54,.20,brassTrim,side*6.94,1.9,z);
      box(.13,.37,.15,amber,side*6.86,1.91,z);
    }
  }
  point('#ffb782',3.2,0,2.55,10,11);point('#bac9f0',4.1,0,2.7,16,9);
  for(const side of [-1,1])for(let i=0;i<8;i++)box(.18,H,.18,velvet,side*(4.06+i*.32),H/2,18.13+(i%2)*.12);
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
  audioButton.hidden=true;el.append(audioButton);
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
    if(previewVideo){previewVideo.pause();previewVideo.removeAttribute('src');previewVideo.load();previewVideo=null}
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
  function playProjection(data){
    const p=data?.projection;
    const play=p?.playback;
    currentProgram=p;
    const key=p?JSON.stringify([data.id,p.url,p.youtube]):'';
    if(key===previewKey){syncTransport();return}
    playbackVersion='';
    stopProjection();if(!key)return;
    previewKey=key;audioButton.hidden=false;
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
  box(.89,.44,.25,walnut,0,.22,0,receiver);box(.83,.38,.025,darkWood,0,.22,.134,receiver);
  for(let n=0;n<10;n++)box(.024,.28,.018,brassTrim,-.36+n*.041,.22,.155,receiver);
  box(.31,.095,.016,amber,.22,.29,.152,receiver);
  for(const x of [.13,.32]){const knob=new THREE.Mesh(new THREE.CylinderGeometry(.046,.046,.04,16),brassTrim);knob.rotation.x=Math.PI/2;knob.position.set(x,.145,.165);receiver.add(knob)}
  const aerial=box(.012,.46,.012,brassTrim,.29,.64,0,receiver);aerial.rotation.z=-.28;
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
    if(!tableNoise){
      tableNoise=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.3),ctx.sampleRate);
      const d=tableNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    }
    const now=ctx.currentTime,p=Math.max(.15,Math.min(1,Number(power)||.5));
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
      hit(320,2.5,.14,.42*p+.08);tone(105,.16,.2);
      for(let i=0;i<8;i++)hit(1450-i*70,6,.03,.11*(1-i/9),.2+i*.075+Math.random()*.02);
    }else if(type==='throw'){
      hit(1300,6,.03,.12,0);hit(1200,6,.03,.09,.06);hit(800,3,.18,.06,.1);
    }else hit(900,4,.04,.15*p);
  }
  const tableFootball=buildBalilla(scene,el,app.balillaSend,tableSound);
  solid(-13.73,-12.27,-.62,.62); // tavolo con manopole e manicotti
  spots.push({x:-13,z:0,hx:.73,hz:.62,pad:.7,label:'Calcio balilla',balilla:true});
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
  let firstPerson=false,parked=null,pongAnchor=null,localPose=null,lastPoseKey='',peerList=null;
  const peers=new Map(),downArm=new THREE.Vector3(0,-1,0);
  const viewButton=document.createElement('button');
  $('.l3d-top').append(viewButton);
  function setFirst(value){
    firstPerson=value;viewButton.textContent=value?'Vista esterna (V)':'Vista dagli occhi (V)';
    viewButton.setAttribute('aria-pressed',String(value));
  }
  setFirst(false);viewButton.onclick=()=>setFirst(!firstPerson);
  function currentPose(){
    if(parked)return parked;
    if(!active)return null;
    if(tableFootball.seat)return tableFootball.seat;
    if(monitor&&pongAnchor&&Math.hypot(pos.x-pongAnchor.x,pos.z-pongAnchor.z)<.24)return {station:'pong',slot:pongAnchor.slot||0};
    return null;
  }
  function descriptor(){
    const pose=currentPose();if(!pose)return null;
    const look=readLook();return {...pose,shirt:look.shirt,shorts:look.shorts,accent:look.accent,hair:look.hair,skin:look.skin};
  }
  function modelPose(c,p){
    if(!p)return null;
    let anchor;
    if(p.station==='balilla')anchor=tableFootball.pose(p.slot,p.mode,p.pair);
    else{
      const station=spots.find(s=>s.station===p.station);if(!station)return null;
      const yaw=station.yaw,cs=Math.cos(yaw),sn=Math.sin(yaw);
      // cabinati a più posti: ognuno davanti alla sua pulsantiera
      const n=station.seats||1,slot=Math.min(n-1,Math.max(0,p.slot|0)),ox=(slot-(n-1)/2)*(station.gap||0);
      const hs=station.handles?.[slot]||[[-.18,1.15],[.12,1.07]];
      anchor={x:station.x+.13*sn+ox*cs,z:station.z+.13*cs-ox*sn,yaw,handles:hs.map(([x,y])=>new THREE.Vector3(station.x+x*cs-.25*sn,y,station.z-x*sn-.25*cs))};
    }
    c.root.position.set(anchor.x,0,anchor.z);c.root.rotation.y=anchor.yaw;c.root.updateMatrixWorld(true);
    c.arms.forEach((arm,i)=>{
      const tip=c.root.worldToLocal(anchor.handles[i].clone()).sub(arm.position);
      arm.quaternion.setFromUnitVectors(downArm,tip.clone().normalize());
      arm.scale.y=tip.length()/ARM_LEN;
    });
    return anchor;
  }
  function placePeers(){
    const list=app.peers?.();if(!list)return;
    if(peerList!==list){
      peerList=list;const present=new Set();
      for(const user of list){
        if(!user.clubPose||String(user.id)===String(app.me?.()?.id))continue;
        present.add(user.id);let c=peers.get(user.id);
        if(!c){c=makeCharacter(user.clubPose);c.root.add(shirtName(user.name||''));scene.add(c.root);peers.set(user.id,c)}
        c.pose=user.clubPose;setLook(c,user.clubPose);
      }
      for(const [id,c] of peers)if(!present.has(id)){
        c.root.removeFromParent();
        const geometries=new Set(),materials=new Set();c.root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material)}});
        for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose()}peers.delete(id);
      }
    }
    for(const c of peers.values())c.root.visible=!!modelPose(c,c.pose);
  }
  let jumpHeight = 0, verticalSpeed = 0;
  function resetMovement() {
    tableFootball.blur();
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
    if(e.code==='KeyV'){if(e.type==='keydown'&&!e.repeat)setFirst(!firstPerson);e.preventDefault();return}
    if(tableFootball.active){if(tableFootball.input(e))e.preventDefault();return}
    if (seating && e.type==='keydown' && e.code==='Escape'){e.preventDefault();stand();return}
    if(e.target?.matches?.('input,select'))return;
    if(monitor && ['KeyI','KeyK'].includes(e.code)){
      e.preventDefault();monitor.frame.contentWindow.cabinetMonitor?.key(e.code,e.type==='keydown');return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!seating && e.type === 'keydown' && !e.repeat && jumpHeight === 0 && verticalSpeed === 0) verticalSpeed = 4.1;
      return;
    }
    const k = e.code === 'ShiftLeft' ? 'sprint' : e.key.toLowerCase();
    if (e.type === 'keydown') {
      if ((k === 'e' || k === 'enter') && near) { e.preventDefault(); if(!e.repeat)launch(near); return; }
      keys.add(k);
    } else keys.delete(k);
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  addEventListener('blur', resetMovement);
  host.addEventListener('pointerdown', (e) => {
    if (!active || tableFootball.active) return;
    const r = stick.getBoundingClientRect();
    const inStick = touch && e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.45 && joy.id === null;
    try { host.setPointerCapture(e.pointerId); } catch (err) { /* puntatore finto */ }
    if (inStick) {
      joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2;
      moveJoy(e);
    } else drags.set(e.pointerId, { x: e.clientX, y: e.clientY, startX:e.clientX,startY:e.clientY, moved:false, paddle:e.button===0&&aimAtMonitor(e) });
  });
  const moveJoy = (e) => {
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy;
    const d = Math.hypot(dx, dy), max = 50;
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.x = dx / max; joy.y = dy / max;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  host.addEventListener('pointermove', (e) => {
    if(tableFootball.active){tableFootball.move(e,host.getBoundingClientRect());return}
    if (e.pointerId === joy.id) return moveJoy(e);
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
    if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
    const drag=drags.get(e.pointerId);
    if(e.type==='pointerup' && e.pointerType==='mouse' && drag && !drag.moved && (e.button===0||e.button===2)){
      me.expression=e.button===0?'surprise':'laugh';me.expressionEnd=t+1.2;
    }
    drags.delete(e.pointerId);
    if (drags.size < 2) pinch = 0;
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) host.addEventListener(ev, up);
  host.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(1.8, Math.min(9, cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  host.addEventListener('contextmenu', (e) => e.preventDefault());
  actB.onclick = () => near && launch(near);
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
    if (!seating && mag > 0.12) {
      // avanti = lontano dalla telecamera
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      const n = Math.hypot(ix, iz);
      const dx = ((ix * c + iz * s) / n) * mag, dz = ((-ix * s + iz * c) / n) * mag;
      const pace = keys.has('sprint') ? SPEED * 1.75 : SPEED;
      speed = pace * mag;
      pos.x += dx * pace * dt; pos.z += dz * pace * dt;
      collide(pos);
      const want = Math.atan2(-dx, -dz);
      let d = want - heading; d = Math.atan2(Math.sin(d), Math.cos(d));
      heading += d * Math.min(1, dt * 12);
      if (hint.style.opacity !== '0' && t > 1.5) hint.style.opacity = '0';
    }
    moving += (speed - moving) * Math.min(1, dt * 10);
    me.root.position.x = pos.x; me.root.position.z = pos.z; me.root.rotation.y = heading;
    animateCharacter(me, moving, dt, t);
    if (verticalSpeed !== 0 || jumpHeight > 0) {
      const gravity = 13;
      jumpHeight = Math.max(0, jumpHeight + verticalSpeed * dt - .5 * gravity * dt * dt);
      verticalSpeed = jumpHeight > 0 ? verticalSpeed - gravity * dt : 0;
      me.root.position.y += jumpHeight;
    }
    const floor=cinemaFloor(pos.x,pos.z);
    me.root.position.y+=floor;
    blob.scale.setScalar(1 - jumpHeight * .24);
    if(seating){
      me.root.position.y=-.22;
      for(const leg of me.legs)leg.rotation.x=1.25;
    }
    blob.position.set(pos.x, floor+0.008, pos.z);
    // cosa c'è vicino
    let best = null, bd = 1e9;
    for (const s of spots) { const d = rectDist(s, pos.x, pos.z); if (d < s.pad && d < bd) { bd = d; best = s; } }
    if (best !== near) {
      near = best;
      actB.hidden = !near;
      if (near?.pong) actB.textContent = monitor ? 'Spegni Pong · '+(touch?'tocca il monitor':'racchetta I/K') : 'Avvia Pong'+(touch?'':' (E)');
      else if (near) actB.textContent = (near.sit?'':'Apri · ') + near.label + (touch ? '' : '  (E)');
    }
    ring.visible = !!near && !!near.mq;
    for (const s of spots) if (s.mq) s.mq.material.color.setScalar(s === near ? 2.4 + Math.sin(t * 6) * 0.5 : 1.8);
    if (near && near.mq) { ring.position.set(near.x, 0.012, near.z); ring.rotation.z = t; }
    if(!reducedMotion&&pos.x < -6){
      banks[0].emissiveIntensity=.85+.22*Math.sin(t*.84);
      banks[1].emissiveIntensity=.85+.22*Math.sin(t*.84+Math.PI);
    }
    if(!reducedMotion)for(const m of motes)m.rotation.y+=dt*.012;
    for(const demo of demoMaterials){
      if(reducedMotion||Math.abs(pos.x-demo.x)>12)continue;
      demo.sweep.position.y=1.16+((t*.29+demo.offset)%1)*.39;
    }
    const where = pos.z > 6.15 ? 'Sala cinema' : pos.z < -6.15 ? 'Sala tavoli' : pos.x > 7 ? 'Sala biliardo' : pos.x < -7 ? 'Sala giochi' : 'Atrio';
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
      actB.hidden=true;
      cam.yaw+=(Number(keys.has('arrowleft'))-Number(keys.has('arrowright')))*dt*1.7;
      cam.pitch=THREE.MathUtils.clamp(cam.pitch+(Number(keys.has('arrowdown'))-Number(keys.has('arrowup')))*dt,-.65,.8);
      stick.hidden=true;camera.position.set(pos.x,floor+1.12,pos.z+.06);
      camera.lookAt(pos.x-Math.sin(cam.yaw)*Math.cos(cam.pitch),floor+1.12-Math.sin(cam.pitch),camera.position.z-Math.cos(cam.yaw)*Math.cos(cam.pitch));
    }

  }

  function frame(now) {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; t += dt;
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
    const inRange=pos.z>6.15 || (pos.z>0 && Math.abs(pos.x)<1.65);
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
    tableVolume.wrap.style.display=tableRoomGain>0?'flex':'none';
    tableFootball.update(camera,dt,tableRoomGain>0);placePeers();
    localPose=currentPose();const poseKey=JSON.stringify(localPose);
    if(poseKey!==lastPoseKey){lastPoseKey=poseKey;app.poseChanged?.()}
    if(!localPose)for(const arm of me.arms){arm.scale.y=1;arm.rotation.y=0}
    const anchor=modelPose(me,localPose);
    me.head.visible=!firstPerson;
    // al calcio balilla il tuo personaggio non copre il tavolo nella tua vista (gli altri lo vedono alle manopole)
    if(!seating)me.root.visible=!tableFootball.active;
    // al calcio balilla la telecamera la decide il tavolo (dal tuo lato, o dall'alto sullo stesso telefono)
    if(firstPerson&&!seating&&!tableFootball.active){
      const yaw=anchor?.yaw??cam.yaw;
      if(!anchor)me.root.rotation.y=yaw;
      const eyeY=anchor?EYE_Y:me.root.position.y+EYE_Y;
      camera.position.set(me.root.position.x-.09*Math.sin(yaw),eyeY,me.root.position.z-.09*Math.cos(yaw));
      if(anchor){
        const target=localPose.station==='balilla'?new THREE.Vector3(-13,.74,0):new THREE.Vector3(anchor.x-.55*Math.sin(yaw),1.34,anchor.z-.55*Math.cos(yaw));
        camera.lookAt(target);
      }else camera.lookAt(camera.position.x-Math.sin(yaw),eyeY-Math.tan(cam.pitch),camera.position.z-Math.cos(yaw));
    }
    if(tableFootball.active){stick.hidden=true;actB.hidden=true}else if(!seating){stick.hidden=!touch;actB.hidden=!near}
    alignProjection();renderer.render(scene, camera);
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
    pointerNDC.set(2*(e.clientX-bounds.left)/bounds.width-1,1-2*(e.clientY-bounds.top)/bounds.height);
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
    seating=null;seatActions.hidden=true;Object.assign(pos,returnPoint);collide(pos);me.root.visible=true;
    stick.hidden=!touch;near=null;resetMovement();
  }
  enterButton.onclick=()=>{if(seating){const seat=seating;hide();seat.act();app.launched?.(seat)}};
  standButton.onclick=stand;
  // primo posto libero al cabinato (gli altri giocatori del club lo occupano con la loro posa)
  function freeSeat(s){
    const mine=String(app.me?.()?.id??'');
    const taken=new Set((app.peers?.()||[]).filter(u=>u.clubPose?.station===s.station&&String(u.id)!==mine).map(u=>u.clubPose.slot|0));
    for(let k=0;k<(s.seats||1);k++)if(!taken.has(k))return k;
    return 0;
  }
  function launch(s) {
    if(seating||tableFootball.active)return;
    if(s.balilla){setFirst(true);resetMovement();tableFootball.open();return}
    if(s.pong){toggleMonitor(s);return}
    if(s.sit){
      resetMovement();returnPoint={...pos};seating=s;seatActions.hidden=false;actB.hidden=true;stick.hidden=true;cam.pitch=.03;
      pos.x=s.x;pos.z=s.z;heading=Math.PI;cam.yaw=Math.PI;
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
    setTimeout(prepareLights, 1500);
  }
  function hide() {
    tableRoomGain=0;if(tableBus)tableBus.gain.value=0;tableFootball.close();stand();stopMonitor();heard=0;
    active = false;audibleZone=false;app.clubVisibility?.();quietProjection();cancelAnimationFrame(raf);
    resetMovement(); drags.clear(); joy.id = null; joy.x = joy.y = 0; knob.style.transform = '';
    el.hidden = true;
  }
  document.addEventListener('visibilitychange', () => { if(document.hidden){quietProjection();resetMovement();cancelAnimationFrame(raf);last=0}
    else {playProjection(app.projection?.());syncTransport(true);if(active){cancelAnimationFrame(raf);raf=requestAnimationFrame(frame)}} });
  // place(): sposta il personaggio (per le prove), near(): cosa si può aprire adesso
  const place = (x, z, yaw = cam.yaw) => { pos.x = x; pos.z = z; cam.yaw = yaw; collide(pos); };
  // Luci per stanza: ogni luce in più pesa su ogni oggetto disegnato (sui telefoni si sente). Si accendono solo
  // quelle della stanza dove sei e dell'atrio; dall'atrio, che vede tutte le porte, la luce principale di ogni sala.
  // Le combinazioni si preparano subito dopo l'apertura, così cambiare stanza non dà scatti.
  const roomOf = (x, z) => (z > 6.15 ? 'Sala cinema' : z < -6.15 ? 'Sala tavoli' : x > 7 ? 'Sala biliardo' : x < -7 ? 'Sala giochi' : 'Atrio');
  const roomLights = [];
  scene.traverse((o) => { if (o.isLight && !o.isHemisphereLight) roomLights.push({ light: o, room: roomOf(o.getWorldPosition(new THREE.Vector3()).x, o.getWorldPosition(new THREE.Vector3()).z) }); });
  const mainLight = new Map();
  for (const r of roomLights) if (r.room !== 'Atrio' && !r.light.isSpotLight && (!mainLight.has(r.room) || r.light.intensity > mainLight.get(r.room).intensity)) mainLight.set(r.room, r.light);
  let litRoom = '';
  function lightRoom(where) {
    if (where === litRoom) return;
    litRoom = where;
    for (const { light, room } of roomLights) light.visible = room === where || room === 'Atrio' || (where === 'Atrio' && mainLight.get(room) === light);
  }
  let lightsReady = false;
  async function prepareLights() {
    if (lightsReady || !renderer.compileAsync) return;
    lightsReady = true;
    const keep = litRoom;
    for (const room of ['Atrio', 'Sala biliardo', 'Sala giochi', 'Sala tavoli', 'Sala cinema']) {
      if (room === keep) continue;
      // compileAsync legge le luci subito: si rimettono quelle giuste prima di aspettare, così non si vede niente
      lightRoom(room);
      const done = renderer.compileAsync(scene, camera);
      lightRoom(keep);
      try { await done; } catch (e) { /* si compila al primo passaggio */ }
    }
  }
  const api = { setTableVolume, syncProjection:()=>playProjection(app.projection?.()), pose:descriptor, balillaState:data=>tableFootball.receive(data), show, hide, place, near: () => near && near.label, where: () => ({ ...pos }), get active() { return active; }, el };
  el.lobby3d = api;
  return api;
}
