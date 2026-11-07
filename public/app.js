import {renderScopa} from './scopa-ui.js';
import {renderNaval,renderBriscola} from './sea-cards-ui.js';
import {renderScarabeo} from './board-games-ui.js';
import {safeInsets,applyInsets,viewportHeight} from './safe-area.js';
const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
if(tg?.platform==='android')document.documentElement.dataset.telegramPlatform='android';
const $=id=>document.getElementById(id);
let motoRace=null,motoSocket=null,motoOpening=false,motoRetry=0,motoBeat=0;
let labyrinthRoom=null,labyrinthWatch=false,labyrinthSocket=null,labyrinthLastState=null,labyrinthRetry=0,labyrinthBeat=0,labyrinthOpening=false;
let sessionToken='',identity=null,onlineUsers=[],chatMessages=[],chatSending=false;
function seat(id){const old=read('binotto-'+id,{});return identity?{...old,player:identity.player}:old}
let capturePath=[],selectedSquare=null,boardFlipped=null,promotionMove=null;
let replayFrames=[],replayPly=null,replayTimer=null,replayRevision=null,replayLoading=false;
const events=[];
function trace(level,message){
 const safe=String(message).replace(/\b\d{6,}:[A-Za-z0-9_-]{15,}\b/g,'[REDACTED]').replace(/(tgWebAppData|initData|Authorization|token)[=:]\s*[^\s]+/gi,'$1=[REDACTED]').slice(0,400);
 events.push(new Date().toLocaleTimeString('it-IT')+' ['+level+'] '+safe);
 if(events.length>160)events.splice(0,events.length-160);
 const output=$('terminal');if(output){const bottom=output.scrollHeight-output.scrollTop-output.clientHeight<35;output.textContent=events.join('\n');if(bottom)output.scrollTop=output.scrollHeight}
}
let room=null,state=null,ws=null,retry=null,busy=false,credentials={},games=[],lobbyWS=null,lobbyRetry=null,roomEpoch=0;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{throw Error('Abilita la memoria locale per conservare il tuo posto.')} }
$('name').textContent='Accesso Telegram…';
history.replaceState(null,'',location.pathname);
function err(s){$('error').textContent=s;if(s)trace('ERROR',s)}
async function request(path,data,keepalive=false){
 if(!sessionToken)throw Error('Apri Binottoland da Telegram per accedere.');
 const started=performance.now();trace('HTTP',(data?'POST ':'GET ')+path);
 try{
  const response=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken,'X-Player-Token':credentials.token||''},...(data?{body:JSON.stringify(data)}:{}),keepalive,signal:AbortSignal.timeout(15000)});
  const result=await response.json();trace(response.ok?'OK':'ERROR',response.status+' '+path+' · '+Math.round(performance.now()-started)+' ms');
  if(!response.ok)throw Object.assign(Error(result.error||'Errore server'),{status:response.status});return result;
 }catch(error){trace('ERROR',error.message);throw error}
}
function api(action,data){return request(action==='create'?'/api/create':'/api/room/'+room+'/'+action,data)}
const gameTitle=g=>g?.game==='labyrinth'?'Labyrinth':g?.game==='moto-trial'?'Moto Trial':g?.game==='naval'?'Battaglia navale':g?.game==='briscola5'?'Briscola in cinque':g?.game==='briscola'?'Briscola':g?.game==='scarabeo'?'Scarabeo':g?.game==='scopa'?'Scopa':g?.game==='uno'?'UNO':g?.game==='connect4'?'Forza 4':g?.game==='checkers'?'Dama italiana':'Checkmate!';
const boardState=()=>state?.naval||state?.briscola||state?.scarabeo||state?.scopa||state?.uno||state?.connect4||state?.checkers||state?.chess;
const staged=g=>['uno','scarabeo','scopa','naval','briscola','briscola5'].includes(g?.game);
const gameLimits=g=>g?.limits||(g?.game==='briscola5'?{min:5,max:5}:['briscola','scarabeo','scopa'].includes(g?.game)?{min:2,max:4}:g?.game==='uno'?{min:2,max:10}:{min:2,max:2});
const ongoing=g=>!g.archived&&(g.phase!=='finished'||g.series&&!g.series.done);
function ownedGame(){return games.find(g=>g.game!=='labyrinth'&&g.game!=='moto-trial'&&ongoing(g)&&g.players.some(p=>p.id===seat(g.room).player))}

function renderProfile(){
 const node=$('profile-avatar'),avatar=makeAvatar(identity||{name:'?'});node.replaceChildren(...avatar.childNodes);
 $('profile-username').textContent=identity?.username?'@'+identity.username:identity?'Account Telegram':'';
}
function makeAvatar(user){
 const avatar=document.createElement('span');avatar.className='avatar';
 avatar.textContent=(user.name||'?').trim().split(/\s+/).slice(0,2).map(word=>[...word][0]).join('').toUpperCase();
 const photo=user.photo||'';
 if(photo.startsWith('https://')){
  const image=document.createElement('img');image.alt='';image.referrerPolicy='no-referrer';image.src=photo;image.onerror=()=>image.remove();avatar.append(image);
 }
 return avatar;
}
function renderLobby(){
 $('play-labyrinth').disabled=!identity;
 $('create-moto-trial').disabled=!identity||motoOpening;
 const own=ownedGame();
 document.querySelectorAll('[data-create-game]').forEach(button=>{button.disabled=!identity;});
 $('owned-table').hidden=!own;
 $('owned-table-note').textContent=own?'Tavolo aperto · '+gameTitle(own):'';
 $('resume-table').onclick=async()=>{
  if(!own)return;
  await openRoom(own.room,true);
  if(room===own.room)selectPage('game');
 };
 const active=games.filter(ongoing);
 $('games').replaceChildren();
 $('empty-games').hidden=active.length>0;
 $('empty-games').textContent='Nessun tavolo attivo.';
 for(const game of active){
  if(game.game==='moto-trial'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';
   title.textContent='Corsa '+game.number+' · '+(game.courseName||'Moto Trial');
   info.textContent=(game.online||0)+' / '+(game.capacity||8)+' piloti'+(game.players.length?' · '+game.players.map(p=>p.name).join(' · '):'');
   const mine=game.players.some(p=>p.id===identity?.player);
   enter.disabled=!identity||!mine&&game.online>=game.capacity;
   enter.textContent=enter.disabled&&identity?'Al completo':mine?'Riprendi':'Entra';
   enter.onclick=()=>openMotoRace(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }

  if(game.game==='labyrinth'){
   const card=document.createElement('article');card.className='table-card';const title=document.createElement('strong');title.textContent='Spedizione '+game.number+' · Labyrinth';const info=document.createElement('p');info.className='turn-note';info.textContent=(game.online||0)+' collegati · '+(game.arrived||0)+' nell’arena · '+(game.entryLocked?'Ingressi chiusi':'Ingressi aperti');const players=document.createElement('p');players.className='turn-note';players.textContent=game.players.map(p=>p.name).join(' · ');card.append(title,info,players);
   const mine=game.players.some(p=>p.id===identity?.player);const enter=document.createElement('button');enter.textContent=mine?'Riprendi':game.entryLocked?'Assisti':'Entra';enter.onclick=()=>openLabyrinth(game.room,!mine&&game.entryLocked);card.append(enter);const watch=document.createElement('button');watch.className='alt';watch.textContent='Guarda';watch.onclick=()=>openLabyrinth(game.room,true);card.append(watch);
   if(mine)for(const [kind,label] of [['archive','Archivia'],['delete','Elimina']]){const b=document.createElement('button');b.className='alt';b.textContent=label;b.onclick=async()=>{if(!confirm(label+' questa spedizione per tutti i partecipanti?'))return;try{await request('/api/labyrinth/'+game.room+'/'+kind,{});const data=await request('/api/lobby');games=data.games;renderLobby()}catch(e){err(e.message)}};card.append(b)}$('games').append(card);continue;
  }

  const card=document.createElement('article');card.className='table-card';
  const title=document.createElement('div');title.className='table-title';
  const heading=document.createElement('strong');heading.textContent='Tavolo '+game.number+' · '+gameTitle(game);
  const badge=document.createElement('span');badge.className='game-badge '+game.phase;
  badge.textContent=game.phase==='waiting'?(staged(game)?game.players.length+'/'+gameLimits(game).max+' giocatori':'Posto libero'):game.phase==='playing'?'In partita':'Tra le manche';title.append(heading,badge);
  const names=document.createElement('div');names.className='table-players';
  for(let i=0;i<(staged(game)?game.players.length:2);i++){const person=document.createElement('span');person.className='table-player'+(!game.players[i]?' vacant':'');const dot=document.createElement('i');dot.className='side-dot '+(game.game==='connect4'?(i?'yellow':'red'):(i?'black':'white'));const label=document.createElement('span');label.textContent=game.players[i]?.name||'In attesa';person.append(dot,label);names.append(person)}
  const note=document.createElement('p');note.className='turn-note';
  const mine=game.players.some(p=>p.id===seat(game.room).player);
  note.textContent=game.phase==='playing'?(game.players[game.turn]?.id===seat(game.room).player?'Tocca a te':'Tocca a '+game.players[game.turn].name):game.phase==='waiting'?(staged(game)?'Il creatore avvia la partita.':''):'In attesa della prossima manche.';
  const button=document.createElement('button');button.className='table-open '+(game.phase==='waiting'&&!mine&&!own?'':'alt');
  button.textContent=mine?(game.phase==='finished'?'Riprendi torneo':'Riprendi'):game.phase==='waiting'?(own||(staged(game)&&game.players.length>=gameLimits(game).max)?'Guarda':'Gioca'):'Guarda';
  button.onclick=()=>openRoom(game.room,staged(game)&&game.players.length>=gameLimits(game).max);if(game.series)note.textContent+=' · Torneo: '+game.series.target+' vittorie';card.append(title,names,note,button);$('games').append(card);
 }
 renderArchive();refreshDebug();renderSocial();
}

function stopRoom(){
 $('start-error').textContent='';
 stopReplay();replayFrames=[];replayPly=null;replayRevision=null;replayLoading=false;
 $('manage-game').open=false;$('draw-dialog').hidden=true;$('draw-response').hidden=true;
 capturePath=[];selectedSquare=null;promotionMove=null;boardFlipped=null;$('promotion').hidden=true;roomEpoch++;clearTimeout(retry);if(ws){ws.onclose=null;ws.close(1000,'Uscita dal tavolo');ws=null}
}
function showLobby(){
 stopRoom();room=null;state=null;credentials={};$('table').hidden=true;$('lobby').hidden=false;
 $('log').replaceChildren();err('');renderLobby();scrollChatToLatest();sendPresence();
}
function discardResult(keepalive=false){
 if(!room||!state||state.archived||ongoing(state)||!state.players.some(p=>p.id===credentials.player))return;
 request('/api/room/'+room+'/dismiss',{matchId:state.matchId||null},keepalive).catch(e=>{
  if(!keepalive)err(e.message);
 });
}
function leaveRoom(){
 discardResult();
 showLobby();
}
async function openRoom(nextRoom,watchOnly=false){
 if(games.find(g=>g.room===nextRoom)?.game==='moto-trial')return openMotoRace(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='labyrinth')return openLabyrinth(nextRoom,watchOnly);
 if(busy)return;
 if(nextRoom!==room)discardResult();
 stopRoom();room=nextRoom;state=null;credentials=seat(room);const epoch=roomEpoch;
 err('');
 try{
 let s=await api('state');if(epoch!==roomEpoch)return;
 if(!watchOnly&&s.phase==='waiting'&&!s.players.some(p=>p.id===credentials.player)&&!ownedGame()){
  const playerName=identity.name;
  $('name').textContent=playerName;
  try{
   const j=await api('claim',{name:playerName});
   if(epoch!==roomEpoch)return;credentials={token:j.token,player:j.player};s=j.state;
  }catch(e){if(epoch!==roomEpoch)return;s=await api('state');trace('CLAIM',e.message)}
 }
 if(epoch!==roomEpoch)return;render(s);connect()
}
 catch(e){if(epoch===roomEpoch){showLobby();err(e.message)}}
}
function render(s){
 if(!room||s.room!==room||(state&&s.revision<state.revision))return;
 if(!state||s.revision!==state.revision){capturePath=[];selectedSquare=null;promotionMove=null;$('promotion').hidden=true;trace('STATE','Partita '+s.number+' · '+s.phase+' · rev '+s.revision)}
 if(state&&(state.matchId!==s.matchId||state.series?.round!==s.series?.round)){stopReplay();replayFrames=[];replayPly=null;replayRevision=null;replayLoading=false}
 state=s;$('lobby').hidden=true;$('table').hidden=false;
 const mine=s.players.findIndex(p=>p.id===credentials.player);
 $('room-number').textContent=(s.number?'Tavolo '+s.number+' · '+gameTitle(s):gameTitle(s))+(s.mode==='tutorial'?' · Tutorial':s.mode==='ai'?' · Singolo AI':'');
 $('status').textContent=s.phase==='waiting'?(staged(s)?'In attesa dell’avvio · '+s.players.length+'/'+gameLimits(s).max:'In attesa di un avversario'):s.phase==='finished'?(s.archived?'Archiviata':boardState()?.reason||'Partita conclusa')+(boardState()?.result&&!staged(s)?' · '+boardState().result:''):(mine===s.turn?'Tocca a te':'Tocca a '+s.players[s.turn].name)+(s.chess?.check?' · Scacco':'');
 $('players').replaceChildren();
 for(let i=0;i<(staged(s)?s.players.length:2);i++){const el=document.createElement('div');el.className='person'+(s.phase==='playing'&&s.turn===i?' active':'');el.textContent=(staged(s)?'':boardState()?(s.connect4?(i===0?'Rosso · ':'Giallo · '):(i===0?'Bianco · ':'Nero · ')):'')+(s.players[i]?.name||'Posto libero');if(staged(s)){const g=boardState();el.textContent+=' · '+(s.naval?(g.ready[i]?'Flotta pronta':'Prepara flotta')+' · '+(5-g.sunk[i])+' navi':s.scarabeo?(g.scores[i]||0)+' pt · '+(g.counts[i]||0)+' lettere':(g.counts[i]||0)+' carte'+(s.briscola&&s.players.length===4?' · coppia '+(i%2?'B':'A'):''))+(s.scopa?' · '+g.scores[i]+' pt':'')}$('players').append(el)}
 $('players').classList.toggle('group-players',staged(s));
 if(s.uno?.winner!==null&&s.uno?.winner!==undefined&&s.phase==='finished')$('status').textContent='Vince '+s.players[s.uno.winner].name;
 if(s.scarabeo?.winners.length===1&&s.phase==='finished')$('status').textContent='Vince '+s.players[s.scarabeo.winners[0]].name+' · '+s.scarabeo.scores[s.scarabeo.winners[0]]+' punti';
 if(s.scopa?.winners.length&&s.phase==='finished')$('status').textContent='Vincono '+s.scopa.winners.map(i=>s.players[i].name).join(' + ');
 if(s.naval&&s.phase==='playing'&&s.naval.phase==='placement')$('status').textContent='Posizionate le flotte';
 if(s.naval?.winner!==null&&s.naval?.winner!==undefined&&s.phase==='finished')$('status').textContent='Vince '+s.players[s.naval.winner].name;
 if(s.briscola&&s.phase==='playing'&&s.briscola.phase!=='play')$('status').textContent=(s.briscola.phase==='auction'?'Asta · ':'Scelta della briscola · ')+s.players[s.turn].name;
 if(s.briscola?.winners.length&&s.phase==='finished')$('status').textContent='Vincono '+s.briscola.winners.map(i=>s.players[i].name).join(' + ');
 renderSeries(s,mine);
 const start=$('start-group'),minPlayers=gameLimits(s).min;
 start.hidden=!staged(s)||s.phase!=='waiting'||mine!==0;
 start.disabled=start.hidden||busy||s.players.length<minPlayers;
 start.textContent=s.players.length<minPlayers?'In attesa di almeno '+minPlayers+' giocatori':'Avvia partita';
 if(start.hidden)$('start-error').textContent='';
 $('role').textContent=mine<0?'Stai assistendo.':'Sei il giocatore '+(mine+1)+'.';

 $('pass').hidden=!!boardState()||s.phase!=='playing'||mine<0;$('pass').disabled=mine!==s.turn||busy;
 $('finish').hidden=s.phase==='finished'||mine<0;
 $('offer-draw').hidden=(!s.chess&&!s.checkers)||s.phase!=='playing'||mine<0;
 $('offer-draw').disabled=busy||!!s.drawOffer||!!s.chess&&s.moves.length<2;
 const claims=s.chess?.claimMoves||[],claimable=!!s.chess?.claim||claims.length>0;
 $('chess-draw-claim').hidden=!s.chess||!canMove()||!claimable;
 $('chess-claim-label').hidden=!!s.chess?.claim;
 const claimSelect=$('chess-claim-move'),choice=claimSelect.value;
 claimSelect.replaceChildren(...claims.map((move,i)=>new Option(move.san,String(i))));
 if(claims[Number(choice)])claimSelect.value=choice;

 $('draw-info').textContent=s.drawOffer?(s.drawOffer.by===credentials.player?'Hai offerto la patta. In attesa dell’avversario.':s.drawOffer.name+' propone la patta.'):'';
 const responder=mine>=0&&s.drawOffer&&s.drawOffer.by!==credentials.player;
 const receiving=!!responder&&s.phase==='playing';
 const newlyReceived=$('draw-response').hidden&&receiving;
 $('draw-response').hidden=!receiving;
 $('received-draw-info').textContent=receiving?s.drawOffer.name+' ti offre la patta.':'';
 $('accept-draw').hidden=!receiving;$('reject-draw').hidden=!receiving;
 if(receiving){$('draw-dialog').hidden=true;if(newlyReceived)$('reject-draw').focus();}
 else if(document.activeElement===$('accept-draw')||document.activeElement===$('reject-draw'))$('back-lobby').focus();
 if(s.phase!=='playing')$('draw-dialog').hidden=true;
 const completed=s.phase==='finished'&&!ongoing(s);
 if(completed&&!s.archived)games=games.filter(game=>game.room!==s.room);
 $('newtable').hidden=mine<0||!completed;
 $('keep-table').hidden=mine<0||!completed||!!s.archived;
 $('keep-table').disabled=busy;
 const retention=$('table-retention');
 retention.hidden=!completed||s.archived||mine<0;
 retention.textContent=retention.hidden?'':'Premi Archivia partita per conservarla prima di uscire.';
 $('manage-game').hidden=mine<0;$('archive-game').hidden=!!s.archived;
 $('replay-player').hidden=staged(s)||!boardState()||s.phase!=='finished';
 if(!staged(s)&&boardState()&&s.phase==='finished'&&replayRevision!==s.revision&&!replayLoading)loadReplay();
 $('log').replaceChildren();for(const m of s.moves.slice(-30).reverse()){const p=document.createElement('p');p.textContent=m.description?'#'+m.number+' · '+m.by+' · '+m.description:Number.isInteger(m.column)?'#'+m.number+' · '+m.by+' · colonna '+(m.column+1):m.san?Math.ceil(m.number/2)+(m.number%2?'. ':'… ')+m.san+' · '+m.by:'#'+m.number+' · '+m.by+' ha passato il turno';$('log').append(p)}
 renderSpectators();renderBoard();renderTutorial(s);refreshDebug();sendPresence();
}
function connect(){
 clearTimeout(retry);if(!room)return;
 if(ws){ws.onclose=null;ws.close(4003,'Riconnessione')}
 const selected=room,socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/room/'+room+'/ws',['checkmate',sessionToken]);ws=socket;
 socket.onopen=()=>{if(room!==selected)return;$('connection').textContent='● Collegato in diretta';trace('WS','Partita collegata');refreshDebug()};
 socket.onmessage=e=>{if(room!==selected)return;try{const s=JSON.parse(e.data);if(s.deleted){games=games.filter(game=>game.room!==s.room);showLobby();if(s.reason!=='dismissed')err(s.reason==='expired'?'Il tavolo inattivo è stato eliminato.':'La partita è stata eliminata da un partecipante.');return}render(s)}catch{err('Aggiornamento non valido.')}};
 socket.onclose=()=>{if(room!==selected)return;trace('WS','Partita disconnessa · nuovo tentativo tra 4 s');$('connection').textContent='○ Riconnessione…';retry=setTimeout(connect,4000)};
}
function connectLobby(){
 if(!sessionToken)return;
 clearTimeout(lobbyRetry);if(lobbyWS){lobbyWS.onclose=null;lobbyWS.close()}
 const socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/lobby/ws',['checkmate',sessionToken]);lobbyWS=socket;
 socket.onopen=()=>{$('lobby-connection').textContent='● In diretta';trace('WS','Sala partite collegata');$('lobby-connection').dataset.live='true';sendPresence();renderSocial()};
 socket.onmessage=e=>{try{const data=JSON.parse(e.data);games=data.games;renderLeaders(data);onlineUsers=data.users||[];chatMessages=data.messages||[];renderLobby();renderSocial()}catch{err('Elenco non valido.')}};
 socket.onerror=()=>trace('ERROR','Connessione sala partite');
 socket.onclose=()=>{trace('WS','Sala disconnessa · nuovo tentativo tra 4 s');$('lobby-connection').textContent='Riconnessione…';$('lobby-connection').dataset.live='false';renderSocial();lobbyRetry=setTimeout(connectLobby,4000)};
}
function action(id,fn){$(id).onclick=async()=>{if(busy)return;busy=true;$(id).disabled=true;err('');try{await fn()}catch(e){err(e.message)}finally{busy=false;$(id).disabled=false;if(state)render(state)}}}
$('open-debug').onclick=()=>selectPage('debug');
$('back-settings').onclick=()=>selectPage('settings');
async function createTable(game,target,mode,seats){
 const j=await api('create',{game,target,mode,...(mode==='people'?{}:{seats})});
 stopRoom();room=j.state.room;state=null;credentials={token:j.token,player:j.player};
 selectPage('game');render(j.state);connect();renderLobby();
}
let pendingCreation=null,creationFocus=null;
function createGame(game,kind='people'){
 if(busy)return;
 pendingCreation={game,kind};
 creationFocus=document.activeElement;
 $('creation-title').textContent=gameTitle({game})+' · '+(kind==='solo'?'Singolo':'Multiplayer');
 document.querySelector('[name="table-format"][value="1"]').checked=true;
 document.querySelector('[name="solo-mode"][value="ai"]').checked=true;
 $('creation-error').textContent='';
 const {min,max}=gameLimits({game}),select=$('creation-seats');
 select.replaceChildren();
 for(let n=min;n<=max;n++){
  const option=document.createElement('option');
  option.value=n;option.textContent=n+' posti · tu + '+(n-1)+' AI';select.append(option);
 }
 updateCreation();
 $('creation-dialog').hidden=false;
 $(kind==='solo'?'creation-opponents':'creation-format').querySelector('input:checked').focus();
}
function creationMode(){
 return pendingCreation?.kind==='solo'?document.querySelector('[name="solo-mode"]:checked').value:'people';
}
function updateCreation(){
 const mode=creationMode(),single=mode!=='people';
 $('creation-format').hidden=single;
 $('creation-opponents').hidden=!single;
 $('creation-seats-row').hidden=!single;
 $('solo-words-note').hidden=!(single&&pendingCreation?.game==='scarabeo');
 $('confirm-creation').textContent=mode==='ai'?'Avvia partita':mode==='tutorial'?'Avvia tutorial':'Crea tavolo';
}
$('creation-opponents').onchange=updateCreation;
action('confirm-creation',async()=>{
 if(!pendingCreation)return;
 const mode=creationMode();
 const controls=['creation-opponents','creation-format','creation-seats','cancel-creation'];
 for(const id of controls)$(id).disabled=true;
 $('creation-error').textContent='';
 $('confirm-creation').textContent='Creazione…';
 try{
  const target=mode==='people'?Number(document.querySelector('[name="table-format"]:checked').value):1;
  await createTable(pendingCreation.game,target,mode,Number($('creation-seats').value));
  pendingCreation=null;$('creation-dialog').hidden=true;
 }catch(e){
  $('creation-error').textContent=e.message;trace('ERROR',e.message);
 }finally{
  for(const id of controls)$(id).disabled=false;
  updateCreation();
 }
});
$('cancel-creation').onclick=()=>{if(busy)return;pendingCreation=null;$('creation-dialog').hidden=true;creationFocus?.focus()};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('creation-dialog').hidden)$('cancel-creation').click()});
document.querySelectorAll('[data-create-game]').forEach(button=>{
 button.onclick=()=>createGame(button.dataset.createGame,button.dataset.creationKind);
});
action('start-group',async()=>{
 const selected=room;
 $('start-error').textContent='';
 try{
  render(await api('start',{revision:state.revision}));
 }catch(e){
  if(room!==selected)return;
  try{render(await api('state'))}catch{}
  if(room===selected&&state?.phase==='waiting')$('start-error').textContent=e.message;
 }
});
action('next-round',async()=>render(await api('next-round',{revision:state.revision})));
function renderSeries(s,mine){const q=s.series,root=$('series-status');root.hidden=!q;$('next-round').hidden=!q||q.done||s.phase!=='finished'||mine!==0;if(!q)return;root.textContent=(q.cancelled?'Torneo interrotto':q.done?'Torneo vinto da '+(q.winners||[q.winner]).map(i=>s.players[i].name).join(' + '):'Torneo · prima persona a '+q.target+' vittorie · manche '+q.round)+' · '+s.players.map((p,i)=>p.name+' '+(q.wins[i]||0)).join(' / ')}
$('uno-draw').onclick=()=>sendMove({kind:'draw',revision:state.revision});
$('uno-pass').onclick=()=>sendMove({kind:'pass',revision:state.revision});
for(const [id,kind] of Object.entries({'uno-accept-four':'accept-four','uno-challenge-four':'challenge-four','uno-declare':'uno','uno-catch':'catch-uno'})){
 $(id).onclick=()=>sendMove({kind,revision:state.revision});
}
$('uno-opening-color').onclick=()=>sendMove({kind:'color',color:$('uno-color').value,revision:state.revision});

action('pass',async()=>render(await api('pass',{revision:state.revision})));
action('finish',async()=>{if(confirm('Concludere la partita per tutti?'))render(await api('finish',{revision:state.revision}))});
$('back-lobby').onclick=()=>{if(!busy)leaveRoom()};
action('newtable',async()=>{
 if(!state||$('newtable').hidden)return;
 if(!confirm('Eliminare definitivamente questa partita e iniziarne una nuova con le stesse impostazioni?'))return;
 const selected=room;
 const j=await api('rematch',{revision:state.revision});
 if(room!==selected)return;
 credentials={token:j.token,player:j.player};render(j.state);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopReplay();sendPresence(true)}if(!document.hidden){connectLobby();if(room&&(!ws||ws.readyState>1))connect()}});
function refreshDebug(){
 const entries=[['Interfaccia','Binottoland 1.1'],['Identità',identity?identity.name+' · Telegram verificato':'Non autenticato'],['Online',onlineUsers.length],['Partita',state?.number||'Sala partite'],['Partite elencate',games.length],['Stato',state?.phase||'Ingresso'],['Revisione',state?.revision??'—'],['Ruolo',state?(state.players.some(p=>p.id===credentials.player)?'Giocatore':'Spettatore'):'—'],['Connessione',(ws||lobbyWS)?(['In apertura','Connessa','In chiusura','Chiusa'][(ws||lobbyWS).readyState]):'Non attiva'],['Motore',state?.naval?'Battaglia navale':state?.briscola?'Briscola':state?.scarabeo?'Scarabeo':state?.scopa?'Scopa':state?.uno?'UNO':state?.connect4?'Forza 4':state?.checkers?'Dama italiana':state?.chess?'Scacchi':'Lobby'],['Viewport',innerWidth+' × '+innerHeight]];
 $('debug-info').replaceChildren();
 for(const [label,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);$('debug-info').append(dt,dd)}
}
function selectPage(page){
 $('draw-dialog').hidden=true;
 const activeTab=page==='debug'?'settings':page;
 document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.page===activeTab;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});
 document.querySelectorAll('.page').forEach(section=>section.hidden=section.id!=='page-'+page);
 if(page!=='game')stopReplay();trace('UI','Pagina '+page);
 if(page==='games')loadLeaders();if(page==='debug')refreshDebug();if(page==='game')requestAnimationFrame(fitBoard);
}
function navigate(page){
 if(busy)return;
 if(page==='game'||(state&&!ongoing(state)&&!state.archived))leaveRoom();
 selectPage(page);
}
document.querySelectorAll('.tab').forEach((tab,index,tabs)=>{
 tab.onclick=()=>navigate(tab.dataset.page);
 tab.onkeydown=event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();
  navigate(tabs[next].dataset.page);
 };
});
function applyTheme(theme){
 if(!['dark','light','slate','ocean','rose','sand'].includes(theme))theme='dark';
 document.documentElement.dataset.theme=theme;
 document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme)));
 document.querySelector('meta[name="theme-color"]').content={dark:'#15231f',light:'#f2eee4',slate:'#18233c',ocean:'#102c35',rose:'#301d2a',sand:'#efe0bd'}[theme];
}
applyTheme(read('checkmate-theme','dark'));
document.querySelectorAll('[data-theme-choice]').forEach(button=>button.onclick=()=>{applyTheme(button.dataset.themeChoice);try{save('checkmate-theme',button.dataset.themeChoice)}catch(e){err(e.message)}});
$('debug-refresh').onclick=async()=>{
 $('debug-result').textContent='Aggiornamento…';
 try{const health=await request('/api/health');trace('HEALTH','Server '+health.version);if(room){render(await api('state'));connect();$('debug-result').textContent='Stato aggiornato. Riconnessione avviata.'}else{connectLobby();$('debug-result').textContent='Riconnessione alla sala partite avviata.'}}catch(e){$('debug-result').textContent=e.message}refreshDebug();
};
function fitViewport(){
 const height=viewportHeight(tg,{innerHeight,visualHeight:window.visualViewport?.height,fullscreen:!!document.fullscreenElement});
 const insets=safeInsets(tg);applyInsets(document.documentElement,insets);
 if(!$('labyrinth-overlay').hidden)$('labyrinth-frame').contentWindow?.postMessage({type:'labyrinth:insets',insets},location.origin);
 sendMotoInsets(insets);
 document.documentElement.style.setProperty('--app-height',height+'px');requestAnimationFrame(fitBoard);
}
for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])tg?.onEvent(event,fitViewport);window.addEventListener('resize',fitViewport);document.addEventListener('fullscreenchange',fitViewport);document.addEventListener('webkitfullscreenchange',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);
fitViewport();refreshDebug();


const pieceNames={p:'pedone',r:'torre',n:'cavallo',b:'alfiere',q:'donna',k:'re'};
function pieceSvg(piece){
 const type=piece.toLowerCase(),white=piece!==type;
 const shapes={
 p:'<circle cx="22.5" cy="12" r="6"/><path d="M18 18h9l-1 8 6 6H13l6-6z"/><path d="M12 33h21v5H12z"/>',
 r:'<path d="M10 7h6v5h4V7h5v5h4V7h6v12l-5 3 1 10H14l1-10-5-3z"/><path d="M11 33h23v5H11z"/>',
 n:'<path d="m13 30 4-7-6 1-3-5L20 7l9 3 5 9-1 13H13z"/><path d="m20 7-1-4 6 4m-9 13 8-3-4 8" fill="none"/><circle cx="22" cy="13" r="1.3" fill="currentColor" stroke="none"/><path d="M11 33h24v5H11z"/>',
 b:'<path d="M22.5 5c-4 4-9 9-9 13 0 4 4 7 9 7s9-3 9-7c0-4-5-9-9-13z"/><path d="m25 11-6 7" fill="none"/><path d="m18 25-4 7h17l-4-7zM11 33h23v5H11z"/>',
 q:'<path d="m10 12 5 18h15l5-18-8 8-4.5-12-4.5 12z"/><circle cx="10" cy="10" r="2.5"/><circle cx="22.5" cy="6" r="2.5"/><circle cx="35" cy="10" r="2.5"/><path d="M14 30h17v3H14zM11 34h23v4H11z"/>',
 k:'<path d="M20 4h5v5h5v4h-5v5h-5v-5h-5V9h5z"/><path d="M14 18c-8-3-9 7 0 10l2 4h13l2-4c9-3 8-13 0-10l-8.5 4z"/><path d="M12 33h21v5H12z"/>'
 };
 return '<svg viewBox="0 0 45 45" aria-hidden="true"><g fill="var(--'+(white?'white':'black')+'-piece)" stroke="var(--'+(white?'white':'black')+'-outline)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" color="var(--'+(white?'white':'black')+'-outline)">'+shapes[type]+'</g></svg>';
}
function position(fen){
 const result={};fen.split(' ')[0].split('/').forEach((row,index)=>{let file=0;for(const char of row){if(/\d/.test(char))file+=Number(char);else{result['abcdefgh'[file]+(8-index)]=char;file++}}});return result;
}
function canMove(){if(replayPly!==null||state?.archived||state?.phase!=='playing'||busy)return false;const me=state.players.findIndex(p=>p.id===credentials.player);if(me<0)return false;if(state.scarabeo?.pending)return state.scarabeo.pending.by!==me&&!Object.hasOwn(state.scarabeo.pending.votes,me);if(state.naval?.phase==='placement')return !state.naval.ready[me];return state.turn===me}
function renderBoard(){
 $('naval-area').hidden=!state?.naval;$('briscola-area').hidden=!state?.briscola;
 if(state?.naval||state?.briscola){$('chess-area').hidden=true;$('uno-area').hidden=true;$('scarabeo-area').hidden=true;$('scopa-area').hidden=true;const ctx={active:canMove(),playing:state.phase==='playing',seat:state.players.findIndex(p=>p.id===credentials.player),players:state.players,room:state.matchId||room,round:state.series?.round||1,player:identity?.id,busy,game:state.game,move:a=>sendMove({...a,revision:state.revision})};if(state.naval)renderNaval(state.naval,ctx);else renderBriscola(state.briscola,ctx);return}
 $('scarabeo-area').hidden=!state?.scarabeo;$('scopa-area').hidden=!state?.scopa;
 if(state?.scarabeo||state?.scopa){$('chess-area').hidden=true;$('uno-area').hidden=true;const ctx={active:canMove(),playing:state.phase==='playing',seat:state.players.findIndex(p=>p.id===credentials.player),players:state.players,room:state.matchId||room,round:state.series?.round||1,player:identity?.id,busy,move:a=>sendMove({...a,revision:state.revision})};if(state.scarabeo)renderScarabeo(state.scarabeo,ctx);else renderScopa(state.scopa,ctx);return}
 $('uno-area').hidden=!state?.uno;if(state?.uno){$('chess-area').hidden=true;renderUno();return}
 $('move-strip').hidden=!!state?.checkers||!!state?.connect4;
 $('board').classList.toggle('connect4-board',!!state?.connect4);$('flip-board').hidden=!!state?.connect4;
 $('chess-area').hidden=!boardState();if(!boardState())return;
 if(state.connect4){renderConnect4();return;}
 $('board').setAttribute('aria-label',state.checkers?'Damiera italiana':'Scacchiera');
 if(state.checkers){renderCheckersBoard();return;}
 $('cancel-capture').hidden=true;
 const viewChess=replayPly!==null&&replayFrames[replayPly]?{...state.chess,...replayFrames[replayPly],legalMoves:[]}:state.chess;
 const mine=state.players.findIndex(p=>p.id===credentials.player);
 const flipped=boardFlipped===null?mine===1:boardFlipped;
 const files=flipped?'hgfedcba':'abcdefgh',ranks=flipped?'12345678':'87654321';
 const pieces=position(viewChess.fen),targets=(viewChess.legalMoves||[]).filter(m=>m.from===selectedSquare);
 $('board').replaceChildren();
 for(let ri=0;ri<8;ri++)for(let fi=0;fi<8;fi++){
  const square=files[fi]+ranks[ri],piece=pieces[square],button=document.createElement('button');
  const dark=('abcdefgh'.indexOf(square[0])+Number(square[1]))%2===1;
  button.className='square'+(dark?' dark':'')+(piece?' occupied':'')+(selectedSquare===square?' selected':'')+(targets.some(m=>m.to===square)?' target':'')+([viewChess.lastMove?.from,viewChess.lastMove?.to].includes(square)?' last':'');
  button.setAttribute('aria-label',square+(piece?' · '+pieceNames[piece.toLowerCase()]+' '+(piece===piece.toUpperCase()?'bianco':'nero'):' · vuota'));
  button.setAttribute('aria-disabled',String(!canMove()));
  if(piece)button.innerHTML=pieceSvg(piece);
  if(fi===0){const rank=document.createElement('span');rank.className='coord rank';rank.textContent=ranks[ri];button.append(rank)}
  if(ri===7){const file=document.createElement('span');file.className='coord file';file.textContent=files[fi];button.append(file)}
  button.onclick=()=>selectSquare(square,pieces);$('board').append(button);
 }
 $('board-hint').textContent=replayPly!==null?'Revisione · posizione '+replayPly+' / '+state.moves.length:state.phase==='waiting'?'In attesa del Nero':state.phase==='finished'?'Partita conclusa':mine<0?'Vista spettatore':canMove()?'Tocca un pezzo, poi la destinazione':'Attendi la mossa avversaria';
 renderMoveStrip();
}
function renderMoveStrip(){
 const strip=$('move-history'),atBottom=strip.scrollHeight-strip.scrollTop-strip.clientHeight<20;strip.replaceChildren();
 if(!state.moves.length)strip.textContent='Nessuna mossa.';
 for(let i=0;i<state.moves.length;i+=2){const span=document.createElement('span');span.textContent=(i/2+1)+'. '+state.moves[i].san+(state.moves[i+1]?' '+state.moves[i+1].san:'');if(replayPly!==null&&replayPly>i&&replayPly<=i+2)span.className='move-current';strip.append(span)}
 if(atBottom)strip.scrollTop=strip.scrollHeight;
 updateReplayControls();requestAnimationFrame(fitBoard);
}
function checkerSvg(piece){
 const side=piece===piece.toUpperCase()?'white':'black',crown=piece.toLowerCase()==='k';
 return '<svg viewBox="0 0 45 45" aria-hidden="true"><g fill="var(--'+side+'-piece)" stroke="var(--'+side+'-outline)" stroke-width="1.7"><ellipse cx="22.5" cy="25" rx="16" ry="15"/><circle cx="22.5" cy="21" r="16"/><circle cx="22.5" cy="21" r="11.8" fill="none" opacity=".65"/>'+(crown?'<path d="m14 18 3 8h11l3-8-6 4-2.5-7-2.5 7z"/><path d="M17 29h11" fill="none"/>':'<circle cx="22.5" cy="21" r="7" fill="none" opacity=".4"/>')+'</g></svg>';
}
const unoNames={red:'Rosso',yellow:'Giallo',green:'Verde',blue:'Blu'},unoSymbols={skip:'⊘',reverse:'⇄',draw2:'+2',wild:'✦',wild4:'+4'};
function unoCard(card,button=false){const el=document.createElement(button?'button':'div');el.className='uno-card '+(card.color||'wild');el.textContent=unoSymbols[card.value]||card.value;el.setAttribute('aria-label',(unoNames[card.color]||'Jolly')+' · '+(unoSymbols[card.value]||card.value));return el}
function renderUno(){
 const u=state.uno,mine=state.players.findIndex(p=>p.id===credentials.player),waiting=state.phase==='waiting',active=canMove();
 $('uno-message').textContent=waiting?state.players.length+'/10 giocatori · '+(mine===0?'Avvia quando siete pronti.':'Attendi che il creatore avvii.'):u.lastEvent;
 $('uno-top').replaceChildren(unoCard(u.top));$('uno-active-color').textContent=u.color?'Colore · '+unoNames[u.color]:'Scegli il colore iniziale';$('uno-active-color').dataset.color=u.color||'';
 $('uno-draw').hidden=waiting||mine<0||state.phase==='finished';$('uno-draw').disabled=!active||!u.canDraw;
 $('uno-pass').hidden=!active||!u.canPass;$('uno-color-row').hidden=mine<0||waiting||state.phase==='finished';
 $('uno-opening-color').hidden=!active||!u.chooseColor;
 $('uno-accept-four').hidden=$('uno-challenge-four').hidden=!active||!u.decidePenalty;
 $('uno-declare').hidden=busy||state.phase!=='playing'||!u.canDeclare;
 $('uno-catch').hidden=busy||state.phase!=='playing'||!u.canCatch;
 $('uno-call-option').hidden=!active||u.hand.length!==2||!u.legalMoves.length;
 $('uno-score').textContent=waiting?'':('Manche '+(u.round||1)+' · traguardo 500 · '+(u.scores||[]).map((points,i)=>state.players[i].name+' '+points).join(' · '));
 const revealed=$('uno-revealed');revealed.hidden=!u.shownHand?.length;revealed.replaceChildren(...(u.shownHand||[]).map(c=>unoCard(c)));
 const hand=$('uno-hand');hand.replaceChildren();
 if(mine<0||waiting){const p=document.createElement('p');p.className='hint';p.textContent=mine<0?'Le mani dei giocatori sono private.':'Sette carte a testa all’avvio.';hand.append(p)}
 else for(const c of u.hand){const b=unoCard(c,true);b.disabled=!active||!u.legalMoves.includes(c.id);b.onclick=()=>{const uno=u.hand.length===2&&$('uno-call-with-card').checked;$('uno-call-with-card').checked=false;sendMove({kind:'play',card:c.id,color:$('uno-color').value,uno,revision:state.revision})};hand.append(b)}
 const history=$('uno-history');history.replaceChildren();for(const m of state.moves.slice(-12).reverse()){const p=document.createElement('p');p.textContent=m.by+' · '+m.description;history.append(p)}
}
function renderConnect4(){
 const view=replayPly!==null&&replayFrames[replayPly]?replayFrames[replayPly]:state.connect4,board=$('board');
 board.setAttribute('aria-label','Forza 4 · sette colonne, sei righe');board.replaceChildren();$('cancel-capture').hidden=true;
 $('board-hint').textContent=state.phase==='waiting'?'In attesa del secondo giocatore':replayPly!==null?'Rivedi la partita':canMove()?'Scegli una colonna':state.phase==='finished'?view.reason||'Partita conclusa':'Quattro pedine in fila per vincere';
 for(let col=0;col<7;col++){const button=document.createElement('button');button.className='connect4-column';button.disabled=!canMove()||!view.legalMoves.includes(col);button.setAttribute('aria-label','Colonna '+(col+1)+(view.board[col]!==null?' · piena':''));
 for(let row=0;row<6;row++){const i=row*7+col,disc=document.createElement('span');disc.className='connect4-disc'+(view.board[i]===0?' red':view.board[i]===1?' yellow':'')+(view.winning?.includes(i)?' winning':'')+(view.lastMove?.row===row&&view.lastMove.column===col?' latest':'');disc.setAttribute('aria-hidden','true');button.append(disc)}
 button.onclick=()=>sendMove({column:col,revision:state.revision});board.append(button)}
 updateReplayControls();requestAnimationFrame(fitBoard);
}
function matchingCaptures(){return (state.checkers.legalMoves||[]).filter(m=>capturePath.every((s,i)=>m.path[i]===s))}
function renderCheckersBoard(){
 const view=replayPly!==null&&replayFrames[replayPly]?{...state.checkers,...replayFrames[replayPly],legalMoves:[]}:state.checkers;
 const mine=state.players.findIndex(p=>p.id===credentials.player),flipped=boardFlipped===null?mine===1:boardFlipped;
 const files=flipped?'hgfedcba':'abcdefgh',ranks=flipped?'12345678':'87654321',pieces={...view.board};
 const matches=capturePath.length?matchingCaptures():[],targets=matches.map(m=>m.path[capturePath.length]).filter(Boolean);
 if(capturePath.length>1){
  const mover=pieces[capturePath[0]];delete pieces[capturePath[0]];
  for(let i=1;i<capturePath.length;i++){const a=capturePath[i-1],b=capturePath[i];if(Math.abs(Number(a[1])-Number(b[1]))===2){const x=('abcdefgh'.indexOf(a[0])+'abcdefgh'.indexOf(b[0]))/2;delete pieces['abcdefgh'[x]+((Number(a[1])+Number(b[1]))/2)]}}
  pieces[capturePath.at(-1)]=mover;
 }
 $('board').replaceChildren();
 for(let ri=0;ri<8;ri++)for(let fi=0;fi<8;fi++){
  const square=files[fi]+ranks[ri],piece=pieces[square],dark=('abcdefgh'.indexOf(square[0])+Number(square[1]))%2===0;
  const button=document.createElement('button');button.className='square'+(dark?' dark':'')+(piece?' occupied':'')+(selectedSquare===square?' selected':'')+(targets.includes(square)?' target':'')+(capturePath.includes(square)?' path-step':'')+([view.lastMove?.from,view.lastMove?.to].includes(square)?' last':'');
  const number=(8-Number(square[1]))*4+Math.floor('abcdefgh'.indexOf(square[0])/2)+1;
  button.setAttribute('aria-label',(dark?'Casella '+number:square)+(piece?' · '+(piece.toLowerCase()==='k'?'dama':'pedina')+' '+(piece===piece.toUpperCase()?'bianca':'nera'):' · vuota'));
  button.setAttribute('aria-disabled',String(!dark||!canMove()));
  if(piece)button.innerHTML=checkerSvg(piece);
  button.onclick=()=>selectChecker(square);$('board').append(button);
 }
 const capture=state.checkers.legalMoves?.some(m=>m.captures.length);
 $('cancel-capture').hidden=!canMove()||capturePath.length<2;
 $('board-hint').textContent=replayPly!==null?'Revisione · '+replayPly+' / '+state.moves.length:state.phase==='waiting'?'Dama italiana · in attesa del Nero':state.phase==='finished'?'Dama italiana · partita conclusa':mine<0?'Dama italiana · vista spettatore':!canMove()?'Attendi la mossa avversaria':capturePath.length>1?'Continua la presa: tocca il prossimo salto':capture?'Presa obbligatoria · segui le caselle evidenziate':'Tocca una pedina, poi la destinazione';
 renderMoveStrip();
}
function selectChecker(square){
 if(!canMove())return;
 if(capturePath.length){
  const next=matchingCaptures().filter(m=>m.path[capturePath.length]===square);
  if(next.length){
   capturePath.push(square);selectedSquare=square;
   const complete=next.find(m=>m.path.length===capturePath.length);
   if(complete){sendMove({path:[...capturePath],revision:state.revision});return}
   renderBoard();return;
  }
  if(capturePath.length>1)return;
 }
 const playable=state.checkers.legalMoves.some(m=>m.path[0]===square);
 capturePath=playable&&selectedSquare!==square?[square]:[];selectedSquare=capturePath[0]||null;renderBoard();
}
$('cancel-capture').onclick=()=>{capturePath=[];selectedSquare=null;renderBoard()};

function fitBoard(){
 if($('board'))$('board').style.width='100%';
}
function selectSquare(square,pieces){
 if(!canMove()||promotionMove)return;
 const candidates=(state.chess.legalMoves||[]).filter(m=>m.from===selectedSquare&&m.to===square);
 if(candidates.length){
  if(candidates.some(m=>m.promotion)){promotionMove={from:selectedSquare,to:square,revision:state.revision};$('promotion').hidden=false;return}
  sendMove({from:selectedSquare,to:square,revision:state.revision});return;
 }
 const piece=pieces[square],white=piece&&piece===piece.toUpperCase();
 selectedSquare=piece&&white===(state.turn===0)&&square!==selectedSquare?square:null;renderBoard();
}
async function sendMove(move){
 const unoCall=state?.phase==='playing'&&!busy&&!state.archived&&replayPly===null&&(move.kind==='uno'&&state.uno?.canDeclare||move.kind==='catch-uno'&&state.uno?.canCatch);
 if(!canMove()&&!unoCall)return;
 busy=true;capturePath=[];selectedSquare=null;promotionMove=null;$('promotion').hidden=true;renderBoard();trace('MOVE',move.kind|| (move.path?move.path.join(' → '):move.from+' → '+move.to+(move.promotion?' = '+move.promotion:'')));
 const current=room;
 try{const result=await api('move',move);if(room===current)render(result)}
 catch(e){err(e.message);if(room===current)try{render(await api('state'))}catch{}}
 finally{busy=false;if(room===current&&state)render(state)}
}
$('flip-board').onclick=()=>{const mine=state.players.findIndex(p=>p.id===credentials.player);boardFlipped=!(boardFlipped===null?mine===1:boardFlipped);renderBoard()};
document.querySelectorAll('[data-promotion]').forEach(button=>button.onclick=()=>{if(promotionMove)sendMove({...promotionMove,promotion:button.dataset.promotion})});
$('cancel-promotion').onclick=()=>{promotionMove=null;$('promotion').hidden=true};
function applyBoardTheme(theme){
 if(!['classic','forest','walnut','blue','plum','graphite'].includes(theme))theme='classic';
 document.documentElement.dataset.board=theme;
 document.querySelectorAll('[data-board-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.boardChoice===theme)));
}
applyBoardTheme(read('checkmate-board','classic'));
document.querySelectorAll('[data-board-choice]').forEach(button=>button.onclick=()=>{applyBoardTheme(button.dataset.boardChoice);try{save('checkmate-board',button.dataset.boardChoice);trace('UI','Scacchiera '+button.dataset.boardChoice)}catch(e){err(e.message)}});
$('clear-terminal').onclick=()=>{events.length=0;$('terminal').textContent='';trace('INFO','Registro pulito')};
$('copy-terminal').onclick=async()=>{try{await navigator.clipboard.writeText(events.join('\n'));$('debug-result').textContent='Log copiato.'}catch{$('debug-result').textContent='Copia non disponibile: puoi selezionare il testo del registro.'}};
window.addEventListener('error',event=>trace('ERROR',event.message||'Errore JavaScript'));
window.addEventListener('unhandledrejection',event=>trace('ERROR',event.reason?.message||'Operazione non completata'));

function renderArchive(){
 $('archive-games').replaceChildren();
 const archived=games.filter(g=>g.archived);$('archive-empty').hidden=archived.length>0;
 for(const game of archived){
  const article=document.createElement('article');article.className='archive-row';
  const heading=document.createElement('strong');heading.textContent='Partita '+game.number+' · '+gameTitle(game);
  const names=document.createElement('p');names.textContent=game.arenaResult?(game.arenaResult.winner?'Vincitore: '+game.arenaResult.winner.name:'Nessun superstite'):game.players.map(p=>p.name).join(' · ');
  const button=document.createElement('button');button.className='alt';button.textContent=game.game==='labyrinth'?'Apri spedizione':staged(game)?'Apri storico pubblico':'Apri e rivedi le mosse';
  button.onclick=async()=>{await openRoom(game.room,game.game==='labyrinth');if(room===game.room)selectPage('game')};
  article.append(heading,names,button);$('archive-games').append(article);
 }
}
function stopReplay(){
 clearTimeout(replayTimer);replayTimer=null;
 if($('replay-play')){$('replay-play').textContent='▶';$('replay-play').setAttribute('aria-label','Riproduci mosse')}
}
async function loadReplay(){
 replayLoading=true;const selected=room,epoch=roomEpoch,revision=state.revision;
 try{
  const data=await api('replay');
  if(selected!==room||epoch!==roomEpoch||state?.revision!==revision)return;
  replayFrames=data.frames;replayRevision=revision;
  replayPly=replayFrames.length?(state.archived?0:replayFrames.length-1):null;
  trace('REPLAY',replayFrames.length+' posizioni caricate');renderBoard();
 }catch(e){if(selected===room&&epoch===roomEpoch)err(e.message)}
 finally{if(selected===room&&epoch===roomEpoch)replayLoading=false}
}
function updateReplayControls(){
 const last=Math.max(0,replayFrames.length-1),ply=replayPly??0;
 $('replay-slider').max=String(last);$('replay-slider').value=String(ply);
 $('replay-position').textContent=ply+' / '+last;
 for(const id of ['replay-first','replay-prev'])$(id).disabled=!replayFrames.length||ply===0;
 for(const id of ['replay-last','replay-next'])$(id).disabled=!replayFrames.length||ply===last;
 $('replay-play').disabled=last===0;$('replay-slider').disabled=last===0;
}
function seekReplay(ply,manual=true){
 if(!replayFrames.length)return;if(manual)stopReplay();
 replayPly=Math.max(0,Math.min(replayFrames.length-1,Number(ply)));
 capturePath=[];selectedSquare=null;renderBoard();
}
function replayStep(){
 if(replayPly>=replayFrames.length-1){stopReplay();return}
 seekReplay(replayPly+1,false);replayTimer=setTimeout(replayStep,850);
}
$('replay-first').onclick=()=>seekReplay(0);
$('replay-prev').onclick=()=>seekReplay((replayPly??0)-1);
$('replay-next').onclick=()=>seekReplay((replayPly??0)+1);
$('replay-last').onclick=()=>seekReplay(replayFrames.length-1);
$('replay-slider').oninput=event=>seekReplay(event.target.value);
$('replay-play').onclick=()=>{
 if(replayTimer){stopReplay();return}
 if(!replayFrames.length)return;
 if(replayPly===replayFrames.length-1)seekReplay(0);
 $('replay-play').textContent='Ⅱ';$('replay-play').setAttribute('aria-label','Pausa');
 replayTimer=setTimeout(replayStep,850);
};
async function archiveTable(){
 if(state.phase!=='finished'&&!confirm('Archiviare questa partita? Verrà conclusa e spostata in Debug.'))return;
 stopReplay();render(await api('archive',{revision:state.revision}));
 const result=await request('/api/lobby');games=result.games;renderLobby();
 trace('ARCHIVE','Partita archiviata');
}
action('archive-game',archiveTable);
action('keep-table',archiveTable);
action('delete-game',async()=>{
 if(!confirm('Eliminare definitivamente questa partita e tutte le sue mosse per tutti?'))return;
 await api('delete',{revision:state.revision});showLobby();
 const result=await request('/api/lobby');games=result.games;renderLobby();trace('DELETE','Partita eliminata');
});


$('chess-claim-draw').onclick=()=>{
 const move=state.chess.claim?undefined:state.chess.claimMoves[Number($('chess-claim-move').value)];
 sendMove({kind:'claim-draw',move,revision:state.revision});
};
$('offer-draw').onclick=()=>{$('draw-dialog').hidden=false;$('confirm-draw').focus()};
$('cancel-draw').onclick=()=>{$('draw-dialog').hidden=true;$('offer-draw').focus()};
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('draw-dialog').hidden){$('draw-dialog').hidden=true;$('offer-draw').focus()}});
action('confirm-draw',async()=>{const revision=state.revision;render(await api('offer-draw',{revision}));$('draw-dialog').hidden=true});
action('accept-draw',async()=>render(await api('accept-draw',{revision:state.revision})));
action('reject-draw',async()=>render(await api('reject-draw',{revision:state.revision})));

window.addEventListener('keydown',event=>{
 if(event.key!=='Tab')return;
 const modal=!$('draw-response').hidden?$('draw-response'):!$('draw-dialog').hidden?$('draw-dialog'):null;
 if(!modal)return;
 const buttons=[...modal.querySelectorAll('button')].filter(button=>!button.hidden&&!button.disabled);
 if(!buttons.length){event.preventDefault();return}
 const first=buttons[0],last=buttons[buttons.length-1],active=document.activeElement;
 if(event.shiftKey&&(active===first||!modal.contains(active))){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&(active===last||!modal.contains(active))){event.preventDefault();first.focus()}
});

function applyPieceTheme(theme){
 if(!['classic','forest','walnut','blue','plum','graphite'].includes(theme))theme='classic';
 document.documentElement.dataset.pieces=theme;
 document.querySelectorAll('[data-piece-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.pieceChoice===theme)));
}
applyPieceTheme(read('checkmate-pieces','classic'));
document.querySelectorAll('[data-piece-choice]').forEach(button=>button.onclick=()=>{applyPieceTheme(button.dataset.pieceChoice);try{save('checkmate-pieces',button.dataset.pieceChoice)}catch(e){err(e.message)}});

trace('BOOT','Binottoland 1.1 · registro sessione attivo');



function enterFullscreen(){try{if(tg?.requestFullscreen&&!tg.isFullscreen)tg.requestFullscreen()}catch{}}
async function startSession(){
 enterFullscreen();
 $('access-retry').hidden=true;$('access-error').textContent='Collegamento a Telegram…';
 try{
  if(!tg?.initData)throw Error('Apri questa Mini App da @checkmategame_bot per usare il tuo account Telegram.');
  const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Accesso non riuscito.');
  identity=data.user;sessionToken=data.token;$('name').textContent=identity.name;renderProfile();$('auth-notice').hidden=true;
  trace('AUTH','Identità Telegram verificata');
  const payload=await request('/api/lobby');games=payload.games;onlineUsers=payload.users||[];chatMessages=payload.messages||[];renderLeaders(payload);
  renderLobby();$('access-error').textContent='';$('club-gate').hidden=true;$('app-shell').hidden=false;connectLobby();
 }catch(e){$('club-gate').hidden=false;$('app-shell').hidden=true;$('access-error').textContent=e.message;$('access-retry').hidden=!tg?.initData;$('access-telegram').hidden=false;trace('AUTH','Accesso non completato')}
}
function sendPresence(away=document.hidden){
 if(lobbyWS?.readyState===1)lobbyWS.send(JSON.stringify({type:'presence',room:motoRace?.room||labyrinthRoom||room,away}));
}

function renderSpectators(){
 const output=$('spectators');if(!output)return;
 if(!state||!room||(!boardState())){output.hidden=true;return}
 output.hidden=false;
 if(lobbyWS?.readyState!==1){output.textContent='Spettatori · collegamento…';return}
 const seated=new Set(state.players.map(p=>p.id)),seen=new Set(),watchers=onlineUsers.filter(u=>u.viewingRoom===room&&!seated.has(u.player)&&!seen.has(u.id)&&seen.add(u.id));
 // Include the local spectator immediately, before its presence round trip.
 if(identity&&!document.hidden&&!seated.has(identity.player)&&!seen.has(identity.id))watchers.push(identity);
 output.textContent=watchers.length?(watchers.length===1?'Assiste':'Assistono')+' · '+watchers.map(u=>u.name+(u.id===identity?.id?' (tu)':'')).join(', '):'Nessuno spettatore';
}
function scrollChatToLatest(){
 requestAnimationFrame(()=>{
  const list=$('chat-messages');
  list.scrollTop=list.scrollHeight;
 });
}
function renderSocial(){
 renderSpectators();
 const connected=lobbyWS?.readyState===1&&!document.hidden;
 const users=onlineUsers.slice();
 if(connected&&identity&&!users.some(user=>user.id===identity.id)){
  const own=ownedGame();users.unshift({...identity,status:own?'In partita '+own.number:'In Lobby',game:own?.room||null});
 }
 $('online-count').textContent=connected?users.length+' online':identity?'Collegamento…':'Accedi da Telegram';$('online-users').replaceChildren();
 for(const user of users){
  const row=document.createElement('div');row.className='online-user';row.append(makeAvatar(user));
  const copy=document.createElement('div');copy.className='online-person';
  const label=document.createElement('span');label.textContent=user.name+(user.id===identity?.id?' · tu':'');
  const status=document.createElement('small');status.textContent=user.status;copy.append(label,status);row.append(copy);
  if(user.game){const button=document.createElement('button');button.className='alt';button.textContent='Guarda';button.onclick=()=>openRoom(user.game,true);row.append(button)}
  else{const dot=document.createElement('i');dot.className='presence-dot';row.append(dot)}
  $('online-users').append(row);
 }
 const list=$('chat-messages');
 const signature=chatMessages.map(m=>m.id).join(',');
 if(list.dataset.signature!==signature){
  list.dataset.signature=signature;list.replaceChildren();
  if(!chatMessages.length){const p=document.createElement('p');p.className='hint';p.textContent='Il posto per due parole tra una partita e l’altra.';list.append(p)}
  for(const message of chatMessages){
   const row=document.createElement('article');row.className='chat-message'+(message.userId===identity?.id?' mine':'');
   row.append(makeAvatar(message));
   const copy=document.createElement('div');copy.className='chat-copy';
   const header=document.createElement('small');header.textContent=message.name+' · '+new Date(message.at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
   const text=document.createElement('p');text.textContent=message.text;copy.append(header,text);row.append(copy);list.append(row);
  }
  scrollChatToLatest();
 }
 $('chat-send').disabled=chatSending||!identity||!connected;
}

$('chat-form').onsubmit=async event=>{
 event.preventDefault();if(chatSending)return;const input=$('chat-input'),text=input.value.trim();if(!text)return;chatSending=true;
 $('chat-send').disabled=true;
 try{const result=await request('/api/chat',{text});if(result.message&&!chatMessages.some(m=>m.id===result.message.id))chatMessages=[...chatMessages,result.message].slice(-100);if(input.value.trim()===text)input.value='';err('');renderSocial();$('chat-messages').scrollTop=$('chat-messages').scrollHeight}catch(e){err(e.message)}finally{chatSending=false;renderSocial()}
};
setInterval(()=>{if(!document.hidden)sendPresence()},25000);
window.addEventListener('pagehide',event=>{if(!event.persisted)discardResult(true);sendPresence(true);lobbyWS?.close()});






window.binottolandRadioMetadata=stationId=>request('/api/radio/now-playing?station='+encodeURIComponent(stationId));



// Authenticated multiplayer transport stays in this container, never in the iframe.
const labyrinthOverlay=$('labyrinth-overlay'),labyrinthFrame=$('labyrinth-frame');
function labPost(data){if(!labyrinthOverlay.hidden)labyrinthFrame.contentWindow?.postMessage(data,location.origin)}
function connectExpedition(){
 if(!labyrinthRoom||!sessionToken)return;clearTimeout(labyrinthRetry);if(labyrinthSocket){labyrinthSocket.onclose=null;labyrinthSocket.close()}
 const selected=labyrinthRoom,socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/labyrinth/'+selected+'/ws'+(labyrinthWatch?'?watch=1':''),['checkmate',sessionToken]);labyrinthSocket=socket;
 socket.onopen=()=>{if(selected!==labyrinthRoom)return;labPost({type:'labyrinth:connection',connected:true});clearInterval(labyrinthBeat);labyrinthBeat=setInterval(()=>{if(socket.readyState===1)socket.send(JSON.stringify({type:'heartbeat'}))},10000);sendPresence()};
 socket.onmessage=e=>{if(selected!==labyrinthRoom)return;try{const packet=JSON.parse(e.data);if(packet.type==='state'){labyrinthLastState=packet.state;if(packet.state.deleted){closeLabyrinth();err('Spedizione eliminata.');return}}labPost({type:'labyrinth:packet',packet})}catch{trace('LAB','Pacchetto non valido')}};
 socket.onclose=e=>{if(selected!==labyrinthRoom)return;clearInterval(labyrinthBeat);labPost({type:'labyrinth:connection',connected:false});if(e.code===4000||e.code===4001){labPost({type:'labyrinth:notice',message:e.code===4000?'Spedizione aperta in un’altra finestra.':'Riapri Binottoland per accedere.'});return}labyrinthRetry=setTimeout(connectExpedition,2500)};
}
async function openLabyrinth(selected,watch=false){
 if(!identity||labyrinthOpening)return;labyrinthOpening=true;
 try{const result=await request('/api/labyrinth/'+selected+(watch?'/state':'/join'),watch?undefined:{});stopRoom();room=null;state=null;labyrinthRoom=selected;labyrinthWatch=watch;labyrinthLastState=result.state;$('draw-dialog').hidden=true;$('draw-response').hidden=true;enterFullscreen();try{tg?.disableVerticalSwipes?.()}catch{}labyrinthOverlay.hidden=false;labyrinthFrame.src='/labyrinth/index.html?multiplayer=1&v=arena2';tg?.BackButton?.show();connectExpedition();trace('LAB','Spedizione '+result.state.number+(watch?' · spettatore':''));sendPresence()}
 catch(e){err(e.message)}finally{labyrinthOpening=false}
}
$('play-labyrinth').onclick=async()=>{if(!identity||labyrinthOpening)return;$('play-labyrinth').disabled=true;try{const result=await request('/api/create',{game:'labyrinth'});await openLabyrinth(result.state.room,false)}catch(e){err(e.message)}finally{$('play-labyrinth').disabled=false}};
function closeLabyrinth(){
 if(labyrinthOverlay.hidden)return;
 clearTimeout(labyrinthRetry);clearInterval(labyrinthBeat);if(labyrinthSocket){labyrinthSocket.onclose=null;labyrinthSocket.close();labyrinthSocket=null}labyrinthRoom=null;labyrinthLastState=null;try{tg?.enableVerticalSwipes?.()}catch{}
 labyrinthOverlay.hidden=true;labyrinthFrame.src='about:blank';sendPresence();tg?.BackButton?.hide();
 $('play-labyrinth').focus();trace('LAB','Ritorno a Binottoland');
}
function sendLabyrinthIdentity(){if(!labyrinthOverlay.hidden){labPost({type:'labyrinth:insets',insets:safeInsets(tg)});if(identity&&!labyrinthRoom)labPost({type:'labyrinth:identity',player:identity.id})}if(!labyrinthOverlay.hidden&&identity&&labyrinthRoom){labPost({type:'labyrinth:insets',insets:safeInsets(tg)});labPost({type:'labyrinth:multiplayer',room:labyrinthRoom,player:identity.id,watch:labyrinthWatch,state:labyrinthLastState});labPost({type:'labyrinth:connection',connected:labyrinthSocket?.readyState===1})}}
labyrinthFrame.addEventListener('load',sendLabyrinthIdentity);
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==labyrinthFrame.contentWindow||labyrinthOverlay.hidden)return;
 if(event.data?.type==='labyrinth:ready')sendLabyrinthIdentity();
 else if(event.data?.type==='labyrinth:net'){const packet=event.data.packet;if(packet&&['pose','action'].includes(packet.type)&&JSON.stringify(packet).length<=2048){if(labyrinthSocket?.readyState===1)labyrinthSocket.send(JSON.stringify(packet));else if(packet.type==='action')labPost({type:'labyrinth:packet',packet:{type:'ack',request:packet.request,ok:false,error:'Riconnessione in corso.'}})}}
 else if(event.data?.type==='labyrinth:exit')closeLabyrinth();
 else if(event.data?.type==='labyrinth:archive'&&labyrinthRoom&&!labyrinthWatch&&labyrinthLastState?.arenaResult&&!labyrinthLastState.archived){
  request('/api/labyrinth/'+labyrinthRoom+'/archive',{}).catch(error=>labPost({type:'labyrinth:notice',message:error.message}));
 }

 else if(event.data?.type==='labyrinth:trace'&&typeof event.data.message==='string')trace('LAB',event.data.message.slice(0,200));
});
function sendMotoInsets(insets=safeInsets(tg)){
 if(!$('moto-trial-overlay').hidden)$('moto-trial-frame').contentWindow?.postMessage({type:'moto-trial:insets',insets},location.origin);
}
const motoOverlay=$('moto-trial-overlay'),motoFrame=$('moto-trial-frame'),motoLaunch=$('play-moto-trial');
function motoPost(type,payload={}){
 if(!motoOverlay.hidden)motoFrame.contentWindow?.postMessage({type:'moto-trial:'+type,...payload},location.origin);
}
function sendMotoState(){
 sendMotoInsets();
 if(motoRace)motoPost('state',{state:motoRace,player:identity.player,connected:motoSocket?.readyState===1});
}
function closeMotoTrial(){
 if(motoOverlay.hidden)return;
 clearTimeout(motoRetry);clearInterval(motoBeat);
 if(motoSocket){motoSocket.onclose=null;motoSocket.close();motoSocket=null}
 const wasRace=!!motoRace;motoRace=null;
 motoOverlay.hidden=true;motoFrame.src='about:blank';
 tg?.BackButton?.hide();
 try{tg?.enableVerticalSwipes?.()}catch{}
 if(wasRace){sendPresence();$('create-moto-trial').focus()}else motoLaunch.focus();
}
function showMotoTrial(multiplayer=false){
 enterFullscreen();
 try{tg?.disableVerticalSwipes?.()}catch{}
 motoOverlay.hidden=false;
 motoFrame.src='/moto-trial/index.html'+(multiplayer?'?multiplayer=1&v=6':'?v=6');
 tg?.BackButton?.show();
}
function connectMotoRace(){
 if(!motoRace||!sessionToken)return;
 const selected=motoRace.room;
 const socket=motoSocket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/moto-trial/'+selected+'/ws',['checkmate',sessionToken]);
 socket.onopen=()=>{
  if(socket!==motoSocket)return;
  sendMotoState();
  motoBeat=setInterval(()=>{if(socket.readyState===1)socket.send('{"type":"heartbeat"}')},15000);
 };
 socket.onmessage=event=>{
  if(socket!==motoSocket)return;
  try{
   const packet=JSON.parse(event.data);
   if(packet.type==='state'){motoRace=packet.state;sendMotoState()}
   else if(packet.type==='pose'){
    const member=motoRace.players.find(p=>p.id===packet.id);
    if(member)member.pose=packet.pose;
    motoPost('pose',{id:packet.id,pose:packet.pose});
   }
  }catch{}
 };
 socket.onclose=async event=>{
  if(socket!==motoSocket)return;
  clearInterval(motoBeat);motoPost('connection',{connected:false});
  if(event.code===4000||event.code===4001){
   closeMotoTrial();err(event.code===4000?'Corsa aperta in un’altra finestra.':'Riapri Binottoland da Telegram.');return;
  }
  try{
   const {state}=await request('/api/moto-trial/'+selected+'/state');
   if(socket!==motoSocket)return;
   if(state.players.length>=8&&!state.players.some(p=>p.id===identity.player)){
    closeMotoTrial();err('Corsa al completo.');return;
   }
  }catch(e){
   if(socket!==motoSocket)return;
   if(e.status===404){closeMotoTrial();err(e.message);return}
  }
  motoRetry=setTimeout(connectMotoRace,2400);
 };
}
async function openMotoRace(selected){
 if(!identity||motoOpening||!motoOverlay.hidden)return;
 motoOpening=true;$('create-moto-trial').disabled=true;
 try{
  const {state}=selected?await request('/api/moto-trial/'+selected+'/state'):await request('/api/create',{game:'moto-trial'});
  if(state.players.length>=8&&!state.players.some(p=>p.id===identity.player))throw Error('Corsa al completo.');
  motoRace=state;showMotoTrial(true);connectMotoRace();sendPresence();
 }catch(e){err(e.message)}finally{motoOpening=false;$('create-moto-trial').disabled=!identity}
}
motoLaunch.onclick=()=>{if(motoOverlay.hidden&&!motoOpening)showMotoTrial()};
$('create-moto-trial').onclick=()=>openMotoRace();
motoFrame.addEventListener('load',sendMotoState);
window.addEventListener('message',event=>{
 if(motoOverlay.hidden||event.origin!==location.origin||event.source!==motoFrame.contentWindow)return;
 const data=event.data;
 if(data?.type==='moto-trial:ready')sendMotoState();
 else if(data?.type==='moto-trial:exit')closeMotoTrial();
 else if(data?.type==='moto-trial:pose'&&motoSocket?.readyState===1&&motoSocket.bufferedAmount<16000){
  const packet=JSON.stringify(data.packet);
  if(packet?.length<=420)motoSocket.send(packet);
 }
});
tg?.onEvent('backButtonClicked',()=>{if(!motoOverlay.hidden)closeMotoTrial();else closeLabyrinth()});

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&labyrinthSocket?.readyState===1)labyrinthSocket.send(JSON.stringify({type:'heartbeat'}))});

function renderTutorial(s){const box=$('tutorial-panel'),hint=s.tutorial;box.hidden=!hint;if(!hint)return;$('tutorial-title').textContent=hint.title;$('tutorial-text').textContent=hint.text;$('tutorial-reason').textContent=hint.reason;$('tutorial-move').hidden=!hint.action;$('tutorial-move').disabled=busy;$('tutorial-move').onclick=()=>sendMove({...hint.action,revision:state.revision});}
let leaderBusy=false;
function paintLeaders(kind,rows){
 const list=$('leaderboard-'+kind);
 list.replaceChildren();
 for(const [index,row] of rows.slice(0,5).entries()){
  const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('p');
  title.textContent=(index+1)+'. '+row.name+' · '+row.wins+' '+(row.wins===1?'vittoria':'vittorie');
  detail.className='hint';
  detail.textContent=Object.entries(row.games).sort((a,b)=>b[1]-a[1]).map(([game,n])=>gameTitle({game})+' '+n).join(' · ');
  item.append(title,detail);list.append(item);
 }
 $('leaderboard-'+kind+'-empty').hidden=rows.length>0;
}
function renderLeaders(data){
 paintLeaders('solo',data.aiLeaderboard||[]);
 paintLeaders('multi',data.leaderboard||[]);
}
async function loadLeaders(){
 if(!sessionToken||leaderBusy)return;
 leaderBusy=true;
 try{
  let data;
  do{
   data=await request('/api/leaderboard?mode=both');
   renderLeaders(data);
  }while(data.pending);
 }catch(e){err(e.message)}finally{leaderBusy=false}
}
$('solo-labyrinth').onclick=()=>{enterFullscreen();labyrinthOverlay.hidden=false;labyrinthFrame.src='/labyrinth/index.html?v=arena2';tg?.BackButton?.show()};
$('tutorial-labyrinth').onclick=()=>{enterFullscreen();labyrinthOverlay.hidden=false;labyrinthFrame.src='/labyrinth/index.html?tutorial=1&v=arena2';tg?.BackButton?.show()};

$('access-retry').onclick=startSession;
startSession();
