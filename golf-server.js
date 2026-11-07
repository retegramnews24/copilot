import { makeMatch, joinMatch, startMatch, takeShot, advanceMatch, CAPACITY } from './public/golf/match.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const WAIT=900000, KEEP=300000;

export class GolfRoom {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  summary(match){
    const {room,number,game,phase,created,revision}=match;
    return {room,number,game,phase,created,revision,capacity:CAPACITY,hole:match.hole,
      players:match.players.map(({id,name})=>({id,name})),expires:null};
  }
  async lobby(path,body){
    return this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1')).fetch('https://internal/lobby/'+path,
      {method:'POST',body:JSON.stringify(body)});
  }
  async save(match){
    await this.ctx.storage.put('golf',match);
    const now=Date.now(), landings=match.players.flatMap(p=>!p.done&&p.shot?.until>now?[p.shot.until]:[]);
    const deadline=match.deadline>now||!landings.length?match.deadline:Infinity;
    const next=match.phase==='waiting'?match.created+WAIT:match.phase==='finished'?match.finished+KEEP:
      match.nextAt??Math.min(deadline,...landings);
    await this.ctx.storage.setAlarm(next);
  }
  async update(match){
    if(match.phase==='finished'){
      await this.lobby('result',{key:match.room+':golf',game:'golf',mode:'people',winners:match.winners});
    }
    await this.lobby('update',this.summary(match));
  }
  fetch(req){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
      if(!user?.player)return json({error:'Accesso richiesto.'},401);
      const now=Date.now(), url=new URL(req.url), action=url.pathname.split('/').at(-1);
      let match=await this.ctx.storage.get('golf');
      try {
        if(action==='init' && !match && req.method==='POST'){
          const {room,number}=await req.json();
          match=makeMatch(room,number,user,now);
          await this.save(match);
          return json({state:match,summary:this.summary(match),now});
        }
        if(!match)return json({error:'Stanza chiusa.'},404);
        if(advanceMatch(match,now)){await this.save(match);await this.update(match);}
        if(action==='state' && req.method==='GET')return json(url.searchParams.get('after')===String(match.revision)?{now}:{state:match,now});
        if(req.method!=='POST')return json({error:'Operazione non disponibile.'},405);
        const raw=await req.text();
        if(raw.length>512)return json({error:'Richiesta troppo grande.'},413);
        if(action==='join')joinMatch(match,user);
        else if(action==='start')startMatch(match,user.player,now);
        else if(action==='shot')takeShot(match,user.player,JSON.parse(raw),now);
        else return json({error:'Operazione non disponibile.'},404);
        await this.save(match);
        if(action!=='shot')await this.update(match);
        return json({state:match,now});
      } catch(error){return json({error:error.message},409);}
    });
  }
  alarm(){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const match=await this.ctx.storage.get('golf');
      if(!match)return;
      const now=Date.now();
      if(match.phase==='waiting'&&now>=match.created+WAIT || match.phase==='finished'&&now>=match.finished+KEEP){
        await this.lobby('remove',{room:match.room});await this.ctx.storage.delete('golf');return;
      }
      if(advanceMatch(match,now)){await this.save(match);await this.update(match);}
      else await this.save(match);
    });
  }
}
