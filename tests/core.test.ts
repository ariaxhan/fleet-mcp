import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle, type Env } from '../src/handler';
import { hmacHex } from '../src/auth';

// Real SQLite under a minimal D1 surface; R2 and KV as in-memory maps.
function d1(db: DatabaseSync) {
  const stmt = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...a: unknown[]) => stmt(sql, a.map(v => v === undefined ? null : v)),
    first: async () => (db.prepare(sql).get(...(args as never[])) ?? null),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: ReturnType<typeof stmt>[]) => {
      db.exec('BEGIN');
      try { for (const s of list) db.prepare(s.sql).run(...(s.args as never[])); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const store = () => {
  const m = new Map<string, ArrayBuffer>();
  return { m,
    put: async (k: string, v: ArrayBuffer | Uint8Array) => { m.set(k, v instanceof Uint8Array ? v.slice().buffer : v); },
    get: async (k: string, type?: string) => {
      const v = m.get(k); if (!v) return null;
      return type === 'arrayBuffer' ? v : { arrayBuffer: async () => v };
    },
    delete: async (k: string) => { m.delete(k); },
  };
};

const KEY = 'test-hmac-key';
async function setup() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort())
    db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  const env = { DB: d1(db), CACHE: store(), BLOBS: store(), TOKEN_HMAC_KEY: KEY, ENVIRONMENT: 'staging' } as unknown as Env;
  const tokens: Record<string, string> = {};
  for (const [name, caps, repos, expires] of [
    ['publisher', ['context:publish', 'context:read'], ['ariaxhan/fleet-mcp'], '2099-01-01T00:00:00Z'],
    ['reader', ['context:read'], ['ariaxhan/fleet-mcp'], '2099-01-01T00:00:00Z'],
    ['norepo', ['context:read'], [], '2099-01-01T00:00:00Z'],
    ['expired', ['context:read'], ['ariaxhan/fleet-mcp'], '2000-01-01T00:00:00Z'],
  ] as const) {
    const id = name.padEnd(32, '0').replace(/[^a-f0-9]/g, 'a').slice(0, 32);
    const token = `fmt_${id}.${'A'.repeat(43)}`;
    db.prepare(`INSERT INTO tokens VALUES (?, ?, 1, ?, 'personal', 'personal-docs', ?, ?, 'test', '2026-01-01', ?, NULL)`)
      .run(id, await hmacHex(KEY, token), name, JSON.stringify(caps), JSON.stringify(repos), expires);
    tokens[name] = token;
  }
  const call = async (token: string, path: string, body?: unknown) => {
    const r = await handle(new Request(`https://fixture${path}`, {
      method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined }), env);
    return { status: r.status, body: await r.json() as any };
  };
  return { db, env, tokens, call };
}
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
