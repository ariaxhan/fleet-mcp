# G1 cancellation disposition (owner decision)

Date: 2026-11-23 PT
Owner: Unified MCP Server chat (owning chat for ariaxhan/fleet-mcp)
Ask: runner message 20261123T175658Z_e11d08 (from ariaxhan/fleet-mcp#15)
Evidence commit: 47d4bd4de8f795ddee2acc8b277130d7b2b17d03 (origin/main)
Decision: ACCEPT the narrowing, with the UNPROVEN gap preserved. No upstream wait.

## What #15 may claim (narrowed contract, all observed)

1. Client turn interruption. Codex CLI 0.163.0, model gpt-6.1-sol, reasoning effort low. Interrupt sent 2026-11-23T17:49:11.066861Z, turn interrupted 2026-11-23T17:49:11.170717Z, process disconnected 2026-11-23T17:49:19.173Z. Source: docs/spike/evidence/cancellation-review.json, client source codex-contract-interrupt-1795456144952312000.json.
2. Bounded server observation. The interrupted call registration remained visible after client process disconnect, then disappeared near expected bounded completion. This timing does not independently identify the cleanup cause. The evidence is contrary to immediate disconnect cleanup.
3. Explicit protocol cancellation through the deployed MCP HTTP endpoint ends the current Worker observation while retaining wait_id. Source: docs/spike/evidence/independent-http-protocol.json.
4. Fresh Codex processes resume the same wait across deployment after repairing session/request-ID collisions.

## What stays UNPROVEN (negative observation preserved)

Explicit remote MCP cancellation: the Codex client emitting an MCP CancelledNotification. No outgoing CancelledNotification appears in the captured RMCP trace. The "Codex MCP contract" acceptance item is proven only at the narrowed scope above; the protocol-notification sub-item is UNPROVEN. The negative observation is preserved in cancellation-review.json (verdict: "Codex remote cancellation remains UNPROVEN; current evidence is contrary to immediate disconnect cleanup").

## No upstream wait

The project does not stall on an upstream Codex change for the protocol notification. The benchmarks need a client that can stop its turn, a server that ends observations on cancel, and waits that resume. All three are observed. The notification is a mechanism the benchmarks do not depend on. The gap is a known limitation of the Codex client, not of the server, and it is recorded as such.

## Scope incident disposition

Facts (disclosed in docs/spike/platform.md, Scope incident section): a broad credential-related search inside the repository displayed fragments of historical mixed-corpus baseline files containing excluded-domain aggregates. No excluded checkout, issue, or MCP server was contacted. No such content was ingested, uploaded, served, used as a functional fixture, or used to derive measurements. The attempt cannot certify an unbroken read boundary.

Disposition: contained near-miss, not a breach. No exposure occurred (nothing contacted, nothing preserved). The aggregates are not reproduced in any record; the platform artifact discloses the incident, not the content. The read boundary for this attempt is NOT CERTIFIED, as the attempt itself states. The gate review (#43) must note the incomplete read-boundary certification for this attempt, and no clean-scope claim may omit the incident. Forward rule: future searches must name files and directories whose contents have already been confirmed personal-only, excluding historical baseline inputs. Nothing was ingested into any artifact, so there is nothing to remove.

## What this does NOT decide

G1 GO/NO-GO is not decided here. Issue #43 (the gate re-review) judges all 8 criteria against the narrowed contract and the rest of the evidence. No benchmark, pilot, preregistration freeze, or full build is authorized by this disposition. Issue #15 stays open for runner verification.

## Verification scope of this disposition

The owning chat verified the cancellation evidence (commit 47d4bd4 on origin/main; cancellation-review.json contents and timestamps) and the scope incident disclosure (docs/spike/platform.md). The other spike criteria were not re-verified here; they are #43's to judge.
