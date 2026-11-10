import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {GroupSockets, GROUP_FORBIDDEN_CLOSE} from '../telegram-access.js';

const bot = 'synthetic-group-bot';
const group = '-1000000000001';
const required = {BOT_TOKEN:bot, TELEGRAM_GROUP_ACCESS_REQUIRED:'1'};
const configured = {...required, TELEGRAM_ALLOWED_GROUP_ID:group};
const scriptPath = resolve(process.argv[2] || '.test-bundle/worker.js');
const base = {
  rootPath:dirname(scriptPath), modulesRoot:dirname(scriptPath), modules:true, scriptPath,
  compatibilityDate:'2026-11-04', durableObjects:{ROOMS:{className:'Room',useSQLite:true}}
};
const states = new Map([
  [101, {status:'member'}], [102, {status:'left'}], [103, {status:'kicked'}],
  [104, {status:'restricted', is_member:true}], [105, {status:'restricted', is_member:false}],
  [106, {status:'administrator'}], [107, {status:'creator'}]
]);
async function telegram(request) {
  assert.equal(new URL(request.url).pathname, '/bot'+bot+'/getChatMember');
  const {chat_id, user_id} = await request.json();
  assert.equal(chat_id, Number(group));
  const member = states.get(user_id);
  return member ? Response.json({ok:true, result:member}) : new Response(null, {status:503});
}
const mac = (key, data) => createHmac('sha256',key).update(data).digest();
function initData(id) {
  const fields = new URLSearchParams({
    auth_date:String(Math.floor(Date.now()/1000)),
    user:JSON.stringify({id, first_name:'Test '+id})
  });
  const signed = [...fields].map(([key,value]) => key+'='+value).join('\n');
  fields.set('hash',mac(mac('WebAppData',bot),signed).toString('hex'));
  return fields.toString();
}
const app = new Miniflare(convertV4MiniflareOptions({...base, bindings:configured, outboundService:telegram}));
const missing = new Miniflare(convertV4MiniflareOptions({...base, bindings:required, outboundService:telegram}));
const old = new Miniflare(convertV4MiniflareOptions({...base, bindings:{BOT_TOKEN:bot}}));
const login = (runtime, id) => runtime.dispatchFetch('https://unit.test/api/session', {
  method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({initData:initData(id)})
});
try {
  for (const id of [102,103,105]) {
    const response = await login(app,id);
    assert.equal(response.status,403);
    assert.equal((await response.json()).code,'group_membership_required');
    assert.equal(response.headers.has('Set-Cookie'),false);
  }
  for (const id of [104,106,107]) assert.equal((await login(app,id)).status,200);
  assert.equal((await login(app,108)).status,503);
  assert.equal((await login(missing,101)).status,503);
  const oldToken = (await (await login(old,101)).json()).token;
  assert.equal((await app.dispatchFetch('https://unit.test/api/lobby', {
    headers:{Authorization:'Bearer '+oldToken}
  })).status,401);

  const {token} = await (await login(app,101)).json();
  const headers = {Authorization:'Bearer '+token};
  assert.equal((await app.dispatchFetch('https://unit.test/api/lobby',{headers})).status,200);
  const connection = await app.dispatchFetch('https://unit.test/api/lobby/ws',{
    headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'checkmate,'+token}
  });
  assert.equal(connection.status,101);
  const socket = connection.webSocket;
  socket.accept();
  socket.close(1000,'Test finito');
} finally {
  await Promise.all([app.dispose(),missing.dispose(),old.dispose()]);
}

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let now = Date.now();
let current = {status:'member'};
const work = [];
const sent = [];
let closeCode;
try {
  Date.now = () => now;
  globalThis.fetch = async () => Response.json({ok:true,result:current});
  const guard = new GroupSockets({waitUntil:promise => work.push(promise)},configured);
  const socket = {
    deserializeAttachment:() => ({groupAccess:{group,user:'111',until:now+60_000,expires:now+3600_000}}),
    send:data => sent.push(data),
    close:code => {closeCode = code;}
  };
  const proof = socket.deserializeAttachment();
  socket.deserializeAttachment = () => proof;
  guard.send(socket,'inside');
  assert.deepEqual(sent,['inside']);
  now += 60_001;
  current = {status:'left'};
  guard.send(socket,'private update');
  await Promise.all(work);
  assert.deepEqual(sent,['inside']);
  assert.equal(closeCode,GROUP_FORBIDDEN_CLOSE);
  assert.equal(await guard.authorize(socket),false);
} finally {
  Date.now = originalNow;
  globalThis.fetch = originalFetch;
}

console.log('PASS Telegram group access: members, outsiders, administrators, configuration, old sessions, lobby and revocation on a live socket.');
