import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './harness';
import { WaitHub } from '../src/wait';
const machine='m_'+'a'.repeat(32);
async function fixture() {
  const h=await setup();
  h.db.prepare("INSERT INTO machines VALUES (?, 'unused', 'personal','personal-docs','2026-01-01',NULL)").run(machine);
  h.db.prepare("INSERT INTO connector_status (machine_id, sidecar_version, last_seq, outbox_depth, dropped_for_boundary, last_heartbeat_at) VALUES (?, 'test',0,0,0,?)").run(machine,new Date().toISOString());
  const values=new Map<string,any>();
  const storage={get:async(k:string)=>values.get(k),put:async(k:string,v:any)=>{values.set(k,structuredClone(v));},
    delete:async(k:string)=>values.delete(k),list:async()=>values,setAlarm:async()=>{}} as unknown as DurableObjectStorage;
  let hub=new WaitHub(storage,h.env);
  h.env.FLEET_WAIT={idFromName:()=>'',get:()=>({fetch:(url:string,init:any)=>hub.fetch(new Request(url,init))})} as any;
  function event(state:string,observed=new Date().toISOString()) {
    h.db.prepare(`INSERT INTO change_events (tenant_id,namespace_id,kind,name,version,change_kind,source_repo,actor_principal_id,created_at)
      VALUES ('personal','personal-docs','fleet_event',?,1,'created','ariaxhan/fleet-mcp','test',?)`).run('flight/'+state,observed);
    const seq=h.db.prepare('SELECT MAX(seq) s FROM change_events').get()!.s;
    h.db.prepare('INSERT INTO fleet_events VALUES (?,?,?,?,?,?,?,?,?,?)').run(machine,Number(seq),String(seq),'ariaxhan/fleet-mcp#14','ariaxhan/fleet-mcp','14',state,observed,observed,seq);
  }
  return {...h,event,restart:()=>{hub=new WaitHub(storage,h.env);},notify:()=>hub.fetch(new Request('https://wait/notify',{method:'POST'}))};
}
test('real SQL flight summary, latest observation, filters and permissions',async()=>{
  const h=await fixture(); h.event('started','2026-01-01T00:00:00Z'); h.event('done','2026-01-02T00:00:00Z'); h.event('started','2025-01-01T00:00:00Z');
  const list=await h.call(h.tokens.fleet,'/v1/fleet/list'); assert.equal(list.body.flights[0].status,'done');
  const get=await h.call(h.tokens.fleet,'/v1/fleet/get?id='+machine+':14'); assert.equal(get.body.status,'done');
  assert.equal((await h.call(h.tokens.reader,'/v1/fleet/list')).status,403);
  assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/list?limit=0')).status,400);
  assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/get?id=missing')).status,404);
  h.db.prepare('UPDATE machines SET revoked_at=?').run(new Date().toISOString());
  assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/list')).body.flights.length,0);
});
test('scoped feed bootstrap, delta and tamper refusal',async()=>{
 const h=await fixture(); const first=await h.call(h.tokens.fleet,'/v1/fleet/changes'); h.event('started');
 const delta=await h.call(h.tokens.fleet,'/v1/fleet/changes?cursor='+encodeURIComponent(first.body.next_cursor));
 assert.equal(delta.body.events.length,1);
 assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/changes?cursor=bad')).status,400);
});
test('bounded timeout, restart resume and event-driven wake without client polling',async()=>{
 const h=await fixture();
 const initial=await h.call(h.tokens.fleet,'/v1/fleet/wait',{condition:{flight_id:machine+':14',state:'done'},timeout_s:0});
 assert.equal(initial.body.met,false); const id=initial.body.wait_id;
 h.restart();
 const pending=h.call(h.tokens.fleet,'/v1/fleet/wait',{wait_id:id,timeout_s:1});
 await new Promise(r=>setTimeout(r,25)); h.event('started'); await h.notify();
 await new Promise(r=>setTimeout(r,25)); h.event('done'); await h.notify();
 const result=await pending; assert.equal(result.body.met,true); assert.equal(result.body.final_state.event_kind,'done');
 h.restart(); assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/wait',{wait_id:id,timeout_s:0})).body.met,true);
 assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/wait',{condition:{repo:'synthetic/excluded'},timeout_s:0})).status,400);
 assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/wait',{wait_id:id,timeout_s:21})).status,400);
});
test('repo wait catches events between calls after restart',async()=>{
 const h=await fixture();
 const first=await h.call(h.tokens.fleet,'/v1/fleet/wait',{condition:{repo:'ariaxhan/fleet-mcp'},timeout_s:0});
 h.event('done'); h.restart();
 assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/wait',{wait_id:first.body.wait_id,timeout_s:0})).body.met,true);
});

test('resume binds policy and repository scope, invalid payload fails closed',async()=>{
 const h=await fixture();
 const first=await h.call(h.tokens.fleet,'/v1/fleet/wait',{condition:{repo:'ariaxhan/fleet-mcp'},timeout_s:0});
 h.db.prepare("UPDATE tokens SET source_repos='[]' WHERE principal_id='fleet'").run();
 assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/wait',{wait_id:first.body.wait_id,timeout_s:0})).status,404);
 assert.equal((await h.call(h.tokens.fleet,'/v1/fleet/wait',[])).status,400);
});
