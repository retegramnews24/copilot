const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
const $=id=>document.getElementById(id);
let sessionToken='',identity=null,onlineUsers=[],chatMessages=[],tableFilter='all',chatSending=false;
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
async function request(path,data){
 if(!sessionToken)throw Error('Apri Binottoland da Telegram per accedere.');
 const started=performance.now();trace('HTTP',(data?'POST ':'GET ')+path);
 try{
  const response=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+sessionToken,'X-Player-Token':credentials.token||''},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();trace(response.ok?'OK':'ERROR',response.status+' '+path+' · '+Math.round(performance.now()-started)+' ms');
  if(!response.ok)throw Error(result.error||'Errore server');return result;
 }catch(error){trace('ERROR',error.message);throw error}
}
function api(action,data){return request(action==='create'?'/api/create':'/api/room/'+room+'/'+action,data)}
const gameTitle=g=>g?.game==='checkers'?'Dama italiana':'Checkmate!';
const boardState=()=>state?.checkers||state?.chess;
function ownedGame(){return games.find(g=>g.phase!=='finished'&&g.players.some(p=>p.id===seat(g.room).player))}

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
 const own=ownedGame();$('create').hidden=!!own;$('create-chess').disabled=!identity||!!own;$('create-chess').textContent=own?'Hai già un tavolo aperto':'Crea tavolo';
 $('create-checkers').disabled=!identity||!!own;$('create-checkers').textContent=own?'Hai già un tavolo aperto':'Crea tavolo';
 const active=games.filter(g=>!g.archived);
 const waiting=active.filter(g=>g.phase==='waiting').length,playing=active.filter(g=>g.phase==='playing').length;
 $('lobby-summary').textContent=active.length?waiting+' da giocare · '+playing+' in corso':'Un tavolo, due giocatori. Si comincia qui.';
 document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===tableFilter)));
 const visible=active.filter(g=>tableFilter==='all'||g.phase===tableFilter);
 $('games').replaceChildren();$('empty-games').hidden=visible.length>0;
 $('empty-games').textContent=active.length?'Nessuna partita in questa sezione.':'Nessun tavolo aperto. Crea la prima partita.';
 for(const game of visible){
  const card=document.createElement('article');card.className='table-card';
  const title=document.createElement('div');title.className='table-title';
  const heading=document.createElement('strong');heading.textContent='Tavolo '+game.number+' · '+gameTitle(game);
  const badge=document.createElement('span');badge.className='game-badge '+game.phase;
  badge.textContent=game.phase==='waiting'?'Posto libero':game.phase==='playing'?'In corso':'Conclusa';title.append(heading,badge);
  const names=document.createElement('div');names.className='table-players';
  for(let i=0;i<2;i++){const person=document.createElement('span');person.className='table-player'+(!game.players[i]?' vacant':'');const dot=document.createElement('i');dot.className='side-dot '+(i?'black':'white');const label=document.createElement('span');label.textContent=game.players[i]?.name||'In attesa';person.append(dot,label);names.append(person)}
  const note=document.createElement('p');note.className='turn-note';
  const mine=game.players.some(p=>p.id===seat(game.room).player);
  note.textContent=game.phase==='playing'?(game.players[game.turn]?.id===seat(game.room).player?'Tocca a te':'Tocca a '+game.players[game.turn].name):game.phase==='waiting'?'Il prossimo giocatore entra al tavolo.':'Disponibile per la revisione.';
  const button=document.createElement('button');button.className='table-open '+(game.phase==='waiting'&&!mine&&!own?'':'alt');
  button.textContent=mine?(game.phase==='finished'?'Rivedi':'Riprendi'):game.phase==='waiting'?(own?'Guarda':'Gioca'):'Guarda';
  button.onclick=()=>openRoom(game.room);card.append(title,names,note,button);$('games').append(card);
 }
 renderArchive();refreshDebug();renderSocial();
}
document.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>{tableFilter=button.dataset.filter;renderLobby()});

function stopRoom(){
 stopReplay();replayFrames=[];replayPly=null;replayRevision=null;replayLoading=false;
 $('manage-game').open=false;$('draw-dialog').hidden=true;$('draw-response').hidden=true;
 capturePath=[];selectedSquare=null;promotionMove=null;boardFlipped=null;$('promotion').hidden=true;roomEpoch++;clearTimeout(retry);if(ws){ws.onclose=null;ws.close();ws=null}
}
function showLobby(){
 stopRoom();room=null;state=null;credentials={};$('table').hidden=true;$('lobby').hidden=false;
 $('expires').textContent='';$('log').replaceChildren();err('');renderLobby();sendPresence();
}
async function openRoom(nextRoom,watchOnly=false){
 if(busy)return;
 stopRoom();room=nextRoom;state=null;credentials=seat(room);const epoch=roomEpoch;
 err('');
 try{
 let s=await api('state');if(epoch!==roomEpoch)return;
 if(!watchOnly&&s.phase==='waiting'&&!s.players.some(p=>p.id===credentials.player)&&!ownedGame()){
  const playerName=identity.name;
  $('name').textContent=playerName;
  try{
   const j=await api('claim',{name:playerName});
   save('binotto-'+nextRoom,{token:j.token,player:j.player});
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
 state=s;$('lobby').hidden=true;$('table').hidden=false;
 const mine=s.players.findIndex(p=>p.id===credentials.player);
 $('room-number').textContent=s.number?'Tavolo '+s.number+' · '+gameTitle(s):gameTitle(s);
 $('status').textContent=s.phase==='waiting'?'In attesa di un avversario':s.phase==='finished'?(s.archived?'Archiviata':boardState()?.reason||'Partita conclusa')+(boardState()?.result?' · '+boardState().result:''):(mine===s.turn?'Tocca a te':'Tocca a '+s.players[s.turn].name)+(s.chess?.check?' · Scacco':'');
 $('players').replaceChildren();
 for(let i=0;i<2;i++){const el=document.createElement('div');el.className='person'+(s.phase==='playing'&&s.turn===i?' active':'');el.textContent=(boardState()?(i===0?'Bianco · ':'Nero · '):'')+(s.players[i]?.name||'Posto libero');$('players').append(el)}
 $('role').textContent=mine<0?'Stai assistendo.':'Sei il giocatore '+(mine+1)+'.';

 $('pass').hidden=!!boardState()||s.phase!=='playing'||mine<0;$('pass').disabled=mine!==s.turn||busy;
 $('finish').hidden=s.phase==='finished'||mine<0;
 $('offer-draw').hidden=!boardState()||s.phase!=='playing'||mine<0;
 $('offer-draw').disabled=busy||!!s.drawOffer;

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
 $('newtable').hidden=mine>=0&&s.phase!=='finished';
 $('expires').textContent=s.archived?'Archiviata · conservata fino all’eliminazione':'Disponibile fino al '+new Date(s.expires).toLocaleString('it-IT');
 $('manage-game').hidden=mine<0;$('archive-game').hidden=!!s.archived;
 $('replay-player').hidden=!boardState()||s.phase!=='finished';
 if(boardState()&&s.phase==='finished'&&replayRevision!==s.revision&&!replayLoading)loadReplay();
 $('log').replaceChildren();for(const m of s.moves.slice(-30).reverse()){const p=document.createElement('p');p.textContent=m.san?Math.ceil(m.number/2)+(m.number%2?'. ':'… ')+m.san+' · '+m.by:'#'+m.number+' · '+m.by+' ha passato il turno';$('log').append(p)}
 renderBoard();refreshDebug();sendPresence();
}
function connect(){
 clearTimeout(retry);if(!room)return;
 if(ws){ws.onclose=null;ws.close()}
 const selected=room,socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/room/'+room+'/ws',['checkmate',sessionToken]);ws=socket;
 socket.onopen=()=>{if(room!==selected)return;$('connection').textContent='● Collegato in diretta';trace('WS','Partita collegata');refreshDebug()};
 socket.onmessage=e=>{if(room!==selected)return;try{const s=JSON.parse(e.data);if(s.deleted){showLobby();err('La partita è stata eliminata da un partecipante.');return}render(s)}catch{err('Aggiornamento non valido.')}};
 socket.onclose=()=>{if(room!==selected)return;trace('WS','Partita disconnessa · nuovo tentativo tra 4 s');$('connection').textContent='○ Riconnessione…';retry=setTimeout(connect,4000)};
}
function connectLobby(){
 if(!sessionToken)return;
 clearTimeout(lobbyRetry);if(lobbyWS){lobbyWS.onclose=null;lobbyWS.close()}
 const socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/lobby/ws',['checkmate',sessionToken]);lobbyWS=socket;
 socket.onopen=()=>{$('lobby-connection').textContent='● In diretta';trace('WS','Sala partite collegata');$('lobby-connection').dataset.live='true';sendPresence();renderSocial()};
 socket.onmessage=e=>{try{const data=JSON.parse(e.data);games=data.games;onlineUsers=data.users||[];chatMessages=data.messages||[];renderLobby();renderSocial()}catch{err('Elenco non valido.')}};
 socket.onerror=()=>trace('ERROR','Connessione sala partite');
 socket.onclose=()=>{trace('WS','Sala disconnessa · nuovo tentativo tra 4 s');$('lobby-connection').textContent='Riconnessione…';$('lobby-connection').dataset.live='false';renderSocial();lobbyRetry=setTimeout(connectLobby,4000)};
}
function nickname(field='name'){
 const value=identity?.name||'Utente Telegram';if(!value)throw Error('Inserisci il tuo nome.');save('binotto-name',value);$('name').textContent=value;return value;
}
function action(id,fn){$(id).onclick=async()=>{if(busy)return;busy=true;$(id).disabled=true;err('');try{await fn()}catch(e){err(e.message)}finally{busy=false;$(id).disabled=false;if(state)render(state)}}}
$('create').onclick=()=>selectPage('games');
$('open-debug').onclick=()=>selectPage('debug');
$('back-settings').onclick=()=>selectPage('settings');
async function createGame(game){
 if(ownedGame())throw Error('Hai già una partita aperta: riprendila prima di crearne un’altra.');
 save('binotto-probe',true);const j=await api('create',{name:nickname(),game});
 stopRoom();room=j.state.room;state=null;credentials={token:j.token,player:j.player};save('binotto-'+room,credentials);selectPage('game');render(j.state);connect();renderLobby();
}
action('create-chess',()=>createGame('chess'));
action('create-checkers',()=>createGame('checkers'));

action('pass',async()=>render(await api('pass',{revision:state.revision})));
action('finish',async()=>{if(confirm('Concludere la partita per tutti?'))render(await api('finish',{revision:state.revision}))});
$('back-lobby').onclick=showLobby;
$('newtable').onclick=()=>{showLobby();$('name').focus()};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopReplay();sendPresence(true)}if(!document.hidden){connectLobby();if(room)connect()}});
function refreshDebug(){
 const entries=[['Interfaccia','Binottoland 1.1'],['Identità',identity?identity.name+' · Telegram verificato':'Non autenticato'],['Online',onlineUsers.length],['Partita',state?.number||'Sala partite'],['Partite elencate',games.length],['Stato',state?.phase||'Ingresso'],['Revisione',state?.revision??'—'],['Ruolo',state?(state.players.some(p=>p.id===credentials.player)?'Giocatore':'Spettatore'):'—'],['Connessione',(ws||lobbyWS)?(['In apertura','Connessa','In chiusura','Chiusa'][(ws||lobbyWS).readyState]):'Non attiva'],['Motore',state?.checkers?'Dama italiana':state?.chess?'Scacchi':'Lobby'],['Viewport',innerWidth+' × '+innerHeight]];
 $('debug-info').replaceChildren();
 for(const [label,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);$('debug-info').append(dt,dd)}
}
function selectPage(page){
 $('draw-dialog').hidden=true;
 const activeTab=page==='debug'?'settings':page;
 document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.page===activeTab;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});
 document.querySelectorAll('.page').forEach(section=>section.hidden=section.id!=='page-'+page);
 if(page!=='game')stopReplay();trace('UI','Pagina '+page);
 if(page==='debug')refreshDebug();if(page==='game')requestAnimationFrame(fitBoard);
}
document.querySelectorAll('.tab').forEach((tab,index,tabs)=>{
 tab.onclick=()=>{if(tab.dataset.page==='game')showLobby();selectPage(tab.dataset.page)};
 tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();if(tabs[next].dataset.page==='game')showLobby();selectPage(tabs[next].dataset.page)}
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
 const height=tg?.viewportStableHeight||window.visualViewport?.height||innerHeight;
 document.documentElement.style.setProperty('--app-height',height+'px');requestAnimationFrame(fitBoard);
}
tg?.onEvent('viewportChanged',fitViewport);window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);
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
function canMove(){return replayPly===null&&!state?.archived&&state?.phase==='playing'&&state.players[state.turn]?.id===credentials.player&&!busy}
function renderBoard(){
 $('chess-area').hidden=!boardState();if(!boardState())return;
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
  if(dark){const coord=document.createElement('span');coord.className='coord square-number';coord.textContent=number;button.append(coord)}
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
 if(!canMove())return;
 busy=true;capturePath=[];selectedSquare=null;promotionMove=null;$('promotion').hidden=true;renderBoard();trace('MOVE',move.path?move.path.join(' → '):move.from+' → '+move.to+(move.promotion?' = '+move.promotion:''));
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
  const names=document.createElement('p');names.textContent=game.players.map(p=>p.name).join(' · ');
  const button=document.createElement('button');button.className='alt';button.textContent='Apri e rivedi le mosse';
  button.onclick=async()=>{await openRoom(game.room);if(room===game.room)selectPage('game')};
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
  if(selected!==room||epoch!==roomEpoch)return;
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
action('archive-game',async()=>{
 if(!confirm('Archiviare questa partita? Se è in corso, verrà conclusa e spostata in Debug.'))return;
 stopReplay();render(await api('archive',{revision:state.revision}));
 const result=await request('/api/lobby');games=result.games;renderLobby();
 trace('ARCHIVE','Partita archiviata');
});
action('delete-game',async()=>{
 if(!confirm('Eliminare definitivamente questa partita e tutte le sue mosse per tutti?'))return;
 await api('delete',{revision:state.revision});showLobby();
 const result=await request('/api/lobby');games=result.games;renderLobby();trace('DELETE','Partita eliminata');
});


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



async function startSession(password){
 $('create').disabled=true;$('access-submit').disabled=true;$('access-error').textContent='Verifica dell’accesso…';
 try{
  if(!tg?.initData)throw Error('Apri questa Mini App da @checkmategame_bot per usare il tuo account Telegram.');
  const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData,password})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Accesso non riuscito.');
  identity=data.user;sessionToken=data.token;$('name').textContent=identity.name;renderProfile();$('auth-notice').hidden=true;$('club-gate').hidden=true;$('app-shell').hidden=false;
  trace('AUTH','Identità Telegram verificata');
  const payload=await request('/api/lobby');games=payload.games;onlineUsers=payload.users||[];chatMessages=payload.messages||[];
  $('create').disabled=false;renderLobby();connectLobby();
 }catch(e){$('access-error').textContent=e.message;trace('AUTH','Accesso non completato')}finally{$('access-password').value='';$('access-submit').disabled=false}
}
function sendPresence(away=document.hidden){
 if(lobbyWS?.readyState===1)lobbyWS.send(JSON.stringify({type:'presence',room,away}));
}

function renderSocial(){
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
 const list=$('chat-messages'),bottom=list.scrollHeight-list.scrollTop-list.clientHeight<40;
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
  if(bottom)list.scrollTop=list.scrollHeight;
 }
 $('chat-send').disabled=chatSending||!identity||!connected;
}

$('chat-form').onsubmit=async event=>{
 event.preventDefault();if(chatSending)return;const input=$('chat-input'),text=input.value.trim();if(!text)return;chatSending=true;
 $('chat-send').disabled=true;
 try{const result=await request('/api/chat',{text});if(result.message&&!chatMessages.some(m=>m.id===result.message.id))chatMessages=[...chatMessages,result.message].slice(-100);if(input.value.trim()===text)input.value='';err('');renderSocial();$('chat-messages').scrollTop=$('chat-messages').scrollHeight}catch(e){err(e.message)}finally{chatSending=false;renderSocial()}
};
setInterval(()=>{if(!document.hidden)sendPresence()},25000);
window.addEventListener('pagehide',()=>{sendPresence(true);lobbyWS?.close()});
$('access-form').onsubmit=event=>{event.preventDefault();startSession($('access-password').value)};
if(!tg?.initData){$('access-submit').disabled=true;$('access-password').disabled=true;$('access-error').textContent='Apri Binottoland da Telegram per accedere.';$('access-telegram').hidden=false;}


