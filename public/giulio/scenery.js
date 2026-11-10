const canvas=$('view'), ctx=canvas.getContext('2d',{alpha:false});
let width=1,height=1,ratio=1,camera,focal,horizon,cy,sy,rollCos=1,rollSin=0;
let quality=1,renderCost=0,qualityChanged=0;
const reducedMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)");
let lookYaw=0,lookPitch=0,drag=null,viewBearing=0;
const HALF_TURN=Math.PI/2;
function setLook(yaw,pitch=0){
  lookYaw=clamp(yaw,-HALF_TURN,HALF_TURN);
  lookPitch=clamp(pitch,-.21,.20);
  const deg=Math.round(lookYaw*180/Math.PI);
  $('view-angle').textContent=(deg>0?'+':'')+deg+'°';
  renderDirty=true;
}
$('look-left').onclick=()=>setLook(lookYaw-Math.PI/6,lookPitch);
$('look-right').onclick=()=>setLook(lookYaw+Math.PI/6,lookPitch);
$('look-center').onclick=()=>setLook(0,0);
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:lookYaw,pitch:lookPitch};
  canvas.setPointerCapture?.(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove',event=>{
  if(drag?.id!==event.pointerId)return;
  setLook(drag.yaw-(event.clientX-drag.x)*Math.PI/Math.max(250,width*.9),
    drag.pitch+(event.clientY-drag.y)*.75/Math.max(160,height));
});
function finishLook(event){
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
  ctx.strokeStyle=color;ctx.lineWidth=pixels;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();
}
const TAU=Math.PI*2;
const RIDGE_SAMPLES=256;
const ridgeBank=Array.from({length:4},(_,layer)=>Array.from({length:RIDGE_SAMPLES+1},(_,i)=>{
  const u=(i%RIDGE_SAMPLES)/RIDGE_SAMPLES, a=u*TAU, j=(i%RIDGE_SAMPLES);
  return .22+.20*Math.sin(a*(layer+3)+layer)+.24*Math.abs(Math.sin(a*(layer+6)+2.1))
    +.14*Math.sin(a*(layer+13)+2.6)+.09*Math.abs(Math.cos(a*27+layer))
    +.065*noise(j*5+layer*13);
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
function atmosphere(){
  const wet=train.weather==='wet', top=Math.max(30,horizon+height*.18);
  const sky=ctx.createLinearGradient(0,0,0,top);
  const colors=wet?['#243b56','#607e8d','#bbc4bd']:['#24446f','#6ca8c2','#f8dca7'];
  sky.addColorStop(0,colors[0]);sky.addColorStop(.55,colors[1]);sky.addColorStop(1,colors[2]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
  const sunAngle=angleDiff(.57,viewBearing);
  if(!wet&&Math.abs(sunAngle)<1.28){
    const x=width*.5+Math.tan(sunAngle)*focal,y=horizon-height*.24;
    const radius=height*.24, glow=ctx.createRadialGradient(x,y,1,x,y,radius);
    glow.addColorStop(0,'#fff4ceba');glow.addColorStop(1,'#fff1c500');
    ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    ctx.fillStyle='#fff3cc';ctx.beginPath();ctx.arc(x,y,Math.max(5,height*.033),0,TAU);ctx.fill();
  }
  for(const c of cloudBank){
    const a=angleDiff(c.a+train.elapsed*.000055,viewBearing);
    if(Math.abs(a)>1.18)continue;
    const x=width*.5+Math.tan(a)*focal,y=horizon-height*c.y,w=focal*c.w;
    cloud(x+w*.06,y+w*.017,w,c.shape,wet?'#b7c5c470':'#c8dedba6');
    cloud(x,y,w,c.shape,wet?'#d7dcda8c':'#fff3d9de');
  }
  const palette=wet?['#859ba3','#708a96','#5a787b','#49675f']:['#98adb0','#7796a2','#547985','#416b61'];
  for(let layer=0;layer<4;layer++){
    const points=[], depth=3600/(layer+1)**1.8;
    const drift=(camera.x*.00024+camera.z*.0001)*(layer+1)*.18;
    const base=horizon+height*(.045+layer*.021), scale=height*(.43-layer*.052);
    const step=Math.max(5,Math.round(width/118));
    for(let x=-step;x<=width+step;x+=step){
      const angle=viewBearing+Math.atan2(x-width*.5,focal)+drift;
      const altitude=ridgeValue(angle,layer), offset=(camera.y-2)*focal/depth;
      points.push([x,base-altitude*scale+offset,altitude]);
    }
    fillShape([[0,height],...points.map(p=>p.slice(0,2)),[width,height]],palette[layer]);
    const sunFace=wet?'#adbac540':'#e0d9c43b';
    const shadow=wet?'#384d5b30':'#284f6435';
    for(let j=2;j<points.length-2;j++){
      const [x,y,alt]=points[j];
      if(y>points[j-1][1]||y>points[j+1][1]||alt<.40)continue;
      const [left,ly]=points[j-2],[right,ry]=points[j+2];
      const foot=base-height*.015;
      fillShape([[x,y],[left,ly],[x+(right-x)*.52,foot]],sunFace);
      fillShape([[x,y],[right,ry],[x+(right-x)*.52,foot]],shadow);
      if(layer<2&&alt>.63){
        const snowY=y+(foot-y)*.27;
        fillShape([[x,y],[left+(x-left)*.32,snowY],[x,snowY-2],[x+(right-x)*.32,snowY+1]],wet?'#d4ded9c7':'#f5ebd5db');
      }
    }
  }
}
const CHUNK=96, sceneryChunks=new Map();
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
}
const stationScenery=[];
for(const stop of stops){
  const side=stop.side==='left'?-1:1;
  for(const offset of [-73,-46,-20,14]){
    const s=stop.s+offset;stationScenery.push({s,draw:()=>platformLamp(s,side)});
  }
  const s=stop.s-36;stationScenery.push({s,draw:()=>shelter(s,side)});
  const building=stop.s-62;stationScenery.push({s:building,draw:()=>hut(building,side*10.8)});
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
    const glass=front?.024:.042;
    panel(.06,.94,.52,-.52,'rgba(187,221,210,'+glass+')');
    if(front){
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
}
function render(){
  pointSamples.clear();
  const cab=trackAt(train.s+.55);
  camera={...cab,y:cab.y+2.46};
  viewBearing=cab.yaw+lookYaw;
  cy=Math.cos(viewBearing);sy=Math.sin(viewBearing);
  const roll=reducedMotion?.matches?0:clamp(train.v*train.v*curveAt(train.s)*.028,-.024,.024);
  rollCos=Math.cos(roll);rollSin=Math.sin(roll);
  focal=Math.min(width*.91,height*1.25);
  horizon=height*.49+Math.tan(lookPitch)*focal+(reducedMotion?.matches?0:clamp(train.a,-1.2,1.2)*4);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  atmosphere();
  const wet=train.weather==='wet';
  const sideView=sideVisibility();
  const first=Math.max(trackStart,Math.floor((train.s-4-90*sideView)/3)*3);
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
    if(Math.abs(a-train.s)<138){
      const interval=1.7;
      for(let j=Math.ceil(a/interval)*interval;j<t;j+=interval){
        strip(j,j+.23,-1.22,1.22,-.034,'#564e42');
        if(Math.abs(a-train.s)<58)strip(j+.018,j+.066,-1.18,1.18,-.033,'#887662');
      }
    }
    for(const rail of [-.7175,.7175]){
      strip(a,t,rail-.043,rail+.043,.057,wet?'#b0b9bb':'#d2cec0');
      strip(a,t,rail-.074,rail-.037,.023,'#58554a');
    }
    const station=stationAt(center);if(station)stationPlatform(a,t,station);
  }
  const objects=nearbyScenery(train.s);
  for(const item of stationScenery)if(item.s>first&&item.s<train.s+340)objects.push(item);
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
  drawCabin(cab);
}
