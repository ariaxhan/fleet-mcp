# Fleet MCP: Execution Plan

**Status:** Final plan for execution. Author: Muse (plan author, per Aria's commission).
**Date:** Nov 22, 2026.
**Repo (proposed, confirmed in Section 6):** `ariaxhan/fleet-mcp`.
**Owner:** the Unified MCP Server side chat, from Nov 22, 2026, 16:54 PT. Main routes; the owning chat executes.
**Sources:** `report.md` (baseline report), `PRD.md` (the PRD), `reviews/codex-review.md` (Codex review), `reviews/claude-review.md` (Claude review), `paper/skeleton.md` (paper skeleton). Every measured number below comes from one of those sources and is cited. Any number without a citation is labeled as a target, a threshold, or a design decision, never as a measured result.
**Evidence standard:** Aria's binding evidence standard of Nov 22, 2026, 16:42 PT governs every phase of this plan (Section 1.3).

## 0. Scope boundary (read first)

This is a personal project with its own corpus. It does not touch TBS data, TBS repos, TBS issues, or the TBS MCP server's content. The TBS Teaching MCP server is a pattern reference only (hosted, typed tools, live data; its Nov 20 live sweep of 282 checks, all pass, is cited in Report Part 2 as project evidence). This server's corpus is Aria's personal-project repos and records only, enforced by an explicit allowlist in code (PRD Section 6.4). Benchmark tasks are drawn from personal-project work only. Boundary tests use synthetic excluded identifiers and never contact excluded systems.

No em dashes appear in this plan or in any writing produced under it. That is a standing rule from Aria (Nov 19, 2026).

## 1. The commission

### 1.1 What Aria ordered

On Nov 22, 2026, Aria ordered one unified MCP server ("Fleet MCP") on Cloudflare, mirroring the TBS Teaching MCP pattern for a different use case: the working state of her agent fleet. The same day she ordered seven binding deliverables (Nov 22, 16:47 PT), a binding evidence standard (Nov 22, 16:42 PT), and the sequence that produced this plan: baseline report, then PRD, then two independent reviews, then this final execution plan plus a decision chronicle, then repo setup with runner integration and all issues filed, with no approval wait.

### 1.2 The seven binding deliverables

| # | Deliverable | Owner | Path in `fleet-mcp` | Phase gate |
|---|---|---|---|---|
| 1 | Full report: percent change in token usage, speed, accuracy, reliability, plus error rates, re-attempt rates, cost, wall time per task | Unified MCP Server chat (author); independent verifier (verification) | `report/report.md` plus `report/` tables | Finalized only after independent verification passes (Phase 4, gate G4) |
| 2 | The full MCP server (Context plus State plus Render), grounded on real data | Unified MCP Server chat; Studio lanes via runner (build) | `src/` (Worker), `sidecar/` (Studio sidecar), `wrangler.toml`, `migrations/` | Full-v1 acceptance matrix green, every row evidenced on real personal-project data (Phase 2, gate G2) |
| 3 | Benchmarks: existing suites where they apply plus new ones; the suites themselves are deliverables | Unified MCP Server chat; runner lanes (build) | `benchmark/` (`harness/`, `replays/`, `suites/`, `tasks/`, `fixtures/`, `README.md`) | Runnable from a fresh environment by the documented commands; reuse matrix complete with pinned revisions (Phase 3, gate G3) |
| 4 | Data: gather as much as possible, ensure none is lost; archive with a clear index; data loss is a failure | Unified MCP Server chat (owner); benchmark runner (capture) | `benchmark/data/` (`DATA_INDEX.md`, `index.jsonl`, expected-run ledger) plus R2 archive plus off-Cloudflare mirror | Archive infrastructure live before the first run; final audit green with all hashes verified and a restore drill passed (Phase 3 into Phase 4) |
| 5 | Single model first: Codex solo, most recent version | Unified MCP Server chat | Pinned in `benchmark/preregistration.md` and `benchmark/preregistration.json` | Exact model ID pinned and frozen in `bench-prereg-v1` before the first "with" run (Phase 3) |
| 6 | HTML deliverable: readable end to end without reading the repo | Unified MCP Server chat | `docs/report/index.html` | Scaffolded before experiments; finalized after independent verification (Phase 4, gate G4) |
| 7 | Research paper, written DURING the experiments | Aria Han (sole author); Muse (drafting support) | `paper/` (`manuscript.md`, `references.bib`, `figures/`, `evidence-map.csv`, `README.md`) | Writing gates at each phase (Section 3.5); final claims only after independent verification |

### 1.3 The evidence standard (binding throughout)

Aria's evidence standard of Nov 22, 2026, 16:42 PT has six parts, and each is a hard requirement on every phase, not only on the benchmark phase:

1. **Preregister** hypotheses, methods, and success criteria before the "with" side runs.
2. **Controlled experiments** with a real control group, enough runs for significance, and confidence intervals, not just point estimates.
3. **Traceability:** every number traceable to raw data (archive transcripts, run logs, measurements, analysis).
4. **Independent verification** by a party other than the producer.
5. **UNPROVEN labeling:** if a result cannot be proven, report it as UNPROVEN with what it would take to prove it.
6. **Full reporting:** never inflate, never round up, never present a suggestive result as a proven one. Null results are reported as results.

## 2. The verdicts

### 2.1 The PRD

The PRD (Nov 22, 2026; 11,750 words) specifies Fleet MCP as one Cloudflare Worker with two sides sharing one core: a Context side (Exemplar, Recall, Issue Context, Brief) serving versioned resources, and a State side (Fleet Status, Verify including Render, Handoff) serving live services. It specifies 33 tools across 7 areas plus 15 resource types, a content-addressed store with a version registry and a single ordered change feed, D1 for structured records, KV for the hot cache, R2 for blobs, Durable Objects for coordination, and Cloudflare Browser Rendering for renders. Its benchmark plan (Section 8) has deterministic replays plus a 3-phase agent experiment (pilot 10x2, confirmatory floor 30x2 with a 50x2 cap, repeatability substudy 10 tasks re-run twice more per arm; 120 runs minimum), preregistration frozen by git tag plus SHA-256 before the first "with" run, and preregistered success thresholds (20% token reduction, 15% wall-clock reduction, 50% state-check call reduction, correctness within 5 percentage points, zero dead-credential launches, 80% recall adoption, zero sleep loops). Every measured number in the PRD traces to the baseline report, and its limitations are carried forward honestly.

### 2.2 The Codex review

**Verdict: ready for a bounded architecture spike, NOT yet ready to build the full v1 contract.** The product direction is sound and the PRD is unusually explicit about evidence limitations, but it is not yet an implementation-ready contract. The three most important changes before implementation:

1. Specify the source-to-cloud boundary and authority model: Studio connector, personal-only ingestion, namespace ownership, local execution, offline behavior.
2. Replace unconditional cache-safety claims with complete computation identities, enforceable freshness, durable historical snapshots, transactional events, and explicit concurrency and idempotency rules.
3. Freeze a defensible benchmark protocol: estimands, power inputs and cap behavior, correctness inference, isolated task states, authorized replay fixtures, and independently checked instrumentation.

Codex also supplied a gap analysis against all seven binding deliverables, ranking the three biggest gaps as: (1) an incomplete measurement contract (accuracy, reliability, retries, percentage estimands, model identity insufficiently fixed); (2) preservation intent without a loss-prevention system (no complete evidence index, capture and reconciliation gate, backup and restore mechanism, or committed retention policy); (3) missing deliverable and timing gates (the HTML page and concurrently written paper absent; runnable preserved suites and full-server acceptance only partial promises).

### 2.3 The Claude review

**Verdict: revise before freezing the preregistration.** The PRD is well grounded and unusually honest, and the Context side and shared core are sound, but it is not ready to build or to benchmark as written, for four reasons: (1) the State side has no data path from the Studio; (2) cache state is uncontrolled in the benchmark; (3) the statistics need tightening (no primary endpoint, ambiguous threshold semantics, underpowered non-inferiority); (4) four of the seven binding deliverables are missing (single-model Codex solo, the HTML page, the paper written during the work, the benchmark suites as preserved deliverables). The review lists 25 gaps (9 high severity) and gives a full gap check per deliverable plus answers to all 12 of the PRD's open questions.

### 2.4 Where the reviews converge

The two reviews were written independently and converge on the same four findings:

| Finding | Codex | Claude |
|---|---|---|
| No Studio-to-server path; the State side cannot deliver its promised behavior from the described cloud components | Top change 1; ranked risk 2 | G1 (High); top recommendation 2 |
| Verification and render cache keys are too narrow; unconditional cache-safety claims are unsafe | Top change 2; ranked risk 1 | G3 (High); top recommendation 5 |
| The benchmark statistics are not yet defensible: no primary endpoint, undefined estimand, untestable non-inferiority, uncontrolled cache state, unnamed model | Top change 3; ranked risk 5 | G2, G4, G5, G6 (all High); top recommendation 1 |
| Binding deliverables are missing from the PRD (HTML, paper during experiments, suites as deliverables, single-model scope) | Gap analysis, ranked gap 3 | G4, G8 (High); top recommendation 3 |

Both reviews agree on: the unified-server architecture, Render inside Verify, the control arm keeping bash agentdb access (the honest "today" baseline), D1-first recall write-back with explicit durable acknowledgement, fixed success thresholds (pilot variance sets N, not the bars), D1 as the authoritative store for issue snapshots, and a thin vertical slice before the full build. Where they differ, this plan resolves the difference explicitly (Section 3.1, items R6 and R7).

## 3. The phases

Five phases, in strict order for the first four. The fifth runs concurrently where noted.

### 3.1 Phase 0: Revision (first)

**Purpose:** fix the PRD per both reviews before any build or preregistration freeze. Nothing in Phase 1 starts until the revision gate (G0) passes.

**Work items:**

- **R1. Studio connector / sidecar spec (the top gap in both reviews).** Specify the third component the PRD lacks: a Studio-side agent (sidecar) that pushes flight and job events into the change feed, runs local probes (Codex OAuth, GitHub, wrangler, repo checkout) and local check suites, supplies current local file bytes and hashes, and reports checkpoint hashes. Specify: producers, authoritative stores, push or pull direction, and authentication for every local data class; stable machine, checkout, repository, session, attempt, and task identities; connector heartbeat, last successful observation, and offline behavior (stale data labeled with its observation time, never fabricated, never presented as fresh); allowed operations, bounded execution, command authentication, retries, and duplicate delivery; file upload or immutable artifact references for checks, with protection against paths outside the authorized root; credentials staying entirely on the machine with only liveness attestations leaving it; personal-only ingestion (enumerated authorized DBs and repos, enforced before upload, not filtered after); namespace ownership; local execution boundaries. If v1 intentionally has no command channel for some behavior, narrow the affected tools to cloud-visible data and uploaded bytes and defer the unsupported local behavior explicitly. Resolves Codex top change 1 and Claude G1.
- **R2. Cache identity and safety.** Replace every unconditional cache-safety claim with a complete contract: complete computation identities for the verification cache key (check version plus repo tree hash or dependency-file hashes plus lockfile hash plus runtime and environment identity, not one file hash plus a check list); separate pure byte checks (server-runnable, a pure function of supplied bytes) from workspace checks and live probes (results pushed from the Studio, keyed by tree hash, suite version, and environment); enforceable freshness (caller-supplied `max_age_s` / `allow_stale` / consistency mode; a freshness requirement that cannot be met returns an explicit error, never a silent downgrade; `served_at`, `source_observed_at`, `last_validated_at`, and computation time kept distinct); durable historical snapshots in D1 or R2, not KV-only (issue version bodies persist in D1; KV holds only immutable bodies keyed by hash or version plus disposable copies; mutable pointers live in D1 or a Durable Object, never in eventually consistent KV); transactional events (resource update, version allocation, and change-feed append in one transaction; cache changes and waiter wakeups through a recoverable outbox after commit); concurrency and idempotency rules (idempotency keys on every write tool, stored in D1; optimistic concurrency for updates; single-flight cache fills; stale-worker fencing); Render identity (resolve the circularity: choose the supported model, an application-provided deployment or asset fingerprint with documented coverage, a bounded freshness interval with explicit refresh, or an always-observe step with screenshot deduplication, and state which; include renderer and browser version, readiness rule, state profile, and viewport in the identity; dynamic content normalization specified). Resolves Codex top change 2 and ranked risk 1, and Claude G3 and G10.
- **R3. Auth model.** Add tenant and namespace keys to the entity model (ownership on every artifact, cache entry, feed query, and blob access check); replace the coarse `read` scope with a per-operation capability matrix plus per-area scopes (`context:read`, `fleet:read`, `handoff:write`, and so on) plus repo filters, so the promised client isolation is expressible (a client token cannot see fleet state unless explicitly granted); extend allowlists beyond repos to cover documents, exemplars, lessons, uploads, checkpoints, URLs, deploy identifiers, resource reads, browser profiles, and benchmark fixtures; resolve the token-storage contradiction (D1 hash table for caller tokens plus a Worker secret holding only a pepper or HMAC key; upstream service credentials in Workers secrets); define token generation, lookup, expiry, rotation overlap, revocation semantics (including active streams, subscriptions, outstanding jobs, and artifact access), and audit ownership; bind preflight accounts to principal-owned machines and credential profiles; bind the sync token to a sign-in identity or service token, not a bare bearer; define the audit sanitizer as a field allowlist plus retention; mark served lesson text as data with provenance and length caps, with the quarantine path enforced. Resolves Codex ranked risk 3 and Claude G16.
- **R4. Control-plane operations.** Specify, for each required operation, whether it is a CLI, an admin endpoint, a connector operation, a resource read, or a public tool: publish and update exemplars and canonical documents (the missing write path; without it the corpus cannot be seeded); revise briefs without conflating revisions with run records (runs go to the change feed and `run://` without versioning the brief body); quarantine, flag, correct, and revoke lessons; ingest fleet events, create and update session status, and record worker death; manage tokens and allowlists; sync reconciliation; upload or reference file artifacts; cancel durable render work. Bound the "anything not listed is out" rule to the agent-facing API; it must not prohibit implementation necessities. Adds the missing tools the reviews name (`ref_publish` or equivalent, `fleet_list_jobs`, PR reads, `doc_what_changed`, `recall_quarantine`, `brief_list`, `verify_list_checks`, benchmark session tagging). Resolves Claude G7 and the Codex missing-capabilities list.
- **R5. Benchmark statistics.** Rewrite PRD Section 8's statistics into a defensible protocol: a single primary endpoint (total tokens per task, paired); defined estimands (primary: mean of per-task log ratios, with minus without, back-transformed to percent change, with a BCa bootstrap interval as primary and the paired t-interval as the robustness check, per Claude; the "20% reduction" ambiguity resolved per Codex by stating plainly that success means point estimate at least 20% AND the 95% CI excludes 0, which establishes improvement with a target-sized point estimate, NOT that the true reduction is at least 20%, and the stronger claim is made only if the interval supports it); multiplicity control (wall-clock and correctness as key secondaries with Holm correction; all other thresholds exploratory); the correctness non-inferiority procedure with its own power analysis, or preregister it as likely UNPROVEN at N 30-50 (Claude G6: a 5 percentage point margin cannot be shown with 30-50 paired binary outcomes; define the directional margin, the paired interval rule, and report the with-minus-control interval, not just whether two point estimates differ by less than the margin); cache condition per run (preregistered cold reset of KV, verification, and render stores per run as the default condition; warm-cache reuse as a separate descriptive factor, never pooled into the primary; cache hits recorded by origin run id); contamination controls (isolated worktrees, fixtures, deployments, checkpoints, and memory writes between arms; cold vs warm cache defined; pilot runs not teaching the treatment corpus; baseline agentdb state and treatment corpus snapshotted; scheduling blocked or randomized so shared-worker contention cannot systematically favor an arm; provider and model changes recorded); token accounting (resolve the Section 8.1 vs 8.7 conflict: input, output, and cache-read tokens always reported separately, with a clearly defined primary total, validation that cache-read tokens are not double counted inside input, cache-write tokens recorded where applicable, schema and tool-response overhead included in the with-arm input count, and model cost and allocated server cost reported separately); fault-injection tests for the zero-event criteria (preflight against expired, missing, unknown, and mid-run-expiring credentials; zero observed events reported with a finite-sample interval, never as proof of a zero rate; sleep-loop and dead-credential counts reported descriptively); a ranked pool of at least 60 tasks with disjoint pilot and confirmatory sets (10 pilot, up to 50 confirmatory, fixed draw order, recorded seed, stratified by waste class, with the full task list, arm prompt delta, cache condition, server commit hash, and starting-state snapshot per task frozen in the preregistration); power analysis using an upper confidence limit of the pilot SD (or a preregistered inflation rule), with the confirmatory N frozen after the pilot and before any confirmatory outcome, and no stopping or expanding on observed significance unless a sequential design was preregistered; the 30-task floor kept as a labeled design decision, not a statistical fact; missing-data rules (aborted runs, timeouts, harness failures treated as outcomes, not exclusions, unless they are harness faults defined in advance); the repeatability substudy analysis model (mixed-effects with task as a random effect and arm as fixed, or first-paired-run-only primary with repeats secondary, decided in advance). Also: reliability and accuracy defined as metrics with a measurement contract (Section 3.1, item R8), and personal-project baseline waste rates measured on the task pool before preregistration (Claude G20), so the effect is expected where it is tested.
- **R6. Single-model scope.** State Codex solo, most recent version, in the PRD (Sections 8.2, 8.4, 8.6) and in the paper skeleton: the exact model ID pinned and frozen in `bench-prereg-v1`, with CLI version, reasoning setting, limits, tool configuration, and prompts recorded in every run; a cohort-stop rule on provider change (stop the affected cohort, preserve all data, and either retain the pinned snapshot or amend the protocol and restart the affected paired cohort under a new version; never pool versions into one confirmatory claim; if immutable identity cannot be verified, disclose the limitation and withhold unsupported model-controlled claims); baselines and adoption targets restated from the Codex sample (recall adoption measured in Codex units, not the 3-of-9 Claude sessions; sleep-loop baseline from Codex behavior); Codex token capture confirmed before the pilot (token fields exist in rollouts for the pinned model; Codex rollouts carry no cost field, so cost is computed from tokens and the model price at run time); multi-model work marked out of scope. Resolve the multi-family judge panel conflict as follows: the two reviews disagree (Claude: a different model family as verifier does not conflict with Codex solo, since deliverable 5 constrains the agent under test; Codex: replace the multi-family grading requirement with programmatic checks plus a separate independent operator or verifier using the same pinned Codex model). This plan adopts the stricter reading, Codex's: programmatic verifiers first, and where agent judgment is needed, a separate independent operator using the same pinned Codex model. A separate verifier is not a second task solver, and keeping one model family in the entire evidence chain keeps the single-model claim airtight. The multi-family panel is deferred to later multi-model work. Resolves Claude G4 and the Codex deliverable 5 gap.
- **R7. Deliverables section.** Add a new PRD Section 11 with paths and phase gates for all seven binding deliverables (per Section 1.2 of this plan), including: the reliability and accuracy measurement contract (accuracy: task-specific acceptance rubric, expected artifacts, deterministic checks where possible, binary correct completion as a shared endpoint, graded score as a separately defined endpoint, accuracy rate differences in percentage points as well as relative percent change; reliability: independently verified completion within a fixed time and attempt budget, with first-attempt success, eventual success, tasks requiring another attempt divided by tasks started, extra attempts divided by all attempts, and attempts per completed task reported with distinct denominators, and worker deaths, authentication failures, timeouts, stale-cache results, and infrastructure failures separated; error rates with explicit call or task denominators; speed defined as elapsed-time reduction with its sign convention and zero-baseline handling); the benchmark suites as runnable deliverables with a reuse matrix; the data archive with its index, mirror, and retention policy; the HTML deliverable; the paper with writing gates. Resolves Claude G8 and the Codex ranked gap 3.
- **R8. Remaining review fixes (one sweep).** Webhook reconciliation (coverage high-water mark per repo plus a periodic reconciliation fetch; G11); bounded waits with a resumable `wait_id`, verified against the Codex client (G12); idempotency keys on all write tools (G13); post-deploy sweep fixture (fixture repo plus fixture namespace; sweep staging pre-promotion and production post-deploy with read-only plus fixture writes; G14); one credential-liveness rule, with `fresh` added to the schema if kept (G15); schema token overhead measured separately and the with-arm tool set preregistered, with scope-filtered tool lists and resources-only pure reads considered (G17); replays relabeled as mechanism upper bounds, with file-changed-between-reads checked where hashes are available and wall-clock dropped from replays or labeled simulated (G18); every replay input verified in scope under Section 0 before running, rebuilt from personal-project transcripts where it is not (G19); cross-references fixed (Section 2.5 archive pointer, Section 8.3 verification pointer, the "preregistered as an open question" wording; G22); stable lesson IDs plus content hash (G23); `lesson://` and `gotcha://` merged, `doc_*` naming fixed (G24); audit sanitizer and retention (G25); standardize delta cursor semantics (opaque scoped feed cursors for cross-resource changes, resource versions for single-resource diffs, sequence number as the canonical cursor everywhere with `next_cursor` returned); the Render split trigger defined on metrics the daily audit summary already computes (render share of Cloudflare spend, render share of total call latency, impact on non-render tool p95), with numeric values set from Phase 3 measurements and recorded as a dated amendment, never invented now; the "accelerator, never a hard dependency" claim reconciled with D1-first lessons and server-only checkpoints (local checkpoint mirror or defined degraded mode); retention set per class (benchmark-linked records never pruned; audit, checkpoints, renders, version history each with a stated policy before Phase 4).

**Gate G0 (revision gate):** the revised PRD (v2) is committed; every item R1-R8 is addressed with a dated revision note naming the review gap it closes; both reviewers' top changes are closed (Codex top 3, Claude top recommendations 1-6); the paper skeleton is aligned with the revised PRD (hypotheses H1-H7 restated with the resolved estimands and Codex-sample baselines, the judge-panel resolution recorded, the methods section matching the revised Section 8); the Unified MCP Server chat signs off that the PRD is now an implementation-ready contract. No build work starts before G0.

### 3.2 Phase 1: Bounded architecture spike (second)

**Purpose:** per Codex's verdict, prove the risky platform claims with a thin vertical slice before committing to the full v1 build. Claude's suggested order, reprioritized by Codex-sample waste: core, sidecar, Issue Context, Recall, read-only Fleet Status.

**Work items:**

- **S1. Core slice:** content-addressed store, version registry, change feed, auth and audit, and the `meta` freshness block, exercised end to end by one read path.
- **S2. Sidecar slice:** the Studio sidecar pushing one real event class (flight or job events) into the change feed, running one local probe, and supplying one file hash comparison, against real personal-project data.
- **S3. Issue Context read path:** `issue_get` and `issue_list` serving real personal-repo issues with correct freshness metadata, webhook invalidation, and reconciliation.
- **S4. Recall read path:** `recall_query` over the real personal lesson corpus with measurable latency, plus `recall_store_health` showing real store state.
- **S5. Read-only Fleet Status plus wait slice:** `fleet_get_flight`, `fleet_list_flights`, `fleet_what_changed_since`, and a bounded `fleet_wait_for` with a resumable `wait_id`, driven by real sidecar events.
- **S6. Platform proof:** Streamable HTTP negotiation, tool errors, resource reads, notifications, session handling, cancellation, and reconnect behavior in the Codex client; a `fleet_wait_for` call across disconnects, deploys, and timeouts; Browser Rendering startup and reuse, context cleanup, concurrency, and a slow queued render completing after the initiating request ends; one named local verification suite executed through the sidecar; connector offline and recovery behavior without fabricated freshness.

**What the spike must prove to proceed (gate G1, all required):**

1. The Codex client holds the MCP contract: tool calls, resource reads, notifications, cancellation, and reconnect all work against the Worker.
2. The sidecar delivers real local state to the cloud with observed-at times, and offline behavior is demonstrated: stale data is labeled stale, never fabricated, never presented as fresh.
3. Issue Context and Recall serve real personal-project data with correct freshness metadata.
4. A server-side wait returns on a real state change without client polling, within client timeouts, via a resumable `wait_id`.
5. The verification cache identity holds under adversarial tests: a dependency change misses, a forced rerun is a distinct record, no stale green is servable.
6. Token capture from Codex sessions is confirmed for the pinned model, and the tool-schema token overhead is measured.
7. A staging deploy plus sweep is green, and the production deploy path with a fixture namespace is proven.
8. The pilot workload is costed from measurements (Worker, D1, KV, R2, Durable Objects, browser, upstream APIs) with a stated budget.

If any proof criterion fails, the response is to revise the design or narrow the scope (defer the unsupported behavior explicitly), not to proceed to the full build on an unproven platform claim. The spike verdict is recorded as a dated gate note in the repo.

### 3.3 Phase 2: Build (third)

**Purpose:** the full v1 server per the revised PRD: Context plus State plus Render inside Verify, with the Studio sidecar, the control plane, and the data model.

**Work items (in dependency order; areas may proceed in parallel once the core lands):**

- **B1. Shared core (full):** content-addressed store, version registry, change feed with transactional appends and the recoverable outbox, cache layer with per-class TTLs and invalidation, delta engine, auth and audit, idempotency store, optimistic concurrency.
- **B2. Studio sidecar (full):** event ingestion, local probes, local suite execution, file bytes and hashes, checkpoint comparisons, heartbeat and offline behavior, sync reconciliation, write-back outbox for lessons.
- **B3. Exemplar plus Brief:** versioned resources, deltas, brief run history (runs versioned separately from brief content), control-plane publish and revise paths, corpus seeding from personal repos (preregistered seed list).
- **B4. Recall (full):** query with ranking and corpus-generation invalidation, learn with D1-first write and durable `pending_sync` / `ok` / `failed` acknowledgement, quarantine and flag, store health with connector health distinguished from historical schema reports.
- **B5. Issue Context (full):** structured issue reads with durable D1 snapshots, webhook invalidation plus reconciliation sweep, comment writes with idempotency, PR reads.
- **B6. Fleet Status (full):** flight and job ingestion from the sidecar, `fleet_wait_for` with durable job state and fanout from the change feed, preflight split into server-probeable checks and local probes via the sidecar, with `unknown` blocking only the operations that require that capability.
- **B7. Verify (full):** pure checks server-side on supplied bytes, suite results recorded from the Studio keyed by complete computation identity, deploy status keyed by immutable deployment ID, live checks with fresh observation and deployment identity for gating.
- **B8. Render inside Verify:** durable render jobs with queued, running, failed, and cancelled states, the resolved fingerprint model, warm browser pool with session reuse and isolation, per-principal quotas, cost accounting.
- **B9. Handoff (full):** checkpoints with fencing generations, resume composition with pinned versions and per-source watermarks (partial results labeled partial, never presented as complete), run history with stable attempt IDs, cancellation and supersession state.
- **B10. Control plane:** token management, allowlist management, sync reconciliation, admin endpoints, audit log with the field-allowlist sanitizer.
- **B11. Deploy pipeline and operations:** `wrangler.toml` with all bindings, expand-then-contract migrations run before deploy with a sweep between, post-deploy sweep against the fixture namespace, per-principal and global rate limits, tool-specific concurrency limits, payload bounds, deadlines, retry budgets, circuit breakers, observability (connector lag, webhook lag, feed coverage, outbox backlog, stale-response age, upstream rate-limit state, render queue time, retry amplification, verification reuse by checker version), alerts, correlation IDs, backup and restore procedures.

**Gate G2 (build gate):** the full-v1 acceptance matrix is green. Every tool (33 plus the control-plane additions), every resource read, every ingestion and admin path, every cross-side composition, and every Render operation has a row with: implemented component, authorized real-data source, test, deployed-build receipt, and evidence location. A successful Context slice is not the full deliverable. The matrix is the proof for deliverable 2.

### 3.4 Phase 3: Benchmarks (fourth)

**Purpose:** prove the effect to the evidence standard, in this order: deterministic replays first, then preregistration freeze, then the 3-phase agent experiment, then independent verification.

**Work items:**

- **K1. Task pool:** a ranked pool of at least 60 real personal-project tasks with recorded briefs and verifiable outcomes, drawn from the runner's personal-project queues by a mechanical rule (random draw, stratified by waste class, recorded seed), with 10 pilot tasks disjoint from up to 50 confirmatory tasks and a fixed draw order; personal-project baseline waste rates measured on the pool before preregistration; the independent verifier audits the pool for representativeness before the freeze.
- **K2. Harness and scoring:** the agent-experiment harness (run execution, arm assignment with randomized order, fresh agents per arm, isolated worktrees and fixtures per arm, cache reset per run), the scoring script (one command recomputes every reported number from raw data), Codex token and cost capture (token fields confirmed for the pinned model; cost from tokens and the model price at run time; server cost allocated per task), and the measurement schema (`benchmark/metrics.md`: every metric's unit, denominator, capture source, aggregation, missing-data rule, and interval method).
- **K3. Deterministic replays (first):** replays R1-R7 as runnable scripts under `benchmark/replays/`, one per replay, with replay inputs verified in scope under Section 0 (rebuilt from personal-project transcripts where the baseline input is not in scope), results labeled as mechanism upper bounds (not proof of avoidability), file-changed-between-reads checked where hashes are available, and tool output plus schema overhead counted (moving a block from a prompt into a tool response does not necessarily reduce total model input). Replays run before the agent experiment and prove the mechanism saves bytes and calls; only the agent experiment proves agents get faster and cheaper in practice.
- **K4. Suites:** the existing suites where they apply (llm-bench as the verifier model, model-familiarity-engine as the preregistration and verdict model, the KERNEL benchmark design as the pilot, the transcript baselines as replay inputs) plus new suites (cache correctness and invalidation, source freshness, interruption and resume, credential and connector faults, Render, cross-side workflows, controlled end-to-end tasks), with a reuse matrix naming each reused component's applicability, pinned source revision, license, reused code or protocol, adaptations, exclusions, and runnable entry point. The suites are deliverables (deliverable 3).
- **K5. Data archive infrastructure (before the first run):** the collection matrix (baseline fixtures, pilot, confirmatory and repeated runs, failures, interruptions, exclusions, amendments, raw transcripts, tool, server, and upstream logs, measurements, outcome artifacts, renders, analysis inputs and outputs, verifier receipts), the append-only index (`benchmark/data/index.jsonl`) plus `benchmark/data/DATA_INDEX.md`, the expected-run ledger (so missing runs cannot disappear from the denominator), continuous durable log capture with local spooling, resumable uploads, checksum and completeness verification, archive acknowledgements, reconciliation against the ledger, the off-Cloudflare mirror, the committed retention policy (indefinite for collected experiment evidence including failed, negative, and superseded runs; never delete benchmark-linked records; destructive lifecycle rules disabled for evidence), restore drills, and the secret-handling rule (raw transcripts encrypted, redacted copies kept separately with a redaction manifest; secrets never in capture where avoidable). Data loss is a failure condition.
- **K6. Preregistration freeze:** `benchmark/preregistration.md` plus `benchmark/preregistration.json` committed and tagged (`bench-prereg-v1`) with the SHA-256 hash recorded in the tag message and in the final report, BEFORE the first "with" run (pilot included), plus a remote timestamped registration record (a local tag and self-recorded hash establish artifact identity, not independently trustworthy chronology). Contents per PRD Section 8.6 as revised: hypotheses with resolved estimands and thresholds, the ranked task pool with selection rule and seed, arm definitions and the control-arm rule, the exact system-prompt delta between arms, cache condition per run, model ID and CLI version, server commit hash, starting-state snapshot per task, metric definitions and capture, the sample-size rule (pilot, power computation with upper CL of pilot SD, floor 30, cap 50), the analysis plan (paired log ratio, BCa bootstrap primary, t-interval robustness check, Holm correction, repeatability model), exclusion rules, the repeatability substudy selection rule, the verification plan, and the stated tolerance for derived statistics. Amendments are dated entries under a new tag; the original stays in the repo.
- **K7. Pilot (Phase 1 of the experiment):** 10 tasks x 2 arms = 20 runs. Validates the harness, estimates the paired-difference SD per primary metric, catches design flaws. Pilot data is reported separately and NOT pooled into the confirmatory result. The confirmatory N is computed from the pilot variance (80% power, two-sided alpha 0.05, upper CL of the pilot SD) and frozen before any confirmatory outcome.
- **K8. Confirmatory (Phase 2 of the experiment):** floor 30 tasks x 2 arms = 60 runs, expanding to the computed N up to a cap of 50 tasks x 2 arms = 100 runs. If even 50 tasks cannot power the preregistered effect, the result is reported as UNPROVEN for that metric with the required sample size stated, not run until something looks significant. Intent-to-treat analysis: arms analyzed as assigned even when a treatment agent ignores the tools; adoption is a result, not an exclusion criterion. An adoption-conditioned secondary analysis is labeled exploratory.
- **K9. Repeatability substudy (Phase 3 of the experiment):** 10 confirmatory tasks, each re-run twice more per arm = 40 additional runs, with cache state reset per run. Minimum total: 120 agent runs (20 pilot plus 60 confirmatory floor plus 40 repeatability). At the report's estimate of 10-60 minutes per run (Report Part 3), that is 20-120 hours of agent compute, parallelizable across the runner's workers; the actual compute cost is measured and reported.
- **K10. Independent verification:** a separate verifier (a different agent or operator from the benchmark runner, assigned before confirmatory execution, with read-only archive access, the frozen protocol, and scorer provenance, and no responsibility for delivering a positive verdict) re-runs the scoring script from the archived raw data and compares its output against the reported numbers (exact match for counts; preregistered tolerance for derived statistics), and independently re-derives a random sample of raw metrics (token counts from transcripts, run assignment, outcome artifacts) without the scoring script, so a script bug cannot pass verification. Outcome correctness uses programmatic verifiers where possible and, where judgment is needed, the same pinned Codex model under a separate operator with a frozen rubric, arm-blinded artifacts where feasible, and reported agreement with a preregistered agreement floor below which judged correctness becomes UNPROVEN. A mismatch blocks the efficacy claim until resolved; it does not suppress an honest report documenting an instrument failure. The instrument can return NOT CERTIFIED (the MFE model: Experiment 0 returned NOT CERTIFIED on a provenance FAIL).

**Gate G3 (benchmark gate):** preregistration frozen before the first "with" run; all 120-plus runs executed per the frozen protocol with complete capture (every expected run present in the ledger or recorded as a data-loss failure); replays complete with exact counts; suites runnable from a fresh environment; independent verification complete with a receipt. No result is published before G3.

### 3.5 Phase 4: Deliverables (fifth, concurrent where noted)

**Purpose:** the seven binding deliverables, finished and verified. Three of them run concurrently with earlier phases and must not be left to the end.

- **D1. Full report (deliverable 1):** the report table carries control, treatment, absolute difference, relative percent change, confidence interval, sample size, and evidence link for all four outcomes (tokens, speed, accuracy, reliability), including null or adverse changes, plus error rates, re-attempt rates, cost, and wall time per task. Drafted during the experiments from verified scoring output only; finalized after independent verification. A headline percentage without its CI and N is not published.
- **D2. HTML deliverable (deliverable 6):** one self-contained page at `docs/report/index.html`, generated from the same scored data as the paper so the numbers cannot drift, readable end to end without reading the repo: what was built, architecture diagram, methods, preregistration link and hash, results with CIs and N, UNPROVEN items, data index link, how to verify, costs, limitations, and what remains unfinished. Scaffolded before experiments, updated after each phase, gated after independent verification. Acceptance requires opening the rendered page, checking links and assets, and confirming it explains the entire project end to end.
- **D3. Research paper (deliverable 7):** the skeleton already exists at `paper/skeleton.md` and moves into the repo as `paper/manuscript.md` with `paper/references.bib`, `paper/figures/`, `paper/evidence-map.csv`, and `paper/README.md`. Writing gates: scaffold and methods before collection; pilot findings and dated amendments after the pilot; contemporaneous experiment notes during every batch; figures and tables generated from archived measurements; results sections filled only from verified scoring output; final claims only after independent verification. Every quantitative claim maps to protocol version, raw artifact IDs, analysis revision, and verification receipt. UNPROVEN stays UNPROVEN in the paper, the report, and the HTML page.
- **D4. Data archive (deliverable 4):** the final audit verifies every hash in the index, confirms the second copy, runs a restore drill, and confirms the index is complete (every expected run accounted for). The archive is the reproducibility backbone for deliverables 1, 6, and 7.

**Gate G4 (commission gate):** all seven deliverables meet their acceptance criteria in Section 10. The commission is complete only when G4 passes.

## 4. Sequencing and dependencies

Order of work, with the dependency each step waits on:

1. **Repo setup** (repo created, issues filed from Section 5, runner intake confirmed) waits on nothing; it is the first action after this plan.
2. **Phase 0 revision** waits on repo setup. It produces PRD v2 and the aligned paper skeleton.
3. **Phase 1 spike** waits on gate G0 (revised PRD). It produces the go/no-go verdict.
4. **Phase 2 build** waits on gate G1 (spike verdict: go). Areas proceed in dependency order from the core outward; B11 (deploy pipeline) starts early and serves every area.
5. **Phase 3 benchmarks** wait on gate G2 (full-v1 acceptance matrix) for the agent experiment. Replays (K3) may start as their areas land, but the preregistration freeze (K6) waits on G2 plus the task pool (K1), the harness (K2), and the data archive infrastructure (K5). The pilot (K7) waits on K6. The confirmatory run (K8) waits on the pilot's power computation. The repeatability substudy (K9) runs after or alongside K8 per the frozen protocol. Independent verification (K10) waits on all runs being captured.
6. **Phase 4 deliverables:** the paper (D3) and HTML scaffold (D2) start in Phase 0 and grow through every phase; the report draft (D1) starts with the first verified scoring output; all three finalize only after gate G3. The data archive audit (D4) closes the commission at G4.

Hard ordering rules: no build before the revision gate; no "with" run before the preregistration freeze; no publication before independent verification; no result claimed from a run whose raw data is missing (a missing artifact is a recorded data-loss failure, never silently reconstructed evidence).

## 5. Issue list

Every issue the repo setup creates, in phase order. Each issue carries an Acceptance heading with at least one unchecked checkbox (runner intake silently drops issues that lack them) and the Section 0 scope boundary in its body. Owners: O = Unified MCP Server chat (owns the domain and verifies); E = Studio lanes via runner (execute); V = independent verifier (verifies, assigned before confirmatory execution).

**Phase 0, revision:**

1. Scaffold the `fleet-mcp` repo: Worker project, D1 migrations skeleton, CI, deploy pipeline, sweep harness skeleton, and issue templates. (O/E)
2. Revise the PRD: write the Studio connector/sidecar spec (R1), covering event push, local probes and suites, file bytes and hashes, identities, heartbeat, offline behavior, and personal-only ingestion. (O)
3. Revise the PRD: write the cache identity and safety contract (R2), covering complete computation identities, enforceable freshness, durable snapshots, transactional events, concurrency and idempotency, and Render identity. (O)
4. Revise the PRD: rewrite the auth model (R3) with namespace ownership, the per-operation capability matrix, per-area scopes, and allowlists across all resource classes. (O)
5. Revise the PRD: specify the control-plane operations (R4), including exemplar publish, brief revise, lesson quarantine, fleet event ingestion, and token and allowlist management. (O)
6. Revise the PRD: rewrite the benchmark statistics (R5), covering the primary endpoint, estimands, multiplicity, non-inferiority, cache condition, contamination, token accounting, fault injection, the task pool, and power. (O)
7. Revise the PRD: fix the single-model scope (R6) to Codex solo with a pinned model ID, a cohort-stop rule, Codex-sample baselines, and the judge-panel resolution. (O)
8. Revise the PRD: add Section 11 deliverables (R7) with paths and phase gates for all seven binding deliverables plus the reliability and accuracy measurement contract. (O)
9. Revise the PRD: apply the remaining review fixes sweep (R8), covering reconciliation, bounded waits, idempotency, the sweep fixture, cursor standardization, the Render split trigger, retention, and cross-references. (O)
10. Align the paper skeleton with the revised PRD: restate H1-H7 with the resolved estimands and Codex-sample baselines, record the judge-panel resolution, and match the methods to revised Section 8. (O)

**Phase 1, spike:**

11. Spike: build the shared core slice (content store, versions, change feed, auth, freshness metadata) exercised by one read path. (E)
12. Spike: build the minimal Studio sidecar (one event class pushed, one local probe, one file hash comparison) against real personal-project data. (E)
13. Spike: build the Issue Context and Recall read paths over real personal-repo issues and the real personal lesson corpus. (E)
14. Spike: build read-only Fleet Status plus the bounded `fleet_wait_for` slice with a resumable `wait_id`, driven by real sidecar events. (E)
15. Spike: prove the platform (Streamable HTTP in the Codex client, waits across disconnects and deploys, Browser Rendering reuse and queued renders, one named local suite, connector offline and recovery). (E)
16. Spike verdict gate: evaluate all eight proof criteria from Section 3.2 and record a dated go/no-go for the full v1 build. (O)

**Phase 2, build:**

17. Build the shared core in full: store, registry, transactional change feed with outbox, cache layer, delta engine, auth and audit, idempotency, optimistic concurrency. (E)
18. Build the Studio sidecar in full: ingestion, local probes and suites, file bytes and hashes, heartbeat and offline behavior, sync reconciliation, lesson write-back outbox. (E)
19. Build Exemplar plus Brief with control-plane publish and revise paths, and seed the corpus from personal repos per the preregistered seed list. (E)
20. Build Recall in full: ranked query with corpus-generation invalidation, D1-first learn with durable write-back status, quarantine and flag, store health. (E)
21. Build Issue Context in full: durable D1 snapshots, webhook invalidation plus reconciliation sweep, idempotent comment writes, PR reads. (E)
22. Build Fleet Status in full: sidecar ingestion, durable waits with change-feed fanout, preflight split into server and local probes. (E)
23. Build Verify in full: pure checks server-side, suite results keyed by complete computation identity, deploy status by immutable deployment ID, live checks with fresh observation. (E)
24. Build Render inside Verify: durable render jobs, the resolved fingerprint model, warm browser pool with isolation, quotas, cost accounting. (E)
25. Build Handoff in full: fenced checkpoints, resume composition with pinned versions and watermarks, run history with stable attempt IDs, cancellation and supersession. (E)
26. Build the control plane: token management, allowlist management, sync reconciliation, admin endpoints, audit log with the field-allowlist sanitizer. (E)
27. Build the deploy pipeline and operations: expand-then-contract migrations, post-deploy sweep on the fixture namespace, rate limits and quotas, observability, alerts, backup and restore. (E)

**Phase 3, benchmarks:**

28. Assemble the benchmark task pool: a ranked pool of at least 60 personal-project tasks with disjoint pilot and confirmatory sets, a recorded seed, and personal-project baseline waste rates measured on the pool. (O)
29. Build the benchmark harness, scoring script, and Codex token and cost capture, plus the measurement schema in `benchmark/metrics.md`. (E)
30. Build deterministic replays R1-R7 as runnable scripts, with in-scope inputs verified and results labeled as mechanism upper bounds. (E)
31. Build the new benchmark suites (cache, freshness, resume, faults, Render) and the reuse matrix for llm-bench, model-familiarity-engine, KERNEL, and transcript baselines with pinned revisions. (E)
32. Build the data archive infrastructure: collection matrix, append-only index, expected-run ledger, mirror, retention policy, and restore drills, live before the first run. (E)
33. Freeze the preregistration (`bench-prereg-v1`, tag plus SHA-256 plus remote timestamp) before the first "with" run. (O)
34. Run the pilot (10 tasks x 2 arms), validate the harness, and compute the confirmatory N from the pilot variance using an upper confidence limit of the pilot SD. (E)
35. Run the confirmatory experiment (floor 30 tasks x 2 arms, cap 50 tasks x 2 arms) per the frozen protocol. (E)
36. Run the repeatability substudy (10 tasks, two extra runs per arm, cache reset per run). (E)
37. Run independent verification: scorer re-run plus independently derived spot checks, with a receipt and a CERTIFIED or NOT CERTIFIED verdict. (V)

**Phase 4, deliverables:**

38. Write the full report (deliverable 1) from verified scoring output, with CIs and N on every headline number. (O)
39. Build the HTML deliverable (deliverable 6): scaffold before experiments, finalize after independent verification, acceptance by opening the rendered page. (O/E)
40. Write the research paper (deliverable 7) through its writing gates, with final claims only after independent verification. (O)
41. Audit the data archive (deliverable 4): verify every hash, confirm the second copy, pass a restore drill, close the index. (O/V)

**Issue count: 41.**

## 6. Repo

**Name: `fleet-mcp` (confirmed).** The PRD proposed `ariaxhan/fleet-mcp`, the paper title is "Fleet MCP", and neither review objected to the name (Codex: "Fleet MCP is clear enough for a personal fleet-state service"; Claude: "No objection to either proposal"). No better name was proposed by either review, and the name already anchors the paper title, the PRD, and the skeleton. Keep it.

**Domain:** `mcp.ariaxhan.com` for production and `staging.mcp.ariaxhan.com` for staging remain proposals; the final domain choice is Aria's call, and neither ownership nor availability is established in the PRD. Tool names and resource schemes are domain-independent either way.

**Repo layout (target):**

```text
fleet-mcp/
  PRD.md                      # PRD v2 (revised per Section 3.1)
  _meta/chronicles/           # decision chronicles, including the Fleet MCP chronicle
  src/                        # the Cloudflare Worker (one codebase, modules per area)
  sidecar/                    # the Studio sidecar
  migrations/                 # forward-only D1 migrations (expand-then-contract)
  wrangler.toml
  benchmark/
    preregistration.md        # frozen at bench-prereg-v1
    preregistration.json      # machine-readable, same content
    metrics.md                # the measurement contract
    README.md                 # how to reproduce every number with one command
    harness/                  # agent experiment runner, scoring, verifiers
    replays/                  # one runnable script per replay R1-R7
    suites/                   # new suites (cache, freshness, resume, faults, Render)
    tasks/                    # the ranked task pool
    fixtures/                 # personal-only fixtures
    data/
      DATA_INDEX.md           # every artifact, hash, location, run id
      index.jsonl             # append-only artifact index
      ledger.md               # the expected-run ledger
  paper/
    manuscript.md             # grows from skeleton.md during the experiments
    references.bib
    figures/
    evidence-map.csv
    README.md
  docs/report/index.html      # the HTML deliverable
  report/
    report.md                 # the full report
```

## 7. Runner integration notes

- **Single execution system.** `com.nexus.runner` is the single execution system for all work (Tower and the TBS coordinator were deleted Nov 15, 2026; never reference them as live). All build and benchmark work in this plan runs as runner issues in `ariaxhan/fleet-mcp`.
- **Intake coverage.** Runner intake covers thinking-brain-school, Thinking-Brain-School/*, Vaults, and nexus-office. The repo setup must confirm intake covers the new `fleet-mcp` repo and add it if it does not, before filing the Section 5 issues; otherwise the issues will sit unpicked-up.
- **Intake shape.** Runner intake silently drops issues lacking an Acceptance heading plus an unchecked checkbox (a recurring gap; Nov 19 saw issues patched per-issue). Every issue in Section 5 carries both. A durable intake fix is still owed elsewhere; this plan does not depend on it.
- **Ownership.** The Unified MCP Server chat owns this domain end to end. Main routes to it and never orders execution into a non-owning chat. No chat chains. If the work needs Aria, the question goes to `ariaxhan/muse-asks` with the full template, never in chat and never in a digest (digests are dead as of Nov 21, 2026).
- **Delegation.** Muse coordinates, verifies, judges, and talks to Aria; it does not burn its own allowance on heavy execution. Build and benchmark runs go to Studio lanes via the runner. A dead worker is re-dispatched, never taken back inline. Direct-do applies only to genuinely small work.
- **Verification.** Done means a commit on main, verified on its surface by the owning chat, never from another chat's report. The independent verifier for the benchmark (Section 3.4, item K10) is separate from the benchmark runner and is assigned before confirmatory execution.
- **No approval wait.** Aria ordered the repo setup, runner integration, and all issues with no approval wait. Questions that genuinely need her go to muse-asks with a stated default and proceed time; reversible defaults auto-proceed when the proceed time passes unanswered; irreversible, spending, identity, and security items never auto-proceed.

## 8. Benchmark and data plan

### 8.1 Design (summary of revised PRD Section 8)

One model (Codex solo, exact ID pinned in `bench-prereg-v1`). Two arms per task: with the server (tools plus today's baseline) and without (today's baseline only: brief, files, CLI, bash agentdb). Same brief, same starting state, arm order randomized, fresh agents per arm, isolated worktrees and fixtures, cache reset per run. Primary endpoint: total tokens per task, paired, as the mean of per-task log ratios back-transformed to percent change, BCa bootstrap 95% CI primary, paired t-interval as robustness check. Key secondaries (Holm-corrected): wall-clock time, correctness. All other thresholds exploratory. Correctness non-inferiority preregistered as likely UNPROVEN at N 30-50 unless its own power analysis supports it. Deterministic replays R1-R7 first (mechanism upper bounds, exact counts). Then pilot 10x2, confirmatory floor 30x2 with a 50x2 cap (N from the pilot variance using an upper CL of the pilot SD), repeatability substudy 10 tasks x 2 extra runs per arm. Minimum 120 runs. Preregistration frozen (git tag plus SHA-256 plus remote timestamp) before the first "with" run. Independent verification before any publication.

### 8.2 Metrics (the measurement contract)

Per task, in both arms: input, output, and cache-read tokens (separately, plus the defined primary total); wall-clock time (plus tool time as a subset); tool calls by type and class; cache hits and misses per tool (with arm); errors (failed commands, wrong-file reads, reverted edits, verification failures after done claims); outcome correctness (binary correct completion plus a graded score where defined); adoption (recall ran, checkpoint saved, preflight run); cost (model cost plus allocated server cost, separately); reliability (first-attempt success, eventual success, re-attempt rates with distinct denominators, worker deaths, timeouts, authentication failures, stale-cache results). Every metric's unit, denominator, capture source, aggregation, missing-data rule, and interval method is frozen in `benchmark/metrics.md` before the freeze. The report table carries control, treatment, absolute difference, relative percent change, CI, N, and evidence link for all four outcomes.

### 8.3 Data (deliverable 4)

Gather as much as possible and lose nothing. The collection matrix covers baseline fixtures, pilot, confirmatory and repeated runs, failures, interruptions, exclusions, amendments, raw transcripts, tool, server, and upstream logs, measurements, outcome artifacts, renders, analysis inputs and outputs, and verifier receipts. Every artifact is indexed append-only (`index.jsonl` plus `DATA_INDEX.md`) with IDs, arm, phase, timestamps, provenance, protocol, model, and build versions, location, byte size, and checksum. The expected-run ledger makes a missing run visible. Capture is continuous and durable (local spooling, resumable uploads, checksum and completeness verification, archive acknowledgements, reconciliation against the ledger); local captures are not deleted until archive verification and an independent backup succeed. Retention is indefinite for collected experiment evidence, with a second independent copy, scheduled integrity checks, and restore drills. Raw transcripts are encrypted; redacted copies are kept separately with a redaction manifest. Data loss is a failure condition, recorded as such, never silently reconstructed.

## 9. Risks

Ranked by impact and dependency on unresolved design (Codex's ranking, adopted):

| Rank | Risk | Mitigation in this plan |
|---|---|---|
| 1 | False verification or freshness: a reused green check or render certifies the wrong artifact | R2 (complete computation identities, enforceable freshness), adversarial cache tests in the spike, fault-injection suites |
| 2 | Incomplete source and connector boundary: central tools cannot deliver their promised behavior from cloud components alone | R1 (sidecar spec), spike proof criterion 2, explicit deferral of unsupported behaviors |
| 3 | Unauthorized corpus or credential exposure | R3 (namespace ownership, capability matrix, full allowlists), boundary tests with synthetic excluded identifiers |
| 4 | Cross-store inconsistency and duplicated effects | R2 (transactional events, outbox, idempotency, optimistic concurrency), reconciliation |
| 5 | Benchmark overclaim | R5 (defensible statistics), R6 (single-model scope), preregistration freeze, independent verification, UNPROVEN labeling |
| 6 | Long-running work and resource exhaustion (browsers, waits, refresh storms, retries) | Spike platform proof, durable jobs, quotas, budgets, circuit breakers, measured costing |
| 7 | Recovery, retention, and schema operations | Expand-then-contract migrations, restore drills, committed retention policy, isolated fixtures |
| 8 | Adoption and scope inflation: 33 tool schemas consume savings before agents use the right paths | Thin vertical slice first, schema overhead measured, scope-filtered tool lists, adoption measured alongside outcomes |

Additional named risks from the PRD (Section 9.1), carried forward: single point of failure (fallback to today's CLI paths; local checkpoint mirror or degraded mode per R8); GitHub API rate limits (server-side caching plus quota reporting in `/health`); stored-content prompt injection (provenance, data-not-instructions marking, quarantine); task selection bias (preregistered pool and selection rule, independent audit); TBS boundary failure (whitelist enforced in code, refusal test, webhook drops).

## 10. Acceptance criteria

**The commission is complete only when all of the following hold:**

1. **Revision done:** PRD v2 committed, gate G0 passed (Section 3.1).
2. **Spike passed:** all eight proof criteria green, gate G1 passed with a dated go verdict (Section 3.2).
3. **Server built:** the full-v1 acceptance matrix green on real personal-project data, gate G2 passed; all 33 tools plus control-plane additions implemented, deployed, and swept (Section 3.3).
4. **Benchmarks run:** preregistration frozen before the first "with" run; replays R1-R7 complete; at least 120 agent runs executed per the frozen protocol with complete capture; suites runnable from a fresh environment; gate G3 passed (Section 3.4).
5. **Data preserved:** every expected run accounted for in the ledger; every hash in the index verified; second copy confirmed; restore drill passed; no recorded data loss (Section 8.3).
6. **Independently verified:** the verifier's receipt is on file; counts match exactly; derived statistics match within the preregistered tolerance; a random sample of raw metrics re-derived independently; the verdict is CERTIFIED, or NOT CERTIFIED with the failure documented honestly (Section 3.4, item K10).
7. **Report published:** the full report carries all four outcomes with CIs, N, and evidence links, plus error rates, re-attempt rates, cost, and wall time per task; every headline number traces to archived raw data; UNPROVEN items labeled UNPROVEN (Section 3.5, D1).
8. **HTML delivered:** `docs/report/index.html` opens, reads end to end without the repo, and matches the paper's numbers (generated from the same scored data) (Section 3.5, D2).
9. **Paper written:** the manuscript covers the full experiment with writing gates honored, every quantitative claim mapped to protocol version, raw artifact IDs, analysis revision, and verification receipt (Section 3.5, D3).
10. **Single model honored:** every benchmark run used the pinned Codex model; any provider change triggered the cohort-stop rule with preserved data and a protocol amendment, never pooled versions (Section 3.1, R6).
11. **Scope boundary held:** no TBS data, repo, issue, or MCP content was read, ingested, or served at any point; the boundary test suite passes (Section 0).
12. **Evidence standard honored:** preregistration predates the "with" side; CIs accompany every claimed effect; nothing is inflated or rounded up; null and negative results are reported (Section 1.3).

## Appendix: source map

- Baseline evidence: `report.md` and `analysis/` (same directory as this plan's source copies).
- PRD: `PRD.md`.
- Reviews: `reviews/codex-review.md`, `reviews/claude-review.md`.
- Paper skeleton: `paper/skeleton.md`.
- Decision chronicle: `chronicle.md` (same directory; the repo setup places it in the new repo's `_meta/chronicles/`).
