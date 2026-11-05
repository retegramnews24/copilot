(()=>{
 const $=id=>document.getElementById(id),audio=$('radio-audio'),panel=$('radio-panel'),toggle=$('radio-toggle'),play=$('radio-play'),select=$('radio-stations'),label=$('radio-label'),status=$('radio-status'),star=$('radio-favorite'),volume=$('radio-volume');
 const hosts=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
 function readLocal(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??fallback}catch{return fallback}}
 function saveLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
 function normalize(raw){
  if(!raw||typeof raw.name!=='string'||!raw.name.trim())return null;
  const urls=[...new Set([...(Array.isArray(raw.urls)?raw.urls:[]),raw.url_resolved,raw.url].filter(x=>{try{return typeof x==='string'&&x.length<=2048&&new URL(x).protocol==='https:'}catch{return false}}))];
  return urls.length?{id:String(raw.id||raw.stationuuid||urls[0]),name:raw.name.trim().slice(0,80),urls}:null;
 }
 const stored=readLocal('binottoland-radio-favorites',[]);
 let favorites=(Array.isArray(stored)?stored:[]).map(normalize).filter(Boolean),stations=[],current=normalize(readLocal('binottoland-radio-last',null));
 let loaded=false,loading=false,streamIndex=0,attempt=0,watchdog,wantsPlay=false,pending=false,playbackMessage='',directoryMessage='';
 const saved=Number(readLocal('binottoland-radio-volume',.7));audio.volume=Number.isFinite(saved)?Math.min(1,Math.max(0,saved)):.7;volume.value=String(audio.volume);
 let track='',metadataEpoch=0,metadataTimer=null,metadataPending=false;
 const trackBox=$('radio-now-playing'),trackLabel=$('radio-track');
 function showTrack(title){
  track=typeof title==='string'?title.trim().slice(0,240):'';trackLabel.textContent=track;
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
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMetadata(false);else if(wantsPlay)loadMetadata()});
 const allowed=()=>!$('app-shell').hidden;
 function update(){
  label.textContent=current?current.name:'Radio';
  const favorite=!!current&&favorites.some(s=>s.id===current.id);star.textContent=favorite?'★':'☆';star.setAttribute('aria-pressed',String(favorite));star.setAttribute('aria-label',favorite?'Rimuovi dai preferiti':'Aggiungi ai preferiti');star.disabled=!current;
  play.textContent=wantsPlay?'Ⅱ':'▶';play.setAttribute('aria-label',wantsPlay?'Pausa radio':'Avvia radio');play.setAttribute('aria-pressed',String(wantsPlay));play.setAttribute('aria-busy',String(pending));
  status.textContent=playbackMessage||directoryMessage;trackBox.hidden=!track||!wantsPlay;
  if('mediaSession' in navigator){try{navigator.mediaSession.playbackState=wantsPlay&&!pending?'playing':current?'paused':'none'}catch{}}
 }
 function render(){
  select.replaceChildren();
  const all=[...favorites,...stations.filter(st=>!favorites.some(f=>f.id===st.id))];
  if(!all.length){const option=document.createElement('option');option.textContent=loading?'Caricamento radio…':'Nessuna radio caricata';option.value='';select.append(option)}
  for(const station of all){const option=document.createElement('option');option.value=station.id;option.textContent=(favorites.some(f=>f.id===station.id)?'★ ':'')+station.name;select.append(option)}
  if(!current&&all.length){current=all[0];saveLocal('binottoland-radio-last',current)}
  if(current&&!all.some(s=>s.id===current.id)){const option=document.createElement('option');option.value=current.id;option.textContent=current.name;select.prepend(option)}
  if(current)select.value=current.id;
  select.disabled=!current&&!all.length;update();
 }
 async function loadStations(){
  if(loading||!allowed())return;loading=true;directoryMessage='Caricamento radio…';$('radio-reload').disabled=true;render();
  try{
   for(const host of hosts){
    try{
     const response=await fetch(host+'/json/stations/search?countrycode=IT&hidebroken=true&order=clickcount&reverse=true&limit=200',{signal:AbortSignal.timeout(8000)});
     if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data))throw Error();
     const unique=new Map();for(const raw of data){const station=normalize(raw);if(station&&!unique.has(station.id))unique.set(station.id,station)}
     if(!unique.size)throw Error();stations=[...unique.values()];loaded=true;directoryMessage='';return;
    }catch{}
   }
   directoryMessage='Elenco non raggiungibile. Riprova.';
  }finally{loading=false;$('radio-reload').disabled=false;render()}
 }
 function stop(message='Radio in pausa.'){
  stopMetadata();wantsPlay=false;pending=false;attempt++;clearTimeout(watchdog);audio.pause();playbackMessage=message;update();
 }
 function nextStream(serial=attempt){
  if(serial!==attempt||!wantsPlay)return;clearTimeout(watchdog);
  if(current&&streamIndex+1<current.urls.length){streamIndex++;startStream();return}
  stop('Radio non raggiungibile. Scegli un’altra stazione.');
 }
 function armWatchdog(serial){
  clearTimeout(watchdog);watchdog=setTimeout(()=>{if(serial===attempt&&wantsPlay&&pending)nextStream(serial)},12000);
 }
 async function startStream(){
  if(!current||!allowed())return;
  stopMetadata();const serial=++attempt;clearTimeout(watchdog);wantsPlay=true;pending=true;audio.pause();audio.src=current.urls[streamIndex];audio.load();playbackMessage='Connessione…';update();armWatchdog(serial);
  if('mediaSession' in navigator&&window.MediaMetadata){try{navigator.mediaSession.metadata=new MediaMetadata({title:current.name,artist:'Binottoland · Radio'})}catch{}}
  try{await audio.play();if(serial!==attempt)return;update()}
  catch(error){if(serial!==attempt||!wantsPlay)return;if(error.name==='NotAllowedError')stop('Tocca Play per avviare la radio.');else nextStream(serial)}
 }
 function resume(){if(!allowed()||!current)return;streamIndex=0;startStream()}
 toggle.onclick=()=>{if(!allowed())return;panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden&&!loaded)loadStations()};
 play.onclick=()=>{
  if(!allowed())return;
  if(wantsPlay){stop();return}
  if(!current){panel.hidden=false;toggle.setAttribute('aria-expanded','true');loadStations();return}
  resume();
 };
 select.onchange=()=>{
  const selected=[...favorites,...stations,current].find(st=>st&&st.id===select.value);if(!selected)return;
  current=selected;saveLocal('binottoland-radio-last',current);streamIndex=0;startStream();
 };
 star.onclick=()=>{if(!allowed()||!current)return;const found=favorites.some(s=>s.id===current.id);favorites=found?favorites.filter(s=>s.id!==current.id):[...favorites,current];saveLocal('binottoland-radio-favorites',favorites);render()};
 volume.oninput=()=>{const value=Number(volume.value);if(!Number.isFinite(value))return;audio.volume=Math.min(1,Math.max(0,value));saveLocal('binottoland-radio-volume',audio.volume)};
 $('radio-reload').onclick=loadStations;
 audio.addEventListener('playing',()=>{if(!wantsPlay){audio.pause();return}pending=false;clearTimeout(watchdog);playbackMessage='In ascolto · '+current.name;update();if(!metadataTimer&&!metadataPending)loadMetadata()});
 audio.addEventListener('pause',()=>{if(!pending&&wantsPlay){wantsPlay=false;stopMetadata();playbackMessage='Radio in pausa.';clearTimeout(watchdog)}update()});
 const buffering=()=>{if(!wantsPlay)return;pending=true;playbackMessage='Buffering…';update();armWatchdog(attempt)};
 audio.addEventListener('waiting',buffering);audio.addEventListener('stalled',buffering);
 audio.addEventListener('error',()=>{if(audio.getAttribute('src')&&wantsPlay)nextStream()});
 audio.addEventListener('ended',()=>{if(wantsPlay)nextStream()});
 if('mediaSession' in navigator){try{navigator.mediaSession.setActionHandler('play',resume);navigator.mediaSession.setActionHandler('pause',()=>stop());navigator.mediaSession.setActionHandler('stop',()=>stop())}catch{}}
 render();
})();

