import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, type Env } from '../src/handler';
const env = { ENVIRONMENT: 'staging', FIXTURE_NAMESPACE: 'fixture-staging', BUILD_SHA: 'a'.repeat(40) } as Env;
test('public liveness exposes no dependency details', async () => {
  const response = await handle(new Request('https://fixture/health'), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'fleet-mcp', stage: 'scaffold' });
});
test('version identifies scaffold without claiming a working protocol', async () => {
  const response = await handle(new Request('https://fixture/version'), env);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.commit, env.BUILD_SHA);
  assert.equal(body.mcp_protocol, null);
});
test('unconfigured, missing and incorrect fixture credentials fail closed', async () => {
  for (const token of [undefined, 'valid']) {
    for (const authorization of ['', 'Bearer wrong']) {
      const r = await handle(new Request('https://fixture/internal/fixture', { headers: { authorization } }),
        { ...env, SWEEP_TOKEN: token });
      assert.equal(r.status, 401);
    }
  }
});
test('all ingestion and corpus routes remain disabled', async () => {
  for (const path of ['/mcp', '/internal/sync', '/webhooks/github', '/synthetic-excluded']) {
    assert.equal((await handle(new Request(`https://fixture${path}`), env)).status, 404);
    assert.equal((await handle(new Request(`https://fixture${path}`, { method: 'POST' }), env)).status, 501);
  }
});
test('dependency failure returns bounded error without secret details', async () => {
  const r = await handle(new Request('https://fixture/internal/fixture', {
    headers: { authorization: 'Bearer valid' },
  }), { ...env, SWEEP_TOKEN: 'valid' });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'fixture_dependency_failed' });
});
