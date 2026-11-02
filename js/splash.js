/* Animated opening artwork. The splash is removed after exactly five seconds. */
(()=>{
  const screen=document.getElementById('splashScreen');
  const canvas=document.getElementById('splashCanvas');
  if(!screen||!canvas)return;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx){setTimeout(()=>screen.remove(),5000);return;}
  let w=0,h=0,image,pixels,frame=0,last=0,raf=0,stopped=false;
  const start=performance.now();
  function resize(){
    // Keep the low-resolution buffer at the device's aspect ratio while
    // limiting pixel count so the opening animation stays smooth on phones.
    const scale=Math.min(1.1,420/Math.max(innerWidth,innerHeight));
    w=Math.max(120,Math.round(innerWidth*scale));
    h=Math.max(120,Math.round(innerHeight*scale));
    canvas.width=w;canvas.height=h;
    image=ctx.createImageData(w,h);pixels=image.data;
  }
  function render(now){
    if(stopped)return;
    if(now-last<72){raf=requestAnimationFrame(render);return;}
    last=now;frame++;
    const t=(now-start)/1000;
    const phase=t*.34,zoom=1.10+.22*Math.sin(t*.72);
    const cr=-.745+.045*Math.sin(t*.58),ci=.186+.052*Math.cos(t*.47);
    const aspect=h/w,rot=t*.055,cs=Math.cos(rot),sn=Math.sin(rot);
    const maxIter=54;
    for(let py=0;py<h;py++){
      const yy=((py+.5)/h-.5)*3.05*aspect/zoom;
      for(let px=0;px<w;px++){
        const xx=((px+.5)/w-.5)*3.05/zoom;
        const x0=xx*cs-yy*sn,y0=xx*sn+yy*cs;
        let x=x0,y=y0,n=0,xx2=0,yy2=0;
        while(n<maxIter&&xx2+yy2<64){y=2*x*y+ci;x=xx2-yy2+cr;xx2=x*x;yy2=y*y;n++;}
        let v;
        if(n>=maxIter){v=.035+.035*Math.sin((x0-y0)*7+phase);}
        else{const mag=Math.sqrt(xx2+yy2);const smooth=n+1-Math.log2(Math.max(1e-9,Math.log2(Math.max(1.000001,mag))));v=smooth*.075+phase;}
        const k=(py*w+px)*4;
        const a=v*6.2831853;
        const glow=n>=maxIter?.20:1;
        pixels[k]=Math.max(0,Math.min(255,(.52+.48*Math.cos(a+0.2))*210*glow+12));
        pixels[k+1]=Math.max(0,Math.min(255,(.5+.5*Math.cos(a+2.15))*190*glow+9));
        pixels[k+2]=Math.max(0,Math.min(255,(.5+.5*Math.cos(a+4.25))*235*glow+18));
        pixels[k+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
    raf=requestAnimationFrame(render);
  }
  resize();
  window.addEventListener('resize',resize,{passive:true});
  raf=requestAnimationFrame(render);
  const leaveAt=Math.max(0,5000-(performance.now()-start)-400);
  setTimeout(()=>{
    screen.classList.add('is-leaving');
    setTimeout(()=>{
      stopped=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);screen.remove();
    },420);
  },leaveAt);
})();
