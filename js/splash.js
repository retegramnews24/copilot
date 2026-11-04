/* Same five-second animated Julia artwork; sharper GPU rendition, adaptive CPU fallback. */
(()=>{'use strict';
 const screen=document.getElementById('splashScreen');let canvas=document.getElementById('splashCanvas');
 if(!screen||!canvas)return;
 const start=performance.now();let stopped=false,raf=0,last=0;
 const watchdog=setTimeout(()=>{screen.classList.add('is-leaving');screen.style.pointerEvents='none';setTimeout(()=>screen.remove(),440)},5050);
 const vertex=`#version 300 es
 in vec2 position;
 void main(){gl_Position=vec4(position,0.,1.);}`;
 const fragment=`#version 300 es
 precision highp float;
 uniform vec2 resolution;uniform float sec;
 out vec4 color;
 void main(){
  vec2 p=(gl_FragCoord.xy-.5*resolution)/resolution.x;
  p*=3.05/(1.10+.22*sin(sec*.72));
  float a=-sec*.055;mat2 rot=mat2(cos(a),sin(a),-sin(a),cos(a));
  vec2 z=rot*p;float cr=-.745+.045*sin(sec*.58),ci=.186+.052*cos(sec*.47);
  vec2 c=vec2(cr,ci);float n=0.;
  for(int i=0;i<72;i++){if(dot(z,z)>=64.)break;z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c;n+=1.;}
  float phase=sec*.34;
  float v=n>=72.?.035+.035*sin((p.x-p.y)*7.+phase):(n+1.-log2(max(1.e-8,log2(max(1.000001,length(z))))))*.075+phase;
  float aa=v*6.2831853;float glow=n>=72.?.20:1.;
  vec3 rgb=vec3((.52+.48*cos(aa+.2))*210.*glow+12.,(.5+.5*cos(aa+2.15))*190.*glow+9.,(.5+.5*cos(aa+4.25))*235.*glow+18.);
  color=vec4(clamp(rgb/255.,0.,1.),1.);
 }`;
 let gl=null,program=null,posBuffer=null,cpu=null,img=null,pix=null,w=0,h=0;
 try{
   gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
   if(gl){
    const shader=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);
    gl.useProgram(program);posBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl._res=gl.getUniformLocation(program,'resolution');gl._sec=gl.getUniformLocation(program,'sec');
   }
 }catch(e){console.warn('Splash GPU fallback',e);if(gl){try{gl.getExtension('WEBGL_lose_context')?.loseContext();}catch(_){ }const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;}gl=null;}
 if(!gl)cpu=canvas.getContext('2d',{alpha:false});
 function resize(){
   const ww=Math.max(1,innerWidth),hh=Math.max(1,innerHeight);
   if(gl){const dpr=Math.min(2,devicePixelRatio||1);const fit=Math.min(1,Math.sqrt(1500000/(ww*hh*dpr*dpr)));w=Math.max(1,Math.round(ww*dpr*fit));h=Math.max(1,Math.round(hh*dpr*fit));}
   else{const scale=Math.min(1,270/Math.max(ww,hh));w=Math.max(100,Math.round(ww*scale));h=Math.max(100,Math.round(hh*scale));}
   canvas.width=w;canvas.height=h;
   if(gl){gl.viewport(0,0,w,h);}else if(cpu){img=cpu.createImageData(w,h);pix=img.data;cpu.imageSmoothingEnabled=true;}
 }
 function draw(t){
  if(stopped)return;
  if(t-last<(gl?60:210)){raf=requestAnimationFrame(draw);return;}
  last=t;const sec=(t-start)/1000;
  if(gl){
   gl.useProgram(program);gl.uniform2f(gl._res,w,h);gl.uniform1f(gl._sec,sec);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }else if(cpu){
   const phase=sec*.34,zoom=1.10+.22*Math.sin(sec*.72),cr=-.745+.045*Math.sin(sec*.58),ci=.186+.052*Math.cos(sec*.47),rot=sec*.055,cs=Math.cos(rot),sn=Math.sin(rot),aspect=h/w;
   for(let py=0;py<h;py++){
    const yy=((py+.5)/h-.5)*3.05*aspect/zoom;
    for(let px=0;px<w;px++){
     const xx=((px+.5)/w-.5)*3.05/zoom,x0=xx*cs-yy*sn,y0=xx*sn+yy*cs;
     let x=x0,y=y0,n=0,xx2=0,yy2=0;
     while(n<48&&xx2+yy2<64){y=2*x*y+ci;x=xx2-yy2+cr;xx2=x*x;yy2=y*y;n++;}
     let v;if(n>=48)v=.035+.035*Math.sin((x0-y0)*7+phase);
     else{const mag=Math.sqrt(xx2+yy2);v=(n+1-Math.log2(Math.max(1e-8,Math.log2(Math.max(1.000001,mag)))))*.075+phase;}
     const k=(py*w+px)*4,a=v*6.2831853,glow=n>=72?.20:1;
     pix[k]=Math.max(0,Math.min(255,(.52+.48*Math.cos(a+.2))*210*glow+12));
     pix[k+1]=Math.max(0,Math.min(255,(.5+.5*Math.cos(a+2.15))*190*glow+9));
     pix[k+2]=Math.max(0,Math.min(255,(.5+.5*Math.cos(a+4.25))*235*glow+18));
     pix[k+3]=255;
    }
   }
   cpu.putImageData(img,0,0);
  }
  raf=requestAnimationFrame(draw);
 }
 resize();window.addEventListener('resize',resize,{passive:true});raf=requestAnimationFrame(draw);
 const leaveAt=Math.max(0,5000-(performance.now()-start)-400);
 setTimeout(()=>{screen.classList.add('is-leaving');setTimeout(()=>{
  stopped=true;clearTimeout(watchdog);cancelAnimationFrame(raf);window.removeEventListener('resize',resize);screen.remove();
  if(gl){try{gl.getExtension('WEBGL_lose_context')?.loseContext();}catch(_){}}
 },420);},leaveAt);
})();
