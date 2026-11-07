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
 assert.equal((await call(201,'/api/create',{game:'moto-trial',courseId:11})).status,400);
 const madeRace=await call(201,'/api/create',{game:'moto-trial',courseId:7});
 assert.equal(madeRace.status,200);
 const race=madeRace.data.state;
 assert.equal((await mf.dispatchFetch('https://unit.test/api/moto-trial/'+race.room+'/state')).status,401);
 const rider1=await connect(201,race.room,false,'moto-trial');
 const rider2=await connect(202,race.room,false,'moto-trial');
 const raceState=(await until(rider1,p=>p.type==='state'&&p.state.players.length===2)).state;
 assert.equal(raceState.seed,race.seed);
 assert.equal(raceState.courseVersion,5);
 assert.equal(raceState.seed,7);
 assert.equal(raceState.courseName,'Ruggine');
 assert.equal((await call(202,'/api/moto-trial/'+race.room+'/state')).data.state.seed,race.seed);
 assert.equal(new Set(raceState.players.map(p=>p.color)).size,2);
 const raceListing=(await call(202,'/api/lobby')).data.games.find(g=>g.room===race.room);
 assert.equal(raceListing.online,2);
 assert.equal(raceListing.courseName,'Ruggine');
 const pose={type:'pose',seq:1,x:7,y:-.8,angle:1.05,vx:4,facing:1,lean:1,roll:2,leftSpring:.24,rightSpring:.10,mode:'ride'};
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
 rider2OtherWindow.ws.close();
 await until(rider1,p=>p.type==='state'&&p.state.players.length===1);
 assert.equal((await call(201,'/api/lobby')).data.games.find(g=>g.room===race.room).online,1);
 console.log('PASS Moto Trial runtime: shared route, authenticated live riders, poses in both directions, reconnect and Lobby presence.');
 console.log('PASS workerd runtime: authenticated create/join, four real WebSockets, spectator isolation, movement correction, action errors, shared updates, participant-only management, SQLite restart persistence and reusable lobby numbers.');
}finally{for(const ws of sockets)try{ws.close()}catch{}await mf.dispose();await rm(directory,{recursive:true,force:true})}
