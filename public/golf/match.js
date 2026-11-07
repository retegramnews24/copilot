import { COURSES, COURSE_VERSION, courseFor, validBallColors } from './courses.js?v=7';
import { simulateShot } from './physics.js?v=7';

export const CAPACITY=8, LIMIT=10, HOLE_TIME=105000, BREAK=3500;
const fail=message=>{throw Error(message)};
const resetBall=(player,course)=>Object.assign(player,{position:[...course.tee],strokes:0,done:false,shot:null});
export function makeMatch(room,number,user,now=Date.now(),appearance){
  const match={room,number,game:'golf',host:user.player,phase:'waiting',courseVersion:COURSE_VERSION,created:now,revision:1,hole:0,players:[]};
  joinMatch(match,user,appearance);
  return match;
}

export function joinMatch(match,user,appearance){
  const existing=match.players.find(p=>p.id===user.player);
  const palette=validBallColors(appearance) ? [...appearance] : null;
  if(existing){
    if(palette && palette.some((color,index)=>color!==existing.appearance?.[index])){
      existing.appearance=palette;match.revision++;
    }
    return;
  }
  if(match.phase!=='waiting')fail('La gara è già iniziata.');
  if(match.players.length>=CAPACITY)fail('Stanza al completo.');
  match.players.push(resetBall({id:user.player,name:user.name.slice(0,48),color:match.players.length,total:0,scores:[],appearance:palette},courseFor(0,match.courseVersion)));
  match.revision++;
}

function openHole(match,now){
  match.phase='playing';match.started=now;match.deadline=now+HOLE_TIME;match.nextAt=null;
  for(const player of match.players)resetBall(player,courseFor(match.hole,match.courseVersion));
  match.revision++;
}

export function startMatch(match,id,now,minimum=2){
  if(match.host!==id || match.phase!=='waiting')fail('Solo chi ha creato la stanza può avviare la gara.');
  if(match.players.length<minimum)fail('Aspetta almeno un altro giocatore.');
  openHole(match,now);
}

function score(player,amount){
  player.done=true;player.scores.push(amount);player.total+=amount;
}

export function advanceMatch(match,now){
  if(match.phase!=='playing')return false;
  let changed=false;
  for(const player of match.players){
    if(player.done || (player.shot && player.shot.until>now))continue;
    if(player.shot?.sunk || player.strokes>=LIMIT || now>=match.deadline){
      score(player,player.shot?.sunk ? player.strokes : LIMIT+1);
      changed=true;
    }
  }
  if(match.players.every(p=>p.done)){
    if(match.hole===COURSES.length-1){
      const lowest=Math.min(...match.players.map(p=>p.total));
      match.winners=match.players.filter(p=>p.total===lowest).map(({id,name})=>({id,name}));
      match.phase='finished';match.finished=now;changed=true;
    }else if(!match.nextAt){
      match.nextAt=now+BREAK;changed=true;
    }else if(now>=match.nextAt){
      match.hole++;openHole(match,now);return true;
    }
  }
  if(changed)match.revision++;
  return changed;
}

export function takeShot(match,id,input,now){
  const player=match.players.find(p=>p.id===id);
  if(!player || match.phase!=='playing' || input.hole!==match.hole || player.done || input.strokes!==player.strokes ||
     now>=match.deadline || player.shot?.until>now)fail('Attendi che la palla sia ferma o che inizi la prossima buca.');
  if(!Number.isFinite(input.angle)||Math.abs(input.angle)>Math.PI*2||
     !Number.isFinite(input.power)||input.power<=0||input.power>1)fail('Colpo non valido.');
  const shot=simulateShot(courseFor(match.hole,match.courseVersion),...player.position,input.angle,input.power,(now-match.started)/1000);
  player.position=shot.end;player.strokes++;
  player.shot={...shot,at:now,until:now+shot.duration+(shot.penalty?480:shot.sunk?210:0)};
  match.revision++;
}
