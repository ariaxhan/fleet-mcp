import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './harness';
import { issueGet, issueList, githubWebhook, reconcile, connector } from '../src/issues';
import { recallQuery, recallHealth, syncRecall, SOURCE_DB } from '../src/recall';
import { hmacHex } from '../src/auth';
const p=(s:string)=>new URLSearchParams(s);
const now=()=>new Date();
const caller={...connector,capabilities:['issue:read','recall:read','recall:health','recall:sync','admin']};
const fixture=(title:string)=>({number:13,title,body:'personal project',state:'open',labels:[],assignees:[],
 repository_url:'https://api.github.com/repos/ariaxhan/fleet-mcp',comments:0,updated_at:'2026-11-22T00:00:00Z'});

test('issue snapshots, signed invalidation, missed-webhook reconciliation and freshness failure',async()=>{
 const {env,db}=await setup(); env.GITHUB_WEBHOOK_SECRET='test-key';
 const original=globalThis.fetch; let title='original',offline=false,calls=0;
 globalThis.fetch=async(input:any,init:any)=>{
  assert.equal(init.redirect,'manual');
  calls++; assert.ok(String(input).startsWith('https://api.github.com/repos/ariaxhan/fleet-mcp/'));
  if(offline) throw new Error('offline');
  return Response.json(String(input).includes('issues?')?[fixture(title)]:fixture(title));
 };
 try {
  const first=await issueGet(env,caller,p('repo=ariaxhan/fleet-mcp&number=13'),now());
  assert.equal(first.body.title,'original'); assert.equal((first.body.meta as any).version,1);
  const before=calls;
  assert.equal((await issueGet(env,caller,p('repo=ariaxhan/fleet-mcp&number=13&since_version=1'),now())).body.unchanged,true);
  assert.equal(calls,before);
  await assert.rejects(issueGet(env,caller,p('repo=synthetic-excluded/repo&number=13'),now()),/source_not_allowlisted/);
  assert.equal(calls,before);
  title='webhook update';
  const raw=JSON.stringify({repository:{full_name:'ariaxhan/fleet-mcp'},issue:{number:13}});
  const headers={'x-github-event':'issues','x-hub-signature-256':'sha256='+await hmacHex('test-key',raw)};
  assert.equal((await githubWebhook(new Request('https://fixture/webhooks/github',{method:'POST',body:raw,headers}),env)).status,200);
  assert.equal((await issueGet(env,caller,p('repo=ariaxhan/fleet-mcp&number=13'),now())).body.title,title);
  title='missed webhook'; await reconcile(env,caller,'ariaxhan/fleet-mcp');
  assert.equal((await issueList(env,caller,p('repo=ariaxhan/fleet-mcp'),now())).body.coverage,'complete');
  assert.equal(db.prepare('SELECT count(*) n FROM issue_snapshots').get()!.n,3);
  assert.equal(db.prepare("SELECT count(*) n FROM change_events WHERE kind='issue'").get()!.n,3);
  offline=true; db.exec('UPDATE issue_heads SET invalidated=1');
  await assert.rejects(issueGet(env,caller,p('repo=ariaxhan/fleet-mcp&number=13'),now()));
  assert.equal(((await issueGet(env,caller,p('repo=ariaxhan/fleet-mcp&number=13&allow_stale=true'),now())).body.meta as any).cache_status,'stale');
  assert.equal((await githubWebhook(new Request('https://fixture',{method:'POST',body:raw}),env)).status,401);
 } finally {globalThis.fetch=original;db.close();}
});

test('owned recall collection, store report, rank, telemetry, removal and stale refusal',async()=>{
 const {env,db}=await setup();
 const data={source_repo:'ariaxhan/fleet-mcp',source_db:SOURCE_DB,observed_at:now().toISOString(),
  report:{schema_version:'test-v1',drift_flags:[],errors_last_write:null},
  lessons:[{id:'a',kind:'gotcha',what:'fleet-mcp freshness',why:'source observation',hit_count:0,last_recalled:null},
   {id:'b',kind:'pattern',what:'fleet-mcp snapshots',why:'history',hit_count:0,last_recalled:null}]};
 await syncRecall(env,caller,data,now());
 const r:any=await recallQuery(env,caller,p('query=freshness'),now());
 assert.equal(r.body.lessons[0].id,'a');assert.equal(r.body.lessons[0].hit_count,1);
 assert.ok(Number(r.body.latency_ms)>=0);
 let health:any=await recallHealth(env,caller,p(''),now());
 assert.equal(health.body.stores[0].learnings_count,2);assert.equal(health.body.stores[0].never_recalled_count,1);
 await assert.rejects(recallQuery(env,{...caller,sourceRepos:[]},p('query=freshness'),now()),/forbidden/);
 await assert.rejects(recallQuery(env,caller,p('query='),now()),/invalid_input/);
 await syncRecall(env,caller,{...data,observed_at:now().toISOString(),lessons:[data.lessons[1]]},now());
 assert.equal((await recallQuery(env,caller,p('query=freshness'),now())).body.total_matches,0);
 db.exec("UPDATE recall_collections SET observed_at='2000-01-01T00:00:00Z'");
 await assert.rejects(recallHealth(env,caller,p(''),now()),/freshness_unmet/);
 health=await recallHealth(env,caller,p('allow_stale=true'),now());
 assert.equal(health.body.meta.cache_status,'stale');assert.equal(health.body.stores[0].coverage_gaps.length,1);
 db.close();
});
