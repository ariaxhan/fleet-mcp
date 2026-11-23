import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// previousBuild: the between-migrations sweep targets the build already live, which may predate
// operations routes (#27); it skips them only when that build does not advertise `ops`.
export async function sweep(base, expectedCommit, environment, token, coreToken, { previousBuild = false } = {}) {
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
      if (!(await validate(response, body))) throw new Error('Unexpected deployed response');
      checks.push({ name, pass: true, latency_ms: performance.now() - start });
    } catch (error) {
      checks.push({ name, pass: false, latency_ms: performance.now() - start, error: error.message });
    }
  }
  await check('liveness', '/health', (r, b) => r.ok && b.status === 'ok' && b.stage === 'spike-core');
  await check('deployed-commit', '/version', (r, b) => r.ok && b.commit === expectedCommit
    && b.environment === environment && b.mcp_protocol === '2025-06-18');
  await check('mcp-unauthenticated', '/mcp', r => r.status === 401);
  await check('fixture-unauthorized', '/internal/fixture', r => r.status === 401);
  await check('fixture-bindings', '/internal/fixture', (r, b) => r.ok
    && b.namespace === `fixture-${environment}` && Object.keys(b.checks ?? {}).length === 6
    && Object.values(b.checks).every(v => v === true), { authorization: `Bearer ${token ?? ''}` });
  let advertisesOps = true;
  if (previousBuild) advertisesOps = await fetch(new URL('/version', url), { redirect: 'error', signal: AbortSignal.timeout(15000) })
    .then(r => r.json()).then(b => b.ops === true).catch(() => true);
  if (advertisesOps) {
    await check('ops-unauthorized', '/internal/ops', r => r.status === 401);
    await check('ops-metrics', '/internal/ops', (r, b) => r.ok && b.environment === environment && b.admission?.enforced === true
      && ['connector_lag_s', 'webhook_lag_s', 'feed_coverage_age_s', 'outbox_backlog', 'stale_response_age_s',
        'upstream_rate_limit_remaining_min', 'render_queue_time_s_max', 'retry_amplification'].every(k => k in (b.values ?? {}))
      && Array.isArray(b.alerts) && typeof b.verification_reuse_by_checker === 'object' && b.limits?.globalPerMin > 0,
      { authorization: `Bearer ${token ?? ''}` });
    await check('correlation-id', '/health', r => r.headers.get('x-correlation-id') === 'sweep-correlation-01',
      { 'x-correlation-id': 'sweep-correlation-01' });
  }
  await check('core-unauthenticated', '/v1/docs/get?name=x', r => r.status === 401);
  if (coreToken) {
    const name = encodeURIComponent('ariaxhan/fleet-mcp/AGENTS.md');
    const auth = { authorization: `Bearer ${coreToken}` };
    const real = async (r, b) => {
      const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(b.body ?? ''))).toString('hex');
      return r.ok && b.meta && digest === b.meta.content_hash && b.provenance?.repo === 'ariaxhan/fleet-mcp'
        && ['served_at', 'source_observed_at', 'last_validated_at', 'computed_at', 'version', 'source']
          .every(k => b.meta[k] !== undefined);
    };
    await check('core-read-real-doc', `/v1/docs/get?name=${name}`, real, auth);
    await check('core-read-strong', `/v1/docs/get?name=${name}&consistency=strong`,
      async (r, b) => await real(r, b) && b.meta.cache_status === 'bypass', auth);
    await check('core-freshness-unmet', `/v1/docs/get?name=${name}&max_age_s=0`,
      (r, b) => r.status === 409 && b.error === 'freshness_unmet', auth);
    await check('core-change-feed', '/v1/changes', (r, b) => r.ok && typeof b.next_cursor === 'string'
      && b.resources.some(x => x.name === 'ariaxhan/fleet-mcp/AGENTS.md'), auth);
  }
  return { target: url.origin, commit: expectedCommit, environment,
    observed_at: new Date().toISOString(), checks, pass: checks.every(c => c.pass) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const [base, commit, environment] = process.argv.slice(2);
  const receipt = await sweep(base, commit, environment, process.env.FLEET_SWEEP_TOKEN, process.env.FLEET_CORE_TOKEN);
  await mkdir('artifacts', { recursive: true });
  await writeFile(`artifacts/sweep-${environment}.json`, JSON.stringify(receipt, null, 2) + '\n');
  for (const check of receipt.checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
  if (!receipt.pass) process.exitCode = 1;
}
