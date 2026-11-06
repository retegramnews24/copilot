import {makeLevel,move,interaction,restoreProgress,VERSION,beginJump,advanceJump} from './core.js';
import {Renderer} from './render.js';
import {Atmosphere} from './audio.js';
const $=id=>document.getElementById(id),canvas=$('scene'),keys=new Set(),coarse=matchMedia('(pointer: coarse)').matches,debug=new URLSearchParams(location.search).get('debug')==='1';
let playerId='guest',seed=crypto.getRandomValues(new Uint32Array(1))[0],level=1,world,player,hasKey=false,seconds=0,started=false,playing=false,transitioning=false,renderer,raf=0,lastTime=0,saveClock=0,stepDistance=0,bob=0,quality='auto',sensitivity=1,sprinting=false,joystick={x:0,y:0,id:null},lookId=null,lastLook=null,dragging=false,toastTimer=0,slowFrames=0,autoReduced=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
const jumpState={height:0,velocity:0};
const sound=new Atmosphere(read('labyrinth-sound',true));
function tell(message){try{if(parent!==window)parent.postMessage({type:'labyrinth:trace',message},location.origin)}catch{}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;toastTimer=setTimeout(()=>$('toast').textContent='',3000)}
function updateSound(){$('sound').setAttribute('aria-pressed',String(sound.enabled));$('sound').setAttribute('aria-label',sound.enabled?'Disattiva audio':'Attiva audio');$('sound').textContent=sound.enabled?'♫':'♪̸'}
function resetInput(){keys.clear();joystick={x:0,y:0,id:null};lookId=null;lastLook=null;dragging=false;$('stick').style.transform='';sprinting=false;$('sprint').setAttribute('aria-pressed','false')}
function store(){if(!started||!player)return;write('binottoland-labyrinth-'+playerId,{version:VERSION,seed,level,hasKey,seconds,player:{x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch}})}
function loadWorld(saved=null){jumpState.height=0;jumpState.velocity=0;world=makeLevel(seed,level);player=saved?.player?{...saved.player}:{...world.spawn,pitch:0};hasKey=!!saved?.hasKey;renderer.load(world);$('floor').textContent='PIANO '+String(level).padStart(2,'0');$('objective').textContent=hasKey?'Chiave trovata · cerca l’uscita':'Trova la chiave';renderer.draw(player,hasKey,0);saveClock=0;bob=0;stepDistance=0}
function loadSaved(){const saved=restoreProgress(read('binottoland-labyrinth-'+playerId,null));if(saved){seed=saved.seed;level=saved.level;seconds=saved.seconds;loadWorld(saved);$('start').textContent='Continua · Piano '+level;$('new-run').hidden=false;$('saved-info').textContent='La tua esplorazione ti aspetta.'}else{level=1;seconds=0;loadWorld();$('start').textContent='Entra nel labirinto';$('new-run').hidden=true;$('saved-info').textContent=''}return !!saved}
function portrait(){return document.body.classList.contains('touch')&&innerHeight>innerWidth}
function updateOrientation(){const blocked=playing&&portrait();$('portrait').hidden=!blocked;sound.active(playing&&!blocked);if(!playing)renderer?.draw(player,hasKey,performance.now()/1000)}
function look(dx,dy,touch=false){if(!playing||transitioning||portrait())return;const scale=(touch ? .0045 : .0021)*sensitivity;player.yaw+=dx*scale;player.yaw=((player.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.pitch=Math.max(-1.15,Math.min(1.15,player.pitch-dy*scale))}
function pointerLock(){if(coarse||document.body.classList.contains('touch'))return;try{const result=canvas.requestPointerLock?.();result?.catch(()=>toast('Trascina sullo schermo per guardarti intorno.'))}catch{toast('Trascina sullo schermo per guardarti intorno.')}}
function resume(){if(!renderer||transitioning)return;started=true;playing=true;$('menu').hidden=true;$('fatal').textContent='';document.body.classList.add('playing');$('menu-title').textContent='Labyrinth';resetInput();sound.resume();updateOrientation();canvas.focus({preventScroll:true});pointerLock();lastTime=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);store();tell('Piano '+level+' · esplorazione avviata')}
function pause(){if(!started||transitioning)return;playing=false;cancelAnimationFrame(raf);raf=0;resetInput();sound.active(false);if(document.pointerLockElement)document.exitPointerLock?.();document.body.classList.remove('playing');$('portrait').hidden=true;$('menu').hidden=false;$('menu-title').textContent='Una pausa.';$('start').textContent='Riprendi l’esplorazione';$('new-run').hidden=false;$('saved-info').textContent='Piano '+level+(hasKey?' · chiave trovata':' · chiave da trovare');store()}
function leave(){store();sound.active(false);if(parent!==window)parent.postMessage({type:'labyrinth:exit'},location.origin);else location.href='/'}
function tryJump(){if(playing&&!transitioning&&!portrait())beginJump(jumpState)}
function use(){
 if(!playing||transitioning||portrait())return;
 const target=interaction(world,player,hasKey);
 if(target==='key'){hasKey=true;$('objective').textContent='Chiave trovata · cerca l’uscita';sound.chime();toast('La chiave. Ora trova la porta.');store();tell('Piano '+level+' · chiave raccolta')}
 else if(target==='locked')toast('La porta è chiusa. Devi trovare la chiave.');
 else if(target==='exit'){
  transitioning=true;resetInput();sound.chime();$('transition-label').textContent='PIANO '+String(level+1).padStart(2,'0');$('transition').hidden=false;if(document.pointerLockElement)document.exitPointerLock?.();
  setTimeout(()=>{if(level>=999){seed=crypto.getRandomValues(new Uint32Array(1))[0];level=0}level++;hasKey=false;loadWorld();store();tell('Passaggio al piano '+level);$('transition').hidden=true;transitioning=false;if(document.hidden)pause();else{updateOrientation();toast('Il ronzio è diverso. La porta si è richiusa.')}},500);
 }
}
function tick(now){
 if(!playing)return;const raw=(now-lastTime)/1000,dt=Math.min(.1,Math.max(0,raw));lastTime=now;
 if(!transitioning&&!portrait()){
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
  let strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
  const magnitude=Math.hypot(forward,strafe);if(magnitude>1){forward/=magnitude;strafe/=magnitude}
  const fast=keys.has('ShiftLeft')||keys.has('ShiftRight')||sprinting,speed=(fast?3.65:2.15)*dt,oldX=player.x,oldZ=player.z;
  move(world,player,(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*strafe)*speed,(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*strafe)*speed);
  const walked=Math.hypot(player.x-oldX,player.z-oldZ);stepDistance+=walked;bob=walked&&!reduced?Math.sin(seconds*(fast?15:10))*.018:0;
  advanceJump(jumpState,dt);if(stepDistance>.82&&jumpState.height<.02){sound.step(fast);stepDistance=0}seconds+=dt;saveClock+=dt;if(saveClock>5){store();saveClock=0}
  const target=interaction(world,player,hasKey),touch=document.body.classList.contains('touch');$('use').disabled=!target;$('hint').textContent=target==='key'?(touch?'Usa · raccogli la chiave':'E · raccogli la chiave'):target==='exit'?(touch?'Usa · apri la porta':'E · apri la porta'):target==='locked'?'Porta chiusa · manca la chiave':'';
  if(!target&&!touch&&document.pointerLockElement!==canvas)$('hint').textContent='Clicca per guardarti intorno · Esc per la pausa';
  renderer.draw(player,hasKey,now/1000,bob+jumpState.height);
  if(quality==='auto'&&!autoReduced&&seconds>8){if(raw>.045)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>80){renderer.quality='low';autoReduced=true;toast('Dettaglio regolato per una maggiore fluidità.')}}
  if(debug){$('debug').hidden=false;$('debug').textContent='Piano '+level+' · '+Math.round(1/Math.max(raw,.001))+' fps\nx '+player.x.toFixed(2)+' z '+player.z.toFixed(2)+' · chiave '+hasKey+'\n'+canvas.width+' × '+canvas.height}
 }
 raf=requestAnimationFrame(tick);
}
$('start').onclick=resume;
$('new-run').onclick=()=>{if(!confirm('Ricominci da un nuovo labirinto? I progressi di questa esplorazione saranno sostituiti.'))return;seed=crypto.getRandomValues(new Uint32Array(1))[0];level=1;seconds=0;hasKey=false;loadWorld();resume()};
$('leave').onclick=leave;$('portrait-exit').onclick=leave;$('pause').onclick=pause;$('use').onclick=use;$('jump').onclick=tryJump;
$('sound').onclick=()=>{sound.toggle();sound.active(playing&&!portrait());write('labyrinth-sound',sound.enabled);updateSound()};
$('sprint').onclick=()=>{sprinting=!sprinting;$('sprint').setAttribute('aria-pressed',String(sprinting))};
$('sensitivity').value=String(sensitivity=Math.max(.4,Math.min(2.2,Number(read('labyrinth-sensitivity',1))||1)));
$('sensitivity').oninput=e=>{sensitivity=Number(e.target.value);write('labyrinth-sensitivity',sensitivity)};
$('quality').value=quality=['auto','low','high'].includes(read('labyrinth-quality','auto'))?read('labyrinth-quality','auto'):'auto';
$('quality').onchange=e=>{quality=e.target.value;renderer.quality=quality;autoReduced=false;write('labyrinth-quality',quality);renderer.draw(player,hasKey,performance.now()/1000)};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Schermo intero gestito da Telegram su questo dispositivo.')}};
window.addEventListener('keydown',e=>{if(e.code==='Escape'){if(playing)pause();return}if(!playing||transitioning)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)use();if(e.code==='Space'&&!e.repeat)tryJump()}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{resetInput();if(playing&&!transitioning)pause()});
canvas.addEventListener('mousedown',e=>{if(!playing)return;if(e.button===0){dragging=true;pointerLock()}});window.addEventListener('mouseup',()=>dragging=false);
window.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas||dragging)look(e.movementX,e.movementY)});
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing&&!transitioning&&!dragging)pause()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const joyElement=$('joystick');
function moveStick(e){const r=joyElement.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.hypot(dx,dy),max=r.width*.34,scale=len>max?max/len:1;joystickState(dx*scale/max,dy*scale/max,e.pointerId);$('stick').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)'}
function joystickState(x,y,id){joystick.x=x;joystick.y=y;joystick.id=id}
joyElement.addEventListener('pointerdown',e=>{if(!playing||portrait()||joystick.id!==null)return;e.preventDefault();joyElement.setPointerCapture(e.pointerId);moveStick(e)});
joyElement.addEventListener('pointermove',e=>{if(joystick.id===e.pointerId)moveStick(e)});
function endStick(e){if(e.pointerId===joystick.id){joystick={x:0,y:0,id:null};$('stick').style.transform=''}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])joyElement.addEventListener(event,endStick);
const lookZone=$('look-zone');
lookZone.addEventListener('pointerdown',e=>{if(!playing||portrait()||lookId!==null)return;e.preventDefault();lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};lookZone.setPointerCapture(e.pointerId)});
lookZone.addEventListener('pointermove',e=>{if(lookId!==e.pointerId||!lastLook)return;look(e.clientX-lastLook.x,e.clientY-lastLook.y,true);lastLook={x:e.clientX,y:e.clientY}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])lookZone.addEventListener(event,e=>{if(lookId===e.pointerId){lookId=null;lastLook=null}});
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!document.body.classList.contains('touch')){document.body.classList.add('touch');updateOrientation()}},{capture:true});
if(coarse)document.body.classList.add('touch');
window.addEventListener('resize',updateOrientation);
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();store();sound.active(false);if(playing&&!transitioning)pause()}});
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='labyrinth:identity'||started)return;const id=String(event.data.player||'');if(!/^\d{1,20}$/.test(id)||id===playerId)return;playerId=id;if(renderer)loadSaved()});
window.addEventListener('pagehide',()=>{store();playing=false;cancelAnimationFrame(raf);clearTimeout(toastTimer);sound.destroy();renderer?.destroy()});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(playing)pause();renderer=null;$('start').disabled=true;$('fatal').textContent='La grafica è stata sospesa dal dispositivo. Attendi il ripristino oppure riapri Labyrinth.';tell('Contesto WebGL sospeso')});
canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new Renderer(canvas);renderer.quality=quality;renderer.load(world);renderer.draw(player,hasKey,0);$('fatal').textContent='';$('start').disabled=false;tell('Contesto WebGL ripristinato')}catch(e){$('fatal').textContent=e.message}});
try{renderer=new Renderer(canvas);renderer.quality=quality;loadSaved();updateSound();tell('Motore 3D pronto')}catch(error){$('fatal').textContent=error.message;$('start').disabled=true;$('new-run').hidden=true;$('menu-note').textContent='La grafica 3D richiede WebGL. Puoi tornare a Binottoland e provare da un altro dispositivo.';tell('Avvio non riuscito: '+error.message)}
if(parent!==window)parent.postMessage({type:'labyrinth:ready'},location.origin);
