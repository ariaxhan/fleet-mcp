#!/usr/bin/env node
// fleet-sidecar spike (PRD 2.6, issue #12): outbound-only Studio connector.
// Pushes runner flight events, one credential probe (github) and working-tree file hashes,
// signed with an Ed25519 machine key held in the macOS keychain.
//   node sidecar/fleet-sidecar.mjs enroll <staging|production>   generate key, register machine (wrangler)
//   node sidecar/fleet-sidecar.mjs once <staging|production>     collect and push once
//   node sidecar/fleet-sidecar.mjs loop <staging|production> [interval_s]
import { execFileSync, execFile } from 'node:child_process';
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, sep, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const VERSION = '0.1.0-spike';
const HERE = dirname(new URL(import.meta.url).pathname);
const ORIGINS = { staging: 'https://fleet-mcp-staging.ariaxhan.workers.dev', production: 'https://fleet-mcp.ariaxhan.workers.dev' };
const RUNNER_DB = join(process.env.RUNNER_HOME ?? join(homedir(), 'Library/Application Support/runner'), 'runner.sqlite');
const LOOKBACK_S = 24 * 3600; // Design decision: event window per collection.
const EVENT_KINDS = ['done', 'failed', 'blocker', 'stalled', 'preempted', 'retired'];
const DENY = [/^\.env/, /^\.envrc$/, /^\.mcp\.json$/, /\.pem$/, /\.p12$/, /\.keychain/];
const EXCLUDED_DOMAIN = /thinking-brain-school|(^|[/_-])tbs([/_-]|$)/i;

export function loadAllowlist(text = readFileSync(join(HERE, 'allowlist.toml'), 'utf8')) {
  const block = /repos\s*=\s*\[([^\]]*)\]/.exec(text.replace(/#.*$/gm, ''));
  const repos = block ? [...block[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  if (!repos.length) throw new Error('allowlist empty');
  // Refuse to start rather than filter: an excluded-domain entry means the allowlist itself is wrong.
  const bad = repos.find(r => EXCLUDED_DOMAIN.test(r) || !/^ariaxhan\/[\w.-]+$/.test(r));
  if (bad) throw new Error('allowlist contains a non-authorized entry; refusing to start');
  return repos;
}

/** Repo-relative path to an absolute path under root, or a fixed refusal reason. */
export function resolveUnderRoot(root, rel) {
  if (typeof rel !== 'string' || !rel || rel.startsWith('/') || rel.split('/').includes('..')) return { refused: 'path_outside_root' };
  const base = realpathSync(root);
  let real;
  try { real = realpathSync(join(base, rel)); } catch { return { refused: 'not_found' }; }
  if (!real.startsWith(base + sep)) return { refused: 'path_outside_root' };
  const parts = real.slice(base.length + 1).split(sep);
  if (parts.includes('.git')) return { refused: 'inside_git_dir' };
  if (DENY.some(d => d.test(parts[parts.length - 1]))) return { refused: 'deny_list' };
  if (!statSync(real).isFile()) return { refused: 'not_regular_file' };
  return { path: real };
}

const stateDir = env => join(homedir(), 'Library/Application Support/fleet-sidecar', env);
const keychainService = env => `fleet-sidecar-machine-key-${env}`;
const readJson = (p, d) => existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d;

/** Runner attempts for allowlisted repos only; other rows are counted in SQL and never read. */
export function collectFleetEvents(dbPath, repos, nowS) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const marks = repos.map(() => '?').join(',');
    const since = nowS - LOOKBACK_S;
    const rows = db.prepare(`SELECT a.id, t.ref, t.repo, a.started, a.ended, a.outcome FROM attempts a JOIN tasks t ON t.id = a.task_id
      WHERE t.repo IN (${marks}) AND (a.started >= ? OR a.ended >= ? OR a.ended IS NULL) ORDER BY a.id LIMIT 500`).all(...repos, since, since);
    const dropped = db.prepare(`SELECT COUNT(*) AS n FROM attempts a JOIN tasks t ON t.id = a.task_id
      WHERE t.repo NOT IN (${marks}) AND (a.started >= ? OR a.ended >= ?)`).get(...repos, since, since).n;
    const events = [];
    for (const r of rows) {
      const base = { type: 'fleet_event', task_id: r.ref, repo: r.repo, attempt_id: String(r.id) };
      events.push({ ...base, event_key: `attempt:${r.id}:started`, event_kind: 'started', observed_at: new Date(r.started * 1000).toISOString() });
      if (r.ended) {
        const kind = EVENT_KINDS.includes(r.outcome) ? r.outcome : 'ended';
        events.push({ ...base, event_key: `attempt:${r.id}:${kind}`, event_kind: kind, observed_at: new Date(r.ended * 1000).toISOString() });
      }
    }
    return { events, dropped };
  } finally { db.close(); }
}

/** Credential probe: emits only a fixed status and reason code, never CLI output. */
export function probeGithub() {
  return new Promise(resolve => {
    execFile('gh', ['auth', 'status', '--hostname', 'github.com'], { timeout: 10_000, env: { PATH: process.env.PATH, HOME: homedir() } }, err => {
      const observed_at = new Date().toISOString();
      if (!err) return resolve({ status: 'live', reason_code: 'ok', observed_at });
      if (err.code === 'ENOENT') return resolve({ status: 'missing', reason_code: 'cli_missing', observed_at });
      if (err.killed) return resolve({ status: 'unknown', reason_code: 'timeout', observed_at });
      resolve({ status: 'expired', reason_code: 'not_authenticated', observed_at });
    });
  });
}

export function hashFile(root, repo, rel, repos) {
  if (!repos.includes(repo)) return { refused: 'repo_not_allowlisted' };
  const r = resolveUnderRoot(root, rel);
  if (r.refused) return r;
  const bytes = readFileSync(r.path);
  return { type: 'file_hash', repo, path: rel, content_hash: createHash('sha256').update(bytes).digest('hex'), size: bytes.length,
    head_commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), observed_at: new Date().toISOString() };
}

export function signRequest(privateKey, machineId, method, path, body) {
  const ts = String(Date.now()), nonce = randomBytes(18).toString('base64url');
  const msg = `${method}\n${path}\n${createHash('sha256').update(body).digest('hex')}\n${ts}\n${nonce}`;
  return { 'x-fleet-machine': machineId, 'x-fleet-timestamp': ts, 'x-fleet-nonce': nonce,
    'x-fleet-signature': sign(null, Buffer.from(msg), privateKey).toString('base64url'), 'content-type': 'application/json' };
}

async function once(env) {
  const repos = loadAllowlist();
  const dir = stateDir(env), cfg = readJson(join(dir, 'config.json'), null);
  if (!cfg) throw new Error(`not enrolled: run enroll ${env}`);
  const state = readJson(join(dir, 'state.json'), { seq: 0, keys: {}, outbox: [] });
  const assign = rec => {
    const key = rec.event_key ?? `${rec.type}:${rec.probe ?? `${rec.repo}/${rec.path}`}:${rec.observed_at}`;
    if (rec.event_key && state.keys[key]) return null; // Already delivered and acknowledged.
    return { ...rec, seq: ++state.seq };
  };
  const { events, dropped } = collectFleetEvents(RUNNER_DB, repos, Date.now() / 1000);
  const fresh = [...events.map(assign).filter(Boolean)];
  fresh.push(assign({ type: 'probe', probe: 'github', ...(await probeGithub()) }));
  for (const f of cfg.hash_files ?? []) {
    const root = cfg.checkouts?.[f.repo];
    const r = root ? hashFile(root, f.repo, f.path, repos) : { refused: 'checkout_not_registered' };
    if (r.refused) console.error(`refused ${f.repo}:${f.path} ${r.refused}`); else fresh.push(assign(r));
  }
  // On-disk outbox: unacked records replay in seq order after a restart or outage.
  state.outbox = [...state.outbox, ...fresh].sort((a, b) => a.seq - b.seq);
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
  const key = createPrivateKey({ key: Buffer.from(execFileSync('security', ['find-generic-password', '-s', keychainService(env), '-a', cfg.machine_id, '-w'],
    { encoding: 'utf8' }).trim(), 'base64'), format: 'der', type: 'pkcs8' });
  // At least one push per run so the heartbeat always lands, even with nothing new.
  do {
    const batch = state.outbox.slice(0, 200);
    const body = JSON.stringify({ sidecar_version: VERSION, records: batch,
      heartbeat: { last_seq: state.seq, outbox_depth: state.outbox.length - batch.length, dropped_for_boundary: dropped } });
    const r = await fetch(`${cfg.origin}/ingest/fleet`, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: signRequest(key, cfg.machine_id, 'POST', '/ingest/fleet', body) });
    const out = await r.json();
    if (!r.ok) { console.error(`push failed ${r.status} ${out.error}; ${state.outbox.length} records stay in outbox`); process.exitCode = 1; return; }
    for (const rec of batch) if (rec.event_key) state.keys[rec.event_key] = rec.seq;
    state.outbox = state.outbox.slice(batch.length);
    writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
    console.log(JSON.stringify({ pushed: batch.length, ...out }));
  } while (state.outbox.length);
}

function enroll(env) {
  const dir = stateDir(env);
  if (existsSync(join(dir, 'config.json'))) throw new Error('already enrolled; re-enrollment must revoke the old machine_id first');
  const machineId = `m_${randomBytes(16).toString('hex')}`;
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64url');
  const secret = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  // Private half goes straight to the keychain (stdin, never argv) and never leaves the Studio.
  execFileSync('security', ['add-generic-password', '-U', '-s', keychainService(env), '-a', machineId, '-w'],
    { input: `${secret}\n${secret}\n`, stdio: ['pipe', 'ignore', 'ignore'] }); // security prompts twice (enter, retype).
  if (execFileSync('security', ['find-generic-password', '-s', keychainService(env), '-a', machineId, '-w'], { encoding: 'utf8' }).trim() !== secret)
    throw new Error('keychain did not store the machine key; nothing registered');
  execFileSync(join(HERE, '../node_modules/.bin/wrangler'), ['d1', 'execute', `fleet-mcp-${env}`, '--env', env, '--remote', '--command',
    `INSERT INTO machines VALUES ('${machineId}', '${raw}', 'personal', 'personal-docs', '${new Date().toISOString()}', NULL)`],
  { cwd: join(HERE, '..'), stdio: ['ignore', 'ignore', 'inherit'] });
  mkdirSync(dir, { recursive: true });
  const repoRoot = join(HERE, '..');
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ machine_id: machineId, origin: ORIGINS[env],
    checkouts: { 'ariaxhan/fleet-mcp': realpathSync(repoRoot) },
    hash_files: ['AGENTS.md', 'PRD.md', 'docs/deploy.md'].map(path => ({ repo: 'ariaxhan/fleet-mcp', path })) }, null, 2));
  console.log(`enrolled ${machineId} for ${env}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url).pathname)) {
  const [cmd, env, interval = '60'] = process.argv.slice(2);
  if (!ORIGINS[env]) throw new Error('usage: fleet-sidecar.mjs enroll|once|loop staging|production [interval_s]');
  if (cmd === 'enroll') enroll(env);
  else if (cmd === 'once') await once(env);
  else if (cmd === 'loop') for (;;) { await once(env).catch(e => console.error(e.message)); await new Promise(r => setTimeout(r, Number(interval) * 1000)); }
  else throw new Error('unknown command');
}
