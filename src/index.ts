import { DurableObject } from 'cloudflare:workers';
import { handle, type Env } from './handler';
import { connector, reconcile } from './issues';
export default { fetch: handle, scheduled: (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
  ctx.waitUntil(reconcile(env,connector,'ariaxhan/fleet-mcp',true));
} };
export class FleetWait extends DurableObject<Env> {
  async fetch(): Promise<Response> { return Response.json({ stage: 'scaffold' }); }
}
export class HandoffCoordinator extends DurableObject<Env> {
  async fetch(): Promise<Response> { return Response.json({ stage: 'scaffold' }); }
}
