const ROOMS='cinema-rooms', FAVORITES='cinema-favorites';
const MAX_ROOMS=24, MAX_FAVORITES=120;
const response=(message,status)=>Response.json({error:message},{status});

function cleanURL(value,max){
  if(typeof value!=='string'||value.length>max)return '';
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password ? url.href : '';
  }catch{return '';}
}
function cleanChannel(input){
  const name=typeof input?.name==='string'?input.name.trim().slice(0,96):'';
  const url=cleanURL(input?.url,1400);
  return name&&url ? {name,url,logo:cleanURL(input.logo,900)} : null;
}

export class Cinema {
  constructor(ctx){this.ctx=ctx;}
  async data(){
    const saved=await this.ctx.storage.get([ROOMS,FAVORITES]);
    return {rooms:saved.get(ROOMS)??[],favorites:saved.get(FAVORITES)??[]};
  }
  connections(){
    return this.ctx.getWebSockets().flatMap(socket=>{
      const info=socket.deserializeAttachment();
      return info?.kind==='cinema'&&!info.closed&&socket.readyState===1 ? [{socket,info}] : [];
    });
  }
  publish(data,sendFavorites=false){
    const clients=this.connections(), seats=new Map();
    for(const {info:{room,user}} of clients){
      if(!room)continue;
      if(!seats.has(room))seats.set(room,new Map());
      seats.get(room).set(user.player,{id:user.player,name:user.name});
    }
    const rooms=data.rooms.map(({id,number,channel})=>({
      id,number,channel:channel?.name??null,viewers:[...(seats.get(id)?.values()??[])]
    }));
    const favorites=sendFavorites?JSON.stringify({type:'favorites',items:data.favorites}):null;
    for(const {socket,info} of clients){
      const active=data.rooms.find(room=>room.id===info.room);
      try{
        socket.send(JSON.stringify({type:'rooms',rooms,active:active?{id:active.id,channel:active.channel}:null,me:info.user.player}));
        if(favorites)socket.send(favorites);
      }catch{}
    }
  }
  fetch(req){
    return this.ctx.blockConcurrencyWhile(async()=>{
      if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return response('WebSocket richiesto.',426);
      const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
      if(!user)return response('Accesso richiesto.',401);
      if(this.ctx.getWebSockets().length>=120)return response('Cinema pieno.',429);
      const [client,socket]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(socket);
      socket.serializeAttachment({kind:'cinema',user,room:null,accessTag:req.headers.get('X-Access-Tag')});
      const data=await this.data();
      this.publish(data);
      socket.send(JSON.stringify({type:'favorites',items:data.favorites}));
      return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'checkmate'}});
    });
  }
  message(socket,raw){
    return this.ctx.blockConcurrencyWhile(async()=>{
      try{
        if(typeof raw!=='string'||raw.length>4096)return;
        const input=JSON.parse(raw),info=socket.deserializeAttachment(),data=await this.data();
        const room=data.rooms.find(entry=>entry.id===info.room);
        if(input.type==='enter'){
          const next=data.rooms.find(entry=>entry.id===input.room);
          if(!next){socket.serializeAttachment({...info,room:null});this.publish(data);throw Error('Questa sala è stata chiusa.');}
          socket.serializeAttachment({...info,room:next.id});this.publish(data);return;
        }
        if(input.type==='leave'){
          socket.serializeAttachment({...info,room:null});this.publish(data);return;
        }
        if(input.type==='create'){
          const occupied=new Set(this.connections().map(c=>c.info.room));
          const rooms=data.rooms.filter(r=>occupied.has(r.id)||Date.now()-r.updated<3_600_000);
          if(rooms.length>=MAX_ROOMS)throw Error('Tutte le sale sono occupate.');
          let number=1;while(rooms.some(r=>r.number===number))number++;
          const next={id:crypto.randomUUID(),number,channel:null,updated:Date.now()};
          rooms.push(next);
          await this.ctx.storage.put(ROOMS,rooms);
          socket.serializeAttachment({...info,room:next.id});
          this.publish({...data,rooms});return;
        }
        if(!room)throw Error('Entra in una sala.');
        if(input.type==='channel'){
          const channel=cleanChannel(input.channel);
          if(!channel)throw Error('Canale non valido.');
          room.channel=channel;room.updated=Date.now();
          await this.ctx.storage.put(ROOMS,data.rooms);this.publish(data);return;
        }
        const favorites=data.favorites;
        if(input.type==='favorite-add'){
          const channel=cleanChannel(input.channel);
          if(!channel)throw Error('Canale non valido.');
          if(favorites.some(item=>item.url===channel.url))return;
          if(favorites.length>=MAX_FAVORITES)throw Error('La lista condivisa è piena.');
          favorites.push({...channel,id:crypto.randomUUID()});
        }else if(input.type==='favorite-remove'||input.type==='favorite-move'){
          const index=favorites.findIndex(item=>item.id===input.id);
          if(index<0||input.before===input.id)return;
          if(input.type==='favorite-move'&&input.before!==null&&!favorites.some(item=>item.id===input.before))return;
          const [item]=favorites.splice(index,1);
          if(input.type==='favorite-move'){
            const before=input.before===null?favorites.length:favorites.findIndex(entry=>entry.id===input.before);
            favorites.splice(before,0,item);
          }
        }else return;
        if(new TextEncoder().encode(JSON.stringify(favorites)).byteLength>120000)throw Error('La lista condivisa è piena.');
        await this.ctx.storage.put(FAVORITES,favorites);this.publish(data,true);
      }catch(error){try{socket.send(JSON.stringify({type:'error',message:error.message}));}catch{}}
    });
  }
  close(socket){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const info=socket.deserializeAttachment();
      if(!info||info.closed)return;
      socket.serializeAttachment({...info,closed:true});
      this.publish(await this.data());
      try{socket.close(1000,'Sala lasciata');}catch{}
    });
  }
}
