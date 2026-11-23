import type { Env } from './handler';

export interface Caller {
  tokenId: string; principalId: string; tenantId: string; namespaceId: string;
  capabilities: string[]; sourceRepos: string[]; policyRevision: number;
}

const enc = new TextEncoder();
export const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async (data: string | Uint8Array<ArrayBuffer>) =>
  hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));

export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const TOKEN = /^fmt_([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/;

export class PolicyUnavailable extends Error {}

/** Resolves the principal from the bearer token; null means a generic authentication failure. */
export async function authenticate(request: Request, env: Env, now: Date): Promise<Caller | null> {
  const match = TOKEN.exec((request.headers.get('authorization') ?? '').replace(/^Bearer /, ''));
  if (!env.TOKEN_HMAC_KEY) throw new PolicyUnavailable();
  const token = match?.[0] ?? 'fmt_invalid';
  const expected = await hmacHex(env.TOKEN_HMAC_KEY, token);
  let row: Record<string, unknown> | null;
  try {
    row = match ? await env.DB.prepare(`SELECT t.*, n.policy_revision FROM tokens t
      JOIN namespaces n ON n.tenant_id = t.tenant_id AND n.namespace_id = t.namespace_id
      WHERE t.token_id = ?`).bind(match[1]).first() : null;
  } catch { throw new PolicyUnavailable(); }
  // Compare even for unknown IDs so both failures do the same work.
  const ok = constantTimeEqual(String(row?.verifier ?? ''), expected) && row !== null
    && row.key_version === 1 && row.revoked_at === null && Date.parse(String(row.expires_at)) > now.getTime();
  if (!ok || !row) return null;
  return {
    tokenId: String(row.token_id), principalId: String(row.principal_id), tenantId: String(row.tenant_id),
    namespaceId: String(row.namespace_id), capabilities: JSON.parse(String(row.capabilities)),
    sourceRepos: JSON.parse(String(row.source_repos)), policyRevision: Number(row.policy_revision),
  };
}

export interface AuditEntry {
  caller?: Caller | null; operation: string; correlationId: string; result: string;
  targetId?: string | null; latencyMs?: number; size?: number | null; contentDigest?: string | null;
}

/** Typed field allowlist only: identifiers, enums, sizes, digests. Never bodies or headers. */
export async function writeAudit(env: Env, e: AuditEntry, now: Date): Promise<void> {
  await env.DB.prepare(`INSERT INTO audit (tenant_id, namespace_id, principal_id, token_id, operation, target_id,
    policy_revision, correlation_id, result, latency_ms, size, content_digest, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    e.caller?.tenantId ?? null, e.caller?.namespaceId ?? null, e.caller?.principalId ?? null,
    e.caller?.tokenId ?? null, e.operation, e.targetId ?? null, e.caller?.policyRevision ?? null,
    e.correlationId, e.result, e.latencyMs ?? null, e.size ?? null, e.contentDigest ?? null, now.toISOString(),
  ).run();
}
