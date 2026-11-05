import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';
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
   text:'🏁 Pronti a giocare? Apri Binottoland per giocare.',
   reply_markup:{inline_keyboard:[[{text:'Apri il gioco',url:'https://t.me/'+BOT_USERNAME+'?startapp'}]]}
  });
  if(!sent.ok)return json({error:'Invio del pulsante non riuscito.'},502);
  return json({ok:true});
 }catch{return json({ok:true})}
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
  if(u.pathname==='/api/health')return json({ok:true,version:'0.7.0'});

  const lobby=env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));
  if(u.pathname==='/api/lobby'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/list'));
  if(u.pathname==='/api/lobby/ws'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/ws',req));
  if(req.method==='POST'&&u.pathname==='/api/create'){
   const raw=await req.text();
   if(raw.length>4096)return json({error:'Richiesta troppo grande.'},413);
   return lobby.fetch(new Request(u.origin+'/lobby/create',{method:'POST',body:raw}));
  }
  const match=u.pathname.match(/^\/api\/room\/([a-f0-9-]{36})\/(state|claim|move|pass|finish|archive|delete|replay|offer-draw|accept-draw|reject-draw|ws)$/);
  if(!match)return json({error:'Percorso non trovato.'},404);

  const response=await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(req);
  if(response.ok&&req.method==='POST'){
   const result=await response.clone().json();
   const s=result.state||result;
   await lobby.fetch(new Request(u.origin+(s.deleted?'/lobby/remove':'/lobby/update'),{method:'POST',body:JSON.stringify({room:s.room,number:s.number,archived:!!s.archived,phase:s.phase,players:s.players,turn:s.turn,revision:s.revision,created:s.created,expires:s.expires})}));
  }
  return response;
 }
};
export class Room extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;}
 public(s){return {room:s.room,number:s.number||null,archived:!!s.archived,phase:s.phase,players:s.players.map(p=>({id:p.id,name:p.name})),turn:s.turn,revision:s.revision,moves:s.moves,drawOffer:s.drawOffer||null,chess:s.chess||null,created:s.created,expires:s.expires}}
 broadcast(s){const msg=JSON.stringify(this.public(s));for(const ws of this.ctx.getWebSockets()){try{ws.send(msg)}catch{}}}
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
     s={room:req.headers.get('X-Room'),number:b.number||null,phase:'waiting',players:[{id:id(),name:name(b.name),token}],turn:0,revision:0,moves:[],chess:chessSnapshot(new Chess()),created:Date.now(),expires:Date.now()+7*86400000};
     await this.ctx.storage.put('state',s);await this.ctx.storage.setAlarm(s.expires);
     return json({token,player:s.players[0].id,state:this.public(s)});
    }
    if(!s||(!s.archived&&s.expires<Date.now()))return json({error:'Stanza inesistente o scaduta.'},404);
    if(path.endsWith('/ws')){
     if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);
     if(this.ctx.getWebSockets().length>=60)return json({error:'Stanza piena (60 connessioni).'},429);
     const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].send(JSON.stringify(this.public(s)));
     return new Response(null,{status:101,webSocket:pair[0]});
    }
    if(path.endsWith('/replay')&&req.method==='GET'){
     if(!s.chess)return json({frames:[]});
     const game=new Chess(),frames=[{fen:game.fen(),lastMove:null}];
     for(const entry of s.moves){const m=game.move(entry.san);frames.push({fen:game.fen(),lastMove:{from:m.from,to:m.to}})}
     return json({room:s.room,revision:s.revision,frames});
    }
    if(path.endsWith('/state')&&req.method==='GET')return json(this.public(s));
    if(req.method!=='POST')return json({error:'Metodo non consentito.'},405);
    const raw=await req.text();if(raw.length>4096)bad('Richiesta troppo grande.');const b=JSON.parse(raw||'{}');
    if(path.endsWith('/claim')){
     if(s.phase!=='waiting')return json({error:'Il secondo posto è già occupato. Puoi assistere.'},409);
     const token=id(),p={id:id(),name:name(b.name),token};s.players.push(p);s.phase='playing';s.revision++;
     await this.ctx.storage.put('state',s);this.broadcast(s);return json({token,player:p.id,state:this.public(s)});
    }
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');const who=s.players.findIndex(p=>p.token===token);
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
     await this.ctx.storage.deleteAlarm();await this.ctx.storage.put('state',s);this.broadcast(s);
     return json(this.public(s));
    }
    if(s.phase!=='playing'&&!(s.phase==='waiting'&&path.endsWith('/finish')))return json({error:'Partita non attiva.'},409);
    if(b.revision!==s.revision)return json({error:'La partita è cambiata. Riprova dopo l’aggiornamento.'},409);
    if(path.endsWith('/offer-draw')){
     if(!s.chess||s.phase!=='playing')return json({error:'Patta disponibile solo durante una partita di scacchi.'},409);
     if(s.drawOffer)return json({error:'C’è già una proposta in attesa.'},409);
     if(s.lastDrawOffer?.by===who&&s.lastDrawOffer?.ply===s.moves.length)return json({error:'Attendi una nuova mossa prima di proporre ancora la patta.'},409);
     s.drawOffer={by:s.players[who].id,name:s.players[who].name};s.lastDrawOffer={by:who,ply:s.moves.length};
    }else if(path.endsWith('/accept-draw')||path.endsWith('/reject-draw')){
     if(!s.drawOffer||s.drawOffer.by===s.players[who].id)return json({error:'Non puoi rispondere a questa proposta.'},403);
     if(path.endsWith('/accept-draw')){s.phase='finished';s.chess={...s.chess,legalMoves:[],reason:'Patta concordata',result:'1/2-1/2'}}
     s.drawOffer=null;
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
     if(s.chess)return json({error:'Negli scacchi devi effettuare una mossa.'},409);
     if(who!==s.turn)return json({error:'Non è il tuo turno.'},403);
     s.moves.push({by:s.players[who].name,at:Date.now(),number:s.moves.length+1});s.turn=1-s.turn;
     if(s.moves.length>=500)s.phase='finished';
    }else if(path.endsWith('/finish')){s.phase='finished';if(s.chess)s.chess={...s.chess,legalMoves:[],reason:'Partita chiusa',result:null};}else bad('Azione non valida.');
    s.revision++;await this.ctx.storage.put('state',s);this.broadcast(s);return json(this.public(s));
   }catch(e){return json({error:e instanceof SyntaxError?'Richiesta non valida.':e.message},400)}
  });
 }

 summary(s){return {room:s.room,number:s.number,archived:!!s.archived,phase:s.phase,players:s.players,turn:s.turn,revision:s.revision,created:s.created,expires:s.expires};}
 async lobbyList(){
  const entries=await this.ctx.storage.list({prefix:'game:'});
  return [...entries.values()].filter(s=>s.archived||s.expires>Date.now()).sort((a,b)=>a.number-b.number);
 }
 async lobbyBroadcast(){
  const message=JSON.stringify({games:await this.lobbyList()});
  for(const ws of this.ctx.getWebSockets()){try{ws.send(message)}catch{}}
 }
 async lobby(req,path){
  if(path==='/lobby/list')return json({games:await this.lobbyList()});
  if(path==='/lobby/ws'){
   if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);
   if(this.ctx.getWebSockets().length>=120)return json({error:'Troppe connessioni.'},429);
   const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);
   pair[1].send(JSON.stringify({games:await this.lobbyList()}));
   return new Response(null,{status:101,webSocket:pair[0]});
  }
  if(req.method!=='POST')return json({error:'Metodo non consentito.'},405);
  const body=await req.json();
  if(path==='/lobby/create'){
   const playerName=name(body.name);
   const number=(await this.ctx.storage.get('lobbyCounter')||0)+1;
   await this.ctx.storage.put('lobbyCounter',number);
   const room=id(),stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(room));
   const response=await stub.fetch(new Request('https://internal/init',{method:'POST',headers:{'X-Room':room},body:JSON.stringify({name:playerName,number})}));
   if(!response.ok)return response;
   const result=await response.json();
   await this.ctx.storage.put('game:'+room,this.summary(result.state));
   await this.ctx.storage.setAlarm(Date.now()+3600000);
   await this.lobbyBroadcast();
   return json(result);
  }
  if(path==='/lobby/remove'){
   await this.ctx.storage.delete('game:'+body.room);await this.lobbyBroadcast();return json({ok:true});
  }
  if(path==='/lobby/update'){
   const old=await this.ctx.storage.get('game:'+body.room);
   if(old&&body.revision>=old.revision){
    await this.ctx.storage.put('game:'+body.room,this.summary({...body,number:old.number}));
    await this.lobbyBroadcast();
   }
   return json({ok:true});
  }
  return json({error:'Percorso non trovato.'},404);
 }

 webSocketMessage(ws){ws.close(1008,'Connessione di sola lettura.');}
 webSocketClose(ws,code){ws.close(code===1006?1000:code);}
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
