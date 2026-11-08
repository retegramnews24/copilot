import {categories,countryName,loadCatalog,searchChannels} from './catalog.js?v=2';
import {avatarSVG} from '../labyrinth/avatar.js?v=9';
import {youtubeId,youtubeChannelId,positionAt} from './media.js?v=5';
import {embedYouTube} from './youtube.js?v=3';
import {applyInsets} from '../safe-area.js';
import {WindowShare} from './screen-share.js?v=2';
import {CinemaMosaic} from './mosaic.js?v=3';

const $=id=>document.getElementById(id);
const cinema=$('cinema'),video=$('video'),screen=$('screen'),sidebar=$('sidebar');
const mobile=matchMedia('(max-width:640px)');
const defaults={monitor:true,volume:65,sizes:{}};
let settings=defaults;
try{
  const saved=JSON.parse(localStorage.getItem('binotto-cinema-ui-v1'));
  settings={monitor:true,volume:Number.isFinite(saved?.volume)?Math.max(0,Math.min(100,saved.volume)):65,sizes:{...saved?.sizes}};
}catch{}
let connected=false,room=null,me=null,favorites=[],catalog=[],catalogController=null,playingURL=null,hls=null,drag=null;
let videoRevision=0,noticeTimer,clockOffset=0,youtube=null,disposeYouTube=null,youtubeBlocked=false,fileBlocked=false,fileStarting=false;
let youtubeLocalPaused=false,youtubeAutoPause=false;
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
  disposeYouTube?.();disposeYouTube=null;youtube=null;youtubeBlocked=false;youtubeAutoPause=false;fileBlocked=false;fileStarting=false;
  video.hidden=false;$('youtube').hidden=true;$('youtube-message').hidden=true;
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
function youtubeVisible(){
  if(document.hidden||(mobile.matches&&cinema.classList.contains('tools-open')&&!cinema.classList.contains('wide')))return false;
  const bounds=screen.getBoundingClientRect(),auditorium=screen.parentElement.getBoundingClientRect();
  const visible=Math.min(bounds.bottom,auditorium.bottom)-Math.max(bounds.top,auditorium.top);
  return !bounds.height||visible>=bounds.height/2;
}
function pauseYouTube(state){
  if(state===1||state===3){youtubeAutoPause=true;youtube.pauseVideo();}
}
function syncYouTube(force=false){
  if(multisala.open||!youtube||!room?.playback)return;
  const state=youtube.getPlayerState();
  if(!youtubeVisible()){pauseYouTube(state);return;}
  if(youtubeLocalPaused&&room.playback.playing)return;
  const position=targetPosition(),duration=youtube.getDuration();
  if(state===0&&duration>0&&position>=duration-.5)return;
  if(!room.playback.playing)pauseYouTube(state);
  if(!room.channel.live&&(force||Math.abs(youtube.getCurrentTime()-position)>2))youtube.seekTo(position,true);
  if(room.playback.playing&&!youtubeBlocked&&state!==1&&state!==3)youtube.playVideo();
}
function youtubeMessage(text,retry=false){
  $('youtube-message').hidden=!text;
  $('youtube-status').textContent=text;
  $('youtube-start').hidden=!retry;
}
$('youtube-start').onclick=()=>{youtubeLocalPaused=false;youtubeBlocked=false;syncYouTube(true);};
function showYouTube(id){
  youtubeMessage('Collegamento a YouTube…');
  video.hidden=true;$('youtube').hidden=false;
  disposeYouTube=embedYouTube($('youtube'),id,{
    ready:player=>{
      youtube=player;youtube.setVolume(settings.volume);
      if(settings.volume===0)youtube.mute();
      if(youtubeLocalPaused&&room?.playback?.playing)youtubeMessage('In pausa qui',true);
      else if(!room?.playback?.playing)youtubeMessage('');
      syncYouTube(true);
    },
    state:state=>{
      if(state===1&&youtube){
        youtubeAutoPause=false;
        if(!room?.playback?.playing||!youtubeVisible())pauseYouTube(state);
        else{youtubeLocalPaused=false;youtubeBlocked=false;youtubeMessage('');}
      }else if(state===2){
        const automatic=youtubeAutoPause;
        youtubeAutoPause=false;
        if(room?.playback?.playing&&!automatic&&youtubeVisible()){
          youtubeLocalPaused=true;youtubeMessage('In pausa qui',true);
        }else if(!room?.playback?.playing)youtubeMessage('');
      }else if(state===0)youtubeMessage('');
    },
    blocked:()=>{youtubeBlocked=true;youtubeMessage('Tocca per avviare YouTube',true);},
    error:code=>{
      youtubeMessage(code===101||code===150?'Questo video non consente la riproduzione incorporata.':'YouTube non disponibile per questo video.');
    }
  });
}

function syncFile(force=false){
  if(multisala.open||!room?.channel?.file||!room.playback||!settings.monitor||video.readyState<1)return;
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
  if(multisala.open)return;
  const url=channel?.url??null;
  $('channel-name').textContent=room?.screen?'Finestra di '+room.screen.name:channel?.name??'';
  if(room?.screen){
    if(playingURL!==null||force)stopVideo();
    playingURL=null;video.hidden=true;
    $('on-air').textContent='LIVE';
    if(settings.monitor)$('screen-empty').hidden=true;
    else message('Riproduzione fermata qui');
    return;
  }
  if(!force&&url===playingURL){syncYouTube(seek);syncFile(seek);return;}
  playingURL=url;stopVideo();
  $('on-air').textContent=url?((channel.youtube||channel.file)?'VIDEO':'LIVE'):'';
  if(!settings.monitor){message('Riproduzione fermata qui');return;}
  if(!url){message('In attesa di un canale');return;}
  message('Collegamento al video…');
  if(channel.youtube){showYouTube(channel.youtube);return;}
  if(channel.image){message('In attesa di un canale');return;}
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
  if(playingURL&&settings.monitor)message(room?.channel?.group?'Media disponibile per i membri del gruppo Telegram.':'Canale non riproducibile su questo dispositivo',true);
});
video.addEventListener('playing',()=>{$('screen-empty').hidden=true;});
$('start-video').onclick=()=>{
  if(youtube){youtubeLocalPaused=false;youtubeBlocked=false;syncYouTube(true);}
  else if(room?.channel?.file){if(video.error)tune(room.channel,true);else{fileBlocked=false;syncFile(true);}}
  else if(video.src||hls)startPlayback();
  else tune(room?.channel,true);
};

const screenShare=new WindowShare($('share-video'),action,(text,button)=>{
  if(!room?.screen){if(text)notice(text);return;}
  $('share-message').textContent=text;
  $('share-placeholder').hidden=!text||!settings.monitor;
  $('share-retry').hidden=!button;
  $('share-retry').textContent=button==='retry'?'Riprova collegamento':'Riproduci qui';
},({ready,audio,blocked,local})=>{
  $('share-audio').hidden=!room?.screen||!settings.monitor||!ready||!audio||local;
  const status=$('share-audio-state');
  status.hidden=!room?.screen||!settings.monitor||!ready;
  status.textContent=audio?(local?'Audio in trasmissione':blocked?'Audio disattivato dal browser':''):'Solo video';
  status.title=audio?'':'La sorgente non ha fornito una traccia audio';
  if(!status.textContent)status.hidden=true;
});
$('share-audio').onclick=()=>{
  if(settings.volume===0){settings.volume=65;$('volume').value=65;screenShare.volume(65);save();}
  screenShare.enableAudio();
};
function drawScreenShare(){
  const active=room?.screen,button=$('share-window');
  button.textContent=active?.local?'Interrompi condivisione':'Condividi finestra';
  button.dataset.live=String(!!active?.local);
  button.disabled=!connected||!!active&&!active.local;
  $('share-video').hidden=!active||!settings.monitor;
  if(!active||!settings.monitor)$('share-placeholder').hidden=true;
  screenShare.update(room,settings.monitor&&!multisala.open,settings.volume);
  screenShare.reportAudio();
}
$('share-window').onclick=async()=>{
  if(room?.screen?.local){screenShare.stop();return;}
  if(!connected||!room)return;
  if(!screenShare.supported){await screenShare.start();return;}
  $('share-window').disabled=true;
  await screenShare.start();
  drawScreenShare();
};
$('share-retry').onclick=()=>screenShare.retry();
window.addEventListener('pagehide',()=>{mosaic.clear();screenShare.disconnect();});

const multisala=$('multisala-dialog');
let listedRooms=[],mosaicPreviews=[],mosaicRequested=false,mosaicTarget=null;
const mosaic=new CinemaMosaic($('multisala-rooms'),id=>{mosaicTarget=id;multisala.close();},action,()=>screenShare.capture?.stream);
function drawMultisala(){
  if(!multisala.open)return;
  if(connected&&room&&!mosaicRequested){mosaicRequested=true;action('mosaic',{open:true});}
  mosaic.update(listedRooms,mosaicPreviews,null,room?.id);
  $('multisala-empty').hidden=listedRooms.length>0;
}
$('multisala').onclick=()=>{
  if(!room)return;
  multisala.showModal();
  stopVideo();playingURL=null;
  drawScreenShare();drawMultisala();
};
multisala.onclose=()=>{
  mosaic.clear();mosaicPreviews=[];
  if(mosaicRequested&&connected)action('mosaic',{open:false});
  mosaicRequested=false;
  const target=mosaicTarget;mosaicTarget=null;
  if(target&&target!==room?.id&&connected){action('enter',{room:target});return;}
  drawScreenShare();tune(room?.channel,true);
};
const seats=new Map();
function drawAudience(people){
  const present=new Set(people.map(person=>person.id));
  for(const [id,seat] of seats)if(!present.has(id)){
    seat.sofa.remove();seats.delete(id);
  }
  people.forEach(({id,name,appearance},index)=>{
    let seat=seats.get(id);
    if(!seat){
      const sofa=node('div','','sofa');
      const figure=node('span'),label=node('small');
      sofa.append(figure,label);
      seat={sofa,figure,label,appearance:null};
      seats.set(id,seat);$('sofas').append(sofa);
    }
    seat.sofa.style.setProperty('--seat-color',['#926283','#58728f','#777347','#9a5f55'][index%4]);
    seat.sofa.title=name;
    seat.label.textContent=id===me?'Tu · '+name:name;
    const avatar=avatarSVG(appearance);
    if(seat.appearance!==avatar){seat.figure.innerHTML=avatar;seat.appearance=avatar;}
  });
}
const closeDialog=$('close-dialog');
$('close-room').onclick=()=>{closeDialog.returnValue='';closeDialog.showModal();};
closeDialog.onclose=()=>{if(closeDialog.returnValue==='close')action('close-room');};
function drawRooms(rooms,active){
  const previous=room;
  const changedVideo=previous?.id!==active?.id||previous?.channel?.url!==active?.channel?.url;
  if(changedVideo||(active?.playback?.playRevision??0)>(previous?.playback?.playRevision??0))youtubeLocalPaused=false;
  if(previous?.id!==active?.id){settings.monitor=true;updateMonitor();drawAudience([]);resetGroupForward();}
  room=active;listedRooms=rooms;
  drawScreenShare();drawMultisala();
  $('multisala').disabled=!active;
  $('connecting').hidden=!!active;cinema.hidden=!active;$('cinema-actions').hidden=!active;
  $('close-room').hidden=!active?.canClose;
  $('shared-playback').hidden=!!active?.screen||!active?.playback;
  $('seek-shared').hidden=!!active?.channel?.live;
  const toggle=$('toggle-shared'),playing=active?.playback?.playing;
  toggle.textContent=playing?'Ⅱ':'▶';
  toggle.setAttribute('aria-label',playing?'Metti in pausa per tutti':'Riproduci per tutti');
  updateFavoriteButton();
  if(!active){if(previous)tune(null);return;}
  const current=rooms.find(entry=>entry.id===active.id);
  $('room-name').textContent='Sala '+(current?.number??'');
  const people=current?.viewers??[];
  $('audience-count').textContent=people.length+' '+(people.length===1?'spettatore':'spettatori');
  drawAudience(people);
  if(!catalogController){
    catalogController=loadCatalog((rows,sourceCount,done)=>{
      catalog=rows;
      $('catalog-status').textContent=done
        ? (sourceCount?rows.length.toLocaleString('it-IT')+' stream · '+sourceCount+' cataloghi':'Cataloghi offline · elenco di base')
        : 'Aggiornamento cataloghi…';
      updateTVFilters();drawSearch();
    });
  }
  if(!youtubeLocalPaused&&$('youtube-status').textContent==='In pausa qui')youtubeMessage('');
  tune(active.channel,previous?.id!==active.id||previous?.screen?.id!==active.screen?.id,previous?.playback?.seek!==active.playback?.seek);
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
  pick.onclick=()=>channel.youtubeChannel?openYouTubeChannel(channel.youtubeChannel):action('channel',{channel:packetChannel(channel)});
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
const packetChannel=({name,url,logo,live,catalog,catalogUntil})=>({name,url,logo,live,catalog:catalog||!!catalogUntil});
const TV_PAGE_SIZE=48;
let tvPage=0;
function options(id,items){
  const select=$(id),value=select.value,first=select.options[0];
  select.replaceChildren(first,...items.map(([code,label])=>new Option(label,code)));
  if(items.some(([code])=>code===value))select.value=value;
}
function updateTVFilters(){
  const countries=new Set(['IT','MT','GB','US','FR','DE','ES','CH']);
  const sources=new Set();
  for(const row of catalog){
    for(const code of row.countries)countries.add(code);
    for(const source of row.sources)sources.add(source);
  }
  options('tv-country',[...countries].map(code=>[code,countryName(code)]).sort((a,b)=>a[1].localeCompare(b[1],'it')));
  options('tv-source',[...sources].sort().map(source=>[source,source]));
}
options('tv-category',Object.entries(categories));
function drawSearch(){
  const list=$('results'),rows=searchChannels(catalog,$('query').value,{
    country:$('tv-country').value,category:$('tv-category').value,source:$('tv-source').value
  });
  const pages=Math.ceil(rows.length/TV_PAGE_SIZE);
  tvPage=Math.min(tvPage,Math.max(0,pages-1));
  const start=tvPage*TV_PAGE_SIZE;
  list.replaceChildren(...rows.slice(start,start+TV_PAGE_SIZE).map(channel=>channelCard(channel)));
  if(!rows.length)list.append(node('p','Nessun canale trovato.'));
  $('tv-pages').hidden=pages<=1;$('tv-prev').disabled=tvPage===0;$('tv-next').disabled=tvPage+1>=pages;
  $('tv-page').textContent=(start+1)+'–'+Math.min(rows.length,start+TV_PAGE_SIZE)+' / '+rows.length.toLocaleString('it-IT');
}
function refreshTVPage(page=0){
  tvPage=page;$('results').scrollTop=0;drawSearch();
}
$('tv-prev').onclick=()=>refreshTVPage(tvPage-1);
$('tv-next').onclick=()=>refreshTVPage(tvPage+1);
for(const field of ['country','category','source']){
  $('tv-'+field).onchange=()=>{
    if(field!=='source')catalogController?.scope(field,$('tv-'+field).value);
    refreshTVPage();
  };
}
$('tv-feed-form').onsubmit=async event=>{
  event.preventDefault();
  if(!catalogController)return;
  const form=event.currentTarget,button=form.querySelector('button'),status=$('tv-feed-status');
  button.disabled=true;status.textContent='Lettura playlist…';
  try{
    const count=await catalogController.importPlaylist($('tv-feed-url').value);
    $('query').value='';$('tv-country').value='';$('tv-category').value='';
    const select=$('tv-source');
    if(![...select.options].some(option=>option.value==='Playlist importata'))select.add(new Option('Playlist importata','Playlist importata'));
    select.value='Playlist importata';
    status.textContent=count+' stream aggiunti alla ricerca.';
    refreshTVPage();
  }catch(error){status.textContent=error.message==='Failed to fetch'?'Playlist non raggiungibile dal browser. Verifica il link e l’accesso pubblico.':error.message;}
  finally{button.disabled=false;}
};
let youtubeSearchId=0,youtubeLastRequest=null,youtubeResults=[],youtubeQueryResults=[],youtubeChannel=null;
function selectSource(source){
  const isTV=source==='tv';
  $('source-tv').setAttribute('aria-pressed',String(isTV));
  $('source-youtube').setAttribute('aria-pressed',String(!isTV));
  $('tv-search').hidden=!isTV;$('youtube-search').hidden=isTV;
}
$('source-tv').onclick=()=>selectSource('tv');
$('source-youtube').onclick=()=>{selectSource('youtube');$('youtube-query').focus();};
function drawYouTube(){
  $('youtube-channel').hidden=!youtubeChannel;
  if(youtubeChannel){
    const saved=favorites.some(item=>item.url===youtubeChannel.url);
    $('youtube-channel-name').textContent=youtubeChannel.name;
    $('youtube-save').disabled=saved;
    $('youtube-save').textContent=saved?'★ Nei preferiti':'☆ Salva canale';
  }
  $('youtube-results').replaceChildren(...youtubeResults.map(item=>{
    const entry=node('article','','youtube-result'),copy=node('div'),open=node('button',item.kind==='channel'?'Apri canale':'Guarda in sala');
    copy.append(node('strong',item.name));
    if(item.author||item.live)copy.append(node('small',item.live?'● Diretta · '+(item.author||'YouTube'):item.author));
    open.onclick=()=>{
      if(item.kind==='channel')openYouTubeChannel(item.id);
      else{
        action('channel',{channel:packetChannel({...item,catalog:!item.direct})});
        if(mobile.matches){cinema.classList.remove('tools-open');updateTools();}
      }
    };
    open.setAttribute('aria-label',open.textContent+' · '+item.name);
    entry.append(copy,open);
    return entry;
  }));
}
function lookupYouTube(params){
  youtubeLastRequest=params;youtubeChannel=null;youtubeResults=[];drawYouTube();
  $('youtube-search-status').textContent='Caricamento da YouTube…';
  send('youtube-search',{id:++youtubeSearchId,params});
}
function openYouTubeChannel(id){
  selectSource('youtube');
  if(mobile.matches&&!cinema.classList.contains('wide')){cinema.classList.add('tools-open');updateTools();}
  lookupYouTube({mode:'channel',id});
}
$('youtube-back').onclick=()=>{
  youtubeSearchId++;youtubeChannel=null;youtubeResults=youtubeQueryResults;
  $('youtube-search-status').textContent=youtubeResults.length?'Risultati YouTube':'Cerca per nome o incolla un link YouTube.';
  drawYouTube();
};
$('youtube-save').onclick=()=>{
  if(youtubeChannel)action('favorite-add',{channel:packetChannel({...youtubeChannel,catalog:true})});
};
$('youtube-form').onsubmit=event=>{
  event.preventDefault();
  const q=$('youtube-query').value.trim(),id=youtubeId(q),channelId=youtubeChannelId(q);
  let handle=q.startsWith('@')?q:null;
  try{
    const url=new URL(q);
    if(url.protocol==='https:'&&['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))handle=decodeURIComponent(url.pathname.split('/')[1]);
  }catch{}
  if(id){
    youtubeSearchId++;youtubeChannel=null;
    youtubeResults=youtubeQueryResults=[{kind:'video',name:'Video YouTube · '+id,url:q,live:/youtube\.com\/live\//i.test(q),direct:true}];
    $('youtube-search-status').textContent='Video da link';drawYouTube();
  }else if(channelId)openYouTubeChannel(channelId);
  else if(/^@[\p{L}\p{N}._·-]{2,40}$/u.test(handle??''))lookupYouTube({mode:'channel',handle});
  else if(q.length>=2&&q.length<=80)lookupYouTube({mode:'search',q,type:$('youtube-filter').value});
  else $('youtube-search-status').textContent='Inserisci da 2 a 80 caratteri o un link YouTube.';
};
function updateFavoriteButton(){
  const button=$('save-playing'),url=room?.channel?.url;
  const saved=favorites.some(item=>item.url===url);
  button.hidden=!!room?.screen||!url||room?.channel?.file===true||room?.channel?.group===true;button.disabled=saved;button.textContent=saved?'★':'☆';
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
$('query').oninput=()=>{clearTimeout(queryTimer);queryTimer=setTimeout(refreshTVPage,100);};
function updateMonitor(){
  const stop=$('local-stop'),label=settings.monitor?'Ferma solo qui':'Riprendi solo qui';
  stop.textContent=settings.monitor?'■':'▶';
  stop.setAttribute('aria-label',label);stop.title=label;
}
$('local-stop').onclick=()=>{settings.monitor=!settings.monitor;updateMonitor();drawScreenShare();tune(room?.channel,true);};
$('volume').value=settings.volume;
$('volume').oninput=()=>{settings.volume=Number($('volume').value);video.volume=settings.volume/100;video.muted=settings.volume===0;screenShare.volume(settings.volume);if(youtube){youtube.setVolume(settings.volume);if(settings.volume===0)youtube.mute();else youtube.unMute();}save();};
updateMonitor();
function updateTools(){
  const wide=cinema.classList.contains('wide');
  $('mode').setAttribute('aria-pressed',String(wide));
  $('tools').setAttribute('aria-expanded',String(!wide&&(!mobile.matches||cinema.classList.contains('tools-open'))));
  $('tools').textContent=wide?'Mostra canali':'Canali';
  syncYouTube();
}
$('mode').onclick=()=>{cinema.classList.toggle('wide');updateTools();};
$('tools').onclick=()=>{
  if(cinema.classList.contains('wide')){cinema.classList.remove('wide');cinema.classList.add('tools-open');}
  else if(mobile.matches)cinema.classList.toggle('tools-open');
  else cinema.classList.add('wide');
  updateTools();
};
mobile.addEventListener('change',updateTools);screen.parentElement.addEventListener('scroll',()=>syncYouTube(),{passive:true});document.addEventListener('visibilitychange',()=>syncYouTube());updateTools();
$('screen-full').onclick=async()=>{
  if(document.fullscreenElement){await document.exitFullscreen();return;}
  if(document.body.classList.contains('video-full')){document.body.classList.remove('video-full');return;}
  try{if(screen.requestFullscreen){await screen.requestFullscreen();return;}}catch{}
  const fullscreenVideo=room?.screen?$('share-video'):video;
  if(fullscreenVideo.webkitEnterFullscreen&&fullscreenVideo.readyState>0){try{fullscreenVideo.webkitEnterFullscreen();return;}catch{}}
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
    if(!connected){mosaic.clear();mosaicPreviews=[];mosaicRequested=false;screenShare.disconnect();$('share-window').disabled=true;notice(data.message||'Riconnessione al cinema…');}
    else $('notice').textContent='';
  }
  if(data?.type==='cinema:youtube-result'){
    if(data.id!==youtubeSearchId)return;
    youtubeResults=data.result?.items??[];
    youtubeChannel=data.result?.channel??null;
    if(!youtubeChannel)youtubeQueryResults=youtubeResults;
    const empty=youtubeLastRequest?.type==='live'?'Nessuna diretta trovata. Prova anche con il filtro Video.':
      youtubeLastRequest?.mode==='search'?'Nessun risultato per «'+youtubeLastRequest.q+'». Prova un altro nome o filtro.':'Nessun video recente trovato.';
    $('youtube-search-status').textContent=data.error||(youtubeResults.length?(youtubeChannel?'Video recenti':'Risultati YouTube'):empty);
    drawYouTube();return;
  }
  if(data?.type==='cinema:group-armed'){groupArmed(data);return;}
  if(data?.type==='cinema:upload-result'){
    setUploading(false);
    if(data.error)$('watch-error').textContent=data.error;
    else watchDialog.close();
    return;
  }
  if(data?.type!=='cinema:packet')return;
  const packet=data.packet;
  if(packet.type==='rooms'){me=packet.me;clockOffset=Number.isFinite(packet.now)?packet.now-Date.now():0;mosaic.clock=clockOffset;mosaicPreviews=packet.previews??[];drawRooms(packet.rooms,packet.active);}
  else if(packet.type==='group-forward-status')groupForwardStatus(packet);
  else if(packet.type==='favorites'){favorites=packet.items;drawFavorites();drawYouTube();if(catalogController)drawSearch();}
  else if(packet.type?.startsWith('screen-')){screenShare.receive(packet);if(multisala.open)mosaic.packet(packet);}
  else if(packet.type==='error')notice(packet.message);
});
const groupButton=$('group-media'),groupPanel=$('group-forward-panel'),groupHome=$('group-home'),groupHelp=$('group-forward-help');
let groupHomeURL=null,groupForwardTimer;
function resetGroupForward(){
  clearTimeout(groupForwardTimer);
  groupHomeURL=null;groupHome.hidden=true;groupPanel.hidden=true;groupButton.disabled=false;
}
groupButton.onclick=()=>{
  resetGroupForward();groupPanel.hidden=false;groupButton.disabled=true;
  groupHelp.textContent='Cerco la Home di Binotto Corsa Competizione…';
  send('group-arm');
};
groupHome.onclick=()=>{if(groupHomeURL)send('group-open',{url:groupHomeURL});};
function groupArmed({result,error}){
  groupButton.disabled=false;
  if(error){groupHelp.textContent=error;return;}
  groupHomeURL=result.link;groupHome.hidden=!groupHomeURL;
  groupHelp.textContent=(groupHomeURL?'Scegli un video nella Home. ':'Apri la Home di Binotto Corsa Competizione in Telegram. ')+
    'Inoltralo a @'+result.bot+' entro 5 minuti e partirà in sala.';
  groupForwardTimer=setTimeout(()=>{
    groupHome.hidden=true;groupHelp.textContent='Tempo scaduto. Tocca di nuovo Video dal gruppo.';
  },300000);
}
function groupForwardStatus({played,error}){
  if(played){resetGroupForward();notice('Video del gruppo avviato.');}
  else if(error){groupPanel.hidden=false;groupHelp.textContent=error;}
}
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
$('toggle-shared').onclick=()=>playback(room?.playback?.playing?'pause':'play');
$('seek-shared').onsubmit=event=>{
  event.preventDefault();
  const value=$('seek-time').value.trim();
  if(!/^\d{1,5}(?::[0-5]\d)?$/.test(value)){notice('Inserisci i secondi o un tempo come 12:30.');return;}
  const parts=value.split(':').map(Number),position=parts.length===2?parts[0]*60+parts[1]:parts[0];
  if(position>86400){notice('Il tempo inserito è troppo lungo.');return;}
  playback('seek',position);
};
setInterval(()=>{
  if(!room?.playback||room.screen)return;
  if(youtubeLocalPaused&&room.playback.playing){$('shared-time').textContent='In pausa qui';return;}
  if(room.channel?.live){$('shared-time').textContent=room.playback.playing?'● Diretta':'In pausa';return;}
  const seconds=Math.floor(targetPosition());
  $('shared-time').textContent=(room.playback.playing?'In riproduzione':'In pausa')+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
},1000);
setInterval(()=>{if(multisala.open)mosaic.sync();else{syncYouTube();syncFile();}},5000);
send('ready');
