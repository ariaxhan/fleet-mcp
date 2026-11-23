import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './harness';
import { LIMITS, OpsGuardState, metrics, upstream, withDeadline } from '../src/ops';
import { CoreError } from '../src/core';

const guardBinding = (state = new OpsGuardState()) => ({
  idFromName: () => 'global',
  get: () => ({ fetch: async (url: string, init: RequestInit) =>
    Response.json(state.handle(new URL(url).pathname, JSON.parse(String(init.body)))) }),
}) as unknown as DurableObjectNamespace;

test('per-principal and global rate limits reject with retry_after', () => {
  let t = 0; const g = new OpsGuardState(() => t);
  for (let i = 0; i < LIMITS.principalPerMin; i++) {
    const r = g.handle('/admit', { principal: 'a', tool: 'x', ttl_ms: 1 });
    assert.equal(r.ok, true); g.handle('/release', { lease: r.lease });
  }
  t = 2;
  assert.deepEqual({ ...g.handle('/admit', { principal: 'a', tool: 'x', ttl_ms: 1 }) }, { ok: false, reason: 'principal_rate_limited', retry_after_s: 60 });
  for (let i = LIMITS.principalPerMin; i < LIMITS.globalPerMin; i++) g.handle('/release', { lease: g.handle('/admit', { principal: `p${i}`, tool: 'x', ttl_ms: 1 }).lease });
  assert.equal(g.handle('/admit', { principal: 'z', tool: 'x', ttl_ms: 1 }).reason, 'global_rate_limited');
  t = 60_001;
  assert.equal(g.handle('/admit', { principal: 'a', tool: 'x', ttl_ms: 1 }).ok, true);
});

test('tool concurrency holds until release or lease expiry', () => {
  let t = 0; const g = new OpsGuardState(() => t);
  const a = g.handle('/admit', { principal: 'a', tool: 'verify_render', ttl_ms: 1000 });
  g.handle('/admit', { principal: 'a', tool: 'verify_render', ttl_ms: 1000 });
  assert.equal(g.handle('/admit', { principal: 'b', tool: 'verify_render', ttl_ms: 1000 }).reason, 'concurrency_limited');
  g.handle('/release', { lease: a.lease });
  assert.equal(g.handle('/admit', { principal: 'b', tool: 'verify_render', ttl_ms: 1000 }).ok, true);
  t = 2000;
  assert.equal(g.handle('/admit', { principal: 'b', tool: 'verify_render', ttl_ms: 1000 }).ok, true);
});

test('deadline converts a hung operation into 504', async () => {
  await assert.rejects(withDeadline(20, () => new Promise(() => {})), (e: CoreError) => e.status === 504 && e.code === 'deadline_exceeded');
});

test('upstream retries within budget, then the breaker opens and fails fast', async () => {
  const { env } = await setup();
  env.OPS_GUARD = guardBinding();
  let calls = 0;
  const failing = async () => { calls++; return new Response('x', { status: 502 }); };
  const r = await upstream(env, 'github', failing);
  assert.equal(r.status, 502); assert.equal(calls, 1 + LIMITS.upstreamRetries);
  for (let i = 1; i < LIMITS.breakerFailures; i++) await upstream(env, 'github', failing);
  const before = calls;
  await assert.rejects(upstream(env, 'github', failing), (e: CoreError) => e.code === 'circuit_open');
  assert.equal(calls, before);
  const m = await metrics(env);
  // Retry budget (floor per minute) caps amplification below the per-call maximum once exhausted.
  const amp = m.values.retry_amplification!;
  assert.ok(amp > 1 && amp < 1 + LIMITS.upstreamRetries, String(amp));
});

test('routes: payload bound, rate limit and correlation id are enforced end to end', async () => {
  const { env, tokens, call } = await setup();
  env.OPS_GUARD = guardBinding();
  const big = await call(tokens.publisher, '/v1/docs/publish', { body: 'x'.repeat(1_600_000) });
  assert.equal(big.status, 413); assert.equal(big.body.error, 'payload_too_large');
  const { handle } = await import('../src/handler');
  const r = await handle(new Request('https://fixture/v1/docs/get?name=x', { headers: {
    authorization: `Bearer ${tokens.reader}`, 'x-correlation-id': 'trace-12345678' } }), env);
  assert.equal(r.headers.get('x-correlation-id'), 'trace-12345678');
  assert.equal((await r.json() as any).correlation_id, 'trace-12345678');
  let last = 0;
  for (let i = 0; i < LIMITS.principalPerMin + 1; i++) last = (await call(tokens.reader, '/v1/docs/get?name=x')).status;
  assert.equal(last, 429);
});

test('metrics report every B11 signal; missing required observations alert as unknown', async () => {
  const { env } = await setup();
  const m = await metrics(env);
  for (const k of ['connector_lag_s', 'webhook_lag_s', 'feed_coverage_age_s', 'outbox_backlog', 'stale_response_age_s',
    'upstream_rate_limit_remaining_min', 'render_queue_time_s_max', 'retry_amplification']) assert.ok(k in m.values, k);
  assert.ok(m.alerts.some(a => a.metric === 'connector_lag_s' && a.state === 'unknown'));
  assert.equal(m.values.outbox_backlog, 0);
  assert.deepEqual(m.verification_reuse_by_checker, {});
});
