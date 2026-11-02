/* FractInt CPU renderer. All heavy 2D calculations run off the UI thread. */
let newestJob=0;
self.onmessage=(event)=>{const cfg=event.data;newestJob=cfg.job;render(cfg).catch(err=>self.postMessage({job:cfg.job,error:String(err)}));};
const palettes={cosmic:t=>[16+220*t,18+105*Math.sin(t*5.5)**2,45+205*(1-t)],fire:t=>[255*Math.min(1,t*2.2),215*Math.max(0,t-.25),35+65*(1-t)],ocean:t=>[10+20*t,35+190*t,70+185*t],aurora:t=>[35+175*Math.sin(t*3.3)**2,25+205*t,100+145*(1-t)],mono:t=>[255*t,255*t,255*t],candy:t=>[150+100*Math.sin(t*8),75+150*Math.sin(t*5+1),190+65*Math.cos(t*7)],gold:t=>[80+175*t,45+170*t,12+75*t],neon:t=>[40+210*t,220*(1-t),100+150*Math.sin(t*6)**2]};
function smooth(i,r){if(i===0)return 0;return i+1-Math.log2(Math.max(1e-12,Math.log2(Math.sqrt(r))));}
function complexPower(x,y,p){const r=Math.hypot(x,y),a=Math.atan2(y,x);const rp=Math.pow(r,p);return [rp*Math.cos(a*p),rp*Math.sin(a*p)];}
function iterate(kind,x,y,cfg){let zx=0,zy=0,cx=x,cy=y,prevx=0,prevy=0,iter=0,root=0;const max=cfg.iterations,p=cfg.power||2,cr=cfg.juliaReal,ci=cfg.juliaImag;
 if(kind==='julia'){zx=x;zy=y;cx=cr;cy=ci;}
 if(kind==='phoenix'){zx=0;zy=0;}
 if(kind==='newton'||kind==='newton4'){
  const degree=kind==='newton'?3:4;zx=x;zy=y;
  for(iter=0;iter<max;iter++){let [pr,pi]=complexPower(zx,zy,degree);pr-=1;let [dr,di]=complexPower(zx,zy,degree-1);dr*=degree;di*=degree;let den=dr*dr+di*di;if(den<1e-18)break;let qr=(pr*dr+pi*di)/den,qi=(pi*dr-pr*di)/den;zx-=qr;zy-=qi;if(Math.hypot(pr,pi)<1e-7)break;}
  let ang=(Math.atan2(zy,zx)+Math.PI*2)%(Math.PI*2);root=Math.round(ang/(Math.PI*2/degree))%degree;return {i:iter/max,r:1,root,converged:iter<max};
 }
 for(iter=0;iter<max;iter++){
  let nx,ny;
  if(kind==='burning'||kind==='buffalo'||kind==='perpendicular'){
   let ax=kind==='perpendicular'?zx:Math.abs(zx), ay=Math.abs(zy);if(kind==='buffalo')ay=-ay;
   nx=ax*ax-ay*ay+cx;ny=2*ax*ay+cy;
  }else if(kind==='tricorn') {nx=zx*zx-zy*zy+cx;ny=-2*zx*zy+cy;}
  else if(kind==='celtic'){nx=Math.abs(zx*zx-zy*zy)+cx;ny=2*zx*zy+cy;}
  else if(kind==='phoenix'){nx=zx*zx-zy*zy+cx-.5*prevx;ny=2*zx*zy+cy-.5*prevy;prevx=zx;prevy=zy;}
  else if(kind==='magnet'||kind==='magnet2'){
   let a,b,d,e;if(kind==='magnet'){a=zx*zx-zy*zy+cx-1;b=2*zx*zy+cy;d=2*zx+cx-2;e=2*zy+cy;}else{let [p3r,p3i]=complexPower(zx,zy,3),[p2r,p2i]=complexPower(zx,zy,2);a=p3r+3*(cx-1)*zx-3*(cy)*zy+cx-1;b=p3i+3*(cx-1)*zy+3*cy*zx+cy;d=3*p2r+3*(cx-2)*zx-3*cy*zy+cx-1;e=3*p2i+3*(cx-2)*zy+3*cy*zx+cy;}let den=d*d+e*e;if(den<1e-14)break;let rr=(a*d+b*e)/den,ri=(b*d-a*e)/den;nx=rr*rr-ri*ri;ny=2*rr*ri;
  }else if(kind==='sin'){nx=Math.sin(zx)*Math.cosh(Math.min(20,zy))+cx;ny=Math.cos(zx)*Math.sinh(Math.max(-20,Math.min(20,zy)))+cy;}
  else if(kind==='exponential'){let ex=Math.exp(Math.min(20,zx));nx=ex*Math.cos(zy)+cx;ny=ex*Math.sin(zy)+cy;}
  else if(kind==='mcmullen'){let r=zx*zx+zy*zy;if(r<1e-12)break;nx=zx*zx-zy*zy+cx+.25*(zx*zx-zy*zy)/(r*r);ny=2*zx*zy+cy-.5*zx*zy/(r*r);}
  else if(kind==='lambda'){nx=2.2*zx*(1-zx)+cx;ny=2.2*zy*(1-2*zx)+cy;}
  else if(kind==='nova'){let [p3r,p3i]=complexPower(zx,zy,3),[p2r,p2i]=complexPower(zx,zy,2);let den=9*(p2r*p2r+p2i*p2i);if(den<1e-14)break;let qr=((p3r-1)*3*p2r+p3i*3*p2i)/den,qi=(p3i*3*p2r-(p3r-1)*3*p2i)/den;nx=zx-qr+cx;ny=zy-qi+cy;}
  else {let [pr,pi]=complexPower(zx,zy,p);nx=pr+cx;ny=pi+cy;}
  zx=nx;zy=ny;let r2=zx*zx+zy*zy;
  if(kind==='biomorph'){if(Math.abs(zx)>4||Math.abs(zy)>4)break;}else if(r2>256)break;
 }
 let rr=zx*zx+zy*zy;return {i:smooth(iter,rr),r:rr,root,converged:iter>=max-1};
}
function pointRender(cfg,w,h){let data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic;for(let i=0;i<data.length;i+=4){data[i]=4;data[i+1]=7;data[i+2]=16;data[i+3]=255;}const put=(x,y,t)=>{let px=Math.round((x-cfg.cx)/cfg.scale*Math.min(w,h)+w/2),py=Math.round((y-cfg.cy)/cfg.scale*Math.min(w,h)+h/2);if(px<0||px>=w||py<0||py>=h)return;let k=(py*w+px)*4,col=pal(t);data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];};
 let seed=cfg.job*9197+17;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 if(cfg.type==='fern'){let x=0,y=0,n=Math.max(90000,Math.min(650000,w*h*.85));for(let i=0;i<n;i++){let r=rand(),nx,ny;if(r<.01){nx=0;ny=.16*y;}else if(r<.86){nx=.85*x+.04*y;ny=-.04*x+.85*y+1.6;}else if(r<.93){nx=.2*x-.26*y;ny=.23*x+.22*y+1.6;}else{nx=-.15*x+.28*y;ny=.26*x+.24*y+.44;}x=nx;y=ny;if(i>30){let px=(x/5.5+.5)*w,py=h-(y/10.5)*h;if(px>=0&&px<w&&py>=0&&py<h){let k=(Math.floor(py)*w+Math.floor(px))*4,col=pal((i%1500)/1500);data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];}}}return data;}
 if(cfg.type==='sierpinski'){let verts=[[.5,.04],[.03,.94],[.97,.94]],x=.5,y=.5,n=Math.min(700000,w*h*1.1);for(let i=0;i<n;i++){let v=verts[(rand()*3)|0];x=(x+v[0])/2;y=(y+v[1])/2;if(i>20){let px=x*w,py=y*h,k=(Math.floor(py)*w+Math.floor(px))*4,col=pal((i%1000)/1000);data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];}}return data;}
 return data;
}
function geometricPixel(type,u,v,depth){
 if(type==='carpet'){for(let i=0;i<depth;i++){let x=((u%1)+1)%1,y=((v%1)+1)%1;if(x>1/3&&x<2/3&&y>1/3&&y<2/3)return false;u=u*3%1;v=v*3%1;}return true;}
 if(type==='vicsek'){for(let i=0;i<depth;i++){let x=((u%1)+1)%1,y=((v%1)+1)%1;let a=x<1/3?0:x<2/3?1:2,b=y<1/3?0:y<2/3?1:2;if(!((a===1&&b===1)||(a!==1&&b!==1)))return false;u=u*3%1;v=v*3%1;}return true;}
 if(type==='cantor'){if(v>.48||v<-.48)return false;let x=(u+1)/2;for(let i=0;i<depth;i++){let t=x*3%1;if(t>1/3&&t<2/3)return false;x=x*3%1;}return true;}
 return false;
}
function drawVector(type,cfg,w,h){
 const off=new OffscreenCanvas(w,h),ctx=off.getContext('2d');
 ctx.fillStyle='#050811';ctx.fillRect(0,0,w,h);
 const pal=palettes[cfg.palette]||palettes.cosmic,stroke=pal(.72).map(v=>Math.round(v));
 ctx.strokeStyle=`rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;ctx.lineWidth=Math.max(1,w/900);ctx.lineCap='round';ctx.lineJoin='round';
 const cx=w/2,cy=h/2,unit=Math.min(w,h)*.42;
 if(type==='koch'){
  function line(a,b,n){if(n===0){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);return;}let dx=(b[0]-a[0])/3,dy=(b[1]-a[1])/3,p=[a[0]+dx,a[1]+dy],q=[a[0]+2*dx,a[1]+2*dy],ang=-Math.PI/3,peak=[p[0]+dx*Math.cos(ang)-dy*Math.sin(ang),p[1]+dx*Math.sin(ang)+dy*Math.cos(ang)];line(a,p,n-1);line(p,peak,n-1);line(peak,q,n-1);line(q,b,n-1);}
  let r=unit*.82,pts=[[cx,cy-r],[cx-r*.866,cy+r*.5],[cx+r*.866,cy+r*.5]];ctx.beginPath();for(let i=0;i<3;i++)line(pts[i],pts[(i+1)%3],Math.min(6,Math.round(cfg.iterations)));ctx.stroke();
 }else if(type==='levy'){
  function levy(a,b,n){if(n===0){ctx.moveTo(...a);ctx.lineTo(...b);return;}let dx=b[0]-a[0],dy=b[1]-a[1],m=[(a[0]+b[0])/2-dy/2,(a[1]+b[1])/2+dx/2];levy(a,m,n-1);levy(m,b,n-1);}
  ctx.beginPath();levy([cx-unit*.6,cy+unit*.35],[cx+unit*.6,cy-unit*.35],Math.min(17,Math.round(cfg.iterations)));ctx.stroke();
 }else if(type==='dragon'){
  let str='FX',n=Math.min(15,Math.round(cfg.iterations));for(let i=0;i<n;i++){let out='';for(const ch of str)out+=ch==='X'?'X+YF+':ch==='Y'?'-FX-Y':ch;str=out;}
  let x=cx-unit*.4,y=cy+unit*.15,ang=0,step=unit*.8/Math.pow(2,n/2),points=[[x,y]];for(const ch of str){if(ch==='F'){x+=Math.cos(ang)*step;y+=Math.sin(ang)*step;points.push([x,y]);}else if(ch==='+')ang+=Math.PI/2;else if(ch==='-')ang-=Math.PI/2;}
  let minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));let sx=unit*1.5/Math.max(1,maxX-minX),sy=unit*1.5/Math.max(1,maxY-minY),sc=Math.min(sx,sy);ctx.beginPath();points.forEach((p,i)=>{let xx=cx+(p[0]-(minX+maxX)/2)*sc,yy=cy+(p[1]-(minY+maxY)/2)*sc;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
 }else if(type==='hilbert'){
  const order=Math.min(8,Math.max(1,Math.round(cfg.iterations))),N=1<<order,total=N*N;function d2xy(n,d){let x=0,y=0,t=d;for(let s=1;s<n;s*=2){let rx=1&(t>>1),ry=1&(t^rx);if(ry===0){if(rx===1){x=s-1-x;y=s-1-y;}let z=x;x=y;y=z;}x+=s*rx;y+=s*ry;t>>=2;}return [x,y];}
  ctx.beginPath();for(let d=0;d<total;d++){let [x,y]=d2xy(N,d),xx=cx+(x/(N-1)-.5)*unit*1.8,yy=cy+(y/(N-1)-.5)*unit*1.8;d?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();
 }else if(type==='pythagoras') {
  function squareTree(a,b,level){let dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(level<0||len<1)return;let nx=-dy,ny=dx,c=[b[0]+nx,b[1]+ny],d=[a[0]+nx,a[1]+ny];ctx.strokeStyle=level<3?'#59d6b5':`rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;ctx.lineWidth=Math.max(.6,level*.65);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.closePath();ctx.stroke();let mid=[(c[0]+d[0])/2+(c[1]-d[1])/2,(c[1]+d[1])/2-(c[0]-d[0])/2];squareTree(d,mid,level-1);squareTree(mid,c,level-1);}
  let size=unit*.36;squareTree([cx-size/2,cy+unit*.55],[cx+size/2,cy+unit*.55],Math.min(10,Math.round(cfg.iterations)));
 }else if(type==='apollonian'){
  let R=2.154700538,rad=unit/R,base=[{x:0,y:0,k:-1/R,r:R},...Array.from({length:3},(_,i)=>{let a=-Math.PI/2+i*2*Math.PI/3;return{x:Math.cos(a)*2/Math.sqrt(3),y:Math.sin(a)*2/Math.sqrt(3),k:1,r:1}})];
  const seen=[];function addCircle(c){if(!Number.isFinite(c.x+c.y+c.r)||c.r<=.002||c.r>1.2)return false;if(Math.abs(c.x)>R+0.2||Math.abs(c.y)>R+0.2)return false;for(const s of seen)if(Math.hypot(c.x-s.x,c.y-s.y)<Math.max(.001,c.r*.018)&&Math.abs(c.r-s.r)<Math.max(.001,c.r*.018))return false;seen.push(c);ctx.beginPath();ctx.arc(cx+c.x*rad,cy+c.y*rad,c.r*rad,0,Math.PI*2);ctx.strokeStyle=`rgba(${stroke[0]},${stroke[1]},${stroke[2]},${Math.min(.95,.3+c.r*1.6)})`;ctx.lineWidth=Math.max(.5,rad*.009);ctx.stroke();return true;}
  function fill(q,depth){if(depth<=0)return;for(let omit=0;omit<4;omit++){let t=q.filter((_,i)=>i!==omit),k=2*(t[0].k+t[1].k+t[2].k)-q[omit].k;if(k<=0)continue;let x=(2*(t[0].k*t[0].x+t[1].k*t[1].x+t[2].k*t[2].x)-q[omit].k*q[omit].x)/k,y=(2*(t[0].k*t[0].y+t[1].k*t[1].y+t[2].k*t[2].y)-q[omit].k*q[omit].y)/k,c={x,y,k,r:1/k};if(addCircle(c)){let nq=q.slice();nq[omit]=c;fill(nq,depth-1);}}}
  for(const c of base)addCircle(c);fill(base,Math.min(8,Math.max(1,Math.round(cfg.iterations/2))));
 }else if(type==='tree'){
  function branch(x,y,len,ang,level){let nx=x+Math.cos(ang)*len,ny=y+Math.sin(ang)*len;ctx.lineWidth=Math.max(.6,level*.72);ctx.strokeStyle=level<3?'#57cba8':`rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();if(level>0){branch(nx,ny,len*.72,ang-.48,level-1);branch(nx,ny,len*.72,ang+.48,level-1);}}
  branch(cx,cy+unit*.72,unit*.34,-Math.PI/2,Math.min(12,Math.round(cfg.iterations)));
 }
 return ctx.getImageData(0,0,w,h).data;
}
async function render(cfg){
 const job=cfg.job,w=cfg.width,h=cfg.height,type=cfg.type;
 let data;
 if(['fern','sierpinski'].includes(type)){
  data=pointRender(cfg,w,h);
 }else if(['koch','levy','dragon','hilbert','tree','pythagoras','apollonian'].includes(type)){
  data=drawVector(type,cfg,w,h);
 }else{
  data=new Uint8ClampedArray(w*h*4);
  const pal=palettes[cfg.palette]||palettes.cosmic,max=cfg.iterations;
  const depth=Math.min(9,Math.max(3,Math.round(['carpet','vicsek','cantor'].includes(type)?cfg.iterations:cfg.iterations/25)));
  const min=Math.min(w,h),cx=cfg.cx,cy=cfg.cy,scale=cfg.scale;
  for(let y0=0;y0<h;y0+=10){
   if(job!==newestJob)return;
   const ymax=Math.min(h,y0+10);
   for(let py=y0;py<ymax;py++){
    for(let px=0;px<w;px++){
     const u=(px-w/2)/min*scale+cx,v=(py-h/2)/min*scale+cy,k=(py*w+px)*4;
     let t=0,inside=false;
     if(type==='carpet'||type==='vicsek'||type==='cantor'){
      inside=geometricPixel(type,u/scale+0.5,v/scale+0.5,depth);t=inside?0.78:0;
     }else if(type==='romanesco'){
      const a=Math.atan2(v,u),r=Math.hypot(u,v),spiral=Math.abs(Math.sin(a*13+Math.log(r+1e-4)*5));
      t=spiral-Math.exp(-r*2)*.45<.09?0.7:0;
     }else{
      const result=iterate(type,u,v,cfg);
      if(type==='newton'||type==='newton4'){
       if(result.converged){const rootColor=[.08,.39,.72,.96][result.root]||.7;t=rootColor+(1-result.i)*.12;}else t=0;
      }else if(type==='biomorph'){
       t=result.i<max?0.25+Math.min(1,result.i/max)*.6:0;
      }else{
       inside=result.i>=max-1;t=inside?0:(result.i%max)/max;
      }
     }
     const col=pal(Math.max(0,Math.min(1,t)));
     if(type==='carpet'||type==='vicsek'||type==='cantor'||type==='romanesco'){
      if(inside||t>0){data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];}
      else{data[k]=5;data[k+1]=8;data[k+2]=17;}
     }else{data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];}
     data[k+3]=255;
    }
   }
   self.postMessage({job,progress:Math.round(ymax/h*100)});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 if(job!==newestJob)return;
 self.postMessage({job,width:w,height:h,pixels:data.buffer},[data.buffer]);
}
