import { mkdir, writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const [origin,sha]=process.argv.slice(2);
if(!['https://fleet-mcp-staging.ariaxhan.workers.dev','https://fleet-mcp.ariaxhan.workers.dev'].includes(origin)) throw Error('Origin not allowlisted');
const token=process.env.FLEET_READ_PATH_TOKEN,secret=process.env.FLEET_GITHUB_WEBHOOK_SECRET;
if(!token||!secret||!/^[a-f0-9]{40}$/.test(sha??'')) throw Error('Token, webhook secret and deployed SHA required');
const receipt={purpose:'functional spike validation, not benchmark',origin,sha,observed_at:new Date().toISOString(),checks:[]};
async function call(name,path,validate,{method='GET',body,headers={}}={}) {
 const start=performance.now();
 const r=await fetch(origin+path,{method,body,headers:{authorization:`Bearer ${token}`,...headers},redirect:'error',signal:AbortSignal.timeout(120000)});
 const data=await r.json();
 receipt.checks.push({name,path,status:r.status,latency_ms:performance.now()-start,body:data});
 assert.ok(validate(r,data),name+': '+JSON.stringify(data));
 return data;
}
try {
 await call('build','/version',(r,b)=>r.ok&&b.commit===sha);
 const first=await call('issue_get','/v1/issues/get?repo=ariaxhan/fleet-mcp&number=13&consistency=validated',(r,b)=>r.ok&&b.title==='Spike: build the Issue Context and Recall read paths'&&b.meta.source_observed_at&&b.meta.content_hash);
 await call('issue_unchanged',`/v1/issues/get?repo=ariaxhan/fleet-mcp&number=13&since_version=${first.version}`,(r,b)=>r.ok&&b.unchanged);
 const payload=JSON.stringify({repository:{full_name:'ariaxhan/fleet-mcp'},issue:{number:13}});
 await call('webhook_signature_refused','/webhooks/github',(r)=>r.status===401,{method:'POST',body:payload});
 await call('signed_real_issue_revalidation','/webhooks/github',(r,b)=>r.ok&&b.accepted,{method:'POST',body:payload,headers:{'x-github-event':'issues','x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(payload).digest('hex')}});
 const after=await call('issue_after_invalidation','/v1/issues/get?repo=ariaxhan/fleet-mcp&number=13',(r,b)=>r.ok&&b.meta.cache_status==='hit');
 assert.ok(Date.parse(after.meta.source_observed_at)>=Date.parse(first.meta.source_observed_at));
 await call('reconcile','/admin/sync/github?repo=ariaxhan/fleet-mcp',(r,b)=>r.ok&&b.coverage==='complete',{method:'POST'});
 await call('issue_list','/v1/issues/list?repo=ariaxhan/fleet-mcp&state=all',(r,b)=>r.ok&&b.coverage==='complete'&&b.issues.some(i=>i.number===13));
 await call('recall_query','/v1/recall/query?query=fleet-mcp',(r,b)=>r.ok&&b.lessons.length>0&&Number.isFinite(b.latency_ms));
 await call('recall_health','/v1/recall/health',(r,b)=>r.ok&&b.stores.length===1&&b.stores[0].learnings_count>0&&typeof b.stores[0].schema_version==='string');
 receipt.pass=true;
} finally {
 await mkdir('artifacts',{recursive:true});
 const file=`artifacts/read-paths-${origin.includes('-staging')?'staging':'production'}.json`;
 await writeFile(file,JSON.stringify(receipt,null,2)+'\n');
 console.log(file,receipt.pass?'PASS':'FAIL');
}
