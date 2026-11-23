# Platform spike status (#15)

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
