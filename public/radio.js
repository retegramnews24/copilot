(()=>{
 const audio=document.getElementById('radio-audio'),panel=document.getElementById('radio-panel'),toggle=document.getElementById('radio-toggle'),play=document.getElementById('radio-play'),select=document.getElementById('radio-stations'),label=document.getElementById('radio-label'),status=document.getElementById('radio-status'),star=document.getElementById('radio-favorite'),volume=document.getElementById('radio-volume');
 const hosts=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
 function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
 function saveLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
 function normalize(raw){
  if(!raw||typeof raw.name!=='string')return null;
  const urls=[...new Set([...(raw.urls||[]),raw.url_resolved,raw.url].filter(x=>typeof x==='string'&&x.startsWith('https://')))];
  return urls.length?{id:raw.id||raw.stationuuid||urls[0],name:raw.name.trim().slice(0,80),urls}:null;
 }
 let favorites=readLocal('binottoland-radio-favorites',[]).map(normalize).filter(Boolean),stations=[],current=normalize(readLocal('binottoland-radio-last',null)),loaded=false,loading=false,streamIndex=0,attempt=0,watchdog;
 const saved=Number(readLocal('binottoland-radio-volume',.7));audio.volume=Number.isFinite(saved)?Math.min(1,Math.max(0,saved)):.7;volume.value=String(audio.volume);
 function allowed(){return !document.getElementById('app-shell').hidden}
 function update(){
  label.textContent=current?current.name:'Radio';star.textContent=current&&favorites.some(s=>s.id===current.id)?'★':'☆';star.setAttribute('aria-pressed',String(star.textContent==='★'));
  play.textContent=audio.paused?'▶':'Ⅱ';play.setAttribute('aria-label',audio.paused?'Avvia radio':'Pausa radio');
 }
 function render(){
  select.replaceChildren();
  const all=[...favorites,...stations.filter(st=>!favorites.some(f=>f.id===st.id))];
  if(!all.length){const option=document.createElement('option');option.textContent=loading?'Caricamento radio…':'Nessuna radio caricata';option.value='';select.append(option)}
  for(const station of all){const option=document.createElement('option');option.value=station.id;option.textContent=(favorites.some(f=>f.id===station.id)?'★ ':'')+station.name;select.append(option)}
  if(!current&&all.length)current=all[0];
  if(current&&!all.some(s=>s.id===current.id)){const option=document.createElement('option');option.value=current.id;option.textContent=current.name;select.prepend(option)}
  if(current)select.value=current.id;update();
 }
 async function loadStations(){
  if(loading||!allowed())return;loading=true;status.textContent='Caricamento delle radio…';render();
  for(const host of hosts){
   try{
    const response=await fetch(host+'/json/stations/search?countrycode=IT&hidebroken=true&order=clickcount&reverse=true&limit=24',{signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error();
    const data=await response.json();stations=data.map(normalize).filter(Boolean);
    if(!stations.length)throw Error();
    loaded=true;loading=false;render();status.textContent='Scegli una radio e premi Play. Preferiti salvati sul dispositivo.';return;
   }catch{}
  }
  loading=false;render();status.textContent='Elenco radio non raggiungibile. Puoi usare i preferiti o riprovare.';
 }
 function nextStream(){
  clearTimeout(watchdog);
  if(current&&streamIndex+1<current.urls.length){streamIndex++;startStream();return}
  audio.pause();status.textContent='Radio non raggiungibile. Scegli un’altra stazione.';update();
 }
 async function startStream(){
  if(!current||!allowed())return;
  const serial=++attempt;clearTimeout(watchdog);audio.pause();audio.src=current.urls[streamIndex];audio.load();status.textContent='Connessione alla radio…';
  try{
   await audio.play();if(serial!==attempt)return;
   watchdog=setTimeout(()=>{if(serial===attempt&&audio.readyState<2)nextStream()},12000);
  }catch(error){if(serial!==attempt)return;if(error.name==='NotAllowedError'){status.textContent='Tocca Play per avviare la radio.';update()}else nextStream()}
 }
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden&&!loaded)loadStations()};
 play.onclick=()=>{if(!allowed())return;if(!current){panel.hidden=false;toggle.setAttribute('aria-expanded','true');loadStations();return}if(!audio.paused){attempt++;clearTimeout(watchdog);audio.pause();status.textContent='Radio in pausa.'}else{streamIndex=0;startStream()}update()};
 select.onchange=()=>{
  const selected=[...favorites,...stations,current].find(st=>st&&st.id===select.value);if(!selected)return;
  attempt++;clearTimeout(watchdog);audio.pause();current=selected;streamIndex=0;saveLocal('binottoland-radio-last',current);update();startStream();
 };
 star.onclick=()=>{if(!current)return;const found=favorites.some(s=>s.id===current.id);favorites=found?favorites.filter(s=>s.id!==current.id):[...favorites,current];saveLocal('binottoland-radio-favorites',favorites);render()};
 volume.oninput=()=>{audio.volume=Number(volume.value);saveLocal('binottoland-radio-volume',audio.volume)};
 document.getElementById('radio-reload').onclick=loadStations;
 audio.addEventListener('playing',()=>{clearTimeout(watchdog);status.textContent=current?'In ascolto · '+current.name:'In ascolto';update()});
 audio.addEventListener('pause',update);audio.addEventListener('waiting',()=>{status.textContent='Buffering…'});audio.addEventListener('error',()=>{if(audio.getAttribute('src'))nextStream()});
 render();
})();