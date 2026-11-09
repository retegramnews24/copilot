export const width=640,height=480,radius=5,paddleX=36,paddleWidth=9;
export const modes={
  classic:{target:11,paddle:86,speed:300,goal:0},
  football:{target:5,paddle:70,speed:340,goal:170}
};
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function newMatch(mode){
  return {mode,paddles:[height/2,height/2],scores:[0,0],ball:{x:width/2,y:height/2,vx:0,vy:0},
    serve:0.7,direction:1,hits:0,winner:null};
}
export function movePaddle(match,player,direction,target,dt){
  const y=match.paddles[player],maxStep=490*dt,half=modes[match.mode].paddle/2;
  const step=target===null?direction*maxStep:clamp(target-y,-maxStep,maxStep);
  match.paddles[player]=clamp(y+step,half+2,height-half-2);
}
export function stepMatch(match,dt,random=Math.random){
  if(match.winner!==null)return;
  const rules=modes[match.mode],ball=match.ball;
  if(match.serve>0){
    match.serve-=dt;
    if(match.serve>0)return;
    ball.vx=rules.speed*match.direction;
    ball.vy=(random()<.5?-1:1)*(65+random()*65);
  }
  let remaining=dt,event;
  for(let count=0;count<4&&remaining>0;count++){
    const toRight=ball.vx>0,player=toRight?1:0,side=toRight?1:-1;
    const paddleFace=toRight?width-paddleX-paddleWidth-radius:paddleX+paddleWidth+radius;
    const wallTime=ball.vy===0?Infinity:((ball.vy>0?height-radius:radius)-ball.y)/ball.vy;
    const edgeX=rules.goal?(toRight?width-radius:radius):(toRight?width+radius:-radius);
    const edgeTime=(edgeX-ball.x)/ball.vx;
    const paddleTime=(paddleFace-ball.x)/ball.vx;
    const offset=(ball.y+ball.vy*paddleTime-match.paddles[player])/(rules.paddle/2);
    const canHit=paddleTime>=0&&Math.abs(offset)<=1+radius/(rules.paddle/2);
    const hitTime=canHit?paddleTime:Infinity;
    const advance=Math.min(remaining,wallTime,edgeTime,hitTime);
    ball.x+=ball.vx*advance;ball.y+=ball.vy*advance;
    remaining-=advance;
    if(advance===wallTime){ball.vy*=-1;event='wall';continue;}
    if(advance===hitTime){
      match.hits++;
      const speed=Math.min(770,rules.speed+match.hits*24);
      const angle=clamp(offset,-1,1)*1.05;
      ball.vx=-side*Math.cos(angle)*speed;ball.vy=Math.sin(angle)*speed;
      event='paddle';continue;
    }
    if(advance!==edgeTime)break;
    if(rules.goal&&Math.abs(ball.y-height/2)>rules.goal/2-radius){
      ball.vx*=-1;event='wall';continue;
    }
    const scorer=1-player;
    match.scores[scorer]++;
    if(match.scores[scorer]===rules.target)match.winner=scorer;
    else{
      Object.assign(ball,{x:width/2,y:height/2,vx:0,vy:0});
      match.serve=.7;match.direction=side;match.hits=0;
    }
    return 'score';
  }
  return event;
}
