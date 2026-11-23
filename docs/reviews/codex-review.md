# Fleet MCP PRD Review

## Scope and overall assessment

Reviewed the full `/tmp/mcp-prd.md`, Sections 0 through 10 and both appendices. This review uses only that document. No repositories, external documentation, baseline report, analysis files, or MCP servers were accessed. Report-derived measurements are treated as claims cited by the PRD, not independently verified evidence. Cloudflare and MCP implementation details below are requirements to validate, not claims that current platform limits have been checked.

The product direction is sound: structured shared state, immutable evidence, explicit freshness, and resumable context can remove repeated work. One server with internal modules is appropriate for a personal project. The PRD is unusually explicit about evidence limitations and benchmark provenance.

It is not yet an implementation-ready contract. The largest problems are the missing Studio-to-cloud execution boundary, unsafe assumptions about verification and render cache identity, incomplete authorization across non-repository resources, and a benchmark whose statistical claims exceed its specified design. These are design gaps rather than reasons to abandon the project.

## 1. Architecture

### Context and State are useful groupings, not consistency boundaries

The split in Sections 2.1 and 2.4 is understandable and helps organize tools. Keeping one core avoids duplicated identity, access control, and cache machinery. Render belongs inside Verify because screenshots and diffs are verification artifacts, as Section 2.3 argues.

However, Issue Context is mutable operational state, Recall queries update usage counters, and Handoff combines immutable snapshots with current state. The side labels cannot determine freshness, authorization, or storage policy. Define those properties per operation and resource class.

The stronger internal distinction is between:

- Immutable artifacts and deterministic computations.
- Mutable upstream observations, each with an observation time and coverage watermark.
- Commands and external effects, each with an idempotency policy.
- Local-machine operations requiring an explicitly authorized connector.

This need not change the public tool names. It should change the internal contracts.

### The missing component is the Studio connector

Sections 2.5 and 4.4 describe a cloud Worker and a Studio lesson sync job. They do not explain how the Worker obtains live flights and jobs, reads current local file bytes, runs named local verification suites, compares checkpoint file hashes against a live checkout, or checks machine-local OAuth and checkout health.

A cloud path string is not access to a Studio file. A content hash identifies bytes but does not supply them. A D1 flight record is not live fleet state until a producer updates it. A lesson sync schedule does not establish a command channel for preflight or verification.

Add an explicit data-flow diagram and connector contract covering:

- Producers, authoritative stores, push or pull direction, and authentication for every local data class.
- Stable machine, checkout, repository, session, attempt, and task identities.
- Connector heartbeat, last successful observation, and offline behavior.
- Allowed operations, bounded execution, command authentication, retries, and duplicate delivery.
- File upload or immutable artifact references for checks, including protection against paths outside the authorized root.
- Whether credentials stay entirely on the machine and only liveness attestations leave it.

If v1 intentionally has no command channel, narrow the tools to cloud-visible data and uploaded bytes. Defer the unsupported local behaviors explicitly.

### Keep the shared core smaller and more precise

Sections 2.2 and 4.3 combine content identity, resource versions, cache entries, audit events, and a globally ordered feed. They should share infrastructure, but not one universal object model.

- Content hashes identify canonical payload bytes. Mutable counters and response timestamps belong outside those bytes.
- Resource versions identify logical revisions within a resource and namespace.
- Change-feed sequences identify committed events, not source-system chronology.
- Cache entries identify a computation or observation plus its complete input context.
- Audit records describe access and effects, including attempts that fail before a resource version exists.

A single D1 event log is a reasonable starting point. Make the resource update, version allocation, and event append one transaction. Publish cache changes and wakeups through a recoverable outbox after commit. Otherwise a crash can create a changed resource with no event or an event pointing to unavailable content.

The promise of arbitrary-version deltas is useful for briefs and canonical documents. Applying append-only versions to every transient health observation and telemetry counter would add substantial machinery without a stated consumer. Specify which classes are historically versioned and which are only sampled observations.

### Render placement is sound, render execution is incomplete

Keep the public Verify group and resource namespace. A separate Worker is unnecessary initially. However, rendering has different concurrency, cancellation, cost, browser-session, and credential requirements from simple reads. Give it an internal executor boundary and separate quotas now.

Sections 2.3 and 5.1 do not define ownership of the warm browser pool, isolation between browser contexts, browser crash recovery, or durable queue execution. A slow render returning an ID needs a durable job state machine, not merely a response field.

### Avoid overstating the causal mechanism

Section 2.4 calls Handoff a direct fix for re-attempts. It can reduce repeated context assembly and rework after a failure. It does not prevent worker deaths, scheduling storms, authentication expiry, or repeated execution of an external effect. Similarly, a shared cached document saves retrieval work but does not automatically save model input tokens when another fresh agent still needs the whole document.

Separate hypotheses for retrieval savings, model-context savings, retry overhead, and actual failure prevention. Checkpointing should also expose cancellation and supersession state, since the cancelled-work example in Section 3.2 is not solved by remembering an old checkpoint.

## 2. Tools and resources

### Inventory and cross-cutting contracts

Appendix A correctly totals 33 tools and 15 resource types.

The flat names are readable. `doc_*` is an intentional exception to area naming. The main inconsistency is `exemplar_what_changed`, `issue_what_changed`, and `fleet_what_changed_since` having different cursor types despite Section 7.2 promising a common interface. Standardize their cursor semantics even if the names remain.

Before implementation, every tool needs machine-readable input and output schemas covering required fields, bounded sizes, enum values, authorization, errors, pagination, freshness, and idempotency where applicable. The tables are useful summaries, not sufficient schemas.

The universal metadata contract also needs exceptions. A wait result, query result, failed command, or live probe may not have a meaningful resource version. Specify nullable fields and separate resource identity from response-envelope identity. A hash of response bytes that include changing timestamps will not identify stable content.

### Review of all 33 tools

| Tool | Required clarification or change |
|---|---|
| `exemplar_get` | Add namespace, version type, not-found and tombstone behavior, maximum response size, and hash lookup if Section 2.2 promises it. |
| `exemplar_list` | Add cursor pagination, stable ordering, maximum limit, and authorization-filtered totals. A prefix is not an access boundary. |
| `exemplar_what_changed` | Define target version, invalid or expired base behavior, diff format, and full-body fallback. Explain how clients establish that they possess the base bytes. |
| `doc_get` | A bare path needs repository and revision identity. Define canonical path normalization and whether it refers to committed or working-tree bytes. |
| `doc_list_canonical` | Define who publishes the canonical set, its namespace, listing bounds, and version. |
| `recall_query` | Specify ranking, topic/repository scope, score meaning, query normalization, pagination, and telemetry semantics on cache hits. Cached `hit_count` and `last_recalled` can otherwise immediately contradict the write. |
| `recall_learn` | Require an owning namespace or DB mapping, idempotency key, duplicate policy, and write-back status. The caller currently cannot specify which agentdb DB owns the new lesson. |
| `recall_list_lessons` | Define topic matching, ordering tie-breaks, cursor pagination, and whether quarantined lessons are excluded. |
| `recall_store_health` | Restrict source-DB and zero-result query details to authorized callers. Distinguish historical schema reports from present connector health. |
| `issue_get` | Specify whether PR numbers are supported, comment order and truncation indicators, comment pagination, and separate versions for summary versus comment-inclusive representations. |
| `issue_list` | Require or safely default repository scope; bound filters and result size. Define pagination, ordering, `total_count` semantics, and whether upstream search is involved. |
| `issue_what_changed` | Replace ambiguous timestamp-or-version input with an opaque scoped feed cursor. Return coverage and next cursor, including when upstream synchronization is incomplete. |
| `issue_comment` | Add idempotency and ambiguous-upstream-success handling. Define permitted repository permissions and avoid blindly retrying a write after a timeout. |
| `brief_get` | Separate immutable brief content from the mutable run-history attachment. Define which version governs each part and how run history is paginated. |
| `brief_create` | Define the structures of inputs, acceptance, and constraints; server-assigned identity; source-ref authorization; and duplicate-request handling. |
| `brief_record_run` | Add attempt identity, worker identity, start/end timestamps or a defined duration convention, and idempotency. Explain why adding a run increments the brief's content version. |
| `fleet_get_flight` | Define the state machine, producer, source observation time, heartbeat, terminal states, and unknown versus missing flight. |
| `fleet_list_flights` | Add repository/account scope, stable ordering, pagination, and snapshot semantics while records change. |
| `fleet_get_job` | Define job versus flight versus run versus attempt, including how attempts and scheduled executions link. |
| `fleet_what_changed_since` | A required timestamp contradicts the common sequence-based feed contract. Add cursor, coverage, pagination, and resource filters. |
| `fleet_wait_for` | Specify initial-state evaluation, race-free subscription, cancellation, authorization of feed patterns, disconnect/resume behavior, timeout result, and a starting cursor. |
| `fleet_preflight` | Define account and machine identity, the closed set of supported probes, and treatment of `unknown`. Resolve the missing `fresh` input referenced in Section 4.5. |
| `verify_check` | Specify how bytes arrive, allowed check suites, transitive inputs, checker versions, environment identity, execution location, timeouts, and errors versus check failures. |
| `verify_get` | `file_hash` alone cannot select between results from different check lists, checker versions, environments, or forced reruns. Accept a result ID or complete computation key. |
| `verify_deploy_status` | Normalize provider states rather than assuming `readyState` is universal. Specify supported providers, immutable deployment identity, branch aliases, authorization, and transient API failures. |
| `verify_live_check` | Add freshness override, response limits, redirects, authentication policy, matching semantics, and evidence of the actual deployment observed. |
| `verify_render` | Add an explicit output mode, since the caller's promised choice is absent from inputs. Define `state`, auth profile, readiness condition, content fingerprint, job status, and render completion protocol. |
| `verify_get_render` | Return queued/running/failed/cancelled states as well as ready/not-found. Define image delivery authorization and artifact expiry. |
| `verify_visual_diff` | Specify algorithm/version, image compatibility, masks, threshold, animation handling, and the denominator for diff percentage. A pixel change is not a correctness judgment. |
| `handoff_save_checkpoint` | Add expected prior checkpoint or fencing generation, idempotency, machine/checkout identity, and a reference to the actual authorized brief revision. |
| `handoff_resume` | Specify bounded composition, dependency errors, current authorization, source coverage, and whether file comparisons are live or last observed. Do not present a partial resume as complete. |
| `handoff_list_sessions` | Define active/dead/completed transitions and their producer. Add namespace filters, stable pagination, and timeout/heartbeat rules. |
| `handoff_get_run_history` | “Every run” needs pagination and stable attempt identity. Define whether `task` and `brief` references are interchangeable or mapped explicitly. |

### Missing capabilities do not all need new public tools

Sections 2 through 4 require operations absent from the tool inventory:

- Publish and update exemplars and canonical documents.
- Revise briefs without conflating revisions with run records.
- Read or diff PR-specific state, if `pr://` is a real supported resource.
- Flag, quarantine, correct, and revoke lessons, as promised in Section 9.1.
- Ingest fleet events, create/update session status, and record worker death.
- Manage allowlists, tokens, and sync reconciliation.
- Upload or reference file artifacts and cancel durable render work.

Specify whether each is a CLI, admin endpoint, connector operation, resource read, or public tool. The “anything not listed is out” rule in Section 9.1 conflicts with these required control-plane operations. It should bound the agent-facing API, not prohibit implementation necessities.

Resources also need defined read handlers, authorization, version-fragment syntax, list behavior, subscriptions, and response size limits. A URI namespace alone is not an implemented resource API.

## 3. Data model and storage

### D1, KV, R2, and Durable Objects

The broad split in Sections 4.1 and 4.2 is sensible: D1 for queryable authoritative metadata, R2 for immutable bodies, KV for disposable acceleration, and Durable Objects for coordination. The implementation must distinguish an authoritative historical artifact from an evictable cache copy.

The issue schema is the clearest violation. Section 4.1 stores version bodies only in KV, while Section 4.2 calls KV disposable. GitHub can recover the current issue, but not necessarily a particular historical body or the exact last-eight-comment view. Once KV loses that body, the promised immutable version and arbitrary delta may be irrecoverable. Persist issue snapshots in D1 or R2. Use KV only as a copy.

For small queryable issue JSON, D1 is the simplest initial authority. Move larger bodies to R2 if measured size or cost warrants it. Queryability is not the sole reason for durable storage; historical reconstruction is the stronger requirement.

Durable Objects coordinating per-session writes are reasonable. They do not automatically make D1 plus R2 updates atomic. One object per waited condition needs a canonical identity, subscriber fanout, deduplication, expiry, and cleanup policy. A shared coordinator per logical resource may be simpler, depending on measured subscription patterns.

### Keys and relationships the schema will regret

Sections 4.1 and 6 promise client isolation without including tenant or namespace keys in the entity model. Add the ownership dimension now, including to unique constraints, foreign keys, cache keys, change-feed queries, and blob access checks. Separate databases can remain a later deployment choice.

Other required corrections:

- Documents need repository identity and revision/worktree identity, not just `path`.
- Repository owner/name is mutable. Preserve a stable upstream repository identifier alongside display names and ownership policy.
- Lessons cannot be both “stable” and content-derived if edits change the content. Use a stable logical ID plus version hashes. For imported rows, include a stable DB identity and row identity.
- Runs need stable attempt IDs. `(brief_id, n)` may be a presentation sequence, but retries of the same write must not create a second attempt.
- Verification keys need checker and tool versions, normalized options, dependency inputs, and execution environment. Section 7.1 mentions version identity, but Sections 3.2 and 4.1 omit it from the concrete key.
- Render keys need identity/session profile, renderer version, and an observed state fingerprint. Avoid including secrets in a key or metadata.
- Sessions, flights, jobs, tasks, attempts, and briefs need explicit foreign-key relationships and lifecycle rules.
- Token, allowlist, connector, sync cursor, write-back outbox, render-job, and deployment-receipt records are referenced operationally but missing from the entity table.

### Ordering, transactions, and schema evolution

A globally monotonic D1 sequence can order committed ingestion. It cannot establish the original order of delayed GitHub webhooks or disconnected-machine events. Preserve source event identity, source timestamp, ingestion timestamp, and deduplication key. Apply source-aware conflict rules rather than letting the last received event blindly win.

Specify canonical JSON/text encoding, Unicode and newline treatment, schema version, foreign keys, indexes, uniqueness constraints, and maximum object sizes. Define optimistic concurrency for updates and atomic version allocation.

Section 4.3's “no version is ever deleted” conflicts with unresolved retention in Section 9.2. Define supported-history retention, tombstones, historical-content access revocation, garbage collection, and explicit cursor expiry. Immutable means unchanged while retained, not necessarily permanent storage of all sensitive content.

### Recall synchronization needs an outbox and conflict policy

Section 4.4 calls agentdb the source of truth while acknowledging D1-only accepted lessons. That is an asynchronous replication model with temporary cloud authority, not a simple index.

Persist the lesson and its write-back outbox entry atomically. Return a durable acceptance state such as `pending_sync`, with a stable operation ID. Specify retries, backoff, terminal failure, reconciliation, duplicate suppression, schema incompatibility, and conflicts with local edits or deletions. Prevent an inbound sync from deleting or overwriting a cloud lesson that has not yet reached the Studio.

D1-first is acceptable for a personal project if this contract is explicit. A health snapshot alone is insufficient acknowledgement of a failed write-back. Also clarify whether D1 contains full lesson text: the tools require it, while Section 4.4 describes an index containing a text hash.

## 4. Cloudflare deployment and operations

### Feasible shape, missing platform proof

One Worker and Streamable HTTP are reasonable architectural choices in Section 5.1. There is no need to split all tool areas into services. But feasibility of the actual long waits, rendering, local probes, and check suites remains unproven by this PRD.

Run focused deployment spikes before committing to the API:

- Streamable HTTP negotiation, tool errors, resource reads, notifications, session handling, cancellation, and reconnect behavior in the intended clients.
- A `fleet_wait_for` call across disconnects, deploys, and timeouts, including the proposed maximum wait.
- Browser startup/reuse, context cleanup, resource use, concurrency, and a slow queued render completing after the initiating request ends.
- Actual named verification suites, including dependencies unavailable in a Worker runtime.
- Connector offline and recovery behavior without fabricated freshness.

These are validation requirements. The PRD does not provide the platform limits, account plan, or test evidence needed to conclude that every proposed execution path works.

### Transport and durable jobs

Section 5.1 describes POST and GET but leaves protocol version negotiation, session IDs if used, supported optional methods, Origin validation, notification routing, request cancellation, and stream resumption unspecified. Decide which MCP features are supported and test those contracts.

An SSE connection is not a durable task queue. Wait and render work need durable state, cancellation, bounded concurrent work, and recoverable completion. Progress notifications cannot be the sole source of final results.

Durable Objects are coordination actors, not a specified ingestion pipeline. Explain how a D1 commit wakes the correct waiter, how lost notifications are repaired, and how the subscribe-versus-check race is closed.

### Deploy isolation and rollback

Section 5.2 says production is swept using staging data. This needs an explicit interpretation. A separate staging endpoint does not prove the production deployment. Production synthetic fixtures can do so if isolated in a restricted test namespace, with harmless upstream repositories, cleanup, and explicit routing that cannot accidentally target real records.

A shared staging Worker for every PR is not isolated preview deployment. Either use a deliberate shared staging workflow with serialization or provision separate preview resources. Separate D1 alone is insufficient if KV, R2, Durable Objects, secrets, webhooks, or sync targets remain shared.

Forward-only migrations and `wrangler rollback` are not a complete rollback strategy. Use backward-compatible expand/contract migrations, defined migration order, restore procedures, and a tested older-Worker/new-schema compatibility window. An application rollback does not by itself undo data changes.

Exercising every tool once is a smoke test. Add contract, authorization, concurrency, invalidation, error-path, and cross-store recovery tests before release. A deployment receipt should identify the build, schema, configuration, fixture revision, and sweep version, not only the commit hash.

### Cost, backpressure, and observability

Section 9.1 mentions render quotas, but no enforcement design or budget exists. Estimate service and benchmark cost separately from agent-model cost: Worker requests and compute, D1 operations/storage, KV operations, R2 storage/operations, Durable Object activity, browser usage, upstream APIs, and log retention. Use measured pilot workloads and current account pricing during implementation, not invented estimates in this review.

Add per-principal and global request limits, tool-specific concurrency limits, payload bounds, deadlines, retry budgets, and circuit breakers. Cache misses and refresh storms can increase upstream load; caching does not make quota exhaustion impossible.

Daily p50/p95 summaries in Section 5.2 are useful but insufficient for incidents. Track connector lag, webhook lag, feed coverage, outbox backlog, stale-response age, upstream rate-limit state, render queue time, retry amplification, and verification reuse by checker version. Define alerts, correlation IDs, audit-write failure behavior, and bounded logging. Keep `/health` cheap; separate public liveness from authenticated dependency detail.

## 5. Authentication, authorization, and the scope boundary

### Repo allowlists are necessary but insufficient

Sections 0 and 6.4 establish the correct default-deny intention. The boundary must cover every ingress and egress, including documents, exemplar ingestion, lessons, uploaded files, checkpoints, URLs, deploy identifiers, resource reads, and benchmark fixtures. Restricting Issue Context, Recall sync, and Fleet Status alone does not cover the full server.

A personal-project record can also quote excluded data. Repository membership is not proof that its contents are permitted. Require explicit permitted sources and provenance at ingestion. The Studio sync must operate on enumerated authorized DBs, not scan a broad tree and filter afterward. Boundary tests can use synthetic excluded identifiers without accessing excluded systems.

### Scopes need a capability matrix

Section 6.2's `read` scope is defined as get/list/what_changed, leaving `recall_query`, waits, resume, renders, live checks, visual diffs, and verification execution ambiguous. Some create persisted artifacts or initiate network work even though they sound observational. Recall queries also mutate telemetry, contradicting an absolute “read cannot write anything” statement unless internal telemetry is explicitly excepted.

Define per-operation capabilities, resource ownership, and allowed side effects. Do not let broad `write` implicitly authorize external comments, arbitrary rendering, or checkpoint writes across sessions. Bind preflight accounts to principal-owned machines and credential profiles.

Every lookup, cache hit, historical version, feed result, and R2 download needs the same authorization check. A content hash is an identifier, not a bearer permission. Filter feeds and counts before pagination so clients cannot infer other clients' resources. Revocation must invalidate active streams, subscriptions, outstanding jobs, and artifact access according to an explicit policy.

### Token and upstream handling

Section 6.2 ambiguously says bearer tokens are stored as Workers secrets and that only their hashes are stored in D1. Clarify the lifecycle: high-entropy caller tokens returned once, hashes and policy metadata in D1, upstream service credentials in Workers secrets. Avoid having to redeploy secrets to issue each client token.

Define secure token generation, lookup/comparison, expiry, rotation overlap, revocation checks, and audit ownership. If an auth cache exists, “effective on the next call” needs a consistency guarantee. Admin token management and `/internal/sync` authorization should be separate capabilities.

For upstream credentials, define separate staging/production identities, permission revocation, rotation, and redaction of headers, URLs, returned upstream errors, screenshots, and page content. “Never log tokens” is necessary but does not protect other secrets in audit inputs.

### Network and stored-content hazards

`verify_live_check`, `verify_render`, deployment URLs, browser redirects, and page subresources create a network-access boundary. Add destination policies, redirect validation, request size/time limits, and browser egress controls. Do not allow a caller to select another client's signed-in browser profile. Authenticated screenshots and artifact URLs need protected delivery and expiry.

Verify webhook signatures against raw payload bytes; deduplicate delivery IDs; handle replay and out-of-order delivery; require events to map to authorized stable repository identities.

Section 9.1's statement that content is data does not prevent an agent from following injected instructions. Preserve source and trust labels, distinguish curated canonical instructions from untrusted issue/lesson content, and implement the promised quarantine path. Never promote an agent-authored lesson into authoritative instructions automatically.

## 6. Caching, freshness, versioning, and deltas

### Content addressing proves identity only for complete inputs

The governing claim in Section 4.5 that content-addressed verification and renders “cannot go stale” is too strong.

A check may depend on a lockfile, imported files, environment variables, locale data, tool versions, service state, or the whole checkout. Hashing one file and a check list is only sufficient for checks proven to be pure functions of those inputs. Separate pure byte checks from workspace checks and live probes. Cache only under a complete declared dependency fingerprint, and give nondeterministic checks an explicit reuse policy.

Section 7.1 correctly mentions tool and checker versions, but this must appear in the schema and lookup tools too. A caller-supplied hash is not proof that checks ran against those bytes; the executor must verify the supplied artifact's digest. Store forced reruns as distinct immutable evidence records rather than overwriting the previous run.

### Render identity has a circular dependency

Sections 2.3 and 3.2 promise to render only when the rendered page's content hash changes. How is that hash known before rendering? Static HTML does not capture client-side data, CSS, fonts, cookies, locale, image changes, browser behavior, or dynamic state.

Choose a supported model:

- An application-provided deployment or asset fingerprint with documented coverage.
- A render request with a bounded freshness interval and explicit refresh.
- An always-observe step followed by screenshot deduplication, acknowledging that deduplication saves storage rather than the full browser execution.

Include renderer/browser version, readiness rule, state profile, and viewport in identity. Content hashing cannot make a live URL timeless. A render at an earlier deployment remains valid historical evidence, not current proof.

### Where stale or wrong state reaches an agent

| Path | Failure mode | Required contract |
|---|---|---|
| Issue webhook invalidation | Delayed or missed event, duplicate delivery, or invalidation racing with an older fetch | Source-aware updates, reconciliation, generation checks, observed-at time, and coverage watermark. |
| KV current pointers and snapshots | Distributed cache propagation can defeat an “immediate” invalidation promise | Define and validate consistency; use authoritative reads for freshness-critical operations. |
| Issue lists | A known changed issue remains in a list until its independent TTL expires | Namespace/repository list-generation invalidation or explicitly advertised lag. |
| Recall queries | “Matches query terms” misses ranking effects, edits, removals, quarantine, or local sync changes | Invalidate by corpus generation, or specify a safe reverse-dependency mechanism. |
| Flight/job records | A recently fetched D1 row can contain old connector state | Return source observation time and heartbeat age, not only server fetch time. |
| Deploy status | A cached failed state can mask recovery; mutable deployment aliases can point elsewhere | Key by immutable deployment ID; distinguish terminal failure from API errors; permit fresh checks. |
| Live check | Text from a previous response passes a new deploy gate | Require a fresh observation and deployment identity for gating. |
| Handoff resume | Brief, lessons, issues, and file comparisons come from different observation times | Return pinned versions, per-source watermarks, and explicit partial results. |
| Verification reuse | Incomplete dependency key returns an old green result | Complete computation identity or no reuse. |
| Render reuse | Unchanged HTML or URL hides changed visual state | Supported fingerprint and freshness policy, rather than an unconditional immutable-cache claim. |

### Freshness must be enforceable by the caller

Section 7.4's metadata is useful, but the agent cannot enforce freshness if no input requests it. Add shared options such as `max_age_s`, `allow_stale`, or a defined consistency mode. A freshness requirement that cannot be met should return an explicit error, not silently downgrade.

Separate `served_at`, `source_observed_at`, `last_validated_at`, and original computation time. Cached data served now must not acquire an apparently fresh observation timestamp. Set maximum stale ages, including when upstream quotas are exhausted. Do not serve stale indefinitely just because Section 9.1 prefers it to failure.

Resolve preflight's three competing descriptions: live every call in Section 3.2, never cached past 60 seconds there, and live only with `fresh: true` in Section 4.5. `fresh` is not currently an input. Preflight should report capability-specific liveness and freshness, with `unknown` blocking only the operations that require that capability. It cannot guarantee a credential will remain valid throughout a later run.

### Delta semantics need one precise contract

Sections 3, 4.3, and 7.2 mix timestamps, resource versions, and global sequences. They are different coordinate systems. Use resource versions for single-resource diffs and opaque authorized feed cursors for cross-resource changes.

Define inclusive/exclusive boundaries, pagination, snapshot end cursors, retained-history bounds, invalid cursors, and resynchronization. Empty results must distinguish “nothing changed” from “source coverage unknown.” A missing webhook must not yield false certainty.

Section 7.2 also says deltas never compare full versions, while Section 2.2 computes arbitrary text diffs on demand. Resolve this by using the log to discover revisions and retained snapshots to compute their content diffs, unless patches themselves are durably recorded.

Return base and target hashes with each patch. If a client lacks the base, cannot apply the patch, or the patch is larger than the full body, allow a full-object response. After compaction, a remembered version number does not mean the agent still possesses its bytes.

## 7. Gaps, testing, and ranked risks

### Ranked risks

Ranking reflects impact and dependency on unresolved design, not measured failure probabilities.

| Rank | Risk | Why it ranks here | Before-build action |
|---|---|---|---|
| 1 | False verification or freshness | A reused green check or render can certify the wrong artifact, undermining the product's safety claim. | Specify complete computation keys and enforceable freshness, with adversarial cache tests. |
| 2 | Incomplete source and connector boundary | Multiple central tools cannot deliver their promised behavior from the described cloud components. | Define local ingestion/execution, authority, offline behavior, and v1 exclusions. |
| 3 | Unauthorized corpus or credential exposure | Repo allowlists do not cover all resources, browser state, historical blobs, or mixed-content ingestion. | Define end-to-end namespace ownership and per-operation authorization. |
| 4 | Cross-store inconsistency and duplicated effects | D1, R2, KV, upstream writes, and Studio sync have no atomic shared commit. | Add outboxes, idempotency, optimistic concurrency, and reconciliation. |
| 5 | Benchmark overclaim | Current sample-size and success definitions do not support every proposed efficacy and correctness claim. | Freeze estimands, power method, correctness inference, and contamination controls. |
| 6 | Long-running work and resource exhaustion | Slow browsers, waits, refresh storms, and retries can dominate latency and cost. | Validate transport lifetime and durable execution; enforce budgets and quotas. |
| 7 | Recovery, retention, and schema operations | Rollback, deletion, history guarantees, and production synthetic tests remain ambiguous. | Add migration compatibility, restore drills, retention, and isolated fixtures. |
| 8 | Adoption and scope inflation | 33 tools and their schemas may consume savings before agents use the right paths. | Ship a narrow vertical slice, measure schema overhead, and define fallback behavior. |

### Missing operational contracts

The PRD mentions some of these topics but does not specify them sufficiently:

- Errors: stable machine-readable classes, retryability, partial success, timeouts, upstream quota failures, and check failure versus executor failure.
- Pagination: cursors, result limits, truncation metadata, snapshot ordering, and large text/image response handling.
- Concurrency: single-flight cache fills, webhook/fetch races, version conflicts, stale-worker fencing, and duplicate command delivery.
- Testing: pure-function checks, schema contracts, authorization matrix, connector integration, cross-store fault injection, protocol compatibility, and recovery tests.
- Reliability: target availability and latency, deadlines, backoff, circuit breaking, and maintenance/degraded modes.
- Recovery: D1/R2 backup and restore, lost connector recovery, replayable events, and audit durability.
- Privacy: query text, lessons, issue bodies, screenshots, checkpoint decisions, and benchmark transcripts all need retention and redaction policies.
- Fallback: CLI reads may be safe, but retrying an ambiguously successful comment or lesson write can duplicate effects. “Accelerator, never dependency” in Section 9.1 needs operation-specific behavior. Cloud-only accepted state also cannot be recovered through an unavailable cloud service.

These can be modest mechanisms for a personal project. They still need explicit contracts where correctness depends on them.

## 8. Benchmark plan critique

### Strong foundation

Sections 8.2 through 8.8 correctly distinguish historical replays from a live randomized comparison, preserve today's control workflow, separate pilot data, include repeated runs, preregister analysis, require raw artifacts, and permit negative or UNPROVEN outcomes. Fresh agents per arm and blinded outcome grading are good decisions.

The arithmetic is internally consistent: the proposed minimum is 20 pilot runs, 60 confirmatory runs, and 40 additional repeatability runs, totaling 120. That does not mean 120 independent observations for the primary effect. At the floor, the confirmatory task-level sample is 30; pilot runs are excluded and repeated runs remain clustered within tasks.

### The sample size is a planning rule, not yet a defended result

The ranges in Section 8.4 show heterogeneity in historical waste counts. They do not supply the paired-difference standard deviation for token, wall-clock, or call reductions under this intervention. They therefore cannot establish that 30 tasks, or even 50, has the stated power.

There is no universal statistical rule that 30 observations guarantee a stable mean or meaningful interval. Tail behavior, pairing correlation, task mix, measurement reliability, and effect definition matter. Likewise, 10 tasks are not automatically insufficient; adequacy depends on variance and the required precision.

For a continuous paired estimand, the approximate planning relationship is:

`n proportional to ((critical value + power quantile) * paired_difference_SD / target_effect)^2`

The final calculation should use the actual prespecified test, scale, and small-sample treatment. The PRD does not yet provide the inputs needed to evaluate it. Do not substitute observational command-count ranges for the pilot's paired outcome variance.

Keep the floor and cap as budget decisions, with these changes:

- Define each metric's estimand and scale before estimating its variance.
- Compute requirements for every confirmatory endpoint and specify how they determine the shared task count.
- Include a sensitivity analysis for the uncertainty of the pilot SD. Ten pilot pairs yield a noisy variance estimate, particularly across heterogeneous task families.
- Freeze the chosen confirmatory size after the pilot, before confirmatory outcomes. Do not stop or expand based on observed significance unless a sequential design was preregistered.
- If the cap is insufficient, report the planned power limitation and interval achieved. Insufficient planned power does not itself prove absence of an effect or justify changing the target.

### Define what “20% reduction” means

Sections 8.4 and 8.7 mix absolute paired differences with percentage thresholds. These are different analyses:

- Average of per-task percentage reductions.
- Percentage change in aggregate totals.
- Ratio of mean outcomes.
- Geometric mean ratio from paired log outcomes.

They weight tasks differently. Choose one primary estimand and report the others as descriptive checks where useful. Define zero-denominator handling for tasks with no control-arm state checks. Do not exclude such tasks after seeing the outcome.

For differences defined as with minus without, improvements are negative. For reductions defined as without minus with, improvements are positive. Make the sign convention consistent across CIs and success rules.

### Threshold attainment and statistical improvement are different claims

A mean token reduction of at least 20% with a CI lower bound above zero establishes the PRD's composite rule: a target-sized point estimate and evidence of some improvement. It does not establish that the true reduction is at least 20%. The same applies to the 15% wall-clock target.

If the intended claim is “at least the target is established,” require an interval bound beyond that target and power that test. If the intended claim is “improvement established, point estimate meets target,” retain the current rule but label it accurately. Power to reject zero at an assumed target effect is not power to prove the target is exceeded.

The 50% call target has no CI condition in Section 8.7, despite Section 8.4's general rule requiring a CI to exclude zero. Resolve that inconsistency. Also declare whether all primary thresholds must pass for an overall success, whether claims are separate, and how multiple claims are handled. A conjunctive all-required claim and multiple independently promoted wins require different multiplicity reasoning; the PRD has not chosen either.

Cohen's dz can be reported but should not replace raw or percentage effect sizes that readers can interpret operationally.

### Paired t-intervals and bootstrap checks

Paired analysis is appropriate when each pair starts from the same task state. Its assumptions concern the paired differences, not whether raw task times look normal. At the proposed sizes, skew, timeouts, and influential expensive tasks still deserve explicit treatment.

Specify the bootstrap method, resampling unit, seed, and how conflicting intervals affect the verdict. Resample whole tasks with both arms together, and retain within-task repeats as a cluster. A bootstrap check does not automatically repair a biased task sample or missing runs.

Report the complete task table, failure/time-limit outcomes, and sensitivity to influential tasks without removing inconvenient observations. Predefine timeout accounting and treatment of incomplete or invalid-instrument runs. Faster failure must not appear as successful acceleration.

### Repeatability is useful but needs an analysis plan

The random repeatability subset in Section 8.4 is a good way to observe within-task variability. It does not justify treating additional runs as independent tasks. Decide whether the first paired run alone is primary and repeats are secondary, or whether a prespecified clustered/hierarchical analysis includes them.

With only the planned subset repeated, estimates of variance components and task-specific treatment variability will themselves be uncertain. Report that uncertainty. Fresh agents reduce conversational carryover, but do not remove shared cache, lesson, issue, or deployment carryover.

### Correctness non-inferiority is a separate sample-size problem

Section 8.7's “within 5 percentage points” is not a statistical non-inferiority procedure. Define a directional margin, outcome rubric, paired comparison of correctness, and an interval/test rule. Report the interval for with-arm correctness minus control correctness, not just whether two point estimates differ by less than the margin.

Power analysis for token savings does not establish power for a tight correctness margin. With the proposed task count, non-inferiority may remain unestablished even when every observed outcome looks good. Do not invent a sufficient task count before choosing the binary or graded outcome model and assumptions. Compute it separately, or label correctness as an observed guardrail and explicitly withhold a formal non-inferiority claim.

The zero-dead-credential and zero-sleep criteria also need interpretation. Zero observed events in a finite benchmark is not proof that the population event rate is zero. Dedicated fault-injection tests should establish what preflight does with expired, missing, unknown, or mid-run-expiring credentials.

### Preserve the control arm and prevent contamination

Agree with Section 8.2: control keeps bash agentdb, CLI tools, current instructions, and existing caches available today. Removing memory would answer a different question and inflate the apparent value of MCP.

Equalize model/version, limits, brief, starting commit, dependency state, and outcome requirements. Document treatment-specific instructions and schema overhead as part of the intervention. Analyze assigned arms even when treatment agents choose not to use MCP; adoption is a result, not an exclusion criterion.

“Same starting state” requires more than two fresh agents:

- Isolate worktrees, mutable GitHub fixtures, deployments, checkpoints, and memory writes between arms.
- Define cold versus warm server caches, and distinguish cross-agent reuse from single-session use.
- Prevent pilot and earlier tasks from teaching the treatment corpus answers to later evaluation tasks.
- Snapshot the baseline agentdb state and treatment corpus. Record any deliberate longitudinal learning experiment separately.
- Block or randomize scheduling so shared-worker contention and upstream load do not systematically favor an arm.
- Record provider/model changes and instrument versions. A result from one fixed model does not establish the same effect for every client or model family.

Parallelization in Section 8.4 is operationally attractive but can violate independence and fairness through shared caches, browser quotas, or machine contention. Specify isolation and scheduling before using it to reduce elapsed benchmark time.

### Deterministic replays need stronger provenance and narrower claims

Section 8.3's replay counts can be exact for a frozen fixture. Their generalization to real workflows remains uncertain. Several proposed rows are not deterministic as written:

- Recall adoption and whether a retry avoids its earlier error involve agent behavior.
- A worker killed between checkpoints can legitimately redo uncheckpointed work. “Zero re-done work” is not a general achievable invariant.
- A unique issue may legitimately need another fetch after a change. “One fetch per unique issue per session” ignores source revisions and freshness.
- Verification cache hits require the actual historical input hashes and dependency identities, not just repeated command strings.
- Live browser launches and external state are not deterministic without captured inputs and defined execution.

The PRD's own Section 1.2 acknowledges that the historical transcripts cannot establish whether rereads were avoidable. Preserve that limitation in replay claims. Unknown source state should be marked unknown or bounded, not reconstructed optimistically.

More importantly, Sections 0 and 8.3 are not yet reconciled. Replay inputs are historical sessions and prompts whose personal-only provenance is not established in this document. Aggregate measurements may inform motivation; replaying raw material requires a separate personal-only fixture inventory. Use authorized personal fixtures or synthetic fixtures, and state that synthetic replay results test the mechanism rather than reproduce the historical aggregate saving. Do not import excluded transcripts or content.

For exemplar replays, count fetched tool output and schema overhead, not just shorter prompt references. Moving a block from a prompt into a tool response does not necessarily reduce total model input.

### Instrumentation, preregistration, and independent verification

Section 8.1 says cache-read tokens are never folded into a total, while Section 8.7 explicitly defines a combined token endpoint. Resolve this by reporting separate token classes and a clearly defined primary total. Validate each provider's accounting so cache-read tokens are not double-counted if already included in input. Record cache-write tokens where applicable and retain pricing/version metadata.

Dollar cost should include service costs separately from model cost. Distinguish task elapsed time, machine work, tool wait, queueing, and server-side work. A tool-call reduction can merely move repeated upstream work behind one MCP call, so measure downstream calls and resource use as well.

The preregistration procedure in Section 8.6 is good, but the full task list and random repeatability subset cannot be unambiguously fixed before the pilot while confirmatory size remains unknown. Register a candidate pool, ordered selection rule, strata, random seed, and deterministic subset-selection rule, then freeze the selected sample before confirmatory execution.

Use an initial pilot registration and a clearly labeled confirmatory freeze if the pilot changes the harness or intervention. No need to prohibit learning from the pilot; prohibit using confirmatory outcomes to redesign the test. Preserve all versions and identify which runs each version governs. A local Git tag and self-recorded hash establish artifact identity, not independently trustworthy chronology; preserve a remote timestamped registration record as well.

Independent rerunning of the same scorer is reproducibility, but can reproduce the scorer's bug. Add an independently derived check of sampled raw records, token extraction, run assignment, and outcome artifacts. A different agent should have a fresh verification brief, no ability to edit raw data, and no responsibility for delivering a positive verdict. A separate machine or account can strengthen controls, but is not the definition of independence.

Keep programmatic outcome checks where possible. Judge panels need a frozen rubric, arm-blinded artifacts where feasible, calibrated scoring, disagreement handling, and their own reported agreement. Agreement from another project is not evidence of agreement here.

Retain UNPROVEN, but distinguish instrument invalidity, inconclusive precision, unmet practical target, statistically supported harm, and successful evidence. Publish null and negative results. Section 8.8's “mismatch blocks publication” should block an efficacy claim until resolved, not permanently suppress a report documenting an instrument failure.

## 9. Views on the Section 9 open questions

### 1. Name and domain

Fleet MCP is clear enough for a personal fleet-state service. `mcp.ariaxhan.com` is reasonable if the author controls it and wants a general MCP entry point. Neither ownership nor availability is established in this PRD, so the name/domain should remain proposals until confirmed. Naming does not block the schema and safety decisions.

### 2. Client isolation

Use one personal namespace initially, but include namespace ownership in the schema and authorization layer now. Shared storage with rigorously enforced scopes can suit the personal phase. Before actual client use, require cross-namespace negative tests and explicit ownership of every artifact, cache entry, feed, and credential profile. Separate Workers/databases are justified when contractual or operational isolation requires them; do not assume a filter on repository names provides that isolation.

### 3. Render split trigger

Do not invent a numeric threshold without cost and latency measurements. First define render cost accounting, queue latency, non-render latency objectives, and separate concurrency budgets. Split when render workload demonstrably prevents those objectives or requires independent security/release controls. A share of the bill alone is insufficient: moving the same rendering work to another Worker need not reduce the bill. Record numeric operating thresholds after the spike, before broad rollout.

### 4. Issue cache storage

Prefer D1 authoritative issue snapshots initially, with R2 for larger retained payloads if needed and KV as disposable acceleration. Keeping historical issue bodies only in KV conflicts with the immutable-version and delta promises in Sections 4 and 7.

### 5. Retention

Set separate policies for audit data, query text, checkpoints, renders, version history, and benchmark evidence. Keep referenced benchmark artifacts for the published reproducibility commitment, with controlled access and a deletion/redaction policy for secrets or sensitive data. “Indefinitely” is an obligation requiring a budget, ownership, backups, and integrity checks. Short-lived screenshots and debug logs need not inherit it. State how expiry affects resource reads and feed cursors.

### 6. Independent verifier

Assign a separate operator or fresh verifier agent before confirmatory execution. Provide immutable raw artifacts, frozen protocol, and scorer provenance. Require independent spot derivation as well as rerunning the scorer. Separate credentials and read-only archive access are useful controls. Independence means not grading one's own work or relying on the producer's narrative.

### 7. Benchmark task list authorship

Have the project owner or a neutral selector define the eligible personal-project population and sampling rule, with an independent reviewer checking representativeness and scope. The implementation agent may advise on feasibility but should not handpick only cache-friendly tasks. Freeze a candidate pool and sample rule before observing efficacy. Hold out confirmatory tasks from pilot-driven tuning and report task-family coverage.

### 8. Control-arm rule

Keep bash agentdb access. This is the correct comparison for “better than today's workflow.” A stripped-memory control could be an explicitly secondary ablation, never the primary baseline.

### 9. Preflight scope

Start with permissions and liveness for cloud upstreams the server actually uses. Add local checkout and agent-auth probes only through a defined authenticated Studio connector. Do not upload local OAuth material merely to enable probing. Return `unknown` when a supported observation is unavailable; never infer a valid credential from an old sync or a successful unrelated API call. Define what a checkout check proves, such as existence, identity, and required revision, without turning preflight into an unspecified repair service.

### 10. Rollout order

Prefer one narrow vertical slice over all Context areas together. Exemplar/doc plus Issue Context read paths can validate schemas, auth, immutable storage, freshness, and measurement. Bring a minimal fleet ingestion and wait slice next if the connector is ready. Defer bidirectional Recall writes, broad Handoff composition, and browser execution until their foundations exist.

The cited polling counts are not directly comparable measures of wasted time or avoidability, so they do not establish the largest actionable saving. Likewise, Section 10's characterization of all Context work as low risk overlooks Recall's bidirectional synchronization. Choose the first slice for demonstrable value and bounded integration complexity.

### 11. Recall write-back failure

Accept D1-first with explicit durable asynchronous acknowledgement, an outbox, and visible `pending_sync` or failed status. Do not claim the Studio store has committed the write. Offer callers a way to require completed synchronization if their workflow needs that stronger guarantee. A transient connector outage should not force every valid lesson submission to fail, but it must not be hidden behind an unrelated health snapshot.

### 12. Success thresholds

Keep the practical thresholds fixed in advance if they reflect meaningful product value. The PRD provides no decision basis proving those particular bars are economically optimal, so describe them as chosen targets. Use pilot variance to choose sample size and assess feasibility, not to lower the bar until it becomes significant. Clarify whether the intended evidence proves improvement, target attainment, or both, and separately power correctness non-inferiority.

## Verdict

Ready for a bounded architecture spike, not yet ready to build the full v1 contract.

The three most important changes before implementation are:

1. Specify the source-to-cloud boundary and authority model: Studio connector, personal-only ingestion, namespace ownership, local execution, and offline behavior.
2. Replace unconditional cache-safety claims with complete computation identities, enforceable freshness, durable historical snapshots, transactional events, and explicit concurrency/idempotency rules.
3. Freeze a defensible benchmark protocol: estimands, power inputs and cap behavior, correctness inference, isolated task states, authorized replay fixtures, and independently checked instrumentation.


## Gap analysis: PRD vs Aria's binding deliverables (Nov 22, 2026)

This assessment uses the PRD and the existing review only. PRD citations below refer to its numbered sections. Baseline measurements are cited claims, not independently verified here. No TBS repos, data sources, or MCP server were accessed. Proposed paths below belong in the personal `fleet-mcp` repo, not in any TBS checkout.

### 1. Full report: percent changes in tokens, speed, accuracy, and reliability

**Support: partial.** Sections 8.1, 8.4, 8.7, and 8.8 cover tokens, task wall time, errors, correctness, cost, paired comparisons, confidence intervals, and a final report. They do not yet define a complete four-outcome report. Correctness is mainly a non-inferiority guardrail; reliability has no explicit endpoint. Section 1.2's historical retry counts do not measure the intervention's retry rate.

**Required additions to Sections 8.1, 8.6, 8.7, and 8.8:**

- Add `benchmark/metrics.md` and a machine-readable measurement schema. For every metric, freeze its unit, denominator, capture source, aggregation, missing-data rule, and interval method. Require a report table with control, treatment, absolute difference, relative percent change, confidence interval, sample size, and evidence link for all four outcomes, including null or adverse changes.
- Define task accuracy before execution: a task-specific acceptance rubric, expected artifacts, deterministic checks where possible, binary correct completion as a shared endpoint, and any graded score as a separately defined endpoint. Preserve scorer versions and blinded judgments. Report accuracy rate differences in percentage points as well as relative percent changes. Formal non-inferiority needs its own margin, inference rule, and power assessment; a point estimate within 5 points is insufficient.
- Define reliability as independently verified completion within a fixed time and attempt budget. Report first-attempt success, eventual success, tasks requiring another attempt divided by tasks started, extra attempts divided by all attempts, and attempts per completed task. Distinguish these denominators. Separate worker deaths, authentication failures, timeouts, stale or incorrect cache results, and infrastructure failures. Keep reliability distinct from accuracy scoring. Zero observed incidents requires a finite-sample interval, not a claim of impossibility.
- Link task, attempt, session, and run IDs. Capture all attempts through verified completion or budget exhaustion. Report task wall time including retries and a declared queueing policy; retain failed and timed-out tasks so fast failure cannot look like acceleration. The repeated-run substudy in Section 8.4 measures variability, not operational re-attempt rates.
- Define speed explicitly. A reduction in elapsed time is not the same percentage as an increase in throughput. Choose the primary percent-change estimand and sign convention; specify zero-baseline handling. Report undefined relative changes as such, alongside absolute changes.
- Resolve Section 8.1's separate-token rule versus Section 8.7's combined total. Validate whether cached tokens are already included in input counts, include schema and tool-response overhead, and preserve token classes. Add error rates with explicit call/task denominators, model cost and allocated server cost separately, and total cost per task. Report other metrics only where capture supports them; identify unavailable measurements rather than inventing values.

### 2. Full MCP server: Context, State, and Render, grounded in real data

**Support: full intended scope, incomplete build contract and grounding.** Sections 2, 3, Appendix A, and Section 10 Phases 1-3 cover both sides and Render, including 33 tools and 15 resource types. Sections 1.2 and 3 motivate the areas with measurements. That supports the product hypothesis, not proof that the full server works or that historical repetition was avoidable. Section 1.2 explicitly acknowledges that limitation.

**Required additions to Sections 2.5, 3, 4.4, 5.2, and 10:**

- Add a full-v1 acceptance matrix covering every tool, resource read, ingestion/admin path, cross-side composition, and Render operation. Each row needs an implemented component, authorized real-data source, test, deployed-build receipt, and evidence location. Phased delivery must culminate in the complete matrix; a successful Context slice is not the full deliverable.
- Specify the Studio connector for flights, jobs, current file bytes, local checks, checkpoint comparisons, and local credential attestations. Define authority, freshness, offline behavior, durable synchronization, and operation identity. Section 4.4's lesson sync alone does not supply these behaviors.
- Define complete verification and render computation identities, fresh observations for live checks, durable render jobs, and cache invalidation tests. Sections 4.5 and 7 cannot guarantee current correctness from an incomplete file or page hash.
- Add a personal-data source inventory with provenance, revisions, coverage, collection dates, and allowed ingestion paths. Validate real personal workflows and report which measurements support each design decision. Keep synthetic fault tests separate from real-data efficacy evidence. Historical aggregates that include excluded work may motivate a hypothesis, but cannot become replay inputs or prove savings for this personal corpus. Boundary tests must use synthetic excluded identifiers without contacting excluded systems.

### 3. Runnable, documented, preserved benchmark suites

**Support: partial.** Sections 8.3-8.5 reuse transcript baselines, the KERNEL pilot design, llm-bench verification ideas, and model-familiarity-engine provenance principles. Section 8.8 promises an archived scoring script and one-command recomputation. It does not promise runnable suites for collecting, executing, replaying, and verifying experiments. Reusing a design principle is not delivering the underlying suite or an adapter.

**Required additions to Sections 8.5 and 10:**

- Make `benchmark/README.md`, `benchmark/suites/`, `benchmark/tasks/`, `benchmark/fixtures/`, dependency locks, and environment manifests explicit deliverables. Document clean setup, required credentials, local smoke execution, full runs, replay, scoring, and independent verification with exact commands and expected output schemas.
- Add a reuse matrix for llm-bench, model-familiarity-engine, KERNEL, and transcript baselines: applicability, pinned source revision, license, reused code or protocol, adaptations, exclusions, and runnable entry point. Use existing code where applicable; document why a suite is unsuitable rather than merely citing it. Do not import excluded corpora or rerun historical multi-model leaderboards.
- Build new suites for cache correctness and invalidation, source freshness, interruption/resume, credential and connector faults, Render, cross-side workflows, and controlled end-to-end tasks. Distinguish deterministic mechanism tests from agent behavior experiments.
- Preserve exact suite versions, personal-only fixtures, seeds, scorer versions, and dependency artifacts needed for each result. Link every run to these identities. Gate delivery on a fresh environment running the documented smoke suite and an independent verifier recomputing archived results. Preserve failed and superseded suite versions used to produce data.

### 4. Data: gather broadly, lose nothing, maintain a clear index

**Support: substantial archival intent, insufficient loss prevention.** Section 8.4 defines the run population and analysis; Section 8.8 explicitly preserves transcripts, logs, measurements, scoring, and analysis in `benchmark/data/` or R2, with hashes and object keys. Section 9.2 question 5 proposes indefinite benchmark retention, but leaves policy unresolved. Object references are a useful start, not a complete searchable index or a recovery mechanism. Content-addressed naming detects identity; it does not prevent deletion or failed capture.

**Required additions to Sections 8.4, 8.8, 9.2, and 10, before the first run:**

- Define a collection matrix for all authorized personal-project evidence: baseline fixtures, pilot, confirmatory and repeated runs, failures, interruptions, exclusions, amendments, raw transcripts, tool/server/upstream logs, measurements, outcome artifacts, renders, analysis inputs/outputs, and verifier receipts. Record known gaps and failed collection attempts. Gather as much relevant authorized evidence as feasible; storage convenience must not silently narrow collection.
- Create `benchmark/data/README.md` and an append-only `benchmark/data/index.jsonl`. Include artifact/run/task/attempt IDs, arm, phase, timestamps, source provenance, protocol/model/build versions, file or object location, byte size, checksum, access instructions, archive status, and links from derived results back to inputs. Maintain an expected-run ledger so missing runs cannot disappear from the denominator.
- Specify continuous durable log capture, local spooling, resumable uploads, checksum and completeness verification, archive acknowledgements, and reconciliation against the ledger. Do not delete local captures until archive verification and an independent backup succeed. Detect truncated logs and worker-death gaps. A missing artifact is a recorded data-loss failure, never silently reconstructed evidence.
- Commit an indefinite retention policy for collected experiment evidence, including failed, negative, and superseded runs. Assign an owner and storage budget. Disable destructive lifecycle rules for evidence, restrict deletion, retain versioned analysis, keep a second independent copy, and schedule integrity checks and restore drills. Benchmark evidence must survive expiry of operational audit logs or cached renders.
- Keep secrets out of capture; retain any unavoidable sensitive raw evidence under restricted access and publish redacted derivatives with a redaction manifest. A linked private store can satisfy preservation without making all raw personal data public.

### 5. One model first: latest Codex, solo

**Support: insufficient.** Sections 8.2 and 8.4 require the same model within comparisons. They neither select Codex nor prohibit multiple models across tasks or phases, pin a model version, or define update handling. Section 6.1's multiple supported clients is product scope, not an experimental model policy. Section 8.8's multi-family judge panel also needs reconciliation with Codex solo.

**Required additions to Sections 8.2, 8.6, 8.8, and 10:**

- Commit to one latest available Codex model, selected and verified at experiment setup, with one solo task agent per run and no delegated solvers or model comparisons. Name its exact model ID and immutable snapshot/version where available before pilot execution. This document-only review does not establish the current latest ID; leaving a floating alias in the protocol is insufficient.
- Record resolved model identity, Codex client version, reasoning settings, limits, tool configuration, prompts, and available provider revision metadata in every run. Optimize the MCP intervention during development/pilot, then freeze its build and configuration for confirmation. Keep model settings fixed across arms.
- If the provider changes the model mid-experiment, stop the affected cohort, preserve all data, and either retain the pinned snapshot or amend the protocol and restart the affected paired cohort with a new version. Do not pool versions into one confirmatory claim. If immutable identity cannot be verified, disclose the limitation and withhold unsupported model-controlled claims.
- Replace the multi-family grading requirement for this phase with programmatic checks plus a separate independent operator or verifier using the same pinned Codex model where agent judgment is needed. A separate verifier is not a second task solver. Defer multi-model experiments and client expansion until the single-model deliverables are complete; they are optional later work.

### 6. End-to-end HTML explanation for Aria

**Support: absent as a named deliverable.** Section 8.8 requires a final report, and Section 10 Phase 5 mentions client-facing documentation. Neither specifies an HTML page for Aria or requires it to be understandable without navigating the repo.

**Required additions to Section 10 and a deliverables table:**

- Specify `docs/report/index.html` as the versioned HTML deliverable, with local viewing instructions and a stable hosted URL if publishing is chosen. Include required assets in the repo and identify the report/build/data versions it describes.
- Write for Aria: the original problem, what was built, Context/State/Render behavior, architecture and one concrete workflow, what changed, experimental methods, model/protocol identity, results for all four required outcomes, percent-change definitions, CIs and sample sizes, costs, limitations, negative/UNPROVEN findings, and what remains unfinished.
- Include readable tables or charts, proof links to run records, the data index, reproducible commands, and the independent verification receipt. Core explanation and results must be present on the page; links supply evidence rather than substitute for the narrative.
- Scaffold before experiments, update after each phase, and finalize alongside the verified full report. Acceptance requires opening the rendered page, checking links and assets, and confirming it explains the entire project end to end without reading repository source. Do not treat a Markdown report or a client API README as this deliverable.

### 7. Research paper written during experiments

**Support: evidence principles present, paper and concurrent writing absent.** Section 8 requires research-paper-quality evidence. Sections 8.6 and 8.8 provide preregistration, controls, intervals, raw-data traceability, independent verification, and UNPROVEN labels. They do not require a paper artifact. Section 10 Phase 4 postpones the final report until after experiments, with no writing milestones during development or data collection.

**Required additions to Sections 8.6, 8.8, and 10, starting now:**

- Create `paper/README.md`, `paper/manuscript.md`, `paper/references.bib`, `paper/figures/`, and `paper/evidence-map.csv`. Start with a working title, abstract skeleton with explicit unmeasured-result placeholders, problem statement, related-work/reused-suite plan, system description, methods, preregistered hypotheses, results table shells, threats to validity, reproducibility/data statement, and limitations. Do not fill placeholders with predicted findings.
- Link hypotheses and methods to `benchmark/preregistration.md` and `.json`, not a competing mutable protocol. Register pilot collection before the pilot; record amendments and a confirmatory freeze before confirmatory runs. Preserve externally timestamped registration evidence as well as Git hashes/tags.
- Specify outcome definitions, controlled paired design, task selection and isolation, single-model identity, power/precision rules for each confirmatory endpoint, confidence intervals, repeated-run clustering, exclusions, timeout accounting, and multiplicity policy. The existing review's statistical gaps still apply; invoking a paper standard does not resolve them.
- Add writing gates: scaffold and methods before collection, pilot findings and dated amendments after the pilot, contemporaneous experiment notes during every batch, generated figures/tables from archived measurements, and final claims only after independent verification. Distinguish exploratory observations from preregistered findings.
- Map every quantitative claim to protocol version, raw artifact IDs, analysis revision, and verification receipt. Assign an independent verifier before confirmation, with read-only raw-data access, scorer reruns and independently derived spot checks. Preserve null, negative, inconclusive, and invalid-instrument outcomes. UNPROVEN remains UNPROVEN in the paper, report, and HTML page. Unresolved verification blocks efficacy claims, not an honest account of a failed experiment.

### Three biggest gaps, ranked

1. **Incomplete measurement contract.** Accuracy, reliability, retries, percentage estimands, and model identity are insufficiently fixed. Without these, the experiment cannot support the required four-outcome report, regardless of run count.
2. **Preservation intent without a loss-prevention system.** There is no complete evidence index, capture/reconciliation gate, backup/restore mechanism, or committed retention policy. Lost raw evidence cannot be repaired by later analysis.
3. **Missing deliverable and timing gates.** The HTML page and concurrently written paper are absent, while runnable preserved suites and full-server acceptance are only partial promises. Section 10 must make all seven artifacts explicit, with owners, paths, phase gates, and completion evidence.
