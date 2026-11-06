import {CELL,HEIGHT,random,doorBasis} from './core.js';
import {FLOORS,ARENA_LIGHT} from './adventure.js';
const VS=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uViewProjection;uniform mat4 uModel;varying mediump vec3 vPosition;varying mediump vec3 vNormal;varying mediump vec2 vUV;void main(){vec4 p=uModel*vec4(aPosition,1.);vPosition=p.xyz;vNormal=mat3(uModel)*aNormal;vUV=aUV;gl_Position=uViewProjection*p;}`;
const FS=`precision mediump float;varying mediump vec3 vPosition;varying mediump vec3 vNormal;varying mediump vec2 vUV;uniform sampler2D uTexture;uniform vec3 uColor;uniform vec3 uCamera;uniform vec3 uLights[8];uniform float uEmission;uniform float uTime;uniform vec3 uAmbient;uniform vec3 uTint;uniform vec3 uFog;uniform float uPower;uniform float uVisibility;uniform float uAlpha;void main(){vec3 n=normalize(vNormal);vec3 light=uAmbient;for(int i=0;i<8;i++){vec3 d=uLights[i]-vPosition;float r=dot(d,d);float diffuse=max(dot(n,normalize(d)),.025);light+=uTint*diffuse*uPower/(1.+r*.22);}vec3 c=texture2D(uTexture,vUV).rgb*uColor; c*=mix(light,vec3(1.1),uEmission);float fog=1.-exp(-pow(length(vPosition-uCamera)/uVisibility,1.55));c=mix(c,uFog,clamp(fog,0.,.92));gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(.94)),uAlpha);}`;
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
 sphere(x,y,z,rx,ry,rz){const point=(a,b)=>[x+Math.sin(a)*Math.cos(b)*rx,y+ry+Math.cos(a)*ry,z+Math.sin(a)*Math.sin(b)*rz];for(let i=0;i<8;i++)for(let j=0;j<12;j++){const a=i/8*Math.PI,b=(i+1)/8*Math.PI,c=j/12*Math.PI*2,d=(j+1)/12*Math.PI*2,pts=[point(a,c),point(b,c),point(b,d),point(a,d)];this.quad(...pts,[Math.sin((a+b)/2)*Math.cos((c+d)/2),Math.cos((a+b)/2),Math.sin((a+b)/2)*Math.sin((c+d)/2)])}}
 box(x,y,z,w,h,d){const a=x-w/2,b=x+w/2,c=y,e=y+h,f=z-d/2,g=z+d/2;this.quad([a,c,g],[b,c,g],[b,e,g],[a,e,g],[0,0,1]);this.quad([b,c,f],[a,c,f],[a,e,f],[b,e,f],[0,0,-1]);this.quad([a,c,f],[a,c,g],[a,e,g],[a,e,f],[-1,0,0]);this.quad([b,c,g],[b,c,f],[b,e,f],[b,e,g],[1,0,0]);this.quad([a,e,g],[b,e,g],[b,e,f],[a,e,f],[0,1,0]);this.quad([a,c,f],[b,c,f],[b,c,g],[a,c,g],[0,-1,0])}
}
function noiseTexture(kind,level){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),rng=random(987+level),image=c.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,grain=(rng()-.5)*(kind==='floor'?30:10);let color;
  if(kind==='wall'){const motif=Math.abs(Math.sin(x/16*Math.PI)*Math.cos(y/24*Math.PI)),stripe=x%32<2?-9:0,stain=9*Math.sin(x/67+y/81);color=[186+grain+stripe-stain,173+grain+stripe-stain,107+grain-motif*12-stain];if(motif>.86)color=color.map(v=>v-12)}
  else if(kind==='floor'){const wear=6*Math.sin(x/30)*Math.sin(y/51);color=[112+grain+wear,99+grain+wear,65+grain*.8+wear]}
  else {const seam=x<2||y<2?-45:0;color=[184+grain+seam,181+grain+seam,153+grain+seam]}
  if(level===6&&kind==='floor'){const seam=x%64<2||y%64<2?-23:0;color=[108+grain+seam,117+grain+seam,112+grain+seam]}for(let k=0;k<3;k++)image.data[i+k]=color[k];image.data[i+3]=255;
 }
 if(level>1)for(let i=0;i<image.data.length;i+=4){const gray=(image.data[i]+image.data[i+1]+image.data[i+2])/3;image.data[i]=gray;image.data[i+1]=gray;image.data[i+2]=gray}c.putImageData(image,0,0);if(kind==='wall'){c.fillStyle='#72693c33';for(let i=0;i<5;i++){c.beginPath();c.ellipse(rng()*256,rng()*256,8+rng()*35,5+rng()*28,0,0,6.3);c.fill()}}
 return canvas;
}
function doorTexture(level,label='USCITA'){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#6b7062';c.fillRect(0,0,256,512);c.fillStyle='#343b32';c.fillRect(12,12,232,488);c.fillStyle='#707566';c.fillRect(18,18,220,476);c.strokeStyle='#8e9380';c.lineWidth=2;c.strokeRect(36,42,184,180);c.strokeRect(36,254,184,205);c.fillStyle='#203b2c';c.fillRect(63,72,130,62);c.fillStyle='#d5dfc0';c.textAlign='center';c.font='bold 23px sans-serif';c.fillText(label,128,111);c.font='18px monospace';c.fillText(String(level).padStart(2,'0'),128,185);c.fillStyle='#d6d4ae';c.fillRect(192,253,10,40);c.fillRect(170,262,30,9);return canvas}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});if(!gl)return new SoftwareRenderer(canvas);this.gl=gl;
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader non disponibile: '+gl.getShaderInfoLog(s));return s};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Renderer non disponibile.');this.program=program;gl.useProgram(program);
  this.attrs=['aPosition','aNormal','aUV'].map(n=>gl.getAttribLocation(program,n));this.uniforms=Object.fromEntries(['uViewProjection','uModel','uTexture','uColor','uCamera','uLights[0]','uEmission','uTime','uAmbient','uTint','uFog','uPower','uVisibility','uAlpha'].map(n=>[n,gl.getUniformLocation(program,n)]));gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.2,.18,.115,1);gl.uniform1i(this.uniforms.uTexture,0);
  gl.uniform1f(this.uniforms.uAlpha,1);const white=document.createElement('canvas');white.width=white.height=1;white.getContext('2d').fillRect(0,0,1,1);const ctx=white.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1,1);this.white=this.texture(white);this.meshes=[];this.textures=[];this.quality='auto';this.resize();
 }
 texture(canvas){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,canvas);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.REPEAT);g.generateMipmap(g.TEXTURE_2D);return t}
 mesh(geometry,texture=null,color=[1,1,1],emission=0){const g=this.gl,buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(geometry.data),g.STATIC_DRAW);return {buffer,count:geometry.data.length/8,texture:texture||this.white,color,emission}}
 resize(){const rect=this.canvas.getBoundingClientRect(),limit=this.quality==='low'?720:this.quality==='high'?1440:1080,scale=Math.min(devicePixelRatio||1,1.5,limit/Math.max(rect.width,rect.height));const w=Math.max(1,Math.floor(rect.width*scale)),h=Math.max(1,Math.floor(rect.height*scale));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h)}}
 load(world){
  const gl=this.gl;for(const m of this.meshes)gl.deleteBuffer(m.buffer);if(this.keyMesh)gl.deleteBuffer(this.keyMesh.buffer);for(const m of this.props||[])gl.deleteBuffer(m.buffer);for(const t of this.textures)gl.deleteTexture(t);this.world=world;
  const wall=new Geometry(),floor=new Geometry(),ceiling=new Geometry(),trim=new Geometry(),frames=new Geometry(),light=new Geometry(),door=new Geometry(),key=new Geometry();
  for(let z=world.arena?0:1;z<(world.arena?world.n:world.n-1);z++)for(let x=world.arena?0:1;x<(world.arena?world.n:world.n-1);x++)if(world.arena||!world.grid[z*world.n+x]){
   const a=x*CELL,b=(x+1)*CELL,c=z*CELL,d=(z+1)*CELL;
   floor.quad([a,0,c],[b,0,c],[b,0,d],[a,0,d],[0,1,0],[x*2,z*2,(x+1)*2,(z+1)*2]);
   if(!world.arena)ceiling.quad([a,HEIGHT,d],[b,HEIGHT,d],[b,HEIGHT,c],[a,HEIGHT,c],[0,-1,0],[x,z,x+1,z+1]);
   if(!world.arena&&world.grid[z*world.n+x-1]){wall.quad([a,0,d],[a,0,c],[a,HEIGHT,c],[a,HEIGHT,d],[1,0,0],[0,0,2,2]);trim.box(a+.018,0,(c+d)/2,.035,.13,CELL)}
   if(!world.arena&&world.grid[z*world.n+x+1]){wall.quad([b,0,c],[b,0,d],[b,HEIGHT,d],[b,HEIGHT,c],[-1,0,0],[0,0,2,2]);trim.box(b-.018,0,(c+d)/2,.035,.13,CELL)}
   if(!world.arena&&world.grid[(z-1)*world.n+x]){wall.quad([a,0,c],[b,0,c],[b,HEIGHT,c],[a,HEIGHT,c],[0,0,1],[0,0,2,2]);trim.box((a+b)/2,0,c+.018,CELL,.13,.035)}
   if(!world.arena&&world.grid[(z+1)*world.n+x]){wall.quad([b,0,d],[a,0,d],[a,HEIGHT,d],[b,HEIGHT,d],[0,0,-1],[0,0,2,2]);trim.box((a+b)/2,0,d-.018,CELL,.13,.035)}
  }
  if(world.oval){const o=world.oval;for(let i=0;i<96;i++){const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2,x=o.cx+Math.cos(a)*o.rx,z=o.cz+Math.sin(a)*o.rz,xx=o.cx+Math.cos(b)*o.rx,zz=o.cz+Math.sin(b)*o.rz,n=[-Math.cos((a+b)/2),0,-Math.sin((a+b)/2)];wall.quad([x,0,z],[xx,0,zz],[xx,HEIGHT,zz],[x,HEIGHT,z],n,[i/2,0,(i+1)/2,2]);trim.quad([x,HEIGHT-.12,z],[xx,HEIGHT-.12,zz],[xx,HEIGHT,zz],[x,HEIGHT,z],n)}}
  if(!world.arena)for(const p of world.lamps){frames.box(p.x,HEIGHT-.055,p.z,1.18,.04,.34);for(const dz of [-.075,.075])light.quad([p.x-.51,HEIGHT-.06,p.z+dz-.025],[p.x+.51,HEIGHT-.06,p.z+dz-.025],[p.x+.51,HEIGHT-.06,p.z+dz+.025],[p.x-.51,HEIGHT-.06,p.z+dz+.025],[0,-1,0])}
  const p=world.door,basis=doorBasis(p),n=[basis.normalX,0,basis.normalZ],right=[basis.rightX,0,basis.rightZ],v=(dx,y)=>[p.x+right[0]*dx+n[0]*.015,y,p.z+right[2]*dx+n[2]*.015];door.quad(v(-.61,0),v(.61,0),v(.61,2.2),v(-.61,2.2),n);
  key.box(0,.014,0,.24,.012,.15);
  const textures=[this.texture(noiseTexture('wall',world.level)),this.texture(noiseTexture('floor',world.level)),this.texture(noiseTexture('ceiling',world.level)),this.texture(doorTexture(world.level,world.arena?'INDIETRO':'USCITA'))];this.textures=textures;
  this.meshes=[this.mesh(wall,textures[0]),this.mesh(floor,textures[1]),this.mesh(ceiling,textures[2]),this.mesh(trim,null,[.26,.23,.14]),this.mesh(frames,null,[.23,.24,.2]),this.mesh(light,null,world.level===1?[1,.98,.79]:world.palette?.light||[1,.98,.79],world.level===1?1:world.arena?.5:world.level===5?.025:world.level===4?.12:.3),this.mesh(door,textures[3])];this.exitMesh=this.meshes.pop();this.keyMesh=this.mesh(key,null,[.64,.64,.6],0);
  const stripe=new Geometry();stripe.box(0,.027,-.035,.225,.002,.035);this.stripeMesh=this.mesh(stripe);this.props=[this.stripeMesh,this.exitMesh];
  const skin=new Geometry(),shirt=new Geometry(),shorts=new Geometry(),wornPack=new Geometry();
  for(const x of [-.12,.12]){skin.sphere(x,.04,0,.075,.29,.085);shorts.sphere(x,.51,0,.105,.18,.13)}
  shirt.sphere(0,.78,0,.245,.31,.145);for(const x of [-.29,.29])skin.sphere(x,.69,0,.07,.27,.075);
  wornPack.sphere(0,.75,.22,.25,.32,.14);
  this.bodySkin=this.mesh(skin,null,[.90,.65,.58]);this.bodyShirt=this.mesh(shirt);this.bodyShorts=this.mesh(shorts);this.wornPack=this.mesh(wornPack,null,[.27,.36,.22]);this.props.push(this.bodySkin,this.bodyShirt,this.bodyShorts,this.wornPack);

  const dark=new Geometry();dark.quad(v(-.61,0),v(.61,0),v(.61,2.2),v(-.61,2.2),n);this.openExit=this.mesh(dark,null,[.035,.045,.038],.1);this.props.push(this.openExit);
  if(!world.arena&&world.level>1){const entry=new Geometry(),ep={x:world.spawn.x-CELL/2+.06,z:world.spawn.z,dx:-1,dz:0},eb=doorBasis(ep),ev=(u,y)=>[ep.x+eb.rightX*u+.02,y,ep.z+eb.rightZ*u];entry.quad(ev(-.61,0),ev(.61,0),ev(.61,2.2),ev(-.61,2.2),[1,0,0]);const et=this.texture(doorTexture(world.level-1,'INDIETRO'));this.textures.push(et);this.entryMesh=this.mesh(entry,et);this.props.push(this.entryMesh)}else this.entryMesh=null;
  if(world.arena){
   const frame=new Geometry(),shelf=new Geometry(),glass=new Geometry(),pack=new Geometry(),blade=new Geometry(),guard=new Geometry(),nets=new Geometry(),springs=new Geometry();const c=world.showcase;
   for(const dx of [-1.05,1.05])for(const dz of [-.48,.48])frame.box(c.x+dx,0,c.z+dz,.065,2.15,.065);
   frame.box(c.x,2.1,c.z,2.18,.08,1.05);frame.box(c.x,.1,c.z,2.18,.12,1.05);shelf.box(c.x,.85,c.z,2.04,.07,.94);
   glass.quad([c.x-1.02,.23,c.z+.48],[c.x+1.02,.23,c.z+.48],[c.x+1.02,2.1,c.z+.48],[c.x-1.02,2.1,c.z+.48],[0,0,1]);
   pack.sphere(c.x-.5,.9,c.z,.28,.39,.17);pack.box(c.x-.5,.95,c.z+.16,.34,.26,.08);for(const dx of [-.17,.17])guard.box(c.x-.5+dx,1.1,c.z-.15,.04,.34,.04);
   blade.box(c.x+.45,.94,c.z,.065,.8,.025);guard.box(c.x+.45,1.72,c.z,.32,.035,.06);guard.box(c.x+.45,1.75,c.z,.065,.19,.065);
   for(const net of world.nets){const hx=net.halfWidth,hz=net.halfDepth;for(const dx of [-hx,hx])springs.box(net.x+dx,0,net.z,.1,.48,hz*2+.1);for(const dz of [-hz,hz])springs.box(net.x,0,net.z+dz,hx*2+.1,.48,.1);
    for(let v=-hx+.15;v<hx;v+=.24)nets.box(net.x+v,.36,net.z,.025,.018,hz*2-.25);
    for(let v=-hz+.15;v<hz;v+=.24)nets.box(net.x,.36,net.z+v,hx*2-.25,.018,.025);
    for(let v=-hx+.15;v<hx;v+=.35)for(const side of [-1,1])springs.box(net.x+v,.32,net.z+side*(hz-.09),.045,.035,.19);
    for(let v=-hz+.15;v<hz;v+=.35)for(const side of [-1,1])springs.box(net.x+side*(hx-.09),.32,net.z+v,.19,.035,.045);
   }
   const m=(g,color,emission=0)=>{const mesh=this.mesh(g,null,color,emission);this.props.push(mesh);return mesh};this.caseFrame=m(frame,[.28,.34,.35]);this.caseShelf=m(shelf,[.35,.38,.34]);this.caseGlass=m(glass,[.45,.75,.8],.2);this.pack=m(pack,[.27,.36,.22]);this.blade=m(blade,[.72,.76,.77]);this.guard=m(guard,[.3,.22,.12]);this.net=m(nets,[.17,.23,.23]);this.springs=m(springs,[.38,.4,.39]);
   const stone=new Geometry(),wood=new Geometry(),green=new Geometry(),metal=new Geometry(),glow=new Geometry(),inlay=new Geometry();
   for(const d of world.decor){if(d.type==='planter'){stone.box(d.x,0,d.z,1.3,.48,.86);green.sphere(d.x,.38,d.z,.62,.35,.4)}else if(d.type==='bench'){wood.box(d.x,.45,d.z,2.3,.1,.65);wood.box(d.x,.55,d.z-.28,2.3,.55,.08);for(const dx of [-.8,.8])metal.box(d.x+dx,0,d.z,.12,.48,.5)}else{metal.box(d.x,0,d.z,.1,2.65,.1);glow.sphere(d.x,2.58,d.z,.16,.15,.16)}}
   const o=world.oval;for(let i=0;i<96;i++){const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2,pt=(angle,r)=>[o.cx+Math.cos(angle)*o.rx*r,.006,o.cz+Math.sin(angle)*o.rz*r];inlay.quad(pt(a,.72),pt(b,.72),pt(b,.727),pt(a,.727),[0,1,0])}
   this.decorMeshes=[m(stone,[.38,.43,.42]),m(wood,[.37,.27,.17]),m(green,[.21,.34,.22]),m(metal,[.20,.27,.28]),m(glow,[1,.85,.53],.7),m(inlay,[.68,.68,.57])];
  }

 }
 draw(player,hasKey,time,bob=0){
  this.resize();const g=this.gl,u=this.uniforms,pal=this.world.palette||FLOORS[Math.min(4,this.world.level-1)];g.clearColor(...pal.fog,1);const {matrix,eye}=cameraMatrix(player,this.canvas.width/this.canvas.height,bob);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);g.uniform3fv(u.uAmbient,pal.ambient);g.uniform3fv(u.uTint,pal.light);g.uniform3fv(u.uFog,pal.fog);g.uniform1f(u.uPower,pal.power);g.uniform1f(u.uVisibility,pal.visibility);g.uniform1f(u.uAlpha,1);g.uniformMatrix4fv(u.uViewProjection,false,matrix);g.uniform3fv(u.uCamera,eye);g.uniform1f(u.uTime,time);
  const nearest=this.world.lamps.map(p=>({p,d:(p.x-player.x)**2+(p.z-player.z)**2})).sort((a,b)=>a.d-b.d).slice(0,8),lights=new Float32Array(24).fill(9999);nearest.forEach(({p},i)=>lights.set([p.x,p.y,p.z],i*3));g.uniform3fv(u['uLights[0]'],lights);
  for(const mesh of this.meshes)this.drawMesh(mesh,identity());
  const scene=this.scene||{items:!hasKey?[{...this.world.keyPosition,color:pal.stripe}]:[]};
  this.drawMesh(scene.doorOpen&&!this.world.arena?this.openExit:this.exitMesh,identity());if(this.entryMesh)this.drawMesh(this.entryMesh,identity());
  for(const item of scene.items||[]){const m=identity();m[12]=item.x;m[14]=item.z;this.drawMesh(this.keyMesh,m);this.stripeMesh.color=hexColor(item.color);this.drawMesh(this.stripeMesh,m)}
  if(scene.appearance){const m=identity(),a=player.yaw;m[0]=m[10]=Math.cos(a);m[2]=-Math.sin(a);m[8]=Math.sin(a);m[12]=player.x;m[13]=Math.max(0,bob);m[14]=player.z;this.bodyShirt.color=hexColor(scene.appearance.shirt);this.bodyShorts.color=hexColor(scene.appearance.shorts);for(const mesh of [this.bodySkin,this.bodyShirt,this.bodyShorts,...(scene.backpack?[this.wornPack]:[])])this.drawMesh(mesh,m)}
  if(this.world.arena){for(const mesh of [this.caseFrame,this.caseShelf,this.net,this.springs,...this.decorMeshes])this.drawMesh(mesh,identity());if(!scene.backpack)this.drawMesh(this.pack,identity());if(!scene.swordTaken){this.drawMesh(this.blade,identity());this.drawMesh(this.guard,identity())}
   if(!scene.showcaseOpen){g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);g.uniform1f(u.uAlpha,.24);this.drawMesh(this.caseGlass,identity());g.uniform1f(u.uAlpha,1);g.depthMask(true);g.disable(g.BLEND)}
  }

 }
 drawMesh(m,model){if(!m.count)return;const g=this.gl,u=this.uniforms;g.bindBuffer(g.ARRAY_BUFFER,m.buffer);for(let i=0;i<3;i++){g.enableVertexAttribArray(this.attrs[i]);g.vertexAttribPointer(this.attrs[i],i===2?2:3,g.FLOAT,false,32,i===0?0:i===1?12:24)}g.bindTexture(g.TEXTURE_2D,m.texture);g.uniformMatrix4fv(u.uModel,false,model);g.uniform3fv(u.uColor,m.color);g.uniform1f(u.uEmission,m.emission);g.drawArrays(g.TRIANGLES,0,m.count)}
 destroy(){const g=this.gl;for(const m of this.meshes)g.deleteBuffer(m.buffer);if(this.keyMesh)g.deleteBuffer(this.keyMesh.buffer);for(const m of this.props||[])g.deleteBuffer(m.buffer);for(const t of this.textures)g.deleteTexture(t);g.deleteTexture(this.white);g.deleteProgram(this.program)}
}
// Canvas first-person fallback for WebViews with unavailable hardware acceleration.
class SoftwareRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('Grafica non disponibile su questo dispositivo.');this.software=true;this.quality='auto';this.depth=[];canvas.style.imageRendering='pixelated';this.resize()}
 resize(){const rect=this.canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height),target=this.quality==='high'?640:this.quality==='low'?320:480,w=Math.max(180,Math.min(target,Math.floor(360*aspect))),h=Math.max(100,Math.floor(w/aspect));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.image=this.ctx.createImageData(w,h)}}
 load(world){this.world=world;this.doorAxes=doorBasis(world.door);const pixels=canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);this.wall=pixels(noiseTexture('wall',world.level));this.floor=pixels(noiseTexture('floor',world.level));this.ceiling=pixels(noiseTexture('ceiling',world.level));this.door=pixels(doorTexture(world.level,world.arena?'INDIETRO':'USCITA'));this.entry=pixels(doorTexture(world.level-1,'INDIETRO'));this.lamps=new Set(world.lamps.map(p=>Math.floor(p.z/CELL)*world.n+Math.floor(p.x/CELL)))}
 draw(p,hasKey,time,bob=0){
  this.resize();const pal=this.world.palette||FLOORS[Math.min(4,this.world.level-1)],fogColor=pal.fog.map(v=>v*255);const w=this.canvas.width,h=this.canvas.height,data=this.image.data,world=this.world,dirX=Math.sin(p.yaw),dirZ=-Math.cos(p.yaw),rightX=Math.cos(p.yaw),rightZ=Math.sin(p.yaw),proj=h/(2*Math.tan(72*Math.PI/360)),eye=1.62+bob,horizon=h/2+Math.tan(p.pitch)*proj,plane=w/(2*proj);
  // Horizontal planes are perspective-correct, not screen-space gradients.
  for(let y=0;y<h;y++){
   const ceiling=y<horizon,dist=(ceiling?HEIGHT-eye:eye)*proj/Math.max(.1,Math.abs(y-horizon)),texture=ceiling?this.ceiling:this.floor,shade=Math.max(.22,.82-dist*.012);
   for(let x=0;x<w;x++){
    const rayX=dirX+rightX*(x*2/w-1)*plane,rayZ=dirZ+rightZ*(x*2/w-1)*plane,px=p.x+rayX*dist,pz=p.z+rayZ*dist,repeat=ceiling?1:2,tx=((Math.floor(px/CELL*256*repeat)%256)+256)%256,tz=((Math.floor(pz/CELL*256*repeat)%256)+256)%256,t=(tz*256+tx)*4,i=(y*w+x)*4;
    let bright=shade;if(ceiling&&dist<35&&this.lamps.has(Math.floor(pz/CELL)*world.n+Math.floor(px/CELL))){const localX=((px%CELL)+CELL)%CELL-CELL/2,localZ=((pz%CELL)+CELL)%CELL-CELL/2;if(Math.abs(localX)<.51&&(Math.abs(localZ-.075)<.028||Math.abs(localZ+.075)<.028))bright=1.7}
    const fog=Math.min(.75,dist/55);for(let k=0;k<3;k++)data[i+k]=texture.data[t+k]*bright*softwareLight(pal,k)*(1-fog)+fogColor[k]*fog;data[i+3]=255;if(world.arena&&ceiling){const sky=Math.max(0,Math.min(1,y/Math.max(1,horizon)));data[i]=56+sky*40;data[i+1]=81+sky*37;data[i+2]=99+sky*32}else if(world.oval){const o=world.oval,r=Math.hypot((px-o.cx)/o.rx,(pz-o.cz)/o.rz);if(r>.72&&r<.727)for(let k=0;k<3;k++)data[i+k]=[155,160,145][k]*(1-fog)+fogColor[k]*fog}
   }
  }
  for(let x=0;x<w;x++){
   const camera=x*2/w-1,rx=dirX+rightX*camera*plane,rz=dirZ+rightZ*camera*plane,px=p.x/CELL,pz=p.z/CELL;let mx=Math.floor(px),mz=Math.floor(pz),side=0,steps=0;
   const ddx=Math.abs(1/rx),ddz=Math.abs(1/rz),sx=rx<0?-1:1,sz=rz<0?-1:1;let sdX=(rx<0?px-mx:mx+1-px)*ddx,sdZ=(rz<0?pz-mz:mz+1-pz)*ddz;
   while(steps++<world.n*4){if(sdX<sdZ){sdX+=ddx;mx+=sx;side=0}else{sdZ+=ddz;mz+=sz;side=1}if(mx<0||mz<0||mx>=world.n||mz>=world.n||world.grid[mz*world.n+mx])break}
   let dist=Math.max(.025,(side?sdZ-ddz:sdX-ddx)*CELL);if(world.oval){const o=world.oval,ox=p.x-o.cx,oz=p.z-o.cz,A=rx*rx/(o.rx*o.rx)+rz*rz/(o.rz*o.rz),B=2*(ox*rx/(o.rx*o.rx)+oz*rz/(o.rz*o.rz)),C=ox*ox/(o.rx*o.rx)+oz*oz/(o.rz*o.rz)-1;dist=Math.max(.025,(-B+Math.sqrt(Math.max(0,B*B-4*A*C)))/(2*A))}this.depth[x]=dist;
   const top=horizon-(HEIGHT-eye)*proj/dist,bottom=horizon+eye*proj/dist,hitX=p.x+rx*dist,hitZ=p.z+rz*dist,wallU=((side?hitX:hitZ)/CELL*2)%1;
   const door=world.door,normalDistance=Math.abs((hitX-door.x)*door.dx+(hitZ-door.z)*door.dz),tangent=(hitX-door.x)*this.doorAxes.rightX+(hitZ-door.z)*this.doorAxes.rightZ,isDoor=normalDistance<.1&&Math.abs(tangent)<.61;
   const shade=(side ? .82 : .94)*Math.max(.32,1-dist*.024),fog=Math.min(.65,dist/55);
   for(let y=Math.max(0,Math.ceil(top));y<Math.min(h,Math.ceil(bottom));y++){
    const worldY=eye+(horizon-y)*dist/proj,atDoor=isDoor&&worldY<2.2,isEntry=!world.arena&&world.level>1&&Math.abs(hitX-CELL)<.1&&Math.abs(hitZ-world.spawn.z)<.61&&worldY<2.2,texture=atDoor?this.door:isEntry?this.entry:this.wall,tx=isEntry?Math.max(0,Math.min(255,Math.floor(((world.spawn.z-hitZ)/1.22+.5)*256))):atDoor?Math.max(0,Math.min(255,Math.floor((tangent/.61*.5+.5)*256))):((Math.floor(wallU*256)%256)+256)%256,ty=(atDoor||isEntry)?Math.max(0,Math.min(511,Math.floor((1-worldY/2.2)*512))):((Math.floor((1-worldY/HEIGHT)*512)%256)+256)%256,t=(ty*256+tx)*4,i=(y*w+x)*4;
    for(let k=0;k<3;k++)data[i+k]=texture.data[t+k]*shade*softwareLight(pal,k)*(1-fog)+fogColor[k]*fog;data[i+3]=255;
    if(atDoor&&this.scene?.doorOpen&&!world.arena){data[i]=10;data[i+1]=13;data[i+2]=10}
    if(worldY<.13&&!atDoor){data[i]*=.46;data[i+1]*=.44;data[i+2]*=.43}
   }
  }
  this.ctx.putImageData(this.image,0,0);
  const project=(x,y,z)=>{const dx=x-p.x,dz=z-p.z,depth=dx*dirX+dz*dirZ;return {x:w/2+(dx*rightX+dz*rightZ)/depth*proj,y:horizon+(eye-y)/depth*proj,depth,scale:proj/depth}};
  const scene=this.scene||{items:!hasKey?[{...world.keyPosition,color:pal.stripe}]:[]},c=this.ctx;
  for(const item of scene.items||[]){const q=project(item.x,.025,item.z);if(q.depth>.15&&q.x>=0&&q.x<w&&q.depth<this.depth[Math.floor(q.x)]){const width=Math.max(1,.24*q.scale),height=Math.max(1,.08*q.scale);c.fillStyle=world.level===5?'#16191a':'#8b8b7b';c.fillRect(q.x-width/2,q.y-height/2,width,height);c.fillStyle=item.color;c.fillRect(q.x-width/2,q.y-height/4,width,height*.3)}}
  if(world.arena){
   for(const net of world.nets){const hx=net.halfWidth,hz=net.halfDepth,pts=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([x,z])=>project(net.x+x,.36,net.z+z));
    // Clip the net polygon at the near plane so the surface remains visible while standing on it.
    let poly=[[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([x,z])=>({x:net.x+x,z:net.z+z})),out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.x-p.x)*dirX+(a.z-p.z)*dirZ,db=(b.x-p.x)*dirX+(b.z-p.z)*dirZ;if(da>=.08)out.push(a);if((da>=.08)!==(db>=.08)){const t=(.08-da)/(db-da);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t})}}poly=out;
    if(poly.length>2){const points=poly.map(q=>project(q.x,.36,q.z));c.fillStyle='#233d3d';c.strokeStyle='#8b9890';c.lineWidth=2;c.beginPath();points.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();c.fill();c.stroke();c.save();c.clip();c.strokeStyle='#92b1a66b';c.lineWidth=.6;
     for(let v=-hx;v<=hx;v+=.32)netLine(net.x+v,net.z-hz,net.x+v,net.z+hz);for(let v=-hz;v<=hz;v+=.32)netLine(net.x-hx,net.z+v,net.x+hx,net.z+v);c.restore();
    }
   }
   function netLine(ax,az,bx,bz){let a=project(ax,.38,az),b=project(bx,.38,bz);if(a.depth<.08&&b.depth<.08)return;if(a.depth<.08){const t=(.08-a.depth)/(b.depth-a.depth);ax+=(bx-ax)*t;az+=(bz-az)*t;a=project(ax,.38,az)}else if(b.depth<.08){const t=(.08-b.depth)/(a.depth-b.depth);bx+=(ax-bx)*t;bz+=(az-bz)*t;b=project(bx,.38,bz)}c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()}
   for(const d of [...world.decor].sort((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)-Math.hypot(a.x-p.x,a.z-p.z))){const q=project(d.x,0,d.z);if(q.depth<.2||q.x<0||q.x>=w||q.depth>this.depth[Math.floor(q.x)])continue;c.save();c.translate(q.x,q.y);c.scale(q.scale,q.scale);if(d.type==='planter'){c.fillStyle='#586762';c.fillRect(-.65,-.48,1.3,.48);c.fillStyle='#3a5b3c';c.beginPath();c.ellipse(0,-.65,.6,.35,0,0,Math.PI*2);c.fill()}else if(d.type==='bench'){c.fillStyle='#766047';c.fillRect(-1.15,-.6,2.3,.13);c.fillRect(-1.15,-1.1,2.3,.4);c.fillStyle='#384849';c.fillRect(-.85,-.5,.1,.5);c.fillRect(.75,-.5,.1,.5)}else{c.fillStyle='#344c50';c.fillRect(-.045,-2.65,.09,2.65);c.fillStyle='#e4c88c';c.beginPath();c.ellipse(0,-2.75,.14,.16,0,0,Math.PI*2);c.fill()}c.restore()}
   const box=world.showcase,q=project(box.x,0,box.z);if(q.depth>.2&&q.x>=0&&q.x<w&&q.depth<this.depth[Math.floor(q.x)]){const unit=q.scale;c.save();c.translate(q.x,q.y);c.scale(unit,unit);c.fillStyle='#475453';c.fillRect(-1.05,-2.15,2.1,.08);c.fillRect(-1.05,-.18,2.1,.12);c.fillRect(-1.05,-2.15,.06,2.05);c.fillRect(.99,-2.15,.06,2.05);c.fillRect(-1.05,-.92,2.1,.06);
    if(!scene.backpack){c.fillStyle='#647248';c.beginPath();c.roundRect(-.78,-1.65,.56,.7,.12);c.fill();c.strokeStyle='#303c29';c.strokeRect(-.7,-1.28,.4,.23)}
    if(!scene.swordTaken){c.fillStyle='#c0c8c9';c.fillRect(.42,-1.72,.065,.8);c.fillStyle='#6c5030';c.fillRect(.29,-1.78,.32,.04);c.fillRect(.42,-1.95,.065,.17)}
    if(!scene.showcaseOpen){c.fillStyle='#82bdc62c';c.fillRect(-.99,-2.07,1.98,1.84);c.strokeStyle='#adcbdc66';c.lineWidth=.012;c.beginPath();c.moveTo(-.85,-1.6);c.lineTo(-.45,-1.95);c.moveTo(-.7,-1.5);c.lineTo(-.3,-1.85);c.stroke()}c.restore()}
  }
  if(scene.appearance&&p.pitch<-.55){const fade=Math.min(1,(-p.pitch-.55)/.5),shade=pal.brightness||1;c.save();c.globalAlpha=fade;const tint=hex=>{const v=hexColor(hex);return 'rgb('+v.map((x,i)=>Math.round(x*255*shade*(.35+pal.light[i]*.65))).join(',')+')'};c.fillStyle=tint('#e5ab99');for(const side of [-1,1]){c.beginPath();c.ellipse(w/2+side*w*.055,h*.97,w*.034,h*.13,side*.13,0,Math.PI*2);c.fill()}c.fillStyle=tint(scene.appearance.shorts);c.beginPath();c.ellipse(w/2,h*1.06,w*.13,h*.25,0,0,Math.PI*2);c.fill();c.restore()}

 }
 destroy(){}
}

function hexColor(hex){return [1,3,5].map(i=>parseInt((hex||'#ddd2a1').slice(i,i+2),16)/255)}
function softwareLight(pal,k){return pal===FLOORS[0]?1:pal.brightness*(.35+pal.light[k]*.65)}
