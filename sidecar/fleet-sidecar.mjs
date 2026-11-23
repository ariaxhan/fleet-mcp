#!/usr/bin/env node
// fleet-sidecar (PRD 2.6, issues #12, #18): outbound-only Studio connector.
// Pushes runner flight events, credential liveness attestations, checkout state, file hashes and
// checkpoint hashes; reconciles delivered events; executes typed jobs pulled from /connector/work
// (probe, checkout_state, file_upload, suite_run, lesson_writeback). Signed with an Ed25519 machine
// key held in the macOS keychain. Credentials never leave the machine: only fixed status enums do.
//   node sidecar/fleet-sidecar.mjs enroll <staging|production>   generate key, register machine (wrangler)
//   node sidecar/fleet-sidecar.mjs once <staging|production>     collect and push once
//   node sidecar/fleet-sidecar.mjs loop <staging|production> [interval_s]
import { execFileSync, execFile } from 'node:child_process';
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, sep, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { signRequest } from './sign.mjs';
export { signRequest };

export const VERSION = '0.2.0';
const HERE = dirname(new URL(import.meta.url).pathname);
const ORIGINS = { staging: 'https://staging-mcp.ariaxhan.com', production: 'https://mcp.ariaxhan.com' };
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

const att = (status, reason_code) => ({ status, reason_code, observed_at: new Date().toISOString() });
/** CLI probe: exit status only. Output is discarded unread, never forwarded. */
function cliProbe(cmd, args, timeout = 15_000) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout, env: { PATH: process.env.PATH, HOME: homedir() } }, err => {
      if (!err) return resolve(att('live', 'ok'));
      if (err.code === 'ENOENT') return resolve(att('missing', 'cli_missing'));
      if (err.killed) return resolve(att('unknown', 'timeout'));
      resolve(att('expired', 'not_authenticated'));
    });
  });
}
/** Classifies an OAuth credential blob locally; the blob itself stays in this function. */
export function classifyOAuth(blob, nowMs = Date.now()) {
  let j; try { j = JSON.parse(blob); } catch { return att('unknown', 'unparseable'); }
  const o = j?.claudeAiOauth ?? j?.tokens ?? j;
  if (!o || typeof o !== 'object') return att('unknown', 'unparseable');
  if (o.refresh_token || o.refreshToken) return att('live', 'ok'); // Refreshable without a human.
  const exp = Number(o.expiresAt ?? o.expires_at);
  if (exp) return exp > nowMs ? att('live', 'ok') : att('expired', 'credential_expired');
  return o.access_token || o.accessToken ? att('unknown', 'unparseable') : att('missing', 'credential_missing');
}
export const PROBES = {
  github: () => cliProbe('gh', ['auth', 'status', '--hostname', 'github.com']),
  wrangler: () => cliProbe(join(HERE, '../node_modules/.bin/wrangler'), ['whoami'], 30_000),
  'codex-oauth': async () => {
    const p = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'auth.json');
    return existsSync(p) ? classifyOAuth(readFileSync(p, 'utf8')) : att('missing', 'credential_missing');
  },
  'claude-oauth': async () => {
    try { return classifyOAuth(execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 })); }
    catch (e) { return e.status === 44 ? att('missing', 'credential_missing') : att('unknown', 'error'); }
  },
};
export const probeGithub = PROBES.github;

/** Checkout state: HEAD, branch, dirty flag and a tree hash that includes uncommitted bytes. */
export function checkoutState(root, repo, repos, checkoutId) {
  if (!repos.includes(repo)) return { refused: 'repo_not_allowlisted' };
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const status = git('status', '--porcelain=v1', '-z').toString();
  const paths = git('ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(Boolean).sort();
  const h = createHash('sha256');
  for (const p of paths) {
    const r = resolveUnderRoot(root, p);
    h.update(p + '\0' + (r.path ? createHash('sha256').update(readFileSync(r.path)).digest('hex') : r.refused) + '\0');
  }
  return { type: 'checkout_state', repo, checkout_id: checkoutId, head_commit: git('rev-parse', 'HEAD').toString().trim(),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD').toString().trim(), dirty: status.length > 0, tree_hash: h.digest('hex'),
    observed_at: new Date().toISOString() };
}

/** Checkpoint mirror hashes: one record per regular file directly under the configured directory. */
export function checkpointHashes(root, repo, rel, repos) {
  if (!repos.includes(repo)) return [];
  const base = join(realpathSync(root), rel);
  if (!existsSync(base)) return [];
  return readdirSync(base).filter(f => /^[\w.-]{1,128}$/.test(f)).flatMap(f => {
    const r = resolveUnderRoot(root, `${rel}/${f}`);
    if (!r.path) return [];
    return [{ type: 'checkpoint_hash', repo, checkpoint_id: f.replace(/\.[^.]+$/, ''), local_hash: createHash('sha256').update(readFileSync(r.path)).digest('hex'),
      observed_at: new Date().toISOString() }];
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


const loadKey = (env, cfg) => createPrivateKey({ key: Buffer.from(execFileSync('security', ['find-generic-password', '-s', keychainService(env), '-a', cfg.machine_id, '-w'],
  { encoding: 'utf8' }).trim(), 'base64'), format: 'der', type: 'pkcs8' });

/** One signed request; GET carries an empty signed body. */
export async function signedFetch(cfg, key, method, path, payload, send = fetch) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  const r = await send(`${cfg.origin}${path}`, { method, body: method === 'GET' ? undefined : body, redirect: 'error',
    signal: AbortSignal.timeout(60_000), headers: signRequest(key, cfg.machine_id, method, path, body) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${out.error ?? ''}`);
  return out;
}

const MAX_UPLOAD = 1024 * 1024;
/** Executes one typed job. Unknown kinds and suites are refused, never interpreted. */
export async function runJob(job, ctx) {
  const { cfg, repos, record, dir } = ctx, p = job.params ?? {}, now = () => new Date().toISOString();
  const done = extra => ({ job_id: job.job_id, status: 'done', reason_code: 'ok', observed_at: now(), ...extra });
  const refuse = (reason, status = 'refused') => ({ job_id: job.job_id, status, reason_code: reason });
  const root = p.repo ? cfg.checkouts?.[p.repo] : null;
  if (p.repo && !repos.includes(p.repo)) return refuse('repo_not_allowlisted');
  switch (job.kind) {
    case 'probe': {
      if (!PROBES[p.probe]) return refuse('unsupported_kind', 'unsupported');
      const a = await PROBES[p.probe](); record({ type: 'probe', probe: p.probe, ...a });
      return done({ probe_reason: a.reason_code });
    }
    case 'checkout_state': {
      if (!root) return refuse('checkout_not_registered');
      record(checkoutState(root, p.repo, repos, checkoutIdOf(p.repo))); return done({});
    }
    case 'file_upload': {
      if (!root) return refuse('checkout_not_registered');
      const r = resolveUnderRoot(root, p.path);
      if (r.refused) return refuse(r.refused);
      if (statSync(r.path).size > MAX_UPLOAD) return refuse('too_large', 'failed');
      const bytes = readFileSync(r.path);
      return done({ bytes_base64: bytes.toString('base64'), content_hash: createHash('sha256').update(bytes).digest('hex'), size: bytes.length,
        head_commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() });
    }
    case 'suite_run': {
      const { SUITES, runAndQueue } = await import('./verification.mjs');
      if (!SUITES[p.suite] || SUITES[p.suite].repo !== p.repo) return refuse('unknown_suite', 'unsupported');
      try { const rec = runAndQueue(dir, p.suite); await ctx.pushVerification(); return done({ run_id: rec.run_id, passed: rec.passed }); }
      catch (e) { return refuse(e.message === 'workspace_changed_during_suite' ? e.message : 'error', 'failed'); }
    }
    case 'lesson_writeback': {
      // Write to the owning agent.db through its own CLI, in the owning checkout. Idempotent locally on job_id.
      const owner = cfg.checkouts?.['ariaxhan/fleet-mcp'];
      if (!owner || p.source_db !== 'ariaxhan/fleet-mcp/_meta/agentdb/agent.db') return refuse('checkout_not_registered');
      if (!ctx.state.written?.[job.job_id]) {
        try { execFileSync('agentdb', ['learn', p.kind, p.what, p.why], { cwd: owner, stdio: 'ignore', timeout: 30_000 }); }
        catch { return refuse('write_failed', 'failed'); }
        ctx.state.written = { ...ctx.state.written, [job.job_id]: now() }; ctx.save();
      }
      return done({});
    }
  }
  return refuse('unsupported_kind', 'unsupported');
}
const checkoutIdOf = repo => repo.split('/')[1];

async function once(env) {
  const repos = loadAllowlist();
  const dir = stateDir(env), cfg = readJson(join(dir, 'config.json'), null);
  if (!cfg) throw new Error(`not enrolled: run enroll ${env}`);
  const state = readJson(join(dir, 'state.json'), { seq: 0, keys: {}, outbox: [] });
  state.observations ??= {};
  const save = () => writeFileSync(join(dir, 'state.json'), JSON.stringify(state));
  const key = loadKey(env, cfg);
  const send = (m, path, payload) => signedFetch(cfg, key, m, path, payload);

  // Sync reconciliation: delivered keys the server lacks are forgotten locally and re-collected below.
  const delivered = Object.keys(state.keys).slice(-2000);
  if (delivered.length) {
    try {
      const { missing } = await send('POST', '/connector/reconcile', { event_keys: delivered });
      for (const k of missing) delete state.keys[k];
      if (missing.length) console.error(`reconcile: ${missing.length} delivered events missing on server; re-queued`);
    } catch (e) { console.error(`reconcile failed: ${e.message}`); }
  }
  const fresh = [];
  const record = rec => {
    if (!rec || rec.refused) { if (rec?.refused) console.error(`refused ${rec.refused}`); return; }
    const k = rec.event_key;
    if (k && (state.keys[k] || state.outbox.some(o => o.event_key === k))) return; // Delivered or already queued.
    fresh.push({ ...rec, seq: ++state.seq });
  };
  const { events, dropped } = collectFleetEvents(RUNNER_DB, repos, Date.now() / 1000);
  events.forEach(record);
  for (const name of Object.keys(PROBES)) record({ type: 'probe', probe: name, ...(await PROBES[name]()) });
  for (const [repo, root] of Object.entries(cfg.checkouts ?? {})) {
    if (!repos.includes(repo)) { console.error(`refused ${repo} repo_not_allowlisted`); continue; }
    record(checkoutState(root, repo, repos, checkoutIdOf(repo)));
  }
  for (const f of cfg.hash_files ?? []) {
    const root = cfg.checkouts?.[f.repo];
    record(root ? hashFile(root, f.repo, f.path, repos) : { refused: 'checkout_not_registered' });
  }
  for (const c of cfg.checkpoint_dirs ?? []) {
    const root = cfg.checkouts?.[c.repo];
    if (root) checkpointHashes(root, c.repo, c.path, repos).forEach(record);
  }

  // Jobs: lease (the ack), execute, report. Bounded per run; records they produce ride the same push.
  const results = [];
  const ctx = { cfg, repos, dir, state, save, record,
    pushVerification: async () => (await import('./verification.mjs')).pushPending(dir, cfg.origin, cfg.machine_id, key) };
  for (let i = 0; i < 10; i++) {
    let job;
    try { ({ job } = await send('GET', '/connector/work')); } catch (e) { console.error(`work poll failed: ${e.message}`); break; }
    if (!job) break;
    results.push(await runJob(job, ctx).catch(() => ({ job_id: job.job_id, status: 'failed', reason_code: 'error' })));
  }

  // On-disk outbox: unacked records replay in seq order after a restart or outage.
  state.outbox = [...state.outbox, ...fresh].sort((a, b) => a.seq - b.seq);
  save();
  // At least one push per run so the heartbeat always lands, even with nothing new.
  do {
    const batch = state.outbox.slice(0, 200);
    for (const r of batch) state.observations[r.type] = r.observed_at > (state.observations[r.type] ?? '') ? r.observed_at : state.observations[r.type];
    let out;
    try {
      out = await send('POST', '/ingest/fleet', { sidecar_version: VERSION, records: batch,
        heartbeat: { last_seq: state.seq, outbox_depth: state.outbox.length - batch.length, dropped_for_boundary: dropped, observations: state.observations } });
    } catch (e) { console.error(`push failed ${e.message}; ${state.outbox.length} records stay in outbox`); process.exitCode = 1; return; }
    for (const rec of batch) if (rec.event_key) state.keys[rec.event_key] = rec.seq;
    state.outbox = state.outbox.slice(batch.length);
    save();
    console.log(JSON.stringify({ pushed: batch.length, ...out }));
  } while (state.outbox.length);
  // Job results after the records they reference; a lost result is re-leased and stays idempotent.
  for (const r of results) {
    try { console.log(JSON.stringify(await send('POST', '/connector/result', r))); } catch (e) { console.error(`result failed ${e.message}`); process.exitCode = 1; }
  }
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
