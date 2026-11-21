'use strict';
const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const blend = (a, b, t) => a + (b-a)*t;
const ease = x => { const t=clamp(x,0,1); return t*t*(3-2*t); };
const stable = (from,to,dt,tau) => to+(from-to)*Math.exp(-dt/tau);
const stops = [
  {name:'Officina', s:0, side:'left', time:0},
  {name:'Ponte Verde', s:1120, side:'right', time:103},
  {name:'Valle Bassa', s:2480, side:'left', time:229},
  {name:'Lago Chiaro', s:3890, side:'right', time:354},
  {name:'Borgo del Fiume', s:5320, side:'left', time:482},
  {name:'Costa dei Larici', s:6880, side:'right', time:615},
  {name:'Belvedere', s:8420, side:'left', time:751}
];
const TERMINUS=stops.at(-1).s;
const limits = [[-120,45],[190,75],[870,45],[1280,90],[2100,60],[2310,35],
  [2640,85],[3460,60],[3700,40],[4050,85],[4740,65],[5120,40],
  [5500,90],[6440,65],[6660,45],[7050,90],[7930,65],[8220,35]];
const grades = [[-120,0],[220,10],[610,-12],[960,0],[1250,-14],[1640,12],[2080,-8],[2330,0],
  [2680,8],[3090,-11],[3690,0],[4030,-7],[4550,4],[5090,0],
  [5490,12],[6040,-7],[6650,0],[7060,9],[7670,-11],[8190,0]];
const LEVELS=[0,.14,.32,.52,.75,1], POWER=[0,.24,.48,.75,1];
const MASS=160000, G=9.81, DWELL=8, STOP_TOL=10;
const fmt = (value,digits=0) => value.toLocaleString('it-IT',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const sideName = side => side==='left'?'sinistra':'destra';
const signs = limits.slice(1).map(([s,value])=>({s, label:String(value), type:'limit', side:-1}));
for(const stop of stops) signs.push({s:stop.s-44,label:stop.name,type:'station',side:stop.side==='left'?-1:1},
  {s:stop.s,label:'STOP',type:'stop',side:stop.side==='left'?-1:1});
function sectionAt(rows,s){let i=rows.length-1;while(i>0&&s<rows[i][0])i--;return i;}
function gradeAt(s){
  const i=sectionAt(grades,s), [start,grade]=grades[i];
  return i?blend(grades[i-1][1],grade,ease((s-start)/54)):grade;
}
function curveAt(s) {
  const bend=(a,b,r)=>ease((s-a)/115)*ease((b-s)/115)/r;
  return bend(255,730,460)-bend(1350,1820,510)+bend(1890,2260,760)
    -bend(2660,3090,700)+bend(3130,3720,610)-bend(4150,4530,640)
    +bend(4760,5120,720)-bend(5540,6080,670)+bend(6150,6620,620)
    -bend(7090,7660,730)+bend(7730,8200,650);
}
const stepLength=2, trackStart=-160, trackEnd=TERMINUS+300, track=[];
let wx=0, wy=0, wz=0, yaw=0;
for(let s=trackStart;s<=trackEnd;s+=stepLength){
  track.push({x:wx,y:wy,z:wz,yaw});
  const turn=curveAt(s+1)*stepLength;
  wx+=Math.sin(yaw+turn/2)*stepLength; wz+=Math.cos(yaw+turn/2)*stepLength;
  wy+=gradeAt(s+1)*stepLength/1000; yaw+=turn;
}
function trackAt(s) {
  const f=clamp((s-trackStart)/stepLength,0,track.length-1.001), i=Math.floor(f), t=f-i;
  const a=track[i],b=track[i+1];
  return {x:blend(a.x,b.x,t), y:blend(a.y,b.y,t), z:blend(a.z,b.z,t), yaw:blend(a.yaw,b.yaw,t)};
}
let renderDirty=true;
let selectedWeather='dry', train, mode='intro', note='', noteUntil=0, audio=null, audioOn=false;
function reset() {
  train={s:0,v:0,a:0,traction:0,brake:3,pipe:5-1.45*LEVELS[3],front:LEVELS[3],rear:LEVELS[3],
    direction:1,emergency:false,doors:'left',dwell:0,docked:0,next:1,elapsed:0,started:false,
    weather:selectedWeather,sand:0,sandUses:3,slip:false,slide:false,stopResults:[],overspeed:0,rough:0,emergencies:0};
  note='Chiudi le porte a sinistra, rilascia il freno e dai trazione.';
  noteUntil=Infinity;
  renderDirty=true;
}
reset();
function setNote(text,seconds=4){note=text;noteUntil=train.elapsed+seconds;}
function adhere() {
  if(train.weather==='dry') return .23;
  const leafPatch=train.s>1570&&train.s<1815;
  return (leafPatch?.073:.115)+(train.sand>0?.055:0);
}
function tick(dt){
  const t=train;
  if(t.started)t.elapsed+=dt;
  t.sand=Math.max(0,t.sand-dt);
  if(t.doors&&t.docked>0){
    t.dwell+=dt;
    if(t.docked===stops.length-1&&t.dwell>=DWELL){recordStop(t.docked);end(true);return;}
  }
  const demand=t.emergency?1:LEVELS[t.brake];
  t.pipe=stable(t.pipe,5-(t.emergency?4.65:1.45*demand),dt,t.emergency?.45:1.15);
  const pipeDemand=t.emergency?1:clamp((5-t.pipe)/1.45,0,1);
  t.front=stable(t.front,pipeDemand,dt,pipeDemand>t.front?.65:1.6);
  t.rear=stable(t.rear,t.front,dt,t.front>t.rear?.8:1.1);
  const v=Math.abs(t.v), mu=adhere(), air=(t.front+t.rear)/2;
  const drive=(!t.doors&&!t.brake&&!t.emergency)?Math.min(148000,1900000/Math.max(3,v))*POWER[t.traction]:0;
  const motorCap=mu*MASS*G*.55;
  const desiredBrake=air*(t.emergency?208000:151000);
  const brakeCap=mu*MASS*G*.96;
  t.slip=drive>motorCap+100; t.slide=desiredBrake>brakeCap+100;
  const gradeForce=-MASS*G*gradeAt(t.s)/1000;
  const net=Math.min(drive,motorCap)*t.direction+gradeForce;
  const drag=1900+72*v+13*v*v+Math.abs(curveAt(t.s))*360000;
  const hold=t.doors?MASS*G*.035:0;
  const resistance=drag+Math.min(desiredBrake,brakeCap)+hold;
  const sign=v>.006?Math.sign(t.v):Math.sign(net);
  const force=v<.006&&Math.abs(net)<=resistance?0:net-sign*resistance;
  const acceleration=force/MASS, before=t.v;
  let after=v<.006&&Math.abs(net)<=resistance?0:before+acceleration*dt;
  if(Math.abs(before)>.006&&Math.sign(after)!==Math.sign(before)&&Math.abs(net)<=resistance)after=0;
  // Limiter for shunting back into a missed stop.
  if(t.direction<0&&after < -5)after=Math.min(before,-5);
  t.v=after; t.s+=(before+after)*.5*dt;
  const smoothed=stable(t.a,(after-before)/dt,dt,.33);
  if(v>3&&Math.abs(smoothed-t.a)/dt>1.05)t.rough+=dt;
  t.a=smoothed;
  if(v*3.6>limits[sectionAt(limits,t.s)][1]+2)t.overspeed+=dt;
  if(t.s < -116||t.s>TERMINUS+155)end(false);
}
function recordStop(index){
  const t=train;
  t.stopResults.push({name:stops[index].name,offset:t.stopOffset,late:t.arrival-stops[index].time});
}
function toggleDoors(side){
  const t=train;
  if(t.doors){
    if(t.doors!==side){setNote('Sono aperte le porte a '+sideName(t.doors)+'.');return;}
    if(t.docked>0&&t.dwell<DWELL){setNote('Attendi la fine della sosta prima di chiudere.');return;}
    if(t.docked>0){recordStop(t.docked);t.next=t.docked+1;}
    t.doors=null; t.docked=-1; t.started=true; setNote('Porte chiuse. Rilascia il freno, poi dai trazione.');
    return;
  }
  const stop=stops[t.next];
  if(!stop||Math.abs(t.s-stop.s)>STOP_TOL){setNote('Fermati entro 10 m dal cartello STOP della prossima stazione.');return;}
  if(Math.abs(t.v)>.06){setNote('Attendi che il treno sia completamente fermo.');return;}
  if(t.brake<1&&!t.emergency){setNote('Applica il freno prima di aprire le porte.');return;}
  if(side!==stop.side){setNote('La banchina è a '+sideName(stop.side)+'.');return;}
  t.traction=0; t.doors=side; t.docked=t.next; t.dwell=0;
  t.arrival=t.elapsed; t.stopOffset=t.s-stop.s; setNote('Porte aperte · sosta minima 8 s.');
}
function command(cmd){
  if(mode!=='run')return;
  const t=train;
  switch(cmd){
    case 'powerUp':
      if(t.doors||t.brake||t.emergency){setNote(t.doors?'Chiudi le porte prima di dare trazione.':'Rilascia il freno prima di dare trazione.');return;}
      t.traction=clamp(t.traction+1,0,4);if(noteUntil===Infinity)noteUntil=0;break;
    case 'powerDown':t.traction=Math.max(0,t.traction-1);break;
    case 'brakeUp':t.brake=Math.min(5,t.brake+1);t.traction=0;break;
    case 'brakeDown':if(!t.emergency)t.brake=Math.max(0,t.brake-1);break;
    case 'reverse':
      if(Math.abs(t.v)>.06||t.traction||t.doors){setNote('Per invertire fermati, azzera la trazione e chiudi le porte.');return;}
      t.direction*=-1;setNote(t.direction<0?'Retromarcia · fino a 18 km/h.':'Marcia avanti.');break;
    case 'left':case 'right':toggleDoors(cmd);break;
    case 'sand':
      if(t.sand>0||t.sandUses===0)return;
      t.sand=6;t.sandUses--;setNote('Sabbia applicata per 6 secondi.');break;
    case 'emergency':
      if(t.emergency){
        if(Math.abs(t.v)>.06){setNote('Puoi riarmare il freno di emergenza a treno fermo.');return;}
        t.emergency=false;t.brake=5;setNote('Emergenza riarmata. Allenta il freno per ripartire.');
      }else{t.emergency=true;t.traction=0;t.emergencies++;setNote('Freno di emergenza applicato.');}break;
    case 'horn':if(audioOn)horn();break;
  }
  drawHUD();
}
