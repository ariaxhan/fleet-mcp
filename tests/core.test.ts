import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/handler';
import { setup } from './harness';

const SHA = 'b'.repeat(40), OBSERVED = new Date().toISOString();
const doc = (body: string, key: string, base?: number) => ({ body, change_note: 'seed', idempotency_key: key, base_version: base,
  source: { repo: 'ariaxhan/fleet-mcp', commit: SHA, path: 'AGENTS.md' }, source_observed_at: OBSERVED });
const NAME = encodeURIComponent('ariaxhan/fleet-mcp/AGENTS.md');

test('publish, read, version history, feed and audit hold together', async () => {
  const { db, env, tokens, call } = await setup();
  const p1 = await call(tokens.publisher, '/v1/docs/publish', doc('one', 'key-00001'));
  assert.equal(p1.status, 201);
  assert.equal(p1.body.version, 1);
  const replay = await call(tokens.publisher, '/v1/docs/publish', doc('one', 'key-00001'));
  assert.equal(replay.body.replayed, true, JSON.stringify(replay.body));
  assert.equal(replay.body.change_feed_seq, p1.body.change_feed_seq);
  assert.equal((await call(tokens.publisher, '/v1/docs/publish', doc('two', 'key-00001'))).body.error, 'idempotency_conflict');
  assert.equal((await call(tokens.publisher, '/v1/docs/publish', doc('two', 'key-00002'))).body.error, 'version_conflict');
  assert.equal((await call(tokens.publisher, '/v1/docs/publish', doc('two', 'key-00003', 1))).body.version, 2);

  const hit = await call(tokens.reader, `/v1/docs/get?name=${NAME}`);
  assert.equal(hit.status, 200);
  assert.equal(hit.body.body, 'two');
  assert.equal(hit.body.meta.cache_status, 'hit'); // Outbox copied the body to KV.
  for (const k of ['served_at', 'source_observed_at', 'last_validated_at', 'computed_at', 'content_hash', 'version', 'source'])
    assert.ok(hit.body.meta[k] !== undefined, k);
  const v1 = await call(tokens.reader, `/v1/docs/get?name=${NAME}&version=1`);
  assert.equal(v1.body.body, 'one');
  assert.equal((await call(tokens.reader, `/v1/docs/get?name=${NAME}&consistency=strong`)).body.meta.cache_status, 'bypass');
  assert.equal((await call(tokens.reader, `/v1/docs/get?name=${NAME}&since_version=2`)).body.unchanged, true);

  (env.CACHE as any).m.clear(); // A KV wipe loses latency, never data.
  const miss = await call(tokens.reader, `/v1/docs/get?name=${NAME}`);
  assert.equal(miss.body.meta.cache_status, 'miss');
  assert.equal(miss.body.body, 'two');

  const boot = await call(tokens.reader, '/v1/changes');
  assert.equal(boot.body.resources[0].version, 2);
  const feed = await call(tokens.reader, '/v1/changes?cursor=' + encodeURIComponent(boot.body.next_cursor));
  assert.equal(feed.body.unchanged, true);
  const atStart = await call(tokens.reader, '/v1/changes');
  await call(tokens.publisher, '/v1/docs/publish', doc('three', 'key-00004', 2));
  const delta = await call(tokens.reader, '/v1/changes?cursor=' + encodeURIComponent(atStart.body.next_cursor));
  assert.deepEqual(delta.body.events.map((e: any) => [e.version, e.change_kind]), [[3, 'updated']]);
  assert.equal((await call(tokens.publisher, '/v1/changes?cursor=' + encodeURIComponent(atStart.body.next_cursor))).body.error,
    'invalid_cursor', 'cursor bound to principal');

  const audit = db.prepare('SELECT operation, result, content_digest FROM audit').all() as any[];
  assert.ok(audit.some(a => a.operation === 'exemplar_get_doc' && a.result === 'ok' && a.content_digest?.length === 64));
  assert.ok(audit.every(a => !JSON.stringify(a).includes('three')), 'no bodies in audit');
});

test('freshness requirement is enforced, never silently downgraded', async () => {
  const { tokens, call } = await setup();
  const old = { ...doc('x', 'key-00010'), source_observed_at: new Date(Date.now() - 3600_000).toISOString() };
  await call(tokens.publisher, '/v1/docs/publish', old);
  const unmet = await call(tokens.reader, `/v1/docs/get?name=${NAME}&max_age_s=60`);
  assert.equal(unmet.status, 409);
  assert.equal(unmet.body.error, 'freshness_unmet');
  assert.ok(unmet.body.source_observed_at);
  assert.equal((await call(tokens.reader, `/v1/docs/get?name=${NAME}&max_age_s=60&allow_stale=true`)).body.meta.cache_status, 'stale');
  assert.equal((await call(tokens.reader, `/v1/docs/get?name=${NAME}&max_age_s=7200`)).status, 200);
});

test('auth denies by default and hides foreign resources', async () => {
  const { tokens, call, env } = await setup();
  await call(tokens.publisher, '/v1/docs/publish', doc('x', 'key-00020'));
  assert.equal((await call(tokens.expired, `/v1/docs/get?name=${NAME}`)).status, 401);
  assert.equal((await call(tokens.reader.replace(/A$/, 'B'), `/v1/docs/get?name=${NAME}`)).status, 401);
  assert.equal((await call('garbage', `/v1/docs/get?name=${NAME}`)).status, 401);
  assert.equal((await call(tokens.norepo, `/v1/docs/get?name=${NAME}`)).body.error, 'not_found');
  assert.equal((await call(tokens.reader, '/v1/docs/get?name=nope')).body.error, 'not_found');
  assert.equal((await call(tokens.reader, '/v1/docs/publish', doc('y', 'key-00021', 1))).status, 403);
  const excluded = { ...doc('y', 'key-00022'), source: { repo: 'synthetic-excluded/repo', commit: SHA, path: 'a.md' } };
  assert.equal((await call(tokens.publisher, '/v1/docs/publish', excluded)).body.error, 'source_not_allowlisted');
  const noKey = await handle(new Request(`https://fixture/v1/docs/get?name=${NAME}`, { headers: { authorization: `Bearer ${tokens.reader}` } }),
    { ...env, TOKEN_HMAC_KEY: undefined });
  assert.equal(noKey.status, 503);
});

test('corrupt cached copy is never served', async () => {
  const { tokens, call, env } = await setup();
  await call(tokens.publisher, '/v1/docs/publish', doc('good', 'key-00030'));
  const m = (env.CACHE as any).m as Map<string, ArrayBuffer>;
  for (const k of m.keys()) m.set(k, new TextEncoder().encode('evil').buffer);
  assert.equal((await call(tokens.reader, `/v1/docs/get?name=${NAME}`)).body.error, 'integrity_failure');
  assert.equal((await call(tokens.reader, `/v1/docs/get?name=${NAME}`)).body.body, 'good', 'evicted, refilled from R2');
});
