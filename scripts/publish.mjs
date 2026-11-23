// Publishes real personal-project files at a committed SHA into the deployed core store.
// Usage: FLEET_PUBLISH_TOKEN=... node scripts/publish.mjs <origin> <repo-dir> <owner/repo> <path...>
import { execFileSync } from 'node:child_process';
const [origin, dir, repo, ...paths] = process.argv.slice(2);
const token = process.env.FLEET_PUBLISH_TOKEN;
if (!origin?.startsWith('https://') || !dir || !repo || !paths.length || !token) throw new Error('Usage: see header');
const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
const commit = git('rev-parse', 'HEAD').trim();
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
for (const path of paths) {
  const body = git('show', `${commit}:${path}`);
  const name = encodeURIComponent(`${repo}/${path}`);
  const cur = await fetch(`${origin}/v1/docs/get?name=${name}&consistency=strong`, { headers, redirect: 'error' });
  const base = cur.ok ? (await cur.json()).current_version : undefined;
  const r = await fetch(`${origin}/v1/docs/publish`, { method: 'POST', headers, redirect: 'error', body: JSON.stringify({
    body, change_note: `Publish ${path} at ${commit.slice(0, 12)}`, base_version: base,
    idempotency_key: `pub-${commit.slice(0, 12)}-${Buffer.from(path).toString('hex').slice(0, 64)}`,
    source: { repo, commit, path }, source_observed_at: new Date().toISOString() }) });
  console.log(r.status, path, JSON.stringify(await r.json()));
  if (!r.ok) process.exitCode = 1;
}
