export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  BLOBS: R2Bucket;
  BROWSER: Fetcher;
  FLEET_WAIT: DurableObjectNamespace;
  HANDOFF_COORDINATOR: DurableObjectNamespace;
  ENVIRONMENT: string;
  FIXTURE_NAMESPACE: string;
  BUILD_SHA: string;
  BUILD_TIME: string;
  SWEEP_TOKEN?: string;
}

const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export async function handle(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (request.method !== 'GET') return json({ error: 'not_implemented' }, 501);
  if (path === '/health') return json({ status: 'ok', service: 'fleet-mcp', stage: 'scaffold' });
  if (path === '/version') return json({
    commit: env.BUILD_SHA ?? 'development', build_time: env.BUILD_TIME ?? null,
    environment: env.ENVIRONMENT, stage: 'scaffold', mcp_protocol: null,
  });
  // This credential authorizes only fixed fixture probes, never corpus access.
  if (path === '/internal/fixture') {
    if (!env.SWEEP_TOKEN || request.headers.get('authorization') !== `Bearer ${env.SWEEP_TOKEN}`)
      return json({ error: 'unauthorized' }, 401);
    try {
      const row = await env.DB.prepare('SELECT namespace_id FROM scaffold_fixture WHERE namespace_id = ?')
        .bind(env.FIXTURE_NAMESPACE).first();
      const [cache, blob, wait, handoff] = await Promise.all([
        env.CACHE.get(`${env.FIXTURE_NAMESPACE}/absent`),
        env.BLOBS.head(`${env.FIXTURE_NAMESPACE}/absent`),
        env.FLEET_WAIT.get(env.FLEET_WAIT.idFromName(env.FIXTURE_NAMESPACE)).fetch('https://fixture/health'),
        env.HANDOFF_COORDINATOR.get(env.HANDOFF_COORDINATOR.idFromName(env.FIXTURE_NAMESPACE)).fetch('https://fixture/health'),
      ]);
      const checks = { d1: row !== null, kv: cache === null, r2: blob === null,
        durable_wait: wait.ok, durable_handoff: handoff.ok, browser_binding: !!env.BROWSER };
      return json({ namespace: env.FIXTURE_NAMESPACE, checks,
        browser_execution: 'deferred_to_spike' }, Object.values(checks).every(Boolean) ? 200 : 503);
    } catch {
      return json({ error: 'fixture_dependency_failed' }, 503);
    }
  }
  // No corpus ingestion, MCP transport or tools are enabled by this scaffold.
  return json({ error: 'not_found' }, 404);
}

