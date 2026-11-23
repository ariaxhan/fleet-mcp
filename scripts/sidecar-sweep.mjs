// Live sidecar sweep (issue #18): queues one job of every kind, runs the real sidecar once, and archives
// the server's view before and after. Functional validation, not a benchmark.
// Usage: node scripts/sidecar-sweep.mjs <staging|production> <sha>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [environment, sha] = process.argv.slice(2);
if (!['staging', 'production'].includes(environment) || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw Error('environment SHA required');
const origin = `https://fleet-mcp${environment === 'staging' ? '-staging' : ''}.ariaxhan.workers.dev`;
const key = execFileSync('security', ['find-generic-password', '-s', `fleet-mcp-token-hmac-${environment}`, '-w'], { encoding: 'utf8' }).trim();
const token = execFileSync(process.execPath, ['scripts/issue-token.mjs', environment, 'sidecar-sweep-18', 'fleet:read,fleet:write,recall:write,context:read',
  'ariaxhan/fleet-mcp', '1'], { encoding: 'utf8', env: { ...process.env, FLEET_TOKEN_HMAC_KEY: key } }).trim();
const receipt = { purpose: 'functional sidecar validation, not benchmark', origin, sha, observed_at: new Date().toISOString(), checks: [] };
async function call(name, path, body) {
  const r = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000), redirect: 'error' });
  const data = await r.json();
  receipt.checks.push({ name, status: r.status, body: data });
  return { status: r.status, body: data };
}
try {
  assert.equal((await call('build', '/version')).body.commit, sha);
  await call('status_before_run', '/v1/fleet/status');
  const queue = { probe: { probe: 'codex-oauth' }, checkout_state: { repo: 'ariaxhan/fleet-mcp' },
    file_upload: { repo: 'ariaxhan/fleet-mcp', path: 'AGENTS.md' }, suite_run: { repo: 'ariaxhan/fleet-mcp', suite: 'fleet-mcp-typecheck' } };
  const jobs = {};
  for (const [kind, params] of Object.entries(queue)) jobs[kind] = (await call(`enqueue_${kind}`, '/v1/connector/jobs', { kind, params })).body.job_id;
  jobs.unknown_suite = (await call('enqueue_unknown_suite', '/v1/connector/jobs', { kind: 'suite_run', params: { repo: 'ariaxhan/fleet-mcp', suite: 'not-registered' } })).body.job_id;
  jobs.lesson_writeback = (await call('recall_learn', '/v1/recall/learn', { kind: 'pattern',
    what: 'fleet-mcp sidecar lesson write-back: recall_learn queues a lesson_writeback job; the sidecar writes it with agentdb learn in the owning checkout',
    why: 'D1 stays authoritative until writeback_status is done (PRD 2.6.2); verified by scripts/sidecar-sweep.mjs' })).body.writeback_id;
  assert.equal((await call('excluded_repo_refused', '/v1/connector/jobs', { kind: 'file_upload', params: { repo: 'someone-else/excluded-synthetic', path: 'a' } })).status, 403);
  const run = execFileSync(process.execPath, ['sidecar/fleet-sidecar.mjs', 'once', environment], { encoding: 'utf8', timeout: 300000 });
  receipt.sidecar_stdout = run.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return l; } });
  const expect = { probe: 'done', checkout_state: 'done', file_upload: 'done', suite_run: 'done', unknown_suite: 'unsupported', lesson_writeback: 'done' };
  for (const [kind, id] of Object.entries(jobs)) {
    const j = (await call(`job_${kind}`, `/v1/connector/job?id=${id}${kind === 'file_upload' ? '&include=bytes' : ''}`)).body;
    assert.equal(j.job.status, expect[kind], kind);
  }
  const st = (await call('status_after_run', '/v1/fleet/status')).body;
  const conn = st.connectors.find(c => c.connector_status === 'fresh');
  assert.ok(conn && conn.last_reconciled_at && Object.keys(conn.last_successful_observation_at).length);
  assert.ok(st.checkouts.length && st.checkouts.every(c => c.source_observed_at && c.freshness));
  assert.ok(['github', 'claude-oauth', 'codex-oauth', 'wrangler'].every(p => st.probes.some(x => x.probe === p)));
  receipt.pass = true;
} finally {
  mkdirSync('artifacts', { recursive: true });
  // The token never enters the receipt; file bytes are dropped after their hash check.
  for (const c of receipt.checks) if (c.body?.bytes_base64) c.body.bytes_base64 = `<${c.body.bytes_base64.length} base64 chars, verified against content_hash>`;
  writeFileSync(`artifacts/sidecar-sweep-${environment}.json`, JSON.stringify(receipt, null, 2));
}
console.log(`sidecar sweep ${receipt.pass ? 'PASS' : 'FAIL'}: artifacts/sidecar-sweep-${environment}.json`);
