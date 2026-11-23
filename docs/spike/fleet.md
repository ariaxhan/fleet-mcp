# Fleet Status and bounded wait spike (#14)

G0 GO in docs/gates/g0-signoff.md. Prior attempt stopped because core and sidecar
were absent. Prerequisites #11 and #12 now closed and implemented on main.
Personal-project corpus only. No benchmark or pilot run, freeze, or result publication.

## Interface

All routes require `fleet:read`, existing caller authentication and fail-closed audit.
- GET `/v1/fleet/get?id=MACHINE:ATTEMPT`: `fleet_get_flight`.
- GET `/v1/fleet/list?state=done&limit=50`: `fleet_list_flights`.
- GET `/v1/fleet/changes?cursor=CURSOR`: `fleet_what_changed_since`.
- POST `/v1/fleet/wait`: `fleet_wait_for`.

Flight IDs combine the reporting machine ID with runner attempt ID. State is the
latest original observation, with feed sequence breaking ties. Unknown worker progress
is null. Original observation times and connector staleness remain visible.
The feed includes issue events only for callers holding `issue:read`.
Bootstrap captures the head before listing, so concurrent changes cannot be skipped.

Wait request: `{ "condition": { "flight_id": "MACHINE:ATTEMPT", "state": "done" }, "timeout_s": 20 }`,
or `{ "condition": { "repo": "ariaxhan/fleet-mcp" }, "timeout_s": 0 }` for a future fleet event.
Response: `met`, `final_state`, `waited_s`, `wait_id`, `next_cursor`.
A zero-length registration returns an ID immediately. Resume with
`{ "wait_id": "UUID", "timeout_s": 20 }`. Disconnect ends a call, not registration.
The condition and original feed boundary persist in Durable Object storage. Resume
finds a matching event between calls, including one superseded by a later transition.
An already-satisfied flight target returns immediately. Job waits are outside this slice.

Design decisions in src/wait.ts: call cap 20 s, retention 24 h, active-call cap 128,
stored registration cap 1024 per hub. Expired IDs return 410 until alarm cleanup,
then 404. Capacity returns 429. IDs and cursors bind to caller and current policy.
Ingestion commits D1 before notifying the namespace hub. Duplicate sidecar retries
repeat notification after a failed delivery. No client or server state polling.

## Verification

`npm test`, `npm run typecheck`, `npm run build` are producer checks.
Deploy using docs/deploy.md. Functional capture:
`node scripts/fleet-sweep.mjs staging SHA` (or production).
This issues a scoped token via the existing credential manager and issue-token script,
reads real fleet state, registers bounded waits, disconnects and resumes, and invokes
the existing signed sidecar collector. Raw receipts go to `artifacts/fleet-ENV-TIME.json`.
No runner event is inserted or fabricated. A missing real new event fails the capture.
MCP transport negotiation and measured Codex tool timeout proof remain #15. This
HTTP slice and its conservative cap do not establish that separate G1 criterion.
Independent runner/owner surface verification remains required before issue closure.

## This attempt's receipts

Functional HTTP surface receipts, produced and inspected by this implementing lane:
- [Staging pass](evidence/fleet-staging-1795399962135.json): disconnect, resumed ID,
  signed real sidecar ingestion, server wake, reads and feed delta.
- [Initial production failure](evidence/fleet-production-1795399974908.json): no
  flights because the production sidecar was not enrolled. No state was reconstructed.
- [Production pass after enrollment](evidence/fleet-production-1795400008875.json):
  the same functional path, driven by the collector's real runner observations.
- [Production bounded call](evidence/fleet-production-bounded.json): requested cap
  returned `met: false` before the capture client's deadline. Exact timings and
  configured timeout thresholds are in that raw receipt.

These captures exercised deployed Worker commit `137cd0f6625f09687453769d0875b626736f8d7e`.
The subsequent invalid-payload guard is locally regression-checked and deployed again.
Subagent review was attempted but unavailable (collaboration thread-store error).
Independent acceptance and actual Codex MCP timeout proof remain UNPROVEN here;
the owning chat and #15 must supply those receipts. No G1 GO is asserted.
