export const width=640,height=480,radius=5,paddleX=36,paddleWidth=9;
export const modes={
  classic:{label:'Classico',target:11,paddle:86,speed:300},
  super:{label:'Super Pong',target:11,paddle:72,speed:315,front:158},
  catch:{label:'Catch',target:11,paddle:100,speed:330},
  solitaire:{label:'Solitaire',target:11,paddle:86,speed:300,solo:true},
  football:{label:'Football',target:5,paddle:70,speed:340,goal:170,front:245}
};
export const validMode=mode=>typeof mode==='string'&&Object.hasOwn(modes,mode);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function newMatch(mode){
  return {mode,paddles:[height/2,height/2],scores:[0,0],ball:{x:width/2,y:height/2,vx:0,vy:0},
    serve:.7,direction:mode==='solitaire'?-1:1,hits:0,winner:null,sound:null,pulse:0};
}
export function paddlePositions(mode,player){
  const {front}=modes[mode],offsets=front?[paddleX,front]:[paddleX];
  return offsets.map(x=>player===0?x:width-x-paddleWidth);
}
export function movePaddle(match,player,direction,target,dt,speed=490){
  const y=match.paddles[player],maxStep=speed*dt,half=modes[match.mode].paddle/2;
  const step=target===null?direction*maxStep:clamp(target-y,-maxStep,maxStep);
  match.paddles[player]=clamp(y+step,half+2,height-half-2);
}
export function moveOpponent(match,dt){
  const {ball}=match;
  const toward=ball.vx>0;
  const error=Math.sin(ball.x/98+match.hits)*28;
  const target=match.serve>0||!toward?height/2:ball.y+error;
  movePaddle(match,1,0,target,dt,325);
}
function cue(match,sound){
  match.sound=sound;match.pulse++;
  return sound;
}
export function stepMatch(match,dt,random=Math.random){
  if(match.winner!==null)return;
  const rules=modes[match.mode],ball=match.ball,catchMode=match.mode==='catch';
  if(match.serve>0){
    match.serve-=dt;
    if(match.serve>0)return;
    ball.vx=rules.speed*match.direction;
    ball.vy=(random()<.5?-1:1)*(65+random()*65);
  }
  let remaining=dt,event;
  for(let count=0;count<5&&remaining>0;count++){
    const toRight=ball.vx>0,player=toRight?1:0,side=toRight?1:-1;
    const wallTime=ball.vy===0?Infinity:((ball.vy>0?height-radius:radius)-ball.y)/ball.vy;
    const rail=rules.goal||catchMode||rules.solo&&toRight;
    const edgeX=rail?(toRight?width-radius:radius):(toRight?width+radius:-radius);
    const edgeTime=(edgeX-ball.x)/ball.vx;
    let hitTime=Infinity,offset=0;
    if(!catchMode&&!(rules.solo&&toRight)){
      for(const x of paddlePositions(match.mode,player)){
        const face=toRight?x-radius:x+paddleWidth+radius;
        const time=(face-ball.x)/ball.vx;
        const aim=(ball.y+ball.vy*time-match.paddles[player])/(rules.paddle/2);
        if(time>=0&&time<hitTime&&Math.abs(aim)<=1+radius/(rules.paddle/2)){
          hitTime=time;offset=aim;
        }
      }
    }
    const advance=Math.min(remaining,wallTime,edgeTime,hitTime);
    ball.x+=ball.vx*advance;ball.y+=ball.vy*advance;
    remaining-=advance;
    if(advance===wallTime){ball.vy*=-1;event='wall';continue;}
    if(advance===hitTime){
      match.hits++;
      if(rules.solo){
        match.scores[0]++;
        if(match.scores[0]===rules.target){match.winner=0;return cue(match,'score');}
      }
      const speed=Math.min(770,rules.speed+match.hits*24),angle=clamp(offset,-1,1)*1.05;
      ball.vx=-side*Math.cos(angle)*speed;ball.vy=Math.sin(angle)*speed;
      event='paddle';continue;
    }
    if(advance!==edgeTime)break;
    const closedGoal=rules.goal&&Math.abs(ball.y-height/2)>rules.goal/2-radius;
    const missedCatch=catchMode&&Math.abs(ball.y-match.paddles[player])>rules.paddle/2-radius;
    if(closedGoal||missedCatch||rules.solo&&toRight){ball.vx*=-1;event='wall';continue;}
    const scorer=catchMode?player:1-player;
    if(rules.solo)match.winner=1;
    else if(++match.scores[scorer]===rules.target)match.winner=scorer;
    if(match.winner===null){
      Object.assign(ball,{x:width/2,y:height/2,vx:0,vy:0});
      match.serve=.7;match.direction=side;match.hits=0;
    }
    return cue(match,'score');
  }
  if(event)return cue(match,event);
}
