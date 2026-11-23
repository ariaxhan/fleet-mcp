import type { Env } from './handler';
import type { Caller } from './auth';
import { sha256Hex } from './auth';
import { CoreError, type Outcome } from './core';

export const SOURCE_DB = 'ariaxhan/fleet-mcp/_meta/agentdb/agent.db';
const REPO = 'ariaxhan/fleet-mcp';
const KINDS = ['failure','gotcha','pattern','preference'];
const scope = (c: Caller) => [c.tenantId,c.namespaceId];
function permit(c: Caller, cap: string) {
  if (!c.capabilities.includes(cap) || !c.sourceRepos.includes(REPO)) throw new CoreError(403,'forbidden');
}
async function collection(env: Env,c: Caller,p: URLSearchParams,now: Date) {
  const row=await env.DB.prepare('SELECT * FROM recall_collections WHERE tenant_id=? AND namespace_id=? AND source_db=?')
    .bind(...scope(c),SOURCE_DB).first<any>();
  if (!row) throw new CoreError(503,'store_not_synced');
  const age=p.get('max_age_s') ?? '300'; // Spike freshness default, design decision.
  if (!/^\d{1,9}$/.test(age) || ![null,'true','false'].includes(p.get('allow_stale')))
    throw new CoreError(400,'invalid_input');
  const stale=now.getTime()-Date.parse(row.observed_at)>Number(age)*1000;
  if (stale && p.get('allow_stale')!=='true') throw new CoreError(409,'freshness_unmet',{source_observed_at:row.observed_at});
  return {row,stale};
}
function metadata(row:any,stale:boolean,now:Date) {
  return {content_hash:row.content_hash,version:row.generation,cache_status:stale?'stale':'bypass',source:'studio-agentdb+d1',
    served_at:now.toISOString(),source_observed_at:row.observed_at,last_validated_at:row.observed_at,computed_at:row.observed_at};
}
export async function recallQuery(env:Env,c:Caller,p:URLSearchParams,now:Date):Promise<Outcome> {
  const start=performance.now();
  permit(c,'recall:read');
  const query=(p.get('query')??'').normalize('NFKC').trim().toLowerCase(), limit=Number(p.get('limit')??'8');
  const kinds=p.get('kinds')?.split(',')??KINDS;
  if (!query || query.length>500 || !Number.isInteger(limit)||limit<1||limit>100 || !kinds.length||kinds.some(k=>!KINDS.includes(k)))
    throw new CoreError(400,'invalid_input');
  const {row,stale}=await collection(env,c,p,now);
  const terms=[...new Set(query.match(/[\p{L}\p{N}_-]+/gu)??[])];
  if (!terms.length) throw new CoreError(400,'invalid_input');
  const {results}=await env.DB.prepare(`SELECT * FROM recall_lessons WHERE tenant_id=? AND namespace_id=? AND source_db=? AND status='active'`)
    .bind(...scope(c),SOURCE_DB).all<any>();
  // Bounded project collection, deterministic lexical ranking for the spike.
  const ranked=results.filter(x=>kinds.includes(x.kind)).map(x=>({...x,score:terms.reduce((s,t)=>
    s+(x.what.toLowerCase().includes(t)?2:0)+(x.why.toLowerCase().includes(t)?1:0),0)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const selected=ranked.slice(0,limit);
  await env.DB.batch([
    ...selected.map(x=>env.DB.prepare(`UPDATE recall_lessons SET hit_count=hit_count+1,last_recalled=?
      WHERE tenant_id=? AND namespace_id=? AND source_db=? AND id=?`).bind(now.toISOString(),...scope(c),SOURCE_DB,x.id)),
    env.DB.prepare('INSERT INTO recall_queries VALUES (?, ?, ?, ?, ?, ?)')
      .bind(...scope(c),SOURCE_DB,await sha256Hex(query),ranked.length,now.toISOString()),
  ]);
  return {body:{lessons:selected.map(x=>({id:x.id,content_hash:x.content_hash,kind:x.kind,what:x.what,why:x.why,
    hit_count:x.hit_count+1,last_recalled:now.toISOString(),source_db:SOURCE_DB,score:x.score})),total_matches:ranked.length,
    latency_ms:performance.now()-start,latency_source:'Worker performance.now, query entry through telemetry commit',
    meta:metadata(row,stale,now)}};
}
export async function recallHealth(env:Env,c:Caller,p:URLSearchParams,now:Date):Promise<Outcome> {
  permit(c,'recall:health');
  const {row,stale}=await collection(env,c,p,now);
  const stats=await env.DB.prepare(`SELECT count(*) AS learnings_count, coalesce(sum(hit_count=0),0) AS never_recalled_count
    FROM recall_lessons WHERE tenant_id=? AND namespace_id=? AND source_db=? AND status='active'`)
    .bind(...scope(c),SOURCE_DB).first<any>();
  const {results:gaps}=await env.DB.prepare(`SELECT query_hash,count(*) AS count FROM recall_queries
    WHERE tenant_id=? AND namespace_id=? AND source_db=? AND matches=0 AND observed_at>=?
    GROUP BY query_hash ORDER BY count DESC LIMIT 20`).bind(...scope(c),SOURCE_DB,new Date(now.getTime()-7*86400000).toISOString()).all();
  return {body:{stores:[{source_db:SOURCE_DB,...JSON.parse(row.report),...stats,
    never_recalled_rate:stats.learnings_count?stats.never_recalled_count/stats.learnings_count:null,
    coverage_gaps:gaps,coverage_gap_identity:'sha256 of normalized query',
    metric_source:'D1 recall_lessons and recall_queries; schema and error timestamp from read-only Studio sync'}],meta:metadata(row,stale,now)}};
}
export async function syncRecall(env:Env,c:Caller,input:any,now:Date):Promise<Outcome> {
  permit(c,'recall:sync'); permit(c,'admin');
  if (input?.source_db!==SOURCE_DB||input.source_repo!==REPO||!Array.isArray(input.lessons)||input.lessons.length>1000
    ||!input.report||typeof input.report.schema_version!=='string'||!Array.isArray(input.report.drift_flags)
    ||Number.isNaN(Date.parse(input.observed_at))||Date.parse(input.observed_at)>now.getTime()) throw new CoreError(400,'invalid_input');
  const ids=new Set<string>();
  const lessons=[];
  for (const x of input.lessons) {
    if (typeof x.id!=='string'||!/^[\w.-]{1,128}$/.test(x.id)||ids.has(x.id)||!KINDS.includes(x.kind)
      ||typeof x.what!=='string'||!x.what||x.what.length>16000||typeof x.why!=='string'||x.why.length>16000
      ||!Number.isInteger(x.hit_count)||x.hit_count<0||!(x.last_recalled===null||typeof x.last_recalled==='string'))
      throw new CoreError(400,'invalid_input');
    ids.add(x.id);
    lessons.push({...x,content_hash:await sha256Hex(JSON.stringify([x.kind,x.what,x.why]))});
  }
  const hash=await sha256Hex(JSON.stringify({lessons,report:input.report}));
  const prior=await env.DB.prepare('SELECT * FROM recall_collections WHERE tenant_id=? AND namespace_id=? AND source_db=?')
    .bind(...scope(c),SOURCE_DB).first<any>();
  if(prior && Date.parse(prior.observed_at)>Date.parse(input.observed_at)) throw new CoreError(409,'observation_conflict');
  const generation=(prior?.generation??0)+(prior?.content_hash===hash?0:1);
  // Atomically replace membership. Telemetry survives refresh, deleted lessons stop serving.
  await env.DB.batch([
    env.DB.prepare("UPDATE recall_lessons SET status='removed' WHERE tenant_id=? AND namespace_id=? AND source_db=?")
      .bind(...scope(c),SOURCE_DB),
    ...lessons.map(x=>env.DB.prepare(`INSERT INTO recall_lessons VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      ON CONFLICT DO UPDATE SET content_hash=excluded.content_hash,kind=excluded.kind,what=excluded.what,why=excluded.why,
      hit_count=max(recall_lessons.hit_count,excluded.hit_count),last_recalled=coalesce(recall_lessons.last_recalled,excluded.last_recalled),status='active'`)
      .bind(...scope(c),SOURCE_DB,x.id,x.content_hash,x.kind,x.what,x.why,x.hit_count,x.last_recalled)),
    env.DB.prepare(`INSERT INTO recall_collections VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO UPDATE SET generation=excluded.generation,content_hash=excluded.content_hash,observed_at=excluded.observed_at,report=excluded.report`)
      .bind(...scope(c),REPO,SOURCE_DB,generation,hash,input.observed_at,JSON.stringify(input.report)),
  ]);
  return {body:{synced:lessons.length,generation,content_hash:hash,source_db:SOURCE_DB,source_observed_at:input.observed_at}};
}
