// Small, reusable procedural canvases. No image downloads or frame-by-frame asset generation.
import {random} from './core.js';
const sprites=new Map(),MAX_SPRITES=24;
export function litColor(hex,pal,amount=1){const rgb=[1,3,5].map((n,i)=>Math.round(parseInt(hex.slice(n,n+2),16)*(pal?.brightness??1)*(.35+(pal?.light?.[i]??1)*.65)*amount));return 'rgb('+rgb.map(v=>Math.max(0,Math.min(255,v))).join(',')+')'}
export function avatarSprite(appearance,backpack,view,pal,gear={}){
 view=((Math.round(view)%8)+8)%8;const key=[appearance?.shirt,appearance?.shorts,backpack,view,pal?.name,!!gear.armor,!!gear.helmet,!!gear.shield,!!gear.weapon,!!gear.guard].join('|');if(sprites.has(key)){const s=sprites.get(key);sprites.delete(key);sprites.set(key,s);return s}
 const cv=document.createElement('canvas');cv.width=112;cv.height=192;const c=cv.getContext('2d'),angle=view*Math.PI/4,front=Math.cos(angle),side=Math.sin(angle),width=.82+.18*Math.abs(front),color=hex=>litColor(hex,pal),gradient=(a,b)=>{const g=c.createLinearGradient(-.3,0,.32,0);g.addColorStop(0,color(a));g.addColorStop(1,color(b));return g};
 c.translate(56,186);c.scale(96,-96);c.lineWidth=.012;c.lineJoin='round';
 function oval(x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill()}
 function rounded(x,y,w,h,r,fill){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
 if(backpack){rounded(-.27,.77,.54,.61,.1,gradient('#68764b','#3e4e31'));rounded(-.19,.84,.38,.24,.045,color('#3d4c31'));c.strokeStyle=color('#9b9b71');c.strokeRect(-.15,.9,.3,.13)}
 for(const sign of [-1,1]){rounded(sign*.12-.067,.12,.134,.48,.065,gradient('#f0bba7','#c88e7b'));rounded(sign*.12-.071,.13,.142,.14,.018,color('#e5e1cf'));oval(sign*.12+side*.025,.065,.092,.063,gradient('#3d4947','#25312f'));oval(sign*.12+side*.025,.026,.093,.018,color('#d9d6c5'))}
 rounded(-.24*width,.79,.48*width,.6,.12,gradient(appearance?.shirt||'#66b8cf',appearance?.shirt||'#66b8cf'));c.fillStyle=color('#000000');c.globalAlpha=.08;c.fillRect(.1*width,.82,.1,.49);c.globalAlpha=1;
 for(const sign of [-1,1]){rounded(sign*.28*width-.064,.76,.128,.48,.06,gradient('#eab19c','#ca927f'));rounded(sign*.27*width-.075,1.14,.15,.14,.06,color(appearance?.shirt||'#66b8cf'));oval(sign*.28*width,.75,.067,.075,color('#e9af9a'));rounded(sign*.115-.11,.54,.22,.31,.045,color(appearance?.shorts||'#3c62a3'));c.strokeStyle=color('#dddacb');c.lineWidth=.011;c.beginPath();c.moveTo(sign*.115-.08,.565);c.lineTo(sign*.115+.08,.565);c.stroke()}
 rounded(-.075,1.32,.15,.14,.04,color('#d49a85'));c.strokeStyle=color('#dcd9cb');c.lineWidth=.023;c.beginPath();c.arc(0,1.39,.09,Math.PI,Math.PI*2);c.stroke();
 const hx=side*.025;oval(hx-.163,1.60,.033,.055,color('#dca38f'));oval(hx+.163,1.60,.033,.055,color('#dca38f'));oval(hx,1.59,.16*width,.205,gradient('#f3c0ac','#d39a85'));
 // Hair reads from every direction; the face appears only on the front/three-quarter view.
 c.fillStyle=gradient('#4e3d30','#2b2823');c.beginPath();c.ellipse(hx,1.64,.167*width,.16,0,0,Math.PI);c.lineTo(hx-.16*width,1.66);c.quadraticCurveTo(hx-.04,1.72,hx+.08,1.70);c.lineTo(hx+.16*width,1.66);c.closePath();c.fill();
 if(front<-.35){oval(hx,1.62,.161*width,.16,gradient('#493a2d','#302b25'));}
 else if(front>.3){for(const sign of [-1,1]){const ex=hx+sign*.058*width;oval(ex,1.62,.032,.024,color('#f4eadb'));oval(ex+side*.009,1.62,.013,.017,color('#352e29'));c.strokeStyle=color('#554032');c.lineWidth=.014;c.beginPath();c.moveTo(ex-.026,1.665);c.quadraticCurveTo(ex,1.678,ex+.027,1.662);c.stroke()}oval(hx+side*.012,1.565,.024,.03,color('#d59b86'));c.strokeStyle=color('#81574a');c.lineWidth=.011;c.beginPath();c.moveTo(hx-.038,1.515);c.quadraticCurveTo(hx,1.494,hx+.038,1.515);c.stroke()}
 else {oval(hx+side*.135,1.57,.035,.035,color('#dca38e'));oval(hx+side*.085,1.625,.013,.02,color('#382e29'))}
 if(backpack&&front>=.5){c.strokeStyle=color('#78835a');c.lineWidth=.034;for(const sign of [-1,1]){c.beginPath();c.moveTo(sign*.16,1.35);c.lineTo(sign*.18,.91);c.stroke()}}
 if(gear.armor){
  rounded(-.22*width,.79,.44*width,.53,.105,gradient('#899da1','#485d65'));
  for(const sign of [-1,1]){
   oval(sign*.207*width,1.225,.081,.074,color('#758d95'));
   rounded(sign*.12-.015,.99,.03,.19,.012,color('#b2a27b'));
  }
  if(front>-.35){
   c.strokeStyle=color('#b7c1be');c.lineWidth=.02;c.beginPath();c.moveTo(-.16,.93);c.quadraticCurveTo(0,.88,.16,.93);c.stroke();
   oval(side*.036,1.04,.033,.046,color('#c3aa72'));
  }
 }
 if(gear.helmet){
  c.fillStyle=gradient('#879ca2','#4e656d');c.beginPath();c.ellipse(hx,1.66,.193*width,.181,0,0,Math.PI);c.lineTo(hx-.169*width,1.58);c.lineTo(hx-.132*width,1.58);c.lineTo(hx-.112*width,1.665);c.lineTo(hx+.112*width,1.665);c.lineTo(hx+.132*width,1.58);c.lineTo(hx+.169*width,1.58);c.closePath();c.fill();
  rounded(hx-.166*width,1.665,.332*width,.035,.012,color('#b0bebe'));
 }
 if(gear.guard){
  for(const sign of [-1,1]){
   c.strokeStyle=color('#d9a18e');c.lineWidth=.105;c.lineCap='round';c.beginPath();
   c.moveTo(sign*.3,1.08);c.lineTo(sign*.27,1.02);c.lineTo(sign*.13,1.37);c.stroke();
   oval(sign*.13,1.37,.06,.07,color('#e5b09a'));
  }
 }
 if(gear.weapon==='sword'){
  const hand=(front<0?1:-1)*(gear.guard?.16:.32),y=gear.guard?1.34:.78,top=gear.guard?hand+.53:hand-.09;
  c.fillStyle=gradient('#b5c2c9','#e4e9e8');c.beginPath();
  c.moveTo(hand-.024,y+.05);c.lineTo(top-.017,y+(gear.guard?.17:.78));c.lineTo(top+.033,y+(gear.guard?.19:.69));c.lineTo(hand+.023,y+.045);c.closePath();c.fill();
  rounded(hand-.071,y+.037,.142,.04,.015,color('#ac8951'));
  rounded(hand-.021,y-.06,.042,.093,.015,color('#65543c'));
 }
 if(gear.shield){
  const x=(front<0?-1:1)*(gear.guard?.17:.315),y=gear.guard?1.19:1.0;
  oval(x,y,.174,.254,color('#b6a378'));oval(x,y,.148,.226,gradient('#697f82','#4c666b'));
  oval(x,y,.048,.063,color('#c4b78d'));oval(x,y+.013,.031,.041,color('#e0d3ac'));
 }
 sprites.set(key,cv);while(sprites.size>MAX_SPRITES)sprites.delete(sprites.keys().next().value);return cv;
}
let sky=null,shadow=null;
export function skyCanvas(){if(sky)return sky;sky=document.createElement('canvas');sky.width=512;sky.height=256;const c=sky.getContext('2d'),g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'#3b586e');g.addColorStop(.5,'#607e90');g.addColorStop(1,'#8ca8b4');c.fillStyle=g;c.fillRect(0,0,512,256);const rng=random(7091);for(let i=0;i<45;i++){const x=rng()*512,y=40+rng()*100,rx=12+rng()*42,ry=3+rng()*8;c.fillStyle='rgba(223,229,219,'+(.012+rng()*.035)+')';c.beginPath();c.ellipse(x,y,rx,ry,-.08,0,Math.PI*2);c.fill()}return sky}
export function shadowCanvas(){if(shadow)return shadow;shadow=document.createElement('canvas');shadow.width=shadow.height=64;const c=shadow.getContext('2d'),g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'#0007');g.addColorStop(.55,'#0004');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,64,64);return shadow}
export function spriteCacheSize(){return sprites.size}
const objects=new Map();
export function decorSprite(type,pal){const key='decor|'+type+'|'+pal.name;if(objects.has(key))return objects.get(key);const width=type==='bench'?2.7:type==='planter'?1.8:.8,height=type==='lamp'?3.05:1.4,cv=document.createElement('canvas');cv.width=128;cv.height=192;const c=cv.getContext('2d'),scaleX=cv.width/width,scaleY=cv.height/height,col=h=>litColor(h,pal);c.translate(64,190);c.scale(scaleX,-scaleY);c.fillStyle='#0002';c.beginPath();c.ellipse(0,.012,type==='bench'?1.1:.54,.05,0,0,Math.PI*2);c.fill();
 if(type==='bench'){c.fillStyle=col('#354b49');for(const x of [-.85,.75])c.fillRect(x,0,.1,.51);for(let i=0;i<3;i++){c.fillStyle=col(i%2?'#876b4c':'#765c42');c.fillRect(-1.15,.62+i*.16,2.3,.105);c.fillStyle=col('#b39a7038');c.fillRect(-1.13,.63+i*.16,2.26,.013)}c.fillStyle=col('#866b4c');c.fillRect(-1.15,.45,2.3,.10);c.fillStyle=col('#b49c75');c.fillRect(-1.14,.54,2.28,.012)}
 else if(type==='planter'){const g=c.createLinearGradient(-.65,0,.65,0);g.addColorStop(0,col('#75847b'));g.addColorStop(1,col('#43554e'));c.fillStyle=g;c.fillRect(-.65,.02,1.3,.43);c.fillStyle=col('#86958a');c.fillRect(-.69,.43,1.38,.07);c.fillStyle=col('#28392a');c.beginPath();c.ellipse(0,.52,.58,.12,0,0,Math.PI*2);c.fill();for(let i=0;i<9;i++){const a=i/9*Math.PI*2;c.fillStyle=col(i%2?'#496846':'#607a4e');c.beginPath();c.ellipse(Math.cos(a)*.35,.66+Math.sin(a)*.13,.24,.22,a/2,0,Math.PI*2);c.fill()}}
 else{c.fillStyle=col('#334b50');c.fillRect(-.045,.02,.09,2.61);c.fillRect(-.13,.01,.26,.06);const g=c.createRadialGradient(-.03,2.76,.02,0,2.72,.19);g.addColorStop(0,col('#f7e9bf'));g.addColorStop(1,col('#c6a96e'));c.fillStyle=g;c.beginPath();c.ellipse(0,2.72,.15,.16,0,0,Math.PI*2);c.fill();c.fillStyle=col('#435653');c.fillRect(-.17,2.86,.34,.04);c.fillRect(-.14,2.56,.28,.04)}
 const value={canvas:cv,width,height};objects.set(key,value);return value;
}
export function showcaseSprite(box,pal){const key=['case',pal.name,!!box.backpack,!!box.swordTaken,!!box.helmet,!!box.armor,!!box.shieldTaken,!!box.open].join('|');if(objects.has(key))return objects.get(key);const cv=document.createElement('canvas');cv.width=160;cv.height=180;const c=cv.getContext('2d');c.translate(80,176);c.scale(66,-76);const col=h=>litColor(h,pal);const g=c.createLinearGradient(-1,0,1,2);g.addColorStop(0,col('#334a45'));g.addColorStop(1,col('#64736a'));c.fillStyle=g;c.fillRect(-1.04,.13,2.08,1.98);c.strokeStyle=col('#c1cbbb');c.lineWidth=.025;c.strokeRect(-1.04,.13,2.08,1.98);c.fillStyle=col('#7e8b81');c.fillRect(-1.08,.08,2.16,.12);c.fillRect(-1.08,2.08,2.16,.07);c.fillStyle=col('#9aa79b');c.fillRect(-1.04,.87,2.08,.045);c.fillStyle=col('#3b4e47');for(const x of [-1.05,1])c.fillRect(x,.1,.05,2.01);
 if(!box.backpack){const pack=c.createLinearGradient(-.8,1,-.2,1.65);pack.addColorStop(0,col('#83906a'));pack.addColorStop(1,col('#4a5c3f'));c.fillStyle=pack;c.beginPath();c.roundRect(-.79,.94,.58,.72,.1);c.fill();c.strokeStyle=col('#a4ac83');c.lineWidth=.015;c.strokeRect(-.71,1.01,.42,.22);c.fillStyle=col('#3a4b31');c.fillRect(-.67,1.45,.34,.03)}
 if(!box.swordTaken){const metal=c.createLinearGradient(.39,0,.49,0);metal.addColorStop(0,col('#8eaaaf'));metal.addColorStop(.5,col('#e1e8dd'));metal.addColorStop(1,col('#81999c'));c.fillStyle=metal;c.beginPath();c.moveTo(.4,.95);c.lineTo(.42,1.67);c.lineTo(.45,1.75);c.lineTo(.49,1.67);c.lineTo(.49,.95);c.closePath();c.fill();c.fillStyle=col('#aa8e4e');c.fillRect(.29,1.75,.32,.04);c.fillStyle=col('#6b5034');c.fillRect(.42,1.79,.065,.16)}
 if(!box.helmet){c.fillStyle=col('#8ba0a4');c.beginPath();c.ellipse(-.67,.47,.16,.17,0,0,Math.PI);c.lineTo(-.83,.41);c.lineTo(-.51,.41);c.closePath();c.fill();c.fillStyle=col('#cad4cc');c.fillRect(-.82,.47,.3,.024)}
 if(!box.armor){c.fillStyle=col('#748d96');c.beginPath();c.roundRect(-.17,.27,.34,.45,.08);c.fill();c.fillStyle=col('#b8a67d');c.fillRect(-.13,.55,.26,.035);c.fillRect(-.02,.38,.04,.12)}
 if(!box.shieldTaken){for(const [rx,ry,fill] of [[.178,.255,'#b39d6c'],[.151,.225,'#59777e'],[.041,.058,'#c1b48c']]){c.fillStyle=col(fill);c.beginPath();c.ellipse(.67,.51,rx,ry,0,0,Math.PI*2);c.fill()}}
 if(!box.open){const glass=c.createLinearGradient(-1,0,1,2);glass.addColorStop(0,'#bbd7cf09');glass.addColorStop(.48,'#c4e3db16');glass.addColorStop(.52,'#dcece63a');glass.addColorStop(1,'#89b4bb19');c.fillStyle=glass;c.fillRect(-.99,.21,1.98,1.84);c.strokeStyle='#e4f1e64d';c.lineWidth=.012;c.beginPath();c.moveTo(-.85,1.5);c.lineTo(-.43,1.91);c.moveTo(-.69,1.47);c.lineTo(-.33,1.83);c.stroke()}
 objects.set(key,cv);return cv;
}
