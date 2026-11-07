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
assert.equal(get('solo-labyrinth').textContent,'Dev Mode');
get('solo-labyrinth').click();
assert.equal(get('labyrinth-frame').getAttribute('src'),'/labyrinth/index.html?dev=1&v=dev1');
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:get('labyrinth-frame').contentWindow,data:{type:'labyrinth:exit'}}));
assert.equal(get('catalog-platform-title').textContent,'Platform 2D');
assert.equal(get('moto-course'),null);
get('play-moto-trial').click();
const motoFrame=get('moto-trial-frame');
assert.equal(get('moto-trial-overlay').hidden,false);
assert.equal(motoFrame.getAttribute('src'),'/moto-trial/index.html?v=8');
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:w,data:{type:'moto-trial:exit'}}));
assert.equal(get('moto-trial-overlay').hidden,false);
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:motoFrame.contentWindow,data:{type:'moto-trial:exit'}}));
assert.equal(get('moto-trial-overlay').hidden,true);
const raceFixture={room:'22222222-2222-4222-8222-222222222222',number:2,seed:1,courseVersion:7,campaign:true,players:[]};
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
assert.equal(motoFrame.getAttribute('src'),'/moto-trial/index.html?multiplayer=1&v=8');
assert.equal(requestedCourse,undefined);
w.dispatchEvent(new w.MessageEvent('message',{origin:w.location.origin,source:motoFrame.contentWindow,data:{type:'moto-trial:exit'}}));
assert.equal(get('moto-trial-overlay').hidden,true);
w.fetch=beforeRaceFetch;


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

for(const mode of ['multiplayer','tutorial']){
 const instance=new JSDOM(labHtml,{url:'https://unit.test/labyrinth/index.html?'+mode+'=1&dev=1',runScripts:'outside-only',pretendToBeVisual:true});
 const child=instance.window,find=id=>child.document.getElementById(id);
 Object.assign(child,labCore,labAdventure,labTraps,labSpring,{FrameBudget,matchMedia:()=>({matches:false}),
   readAppearance:lab.readAppearance,Renderer:lab.Renderer,Atmosphere:lab.Atmosphere});
 child.eval(labScript+'\nwindow.__labMode={level:()=>level,receive:receiveState,assign:value=>{multiplayer=value}};');
 if(mode==='multiplayer'){
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

// Save only a synthetic preview outside the shipped source.
if(process.argv.includes('--preview')){
const preview=new URL('../../scopa-preview',import.meta.url).pathname;await fs.mkdir(preview+'/public',{recursive:true});await fs.mkdir(preview+'/.openai',{recursive:true});await fs.writeFile(preview+'/.openai/hosting.json',JSON.stringify({static:{directory:'public'}}));const html=(await fs.readFile('public/index.html','utf8')).replace(/<script type="module" src="[^\"]*app.js[^\"]*"><\/script>/,'<script src="/fixture.js"></script><script src="/app.js"></script>');await fs.writeFile(preview+'/public/index.html',html);await fs.writeFile(preview+'/public/app.js',bundle.outputFiles[0].text);await fs.cp('public/labyrinth',preview+'/public/labyrinth',{recursive:true});await fs.cp('public/moto-trial',preview+'/public/moto-trial',{recursive:true});await fs.cp('public/safe-area.js',preview+'/public/safe-area.js');
const fixture=`window.Telegram={WebApp:{ready(){},expand(){},onEvent(){},initData:'preview'}};const qaUser=${JSON.stringify(user)};const qaState=${JSON.stringify({...state,game:'scopa',scopa:view,scarabeo:null,turn:0,tutorial:tutorial('scopa',view,0,0)})};const qaPayload=${JSON.stringify(payload())};window.WebSocket=class{constructor(url){this.readyState=1;setTimeout(()=>{this.onopen?.();this.onmessage?.({data:JSON.stringify(url.endsWith('/api/lobby/ws')?qaPayload:qaState)})},10)}send(){}close(){this.readyState=3}};window.fetch=async(path)=>Response.json(path==='/api/session'?{user:qaUser,token:'synthetic'}:path.startsWith('/api/leaderboard')?{...qaPayload,pending:false}:path==='/api/lobby'?qaPayload:qaState);window.addEventListener('load',()=>{setTimeout(()=>window.__qa.openRoom(qaState.room,true),200)});`;
await fs.writeFile(preview+'/public/fixture.js',fixture);

}
