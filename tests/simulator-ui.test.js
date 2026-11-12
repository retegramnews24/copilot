import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {initial,act,view} from '../simulator/engine.js';
const dom=new JSDOM(readFileSync('public/arcade/binotto-simulator.html','utf8'),{url:'https://test/arcade/binotto-simulator',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,s=initial(Date.now()),u={id:'1',name:'Test'};act(s,u,{action:'create'},Date.now());s.revision=1;
w.setInterval=()=>0;w.requestAnimationFrame=()=>0;w.fetch=async(url,opts)=>{if(opts.body){act(s,u,JSON.parse(opts.body),Date.now());s.revision++}return {ok:true,json:async()=>structuredClone(view(s,u,Date.now()))}};
const source=readFileSync('public/simulator/app.js','utf8').replace(/^import .*\n/,'const attachCanvas=()=>{},draw=()=>{},resetCamera=()=>{};\n');
w.eval(source+'\nwindow.qa={accept,render,poll,getData:()=>data,tab:value=>{tab=value;render()},start:next=>{token="test";opened=true;tab="Scuderia";accept(next);render()}};');
w.qa.start(structuredClone(view(s,u,Date.now())));
const form=w.document.querySelector('[data-form="identity"]');form.elements.color0.value='#123456';form.elements.count.value='3';form.elements.color0.dispatchEvent(new w.Event('input',{bubbles:true}));
s.revision++;await w.qa.poll();assert.equal(w.document.querySelector('[name="color0"]').value,'#123456','poll must preserve unsaved livery');
const old=structuredClone(view(s,u,Date.now()));
form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));
assert.equal(s.teams['1'].colors[0],'#123456');assert.equal(s.teams['1'].count,3);
w.qa.accept(old);assert.equal(w.qa.getData().me.colors[0],'#123456','late response must not undo saved livery');w.qa.render();assert.equal(w.document.querySelector('[name="color0"]').value,'#123456');
// Saving one driver's plan must preserve the other driver's edits.
w.qa.tab('Strategia');
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
dom.window.close();console.log('PASS settings UI: livery, both driver drafts, queued slow saves, edits during save, explicit network failure, stale response protection.');
