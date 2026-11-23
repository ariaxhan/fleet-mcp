# Design review: Fleet MCP PRD (draft of Nov 22, 2026)

## 1. Summary verdict

The PRD is well grounded and unusually honest. Every measured number traces to the report, limitations are carried forward (Section 1.2 negative results, Appendix B), and the benchmark plan takes preregistration, blinding and UNPROVEN labeling seriously. The Context side and the shared content-addressed core are sound. It is not ready to build or to benchmark as written, for four reasons:

1. **The State side has no data path from the Studio.** Flights, jobs, local credentials, local files and local check suites all live on the Studio, but the only sync the PRD defines is for agentdb (Sections 3.2, 4.4).
2. **Cache state is uncontrolled.** The benchmark never says how warm or cold the server is between runs, and an uncontrolled warm cache can manufacture the effect being measured (Section 8.4).
3. **The statistics need tightening.** There is no primary endpoint, the threshold semantics are ambiguous, and the non-inferiority test is underpowered (Sections 8.4, 8.7).
4. **Four of the seven binding deliverables are missing.** The PRD does not cover single-model Codex solo, the HTML page, the research paper written during the work, or the benchmark suites as preserved deliverables (Sections 8, 10).

**Verdict: revise before freezing the preregistration.**

## 2. Design review

### 2.1 Context plus State architecture (Section 2)

**Sound**
- One server, one core, two sides (Sections 2.1, 2.2). The waste that matters is cross-session and cross-attempt (Section 1.2: within-session repetition is near zero), so one shared cache and change feed is the right shape.
- The core is clean:
  - content-addressed store plus monotonic versions
  - one append-only change feed
  - a `meta` freshness block on every response (Sections 2.2, 3, 7.4)
- Composition paths are explicit rather than emergent (Section 2.4). `handoff_resume` composing Brief, Recall and Issue deltas is the strongest idea in the PRD.
- Declining to build a search cache follows from measured data (Section 1.2: 1,021 `vaults find` runs, 1,018 distinct), which is good discipline.
- Render placement (Section 2.3) is right. Render shares Verify's cache key style, evidence shape and consumers. Stable names (`verify_render`, `render://`) leave room for a later split.

**Missing or weak**
- **Where state lives (the biggest gap).** Section 2.5 puts Flights and Jobs in D1, and `fleet_get_flight` is a "live read from the state store" (Section 3.2). But the source of truth is the Studio runner (Section 1.2 cites `runner.sqlite`). No sync job, push path, or write API for flight and job events is specified. Without one, `fleet_wait_for` and `fleet_what_changed_since` have nothing to wait on.
- **Local execution.** Several tools need things a Cloudflare Worker cannot reach:
  - `fleet_preflight` probes Claude OAuth, Codex OAuth, wrangler and "repo checkout path" (Section 3.2). These are local to the machine running the agent.
  - `verify_check` takes a `file` path and "named check suites" such as `npm run verify` (Sections 3.2, 8.3). The Worker has neither the file nor the repo.
  - `handoff_resume` returns `what_changed` "for every file the checkpoint names (hash comparison)". The server has no current hashes of local files unless the caller sends them.

  The architecture needs a third component: a **Studio-side agent or sidecar** that executes local checks and probes and pushes results. Alternatively the tools take caller-supplied hashes and results. Either way, the PRD must say which.
- **The "accelerator, never a hard dependency" claim (Section 9.1)** conflicts with Section 4.4, where D1 is first-write for lessons, and with Handoff checkpoints, which live only in D1 plus R2. When the server is down, a checkpoint written there is unreachable. Define the fallback: local checkpoint mirror, or degraded mode.
- **Change feed ordering.** One sequence number in D1 is fine. But `fleet_what_changed_since` takes only a `timestamp` (Section 3.2), while Section 7.2 says `since` accepts a timestamp, version or sequence. Timestamps are unsafe cursors (clock skew, events in the same millisecond). Make the sequence number the canonical cursor everywhere and return `next_cursor`.
- **Render split trigger.** Section 2.3 says the trigger is "preregistered as an open question in Section 9". An open question is not preregistered. Either set the trigger (see answer 3) or drop the word.

### 2.2 The 33 tools (Section 3, Appendix A)

The count checks out: 5+4+4+3+6+7+4 = 33 tools, and 15 resource types.

**Sound**
- `<area>_<verb>` naming fits MCP tool-name rules.
- The dedup decisions are good: `get_brief`, `render`, and `diff_screenshots`/`visual_diff` each live once (Section 3).
- Every tool has explicit caching semantics.

**Missing tools**
- **Exemplar or doc write path.** There is no `exemplar_publish` or `doc_put`. Section 4.3 says updates create versions, but no tool or ingestion job creates them. Without a write path, the corpus cannot be seeded (deliverable 2).
- **Flight and job ingestion.** There is no `fleet_record_event` (or sync endpoint) for the runner to push state.
- **`fleet_list_jobs`.** Flights have get and list; jobs have only get.
- **PR tools.** The `pr://` resource exists, but there is no `pr_get` or `pr_list`, even though the baseline counts 86 PR ops (Section 1.2).
- **`doc_what_changed`.** Docs share the exemplar shape but have no delta tool, and docs are the `CLAUDE.md` re-read class (18 re-reads).
- **Lesson quarantine.** Section 9.1 promises "flag and quarantine by id", but there is no `recall_flag`, `recall_quarantine`, or supersede tool.
- **`handoff_get_checkpoint`.** A specific checkpoint by number is reachable only as a resource.
- **`brief_list`.** There is no way to find briefs, and no brief versioning tool other than run recording (see "Should be fixed" below).
- **`verify_list_checks`.** There is no discovery tool for named suites and their versions. Section 7.1 makes check version part of the key, so agents need to see it.
- **Benchmark instrumentation.** There is no `server_info` or `session_tag` tool to stamp the benchmark run id into the audit log. Section 8.1 adoption metrics need a join key between transcript and audit log.

**Merge candidates**
- `exemplar_*` and `doc_*` have the same shape (Section 3.1 says so). Merge them into one area (`ref_get`, `ref_list`, `ref_what_changed`, with a `kind` field), or rename `doc_*` to keep `<area>_<verb>` consistent. As listed, `doc_get` sits in the Exemplar area and breaks the naming rule.
- `lesson://` and `gotcha://` are redundant, because `kind` is a field on lessons. Use one resource type.
- `verify_get` and `verify_get_render` are pure reads by key. They could be resources only, which cuts schema tokens (see below).

**Split candidates**
- `verify_check` mixes pure, fast, server-runnable checks (json-parse, em-dash-scan, md5) with Studio-only suites that depend on the whole repo. Split it into `verify_check` (server-side, pure function of supplied bytes) and `verify_record_suite` (results pushed from the Studio, keyed by repo tree hash, suite version and environment).
- `fleet_preflight` mixes server-probeable checks (GitHub token, Cloudflare and Vercel APIs) with local ones (OAuth, checkout). Same split.

**Naming inconsistency.** The delta tools are named `exemplar_what_changed`, `issue_what_changed` and `fleet_what_changed_since`. Pick one verb, and one cursor parameter (`since`).

**Schema token cost.** The 33 tool schemas load into every turn. Section 9.1 acknowledges this ("The server's own token cost"), but the design has no mitigation. Ways to keep the treatment arm's input tokens from swallowing the savings:
- expose tool subsets per token scope
- move pure reads to resources
- use an area-filtered `tools/list`

**Should be fixed**
- `brief_record_run` "Updated brief version" means every run bumps the brief version, which conflates brief content changes with run history. Runs should go to the change feed and `run://` without versioning the brief body. Otherwise `brief_get(version)` pinning in Handoff (Section 2.4) breaks on every run.
- Write tools (`recall_learn`, `brief_create`, `brief_record_run`, `issue_comment`, `handoff_save_checkpoint`) need an **idempotency key**. Streamable HTTP retries will otherwise duplicate GitHub comments, which are outward-facing and hard to retract, and duplicate lessons.

### 2.3 Data model (Section 4)

**Sound**
- Append-only versions with tombstones (Section 4.3).
- R2 objects named by content hash.
- "KV is a cache, never the record" (Section 4.2).
- The governing rule that content-addressed entries cannot go stale (Section 4.5).
- Secrets are never stored, and credential status is liveness only (Section 4.1).

**Missing or weak**
- **KV consistency.** Section 4.5 says issue bodies are invalidated "immediate" on webhook, and current-version pointers are "immediate, write-through". Cloudflare KV is eventually consistent across locations, so a delete or overwrite is not instantly visible everywhere. Fix one of two ways:
  - Keep mutable pointers (current version, issue version) in D1 or a Durable Object, and use KV only for immutable bodies keyed by hash or version (which cannot go stale).
  - Downgrade "immediate" to "eventual" in the freshness contract.
- **Verification cache key is too narrow** (Sections 4.1, 7.1). The key is (file_hash, check list hash) plus tool and check version. Gate checks like the lesson gate or `npm run verify` depend on the whole repo tree, dependencies and environment, not on one file. The key must include the full input closure (tree hash or dependency-file hashes, lockfile hash, runtime version). Without that, Section 7.3's "No stale green" does not hold, and stale greens are exactly the failure mode behind the 48 post-done verification failures (Section 1.2).
- **Render key circularity.** `verify_render` "re-renders only when the content hash changed" (Sections 3.2, 4.5). Knowing the content hash requires fetching the page, and a signed-in, locale or theme state also changes output. Specify:
  - how the hash is computed (fetched HTML, or a deploy id from `verify_deploy_status`)
  - that a fetch is still made
  - how dynamic content (timestamps, ads) is normalized
  - where signed-in state credentials come from (they are not in the auth model, Section 6)
- **agentdb sync (Section 4.4).**
  - **Sound:** incremental sync, D1-first with recorded write-back failure, and personal DBs only.
  - **Sync conflicts.** "Owning agentdb DB" is undefined for lessons created through MCP, since `recall_learn` has no target-DB parameter (Section 3.1). The 77 DBs have 15 with stale schema, so the sync must handle schema drift per DB. There is no conflict rule for a lesson edited on the Studio and in D1 at once.
  - **Lesson id.** The id is "stable, content-derived" (Section 4.1), but content changes on edit, so the id would change. Use a stable id plus a content hash field.
  - **Allowlist mechanism.** The sync allowlist for DBs is not the same as the repo allowlist (Section 6.4). Define how a DB is mapped to personal versus excluded (a path allowlist on the Studio side, enforced before upload, not after).
  - **Timeliness.** The sync is pushed by the Studio. Recall freshness on other machines depends on the Studio being up. Make this explicit in `recall_store_health`.
- **Issue change events and webhooks.** Section 4.1 says issue version "increments on every GitHub change event". Webhooks can be missed, so `issue_what_changed` claiming "no upstream call when the feed covers the window" (Section 3.1) needs a coverage high-water mark plus a periodic reconciliation sweep. Without both, a missed webhook silently drops a change from the feed.
- **Growth.** Retention for the audit log, change feed, checkpoints and renders is unset (Section 9.2 Q5). The audit log grows on every call, and D1 has per-database size limits. Set retention or a rollup policy before Phase 4, so benchmark-period records are never pruned.

### 2.4 Cloudflare deployment (Section 5)

**Sound**
- One Worker as the unit of deploy and rollback.
- Streamable HTTP only.
- `/health` reports per-dependency status, and `/version` reports the commit.
- Forward-only migrations in the repo.
- The post-deploy sweep modeled on the Teaching MCP pattern (282 checks, all pass, cited in Section 5.2 as project evidence).
- Observability from the audit log without an extra service.

**Missing or weak**
- **Sweep target contradiction.** The sweep "runs against the production endpoint" but "exercises every tool once against staging data" (Section 5.2). Pick one. If it runs on production, write tools (`issue_comment`, `recall_learn`, `brief_create`) need a dedicated fixture repo and a fixture namespace, or the sweep will post real comments and write real lessons on every deploy.
- **Migration ordering.** `wrangler d1 migrations apply` "as part of deploy" plus code that depends on the new schema creates a window where old code meets the new schema, or the reverse. Use expand-then-contract migrations, and run the migration step before `wrangler deploy` with a sweep between.
- **Rollback and data.** `wrangler rollback` reverts code, not D1 schema. Forward-only migrations mean a rollback must stay compatible with the newer schema. State this rule.
- **Durable Objects.**
  - One object per waited condition (Section 2.5) is fine, but the PRD does not say what wakes the object. It needs the change feed to notify it, which means feed writes must fan out to subscribed objects.
  - `fleet_wait_for` max 3,600 s (design decision, Section 3.2) almost certainly exceeds MCP client tool-call timeouts. Return early with a resumable `wait_id` and have the agent re-call. Or use SSE progress, but confirm the target Codex client actually holds a long tool call open.
- **Browser Rendering.** A "warm browser pool" (Section 2.5) needs explicit session reuse (typically via a Durable Object holding browser sessions), plus account concurrency limits. The "queued render with a pollable `render_id`" path (Section 5.1) reintroduces polling. Pair it with `fleet_wait_for` on a render-complete condition.
- **Staging data.** "Staging D1" per PR preview (Section 5.2) needs a seeding story, or every preview sweep runs against an empty store.
- **Backup.** R2 holds the benchmark raw-data archive (Section 8.8), and D1 holds the registry. Neither has a stated backup or export. D1 has point-in-time restore, but the archive should also have an off-Cloudflare mirror (see deliverable 4).

### 2.5 Auth model (Section 6)

**Sound**
- Per-caller tokens.
- Hashed storage.
- Read, write, preflight and admin scopes.
- Expiry plus instant revocation (90 days, labeled a design choice).
- Upstream secrets never in responses or logs.
- An allowlist (not a blocklist) enforced in code, with a refusal test (Sections 6.4, 9.1). That allowlist is the code-level enforcement of the Section 0 scope boundary.

**Missing or weak**
- **Storage contradiction.** Tokens are "stored as Workers secrets (a hashed token table in D1)" (Section 6.2). Those are two different mechanisms. Use the D1 hash table, and keep only a pepper or HMAC key as a Worker secret.
- **Scope granularity.** `read` covers "all get, list and what_changed tools". That gives every reader flights, jobs, checkpoints, lessons and issues. Section 6.1 says clients cannot see fleet state "unless explicitly granted", but no scope expresses that. Add per-area scopes (`context:read`, `fleet:read`, `handoff:write`, and so on) plus repo filters.
- **`preflight` scope** reveals which credentials are dead. That is low risk but useful to an attacker, so keep it agent-only.
- **Sync token.** `/internal/sync` can write the lesson index, which agents read back as context. That makes it a prompt-injection vector (Section 9.1). Bind it to a sign-in identity or a Cloudflare Access service token, not only a bearer token, and log and alert on unusual volume.
- **ChatGPT and Claude admin use** (Section 6.1). Hosted connectors may expect the MCP authorization flow (OAuth) rather than a static bearer token. Verify this against current connector docs before relying on it. It is listed as how the admin token is used.
- **Audit inputs.** "Sanitized: no secrets" (Section 4.1) still logs comment bodies and lesson text. Define the sanitizer (field allowlist, not regex redaction) and set retention.
- **Stored-content injection** (Section 9.1). Provenance plus quarantine is the right direction, but enforcement is missing:
  - mark served lesson text as data (a field, not prose)
  - cap its length
  - add the quarantine tool listed in Section 2.2
- **Client tenancy** is deferred to Phase 5 (Section 10), which is correct. See answer 2.

### 2.6 Caching, versioning and delta (Section 7)

**Sound**
- Keys built from canonical inputs plus tool and check version (Section 7.1).
- `unchanged: true` responses.
- A single change feed as the sole delta source (Section 7.2).
- An explicit freshness contract, with stale-while-revalidate limited to issue bodies and state snapshots (Section 7.4).

**Missing or weak**
- **Input closure.** Section 7.3 step 3, "No stale green", holds only if the key includes the full input closure (see Section 2.3 above).
- **Byte-identity claim.** Section 7.3 says the response is "byte-identical to what Agent A got, plus the cache metadata". Define canonical JSON serialization, or the claim is untestable.
- **Freshness leaks.** "Never hides staleness" (Section 7.4) breaks down when the KV pointer lags (Section 2.3 above). `cache_status: hit` could be served for an outdated pointer.
- **Recall cache invalidation.** "New lesson recorded that matches the query terms" (Section 4.5) needs a matching function. Ranked recall can change results without a term match. The simpler rule is to bump a global lesson-index version on any write and include it in the key.
- **Unified diffs for exemplars.** Diffs help only if the agent actually holds version N in context. After compaction (76 compactions in Codex, Section 1.2) it does not. Return `unchanged`/diff only when the caller passes `since_version`, never infer it, and measure whether agents do pass it.

## 3. Gaps and risks

| # | Gap or risk | Severity | Fix or follow-up |
|---|---|---|---|
| G1 | No Studio-to-server path for flights, jobs, local credentials, local files or local suites (Sections 2.5, 3.2, 4.1) | High | Add a Studio sidecar spec: push flight and job events into the change feed, run local probes and suites, and push results keyed by tree hash. Or redesign the tools to take caller-supplied hashes and results. |
| G2 | Benchmark cache state uncontrolled: with-arm runs inherit caches warmed by earlier runs and the pilot, and Phase 3 re-runs hit the first run's cache (Section 8.4) | High | Preregister cache condition per run (cold reset of KV, verification and render stores per run, or an explicit warm condition as a separate factor). Record cache hits by origin run id. |
| G3 | Verification cache key omits repo, dependency and environment closure (Sections 4.1, 7.1) | High | Key = check version + tree hash (or dependency-file hashes) + lockfile hash + runtime version. Add a test that a dependency change misses. |
| G4 | No single model named; thresholds use Claude baselines while deliverable 5 requires Codex solo (Sections 8.2, 8.4, 8.7) | High | Name Codex solo, pin the exact model id, CLI version and reasoning setting in the preregistration. Restate baselines using Codex-sample numbers. |
| G5 | No primary endpoint; seven thresholds with no multiplicity control (Section 8.7) | High | Pick one primary metric (total tokens, paired). Make wall-clock and correctness key secondaries with Holm correction. Label the rest exploratory. |
| G6 | Non-inferiority on correctness (5 pp margin) cannot be shown with 30 to 50 paired binary outcomes (Section 8.7) | High | Preregister that correctness non-inferiority will likely be UNPROVEN at this N. Add a continuous quality score, or use a one-sided rule ("no significant decrease") with honest labeling. |
| G7 | Exemplar and doc write path missing; corpus seeding undefined (Section 3.1, Appendix A) | High | Add `ref_publish` and an ingestion job from personal repos. Preregister which exemplars and docs exist at benchmark start. |
| G8 | Missing deliverables: HTML page, paper during experiments, suites as deliverables (Sections 8, 10) | High | Add Section 11 (Deliverables) with artifacts, paths and phase gates (see Section 7 of this review). |
| G9 | Data loss risk: R2 plus D1 in one account, no mirror, retention unset (Sections 5, 8.8, 9.2 Q5) | High | Add an off-Cloudflare mirror, a hash manifest, `DATA_INDEX.md`, and a "never delete" retention for benchmark-linked records. Pilot and excluded runs are archived too. |
| G10 | KV eventual consistency vs "immediate" invalidation (Section 4.5) | Medium | Keep mutable pointers in D1 or a Durable Object, and use KV only for immutable bodies. |
| G11 | Webhook loss leaves holes in the change feed (Sections 3.1, 5.1) | Medium | Add a coverage high-water mark per repo plus a periodic reconciliation fetch. |
| G12 | `fleet_wait_for` max 3,600 s vs client tool-call timeouts (Section 3.2) | Medium | Bounded waits with a resumable `wait_id`. Verify against the Codex client. |
| G13 | No idempotency on write tools; `issue_comment` is outward-facing (Section 3) | Medium | Add an `idempotency_key` to every write tool, stored in D1. |
| G14 | Post-deploy sweep target contradictory, and write tools would hit real repos (Section 5.2) | Medium | Fixture repo plus fixture namespace. Sweep staging pre-promotion and production post-deploy with read-only plus fixture writes. |
| G15 | Credential-liveness rule contradictory: "probed live on every call" (Section 3.2) vs 60 s TTL with a `fresh: true` param not in the tool schema (Section 4.5) | Medium | Pick one rule and add `fresh` to the schema if kept. |
| G16 | Token storage contradiction and coarse `read` scope (Section 6.2) | Medium | D1 hash table plus a secret pepper. Per-area scopes. |
| G17 | Tool-schema token overhead in the treatment arm (Sections 3, 9.1) | Medium | Measure schema tokens separately. Consider scope-filtered tool lists. Preregister which tool set the with arm sees. |
| G18 | Replays labeled "exact counts" (Section 8.3), but they embed avoidability assumptions the report says are unprovable (Section 1.2, necessity limitation). The Fleet Status replay "measures wall-clock", which is not deterministic. | Medium | Label replays as mechanism upper bounds. Check file-changed-between-reads where hashes are available. Drop wall-clock from replays or label it simulated. |
| G19 | Replays reprocess baseline transcripts. The Section 0 scope boundary must be checked for each replay input set. | Medium | Before running, verify each replay input is in scope under Section 0. If not, rebuild the replay from personal-project transcripts. |
| G20 | External validity: the measured waste comes from the baseline corpus, while benchmark tasks are personal-project only (Sections 0, 8.4) | Medium | Before preregistration, measure baseline waste rates on the personal-project task pool, so the effect is expected where it is tested. |
| G21 | `brief_record_run` bumps brief version, breaking version pinning (Sections 3.1, 2.4) | Medium | Version runs separately from brief content. |
| G22 | Section cross-references are wrong: Section 2.5 points the raw-data archive to 8.4 (it is 8.8); Section 8.3 points independent verification to 8.5 (it is 8.8); Section 2.3 says "preregistered as an open question" | Low | Fix the references. Wrong references in a preregistered document weaken it. |
| G23 | Lesson id "content-derived" yet stable (Section 4.1) | Low | Stable id plus content hash. |
| G24 | `lesson://` and `gotcha://` redundant; `doc_*` breaks `<area>_<verb>` (Appendix A) | Low | Merge. |
| G25 | Audit log stores sanitized inputs with no retention (Section 4.1) | Low | Field-allowlist sanitizer plus retention policy. |

## 4. Benchmark plan critique (Section 8)

**What is sound**
- Preregistration is frozen by a tag carrying its hash before the first with run, and amendments are versioned (Section 8.6).
- Pilot data is not pooled into the confirmatory result (Section 8.4).
- Paired design with fresh agents and randomized order (Section 8.4).
- Blinded scoring through a separate arm mapping (Section 8.2).
- Programmatic verifiers first (Section 8.5).
- The MFE-style NOT CERTIFIED verdict on provenance failure (Section 8.5).
- UNPROVEN labeling, null results reported, and no headline percentage without its CI and N (Section 8.8).
- Tokens are split into input, output and cache-read (Section 8.1).

These meet most of the research-paper evidence standard on paper.

**What to change**

1. **Preregistration content**
   - The "full task list" is frozen before the pilot, but confirmatory N runs anywhere from 30 to 50 (Section 8.4). Preregister a **ranked pool of at least 60 tasks**: 10 pilot tasks, disjoint from up to 50 confirmatory tasks, with a fixed draw order. The pilot and confirmatory tasks must be stated as disjoint, which they currently are not.
   - Also freeze:
     - model id and agent CLI version
     - the exact system-prompt delta between arms (the with arm needs instructions to use the tools, and that text is a confound)
     - cache condition (G2)
     - the server commit hash
     - the starting-state snapshot per task (repo commit, issue state)
2. **Sample size**
   - The power analysis takes the pilot SD at face value. A 10-task pilot SD is noisy and tends to underestimate. Use an upper confidence limit of the pilot SD (or a preregistered inflation rule) for the computation.
   - The 30-task floor justification ("30 paired observations is the minimum for a stable mean estimate", Section 8.4) is a rule of thumb, not a derivation. Keep the floor as a design decision, but label it that way rather than as a statistical fact.
   - The cap of 50 is fine if the UNPROVEN fallback is honored.
3. **Confidence intervals and analysis**
   - **Units.** Thresholds are percentages, but the analysis is paired raw differences (Section 8.4). Preregister the estimand: mean of per-task log ratios (with minus without), back-transformed, with a CI. This handles the heavy-tailed, heterogeneous tasks Section 8.4 itself documents (21 to 392 extra repeats).
   - **Primary interval.** Make the bootstrap (BCa, on the paired log ratio) or a Wilcoxon signed-rank interval the primary, and the paired t-interval the robustness check. That reverses the current order, which suits the skew.
   - **Threshold semantics.** "Mean reduction of at least 20%, with the 95% CI lower bound above 0" (Section 8.7) mixes a point-estimate bar with a significance bar. State plainly whether success means "point estimate ≥ 20% and CI excludes 0" or "CI lower bound ≥ 20%". These are very different claims.
   - **Missing data.** Write rules for aborted runs, timeouts and harness failures. Treat failures as outcomes, not exclusions, unless they are harness faults defined in advance.
4. **The 120-run minimum.** The arithmetic holds (20 + 60 + 40). The 40 repeatability runs need an analysis model, such as a mixed-effects model with task as a random effect and arm as fixed, so the run-to-run variance enters the confirmatory CI rather than being only described. Repeatability runs must reset cache state (G2), or the second and third with runs measure warm-cache performance.
5. **Evidence standard**
   - Independent verification (Section 8.8) re-runs the scoring script. It should also re-derive a random sample of raw metrics (token counts from transcripts) without the script, so a script bug cannot pass verification.
   - Set the "stated tolerance for derived statistics" in the preregistration, not later.
   - The judge panel follows MFE (panel agreement 0.74, n=339 cells, Section 8.8). Preregister an agreement floor below which judged correctness becomes UNPROVEN.
6. **Control-arm rule.** It is sound (see answer 8). Add an adoption-conditioned secondary analysis, labeled exploratory, because the intent-to-treat effect is diluted when the with-arm agent ignores the tools.
7. **Success thresholds**
   - The 20%, 15% and 50% targets are reasonable as preregistered targets.
   - Correctness non-inferiority at 5 pp is not testable at this N (G6).
   - "Zero sleep commands" and "zero dead-credential launches" are counts with no inferential content. Report them descriptively.
   - The 80% recall adoption target uses a Claude baseline (3 of 9). Under Codex solo, use the Codex baseline (6 of 193 recent Codex commands, Section 1.2). That figure measures commands rather than sessions, so restate the metric's unit.
8. **Data capture.** Specify how tokens and cost are captured from Codex sessions. Section 1.2 says Codex rollouts carry no cost field. Confirm token fields exist in the rollouts for the pinned model before the pilot, or the primary metric has no instrument.

**Verdict on Section 8.** The structure is research-grade. As written, it is not yet sufficient because of G2, G4, G5, G6, the units ambiguity, and the missing prompt-delta freeze. Fix these before tagging `bench-prereg-v1`.

## 5. Answers to Section 9.2 open questions

1. **Name and domain.** No objection to either proposal. Keep tool names and resource schemes domain-independent (they already are).
2. **Client isolation.** Use hard isolation: a separate Worker plus D1 per client, created from the same codebase. Per-token scoping in a shared D1 is one bug away from a cross-client leak. Defer this decision to Phase 5 (Section 10), and do not let it shape v1.
3. **Render split trigger.** Define it on metrics the daily audit summary already computes (Section 5.2): render share of Cloudflare spend, render share of total call latency, and the impact on non-render tool p95. Set the numeric values from Phase 3 measurements and record them as a dated amendment. Any number chosen now would be invented.
4. **Issue cache storage.** Put issue bodies in D1 (queryable, strongly consistent for the version pointer) and use KV only for hash-keyed immutable snapshots, if at all. This also resolves G10.
5. **Retention.**
   - Benchmark raw data, plus every record a benchmark run references (audit entries, checkpoints, renders, verification results): indefinite, mirrored off Cloudflare.
   - Everything else: a retention period decided after Phase 1 from measured growth, with rollups before deletion.
6. **Independent verifier.** It should be an agent not used as the benchmark subject, run on a separate account and machine. It receives only the archive, the preregistration and the scoring script, never the runner's prompts or report drafts. Aria spot-checks a preregistered random sample. A different model family as verifier does not conflict with deliverable 5, which constrains the agent under test.
7. **Task list.** Muse drafts the list by a mechanical rule: random draw from the runner's personal-project queues, stratified by waste class. The independent verifier audits it for representativeness before the freeze. Record the draw seed.
8. **Control-arm rule.** Agree: keep bash agentdb in the control arm. The claim is improvement over today's workflow. A stripped arm, if wanted, is a separate later ablation and not part of the confirmatory test.
9. **Preflight scope.** For v1, cover what the single-model benchmark needs: Codex OAuth, GitHub, wrangler and repo checkout. Defer Claude OAuth until multi-model work, or keep it if the runner needs it for non-benchmark lanes. All of these except GitHub are local, so they depend on G1.
10. **Rollout order.** Neither Context-first nor Fleet-first as written. Build a thin vertical slice first: core, Studio sidecar, Issue Context, Recall, and read-only Fleet Status. That lets the harness and pilot start early. Reprioritize by Codex-sample waste, given deliverable 5:
    - 1,309 extra repeated executions
    - 858 extra re-reads
    - 782 wait calls
    - 169 `vaults ctx` polls
    - 76 compactions

    The 311 sleeps and 179 sqlite3 queries cited in the question are Claude-sample numbers.
11. **Recall write-back failure.** D1-first is acceptable. The `recall_learn` response should return `writeback: pending|ok|failed`, and the failure should appear in `recall_store_health`. Do not fail the caller, because the lesson is durable in D1.
12. **Success thresholds.** Fix them in advance (preregistered). Pilot variance sets N, not the bars. Changing bars after the pilot is allowed only as a dated amendment before any confirmatory run, with the pilot excluded from confirmatory claims.

## 6. Top recommendations (prioritized)

1. **Lock the benchmark's single model and cache condition, then fix the statistics before freezing the preregistration.**
   - Name Codex solo (most recent) and pin its id.
   - Preregister the cache reset policy.
   - Choose one primary endpoint with Holm-corrected secondaries.
   - Define the estimand as paired log ratio with a bootstrap CI.
   - Disambiguate the threshold semantics.
   - Freeze the arm prompt delta.
   - Make the pilot and confirmatory task pools disjoint and ranked.

   Every reported number depends on this.
2. **Specify the Studio sidecar (G1)** for flight and job events, local probes, local suites and file hashes. Without it, the State side is not grounded on real data (deliverable 2).
3. **Add a Deliverables section (new Section 11)** covering the report, server, suites, data archive, HTML page and paper, with paths and phase gates. Start the paper scaffold now.
4. **Data preservation plan:** off-Cloudflare mirror, hash manifest, `DATA_INDEX.md`, and archiving of all runs including pilot, excluded and failed ones (G9).
5. **Fix the verification cache key** to include the full input closure (G3).
6. **Add the exemplar and doc write path and preregister the corpus seed** (G7).
7. **Smaller fixes:**
   - Move mutable pointers out of KV (G10).
   - Add webhook reconciliation (G11), idempotency keys (G13) and bounded waits (G12).
   - Fix the sweep fixture (G14) and per-area scopes (G16).
   - Correct the cross-references (G22).

## 7. Binding deliverables gap check

1. **Full report with percent change in tokens, speed, accuracy and reliability, plus other metrics**
   - **Supported:** tokens split three ways, wall-clock, correctness, errors, cost, adoption (Section 8.1). Per-task tables plus CIs (Section 8.8).
   - **Missing:**
     - Reliability is never defined as a metric. Re-attempt rate, worker-death recovery and completion rate are absent from Section 8.1, though re-attempts are the largest runner waste (488, 46% of 1,056 attempts, Section 1.2).
     - The percent-change estimand is undefined (Section 4 of this review).
     - "Wall time per task" is present, but "re-attempt rate" and "error rate" need operational definitions.
     - Server infrastructure cost (Cloudflare) is not counted in cost per task.
   - **Change:** add reliability metrics to Section 8.1 and Section 8.7, define percent change as the back-transformed paired log ratio, and add Cloudflare cost per task.
2. **Full MCP server (Context plus State plus Render), grounded on real data**
   - **Supported:** the full tool design across all areas (Sections 3, 10).
   - **Missing:**
     - No real-data path for flights, jobs, local credentials or suites (G1).
     - No exemplar and doc ingestion (G7).
     - Flight and job writes are undefined.
     - The Phase 5 client work is not needed for this deliverable.
   - **Change:** add the sidecar and ingestion specs. Add an acceptance criterion per area: "serves real personal-project data, verified by the sweep against production records".
3. **Benchmarks: reuse existing suites, build new ones, suites are deliverables**
   - **Supported:**
     - llm-bench as the verifier model.
     - MFE as the preregistration and verdict model.
     - The KERNEL design as the pilot.
     - Transcript baselines as replay inputs (Section 8.5).
   - **Missing:**
     - These are cited as patterns, not as runnable suites to deliver.
     - No harness repo layout, no run command, no README.
     - The replays (Section 8.3) and the agent-experiment harness are not named as preserved, documented artifacts.
     - model-familiarity-engine and llm-bench integration points are not specified (which verifiers are reused).
   - **Change:** add `benchmark/` as a deliverable, containing:
     - `replays/` (one runnable script per replay)
     - `harness/` (agent experiment runner, scoring, verifiers)
     - `README.md` (how to reproduce every number with one command, as Section 8.8 already requires for scoring)
     - a mapping from each reused llm-bench, MFE and KERNEL component to its role
4. **Data: gather everything, lose nothing, archive with a clear index**
   - **Supported:** raw transcripts, logs, measurements, scoring script and analysis are archived. Small files go in the repo and large files in R2 with hashes (Section 8.8). Benchmark raw data is kept indefinitely (Section 9.2 Q5).
   - **Missing:**
     - No index file.
     - No off-Cloudflare mirror.
     - Retention is unset for audit logs, checkpoints and renders that benchmark runs reference.
     - No explicit rule that pilot, excluded, failed and aborted runs are archived.
     - Replay inputs and outputs need the same treatment.
     - Server audit and telemetry are not stated as part of the archive.
     - There is a conflict between redacting secrets from transcripts and preserving raw data, which Section 8.8 does not address.
   - **Change:**
     - Add `benchmark/data/DATA_INDEX.md` (every artifact, hash, location, run id).
     - Add a second-location mirror and a verify-hashes job.
     - Add a "never delete benchmark-linked records" rule.
     - Encrypt raw transcripts rather than redacting them destructively, and keep the redacted copies separately.
     - State that data loss is a failure condition in Section 8.8.
5. **Single model first: Codex solo, most recent; focus on the server**
   - **Contradiction:** Sections 8.2 and 8.4 say "same model" but name none. Thresholds and baselines lean on Claude-sample numbers:
     - sleep loops: 311 across 12 Claude sessions (Section 8.7)
     - recall adoption: 3 of 9 Claude sessions (Section 8.7)
     - tokens: 23.5M cache-read vs about 215k output, Claude (Section 8.1)

     Section 6.1 lists Claude lanes and Muse as callers. Nothing prevents mixing models across runs.
   - **Change:**
     - State Codex solo (most recent at freeze time) in Sections 8.2, 8.4 and 8.6, with the pinned model id, CLI version and reasoning setting.
     - Restate the baselines and adoption targets from the Codex sample.
     - Confirm Codex token capture (Section 4 of this review, point 8).
     - Mark multi-model as out of scope.
     - Prioritize server work by Codex waste classes (answer 10).
6. **HTML deliverable explaining everything to Aria, readable end to end**
   - **Not covered.** The PRD has no HTML page. The "final report" (Sections 8.8, 10) is unspecified in format.
   - **Change:** add a deliverable for one self-contained HTML page covering:
     - what was built
     - architecture diagram
     - methods
     - preregistration link and hash
     - results with CIs and N
     - UNPROVEN items
     - data index link
     - how to verify

     It should be generated from the same scored data as the paper so the numbers cannot drift, and be readable without the repo. Gate it in Phase 4 after independent verification.
7. **Research paper written during the experiments, scaffolding now**
   - **Not covered.** The PRD produces a "final report" at the end of Phase 4 (Section 10), which contradicts "written DURING, not after".
   - **Supported:** the evidence-standard parts are present. Preregistration, controls, CIs, raw data, independent verification and UNPROVEN labeling are covered in Sections 8.2, 8.4, 8.6 and 8.8.
   - **Change:**
     - Add `paper/` now with title, abstract skeleton, preregistered hypotheses (copied from `preregistration.md` by hash), methods and a limitations section. Seed the limitations from Section 1.2's negative results and the report's limitations.
     - Require a dated paper update at each phase gate (each replay, pilot, confirmatory, repeatability, verification).
     - Results sections are filled only from verified scoring output, and anything unverified is marked UNPROVEN in the draft.
