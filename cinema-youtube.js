import {validYouTubeChannelId} from './public/cinema/media.js';

const API='https://www.googleapis.com/youtube/v3/';
const LIMIT=12;
const decode=value=>String(value??'').replace(/&(amp|quot|apos|lt|gt|#\d{1,7}|#x[\da-f]{1,6});/gi,(entity,key)=>{
  const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  key=key.toLowerCase();
  if(key[0]!=='#')return named[key]??entity;
  const code=key[1]==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return code<=0x10ffff?String.fromCodePoint(code):entity;
}).trim().slice(0,160);
const channel=(id,name)=>({kind:'channel',id,name:decode(name)||'Canale YouTube',url:'https://www.youtube.com/channel/'+id});
const video=(id,name,author,live=false)=>({
  kind:'video',id,name:decode(name),author:decode(author),live,url:'https://www.youtube.com/watch?v='+id
});
const validVideo=id=>/^[\w-]{11}$/.test(id??'');
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(message,status)=>Object.assign(Error(message),{status});

export class YouTubeCatalog{
  constructor(key){
    this.key=key;
    this.cache=new Map();
    this.pending=new Map();
    this.searchers=new Map();
  }
  async api(resource,params){
    const url=new URL(resource,API);
    url.search=new URLSearchParams({...params,key:this.key});
    const reply=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'});
    const data=await reply.json();
    if(!reply.ok){
      const reason=data.error?.errors?.[0]?.reason;
      if(reply.status===429||['quotaExceeded','dailyLimitExceeded','rateLimitExceeded'].includes(reason)){
        throw failure('Quota YouTube esaurita. Puoi ancora riprodurre un link diretto.',429);
      }
      throw failure('YouTube non è disponibile in questo momento. Puoi usare un link diretto.',502);
    }
    return data.items??[];
  }
  async search(q,type){
    const params={part:'snippet',maxResults:String(LIMIT),q,type:type==='channel'?'channel':'video',regionCode:'IT',relevanceLanguage:'it'};
    if(type!=='channel')params.videoEmbeddable='true';
    if(type==='live')params.eventType='live';
    const items=await this.api('search',params);
    return {items:items.flatMap(({id,snippet})=>{
      if(!snippet)return [];
      if(type==='channel'&&validYouTubeChannelId(id?.channelId))return [channel(id.channelId,snippet.title)];
      if(validVideo(id?.videoId))return [video(id.videoId,snippet.title,snippet.channelTitle,snippet.liveBroadcastContent==='live')];
      return [];
    })};
  }
  async feed(id){
    const url='https://www.youtube.com/xml/feeds/videos.xml?channel_id='+id;
    const reply=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error'});
    if(reply.status===404)throw failure('Canale YouTube non trovato.',404);
    if(!reply.ok)throw failure('Elenco dei video del canale non disponibile. Puoi usare un link diretto.',502);
    const xml=await reply.text();
    const value=(source,tag)=>source.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>'))?.[1]??'';
    const heading=xml.split('<entry>')[0];
    const name=value(heading,'name')||value(heading,'title')||'Canale YouTube';
    const items=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,LIMIT).flatMap(([,entry])=>{
      const id=value(entry,'yt:videoId');
      return validVideo(id)?[video(id,value(entry,'title'),name)]:[];
    });
    if(!items.length&&!value(heading,'yt:channelId')&&!value(heading,'name')){
      throw failure('Feed del canale non disponibile. Puoi usare un link video diretto.',404);
    }
    return {channel:channel(id,name),items};
  }
  async uploads(id,handle){
    if(!this.key)return this.feed(id);
    const [row]=await this.api('channels',{part:'snippet,contentDetails',...(id?{id}:{forHandle:handle})});
    if(!validYouTubeChannelId(row?.id))throw failure('Canale YouTube non trovato.',404);
    const source=channel(row.id,row.snippet?.title||'Canale YouTube');
    const playlistId=row.contentDetails?.relatedPlaylists?.uploads;
    if(!playlistId)return {channel:source,items:[]};
    const entries=await this.api('playlistItems',{part:'contentDetails',playlistId,maxResults:String(LIMIT)});
    const ids=entries.map(entry=>entry.contentDetails?.videoId).filter(validVideo);
    if(!ids.length)return {channel:source,items:[]};
    const videos=await this.api('videos',{part:'snippet,status',id:ids.join(',')});
    const byId=new Map(videos.map(item=>[item.id,item]));
    return {channel:source,items:ids.flatMap(id=>{
      const item=byId.get(id),s=item?.snippet;
      return s&&item.status?.embeddable?[video(id,s.title,s.channelTitle,s.liveBroadcastContent==='live')]:[];
    })};
  }
  async fetch(req,player){
    if(!player)return response({error:'Accesso richiesto.'},401);
    const p=new URL(req.url).searchParams;
    const mode=p.get('mode'),type=p.get('type');
    const q=p.get('q')?.trim().replace(/\s+/g,' ');
    const id=p.get('id'),handle=p.get('handle');
    const searching=mode==='search';
    if(searching?(!q||q.length<2||q.length>80||!['video','channel','live'].includes(type)):
      (mode!=='channel'||(!validYouTubeChannelId(id)&&!/^@[\p{L}\p{N}._·-]{2,40}$/u.test(handle??''))||(id&&!validYouTubeChannelId(id)))){
      return response({error:'Ricerca YouTube non valida.'},400);
    }
    if(!this.key&&(searching||!id)){
      return response({error:'Ricerca YouTube per nome in attesa di attivazione. Puoi usare un link video o un link /channel/ del canale.'},503);
    }
    const key=searching?type+':'+q.toLowerCase():'channel:'+(id??handle.toLowerCase());
    const now=Date.now();
    for(const [entry,cached] of this.cache)if(cached.expires<=now)this.cache.delete(entry);
    const cached=this.cache.get(key);
    if(cached)return response(cached.result);
    try{
      let pending=this.pending.get(key);
      if(!pending){
        if(this.pending.size>=8)throw failure('Ricerca occupata. Riprova tra poco.',429);
        if(searching){
          for(const [user,entry] of this.searchers)if(entry.until<=now)this.searchers.delete(user);
          const entry=this.searchers.get(player)??{count:0,until:now+60000};
          if(entry.count>=6)throw failure('Troppe ricerche in un minuto. Riprova tra poco.',429);
          entry.count++;this.searchers.set(player,entry);
        }
        const lookup=searching?this.search(q,type):this.uploads(id,handle);
        pending=lookup.then(result=>{
          if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value);
          this.cache.set(key,{result,expires:Date.now()+(type==='live'?90000:600000)});
          return result;
        }).finally(()=>this.pending.delete(key));
        this.pending.set(key,pending);
      }
      return response(await pending);
    }catch(error){
      return response({error:error.status?error.message:'YouTube non raggiungibile. Riprova o usa un link diretto.'},error.status||502);
    }
  }
}
