import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { handle } from '../src/handler';
import { hmacHex } from '../src/auth';
import { PERSONAL_SOURCE_REPOS } from '../src/core';
import { setup, KEY } from './harness';
// @ts-ignore: plain ESM sidecar module
import { signRequest } from '../sidecar/fleet-sidecar.mjs';

const MACHINE = 'm_' + 'b'.repeat(32);
const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const hb = { last_seq: 1, outbox_depth: 0, dropped_for_boundary: 0 };

async function rig() {
  const s = await setup();
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  s.db.prepare(`INSERT INTO machines VALUES (?, ?, 'personal', 'personal-docs', '2026-11-23', NULL)`)
    .run(MACHINE, publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64url'));
  const id = 'c'.repeat(32), token = `fmt_${id}.${'B'.repeat(43)}`;
  s.db.prepare(`INSERT INTO tokens VALUES (?, ?, 1, 'operator', 'personal', 'personal-docs', ?, ?, 'test', '2026-01-01', '2099-01-01T00:00:00Z', NULL)`)
    .run(id, await hmacHex(KEY, token), JSON.stringify(['fleet:read', 'fleet:write', 'recall:write', 'context:read']), JSON.stringify(PERSONAL_SOURCE_REPOS));
  const signed = async (method: string, path: string, payload?: unknown) => {
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const r = await handle(new Request(`https://fixture${path}`, { method, body: method === 'GET' ? undefined : body,
      headers: signRequest(privateKey, MACHINE, method, path, body) }), s.env);
    return { status: r.status, body: await r.json() as any };
  };
  await signed('POST', '/ingest/fleet', { sidecar_version: 't', records: [], heartbeat: hb });
  return { ...s, op: token, signed };
}

test('checkout state and checkpoint comparisons are served with observed-at times', async () => {
  const { signed, call, op, db } = await rig();
  db.prepare(`INSERT INTO handoff_checkpoints VALUES ('personal', 'personal-docs', 'cp-1', ?, '2026-11-23')`).run('a'.repeat(64));
  const r = await signed('POST', '/ingest/fleet', { sidecar_version: 't', heartbeat: { ...hb, observations: { checkout_state: ago(40), bogus: ago(1) } }, records: [
    { type: 'checkout_state', seq: 2, repo: 'ariaxhan/fleet-mcp', checkout_id: 'fleet-mcp', head_commit: 'f'.repeat(40), branch: 'main', dirty: true, tree_hash: 'e'.repeat(64), observed_at: ago(40) },
    { type: 'checkpoint_hash', seq: 3, repo: 'ariaxhan/fleet-mcp', checkpoint_id: 'cp-1', local_hash: 'a'.repeat(64), observed_at: ago(40) },
    { type: 'checkpoint_hash', seq: 4, repo: 'ariaxhan/fleet-mcp', checkpoint_id: 'cp-2', local_hash: 'b'.repeat(64), observed_at: ago(40) },
    { type: 'probe', seq: 5, probe: 'codex-oauth', status: 'live', reason_code: 'ok', observed_at: ago(5) },
  ] });
  assert.equal(r.body.accepted, 4, JSON.stringify(r.body));
  const st = (await call(op, '/v1/fleet/status')).body;
  assert.equal(st.checkouts[0].dirty, true);
  assert.equal(st.checkouts[0].freshness, 'fresh');
  assert.ok(Date.parse(st.checkouts[0].source_observed_at) < Date.now() - 30_000, 'observation time kept, not re-stamped');
  const cps = Object.fromEntries(st.checkpoints.map((c: any) => [c.checkpoint_id, c.comparison]));
  assert.deepEqual(cps, { 'cp-1': 'match', 'cp-2': 'unknown_server' });
  assert.deepEqual(Object.keys(st.connectors[0].last_successful_observation_at), ['checkout_state'], 'only fixed classes kept');
  assert.equal(st.probes.find((p: any) => p.probe === 'codex-oauth').status, 'live');
});

test('stale connector labels checkout data stale and credential liveness unknown', async () => {
  const { call, op, db, signed } = await rig();
  await signed('POST', '/ingest/fleet', { sidecar_version: 't', heartbeat: hb, records: [
    { type: 'checkout_state', seq: 2, repo: 'ariaxhan/fleet-mcp', checkout_id: 'fleet-mcp', head_commit: 'f'.repeat(40), branch: 'main', dirty: false, tree_hash: 'e'.repeat(64), observed_at: ago(10) },
    { type: 'probe', seq: 3, probe: 'wrangler', status: 'live', reason_code: 'ok', observed_at: ago(10) }] });
  db.prepare('UPDATE connector_status SET last_heartbeat_at = ?').run(ago(2000));
  const st = (await call(op, '/v1/fleet/status')).body;
  assert.equal(st.connectors[0].connector_status, 'offline');
  assert.equal(st.checkouts[0].freshness, 'stale');
  assert.equal(st.checkouts[0].dirty, false, 'last observed value, not fabricated');
  const p = st.probes.find((x: any) => x.probe === 'wrangler');
  assert.deepEqual([p.status, p.reason_code], ['unknown', 'connector_offline']);
});

test('file upload job: lease is the ack, bytes are hash-validated and served with observed-at', async () => {
  const { signed, call, op } = await rig();
  const q = await call(op, '/v1/connector/jobs', { kind: 'file_upload', params: { repo: 'ariaxhan/fleet-mcp', path: 'AGENTS.md' } });
  assert.equal(q.status, 202, JSON.stringify(q.body));
  const lease = (await signed('GET', '/connector/work')).body.job;
  assert.equal(lease.kind, 'file_upload');
  assert.equal((await signed('GET', '/connector/work')).body.job, null, 'a leased job is not handed out twice');
  const bytes = Buffer.from('# hello\n'), hash = createHash('sha256').update(bytes).digest('hex');
  const bad = await signed('POST', '/connector/result', { job_id: lease.job_id, status: 'done', reason_code: 'ok', observed_at: ago(3),
    bytes_base64: bytes.toString('base64'), content_hash: 'd'.repeat(64), size: bytes.length, head_commit: 'f'.repeat(40) });
  assert.equal(bad.status, 422);
  const ok = await signed('POST', '/connector/result', { job_id: lease.job_id, status: 'done', reason_code: 'ok', observed_at: ago(3),
    bytes_base64: bytes.toString('base64'), content_hash: hash, size: bytes.length, head_commit: 'f'.repeat(40) });
  assert.equal(ok.body.status, 'done');
  assert.equal((await signed('POST', '/connector/result', { job_id: lease.job_id, status: 'failed', reason_code: 'error' })).body.duplicate, true);
  const got = (await call(op, `/v1/connector/job?id=${lease.job_id}&include=bytes`)).body;
  assert.equal(Buffer.from(got.bytes_base64, 'base64').toString(), '# hello\n');
  assert.equal(got.job.result.content_hash, hash);
  assert.ok(got.job.source_observed_at);
});

test('jobs outside the allowlist, unknown kinds and absolute paths are refused at enqueue', async () => {
  const { call, op } = await rig();
  assert.equal((await call(op, '/v1/connector/jobs', { kind: 'file_upload', params: { repo: 'synthetic-excluded/repo', path: 'a' } })).status, 403);
  assert.equal((await call(op, '/v1/connector/jobs', { kind: 'shell', params: {} })).status, 400);
  assert.equal((await call(op, '/v1/connector/jobs', { kind: 'file_upload', params: { repo: 'ariaxhan/fleet-mcp', path: '../x' } })).status, 400);
});

test('expired and lease-expired jobs end with durable status, never waiting indefinitely', async () => {
  const { signed, call, op, db } = await rig();
  const a = (await call(op, '/v1/connector/jobs', { kind: 'probe', params: { probe: 'github' } })).body.job_id;
  db.prepare('UPDATE connector_jobs SET expires_at = ? WHERE job_id = ?').run(ago(1), a);
  assert.equal((await call(op, `/v1/connector/job?id=${a}`)).body.job.status, 'unavailable');
  const b = (await call(op, '/v1/connector/jobs', { kind: 'probe', params: { probe: 'github' } })).body.job_id;
  for (let i = 0; i < 3; i++) {
    assert.equal((await signed('GET', '/connector/work')).body.job.job_id, b);
    db.prepare('UPDATE connector_jobs SET lease_until = ? WHERE job_id = ?').run(ago(1), b);
  }
  const j = (await call(op, `/v1/connector/job?id=${b}`)).body.job;
  assert.deepEqual([j.status, j.reason_code, j.attempts], ['failed', 'lease_expired', 3]);
});

test('recall_learn write-back outbox: pending in D1 until the sidecar reports it written', async () => {
  const { signed, call, op } = await rig();
  const w = await call(op, '/v1/recall/learn', { kind: 'gotcha', what: 'synthetic lesson', why: 'test' });
  assert.equal(w.body.writeback_status, 'pending');
  assert.equal((await call(op, '/v1/recall/learn', { kind: 'gotcha', what: 'x\u0001', why: 'y' })).status, 400);
  const job = (await signed('GET', '/connector/work')).body.job;
  assert.deepEqual([job.kind, job.params.what], ['lesson_writeback', 'synthetic lesson']);
  assert.equal((await call(op, `/v1/connector/job?id=${w.body.writeback_id}`)).body.job.writeback_status, 'pending');
  await signed('POST', '/connector/result', { job_id: job.job_id, status: 'done', reason_code: 'ok', observed_at: ago(1) });
  assert.equal((await call(op, `/v1/connector/job?id=${w.body.writeback_id}`)).body.job.writeback_status, 'done');
});

test('sync reconciliation reports keys the server lacks and records durable status', async () => {
  const { signed, call, op } = await rig();
  await signed('POST', '/ingest/fleet', { sidecar_version: 't', heartbeat: hb, records: [{ type: 'fleet_event', seq: 2, event_key: 'attempt:9:started',
    task_id: 'ariaxhan/fleet-mcp#18', repo: 'ariaxhan/fleet-mcp', attempt_id: '9', event_kind: 'started', observed_at: ago(5) }] });
  const r = await signed('POST', '/connector/reconcile', { event_keys: ['attempt:9:started', 'attempt:10:started'] });
  assert.deepEqual(r.body.missing, ['attempt:10:started']);
  const c = (await call(op, '/v1/fleet/status')).body.connectors[0];
  assert.equal(c.reconcile_missing, 1);
  assert.ok(c.last_reconciled_at);
});

test('sidecar jobs: unknown kinds, unknown suites, foreign repos and escaping paths are refused locally', async () => {
  // @ts-ignore: plain ESM sidecar module
  const { runJob, checkoutState } = await import('../sidecar/fleet-sidecar.mjs');
  const { mkdtempSync, writeFileSync, symlinkSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const root = mkdtempSync(tmpdir() + '/sc-');
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(root + '/a.txt', 'A');
  writeFileSync(root + '/.env', 'SECRET=1');
  symlinkSync('/etc/hosts', root + '/escape');
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', 'a.txt']);
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x']);
  const repos = ['ariaxhan/fleet-mcp'], recorded: any[] = [];
  const ctx = { cfg: { checkouts: { 'ariaxhan/fleet-mcp': root } }, repos, record: (r: any) => recorded.push(r), state: {}, save() {} };
  const run = (kind: string, params: any) => runJob({ job_id: 'j', kind, params }, ctx);
  assert.equal((await run('shell', { cmd: 'id' })).status, 'unsupported');
  assert.equal((await run('suite_run', { repo: 'ariaxhan/fleet-mcp', suite: 'rm-rf' })).status, 'unsupported');
  assert.equal((await run('file_upload', { repo: 'synthetic-excluded/repo', path: 'a.txt' })).reason_code, 'repo_not_allowlisted');
  assert.equal((await run('file_upload', { repo: 'ariaxhan/fleet-mcp', path: 'escape' })).reason_code, 'path_outside_root');
  assert.equal((await run('file_upload', { repo: 'ariaxhan/fleet-mcp', path: '.env' })).reason_code, 'deny_list');
  const up = await run('file_upload', { repo: 'ariaxhan/fleet-mcp', path: 'a.txt' });
  assert.equal(Buffer.from(up.bytes_base64, 'base64').toString(), 'A');
  const before = checkoutState(root, 'ariaxhan/fleet-mcp', repos, 'fleet-mcp');
  writeFileSync(root + '/a.txt', 'B');
  const after = checkoutState(root, 'ariaxhan/fleet-mcp', repos, 'fleet-mcp');
  assert.equal(before.head_commit, after.head_commit);
  assert.notEqual(before.tree_hash, after.tree_hash, 'uncommitted bytes change the tree hash');
  assert.equal(after.dirty, true);
});

test('credential probes classify locally and emit only fixed enums', async () => {
  // @ts-ignore: plain ESM sidecar module
  const { classifyOAuth } = await import('../sidecar/fleet-sidecar.mjs');
  const secret = 'sk-synthetic-secret-value';
  const outs = [classifyOAuth(JSON.stringify({ claudeAiOauth: { accessToken: secret, expiresAt: 1 } }), 1000),
    classifyOAuth(JSON.stringify({ tokens: { access_token: secret, refresh_token: secret } })), classifyOAuth('not json'), classifyOAuth('{}')];
  assert.deepEqual(outs.map((o: any) => [o.status, o.reason_code]),
    [['expired', 'credential_expired'], ['live', 'ok'], ['unknown', 'unparseable'], ['missing', 'credential_missing']]);
  assert.ok(outs.every((o: any) => !JSON.stringify(o).includes(secret) && Object.keys(o).join() === 'status,reason_code,observed_at'));
});
