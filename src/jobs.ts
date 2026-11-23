import type { Env } from './handler';
import { type Caller, sha256Hex } from './auth';
import { CoreError, PERSONAL_SOURCE_REPOS, type Outcome } from './core';
import { connectors, PROBES, REASONS, type Machine } from './connector';
import { SOURCE_DB } from './recall';

// Pull-only typed work queue (PRD 2.6.5). It doubles as the lesson write-back outbox:
// a recall_learn row is a lesson_writeback job, and D1 stays authoritative until it is done.
// Design decisions, not measured: lease, expiry, retry count, upload size.
const LEASE_S = 300;
const DEFAULT_EXPIRY_S = 3600;
const WRITEBACK_EXPIRY_S = 7 * 24 * 3600;
const MAX_ATTEMPTS = 3;
export const MAX_UPLOAD_BYTES = 1024 * 1024;
const RECONCILE_MAX_KEYS = 2000;

export const JOB_KINDS = ['probe', 'checkout_state', 'file_upload', 'suite_run', 'lesson_writeback'];
const SUITES = ['fleet-mcp-typecheck'];
const LESSON_KINDS = ['failure', 'pattern', 'gotcha', 'preference'];
const TERMINAL_REASONS = ['ok', 'unsupported_kind', 'unknown_suite', 'path_outside_root', 'inside_git_dir', 'deny_list', 'not_found',
  'not_regular_file', 'repo_not_allowlisted', 'checkout_not_registered', 'too_large', 'workspace_changed_during_suite', 'write_failed', 'error'];

const visibleRepo = (c: Caller, repo: unknown) => typeof repo === 'string' && PERSONAL_SOURCE_REPOS.includes(repo) && c.sourceRepos.includes(repo);
const relPath = (p: unknown) => typeof p === 'string' && /^[\w./-]{1,256}$/.test(p) && !p.split('/').includes('..') && !p.startsWith('/');
const plain = (s: unknown, max: number) => typeof s === 'string' && s.length > 0 && s.length <= max && !/[\u0000-\u0008\u000b-\u001f]/.test(s);

/** Validates job params per kind. The server sends names and ids, never argv, env or absolute paths. */
function jobParams(c: Caller, kind: string, p: any): Record<string, unknown> {
  const bad = () => { throw new CoreError(400, 'invalid_input'); };
  if (!p || typeof p !== 'object') bad();
  if (kind !== 'probe' && kind !== 'lesson_writeback' && !visibleRepo(c, p.repo)) throw new CoreError(403, 'source_not_allowlisted');
  switch (kind) {
    case 'probe': if (!PROBES.includes(p.probe)) bad(); return { probe: p.probe };
    case 'checkout_state': return { repo: p.repo };
    case 'file_upload': if (!relPath(p.path)) bad(); return { repo: p.repo, path: p.path };
    case 'suite_run': if (typeof p.suite !== 'string' || !/^[\w.-]{1,64}$/.test(p.suite)) bad(); return { repo: p.repo, suite: p.suite };
    case 'lesson_writeback':
      if (!LESSON_KINDS.includes(p.kind) || !plain(p.what, 500) || !plain(p.why, 1000)) bad();
      return { source_db: SOURCE_DB, kind: p.kind, what: p.what, why: p.why };
  }
  throw new CoreError(400, 'unsupported_kind');
}

async function insertJob(env: Env, c: Caller, machineId: string, kind: string, params: Record<string, unknown>, expiryS: number, now: Date) {
  const jobId = crypto.randomUUID(), at = now.toISOString();
  await env.DB.prepare(`INSERT INTO connector_jobs (job_id, tenant_id, namespace_id, machine_id, kind, params_json, status, attempts,
    max_attempts, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?)`)
    .bind(jobId, c.tenantId, c.namespaceId, machineId, kind, JSON.stringify(params), MAX_ATTEMPTS,
      new Date(now.getTime() + expiryS * 1000).toISOString(), at, at).run();
  return jobId;
}

/** The single live machine for this namespace, or a precise error. */
async function targetMachine(env: Env, c: Caller, requested: unknown, now: Date) {
  const conns = await connectors(env, c, now);
  if (typeof requested === 'string') { if (!conns.has(requested)) throw new CoreError(404, 'machine_not_found'); return requested; }
  const ids = [...conns.keys()];
  if (ids.length !== 1) throw new CoreError(409, ids.length ? 'machine_ambiguous' : 'no_connector');
  return ids[0];
}

export async function enqueueJob(env: Env, c: Caller, input: any, now: Date): Promise<Outcome> {
  if (!c.capabilities.includes('fleet:write')) throw new CoreError(403, 'forbidden');
  if (!JOB_KINDS.includes(input?.kind) || input.kind === 'lesson_writeback') throw new CoreError(400, 'unsupported_kind');
  const params = jobParams(c, input.kind, input.params);
  const machineId = await targetMachine(env, c, input.machine_id, now);
  const expiry = Number.isInteger(input.expires_in_s) && input.expires_in_s > 0 && input.expires_in_s <= DEFAULT_EXPIRY_S ? input.expires_in_s : DEFAULT_EXPIRY_S;
  const jobId = await insertJob(env, c, machineId, input.kind, params, expiry, now);
  return { body: { job_id: jobId, status: 'queued', machine_id: machineId }, status: 202, targetId: jobId };
}

/** recall_learn: the lesson is durable in D1 now and written to the owning agent.db by the sidecar later. */
export async function recallLearn(env: Env, c: Caller, input: any, now: Date): Promise<Outcome> {
  if (!c.capabilities.includes('recall:write')) throw new CoreError(403, 'forbidden');
  const params = jobParams(c, 'lesson_writeback', input);
  const machineId = await targetMachine(env, c, input?.machine_id, now);
  const jobId = await insertJob(env, c, machineId, 'lesson_writeback', params, WRITEBACK_EXPIRY_S, now);
  return { body: { writeback_id: jobId, writeback_status: 'pending', source_db: SOURCE_DB }, status: 202, targetId: jobId };
}

/** Lease expiry and job expiry, applied before any read so no job waits indefinitely. */
async function sweep(env: Env, where: string, args: unknown[], now: Date) {
  const at = now.toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE connector_jobs SET status = 'unavailable', reason_code = 'expired_undelivered', updated_at = ?
      WHERE ${where} AND status IN ('queued', 'leased') AND expires_at <= ?`).bind(at, ...args, at),
    env.DB.prepare(`UPDATE connector_jobs SET status = 'failed', reason_code = 'lease_expired', updated_at = ?
      WHERE ${where} AND status = 'leased' AND lease_until <= ? AND attempts >= max_attempts`).bind(at, ...args, at),
    env.DB.prepare(`UPDATE connector_jobs SET status = 'queued', lease_until = NULL, updated_at = ?
      WHERE ${where} AND status = 'leased' AND lease_until <= ? AND attempts < max_attempts`).bind(at, ...args, at),
  ]);
}

const publicJob = (r: Record<string, any>) => ({
  job_id: r.job_id, kind: r.kind, machine_id: r.machine_id, params: JSON.parse(r.params_json), status: r.status,
  ...(r.kind === 'lesson_writeback' ? { writeback_status: r.status === 'done' ? 'done' : r.status === 'queued' || r.status === 'leased' ? 'pending' : r.status } : {}),
  attempts: r.attempts, max_attempts: r.max_attempts, reason_code: r.reason_code ?? null, result: r.result_json ? JSON.parse(r.result_json) : null,
  source_observed_at: r.source_observed_at ?? null, created_at: r.created_at, updated_at: r.updated_at, expires_at: r.expires_at,
});

export async function readJob(env: Env, c: Caller, p: URLSearchParams, now: Date): Promise<Outcome> {
  if (!c.capabilities.includes('fleet:read')) throw new CoreError(403, 'forbidden');
  const id = p.get('id');
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new CoreError(400, 'invalid_input');
  await sweep(env, 'job_id = ?', [id], now);
  const r = await env.DB.prepare('SELECT * FROM connector_jobs WHERE job_id = ? AND tenant_id = ? AND namespace_id = ?')
    .bind(id, c.tenantId, c.namespaceId).first<Record<string, any>>();
  const params = r && JSON.parse(r.params_json);
  if (!r || (params.repo && !visibleRepo(c, params.repo))) throw new CoreError(404, 'not_found');
  const body: Record<string, unknown> = { job: publicJob(r), meta: { served_at: now.toISOString(), source: 'd1' } };
  if (p.get('include') === 'bytes' && r.kind === 'file_upload' && r.status === 'done') {
    if (!c.capabilities.includes('context:read')) throw new CoreError(403, 'forbidden');
    const res = JSON.parse(r.result_json);
    const obj = await env.BLOBS.get(res.artifact_key);
    // A missing artifact is a recorded data-loss failure, never reconstructed.
    if (!obj) throw new CoreError(410, 'artifact_missing', { artifact_key: res.artifact_key });
    const bytes = new Uint8Array(await obj.arrayBuffer());
    if (await sha256Hex(bytes) !== res.content_hash) throw new CoreError(500, 'artifact_corrupt');
    let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
    body.bytes_base64 = btoa(bin);
  }
  return { body, targetId: id };
}

/** Sidecar lease: the GET is the ack, recorded before the sidecar runs anything. */
export async function leaseWork(env: Env, m: Machine, now: Date): Promise<Outcome> {
  await sweep(env, 'machine_id = ?', [m.machineId], now);
  const r = await env.DB.prepare(`SELECT * FROM connector_jobs WHERE machine_id = ? AND tenant_id = ? AND namespace_id = ? AND status = 'queued'
    ORDER BY created_at, job_id LIMIT 1`).bind(m.machineId, m.tenantId, m.namespaceId).first<Record<string, any>>();
  if (!r) return { body: { job: null } };
  const lease = new Date(Math.min(now.getTime() + LEASE_S * 1000, Date.parse(r.expires_at))).toISOString();
  const res: any = await env.DB.prepare(`UPDATE connector_jobs SET status = 'leased', attempts = attempts + 1, lease_until = ?, updated_at = ?
    WHERE job_id = ? AND status = 'queued'`).bind(lease, now.toISOString(), r.job_id).run();
  if (res?.meta?.changes === 0 || res?.changes === 0) return { body: { job: null } };
  return { body: { job: { job_id: r.job_id, kind: r.kind, params: JSON.parse(r.params_json), lease_until: lease, expires_at: r.expires_at } }, targetId: r.job_id };
}

const b64bytes = (s: string) => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

/** Sidecar result: idempotent on job_id; a duplicate returns the stored outcome. */
export async function jobResult(env: Env, m: Machine, raw: Uint8Array<ArrayBuffer>, now: Date): Promise<Outcome> {
  if (raw.byteLength > MAX_UPLOAD_BYTES * 1.4 + 4096) throw new CoreError(413, 'payload_too_large');
  let input: any;
  try { input = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new CoreError(400, 'invalid_input'); }
  if (typeof input?.job_id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.job_id)) throw new CoreError(400, 'invalid_input');
  const r = await env.DB.prepare('SELECT * FROM connector_jobs WHERE job_id = ? AND machine_id = ?').bind(input.job_id, m.machineId).first<Record<string, any>>();
  if (!r) throw new CoreError(404, 'not_found');
  if (r.status !== 'leased') return { body: { job_id: r.job_id, status: r.status, duplicate: true }, targetId: r.job_id };
  const status = input.status;
  if (!['done', 'failed', 'unsupported', 'refused'].includes(status) || !TERMINAL_REASONS.includes(input.reason_code)) throw new CoreError(400, 'invalid_input');
  const observed = typeof input.observed_at === 'string' && !Number.isNaN(Date.parse(input.observed_at))
    ? new Date(Math.min(Date.parse(input.observed_at), now.getTime())).toISOString() : null;
  const params = JSON.parse(r.params_json);
  let result: Record<string, unknown> | null = null;
  if (status === 'done') {
    if (!observed) throw new CoreError(400, 'invalid_input');
    if (r.kind === 'file_upload') {
      // Upload completion validation (PRD 6.4): size and SHA-256 recomputed server-side, content-addressed key.
      if (typeof input.bytes_base64 !== 'string' || !/^[a-f0-9]{64}$/.test(input.content_hash ?? '') || !/^[a-f0-9]{40}$/.test(input.head_commit ?? ''))
        throw new CoreError(400, 'invalid_input');
      let bytes: Uint8Array<ArrayBuffer>;
      try { bytes = b64bytes(input.bytes_base64); } catch { throw new CoreError(400, 'invalid_input'); }
      if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new CoreError(413, 'payload_too_large');
      if (bytes.byteLength !== input.size || await sha256Hex(bytes) !== input.content_hash) throw new CoreError(422, 'upload_hash_mismatch');
      const key = `${r.tenant_id}/${r.namespace_id}/files/${input.content_hash}`;
      await env.BLOBS.put(key, bytes);
      result = { repo: params.repo, path: params.path, content_hash: input.content_hash, size: bytes.byteLength, head_commit: input.head_commit, artifact_key: key };
    } else if (r.kind === 'suite_run') {
      if (!SUITES.includes(params.suite) || typeof input.run_id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.run_id) || typeof input.passed !== 'boolean')
        throw new CoreError(400, 'invalid_input');
      result = { suite: params.suite, run_id: input.run_id, passed: input.passed };
    } else if (r.kind === 'lesson_writeback') {
      result = { source_db: SOURCE_DB, written: true };
    } else if (r.kind === 'probe') {
      // Liveness only: the attestation itself arrives through /ingest/fleet with the fixed enums.
      if (!REASONS.includes(input.probe_reason)) throw new CoreError(400, 'invalid_input');
      result = { probe: params.probe, reason_code: input.probe_reason };
    } else result = { repo: params.repo, reported_via: 'ingest_fleet' };
  }
  await env.DB.prepare(`UPDATE connector_jobs SET status = ?, reason_code = ?, result_json = ?, source_observed_at = ?, lease_until = NULL, updated_at = ?
    WHERE job_id = ? AND status = 'leased'`).bind(status, input.reason_code, result && JSON.stringify(result), observed, now.toISOString(), r.job_id).run();
  return { body: { job_id: r.job_id, status, duplicate: false }, targetId: r.job_id };
}

/** Sync reconciliation: the sidecar names the event keys it believes were delivered; the server returns those it lacks. */
export async function reconcile(env: Env, m: Machine, raw: Uint8Array<ArrayBuffer>, now: Date): Promise<Outcome> {
  let input: any;
  try { input = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new CoreError(400, 'invalid_input'); }
  const keys = input?.event_keys;
  if (!Array.isArray(keys) || keys.length > RECONCILE_MAX_KEYS || !keys.every(k => typeof k === 'string' && /^[\w:.-]{1,128}$/.test(k)))
    throw new CoreError(400, 'invalid_input');
  const have = new Set<string>();
  for (let i = 0; i < keys.length; i += 90) {
    const chunk = keys.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT event_key FROM fleet_events WHERE machine_id = ? AND event_key IN (${chunk.map(() => '?').join(',')})`)
      .bind(m.machineId, ...chunk).all<{ event_key: string }>();
    for (const x of results) have.add(x.event_key);
  }
  const missing = keys.filter(k => !have.has(k));
  const at = now.toISOString();
  await env.DB.prepare('UPDATE connector_status SET last_reconciled_at = ?, reconcile_missing = ? WHERE machine_id = ?').bind(at, missing.length, m.machineId).run();
  return { body: { checked: keys.length, missing, reconciled_at: at } };
}
