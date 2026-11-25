// npm test: esegue da solo tutti i file di tests/ (*.test.js e *.test.mjs), uno dopo l'altro, e alla fine elenca
// TUTTI quelli falliti (prima una riga lunga con 40 comandi in fila: il primo errore nascondeva gli altri, e ogni
// prova nuova andava aggiunta a mano). Restano fuori i file che hanno già un loro passo in package.json
// (test:ui, test:simulator, test:access e le prove di runtime, che hanno bisogno del Worker impacchettato).
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
const elsewhere = new Set();
for (const [name, command] of Object.entries(scripts))
  if (name.startsWith('test:')) for (const m of command.matchAll(/tests\/([\w.-]+\.test\.m?js)/g)) elsewhere.add(m[1]);
const only = process.argv.slice(2);
const files = readdirSync(join(root, 'tests'))
  .filter(f => /\.test\.m?js$/.test(f) && !elsewhere.has(f))
  .filter(f => !only.length || only.some(o => f.includes(o)))
  .sort();

const failed = [];
const started = Date.now();
for (const file of files) {
  const t0 = Date.now();
  const run = spawnSync(process.execPath, [join('tests', file)], { cwd: root, encoding: 'utf8' });
  const ok = run.status === 0;
  const out = (run.stdout || '') + (run.stderr || '');
  process.stdout.write((ok ? 'ok   ' : 'FAIL ') + file + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)\n');
  if (!ok) {
    failed.push(file);
    process.stdout.write(out.split('\n').slice(-25).join('\n') + '\n');
  }
}
const time = ((Date.now() - started) / 1000).toFixed(0);
if (failed.length) {
  console.log('\n' + failed.length + ' di ' + files.length + ' file di prova falliti (' + time + ' s): ' + failed.join(', '));
  process.exit(1);
}
console.log('\nTutti i ' + files.length + ' file di prova passano (' + time + ' s).');
