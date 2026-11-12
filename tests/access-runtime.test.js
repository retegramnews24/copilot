import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const dir=await mkdtemp(join(tmpdir(),'access-review-')),bot='isolated-security-test';
const mac=(k,v)=>createHmac('sha256',k).update(v).digest('hex');
const token=(id,expires=Date.now()+3600000)=>{const payload=Buffer.from(JSON.stringify({user:{id:String(id),player:'tg:'+id,name:'Member '+id},expires,accessTag:mac(bot,'telegram-session-v1')})).toString('base64url');return 'session.'+payload+'.'+mac(bot,'session.'+payload)};
const denied=new Set([900]),sockets=[];
// Test-only fixture controls never enter the deployment bundle.
const entry=`import worker,{Room} from ${JSON.stringify(resolve('worker.js'))};import {membershipCache} from ${JSON.stringify(resolve('simulator/server.js'))};export default worker;export class TestRoom extends Room {async fetch(req){const path=new URL(req.url).pathname;if(path==='/__peers')return Response.json(this.ctx.getWebSockets().map(ws=>({state:ws.readyState,...ws.deserializeAttachment()})));if(path==='/__expire'){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a.memberId==='77')ws.serializeAttachment({...a,expires:0})}return Response.json({ok:true})}if(path==='/__clear'){membershipCache.clear();return Response.json({ok:true})}return super.fetch(req)}}`;
await writeFile(join(dir,'entry.js'),entry);
await build({entryPoints:[join(dir,'entry.js')],outfile:join(dir,'worker.js'),bundle:true,format:'esm',external:['cloudflare:workers'],platform:'browser',plugins:[{name:'test-cache-control',setup(b){b.onLoad({filter:/simulator\/server\.js$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('const membershipCache=new Map();','export const membershipCache=new Map();'),loader:'js'}))}}]});
const conf={rootPath:dir,modulesRoot:dir,modules:true,scriptPath:join(dir,'worker.js'),compatibilityDate:'2026-11-04',durableObjects:{ROOMS:{className:'TestRoom',useSQLite:true}},bindings:{BOT_TOKEN:bot},outboundService:async req=>{const b=await req.json();if(b.user_id===901)return Response.json({ok:false},{status:503});return Response.json({ok:true,result:{status:denied.has(b.user_id)?'left':b.user_id===902?'restricted':'member',is_member:false}})}};
const mf=new Miniflare(convertV4MiniflareOptions(conf));
const call=async(id,path,body,extra={})=>mf.dispatchFetch('https://unit.test'+path,{method:body===undefined?'GET':'POST',headers:{...(id?{Authorization:'Bearer '+token(id)}:{}),'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
try{
 const uuid='11111111-1111-4111-8111-111111111111';
 const routes=['/api/simulator/state','/api/lobby','/api/leaderboard','/api/room/'+uuid+'/state','/api/room/'+uuid+'/replay','/api/golf/'+uuid+'/state','/api/moto-trial/'+uuid+'/state','/api/pong/'+uuid+'/state','/api/labyrinth/'+uuid+'/state','/api/cinema/youtube','/api/cinema/group/media/'+uuid+'/'+uuid,'/api/blackboard/ws','/api/radio/now-playing'];
 for(const path of routes){assert.equal((await call(null,path,undefined,{'X-Checkmate-User':'{"id":"1","player":"tg:1"}'})).status,401,path);assert.equal((await call(900,path)).status,403,path)}
 for(const id of [901,902])assert.equal((await call(id,'/api/simulator/state')).status,id===901?503:403);
 assert.equal((await call(null,'/api/simulator/state',undefined,{Authorization:'Bearer '+token(1,Date.now()-1)})).status,401);
 const forged=token(1).slice(0,-1)+'x';assert.equal((await call(null,'/api/simulator/state',undefined,{Authorization:'Bearer '+forged})).status,401);
 assert.equal((await call(1,'/api/simulator/state',undefined,{Origin:'https://attacker.test'})).status,403);
 await call(1,'/api/simulator/action',{action:'create'});await call(2,'/api/simulator/action',{action:'create'});
 await call(1,'/api/simulator/action',{action:'identity',team:'2',name:'Only mine',count:1,colors:['#123456','#123456','#123456']},{'X-Checkmate-User':'{"id":"2","player":"tg:2"}'});
 const other=await(await call(2,'/api/simulator/state')).json();assert.notEqual(other.me.name,'Only mine');assert(!('cash' in other.teams.find(t=>t.id==='1')));
 const chatted=await call(3,'/api/simulator/action',{action:'chat',text:'Member without a team',requestId:'no-team-chat'});assert.equal(chatted.status,200);assert.equal((await(await call(2,'/api/simulator/state')).json()).chat.at(-1).sender,'3');
 const made=await(await call(10,'/api/create',{game:'uno'})).json(),room=made.state.room;let joined=await(await call(11,'/api/room/'+room+'/claim',{})).json();assert.equal((await call(10,'/api/room/'+room+'/start',{revision:joined.state.revision})).status,200);
 const spectated=await(await call(12,'/api/room/'+room+'/state')).json();assert.deepEqual(spectated.uno.hand,[]);assert.equal((await call(12,'/api/room/'+room+'/move',{revision:spectated.revision,action:'draw'})).status,403);assert.deepEqual((await(await call(12,'/api/room/'+room+'/replay')).json()).frames,[]);
 async function connect(id){const r=await call(id,'/api/lobby/ws',undefined,{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id),'X-Session-Expires':'999999999999999'});assert.equal(r.status,101);const ws=r.webSocket;const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('no initial socket packet')),2000);ws.addEventListener('message',()=>{clearTimeout(timer);resolve()},{once:true})});ws.accept();sockets.push(ws);await ready;return ws}
 const expired=await connect(77);
 const ns=await mf.getDurableObjectNamespace('ROOMS'),stub=ns.get(ns.idFromName('checkmate-lobby-v1'));
 const peers=async()=>await(await stub.fetch('https://internal/__peers')).json();
 assert((await peers()).some(a=>a.memberId==='77'&&a.expires<Date.now()+3700000),'client expiry header must be overwritten');
 await stub.fetch('https://internal/__expire');await call(1,'/api/lobby');assert(!(await peers()).some(a=>a.memberId==='77'),'expired passive socket must be removed from recipients');expired.close();
 const revoked=await connect(78);denied.add(78);await stub.fetch('https://internal/__clear');await call(1,'/api/lobby');assert(!(await peers()).some(a=>a.memberId==='78'),'revoked passive socket must be removed from recipients');revoked.close();assert.equal((await call(78,'/api/simulator/state')).status,403);
 console.log('PASS access review: 13 routes reject forged/outsider access, expired sessions, unavailable membership, origin, foreign team/header forgery, spectator privacy/actions/replay, chat before team creation, expired/revoked passive sockets.');
}finally{for(const ws of sockets)try{ws.close()}catch{}await mf.dispose();await rm(dir,{recursive:true,force:true})}
