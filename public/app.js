import {blackboardLink} from './blackboard/link.js?v=ed710cda29';
import {renderScopa} from './scopa-ui.js';
import {renderNaval,renderBriscola} from './sea-cards-ui.js';
import {renderScarabeo} from './board-games-ui.js';
import {safeInsets,applyInsets,viewportHeight} from './safe-area.js';
import {CAMPAIGNS,campaignInfo,DEFAULT_CAMPAIGN} from './golf/courses.js?v=4b40a70e69';
import {golfColors,readAppearance} from './appearance.js?v=3bf8d2e2ca';
import './labyrinth/avatar.js?v=5318415024';
import {initCatalog,renderCatalog} from './games-catalog.js?v=450d7363f6';
import {installSwipe} from './swipe.js?v=1e6e396f97';
import {initWindowMode} from './window-mode.js?v=4861da0434';
import {pref,setPref,read,save} from './prefs.js?v=bd123656a4';
import {events,trace,initDebugLog} from './debug-log.js?v=938d711947';
import {gameTitle,staged,gameLimits,ongoing} from './game-info.js?v=2f8dbeba94';
import {pieceNames,pieceSvg,position,checkerSvg,unoNames,unoSymbols,unoCard} from './pieces.js?v=fa35e21be7';
import {initThemes} from './themes.js?v=b6682dff0c';
import {initSettings} from './settings.js?v=64a501b9f0';
import {renderLeaders,renderNumberLeaders,createLeaderboardLoader} from './leaderboard.js?v=6ae06cf3ca';
import {createCinemaLobby} from './cinema-lobby.js?v=e593ea3a15';
import {makeAvatar} from './avatar.js?v=7a059821b4';
import {createChat} from './chat.js?v=532b8aadbd';
import {renderUno as renderUnoTable} from './uno-ui.js?v=1ab74ee73d';
import {renderConnect4 as drawConnect4} from './connect4-ui.js?v=5be07b8991';
import {createChessBoard} from './chess-board.js?v=f92d78d981';
const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
if(tg?.platform==='android')document.documentElement.dataset.telegramPlatform='android';
// Version shown in Informazioni, Debug and problem reports. Increase it at every release.
const APP_VERSION='1.0.17',APP_NAME='Binottoland Playground '+APP_VERSION;
const $=id=>document.getElementById(id);
// Cinema rooms, socket and iframe (see cinema-lobby.js). Dependencies are wrapped: some are defined further down.
const cinema=createCinemaLobby({tg,token:()=>sessionToken,readAppearance,safeInsets,enterFullscreen:()=>enterFullscreen(),leaveRoom:()=>leaveRoom(),selectPage:page=>selectPage(page),renderNow:()=>renderNow()});
const chat=createChat({me:()=>identity,request,onError:err,refresh:()=>renderSocial()});
const board=createChessBoard({get:()=>({state,mine:state.players.findIndex(p=>p.id===credentials.player),active:canMove(),replayPly,frame:replayPly!==null&&replayFrames[replayPly]?replayFrames[replayPly]:null}),send:move=>sendMove(move),rerender:()=>renderBoard()});
initCatalog();
let golfRoom=null,golfSnapshot=null,golfPending=false,golfPolling=false,golfSync=0;
let motoRace=null,motoSocket=null,motoOpening=false,motoRetry=0,motoBeat=0;
let pongRoom=null,pongSocket=null,pongRetry=0,pongEpoch=0,pongOpening=false;
let labyrinthRoom=null,labyrinthWatch=false,labyrinthSocket=null,labyrinthLastState=null,labyrinthRetry=0,labyrinthBeat=0,labyrinthOpening=false;
let blackboardLobbyRooms=[],simSummary=null,simSummaryAt=0;
// Binotto Simulator summary for "Adesso": at most once a minute, only with the Lobby visible.
async function loadSimSummary(force=false){
 if(!identity||!sessionToken||document.hidden||(!force&&Date.now()-simSummaryAt<60000))return;
 simSummaryAt=Date.now();
 try{simSummary=await request('/api/simulator/summary');renderNow()}catch{}
}
setInterval(()=>{if(!$('page-game')?.hidden)loadSimSummary()},15000);
let sessionRefresh=null;
async function refreshSession(){if(!sessionToken)return;if(sessionRefresh)return sessionRefresh;const payload=JSON.parse(atob(sessionToken.split('.')[1].replaceAll('-','+').replaceAll('_','/')));if(payload.expires>Date.now()+3600000)return;sessionRefresh=(async()=>{const r=await fetch('/api/session/refresh',{method:'POST',headers:{Authorization:'Bearer '+sessionToken}});const value=await r.json();if(!r.ok)throw Error(value.error);sessionToken=value.token;})().finally(()=>sessionRefresh=null);return sessionRefresh;}
setInterval(()=>refreshSession().catch(e=>err(e.message)),60000);
let sessionToken='',identity=null,onlineUsers=[];
function seat(id){const old=read('binotto-'+id,{});return identity?{...old,player:identity.player}:old}
let replayFrames=[],replayPly=null,replayTimer=null,replayRevision=null,replayLoading=false;
let room=null,state=null,ws=null,retry=null,busy=false,credentials={},games=[],lobbyWS=null,lobbyRetry=null,roomEpoch=0;
$('name').textContent='Accesso Telegram…';
history.replaceState(null,'',location.pathname);
function err(s){$('error').textContent=s;if(s)trace('ERROR',s)}
async function request(path,data,keepalive=false){
 if(!sessionToken)throw Error('Apri Binottoland da Telegram per accedere.');
 await refreshSession();
 const started=performance.now();trace('HTTP',(data?'POST ':'GET ')+path);
 try{
  const response=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken,'X-Player-Token':credentials.token||''},...(data?{body:JSON.stringify(data)}:{}),keepalive,signal:AbortSignal.timeout(15000)});
  const result=await response.json();trace(response.ok?'OK':'ERROR',response.status+' '+path+' · '+Math.round(performance.now()-started)+' ms');
  if(!response.ok)throw Object.assign(Error(result.error||'Errore server'),{status:response.status});return result;
 }catch(error){trace('ERROR',error.message);throw error}
}
function api(action,data){return request(action==='create'?'/api/create':'/api/room/'+room+'/'+action,data)}
const boardState=()=>state?.naval||state?.briscola||state?.scarabeo||state?.scopa||state?.uno||state?.connect4||state?.checkers||state?.chess;
function ownedGame(){return games.find(g=>g.game!=='golf'&&g.game!=='labyrinth'&&g.game!=='moto-trial'&&g.game!=='pong'&&ongoing(g)&&g.players.some(p=>p.id===seat(g.room).player))}

function renderProfile(){
 const node=$('profile-avatar'),avatar=makeAvatar(identity||{name:'?'});node.replaceChildren(...avatar.childNodes);
 $('profile-username').textContent=identity?.username?'@'+identity.username:identity?'Account Telegram':'';
}
function renderLobby(){
 $('open-blackboard').disabled=!identity||blackboardOpening;
 $('play-labyrinth').disabled=!identity;
 $('create-golf').disabled=!identity||golfPending;
 $('create-moto-trial').disabled=!identity||motoOpening;
 $('create-pong').disabled=!identity||pongOpening;
 const own=ownedGame();
 document.querySelectorAll('[data-create-game]').forEach(button=>{button.disabled=!identity;});
 $('owned-table').hidden=!own;
 $('owned-table-note').textContent=own?'Tavolo aperto · '+gameTitle(own):'';
 $('resume-table').onclick=async()=>{
  if(!own)return;
  await openRoom(own.room,true);
  if(room===own.room)selectPage('game');
 };
 // Tables against the AI (quick game or tutorial) are private: only their owner sees them in the Lobby.
 const active=games.filter(ongoing).filter(g=>!['ai','tutorial'].includes(g.mode)||g.players.some(p=>p.id===seat(g.room).player));
 $('games').replaceChildren();
 $('empty-games').hidden=active.length>0;
 $('empty-games').textContent='Nessun tavolo attivo.';
 for(const game of active){
  if(game.game==='golf'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';
   title.textContent='Golf '+game.number+' · '+gameTitle(game);
   info.textContent=game.players.length+'/'+game.capacity+' giocatori'+(game.phase==='playing'?' · Buca '+(game.hole+1):' · In attesa');
   const route=campaignInfo(game.campaign);
   if(route)info.textContent+=' · '+route.name+' · '+route.difficulty;
   if(game.collisions)info.textContent+=' · Collisioni attive';
   const mine=game.players.some(p=>p.id===identity?.player);
   enter.disabled=!identity;
   enter.textContent=mine?'Riprendi':game.phase==='waiting'&&game.players.length<game.capacity?'Entra':'Guarda';
   enter.onclick=()=>openGolf(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }
  if(game.game==='pong'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';title.textContent='Sala '+game.number+' · Pong';
   const count=game.players.length,mine=game.players.some(p=>p.id===identity?.player);
   info.textContent=count+'/2 connessi'+(count?' · '+game.players.map(p=>p.name).join(' · '):'');
   enter.disabled=!identity||!mine&&count>=2;
   enter.textContent=mine?'Riprendi':count>=2?'Al completo':'Entra';
   enter.onclick=()=>openPong(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }
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
 renderArchive();refreshDebug();renderSocial();renderNow();loadSimSummary();
}
// "Adesso": the few things worth doing right now, built from data the Lobby already has.
function renderNow(){
 const items=[],own=ownedGame(),me=id=>seat(id).player;
 for(const game of games.filter(ongoing)){
  if(['golf','pong','moto-trial','labyrinth'].includes(game.game))continue;
  const mine=game.players.some(p=>p.id===me(game.room)),full=staged(game)&&game.players.length>=gameLimits(game).max;
  if(mine&&game.phase==='playing'&&game.players[game.turn]?.id===me(game.room))items.push({rank:0,text:'Tocca a te · Tavolo '+game.number+' · '+gameTitle(game),label:'Gioca',action:()=>openRoom(game.room,false)});
  else if(mine&&game.phase==='waiting')items.push({rank:2,text:'Il tuo tavolo '+game.number+' · '+gameTitle(game)+' aspetta giocatori',label:'Apri',action:()=>openRoom(game.room,false)});
  else if(!mine&&!own&&game.phase==='waiting'&&!full&&game.players.length)items.push({rank:1,text:game.players[0].name+' ti aspetta a '+gameTitle(game)+' · Tavolo '+game.number,label:'Gioca',action:()=>openRoom(game.room,false)});
 }
 items.push(...cinema.nowItems());
 for(const entry of blackboardLobbyRooms)if(entry.people.length)items.push({rank:3,text:'Lavagna · Sala '+entry.number+' · '+entry.people.map(p=>p.name).join(', '),label:'Entra',action:button=>openBlackboard(button,entry.id)});
 // Binotto Simulator: what is still to do (server summary, read-only).
 const openSim=()=>$('play-binotto-simulator').click();
 for(const item of simSummary?.items||[])items.push({rank:item.rank,text:item.text,label:'Apri',action:openSim});
 const debrief=simSummary?.debrief;
 if(debrief&&pref('simulator-debrief-seen:'+identity?.id,'')!==debrief.race)items.push({rank:2,text:'Binotto Simulator · resoconto della gara di '+debrief.track+' pronto.',label:'Leggi',action:openSim});
 items.sort((a,b)=>a.rank-b.rank);
 // A short vibration when a new "tocca a te" appears (Settings → Vibrazione).
 const urgent=items.filter(i=>i.rank===0).length;
 if(urgent>(renderNow.urgent||0)&&renderNow.urgent!==undefined&&pref('binottoland-haptics','on')!=='off')tg?.HapticFeedback?.notificationOccurred?.('success');
 renderNow.urgent=urgent;
 $('now-panel').hidden=!identity;
 if(!items.length){const p=document.createElement('p');p.className='hint now-empty';p.textContent='Niente in sospeso. Apri un gioco dalla scheda Giochi o scrivi in chat.';$('now-items').replaceChildren(p);return}
 $('now-items').replaceChildren(...items.slice(0,5).map(item=>{
  const row=document.createElement('div');row.className='now-item'+(item.rank===0?' urgent':'');
  const text=document.createElement('span');text.textContent=item.text;
  const button=document.createElement('button');button.type='button';button.className=item.rank===0?'':'alt';button.textContent=item.label;button.disabled=!identity;button.onclick=()=>item.action(button);
  row.append(text,button);return row;
 }));
}

function stopRoom(){
 $('start-error').textContent='';
 stopReplay();replayFrames=[];replayPly=null;replayRevision=null;replayLoading=false;
 $('manage-game').open=false;$('draw-dialog').hidden=true;$('draw-response').hidden=true;
 board.reset();roomEpoch++;clearTimeout(retry);if(ws){ws.onclose=null;ws.close(1000,'Uscita dal tavolo');ws=null}
}
function showLobby(){
 stopRoom();room=null;state=null;credentials={};$('table').hidden=true;$('lobby').hidden=false;
 $('log').replaceChildren();err('');renderLobby();chat.scrollToLatest();sendPresence();
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
 if(games.find(g=>g.room===nextRoom)?.game==='pong')return openPong(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='golf')return openGolf(nextRoom);
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
 if(!state||s.revision!==state.revision){board.clear();trace('STATE','Partita '+s.number+' · '+s.phase+' · rev '+s.revision)}
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
 cinema.connect();
 clearTimeout(lobbyRetry);if(lobbyWS){lobbyWS.onclose=null;lobbyWS.close()}
 const socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/lobby/ws',['checkmate',sessionToken]);lobbyWS=socket;
 socket.onopen=()=>{$('lobby-connection').textContent='● In diretta';trace('WS','Sala partite collegata');$('lobby-connection').dataset.live='true';sendPresence();renderSocial()};
 socket.onmessage=e=>{try{const data=JSON.parse(e.data);games=data.games;renderLeaders(data);onlineUsers=data.users||[];chat.set(data.messages);renderLobby();renderSocial()}catch{err('Elenco non valido.')}};
 socket.onerror=()=>trace('ERROR','Connessione sala partite');
 socket.onclose=()=>{trace('WS','Sala disconnessa · nuovo tentativo tra 4 s');$('lobby-connection').textContent='Riconnessione…';$('lobby-connection').dataset.live='false';renderSocial();lobbyRetry=setTimeout(connectLobby,4000)};
}
function action(id,fn){$(id).onclick=async()=>{if(busy)return;busy=true;$(id).disabled=true;err('');try{await fn()}catch(e){err(e.message)}finally{busy=false;$(id).disabled=false;if(state)render(state)}}}
$('open-debug').onclick=()=>selectPage('debug');
$('back-settings').onclick=()=>selectPage('settings');
// Settings: secondary pages, preferences, live preview, problem report, developer mode.
document.querySelectorAll('[data-back-settings]').forEach(b=>b.onclick=()=>selectPage('settings'));
$('open-archive').onclick=()=>{renderArchive();selectPage('archive')};
$('open-info').onclick=()=>selectPage('info');
const {renderThemePreview}=initSettings({appName:APP_NAME,tg,trace,events});
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
 const entries=[['Interfaccia',APP_NAME],['Identità',identity?identity.name+' · Telegram verificato':'Non autenticato'],['Online',onlineUsers.length],['Partita',state?.number||'Sala partite'],['Partite elencate',games.length],['Stato',state?.phase||'Ingresso'],['Revisione',state?.revision??'—'],['Ruolo',state?(state.players.some(p=>p.id===credentials.player)?'Giocatore':'Spettatore'):'—'],['Connessione',(ws||lobbyWS)?(['In apertura','Connessa','In chiusura','Chiusa'][(ws||lobbyWS).readyState]):'Non attiva'],['Motore',state?.naval?'Battaglia navale':state?.briscola?'Briscola':state?.scarabeo?'Scarabeo':state?.scopa?'Scopa':state?.uno?'UNO':state?.connect4?'Forza 4':state?.checkers?'Dama italiana':state?.chess?'Scacchi':'Lobby'],['Viewport',innerWidth+' × '+innerHeight]];
 $('debug-info').replaceChildren();
 for(const [label,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);$('debug-info').append(dt,dd)}
}
function selectPage(page){
 $('draw-dialog').hidden=true;
 const activeTab=['debug','archive','info'].includes(page)?'settings':page;
 document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.page===activeTab;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});
 document.querySelectorAll('.page').forEach(section=>section.hidden=section.id!=='page-'+page);
 if(page!=='game')stopReplay();trace('UI','Pagina '+page);
 if(page==='games'){loadLeaders();renderCatalog()}if(page==='debug')refreshDebug();if(page==='settings')renderThemePreview();if(page==='game'){loadSimSummary(true);chat.limit()}if(page==='game')requestAnimationFrame(fitBoard);
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
initThemes({onError:err,trace});
$('debug-refresh').onclick=async()=>{
 $('debug-result').textContent='Aggiornamento…';
 try{const health=await request('/api/health');trace('HEALTH','Server '+health.version);if(room){render(await api('state'));connect();$('debug-result').textContent='Stato aggiornato. Riconnessione avviata.'}else{connectLobby();$('debug-result').textContent='Riconnessione alla sala partite avviata.'}}catch(e){$('debug-result').textContent=e.message}refreshDebug();
};
function fitViewport(){
 const height=viewportHeight(tg,{innerHeight,visualHeight:window.visualViewport?.height,fullscreen:!!document.fullscreenElement});
 const insets=safeInsets(tg);applyInsets(document.documentElement,insets);
 if(!$('labyrinth-overlay').hidden)$('labyrinth-frame').contentWindow?.postMessage({type:'labyrinth:insets',insets},location.origin);
 sendMotoInsets(insets);
 sendArcadeInsets(insets);
 golfPost('insets',{insets});
 cinema.post('insets',{insets});
 document.documentElement.style.setProperty('--app-height',height+'px');requestAnimationFrame(fitBoard);
}
for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'])tg?.onEvent(event,fitViewport);window.addEventListener('resize',fitViewport);document.addEventListener('fullscreenchange',fitViewport);document.addEventListener('webkitfullscreenchange',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);
fitViewport();refreshDebug();


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
 if(state.checkers){board.renderCheckers();renderMoveStrip();return;}
 board.renderChess();
 renderMoveStrip();
}
function renderMoveStrip(){
 const strip=$('move-history'),atBottom=strip.scrollHeight-strip.scrollTop-strip.clientHeight<20;strip.replaceChildren();
 if(!state.moves.length)strip.textContent='Nessuna mossa.';
 for(let i=0;i<state.moves.length;i+=2){const span=document.createElement('span');span.textContent=(i/2+1)+'. '+state.moves[i].san+(state.moves[i+1]?' '+state.moves[i+1].san:'');if(replayPly!==null&&replayPly>i&&replayPly<=i+2)span.className='move-current';strip.append(span)}
 if(atBottom)strip.scrollTop=strip.scrollHeight;
 updateReplayControls();requestAnimationFrame(fitBoard);
}
function renderUno(){
 renderUnoTable(state,{mine:state.players.findIndex(p=>p.id===credentials.player),active:canMove(),busy,move:a=>sendMove({...a,revision:state.revision})});
}
function renderConnect4(){
 const view=replayPly!==null&&replayFrames[replayPly]?replayFrames[replayPly]:state.connect4;
 $('cancel-capture').hidden=true;
 drawConnect4($('board'),$('board-hint'),view,{phase:state.phase,replaying:replayPly!==null,active:canMove(),move:a=>sendMove({...a,revision:state.revision})});
 updateReplayControls();requestAnimationFrame(fitBoard);
}

function fitBoard(){
 if($('board'))$('board').style.width='100%';
}
async function sendMove(move){
 const unoCall=state?.phase==='playing'&&!busy&&!state.archived&&replayPly===null&&(move.kind==='uno'&&state.uno?.canDeclare||move.kind==='catch-uno'&&state.uno?.canCatch);
 if(!canMove()&&!unoCall)return;
 busy=true;board.clear();renderBoard();trace('MOVE',move.kind|| (move.path?move.path.join(' → '):move.from+' → '+move.to+(move.promotion?' = '+move.promotion:'')));
 const current=room;
 try{const result=await api('move',move);if(room===current)render(result)}
 catch(e){err(e.message);if(room===current)try{render(await api('state'))}catch{}}
 finally{busy=false;if(room===current&&state)render(state)}
}
initDebugLog();

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
 board.clearPath();renderBoard();
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


trace('BOOT',APP_NAME+' · registro sessione attivo');



// Full screen, and on PC the Lobby button for window mode (see window-mode.js).
const {enterFullscreen}=initWindowMode(tg,$('window-mode'));
async function startSession(){
 enterFullscreen();
 $('access-retry').hidden=true;$('access-error').textContent='Collegamento a Telegram…';
 try{
  if(!tg?.initData)throw Error('Apri questa Mini App da @checkmategame_bot per usare il tuo account Telegram.');
  const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Accesso non riuscito.');
  identity=data.user;sessionToken=data.token;$('name').textContent=identity.name;renderProfile();$('auth-notice').hidden=true;
  trace('AUTH','Identità Telegram verificata');
  const payload=await request('/api/lobby');games=payload.games;onlineUsers=payload.users||[];chat.set(payload.messages);renderLeaders(payload);
  renderLobby();$('access-error').textContent='';$('club-gate').hidden=true;$('app-shell').hidden=false;connectLobby();blackboard.connect();
 }catch(e){$('club-gate').hidden=false;$('app-shell').hidden=true;$('access-error').textContent=e.message;$('access-retry').hidden=!tg?.initData;$('access-telegram').hidden=false;trace('AUTH','Accesso non completato')}
}
function sendPresence(away=document.hidden){
 if(lobbyWS?.readyState===1)lobbyWS.send(JSON.stringify({type:'presence',room:pongRoom||golfRoom||motoRace?.room||labyrinthRoom||room,away}));
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
installSwipe({selectPage,beforeShow:page=>{if(page==='games')renderCatalog();if(page==='settings')renderThemePreview()},haptic:()=>tg?.HapticFeedback?.selectionChanged?.()});
function renderSocial(){
 renderSpectators();
 const connected=lobbyWS?.readyState===1&&!document.hidden;
 const users=onlineUsers.slice();
 if(connected&&identity&&!users.some(user=>user.id===identity.id)){
  const own=ownedGame();users.unshift({...identity,status:own?'In partita '+own.number:'In Lobby',game:own?.room||null});
 }
 $('online-count').textContent=connected?users.length+' online':identity?'Collegamento…':'Accedi da Telegram';$('online-users').replaceChildren();
 $('people-faces').replaceChildren(...users.slice(0,6).map(makeAvatar));
 for(const user of users){
  const row=document.createElement('div');row.className='online-user';row.append(makeAvatar(user));
  const copy=document.createElement('div');copy.className='online-person';
  const label=document.createElement('span');label.textContent=user.name+(user.id===identity?.id?' · tu':'');
  const status=document.createElement('small');status.textContent=user.status;copy.append(label,status);row.append(copy);
  if(user.game){const button=document.createElement('button');button.className='alt';button.textContent='Guarda';button.onclick=()=>openRoom(user.game,true);row.append(button)}
  else{const dot=document.createElement('i');dot.className='presence-dot';row.append(dot)}
  $('online-users').append(row);
 }
 chat.render(connected);
}

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
 try{const result=await request('/api/labyrinth/'+selected+(watch?'/state':'/join'),watch?undefined:{});stopRoom();room=null;state=null;labyrinthRoom=selected;labyrinthWatch=watch;labyrinthLastState=result.state;$('draw-dialog').hidden=true;$('draw-response').hidden=true;enterFullscreen();try{tg?.disableVerticalSwipes?.()}catch{}labyrinthOverlay.hidden=false;labyrinthFrame.src='/labyrinth/index.html?multiplayer=1&v=dev3';tg?.BackButton?.show();connectExpedition();trace('LAB','Spedizione '+result.state.number+(watch?' · spettatore':''));sendPresence()}
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
 motoFrame.src='/moto-trial/index.html'+(multiplayer?'?multiplayer=1&v=9':'?v=9');
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
motoFrame.addEventListener('load',()=>{if(!motoOverlay.hidden){motoFrame.focus();sendMotoState()}});
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
function sendArcadeInsets(insets=safeInsets(tg)){
 if(!$('arcade-overlay').hidden)$('arcade-frame').contentWindow?.postMessage({type:'arcade:insets',insets},location.origin);
}
const arcadeOverlay=$('arcade-overlay'),arcadeFrame=$('arcade-frame');
let arcadeLaunch,simulatorBackReady=false;
let blackboardOpening=false;
const blackboard = blackboardLink(arcadeFrame, () => sessionToken, readAppearance, renderBlackboardRooms, () => {
 closeArcade();selectPage('game');$('tab-game').focus();
});
function renderBlackboardRooms(rooms, state){
 const list=$('blackboard-rooms'),status=$('blackboard-lobby-status');
 const online=state==='online',focused=document.activeElement?.dataset.blackboardRoom;
 blackboardLobbyRooms=online?rooms:[];
 // Every open board is listed, empty or not, until it is deleted.
 status.hidden=online&&rooms.length>0;
 $('blackboard-lobby').hidden=online&&!rooms.length;
 status.textContent=online?'Nessuna sala aperta.':state==='expired'?'Riapri Binottoland da Telegram.':'Collegamento alle lavagne…';
 list.replaceChildren(...rooms.map(entry=>{
  const button=document.createElement('button');
  const title=document.createElement('strong'),people=document.createElement('small');
  button.type='button';button.className='alt cinema-room-card';button.disabled=!online;
  button.dataset.blackboardRoom=entry.id;
  title.textContent='Sala '+entry.number;
  people.textContent=entry.people.length?entry.people.map(person=>person.name).join(', '):'Nessuno in sala';
  button.append(title,people);
  button.onclick=()=>openBlackboard(button,entry.id);
  return button;
 }));
 if(focused)Array.from(list.children).find(el=>el.dataset.blackboardRoom===focused)?.focus();
 renderNow();
}
function openBlackboard(button,id){
 if(!arcadeOverlay.hidden)return;
 blackboard.open(id);
 openArcade(button,'blackboard','Blackboard spazio libero');
}
$('open-blackboard').onclick=async()=>{
 if(blackboardOpening||!arcadeOverlay.hidden)return;
 const button=$('open-blackboard');
 blackboardOpening=true;
 button.disabled=true;
 try{
  const entry=await request('/api/blackboard/create',{});
  openBlackboard(button,entry.id);
 }catch(error){err(error.message);}
 finally{blackboardOpening=false;button.disabled=!identity;}
};
function openArcade(button,game,title,online=false){
 if(!arcadeOverlay.hidden)return;
 arcadeLaunch=button;simulatorBackReady=false;
 enterFullscreen();
 try{tg?.disableVerticalSwipes?.()}catch{}
 arcadeOverlay.hidden=false;
 arcadeFrame.setAttribute('sandbox','allow-scripts allow-same-origin'+(game==='binotto-simulator'?' allow-forms':''));
 arcadeFrame.title=title;arcadeFrame.src=game==='blackboard'?'/blackboard/index.html?v=6':'/arcade/'+game+'.html'+(game==='pong'?(online?'?v=3&online=1':'?v=3'):'?v=2');
 tg?.BackButton?.show();
}
function closeArcade(){
 if(arcadeOverlay.hidden)return;
 blackboard.stop();
 stopPong();
 arcadeOverlay.hidden=true;arcadeFrame.src='about:blank';
 tg?.BackButton?.hide();
 try{tg?.enableVerticalSwipes?.()}catch{}
 const roomButton=arcadeLaunch?.dataset.blackboardRoom;
 if(roomButton)Array.from($('blackboard-rooms').children).find(el=>el.dataset.blackboardRoom===roomButton)?.focus();
 else arcadeLaunch?.focus();
}
for(const [game,title] of [['number-connect','Number Connect'],['pong','Pong'],['giulio-simulator','Giulio Simulator'],['binotto-simulator','Binotto Simulator']]){
 const button=$('play-'+game);
 button.onclick=()=>openArcade(button,game,title);
}
function pongPost(type,data={}){
 if(!arcadeOverlay.hidden&&arcadeFrame.title==='Pong'){
  arcadeFrame.contentWindow?.postMessage({type:'pong:'+type,...data},location.origin);
 }
}
function stopPong(){
 const wasOnline=!!pongRoom;
 pongEpoch++;pongOpening=false;pongRoom=null;clearTimeout(pongRetry);
 $('create-pong').disabled=!identity;
 if(pongSocket){pongSocket.onclose=null;pongSocket.close();pongSocket=null;}
 if(wasOnline)sendPresence();
}
function connectPong(){
 if(!pongRoom||pongSocket)return;
 const selected=pongRoom;
 const socket=pongSocket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/pong/'+selected+'/ws',['checkmate',sessionToken]);
 socket.onmessage=event=>{
  if(pongSocket!==socket)return;
  try{
   const packet=JSON.parse(event.data);
   if(packet.type==='state')pongPost('state',{state:packet.state,player:identity.player});
  }catch{}
 };
 socket.onclose=async event=>{
  if(pongSocket!==socket)return;
  pongSocket=null;
  if(event.code===4000||event.code===4001){
   stopPong();pongPost('status',{online:false,error:event.code===4000?'Pong aperto in un’altra finestra.':'Riapri Binottoland da Telegram.'});return;
  }
  pongPost('status',{online:true,connected:false});
  try{
   const {state}=await request('/api/pong/'+selected+'/state');
   if(state.players.length===2&&!state.players.some(p=>p.id===identity.player))throw Object.assign(Error('La sala Pong è al completo.'),{status:409});
  }catch(e){
   if(pongRoom!==selected)return;
   if(e.status===404||e.status===409){stopPong();pongPost('status',{online:false,error:e.message});return;}
  }
  if(pongRoom===selected)pongRetry=setTimeout(connectPong,850);
 };
}
async function openPong(selected,mode='classic',inside=false){
 if(pongOpening||pongRoom)return;
 if(!identity){if(inside)pongPost('status',{online:false,error:'Apri Binottoland da Telegram per giocare online.'});return;}
 if(!inside&&!arcadeOverlay.hidden)return;
 pongOpening=true;
 const epoch=++pongEpoch;
 $('create-pong').disabled=true;
 try{
  const {state}=selected?await request('/api/pong/'+selected+'/state'):await request('/api/create',{game:'pong',mode});
  if(epoch!==pongEpoch)return;
  if(state.players.length===2&&!state.players.some(p=>p.id===identity.player))throw Error('La sala Pong è al completo.');
  pongRoom=state.room;
  if(inside){pongPost('status',{online:true,connected:false});connectPong();}
  else openArcade($('create-pong'),'pong','Pong',true);
  sendPresence();
 }catch(e){
  if(epoch!==pongEpoch)return;
  if(inside)pongPost('status',{online:false,error:e.message});else err(e.message);
 }finally{if(epoch===pongEpoch){pongOpening=false;$('create-pong').disabled=!identity;}}
}
$('create-pong').onclick=()=>openPong();
arcadeFrame.addEventListener('load',()=>{if(!arcadeOverlay.hidden){arcadeFrame.focus();sendArcadeInsets();}});
window.addEventListener('message',event=>{
 if(arcadeOverlay.hidden||event.origin!==location.origin||event.source!==arcadeFrame.contentWindow)return;
 if(event.data?.type==='simulator:ready'&&arcadeFrame.title==='Binotto Simulator'){
  const source=event.source;
  (async()=>{
   try{
    await refreshSession();
    if(source===arcadeFrame.contentWindow&&!arcadeOverlay.hidden)source.postMessage({type:'simulator:session',token:sessionToken},location.origin);
   }catch(e){err(e.message||'Riapri Binottoland da Telegram.')}
  })();
 }
 else if(event.data?.type==='arcade:ready'){simulatorBackReady=arcadeFrame.title==='Binotto Simulator';sendArcadeInsets();}
 else if(event.data?.type==='arcade:exit')closeArcade();
 else if(arcadeFrame.title==='Blackboard spazio libero')blackboard.receive(event.data);
 else if(arcadeFrame.title==='Number Connect'){
  const source=event.source,data=event.data;
  if(data?.type==='number-connect:ready'){
   source.postMessage({type:'number-connect:identity',player:identity?.player},location.origin);
  }else if(data?.type==='number-connect:score'&&Number.isInteger(data.run?.seed)&&Array.isArray(data.run.moves)&&data.run.moves.length<=20000){
   const seed=data.run.seed;
   const reply=ok=>{
    if(!arcadeOverlay.hidden&&arcadeFrame.title==='Number Connect'&&source===arcadeFrame.contentWindow){
     source.postMessage({type:'number-connect:result',seed,ok},location.origin);
    }
   };
   request('/api/number-connect/score',data.run).then(result=>{renderNumberLeaders(result.leaders);reply(true);},()=>reply(false));
  }
 }
 else if(arcadeFrame.title==='Pong'){
  const data=event.data;
  if(data?.type==='pong:ready'){
   pongPost('identity',{name:identity?.name});
   if(pongRoom)connectPong();
  }else if(data?.type==='pong:join')openPong(null,data.mode,true);
  else if(data?.type==='pong:leave')stopPong();
  else if((data?.type==='pong:input'||data?.type==='pong:command')&&pongSocket?.readyState===1&&pongSocket.bufferedAmount<4096){
   const packet=data.type==='pong:input'?{type:'input',direction:data.direction,target:data.target}:{type:data.action,mode:data.mode};
   const raw=JSON.stringify(packet);if(raw.length<=200)pongSocket.send(raw);
  }
 }
});
tg?.onEvent('backButtonClicked',()=>{
 if(!arcadeOverlay.hidden){if(arcadeFrame.title==='Binotto Simulator'&&simulatorBackReady)arcadeFrame.contentWindow?.postMessage({type:'simulator:back'},location.origin);else closeArcade();}
 else if(cinema.visible())cinema.leave();
 else if(!$('golf-overlay').hidden)closeGolf();
 else if(!motoOverlay.hidden)closeMotoTrial();
 else closeLabyrinth();
});


function golfPost(type,payload={}){
 if(!$('golf-overlay').hidden)$('golf-frame').contentWindow?.postMessage({type:'golf:'+type,...payload},location.origin);
}
function publishGolf(ack=false){
 if(golfSnapshot)golfPost('state',{...golfSnapshot,player:identity.player,ack});
}
const golfCampaign=$('golf-campaign');
golfCampaign.replaceChildren(...CAMPAIGNS.map(set=>new Option(set.difficulty+' · '+set.name,set.id)));
const lastGolfCampaign=read('binotto-golf-campaign',DEFAULT_CAMPAIGN);
golfCampaign.value=CAMPAIGNS.some(set=>set.id===lastGolfCampaign)?lastGolfCampaign:DEFAULT_CAMPAIGN;
golfCampaign.onchange=()=>{try{save('binotto-golf-campaign',golfCampaign.value)}catch(error){err(error.message)}};

function showGolf(online){
 enterFullscreen();try{tg?.disableVerticalSwipes?.()}catch{}
 $('golf-overlay').hidden=false;
 $('golf-frame').src='/golf/index.html?v=12'+(online?'&online=1':'&campaign='+encodeURIComponent(golfCampaign.value));
 tg?.BackButton?.show();
}
async function syncGolf(){
 const selected=golfRoom;
 if(!selected||document.hidden||golfPolling)return;
 golfPolling=true;
 try{
  const result=await request('/api/golf/'+selected+'/state?after='+golfSnapshot.state.revision);
  if(golfRoom===selected&&result.state&&result.state.revision>=golfSnapshot.state.revision){
   golfSnapshot=result;publishGolf();
  }
 }catch(error){if(golfRoom===selected&&error.status===404)returnFromClosedGolf(selected)}
 finally{golfPolling=false}
}
async function openGolf(selected){
 if(!identity||golfPending||!$('golf-overlay').hidden)return;
 golfPending=true;$('create-golf').disabled=true;
 try{
  const appearance=golfColors();
  if(!selected){
   golfSnapshot=await request('/api/create',{game:'golf',appearance,campaign:golfCampaign.value,collisions:$('golf-collisions').checked});
  }else{
   const path='/api/golf/'+selected, game=games.find(g=>g.room===selected);
   const watching=game&&!game.players.some(p=>p.id===identity.player)&&(game.phase!=='waiting'||game.players.length>=game.capacity);
   try{golfSnapshot=watching ? await request(path+'/state') : await request(path+'/join',{appearance});}
   catch(error){
    if(error.status!==409||watching)throw error;
    const result=await request(path+'/state'), match=result.state;
    if(match.phase==='waiting'&&match.players.length<8)throw error;
    golfSnapshot=result;
   }
  }
  golfRoom=golfSnapshot.state.room;$('golf-setup').hidden=true;showGolf(true);sendPresence();
  golfSync=setInterval(syncGolf,850);
 }catch(error){
  if(!selected&&!$('golf-setup').hidden)$('golf-setup-error').textContent=error.message;
  else err(error.message);
 }finally{golfPending=false;$('create-golf').disabled=!identity}
}
function closeGolf(){
 if($('golf-overlay').hidden)return;
 clearInterval(golfSync);const online=!!golfRoom;golfRoom=null;golfSnapshot=null;
 $('golf-overlay').hidden=true;$('golf-frame').src='about:blank';tg?.BackButton?.hide();
 try{tg?.enableVerticalSwipes?.()}catch{}sendPresence();$(online?'create-golf':'play-golf').focus();
}
function returnFromClosedGolf(selected){
 closeGolf();
 games=games.filter(game=>game.room!==selected);
 renderLobby();selectPage('lobby');
}
const golfSetup=$('golf-setup'),golfConfirm=$('golf-setup-confirm'),golfCancel=$('golf-setup-cancel');
let golfSetupOnline=false;
function setupGolf(online){
 if(golfPending||!$('golf-overlay').hidden||(online&&!identity))return;
 golfSetupOnline=online;
 $('golf-collision-choice').hidden=!online;
 $('golf-collisions').checked=false;
 $('golf-setup-error').textContent='';
 golfConfirm.textContent=online?'Crea stanza':'Gioca';
 golfSetup.hidden=false;golfCampaign.focus();
}
$('play-golf').onclick=()=>setupGolf(false);
$('create-golf').onclick=()=>setupGolf(true);
golfCancel.onclick=()=>{
 if(golfPending)return;
 golfSetup.hidden=true;$(golfSetupOnline?'create-golf':'play-golf').focus();
};
golfConfirm.onclick=async()=>{
 if(golfSetup.hidden||golfPending)return;
 $('golf-setup-error').textContent='';
 if(!golfSetupOnline){golfSetup.hidden=true;showGolf(false);return;}
 golfConfirm.disabled=golfCancel.disabled=true;
 try{await openGolf();}finally{golfConfirm.disabled=golfCancel.disabled=false;}
};
window.addEventListener('keydown',event=>{
 if(golfSetup.hidden)return;
 if(event.key==='Escape'){event.preventDefault();golfCancel.click();}
 if(event.key!=='Tab')return;
 const items=[golfCampaign,...(golfSetupOnline?[$('golf-collisions')]:[]),golfConfirm,golfCancel].filter(item=>!item.disabled);
 const edge=event.shiftKey?items[0]:items.at(-1);
 if(document.activeElement===edge){event.preventDefault();(event.shiftKey?items.at(-1):items[0]).focus();}
});
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==$('golf-frame').contentWindow||$('golf-overlay').hidden)return;
 const data=event.data;
 if(data?.type==='golf:ready'){golfPost('insets',{insets:safeInsets(tg)});golfPost('appearance',{colors:golfColors()});publishGolf();return;}
 if(data?.type==='golf:exit'){closeGolf();return;}
 const selected=golfRoom;
 if(!selected||data?.type!=='golf:action'||!['start','shot','close'].includes(data.kind))return;
 const payload=data.kind==='close'?{}:data.payload;
 try{
  const result=await request('/api/golf/'+selected+'/'+data.kind,payload);
  if(golfRoom===selected){
   if(data.kind==='close'){returnFromClosedGolf(selected);return;}
   if(result.state.revision>=golfSnapshot.state.revision)golfSnapshot=result;
   publishGolf(true);
  }
 }catch(error){if(golfRoom===selected){if(error.status===404)returnFromClosedGolf(selected);else golfPost('error',{message:error.message})}}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&labyrinthSocket?.readyState===1)labyrinthSocket.send(JSON.stringify({type:'heartbeat'}))});

function renderTutorial(s){const box=$('tutorial-panel'),hint=s.tutorial;box.hidden=!hint;if(!hint)return;$('tutorial-title').textContent=hint.title;$('tutorial-text').textContent=hint.text;$('tutorial-reason').textContent=hint.reason;$('tutorial-move').hidden=!hint.action;$('tutorial-move').disabled=busy;$('tutorial-move').onclick=()=>sendMove({...hint.action,revision:state.revision});}
const loadLeaders=createLeaderboardLoader({request,onError:err,ready:()=>!!sessionToken});
$('solo-labyrinth').onclick=()=>{enterFullscreen();labyrinthOverlay.hidden=false;labyrinthFrame.src='/labyrinth/index.html?dev=1&v=dev3';tg?.BackButton?.show()};

$('access-retry').onclick=startSession;

startSession();
