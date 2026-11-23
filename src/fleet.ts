import type { Env } from './handler';
import { type Caller, hmacHex, constantTimeEqual } from './auth';
import { CoreError, PERSONAL_SOURCE_REPOS, type Outcome } from './core';
import { connectorState } from './connector';

export const STATES = ['started', 'done', 'failed', 'blocker', 'stalled', 'preempted', 'retired', 'ended'];
export function requireFleet(c: Caller) {
  if (!c.capabilities.includes('fleet:read')) throw new CoreError(403, 'forbidden');
}
export const fleetScope = (c: Caller) => JSON.stringify([c.tokenId,c.principalId,c.tenantId,c.namespaceId,c.policyRevision,[...c.sourceRepos].sort()]);
export function repos(c: Caller) { return c.sourceRepos.filter(r => PERSONAL_SOURCE_REPOS.includes(r)); }
export async function fleetCursor(env: Env,c: Caller,seq: number) {
  const p = btoa(JSON.stringify([seq,fleetScope(c)])).replace(/=+$/, '').replace(/\+/g,'-').replace(/\//g,'_');
  return p+'.'+await hmacHex(env.TOKEN_HMAC_KEY!, 'fleet:'+p);
}
export async function fleetSeq(env: Env,c: Caller,cursor: string) {
  try {
    const [p,mac,...extra]=cursor.split('.');
    if(extra.length || !constantTimeEqual(await hmacHex(env.TOKEN_HMAC_KEY!,'fleet:'+p),mac ?? '')) throw Error();
    const [seq,scope]=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
    if(!Number.isSafeInteger(seq)||seq<0||scope!==fleetScope(c)) throw Error();
    return seq as number;
  } catch { throw new CoreError(400,'invalid_cursor'); }
}
export async function fleetHead(env: Env,c: Caller) {
  const row=await env.DB.prepare('SELECT COALESCE(MAX(seq),0) s FROM change_events WHERE tenant_id=? AND namespace_id=?')
    .bind(c.tenantId,c.namespaceId).first<{s:number}>();
  return row!.s;
}
export async function flightRows(env: Env,c: Caller) {
  requireFleet(c);
  const allowed=repos(c); if(!allowed.length) return [];
  return (await env.DB.prepare(`SELECT f.*, s.last_heartbeat_at FROM fleet_events f JOIN machines m ON m.machine_id=f.machine_id
    LEFT JOIN connector_status s ON s.machine_id=f.machine_id
    WHERE m.tenant_id=? AND m.namespace_id=? AND m.revoked_at IS NULL AND f.repo IN (${allowed.map(()=>'?').join(',')})
    ORDER BY f.source_observed_at DESC, f.change_seq DESC`).bind(c.tenantId,c.namespaceId,...allowed).all<any>()).results;
}
export function flightId(r: any) { return r.machine_id+':'+r.attempt_id; }
function summary(rows: any[],now: Date) {
  const latest=new Map<string,any>();
  for(const r of rows) {
    const id=flightId(r); if(latest.has(id)) continue;
    latest.set(id,{id,task_ref:r.task_id,status:r.event_kind,worker:r.machine_id,
      started:rows.filter(x=>flightId(x)===id&&x.event_kind==='started').at(-1)?.source_observed_at ?? null,
      updated:r.source_observed_at,source_observed_at:r.source_observed_at,last_event:r.event_kind,
      progress:null,connector_status:connectorState(r.last_heartbeat_at,now),
      freshness:connectorState(r.last_heartbeat_at,now)==='fresh'?'fresh':'stale'});
  }
  return [...latest.values()];
}
export async function fleetList(env: Env,c: Caller,p: URLSearchParams,now: Date): Promise<Outcome> {
  const state=p.get('state'),limit=Number(p.get('limit')??50);
  if((state&&!STATES.includes(state))||!Number.isInteger(limit)||limit<1||limit>100) throw new CoreError(400,'invalid_input');
  const flights=summary(await flightRows(env,c),now).filter(r=>!state||r.status===state);
  return {body:{flights:flights.slice(0,limit),has_more:flights.length>limit,meta:{source:'d1',cache_status:'bypass',served_at:now.toISOString()}}};
}
export async function fleetGet(env: Env,c: Caller,p: URLSearchParams,now: Date): Promise<Outcome> {
  if(!p.get('id')) throw new CoreError(400,'invalid_input');
  const flight=summary(await flightRows(env,c),now).find(r=>r.id===p.get('id'));
  if(!flight) throw new CoreError(404,'not_found');
  return {body:{...flight,meta:{source:'d1',cache_status:'bypass',served_at:now.toISOString()}},targetId:flight.id};
}
export async function fleetEvents(env: Env,c: Caller,from: number) {
  const allowed=repos(c); if(!allowed.length) return [];
  return (await env.DB.prepare(`SELECT e.seq,e.kind,e.name,e.version,e.change_kind,e.created_at,e.source_observed_at,e.source_repo
    FROM change_events e WHERE e.tenant_id=? AND e.namespace_id=? AND e.seq>?
    AND e.source_repo IN (${allowed.map(()=>'?').join(',')}) AND (e.kind='fleet_event' OR (e.kind='issue' AND ?=1))
    AND (e.kind!='fleet_event' OR EXISTS (SELECT 1 FROM fleet_events f JOIN machines m ON m.machine_id=f.machine_id
      WHERE f.change_seq=e.seq AND m.revoked_at IS NULL AND m.tenant_id=e.tenant_id AND m.namespace_id=e.namespace_id))
    ORDER BY e.seq LIMIT 100`).bind(c.tenantId,c.namespaceId,from,...allowed,c.capabilities.includes('issue:read')?1:0).all<any>()).results;
}
export async function fleetChanges(env: Env,c: Caller,p: URLSearchParams,now: Date): Promise<Outcome> {
  requireFleet(c);
  const cursor=p.get('cursor');
  if(!cursor) {
    const head=await fleetHead(env,c);
    return {body:{bootstrap:true,...(await fleetList(env,c,new URLSearchParams(),now)).body,
      next_cursor:await fleetCursor(env,c,head)}};
  }
  const events=await fleetEvents(env,c,await fleetSeq(env,c,cursor));
  return {body:{events,unchanged:events.length===0,has_more:events.length===100,
    next_cursor:events.length?await fleetCursor(env,c,events.at(-1).seq):cursor,meta:{source:'d1',served_at:now.toISOString()}}};
}
