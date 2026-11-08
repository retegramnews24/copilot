const IPTV='https://iptv-org.github.io';
const FAST='https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/';
const SOURCES=[
  IPTV+'/iptv/index.m3u',IPTV+'/iptv/countries/it.m3u',
  'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
  ...['plutotv_all','samsungtvplus_all','plex_all','roku_all'].map(name=>FAST+name+'.m3u')
];
const BACKUP=[
  {name:'France 24 English',country:'FR',group:'News',url:'https://f24hls-i.akamaihd.net/hls/live/221192/F24_EN_HI_HLS/master_2000.m3u8'},
  {name:'Al Jazeera English',country:'QA',group:'News',url:'https://live-hls-web-aje.getaj.net/AJE/index.m3u8'},
  {name:'TRT World',country:'TR',group:'News',url:'https://tv-trtworld.medya.trt.com.tr/master.m3u8'}
];
const region=new Intl.DisplayNames(['it'],{type:'region'});
const countryName=code=>/^[A-Za-z]{2}$/.test(code??'')?region.of(code.toUpperCase()):code;
const fold=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
function urlOf(value,base){
  try{
    const url=new URL(value,base);
    return url.protocol==='https:'&&!url.username&&!url.password ? url.href : '';
  }catch{return '';}
}
export function parseM3U(text,base){
  const rows=[];
  let pending=null;
  for(const line of text.split(/\r?\n/)){
    const value=line.trim();
    if(value.startsWith('#EXTINF:')){
      const separator=value.match(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if(!separator){pending=null;continue;}
      const attributes=Object.fromEntries([...value.slice(0,separator.index).matchAll(/([\w-]+)="([^"]*)"/g)]
        .map(([,key,data])=>[key.toLowerCase(),data]));
      pending={name:value.slice(separator.index+1).trim(),channel:attributes['tvg-id']?.split('@')[0],
        logo:attributes['tvg-logo']?urlOf(attributes['tvg-logo'],base):'',
        group:attributes['group-title']??attributes['tvg-group'],country:attributes['tvg-country']};
    }else if(value&&!value.startsWith('#')&&pending){
      const url=urlOf(value,base);
      if(url&&pending.name)rows.push({...pending,url});
      pending=null;
    }
  }
  return rows;
}
async function load(url,format='json'){
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),credentials:'omit'});
  if(!response.ok)throw Error('Fonte non disponibile');
  return response[format]();
}
function index(rows){
  const map=new Map();
  for(const row of rows){
    const previous=map.get(row.url);
    if(previous){
      for(const field of ['country','group','logo'])if(!previous[field]&&row[field])previous[field]=row[field];
    }else map.set(row.url,{...row});
  }
  return [...map.values()].map(row=>({...row,key:fold([row.name,row.channel,row.group,row.country,countryName(row.country),row.aliases,row.url].join(' ')),title:fold(row.name)}));
}
export function searchChannels(rows,query,limit=80){
  const term=fold(query),words=term.split(/\s+/).filter(Boolean);
  if(!words.length)return rows.slice(0,limit);
  return rows.map(row=>({row,rank:row.title===term?4:row.title.startsWith(term)?3:words.every(word=>row.key.includes(word))?2:words.some(word=>row.key.includes(word))?1:0}))
    .filter(entry=>entry.rank).sort((a,b)=>b.rank-a.rank).slice(0,limit).map(entry=>entry.row);
}
export async function loadCatalog(onUpdate){
  let rows=[...BACKUP],success=0;
  onUpdate(index(rows),success,false);
  const add=items=>{if(items.length){rows.push(...items);success++;onUpdate(index(rows),success,false);}};
  const fromAPI=async()=>{
    const [streams,channels,logos]=await Promise.allSettled(['streams','channels','logos'].map(name=>load(IPTV+'/api/'+name+'.json')));
    if(!Array.isArray(streams.value))return;
    const names=new Map((channels.value??[]).map(row=>[row.id,row]));
    const images=new Map((logos.value??[]).filter(row=>row.in_use).map(row=>[row.channel,urlOf(row.url)]));
    add(streams.value.flatMap(row=>{
      const channel=names.get(row.channel),url=urlOf(row.url),name=channel?.name||row.title||row.channel;
      return url&&name?[{name,url,channel:row.channel,country:channel?.country,group:channel?.categories?.join(', '),aliases:channel?.alt_names?.join(' '),logo:images.get(row.channel)}]:[];
    }));
  };
  await Promise.allSettled([...SOURCES.map(async source=>add(parseM3U(await load(source,'text'),source))),fromAPI()]);
  onUpdate(index(rows),success,true);
}
