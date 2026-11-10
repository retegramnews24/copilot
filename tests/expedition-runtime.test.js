import {createNumberGame,hasMove,canMerge,mergeNumbers} from '../public/arcade/number-connect-rules.js';
import {makeCourse,ground} from '../public/moto-trial/physics.js';
import {randomFleet} from '../public/naval-data.js';
// Run after Wrangler --dry-run; uses workerd and SQLite Durable Objects, never production.
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const directory=await mkdtemp(join(tmpdir(),'binottoland-test-')),bot='synthetic-test-bot';
const mac=(k,v)=>createHmac('sha256',k).update(v).digest('hex');
const token=id=>{const user={id:String(id),player:'tg:'+id,name:'Test '+id},payload=Buffer.from(JSON.stringify({user,expires:Date.now()+3600000,accessTag:mac(bot,'telegram-session-v1')})).toString('base64url');return 'session.'+payload+'.'+mac(bot,'session.'+payload)};
const runtimeConfig={rootPath:dirname(resolve(process.argv[2]||'/tmp/labyrinth-multi-bundle/worker.js')),modulesRoot:dirname(resolve(process.argv[2]||'/tmp/labyrinth-multi-bundle/worker.js')),modules:true,scriptPath:resolve(process.argv[2]||'/tmp/labyrinth-multi-bundle/worker.js'),compatibilityDate:'2026-11-04',durableObjects:{ROOMS:{className:'Room',useSQLite:true}},resourcePersistencePath:directory,bindings:{BOT_TOKEN:bot}};
const options=convertV4MiniflareOptions(runtimeConfig);let mf=new Miniflare(options);const sockets=[];
async function call(id,path,body){const res=await mf.dispatchFetch('https://unit.test'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token(id),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,data:await res.json()}}
function until(client,predicate){const existing=client.packets.find(predicate);if(existing)return Promise.resolve(existing);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{client.waiters=client.waiters.filter(w=>w!==check);reject(Error('Timed out waiting for server packet'))},7000);function check(p){if(predicate(p)){clearTimeout(timer);client.waiters=client.waiters.filter(w=>w!==check);resolve(p)}}client.waiters.push(check)})}
async function connect(id,room,watch=false,game='labyrinth'){const res=await mf.dispatchFetch('https://unit.test/api/'+game+'/'+room+'/ws'+(watch?'?watch=1':''),{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id)}});assert.equal(res.status,101);const ws=res.webSocket,c={ws,packets:[],waiters:[]};ws.addEventListener('message',event=>{const p=JSON.parse(event.data);c.packets.push(p);for(const fn of [...c.waiters])fn(p)});ws.accept();sockets.push(ws);await until(c,p=>p.type==='state');return c}
try{
 const unauth=await mf.dispatchFetch('https://unit.test/api/labyrinth/00000000-0000-4000-8000-000000000000/state',{headers:{'X-Checkmate-User':JSON.stringify({id:'1'})}});assert.equal(unauth.status,401);
 const telegramData=new URLSearchParams({
  auth_date:String(Math.floor(Date.now()/1000)),
  user:JSON.stringify({id:1,first_name:'Test 1'})
 });
 const telegramKey=createHmac('sha256','WebAppData').update(bot).digest();
 const signedFields=[...telegramData].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>key+'='+value).join('\n');
 telegramData.set('hash',mac(telegramKey,signedFields));
 const login=await call(1,'/api/session',{initData:telegramData.toString()});
 assert.equal(login.status,200);
 assert.equal(login.data.user.player,'tg:1');
 const lobby=await mf.dispatchFetch('https://unit.test/api/lobby',{headers:{Authorization:'Bearer '+login.data.token}});
 assert.equal(lobby.status,200);
 telegramData.set('user',JSON.stringify({id:2,first_name:'Test 2'}));
 assert.equal((await call(1,'/api/session',{initData:telegramData.toString()})).status,401);
 const made=await call(1,'/api/create',{game:'labyrinth'});assert.equal(made.status,200);const room=made.data.state.room;assert.equal(made.data.state.players.length,1);for(let i=2;i<=4;i++)assert.equal((await call(i,'/api/labyrinth/'+room+'/join',{})).status,200);
 const clients=[];for(let i=1;i<=4;i++)clients.push(await connect(i,room));await until(clients[0],p=>p.type==='state'&&p.state.players.filter(p=>p.online).length===4);
 const watcher=await connect(5,room,true);const latest=(await call(1,'/api/labyrinth/'+room+'/state')).data.state;assert.equal(latest.players.length,4);assert.equal(latest.cases.length,4);
 watcher.ws.send(JSON.stringify({type:'action',request:1,kind:'pickup',item:'key:1'}));const denied=await until(watcher,p=>p.type==='ack'&&p.request===1);assert.equal(denied.ok,false);
 const origin=latest.players.find(p=>p.id==='1').player;clients[0].ws.send(JSON.stringify({type:'pose',seq:1,x:origin.x+.08,z:origin.z,yaw:0,pitch:0,height:0}));clients[0].ws.send(JSON.stringify({type:'action',request:3,kind:'appearance',appearance:{shirt:'#cf514d',shorts:'#529766'}}));await until(clients[0],p=>p.type==='ack'&&p.request===3&&p.ok);assert.equal((await call(1,'/api/labyrinth/'+room+'/state')).data.state.players[0].appearance.shirt,'#cf514d');
 clients[0].ws.send(JSON.stringify({type:'pose',seq:2,x:999,z:999,yaw:0,pitch:0}));await until(clients[0],p=>p.correct===true);clients[0].ws.send(JSON.stringify({type:'action',request:4,kind:'pickup',item:'key:1'}));assert.equal((await until(clients[0],p=>p.type==='ack'&&p.request===4)).ok,false);
 const defender=latest.players.find(p=>p.id==='2').player;
 clients[0].ws.send(JSON.stringify({type:'pose',seq:3,x:origin.x+.08,z:origin.z,yaw:-Math.PI/2,pitch:0,height:0,guard:true}));
 clients[0].ws.send(JSON.stringify({type:'action',request:5,kind:'strike',weapon:'sword'}));
 const hitWhileGuarding=await until(watcher,p=>p.type==='state'&&p.state.players.find(p=>p.id==='2').health===98);
 assert.equal(hitWhileGuarding.state.players.find(p=>p.id==='1').guard,true);
 await new Promise(resolve=>setTimeout(resolve,580));
 clients[1].ws.send(JSON.stringify({type:'pose',seq:1,x:defender.x,z:defender.z,yaw:Math.PI/2,pitch:0,height:0,guard:true}));
 await until(clients[1],p=>p.type==='state'&&p.state.players.find(p=>p.id==='2').guard);
 clients[0].ws.send(JSON.stringify({type:'action',request:6,kind:'strike'}));
 const blocked=await until(clients[1],p=>p.type==='state'&&p.state.players.find(p=>p.id==='2').impact?.damage===0);
 assert.equal(blocked.state.players.find(p=>p.id==='2').health,98);
 assert.equal((await call(5,'/api/labyrinth/'+room+'/archive',{})).status,403);assert.equal((await call(1,'/api/labyrinth/'+room+'/archive',{})).status,200);await until(watcher,p=>p.type==='state'&&p.state.archived);assert.equal((await call(2,'/api/lobby')).data.games.find(g=>g.room===room).archived,true);
 for(const ws of sockets)try{ws.close()}catch{}await mf.dispose();mf=new Miniflare(options);const restored=await call(1,'/api/labyrinth/'+room+'/state');assert.equal(restored.status,200);assert.equal(restored.data.state.archived,true);assert.equal(restored.data.state.players[0].appearance.shirt,'#cf514d');assert.equal(restored.data.state.players.find(p=>p.id==='2').health,98);
 assert.equal((await call(2,'/api/labyrinth/'+room+'/delete',{})).status,200);assert.equal((await call(1,'/api/lobby')).data.games.length,0);const next=await call(1,'/api/create',{game:'labyrinth'});assert.equal(next.data.state.number,1);
 const second=await call(2,'/api/create',{game:'labyrinth'});
 assert.equal(second.data.state.number,2);
 assert.equal((await call(1,'/api/labyrinth/'+next.data.state.room+'/delete',{})).status,200);
 const replacements=await Promise.all([3,4].map(player=>call(player,'/api/create',{game:'labyrinth'})));
 assert.deepEqual(replacements.map(result=>result.data.state.number).sort(),[1,3]);
 assert.ok(replacements.every(result=>result.data.state.room!==next.data.state.room));
 assert.equal((await call(1,'/api/lobby')).data.games.find(game=>game.room===second.data.state.room).number,2);
 // Spectator presence identifies the viewed table independently from an owned game.
 const chess=await call(20,'/api/create',{game:'chess'}),dama=await call(22,'/api/create',{game:'checkers'});
 const lobbyRes=await mf.dispatchFetch('https://unit.test/api/lobby/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(21)}});assert.equal(lobbyRes.status,101);
 const spectator={ws:lobbyRes.webSocket,packets:[],waiters:[]};spectator.ws.addEventListener('message',event=>{const p=JSON.parse(event.data);spectator.packets.push(p);for(const fn of [...spectator.waiters])fn(p)});spectator.ws.accept();sockets.push(spectator.ws);
 for(const table of [chess.data.state,dama.data.state]){spectator.ws.send(JSON.stringify({type:'presence',room:table.room,away:false}));const packet=await until(spectator,p=>p.users?.some(u=>u.id==='21'&&u.viewingRoom===table.room));assert.equal(packet.users.filter(u=>u.id==='21').length,1)}
 spectator.ws.send(JSON.stringify({type:'presence',room:null,away:false}));await until(spectator,p=>p.users?.some(u=>u.id==='21'&&u.viewingRoom===null));
 spectator.ws.send(JSON.stringify({type:'presence',room:dama.data.state.room,away:true}));await until(spectator,p=>p.users&&!p.users.some(u=>u.id==='21'));
 console.log('PASS spectator presence: live chess/checkers table changes, unique identity, Lobby return and away removal.');
 const four=await call(30,'/api/create',{game:'connect4'});assert.equal(four.status,200);const fourRoom=four.data.state.room;
 assert.equal((await call(31,'/api/room/'+fourRoom+'/claim',{})).status,200);assert.equal((await call(32,'/api/room/'+fourRoom+'/claim',{})).status,409);
 const fourRes=await mf.dispatchFetch('https://unit.test/api/room/'+fourRoom+'/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(32)}});assert.equal(fourRes.status,101);const fourWatch={ws:fourRes.webSocket,packets:[],waiters:[]};fourWatch.ws.addEventListener('message',event=>{const p=JSON.parse(event.data);fourWatch.packets.push(p);for(const fn of [...fourWatch.waiters])fn(p)});fourWatch.ws.accept();sockets.push(fourWatch.ws);await until(fourWatch,p=>p.game==='connect4');
 let fourState=(await call(30,'/api/room/'+fourRoom+'/state')).data;
 assert.equal((await call(32,'/api/room/'+fourRoom+'/move',{column:0,revision:fourState.revision})).status,403);assert.equal((await call(31,'/api/room/'+fourRoom+'/move',{column:0,revision:fourState.revision})).status,403);
 assert.equal((await call(30,'/api/room/'+fourRoom+'/move',{column:7,revision:fourState.revision})).status,400);
 for(const column of [0,0,1,1,2,2,3]){const id=fourState.turn===0?30:31,res=await call(id,'/api/room/'+fourRoom+'/move',{column,revision:fourState.revision});assert.equal(res.status,200);fourState=res.data;await until(fourWatch,p=>p.revision===fourState.revision)}
 assert.equal(fourState.connect4.result,'1-0');assert.equal(fourState.phase,'finished');assert.equal((await call(30,'/api/room/'+fourRoom+'/replay')).data.frames.length,8);
 assert.equal((await call(32,'/api/room/'+fourRoom+'/archive',{revision:fourState.revision})).status,403);assert.equal((await call(30,'/api/room/'+fourRoom+'/archive',{revision:fourState.revision})).status,200);
 console.log('PASS Forza 4 runtime: create, two seats, spectator live updates/read-only permissions, turn/column validation, win, replay and archive.');
 const unoMade=await call(40,'/api/create',{game:'uno'});assert.equal(unoMade.status,200);const unoRoom=unoMade.data.state.room;
 assert.equal((await call(40,'/api/room/'+unoRoom+'/start',{revision:0})).status,409);
 for(let id=41;id<=49;id++)assert.equal((await call(id,'/api/room/'+unoRoom+'/claim',{})).status,200);
 assert.equal((await call(50,'/api/room/'+unoRoom+'/claim',{})).status,409);
 let unoState=(await call(40,'/api/room/'+unoRoom+'/state')).data;
 assert.equal((await call(41,'/api/room/'+unoRoom+'/start',{revision:unoState.revision})).status,403);
 const unoClients=[];for(const id of [40,41,50]){const res=await mf.dispatchFetch('https://unit.test/api/room/'+unoRoom+'/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id)}});assert.equal(res.status,101);const client={ws:res.webSocket,packets:[],waiters:[]};client.ws.addEventListener('message',event=>{const p=JSON.parse(event.data);client.packets.push(p);for(const fn of [...client.waiters])fn(p)});client.ws.accept();sockets.push(client.ws);unoClients.push(client)}
 assert.equal((await call(40,'/api/room/'+unoRoom+'/start',{revision:0})).status,409);
 const started=await call(40,'/api/room/'+unoRoom+'/start',{revision:unoState.revision});assert.equal(started.status,200);unoState=started.data;assert.equal(unoState.players.length,10);assert.deepEqual(unoState.uno.scores,Array(10).fill(0));
 const ids=[];for(let id=40;id<=49;id++){const view=(await call(id,'/api/room/'+unoRoom+'/state')).data.uno;assert.equal(view.hand.length,unoState.uno.counts[id-40]);ids.push(...view.hand.map(c=>c.id));assert.ok(!('deck' in view)&&!('hands' in view))}assert.equal(new Set(ids).size,unoState.uno.counts.reduce((a,b)=>a+b,0));
 const spec=(await call(50,'/api/room/'+unoRoom+'/state')).data.uno;assert.deepEqual(spec.hand,[]);assert.deepEqual(spec.legalMoves,[]);
 for(let i=0;i<unoClients.length;i++){const packet=await until(unoClients[i],p=>p.phase==='playing');assert.equal(packet.uno.hand.length,i===2?0:unoState.uno.counts[i]);assert.ok(!('deck' in packet.uno)&&!('hands' in packet.uno))}
 assert.equal((await call(50,'/api/room/'+unoRoom+'/move',{kind:'draw',revision:unoState.revision})).status,403);
 const nextId=40+unoState.turn,nextView=(await call(nextId,'/api/room/'+unoRoom+'/state')).data.uno;
 const action=nextView.chooseColor?{kind:'color',color:'red'}:nextView.legalMoves.length?{kind:'play',card:nextView.legalMoves[0],color:'red'}:{kind:'draw'};
 const moved=await call(nextId,'/api/room/'+unoRoom+'/move',{...action,revision:unoState.revision});assert.equal(moved.status,200);const hidden=await until(unoClients[2],p=>p.revision===moved.data.revision);assert.deepEqual(hidden.uno.hand,[]);assert.ok(!JSON.stringify(hidden.moves).includes('"card":'));
 assert.deepEqual((await call(50,'/api/room/'+unoRoom+'/replay')).data.frames,[]);
 assert.equal((await call(40,'/api/room/'+unoRoom+'/archive',{revision:moved.data.revision})).status,200);assert.deepEqual((await call(50,'/api/room/'+unoRoom+'/state')).data.uno.hand,[]);
 console.log('PASS UNO runtime: 2–10 seat staging, creator start, full-table rejection, per-account HTTP/WebSocket hands, spectator privacy before/after archive, legal actions and no hidden replay.');
 const wordMade=await call(60,'/api/create',{game:'scarabeo'});assert.equal(wordMade.status,200);const wordRoom=wordMade.data.state.room;
 for(let id=61;id<=63;id++)assert.equal((await call(id,'/api/room/'+wordRoom+'/claim',{})).status,200);assert.equal((await call(64,'/api/room/'+wordRoom+'/claim',{})).status,409);
 let words=(await call(60,'/api/room/'+wordRoom+'/state')).data;words=(await call(60,'/api/room/'+wordRoom+'/start',{revision:words.revision})).data;assert.equal(words.scarabeo.rack.length,8);assert.deepEqual((await call(65,'/api/room/'+wordRoom+'/state')).data.scarabeo.rack,[]);
 const author=60+words.turn;words=(await call(author,'/api/room/'+wordRoom+'/state')).data;const text=words.scarabeo.rack.filter(t=>t.letter!=='?').slice(0,2).map(t=>t.letter).join('');let response=await call(author,'/api/room/'+wordRoom+'/move',{kind:'place',word:text,row:8,col:8,revision:words.revision});assert.equal(response.status,200);words=response.data;assert.ok(words.scarabeo.pending);
 assert.equal((await call(65,'/api/room/'+wordRoom+'/move',{kind:'vote',accept:true,revision:words.revision})).status,403);
 for(const id of [60,61,62,63].filter(id=>id!==author).slice(0,2)){response=await call(id,'/api/room/'+wordRoom+'/move',{kind:'vote',accept:true,revision:words.revision});assert.equal(response.status,200);words=response.data}assert.equal(words.scarabeo.pending,null);assert.ok(words.scarabeo.scores[author-60]>0);
 assert.equal((await call(70,'/api/create',{game:'cluedo'})).status,400);
 const tournament=await call(80,'/api/create',{game:'connect4',target:3});assert.equal(tournament.status,200);const seriesRoom=tournament.data.state.room;let seriesState=(await call(81,'/api/room/'+seriesRoom+'/claim',{})).data.state;
 for(let round=1;round<=3;round++){
  for(const column of [0,0,1,1,2,2,3]){response=await call(seriesState.turn?81:80,'/api/room/'+seriesRoom+'/move',{column,revision:seriesState.revision});assert.equal(response.status,200);seriesState=response.data}
  assert.equal(seriesState.series.wins[0],round);if(round<3){assert.equal(seriesState.finishedAt,undefined);assert.equal((await call(80,'/api/create',{game:'chess'})).status,409);assert.equal((await call(81,'/api/room/'+seriesRoom+'/next-round',{revision:seriesState.revision})).status,409);response=await call(80,'/api/room/'+seriesRoom+'/next-round',{revision:seriesState.revision});assert.equal(response.status,200);seriesState=response.data;assert.equal(seriesState.connect4.board.filter(x=>x!==null).length,0);assert.equal(seriesState.series.round,round+1)}
 }assert.equal(seriesState.expires,null);assert.equal(seriesState.series.done,true);assert.equal(seriesState.series.winner,0);assert.equal((await call(80,'/api/room/'+seriesRoom+'/next-round',{revision:seriesState.revision})).status,409);
 const five=await call(80,'/api/create',{game:'scopa',target:5});assert.equal(five.status,200);assert.equal(five.data.state.series.target,5);
 console.log('PASS new games runtime: four private word racks and voting, Cluedo retirement, min/max seats, first-to-three tournament through three live rounds, ownership at round breaks and first-to-five setup.');
 async function watchTable(id,room){const res=await mf.dispatchFetch('https://unit.test/api/room/'+room+'/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id)}});assert.equal(res.status,101);const c={ws:res.webSocket,packets:[],waiters:[]};c.ws.addEventListener('message',e=>{const p=JSON.parse(e.data);c.packets.push(p);for(const fn of [...c.waiters])fn(p)});c.ws.accept();sockets.push(c.ws);return c}
 const navalMade=await call(100,'/api/create',{game:'naval',target:3});assert.equal(navalMade.status,200);const navalRoom=navalMade.data.state.room;let sea=(await call(101,'/api/room/'+navalRoom+'/claim',{})).data.state;sea=(await call(100,'/api/room/'+navalRoom+'/start',{revision:sea.revision})).data;const seaWatch=await watchTable(102,navalRoom),ownFleet=randomFleet(),otherFleet=randomFleet();
 let res=await call(101,'/api/room/'+navalRoom+'/move',{kind:'deploy',fleet:otherFleet,revision:sea.revision});assert.equal(res.status,200);sea=res.data;assert.deepEqual(sea.naval.fleet,otherFleet);let publicSea=await until(seaWatch,p=>p.naval?.ready[1]);assert.equal(publicSea.naval.fleet,null);assert.deepEqual(publicSea.naval.shots,[[],[]]);assert.equal((await call(100,'/api/room/'+navalRoom+'/state')).data.naval.fleet,null);
 res=await call(100,'/api/room/'+navalRoom+'/move',{kind:'deploy',fleet:ownFleet,revision:sea.revision});assert.equal(res.status,200);sea=res.data;assert.equal(sea.naval.phase,'battle');assert.equal((await call(102,'/api/room/'+navalRoom+'/move',{kind:'fire',cell:0,revision:sea.revision})).status,403);
 for(const id of [100,101]){res=await call(id,'/api/room/'+navalRoom+'/move',{kind:'fire',cell:0,revision:sea.revision});assert.equal(res.status,200);sea=res.data}assert.equal((await call(100,'/api/room/'+navalRoom+'/move',{kind:'fire',cell:0,revision:sea.revision})).status,400);assert.equal((await call(102,'/api/room/'+navalRoom+'/state')).data.naval.fleet,null);
 let calledRoom,calledState;
 for(const [n,first,game] of [[2,110,'briscola'],[3,120,'briscola'],[4,130,'briscola'],[5,140,'briscola5']]){
  const made=await call(first,'/api/create',{game,target:3});assert.equal(made.status,200);const r=made.data.state.room;for(let i=1;i<n;i++)assert.equal((await call(first+i,'/api/room/'+r+'/claim',{})).status,200);let state=(await call(first,'/api/room/'+r+'/state')).data;
  const started=await call(first,'/api/room/'+r+'/start',{revision:state.revision});assert.equal(started.status,200);state=started.data;assert.equal(state.briscola.hand.length,n===5?8:3);assert.equal(state.turn,state.briscola.turn);
  const ids=[];for(let i=0;i<n;i++){const v=(await call(first+i,'/api/room/'+r+'/state')).data.briscola;ids.push(...v.hand.map(c=>c.id));assert.ok(!('deck' in v)&&!('hands' in v)&&!('captured' in v));assert.equal(v.points,null)}assert.equal(ids.length,new Set(ids).size);assert.deepEqual((await call(150,'/api/room/'+r+'/state')).data.briscola.hand,[]);
  if(n===5){const observer=await watchTable(150,r);let action={kind:'bid',rank:2,target:61};while(state.briscola.phase==='auction'){res=await call(first+state.turn,'/api/room/'+r+'/move',{...action,revision:state.revision});assert.equal(res.status,200);state=res.data;action={kind:'bid-pass'}}const caller=state.briscola.caller,privateCall=(await call(first+caller,'/api/room/'+r+'/state')).data.briscola;assert.equal(privateCall.callOptions.length,4);res=await call(first+caller,'/api/room/'+r+'/move',{kind:'call',suit:0,rank:2,revision:state.revision});assert.equal(res.status,200);state=res.data;const publicCall=await until(observer,p=>p.briscola?.called);assert.equal(publicCall.briscola.partner,null);assert.deepEqual(publicCall.briscola.hand,[]);assert.deepEqual(publicCall.briscola.callOptions,[]);calledRoom=r;}
  for(let i=0;i<n;i++){const actor=first+state.turn,privateView=(await call(actor,'/api/room/'+r+'/state')).data.briscola,card=privateView.hand.find(c=>c.id!==privateView.called?.id)||privateView.hand[0];res=await call(actor,'/api/room/'+r+'/move',{kind:'play',card:card.id,revision:state.revision});assert.equal(res.status,200);state=res.data;assert.equal(state.turn,state.briscola.turn)}assert.ok(state.briscola.lastTrick);if(n===5)calledState=state;
 }
 await mf.dispose();mf=new Miniflare(options);const restoredSea=(await call(100,'/api/room/'+navalRoom+'/state')).data;assert.deepEqual(restoredSea.naval.fleet,ownFleet);assert.equal((await call(102,'/api/room/'+navalRoom+'/state')).data.naval.fleet,null);const restoredCall=(await call(140,'/api/room/'+calledRoom+'/state')).data;assert.equal(restoredCall.revision,calledState.revision);assert.equal((await call(150,'/api/room/'+calledRoom+'/state')).data.briscola.partner,null);assert.deepEqual((await call(150,'/api/room/'+calledRoom+'/state')).data.briscola.hand,[]);
 console.log('PASS naval/Briscola runtime: private out-of-turn fleet deployment, public shots, invalid/repeated-shot rejection, all player counts, private hands and called partner over HTTP/WebSocket, dealer/turn alignment and private SQLite restart.');
 const madeRace=await call(201,'/api/create',{game:'moto-trial',courseId:7});
 assert.equal(madeRace.status,200);
 const race=madeRace.data.state;
 assert.equal((await mf.dispatchFetch('https://unit.test/api/moto-trial/'+race.room+'/state')).status,401);
 const rider1=await connect(201,race.room,false,'moto-trial');
 const rider2=await connect(202,race.room,false,'moto-trial');
 const raceState=(await until(rider1,p=>p.type==='state'&&p.state.players.length===2)).state;
 assert.equal(raceState.seed,race.seed);
 assert.equal(raceState.courseVersion,8);
 assert.equal(raceState.seed,1);
 assert.equal(raceState.campaign,true);
 assert.equal(raceState.courseName,'Campagna Moto Trial');
 assert.equal((await call(202,'/api/moto-trial/'+race.room+'/state')).data.state.seed,race.seed);
 assert.equal(new Set(raceState.players.map(p=>p.color)).size,2);
 const raceListing=(await call(202,'/api/lobby')).data.games.find(g=>g.room===race.room);
 assert.equal(raceListing.online,2);
 assert.equal(raceListing.courseName,'Campagna Moto Trial');
 const pose={type:'pose',seq:1,x:7,y:-.8,angle:1.05,vx:4,facing:1,lean:1,roll:2,leftSpring:.24,rightSpring:.10,mode:'ride',courseId:1,tier:0};
 rider1.ws.send(JSON.stringify({...pose,x:9000}));
 rider1.ws.send(JSON.stringify({...pose,id:'tg:202'}));
 const motion=await until(rider2,p=>p.type==='pose');
 assert.equal(motion.id,'tg:201');assert.equal(motion.pose.x,7);assert.equal(motion.pose.angle,1.05);assert.equal(motion.pose.leftSpring,.24);
 rider2.ws.send(JSON.stringify({...pose,x:8,facing:-1,angle:-.9}));
 const opposite=await until(rider1,p=>p.type==='pose');
 assert.equal(opposite.id,'tg:202');assert.equal(opposite.pose.facing,-1);
 const rider2OtherWindow=await connect(202,race.room,false,'moto-trial');
 const replacement=(await until(rider2OtherWindow,p=>p.type==='state')).state;
 assert.equal(replacement.players.filter(p=>p.id==='tg:202').length,1);
 assert.equal(replacement.players.find(p=>p.id==='tg:202').pose.x,8);
 const intro=makeCourse(1);
 rider1.ws.send(JSON.stringify({...pose,seq:2,courseId:7,mode:'finish'}));
 rider1.ws.send(JSON.stringify({...pose,seq:2,mode:'finish'}));
 await new Promise(resolve=>setTimeout(resolve,80));
 assert.equal((await call(201,'/api/moto-trial/'+race.room+'/state')).data.state.players.find(p=>p.id==='tg:201').stage,1);
 rider1.ws.send(JSON.stringify({...pose,seq:3,x:intro.finish-intro.tiers.at(-1).direction*.1,y:ground(intro.tiers.at(-1),intro.finish)-.4,
   tier:intro.tiers.length-1,mode:'finish'}));
 const progressed=(await until(rider1,p=>p.type==='state'&&p.state.players.some(p=>p.id==='tg:201'&&p.stage===2))).state;
 assert.equal(progressed.players.find(p=>p.id==='tg:202').stage,1);
 const rider1NewWindow=await connect(201,race.room,false,'moto-trial');
 assert.equal((await until(rider1NewWindow,p=>p.type==='state')).state.players.find(p=>p.id==='tg:201').stage,2);
 rider2OtherWindow.ws.close();
 await until(rider1NewWindow,p=>p.type==='state'&&p.state.players.length===1);
 assert.equal((await call(201,'/api/lobby')).data.games.find(g=>g.room===race.room).online,1);
 console.log('PASS Moto Trial runtime: shared campaign, authenticated live riders, sequential unlocks, reconnect and Lobby presence.');

 const pongMade=await call(241,'/api/create',{game:'pong',mode:'football'});
 assert.equal(pongMade.status,200);
 const pongRoom=pongMade.data.state.room;
 const pongA=await connect(241,pongRoom,false,'pong');
 assert.equal(pongA.packets[0].state.phase,'waiting');
 assert.equal(pongA.packets[0].state.players[0].name,'Test 241');
 const waitingPong=(await call(241,'/api/lobby')).data.games.find(g=>g.room===pongRoom);
 assert.equal(waitingPong.phase,'waiting');
 assert.equal(waitingPong.players.length,1);
 const pongB=await connect(242,pongRoom,false,'pong');
 await until(pongA,p=>p.state?.phase==='playing'&&p.state.players.length===2);
 const third=await mf.dispatchFetch('https://unit.test/api/pong/'+pongRoom+'/ws',{
  headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(243)}
 });
 assert.equal(third.status,409);
 pongB.ws.send(JSON.stringify({type:'mode',mode:'catch'}));
 for(let i=0;i<19;i++){
  pongA.ws.send(JSON.stringify({type:'input',direction:-1,target:null}));
  pongB.ws.send(JSON.stringify({type:'input',direction:1,target:null}));
  await new Promise(resolve=>setTimeout(resolve,52));
 }
 const running=(await call(241,'/api/pong/'+pongRoom+'/state')).data.state;
 assert.equal(running.match.mode,'football');
 assert.ok(running.match.paddles[0]<150&&running.match.paddles[1]>330);
 assert.ok(running.match.ball.x>320);
 pongA.ws.send(JSON.stringify({type:'mode',mode:'catch'}));
 await until(pongB,p=>p.state?.phase==='paused'&&p.state.match.mode==='catch');
 pongA.ws.send(JSON.stringify({type:'start'}));
 await until(pongB,p=>p.state?.phase==='playing'&&p.state.match.mode==='catch');
 pongB.ws.close();
 await until(pongA,p=>p.state?.phase==='waiting'&&p.state.match.mode==='catch');
 const pongRejoined=await connect(242,pongRoom,false,'pong');
 assert.equal(pongRejoined.packets[0].state.players[1].seat,1);
 assert.equal(pongRejoined.packets[0].state.phase,'playing');
 pongA.ws.close();pongRejoined.ws.close();
 console.log('PASS Pong runtime: Lobby roster, waiting, automatic start, capacity, authoritative movement, host controls and reconnect.');

 function completedNumbers(seed){
  const level='hard',game=createNumberGame(seed,level),moves=[];
  while(hasMove(game)){
   let merged=false;
   for(let from=0;from<30&&!merged;from++){
    for(let to=from+1;to<30;to++){
     if(!canMerge(game,from,to))continue;
     mergeNumbers(game,from,to,false);
     moves.push([from,to,3000]);merged=true;break;
    }
   }
   assert.ok(merged&&moves.length<10000);
  }
  return {run:{seed,level,moves},points:game.score};
 }
 const results=[completedNumbers(15),completedNumbers(18)].sort((a,b)=>b.points-a.points);
 const [stronger,weaker]=results;
 const numberScore='/api/number-connect/score';
 assert.equal((await call(241,numberScore,{...stronger.run,moves:[]})).status,400);
 assert.equal((await call(241,numberScore,{...stronger.run,moves:[[0,0,3000]]})).status,400);
 assert.equal((await call(241,numberScore,stronger.run)).status,200);
 assert.equal((await call(241,numberScore,weaker.run)).data.leaders[0].points,stronger.points);
 assert.equal((await call(242,numberScore,weaker.run)).status,200);
 const publicScores=(await call(243,'/api/leaderboard?mode=both')).data.numberConnectLeaders;
 assert.deepEqual(publicScores.map(row=>[row.id,row.points]),[['tg:241',stronger.points],['tg:242',weaker.points]]);
 console.log('PASS Number Connect runtime: completed replays only, per-account records and shared score ranking.');
 const appearance=['#a11293','#197b61'];
 const golf=await call(301,'/api/create',{game:'golf',appearance,campaign:'coast'});
 assert.equal(golf.status,200);
 assert.equal(golf.data.state.courseVersion,4);
 assert.deepEqual(golf.data.state.players[0].appearance,appearance);
 assert.equal(golf.data.state.campaign,'coast');
 assert.equal(golf.data.state.collisions,false);
 const golfPath='/api/golf/'+golf.data.state.room;
 assert.equal((await mf.dispatchFetch('https://unit.test'+golfPath+'/state')).status,401);
 assert.equal((await call(301,golfPath+'/start',{})).status,409);
 const golfJoin=await call(302,golfPath+'/join',{appearance:['#ffffff','#111111']});
 assert.equal(golfJoin.status,200);
 assert.deepEqual(golfJoin.data.state.players[1].appearance,['#ffffff','#111111']);
 assert.equal((await call(302,golfPath+'/start',{campaign:'neon'})).status,409);
 assert.equal((await call(301,golfPath+'/start',{campaign:'unknown'})).status,409);
 assert.equal((await call(301,golfPath+'/start',{campaign:'park'})).status,409);
 const startedGolf=(await call(301,golfPath+'/start',{campaign:'neon'})).data.state;
 assert.equal(startedGolf.phase,'playing');
 assert.equal(startedGolf.campaign,'neon');
 assert.equal((await call(303,golfPath+'/join',{})).status,409);
 assert.equal((await call(303,golfPath+'/state')).data.state.players.length,2);
 assert.equal((await call(303,golfPath+'/close',{})).status,403);
 const putt={hole:0,strokes:0,angle:0,power:.54};
 assert.equal((await call(303,golfPath+'/shot',putt)).status,409);
 const scores=await Promise.all([301,302].map(player=>call(player,golfPath+'/shot',putt)));
 assert.ok(scores.every(result=>result.status===200));
 assert.equal((await call(302,golfPath+'/shot',putt)).status,409);
 const golfState=(await call(301,golfPath+'/state')).data.state;
 assert.ok(golfState.players.every(player=>player.strokes===1&&player.shot.samples.length>1));
 assert.equal((await call(302,golfPath+'/state?after='+golfState.revision)).data.state,undefined);
 const golfListing=(await call(302,'/api/lobby')).data.games.find(entry=>entry.room===golfState.room);
 assert.equal(golfListing.capacity,8);
 assert.equal(golfListing.holes,10);
 assert.equal(golfListing.campaign,'neon');
 assert.equal(golfListing.players.length,2);
 assert.equal((await call(302,golfPath+'/close',{})).status,200);
 assert.equal((await call(303,golfPath+'/state')).status,404);
 assert.ok(!(await call(301,'/api/lobby')).data.games.some(entry=>entry.room===golfState.room));
 assert.deepEqual((await call(301,'/api/leaderboard?game=golf')).data.leaders,[]);
 const collisionRoom=(await call(301,'/api/create',{game:'golf',collisions:true})).data;
 const collisionPath='/api/golf/'+collisionRoom.state.room;
 assert.equal(collisionRoom.state.collisions,true);
 assert.equal((await call(302,collisionPath+'/join',{collisions:false})).data.state.collisions,true);
 assert.equal((await call(301,collisionPath+'/start',{collisions:false})).data.state.collisions,true);
 assert.equal((await call(303,collisionPath+'/state')).data.state.collisions,true);
 assert.equal((await call(302,'/api/lobby')).data.games.find(g=>g.room===collisionRoom.state.room).collisions,true);
 assert.equal((await call(301,collisionPath+'/close',{})).status,200);
 assert.equal((await mf.dispatchFetch('https://unit.test/api/cinema/ws',{headers:{Upgrade:'websocket'}})).status,401);
 async function cinemaClient(id){
  const res=await mf.dispatchFetch('https://unit.test/api/cinema/ws',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id)}});
  assert.equal(res.status,101);
  const client={ws:res.webSocket,packets:[],waiters:[]};
  client.ws.addEventListener('message',event=>{const p=JSON.parse(event.data);client.packets.push(p);for(const fn of [...client.waiters])fn(p)});
  client.ws.accept();sockets.push(client.ws);await until(client,p=>p.type==='favorites');return client;
 }
 const cinemaA=await cinemaClient(801),cinemaB=await cinemaClient(802),cinemaC=await cinemaClient(803);
 const cinemaSend=(client,type,fields={})=>client.ws.send(JSON.stringify({type,...fields}));
 const one={name:'Primo canale',url:'https://tv.example/first.m3u8'},two={name:'Secondo canale',url:'https://tv.example/second.m3u8'};
 cinemaSend(cinemaC,'channel',{channel:one});
 await until(cinemaC,p=>p.type==='error'&&p.message==='Entra in una sala.');
 cinemaSend(cinemaA,'create');cinemaSend(cinemaB,'create');
 const cinemaRoomA=(await until(cinemaA,p=>p.active?.id)).active.id;
 const cinemaRoomB=(await until(cinemaB,p=>p.active?.id)).active.id;
 assert.notEqual(cinemaRoomA,cinemaRoomB);
 cinemaSend(cinemaC,'enter',{room:cinemaRoomA});
 await until(cinemaA,p=>p.rooms?.find(r=>r.id===cinemaRoomA)?.viewers.length===2);
 cinemaSend(cinemaC,'channel',{channel:one});
 await until(cinemaA,p=>p.active?.channel?.url===one.url);
 cinemaSend(cinemaB,'channel',{channel:two});
 const independent=await until(cinemaA,p=>p.rooms?.find(r=>r.id===cinemaRoomB)?.channel===two.name);
 assert.equal(independent.active.channel.url,one.url);
 cinemaSend(cinemaA,'favorite-add',{channel:one});cinemaSend(cinemaB,'favorite-add',{channel:two});
 const shared=(await until(cinemaB,p=>p.type==='favorites'&&p.items.length===2)).items;
 const [front,back]=shared;
 cinemaSend(cinemaC,'favorite-move',{id:back.id,before:front.id});
 await until(cinemaA,p=>p.type==='favorites'&&p.items[0]?.id===back.id);
 cinemaSend(cinemaB,'favorite-remove',{id:front.id});
 await until(cinemaA,p=>p.type==='favorites'&&p.items.length===1&&p.items[0].id===back.id);
 cinemaC.ws.close();
 await until(cinemaA,p=>p.active?.id===cinemaRoomA&&p.rooms?.find(r=>r.id===cinemaRoomA)?.viewers.length===1&&p.active.channel?.url===one.url);
 const cinemaD=await cinemaClient(804);
 assert.deepEqual((await until(cinemaD,p=>p.type==='favorites')).items,[back]);
 cinemaSend(cinemaD,'appearance',{appearance:{shirt:'#cf514d',shorts:'#3c62a3'}});
 cinemaSend(cinemaD,'enter',{room:cinemaRoomA});
 const outfit=await until(cinemaA,p=>p.rooms?.find(r=>r.id===cinemaRoomA)?.viewers.some(v=>v.id==='tg:804'&&v.appearance.shirt==='#cf514d'));
 assert.ok(outfit.rooms.find(r=>r.id===cinemaRoomA).viewers.length===2);
 const youtube='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
 cinemaSend(cinemaD,'channel',{channel:{name:'Prova YouTube',url:'https://youtu.be/dQw4w9WgXcQ?si=test'}});
 const playing=await until(cinemaA,p=>p.active?.channel?.url===youtube&&p.active.playback?.playing===true);
 assert.equal(playing.active.channel.youtube,'dQw4w9WgXcQ');
 const untouched=await until(cinemaB,p=>p.rooms?.find(r=>r.id===cinemaRoomA)?.channel==='Prova YouTube');
 assert.equal(untouched.active.channel.url,two.url);
 cinemaSend(cinemaD,'playback',{url:youtube,command:'pause'});
 await until(cinemaA,p=>p.active?.channel?.url===youtube&&p.active.playback?.playing===false);
 cinemaSend(cinemaD,'playback',{url:youtube,command:'seek',position:122});
 await until(cinemaA,p=>p.active?.playback?.position===122);
 const cinemaE=await cinemaClient(805);
 cinemaSend(cinemaE,'enter',{room:cinemaRoomA});
 const late=await until(cinemaE,p=>p.active?.playback?.position===122);
 assert.equal(late.active.playback.playing,false);
 cinemaSend(cinemaE,'playback',{url:youtube,command:'play'});
 await until(cinemaD,p=>p.active?.playback?.playing===true&&p.active.playback.position===122);
 const screenId='606bfa15-1e0a-46fb-a35f-46da06729854';
 cinemaSend(cinemaA,'screen-start',{share:screenId});
 const sharing=await until(cinemaD,p=>p.active?.screen?.id===screenId);
 assert.equal(sharing.active.screen.local,false);
 const outsider=await until(cinemaB,p=>p.rooms?.some(r=>r.id===cinemaRoomA&&r.channel==='Finestra condivisa'));
 assert.equal(outsider.active.screen,null);
 assert.equal(outsider.previews,undefined);
 cinemaSend(cinemaB,'mosaic',{open:true});
 const mosaic=await until(cinemaB,p=>p.previews?.some(r=>r.id===cinemaRoomA&&r.screen?.id===screenId));
 assert.equal(mosaic.previews.find(r=>r.id===cinemaRoomA).channel.url,youtube);
 assert.equal(mosaic.active.id,cinemaRoomB);
 const beforePreview=new Set(cinemaA.packets);
 cinemaSend(cinemaB,'screen-watch',{share:screenId,preview:true});
 const previewPeer=await until(cinemaA,p=>!beforePreview.has(p)&&p.type==='screen-peer'&&p.share===screenId);
 cinemaSend(cinemaA,'screen-signal',{share:screenId,peer:previewPeer.peer,signal:{type:'offer',sdp:'preview offer'}});
 await until(cinemaB,p=>p.type==='screen-signal'&&p.signal?.sdp==='preview offer');
 cinemaSend(cinemaB,'screen-signal',{share:screenId,preview:true,peer:sharing.active.screen.peer,signal:{type:'answer',sdp:'preview answer'}});
 await until(cinemaA,p=>p.type==='screen-signal'&&p.signal?.sdp==='preview answer');
 cinemaSend(cinemaB,'mosaic',{open:false});
 await until(cinemaA,p=>p.type==='screen-peer-left'&&p.peer===previewPeer.peer);
 cinemaSend(cinemaD,'screen-watch',{share:screenId});
 const {peer:screenPeer}=await until(cinemaA,p=>p.type==='screen-peer'&&p.share===screenId&&p.peer!==previewPeer.peer);
 cinemaSend(cinemaB,'screen-signal',{share:screenId,peer:sharing.active.screen.peer,signal:{type:'answer',sdp:'injected'}});
 cinemaSend(cinemaA,'screen-signal',{share:screenId,peer:screenPeer,signal:{type:'offer',sdp:'a'.repeat(6000)}});
 const offer=await until(cinemaD,p=>p.type==='screen-signal'&&p.signal?.type==='offer');
 assert.equal(offer.signal.sdp.length,6000);
 cinemaSend(cinemaD,'screen-signal',{share:screenId,peer:offer.peer,signal:{type:'answer',sdp:'valid answer'}});
 const answer=await until(cinemaA,p=>p.type==='screen-signal'&&p.signal?.type==='answer'&&p.peer===screenPeer);
 assert.equal(answer.signal.sdp,'valid answer');
 cinemaSend(cinemaD,'screen-stop',{share:screenId});
 cinemaSend(cinemaD,'screen-unwatch',{share:screenId});
 await until(cinemaA,p=>p.type==='screen-peer-left'&&p.peer===screenPeer);
 cinemaSend(cinemaD,'screen-watch',{share:screenId});
 cinemaSend(cinemaD,'enter',{room:cinemaRoomB});
 const changedRoom=await until(cinemaD,p=>p.active?.id===cinemaRoomB);
 assert.equal(changedRoom.active.screen,null);
 await until(cinemaA,p=>p.active?.screen?.id===screenId&&p.rooms.find(r=>r.id===cinemaRoomA)?.viewers.length===2);
 const beforeStop=new Set(cinemaA.packets);
 cinemaSend(cinemaA,'screen-stop',{share:screenId});
 await until(cinemaA,p=>!beforeStop.has(p)&&p.active?.screen===null&&p.active?.channel?.url===youtube&&p.active.playback?.playing===true);
 cinemaSend(cinemaD,'enter',{room:cinemaRoomA});
 await until(cinemaD,p=>p.active?.id===cinemaRoomA&&p.rooms.find(r=>r.id===cinemaRoomA)?.viewers.length===3);
 const youtubeLookup='/api/cinema/youtube?mode=search&type=video&q=motorsport';
 assert.equal((await mf.dispatchFetch('https://unit.test'+youtubeLookup)).status,401);
 assert.equal((await call(801,youtubeLookup)).status,503);
 const publicChannel='https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw';
 cinemaSend(cinemaA,'favorite-add',{channel:{name:'Canale prova',url:publicChannel,catalog:true}});
 await until(cinemaD,p=>p.type==='favorites'&&p.items.some(item=>item.youtubeChannel&&item.url===publicChannel));
 cinemaSend(cinemaD,'channel',{channel:{name:'Canale prova',url:publicChannel}});
 await until(cinemaD,p=>p.type==='error'&&p.message==='Canale non valido.');
 cinemaSend(cinemaA,'channel',{channel:{name:'YouTube live',url:'https://www.youtube.com/live/M7lc1UVf-VE',live:true,catalog:true}});
 const liveYouTube=await until(cinemaD,p=>p.active?.channel?.live);
 cinemaSend(cinemaD,'playback',{url:liveYouTube.active.channel.url,command:'seek',position:15});
 await until(cinemaD,p=>p.type==='error'&&p.message==='Comando video non valido.');
 const removedUpload=await mf.dispatchFetch('https://unit.test/api/cinema/upload?room='+cinemaRoomA, {
  method:'POST',headers:{Authorization:'Bearer '+token(804),'Content-Type':'video/mp4'},body:Buffer.from('unused')
 });
 assert.equal(removedUpload.status,404);
 cinemaSend(cinemaA,'close-room');
 await until(cinemaD,p=>p.type==='room-closed'&&p.id===cinemaRoomA);
 await until(cinemaB,p=>p.active?.id===cinemaRoomB&&p.rooms.length===1);
 cinemaSend(cinemaA,'create');
 const reused=await until(cinemaA,p=>p.active?.id&&p.active.id!==cinemaRoomA&&p.rooms.some(r=>r.id===p.active.id&&r.number===1));
 assert.equal(reused.rooms.length,2);
 console.log('PASS Cinema runtime: authenticated access, room-scoped channel and presence, global live favorites and persistence.');
 console.log('PASS Golf runtime: concurrent shots, read-only spectating, participant closure and no ranking for interrupted games.');
 console.log('PASS workerd runtime: authenticated create/join, four real WebSockets, spectator isolation, movement correction, action errors, shared updates, participant-only management, SQLite restart persistence and reusable lobby numbers.');
}finally{for(const ws of sockets)try{ws.close()}catch{}await mf.dispose();await rm(directory,{recursive:true,force:true})}

const searchKey='synthetic-youtube-key',publicChannelId='UC_x5XG1OV2P6uZZ5FSM9Ttw';
const searchWorker=new Miniflare(convertV4MiniflareOptions({
 ...runtimeConfig,resourcePersistencePath:undefined,bindings:{BOT_TOKEN:bot,YOUTUBE_API_KEY:searchKey},
 outboundService:async req=>{
  const url=new URL(req.url);
  if(url.origin==='https://api.telegram.org'){
   if(url.pathname.startsWith('/file/')){
    if(url.pathname.endsWith('/videos/test.mp4'))return new Response(Buffer.from('000000186674797069736f6d0000000069736f6d61766331','hex'));
    if(url.pathname.endsWith('/thumbs/test.jpg'))return new Response(Buffer.from('ffd8ffe00000ffd9','hex'));
    assert.ok(url.pathname.endsWith('/animations/test.gif'));
    return new Response(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));
   }
   const action=url.pathname.split('/').at(-1),payload=await req.json();
   if(action==='getMe')return Response.json({ok:true,result:{id:999}});
   if(action==='getChatMember'){
    assert.equal(payload.chat_id,-100123);
    const status=payload.user_id===999||payload.user_id===801?'administrator':payload.user_id===802?'member':'left';
    return Response.json({ok:true,result:{status}});
   }
   assert.equal(action,'getFile');
   const files={'telegram-gif-file':'animations/test.gif','telegram-video':'videos/test.mp4','telegram-thumb':'thumbs/test.jpg'};
   assert.ok(files[payload.file_id]);
   return Response.json({ok:true,result:{file_path:files[payload.file_id],file_size:42}});
  }
  if(url.origin==='https://www.youtube.com'){
   assert.equal(url.pathname,'/feeds/videos.xml');
   assert.equal(url.searchParams.get('channel_id'),publicChannelId);
   assert.equal(url.searchParams.has('key'),false);
   return new Response('<feed><title>Canale prova</title><entry><yt:videoId>M7lc1UVf-VE</yt:videoId><title>Video</title></entry></feed>');
  }
  assert.equal(url.origin,'https://www.googleapis.com');
  assert.equal(url.searchParams.get('key'),searchKey);
  assert.equal(req.headers.has('Authorization'),false);
  if(url.searchParams.get('q')==='redirect')return new Response(null,{status:302,headers:{Location:'https://outside.example'}});
  if(url.pathname==='/youtube/v3/channels')return Response.json({error:{details:[{reason:'SERVICE_DISABLED'}]}},{status:403});
  assert.equal(url.pathname,'/youtube/v3/search');
  assert.equal(url.searchParams.get('part'),'snippet');
  assert.equal(url.searchParams.get('maxResults'),'30');
  assert.equal(url.searchParams.get('videoEmbeddable'),'true');
  if(url.searchParams.get('q')==='bloccato')return Response.json({error:{details:[{reason:'API_KEY_SERVICE_BLOCKED'}]}},{status:403});
  return Response.json({items:[{id:{videoId:'M7lc1UVf-VE'},snippet:{title:'Motorsport',channelTitle:'Test'}}]});
 }
}));
try{
 const search=q=>searchWorker.dispatchFetch('https://unit.test/api/cinema/youtube?mode=search&type=video&q='+q,{
  headers:{Authorization:'Bearer '+token(801)}
 });
 const success=await search('motorsport'),body=await success.json();
 assert.equal(success.status,200,JSON.stringify(body));
 assert.deepEqual(body.items.map(item=>item.id),['M7lc1UVf-VE']);
 const blocked=await search('bloccato');
 assert.equal(blocked.status,503);
 const error=await blocked.json();
 assert.match(error.error,/Google blocca YouTube Data API v3/);
 assert.doesNotMatch(error.error,new RegExp(searchKey));
 assert.equal((await search('redirect')).status,502);
 const feed=await searchWorker.dispatchFetch('https://unit.test/api/cinema/youtube?mode=channel&id='+publicChannelId,{
  headers:{Authorization:'Bearer '+token(801)}
 });
 assert.equal(feed.status,200);
 assert.equal((await feed.json()).items[0].id,'M7lc1UVf-VE');
 const base='https://unit.test/api/cinema/group/';
 const tgRequest=(user,path,method='GET')=>searchWorker.dispatchFetch(base+path,{method,headers:{Authorization:'Bearer '+token(user)}});
 const webhookHash=createHash('sha256').update(bot).digest('hex');
 const home={id:-100123,type:'supergroup',title:'🏁 Binotto Corsa Competizione',is_forum:true};
 const webhook=(message,valid=true)=>searchWorker.dispatchFetch('https://unit.test/api/telegram/webhook',{
  method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':valid?webhookHash:'bad'},
  body:JSON.stringify({message:{chat:home,...message}})
 });
 const cinemaClient=async id=>{
  const websocket=await searchWorker.dispatchFetch('https://unit.test/api/cinema/ws',{
   headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token(id)}
  });
  const client={ws:websocket.webSocket,packets:[],waiters:[]};
  client.ws.addEventListener('message',event=>{const packet=JSON.parse(event.data);client.packets.push(packet);for(const fn of [...client.waiters])fn(packet);});
  client.ws.accept();
  return client;
 };
 const sender=await cinemaClient(801),viewer=await cinemaClient(802);
 sender.ws.send(JSON.stringify({type:'create'}));
 const {active}=await until(sender,p=>p.active);
 const arm='arm?room='+active.id;
 assert.equal((await webhook({message_id:4,text:'ciao'},false)).status,403);
 assert.equal((await tgRequest(802,arm,'POST')).status,403);
 viewer.ws.send(JSON.stringify({type:'enter',room:active.id}));
 await until(viewer,p=>p.active?.id===active.id);
 const armed=await tgRequest(801,arm,'POST');
 assert.equal(armed.status,200);
 assert.equal((await armed.json()).bot,'checkmategame_bot');
 const video={file_id:'telegram-video',mime_type:'video/mp4',file_size:24,duration:30};
 const sendToBot=(message)=>webhook({chat:{type:'private',id:801},from:{id:801},...message});
 await webhook({message_id:10,text:'Nel gruppo',from:{id:801}});
 await sendToBot({message_id:19,text:'protetto',has_protected_content:true});
 await until(sender,p=>p.type==='group-forward-status'&&p.error?.includes('protegge'));
 sender.ws.close();
 const external={message_id:20,forward_origin:{type:'channel',chat:{id:-100222},date:1},video};
 assert.equal((await sendToBot(external)).status,200);
 const published=await until(viewer,p=>p.active?.channel?.inbox&&p.active.channel.file&&p.active.playback?.playing);
 const url='https://unit.test'+published.active.channel.url;
 assert.equal((await searchWorker.dispatchFetch(url)).status,401);
 assert.equal((await searchWorker.dispatchFetch(url,{headers:{Authorization:'Bearer '+token(803)}})).status,403);
 const cookie={Cookie:'binottoland_cinema='+token(802)};
 const media=await searchWorker.dispatchFetch(url,{headers:cookie});
 assert.equal(media.status,200);
 assert.equal(media.headers.get('Content-Type'),'video/mp4');
 const range=await searchWorker.dispatchFetch(url,{headers:{...cookie,Range:'bytes=4-7'}});
 assert.equal(range.status,206);
 assert.equal(await range.text(),'ftyp');
 await sendToBot({message_id:21,text:'Messaggio personale'});
 await until(viewer,p=>p.active?.queue===1);
 await sendToBot(external);
 await sendToBot({message_id:22,document:{file_name:'programma.pdf',mime_type:'application/pdf',file_id:'not-playable'}});
 const queued=await until(viewer,p=>p.active?.queue===2);
 assert.equal(queued.active.channel.url,published.active.channel.url);
 const owner=await cinemaClient(801);
 owner.ws.send(JSON.stringify({type:'enter',room:active.id}));
 await until(owner,p=>p.active?.id===active.id);
 owner.ws.send(JSON.stringify({type:'queue-next'}));
 const text=await until(viewer,p=>p.active?.channel?.text==='Messaggio personale');
 assert.equal(text.active.queue,1);
 assert.equal((await searchWorker.dispatchFetch(url,{headers:cookie})).status,404);
 owner.ws.send(JSON.stringify({type:'queue-next'}));
 const card=await until(viewer,p=>p.active?.channel?.text==='programma.pdf');
 assert.equal(card.active.queue,0);
 await sendToBot({message_id:23,video:{...video,duration:1}});
 await sendToBot({message_id:24,text:'Dopo il video'});
 owner.ws.send(JSON.stringify({type:'queue-next'}));
 const short=await until(viewer,p=>p.active?.channel?.file&&p.active.channel.url!==published.active.channel.url);
 assert.equal((await searchWorker.dispatchFetch('https://unit.test'+short.active.channel.url,{method:'HEAD',headers:cookie})).status,200);
 await until(viewer,p=>p.active?.channel?.text==='Dopo il video');
 assert.equal((await tgRequest(801,arm,'DELETE')).status,204);
 await sendToBot({message_id:25,text:'Non in sala'});
 owner.ws.send(JSON.stringify({type:'queue-next'}));
 await until(viewer,p=>p.active?.id===active.id&&p.active.channel===null&&p.active.queue===0);
 owner.ws.close();viewer.ws.close();
 console.log('PASS Telegram Cinema: external and direct submissions, queue order, duplicates, automatic advancement, disarm, document cards and private range access.');
 console.log('PASS YouTube runtime: Telegram auth, configured key, live DO route, Google request parameters and safe error forwarding.');
}finally{await searchWorker.dispose();}
