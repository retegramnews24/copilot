import { COURSES, COLORS } from './courses.js';
import { makeMatch, startMatch, takeShot, advanceMatch, LIMIT } from './match.js?v=2';
import { viewFor, drawCourse } from './render.js?v=2';
import { applyInsets } from '../safe-area.js';

const $=id=>document.getElementById(id), canvas=$('green'), ctx=canvas.getContext('2d',{alpha:false});
const online=new URLSearchParams(location.search).get('online')==='1';
let audio=null, lastSound=null;
let me='solo', state=null, offset=0, busy=false, drag=null, revision='', hole=-1, note='', noteUntil=0, frame=0;
const post=(type,data={})=>parent.postMessage({type:'golf:'+type,...data},location.origin);
const time=()=>Date.now()+offset;
const value=id=>Number($(id).value);
const player=()=>state?.players.find(p=>p.id===me);
const canShoot=()=>!!(player()&&state.phase==='playing'&&!player().done&&!busy&&time()<state.deadline&&!(player().shot?.until>time()));
const angle=()=>value('aim')*Math.PI/180;
function resetAim(course){
  $('aim').value=String(Math.round(Math.atan2(course.cup[1]-course.tee[1],course.cup[0]-course.tee[0])*180/Math.PI));
  $('power').value='43';drag=null;
}

function solo(){
  offset=0;me='solo';
  state=makeMatch('solo',0,{player:me,name:'Tu'});
  startMatch(state,me,Date.now(),1);
  hole=-1;
  $('card').hidden=true;$('scores').setAttribute('aria-expanded','false');
}

function action(kind,payload={}){
  if(busy)return;
  if(online){busy=true;post('action',{kind,payload});return;}
  try{takeShot(state,me,payload,time());}catch(e){say(e.message);}
}
function sound(type){
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    if(!audio&&type!=='shot')return;
    audio??=new Audio();
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const tone=audio.createOscillator(), gain=audio.createGain(), now=audio.currentTime;
    const [high,low,length]=type==='sunk'?[610,940,.23]:type==='water'?[210,70,.23]:[470,170,.09];
    tone.type=type==='shot'?'triangle':'sine';
    tone.frequency.setValueAtTime(high,now);tone.frequency.exponentialRampToValueAtTime(low,now+length);
    gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+length);
    tone.connect(gain);gain.connect(audio.destination);tone.start(now);tone.stop(now+length);
  }catch{}
}
function shoot(){
  if(!canShoot())return;
  sound('shot');
  action('shot',{hole:state.hole,strokes:player().strokes,angle:angle(),power:value('power')/100});
}
function say(message){note=message;noteUntil=performance.now()+3500;}
function updatePanel(){
  const panel=$('panel'), btn=$('start'), title=$('panel-title'), text=$('panel-text');
  panel.hidden=!!state&&state.phase==='playing'&&!state.nextAt;
  if(panel.hidden)return;
  btn.hidden=true;
  if(!state){title.textContent='Collegamento…';text.textContent='Apertura della stanza.';return;}
  if(state.phase==='waiting'){
    title.textContent='Stanza '+state.number;
    text.textContent=state.players.map(p=>p.name).join(' · ')+' — '+state.players.length+'/8 giocatori. Gli amici possono entrare dalla lobby.';
    btn.hidden=state.host!==me;btn.disabled=state.players.length<2||busy;btn.textContent='Inizia la gara';
  }else if(state.phase==='finished'){
    title.textContent=online?'Risultato finale':'Giro completato';
    text.textContent=online?state.winners.map(p=>p.name).join(' e ')+' · '+state.players.find(p=>p.id===state.winners[0].id).total+' colpi'
      : player().total+' colpi in nove buche.';
    btn.hidden=false;btn.disabled=false;btn.textContent=online?'Torna ai giochi':'Nuovo giro';
  }else{
    title.textContent='Buca completata';text.textContent='Tra poco si passa alla prossima buca.';
  }
}
function table(){
  const signature=JSON.stringify(state?.players.map(p=>[p.id,p.scores,p.total,p.strokes,p.done]));
  if(signature===revision)return;
  revision=signature;
  const row=(values,tag)=>{
    const tr=document.createElement('tr');
    for(const value of values){const td=document.createElement(tag);td.textContent=value;tr.append(td);}
    return tr;
  };
  $('score-head').replaceChildren(row(['Giocatore',...COURSES.map((_,i)=>i+1),'Tot.'],'th'));
  const rows=(state?.players||[]).slice().sort((a,b)=>b.scores.length-a.scores.length||a.total-b.total);
  $('score-body').replaceChildren(...rows.map(p=>{
    const tr=row([p.name,...COURSES.map((_,i)=>p.scores[i]??(i===state?.hole&&state?.phase==='playing'?p.strokes:'–')),p.total],'td');
    const marker=document.createElement('span');marker.className='ball-color';marker.style.background=COLORS[p.color];
    tr.firstChild.prepend(marker);return tr;
  }));
}
function positionAt(p,now){
  const shot=p.shot;
  if(!shot||now>=shot.until)return shot?.sunk?null:p.position;
  const elapsed=Math.max(0,now-shot.at);
  if(elapsed>=shot.duration){
    if(shot.penalty)return null;
    if(shot.sunk)return [...shot.end,(now-shot.at-shot.duration)/Math.max(1,shot.until-shot.at-shot.duration)];
    return shot.end;
  }
  const t=elapsed/50, index=Math.min(shot.samples.length-2,Math.floor(t)), next=shot.samples[index+1];
  const a=shot.samples[index], fraction=index===shot.samples.length-2?
    Math.min(1,(elapsed-index*50)/Math.max(1,shot.duration-index*50)):t-index;
  return a.map((x,i)=>x+(next[i]-x)*fraction);
}
const putText=(id,text)=>{const node=$(id);if(node.textContent!==text)node.textContent=text;};
function draw(){
  if(state&&!online)advanceMatch(state,time());
  const course=COURSES[state?.hole||0], now=time();
  if(hole!==(state?.hole??0)){hole=state?.hole??0;resetAim(course);}
  const p=player(), available=canShoot();
  if(p?.shot&&now>=p.shot.at+p.shot.duration&&lastSound!==p.shot.at){
    lastSound=p.shot.at;
    if(p.shot.sunk||p.shot.penalty)sound(p.shot.sunk?'sunk':'water');
  }
  putText('counter','BUCA '+(hole+1)+' / '+COURSES.length+'  ·  PAR '+course.par);
  putText('course',course.name);
  const left=Math.max(0,Math.ceil(((state?.deadline??now)-now)/1000));
  putText('clock',state?.phase==='playing'?Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'');
  putText('tip',course.tip+'  ·  Trascina verso il bersaglio e rilascia, oppure usa i comandi.');
  const progress=p?'Colpi '+p.strokes+'/'+LIMIT:'';
  const notice=p?.shot?.penalty&&p.shot.until>now&&now>=p.shot.at+p.shot.duration?'Acqua · ritorno all’ultimo punto':
    p?.shot?.sunk&&now>=p.shot.at+p.shot.duration?'In buca! · '+progress:p?.done?'Buca chiusa · '+progress:progress;
  putText('status',performance.now()<noteUntil?note:notice);
  $('shoot').disabled=!available;
  updatePanel();
  if(!$('card').hidden)table();
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(width>1&&height>1&&ctx){
    const scale=Math.min(devicePixelRatio||1,1.6);
    const w=Math.round(width*scale),h=Math.round(height*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(scale,0,0,scale,0,0);
    const balls=(state?.players||[]).flatMap(p=>{
      const pos=positionAt(p,now);
      return pos?[{id:p.id,name:p.name,color:p.color,x:pos[0],z:pos[1],sink:pos[2]||0}]:[];
    });
    drawCourse(ctx,width,height,course,balls,me,available,angle(),value('power')/100,
      state?.started?Math.max(0,now-state.started)/1000:0);
  }
  frame=requestAnimationFrame(draw);
}

function aimDrag(e){
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  const [x,z]=viewFor(canvas.clientWidth,canvas.clientHeight).direction(dx,dy);
  const length=Math.hypot(dx,dy);
  if(length<6)return false;
  $('aim').value=String(Math.round(Math.atan2(z,x)*180/Math.PI));
  $('power').value=String(Math.min(100,Math.max(1,Math.round(length/Math.min(150,canvas.clientWidth*.34)*100))));
  return true;
}
canvas.addEventListener('pointerdown',e=>{
  if(!canShoot()||e.button!==0||drag)return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY};
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)aimDrag(e);});
canvas.addEventListener('pointerup',e=>{
  if(drag?.id!==e.pointerId)return;
  const moved=aimDrag(e);drag=null;if(moved)shoot();
});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
window.addEventListener('keydown',e=>{
  if(e.target.matches?.('input,button')||!canShoot())return;
  const {code}=e;
  if(!['ArrowLeft','ArrowRight','KeyA','KeyD','ArrowUp','ArrowDown','KeyW','KeyS','Space'].includes(code))return;
  e.preventDefault();
  if(code==='Space'){if(!e.repeat)shoot();return;}
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(code)){
    $('aim').value=String((value('aim')+180+360+(['ArrowRight','KeyD'].includes(code)?3:-3))%360-180);
  }else $('power').value=String(value('power')+(['ArrowUp','KeyW'].includes(code)?3:-3));
});
function leave(){if(parent!==window)post('exit');else location.href='/';}
$('back').onclick=leave;
$('shoot').onclick=shoot;
$('scores').onclick=()=>{
  const card=$('card');card.hidden=!card.hidden;
  $('scores').setAttribute('aria-expanded',String(!card.hidden));if(!card.hidden)table();
};
$('start').onclick=()=>{
  if(state?.phase==='finished'){if(online)leave();else solo();}
  else if(online)action('start');
};

window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent)return;
  const data=e.data;
  if(data?.type==='golf:insets')applyInsets(document.documentElement,data.insets);
  if(data?.type==='golf:state'&&online){
    if(data.state.revision>=(state?.revision??0)){state=data.state;offset=data.now-Date.now();me=data.player;}
    if(data.ack)busy=false;
  }
  if(data?.type==='golf:error'){busy=false;say(data.message);}
});
if(!online)solo();
window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
post('ready');
draw();
