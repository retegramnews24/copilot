'use strict';
const rooms = [
 ['Radice','Rame sotto la terra','#fa8874',3,5,'Segui le radici fino al punto in cui si incontrano.','Senti l’appoggio.'],
 ['Sacro','La marea d’ambra','#ffb564',5,8,'Lascia che la corrente disegni la sua curva.','Segui l’onda.'],
 ['Plesso solare','Un sole di seta','#ffd476',8,13,'Guarda la luce aprirsi dal centro verso l’esterno.','Lascia spazio.'],
 ['Cuore','Il giardino sospeso','#88dfae',8,13,'Tra una foglia e l’altra affiora una seconda spirale.','Resta nel verde.'],
 ['Gola','La conchiglia azzurra','#78d9ef',5,8,'Ascolta il piccolo intervallo tra due onde.','Segui l’eco.'],
 ['Terzo occhio','L’iride della notte','#a29bf7',13,21,'Lascia scorrere le orbite senza sceglierne una.','Osserva piano.'],
 ['Corona','La fioritura viola','#e3a6f6',8,21,'Segui l’ultimo petalo mentre torna verso il centro.','Raccogli la luce.']
];
const TAU=2*Math.PI, PHI=89/55, GA=TAU/(PHI*PHI);
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function tint(col,amount,alpha){return 'rgba('+col.map((v,i)=>Math.round(v+([255,238,205][i]-v)*amount)).join(',')+','+alpha+')'}
const sky=document.getElementById('sky'),ctx=sky.getContext('2d',{alpha:false});
let plates=[],oldPlate=null,artIndex=0,fade=5,visualTime=0,still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function buildPlate(i){
 const side=Math.min(987,Math.max(377,Math.ceil(Math.min(sky.width,sky.height)*PHI)));
 const tile=document.createElement('canvas');tile.width=tile.height=side;const g=tile.getContext('2d'),s=side/2;
 const col=rgb(rooms[i][2]),a=rooms[i][3],b=rooms[i][4];
 g.translate(s,s);g.scale(s,s);g.lineCap='round';
 // Each level repeats the same curved branch at 5/8 of its parent.
 function branch(len,depth,sign){if(!depth)return;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(len*3/8,-len/8,len,0);g.strokeStyle=tint(col,depth/8,depth/8);g.lineWidth=(depth+1)/610;g.stroke();g.save();g.translate(len,0);for(const flip of [-1,1]){g.save();g.rotate(flip*(GA/5)+sign/13);branch(len*5/8,depth-1,-sign);g.restore()}g.restore()}
 for(let j=0;j<a;j++){g.save();g.rotate(j*TAU/a);branch(3/8,i===0||i===3?5:3,1);g.restore()}
 // Two counter-winding families of translucent ribbons.
 for(let family=0;family<2;family++){const count=family?b:a,sign=family?-1:1;
 for(let j=0;j<count;j++){for(let strand=0;strand<13;strand++){
 const u=(strand-6)/13;g.beginPath();
 for(let n=0;n<=89;n++){const t=n/89,r=.021+t*(.84+u/8);
 const angle=j*TAU/count+sign*(t*GA*(1+i%3/3)+u*Math.sin(Math.PI*t)/3)+Math.sin(t*Math.PI*2+i)*.13;
 const x=Math.cos(angle)*r,y=Math.sin(angle)*r*(1-(i%3)/13);n?g.lineTo(x,y):g.moveTo(x,y)}
 g.strokeStyle=tint(col,strand/21,(family?3:5)/34);g.lineWidth=(strand%5===0?2:1)/610;g.stroke()
 }}}
 // A seed becomes a translucent petal with its own smaller vein.
 for(let n=377;n>0;n--){const t=Math.sqrt(n/377),theta=n*GA+i/5,r=t*(.72+.13*Math.sin(theta*a+t*GA));
 g.save();g.rotate(theta);g.translate(r,0);g.rotate(theta/13+t*GA+i/3);
 const len=(1-t*5/8)*(i===3?1/8:1/13),width=len*(i===2?5/8:3/8);
 g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(len/2,-width,len,0);g.quadraticCurveTo(len/2,width,0,0);
 g.fillStyle=tint(col,n%8/13,(1-t/2)*3/13);g.fill();g.lineWidth=1/610;g.strokeStyle=tint(col,n%13/21,(1-t/2)*5/8);g.stroke();g.beginPath();g.moveTo(0,0);g.lineTo(len,0);g.strokeStyle=tint(col,5/8,.34);g.stroke();g.restore()}
 return tile
}
function changeArt(i){if(i===artIndex)return;oldPlate=artIndex;artIndex=i;fade=still?5:0}
function paint(dt){
 visualTime+=still?0:dt;fade=Math.min(5,fade+dt);const w=sky.clientWidth,h=sky.clientHeight;if(!w||!h)return;
 const d=Math.min(devicePixelRatio||1,PHI);if(sky.width!==Math.round(w*d)||sky.height!==Math.round(h*d)){sky.width=Math.round(w*d);sky.height=Math.round(h*d);plates=[]}
 ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#090913';ctx.fillRect(0,0,w,h);
 const x=w*(w>h?5/8:1/2),y=h*(w>h?1/2:3/8),size=Math.min(w*(w>h?5/8:1.13),h*(w>h?1.13:.89));
 const t=fade/5,k=t*t*(3-2*t);
 function layer(i,alpha){if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;const col=rgb(rooms[i][2]),halo=ctx.createRadialGradient(x,y,0,x,y,size*.72);
 halo.addColorStop(0,tint(col,0,.21));halo.addColorStop(.55,tint(col,0,.13));halo.addColorStop(1,tint(col,0,0));ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
 ctx.translate(x,y);ctx.rotate(visualTime*TAU/233);const p=1+Math.sin(visualTime*TAU/13)/34;
 if(!plates[i])plates[i]=buildPlate(i);if(i===artIndex&&oldPlate!==null&&k<1){
 const opening=size*(1/13+k*5/8);ctx.beginPath();ctx.arc(0,0,opening,0,TAU);ctx.clip()
 }
 ctx.drawImage(plates[i],-size*p/2,-size*p/2,size*p,size*p);
 ctx.rotate(-visualTime*TAU/89);ctx.globalAlpha=alpha*.55;ctx.drawImage(plates[i],-size*3/16,-size*3/16,size*3/8,size*3/8);
 // Luminous pulses travel along the threads and unfold from the core.
 ctx.rotate(visualTime*TAU/89);ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;
 for(let j=0;j<21;j++){
 const u=(visualTime/21+j*8/21)%1, arm=j%rooms[i][3];
 const theta=arm*TAU/rooms[i][3]+u*GA*(1+i%3/3)+Math.sin(u*TAU+i)*.13;
 const r=size*p/2*(.021+.84*u),lx=r*Math.cos(theta),ly=r*Math.sin(theta)*(1-(i%3)/13);
 const light=ctx.createRadialGradient(lx,ly,0,lx,ly,8);
 light.addColorStop(0,tint(col,5/8,Math.sin(u*Math.PI)*.89));light.addColorStop(1,tint(col,0,0));
 ctx.fillStyle=light;ctx.fillRect(lx-8,ly-8,16,16)
 }
 ctx.restore()}
 if(oldPlate!==null&&k<1)layer(oldPlate,1-k);layer(artIndex,oldPlate===null?1:k);
 if(k===1&&oldPlate!==null){plates[oldPlate]=null;oldPlate=null}
 const col=rgb(rooms[artIndex][2]);
 for(let j=0;j<89;j++){const a=j*GA+visualTime/144,r=Math.sqrt((j+1)/89)*Math.max(w,h)*5/8;
 ctx.fillStyle=tint(col,3/5,.21+.13*Math.sin(j+visualTime/8));ctx.beginPath();ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,(j%3+1)/3,0,TAU);ctx.fill()}
}
