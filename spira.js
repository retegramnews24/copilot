'use strict';
const F=[0,1]; while(F.at(-1)<2584) F.push(F.at(-1)+F.at(-2));
const ratio=89/55, turn=2*Math.PI, golden=turn/(ratio*ratio);
const atlas=[
 ['Radice','Muladhara','Radici di rame','Appoggia il peso. La terra resta.','#f78272',3,144],
 ['Sacro','Svadhisthana','Marea d’ambra','Un’onda si apre, un’altra la raggiunge.','#f8a457',5,233],
 ['Plesso','Manipura','Sole di carta','La luce si piega in petali sottili.','#eed076',8,377],
 ['Cuore','Anahata','Felce di giada','Ogni foglia lascia spazio alla prossima.','#83d6a3',5,610],
 ['Gola','Vishuddha','Conchiglia d’aria','Il silenzio disegna cerchi nell’acqua.','#80cddf',8,987],
 ['Ajna','Ajna','Occhio della notte','Le orbite si incontrano piano.','#a09def',3,1597],
 ['Corona','Sahasrara','Corolla di seta','La trama si apre verso il cielo.','#d5a7eb',13,2584]
];
const el=id=>document.getElementById(id), canvas=document.querySelector('canvas'),g=canvas.getContext('2d');
let index=0, time=0, prev=null, raf=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let saved={};try{saved=JSON.parse(localStorage.getItem('spira-atlas'))||{}}catch{}
function save(){try{localStorage.setItem('spira-atlas',JSON.stringify({index,voice:el('voice').value,level:el('level').value}))}catch{}}
function draw(){
 const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
 const d=Math.min(window.devicePixelRatio||1,ratio);
 if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}
 g.setTransform(d,0,0,d,0,0);const [,,,,color,arms]=atlas[index];
 const x=w*(w>h?5/8:1/2),y=h*(document.body.classList.contains('solo')?1/2:8/21),radius=Math.min(w*3/8,h*5/13);
 const halo=g.createRadialGradient(x,y,0,x,y,radius*ratio*ratio);
 halo.addColorStop(0,color+'34');halo.addColorStop(1,'#101213');g.fillStyle=halo;g.fillRect(0,0,w,h);
 g.save();g.translate(x,y);g.rotate(time*turn/377);g.strokeStyle=color;g.fillStyle=color;g.lineWidth=1;
 // Three nested scales repeat each plate's engraving around a growing rosette.
 function engrave(r,depth){
  const swing=Math.sin(time*turn/55+depth*golden)/13;
  for(let j=0;j<arms;j++){
   g.save();g.rotate(j*turn/arms+swing);g.globalAlpha=depth/8;
   g.beginPath();g.moveTo(0,0);
   if(index===0||index===3){g.lineTo(r/3,-r/8);g.lineTo(r,0);g.lineTo(r/ratio,r/13);g.lineTo(0,0)}
   else if(index===1||index===4){for(let n=0;n<=55;n++){const u=n/55,a=u*golden*(index===4?3:2);g.lineTo(r*u*Math.cos(a),r*u*Math.sin(a))}}
   else {const breadth=index===5?r/ratio:r/3;g.bezierCurveTo(r/3,-breadth,r/ratio,-breadth,r,0);g.bezierCurveTo(r/ratio,breadth,r/3,breadth,0,0)}
   g.stroke();
   if(depth>1){g.translate(r/ratio,0);g.rotate(index%2?golden:-golden);engrave(r*3/8,depth-1)}
   g.restore();
  }
 }
 engrave(radius,arms>=8?2:3);
 // A field of fine contour lines binds the recursive figures into one print.
 for(let j=0;j<34;j++){g.beginPath();g.globalAlpha=(5+(j%8))/55;for(let n=0;n<=144;n++){
 const a=n*turn/144, wave=Math.cos(a*arms+time*turn/89+j/34);
 const r=radius*(13/21+j/89+wave*(3/13)*Math.sin(j/34*Math.PI));
 const px=Math.cos(a)*r,py=Math.sin(a)*r;n?g.lineTo(px,py):g.moveTo(px,py)}g.stroke()}
 for(let n=1;n<=233;n++){const a=n*golden-time*turn/144,r=radius*Math.sqrt(n/233);g.globalAlpha=(1-n/377)*3/5;g.beginPath();g.arc(r*Math.cos(a),r*Math.sin(a),F[2+n%3]/2,0,turn);g.fill()}
 g.restore();
}
function loop(now){raf=0;if(paused||document.hidden)return;if(prev===null)prev=now;
 if(now-prev>=1000/21){time+=Math.min(now-prev,144)/1000;prev=now;draw()}raf=requestAnimationFrame(loop)}
function animate(){cancelAnimationFrame(raf);prev=null;draw();if(!paused&&!document.hidden)raf=requestAnimationFrame(loop);el('motion').textContent=paused?'▷':'Ⅱ';el('motion').setAttribute('aria-label',paused?'Riprendi animazione':'Pausa animazione')}
function select(i){index=i;const row=atlas[i];document.documentElement.style.setProperty('--accent',row[4]);el('latin').textContent=row[1].toUpperCase();el('title').textContent=row[2];el('verse').textContent=row[3];el('number').textContent=String(i+1).padStart(2,'0');Array.from(el('colors').children).forEach((b,n)=>b.setAttribute('aria-pressed',n===i));save();draw();if(playing)compose()}
atlas.forEach(([name,latin,,,color],i)=>{const b=document.createElement('button');b.className='swatch';b.style.setProperty('--c',color);b.innerHTML='<i></i>'+name;b.setAttribute('aria-label',name+' · '+latin);b.onclick=()=>select(i);el('colors').append(b)});
let audio,master,bank,playing=false;
function release(){if(!bank)return;const {gain,nodes}=bank;bank=null;gain.gain.cancelScheduledValues(audio.currentTime);gain.gain.setTargetAtTime(0,audio.currentTime,1/8);for(const o of nodes){o.stop(audio.currentTime+1);o.onended=()=>o.disconnect()}setTimeout(()=>gain.disconnect(),1597)}
function compose(){
 release();const t=audio.currentTime,mode=el('voice').selectedIndex,base=atlas[index][6];
 let root=base;while(root>233)root/=2;
 const gain=audio.createGain();gain.gain.value=0;gain.connect(master);gain.gain.setTargetAtTime(1,t,1/3);
 const nodes=[];for(const [i,harmonic] of [1,3/2,5/3].entries()){
 const o=audio.createOscillator(),v=audio.createGain(),lfo=audio.createOscillator(),depth=audio.createGain();
 o.type=mode===0&&i===0?'triangle':'sine';o.frequency.value=root*harmonic*(mode===2?2:1);
 const amp=1/F[5+i];v.gain.value=amp;lfo.frequency.value=1/([5,8,13][i]*(mode===1?2:1));depth.gain.value=amp*(mode===0?1/3:8/13);lfo.connect(depth);depth.connect(v.gain);o.connect(v);v.connect(gain);o.start(t);lfo.start(t);nodes.push(o,lfo)}
 bank={gain,nodes}
}
function volume(){if(master)master.gain.setTargetAtTime(Number(el('level').value)/89,audio.currentTime,1/8)}
el('play').onclick=async()=>{const b=el('play');b.disabled=true;try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=0;master.connect(audio.destination)}await audio.resume();playing=!playing;if(playing){volume();compose()}else release();b.textContent=playing?'Ⅱ Silenzia':'▷ Ascolta';b.setAttribute('aria-pressed',playing)}catch{b.textContent='Audio indisponibile'}finally{b.disabled=false}};
el('voice').onchange=()=>{if(playing)compose();save()};el('level').oninput=()=>{volume();save()};
el('motion').onclick=()=>{paused=!paused;animate()};
function focusArt(on){document.body.classList.toggle('solo',on);el('back').hidden=!on;(on?el('back'):el('focus')).focus();draw()}
el('focus').onclick=()=>{focusArt(true);full()};el('back').onclick=()=>focusArt(false);addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('solo'))focusArt(false)});
document.addEventListener('visibilitychange',()=>{animate();if(audio){if(document.hidden)audio.suspend().catch(()=>{});else if(playing)audio.resume().catch(()=>{})}});
let connected=false;
function full(){const tg=window.Telegram?.WebApp;if(tg?.initData&&tg.isVersionAtLeast('8.0')&&!tg.isFullscreen){try{tg.requestFullscreen()}catch{}}}
function connectTelegram(){const tg=window.Telegram?.WebApp;if(connected||!tg?.initData)return;connected=true;function layout(){const css=document.documentElement.style;if(tg.viewportHeight>0)css.setProperty('--vh',tg.viewportHeight+'px');for(const [key,side] of [['top','top'],['bot','bottom'],['left','left'],['right','right']])css.setProperty('--'+key,'max(env(safe-area-inset-'+side+', 0px), '+((tg.contentSafeAreaInset?.[side]||0)+(tg.safeAreaInset?.[side]||0))+'px)')}
 tg.ready();tg.expand();for(const e of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])tg.onEvent(e,layout);layout();full()}
if(['Corde','Marea','Campane'].includes(saved.voice))el('voice').value=saved.voice;if(Number.isFinite(Number(saved.level)))el('level').value=saved.level;
select(Number.isInteger(saved.index)&&atlas[saved.index]?saved.index:0);new ResizeObserver(draw).observe(canvas);animate();
