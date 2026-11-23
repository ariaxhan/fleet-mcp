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
  TOKEN_HMAC_KEY?: string;
  GITHUB_TOKEN?: string;
  GITHUB_WEBHOOK_SECRET?: string;
}
import { authenticate, writeAudit, PolicyUnavailable, type Caller } from './auth';
import { publishDoc, getDoc, changes, CoreError, type Outcome } from './core';
import { authenticateMachine, ingest, fleetStatus, fileCompare } from './connector';

import { issueGet, issueList, githubWebhook, reconcile } from './issues';
import { recallQuery, recallHealth, syncRecall } from './recall';

import { fleetGet, fleetList, fleetChanges } from './fleet';
import { fleetWait } from './wait';

const STAGE = 'spike-core';
const ROUTES: Record<string, { method: string; operation: string;
  run: (env: Env, c: Caller, r: Request, u: URL, now: Date) => Promise<Outcome> }> = {
  '/v1/issues/get': { method:'GET', operation:'issue_get', run:(e,c,_r,u,n)=>issueGet(e,c,u.searchParams,n) },
  '/v1/issues/list': { method:'GET', operation:'issue_list', run:(e,c,_r,u,n)=>issueList(e,c,u.searchParams,n) },
  '/v1/recall/query': { method:'GET', operation:'recall_query', run:(e,c,_r,u,n)=>recallQuery(e,c,u.searchParams,n) },
  '/v1/recall/health': { method:'GET', operation:'recall_store_health', run:(e,c,_r,u,n)=>recallHealth(e,c,u.searchParams,n) },
  '/admin/sync/recall': { method:'POST', operation:'recall_sync', run:async(e,c,r,_u,n)=> {
    let input; try { input=await r.json(); } catch { throw new CoreError(400,'invalid_input'); }
    return syncRecall(e,c,input,n);
  } },
  '/admin/sync/github': { method:'POST', operation:'github_reconcile', run:async(e,c,_r,u)=> {
    if(!c.capabilities.includes('admin')) throw new CoreError(403,'forbidden');
    return {body:await reconcile(e,c,u.searchParams.get('repo')??'')};
  } },
  '/v1/docs/get': { method: 'GET', operation: 'exemplar_get_doc', run: (env, c, _r, u, now) => getDoc(env, c, {
    name: u.searchParams.get('name'), version: u.searchParams.get('version'), since_version: u.searchParams.get('since_version'),
    max_age_s: u.searchParams.get('max_age_s'), allow_stale: u.searchParams.get('allow_stale'), consistency: u.searchParams.get('consistency'),
  }, now) },
  '/v1/docs/publish': { method: 'POST', operation: 'ref_publish', run: async (env, c, r, _u, now) => {
    let input; try { input = await r.json(); } catch { throw new CoreError(400, 'invalid_input'); }
    return publishDoc(env, c, input as never, now);
  } },
  '/v1/changes': { method: 'GET', operation: 'doc_what_changed_since', run: (env, c, _r, u, now) =>
    changes(env, c, u.searchParams.get('cursor'), now) },
  '/v1/fleet/get': { method:'GET', operation:'fleet_get_flight', run:(e,c,_r,u,n)=>fleetGet(e,c,u.searchParams,n) },
  '/v1/fleet/list': { method:'GET', operation:'fleet_list_flights', run:(e,c,_r,u,n)=>fleetList(e,c,u.searchParams,n) },
  '/v1/fleet/changes': { method:'GET', operation:'fleet_what_changed_since', run:(e,c,_r,u,n)=>fleetChanges(e,c,u.searchParams,n) },
  '/v1/fleet/wait': { method:'POST', operation:'fleet_wait_for', run:async(e,c,r)=> {
    let input; try { input=await r.json(); } catch { throw new CoreError(400,'invalid_input'); }
    return fleetWait(e,c,input);
  } },
  '/v1/fleet/status': { method: 'GET', operation: 'fleet_status', run: (env, c, _r, _u, now) => fleetStatus(env, c, now) },
  '/v1/fleet/file-compare': { method: 'GET', operation: 'fleet_file_compare', run: (env, c, _r, u, now) =>
    fileCompare(env, c, u.searchParams.get('repo'), u.searchParams.get('path'), now) },
};

/** Sidecar push: signed by the machine key, never a bearer token; audit precedes ingestion. */
async function connectorIngest(request: Request, env: Env): Promise<Response> {
  const start = Date.now(), now = new Date(), correlationId = crypto.randomUUID();
  const raw = new Uint8Array(await request.arrayBuffer());
  let machine;
  try { machine = await authenticateMachine(request, env, raw, now); } catch { return json({ error: 'policy_unavailable' }, 503); }
  const base = { operation: 'connector_ingest_fleet', correlationId, caller: null };
  if (!machine) {
    await writeAudit(env, { ...base, result: 'unauthenticated', latencyMs: Date.now() - start }, now).catch(() => {});
    return json({ error: 'unauthorized' }, 401);
  }
  try { await writeAudit(env, { ...base, result: 'started', targetId: machine.machineId }, now); } catch { return json({ error: 'audit_unavailable' }, 503); }
  let status = 200, payload: Record<string, unknown>;
  try { payload = (await ingest(env, machine, raw, now)).body; } catch (e) {
    status = e instanceof CoreError ? e.status : 500; payload = { error: e instanceof CoreError ? e.code : 'internal_error' };
  }
  await writeAudit(env, { ...base, result: status < 400 ? 'ok' : String(payload.error), targetId: machine.machineId,
    latencyMs: Date.now() - start, size: raw.byteLength }, new Date()).catch(() => {});
  return json({ ...payload, correlation_id: correlationId }, status);
}

/** Authenticated core route: audit precedes dispatch, and audit failure denies the operation. */
async function protectedRoute(request: Request, env: Env, url: URL, route: typeof ROUTES[string]): Promise<Response> {
  const start = Date.now(), now = new Date(), correlationId = crypto.randomUUID();
  let caller: Caller | null;
  try { caller = await authenticate(request, env, now); } catch (e) {
    return json({ error: e instanceof PolicyUnavailable ? 'policy_unavailable' : 'internal_error' }, 503);
  }
  const base = { caller, operation: route.operation, correlationId };
  if (!caller) {
    await writeAudit(env, { ...base, result: 'unauthenticated', latencyMs: Date.now() - start }, now).catch(() => {});
    return json({ error: 'unauthorized' }, 401);
  }
  try { await writeAudit(env, { ...base, result: 'started' }, now); } catch { return json({ error: 'audit_unavailable' }, 503); }
  let status = 500, payload: Record<string, unknown> = { error: 'internal_error' }, out: Outcome | null = null;
  try {
    out = await route.run(env, caller, request, url, now);
    status = out.status ?? 200; payload = out.body;
  } catch (e) {
    if (e instanceof CoreError) { status = e.status; payload = { error: e.code, ...e.detail }; }
  }
  await writeAudit(env, { ...base, result: status < 400 ? 'ok' : String(payload.error), targetId: out?.targetId,
    latencyMs: Date.now() - start, size: out?.size, contentDigest: out?.digest }, new Date()).catch(() => {});
  return json({ ...payload, correlation_id: correlationId }, status);
}

const json = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
});

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname;
  if(path === '/webhooks/github' && request.method === 'POST') return githubWebhook(request,env);
  const route = ROUTES[path];
  if (path === '/ingest/fleet') return request.method === 'POST' ? connectorIngest(request, env) : json({ error: 'method_not_allowed' }, 405);
  if (route) return request.method === route.method ? protectedRoute(request, env, url, route) : json({ error: 'method_not_allowed' }, 405);
  if (request.method !== 'GET') return json({ error: 'not_implemented' }, 501);
  if (path === '/health') return json({ status: 'ok', service: 'fleet-mcp', stage: STAGE });
  if (path === '/version') return json({
    commit: env.BUILD_SHA ?? 'development', build_time: env.BUILD_TIME ?? null,
    environment: env.ENVIRONMENT, stage: STAGE, mcp_protocol: null,
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
  // MCP transport and all other corpus routes stay disabled in the core spike.
  return json({ error: 'not_found' }, 404);
}

