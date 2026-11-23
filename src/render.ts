import puppeteer, { type Browser } from '@cloudflare/puppeteer';
import { record } from './ops';
import type { Caller } from './auth';
import { sha256Hex } from './auth';
import { CoreError, type Outcome } from './core';
import type { Env } from './handler';

// Bounded spike design decisions, not measured capacity or timeout claims.
export const RENDER_LIMIT = 8, RENDER_IDLE_MS = 60_000, RENDER_TIMEOUT_MS = 30_000;
const CLEANUP_RESERVE_MS = 5_000; // Design decision within the total deadline.
class RenderDeadline extends Error {}
function until<T>(end: number, action: ()=>Promise<T>, late?: (value:T)=>void): Promise<T> {
  if(Date.now()>=end) return Promise.reject(new RenderDeadline());
  return new Promise((resolve,reject)=>{
    let expired=false;
    const timer=setTimeout(()=>{expired=true;reject(new RenderDeadline());},Math.max(0,end-Date.now()));
    Promise.resolve().then(()=>{if(Date.now()>=end) throw new RenderDeadline();return action();}).then(value=>{
      clearTimeout(timer);if(expired) {late?.(value);return;} resolve(value);
    },error=>{clearTimeout(timer);if(!expired) reject(error);});
  });
}
// Late resource acquisition is abandoned safely. A close never blocks queue progress.
function abandon(resource: {close():Promise<void>}) {void Promise.resolve().then(()=>resource.close()).catch(()=>{});}
type Input = { idempotency_key: string; delay_ms: number; marker: string };
type Job = { id: string; caller: Caller; input: Input; state: 'queued'|'running'|'complete'|'failed'|'cancelled';
  queued_at: string; started_at?: string; completed_at?: string; error?: string;
  session_id?: string; browser_version?: string; reused?: boolean; context_id?: string;
  context_closed?: boolean; initial_cookie_count?: number; screenshot_hash?: string; screenshot_bytes?: number };
type RenderEnv = Env & { RENDER_HUB: DurableObjectNamespace };
const scope = (c: Caller) => JSON.stringify([c.tenantId,c.namespaceId,c.principalId,c.tokenId]);
const name = (c: Caller) => JSON.stringify([c.tenantId,c.namespaceId]);
function permitted(c: Caller) {
  if(!c.capabilities.includes('verify:render') || !c.sourceRepos.includes('ariaxhan/fleet-mcp')) throw new CoreError(403,'forbidden');
}
function inputOf(v: any): Input {
  if(!v || typeof v !== 'object' || Object.keys(v).some(k=>!['idempotency_key','delay_ms','marker'].includes(k))
    || !/^[\w.-]{8,128}$/.test(v.idempotency_key??'') || !Number.isInteger(v.delay_ms??0)
    || (v.delay_ms??0)<0 || (v.delay_ms??0)>20_000 || !/^[\w .:-]{1,80}$/.test(v.marker??'fleet-mcp fixture'))
    throw new CoreError(400,'invalid_input');
  return {idempotency_key:v.idempotency_key,delay_ms:v.delay_ms??0,marker:v.marker??'fleet-mcp fixture'};
}
export async function renderCall(env: RenderEnv,c: Caller,input: unknown): Promise<Outcome> {
  permitted(c); inputOf(input);
  const r=await env.RENDER_HUB.get(env.RENDER_HUB.idFromName(name(c))).fetch('https://render/enqueue',
    {method:'POST',body:JSON.stringify({caller:c,input})});
  const body=await r.json() as Record<string,unknown>;
  if(!r.ok) throw new CoreError(r.status,String(body.error));
  return {body,status:r.status};
}
export async function getRender(env: RenderEnv,c: Caller,id: string,screenshot=false): Promise<Response> {
  permitted(c);
  if(!/^[a-f0-9-]{36}$/.test(id)) throw new CoreError(400,'invalid_render_id');
  return env.RENDER_HUB.get(env.RENDER_HUB.idFromName(name(c))).fetch(`https://render/${screenshot?'screenshot':'jobs'}/${id}`,
    {method:'POST',body:JSON.stringify({caller:c})});
}

/** Alarm owns execution after the initiating HTTP request returns. No waitUntil work queue. */
export class RenderHub {
  private browser?: Browser;
  private busy=false;
  private activeDeadline=0;
  constructor(private state: DurableObjectState,private env: Env,
    private launch: ()=>Promise<Browser> = ()=>puppeteer.launch(env.BROWSER,{keep_alive:RENDER_IDLE_MS}),
    private timing={totalMs:RENDER_TIMEOUT_MS,cleanupMs:CLEANUP_RESERVE_MS}) {}
  private async authorized(c: Caller) {
    permitted(c);
    const row=await this.env.DB.prepare(`SELECT t.*, n.policy_revision FROM tokens t JOIN namespaces n
      ON n.tenant_id=t.tenant_id AND n.namespace_id=t.namespace_id WHERE t.token_id=?`).bind(c.tokenId).first<any>();
    if(!row || row.revoked_at!==null || Date.parse(row.expires_at)<=Date.now() || row.policy_revision!==c.policyRevision
      || row.tenant_id!==c.tenantId || row.namespace_id!==c.namespaceId || row.principal_id!==c.principalId
      || !JSON.parse(row.capabilities).includes('verify:render') || !JSON.parse(row.source_repos).includes('ariaxhan/fleet-mcp'))
      throw new CoreError(403,'forbidden');
  }
  async fetch(r: Request): Promise<Response> {
    try {
      const {caller:c,input}=await r.json() as {caller:Caller;input:unknown};
      await this.authorized(c);
      const path=new URL(r.url).pathname;
      if(path==='/enqueue') {
        const parsed=inputOf(input), digest=await sha256Hex(JSON.stringify(parsed));
        const key=`key:${scope(c)}:${parsed.idempotency_key}`;
        const result=await this.state.storage.transaction(async s=>{
          const prior=await s.get<{id:string;digest:string}>(key);
          if(prior) {
            if(prior.digest!==digest) throw new CoreError(409,'idempotency_conflict');
            return {job:await s.get<Job>('job:'+prior.id),replayed:true};
          }
          const jobs=await s.list<Job>({prefix:'job:'});
          if([...jobs.values()].filter(j=>['queued','running'].includes(j.state)).length>=RENDER_LIMIT) throw new CoreError(429,'render_capacity');
          const job:Job={id:crypto.randomUUID(),caller:c,input:parsed,state:'queued',queued_at:new Date().toISOString()};
          await s.put('job:'+job.id,job); await s.put(key,{id:job.id,digest});
          await s.setAlarm(Date.now()+1);
          return {job,replayed:false};
        });
        return Response.json({render_id:result.job!.id,state:result.job!.state,replayed:result.replayed},{status:202});
      }
      const match=/^\/(jobs|screenshot)\/([a-f0-9-]{36})$/.exec(path);
      const job=match?await this.state.storage.get<Job>('job:'+match[2]):null;
      if(!job || scope(job.caller)!==scope(c)) throw new CoreError(404,'render_not_found');
      if(match![1]==='screenshot') {
        if(job.state!=='complete') throw new CoreError(409,'render_not_complete');
        const obj=await this.env.BLOBS.get(`render-spike/${name(c)}/${job.id}.png`);
        if(!obj) throw new CoreError(503,'render_artifact_missing');
        return new Response(await obj.arrayBuffer(),{headers:{'content-type':'image/png','cache-control':'no-store'}});
      }
      const {caller,...publicJob}=job;
      return Response.json({...publicJob,concurrency_limit:1,fixture:'fleet-mcp synthetic HTML',renderer:'fleet-spike-v1',
        ready:job.state==='complete',viewport:{width:640,height:480,device_scale_factor:1},
        readiness:{rule:'fixture status equals ready',timeout_ms:RENDER_TIMEOUT_MS},full_page:false});
    } catch(e) { return Response.json({error:e instanceof CoreError?e.code:'internal_error'},{status:e instanceof CoreError?e.status:500}); }
  }
  async alarm() {
    if(this.busy) {await this.state.storage.setAlarm(Math.max(Date.now()+1,this.activeDeadline+1));return;}
    this.busy=true;
    try {
      const jobs=await this.state.storage.list<Job>({prefix:'job:'});
      // A persisted running job after object restart is lost evidence, never silently reconstructed.
      for(const job of jobs.values()) if(job.state==='running') {
        job.state='failed';job.error='interrupted_data_loss';await this.state.storage.put('job:'+job.id,job);
      }
      const job=[...jobs.values()].filter(j=>j.state==='queued').sort((a,b)=>a.queued_at.localeCompare(b.queued_at)||a.id.localeCompare(b.id))[0];
      if(!job) {
        const browser=this.browser;this.browser=undefined;
        if(browser) try {await until(Date.now()+this.timing.cleanupMs,()=>browser.close());} catch {}
        return;
      }
      job.state='running';job.started_at=new Date().toISOString();
      await record(this.env,'render_queue','verify_render',(Date.parse(job.started_at)-Date.parse(job.queued_at))/1000);
      await this.state.storage.put('job:'+job.id,job);
      const totalEnd=Date.now()+this.timing.totalMs;
      this.activeDeadline=totalEnd;
      const workEnd=totalEnd-this.timing.cleanupMs;
      const step=<T>(fn:()=>Promise<T>,late?:(value:T)=>void)=>until(workEnd,fn,late);
      // Watchdog survives process loss. An overlapping alarm re-arms this deadline.
      await this.state.storage.setAlarm(totalEnd+1);
      let context: Awaited<ReturnType<Browser['createBrowserContext']>>|undefined;
      let discard=false;
      try {
        await step(()=>this.authorized(job.caller));
        job.reused=!!this.browser?.connected;
        if(!this.browser?.connected) this.browser=await step(this.launch,abandon);
        const browser=this.browser;
        job.session_id=browser.sessionId();job.browser_version=await step(()=>browser.version());
        context=await step(()=>browser.createBrowserContext(),abandon);job.context_id=context.id;
        const isolated=context;
        job.initial_cookie_count=(await step(()=>isolated.cookies())).length;
        if(job.initial_cookie_count!==0) throw new Error('context_not_isolated');
        await step(()=>isolated.setCookie({name:'fleet-fixture',value:job.id,domain:'fixture.invalid'}));
        const page=await step(()=>isolated.newPage(),abandon);
        await step(()=>page.setViewport({width:640,height:480,deviceScaleFactor:1}));
        await step(()=>page.setContent(`<!doctype html><title>Fleet MCP spike</title><h1>${job.input.marker}</h1><div id="status">waiting</div>
          <script>setTimeout(()=>document.querySelector('#status').textContent='ready',${job.input.delay_ms})</script>`,{timeout:Math.max(1,workEnd-Date.now()),waitUntil:'load'}));
        await step(()=>page.waitForFunction("document.querySelector('#status').textContent === 'ready'",{timeout:Math.max(1,workEnd-Date.now())}));
        await step(()=>this.authorized(job.caller));
        const bytes=await step(()=>page.screenshot({type:'png',fullPage:false}));
        job.screenshot_hash=await step(()=>sha256Hex(new Uint8Array(bytes)));job.screenshot_bytes=bytes.length;
        await step(()=>this.authorized(job.caller));
        await step(()=>this.env.BLOBS.put(`render-spike/${name(job.caller)}/${job.id}.png`,bytes));
        job.state='complete';
      } catch(e) {
        discard=e instanceof RenderDeadline;
        job.state=e instanceof CoreError?'cancelled':'failed';
        job.error=e instanceof CoreError?e.code:e instanceof RenderDeadline?'render_deadline_exceeded':'render_failed';
      } finally {
        if(context) try {await until(totalEnd,()=>context!.close());job.context_closed=true;}
        catch {job.context_closed=false;job.state='failed';job.error='context_cleanup_failed';discard=true;}
        if(discard) {
          const browser=this.browser;this.browser=undefined;
          if(browser) {
            const closing=browser.close();void closing.catch(()=>{});
            try {await until(totalEnd,()=>closing);} catch {}
          }
        }
      }
      if(job.state==='complete') try {await until(totalEnd,()=>this.authorized(job.caller));}
      catch(e) {job.state=e instanceof RenderDeadline?'failed':'cancelled';job.error=e instanceof RenderDeadline?'render_deadline_exceeded':'forbidden';}
      job.completed_at=new Date().toISOString();await this.state.storage.put('job:'+job.id,job);
      const pending=await this.state.storage.list<Job>({prefix:'job:'});
      await this.state.storage.setAlarm(Date.now()+([...pending.values()].some(j=>j.state==='queued')?1:RENDER_IDLE_MS));
    } finally {this.busy=false;}
  }
}
