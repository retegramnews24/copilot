'use strict';
const $=id=>document.getElementById(id);
let stage='door',chosen=0,origin=0,step=0,age=0,idle=0,stay=false,last=null,clock=0,sleeping=false;
function view(next){stage=next;$('world').dataset.stage=next;for(const id of ['door','choose','room','ending'])$(id).hidden=id!==stage;$('hud').hidden=stage!=='room';$('tools').hidden=stage!=='room';wake()}
function wake(){idle=0;$('world').classList.remove('quiet')}
function choose(i){chosen=i;const [name,title,color]=rooms[i];document.documentElement.style.setProperty('--tone',color);changeArt(i);$('picked').textContent=name;$('seed').textContent=title;[...$('colors').children].forEach((b,n)=>b.setAttribute('aria-pressed',n===i));paint(0)}
rooms.forEach(([name,,c],i)=>{const b=document.createElement('button');b.className='swatch';b.setAttribute('aria-label',name);b.style.setProperty('--c',c);b.onclick=()=>choose(i);$('colors').append(b)});
function threshold(){view('choose');choose(chosen);$('start').focus({preventScroll:true})}
async function playRoom(){const ok=await sound($('voice').value,chosen,Number($('volume').value));if(!ok)$('cue').textContent='Audio non disponibile'}
function enterRoom(){choose((origin+step)%rooms.length);age=0;stay=false;view('room');$('ordinal').textContent='PASSAGGIO '+String(step+1).padStart(2,'0')+' / 07 · '+rooms[chosen][0].toUpperCase();$('name').textContent=rooms[chosen][1];$('line').textContent=rooms[chosen][5];$('cue').textContent=rooms[chosen][6];$('hold').textContent='Resta qui';$('next').textContent=step===6?'Concludi →':'Prosegui →';playRoom()}
function advance(){if(stage!=='room')return;if(step===6){sound('off');view('ending');$('again').focus({preventScroll:true})}else{step++;enterRoom()}}
$('enter').onclick=()=>{threshold();askFull()};$('start').onclick=()=>{origin=chosen;step=0;enterRoom()};$('again').onclick=threshold;$('next').onclick=advance;
$('hold').onclick=()=>{stay=!stay;wake();$('hold').textContent=stay?'Riprendi':'Resta qui';$('cue').textContent=stay?'Il tempo è tuo.':rooms[chosen][6]};
$('world').addEventListener('click',e=>{if(e.target.closest('button, select, input, label'))return;if(stage==='door')threshold();else if(stage==='room')wake()});
$('world').addEventListener('focusin',wake);document.addEventListener('keydown',e=>{if(stage==='room'&&!$('settings').open&&(e.key==='Tab'||e.key==='Escape'))wake()});
$('mix').innerHTML=$('voice').innerHTML;$('tools').onclick=()=>{wake();$('mix').value=$('voice').value;$('gain').value=$('volume').value;$('still').textContent=still?'Riattiva il movimento':'Ferma il movimento';$('settings').showModal()};
$('mix').onchange=()=>{$('voice').value=$('mix').value;playRoom()};$('gain').oninput=()=>{$('volume').value=$('gain').value;setLevel(Number($('gain').value))};
$('still').onclick=()=>{still=!still;fade=5;$('still').textContent=still?'Riattiva il movimento':'Ferma il movimento';paint(0)};
$('return').onclick=()=>{sound('off');$('settings').close();threshold()};$('settings').addEventListener('close',wake);
function tick(stamp){if(document.hidden||sleeping){last=null;return}const dt=last===null?0:Math.min((stamp-last)/1000,1/3);last=stamp;
 if(!$('settings').open){if(stage==='room'){age+=stay?0:dt;idle+=dt;if(idle>=8)$('world').classList.add('quiet');if(age>=34)advance()}clock+=dt;if(clock>=1/34){if(!still||fade<5)paint(clock);clock=0}}
 frameHandle=requestAnimationFrame(tick)}
function resumeLoop(){last=null;cancelAnimationFrame(frameHandle);frameHandle=requestAnimationFrame(tick)}
let frameHandle=0;
function suspend(){sleeping=true;if(ac)ac.suspend().catch(()=>{})}
function resume(){if(document.hidden||!sleeping)return;sleeping=false;if(ac&&stage==='room'&&$('voice').value!=='off')ac.resume().catch(()=>{});resumeLoop()}
document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
function askFull(){const t=window.Telegram?.WebApp;try{if(t?.platform&&t.platform!=='unknown'&&t.isVersionAtLeast('8.0')&&!t.isFullscreen)t.requestFullscreen()}catch{}}
let linked=false;
function linkTelegram(){const t=window.Telegram?.WebApp;if(linked||!t||t.platform==='unknown')return;linked=true;
 function fit(){if(t.viewportHeight>0)document.documentElement.style.setProperty('--height',t.viewportHeight+'px');for(const side of ['top','bottom','left','right']){const n=(t.contentSafeAreaInset?.[side]||0)+(t.safeAreaInset?.[side]||0);document.documentElement.style.setProperty('--'+side,'max(env(safe-area-inset-'+side+',0px), '+n+'px)')}}
 t.ready();t.expand();for(const e of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])t.onEvent(e,fit);t.onEvent('deactivated',suspend);t.onEvent('activated',resume);fit();askFull()}
new ResizeObserver(()=>paint(0)).observe(sky);choose(0);linkTelegram();resumeLoop();
