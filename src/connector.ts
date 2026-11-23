import type { Env } from './handler';
import { type Caller, sha256Hex } from './auth';
import { CoreError, PERSONAL_SOURCE_REPOS, type Outcome } from './core';

// Design decisions for the spike (PRD 2.6.8 leaves both to deploy config, measured in S6).
export const STALE_AFTER_S = 180;
export const OFFLINE_AFTER_S = 900;
const SKEW_S = 300; // Design decision: signed request timestamp window.
const MAX_RECORDS = 200; // Design decision: records per ingest request.
const MAX_INGEST_BYTES = 256 * 1024;

const EVENT_KINDS = ['started', 'done', 'failed', 'blocker', 'stalled', 'preempted', 'retired', 'ended'];
export const PROBES = ['github', 'claude-oauth', 'codex-oauth', 'wrangler'];
const PROBE_STATUS = ['live', 'expired', 'missing', 'unknown'];
export const REASONS = ['ok', 'not_authenticated', 'cli_missing', 'credential_missing', 'credential_expired', 'unparseable', 'timeout', 'error'];
const OBSERVATION_CLASSES = ['fleet_event', 'probe', 'file_hash', 'checkout_state', 'checkpoint_hash', 'suite_run', 'lesson_writeback'];

export interface Machine { machineId: string; tenantId: string; namespaceId: string }

const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));

/** Verifies an Ed25519 machine signature over method, path, body SHA-256, timestamp and a single-use nonce. */
export async function authenticateMachine(request: Request, env: Env, body: Uint8Array<ArrayBuffer>, now: Date): Promise<Machine | null> {
  const h = (k: string) => request.headers.get(`x-fleet-${k}`) ?? '';
  const machineId = h('machine'), ts = h('timestamp'), nonce = h('nonce'), sig = h('signature');
  if (!/^m_[a-f0-9]{32}$/.test(machineId) || !/^\d{13}$/.test(ts) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)
    || !/^[A-Za-z0-9_-]{86}$/.test(sig) || Math.abs(now.getTime() - Number(ts)) > SKEW_S * 1000) return null;
  const row = await env.DB.prepare('SELECT * FROM machines WHERE machine_id = ? AND revoked_at IS NULL')
    .bind(machineId).first<Record<string, string>>();
  if (!row) return null;
  const url = new URL(request.url);
  const message = `${request.method}\n${url.pathname}\n${await sha256Hex(body)}\n${ts}\n${nonce}`;
  const key = await crypto.subtle.importKey('raw', b64u(row.public_key), { name: 'Ed25519' }, false, ['verify']);
  if (!await crypto.subtle.verify('Ed25519', key, b64u(sig), new TextEncoder().encode(message))) return null;
  // Single use: the primary key rejects a replayed nonce.
  try {
    await env.DB.prepare('INSERT INTO connector_nonces VALUES (?, ?, ?)').bind(machineId, nonce, now.toISOString()).run();
  } catch { return null; }
  return { machineId, tenantId: row.tenant_id, namespaceId: row.namespace_id };
}

const iso = (v: unknown, now: Date) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  // Never stamped later than receipt: a skewed clock cannot make data look fresher than it is.
  return Number.isNaN(t) ? null : new Date(Math.min(t, now.getTime())).toISOString();
};
const posInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ** 31;

export async function ingest(env: Env, m: Machine, raw: Uint8Array<ArrayBuffer>, now: Date): Promise<Outcome> {
  if (raw.byteLength > MAX_INGEST_BYTES) throw new CoreError(413, 'payload_too_large');
  let input: any;
  try { input = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new CoreError(400, 'invalid_input'); }
  const hb = input?.heartbeat;
  if (typeof input?.sidecar_version !== 'string' || !/^[\w.-]{1,32}$/.test(input.sidecar_version)
    || !Array.isArray(input.records) || input.records.length > MAX_RECORDS
    || !hb || ![hb.last_seq, hb.outbox_depth, hb.dropped_for_boundary].every(posInt)) throw new CoreError(400, 'invalid_input');
  const at = now.toISOString(), actor = `connector:${m.machineId}`;
  const result = { accepted: 0, duplicate: 0, dropped_for_boundary: 0, rejected: 0 };
  for (const r of input.records) {
    const observed = iso(r?.observed_at, now);
    if (!observed || !posInt(r?.seq)) { result.rejected++; continue; }
    if (typeof r.repo === 'string' && !PERSONAL_SOURCE_REPOS.includes(r.repo)) { result.dropped_for_boundary++; continue; }
    if (r.type === 'fleet_event') {
      if (!PERSONAL_SOURCE_REPOS.includes(r.repo) || !EVENT_KINDS.includes(r.event_kind)
        || typeof r.task_id !== 'string' || !r.task_id.startsWith(`${r.repo}#`) || !/^[\w./#-]{1,128}$/.test(r.task_id)
        || typeof r.attempt_id !== 'string' || !/^\d{1,12}$/.test(r.attempt_id)
        || typeof r.event_key !== 'string' || !/^[\w:.-]{1,128}$/.test(r.event_key)) { result.rejected++; continue; }
      const seen = await env.DB.prepare('SELECT 1 FROM fleet_events WHERE machine_id = ? AND event_key = ?')
        .bind(m.machineId, r.event_key).first();
      if (seen) { result.duplicate++; continue; }
      try {
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO change_events (tenant_id, namespace_id, kind, name, version, change_kind, source_repo,
            actor_principal_id, created_at, source_observed_at) VALUES (?, ?, 'fleet_event', ?, ?, 'created', ?, ?, ?, ?)`)
            .bind(m.tenantId, m.namespaceId, `fleet/${r.task_id}/attempt/${r.attempt_id}/${r.event_kind}`, r.seq, r.repo, actor, at, observed),
          env.DB.prepare('INSERT INTO fleet_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, last_insert_rowid())')
            .bind(m.machineId, r.seq, r.event_key, r.task_id, r.repo, r.attempt_id, r.event_kind, observed, at),
        ]);
        result.accepted++;
      } catch { result.duplicate++; } // A concurrent delivery won the primary key; the batch rolled back.
    } else if (r.type === 'probe') {
      if (!PROBES.includes(r.probe) || !PROBE_STATUS.includes(r.status) || !REASONS.includes(r.reason_code)) { result.rejected++; continue; }
      await env.DB.prepare(`INSERT INTO probe_results VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET status = excluded.status,
        reason_code = excluded.reason_code, source_observed_at = excluded.source_observed_at, received_at = excluded.received_at
        WHERE excluded.source_observed_at >= probe_results.source_observed_at`)
        .bind(m.machineId, r.probe, r.status, r.reason_code, observed, at).run();
      result.accepted++;
    } else if (r.type === 'file_hash') {
      if (!PERSONAL_SOURCE_REPOS.includes(r.repo) || typeof r.path !== 'string' || !/^[\w./-]{1,256}$/.test(r.path) || r.path.includes('..')
        || !/^[a-f0-9]{64}$/.test(r.content_hash ?? '') || !/^[a-f0-9]{40}$/.test(r.head_commit ?? '') || !posInt(r.size)) { result.rejected++; continue; }
      await env.DB.prepare(`INSERT INTO file_hashes VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET
        content_hash = excluded.content_hash, size = excluded.size, head_commit = excluded.head_commit,
        source_observed_at = excluded.source_observed_at, received_at = excluded.received_at
        WHERE excluded.source_observed_at >= file_hashes.source_observed_at`)
        .bind(m.machineId, r.repo, r.path, r.content_hash, r.size, r.head_commit, observed, at).run();
      result.accepted++;
    } else if (r.type === 'checkout_state') {
      if (!PERSONAL_SOURCE_REPOS.includes(r.repo) || typeof r.checkout_id !== 'string' || !/^[\w.-]{1,64}$/.test(r.checkout_id)
        || !/^[a-f0-9]{40}$/.test(r.head_commit ?? '') || typeof r.branch !== 'string' || !/^[\w./-]{1,128}$/.test(r.branch)
        || typeof r.dirty !== 'boolean' || !/^[a-f0-9]{64}$/.test(r.tree_hash ?? '')) { result.rejected++; continue; }
      await env.DB.prepare(`INSERT INTO checkout_states VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET
        repo = excluded.repo, head_commit = excluded.head_commit, branch = excluded.branch, dirty = excluded.dirty, tree_hash = excluded.tree_hash,
        source_observed_at = excluded.source_observed_at, received_at = excluded.received_at
        WHERE excluded.source_observed_at >= checkout_states.source_observed_at`)
        .bind(m.machineId, r.checkout_id, r.repo, r.head_commit, r.branch, r.dirty ? 1 : 0, r.tree_hash, observed, at).run();
      result.accepted++;
    } else if (r.type === 'checkpoint_hash') {
      if (!PERSONAL_SOURCE_REPOS.includes(r.repo) || typeof r.checkpoint_id !== 'string' || !/^[\w.-]{1,128}$/.test(r.checkpoint_id)
        || !/^[a-f0-9]{64}$/.test(r.local_hash ?? '')) { result.rejected++; continue; }
      await env.DB.prepare(`INSERT INTO checkpoint_reports VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET
        repo = excluded.repo, local_hash = excluded.local_hash, source_observed_at = excluded.source_observed_at, received_at = excluded.received_at
        WHERE excluded.source_observed_at >= checkpoint_reports.source_observed_at`)
        .bind(m.machineId, r.checkpoint_id, r.repo, r.local_hash, observed, at).run();
      result.accepted++;
    } else result.rejected++;
  }
  // Per-class last successful observation, fixed keys only; values are clamped timestamps.
  const obs: Record<string, string> = {};
  if (hb.observations && typeof hb.observations === 'object')
    for (const k of OBSERVATION_CLASSES) { const t = iso(hb.observations[k], now); if (t) obs[k] = t; }
  await env.DB.prepare(`INSERT INTO connector_status (machine_id, sidecar_version, last_seq, outbox_depth, dropped_for_boundary,
    last_heartbeat_at, observations_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET
    sidecar_version = excluded.sidecar_version, last_seq = excluded.last_seq, outbox_depth = excluded.outbox_depth,
    dropped_for_boundary = excluded.dropped_for_boundary, last_heartbeat_at = excluded.last_heartbeat_at, observations_json = excluded.observations_json`)
    .bind(m.machineId, input.sidecar_version, hb.last_seq, hb.outbox_depth, hb.dropped_for_boundary, at, JSON.stringify(obs)).run();
  // Durable state commits before wakeup. Duplicate retries also recover a failed notification.
  if (env.FLEET_WAIT) {
    const name=JSON.stringify([m.tenantId,m.namespaceId]);
    const response=await env.FLEET_WAIT.get(env.FLEET_WAIT.idFromName(name)).fetch('https://wait/notify',{method:'POST'});
    if(!response.ok) throw new CoreError(503,'wait_notification_failed');
  }
  return { body: { ...result, received_at: at }, targetId: m.machineId, size: raw.byteLength };
}

export function connectorState(lastHeartbeatAt: string | null, now: Date): 'fresh' | 'stale' | 'offline' {
  if (!lastHeartbeatAt) return 'offline';
  const age = (now.getTime() - Date.parse(lastHeartbeatAt)) / 1000;
  return age > OFFLINE_AFTER_S ? 'offline' : age > STALE_AFTER_S ? 'stale' : 'fresh';
}

function requireFleet(c: Caller) {
  if (!c.capabilities.includes('fleet:read')) throw new CoreError(403, 'forbidden');
}
const visibleRepo = (c: Caller, repo: string) => PERSONAL_SOURCE_REPOS.includes(repo) && c.sourceRepos.includes(repo);

export async function connectors(env: Env, c: Caller, now: Date) {
  const { results } = await env.DB.prepare(`SELECT s.* FROM connector_status s JOIN machines m ON m.machine_id = s.machine_id
    WHERE m.tenant_id = ? AND m.namespace_id = ? AND m.revoked_at IS NULL ORDER BY s.machine_id`)
    .bind(c.tenantId, c.namespaceId).all<Record<string, any>>();
  return new Map(results.map(r => [r.machine_id as string, { ...r, connector_status: connectorState(r.last_heartbeat_at, now) } as Record<string, any>]));
}

/** Fleet status built only from sidecar observations; every value carries its observation time. */
export async function fleetStatus(env: Env, c: Caller, now: Date): Promise<Outcome> {
  requireFleet(c);
  const conns = await connectors(env, c, now);
  const ids = [...conns.keys()];
  const probes = ids.length ? (await env.DB.prepare(`SELECT * FROM probe_results WHERE machine_id IN (${ids.map(() => '?').join(',')}) ORDER BY probe`)
    .bind(...ids).all<Record<string, any>>()).results : [];
  const inIds = ids.map(() => '?').join(',');
  const checkouts = ids.length ? (await env.DB.prepare(`SELECT * FROM checkout_states WHERE machine_id IN (${inIds}) ORDER BY checkout_id`)
    .bind(...ids).all<Record<string, any>>()).results : [];
  const checkpoints = ids.length ? (await env.DB.prepare(`SELECT r.*, h.content_hash AS server_hash FROM checkpoint_reports r
    LEFT JOIN handoff_checkpoints h ON h.tenant_id = ? AND h.namespace_id = ? AND h.checkpoint_id = r.checkpoint_id
    WHERE r.machine_id IN (${inIds}) ORDER BY r.source_observed_at DESC LIMIT 50`).bind(c.tenantId, c.namespaceId, ...ids).all<Record<string, any>>()).results : [];
  const label = (machineId: string) => { const cs = conns.get(machineId)!.connector_status; return { connector_status: cs, freshness: cs === 'fresh' ? 'fresh' : 'stale' }; };
  const events = ids.length ? (await env.DB.prepare(`SELECT * FROM fleet_events WHERE machine_id IN (${ids.map(() => '?').join(',')})
    ORDER BY change_seq DESC LIMIT 50`).bind(...ids).all<Record<string, any>>()).results : [];
  return { body: {
    connectors: [...conns.values()].map(r => ({ machine_id: r.machine_id, sidecar_version: r.sidecar_version, last_seq: r.last_seq,
      outbox_depth: r.outbox_depth, dropped_for_boundary: r.dropped_for_boundary, last_heartbeat_at: r.last_heartbeat_at,
      connector_status: r.connector_status, last_successful_observation_at: JSON.parse(r.observations_json ?? '{}'),
      last_reconciled_at: r.last_reconciled_at ?? null, reconcile_missing: r.reconcile_missing ?? null })),
    checkouts: checkouts.filter(k => visibleRepo(c, k.repo)).map(k => ({ machine_id: k.machine_id, checkout_id: k.checkout_id, repo: k.repo,
      head_commit: k.head_commit, branch: k.branch, dirty: !!k.dirty, tree_hash: k.tree_hash,
      source_observed_at: k.source_observed_at, received_at: k.received_at, ...label(k.machine_id) })),
    // The server index is authoritative; a report with no index entry is never called a match.
    checkpoints: checkpoints.filter(k => visibleRepo(c, k.repo)).map(k => ({ machine_id: k.machine_id, checkpoint_id: k.checkpoint_id, repo: k.repo,
      local_hash: k.local_hash, server_hash: k.server_hash ?? null,
      comparison: !k.server_hash ? 'unknown_server' : k.server_hash === k.local_hash ? 'match' : 'diverged',
      source_observed_at: k.source_observed_at, received_at: k.received_at, ...label(k.machine_id) })),
    // Credential liveness is never served stale (PRD 2.6.8): a non-fresh observation reports unknown.
    probes: probes.map(p => {
      const cs = conns.get(p.machine_id)!.connector_status;
      const fresh = cs === 'fresh' && (now.getTime() - Date.parse(p.source_observed_at)) / 1000 <= STALE_AFTER_S;
      return { machine_id: p.machine_id, probe: p.probe, status: fresh ? p.status : 'unknown',
        reason_code: fresh ? p.reason_code : cs === 'fresh' ? 'observation_stale' : 'connector_offline',
        freshness: fresh ? 'fresh' : 'stale', source_observed_at: p.source_observed_at, connector_status: cs };
    }),
    events: events.filter(e => visibleRepo(c, e.repo)).map(e => {
      const cs = conns.get(e.machine_id)!.connector_status;
      return { task_id: e.task_id, attempt_id: e.attempt_id, event_kind: e.event_kind, machine_id: e.machine_id, seq: e.seq,
        source_observed_at: e.source_observed_at, received_at: e.received_at, connector_status: cs, freshness: cs === 'fresh' ? 'fresh' : 'stale' };
    }),
    meta: { served_at: now.toISOString(), source: 'd1', stale_after_s: STALE_AFTER_S, offline_after_s: OFFLINE_AFTER_S },
  } };
}

/** Compares the sidecar-reported working-tree hash with the published core version of the same file. */
export async function fileCompare(env: Env, c: Caller, repo: string | null, path: string | null, now: Date): Promise<Outcome> {
  requireFleet(c);
  if (!repo || !path || !c.capabilities.includes('context:read')) throw new CoreError(!repo || !path ? 400 : 403, !repo || !path ? 'invalid_input' : 'forbidden');
  if (!visibleRepo(c, repo)) throw new CoreError(404, 'not_found');
  const conns = await connectors(env, c, now);
  const ids = [...conns.keys()];
  const local = ids.length ? await env.DB.prepare(`SELECT * FROM file_hashes WHERE repo = ? AND path = ?
    AND machine_id IN (${ids.map(() => '?').join(',')}) ORDER BY source_observed_at DESC LIMIT 1`)
    .bind(repo, path, ...ids).first<Record<string, any>>() : null;
  const pub = await env.DB.prepare(`SELECT v.version, v.content_hash, v.source_commit, v.source_observed_at FROM resources r JOIN versions v
    ON v.tenant_id = r.tenant_id AND v.namespace_id = r.namespace_id AND v.kind = r.kind AND v.name = r.name AND v.version = r.current_version
    WHERE r.tenant_id = ? AND r.namespace_id = ? AND r.kind = 'doc' AND r.name = ? AND v.status = 'active'`)
    .bind(c.tenantId, c.namespaceId, `${repo}/${path}`).first<Record<string, any>>();
  const cs = local ? conns.get(local.machine_id)!.connector_status : null;
  const comparison = !local ? 'unknown_local' : !pub ? 'unknown_published' : local.content_hash === pub.content_hash ? 'match' : 'diverged';
  return { body: {
    repo, path, comparison,
    // A comparison against a non-fresh observation is labeled stale with the observation time, never re-stamped.
    freshness: local ? (cs === 'fresh' ? 'fresh' : 'stale') : null,
    local: local && { content_hash: local.content_hash, size: local.size, head_commit: local.head_commit, machine_id: local.machine_id,
      source_observed_at: local.source_observed_at, received_at: local.received_at, connector_status: cs },
    published: pub && { version: pub.version, content_hash: pub.content_hash, source_commit: pub.source_commit, source_observed_at: pub.source_observed_at },
    meta: { served_at: now.toISOString(), source: 'd1' },
  }, targetId: `${repo}/${path}` };
}
