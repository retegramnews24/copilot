import {normalizeAppearance} from './public/appearance.js';
import {youtubeId,youtubeChannelId,positionAt} from './public/cinema/media.js';
const ROOMS='cinema-rooms', FAVORITES='cinema-favorites';
const MAX_ROOMS=24, MAX_FAVORITES=120, METADATA_TTL=28*86400000;
const response=(message,status)=>Response.json({error:message},{status});

function cleanURL(value,max){
  if(typeof value!=='string'||value.length>max)return '';
  try{
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password ? url.href : '';
  }catch{return '';}
}
function cleanChannel(input,allowChannel=false){
  const name=typeof input?.name==='string'?input.name.trim().slice(0,96):'';
  const url=cleanURL(input?.url,1400),youtube=youtubeId(url);
  if(!name||!url||/\/api\/cinema\/media\//.test(new URL(url).pathname))return null;
  const channelId=youtubeChannelId(url),catalog=input.catalog===true?{catalogUntil:Date.now()+METADATA_TTL}:{};
  if(channelId)return allowChannel?{name,url:'https://www.youtube.com/channel/'+channelId,youtubeChannel:channelId,logo:'',...catalog}:null;
  if(youtube){
    const live=!allowChannel&&(input.live===true||new URL(url).pathname.startsWith('/live/'));
    return {name,url:'https://www.youtube.com/watch?v='+youtube,youtube,logo:'',...(live?{live}:{}),...catalog};
  }
  return {name,url,logo:cleanURL(input.logo,900)};
}

export class Cinema {
  constructor(ctx){this.ctx=ctx;}
  async data(){
    const saved=await this.ctx.storage.get([ROOMS,FAVORITES]);
    return {rooms:saved.get(ROOMS)??[],favorites:saved.get(FAVORITES)??[]};
  }
  async scheduleMetadata(expires){
    if(!expires)return;
    const scheduled=await this.ctx.storage.getAlarm();
    if(scheduled===null||scheduled>expires)await this.ctx.storage.setAlarm(expires);
  }
  alarm(){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const data=await this.data(),now=Date.now();
      let next=Infinity,changed=false;
      for(const item of [...data.favorites,...data.rooms.map(room=>room.channel)]){
        if(!item?.catalogUntil)continue;
        if(item.catalogUntil>now){next=Math.min(next,item.catalogUntil);continue;}
        item.name=item.youtubeChannel?'Canale YouTube · '+item.youtubeChannel.slice(-6):'Video YouTube · '+item.youtube;
        delete item.catalogUntil;delete item.live;changed=true;
      }
      if(changed){
        await this.ctx.storage.put({[ROOMS]:data.rooms,[FAVORITES]:data.favorites});
        this.publish(data,true);
      }
      if(Number.isFinite(next))await this.ctx.storage.setAlarm(next);
    });
  }
  connections(){
    return this.ctx.getWebSockets().flatMap(socket=>{
      const info=socket.deserializeAttachment();
      return info?.kind==='cinema'&&!info.closed&&socket.readyState===1 ? [{socket,info}] : [];
    });
  }
  publish(data,sendFavorites=false){
    const clients=this.connections(), seats=new Map();
    for(const {info:{room,user,appearance}} of clients){
      if(!room)continue;
      if(!seats.has(room))seats.set(room,new Map());
      seats.get(room).set(user.player,{id:user.player,name:user.name,appearance:normalizeAppearance(appearance)});
    }
    const rooms=data.rooms.map(({id,number,channel})=>({
      id,number,channel:channel?.name??null,viewers:[...(seats.get(id)?.values()??[])]
    }));
    const favorites=sendFavorites?JSON.stringify({type:'favorites',items:data.favorites}):null;
    const now=Date.now();
    for(const {socket,info} of clients){
      const active=data.rooms.find(room=>room.id===info.room);
      try{
        socket.send(JSON.stringify({type:'rooms',rooms,active:active?{id:active.id,channel:active.channel,playback:active.playback??null,canClose:!active.owner||active.owner===info.user.player}:null,me:info.user.player,now}));
        if(favorites)socket.send(favorites);
      }catch{}
    }
  }
  fetch(req){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const path=new URL(req.url).pathname;
      if(path==='/cinema/upload')return this.upload(req);
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
  async upload(req){
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
    const {room:id,file,url,name,cancel}=await req.json();
    const data=await this.data(),room=data.rooms.find(entry=>entry.id===id);
    if(!room||!user)return response('Questa sala è stata chiusa.',404);
    if((url||cancel)&&(room.upload?.file!==file||room.upload.player!==user.player))return response('Caricamento scaduto.',409);
    if(!cancel&&!this.connections().some(c=>c.info.room===id&&c.info.user.player===user.player))return response('Entra nella sala per condividere un video.',403);
    const now=Date.now();
    if(cancel)delete room.upload;
    else if(!url){
      if(room.upload?.until>now)return response('È già in corso un caricamento in sala.',409);
      room.upload={file,player:user.player,until:now+300000};
    }else{
      delete room.upload;
      room.channel={name,url,file:true,logo:''};
      room.updated=now;
      room.playback={position:0,playing:true,updated:now,seek:0};
    }
    await this.ctx.storage.put(ROOMS,data.rooms);
    if(url)this.publish(data);
    return new Response(null,{status:204});
  }
  message(socket,raw){
    return this.ctx.blockConcurrencyWhile(async()=>{
      try{
        if(typeof raw!=='string'||raw.length>4096)return;
        const input=JSON.parse(raw),info=socket.deserializeAttachment(),data=await this.data();
        const room=data.rooms.find(entry=>entry.id===info.room);
        if(input.type==='appearance'){
          socket.serializeAttachment({...info,appearance:normalizeAppearance(input.appearance)});
          if(room)this.publish(data);
          return;
        }
        if(input.type==='enter'){
          const next=data.rooms.find(entry=>entry.id===input.room);
          if(!next){socket.serializeAttachment({...info,room:null});this.publish(data);throw Error('Questa sala è stata chiusa.');}
          socket.serializeAttachment({...info,room:next.id});this.publish(data);return;
        }
        if(input.type==='leave'){
          socket.serializeAttachment({...info,room:null});this.publish(data);return;
        }
        if(input.type==='create'){
          if(room)throw Error('Esci dalla sala prima di aprirne un’altra.');
          const occupied=new Set(this.connections().map(c=>c.info.room));
          const rooms=data.rooms.filter(r=>occupied.has(r.id)||Date.now()-r.updated<3_600_000);
          if(rooms.length>=MAX_ROOMS)throw Error('Tutte le sale sono occupate.');
          let number=1;while(rooms.some(r=>r.number===number))number++;
          const next={id:crypto.randomUUID(),number,owner:info.user.player,channel:null,updated:Date.now()};
          rooms.push(next);
          await this.ctx.storage.put(ROOMS,rooms);
          socket.serializeAttachment({...info,room:next.id});
          this.publish({...data,rooms});return;
        }
        if(!room)throw Error('Entra in una sala.');
        if(input.type==='close-room'){
          if(room.owner&&room.owner!==info.user.player)throw Error('Solo chi ha aperto la sala può chiuderla.');
          const rooms=data.rooms.filter(entry=>entry!==room);
          await this.ctx.storage.put(ROOMS,rooms);
          for(const client of this.connections())if(client.info.room===room.id){
            client.socket.serializeAttachment({...client.info,room:null});
            try{client.socket.send(JSON.stringify({type:'room-closed',id:room.id}));}catch{}
          }
          this.publish({...data,rooms});return;
        }
        if(input.type==='channel'){
          const channel=cleanChannel(input.channel);
          if(!channel)throw Error('Canale non valido.');
          if(room.channel?.url===channel.url&&!channel.catalogUntil&&!!room.channel.live===!!channel.live)return;
          room.channel=channel;room.updated=Date.now();
          room.playback=channel.youtube?{position:0,playing:true,updated:room.updated,seek:0}:null;
          await this.ctx.storage.put(ROOMS,data.rooms);await this.scheduleMetadata(channel.catalogUntil);this.publish(data);return;
        }
        if(input.type==='playback'){
          if(!(room.channel?.youtube||room.channel?.file)||input.url!==room.channel.url||!room.playback)return;
          const now=Date.now(),playback=room.playback;
          let position=positionAt(playback,now),playing=playback.playing,seek=playback.seek??0;
          if(input.command==='play')playing=true;
          else if(input.command==='pause')playing=false;
          else if(input.command==='seek'&&!room.channel.live&&Number.isFinite(input.position)&&input.position>=0&&input.position<=86400){position=input.position;seek++;}
          else throw Error('Comando video non valido.');
          room.updated=now;room.playback={position,playing,updated:now,seek};
          await this.ctx.storage.put(ROOMS,data.rooms);this.publish(data);return;
        }
        const favorites=data.favorites;
        if(input.type==='favorite-add'){
          const channel=cleanChannel(input.channel,true);
          if(!channel)throw Error('Canale non valido.');
          if(favorites.some(item=>item.url===channel.url))return;
          if(favorites.length>=MAX_FAVORITES)throw Error('La lista condivisa è piena.');
          favorites.push({...channel,id:crypto.randomUUID()});
          await this.scheduleMetadata(channel.catalogUntil);
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
