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
let videoRevision=0,noticeTimer,clockOffset=0,youtube=null,disposeYouTube=null,youtubeBlocked=false,fileBlocked=false,fileStarting=false;
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
  disposeYouTube?.();disposeYouTube=null;youtube=null;youtubeBlocked=false;fileBlocked=false;fileStarting=false;
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
  const duration=youtube?.getDuration()||video.duration;
  return Number.isFinite(duration)&&duration>0?Math.min(position,duration):position;
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

function syncFile(force=false){
  if(!room?.channel?.file||!room.playback||!settings.monitor||video.readyState<1)return;
  const position=targetPosition(),playing=room.playback.playing;
  if(force||Math.abs(video.currentTime-position)>2)video.currentTime=position;
  if(!playing){video.pause();$('screen-empty').hidden=true;return;}
  if(!video.paused||fileStarting||fileBlocked||(Number.isFinite(video.duration)&&position>=video.duration))return;
  const revision=videoRevision;
  fileStarting=true;
  video.play().then(()=>{
    if(revision===videoRevision&&!room?.playback?.playing)video.pause();
  }).catch(()=>{
    if(revision===videoRevision&&room?.playback?.playing){
      fileBlocked=true;message('Tocca per avviare il video',true);
    }
  }).finally(()=>{if(revision===videoRevision)fileStarting=false;});
}
video.addEventListener('loadedmetadata',()=>syncFile(true));

function tune(channel,force=false,seek=false){
  const url=channel?.url??null;
  if(!force&&url===playingURL){syncYouTube(seek);syncFile(seek);return;}
  playingURL=url;stopVideo();
  $('channel-name').textContent=channel?.name??'';
  $('on-air').textContent=url?((channel.youtube||channel.file)?'VIDEO':'LIVE'):'';
  if(!settings.monitor){message('Monitor spento');return;}
  if(!url){message('In attesa di un canale');return;}
  message('Collegamento al video…');
  if(channel.youtube){showYouTube(channel.youtube);return;}
  video.volume=settings.volume/100;video.muted=settings.volume===0;
  if(channel.file){video.preload='auto';video.src=url;return;}
  video.preload='none';
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
  else if(room?.channel?.file){if(video.error)tune(room.channel,true);else{fileBlocked=false;syncFile(true);}}
  else if(video.src||hls)startPlayback();
  else tune(room?.channel,true);
};

const multisala=$('multisala-dialog');
let listedRooms=[];
function drawMultisala(){
  const list=$('multisala-rooms'),focused=document.activeElement?.dataset.room;
  list.replaceChildren(...listedRooms.map(entry=>{
    const current=entry.id===room?.id,button=node('button','','room-card');
    button.dataset.room=entry.id;
    button.append(node('strong','Sala '+entry.number+(current?' · Sei qui':'')),
      node('span',entry.channel??'In attesa di un canale'),
      node('small',entry.viewers.length?entry.viewers.map(person=>person.name).join(', '):'Nessuno in sala'));
    button.disabled=!connected||current;
    if(current)button.setAttribute('aria-current','true');
    button.onclick=()=>{action('enter',{room:entry.id});multisala.close();};
    return button;
  }));
  if(!listedRooms.length)list.append(node('p','Nessuna sala aperta.'));
  if(focused)Array.from(list.children).find(el=>el.dataset.room===focused)?.focus();
}
$('multisala').onclick=()=>{drawMultisala();multisala.showModal();};
const closeDialog=$('close-dialog');
$('close-room').onclick=()=>{closeDialog.returnValue='';closeDialog.showModal();};
closeDialog.onclose=()=>{if(closeDialog.returnValue==='close')action('close-room');};
function drawRooms(rooms,active){
  const previous=room;
  room=active;listedRooms=rooms;
  if(multisala.open)drawMultisala();
  $('multisala').disabled=!active;
  $('connecting').hidden=!!active;cinema.hidden=!active;$('cinema-actions').hidden=!active;
  $('close-room').hidden=!active?.canClose;
  $('shared-playback').hidden=!active?.playback;
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
  tune(active.channel,previous?.id!==active.id,previous?.playback?.seek!==active.playback?.seek);
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
      const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4}[event.key];
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
  button.hidden=!url||room?.channel?.file===true;button.disabled=saved;button.textContent=saved?'★ Nei preferiti':'☆ Salva nei preferiti';
}
$('save-playing').onclick=()=>{if(room?.channel)action('favorite-add',{channel:packetChannel(room.channel)});};
function drawFavorites(){
  updateFavoriteButton();
  const list=$('favorites');
  if(drag)return;
  list.replaceChildren(...favorites.map(channel=>channelCard(channel,true)));
  if(!favorites.length)list.append(node('p','Aggiungi un canale dalla ricerca.'));
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
$('exit').onclick=()=>send('exit');
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
  $('tools').textContent=wide?'Mostra canali':'Canali';
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

const ranges={seats:[16,62],sidebar:[20,82],favorites:[20,72]};
function resizePanel(key,value){
  const [min,max]=ranges[key];
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
      const rect=(key==='favorites'?sidebar:cinema).getBoundingClientRect();
      const value=key==='sidebar'?(rect.right-move.clientX)/rect.width:key==='favorites'?(move.clientY-rect.top)/rect.height:(rect.bottom-move.clientY)/rect.height;
      resizePanel(key,value*100);
    };
    button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>{button.onpointermove=null;save();};
  };
  button.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const current=settings.sizes[key]??({seats:25,sidebar:mobile.matches?72:29,favorites:43})[key];
    resizePanel(key,current+(['ArrowLeft','ArrowUp'].includes(event.key)?3:-3));save();
  };
}

window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  const data=event.data;
  if(data?.type==='cinema:insets')applyInsets(document.documentElement,data.insets);
  if(data?.type==='cinema:connection'){
    connected=data.connected;if(multisala.open)drawMultisala();
    if(!connected)notice(data.message||'Riconnessione al cinema…');
    else $('notice').textContent='';
  }
  if(data?.type==='cinema:upload-result'){
    setUploading(false);
    if(data.error)$('watch-error').textContent=data.error;
    else watchDialog.close();
    return;
  }
  if(data?.type!=='cinema:packet')return;
  const packet=data.packet;
  if(packet.type==='rooms'){me=packet.me;clockOffset=Number.isFinite(packet.now)?packet.now-Date.now():0;drawRooms(packet.rooms,packet.active);}
  else if(packet.type==='favorites'){favorites=packet.items;drawFavorites();if(catalogStarted)drawSearch();}
  else if(packet.type==='error')notice(packet.message);
});
const watchDialog=$('watch-dialog');
let uploading=false;
function updateWatchType(){
  const file=$('watch-type').value==='file';
  $('watch-link-label').hidden=file;$('watch-url').disabled=file;
  $('watch-file-label').hidden=!file;$('watch-file').disabled=!file;$('watch-file').required=file;
}
function setUploading(value){
  uploading=value;
  for(const id of ['watch-type','watch-name','watch-submit','watch-cancel'])$(id).disabled=value;
  if(value)$('watch-file').disabled=true;
  else updateWatchType();
  $('watch-progress').hidden=!value;
}
$('watch-type').onchange=updateWatchType;
watchDialog.oncancel=event=>{if(uploading)event.preventDefault();};
function openWatch(type){
  $('watch-form').reset();$('watch-error').textContent='';
  $('watch-type').value=type;
  updateWatchType();watchDialog.showModal();
  const input=$(type==='file'?'watch-file':'watch-url');
  input.focus();
  if(type==='file')input.click();
}
$('watch-together').onclick=()=>openWatch('stream');
$('upload-video').onclick=()=>openWatch('file');
$('watch-cancel').onclick=()=>watchDialog.close();
$('watch-form').onsubmit=event=>{
  event.preventDefault();
  if(uploading)return;
  const error=$('watch-error');
  error.textContent='';
  if(!connected){error.textContent='Riconnessione in corso.';return;}
  const url=$('watch-url').value.trim(),id=youtubeId(url),type=$('watch-type').value;
  if(type==='file'){
    const file=$('watch-file').files[0];
    if(!file||!file.size||file.size>16*1024*1024){error.textContent='Scegli un video fino a 16 MB.';return;}
    setUploading(true);send('upload',{file,name:$('watch-name').value.trim()});return;
  }
  if(!/^https:\/\//i.test(url)||(type==='youtube'&&!id)){
    $('watch-error').textContent=type==='youtube'?'Inserisci un link a un video YouTube.':'Inserisci un link HTTPS allo stream.';
    return;
  }
  const name=$('watch-name').value.trim()||(id?'YouTube · '+id:'Stream condiviso');
  action('channel',{channel:{name,url}});
  watchDialog.close();
};
function playback(command,position){
  if(room?.playback)action('playback',{url:room.channel.url,command,position});
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
setInterval(()=>{syncYouTube();syncFile();},5000);
send('ready');
