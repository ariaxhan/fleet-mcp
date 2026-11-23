import type { Env } from './handler';
import { type Caller, hmacHex, sha256Hex, constantTimeEqual } from './auth';

/** Non-overridable personal-project boundary: only these source repos can be ingested or served. */
export const PERSONAL_SOURCE_REPOS = ['ariaxhan/fleet-mcp'];
export const MAX_BODY_BYTES = 1024 * 1024; // Design decision for the spike.
const FEED_PAGE = 100; // Design decision.

export class CoreError extends Error {
  constructor(public status: number, public code: string, public detail: Record<string, unknown> = {}) { super(code); }
}
export interface Outcome { body: Record<string, unknown>; status?: number; targetId?: string; size?: number; digest?: string }

const blobKey = (c: Caller, hash: string) => `${c.tenantId}/${c.namespaceId}/blobs/${hash}`;
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`
  : JSON.stringify(v);

function requireCap(c: Caller, cap: string) {
  if (!c.capabilities.includes(cap)) throw new CoreError(403, 'forbidden');
}
const visible = (c: Caller, repo: string) => PERSONAL_SOURCE_REPOS.includes(repo) && c.sourceRepos.includes(repo);

export interface PublishInput {
  body: string; change_note: string; base_version?: number; idempotency_key: string;
  source: { repo: string; commit: string; path: string }; source_observed_at: string;
}

export async function publishDoc(env: Env, c: Caller, input: PublishInput, now: Date): Promise<Outcome> {
  requireCap(c, 'context:publish');
  const s = input?.source;
  if (typeof input?.body !== 'string' || typeof input.change_note !== 'string' || !input.change_note
    || typeof input.idempotency_key !== 'string' || !/^[\w.-]{8,128}$/.test(input.idempotency_key)
    || !s || typeof s.repo !== 'string' || !/^[a-f0-9]{40}$/.test(s.commit ?? '')
    || typeof s.path !== 'string' || !/^[\w./-]{1,256}$/.test(s.path) || s.path.includes('..')
    || (input.base_version !== undefined && !Number.isInteger(input.base_version))
    || Number.isNaN(Date.parse(input.source_observed_at))) throw new CoreError(400, 'invalid_input');
  if (!visible(c, s.repo)) throw new CoreError(403, 'source_not_allowlisted');
  const observed = new Date(Math.min(Date.parse(input.source_observed_at), now.getTime())).toISOString();
  const bytes = new TextEncoder().encode(input.body);
  if (bytes.length > MAX_BODY_BYTES) throw new CoreError(413, 'payload_too_large');

  const { idempotency_key, ...request } = input;
  const requestHash = await sha256Hex(canonical(request));
  const prior = await env.DB.prepare('SELECT request_hash, result FROM idempotency WHERE token_id = ? AND tool = ? AND idempotency_key = ?')
    .bind(c.tokenId, 'ref_publish', idempotency_key).first<{ request_hash: string; result: string }>();
  if (prior) {
    if (prior.request_hash !== requestHash) throw new CoreError(409, 'idempotency_conflict');
    return { body: { ...JSON.parse(prior.result), replayed: true } };
  }

  const name = `${s.repo}/${s.path}`;
  const hash = await sha256Hex(bytes);
  const current = await env.DB.prepare(`SELECT r.current_version AS v, x.content_hash AS h FROM resources r
    JOIN versions x ON x.tenant_id = r.tenant_id AND x.namespace_id = r.namespace_id AND x.kind = r.kind
      AND x.name = r.name AND x.version = r.current_version
    WHERE r.tenant_id = ? AND r.namespace_id = ? AND r.kind = 'doc' AND r.name = ?`)
    .bind(c.tenantId, c.namespaceId, name).first<{ v: number; h: string }>();
  if ((current?.v ?? undefined) !== input.base_version)
    throw new CoreError(409, 'version_conflict', { current_version: current?.v ?? null });
  if (current && current.h === hash) return { body: { name, version: current.v, content_hash: hash, unchanged: true }, targetId: name };

  // Content-addressed body first (idempotent by hash), then one atomic D1 batch.
  await env.BLOBS.put(blobKey(c, hash), bytes, { sha256: hash });
  const version = (current?.v ?? 0) + 1;
  const at = now.toISOString();
  const kind = current ? 'updated' : 'created';
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO blobs VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(c.tenantId, c.namespaceId, hash, bytes.length, c.principalId, at),
      env.DB.prepare(`INSERT INTO versions VALUES (?, ?, 'doc', ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`)
        .bind(c.tenantId, c.namespaceId, name, version, hash, bytes.length, input.change_note, s.repo, s.commit, s.path, observed, at, c.principalId),
      env.DB.prepare(`INSERT INTO resources VALUES (?, ?, 'doc', ?, ?, ?)
        ON CONFLICT DO UPDATE SET current_version = excluded.current_version`)
        .bind(c.tenantId, c.namespaceId, name, version, c.principalId),
      env.DB.prepare(`INSERT INTO change_events (tenant_id, namespace_id, kind, name, version, change_kind, source_repo, actor_principal_id, created_at)
        VALUES (?, ?, 'doc', ?, ?, ?, ?, ?, ?)`).bind(c.tenantId, c.namespaceId, name, version, kind, s.repo, c.principalId, at),
      env.DB.prepare(`INSERT INTO outbox (seq) VALUES (last_insert_rowid())`),
      env.DB.prepare(`INSERT INTO idempotency VALUES (?, 'ref_publish', ?, ?,
        json_object('name', ?, 'version', ?, 'content_hash', ?, 'change_feed_seq', last_insert_rowid()), ?)`)
        .bind(c.tokenId, idempotency_key, requestHash, name, version, hash, at),
    ]);
  } catch {
    // A concurrent writer took this version (primary key) or key; the batch rolled back.
    throw new CoreError(409, 'version_conflict');
  }
  await applyOutbox(env, c, now);
  const stored = await env.DB.prepare('SELECT result FROM idempotency WHERE token_id = ? AND tool = ? AND idempotency_key = ?')
    .bind(c.tokenId, 'ref_publish', idempotency_key).first<{ result: string }>();
  return { body: JSON.parse(stored!.result), status: 201, targetId: name, size: bytes.length, digest: hash };
}

/** Applies committed change events to disposable copies; retried on every later write until acknowledged. */
export async function applyOutbox(env: Env, c: Caller, now: Date): Promise<void> {
  const { results } = await env.DB.prepare(`SELECT o.seq, v.content_hash FROM outbox o
    JOIN change_events e ON e.seq = o.seq
    JOIN versions v ON v.tenant_id = e.tenant_id AND v.namespace_id = e.namespace_id AND v.kind = e.kind
      AND v.name = e.name AND v.version = e.version
    WHERE o.applied_at IS NULL AND e.tenant_id = ? AND e.namespace_id = ? ORDER BY o.seq LIMIT 20`)
    .bind(c.tenantId, c.namespaceId).all<{ seq: number; content_hash: string }>();
  for (const row of results) {
    const obj = await env.BLOBS.get(blobKey(c, row.content_hash));
    if (obj) await env.CACHE.put(blobKey(c, row.content_hash), await obj.arrayBuffer());
    await env.DB.prepare('UPDATE outbox SET applied_at = ? WHERE seq = ?').bind(now.toISOString(), row.seq).run();
  }
}

export interface ReadParams {
  name: string | null; version: string | null; since_version: string | null;
  max_age_s: string | null; allow_stale: string | null; consistency: string | null;
}

export async function getDoc(env: Env, c: Caller, p: ReadParams, now: Date): Promise<Outcome> {
  requireCap(c, 'context:read');
  const consistency = p.consistency ?? 'cached';
  const int = (v: string | null) => v === null ? null : /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  const version = int(p.version), since = int(p.since_version), maxAge = int(p.max_age_s);
  if (!p.name || ![version, since, maxAge].every(v => v === null || Number.isInteger(v))
    || !['cached', 'validated', 'strong'].includes(consistency) || ![null, 'true', 'false'].includes(p.allow_stale))
    throw new CoreError(400, 'invalid_input');
  // Authoritative D1 read of the pointer and the version row; never a KV pointer.
  const row = await env.DB.prepare(`SELECT v.*, r.current_version FROM resources r JOIN versions v
    ON v.tenant_id = r.tenant_id AND v.namespace_id = r.namespace_id AND v.kind = r.kind AND v.name = r.name
    WHERE r.tenant_id = ? AND r.namespace_id = ? AND r.kind = 'doc' AND r.name = ? AND v.version = COALESCE(?, r.current_version)`)
    .bind(c.tenantId, c.namespaceId, p.name, version).first<Record<string, any>>();
  if (!row || row.status !== 'active' || !visible(c, row.source_repo)) throw new CoreError(404, 'not_found');
  const validatedAt = new Date().toISOString();

  let cacheStatus = 'miss';
  const ageS = (now.getTime() - Date.parse(row.source_observed_at)) / 1000;
  if (maxAge !== null && ageS > maxAge) {
    if (p.allow_stale !== 'true') throw new CoreError(409, 'freshness_unmet',
      { source_observed_at: row.source_observed_at, reason: 'source_observation_older_than_max_age' });
    cacheStatus = 'stale';
  }
  const meta = (status: string, source: string) => ({
    content_hash: row.content_hash, version: row.version, cache_status: status,
    served_at: new Date().toISOString(), source_observed_at: row.source_observed_at,
    last_validated_at: validatedAt, computed_at: row.created_at, source,
  });
  const head = { name: row.name, kind: 'doc', current_version: row.current_version, change_note: row.change_note,
    created_at: row.created_at, provenance: { repo: row.source_repo, commit: row.source_commit, path: row.source_path } };
  if (since !== null && since === row.version)
    return { body: { ...head, unchanged: true, meta: meta(cacheStatus === 'stale' ? 'stale' : 'hit', 'd1') }, targetId: row.name, digest: row.content_hash };

  const key = blobKey(c, row.content_hash);
  let bytes: ArrayBuffer | null = null, source = 'r2';
  if (consistency !== 'strong') {
    bytes = await env.CACHE.get(key, 'arrayBuffer');
    if (bytes) { source = 'kv'; if (cacheStatus !== 'stale') cacheStatus = 'hit'; }
  } else if (cacheStatus !== 'stale') cacheStatus = 'bypass';
  if (!bytes) {
    const obj = await env.BLOBS.get(key);
    if (!obj) throw new CoreError(503, 'store_unavailable');
    bytes = await obj.arrayBuffer();
    if (consistency !== 'strong') await env.CACHE.put(key, bytes);
  }
  // Content addressing is verified on every serve, so a corrupt copy is never returned.
  if (!constantTimeEqual(await sha256Hex(new Uint8Array(bytes)), row.content_hash)) {
    if (source === 'kv') await env.CACHE.delete(key);
    throw new CoreError(503, 'integrity_failure');
  }
  return { body: { ...head, body: new TextDecoder().decode(bytes), meta: meta(cacheStatus, source) },
    targetId: row.name, size: bytes.byteLength, digest: row.content_hash };
}

async function cursorFor(env: Env, c: Caller, seq: number): Promise<string> {
  const payload = btoa(JSON.stringify([seq, c.tenantId, c.namespaceId, c.principalId, c.policyRevision, [...c.sourceRepos].sort()]))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${payload}.${(await hmacHex(env.TOKEN_HMAC_KEY!, `cursor:${payload}`)).slice(0, 32)}`;
}
async function cursorSeq(env: Env, c: Caller, cursor: string): Promise<number> {
  const [payload, mac] = cursor.split('.');
  if (!payload || !mac || !constantTimeEqual((await hmacHex(env.TOKEN_HMAC_KEY!, `cursor:${payload}`)).slice(0, 32), mac))
    throw new CoreError(400, 'invalid_cursor');
  const v = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  // Cursor scope binds tenant, namespace, principal, policy revision and filter.
  if (cursor !== await cursorFor(env, c, v[0])) throw new CoreError(400, 'invalid_cursor');
  return v[0];
}

export async function changes(env: Env, c: Caller, cursor: string | null, now: Date): Promise<Outcome> {
  requireCap(c, 'context:read');
  const from = cursor ? await cursorSeq(env, c, cursor) : null;
  const scope = [c.tenantId, c.namespaceId];
  if (from === null) {
    const headRow = await env.DB.prepare('SELECT COALESCE(MAX(seq), 0) AS s FROM change_events WHERE tenant_id = ? AND namespace_id = ?')
      .bind(...scope).first<{ s: number }>();
    const { results } = await env.DB.prepare(`SELECT r.name, r.current_version AS version, v.content_hash, v.source_repo FROM resources r
      JOIN versions v ON v.tenant_id = r.tenant_id AND v.namespace_id = r.namespace_id AND v.kind = r.kind
        AND v.name = r.name AND v.version = r.current_version
      WHERE r.tenant_id = ? AND r.namespace_id = ? AND v.status = 'active' ORDER BY r.name`).bind(...scope).all<any>();
    return { body: { bootstrap: true, resources: results.filter(r => visible(c, r.source_repo)).map(({ source_repo, ...r }) => r),
      next_cursor: await cursorFor(env, c, headRow!.s), meta: { served_at: now.toISOString(), source: 'd1', cache_status: 'bypass' } } };
  }
  const { results } = await env.DB.prepare(`SELECT seq, kind, name, version, change_kind, source_repo, created_at FROM change_events
    WHERE tenant_id = ? AND namespace_id = ? AND seq > ? ORDER BY seq LIMIT ?`).bind(...scope, from, FEED_PAGE).all<any>();
  const last = results.length ? results[results.length - 1].seq : from;
  const events = results.filter(e => visible(c, e.source_repo)).map(({ seq, source_repo, ...e }) => e);
  return { body: { events, unchanged: events.length === 0, has_more: results.length === FEED_PAGE,
    next_cursor: await cursorFor(env, c, last), meta: { served_at: now.toISOString(), source: 'd1', cache_status: 'bypass' } } };
}
