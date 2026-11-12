import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {initial,act,advance,refreshMarket} from '../simulator/engine.js';
const dir=await mkdtemp(join(tmpdir(),'simulator-runtime-')),bot='synthetic-test-only';
const mac=(k,v)=>createHmac('sha256',k).update(v).digest('hex');
const token=id=>{const payload=Buffer.from(JSON.stringify({user:{id:String(id),player:'tg:'+id,name:'Test '+id},expires:Date.now()+3600000,accessTag:mac(bot,'telegram-session-v1')})).toString('base64url');return 'session.'+payload+'.'+mac(bot,'session.'+payload)};
// Test hooks are built only into this temporary test bundle, never the deployed worker.
const entry=`import worker,{Room} from ${JSON.stringify(resolve('worker.js'))};import {SimulatorLeague} from ${JSON.stringify(resolve('simulator/server.js'))};export default worker;export class TestRoom extends Room{async fetch(req){const p=new URL(req.url).pathname;const league=new SimulatorLeague(this.ctx);if(p==='/__test-seed'){const s=await req.json();await this.ctx.storage.transaction(tx=>league.save(tx,s,Date.now()));return Response.json({ok:true})}if(p==='/__test-inspect'){return Response.json(await league.load(this.ctx.storage,Date.now()))}return super.fetch(req)}}`;
await writeFile(join(dir,'entry.js'),entry);await build({entryPoints:[join(dir,'entry.js')],outfile:join(dir,'worker.js'),bundle:true,format:'esm',external:['cloudflare:workers'],platform:'browser'});
const conf={rootPath:dir,modulesRoot:dir,modules:true,scriptPath:join(dir,'worker.js'),compatibilityDate:'2026-11-04',durableObjects:{ROOMS:{className:'TestRoom',useSQLite:true}},resourcePersistencePath:join(dir,'storage'),bindings:{BOT_TOKEN:bot},outboundService:async req=>{assert(new URL(req.url).pathname.endsWith('/getChatMember'));const b=await req.json();assert.equal(b.chat_id,'-1001803941686');return Response.json({ok:true,result:{status:b.user_id===999?'left':'member'}})}};
let mf=new Miniflare(convertV4MiniflareOptions(conf));
async function call(id,body){const res=await mf.dispatchFetch('https://test/api/simulator/'+(body?'action':'state'),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token(id),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,value:await res.json()}}
try{
assert.equal((await mf.dispatchFetch('https://test/api/simulator/state',{headers:{'X-Checkmate-User':'{"id":"1"}'}})).status,401);
assert.equal((await call(999)).status,403);
assert.equal((await mf.dispatchFetch('https://test/api/simulator/state',{headers:{Authorization:'Bearer '+token(1),Origin:'https://other.test'}})).status,403);
// Login uses fresh signed Telegram data; refresh relies on an unexpired session.
const initData=(id,age=0)=>{const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)-age),user:JSON.stringify({id,first_name:'Test'})});const checked=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',mac(Buffer.from(mac('WebAppData',bot),'hex'),checked));return p.toString()};
const login=async(id,age=0)=>mf.dispatchFetch('https://test/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:initData(id,age)})});
assert.equal((await login(1)).status,200);assert.equal((await login(999)).status,403);assert.equal((await login(1,600)).status,401);
assert.equal((await mf.dispatchFetch('https://test/api/session/refresh',{method:'POST',headers:{Authorization:'Bearer '+token(1)}})).status,200);
assert.equal((await mf.dispatchFetch('https://test/api/lobby/list',{headers:{Authorization:'Bearer '+token(999)}})).status,403);
assert.equal((await mf.dispatchFetch('https://test/api/telegram/setup',{method:'POST',body:JSON.stringify({token:bot})})).status,404);
assert.equal((await mf.dispatchFetch('https://test/api/telegram/webhook',{method:'POST',body:'{}'})).status,403);
await call(1,{action:'create'});await call(2,{action:'create'});const state=(await call(1)).value;const offer=state.market.find(o=>o.role==='driver'&&o.tier===1);const replies=await Promise.all([call(1,{action:'hire',offer:offer.id,slot:0}),call(2,{action:'hire',offer:offer.id,slot:0})]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);const winner=replies[0].status===200?1:2;const livrea={action:'identity',name:'Livrea persistente',count:3,colors:['#123456','#abcdef','#fedcba']};assert.equal((await call(winner,livrea)).status,200);const before=(await call(winner)).value.me;const bad=await call(winner,{action:'identity',name:'Must rollback',colors:['oops'],count:2});assert.equal(bad.status,400);assert.equal((await call(winner)).value.me.name,before.name);
await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(conf));assert.deepEqual((await call(winner)).value.me.colors,before.colors);assert.equal((await call(winner)).value.me.count,3);assert.equal((await call(winner)).value.me.cash,before.cash);assert.equal((await call(winner)).value.me.drivers[0].name,offer.name);
const now=Date.now(),s=initial(now);for(const id of ['1','2']){const u={id,name:'Test '+id};act(s,u,{action:'create'},now);refreshMarket(s,now);for(const [role,slot] of [['driver',0],['driver',1],['motor',0],['aero',0],['mechanic',0],['engine',0]]){const offer=s.offers.find(o=>o.role===role&&o.tier===1&&!o.sold);act(s,u,{action:'hire',offer:offer.id,slot},now)}s.teams[id].enrolled=true}s.schedule={dates:Array.from({length:13},(_,i)=>now+i*86400000),participants:['1','2']};advance(s,now);for(const c of s.race.cars){c.progress=23.999;c.fuel=50;c.wear=100}s.race.last=now-10000;
const ns=await mf.getDurableObjectNamespace('ROOMS');const stub=ns.get(ns.idFromName('binotto-simulator-league-v1'));await stub.fetch('https://internal/__test-seed',{method:'POST',body:JSON.stringify(s)});
await new Promise(r=>setTimeout(r,3500));const done=await (await stub.fetch('https://internal/__test-inspect')).json();assert.equal(done.round,1);assert.equal(done.race.active,false);assert.equal(done.results.length,1);const cash=done.teams['1'].cash;
await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(conf));assert.equal((await call(1)).value.me.cash,cash);assert.equal((await call(1)).value.results.length,1);
// A real Durable Object alarm must return a disconnected qualifying car to the pits.
const qNow=Date.now(),qs=structuredClone(done);qs.round=0;qs.race=null;qs.sessions=null;qs.schedule={dates:[qNow+20*60000],participants:['1','2']};advance(qs,qNow);act(qs,{id:'1'},{action:'session-start',mode:'qualifying',slot:0},qNow);qs.sessions.qualifying.cars[0].seen=qNow-9000;
const qns=await mf.getDurableObjectNamespace('ROOMS'),qstub=qns.get(qns.idFromName('binotto-simulator-league-v1'));await qstub.fetch('https://internal/__test-seed',{method:'POST',body:JSON.stringify(qs)});await new Promise(r=>setTimeout(r,1600));const timedOut=await(await qstub.fetch('https://internal/__test-inspect')).json();assert.equal(timedOut.sessions.qualifying.cars[0].onTrack,false);
// Practice pause survives an actual SQLite restart, without polling to keep it alive.
const pNow=Date.now(),ps=structuredClone(done);ps.round=0;ps.race=null;ps.schedule={dates:[pNow+2*86400000],participants:['1','2']};ps.sessions=null;advance(ps,pNow-5000);act(ps,{id:'1'},{action:'session-start',mode:'practice',slot:0},pNow-5000);advance(ps,pNow-3000);act(ps,{id:'1'},{action:'presence',visible:false},pNow-3000);await qstub.fetch('https://internal/__test-seed',{method:'POST',body:JSON.stringify(ps)});await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(conf));assert.equal((await call(1)).value.sessions.practice.remaining,1798000);
console.log('PASS workerd sessions: real qualifying timeout alarm, paused practice budget survives SQLite restart.');
console.log('PASS workerd + SQLite: authenticated member access, forged/outsider rejection, competing purchase, rollback, persistent restart, actual unattended alarm, no duplicate payout.');
}finally{await mf.dispose();await rm(dir,{recursive:true,force:true})}
