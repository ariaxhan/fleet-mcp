import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [environment,sha]=process.argv.slice(2);
if(!['staging','production'].includes(environment)||!/^[a-f0-9]{40}$/.test(sha??'')) throw Error('environment SHA required');
const origin=`https://fleet-mcp${environment==='staging'?'-staging':''}.ariaxhan.workers.dev`;
const key=execFileSync('security',['find-generic-password','-s',`fleet-mcp-token-hmac-${environment}`,'-w'],{encoding:'utf8'}).trim();
const token=execFileSync(process.execPath,['scripts/issue-token.mjs',environment,'fleet-spike-14','fleet:read,issue:read','ariaxhan/fleet-mcp','1'],
 {encoding:'utf8',env:{...process.env,FLEET_TOKEN_HMAC_KEY:key}}).trim();
const receipt={purpose:'functional spike validation, not benchmark',origin,sha,observed_at:new Date().toISOString(),checks:[]};
async function call(name,path,body,signal) {
 const start=performance.now();
 const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`},body:body?JSON.stringify(body):undefined,signal:signal??AbortSignal.timeout(30000),redirect:'error'});
 const data=await r.json();
 receipt.checks.push({name,status:r.status,elapsed_ms:performance.now()-start,body:data});
 assert.equal(r.status,200,name); return data;
}
try {
 assert.equal((await call('build','/version')).commit,sha);
 const feed=await call('fleet_what_changed_since','/v1/fleet/changes');
 const registration=await call('register','/v1/fleet/wait',{condition:{repo:'ariaxhan/fleet-mcp'},timeout_s:0});
 assert.equal(registration.met,false);
 const controller=new AbortController();
 const disconnected=call('disconnect','/v1/fleet/wait',{wait_id:registration.wait_id,timeout_s:20},controller.signal).then(()=>{throw Error('unexpected early response');},e=>{assert.equal(e.name,'AbortError');receipt.checks.push({name:'client_disconnect',pass:true});});
 await new Promise(r=>setTimeout(r,1000)); controller.abort(); await disconnected;
 const pending=call('server_wait','/v1/fleet/wait',{wait_id:registration.wait_id,timeout_s:20});
 await new Promise(r=>setTimeout(r,1000));
 const sidecar=spawn(process.execPath,['sidecar/fleet-sidecar.mjs','once',environment],{stdio:['ignore','pipe','pipe']});
 let output=''; sidecar.stdout.on('data',b=>output+=b);sidecar.stderr.on('data',b=>output+=b);
 const exit=await new Promise(resolve=>sidecar.on('exit',resolve));
 receipt.checks.push({name:'real_sidecar_collection',exit,output}); assert.equal(exit,0);
 const met=await pending;assert.equal(met.met,true,'real new fleet event required');assert.equal(met.wait_id,registration.wait_id);
 const list=await call('fleet_list_flights','/v1/fleet/list'); assert.ok(list.flights.length);
 await call('fleet_get_flight','/v1/fleet/get?id='+encodeURIComponent(list.flights[0].id));
 const resumed=await call('resume_after_event','/v1/fleet/wait',{wait_id:registration.wait_id,timeout_s:0});assert.equal(resumed.met,true);
 const delta=await call('fleet_delta','/v1/fleet/changes?cursor='+encodeURIComponent(feed.next_cursor));assert.ok(delta.events.some(e=>e.kind==='fleet_event'));
 receipt.pass=true;
} finally {
 mkdirSync('artifacts',{recursive:true});const path=`artifacts/fleet-${environment}-${Date.now()}.json`;
 writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');console.log(path,receipt.pass?'PASS':'FAIL');
}
