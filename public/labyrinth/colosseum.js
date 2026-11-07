import {random} from './core.js';

const TAU=Math.PI*2;
export const STONE_HEIGHT=2.72;
export const ARCADE_TOP=11.7;
export const ARCH_BAYS=32;
export const CROWD_COLORS=['#a94e38','#e1c898','#797448','#b57e4e','#77666b','#ece0bc'];
const ROWS=5;
export function crowdSeats(world){
 const rng=random(world.seed^0xc01055e0),{cx,cz,rx,rz}=world.oval,seats=[];
 for(let row=0;row<ROWS;row++)for(let i=0;i<80;i++){
  if(i%10===0||i%10===9||rng()<.19)continue;
  const angle=(i+.4+(row%2)*.26+rng()*.23)*TAU/80,margin=.65+row*1.09;
  seats.push({x:cx+Math.cos(angle)*(rx+margin),z:cz+Math.sin(angle)*(rz+margin),y:2.46+row*.61,
   width:.28+rng()*.15,height:.58+rng()*.24,color:Math.floor(rng()*CROWD_COLORS.length)});
 }
 return seats;
}

export function colosseumMeshes(world,Geometry){
 const {cx,cz,rx,rz}=world.oval;
 const seats=new Geometry(),stairs=new Geometry(),wall=new Geometry(),cornice=new Geometry();
 const recess=new Geometry(),archStone=new Geometry(),cloth=new Geometry(),gold=new Geometry();
 const point=(a,y,r=0)=>[cx+Math.cos(a)*(rx+r),y,cz+Math.sin(a)*(rz+r)];
 const inward=a=>[-Math.cos(a),0,-Math.sin(a)];
 const ring=(g,inner,outer,y)=>{for(let i=0;i<96;i++){
  const a=i*TAU/96,b=(i+1)*TAU/96;
  g.quad(point(a,y,inner),point(b,y,inner),point(b,y,outer),point(a,y,outer),[0,1,0],[i,0,i+1,1]);
 }};
 const band=(g,r,bottom,top)=>{for(let i=0;i<96;i++){
  const a=i*TAU/96,b=(i+1)*TAU/96;
  g.quad(point(a,bottom,r),point(b,bottom,r),point(b,top,r),point(a,top,r),inward((a+b)/2),[i,0,i+1,1]);
 }};
 for(let row=0;row<ROWS;row++){
  const r=.18+row*1.09,y=2.48+row*.61;
  ring(seats,r,r+1.09,y);
  band(stairs,r,y-.61,y);
 }
 for(const [r,y] of [[-.05,2.43],[5.68,5.62],[5.84,8.76],[5.84,11.52]]){
  band(cornice,r,y-.09,y+.11);ring(cornice,r,r+.2,y+.11);
 }
 band(wall,5.90,4.86,5.65);band(wall,5.92,8.67,8.85);
 for(const y of [5.05,5.35])band(cornice,5.86,y,y+.026);
 // Each bay has a recessed arcade and a ring of separate wedge-shaped stones.
 for(let bay=0;bay<ARCH_BAYS;bay++){
  const angle=(bay+.5)*TAU/ARCH_BAYS,half=TAU/ARCH_BAYS*.5;
  const n=inward(angle),wallR=5.93,opening=half*.62;
  const quad=(g,a,b,y,top,r=wallR)=>g.quad(point(a,y,r),point(b,y,r),point(b,top,r),point(a,top,r),n);
  for(const [base,spring,top] of [[5.62,7.26,8.71],[8.82,10.06,11.53]]){
   const left=angle-opening,right=angle+opening,archRise=.91;
   quad(wall,angle-half,left,base,top);quad(wall,right,angle+half,base,top);
   quad(recess,angle-half,angle+half,base-.04,top+.04,wallR+1.15);
   for(const edge of [left,right]){
    quad(archStone,edge-.004,edge+.004,base,spring,wallR-.05);
    wall.quad(point(edge,base,wallR),point(edge,base,wallR+1.16),point(edge,spring,wallR+1.16),point(edge,spring,wallR),n);
   }
   for(let i=0;i<12;i++){
    const a=Math.PI-i*Math.PI/12,b=Math.PI-(i+1)*Math.PI/12;
    const u=angle+Math.cos(a)*opening,v=angle+Math.cos(b)*opening;
    const ay=spring+Math.sin(a)*archRise,by=spring+Math.sin(b)*archRise;
    wall.quad(point(u,ay,wallR),point(v,by,wallR),point(v,top,wallR),point(u,top,wallR),n);
    const d=.006;
    archStone.quad(point(u,ay,wallR-.07),point(v,by,wallR-.07),
     point(angle+Math.cos(b)*opening*1.18,by+.18,wallR-.07),point(angle+Math.cos(a)*opening*1.18,ay+.18-d,wallR-.07),n);
   }
  }
  if(bay%4===0){
   const a=angle-.024,b=angle+.024,r=5.54;
   quad(cloth,a,b,5.88,8.45,r);
   quad(gold,a,b,7.94,8.05,r-.015);quad(gold,a,b,6.04,6.14,r-.015);
   quad(gold,angle-.009,angle+.009,6.93,7.44,r-.018);
  }
 }
 band(cornice,5.9,11.5,ARCADE_TOP);
 const crowd=Array.from({length:CROWD_COLORS.length},()=>new Geometry()),heads=new Geometry();
 for(const person of crowdSeats(world)){
  const {x,y,z,width,height,color}=person;
  crowd[color].box(x,y,z,width,height,.27);
  heads.sphere(x,y+height,z,.103,.11,.10,3,6);
 }
 return {seats,stairs,wall,cornice,recess,archStone,cloth,gold,crowd,heads};
}

// A reusable cross-section of an arcade bay for the low-cost Canvas renderer.
export function arcadeTile(){
 const cv=document.createElement('canvas');cv.width=128;cv.height=256;
 const c=cv.getContext('2d');
 const stone=c.createLinearGradient(0,0,0,256);
 stone.addColorStop(0,'#e0c7a2');stone.addColorStop(.55,'#af916c');stone.addColorStop(1,'#c9ae89');
 c.fillStyle=stone;c.fillRect(0,0,128,256);
 for(let y=14;y<256;y+=13){
  c.fillStyle='#85684930';c.fillRect(0,y,128,1);
  for(let x=y%2?16:35;x<128;x+=35)c.fillRect(x,y,1,13);
 }
 for(const [top,bottom] of [[13,70],[83,146]]){
  c.fillStyle='#514132';c.beginPath();c.moveTo(27,bottom);c.lineTo(27,top+28);
  c.quadraticCurveTo(27,top,64,top);c.quadraticCurveTo(101,top,101,top+28);
  c.lineTo(101,bottom);c.closePath();c.fill();
  c.strokeStyle='#e0c4a1';c.lineWidth=4;c.stroke();
 }
 for(const y of [3,73,150,171,185,198,211,225,239]){
  c.fillStyle='#755b44';c.fillRect(0,y,128,2);c.fillStyle='#e2c7a3';c.fillRect(0,y-2,128,2);
 }
 return cv;
}
