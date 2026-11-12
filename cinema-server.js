import {normalizeAppearance} from './public/appearance.js';
import {youtubeId,youtubeChannelId,positionAt} from './public/cinema/media.js';
const ROOMS='cinema-rooms', FAVORITES='cinema-favorites';
const MAX_ROOMS=24, MAX_FAVORITES=120, METADATA_TTL=28*86400000;
const response=(message,status)=>Response.json({error:message},{status});
const SCREEN_VIEWERS=3;
const INBOX_TTL=30*60*1000, MAX_QUEUE=12, MEDIA_LOAD_TIMEOUT=30000;
const send=(socket,packet)=>{try{socket.send(JSON.stringify(packet));}catch{}};
const validScreenId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
function screenSignal(signal,host){
  if(signal?.type===(host?'offer':'answer')&&typeof signal.sdp==='string'&&signal.sdp.length<=22000){
    return {type:signal.type,sdp:signal.sdp};
  }
  if(signal?.type==='ice'&&typeof signal.candidate==='string'&&signal.candidate.length<=2048&&
    (signal.mid===null||typeof signal.mid==='string'&&signal.mid.length<=64)&&
    (signal.index===null||Number.isInteger(signal.index)&&signal.index>=0&&signal.index<=32)){
    return {type:'ice',candidate:signal.candidate,mid:signal.mid,index:signal.index};
  }
  return null;
}

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
  if(!name||!url||/\/api\/cinema\/(?:(?:group|inbox)\/)?media\//.test(new URL(url).pathname))return null;
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
  queueDeadline(room){
    return room.current?.duration&&room.playback?.playing
      ?room.playback.updated+(room.current.loading?MEDIA_LOAD_TIMEOUT:Math.max(0,room.current.duration-room.playback.position)*1000):null;
  }
  nextSubmission(room,now=Date.now()){
    delete room.inboxHold;
    room.current=room.queue?.shift()??null;
    room.updated=now;
    if(!room.current){room.channel=null;room.playback=null;return;}
    room.current.loading=!!room.current.file;
    const {id,kind,name,text}=room.current;
    room.channel={inbox:true,kind,name,text,url:'/api/cinema/inbox/media/'+room.id+'/'+id,
      ...(['video','audio'].includes(kind)?{file:true}:{})};
    room.playback={position:0,playing:true,updated:now,seek:0};
  }
  async syncQueueAudience(data,...ids){
    let changed=false;
    for(const room of data.rooms.filter(entry=>ids.includes(entry.id))){
      const occupied=this.connections().some(client=>client.info.room===room.id);
      if(occupied&&!room.channel&&room.queue?.length){
        this.nextSubmission(room);changed=true;
      }else if(occupied&&room.inboxHold){
        room.playback={...room.playback,playing:true,updated:Date.now()};
        delete room.inboxHold;changed=true;
      }else if(!occupied&&room.current&&room.playback?.playing){
        const now=Date.now();
        room.playback={...room.playback,position:room.current.loading?0:positionAt(room.playback,now),playing:false,updated:now};
        room.inboxHold=true;changed=true;
      }else continue;
      await this.scheduleMetadata(this.queueDeadline(room));
    }
    if(changed)await this.ctx.storage.put(ROOMS,data.rooms);
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
      for(const room of data.rooms){
        const deadline=this.queueDeadline(room);
        if(deadline===null)continue;
        if(deadline<=now){this.nextSubmission(room,now);changed=true;}
        next=Math.min(next,this.queueDeadline(room)??Infinity);
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
  screenHost(room,clients=this.connections()){
    return clients.find(entry=>entry.info.room===room&&entry.info.screen);
  }
  dropScreenViewer(info,shareId=null,crossRoomOnly=false){
    if(!info.client)return;
    for(const host of this.connections()){
      const active=host.info.screen;
      if(!active?.viewers.includes(info.client)||(shareId&&active.id!==shareId)||(crossRoomOnly&&host.info.room===info.room))continue;
      const screen={...active,viewers:active.viewers.filter(id=>id!==info.client)};
      host.socket.serializeAttachment({...host.info,screen});
      send(host.socket,{type:'screen-peer-left',share:screen.id,peer:info.client});
    }
  }
  async screenMessage(socket,info,input){
    if(!info.room||!info.client||!validScreenId(input.share))throw Error('Entra nella sala per condividere lo schermo.');
    const clients=this.connections(),localHost=this.screenHost(info.room,clients);
    if(input.type==='screen-start'){
      if(localHost)throw Error('C’è già una finestra condivisa in questa sala.');
      if(clients.some(entry=>entry.info.screen?.id===input.share))throw Error('Avvia una nuova condivisione.');
      socket.serializeAttachment({...info,screen:{id:input.share,viewers:[]}});
      this.publish(await this.data());return;
    }
    const preview=input.preview===true;
    const host=preview&&info.mosaic
      ?clients.find(entry=>entry.info.screen?.id===input.share):localHost;
    if(preview&&!info.mosaic)return;
    const screen=host?.info.screen;
    if(!screen||screen.id!==input.share)return;
    const isHost=host.socket===socket;
    if(input.type==='screen-stop'){
      if(!isHost)return;
      socket.serializeAttachment({...info,screen:null});
      this.publish(await this.data());return;
    }
    if(input.type==='screen-watch'){
      if(isHost||screen.viewers.includes(info.client))return;
      if(screen.viewers.length>=SCREEN_VIEWERS)throw Error('La condivisione ha già tre spettatori. Riprova tra poco.');
      host.socket.serializeAttachment({...host.info,screen:{...screen,viewers:[...screen.viewers,info.client]}});
      send(host.socket,{type:'screen-peer',share:screen.id,peer:info.client});return;
    }
    if(input.type==='screen-unwatch'){
      this.dropScreenViewer(info,screen.id);return;
    }
    if(input.type!=='screen-signal')return;
    const signal=screenSignal(input.signal,isHost);
    if(!signal)return;
    const target=isHost
      ? clients.find(entry=>(entry.info.room===info.room||entry.info.mosaic)&&entry.info.client===input.peer&&screen.viewers.includes(input.peer))
      : input.peer===host.info.client&&screen.viewers.includes(info.client)?host:null;
    if(target)send(target.socket,{type:'screen-signal',share:screen.id,peer:info.client,signal});
  }
  publish(data,sendFavorites=false){
    const clients=this.connections(), seats=new Map();
    for(const {info:{room,user,appearance}} of clients){
      if(!room)continue;
      if(!seats.has(room))seats.set(room,new Map());
      seats.get(room).set(user.player,{id:user.player,name:user.name,appearance:normalizeAppearance(appearance)});
    }
    const shares=new Map(clients.filter(({info})=>info.screen).map(entry=>[entry.info.room,entry]));
    const rooms=data.rooms.map(({id,number,channel})=>({
      id,number,channel:shares.has(id)?'Finestra condivisa':channel?.inbox?'Coda Telegram':channel?.name??null,viewers:[...(seats.get(id)?.values()??[])]
    }));
    const viewScreen=(sharing,socket)=>sharing?{id:sharing.info.screen.id,peer:sharing.info.client,name:sharing.info.user.name,local:sharing.socket===socket}:null;
    const favorites=sendFavorites?JSON.stringify({type:'favorites',items:data.favorites}):null;
    const now=Date.now();
    for(const {socket,info} of clients){
      const active=data.rooms.find(room=>room.id===info.room);
      const screen=viewScreen(shares.get(info.room),socket);
      const previews=info.mosaic&&active?data.rooms.map(entry=>({
        id:entry.id,channel:entry.channel?.inbox&&entry!==active?null:entry.channel,playback:entry.playback??null,screen:viewScreen(shares.get(entry.id),socket)
      })):undefined;
      try{
        socket.send(JSON.stringify({type:'rooms',rooms,active:active?{id:active.id,channel:active.channel,playback:active.playback??null,queue:active.queue?.length??0,screen,canClose:!active.owner||active.owner===info.user.player}:null,previews,me:info.user.player,now}));
        if(favorites)socket.send(favorites);
      }catch{}
    }
  }
  fetch(req){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const path=new URL(req.url).pathname;
      
      if(path.startsWith('/cinema/group-'))return this.groupForward(req,path.slice('/cinema/group-'.length));
      if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return response('WebSocket richiesto.',426);
      const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
      if(!user)return response('Accesso richiesto.',401);
      if(this.ctx.getWebSockets().length>=120)return response('Cinema pieno.',429);
      const [client,socket]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(socket);
      socket.serializeAttachment({kind:'cinema',user,room:null,client:crypto.randomUUID(),memberId:JSON.parse(req.headers.get('X-Checkmate-User')||'null')?.id,accessTag:req.headers.get('X-Access-Tag')});
      const data=await this.data();
      this.publish(data);
      socket.send(JSON.stringify({type:'favorites',items:data.favorites}));
      return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'checkmate'}});
    });
  }
  async groupForward(req,op){
    const user=JSON.parse(req.headers.get('X-Checkmate-User')||'null');
    if(!user?.player)return response('Accesso richiesto.',401);
    const input=await req.json(),key='forward:'+user.player;
    const joined=room=>this.connections().some(c=>c.info.room===room&&c.info.user.player===user.player);
    if(op==='arm'){
      if(!joined(input.room))return response('Entra in una sala Cinema.',403);
      const previous=await this.ctx.storage.get(key);
      await this.ctx.storage.put(key,{room:input.room,seen:previous?.seen??[],expires:Date.now()+INBOX_TTL});
      return new Response(null,{status:204});
    }
    if(op==='asset'||op==='asset-ready'){
      if(!joined(input.room))return response('Entra nella sala per vedere questo contenuto.',403);
      const data=await this.data(),room=data.rooms.find(entry=>entry.id===input.room),item=room?.current;
      if(!item?.file||item.id!==input.item)return response('Contenuto non più in riproduzione.',404);
      if(op==='asset')return Response.json({file:item.file,type:item.type,loading:item.loading});
      if(item.loading){
        delete item.loading;room.playback.updated=Date.now();
        await this.scheduleMetadata(this.queueDeadline(room));
        await this.ctx.storage.put(ROOMS,data.rooms);this.publish(data);
      }
      return new Response(null,{status:204});
    }
    const pending=await this.ctx.storage.get(key);
    if(!pending||pending.expires<=Date.now()||(op==='disarm'&&pending.room!==input.room)){
      if(pending?.expires<=Date.now())await this.ctx.storage.delete(key);
      return response('Nessuna sala collegata.',404);
    }
    if(op==='disarm'){
      await this.ctx.storage.delete(key);
      return new Response(null,{status:204});
    }
    const data=await this.data(),room=data.rooms.find(entry=>entry.id===pending.room);
    if(!room){
      await this.ctx.storage.delete(key);
      return response('Questa sala è stata chiusa.',404);
    }
    const notify=packet=>{
      for(const client of this.connections())if(client.info.room===room.id&&client.info.user.player===user.player){
        send(client.socket,{type:'group-forward-status',...packet});
      }
    };
    const seen=pending.seen??[];
    if(seen.includes(input.message))return new Response(null,{status:204});
    if(input.error){notify({error:input.error});return new Response(null,{status:204});}
    room.queue??=[];
    if(room.queue.length>=MAX_QUEUE){
      notify({error:'Coda piena. Attendi che si liberi un posto.'});
      return new Response(null,{status:204});
    }
    room.queue.push({...input.item,id:crypto.randomUUID()});
    const starts=!room.channel&&!this.screenHost(room.id)&&this.connections().some(client=>client.info.room===room.id);
    if(starts)this.nextSubmission(room);
    room.updated=Date.now();
    await this.scheduleMetadata(this.queueDeadline(room));
    await this.ctx.storage.put({[ROOMS]:data.rooms,[key]:{...pending,seen:[input.message,...seen].slice(0,64),expires:Date.now()+INBOX_TTL}});
    this.publish(data);
    notify({queued:true});
    return new Response(null,{status:204});
  }
  async cancelForward(info){
    if(!info.room)return;
    const key='forward:'+info.user.player,pending=await this.ctx.storage.get(key);
    if(pending?.room===info.room)await this.ctx.storage.delete(key);
  }
  message(socket,raw){
    return this.ctx.blockConcurrencyWhile(async()=>{
      try{
        if(typeof raw!=='string'||raw.length>24576)return;
        const input=JSON.parse(raw),info=socket.deserializeAttachment();
        if(raw.length>4096&&input?.type!=='screen-signal')return;
        if(typeof input?.type==='string'&&input.type.startsWith('screen-')){
          try{await this.screenMessage(socket,info,input);}
          catch(error){send(socket,{type:'screen-error',share:input.share,message:error.message});}
          return;
        }
        const data=await this.data();
        const room=data.rooms.find(entry=>entry.id===info.room);
        if(input.type==='appearance'){
          socket.serializeAttachment({...info,appearance:normalizeAppearance(input.appearance)});
          if(room)this.publish(data);
          return;
        }
        if(input.type==='enter'){
          const next=data.rooms.find(entry=>entry.id===input.room);
          if(next?.id!==info.room){this.dropScreenViewer(info);await this.cancelForward(info);}
          if(!next){socket.serializeAttachment({...info,room:null,screen:null,mosaic:false});this.publish(data);throw Error('Questa sala è stata chiusa.');}
          socket.serializeAttachment({...info,room:next.id,screen:next.id===info.room?info.screen:null,mosaic:next.id===info.room&&info.mosaic});
          await this.syncQueueAudience(data,info.room,next.id);this.publish(data);return;
        }
        if(input.type==='leave'){
          this.dropScreenViewer(info);
          await this.cancelForward(info);
          socket.serializeAttachment({...info,room:null,screen:null,mosaic:false});
          await this.syncQueueAudience(data,info.room);this.publish(data);return;
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
        if(input.type==='mosaic'){
          const mosaic=input.open===true;
          if(!mosaic&&info.mosaic)this.dropScreenViewer(info,null,true);
          socket.serializeAttachment({...info,mosaic});
          this.publish(data);return;
        }
        if(input.type==='close-room'){
          if(room.owner&&room.owner!==info.user.player)throw Error('Solo chi ha aperto la sala può chiuderla.');
          const rooms=data.rooms.filter(entry=>entry!==room);
          await this.ctx.storage.put(ROOMS,rooms);
          for(const client of this.connections())if(client.info.room===room.id){
            this.dropScreenViewer(client.info);
            client.socket.serializeAttachment({...client.info,room:null,screen:null,mosaic:false});
            try{client.socket.send(JSON.stringify({type:'room-closed',id:room.id}));}catch{}
          }
          this.publish({...data,rooms});return;
        }
        if(input.type==='channel'){
          const channel=cleanChannel(input.channel);
          if(!channel)throw Error('Canale non valido.');
          if(room.channel?.url===channel.url&&!channel.catalogUntil&&!!room.channel.live===!!channel.live)return;
          room.current=null;delete room.inboxHold;room.channel=channel;room.updated=Date.now();
          room.playback=channel.youtube?{position:0,playing:true,updated:room.updated,seek:0}:null;
          await this.ctx.storage.put(ROOMS,data.rooms);await this.scheduleMetadata(channel.catalogUntil);this.publish(data);return;
        }
        if(input.type==='queue-next'){
          if(room.owner&&room.owner!==info.user.player)throw Error('Solo chi ha aperto la sala può cambiare il contenuto della coda.');
          if(!room.current&&!room.queue?.length)return;
          this.nextSubmission(room);
          await this.scheduleMetadata(this.queueDeadline(room));
          await this.ctx.storage.put(ROOMS,data.rooms);this.publish(data);return;
        }
        if(input.type==='playback'){
          if(!(room.channel?.youtube||room.channel?.file||room.channel?.inbox)||input.url!==room.channel.url||!room.playback)return;
          const now=Date.now(),playback=room.playback;
          let position=room.current?.loading?0:positionAt(playback,now),playing=playback.playing,seek=playback.seek??0;
          if(input.command==='play')playing=true;
          else if(input.command==='pause')playing=false;
          else if(input.command==='seek'&&!room.channel.live&&Number.isFinite(input.position)&&input.position>=0&&input.position<=86400){position=input.position;seek++;}
          else throw Error('Comando video non valido.');
          const playRevision=(playback.playRevision??0)+(input.command==='play'?1:0);
          room.updated=now;room.playback={position,playing,updated:now,seek,playRevision};
          await this.scheduleMetadata(this.queueDeadline(room));
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
      this.dropScreenViewer(info);
      socket.serializeAttachment({...info,closed:true,screen:null});
      const data=await this.data();
      await this.syncQueueAudience(data,info.room);this.publish(data);
      try{socket.close(1000,'Sala lasciata');}catch{}
    });
  }
}
