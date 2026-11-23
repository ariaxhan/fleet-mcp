import test from 'node:test';
import assert from 'node:assert/strict';
import type { Browser } from '@cloudflare/puppeteer';
import { RenderHub, RENDER_LIMIT } from '../src/render';
import { setup } from './harness';
import { authenticate } from '../src/auth';

async function fixture(fail=false,hang?:string) {
  const never=()=>new Promise<any>(()=>{});
  const timing=hang?{totalMs:60,cleanupMs:20}:undefined;
  const {env,db,tokens}=await setup();
  db.prepare("UPDATE tokens SET capabilities='[\"verify:render\"]' WHERE principal_id='publisher'").run();
  const caller=(await authenticate(new Request('https://fixture',{headers:{authorization:`Bearer ${tokens.publisher}`}}),env,new Date()))!;
  const data=new Map<string,any>();let alarm=0,launches=0,active=0,maxActive=0,closed=0;
  const storage:any={get:async(k:string)=>structuredClone(data.get(k)),put:async(k:string,v:any)=>{data.set(k,structuredClone(v));},
    list:async({prefix}:any)=>new Map([...data].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)])),
    setAlarm:async(n:number)=>{alarm=n;},transaction:async(fn:any)=>fn(storage)};
  let finish:()=>void=()=>{};
  const ready=new Promise<void>(r=>{finish=r;});
  if(hang==='r2') env.BLOBS.put=never;
  let browserCloses=0;
  const browser:any={connected:true,sessionId:()=> 'synthetic-session',version:async()=> 'synthetic-browser',close:async()=>{browserCloses++;browser.connected=false;if(hang==='browser-close') await never();},
    createBrowserContext:async()=>{
      if(hang==='context') return never();
      active++;maxActive=Math.max(active,maxActive);let cookies:any[]=[];
      return {id:crypto.randomUUID(),cookies:async()=>cookies,setCookie:async(c:any)=>{cookies.push(c);},
        close:async()=>{if(hang==='cleanup') await never();active--;closed++;},newPage:async()=>({setViewport:async()=>{},setContent:async()=>{},
          waitForFunction:async()=>{await ready;if(fail) throw new Error('fixture timeout');},screenshot:async()=>['screenshot','browser-close'].includes(hang??'')?never():new Uint8Array([137,80,78,71])})};
    }};
  const hub=new RenderHub({storage} as DurableObjectState,env,async()=>{launches++;if(hang==='launch') return never();return browser as Browser;},timing);
  const call=async(path:string,input?:unknown)=>{
    const r=await hub.fetch(new Request('https://render'+path,{method:'POST',body:JSON.stringify({caller,input})}));
    return {status:r.status,body:await r.json() as any};
  };
  return {hub,call,data,db,finish,browserCloses:()=>browserCloses,counts:()=>({launches,active,maxActive,closed,alarm})};
}

test('durable queued jobs complete after enqueue response, reuse browser, isolate and close contexts',async()=>{
  const f=await fixture();
  const a=await f.call('/enqueue',{idempotency_key:'render-first',delay_ms:2000});
  const b=await f.call('/enqueue',{idempotency_key:'render-second'});
  assert.equal(a.status,202);assert.equal((await f.call('/jobs/'+a.body.render_id)).body.state,'queued');
  assert.equal(f.counts().launches,0);
  const run=f.hub.alarm();await f.hub.alarm();f.finish();await run;await f.hub.alarm();
  const results=await Promise.all([a,b].map(x=>f.call('/jobs/'+x.body.render_id)));
  assert.deepEqual(results.map(x=>x.body.state),['complete','complete']);
  assert.deepEqual(results.map(x=>x.body.initial_cookie_count),[0,0]);
  assert.deepEqual(results.map(x=>x.body.context_closed),[true,true]);
  assert.notEqual(results[0].body.context_id,results[1].body.context_id);
  assert.equal(results[0].body.session_id,results[1].body.session_id);
  assert.equal(results.filter(x=>x.body.reused).length,1);
  assert.deepEqual({...f.counts(),alarm:0},{launches:1,active:0,maxActive:1,closed:2,alarm:0});
  assert.equal((await f.call('/enqueue',{idempotency_key:'render-first',delay_ms:2000})).body.replayed,true);
  assert.equal((await f.call('/enqueue',{idempotency_key:'render-first',delay_ms:1})).status,409);
});

test('capacity and fixture-only inputs are enforced, revocation cancels queued dispatch',async()=>{
  const f=await fixture();
  assert.equal((await f.call('/enqueue',{idempotency_key:'invalid-url',url:'https://excluded.invalid'})).status,400);
  const jobs: {status:number;body:any}[]=[];
  for(let i=0;i<RENDER_LIMIT;i++) jobs.push(await f.call('/enqueue',{idempotency_key:`capacity-${i}`}));
  assert.equal((await f.call('/enqueue',{idempotency_key:'capacity-more'})).status,429);
  f.db.prepare("UPDATE tokens SET revoked_at='2026-01-01' WHERE principal_id='publisher'").run();
  await f.hub.alarm();
  assert.equal(f.counts().launches,0);
  assert.equal(jobs.filter(j=>f.data.get('job:'+j.body.render_id).state==='cancelled').length,1);
});

test('render failure closes context and an interrupted run is recorded as data loss',async()=>{
  const f=await fixture(true);
  const a=await f.call('/enqueue',{idempotency_key:'render-failure'});
  f.finish();await f.hub.alarm();
  const result=await f.call('/jobs/'+a.body.render_id);
  assert.equal(result.body.state,'failed');assert.equal(result.body.context_closed,true);
  const job=f.data.get('job:'+a.body.render_id);job.state='running';f.data.set('job:'+job.id,job);
  await f.hub.alarm();
  assert.equal(f.data.get('job:'+job.id).error,'interrupted_data_loss');
});

for(const phase of ['launch','context','screenshot','r2','cleanup','browser-close']) {
  test(`total deadline bounds ${phase} and releases queue ownership`,{timeout:1000},async()=>{
    const f=await fixture(false,phase);
    const a=await f.call('/enqueue',{idempotency_key:'deadline-first'});
    f.finish();
    const alarm=f.hub.alarm();
    await f.hub.alarm();
    await alarm;
    const first=(await f.call('/jobs/'+a.body.render_id)).body;
    assert.equal(first.state,'failed');
    assert.ok(['render_deadline_exceeded','context_cleanup_failed','render_failed'].includes(first.error));
    assert.ok(first.completed_at);
    if(phase==='cleanup') assert.equal(first.context_closed,false);
    if(['context','screenshot','r2','cleanup','browser-close'].includes(phase)) assert.equal(f.browserCloses(),1);
    if(phase==='browser-close') assert.equal(first.error,'render_deadline_exceeded');
    const b=await f.call('/enqueue',{idempotency_key:'deadline-second'});
    await f.hub.alarm();
    assert.equal((await f.call('/jobs/'+b.body.render_id)).body.state,'failed');
  });
}
