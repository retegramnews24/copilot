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

export function simulateShot(course, x, z, angle, power, startSeconds=0) {
  const scale=course.scale ?? 1, borders=courseBorders(course.width ?? WIDTH,course.depth ?? DEPTH);
  const initialSpeed=launchSpeed(power)*scale, ball={x,z,vx:Math.cos(angle)*initialSpeed,vz:Math.sin(angle)*initialSpeed};
  const samples=[[x,z]], walls=[...borders,...course.walls], from=[x,z];
  let sunk=false, penalty=false, step=0;
  for(;step<MAX_STEP;){
    step++;
    const previousX=ball.x, previousZ=ball.z;
    ball.x+=ball.vx*STEP;ball.z+=ball.vz*STEP;
    for(const rail of walls)rebound(ball,rail,(RADIUS+(borders.includes(rail)?0:.12))*scale,.77);
    for(const [bx,bz,r] of course.bumpers||[])rebound(ball,{x:bx,z:bz,toX:bx,toZ:bz},r+RADIUS*scale,.94);
    if(course.rotor||course.rotors?.length){
      for(const rotor of rotorWalls(course,startSeconds+step*STEP))rebound(ball,rotor,(RADIUS+.19)*scale,.86);
    }
    const speed=Math.hypot(ball.vx,ball.vz), dx=ball.x-previousX, dz=ball.z-previousZ;
    const [cupX,cupZ]=course.cup, travel=dx*dx+dz*dz;
    const across=travel?clamp(((cupX-previousX)*dx+(cupZ-previousZ)*dz)/travel,0,1):0;
    const distance=Math.hypot(previousX+dx*across-cupX,previousZ+dz*across-cupZ);
    // A fast putt must cross closer to the centre, while a slow one can catch the lip.
    const capture=CUP*scale*(1-.62*clamp((speed/scale-4)/14,0,1));
    if(distance<=capture){[ball.x,ball.z]=course.cup;sunk=true;break}
    if(course.water?.some(r=>inside(r,ball.x,ball.z))){penalty=true;break}
    if(step%5===0)samples.push([ball.x,ball.z]);
    const drag=surfaceDrag(course,ball.x,ball.z);
    const factor=speed ? Math.max(0,1-drag*scale*STEP/speed) : 0;
    ball.vx*=factor;ball.vz*=factor;
    if(speed<.075*scale)break;
  }
  samples.push([ball.x,ball.z]);
  const end=penalty ? from : [ball.x,ball.z];
  return {end,samples,duration:step*10,sunk,penalty};
}
