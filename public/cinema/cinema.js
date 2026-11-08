import {loadCatalog,searchChannels} from './catalog.js?v=1';
import {avatarSVG} from '../labyrinth/avatar.js?v=9';
import {youtubeId,positionAt} from './media.js?v=2';
import {embedYouTube} from './youtube.js?v=2';
import {applyInsets} from '../safe-area.js';

const $=id=>document.getElementById(id);
const cinema=$('cinema'),video=$('video'),screen=$('screen'),sidebar=$('sidebar');
const mobile=matchMedia('(max-width:640px)');
const defaults={monitor:true,volume:65,sizes:{}};
let settings=defaults;
try{
  const saved=JSON.parse(localStorage.getItem('binotto-cinema-ui-v1'));
  settings={monitor:saved?.monitor!==false,volume:Number.isFinite(saved?.volume)?Math.max(0,Math.min(100,saved.volume)):65,sizes:{...saved?.sizes}};
}catch{}
let connected=false,room=null,me=null,favorites=[],catalog=[],catalogStarted=false,playingURL=null,hls=null,drag=null;
let videoRevision=0,noticeTimer,clockOffset=0,youtube=null,disposeYouTube=null,youtubeBlocked=false;
const send=(type,payload={})=>parent.postMessage({type:'cinema:'+type,...payload},location.origin);
const action=(type,data={})=>connected?send('action',{action:{type,...data}}):notice('Collegamento alla sala in corso.');
const node=(tag,text='',className='')=>{
  const el=document.createElement(tag);
  if(text)el.textContent=text;
  if(className)el.className=className;
  return el;
};
function save(){
  try{localStorage.setItem('binotto-cinema-ui-v1',JSON.stringify(settings));}catch{}
}
function notice(text){
  $('notice').textContent=text;
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>$('notice').textContent='',4500);
}
function stopVideo(){
  videoRevision++;
  hls?.destroy();hls=null;
  disposeYouTube?.();disposeYouTube=null;youtube=null;youtubeBlocked=false;
  video.hidden=false;$('youtube').hidden=true;
  video.pause();video.removeAttribute('src');video.load();
}
function message(text,retry=false){
  $('screen-empty').hidden=false;
  $('screen-message').textContent=text;
  $('start-video').hidden=!retry;
}
async function startPlayback(){
  const revision=videoRevision;
  try{await video.play();if(revision===videoRevision)$('screen-empty').hidden=true;}
  catch{if(revision===videoRevision)message('Tocca per avviare il video',true);}
}
function targetPosition(){
  const position=positionAt(room?.playback,Date.now()+clockOffset);
  const duration=youtube?.getDuration()||0;
  return duration?Math.min(position,duration):position;
}
function syncYouTube(force=false){
  if(!youtube||!room?.playback)return;
  const position=targetPosition(),state=youtube.getPlayerState();
  const duration=youtube.getDuration();
  if(state===0&&duration>0&&position>=duration-.5)return;
  if(force||Math.abs(youtube.getCurrentTime()-position)>2)youtube.seekTo(position,true);
  if(room.playback.playing){
    if(!youtubeBlocked&&state!==1&&state!==3)youtube.playVideo();
  }else{
    if(state===1||state===3)youtube.pauseVideo();
    $('screen-empty').hidden=true;
  }
}
function showYouTube(id){
  video.hidden=true;$('youtube').hidden=false;
  disposeYouTube=embedYouTube($('youtube'),id,{
    ready:player=>{
      youtube=player;youtube.setVolume(settings.volume);
      if(settings.volume===0)youtube.mute();
      syncYouTube(true);
    },
    state:state=>{
      if(state===1&&youtube&&!room?.playback?.playing)youtube.pauseVideo();
      if(state===1||state===2||state===0)$('screen-empty').hidden=true;
    },
    blocked:()=>{youtubeBlocked=true;message('Tocca per avviare YouTube',true);},
    error:code=>{
      message(code===101||code===150?'Questo video non consente la riproduzione incorporata.':'YouTube non disponibile per questo video.',false);
    }
  });
}

function tune(channel,force=false,seek=false){
  const url=channel?.url??null;
  if(!force&&url===playingURL){syncYouTube(seek);return;}
  playingURL=url;stopVideo();
  $('channel-name').textContent=channel?.name??'';
  $('on-air').textContent=url?(channel.youtube?'VIDEO':'LIVE'):'';
  if(!settings.monitor){message('Monitor spento');return;}
  if(!url){message('In attesa di un canale');return;}
  message('Collegamento al video…');
  if(channel.youtube){showYouTube(channel.youtube);return;}
  video.volume=settings.volume/100;video.muted=settings.volume===0;
  const hlsURL=/\.m3u8?(?:[?#]|$)/i.test(url);
  if(hlsURL&&!video.canPlayType('application/vnd.apple.mpegurl')&&window.Hls?.isSupported()){
    hls=new window.Hls({liveSyncDurationCount:3,backBufferLength:20});
    hls.on(window.Hls.Events.MANIFEST_PARSED,startPlayback);
    hls.on(window.Hls.Events.ERROR,(_event,data)=>{
      if(data.fatal){stopVideo();message('Canale non riproducibile su questo dispositivo',true);}
    });
    hls.loadSource(url);hls.attachMedia(video);
  }else{video.src=url;startPlayback();}
}
video.addEventListener('error',()=>{
  if(playingURL&&settings.monitor)message('Canale non riproducibile su questo dispositivo',true);
});
video.addEventListener('playing',()=>{$('screen-empty').hidden=true;});
$('start-video').onclick=()=>{
  if(youtube){youtubeBlocked=false;syncYouTube(true);}
  else if(video.src||hls)startPlayback();
  else tune(room?.channel,true);
};

function drawRooms(rooms,active){
  $('create').disabled=!connected;
  const list=$('rooms');
  list.replaceChildren(...rooms.map(entry=>{
    const button=node('button','','room-card');
    button.append(node('strong','Sala '+entry.number),node('span',entry.channel??'In attesa di un canale'),
      node('small',entry.viewers.length?'Presenti · '+entry.viewers.map(p=>p.name).join(', '):'Nessuno in sala'));
    button.onclick=()=>action('enter',{room:entry.id});button.disabled=!connected;
    return button;
  }));
  if(!rooms.length)list.append(node('p',connected?'Nessuna sala aperta.':'Collegamento al cinema…'));
  const previous=room;
  room=active;
  $('lobby').hidden=!!active;cinema.hidden=!active;$('back-rooms').hidden=!active;$('tools').hidden=!active;
  $('shared-playback').hidden=!active?.channel?.youtube;
  updateFavoriteButton();
  if(!active){if(previous)tune(null);return;}
  const current=rooms.find(entry=>entry.id===active.id);
  $('room-name').textContent='Sala '+(current?.number??'');
  const people=current?.viewers??[];
  $('audience-count').textContent=people.length+' '+(people.length===1?'spettatore':'spettatori');
  $('sofas').replaceChildren(...people.map(({id,name,appearance},i)=>{
    const sofa=node('div','','sofa');
    sofa.style.setProperty('--seat-color',['#926283','#58728f','#777347','#9a5f55'][i%4]);
    sofa.title=name;
    const figure=node('span');figure.innerHTML=avatarSVG(appearance);
    sofa.append(figure,node('small',id===me?'Tu · '+name:name));
    return sofa;
  }));
  if(!catalogStarted){
    catalogStarted=true;
    loadCatalog((rows,sourceCount,done)=>{
      catalog=rows;
      $('catalog-status').textContent=done
        ? (sourceCount?rows.length.toLocaleString('it-IT')+' stream · '+sourceCount+' fonti':'Cataloghi offline · elenco di base')
        : 'Aggiornamento cataloghi…';
      drawSearch();
    });
  }
  tune(active.channel,false,previous?.playback?.seek!==active.playback?.seek);
}
function channelCard(channel,favorite=false){
  const item=node('div','','channel-card'),pick=node('button','','channel-pick'),logo=node('span','','logo');
  const fallback=node('span',channel.name.slice(0,2).toUpperCase());
  logo.append(fallback);
  if(channel.logo){
    const image=node('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';
    image.onload=()=>{fallback.hidden=true;};image.onerror=()=>image.remove();
    image.src=channel.logo;logo.append(image);
  }
  pick.title=channel.name;pick.append(logo,node('span',channel.name));
  pick.onclick=()=>action('channel',{channel:packetChannel(channel)});
  const isFavorite=favorite||favorites.some(entry=>entry.url===channel.url);
  const star=node('button',favorite?'×':isFavorite?'★':'☆');
  star.setAttribute('aria-label',(favorite?'Rimuovi ':isFavorite?'Già nei preferiti: ':'Aggiungi ai preferiti: ')+channel.name);
  star.onclick=()=>favorite?action('favorite-remove',{id:channel.id}):action('favorite-add',{channel:packetChannel(channel)});
  star.disabled=!favorite&&isFavorite;
  item.append(pick,star);
  if(favorite){
    item.dataset.favorite=channel.id;
    const handle=node('button','↕','drag');
    handle.textContent='⠿';
    handle.setAttribute('aria-label','Sposta '+channel.name+' · trascina o usa le frecce');
    handle.onpointerdown=event=>beginFavoriteDrag(event,handle,item,channel.id);
    handle.onkeydown=event=>{
      const i=favorites.findIndex(entry=>entry.id===channel.id);
      const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];
      if(i<0||!offset)return;
      event.preventDefault();
      const next=Math.max(0,Math.min(favorites.length-1,i+offset));
      if(next!==i)action('favorite-move',{id:channel.id,before:favorites[next+(next>i?1:0)]?.id??null});
    };
    item.append(handle);
  }
  return item;
}
const packetChannel=({name,url,logo})=>({name,url,logo});
function drawSearch(){
  const list=$('results'),rows=searchChannels(catalog,$('query').value);
  list.replaceChildren(...rows.map(channel=>channelCard(channel)));
  if(!rows.length)list.append(node('p','Nessun canale trovato.'));
}
function updateFavoriteButton(){
  const button=$('save-playing'),url=room?.channel?.url;
  const saved=favorites.some(item=>item.url===url);
  button.hidden=!url;button.disabled=saved;button.textContent=saved?'★ Nei preferiti':'☆ Salva nei preferiti';
}
$('save-playing').onclick=()=>{if(room?.channel)action('favorite-add',{channel:packetChannel(room.channel)});};
function drawFavorites(){
  updateFavoriteButton();
  const list=$('favorites');
  if(drag)return;
  list.replaceChildren(...favorites.map(channel=>channelCard(channel,true)));
  if(!favorites.length)list.append(node('p','Aggiungi un canale dalla ricerca.'));
  $('prev').disabled=$('next').disabled=!favorites.length;
}
function beginFavoriteDrag(event,handle,item,id){
  if(event.button!==0||drag)return;
  const list=$('favorites');
  event.preventDefault();handle.setPointerCapture(event.pointerId);
  item.classList.add('dragging');drag={id,target:null,before:undefined};
  handle.onpointermove=move=>{
    if(move.pointerId!==event.pointerId)return;
    const bounds=list.getBoundingClientRect();
    if(move.clientY<bounds.top+22)list.scrollTop-=12;
    else if(move.clientY>bounds.bottom-22)list.scrollTop+=12;
    const target=document.elementFromPoint(move.clientX,move.clientY)?.closest('[data-favorite]');
    drag.target?.classList.remove('drop-target');
    drag.target=target&&target!==item?target:null;drag.before=undefined;
    if(!drag.target)return;
    const index=favorites.findIndex(entry=>entry.id===target.dataset.favorite);
    const rect=target.getBoundingClientRect();
    drag.before=move.clientX<rect.left+rect.width/2?target.dataset.favorite:favorites[index+1]?.id??null;
    target.classList.add('drop-target');
  };
  const finish=(end,commit)=>{
    if(end.pointerId!==event.pointerId||!drag)return;
    const {before}=drag;drag=null;drawFavorites();
    if(commit&&before!==undefined&&before!==id)action('favorite-move',{id,before});
  };
  handle.onpointerup=end=>finish(end,true);
  handle.onpointercancel=handle.onlostpointercapture=end=>finish(end,false);
}
function stepChannel(step){
  const index=favorites.findIndex(item=>item.url===room?.channel?.url);
  const next=index<0?(step>0?0:favorites.length-1):(index+step+favorites.length)%favorites.length;
  if(favorites[next])action('channel',{channel:packetChannel(favorites[next])});
}
$('prev').onclick=()=>stepChannel(-1);$('next').onclick=()=>stepChannel(1);
$('create').onclick=()=>{if(connected){$('create').disabled=true;action('create');}};$('back-rooms').onclick=()=>action('leave');$('exit').onclick=()=>send('exit');
let queryTimer;
$('query').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(drawSearch,100);};
function updateMonitor(){
  $('monitor').textContent=settings.monitor?'Monitor acceso':'Monitor spento';
  $('monitor').setAttribute('aria-pressed',String(settings.monitor));
}
$('monitor').onclick=()=>{settings.monitor=!settings.monitor;save();updateMonitor();tune(room?.channel,true);};
$('volume').value=settings.volume;
$('volume').oninput=()=>{settings.volume=Number($('volume').value);video.volume=settings.volume/100;video.muted=settings.volume===0;if(youtube){youtube.setVolume(settings.volume);if(settings.volume===0)youtube.mute();else youtube.unMute();}save();};
updateMonitor();
function updateTools(){
  const wide=cinema.classList.contains('wide');
  $('mode').setAttribute('aria-pressed',String(wide));
  $('tools').setAttribute('aria-expanded',String(!wide&&(!mobile.matches||cinema.classList.contains('tools-open'))));
  $('tools').textContent=wide?'Mostra comandi':'Comandi';
}
$('mode').onclick=()=>{cinema.classList.toggle('wide');updateTools();};
$('tools').onclick=()=>{
  if(cinema.classList.contains('wide')){cinema.classList.remove('wide');cinema.classList.add('tools-open');}
  else if(mobile.matches)cinema.classList.toggle('tools-open');
  else cinema.classList.add('wide');
  updateTools();
};
mobile.addEventListener('change',updateTools);updateTools();
$('screen-full').onclick=async()=>{
  if(document.fullscreenElement){await document.exitFullscreen();return;}
  if(document.body.classList.contains('video-full')){document.body.classList.remove('video-full');return;}
  try{if(screen.requestFullscreen){await screen.requestFullscreen();return;}}catch{}
  if(video.webkitEnterFullscreen&&video.readyState>0){try{video.webkitEnterFullscreen();return;}catch{}}
  document.body.classList.add('video-full');
};
window.addEventListener('keydown',event=>{if(event.key==='Escape')document.body.classList.remove('video-full');});

const ranges={seats:[16,62],sidebar:[20,82],search:[20,61],remote:[20,56]};
function resizePanel(key,value){
  let [min,max]=ranges[key];
  if(key==='search')max=Math.min(max,80-(settings.sizes.remote??29));
  if(key==='remote')max=Math.min(max,80-(settings.sizes.search??36));
  const next=Math.max(min,Math.min(max,value));
  settings.sizes[key]=next;cinema.style.setProperty('--'+key,next+'%');
}
for(const button of document.querySelectorAll('[data-size]')){
  const key=button.dataset.size;
  if(Number.isFinite(settings.sizes[key]))resizePanel(key,settings.sizes[key]);
  button.onpointerdown=event=>{
    if(event.button!==0)return;
    event.preventDefault();button.setPointerCapture(event.pointerId);
    button.onpointermove=move=>{
      if(move.pointerId!==event.pointerId)return;
      const rect=(key==='search'||key==='remote'?sidebar:cinema).getBoundingClientRect();
      const value=key==='sidebar'?(rect.right-move.clientX)/rect.width:key==='search'?(move.clientY-rect.top)/rect.height:(rect.bottom-move.clientY)/rect.height;
      resizePanel(key,value*100);
    };
    button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>{button.onpointermove=null;save();};
  };
  button.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const current=settings.sizes[key]??({seats:25,sidebar:mobile.matches?72:29,search:36,remote:29})[key];
    resizePanel(key,current+(['ArrowLeft','ArrowUp'].includes(event.key)?3:-3));save();
  };
}

window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const data=event.data;
  if(data?.type==='cinema:insets')applyInsets(document.documentElement,data.insets);
  if(data?.type==='cinema:connection'){
    connected=data.connected;$('create').disabled=!connected;
    if(!connected)notice(data.message||'Riconnessione al cinema…');
    else $('notice').textContent='';
  }
  if(data?.type!=='cinema:packet')return;
  const packet=data.packet;
  if(packet.type==='rooms'){me=packet.me;clockOffset=Number.isFinite(packet.now)?packet.now-Date.now():0;drawRooms(packet.rooms,packet.active);}
  else if(packet.type==='favorites'){favorites=packet.items;drawFavorites();if(catalogStarted)drawSearch();}
  else if(packet.type==='error'){$('create').disabled=!connected;notice(packet.message);}
});
const watchDialog=$('watch-dialog');
$('watch-together').onclick=()=>{
  $('watch-form').reset();$('watch-error').textContent='';
  watchDialog.showModal();$('watch-url').focus();
};
$('watch-cancel').onclick=()=>watchDialog.close();
$('watch-form').onsubmit=event=>{
  event.preventDefault();
  const url=$('watch-url').value.trim(),id=youtubeId(url),type=$('watch-type').value;
  if(!/^https:\/\//i.test(url)||(type==='youtube'&&!id)){
    $('watch-error').textContent=type==='youtube'?'Inserisci un link a un video YouTube.':'Inserisci un link HTTPS allo stream.';
    return;
  }
  if(!connected){$('watch-error').textContent='Riconnessione in corso.';return;}
  const name=$('watch-name').value.trim()||(id?'YouTube · '+id:'Stream condiviso');
  action('channel',{channel:{name,url}});
  watchDialog.close();
};
function playback(command,position){
  if(room?.channel?.youtube)action('playback',{url:room.channel.url,command,position});
}
$('play-shared').onclick=()=>playback('play');
$('pause-shared').onclick=()=>playback('pause');
$('seek-shared').onsubmit=event=>{
  event.preventDefault();
  const value=$('seek-time').value.trim();
  if(!/^\d{1,5}(?::[0-5]\d)?$/.test(value)){notice('Inserisci i secondi o un tempo come 12:30.');return;}
  const parts=value.split(':').map(Number),position=parts.length===2?parts[0]*60+parts[1]:parts[0];
  if(position>86400){notice('Il tempo inserito è troppo lungo.');return;}
  playback('seek',position);
};
setInterval(()=>{
  if(!room?.playback)return;
  const seconds=Math.floor(targetPosition());
  $('shared-time').textContent=(room.playback.playing?'In riproduzione':'In pausa')+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
},1000);
setInterval(()=>syncYouTube(),5000);
send('ready');
