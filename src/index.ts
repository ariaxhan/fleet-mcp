import { DurableObject } from 'cloudflare:workers';
import { handle, type Env } from './handler';
export default { fetch: handle };
export class FleetWait extends DurableObject<Env> {
  async fetch(): Promise<Response> { return Response.json({ stage: 'scaffold' }); }
}
export class HandoffCoordinator extends DurableObject<Env> {
  async fetch(): Promise<Response> { return Response.json({ stage: 'scaffold' }); }
}
