// Deterministic, bounded pixel work: shared by the render thread and a module Worker.
export const SURFACE_SIZE=256,SURFACE_CACHE=3;
function hash(x,y,seed){let n=Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295}
export function surfacePixels(kind,level,size=SURFACE_SIZE){
 const data=new Uint8ClampedArray(size*size*4),arena=level===6,neutral=level>1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size*256,v=y/size*256,i=(y*size+x)*4,n=hash(Math.floor(u),Math.floor(v),level*701),broad=hash(Math.floor(u/32),Math.floor(v/32),level*193),fine=(n-.5)*(kind==='floor'?12:5);let rgb;
  if(kind==='wall'&&arena){const row=Math.floor(v/32),bx=(u+(row%2)*32)%64,by=v%32,mortar=bx<2||by<2,edge=bx<4||by<4?8:bx>61||by>29?-8:0,brick=hash(Math.floor((u+(row%2)*32)/64),row,88)*13;const value=mortar?104:151+brick+edge+fine;rgb=[value*.93,value,value*.98];}
  else if(kind==='wall'){const column=u%32,diamond=Math.abs(Math.sin(u/16*Math.PI)*Math.cos(v/24*Math.PI)),seam=column<1.4?-12:column<2.5?4:0,patina=(broad-.5)*10,motif=diamond>.86?-8:0,grain=fine+seam+patina+motif;rgb=neutral?[171+grain,174+grain,170+grain]:[186+grain,176+grain,120+grain];}
  else if(kind==='floor'&&arena){const row=Math.floor(v/64),cx=(u+(row%2)*32)%64,cy=v%64,grout=cx<1.4||cy<1.4,edge=cx<3||cy<3?5:cx>61||cy>61?-4:0,value=grout?82:116+hash(Math.floor((u+(row%2)*32)/64),row,193)*11+fine*.4+edge;rgb=[value*.95,value,value*.98];}
  else if(kind==='floor'){const weave=((Math.floor(u)%2)^(Math.floor(v)%2))?2:-2,wear=(broad-.5)*5,grain=fine+weave+wear;rgb=neutral?[97+grain,99+grain,97+grain]:[110+grain,99+grain,69+grain];}
  else {const seam=u<1.3||v<1.3,lip=u<3||v<3?5:0,value=(seam?116:181)+fine*.55+lip+(broad-.5)*3;rgb=neutral?[value,value+1,value-2]:[value+3,value+1,value-15];}
  for(let k=0;k<3;k++)data[i+k]=rgb[k];data[i+3]=255;
 }
 return {width:size,height:size,data};
}
export function materialSet(level,size=SURFACE_SIZE){return Object.fromEntries(['wall','floor','ceiling'].map(k=>[k,surfacePixels(k,level,size)]))}
export class SurfaceBank{
 constructor(){this.cache=new Map();this.pending=new Map();this.timers=new Set();this.closed=false;this.worker=null;
  try{if(typeof Worker==='function'){this.worker=new Worker(new URL('./material-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=e=>this.finish(e.data.level,e.data.maps);this.worker.onerror=()=>{this.worker?.terminate();this.worker=null;for(const level of this.pending.keys())this.fallback(level)};}}catch{this.worker=null}
 }
 preview(level){return this.cache.get(level)||materialSet(level,64)}
 request(level){if(this.closed)return Promise.resolve(null);if(this.cache.has(level)){const maps=this.cache.get(level);this.cache.delete(level);this.cache.set(level,maps);return Promise.resolve(maps)}if(this.pending.has(level))return this.pending.get(level).promise;
  let resolve;const promise=new Promise(r=>resolve=r);this.pending.set(level,{resolve,promise});if(this.worker)this.worker.postMessage({level});else this.fallback(level);return promise;
 }
 fallback(level){if(this.closed||!this.pending.has(level))return;const timer=setTimeout(()=>{this.timers.delete(timer);if(!this.closed&&this.pending.has(level))this.finish(level,materialSet(level))},0);this.timers.add(timer)}
 finish(level,maps){if(this.closed||!this.pending.has(level))return;this.cache.set(level,maps);while(this.cache.size>SURFACE_CACHE)this.cache.delete(this.cache.keys().next().value);this.pending.get(level).resolve(maps);this.pending.delete(level)}
 destroy(){this.closed=true;this.worker?.terminate();for(const timer of this.timers)clearTimeout(timer);this.timers.clear();for(const p of this.pending.values())p.resolve(null);this.pending.clear();this.cache.clear()}
}
