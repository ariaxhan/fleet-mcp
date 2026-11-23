import type { Env } from './handler';
import type { Caller } from './auth';
import { sha256Hex } from './auth';
import { CoreError, type Outcome } from './core';
import { connectorState, type Machine } from './connector';
import { record } from './ops';

export const SUITE = 'fleet-mcp-typecheck';
const HASH = /^[a-f0-9]{64}$/;
function canonical(v: any): string {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}'
    : JSON.stringify(v);
}
export function validateIdentity(i: any) {
  if (!i || i.repo !== 'ariaxhan/fleet-mcp' || i.suite !== SUITE || i.suite_version !== '1'
    || !HASH.test(i.tree_hash) || !HASH.test(i.lockfile_hash) || !HASH.test(i.runtime_hash) || !HASH.test(i.environment_hash))
    throw new CoreError(400, 'incomplete_identity');
  if (Object.keys(i).sort().join(',') !== 'environment_hash,lockfile_hash,repo,runtime_hash,suite,suite_version,tree_hash')
    throw new CoreError(400, 'invalid_identity');
  return i;
}
export const identityHash = (i: any) => sha256Hex(canonical(validateIdentity(i)));

export async function ingestVerification(env: Env, m: Machine, raw: Uint8Array<ArrayBuffer>, now: Date): Promise<Outcome> {
  if (raw.length > 16384) throw new CoreError(413, 'payload_too_large'); // Design limit.
  let r: any;
  try { r = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new CoreError(400, 'invalid_input'); }
  const hash = await identityHash(r.identity);
  if (!/^[a-f0-9-]{36}$/.test(r.run_id ?? '') || typeof r.passed !== 'boolean'
    || !Number.isInteger(r.exit_code) || r.passed !== (r.exit_code === 0) || !HASH.test(r.output_hash ?? '')
    || !Number.isFinite(Date.parse(r.computed_at)) || !Number.isFinite(Date.parse(r.source_observed_at))
    || Date.parse(r.computed_at) > now.getTime() || Date.parse(r.source_observed_at) > Date.parse(r.computed_at))
    throw new CoreError(400, 'invalid_input');
  const old = await env.DB.prepare('SELECT identity_hash, machine_id, passed, evidence_json, computed_at, source_observed_at FROM verification_runs WHERE tenant_id=? AND namespace_id=? AND run_id=?')
    .bind(m.tenantId, m.namespaceId, r.run_id).first<any>();
  if (old) {
    if (old.identity_hash !== hash || old.machine_id !== m.machineId || old.passed !== Number(r.passed)
      || old.evidence_json !== JSON.stringify({ exit_code: r.exit_code, output_hash: r.output_hash })
      || old.computed_at !== r.computed_at || old.source_observed_at !== r.source_observed_at) throw new CoreError(409, 'run_id_conflict');
    return { body: { run_id: r.run_id, duplicate: true } };
  }
  await env.DB.prepare('INSERT INTO verification_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(m.tenantId, m.namespaceId, r.run_id, m.machineId, r.identity.repo, SUITE, hash, canonical(r.identity), Number(r.passed),
      JSON.stringify({ exit_code: r.exit_code, output_hash: r.output_hash }), r.computed_at, r.source_observed_at, now.toISOString()).run();
  return { body: { run_id: r.run_id, identity_hash: hash, accepted: true } };
}

export async function verificationCheck(env: Env, c: Caller, input: any, now: Date): Promise<Outcome> {
  if (!c.capabilities.includes('verify:read')) throw new CoreError(403, 'forbidden');
  const hash = await identityHash(input.identity);
  if (!c.sourceRepos.includes(input.identity.repo)) throw new CoreError(404, 'not_found');
  const maxAge = input.max_age_s ?? 180; // Design default.
  if (!Number.isFinite(maxAge) || maxAge < 0 || typeof (input.allow_stale ?? false) !== 'boolean'
    || typeof (input.force ?? false) !== 'boolean') throw new CoreError(400, 'invalid_input');
  if (input.force) return { body: { cache_status: 'miss', reason: 'sidecar_rerun_required', identity_hash: hash } };
  const r = await env.DB.prepare(`SELECT v.*, s.last_heartbeat_at FROM verification_runs v JOIN machines m ON m.machine_id=v.machine_id
    LEFT JOIN connector_status s ON s.machine_id=v.machine_id WHERE v.tenant_id=? AND v.namespace_id=? AND v.identity_hash=?
    AND m.revoked_at IS NULL ORDER BY v.computed_at DESC, v.received_at DESC LIMIT 1`)
    .bind(c.tenantId, c.namespaceId, hash).first<any>();
  const checker = `${SUITE}@${input.identity.suite_version}`;
  await record(env, 'verification_check', checker, r ? 1 : 0);
  if (!r) return { body: { cache_status: 'miss', reason: 'identity_not_observed', identity_hash: hash } };
  const state = connectorState(r.last_heartbeat_at, now);
  const stale = state !== 'fresh' || now.getTime() - Date.parse(r.source_observed_at) > maxAge * 1000;
  if (stale && !input.allow_stale) throw new CoreError(409, 'freshness_unmet', { source_observed_at: r.source_observed_at, connector_status: state, reason: state === 'fresh' ? 'observation_stale' : 'connector_offline' });
  return { body: { cache_status: stale ? 'stale' : 'hit', run_id: r.run_id, passed: !!r.passed,
    identity: JSON.parse(r.identity_json), identity_hash: hash, evidence: JSON.parse(r.evidence_json), connector_status: state,
    computed_at: r.computed_at, source_observed_at: r.source_observed_at, last_validated_at: r.source_observed_at, served_at: now.toISOString() } };
}
