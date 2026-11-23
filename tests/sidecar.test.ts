import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../src/handler';
import { STALE_AFTER_S, OFFLINE_AFTER_S } from '../src/connector';
import { setup } from './harness';
// @ts-ignore: plain ESM sidecar module
import { signRequest, collectFleetEvents, resolveUnderRoot, loadAllowlist } from '../sidecar/fleet-sidecar.mjs';

const MACHINE = 'm_' + 'a'.repeat(32);
async function withMachine() {
  const s = await setup();
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64url');
  s.db.prepare(`INSERT INTO machines VALUES (?, ?, 'personal', 'personal-docs', '2026-11-22', NULL)`).run(MACHINE, raw);
  const push = async (payload: unknown, headers?: Record<string, string>) => {
    const body = JSON.stringify(payload);
    const h = headers ?? signRequest(privateKey, MACHINE, 'POST', '/ingest/fleet', body);
    const r = await handle(new Request('https://fixture/ingest/fleet', { method: 'POST', body, headers: h }), s.env);
    return { status: r.status, body: await r.json() as any, headers: h };
  };
  return { ...s, push, privateKey };
}
const hb = { last_seq: 3, outbox_depth: 0, dropped_for_boundary: 2 };
const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const event = (seq: number, kind = 'started', repo = 'ariaxhan/fleet-mcp') => ({ type: 'fleet_event', seq, event_key: `attempt:7:${kind}`,
  task_id: `${repo}#12`, repo, attempt_id: '7', event_kind: kind, observed_at: ago(30) });

test('signed fleet events enter the change feed with observed-at times, once', async () => {
  const { push, call, tokens } = await withMachine();
  const start = await call(tokens.fleet, '/v1/changes');
  const r = await push({ sidecar_version: 't', records: [event(1), event(2, 'done')], heartbeat: hb });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.accepted, 2);
  // Duplicate delivery (outbox replay) appends nothing.
  assert.equal((await push({ sidecar_version: 't', records: [event(1)], heartbeat: hb })).body.duplicate, 1);
  const feed = await call(tokens.fleet, '/v1/changes?cursor=' + encodeURIComponent(start.body.next_cursor));
  assert.deepEqual(feed.body.events.map((e: any) => [e.kind, e.name]), [
    ['fleet_event', 'fleet/ariaxhan/fleet-mcp#12/attempt/7/started'], ['fleet_event', 'fleet/ariaxhan/fleet-mcp#12/attempt/7/done']]);
  assert.ok(feed.body.events.every((e: any) => Date.parse(e.source_observed_at) < Date.now() - 20_000), 'original observation time kept');
});

test('unsigned, replayed, foreign and excluded pushes are refused', async () => {
  const { push, db } = await withMachine();
  const payload = { sidecar_version: 't', records: [event(1)], heartbeat: hb };
  const ok = await push(payload);
  assert.equal((await push(payload, ok.headers)).status, 401, 'nonce replay');
  assert.equal((await push({ ...payload, records: [] }, ok.headers)).status, 401, 'signature binds the body');
  const other = generateKeyPairSync('ed25519').privateKey;
  assert.equal((await push(payload, signRequest(other, MACHINE, 'POST', '/ingest/fleet', JSON.stringify(payload)))).status, 401);
  const excluded = await push({ sidecar_version: 't', records: [event(5, 'started', 'synthetic-excluded/repo')], heartbeat: hb });
  assert.equal(excluded.body.dropped_for_boundary, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM fleet_events WHERE repo LIKE 'synthetic%'").get() as any).n, 0);
  const leak = await push({ sidecar_version: 't', heartbeat: hb,
    records: [{ type: 'probe', seq: 9, probe: 'github', status: 'live', reason_code: 'token=abc', observed_at: ago(1) }] });
  assert.equal(leak.body.rejected, 1, 'free-text reason codes are rejected');
});

test('probe and file hash are served with freshness, then labeled stale offline, never fabricated', async () => {
  const { push, call, tokens, db } = await withMachine();
  const hash = 'c'.repeat(64);
  db.prepare("INSERT INTO blobs VALUES ('personal', 'personal-docs', ?, 1, 'p', 'now')").run(hash);
  db.prepare(`INSERT INTO versions VALUES ('personal', 'personal-docs', 'doc', 'ariaxhan/fleet-mcp/AGENTS.md', 1, ?, 1, 'active', 'n',
    'ariaxhan/fleet-mcp', ?, 'AGENTS.md', ?, 'now', 'p')`).run(hash, 'b'.repeat(40), ago(100));
  db.prepare("INSERT INTO resources VALUES ('personal', 'personal-docs', 'doc', 'ariaxhan/fleet-mcp/AGENTS.md', 1, 'p')").run();
  const observed = ago(5);
  await push({ sidecar_version: 't', heartbeat: hb, records: [
    { type: 'probe', seq: 1, probe: 'github', status: 'live', reason_code: 'ok', observed_at: observed },
    { type: 'file_hash', seq: 2, repo: 'ariaxhan/fleet-mcp', path: 'AGENTS.md', content_hash: hash, size: 1, head_commit: 'b'.repeat(40), observed_at: observed }] });

  const live = await call(tokens.fleet, '/v1/fleet/status');
  assert.equal(live.body.connectors[0].connector_status, 'fresh');
  assert.deepEqual([live.body.probes[0].status, live.body.probes[0].freshness, live.body.probes[0].source_observed_at], ['live', 'fresh', observed]);
  const cmp = await call(tokens.fleet, '/v1/fleet/file-compare?repo=ariaxhan/fleet-mcp&path=AGENTS.md');
  assert.deepEqual([cmp.body.comparison, cmp.body.freshness, cmp.body.local.source_observed_at], ['match', 'fresh', observed]);

  // Connector goes silent: age the heartbeat past each threshold.
  for (const [age, cs] of [[STALE_AFTER_S + 5, 'stale'], [OFFLINE_AFTER_S + 5, 'offline']] as const) {
    db.prepare('UPDATE connector_status SET last_heartbeat_at = ?').run(ago(age));
    const s = await call(tokens.fleet, '/v1/fleet/status');
    assert.equal(s.body.connectors[0].connector_status, cs);
    assert.deepEqual([s.body.probes[0].status, s.body.probes[0].reason_code, s.body.probes[0].freshness, s.body.probes[0].source_observed_at],
      ['unknown', 'connector_offline', 'stale', observed], 'credential liveness never served stale');
    const c = await call(tokens.fleet, '/v1/fleet/file-compare?repo=ariaxhan/fleet-mcp&path=AGENTS.md');
    assert.deepEqual([c.body.freshness, c.body.local.source_observed_at, c.body.local.connector_status], ['stale', observed, cs]);
  }
  assert.equal((await call(tokens.fleet, '/v1/fleet/file-compare?repo=ariaxhan/fleet-mcp&path=PRD.md')).body.comparison, 'unknown_local');
  assert.equal((await call(tokens.reader, '/v1/fleet/status')).status, 403);
});

test('sidecar collects only allowlisted runner rows and guards paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidecar-'));
  const db = new DatabaseSync(join(dir, 'runner.sqlite'));
  db.exec(`CREATE TABLE tasks(id INTEGER PRIMARY KEY, ref TEXT, repo TEXT);
    CREATE TABLE attempts(id INTEGER PRIMARY KEY, task_id INTEGER, started REAL, ended REAL, outcome TEXT);`);
  const now = Date.now() / 1000;
  db.exec(`INSERT INTO tasks VALUES (1, 'ariaxhan/fleet-mcp#12', 'ariaxhan/fleet-mcp'), (2, 'synthetic-excluded/x#1', 'synthetic-excluded/x');
    INSERT INTO attempts VALUES (1, 1, ${now - 60}, ${now - 10}, 'done'), (2, 2, ${now - 60}, NULL, NULL), (3, 1, ${now - 5}, NULL, NULL);`);
  db.close();
  const { events, dropped } = collectFleetEvents(join(dir, 'runner.sqlite'), ['ariaxhan/fleet-mcp'], now);
  assert.deepEqual(events.map((e: any) => e.event_key), ['attempt:1:started', 'attempt:1:done', 'attempt:3:started']);
  assert.equal(dropped, 1);
  assert.ok(events.every((e: any) => !JSON.stringify(e).includes('synthetic')));

  const root = join(dir, 'repo');
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, 'ok.md'), 'x'); writeFileSync(join(root, '.env'), 's'); writeFileSync(join(root, '.git/config'), 'c');
  writeFileSync(join(dir, 'outside'), 'o'); symlinkSync(join(dir, 'outside'), join(root, 'link'));
  assert.ok(resolveUnderRoot(root, 'ok.md').path);
  for (const [rel, why] of [['../outside', 'path_outside_root'], ['link', 'path_outside_root'], ['.env', 'deny_list'],
    ['.git/config', 'inside_git_dir'], ['/etc/passwd', 'path_outside_root']])
    assert.equal(resolveUnderRoot(root, rel).refused, why, rel);
  assert.throws(() => loadAllowlist('repos = ["ariaxhan/fleet-mcp", "Thinking-Brain-School/synthetic"]'));
  assert.equal(loadAllowlist().length, 12);
});
