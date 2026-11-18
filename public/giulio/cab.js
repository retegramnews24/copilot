function clock(seconds){
  const t=8*3600+17*60+Math.max(0,Math.floor(seconds));
  return [Math.floor(t/3600),Math.floor(t/60)%60,t%60].map(v=>String(v).padStart(2,'0')).join(':');
}
function indicators(id,n){for(let i=0;i<n;i++)$(id).append(document.createElement('i'));}
indicators('traction-steps',4);indicators('brake-steps',5);
function markSteps(id,n){[...$(id).children].forEach((e,i)=>e.classList.toggle('active',i<n));}
function drawHUD(){
  const t=train, v=Math.abs(t.v)*3.6, index=sectionAt(limits,t.s), limit=limits[index][1], next=stops[t.next], sign=limits[index+1];
  $('speed').textContent=fmt(v);$('speed').classList.toggle('warn',v>limit+2);
  $('speed-arc').setAttribute('stroke-dasharray',clamp(v/110*100,0,100)+' 100');
  $('speed-arc').setAttribute('stroke',v>limit+2?'#ff9b89':'#bce28b');
  $('cab-needle').setAttribute('transform','rotate('+(-130+260*clamp(v/110,0,1))+' 75 56)');
  // Speed dial: red from the current limit up, a yellow mark for the next limit when it is close.
  const lp=clamp(limit/110*100,0,100);$('limit-zone').setAttribute('stroke-dasharray','0 '+lp+' '+(100-lp));
  const near=sign&&t.direction>0&&sign[0]-t.s<400?clamp(sign[1]/110*100,0,100):null;
  $('next-zone').setAttribute('stroke-dasharray',near===null?'0 100':'0 '+Math.max(0,near-.9)+' 1.8 100');
  $('doors').classList.toggle('on',!!t.doors);$('doors').textContent=t.doors?'Chiudi porte':'Apri porte';
  $('traction-lever').style.setProperty('--lever',t.traction/4);
  $('brake-lever').style.setProperty('--lever',t.emergency?1:t.brake/5);
  $('pipe-gauge').style.setProperty('--needle',(-130+260*clamp(t.pipe/5,0,1))+'deg');
  $('cyl-gauge').style.setProperty('--needle',(-130+260*clamp((t.front+t.rear)/2,0,1))+'deg');
  $('limit').textContent=limit;
  $('traction').textContent=t.traction+' / 4';$('brake').textContent=t.emergency?'EMG':t.brake+' / 5';
  markSteps('traction-steps',t.traction);markSteps('brake-steps',t.emergency?5:t.brake);
  $('doors-left').classList.toggle('on',t.doors==='left');$('doors-right').classList.toggle('on',t.doors==='right');
  $('doors-left').setAttribute('aria-pressed',String(t.doors==='left'));$('doors-right').setAttribute('aria-pressed',String(t.doors==='right'));
  const reverseLabel=t.direction>0?'Avanti':'Indietro';
  if($('reverser').firstChild.data!==reverseLabel+' ')$('reverser').firstChild.data=reverseLabel+' ';
  $('emergency').classList.toggle('on',t.emergency);$('emergency').setAttribute('aria-pressed',String(t.emergency));
  $('sand').disabled=t.sand>0||t.sandUses===0;$('sand').classList.toggle('on',t.sand>0);
  $('sand').title='Sabbia: '+t.sandUses+' erogazioni rimaste';
  $('pipe').textContent=fmt(t.pipe,2)+' bar';
  $('cyl').textContent=fmt((t.front+t.rear)*1.8,2)+' bar';
  $('acc').textContent=fmt(t.a,2)+' m/s²';
  const grade=Math.round(gradeAt(t.s));
  $('grade').textContent=(grade>0?'+':'')+grade+' ‰';
  let state=t.emergency?'EMERGENZA':t.doors?'PORTE APERTE':t.slip?'SLITTAMENTO':t.slide?'ANTISLITTAMENTO':v<.2?'FERMO':t.brake?'IN FRENATA':t.traction?'IN TRAZIONE':'INERZIA';
  $('state').textContent=state;$('state').classList.toggle('warn',t.slip||t.slide||t.emergency);
  $('progress').max=TERMINUS;$('progress').value=clamp(t.s,0,TERMINUS);$('clock').textContent=clock(t.elapsed);
  $('stop-count').textContent=t.stopResults.length+' / '+(stops.length-1)+' fermate';
  $('next-limit').textContent=t.direction>0&&sign&&sign[0]-t.s<260?'Limite '+sign[1]+' tra '+fmt(sign[0]-t.s)+' m':'';
  const docking=t.doors&&t.docked>=0;
  $('hud-status').textContent=docking?'In banchina':'Prossima fermata';
  $('destination').textContent=docking?stops[t.docked].name:next?.name??'Arrivo';
  const diff=(next?.s??TERMINUS)-t.s;
  $('distance').textContent=docking?(t.docked===0?'Porte a sinistra':t.dwell<DWELL?'Sosta · '+Math.ceil(DWELL-t.dwell)+' s':'Sosta completata · chiudi le porte'):
    (diff< -STOP_TOL?'Oltre lo STOP di '+fmt(-diff)+' m':fmt(Math.max(0,diff))+' m · '+(next?clock(next.time).slice(0,8):'')+' · '+(next?sideName(next.side):''));
  let hint=t.elapsed<noteUntil?note:'';
  if(!hint&&v>limit+2)hint='Limite superato · riduci la velocità.';
  if(!hint&&!docking&&diff< -STOP_TOL)hint='Fermata superata. Fermati e usa la retromarcia per recuperarla.';
  if(!hint&&!docking&&diff<=STOP_TOL&&diff>=-STOP_TOL&&v<.22&&next)hint='Fermata valida · apri le porte a '+sideName(next.side)+'.';
  $('message').hidden=!hint;$('message').textContent=hint;
}

function setOverlay(kind){
  mode=kind;
  const overlay=$('overlay'),body=$('brief-body');
  overlay.hidden=kind==='run';$('simulator').inert=kind!=='run';$('pause').disabled=kind==='intro'||kind==='result';
  if(kind==='run')return;
  $('restart').hidden=kind==='intro';$('weather').hidden=kind==='paused';
  $('continue').hidden=kind==='result';
  $('brief-note').hidden=kind!=='intro';
  if(kind==='intro'){
    $('brief-kicker').textContent='Linea dei Due Laghi · '+(TERMINUS/1000).toLocaleString('it-IT',{maximumFractionDigits:2})+' km';$('brief-title').textContent='Giulio Simulator';
    $('continue').textContent='Entra in cabina';
    body.innerHTML='<p>Porta il regionale da Officina a Belvedere, con sei fermate lungo la Linea dei Due Laghi. Rispetta i limiti e arresta il muso entro 10 metri dal cartello STOP.</p><div class="legend"><span><kbd>W / S</kbd> Trazione</span><span><kbd>D / A</kbd> Freno</span><span><kbd>Q / E</kbd> Porte Sx / Dx</span><span><kbd>R</kbd> Invertitore da fermo</span><span><kbd>C</kbd> Sabbia</span><span><kbd>X</kbd> Emergenza</span><span><kbd>P</kbd> Pausa</span><span><kbd>H</kbd> Tromba con audio</span></div><p class="minor">Trascina il parabrezza per guardare a 180°, oppure usa ←, → e Home. Per partire, chiudi le porte a sinistra e allenta il freno fino a zero.</p>';
  }else if(kind==='paused'){
    $('brief-kicker').textContent='Cabina in pausa';$('brief-title').textContent='Pausa';
    $('continue').textContent='Riprendi';body.textContent='Il tempo della corsa è fermo.';
  }
}
function end(complete){
  if(mode!=='run')return;
  const t=train;
  setOverlay('result');
  $('brief-kicker').textContent=complete?'Capolinea raggiunto':'Corsa interrotta';
  $('brief-title').textContent=complete?'Corsa completata':'Fine prova';
  const penalty=Math.min(35,t.overspeed*.65)+Math.min(18,t.rough*.38)+Math.min(20,t.emergencies*5)+
    t.stopResults.reduce((sum,r)=>sum+Math.abs(r.offset)*.75+Math.min(10,Math.max(0,Math.abs(r.late)-18)*.13),0);
  const body=$('brief-body');body.replaceChildren();
  const score=document.createElement('p');
  score.textContent=complete?'Valutazione '+Math.round(clamp(100-penalty,0,100))+' / 100':'Hai raggiunto il limite fisico della tratta.';
  body.append(score);
  const list=document.createElement('ul');list.className='results';
  const lines=t.stopResults.map(r=>r.name+' · scarto '+fmt(Math.abs(r.offset),1)+' m · '+
    (Math.abs(r.late)<1?'in orario':fmt(Math.abs(r.late))+' s '+(r.late>0?'di ritardo':'in anticipo')));
  lines.push('Tempo oltre il limite · '+fmt(t.overspeed,1)+' s','Comfort · '+fmt(t.rough,1)+' s di variazioni brusche');
  for(const line of lines){const li=document.createElement('li');li.textContent=line;list.append(li);}
  body.append(list);$('restart').focus();
}
function togglePause(){if(mode==='run'){setOverlay('paused');$('continue').focus();}else if(mode==='paused')setOverlay('run');}
$('pause').onclick=togglePause;
$('continue').onclick=()=>{if(mode==='intro'){reset();setLook(0,0);}setOverlay('run');};
$('restart').onclick=()=>{if(mode==='paused'){setOverlay('intro');return;}reset();setLook(0,0);setOverlay('run');};
const embedded=window.parent!==window;
if(embedded){
  $('exit').hidden=false;
  $('full').hidden=true;
  $('exit').onclick=()=>{saveCab();parent.postMessage({type:'arcade:exit'},location.origin)};
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='arcade:insets')return;
    for(const side of ['top','bottom','left','right']){
      const value=event.data.insets?.[side];
      const px=x=>Number.isFinite(x)?clamp(x,0,180):0;
      document.documentElement.style.setProperty('--cab-safe-'+side,px(value?.system)+px(value?.content)+'px');
    }
  });
  parent.postMessage({type:'arcade:ready'},location.origin);
}
$('full').onclick=()=>{
  if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
  else document.documentElement.requestFullscreen?.().catch(()=>{});
};
for(const btn of document.querySelectorAll('[data-weather]')){
  btn.onclick=()=>{selectedWeather=btn.dataset.weather;if(mode==='intro'){train.weather=selectedWeather;renderDirty=true;}for(const other of document.querySelectorAll('[data-weather]'))other.setAttribute('aria-pressed',String(other===btn));};
}
for(const btn of document.querySelectorAll('[data-cmd]'))btn.onclick=()=>command(btn.dataset.cmd);
const bindings={KeyW:'powerUp',ArrowUp:'powerUp',KeyS:'powerDown',ArrowDown:'powerDown',KeyD:'brakeUp',KeyA:'brakeDown',KeyR:'reverse',KeyQ:'left',KeyE:'right',KeyC:'sand',KeyX:'emergency',KeyH:'horn'};
window.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.code==='KeyP'||event.code==='Escape'){if(!event.repeat)togglePause();return;}
  if(mode==='run'&&['ArrowLeft','ArrowRight','Home'].includes(event.code)){
    event.preventDefault();
    if(event.code==='Home')setLook(0,0);
    else setLook(lookYaw+(event.code==='ArrowLeft'?-.16:.16),lookPitch);
    return;
  }
  const cmd=bindings[event.code];if(!cmd||mode!=='run')return;
  event.preventDefault();
  if(!event.repeat)command(cmd);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='run')setOverlay('paused');});
// Sound of an electric train (EMU): inverter whine that rises in steps at start, motor hum, low rolling rumble
// (no hiss), the "ta-tam ta-tam" of each axle over the rail joints, an air hiss when the brake is released.
// All through one master volume; it starts with the first touch unless switched off.
let volume=.5;try{const v=Number(localStorage.getItem('giulio-volume2'));if(localStorage.getItem('giulio-volume2')!==null&&v>=0&&v<=1)volume=v;}catch{}
function buildAudio(){
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
  const ac=new Ctx(),master=ac.createGain();master.gain.value=volume;master.connect(ac.destination);
  // Inverter: two detuned tones through a narrow band-pass.
  const inv1=ac.createOscillator(),inv2=ac.createOscillator(),invFilter=ac.createBiquadFilter(),invGain=ac.createGain();
  inv1.type='sawtooth';inv2.type='triangle';invFilter.type='bandpass';invFilter.Q.value=5;invGain.gain.value=0;
  inv1.connect(invFilter);inv2.connect(invFilter);invFilter.connect(invGain);invGain.connect(master);inv1.start();inv2.start();
  // Motor hum.
  const hum=ac.createOscillator(),humGain=ac.createGain();hum.type='sine';humGain.gain.value=0;hum.connect(humGain);humGain.connect(master);hum.start();
  // Rolling: brown noise (integrated white noise) low-passed: a rumble, not a hiss.
  const len=ac.sampleRate*2,buffer=ac.createBuffer(1,len,ac.sampleRate),data=buffer.getChannelData(0);
  let last=0;for(let i=0;i<len;i++){last=(last+.02*(Math.random()*2-1))/1.02;data[i]=last*3.2;}
  const white=ac.createBuffer(1,ac.sampleRate,ac.sampleRate),wd=white.getChannelData(0);for(let i=0;i<wd.length;i++)wd[i]=Math.random()*2-1;
  const roll=ac.createBufferSource(),rollFilter=ac.createBiquadFilter(),rollGain=ac.createGain();
  roll.buffer=buffer;roll.loop=true;rollFilter.type='lowpass';rollFilter.frequency.value=160;rollGain.gain.value=0;
  roll.connect(rollFilter);rollFilter.connect(rollGain);rollGain.connect(master);roll.start();
  audio={ac,master,inv1,inv2,invFilter,invGain,hum,humGain,rollFilter,rollGain,white,joint:0,brake:0,
    // Kept for older code paths (horn, settings).
    gain:invGain};
}
async function ensureAudio(){if(!audio)buildAudio();if(audio&&audio.ac.state!=='running')await audio.ac.resume();}
function setSound(on){
  audioOn=on;$('sound').setAttribute('aria-pressed',String(on));
  try{localStorage.setItem('giulio-audio',on?'on':'off');}catch{}
  if(!on&&audio)for(const g of [audio.invGain,audio.humGain,audio.rollGain])g.gain.setTargetAtTime(0,audio.ac.currentTime,.04);
}
$('sound').onclick=async ()=>{try{if(!audioOn){await ensureAudio();if(audio)setSound(true);}else setSound(false);}catch{setSound(false);}};
const soundWanted=()=>{try{return localStorage.getItem('binottoland-sound')!=='off'&&localStorage.getItem('giulio-audio')!=='off';}catch{return true;}};
const autoSound=()=>{if(!audioOn&&soundWanted())ensureAudio().then(()=>{if(audio&&!audioOn)setSound(true);}).catch(()=>{});};
addEventListener('pointerdown',autoSound,{once:true,capture:true});addEventListener('keydown',autoSound,{once:true,capture:true});
const volumeInput=$('volume');
if(volumeInput){
  volumeInput.value=String(volume);
  volumeInput.oninput=()=>{volume=Number(volumeInput.value);try{localStorage.setItem('giulio-volume2',String(volume));}catch{}if(audio)audio.master.gain.setTargetAtTime(volume,audio.ac.currentTime,.03);};
}
// One wheel over a joint: a short low thump plus a small metallic click.
function wheelHit(at,level){
  const ac=audio.ac,o=ac.createOscillator(),g=ac.createGain();
  o.type='sine';o.frequency.setValueAtTime(95,at);o.frequency.exponentialRampToValueAtTime(55,at+.09);
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.5*level,at+.006);g.gain.exponentialRampToValueAtTime(.0001,at+.13);
  o.connect(g);g.connect(audio.master);o.start(at);o.stop(at+.15);
  const n=ac.createBufferSource(),f=ac.createBiquadFilter(),ng=ac.createGain();
  n.buffer=audio.white;f.type='bandpass';f.frequency.value=2300;f.Q.value=2;
  ng.gain.setValueAtTime(.0001,at);ng.gain.exponentialRampToValueAtTime(.09*level,at+.003);ng.gain.exponentialRampToValueAtTime(.0001,at+.035);
  n.connect(f);f.connect(ng);ng.connect(audio.master);n.start(at,Math.random()*.8,.05);
}
// The whole train over one joint: two axles per bogie, front bogie loudest (under the cab), then the others.
const AXLES=[[0,1],[2.5,.95],[15,.55],[17.5,.5],[21,.38],[23.5,.35]];
function joint(speed){
  if(!audio||speed<1)return;
  const now=audio.ac.currentTime,level=Math.min(1,.25+speed/22);
  for(const [offset,gain] of AXLES){const t=offset/speed;if(t<2.5)wheelHit(now+t,level*gain);}
}
function airHiss(){
  const ac=audio.ac,n=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain(),t=ac.currentTime;
  n.buffer=audio.white;n.loop=true;f.type='highpass';f.frequency.value=2500;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.55);
  n.connect(f);f.connect(g);g.connect(audio.master);n.start(t);n.stop(t+.6);
}function horn(){
  if(!audio||mode!=='run')return;
  const ac=audio.ac,g=ac.createGain(),start=ac.currentTime;
  g.connect(audio.master);g.gain.setValueAtTime(.0001,start);
  g.gain.linearRampToValueAtTime(.22,start+.06);
  g.gain.exponentialRampToValueAtTime(.0001,start+.58);
  for(const hz of [220,278]){
    const osc=ac.createOscillator();osc.frequency.value=hz;osc.type='triangle';osc.connect(g);osc.start(start);osc.stop(start+.6);
  }
}
let last=0,accumulator=0,hudTimer=0,lastRender=-Infinity;
const DT=1/60;
function loop(now){
  const frame=last?clamp((now-last)/1000,0,.15):0;last=now;
  if(mode==='run'){
    accumulator+=frame;
    while(accumulator>=DT&&mode==='run'){tick(DT);accumulator-=DT;}
  }else accumulator=0;
  if(now-hudTimer>=90){
    hudTimer=now;drawHUD();
    if(audio&&audioOn){
      const time=audio.ac.currentTime, speed=Math.abs(train.v);
      // Inverter: steps while starting (like a real VVVF), then a steady rise with speed.
      const stepped=speed<9?420+Math.floor(speed*1.6)*95:560+speed*16;
      const effort=mode==='run'?Math.max(train.traction/4,speed>2?train.brake/5*.6:0):0;
      audio.inv1.frequency.setTargetAtTime(stepped,time,.05);audio.inv2.frequency.setTargetAtTime(stepped*1.5,time,.05);
      audio.invFilter.frequency.setTargetAtTime(stepped*1.2,time,.08);
      audio.invGain.gain.setTargetAtTime(effort*.05,time,.12);
      audio.hum.frequency.setTargetAtTime(48+speed*6,time,.1);
      audio.humGain.gain.setTargetAtTime(mode==='run'?.02+effort*.05:0,time,.12);
      audio.rollFilter.frequency.setTargetAtTime(110+speed*7,time,.15);
      audio.rollGain.gain.setTargetAtTime(mode==='run'?Math.min(.22,speed*.012):0,time,.2);
      // Rail joints every 25 m.
      const jointIndex=Math.floor(train.s/25);
      if(mode==='run'&&jointIndex!==audio.joint)joint(speed);
      audio.joint=jointIndex;
      // Air released from the brake cylinders.
      if(mode==='run'&&train.brake<audio.brake)airHiss();
      audio.brake=train.brake;
    }
  }
  if(renderDirty||(mode==='run'&&now-lastRender>=(width<780?1000/38:1000/55))){
    const start=performance.now();
    render();renderDirty=false;lastRender=now;
    const cost=performance.now()-start;
    renderCost=renderCost?blend(renderCost,cost,.09):cost;
    if(mode==='run'&&now-qualityChanged>2400&&
      ((renderCost>25&&quality>.68)||(renderCost<11&&quality<1))){
      quality=clamp(quality+(renderCost>25?-.12:.06),.68,1);
      qualityChanged=now;resize();
    }
  }
  requestAnimationFrame(loop);
}
function saveCab(){try{localStorage.setItem('binottoland-giulio-run-v1',JSON.stringify({train,mode,weather:selectedWeather,yaw:lookYaw,pitch:lookPitch}))}catch{}}
function restoreCab(){try{const saved=JSON.parse(localStorage.getItem('binottoland-giulio-run-v1')||'null');if(!saved)return false;if(['dry','wet'].includes(saved.weather))selectedWeather=saved.weather;const t=saved.train;if(!t||Object.keys(train).some(k=>typeof train[k]==='number'&&!Number.isFinite(t[k]))||!Array.isArray(t.stopResults)||t.next<1||t.next>=stops.length||t.traction<0||t.traction>4||t.brake<0||t.brake>5)return false;train=t;setLook(Number(saved.yaw)||0,Number(saved.pitch)||0);for(const b of document.querySelectorAll('[data-weather]'))b.setAttribute('aria-pressed',String(b.dataset.weather===selectedWeather));if(['run','paused'].includes(saved.mode)){setOverlay('paused');return true}}catch{}return false}
if(!restoreCab())setOverlay('intro');
for(const event of ['click','keydown','pointerup'])document.addEventListener(event,()=>queueMicrotask(saveCab));
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveCab()});window.addEventListener('pagehide',saveCab);setInterval(()=>{if(mode==='run')saveCab()},1000);
drawHUD();
requestAnimationFrame(loop);
// Floating desk and header: their heights place the messages and the stop label (see cab.css).
for(const [selector,name] of [['.route-strip','--strip-h'],['body>header','--header-h']]){const el=document.querySelector(selector);if(el&&window.ResizeObserver)new ResizeObserver(()=>document.documentElement.style.setProperty(name,el.offsetHeight+'px')).observe(el);}
// One "Porte" button: opens on the platform side of the stop (or closes them if they are open).
$('doors').onclick=()=>{
  const t=train,stop=stops[t.docked>=0?t.docked:t.next]??stops[t.next-1];
  command(t.doors||stop?.side||'left');
};
// Levers: drag the knob. Traction (right): up = more. Brake (left): down = more.
function leverDrag(id,max,up,down,downwards){
  const el=$(id),value=()=>id==='traction-lever'?train.traction:train.brake;
  const move=event=>{
    const r=el.getBoundingClientRect();let f=clamp((r.bottom-event.clientY)/r.height,0,1);if(downwards)f=1-f;
    const want=Math.round(f*max);let guard=12;
    while(value()!==want&&guard--){const before=value();command(want>before?up:down);if(value()===before)break;}
  };
  el.addEventListener('pointerdown',event=>{
    if(mode!=='run')return;event.preventDefault();el.setPointerCapture(event.pointerId);move(event);
    el.onpointermove=move;el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null;};
  });
}
leverDrag('traction-lever',4,'powerUp','powerDown',false);
leverDrag('brake-lever',5,'brakeUp','brakeDown',true);
