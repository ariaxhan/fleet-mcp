import type { Env } from './handler';
import type { Caller } from './auth';
import { CoreError, type Outcome } from './core';
import { requireFleet, fleetScope, fleetHead, fleetCursor, flightRows, flightId, STATES, repos } from './fleet';

// Spike design decisions, not measured client timeout or capacity claims.
export const WAIT_CAP_S=20, WAIT_TTL_MS=86400_000, MAX_ACTIVE=128;
type Condition = { flight_id: string; state: string } | { repo: string };
type Saved = { scope: string; condition: Condition; from: number; created: number; result?: any };
export const hubName = (c: {tenantId:string;namespaceId:string}) => JSON.stringify([c.tenantId,c.namespaceId]);
export async function fleetWait(env: Env,c: Caller,input: any, signal?: AbortSignal): Promise<Outcome> {
  requireFleet(c);
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new CoreError(400,'invalid_input');
  const timeout=input?.timeout_s??WAIT_CAP_S;
  if(!Number.isFinite(timeout)||timeout<0||timeout>WAIT_CAP_S) throw new CoreError(400,'invalid_timeout');
  if(input.wait_id && input.condition) throw new CoreError(400,'invalid_input');
  if(input.wait_id && !/^[a-f0-9-]{36}$/.test(input.wait_id)) throw new CoreError(400,'invalid_wait_id');
  if(!input.wait_id) {
    const x=input.condition;
    if(!x || !(typeof x.flight_id==='string' && x.flight_id.length<100 && STATES.includes(x.state)
      || typeof x.repo==='string' && repos(c).includes(x.repo))) throw new CoreError(400,'invalid_condition');
  }
  const stub=env.FLEET_WAIT.get(env.FLEET_WAIT.idFromName(hubName(c)));
  const r=await stub.fetch('https://wait/call',{method:'POST',signal,body:JSON.stringify({caller:c,input:{...input,timeout_s:timeout}})});
  const body=await r.json() as Record<string,unknown>;
  if(!r.ok) throw new CoreError(r.status,String(body.error));
  return {body};
}

/** Persisted registration with event-driven wakeup. No state polling loop. */
export class WaitHub {
  private listeners=new Set<()=>void>();
  constructor(private storage: DurableObjectStorage,private env: Env) {}
  async fetch(request: Request): Promise<Response> {
    if(new URL(request.url).pathname==='/health') return Response.json({status:'ok'});
    if(new URL(request.url).pathname==='/notify') {
      for(const wake of [...this.listeners]) wake();
      return Response.json({notified:true});
    }
    try { return Response.json(await this.call(await request.json() as any)); }
    catch(e) { return Response.json({error:e instanceof CoreError?e.code:'internal_error'},{status:e instanceof CoreError?e.status:500}); }
  }
  private async evaluate(saved: Saved,c: Caller) {
    if(saved.result) return saved.result;
    let state=null;
    if('flight_id' in saved.condition) {
      const condition=saved.condition;
      const rows=await flightRows(this.env,c);
      // Any matching post-registration transition counts even if a later state followed while disconnected.
      state=rows.find(r=>flightId(r)===condition.flight_id && r.event_kind===condition.state && r.change_seq>saved.from) ?? null;
      if(!state) {
        const latest=rows.find(r=>flightId(r)===condition.flight_id);
        if(latest?.event_kind===condition.state) state=latest;
      }
    } else {
      const condition=saved.condition;
      // Filter in SQL so unrelated visible events cannot starve a pattern behind a page.
      const row=await this.env.DB.prepare(`SELECT e.* FROM change_events e JOIN fleet_events f ON f.change_seq=e.seq
        JOIN machines m ON m.machine_id=f.machine_id WHERE e.tenant_id=? AND e.namespace_id=? AND e.seq>?
        AND e.kind='fleet_event' AND e.source_repo=? AND m.revoked_at IS NULL ORDER BY e.seq LIMIT 1`)
        .bind(c.tenantId,c.namespaceId,saved.from,condition.repo).first<any>();
      state=row;
    }
    if(!state) return null;
    return {final_state:state,next_cursor:await fleetCursor(this.env,c,state.change_seq??state.seq)};
  }
  private async call({caller:c,input}: {caller:Caller;input:any}) {
    requireFleet(c);
    const start=Date.now(),id=input.wait_id??crypto.randomUUID(),key='wait:'+id;
    let saved=await this.storage.get<Saved>(key);
    if(input.wait_id && !saved) throw new CoreError(404,'wait_not_found');
    if(saved && (saved.scope!==fleetScope(c))) throw new CoreError(404,'wait_not_found');
    if(saved && start-saved.created>WAIT_TTL_MS) { await this.storage.delete(key); throw new CoreError(410,'wait_expired'); }
    if(!saved) {
      if((await this.storage.list({prefix:'wait:',limit:1024})).size>=1024) throw new CoreError(429,'wait_capacity');
      saved={scope:fleetScope(c),condition:input.condition,from:await fleetHead(this.env,c),created:start};
      await this.storage.put(key,saved);
      await this.storage.setAlarm(start+WAIT_TTL_MS);
    }
    if(this.listeners.size>=MAX_ACTIVE) throw new CoreError(429,'wait_capacity');
    let cleanup=()=>{};
    try {
      let result:any=null;
      const deadline=start+input.timeout_s*1000;
      do {
        let wake:()=>void=()=>{};
        const event=new Promise<void>(resolve=>{wake=resolve;});
        this.listeners.add(wake);
        let timer:ReturnType<typeof setTimeout>|undefined;
        cleanup=()=>{this.listeners.delete(wake); if(timer) clearTimeout(timer);};
        result=await this.evaluate(saved,c);
        if(result || Date.now()>=deadline) { cleanup(); break; }
        await Promise.race([event,new Promise<void>(resolve=>{timer=setTimeout(resolve,Math.max(0,deadline-Date.now()));})]);
        cleanup();
      } while(Date.now()<deadline);
      if(!result) result=await this.evaluate(saved,c);
      if(result) { saved.result=result; await this.storage.put(key,saved); }
      return {met:!!result,final_state:result?.final_state??null,waited_s:(Date.now()-start)/1000,wait_id:id,
        next_cursor:result?.next_cursor??await fleetCursor(this.env,c,saved.from)};
    } finally { cleanup(); }
  }
  async alarm() {
    const entries=await this.storage.list<Saved>({prefix:'wait:'});
    let next=Infinity;
    for(const [key,v] of entries) {
      if(v.created+WAIT_TTL_MS<=Date.now()) await this.storage.delete(key);
      else next=Math.min(next,v.created+WAIT_TTL_MS);
    }
    if(Number.isFinite(next)) await this.storage.setAlarm(next);
  }
}
