import {height,modes,validMode,newMatch,movePaddle,stepMatch} from './public/arcade/pong-physics.js';

const KEY='pong', EMPTY_GRACE=60_000, STEP=1/120;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export class PongRoom {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;
    this.tickAt=0;this.broadcastAt=0;
    this.inputs=[];
  }
  peers(){
    return this.ctx.getWebSockets(KEY).map(socket=>({socket,member:socket.deserializeAttachment()}))
      .filter(({socket,member})=>member&&!member.closed&&socket.readyState===1)
      .sort((a,b)=>a.member.seat-b.member.seat);
  }
  state(room,peers=this.peers()){
    return {room:room.id,number:room.number,phase:room.phase,match:room.match,
      players:peers.map(({member:{id,name,seat}})=>({id,name,seat}))};
  }
  summary(room){
    const {players}=this.state(room);
    return {room:room.id,number:room.number,game:KEY,phase:players.length===2?'playing':'waiting',
      players,online:players.length,capacity:2,created:room.created,revision:room.revision};
  }
  broadcast(room,peers=this.peers()){
    const data=JSON.stringify({type:'state',state:this.state(room,peers)});
    for(const {socket} of peers)try{socket.send(data);}catch{}
    this.broadcastAt=Date.now();
  }
  async syncLobby(room,action='update'){
    const lobby=this.env.ROOMS.get(this.env.ROOMS.idFromName('checkmate-lobby-v1'));
    await lobby.fetch('https://internal/lobby/'+action,{method:'POST',body:JSON.stringify(this.summary(room))});
  }
  async load(){
    return this.room??=await this.ctx.storage.get(KEY);
  }
  async persist(room,presence=false){
    if(presence)room.revision++;
    await this.ctx.storage.put(KEY,room);
    if(presence)await this.syncLobby(room);
  }
  fetch(req){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
      if(!user?.player)return json({error:'Accesso richiesto.'},401);
      const path=new URL(req.url).pathname;
      let room=await this.load();
      if(path==='/pong/init'&&req.method==='POST'&&!room){
        const {room:id,number,mode}=await req.json();
        room=this.room={id,number,created:Date.now(),revision:0,phase:'waiting',
          roster:[],match:newMatch(validMode(mode)&&!modes[mode].solo?mode:'classic')};
        await this.persist(room);
        await this.ctx.storage.setAlarm(Date.now()+EMPTY_GRACE);
        return json({state:this.state(room),summary:this.summary(room)});
      }
      if(!room)return json({error:'La sala Pong è stata chiusa.'},404);
      const peers=this.peers(),old=peers.find(({member})=>member.id===user.player);
      if(path==='/pong/state')return json({state:this.state(room,peers)});
      if(path!=='/pong/ws'||req.headers.get('Upgrade')?.toLowerCase()!=='websocket'){
        return json({error:'WebSocket richiesto.'},426);
      }
      if(!old&&peers.length===2)return json({error:'La sala Pong è al completo.'},409);
      const free=[0,1].filter(seat=>!peers.some(({member})=>member.seat===seat));
      const seat=old?.member.seat??free.find(seat=>room.roster[seat]===user.player)??free[0];
      if(old){
        old.socket.serializeAttachment({...old.member,closed:true});
        old.socket.close(4000,'Pong aperto in un’altra finestra');
      }
      if(room.roster[seat]&&room.roster[seat]!==user.player){
        room.match=newMatch(room.match.mode);
        if(room.phase!=='off')room.phase='waiting';
      }
      room.roster[seat]=user.player;
      this.inputs[seat]=null;
      const pair=new WebSocketPair(),socket=pair[1];
      this.ctx.acceptWebSocket(socket,[KEY]);
      socket.serializeAttachment({kind:KEY,id:user.player,name:user.name.slice(0,45),seat,
        memberId:JSON.parse(req.headers.get('X-Checkmate-User')||'null')?.id,accessTag:req.headers.get('X-Access-Tag')});
      const current=this.peers();
      if(current.length===2&&room.phase==='waiting'){room.phase='playing';this.tickAt=Date.now();}
      await this.ctx.storage.deleteAlarm();
      await this.persist(room,true);
      this.broadcast(room,current);
      return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':'checkmate'}});
    });
  }
  tick(room,now){
    if(room.phase!=='playing')return false;
    if(!this.tickAt){this.tickAt=now;return false;}
    const elapsed=Math.min(.15,Math.max(0,(now-this.tickAt)/1000));
    const frames=Math.floor(elapsed/STEP);
    if(!frames)return false;
    this.tickAt=now-(elapsed-frames*STEP)*1000;
    const total=room.match.scores[0]+room.match.scores[1];
    for(let i=0;i<frames;i++){
      for(let seat=0;seat<2;seat++){
        const input=this.inputs[seat];
        if(input&&now-input.at<260)movePaddle(room.match,seat,input.direction,input.target,STEP);
      }
      stepMatch(room.match,STEP);
      if(room.match.winner!==null){room.phase='over';break;}
    }
    return total!==room.match.scores[0]+room.match.scores[1]||room.phase==='over';
  }
  message(socket,raw){
    return this.ctx.blockConcurrencyWhile(async()=>{
      if(typeof raw!=='string'||raw.length>200)return;
      const member=socket.deserializeAttachment();
      if(!member||member.closed)return;
      let input;
      try{input=JSON.parse(raw);}catch{return;}
      const room=await this.load();
      if(!room)return;
      const now=Date.now();
      if(input?.type==='input'){
        if(![-1,0,1].includes(input.direction)||input.target!==null&&
          (!Number.isFinite(input.target)||input.target<0||input.target>height))return;
        if(now-(this.inputs[member.seat]?.at??0)<33)return;
        this.inputs[member.seat]={direction:input.direction,target:input.target,at:now};
        const scored=this.tick(room,now);
        if(scored)await this.persist(room);
        if(scored||room.phase==='playing'&&now-this.broadcastAt>=43)this.broadcast(room);
        return;
      }
      const peers=this.peers();
      if(peers[0]?.socket!==socket)return;
      const ready=peers.length===2;
      if(input?.type==='mode'&&validMode(input.mode)&&!modes[input.mode].solo){
        room.match=newMatch(input.mode);
        if(room.phase!=='off')room.phase=ready?'paused':'waiting';
      }else if(input?.type==='reset'){
        room.match=newMatch(room.match.mode);
        if(room.phase!=='off')room.phase=ready?'paused':'waiting';
      }else if(input?.type==='power'){
        room.phase=room.phase==='off'?(ready?'paused':'waiting'):'off';
      }else if(input?.type==='start'&&ready&&room.phase!=='off'){
        if(room.phase==='over')room.match=newMatch(room.match.mode);
        room.phase=room.phase==='playing'?'paused':'playing';
      }else return;
      this.tickAt=now;
      await this.persist(room);
      this.broadcast(room,peers);
    });
  }
  close(socket){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const member=socket.deserializeAttachment();
      if(!member||member.closed)return;
      socket.serializeAttachment({...member,closed:true});
      const room=await this.load();
      if(!room)return;
      const peers=this.peers();
      this.inputs[member.seat]=null;
      if(room.phase==='playing')room.phase='waiting';
      this.tickAt=0;
      this.broadcast(room,peers);
      if(!peers.length)await this.ctx.storage.setAlarm(Date.now()+EMPTY_GRACE);
      await this.persist(room,true);
    });
  }
  alarm(){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const room=await this.load();
      if(!room||this.peers().length)return;
      await this.syncLobby(room,'remove');
      await this.ctx.storage.delete(KEY);
      this.room=null;
    });
  }
}
