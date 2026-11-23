---
type: plan
status: active
created: 2026-11-22
---

# Fleet Status bounded spike, issue #14

Goal: read real sidecar flight state and await its changes with resumable identity.
Constraints: G0 GO, prerequisites closed, personal corpus only, no benchmark runs.
Inputs: authenticated callers, signed sidecar events, existing D1 change feed.
Outputs: scoped flight reads, feed cursors, durable wait IDs and bounded responses.
Done when: tests and deployed real-event wakeup plus disconnect resume captured, main landed.

Decision: one Durable Object hub per tenant/namespace, persisted wait records, ingestion notification.
Alternative: client polling violates acceptance. Per-condition objects require a subscription registry.
Design decisions: 20 s call cap, 128 concurrent calls per hub, 24 h wait retention.
The cap is conservative pending the Codex transport timeout proof in #15, not a measured client limit.
Spike condition slice: flight id plus target state, or fleet change-feed repo pattern.
No job conditions: jobs are outside this issue's read slice.
Allowed edits: src/fleet.ts, src/wait.ts, src/index.ts, src/handler.ts, src/connector.ts,
tests/fleet.test.ts, scripts/fleet-sweep.mjs, docs/spike/fleet.md and this plan/research.
