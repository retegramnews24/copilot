const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
const $=id=>document.getElementById(id);
let room=null,state=null,ws=null,retry=null,busy=false,credentials={},games=[],lobbyWS=null,lobbyRetry=null,roomEpoch=0;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{throw Error('Abilita la memoria locale per conservare il tuo posto.')} }
$('name').value=read('binotto-name','');
history.replaceState(null,'',location.pathname);
function err(s){$('error').textContent=s}
async function request(path,data){
 const response=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(credentials.token||'')},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Errore server');return result;
}
function api(action,data){return request(action==='create'?'/api/create':'/api/room/'+room+'/'+action,data)}
function ownedGame(){return games.find(g=>g.phase!=='finished'&&g.players.some(p=>p.id===read('binotto-'+g.room,{}).player))}
function renderLobby(){
 const own=ownedGame();$('create').hidden=!!own;$('resume').hidden=!own;
 if(own){$('resume').textContent='Riprendi Partita '+own.number;$('resume').onclick=()=>openRoom(own.room)}
 $('games').replaceChildren();$('empty-games').hidden=games.length>0;
 for(const game of games){
  const card=document.createElement('article');card.className='card game-row';
  const heading=document.createElement('h3');heading.textContent='Partita '+game.number;
  const names=document.createElement('p');names.textContent=game.players.map(p=>p.name).join(' · ')+(game.players.length===1?' · Posto libero':'');
  const status=document.createElement('p');status.className='hint';status.textContent=game.phase==='waiting'?'In attesa di un avversario':game.phase==='finished'?'Conclusa':'In corso · turno di '+game.players[game.turn].name;
  const button=document.createElement('button');button.className='alt';
  const mine=game.players.some(p=>p.id===read('binotto-'+game.room,{}).player);
  button.textContent=mine?'Riprendi':game.phase==='waiting'?'Entra · gioca o guarda':'Guarda';
  button.onclick=()=>openRoom(game.room);card.append(heading,names,status,button);$('games').append(card);
 }
 refreshDebug();
}
function stopRoom(){
 roomEpoch++;clearTimeout(retry);if(ws){ws.onclose=null;ws.close();ws=null}
}
function showLobby(){
 stopRoom();room=null;state=null;credentials={};$('table').hidden=true;$('lobby').hidden=false;
 $('expires').textContent='';$('log').replaceChildren();err('');renderLobby();
}
async function openRoom(nextRoom){
 if(busy)return;
 stopRoom();room=nextRoom;state=null;credentials=read('binotto-'+room,{});const epoch=roomEpoch;
 err('');
 try{const s=await api('state');if(epoch!==roomEpoch)return;render(s);connect()}
 catch(e){if(epoch===roomEpoch){showLobby();err(e.message)}}
}
function render(s){
 if(!room||s.room!==room||(state&&s.revision<state.revision))return;
 state=s;$('lobby').hidden=true;$('table').hidden=false;
 const mine=s.players.findIndex(p=>p.id===credentials.player);
 $('room-number').textContent=s.number?'Partita '+s.number:'Partita';
 $('status').textContent=s.phase==='waiting'?'In attesa di un avversario':s.phase==='finished'?'Partita conclusa':'Turno di '+s.players[s.turn].name;
 $('players').replaceChildren();
 for(let i=0;i<2;i++){const el=document.createElement('div');el.className='person'+(s.phase==='playing'&&s.turn===i?' active':'');el.textContent=s.players[i]?.name||'Posto libero';$('players').append(el)}
 $('role').textContent=mine<0?'Stai assistendo.':'Sei il giocatore '+(mine+1)+'.';
 $('join-name').hidden=s.phase!=='waiting'||mine>=0;
 $('claim').hidden=s.phase!=='waiting'||mine>=0;
 $('pass').hidden=s.phase!=='playing'||mine<0;$('pass').disabled=mine!==s.turn||busy;
 $('finish').hidden=s.phase==='finished'||mine<0;
 $('newtable').hidden=mine>=0&&s.phase!=='finished';
 $('expires').textContent='Disponibile fino al '+new Date(s.expires).toLocaleString('it-IT');
 $('log').replaceChildren();for(const m of s.moves.slice(-30).reverse()){const p=document.createElement('p');p.textContent='#'+m.number+' · '+m.by+' ha passato il turno';$('log').append(p)}
 refreshDebug();
}
function connect(){
 clearTimeout(retry);if(!room)return;
 if(ws){ws.onclose=null;ws.close()}
 const selected=room,socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/room/'+room+'/ws');ws=socket;
 socket.onopen=()=>{if(room!==selected)return;$('connection').textContent='● Collegato in diretta';refreshDebug()};
 socket.onmessage=e=>{if(room!==selected)return;try{render(JSON.parse(e.data))}catch{err('Aggiornamento non valido.')}};
 socket.onclose=()=>{if(room!==selected)return;$('connection').textContent='○ Riconnessione…';retry=setTimeout(connect,4000)};
}
function connectLobby(){
 clearTimeout(lobbyRetry);if(lobbyWS){lobbyWS.onclose=null;lobbyWS.close()}
 const socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/lobby/ws');lobbyWS=socket;
 socket.onopen=()=>{$('lobby-connection').textContent='● Elenco in diretta'};
 socket.onmessage=e=>{try{games=JSON.parse(e.data).games;renderLobby()}catch{err('Elenco non valido.')}};
 socket.onclose=()=>{$('lobby-connection').textContent='○ Riconnessione elenco…';lobbyRetry=setTimeout(connectLobby,4000)};
}
function nickname(field='name'){
 const value=$(field).value.trim();if(!value)throw Error('Inserisci il tuo nome.');save('binotto-name',value);$('name').value=value;return value;
}
function action(id,fn){$(id).onclick=async()=>{if(busy)return;busy=true;$(id).disabled=true;err('');try{await fn()}catch(e){err(e.message)}finally{busy=false;$(id).disabled=false;if(state)render(state)}}}
action('create',async()=>{
 if(ownedGame())throw Error('Hai già una partita aperta: riprendila prima di crearne un’altra.');
 save('binotto-probe',true);const j=await api('create',{name:nickname()});
 stopRoom();room=j.state.room;state=null;credentials={token:j.token,player:j.player};save('binotto-'+room,credentials);render(j.state);connect();renderLobby();
});
action('claim',async()=>{
 const own=ownedGame();if(own&&own.room!==room)throw Error('Hai già una partita aperta. Puoi assistere a questa.');
 const j=await api('claim',{name:nickname('join-name-input')});credentials={token:j.token,player:j.player};save('binotto-'+room,credentials);render(j.state);renderLobby();
});
action('pass',async()=>render(await api('pass',{revision:state.revision})));
action('finish',async()=>{if(confirm('Concludere la partita per tutti?'))render(await api('finish',{revision:state.revision}))});
$('back-lobby').onclick=showLobby;
$('newtable').onclick=()=>{showLobby();$('name').focus()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){connectLobby();if(room)connect()}});
function refreshDebug(){
 const entries=[['Interfaccia','Checkmate! 0.4'],['Ambiente',tg?.initData?'Telegram':'Browser'],['Partita',state?.number||'Sala partite'],['Partite elencate',games.length],['Stato',state?.phase||'Ingresso'],['Revisione',state?.revision??'—'],['Ruolo',state?(state.players.some(p=>p.id===credentials.player)?'Giocatore':'Spettatore'):'—'],['Connessione',(ws||lobbyWS)?(['In apertura','Connessa','In chiusura','Chiusa'][(ws||lobbyWS).readyState]):'Non attiva'],['Viewport',innerWidth+' × '+innerHeight]];
 $('debug-info').replaceChildren();
 for(const [label,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);$('debug-info').append(dt,dd)}
}
function selectPage(page){
 document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.page===page;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$('page-'+tab.dataset.page).hidden=!selected});
 if(page==='debug')refreshDebug();
}
document.querySelectorAll('.tab').forEach((tab,index,tabs)=>{
 tab.onclick=()=>selectPage(tab.dataset.page);
 tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();selectPage(tabs[next].dataset.page)}
});
function applyTheme(theme){
 if(!['dark','light','slate'].includes(theme))theme='dark';
 document.documentElement.dataset.theme=theme;
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));
 document.querySelector('meta[name="theme-color"]').content=theme==='light'?'#eeece4':theme==='slate'?'#14191f':'#111512';
}
applyTheme(read('checkmate-theme','dark'));
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>{applyTheme(button.dataset.themeChoice);try{save('checkmate-theme',button.dataset.themeChoice)}catch(e){err(e.message)}});
$('debug-refresh').onclick=async()=>{
 $('debug-result').textContent='Aggiornamento…';
 try{if(room){render(await api('state'));connect();$('debug-result').textContent='Stato aggiornato. Riconnessione avviata.'}else{connectLobby();$('debug-result').textContent='Riconnessione alla sala partite avviata.'}}catch(e){$('debug-result').textContent=e.message}refreshDebug();
};
function fitViewport(){
 const height=tg?.viewportStableHeight||window.visualViewport?.height||innerHeight;
 document.documentElement.style.setProperty('--app-height',height+'px');
}
tg?.onEvent('viewportChanged',fitViewport);window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);
fitViewport();refreshDebug();

$('join-name-input').value=read('binotto-name','');
request('/api/lobby').then(result=>{games=result.games;renderLobby()}).catch(e=>err(e.message));
connectLobby();
