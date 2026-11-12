import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {initial,act,view} from '../simulator/engine.js';
const dom=new JSDOM(readFileSync('public/arcade/binotto-simulator.html','utf8'),{url:'https://test/arcade/binotto-simulator',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,s=initial(Date.now()),u={id:'1',name:'Test'};act(s,u,{action:'create'},Date.now());s.revision=1;
w.setInterval=()=>0;w.requestAnimationFrame=()=>0;w.fetch=async(url,opts)=>{if(opts.body){act(s,u,JSON.parse(opts.body),Date.now());s.revision++}return {ok:true,json:async()=>structuredClone(view(s,u,Date.now()))}};
const source=readFileSync('public/simulator/app.js','utf8').replace(/^import .*\n/gm,'').replace(/^/, 'const attachCanvas=()=>{},draw=()=>{},resetCamera=()=>{},getCamera=()=>({}),setCamera=()=>{},installPanelLayouts=()=>()=>{},saveView=()=>{},readView=()=>({}),replacePanelContent=(el,html)=>el.innerHTML=html;\n');
w.eval(source+'\nwindow.qa={accept,render,poll,getData:()=>data,tab:value=>{tab=value;render()},start:next=>{token="test";opened=true;tab="Scuderia";accept(next);render()}};');
w.qa.start(structuredClone(view(s,u,Date.now())));
const form=w.document.querySelector('[data-form="identity"]');form.elements.color0.value='#123456';form.elements.count.value='3';form.elements.color0.dispatchEvent(new w.Event('input',{bubbles:true}));
s.revision++;await w.qa.poll();assert.equal(w.document.querySelector('[name="color0"]').value,'#123456','poll must preserve unsaved livery');
const old=structuredClone(view(s,u,Date.now()));
form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
assert.equal(s.teams['1'].colors[0],'#123456');assert.equal(s.teams['1'].count,3);
w.qa.accept(old);assert.equal(w.qa.getData().me.colors[0],'#123456','late response must not undo saved livery');w.qa.render();assert.equal(w.document.querySelector('[name="color0"]').value,'#123456');
// Saving one driver's plan must preserve the other driver's edits.
w.qa.tab('Strategia');assert(![...w.document.querySelectorAll('#navigation button')].some(b=>b.textContent==='Telemetria'));assert.match(w.document.getElementById('main').textContent,/Strategia e telemetria/);
let forms=[...w.document.querySelectorAll('[data-form="strategy"]')];
for(const [i,f] of forms.entries()){f.elements.wing.value=String(61+i);f.elements.wing.dispatchEvent(new w.Event('input',{bubbles:true}));}
forms[0].dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
assert.equal(w.document.querySelector('[data-slot="1"]').elements.wing.value,'62','saving driver 1 must preserve driver 2 draft');
// Two submissions while the network is slow must both reach the server.
const normalFetch=w.fetch;w.fetch=async(...args)=>{await new Promise(r=>setTimeout(r,40));return normalFetch(...args)};
forms=[...w.document.querySelectorAll('[data-form="strategy"]')];
forms[0].elements.wing.value='71';forms[0].elements.wing.dispatchEvent(new w.Event('input',{bubbles:true}));
for(const f of forms)f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
await new Promise(r=>setTimeout(r,180));
assert.equal(s.teams['1'].strategies[0].wing,71);assert.equal(s.teams['1'].strategies[1].wing,62,'queued second save must not be discarded');
// Edits made during a save stay visible, and failed requests keep the draft.
let f=w.document.querySelector('[data-slot="0"]');
f.elements.wing.value='80';f.elements.wing.dispatchEvent(new w.Event('input',{bubbles:true}));f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
f.elements.wing.value='81';f.elements.wing.dispatchEvent(new w.Event('input',{bubbles:true}));
await new Promise(r=>setTimeout(r,80));assert.equal(s.teams['1'].strategies[0].wing,80);assert.equal(w.document.querySelector('[data-slot="0"]').elements.wing.value,'81');
w.fetch=async()=>{throw Error('Rete assente')};f=w.document.querySelector('[data-slot="0"]');f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
assert.equal(f.elements.wing.value,'81');assert.match(f.querySelector('[data-save-status]').textContent,/Non salvato/);
w.fetch=normalFetch;
w.qa.tab('Libere');assert(w.document.getElementById('session-clock'));assert.match(w.document.getElementById('session-info').textContent,/chiusura delle iscrizioni/);
w.qa.tab('Qualifiche');assert.match(w.document.getElementById('session-info').textContent,/calendario/);
w.qa.tab('Strategia');assert.match(w.document.getElementById('main').textContent,/Carico aerodinamico/);assert(!w.document.getElementById('main').textContent.includes('Ala /'));
w.qa.tab('Evento');assert(w.document.getElementById('event-live'));assert.match(w.document.getElementById('main').textContent,/Archivio campionati/);w.qa.tab('Telemetria');assert.match(w.document.getElementById('main').textContent,/Completa piloti/);assert(w.document.getElementById('connected-count'));
w.qa.tab('Paddock');let chat=w.document.querySelector('[data-form=chat]'),input=chat.elements.text;input.value='Bozza chat';input.dispatchEvent(new w.Event('input',{bubbles:true}));w.qa.render();chat=w.document.querySelector('[data-form=chat]');assert.equal(chat.elements.text.value,'Bozza chat');w.fetch=async()=>{throw Error('Rete assente')};chat.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(chat.elements.text.value,'Bozza chat');w.fetch=normalFetch;chat.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,40));assert.equal(chat.elements.text.value,'');assert.match(w.document.getElementById('chat').textContent,/Bozza chat/);
w.qa.tab('Strategia');let auto=w.document.querySelector('[data-form=strategy][data-slot="0"]');auto.elements.wing.value='72';auto.elements.wing.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,550));assert.equal(s.teams['1'].strategies[0].wing,72,'strategy autosaves without submit');assert.match(auto.querySelector('[data-save-status]').textContent,/automaticamente/);assert(!w.document.querySelector('[data-form=strategy] button[type=submit]'));
w.qa.tab('Scuderia');auto=w.document.querySelector('[data-form=identity]');auto.elements.color0.value='#654321';auto.elements.color0.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,550));assert.equal(s.teams['1'].colors[0],'#654321','livery autosaves');assert(!auto.querySelector('button[type=submit]'));
w.fetch=async()=>{throw Error('Offline')};auto.elements.name.value='Nome offline';auto.elements.name.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,550));assert.match(w.localStorage.getItem('simulator-autosave:1'),/Nome offline/);w.fetch=normalFetch;w.dispatchEvent(new w.Event('online'));await new Promise(r=>setTimeout(r,60));assert.equal(s.teams['1'].name,'Nome offline','automatic network retry');
w.qa.tab('Gara');const split=w.document.getElementById('split-width');const size=parseFloat(w.document.documentElement.style.getPropertyValue('--side'));split.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert(parseFloat(w.document.documentElement.style.getPropertyValue('--side'))>size);
dom.window.close();console.log('PASS settings UI: livery, both driver drafts, queued slow saves, edits during save, explicit network failure, stale response protection.');
