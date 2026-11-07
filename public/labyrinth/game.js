import {FrameBudget} from './performance.js';
import {applyInsets} from '../safe-area.js';
import {move,free,restoreProgress,beginJump,crossedDoor,forwardVector,CELL,RADIUS} from './core.js';
import {worldFor,newRun,readRun,floorState,itemsAt,pickup,drop,hasPass,capacity,putInHand,openDoor,openShowcase,takeGear,SHOWCASE_GEAR,hasGear,equipment,healthValue,takeDamage,FRAME_DAMAGE,CROUCH_OFFSET,nextWaypoint,advanceBounce,beginAction,advanceAction} from './adventure.js?v=arena2';
import {framePose,struckFrame,frameSupport,settledFrames,triggerFrames} from './traps.js';
import {projectPoint,Renderer} from './render.js?v=arena2';
import {readAppearance} from './avatar.js';
import {avatarSprite} from './visuals.js';
import {Atmosphere} from './audio.js';
import {SPRING_HEIGHT, springAt, resetJump, jumpFromSpring, advanceSpring} from './spring.js?v=arena2';
const $=id=>document.getElementById(id),canvas=$('scene'),keys=new Set(),coarse=matchMedia('(pointer: coarse)').matches,debug=new URLSearchParams(location.search).get('debug')==='1';
let playerId='guest',seed=crypto.getRandomValues(new Uint32Array(1))[0],level=1,world,player,hasKey=false,seconds=0,started=false,playing=false,transitioning=false,renderer,raf=0,lastTime=0,saveClock=0,stepDistance=0,bob=0,walk=0,quality='auto',sensitivity=1,joystick={x:0,y:0,id:null},lookId=null,lastLook=null,lookVector={x:0,y:0},dragging=false,cursorFree=false,releasingCursor=false,toastTimer=0,frameBudget=new FrameBudget();
let tutorialBox=null,trapNotice=null,guarding=false,guardPointer=null,touchCrouch=false,lastTouchAction=-Infinity,healthFlash=0;
const tutorialMode=new URLSearchParams(location.search).get('tutorial')==='1';
let run=newRun(seed,true),guideEnabled=true,guideClock=0;
let multiplayer=null,networkConnected=false,networkBusy=false,requestId=0,poseSeq=0,netClock=0,remoteClock=0,caseSignature='',remoteViews=new Map(),followId='';
let localAppearance=readAppearance(),inventorySignature='';const nameNodes=new Map(),sentPoses=new Map();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
const jumpState={height:0,velocity:0},actionState={remaining:0,cooldown:0};
const sound=new Atmosphere(read('labyrinth-sound',true));
function tell(message){try{if(parent!==window)parent.postMessage({type:'labyrinth:trace',message},location.origin)}catch{}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;toastTimer=setTimeout(()=>$('toast').textContent='',3000)}
function updateSound(){$('sound').setAttribute('aria-pressed',String(sound.enabled));$('sound').setAttribute('aria-label',sound.enabled?'Disattiva audio':'Attiva audio');$('sound').textContent=sound.enabled?'♫':'♪̸'}
function resetInput(){keys.clear();touchCrouch=false;if(player)player.crouch=false;updateCrouchButton();guardPointer=null;setGuard(false);walk=0;joystick={x:0,y:0,id:null};lookId=null;lastLook=null;lookVector={x:0,y:0};$('look-stick').style.transform='';dragging=false;$('stick').style.transform='';actionState.remaining=0;actionState.cooldown=0;}
function store(){if(multiplayer)return;if(!started||!player)return;run.player={x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch};run.seconds=seconds;run.level=level;write('binottoland-labyrinth-v2-'+playerId+(tutorialMode?'-tutorial':''),run)}
const gearIcons={sword:'⚔',shield:'⛨',helmet:'◕',armor:'✦',backpack:'▣'};
function cardInHand(){return [0,1].find(i=>run.inventory[i]==='pass'||run.inventory[i]?.startsWith('key:'))}
function updateInventory(){
 const gear=equipment(run),watch=!!multiplayer?.watch;
 const signature=JSON.stringify([run.inventory,gear,watch,localAppearance]);if(signature===inventorySignature)return;inventorySignature=signature;
 const root=$('inventory');root.replaceChildren();
 const slots=document.createElement('div');slots.className='inventory-slots';
 const bag=document.createElement('div');bag.className='inventory-slots bag-slots';
 const makeSlot=(label,id,slot)=>{
  const node=document.createElement(slot===undefined?'div':'button');node.className='inventory-slot';
  const name=id==='pass'?'Passe-partout':id?.startsWith('key:')?'Keycard':SHOWCASE_GEAR.find(([kind])=>id===kind)?.[1]||'Vuoto';
  node.setAttribute('aria-label',label+' · '+name);node.title=label+' · '+name;
  const caption=document.createElement('small');caption.textContent=label;node.append(caption);
  if(id){
   const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');node.append(icon);
   if(id==='pass'||id.startsWith('key:')){
    icon.className='card-icon';icon.style.setProperty('--stripe',id==='pass'?'#16181b':worldFor(seed,Number(id.split(':')[1])).palette.stripe);
   }else icon.textContent=gearIcons[id];
  }
  if(slot!==undefined){
   node.dataset.hand=String(slot<2);node.disabled=watch||!id;
   node.onclick=()=>{
    if(!playing||transitioning||inStands())return;
    if(multiplayer)sendAction('equip',{slot,item:id});
    else if(putInHand(run,slot)){syncScene();updateInventory();updateActions();store()}
    else toast('Serve uno spazio libero nelle tasche o nello zaino.');
   };
  }
  return node;
 };
 const labels=['Mano D','Mano S','Tasca 1','Tasca 2'];
 for(let i=0;i<capacity(run);i++){
  const target=i<4?slots:bag;target.append(makeSlot(labels[i]||'Zaino '+(i-3),run.inventory[i],i));
 }
 root.append(slots);if(gear.backpack)root.append(bag);
 const worn=document.createElement('div');worn.className='worn-gear';
 for(const [id,label] of [['helmet','Testa'],['armor','Corazza'],['backpack','Zaino']])if(gear[id])worn.append(makeSlot(label,id));
 if(gear.armor){
  const portrait=avatarSprite(localAppearance,gear.backpack,0,null,gear);
  portrait.className='mini-avatar';portrait.setAttribute('role','img');portrait.setAttribute('aria-label','Il tuo personaggio con l’equipaggiamento indossato');
  worn.prepend(portrait);
 }
 if(worn.childElementCount)root.append(worn);
 window.dispatchEvent(new CustomEvent('labyrinth:equipment',{detail:{backpack:gear.backpack}}));
 $('drop-item').hidden=watch||cardInHand()===undefined;
}
const inStands=()=>!!(run.standsUntil||run.eliminated);
const cameraHeight=()=>jumpState.height-(player?.crouch?CROUCH_OFFSET:0);
function updateCrouchButton(){
 $('crouch').setAttribute('aria-pressed',String(!!player?.crouch));
}
function updateStands(){
 const active=inStands(),label=$('stands');
 if(label.hidden===active){label.hidden=!active;document.body.classList.toggle('in-stands',active)}
 if(active)textIfChanged('stands',run.eliminated?'Tribuna · Eliminato':'Tribuna · Rientro tra '+Math.max(0,Math.ceil((run.standsUntil-sceneTime())/1000))+' s');
}
function updateHealth(value=run.health){
 const health=healthValue(value),display=inStands()||performance.now()<healthFlash?0:health;
 $('health').hidden=!!multiplayer?.watch;
 const meter=$('health-meter');meter.value=display;meter.style.setProperty('--life-hue',String(Math.round(display*1.2)));
 textIfChanged('health-value',display+'%');
}
function showImpact(impact,received){
 const {kind,damage,fatal,guarded}=impact;
 sound.impact?.(kind,impact.shielded,received?1:.7);
 if(!received)return;
 if(fatal)healthFlash=performance.now()+480;
 if(damage||fatal){
  const flash=$('damage-flash');flash.classList.remove('hit');
  if(!reduced){void flash.offsetWidth;flash.classList.add('hit')}
 }
 toast(fatal?(inStands()?'Sei caduto. Ora sei sugli spalti.':'Sei caduto. Riparti dall’inizio del piano.'):damage===0?'Pugno parato':(kind==='frame'?'Quadro caduto':guarded?'Colpo parato':'Colpo subito')+' · −'+damage+'% vita');
 updateHealth();
}
function syncScene(){hasKey=run.inventory.includes('key:'+level);renderer.scene={appearance:inStands()?null:localAppearance,stillCrowd:reduced,spring:jumpState.contact?SPRING_HEIGHT-jumpState.height:0,items:itemsAt(run,world),showcaseOpen:run.showcaseOpen,...equipment(run),guard:guarding,swing:actionState.remaining,doorOpen:floorState(run,world).open,traps:floorState(run,world).traps};if(multiplayer){if(multiplayer.watch)renderer.scene.appearance=null;renderer.scene.serverNow=Date.now()+(multiplayer.clockOffset||0);renderer.scene.cases=multiplayer.state.cases;renderer.scene.players=[...remoteViews.values()].filter(p=>p.level===level&&!p.standsUntil&&!p.eliminated&&(!multiplayer.watch||p.id!==followId));}}
function loadWorld(saved=null,back=false){
 trapNotice=null;resetJump(jumpState,saved?.player?.height||0);world=worldFor(seed,level);sound.setArena?.(!!world.arena);configureNetworkWorld();const floor=floorState(run,world);player=saved?.player?{...saved.player}:{...world.spawn,pitch:0};
 if(!multiplayer)jumpState.height=frameSupport(settledFrames(world,floor,sceneTime()),player.x,player.z,RADIUS);
 if(back){player.x=world.door.x-world.door.dx*1.25;player.z=world.door.z-world.door.dz*1.25;player.yaw=Math.atan2(-world.door.dx,world.door.dz)}
 renderer.load(world);syncScene();$('floor').textContent=world.arena?'COLOSSEO':'PIANO '+String(level).padStart(2,'0')+' · '+world.palette.name.toUpperCase();textIfChanged('objective',world.arena?(run.showcaseOpen?'Raccogli il tuo equipaggiamento':'Esplora oppure apri la vetrina'):'Trova la keycard · raggiungi l’uscita');renderer.draw(player,hasKey,0,cameraHeight());saveClock=0;bob=0;stepDistance=0;guideClock=1;updateInventory();updateHealth();updateActions();$('test-travel').hidden=multiplayer?!multiplayer.watch:!run.test;
}
function loadSaved(){
 let saved=readRun(read('binottoland-labyrinth-v2-'+playerId+(tutorialMode?'-tutorial':''),null));
 if(!saved&&!tutorialMode){const old=restoreProgress(read('binottoland-labyrinth-'+playerId,null));if(old){saved=newRun(old.seed,true);saved.level=Math.min(5,old.level);saved.seconds=old.seconds;if(saved.level===old.level)saved.player=old.player}}
 run=saved||newRun(seed,true);run.test=true;seed=run.seed;level=run.level;seconds=run.seconds;loadWorld(saved);$('start').textContent=saved?'Continua · '+(level===6?'Arena':'Piano '+level):'Entra nel labirinto';$('new-run').hidden=!saved;$('saved-info').textContent=run.test?'Prova · selezione dei livelli disponibile':'';return !!saved;
}
function portrait(){return document.body.classList.contains('touch')&&innerHeight>innerWidth}
function updateOrientation(){const blocked=playing&&portrait();if(blocked)setGuard(false);$('portrait').hidden=!blocked;sound.active(playing&&!blocked);if(!playing)renderer?.draw(player,hasKey,performance.now()/1000,cameraHeight())}
function look(dx,dy,touch=false){if(!playing||transitioning||portrait())return;const scale=(touch ? .0045 : .0021)*sensitivity;player.yaw+=dx*scale;player.yaw=((player.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.pitch=Math.max(-1.15,Math.min(1.15,player.pitch-dy*scale))}
function pointerLock(){if(cursorFree||coarse||document.body.classList.contains('touch'))return;try{const result=canvas.requestPointerLock?.();result?.catch(()=>toast('Trascina sullo schermo per guardarti intorno.'))}catch{toast('Trascina sullo schermo per guardarti intorno.')}}
function toggleCursor(){
 if(releasingCursor||coarse||document.body.classList.contains('touch'))return;
 cursorFree=!cursorFree;dragging=false;setGuard(false);
 if(cursorFree){
  if(document.pointerLockElement===canvas){releasingCursor=true;document.exitPointerLock?.()}
  toast('Cursore libero · premi M per riprendere la visuale');
 }else{
  canvas.focus({preventScroll:true});
  pointerLock();
 }
}
function resume(){if(!renderer||transitioning)return;$('new-run-confirm').hidden=true;if(multiplayer&&!networkConnected){toast('Collegamento alla spedizione…');return}localAppearance=readAppearance();updateInventory();if(multiplayer&&!multiplayer.watch)sendAction('appearance',{appearance:localAppearance},true);started=true;playing=true;syncScene();$('menu').hidden=true;$('fatal').textContent='';document.body.classList.add('playing');$('menu-title').textContent='Labyrinth';resetInput();sound.resume();updateOrientation();canvas.focus({preventScroll:true});pointerLock();lastTime=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);store();tell('Piano '+level+' · esplorazione avviata')}
function pause(){if(!started||transitioning)return;playing=false;if(tutorialBox)tutorialBox.hidden=true;cancelAnimationFrame(raf);raf=0;resetInput();sound.active(false);if(document.pointerLockElement)document.exitPointerLock?.();document.body.classList.remove('playing');$('portrait').hidden=true;$('menu').hidden=false;$('menu-title').textContent='Una pausa.';$('start').textContent='Riprendi l’esplorazione';$('new-run').hidden=!!multiplayer;$('saved-info').textContent=(world.arena?'Arena':'Piano '+level)+(hasPass(run)?' · passe-partout':'');store()}
function leave(){setGuard(false);store();sound.active(false);if(parent!==window)parent.postMessage({type:'labyrinth:exit'},location.origin);else location.href='/'}
function tryJump(){
 if(!playing||transitioning||portrait()||inStands()||player.crouch||touchCrouch||keys.has('ControlLeft')||keys.has('ControlRight')||(multiplayer&&!networkConnected))return;
 if(springAt(world,player)&&jumpFromSpring(jumpState)){sound.jump?.();return}
 const floor=frameSupport(settledFrames(world,floorState(run,world),sceneTime()),player.x,player.z,RADIUS);
 if(floor>0&&Math.abs(jumpState.height-floor)<.002&&jumpState.velocity<=0){jumpState.velocity=4.1;sound.jump?.();}
 else if(beginJump(jumpState))sound.jump?.();
}
function sceneTime(){return Date.now()+(multiplayer?.clockOffset||0)}
function updateTraps(floor,now){
 for(const frame of world.frames||[]){
  const started=floor.traps?.[frame.id];
  if(started===undefined||started===trapNotice||!nearby(frame,3.8)||framePose(started,now).phase!=='warning')continue;
  trapNotice=started;sound.swish?.();toast('La cornice si stacca! Fai un passo indietro.');
 }
}
function nearby(a,d=1.8){return Math.hypot(player.x-a.x,player.z-a.z)<d}
function aimedAt(item){const dx=item.x-player.x,dz=item.z-player.z,d=Math.hypot(dx,dz);return d<.38||(player.pitch<-.35&&(dx*Math.sin(player.yaw)-dz*Math.cos(player.yaw))/Math.max(.001,d)>.72)}
function facing(item){const dx=item.x-player.x,dz=item.z-player.z;return (dx*Math.sin(player.yaw)-dz*Math.cos(player.yaw))/Math.max(.001,Math.hypot(dx,dz))>.65}
function setGuard(active){
 if(active&&(!playing||transitioning||portrait()||inStands()||multiplayer&&(!networkConnected||multiplayer.watch||multiplayer.state.archived||multiplayer.state.arenaResult)))return;
 if(guarding===active)return;
 guarding=active;
 $('guard').setAttribute('aria-pressed',String(active));
 document.body.classList.toggle('guarding',active);
 if(active){sound.guard?.(equipment(run).shield)}
 sendPose();
}
function strike(){
 if(!playing||transitioning||portrait()||inStands()||multiplayer&&(!networkConnected||multiplayer.watch||multiplayer.state.archived||multiplayer.state.arenaResult))return;
 if(beginAction(actionState)){
  sound.swish?.(equipment(run).weapon||'fist');
  if(multiplayer)sendAction('strike',{},true);
 }
}
function target(){
 if(inStands())return null;
 if(multiplayer&&(multiplayer.watch||!networkConnected||multiplayer.state.archived))return null;
 for(const item of itemsAt(run,world))if(nearby(item,item.type==='pass'?.95:1.25)&&aimedAt(item))return {kind:'card',item,label:item.type==='pass'?'Prendi passe-partout':'Prendi keycard'};
 if(world.arena){if(nearby(world.showcase,2.5)&&facing(world.showcase)){if(!run.showcaseOpen)return multiplayer&&multiplayer.state.players.filter(p=>p.counted).length>1?{kind:'waiting',label:'In attesa degli altri'}:{kind:'showcase',label:'Apri vetrina'};const gear=SHOWCASE_GEAR.find(([id])=>!hasGear(run,id));if(gear)return {kind:gear[0],label:'Prendi '+gear[1].toLowerCase()}}if(nearby(world.door))return {kind:hasPass(run)?'back':'no-back',label:hasPass(run)?'Torna al piano nero':'Per tornare serve il passe-partout'};return null}
 if(nearby(world.door)&&!floorState(run,world).open)return {kind:'door',label:hasPass(run)?'Apri col passe-partout':'Apri porta'};
 if(level>1&&nearby(world.spawn,1))return {kind:hasPass(run)?'back':'no-back',label:hasPass(run)?'Torna al piano precedente':'Per tornare serve il passe-partout'};
 return null;
}
function textIfChanged(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value}
function updateActions(){if(!world||!player)return;const open=!world.arena&&floorState(run,world).open;updateTutorial();textIfChanged('objective',world.arena?(SHOWCASE_GEAR.every(([id])=>hasGear(run,id))?'Equipaggiamento pronto':run.showcaseOpen?'Raccogli il tuo equipaggiamento':'Esplora oppure apri la vetrina'):open?'Uscita aperta · attraversa la porta':hasPass(run)?'Passe-partout · segui l’uscita':hasKey?'Keycard raccolta · cerca l’uscita':'Trova la keycard · raggiungi l’uscita');const holder=multiplayer?.state.players.find(p=>p.id!==playerId&&p.inventory.includes('key:'+level));if(!world.arena&&!hasKey&&!hasPass(run)&&!open&&holder)textIfChanged('objective','Keycard raccolta da '+holder.name);const t=guarding?null:target(),touch=document.body.classList.contains('touch');$('action').disabled=!!multiplayer&&(multiplayer.watch||!networkConnected||multiplayer.state.archived||!t&&multiplayer.state.arenaResult);$('action').textContent=t?(t.kind==='waiting'?'Attendi':'Usa'):'Colpisci';$('action').setAttribute('aria-label',t?t.label:'Colpisci');textIfChanged('hint',t?(touch?'Usa · ':'E · ')+t.label:open&&nearby(world.door,2.2)?'Attraversa la porta':'');
 if(!world.arena&&guideEnabled){$('guide').hidden=false;guideClock++;if(guideClock>8){guideClock=0;const destination=tutorialMode&&!hasKey&&!hasPass(run)&&!open?itemsAt(run,world).find(i=>i.type==='key')||world.door:world.door;const q=nextWaypoint(world,player,destination);if(q){const angle=Math.atan2(q.x-player.x,-(q.z-player.z))-player.yaw;$('guide-arrow').style.transform='rotate('+angle+'rad)';$('guide-text').textContent=(tutorialMode&&!hasKey&&!hasPass(run)&&!open?'Keycard':'Uscita')+' · percorso '+Math.max(1,Math.round(q.steps*CELL))+' m'}}}else $('guide').hidden=true;
}
function crossLevel(){
 setGuard(false);level++;run.level=level;run.player=null;
 sound.chime();loadWorld();store();
 toast(level===6?'Sei fuori. La vetrina ti aspetta.':'Piano '+level+' · '+world.palette.name);
 tell('Passaggio a '+(level===6?'Arena':'piano '+level));
}
function resetAtEntrance(){
 Object.assign(player,world.spawn,{pitch:0,height:0});
 resetJump(jumpState);bob=0;stepDistance=0;
 setGuard(false);
}
function changeLevel(next,back=false){
 const cardSlot=run.inventory.indexOf('key:'+level);if(cardSlot>=0)drop(run,world,cardSlot,player);
 transitioning=true;resetInput();sound.chime();$('transition-label').textContent=next===6?'ARIA APERTA':'PIANO '+String(next).padStart(2,'0');$('transition').hidden=false;if(document.pointerLockElement)document.exitPointerLock?.();
 setTimeout(()=>{level=next;run.level=level;run.player=null;loadWorld(null,back);store();tell('Passaggio a '+(level===6?'Arena':'piano '+level));$('transition').hidden=true;transitioning=false;if(document.hidden)pause();else{updateOrientation();toast(level===6?'Sei fuori. La vetrina ti aspetta.':'Piano '+level+' · '+world.palette.name)}},500);
}
function use(){
 if(multiplayer){networkUse();return}
 if(!playing||transitioning||portrait())return;const t=target();if(!t)return;
 if(t.kind==='card'){const result=pickup(run,world,t.item.id);if(result==='full')toast('Inventario pieno. Porta una carta in mano e lasciala a terra.');else if(result==='ok'){sound.chime();toast(t.item.type==='pass'?'Passe-partout raccolto. Apre tutte le porte dei piani e si può riusare.':'Keycard raccolta.');tell(t.label)}}
 else if(t.kind==='door'){if(openDoor(run,world)){sound.chime();toast('Porta aperta. Attraversala per proseguire.')}else toast('Serve la keycard del piano o il passe-partout.')}
 else if(t.kind==='back'){changeLevel(level-1,true);return}
 else if(t.kind==='no-back')toast('Puoi tornare indietro solo con il passe-partout.');
 else if(t.kind==='showcase')openCase();
 else if(takeGear(run,t.kind)){sound.chime();toast(t.kind==='backpack'?'Zaino raccolto · quattro spazi aggiunti.':t.label.replace('Prendi ','')+' · equipaggiamento aggiornato.')}
 else toast('Inventario pieno. Libera uno spazio per raccogliere l’oggetto.');
 syncScene();updateInventory();updateActions();store();
}
function openCase(){if(!playing||transitioning||!world.arena||!nearby(world.showcase,2.5)||!facing(world.showcase))return;if(openShowcase(run)){sound.chime();toast('Vetrina aperta. Raccogli il tuo equipaggiamento.');$('objective').textContent='Raccogli il tuo equipaggiamento';tell('Arena · vetrina aperta');syncScene();updateActions();store()}}
function dropHeld(){
 if(!playing||transitioning||inStands())return;
 const slot=cardInHand();if(slot===undefined)return;
 if(multiplayer){sendAction('drop',{slot});return}
 if(drop(run,world,slot,player)){toast('Carta lasciata a terra. Guarda ai tuoi piedi per riprenderla.');syncScene();updateInventory();updateActions();store()}
}
function tick(now){
 if(!playing)return;const raw=(now-lastTime)/1000,dt=Math.min(.1,Math.max(0,raw));lastTime=now;
 if(!transitioning&&!portrait()){
  if(lookId!==null)look(lookVector.x*420*dt,lookVector.y*420*dt,true);
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-joystick.y;
  let strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
  const magnitude=Math.hypot(forward,strafe);if(magnitude>1){forward/=magnitude;strafe/=magnitude}
  const fast=keys.has('ShiftLeft')||keys.has('ShiftRight')||Math.hypot(joystick.x,joystick.y)>.94;
  const nowMs=sceneTime(),floor=floorState(run,world);
  if(!multiplayer)triggerFrames(world,floor,player,nowMs);
  updateTraps(floor,nowMs);
  updateStands();
  const canWalk=!inStands()&&(!multiplayer||networkConnected&&(!multiplayer.watch||!followId));
  if(canWalk){
   const crouchInput=touchCrouch||keys.has('ControlLeft')||keys.has('ControlRight');
   const support=springAt(world,player)?SPRING_HEIGHT:0;
   const crouch=jumpState.height<support+.06&&jumpState.velocity===0&&!jumpState.contact&&crouchInput;
   if(crouch!==!!player.crouch){player.crouch=crouch;updateCrouchButton()}
   const speed=(crouch?1.2:fast?3.65:2.15)*dt,previous={x:player.x,z:player.z,height:jumpState.height};
   const frames=settledFrames(world,floor,nowMs);
   const people=multiplayer&&!multiplayer.watch?multiplayer.state.players.filter(p=>p.id!==playerId&&p.online&&!p.standsUntil&&!p.eliminated&&p.level===level).map(p=>p.player):[];
   if(!world.arena)advanceBounce(jumpState,dt);
   const surface=frameSupport(frames,player.x,player.z,RADIUS);
   if(surface>0&&previous.height>=surface-.002&&jumpState.height<surface){jumpState.height=surface;jumpState.velocity=0}
   const facing=forwardVector(player.yaw);
   move(world,player,(facing.x*forward-facing.z*strafe)*speed,(facing.z*forward+facing.x*strafe)*speed,{doorOpen:floor.open,people,frames,height:jumpState.height});
   const walked=Math.hypot(player.x-previous.x,player.z-previous.z);stepDistance+=walked;walk+=(walked&&!reduced?Math.sin(seconds*(fast?14:10))*.085-walk:-walk)*Math.min(1,dt*14);bob=walked&&!reduced?Math.sin(seconds*(fast?15:10))*.018:0;
   const frame=!multiplayer&&struckFrame(world,floor,previous,{...player,height:jumpState.height},nowMs-dt*1000,nowMs,RADIUS,run.frameHits);
   let impact;
   if(frame){
    (run.frameHits??=[]).push(frame);
    impact=takeDamage(run,'frame',FRAME_DAMAGE,nowMs);
    if(impact?.fatal)resetAtEntrance();
    if(impact)showImpact(impact,true);
    store();
   }
   if(!impact?.fatal&&floor.open&&crossedDoor(world,previous,player)){
    if(multiplayer){netClock=0;sendPose()}else crossLevel();
   }
   const springEvent=world.arena?advanceSpring(jumpState,dt,springAt(world,player),player,crouchInput):null;
   if(springEvent==='bounce'){sound.jump?.(true);stepDistance=0}
   if(springEvent==='land'||previous.height>jumpState.height+.015&&jumpState.velocity===0&&!jumpState.contact&&!impact?.fatal){sound.land?.();stepDistance=0}
   if(stepDistance>(fast?.94:.72)&&jumpState.velocity===0&&!jumpState.contact){sound.step(fast&&!player.crouch,player.crouch);stepDistance=0}
  }
  seconds+=dt;saveClock+=dt;if(saveClock>5){store();saveClock=0}
  advanceAction(actionState,dt);updateActions();
  networkTick(dt);renderer.scene.guard=guarding;if(healthFlash&&now>=healthFlash){healthFlash=0;updateHealth()}renderer.scene.swing=actionState.remaining;renderer.scene.walk=walk;renderer.scene.spring=jumpState.contact?SPRING_HEIGHT-jumpState.height:0;renderer.draw(player,hasKey,now/1000,bob+cameraHeight());renderRemoteNames();
  if(quality==='auto'&&seconds>5)renderer.resolutionScale=frameBudget.sample(raw);
  if(debug){$('debug').hidden=false;$('debug').textContent='Piano '+level+' · '+Math.round(1/Math.max(raw,.001))+' fps\nx '+player.x.toFixed(2)+' z '+player.z.toFixed(2)+' · chiave '+hasKey+'\n'+canvas.width+' × '+canvas.height}
 }
 raf=requestAnimationFrame(tick);
}
$('follow-player').onchange=e=>{followId=e.target.value;if(multiplayer)receiveState(multiplayer.state,true)};
$('test-travel-go').onclick=()=>{if(multiplayer?.watch)followId='';if(multiplayer&&!multiplayer.watch)return;if(!run.test&&!multiplayer?.watch)return;const next=Number($('test-floor').value);if(!Number.isInteger(next)||next<1||next>6)return;const slot=run.inventory.indexOf('key:'+level);if(slot>=0)drop(run,world,slot,player);level=next;run.level=next;loadWorld();if(world.arena){player.x=world.showcase.x;player.z=world.showcase.z+2.2;player.yaw=0;player.pitch=0}resume();toast('Viaggio rapido · prova')};
$('start').onclick=resume;
$('new-run').onclick=()=>{
 if(multiplayer||!renderer||transitioning)return;
 $('new-run-confirm').hidden=false;$('new-run-start').focus({preventScroll:true});
};
$('new-run-cancel').onclick=()=>{$('new-run-confirm').hidden=true;$('new-run').focus({preventScroll:true})};
$('new-run-start').onclick=()=>{
 if(multiplayer||!renderer||transitioning)return;
 seed=crypto.getRandomValues(new Uint32Array(1))[0];level=1;seconds=0;healthFlash=0;run=newRun(seed,true);
 loadWorld();resume();
};
const actionButton=$('action');
function pressAction(){if(guarding||!target())strike();else use()}
actionButton.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'||actionButton.disabled)return;
 e.preventDefault();lastTouchAction=performance.now();pressAction();
});
actionButton.onclick=e=>{
 if(e.pointerType==='touch'||e.detail>0&&performance.now()-lastTouchAction<700)return;
 pressAction();
};
$('menu-leave').onclick=leave;
$('archive-arena').onclick=()=>parent.postMessage({type:'labyrinth:archive'},location.origin);$('drop-item').onclick=dropHeld;$('leave').onclick=leave;$('portrait-exit').onclick=leave;$('pause').onclick=pause;$('jump').onclick=tryJump;
$('sound').onclick=()=>{sound.toggle();sound.active(playing&&!portrait());write('labyrinth-sound',sound.enabled);updateSound()};
$('guide-toggle').checked=guideEnabled=read('labyrinth-guide',true);$('guide-toggle').onchange=e=>{guideEnabled=e.target.checked;write('labyrinth-guide',guideEnabled);updateActions()};
$('sensitivity').value=String(sensitivity=Math.max(.4,Math.min(2.2,Number(read('labyrinth-sensitivity',1))||1)));
$('sensitivity').oninput=e=>{sensitivity=Number(e.target.value);write('labyrinth-sensitivity',sensitivity)};
$('quality').value=quality=['auto','low','high'].includes(read('labyrinth-quality','auto'))?read('labyrinth-quality','auto'):'auto';
$('quality').onchange=e=>{quality=e.target.value;renderer.quality=quality;frameBudget.reset();renderer.resolutionScale=1;write('labyrinth-quality',quality);renderer.draw(player,hasKey,performance.now()/1000,cameraHeight())};
window.addEventListener('keydown',e=>{if(e.code==='Escape'){if(playing)pause();return}if(!playing||transitioning)return;if(e.code==='KeyM'&&!coarse&&!document.body.classList.contains('touch')){e.preventDefault();if(!e.repeat)toggleCursor();return}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyE','KeyQ','KeyF','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyF'&&!e.repeat)strike();if(e.code==='KeyE'&&!e.repeat)use();if(e.code==='KeyQ'&&!e.repeat)dropHeld();if(e.code==='Space'&&!e.repeat)tryJump()}});
window.addEventListener('keyup',e=>keys.delete(e.code));
$('crouch').onclick=()=>{if(playing&&!transitioning&&!portrait()&&!inStands())touchCrouch=!touchCrouch};
window.addEventListener('blur',()=>{resetInput();if(playing&&!transitioning)pause()});
canvas.addEventListener('mousedown',e=>{
 if(!playing||cursorFree)return;
 if(e.button===2){e.preventDefault();setGuard(true);return}
 if(e.button===0){dragging=true;strike();pointerLock()}
});
window.addEventListener('mouseup',e=>{if(e.button===0)dragging=false;if(e.button===2)setGuard(false)});
const guardButton=$('guard');
guardButton.addEventListener('pointerdown',e=>{
 if(guardPointer!==null)return;
 e.preventDefault();setGuard(true);
 if(guarding){guardPointer=e.pointerId;guardButton.setPointerCapture?.(e.pointerId)}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])guardButton.addEventListener(event,e=>{
 if(e.pointerId===guardPointer){guardPointer=null;setGuard(false)}
});
window.addEventListener('mousemove',e=>{if(!cursorFree&&(document.pointerLockElement===canvas||dragging))look(e.movementX,e.movementY)});
document.addEventListener('pointerlockchange',()=>{
 if(cursorFree){
  if(document.pointerLockElement===canvas){releasingCursor=true;document.exitPointerLock?.()}
  else releasingCursor=false;
  return;
 }
 if(!document.pointerLockElement&&playing&&!transitioning&&!dragging)pause();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const joyElement=$('joystick');
function moveStick(e){const r=joyElement.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.hypot(dx,dy),max=r.width*.34,scale=len>max?max/len:1;joystickState(dx*scale/max,dy*scale/max,e.pointerId);$('stick').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)'}
function joystickState(x,y,id){joystick.x=x;joystick.y=y;joystick.id=id}
joyElement.addEventListener('pointerdown',e=>{if(!playing||portrait()||joystick.id!==null)return;e.preventDefault();joyElement.setPointerCapture(e.pointerId);moveStick(e)});
joyElement.addEventListener('pointermove',e=>{if(joystick.id===e.pointerId)moveStick(e)});
function endStick(e){if(e.pointerId===joystick.id){joystick={x:0,y:0,id:null};$('stick').style.transform=''}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])joyElement.addEventListener(event,endStick);
const lookZone=$('look-pad');
function moveLookStick(e){const r=lookZone.getBoundingClientRect(),max=r.width*.34,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.hypot(dx,dy),scale=len>max?max/len:1;lookVector={x:dx*scale/max,y:dy*scale/max};$('look-stick').style.transform='translate('+dx*scale+'px,'+dy*scale+'px)'}
lookZone.addEventListener('pointerdown',e=>{if(!playing||portrait()||lookId!==null)return;e.preventDefault();lookId=e.pointerId;lookZone.setPointerCapture(e.pointerId);moveLookStick(e)});
lookZone.addEventListener('pointermove',e=>{if(lookId===e.pointerId)moveLookStick(e)});
for(const event of ['pointerup','pointercancel','lostpointercapture'])lookZone.addEventListener(event,e=>{if(lookId===e.pointerId){lookId=null;lookVector={x:0,y:0};$('look-stick').style.transform=''}});
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!document.body.classList.contains('touch')){document.body.classList.add('touch');updateOrientation()}},{capture:true});
if(coarse)document.body.classList.add('touch');
window.addEventListener('resize',updateOrientation);
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();store();sound.active(false);if(playing&&!transitioning)pause()}});
window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='labyrinth:identity'||started)return;const id=String(event.data.player||'');if(!/^\d{1,20}$/.test(id)||id===playerId)return;playerId=id;if(renderer)loadSaved()});
window.addEventListener('pagehide',()=>{setGuard(false);store();playing=false;cancelAnimationFrame(raf);clearTimeout(toastTimer);sound.destroy();renderer?.destroy()});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(playing)pause();renderer?.destroy();renderer=null;$('start').disabled=true;$('fatal').textContent='La grafica è stata sospesa dal dispositivo. Attendi il ripristino oppure riapri Labyrinth.';tell('Contesto WebGL sospeso')});
canvas.addEventListener('webglcontextrestored',()=>{try{renderer=new Renderer(canvas);renderer.quality=quality;renderer.load(world);syncScene();renderer.draw(player,hasKey,0,cameraHeight());$('fatal').textContent='';$('start').disabled=false;tell('Contesto WebGL ripristinato')}catch(e){$('fatal').textContent=e.message}});
try{renderer=new Renderer(canvas);renderer.quality=quality;loadSaved();updateSound();tell('Motore 3D pronto')}catch(error){$('fatal').textContent=error.message;$('start').disabled=true;$('new-run').hidden=true;$('menu-note').textContent='La grafica 3D richiede WebGL. Puoi tornare a Binottoland e provare da un altro dispositivo.';tell('Avvio non riuscito: '+error.message)}
if(parent!==window)parent.postMessage({type:'labyrinth:ready'},location.origin);

function netSend(packet){if(parent!==window)parent.postMessage({type:'labyrinth:net',packet},location.origin)}
function sendPose(){if(!multiplayer||multiplayer.watch||!networkConnected||!player||multiplayer.state.archived)return;const warp=multiplayer.state.players.find(p=>p.id===playerId)?.warp||0;
 sentPoses.set(++poseSeq,{x:player.x,z:player.z,level,warp});
 if(sentPoses.size>32)sentPoses.delete(sentPoses.keys().next().value);
 netSend({type:'pose',seq:poseSeq,level,warp,x:player.x,z:player.z,yaw:player.yaw,pitch:player.pitch,height:jumpState.height,guard:guarding,crouch:!!player.crouch})}
function sendAction(kind,extra={},quiet=false){if(!networkConnected||multiplayer?.watch||multiplayer?.state.archived||inStands()&&kind!=='appearance'){if(!quiet)toast('Attendi il collegamento o accedi come giocatore.');return}if(networkBusy&&!quiet)return;sendPose();const id=++requestId;netSend({type:'action',kind,request:id,...extra});if(!quiet){networkBusy=id;setTimeout(()=>{if(networkBusy===id){networkBusy=false;toast('Conferma non ricevuta. Attendi la riconnessione.')}},8000)}}
function networkUse(){if(!playing||transitioning||portrait()||networkBusy)return;const t=target();if(!t)return;if(t.kind==='card')sendAction('pickup',{item:t.item.id});else if(['door','back','showcase',...SHOWCASE_GEAR.map(([id])=>id)].includes(t.kind))sendAction(t.kind==='door'?'open':t.kind);else toast(t.kind==='waiting'?'Le vetrine si apriranno quando saranno arrivati tutti.':'Serve il passe-partout per tornare indietro.')}
function configureNetworkWorld(){if(!multiplayer||!world.arena)return;const cases=multiplayer.state.cases||[],own=cases.find(c=>c.id===playerId);world.cases=cases;world.obstacles=world.obstacles.filter(b=>b.type);world.obstacles.push(...cases.map(c=>({...c,halfWidth:1.08,halfDepth:.5})));if(own)world.showcase={x:own.x,z:own.z};}
function receiveState(s,correct=false){
 if(!multiplayer||!s||s.room!==multiplayer.room)return;if(s.deleted){leave();return}const previous=multiplayer.state;if(s.revision<previous.revision)return;multiplayer.state=s;const me=s.players.find(p=>p.id===playerId),oldLevel=level;
 seed=s.seed;if(multiplayer.watch&&followId&&!s.players.some(p=>p.id===followId&&p.online))followId=s.players.find(p=>p.online)?.id||'';const followed=multiplayer.watch?s.players.find(p=>p.id===followId):null;if(!multiplayer.watch&&me)level=me.level;else if(followed)level=followed.level;
 const own=multiplayer.watch?null:me,priorOwn=previous.players.find(p=>p.id===playerId);const warped=own&&(own.warp||0)!==(priorOwn?.warp||0);
 run={...own,version:2,seed,level,seconds,inventory:own?[...own.inventory]:[],floors:s.floors,showcaseOpen:s.showcaseOpen,test:false};
 if(s.archived||s.arenaResult)setGuard(false);
 const result=$('arena-result');result.hidden=!s.arenaResult;
 $('archive-arena').hidden=!s.arenaResult||s.archived||multiplayer.watch||!me;
 if(s.arenaResult){const winner=s.arenaResult.winner;textIfChanged('arena-result',!winner?'Arena conclusa · Nessun superstite':!multiplayer.watch&&winner.id===playerId?'Hai vinto l’arena!':'Vince '+winner.name);if(!previous.arenaResult&&winner)sound.chime();}
 const signature=JSON.stringify((s.cases||[]).map(c=>[c.id,c.x,c.z]));const changedWorld=!world||world.seed!==seed||world.level!==level||oldLevel!==level;
 if(changedWorld){sentPoses.clear();loadWorld(own?{player:{...own.player}}:followed?{player:{...followed.player}}:null);transitioning=false;toast(level===6?'Arena · '+s.players.filter(p=>p.counted&&p.level===6).length+' arrivati':'Piano '+level)}
 else if(warped){
  sentPoses.clear();Object.assign(player,own.player);resetJump(jumpState,own.player.height||0);bob=0;stepDistance=0;
  resetInput();if(!own.standsUntil&&priorOwn?.standsUntil){healthFlash=0;toast('Sei di nuovo nell’arena.')}
 }
 else if(own&&(correct===true||sentPoses.has(correct)||Math.hypot(player.x-own.player.x,player.z-own.player.z)>1.8)){
  const sample=sentPoses.get(correct),dx=player.x-(sample?.x??player.x),dz=player.z-(sample?.z??player.z);
  player.x=own.player.x;player.z=own.player.z;
  if(!inStands()&&sample?.level===level&&sample.warp===(own.warp||0)){
   const floor=floorState(run,world),now=sceneTime();
   move(world,player,dx,dz,{doorOpen:floor.open,people:s.players.filter(p=>p.id!==playerId&&p.online&&!p.standsUntil&&!p.eliminated&&p.level===level).map(p=>p.player),frames:settledFrames(world,floor,now),height:jumpState.height});
  }
 }
 for(const seq of sentPoses.keys())if(seq<=(me?.seq||0))sentPoses.delete(seq);
 if(world.arena){configureNetworkWorld();if(own&&!inStands()&&!free(world,player.x,player.z)){player.x=own.player.x;player.z=own.player.z}if(signature!==caseSignature){renderer.load(world);caseSignature=signature}}
 for(const p of s.players){if(p.id===playerId&&!multiplayer.watch)continue;if(!p.online){remoteViews.delete(p.id);continue}const prior=remoteViews.get(p.id);if(!prior||prior.level!==p.level||prior.warp!==p.warp)remoteViews.set(p.id,{...p,player:{...p.player},target:{...p.player}});else{prior.target={...p.player};prior.appearance=p.appearance;Object.assign(prior,equipment(p),{guard:p.guard,actionAt:p.actionAt,standsUntil:p.standsUntil,eliminated:p.eliminated})}}
 for(const id of remoteViews.keys())if(!s.players.some(p=>p.id===id&&p.online))remoteViews.delete(id);
 poseSeq=Math.max(poseSeq,me?.seq||0);syncScene();updateInventory();updateHealth();updateStands();updateActions();$('new-run').hidden=true;
 if(playing&&own)for(const p of s.players){
  if(!p.impact||p.impact.number===previous.players.find(before=>before.id===p.id)?.impact?.number)continue;
  if(p.id===playerId||p.impact.attacker===playerId)showImpact(p.impact,p.id===playerId);
 }
 $('test-travel').hidden=!multiplayer.watch;$('follow-control').hidden=!multiplayer.watch;if(multiplayer.watch){const select=$('follow-player'),signature=JSON.stringify(s.players.filter(p=>p.online).map(p=>[p.id,p.name,p.level]));if(select.dataset.signature!==signature){select.dataset.signature=signature;select.replaceChildren();const free=document.createElement('option');free.value='';free.textContent='Visuale libera';select.append(free);for(const p of s.players.filter(p=>p.online)){const o=document.createElement('option');o.value=p.id;o.textContent=p.name+' · '+(p.level===6?'Arena':'Piano '+p.level);select.append(o)}select.value=followId}}$('start').textContent=started?'Riprendi':'Entra nella spedizione';$('saved-info').textContent='Spedizione '+s.number+(multiplayer.watch?' · spettatore':' · progressi condivisi');$('menu-note').textContent=s.arenaResult?(s.archived?'Risultato archiviato.':'Puoi archiviare il risultato prima di uscire.'):'La spedizione rimane nella Lobby anche quando è vuota.';
 const active=s.players.filter(p=>p.counted),arrived=active.filter(p=>p.level===6);$('expedition-status').textContent=(multiplayer.watch?'Spettatore · ':'')+active.filter(p=>p.online).length+' online · arena '+arrived.length+'/'+active.length+(s.entryLocked?' · ingressi chiusi':' · ingressi aperti');
 if(previous&&!previous.showcaseOpen&&s.showcaseOpen){sound.chime();toast(s.arenaLive?'Tutti arrivati. Vince l’ultimo superstite.':'Le vetrine sono aperte.')}
 if(!playing)renderer.draw(player,hasKey,performance.now()/1000,cameraHeight());
}
function networkTick(dt){if(!multiplayer)return;netClock+=dt;if(netClock>.125){netClock=0;sendPose()}const t=Math.min(1,dt*12);for(const remote of remoteViews.values()){const p=remote.player,q=remote.target;remote.walk=(remote.walk||0)+(Math.hypot(q.x-p.x,q.z-p.z)>.025&&!reduced?Math.sin(seconds*10)*.07- (remote.walk||0):-(remote.walk||0))*t;p.x+=(q.x-p.x)*t;p.z+=(q.z-p.z)*t;p.height=((p.height||0)+((q.height||0)-(p.height||0))*t);p.yaw+=Math.atan2(Math.sin(q.yaw-p.yaw),Math.cos(q.yaw-p.yaw))*t;p.pitch+=(q.pitch-p.pitch)*t;p.crouch=q.crouch}if(multiplayer.watch&&followId){const followed=remoteViews.get(followId);if(followed&&followed.level===level){Object.assign(player,followed.player);jumpState.height=followed.player.height||0}}syncScene()}
function renderRemoteNames(){const root=$('remote-labels');if(!multiplayer){if(nameNodes.size){root.replaceChildren();nameNodes.clear()}return}remoteClock++;if(remoteClock%5)return;const visible=new Set(),rect=canvas.getBoundingClientRect();for(const p of remoteViews.values()){if(p.level!==level||p.standsUntil||p.eliminated)continue;const d=Math.hypot(p.player.x-player.x,p.player.z-player.z);if(d>(level===5?3:7))continue;let clear=true;for(let t=.15;t<1;t+=.1)if(!free(world,player.x+(p.player.x-player.x)*t,player.z+(p.player.z-player.z)*t,.04)){clear=false;break}if(!clear)continue;const q=projectPoint(player,{x:p.player.x,y:(p.player.crouch?1.42:1.99)+(p.player.height||0),z:p.player.z},rect.width,rect.height,cameraHeight());if(!q)continue;visible.add(p.id);let node=nameNodes.get(p.id);if(!node){node=document.createElement('span');node.style.left='0';node.style.top='0';root.append(node);nameNodes.set(p.id,node)}if(node.textContent!==p.name)node.textContent=p.name;node.style.transform='translate3d('+q.x+'px,'+q.y+'px,0) translate(-50%,-100%)'}for(const [id,node] of nameNodes)if(!visible.has(id)){node.remove();nameNodes.delete(id)}}
window.addEventListener('labyrinth:appearance',()=>{localAppearance=readAppearance();inventorySignature='';updateInventory();syncScene()});
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin)return;const data=event.data;
 if(data?.type==='labyrinth:insets'){applyInsets(document.documentElement,data.insets);updateOrientation()}
 else if(data?.type==='labyrinth:multiplayer'&&data.state){playerId=String(data.player);multiplayer={room:data.room,watch:data.watch===true,state:data.state};document.body.classList.toggle('spectating',multiplayer.watch);caseSignature='';followId=multiplayer.watch?(data.state.players.find(p=>p.online)?.id||''):'';remoteViews.clear();sentPoses.clear();receiveState(data.state,true);$('new-run').hidden=true;}
 else if(data?.type==='labyrinth:connection'){networkConnected=data.connected===true;if(!networkConnected&&multiplayer){$('expedition-status').textContent='Riconnessione alla spedizione…';networkBusy=false;resetInput()}}
 else if(data?.type==='labyrinth:notice')toast(data.message);
 else if(data?.type==='labyrinth:packet'&&multiplayer){const p=data.packet;if(p.type==='state'){if(Number.isFinite(p.serverTime))multiplayer.clockOffset=p.serverTime-Date.now();receiveState(p.state,p.correct&&(p.correctSeq??true));}else if(p.type==='ack'){if(networkBusy===p.request)networkBusy=false;if(!p.ok)toast(p.error||'Azione non riuscita.')}}
});

function updateTutorial(){if(!tutorialMode)return;if(!tutorialBox){tutorialBox=document.createElement('aside');tutorialBox.id='lab-tutorial';tutorialBox.style.cssText='position:fixed;top:calc(var(--system-safe-top,0px) + var(--content-safe-top,0px) + 64px);left:50%;transform:translateX(-50%);width:min(70vw,470px);padding:9px 12px;border:1px solid #a6cba870;border-radius:10px;background:#14201ee8;color:#f3f0d9;font:12px/1.4 system-ui;z-index:15;pointer-events:none';document.body.append(tutorialBox)}const step=!world.arena?floorState(run,world).open?['2 · Attraversa l’uscita','La porta resta aperta. Cammina oltre la soglia per proseguire.']:!hasKey&&!hasPass(run)?['1 · Esplora e raccogli','Muoviti con WASD o joystick sinistro; guarda col mouse o joystick destro. Cerca la keycard colorata: avvicinati e premi E / Usa.']:['2 · Apri l’uscita','Hai una carta adatta. Segui la freccia, avvicinati alla porta e premi E / Usa. La keycard si consuma. Il passe-partout si può riusare. Attraversa l’uscita.']:!run.showcaseOpen?['3 · La vetrina','Avvicinati alla vetrina e guardala: E / Usa la apre. In multiplayer occorre aspettare gli altri.']:!run.backpack?['4 · Lo zaino','Raccogli prima lo zaino: aggiunge quattro posti alle due mani e alle due tasche. Puoi lasciare le keycard con Q / Lascia.']:!run.swordTaken?['5 · La spada','Raccogli la spada dalla vetrina. F o clic sinistro / Colpisci attacca. Tieni premuto il destro o Para per difenderti.']:['6 · Pronto a esplorare','Prova la rete elastica e Salta. Pausa ti permette di cambiare piano nella modalità di prova o tornare alla Lobby.'];textIfChanged('lab-tutorial',step[0]+' — '+step[1]);tutorialBox.hidden=!playing;}
