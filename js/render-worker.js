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
function seededRandom(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function pointRender(cfg,w,h){
 const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic,rand=seededRandom((cfg.type.length*2654435761+cfg.iterations*97)>>>0);
 for(let i=0;i<data.length;i+=4){data[i]=4;data[i+1]=7;data[i+2]=16;data[i+3]=255;}
 const put=(x,y,t)=>{let px=Math.round((x-cfg.cx)/cfg.scale*Math.min(w,h)+w/2),py=Math.round((y-cfg.cy)/cfg.scale*Math.min(w,h)+h/2);if(px<0||px>=w||py<0||py>=h)return;let k=(py*w+px)*4,col=pal(Math.max(0,Math.min(1,t)));data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];};
 const type=cfg.type,limit=Math.max(80000,Math.min(1500000,w*h*3.2));
 if(type==='fern'){
  let x=0,y=0;for(let i=0;i<limit;i++){let r=rand(),nx,ny;if(r<.01){nx=0;ny=.16*y;}else if(r<.86){nx=.85*x+.04*y;ny=-.04*x+.85*y+1.6;}else if(r<.93){nx=.2*x-.26*y;ny=.23*x+.22*y+1.6;}else{nx=-.15*x+.28*y;ny=.26*x+.24*y+.44;}x=nx;y=ny;if(i>30)put(x,y,(i%2400)/2400);}return data;
 }
 if(['lorenz','rossler','thomas','aizawa','halvorsen','chen','dadras'].includes(type)){
  let x=type==='halvorsen'?1:.1,y=type==='halvorsen'?0:.1,z=type==='halvorsen'?0:.1;const dt=type==='lorenz'?.005:type==='rossler'?.012:type==='chen'?.001:type==='dadras'?.005:type==='halvorsen'?.005:.012;
  for(let i=0;i<limit;i++){
   let dx,dy,dz;
   if(type==='lorenz'){dx=10*(y-x);dy=x*(28-z)-y;dz=x*y-(8/3)*z;}
   else if(type==='rossler'){dx=-y-z;dy=x+.2*y;dz=.2+z*(x-5.7);}
   else if(type==='thomas'){dx=Math.sin(y)-.208186*x;dy=Math.sin(z)-.208186*y;dz=Math.sin(x)-.208186*z;}
   else if(type==='halvorsen'){const a=1.4;dx=-a*x-4*y-4*z-y*y;dy=-a*y-4*z-4*x-z*z;dz=-a*z-4*x-4*y-x*x;}
   else if(type==='chen'){const a=35,b=3,c=28;dx=a*(y-x);dy=(c-a)*x-x*z+c*y;dz=x*y-b*z;}
   else if(type==='dadras'){const a=3,b=2.7,c=1.7,d=2,e=9;dx=y-a*x+b*y*z;dy=c*y-x*z+z;dz=d*x*y-e*z;}
   else{dx=(z-.7)*x-3.5*y;dy=3.5*x+(z-.7)*y;dz=.6+ .95*z-z*z*z/3-(x*x+y*y)*(1+.25*z)+.1*z*x*x*x;}
   x+=dx*dt;y+=dy*dt;z+=dz*dt;
   let px,py;if(type==='lorenz'){px=x/13;py=z/25-1;}else if(type==='rossler'){px=x/7;py=z/8-.15;}else if(type==='thomas'){px=x/3.2;py=y/3.2;}else if(type==='halvorsen'){px=x/11;py=y/11;}else if(type==='chen'){px=x/35;py=y/35;}else if(type==='dadras'){px=x/10;py=y/10;}else{px=x/1.5;py=y/1.5;}
   if(i>120)put(px,py,(i%12000)/12000);
  }return data;
 }
 if(['henon','ikeda','clifford','dejong','hopalong','bedhead'].includes(type)){
  let x=.11,y=.13;
  for(let i=0;i<limit;i++){
   let nx,ny;
   if(type==='henon'){nx=1-1.4*x*x+y;ny=.3*x;x=nx;y=ny;}
   else if(type==='ikeda'){let t=.4-6/(1+x*x+y*y),sn=Math.sin(t),cs=Math.cos(t);nx=1+.9*(x*cs-y*sn);ny=.9*(x*sn+y*cs);x=nx;y=ny;}
   else if(type==='clifford'){nx=Math.sin(-1.4*y)+.9*Math.cos(-1.4*x);ny=Math.sin(1.6*x)+.9*Math.cos(1.6*y);x=nx;y=ny;}
   else if(type==='dejong'){nx=Math.sin(2.01*y)-Math.cos(-2.53*x);ny=Math.sin(-1.61*x)-Math.cos(-.33*y);x=nx;y=ny;}
   else if(type==='hopalong'){nx=y-Math.sign(x||1)*Math.sqrt(Math.abs(1.0*x-.5));ny=1.8-x;x=nx;y=ny;}
   else{nx=Math.sin(x*y)*y+Math.cos(.4*x-y);ny=x+Math.sin(y);x=nx;y=ny;}
   if(i>100){let px=x,py=y;if(type==='henon'){px=x/1.25;py=y/.42;}else if(type==='hopalong'){px=x/5;py=y/5;}else if(type==='bedhead'){px=x/2.5;py=y/2.5;}else{px=x/1.45;py=y/1.45;}put(px,py,(i%8000)/8000);}
  }return data;
 }
 if(type==='flame'){
  let x=0,y=0;for(let i=0;i<limit;i++){let r=rand(),nx,ny;if(r<.25){nx=.5*x;ny=.5*y;}else if(r<.5){nx=.5*x+.5;ny=.5*y;}else if(r<.75){nx=.5*x;ny=.5*y+.5;}else{nx=.5*x+.5;ny=.5*y+.5;}let rr=nx*nx+ny*ny,a=Math.atan2(ny,nx),v=Math.sin(a+rr*2.5);x=Math.cos(a+v)*Math.sqrt(rr);y=Math.sin(a+v)*Math.sqrt(rr);if(i>50)put(x*1.6,y*1.6,(i%3000)/3000);}return data;
 }
 if(type==='dla'||type==='brownian-tree'){
  const N=Math.max(120,Math.min(220,Math.floor(Math.min(w,h)*.38))),grid=new Uint8Array(N*N),mid=N>>1,idx=(x,y)=>y*N+x;grid[idx(mid,mid)]=1;let maxR=2,particles=Math.max(500,Math.min(2600,Number(cfg.iterations)||1600));
  for(let p=0;p<particles;p++){let a=rand()*Math.PI*2,r=Math.min(N*.48,maxR+4+rand()*3),x=Math.round(mid+Math.cos(a)*r),y=Math.round(mid+Math.sin(a)*r);for(let step=0;step<1100;step++){let d=rand();if(d<.25)x++;else if(d<.5)x--;else if(d<.75)y++;else y--;if(x<2||y<2||x>=N-2||y>=N-2){a=rand()*Math.PI*2;x=Math.round(mid+Math.cos(a)*(maxR+5));y=Math.round(mid+Math.sin(a)*(maxR+5));continue;}let hit=false;for(let oy=-1;oy<=1&&!hit;oy++)for(let ox=-1;ox<=1;ox++)if(grid[idx(x+ox,y+oy)]){hit=true;break;}if(hit){grid[idx(x,y)]=1;maxR=Math.max(maxR,Math.hypot(x-mid,y-mid));break;}}}
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(grid[idx(x,y)]){let wx=(x-mid)/N*cfg.scale+cfg.cx,wy=(y-mid)/N*cfg.scale+cfg.cy;put(wx,wy,Math.hypot(x-mid,y-mid)/(N*.5));}return data;
 }
 return data;
}
function valueNoise(x,y){let ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const h=(a,b)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};let a=h(ix,iy),b=h(ix+1,iy),c=h(ix,iy+1),d=h(ix+1,iy+1);return(a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
function landscapeRender(cfg,w,h){let data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic,min=Math.min(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let wx=(x-w/2)/min*cfg.scale+cfg.cx,wy=(y-h/2)/min*cfg.scale+cfg.cy,v=0,amp=.56,freq=2,norm=0;for(let o=0;o<6;o++){v+=valueNoise((wx+.4)*freq,(wy-.2)*freq)*amp;norm+=amp;amp*=.52;freq*=2.03;}v/=norm;let ridge=1-Math.abs(v*2-1),t=Math.max(0,Math.min(1,(ridge-.24)*1.5));let col=pal(t),k=(y*w+x)*4;data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];data[k+3]=255;}return data;}
function grayScottRender(cfg,w,h){
 const N=192,total=N*N,u=new Float32Array(total),v=new Float32Array(total),un=new Float32Array(total),vn=new Float32Array(total),rand=seededRandom(918273+(cfg.palette*997));u.fill(1);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=y*N+x,dx=x-N/2,dy=y-N/2;if((Math.abs(dx)<12&&Math.abs(dy)<12)||(dx*dx+dy*dy<90&&rand()<.48)){u[k]=.5+rand()*.03;v[k]=.25+rand()*.03;}}
 const feed=.0367,kill=.0649,du=.16,dv=.08,steps=250;
 for(let t=0;t<steps;t++){
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,l=y*N+(x+N-1)%N,r=y*N+(x+1)%N,up=((y+N-1)%N)*N+x,dn=((y+1)%N)*N+x;
   const lapU=-u[i]+.2*(u[l]+u[r]+u[up]+u[dn])+.05*(u[((y+N-1)%N)*N+(x+N-1)%N]+u[((y+N-1)%N)*N+(x+1)%N]+u[((y+1)%N)*N+(x+N-1)%N]+u[((y+1)%N)*N+(x+1)%N]);
   const lapV=-v[i]+.2*(v[l]+v[r]+v[up]+v[dn])+.05*(v[((y+N-1)%N)*N+(x+N-1)%N]+v[((y+N-1)%N)*N+(x+1)%N]+v[((y+1)%N)*N+(x+N-1)%N]+v[((y+1)%N)*N+(x+1)%N]);
   const uvv=u[i]*v[i]*v[i];un[i]=Math.max(0,Math.min(1,u[i]+du*lapU-uvv+feed*(1-u[i])));vn[i]=Math.max(0,Math.min(1,v[i]+dv*lapV+uvv-(feed+kill)*v[i]));
  }u.set(un);v.set(vn);
 }
 const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic;
 const min=Math.min(w,h),bs=cfg.baseScale||2.5,bx=cfg.baseCx||0,by=cfg.baseCy||0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const wx=(x-w/2)/min*cfg.scale+cfg.cx,wy=(y-h/2)/min*cfg.scale+cfg.cy,u=(wx-(bx-bs/2))/bs,vv=(wy-(by-bs/2))/bs,xx=Math.max(0,Math.min(N-1,Math.floor(u*N))),yy=Math.max(0,Math.min(N-1,Math.floor(vv*N))),val=(u<0||u>1||vv<0||vv>1)?0:v[yy*N+xx],t=Math.max(0,Math.min(1,(val-.035)*8)),col=pal(t),k=(y*w+x)*4;data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];data[k+3]=255;}return data;
}
function lifeRender(cfg,w,h){
 const cols=220,rows=180,n=cols*rows,rand=seededRandom(4321987+(cfg.palette*31)),a=new Uint8Array(n),b=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=rand()<.32?1:0;
 for(let step=0;step<95;step++){for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let count=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;count+=a[((y+oy+rows)%rows)*cols+(x+ox+cols)%cols];}const k=y*cols+x;b[k]=count===3||(a[k]&&count===2)?1:0;}a.set(b);}
 const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic,min=Math.min(w,h),bs=cfg.baseScale||2.5,bx=cfg.baseCx||0,by=cfg.baseCy||0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let wx=(x-w/2)/min*cfg.scale+cfg.cx,wy=(y-h/2)/min*cfg.scale+cfg.cy,u=(wx-(bx-bs/2))/bs,vv=(wy-(by-bs/2))/bs,inside=u>=0&&u<=1&&vv>=0&&vv<=1,ix=Math.max(0,Math.min(cols-1,Math.floor(u*cols))),iy=Math.max(0,Math.min(rows-1,Math.floor(vv*rows))),on=inside&&a[iy*cols+ix],col=on?pal((ix+iy)/(cols+rows)):[5,8,17],k=(y*w+x)*4;data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];data[k+3]=255;}return data;
}
function bifurcationRender(cfg,w,h){
 const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic;for(let i=0;i<data.length;i+=4){data[i]=3;data[i+1]=5;data[i+2]=13;data[i+3]=255;}
 const min=Math.min(w,h),bs=cfg.baseScale||1.55,bx=cfg.baseCx??3.25,by=cfg.baseCy??.5;
 for(let px=0;px<w;px++){const wx=(px-w/2)/min*cfg.scale+cfg.cx,r=wx;if(r<2.5||r>4)continue;let q=.5;for(let n=0;n<650;n++)q=r*q*(1-q);for(let n=0;n<150;n++){q=r*q*(1-q);const py=Math.round((q-cfg.cy)/cfg.scale*min+h/2);if(py>=0&&py<h){const k=(py*w+px)*4,col=pal(n/150);data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];}}}
 return data;
}
function cellularRender(cfg,w,h,rule){const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic,cols=Math.max(64,Math.floor(w/Math.max(.4,cfg.scale/2))),rows=Math.max(64,Math.floor(h/Math.max(.4,cfg.scale/2))),state=new Uint8Array(cols),next=new Uint8Array(cols),baseScale=cfg.baseScale||cfg.scale,bx=cfg.baseCx||0,by=cfg.baseCy||0;state[cols>>1]=1;const cells=new Uint8Array(cols*rows);for(let y=0;y<rows;y++){cells.set(state,y*cols);for(let x=0;x<cols;x++){let l=state[(x+cols-1)%cols],c=state[x],r=state[(x+1)%cols];const pattern=(l<<2)|(c<<1)|r;next[x]=(rule>>pattern)&1;}state.set(next);}
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){let wx=(px-w/2)/Math.min(w,h)*cfg.scale+cfg.cx,wy=(py-h/2)/Math.min(w,h)*cfg.scale+cfg.cy,u=(wx-(bx-baseScale/2))/baseScale,v=(wy-(by-baseScale/2))/baseScale,ix=Math.floor(u*cols),iy=Math.floor(v*rows),on=ix>=0&&ix<cols&&iy>=0&&iy<rows&&cells[iy*cols+ix];let k=(py*w+px)*4,col=on?pal(iy/rows):[5,8,17];data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];data[k+3]=255;}return data;}
function lyapunovValue(x,y,max){let q=.5,sum=0,seq='AB';for(let i=0;i<max;i++){let r=(i%2===0?x:y);q=r*q*(1-q);let d=Math.abs(r*(1-2*q));sum+=Math.log(Math.max(1e-8,d));if(q<1e-8||q>1-1e-8)return -2;}return sum/max;}

async function renderSierpinski(cfg,w,h){const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic,min=Math.min(w,h),baseScale=cfg.baseScale||1.2,baseCx=cfg.baseCx??.5,baseCy=cfg.baseCy??.5,depth=Math.max(5,Math.min(20,Math.round(cfg.iterations/12)||10));for(let y0=0;y0<h;y0+=12){if(cfg.job!==newestJob)return data;const yMax=Math.min(h,y0+12);for(let py=y0;py<yMax;py++){const wy=(py-h/2)/min*cfg.scale+cfg.cy,v=(wy-(baseCy-baseScale/2))/baseScale;for(let px=0;px<w;px++){const wx=(px-w/2)/min*cfg.scale+cfg.cx,u=(wx-(baseCx-baseScale/2))/baseScale,k=(py*w+px)*4;let t=0,inside=false;if(u>=.03&&u<=.97&&v>=.04&&v<=.94){let xx=(u-.03)/.94,yy=(v-.04)/.90;let a=1-yy,b=.5*yy+.5-xx,c=.5*yy+xx-.5;inside=true;let level=0;for(;level<depth;level++){if(Math.max(a,b,c)<.5){inside=false;break;}if(a>=b&&a>=c){a=2*a-1;b*=2;c*=2;}else if(b>=c){b=2*b-1;a*=2;c*=2;}else{c=2*c-1;a*=2;b*=2;}}t=inside?.55+.4*(level/depth):0;}const col=inside?pal(t):[4,7,16];data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];data[k+3]=255;}}self.postMessage({job:cfg.job,progress:Math.round(yMax/h*100)});await new Promise(resolve=>setTimeout(resolve,0));}return data;}

function geometricPixel(type,u,v,depth){if(u<0||u>1||v<0||v>1)return false;if(type==='carpet'){for(let i=0;i<depth;i++){let x=u*3%1,y=v*3%1;if(x>1/3&&x<2/3&&y>1/3&&y<2/3)return false;u=u*3%1;v=v*3%1;}return true;}if(type==='vicsek'){for(let i=0;i<depth;i++){let x=u*3%1,y=v*3%1;let a=x<1/3?0:x<2/3?1:2,b=y<1/3?0:y<2/3?1:2;if(!((a===1&&b===1)||(a!==1&&b!==1)))return false;u=u*3%1;v=v*3%1;}return true;}if(type==='cantor'){if(v<.44||v>.56)return false;let x=u;for(let i=0;i<depth;i++){let t=x*3%1;if(t>1/3&&t<2/3)return false;x=x*3%1;}return true;}if(type==='cantor-dust'){for(let i=0;i<depth;i++){let x=u*3%1,y=v*3%1;if((x>1/3&&x<2/3)||(y>1/3&&y<2/3))return false;u=u*3%1;v=v*3%1;}return true;}return false;}

function drawVector(type,cfg,w,h){
 const off=new OffscreenCanvas(w,h),ctx=off.getContext('2d');
 ctx.fillStyle='#050811';ctx.fillRect(0,0,w,h);
 const pal=palettes[cfg.palette]||palettes.cosmic,stroke=pal(.72).map(v=>Math.round(v));
 ctx.strokeStyle=`rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;ctx.lineWidth=Math.max(1,w/900);ctx.lineCap='round';ctx.lineJoin='round';
 const cx=w/2,cy=h/2,unit=Math.min(w,h)*.42,baseScale=cfg.baseScale||cfg.scale,baseCx=cfg.baseCx||0,baseCy=cfg.baseCy||0,viewScale=baseScale/(cfg.scale||baseScale),tx=w/2*(1-viewScale)+(baseCx-cfg.cx)*Math.min(w,h)/(cfg.scale||baseScale),ty=h/2*(1-viewScale)+(baseCy-cfg.cy)*Math.min(w,h)/(cfg.scale||baseScale);ctx.setTransform(viewScale,0,0,viewScale,tx,ty);
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
 }else if(['sierpinski-arrowhead','gosper','minkowski','peano'].includes(type)){
  const rules=type==='sierpinski-arrowhead'?{A:'B-A-B',B:'A+B+A'}:type==='gosper'?{A:'A-B--B+A++AA+B-',B:'+A-BB--B-A++A+B'}:type==='minkowski'?{F:'F+F-F-F-F+F+F+F-F'}:{A:'A F B F A+F+A F B F A',B:'B F A F B-F-B F A F B'};
  const angle=type==='sierpinski-arrowhead'?Math.PI/3:type==='gosper'?Math.PI/3:Math.PI/2,depth=Math.min(type==='minkowski'?4:5,Math.max(1,Math.round(cfg.iterations))),axiom=type==='sierpinski-arrowhead'?'A':type==='gosper'?'A':type==='minkowski'?'F':'A';let str=axiom;
  for(let i=0;i<depth;i++){let out='';for(const ch of str)out+=rules[ch]||ch;str=out.replace(/\s/g,'');if(str.length>180000){str=str.slice(0,180000);break;}}
  let x=cx-unit*.55,y=cy+unit*.25,ang=type==='peano'?0:0,step=unit*1.1/Math.max(1,str.length*.35),pts=[];for(const ch of str){if(ch==='F'||ch==='A'||ch==='B'){x+=Math.cos(ang)*step;y+=Math.sin(ang)*step;pts.push([x,y]);}else if(ch==='+')ang+=angle;else if(ch==='-')ang-=angle;}
  if(pts.length){let minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1])),sc=unit*1.55/Math.max(1,maxX-minX,maxY-minY);ctx.beginPath();pts.forEach((p,i)=>{let xx=cx+(p[0]-(minX+maxX)/2)*sc,yy=cy+(p[1]-(minY+maxY)/2)*sc;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();}
 }else if(type==='cesaro'){
  function curve(a,b,n,sign=1){if(n===0){ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);return;}let dx=(b[0]-a[0])/4,dy=(b[1]-a[1])/4,pts=[a,[a[0]+dx,a[1]+dy],[a[0]+2*dx-sign*dy*.65,a[1]+2*dy+sign*dx*.65],[a[0]+3*dx,a[1]+3*dy],b];curve(pts[0],pts[1],n-1,sign);curve(pts[1],pts[2],n-1,-sign);curve(pts[2],pts[3],n-1,-sign);curve(pts[3],pts[4],n-1,sign);}
  ctx.beginPath();let r=unit*.72,pts=[[cx,cy-r],[cx-r*.866,cy+r*.5],[cx+r*.866,cy+r*.5]];for(let i=0;i<3;i++)curve(pts[i],pts[(i+1)%3],Math.min(6,Math.round(cfg.iterations)),i%2?1:-1);ctx.stroke();
 }else if(type==='hfractal'){
  function H(x,y,len,n){if(n<0||len<1)return;let d=len/2;ctx.beginPath();ctx.moveTo(x-d,y-d);ctx.lineTo(x-d,y+d);ctx.moveTo(x+d,y-d);ctx.lineTo(x+d,y+d);ctx.moveTo(x-d,y);ctx.lineTo(x+d,y);ctx.stroke();if(n){H(x-d,y-d,len*.5,n-1);H(x-d,y+d,len*.5,n-1);H(x+d,y-d,len*.5,n-1);H(x+d,y+d,len*.5,n-1);}}
  H(cx,cy,unit*1.5,Math.min(7,Math.round(cfg.iterations)));
 }else if(type==='tsquare'){
  function sq(x,y,size,n){if(n<0||size<1)return;ctx.strokeRect(x-size/2,y-size/2,size,size);if(n){let d=size*.5;for(const dx of [-1,1])for(const dy of [-1,1])sq(x+dx*d,y+dy*d,d,n-1);}}
  sq(cx,cy,unit*1.25,Math.min(6,Math.round(cfg.iterations)));
 }else if(type==='pentaflake'||type==='hexaflake'){
  const sides=type==='pentaflake'?5:6,depth=Math.min(4,Math.round(cfg.iterations)),shrink=type==='pentaflake'?.36:.38;function poly(x,y,r,n){if(n<0||r<1)return;ctx.beginPath();for(let i=0;i<sides;i++){let a=-Math.PI/2+i*Math.PI*2/sides,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.stroke();if(n){for(let i=0;i<sides;i++){let a=-Math.PI/2+i*Math.PI*2/sides;poly(x+Math.cos(a)*r*(1-shrink),y+Math.sin(a)*r*(1-shrink),r*shrink,n-1);}}}
  poly(cx,cy,unit*.72,depth);
 }else if(type==='plant'){
  function branch(x,y,len,ang,n){if(n<=0||len<1)return;let nx=x+Math.cos(ang)*len,ny=y+Math.sin(ang)*len;ctx.lineWidth=Math.max(.7,n*.55);ctx.strokeStyle=n<2?'#a9e8ab':`rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();branch(nx,ny,len*.72,ang-.47,n-1);branch(nx,ny,len*.72,ang+.47,n-1);if(n>3)branch(nx,ny,len*.82,ang,n-2);}
  branch(cx,cy+unit*.72,unit*.26,-Math.PI/2,Math.min(10,Math.round(cfg.iterations)));
 }else if(type==='tree'){
  function branch(x,y,len,ang,level){let nx=x+Math.cos(ang)*len,ny=y+Math.sin(ang)*len;ctx.lineWidth=Math.max(.6,level*.72);ctx.strokeStyle=level<3?'#57cba8':`rgb(${stroke[0]},${stroke[1]},${stroke[2]})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();if(level>0){branch(nx,ny,len*.72,ang-.48,level-1);branch(nx,ny,len*.72,ang+.48,level-1);}}
  branch(cx,cy+unit*.72,unit*.34,-Math.PI/2,Math.min(12,Math.round(cfg.iterations)));
 }
 return ctx.getImageData(0,0,w,h).data;
}

// Deep Mandelbrot/Julia renderer. Coordinates and the iterative orbit use signed
// fixed-point BigInt arithmetic: precision is configurable from 128 to 1024 bits.
function fixedRatioToNumber(v,bits){if(v===0n)return 0;const shift=BigInt(Math.max(0,bits-42));return Number(v>>shift)/Math.pow(2,bits-Number(shift));}
function fixedFromNumber(v,Q){return BigInt(Math.round(v*1e12))*Q/1000000000000n;}
async function renderDeep(cfg,w,h){
 const bits=Math.max(128,Math.min(1024,Number(cfg.deepBits)||512)),shift=BigInt(bits),Q=1n<<shift;
 const cx0=BigInt(cfg.deepCx),cy0=BigInt(cfg.deepCy),span=BigInt(cfg.deepScale),max=Math.max(40,Math.min(1200,Number(cfg.iterations)||240));
 const type=cfg.type;if(type!=='mandelbrot'&&type!=='julia')throw new Error('Deep zoom disponibile per Mandelbrot e Julia');
 const jr=Number(cfg.juliaReal),ji=Number(cfg.juliaImag),jcR=fixedFromNumber(Number.isFinite(jr)?jr:-.8,Q),jcI=fixedFromNumber(Number.isFinite(ji)?ji:.156,Q);
 const data=new Uint8ClampedArray(w*h*4),pal=palettes[cfg.palette]||palettes.cosmic,min=BigInt(Math.min(w,h)),den=2n*min,escape=256n*Q;
 const pxSpan=span;
 for(let y0=0;y0<h;y0+=3){if(cfg.job!==newestJob)return data;const ymax=Math.min(h,y0+3);
  for(let py=y0;py<ymax;py++){
   const oy=BigInt(2*py+1-h)*pxSpan/den,baseY=cy0+oy;
   for(let px=0;px<w;px++){
    const ox=BigInt(2*px+1-w)*pxSpan/den,cx=cx0+ox,cy=baseY;
    let zx=type==='julia'?cx:0n,zy=type==='julia'?cy:0n,cr=type==='julia'?jcR:cx,ci=type==='julia'?jcI:cy;
    let it=0,mag=0n;
    while(it<max){const xx=(zx*zx)>>shift,yy=(zy*zy)>>shift;mag=xx+yy;if(mag>escape)break;const xy=(zx*zy)>>shift;const nx=xx-yy+cr,ny=(xy<<1n)+ci;zx=nx;zy=ny;it++;}
    const k=(py*w+px)*4;
    if(it>=max){data[k]=3;data[k+1]=5;data[k+2]=13;data[k+3]=255;continue;}
    const radius=Math.sqrt(Math.max(1.000001,fixedRatioToNumber(mag,bits)));
    const smoothIt=it+1-Math.log2(Math.max(1e-9,Math.log2(radius)));
    const t=Math.max(0,Math.min(1,(smoothIt%max)/max)),col=pal(t);
    data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];data[k+3]=255;
   }
  }
  self.postMessage({job:cfg.job,progress:Math.round(ymax/h*100)});
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return data;
}

async function render(cfg){
 const job=cfg.job,w=cfg.width,h=cfg.height,type=cfg.type;
 let data;
 if(cfg.deep){
  data=await renderDeep(cfg,w,h);
 }else if(type==='fern'){
  data=pointRender(cfg,w,h);
 }else if(type==='sierpinski'){
  data=await renderSierpinski(cfg,w,h);
 }else if(['lorenz','rossler','thomas','aizawa','halvorsen','chen','dadras','henon','ikeda','clifford','dejong','hopalong','bedhead','flame','dla','brownian-tree'].includes(type)){
  data=pointRender(cfg,w,h);
 }else if(type==='landscape'){
  data=landscapeRender(cfg,w,h);
 }else if(type==='gray-scott'){
  data=grayScottRender(cfg,w,h);
 }else if(type==='game-of-life'){
  data=lifeRender(cfg,w,h);
 }else if(type==='logistic-bifurcation'){
  data=bifurcationRender(cfg,w,h);
 }else if(type==='rule30'||type==='rule90'||type==='rule110'){
  data=cellularRender(cfg,w,h,type==='rule30'?30:type==='rule90'?90:110);
 }else if(['koch','levy','dragon','hilbert','tree','pythagoras','apollonian','sierpinski-arrowhead','gosper','minkowski','peano','cesaro','hfractal','tsquare','pentaflake','hexaflake','plant'].includes(type)){
  data=drawVector(type,cfg,w,h);
 }else{
  data=new Uint8ClampedArray(w*h*4);
  const pal=palettes[cfg.palette]||palettes.cosmic,max=cfg.iterations;
  const depth=Math.min(9,Math.max(3,Math.round(['carpet','vicsek','cantor','cantor-dust'].includes(type)?cfg.iterations:cfg.iterations/25)));
  const min=Math.min(w,h),cx=cfg.cx,cy=cfg.cy,scale=cfg.scale;
  for(let y0=0;y0<h;y0+=10){
   if(job!==newestJob)return;
   const ymax=Math.min(h,y0+10);
   for(let py=y0;py<ymax;py++){
    for(let px=0;px<w;px++){
     const u=(px-w/2)/min*scale+cx,v=(py-h/2)/min*scale+cy,k=(py*w+px)*4;
     let t=0,inside=false;
     if(type==='carpet'||type==='vicsek'||type==='cantor'||type==='cantor-dust'){
      const bs=cfg.baseScale||scale,bx=cfg.baseCx||0,by=cfg.baseCy||0;inside=geometricPixel(type,(u-(bx-bs/2))/bs,(v-(by-bs/2))/bs,depth);t=inside?0.78:0;
     }else if(type==='romanesco'){
      const a=Math.atan2(v,u),r=Math.hypot(u,v),spiral=Math.abs(Math.sin(a*13+Math.log(r+1e-4)*5));
      t=spiral-Math.exp(-r*2)*.45<.09?0.7:0;
     }else{
      const result=type==='lyapunov'?{i:lyapunovValue(u,v,max),converged:false}:iterate(type,u,v,cfg);
      if(type==='lyapunov'){t=Math.max(0,Math.min(1,(result.i+1.8)/2.6));inside=result.i>0;}else if(type==='newton'||type==='newton4'){
       if(result.converged){const rootColor=[.08,.39,.72,.96][result.root]||.7;t=rootColor+(1-result.i)*.12;}else t=0;
      }else if(type==='biomorph'){
       t=result.i<max?0.25+Math.min(1,result.i/max)*.6:0;
      }else{
       inside=result.i>=max-1;t=inside?0:(result.i%max)/max;
      }
     }
     const col=pal(Math.max(0,Math.min(1,t)));
     if(type==='carpet'||type==='vicsek'||type==='cantor'||type==='cantor-dust'||type==='romanesco'||type==='lyapunov'){
      if(type==='lyapunov'?inside:(inside||t>0)){data[k]=col[0];data[k+1]=col[1];data[k+2]=col[2];}
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
