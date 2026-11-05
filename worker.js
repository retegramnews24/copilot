import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';
import { initialCheckers, playCheckers, checkersSnapshot, checkersKey } from './checkers.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const id=()=>crypto.randomUUID();
function chessSnapshot(game,lastMove=null){
 let result=null;
 if(game.isCheckmate())result=game.turn()==='w'?'0-1':'1-0';
 else if(game.isDraw())result='1/2-1/2';
 const reason=game.isCheckmate()?'Scaccomatto':game.isStalemate()?'Stallo':game.isThreefoldRepetition()?'Triplice ripetizione':game.isInsufficientMaterial()?'Materiale insufficiente':game.isDrawByFiftyMoves()?'Regola delle 50 mosse':null;
 return {fen:game.fen(),check:game.isCheck(),result,reason,lastMove,legalMoves:game.isGameOver()?[]:game.moves({verbose:true}).map(m=>({from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})}))};
}
const bad=(message)=>{throw new Error(message)};
const BOT_USERNAME='checkmategame_bot';
const name=x=>{if(typeof x!=='string'||!x.trim())bad('Inserisci un nome.');return x.trim().slice(0,30)};
async function webhookSecret(token){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function telegramCall(token,method,payload){
 const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
 });
 const result=await response.json().catch(()=>null);
 return {ok:response.ok&&result?.ok===true,description:result?.description||'Telegram non ha confermato la richiesta.'};
}
async function setupTelegram(req,env,u){
 if(!env.BOT_TOKEN)return json({error:'Secret BOT_TOKEN non configurato.'},503);
 if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'Richiesta troppo grande.'},413);
 try{
  const body=await req.json();
  if(typeof body.token!=='string'||body.token!==env.BOT_TOKEN)return json({error:'Token non valido.'},403);
  const secret=await webhookSecret(env.BOT_TOKEN);
  const hook=await telegramCall(env.BOT_TOKEN,'setWebhook',{
   url:u.origin+'/api/telegram/webhook',
   secret_token:secret,
   allowed_updates:['message']
  });
  if(!hook.ok)return json({error:'Telegram non ha attivato il webhook: '+hook.description},502);
  const commands=await telegramCall(env.BOT_TOKEN,'setMyCommands',{
   commands:[{command:'start',description:'Avvia Binottoland'},{command:'gioca',description:'Apri una sfida Binottoland'}]
  });
  if(!commands.ok)return json({ok:true,webhook:true,warning:'Webhook attivo; comando non registrato: '+commands.description});
  return json({ok:true,webhook:true,command:true});
 }catch{return json({error:'Richiesta di configurazione non valida.'},400)}
}
async function telegramWebhook(req,env){
 if(!env.BOT_TOKEN)return json({error:'BOT_TOKEN non configurato.'},503);
 const supplied=req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';
 if(supplied!==await webhookSecret(env.BOT_TOKEN))return json({error:'Richiesta Telegram non autorizzata.'},403);
 if(Number(req.headers.get('Content-Length')||0)>8192)return json({ok:true});
 try{
  const update=await req.json();
  const message=update?.message;
  const text=typeof message?.text==='string'?message.text.trim():'';
  if(!message||message.from?.is_bot||!text)return json({ok:true});
  const match=text.match(/^\/(?:gioca|start)(?:@([A-Za-z0-9_]+))?(?:\s|$)/i);
  if(!match||(match[1]&&match[1].toLowerCase()!==BOT_USERNAME))return json({ok:true});
  const sent=await telegramCall(env.BOT_TOKEN,'sendMessage',{
   chat_id:message.chat.id,
   text:'Benvenuto nel circolo Binottoland. Lobby, amici e tavoli da gioco.',
   reply_markup:{inline_keyboard:[[{text:'Apri Binottoland',url:'https://t.me/'+BOT_USERNAME+'?startapp'}]]}
  });
  if(!sent.ok)return json({error:'Invio del pulsante non riuscito.'},502);
  return json({ok:true});
 }catch{return json({ok:true})}
}


const encoder=new TextEncoder();
async function mac(key,text){
 const k=await crypto.subtle.importKey('raw',typeof key==='string'?encoder.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(text)));
}
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
async function login(req,env){
 try{
  if(!env.BOT_TOKEN)return json({error:'BOT_TOKEN mancante.'},503);
  const body=await req.json();if(typeof body.initData!=='string'||body.initData.length>16384)throw Error();
  const p=new URLSearchParams(body.initData),hash=p.get('hash');p.delete('hash');
  const keys=[...p.keys()];if(new Set(keys).size!==keys.length)throw Error();
  const checked=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const secret=await mac('WebAppData',env.BOT_TOKEN);
  if(!hash||hex(await mac(secret,checked))!==hash)throw Error();
  const age=Date.now()/1000-Number(p.get('auth_date'));
  if(!Number.isFinite(age)||age< -60||age>86400)throw Error();
  const u=JSON.parse(p.get('user')||'null');if(!u||!Number.isSafeInteger(u.id)||u.id<=0)throw Error();
  const user={id:String(u.id),player:'tg:'+u.id,name:[u.first_name,u.last_name].filter(Boolean).join(' ').slice(0,60)||'Utente Telegram',username:typeof u.username==='string'?u.username.slice(0,40):'',photo:typeof u.photo_url==='string'&&u.photo_url.startsWith('https://')&&u.photo_url.length<=512?u.photo_url:''};
  if(!env.ACCESS_PASSWORD)return json({error:'Accesso riservato in configurazione.'},503);
  const access=await env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1')).fetch(new Request('https://internal/lobby/access',{method:'POST',body:JSON.stringify({userId:user.id,password:typeof body.password==='string'?body.password:''})}));
  if(!access.ok)return access;
  const accessTag=hex(await mac(env.BOT_TOKEN,'club-access:'+env.ACCESS_PASSWORD));
  const payload=btoa(String.fromCharCode(...encoder.encode(JSON.stringify({user,accessTag,expires:Date.now()+12*3600000})))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const token='session.'+payload+'.'+hex(await mac(env.BOT_TOKEN,'session.'+payload));
  return json({user,token});
 }catch{return json({error:'Accesso Telegram non valido o scaduto. Chiudi e riapri la Mini App dal bot.'},401)}
}
async function sessionUser(req,env){
 try{
  const offered=(req.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(x=>x.trim());
  const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'')||offered.find(x=>x.startsWith('session.'));
  const m=String(token||'').match(/^session\.([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/);
  if(!m||!env.BOT_TOKEN||hex(await mac(env.BOT_TOKEN,'session.'+m[1]))!==m[2])return null;
  const payload=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1].replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));
  if(!env.ACCESS_PASSWORD||payload.accessTag!==hex(await mac(env.BOT_TOKEN,'club-access:'+env.ACCESS_PASSWORD)))return null;
  return payload.expires>Date.now()?payload.user:null;
 }catch{return null}
}

export default {
 async fetch(req,env){
  const u=new URL(req.url);
  if(u.pathname==='/api/telegram/setup'&&req.method==='POST'){
   if(req.headers.get('Origin')&&req.headers.get('Origin')!==u.origin)return json({error:'Origine non consentita.'},403);
   return setupTelegram(req,env,u);
  }
  if(u.pathname==='/api/telegram/webhook'&&req.method==='POST')return telegramWebhook(req,env);
  if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==u.origin)return json({error:'Origine non consentita.'},403);
  if(u.pathname==='/api/health')return json({ok:true,version:'1.1.0'});

  if(u.pathname==='/api/session'&&req.method==='POST')return login(req,env);
  const user=await sessionUser(req,env);
  if(!user)return json({error:'Apri Binottoland da Telegram per accedere.'},401);
  const trustedHeaders=new Headers(req.headers);trustedHeaders.set('X-Checkmate-User',JSON.stringify(user));trustedHeaders.set('X-Access-Tag',hex(await mac(env.BOT_TOKEN,'club-access:'+env.ACCESS_PASSWORD)));req=new Request(req,{headers:trustedHeaders});
  const lobby=env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));
  if(u.pathname==='/api/chat'&&req.method==='POST')return lobby.fetch(new Request(u.origin+'/lobby/chat',req));
  if(u.pathname==='/api/lobby'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/list'));
  if(u.pathname==='/api/lobby/ws'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/ws',req));
  if(req.method==='POST'&&u.pathname==='/api/create'){
   const raw=await req.text();
   if(raw.length>4096)return json({error:'Richiesta troppo grande.'},413);
   return lobby.fetch(new Request(u.origin+'/lobby/create',{method:'POST',body:raw,headers:{'X-Checkmate-User':JSON.stringify(user)}}));
  }
  const match=u.pathname.match(/^\/api\/room\/([a-f0-9-]{36})\/(state|claim|move|pass|finish|archive|delete|replay|offer-draw|accept-draw|reject-draw|ws)$/);
  if(!match)return json({error:'Percorso non trovato.'},404);

  if(match[2]==='claim'&&req.method==='POST')return lobby.fetch(new Request(u.origin+'/lobby/join',{method:'POST',headers:{'X-Checkmate-User':JSON.stringify(user)},body:JSON.stringify({room:match[1]})}));
  const response=await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(req);
  if(response.ok&&(req.method==='POST'||match[2]==='state')){
   const result=await response.clone().json();
   const s=result.state||result;
   await lobby.fetch(new Request(u.origin+(s.deleted?'/lobby/remove':'/lobby/update'),{method:'POST',body:JSON.stringify({room:s.room,number:s.number,game:s.game||'chess',archived:!!s.archived,phase:s.phase,players:s.players,turn:s.turn,revision:s.revision,created:s.created,expires:s.expires})}));
  }
  return response;
 }
};
export class Room extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;}
 public(s){return {room:s.room,number:s.number||null,game:s.game||'chess',archived:!!s.archived,phase:s.phase,players:s.players.map(p=>({id:p.id,name:p.name})),turn:s.turn,revision:s.revision,moves:s.moves,drawOffer:s.drawOffer||null,chess:s.chess||null,checkers:s.checkers||null,created:s.created,expires:s.expires}}
 async broadcast(s){const msg=JSON.stringify(this.public(s)),tag=this.env.ACCESS_PASSWORD?hex(await mac(this.env.BOT_TOKEN,'club-access:'+this.env.ACCESS_PASSWORD)):null;for(const ws of this.ctx.getWebSockets()){try{if(!tag||ws.deserializeAttachment()?.accessTag!==tag){ws.close(4001,'Riapri la Mini App');continue}ws.send(msg)}catch{}}}
 async fetch(req){
  if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'Richiesta troppo grande.'},413);
  return this.ctx.blockConcurrencyWhile(async()=>{
   try{
    const path=new URL(req.url).pathname;
    if(path.startsWith('/lobby/'))return this.lobby(req,path);
    let s=await this.ctx.storage.get('state');
    if(path==='/init'){
     if(s)return json({error:'Stanza già esistente.'},409);
     const raw=await req.text();if(raw.length>4096)bad('Richiesta troppo grande.');const b=JSON.parse(raw);const token=id();
     s={room:req.headers.get('X-Room'),number:b.number||null,phase:'waiting',players:[{id:b.playerId||id(),name:name(b.name),token}],turn:0,revision:0,moves:[],game:b.game==='checkers'?'checkers':'chess',chess:b.game==='checkers'?null:chessSnapshot(new Chess()),...(b.game==='checkers'?{checkers:checkersSnapshot(initialCheckers()),positions:{[checkersKey(initialCheckers())]:1}}:{}),created:Date.now(),expires:Date.now()+7*86400000};
     await this.ctx.storage.put('state',s);await this.ctx.storage.setAlarm(s.expires);
     return json({token,player:s.players[0].id,state:this.public(s)});
    }
    if(!s||(!s.archived&&s.expires<Date.now()))return json({error:'Stanza inesistente o scaduta.'},404);
    if(path.endsWith('/ws')){
     if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);
     if(this.ctx.getWebSockets().length>=60)return json({error:'Stanza piena (60 connessioni).'},429);
     const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({accessTag:req.headers.get('X-Access-Tag')});pair[1].send(JSON.stringify(this.public(s)));
     return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'checkmate'}});
    }
    if(path.endsWith('/replay')&&req.method==='GET'){
     if(s.checkers){
      let game=initialCheckers();const frames=[{board:game.board,lastMove:null}];
      for(const entry of s.moves){const played=playCheckers(game,entry.path);game=played.game;frames.push({board:game.board,lastMove:played.move})}
      return json({room:s.room,revision:s.revision,frames});
     }
     if(!s.chess)return json({frames:[]});
     const game=new Chess(),frames=[{fen:game.fen(),lastMove:null}];
     for(const entry of s.moves){const m=game.move(entry.san);frames.push({fen:game.fen(),lastMove:{from:m.from,to:m.to}})}
     return json({room:s.room,revision:s.revision,frames});
    }
    if(path.endsWith('/state')&&req.method==='GET'){
     const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null'),legacy=req.headers.get('X-Player-Token');
     const old=s.players.find(p=>!p.id.startsWith('tg:')&&legacy&&p.token===legacy);
     if(user&&old&&!s.players.some(p=>p.id===user.player)){
      old.id=user.player;old.name=name(user.name);s.revision++;
      await this.ctx.storage.put('state',s);await this.broadcast(s);
     }
     return json(this.public(s));
    }
    if(req.method!=='POST')return json({error:'Metodo non consentito.'},405);
    const raw=await req.text();if(raw.length>4096)bad('Richiesta troppo grande.');const b=JSON.parse(raw||'{}');
    if(path.endsWith('/claim')){
     if(s.phase!=='waiting')return json({error:'Il secondo posto è già occupato. Puoi assistere.'},409);
     const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
     if(s.players.some(p=>p.id===user?.player))return json({error:'Sei già un giocatore di questa partita.'},409);
     const token=id(),p={id:user?.player||id(),name:name(user?.name||b.name),token};s.players.push(p);s.phase='playing';s.revision++;
     await this.ctx.storage.put('state',s);await this.broadcast(s);return json({token,player:p.id,state:this.public(s)});
    }
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');const legacy=req.headers.get('X-Player-Token');const who=s.players.findIndex(p=>p.id===user?.player||(!p.id.startsWith('tg:')&&legacy&&p.token===legacy));
    if(who<0)return json({error:'Solo i giocatori possono agire.'},403);
    if(path.endsWith('/archive')||path.endsWith('/delete')){
     if(b.revision!==s.revision)return json({error:'La partita è cambiata. Aggiorna e riprova.'},409);
     if(path.endsWith('/delete')){
      const result={room:s.room,number:s.number,deleted:true};
      await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();
      for(const ws of this.ctx.getWebSockets()){try{ws.send(JSON.stringify(result));ws.close(1000,'Partita eliminata')}catch{}}
      return json(result);
     }
     s.archived=true;s.phase='finished';s.expires=null;s.revision++;
     if(s.chess)s.chess={...s.chess,legalMoves:[],reason:s.chess.reason||'Archiviata'};
     if(s.checkers)s.checkers={...s.checkers,legalMoves:[],reason:s.checkers.reason||'Archiviata'};
     await this.ctx.storage.deleteAlarm();await this.ctx.storage.put('state',s);await this.broadcast(s);
     return json(this.public(s));
    }
    if(s.phase!=='playing'&&!(s.phase==='waiting'&&path.endsWith('/finish')))return json({error:'Partita non attiva.'},409);
    if(b.revision!==s.revision)return json({error:'La partita è cambiata. Riprova dopo l’aggiornamento.'},409);
    if(path.endsWith('/offer-draw')){
     if((!s.chess&&!s.checkers)||s.phase!=='playing')return json({error:'Patta disponibile solo durante una partita.'},409);
     if(s.drawOffer)return json({error:'C’è già una proposta in attesa.'},409);
     if(s.lastDrawOffer?.by===who&&s.lastDrawOffer?.ply===s.moves.length)return json({error:'Attendi una nuova mossa prima di proporre ancora la patta.'},409);
     s.drawOffer={by:s.players[who].id,name:s.players[who].name};s.lastDrawOffer={by:who,ply:s.moves.length};
    }else if(path.endsWith('/accept-draw')||path.endsWith('/reject-draw')){
     if(!s.drawOffer||s.drawOffer.by===s.players[who].id)return json({error:'Non puoi rispondere a questa proposta.'},403);
     if(path.endsWith('/accept-draw')){s.phase='finished';const key=s.checkers?'checkers':'chess';s[key]={...s[key],legalMoves:[],reason:'Patta concordata',result:'1/2-1/2'}}
     s.drawOffer=null;
    }else if(path.endsWith('/move')&&s.checkers){
     if(who!==s.turn)return json({error:'Non è il tuo turno.'},403);
     const played=playCheckers(s.checkers,b.path),key=checkersKey(played.game);
     s.positions=s.positions||{};s.positions[key]=(s.positions[key]||0)+1;
     s.moves.push({...played.move,by:s.players[who].name,at:Date.now(),number:s.moves.length+1});
     s.drawOffer=null;s.turn=played.game.turn;
     s.checkers=checkersSnapshot(played.game,played.move,s.positions[key]);
     if(s.checkers.result)s.phase='finished';
    }else if(path.endsWith('/move')){
     if(!s.chess)return json({error:'Questa è una stanza di prova precedente. Crea una nuova partita per giocare a scacchi.'},409);
     if(who!==s.turn)return json({error:'Non è il tuo turno.'},403);
     if(typeof b.from!=='string'||typeof b.to!=='string')return json({error:'Mossa non valida.'},400);
     const game=new Chess();
     for(const move of s.moves)game.move(move.san);
     let moved;try{moved=game.move({from:b.from,to:b.to,promotion:b.promotion||'q'})}catch{return json({error:'Mossa non consentita.'},400)}
     s.moves.push({by:s.players[who].name,at:Date.now(),number:s.moves.length+1,san:moved.san,from:moved.from,to:moved.to,...(moved.promotion?{promotion:moved.promotion}:{})});
     s.drawOffer=null;s.turn=game.turn()==='w'?0:1;
     s.chess=chessSnapshot(game,{from:moved.from,to:moved.to});
     if(game.isGameOver())s.phase='finished';
    }else if(path.endsWith('/pass')){
     if(s.chess||s.checkers)return json({error:'Devi effettuare una mossa.'},409);
     if(who!==s.turn)return json({error:'Non è il tuo turno.'},403);
     s.moves.push({by:s.players[who].name,at:Date.now(),number:s.moves.length+1});s.turn=1-s.turn;
     if(s.moves.length>=500)s.phase='finished';
    }else if(path.endsWith('/finish')){s.phase='finished';if(s.chess)s.chess={...s.chess,legalMoves:[],reason:'Partita chiusa',result:null};if(s.checkers)s.checkers={...s.checkers,legalMoves:[],reason:'Partita chiusa',result:null};}else bad('Azione non valida.');
    s.revision++;await this.ctx.storage.put('state',s);await this.broadcast(s);return json(this.public(s));
   }catch(e){return json({error:e instanceof SyntaxError?'Richiesta non valida.':e.message},400)}
  });
 }

 summary(s){return {room:s.room,number:s.number,game:s.game||'chess',archived:!!s.archived,phase:s.phase,players:s.players,turn:s.turn,revision:s.revision,created:s.created,expires:s.expires};}
 async lobbyList(){
  const entries=await this.ctx.storage.list({prefix:'game:'});
  return [...entries.values()].filter(s=>s.archived||s.expires>Date.now()).sort((a,b)=>a.number-b.number);
 }

 async lobbyPayload(){
  const games=await this.lobbyList(),unique=new Map(),tag=this.env.ACCESS_PASSWORD?hex(await mac(this.env.BOT_TOKEN,'club-access:'+this.env.ACCESS_PASSWORD)):null;
  for(const ws of this.ctx.getWebSockets()){
   const a=ws.deserializeAttachment();if(!tag||!a||a.accessTag!==tag||a.kind!=='lobby'||a.closed||Date.now()-a.seen>65000)continue;
   const prior=unique.get(a.user.id);if(!prior||a.room)unique.set(a.user.id,a);
  }
  const users=[...unique.values()].map(a=>{
   const own=games.find(g=>!g.archived&&g.phase!=='finished'&&g.players.some(p=>p.id===a.user.player));
   const watching=games.find(g=>g.room===a.room);
   return {...a.user,status:own?'In partita '+own.number:watching?'Guarda '+watching.number:'In Lobby',game:own?.room||null};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  return {games,users,messages:await this.ctx.storage.get('chat')||[]};
 }
 async lobbyBroadcast(force=true){
  const payload=await this.lobbyPayload(),signature=JSON.stringify(payload.users);
  if(!force&&signature===this.presenceSignature)return;
  this.presenceSignature=signature;
  const message=JSON.stringify(payload),tag=this.env.ACCESS_PASSWORD?hex(await mac(this.env.BOT_TOKEN,'club-access:'+this.env.ACCESS_PASSWORD)):null;
  for(const ws of this.ctx.getWebSockets()){try{if(!tag||ws.deserializeAttachment()?.accessTag!==tag){ws.close(4001,'Riapri la Mini App');continue}ws.send(message)}catch{}}
 }
 async lobby(req,path){
  if(path==='/lobby/list')return json(await this.lobbyPayload());
  if(path==='/lobby/ws'){
   if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);
   if(this.ctx.getWebSockets().length>=120)return json({error:'Troppe connessioni.'},429);
   const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');if(!user)return json({error:'Accesso richiesto.'},401);
   const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({kind:'lobby',user,room:null,seen:Date.now(),closed:false,accessTag:req.headers.get('X-Access-Tag')});
   await this.lobbyBroadcast();
   return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'checkmate'}});
  }
  if(req.method!=='POST')return json({error:'Metodo non consentito.'},405);
  const body=await req.json();
  if(path==='/lobby/access'){
   if(!this.env.ACCESS_PASSWORD)return json({error:'Accesso riservato in configurazione.'},503);
   const key='access-attempt:'+body.userId,now=Date.now(),saved=await this.ctx.storage.get(key);
   const attempt=saved&&now-saved.start<15*60000?saved:{count:0,start:now};
   if(attempt.count>=5)return json({error:'Troppi tentativi. Riprova tra 15 minuti.'},429);
   if(body.password!==this.env.ACCESS_PASSWORD){attempt.count++;await this.ctx.storage.put(key,attempt);return json({error:'Password non corretta.'},403)}
   await this.ctx.storage.delete(key);return json({ok:true});
  }
  if(path==='/lobby/join'){
   const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');if(!user)return json({error:'Accesso richiesto.'},401);
   if((await this.lobbyList()).some(g=>g.room!==body.room&&!g.archived&&g.phase!=='finished'&&g.players.some(p=>p.id===user.player)))return json({error:'Hai già una partita aperta. Puoi guardare le altre.'},409);
   const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(body.room));
   const response=await stub.fetch(new Request('https://internal/api/room/'+body.room+'/claim',{method:'POST',headers:{'X-Checkmate-User':JSON.stringify(user)},body:JSON.stringify({name:user.name})}));
   if(response.ok){const result=await response.clone().json();await this.ctx.storage.put('game:'+body.room,this.summary(result.state));await this.lobbyBroadcast()}
   return response;
  }
  if(path==='/lobby/chat'){
   const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
   if(!user||(await this.lobbyPayload()).users.every(u=>u.id!==user.id))return json({error:'Collegati alla Lobby prima di scrivere.'},409);
   const text=typeof body.text==='string'?body.text.trim():'';
   if(!text||text.length>500)return json({error:'Scrivi da 1 a 500 caratteri.'},400);
   const last=await this.ctx.storage.get('chatlimit:'+user.id)||0;
   if(Date.now()-last<1500)return json({error:'Attendi un momento prima del prossimo messaggio.'},429);
   const messages=await this.ctx.storage.get('chat')||[],message={id:id(),userId:user.id,name:user.name,photo:user.photo||'',text,at:Date.now()};
   messages.push(message);await this.ctx.storage.put('chat',messages.slice(-100));await this.ctx.storage.put('chatlimit:'+user.id,Date.now());
   await this.lobbyBroadcast();return json({ok:true,message});
  }
  if(path==='/lobby/create'){
   const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');if(!user)return json({error:'Accesso richiesto.'},401);
   const playerName=name(user.name);
   if(body.game!==undefined&&!['chess','checkers'].includes(body.game))return json({error:'Gioco non disponibile.'},400);
   if((await this.lobbyList()).some(g=>!g.archived&&g.phase!=='finished'&&g.players.some(p=>p.id===user.player)))return json({error:'Hai già una partita aperta.'},409);
   const number=(await this.ctx.storage.get('lobbyCounter')||0)+1;
   await this.ctx.storage.put('lobbyCounter',number);
   const room=id(),stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(room));
   const response=await stub.fetch(new Request('https://internal/init',{method:'POST',headers:{'X-Room':room},body:JSON.stringify({name:playerName,number,playerId:user.player,game:body.game||'chess'})}));
   if(!response.ok)return response;
   const result=await response.json();
   await this.ctx.storage.put('game:'+room,this.summary(result.state));
   await this.ctx.storage.setAlarm(Date.now()+3600000);
   await this.lobbyBroadcast();
   return json(result);
  }
  if(path==='/lobby/remove'){
   await this.ctx.storage.delete('game:'+body.room);if(!(await this.ctx.storage.list({prefix:'game:'})).size)await this.ctx.storage.put('lobbyCounter',0);await this.lobbyBroadcast();return json({ok:true});
  }
  if(path==='/lobby/update'){
   const old=await this.ctx.storage.get('game:'+body.room);
   if(old&&body.revision>old.revision){
    await this.ctx.storage.put('game:'+body.room,this.summary({...body,number:old.number}));
    await this.lobbyBroadcast();
   }
   return json({ok:true});
  }
  return json({error:'Percorso non trovato.'},404);
 }

 async webSocketMessage(ws,message){
  const a=ws.deserializeAttachment();if(!this.env.ACCESS_PASSWORD||a?.accessTag!==hex(await mac(this.env.BOT_TOKEN,'club-access:'+this.env.ACCESS_PASSWORD))){ws.close(4001,'Riapri la Mini App');return}if(a?.kind!=='lobby'){ws.close(1008,'Sola lettura.');return}
  try{
   if(typeof message!=='string'||message.length>512)return;
   const b=JSON.parse(message);if(b.type!=='presence')return;
   a.room=typeof b.room==='string'&&/^[a-f0-9-]{36}$/.test(b.room)?b.room:null;
   a.seen=Date.now();a.closed=!!b.away;ws.serializeAttachment(a);await this.lobbyBroadcast(false);
  }catch{}
 }
 async webSocketClose(ws,code){const a=ws.deserializeAttachment();if(a?.kind==='lobby'){a.closed=true;ws.serializeAttachment(a);await this.lobbyBroadcast()}ws.close(code===1006?1000:code);}
 webSocketError(ws){ws.close(1011,'Riconnettersi.');}
 async alarm(){
 if(await this.ctx.storage.get('lobbyCounter')!==undefined){
  const entries=await this.ctx.storage.list({prefix:'game:'});
  for(const [key,value] of entries){if(!value.archived&&value.expires<=Date.now())await this.ctx.storage.delete(key)}
  await this.lobbyBroadcast();
  if((await this.lobbyList()).some(g=>!g.archived))await this.ctx.storage.setAlarm(Date.now()+3600000);
  return;
 }
 if((await this.ctx.storage.get('state'))?.archived)return;
 for(const ws of this.ctx.getWebSockets())ws.close(1000,'Stanza scaduta.');await this.ctx.storage.deleteAll();}
}

