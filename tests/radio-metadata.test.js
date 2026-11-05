import assert from 'node:assert/strict';import {readICY,icyTitle,publicStreamURL,radioNowPlaying} from '../radio-metadata.js';
for(const url of ['http://radio.example.org/','https://localhost/','https://127.0.0.1/','https://[::1]/','https://2130706433/','https://user:pass@radio.example.org/','https://radio.internal/','https://radio.example.org:22/'])assert.equal(publicStreamURL(url),null,url);
assert.ok(publicStreamURL('https://radio.example.org/live'));
assert.equal(icyTitle(new TextEncoder().encode("StreamTitle='Artista - Canzone';StreamUrl='';")),'Artista - Canzone');
assert.equal(icyTitle(Uint8Array.from([...Buffer.from("StreamTitle='Caf"),233,...Buffer.from("';")])),'Café');
function icy(title,emptyFirst=false){const text=new TextEncoder().encode("StreamTitle='"+title+"';"),length=Math.ceil(text.length/16);return new Uint8Array([...(emptyFirst?[1,2,3,4,0]:[]),1,2,3,4,length,...text,...new Uint8Array(length*16-text.length),...new Uint8Array(32)])}
let cancelled=0;const bytes=icy('Artista – Titolo',true);let i=0;
const body=new ReadableStream({pull(c){if(i<bytes.length)c.enqueue(bytes.slice(i,i+=3))},cancel(){cancelled++}});
assert.equal(await readICY(new Response(body,{headers:{'icy-metaint':'4'}})),'Artista – Titolo');assert.equal(cancelled,1);
let rejected=false;const plain=new ReadableStream({cancel(){rejected=true}});assert.equal(await readICY(new Response(plain,{headers:{'icy-metaint':'999999'}})),null);assert.equal(rejected,true);
const station='f0000000-0000-0000-0000-000000000001';let calls=[];const native=globalThis.fetch;
globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url.includes('radio-browser.info'))return Response.json([{stationuuid:station,url_resolved:'https://radio.example.org/live'}]);return new Response(icy('Gruppo - Brano'),{headers:{'icy-metaint':'4'}})};
const values=await Promise.all([radioNowPlaying(station,'one'),radioNowPlaying(station,'two')]);assert.equal(values[0].title,'Gruppo - Brano');assert.equal(values[1].title,'Gruppo - Brano');assert.equal(calls.length,2);assert.equal(calls[1].options.headers['Icy-MetaData'],'1');assert.equal((await radioNowPlaying(station,'three')).title,'Gruppo - Brano');assert.equal(calls.length,2);
assert.equal(await radioNowPlaying('https://evil.test/','one'),null);
// Redirects to loopback are cancelled without fetching their destination.
const other='f0000000-0000-0000-0000-000000000002';calls=[];
globalThis.fetch=async(url,options)=>{calls.push(url);if(url.includes('radio-browser.info'))return Response.json([{stationuuid:other,url_resolved:'https://radio.example.org/redirect'}]);return new Response(null,{status:302,headers:{Location:'https://127.0.0.1/secret'}})};
assert.equal((await radioNowPlaying(other,'four')).title,null);assert.equal(calls.length,2);globalThis.fetch=native;
console.log('PASS metadata: chunked/empty ICY blocks, encoding fallback, bounded intervals and cancellation, UUID-only lookup, concurrent/cache reuse and blocked redirect.');
