import {CELL,HEIGHT,random} from './core.js';
const VS=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uViewProjection;uniform mat4 uModel;varying mediump vec3 vPosition;varying mediump vec3 vNormal;varying mediump vec2 vUV;void main(){vec4 p=uModel*vec4(aPosition,1.);vPosition=p.xyz;vNormal=mat3(uModel)*aNormal;vUV=aUV;gl_Position=uViewProjection*p;}`;
const FS=`precision mediump float;varying mediump vec3 vPosition;varying mediump vec3 vNormal;varying mediump vec2 vUV;uniform sampler2D uTexture;uniform vec3 uColor;uniform vec3 uCamera;uniform vec3 uLights[8];uniform float uEmission;uniform float uTime;void main(){vec3 n=normalize(vNormal);vec3 light=vec3(.29,.275,.215);for(int i=0;i<8;i++){vec3 d=uLights[i]-vPosition;float r=dot(d,d);float diffuse=max(dot(n,normalize(d)),.025);light+=vec3(1.,.96,.77)*diffuse*1.15/(1.+r*.22);}vec3 c=texture2D(uTexture,vUV).rgb*uColor; c*=mix(light,vec3(1.1),uEmission);float fog=1.-exp(-pow(length(vPosition-uCamera)/18.,1.55));c=mix(c,vec3(.20,.18,.115),clamp(fog,0.,.92));gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(.94)),1.);}`;
const FOG=[51,46,29];
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function cameraMatrix(p,aspect,bob=0){
 const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch),eye=[p.x,1.62+bob,p.z],right=[cy,0,sy],up=[-sy*sp,cp,cy*sp],f=[sy*cp,sp,-cy*cp],v=identity();
 for(let i=0;i<3;i++){v[i*4]=right[i];v[i*4+1]=up[i];v[i*4+2]=-f[i]}v[12]=-right.reduce((s,x,i)=>s+x*eye[i],0);v[13]=-up.reduce((s,x,i)=>s+x*eye[i],0);v[14]=f.reduce((s,x,i)=>s+x*eye[i],0);
 const near=.055,far=65,scale=1/Math.tan(72*Math.PI/360),pr=new Float32Array([scale/aspect,0,0,0,0,scale,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);return {matrix:multiply(pr,v),eye};
}
class Geometry{
 constructor(){this.data=[]}
 quad(a,b,c,d,n,uv=[0,0,1,1]){const points=[a,b,c,a,c,d],coords=[[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]];for(let i=0;i<6;i++)this.data.push(...points[i],...n,...coords[i])}
 box(x,y,z,w,h,d){const a=x-w/2,b=x+w/2,c=y,e=y+h,f=z-d/2,g=z+d/2;this.quad([a,c,g],[b,c,g],[b,e,g],[a,e,g],[0,0,1]);this.quad([b,c,f],[a,c,f],[a,e,f],[b,e,f],[0,0,-1]);this.quad([a,c,f],[a,c,g],[a,e,g],[a,e,f],[-1,0,0]);this.quad([b,c,g],[b,c,f],[b,e,f],[b,e,g],[1,0,0]);this.quad([a,e,g],[b,e,g],[b,e,f],[a,e,f],[0,1,0]);this.quad([a,c,f],[b,c,f],[b,c,g],[a,c,g],[0,-1,0])}
}
function noiseTexture(kind,level){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),rng=random(987+level),image=c.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,grain=(rng()-.5)*(kind==='floor'?30:10);let color;
  if(kind==='wall'){const motif=Math.abs(Math.sin(x/16*Math.PI)*Math.cos(y/24*Math.PI)),stripe=x%32<2?-9:0,stain=9*Math.sin(x/67+y/81);color=[186+grain+stripe-stain,173+grain+stripe-stain,107+grain-motif*12-stain];if(motif>.86)color=color.map(v=>v-12)}
  else if(kind==='floor'){const wear=6*Math.sin(x/30)*Math.sin(y/51);color=[112+grain+wear,99+grain+wear,65+grain*.8+wear]}
  else {const seam=x<2||y<2?-45:0;color=[184+grain+seam,181+grain+seam,153+grain+seam]}
  for(let k=0;k<3;k++)image.data[i+k]=color[k];image.data[i+3]=255;
 }
 c.putImageData(image,0,0);if(kind==='wall'){c.fillStyle='#72693c33';for(let i=0;i<5;i++){c.beginPath();c.ellipse(rng()*256,rng()*256,8+rng()*35,5+rng()*28,0,0,6.3);c.fill()}}
 return canvas;
}
function doorTexture(level){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#6b7062';c.fillRect(0,0,256,512);c.fillStyle='#343b32';c.fillRect(12,12,232,488);c.fillStyle='#707566';c.fillRect(18,18,220,476);c.strokeStyle='#8e9380';c.lineWidth=2;c.strokeRect(36,42,184,180);c.strokeRect(36,254,184,205);c.fillStyle='#203b2c';c.fillRect(63,72,130,62);c.fillStyle='#d5dfc0';c.textAlign='center';c.font='bold 25px sans-serif';c.fillText('USCITA',128,111);c.font='18px monospace';c.fillText(String(level).padStart(2,'0'),128,185);c.fillStyle='#d6d4ae';c.fillRect(192,253,10,40);c.fillRect(170,262,30,9);return canvas}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});if(!gl)return new SoftwareRenderer(canvas);this.gl=gl;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader non disponibile: '+gl.getShaderInfoLog(s));return s};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Renderer non disponibile.');this.program=program;gl.useProgram(program);
  this.attrs=['aPosition','aNormal','aUV'].map(n=>gl.getAttribLocation(program,n));this.uniforms=Object.fromEntries(['uViewProjection','uModel','uTexture','uColor','uCamera','uLights[0]','uEmission','uTime'].map(n=>[n,gl.getUniformLocation(program,n)]));gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.2,.18,.115,1);gl.uniform1i(this.uniforms.uTexture,0);
  const white=document.createElement('canvas');white.width=white.height=1;white.getContext('2d').fillRect(0,0,1,1);const ctx=white.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);this.white=this.texture(white);this.meshes=[];this.textures=[];this.quality='auto';this.resize();
 }
 texture(canvas){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.REPEAT);g.generateMipmap(g.TEXTURE_2D);return t}
 mesh(geometry,texture=null,color=[1,1,1],emission=0){const g=this.gl,buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(geometry.data),g.STATIC_DRAW);return {buffer,count:geometry.data.length/8,texture:texture||this.white,color,emission}}
 resize(){const rect=this.canvas.getBoundingClientRect(),limit=this.quality==='low'?720:this.quality==='high'?1440:1080,scale=Math.min(devicePixelRatio||1,1.5,limit/Math.max(rect.width,rect.height));const w=Math.max(1,Math.floor(rect.width*scale)),h=Math.max(1,Math.floor(rect.height*scale));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h)}}
 load(world){
  const gl=this.gl;for(const m of this.meshes)gl.deleteBuffer(m.buffer);if(this.keyMesh)gl.deleteBuffer(this.keyMesh.buffer);for(const t of this.textures)gl.deleteTexture(t);this.world=world;
  const wall=new Geometry(),floor=new Geometry(),ceiling=new Geometry(),trim=new Geometry(),frames=new Geometry(),light=new Geometry(),door=new Geometry(),key=new Geometry();
  for(let z=1;z<world.n-1;z++)for(let x=1;x<world.n-1;x++)if(!world.grid[z*world.n+x]){
   const a=x*CELL,b=(x+1)*CELL,c=z*CELL,d=(z+1)*CELL;
   floor.quad([a,0,c],[b,0,c],[b,0,d],[a,0,d],[0,1,0],[x*2,z*2,(x+1)*2,(z+1)*2]);
   ceiling.quad([a,HEIGHT,d],[b,HEIGHT,d],[b,HEIGHT,c],[a,HEIGHT,c],[0,-1,0],[x,z,x+1,z+1]);
   if(world.grid[z*world.n+x-1]){wall.quad([a,0,d],[a,0,c],[a,HEIGHT,c],[a,HEIGHT,d],[1,0,0],[0,0,2,2]);trim.box(a+.018,0,(c+d)/2,.035,.13,CELL)}
   if(world.grid[z*world.n+x+1]){wall.quad([b,0,c],[b,0,d],[b,HEIGHT,d],[b,HEIGHT,c],[-1,0,0],[0,0,2,2]);trim.box(b-.018,0,(c+d)/2,.035,.13,CELL)}
   if(world.grid[(z-1)*world.n+x]){wall.quad([a,0,c],[b,0,c],[b,HEIGHT,c],[a,HEIGHT,c],[0,0,1],[0,0,2,2]);trim.box((a+b)/2,0,c+.018,CELL,.13,.035)}
   if(world.grid[(z+1)*world.n+x]){wall.quad([b,0,d],[a,0,d],[a,HEIGHT,d],[b,HEIGHT,d],[0,0,-1],[0,0,2,2]);trim.box((a+b)/2,0,d-.018,CELL,.13,.035)}
  }
  for(const p of world.lamps){frames.box(p.x,HEIGHT-.055,p.z,1.18,.04,.34);for(const dz of [-.075,.075])light.quad([p.x-.51,HEIGHT-.06,p.z+dz-.025],[p.x+.51,HEIGHT-.06,p.z+dz-.025],[p.x+.51,HEIGHT-.06,p.z+dz+.025],[p.x-.51,HEIGHT-.06,p.z+dz+.025],[0,-1,0])}
  const p=world.door,n=[-p.dx,0,-p.dz],right=[p.dz,0,-p.dx],v=(dx,y)=>[p.x+right[0]*dx+n[0]*.015,y,p.z+right[2]*dx+n[2]*.015];door.quad(v(-.61,0),v(.61,0),v(.61,2.2),v(-.61,2.2),n);
  // A compact raised key with an actual 3D bow, shaft and two teeth.
  const steps=24;for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2;for(const z of [-.028,.028])key.quad([Math.cos(a)*.15,Math.sin(a)*.15,z],[Math.cos(b)*.15,Math.sin(b)*.15,z],[Math.cos(b)*.09,Math.sin(b)*.09,z],[Math.cos(a)*.09,Math.sin(a)*.09,z],[0,0,z>0?1:-1]);key.quad([Math.cos(a)*.15,Math.sin(a)*.15,-.028],[Math.cos(b)*.15,Math.sin(b)*.15,-.028],[Math.cos(b)*.15,Math.sin(b)*.15,.028],[Math.cos(a)*.15,Math.sin(a)*.15,.028],[Math.cos(a),Math.sin(a),0])}
  key.box(.29,-.028,0,.36,.056,.056);key.box(.39,-.14,0,.055,.12,.056);key.box(.48,-.12,0,.055,.1,.056);
  const textures=[this.texture(noiseTexture('wall',world.level)),this.texture(noiseTexture('floor',world.level)),this.texture(noiseTexture('ceiling',world.level)),this.texture(doorTexture(world.level))];this.textures=textures;
  this.meshes=[this.mesh(wall,textures[0]),this.mesh(floor,textures[1]),this.mesh(ceiling,textures[2]),this.mesh(trim,null,[.26,.23,.14]),this.mesh(frames,null,[.23,.24,.2]),this.mesh(light,null,[1,.98,.79],1),this.mesh(door,textures[3])];this.keyMesh=this.mesh(key,null,[1,.73,.18],.65);
 }
 draw(player,hasKey,time,bob=0){
  this.resize();const g=this.gl,u=this.uniforms,{matrix,eye}=cameraMatrix(player,this.canvas.width/this.canvas.height,bob);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);g.uniformMatrix4fv(u.uViewProjection,false,matrix);g.uniform3fv(u.uCamera,eye);g.uniform1f(u.uTime,time);
  const nearest=this.world.lamps.map(p=>({p,d:(p.x-player.x)**2+(p.z-player.z)**2})).sort((a,b)=>a.d-b.d).slice(0,8),lights=new Float32Array(24).fill(9999);nearest.forEach(({p},i)=>lights.set([p.x,p.y,p.z],i*3));g.uniform3fv(u['uLights[0]'],lights);
  for(const mesh of this.meshes)this.drawMesh(mesh,identity());
  if(!hasKey){const m=identity(),angle=time*.7;m[0]=m[10]=Math.cos(angle);m[2]=-Math.sin(angle);m[8]=Math.sin(angle);m[12]=this.world.keyPosition.x;m[13]=1.05+Math.sin(time*2)*.045;m[14]=this.world.keyPosition.z;this.drawMesh(this.keyMesh,m)}
 }
 drawMesh(m,model){const g=this.gl,u=this.uniforms;g.bindBuffer(g.ARRAY_BUFFER,m.buffer);for(let i=0;i<3;i++){g.enableVertexAttribArray(this.attrs[i]);g.vertexAttribPointer(this.attrs[i],i===2?2:3,g.FLOAT,false,32,i===0?0:i===1?12:24)}g.bindTexture(g.TEXTURE_2D,m.texture);g.uniformMatrix4fv(u.uModel,false,model);g.uniform3fv(u.uColor,m.color);g.uniform1f(u.uEmission,m.emission);g.drawArrays(g.TRIANGLES,0,m.count)}
 destroy(){const g=this.gl;for(const m of this.meshes)g.deleteBuffer(m.buffer);if(this.keyMesh)g.deleteBuffer(this.keyMesh.buffer);for(const t of this.textures)g.deleteTexture(t);g.deleteTexture(this.white);g.deleteProgram(this.program)}
}
// Canvas first-person fallback for WebViews with unavailable hardware acceleration.
class SoftwareRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('Grafica non disponibile su questo dispositivo.');this.software=true;this.quality='auto';this.depth=[];canvas.style.imageRendering='pixelated';this.resize()}
 resize(){const rect=this.canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height),target=this.quality==='high'?640:this.quality==='low'?320:480,w=Math.max(180,Math.min(target,Math.floor(360*aspect))),h=Math.max(100,Math.floor(w/aspect));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.image=this.ctx.createImageData(w,h)}}
 load(world){this.world=world;const pixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);this.wall=pixels(noiseTexture('wall',world.level));this.floor=pixels(noiseTexture('floor',world.level));this.ceiling=pixels(noiseTexture('ceiling',world.level));this.door=pixels(doorTexture(world.level));this.lamps=new Set(world.lamps.map(p=>Math.floor(p.z/CELL)*world.n+Math.floor(p.x/CELL)))}
 draw(p,hasKey,time,bob=0){
  this.resize();const w=this.canvas.width,h=this.canvas.height,data=this.image.data,world=this.world,dirX=Math.sin(p.yaw),dirZ=-Math.cos(p.yaw),rightX=Math.cos(p.yaw),rightZ=Math.sin(p.yaw),proj=h/(2*Math.tan(72*Math.PI/360)),eye=1.62+bob,horizon=h/2+Math.tan(p.pitch)*proj,plane=w/(2*proj);
  // Horizontal planes are perspective-correct, not screen-space gradients.
  for(let y=0;y<h;y++){
   const ceiling=y<horizon,dist=(ceiling?HEIGHT-eye:eye)*proj/Math.max(.1,Math.abs(y-horizon)),texture=ceiling?this.ceiling:this.floor,shade=Math.max(.22,.82-dist*.012);
   for(let x=0;x<w;x++){
    const rayX=dirX+rightX*(x*2/w-1)*plane,rayZ=dirZ+rightZ*(x*2/w-1)*plane,px=p.x+rayX*dist,pz=p.z+rayZ*dist,repeat=ceiling?1:2,tx=((Math.floor(px/CELL*256*repeat)%256)+256)%256,tz=((Math.floor(pz/CELL*256*repeat)%256)+256)%256,t=(tz*256+tx)*4,i=(y*w+x)*4;
    let bright=shade;if(ceiling&&dist<35&&this.lamps.has(Math.floor(pz/CELL)*world.n+Math.floor(px/CELL))){const localX=((px%CELL)+CELL)%CELL-CELL/2,localZ=((pz%CELL)+CELL)%CELL-CELL/2;if(Math.abs(localX)<.51&&(Math.abs(localZ-.075)<.028||Math.abs(localZ+.075)<.028))bright=1.7}
    const fog=Math.min(.75,dist/55);for(let k=0;k<3;k++)data[i+k]=texture.data[t+k]*bright*(1-fog)+FOG[k]*fog;data[i+3]=255;
   }
  }
  for(let x=0;x<w;x++){
   const camera=x*2/w-1,rx=dirX+rightX*camera*plane,rz=dirZ+rightZ*camera*plane,px=p.x/CELL,pz=p.z/CELL;let mx=Math.floor(px),mz=Math.floor(pz),side=0,steps=0;
   const ddx=Math.abs(1/rx),ddz=Math.abs(1/rz),sx=rx<0?-1:1,sz=rz<0?-1:1;let sdX=(rx<0?px-mx:mx+1-px)*ddx,sdZ=(rz<0?pz-mz:mz+1-pz)*ddz;
   while(steps++<world.n*4){if(sdX<sdZ){sdX+=ddx;mx+=sx;side=0}else{sdZ+=ddz;mz+=sz;side=1}if(mx<0||mz<0||mx>=world.n||mz>=world.n||world.grid[mz*world.n+mx])break}
   const dist=Math.max(.025,(side?sdZ-ddz:sdX-ddx)*CELL);this.depth[x]=dist;
   const top=horizon-(HEIGHT-eye)*proj/dist,bottom=horizon+eye*proj/dist,hitX=p.x+rx*dist,hitZ=p.z+rz*dist,wallU=((side?hitX:hitZ)/CELL*2)%1;
   const door=world.door,normalDistance=Math.abs((hitX-door.x)*door.dx+(hitZ-door.z)*door.dz),tangent=(hitX-door.x)*door.dz-(hitZ-door.z)*door.dx,isDoor=normalDistance<.1&&Math.abs(tangent)<.61;
   const shade=(side ? .82 : .94)*Math.max(.32,1-dist*.024),fog=Math.min(.65,dist/55);
   for(let y=Math.max(0,Math.ceil(top));y<Math.min(h,Math.ceil(bottom));y++){
    const worldY=eye+(horizon-y)*dist/proj,atDoor=isDoor&&worldY<2.2,texture=atDoor?this.door:this.wall,tx=atDoor?Math.max(0,Math.min(255,Math.floor((tangent/.61*.5+.5)*256))):((Math.floor(wallU*256)%256)+256)%256,ty=atDoor?Math.max(0,Math.min(511,Math.floor((1-worldY/2.2)*512))):((Math.floor((1-worldY/HEIGHT)*512)%256)+256)%256,t=(ty*256+tx)*4,i=(y*w+x)*4;
    for(let k=0;k<3;k++)data[i+k]=texture.data[t+k]*shade*(1-fog)+FOG[k]*fog;data[i+3]=255;
    if(worldY<.13&&!atDoor){data[i]*=.46;data[i+1]*=.44;data[i+2]*=.43}
   }
  }
  this.ctx.putImageData(this.image,0,0);
  if(!hasKey){const dx=world.keyPosition.x-p.x,dz=world.keyPosition.z-p.z,depth=dx*dirX+dz*dirZ,lateral=dx*rightX+dz*rightZ;if(depth>.15){const cx=w/2+lateral/depth*proj,cy=horizon+(eye-1.05-Math.sin(time*2)*.045)/depth*proj,size=.52*proj/depth;if(cx>=0&&cx<w&&depth<this.depth[Math.floor(cx)]){const c=this.ctx;c.save();c.translate(cx,cy);c.scale(size,size);c.strokeStyle='#f2d675';c.lineWidth=.065;c.shadowColor='#f2d675';c.shadowBlur=5;c.beginPath();c.arc(-.2,0,.18,0,Math.PI*2);c.moveTo(-.02,0);c.lineTo(.45,0);c.moveTo(.25,0);c.lineTo(.25,.16);c.moveTo(.4,0);c.lineTo(.4,.16);c.stroke();c.restore()}}}
 }
 destroy(){}
}
