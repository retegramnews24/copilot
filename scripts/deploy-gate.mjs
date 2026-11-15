// Build step run by Wrangler before every deploy (wrangler.jsonc → build.command).
// On Cloudflare's build servers (Workers Builds sets WORKERS_CI=1) it runs the tests first: if one fails,
// the build fails and the site is not published. Locally (wrangler dev, dry runs used by the tests) it does nothing.
import { spawnSync } from 'node:child_process';

if (!process.env.WORKERS_CI) {
  console.log(
    'deploy-gate: locale, test saltati (girano su GitHub e prima della pubblicazione su Cloudflare).'
  );
  process.exit(0);
}
for (const script of ['test', 'test:ui']) {
  console.log('deploy-gate: npm run ' + script);
  const run = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
  if (run.status !== 0) {
    console.error('deploy-gate: "npm run ' + script + '" non è passato. Pubblicazione annullata.');
    process.exit(run.status || 1);
  }
}
console.log('deploy-gate: tutti i test passati, si pubblica.');
