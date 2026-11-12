// Safe stylised pit corridors, in the same 1000x650 coordinate system as the track.
// Entry/exit intentionally join the circuit; the service lane must never cross it.
import { shapes, position } from "./geometry.js";
function distance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    f = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p[0] - a[0] - dx * f, p[1] - a[1] - dy * f);
}
export const trackPoint = (f, pts) => {
  const p = position(f, pts);
  return [p[0] * 1000, p[1] * 650, p[2]];
};
export function clearance(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++)
    best = Math.min(best, distance(p, pts[i], pts[(i + 1) % pts.length]));
  return best;
}
// Individually traced against the official pit-lane drawings listed in docs/circuit-pits.md.
// Coordinates are schematic, with fixed entry/exit and garage anchors; no free-space search.
const definitions = [
  {name:'Spa', phase:0, entry:-.049, exit:.082, lane:[[700,232],[727,217],[803,155],[832,132],[840,132],[842,140],[837,161]], garage:[[749,217],[795,180]]},
  {name:'Monza', phase:0, entry:-.12, exit:.085, lane:[[166,120],[235,122],[420,132],[510,133]], garage:[[265,139],[425,147]]},
  {name:'Imola', phase:0, entry:-.075, exit:.115, lane:[[755,131],[602,132],[528,112],[466,110],[420,115]], garage:[[600,115],[700,115]]},
  {name:'Suzuka', phase:0, entry:-.085, exit:.055, lane:[[490,509],[466,524],[420,529],[230,541],[190,544]], garage:[[265,526],[420,515]]},
  {name:'Canada', phase:0, entry:-.063, exit:.18, lane:[[412,418],[349,451],[245,505],[159,547],[124,561],[92,566],[69,557],[57,537],[55,514],[59,483]], garage:[[245,524],[351,469]]},
  {name:'Melbourne', phase:0, entry:-.118, exit:.04, lane:[[192,361],[190,344],[205,324],[254,299],[364,241],[419,209]], garage:[[255,317],[366,258]]},
  {name:'Barcellona', phase:0, entry:-.115, exit:.135, lane:[[871,513],[850,531],[819,535],[736,510],[594,466],[340,387],[223,351]], garage:[[468,410],[642,465]]},
  {name:'Silverstone', phase:0, entry:-.14, exit:.062, lane:[[831,184],[854,211],[868,261],[883,343],[897,403],[894,423]], garage:[[864,303],[879,389]]},
  {name:'Hockenheim', phase:0, entry:-.075, exit:.048, lane:[[104,492],[112,468],[128,385],[145,296],[148,243]], garage:[[141,382],[157,306]]},
  {name:'Nürburgring', phase:0, entry:-.085, exit:.095, lane:[[888,473],[902,512],[897,522],[887,524],[861,506],[782,448],[650,351],[609,321]], garage:[[713,380],[794,440]]},
  {name:'Interlagos', phase:0, entry:-.045, exit:.155, lane:[[429,147],[371,181],[245,245],[182,281],[167,300],[170,321],[175,345],[168,393],[160,432],[172,465]], garage:[[241,264],[372,198]]},
  {name:'Red Bull Ring', phase:0, entry:-.10, exit:.095, lane:[[114,458],[148,402],[239,277],[333,147],[352,121],[363,116]], garage:[[220,333],[276,257]]},
  {name:'Monaco', phase:.70, entry:.593, exit:.815, width:3, garageSize:4, lane:[[114,506],[103,478],[111,438],[127,390],[146,332],[168,278],[196,227],[231,185],[254,169]], garage:[[115,401],[133,347]], garageSide:-1},
];
const cache = new Map();
function sample(points, count=100) {
  const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  return Array.from({length:count+1},(_,j)=>{const d=lengths.at(-1)*j/count;let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;const u=(d-lengths[i-1])/(lengths[i]-lengths[i-1]||1);return points[i-1].map((v,k)=>v+(points[i][k]-v)*u)});
}
export function pitLayout(idx) {
  if(cache.has(idx))return cache.get(idx);
  const d=definitions[idx];if(!d)throw Error('Unknown circuit');
  const lane=sample([trackPoint(d.entry,shapes[idx]).slice(0,2),...d.lane,trackPoint(d.exit,shapes[idx]).slice(0,2)]);
  const [a,b]=d.garage,angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const layout={...d,lane,garage:sample(d.garage,7),angle,side:d.garageSide||1,width:d.width||5,garageSize:d.garageSize||7};cache.set(idx,layout);return layout;
}
export function pitPosition(idx,t) {
  const p=pitLayout(idx),f=Math.max(0,Math.min(1,t))*(p.lane.length-1),i=Math.min(p.lane.length-2,Math.floor(f)),a=p.lane[i],b=p.lane[i+1],u=f-i;
  return [(a[0]+(b[0]-a[0])*u)/1000,(a[1]+(b[1]-a[1])*u)/650,Math.atan2(b[1]-a[1],b[0]-a[0])];
}
