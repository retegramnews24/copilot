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
  $('progress').value=clamp(t.s,0,TERMINUS);$('clock').textContent=clock(t.elapsed);
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
    $('brief-kicker').textContent='Linea dei Due Laghi · 8,42 km';$('brief-title').textContent='Giulio Simulator';
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
  $('exit').onclick=()=>parent.postMessage({type:'arcade:exit'},location.origin);
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
$('sound').onclick=async ()=>{
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    if(!audio){
      const ac=new Audio(),osc=ac.createOscillator(),gain=ac.createGain(),filter=ac.createBiquadFilter();
      osc.type='triangle';gain.gain.value=0;filter.type='lowpass';filter.frequency.value=210;
      osc.connect(filter);filter.connect(gain);gain.connect(ac.destination);osc.start();
      const rollNoise=ac.createBufferSource(), rollGain=ac.createGain(), rollFilter=ac.createBiquadFilter();
      const buffer=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);
      const samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      rollNoise.buffer=buffer;rollNoise.loop=true;rollFilter.type='lowpass';rollGain.gain.value=0;
      rollNoise.connect(rollFilter);rollFilter.connect(rollGain);rollGain.connect(ac.destination);rollNoise.start();
      audio={ac,osc,gain,filter,rollGain,rollFilter};
    }
    if(!audioOn)await audio.ac.resume();
    audioOn=!audioOn;$('sound').setAttribute('aria-pressed',String(audioOn));
    if(!audioOn){
      audio.gain.gain.setTargetAtTime(0,audio.ac.currentTime,.04);
      audio.rollGain.gain.setTargetAtTime(0,audio.ac.currentTime,.04);
    }
  }catch{audioOn=false;}
};
function horn(){
  if(!audio||mode!=='run')return;
  const ac=audio.ac,g=ac.createGain(),start=ac.currentTime;
  g.connect(ac.destination);g.gain.setValueAtTime(.0001,start);
  g.gain.linearRampToValueAtTime(.035,start+.06);
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
      audio.osc.frequency.setTargetAtTime(34+speed*3.1+train.traction*6,time,.08);
      audio.filter.frequency.setTargetAtTime(120+speed*8,time,.1);
      audio.gain.gain.setTargetAtTime(mode==='run'?train.traction*.004:0,time,.1);
      audio.rollGain.gain.setTargetAtTime(mode==='run'?Math.min(.035,speed*.0014):0,time,.13);
      audio.rollFilter.frequency.setTargetAtTime(75+speed*14,time,.1);
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
setOverlay('intro');
drawHUD();
requestAnimationFrame(loop);
