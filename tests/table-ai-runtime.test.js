import {chooseAction} from '../table-ai.js';
import {randomFleet} from '../public/naval-data.js';
// Run after Wrangler --dry-run; uses workerd and SQLite Durable Objects, never production.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const directory=await mkdtemp(join(tmpdir(),'binottoland-test-')),bot='synthetic-test-bot';
const mac=(k,v)=>createHmac('sha256',k).update(v).digest('hex');
const token=id=>{const user={id:String(id),player:'tg:'+id,name:'Test '+id},payload=Buffer.from(JSON.stringify({user,expires:Date.now()+3600000,accessTag:mac(bot,'telegram-session-v1')})).toString('base64url');return 'session.'+payload+'.'+mac(bot,'session.'+payload)};
const options=convertV4MiniflareOptions({rootPath:dirname(resolve(process.argv[2]||'/tmp/labyrinth-multi-bundle/worker.js')),modulesRoot:dirname(resolve(process.argv[2]||'/tmp/labyrinth-multi-bundle/worker.js')),modules:true,scriptPath:resolve(process.argv[2]||'/tmp/labyrinth-multi-bundle/worker.js'),compatibilityDate:'2026-11-04',durableObjects:{ROOMS:{className:'Room',useSQLite:true}},resourcePersistencePath:directory,bindings:{BOT_TOKEN:bot}});let mf=new Miniflare(options);const sockets=[];
async function call(id,path,body){const res=await mf.dispatchFetch('https://unit.test'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token(id),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,data:await res.json()}}
function until(client,predicate){const existing=client.packets.find(predicate);if(existing)return Promise.resolve(existing);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{client.waiters=client.waiters.filter(w=>w!==check);reject(Error('Timed out waiting for server packet'))},7000);function check(p){if(predicate(p)){clearTimeout(timer);client.waiters=client.waiters.filter(w=>w!==check);resolve(p)}}client.waiters.push(check)})}
async function connect(id,room,watch=false){const res=await mf.dispatchFetch('https://unit.test/api/labyrinth/'+room+'/ws'+(watch?'?watch=1':''),{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id)}});assert.equal(res.status,101);const ws=res.webSocket,c={ws,packets:[],waiters:[]};ws.addEventListener('message',event=>{const p=JSON.parse(event.data);c.packets.push(p);for(const fn of [...c.waiters])fn(p)});ws.accept();sockets.push(ws);await until(c,p=>p.type==='state');return c}

try{
 let user=1000;
 for(const mode of ['ai','tutorial'])for(const game of ['chess','checkers','connect4','uno','scarabeo','scopa','naval','briscola','briscola5']){
  const uid=user++,made=await call(uid,'/api/create',{game,mode,seats:game==='briscola5'?5:game==='uno'?8:2});assert.equal(made.status,200,JSON.stringify(made));const room=made.data.state.room;let s=made.data.state;assert.equal(s.phase,'playing');assert.equal(s.mode,mode);assert.ok(s.players.slice(1).every(p=>p.bot));assert.equal((await call(9999,'/api/room/'+room+'/claim',{})).status,409);
  const watch=(await call(9999,'/api/room/'+room+'/state')).data;assert.equal(watch.tutorial,null);for(const key of ['uno','scopa','briscola'])if(watch[key])assert.deepEqual(watch[key].hand,[]);if(watch.scarabeo)assert.deepEqual(watch.scarabeo.rack,[]);if(watch.naval)assert.equal(watch.naval.fleet,null);
  const response=await mf.dispatchFetch('https://unit.test/api/room/'+room+'/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(uid)}});assert.equal(response.status,101);const c={ws:response.webSocket,packets:[],waiters:[]};c.ws.addEventListener('message',e=>{const p=JSON.parse(e.data);c.packets.push(p);for(const fn of [...c.waiters])fn(p)});c.ws.accept();sockets.push(c.ws);await until(c,p=>p.room===room);
  if(s.turn!==0)s=await until(c,p=>p.turn===0&&p.revision>s.revision);
  s=(await call(uid,'/api/room/'+room+'/state')).data;const v=s.naval||s.briscola||s[game]||s.chess;if(mode==='tutorial'){assert.ok(s.tutorial.text);assert.ok(s.tutorial.action)}const a=chooseAction(game,v,0);let moved=await call(uid,'/api/room/'+room+'/move',{...a,revision:s.revision});assert.equal(moved.status,200,game+' '+JSON.stringify(moved));
  const before=moved.data.revision;if(game==='scarabeo')await until(c,p=>p.revision>before);else if(moved.data.turn!==0||game==='naval'&&!moved.data.naval.ready[1])await until(c,p=>p.revision>before);
  const latest=(await call(uid,'/api/room/'+room+'/state')).data;assert.ok(latest.revision>=before);console.log('PASS runtime solo',mode,game);
 }
 // Four-seat human Scopa, atomic private projections and join bounds.
 const four=await call(3000,'/api/create',{game:'scopa'}),fourRoom=four.data.state.room;assert.equal(four.status,200);for(let i=1;i<4;i++)assert.equal((await call(3000+i,'/api/room/'+fourRoom+'/claim',{})).status,200);assert.equal((await call(3004,'/api/room/'+fourRoom+'/claim',{})).status,409);let fourState=(await call(3000,'/api/room/'+fourRoom+'/state')).data;fourState=(await call(3000,'/api/room/'+fourRoom+'/start',{revision:fourState.revision})).data;assert.equal(fourState.scopa.hand.length,3);assert.equal(fourState.scopa.table.length,4);assert.deepEqual((await call(3999,'/api/room/'+fourRoom+'/state')).data.scopa.hand,[]);const take=fourState.scopa.legalMoves[0];assert.equal((await call(3001,'/api/room/'+fourRoom+'/move',{...take,revision:fourState.revision})).status,403);assert.equal((await call(3000,'/api/room/'+fourRoom+'/move',{...take,revision:fourState.revision})).status,200);
 // Complete real two-player result, deduplication, deletion and persistence.
 let made=await call(2000,'/api/create',{game:'connect4'}),r=made.data.state.room,s=(await call(2001,'/api/room/'+r+'/claim',{})).data.state;
 for(const column of [0,0,1,1,2,2,3]){const result=await call(s.turn===0?2000:2001,'/api/room/'+r+'/move',{column,revision:s.revision});assert.equal(result.status,200);s=result.data}
 for(let i=0;i<3;i++)await call(2000,'/api/room/'+r+'/state');let leaders=(await call(2000,'/api/leaderboard')).data.leaders;assert.equal(leaders.find(p=>p.id==='tg:2000').wins,1);assert.equal(leaders.find(p=>p.id==='tg:2000').games.connect4,1);assert.ok(!leaders.some(p=>p.id.startsWith('bot:')));
 assert.equal((await call(2002,'/api/room/'+r+'/rematch',{revision:s.revision})).status,403);
 const again=await call(2000,'/api/room/'+r+'/rematch',{revision:s.revision});
 assert.equal(again.status,200,JSON.stringify(again));
 assert.equal(again.data.state.phase,'waiting');
 assert.equal(again.data.state.mode,'people');
 assert.equal(again.data.state.room,r);
 assert.equal(again.data.state.game,'connect4');
 assert.deepEqual(again.data.state.moves,[]);
 assert.equal(again.data.state.players.length,1);
 assert.ok(again.data.state.matchId);
 const replay=(await call(2000,'/api/room/'+r+'/replay')).data;
 assert.equal(replay.frames.length,1);
 assert.equal((await call(2000,'/api/room/'+r+'/rematch',{revision:s.revision})).status,409);
 let second=(await call(2001,'/api/room/'+r+'/claim',{})).data.state;
 for(const column of [0,0,1,1,2,2,3]){
  second=(await call(second.turn===0?2000:2001,'/api/room/'+r+'/move',{column,revision:second.revision})).data;
 }
 assert.equal((await call(2000,'/api/room/'+r+'/delete',{revision:second.revision})).status,200);
 leaders=(await call(2000,'/api/leaderboard')).data.leaders;
 assert.equal(leaders.find(p=>p.id==='tg:2000').wins,2);
 const solo=(await call(2100,'/api/create',{game:'scopa',mode:'tutorial',seats:4})).data.state;
 const finished=(await call(2100,'/api/room/'+solo.room+'/finish',{revision:solo.revision})).data;
 const soloAgain=await call(2100,'/api/room/'+solo.room+'/rematch',{revision:finished.revision});
 assert.equal(soloAgain.status,200);
 assert.equal(soloAgain.data.state.phase,'playing');
 assert.equal(soloAgain.data.state.mode,'tutorial');
 assert.equal(soloAgain.data.state.players.filter(p=>p.bot).length,3);

 for(const ws of sockets)try{ws.close()}catch{}await mf.dispose();mf=new Miniflare(options);leaders=(await call(2000,'/api/leaderboard')).data.leaders;assert.equal(leaders.find(p=>p.id==='tg:2000').wins,2);assert.equal((await call(2000,'/api/leaderboard?mode=ai')).data.leaders.some(p=>p.id==='tg:2000'),false);
 assert.equal((await call(2000,'/api/create',{game:'cluedo'})).status,400);assert.equal((await call(2000,'/api/create',{game:'scopa',mode:'invalid'})).status,400);assert.equal((await call(2002,'/api/create',{game:'scopa',mode:'ai',target:3})).status,400);
 console.log('PASS ranking runtime: authenticated result, HTTP deduplication, deletion survival, SQLite restart, AI isolation, Cluedo removed, solo tournament rejected.');
}finally{for(const ws of sockets)try{ws.close()}catch{}await mf.dispose();await rm(directory,{recursive:true,force:true})}
