import { COURSES, COURSE_VERSION, courseFor, RADIUS, BALL_KEY, ballColors, validBallColors } from './courses.js?v=3';
import { makeMatch, startMatch, takeShot, advanceMatch, LIMIT } from './match.js?v=3';
import { aimDirection, drawCourse } from './render.js?v=4';
import { upright, rollBy } from './roll.js';
import { applyInsets } from '../safe-area.js';

const $=id=>document.getElementById(id), canvas=$('green'), ctx=canvas.getContext('2d',{alpha:false});
const online=new URLSearchParams(location.search).get('online')==='1';
let audio=null, lastSound=null, camera=null, lastFrame=0, appearance=null, orbit=null, watching=null, watchOptions='';
const ballRolls=new Map();
try{appearance=JSON.parse(localStorage.getItem(BALL_KEY));}catch{}
let me='solo', state=null, offset=0, busy=false, drag=null, revision='', hole=-1, note='', noteUntil=0, frame=0;
const post=(type,data={})=>parent.postMessage({type:'golf:'+type,...data},location.origin);
const time=()=>Date.now()+offset;
const value=id=>Number($(id).value);
const player=()=>state?.players.find(p=>p.id===me);
const canShoot=()=>!!($('close-confirm').hidden&&player()&&state.phase==='playing'&&!player().done&&!busy&&time()<state.deadline&&!(player().shot?.until>time()));
const angle=()=>value('aim')*Math.PI/180;
function resetAim(course){
  $('aim').value=String(Math.round(Math.atan2(course.cup[1]-course.tee[1],course.cup[0]-course.tee[0])*180/Math.PI));
  $('power').value='43';drag=null;orbit=null;ballRolls.clear();
}

function solo(){
  offset=0;me='solo';
  state=makeMatch('solo',0,{player:me,name:'Tu'},Date.now(),appearance);
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
  if(!canShoot()||orbit)return;
  if(!camera.free)camera.targetYaw=angle();
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
    text.textContent=state.players.map(p=>p.name).join(' · ')+' — '+state.players.length+'/8 giocatori. '+
      (player()?'Gli amici possono entrare dalla lobby.':'Stai assistendo. La gara deve ancora iniziare.');
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
  const signature=JSON.stringify(state?.players.map(p=>[p.id,p.scores,p.total,p.strokes,p.done,p.appearance]));
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
    const marker=document.createElement('span');marker.className='ball-color';
    const [top,bottom]=ballColors(p.appearance,p.color);
    marker.style.background='linear-gradient('+top+' 50%, '+bottom+' 50%)';
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
function rotationAt(p,now,[x,z],radius){
  if(!p.shot)return upright;
  const {at,duration,until,samples,penalty}=p.shot;
  let roll=ballRolls.get(p.id);
  if(roll?.at!==at||roll?.stroke!==p.strokes){
    const initial=roll?.stroke===p.strokes-1 ? roll.rest : upright;
    const rotations=[initial];
    for(let i=1;i<samples.length;i++){
      const [x,z]=samples[i], [prevX,prevZ]=samples[i-1];
      rotations.push(rollBy(rotations[i-1],x-prevX,z-prevZ,radius));
    }
    roll={at,stroke:p.strokes,rotations,rest:penalty?initial:rotations.at(-1)};
    ballRolls.set(p.id,roll);
  }
  if(now>=until)return roll.rest;
  if(now>=at+duration)return roll.rotations.at(-1);
  const index=Math.min(samples.length-2,Math.floor(Math.max(0,now-at)/50));
  return rollBy(roll.rotations[index],x-samples[index][0],z-samples[index][1],radius);
}
function watchPlayer(p){
  const watchingRound=online&&state?.phase==='playing'&&(!p||p.done&&!state.nextAt);
  $('controls').hidden=online&&!!state&&(!p||watchingRound);
  $('watch-tools').hidden=!watchingRound;
  if(!watchingRound)return null;
  const active=state.players.filter(p=>!p.done), players=active.length?active:state.players;
  const select=$('watch-player'), signature=JSON.stringify(players.map(p=>[p.id,p.name]));
  if(signature!==watchOptions){
    watchOptions=signature;
    select.replaceChildren(...players.map(p=>{
      const option=document.createElement('option');option.value=p.id;option.textContent=p.name;
      return option;
    }));
  }
  const target=players.find(p=>p.id===watching)??players[0];
  if(target){
    watching=target.id;
    if(select.value!==watching)select.value=watching;
  }
  return target;
}
const putText=(id,text)=>{const node=$(id);if(node.textContent!==text)node.textContent=text;};
function draw(stamp=performance.now()){
  if(state&&!online)advanceMatch(state,time());
  const course=courseFor(state?.hole??0,state ? state.courseVersion : COURSE_VERSION), now=time();
  if(hole!==(state?.hole??0)||camera?.course!==course){
    hole=state?.hole??0;resetAim(course);
    camera={course,x:course.tee[0],z:course.tee[1],yaw:angle(),targetYaw:angle(),pitch:.18,free:false};
  }
  const dt=Math.max(.001,Math.min(.1,(stamp-lastFrame)/1000));
  lastFrame=stamp;
  const p=player(), available=canShoot(), watched=watchPlayer(p);
  $('close-game').hidden=online&&!p;
  $('close-game').disabled=busy;
  if(p?.shot&&now>=p.shot.at+p.shot.duration&&lastSound!==p.shot.at){
    lastSound=p.shot.at;
    if(p.shot.sunk||p.shot.penalty)sound(p.shot.sunk?'sunk':'water');
  }
  putText('counter','BUCA '+(hole+1)+' / '+COURSES.length+'  ·  PAR '+course.par);
  putText('course',course.name);
  const left=Math.max(0,Math.ceil(((state?.deadline??now)-now)/1000));
  putText('clock',state?.phase==='playing'?Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'');
  putText('tip',watched?'Su PC, tieni premuto il destro per ruotare la visuale.':
    course.tip+'  ·  Trascina verso il bersaglio per tirare. Su PC, tieni premuto il destro per ruotare la visuale.');
  const progress=p?'Colpi '+p.strokes+'/'+LIMIT:'';
  const notice=watched?'Segui '+watched.name+' · Colpi '+watched.strokes+'/'+LIMIT:p?.shot?.penalty&&p.shot.until>now&&now>=p.shot.at+p.shot.duration?'Acqua · ritorno all’ultimo punto':
    p?.shot?.sunk&&now>=p.shot.at+p.shot.duration?'In buca! · '+progress:p?.done?'Buca chiusa · '+progress:progress;
  putText('status',performance.now()<noteUntil?note:notice);
  $('shoot').disabled=!available;
  updatePanel();
  if(!$('card').hidden)table();
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(width>1&&height>1&&ctx){
    const scale=Math.min(devicePixelRatio||1,1.6,Math.sqrt(2400000/(width*height)));
    const w=Math.round(width*scale),h=Math.round(height*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(scale,0,0,scale,0,0);
    const radius=RADIUS*(course.scale??1);
    const balls=(state?.players||[]).flatMap(p=>{
      const pos=positionAt(p,now);
      return pos?[{id:p.id,name:p.name,color:p.color,appearance:p.appearance,x:pos[0],z:pos[1],sink:pos[2]||0,rotation:rotationAt(p,now,pos,radius)}]:[];
    });
    const target=watched??p;
    const [x,z]=target ? positionAt(target,now)??target.position : course.tee;
    if(watched&&camera.watched!==watched.id){
      camera.x=x;camera.z=z;
      if(!camera.free){
        camera.yaw=Math.atan2(course.cup[1]-z,course.cup[0]-x);
        camera.targetYaw=camera.yaw;
      }
    }
    camera.watched=watched?.id;
    const follow=1-Math.exp(-dt*17);
    camera.x+=(x-camera.x)*follow;
    camera.z+=(z-camera.z)*follow;
    if(!drag&&!orbit){
      const delta=camera.targetYaw-camera.yaw;
      camera.yaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*(1-Math.exp(-dt*11));
    }
    drawCourse(ctx,width,height,course,balls,me,available,angle(),value('power')/100,
      state?.started!=null?Math.max(0,now-state.started)/1000:0,camera);
  }
  frame=requestAnimationFrame(draw);
}

function aimDrag(e){
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  const length=Math.hypot(dx,dy);
  if(length<6)return false;
  $('aim').value=String(Math.round(aimDirection(drag.yaw,dx,dy)*180/Math.PI));
  $('power').value=String(Math.min(100,Math.max(1,Math.round(length/Math.min(150,canvas.clientWidth*.34)*100))));
  return true;
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(drag||orbit||!$('close-confirm').hidden)return;
  if(e.button===2){
    e.preventDefault();
    orbit={id:e.pointerId,x:e.clientX,y:e.clientY};
  }else if(e.button===0&&canShoot()){
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:camera.yaw};
  }else return;
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(orbit?.id===e.pointerId){
    if(!(e.buttons&2)){orbit=null;return;}
    camera.yaw+=(e.clientX-orbit.x)*.008;
    camera.targetYaw=camera.yaw;camera.free=true;
    camera.pitch=Math.max(.07,Math.min(.64,camera.pitch-(e.clientY-orbit.y)*.006));
    orbit.x=e.clientX;orbit.y=e.clientY;
  }else if(drag?.id===e.pointerId)aimDrag(e);
});
canvas.addEventListener('pointerup',e=>{
  if(orbit?.id===e.pointerId)orbit=null;
  if(drag?.id!==e.pointerId)return;
  const moved=e.button===0&&aimDrag(e);drag=null;if(moved)shoot();
});
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{
  if(orbit?.id===e.pointerId)orbit=null;
  if(drag?.id===e.pointerId)drag=null;
});
window.addEventListener('blur',()=>{drag=null;orbit=null;});
function followAim(){camera.targetYaw=angle();camera.free=false;}
$('aim').addEventListener('input',followAim);
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&!$('close-confirm').hidden){
    dismissClose();e.preventDefault();return;
  }
  if(e.target.matches?.('input,button,select')||!canShoot()||orbit)return;
  const {code}=e;
  if(!['ArrowLeft','ArrowRight','KeyA','KeyD','ArrowUp','ArrowDown','KeyW','KeyS','Space'].includes(code))return;
  e.preventDefault();
  if(code==='Space'){if(!e.repeat)shoot();return;}
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(code)){
    $('aim').value=String((value('aim')+180+360+(['ArrowRight','KeyD'].includes(code)?3:-3))%360-180);
    followAim();
  }else $('power').value=String(value('power')+(['ArrowUp','KeyW'].includes(code)?3:-3));
});
function leave(){if(parent!==window)post('exit');else location.href='/';}
$('watch-player').onchange=event=>{watching=event.target.value;};
function dismissClose(){
  $('close-confirm').hidden=true;
  $('close-game').focus();
}
$('close-game').onclick=()=>{
  if(busy||online&&!player())return;
  $('close-message').textContent=online?'La stanza verrà chiusa per tutti.':'Il giro in corso verrà chiuso.';
  $('close-confirm').hidden=false;
  $('cancel-close').focus();
};
$('cancel-close').onclick=dismissClose;
$('confirm-close').onclick=()=>{
  dismissClose();
  if(online)action('close');else leave();
};
$('back').onclick=leave;
$('shoot').onclick=shoot;
$('scores').onclick=()=>{
  const card=$('card');card.hidden=!card.hidden;
  $('scores').setAttribute('aria-expanded',String(!card.hidden));if(!card.hidden)table();
};
$('start').onclick=()=>{
  if(!$('close-confirm').hidden)return;
  if(state?.phase==='finished'){if(online)leave();else solo();}
  else if(online)action('start');
};

window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent)return;
  const data=e.data;
  if(data?.type==='golf:insets')applyInsets(document.documentElement,data.insets);
  if(data?.type==='golf:appearance'&&!online&&validBallColors(data.colors)){
    appearance=data.colors;player().appearance=appearance;
  }
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
