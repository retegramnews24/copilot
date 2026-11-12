export const POINTS=[25,18,15,12,10,8,6,4,2,1];
export const TEAM_PRIZES=[2000000,1500000,1200000,1000000,800000,600000,500000,400000,300000,200000];
export const DRIVER_PRIZES=TEAM_PRIZES.map(n=>n/2);
const driverKey=r=>r.team+':'+(r.driverId||r.name);
function rank(rows){return rows.sort((a,b)=>{if(a.points!==b.points)return b.points-a.points;for(let p=1;p<=128;p++){const diff=(b.finishes[p]||0)-(a.finishes[p]||0);if(diff)return diff}return a.id.localeCompare(b.id)}).map((r,i)=>({...r,position:i+1}));}
export function standings(s,live=false){const teams=new Map(),drivers=new Map();
 const addTeam=id=>{if(!teams.has(id))teams.set(id,{id,name:s.teams[id]?.name||id,points:0,confirmed:0,finishes:{},starts:0});return teams.get(id)};
 const addDriver=r=>{const id=driverKey(r);if(!drivers.has(id))drivers.set(id,{id,driverId:r.driverId||r.name,name:r.name,team:r.team,teamName:r.teamName||addTeam(r.team).name,points:0,confirmed:0,finishes:{},starts:0});return drivers.get(id)};
 for(const id of s.schedule?.participants||Object.values(s.teams).filter(t=>t.enrolled).map(t=>t.id)){const t=s.teams[id];if(!t)continue;addTeam(id);for(const d of t.drivers)if(d)addDriver({team:id,name:d.name,driverId:d.id||d.name,teamName:t.name})}
 for(const race of s.results.filter(r=>r.season===s.season)){const started=new Set();for(const row of race.rows){const r={...row,driverId:row.driverId||s.teams[row.team]?.drivers.find(d=>d?.name===row.name)?.id||row.name};const d=addDriver(r),t=addTeam(r.team);d.points+=r.points;d.confirmed+=r.points;d.starts++;t.points+=r.points;t.confirmed+=r.points;d.finishes[r.position]=(d.finishes[r.position]||0)+1;t.finishes[r.position]=(t.finishes[r.position]||0)+1;if(!started.has(t.id)){t.starts++;started.add(t.id)}}}
 if(live&&s.race?.active){const ordered=[...s.race.cars].sort((a,b)=>(a.dnf-b.dnf)||(a.finished&&b.finished?a.finished-b.finished:b.progress-a.progress));for(const [i,c] of ordered.entries()){const points=c.dnf?0:POINTS[i]||0;addDriver({...c,driverId:c.driverId||s.teams[c.team]?.drivers[c.slot]?.id||c.name}).points+=points;addTeam(c.team).points+=points}}
 return {provisional:!!live&&!!s.race?.active,drivers:rank([...drivers.values()]),teams:rank([...teams.values()])};
}
export function archiveChampionship(s,now){if(s.round<13||s.race?.active)return;s.championships??=[];if(s.championships.some(a=>a.season===s.season))return;const table=standings(s);const payouts={};for(const [kind,prizes] of [['teams',TEAM_PRIZES],['drivers',DRIVER_PRIZES]]){const eligible=table[kind].filter(r=>r.starts>0);for(const [i,row] of eligible.entries()){row.reward=prizes[i]||0;const team=kind==='teams'?row.id:row.team;payouts[team]=(payouts[team]||0)+row.reward;}}
 for(const [id,amount] of Object.entries(payouts))if(s.teams[id])s.teams[id].cash+=amount;
 s.championships.unshift({season:s.season,ended:now,schedule:structuredClone(s.schedule),standings:table,payouts,results:structuredClone(s.results.filter(r=>r.season===s.season))});
 s.events.unshift({text:'Campionato '+s.season+' archiviato. Premi piloti e costruttori accreditati nella cassa unica delle scuderie.',at:now});s.events=s.events.slice(0,40);
}
