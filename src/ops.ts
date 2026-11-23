import type { Env } from './handler';
import { CoreError } from './core';

// All limits below are design decisions (#27), not measured capacity.
export const LIMITS = {
  globalPerMin: 600, principalPerMin: 120,
  concurrency: { verify_render: 2, recall_sync: 1, github_reconcile: 1, fleet_wait_for: 16 } as Record<string, number>,
  defaultConcurrency: 8,
  payloadBytes: { ref_publish: 1_500_000, recall_sync: 4_000_000 } as Record<string, number>,
  defaultPayloadBytes: 65_536,
  deadlineMs: { fleet_wait_for: 25_000, github_reconcile: 25_000, recall_sync: 25_000 } as Record<string, number>,
  defaultDeadlineMs: 15_000,
  upstreamRetries: 2, retryBudgetRatio: 0.2, retryBudgetFloor: 5,
  breakerFailures: 5, breakerOpenMs: 60_000,
};
const MINUTE = 60_000;

export const correlationOf = (r: Request) => {
  const v = r.headers.get('x-correlation-id') ?? '';
  return /^[\w.-]{8,64}$/.test(v) ? v : crypto.randomUUID();
};

export async function record(env: Env, kind: string, name: string, value: number, correlationId?: string) {
  if (!Number.isFinite(value)) return;
  await env.DB.prepare('INSERT INTO ops_events (kind, name, value, correlation_id, observed_at) VALUES (?, ?, ?, ?, ?)')
    .bind(kind, name, value, correlationId ?? null, new Date().toISOString()).run().catch(() => {});
}

const guard = (env: Env) => env.OPS_GUARD?.get(env.OPS_GUARD.idFromName('global'));
async function call(env: Env, path: string, body: unknown): Promise<any> {
  const stub = guard(env);
  if (!stub) return null; // Unit harness without the binding; the live sweep proves the binding is enforced.
  const r = await stub.fetch(`https://ops${path}`, { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

/** Admission: global and per-principal rate, per-tool concurrency. Returns a release function. */
export async function admit(env: Env, principal: string, tool: string, deadlineMs: number): Promise<() => Promise<void>> {
  const out = await call(env, '/admit', { principal, tool, ttl_ms: deadlineMs + 5_000 });
  if (!out) return async () => {};
  if (!out.ok) throw new CoreError(429, out.reason, { retry_after_s: out.retry_after_s });
  return async () => { await call(env, '/release', { lease: out.lease }).catch(() => {}); };
}

export async function withDeadline<T>(ms: number, run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([run(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CoreError(504, 'deadline_exceeded')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** Upstream call with circuit breaker, bounded retries under a global retry budget, and rate-limit capture. */
export async function upstream(env: Env, name: string, run: () => Promise<Response>): Promise<Response> {
  const state = await call(env, '/breaker', { name });
  if (state && !state.closed) throw new CoreError(503, 'circuit_open', { upstream: name });
  let attempts = 0, response: Response | undefined;
  try {
    for (;;) {
      attempts++;
      try { response = await run(); } catch { response = undefined; }
      const retryable = !response || response.status >= 500 || response.status === 429;
      if (!retryable || attempts > LIMITS.upstreamRetries) break;
      const budget = await call(env, '/retry', { name });
      if (budget && !budget.ok) break;
      await new Promise(r => setTimeout(r, 200 * 2 ** (attempts - 1)));
    }
  } finally {
    const ok = !!response && response.status < 500 && response.status !== 429;
    await call(env, '/outcome', { name, ok }).catch(() => {});
    await record(env, 'upstream_attempts', name, attempts);
    const remaining = response?.headers.get('x-ratelimit-remaining');
    if (remaining !== null && remaining !== undefined) {
      await record(env, 'ratelimit_remaining', name, Number(remaining));
      await record(env, 'ratelimit_reset', name, Number(response!.headers.get('x-ratelimit-reset')));
    }
  }
  if (!response) throw new CoreError(503, 'upstream_unavailable', { upstream: name });
  return response;
}

interface Bucket { at: number; count: number }
/** Single global Durable Object serializes admission; KV is not atomic and per-isolate memory is not shared. */
export class OpsGuardState {
  private windows = new Map<string, Bucket>();
  private leases = new Map<string, { tool: string; until: number }>();
  private breakers = new Map<string, { failures: number; openUntil: number }>();
  constructor(private now: () => number = Date.now) {}
  private hit(key: string, limit: number) {
    const t = this.now(), w = this.windows.get(key);
    const b = !w || t - w.at >= MINUTE ? { at: t, count: 0 } : w;
    if (b.count >= limit) return Math.ceil((b.at + MINUTE - t) / 1000);
    b.count++; this.windows.set(key, b); return 0;
  }
  handle(path: string, input: any): Record<string, unknown> {
    const t = this.now();
    if (path === '/admit') {
      for (const [id, l] of this.leases) if (l.until <= t) this.leases.delete(id);
      const cap = LIMITS.concurrency[input.tool] ?? LIMITS.defaultConcurrency;
      if ([...this.leases.values()].filter(l => l.tool === input.tool).length >= cap)
        return { ok: false, reason: 'concurrency_limited', retry_after_s: 1 };
      const g = this.hit('global', LIMITS.globalPerMin);
      if (g) return { ok: false, reason: 'global_rate_limited', retry_after_s: g };
      const p = this.hit(`p:${input.principal}`, LIMITS.principalPerMin);
      if (p) return { ok: false, reason: 'principal_rate_limited', retry_after_s: p };
      const lease = crypto.randomUUID();
      this.leases.set(lease, { tool: input.tool, until: t + Math.min(Number(input.ttl_ms) || 0, 120_000) });
      return { ok: true, lease };
    }
    if (path === '/release') { this.leases.delete(input.lease); return { ok: true }; }
    if (path === '/breaker') {
      this.hit(`calls:${input.name}`, Number.MAX_SAFE_INTEGER);
      const b = this.breakers.get(input.name);
      return { closed: !b || b.openUntil <= t };
    }
    if (path === '/outcome') {
      const b = this.breakers.get(input.name) ?? { failures: 0, openUntil: 0 };
      b.failures = input.ok ? 0 : b.failures + 1;
      if (b.failures >= LIMITS.breakerFailures) { b.openUntil = t + LIMITS.breakerOpenMs; b.failures = 0; }
      this.breakers.set(input.name, b); return { ok: true };
    }
    if (path === '/retry') {
      const calls = this.windows.get(`calls:${input.name}`);
      const allowed = Math.max(LIMITS.retryBudgetFloor, Math.floor((calls?.count ?? 0) * LIMITS.retryBudgetRatio));
      return { ok: this.hit(`retry:${input.name}`, allowed) === 0 };
    }
    if (path === '/state') return {
      active_leases: Object.fromEntries([...new Set([...this.leases.values()].map(l => l.tool))]
        .map(tool => [tool, [...this.leases.values()].filter(l => l.tool === tool && l.until > t).length])),
      breakers: Object.fromEntries([...this.breakers].map(([n, b]) => [n, b.openUntil > t ? 'open' : 'closed'])),
    };
    return { error: 'not_found' };
  }
}

const AGE = (iso: string | null | undefined, now: number) => iso ? Math.max(0, (now - Date.parse(iso)) / 1000) : null;
// Alert thresholds: design decisions. A missing observation is reported unknown and alerts, never zero.
const THRESHOLDS: Record<string, number> = {
  connector_lag_s: 900, webhook_lag_s: 300, feed_coverage_age_s: 3600, outbox_backlog: 100,
  stale_response_age_s: 3600, upstream_rate_limit_remaining_min: 100, render_queue_time_s_max: 60,
  retry_amplification: 1.5,
};
const ALERT_WHEN_LOW = new Set(['upstream_rate_limit_remaining_min']);
const OPTIONAL = new Set(['webhook_lag_s', 'stale_response_age_s', 'render_queue_time_s_max', 'retry_amplification']);

export async function metrics(env: Env, nowDate = new Date()) {
  const now = nowDate.getTime(), since = new Date(now - 3600_000).toISOString();
  const one = <T>(sql: string, ...a: unknown[]) => env.DB.prepare(sql).bind(...a).first<T>();
  const agg = (kind: string, fn: string) => one<{ v: number | null }>(
    `SELECT ${fn}(value) AS v FROM ops_events WHERE kind=? AND observed_at>=?`, kind, since).then(r => r?.v ?? null);
  const [conn, cov, outbox, sidecarOutbox, reuse] = await Promise.all([
    one<{ t: string | null }>('SELECT MIN(last_heartbeat_at) AS t FROM connector_status'),
    one<{ t: string | null }>('SELECT MIN(reconciled_at) AS t FROM issue_coverage'),
    one<{ n: number; t: string | null }>(`SELECT COUNT(*) AS n, MIN(c.created_at) AS t FROM outbox o
      JOIN change_events c ON c.seq=o.seq WHERE o.applied_at IS NULL`),
    one<{ n: number | null }>('SELECT SUM(outbox_depth) AS n FROM connector_status'),
    env.DB.prepare(`SELECT name, COUNT(*) AS checks, SUM(value) AS reused FROM ops_events
      WHERE kind='verification_check' AND observed_at>=? GROUP BY name`).bind(since).all<any>(),
  ]);
  const values: Record<string, number | null> = {
    connector_lag_s: AGE(conn?.t, now),
    webhook_lag_s: await agg('webhook_lag', 'MAX'),
    feed_coverage_age_s: AGE(cov?.t, now),
    outbox_backlog: (outbox?.n ?? 0) + (sidecarOutbox?.n ?? 0),
    stale_response_age_s: await agg('stale_served', 'MAX'),
    upstream_rate_limit_remaining_min: await agg('ratelimit_remaining', 'MIN'),
    render_queue_time_s_max: await agg('render_queue', 'MAX'),
    retry_amplification: await agg('upstream_attempts', 'AVG'),
  };
  const alerts = Object.entries(values).flatMap(([name, v]) => {
    if (v === null) return OPTIONAL.has(name) ? [] : [{ metric: name, state: 'unknown', threshold: THRESHOLDS[name] }];
    const breach = ALERT_WHEN_LOW.has(name) ? v < THRESHOLDS[name] : v > THRESHOLDS[name];
    return breach ? [{ metric: name, state: 'breach', value: v, threshold: THRESHOLDS[name] }] : [];
  });
  const guardState = await call(env, '/state', {}).catch(() => null);
  return {
    observed_at: nowDate.toISOString(), window_s: 3600, values,
    outbox_oldest_age_s: AGE(outbox?.t, now),
    verification_reuse_by_checker: Object.fromEntries((reuse.results ?? []).map((r: any) =>
      [r.name, { checks: r.checks, reused: r.reused, ratio: r.checks ? r.reused / r.checks : null }])),
    no_observation_in_window: Object.keys(values).filter(k => values[k] === null && OPTIONAL.has(k)),
    admission: guardState ? { enforced: true, ...guardState } : { enforced: false },
    limits: LIMITS, thresholds: THRESHOLDS, alerts,
  };
}

/** Cron: emit alerts to Workers observability logs and the R2 ops record; prune samples older than 7 days. */
export async function alertSweep(env: Env) {
  const m = await metrics(env);
  for (const a of m.alerts) console.error(JSON.stringify({ event: 'fleet.alert', environment: env.ENVIRONMENT, ...a }));
  await env.BLOBS.put('ops/metrics/latest.json', JSON.stringify(m));
  await env.DB.prepare('DELETE FROM ops_events WHERE observed_at < ?').bind(new Date(Date.now() - 7 * 86400_000).toISOString()).run();
  return m;
}
