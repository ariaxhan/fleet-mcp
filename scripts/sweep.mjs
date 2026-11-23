import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function sweep(base, expectedCommit, environment, token) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/')
    throw new Error('Sweep requires an HTTPS deployment origin');
  if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? '')) throw new Error('Expected commit required');
  if (!['staging', 'production'].includes(environment)) throw new Error('Environment required');
  const checks = [];
  async function check(name, path, validate, headers) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, url), {
        headers, redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!validate(response, body)) throw new Error('Unexpected deployed response');
      checks.push({ name, pass: true, latency_ms: performance.now() - start });
    } catch (error) {
      checks.push({ name, pass: false, latency_ms: performance.now() - start, error: error.message });
    }
  }
  await check('liveness', '/health', (r, b) => r.ok && b.status === 'ok' && b.stage === 'scaffold');
  await check('deployed-commit', '/version', (r, b) => r.ok && b.commit === expectedCommit
    && b.environment === environment && b.mcp_protocol === null);
  await check('corpus-route-disabled', '/mcp', r => r.status === 404);
  await check('fixture-unauthorized', '/internal/fixture', r => r.status === 401);
  await check('fixture-bindings', '/internal/fixture', (r, b) => r.ok
    && b.namespace === `fixture-${environment}` && Object.keys(b.checks ?? {}).length === 6
    && Object.values(b.checks).every(v => v === true), { authorization: `Bearer ${token ?? ''}` });
  return { target: url.origin, commit: expectedCommit, environment,
    observed_at: new Date().toISOString(), checks, pass: checks.every(c => c.pass) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [base, commit, environment] = process.argv.slice(2);
  const receipt = await sweep(base, commit, environment, process.env.FLEET_SWEEP_TOKEN);
  await mkdir('artifacts', { recursive: true });
  await writeFile(`artifacts/sweep-${environment}.json`, JSON.stringify(receipt, null, 2) + '\n');
  for (const check of receipt.checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
  if (!receipt.pass) process.exitCode = 1;
}
