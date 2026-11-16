// Backups from your PC (needs the ADMIN_TOKEN secret set on the Worker, and the same value here).
//   PowerShell:  $env:ADMIN_TOKEN='...'; node scripts/backup.mjs list
//   node scripts/backup.mjs list                     -> saved backups (newest first)
//   node scripts/backup.mjs run                      -> make one now
//   node scripts/backup.mjs download <id>            -> save it as backups/<id>.json (folder ignored by git)
//   node scripts/backup.mjs restore <id> [names...]  -> put the data back (all, or only the named archives)
// BINOTTOLAND_URL changes the address (for example the staging Worker).
import { mkdirSync, writeFileSync } from 'node:fs';

const base = (process.env.BINOTTOLAND_URL || 'https://binottoland-motore.glauscat78.workers.dev').replace(
  /\/$/,
  ''
);
const token = process.env.ADMIN_TOKEN;
const [command, id, ...names] = process.argv.slice(2);
if (!token) {
  console.error('Imposta prima ADMIN_TOKEN (lo stesso valore del secret sul Worker).');
  process.exit(1);
}
const call = (path, method = 'GET', body) =>
  fetch(base + '/api/admin/backups' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body)
  });
const fail = async r => {
  console.error('Errore ' + r.status + ': ' + (await r.text()).slice(0, 300));
  process.exit(1);
};
const kb = n => Math.round(n / 1024) + ' KB';

if (command === 'list') {
  const r = await call('');
  if (!r.ok) await fail(r);
  const list = await r.json();
  if (!list.length) console.log('Nessun backup ancora.');
  for (const b of list)
    console.log(
      b.id +
        '  ' +
        new Date(b.at).toLocaleString('it-IT') +
        '  ' +
        b.objects +
        ' archivi  ' +
        kb(b.size) +
        (b.failed?.length ? '  (non letti: ' + b.failed.join(', ') + ')' : '')
    );
} else if (command === 'run') {
  const r = await call('', 'POST');
  if (!r.ok) await fail(r);
  const b = await r.json();
  console.log(
    'Backup ' + b.id + ': ' + b.objects + ' archivi, ' + kb(b.size) + (b.sent ? ', inviato su Telegram' : '')
  );
} else if (command === 'download' && id) {
  const r = await call('/' + id);
  if (!r.ok) await fail(r);
  mkdirSync('backups', { recursive: true });
  writeFileSync('backups/' + id + '.json', await r.text());
  console.log('Salvato in backups/' + id + '.json');
} else if (command === 'restore' && id) {
  const r = await call('/' + id + '/restore', 'POST', { objects: names });
  if (!r.ok) await fail(r);
  const result = await r.json();
  console.log('Ripristinati ' + result.restored.length + ' archivi: ' + result.restored.join(', '));
} else {
  console.log('Uso: node scripts/backup.mjs list | run | download <id> | restore <id> [archivi...]');
}
