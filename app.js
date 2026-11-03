'use strict';
const F=Object.freeze([1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597]);
const R=F[10]/F[9], GOLD=2*Math.PI/(R*R), $=id=>document.getElementById(id);
const chakras=[
 ['Radice','Muladhara','Abita questo istante.','#ff765e','255,118,94',144],
 ['Sacrale','Svadhisthana','Lascia scorrere ciò che senti.','#ffb36a','255,179,106',233],
 ['Plesso solare','Manipura','Accogli la tua luce.','#f6d77c','246,215,124',377],
 ['Cuore','Anahata','Fai spazio alla gentilezza.','#8cdbb1','140,219,177',610],
 ['Gola','Vishuddha','Ascolta il tuo silenzio.','#80cee6','128,206,230',987],
 ['Terzo occhio','Ajna','Osserva, senza inseguire.','#a49bef','164,155,239',1597],
 ['Corona','Sahasrara','Rimani nella meraviglia.','#d5a8ec','213,168,236',2584]
];
let selected=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,immersed=false,audio=null,bus=null,voices=[],playing=false,deadline=0,elapsed=0,last=0,lastDraw=0;
let saved={};try{saved=JSON.parse(localStorage.getItem('fiora')||'{}')}catch{}
for(const key of ['sound','geometry','volume'])if(saved[key]!=null)$(key).value=saved[key];
function persist(){try{localStorage.setItem('fiora',JSON.stringify({selected,sound:$('sound').value,geometry:$('geometry').value,volume:$('volume').value}))}catch{}}
function select(i){selected=i;const c=chakras[i];document.documentElement.style.setProperty('--accent',c[3]);document.documentElement.style.setProperty('--rgb',c[4]);$('chakraName').textContent=c[0];$('sanskrit').textContent=c[1].toUpperCase();$('intention').textContent=c[2];$('ordinal').textContent=`0${i+1} / 07`;document.querySelectorAll('.chakra').forEach((b,n)=>b.setAttribute('aria-pressed',n===i));if(playing)buildSound();persist();draw(elapsed)}
chakras.forEach((c,i)=>{const b=document.createElement('button');b.className='chakra';b.style.setProperty('--c',c[3]);b.innerHTML=`<span class="dot"></span>${c[0]}<small>${c[1]}</small>`;b.onclick=()=>select(i);$('chakras').appendChild(b)});
const canvas=$('art'),ctx=canvas.getContext('2d',{alpha:false});let W=0,H=0,dpr=1;
function resize(){dpr=Math.min(devicePixelRatio||1,R);W=innerWidth;H=innerHeight;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw(elapsed)}
function draw(t){if(!W||!H)return;const c=chakras[selected];ctx.fillStyle='#090b12';ctx.fillRect(0,0,W,H);const mobile=W<=610;let x=immersed?W/2:(mobile?W/2:W*F[4]/F[5]),y=immersed?H/2:(mobile?Math.min(H*F[3]/F[4],610):Math.min(H*F[3]/F[5],377));
const size=Math.min(W,H)*F[3]/F[5],pulse=1+Math.sin(t/F[5])*F[1]/F[10];let g=ctx.createRadialGradient(x,y,0,x,y,size*R);g.addColorStop(0,`rgba(${c[4]},.13)`);g.addColorStop(1,'#090b12');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(x,y);ctx.scale(pulse,pulse);ctx.strokeStyle=c[3];ctx.fillStyle=c[3];ctx.lineWidth=F[0];
const mode=$('geometry').value;
if(mode==='tree'){
 function branch(len,depth){if(depth===0)return;ctx.globalAlpha=depth/F[5];ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-len);ctx.stroke();ctx.translate(0,-len);const angle=GOLD/F[4]+Math.sin(t/F[8])*F[1]/F[9];for(const sign of [-1,1]){ctx.save();ctx.rotate(sign*angle);branch(len/R,depth-1);ctx.restore()}}
 for(let j=0;j<F[4];j++){ctx.save();ctx.rotate(j*2*Math.PI/F[4]+t/F[10]);branch(size/F[3],F[5]);ctx.restore()}
}else if(mode==='spiral'){
 for(let j=0;j<F[5];j++){ctx.beginPath();for(let n=0;n<F[13];n++){let a=n/F[9]+j*GOLD+t/F[9],r=size*Math.pow(R,(n-F[13])/F[9]);let px=Math.cos(a)*r,py=Math.sin(a)*r;n?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.globalAlpha=F[1]/F[5];ctx.stroke()}
}else{
 // Recursive rosettes: each child shrinks by 55/89; branch count = 5.
 function bloom(radius,depth){ctx.globalAlpha=depth/F[8];ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();if(depth<=1)return;for(let j=0;j<F[4];j++){let a=j*GOLD+t/F[10]*(depth%2?1:-1);ctx.save();ctx.translate(Math.cos(a)*radius/R,Math.sin(a)*radius/R);bloom(radius/(R*R),depth-1);ctx.restore()}}
 ctx.rotate(t/F[10]);bloom(size,F[4]);
}
// Phyllotactic seeds; angular increment derives from 89/55.
for(let n=1;n<=F[12];n++){let a=n*GOLD+t/F[10],r=size*Math.sqrt(n/F[12]);ctx.globalAlpha=(F[1]/F[5])*(1-n/F[13]);ctx.beginPath();ctx.arc(Math.cos(a)*r,Math.sin(a)*r,F[n%F[4]]/F[3],0,Math.PI*2);ctx.fill()}ctx.restore()}
function frame(now){if(last)elapsed+=Math.min((now-last)/1000,F[0])*(paused||document.hidden?0:1);last=now;if(now-lastDraw>=1000/F[8]&&!document.hidden){draw(elapsed);lastDraw=now}const phase=elapsed%F[6],inhale=phase<F[4];$('breath').textContent=`${inhale?'Inspira':'Espira'} · ${Math.ceil(inhale?F[4]-phase:F[6]-phase)}`;requestAnimationFrame(frame)}
function stopVoices(){if(!audio)return;const old=voices;voices=[];for(const v of old){v.gain.gain.cancelScheduledValues(audio.currentTime);v.gain.gain.setTargetAtTime(0,audio.currentTime,F[1]/F[6]);for(const source of v.sources)try{source.stop(audio.currentTime+F[1])}catch{}}}
function buildSound(){stopVoices();const gain=audio.createGain();gain.gain.value=0;gain.connect(bus);gain.gain.setTargetAtTime(1,audio.currentTime,F[1]/F[4]);const sources=[],base=chakras[selected][5];
 if($('sound').value==='tone')for(let i=0;i<F[3];i++){const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.value=base*(F[i+4]/F[i+3])/F[3];v.gain.value=F[1]/F[i+5];o.connect(v);v.connect(gain);o.start();sources.push(o)}
 else {const buffer=audio.createBuffer(1,audio.sampleRate*F[4],audio.sampleRate),data=buffer.getChannelData(0);let smooth=0;for(let i=0;i<data.length;i++){smooth=(smooth+(Math.random()*2-1)/F[5])/(1+1/F[5]);data[i]=smooth}const source=audio.createBufferSource(),filter=audio.createBiquadFilter();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=$('sound').value==='water'?base*R:F[12];source.connect(filter);filter.connect(gain);source.start();sources.push(source)}voices.push({gain,sources})}
async function toggleAudio(){try{if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error();audio=new AC();bus=audio.createGain();bus.connect(audio.destination)}await audio.resume();playing=!playing;if(playing){bus.gain.setTargetAtTime(Number($('volume').value)/F[11],audio.currentTime,F[1]/F[5]);buildSound()}else stopVoices();$('play').innerHTML=playing?'Ⅱ <span>Silenzia suono</span>':'▷ <span>Attiva suono</span>';$('play').setAttribute('aria-pressed',String(playing))}catch{$('session').textContent='Audio non disponibile: prova ad aprire in Telegram o in un browser recente.'}}
$('play').onclick=toggleAudio;$('sound').onchange=()=>{if(playing)buildSound();persist()};$('volume').oninput=()=>{if(bus)bus.gain.setTargetAtTime(Number($('volume').value)/F[11],audio.currentTime,F[1]/F[5]);persist()};$('geometry').onchange=()=>{draw(elapsed);persist()};
function syncMotion(){$('motion').textContent=paused?'▷':'Ⅱ';$('motion').setAttribute('aria-pressed',String(paused));$('motion').setAttribute('aria-label',paused?'Riprendi animazione':'Metti in pausa animazione')}$('motion').onclick=()=>{paused=!paused;syncMotion()};syncMotion();
function immerse(value){immersed=value;document.body.classList.toggle('immersed',value);$('restore').hidden=!value;draw(elapsed)}$('immerse').onclick=()=>{immerse(true);fullscreen()};$('restore').onclick=()=>immerse(false);document.addEventListener('keydown',e=>{if(e.key==='Escape')immerse(false)});
$('about').onclick=()=>$('info').showModal();$('closeInfo').onclick=()=>$('info').close();
$('timer').onchange=()=>{deadline=Number($('timer').value)?Date.now()+Number($('timer').value)*60*1000:0;updateTimer()};function updateTimer(){if(deadline){const seconds=Math.ceil((deadline-Date.now())/1000);if(seconds<=0){deadline=0;if(playing)toggleAudio();paused=true;syncMotion();$('session').textContent='Sessione conclusa. Porta con te questa quiete.';$('timer').value='0'}else $('session').textContent=`Tempo per te · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}else if($('timer').value==='0'&&!$('session').textContent.startsWith('Sessione'))$('session').textContent='Il tuo spazio, senza fretta.'}setInterval(updateTimer,1000);
document.addEventListener('visibilitychange',()=>{last=0;if(audio){if(document.hidden)audio.suspend();else if(playing){updateTimer();if(playing)audio.resume().catch(()=>{})}}});
const tg=window.Telegram?.WebApp;function safe(){if(!tg)return;for(const side of ['top','bottom','left','right']){const v=Math.max(tg.safeAreaInset?.[side]||0,tg.contentSafeAreaInset?.[side]||0);document.documentElement.style.setProperty(`--safe-${side}`,v+'px')}}function fullscreen(){try{if(tg?.isVersionAtLeast?.('8.0')&&!tg.isFullscreen)tg.requestFullscreen()}catch{}}
if(tg){try{tg.ready();tg.expand();tg.setHeaderColor('#090b12');tg.setBackgroundColor('#090b12');if(tg.isVersionAtLeast?.('7.7'))tg.disableVerticalSwipes();tg.onEvent('safeAreaChanged',safe);tg.onEvent('contentSafeAreaChanged',safe);tg.onEvent('viewportChanged',safe);safe();fullscreen()}catch{}}
addEventListener('resize',resize);select(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<chakras.length?saved.selected:0);resize();requestAnimationFrame(frame);
