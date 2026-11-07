import {createExpedition,joinExpedition,connectPlayer,disconnectPlayer,sweep,pose,act,snapshot,expeditionSummary,participants,ensureKeycards,STALE,GRACE} from './expedition-model.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export class ExpeditionRoom{
 constructor(ctx,env,tag){this.ctx=ctx;this.env=env;this.tag=tag;this.state=null;this.lastSave=0;this.lastBroadcast=0;this.arenaRecorded=false}
 async load(){if(!this.state){this.state=await this.ctx.storage.get('expedition');if(this.state&&ensureKeycards(this.state)){this.state.revision++;await this.save()}}return this.state}
 async save(){await this.ctx.storage.put('expedition',this.state);this.lastSave=Date.now()}
 async index(){
 const s=this.state;if(!s)return;
 const lobby=this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1'));
 const winner=s.arenaMatch?.result?.winner;
 if(winner&&!this.arenaRecorded){
  const record={key:s.room+':arena',game:'labyrinth',mode:'people',winners:[{id:'tg:'+winner.id,name:winner.name}]};
  try{const response=await lobby.fetch(new Request('https://internal/lobby/result',{method:'POST',body:JSON.stringify(record)}));this.arenaRecorded=response.ok}catch{}
 }
 const path=s.deleted?'/lobby/remove':'/lobby/update';
 await lobby.fetch(new Request('https://internal'+path,{method:'POST',body:JSON.stringify(expeditionSummary(s))}));
 }
 async schedule(){const s=this.state;const deadlines=!s||s.archived||s.deleted?[]:participants(s).map(p=>Math.min(p.standsUntil??Infinity,p.online?p.lastSeen+STALE:(p.offlineAt??Date.now())+GRACE));if(s?.arenaMatch?.result?.winner&&!this.arenaRecorded)deadlines.push(Date.now()+2500);if(deadlines.length){const next=Math.max(Date.now()+50,Math.min(...deadlines));if(await this.ctx.storage.getAlarm()!==next)await this.ctx.storage.setAlarm(next)}else await this.ctx.storage.deleteAlarm()}
 async broadcast(force=true){const now=Date.now();if(!force&&now-this.lastBroadcast<110)return;this.lastBroadcast=now;const tag=await this.tag(),message=JSON.stringify({type:'state',state:snapshot(this.state),serverTime:now});for(const ws of this.ctx.getWebSockets()){try{if(ws.deserializeAttachment()?.accessTag!==tag){ws.close(4001,'Riapri la Mini App');continue}ws.send(message)}catch{}}}
 async fetch(req){return this.ctx.blockConcurrencyWhile(async()=>{try{
 const path=new URL(req.url).pathname,user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');let s=await this.load(),now=Date.now();
 if(path==='/labyrinth/init'){if(s)return json({error:'Spedizione già presente.'},409);const b=await req.json();this.state=s=createExpedition(b.room,b.number,b.seed,user,now);await this.save();await this.schedule();return json({state:snapshot(s),summary:expeditionSummary(s)})}
 if(!s||s.deleted)return json({error:'Spedizione non disponibile.'},404);if(sweep(s,now)){await this.save();await this.index();await this.broadcast();if(s.deleted)return json({error:'Spedizione non disponibile.'},404)}
 if(path.endsWith('/state'))return json({state:snapshot(s)});
 if(path.endsWith('/join')&&req.method==='POST'){if(!user)return json({error:'Accesso richiesto.'},401);joinExpedition(s,user,now);await this.save();await this.index();await this.schedule();await this.broadcast();return json({state:snapshot(s)})}
 if(path.endsWith('/archive')||path.endsWith('/delete')){
 if(req.method!=='POST'||!s.players[user?.id])return json({error:'Solo i partecipanti possono gestire la spedizione.'},403);if(path.endsWith('/delete')){s.deleted=true;await this.ctx.storage.deleteAll()}else{s.archived=true;for(const p of Object.values(s.players)){p.online=false;p.offlineAt=now}}s.revision++;await this.save();await this.index();await this.schedule();await this.broadcast();if(s.deleted)for(const ws of this.ctx.getWebSockets())try{ws.close(1000,'Spedizione eliminata')}catch{}return json({ok:true});}
 if(path.endsWith('/ws')){
 if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket richiesto.'},426);if(this.ctx.getWebSockets().length>=40)return json({error:'Troppe connessioni.'},429);const watch=new URL(req.url).searchParams.get('watch')==='1'||s.archived,p=s.players[user?.id];if(!user||!watch&&(!p||s.arenaMatch&&!s.arenaMatch.roster.includes(p.id)))return json({error:'Entra nella spedizione prima di collegarti.'},403);
 const pair=new WebSocketPair(),connection=crypto.randomUUID();this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({kind:'lab',id:user.id,connection,watch,accessTag:req.headers.get('X-Access-Tag')});if(!watch){for(const other of this.ctx.getWebSockets()){const a=other.deserializeAttachment();if(other!==pair[1]&&a?.id===user.id&&!a.watch)try{other.close(4000,'Gioco aperto in un’altra finestra')}catch{}}connectPlayer(s,user.id,connection,now);await this.save();await this.index();await this.schedule()}await this.broadcast();return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'checkmate'}});
 }
 return json({error:'Percorso non trovato.'},404);
 }catch(e){return json({error:e instanceof SyntaxError?'Richiesta non valida.':e.message},409)}})}
 async message(ws,message){return this.ctx.blockConcurrencyWhile(async()=>{const s=await this.load();if(!s||s.deleted)return;const a=ws.deserializeAttachment();try{
 if(typeof message!=='string'||message.length>2048)return;const b=JSON.parse(message),p=s.players[a.id],now=Date.now();if(!a.rateAt||now-a.rateAt>=1000){a.rateAt=now;a.messages=0}if(++a.messages>32)return;ws.serializeAttachment(a);if(!a.watch&&(!p||p.connection!==a.connection))return;
 if(sweep(s,now)){await this.save();await this.index();await this.schedule();await this.broadcast();if(s.deleted)return}
 if(b.type==='heartbeat'){const wasOnline=p?.online;if(!a.watch&&!s.archived){if(wasOnline)p.lastSeen=now;else connectPlayer(s,a.id,a.connection,now);if(now-this.lastSave>5000||!wasOnline)await this.save();if(!wasOnline)await this.index();await this.schedule()}await this.broadcast();return}
 if(a.watch||s.archived)throw Error('Stai assistendo.');
 if(b.type==='pose'){
  const result=pose(s,p,b,now),important=['warp','level','trap'].includes(result);
  if(!result||result==='clipped')ws.send(JSON.stringify({type:'state',state:snapshot(s),correct:true,correctSeq:b.seq,serverTime:now}));
  if(important||now-this.lastSave>5000)await this.save();
  if(result==='level')await this.index();
  await this.broadcast(important);return
 }
 if(b.type==='action'&&Number.isSafeInteger(b.request)){const prior=s.arenaMatch?.result;act(s,p,b,now);await this.save();if(prior!==s.arenaMatch?.result||b.kind!=='strike'&&b.kind!=='appearance')await this.index();await this.schedule();await this.broadcast();ws.send(JSON.stringify({type:'ack',request:b.request,ok:true}));}
 }catch(e){try{const b=JSON.parse(message);ws.send(JSON.stringify({type:'ack',request:b.request,ok:false,error:e.message}));ws.send(JSON.stringify({type:'state',state:snapshot(s)}))}catch{}}})}
 async close(ws){return this.ctx.blockConcurrencyWhile(async()=>{const s=await this.load(),a=ws.deserializeAttachment();if(!s||a.watch)return;disconnectPlayer(s,a.id,a.connection,Date.now());await this.save();await this.index();await this.schedule();await this.broadcast()})}
 async alarm(){return this.ctx.blockConcurrencyWhile(async()=>{const s=await this.load();if(!s)return;if(sweep(s,Date.now())){await this.save();await this.index();await this.broadcast()}else if(s.arenaMatch?.result?.winner&&!this.arenaRecorded)await this.index();await this.schedule()})}
}
