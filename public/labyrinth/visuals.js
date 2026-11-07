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
 if(backpack){rounded(-.27,.79,.54,.53,.09,gradient('#986743','#674327'));rounded(-.19,.89,.38,.24,.042,color('#805539'));rounded(-.29,1.28,.58,.12,.06,color('#beaa79'));c.strokeStyle=color('#c69c69');c.strokeRect(-.15,.95,.3,.14)}
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
 if(backpack&&front>=.5){c.strokeStyle=color('#b39465');c.lineWidth=.034;for(const sign of [-1,1]){c.beginPath();c.moveTo(sign*.16,1.35);c.lineTo(sign*.18,.91);c.stroke()}}
 if(gear.armor){
  for(let row=0;row<5;row++)rounded(-.215*width,.79+row*.079,.43*width,.103,.032,gradient('#b8b4a3','#747069'));
  for(const sign of [-1,1]){
   for(let layer=0;layer<3;layer++)oval(sign*(.17+layer*.021)*width,1.27-layer*.044,.083,.036,color('#a79b83'));
   rounded(sign*.105-.012,.87,.024,.36,.008,color('#b7894e'));
   for(let rivet=0;rivet<4;rivet++)oval(sign*.105,.91+rivet*.079,.016,.014,color('#dfbe7c'));
  }
 }
 if(gear.helmet){
  c.fillStyle=gradient('#be9855','#836137');c.beginPath();c.ellipse(hx,1.66,.193*width,.181,0,0,Math.PI);
  c.lineTo(hx-.173*width,1.56);c.lineTo(hx-.132*width,1.53);c.lineTo(hx-.112*width,1.665);
  c.lineTo(hx+.112*width,1.665);c.lineTo(hx+.132*width,1.53);c.lineTo(hx+.173*width,1.56);c.closePath();c.fill();
  rounded(hx-.166*width,1.665,.332*width,.035,.012,color('#dfba76'));
  oval(hx,1.835,.045+.08*Math.abs(side),.046,gradient('#ad3e30','#79291f'));
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
  c.moveTo(hand-.043,y+.05);c.lineTo(top-.017,y+(gear.guard?.17:.65));c.lineTo(top+.033,y+(gear.guard?.19:.55));c.lineTo(hand+.043,y+.045);c.closePath();c.fill();
  rounded(hand-.071,y+.037,.142,.04,.015,color('#ac8951'));
  rounded(hand-.021,y-.06,.042,.093,.015,color('#65543c'));
 }
 if(gear.shield){
  const x=(front<0?-1:1)*(gear.guard?.17:.315),y=gear.guard?1.19:1.0;
  rounded(x-.18,y-.255,.36,.51,.048,color('#c39d58'));
  rounded(x-.158,y-.233,.316,.466,.041,gradient('#ad4636','#7f2f24'));
  oval(x,y,.048,.055,color('#d1aa61'));
  for(const sign of [-1,1])for(const up of [-1,1])oval(x+sign*.115,y+up*.129,.027,.012,color('#cba261'));
 }
 sprites.set(key,cv);while(sprites.size>MAX_SPRITES)sprites.delete(sprites.keys().next().value);return cv;
}
let sky=null,shadow=null;
export function skyCanvas(){if(sky)return sky;sky=document.createElement('canvas');sky.width=512;sky.height=256;const c=sky.getContext('2d'),g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'#3b586e');g.addColorStop(.5,'#607e90');g.addColorStop(1,'#8ca8b4');c.fillStyle=g;c.fillRect(0,0,512,256);const rng=random(7091);for(let i=0;i<45;i++){const x=rng()*512,y=40+rng()*100,rx=12+rng()*42,ry=3+rng()*8;c.fillStyle='rgba(223,229,219,'+(.012+rng()*.035)+')';c.beginPath();c.ellipse(x,y,rx,ry,-.08,0,Math.PI*2);c.fill()}return sky}
export function shadowCanvas(){if(shadow)return shadow;shadow=document.createElement('canvas');shadow.width=shadow.height=64;const c=shadow.getContext('2d'),g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'#0007');g.addColorStop(.55,'#0004');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,64,64);return shadow}
export function spriteCacheSize(){return sprites.size}
const objects=new Map();
export function decorSprite(type,pal){
 const key='decor|'+type+'|'+pal.name;if(objects.has(key))return objects.get(key);
 const width=.90,height=type==='amphora'?1.06:1.32,cv=document.createElement('canvas');cv.width=128;cv.height=192;
 const c=cv.getContext('2d'),col=h=>litColor(h,pal);c.translate(64,190);c.scale(cv.width/width,-cv.height/height);
 const oval=(x,y,rx,ry,hex)=>{c.fillStyle=col(hex);c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill()};
 if(type==='amphora'){
  oval(0,.41,.324,.37,'#a25538');oval(-.078,.49,.174,.27,'#bf7350');oval(0,.78,.118,.18,'#a25538');
  c.strokeStyle=col('#7b432c');c.lineWidth=.058;
  for(const side of [-1,1]){c.beginPath();c.ellipse(side*.205,.67,.108,.16,0,0,Math.PI*2);c.stroke()}
  oval(0,.911,.129,.034,'#744330');oval(0,.15,.143,.075,'#8d4b32');
 }else{
  c.fillStyle=col('#694a32');for(const x of [-.25,.20])c.fillRect(x,.016,.064,.89);
  oval(0,.84,.36,.104,'#60412d');oval(0,.914,.36,.048,'#ac7d42');
  oval(0,1.04,.176,.126,'#e49c47');oval(-.034,.99,.082,.072,'#ffd390');
 }
 const value={canvas:cv,width,height};objects.set(key,value);return value;
}
export function showcaseSprite(box,pal){const key=['case',pal.name,!!box.backpack,!!box.swordTaken,!!box.helmet,!!box.armor,!!box.shieldTaken,!!box.open].join('|');if(objects.has(key))return objects.get(key);const cv=document.createElement('canvas');cv.width=160;cv.height=180;const c=cv.getContext('2d');c.translate(80,176);c.scale(66,-76);const col=h=>litColor(h,pal);const g=c.createLinearGradient(-1,0,1,2);g.addColorStop(0,col('#563f30'));g.addColorStop(1,col('#856343'));c.fillStyle=g;c.fillRect(-1.04,.13,2.08,1.98);c.strokeStyle=col('#c1cbbb');c.lineWidth=.025;c.strokeRect(-1.04,.13,2.08,1.98);c.fillStyle=col('#987751');c.fillRect(-1.08,.08,2.16,.12);c.fillRect(-1.08,2.08,2.16,.07);c.fillStyle=col('#a88457');c.fillRect(-1.04,.87,2.08,.045);c.fillStyle=col('#674831');for(const x of [-1.05,1])c.fillRect(x,.1,.05,2.01);
 if(!box.backpack){const pack=c.createLinearGradient(-.8,1,-.2,1.65);pack.addColorStop(0,col('#ae8052'));pack.addColorStop(1,col('#6b462e'));c.fillStyle=pack;c.beginPath();c.roundRect(-.79,.94,.58,.72,.1);c.fill();c.strokeStyle=col('#c5a16c');c.lineWidth=.015;c.strokeRect(-.71,1.01,.42,.22);c.fillStyle=col('#704a32');c.beginPath();c.roundRect(-.82,1.57,.64,.11,.05);c.fill()}
 if(!box.swordTaken){
  c.fillStyle=col('#d1d1c1');c.beginPath();c.moveTo(.38,1.24);c.lineTo(.52,1.24);c.lineTo(.51,1.64);c.lineTo(.45,1.83);c.lineTo(.39,1.64);c.closePath();c.fill();
  c.fillStyle=col('#b38a51');c.fillRect(.34,1.21,.22,.06);c.fillStyle=col('#71472d');c.fillRect(.42,1.05,.063,.18);
 }
 if(!box.helmet){
  c.fillStyle=col('#ad8649');c.beginPath();c.ellipse(-.67,.46,.163,.16,0,0,Math.PI);c.lineTo(-.82,.41);c.lineTo(-.52,.41);c.closePath();c.fill();
  c.fillStyle=col('#a33c2d');c.beginPath();c.ellipse(-.67,.63,.05,.035,0,0,Math.PI*2);c.fill();
 }
 if(!box.armor){
  for(let row=0;row<5;row++){c.fillStyle=col(row%2?'#8c8879':'#a8a193');c.beginPath();c.roundRect(-.17,.27+row*.085,.34,.10,.036);c.fill()}
  c.fillStyle=col('#b68b4d');c.fillRect(-.073,.30,.025,.39);c.fillRect(.048,.30,.025,.39);
 }
 if(!box.shieldTaken){
  for(const [dx,y,w,h,fill] of [[.492,.255,.356,.51,'#be995c'],[.516,.276,.308,.466,'#974338']]){
   c.fillStyle=col(fill);c.beginPath();c.roundRect(dx,y,w,h,.04);c.fill();
  }
  c.fillStyle=col('#c4a26a');c.beginPath();c.ellipse(.67,.51,.041,.057,0,0,Math.PI*2);c.fill();
 }
 if(!box.open){const glass=c.createLinearGradient(-1,0,1,2);glass.addColorStop(0,'#bbd7cf09');glass.addColorStop(.48,'#c4e3db16');glass.addColorStop(.52,'#dcece63a');glass.addColorStop(1,'#89b4bb19');c.fillStyle=glass;c.fillRect(-.99,.21,1.98,1.84);c.strokeStyle='#e4f1e64d';c.lineWidth=.012;c.beginPath();c.moveTo(-.85,1.5);c.lineTo(-.43,1.91);c.moveTo(-.69,1.47);c.lineTo(-.33,1.83);c.stroke()}
 objects.set(key,cv);return cv;
}
