const canvas=$('view');
// ctx is swapped for the sky image while that is repainted (see atmosphere).
let ctx=canvas.getContext('2d',{alpha:false});
let width=1,height=1,ratio=1,camera,focal,horizon,cy,sy,rollCos=1,rollSin=0;
let quality=1,renderCost=0,qualityChanged=0;
const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)");
let lookYaw=0,lookPitch=0,drag=null,viewBearing=0;
const HALF_TURN=Math.PI/2;
function setLook(yaw,pitch=0){
  lookYaw=clamp(yaw,-HALF_TURN,HALF_TURN);
  lookPitch=clamp(pitch,-.21,.20);
  const deg=Math.round(lookYaw*180/Math.PI);
  const angle=$('view-angle');if(angle)angle.textContent=(deg>0?'+':'')+deg+'°';
  renderDirty=true;
}
$('look-left').onclick=()=>setLook(lookYaw-Math.PI/6,lookPitch);
$('look-right').onclick=()=>setLook(lookYaw+Math.PI/6,lookPitch);
$('look-center').onclick=()=>setLook(0,0);
// One finger (or the mouse) drags the view; two fingers pinch to zoom (field of view); the wheel zooms too.
let zoom=1,pinch=null;
const touches=new Map();
const spread=()=>{const [p,q]=[...touches.values()];return Math.hypot(p.x-q.x,p.y-q.y)||1;};
canvas.addEventListener('pointerdown',event=>{
  touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  canvas.setPointerCapture?.(event.pointerId);
  if(touches.size===2){drag=null;pinch={dist:spread(),zoom};canvas.classList.remove('dragging');return;}
  if(event.button!==0||drag||pinch)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:lookYaw,pitch:lookPitch};
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove',event=>{
  if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinch&&touches.size===2){zoom=clamp(pinch.zoom*spread()/pinch.dist,.75,2.2);renderDirty=true;return;}
  if(drag?.id!==event.pointerId)return;
  setLook(drag.yaw-(event.clientX-drag.x)*Math.PI/Math.max(250,width*.9*zoom),
    drag.pitch+(event.clientY-drag.y)*.75/Math.max(160,height*zoom));
});
canvas.addEventListener('wheel',event=>{
  event.preventDefault();
  zoom=clamp(zoom*Math.exp(-event.deltaY*.0012),.75,2.2);renderDirty=true;
},{passive:false});
function finishLook(event){
  touches.delete(event.pointerId);
  if(touches.size<2)pinch=null;
  if(drag?.id!==event.pointerId)return;
  drag=null;canvas.classList.remove('dragging');
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,finishLook);
function resize(){
  const bounds=canvas.getBoundingClientRect();
  width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
  ratio=Math.min(devicePixelRatio||1,1.6)*quality;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  renderDirty=true;
}
window.addEventListener('resize',resize);
if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);
resize();
const pointSamples=new Map();
function point(s,x=0,y=0){
  let p=pointSamples.get(s);
  if(!p){
    const trackPoint=trackAt(s);
    p={...trackPoint,cos:Math.cos(trackPoint.yaw),sin:Math.sin(trackPoint.yaw)};
    pointSamples.set(s,p);
  }
  return {x:p.x+p.cos*x,y:p.y+y,z:p.z-p.sin*x};
}
function local(p){
  const x=p.x-camera.x,z=p.z-camera.z;
  return {x:x*cy-z*sy,y:p.y-camera.y,z:x*sy+z*cy};
}
function screen(p){
  const x=p.x*focal/p.z,y=-p.y*focal/p.z;
  return [width*.5+x*rollCos-y*rollSin,horizon+x*rollSin+y*rollCos];
}
const NEAR=.5;
function project(p){const v=local(p);return v.z<NEAR?null:[...screen(v),v.z];}
function polygon(vertices,color,joinEdges=false){
  const poly=vertices.map(local), clipped=[];
  let last=poly.at(-1);
  for(const p of poly){
    if((last.z>=NEAR)!==(p.z>=NEAR)){
      const t=(NEAR-last.z)/(p.z-last.z);
      clipped.push({x:blend(last.x,p.x,t),y:blend(last.y,p.y,t),z:NEAR});
    }
    if(p.z>=NEAR)clipped.push(p);
    last=p;
  }
  if(clipped.length<3)return;
  const vertices2=clipped.map(screen);
  if(vertices2.every(([x])=>x<0)||vertices2.every(([x])=>x>width)||
    vertices2.every(([,y])=>y<0)||vertices2.every(([,y])=>y>height))return;
  // Time-of-day tint and haze by distance (average depth of the visible part).
  let depth=0;for(const p of clipped)depth+=p.z;
  color=shade(color,depth/clipped.length);
  ctx.fillStyle=color;ctx.beginPath();
  for(let i=0;i<vertices2.length;i++){
    const [x,y]=vertices2[i];if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
  }
  ctx.closePath();ctx.fill();
  if(joinEdges){ctx.lineWidth=.58;ctx.strokeStyle=color;ctx.stroke();}
}
function strip(a,b,left,right,level,color){
  polygon([point(a,left,level),point(a,right,level),point(b,right,level),point(b,left,level)],color);
}
function beam(a,b,color,pixels=1){
  const p=project(a),q=project(b);
  if(!p||!q)return;
  ctx.strokeStyle=shade(color,(p[2]+q[2])/2);ctx.lineWidth=pixels;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();
}
const TAU=Math.PI*2;
const RIDGE_SAMPLES=256;
const ridgeBank=Array.from({length:4},(_,layer)=>Array.from({length:RIDGE_SAMPLES+1},(_,i)=>{
  const u=(i%RIDGE_SAMPLES)/RIDGE_SAMPLES, a=u*TAU, j=(i%RIDGE_SAMPLES);
  return .22+.20*Math.sin(a*(layer+3)+layer)+.24*Math.abs(Math.sin(a*(layer+6)+2.1))
    +.14*Math.sin(a*(layer+13)+2.6)+.09*Math.abs(Math.cos(a*27+layer))
    +.065*noise(j*5+layer*13)+.045*Math.sin(a*(layer*7+41)+layer)+.03*Math.sin(a*(layer*11+67));
}));
const cloudBank=Array.from({length:19},(_,i)=>({
  a:i*TAU/19+noise(i*19)*.20,y:.085+noise(i*13+20)*.21,
  w:.065+noise(i*5+8)*.19,shape:Array.from({length:7},(_,j)=>.5+noise(i*73+j*11)*.85)
}));
function angleDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function ridgeValue(angle,layer){
  const t=((angle/TAU%1+1)%1)*RIDGE_SAMPLES, i=Math.floor(t);
  return blend(ridgeBank[layer][i],ridgeBank[layer][i+1],t-i);
}
function fillShape(points,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);
  for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
  ctx.closePath();ctx.fill();
}
function cloud(x,y,w,shape,color){
  const points=[[x-w*.54,y]];
  for(let i=0;i<shape.length;i++){
    points.push([x+w*(i/(shape.length-1)-.5),y-w*.078*shape[i]*Math.sin(Math.PI*i/(shape.length-1))]);
  }
  points.push([x+w*.55,y],[x+w*.36,y+w*.024],[x-w*.36,y+w*.03]);
  fillShape(points,color);
}
// Time of day from the Italian clock: dawn, day, sunset, night. Each phase sets sky, sun, light tint and haze.
const PHASES={
  alba:{sky:['#2c3a63','#c48d8f','#ffd0a0'],sun:'#ffd6a6',sunY:.07,tint:'#ffb58f',tintAmount:.12,fog:'#e7c3ae',fogMax:.62,ridge:'#c99a91'},
  giorno:{sky:['#24446f','#6ca8c2','#f8dca7'],sun:'#fff3cc',sunY:.24,tint:'#ffffff',tintAmount:0,fog:'#c9dde0',fogMax:.55,ridge:null},
  tramonto:{sky:['#2a2e5c','#d0705a','#ffc070'],sun:'#ffb066',sunY:.05,tint:'#ff9a5c',tintAmount:.16,fog:'#e2a682',fogMax:.6,ridge:'#b0706a'},
  notte:{sky:['#05070f','#0d1730','#1d2a44'],sun:'#e8ecf5',sunY:.3,tint:'#0b1430',tintAmount:.58,fog:'#141d33',fogMax:.7,ridge:'#1c2840',night:true}
};
function phaseNow(){
  let hour=12;
  try{hour=Number(new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'numeric',hourCycle:'h23'}).format(new Date()));}catch{}
  return hour>=5&&hour<8?'alba':hour>=8&&hour<17?'giorno':hour>=17&&hour<20?'tramonto':'notte';
}
// "Ora reale" follows the clock; the other choices (intro screen) are kept on this device.
let phaseName='giorno',phase=PHASES.giorno;
function setPhase(choice){
  phaseName=choice in PHASES?choice:phaseNow();phase=PHASES[phaseName];
  skyKey='';shadeCache.clear();renderDirty=true;
  for(const b of document.querySelectorAll('[data-daytime]'))b.setAttribute('aria-pressed',String(b.dataset.daytime===choice));
}
for(const b of document.querySelectorAll('[data-daytime]'))b.onclick=()=>{
  try{localStorage.setItem('giulio-daytime',b.dataset.daytime);}catch{}
  setPhase(b.dataset.daytime);
};
// Color mixing with a cache: tint for the time of day plus haze by distance (16 levels), so it costs almost nothing.
const rgbCache=new Map(), shadeCache=new Map(), probe=document.createElement('canvas').getContext('2d');
function rgb(color){
  let v=rgbCache.get(color);
  if(v)return v;
  probe.fillStyle='#000';probe.fillStyle=color;
  const s=probe.fillStyle;
  if(s[0]==='#')v=[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16),1];
  else{const m=s.match(/[\d.]+/g)||[0,0,0,1];v=[+m[0],+m[1],+m[2],m[3]==null?1:+m[3]];}
  rgbCache.set(color,v);return v;
}
function mix(color,target,amount){
  if(amount<=0)return color;
  const c=rgb(color),t=rgb(target),k=1-amount;
  const out=[0,1,2].map(i=>Math.round(c[i]*k+t[i]*amount));
  return c[3]<1?'rgba('+out.join(',')+','+c[3]+')':'rgb('+out.join(',')+')';
}
const FOG_START=110,FOG_END=720;
function shade(color,z){
  const wet=train.weather==='wet';
  const fog=Math.round(clamp((z-(wet?60:FOG_START))/(FOG_END-(wet?60:FOG_START)),0,1)*15);
  const key=color+'|'+fog+'|'+wet;
  let v=shadeCache.get(key);
  if(!v){
    v=mix(color,phase.tint,phase.tintAmount);
    v=mix(v,wet?mix(phase.fog,'#8a9aa0',.4):phase.fog,Math.pow(fog/15,1.25)*(wet?phase.fogMax+.15:phase.fogMax));
    if(shadeCache.size>4000)shadeCache.clear();
    shadeCache.set(key,v);
  }
  return v;
}
// Sky and mountains change little from one frame to the next: they are painted into a slightly larger image and
// only moved, then repainted when the view turns or moves enough (or every 20 s for the clouds).
const skyCanvas=document.createElement('canvas'), skyCtx=skyCanvas.getContext('2d',{alpha:false});
let skyKey='',sky=null,skyMarginX=0,skyMarginY=0,railShine='#d2cec0';
function atmosphere(){
  const drift=(camera.x*.00024+camera.z*.0001)*.18;
  const key=[width,height,ratio,focal,train.weather].join();
  const turned=sky?angleDiff(viewBearing,sky.bearing):9;
  if(key!==skyKey||Math.abs(turned)>.06||Math.abs(drift-sky.drift)>.0015||
    Math.abs(horizon-sky.horizon)>height*.07||Math.abs(camera.y-sky.cameraY)>1.5||train.elapsed-sky.elapsed>20000){
    skyKey=key;skyMarginX=Math.round(width*.09);skyMarginY=Math.round(height*.11);
    const w=Math.round((width+skyMarginX*2)*ratio),h=Math.round((height+skyMarginY*2)*ratio);
    if(skyCanvas.width!==w||skyCanvas.height!==h){skyCanvas.width=w;skyCanvas.height=h;}
    skyCtx.setTransform(ratio,0,0,ratio,skyMarginX*ratio,skyMarginY*ratio);
    const main=ctx;ctx=skyCtx;
    try{paintSky(drift);}finally{ctx=main;}
    sky={bearing:viewBearing,drift,horizon,cameraY:camera.y,elapsed:train.elapsed};
  }
  const dx=-Math.tan(angleDiff(viewBearing,sky.bearing))*focal,dy=horizon-sky.horizon;
  ctx.drawImage(skyCanvas,-skyMarginX+dx,-skyMarginY+dy,width+skyMarginX*2,height+skyMarginY*2);
}
function paintSky(drift){
  const wet=train.weather==='wet', top=Math.max(30,horizon+height*.18);
  const left=-skyMarginX,right=width+skyMarginX,bottom=height+skyMarginY;
  const gradient=ctx.createLinearGradient(0,-skyMarginY,0,top);
  const colors=wet?phase.sky.map(c=>mix(c,'#5d6f78',phase.night?.25:.45)):phase.sky;
  gradient.addColorStop(0,colors[0]);gradient.addColorStop(.55,colors[1]);gradient.addColorStop(1,colors[2]);
  ctx.fillStyle=gradient;ctx.fillRect(left,-skyMarginY,right-left,bottom+skyMarginY);
  // Stars at night (fixed in the sky, they turn with the view).
  if(phase.night&&!wet){
    ctx.fillStyle='#e9eefc';
    for(let i=0;i<140;i++){
      const a=angleDiff(noise(i*3+1)*TAU,viewBearing);
      if(Math.abs(a)>1.25)continue;
      const x=width*.5+Math.tan(a)*focal,y=horizon-height*(.05+noise(i*7+2)*.5),r=noise(i*11+3)>.9?1.4:.8;
      ctx.globalAlpha=.35+noise(i*5+4)*.6;ctx.fillRect(x,y,r,r);
    }
    ctx.globalAlpha=1;
  }
  const sunAngle=angleDiff(.57,viewBearing);
  if(!wet&&Math.abs(sunAngle)<1.28){
    const x=width*.5+Math.tan(sunAngle)*focal,y=horizon-height*phase.sunY;
    const radius=height*(phase.night?.12:.24), glow=ctx.createRadialGradient(x,y,1,x,y,radius);
    glow.addColorStop(0,phase.night?'#dfe6ff40':phase.sun+'ba');glow.addColorStop(1,phase.sun+'00');
    ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    ctx.fillStyle=phase.sun;ctx.beginPath();ctx.arc(x,y,Math.max(5,height*(phase.night?.022:.033)),0,TAU);ctx.fill();
  }
  const cloudShade=c=>mix(c,phase.tint,phase.tintAmount*1.2);
  for(const c of cloudBank){
    const a=angleDiff(c.a+train.elapsed*.000055,viewBearing);
    if(Math.abs(a)>1.25)continue;
    const x=width*.5+Math.tan(a)*focal,y=horizon-height*c.y,w=focal*c.w;
    cloud(x+w*.06,y+w*.017,w,c.shape,cloudShade(wet?'#b7c5c470':'#c8dedba6'));
    cloud(x,y,w,c.shape,cloudShade(wet?'#d7dcda8c':'#fff3d9de'));
  }
  // Rolling hills instead of mountains: three soft layers (farthest blue-grey, nearest green), hilltop villages on
  // the middle range and rows of cypresses on the nearest crest. Painted once with the sky, so they cost nothing per frame.
  const hillColors=wet?['#8d9fa6','#71897f','#587260']:['#a3b6c2','#86a68d','#628f5f'];
  const night=phase.night;
  for(let layer=0;layer<3;layer++){
    const pts=[],step=Math.max(4,Math.round(width/150));
    const ridgeBase=horizon+height*(.012+layer*.017),scale=height*(.10+layer*.038);
    const layerDrift=drift*(layer+1)*1.3;
    for(let x=left-step;x<=right+step;x+=step){
      const angle=viewBearing+Math.atan2(x-width*.5,focal)+layerDrift;
      const v=.52+.24*Math.sin(angle*(2+layer)+layer*1.7)+.14*Math.sin(angle*(5+layer*2)+.6)+.06*Math.sin(angle*(13+layer*3)+layer);
      pts.push([x,ridgeBase-v*scale,angle,v]);
    }
    const color=mix(mix(hillColors[layer],phase.tint,phase.tintAmount),phase.fog,(2-layer)*.2);
    fillShape([[left,bottom],...pts.map(p=>[p[0],p[1]]),[right,bottom]],color);
    // Lit side of each hill: a lighter band on the slopes toward the sun.
    if(!night){
      const light=mix(color,'#fff6dc',wet?.06:.14);
      for(let j=1;j<pts.length-1;j++){
        const [x,y,ang]=pts[j],[nx,ny]=pts[j+1];
        if(Math.cos(angleDiff(ang,.57+Math.PI*.5))>.35&&ny<y)fillShape([[x,y],[nx,ny],[nx,ny+scale*.25],[x,y+scale*.25]],light+'');
      }
    }
    if(layer===1){
      // Small villages on the higher tops: houses with red roofs, lit windows at night.
      for(let j=2;j<pts.length-2;j++){
        const [x,y,ang,v]=pts[j];
        if(v<.86||v<pts[j-1][3]||v<pts[j+1][3]||noise(Math.round(ang*40))<.45)continue;
        for(let h=-2;h<=2;h++){
          const hx=x+h*height*.012,hw=height*(.007+noise(j+h)*.004),hh=height*(.006+noise(j*3+h)*.005),hy=y+Math.abs(h)*height*.003;
          ctx.fillStyle=mix('#e3d6bd',phase.tint,phase.tintAmount*1.3);ctx.fillRect(hx-hw/2,hy-hh,hw,hh);
          ctx.fillStyle=mix('#a9483a',phase.tint,phase.tintAmount);ctx.beginPath();ctx.moveTo(hx-hw*.62,hy-hh);ctx.lineTo(hx,hy-hh-hw*.45);ctx.lineTo(hx+hw*.62,hy-hh);ctx.fill();
          if(night){ctx.fillStyle='#ffd98a';ctx.fillRect(hx-hw*.15,hy-hh*.6,Math.max(1,hw*.25),Math.max(1,hh*.3));}
        }
        if(noise(j*5)>.5){ctx.fillStyle=mix('#d8c9a8',phase.tint,phase.tintAmount);ctx.fillRect(x+height*.03,y-height*.03,height*.006,height*.03);}
      }
    }
    if(layer===2){
      // Cypress rows along the nearest crest.
      const cypress=mix(night?'#0d1a14':'#2c4a33',phase.fog,.1);
      ctx.fillStyle=cypress;
      for(let j=1;j<pts.length-1;j+=2){
        const [x,y,ang]=pts[j];
        if(noise(Math.round(ang*60))<.62)continue;
        const ch=height*(.025+noise(j)*.02),cw=ch*.2;
        ctx.beginPath();ctx.ellipse(x,y-ch*.45,cw,ch*.55,0,0,TAU);ctx.fill();
      }
    }
  }  // Haze where the hills meet the plain.
  const haze=ctx.createLinearGradient(0,horizon-height*.06,0,horizon+height*.05);
  haze.addColorStop(0,phase.fog+'00');haze.addColorStop(.6,phase.fog+(train.weather==='wet'?'88':'55'));haze.addColorStop(1,phase.fog+'00');
  ctx.fillStyle=haze;ctx.fillRect(left,horizon-height*.06,right-left,height*.11);
}
// Night: a soft halo for station lamps and the train's headlights on the track.
const glowSprite=(()=>{
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d'),r=g.createRadialGradient(32,32,1,32,32,32);
  r.addColorStop(0,'#ffe6aacc');r.addColorStop(.35,'#ffd98a55');r.addColorStop(1,'#ffd98a00');
  g.fillStyle=r;g.fillRect(0,0,64,64);return c;
})();
{let choice='auto';try{choice=localStorage.getItem('giulio-daytime')||'auto';}catch{}setPhase(choice);}
// Glass: a faint reflection streak and darker screen edges, painted once per size and laid over each frame.
const glassCanvas=document.createElement('canvas');let glassKey='';
function glass(){
  const key=width+'x'+height+'x'+ratio+phaseName;
  if(key!==glassKey){
    glassKey=key;glassCanvas.width=Math.round(width*ratio);glassCanvas.height=Math.round(height*ratio);
    const g=glassCanvas.getContext('2d');g.setTransform(ratio,0,0,ratio,0,0);
    const edge=g.createRadialGradient(width/2,height*.48,Math.min(width,height)*.35,width/2,height*.5,Math.hypot(width,height)*.62);
    edge.addColorStop(0,'#0000');edge.addColorStop(1,phase.night?'#000a':'#06100c66');
    g.fillStyle=edge;g.fillRect(0,0,width,height);
    const streak=g.createLinearGradient(width*.12,0,width*.48,height*.6);
    const shine=phase.night?'#9fb4d0':'#ffffff';
    streak.addColorStop(0,shine+'00');streak.addColorStop(.45,shine+'14');streak.addColorStop(.55,shine+'08');streak.addColorStop(1,shine+'00');
    // Cab roof shadow over the top of the view.
    const roofShade=g.createLinearGradient(0,0,0,height*.16);roofShade.addColorStop(0,'#05100c88');roofShade.addColorStop(1,'#05100c00');
    g.fillStyle=roofShade;g.fillRect(0,0,width,height*.16);
    g.fillStyle=streak;g.beginPath();g.moveTo(width*.08,0);g.lineTo(width*.3,0);g.lineTo(width*.62,height*.62);g.lineTo(width*.44,height*.62);g.closePath();g.fill();
  }
  ctx.drawImage(glassCanvas,0,0,width,height);
}
// Rain on the windscreen: drops build up while it rains and the wiper sweeps them away.
const drops=[];let wiperAngle=Math.PI*.92,wiperDir=-1,lastRain=0;
const dropSprite=(()=>{
  const c=document.createElement('canvas');c.width=c.height=24;const g=c.getContext('2d');
  const r=g.createRadialGradient(10,9,1,12,12,11);
  r.addColorStop(0,'#ffffffaa');r.addColorStop(.35,'#d8ecef55');r.addColorStop(.8,'#2a3c3c44');r.addColorStop(1,'#2a3c3c00');
  g.fillStyle=r;g.beginPath();g.arc(12,12,11,0,TAU);g.fill();return c;
})();
function windscreenRain(paneAt){
  const wet=train.weather==='wet',now=train.elapsed,dt=Math.min(200,Math.max(0,now-lastRain));lastRain=now;
  const pivot={u:.5,y:-.55},reach=.92;
  if(wet){
    const rate=.012+Math.min(1,Math.abs(train.v)/25)*.03;
    if(drops.length<70&&Math.random()<rate*dt)drops.push({u:.08+Math.random()*.84,y:-.48+Math.random()*.98,r:.6+Math.random()*.8});
    const before=wiperAngle;
    wiperAngle+=wiperDir*dt*.0021;
    if(wiperAngle<Math.PI*.08){wiperAngle=Math.PI*.08;wiperDir=1;}
    if(wiperAngle>Math.PI*.92){wiperAngle=Math.PI*.92;wiperDir=-1;}
    const lo=Math.min(before,wiperAngle),hi=Math.max(before,wiperAngle);
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i],du=(d.u-pivot.u)*2.62,dy=d.y-pivot.y,a=Math.atan2(dy,du);
      if(Math.hypot(du,dy)<reach&&a>=lo-.02&&a<=hi+.02)drops.splice(i,1);
    }
  }else if(drops.length)drops.length=0;
  for(const d of drops){
    const q=project(paneAt(d.u,d.y));if(!q)continue;
    const r=clamp(focal/q[2]*.02*d.r,1.5,9);
    ctx.drawImage(dropSprite,q[0]-r,q[1]-r,r*2,r*2);
  }
  if(wet){
    const tip=paneAt(pivot.u+Math.cos(wiperAngle)*reach/2.62,pivot.y+Math.sin(wiperAngle)*reach);
    beam(paneAt(pivot.u,pivot.y),tip,'#142624',2.6);
  }
}
// Soft ground shadow under trees, cast away from the sun (daylight only, near the track).
function groundShadow(s,x,ground,radius){
  if(phase.night||Math.abs(s-train.s)>260)return;
  const pts=[];
  for(let i=0;i<8;i++){const a=i*TAU/8;pts.push(point(s+Math.sin(a)*radius*.7,x+radius*.35+Math.cos(a)*radius,ground+.03));}
  polygon(pts,train.weather==='wet'?'#1a262222':'#16231a38');
}// Cinematic cameras: the cab (default), behind the train, and a three-quarter side shot. Button "🎥" or key C.
const VIEWS=[['cab','Cabina'],['chase','Esterna'],['side','Laterale']];
let viewMode='cab';
function setView(mode){
  viewMode=mode;skyKey='';renderDirty=true;
  const button=$('view-mode');if(button)button.textContent='🎥 '+VIEWS.find(v=>v[0]===mode)[1];
}
$('view-mode')?.addEventListener('click',()=>setView(VIEWS[(VIEWS.findIndex(v=>v[0]===viewMode)+1)%VIEWS.length][0]));
addEventListener('keydown',event=>{if((event.key==='c'||event.key==='C')&&!event.repeat&&!event.target.closest?.('input,textarea'))$('view-mode')?.click();});
// The train itself (seen from outside): three cars with cream livery, red stripe, windows lit at night.
function trainBox(s0,s1,front){
  const hw=1.45,y0=.55,y1=4.05,night=phase.night||phaseName==='tramonto';
  const P=(s,x,y)=>point(s,x,y);
  const faces=[
    {pts:[P(s0,-hw,y0),P(s1,-hw,y0),P(s1,-hw,y1),P(s0,-hw,y1)],color:'#e4dcc8',side:-1},
    {pts:[P(s1,hw,y0),P(s0,hw,y0),P(s0,hw,y1),P(s1,hw,y1)],color:'#d2c9b3',side:1},
    {pts:[P(s1,-hw,y0),P(s1,hw,y0),P(s1,hw,y1),P(s1,-hw,y1)],color:front?'#b53a32':'#c9c0a9',end:s1,front},
    {pts:[P(s0,hw,y0),P(s0,-hw,y0),P(s0,-hw,y1),P(s0,hw,y1)],color:'#c9c0a9',end:s0},
    {pts:[P(s0,-hw+.15,y1+.25),P(s1,-hw+.15,y1+.25),P(s1,hw-.15,y1+.25),P(s0,hw-.15,y1+.25)],color:'#7a8282',roof:true},
    {pts:[P(s0,-hw,y1),P(s1,-hw,y1),P(s1,-hw+.15,y1+.25),P(s0,-hw+.15,y1+.25)],color:'#8d9494'},
    {pts:[P(s1,hw,y1),P(s0,hw,y1),P(s0,hw-.15,y1+.25),P(s1,hw-.15,y1+.25)],color:'#6f7777'}
  ];
  for(const f of faces){let z=0;for(const p of f.pts)z+=local(p).z;f.z=z/f.pts.length;}
  faces.sort((a,b)=>b.z-a.z);
  for(const f of faces){
    polygon(f.pts,f.color);
    if(f.side){
      const x=f.side*(hw+.01),win=night?'#ffd98a':'#2b3a40';
      polygon([P(s0+.3,x,1.25),P(s1-.3,x,1.25),P(s1-.3,x,1.55),P(s0+.3,x,1.55)],'#b53a32');
      for(let w=s0+1.2;w<s1-1.6;w+=2.4)polygon([P(w,x,2.25),P(w+1.7,x,2.25),P(w+1.7,x,3.2),P(w,x,3.2)],win);
    }
    if(f.front){
      const z=s1+.01;
      polygon([P(z,-1.15,2.35),P(z,1.15,2.35),P(z,1.05,3.55),P(z,-1.05,3.55)],night?'#30424a':'#22323a');
      for(const x of [-.95,.95])polygon([P(z,x-.18,1.0),P(z,x+.18,1.0),P(z,x+.18,1.3),P(z,x-.18,1.3)],night?'#fff3c4':'#e9e1c2');
    }
  }
}
function trainObjects(objects){
  for(let k=0;k<3;k++){
    const s1=train.s+.6-k*21,s0=s1-20;
    objects.push({s:(s0+s1)/2,draw:()=>trainBox(s0,s1,k===0)});
  }
}
// Passengers waiting on the platforms (simple figures, scaled with distance).
const CLOTHES=['#3d5a80','#b56576','#e9c46a','#6a994e','#8d99ae','#c8553d','#4a4e69'];
function person(s,x,seed){
  const foot=project(point(s,x,1.05)),head=project(point(s,x,2.75));
  if(!foot||!head||foot[2]>220)return;
  const h=foot[1]-head[1],w=Math.max(1.5,h*.26);
  ctx.fillStyle=shade(CLOTHES[seed%CLOTHES.length],foot[2]);
  ctx.beginPath();ctx.roundRect?ctx.roundRect(foot[0]-w/2,head[1]+h*.2,w,h*.8,w*.4):ctx.rect(foot[0]-w/2,head[1]+h*.2,w,h*.8);ctx.fill();
  ctx.fillStyle=shade(seed%3?'#e8c4a0':'#a8714f',foot[2]);
  ctx.beginPath();ctx.arc(foot[0],head[1]+h*.1,Math.max(1,h*.11),0,TAU);ctx.fill();
}
// Lens flare when looking into the sun (cab and outside views, clear daytime only).
function flare(){
  if(train.weather==='wet'||phase.night)return;
  const a=angleDiff(.57,viewBearing);if(Math.abs(a)>.55)return;
  const sx=width*.5+Math.tan(a)*focal,sy=horizon-height*phase.sunY,cx=width*.5,cy=height*.5,k=1-Math.abs(a)/.55;
  ctx.globalCompositeOperation='lighter';
  for(const [t,r,c] of [[.0,.22,'#fff4d6'],[.35,.05,'#ffd9a0'],[.6,.03,'#a0e0ff'],[.85,.07,'#ffc8a0'],[1.25,.04,'#c8ffd8']]){
    const x=sx+(cx-sx)*t*2,y=sy+(cy-sy)*t*2,rad=height*r,g=ctx.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,c+Math.round(k*(t?40:70)).toString(16).padStart(2,'0'));g.addColorStop(1,c+'00');
    ctx.fillStyle=g;ctx.fillRect(x-rad,y-rad,rad*2,rad*2);
  }
  ctx.globalCompositeOperation='source-over';
}
function headlights(){
  if(!phase.night&&phaseName!=='tramonto')return;
  const near=project(point(train.s+4)),far=project(point(train.s+90));
  if(!near||!far)return;
  const spread=focal*1.6/near[2],top=far[1],bottom=near[1];
  const light=ctx.createLinearGradient(0,bottom,0,top);
  light.addColorStop(0,phase.night?'#ffe8b03a':'#ffe8b018');light.addColorStop(1,'#ffe8b000');
  ctx.globalCompositeOperation='lighter';ctx.fillStyle=light;ctx.beginPath();
  ctx.moveTo(near[0]-spread,bottom);ctx.lineTo(far[0]-focal*1.6/far[2],top);ctx.lineTo(far[0]+focal*1.6/far[2],top);ctx.lineTo(near[0]+spread,bottom);
  ctx.closePath();ctx.fill();ctx.globalCompositeOperation='source-over';
}const CHUNK=96, sceneryChunks=new Map();
function noise(n){const f=Math.sin(n*78.233+36.7)*43758.5453;return f-Math.floor(f);}
const WATER=[
  {id:'lago-chiaro',start:2780,end:4230,center:-68,width:53,level:trackAt(3530).y-4.5},
  {id:'fiume',start:4300,end:6190,center:0,width:12,level:null},
  {id:'lago-alto',start:6320,end:7680,center:68,width:51,level:trackAt(7050).y-5.2}
];
function waterSection(s,body){
  const t=clamp((s-body.start)/(body.end-body.start),0,1);
  if(body.id==='fiume'){
    const center=30*Math.sin((s-4775)*.0030)+7*Math.sin((s-4775)*.011);
    const half=(7+4*noise(Math.floor(s/150)))*ease(Math.min(t,1-t)*14);
    return {center,half,y:trackAt(s).y-2.75};
  }
  const shape=Math.pow(Math.max(0,1-(2*t-1)**2),.64);
  const center=body.center+(7*Math.sin(s*.013)+4*Math.cos(s*.029))*shape;
  return {center,half:body.width*shape,y:body.level};
}
function waterBody(s){return WATER.find(body=>s>body.start&&s<body.end);}
function inWater(s,x){
  const body=waterBody(s);if(!body)return false;
  const b=waterSection(s,body);
  return Math.abs(x-b.center)<b.half+1.9;
}
function chunkScenery(index){
  if(sceneryChunks.has(index))return sceneryChunks.get(index);
  const items=[], start=index*CHUNK;
  const woodland=noise(index+12)>.43;
  function add(s,range,paint){items.push({s,range,draw:paint});}
  for(const side of [-1,1]){
    for(let i=0;i<(woodland?5:3);i++){
      const key=index*97+side*37+i*8;
      const s=start+(i+.16+noise(key)*.65)*CHUNK/(woodland?5:3);
      if(s<trackStart||s>trackEnd||stationAt(s))continue;
      const tree={s,side,d:6+noise(key+3)*21,height:3+noise(key+4)*7,shade:noise(key+5)>.5};
      if(!inWater(s,side*tree.d)){
        const leafy=(!woodland||index>60)&&noise(key+61)>.62;
        add(s,510,leafy?()=>broadleaf(tree,key):()=>pine(tree));
      }
    }
    for(let i=0;i<9;i++){
      const key=index*141+side*29+i;
      const s=start+i*10.5+noise(key)*3;
      if(s<trackStart||s>trackEnd||stationAt(s))continue;
      const offset=side*(2.8+noise(key+11)*3.1);
      if(inWater(s,offset))continue;
      if(i%3===0)add(s,180,()=>post(s,offset));
      else {
        add(s,105,()=>grass(s,offset,noise(key+2)));
        if(i%2===0&&noise(key+31)>.53)add(s+.4,80,()=>wildflowers(s+.4,offset*1.11,key));
      }
    }
    for(let i=0;i<9;i++){
      const seed=index*77+side*49+i*17, ss=start+noise(seed)*CHUNK;
      const x=side*(6+noise(seed+2)*49);
      if(ss<trackStart||ss>trackEnd||stationAt(ss)||inWater(ss,x))continue;
      const palette=woodland?['#425f45','#66794c','#737c54']:['#7c8d54','#a09a61','#6d8050'];
      if(noise(seed+4)>.7)add(ss,190,()=>stones(ss,x,seed));
      else add(ss,205,()=>scrub(ss,x,seed,palette));
    }
    if(!woodland&&noise(index*3+side)>.47&&!stationAt(start+43)){
      const s=start+43, x=side*(11+noise(index+3)*8);
      if(!inWater(s,x))add(s,300,()=>hut(s,x));
    }
  }
  for(const offset of [16,43,75]){
    const ss=start+offset,body=waterBody(ss);
    if(!body)continue;
    const water=waterSection(ss,body);
    if(water.half<4)continue;
    for(const side of [-1,1]){
      const seed=index*91+offset*17+side*20;
      const edge=water.center+side*water.half;
      const x=edge+side*(Math.min(water.half*.38,body.id==='fiume'?2.8:6.5)+2.3+noise(seed)*4.5);
      if(Math.abs(x)<5.8||stationAt(ss))continue;
      const tree={s:ss,d:Math.abs(x),side:Math.sign(x),height:3+noise(seed+7)*5,shade:side<0};
      add(ss,400,()=>broadleaf(tree,seed));
      add(ss+1,180,()=>stones(ss+1,x,seed+4));
    }
  }
  sceneryChunks.set(index,items);
  return items;
}
function sideVisibility(){return ease((Math.abs(lookYaw)-.26)/1.13);}
function nearbyScenery(s){
  const behind=4+90*sideVisibility();
  const first=Math.floor((s-behind)/CHUNK), last=Math.floor((s+510)/CHUNK);
  for(const key of sceneryChunks.keys())if(key<first-1||key>last+1)sceneryChunks.delete(key);
  const items=[];
  for(let index=first;index<=last;index++)for(const item of chunkScenery(index)){
    if(item.s>s-behind&&item.s<s+item.range)items.push(item);
  }
  return items;
}
function post(s,x){
  const p=project(point(s,x,.87));
  if(!p)return;
  const size=clamp(focal/p[2]*.085,1,14);
  beam(point(s,x,-.2),point(s,x,.87),'#706f62',size);
  beam(point(s,x,.73),point(s,x,.87),'#e2dcc5',size);
}
function grass(s,x,variant){
  const h=.26+variant*.37;
  const a=point(s,x-.35,-.22), b=point(s,x+.34,-.22);
  polygon([a,point(s+.08,x-.19,h),point(s,x+.05,.05),point(s+.14,x+.23,h*.72),b],variant>.5?'#556a40':'#6d7947');
}
function wildflowers(s,x,key){
  for(let i=0;i<4;i++){
    const ss=s+i*.22,xx=x+noise(key+i)*.55;
    const stem=project(point(ss,xx,.29+noise(key+i+4)*.24));
    if(!stem||stem[2]>69)continue;
    const r=clamp(focal/stem[2]*.034,1,4.5);
    beam(point(ss,xx,-.22),point(ss,xx,.28+noise(key+i+4)*.24),'#526a3b',Math.max(1,r*.35));
    ctx.fillStyle=i%2?'#f4d98b':'#e8e1cb';ctx.fillRect(stem[0]-r*.5,stem[1]-r*.5,r,r);
  }
}
function hut(s,x){
  const a=s-2.4,b=s+2.5,left=x-2.15,right=x+2.15;
  const tint=noise(s)>.48?'#d8bd90':'#c4af9c';
  polygon([point(a,left,-.2),point(b,left,-.2),point(b,left,2.2),point(a,left,2.2)],'#948b7b');
  polygon([point(a,right,-.2),point(b,right,-.2),point(b,right,2.2),point(a,right,2.2)],'#ab9a80');
  polygon([point(a,left,-.2),point(a,right,-.2),point(a,right,2.2),point(a,left,2.2)],tint);
  polygon([point(a,left,2.2),point(a,x,3.14),point(a,right,2.2)],'#879186');
  polygon([point(a,x,3.14),point(b,x,3.14),point(b,right,2.2),point(a,right,2.2)],'#8b5649');
  polygon([point(a,x,3.14),point(b,x,3.14),point(b,left,2.2),point(a,left,2.2)],'#a66d55');
  polygon([point(a,left+.42,.35),point(a,left+1.28,.35),point(a,left+1.28,1.62),point(a,left+.42,1.62)],'#46564d');
}
function stones(s,x,seed){
  for(let i=0;i<3;i++){
    const xx=x+noise(seed+i*3)*1.7, ss=s+i*.71, ground=terrainLevel(ss,xx);
    const w=.28+noise(seed+i+1)*.50,h=.24+noise(seed+i+4)*.38;
    polygon([point(ss,xx-w,ground),point(ss,xx+w,ground),point(ss+.21,xx+w*.6,ground+h*.71),point(ss+.13,xx-w*.5,ground+h)],'#9b9988');
    polygon([point(ss,xx+w,ground),point(ss+.72,xx+w*.6,ground),point(ss+.21,xx+w*.6,ground+h*.71)],'#747b70');
  }
}
function scrub(s,x,seed,palette){
  const level=terrainLevel(s,x);
  for(let i=0;i<4;i++){
    const ss=s+(noise(seed+i*7)-.5)*2,xx=x+(i-1.5)*.67;
    const w=.43+noise(seed+i+8)*.46,h=.38+noise(seed+i+11)*.57;
    polygon([point(ss,xx-w,level),point(ss,xx-w*.7,level+h*.65),
      point(ss+.15,xx+.05,level+h),point(ss+.22,xx+w*.67,level+h*.58),point(ss,xx+w,level)],palette[i%3]);
  }
}
function broadleaf(tree,seed){
  const s=tree.s,x=tree.d*tree.side,ground=terrainLevel(s,x),h=tree.height*.82;
  groundShadow(s,x,ground,tree.height*.3);
  const bottom=project(point(s,x,ground)),top=project(point(s,x,ground+h));
  if(!bottom||!top)return;
  const size=bottom[1]-top[1];
  if(size<3||bottom[0]<-size||bottom[0]>width+size)return;
  const x0=bottom[0], y0=bottom[1];
  ctx.fillStyle='#7b6d53';ctx.fillRect(x0-size*.035,y0-size*.68,size*.07,size*.68);
  const colors=noise(seed+4)>.68?['#716438','#978249','#c5a45b']:['#355e4c','#5e8057','#84966a'];
  for(let i=0;i<5;i++){
    const x=x0+(noise(seed+31+i*7)-.5)*size*.53,y=top[1]+size*(.24+noise(seed+7+i*3)*.27);
    const rx=size*(.16+noise(seed+2+i)*.08),ry=size*(.16+noise(seed+11+i)*.11);
    fillShape([[x-rx,y+ry*.2],[x-rx*.55,y-ry*.7],[x,y-ry],[x+rx*.72,y-ry*.46],[x+rx,y+ry*.3],[x+rx*.16,y+ry],[x-rx*.64,y+ry*.7]],colors[i%3]);
  }
}
function pine(tree){
  const x=tree.d*tree.side,h=tree.height,s=tree.s;
  const ground=terrainLevel(s,x);
  groundShadow(s,x,ground,h*.22);
  const base=project(point(s,x,ground)),tip=project(point(s,x,ground+h));
  if(!base||!tip)return;
  const size=(base[1]-tip[1]),dx=base[0];
  if(size<1||dx< -size||dx>width+size)return;
  ctx.fillStyle='#5f5545';ctx.fillRect(dx-size*.036,base[1]-size*.22,size*.072,size*.22);
  ctx.fillStyle=tree.shade?'#294a3f':'#4b6c4a';
  for(let i=0;i<3;i++){
    const top=tip[1]+size*.18*i, span=size*(.12+i*.052);
    fillShape([[dx,top],[dx-span,top+size*.49],[dx,top+size*.40],[dx+span,top+size*.49]],tree.shade?'#2d5143':'#466e4e');
    if(size>12)fillShape([[dx,top],[dx-span,top+size*.49],[dx,top+size*.40]],tree.shade?'#496951':'#62825b');
  }
}
function stationAt(s){
  return stops.find(stop=>s>=stop.s-87&&s<stop.s+31);
}
function stationPlatform(s,t,station){
  const side=station.side==='left'?-1:1;
  const edge=side*1.86,outer=side*5.25;
  polygon([point(s,edge,0),point(t,edge,0),point(t,edge,.65),point(s,edge,.65)],'#797d70');
  strip(s,t,Math.min(edge,outer),Math.max(edge,outer),.65,'#a6a590');
  strip(s,t,Math.min(edge,edge+side*.14),Math.max(edge,edge+side*.14),.654,'#ddbb67');
}
function signboard(sign){
  const offset=sign.side*(sign.type==='limit'?3.6:sign.type==='stop'?2.14:4.35);
  const boardHeight=sign.type==='stop'?1.8:2.55;
  const foot=point(sign.s,offset,.2),p=project(point(sign.s,offset,boardHeight));
  if(!p||p[0]<-110||p[0]>width+110)return;
  const size=clamp(focal/p[2],2,122);
  beam(foot,point(sign.s,offset,boardHeight),'#49554c',Math.max(1,size*.07));
  const label=sign.label,[x,y]=p;
  if(sign.type==='limit'){
    ctx.beginPath();ctx.arc(x,y,size*.43,0,Math.PI*2);ctx.fillStyle='#ece7d8';ctx.fill();
    ctx.strokeStyle='#8b4842';ctx.lineWidth=Math.max(1,size*.07);ctx.stroke();
  }else{
    const wide=size*(sign.type==='station'?2.3:1.3);
    ctx.fillStyle=sign.type==='station'?'#2c4f62':'#e7c568';
    ctx.fillRect(x-wide/2,y-size*.28,wide,size*.56);
  }
  if(size>8){
    ctx.fillStyle=sign.type==='station'?'#faf2d7':'#232923';
    ctx.font='800 '+Math.max(6,size*(sign.type==='station'?.23:.40))+'px monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y+size*.015);
  }
}
function gantry(s){
  const side=3.4, next=s+48;
  const p=project(point(s,side,3.1));if(!p)return;
  const size=Math.max(.6,focal/p[2]*.07);
  beam(point(s,side,-.16),point(s,side,5.8),'#4a5d57',size*1.6);
  beam(point(s,side,5.8),point(s,-.7,5.8),'#53625a',size);
  beam(point(s,side,4.35),point(s,.0,5.7),'#627269',Math.max(.5,size*.58));
  beam(point(s,0,5.25),point(next,0,5.25),'#35443e',Math.max(.65,size*.58));
}
function shelter(s,side){
  const x=side*4.28, edge=side*3.35, rear=side*5.06, a=s-7,b=s+7;
  polygon([point(a,rear,.66),point(b,rear,.66),point(b,rear,2.7),point(a,rear,2.7)],'#44605b');
  polygon([point(a,rear,2.7),point(b,rear,2.7),point(b,edge,2.98),point(a,edge,2.98)],'#6d7971');
  for(const z of [a,s,b])beam(point(z,edge,.66),point(z,edge,2.98),'#435853',Math.max(1,focal/(z-train.s+3)*.057));
  strip(s-3,s+3,Math.min(x-.22,x+.22),Math.max(x-.22,x+.22),1.1,'#a68c5f');
}
function platformLamp(s,side){
  const x=side*4.63, lamp=point(s,x-side*.32,3.55), p=project(lamp);
  if(!p)return;
  const px=clamp(focal/p[2]*.075,1,8);
  beam(point(s,x,.65),point(s,x,3.55),'#485952',px);
  beam(point(s,x,3.55),lamp,'#485952',px);
  ctx.fillStyle='#f2d79d';ctx.fillRect(p[0]-px,p[1],px*2.1,Math.max(1,px*.55));
  if(phase.night||phaseName==='tramonto'){const r=clamp(focal/p[2]*1.4,6,90);ctx.globalCompositeOperation='lighter';ctx.drawImage(glowSprite,p[0]-r,p[1]-r*.6,r*2,r*2);ctx.globalCompositeOperation='source-over';}
}
const stationScenery=[];
for(const stop of stops){
  const side=stop.side==='left'?-1:1;
  for(const offset of [-73,-46,-20,14]){
    const s=stop.s+offset;stationScenery.push({s,draw:()=>platformLamp(s,side)});
  }
  const s=stop.s-36;stationScenery.push({s,draw:()=>shelter(s,side)});
  for(let k=0;k<8;k++){const ps=stop.s-62+k*8.5+noise(stop.s+k)*4,px=side*(2.9+noise(stop.s*3+k)*1.4),seed=Math.floor(noise(stop.s+k*7)*97);stationScenery.push({s:ps,draw:()=>person(ps,px,seed)});}
  const building=stop.s-62;stationScenery.push({s:building,draw:()=>hut(building,side*10.8)});
}
// Villages: houses around every station and a few farms along the line (walls, two-slope roof, windows lit at night).
const HOUSE_COLORS=[['#d8c7a4','#b7a581','#9c4a3a'],['#e2d6c0','#c0b39b','#6e4b3c'],['#c9b48e','#a8946f','#7f3f33'],['#e6dccb','#c4b9a6','#4f5b5e']];
function house(s,x,h){
  const ground=terrainLevel(s,x),hw=h.w/2,hd=h.d/2,rh=h.w*.42;
  const P=(ds,dx,y)=>point(s+ds,x+dx,ground+y);
  const parts=[];
  const corners=[[-hd,-hw],[-hd,hw],[hd,hw],[hd,-hw]];
  for(let i=0;i<4;i++){
    const [s1,x1]=corners[i],[s2,x2]=corners[(i+1)%4],gable=i%2===1;
    const pts=[P(s1,x1,0),P(s2,x2,0),P(s2,x2,h.ht),P(s1,x1,h.ht)];
    if(gable)pts.splice(3,0,P(s2,0,h.ht+rh));
    parts.push({pts,color:i%2?h.wall:h.shade,z:local(P((s1+s2)/2,(x1+x2)/2,1)).z,face:i});
  }
  const roofL=[P(-hd-.3,-hw-.35,h.ht-.1),P(hd+.3,-hw-.35,h.ht-.1),P(hd+.3,0,h.ht+rh),P(-hd-.3,0,h.ht+rh)];
  const roofR=[P(-hd-.3,hw+.35,h.ht-.1),P(hd+.3,hw+.35,h.ht-.1),P(hd+.3,0,h.ht+rh),P(-hd-.3,0,h.ht+rh)];
  parts.push({pts:roofL,color:h.roof,z:local(P(0,-hw*.5,h.ht+rh*.5)).z-.01},{pts:roofR,color:mix(h.roof,'#000',.18),z:local(P(0,hw*.5,h.ht+rh*.5)).z-.01});
  parts.sort((a,b)=>b.z-a.z);
  const night=phase.night||phaseName==='tramonto';
  for(const part of parts){
    polygon(part.pts,part.color);
    // Two windows and a door on the long walls.
    if(part.face===0||part.face===2){
      const side=part.face===0?-hd-.01:hd+.01;
      for(const [u,y0,y1,c] of [[-hw*.55,1.1,1.9,night?'#ffd98a':'#3d4f57'],[hw*.55,1.1,1.9,night?'#ffd98a':'#3d4f57'],[0,0,1.7,'#5a3d2c']]){
        polygon([P(side,u-.35,y0),P(side,u+.35,y0),P(side,u+.35,y1),P(side,u-.35,y1)],c);
      }
    }
  }
}
const villageScenery=[];
for(const [index,stop] of stops.entries()){
  const away=stop.side==='left'?1:-1;
  for(let k=0;k<7;k++){
    const r=noise(index*31+k*7),side=k%3===0?-away:away;
    const s=stop.s-150+k*55+noise(index*17+k)*30,x=side*(17+noise(index*5+k*3)*28);
    const [wall,shade,roof]=HOUSE_COLORS[Math.floor(r*HOUSE_COLORS.length)];
    const h={w:6+r*3,d:8+noise(k*13+index)*4,ht:3.2+(r>.6?2.6:0),wall,shade,roof};
    villageScenery.push({s,draw:()=>house(s,x,h)});
  }
}
for(let s=600;s<TERMINUS;s+=640+noise(s)*300){
  if(stops.some(st=>Math.abs(st.s-s)<260)||waterBody(s))continue;
  const side=noise(s*3)>.5?1:-1,x=side*(26+noise(s*7)*40),[wall,shade,roof]=HOUSE_COLORS[Math.floor(noise(s*11)*4)];
  const h={w:7,d:10,ht:3.4,wall,shade,roof};
  villageScenery.push({s,draw:()=>house(s,x,h)});
}
function terrainLevel(s,x){
  const edge=ease((Math.abs(x)-9)/142);
  const swell=.7+Math.sin(s*.013+x*.051)*.8+Math.cos(s*.006-x*.073)*.55;
  return -.38+edge*swell*9;
}
function landColor(s,x,wet){
  const field=Math.sin(s*.014+Math.sin(x*.096)*.8)*.34+Math.cos(x*.083+s*.004)*.34
    +(noise(Math.floor(s/39)+Math.floor(x/20)*13)-.5)*.25;
  const hue=(wet?109:82)+field*18;
  const light=(wet?35:42)+field*10;
  return 'hsl('+hue.toFixed(0)+' '+(wet?15:24)+'% '+light.toFixed(0)+'%)';
}
function landBand(a,b,leftA,rightA,leftB,rightB,color){
  polygon([
    point(a,leftA,terrainLevel(a,leftA)),point(a,rightA,terrainLevel(a,rightA)),
    point(b,rightB,terrainLevel(b,rightB)),point(b,leftB,terrainLevel(b,leftB))
  ],color,true);
}
function landArea(a,b,loA,hiA,loB,hiB,wet){
  const span=Math.max(hiA-loA,hiB-loB), n=span>170?7:span>45?4:1;
  for(let i=0;i<n;i++){
    const u=i/n,v=(i+1)/n,center=(u+v)*.5;
    const x=(blend(loA,hiA,center)+blend(loB,hiB,center))*.5;
    landBand(a,b,blend(loA,hiA,u),blend(loA,hiA,v),blend(loB,hiB,u),blend(loB,hiB,v),landColor((a+b)*.5,x,wet));
  }
}
function waterPoint(s,x,level){return point(s,x,level-trackAt(s).y);}
function paintLandscape(a,b,wet){
  const mid=(a+b)/2, region=waterBody(mid);
  if(!region){landArea(a,b,-154,154,-154,154,wet);return false;}
  const one=waterSection(a,region),two=waterSection(b,region);
  const leftA=one.center-one.half,rightA=one.center+one.half,leftB=two.center-two.half,rightB=two.center+two.half;
  const lake=region.id!=='fiume', bankWidth=lake?6.5:2.8;
  const bankA=Math.min(one.half*.38,bankWidth), bankB=Math.min(two.half*.38,bankWidth);
  landArea(a,b,-154,leftA-bankA,-154,leftB-bankB,wet);
  landArea(a,b,rightA+bankA,154,rightB+bankB,154,wet);
  for(const [x,y,side] of [[leftA,leftB,-1],[rightA,rightB,1]]){
    const outerA=x+side*bankA,outerB=y+side*bankB,innerA=x+side*bankA*.33,innerB=y+side*bankB*.33;
    const highA=point(a,outerA,terrainLevel(a,outerA)),highB=point(b,outerB,terrainLevel(b,outerB));
    const slopeA=waterPoint(a,innerA,blend(one.y,highA.y,.38)),slopeB=waterPoint(b,innerB,blend(two.y,highB.y,.38));
    polygon([highA,highB,slopeB,slopeA],wet?'#778467':'#939769',true);
    polygon([slopeA,slopeB,waterPoint(b,y,two.y),waterPoint(a,x,one.y)],wet?'#6a796f':'#9c9174',true);
  }
  const palette=wet?['#3d6772','#466f77','#567c7f']:lake?['#3b8994','#519da2','#65aaae']:['#397d87','#468c92','#5c9896'];
  const ribbons=lake?4:2;
  for(let i=0;i<ribbons;i++){
    const u=i/ribbons,v=(i+1)/ribbons;
    const shade=(i+Math.floor((Math.sin(mid*.016)+1)*.98))%palette.length;
    polygon([waterPoint(a,blend(leftA,rightA,u),one.y),waterPoint(a,blend(leftA,rightA,v),one.y),
      waterPoint(b,blend(leftB,rightB,v),two.y),waterPoint(b,blend(leftB,rightB,u),two.y)],palette[shade],true);
  }
  // Ripples and slivers of reflected sky are vector faces on the water plane.
  const spanA=rightA-leftA,spanB=rightB-leftB;
  if(Math.abs(mid-train.s)<230&&spanA>3&&spanB>3){
    const key=Math.floor(mid/3);
    const u=.08+noise(key+91)*.67,v=Math.min(.98,u+.12+noise(key+29)*.16);
    const motion=Math.sin(train.elapsed*.9+key)*.035;
    const x=blend(leftA,rightA,u+motion), y=blend(leftA,rightA,v+motion);
    const x2=blend(leftB,rightB,u+motion), y2=blend(leftB,rightB,v+motion);
    const z=blend(a,b,.28+noise(key+4)*.2);
    const level=blend(one.y,two.y,(z-a)/(b-a))+.013;
    polygon([waterPoint(z,blend(x,x2,.4),level),waterPoint(z,blend(y,y2,.4),level),
      waterPoint(z+.18,blend(y,y2,.4)-.35,level),waterPoint(z+.18,blend(x,x2,.4)+.2,level)],
      wet?'#b4c8bc4d':'#f1e9bb65');
  }
  const min=Math.min(leftA,leftB),max=Math.max(rightA,rightB);
  return min<2.6&&max> -2.6;
}
function bridge(a,b){
  strip(a,b,-2.45,2.45,-.24,'#696a61');
  strip(a,b,-1.86,1.86,-.079,'#897e68');
  for(const side of [-1,1]){
    const x=side*2.42;
    polygon([point(a,x,-.53),point(b,x,-.53),point(b,x,-.20),point(a,x,-.20)],'#555c58');
    if(Math.abs(a-train.s)<230){
      beam(point(a,x,.62),point(b,x,.62),'#75877b',1.25);
      beam(point(a,x,.22),point(b,x,.22),'#65746a',1);
      beam(point(a,x,-.20),point(a,x,.62),'#485f54',1.2);
    }
  }
}
function drawCabin(cab){
  const sin=Math.sin(cab.yaw),cos=Math.cos(cab.yaw),base=cab.y+2.46;
  const cabPoint=(x,y,z)=>({x:cab.x+x*cos+z*sin,y:base+y,z:cab.z-x*sin+z*cos});
  const panes=[
    {a:[-1.31,1.86],b:[1.31,1.86],front:true},
    {a:[-1.31,-1.55],b:[-1.31,1.86],front:false},
    {a:[1.31,1.86],b:[1.31,-1.55],front:false}
  ];
  for(const {a,b,front} of panes){
    const p=(u,y)=>cabPoint(blend(a[0],b[0],u),y,blend(a[1],b[1],u));
    const panel=(u,v,top,bottom,fill)=>polygon([p(u,top),p(v,top),p(v,bottom),p(u,bottom)],fill);
    panel(0,1,2.2,.65,'#273b36');
    panel(0,1,.72,.63,'#4a6257');
    panel(0,1,.647,.61,'#121f1e');
    panel(0,1,-.57,-2.1,'#34483f');
    panel(0,1,-.57,-.66,'#52695c');
    panel(0,1,-.66,-.81,'#20342f');
    const posts=front?[[0,.048],[.952,1]]:[[0,.075],[.58,.631],[.94,1]];
    for(const [u,v] of posts){
      panel(u,v,.63,-.57,'#293b35');
      panel(u,u+(v-u)*.22,.63,-.57,'#52675b');
    }
    if(front){
      // Sun visors at the top of the windscreen.
      panel(.07,.43,.52,.43,'#1a2926');panel(.07,.43,.435,.42,'#2f443d');
      panel(.57,.93,.52,.45,'#1a2926');
    }
    const glass=front?.024:.042;
    panel(.06,.94,.52,-.52,'rgba(187,221,210,'+glass+')');
    if(front&&train.weather==='wet')windscreenRain((u,y)=>p(u,y));
    else if(front){
      beam(p(.57,-.56),p(.76,-.35),'#263530',2.1);
      beam(p(.76,-.35),p(.83,-.32),'#142624',2.45);
      beam(p(.25,.573),p(.49,.573),'#9bb6a35c',1);
    }
  }
  const bench=[
    cabPoint(-1.13,-.64,1.83),cabPoint(1.13,-.64,1.83),
    cabPoint(1.02,-.95,1.11),cabPoint(-1.02,-.95,1.11)
  ];
  polygon(bench,'#344d44');
  beam(bench[3],bench[2],'#768677',1.3);
  const consoleFace=(l,r,a,b,color)=>polygon([
    cabPoint(l,blend(-.95,-.64,a),blend(1.11,1.83,a)),
    cabPoint(r,blend(-.95,-.64,a),blend(1.11,1.83,a)),
    cabPoint(r,blend(-.95,-.64,b),blend(1.11,1.83,b)),
    cabPoint(l,blend(-.95,-.64,b),blend(1.11,1.83,b))
  ],color);
  consoleFace(-.48,.30,.25,.86,'#182d29');
  consoleFace(-.45,.27,.30,.80,'#192b30');
  consoleFace(-.40,.22,.59,.72,'#658e7d');
  for(let i=0;i<4;i++)consoleFace(-.36+i*.14,-.26+i*.14,.38,.49,i===0?'#dabf7a':'#597368');
  // Two lit screens (speed and line), and the traction lever on the right.
  const lit=phase.night||phaseName==='tramonto';
  consoleFace(-.46,-.13,.6,.8,'#0c2622');consoleFace(-.44,-.15,.63,.77,lit?'#3fd1a0':'#2b8a6c');
  consoleFace(-.40,-.19,.70,.72,lit?'#c9ffe9':'#8fe0c2');
  consoleFace(.0,.27,.6,.8,'#0c2622');consoleFace(.02,.25,.63,.77,lit?'#f0b04a':'#b9822f');
  beam(cabPoint(.52,-.66,1.48),cabPoint(.52,-.43,1.40),'#141c1a',4);
  beam(cabPoint(.52,-.43,1.40),cabPoint(.52,-.40,1.39),'#c8553d',7);
}
function render(){
  pointSamples.clear();
  const cab=trackAt(train.s+.55);
  let camPitch=0;
  if(viewMode==='cab'){camera={...cab,y:cab.y+2.46};viewBearing=cab.yaw+lookYaw;}
  else{
    const shot=viewMode==='chase'?{from:point(train.s-66,0,9.5),to:point(train.s+45,0,1.5)}:{from:point(train.s-36,15,3.4),to:point(train.s-16,0,2.4)};
    camera=shot.from;const dx=shot.to.x-camera.x,dz=shot.to.z-camera.z;
    viewBearing=Math.atan2(dx,dz)+lookYaw;camPitch=Math.atan2(shot.to.y-camera.y,Math.hypot(dx,dz));
  }
  cy=Math.cos(viewBearing);sy=Math.sin(viewBearing);
  const roll=viewMode!=='cab'||reducedMotion?.matches?0:clamp(train.v*train.v*curveAt(train.s)*.028,-.024,.024);
  rollCos=Math.cos(roll);rollSin=Math.sin(roll);
  focal=Math.min(width*.91,height*1.25)*zoom;
  horizon=height*(viewMode==='cab'?.40:.46)+Math.tan(lookPitch+camPitch)*focal+(reducedMotion?.matches?0:clamp(train.a,-1.2,1.2)*4);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  atmosphere();
  const wet=train.weather==='wet';
  const sideView=sideVisibility();
  // Rails catch the light when looking toward the sun.
  const sunAhead=Math.max(0,Math.cos(angleDiff(.57,viewBearing)));
  railShine=mix('#d2cec0',phase.sun,Math.round(sunAhead*sunAhead*6)/10);
  const first=Math.max(trackStart,Math.floor((train.s-4-90*sideView-(viewMode==='cab'?0:85))/3)*3);
  const last=Math.min(trackEnd,train.s+690-225*sideView),segments=[];
  for(let a=first;a<last;){
    const relative=Math.abs(a-train.s),t=Math.min(last,a+(relative<85?3:relative<235?8:15));
    const center=local(point((a+t)/2));
    segments.push({a,t,depth:center.z+relative*.018});
    a=t;
  }
  segments.sort((a,b)=>b.depth-a.depth);
  for(const {a,t} of segments){
    const center=(a+t)/2,even=Math.floor(a/19)%2===0;
    const hasBridge=paintLandscape(a,t,wet);
    if(hasBridge)bridge(a,t);
    strip(a,t,-1.84,1.84,-.075,even?'#858274':'#8c8576');
    if(Math.abs(a-train.s)<48)for(let k=0;k<5;k++){const u=noise(a*7+k*13),j=a+(t-a)*noise(a*3+k*29),xx=-1.75+u*3.5;strip(j,j+.07+u*.05,xx,xx+.08,-.071,k%2?'#6b675b':'#a19b8a');}
    if(Math.abs(a-train.s)<138){
      const interval=1.7;
      for(let j=Math.ceil(a/interval)*interval;j<t;j+=interval){
        strip(j,j+.23,-1.22,1.22,-.034,'#564e42');
        if(Math.abs(a-train.s)<58)strip(j+.018,j+.066,-1.18,1.18,-.033,'#887662');
      }
    }
    const relative=a-train.s;
    for(const rail of [-.7175,.7175]){
      strip(a,t,rail-.043,rail+.043,.057,!wet&&!phase.night&&relative>12&&relative<260?railShine:wet?'#b0b9bb':'#d2cec0');
      strip(a,t,rail-.074,rail-.037,.023,'#58554a');
    }
    const station=stationAt(center);if(station)stationPlatform(a,t,station);
  }
  const objects=nearbyScenery(train.s);
  for(const item of stationScenery)if(item.s>first&&item.s<train.s+340)objects.push(item);
  for(const item of villageScenery)if(item.s>first&&item.s<train.s+420)objects.push(item);
  if(viewMode!=='cab')trainObjects(objects);
  for(let s=Math.ceil((first+2)/48)*48;s<train.s+600;s+=48)objects.push({s,draw:()=>gantry(s)});
  for(const sign of signs)if(sign.s>first&&sign.s<train.s+370)objects.push({s:sign.s,draw:()=>signboard(sign)});
  const sorted=objects.map(o=>({o,z:local(point(o.s)).z})).sort((a,b)=>b.z-a.z);
  for(const {o} of sorted){
    const remaining=o.range==null?1:clamp((o.range-Math.abs(o.s-train.s))/36,0,1);
    ctx.globalAlpha=remaining;o.draw();
  }
  ctx.globalAlpha=1;
  if(wet){
    ctx.strokeStyle='#d4e6e444';ctx.lineWidth=.85;ctx.beginPath();
    for(let i=0;i<45;i++){
      const x=(noise(i+8)*width+(train.elapsed*55*(.5+noise(i+4))))%width;
      const y=(noise(i+18)*height+train.elapsed*(90+noise(i+2)*210))%height;
      ctx.moveTo(x,y);ctx.lineTo(x-4,y+11+noise(i+9)*12);
    }
    ctx.stroke();
  }
  headlights();
  if(viewMode==='cab'){drawCabin(cab);glass();}
  flare();
}
