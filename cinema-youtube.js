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

function googleFailure(status,error){
  const reasons=new Set();
  for(const entries of [error?.errors,error?.details]){
    if(Array.isArray(entries))for(const entry of entries)if(typeof entry?.reason==='string')reasons.add(entry.reason);
  }
  const has=(...codes)=>codes.some(code=>reasons.has(code));
  if(status===429||has('quotaExceeded','dailyLimitExceeded','rateLimitExceeded','userRateLimitExceeded','RATE_LIMIT_EXCEEDED','QUOTA_EXCEEDED')){
    return failure('Quota YouTube esaurita o troppe richieste. Puoi ancora riprodurre un link diretto.',429);
  }
  if(has('API_KEY_INVALID','keyInvalid','keyExpired','API_KEY_EXPIRED')){
    return failure('Google ha rifiutato la chiave. Verifica il valore del secret YOUTUBE_API_KEY su Cloudflare.',503);
  }
  if(has('API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED','API_KEY_ANDROID_APP_BLOCKED','API_KEY_IOS_APP_BLOCKED','ipRefererBlocked','refererNotAllowed')){
    return failure('Le restrizioni applicazione della chiave bloccano il Worker. Su Google Cloud impostale su Nessuna.',503);
  }
  if(has('SERVICE_DISABLED','accessNotConfigured','serviceDisabled','API_KEY_SERVICE_BLOCKED')){
    return failure('Google blocca YouTube Data API v3. Verifica che sia abilitata nel progetto della chiave e consentita nelle restrizioni API.',503);
  }
  if(status===401||status===403){
    return failure('Google ha negato l’accesso a YouTube. Verifica la chiave e le restrizioni del progetto Google Cloud.',503);
  }
  return failure('YouTube ha restituito un errore. Riprova tra poco o usa un link diretto.',502);
}

export class YouTubeCatalog{
  constructor(key){
    this.key=typeof key==='string'?key.trim():'';
    this.cache=new Map();
    this.pending=new Map();
    this.searchers=new Map();
  }
  async api(resource,params){
    const url=new URL(resource,API);
    url.search=new URLSearchParams({...params,key:this.key});
    const reply=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'manual'});
    const data=await reply.json().catch(()=>null);
    if(!reply.ok)throw googleFailure(reply.status,data?.error);
    if(!Array.isArray(data?.items))throw failure('YouTube ha inviato una risposta incompleta. Riprova tra poco.',502);
    return data.items;
  }
  async search(q,type){
    const params={part:'snippet',maxResults:String(LIMIT),q,type:type==='channel'?'channel':'video',relevanceLanguage:'it'};
    if(type!=='channel')params.videoEmbeddable='true';
    if(type==='live')params.eventType='live';
    const results=await this.api('search',params);
    const items=results.flatMap(item=>{
      const {id,snippet}=item??{};
      if(!snippet)return [];
      if(type==='channel')return validYouTubeChannelId(id?.channelId)?[channel(id.channelId,snippet.title)]:[];
      return validVideo(id?.videoId)?[video(id.videoId,snippet.title,snippet.channelTitle,snippet.liveBroadcastContent==='live')]:[];
    });
    if(results.length&&!items.length)throw failure('I risultati YouTube ricevuti sono incompleti. Riprova tra poco.',502);
    return {items};
  }
  async feed(id){
    const url='https://www.youtube.com/feeds/videos.xml?channel_id='+id;
    const reply=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'manual'});
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
    try{return await this.apiUploads(id,handle);}
    catch(error){if(id&&error.status!==404)return this.feed(id);throw error;}
  }
  async apiUploads(id,handle){
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
          if(result.items.length||result.channel){
            if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value);
            this.cache.set(key,{result,expires:Date.now()+(type==='live'?90000:600000)});
          }
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
