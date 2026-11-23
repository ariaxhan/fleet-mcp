import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { sweep } from './sweep.mjs';

export const isContract = name => /_contract(?:_|\.)/.test(name);

/** Injected actions make release ordering testable without a deployment. */
export async function release(actions) {
  await actions.expand();
  await actions.sweepOld();
  await actions.contract();
  await actions.deploy();
  await actions.sweepNew();
}

async function main() {
  const [environment, mode] = process.argv.slice(2);
  if (!['staging', 'production'].includes(environment) || (mode && mode !== '--verify-only'))
    throw new Error('Use staging or production, optionally --verify-only');
  if (!process.env.FLEET_SWEEP_TOKEN) throw new Error('FLEET_SWEEP_TOKEN required before release effects');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Deploy requires a clean checkout');
  const sha = git('rev-parse', 'HEAD');
  const base = environment === 'staging' ? 'https://staging-mcp.ariaxhan.com' : 'https://mcp.ariaxhan.com';
  const dir = await mkdtemp(join(tmpdir(), 'fleet-release-'));
  const record = { environment, commit: sha, observed_at: new Date().toISOString(), mode: mode ?? 'release', phases: [], pass: false };
  const stamp = `${Date.now()}-${process.pid}`;
  const wrangler = (...args) => execFileSync(resolve('node_modules/.bin/wrangler'), args, { stdio: 'inherit' });
  async function checkedSweep(commit, phase) {
    const receipt = await sweep(base, commit, environment, process.env.FLEET_SWEEP_TOKEN, process.env.FLEET_CORE_TOKEN);
    record.phases.push({ phase, receipt });
    await writeFile(`artifacts/sweep-${environment}.json`, JSON.stringify(receipt, null, 2) + '\n');
    if (!receipt.pass) throw new Error(`${phase} failed; preserve receipt, do not repeat deployment to check readiness`);
  }
  try {
    await mkdir('artifacts', { recursive: true });
    if (mode === '--verify-only') await checkedSweep(sha, 'post-deploy');
    else {
      const response = await fetch(`${base}/version`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      const old = await response.json();
      if (!response.ok || old.environment !== environment || !/^[a-f0-9]{40}$/.test(old.commit))
        throw new Error('Existing deployed build identity required before migration');
      const config = await readFile('wrangler.toml', 'utf8');
      const names = (await readdir('migrations')).filter(n => n.endsWith('.sql')).sort();
      const contracts = names.filter(isContract);
      if (contracts.length) {
        // A receipt must identify this release and its independently exercised restore.
        const receipt = JSON.parse(await readFile(`artifacts/contract-approval-${environment}.json`, 'utf8'));
        if (receipt.commit !== sha || receipt.environment !== environment || receipt.old_readers_retired !== true
          || receipt.restore_pass !== true || !receipt.backup_sha256 || !receipt.backup_location || !receipt.verifier)
          throw new Error('Contract requires release-bound backup, restore and reader-retirement receipt');
      }
      async function migrate(phase) {
        const migrationDir = join(dir, phase); await mkdir(migrationDir);
        for (const name of names.filter(n => phase === 'contract' || !isContract(n)))
          await copyFile(join('migrations', name), join(migrationDir, name));
        const configPath = join(dir, `${phase}.toml`);
        await writeFile(configPath, config.replace(/^main = .+$/m, `main = ${JSON.stringify(resolve('src/index.ts'))}`)
          .replaceAll('migrations_dir = "migrations"', `migrations_dir = ${JSON.stringify(migrationDir)}`));
        wrangler('d1', 'migrations', 'apply', `fleet-mcp-${environment}`, '--config', configPath, '--env', environment, '--remote');
        record.phases.push({ phase, migrations: names.filter(n => phase === 'contract' || !isContract(n)) });
      }
      await release({ expand: () => migrate('expand'), sweepOld: () => checkedSweep(old.commit, 'between-migrations'),
        contract: async () => { if (contracts.length) await migrate('contract'); else record.phases.push({ phase: 'contract', skipped: 'no contract migrations' }); },
        deploy: async () => { wrangler('deploy', '--env', environment, '--var', `BUILD_SHA:${sha}`, '--var', `BUILD_TIME:${new Date().toISOString()}`); record.phases.push({ phase: 'deploy', commit: sha }); },
        sweepNew: () => checkedSweep(sha, 'post-deploy') });
    }
    record.pass = true;
  } catch (e) { record.error = e.message; throw e; }
  finally {
    await writeFile(`artifacts/release-${environment}-${stamp}.json`, JSON.stringify(record, null, 2) + '\n');
    await rm(dir, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await main();
