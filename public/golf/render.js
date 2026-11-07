import { WIDTH, DEPTH, RADIUS, CUP, ballColors, rotorWall } from './courses.js?v=3';

import { rotateVector } from './roll.js';

const NEAR=.35, ORBIT_DISTANCE=Math.hypot(7.3,2.95), ORBIT_OFFSET=Math.atan2(2.95,7.3)-.18;
const DIMPLES=Array.from({length:56},(_,i)=>{
  const y=1-(2*i+1)/56, ring=Math.sqrt(1-y*y), a=i*Math.PI*(3-Math.sqrt(5));
  return [ring*Math.cos(a),y,ring*Math.sin(a)];
});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const quad=(x,z,w,d,y=0)=>[[x,z,y],[x+w,z,y],[x+w,z+d,y],[x,z+d,y]];
const circle=(x,z,r,y=0,segments=24)=>Array.from({length:segments},(_,i)=>{
  const a=i*Math.PI*2/segments;
  return [x+Math.cos(a)*r,z+Math.sin(a)*r,y];
});
export function aimDirection(yaw,dx,dy){
  const forward=-dy*2, side=dx;
  return Math.atan2(Math.sin(yaw)*forward+Math.cos(yaw)*side,Math.cos(yaw)*forward-Math.sin(yaw)*side);
}

function viewFor(width,height,{x,z,yaw,pitch}){
  const fx=Math.cos(yaw),fz=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const tilt=pitch+ORBIT_OFFSET, along=Math.cos(tilt), above=Math.sin(tilt);
  const eyeX=x-fx*ORBIT_DISTANCE*along,eyeZ=z-fz*ORBIT_DISTANCE*along,eyeY=ORBIT_DISTANCE*above;
  const focal=Math.min(height*.96,width*1.3), centerY=height*.43;
  const transform=([x,z,y])=>{
    const dx=x-eyeX,dz=z-eyeZ,dy=y-eyeY,forward=dx*fx+dz*fz;
    return [dz*fx-dx*fz,dy*cp+forward*sp,forward*cp-dy*sp];
  };
  const project=([x,y,d])=>{
    const size=focal/d;
    return {x:width/2+x*size,y:centerY-y*size,size,d};
  };
  const point=world=>{
    const camera=transform(world);
    return camera[2]>=NEAR ? project(camera) : null;
  };
  const polygon=world=>{
    const vertices=world.map(transform), clipped=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length];
      if(a[2]>=NEAR)clipped.push(a);
      if((a[2]>=NEAR)===(b[2]>=NEAR))continue;
      const t=(NEAR-a[2])/(b[2]-a[2]);
      clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,NEAR]);
    }
    return clipped.map(project);
  };
  const ballVector=([x,y,z])=>{
    const forward=x*fx+z*fz;
    return [z*fx-x*fz,-(y*along+forward*above),y*above-forward*along];
  };
  return {point,polygon,ballVector,horizon:centerY-focal*sp/cp,depth:world=>transform(world)[2]};
}

function backdrop(ctx,w,h,horizon,yaw){
  const sky=ctx.createLinearGradient(0,0,0,Math.max(1,horizon+26));
  sky.addColorStop(0,'#6ca7cb');sky.addColorStop(1,'#f6daba');
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  for(let layer=0;layer<3;layer++){
    const colors=['#8caeb1','#699490','#547b72'];
    ctx.beginPath();ctx.moveTo(0,horizon+30);
    for(let x=0;x<w+19;x+=18){
      const angle=(x-w/2)/w*1.2+yaw;
      const hill=Math.sin(angle*(5+layer*2)+layer)*.55+Math.cos(angle*13-layer)*.23;
      ctx.lineTo(x,horizon+layer*4-16*hill-7);
    }
    ctx.lineTo(w,horizon+45);ctx.lineTo(0,horizon+45);ctx.closePath();
    ctx.fillStyle=colors[layer];ctx.fill();
  }
}

function paintBall(ctx,p,r,palette,own,rotation,view){
  const {x,y}=p;
  const vector=local=>view.ballVector(rotateVector(rotation,local));
  const [poleX,poleY,poleDepth]=vector([0,1,0]);
  const cap=clamp(poleDepth,-1,1);
  ctx.save();
  ctx.fillStyle=palette[0];ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=palette[1];ctx.fillRect(x-r,y-r,2*r,2*r);
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(poleY,poleX));
  // In the image plane the sphere's equator projects to half an ellipse.
  ctx.beginPath();ctx.moveTo(0,-r);
  for(let i=1;i<24;i++){
    const angle=i*Math.PI/24;
    ctx.lineTo(-cap*r*Math.sin(angle),-r*Math.cos(angle));
  }
  ctx.lineTo(0,r);ctx.lineTo(r,r);ctx.lineTo(r,-r);ctx.closePath();
  ctx.fillStyle=palette[0];ctx.fill();ctx.restore();
  const lighting=ctx.createRadialGradient(x-r*.35,y-r*.42,0,x-r*.12,y-r*.16,r*1.25);
  lighting.addColorStop(0,'#ffffffdf');lighting.addColorStop(.36,'#ffffff24');lighting.addColorStop(.67,'#080f1b00');lighting.addColorStop(1,'#080f1bcc');
  ctx.fillStyle=lighting;ctx.fillRect(x-r,y-r,2*r,2*r);
  if(r>6){
    ctx.fillStyle='#101a302c';
    for(const dimple of DIMPLES){
      const [dx,dy,front]=vector(dimple);
      if(front<.17)continue;
      ctx.beginPath();ctx.arc(x+dx*r,y+dy*r,r*(.032+.038*front),0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.strokeStyle=own?'#fff8de':'#ffffffa8';ctx.lineWidth=own?1.5:1;ctx.stroke();
}

export function drawCourse(ctx,w,h,course,balls,self,available,angle,power,seconds,camera){
  const view=viewFor(w,h,camera), scale=course.scale??1, width=course.width??WIDTH, depth=course.depth??DEPTH;
  const radius=RADIUS*scale, cup=CUP*scale, surfaces=[], labels=[];
  const poly=(world,color)=>{
    const points=view.polygon(world);
    if(points.length<3||points.every(p=>p.x<0)||points.every(p=>p.x>w)||points.every(p=>p.y<0)||points.every(p=>p.y>h))return;
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(const p of points.slice(1))ctx.lineTo(p.x,p.y);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const queue=(x,z,draw)=>surfaces.push({d:view.depth([x,z,0]),draw});
  const area=(x,z,w,d,y,color)=>poly(quad(x,z,w,d,y),color);
  backdrop(ctx,w,h,view.horizon,camera.yaw);
  area(-90,-90,width+180,depth+180,-.34,'#527d5c');
  area(-1.4,-1.4,width+2.8,depth+2.8,-.02,'#d9ba8b');
  for(let x=0;x<width;x+=2*scale){
    const stripe=Math.round(x/(2*scale));
    area(x,0,Math.min(2*scale,width-x)+.015,depth,0,stripe%2?'#66a455':'#73b35c');
  }
  for(const r of course.rough||[]){
    area(r.x,r.z,r.w,r.h,.012,'#c59965');
    for(let i=.45;i<r.h-.3;i+=.64)area(r.x+.15,r.z+i,r.w-.3,.075,.017,'#e1b484');
  }
  for(const r of course.water||[]){
    area(r.x,r.z,r.w,r.h,.012,'#3796ad');
    for(let i=.28;i<r.h-.28;i+=.52){
      const ripple=.23*Math.sin(i*3+seconds*2);
      area(r.x+.36+ripple,r.z+i,r.w*.63,.06,.018,'#97e6e6');
    }
  }
  const rail=(wall,half,height,top,side)=>{
    const {x,z,toX,toZ}=wall,length=Math.hypot(toX-x,toZ-z);
    if(!length)return;
    const dx=(toX-x)/length,dz=(toZ-z)/length;
    const corners=[[x-dz*half,z+dx*half],[toX-dz*half,toZ+dx*half],[toX+dz*half,toZ-dx*half],[x+dz*half,z-dx*half]];
    // Draw long rails in sections so nearby balls can pass in front of the far end.
    const sections=Math.ceil(length/2.5);
    for(let i=0;i<sections;i++){
      const along=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      const ring=[along(corners[0],corners[1],i/sections),along(corners[0],corners[1],(i+1)/sections),
        along(corners[3],corners[2],(i+1)/sections),along(corners[3],corners[2],i/sections)];
      const upper=ring.map(([x,z])=>[x,z,height]);
      queue((ring[0][0]+ring[2][0])/2,(ring[0][1]+ring[2][1])/2,()=>{
        for(let n=0;n<4;n++){
          if(n===1&&i!==sections-1||n===3&&i!==0)continue;
          const next=(n+1)%4;
          poly([[...ring[n],0],[...ring[next],0],upper[next],upper[n]],side);
        }
        poly(upper,top);
      });
    }
  };
  const [a,,c]=course.colors;
  for(const [x,z,toX,toZ] of [[0,0,width,0],[width,0,width,depth],[width,depth,0,depth],[0,depth,0,0]]){
    rail({x,z,toX,toZ},.09*scale,.26*scale,'#e7c69a','#99664b');
  }
  for(const wall of course.walls)rail(wall,.12*scale,.68*scale,a,c);
  const rotor=rotorWall(course,seconds);
  if(rotor)rail(rotor,.19*scale,.47*scale,'#f8c877','#ab5362');
  for(const [x,z,r] of course.bumpers||[])queue(x,z,()=>{
    const lower=circle(x,z,r),upper=circle(x,z,r,.35*scale);
    for(let i=0;i<lower.length;i++){
      const next=(i+1)%lower.length;
      poly([lower[i],lower[next],upper[next],upper[i]],'#773b68');
    }
    poly(circle(x,z,r,.35*scale),'#ef7fa7');
    poly(circle(x,z,r*.72,.355*scale),'#ac507d');
    poly(circle(x,z,r*.35,.36*scale),'#ffd2ac');
  });
  for(let i=0;i<9;i++){
    const x=3+i*(width-6)/8, z=i%2?depth+3.8:-4.8;
    queue(x,z,()=>{
      const p=view.point([x,z,-.29]);
      if(!p||p.x<-120||p.x>w+120||p.y<0||p.y>h+120)return;
      const size=p.size*(1.6+i%3*.32);
      ctx.fillStyle='#705a48';ctx.fillRect(p.x-size*.09,p.y-size*.52,size*.18,size*.52);
      ctx.beginPath();ctx.moveTo(p.x,p.y-size*1.48);ctx.lineTo(p.x-size*.52,p.y-size*.39);ctx.lineTo(p.x+size*.52,p.y-size*.39);ctx.closePath();
      ctx.fillStyle=i%2?'#39685b':'#467b65';ctx.fill();
    });
  }
  const [hx,hz]=course.cup;
  poly(circle(hx,hz,cup*1.17,.02),'#b7d29a');
  poly(circle(hx,hz,cup,.027),'#203332');
  queue(hx,hz,()=>{
    const height=2.25*scale, flag=(.83+Math.sin(seconds*3)*.11)*scale;
    const flagX=hx-Math.sin(camera.yaw)*flag,flagZ=hz+Math.cos(camera.yaw)*flag;
    poly([[hx-.022,hz,.02],[hx+.022,hz,.02],[hx+.022,hz,height],[hx-.022,hz,height]],'#fff3d1');
    poly([[hx,hz-.022,.02],[hx,hz+.022,.02],[hx,hz+.022,height],[hx,hz-.022,height]],'#fff3d1');
    poly([[hx,hz,height],[flagX,flagZ,height-.19*scale],[hx,hz,height-.56*scale]],'#f86489');
  });
  const own=balls.find(p=>p.id===self);
  if(available&&own){
    for(let i=1;i<=5+Math.round(power*12);i++){
      const step=(.42+i*.38)*scale;
      const x=own.x+Math.cos(angle)*step,z=own.z+Math.sin(angle)*step;
      if(x<=0||x>=width||z<=0||z>=depth)break;
      poly(circle(x,z,.048*scale,.026,8),i%3?'#fff5cf':'#ffcd79');
    }
  }
  for(const ball of balls)queue(ball.x,ball.z,()=>{
    const p=view.point([ball.x,ball.z,radius*(1-2*ball.sink)]);
    if(!p||p.x<-48||p.x>w+48||p.y<0||p.y>h+48)return;
    const r=clamp(radius*p.size,3,34)*(1-ball.sink*.88);
    const palette=ballColors(ball.appearance,ball.color);
    poly(circle(ball.x,ball.z,radius*1.25,.032,12),'#1c35296b');
    paintBall(ctx,p,r,palette,ball.id===self,ball.rotation,view);
    if(ball.id!==self&&!ball.sink)labels.push({p,r,name:ball.name,color:palette[0]});
  });
  surfaces.sort((a,b)=>b.d-a.d).forEach(({draw})=>draw());
  ctx.font='600 11px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';
  const occupied=[];
  for(const {p,r,name,color} of labels){
    const label=name.length>16?name.slice(0,15)+'…':name;
    const width=ctx.measureText(label).width+22;
    const x=clamp(p.x-width/2,3,w-width-3);
    let y=clamp(p.y-r-21,3,h-21);
    while(y>3&&occupied.some(other=>Math.abs(y-other.y)<19&&x<other.x+other.width&&x+width>other.x))y-=19;
    y=Math.max(3,y);occupied.push({x,y,width});
    ctx.fillStyle='#142630e8';ctx.fillRect(x,y,width,17);
    ctx.fillStyle=color;ctx.fillRect(x+5,y+6,5,5);
    ctx.fillStyle='#fff7ed';ctx.fillText(label,x+15,y+8.5);
  }
}
