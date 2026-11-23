# G1 spike verdict

**Date:** 2026-11-22 PT (observations dated 2026-11-23 UTC).
**Verdict:** NO-GO for the full v1 build. G1 has not passed.
**Task:** [ariaxhan/fleet-mcp#16](https://github.com/ariaxhan/fleet-mcp/issues/16).
**Reviewed source:** `a3693207592bc57e26afbedc7ea6f856dec59afb` on main.

Assumption: a NO-GO is a completed verdict evaluation, not permission to complete the missing spike slices within this gate task. Missing proof is UNPROVEN, not an observed platform failure.

## Boundary and prerequisite

Personal-project corpus only. No excluded data, repos, issues, or MCP content was accessed. Boundary tests use synthetic excluded identifiers only. No agent benchmark, pilot, or other "with" run was performed. Preregistration and publication gates remain unchanged.

G0 passed in [the owner sign-off](g0-signoff.md), committed at `eab8f3c`; the skeleton follow-up landed at the reviewed source revision. The older PRD status line does not supersede that dated sign-off. G0 authorizes the bounded spike, not the full build.

## Evidence inventory

- Normative criteria and failure response: [execution plan Section 3.2](../execution-plan.md#32-phase-1-bounded-architecture-spike-second).
- Source inspected directly: [handler](../../src/handler.ts), [Durable Object stubs](../../src/index.ts), [scaffold tests](../../tests/worker.test.ts), [package scripts](../../package.json). There is no sidecar implementation or benchmark harness in the reviewed tree.
- Deployment limits explicitly documented in [deploy.md](../deploy.md#surfaces-and-limits): bindings and fixture reads only; MCP negotiation, Browser execution, runtime tools, and real-data reads belong to subsequent spike work.
- Historical deployed observations downloaded unmodified from [Deploy run 45095694770](https://github.com/ariaxhan/fleet-mcp/actions/runs/45095694770): [staging receipt](evidence/g1-sweep-staging.json), artifact `14783032739`; [production receipt](evidence/g1-sweep-production.json), artifact `14783815131`. Both identify the reviewed source. These are producer-generated receipts, independently inspected here, not independent platform certification.
- This attempt's direct public HTTP observations: [raw capture](g1-surface-observations.json). The edge returned HTTP 403, `error code: 1010`, on the listed routes. This is an observed access failure from this client, not proof of Worker failure or successful MCP behavior. No successful response was reconstructed.
- Dependency states were read from GitHub during this review: [#11](https://github.com/ariaxhan/fleet-mcp/issues/11), [#12](https://github.com/ariaxhan/fleet-mcp/issues/12), [#13](https://github.com/ariaxhan/fleet-mcp/issues/13), [#14](https://github.com/ariaxhan/fleet-mcp/issues/14), and [#15](https://github.com/ariaxhan/fleet-mcp/issues/15) remain open. Issue state supports scheduling only; source and raw observations determine the verdict.

## Criterion evaluation

Criterion labels below are identifiers from Section 3.2, not measured counts. UNPROVEN fails the proceed gate.

| Criterion | Evaluation and evidence | Recorded scope response and proof needed |
|---|---|---|
| 1. Codex MCP contract: tools, resources, notifications, cancellation, reconnect | **UNPROVEN.** Handler accepts only scaffold GET routes; other methods return `not_implemented`. There is no MCP transport. Historical sweeps explicitly expect `/mcp` disabled. Direct requests were edge-denied, as captured above. | Defer all agent-facing MCP behavior. #11 and #15 must supply a deployed Codex session transcript covering each contract behavior, including session handling, errors and reconnect. |
| 2. Real sidecar state, observed-at times, honest offline behavior | **UNPROVEN.** No `sidecar/` implementation exists in the reviewed source; fixture Durable Objects only return scaffold state. No real event, local probe, file-hash comparison, or offline/recovery trace is present. | Defer local-state ingestion and freshness claims. #12 and #15 must demonstrate a personal-project event reaching cloud state with timestamps, plus offline staleness and recovery without fabrication. |
| 3. Issue Context and Recall over real personal data with freshness | **UNPROVEN.** Handler has no issue or recall routes. No real read-path evidence or reconciliation capture is present. | Defer Issue Context and Recall service claims. #13 must archive real allowlisted issue and lesson reads, freshness metadata, webhook invalidation/reconciliation, query latency and store health. |
| 4. Server wait on real change without client polling, resumable wait_id | **UNPROVEN.** `FleetWait.fetch` returns scaffold state; there is no wait registration, real-event wakeup or resumable ID path. | Defer server waits. #14 and #15 must demonstrate real-event wakeup within client limits, resume across disconnect/deploy, timeout and cancellation, with server and Codex traces. |
| 5. Adversarial verification cache identity | **UNPROVEN.** There is no verification cache implementation. Scaffold tests cover liveness, disabled routes and fixture authorization, not dependency identity or stale-green refusal. | Defer verification reuse entirely. #11 and #15 must preserve adversarial records showing dependency-change misses, distinct forced-rerun records and refusal of stale green results under the PRD identity contract. |
| 6. Pinned-model Codex token capture and measured schema overhead | **UNPROVEN.** There is no pinned benchmark protocol or token instrumentation in the reviewed implementation. Existing baseline observations cannot establish capture for the future pinned model or schema set. | Defer token-saving and overhead claims. #15 and #29 must validate token field semantics and schema accounting on the exact pinned configuration. No treatment or pilot run may be used before the complete preregistration freeze in #33. |
| 7. Staging deploy/sweep and production fixture path | **PARTIAL, UNPROVEN for current independent reachability.** Archived staging and production receipts above are green for the reviewed SHA and fixed fixture namespaces. The sweep checks dependency reads and Browser binding presence only. This attempt's direct surface check was edge-denied. | Retain infrastructure-only scope. #15 must obtain an independently successful live sweep against the exact revision, preserving its receipt. Binding presence does not prove Browser startup/reuse, context cleanup, concurrency, or durable queued rendering. Preserve those platform checks before a GO. |
| 8. Pilot workload costed from measurements with a budget | **UNPROVEN.** No workload cost ledger or measured component allocation is present. Dry-run bundle size and fixture request latencies are not pilot costing. | Defer affordability and workload-budget claims. #15 must provide traceable Worker, D1, KV, R2, Durable Object, browser and upstream usage/cost accounting, allocation assumptions and a stated budget. Any treatment workload measurement waits for #33; published model prices alone do not constitute measured workload cost. |

## Decision and reopening rule

Explicit scope narrowing: retain only the infrastructure scaffold and bounded spike work. Defer the full v1 build, all unsupported runtime behaviors listed above, and all empirical benefit claims. This deferral does not remove any requirement from the commissioned full v1 acceptance matrix.

Do not start Phase 2 issues #17 through #27 on this verdict. Complete #11 through #15 in their owning lanes, preserve their raw evidence, and repeat this gate review on the resulting deployed revision. GO requires every Section 3.2 criterion proven, including independent real-surface use. Open prerequisite issues alone do not prove failure, and closing them alone cannot prove success.

The missing artifacts are recorded as evidence gaps. There is no assertion they once existed or were lost. If prior execution is later established but its capture is missing, record a data-loss failure rather than reconstructing evidence.

## Acceptance disposition

- All Section 3.2 criteria evaluated individually above with source evidence and explicit uncertainty.
- Dated NO-GO recorded here; G1 remains closed to the full build.
- Each non-passing criterion has an explicit behavior deferral and the evidence required to reconsider it.
- Local regression checks: `npm test`, `npm run typecheck`, `npm run build` passed this attempt. These establish scaffold consistency only, not platform proof or independent benchmark verification.
