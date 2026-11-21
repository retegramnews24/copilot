import {renderScopa} from './scopa-ui.js';
import {renderNaval,renderBriscola} from './sea-cards-ui.js';
import {renderScarabeo} from './board-games-ui.js';
import {safeInsets,applyInsets,viewportHeight} from './safe-area.js';
import {campaignInfo} from './golf/courses.js?v=4b40a70e69';
import {readAppearance} from './appearance.js?v=3bf8d2e2ca';
import './labyrinth/avatar.js?v=5318415024';
import {initCatalog,renderCatalog,openGame} from './games-catalog.js?v=bff5f99338';
import {installSwipe} from './swipe.js?v=1e6e396f97';
import {initWindowMode} from './window-mode.js?v=4861da0434';
import {pref,setPref,read,save} from './prefs.js?v=bd123656a4';
import {events,trace,initDebugLog} from './debug-log.js?v=497d88fa03';
import {gameTitle,staged,gameLimits,ongoing,isLongTurn,LONG_LIMIT} from './game-info.js?v=dab50e1d8e';
import {renderMyGames,myTables,timeLeft} from './my-games.js?v=8240b254bd';
import {pieceNames,pieceSvg,position,checkerSvg,unoNames,unoSymbols,unoCard} from './pieces.js?v=fa35e21be7';
import {initThemes} from './themes.js?v=b6682dff0c';
import {initSettings} from './settings.js?v=6f9a6958a5';
import {renderLeaders,createLeaderboardLoader} from './leaderboard.js?v=56908653f4';
import {createCinemaLobby} from './cinema-lobby.js?v=b7ac5fac47';
import {makeAvatar} from './avatar.js?v=7a059821b4';
import {createChat} from './chat.js?v=f139a08339';
import {createLobbyChips} from './lobby-chips.js?v=34f547ad4a';
import {createNotices} from './notices.js?v=b255c76632';
import {renderUno as renderUnoTable} from './uno-ui.js?v=1ab74ee73d';
import {renderConnect4 as drawConnect4} from './connect4-ui.js?v=5be07b8991';
import {createChessBoard} from './chess-board.js?v=f92d78d981';
import {createMotoLink} from './moto-link.js?v=a67dbdac2c';
import {createLabyrinthLink} from './labyrinth-link.js?v=4a729985f0';
import {createGolfLink} from './golf-link.js?v=97d037f39a';
import {createArcadeLink} from './arcade-link.js?v=567f7a97f8';
import {createF1Link} from './f1-link.js?v=28d33c1b41';
import {createBiliardoLink} from './biliardo-link.js?v=bb0b63f788';
import {initTurnAlerts} from './turn-alerts.js?v=e295946a10';
// The test environment (binottoland-motore-staging) shows a label, so it is never mistaken for the real app.
if(/-staging\./.test(location.hostname))document.documentElement.dataset.env='staging';
const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
if(tg?.platform==='android')document.documentElement.dataset.telegramPlatform='android';
// Version shown in Informazioni, Debug and problem reports. Increase it at every release.
const APP_VERSION='1.0.40',APP_NAME='Binottoland Playground '+APP_VERSION;
const $=id=>document.getElementById(id);
// Cinema rooms, socket and iframe (see cinema-lobby.js). Dependencies are wrapped: some are defined further down.
const cinema=createCinemaLobby({tg,token:()=>sessionToken,readAppearance,safeInsets,enterFullscreen:()=>enterFullscreen(),leaveRoom:()=>leaveRoom(),selectPage:page=>selectPage(page),renderNow:()=>renderNow()});
// Stored notices (new table, win): 'Entra' while the table is open, opening it like its Lobby button.
const noticeGame=room=>games.find(g=>g.room===room&&ongoing(g));
const chat=createChat({me:()=>identity,request,onError:err,refresh:()=>renderSocial()});
// Lobby bell: personal notices (stored by the server, or made here), outside the chat (see notices.js).
const openGameRoom=target=>{const g=noticeGame(target);if(!g)return;if(g.game==='golf')golf.open(target);else if(g.game==='f1')f1.open(target);else if(g.game==='biliardo')biliardo.open(target);else if(g.game==='pong')arcade.openPong(target);else if(g.game==='moto-trial')moto.open(target);else openRoom(target,false).then(()=>{if(room===target)selectPage('game')})};
const notices=createNotices({me:()=>identity,isOpen:target=>!!noticeGame(target),open:openGameRoom});
// Lobby B: chips for games and rooms, game notices inside the chat (see lobby-chips.js).
createLobbyChips({notice:item=>notices.add(item)});
const board=createChessBoard({get:()=>({state,mine:state.players.findIndex(p=>p.id===credentials.player),active:canMove(),replayPly,frame:replayPly!==null&&replayFrames[replayPly]?replayFrames[replayPly]:null}),send:move=>sendMove(move),rerender:()=>renderBoard()});
// Overlays with their own iframe and socket (see *-link.js). Dependencies are wrapped: some are defined further down.
const linkBase={tg,token:()=>sessionToken,me:()=>identity,request,onError:err,enterFullscreen:()=>enterFullscreen(),sendPresence:()=>sendPresence(),safeInsets};
const moto=createMotoLink(linkBase);
// "Tocca a te" messages from the bot: Lobby invite, Settings switch, opening a table from the message (see turn-alerts.js).
const alerts=initTurnAlerts({tg,request:(path,data)=>request(path,data),onError:msg=>err(msg)});
const labyrinth=createLabyrinthLink({...linkBase,trace,leaveTable:()=>{stopRoom();room=null;state=null;$('draw-dialog').hidden=true;$('draw-response').hidden=true}});
const golf=createGolfLink({...linkBase,games:()=>games,roomClosed:selected=>{games=games.filter(game=>game.room!==selected);renderLobby();selectPage('lobby')}});
const arcade=createArcadeLink({...linkBase,readAppearance,refreshSession:()=>refreshSession(),renderNow:()=>renderNow(),selectPage:page=>selectPage(page)});
// F1 on paper! (public/gara/): draw a track and race it in 3D, vs the AI or on the same phone (see f1-link.js).
const f1=createF1Link({...linkBase,games:()=>games,roomClosed:selected=>{games=games.filter(game=>game.room!==selected);renderLobby();selectPage('lobby')}});
// Biliardo (public/biliardo/): sala giochi 3D, palla 8, snooker, 5 birilli e boccette; online a due (see biliardo-link.js).
const biliardo=createBiliardoLink({...linkBase,games:()=>games,roomClosed:selected=>{games=games.filter(game=>game.room!==selected);renderLobby();selectPage('lobby')}});
initCatalog();
// Lobby 3D (prova su staging, public/lobby3d/): guscio facoltativo della Lobby. Lavagna = Settings, tavoli = Biliardo,
// cabinati = giochi arcade: apre le schermate che ci sono già e torna da sola quando le chiudi.
const LOBBY3D_KEY='binottoland-lobby3d';let lobby3d=null,lobby3dBack=0,lobby3dIdle=0;
const lobbyIdle=()=>!$('page-game').hidden&&!$('lobby').hidden&&![...document.querySelectorAll('[id$="-overlay"]')].some(o=>!o.hidden)&&$('game-sheet')?.hidden!==false&&!document.querySelector('dialog[open]');
let clubStation=null;
function clubAudio(){
 window.binottolandClubRadio?.sync(!!lobby3d?.active && !document.hidden,clubStation);
}
function clubVisibility(){sendPresence();clubAudio()}
document.addEventListener('visibilitychange',clubVisibility);
async function openLobby3D(){
 try{localStorage.setItem(LOBBY3D_KEY,'1')}catch{}
 if(!lobby3d){const m=await import('./lobby3d/lobby3d.js?v=69f203edfb');lobby3d=m.createLobby3D({me:()=>identity,clubVisibility,projection:()=>cinema.projection(),sit:id=>cinema.open(id),tune:()=>window.binottolandClubRadio?.choose(station=>{
 if(lobbyWS?.readyState!==1)return false;
 lobbyWS.send(JSON.stringify({type:'club-radio',station}));return true;
}),games:()=>[...document.querySelectorAll('#page-games .catalog-card')].filter(c=>!c.hidden).map(c=>c.dataset.game),open:key=>openGame(key),openSettings:()=>$('tab-settings').click(),openGames:()=>$('tab-games').click(),launched:()=>{lobby3dBack=Date.now();lobby3dIdle=0},exit:()=>{lobby3dBack=0;try{localStorage.removeItem(LOBBY3D_KEY)}catch{}}})}
 lobby3d.show();
}
$('lobby3d-open').onclick=()=>openLobby3D().catch(e=>err('Lobby 3D: '+e.message));
// Back in the Lobby after a screen opened from 3D (game closed, Settings left): after two quiet checks the 3D comes back.
// Also at start, when it was left on: it opens as soon as the Lobby is free (after the splash).
setInterval(()=>{if(!lobby3dBack||lobby3d?.active||document.hidden||Date.now()-lobby3dBack<2500)return;lobby3dIdle=lobbyIdle()?lobby3dIdle+1:0;if(lobby3dIdle>=2){lobby3dBack=0;openLobby3D().catch(e=>err('Lobby 3D: '+e.message))}},700);
try{if(localStorage.getItem(LOBBY3D_KEY)==='1')lobby3dBack=1}catch{}
let simSummary=null,simSummaryAt=0;
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
// Long-turn tables: time left to move (after half of it the bot has sent a reminder: shown highlighted).
function renderTurnClock(){
 const el=$('turn-clock'),c=state?.clock;
 el.hidden=!c||state.phase!=='playing';if(el.hidden)return;
 el.textContent='⏳ Tempo per muovere: '+timeLeft(c.deadline-Date.now());el.classList.toggle('late',!!c.reminded);
}
setInterval(()=>{if(!$('table').hidden&&state?.clock)renderTurnClock()},60000);
// Your open table that is not a long-turn game: only one of those at a time.
function ownedGame(){return games.find(g=>g.game!=='golf'&&g.game!=='f1'&&g.game!=='biliardo'&&g.game!=='labyrinth'&&g.game!=='moto-trial'&&g.game!=='pong'&&!isLongTurn(g)&&ongoing(g)&&g.players.some(p=>p.id===seat(g.room).player))}
// Can you take a seat at this table? Long-turn games: up to LONG_LIMIT at once; any other: only without another open table.
// One open table per game (long-turn games: up to LONG_LIMIT), as on the server.
function canSit(g){return isLongTurn(g)?myTables(games,id=>seat(id).player).filter(isLongTurn).length<LONG_LIMIT:!games.some(o=>o.room!==g.room&&o.game===g.game&&!isLongTurn(o)&&ongoing(o)&&o.players.some(p=>p.id===seat(o.room).player))}
// Bell: your open games (also single-player) stay pinned there, without ×, until they close.
function pinnedGames(){return games.filter(g=>g.game!=='labyrinth'&&ongoing(g)&&g.players.some(p=>p.id===seat(g.room).player||p.id===identity?.player)).map(g=>{const turn=g.phase==='playing'&&g.players[g.turn]?.id===seat(g.room).player;return {id:'pin-'+g.room,text:(turn?'Tocca a te · ':'')+gameTitle(g)+' · '+(['golf','pong','moto-trial','f1','biliardo'].includes(g.game)?'sala ':'Tavolo ')+g.number,detail:['ai','tutorial'].includes(g.mode)?'Partita singola aperta':'Partita aperta',label:turn?'Gioca':'Riprendi',urgent:turn,action:()=>openGameRoom(g.room)}})}

function renderProfile(){
 const node=$('profile-avatar'),avatar=makeAvatar(identity||{name:'?'});node.replaceChildren(...avatar.childNodes);
 $('profile-username').textContent=identity?.username?'@'+identity.username:identity?'Account Telegram':'';
}
function renderLobby(){
 $('open-blackboard').disabled=!identity||arcade.blackboardOpening();
 $('play-labyrinth').disabled=!identity;
 $('create-golf').disabled=!identity||golf.pending();
 $('create-moto-trial').disabled=!identity||moto.opening();
 $('create-pong').disabled=!identity||arcade.pongOpening();
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
  if(game.game==='f1'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';
   title.textContent='F1 on paper! · sala '+game.number;
   info.textContent=game.players.length+'/'+game.capacity+' piloti · '+game.laps+(game.laps===1?' giro':' giri')+(game.phase==='waiting'?' · In attesa':' · In gara');
   const mine=game.players.some(p=>p.id===identity?.player);
   enter.disabled=!identity;
   enter.textContent=mine?'Riprendi':game.phase==='waiting'&&game.players.length<game.capacity?'Entra':'Guarda';
   enter.onclick=()=>f1.open(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }
  if(game.game==='biliardo'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';
   title.textContent=gameTitle(game)+' · sala '+game.number;
   info.textContent=game.players.length+'/'+game.capacity+' giocatori'+(game.phase==='waiting'?' · In attesa':' · In gioco');
   const mine=game.players.some(p=>p.id===identity?.player);
   enter.disabled=!identity;
   enter.textContent=mine?'Riprendi':game.phase==='waiting'&&game.players.length<game.capacity?'Entra':'Guarda';
   enter.onclick=()=>biliardo.open(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }
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
   enter.onclick=()=>golf.open(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }
  if(game.game==='pong'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';title.textContent='Sala '+game.number+' · Pong';
   const count=game.players.length,mine=game.players.some(p=>p.id===identity?.player);
   info.textContent=count+'/2 connessi'+(count?' · '+game.players.map(p=>p.name).join(' · '):'');
   enter.disabled=!identity||!mine&&count>=2;
   enter.textContent=mine?'Riprendi':count>=2?'Al completo':'Entra';
   enter.onclick=()=>arcade.openPong(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }
  if(game.game==='moto-trial'){
   const card=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p'),enter=document.createElement('button');
   card.className='table-card';info.className='turn-note';
   title.textContent='Corsa '+game.number+' · '+(game.courseName||'Moto Trial');
   info.textContent=(game.online||0)+' / '+(game.capacity||8)+' piloti'+(game.players.length?' · '+game.players.map(p=>p.name).join(' · '):'');
   const mine=game.players.some(p=>p.id===identity?.player);
   enter.disabled=!identity||!mine&&game.online>=game.capacity;
   enter.textContent=enter.disabled&&identity?'Al completo':mine?'Riprendi':'Entra';
   enter.onclick=()=>moto.open(game.room);card.append(title,info,enter);$('games').append(card);continue;
  }

  if(game.game==='labyrinth'){
   const card=document.createElement('article');card.className='table-card';const title=document.createElement('strong');title.textContent='Spedizione '+game.number+' · Labyrinth';const info=document.createElement('p');info.className='turn-note';info.textContent=(game.online||0)+' collegati · '+(game.arrived||0)+' nell’arena · '+(game.entryLocked?'Ingressi chiusi':'Ingressi aperti');const players=document.createElement('p');players.className='turn-note';players.textContent=game.players.map(p=>p.name).join(' · ');card.append(title,info,players);
   const mine=game.players.some(p=>p.id===identity?.player);const enter=document.createElement('button');enter.textContent=mine?'Riprendi':game.entryLocked?'Assisti':'Entra';enter.onclick=()=>labyrinth.open(game.room,!mine&&game.entryLocked);card.append(enter);const watch=document.createElement('button');watch.className='alt';watch.textContent='Guarda';watch.onclick=()=>labyrinth.open(game.room,true);card.append(watch);
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
  const button=document.createElement('button');button.className='table-open '+(game.phase==='waiting'&&!mine&&canSit(game)?'':'alt');
  button.textContent=mine?(game.phase==='finished'?'Riprendi torneo':'Riprendi'):game.phase==='waiting'?(!canSit(game)||(staged(game)&&game.players.length>=gameLimits(game).max)?'Guarda':'Gioca'):'Guarda';
  button.onclick=()=>openRoom(game.room,staged(game)&&game.players.length>=gameLimits(game).max);if(game.series)note.textContent+=' · Torneo: '+game.series.target+' vittorie';card.append(title,names,note,button);$('games').append(card);
 }
 notices.setPinned(pinnedGames());
 renderMyGames($('my-games'),games,id=>seat(id).player,async id=>{await openRoom(id,false);if(room===id)selectPage('game')});
 renderArchive();refreshDebug();renderSocial();renderNow();loadSimSummary();
}
// "Adesso": the few things worth doing right now, built from data the Lobby already has.
function renderNow(){
 const items=[],me=id=>seat(id).player;
 for(const game of games.filter(ongoing)){
  if(['golf','pong','moto-trial','labyrinth','f1','biliardo'].includes(game.game))continue;
  const mine=game.players.some(p=>p.id===me(game.room)),full=staged(game)&&game.players.length>=gameLimits(game).max;
  if(mine&&game.phase==='playing'&&game.players[game.turn]?.id===me(game.room))items.push({rank:0,text:'Tocca a te · Tavolo '+game.number+' · '+gameTitle(game),label:'Gioca',action:()=>openRoom(game.room,false)});
  else if(mine&&game.phase==='waiting')items.push({rank:2,text:'Il tuo tavolo '+game.number+' · '+gameTitle(game)+' aspetta giocatori',label:'Apri',action:()=>openRoom(game.room,false)});
  else if(!mine&&canSit(game)&&game.phase==='waiting'&&!full&&game.players.length)items.push({rank:1,text:game.players[0].name+' ti aspetta a '+gameTitle(game)+' · Tavolo '+game.number,label:'Gioca',action:()=>openRoom(game.room,false)});
 }
 items.push(...cinema.nowItems());
 items.push(...arcade.nowItems());
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
 if(games.find(g=>g.room===nextRoom)?.game==='pong')return arcade.openPong(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='golf')return golf.open(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='f1')return f1.open(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='biliardo')return biliardo.open(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='moto-trial')return moto.open(nextRoom);
 if(games.find(g=>g.room===nextRoom)?.game==='labyrinth')return labyrinth.open(nextRoom,watchOnly);
 if(busy)return;
 if(nextRoom!==room)discardResult();
 stopRoom();room=nextRoom;state=null;credentials=seat(room);const epoch=roomEpoch;
 err('');
 try{
 let s=await api('state');if(epoch!==roomEpoch)return;
 if(!watchOnly&&s.phase==='waiting'&&!s.players.some(p=>p.id===credentials.player)&&canSit(s)){
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
 if(s.naval?.winner!==null&&s.naval?.winner!==undefined&&s.phase==='finished')$('status').textContent='Vince '+(s.players[s.naval.winner]?.name||'giocatore '+(s.naval.winner+1));
 if(s.briscola&&s.phase==='playing'&&s.briscola.phase!=='play')$('status').textContent=(s.briscola.phase==='auction'?'Asta · ':'Scelta della briscola · ')+s.players[s.turn].name;
 if(s.briscola?.winners.length&&s.phase==='finished')$('status').textContent='Vincono '+s.briscola.winners.map(i=>s.players[i].name).join(' + ');
 renderSeries(s,mine);
 const start=$('start-group'),minPlayers=gameLimits(s).min;
 start.hidden=!staged(s)||s.phase!=='waiting'||mine!==0;
 start.disabled=start.hidden||busy||s.players.length<minPlayers;
 start.textContent=s.players.length<minPlayers?'In attesa di almeno '+minPlayers+' giocatori':'Avvia partita';
 if(start.hidden)$('start-error').textContent='';
 $('role').textContent=mine<0?'Stai assistendo.':'Sei il giocatore '+(mine+1)+'.';
 renderTurnClock();

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
 socket.onmessage=e=>{try{const data=JSON.parse(e.data);clubStation=data.clubRadio??null;clubAudio();games=data.games;renderLeaders(data);onlineUsers=data.users||[];chat.set(data.messages);notices.set(data.notices);renderLobby();renderSocial()}catch{err('Elenco non valido.')}};
 socket.onerror=()=>trace('ERROR','Connessione sala partite');
 socket.onclose=()=>{clubStation=null;clubAudio();trace('WS','Sala disconnessa · nuovo tentativo tra 4 s');$('lobby-connection').textContent='Riconnessione…';$('lobby-connection').dataset.live='false';renderSocial();lobbyRetry=setTimeout(connectLobby,4000)};
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
 labyrinth.insets(insets);
 moto.insets(insets);
 arcade.insets(insets);
 golf.insets(insets);
 f1.insets(insets);
 biliardo.insets(insets);
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
// Unexpected errors also reach the server logs (only once signed in; keepalive survives closing the app).
initDebugLog({report:error=>{if(sessionToken)fetch('/api/client-error',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken},body:JSON.stringify({...error,page:document.querySelector('.page:not([hidden])')?.id||'',version:APP_VERSION,platform:tg?.platform||'browser'})}).catch(()=>{})}});

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
  const payload=await request('/api/lobby');games=payload.games;onlineUsers=payload.users||[];chat.set(payload.messages);notices.set(payload.notices);renderLeaders(payload);setTimeout(()=>loadLeaders(),0);
  renderLobby();$('access-error').textContent='';$('club-gate').hidden=true;$('app-shell').hidden=false;connectLobby();arcade.connectBlackboard();
  alerts.refresh();
  // Launched from a "tocca a te" message: straight to that table.
  const startRoom=alerts.startRoom();if(startRoom){try{await openRoom(startRoom);if(room===startRoom)selectPage('game')}catch(e){err(e.message)}}
 }catch(e){$('club-gate').hidden=false;$('app-shell').hidden=true;$('access-error').textContent=e.message;$('access-retry').hidden=!tg?.initData;$('access-telegram').hidden=false;trace('AUTH','Accesso non completato')}
}
function sendPresence(away=document.hidden){
 if(lobbyWS?.readyState===1)lobbyWS.send(JSON.stringify({type:'presence',inClub:!!lobby3d?.active,room:arcade.pongRoom()||golf.room()||f1.room()||biliardo.room()||moto.room()||labyrinth.room()||room,away}));
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



// Telegram Back: closes whichever overlay is open (the Binotto Simulator handles it itself once ready).
tg?.onEvent('backButtonClicked',()=>{
 if(arcade.visible())arcade.back();
 else if(f1.visible())f1.back();
 else if(biliardo.visible())biliardo.back();
 else if(cinema.visible())cinema.leave();
 else if(golf.visible())golf.close();
 else if(moto.visible())moto.close();
 else labyrinth.close();
});

function renderTutorial(s){const box=$('tutorial-panel'),hint=s.tutorial;box.hidden=!hint;if(!hint)return;$('tutorial-title').textContent=hint.title;$('tutorial-text').textContent=hint.text;$('tutorial-reason').textContent=hint.reason;$('tutorial-move').hidden=!hint.action;$('tutorial-move').disabled=busy;$('tutorial-move').onclick=()=>sendMove({...hint.action,revision:state.revision});}
const loadLeaders=createLeaderboardLoader({request,onError:err,ready:()=>!!sessionToken});

$('access-retry').onclick=startSession;

startSession();
