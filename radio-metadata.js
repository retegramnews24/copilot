// Short, bounded ICY probes. Audio playback remains direct from the listener.
const hosts=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
const cache=new Map(),inflight=new Map(),requests=new Map();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function remember(key,value,ttl){if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,{value,expires:Date.now()+ttl});return value}
function cached(key){const hit=cache.get(key);if(hit?.expires>Date.now())return hit.value;cache.delete(key);return undefined}
export function publicStreamURL(value){
 try{
  const u=new URL(value),h=u.hostname.toLowerCase().replace(/\.$/,'');
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||!h.includes('.')||!/[a-z]/.test(h)||!/^([a-z0-9-]+\.)+[a-z][a-z0-9-]*$/.test(h)||/(^|\.)(localhost|local|internal|test|invalid|example|home|lan)$/.test(h))return null;
  return u.href;
 }catch{return null}
}
export function icyTitle(bytes){
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('windows-1252').decode(bytes)}
 const m=text.match(/StreamTitle\s*=\s*(['"])(.*?)\1\s*;/is);
 return m?m[2].replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240):null;
}
export async function readICY(response){
 const interval=Number(response.headers.get('icy-metaint'));
 if(!response.ok||!response.body||!Number.isSafeInteger(interval)||interval<1||interval>65536){await response.body?.cancel();return null}
 const reader=response.body.getReader();let skip=interval,size=null,metadata=null,filled=0,total=0,blocks=0;
 try{
  while(total<262144&&blocks<4){
   const {done,value}=await reader.read();if(done)break;
   let i=0;const end=Math.min(value.length,262144-total);
   while(i<end&&blocks<4){
    if(skip){const n=Math.min(skip,end-i);skip-=n;i+=n;total+=n;continue}
    if(size===null){size=value[i++]*16;total++;filled=0;metadata=new Uint8Array(size);if(!size){skip=interval;size=null;blocks++}continue}
    const n=Math.min(size-filled,end-i);metadata.set(value.subarray(i,i+n),filled);filled+=n;i+=n;total+=n;
    if(filled===size){const title=icyTitle(metadata);if(title)return title;blocks++;skip=interval;size=null}
   }
  }
  return null;
 }finally{await reader.cancel().catch(()=>{})}
}

async function stationURLs(station,signal){
 const key='station:'+station,hit=cached(key);if(hit)return hit;
 for(const host of hosts){
  if(signal.aborted)break;
  try{
   const r=await fetch(host+'/json/stations/byuuid/'+station,{signal,headers:{'User-Agent':'Binottoland/1.1','Accept':'application/json'}});if(!r.ok){await r.body?.cancel();continue}
   const rows=await r.json(),row=Array.isArray(rows)?rows.find(s=>s.stationuuid?.toLowerCase()===station):null;
   if(!row)continue;
   const urls=[...new Set([row.url_resolved,row.url].map(publicStreamURL).filter(Boolean))];return remember(key,urls,3600000);
  }catch{}
 }
 return [];
}
async function probe(station){
 const signal=AbortSignal.timeout(10000);
 try{
  for(const candidate of await stationURLs(station,signal)){
   let url=candidate;
   for(let redirects=0;redirects<=3&&!signal.aborted;redirects++){
    const response=await fetch(url,{signal,redirect:'manual',headers:{'Icy-MetaData':'1','User-Agent':'Binottoland/1.1','Accept':'audio/*'}});
    if([301,302,303,307,308].includes(response.status)){
     const location=response.headers.get('Location');await response.body?.cancel();if(!location)break;
     url=publicStreamURL(new URL(location,url).href);if(!url)break;continue;
    }
    const title=await readICY(response);if(title)return {title,checkedAt:Date.now()};break;
   }
  }
 }catch{}
 return {title:null,checkedAt:Date.now()};
}
export async function radioNowPlaying(station,userId){
 if(typeof station!=='string'||!uuid.test(station))return null;
 station=station.toLowerCase();const key='title:'+station,hit=cached(key);if(hit)return hit;
 if(inflight.has(station))return inflight.get(station);
 const previous=requests.get(userId)||0;if(Date.now()-previous<5000)return {title:null,checkedAt:Date.now()};
 if(requests.size>=256)requests.delete(requests.keys().next().value);requests.set(userId,Date.now());
 if(inflight.size>=20)return {title:null,checkedAt:Date.now()};
 const pending=probe(station).then(value=>remember(key,value,value.title?45000:120000)).finally(()=>inflight.delete(station));
 inflight.set(station,pending);return pending;
}
