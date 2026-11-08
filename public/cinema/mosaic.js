import {positionAt} from './media.js?v=4';
import {WindowShare} from './screen-share.js?v=2';
import {embedYouTube} from './youtube.js?v=3';

export class CinemaMosaic {
  constructor(list,enter,signal,localStream){
    this.list=list;this.enter=enter;this.signal=signal;this.localStream=localStream;
    this.tiles=new Map();this.clock=0;this.autoUsed=false;this.listening=null;
    if(typeof IntersectionObserver==='function'){
      this.observer=new IntersectionObserver(entries=>{
        for(const {target,isIntersecting,intersectionRatio} of entries){
          const tile=this.tiles.get(target.dataset.room);
          if(tile)tile.visible=isIntersecting&&intersectionRatio>.5;
        }
        this.sync();
      },{root:list,threshold:[0,.5,.51,1]});
    }
  }
  update(rooms,previews,now,current){
    if(Number.isFinite(now))this.clock=now-Date.now();
    const live=new Map((previews??[]).map(preview=>[preview.id,preview]));
    for(const [id,tile] of this.tiles){
      if(rooms.some(room=>room.id===id))continue;
      this.dispose(tile);this.observer?.unobserve(tile.el);tile.el.remove();this.tiles.delete(id);
    }
    for(const room of rooms){
      let tile=this.tiles.get(room.id);
      if(!tile){
        const el=document.createElement('article');
        el.className='mosaic-tile';el.dataset.room=room.id;
        el.innerHTML='<div class="mosaic-media"><video playsinline muted hidden></video><div class="mosaic-youtube" hidden></div><span></span></div><div class="mosaic-caption"><div><strong></strong><small></small></div><button type="button" class="mosaic-audio" aria-label="Attiva audio dell’anteprima" aria-pressed="false" hidden>♬</button><button type="button"></button></div>';
        const [video,youtube,status]=el.querySelector('.mosaic-media').children;
        const [title,meta,audio,button]=el.querySelectorAll('strong,small,button');
        tile={el,video,youtube,status,title,meta,audio,button,visible:!this.observer,key:null};
        audio.onclick=()=>this.toggleAudio(tile);
        button.dataset.room=room.id;button.onclick=()=>this.enter(room.id);
        this.tiles.set(room.id,tile);this.list.append(el);this.observer?.observe(el);
      }
      tile.preview=live.get(room.id);
      tile.title.textContent='Sala '+room.number;
      tile.meta.textContent=(room.channel??'In attesa di un canale')+' · '+room.viewers.length+' spett.';
      tile.button.textContent=room.id===current?'Torna in sala':'Entra';
    }
    this.sync();
  }
  message(tile,text){
    tile.status.textContent=text;
    tile.status.hidden=!text;
    tile.status.classList.toggle('mosaic-youtube-note',!tile.youtube.hidden);
  }
  sync(){
    for(const tile of this.tiles.values()){
      const source=tile.preview;
      const key=tile.visible&&source?(source.screen?'screen:'+source.screen.id:source.channel?.url??null):null;
      if(tile.key!==key){
        this.dispose(tile);tile.key=key;
        if(key)this.load(tile,source);
      }
      if(!key){
        this.message(tile,source?.channel||source?.screen?'Anteprima fuori vista':source?'Nessun video in sala':'In attesa dell’anteprima');
        continue;
      }
      this.syncTile(tile);
    }
  }
  toggleAudio(tile){
    const previous=this.listening;
    if(previous){
      previous.video.muted=true;previous.share?.volume(0);
      previous.audio.setAttribute('aria-pressed','false');
    }
    this.listening=previous===tile?null:tile;
    if(!this.listening)return;
    for(const other of this.tiles.values())other.player?.mute();
    tile.audio.setAttribute('aria-pressed','true');
    if(tile.share){tile.share.volume(100);tile.share.enableAudio();}
    else{
      tile.video.muted=false;
      if(!tile.preview?.channel?.file||tile.preview.playback?.playing)this.play(tile);
    }
  }
  syncTile(tile){
    const {preview,player,video}=tile,playback=preview?.playback;
    const canAuto=tile.el.isConnected&&!document.hidden&&tile.visible;
    if(player&&playback){
      const state=player.getPlayerState();
      if(!this.autoUsed&&canAuto&&playback.playing){
        this.autoUsed=true;
        player.mute();player.playVideo();
      }
      if(!playback.playing&&(state===1||state===3))player.pauseVideo();
      if(!preview.channel.live&&(state===1||state===2)){
        const position=positionAt(playback,Date.now()+this.clock);
        if(Math.abs(player.getCurrentTime()-position)>3)player.seekTo(position,true);
      }
    }
    if(preview?.channel?.file&&playback&&video.readyState>0){
      const time=positionAt(playback,Date.now()+this.clock);
      if(Math.abs(video.currentTime-time)>3)video.currentTime=Math.min(time,video.duration||time);
      if(playback.playing&&video.paused&&!video.ended&&!tile.starting)this.play(tile);
      if(!playback.playing){video.pause();this.message(tile,'');}
    }
  }
  async play(tile){
    const key=tile.key;
    tile.starting=true;
    try{
      await tile.video.play();
      if(tile.key===key)this.message(tile,'');
    }catch{
      if(tile.key===key)this.message(tile,'Anteprima non riproducibile');
    }finally{if(tile.key===key)tile.starting=false;}
  }
  load(tile,{id,channel,screen}){
    const {video,youtube}=tile;
    if(screen){
      video.hidden=false;video.muted=true;
      if(screen.local){
        video.srcObject=this.localStream();
        if(video.srcObject)this.play(tile);
        else this.message(tile,'Condivisione in avvio…');
      }else{
        tile.share=new WindowShare(video,(type,data)=>this.signal(type,{...data,preview:true}),text=>this.message(tile,text),
          ({ready,audio})=>{tile.audio.hidden=!ready||!audio;});
        tile.share.update({id,screen},true,0);
      }
      return;
    }
    if(channel.youtube){
      youtube.hidden=false;
      this.message(tile,'Premi play nel riquadro YouTube');
      tile.stopYouTube=embedYouTube(youtube,channel.youtube,{
        ready:player=>{tile.player=player;player.mute();this.syncTile(tile);},
        state:state=>{if(state===1)this.message(tile,'');this.syncTile(tile);},
        blocked:()=>this.message(tile,'Premi play nel riquadro YouTube'),
        error:()=>this.message(tile,'Video YouTube non disponibile qui')
      });
      return;
    }
    video.hidden=false;video.muted=true;tile.audio.hidden=false;
    this.message(tile,'Apertura anteprima…');
    video.onerror=()=>this.message(tile,'Anteprima non disponibile');
    if(channel.file){
      video.preload='auto';
      video.onloadedmetadata=()=>{
        const playback=tile.preview?.playback;
        if(playback)video.currentTime=Math.min(positionAt(playback,Date.now()+this.clock),video.duration||Infinity);
        this.syncTile(tile);
      };
      video.src=channel.url;
    }else if(/\.m3u8?(?:[?#]|$)/i.test(channel.url)&&!video.canPlayType('application/vnd.apple.mpegurl')&&window.Hls?.isSupported()){
      tile.hls=new window.Hls({liveSyncDurationCount:3,backBufferLength:4,maxBufferLength:8,capLevelToPlayerSize:true});
      tile.hls.on(window.Hls.Events.MANIFEST_PARSED,()=>this.play(tile));
      tile.hls.on(window.Hls.Events.ERROR,(_,data)=>{if(data.fatal)this.message(tile,'Anteprima non disponibile');});
      tile.hls.loadSource(channel.url);tile.hls.attachMedia(video);
    }else{video.src=channel.url;this.play(tile);}
  }
  packet(packet){
    for(const tile of this.tiles.values())if(tile.preview?.screen?.id===packet.share)tile.share?.receive(packet);
  }
  dispose(tile){
    if(!tile.key)return;
    if(this.listening===tile)this.listening=null;
    tile.audio.hidden=true;tile.audio.setAttribute('aria-pressed','false');
    tile.hls?.destroy();tile.hls=null;
    tile.stopYouTube?.();tile.stopYouTube=null;tile.player=null;
    if(tile.share){tile.share.disconnect(true);tile.share=null;}
    tile.video.onloadedmetadata=null;tile.video.onerror=null;tile.video.pause();
    tile.video.srcObject=null;tile.video.removeAttribute('src');tile.video.load();
    tile.video.hidden=true;tile.youtube.hidden=true;tile.starting=false;tile.key=null;
  }
  clear(){
    for(const tile of this.tiles.values()){this.observer?.unobserve(tile.el);this.dispose(tile);}
    this.tiles.clear();this.list.replaceChildren();this.autoUsed=false;
  }
}
