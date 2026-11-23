// Read-only fleet-scoped functional usage capture. Never launches an experiment.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const token=process.env.CLOUDFLARE_API_TOKEN, account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account) throw Error('Cloudflare environment credentials required');
const start='2026-11-23T17:30:00Z',end=new Date().toISOString();
const captureName='platform-cost-usage-'+end.replace(/[:.]/g,'-')+'.json';
const cfg=readFileSync('wrangler.toml','utf8');
const out={classification:'functional-probe usage, not a pilot or efficacy measurement',captured_at:end,window:{start,end},scope:'fleet-mcp staging and production only',queries:[],settings:[],notes:[]};
const quote=JSON.stringify;
async function graphql(label,body){
 const query=`{viewer{accounts(filter:{accountTag:${quote(account)}}){${body}}}}`;
 const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({query})});
 const record={label,query:query.replace(account,'ACCOUNT_ID'),status:response.status,body:await response.json()};out.queries.push(record);return record;
}
const envs=['staging','production'].map(env=>{
 const block=cfg.split(`[env.${env}]`)[1].split(/\[env\.(?:staging|production)\]/)[0];
 return {env,script:env==='staging'?'fleet-mcp-staging':'fleet-mcp',database:/database_id = "([^"]+)"/.exec(block)[1],kv:/id = "([a-f0-9]{32})"/.exec(block)[1],bucket:/bucket_name = "([^"]+)"/.exec(block)[1]};
});
const time=`datetime_geq:${quote(start)},datetime_leq:${quote(end)}`;
for(const e of envs){
 await graphql(`${e.env}-workers`,`workersInvocationsAdaptive(limit:100,filter:{scriptName:${quote(e.script)},${time}}){sum{requests cpuTimeUs subrequests errors duration}}`);
 await graphql(`${e.env}-d1`,`d1AnalyticsAdaptiveGroups(limit:100,filter:{databaseId:${quote(e.database)},${time}}){sum{rowsRead rowsWritten readQueries writeQueries}}`);
 await graphql(`${e.env}-kv`,`kvOperationsAdaptiveGroups(limit:100,filter:{namespaceId:${quote(e.kv)},${time}}){dimensions{actionType} sum{requests objectBytes}}`);
 await graphql(`${e.env}-r2`,`r2OperationsAdaptiveGroups(limit:100,filter:{bucketName:${quote(e.bucket)},${time}}){dimensions{actionType} sum{requests responseBytes responseObjectSize}}`);
 await graphql(`${e.env}-do-invocations`,`durableObjectsInvocationsAdaptiveGroups(limit:100,filter:{scriptName:${quote(e.script)},${time}}){dimensions{namespaceId} sum{requests errors wallTime}}`);
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${e.script}/settings`,{headers:{authorization:`Bearer ${token}`}});
 const settings=await response.json();
 const bindings=settings.result?.bindings?.filter(b=>b.type==='durable_object_namespace').map(b=>({name:b.name,class_name:b.class_name,namespace_id:b.namespace_id}))??[];
 out.settings.push({env:e.env,status:response.status,durable_object_bindings:bindings,errors:settings.errors??[]});
 for(const binding of bindings){
  if(!/^[a-f0-9]{32}$/.test(binding.namespace_id??'')){out.notes.push(`${e.env} ${binding.name}: namespace ID unavailable`);continue;}
  await graphql(`${e.env}-do-${binding.name}`,`durableObjectsPeriodicGroups(limit:100,filter:{namespaceId:${quote(binding.namespace_id)},${time}}){sum{duration activeTime cpuTime rowsRead rowsWritten storageReadUnits storageWriteUnits storageDeletes subrequests}}`);
 }
}
for(const session of ['5f9809a6-110a-4362-b6f5-3640a7895f25','f9c35f55-ddae-4e29-95e6-84b623ede800']) {
 await graphql('fleet-browser-time-'+session,`browserRenderingBrowserTimeUsageAdaptiveGroups(limit:100,filter:{sessionId:${quote(session)},${time}}){dimensions{sessionId sessionStart sessionEnd} sum{totalSessionDurationMs}}`);
 await graphql('fleet-browser-binding-'+session,`browserRenderingBindingSessionsAdaptiveGroups(limit:100,filter:{sessionId:${quote(session)},${time}}){dimensions{sessionId} avg{avgConcurrentSessions} max{maxConcurrentSessions} uniq{sessionIdCount}}`);
}
writeFileSync('docs/spike/evidence/'+captureName,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.queries.map(r=>({label:r.label,status:r.status,errors:r.body.errors,data:r.body.data})),null,2));
const datasets=Object.fromEntries(out.queries.map(r=>[r.label,r.body.data?.viewer?.accounts?.[0]??null]));
function sums(labels){const result={};for(const label of labels){const dataset=datasets[label];if(!dataset)continue;for(const rows of Object.values(dataset))for(const row of rows)for(const [k,v]of Object.entries(row.sum??{}))result[k]=(result[k]??0)+v;}return result;}
const measured={workers:sums(['staging-workers','production-workers']),d1:sums(['staging-d1','production-d1']),do_invocations:sums(['staging-do-invocations','production-do-invocations']),do_periodic:sums(out.queries.filter(r=>/-do-(FLEET|HANDOFF|RENDER)/.test(r.label)).map(r=>r.label)),kv_actions:[],r2_actions:[]};
for(const [suffix,target]of [['kv','kv_actions'],['r2','r2_actions']])for(const e of envs){for(const row of Object.values(datasets[`${e.env}-${suffix}`]??{}).flat())measured[target].push({environment:e.env,...row});}
const sources={workers:'https://developers.cloudflare.com/workers/platform/pricing/',d1:'https://developers.cloudflare.com/d1/platform/pricing/',kv:'https://developers.cloudflare.com/kv/platform/pricing/',r2:'https://developers.cloudflare.com/r2/pricing/',durable_objects:'https://developers.cloudflare.com/durable-objects/platform/pricing/',browser:'https://developers.cloudflare.com/browser-run/pricing/'};
const rates={checked_at:end,units:'USD paid-plan overage list rates, no included allowance deducted',sources,workers_request_per_million:0.30,workers_cpu_ms_per_million:0.02,d1_read_per_million:0.001,d1_write_per_million:1,kv_read_per_million:0.50,r2_class_a_per_million:4.50,r2_class_b_per_million:0.36,do_request_per_million:0.15,do_gb_s_per_million:12.50,do_sql_read_per_million:0.001,do_sql_write_per_million:1,browser_hour:0.09,storage_gb_month:{d1:0.75,kv:0.50,r2:0.015,durable_objects_sql:0.20},account_subscription_month:5};
const design={future_task_executions:20,functional_baskets_per_execution:1,browser_sessions_per_execution:2,browser_seconds_per_session:60,retained_gb_month_per_store:1,incremental_infrastructure_budget_target_usd:25,account_subscription_allocation_months:1,concurrent_browsers_cap:1};
const n=design.future_task_executions;
const actionCount=(list,actions)=>list.filter(r=>actions.includes(r.dimensions.actionType)).reduce((a,r)=>a+r.sum.requests,0);
const projected={workers_requests:measured.workers.requests*n,workers_cpu_ms:measured.workers.cpuTimeUs/1000*n,d1_rows_read:measured.d1.rowsRead*n,d1_rows_written:measured.d1.rowsWritten*n,kv_reads:actionCount(measured.kv_actions,['read'])*n,r2_class_a:actionCount(measured.r2_actions,['PutObject'])*n,r2_class_b:actionCount(measured.r2_actions,['GetObject','HeadObject','HeadBucket'])*n,do_requests:measured.do_invocations.requests*n,do_gb_s:measured.do_periodic.duration*n,do_rows_read:measured.do_periodic.rowsRead*n,do_rows_written:measured.do_periodic.rowsWritten*n,browser_hours:n*design.browser_sessions_per_execution*design.browser_seconds_per_session/3600};
const allocated={workers_requests:projected.workers_requests/1e6*rates.workers_request_per_million,workers_cpu:projected.workers_cpu_ms/1e6*rates.workers_cpu_ms_per_million,d1_reads:projected.d1_rows_read/1e6*rates.d1_read_per_million,d1_writes:projected.d1_rows_written/1e6*rates.d1_write_per_million,kv_reads:projected.kv_reads/1e6*rates.kv_read_per_million,r2_class_a:projected.r2_class_a/1e6*rates.r2_class_a_per_million,r2_class_b:projected.r2_class_b/1e6*rates.r2_class_b_per_million,do_requests:projected.do_requests/1e6*rates.do_request_per_million,do_duration:projected.do_gb_s/1e6*rates.do_gb_s_per_million,do_reads:projected.do_rows_read/1e6*rates.do_sql_read_per_million,do_writes:projected.do_rows_written/1e6*rates.do_sql_write_per_million,browser:projected.browser_hours*rates.browser_hour,storage:Object.values(rates.storage_gb_month).reduce((a,b)=>a+b)*design.retained_gb_month_per_store,subscription:rates.account_subscription_month};
const projection={classification:'planning scenario only, no pilot executed, no spend authorization',raw_source:captureName,measured,rates,design,projected_units:projected,linear_allocated_usd:allocated,linear_allocated_total_usd:Object.values(allocated).reduce((a,b)=>a+b),limitations:['Adaptive analytics are a lagging capture, not a billing invoice or complete accounting.','Empty browser-session and render-namespace series are unavailable, not measured zero.','Future task work may differ from the functional basket; scenario does not prove an upper bound.','Browser time and storage are design assumptions, not measurements.','DO and R2 billing-unit rounding can exceed proportional allocation. Account-wide allowances were not inspected.','GitHub-specific upstream counts and model/Studio costs are UNPROVEN and excluded.','Budget is a design target, not user approval or a platform limit.']};
// Cost a defined future replay of functional baskets, not an agent efficacy task.
const renderSources=['docs/spike/evidence/render-pending.json','docs/spike/evidence/render-staging-1795455981015.json'];
const renderMeasurements=renderSources.map(path=>{
 const bytes=readFileSync(path),receipt=JSON.parse(bytes);
 const complete=[...new Map(receipt.observations.filter(o=>o.body?.state==='complete').map(o=>[o.id,o.body])).values()];
 const records=complete.map(r=>({id:r.id,session_id:r.session_id,started_at:r.started_at,completed_at:r.completed_at,active_ms:Date.parse(r.completed_at)-Date.parse(r.started_at)}));
 return {source:path,sha256:createHash('sha256').update(bytes).digest('hex'),records,active_sum_ms:records.reduce((a,b)=>a+b.active_ms,0)};
});
writeFileSync('docs/spike/evidence/platform-cost-render-timings.json',JSON.stringify(renderMeasurements,null,2)+'\n');
const browserRows=out.queries.filter(r=>r.label.startsWith('fleet-browser-time-')).flatMap(r=>Object.values(r.body.data?.viewer?.accounts?.[0]??{}).flat());
projection.measured.browser_sessions=browserRows;
projection.measured.render_active_sources='platform-cost-render-timings.json';
projection.measured.render_max_basket_active_ms=Math.max(...renderMeasurements.map(r=>r.active_sum_ms));
projection.design.browser_idle_reserve_s=60;
projection.design.browser_deadline_reserve_s=30;
projection.design.reserve_source='src/render.ts RENDER_IDLE_MS and RENDER_TIMEOUT_MS';
projection.design.browser_seconds_per_session=Math.max(...browserRows.map(r=>r.sum.totalSessionDurationMs/1000),projection.measured.render_max_basket_active_ms/1000+projection.design.browser_idle_reserve_s+projection.design.browser_deadline_reserve_s);
projection.design.render_do_memory_gb=0.128; // Planning memory allocation, consistent with observed duration/active time.
projection.design.render_do_reserved_seconds_per_execution=2*projection.design.browser_deadline_reserve_s+projection.design.browser_idle_reserve_s;
projection.projected_units.browser_hours=n*projection.design.browser_sessions_per_execution*projection.design.browser_seconds_per_session/3600;
projection.projected_units.do_gb_s+=n*projection.design.render_do_reserved_seconds_per_execution*projection.design.render_do_memory_gb;
projection.linear_allocated_usd.browser=projection.projected_units.browser_hours*rates.browser_hour;
projection.linear_allocated_usd.do_duration=projection.projected_units.do_gb_s/1e6*rates.do_gb_s_per_million;
const calibration=JSON.parse(readFileSync('docs/spike/evidence/token-calibration-metadata.json'));
const usage=calibration.find(r=>r.type==='token_count').info.total_token_usage;
const model={id:'gpt-6.1-sol',source:'token-calibration-metadata.json',rates_source:'https://developers.openai.com/api/docs/models/gpt-6.1-sol',input_usd_per_million:2,cached_input_usd_per_million:0.10,output_usd_per_million:10,fast_multiplier:2,usage,uncached_input_tokens:usage.input_tokens-usage.cached_input_tokens};
model.standard_calibration_cost_usd=(model.uncached_input_tokens*model.input_usd_per_million+usage.cached_input_tokens*model.cached_input_usd_per_million+usage.output_tokens*model.output_usd_per_million)/1e6;
projection.model=model;
projection.design.calibration_requests_per_execution=1;
projection.design.model_cost_basis='API-equivalent Fast list rates, not subscription invoice attribution';
projection.linear_allocated_usd.model=n*projection.design.calibration_requests_per_execution*model.standard_calibration_cost_usd*model.fast_multiplier;
projection.design.upstream_api_reserve_usd=1;
projection.design.upstream_call_budget=measured.workers.subrequests*n;
projection.design.upstream_basis='Treat every Worker subrequest as an upstream API call for throughput planning; not an attributed GitHub count. Existing GitHub REST integration requires no additional metered service provisioned by this forecast.';
projection.design.upstream_rate_source='https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api';
projection.linear_allocated_usd.upstream_reserve=projection.design.upstream_api_reserve_usd;
projection.linear_allocated_total_usd=Object.values(projection.linear_allocated_usd).reduce((a,b)=>a+b);
// R2 and DO documented invoice-unit rounding is shown as a reserve, without shared allowances.
const roundup=(units,rate)=>units>0?Math.ceil(units/1e6)*rate:0;
projection.rounding_adjusted_scenario_usd=projection.linear_allocated_total_usd
-projection.linear_allocated_usd.r2_class_a-projection.linear_allocated_usd.r2_class_b-projection.linear_allocated_usd.do_requests-projection.linear_allocated_usd.do_duration
+roundup(projection.projected_units.r2_class_a,rates.r2_class_a_per_million)+roundup(projection.projected_units.r2_class_b,rates.r2_class_b_per_million)+roundup(projection.projected_units.do_requests,rates.do_request_per_million)+roundup(projection.projected_units.do_gb_s,rates.do_gb_s_per_million);
projection.design.browser_concurrency_extra_browser_month_reserve=1;
projection.design.browser_extra_concurrent_browser_month_usd=2;
projection.rounding_adjusted_scenario_usd+=projection.design.browser_concurrency_extra_browser_month_reserve*projection.design.browser_extra_concurrent_browser_month_usd;
projection.design.total_budget_target_usd=30;
projection.design.incremental_infrastructure_budget_target_usd=25;
projection.limitations=['Projection of a defined functional workload, not a measured pilot or billed invoice.','Browser duration measured for the older exact fleet session; newer exact session and RenderHub periodic series may lag. Explicit code-derived reserves cover these in the scenario.','Future task workloads may differ; measured active render time is not a billed-session lower bound or upper bound.','Storage retention volume, upstream reserve and concurrency cap are design assumptions. No account-wide allowance inspection.','API-equivalent model allocation uses actual calibration tokens and Fast list rates; the Codex subscription invoice is not inferred.','Total budget is a stated planning target. No experiment or additional spending was initiated.'];
writeFileSync('docs/spike/evidence/platform-cost-projection.json',JSON.stringify(projection,null,2)+'\n');
