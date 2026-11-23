import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './harness';
import { handleMcp, MCP_PROTOCOL } from '../src/mcp';
import { handle } from '../src/handler';

const headers = (token: string) => ({authorization:`Bearer ${token}`,accept:'application/json, text/event-stream','content-type':'application/json'});
async function sessionHeaders(env: Parameters<typeof handleMcp>[1],token: string) {
  const r=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:headers(token),
    body:JSON.stringify({jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:MCP_PROTOCOL}})}),env,handle);
  assert.equal(r.status,200);
  return {...headers(token),'mcp-session-id':r.headers.get('mcp-session-id')!};
}
test('MCP session negotiation, discovery, protected calls and error framing',async()=> {
  const {env,tokens}=await setup();
  const h=await sessionHeaders(env,tokens.fleet);
  const rpc=async(method:string,params?:unknown,id=1)=> {
    const r=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:method==='initialize'?headers(tokens.fleet):h,body:JSON.stringify({jsonrpc:'2.0',id,method,params})}),env,handle);
    return {status:r.status,headers:r.headers,body:await r.json() as any};
  };
  const init=await rpc('initialize',{protocolVersion:MCP_PROTOCOL,capabilities:{},clientInfo:{name:'fixture',version:'1'}});
  assert.equal(init.body.result.protocolVersion,MCP_PROTOCOL);
  assert.equal(init.headers.has('mcp-session-id'),true);
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
  const h=await sessionHeaders(env,tokens.fleet);
  const readerHeaders=await sessionHeaders(env,tokens.reader);
  const req=(extra:Record<string,string>,method='POST')=>new Request('https://fixture/mcp',{
    method,headers:{...readerHeaders,...extra},body:method==='POST'?JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}):undefined});
  assert.equal((await handleMcp(req({origin:'https://foreign.invalid'}),env,handle)).status,403);
  assert.equal((await handleMcp(req({authorization:'Bearer invalid'}),env,handle)).status,401);
  assert.equal((await handleMcp(req({'mcp-session-id':'stale'}),env,handle)).status,404);
  assert.equal((await handleMcp(req({},'GET'),env,handle)).status,405);
  assert.equal((await handleMcp(req({'mcp-protocol-version':'unsupported'}),env,handle)).status,400);
  const listed=await (await handleMcp(req({}),env,handle)).json() as any;
  assert.deepEqual(listed.result.tools.map((t:any)=>t.name),['exemplar_get_doc','doc_what_changed']);
   assert.ok(listed.result.tools.every((t:any)=>t.annotations.readOnlyHint===true));
});
test('initialized notification accepted, D1 cancellation aborts active dispatch',async()=> {
  const {env,tokens}=await setup();
  const h=await sessionHeaders(env,tokens.fleet);
  const req=(msg:unknown)=>new Request('https://fixture/mcp',{method:'POST',headers:h,body:JSON.stringify(msg)});
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
  const h=await sessionHeaders(env,tokens.fleet);
  const r=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:h,
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
  const h=await sessionHeaders(env,tokens.fleet);
  const sessionByToken:Record<string,Record<string,string>>={[tokens.fleet]:h,[tokens.reader]:await sessionHeaders(env,tokens.reader)};
  const request=(token:string,msg:unknown)=>new Request('https://fixture/mcp',{method:'POST',headers:sessionByToken[token],body:JSON.stringify(msg)});
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

test('separate client sessions isolate identical active request IDs and session lifecycle',async()=> {
  const {env,tokens,db}=await setup();
  const a=await sessionHeaders(env,tokens.fleet),b=await sessionHeaders(env,tokens.fleet);
  const req=(h:Record<string,string>,method:string,id=7)=>new Request('https://fixture/mcp',{method:'POST',headers:h,
    body:JSON.stringify({jsonrpc:'2.0',id,method,params:{name:'fleet_list_flights',arguments:{}}})});
  let finish!:()=>void,started!:()=>void;
  const ready=new Promise<void>(resolve=>{started=resolve;});
  const pending=handleMcp(req(a,'tools/call'),env,async()=> {
    started();await new Promise<void>(resolve=>{finish=resolve;});return Response.json({first:true});
  });
  await ready;
  const other=await handleMcp(req(b,'tools/call'),env,handle);
  assert.equal(((await other.json()) as any).result.isError,false);
  finish();await pending;
  assert.equal((await handleMcp(req({...a,authorization:`Bearer ${tokens.reader}`},'ping'),env,handle)).status,404);
  db.prepare('UPDATE mcp_sessions SET expires_at = 0 WHERE session_id = ?').run(a['mcp-session-id']);
  assert.equal((await handleMcp(req(a,'ping'),env,handle)).status,404);
  assert.equal((await handleMcp(new Request('https://fixture/mcp',{method:'DELETE',headers:b}),env,handle)).status,200);
  assert.equal((await handleMcp(req(b,'ping'),env,handle)).status,404);
  assert.equal((await handleMcp(req(headers(tokens.fleet),'ping'),env,handle)).status,400);
});

test('SSE disconnect aborts current observation without deleting transport session',async()=> {
  const {env,tokens}=await setup();const h=await sessionHeaders(env,tokens.fleet);
  let aborted=false;
  const response=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:h,
    body:JSON.stringify({jsonrpc:'2.0',id:8,method:'tools/call',params:{name:'fleet_list_flights',arguments:{},_meta:{progressToken:1}}})}),env,async(r)=>new Promise<Response>((_,reject)=> {
      r.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('abort'));},{once:true});
    }));
  await response.body!.cancel();assert.equal(aborted,true);
  const ping=await handleMcp(new Request('https://fixture/mcp',{method:'POST',headers:h,body:JSON.stringify({jsonrpc:'2.0',id:9,method:'ping'})}),env,handle);
  assert.equal(ping.status,200);
});
