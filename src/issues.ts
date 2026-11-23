import type { Env } from './handler';
import type { Caller } from './auth';
import { constantTimeEqual, hmacHex, sha256Hex, writeAudit } from './auth';
import { CoreError, PERSONAL_SOURCE_REPOS, type Outcome } from './core';

// Spike design decisions: freshness 60 seconds, bounded reconciliation 20 pages.
const REPO = 'ariaxhan/fleet-mcp';
export const connector: Caller = { tokenId: 'github-connector', principalId: 'github-connector',
  tenantId: 'personal', namespaceId: 'personal-docs', capabilities: ['issue:read'],
  sourceRepos: [REPO], policyRevision: 1 };
const scope = (c: Caller) => [c.tenantId, c.namespaceId];
function permitted(c: Caller, repo: string | null) {
  if (!c.capabilities.includes('issue:read')) throw new CoreError(403, 'forbidden');
  if (repo !== REPO || !PERSONAL_SOURCE_REPOS.includes(repo) || !c.sourceRepos.includes(repo))
    throw new CoreError(403, 'source_not_allowlisted');
  return repo;
}
async function github(env: Env, path: string): Promise<any> {
  // Call sites construct paths from the fixed repo and validated integers only.
  const headers: Record<string, string> = { accept: 'application/vnd.github+json',
    'user-agent': 'fleet-mcp-spike', 'x-github-api-version': '2022-11-28' };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new CoreError(r.status === 404 ? 404 : 503, r.status === 404 ? 'not_found' : 'github_unavailable');
  return r.json();
}
async function current(env: Env, c: Caller, repo: string, number: number): Promise<any> {
  return env.DB.prepare(`SELECT s.*, h.invalidated, h.source_observed_at AS validated_at FROM issue_heads h
    JOIN issue_snapshots s ON s.tenant_id=h.tenant_id AND s.namespace_id=h.namespace_id AND s.repo=h.repo
    AND s.number=h.number AND s.version=h.version WHERE h.tenant_id=? AND h.namespace_id=? AND h.repo=? AND h.number=?`)
    .bind(...scope(c), repo, number).first();
}
async function observe(env: Env, c: Caller, number: number): Promise<any> {
  const observed = new Date().toISOString();
  const issue = await github(env, `issues/${number}`);
  if (issue.number !== number || issue.repository_url !== `https://api.github.com/repos/${REPO}`)
    throw new CoreError(503, 'source_identity_mismatch');
  const count = Number(issue.comments), lastPage = Math.max(1, Math.ceil(count / 100));
  let comments: any[] = count ? await github(env, `issues/${number}/comments?per_page=100&page=${lastPage}`) : [];
  if (lastPage > 1 && comments.length < 8)
    comments = [...await github(env, `issues/${number}/comments?per_page=100&page=${lastPage - 1}`), ...comments];
  const body = JSON.stringify({ repo: REPO, number, title: issue.title, body: issue.body, state: issue.state,
    labels: issue.labels.map((x: any) => typeof x === 'string' ? x : x.name),
    assignees: issue.assignees.map((x: any) => x.login), github_updated_at: issue.updated_at,
    linked_prs: issue.pull_request ? [issue.pull_request.html_url] : [],
    linked_prs_coverage: 'issue_pull_request_field_only',
    comments: comments.slice(-8).map((x: any) => ({ id: x.id, body: x.body, author: x.user?.login,
      created_at: x.created_at, updated_at: x.updated_at })) });
  const hash = await sha256Hex(body), old = await current(env, c, REPO, number);
  if (old?.content_hash === hash) {
    await env.DB.prepare(`UPDATE issue_heads SET invalidated=0, source_observed_at=?
      WHERE tenant_id=? AND namespace_id=? AND repo=? AND number=? AND version=?`)
      .bind(observed, ...scope(c), REPO, number, old.version).run();
  } else {
    const version = (old?.version ?? 0) + 1, at = new Date().toISOString();
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO issue_snapshots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(...scope(c), REPO, number, version, hash, body, observed, at),
        env.DB.prepare(`INSERT INTO issue_heads VALUES (?, ?, ?, ?, ?, 0, ?)
          ON CONFLICT DO UPDATE SET version=excluded.version, invalidated=0, source_observed_at=excluded.source_observed_at`)
          .bind(...scope(c), REPO, number, version, observed),
        env.DB.prepare(`INSERT INTO change_events (tenant_id,namespace_id,kind,name,version,change_kind,source_repo,actor_principal_id,created_at)
          VALUES (?,?,'issue',?,?, ?,?,?,?)`).bind(...scope(c), `${REPO}/${number}`, version,
          old ? 'updated' : 'created', REPO, c.principalId, at),
      ]);
    } catch { throw new CoreError(409, 'version_conflict'); }
  }
  return current(env, c, REPO, number);
}
function freshness(p: URLSearchParams) {
  const raw = p.get('max_age_s') ?? '60', consistency = p.get('consistency') ?? 'cached';
  if (!/^\d{1,9}$/.test(raw) || !['cached','validated','strong'].includes(consistency)
    || ![null,'true','false'].includes(p.get('allow_stale'))) throw new CoreError(400, 'invalid_input');
  return { maxAge: Number(raw), force: consistency !== 'cached', stale: p.get('allow_stale') === 'true' };
}
const meta = (row: any, status: string) => ({ content_hash: row.content_hash, version: row.version,
  cache_status: status, served_at: new Date().toISOString(), source_observed_at: row.validated_at,
  last_validated_at: row.validated_at, computed_at: row.computed_at, source: 'github+d1' });
export async function issueGet(env: Env, c: Caller, p: URLSearchParams, now: Date): Promise<Outcome> {
  const repo = permitted(c, p.get('repo')), raw = p.get('number');
  if (!raw || !/^[1-9]\d{0,8}$/.test(raw) || ![null,'true','false'].includes(p.get('include_comments'))
    || (p.has('since_version') && !/^[1-9]\d{0,8}$/.test(p.get('since_version')!))) throw new CoreError(400, 'invalid_input');
  const number = Number(raw), f = freshness(p);
  let row = await current(env, c, repo, number), status = 'hit';
  const expired = !row || row.invalidated || now.getTime() - Date.parse(row.validated_at) > f.maxAge * 1000;
  if (expired || f.force) {
    try { row = await observe(env, c, number); status = 'bypass'; }
    catch (e) {
      console.error('issue_observation_failed',e instanceof Error ? e.message : 'unknown');
      if (!row || (e instanceof CoreError && e.status === 404)) throw e;
      if (!f.stale) throw new CoreError(409,'freshness_unmet',{source_observed_at:row.validated_at});
      status = 'stale';
    }
  }
  const body = JSON.parse(row.body);
  if(p.has('since_version') && p.get('since_version') !== String(row.version)) {
    const prior=await env.DB.prepare(`SELECT body FROM issue_snapshots WHERE tenant_id=? AND namespace_id=? AND repo=? AND number=? AND version=?`)
      .bind(...scope(c),repo,number,Number(p.get('since_version'))).first<any>();
    if(!prior) throw new CoreError(409,'version_unavailable');
    const old=JSON.parse(prior.body);
    const delta=Object.fromEntries(Object.entries(body).filter(([key,value])=>
      (key!=='comments'||p.get('include_comments')!=='false') && JSON.stringify(value)!==JSON.stringify(old[key])));
    return {body:{repo,number,from_version:Number(p.get('since_version')),version:row.version,delta,meta:meta(row,status)}};
  }
  if (p.get('include_comments') === 'false') delete body.comments;
  return { body: p.get('since_version') === String(row.version)
    ? { unchanged: true, meta: meta(row, status) }
    : { ...body, version: row.version, content_hash: row.content_hash, meta: meta(row, status) },
    targetId: `${repo}/${number}`, digest: row.content_hash };
}

export async function reconcile(env: Env, c: Caller, repo: string, full = false): Promise<any> {
  permitted(c, repo);
  const started = new Date().toISOString();
  const prior = await env.DB.prepare('SELECT * FROM issue_coverage WHERE tenant_id=? AND namespace_id=? AND repo=?')
    .bind(...scope(c), repo).first<any>();
  // Inclusive overlap protects same-second updates. Never advance on partial fetch.
  const since = !full && prior ? `&since=${encodeURIComponent(new Date(Date.parse(prior.covered_through) - 1000).toISOString())}` : '';
  for (let page = 1; page <= 20; page++) {
    const rows = await github(env, `issues?state=all&sort=updated&direction=asc&per_page=100&page=${page}${since}`);
    for (const issue of rows) await observe(env, c, issue.number);
    if (rows.length < 100) {
      await env.DB.prepare(`INSERT INTO issue_coverage VALUES (?, ?, ?, ?, ?)
        ON CONFLICT DO UPDATE SET covered_through=excluded.covered_through, reconciled_at=excluded.reconciled_at`)
        .bind(...scope(c), repo, started, new Date().toISOString()).run();
      return { covered_through: started, coverage: 'complete' };
    }
  }
  throw new CoreError(503, 'reconciliation_incomplete');
}
export async function issueList(env: Env, c: Caller, p: URLSearchParams, now: Date): Promise<Outcome> {
  const repo = permitted(c, p.get('repo')), state = p.get('state') ?? 'open', f = freshness(p);
  if (!['open','closed','all'].includes(state)) throw new CoreError(400, 'invalid_input');
  let coverage = await env.DB.prepare('SELECT * FROM issue_coverage WHERE tenant_id=? AND namespace_id=? AND repo=?')
    .bind(...scope(c), repo).first<any>();
  let status = 'hit';
  if (!coverage || f.force || now.getTime() - Date.parse(coverage.reconciled_at) > f.maxAge * 1000) {
    try { coverage = { ...await reconcile(env,c,repo,true), reconciled_at: new Date().toISOString() }; status = 'bypass'; }
    catch (e) { if (!coverage || !f.stale) throw e; status = 'stale'; }
  }
  const { results } = await env.DB.prepare(`SELECT s.*, h.invalidated, h.source_observed_at AS validated_at FROM issue_heads h
    JOIN issue_snapshots s ON s.tenant_id=h.tenant_id AND s.namespace_id=h.namespace_id AND s.repo=h.repo
    AND s.number=h.number AND s.version=h.version WHERE h.tenant_id=? AND h.namespace_id=? AND h.repo=? ORDER BY h.number`)
    .bind(...scope(c), repo).all<any>();
  if (results.some(r => r.invalidated)) {
    if (!f.stale) throw new CoreError(409,'freshness_unmet');
    status = 'stale';
  }
  const issues = results.map(r => ({ ...JSON.parse(r.body), version:r.version, content_hash:r.content_hash, meta:meta(r,status) }))
    .filter(r => state === 'all' || r.state === state);
  const hash = await sha256Hex(JSON.stringify(issues.map(r => [r.number,r.version])));
  return { body: { issues, covered_through: coverage.covered_through, coverage: status === 'stale' ? 'partial' : 'complete',
    meta: { content_hash:hash, version:hash, cache_status:status, source:'github+d1', served_at:new Date().toISOString(),
      source_observed_at:coverage.covered_through, last_validated_at:coverage.reconciled_at, computed_at:coverage.reconciled_at } } };
}
export async function githubWebhook(r: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_WEBHOOK_SECRET) return Response.json({error:'webhook_unavailable'},{status:501});
  const text = await r.text();
  if (new TextEncoder().encode(text).length > 1024 * 1024) return Response.json({error:'payload_too_large'},{status:413});
  if (!constantTimeEqual(r.headers.get('x-hub-signature-256') ?? '', `sha256=${await hmacHex(env.GITHUB_WEBHOOK_SECRET,text)}`))
    return Response.json({error:'invalid_signature'},{status:401});
  let data; try { data=JSON.parse(text); } catch { return Response.json({error:'invalid_input'},{status:400}); }
  if (data.repository?.full_name !== REPO || !['issues','issue_comment'].includes(r.headers.get('x-github-event') ?? ''))
    return Response.json({ignored:true});
  await writeAudit(env,{caller:connector,operation:'github_webhook',correlationId:crypto.randomUUID(),result:'started'},new Date());
  const number=data.issue?.number;
  if (!Number.isInteger(number) || number < 1) return Response.json({error:'invalid_input'},{status:400});
  // Commit invalidation before contacting GitHub. Failed deliveries remain visibly stale.
  await env.DB.batch([
    env.DB.prepare('UPDATE issue_heads SET invalidated=1 WHERE tenant_id=? AND namespace_id=? AND repo=? AND number=?')
      .bind(...scope(connector),REPO,number),
    env.DB.prepare("UPDATE issue_coverage SET reconciled_at='1970-01-01T00:00:00Z' WHERE tenant_id=? AND namespace_id=? AND repo=?")
      .bind(...scope(connector),REPO),
  ]);
  try { await observe(env,connector,number); return Response.json({accepted:true,number}); }
  catch { return Response.json({error:'github_unavailable',invalidated:true},{status:503}); }
}
