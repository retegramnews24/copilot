import { WIDTH, DEPTH, RADIUS, CUP, rotorWall } from './courses.js';

const STEP = 1 / 100, MAX_STEP = 900;
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
const inside = (r,x,z) => x>r.x && x<r.x+r.w && z>r.z && z<r.z+r.h;
const borders = [
  {x:0,z:0,toX:WIDTH,toZ:0}, {x:WIDTH,z:0,toX:WIDTH,toZ:DEPTH},
  {x:WIDTH,z:DEPTH,toX:0,toZ:DEPTH}, {x:0,z:DEPTH,toX:0,toZ:0}
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
  const initialSpeed=1.7+power*18, ball={x,z,vx:Math.cos(angle)*initialSpeed,vz:Math.sin(angle)*initialSpeed};
  const samples=[[x,z]], walls=[...borders,...course.walls], from=[x,z];
  let sunk=false, penalty=false, step=0;
  for(;step<MAX_STEP;){
    step++;
    ball.x+=ball.vx*STEP;ball.z+=ball.vz*STEP;
    for(const rail of walls)rebound(ball,rail,RADIUS+(borders.includes(rail)?0:.12),.77);
    for(const [bx,bz,r] of course.bumpers||[])rebound(ball,{x:bx,z:bz,toX:bx,toZ:bz},r+RADIUS,.94);
    const rotor=rotorWall(course,startSeconds+step*STEP);
    if(rotor)rebound(ball,rotor,RADIUS+.19,.86);
    const speed=Math.hypot(ball.vx,ball.vz), distance=Math.hypot(ball.x-course.cup[0],ball.z-course.cup[1]);
    if(distance<CUP*.84 && speed<5.9){[ball.x,ball.z]=course.cup;sunk=true;break}
    if(course.water?.some(r=>inside(r,ball.x,ball.z))){penalty=true;break}
    if(step%5===0)samples.push([ball.x,ball.z]);
    const drag=course.rough?.some(r=>inside(r,ball.x,ball.z)) ? 5.1 : 2.25;
    const factor=speed ? Math.max(0,1-drag*STEP/speed) : 0;
    ball.vx*=factor;ball.vz*=factor;
    if(speed<.075)break;
  }
  samples.push([ball.x,ball.z]);
  const end=penalty ? from : [ball.x,ball.z];
  return {end,samples,duration:step*10,sunk,penalty};
}
