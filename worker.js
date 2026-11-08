import { Cinema } from './cinema-server.js';
import { YouTubeCatalog } from './cinema-youtube.js';
import {MEDIA_LIMIT,MEDIA_TTL,MEDIA_TYPES,readCinemaMedia,storeCinemaMedia} from './cinema-media.js';
import {chessSnapshot,claimChessDraw} from './chess-rules.js';
import {initialNaval,playNaval,navalView} from './naval.js';
import {initialBriscola,playBriscola,briscolaView} from './briscola.js';
import {initialScarabeo,playScarabeo,scarabeoView} from './scarabeo.js';
import {initialScopa,playScopa,scopaView} from './scopa.js';
import {chooseAction,tutorial} from './table-ai.js';
import {winningSeats,resultsFor,topFive} from './leaderboard.js';
import {stagedGame,limits,activeTable,createSeries,settleSeries} from './match-series.js';
import {initialUno,playUno,unoView} from './uno.js';
import {initialConnect4,playConnect4} from './connect4.js';
import { GolfRoom } from './golf-server.js';
import { MotoTrialRoom } from './moto-trial-server.js';
import { ExpeditionRoom } from './labyrinth-server.js';
import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';
import { radioNowPlaying } from './radio-metadata.js';
import { initialCheckers, playCheckers, checkersSnapshot, checkersKey } from './checkers.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const id=()=>crypto.randomUUID();
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
const telegramAccessTag=async env=>env.BOT_TOKEN?hex(await mac(env.BOT_TOKEN,'telegram-session-v1')):null;
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
  const accessTag=await telegramAccessTag(env);
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
  if(payload.accessTag!==await telegramAccessTag(env))return null;
  return payload.expires>Date.now()?payload.user:null;
 }catch{return null}
}

const cinemaHub=env=>env.ROOMS.get(env.ROOMS.idFromName('cinema-streamer-v1'));
const cinemaFile=(env,file)=>env.ROOMS.get(env.ROOMS.idFromName('cinema-file:'+file));
const cinemaSignature=(env,file,expires)=>mac(env.BOT_TOKEN,'cinema-media:'+file+':'+expires);
async function uploadCinema(req,env,u){
 const type=req.headers.get('Content-Type');
 if(!MEDIA_TYPES.has(type))return json({error:'Scegli un video MP4 o WebM.'},415);
 if(Number(req.headers.get('Content-Length'))>MEDIA_LIMIT)return json({error:'Il video supera 16 MB.'},413);
 const room=u.searchParams.get('room'),name=u.searchParams.get('name')?.trim().slice(0,96)||'Video condiviso';
 const file=id(),expires=Date.now()+MEDIA_TTL;
 const change=(fields={})=>cinemaHub(env).fetch(u.origin+'/cinema/upload',{
  method:'POST',headers:{'X-Checkmate-User':req.headers.get('X-Checkmate-User')},body:JSON.stringify({room,file,name,...fields})
 });
 const reserved=await change();
 if(!reserved.ok)return reserved;
 const headers=new Headers({'Content-Type':type,'X-Media-Expires':String(expires)});
 if(req.headers.has('Content-Length'))headers.set('Content-Length',req.headers.get('Content-Length'));
 let stored;
 try{
  stored=await cinemaFile(env,file).fetch(new Request(u.origin+'/cinema/file',{method:'POST',headers,body:req.body}));
 }catch{
  await change({cancel:true});
  return json({error:'Caricamento interrotto. Riprova.'},503);
 }
 if(!stored.ok){
  await change({cancel:true});
  return json({error:stored.status===413?'Il video supera 16 MB.':'Il file non è un video MP4 o WebM valido.'},stored.status);
 }
 const sig=hex(await cinemaSignature(env,file,expires));
 const published=await change({url:u.origin+'/api/cinema/media/'+file+'?expires='+expires+'&sig='+sig});
 if(!published.ok)await change({cancel:true});
 return published;
}
async function serveCinema(req,env,u,file){
 const expires=Number(u.searchParams.get('expires')),sig=u.searchParams.get('sig')||'';
 if(!env.BOT_TOKEN||!Number.isSafeInteger(expires)||expires<=Date.now()||!/^[a-f0-9]{64}$/.test(sig))return json({error:'Video non disponibile.'},404);
 const expected=await cinemaSignature(env,file,expires);
 const supplied=Uint8Array.from(sig.match(/../g),pair=>parseInt(pair,16));
 if(!crypto.subtle.timingSafeEqual(expected,supplied))return json({error:'Video non disponibile.'},404);
 return cinemaFile(env,file).fetch(new Request(u.origin+'/cinema/file',req));
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
  const cinemaMedia=u.pathname.match(/^\/api\/cinema\/media\/([a-f0-9-]{36})$/);
  if(cinemaMedia&&['GET','HEAD'].includes(req.method))return serveCinema(req,env,u,cinemaMedia[1]);
  const user=await sessionUser(req,env);
  if(!user)return json({error:'Apri Binottoland da Telegram per accedere.'},401);
  if(u.pathname==='/api/radio/now-playing'&&req.method==='GET'){const data=await radioNowPlaying(u.searchParams.get('station'),user.id);return data?json(data):json({error:'Stazione non valida.'},400)}
  const trustedHeaders=new Headers(req.headers);trustedHeaders.set('X-Checkmate-User',JSON.stringify(user));trustedHeaders.set('X-Access-Tag',await telegramAccessTag(env));req=new Request(req,{headers:trustedHeaders});
  if(u.pathname==='/api/cinema/ws'&&req.method==='GET')return cinemaHub(env).fetch(new Request(u.origin+'/cinema/ws',req));
  if(u.pathname==='/api/cinema/youtube'&&req.method==='GET')return env.ROOMS.get(env.ROOMS.idFromName('cinema-youtube-v1')).fetch(new Request(u.origin+'/cinema/youtube'+u.search,req));
  if(u.pathname==='/api/cinema/upload'&&req.method==='POST')return uploadCinema(req,env,u);
  const golf=u.pathname.match(/^\/api\/golf\/([a-f0-9-]{36})\/(state|join|start|shot|close)$/);
  if(golf)return env.ROOMS.get(env.ROOMS.idFromName('golf:'+golf[1])).fetch(new Request(u.origin+'/golf/'+golf[2]+u.search,req));
  const moto=u.pathname.match(/^\/api\/moto-trial\/([a-f0-9-]{36})\/(state|ws)$/);
  if(moto)return env.ROOMS.get(env.ROOMS.idFromName('moto:'+moto[1])).fetch(new Request(u.origin+'/moto-trial/'+moto[2],req));
  const lab=u.pathname.match(/^\/api\/labyrinth\/([a-f0-9-]{36})\/(state|join|archive|delete|ws)$/);
  if(lab)return env.ROOMS.get(env.ROOMS.idFromName('lab:'+lab[1])).fetch(new Request(u.origin+'/labyrinth/'+lab[2]+u.search,req));
  const lobby=env.ROOMS.get(env.ROOMS.idFromName('checkmate-lobby-v1'));
  if(u.pathname==='/api/chat'&&req.method==='POST')return lobby.fetch(new Request(u.origin+'/lobby/chat',req));
  if(u.pathname==='/api/leaderboard'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/leaderboard'+u.search));
  if(u.pathname==='/api/lobby'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/list'));
  if(u.pathname==='/api/lobby/ws'&&req.method==='GET')return lobby.fetch(new Request(u.origin+'/lobby/ws',req));
  if(req.method==='POST'&&u.pathname==='/api/create'){
   const raw=await req.text();
   if(raw.length>4096)return json({error:'Richiesta troppo grande.'},413);
   return lobby.fetch(new Request(u.origin+'/lobby/create',{method:'POST',body:raw,headers:{'X-Checkmate-User':JSON.stringify(user)}}));
  }
  const match=u.pathname.match(/^\/api\/room\/([a-f0-9-]{36})\/(state|claim|start|rematch|next-round|move|pass|finish|archive|dismiss|delete|replay|offer-draw|accept-draw|reject-draw|ws)$/);
  if(!match)return json({error:'Percorso non trovato.'},404);

  if(match[2]==='claim'&&req.method==='POST')return lobby.fetch(new Request(u.origin+'/lobby/join',{method:'POST',headers:{'X-Checkmate-User':JSON.stringify(user)},body:JSON.stringify({room:match[1]})}));
  if(match[2]==='rematch'&&req.method==='POST'){
   const {games}=await (await lobby.fetch(new Request(u.origin+'/lobby/list'))).json();
   if(games.some(g=>g.room!==match[1]&&!isArcade(g.game)&&activeTable(g)&&g.players.some(p=>p.id===user.player)))return json({error:'Hai già un altro tavolo aperto.'},409);
  }
  const response=await env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(req);
  if(response.ok&&(req.method==='POST'||match[2]==='state')){
   const result=await response.clone().json();
   const s=result.state||result;
   if(match[2]!=='dismiss'||s.deleted)await lobby.fetch(new Request(u.origin+(s.deleted?'/lobby/remove':'/lobby/update'),{method:'POST',body:JSON.stringify({room:s.room,number:s.number,game:s.game||'chess',archived:!!s.archived,phase:s.phase,players:s.players,turn:s.turn,revision:s.revision,series:s.series||null,mode:s.mode||'people',created:s.created,expires:s.expires})}));
  }
  return response;
 }
};
const isArcade=game=>game==='labyrinth'||game==='moto-trial'||game==='golf';
const concluded=table=>table.phase==='finished'&&!activeTable(table)&&!table.archived;

export class Room extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.lab=new ExpeditionRoom(ctx,env,()=>telegramAccessTag(env));this.moto=new MotoTrialRoom(ctx,env);this.golf=new GolfRoom(ctx,env);this.cinema=new Cinema(ctx);}
 public(s,viewer=null){return {room:s.room,matchId:s.matchId||null,number:s.number||null,game:s.game||'chess',archived:!!s.archived,phase:s.phase,players:s.players.map(p=>({id:p.id,name:p.name,bot:!!p.bot})),mode:s.mode||'people',tutorial:s.mode==='tutorial'&&s.phase==='playing'&&s.players[0].id===viewer?this.tutorialView(s):null,turn:s.turn,revision:s.revision,moves:s.moves,series:s.series||null,limits:limits(s.game),drawOffer:s.drawOffer||null,chess:s.chess||null,checkers:s.checkers||null,connect4:s.connect4||null,uno:s.uno?unoView(s.uno,s.players.findIndex(p=>p.id===viewer)):null,scarabeo:s.scarabeo?scarabeoView(s.scarabeo,s.players.findIndex(p=>p.id===viewer)):null,scopa:s.scopa?scopaView(s.scopa,s.players.findIndex(p=>p.id===viewer)):null,naval:s.naval?navalView(s.naval,s.players.findIndex(p=>p.id===viewer)):null,briscola:s.briscola?briscolaView(s.briscola,s.players.findIndex(p=>p.id===viewer)):null,created:s.created,expires:s.expires}}
 newTable(room,b,token){
  const game=b.game??'chess';
  const s={
   room,number:b.number||null,phase:'waiting',
   players:[{id:b.playerId||id(),name:name(b.name),token}],
   turn:0,revision:0,moves:[],series:createSeries(b.target),
   game,mode:b.mode??'people',chess:null,created:Date.now(),expires:Date.now()+7*86400000
  };
  switch(game){
   case 'naval':s.naval=initialNaval();break;
   case 'briscola':
   case 'briscola5':s.briscola=initialBriscola();break;
   case 'scarabeo':s.scarabeo=initialScarabeo();break;
   case 'scopa':s.scopa=initialScopa();break;
   case 'uno':s.uno=initialUno();break;
   case 'connect4':s.connect4=initialConnect4();break;
   case 'checkers':{
    const checkers=initialCheckers();
    s.checkers=checkersSnapshot(checkers);
    s.positions={[checkersKey(checkers)]:1};
    break;
   }
   case 'chess':s.chess=chessSnapshot(new Chess());break;
   default:throw Error('Gioco non disponibile.');
  }
  if(!['people','ai','tutorial'].includes(s.mode))throw Error('Modalità di gioco non valida.');
  if(s.mode!=='people'){
   if(b.target>1)throw Error('Il singolo è disponibile in partita veloce o tutorial.');
   const {min,max}=limits(s.game),count=b.seats??min;
   if(!Number.isInteger(count)||count<min||count>max)throw Error('Numero posti non valido.');
   while(s.players.length<count)s.players.push({id:'bot:'+s.players.length,name:'AI '+s.players.length,bot:true});
   this.resetRound(s);
  }
  return s;
 }
 resetRound(s){s.moves=[];s.drawOffer=null;s.lastDrawOffer=null;s.turn=0;s.phase='playing';if(s.game==='uno'){s.uno=initialUno(s.players.length);s.turn=s.uno.turn}else if(s.game==='scarabeo'){s.scarabeo=initialScarabeo(s.players.length);s.turn=s.scarabeo.turn}else if(s.game==='scopa')s.scopa=initialScopa(s.players.length);else if(s.game==='naval')s.naval=initialNaval();else if(['briscola','briscola5'].includes(s.game)){s.briscola=initialBriscola(s.players.length,undefined,s.briscola?.hands.length?(s.briscola.dealer+1)%s.players.length:null);s.turn=s.briscola.turn}else if(s.game==='connect4')s.connect4=initialConnect4();else if(s.game==='checkers'){s.checkers=checkersSnapshot(initialCheckers());s.positions={[checkersKey(initialCheckers())]:1}}else s.chess=chessSnapshot(new Chess());}
 tutorialView(s){const seat=0,view=this.public({...s,mode:'ai'},s.players[0].id),g=view.naval||view.briscola||view[s.game]||view.chess;const can=s.scarabeo?.pending?s.scarabeo.pending.by!==0&&!Object.hasOwn(s.scarabeo.pending.votes,0):s.naval?.phase==='placement'?!s.naval.ready[0]:s.turn===0;return can?tutorial(s.game,g,seat,s.moves.length):{title:'Turno dell’AI',text:'Osserva la risposta dell’avversario. Poi potrai scegliere liberamente o provare la mossa suggerita.',reason:g.lastEvent||'',action:null};}
 botSeat(s){if(s.phase!=='playing'||!['ai','tutorial'].includes(s.mode))return -1;if(s.scarabeo?.pending)return s.players.findIndex((p,i)=>p.bot&&i!==s.scarabeo.pending.by&&!Object.hasOwn(s.scarabeo.pending.votes,i));if(s.naval?.phase==='placement')return s.players.findIndex((p,i)=>p.bot&&!s.naval.ready[i]);return s.players[s.turn]?.bot?s.turn:-1;}
 async record(s){for(const result of resultsFor(s))await this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch(new Request('https://internal/lobby/result',{method:'POST',body:JSON.stringify(result)}));}
 async saveState(s){
  if(concluded(s)){
   s.expires=null;
   delete s.finishedAt;
  }
  await this.ctx.storage.put('state',s);
  await this.record(s);
  if(s.archived||concluded(s))await this.ctx.storage.deleteAlarm();
  else{
   const nextBot=this.botSeat(s)>=0?Date.now()+650:Infinity;
   await this.ctx.storage.setAlarm(Math.min(nextBot,s.expires));
  }
 }
 hasResultViewer(s,{socket,player}={}){
  const seats=new Set(s.players.filter(p=>!p.bot).map(p=>p.id));
  return this.ctx.getWebSockets().some(ws=>{
   const viewer=ws.deserializeAttachment()?.player;
   return ws!==socket&&ws.readyState===1&&viewer!==player&&seats.has(viewer);
  });
 }
 async removeTable(s,reason){
  const result={room:s.room,number:s.number,deleted:true,reason};
  await this.ctx.storage.deleteAlarm();
  await this.ctx.storage.deleteAll();
  for(const ws of this.ctx.getWebSockets()){
   try{ws.send(JSON.stringify(result));ws.close(1000,'Partita eliminata');}catch{}
  }
  return result;
 }
 notifyTableRemoved(room){
  const lobby=this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1'));
  this.ctx.waitUntil(lobby.fetch(new Request('https://internal/lobby/remove',{method:'POST',body:JSON.stringify({room})})));
 }
 async syncLobby(s){await this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch(new Request('https://internal/lobby/update',{method:'POST',body:JSON.stringify(this.summary(this.public(s)))}));}
 applyMove(s,who,b){
    if(s.naval||s.briscola){
     const key=s.naval?'naval':'briscola',next=s.naval?playNaval(s.naval,who,b):playBriscola(s.briscola,who,b);s[key]=next;s.turn=next.turn;
     s.moves.push({description:next.lastEvent,by:s.players[who].name,at:Date.now(),number:s.moves.length+1});if(next.result)s.phase='finished';
    }else if((s.scarabeo||s.scopa)){
     const key=s.scarabeo?'scarabeo':'scopa',next=s.scarabeo?playScarabeo(s.scarabeo,who,b):playScopa(s.scopa,who,b);s[key]=next;s.turn=next.turn;
     s.moves.push({description:next.lastEvent,by:s.players[who].name,at:Date.now(),number:s.moves.length+1});if(next.result)s.phase='finished';
    }else if(s.uno){
     const next=playUno(s.uno,who,b);s.uno=next;s.turn=next.turn;s.drawOffer=null;
     s.moves.push({description:next.lastEvent,by:s.players[who].name,at:Date.now(),number:s.moves.length+1});if(next.result)s.phase='finished';
    }else if(s.connect4){
     if(who!==s.turn)throw Error('Non è il tuo turno.');
     const next=playConnect4(s.connect4,b.column);s.connect4=next;s.turn=next.turn;s.drawOffer=null;
     s.moves.push({column:b.column,row:next.lastMove.row,by:s.players[who].name,at:Date.now(),number:s.moves.length+1});if(next.result)s.phase='finished';
    }else if(s.checkers){
     if(who!==s.turn)throw Error('Non è il tuo turno.');
     const played=playCheckers(s.checkers,b.path),key=checkersKey(played.game);
     s.positions=s.positions||{};s.positions[key]=(s.positions[key]||0)+1;
     s.moves.push({...played.move,by:s.players[who].name,at:Date.now(),number:s.moves.length+1});
     s.drawOffer=null;s.turn=played.game.turn;
     s.checkers=checkersSnapshot(played.game,played.move,s.positions[key]);
     if(s.checkers.result)s.phase='finished';
    }else {
     if(!s.chess)throw Error('Questa è una stanza di prova precedente. Crea una nuova partita per giocare a scacchi.');
     if(who!==s.turn)throw Error('Non è il tuo turno.');
     const game=new Chess();
     for(const move of s.moves)game.move(move.san);
     if(b.kind==='claim-draw'){
      const proposed=b.move;
      if(proposed!==undefined&&(!proposed||typeof proposed.from!=='string'||typeof proposed.to!=='string'))throw Error('Mossa proposta non valida.');
      s.chess=claimChessDraw(game,s.chess.lastMove,proposed);s.phase='finished';s.drawOffer=null;
      return;
     }
     if(typeof b.from!=='string'||typeof b.to!=='string')throw Error('Mossa non valida.');
     let moved;try{moved=game.move({from:b.from,to:b.to,promotion:b.promotion||'q'})}catch{throw Error('Mossa non consentita.')}
     s.moves.push({by:s.players[who].name,at:Date.now(),number:s.moves.length+1,san:moved.san,from:moved.from,to:moved.to,...(moved.promotion?{promotion:moved.promotion}:{})});
     s.drawOffer=null;s.turn=game.turn()==='w'?0:1;
     s.chess=chessSnapshot(game,{from:moved.from,to:moved.to});
     if(s.chess.result)s.phase='finished';

    }
 }
 async broadcast(s){const tag=await telegramAccessTag(this.env);for(const ws of this.ctx.getWebSockets()){try{const a=ws.deserializeAttachment();if(!tag||a?.accessTag!==tag){ws.close(4001,'Riapri la Mini App');continue}ws.send(JSON.stringify(this.public(s,a.player)))}catch{}}}
 async fetch(req){
  const viewer=JSON.parse(req.headers.get('X-Checkmate-User')||'null')?.player||null;
  const path=new URL(req.url).pathname;
  if(path==='/cinema/ws'||path==='/cinema/upload')return this.cinema.fetch(req);
  if(path==='/cinema/youtube')return (this.youtube??=new YouTubeCatalog(this.env.YOUTUBE_API_KEY)).fetch(req,viewer);
  if(path==='/cinema/file')return req.method==='POST'?storeCinemaMedia(req,this.ctx.storage):readCinemaMedia(req,this.ctx.storage);
  if(new URL(req.url).pathname.startsWith('/golf/'))return this.golf.fetch(req);
  if(new URL(req.url).pathname.startsWith('/moto-trial/'))return this.moto.fetch(req);
  if(new URL(req.url).pathname.startsWith('/labyrinth/'))return this.lab.fetch(req);
  if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'Richiesta troppo grande.'},413);
  return this.ctx.blockConcurrencyWhile(async()=>{
   try{
    const path=new URL(req.url).pathname;
    if(path.startsWith('/lobby/'))return this.lobby(req,path);
    let s=await this.ctx.storage.get('state');
    if(path==='/results')return json(s?resultsFor(s):[]);
    if(s?.game==='cluedo')return json({error:'Cluedo è stato rimosso. Crea un nuovo tavolo di Scopa.'},410);
    if(path==='/init'){
     if(s)return json({error:'Stanza già esistente.'},409);
     const raw=await req.text();if(raw.length>4096)bad('Richiesta troppo grande.');const b=JSON.parse(raw);const token=id();
     s=this.newTable(req.headers.get('X-Room'),b,token);
     await this.saveState(s);
     return json({token,player:s.players[0].id,state:this.public(s,viewer)});
    }
    if(!s){
     if(path.endsWith('/dismiss')&&req.method==='POST')return json({left:true});
     return json({error:'Stanza inesistente o scaduta.'},404);
    }
    if(activeTable(s)&&s.expires<Date.now())return json({error:'Stanza inesistente o scaduta.'},404);
    if(path==='/tidy-result'&&req.method==='POST'){
     if(concluded(s)&&s.expires!==null){
      if(!this.hasResultViewer(s)){
       await this.record(s);
       return json(await this.removeTable(s,'dismissed'));
      }
      s.revision++;
      await this.saveState(s);
     }
     return json(this.summary(this.public(s)));
    }
    if(path.endsWith('/ws')){
     if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);
     if(this.ctx.getWebSockets().length>=60)return json({error:'Stanza piena (60 connessioni).'},429);
     const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({accessTag:req.headers.get('X-Access-Tag'),player:viewer});pair[1].send(JSON.stringify(this.public(s,viewer)));
     return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'checkmate'}});
    }
    if(path.endsWith('/replay')&&req.method==='GET'){
     if(stagedGame(s.game))return json({room:s.room,revision:s.revision,frames:[]});
     if(s.connect4){let game=initialConnect4();const frames=[game];for(const entry of s.moves){game=playConnect4(game,entry.column);frames.push(game)}return json({room:s.room,revision:s.revision,frames})}
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
     if(concluded(s)&&s.expires!==null){
      s.revision++;
      await this.saveState(s);
      await this.broadcast(s);
     }else{
      await this.record(s);
      if(this.botSeat(s)>=0&&await this.ctx.storage.getAlarm()===null)
       await this.ctx.storage.setAlarm(Math.min(Date.now()+650,s.expires));
     }
     const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null'),legacy=req.headers.get('X-Player-Token');
     const old=s.players.find(p=>!p.id.startsWith('tg:')&&legacy&&p.token===legacy);
     if(user&&old&&!s.players.some(p=>p.id===user.player)){
      old.id=user.player;old.name=name(user.name);s.revision++;
      await this.saveState(s);await this.broadcast(s);
     }
     return json(this.public(s,viewer));
    }
    if(req.method!=='POST')return json({error:'Metodo non consentito.'},405);
    const raw=await req.text();if(raw.length>4096)bad('Richiesta troppo grande.');const b=JSON.parse(raw||'{}');
    if(path.endsWith('/claim')){
     if(s.mode==='ai'||s.mode==='tutorial'||s.phase!=='waiting'||(stagedGame(s.game)&&s.players.length>=limits(s.game).max))return json({error:stagedGame(s.game)?'Tavolo pieno o partita già avviata. Puoi assistere.':'Il secondo posto è già occupato. Puoi assistere.'},409);
     const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
     if(s.players.some(p=>p.id===user?.player))return json({error:'Sei già un giocatore di questa partita.'},409);
     const token=id(),p={id:user?.player||id(),name:name(user?.name||b.name),token};s.players.push(p);s.phase=stagedGame(s.game)?'waiting':'playing';s.revision++;
     await this.saveState(s);await this.broadcast(s);return json({token,player:p.id,state:this.public(s,viewer)});
    }
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');const legacy=req.headers.get('X-Player-Token');const who=s.players.findIndex(p=>p.id===user?.player||(!p.id.startsWith('tg:')&&legacy&&p.token===legacy));
    if(who<0)return json({error:'Solo i giocatori possono agire.'},403);
    if(path.endsWith('/dismiss')){
     if(!concluded(s)||(s.matchId||null)!==(b.matchId||null))return json({left:true});
     if(this.hasResultViewer(s,{player:s.players[who].id}))return json({left:true});
     return json(await this.removeTable(s,'dismissed'));
    }
    if(path.endsWith('/rematch')){
     if(s.phase!=='finished'||activeTable(s)||b.revision!==s.revision)
      return json({error:'La partita è cambiata o deve ancora concludersi.'},409);
     const token=id();
     const next=this.newTable(s.room,{
      number:s.number,game:s.game||'chess',mode:s.mode,target:s.series?.target,
      seats:s.players.length,playerId:user.player,name:user.name
     },token);
     next.matchId=id();
     next.revision=s.revision+1;
     await this.record(s);
     await this.saveState(next);
     await this.broadcast(next);
     return json({state:this.public(next,viewer),token,player:user.player});
    }
    if(path.endsWith('/archive')||path.endsWith('/delete')){
     if(b.revision!==s.revision)return json({error:'La partita è cambiata. Aggiorna e riprova.'},409);
     if(path.endsWith('/delete'))return json(await this.removeTable(s,'manual'));
     if(s.series){s.series.done=true;s.series.cancelled=true}s.archived=true;s.phase='finished';s.expires=null;s.revision++;
     if(s.chess)s.chess={...s.chess,legalMoves:[],reason:s.chess.reason||'Archiviata'};
     if(s.checkers)s.checkers={...s.checkers,legalMoves:[],reason:s.checkers.reason||'Archiviata'};
     if(s.connect4)s.connect4={...s.connect4,legalMoves:[],reason:s.connect4.reason||'Archiviata'};
     await this.ctx.storage.deleteAlarm();await this.saveState(s);await this.broadcast(s);
     return json(this.public(s,viewer));
    }
    if(path.endsWith('/next-round')){
     if(who!==0||s.archived||s.phase!=='finished'||!s.series||s.series.done||!s.series.recorded||b.revision!==s.revision)return json({error:'La prossima manche può essere avviata dal creatore.'},409);
     s.series.round++;s.series.recorded=false;this.resetRound(s);s.revision++;await this.saveState(s);await this.broadcast(s);return json(this.public(s,viewer));
    }
    if(stagedGame(s.game)&&path.endsWith('/start')){
     if(who!==0)return json({error:'Solo chi ha creato il tavolo può avviare la partita.'},403);
     if(s.phase!=='waiting')return json({error:'Il tavolo non è più in attesa.'},409);
     if(b.revision!==s.revision)return json({error:'I giocatori al tavolo sono cambiati. Controlla l’elenco e premi di nuovo Avvia partita.'},409);
     if(s.players.length<limits(s.game).min)return json({error:'Servono almeno '+limits(s.game).min+' giocatori per iniziare.'},409);
     this.resetRound(s);if(s.series)s.series.wins=Array(s.players.length).fill(0);s.revision++;await this.saveState(s);await this.broadcast(s);return json(this.public(s,viewer));
    }
    if(s.phase!=='playing'&&!(s.phase==='waiting'&&path.endsWith('/finish')))return json({error:'Partita non attiva.'},409);
    if(b.revision!==s.revision)return json({error:'La partita è cambiata. Riprova dopo l’aggiornamento.'},409);
    if(path.endsWith('/move')&&!(s.uno&&['uno','catch-uno'].includes(b.kind))&&!s.scarabeo&&!(s.naval?.phase==='placement')&&who!==s.turn)return json({error:'Non è il tuo turno.'},403);
    if(path.endsWith('/offer-draw')){
     if((!s.chess&&!s.checkers)||s.phase!=='playing')return json({error:'Patta disponibile solo durante una partita.'},409);
     if(s.chess&&s.moves.length<2)return json({error:'Entrambi devono aver giocato almeno una mossa.'},409);
     if(s.drawOffer)return json({error:'C’è già una proposta in attesa.'},409);
     if(s.lastDrawOffer?.by===who&&s.lastDrawOffer?.ply===s.moves.length)return json({error:'Attendi una nuova mossa prima di proporre ancora la patta.'},409);
     s.drawOffer={by:s.players[who].id,name:s.players[who].name};s.lastDrawOffer={by:who,ply:s.moves.length};
    }else if(path.endsWith('/accept-draw')||path.endsWith('/reject-draw')){
     if(!s.drawOffer||s.drawOffer.by===s.players[who].id)return json({error:'Non puoi rispondere a questa proposta.'},403);
     if(path.endsWith('/accept-draw')){s.phase='finished';const key=s.connect4?'connect4':s.checkers?'checkers':'chess';s[key]={...s[key],legalMoves:[],reason:'Patta concordata',result:'1/2-1/2'}}
     s.drawOffer=null;
    }else if(path.endsWith('/move')){this.applyMove(s,who,b);    }else if(path.endsWith('/pass')){
     if(s.chess||s.checkers||s.connect4||s.uno||s.scarabeo||s.scopa||s.naval||s.briscola)return json({error:'Devi effettuare una mossa.'},409);
     if(who!==s.turn)return json({error:'Non è il tuo turno.'},403);
     s.moves.push({by:s.players[who].name,at:Date.now(),number:s.moves.length+1});s.turn=1-s.turn;
     if(s.moves.length>=500)s.phase='finished';
    }else if(path.endsWith('/finish')){if(s.series){s.series.done=true;s.series.cancelled=true}s.phase='finished';if(s.chess)s.chess={...s.chess,legalMoves:[],reason:'Partita chiusa',result:null};if(s.checkers)s.checkers={...s.checkers,legalMoves:[],reason:'Partita chiusa',result:null};if(s.connect4)s.connect4={...s.connect4,legalMoves:[],reason:'Partita chiusa',result:null};if(s.uno)s.uno={...s.uno,result:'closed',reason:'Partita chiusa'};}else bad('Azione non valida.');
    settleSeries(s);s.revision++;await this.saveState(s);await this.broadcast(s);return json(this.public(s,viewer));
   }catch(e){return json({error:e instanceof SyntaxError?'Richiesta non valida.':e.message},400)}
  });
 }

 summary(s){return {room:s.room,number:s.number,game:s.game||'chess',archived:!!s.archived,phase:s.phase,players:s.players,turn:s.turn,revision:s.revision,series:s.series||null,mode:s.mode||'people',created:s.created,expires:s.expires,...(s.game==='labyrinth'?{online:s.online,arrived:s.arrived,entryLocked:s.entryLocked,arenaResult:s.arenaResult}:s.game==='moto-trial'?{online:s.online,capacity:s.capacity,courseName:s.courseName}:s.game==='golf'?{capacity:s.capacity,hole:s.hole,campaign:s.campaign,holes:s.holes,collisions:s.collisions===true}:{})};}
 async lobbyList(){
  const entries=await this.ctx.storage.list({prefix:'game:'});
  return [...entries.values()].filter(s=>s.game!=='cluedo'&&(isArcade(s.game)||!activeTable(s)||s.expires>Date.now())).sort((a,b)=>a.number-b.number);
 }

 async lobbyPayload(allGames){
  const tables=allGames??await this.lobbyList();
  const games=tables.filter(g=>g.archived||activeTable(g));
  const unique=new Map(),tag=await telegramAccessTag(this.env);
  for(const ws of this.ctx.getWebSockets()){
   const a=ws.deserializeAttachment();if(!tag||!a||a.accessTag!==tag||a.kind!=='lobby'||a.closed||Date.now()-a.seen>65000)continue;
   const prior=unique.get(a.user.id);if(!prior||a.room)unique.set(a.user.id,a);
  }
  const users=[...unique.values()].map(a=>{
   const own=games.find(g=>!isArcade(g.game)&&activeTable(g)&&g.players.some(p=>p.id===a.user.player));
   const watching=tables.find(g=>g.room===a.room);
   return {...a.user,status:own?'In partita '+own.number:watching?(watching.game==='labyrinth'?'Labyrinth ':watching.game==='moto-trial'?'Moto Trial ':watching.game==='golf'?'Golf ':'Guarda ')+watching.number:'In Lobby',game:own?.room||null,viewingRoom:watching?.room||null};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const records=[...(await this.ctx.storage.list({prefix:'result:'})).values()];return {games,users,messages:await this.ctx.storage.get('chat')||[],leaderboard:topFive(records),aiLeaderboard:topFive(records,'ai')};
 }
 async lobbyBroadcast(force=true){
  const payload=await this.lobbyPayload(),signature=JSON.stringify(payload.users);
  if(!force&&signature===this.presenceSignature)return;
  this.presenceSignature=signature;
  const message=JSON.stringify(payload),tag=await telegramAccessTag(this.env);
  for(const ws of this.ctx.getWebSockets()){try{if(!tag||ws.deserializeAttachment()?.accessTag!==tag){ws.close(4001,'Riapri la Mini App');continue}ws.send(message)}catch{}}
 }
 async tidyLegacyResults(games){
  if(this.tidyingResults)return;
  this.tidyingResults=true;
  try{
   for(const game of games.slice(0,12)){
    const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(game.room));
    const result=await stub.fetch(new Request('https://internal/tidy-result',{method:'POST'}));
    if(!result.ok)continue;
    const summary=await result.json();
    const lobby=this.env.ROOMS.get(this.ctx.id);
    const action=summary.deleted?'remove':'update';
    await lobby.fetch(new Request('https://internal/lobby/'+action,{method:'POST',body:JSON.stringify(summary)}));
   }
  }finally{this.tidyingResults=false;}
 }
 async lobby(req,path){
  if(path==='/lobby/leaderboard'){const games=await this.lobbyList(),pending=[];for(const g of games)if(g.phase==='finished'&&!isArcade(g.game)&&await this.ctx.storage.get('migrated:'+g.room)!==g.revision)pending.push(g);for(const g of pending.slice(0,8)){const res=await this.env.ROOMS.get(this.env.ROOMS.idFromName(g.room)).fetch(new Request('https://internal/results'));if(res.ok){for(const row of await res.json())await this.ctx.storage.put('result:'+row.key,row);await this.ctx.storage.put('migrated:'+g.room,g.revision)}}const records=[...(await this.ctx.storage.list({prefix:'result:'})).values()],u=new URL(req.url);if(u.searchParams.get('mode')==='both')return json({leaderboard:topFive(records),aiLeaderboard:topFive(records,'ai'),pending:pending.length>8});return json({leaders:topFive(records,u.searchParams.get('mode')==='ai'?'ai':'people',u.searchParams.get('game')||'all'),pending:pending.length>8});}
  if(path==='/lobby/list'){
   const games=await this.lobbyList();
   const old=games.filter(game=>concluded(game)&&game.expires!==null);
   if(old.length)this.ctx.waitUntil(this.tidyLegacyResults(old));
   return json(await this.lobbyPayload(games));
  }
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
  if(path==='/lobby/result'){const old=await this.ctx.storage.get('result:'+body.key);if(!old)await this.ctx.storage.put('result:'+body.key,body);return json({ok:true});}
  if(path==='/lobby/join'){
   const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');if(!user)return json({error:'Accesso richiesto.'},401);
   if((await this.lobbyList()).some(g=>!isArcade(g.game)&&g.room!==body.room&&activeTable(g)&&g.players.some(p=>p.id===user.player)))return json({error:'Hai già una partita aperta. Puoi guardare le altre.'},409);
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
   if(body.game!==undefined&&!['chess','checkers','connect4','uno','scarabeo','scopa','naval','briscola','briscola5','labyrinth','moto-trial','golf'].includes(body.game))return json({error:'Gioco non disponibile.'},400);
   const active=(await this.lobbyList()).filter(activeTable);
   if(body.game!=='moto-trial'&&body.game!=='golf'&&active.some(g=>!isArcade(g.game)&&g.players.some(p=>p.id===user.player)))return json({error:'Hai già una partita aperta.'},409);
   createSeries(body.target);
   const occupied=new Set(active.map(g=>g.number));
   let number=1;
   while(occupied.has(number))number++;
   if(isArcade(body.game)){
    const room=id(),prefix=body.game==='labyrinth'?'lab:':body.game==='golf'?'golf:':'moto:';
    const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(prefix+room));
    const response=await stub.fetch(new Request('https://internal/'+body.game+'/init',{method:'POST',headers:{'X-Checkmate-User':JSON.stringify(user)},body:JSON.stringify({room,number,appearance:body.game==='golf'?body.appearance:undefined,campaign:body.game==='golf'?body.campaign:undefined,collisions:body.game==='golf'?body.collisions===true:undefined,seed:body.game==='moto-trial'?1:crypto.getRandomValues(new Uint32Array(1))[0]})}));
    if(!response.ok)return response;const result=await response.json();await this.ctx.storage.put('game:'+room,result.summary);await this.lobbyBroadcast();return json(result);
   }
   const room=id(),stub=this.env.ROOMS.get(this.env.ROOMS.idFromName(room));
   const response=await stub.fetch(new Request('https://internal/init',{method:'POST',headers:{'X-Room':room,'X-Checkmate-User':JSON.stringify(user)},body:JSON.stringify({name:playerName,number,playerId:user.player,game:body.game||'chess',target:body.target,mode:body.mode,seats:body.seats})}));
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
   if(old&&body.revision>old.revision){
    await this.ctx.storage.put('game:'+body.room,this.summary({...body,number:old.number}));
    await this.lobbyBroadcast();
   }
   return json({ok:true});
  }
  return json({error:'Percorso non trovato.'},404);
 }

 async webSocketMessage(ws,message){
  const a=ws.deserializeAttachment();if(!this.env.BOT_TOKEN||a?.accessTag!==await telegramAccessTag(this.env)){ws.close(4001,'Riapri la Mini App');return}if(a?.kind==='cinema')return this.cinema.message(ws,message);if(a?.kind==='lab')return this.lab.message(ws,message);if(a?.kind==='moto-trial')return this.moto.message(ws,message);if(a?.kind!=='lobby'){ws.close(1008,'Sola lettura.');return}
  try{
   if(typeof message!=='string'||message.length>512)return;
   const b=JSON.parse(message);if(b.type!=='presence')return;
   a.room=typeof b.room==='string'&&/^[a-f0-9-]{36}$/.test(b.room)?b.room:null;
   a.seen=Date.now();a.closed=!!b.away;ws.serializeAttachment(a);await this.lobbyBroadcast(false);
  }catch{}
 }
 async webSocketClose(ws,code){
  const attachment=ws.deserializeAttachment();
  if(attachment?.kind==='cinema')return this.cinema.close(ws);
  if(attachment?.kind==='lab'){
   await this.lab.close(ws);
  }else if(attachment?.kind==='moto-trial'){
   await this.moto.close(ws);
  }else if(attachment?.kind==='lobby'){
   attachment.closed=true;ws.serializeAttachment(attachment);await this.lobbyBroadcast();
  }else if(attachment?.player&&(code===1000||code===1001)){
   await this.ctx.blockConcurrencyWhile(async()=>{
    const s=await this.ctx.storage.get('state');
    if(s&&concluded(s)&&s.players.some(p=>p.id===attachment.player)&&!this.hasResultViewer(s,{socket:ws})){
     await this.removeTable(s,'dismissed');
     this.notifyTableRemoved(s.room);
    }
   });
  }
  try{ws.close(code===1006?1000:code);}catch{}
 }
 webSocketError(ws){const kind=ws.deserializeAttachment()?.kind;if(kind==='cinema')return this.cinema.close(ws);if(kind==='lab')return this.lab.close(ws);if(kind==='moto-trial')return this.moto.close(ws);ws.close(1011,'Riconnettersi.');}
 async alarm(){
 if(this.ctx.id.toString()===this.env.ROOMS.idFromName('cinema-streamer-v1').toString())return this.cinema.alarm();
 if(await this.ctx.storage.get('cinema-upload'))return this.ctx.storage.deleteAll();
 if(await this.ctx.storage.get('expedition'))return this.lab.alarm();
 if(await this.ctx.storage.get('golf'))return this.golf.alarm();
 if(await this.ctx.storage.get('moto-trial'))return this.moto.alarm();
 if(this.ctx.id.toString()===this.env.ROOMS.idFromName('checkmate-lobby-v1').toString()){
  return this.ctx.blockConcurrencyWhile(async()=>{
   const entries=await this.ctx.storage.list({prefix:'game:'});
   for(const [key,value] of entries){
    if(!isArcade(value.game)&&activeTable(value)&&value.expires<=Date.now())await this.ctx.storage.delete(key);
   }
   await this.lobbyBroadcast();
   const games=await this.lobbyList();
   const old=games.filter(game=>concluded(game)&&game.expires!==null);
   if(old.length)this.ctx.waitUntil(this.tidyLegacyResults(old));
   if(games.some(g=>!g.archived))await this.ctx.storage.setAlarm(Date.now()+(old.length>12?30000:3600000));
  });
 }
 return this.ctx.blockConcurrencyWhile(async()=>{
  const current=await this.ctx.storage.get('state');
  if(!current||current.archived)return;
  if(concluded(current)){
   if(!this.hasResultViewer(current)){
    await this.removeTable(current,'dismissed');
    this.notifyTableRemoved(current.room);
   }else await this.saveState(current);
   return;
  }
  if(current.expires<=Date.now()){
   await this.removeTable(current,'expired');
   this.notifyTableRemoved(current.room);
   return;
  }
  const who=this.botSeat(current);
  if(who<0){
   await this.ctx.storage.setAlarm(current.expires);
   return;
  }
  const v=this.public(current,current.players[who].id);
  const view=v.naval||v.briscola||v[current.game]||v.chess;
  const strong=current.mode==='ai';
  // Cards already captured were publicly played. The strategy receives no private opposing cards.
  const captured=current.scopa?.captured||current.briscola?.captured;
  let botView=view;
  if(strong&&captured)botView={...view,seenCards:captured.flat()};
  else if(strong&&current.chess)botView={...view,moves:current.moves};
  else if(strong&&current.checkers)botView={...view,positions:current.positions};

  const action=chooseAction(current.game,botView,who,strong);
  if(!action)throw Error('AI: nessuna azione disponibile');
  this.applyMove(current,who,action);
  settleSeries(current);
  current.revision++;
  await this.saveState(current);
  if(concluded(current)&&!this.hasResultViewer(current)){
   await this.removeTable(current,'dismissed');
   this.notifyTableRemoved(current.room);
   return;
  }
  await this.broadcast(current);
  await this.syncLobby(current);
 });
 }
}



