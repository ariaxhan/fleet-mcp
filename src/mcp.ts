import type { Env } from './handler';
import { authenticate, type Caller } from './auth';

// Stateless Streamable HTTP spike. Reconnect resumes application wait_id, not an MCP session.
// JSON replies need no SSE replay store. GET and DELETE are explicitly unsupported.
export const MCP_PROTOCOL = '2025-06-18';
type Dispatch = (request: Request, env: Env) => Promise<Response>;
type Props = Record<string, { type: string; description?: string }>;
const string = { type: 'string' }, number = { type: 'number' }, boolean = { type: 'boolean' };
const tool = (name: string, path: string, capability: string, properties: Props, required: string[] = [], post = false) =>
  ({ name, path, capability, post, description: `Personal-project ${name}. Uses the protected HTTP route and its authorization, freshness and audit rules.`,
    inputSchema: { type: 'object', properties, required, additionalProperties: false } });
const freshness = { max_age_s: number, allow_stale: boolean, consistency: string };
export const MCP_TOOLS = [
  tool('exemplar_get_doc','/v1/docs/get','context:read',{name:string,version:number,since_version:number,...freshness},['name']),
  tool('doc_what_changed','/v1/changes','context:read',{cursor:string}),
  tool('issue_get','/v1/issues/get','context:read',{repo:string,number:number,include_comments:boolean,since_version:number,...freshness},['repo','number']),
  tool('issue_list','/v1/issues/list','context:read',{repo:string,state:string,...freshness},['repo']),
  tool('recall_query','/v1/recall/query','context:read',{query:string,kinds:string,limit:number,...freshness},['query']),
  tool('recall_store_health','/v1/recall/health','context:read',{...freshness}),
  tool('fleet_get_flight','/v1/fleet/get','fleet:read',{id:string},['id']),
  tool('fleet_list_flights','/v1/fleet/list','fleet:read',{state:string,limit:number}),
  tool('fleet_what_changed_since','/v1/fleet/changes','fleet:read',{cursor:string}),
  tool('fleet_wait_for','/v1/fleet/wait','fleet:read',{wait_id:string,timeout_s:number,condition:{type:'object'}},[],true),
];
const object = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const reply = (value: unknown, status = 200) => Response.json(value,{status,headers:{'cache-control':'no-store'}});
const error = (id: unknown, code: number, message: string) => ({jsonrpc:'2.0',id,error:{code,message}});
const result = (id: unknown, value: unknown) => ({jsonrpc:'2.0',id,result:value});
const key = (c: Caller, id: unknown) => JSON.stringify([c.tokenId,c.tenantId,c.namespaceId,typeof id,id]);
function validArgs(t: typeof MCP_TOOLS[number], args: unknown): args is Record<string, unknown> {
  if(!object(args) || t.inputSchema.required.some(k=>!(k in args))) return false;
  return Object.entries(args).every(([k,v])=> {
    const schema=t.inputSchema.properties[k];
    return schema && (schema.type==='object' ? object(v) : typeof v===schema.type)
      && (typeof v!=='number' || Number.isFinite(v));
  });
}
async function invoke(request: Request, env: Env, dispatch: Dispatch, t: typeof MCP_TOOLS[number], args: Record<string,unknown>, signal?: AbortSignal) {
  const url=new URL(t.path,request.url),headers=new Headers();
  headers.set('authorization',request.headers.get('authorization')??'');
  if(!t.post) for(const [k,v] of Object.entries(args)) url.searchParams.set(k,String(v));
  else headers.set('content-type','application/json');
  return dispatch(new Request(url,{method:t.post?'POST':'GET',headers,body:t.post?JSON.stringify(args):undefined,signal}),env);
}

/** All corpus access passes through the existing protected routes, including resources. */
export async function handleMcp(request: Request, env: Env, dispatch: Dispatch): Promise<Response> {
  const protocol=request.headers.get('mcp-protocol-version');
  if(protocol && protocol!==MCP_PROTOCOL && protocol!=='2025-03-26') return reply({error:'unsupported_protocol_version'},400);
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) return reply({error:'invalid_origin'},403);
  let caller: Caller|null;
  try { caller=await authenticate(request,env,new Date()); }
  catch { return reply({error:'policy_unavailable'},503); }
  if(!caller) return reply({error:'unauthorized'},401);
  // This spike has no persistent transport sessions. A stale session must reinitialize.
  if(request.headers.has('mcp-session-id')) return reply({error:'session_not_found'},404);
  if(request.method!=='POST') return new Response(null,{status:405,headers:{allow:'POST'}});
  const accept=request.headers.get('accept')??'';
  if(!accept.includes('application/json') || !accept.includes('text/event-stream')) return reply({error:'not_acceptable'},406);
  if(!request.headers.get('content-type')?.includes('application/json')) return reply({error:'unsupported_media_type'},415);
  // Design decision: bounded request bodies, not a measured platform limit.
  const text=await request.text();
  if(new TextEncoder().encode(text).byteLength>65536) return reply({error:'request_too_large'},413);
  let msg: any;
  try { msg=JSON.parse(text); } catch { return reply(error(null,-32700,'Parse error'),400); }
  if(!object(msg)||msg.jsonrpc!=='2.0'||typeof msg.method!=='string'||
    ('id' in msg && typeof msg.id!=='string' && typeof msg.id!=='number') ||
    (msg.params!==undefined&&!object(msg.params))) return reply(error(null,-32600,'Invalid Request'),400);
  if(!('id' in msg)) {
    if(msg.method==='notifications/cancelled') {
      try { await env.DB.prepare('UPDATE mcp_requests SET cancelled = 1 WHERE request_key = ?').bind(key(caller,msg.params?.requestId)).run(); }
      catch { return reply({error:'cancellation_unavailable'},503); }
    }
    return new Response(null,{status:202});
  }
  const id=msg.id,params=msg.params??{},allowed=MCP_TOOLS.filter(t=>caller!.capabilities.includes(t.capability));
  if(msg.method==='initialize') return reply(result(id,{protocolVersion:MCP_PROTOCOL,
    capabilities:{tools:{listChanged:false},resources:{subscribe:false,listChanged:false}},
    serverInfo:{name:'fleet-mcp-spike',version:'0.1.0'},
    instructions:'Bounded personal-project spike. Stateless transport; reconnect fleet_wait_for using wait_id. Cancellation aborts the current call; saved wait_id remains resumable.'}));
  if(msg.method==='ping') return reply(result(id,{}));
  if(msg.method==='tools/list') return reply(result(id,{tools:allowed.map(({name,description,inputSchema})=>({name,description,inputSchema}))}));
  if(msg.method==='resources/list') return reply(result(id,{resources:[]}));
  if(msg.method==='resources/templates/list') return reply(result(id,{resourceTemplates:caller.capabilities.includes('context:read')?
    [{uriTemplate:'doc://{name}',name:'Canonical personal-project document',mimeType:'application/json'}]:[]}));
  if(msg.method==='resources/read') {
    if(typeof params.uri!=='string'||!params.uri.startsWith('doc://')||!caller.capabilities.includes('context:read'))
      return reply(error(id,-32602,'Unsupported resource'));
    let name: string;
    try { name=decodeURIComponent(params.uri.slice(6)); } catch { return reply(error(id,-32602,'Invalid resource URI')); }
    const response=await invoke(request,env,dispatch,MCP_TOOLS[0],{name});
    if(!response.ok) return reply(error(id,-32002,`Resource read failed (${response.status})`));
    return reply(result(id,{contents:[{uri:params.uri,mimeType:'application/json',text:await response.text()}]}));
  }
  if(msg.method!=='tools/call') return reply(error(id,-32601,'Method not found'));
  const t=allowed.find(t=>t.name===params.name),args=params.arguments??{};
  if(!t||!validArgs(t,args)) return reply(error(id,-32602,'Invalid tool or arguments'));
  const k=key(caller,id),generation=crypto.randomUUID();
  // Design decisions: active-call TTL and polling interval, not measured client limits.
  const ttlMs=120000,pollMs=100;
  try {
    await env.DB.prepare('DELETE FROM mcp_requests WHERE expires_at < ?').bind(Date.now()).run();
    await env.DB.prepare('INSERT INTO mcp_requests (request_key, generation, cancelled, expires_at) VALUES (?, ?, 0, ?)')
      .bind(k,generation,Date.now()+ttlMs).run();
  } catch { return reply(error(id,-32000,'Request registration unavailable or duplicate active ID')); }
  const controller=new AbortController();
  const execute=async()=> {
    let timer:ReturnType<typeof setTimeout>|undefined,finished=false;
    const cancelled=new Promise<never>((_,reject)=> {
      controller.signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});
      const check=async()=> {
        try {
          const row=await env.DB.prepare('SELECT cancelled FROM mcp_requests WHERE request_key = ? AND generation = ?')
            .bind(k,generation).first<{cancelled:number}>();
          if(!row || row.cancelled || Date.now()>=deadline) controller.abort();
        } catch { controller.abort(); }
        if(!finished&&!controller.signal.aborted) timer=setTimeout(check,pollMs);
      };
      timer=setTimeout(check,pollMs);
    });
    const deadline=Date.now()+ttlMs;
    try {
      const response=await Promise.race([invoke(request,env,dispatch,t,args,controller.signal),cancelled]);
      const text=await Promise.race([response.text(),cancelled]);
      return result(id,{content:[{type:'text',text}],isError:!response.ok});
    } catch {
      return error(id,-32000,controller.signal.aborted?'Request cancelled or transport deadline reached':'Tool execution failed');
    } finally {
      finished=true;if(timer) clearTimeout(timer);
      await env.DB.prepare('DELETE FROM mcp_requests WHERE request_key = ? AND generation = ?').bind(k,generation).run();
    }
  };
  const progressToken=params._meta?.progressToken;
  if(typeof progressToken==='string'||typeof progressToken==='number') {
    const encoder=new TextEncoder();
    const stream=new ReadableStream<Uint8Array>({start(stream) {
      const emit=(msg:unknown)=>stream.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(msg)}\n\n`));
      emit({jsonrpc:'2.0',method:'notifications/progress',params:{progressToken,progress:0,total:1}});
      void execute().then(value=> {
        try { emit(value);stream.close(); } catch { /* Disconnect does not cancel durable application waits. */ }
      }).catch(()=> { try { stream.error(new Error('Transport failed')); } catch {} });
    }});
    return new Response(stream,{headers:{'content-type':'text/event-stream','cache-control':'no-store'}});
  }
  return reply(await execute());
}
