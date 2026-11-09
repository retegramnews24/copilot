import {width,height,radius,paddleX,paddleWidth,modes,newMatch,movePaddle,stepMatch} from './pong-physics.js?v=1';

const canvas=document.getElementById('field');
const field=document.getElementById('tube');
const context=canvas.getContext('2d');
const primary=document.getElementById('primary');
const overlay=document.getElementById('overlay');
const score=document.getElementById('score');
const hint=document.getElementById('hint');
const modeButtons=document.querySelectorAll('[data-mode]');
const keys=new Set(),pointers=new Map();
const bindings=[['KeyW','KeyS'],['ArrowUp','ArrowDown']];
const step=1/120;
let match=newMatch('classic'),phase='ready',last=0,elapsed=0,frame=null,sound=true,audio;

function prepareAudio(){
  if(!sound)return;
  try{
    audio??=new AudioContext();
    audio.resume().catch(()=>{});
  }catch{}
}
function beep(event){
  if(!sound||audio?.state!=='running')return;
  const note=audio.createOscillator(),volume=audio.createGain(),now=audio.currentTime;
  note.type='square';
  note.frequency.value={paddle:510,wall:330,score:205}[event];
  volume.gain.setValueAtTime(.055,now);
  volume.gain.exponentialRampToValueAtTime(.001,now+.10);
  note.connect(volume);volume.connect(audio.destination);
  note.start(now);note.stop(now+.11);
}

function draw(){
  if(!context)return;
  const football=match.mode==='football',rules=modes[match.mode];
  const ink=football?'#d8f8aa':'#e4f2d9';
  context.fillStyle=football?'#10240e':'#0a100d';
  context.fillRect(0,0,width,height);
  if(football){
    context.fillStyle='#163016';
    for(let x=0;x<width;x+=128)context.fillRect(x,0,64,height);
    context.strokeStyle='#8ac36595';
    context.lineWidth=3;
    context.beginPath();
    context.arc(width/2,height/2,54,0,2*Math.PI);
    context.stroke();
    const goalTop=(height-rules.goal)/2;
    context.strokeRect(2,goalTop-29,85,rules.goal+58);
    context.strokeRect(width-87,goalTop-29,85,rules.goal+58);
    context.fillStyle='#b4ed8299';
    for(const x of [0,width-4]){
      context.fillRect(x,0,4,goalTop);
      context.fillRect(x,goalTop+rules.goal,4,goalTop);
    }
    context.fillStyle=ink;
    for(const x of [0,width-10]){
      context.fillRect(x,goalTop-4,10,4);
      context.fillRect(x,goalTop+rules.goal,10,4);
    }
  }
  context.fillStyle=football?'#86b868':'#6b8068';
  for(let y=8;y<height-6;y+=20)context.fillRect(width/2-1,y,3,9);
  context.fillRect(0,0,width,3);context.fillRect(0,height-3,width,3);
  context.fillStyle=ink;
  context.shadowColor=ink;
  context.shadowBlur=8;
  match.paddles.forEach((y,player)=>{
    context.fillRect(player===0?paddleX:width-paddleX-paddleWidth,Math.round(y-rules.paddle/2),paddleWidth,rules.paddle);
  });
  const {x,y}=match.ball;
  context.fillRect(Math.round(x-radius),Math.round(y-radius),radius*2,radius*2);
  context.shadowBlur=0;
  context.fillStyle=ink;
  context.font='bold 54px monospace';context.textAlign='center';
  context.fillText(match.scores[0],width*.37,68);
  context.fillText(match.scores[1],width*.63,68);
}
function update(){
  const rules=modes[match.mode];
  score.textContent=match.scores.join(' — ');
  overlay.hidden=phase==='playing';
  document.getElementById('message').textContent=phase==='ready'?'Pronti?':phase==='paused'?'Pausa':
    phase==='over'?'Vince il giocatore '+(match.winner+1):'';
  primary.textContent={ready:'Inizia',playing:'Pausa',paused:'Riprendi',over:'Rivincita'}[phase];
  hint.textContent=(match.mode==='football'?'Porte centrali · ':'')+'Vince chi arriva a '+rules.target+
    '. P1 W/S · P2 ↑/↓. Su touch, trascinate ciascuno nella propria metà.';
  draw();
}
function tick(now){
  if(phase!=='playing'){frame=null;return;}
  if(last)elapsed+=Math.min(.05,(now-last)/1000);
  last=now;
  while(elapsed>=step&&phase==='playing'){
    bindings.forEach(([up,down],player)=>{
      const target=[...pointers.values()].find(pointer=>pointer.player===player)?.target??null;
      movePaddle(match,player,Number(keys.has(down))-Number(keys.has(up)),target,step);
    });
    const event=stepMatch(match,step);
    if(event)beep(event);
    if(event==='score'){
      if(match.winner!==null){phase='over';keys.clear();pointers.clear();}
      update();
    }
    elapsed-=step;
  }
  draw();
  frame=phase==='playing'?requestAnimationFrame(tick):null;
}
function reset(mode=match.mode){
  match=newMatch(mode);phase='ready';keys.clear();pointers.clear();
  if(frame!==null){cancelAnimationFrame(frame);frame=null;}
  modeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  update();
}
function pause(){
  if(phase!=='playing')return;
  phase='paused';keys.clear();pointers.clear();
  if(frame!==null){cancelAnimationFrame(frame);frame=null;}
  update();
}
function togglePlay(){
  if(phase==='playing'){pause();return;}
  if(phase==='over')reset();
  prepareAudio();phase='playing';last=0;elapsed=0;
  update();
  if(frame===null)frame=requestAnimationFrame(tick);
}
function touchTarget(event,bounds){
  return (event.clientY-bounds.top)/bounds.height*height;
}
field.addEventListener('pointerdown',event=>{
  if(phase!=='playing'||event.button!==0)return;
  const bounds=field.getBoundingClientRect();
  const player=event.clientX<bounds.left+bounds.width/2?0:1;
  if([...pointers.values()].some(pointer=>pointer.player===player))return;
  field.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId,{player,target:touchTarget(event,bounds)});
});
field.addEventListener('pointermove',event=>{
  const pointer=pointers.get(event.pointerId);
  if(pointer)pointer.target=touchTarget(event,field.getBoundingClientRect());
});
for(const type of ['pointerup','pointercancel','lostpointercapture']){
  field.addEventListener(type,event=>pointers.delete(event.pointerId));
}
window.addEventListener('keydown',event=>{
  if(event.code==='Space'&&!event.target.closest?.('button,a')){
    event.preventDefault();if(!event.repeat)togglePlay();return;
  }
  if(bindings.some(pair=>pair.includes(event.code))){
    event.preventDefault();if(phase==='playing')keys.add(event.code);
  }
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();pointers.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
primary.onclick=togglePlay;
document.getElementById('restart').onclick=()=>reset();
const soundButton=document.getElementById('sound');
soundButton.onclick=()=>{
  sound=!sound;if(sound)prepareAudio();
  soundButton.setAttribute('aria-pressed',String(sound));
  soundButton.textContent=sound?'Audio attivo':'Audio spento';
};
modeButtons.forEach(button=>button.onclick=()=>{if(button.dataset.mode!==match.mode)reset(button.dataset.mode);});
update();
