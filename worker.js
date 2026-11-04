import { DurableObject } from 'cloudflare:workers';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const id=()=>crypto.randomUUID();
const bad=(message)=>{throw new Error(message)};
const name=x=>{if(typeof x!=='string'||!x.trim())bad('Inserisci un nome.');return x.trim().slice(0,30)};
export default {
 async fetch(req,env){
  const u=new URL(req.url);
  if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(req);
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==u.origin)return json({error:'Origine non consentita.'},403);
  if(u.pathname==='/api/health')return json({ok:true,version:'0.1.0'});
  if(req.method==='POST'&&u.pathname==='/api/create'){
   if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'Richiesta troppo grande.'},413);
   const room=id();const stub=env.ROOMS.get(env.ROOMS.idFromName(room));
   return stub.fetch(new Request(u.origin+'/init',{method:'POST',body:await req.text(),headers:{'Content-Type':'application/json','X-Room':room}}));
  }
  const match=u.pathname.match(/^\/api\/room\/([a-f0-9-]{36})\/(state|claim|pass|finish|ws)$/);
  if(!match)return json({error:'Percorso non trovato.'},404);
  return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(req);
 }
};
export class Room extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.ctx=ctx;}
 public(s){return {room:s.room,phase:s.phase,players:s.players.map(p=>({id:p.id,name:p.name})),turn:s.turn,revision:s.revision,moves:s.moves,created:s.created,expires:s.expires}}
 broadcast(s){const msg=JSON.stringify(this.public(s));for(const ws of this.ctx.getWebSockets()){try{ws.send(msg)}catch{}}}
 async fetch(req){
  if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'Richiesta troppo grande.'},413);
  return this.ctx.blockConcurrencyWhile(async()=>{
   try{
    const path=new URL(req.url).pathname;
    let s=await this.ctx.storage.get('state');
    if(path==='/init'){
     if(s)return json({error:'Stanza già esistente.'},409);
     const raw=await req.text();if(raw.length>4096)bad('Richiesta troppo grande.');const b=JSON.parse(raw);const token=id();
     s={room:req.headers.get('X-Room'),phase:'waiting',players:[{id:id(),name:name(b.name),token}],turn:0,revision:0,moves:[],created:Date.now(),expires:Date.now()+7*86400000};
     await this.ctx.storage.put('state',s);await this.ctx.storage.setAlarm(s.expires);
     return json({token,player:s.players[0].id,state:this.public(s)});
    }
    if(!s||s.expires<Date.now())return json({error:'Stanza inesistente o scaduta.'},404);
    if(path.endsWith('/ws')){
     if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);
     if(this.ctx.getWebSockets().length>=60)return json({error:'Stanza piena (60 connessioni).'},429);
     const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].send(JSON.stringify(this.public(s)));
     return new Response(null,{status:101,webSocket:pair[0]});
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
    if(s.phase!=='playing')return json({error:'Partita non attiva.'},409);
    if(b.revision!==s.revision)return json({error:'La partita è cambiata. Riprova dopo l’aggiornamento.'},409);
    if(path.endsWith('/pass')){
     if(who!==s.turn)return json({error:'Non è il tuo turno.'},403);
     s.moves.push({by:s.players[who].name,at:Date.now(),number:s.moves.length+1});s.turn=1-s.turn;
     if(s.moves.length>=500)s.phase='finished';
    }else if(path.endsWith('/finish'))s.phase='finished';else bad('Azione non valida.');
    s.revision++;await this.ctx.storage.put('state',s);this.broadcast(s);return json(this.public(s));
   }catch(e){return json({error:e instanceof SyntaxError?'Richiesta non valida.':e.message},400)}
  });
 }
 webSocketMessage(ws){ws.close(1008,'Connessione di sola lettura.');}
 webSocketClose(ws,code){ws.close(code===1006?1000:code);}
 webSocketError(ws){ws.close(1011,'Riconnettersi.');}
 async alarm(){for(const ws of this.ctx.getWebSockets())ws.close(1000,'Stanza scaduta.');await this.ctx.storage.deleteAll();}
}
