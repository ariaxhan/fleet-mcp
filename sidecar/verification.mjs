#!/usr/bin/env node
// Bounded scheduled suite, no caller-supplied commands or workspace paths.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, createPrivateKey, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, lstatSync, readlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, platform, arch, release } from 'node:os';
import { signRequest } from './sign.mjs';
const ROOT = realpathSync(join(dirname(new URL(import.meta.url).pathname), '..'));
const hash = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args]);
export function computationIdentity() {
  // Include every tracked and untracked non-ignored file, including dirty bytes.
  const paths = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(Boolean).sort();
  const files = paths.map(path => {
    try { const p = join(ROOT, path); return [path, lstatSync(p).isSymbolicLink() ? 'symlink:' + hash(readlinkSync(p)) : hash(readFileSync(p))]; }
    catch (e) { if (e.code === 'ENOENT') return [path, 'deleted']; throw e; }
  });
  const runtime = { node: process.version, compiler_hash: hash(readFileSync(join(ROOT, 'node_modules/typescript/lib/_tsc.js'))), typescript: JSON.parse(readFileSync(join(ROOT, 'node_modules/typescript/package.json'))).version };
  const environment = { platform: platform(), arch: arch(), release: release(), node: process.version,
    variables: Object.fromEntries(['LANG', 'LC_ALL', 'NODE_OPTIONS', 'TZ'].map(k => [k, hash(process.env[k] ?? '')])) };
  return { repo: 'ariaxhan/fleet-mcp', suite: 'fleet-mcp-typecheck', suite_version: '1', tree_hash: hash(JSON.stringify(files)),
    lockfile_hash: hash(readFileSync(join(ROOT, 'package-lock.json'))), runtime_hash: hash(JSON.stringify(runtime)), environment_hash: hash(JSON.stringify(environment)) };
}
export function runSuite(logDir) {
  const identity = computationIdentity(), observed = new Date().toISOString();
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: ROOT, timeout: 120000, encoding: 'utf8' });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  if (logDir) writeFileSync(join(logDir, 'latest-output.txt'), output);
  const after = computationIdentity();
  if (JSON.stringify(identity) !== JSON.stringify(after)) throw new Error('workspace_changed_during_suite');
  return { run_id: randomUUID(), identity, source_observed_at: observed, computed_at: new Date().toISOString(),
    passed: result.status === 0, exit_code: result.status ?? -1, output_hash: hash(output) };
}
/** Suite registry (PRD 2.6.5): the server sends only a name; argv lives here, versioned in git. */
export const SUITES = { 'fleet-mcp-typecheck': { repo: 'ariaxhan/fleet-mcp', run: runSuite } };
/** Runs a registered suite and preserves its receipt and outbox entry before any network action. */
export function runAndQueue(dir, suite = 'fleet-mcp-typecheck') {
  if (!SUITES[suite]) throw new Error('unknown_suite');
  mkdirSync(join(dir, 'verification-logs'), { recursive: true });
  const record = SUITES[suite].run(join(dir, 'verification-logs'));
  writeFileSync(join(dir, 'verification-logs', record.run_id + '.txt'), readFileSync(join(dir, 'verification-logs/latest-output.txt')));
  writeFileSync(join(dir, 'verification-logs', record.run_id + '.json'), JSON.stringify(record, null, 2));
  const outbox = join(dir, 'verification-outbox.json');
  const pending = existsSync(outbox) ? JSON.parse(readFileSync(outbox, 'utf8')) : [];
  pending.push(record); writeFileSync(outbox, JSON.stringify(pending));
  return record;
}
export async function pushPending(dir, origin, machineId, key, send = fetch) {
  const path = join(dir, 'verification-outbox.json');
  const pending = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  while (pending.length) {
    const body = JSON.stringify(pending[0]);
    const response = await send(origin + '/ingest/verification', { method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: signRequest(key, machineId, 'POST', '/ingest/verification', body) });
    if (!response.ok) throw new Error(`verification_push_failed:${response.status}`);
    pending.shift(); writeFileSync(path, JSON.stringify(pending));
  }
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url).pathname)) {
  const [cmd, env] = process.argv.slice(2);
  if (cmd !== 'run' || !['staging', 'production'].includes(env)) throw new Error('usage: verification.mjs run staging|production');
  const dir = join(homedir(), 'Library/Application Support/fleet-sidecar', env);
  const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
  const expected = `https://fleet-mcp${env === 'staging' ? '-staging' : ''}.ariaxhan.workers.dev`;
  const canonical = env === 'staging' ? 'https://staging-mcp.ariaxhan.com' : 'https://mcp.ariaxhan.com';
  if (![expected, canonical].includes(cfg.origin) || realpathSync(cfg.checkouts['ariaxhan/fleet-mcp']) !== ROOT) throw new Error('unregistered_checkout');
  const record = runAndQueue(dir);
  const key = createPrivateKey({ key: Buffer.from(execFileSync('security', ['find-generic-password', '-s', `fleet-sidecar-machine-key-${env}`, '-a', cfg.machine_id, '-w'], { encoding: 'utf8' }).trim(), 'base64'), format: 'der', type: 'pkcs8' });
  await pushPending(dir, cfg.origin, cfg.machine_id, key);
  console.log(JSON.stringify(record));
}
