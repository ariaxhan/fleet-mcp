#!/usr/bin/env python3
"""Bounded functional probe through the installed Codex app-server MCP manager."""
import asyncio, datetime, json, os, pathlib, shutil, subprocess, tempfile, time, sys, signal
ROOT=pathlib.Path(__file__).resolve().parents[1]
MODE=sys.argv[1] if len(sys.argv)>1 else 'initial'
OUTPUT=ROOT/f'docs/spike/evidence/codex-contract-{MODE}-{time.time_ns()}.json'
async def main():
 token=subprocess.check_output(['security','find-generic-password','-s','fleet-mcp-platform-token-staging','-w'],text=True).strip()
 events=[]; seq=0; replies={}; notifications=asyncio.Queue()
 def capture(direction,message):
  raw=json.dumps(message,ensure_ascii=False).replace(token,'[REDACTED]')
  events.append({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'direction':direction,'message':json.loads(raw)})
 with tempfile.TemporaryDirectory(prefix='fleet-codex-contract-',ignore_cleanup_errors=True) as home:
  pathlib.Path(home,'config.toml').write_text('model = "gpt-6.1-sol"\nmodel_reasoning_effort = "low"\n[mcp_servers.fleet]\nurl = "https://staging-mcp.ariaxhan.com/mcp"\nbearer_token_env_var = "FLEET_PROBE_TOKEN"\ndefault_tools_approval_mode = "approve"\ntool_timeout_sec = 30\n')
  if MODE=='client-timeout':
   cfg=pathlib.Path(home,'config.toml');cfg.write_text(cfg.read_text().replace('tool_timeout_sec = 30','tool_timeout_sec = 2'))
  if MODE=='interrupt':
   auth=pathlib.Path(os.path.expanduser('~/.codex/auth.json'))
   if auth.exists():shutil.copyfile(auth,pathlib.Path(home,'auth.json'))
  env={**os.environ,'CODEX_HOME':home,'FLEET_PROBE_TOKEN':token,'RUST_LOG':'rmcp=trace,codex_rmcp_client=trace'}
  proc=await asyncio.create_subprocess_exec(shutil.which('codex'),'app-server','--stdio','--disable','plugins','--disable','apps',stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE,env=env,start_new_session=True,limit=4*1024*1024)
  async def read(stream,direction):
   while line:=await stream.readline():
    text=line.decode(errors='replace').rstrip()
    try: msg=json.loads(text)
    except ValueError: capture(direction,{'text':text});continue
    capture(direction,msg)
    if direction=='stdout' and 'id' in msg and msg['id'] in replies: replies.pop(msg['id']).set_result(msg)
    elif direction=='stdout': await notifications.put(msg)
  tasks=[asyncio.create_task(read(proc.stdout,'stdout')),asyncio.create_task(read(proc.stderr,'stderr'))]
  async def send(method,params,notify=False):
   nonlocal seq
   msg={'method':method,'params':params}
   if not notify: seq+=1;msg['id']=seq; future=asyncio.get_running_loop().create_future();replies[seq]=future
   capture('stdin',msg);proc.stdin.write((json.dumps(msg)+'\n').encode());await proc.stdin.drain()
   return None if notify else await asyncio.wait_for(future,60)
  outcome={}
  try:
   outcome['initialize']=await send('initialize',{'clientInfo':{'name':'fleet-functional-probe','version':'1'},'capabilities':{'experimentalApi':True}})
   await send('initialized',{},True)
   thread=await send('thread/start',{'model':'gpt-6.1-sol','cwd':home,'approvalPolicy':'never','sandbox':'read-only','ephemeral':True})
   outcome['thread']=thread
   thread_id=thread['result']['thread']['id']
   async def call(tool,args,meta=None):
    p={'threadId':thread_id,'server':'fleet','tool':tool,'arguments':args}
    if meta is not None:p['_meta']=meta
    return await send('mcpServer/tool/call',p)
   outcome['list']=await call('fleet_list_flights',{})
   if MODE=='interrupt':
    turn=await send('turn/start',{'threadId':thread_id,'model':'gpt-6.1-sol','effort':'low','input':[{'type':'text','text':'Functional synthetic platform probe only. Immediately call fleet_wait_for with condition {flight_id: "synthetic-no-such-flight-for-cancellation", state: "done"} and timeout_s 20. Use fleet MCP only. Do not read files, run commands, search, or use any other server. After tool returns say done.'}]})
    outcome['turn_start']=turn
    deadline=time.monotonic()+50
    while time.monotonic()<deadline:
     event=await asyncio.wait_for(notifications.get(),max(0.1,deadline-time.monotonic()))
     item=event.get('params',{}).get('item',{})
     if event.get('method')=='item/started' and item.get('type')=='mcpToolCall':
      await asyncio.sleep(1)
      outcome['interrupt']=await send('turn/interrupt',{'threadId':thread_id,'turnId':turn['result']['turn']['id']})
      print(json.dumps({'phase':'interrupt_sent','thread_id':thread_id,'hold_s_design_decision':8}),flush=True)
      await asyncio.sleep(8)
      break
    else:outcome['interrupt_failure']='no MCP tool started'
    return
   args={'condition':{'repo':'ariaxhan/fleet-mcp'},'timeout_s':20 if MODE=='client-timeout' else 1}
   if MODE=='reconnect': args={'wait_id':sys.argv[2],'timeout_s':1}
   outcome['wait_timeout']=await call('fleet_wait_for',args,{'progressToken':'codex-functional-progress'})
   print(json.dumps({'phase':'wait_timeout','result':outcome['wait_timeout']}),flush=True)
  except Exception as exc: outcome['failure']={'type':type(exc).__name__,'message':str(exc)}
  finally:
   os.killpg(proc.pid,signal.SIGTERM)
   try:await asyncio.wait_for(proc.wait(),5)
   except asyncio.TimeoutError:proc.kill();await proc.wait()
   try:await asyncio.wait_for(asyncio.gather(*tasks,return_exceptions=True),3)
   except asyncio.TimeoutError:
    for task in tasks:task.cancel()
    capture('driver',{'failure':'reader shutdown timeout; partial logs retained'})
   OUTPUT.write_text(json.dumps({'kind':'functional_probe_not_benchmark','client_version':subprocess.check_output(['codex','--version'],text=True).strip(),'model_design_decision':'gpt-6.1-sol','reasoning_design_decision':'low','endpoint':'https://staging-mcp.ariaxhan.com/mcp','outcome':outcome,'events':events},indent=2)+'\n')
   print(json.dumps({'evidence':str(OUTPUT),'failure':outcome.get('failure')}),flush=True)
asyncio.run(main())
