// Build step run by Wrangler before every deploy (wrangler.jsonc → build.command).
// On Cloudflare's build servers (Workers Builds sets WORKERS_CI=1) it does not run the tests again:
// it asks GitHub for the result of the "Test" workflow on the same commit (they already ran there).
// - green: publish; red: the build fails and nothing is published; still running: wait (up to 12 minutes);
// - GitHub unreachable, rate limited or no run found: fall back to running the tests here, as before.
// Locally (wrangler dev, dry runs used by the tests) it does nothing.
import { spawnSync } from 'node:child_process';

const REPO = process.env.GATE_REPO || 'retegramnews24/copilot';
const WORKFLOW = 'Test';
const WAIT_MS = 12 * 60 * 1000;
const POLL_MS = 20 * 1000;

// Staging (test environment) publishes without tests.
if (process.env.WORKERS_CI_BRANCH === 'staging') {
  console.log('deploy-gate: prova (staging), niente test.');
  process.exit(0);
}
if (!process.env.WORKERS_CI) {
  console.log('deploy-gate: locale, controllo saltato (i test girano su GitHub).');
  process.exit(0);
}

function runTestsHere(reason) {
  console.log('deploy-gate: ' + reason + ' Eseguo i test qui.');
  for (const script of ['test', 'test:ui']) {
    console.log('deploy-gate: npm run ' + script);
    const run = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (run.status !== 0) {
      console.error('deploy-gate: "npm run ' + script + '" non è passato. Pubblicazione annullata.');
      process.exit(run.status || 1);
    }
  }
  console.log('deploy-gate: tutti i test passati, si pubblica.');
  process.exit(0);
}

// Returns the latest "Test" run for the commit, null when none exists yet, or throws when GitHub is unusable.
async function testRun(sha) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO}/actions/runs?head_sha=${sha}&per_page=20`,
    {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'binottoland-deploy-gate' },
      signal: AbortSignal.timeout(15000)
    }
  );
  if (!response.ok) throw Error('GitHub ha risposto ' + response.status + '.');
  const { workflow_runs: runs = [] } = await response.json();
  return runs.find(run => run.name === WORKFLOW) || null;
}

const sha = process.env.WORKERS_CI_COMMIT_SHA;
if (!/^[0-9a-f]{40}$/.test(sha || '')) runTestsHere('commit sconosciuto.');
const started = Date.now();
for (;;) {
  let run;
  try {
    run = await testRun(sha);
  } catch (e) {
    runTestsHere('GitHub non disponibile (' + e.message + ')');
  }
  if (run?.status === 'completed') {
    if (run.conclusion === 'success') {
      console.log('deploy-gate: test verdi su GitHub per ' + sha.slice(0, 7) + ', si pubblica.');
      process.exit(0);
    }
    console.error(
      'deploy-gate: test su GitHub "' + run.conclusion + '" (' + run.html_url + '). Pubblicazione annullata.'
    );
    process.exit(1);
  }
  if (Date.now() - started > WAIT_MS)
    runTestsHere(
      run ? 'test su GitHub ancora in corso dopo 12 minuti.' : 'nessun test su GitHub per questo commit.'
    );
  console.log(
    'deploy-gate: ' + (run ? 'test su GitHub in corso' : 'test su GitHub non ancora partiti') + ', attendo…'
  );
  await new Promise(resolve => setTimeout(resolve, POLL_MS));
}
