// Differenze vere tra staging e main (analisi di Fable, area 6): confronta i file dei due rami lasciando fuori il
// numero di versione e i timbri ?v=, che cambiano a ogni rilascio. Dopo aver portato tutto deve dire «nessuna
// differenza»; da lì ogni riga che compare è una modifica ancora da portare (o da togliere da staging).
//   node scripts/branch-diff.mjs                 (staging contro main, i rami locali)
//   node scripts/branch-diff.mjs origin/staging origin/main
import { execFileSync } from 'node:child_process';

const [a = 'staging', b = 'main'] = process.argv.slice(2);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const show = (ref, path) => {
  try {
    return execFileSync('git', ['show', ref + ':' + path], { maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
};
// testo senza versione e timbri: «1.0.57» → «1.0.x», «?v=abc123…» → «?v=»
const plain = buf =>
  buf
    .toString('utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\?v=[0-9a-z]+/gi, '?v=')
    .replace(/\b1\.0\.\d+\b/g, '1.0.x');

const changed = git('diff', '--name-status', b, a)
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(line => line.split('\t'));
const onlyA = [],
  onlyB = [],
  different = [];
for (const [status, path] of changed) {
  if (status === 'A') onlyA.push(path);
  else if (status === 'D') onlyB.push(path);
  else {
    const x = show(a, path),
      y = show(b, path);
    if (!x || !y) different.push(path);
    else if (
      /\.(blend|glb|png|jpe?g|webp|mp3|ogg|wav|woff2?)$/i.test(path) ? !x.equals(y) : plain(x) !== plain(y)
    )
      different.push(path);
  }
}
const list = (title, items) =>
  items.length && console.log(title + ' (' + items.length + '):\n  ' + items.join('\n  '));
list('Solo su ' + a, onlyA);
list('Solo su ' + b, onlyB);
list('Diversi', different);
if (!onlyA.length && !onlyB.length && !different.length)
  console.log('Nessuna differenza tra ' + a + ' e ' + b + ' (a parte versione e timbri).');
else process.exitCode = 1;
