import {build} from 'esbuild';
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initialScopa,scopaView} from '../scopa.js';
import {initialScarabeo,scarabeoView,playScarabeo} from '../scarabeo.js';
import {tutorial} from '../table-ai.js';
import * as labCore from '../public/labyrinth/core.js';
import * as labAdventure from '../public/labyrinth/adventure.js';
import * as labTraps from '../public/labyrinth/traps.js';
import {renderBriscola} from '../public/sea-cards-ui.js';
import {sicilianSVG} from '../public/sicilian-cards.js';
import * as labSpring from '../public/labyrinth/spring.js';
import {CAMPAIGN_LENGTH} from '../public/moto-trial/courses.js';
import {drawTrial} from '../public/moto-trial/render.js';
import * as trialPhysics from '../public/moto-trial/physics.js';
import {FrameBudget} from '../public/labyrinth/performance.js';
const source=await fs.readFile('public/app.js','utf8');
const exposed='\nwindow.__qa={render,createGame,showLobby,openRoom,selectPage,canMove};';
const importLines=/^import .+;$/gm;
const root=process.cwd()+'/public';
const imports=await build({stdin:{
 contents:source.match(importLines).join('\n')+'\nObject.assign(window,{renderScopa,renderNaval,renderBriscola,renderScarabeo,safeInsets,applyInsets,viewportHeight,CAMPAIGNS,campaignInfo,DEFAULT_CAMPAIGN,golfColors,readAppearance});',
 resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser'});

const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(await fs.readFile('public/index.html','utf8'),{url:'https://unit.test',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:false,addEventListener(){}});w.Telegram={WebApp:{platform:'android',ready(){},expand(){},onEvent(){},initData:'test-fixture'}};
const room='11111111-1111-4111-8111-111111111111',players=[{id:'tg:1',name:'Fausto'},{id:'bot:1',name:'AI 1',bot:true}],user={id:'1',player:'tg:1',name:'Fausto'},scopa=initialScopa(2),view=scopaView(scopa,0);let state={room,number:1,phase:'playing',game:'scopa',players,turn:0,revision:0,moves:[],scopa:view,mode:'tutorial',tutorial:tutorial('scopa',view,0,0),expires:Date.now()+86400000};const payload=()=>({games:[state],users:[],messages:[],leaderboard:[{id:'tg:9',name:'Anna <b>',wins:5,games:{scopa:3,chess:2}}],aiLeaderboard:[{id:'tg:1',name:'Fausto',wins:2,games:{scopa:2}}]});
let lobbySocket,cinemaSocket;
const cinemaMessages=[],cinemaId="cinema-fixture",cinemaRooms=[{id:cinemaId,number:1,channel:"Canale Uno",viewers:[{name:"Fausto"}]}];
w.WebSocket=class{
 constructor(url){
  this.url=url;this.readyState=1;this.bufferedAmount=0;
  if(url.endsWith('/api/lobby/ws'))lobbySocket=this;
  if(url.endsWith('/api/cinema/ws'))cinemaSocket=this;
  w.setTimeout(()=>{
   this.onopen?.();
   const initial=this===lobbySocket?payload():this===cinemaSocket?{type:'rooms',rooms:cinemaRooms,active:null}:state;
   this.onmessage?.({data:JSON.stringify(initial)});
  },1);
 }
 send(raw){if(this===cinemaSocket)cinemaMessages.push(JSON.parse(raw));}
 close(){this.readyState=3;}
};
w.fetch=async(path,opts)=>Response.json(path==='/api/session'?{user,token:'synthetic'}:path.startsWith('/api/leaderboard')?{...payload(),pending:false}:path==='/api/lobby'?payload():state);
w.localStorage.setItem('binotto-golf-ball',JSON.stringify(['#a11293','#197b61']));
w.eval(imports.outputFiles[0].text);w.eval(source.replace(importLines,'')+exposed);await new Promise(r=>setTimeout(r,50));assert.equal(w.document.getElementById('app-shell').hidden,false);assert.equal(w.document.querySelector('input[type=password]'),null);await w.__qa.openRoom(room,true);assert.equal(w.document.querySelectorAll('#scopa-area .briscola-hand button').length,3);assert.equal(w.document.querySelectorAll('#scopa-area .briscola-table .sicilian-card').length,4);assert.equal(w.document.getElementById('tutorial-panel').hidden,false);assert.ok(w.document.getElementById('tutorial-reason').textContent.length);assert.equal(w.document.getElementById('create-cluedo'),null);
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
assert.equal(get('tutorial-labyrinth'),null);
assert.equal(get('solo-labyrinth').textContent,'Dev Mode');
assert.match(get('leaderboard-multi').querySelector('details summary').textContent,/Anna/);
assert.equal(get('leaderboard-multi').querySelector('details').open,false);
const golfBall=get('golf-ball-preview'),separateColors=get('golf-ball-separate'),golfPalette=get('golf-ball-colors');
const ballColors=()=>['--ball-top','--ball-bottom'].map(name=>golfBall.style.getPropertyValue(name));
const colorButton=(group,name)=>w.document.querySelector('[aria-label="'+group+' · '+name+'"]');
assert.deepEqual(ballColors(),['#66b8cf','#3c62a3']);
assert.equal(golfPalette.hidden,true);
colorButton('Maglietta','Corallo').click();colorButton('Pantaloncini','Verde').click();
assert.deepEqual(ballColors(),['#cf514d','#529766']);
separateColors.click();
assert.equal(golfPalette.hidden,false);
assert.deepEqual(ballColors(),['#a11293','#197b61'],'Previously saved Golf colors remain available');
assert.ok(colorButton('Pallina · Sopra','Colore precedente'));
colorButton('Pallina · Sopra','Giallo').click();colorButton('Pallina · Sotto','Viola').click();
assert.deepEqual(ballColors(),['#e5be43','#8662b1']);
assert.deepEqual(JSON.parse(w.localStorage.getItem('labyrinth-appearance')),{shirt:'#cf514d',shorts:'#529766'});
separateColors.click();
assert.deepEqual(ballColors(),['#cf514d','#529766']);
separateColors.click();
assert.deepEqual(ballColors(),['#e5be43','#8662b1']);
separateColors.click();
get('solo-labyrinth').click();
assert.equal(get('labyrinth-frame').getAttribute('src'),'/labyrinth/index.html?dev=1&v=dev3');
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:get('labyrinth-frame').contentWindow,data:{type:'labyrinth:exit'}}));
assert.equal(get('catalog-platform-title').textContent,'Giochi 2D');
assert.equal(get('tab-games').textContent,'Giochi e Applicazioni');
assert.deepEqual([...get('page-games').querySelectorAll('.catalog-heading')].map(h=>h.id),['catalog-app-title','catalog-3d-title','catalog-platform-title','catalog-board-title']);
assert.match(get('cinema-rooms').textContent,/Sala 1Canale Uno.*Fausto/);
get('cinema-rooms').querySelector('button').click();
const cinemaFrame=get('cinema-frame');
const cinemaEvent=type=>w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:cinemaFrame.contentWindow,data:{type:'cinema:'+type}}));
assert.equal(cinemaFrame.getAttribute('src'),'/cinema/index.html?v=3');
cinemaEvent('ready');
assert.deepEqual(cinemaMessages.at(-1),{type:'enter',room:cinemaId});
cinemaSocket.onmessage({data:JSON.stringify({type:'rooms',rooms:cinemaRooms,active:{id:cinemaId}})});
cinemaSocket.onmessage({data:JSON.stringify({type:'room-closed',id:cinemaId})});
assert.equal(get('cinema-overlay').hidden,true);
assert.equal(get('page-game').hidden,false);
assert.match(get('cinema-lobby-status').textContent,/chiusa/);
get('open-cinema').click();
cinemaEvent('ready');
assert.deepEqual(cinemaMessages.at(-1),{type:'create'});
cinemaEvent('exit');
assert.equal(get('cinema-overlay').hidden,true);

assert.equal(get('moto-course'),null);
get('play-moto-trial').click();
const motoFrame=get('moto-trial-frame');
assert.equal(get('moto-trial-overlay').hidden,false);
assert.equal(motoFrame.getAttribute('src'),'/moto-trial/index.html?v=9');
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w,data:{type:'moto-trial:exit'}}));
assert.equal(get('moto-trial-overlay').hidden,false);
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:motoFrame.contentWindow,data:{type:'moto-trial:exit'}}));
assert.equal(get('moto-trial-overlay').hidden,true);
const raceFixture={room:'22222222-2222-4222-8222-222222222222',number:2,seed:1,courseVersion:8,campaign:true,players:[]};
const beforeRaceFetch=w.fetch;
let requestedCourse;
w.fetch=async(path,opts)=>{
 if(path!=='/api/create'||JSON.parse(opts.body).game!=='moto-trial')return beforeRaceFetch(path,opts);
 requestedCourse=JSON.parse(opts.body).courseId;
 return Response.json({state:raceFixture});
};
get('create-moto-trial').click();
await new Promise(resolve=>setTimeout(resolve,30));
assert.equal(get('moto-trial-overlay').hidden,false);
assert.equal(motoFrame.getAttribute('src'),'/moto-trial/index.html?multiplayer=1&v=9');
assert.equal(requestedCourse,undefined);
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:motoFrame.contentWindow,data:{type:'moto-trial:exit'}}));
assert.equal(get('moto-trial-overlay').hidden,true);
w.fetch=beforeRaceFetch;


assert.equal(get('golf-campaign').options.length,3);
get('golf-campaign').value='coast';
get('play-golf').click();
assert.equal(get('golf-collision-choice').hidden,true);
get('golf-setup-confirm').click();
const golfFrame=get('golf-frame');
assert.equal(get('golf-overlay').hidden,false);
assert.equal(golfFrame.getAttribute('src'),'/golf/index.html?v=12&campaign=coast');
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:golfFrame.contentWindow,data:{type:'golf:exit'}}));
assert.equal(get('golf-overlay').hidden,true);

const lobbyGolf={room:'33333333-3333-4333-8333-333333333333',number:3,game:'golf',phase:'playing',capacity:8,hole:0,
 players:[{id:'tg:8',name:'Ospite'}],revision:2};
lobbySocket.onmessage({data:JSON.stringify({...payload(),games:[lobbyGolf]})});
const golfLobbyButton=get('games').querySelector('button');
assert.equal(golfLobbyButton.textContent,'Guarda');
assert.equal(golfLobbyButton.disabled,false);
const previousFetch=w.fetch,golfCalls=[];
w.fetch=async(path,opts)=>{
 if(!path.startsWith('/api/golf/'))return previousFetch(path,opts);
 golfCalls.push([path,opts.method]);
 return Response.json({state:lobbyGolf,now:Date.now()});
};
golfLobbyButton.click();
await new Promise(resolve=>setTimeout(resolve,30));
assert.deepEqual(golfCalls,[['/api/golf/'+lobbyGolf.room+'/state','GET']]);
assert.equal(golfFrame.getAttribute('src'),'/golf/index.html?v=12&online=1');
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:golfFrame.contentWindow,data:{type:'golf:exit'}}));
let golfCreate;
w.fetch=async(path,opts)=>{
 if(path!=='/api/create')return previousFetch(path,opts);
 golfCreate=JSON.parse(opts.body);
 return Response.json({state:{...lobbyGolf,phase:'waiting',players:[{id:'tg:1',name:'Fausto'}]},now:Date.now()});
};
get('create-golf').click();
assert.equal(get('golf-setup').hidden,false);
assert.equal(get('golf-collision-choice').hidden,false);
get('golf-setup-confirm').click();
await new Promise(resolve=>setTimeout(resolve,30));
assert.deepEqual(golfCreate,{game:'golf',appearance:['#cf514d','#529766'],campaign:'coast',collisions:false});
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:golfFrame.contentWindow,data:{type:'golf:exit'}}));
separateColors.click();
get('create-golf').click();
get('golf-collisions').click();
get('golf-setup-confirm').click();
await new Promise(resolve=>setTimeout(resolve,30));
assert.deepEqual(golfCreate,{game:'golf',appearance:['#e5be43','#8662b1'],campaign:'coast',collisions:true});
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:golfFrame.contentWindow,data:{type:'golf:exit'}}));
w.fetch=previousFetch;

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
const layout=new JSDOM(await fs.readFile('public/index.html','utf8'));
for(const card of layout.window.document.querySelectorAll('.catalog-card')){
 const header=card.querySelector('.catalog-card-title');
 assert.ok(header.querySelector('.catalog-icon')&&header.querySelector('h3'));
}
globalThis.document=layout.window.document;
for(const variant of ['classic','called']){
 const hand=[10,3,8,1,9,2,7,4].slice(0,variant==='classic'?3:8).map(rank=>({rank,suit:1,id:rank+9}));
 if(variant==='classic')hand[2]={rank:1,suit:1,id:10};
 renderBriscola({variant,phase:'play',hand,callOptions:[],trick:[],lastEvent:'In corso'}, {players:[{name:'Uno'},{name:'Due'}],seat:0,active:true});
 const cards=[...globalThis.document.querySelectorAll('#briscola-hand button')].map(node=>node.getAttribute('aria-label').split(' ')[0]);
 assert.deepEqual(cards,variant==='classic'?['Asso','3','Re']:['Asso','3','Re','Cavallo','Fante','7','4','2']);
}
delete globalThis.document;
layout.window.close();
for(const rank of [8,9,10]){
 const card=sicilianSVG({rank,suit:1});
 assert.equal((card.match(new RegExp('>'+rank+'</text>','g'))||[]).length,2);
}
// Telegram embeds Labyrinth in a sandbox where native confirm is suppressed.
const labHtml=await fs.readFile('public/labyrinth/index.html','utf8');
const labScript=(await fs.readFile('public/labyrinth/game.js','utf8')).replace(/^import .*;\n/gm,'');
const labDom=new JSDOM(labHtml,{url:'https://unit.test/labyrinth/index.html?dev=1',runScripts:'outside-only',pretendToBeVisual:true});
const lab=labDom.window,labGet=id=>lab.document.getElementById(id);
Object.assign(lab,labCore,labAdventure,labTraps,labSpring,{FrameBudget});
lab.matchMedia=()=>({matches:false});
let locked=null,lockRequests=0;
Object.defineProperty(lab.document,'pointerLockElement',{get:()=>locked});
const lockChange=()=>lab.document.dispatchEvent(new lab.Event('pointerlockchange'));
labGet('scene').requestPointerLock=()=>{lockRequests++;locked=labGet('scene');lockChange()};
lab.document.exitPointerLock=()=>{locked=null;lockChange()};
const mKey=(repeat=false)=>lab.dispatchEvent(new lab.KeyboardEvent('keydown',{code:'KeyM',repeat}));
lab.confirm=()=>{throw Error('Native confirmation is unavailable')};
lab.readAppearance=()=>({shirt:'#66b8cf',shorts:'#3c62a3'});
lab.avatarSprite=()=>lab.document.createElement('canvas');
lab.Renderer=class{load(world){this.world=world}draw(){}};
lab.Atmosphere=class{constructor(enabled){this.enabled=enabled}active(){}resume(){}};
const oldRun={...labAdventure.newRun(41),level:4,inventoryLayout:undefined,inventory:['key:4','pass']};
const storageKey='binottoland-labyrinth-v2-guest';
lab.localStorage.setItem(storageKey,JSON.stringify(oldRun));
lab.eval(labScript+
 '\nwindow.__labTest={tick:()=>tick(lastTime+16),action:()=>actionState.remaining,resetSwing:()=>{actionState.remaining=actionState.cooldown=0}};');
assert.equal(labGet('fullscreen'),null);assert.equal(labGet('sprint'),null);assert.equal(labGet('hand-view'),null);
assert.equal(labGet('new-run').hidden,false);
assert.equal(labGet('test-travel').hidden,false);
assert.equal(labGet('guide-option').hidden,false);
assert.equal(labGet('guide').hidden,false);
labGet('guide-toggle').click();
assert.equal(labGet('guide').hidden,true);
labGet('guide-toggle').click();
assert.equal(labGet('guide').hidden,false);
const initialSlots=labGet('inventory').querySelectorAll('button');
assert.equal(initialSlots.length,4);
assert.equal(initialSlots[0].getAttribute('aria-label'),'Mano D · Keycard');
assert.equal(initialSlots[2].getAttribute('aria-label'),'Tasca 1 · Passe-partout');
labGet('new-run').click();assert.equal(labGet('new-run-confirm').hidden,false);
labGet('new-run-cancel').click();assert.equal(labGet('new-run-confirm').hidden,true);
assert.equal(JSON.parse(lab.localStorage.getItem(storageKey)).level,4);
labGet('start').click();assert.equal(locked,labGet('scene'));
mKey();assert.equal(locked,null);assert.equal(labGet('menu').hidden,true);
mKey(true);assert.equal(locked,null);
labGet('scene').dispatchEvent(new lab.MouseEvent('mousedown',{button:0}));
assert.equal(lockRequests,1);
initialSlots[2].click();
assert.equal(labGet('menu').hidden,true);assert.equal(locked,null);
mKey();assert.equal(locked,labGet('scene'));assert.equal(lockRequests,2);
assert.deepEqual(JSON.parse(lab.localStorage.getItem(storageKey)).inventory,['pass',null,'key:4']);
assert.equal(labGet('health-meter').value,100);
labGet('scene').dispatchEvent(new lab.MouseEvent('mousedown',{button:2,cancelable:true}));
assert.equal(labGet('guard').getAttribute('aria-pressed'),'true');
lab.dispatchEvent(new lab.KeyboardEvent('keydown',{code:'KeyF'}));
assert.ok(lab.__labTest.action()>0,'Attacks work while guarding');
lab.dispatchEvent(new lab.KeyboardEvent('keydown',{code:'ControlLeft'}));
lab.__labTest.tick();assert.equal(labGet('crouch').getAttribute('aria-pressed'),'true');
lab.dispatchEvent(new lab.KeyboardEvent('keyup',{code:'ControlLeft'}));
lab.__labTest.tick();assert.equal(labGet('crouch').getAttribute('aria-pressed'),'false');
labGet('crouch').click();lab.__labTest.tick();assert.equal(labGet('crouch').getAttribute('aria-pressed'),'true');
labGet('crouch').click();lab.__labTest.tick();assert.equal(labGet('crouch').getAttribute('aria-pressed'),'false');

lab.dispatchEvent(new lab.MouseEvent('mouseup',{button:2}));
assert.equal(labGet('guard').getAttribute('aria-pressed'),'false');
const touchPointer=(type,id,isPrimary)=>Object.assign(new lab.Event(type,{cancelable:true}),{pointerId:id,pointerType:'touch',isPrimary});
labGet('guard').dispatchEvent(touchPointer('pointerdown',1,true));
assert.equal(labGet('guard').getAttribute('aria-pressed'),'true');
lab.__labTest.resetSwing();
labGet('action').dispatchEvent(touchPointer('pointerdown',2,false));
assert.ok(lab.__labTest.action()>0,'A second touch can strike while the first holds guard');
assert.equal(labGet('guard').getAttribute('aria-pressed'),'true');
labGet('guard').dispatchEvent(touchPointer('pointercancel',1,true));
assert.equal(labGet('guard').getAttribute('aria-pressed'),'false');
lab.dispatchEvent(new lab.KeyboardEvent('keydown',{code:'Escape'}));
labGet('new-run').click();labGet('new-run-start').click();
assert.equal(labGet('menu').hidden,true);
const restarted=JSON.parse(lab.localStorage.getItem(storageKey));
assert.equal(restarted.level,1);assert.deepEqual(restarted.inventory,[]);
lab.dispatchEvent(new lab.KeyboardEvent('keydown',{code:'Escape'}));
labGet('test-floor').value='6';
labGet('test-travel-go').click();
assert.equal(labGet('floor').textContent,'COLOSSEO');
assert.equal(labGet('guide').hidden,true);
lab.dispatchEvent(new lab.KeyboardEvent('keydown',{code:'Escape'}));
labGet('dev-kit').click();
assert.deepEqual(JSON.parse(lab.localStorage.getItem(storageKey)).inventory,['sword','shield','pass']);
assert.equal(labGet('inventory').querySelectorAll('.inventory-slot').length>=8,true);
labDom.window.close();

{
 const mode='multiplayer';
 const instance=new JSDOM(labHtml,{url:'https://unit.test/labyrinth/index.html?'+mode+'=1&dev=1',runScripts:'outside-only',pretendToBeVisual:true});
 const child=instance.window,find=id=>child.document.getElementById(id);
 Object.assign(child,labCore,labAdventure,labTraps,labSpring,{FrameBudget,matchMedia:()=>({matches:false}),
   readAppearance:lab.readAppearance,Renderer:lab.Renderer,Atmosphere:lab.Atmosphere});
 child.eval(labScript+'\nwindow.__labMode={level:()=>level,receive:receiveState,assign:value=>{multiplayer=value}};');
 {
  const state={room:'qa',seed:41,revision:0,players:[],floors:{},cases:[]};
  child.__labMode.assign({room:'qa',state,watch:true});
  child.__labMode.receive(state);
 }
 assert.equal(find('guide').hidden,true,mode);
 assert.equal(find('guide-option').hidden,true,mode);
 assert.equal(find('test-travel').hidden,true,mode);
 find('test-floor').value='6';find('test-travel-go').click();find('dev-kit').click();
 assert.equal(child.__labMode.level(),1);
 instance.window.close();
}
console.log('PASS Labyrinth menu: reset uses an in-app confirmation, cancel preserves progress, restart saves floor one and there is no fullscreen button.');

const trialHtml=await fs.readFile('public/moto-trial/index.html','utf8');
const trialOptions={runScripts:'outside-only',pretendToBeVisual:true};
const trialDom=new JSDOM(trialHtml,{...trialOptions,url:'https://unit.test/moto-trial/index.html?course=4'});
const trial=trialDom.window, trialGet=id=>trial.document.getElementById(id);
Object.assign(trial,trialPhysics,{CAMPAIGN_LENGTH,drawTrial,applyInsets(){}});
trial.AudioContext=class{constructor(){throw Error('Audio blocked by the webview')}};
const trialAudioScript=(await fs.readFile('public/moto-trial/audio.js','utf8')).replace('export class','class')+'\nwindow.TrialAudio=TrialAudio;';
trial.eval(trialAudioScript);
trial.matchMedia=()=>({matches:true});
let signs=0;
trialGet('trail').getBoundingClientRect=()=>({width:1280,height:720});
trialGet('trail').getContext=()=>new Proxy({
 roundRect:undefined,rect(){signs++},createLinearGradient:()=>({addColorStop(){}})
},{get:(target,key)=>key in target?target[key]:()=>{}});
const trialScript=(await fs.readFile('public/moto-trial/game.js','utf8')).replace(/^import .*;\n/gm,'');
trial.eval(trialScript+
 '\nwindow.__trialTest={tick:()=>tick(lastFrame+32),bike:()=>bike,seed:()=>course.seed,mode:()=>mode};');
assert.equal(trial.__trialTest.seed(),1,'A query parameter cannot skip levels');
assert.equal(trialGet('course-picker'),null);
trialGet('primary').click();
assert.equal(trialGet('controls').hidden,false);
assert.equal(trialGet('sound').getAttribute('aria-pressed'),'false');
assert.match(trialGet('cue').textContent,/Gas/);
const trialKey=(type,code,repeat=false)=>trial.dispatchEvent(new trial.KeyboardEvent(type,{code,repeat,cancelable:true}));
trialKey('keydown','Space');
trialKey('keydown','Space',true);
assert.equal(trial.__trialTest.bike().facing,-1,'Holding Space must only turn once');
const throttle=trial.document.querySelector('[data-hold="throttle"]');
const trialTouch=(type,id)=>Object.assign(new trial.Event(type,{bubbles:true,cancelable:true}),{pointerType:'touch',pointerId:id,button:0});
throttle.dispatchEvent(trialTouch('pointerdown',1));
trialGet('turn').dispatchEvent(trialTouch('pointerdown',2));
assert.equal(trial.__trialTest.bike().facing,1,'A second finger can turn while the first holds throttle');
trial.__trialTest.tick();
assert.ok(trial.__trialTest.bike().vx>0);
assert.ok(signs>0,'Road signs render without Canvas roundRect');
throttle.dispatchEvent(trialTouch('pointercancel',1));
assert.equal(throttle.hasAttribute('data-held'),false);
trialKey('keydown','Escape');
assert.equal(trialGet('title').textContent,'In pausa');
trialGet('primary').click();
assert.equal(trial.__trialTest.seed(),1);
assert.equal(trial.__trialTest.mode(),'ride');
const failedBike=trial.__trialTest.bike();
failedBike.x=9;failedBike.status='crash';
trial.__trialTest.tick();
assert.equal(trial.__trialTest.mode(),'crash');
const crashedSeed=trial.__trialTest.seed();
await new Promise(resolve=>setTimeout(resolve,1180));
assert.equal(trial.__trialTest.seed(),crashedSeed);
assert.equal(trial.__trialTest.bike().x,4);
assert.equal(trial.__trialTest.mode(),'ride');
trial.__trialTest.bike().status='finish';
trial.__trialTest.tick();
assert.equal(trialGet('primary').textContent,'Prossimo livello');
assert.equal(trial.localStorage.getItem('binottoland-moto-trial-campaign'),'2');
trialGet('primary').click();
assert.equal(trial.__trialTest.seed(),crashedSeed+1);
assert.equal(trial.__trialTest.mode(),'ready');
trialKey('keydown','KeyW');
trial.__trialTest.tick();
assert.equal(trial.__trialTest.mode(),'ride');
assert.ok(trial.__trialTest.bike().vx>0);
trialKey('keyup','KeyW');
trial.__trialTest.bike().status='offCourse';
trial.__trialTest.tick();
assert.equal(trialGet('title').textContent,'Fuori pista');
assert.equal(trialGet('primary').textContent,'Torna al via');
await new Promise(resolve=>setTimeout(resolve,1180));
assert.equal(trial.__trialTest.mode(),'offCourse','Only helmet contact restarts automatically');
trialGet('primary').click();
trial.__trialTest.bike().status='finish';
trial.__trialTest.tick();
assert.match(trialGet('description').textContent,/0 cadute/);
trialDom.window.close();
const raceDom=new JSDOM(trialHtml,{...trialOptions,url:'https://unit.test/moto-trial/index.html?multiplayer=1'});
const raceWindow=raceDom.window,raceGet=id=>raceWindow.document.getElementById(id);
Object.assign(raceWindow,trialPhysics,{CAMPAIGN_LENGTH,drawTrial,applyInsets(){},matchMedia:()=>({matches:false})});
raceGet('trail').getContext=()=>null;
raceWindow.eval(trialAudioScript);
raceWindow.eval(trialScript+'\nwindow.__raceTest={receive:receiveRace,mode:()=>mode,tick:()=>tick(lastFrame+32),bike:()=>bike};');
raceWindow.__raceTest.receive({state:raceFixture,player:'tg:1',connected:true});
assert.equal(raceGet('primary').disabled,true,'Socket open alone must not start a race');
raceWindow.__raceTest.receive({state:{...raceFixture,players:[{id:'tg:1',name:'Pilota',stage:1}]},player:'tg:1',connected:true});
assert.equal(raceGet('primary').disabled,false);
raceGet('primary').click();
assert.equal(raceWindow.__raceTest.mode(),'ride');
raceWindow.dispatchEvent(new raceWindow.KeyboardEvent('keydown',{code:'ArrowUp'}));
raceWindow.__raceTest.tick();
assert.ok(raceWindow.__raceTest.bike().vx>0);
raceDom.window.close();
console.log('PASS Moto Trial UI: launch and exit bridge, Space, two-finger throttle and turn, pause and sequential campaign progression, startup with unavailable audio and legacy Canvas, and multiplayer readiness.');

const golfHtml=await fs.readFile('public/golf/index.html','utf8');
const golfBundle=await build({stdin:{contents:(await fs.readFile('public/golf/game.js','utf8'))+'\nwindow.__golf={state:()=>state,camera:()=>camera,draw};',
 resolveDir:process.cwd()+'/public/golf'},bundle:true,write:false,format:'iife',platform:'browser'});
function golfFixture(search='',outfit=null){
 const instance=new JSDOM(golfHtml,{url:'https://unit.test/golf/'+(search||'?campaign=coast'),runScripts:'outside-only',pretendToBeVisual:true});
 const win=instance.window,find=id=>win.document.getElementById(id),green=find('green');
 Object.defineProperties(green,{clientWidth:{value:680},clientHeight:{value:320}});
 const labels=[],arcs=[],rotations=[];
 const gradient=()=>({addColorStop(){}});
 green.getContext=()=>new Proxy({arc(){arcs.push(this.fillStyle);},createLinearGradient:gradient,createRadialGradient:gradient,
   measureText:name=>({width:name.length*6}),fillText:name=>labels.push(name),rotate:angle=>rotations.push(angle)},{get:(target,key)=>target[key]??(()=>{})});
 if(outfit)win.localStorage.setItem('labyrinth-appearance',JSON.stringify(outfit));
 win.eval(golfBundle.outputFiles[0].text);
 return {instance,win,find,green,labels,arcs,rotations};
}
const golf=golfFixture('',{shirt:'#cf514d',shorts:'#529766'});
assert.equal(golf.find('course').textContent,'Porto di Corallo');
assert.ok(golf.arcs.includes('#cf514d'));
assert.deepEqual(Array.from(golf.win.__golf.state().players[0].appearance),['#cf514d','#529766']);
const pointer=(event,button,buttons,x,y)=>golf.green.dispatchEvent(Object.assign(
 new golf.win.MouseEvent(event,{clientX:x,clientY:y,button,buttons,cancelable:true}),{pointerId:1}));
const {yaw,pitch}=golf.win.__golf.camera();
let golfStamp=golf.win.performance.now();
const paintGolf=()=>golf.win.__golf.draw(golfStamp+=100);
assert.equal(pointer('contextmenu',2,0,340,220),false);
pointer('pointerdown',2,2,340,220);
pointer('pointermove',-1,2,440,190);
pointer('pointerup',2,0,440,190);
paintGolf();
assert.ok(golf.win.__golf.camera().yaw>yaw+.5);
assert.ok(golf.win.__golf.camera().pitch>pitch+.1);
assert.equal(Number(golf.find('aim').value),Math.round(golf.win.__golf.camera().yaw*1800/Math.PI)/10);
assert.equal(golf.win.__golf.state().players[0].strokes,0);
pointer('pointerdown',2,2,440,190);
pointer('pointermove',-1,2,340,220);
pointer('pointerup',2,0,340,220);
const initialRotation=golf.rotations.at(-1);
golf.find('zoom-in').click();
paintGolf();
const closeZoom=golf.win.__golf.camera().zoom;
assert.ok(closeZoom<.9);
const wheel=new golf.win.WheelEvent('wheel',{deltaY:180,cancelable:true});
golf.green.dispatchEvent(wheel);
paintGolf();
assert.ok(wheel.defaultPrevented&&golf.win.__golf.camera().zoom>1);
assert.equal(Number(golf.find('aim').value),Math.round(yaw*1800/Math.PI)/10,'Zoom keeps the shot direction');
pointer('pointerdown',0,1,340,220);
pointer('pointermove',-1,1,470,219);
assert.equal(golf.find('power-value').textContent,'0,5%');
assert.equal(Number(golf.find('aim').value),Math.round(yaw*1800/Math.PI)/10);
pointer('pointermove',-1,1,480,140);
paintGolf();
assert.equal(golf.find('power-value').textContent,'53,5%');
assert.equal(Math.abs(golf.win.__golf.camera().yaw-yaw)<1e-10,true);
pointer('pointerup',0,0,480,140);
const putt=golf.win.__golf.state().players[0].shot;
assert.ok(putt.samples.length>1,'Drag forward to play a shot');
const teeX=golf.win.__golf.camera().x;
golf.win.Date.now=()=>putt.at+1000;
paintGolf();
assert.ok(golf.win.__golf.camera().x>teeX+3,'The camera follows the rolling ball');
assert.notEqual(golf.rotations.at(-1),initialRotation,'The color seam follows the ball rotation');
for(let i=0;i<14;i++)golf.find('zoom-in').click();
paintGolf();paintGolf();
assert.ok(golf.win.__golf.camera().zoom<.34&&golf.find('zoom-in').disabled);
for(let i=0;i<14;i++)golf.find('zoom-out').click();
paintGolf();paintGolf();
assert.ok(golf.win.__golf.camera().zoom>3.3&&golf.find('zoom-out').disabled);
golf.find('scores').click();assert.equal(golf.find('card').hidden,false);
assert.equal(golf.find('score-head').querySelectorAll('th').length,12);
golf.find('scores').click();assert.equal(golf.find('card').hidden,true);
golf.instance.window.close();

const standaloneGolf=golfFixture('?choose=1');
assert.equal(standaloneGolf.find('route-picker').hidden,false);
assert.equal(standaloneGolf.win.document.body.classList.contains('golf-playing'),false);
standaloneGolf.find('route-choice').value='neon';
standaloneGolf.find('start').click();
standaloneGolf.win.__golf.draw();
assert.equal(standaloneGolf.find('route-title').textContent,'Circuito al Neon');
assert.ok(standaloneGolf.win.document.body.classList.contains('golf-playing'));
assert.equal(standaloneGolf.find('course').textContent,'Portale Viola');
assert.match(standaloneGolf.find('counter').textContent,/1 \/ 10/);
standaloneGolf.instance.window.close();

const golfOnline=golfFixture('?online=1'),now=Date.now();
const golfState={revision:1,phase:'playing',hole:0,deadline:now+60000,started:now,players:[
 {id:'me',name:'Io',color:0,position:[3,8],strokes:0},
 {id:'friend',name:'Amico',color:1,appearance:['#a11293','#197b61'],position:[3,8],strokes:0}
]};
golfOnline.win.dispatchEvent(new golfOnline.win.MessageEvent('message',{origin:'https://unit.test',source:golfOnline.win,
 data:{type:'golf:state',state:golfState,player:'me',now}}));
golfOnline.win.__golf.draw();
assert.ok(golfOnline.labels.includes('Amico'));
assert.ok(golfOnline.arcs.includes('#a11293'),'Opponents are drawn before their first putt');
assert.equal(golfOnline.find('close-game').hidden,false);
golfOnline.find('close-game').click();
assert.equal(golfOnline.find('close-confirm').hidden,false);
golfOnline.find('cancel-close').click();
assert.equal(golfOnline.find('close-confirm').hidden,true);
golfOnline.win.dispatchEvent(new golfOnline.win.MessageEvent('message',{origin:'https://unit.test',source:golfOnline.win,
 data:{type:'golf:state',state:{...golfState,revision:2},player:'spectator',now}}));
golfOnline.win.__golf.draw();
assert.equal(golfOnline.find('close-game').hidden,true);
assert.equal(golfOnline.find('controls').hidden,true);
assert.equal(golfOnline.find('watch-tools').hidden,false);
golfOnline.find('watch-player').value='friend';
golfOnline.find('watch-player').dispatchEvent(new golfOnline.win.Event('change'));
golfOnline.win.__golf.draw();
assert.match(golfOnline.find('status').textContent,/Segui Amico/);
golfOnline.instance.window.close();
console.log('PASS Golf UI: hub launch, locked left-button aim, granular charge, expanded zoom, rolling ball, spectators and room controls.');

const cinemaBundle=await build({entryPoints:['public/cinema/cinema.js'],bundle:true,write:false,format:'iife',platform:'browser'});
const cinemaDOM=new JSDOM(await fs.readFile('public/cinema/index.html','utf8'),{url:'https://unit.test/cinema/',runScripts:'outside-only',virtualConsole:vc});
const cw=cinemaDOM.window,cinemaElement=id=>cw.document.getElementById(id),frameCommands=[];
cw.matchMedia=()=>({matches:true,addEventListener(){}});
cw.fetch=async()=>{throw Error('Offline in UI test');};
cw.HTMLMediaElement.prototype.pause=function(){};
cw.HTMLMediaElement.prototype.load=function(){};
cw.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
cw.HTMLDialogElement.prototype.close=function(value=''){
 this.returnValue=value;this.open=false;this.dispatchEvent(new cw.Event('close'));
};
cw.postMessage=packet=>frameCommands.push(packet);
cw.eval(cinemaBundle.outputFiles[0].text);
const frameMessage=(type,data)=>cw.dispatchEvent(new cw.MessageEvent('message',{origin:cw.location.origin,source:cw,data:{type:'cinema:'+type,...data}}));
frameMessage('connection',{connected:true});
const otherRoom={id:'other',number:2,channel:'Canale Due',viewers:[{name:'Ospite'}]};
const activeCinema={id:cinemaId,canClose:true,channel:null};
frameMessage('packet',{packet:{type:'rooms',rooms:[...cinemaRooms,otherRoom],active:activeCinema}});
assert.equal(cinemaElement('remote'),null);
assert.deepEqual([...cinemaElement('sidebar').querySelectorAll('section')].map(el=>el.id),['favorites-panel','search-panel']);
cinemaElement('multisala').click();
assert.equal(cinemaElement('multisala-dialog').open,true);
assert.match(cinemaElement('multisala-rooms').textContent,/Sala 2Canale DueOspite/);
frameMessage('packet',{packet:{type:'rooms',rooms:[...cinemaRooms,{...otherRoom,channel:'Nuovo canale'}],active:activeCinema}});
assert.match(cinemaElement('multisala-rooms').textContent,/Nuovo canale/);
cinemaElement('multisala-rooms').querySelector('[data-room="other"]').click();
assert.equal(frameCommands.at(-1).action.room,'other');
assert.equal(cinemaElement('multisala-dialog').open,false);
let pickerOpened=false;
cinemaElement('watch-file').click=()=>{pickerOpened=true;};
cinemaElement('upload-video').click();
assert.equal(pickerOpened,true);
assert.equal(cinemaElement('watch-dialog').open,true);
assert.equal(cinemaElement('watch-type').value,'file');
assert.equal(cinemaElement('watch-url').disabled,true);
cinemaElement('watch-cancel').click();
cinemaElement('watch-together').click();
assert.equal(cinemaElement('watch-url').disabled,false);
cinemaElement('watch-cancel').click();
cinemaElement('close-room').click();
assert.equal(cinemaElement('close-dialog').open,true);
cinemaElement('close-dialog').close('close');
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(frameCommands.at(-1).action.type,'close-room');
await new Promise(resolve=>setTimeout(resolve,0));
cinemaDOM.window.close();
console.log('PASS Cinema UI: general Lobby, live Multisala, direct file picker and close confirmation.');

// Save only a synthetic preview outside the shipped source.
if(process.argv.includes('--preview')){
const bundle=await build({stdin:{contents:source+exposed,resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser'});
const preview=new URL('../../scopa-preview',import.meta.url).pathname;await fs.mkdir(preview+'/public',{recursive:true});await fs.mkdir(preview+'/.openai',{recursive:true});await fs.writeFile(preview+'/.openai/hosting.json',JSON.stringify({static:{directory:'public'}}));const html=(await fs.readFile('public/index.html','utf8')).replace(/<script type="module" src="[^\"]*app.js[^\"]*"><\/script>/,'<script src="/fixture.js"></script><script src="/app.js"></script>');await fs.writeFile(preview+'/public/index.html',html);await fs.writeFile(preview+'/public/app.js',bundle.outputFiles[0].text);await fs.cp('public/labyrinth',preview+'/public/labyrinth',{recursive:true});await fs.cp('public/moto-trial',preview+'/public/moto-trial',{recursive:true});await fs.cp('public/golf',preview+'/public/golf',{recursive:true});await fs.cp('public/safe-area.js',preview+'/public/safe-area.js');
const fixture=`window.Telegram={WebApp:{ready(){},expand(){},onEvent(){},initData:'preview'}};const qaUser=${JSON.stringify(user)};const qaState=${JSON.stringify({...state,game:'scopa',scopa:view,scarabeo:null,turn:0,tutorial:tutorial('scopa',view,0,0)})};const qaPayload=${JSON.stringify(payload())};window.WebSocket=class{constructor(url){this.readyState=1;setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify(url.endsWith('/api/lobby/ws')?qaPayload:qaState)})},10)}send(){}close(){this.readyState=3}};window.fetch=async(path)=>Response.json(path==='/api/session'?{user:qaUser,token:'synthetic'}:path.startsWith('/api/leaderboard')?{...qaPayload,pending:false}:path==='/api/lobby'?qaPayload:qaState);window.addEventListener('load',()=>{setTimeout(()=>window.__qa.openRoom(qaState.room,true),200)});`;
await fs.writeFile(preview+'/public/fixture.js',fixture);

}
