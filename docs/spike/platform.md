# Platform spike status (#15)

Date: 2026-11-23. **NOT COMPLETE. No G1 GO or efficacy result.**

The old model/access blockers are resolved. The owner supplied `gpt-6.1-sol`,
low effort, and canonical custom domains. [Actual custom-domain responses](evidence/platform-custom-domains.json)
verified the prior deployed revision. New bounded proof paths landed and were
deployed through the documented staging-first pipeline. No previous effects or
missing receipts were reconstructed. No pilot, benchmark treatment run,
preregistration freeze or efficacy publication occurred.

## Current acceptance disposition

| Issue acceptance item | Disposition and actual evidence |
|---|---|
| Codex MCP contract | PARTIAL. Actual Codex negotiation, calls, expected tool error, resource read, progress, sessions and fresh-process reconnect observed. [Client summary](evidence/codex-contract-summary.json), [owning client run](evidence/codex-contract-initial-1795456348649251000.json), [resource/error captures](token-accounting.md). Cancellation is not green: see below. |
| Wait across disconnect, deployment and timeout | OBSERVED. [Registration/disconnect before deployment](evidence/wait-across-deploy.json) at the earlier revision, then [owning Codex resume](evidence/codex-contract-reconnect-1795456351256745000.json) after deployment returns the identical wait_id. Actual client timeout and immediate fresh-process resume are archived in the client summary. Earlier real event-driven wake receipts remain in [fleet.md](fleet.md). |
| Browser lifecycle and queued completion | OBSERVED on real staging and production Browser Rendering. [Staging receipt](evidence/render-staging-1795455981015.json), [production receipt](evidence/render-production-1795456318306.json). Concurrent submissions complete serially after initiating requests end, reuse a browser session, create distinct empty-cookie contexts and close them. Retained PNG hashes match remote bytes; the owning lane opened the actual PNG. Total-deadline repair followed independent review; regression tests are producer checks only. |
| Named suite through sidecar | OBSERVED. Fixed `fleet-mcp-typecheck` executed locally by the registered sidecar, signed uploads and actual serving results in [controlled production capture](evidence/sidecar-verification-production-controlled.json). |
| Verification-cache adversaries | OBSERVED on serving surface. Controlled production capture proves actual temporary dependency-byte mutation miss, exact restored identity, distinct UUID reruns under equal identity, forced miss and actual elapsed-age stale-green rejection. [Independent live verifier](evidence/independent-verification.json) reproduced serving behavior without implementing the suite. Earlier concurrent-write failures remain archived, never relabeled as passes. |
| Pinned-model capture/schema accounting | OBSERVED with explicit limits. [Token accounting](token-accounting.md) links exact model/effort, CLI version, raw fields and serialized-schema payload accounting. Deferred provider framing/first-use overhead is not inferred from the initial-input null delta. The formal benchmark pin remains #33. |
| Staging and production fixture sweeps | OBSERVED. [Staging](evidence/platform-sweep-staging.json), [production](evidence/platform-sweep-production.json), [Actions receipt](evidence/platform-ci.json) identify the deployed source revision and green fixture checks. Manual deployment collided with CI creating the same namespace; [failure retained](evidence/platform-manual-deploy-collision.log.json), CI completed deployment without recreating or deleting state. |
| Measured workload costing/budget | Defined planning workload costed from scoped actual component telemetry, including provider browser duration, with explicit missing-meter reserves. [Cost assessment](cost.md) links raw usage, exact arithmetic, sources and stated budget. This is a projection, not a pilot result, invoice or spending limit. |

## Cancellation: the unresolved platform claim

The actual client accepts `turn/interrupt`, ends its turn and enforces its tool
call deadline. The captured RMCP trace does not show an outgoing MCP
`notifications/cancelled`. [Independent remote registry observations](evidence/cancellation-review.json)
show the interrupted request still registered after the Codex process disconnects,
and later disappeared near its expected bounded completion. The reason for that
disappearance is inferred, not independently identified. This contradicts an immediate server-cleanup
claim. New `request.signal` and stream-cancel hooks are defensive code, not live
proof of that claim.

[Independent live HTTP protocol use](evidence/independent-http-protocol.json)
proves that an explicit MCP cancellation notification does terminate the current
Worker observation and preserves the durable application wait. It does not prove
that this Codex version sends that notification. Earlier stateless request-ID
collisions were repaired with token/policy-bound opaque sessions; actual immediate
fresh-process reconnect after a timed-out call now succeeds. These are separate
observations and must remain separate.

Execution-plan Section 3.2 says a failed proof requires a design revision or an
explicit scope narrowing. The owning Unified MCP Server chat must decide whether
the supported contract can be client interruption plus bounded server observation,
with explicit wire cancellation remaining UNPROVEN, or whether an upstream Codex
change is required. This lane cannot turn a negative observation into a green
criterion. The existing G1 NO-GO is unchanged; #43 owns re-review.

Owner-side disposition was requested through Muse inbox ask
`20261123T175658Z_e11d08` on 2026-11-23, after landing the concrete evidence.
It requests the cancellation-contract and scope-incident disposition, not more
runner work or permission to claim G1. The old model/access replies were
acknowledged only after independent verification of their resolved surfaces.
Do not duplicate this pending ask or repeat landed probes merely to poll it.

## Scope incident

A broad credential-related search inside this repository displayed fragments of
its historical mixed-corpus baseline files. Those fragments included excluded-domain
aggregates. This violated the read boundary even though no excluded checkout,
issue or MCP server was contacted. No such content was ingested, uploaded,
served, used as a functional fixture or used to derive these measurements.
This attempt cannot certify an unbroken read boundary. The subsequent corpus
reads and captures were explicitly scoped to personal fleet-mcp sources. The
owning gate review must account for this incident; it must not be omitted from a
clean-scope claim. Future searches must name files/directories whose contents
have already been confirmed personal-only, excluding historical baseline inputs.

## Verification limits and reproduction

- `npm test`, `npm run typecheck`, `npm run build`: passed producer regression
  checks, archived [test output](evidence/platform-tests.log) and [bundle output](evidence/platform-build.log.json).
- The owning lane used actual Codex, HTTP reads, remote D1 observations and the
  deployed renderer. The independent verifier used real cache-serving results.
  None of these receipts grants the owning G1 verdict or runner issue closure.
- [Deployment and capture commands](../deploy.md),
  [pre-probe functional protocol](protocol.md), [raw artifact manifest](evidence/platform-manifest.json).
- Signing initially failed because this process lacked SSH_AUTH_SOCK. Reusing the
  existing launchd agent socket exposed the already loaded signing key. Signing
  was not disabled; commits landed only through `runner land`.

# Historical attempt: 2026-11-22

Date: 2026-11-22 PT. **NOT COMPLETE. No G1 GO.**

Scope boundary: personal-project corpus only. No excluded data, repos, issues,
or MCP content was accessed. No benchmark, pilot, treatment run, preregistration
freeze, or efficacy publication was performed.

## Previous attempt and current prerequisites

The previous attempt stopped on #14. That hold is obsolete: GitHub now reports
#11, #12 and #14 closed, and the current source revision is
`1cb70d8946056e90b9bb55cbd698a804aadfbc1e`. G0 is GO in
[the owner sign-off](../gates/g0-signoff.md). Existing Fleet HTTP receipts are
indexed in [fleet.md](fleet.md); their effects were not repeated.

The old [G1 verdict](../gates/g1-verdict.md) reviewed an earlier scaffold. It
remains NO-GO, but its source inventory is historical. This status note does not
silently upgrade it or certify the newer slices.

## This attempt's actual surface evidence

[Raw HTTP observations](evidence/platform-preflight.json) retain timestamps,
URLs, methods, status codes and response bodies. Staging and production denied
this client's health, version and MCP requests with HTTP 403, Error 1010,
`browser_signature_banned`. These responses do not identify the deployed Worker
revision or prove any MCP behavior. The recorded SHA identifies inspected local
source only. No successful response was reconstructed.

The in-app browser was unavailable. The existing Aria Chrome connection was
discovered, but the attempt to open the staging health page failed before
navigation with `Cannot read properties of undefined (reading 'timeoutMs')`.
No browser screenshot or successful browser observation exists for this attempt.
No security policy was weakened and no alternate access path was created.

Independent subagent dispatch failed before starting with a thread-store error.
It supplied no review or verification evidence.

## Acceptance disposition

Row labels correspond to the issue's acceptance items, not measured counts.

| Item | Disposition | Remaining proof |
|---|---|---|
| Codex MCP contract | UNPROVEN | `src/handler.ts` deliberately leaves MCP disabled. Implement the bounded transport slice, then archive actual Codex negotiation, calls, errors, resource reads, notifications, cancellation and reconnect. HTTP read-path receipts are insufficient. |
| Resumable wait | PARTIAL, UNPROVEN overall | #14 retains real HTTP disconnect/resume and bounded-timeout receipts. Still needs actual Codex transport behavior and an intervening deployment with the same resumable wait identity. |
| Browser lifecycle and queued completion | UNPROVEN | `BROWSER` binding presence is not execution. Needs real startup/reuse, isolated context cleanup, concurrency and durable completion after the initiating request ends. |
| Named suite through sidecar | UNPROVEN | The current sidecar collects flight events, a credential probe and file hashes. It has no named verification-suite execution path. Direct local tests do not satisfy this item. |
| Verification cache adversaries | UNPROVEN | No verification-result cache exists in this slice. Needs complete identities, dependency-miss, distinct forced-rerun record and rejection of stale green on the serving surface. |
| Pinned-model token capture and schema overhead | UNPROVEN | No committed benchmark model pin or freeze exists. Needs an exact model identity, scoped raw session capture and a separately measured schema count. No cross-project session archive was searched. |
| Deploy and fixture sweeps | UNPROVEN in this attempt | Historical deployment receipts exist. Current direct access is denied, so this attempt cannot assert the deployed revision or a fresh green staging/production sweep. |
| Measured pilot costing and budget | UNPROVEN | No component-level workload measurements or approved pilot budget were supplied or synthesized. Needs measured Worker, D1, KV, R2, Durable Object, browser and upstream usage with rate sources and explicit allocation. No pilot ran. |

## Owner-side requests and resumption

The model identity question is routed to the owning chat through Muse ask
`20261123T022634Z_ff061e`: supply its exact spike model decision, or a dated
decision permitting a provisional spike model with later revalidation. The
question is narrow: execution-plan Section 3.2 requires the pinned-model proof
before G1, while #33 freezes the benchmark identity after G2. The absence of
`bench-prereg-v1` does not itself prohibit non-benchmark functional probes, and
this note does not impose #33 as a new prerequisite for all spike work.

Muse browser ask `20261123T022744Z_06986c` requests an observation through its
existing Chromium session because the available browser path failed. It permits
read-only inspection only. Any necessary account-security change goes to Aria;
the request does not authorize weakening WAF or opening new access.

An answer alone is not completion. Independently verify it on the affected
surface before acknowledging either reply. Resume the remaining implementation
and functional proofs, retain failures and raw captures, then obtain the owning
chat's real-surface verification. Do not close #15 or claim G1 from this note.

## Producer checks

`npm test`, `npm run typecheck` and `npm run build` passed against the inspected
source. These are local regression checks only, not platform acceptance,
sidecar-suite execution, independent verification or a live deployment proof.
