import {build} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initialScopa,scopaView} from '../scopa.js';
import {initialScarabeo,scarabeoView,playScarabeo} from '../scarabeo.js';
import {tutorial} from '../table-ai.js';
const source=await fs.readFile('public/app.js','utf8'),bundle=await build({stdin:{contents:source+'\nwindow.__qa={render,createGame,showLobby,openRoom,selectPage,canMove};',resolveDir:process.cwd()+'/public'},bundle:true,write:false,format:'iife',platform:'browser'});
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(await fs.readFile('public/index.html','utf8'),{url:'https://unit.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:false,addEventListener(){}});w.Telegram={WebApp:{platform:'android',ready(){},expand(){},onEvent(){},initData:'test-fixture'}};
const room='11111111-1111-4111-8111-111111111111',players=[{id:'tg:1',name:'Fausto'},{id:'bot:1',name:'AI 1',bot:true}],user={id:'1',player:'tg:1',name:'Fausto'},scopa=initialScopa(2),view=scopaView(scopa,0);let state={room,number:1,phase:'playing',game:'scopa',players,turn:0,revision:0,moves:[],scopa:view,mode:'tutorial',tutorial:tutorial('scopa',view,0,0),expires:Date.now()+86400000};const payload=()=>({games:[state],users:[],messages:[],leaderboard:[{id:'tg:9',name:'Anna <b>',wins:5,games:{scopa:3,chess:2}}],aiLeaderboard:[{id:'tg:1',name:'Fausto',wins:2,games:{scopa:2}}]});
let lobbySocket;
w.WebSocket=class{constructor(url){if(url.endsWith('/api/lobby/ws'))lobbySocket=this;this.readyState=1;w.setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify(url.endsWith('/api/lobby/ws')?payload():state)})},1)}send(){}close(){this.readyState=3}};
w.fetch=async(path,opts)=>Response.json(path==='/api/session'?{user,token:'synthetic'}:path.startsWith('/api/leaderboard')?{...payload(),pending:false}:path==='/api/lobby'?payload():state);
w.eval(bundle.outputFiles[0].text);await new Promise(r=>setTimeout(r,50));assert.equal(w.document.getElementById('app-shell').hidden,false);assert.equal(w.document.querySelector('input[type=password]'),null);await w.__qa.openRoom(room,true);assert.equal(w.document.querySelectorAll('#scopa-area .briscola-hand button').length,3);assert.equal(w.document.querySelectorAll('#scopa-area .briscola-table .sicilian-card').length,4);assert.equal(w.document.getElementById('tutorial-panel').hidden,false);assert.ok(w.document.getElementById('tutorial-reason').textContent.length);assert.equal(w.document.getElementById('create-cluedo'),null);
w.__qa.createGame('briscola5','solo');
w.document.querySelector('[name="solo-mode"][value="tutorial"]').click();
assert.equal(w.document.getElementById('creation-format').hidden,true);
assert.equal(w.document.getElementById('creation-seats').value,'5');
w.document.getElementById('cancel-creation').click();
w.__qa.selectPage('games');
await new Promise(r=>setTimeout(r,40));
assert.match(w.document.getElementById('leaderboard-multi').textContent,/Anna <b>/);
assert.match(w.document.getElementById('leaderboard-solo').textContent,/Fausto/);
assert.equal(w.document.querySelector('#leaderboard-multi b'),null);
// A human must be able to vote on a bot's proposal outside the nominal turn.
let word=initialScarabeo(2),letters=word.racks[1].slice(0,2).map(t=>t.letter==='?'?'A':t.letter).join('');word.turn=1;word=playScarabeo(word,1,{kind:'place',word:letters,row:8,col:8});state={...state,revision:50,scopa:null,game:'scarabeo',scarabeo:scarabeoView(word,0),turn:1,tutorial:null};w.__qa.render(state);assert.equal(w.__qa.canMove(),true);assert.ok(w.document.querySelectorAll('#word-votes button').length>=2);assert.ok(w.document.querySelector('#word-rack .word-tile-letter'));
assert.ok(w.document.querySelector('#word-rack .word-tile-value'));
assert.ok(w.document.querySelector('.word-cell.proposed .word-tile-value'));
assert.equal(w.document.documentElement.dataset.telegramPlatform,'android');

const get=id=>w.document.getElementById(id);
const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
const create=(game,kind)=>w.document.querySelector('[data-create-game="'+game+'"][data-creation-kind="'+kind+'"]');
const format=value=>w.document.querySelector('[name="table-format"][value="'+value+'"]');
w.__qa.showLobby();
lobbySocket.onmessage({data:JSON.stringify({...payload(),games:[
 {...state,room:'finished',phase:'finished',series:null},state
]})});
assert.equal(get('games').querySelectorAll('.table-card').length,1);
assert.equal(w.document.querySelector('[data-filter]'),null);
assert.equal(create('scopa','people').disabled,false);
create('scopa','people').click();
assert.equal(get('creation-format').hidden,false);
format('5').click();
get('cancel-creation').click();
create('scopa','people').click();
assert.equal(format('1').checked,true);
format('3').click();
assert.equal(format('3').checked,true);
get('cancel-creation').click();
lobbySocket.onmessage({data:JSON.stringify({...payload(),games:[]})});
create('scopa','solo').click();
assert.equal(get('creation-format').hidden,true);
assert.equal(get('confirm-creation').textContent,'Avvia partita');
get('creation-seats').value='4';
const defaultFetch=w.fetch;
let failCreation=true,startCalls=0,dismissals=0;
w.fetch=async(path,opts)=>{
 if(path==='/api/create'){
  const body=JSON.parse(opts.body);
  if(body.mode==='ai'){
   assert.deepEqual(body,{game:'scopa',target:1,mode:'ai',seats:4});
   if(failCreation){failCreation=false;return Response.json({error:'Riprova'},{status:503});}
   state={...state,phase:'playing',game:'scopa',scopa:scopaView(initialScopa(4),0),scarabeo:null,players:[players[0],...Array.from({length:3},(_,i)=>({id:'bot:'+i,name:'AI '+i,bot:true}))],turn:0,mode:'ai',revision:51};
  }else{
   assert.deepEqual(body,{game:'scopa',target:3,mode:'people'});
   state={...state,phase:'waiting',players:[players[0]],mode:'people',revision:52};
  }
  return Response.json({state,token:'test-token',player:user.player});
 }
 if(path.endsWith('/start')){
  startCalls++;
  assert.equal(JSON.parse(opts.body).revision,state.revision);
  if(startCalls===1){
   state={...state,revision:state.revision+1};
   return Response.json({error:'Il tavolo è cambiato'},{status:409});
  }
  state={...state,phase:'playing',revision:state.revision+1};
  return Response.json(state);
 }
 if(path.endsWith('/dismiss')){dismissals++;return Response.json({deleted:true});}
 if(path.endsWith('/rematch')){
  assert.equal(JSON.parse(opts.body).revision,state.revision);
  state={...state,phase:'waiting',players:[players[0]],revision:state.revision+1,matchId:'fresh',moves:[]};
  return Response.json({state,token:'test-token',player:user.player});
 }
 return defaultFetch(path,opts);
};
get('confirm-creation').click();await wait();
assert.equal(get('creation-dialog').hidden,false);
assert.equal(get('creation-error').textContent,'Riprova');
assert.equal(get('creation-seats').value,'4');
get('confirm-creation').click();await wait();
assert.equal(get('creation-dialog').hidden,true);
assert.equal(get('start-group').hidden,true);
assert.ok(get('room-number').textContent.includes('Singolo AI'));
w.__qa.showLobby();create('scopa','people').click();format('3').click();
get('confirm-creation').click();await wait();
assert.equal(get('start-group').disabled,true);
state={...state,players:[players[0],{id:'tg:2',name:'Ospite'}],revision:53};
w.__qa.render(state);
assert.equal(get('start-group').disabled,false);
get('start-group').click();await wait();
assert.equal(get('start-error').textContent,'Il tavolo è cambiato');
assert.equal(get('start-group').disabled,false);
get('start-group').click();await wait();
assert.equal(get('start-group').hidden,true);
assert.equal(startCalls,2);
state={...state,phase:'finished',revision:state.revision+1,expires:null,moves:[{description:'Ultima mossa'}]};
w.__qa.render(state);
assert.equal(get('newtable').hidden,false);
assert.equal(get('keep-table').hidden,false);
assert.match(get('table-retention').textContent,/Archivia partita/);
w.confirm=()=>true;
get('newtable').click();await wait();
assert.equal(get('newtable').hidden,true);
assert.equal(get('start-group').disabled,true);
assert.equal(state.moves.length,0);
state={...state,phase:'finished',revision:state.revision+1};
w.__qa.render(state);
get('back-lobby').click();
await wait();
assert.equal(dismissals,1);
assert.equal(get('lobby').hidden,false);
const chat=get('chat-messages');
Object.defineProperty(chat,'scrollHeight',{value:700});
chat.scrollTop=0;
lobbySocket.onmessage({data:JSON.stringify({...payload(),games:[],messages:[
 {id:'a',name:'Anna',userId:'2',at:1,text:'Primo'},
 {id:'b',name:'Fausto',userId:'1',at:2,text:'Ultimo'}
]})});
await wait();
assert.equal(chat.scrollTop,700);
assert.match(chat.lastElementChild.textContent,/Ultimo/);
assert.equal(get('chat-form').previousElementSibling,chat);
assert.deepEqual(errors,[]);dom.window.close();console.log('PASS UI: Scopa cards and captures, live tutorial, 5-seat solo setup, disabled solo tournaments, leaderboard text safety and out-of-turn human word validation, repeated creation, active tables, both rankings, latest chat and result dismissal.');
// Save only a synthetic preview outside the shipped source.
if(process.argv.includes('--preview')){
const preview=new URL('../../scopa-preview',import.meta.url).pathname;await fs.mkdir(preview+'/public',{recursive:true});await fs.mkdir(preview+'/.openai',{recursive:true});await fs.writeFile(preview+'/.openai/hosting.json',JSON.stringify({static:{directory:'public'}}));const html=(await fs.readFile('public/index.html','utf8')).replace(/<script type="module" src="[^\"]*app.js[^\"]*"><\/script>/,'<script src="/fixture.js"></script><script src="/app.js"></script>');await fs.writeFile(preview+'/public/index.html',html);await fs.writeFile(preview+'/public/app.js',bundle.outputFiles[0].text);await fs.cp('public/labyrinth',preview+'/public/labyrinth',{recursive:true});await fs.cp('public/safe-area.js',preview+'/public/safe-area.js');
const fixture=`window.Telegram={WebApp:{ready(){},expand(){},onEvent(){},initData:'preview'}};const qaUser=${JSON.stringify(user)};const qaState=${JSON.stringify({...state,game:'scopa',scopa:view,scarabeo:null,turn:0,tutorial:tutorial('scopa',view,0,0)})};const qaPayload=${JSON.stringify(payload())};window.WebSocket=class{constructor(url){this.readyState=1;setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify(url.endsWith('/api/lobby/ws')?qaPayload:qaState)})},10)}send(){}close(){this.readyState=3}};window.fetch=async(path)=>Response.json(path==='/api/session'?{user:qaUser,token:'synthetic'}:path.startsWith('/api/leaderboard')?{...qaPayload,pending:false}:path==='/api/lobby'?qaPayload:qaState);window.addEventListener('load',()=>{setTimeout(()=>window.__qa.openRoom(qaState.room,true),200)});`;
await fs.writeFile(preview+'/public/fixture.js',fixture);

}
