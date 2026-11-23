import { DurableObject } from 'cloudflare:workers';
import { handle, type Env } from './handler';
import { connector, reconcile } from './issues';
import { WaitHub } from './wait';
import { RenderHub } from './render';
import { OpsGuardState, alertSweep } from './ops';
export default { fetch: handle, scheduled: (_event: ScheduledController, env: Env, ctx: ExecutionContext) => {
  ctx.waitUntil(reconcile(env,connector,'ariaxhan/fleet-mcp',true));
  ctx.waitUntil(alertSweep(env));
} };
export class FleetWait extends DurableObject<Env> {
  private hub = new WaitHub(this.ctx.storage, this.env);
  async fetch(request: Request): Promise<Response> { return this.hub.fetch(request); }
  async alarm() { await this.hub.alarm(); }
}
export class HandoffCoordinator extends DurableObject<Env> {
  async fetch(): Promise<Response> { return Response.json({ stage: 'scaffold' }); }
}

export class RenderCoordinator extends DurableObject<Env> {
  private hub = new RenderHub(this.ctx, this.env);
  async fetch(request: Request): Promise<Response> { return this.hub.fetch(request); }
  async alarm() { await this.hub.alarm(); }
}

export class OpsGuard extends DurableObject<Env> {
  private state = new OpsGuardState();
  async fetch(request: Request): Promise<Response> {
    return Response.json(this.state.handle(new URL(request.url).pathname, await request.json()));
  }
}
