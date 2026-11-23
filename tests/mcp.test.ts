import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './harness';
import { handleMcp, MCP_PROTOCOL } from '../src/mcp';
import { handle } from '../src/handler';

const headers = (token: string) => ({authorization:`Bearer ${token}`,accept:'application/json, text/event-stream','content-type':'application/json'});
test('MCP stateless negotiation, discovery, protected calls and error framing',async()=> {
  const {env,tokens}=await setup();
  const rpc=async(method:string,params?:unknown,id=1)=> {
    const r=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:headers(tokens.fleet),body:JSON.stringify({jsonrpc:'2.0',id,method,params})}),env,handle);
    return {status:r.status,headers:r.headers,body:await r.json() as any};
  };
  const init=await rpc('initialize',{protocolVersion:MCP_PROTOCOL,capabilities:{},clientInfo:{name:'fixture',version:'1'}});
  assert.equal(init.body.result.protocolVersion,MCP_PROTOCOL);
  assert.equal(init.headers.has('mcp-session-id'),false);
  const tools=await rpc('tools/list');
  assert.ok(tools.body.result.tools.some((t:any)=>t.name==='fleet_wait_for'));
  const flights=await rpc('tools/call',{name:'fleet_list_flights',arguments:{}});
  assert.equal(flights.body.result.isError,false);
  const invalid=await rpc('tools/call',{name:'fleet_get_flight',arguments:{id:123}});
  assert.equal(invalid.body.error.code,-32602);
  const missing=await rpc('tools/call',{name:'exemplar_get_doc',arguments:{name:'missing'}});
  assert.equal(missing.body.result.isError,true);
  const resource=await rpc('resources/read',{uri:'doc://missing'});
  assert.equal(resource.body.error.code,-32002);
  assert.equal((await rpc('unknown')).body.error.code,-32601);
});
test('MCP rejects foreign origins, credentials, session IDs and exposes capability-scoped discovery',async()=> {
  const {env,tokens}=await setup();
  const req=(extra:Record<string,string>,method='POST')=>new Request('https://fixture/mcp',{
    method,headers:{...headers(tokens.reader),...extra},body:method==='POST'?JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}):undefined});
  assert.equal((await handleMcp(req({origin:'https://foreign.invalid'}),env,handle)).status,403);
  assert.equal((await handleMcp(req({authorization:'Bearer invalid'}),env,handle)).status,401);
  assert.equal((await handleMcp(req({'mcp-session-id':'stale'}),env,handle)).status,404);
  assert.equal((await handleMcp(req({},'GET'),env,handle)).status,405);
  assert.equal((await handleMcp(req({'mcp-protocol-version':'unsupported'}),env,handle)).status,400);
  const listed=await (await handleMcp(req({}),env,handle)).json() as any;
  assert.ok(listed.result.tools.every((t:any)=>!t.name.startsWith('fleet_')));
});
test('initialized notification accepted, D1 cancellation aborts active dispatch',async()=> {
  const {env,tokens}=await setup();
  const req=(msg:unknown)=>new Request('https://fixture/mcp',{method:'POST',headers:headers(tokens.fleet),body:JSON.stringify(msg)});
  const initialized=await handleMcp(req({jsonrpc:'2.0',method:'notifications/initialized'}),env,handle);
  assert.equal(initialized.status,202);assert.equal(await initialized.text(),'');
  let started!:()=>void;
  const ready=new Promise<void>(r=>{started=r;});
  let aborted=false;
  const pending=handleMcp(req({jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'fleet_list_flights',arguments:{}}}),env,async(r)=> {
    started();
    return new Promise<Response>((_,reject)=>r.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('abort'));},{once:true}));
  });
  await ready;
  const cancelled=await handleMcp(req({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:7}}),env,handle);
  assert.equal(cancelled.status,202);
  assert.equal(((await (await pending).json()) as any).error.message,'Request cancelled or transport deadline reached');
  assert.equal(aborted,true);
});

test('progress token receives SSE notification then one final response',async()=> {
  const {env,tokens,db}=await setup();
  const r=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:headers(tokens.fleet),
    body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'fleet_list_flights',arguments:{},_meta:{progressToken:'progress-fixture'}}})}),env,handle);
  assert.equal(r.headers.get('content-type'),'text/event-stream');
  const messages=(await r.text()).split('\n').filter(s=>s.startsWith('data: ')).map(s=>JSON.parse(s.slice(6)));
  assert.equal(messages[0].method,'notifications/progress');
  assert.equal(messages[0].params.progressToken,'progress-fixture');
  assert.equal(messages[1].id,2);
  assert.equal(messages[1].result.isError,false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM mcp_requests').get()!.n,0);
});

test('cancellation requires the original token even inside the same namespace',async()=> {
  const {env,tokens}=await setup();
  const request=(token:string,msg:unknown)=>new Request('https://fixture/mcp',{method:'POST',headers:headers(token),body:JSON.stringify(msg)});
  let started!:()=>void,complete!:()=>void,aborted=false;
  const ready=new Promise<void>(r=>{started=r;});
  const pending=handleMcp(request(tokens.fleet,{jsonrpc:'2.0',id:'owned',method:'tools/call',params:{name:'fleet_list_flights',arguments:{}}}),env,async(r)=> {
    r.signal.addEventListener('abort',()=>{aborted=true;});
    started();
    await new Promise<void>(resolve=>{complete=resolve;});
    return Response.json({owned:true});
  });
  await ready;
  await handleMcp(request(tokens.reader,{jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'owned'}}),env,handle);
  await new Promise(r=>setTimeout(r,125));
  assert.equal(aborted,false);complete();
  assert.equal(((await (await pending).json()) as any).result.isError,false);
});
