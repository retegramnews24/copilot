// Release helper for Binottoland Playground.
//   npm run release          -> version +1 (patch) everywhere, then refresh every ?v= cache stamp
//   npm run release -- 1.2.0 -> set that exact version
//   npm run stamp            -> only refresh the ?v= stamps
//   npm run release:check    -> fail if the version differs between files or a stamp is out of date (used by the tests)
//
// Cache stamps: every "file.js?v=…" / "file.css?v=…" reference inside public/ gets a short hash of that file's
// content plus the stamps of what it imports, so a change anywhere down the chain reaches the browser.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const read = file => readFileSync(join(root, file), 'utf8');
const write = (file, text) => writeFileSync(join(root, file), text);

// --- Version: the five places that show or report it.
const VERSION_PLACES = [
  ['package.json', /("name": "binottoland-motore",\s*"version": ")([^"]+)(")/],
  ['package-lock.json', /("name": "binottoland-motore",\s*"version": ")([^"]+)(")/],
  ['package-lock.json', /("": \{\s*"name": "binottoland-motore",\s*"version": ")([^"]+)(")/],
  ['public/app.js', /(const APP_VERSION=')([^']+)(')/],
  ['public/index.html', /(id="app-version"[^>]*>Binottoland Playground )([^<]+)(<)/],
  ['worker.js', /(\/api\/health'\)return json\(\{ok:true,version:')([^']+)(')/]
];
export function versions() {
  return VERSION_PLACES.map(([file, re]) => {
    const m = read(file).match(re);
    return { file, version: m ? m[2] : null };
  });
}
function setVersion(next) {
  for (const [file, re] of VERSION_PLACES) {
    const text = read(file);
    if (!re.test(text)) throw Error('Versione non trovata in ' + file);
    write(
      file,
      text.replace(re, (_, a, _old, c) => a + next + c)
    );
  }
}
function bump(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw Error('Versione non valida: ' + version);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

// --- Cache stamps.
const REF = /((?:\.{0,2}\/)?[\w./-]+\.(?:m?js|css))\?v=([\w.-]*)/g;
function sources(dir = pub, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(html|m?js|css)$/.test(name)) out.push(path);
  }
  return out;
}
// Imports resolve from the file; strings used by the page (script tags added at runtime) from public/.
function target(from, ref) {
  if (/^\/\//.test(ref)) return null;
  const candidates = ref.startsWith('/') ? [join(pub, ref)] : [resolve(dirname(from), ref), join(pub, ref)];
  return candidates.find(p => p.startsWith(pub) && existsSync(p) && statSync(p).isFile()) || null;
}
export function stamps() {
  const memo = new Map(),
    busy = new Set();
  const deep = file => {
    if (memo.has(file)) return memo.get(file);
    if (busy.has(file)) return ''; // import cycle: cut here
    busy.add(file);
    const text = readFileSync(file, 'utf8');
    // Same stamp on Windows (CRLF working copy) and on Linux/GitHub (LF).
    const hash = createHash('sha256').update(text.replace(/\r\n/g, '\n').replace(REF, '$1'));
    for (const [, ref] of text.matchAll(REF)) {
      const dep = target(file, ref);
      if (dep) hash.update(relative(pub, dep) + deep(dep));
    }
    busy.delete(file);
    const value = hash.digest('hex').slice(0, 10);
    memo.set(file, value);
    return value;
  };
  const changes = [];
  for (const file of sources()) {
    const text = readFileSync(file, 'utf8');
    const next = text.replace(REF, (all, ref, old) => {
      const dep = target(file, ref);
      if (!dep) return all;
      const stamp = deep(dep);
      if (stamp !== old) changes.push(relative(root, file) + ': ' + ref + ' ' + old + ' -> ' + stamp);
      return ref + '?v=' + stamp;
    });
    if (next !== text) changes.push({ file, next });
  }
  return changes;
}

const [mode] = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (mode === '--check') {
    const found = versions(),
      distinct = [...new Set(found.map(v => v.version))];
    const stale = stamps().filter(c => typeof c === 'string');
    if (distinct.length !== 1 || distinct[0] === null) {
      console.error(
        'Versione diversa tra i file:\n' + found.map(v => `  ${v.file}: ${v.version}`).join('\n')
      );
      process.exit(1);
    }
    if (stale.length) {
      console.error('Timbri ?v= non aggiornati (lancia "npm run stamp"):\n  ' + stale.join('\n  '));
      process.exit(1);
    }
    console.log('PASS Release: version ' + distinct[0] + ' everywhere, every ?v= stamp up to date.');
  } else {
    if (mode !== '--stamp') {
      const current = versions()[0].version,
        next = mode || bump(current);
      if (!/^\d+\.\d+\.\d+$/.test(next)) throw Error('Versione non valida: ' + next);
      setVersion(next);
      console.log('Versione ' + current + ' -> ' + next);
    }
    // Stamps depend on each other: repeat until nothing moves (cycles are cut, so this ends).
    let rounds = 0,
      changed = 0;
    for (; rounds < 10; rounds++) {
      const files = stamps().filter(c => typeof c !== 'string');
      if (!files.length) break;
      for (const { file, next } of files) writeFileSync(file, next);
      changed += files.length;
    }
    console.log('Timbri ?v= aggiornati in ' + changed + ' file.');
  }
}
