import {SurfaceBank} from './materials.js';
import {avatarSprite,skyCanvas,shadowCanvas,litColor,decorSprite,showcaseSprite} from './visuals.js';
import {CELL,HEIGHT,random,doorBasis,forwardVector,DOOR_HALF,DOOR_HEIGHT,free} from './core.js';
import {FLOORS,ARENA_LIGHT,CROUCH_OFFSET,worldFor} from './adventure.js';
import {framePose,FRAME_WIDTH,FRAME_LENGTH} from './traps.js';
import {mirrorCorners,mirrorSide,reflectPoint} from './mirrors.js';
import {colosseumMeshes,crowdSeats,arcadeTile,ARCADE_TOP,ARCH_BAYS,CROWD_COLORS,STONE_HEIGHT} from './colosseum.js';
import {armPose,between,limbModel} from './character.js';
import {SPRING_HEIGHT,netDeflection} from './spring.js?v=arena2';
const VS=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uViewProjection;uniform mat4 uModel;uniform float uCrowd;uniform vec3 uNetDip;uniform mediump float uTime;varying mediump vec3 vPosition;varying mediump vec3 vNormal;varying mediump vec2 vUV;void main(){vec4 p=uModel*vec4(aPosition,1.);float sway=uCrowd*sin(uTime*1.8+aPosition.x*1.38+aPosition.z*1.78);p.x+=sway*.035;p.y+=sway*.024;if(uNetDip.z>0.){vec2 d=p.xz-uNetDip.xy;p.y-=uNetDip.z*max(0.,1.-dot(d,d)*.25);}vPosition=p.xyz;vec3 x=uModel[0].xyz,y=uModel[1].xyz,z=uModel[2].xyz;vNormal=x*aNormal.x/dot(x,x)+y*aNormal.y/dot(y,y)+z*aNormal.z/dot(z,z);vUV=aUV;gl_Position=uViewProjection*p;}`;
const FS=`precision mediump float;varying mediump vec3 vPosition;varying mediump vec3 vNormal;varying mediump vec2 vUV;uniform sampler2D uTexture;uniform vec3 uColor;uniform vec3 uCamera;uniform vec3 uLights[8];uniform float uEmission;uniform float uTime;uniform vec3 uAmbient;uniform vec3 uTint;uniform vec3 uFog;uniform float uPower;uniform float uVisibility;uniform float uAlpha;uniform float uSky;uniform vec4 uClip;uniform vec2 uMirrorScale;void main(){if(dot(vec4(vPosition,1.),uClip)<0.)discard;if(uMirrorScale.x>0.){vec3 reflected=texture2D(uTexture,gl_FragCoord.xy*uMirrorScale).rgb;gl_FragColor=vec4(reflected*.93+vec3(.035,.048,.055),1.);return;}if(uSky>.5){gl_FragColor=texture2D(uTexture,vUV);return;}vec3 n=normalize(vNormal);vec3 light=uAmbient;for(int i=0;i<8;i++){vec3 d=uLights[i]-vPosition;float r=dot(d,d);float diffuse=max(dot(n,normalize(d)),.025);light+=uTint*diffuse*uPower/(1.+r*.22);}vec4 tex=texture2D(uTexture,vUV);vec3 c=tex.rgb*uColor; c*=mix(light,vec3(1.1),uEmission);float fog=1.-exp(-pow(length(vPosition-uCamera)/uVisibility,1.55));c=mix(c,uFog,clamp(fog,0.,.92));gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(.94)),uAlpha*tex.a);}`;
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function cameraMatrix(p,aspect,bob=0){
 const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch),eye=[p.x,1.62+bob,p.z],right=[cy,0,sy],up=[-sy*sp,cp,cy*sp],f=[sy*cp,sp,-cy*cp],v=identity();
 for(let i=0;i<3;i++){v[i*4]=right[i];v[i*4+1]=up[i];v[i*4+2]=-f[i]}v[12]=-right.reduce((s,x,i)=>s+x*eye[i],0);v[13]=-up.reduce((s,x,i)=>s+x*eye[i],0);v[14]=f.reduce((s,x,i)=>s+x*eye[i],0);
 const near=.055,far=65,scale=1/Math.tan(72*Math.PI/360),pr=new Float32Array([scale/aspect,0,0,0,0,scale,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);return {matrix:multiply(pr,v),eye};
}
function reflectedCamera(camera,mirror){
 const {nx,nz}=mirror,reflection=identity(),offset=2*(nx*mirror.x+nz*mirror.z);
 reflection[0]-=2*nx*nx;reflection[2]=reflection[8]=-2*nx*nz;reflection[10]-=2*nz*nz;
 reflection[12]=offset*nx;reflection[14]=offset*nz;
 const eye=reflectPoint(mirror,{x:camera.eye[0],y:camera.eye[1],z:camera.eye[2]});
 return {matrix:multiply(camera.matrix,reflection),eye:[eye.x,eye.y,eye.z]};
}
function clipPoint(matrix,{x,y,z}){
 return [0,1,2,3].map(i=>matrix[i]*x+matrix[i+4]*y+matrix[i+8]*z+matrix[i+12]);
}
function visibleMirror(world,mirror,player,matrix){
 const distance=Math.hypot(mirror.x-player.x,mirror.z-player.z);
 if(distance>9||mirrorSide(mirror,player)<.08)return false;
 const corners=mirrorCorners(mirror).map(p=>clipPoint(matrix,p));
 if(corners.every(p=>p[3]<.05)||[0,1].some(axis=>[-1,1].some(side=>corners.every(p=>p[axis]*side>p[3]))))return false;
 for(let t=.12;t<.99;t+=.12)if(!free(world,player.x+(mirror.x-player.x)*t,player.z+(mirror.z-player.z)*t,.008))return false;
 return true;
}
class Geometry{
 constructor(){this.data=[]}
 quad(a,b,c,d,n,uv=[0,0,1,1]){const points=[a,b,c,a,c,d],coords=[[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]];for(let i=0;i<6;i++)this.data.push(...points[i],...n,...coords[i])}
 sphere(x,y,z,rx,ry,rz,rows=8,cols=12){this.ellipsoid(x,y,z,rx,ry,rz,rows,cols,()=>Math.PI)}
 hair(x,y,z,rx,ry,rz){this.ellipsoid(x,y,z,rx,ry,rz,7,14,b=>1.55+.43*Math.sin(b))}
 ellipsoid(x,y,z,rx,ry,rz,rows,cols,end){const point=(t,b)=>{const a=t*end(b),nx=Math.sin(a)*Math.cos(b),ny=Math.cos(a),nz=Math.sin(a)*Math.sin(b),len=Math.hypot(nx/rx,ny/ry,nz/rz);return {p:[x+nx*rx,y+ry+ny*ry,z+nz*rz],n:[nx/rx/len,ny/ry/len,nz/rz/len],uv:[b/(Math.PI*2),t]}};for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=point(i/rows,j/cols*Math.PI*2),b=point((i+1)/rows,j/cols*Math.PI*2),c=point((i+1)/rows,(j+1)/cols*Math.PI*2),d=point(i/rows,(j+1)/cols*Math.PI*2);for(const v of [a,b,c,a,c,d])this.data.push(...v.p,...v.n,...v.uv)}}
 box(x,y,z,w,h,d){const a=x-w/2,b=x+w/2,c=y,e=y+h,f=z-d/2,g=z+d/2;this.quad([a,c,g],[b,c,g],[b,e,g],[a,e,g],[0,0,1]);this.quad([b,c,f],[a,c,f],[a,e,f],[b,e,f],[0,0,-1]);this.quad([a,c,f],[a,c,g],[a,e,g],[a,e,f],[-1,0,0]);this.quad([b,c,g],[b,c,f],[b,e,f],[b,e,g],[1,0,0]);this.quad([a,e,g],[b,e,g],[b,e,f],[a,e,f],[0,1,0]);this.quad([a,c,f],[b,c,f],[b,c,g],[a,c,g],[0,-1,0])}
}
function surfaceCanvas(map){const canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height;const c=canvas.getContext('2d'),image=c.createImageData(map.width,map.height);image.data.set(map.data);c.putImageData(image,0,0);return canvas}
function doorTexture(level,label='USCITA'){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d'),g=c.createLinearGradient(0,0,256,512);g.addColorStop(0,'#899084');g.addColorStop(.5,'#626d61');g.addColorStop(1,'#465347');c.fillStyle='#293930';c.fillRect(0,0,256,512);c.fillStyle=g;c.fillRect(12,10,232,502);c.strokeStyle='#c2c8b148';c.lineWidth=2;c.strokeRect(23,22,210,476);c.strokeStyle='#344236';c.strokeRect(31,31,194,465);c.fillStyle='#1e3d2f';c.fillRect(52,67,152,66);c.fillStyle='#d8e5cd';c.textAlign='center';c.font='bold 23px sans-serif';c.fillText(label,128,109);c.font='15px monospace';c.fillStyle='#c1cbb6';c.fillText(String(level).padStart(2,'0'),128,167);c.fillStyle='#334337';c.fillRect(186,242,23,72);c.fillStyle='#a6b39b';c.fillRect(191,252,9,51);c.fillRect(169,261,34,8);for(const y of [199,332,350,368,386,404]){c.fillStyle='#344439';c.fillRect(48,y,112,2);c.fillStyle='#b3beaa38';c.fillRect(48,y+2,112,1)}return canvas}
// Draw the next entrance once using its actual spawn direction and layout.
function portalCanvas(world){
 const target=worldFor(world.seed,world.level+1),pal=target.palette,canvas=document.createElement('canvas');
 const w=canvas.width=128,h=canvas.height=256,c=canvas.getContext('2d'),image=c.createImageData(w,h);
 const {spawn}=target,dir=forwardVector(spawn.yaw),eye=1.62,focal=180,horizon=(1-eye/DOOR_HEIGHT)*h;
 const base=target.arena?[[120,151,172],[172,165,142],[104,112,100]]:[[142,146,130],[143,139,118],[163,162,144]];
 for(let x=0;x<w;x++){
  const side=(x+.5-w/2)/focal,rx=dir.x-dir.z*side,rz=dir.z+dir.x*side;
  let depth=.2;
  for(;depth<22;depth+=.085){
   const px=spawn.x+rx*depth,pz=spawn.z+rz*depth;
   if(target.arena){const o=target.oval;if(((px-o.cx)/o.rx)**2+((pz-o.cz)/o.rz)**2>=1)break}
   else if(target.grid[Math.floor(pz/CELL)*target.n+Math.floor(px/CELL)])break;
  }
  for(let y=0;y<h;y++){
   const height=eye+(horizon-y-.5)*depth/focal,part=height<0?1:height>HEIGHT?0:2;
   const d=part===2?depth:(part===0?HEIGHT-eye:eye)*focal/Math.max(.1,Math.abs(horizon-y-.5));
   const px=spawn.x+rx*d,pz=spawn.z+rz*d;
   const seam=Math.min(px%CELL,pz%CELL)<.04;
   const neon=!target.arena&&part===0&&target.lamps.some(l=>Math.abs(px-l.x)<.54&&Math.abs(pz-l.z)<.13);
   const shade=neon?1.45:part===2&&height<.13?.49:seam&&part!==2?.72:Math.max(.38,1-d*.035);
   const i=(y*w+x)*4;
   for(let k=0;k<3;k++)image.data[i+k]=(neon?235:base[part][k])*shade*(target.arena?1:.15+.85*softwareLight(pal,k));
   image.data[i+3]=255;
  }
 }
 c.putImageData(image,0,0);
 return canvas;
}
export function avatarTransform(p,height=0){
 const model=identity(),dir=forwardVector(p.yaw);
 model[0]=model[10]=-dir.z;model[2]=dir.x;model[8]=-dir.x;
 if(p.crouch)model[5]=.72;
 model[12]=p.x;model[13]=height;model[14]=p.z;
 return model;
}
function headTransform(model,pitch){
 const head=identity(),angle=pitch*.6,pivot=1.56;
 head[5]=head[10]=Math.cos(angle);head[6]=Math.sin(angle);head[9]=-head[6];
 head[13]=pivot*(1-head[5]);head[14]=-pivot*head[6];
 return multiply(model,head);
}
function frameTransform(frame,pose){
 const m=identity(),s=Math.sin(pose.angle),c=Math.cos(pose.angle);
 m[0]=-frame.dz;m[2]=frame.dx;
 m[4]=frame.dx*s;m[5]=c;m[6]=frame.dz*s;
 m[8]=frame.dx*c;m[9]=-s;m[10]=frame.dz*c;
 m[12]=frame.x;m[13]=pose.y;m[14]=frame.z;
 return m;
}
function frameCanvas(){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=256;
 const c=canvas.getContext('2d'),sky=c.createLinearGradient(0,0,0,256);
 sky.addColorStop(0,'#2b565c');sky.addColorStop(.52,'#b3ae79');sky.addColorStop(1,'#263f36');
 c.fillStyle='#553923';c.fillRect(0,0,64,256);c.fillStyle='#c3a267';c.fillRect(3,3,58,250);
 c.fillStyle=sky;c.fillRect(6,7,52,242);c.fillStyle='#e2ca91';c.beginPath();c.arc(39,71,8,0,Math.PI*2);c.fill();
 for(const [y,color] of [[133,'#456255'],[161,'#364f43'],[198,'#253e36']]){
  c.fillStyle=color;c.beginPath();c.moveTo(6,249);c.lineTo(6,y+20);c.lineTo(22,y);c.lineTo(40,y+27);c.lineTo(58,y+10);c.lineTo(58,249);c.closePath();c.fill();
 }
 return canvas;
}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!gl)return new SoftwareRenderer(canvas);this.gl=gl;
  this.anisotropic=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  this.anisotropy=this.anisotropic?Math.min(4,gl.getParameter(this.anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader non disponibile: '+gl.getShaderInfoLog(s));return s};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Renderer non disponibile.');this.program=program;gl.useProgram(program);
  this.attrs=['aPosition','aNormal','aUV'].map(n=>gl.getAttribLocation(program,n));this.uniforms=Object.fromEntries(['uViewProjection','uModel','uTexture','uColor','uCamera','uLights[0]','uEmission','uTime','uAmbient','uTint','uFog','uPower','uVisibility','uAlpha','uSky','uCrowd','uNetDip','uClip','uMirrorScale'].map(n=>[n,gl.getUniformLocation(program,n)]));gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.2,.18,.115,1);gl.uniform1i(this.uniforms.uTexture,0);
  gl.uniform1f(this.uniforms.uAlpha,1);const white=document.createElement('canvas');white.width=white.height=1;white.getContext('2d').fillRect(0,0,1,1);const ctx=white.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);this.white=this.texture(white);this.surfaces=new SurfaceBank();this.generation=0;this.closed=false;this.resolutionScale=1;this.meshes=[];this.textures=[];this.quality='auto';this.resize();
 }
 texture(canvas){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.REPEAT);if(this.anisotropy>1)g.texParameterf(g.TEXTURE_2D,this.anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,this.anisotropy);g.generateMipmap(g.TEXTURE_2D);return t}
 mesh(geometry,texture=null,color=[1,1,1],emission=0){const g=this.gl,buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(geometry.data),g.STATIC_DRAW);return {buffer,count:geometry.data.length/8,texture:texture||this.white,color,emission}}
 resize(){const rect=this.canvas.getBoundingClientRect(),limit=this.quality==='low'?720:this.quality==='high'?1920:1280,scale=Math.min(devicePixelRatio||1,this.quality==='high'?2:1.5,limit/Math.max(rect.width,rect.height))*Math.max(.65,Math.min(1,this.resolutionScale||1));const w=Math.max(1,Math.floor(rect.width*scale)),h=Math.max(1,Math.floor(rect.height*scale));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h)}}
 load(world){
  const generation=++this.generation;this.lightClock=-Infinity;this.boundTexture=null;
  const gl=this.gl;for(const m of this.meshes)gl.deleteBuffer(m.buffer);if(this.keyMesh)gl.deleteBuffer(this.keyMesh.buffer);for(const m of this.props||[])gl.deleteBuffer(m.buffer);for(const t of this.textures)gl.deleteTexture(t);this.world=world;
  const wall=new Geometry(),floor=new Geometry(),ceiling=new Geometry(),trim=new Geometry(),frames=new Geometry(),light=new Geometry(),door=new Geometry(),key=new Geometry();
  const exit=world.door,axes=doorBasis(exit),exitCell=world.exit;
  const doorway=(x,z,dx,dz)=>z*world.n+x===exitCell&&exit.dx===dx&&exit.dz===dz;
  const opening=(u,y)=>[exit.x+axes.rightX*u+exit.dx*.06,y,exit.z+axes.rightZ*u+exit.dz*.06];
  const skirting=(x,z,xx,zz,n)=>trim.quad([x,.002,z],[xx,.002,zz],[xx,.13,zz],[x,.13,z],n);
  const portalNormal=[axes.normalX,0,axes.normalZ];
  if(!world.arena){
   const face=(left,right,bottom,top)=>wall.quad(opening(left,bottom),opening(right,bottom),opening(right,top),opening(left,top),portalNormal,[0,0,2,2]);
   face(-CELL/2,-DOOR_HALF,0,HEIGHT);face(DOOR_HALF,CELL/2,0,HEIGHT);face(-DOOR_HALF,DOOR_HALF,DOOR_HEIGHT,HEIGHT);
   for(const side of [-1,1]){
    const u=side*(DOOR_HALF+.04),[x,,z]=opening(u,0);frames.box(x,0,z,.08,DOOR_HEIGHT+.08,.08);
   }
   const [x,,z]=opening(0,0);frames.box(x,DOOR_HEIGHT,z,exit.dx?.08:1.38,.08,exit.dz?.08:1.38);
  }
  for(let z=world.arena?0:1;z<(world.arena?world.n:world.n-1);z++)for(let x=world.arena?0:1;x<(world.arena?world.n:world.n-1);x++)if(world.arena||!world.grid[z*world.n+x]){
   const a=x*CELL,b=(x+1)*CELL,c=z*CELL,d=(z+1)*CELL;
   floor.quad([a,0,c],[b,0,c],[b,0,d],[a,0,d],[0,1,0],[x*2,z*2,(x+1)*2,(z+1)*2]);
   if(!world.arena)ceiling.quad([a,HEIGHT,d],[b,HEIGHT,d],[b,HEIGHT,c],[a,HEIGHT,c],[0,-1,0],[x,z,x+1,z+1]);
   if(!world.arena&&world.grid[z*world.n+x-1]&&!doorway(x,z,-1,0)){wall.quad([a,0,d],[a,0,c],[a,HEIGHT,c],[a,HEIGHT,d],[1,0,0],[0,0,2,2]);skirting(a+.014,d,a+.014,c,[1,0,0])}
   if(!world.arena&&world.grid[z*world.n+x+1]&&!doorway(x,z,1,0)){wall.quad([b,0,c],[b,0,d],[b,HEIGHT,d],[b,HEIGHT,c],[-1,0,0],[0,0,2,2]);skirting(b-.014,c,b-.014,d,[-1,0,0])}
   if(!world.arena&&world.grid[(z-1)*world.n+x]&&!doorway(x,z,0,-1)){wall.quad([a,0,c],[b,0,c],[b,HEIGHT,c],[a,HEIGHT,c],[0,0,1],[0,0,2,2]);skirting(a,c+.014,b,c+.014,[0,0,1])}
   if(!world.arena&&world.grid[(z+1)*world.n+x]&&!doorway(x,z,0,1)){wall.quad([b,0,d],[a,0,d],[a,HEIGHT,d],[b,HEIGHT,d],[0,0,-1],[0,0,2,2]);skirting(b,d-.014,a,d-.014,[0,0,-1])}
  }
  if(world.oval){const o=world.oval;for(let i=0;i<96;i++){const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2,x=o.cx+Math.cos(a)*o.rx,z=o.cz+Math.sin(a)*o.rz,xx=o.cx+Math.cos(b)*o.rx,zz=o.cz+Math.sin(b)*o.rz,n=[-Math.cos((a+b)/2),0,-Math.sin((a+b)/2)];wall.quad([x,0,z],[xx,0,zz],[xx,STONE_HEIGHT-.3,zz],[x,STONE_HEIGHT-.3,z],n,[i/2,0,(i+1)/2,2]);trim.quad([x,STONE_HEIGHT-.37,z],[xx,STONE_HEIGHT-.37,zz],[xx,STONE_HEIGHT-.29,zz],[x,STONE_HEIGHT-.29,z],n)}}
  if(!world.arena)for(const p of world.lamps){frames.box(p.x,HEIGHT-.055,p.z,1.18,.04,.34);for(const dz of [-.075,.075])light.quad([p.x-.51,HEIGHT-.06,p.z+dz-.025],[p.x+.51,HEIGHT-.06,p.z+dz-.025],[p.x+.51,HEIGHT-.06,p.z+dz+.025],[p.x-.51,HEIGHT-.06,p.z+dz+.025],[0,-1,0])}
  const p=world.door,basis=doorBasis(p),n=[basis.normalX,0,basis.normalZ],right=[basis.rightX,0,basis.rightZ],v=(dx,y)=>[p.x+right[0]*dx+n[0]*.015,y,p.z+right[2]*dx+n[2]*.015];door.quad(v(-.61,0),v(.61,0),v(.61,2.2),v(-.61,2.2),n);
  key.box(0,.014,0,.32,.012,.20);
  const preview=this.surfaces.preview(world.level),textures=[this.texture(surfaceCanvas(preview.wall)),this.texture(surfaceCanvas(preview.floor)),this.texture(surfaceCanvas(preview.ceiling)),this.texture(doorTexture(world.level,world.arena?'INDIETRO':'USCITA'))];this.textures=textures;this.surfaces.request(world.level).then(maps=>{if(this.closed||generation!==this.generation||!maps)return;for(const [i,key] of ['wall','floor','ceiling'].entries()){gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,surfaceCanvas(maps[key]));gl.generateMipmap(gl.TEXTURE_2D)}this.boundTexture=null;this.surfaces.request(world.level===6?1:world.level+1)});
  this.meshes=[this.mesh(wall,textures[0]),this.mesh(floor,textures[1]),this.mesh(ceiling,textures[2]),this.mesh(trim,null,[.26,.23,.14]),this.mesh(frames,null,[.23,.24,.2]),this.mesh(light,null,world.level===1?[1,.98,.79]:world.palette?.light||[1,.98,.79],world.level===1?1:world.arena?.5:world.level===5?.025:world.level===4?.12:.3),this.mesh(door,textures[3])];this.exitMesh=this.meshes.pop();this.keyMesh=this.mesh(key,null,[.64,.64,.6],0);
  const stripe=new Geometry();stripe.box(0,.027,-.045,.30,.002,.045);this.stripeMesh=this.mesh(stripe);this.props=[this.stripeMesh,this.exitMesh];
  const legs=new Geometry(),shirt=new Geometry(),shorts=new Geometry(),wornPack=new Geometry(),packRoll=new Geometry();
  for(const x of [-.119,.119]){
   legs.sphere(x,.105,-.016,.069,.265,.079);
   shorts.sphere(x,.50,.008,.112,.186,.135);
  }
  shirt.sphere(0,.77,.008,.242,.303,.149);shirt.sphere(0,1.07,0,.23,.15,.143);
  wornPack.box(0,.79,.23,.37,.43,.24);
  wornPack.sphere(0,1.105,.285,.20,.063,.102,5,10);
  for(const x of [-.10,.10]){
   packRoll.box(x,.83,.357,.034,.32,.018);
   packRoll.box(x,.96,-.123,.034,.31,.02);
  }
  packRoll.sphere(0,1.20,.25,.23,.062,.081,5,10);
  this.bodySkin=this.mesh(legs,null,[.86,.60,.51]);this.bodyShirt=this.mesh(shirt);this.bodyShorts=this.mesh(shorts);
  this.wornPack=this.mesh(wornPack,null,[.41,.24,.13]);this.packRoll=this.mesh(packRoll,null,[.70,.59,.40]);
  this.props.push(this.bodySkin,this.bodyShirt,this.bodyShorts,this.wornPack,this.packRoll);
  const head=new Geometry(),hair=new Geometry(),eyes=new Geometry(),accent=new Geometry(),shoes=new Geometry(),soles=new Geometry();
  head.sphere(0,1.34,0,.173,.204,.155);head.sphere(0,1.275,0,.081,.094,.075,5,8);
  for(const sign of [-1,1]){
   head.sphere(sign*.164,1.51,0,.028,.056,.026,5,8);
   eyes.sphere(sign*.059,1.56,-.145,.032,.024,.014,5,9);
   hair.sphere(sign*.059,1.563,-.162,.012,.015,.008,4,8);
   hair.sphere(sign*.059,1.618,-.14,.029,.008,.008,4,8);
   soles.sphere(sign*.119,.008,-.075,.087,.021,.165,6,12);
   shoes.sphere(sign*.119,.038,-.077,.084,.063,.159,8,14);
   shoes.sphere(sign*.119,.075,.01,.077,.075,.086,6,12);
   accent.sphere(sign*.119,.55,-.09,.10,.018,.075,5,10);
   accent.box(sign*.119,.139,-.108,.074,.012,.024);
  }
  head.sphere(0,1.506,-.151,.024,.036,.035,5,9);
  hair.hair(0,1.344,0,.179,.21,.161);hair.sphere(-.04,1.66,-.119,.067,.034,.038,5,9);
  hair.sphere(0,1.464,-.143,.034,.006,.009,5,9);
  accent.sphere(0,1.33,-.108,.076,.018,.037,5,10);
  this.remoteHead=this.mesh(head,null,[.92,.68,.60]);this.remoteHair=this.mesh(hair,null,[.23,.17,.12]);this.remoteEyes=this.mesh(eyes,null,[.96,.94,.87]);
  this.bodyAccent=this.mesh(accent,null,[.83,.83,.75]);this.bodyShoes=this.mesh(shoes,null,[.14,.17,.16]);this.shoeSoles=this.mesh(soles,null,[.64,.63,.53]);
  const upper=new Geometry(),lower=new Geometry(),sleeve=new Geometry(),hand=new Geometry(),blade=new Geometry(),hilt=new Geometry(),hips=new Geometry(),thigh=new Geometry(),shin=new Geometry();
  hips.sphere(0,.66,.112,.218,.101,.131,9,15);
  thigh.sphere(0,-.16,0,.108,.60,.104,9,14);shin.sphere(0,-.14,0,.061,.63,.064,8,13);
  this.hips=this.mesh(hips);this.thigh=this.mesh(thigh);this.shin=this.mesh(shin,null,[.86,.60,.51]);
  upper.sphere(0,-.10,0,.069,.62,.071,8,15);lower.sphere(0,-.14,0,.058,.625,.061,7,12);
  sleeve.sphere(0,-.26,0,.092,.69,.092,7,12);
  hand.sphere(0,-.19,0,.057,.66,.049,7,12);hand.sphere(.037,.07,-.022,.025,.43,.023,6,10);
  for(const face of [-1,1]){
   const z=face*.014,normal=[0,0,face];
   blade.quad([-.055,.105,z],[.055,.105,z],[.041,.48,z],[-.041,.48,z],normal);
   blade.quad([-.041,.48,z],[.041,.48,z],[0,.64,0],[0,.64,0],normal);
   blade.quad([-.054,.11,z],[0,.11,z*1.6],[0,.58,z*1.1],[-.04,.48,z],[-.15,0,face]);
  }
  hilt.sphere(0,.07,0,.096,.026,.040,5,10);
  hilt.box(0,-.104,0,.036,.18,.036);
  hilt.sphere(0,-.147,0,.045,.04,.04,5,9);
  this.upperArm=this.mesh(upper,null,[.88,.63,.54]);this.lowerArm=this.mesh(lower,null,[.88,.63,.54]);
  this.sleeve=this.mesh(sleeve);this.hand=this.mesh(hand,null,[.93,.69,.60]);
  this.swordBlade=this.mesh(blade,null,[.76,.81,.81],.36);this.swordHilt=this.mesh(hilt,null,[.52,.37,.19]);
  this.props.push(this.remoteHead,this.remoteHair,this.remoteEyes,this.bodyAccent,this.bodyShoes,this.shoeSoles,this.hips,this.thigh,this.shin,this.upperArm,this.lowerArm,this.sleeve,this.hand,this.swordBlade,this.swordHilt);
  const helmet=new Geometry(),crest=new Geometry(),armor=new Geometry(),plateTrim=new Geometry();
  const shield=new Geometry(),shieldPaint=new Geometry(),boss=new Geometry(),straps=new Geometry();
  helmet.ellipsoid(0,1.28,.003,.198,.284,.181,7,14,b=>1.64+.31*Math.sin(b));
  helmet.sphere(0,1.625,-.09,.188,.027,.105,5,12);
  helmet.sphere(0,1.57,.10,.203,.030,.11,5,10);
  for(const side of [-1,1])helmet.sphere(side*.169,1.47,-.025,.034,.085,.08,5,10);
  crest.sphere(0,1.827,.018,.045,.070,.186,5,11);
  for(let row=0;row<5;row++){
   const y=.82+row*.087,width=.209+row*.005;
   armor.sphere(0,y,-.081,width,.055,.111,4,11);
   armor.sphere(0,y,.076,width,.055,.097,4,11);
  }
  for(const side of [-1,1]){
   for(let layer=0;layer<3;layer++)armor.sphere(side*(.18+layer*.018),1.24-layer*.045,0,.087,.04,.126,4,9);
   plateTrim.box(side*.105,.865,-.195,.022,.38,.014);
   for(let row=0;row<4;row++)plateTrim.sphere(side*.106,.885+row*.087,-.208,.017,.015,.013,4,7);
  }
  // Curved rectangular scutum, with separate bronze rim and painted boards.
  const board=(geo,width,halfHeight,offset)=>{
   for(let i=0;i<8;i++){
    const a=(i/4-1)*width,b=((i+1)/4-1)*width;
    const z=x=>-.12+1.65*x*x+offset;
    geo.quad([a,-halfHeight,z(a)],[b,-halfHeight,z(b)],[b,halfHeight,z(b)],[a,halfHeight,z(a)],[0,0,-1]);
   }
  };
  board(shield,.23,.33,0);board(shieldPaint,.205,.302,-.008);board(shieldPaint,.205,.302,.008);
  boss.sphere(0,-.066,-.128,.068,.066,.047,6,10);
  for(const side of [-1,1])for(const y of [-.17,.17]){
   const x=side*.158;boss.sphere(x,y-.023,-.102,.033,.022,.012,4,7);
   boss.quad([x-.024,y,-.107],[x+.024,y,-.107],[side*.055,y*.46,-.132],[side*.075,y*.46,-.132],[0,0,-1]);
  }
  for(const x of [-.075,.07])straps.sphere(x,-.116,-.079,.023,.118,.033,6,9);
  this.helmet=this.mesh(helmet,null,[.69,.52,.29],.23);
  this.crest=this.mesh(crest,null,[.63,.16,.11],.24);
  this.armor=this.mesh(armor,null,[.66,.64,.54],.18);
  this.armorTrim=this.mesh(plateTrim,null,[.72,.49,.25],.25);
  this.shieldRim=this.mesh(shield,null,[.69,.49,.23],.24);
  this.shieldFace=this.mesh(shieldPaint,null,[.56,.12,.09],.24);
  this.shieldBoss=this.mesh(boss,null,[.81,.62,.30],.27);
  this.shieldStraps=this.mesh(straps,null,[.29,.17,.08],.13);
  this.props.push(this.helmet,this.crest,this.armor,this.armorTrim,this.shieldRim,this.shieldFace,this.shieldBoss,this.shieldStraps);
  const mirrorRims=new Geometry();
  this.mirrorPanels=(world.mirrors||[]).map(mirror=>{
   const panel=new Geometry(),rim=mirrorCorners(mirror,.055),vertices=mirrorCorners(mirror).map(p=>[p.x,p.y,p.z]),normal=[mirror.nx,0,mirror.nz];
   panel.quad(...vertices,normal);
   for(let i=0;i<4;i++){
    const j=(i+1)%4,outer=p=>[p.x+mirror.nx*.009,p.y,p.z+mirror.nz*.009];
    mirrorRims.quad(outer(rim[i]),outer(rim[j]),vertices[j],vertices[i],normal);
   }
   const mesh=this.mesh(panel,null,[.22,.29,.29],.30);this.props.push(mesh);return {mirror,mesh};
  });
  this.mirrorRims=this.mesh(mirrorRims,null,[.49,.48,.40],.38);this.props.push(this.mirrorRims);
  const shade=new Geometry();shade.quad([-.43,.008,-.35],[.43,.008,-.35],[.43,.008,.35],[-.43,.008,.35],[0,1,0]);this.contactShadow=this.mesh(shade,this.texture(shadowCanvas()),[0,0,0],0);this.textures.push(this.contactShadow.texture);this.props.push(this.contactShadow);

  if(!world.arena){
   const portal=new Geometry();portal.quad(opening(-DOOR_HALF,0),opening(DOOR_HALF,0),opening(DOOR_HALF,DOOR_HEIGHT),opening(-DOOR_HALF,DOOR_HEIGHT),portalNormal);
   const texture=this.texture(portalCanvas(world));this.textures.push(texture);
   this.openExit=this.mesh(portal,texture,[.91,.91,.91],1);this.props.push(this.openExit);
  }
  if(world.frames?.length){
   const board=new Geometry(),art=new Geometry(),half=FRAME_WIDTH/2;
   board.box(0,0,0,FRAME_WIDTH,FRAME_LENGTH,.065);
   art.quad([-half,0,.034],[half,0,.034],[half,FRAME_LENGTH,.034],[-half,FRAME_LENGTH,.034],[0,0,1]);
   const texture=this.texture(frameCanvas());this.textures.push(texture);
   this.frameBoard=this.mesh(board,null,[.35,.22,.13],.23);this.frameArt=this.mesh(art,texture,[1,1,1],.42);
   this.props.push(this.frameBoard,this.frameArt);
  }
  if(!world.arena&&world.level>1){const entry=new Geometry(),ep={x:world.spawn.x-CELL/2+.06,z:world.spawn.z,dx:-1,dz:0},eb=doorBasis(ep),ev=(u,y)=>[ep.x+eb.rightX*u+.02,y,ep.z+eb.rightZ*u];entry.quad(ev(-.61,0),ev(.61,0),ev(.61,2.2),ev(-.61,2.2),[1,0,0]);const et=this.texture(doorTexture(world.level-1,'INDIETRO'));this.textures.push(et);this.entryMesh=this.mesh(entry,et);this.props.push(this.entryMesh)}else this.entryMesh=null;
  if(world.arena){
   const sky=new Geometry(),r=45,low=-20,high=40;sky.quad([-r,low,-r],[r,low,-r],[r,high,-r],[-r,high,-r],[0,0,1]);sky.quad([r,low,-r],[r,low,r],[r,high,r],[r,high,-r],[-1,0,0]);sky.quad([r,low,r],[-r,low,r],[-r,high,r],[r,high,r],[0,0,-1]);sky.quad([-r,low,r],[-r,low,-r],[-r,high,-r],[-r,high,r],[1,0,0]);sky.quad([-r,high,-r],[r,high,-r],[r,high,r],[-r,high,r],[0,-1,0]);this.skyMesh=this.mesh(sky,this.texture(skyCanvas()),[1,1,1],1);this.textures.push(this.skyMesh.texture);this.props.push(this.skyMesh);
   const frame=new Geometry(),shelf=new Geometry(),glass=new Geometry(),nets=new Geometry(),springs=new Geometry();const c=world.showcase;
   for(const dx of [-1.05,1.05])for(const dz of [-.48,.48])frame.box(c.x+dx,0,c.z+dz,.065,2.15,.065);
   frame.box(c.x,2.1,c.z,2.18,.08,1.05);frame.box(c.x,.1,c.z,2.18,.12,1.05);shelf.box(c.x,.85,c.z,2.04,.07,.94);shelf.box(c.x,.2,c.z-.47,2.02,1.87,.025);
   glass.quad([c.x-1.02,.23,c.z+.48],[c.x+1.02,.23,c.z+.48],[c.x+1.02,2.1,c.z+.48],[c.x-1.02,2.1,c.z+.48],[0,0,1]);
   for(const net of world.nets){const hx=net.halfWidth,hz=net.halfDepth;for(const dx of [-hx,hx])springs.box(net.x+dx,0,net.z,.1,.48,hz*2+.1);for(const dz of [-hz,hz])springs.box(net.x,0,net.z+dz,hx*2+.1,.48,.1);
    const y=SPRING_HEIGHT,r=.016;
    for(let x=-hx+.15;x<hx;x+=.26)for(let z=-hz;z<hz;z+=.8){
     const a=net.x+x,b=net.z+z,c=net.z+Math.min(hz,z+.8);
     nets.quad([a-r,y,b],[a-r,y,c],[a+r,y,c],[a+r,y,b],[0,1,0]);
    }
    for(let z=-hz+.15;z<hz;z+=.26)for(let x=-hx;x<hx;x+=.8){
     const a=net.z+z,b=net.x+x,c=net.x+Math.min(hx,x+.8);
     nets.quad([b,y+.002,a-r],[b,y+.002,a+r],[c,y+.002,a+r],[c,y+.002,a-r],[0,1,0]);
    }
    for(let v=-hx+.15;v<hx;v+=.35)for(const side of [-1,1])springs.box(net.x+v,.32,net.z+side*(hz-.09),.045,.035,.19);
    for(let v=-hz+.15;v<hz;v+=.35)for(const side of [-1,1])springs.box(net.x+side*(hx-.09),.32,net.z+v,.19,.035,.045);
   }
   const m=(g,color,emission=0)=>{const mesh=this.mesh(g,null,color,emission);this.props.push(mesh);return mesh};this.caseFrame=m(frame,[.40,.27,.15]);this.caseShelf=m(shelf,[.47,.31,.18]);this.caseGlass=m(glass,[.78,.67,.5],.2);this.net=m(nets,[.45,.31,.19]);this.springs=m(springs,[.60,.39,.21]);
   const architecture=colosseumMeshes(world,Geometry),{seats,stairs,wall,cornice,recess,archStone,cloth,gold,crowd,heads}=architecture;
   this.colosseum=[
    m(seats,[.77,.65,.49],.18),m(stairs,[.65,.53,.39]),m(wall,[.84,.71,.54],.14),
    m(cornice,[.92,.81,.63],.21),m(recess,[.36,.28,.22]),m(archStone,[.93,.79,.58],.25),
    m(cloth,[.56,.11,.085],.21),m(gold,[.85,.64,.29],.24)
   ];
   this.crowd=crowd.map((group,index)=>m(group,hexColor(CROWD_COLORS[index]),.16));
   this.crowd.push(m(heads,[.72,.51,.34],.16));
   const clay=new Geometry(),metal=new Geometry(),flame=new Geometry();
   for(const d of world.decor){
    if(d.type==='amphora'){
     clay.sphere(d.x,.02,d.z,.34,.41,.31,6,11);
     clay.sphere(d.x,.71,d.z,.155,.10,.148,5,9);
     for(const sign of [-1,1])clay.sphere(d.x+sign*.296,.52,d.z,.066,.137,.062,5,8);
    }else{
     for(const sign of [-1,1])metal.box(d.x+sign*.22,0,d.z,.07,.9,.11);
     metal.sphere(d.x,.75,d.z,.37,.11,.37,5,11);
     flame.sphere(d.x,.93,d.z,.21,.15,.20,5,8);
    }
   }
   this.decorMeshes=[m(clay,[.69,.32,.20]),m(metal,[.37,.25,.15]),m(flame,[1,.52,.17],.90)];
  }

 }
 reflectionTarget(){
  const g=this.gl,w=Math.min(700,Math.max(1,Math.round(this.canvas.width*.56))),h=Math.max(1,Math.round(w*this.canvas.height/this.canvas.width));
  if(this.reflection?.w===w&&this.reflection.h===h)return this.reflection;
  if(this.reflectionFailed)return null;
  this.releaseReflection();
  const texture=g.createTexture(),framebuffer=g.createFramebuffer(),depth=g.createRenderbuffer();
  this.reflection={texture,framebuffer,depth,w,h};
  g.bindTexture(g.TEXTURE_2D,texture);this.boundTexture=null;
  g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
  for(const filter of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,filter,g.LINEAR);
  for(const wrap of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,wrap,g.CLAMP_TO_EDGE);
  g.bindRenderbuffer(g.RENDERBUFFER,depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,w,h);
  g.bindFramebuffer(g.FRAMEBUFFER,framebuffer);
  g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);
  g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,depth);
  const complete=g.checkFramebufferStatus(g.FRAMEBUFFER)===g.FRAMEBUFFER_COMPLETE;
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.bindRenderbuffer(g.RENDERBUFFER,null);
  if(!complete){this.releaseReflection();this.reflectionFailed=true}
  return this.reflection;
 }
 releaseReflection(){
  if(!this.reflection)return;
  const g=this.gl,{framebuffer,texture,depth}=this.reflection;
  g.deleteFramebuffer(framebuffer);g.deleteTexture(texture);g.deleteRenderbuffer(depth);
  this.reflection=null;this.boundTexture=null;
 }
 draw(player,hasKey,time,bob=0){
  this.resize();
  const g=this.gl,width=this.canvas.width,height=this.canvas.height,camera=cameraMatrix(player,width/height,bob);
  const palette=this.world.palette||FLOORS[Math.min(4,this.world.level-1)];
  const scene=this.scene||{items:!hasKey?[{...this.world.keyPosition,color:palette.stripe}]:[]};
  const mirror=this.mirrorPanels.filter(p=>visibleMirror(this.world,p.mirror,player,camera.matrix))
   .sort((a,b)=>Math.hypot(a.mirror.x-player.x,a.mirror.z-player.z)-Math.hypot(b.mirror.x-player.x,b.mirror.z-player.z))[0]?.mirror;
  const target=mirror?this.reflectionTarget():null;
  if(target){
   g.bindFramebuffer(g.FRAMEBUFFER,target.framebuffer);g.viewport(0,0,target.w,target.h);
   this.drawPass(player,scene,time,bob,palette,reflectedCamera(camera,mirror),mirror);
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,width,height);
  }
  this.drawPass(player,scene,time,bob,palette,camera,null,target?mirror:null);
 }
 drawPass(player,scene,time,bob,pal,{matrix,eye},reflected,activeMirror){
  const g=this.gl,u=this.uniforms;
  g.clearColor(...pal.fog,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);
  g.uniform3fv(u.uAmbient,pal.ambient);g.uniform3fv(u.uTint,pal.light);g.uniform3fv(u.uFog,pal.fog);
  g.uniform1f(u.uPower,pal.power);g.uniform1f(u.uVisibility,pal.visibility);g.uniform1f(u.uAlpha,1);
  g.uniformMatrix4fv(u.uViewProjection,false,matrix);g.uniform3fv(u.uCamera,eye);g.uniform1f(u.uTime,time);
  const clip=reflected?[reflected.nx,0,reflected.nz,-(reflected.x*reflected.nx+reflected.z*reflected.nz)-.008]:[0,0,0,1];
  g.uniform4fv(u.uClip,clip);g.uniform2f(u.uMirrorScale,0,0);
  if(time-this.lightClock>.12||Math.hypot(player.x-(this.lightX||0),player.z-(this.lightZ||0))>.65){const nearest=this.world.lamps.map(p=>({p,d:(p.x-player.x)**2+(p.z-player.z)**2})).sort((a,b)=>a.d-b.d).slice(0,8),lights=new Float32Array(24).fill(9999);nearest.forEach(({p},i)=>lights.set([p.x,p.y,p.z],i*3));g.uniform3fv(u['uLights[0]'],lights);this.lightClock=time;this.lightX=player.x;this.lightZ=player.z}
  g.uniform1f(u.uCrowd,0);g.uniform1f(u.uSky,0);if(this.world.arena){g.disable(g.DEPTH_TEST);g.depthMask(false);g.uniform1f(u.uSky,1);const sky=identity();sky[12]=player.x;sky[14]=player.z;this.drawMesh(this.skyMesh,sky);g.uniform1f(u.uSky,0);g.depthMask(true);g.enable(g.DEPTH_TEST)}
  for(const mesh of this.meshes)this.drawMesh(mesh,identity());
  this.drawMesh(scene.doorOpen&&!this.world.arena?this.openExit:this.exitMesh,identity());if(this.entryMesh)this.drawMesh(this.entryMesh,identity());
  for(const frame of this.world.frames||[]){
   if(Math.hypot(frame.x-player.x,frame.z-player.z)>pal.visibility*1.3)continue;
   const pose=framePose(scene.traps?.[frame.id],scene.serverNow??Date.now()),m=frameTransform(frame,pose);
   this.frameArt.emission=pose.phase==='warning'?.72:.42;
   this.drawMesh(this.frameBoard,m);this.drawMesh(this.frameArt,m);
  }
  for(const item of scene.items||[]){const m=identity();m[12]=item.x;m[14]=item.z;this.drawMesh(this.keyMesh,m);this.stripeMesh.color=hexColor(item.color);this.drawMesh(this.stripeMesh,m)}
  if(!reflected){
   this.drawMesh(this.mirrorRims,identity());
   for(const {mirror,mesh} of this.mirrorPanels){
    if(mirror===activeMirror){
     g.uniform2f(u.uMirrorScale,1/this.canvas.width,1/this.canvas.height);
     this.drawMesh({...mesh,texture:this.reflection.texture},identity());
     g.uniform2f(u.uMirrorScale,0,0);
    }else this.drawMesh(mesh,identity());
   }
  }
  if(scene.appearance&&(reflected||player.pitch<-.45||scene.weapon||scene.shield||scene.guard||scene.swing)){
   const me={...scene,player:{...player,height:Math.max(0,bob+(player.crouch?CROUCH_OFFSET:0))}};
   if(reflected){
    g.uniform3fv(u.uAmbient,pal.ambient.map(value=>Math.max(value,.24)));
    this.drawAvatar(me,scene.swing||0,scene.walk||0,false);
    g.uniform3fv(u.uAmbient,pal.ambient);
   }else{
    g.uniform3fv(u.uAmbient,pal.ambient.map(value=>Math.max(value,.23)));
    this.drawAvatar(me,scene.swing||0,scene.walk||0,true);
    g.uniform3fv(u.uAmbient,pal.ambient);
   }
  }
  for(const remote of scene.players||[]){
   const p=remote.player,distance=Math.hypot(p.x-eye[0],p.z-eye[2]);
   if(distance>Math.min(32,pal.visibility*1.8)||!reflected&&distance<.29||(!reflected&&(p.x-player.x)*Math.sin(player.yaw)-(p.z-player.z)*Math.cos(player.yaw)<-.8))continue;
   const swing=Math.max(0,.42-((scene.serverNow||Date.now())-(remote.actionAt||0))/1000);
   if(reflected||distance<4)g.uniform3fv(u.uAmbient,pal.ambient.map(value=>Math.max(value,reflected?.23:.13)));
   this.drawAvatar(remote,swing<=.42?swing:0,remote.walk||0,false,distance<13);
   if(reflected||distance<4)g.uniform3fv(u.uAmbient,pal.ambient);
   if(!reflected&&distance<12&&(this.resolutionScale||1)>.7){
    g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);g.uniform1f(u.uAlpha,.48);
    const shadow=identity();shadow[12]=p.x;shadow[14]=p.z;this.drawMesh(this.contactShadow,shadow);
    g.uniform1f(u.uAlpha,1);g.depthMask(true);g.disable(g.BLEND);
   }
  }
  if(this.world.arena){
   for(const mesh of this.colosseum)this.drawMesh(mesh,identity());
   g.uniform1f(u.uCrowd,scene.stillCrowd?0:1);
   for(const mesh of this.crowd)this.drawMesh(mesh,identity());
   g.uniform1f(u.uCrowd,0);
   g.uniform3fv(u.uNetDip,netDeflection(this.world.nets[0],player,scene));
   this.drawMesh(this.net,identity());
   g.uniform3fv(u.uNetDip,[0,0,0]);
   for(const mesh of [this.springs,...this.decorMeshes])this.drawMesh(mesh,identity());const boxes=scene.cases||[{...this.world.showcase,...scene,open:scene.showcaseOpen}];
   for(const box of boxes){const model=identity();model[12]=box.x-this.world.showcase.x;model[14]=box.z-this.world.showcase.z;for(const mesh of [this.caseFrame,this.caseShelf])this.drawMesh(mesh,model);
    const show=(meshes,x,y,scale)=>{
     const item=identity();item[0]=item[10]=-scale;item[5]=scale;
     item[12]=box.x+x;item[13]=y;item[14]=box.z+.04;
     for(const mesh of meshes)this.drawMesh(mesh,item);
    };
    if(!box.backpack)show([this.wornPack,this.packRoll],-.55,.36,.69);
    if(!box.swordTaken)show([this.swordBlade,this.swordHilt],.47,1.18,.99);
    if(!box.helmet)show([this.helmet,this.crest],-.68,-.48,.57);
    if(!box.armor)show([this.armor,this.armorTrim],0,-.21,.55);
    if(!box.shieldTaken)show([this.shieldRim,this.shieldFace,this.shieldBoss],.69,.54,.74);
    if(!box.open){g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);g.uniform1f(u.uAlpha,.24);this.drawMesh(this.caseGlass,model);g.uniform1f(u.uAlpha,1);g.depthMask(true);g.disable(g.BLEND)}
   }
  }


 }
 drawAvatar(avatar,swing,walk,firstPerson,details=true){
  const p=avatar.player,model=avatarTransform(p,p.height||0);
  this.bodyShirt.color=hexColor(avatar.appearance?.shirt);this.bodyShorts.color=hexColor(avatar.appearance?.shorts);
  this.sleeve.color=this.bodyShirt.color;
  const drawBody=!firstPerson||p.pitch<-.45;
  if(firstPerson&&drawBody){
   this.hips.color=this.thigh.color=this.bodyShorts.color;
   this.drawMesh(this.hips,model);
   for(const side of [-1,1]){
    const hip=[side*.105,.78,.093],knee=[side*.116,.43,-.126+walk*side],ankle=[side*.119,.13,-.215+walk*side];
    this.drawMesh(this.thigh,multiply(model,limbModel(hip,knee)));
    this.drawMesh(this.shin,multiply(model,limbModel(knee,ankle)));
   }
   const feet=identity();feet[14]=-.23;
   for(const mesh of [this.shoeSoles,this.bodyShoes])this.drawMesh(mesh,multiply(model,feet));
  }else if(drawBody){
   for(const mesh of [this.bodySkin,this.bodyShorts,this.bodyShoes,...(details?[this.shoeSoles,this.bodyAccent]:[])])this.drawMesh(mesh,model);
  }
  if(!firstPerson){
   this.drawMesh(this.bodyShirt,model);
   if(avatar.armor){this.drawMesh(this.armor,model);this.drawMesh(this.armorTrim,model)}
   if(avatar.backpack){this.drawMesh(this.wornPack,model);this.drawMesh(this.packRoll,model)}
   const head=headTransform(model,p.pitch||0);
   for(const mesh of [this.remoteHead,this.remoteHair,...(details?[this.remoteEyes]:[])])this.drawMesh(mesh,head);
   if(avatar.helmet){this.drawMesh(this.helmet,head);this.drawMesh(this.crest,head)}
  }
  if(firstPerson&&!drawBody&&!avatar.weapon&&!avatar.shield&&!avatar.guard&&!swing)return;
  for(const side of [-1,1]){
   if(firstPerson&&!drawBody&&(side===-1?!avatar.guard&&!avatar.shield:!avatar.guard&&!avatar.weapon&&!swing))continue;
   const {shoulder,elbow,wrist}=armPose(side,avatar.weapon==='sword',swing/.42,walk,firstPerson,avatar.guard,avatar.shield);
   this.drawMesh(this.sleeve,multiply(model,limbModel(shoulder,between(shoulder,elbow,.67))));
   this.drawMesh(this.upperArm,multiply(model,limbModel(between(shoulder,elbow,.42),elbow)));
   this.drawMesh(this.lowerArm,multiply(model,limbModel(elbow,wrist)));
   this.drawMesh(this.hand,multiply(model,limbModel(wrist,between(wrist,elbow,-.30))));
   if(side===-1&&avatar.shield){
    const shield=identity();shield[12]=wrist[0];shield[13]=wrist[1]-.04;shield[14]=wrist[2]-.063;
    const held=multiply(model,shield);this.drawMesh(this.shieldRim,held);this.drawMesh(this.shieldFace,held);this.drawMesh(this.shieldBoss,held);this.drawMesh(this.shieldStraps,held);
   }
   if(side===1&&avatar.weapon==='sword'){
    const weapon=identity(),tilt=avatar.guard&&!swing?-.93:-.42-Math.sin(Math.PI*swing/.42)*.86;
    weapon[5]=weapon[10]=Math.cos(tilt);weapon[6]=Math.sin(tilt);weapon[9]=-weapon[6];
    weapon[12]=wrist[0];weapon[13]=wrist[1];weapon[14]=wrist[2]-.045;
    const held=multiply(model,weapon);this.drawMesh(this.swordBlade,held);this.drawMesh(this.swordHilt,held);
   }
  }
 }
 drawMesh(m,model){if(!m.count)return;const g=this.gl,u=this.uniforms;g.bindBuffer(g.ARRAY_BUFFER,m.buffer);for(let i=0;i<3;i++){g.enableVertexAttribArray(this.attrs[i]);g.vertexAttribPointer(this.attrs[i],i===2?2:3,g.FLOAT,false,32,i===0?0:i===1?12:24)}if(this.boundTexture!==m.texture){g.bindTexture(g.TEXTURE_2D,m.texture);this.boundTexture=m.texture}g.uniformMatrix4fv(u.uModel,false,model);g.uniform3fv(u.uColor,m.color);g.uniform1f(u.uEmission,m.emission);g.drawArrays(g.TRIANGLES,0,m.count)}
 destroy(){this.closed=true;this.generation++;this.surfaces.destroy();this.releaseReflection();const g=this.gl;for(const m of this.meshes)g.deleteBuffer(m.buffer);if(this.keyMesh)g.deleteBuffer(this.keyMesh.buffer);for(const m of this.props||[])g.deleteBuffer(m.buffer);for(const t of this.textures)g.deleteTexture(t);g.deleteTexture(this.white);g.deleteProgram(this.program)}
}
// Canvas first-person fallback for WebViews with unavailable hardware acceleration.
class SoftwareRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('Grafica non disponibile su questo dispositivo.');this.software=true;this.surfaces=new SurfaceBank();this.generation=0;this.closed=false;this.resolutionScale=1;this.quality='auto';this.depth=[];canvas.style.imageRendering='auto';this.resize()}
 resize(){const rect=this.canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height),target=this.quality==='high'?640:this.quality==='low'?320:480,w=Math.max(180,Math.floor(Math.min(target,360*aspect)*Math.max(.65,Math.min(1,this.resolutionScale||1)))),h=Math.max(100,Math.floor(w/aspect));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.image=this.ctx.createImageData(w,h)}}
 load(world){this.world=world;const generation=++this.generation;this.doorAxes=doorBasis(world.door);const pixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),maps=this.surfaces.preview(world.level);this.wall=maps.wall;this.floor=maps.floor;this.ceiling=maps.ceiling;this.surfaces.request(world.level).then(m=>{if(this.closed||generation!==this.generation||!m)return;this.wall=m.wall;this.floor=m.floor;this.ceiling=m.ceiling;this.surfaces.request(world.level===6?1:world.level+1)});this.door=pixels(doorTexture(world.level,world.arena?'INDIETRO':'USCITA'));this.entry=pixels(doorTexture(world.level-1,'INDIETRO'));this.sky=pixels(skyCanvas());this.portal=world.arena?null:pixels(portalCanvas(world));this.arcade=world.arena?pixels(arcadeTile()):null;this.crowd=world.arena?crowdSeats(world):[];this.lamps=new Set(world.lamps.map(p=>Math.floor(p.z/CELL)*world.n+Math.floor(p.x/CELL)))}

 draw(p,hasKey,time,bob=0){
  this.resize();const pal=this.world.palette||FLOORS[Math.min(4,this.world.level-1)],fogColor=pal.fog.map(v=>v*255);const w=this.canvas.width,h=this.canvas.height,data=this.image.data,world=this.world,dirX=Math.sin(p.yaw),dirZ=-Math.cos(p.yaw),rightX=Math.cos(p.yaw),rightZ=Math.sin(p.yaw),proj=h/(2*Math.tan(72*Math.PI/360)),eye=1.62+bob,horizon=h/2+Math.tan(p.pitch)*proj,plane=w/(2*proj);
  // Horizontal planes are perspective-correct, not screen-space gradients.
  for(let y=0;y<h;y++){
   const ceiling=y<horizon,dist=(ceiling?HEIGHT-eye:eye)*proj/Math.max(.1,Math.abs(y-horizon)),texture=ceiling?this.ceiling:this.floor,shade=Math.max(.22,.82-dist*.012);
   for(let x=0;x<w;x++){
    const rayX=dirX+rightX*(x*2/w-1)*plane,rayZ=dirZ+rightZ*(x*2/w-1)*plane,px=p.x+rayX*dist,pz=p.z+rayZ*dist,repeat=ceiling?1:2,tx=((Math.floor(px/CELL*256*repeat)%256)+256)%256,tz=((Math.floor(pz/CELL*256*repeat)%256)+256)%256,t=texture.width===256?(tz*256+tx)*4:(Math.floor(tz/256*texture.height)*texture.width+Math.floor(tx/256*texture.width))*4,i=(y*w+x)*4;
    let bright=shade;if(ceiling&&dist<35&&this.lamps.has(Math.floor(pz/CELL)*world.n+Math.floor(px/CELL))){const localX=((px%CELL)+CELL)%CELL-CELL/2,localZ=((pz%CELL)+CELL)%CELL-CELL/2;if(Math.abs(localX)<.51&&(Math.abs(localZ-.075)<.028||Math.abs(localZ+.075)<.028))bright=1.7}
    const fog=Math.min(.75,dist/55);for(let k=0;k<3;k++)data[i+k]=texture.data[t+k]*bright*softwareLight(pal,k)*(1-fog)+fogColor[k]*fog;data[i+3]=255;if(world.arena&&ceiling){const sx=((Math.floor((p.yaw/(Math.PI*2)+x/w*.28)*512)%512)+512)%512,sy=Math.max(0,Math.min(255,Math.floor(y/Math.max(1,horizon)*255))),si=(sy*512+sx)*4;data[i]=this.sky.data[si];data[i+1]=this.sky.data[si+1];data[i+2]=this.sky.data[si+2]}else if(world.oval){const o=world.oval,r=Math.hypot((px-o.cx)/o.rx,(pz-o.cz)/o.rz);if(r>.72&&r<.727)for(let k=0;k<3;k++)data[i+k]=[155,160,145][k]*(1-fog)+fogColor[k]*fog}
   }
  }
  for(let x=0;x<w;x++){
   const camera=x*2/w-1,rx=dirX+rightX*camera*plane,rz=dirZ+rightZ*camera*plane,px=p.x/CELL,pz=p.z/CELL;let mx=Math.floor(px),mz=Math.floor(pz),side=0,steps=0;
   const ddx=Math.abs(1/rx),ddz=Math.abs(1/rz),sx=rx<0?-1:1,sz=rz<0?-1:1;let sdX=(rx<0?px-mx:mx+1-px)*ddx,sdZ=(rz<0?pz-mz:mz+1-pz)*ddz;
   while(steps++<world.n*4){if(sdX<sdZ){sdX+=ddx;mx+=sx;side=0}else{sdZ+=ddz;mz+=sz;side=1}if(mx<0||mz<0||mx>=world.n||mz>=world.n||world.grid[mz*world.n+mx])break}
   let dist=Math.max(.025,(side?sdZ-ddz:sdX-ddx)*CELL);
   let wallHeight=HEIGHT;
   if(world.oval){
    const o=world.oval,ox=p.x-o.cx,oz=p.z-o.cz;
    const distance=margin=>{
     const a=o.rx+margin,b=o.rz+margin,A=(rx/a)**2+(rz/b)**2,B=2*(ox*rx/a**2+oz*rz/b**2),C=(ox/a)**2+(oz/b)**2-1;
     return (-B+Math.sqrt(Math.max(0,B*B-4*A*C)))/(2*A);
    };
    dist=Math.max(.025,distance(0));wallHeight=STONE_HEIGHT-.30;
    const far=Math.max(.025,distance(5.93)),hitAngle=Math.atan2((oz+rz*far)/(o.rz+5.93),(ox+rx*far)/(o.rx+5.93));
    const bay=((hitAngle/(2*Math.PI)+1)*ARCH_BAYS)%ARCH_BAYS,arcade=this.arcade;
    const tx=Math.min(127,Math.floor((bay%1)*128)),fog=Math.min(.49,far/130),scale=proj/far;
    for(let y=Math.max(0,Math.ceil(horizon-(ARCADE_TOP-eye)*scale));y<Math.min(h,Math.ceil(horizon+(eye-2.15)*scale));y++){
     const height=eye+(horizon-y)/scale,ty=Math.max(0,Math.min(255,Math.floor((1-(height-2.15)/(ARCADE_TOP-2.15))*256)));
     const t=(ty*128+tx)*4,i=(y*w+x)*4;
     const banner=Math.floor(bay)%4===0&&tx>51&&tx<76&&height>5.9&&height<8.4;
     const border=banner&&(height<6.07||height>8.19||tx>61&&tx<67&&height>6.9&&height<7.5);
     for(let k=0;k<3;k++)data[i+k]=(banner?(border?[217,174,85]:[137,39,29])[k]:arcade.data[t+k])*(1-fog)+fogColor[k]*fog;
    }
   }
   this.depth[x]=dist;
   const top=horizon-(wallHeight-eye)*proj/dist,bottom=horizon+eye*proj/dist,hitX=p.x+rx*dist,hitZ=p.z+rz*dist,wallU=((side?hitX:hitZ)/CELL*2)%1;
   const door=world.door,normalDistance=Math.abs((hitX-door.x)*door.dx+(hitZ-door.z)*door.dz),tangent=(hitX-door.x)*this.doorAxes.rightX+(hitZ-door.z)*this.doorAxes.rightZ,isDoor=normalDistance<.1&&Math.abs(tangent)<.61;
   const shade=(side ? .82 : .94)*Math.max(.32,1-dist*.024),fog=Math.min(.65,dist/55);
   for(let y=Math.max(0,Math.ceil(top));y<Math.min(h,Math.ceil(bottom));y++){
    const worldY=eye+(horizon-y)*dist/proj,atDoor=isDoor&&worldY<2.2,isEntry=!world.arena&&world.level>1&&Math.abs(hitX-CELL)<.1&&Math.abs(hitZ-world.spawn.z)<.61&&worldY<2.2,texture=atDoor?this.door:isEntry?this.entry:this.wall,tx=isEntry?Math.max(0,Math.min(255,Math.floor(((world.spawn.z-hitZ)/1.22+.5)*256))):atDoor?Math.max(0,Math.min(255,Math.floor((tangent/.61*.5+.5)*256))):((Math.floor(wallU*256)%256)+256)%256,ty=(atDoor||isEntry)?Math.max(0,Math.min(511,Math.floor((1-worldY/2.2)*512))):((Math.floor((1-worldY/HEIGHT)*512)%256)+256)%256,t=texture.width===256?(ty*256+tx)*4:(Math.floor(ty/256*texture.height)*texture.width+Math.floor(tx/256*texture.width))*4,i=(y*w+x)*4;
    for(let k=0;k<3;k++)data[i+k]=texture.data[t+k]*shade*softwareLight(pal,k)*(1-fog)+fogColor[k]*fog;data[i+3]=255;
    if(atDoor&&this.scene?.doorOpen&&this.portal){
     const px=Math.floor(tx*this.portal.width/256),py=Math.floor(ty*this.portal.height/512),pi=(py*this.portal.width+px)*4;
     for(let k=0;k<3;k++)data[i+k]=this.portal.data[pi+k]*(1-fog)+fogColor[k]*fog;
    }
    if(worldY<.13&&!atDoor){data[i]*=.46;data[i+1]*=.44;data[i+2]*=.43}
   }
  }
  this.ctx.putImageData(this.image,0,0);
  const project=(x,y,z)=>{const dx=x-p.x,dz=z-p.z,depth=dx*dirX+dz*dirZ;return {x:w/2+(dx*rightX+dz*rightZ)/depth*proj,y:horizon+(eye-y)/depth*proj,depth,scale:proj/depth}};
  const scene=this.scene||{items:!hasKey?[{...world.keyPosition,color:pal.stripe}]:[]},c=this.ctx;
  this.drawMirrors(p,bob,scene,pal,project,dirX,dirZ);
  for(const item of scene.items||[]){const q=project(item.x,.025,item.z);if(q.depth>.15&&q.x>=0&&q.x<w&&q.depth<this.depth[Math.floor(q.x)]){const width=Math.max(1,.32*q.scale),height=Math.max(1,.10*q.scale);c.fillStyle=world.level===5?'#16191a':'#8b8b7b';c.fillRect(q.x-width/2,q.y-height/2,width,height);c.fillStyle=item.color;c.fillRect(q.x-width/2,q.y-height/4,width,height*.3)}}
  for(const frame of world.frames||[]){
   const pose=framePose(scene.traps?.[frame.id],scene.serverNow??Date.now());
   const points=[[-1,0],[1,0],[1,FRAME_LENGTH],[-1,FRAME_LENGTH]].map(([side,length])=>{
    const u=Math.sin(pose.angle)*length+.038,v=side*FRAME_WIDTH/2;
    return {x:frame.x+frame.dx*u-frame.dz*v,y:pose.y+Math.cos(pose.angle)*length,z:frame.z+frame.dz*u+frame.dx*v};
   });
   const corners=points.map(q=>project(q.x,q.y,q.z)),centre=project((points[0].x+points[2].x)/2,(points[0].y+points[2].y)/2,(points[0].z+points[2].z)/2);
   if(corners.some(q=>q.depth<.1)||centre.x<0||centre.x>=w||centre.depth>this.depth[Math.floor(centre.x)]+.08)continue;
   c.fillStyle=litColor('#416358',pal,pose.phase==='warning'?1.8:1.2);c.strokeStyle=litColor('#bd9461',pal,1.5);c.lineWidth=Math.max(1,centre.scale*.035);
   c.beginPath();corners.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.fill();c.stroke();
  }
  if(world.arena){
   for(const person of this.crowd){
    const sway=scene.stillCrowd?0:Math.sin(time*1.8+person.x*1.38+person.z*1.78);
    const q=project(person.x+sway*.035,person.y+sway*.024,person.z);
    if(q.depth<.65||q.x<0||q.x>=w)continue;
    const width=person.width*q.scale,height=person.height*q.scale;
    c.fillStyle=CROWD_COLORS[person.color];c.fillRect(q.x-width*.5,q.y-height,width,height);
    c.fillStyle='#b99068';c.fillRect(q.x-q.scale*.09,q.y-height-q.scale*.18,q.scale*.18,q.scale*.18);
   }
   for(const net of world.nets){const hx=net.halfWidth,hz=net.halfDepth,dip=netDeflection(net,p,scene);
    // Clip the net polygon at the near plane so the surface remains visible while standing on it.
    let poly=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([x,z])=>({x:net.x+x,z:net.z+z})),out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.x-p.x)*dirX+(a.z-p.z)*dirZ,db=(b.x-p.x)*dirX+(b.z-p.z)*dirZ;if(da>=.08)out.push(a);if((da>=.08)!==(db>=.08)){const t=(.08-da)/(db-da);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t})}}poly=out;
    if(poly.length>2){const points=poly.map(q=>project(q.x,SPRING_HEIGHT,q.z));c.fillStyle='#775234';c.strokeStyle='#b39265';c.lineWidth=2;c.beginPath();points.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.fill();c.stroke();c.save();c.clip();c.strokeStyle='#dcbb7d77';c.lineWidth=.6;
     for(let v=-hx;v<=hx;v+=.32)netLine(net.x+v,net.z-hz,net.x+v,net.z+hz,dip);for(let v=-hz;v<=hz;v+=.32)netLine(net.x-hx,net.z+v,net.x+hx,net.z+v,dip);c.restore();
    }
   }
   function netLine(ax,az,bx,bz,dip){
    const draw=(x,z)=>project(x,SPRING_HEIGHT-dip[2]*Math.max(0,1-((x-dip[0])**2+(z-dip[1])**2)*.25),z);
    let a=draw(ax,az),b=draw(bx,bz);
    if(a.depth<.08&&b.depth<.08)return;
    if(a.depth<.08){const t=(.08-a.depth)/(b.depth-a.depth);ax+=(bx-ax)*t;az+=(bz-az)*t;a=draw(ax,az)}
    else if(b.depth<.08){const t=(.08-b.depth)/(a.depth-b.depth);bx+=(ax-bx)*t;bz+=(az-bz)*t;b=draw(bx,bz)}
    c.beginPath();c.moveTo(a.x,a.y);
    if(dip[2]>0)for(let t=.05;t<1;t+=.05){const q=draw(ax+(bx-ax)*t,az+(bz-az)*t);c.lineTo(q.x,q.y)}
    c.lineTo(b.x,b.y);c.stroke();
   }
   for(const d of [...world.decor].sort((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)-Math.hypot(a.x-p.x,a.z-p.z))){const q=project(d.x,0,d.z);if(q.depth<.2||q.x<0||q.x>=w||q.depth>this.depth[Math.floor(q.x)])continue;const sprite=decorSprite(d.type,pal);c.drawImage(sprite.canvas,q.x-sprite.width*q.scale/2,q.y-sprite.height*q.scale,sprite.width*q.scale,sprite.height*q.scale)}
   for(const box of scene.cases||[{...world.showcase,...scene,open:scene.showcaseOpen}]){const q=project(box.x,0,box.z);if(q.depth>.2&&q.x>=0&&q.x<w&&q.depth<this.depth[Math.floor(q.x)]){const sprite=showcaseSprite(box,pal);c.drawImage(sprite,q.x-1.21*q.scale,q.y-2.32*q.scale,2.42*q.scale,2.36*q.scale)}}
  }
  for(const remote of [...(scene.players||[])].sort((a,b)=>Math.hypot(b.player.x-p.x,b.player.z-p.z)-Math.hypot(a.player.x-p.x,a.player.z-p.z))){
   const r=remote.player,q=project(r.x,r.height||0,r.z);
   if(q.depth<.25||q.x<0||q.x>=w||q.depth>this.depth[Math.floor(q.x)])continue;
   const angle=Math.atan2(p.x-r.x,-(p.z-r.z))-r.yaw,view=Math.round(angle/(Math.PI/4));
   const age=((scene.serverNow||Date.now())-(remote.actionAt||0))/1000,attacking=age>=0&&age<.42;
   const sprite=avatarSprite(remote.appearance,remote.backpack,view,pal,{...remote,weapon:attacking?null:remote.weapon});
   c.save();c.translate(q.x,q.y);c.scale(q.scale,q.scale*(r.crouch?.72:1));c.fillStyle='#0003';
   c.beginPath();c.ellipse(0,.005,.28,.065,0,0,Math.PI*2);c.fill();
   c.imageSmoothingEnabled=true;c.drawImage(sprite,-.58,-1.92,1.16,1.92);
   if(attacking){
    const reach=Math.sin(age/.42*Math.PI),x=-.28+reach*.21,y=-.94-reach*.26;
    c.lineCap='round';c.lineWidth=.105;c.strokeStyle=litColor('#e5b09a',pal);
    c.beginPath();c.moveTo(-.25,-1.15);c.lineTo(x,y);c.stroke();
    if(remote.weapon==='sword'){
     c.lineWidth=.073;c.strokeStyle=litColor('#d4d8ca',pal);
     c.beginPath();c.moveTo(x,y);c.lineTo(x-.25*reach,y-.54);c.stroke();
    }
   }
   c.restore();
  }


  if(scene.appearance)this.drawLocalArm(p,bob,scene,pal,project);

 }
 drawMirrors(p,bob,scene,pal,project,dirX,dirZ){
  const c=this.ctx,w=this.canvas.width;
  for(const mirror of this.world.mirrors||[]){
   if(mirrorSide(mirror,p)<.08||Math.hypot(p.x-mirror.x,p.z-mirror.z)>9)continue;
   const outline=mirrorCorners(mirror).map(v=>project(v.x,v.y,v.z));
   if(outline.some(v=>v.depth<.075)||outline.every(v=>v.x<0)||outline.every(v=>v.x>w))continue;
   const centre=project(mirror.x,1.25,mirror.z);
   const ix=Math.min(w-1,Math.max(0,Math.floor(centre.x)));
   if(centre.depth>this.depth[ix]+.08)continue;
   c.save();c.beginPath();outline.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();
   c.strokeStyle='#a7a68f';c.lineWidth=3;c.stroke();c.clip();
   const top=Math.min(...outline.map(v=>v.y)),bottom=Math.max(...outline.map(v=>v.y));
   const glass=c.createLinearGradient(0,top,0,bottom);glass.addColorStop(0,'#5d706f');glass.addColorStop(.57,'#384a4c');glass.addColorStop(1,'#45524e');
   c.fillStyle=glass;c.fillRect(0,top,w,bottom-top);
   const observer=reflectPoint(mirror,p),players=[...(scene.players||[])];
   if(scene.appearance)players.push({...scene,player:{...p,height:Math.max(0,bob+(p.crouch?CROUCH_OFFSET:0))}});
   players.sort((a,b)=>mirrorSide(mirror,b.player)-mirrorSide(mirror,a.player));
   for(const avatar of players){
    const pose=avatar.player,distance=mirrorSide(mirror,pose);
    if(distance<=0||Math.hypot(pose.x-mirror.x,pose.z-mirror.z)>7)continue;
    let clear=true;
    for(let t=.14;t<1;t+=.14)if(!free(this.world,mirror.x+(pose.x-mirror.x)*t,mirror.z+(pose.z-mirror.z)*t,.02)){clear=false;break}
    if(!clear)continue;
    const r=reflectPoint(mirror,pose),q=project(r.x,pose.height||0,r.z);
    if(q.depth<.15||(r.x-p.x)*dirX+(r.z-p.z)*dirZ<=0)continue;
    const view=(Math.atan2(observer.x-pose.x,-(observer.z-pose.z))-pose.yaw)/(Math.PI/4);
    const sprite=avatarSprite(avatar.appearance,avatar.backpack,view,pal,avatar);
    c.save();c.translate(q.x,q.y);c.scale(-q.scale,q.scale*(pose.crouch?.72:1));
    c.drawImage(sprite,-.58,-1.92,1.16,1.92);c.restore();
   }
   c.restore();
  }
 }
 drawLocalArm(p,bob,scene,pal,project){
  if(!scene.weapon&&!scene.shield&&!scene.guard&&!scene.swing&&p.pitch>-.45)return;
  const c=this.ctx,sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),height=Math.max(0,bob+(p.crouch?CROUCH_OFFSET:0));
  const toScreen=([x,y,z])=>project(p.x+cy*x-sy*z,y*(p.crouch?.72:1)+height,p.z+sy*x+cy*z);
  const segment=(from,to,width,color)=>{
   let a=toScreen(from),b=toScreen(to);
   if(a.depth<=.09&&b.depth<=.09)return;
   if(a.depth<.09)a=toScreen(between(from,to,(.09-a.depth)/(b.depth-a.depth)));
   if(b.depth<.09)b=toScreen(between(to,from,(.09-b.depth)/(a.depth-b.depth)));
   c.strokeStyle=litColor(color,pal,1.15);c.lineWidth=width*Math.min(a.scale,b.scale);c.lineCap='round';
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
  };
  c.save();
  for(const side of [-1,1]){
   if(side===-1&&!scene.shield&&!scene.guard)continue;
   if(side===1&&scene.shield&&!scene.weapon&&!scene.swing&&!scene.guard&&p.pitch>-.45)continue;
   const {shoulder,elbow,wrist}=armPose(side,scene.weapon==='sword',(scene.swing||0)/.42,scene.walk||0,true,scene.guard,scene.shield);
   const sleeveEnd=between(shoulder,elbow,.58),fingers=between(wrist,elbow,-.25);
   segment(shoulder,sleeveEnd,.17,scene.appearance.shirt);
   segment(sleeveEnd,elbow,.125,'#d29c88');segment(elbow,wrist,.108,'#d29c88');segment(wrist,fingers,.10,'#e0ab97');
   if(side===1&&scene.weapon==='sword')segment(wrist,[wrist[0],wrist[1]+.56,wrist[2]-.16],.083,'#d4d8ca');
   if(side===-1&&scene.shield){
    const q=toScreen([wrist[0],wrist[1]-.04,wrist[2]-.11]);
    if(q.depth>.1){
     c.beginPath();c.roundRect(q.x-q.scale*.2,q.y-q.scale*.27,q.scale*.4,q.scale*.54,q.scale*.035);
     c.fillStyle=litColor('#8f362a',pal,1.25);c.fill();c.strokeStyle=litColor('#c4a068',pal,1.2);
     c.lineWidth=q.scale*.024;c.stroke();
    }
   }
  }
  c.restore();
 }
 destroy(){this.closed=true;this.generation++;this.surfaces.destroy()}
}

function hexColor(hex){return [1,3,5].map(i=>parseInt((hex||'#ddd2a1').slice(i,i+2),16)/255)}
function softwareLight(pal,k){return pal===FLOORS[0]?1:pal.brightness*(.35+pal.light[k]*.65)}

export function projectPoint(player,target,width,height,bob=0){const {matrix:m}=cameraMatrix(player,width/height,bob),v=[target.x,target.y,target.z,1],out=[0,0,0,0];for(let row=0;row<4;row++)for(let col=0;col<4;col++)out[row]+=m[col*4+row]*v[col];if(out[3]<=.05)return null;const x=(out[0]/out[3]+1)*width/2,y=(1-out[1]/out[3])*height/2;return x<0||x>width||y<0||y>height?null:{x,y}}
