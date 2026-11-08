import { COURSE_VERSION, DEFAULT_CAMPAIGN, campaignInfo, coursesFor, courseFor, validBallColors } from './courses.js?v=9';
import { motionAt, shotVelocity, simulateBalls, simulateShot } from './physics.js?v=11';

export const CAPACITY=8, LIMIT=10, HOLE_TIME=105000, BREAK=3500;
const fail=message=>{throw Error(message)};
const resetBall=(player,course)=>Object.assign(player,{position:[...course.tee],strokes:0,done:false,shot:null});
export function makeMatch(room,number,user,now=Date.now(),appearance,campaign=DEFAULT_CAMPAIGN,collisions=false){
  if(!campaignInfo(campaign))fail('Percorso non disponibile.');
  const match={room,number,game:'golf',host:user.player,phase:'waiting',courseVersion:COURSE_VERSION,campaign,collisions:collisions===true,created:now,revision:1,hole:0,players:[]};
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
  match.players.push(resetBall({id:user.player,name:user.name.slice(0,48),color:match.players.length,total:0,scores:[],appearance:palette},courseFor(0,match.courseVersion,match.campaign)));
  match.revision++;
}

function openHole(match,now){
  match.phase='playing';match.started=now;match.deadline=now+HOLE_TIME;match.nextAt=null;
  for(const player of match.players)resetBall(player,courseFor(match.hole,match.courseVersion,match.campaign));
  match.revision++;
}

export function startMatch(match,id,now,minimum=2,campaign){
  if(match.host!==id || match.phase!=='waiting')fail('Solo chi ha creato la stanza può avviare la gara.');
  if(match.players.length<minimum)fail('Aspetta almeno un altro giocatore.');
  if(campaign!==undefined){
    if(match.courseVersion!==COURSE_VERSION||!campaignInfo(campaign))fail('Percorso non disponibile.');
    match.campaign=campaign;
  }
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
    if(match.hole===coursesFor(match.courseVersion,match.campaign).length-1){
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

export function ballRolling(player,now){
  const shot=player.shot;
  return !!shot&&now>=(shot.moveAt??shot.at)&&now<shot.until;
}

function setShot(player,shot,now){
  player.position=shot.end;
  player.shot={...shot,at:now,until:now+shot.duration+(shot.penalty?480:shot.sunk?210:0)};
}

function playWithCollisions(match,player,course,input,now){
  const balls=match.players.filter(p=>!p.done&&!(
    p.shot&&(p.shot.sunk||p.shot.penalty)&&now>=p.shot.at+p.shot.duration&&now<p.shot.until
  ));
  const inputs=balls.map(p=>{
    const future=p.shot&&now<p.shot.at+p.shot.duration;
    const rolling=future&&ballRolling(p,now);
    const motion=rolling ? motionAt(p.shot,now) :
      {position:future?p.shot.samples[0]:p.position,velocity:[0,0]};
    const returnTo=rolling ? p.shot.returnTo??p.shot.samples[0] : motion.position;
    if(p===player)motion.velocity=shotVelocity(course,input.angle,input.power);
    return {...motion,returnTo};
  });
  const paths=simulateBalls(course,inputs,(now-match.started)/1000);
  for(const [i,ball] of balls.entries()){
    const path=paths[i];
    if(path){
      const {first,...shot}=path;
      setShot(ball,{...shot,moveAt:now+first,returnTo:inputs[i].returnTo},now);
    }else if(ball.shot?.until>now){
      // A new shot may prevent a collision that was still in the future.
      ball.position=inputs[i].position;ball.shot=null;
    }
  }
}

export function takeShot(match,id,input,now){
  const player=match.players.find(p=>p.id===id);
  if(!player || match.phase!=='playing' || input.hole!==match.hole || player.done || input.strokes!==player.strokes ||
     now>=match.deadline || ballRolling(player,now))fail('Attendi che la palla sia ferma o che inizi la prossima buca.');
  if(!Number.isFinite(input.angle)||Math.abs(input.angle)>Math.PI*2||
     !Number.isFinite(input.power)||input.power<=0||input.power>1)fail('Colpo non valido.');
  const course=courseFor(match.hole,match.courseVersion,match.campaign);
  if(match.collisions){
    playWithCollisions(match,player,course,input,now);
  }else{
    setShot(player,simulateShot(course,...player.position,input.angle,input.power,(now-match.started)/1000),now);
  }
  player.strokes++;
  match.revision++;
}
