const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
const $=id=>document.getElementById(id);
let selectedSquare=null,boardFlipped=null,promotionMove=null;
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
$('name').value=read('binotto-name','');
history.replaceState(null,'',location.pathname);
function err(s){$('error').textContent=s;if(s)trace('ERROR',s)}
async function request(path,data){
 const started=performance.now();trace('HTTP',(data?'POST ':'GET ')+path);
 try{
  const response=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(credentials.token||'')},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();trace(response.ok?'OK':'ERROR',response.status+' '+path+' · '+Math.round(performance.now()-started)+' ms');
  if(!response.ok)throw Error(result.error||'Errore server');return result;
 }catch(error){trace('ERROR',error.message);throw error}
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
 selectedSquare=null;promotionMove=null;boardFlipped=null;$('promotion').hidden=true;roomEpoch++;clearTimeout(retry);if(ws){ws.onclose=null;ws.close();ws=null}
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
 if(!state||s.revision!==state.revision){selectedSquare=null;promotionMove=null;$('promotion').hidden=true;trace('STATE','Partita '+s.number+' · '+s.phase+' · rev '+s.revision)}
 state=s;$('lobby').hidden=true;$('table').hidden=false;
 const mine=s.players.findIndex(p=>p.id===credentials.player);
 $('room-number').textContent=s.number?'Partita '+s.number:'Partita';
 $('status').textContent=s.phase==='waiting'?'In attesa di un avversario':s.phase==='finished'?(s.chess?.reason||'Partita conclusa')+(s.chess?.result?' · '+s.chess.result:''):'Turno di '+s.players[s.turn].name+(s.chess?.check?' · Scacco':'');
 $('players').replaceChildren();
 for(let i=0;i<2;i++){const el=document.createElement('div');el.className='person'+(s.phase==='playing'&&s.turn===i?' active':'');el.textContent=(s.chess?(i===0?'Bianco · ':'Nero · '):'')+(s.players[i]?.name||'Posto libero');$('players').append(el)}
 $('role').textContent=mine<0?'Stai assistendo.':'Sei il giocatore '+(mine+1)+'.';
 $('join-name').hidden=s.phase!=='waiting'||mine>=0;
 $('claim').hidden=s.phase!=='waiting'||mine>=0;
 $('pass').hidden=!!s.chess||s.phase!=='playing'||mine<0;$('pass').disabled=mine!==s.turn||busy;
 $('finish').hidden=s.phase==='finished'||mine<0;
 $('newtable').hidden=mine>=0&&s.phase!=='finished';
 $('expires').textContent='Disponibile fino al '+new Date(s.expires).toLocaleString('it-IT');
 $('log').replaceChildren();for(const m of s.moves.slice(-30).reverse()){const p=document.createElement('p');p.textContent=m.san?Math.ceil(m.number/2)+(m.number%2?'. ':'… ')+m.san+' · '+m.by:'#'+m.number+' · '+m.by+' ha passato il turno';$('log').append(p)}
 renderBoard();refreshDebug();
}
function connect(){
 clearTimeout(retry);if(!room)return;
 if(ws){ws.onclose=null;ws.close()}
 const selected=room,socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/room/'+room+'/ws');ws=socket;
 socket.onopen=()=>{if(room!==selected)return;$('connection').textContent='● Collegato in diretta';trace('WS','Partita collegata');refreshDebug()};
 socket.onmessage=e=>{if(room!==selected)return;try{render(JSON.parse(e.data))}catch{err('Aggiornamento non valido.')}};
 socket.onclose=()=>{if(room!==selected)return;trace('WS','Partita disconnessa · nuovo tentativo tra 4 s');$('connection').textContent='○ Riconnessione…';retry=setTimeout(connect,4000)};
}
function connectLobby(){
 clearTimeout(lobbyRetry);if(lobbyWS){lobbyWS.onclose=null;lobbyWS.close()}
 const socket=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/lobby/ws');lobbyWS=socket;
 socket.onopen=()=>{$('lobby-connection').textContent='● Elenco in diretta';trace('WS','Sala partite collegata')};
 socket.onmessage=e=>{try{games=JSON.parse(e.data).games;trace('LOBBY',games.length+' partite aggiornate');renderLobby()}catch{err('Elenco non valido.')}};
 socket.onerror=()=>trace('ERROR','Connessione sala partite');
 socket.onclose=()=>{trace('WS','Sala disconnessa · nuovo tentativo tra 4 s');$('lobby-connection').textContent='○ Riconnessione elenco…';lobbyRetry=setTimeout(connectLobby,4000)};
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
 const entries=[['Interfaccia','Checkmate! 0.5'],['Ambiente',tg?.initData?'Telegram':'Browser'],['Partita',state?.number||'Sala partite'],['Partite elencate',games.length],['Stato',state?.phase||'Ingresso'],['Revisione',state?.revision??'—'],['Ruolo',state?(state.players.some(p=>p.id===credentials.player)?'Giocatore':'Spettatore'):'—'],['Connessione',(ws||lobbyWS)?(['In apertura','Connessa','In chiusura','Chiusa'][(ws||lobbyWS).readyState]):'Non attiva'],['Motore',state?.chess?'Scacchi':'Prototipo / sala'],['Viewport',innerWidth+' × '+innerHeight]];
 $('debug-info').replaceChildren();
 for(const [label,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);$('debug-info').append(dt,dd)}
}
function selectPage(page){
 document.querySelectorAll('.tab').forEach(tab=>{const selected=tab.dataset.page===page;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$('page-'+tab.dataset.page).hidden=!selected});
 trace('UI','Pagina '+page);if(page==='debug')refreshDebug();if(page==='game')requestAnimationFrame(fitBoard);
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
function canMove(){return state?.phase==='playing'&&state.players[state.turn]?.id===credentials.player&&!busy}
function renderBoard(){
 $('chess-area').hidden=!state?.chess;if(!state?.chess)return;
 const mine=state.players.findIndex(p=>p.id===credentials.player);
 const flipped=boardFlipped===null?mine===1:boardFlipped;
 const files=flipped?'hgfedcba':'abcdefgh',ranks=flipped?'12345678':'87654321';
 const pieces=position(state.chess.fen),targets=(state.chess.legalMoves||[]).filter(m=>m.from===selectedSquare);
 $('board').replaceChildren();
 for(let ri=0;ri<8;ri++)for(let fi=0;fi<8;fi++){
  const square=files[fi]+ranks[ri],piece=pieces[square],button=document.createElement('button');
  const dark=('abcdefgh'.indexOf(square[0])+Number(square[1]))%2===1;
  button.className='square'+(dark?' dark':'')+(piece?' occupied':'')+(selectedSquare===square?' selected':'')+(targets.some(m=>m.to===square)?' target':'')+([state.chess.lastMove?.from,state.chess.lastMove?.to].includes(square)?' last':'');
  button.setAttribute('aria-label',square+(piece?' · '+pieceNames[piece.toLowerCase()]+' '+(piece===piece.toUpperCase()?'bianco':'nero'):' · vuota'));
  button.setAttribute('aria-disabled',String(!canMove()));
  if(piece)button.innerHTML=pieceSvg(piece);
  if(fi===0){const rank=document.createElement('span');rank.className='coord rank';rank.textContent=ranks[ri];button.append(rank)}
  if(ri===7){const file=document.createElement('span');file.className='coord file';file.textContent=files[fi];button.append(file)}
  button.onclick=()=>selectSquare(square,pieces);$('board').append(button);
 }
 $('board-hint').textContent=state.phase==='waiting'?'In attesa del Nero':state.phase==='finished'?'Partita conclusa':mine<0?'Vista spettatore':canMove()?'Tocca un pezzo, poi la destinazione':'Attendi la mossa avversaria';
 const strip=$('move-history'),atBottom=strip.scrollHeight-strip.scrollTop-strip.clientHeight<20;strip.replaceChildren();
 if(!state.moves.length)strip.textContent='Nessuna mossa.';
 for(let i=0;i<state.moves.length;i+=2){const span=document.createElement('span');span.textContent=(i/2+1)+'. '+state.moves[i].san+(state.moves[i+1]?' '+state.moves[i+1].san:'');strip.append(span)}
 if(atBottom)strip.scrollTop=strip.scrollHeight;
 requestAnimationFrame(fitBoard);
}
function fitBoard(){
 const page=$('page-game'),table=$('table'),board=$('board');
 if(!state?.chess||page.hidden||table.hidden||!page.clientHeight)return;
 const fixed=table.scrollHeight-board.offsetHeight;
 const available=page.clientHeight-fixed-20;
 board.style.width=Math.min(480,board.parentElement.clientWidth,Math.max(216,available))+'px';
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
 busy=true;selectedSquare=null;promotionMove=null;$('promotion').hidden=true;renderBoard();trace('MOVE',move.from+' → '+move.to+(move.promotion?' = '+move.promotion:''));
 const current=room;
 try{const result=await api('move',move);if(room===current)render(result)}
 catch(e){err(e.message);if(room===current)try{render(await api('state'))}catch{}}
 finally{busy=false;if(room===current&&state)render(state)}
}
$('flip-board').onclick=()=>{const mine=state.players.findIndex(p=>p.id===credentials.player);boardFlipped=!(boardFlipped===null?mine===1:boardFlipped);renderBoard()};
document.querySelectorAll('[data-promotion]').forEach(button=>button.onclick=()=>{if(promotionMove)sendMove({...promotionMove,promotion:button.dataset.promotion})});
$('cancel-promotion').onclick=()=>{promotionMove=null;$('promotion').hidden=true};
function applyBoardTheme(theme){
 if(!['classic','forest','walnut'].includes(theme))theme='classic';
 document.documentElement.dataset.board=theme;
 document.querySelectorAll('[data-board-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.boardChoice===theme)));
}
applyBoardTheme(read('checkmate-board','classic'));
document.querySelectorAll('[data-board-choice]').forEach(button=>button.onclick=()=>{applyBoardTheme(button.dataset.boardChoice);try{save('checkmate-board',button.dataset.boardChoice);trace('UI','Scacchiera '+button.dataset.boardChoice)}catch(e){err(e.message)}});
$('clear-terminal').onclick=()=>{events.length=0;$('terminal').textContent='';trace('INFO','Registro pulito')};
$('copy-terminal').onclick=async()=>{try{await navigator.clipboard.writeText(events.join('\n'));$('debug-result').textContent='Log copiato.'}catch{$('debug-result').textContent='Copia non disponibile: puoi selezionare il testo del registro.'}};
window.addEventListener('error',event=>trace('ERROR',event.message||'Errore JavaScript'));
window.addEventListener('unhandledrejection',event=>trace('ERROR',event.reason?.message||'Operazione non completata'));
trace('BOOT','Checkmate! 0.5 · registro sessione attivo');

$('join-name-input').value=read('binotto-name','');
request('/api/lobby').then(result=>{games=result.games;renderLobby()}).catch(e=>err(e.message));
connectLobby();
