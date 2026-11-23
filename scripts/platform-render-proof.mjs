// Functional platform capture only. No benchmark tasks or treatment arms.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const environment=process.argv[2]??'staging';
if(!['staging','production'].includes(environment)) throw Error('environment required');
const origin=environment==='staging'?'https://staging-mcp.ariaxhan.com':'https://mcp.ariaxhan.com';
const token=execFileSync('security',['find-generic-password','-s',`fleet-mcp-platform-token-${environment}`,'-w'],{encoding:'utf8'}).trim();
const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
const receipt={purpose:'functional render acceptance, not benchmark',origin,observed_at:new Date().toISOString(),version:null,enqueue:[],observations:[],pass:false};
const stamp=Date.now(),dir='artifacts/platform';mkdirSync(dir,{recursive:true});
try {
 receipt.version=await(await fetch(origin+'/version')).json();
 const ids=await Promise.all([0,1].map(async i=>{
  const started=new Date().toISOString();
  const r=await fetch(origin+'/v1/render/jobs',{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify({idempotency_key:`platform-${stamp}-${i}`,delay_ms:i?7000:3000,marker:`Fleet MCP platform proof ${i}`})});
  const body=await r.json();receipt.enqueue.push({started,ended:new Date().toISOString(),status:r.status,body});assert.equal(r.status,202);return body.render_id;
 }));
 const final=new Map(),deadline=Date.now()+90000; // Capture budget, design decision.
 while(final.size<ids.length && Date.now()<deadline) {
  for(const id of ids.filter(id=>!final.has(id))) {
   const r=await fetch(origin+'/v1/render/jobs/'+id,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
   const body=await r.json();receipt.observations.push({id,observed_at:new Date().toISOString(),status:r.status,body});assert.equal(r.status,200);
   if(['complete','failed','cancelled'].includes(body.state)) final.set(id,body);
  }
  if(final.size<ids.length) await new Promise(resolve=>setTimeout(resolve,2000));
 }
 assert.equal(final.size,2,'capture deadline');
 const jobs=[...final.values()].sort((a,b)=>a.started_at.localeCompare(b.started_at));
 for(const job of jobs) {
  assert.equal(job.state,'complete',JSON.stringify(job));assert.equal(job.context_closed,true);assert.equal(job.initial_cookie_count,0);
  const response=await fetch(origin+'/v1/render/jobs/'+job.id+'/screenshot',{headers,redirect:'error'});assert.equal(response.status,200);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');assert.equal(hash,job.screenshot_hash);
  writeFileSync(`${dir}/render-${environment}-${stamp}-${job.id}.png`,bytes);
 }
 assert.equal(jobs[1].reused,true);assert.equal(jobs[0].session_id,jobs[1].session_id);assert.notEqual(jobs[0].context_id,jobs[1].context_id);
 assert.ok(jobs[1].started_at>=jobs[0].completed_at,'serial concurrency bound');
 for(const j of jobs) assert.ok(j.completed_at>receipt.enqueue.find(x=>x.body.render_id===j.id).ended,'completion after initiating request');
 receipt.pass=true;
} catch(error) {receipt.error=String(error);process.exitCode=1;}
finally {const path=`${dir}/render-${environment}-${stamp}.json`;writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');console.log(path,receipt.pass?'PASS':'FAIL');}
