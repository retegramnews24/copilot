import {width,height,radius,paddleWidth,modes,paddlePositions,newMatch,movePaddle,moveOpponent,stepMatch} from './pong-physics.js?v=2';

const $=id=>document.getElementById(id);
const canvas=$('field'),context=canvas.getContext('2d'),field=$('tube');
const primary=$('primary'),modeSelect=$('mode'),overlay=$('overlay');
const dials=[...document.querySelectorAll('[data-dial]')],keys=new Set();
const STEP=1/120,send=(type,data={})=>parent.postMessage({type:'pong:'+type,...data},location.origin);
let online=parent!==window&&new URLSearchParams(location.search).get('online')==='1',connected=false,pending=false;
let seat=0,players=[],roomNumber=null,account=null,frame=null,last=0,elapsed=0;
let match=newMatch('classic'),shown=match,phase=online?'waiting':'ready',sound=true,audio,lastPulse=null;
let pointer=null,target=null,notice='';

function unlockAudio(){
  if(!sound)return;
  try{
    audio??=new AudioContext();
    return audio.resume().catch(()=>{});
  }catch{}
}
function beep(event){
  if(!sound||audio?.state!=='running')return;
  const note=audio.createOscillator(),volume=audio.createGain(),now=audio.currentTime;
  note.type=event==='switch'?'triangle':'square';
  note.frequency.value={paddle:510,wall:330,score:205,switch:190}[event];
  if(event==='switch')note.frequency.exponentialRampToValueAtTime(66,now+.055);
  volume.gain.setValueAtTime(event==='switch' ? .16 : .055,now);
  volume.gain.exponentialRampToValueAtTime(.001,now+.085);
  note.connect(volume);volume.connect(audio.destination);
  note.start(now);note.stop(now+.09);
}
function clickSound(){
  if(audio?.state==='running')beep('switch');
  else unlockAudio()?.then(()=>beep('switch'));
}

function draw(){
  if(!context)return;
  const state=shown,rules=modes[state.mode],football=state.mode==='football',catchMode=state.mode==='catch';
  const ink=football?'#d8f8aa':'#e4f2d9';
  context.fillStyle=football?'#10240e':'#0a100d';
  context.fillRect(0,0,width,height);
  if(phase==='off')return;
  if(football){
    context.fillStyle='#163016';
    for(let x=0;x<width;x+=128)context.fillRect(x,0,64,height);
    context.strokeStyle='#8ac36595';context.lineWidth=3;
    context.beginPath();context.arc(width/2,height/2,54,0,2*Math.PI);context.stroke();
    const top=(height-rules.goal)/2;
    context.strokeRect(2,top-29,85,rules.goal+58);
    context.strokeRect(width-87,top-29,85,rules.goal+58);
  }
  if(football||catchMode||rules.solo){
    context.fillStyle=ink;
    for(const player of [0,1]){
      if(rules.solo&&player===0)continue;
      const goal=football?rules.goal:catchMode?rules.paddle:0;
      const center=catchMode?state.paddles[player]:height/2,top=center-goal/2,bottom=center+goal/2;
      const x=player===0?0:width-4;
      context.fillRect(x,0,4,top);context.fillRect(x,bottom,4,height-bottom);
      if(goal){
        const post=player===0?0:width-13;
        context.fillRect(post,top,13,3);context.fillRect(post,bottom-3,13,3);
      }
    }
  }
  context.fillStyle=football?'#86b868':'#6b8068';
  if(!rules.solo)for(let y=8;y<height-6;y+=20)context.fillRect(width/2-1,y,3,9);
  context.fillRect(0,0,width,3);context.fillRect(0,height-3,width,3);
  context.fillStyle=ink;context.shadowColor=ink;context.shadowBlur=8;
  if(!catchMode)state.paddles.forEach((y,player)=>{
    if(rules.solo&&player===1)return;
    for(const x of paddlePositions(state.mode,player)){
      context.fillRect(x,Math.round(y-rules.paddle/2),paddleWidth,rules.paddle);
    }
  });
  const {x,y}=state.ball;
  context.fillRect(Math.round(x-radius),Math.round(y-radius),radius*2,radius*2);
  context.shadowBlur=0;
  context.font='bold 54px monospace';context.textAlign='center';
  context.fillText(state.scores[0],width*.37,68);
  if(!rules.solo)context.fillText(state.scores[1],width*.63,68);
}
const canControl=()=>!online||connected&&players[0]?.seat===seat;
const playable=()=>!online||connected&&players.length===2;
function updateDials(){
  dials.forEach((dial,i)=>{
    const y=shown.paddles[i];
    $('dial-'+i).style.setProperty('--dial-angle',(y/height*270-135)+'deg');
    if(!dial.matches(':active')&&document.activeElement!==dial)dial.value=y;
  });
}
function update(){
  const rules=modes[match.mode],playing=phase==='playing'&&playable();
  const waiting=online&&!playable();
  modeSelect.value=match.mode;modeSelect.disabled=!canControl()||phase==='off';
  modeSelect.querySelector('[value="solitaire"]').disabled=online;
  $('power').disabled=!canControl();
  $('power').setAttribute('aria-pressed',String(phase!=='off'));
  $('audio').setAttribute('aria-pressed',String(sound));
  $('online').setAttribute('aria-pressed',String(online));
  $('online').disabled=pending||parent===window;
  primary.disabled=!playable()||!canControl()||phase==='off';
  $('restart').disabled=!canControl()||phase==='off';
  primary.textContent=phase==='playing'?'Pausa':phase==='paused'?'Riprendi':phase==='over'?'Rivincita':'Avvia';
  const playerNames=online?[0,1].map(i=>players.find(player=>player.seat===i)?.name??'Libero'):
    [account||'Tu',rules.solo?'Parete':'IA'];
  playerNames.forEach((name,i)=>{
    const label=$('player-'+i),dial=$('dial-'+i);
    label.textContent=name;label.title=name;
    dial.dataset.connected=String(online?players.some(p=>p.seat===i):i===0||!rules.solo);
    dials[i].disabled=phase==='off'||(online?!connected||i!==seat:i!==0);
  });
  const connection=online?(connected?'Sala '+roomNumber+' · '+players.length+'/2 connessi':'Collegamento alla sala…'):
    rules.solo?'Singolo · Solitaire':'Singolo contro IA';
  $('connection').textContent=notice||connection;
  const winner=match.winner;
  $('score').textContent=rules.solo?match.scores[0]+' / '+rules.target:match.scores.join(' — ');
  overlay.hidden=playing;
  $('message').textContent=phase==='off'?'Monitor spento':waiting?(connected?'In attesa del secondo giocatore':'Connessione in corso'):
    phase==='over'?(rules.solo?(winner===0?'Traguardo raggiunto':'Palla persa'):'Vince '+playerNames[winner]):
    phase==='paused'?'Pausa':'Pronto a giocare';
  const rule=match.mode==='football'?'Porte centrali · 5 gol':match.mode==='catch'?'Intercetta la palla con la porta · 11 punti':
    rules.solo?'Rimanda la palla contro la parete · 11 risposte':'Primo a 11 punti';
  $('hint').textContent=rule+' · W/S, ↑/↓, manopola o trascinamento';
  updateDials();draw();
}
function direction(){
  return Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
}
function tick(now){
  frame=null;
  if(phase!=='playing'||!playable())return;
  if(online){
    if(shown.mode!==match.mode)shown=structuredClone(match);
    for(let i=0;i<2;i++)shown.paddles[i]+=(match.paddles[i]-shown.paddles[i])*.58;
    if(match.serve>0||Math.abs(shown.ball.x-match.ball.x)>84)Object.assign(shown.ball,match.ball);
    else for(const axis of ['x','y'])shown.ball[axis]+=(match.ball[axis]-shown.ball[axis])*.57;
    shown.scores=match.scores;
  }else{
    if(last)elapsed+=Math.min(.05,(now-last)/1000);
    while(elapsed>=STEP){
      movePaddle(match,0,direction(),target,STEP);
      if(!modes[match.mode].solo)moveOpponent(match,STEP);
      const event=stepMatch(match,STEP);
      if(event)beep(event);
      if(event==='score'||modes[match.mode].solo&&event==='paddle'){
        if(match.winner!==null){phase='over';keys.clear();}
        update();
      }
      elapsed-=STEP;
      if(phase==='over')break;
    }
    last=now;
  }
  updateDials();draw();
  if(phase==='playing')frame=requestAnimationFrame(tick);
}
function run(){
  if(frame===null&&phase==='playing'&&playable()){
    last=0;elapsed=0;frame=requestAnimationFrame(tick);
  }
}
function reset(mode=match.mode){
  shown=match=newMatch(mode);target=null;pointer=null;keys.clear();
  if(phase!=='off')phase='ready';
  update();
}
function command(action,mode){
  clickSound();notice='';
  if(online){if(canControl())send('command',{action,mode});return;}
  if(action==='mode'){reset(mode);return;}
  if(action==='reset'){reset();return;}
  if(action==='power'){phase=phase==='off'?'ready':'off';reset();return;}
  if(phase==='off')return;
  if(phase==='over')reset();
  phase=phase==='playing'?'paused':'playing';
  keys.clear();update();run();
}
function aim(event){
  const bounds=field.getBoundingClientRect();
  target=Math.min(height,Math.max(0,(event.clientY-bounds.top)/bounds.height*height));
}
field.addEventListener('pointerdown',event=>{
  if(phase!=='playing'||!playable()||event.button!==0||pointer!==null)return;
  unlockAudio();field.setPointerCapture(event.pointerId);pointer=event.pointerId;aim(event);
});
field.addEventListener('pointermove',event=>{if(pointer===event.pointerId)aim(event);});
for(const type of ['pointerup','pointercancel','lostpointercapture']){
  field.addEventListener(type,event=>{if(pointer===event.pointerId){pointer=null;target=null;}});
}
dials.forEach(dial=>dial.oninput=()=>{
  const value=Number(dial.value);
  if(!online&&phase==='ready'){
    match.paddles[0]=Math.min(height-modes[match.mode].paddle/2-2,Math.max(modes[match.mode].paddle/2+2,value));
    updateDials();draw();
  }
  target=value;
});
window.addEventListener('keydown',event=>{
  if(event.target.closest?.('button,select,input,a'))return;
  if(event.code==='Space'){event.preventDefault();if(!event.repeat)command('start');return;}
  if(['KeyW','KeyS','ArrowUp','ArrowDown'].includes(event.code)){
    event.preventDefault();if(phase==='playing'){target=null;keys.add(event.code);}
  }
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();pointer=null;target=null;});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&!online&&phase==='playing'){phase='paused';update();}
});
primary.onclick=()=>{command('start');canvas.focus();};
canvas.tabIndex=0;
$('restart').onclick=()=>command('reset');
$('power').onclick=()=>command('power');
modeSelect.onchange=()=>command('mode',modeSelect.value);
$('audio').onclick=()=>{if(sound)clickSound();sound=!sound;if(sound)clickSound();update();};
$('online').onclick=()=>{
  clickSound();notice='';
  if(online){send('leave');online=false;connected=false;players=[];seat=0;lastPulse=null;reset();return;}
  pending=true;update();send('join',{mode:modes[match.mode].solo?'classic':match.mode});
};
setInterval(()=>{
  if(online&&connected&&phase==='playing'&&playable())send('input',{direction:direction(),target});
},48);
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const data=event.data;
  if(data?.type==='pong:identity'){account=data.name;update();return;}
  if(data?.type==='pong:status'){
    pending=false;online=data.online;
    if(!online){connected=false;players=[];seat=0;phase='ready';reset();}
    else if(!data.connected){connected=false;players=[];target=null;keys.clear();phase='waiting';}
    notice=data.error||'';update();return;
  }
  if(data?.type!=='pong:state')return;
  pending=false;online=true;connected=true;notice='';
  const state=data.state,previousMode=match.mode,previousPhase=phase;
  players=state.players;roomNumber=state.number;seat=players.find(player=>player.id===data.player)?.seat??0;
  phase=state.phase;match=state.match;
  if(previousMode!==match.mode||previousPhase!==phase||match.serve>0)shown=structuredClone(match);
  if(lastPulse!==null&&match.pulse!==lastPulse&&match.sound)beep(match.sound);
  lastPulse=match.pulse;
  const uiKey=JSON.stringify([phase,match.mode,match.scores,players,seat,roomNumber]);
  if(uiKey!==lastUI){lastUI=uiKey;update();}
  run();
});
let lastUI='';
update();
if(parent!==window)send('ready');
