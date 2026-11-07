import { WIDTH, DEPTH, RADIUS, CUP, ballColors, rotorWalls } from './courses.js?v=9';

import { estimateRoll } from './physics.js?v=9';
import { rotateVector } from './roll.js';

const NEAR=.35, ORBIT_DISTANCE=Math.hypot(7.3,2.95), ORBIT_OFFSET=Math.atan2(2.95,7.3)-.18;
// Sky, horizon, terrain, fairway stripes and the signature scenery for each hole.
const THEMES=[
  ['#68b6db','#ffe2bd','#3d7754','#6db461','#7cc46c','park'],
  ['#78b6d7','#ffd3bc','#866e71','#55a68e','#68baa0','coral'],
  ['#4d9fd0','#c6e8f5','#356c7a','#4a9c89','#5caf9b','crystal'],
  ['#372557','#d986ad','#332946','#65488c','#7756a4','lantern'],
  ['#ad6176','#ffd796','#846b4e','#a89354','#bba664','autumn'],
  ['#55b4d7','#fff0c9','#c7a778','#71a761','#83b96e','palm'],
  ['#6693c1','#f6d8ec','#536886','#5c9c98','#70b0ae','crystal'],
  ['#292650','#db72b1','#393359','#426f76','#50868b','lantern'],
  ['#716dc4','#ffc8be','#5e657a','#688f72','#78a580','park']
];
const PARADE=['#ef6a91','#ffad66','#fce081','#70d2a7','#70b7f0','#bb96ed'];
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
// Keep the generated world-space scenery for the life of each layout.
const sceneryCache=new WeakMap();
function sceneryFor(course,width,depth,scale){
  const previous=sceneryCache.get(course);
  if(previous)return previous;
  let seed=course.sceneSeed??(19+(course.theme??0)*23);
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const plants=Array.from({length:28},(_,i)=>{
    const t=(Math.floor(i/4)+.25+random()*.5)/7;
    const edge=(1.7+random()*4.6)*scale;
    const side=i%4;
    const x=side<2?t*width:side===2?-edge:width+edge;
    const z=side>=2?t*depth:side===0?-edge:depth+edge;
    return {x,z,height:(.85+random()*1.3)*scale,hue:Math.floor(random()*PARADE.length)};
  });
  const grass=Array.from({length:38},(_,i)=>{
    const x=(.06+random()*.88)*width,z=(.03+random()*.94)*depth,r=(.13+random()*.25)*scale;
    return {mesh:circle(x,z,r,.006,6),color:i%3===0?'#f9f6b019':'#204d381c'};
  });
  const clouds=Array.from({length:7},(_,i)=>({angle:(i+random()*.6)*Math.PI*2/7,
    height:.055+random()*.17,radius:.025+random()*.045}));
  const scene={plants,grass,clouds};
  sceneryCache.set(course,scene);
  return scene;
}

function viewFor(width,height,{x,z,yaw,pitch,zoom}){
  const fx=Math.cos(yaw),fz=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const tilt=pitch+ORBIT_OFFSET, along=Math.cos(tilt), above=Math.sin(tilt);
  const distance=ORBIT_DISTANCE*zoom;
  const eyeX=x-fx*distance*along,eyeZ=z-fz*distance*along,eyeY=distance*above;
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

function backdrop(ctx,w,h,horizon,yaw,skyTop,skyLight,accent,clouds){
  const sky=ctx.createLinearGradient(0,0,0,Math.max(1,horizon+26));
  sky.addColorStop(0,skyTop);sky.addColorStop(1,skyLight);
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const sunX=w*(.5+.34*Math.sin(yaw-.9)),sunY=horizon-h*.13;
  ctx.fillStyle=skyLight;ctx.beginPath();ctx.arc(sunX,sunY,Math.min(w,h)*.049,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=skyLight+'48';
  for(const cloud of clouds){
    const angle=Math.atan2(Math.sin(cloud.angle-yaw),Math.cos(cloud.angle-yaw));
    if(Math.abs(angle)>1)continue;
    const x=w*(.5+.65*angle),y=horizon-h*cloud.height,r=Math.min(w,h)*cloud.radius;
    ctx.beginPath();ctx.ellipse(x,y,r*1.75,r*.3,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(x-r*.38,y-r*.16,r*.9,r*.32,0,0,Math.PI*2);ctx.fill();
  }
  const colors=[accent+'4f',accent+'79',accent+'b0'];
  for(let layer=0;layer<3;layer++){
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
  const [a,b,c]=course.colors;
  const [skyTop,skyLight,land,darkTurf,lightTurf,prop]=THEMES[course.theme??0];
  const scene=sceneryFor(course,width,depth,scale);
  backdrop(ctx,w,h,view.horizon,camera.yaw,skyTop,skyLight,land,scene.clouds);
  area(-90,-90,width+180,depth+180,-.34,land);
  area(-1.4,-1.4,width+2.8,depth+2.8,-.02,prop==='lantern'?c:'#d9ba8b');
  for(let x=0;x<width;x+=2*scale){
    const stripe=Math.round(x/(2*scale));
    area(x,0,Math.min(2*scale,width-x)+.015,depth,0,stripe%2?darkTurf:lightTurf);
  }
  for(const fleck of scene.grass)poly(fleck.mesh,fleck.color);
  area(0,0,width,.28*scale,.009,darkTurf);
  area(0,depth-.28*scale,width,.28*scale,.009,darkTurf);
  for(const r of course.rough||[]){
    area(r.x,r.z,r.w,r.h,.012,'#9d795a');
    area(r.x+.09,r.z+.09,r.w-.18,r.h-.18,.014,'#c59965');
    for(let i=.45;i<r.h-.3;i+=.64)area(r.x+.15,r.z+i,r.w-.3,.075,.017,'#e1b484');
  }
  for(const r of course.water||[]){
    area(r.x,r.z,r.w,r.h,.012,prop==='lantern'?'#3c477a':'#27768a');
    area(r.x+.09,r.z+.09,r.w-.18,r.h-.18,.014,prop==='lantern'?'#7657af':'#3796ad');
    for(let i=.28;i<r.h-.28;i+=.52){
      const ripple=.23*Math.sin(i*3+seconds*2);
      area(r.x+.36+ripple,r.z+i,r.w*.63,.06,.018,'#97e6e6');
    }
  }
  for(const r of course.bridges||[]){
    area(r.x,r.z,r.w,r.h,.021,'#b67f59');
    for(let offset=.38;offset<r.w;offset+=.55){
      area(r.x+offset,r.z,.044,r.h,.025,'#68493f');
    }
    area(r.x,r.z,r.w,.14,.027,'#e2bf8c');
    area(r.x,r.z+r.h-.14,r.w,.14,.027,'#e2bf8c');
  }
  const [tx,tz]=course.tee;
  poly(circle(tx,tz,.92*scale,.022),darkTurf);
  poly(circle(tx,tz,.61*scale,.023),'#faf3c649');
  for(const side of [-1,1])area(tx-.63*scale,tz+side*.72*scale,.34*scale,.082*scale,.025,'#fff5d1');
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
  for(const [x,z,toX,toZ] of [[0,0,width,0],[width,0,width,depth],[width,depth,0,depth],[0,depth,0,0]]){
    rail({x,z,toX,toZ},.09*scale,.26*scale,prop==='park'?'#e7c69a':a,prop==='park'?'#99664b':c);
  }
  for(const wall of course.walls)rail(wall,.12*scale,.68*scale,a,c);
  for(const rotor of rotorWalls(course,seconds)){
    rail(rotor,.19*scale,.47*scale,'#f8c877','#ab5362');
    const x=(rotor.x+rotor.toX)/2,z=(rotor.z+rotor.toZ)/2;
    queue(x,z,()=>poly(circle(x,z,.17*scale,.49*scale),'#fff3bf'));
  }
  for(const [x,z,r] of course.bumpers||[])queue(x,z,()=>{
    const lower=circle(x,z,r),upper=circle(x,z,r,.35*scale);
    for(let i=0;i<lower.length;i++){
      const next=(i+1)%lower.length;
      poly([lower[i],lower[next],upper[next],upper[i]],c);
    }
    poly(circle(x,z,r,.35*scale),prop==='lantern'?'#ef7fa7':a);
    poly(circle(x,z,r*.72,.355*scale),b);
    poly(circle(x,z,r*.35,.36*scale),'#ffd2ac');
  });
  for(const [i,{x,z,height,hue}] of scene.plants.entries()){
    queue(x,z,()=>{
      const p=view.point([x,z,-.29]);
      if(!p||p.x<-120||p.x>w+120||p.y<0||p.y>h+120)return;
      const size=Math.min(104,p.size*height);
      const pigment=PARADE[hue];
      ctx.fillStyle='#14232130';ctx.beginPath();ctx.ellipse(p.x,p.y,size*.49,size*.12,0,0,Math.PI*2);ctx.fill();
      const shape=(points,color)=>{
        ctx.beginPath();ctx.moveTo(p.x+points[0][0]*size,p.y+points[0][1]*size);
        for(const [x,y] of points.slice(1))ctx.lineTo(p.x+x*size,p.y+y*size);
        ctx.closePath();ctx.fillStyle=color;ctx.fill();
      };
      if(prop==='lantern'||prop==='park'&&i%3===0){
        ctx.fillStyle=c;ctx.fillRect(p.x-size*.06,p.y-size*1.26,size*.12,size*1.26);
        if(prop==='lantern'){
          ctx.fillStyle=pigment+'42';ctx.beginPath();ctx.arc(p.x,p.y-size*1.27,size*.37,0,Math.PI*2);ctx.fill();
          shape([[-.17,-1.41],[.17,-1.41],[.13,-1.1],[-.13,-1.1]],pigment);
        }else shape([[0,-1.43],[.6,-1.3],[0,-1.03]],pigment);
      }else if(prop==='coral'||prop==='crystal'){
        shape([[-.48,0],[-.38,-.71],[.08,-1.18],[.48,-.63],[.58,0]],prop==='coral'?pigment:a);
        shape([[.08,-1.18],[.48,-.63],[.58,0],[.12,0]],b);
      }else{
        ctx.fillStyle='#705a48';ctx.fillRect(p.x-size*.07,p.y-size*.85,size*.14,size*.85);
        if(prop==='palm'){
          for(const direction of [-1,1]){
            shape([[0,-.89],[direction*.31,-1.12],[direction*.74,-.98],[direction*.96,-.68],
              [direction*.54,-.83],[direction*.28,-.77]],i%2?darkTurf:lightTurf);
          }
        }else{
          ctx.fillStyle=prop==='autumn'?pigment:i%2?'#39685b':'#467b65';
          ctx.beginPath();ctx.arc(p.x,p.y-size*.94,size*.42,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#e3f6bd32';ctx.beginPath();ctx.arc(p.x-size*.13,p.y-size*1.08,size*.25,0,Math.PI*2);ctx.fill();
        }
      }
    });
  }
  const [hx,hz]=course.cup;
  poly(circle(hx,hz,cup*1.55,.019),'#25443135');
  poly(circle(hx,hz,cup*1.17,.02),'#d2dca5');
  poly(circle(hx,hz,cup,.027),'#203332');
  queue(hx,hz,()=>{
    const height=2.25*scale, flag=(.83+Math.sin(seconds*3)*.11)*scale;
    const flagX=hx-Math.sin(camera.yaw)*flag,flagZ=hz+Math.cos(camera.yaw)*flag;
    poly([[hx-.022,hz,.02],[hx+.022,hz,.02],[hx+.022,hz,height],[hx-.022,hz,height]],'#fff3d1');
    poly([[hx,hz-.022,.02],[hx,hz+.022,.02],[hx,hz+.022,height],[hx,hz-.022,height]],'#fff3d1');
    poly([[hx,hz,height],[flagX,flagZ,height-.19*scale],[hx,hz,height-.56*scale]],PARADE[course.theme%PARADE.length]??'#f86489');
  });
  const own=balls.find(p=>p.id===self);
  if(available&&own){
    const dx=Math.cos(angle),dz=Math.sin(angle);
    const stop=estimateRoll(course,own.x,own.z,power);
    const guide=Math.min(stop,7*scale);
    const marker=distance=>{
      const x=own.x+dx*distance,z=own.z+dz*distance;
      return x>0&&x<width&&z>0&&z<depth ? [x,z] : null;
    };
    for(let distance=.36*scale;distance<7*scale;distance+=.36*scale){
      const p=marker(distance);
      if(!p)break;
      const charged=distance<=guide;
      poly(circle(...p,(charged ? .048 : .031)*scale,.029,8),charged?'#ffe199':'#f7f6e07a');
    }
    if(stop<=7*scale){
      const p=marker(stop);
      if(p)poly(circle(...p,.079*scale,.031,12),'#fff1b8');
    }
  }
  for(const ball of balls)queue(ball.x,ball.z,()=>{
    const p=view.point([ball.x,ball.z,radius*(1-2*ball.sink)]);
    if(!p||p.x<-48||p.x>w+48||p.y<0||p.y>h+48)return;
    const r=clamp(radius*p.size,3,Math.min(104,Math.max(3,Math.min(w,h)*.2)))*(1-ball.sink*.88);
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
