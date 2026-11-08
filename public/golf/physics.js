import { WIDTH, DEPTH, RADIUS, CUP, rotorWalls } from './courses.js?v=9';

const STEP = 1 / 100, MAX_STEP = 900;
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
const inside = (r,x,z) => x>r.x && x<r.x+r.w && z>r.z && z<r.z+r.h;
const launchSpeed = power => power*18+1.7*Math.min(1,power/.15);
const surfaceDrag = (course,x,z) => course.rough?.some(r=>inside(r,x,z)) ? 5.1 : 2.25;

export function estimateRoll(course,x,z,power){
  const speed=launchSpeed(power);
  return speed*speed/(2*surfaceDrag(course,x,z))*(course.scale??1);
}

const courseBorders = (width,depth) => [
  {x:0,z:0,toX:width,toZ:0}, {x:width,z:0,toX:width,toZ:depth},
  {x:width,z:depth,toX:0,toZ:depth}, {x:0,z:depth,toX:0,toZ:0}
];

function rebound(ball, wall, radius, energy) {
  const dx=wall.toX-wall.x, dz=wall.toZ-wall.z, span=dx*dx+dz*dz;
  const t=span ? clamp(((ball.x-wall.x)*dx+(ball.z-wall.z)*dz)/span,0,1) : 0;
  const ox=ball.x-(wall.x+dx*t), oz=ball.z-(wall.z+dz*t), distance=Math.hypot(ox,oz);
  if(distance>=radius)return;
  const nx=distance ? ox/distance : 1, nz=distance ? oz/distance : 0;
  ball.x+=nx*(radius-distance);
  ball.z+=nz*(radius-distance);
  const inward=ball.vx*nx+ball.vz*nz;
  if(inward<0){ball.vx-=nx*inward*(1+energy);ball.vz-=nz*inward*(1+energy)}
}

export function shotVelocity(course,angle,power){
  const speed=launchSpeed(power)*(course.scale??1);
  return [Math.cos(angle)*speed,Math.sin(angle)*speed];
}

export function motionAt(shot,now){
  const elapsed=Math.max(0,now-shot.at);
  const index=Math.min(shot.samples.length-2,Math.floor(elapsed/50));
  const [x,z]=shot.samples[index], [nx,nz]=shot.samples[index+1];
  const start=index*50, end=Math.min(start+50,shot.duration);
  const seconds=(end-start)/1000;
  const fraction=seconds>0?clamp((elapsed-start)/(end-start),0,1):1;
  return {position:[x+(nx-x)*fraction,z+(nz-z)*fraction],
    velocity:seconds>0?[(nx-x)/seconds,(nz-z)/seconds]:[0,0]};
}

function collideBalls(a,b,diameter){
  const dx=b.x-a.x,dz=b.z-a.z,distance=Math.hypot(dx,dz);
  if(distance>=diameter||distance===0)return false;
  const nx=dx/distance,nz=dz/distance;
  const closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
  if(closing<=0)return false;
  const impulse=.9*closing, separation=(diameter-distance)/2;
  a.vx-=nx*impulse;a.vz-=nz*impulse;
  b.vx+=nx*impulse;b.vz+=nz*impulse;
  a.x-=nx*separation;a.z-=nz*separation;
  b.x+=nx*separation;b.z+=nz*separation;
  return true;
}

// Forecast the whole table together. A new shot can replace the remaining
// paths, including the path of a ball that has not yet been hit.
export function simulateBalls(course,inputs,startSeconds=0){
  const scale=course.scale??1, radius=RADIUS*scale, diameter=2*radius;
  const borders=courseBorders(course.width??WIDTH,course.depth??DEPTH);
  const rails=[
    ...borders.map(wall=>[wall,radius,.77]),
    ...course.walls.map(wall=>[wall,radius+.12*scale,.77]),
    ...(course.bumpers??[]).map(([x,z,r])=>[{x,z,toX:x,toZ:z},r+radius,.94])
  ];
  const balls=inputs.map(({position:[x,z],velocity:[vx,vz],returnTo})=>({
    x,z,vx,vz,returnTo,samples:[[x,z]],first:vx||vz?0:null,last:0,sunk:false,penalty:false
  }));
  const pairs=[];
  for(const [index,a] of balls.entries())for(const b of balls.slice(index+1)){
    // At the tee all balls start on the same spot and separate freely.
    pairs.push({a,b,clear:Math.hypot(b.x-a.x,b.z-a.z)>=diameter});
  }
  const moving=ball=>!ball.sunk&&!ball.penalty&&(ball.vx!==0||ball.vz!==0);
  const [cupX,cupZ]=course.cup;
  for(let step=1;step<=MAX_STEP&&balls.some(moving);step++){
    const rotors=course.rotor||course.rotors?.length ? rotorWalls(course,startSeconds+step*STEP) : [];
    const bounce=ball=>{
      for(const rail of rails)rebound(ball,...rail);
      for(const rotor of rotors)rebound(ball,rotor,radius+.19*scale,.86);
    };
    for(const ball of balls){
      ball.previousX=ball.x;ball.previousZ=ball.z;ball.hit=false;
      if(!moving(ball))continue;
      ball.x+=ball.vx*STEP;ball.z+=ball.vz*STEP;
      bounce(ball);
    }
    for(const pair of pairs){
      const {a,b}=pair;
      if(a.sunk||a.penalty||b.sunk||b.penalty||(!moving(a)&&!moving(b)))continue;
      if(!pair.clear){
        pair.clear=Math.hypot(b.x-a.x,b.z-a.z)>=diameter;
      }else if(collideBalls(a,b,diameter)){
        a.hit=b.hit=true;
      }
    }
    for(const ball of balls){
      if(moving(ball)||ball.hit){
        if(ball.hit)bounce(ball);
        ball.first??=step;
        ball.last=step;
        const speed=Math.hypot(ball.vx,ball.vz),dx=ball.x-ball.previousX,dz=ball.z-ball.previousZ;
        const travel=dx*dx+dz*dz;
        const across=travel?clamp(((cupX-ball.previousX)*dx+(cupZ-ball.previousZ)*dz)/travel,0,1):0;
        const distance=Math.hypot(ball.previousX+dx*across-cupX,ball.previousZ+dz*across-cupZ);
        // Slow putts can catch the lip. Fast ones need to cross closer to the centre.
        const capture=CUP*scale*(1-.62*clamp((speed/scale-4)/14,0,1));
        if(distance<=capture){
          [ball.x,ball.z]=course.cup;ball.sunk=true;
        }else if(course.water?.some(r=>inside(r,ball.x,ball.z))){
          ball.penalty=true;
        }else{
          const drag=surfaceDrag(course,ball.x,ball.z);
          const factor=speed>=.075*scale ? Math.max(0,1-drag*scale*STEP/speed) : 0;
          ball.vx*=factor;ball.vz*=factor;
        }
      }
      if(step%5===0&&!ball.sunk&&!ball.penalty)ball.samples.push([ball.x,ball.z]);
    }
  }
  return balls.map(ball=>{
    if(!ball.last)return null;
    const final=[ball.x,ball.z],samples=ball.samples.slice(0,Math.ceil(ball.last/5));
    samples.push(final);
    return {end:ball.penalty?ball.returnTo:final,samples,duration:ball.last*10,
      sunk:ball.sunk,penalty:ball.penalty,first:ball.first*10};
  });
}

export function simulateShot(course,x,z,angle,power,startSeconds=0){
  const position=[x,z],velocity=shotVelocity(course,angle,power);
  const [shot]=simulateBalls(course,[{position,velocity,returnTo:position}],startSeconds);
  if(!shot)return {end:position,samples:[position,position],duration:10,sunk:false,penalty:false};
  const {end,samples,duration,sunk,penalty}=shot;
  return {end,samples,duration,sunk,penalty};
}
