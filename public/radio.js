(()=>{
 const $=id=>document.getElementById(id),plain=$('radio-audio'),screen=$('radio-panel'),toggle=$('radio-toggle'),play=$('radio-play'),bigPlay=$('radio-play-big'),label=$('radio-label'),status=$('radio-status'),star=$('radio-favorite'),volume=$('radio-volume'),list=$('radio-list'),search=$('radio-search'),more=$('radio-more');
 // Second player for stations that allow analysis (CORS): its sound goes through Web Audio, so the
 // equaliser follows the music. Other stations keep the plain player: routing them would mute them.
 const fx=document.createElement('audio');fx.preload='none';fx.setAttribute('playsinline','');fx.crossOrigin='anonymous';plain.after(fx);
 let audio=plain,ctx=null,analyser=null,bins=null,bands=[],fxFailed=new Set();
 const CENTERS=[31,63,125,250,500,1000,2000,4000,8000,16000];
 // Music has less energy up high: lift the treble so all ten bands move.
 const WEIGHT=[.95,1,1,1,1.05,1.12,1.25,1.4,1.6,1.9];
 const hosts=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
 function readLocal(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??fallback}catch{return fallback}}
 function saveLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
 function normalize(raw){
  if(!raw||typeof raw.name!=='string'||!raw.name.trim())return null;
  const urls=[...new Set([...(Array.isArray(raw.urls)?raw.urls:[]),raw.url_resolved,raw.url].filter(x=>{try{return typeof x==='string'&&x.length<=2048&&new URL(x).protocol==='https:'}catch{return false}}))];
  if(!urls.length)return null;
  const tags=(typeof raw.tags==='string'?raw.tags.split(','):Array.isArray(raw.tags)?raw.tags:[]).map(t=>String(t).trim()).filter(Boolean).slice(0,3);
  return {id:String(raw.id||raw.stationuuid||urls[0]),name:raw.name.trim().slice(0,80),urls,country:String(raw.country||raw.countrycode||'').slice(0,40),tags};
 }
 const stored=readLocal('binottoland-radio-favorites',[]);
 let favorites=(Array.isArray(stored)?stored:[]).map(normalize).filter(Boolean),current=normalize(readLocal('binottoland-radio-last',null));
 // Lists: Italy and world loaded on demand; search results replace the list while the field has text.
 const lists={it:[],world:[]},loadedList={it:false,world:false};
 let tab=readLocal('binottoland-radio-tab',favorites.length?'fav':'it'),results=null,shown=60,searchTimer=null,searchSerial=0;
 let loading=false,streamIndex=0,attempt=0,watchdog,wantsPlay=false,pending=false,playbackMessage='',directoryMessage='';
 const saved=Number(readLocal('binottoland-radio-volume',.7)),startVolume=Number.isFinite(saved)?Math.min(1,Math.max(0,saved)):.7;
 plain.volume=fx.volume=startVolume;volume.value=String(startVolume);
 let track='',metadataEpoch=0,metadataTimer=null,metadataPending=false;
 const trackBox=$('radio-now-playing'),trackLabel=$('radio-track'),nowName=$('radio-now-name'),nowTrack=$('radio-now-track');
 function showTrack(title){
  track=typeof title==='string'?title.trim().slice(0,240):'';trackLabel.textContent=track;nowTrack.textContent=track;
  trackBox.hidden=!track||!wantsPlay;
  trackBox.classList.toggle('scrolling',!!track);
  trackBox.style.setProperty('--track-duration',Math.max(18,Math.min(45,track.length*.32))+'s');
 }
 function stopMetadata(clear=true){metadataEpoch++;clearTimeout(metadataTimer);metadataTimer=null;metadataPending=false;if(clear)showTrack('')}
 async function loadMetadata(){
  clearTimeout(metadataTimer);metadataTimer=null;
  if(!wantsPlay||document.hidden||!allowed()||!current||metadataPending||typeof window.binottolandRadioMetadata!=='function')return;
  const epoch=metadataEpoch,station=current.id;metadataPending=true;
  try{const data=await window.binottolandRadioMetadata(station);if(epoch===metadataEpoch&&current?.id===station&&wantsPlay)showTrack(data.title)}catch{if(epoch===metadataEpoch)showTrack('')}
  finally{if(epoch===metadataEpoch){metadataPending=false;if(wantsPlay&&!document.hidden)metadataTimer=setTimeout(loadMetadata,60000)}}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMetadata(false);else if(wantsPlay){loadMetadata();startViz()}});
 const allowed=()=>!$('app-shell').hidden;

 // Equaliser: 10 octave bands (bass left, treble right) in the character's shirt and shorts colours.
 const vizzes=[...document.querySelectorAll('.radio-viz')],bars=vizzes.map(v=>[...v.children]);
 function applyColors(){
  const outfit=readLocal('labyrinth-appearance',null),hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:null;
  for(const v of vizzes){v.style.setProperty('--viz-a',hex(outfit?.shirt)||'#66b8cf');v.style.setProperty('--viz-b',hex(outfit?.shorts)||'#3c62a3')}
 }
 applyColors();addEventListener('storage',applyColors);
 let frame=0,tick=0;
 const setBars=values=>{for(const set of bars)set.forEach((bar,i)=>bar.style.transform=`scaleY(${values[i]})`)};
 function drawViz(){
  frame=0;if(!vizzes.length)return;
  if(++tick%60===0)applyColors();
  const live=wantsPlay&&!pending&&!document.hidden;
  if(live&&audio===fx&&analyser){
   analyser.getByteFrequencyData(bins);
   setBars(bands.map(([a,b],i)=>{let sum=0;for(let k=a;k<=b;k++)sum+=bins[k];const v=(sum/(b-a+1))/255*WEIGHT[i];return Math.max(.06,Math.min(1,v*v*1.15)).toFixed(3)}));
   for(const v of vizzes)v.dataset.mode='live';
  }else if(live){
   const t=performance.now()/1000;
   setBars(CENTERS.map((_,i)=>Math.max(.1,Math.min(1,.35+.3*Math.sin(t*(3.1+i*.37)+i)+.25*Math.sin(t*(5.3+i*.21)+i*1.7))).toFixed(3)));
   for(const v of vizzes)v.dataset.mode='beat';
  }else{setBars(CENTERS.map(()=>.15));for(const v of vizzes)v.dataset.mode='';return}
  frame=requestAnimationFrame(drawViz);
 }
 function startViz(){applyColors();if(!frame)frame=requestAnimationFrame(drawViz)}
 window.binottolandRadioLevels=()=>audio===fx&&analyser?(analyser.getByteFrequencyData(bins),[...bins]):null;
 function ensureGraph(){
  if(ctx)return true;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  try{
   ctx=new AC();const source=ctx.createMediaElementSource(fx);analyser=ctx.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.78;
   source.connect(analyser);analyser.connect(ctx.destination);bins=new Uint8Array(analyser.frequencyBinCount);
   const hz=ctx.sampleRate/analyser.fftSize;
   bands=CENTERS.map(c=>{const a=Math.max(1,Math.floor(c/Math.SQRT2/hz)),b=Math.min(bins.length-1,Math.max(a,Math.ceil(c*Math.SQRT2/hz)));return [a,b]});
   return true;
  }catch{ctx=null;analyser=null;return false}
 }

 // Full-screen radio: search, tabs, station list with favourites. No pop-ups.
 const isFav=station=>!!station&&favorites.some(s=>s.id===station.id);
 function toggleFav(station){
  if(!station)return;favorites=isFav(station)?favorites.filter(s=>s.id!==station.id):[...favorites,station];
  saveLocal('binottoland-radio-favorites',favorites);renderList();update();
 }
 function stationsInView(){
  if(results)return results;
  return tab==='fav'?favorites:lists[tab];
 }
 function renderList(){
  for(const b of document.querySelectorAll('[data-radio-tab]')){const on=!results&&b.dataset.radioTab===tab;b.setAttribute('aria-selected',String(on));b.classList.toggle('active',on)}
  const all=stationsInView(),page=all.slice(0,shown);
  list.replaceChildren(...page.map(station=>{
   const row=document.createElement('div');row.className='radio-row'+(current?.id===station.id?' playing':'');row.setAttribute('role','listitem');
   const pick=document.createElement('button');pick.type='button';pick.className='radio-pick';
   const name=document.createElement('strong');name.textContent=station.name;
   const info=document.createElement('small');info.textContent=[station.country,...(station.tags||[])].filter(Boolean).join(' · ')||'Radio';
   pick.append(name,info);pick.onclick=()=>{current=station;saveLocal('binottoland-radio-last',current);streamIndex=0;startStream();renderList()};
   const fav=document.createElement('button');fav.type='button';fav.className='radio-star';fav.textContent=isFav(station)?'★':'☆';fav.setAttribute('aria-label',(isFav(station)?'Rimuovi dai':'Aggiungi ai')+' preferiti: '+station.name);fav.onclick=()=>toggleFav(station);
   row.append(pick,fav);return row;
  }));
  more.hidden=all.length<=shown;
  if(!all.length&&!loading){const p=document.createElement('p');p.className='hint';p.textContent=results?'Nessuna radio trovata.':tab==='fav'?'Nessun preferito: tocca ☆ accanto a una radio.':'Elenco vuoto: tocca Aggiorna elenco.';list.append(p)}
 }
 async function query(path){
  for(const host of hosts){
   try{
    const r=await fetch(host+path,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();
    const data=await r.json();if(!Array.isArray(data))throw Error();
    const unique=new Map();for(const raw of data){const s=normalize(raw);if(s&&!unique.has(s.id))unique.set(s.id,s)}
    return [...unique.values()];
   }catch{}
  }
  throw Error('Elenco non raggiungibile.');
 }
 const QUERY={it:'/json/stations/search?countrycode=IT&hidebroken=true&order=clickcount&reverse=true&limit=500',world:'/json/stations/search?hidebroken=true&order=clickcount&reverse=true&limit=300'};
 async function loadList(which,force=false){
  if(which==='fav'||(loadedList[which]&&!force)||loading||!allowed())return;
  loading=true;directoryMessage='Caricamento radio…';update();renderList();
  try{lists[which]=await query(QUERY[which]);loadedList[which]=true;directoryMessage=''}
  catch(e){directoryMessage=e.message+' Riprova.'}
  finally{loading=false;update();renderList()}
 }
 async function runSearch(text){
  const serial=++searchSerial,q=text.trim();
  if(q.length<2){results=null;directoryMessage='';shown=60;update();renderList();return}
  directoryMessage='Ricerca…';update();
  const enc=encodeURIComponent(q);
  try{
   const [byName,byTag]=await Promise.all([
    query(`/json/stations/search?name=${enc}&hidebroken=true&order=clickcount&reverse=true&limit=150`).catch(()=>[]),
    query(`/json/stations/search?tag=${enc}&hidebroken=true&order=clickcount&reverse=true&limit=150`).catch(()=>[])
   ]);
   if(serial!==searchSerial)return;
   const merged=new Map();for(const s of [...byName,...byTag])if(!merged.has(s.id))merged.set(s.id,s);
   results=[...merged.values()];shown=60;directoryMessage=results.length?results.length+' radio trovate':'';
  }catch{if(serial===searchSerial)directoryMessage='Ricerca non riuscita. Riprova.'}
  if(serial===searchSerial){update();renderList()}
 }
 search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(search.value),400)};
 search.onkeydown=e=>{if(e.key==='Enter'){clearTimeout(searchTimer);runSearch(search.value);search.blur()}};
 for(const b of document.querySelectorAll('[data-radio-tab]'))b.onclick=()=>{tab=b.dataset.radioTab;saveLocal('binottoland-radio-tab',tab);search.value='';results=null;shown=60;directoryMessage='';renderList();update();loadList(tab)};
 more.onclick=()=>{shown+=60;renderList()};
 $('radio-reload').onclick=()=>{if(results)runSearch(search.value);else loadList(tab,true)};
 function openScreen(){if(!allowed())return;screen.hidden=false;toggle.setAttribute('aria-expanded','true');document.documentElement.classList.add('radio-open');renderList();loadList(tab)}
 function closeScreen(){screen.hidden=true;toggle.setAttribute('aria-expanded','false');document.documentElement.classList.remove('radio-open')}
 toggle.onclick=()=>screen.hidden?openScreen():closeScreen();
 $('radio-close').onclick=closeScreen;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!screen.hidden)closeScreen()});

 function update(){
  label.textContent=current?current.name:'Radio';nowName.textContent=current?current.name:'Scegli una radio';
  const favorite=isFav(current);star.textContent=favorite?'★':'☆';star.setAttribute('aria-pressed',String(favorite));star.setAttribute('aria-label',favorite?'Rimuovi dai preferiti':'Aggiungi ai preferiti');star.disabled=!current;
  for(const b of [play,bigPlay]){b.textContent=wantsPlay?'Ⅱ':'▶';b.setAttribute('aria-label',wantsPlay?'Pausa radio':'Avvia radio');b.setAttribute('aria-pressed',String(wantsPlay));b.setAttribute('aria-busy',String(pending))}
  status.textContent=playbackMessage||directoryMessage;trackBox.hidden=!track||!wantsPlay;
  document.documentElement.classList.toggle('radio-playing',wantsPlay&&!pending);
  if(wantsPlay&&!pending)startViz();else if(!frame)drawViz();
  if('mediaSession' in navigator){try{navigator.mediaSession.playbackState=wantsPlay&&!pending?'playing':current?'paused':'none'}catch{}}
 }
 function silence(el){el.pause();el.removeAttribute('src');el.load()}
 function stop(message='Radio in pausa.'){
  stopMetadata();wantsPlay=false;pending=false;attempt++;clearTimeout(watchdog);audio.pause();playbackMessage=message;update();
 }
 function nextStream(serial=attempt){
  if(serial!==attempt||!wantsPlay)return;clearTimeout(watchdog);
  // The analysable player failed (often: no CORS). Retry the same stream on the plain player first.
  const url=current?.urls[streamIndex];
  if(audio===fx&&url&&!fxFailed.has(url)){fxFailed.add(url);startStream();return}
  if(current&&streamIndex+1<current.urls.length){streamIndex++;startStream();return}
  stop('Radio non raggiungibile. Scegli un’altra stazione.');
 }
 function armWatchdog(serial){
  clearTimeout(watchdog);watchdog=setTimeout(()=>{if(serial===attempt&&wantsPlay&&pending)nextStream(serial)},12000);
 }
 async function startStream(){
  if(!current||!allowed())return;
  stopMetadata();const serial=++attempt;clearTimeout(watchdog);wantsPlay=true;pending=true;
  const url=current.urls[streamIndex],useFx=!fxFailed.has(url)&&ensureGraph();
  const next=useFx?fx:plain,other=useFx?plain:fx;
  silence(other);audio=next;
  if(useFx)ctx.resume?.().catch(()=>{});
  audio.pause();audio.src=url;audio.load();playbackMessage='Connessione…';update();armWatchdog(serial);
  if('mediaSession' in navigator&&window.MediaMetadata){try{navigator.mediaSession.metadata=new MediaMetadata({title:current.name,artist:'Binottoland · Radio'})}catch{}}
  try{await audio.play();if(serial!==attempt)return;update()}
  catch(error){if(serial!==attempt||!wantsPlay)return;if(error.name==='NotAllowedError')stop('Tocca Play per avviare la radio.');else nextStream(serial)}
 }
 function resume(){if(!allowed()||!current)return;streamIndex=0;startStream()}
 const playPause=()=>{
  if(!allowed())return;
  if(wantsPlay){stop();return}
  if(!current){openScreen();return}
  resume();
 };
 play.onclick=playPause;bigPlay.onclick=playPause;
 star.onclick=()=>{if(allowed())toggleFav(current)};
 volume.oninput=()=>{const value=Number(volume.value);if(!Number.isFinite(value))return;plain.volume=fx.volume=Math.min(1,Math.max(0,value));saveLocal('binottoland-radio-volume',plain.volume)};
 // Events from the player that is not in use are ignored.
 for(const el of [plain,fx]){
  const mine=fn=>event=>{if(event.target===audio)fn(event)};
  el.addEventListener('playing',mine(()=>{if(!wantsPlay){audio.pause();return}pending=false;clearTimeout(watchdog);playbackMessage='In ascolto · '+current.name;update();renderList();if(!metadataTimer&&!metadataPending)loadMetadata()}));
  el.addEventListener('pause',mine(()=>{if(!pending&&wantsPlay){wantsPlay=false;stopMetadata();playbackMessage='Radio in pausa.';clearTimeout(watchdog)}update()}));
  const buffering=mine(()=>{if(!wantsPlay)return;pending=true;playbackMessage='Buffering…';update();armWatchdog(attempt)});
  el.addEventListener('waiting',buffering);el.addEventListener('stalled',buffering);
  el.addEventListener('error',mine(()=>{if(audio.getAttribute('src')&&wantsPlay)nextStream()}));
  el.addEventListener('ended',mine(()=>{if(wantsPlay)nextStream()}));
 }
 if('mediaSession' in navigator){try{navigator.mediaSession.setActionHandler('play',resume);navigator.mediaSession.setActionHandler('pause',()=>stop());navigator.mediaSession.setActionHandler('stop',()=>stop())}catch{}}
 update();renderList();
})();
