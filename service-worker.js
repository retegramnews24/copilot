// Fractal Art Explorer 4.7.1: always prefer current files, including JS/CSS.
const CACHE='fae-v4-7-1-artistic-refinement';
const CORE=['./','index.html','style.css','js/palettes.js','js/catalog.js','js/art-presets.js','js/render-worker.js','js/renderer3d.js','js/app.js','js/splash.js','assets/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const req=e.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==location.origin)return;
 e.respondWith((async()=>{const c=await caches.open(CACHE);try{const resp=await fetch(req,{cache:'no-store'});if(resp.ok)await c.put(req,resp.clone());return resp;}catch(err){const cached=await c.match(req,{ignoreSearch:true});if(cached)return cached;throw err;}})());
});
