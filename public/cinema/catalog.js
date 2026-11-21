const IPTV='https://iptv-org.github.io';
const FAST='https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/';
const SOURCES=[
  ['IPTV-org',IPTV+'/iptv/index.m3u'],
  ['Free-TV','https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'],
  ['IPTV Italia','https://raw.githubusercontent.com/peppenamir/iptv_italia/main/lista.m3u'],
  ['IPTV-org · Italiano',IPTV+'/iptv/languages/ita.m3u'],
  ...[['Pluto TV','plutotv_all'],['Samsung TV Plus','samsungtvplus_all'],['Plex','plex_all'],
    ['The Roku Channel','roku_all'],['Tubi','tubi_all']].map(([name,feed])=>[name,FAST+feed+'.m3u'])
];
const BACKUP=[
  {name:'France 24 English',country:'FR',group:'News',url:'https://f24hls-i.akamaihd.net/hls/live/221192/F24_EN_HI_HLS/master_2000.m3u8'},
  {name:'Al Jazeera English',country:'QA',group:'News',url:'https://live-hls-web-aje.getaj.net/AJE/index.m3u8'},
  {name:'TRT World',country:'TR',group:'News',url:'https://tv-trtworld.medya.trt.com.tr/master.m3u8'}
];
const region=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['it'],{type:'region'}):null;
const language=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['it'],{type:'language'}):null;
export const categories={news:'Notizie',sports:'Sport',music:'Musica',kids:'Bambini',movies:'Cinema',documentary:'Documentari',entertainment:'Intrattenimento',series:'Serie TV',culture:'Cultura'};
const localeNames={italia:'IT',italy:'IT',malta:'MT',uk:'GB','united kingdom':'GB',usa:'US'};
const categoryIDs={notizie:'news',news:'news',sport:'sports',sports:'sports',musica:'music',music:'music',bambini:'kids',kids:'kids',film:'movies',cinema:'movies',movies:'movies',documentari:'documentary',documentary:'documentary',intrattenimento:'entertainment',entertainment:'entertainment',serie:'series',series:'series',cultura:'culture',culture:'culture'};
const fold=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const split=value=>String(value??'').split(/[,;|]/).map(part=>part.trim()).filter(Boolean);
const normalizeCountry=value=>{
  const code=value.toUpperCase();
  return code==='UK'?'GB':/^[A-Z]{2}$/.test(code)?code:localeNames[fold(value)]||null;
};
export const countryName=code=>region?.of(code)||code;
function displayLanguage(code){
  try{return language?.of(code)||code;}catch{return code;}
}
function urlOf(value,base){
  try{
    const url=new URL(value,base);
    url.hash='';
    return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=1400?url.href:'';
  }catch{return '';}
}
function separatorOf(line){
  let quote='';
  for(let i=8;i<line.length;i++){
    const char=line[i];
    if(quote){if(char===quote)quote='';}
    else if(char==='"'||char==="'")quote=char;
    else if(char===',')return i;
  }
  return -1;
}
export function parseM3U(text,base){
  const rows=[];
  let pending=null;
  for(const line of text.split(/\r?\n/)){
    const value=line.trim();
    if(value.startsWith('#EXTINF:')){
      const separator=separatorOf(value);
      if(separator<0){pending=null;continue;}
      const attributes=Object.fromEntries([...value.slice(0,separator).matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .map(([,key,double,single])=>[key.toLowerCase(),double??single]));
      const title=attributes['tvg-name'],channel=attributes['tvg-id']?.split('@')[0];
      pending={name:value.slice(separator+1).trim()||title,aliases:title,
        channel,logo:attributes['tvg-logo']?urlOf(attributes['tvg-logo'],base):'',
        group:attributes['group-title']??attributes['tvg-group'],
        country:attributes['tvg-country']||channel?.match(/\.([a-z]{2})$/i)?.[1]||localeNames[fold(attributes['tvg-group'])],
        language:attributes['tvg-language']};
    }else if(value&&!value.startsWith('#')&&pending){
      const url=urlOf(value,base);
      if(url&&pending.name)rows.push({...pending,url});
      pending=null;
    }
  }
  return rows;
}
async function load(url,max=8*1024*1024){
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Fonte non disponibile.');
  if(Number(response.headers.get('Content-Length'))>max)throw Error('La playlist è troppo grande.');
  if(!response.body)return '';
  const reader=response.body.getReader(),decoder=new TextDecoder(),parts=[];
  let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>max)throw Error('La playlist è troppo grande.');
      parts.push(decoder.decode(value,{stream:true}));
    }
  }finally{reader.cancel().catch(()=>{});}
  parts.push(decoder.decode());
  return parts.join('');
}
export function indexChannels(rows){
  const map=new Map();
  for(const row of rows){
    const item=map.get(row.url)??{...row,countries:new Set(),categories:new Set(),keywords:new Set(),sources:new Set()};
    for(const value of split(row.country)){
      const code=normalizeCountry(value);
      if(code){item.countries.add(code);item.keywords.add(countryName(code));}
    }
    for(const value of split(row.group)){
      const key=categoryIDs[fold(value)];
      if(key){item.categories.add(key);item.keywords.add(categories[key]);}
      item.keywords.add(value);
    }
    for(const value of split(row.language))item.keywords.add(displayLanguage(value));
    for(const value of [row.name,row.channel,row.aliases,row.country,row.language,row.source])if(value)item.keywords.add(value);
    if(row.source)item.sources.add(row.source);
    if(!item.logo&&row.logo)item.logo=row.logo;
    map.set(row.url,item);
  }
  return [...map.values()].map(({keywords,...row})=>{
    const title=fold(row.name);
    return {...row,title,compact:title.replaceAll(' ',''),key:fold([...keywords,row.url].join(' '))};
  });
}
export function searchChannels(rows,query,{country='',category='',source=''}={}){
  const term=fold(query),compact=term.replaceAll(' ',''),words=term.split(' ').filter(Boolean);
  const scoped=rows.filter(row=>(!country||row.countries.has(country))&&(!category||row.categories.has(category))&&(!source||row.sources.has(source)));
  if(!term)return scoped;
  return scoped.map(row=>{
    let rank=0;
    if(row.title===term||row.compact===compact)rank=5;
    else if(row.title.startsWith(term)||(compact.length>2&&row.compact.startsWith(compact)))rank=4;
    else if(row.key.includes(term))rank=3;
    else if(words.every(word=>row.key.includes(word)))rank=2;
    else if(words.some(word=>word.length>=3&&row.key.includes(word)))rank=1;
    return {row,rank};
  }).filter(entry=>entry.rank).sort((a,b)=>b.rank-a.rank).map(entry=>entry.row);
}
export function loadCatalog(onUpdate){
  let rows=[...BACKUP],sources=0,active=0,timer=0;
  const scopes=new Map(),imported=new Set();
  function update(){
    clearTimeout(timer);
    timer=setTimeout(()=>onUpdate(indexChannels(rows),sources,active===0),50);
  }
  async function add(task){
    active++;update();
    try{
      const items=await task();
      if(items.length){rows=rows.concat(items);sources++;}
      return items.length;
    }finally{active--;update();}
  }
  const playlist=async (source,url,defaults={})=>{
    const text=await load(url);
    if(/^#EXT-X-(?:STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE)/m.test(text))throw Error('Questo è un link video. Aprilo con Guarda insieme.');
    if(!/^\s*#EXTM3U\b/i.test(text))throw Error('Il link non contiene una playlist M3U.');
    return parseM3U(text,url).map(row=>({...row,...defaults,source}));
  };
  const fromAPI=async()=>{
    const [streams,channels,logos]=await Promise.allSettled(['streams','channels','logos'].map(async name=>JSON.parse(await load(IPTV+'/api/'+name+'.json'))));
    if(!Array.isArray(streams.value))return [];
    const names=new Map((channels.value??[]).map(row=>[row.id,row]));
    const images=new Map((logos.value??[]).filter(row=>row.in_use).map(row=>[row.channel,urlOf(row.url)]));
    return streams.value.flatMap(row=>{
      const channel=names.get(row.channel),url=urlOf(row.url),name=channel?.name||row.title||row.channel;
      return url&&name?[{name,url,channel:row.channel,country:channel?.country,group:channel?.categories?.join(','),
        language:channel?.languages?.join(','),aliases:channel?.alt_names?.join(','),logo:images.get(row.channel),source:'IPTV-org'}]:[];
    });
  };
  const pending=SOURCES.map(([source,url])=>()=>playlist(source,url));
  pending.push(fromAPI);
  async function loadNext(){
    while(pending.length)await add(pending.shift()).catch(()=>{});
  }
  for(let i=0;i<4;i++)loadNext();
  function scope(type,code){
    if(!code)return;
    const part=type==='country'?'countries':'categories';
    const suffix=type==='country'?(code==='GB'?'uk':code.toLowerCase()):code;
    const key=part+'/'+suffix;
    if(scopes.has(key))return;
    const source='IPTV-org · '+(type==='country'?countryName(code):categories[code]);
    scopes.set(key,add(()=>playlist(source,IPTV+'/iptv/'+key+'.m3u',type==='country'?{country:code}:{group:code})).catch(()=>scopes.delete(key)));
  }
  scope('country','IT');
  scope('country','MT');
  return {
    scope,
    async importPlaylist(value){
      const url=urlOf(value);
      if(!url)throw Error('Inserisci un link HTTPS a una playlist M3U.');
      if(imported.has(url))throw Error('Questa playlist è già nella ricerca.');
      if(imported.size>=5)throw Error('Puoi aggiungere fino a cinque playlist per sessione.');
      imported.add(url);
      try{
        const count=await add(()=>playlist('Playlist importata',url));
        if(!count)throw Error('La playlist non contiene canali HTTPS.');
        return count;
      }catch(error){imported.delete(url);throw error;}
    }
  };
}
