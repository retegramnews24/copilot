import {move,free,restoreProgress,beginJump,CELL} from './core.js';
import {worldFor,newRun,readRun,floorState,itemsAt,pickup,drop,hasPass,capacity,openDoor,closeDoor,openShowcase,takeBackpack,takeSword,nextWaypoint,advanceBounce,onSpring,beginAction,advanceAction} from './adventure.js';
import {Renderer} from './render.js';
import {readAppearance} from './avatar.js';
import {Atmosphere} from './audio.js';
const $=id=>document.getElementById(id),canvas=$('scene'),keys=new Set(),coarse=matchMedia('(pointer: coarse)').matches,debug=new URLSearchParams(location.search).get('debug')==='1';
let playerId='guest',seed=crypto.getRandomValues(new Uint32Array(1))[0],level=1,world,player,hasKey=false,seconds=0,started=false,playing=false,transitioning=false,renderer,raf=0,lastTime=0,saveClock=0,stepDistance=0,bob=0,quality='auto',sensitivity=1,sprinting=false,joystick={x:0,y:0,id:null},lookId=null,lastLook=null,dragging=false,toastTimer=0,slowFrames=0,autoReduced=false;
let run=newRun(seed,true),selectedSlot=0,guideEnabled=true,guideClock=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
const jumpState={height:0,velocity:0},actionState={remaining:0,cooldown:0};
const sound=new Atmosphere(read('labyrinth-sound',true));
function tell(message){try{if(parent!==window)parent.postMessage({type:'labyrinth:trace',message},location.origin)}catch{}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;toastTimer=setTimeout(()=>$('toast').textContent='',3000)}
function updateSound(){$('sound').setAttribute('aria-pressed',String(sound.enabled));$('sound').setAttribute('aria-label',sound.enabled?'Disattiva audio':'Attiva audio');$('sound').textContent=sound.enabled?'♫':'♪̸'}
function resetInput(){keys.clear();joystick={x:0,y:0,id:null};lookId=null;lastLook=null;dragging=false;$('stick').style.transform='';sprinting=false;actionState.remaining=0;actionState.cooldown=0;document.body.classList.remove('is-striking');$('sprint').setAttribute('aria-pressed','false')}
function store(){if(!started||!player)return;run.player={x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch};run.seconds=seconds;run.level=level;write('binottoland-labyrinth-v2-'+playerId,run)}
function updateInventory(){
 const root=$('inventory');root.replaceChildren();selectedSlot=Math.max(0,Math.min(selectedSlot,capacity(run)-1));
 for(let i=0;i<capacity(run);i++){const id=run.inventory[i],b=document.createElement('button');b.setAttribute('aria-label','Posto '+(i+1)+' · '+(id==='pass'?'Passe-partout':id==='sword'?'Spada':id?'Keycard':'Vuoto'));b.setAttribute('aria-pressed',String(i===selectedSlot));const number=document.createElement('small');number.textContent=i+1;b.append(number);if(id==='pass'||id?.startsWith('key:')){const icon=document.createElement('span');icon.className='card-icon';icon.style.setProperty('--stripe',id==='pass'?'#16181b':worldFor(seed,Number(id.split(':')[1])).palette.stripe);b.append(icon)}else if(id==='sword'){const icon=document.createElement('span');icon.textContent='⚔';b.append(icon)}b.onclick=()=>{selectedSlot=i;updateInventory()};root.append(b)}
 window.dispatchEvent(new CustomEvent('labyrinth:equipment',{detail:{backpack:run.backpack}}));
 $('hand-view').classList.toggle('with-sword',run.inventory[selectedSlot]==='sword');$('hand-view').style.setProperty('--sleeve',readAppearance().shirt);$('action').textContent=run.inventory[selectedSlot]==='sword'?'Colpisci':'Azione';
 $('drop-item').hidden=!run.inventory[selectedSlot]||run.inventory[selectedSlot]==='sword';
}
function syncScene(){hasKey=run.inventory.includes('key:'+level);renderer.scene={appearance:readAppearance(),items:itemsAt(run,world),showcaseOpen:run.showcaseOpen,backpack:run.backpack,swordTaken:run.swordTaken,doorOpen:floorState(run,world).open};}
function loadWorld(saved=null,back=false){
 jumpState.height=0;jumpState.velocity=0;world=worldFor(seed,level);floorState(run,world);player=saved?.player?{...saved.player}:{...world.spawn,pitch:0};
 if(back){player.x=world.door.x-world.door.dx*1.25;player.z=world.door.z-world.door.dz*1.25;player.yaw=Math.atan2(-world.door.dx,world.door.dz)}
 renderer.load(world);syncScene();$('hand-view').style.filter='brightness('+Math.max(.11,world.palette.brightness*.82)+')';$('floor').textContent=world.arena?'ARENA':'PIANO '+String(level).padStart(2,'0')+' · '+world.palette.name.toUpperCase();$('objective').textContent=world.arena?(run.showcaseOpen?'Raccogli il tuo equipaggiamento':'Esplora oppure apri la vetrina'):'Trova la keycard · raggiungi l’uscita';renderer.draw(player,hasKey,0);saveClock=0;bob=0;stepDistance=0;guideClock=1;updateInventory();updateActions();$('test-travel').hidden=!run.test;
}
function loadSaved(){
 let saved=readRun(read('binottoland-labyrinth-v2-'+playerId,null));
 if(!saved){const old=restoreProgress(read('binottoland-labyrinth-'+playerId,null));if(old){saved=newRun(old.seed,true);saved.level=Math.min(5,old.level);saved.seconds=old.seconds;if(saved.level===old.level)saved.player=old.player}}
 run=saved||newRun(seed,true);run.test=true;seed=run.seed;level=run.level;seconds=run.seconds;loadWorld(saved);$('start').textContent=saved?'Continua · '+(level===6?'Arena':'Piano '+level):'Entra nel labirinto';$('new-run').hidden=!saved;$('saved-info').textContent=run.test?'Prova · selezione dei livelli disponibile':'';return !!saved;
}
function portrait(){return document.body.classList.contains('touch')&&innerHeight>innerWidth}
function updateOrientation(){const blocked=playing&&portrait();$('portrait').hidden=!blocked;sound.active(playing&&!blocked);if(!playing)renderer?.draw(player,hasKey,performance.now()/1000)}
function look(dx,dy,touch=false){if(!playing||transitioning||portrait())return;const scale=(touch ? .0045 : .0021)*sensitivity;player.yaw+=dx*scale;player.yaw=((player.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.pitch=Math.max(-1.15,Math.min(1.15,player.pitch-dy*scale))}
function pointerLock(){if(coarse||document.body.classList.contains('touch'))return;try{const result=canvas.requestPointerLock?.();result?.catch(()=>toast('Trascina sullo schermo per guardarti intorno.'))}catch{toast('Trascina sullo schermo per guardarti intorno.')}}
function resume(){if(!renderer||transitioning)return;started=true;playing=true;syncScene();$('menu').hidden=true;$('fatal').textContent='';document.body.classList.add('playing');$('menu-title').textContent='Labyrinth';resetInput();sound.resume();updateOrientation();canvas.focus({preventScroll:true});pointerLock();lastTime=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);store();tell('Piano '+level+' · esplorazione avviata')}
function pause(){if(!started||transitioning)return;playing=false;cancelAnimationFrame(raf);raf=0;resetInput();sound.active(false);if(document.pointerLockElement)document.exitPointerLock?.();document.body.classList.remove('playing');$('portrait').hidden=true;$('menu').hidden=false;$('menu-title').textContent='Una pausa.';$('start').textContent='Riprendi l’esplorazione';$('new-run').hidden=false;$('saved-info').textContent=(world.arena?'Arena':'Piano '+level)+(hasPass(run)?' · passe-partout':'');store()}
function leave(){store();sound.active(false);if(parent!==window)parent.postMessage({type:'labyrinth:exit'},location.origin);else location.href='/'}
function tryJump(){if(playing&&!transitioning&&!portrait())beginJump(jumpState)}
function nearby(a,d=1.8){return Math.hypot(player.x-a.x,player.z-a.z)<d}
function aimedAt(item){const dx=item.x-player.x,dz=item.z-player.z,d=Math.hypot(dx,dz);return d<.38||(player.pitch<-.35&&(dx*Math.sin(player.yaw)-dz*Math.cos(player.yaw))/Math.max(.001,d)>.72)}
function facing(item){const dx=item.x-player.x,dz=item.z-player.z;return (dx*Math.sin(player.yaw)-dz*Math.cos(player.yaw))/Math.max(.001,Math.hypot(dx,dz))>.65}
function strike(){if(!playing||transitioning||portrait())return;if(beginAction(actionState)){document.body.classList.add('is-striking');sound.swish?.()}}
function target(){
 for(const item of itemsAt(run,world))if(nearby(item,item.type==='pass'?.95:1.25)&&aimedAt(item))return {kind:'card',item,label:item.type==='pass'?'Prendi passe-partout':'Prendi keycard'};
 if(world.arena){if(nearby(world.showcase,2.5)&&facing(world.showcase)){if(!run.showcaseOpen)return {kind:'showcase',label:'Apri vetrina'};if(!run.backpack)return {kind:'backpack',label:'Prendi zaino'};if(!run.swordTaken)return {kind:'sword',label:'Prendi spada'}}if(nearby(world.door))return {kind:hasPass(run)?'back':'no-back',label:hasPass(run)?'Torna al piano nero':'Per tornare serve il passe-partout'};return null}
 if(nearby(world.door))return {kind:floorState(run,world).open?'exit':'door',label:floorState(run,world).open?(level===5?'Entra nell’arena':'Vai al piano successivo'):'Apri porta'};
 if(level>1&&nearby(world.spawn,1))return {kind:hasPass(run)?'back':'no-back',label:hasPass(run)?'Torna al piano precedente':'Per tornare serve il passe-partout'};
 return null;
}
function updateActions(){if(!world||!player)return;$('objective').textContent=world.arena?(run.swordTaken?'Equipaggiamento pronto':run.showcaseOpen?'Raccogli il tuo equipaggiamento':'Esplora oppure apri la vetrina'):hasPass(run)?'Passe-partout · segui l’uscita':hasKey?'Keycard raccolta · cerca l’uscita':'Trova la keycard · raggiungi l’uscita';const t=target(),touch=document.body.classList.contains('touch');$('use').disabled=!t;$('hint').textContent=t?(touch?'Usa · ':'E · ')+t.label:'';$('close-door').hidden=world.arena||!floorState(run,world).open||!nearby(world.door,2.2);
 if(!world.arena&&guideEnabled){$('guide').hidden=false;guideClock++;if(guideClock>8){guideClock=0;const q=nextWaypoint(world,player,world.door);if(q){const angle=Math.atan2(q.x-player.x,-(q.z-player.z))-player.yaw;$('guide-arrow').style.transform='rotate('+angle+'rad)';$('guide-text').textContent='Uscita · percorso '+Math.max(1,Math.round(q.steps*CELL))+' m'}}}else $('guide').hidden=true;
}
function changeLevel(next,back=false){
 const cardSlot=run.inventory.indexOf('key:'+level);if(cardSlot>=0)drop(run,world,cardSlot,player);
 transitioning=true;resetInput();sound.chime();$('transition-label').textContent=next===6?'ARIA APERTA':'PIANO '+String(next).padStart(2,'0');$('transition').hidden=false;if(document.pointerLockElement)document.exitPointerLock?.();
 setTimeout(()=>{level=next;run.level=level;run.player=null;loadWorld(null,back);store();tell('Passaggio a '+(level===6?'Arena':'piano '+level));$('transition').hidden=true;transitioning=false;if(document.hidden)pause();else{updateOrientation();toast(level===6?'Sei fuori. La vetrina ti aspetta.':'Piano '+level+' · '+world.palette.name)}},500);
}
function use(){
 if(!playing||transitioning||portrait())return;const t=target();if(!t)return;
 if(t.kind==='card'){const result=pickup(run,world,t.item.id);if(result==='full')toast('Tasca piena. Seleziona la carta e lasciala a terra.');else if(result==='ok'){sound.chime();toast(t.item.type==='pass'?'Passe-partout raccolto. Non si consuma.':'Keycard raccolta.');tell(t.label)}}
 else if(t.kind==='door'){if(openDoor(run,world)){sound.chime();toast('Porta aperta. Usa per attraversare, C per richiudere.')}else toast('Porta chiusa. Cerca la keycard a terra.')}
 else if(t.kind==='exit'){changeLevel(level+1);return}
 else if(t.kind==='back'){changeLevel(level-1,true);return}
 else if(t.kind==='no-back')toast('Puoi tornare indietro solo con il passe-partout.');
 else if(t.kind==='showcase')openCase();
 else if(t.kind==='backpack'){if(takeBackpack(run)){sound.chime();toast('Zaino raccolto · cinque posti disponibili.')}}
 else if(t.kind==='sword'){if(takeSword(run)){sound.chime();selectedSlot=run.inventory.indexOf('sword');toast('Spada raccolta · F, clic o Colpisci.')}else toast('Non c’è spazio nello zaino.')}
 syncScene();updateInventory();updateActions();store();
}
function openCase(){if(!playing||transitioning||!world.arena||!nearby(world.showcase,2.5)||!facing(world.showcase))return;if(openShowcase(run)){sound.chime();toast('Vetrina aperta. Raccogli lo zaino, poi la spada.');$('objective').textContent='Raccogli il tuo equipaggiamento';tell('Arena · vetrina aperta');syncScene();updateActions();store()}}
function shutDoor(){if(!playing||transitioning||world.arena||!nearby(world.door,2.2))return;if(closeDoor(run,world)){toast('Porta richiusa. Una nuova keycard è comparsa sul piano.');syncScene();updateActions();store()}}
function dropSelected(){if(!playing||transitioning)return;if(drop(run,world,selectedSlot,player)){toast('Carta lasciata a terra. Guarda ai tuoi piedi per riprenderla.');syncScene();updateInventory();updateActions();store()}}
function tick(now){
 if(!playing)return;const raw=(now-lastTime)/1000,dt=Math.min(.1,Math.max(0,raw));lastTime=now;
 if(!transitioning&&!portrait()){
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
  let strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
  const magnitude=Math.hypot(forward,strafe);if(magnitude>1){forward/=magnitude;strafe/=magnitude}
  const fast=keys.has('ShiftLeft')||keys.has('ShiftRight')||sprinting,speed=(fast?3.65:2.15)*dt,oldX=player.x,oldZ=player.z;
  move(world,player,(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*strafe)*speed,(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*strafe)*speed);
  const walked=Math.hypot(player.x-oldX,player.z-oldZ);stepDistance+=walked;bob=walked&&!reduced?Math.sin(seconds*(fast?15:10))*.018:0;
  advanceBounce(jumpState,dt,world.arena);if(jumpState.height<.05&&jumpState.velocity<=0&&onSpring(world,player)){jumpState.velocity=9.3;sound.step(true)}if(stepDistance>.82&&jumpState.height<.02){sound.step(fast);stepDistance=0}seconds+=dt;saveClock+=dt;if(saveClock>5){store();saveClock=0}
  advanceAction(actionState,dt);if(actionState.remaining===0)document.body.classList.remove('is-striking');updateActions();
  renderer.draw(player,hasKey,now/1000,bob+jumpState.height);
  if(quality==='auto'&&!autoReduced&&seconds>8){if(raw>.045)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>80){renderer.quality='low';autoReduced=true;toast('Dettaglio regolato per una maggiore fluidità.')}}
  if(debug){$('debug').hidden=false;$('debug').textContent='Piano '+level+' · '+Math.round(1/Math.max(raw,.001))+' fps\nx '+player.x.toFixed(2)+' z '+player.z.toFixed(2)+' · chiave '+hasKey+'\n'+canvas.width+' × '+canvas.height}
 }
 raf=requestAnimationFrame(tick);
}
$('test-travel-go').onclick=()=>{if(!run.test)return;const next=Number($('test-floor').value);if(!Number.isInteger(next)||next<1||next>6)return;const slot=run.inventory.indexOf('key:'+level);if(slot>=0)drop(run,world,slot,player);level=next;run.level=next;loadWorld();if(world.arena){player.x=world.showcase.x;player.z=world.showcase.z+2.2;player.yaw=0;player.pitch=0}resume();toast('Viaggio rapido · prova')};
$('start').onclick=resume;
$('new-run').onclick=()=>{if(!confirm('Ricominci da un nuovo labirinto? I progressi di questa esplorazione saranno sostituiti.'))return;seed=crypto.getRandomValues(new Uint32Array(1))[0];level=1;seconds=0;run=newRun(seed,true);selectedSlot=0;loadWorld();resume()};
$('menu-leave').onclick=leave;$('action').onclick=strike;$('close-door').onclick=shutDoor;$('drop-item').onclick=dropSelected;$('leave').onclick=leave;$('portrait-exit').onclick=leave;$('pause').onclick=pause;$('use').onclick=use;$('jump').onclick=tryJump;
$('sound').onclick=()=>{sound.toggle();sound.active(playing&&!portrait());write('labyrinth-sound',sound.enabled);updateSound()};
$('sprint').onclick=()=>{sprinting=!sprinting;$('sprint').setAttribute('aria-pressed',String(sprinting))};
$('guide-toggle').checked=guideEnabled=read('labyrinth-guide',true);$('guide-toggle').onchange=e=>{guideEnabled=e.target.checked;write('labyrinth-guide',guideEnabled);updateActions()};
function voiceURL(){const value=$('voice-link').value.trim();try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='t.me'&&!u.username&&!u.password?u.href:null}catch{return null}}
$('voice-link').value=read('labyrinth-voice-link','');$('voice-link').onchange=()=>{const url=voiceURL();if(url){write('labyrinth-voice-link',url);$('voice-info').textContent='Collegamento salvato.'}else{$('voice-info').textContent='Inserisci un link Telegram https://t.me/…';write('labyrinth-voice-link','')}};
$('voice').onclick=()=>{const url=voiceURL();if(url){if(parent!==window)parent.postMessage({type:'labyrinth:voice',url},location.origin);else window.open(url,'_blank','noopener')}else{$('options').open=true;$('voice-info').textContent='Avvia la chat vocale dal gruppo Telegram, poi torna al gioco. Puoi salvare qui il suo link.';$('voice-link').focus()}};
$('sensitivity').value=String(sensitivity=Math.max(.4,Math.min(2.2,Number(read('labyrinth-sensitivity',1))||1)));
$('sensitivity').oninput=e=>{sensitivity=Number(e.target.value);write('labyrinth-sensitivity',sensitivity)};
$('quality').value=quality=['auto','low','high'].includes(read('labyrinth-quality','auto'))?read('labyrinth-quality','auto'):'auto';
$('quality').onchange=e=>{quality=e.target.value;renderer.quality=quality;autoReduced=false;write('labyrinth-quality',quality);renderer.draw(player,hasKey,performance.now()/1000)};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Schermo intero gestito da Telegram su questo dispositivo.')}};
window.addEventListener('keydown',e=>{if(e.code==='Escape'){if(playing)pause();return}if(!playing||transitioning)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyE','KeyC','KeyQ','KeyF','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyF'&&!e.repeat)strike();if(e.code==='KeyE'&&!e.repeat)use();if(e.code==='KeyC'&&!e.repeat)shutDoor();if(e.code==='KeyQ'&&!e.repeat)dropSelected();if(e.code==='Space'&&!e.repeat)tryJump()}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{resetInput();if(playing&&!transitioning)pause()});
canvas.addEventListener('mousedown',e=>{if(!playing)return;if(e.button===0){dragging=true;strike();pointerLock()}});window.addEventListener('mouseup',()=>dragging=false);
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
canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new Renderer(canvas);renderer.quality=quality;renderer.load(world);syncScene();$('hand-view').style.filter='brightness('+Math.max(.11,world.palette.brightness*.82)+')';renderer.draw(player,hasKey,0);$('fatal').textContent='';$('start').disabled=false;tell('Contesto WebGL ripristinato')}catch(e){$('fatal').textContent=e.message}});
try{renderer=new Renderer(canvas);renderer.quality=quality;loadSaved();updateSound();tell('Motore 3D pronto')}catch(error){$('fatal').textContent=error.message;$('start').disabled=true;$('new-run').hidden=true;$('menu-note').textContent='La grafica 3D richiede WebGL. Puoi tornare a Binottoland e provare da un altro dispositivo.';tell('Avvio non riuscito: '+error.message)}
if(parent!==window)parent.postMessage({type:'labyrinth:ready'},location.origin);
