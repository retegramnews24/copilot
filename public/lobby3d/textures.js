// Lobby 3D: texture disegnate al volo su canvas (pavimenti, pareti, lavagna, cabinati, cartelli).
import * as THREE from 'three';

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function neonText(text, color, w = 1024, h = 256, font = 'bold 140px "Arial Black", Arial, sans-serif') {
  return canvasTex(w, h, (g) => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 36; g.fillStyle = color; g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 10; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(text, w / 2, h / 2);
  });
}
export function parquet() {
  return canvasTex(512, 512, (g) => {
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 4; col++) {
        const x = col * 192 + (row % 3) * 64, y = row * 64;
        g.fillStyle = 'hsl(29,38%,' + (36 + ((row * 7 + col + 4) % 8)) + '%)';
        g.fillRect(x, y, 192, 64);
        g.save(); g.beginPath(); g.rect(x, y, 192, 64); g.clip();
        for (let k = 0; k < 36; k++) {
          const v = y + (k * 17 % 64);
          g.strokeStyle = k % 4 ? '#edd5ac25' : '#351d1533';
          g.beginPath(); g.moveTo(x, v); g.bezierCurveTo(x+70,v-4,x+106,v+9,x+192,v+1); g.stroke();
        }
        g.restore(); g.fillStyle='#38291e80'; g.fillRect(x,y,192,1.5); g.fillRect(x,y,1.5,64);
      }
    }
  });
}

// A single painted surface per long wall keeps the mouldings and murals inexpensive on phones.
export function wallFinish(room) {
  return canvasTex(2048, 512, (g,w,h) => {
    const atrium=room==='atrium', pool=room==='pool';
    const wash=g.createLinearGradient(0,0,0,h);
    const colors=atrium?['#c3af91','#f1e1c4','#b79e80']:pool?['#102a28','#315550','#142f2d']:['#10132b','#31214a','#16132a'];
    colors.forEach((c,i)=>wash.addColorStop(i/2,c));g.fillStyle=wash;g.fillRect(0,0,w,h);
    if(!atrium&&!pool){
      // A sunset and layered vector mountains behind the cabinets.
      const sky=g.createLinearGradient(0,45,0,260);sky.addColorStop(0,'#ffbc64');sky.addColorStop(1,'#d14688');
      g.fillStyle=sky;g.beginPath();g.arc(1010,205,114,0,Math.PI*2);g.fill();
      g.fillStyle='#392040';for(let y=195;y<320;y+=11)g.fillRect(892,y,236,(y-170)/23);
      for(let layer=0;layer<2;layer++){
        g.beginPath();g.moveTo(0,h);
        for(let x=0;x<=w;x+=32){const y=228+layer*52+Math.sin(x*.011+layer)*40+Math.cos(x*.041+layer)*17;g.lineTo(x,y)}
        g.lineTo(w,h);g.closePath();g.fillStyle=layer?'#17182d':'#48325b';g.fill();g.lineWidth=2;g.strokeStyle=layer?'#36899b':'#af65a5';g.stroke();
      }
      g.fillStyle='#c7b3d0';for(let i=0;i<100;i++)g.fillRect((i*349)%w,(i*83)%123,2,2);
      return;
    }
    const base=atrium?370:325;
    g.fillStyle=atrium?'#614636':'#483025';g.fillRect(0,base,w,h-base);
    for(let x=0;x<w;x+=128){
      g.fillStyle=atrium?'#775640':'#51392b';g.fillRect(x+6,base+11,116,h-base-20);
      g.strokeStyle='#281e18';g.lineWidth=3;g.strokeRect(x+12,base+18,104,h-base-36);
      g.strokeStyle='#a17a50';g.lineWidth=1;g.strokeRect(x+15,base+21,98,h-base-42);
    }
    g.fillStyle='#392b21';g.fillRect(0,base-7,w,8);g.fillStyle='#c69b60';g.fillRect(0,base-9,w,3);
    for(let i=0;i<16000;i++){g.fillStyle=i%2?'#fff4db12':'#30201812';g.fillRect((i*499)%w,(i*73+Math.floor(i/512)*37)%h,2,1)}
  });
}
export function tiles(hue, l1, l2) {
  return canvasTex(512, 512, (g, w) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = `hsl(${hue},14%,${((i + j) % 2 ? l1 : l2) + Math.random() * 2}%)`; g.fillRect(i * s, j * s, s, s);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.strokeRect(i * s, j * s, s, s);
    }
  });
}
export function neonGrid() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#0a0614'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#53317d'; g.lineWidth = 2; g.shadowColor = '#a855f7'; g.shadowBlur = 12;
    for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}
export function blackboard() {
  return canvasTex(1024, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#1f3a2c'); gr.addColorStop(1, '#17291f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // polvere di gesso
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1 + Math.random() * 3); }
    g.fillStyle = '#f3f1e6'; g.textBaseline = 'top';
    g.font = 'bold 96px "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive';
    g.fillText('⚙ Impostazioni', 60, 46, 900); // al massimo 900 px: la parola è più lunga di «Settings»
    g.font = '52px "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive';
    ['• Tema e colori', '• Il tuo personaggio', '• Avvisi e notifiche', '• Archivio · Informazioni'].forEach((t, i) => g.fillText(t, 80, 200 + i * 86));
    g.strokeStyle = 'rgba(243,241,230,.8)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(60, 168); g.bezierCurveTo(360, 158, 680, 176, 880, 162); g.stroke();
    // un disegnino: la palla 8
    g.beginPath(); g.arc(860, 470, 80, 0, 7); g.stroke();
    g.beginPath(); g.arc(860, 470, 32, 0, 7); g.stroke();
    g.font = 'bold 44px "Segoe Print", "Comic Sans MS", cursive'; g.fillText('8', 846, 444);
  });
}
export function gamesPoster() {
  const list = [['Scacchi', '#c9b27c'], ['Dama', '#b0745a'], ['Forza 4', '#d9534f'], ['UNO', '#e94b3c'], ['Scarabeo', '#d6a648'], ['Scopa', '#3f8f5c'], ['Briscola', '#8c4b8a'], ['Navale', '#2f6f9f'], ['Cinema', '#d64575']];
  return canvasTex(640, 900, (g, w, h) => {
    g.fillStyle = '#f6efe1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2140'; g.font = 'bold 76px "Arial Black", Arial, sans-serif'; g.textAlign = 'center';
    g.fillText('Tutti', w / 2, 110); g.fillText('i giochi', w / 2, 196);
    list.forEach(([t, c], i) => {
      const x = 60 + (i % 3) * 180, y = 260 + Math.floor(i / 3) * 200;
      g.fillStyle = c; g.beginPath(); g.roundRect(x, y, 160, 150, 26); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.fillText(t, x + 80, y + 88);
    });
  });
}
export function cabinetScreen(title, color) {
  return canvasTex(256, 200, (g, w, h) => {
    const c = new THREE.Color(color);
    const hsl = {}; c.getHSL(hsl);
    const hue = Math.round(hsl.h * 360);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `hsl(${hue},70%,22%)`); gr.addColorStop(1, `hsl(${hue + 50},70%,7%)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.save();g.beginPath();g.rect(0,54,w,106);g.clip();g.fillStyle=color;g.strokeStyle=color;g.lineWidth=3;
    if(/Ruggine|F1|Binotto|Moto/.test(title)){
      for(let n=0;n<5;n++){g.beginPath();g.moveTo(108+n*10,75);g.lineTo(n*78-35,160);g.stroke()}
      for(let n=0;n<4;n++){const x=42+n*48,y=129-(n%3)*16;g.fillStyle='#ffc16f';g.fillRect(x,y,21,8);g.fillStyle='#232739';g.fillRect(x+5,y-4,10,5)}
    }else if(title==='Pong'){
      g.fillRect(25,100,6,31);g.fillRect(224,73,6,31);g.fillRect(173,92,7,7);
      for(let y=58;y<155;y+=13)g.fillRect(127,y,2,6);
    }else if(/Lunar|Giulio|Golf/.test(title)){
      g.beginPath();g.moveTo(0,155);for(let x=0;x<=w;x+=8)g.lineTo(x,119+Math.sin(x*.045)*16+7*Math.cos(x*.09));g.lineTo(w,160);g.fill();
      g.fillStyle='#ffdc9e';g.beginPath();g.arc(193,75,12,0,7);g.fill();
      if(/Lunar/.test(title)){g.fillRect(95,91,19,10);g.fillRect(99,86,11,6);g.fillRect(93,101,3,7);g.fillRect(113,101,3,7)}
      if(/Giulio/.test(title))for(let x=0;x<4;x++){g.fillRect(50+35*x,104,32,14);g.fillStyle='#efbd84'}
      if(title==='Golf'){g.fillRect(171,96,2,32);g.fillRect(172,96,12,7)}
    }else{
      for(let n=0;n<30;n++){const x=29+(n%10)*20,y=73+Math.floor(n/10)*23;g.strokeRect(x,y,16,18);if((n*7)%5<2)g.fillRect(x+4,y+4,8,10)}
    }
    g.restore();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${title.length > 12 ? 24 : 30}px "Arial Black", Arial, sans-serif`;
    g.shadowColor = color; g.shadowBlur = 12; g.fillText(title.toUpperCase(), w / 2, 32);
    g.shadowBlur = 0; g.font = 'bold 18px monospace'; g.fillText('▶ PREMI APRI', w / 2, h - 22);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, w, 1); }
  });
}
export function nameTag(text) {
  return canvasTex(512, 96, (g, w, h) => {
    g.font = 'bold 44px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font='900 76px Arial,sans-serif';g.lineJoin='round';g.strokeStyle='#19191c';g.lineWidth=7;
    g.strokeText(text,w/2,h/2,w-12);

    g.fillStyle = '#fff'; g.fillText(text, w / 2, h / 2,w-12);
  });
}
export function blobTex() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

