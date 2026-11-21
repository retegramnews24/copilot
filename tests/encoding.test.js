import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Text saved with the wrong encoding (UTF-8 bytes read as Windows-1252) turns accented letters, stars,
// play symbols and middle dots into two- or three-character garbage. No source file may contain it.
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const skip = new Set(['node_modules', '.git', '.wrangler', 'vendor']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|mjs|html|css|json|md)$/.test(name) && name !== 'package-lock.json') files.push(path);
  }
})(root);
// A-tilde + continuation byte, A-circumflex + symbol, a-circumflex + euro/small-tilde/en-dash/currency/dagger/trademark, stray BOM.
const c = (...codes) => String.fromCharCode(...codes);
const broken = new RegExp(
  c(0xc3) +
    '[' +
    c(0x80) +
    '-' +
    c(0xbf) +
    ']|' +
    c(0xc2) +
    '[' +
    c(0xa0) +
    '-' +
    c(0xbf) +
    ']|' +
    c(0xe2) +
    '[' +
    c(0x20ac, 0x2dc, 0x2013, 0xa4, 0x2020, 0x2122) +
    ']|' +
    c(0xef, 0xbb, 0xbf)
);
const bad = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) bad.push(relative(root, file) + ': BOM');
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(broken);
    if (m)
      bad.push(
        relative(root, file) +
          ':' +
          (i + 1) +
          ': ' +
          JSON.stringify(line.slice(Math.max(0, m.index - 20), m.index + 20))
      );
  });
}
assert.deepEqual(bad, [], 'Caratteri rovinati (codifica sbagliata):\n' + bad.join('\n'));
console.log('PASS Encoding: ' + files.length + ' source files, no mojibake or BOM.');
