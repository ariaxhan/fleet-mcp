import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from './harness';
import { ingestVerification, verificationCheck, identityHash } from '../src/verification';
import type { Caller } from '../src/auth';
// @ts-ignore plain ESM module
import { pushPending } from '../sidecar/verification.mjs';
const machine = { machineId: 'm_' + 'a'.repeat(32), tenantId: 'personal', namespaceId: 'personal-docs' };
const caller: Caller = { tokenId: 'x', principalId: 'x', tenantId: 'personal', namespaceId: 'personal-docs', capabilities: ['verify:read'], sourceRepos: ['ariaxhan/fleet-mcp'], policyRevision: 1 };
const identity = { repo: 'ariaxhan/fleet-mcp', suite: 'fleet-mcp-typecheck', suite_version: '1', tree_hash: 'a'.repeat(64), lockfile_hash: 'b'.repeat(64), runtime_hash: 'c'.repeat(64), environment_hash: 'd'.repeat(64) };
test('workspace identity, forced append-only reruns, source freshness and recovery', async () => {
  const { db, env } = await setup();
  const now = new Date();
  db.prepare("INSERT INTO machines VALUES (?, 'key', 'personal', 'personal-docs', 'now', NULL)").run(machine.machineId);
  db.prepare("INSERT INTO connector_status (machine_id, sidecar_version, last_seq, outbox_depth, dropped_for_boundary, last_heartbeat_at) VALUES (?, 'spike', 0, 0, 0, ?)").run(machine.machineId, now.toISOString());
  const record = () => ({ identity, run_id: randomUUID(), passed: true, exit_code: 0, output_hash: 'e'.repeat(64), computed_at: now.toISOString(), source_observed_at: now.toISOString() });
  const first = record();
  const push = (r: any) => ingestVerification(env, machine, new TextEncoder().encode(JSON.stringify(r)), now);
  await push(first);
  assert.equal((await verificationCheck(env, caller, { identity }, now)).body.cache_status, 'hit');
  for (const component of ['tree_hash', 'lockfile_hash', 'runtime_hash', 'environment_hash']) {
    assert.equal((await verificationCheck(env, caller, { identity: { ...identity, [component]: 'f'.repeat(64) } }, now)).body.cache_status, 'miss');
  }
  assert.throws(() => identityHash({ ...identity, lockfile_hash: undefined }), /incomplete_identity/);
  assert.equal((await verificationCheck(env, caller, { identity, force: true }, now)).body.cache_status, 'miss');
  const second = record(); await push(second); await push(second);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM verification_runs').get() as any).n, 2);
  const later = new Date(now.getTime() + 901000); // Fault injection: logical clock, no production timestamp mutation.
  await assert.rejects(verificationCheck(env, caller, { identity }, later), /freshness_unmet/);
  assert.equal((await verificationCheck(env, caller, { identity, allow_stale: true }, later)).body.cache_status, 'stale');
  db.prepare('UPDATE connector_status SET last_heartbeat_at=?').run(later.toISOString());
  await assert.rejects(verificationCheck(env, caller, { identity }, later), /freshness_unmet/, 'heartbeat alone cannot refresh old green');
  const fresh = { ...record(), computed_at: later.toISOString(), source_observed_at: later.toISOString() };
  await ingestVerification(env, machine, new TextEncoder().encode(JSON.stringify(fresh)), later);
  assert.equal((await verificationCheck(env, caller, { identity }, later)).body.run_id, fresh.run_id);
});
test('sidecar spool survives offline delivery and drains on recovery', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'verification-outbox-'));
  const path = join(dir, 'verification-outbox.json');
  const records = [{ run_id: randomUUID() }, { run_id: randomUUID() }];
  writeFileSync(path, JSON.stringify(records));
  const key = generateKeyPairSync('ed25519').privateKey;
  await assert.rejects(pushPending(dir, 'https://fixture', machine.machineId, key, async () => { throw new Error('offline'); }), /offline/);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), records);
  const received: any[] = [];
  await pushPending(dir, 'https://fixture', machine.machineId, key, async (_: any, init: any) => { received.push(JSON.parse(init.body)); return new Response('{}'); });
  assert.deepEqual(received, records);
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), []);
});
