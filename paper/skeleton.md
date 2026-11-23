# Fleet MCP: A Unified MCP Server That Reduces Token Use and Time and Improves Reliability for Agent Fleets

**Status:** Skeleton, drafted Nov 22, 2026. This paper is written DURING the experiments, not after them, per Aria's order of Nov 22, 2026, 16:47 PT. The scaffolding exists now and grows alongside the work. Results sections stay empty, marked [PENDING], until the experiments produce them.

**Author:** Aria Han (sole author; the server, the benchmark, and this paper are a personal project).

**Sources of every number in this skeleton:** `../report.md` (the baseline report, Nov 22, 2026) and its `../analysis/` files, plus `../PRD.md` (the Fleet MCP PRD, Nov 22, 2026). Citations use the form (Report Part 1, Codex) or (PRD Section 8.7). Every number is either a measured baseline from the report (the "without" side) or a preregistered hypothesis or threshold, labeled as such. No "with" result exists yet, and none is stated or implied anywhere in this document.

**Evidence standard:** Aria's binding evidence standard of Nov 22, 2026, 16:42 PT governs this paper: preregistration, controlled experiments with confidence intervals, traceability to raw data, independent verification, UNPROVEN labeling for anything not proven to that standard, and full reporting (PRD Section 8).

**Scope boundary:** This is a personal project with its own corpus. It does not touch TBS data, TBS repos, TBS issues, or the TBS MCP server's content. The TBS Teaching MCP server is a pattern reference only (hosted, typed tools, live data), enforced by an explicit repo allowlist in code (PRD Section 0 and Section 6.4). The benchmark tasks are drawn from personal-project work only.

**How this skeleton grows:** each section is filled in as its experiment runs. A section moves from [PENDING] to written only when the underlying measurement exists and has passed independent verification (Section 6.6). Nothing is backfilled from memory. Amendments to the preregistered hypotheses in Section 5.2 are dated entries, never silent edits, mirroring the preregistration amendment rule (PRD Section 8.6).

**Alignment with the revised PRD (v2), Nov 22, 2026:** Sections 5.1, 5.2, 5.5, 5.6, and 5.7 are aligned with the gate G0 revision items for PRD Section 8, specifically R5 (benchmark statistics) and R6 (single-model scope and the judge-panel resolution) as resolved in `../docs/execution-plan.md` Section 3.1. Assumption: where the committed `../PRD.md` Section 8 text still carries the pre-revision wording, the R5 and R6 resolutions govern, and PRD v2 Section 8 is written to match them. Citations of the form (Plan R5) point to those resolutions.

---

## 1. Abstract

[ABSTRACT SKELETON. The problem, the approach, and the method are stated now. The results sentences stay as placeholders until the experiments run.]

Agent fleets waste a large share of their tokens, time, and attempts on work they have already done: re-reading the same files, re-fetching the same issues, re-running the same checks, polling state in sleep loops, and rebuilding context from scratch after every restart and worker death. We measured this waste in the Studio agents' transcripts and runner records (Report Part 1). Across 134 Antigravity lanes, 27.3% of prompt bytes were exact-line repeats (148,020 of 542,897 bytes). Across 12 Codex sessions, 11.2% of shell commands were extra executions of repeated commands (1,309 of 11,655) and 42.8% of file reads were re-reads (858 of 2,006). Across 12 Claude sessions, agents made 500 GitHub CLI calls, launched a browser 327 times, and ran 311 sleep commands inside polling loops. In 6.8 days of runner records, 46% of attempts were re-attempts (488 of 1,056), and 176 hours of non-done attempt time (43% of 413 hours) went to failed, dead, and preempted attempts, excluding legitimate blockers.

We built Fleet MCP, one unified MCP server that gives agents structured, cached, versioned access to fleet state, so they stop re-reading, re-fetching, re-polling, and rebuilding context. The server has two sides sharing one core: a Context side (Exemplar, Recall, Issue Context, Brief) serving reference material, memory, issue state, and briefs as versioned resources, and a State side (Fleet Status, Verify including Render, Handoff) serving live job and flight state, cached verification, and session continuity as services. It exposes 45 tools across 7 areas (control-plane operations that are not agent tools are specified separately, PRD Section 3.3), backed by a content-addressed store, a version registry, a change feed, a cache layer, and a delta engine, hosted on Cloudflare as a single Worker (PRD Sections 2 and 3, Appendix A).

We evaluate the server with a preregistered controlled experiment: deterministic replays against the measured baselines first, then a live agent experiment with a pilot (10 tasks x 2 arms), a confirmatory run (floor of 30 tasks x 2 arms, powered from the pilot variance, cap of 50 tasks x 2 arms), and a repeatability substudy (10 tasks re-run twice more per arm), with paired differences, 95% confidence intervals, and independent verification of every reported number (PRD Section 8).

[RESULTS PENDING. The following sentences are filled in only after the confirmatory run and independent verification.]

- Token use (primary endpoint): [RESULTS PENDING. Percent change in total tokens per task, back-transformed from the mean per-task log ratio, with its BCa bootstrap 95% CI. Preregistered bar: H1, point estimate a reduction of at least 20% AND the 95% CI excludes 0.]
- Speed (key secondary, Holm-corrected): [RESULTS PENDING. Percent change in wall-clock time per task, same estimand. Preregistered bar: H2.]
- Reliability: [RESULTS PENDING. Outcome correctness (key secondary, non-inferiority, preregistered as likely UNPROVEN at N 30-50), error rates, re-attempt rates, preflight outcomes, sleep-loop counts. Preregistered bars: H4 through H7.]
- Cost: [RESULTS PENDING. Dollars per task in each arm, computed from session token counts and the model price at run time.]

[CONCLUSION PENDING. One sentence stating what the results support, written after the results exist. If a hypothesis fails, the abstract says so.]

---

## 2. Introduction

### 2.1 The measured waste problem

Agent fleets do not waste their tokens inside single sessions. Within-session repetition in the November sessions is near zero: 0 repeated bash commands across 9 recent Claude sessions, and 4 extra repeats across 5 recent Codex sessions (Report Part 1, agentdb + recent sessions). The waste moved across sessions and across attempts, and that is exactly what a shared, cached, versioned server addresses.

**Prompt and reference waste.** Across 134 Antigravity lanes, 148,020 bytes of prompt text were exact-line repeats, 27.3% of all 542,897 prompt bytes, a lower bound that misses short lines and near duplicates (Report Part 1, Antigravity). One reference block, the L042 narration exemplar (13,946 bytes), was pasted byte-identically into 8 lanes: 111,568 bytes sent, 97,622 redundant. One shared brief (10,196 bytes) was pasted 4 times, 30,588 bytes redundant. In Codex, `CLAUDE.md` was re-read 18 times across 11 of 12 sessions, and five parallel overnight lanes each re-ingested the same brief, ops doc, and skill files (`docs/lesson-ops.md` 9 reads, `BRIEF.md` 6 reads, `SKILL.md` 9 reads across the five lanes) (Report Part 1, Codex). 91 of 134 Antigravity prompts were single-line pointer prompts naming a brief file twice (Report Part 4, Idea 8).

**Re-execution and re-read waste.** Across 12 Codex sessions (11,655 shell commands, 2,006 file reads), there were 1,309 extra executions of repeated commands (11.2% of all commands, across 550 repeated patterns) and 858 extra file re-reads (42.8% of all reads, across 341 paths). The worst session re-read 360 of 650 reads (55.4%). Output tokens re-fed from repeat executions totaled at least 215,615 tokens, a lower bound, since only 561 of the 1,309 repeat executions had attributable output token counts (Report Part 1, Codex). In 9 recent Claude sessions, cache-read tokens totaled 23.5M against about 215k output tokens, and tool time was 75% of wall time: the cost driver is context re-reads, not output (Report Part 1, recent Claude).

**Polling and state-check waste.** The no-argument state poll `vaults ctx` ran 169 times across 12 Codex sessions (54 in one session, 66 in another). Across 12 Claude sessions, agents ran 311 sleep commands inside polling loops, 131 `vaults wait` / `hcom listen` wait-for-state calls, 179 hand-written `sqlite3` ledger queries (122 in one session), and 500 `gh` invocations (179 issue views, 97 issue lists, 86 PR operations; top session 132 gh calls). One 853-character bash command looped up to 36 times per invocation, running `gh issue list` twice per iteration plus `git log`, `git fetch`, and `sleep 300`, with a hand-rolled seen-file for dedup, and was invoked 37 times in one session (Report Part 1, Claude and Codex). Codex added 314 gh calls with 142 extra executions of repeated fetches, including `gh issue view 179` 12 times in one session, and 782 `wait` / `wait_agent` calls across the sample (Report Part 1, Codex).

**Cross-attempt and continuity waste.** In 6.8 days of runner records (1,056 attempts on 568 tasks), 488 attempts (46%) were re-attempts, and 195 tasks (34% of tasks that ran) needed 2 or more attempts. Non-done attempt time was 204 hours (49.5% of 413 hours total); excluding legitimate blockers, 176 hours (43%). 27 attempts hit the 4-hour timeout, all failed, about 108 hours burned. 77 attempts on 44 tasks were worker deaths (machine), and 10 attempt summaries mention OAuth or authentication failures. One task was preempted 112 times in 35 minutes before completing on its 113th attempt. 48 attempts failed verification after claiming done (plus 3 verification tool errors) (Report Part 1, runner). Every re-attempt pays a full context reload: a fresh `gh issue view` and a rebuilt brief (live issue body up to 12,000 chars, last 8 comments, git fetch/status/log, plus fixed boilerplate). Across 12 Codex sessions there were 76 context compactions and 209 files re-read across compaction boundaries in the same session; in one session a single file went from 2 reads before the first compaction to 27 reads after it (Report Part 1, Codex).

**Verification and render waste.** 32 Antigravity lanes re-reported verification, and 28 re-reported "Zero em dashes", re-running the same check battery per lane (Report Part 1, Antigravity). In Codex, one lesson's gate ran 18 times plus its locale check 15 times (S1); `npm run verify:hero` ran 17 times plus `npm run verify:v10:promotion` 15 times (S2); `npm run verify` ran 14 times (S5), with no result caching visible in the record (Report Part 1, Codex). Claude sessions launched Playwright 327 times across 12 sessions, 286 in a single session (Report Part 1, Claude).

**Memory waste.** Recall is instructed in every runner brief but ran in only 3 of 9 recent Claude sessions and in 6 of 193 recent Codex commands (Report Part 1, recent sessions). The agentdb store holds 4,628 live learnings across 62 queryable DBs, but 15 of 77 DBs have stale schema, the errors tables are dead (last write Sep 3-12), and `agentdb recall "workday"` returns 0 matching learnings for a live, high-stakes flow (Report Part 1, agentdb). OAuth expiry is the top recurring failure class: two separate lessons on Nov 20 alone for the same claude OAuth expiry (Report Part 1, agentdb).

### 2.2 What the negative results bound

The baseline also measured what did NOT repeat, and those negative results bound the design (Report Part 1, Codex, Negative results). Search barely repeats: `vaults find` ran 1,021 times with 1,018 distinct queries; `rg` ran 811 times with 807 distinct patterns, so this server builds no search-result cache (PRD Section 1.2). GitHub waste concentrates in coordinator and supervision sessions (S5 and S12 account for 298 of 314 Codex gh calls; 5 of 12 sessions made zero GitHub calls), so Issue Context's value is for those sessions, not every session. Repetition scales with session messiness, not turn count: the tidiest session (S10, 124 turns) had only 21 extra repeat executions, while the messiest (S1, 89 turns) had 392, and this variance drives the benchmark sample size (PRD Section 8.4). Necessity is not provable from the transcripts alone: a re-read cannot be classified as necessary or wasteful without knowing whether the file changed between reads, so the counts measure repetition exactly while avoidability is bounded, not proven (Report, Limitations). Runner attempt dollars are unmeasurable from the records, so the benchmark records tokens and cost itself (Report, Limitations).

### 2.3 The claim

Fleet MCP is one unified MCP server that replaces the re-read, the re-fetch, the re-poll, and the context rebuild with versioned resources, cached results, server-side waits, and checkpoints. The claim under test in this paper is that agents working with the server use fewer tokens and less time than agents working today's way, with equal or better outcome correctness and fewer failures. The claim is preregistered as hypotheses H1 through H7 (Section 6.2) before any "with" result exists, and it is tested by the controlled experiment in Section 6.

---

## 3. Related work

[BRIEF. Grounded in Report Part 2 where numbers are cited. No invented comparisons.]

### 3.1 The Model Context Protocol

MCP is the standard protocol for giving language-model agents structured access to external tools and data. The baseline report documents a case where the protocol was present but the servers for the surfaces the agent actually polled were not: one Codex session used MCP tools 29 times, but only for Codex app internals (usage limits, automations), not for repo, GitHub, or vault state (Report Part 1, Codex). Fleet MCP is the server layer for those polled surfaces.

### 3.2 Agent memory systems: agentdb and KERNEL

KERNEL (kernel-claude) is the fleet's existing agent memory and skills system, built on the agentdb store: 4,628 live learnings across 62 queryable DBs, with recall and learn operations that the fleet's standing rules require on every job (Report Part 1, agentdb; Report Part 2, KERNEL). KERNEL is listed on the HOL AI Plugin Registry with a Trust Score of 91/100, 27 skills, 15 GitHub stars, and 86 releases (Report Part 2, KERNEL). Its effectiveness numbers are NOT YET MEASURED (Report Part 2, KERNEL). The report's observational with/without split had a control group of n=1 (one session of 12 made no agentdb call), so it is suggestive only, not proof (Report Part 3). Fleet MCP's Recall area exposes agentdb as MCP tools (`recall_query`, `recall_learn`, `recall_list_lessons`, `recall_store_health`), making the memory portable to any MCP client and making adoption measurable instead of assumed (PRD Section 3.1). This paper's benchmark measures Fleet MCP's effect over today's baseline, which includes KERNEL as installed; it does not claim to measure KERNEL's effect (PRD Section 8.5).

### 3.3 Evaluation harnesses: llm-bench and model-familiarity-engine

Two existing harnesses supply this paper's method, not its results. llm-bench is a 42-test suite with programmatic verifiers (no LLM-as-judge): 12 routine workflow screens plus 30 stress tests (Report Part 2, llm-bench). Its Oct 1-2 full runs scored devstral-small-2:24b at 0.792 (363 s), qwen3-coder:30b at 0.770 (162 s), and lfm2.5:8b at 0.738 (356 s), but those scores are pre-grading-revision and superseded; the corrected scores come from v3 rescoring (Report Part 2, llm-bench). llm-bench is the model for this paper's outcome verification: where a task's outcome can be checked programmatically, the verifier is code, not a judge (PRD Section 8.5).

The model-familiarity-engine (MFE) is the model for preregistration and honest instrument verdicts. Its Experiment 0 returned NOT CERTIFIED: 9 preregistered gates, 6 PASS, 2 PENDING, 1 FAIL on provenance, because the run could not prove which protocol collected its shards (Report Part 2, model-familiarity-engine). Its measured gate values include oracle consistency 0.95 (threshold 0.9), judge individual reliability min 0.92, panel inter-judge agreement 0.74 (n=339 cells, threshold 0.67), and a Bedrock v1 run with floor 40/40 and spine agreement 0.875 (Report Part 2, model-familiarity-engine). This benchmark's instrument must be able to return the same verdict: if provenance fails, the result is NOT CERTIFIED, not quietly published (PRD Section 8.5).

### 3.4 Hosted MCP servers as pattern reference

The TBS Teaching MCP server is the pattern Fleet MCP mirrors (hosted, typed tools, live data). Its Nov 20 live sweep ran 282 checks, all pass, with 268 lesson tool calls, median latency 2,000 ms, max 6,876 ms (Report Part 2, Teaching MCP sweep). It is a pattern reference only: this server's corpus is Aria's personal-project repos and records, and the TBS boundary is enforced by an explicit allowlist in code (PRD Section 0). Fleet MCP's post-deploy gate follows the same sweep pattern, exercising every tool once against staging data after every deploy (PRD Section 5.2).

[RELATED WORK TO EXPAND. As the experiments run, add: published MCP server evaluations, agent evaluation harnesses, and caching literature for LLM agents, with citations added only from sources actually read. No section is filled from memory.]

---

## 4. System design

[SUMMARY FROM THE PRD. This section describes the system; it does not re-specify it. The full specification is PRD Sections 2 through 7.]

### 4.1 One server, two sides, one core

Fleet MCP is one unified MCP server, hosted on Cloudflare, with one endpoint and two sides that share a core (PRD Section 2.1).

The **Context side** serves what the agent needs to know, as versioned resources fetched on demand: Exemplar (reference material), Recall (agentdb memory as MCP), Issue Context (GitHub state as structured, cached data), and Brief (the brief as a structured object with run history). The agent fetches an exemplar instead of receiving a 14 KB paste, fetches a diff instead of the whole object when it already holds a version, and reads a brief plus its run history in one call.

The **State side** serves what is true right now, as live services: Fleet Status (job and flight state plus credential preflight), Verify (cached verification, deploy and live-state checks, and Render), and Handoff (session continuity across restarts and worker deaths). The agent asks once and waits server-side instead of sleeping in a loop, and gets a cached result instead of re-running work.

The **shared core** (PRD Section 2.2) owns: a content-addressed store (every object keyed by the SHA-256 hash of its canonical bytes, plus a name and a monotonic version number); a version registry (append-only version history, nothing overwritten in place); a change feed (a single ordered, sequence-numbered log of every write, which all `what_changed` tools read); a cache layer with per-class TTLs and explicit invalidation, where every response carries `cache_status`, `content_hash`, `version`, and `fetched_at`; a delta engine (diffs between any two versions of a versioned text resource); and one auth and audit path for every call.

### 4.2 The 45 tools

45 tools across 7 areas, plus 14 resource types (PRD Appendix A). Flat MCP tool names, `<area>_<verb>`. Every tool response is a JSON object with a `meta` block (`content_hash`, `version`, `cache_status`, `fetched_at`, `source`). Every tool that takes a `since_version` or `since` parameter returns a delta when the caller already holds a version, and the full object only when it does not (PRD Section 3).

| Area | Tools | What it replaces (measured) |
|---|---|---|
| Exemplar (5) | `exemplar_get`, `exemplar_list`, `exemplar_what_changed`, `doc_get`, `doc_list_canonical` | 27.3% repeat prompt bytes; the L042 block pasted 8 times; `CLAUDE.md` re-read 18 times |
| Recall (4) | `recall_query`, `recall_learn`, `recall_list_lessons`, `recall_store_health` | 91 agentdb calls via bash; recall skipped in 6 of 9 recent sessions; unmonitored store health |
| Issue Context (4) | `issue_get`, `issue_list`, `issue_what_changed`, `issue_comment` | 500 gh calls (Claude) plus 314 (Codex); 142 extra repeated fetches; 488 re-attempts each re-fetching the issue |
| Brief (3) | `brief_get`, `brief_create`, `brief_record_run` | 91 pointer prompts; 7 duplicate-task pairs; retries repeating the first attempt's error |
| Fleet Status (6) | `fleet_get_flight`, `fleet_list_flights`, `fleet_get_job`, `fleet_what_changed_since`, `fleet_wait_for`, `fleet_preflight` | 311 sleeps, 179 sqlite3 queries, 131 wait/listen calls, 169 `vaults ctx` polls; 10 attempts killed by dead OAuth |
| Verify, incl. Render (7) | `verify_check`, `verify_get`, `verify_deploy_status`, `verify_live_check`, `verify_render`, `verify_get_render`, `verify_visual_diff` | Gate/locale/verify loops re-run 18+15+17+15+14 times; 327 Playwright launches; 48 verification failures after done claims |
| Handoff (4) | `handoff_save_checkpoint`, `handoff_resume`, `handoff_list_sessions`, `handoff_get_run_history` | 488 re-attempts; 77 worker deaths; 76 compactions plus 209 post-compaction re-reads; 112 preemptions in 35 minutes |

Render lives on the State side as a tool group inside Verify, not as a separate server: a render is a verification artifact, keyed by URL plus viewport plus content hash, cached, diffed, and consumed by the same cold-read and deploy-gate agents that consume verification results (PRD Section 2.3). It keeps its own tool names and its own `render://` namespace, so it can split into its own Worker later without renaming anything agents call.

### 4.3 How the tools compose

The sides are not silos; the composition paths are first-class behaviors (PRD Section 2.4). `handoff_resume` returns the checkpoint plus the brief version pinned at checkpoint time (with a diff if the brief changed), lessons recorded since the checkpoint, the issue delta since the checkpoint, and `what_changed` for every file the checkpoint names, so the resumed agent re-reads only changed files. `brief_record_run` feeds Handoff and Recall: a failed run with a recorded lesson is offered to Recall as a `learn` candidate, which the agent confirms (the server never writes a lesson on its own). `fleet_preflight` gates Verify and Handoff: before a run launches, it confirms each credential the run needs is live, so a dead credential fails the preflight instead of killing an attempt mid-run. Verify results are Handoff state: a verification result is stored with its file hash, so a resumed agent reuses the prior attempt's green checks. Issue Context feeds Fleet Status: `fleet_what_changed_since` includes issue state changes from the change feed, so a supervision loop makes one call instead of polling `gh issue list` twice per iteration.

### 4.4 Caching, versioning, and delta strategy

**Content-addressed caching (PRD Section 7.1).** The cache key for a computed result is the hash of its canonical inputs: for verification, the file hash plus the check list; for renders, the URL plus viewport plus state plus content hash; for versioned bodies, the content hash itself. Two agents asking the same question with the same inputs get the same cached result, with `cache_status: hit` and the original evidence attached. A new check version is a new key, so a changed checker never serves a stale result computed by the old one.

**`what_changed` and diff semantics (PRD Section 7.2).** Every `what_changed` tool takes a `since` (timestamp, version, or change-feed sequence number) and returns three lists: `added`, `changed`, `removed`, with per-item field-level change summaries (unified diff for text, old and new values per field for structured resources). If nothing changed, the response is `unchanged: true` with the current version and timestamp, and no body. The change feed is the single source for all `what_changed` answers; a tool never re-derives changes by comparing two full fetches.

**The second agent never re-runs work the first agent already did (PRD Section 7.3).** Agent A calls `verify_check` on a file: miss, the server runs the checks, stores the result under the file hash, returns it with `cache_status: miss`. Agent B calls `verify_check` on the same unchanged file: hit, the stored result returns with the original evidence and the original `run_id`, and no check runs. The file changes: Agent C's call misses on the new hash, runs fresh, stores a new result. No stale green. The same shape holds for renders (content hash), issue bodies (webhook invalidation plus TTL), exemplars (version pinning), and recall queries (5-minute TTL plus write invalidation).

**Freshness contract (PRD Section 7.4).** Every response states its freshness in the `meta` block: `cache_status` (`hit`, `miss`, `stale`, `bypass`), `fetched_at`, `content_hash`, `version`, and `ttl_remaining_s` where a TTL applies. `stale` means the entry exceeded its TTL but was served while a refresh runs in the background (stale-while-revalidate, used only for issue bodies and state snapshots, never for verification or renders). The server never hides staleness.

**Invalidation (PRD Section 4.5).** Content-addressed entries (verification, render, versioned bodies) cannot go stale because the key includes the content. Time-based entries carry `fetched_at` and a TTL: issue bodies 60 s (plus immediate invalidation by the GitHub webhook), flight and job state 10 s (plus immediate invalidation on state-change events), recall queries 5 min (plus invalidation when a matching lesson is recorded), deploy status 30 s (failed builds 5 min), live checks 60 s, credential liveness at most 60 s.

### 4.5 Cloudflare deployment

One Cloudflare Worker (`fleet-mcp`) serves the whole server: one codebase, one deploy, one domain (proposed: `mcp.ariaxhan.com`, staging at `staging.mcp.ariaxhan.com`; final domain choice is Aria's call) (PRD Section 5.1). Transport is Streamable HTTP, the current MCP transport: `POST /mcp` for JSON-RPC requests, `GET /mcp` for the SSE stream. Routes also include `GET /health` (liveness plus per-dependency status), `GET /version` (deployed commit hash, build time, MCP protocol version), `POST /webhooks/github` (cache invalidation, verified with the webhook secret, non-allowlisted repos dropped), and `POST /internal/sync` (the agentdb sync endpoint, separate sync token, Studio sync job only).

Storage (PRD Sections 2.5 and 4.2): D1 for structured records (version registry, change feed, briefs, run history, checkpoints index, verification records, issue cache index, lessons index, audit log); KV for the hot cache only (a cache, never the record: every KV entry has a D1 or upstream source of truth); R2 for blobs (exemplar and doc bodies, checkpoint state blobs, render PNGs, benchmark raw-data archive); Durable Objects for coordination state only (`fleet_wait_for` subscriptions, per-session checkpoint serialization). `verify_render` uses Cloudflare Browser Rendering for a warm browser pool. Upstream APIs (GitHub, Vercel, Cloudflare deployment APIs, the agentdb store) are called server-side only, with credentials in Workers secrets, never in the repo and never in prompts (PRD Section 6.3).

Deploy pipeline (PRD Section 5.2): repo `ariaxhan/fleet-mcp` (proposed, name to confirm); `wrangler.toml` defines the Worker, D1, KV namespaces, R2 buckets, Durable Object classes, and the Browser Rendering binding; secrets via `wrangler secret put`, never committed. Pull requests open a preview deployment; merge to `main` deploys to production via `wrangler deploy`. Every deploy is followed by a live sweep modeled on the Teaching MCP sweep pattern (282 checks, all pass, Nov 20, 2026), exercising every tool once against staging data, checking `/health` and `/version`, and verifying the deployed commit hash matches `main`; the sweep receipt is stored in R2 and linked from the deploy record. A failed sweep blocks the deploy from being called done; rollback is `wrangler rollback`. D1 migrations are forward-only, in the repo, applied as part of deploy.

Auth (PRD Section 6): bearer tokens, per agent and per client, never shared, never pasted into prompts, never committed; the server stores hashes, never plaintext tokens. Scopes are `read`, `write`, `preflight`, `admin`. Tokens expire after 90 days by default (a design choice, not a measured number) and can be revoked immediately. The repo allowlist is a whitelist enforced in code: a repo not on the list is refused, and the Thinking-Brain-School org and every TBS repo are not on it and cannot be added without an explicit, recorded decision by Aria.

---

## 5. Methods

[THE BENCHMARK PLAN FROM PRD SECTION 8, GOVERNED BY ARIA'S BINDING EVIDENCE STANDARD OF NOV 22, 2026, 16:42 PT. THE HYPOTHESES IN SECTION 5.2 ARE PREREGISTERED CLAIMS, STATED HERE BEFORE ANY "WITH" RESULT EXISTS.]

### 5.1 What is measured

Per task, in both arms (PRD Section 8.1; the metric set extends the KERNEL controlled benchmark design in Report Part 3):

- **Tokens (primary endpoint):** input tokens, output tokens, and cache-read tokens, from the Codex rollout record, always reported separately (Plan R5). The primary endpoint is total tokens per task (input plus output plus cache-read, with cache-read validated as not double counted inside input), paired. Cache-write tokens are recorded where applicable. Schema and tool-response overhead count inside the with-arm input total, and schema token overhead is also measured separately. Cache-read tokens dominate the baseline (1,807,762,048 of 1,836,891,941 cumulative input tokens, 98.4%, were cached input across 12 Codex sessions; cumulative per-response sums, not unique tokens; Report Part 1, Codex). Codex token capture for the pinned model is confirmed before the pilot (Plan R6).
- **Wall-clock time:** task start to task end, plus tool time as a subset (tool time was 75% of wall time in the recent Claude sample; Report Part 1, recent Claude).
- **Tool calls:** total, by type, and by class (state checks, re-fetches, re-reads, verification runs, renders, sleeps). Sleep commands are counted explicitly: the "with" arm should show zero sleep loops.
- **Cache behavior (with arm only):** cache hits and misses per tool, hit rate, bytes served from cache vs computed fresh.
- **Errors:** failed commands, wrong-file reads, reverted edits, verification failures after done claims.
- **Outcome correctness:** did the task complete correctly, verified independently (Section 5.6). A faster wrong answer is a failure, not a saving.
- **Adoption:** did the agent actually use the server tools (recall ran? checkpoint saved? preflight run?). The report's finding is that the instructed memory path is often skipped (recall in only 3 of 9 recent Claude sessions; Report Part 1), so adoption is measured alongside the outcome.
- **Cost:** dollars per task, computed from the session token counts and the model price at run time, with model cost and allocated server cost reported separately (Plan R5). The baseline cannot supply dollars (runner.sqlite has no cost or token column; Codex rollouts carry no cost field; Report, Limitations), so the benchmark records cost itself from the start.

### 5.2 Preregistered hypotheses

These hypotheses and their success criteria are preregistered before any "with" run (pilot included), in `benchmark/preregistration.md` plus a machine-readable `benchmark/preregistration.json` in the `fleet-mcp` repo, committed and tagged (`bench-prereg-v1`) with the SHA-256 hash recorded in the tag message and in the final report, plus a remote timestamped registration record (PRD Sections 8.6 and 8.7; Plan R5). Each threshold below is a target or a design decision, not a measured result. The experiment may fail any of them, and a failed threshold is reported as failed. No moving the goalposts after seeing the results.

**Estimand (all ratio metrics, Plan R5).** For each task, the log ratio ln(with / without). The estimand is the mean of the per-task log ratios, back-transformed to a percent change. The primary interval is the BCa bootstrap 95% CI; the paired t-interval on the log ratios is the robustness check. A threshold of "at least X% reduction" means: the point estimate is a reduction of at least X% AND the 95% CI excludes 0. That establishes an improvement with a target-sized point estimate. It does NOT establish that the true reduction is at least X%; that stronger claim is made only if the interval's bound itself clears X%.

**Multiplicity (Plan R5).** One primary endpoint (H1). Two key secondaries (H2, H4), Holm-corrected. All other hypotheses (H3, H5, H6, H7) are exploratory and descriptive: reported in full, never used to rescue a failed primary.

**Baselines (Plan R6).** The experiment runs on Codex only, so each hypothesis cites a Codex-sample baseline (12 Codex sessions in Report Part 1, Codex; 193 recent Codex commands in Report Part 1, recent sessions). Where the Codex sample did not measure a quantity, the baseline is labeled NOT MEASURED and is measured on the personal-project task pool before the preregistration freeze (Plan R5, Claude G20). Claude-session numbers elsewhere in this paper describe the fleet, not the baseline for these hypotheses.

**Primary hypothesis:**

- **H1 (total tokens, primary endpoint):** Codex working with Fleet MCP uses fewer total tokens per task than Codex working without it. Success criterion: point estimate a reduction of at least 20% (a design decision) AND the BCa 95% CI excludes 0. Codex baseline: at least 215,615 output tokens re-fed from 1,309 extra repeat executions (lower bound, 561 attributed) and 858 extra re-reads (42.8% of reads) across 12 Codex sessions (Report Part 1, Codex).

**Key secondary hypotheses (Holm-corrected):**

- **H2 (wall-clock time):** Codex working with Fleet MCP completes tasks faster. Success criterion: point estimate a reduction of at least 15% (a design decision) AND the BCa 95% CI excludes 0 after Holm correction. Codex baseline: 782 `wait`/`wait_agent` calls and 169 `vaults ctx` polls across 12 Codex sessions (Report Part 1, Codex); per-task wall-clock baseline NOT MEASURED, measured on the task pool.
- **H4 (outcome correctness, non-inferiority):** Codex working with Fleet MCP completes tasks correctly at a rate no worse than without it. Directional margin: 5 percentage points (a design decision). Rule: the lower bound of the paired 95% interval for (with minus control) correctness, Holm-adjusted, lies above minus 5 percentage points. The with-minus-control interval is reported, never only whether two point estimates differ by less than the margin. Preregistered as likely UNPROVEN at N 30-50 unless its own power analysis supports it: a 5-point margin generally cannot be shown with 30-50 paired binary outcomes (Plan R5, Claude G6). A faster wrong answer fails. Codex baseline: NOT MEASURED in the Codex sample; runner-wide, 48 attempts failed verification after claiming done in 6.8 days (Report Part 1, runner).

**Exploratory hypotheses (descriptive, no confirmatory claim):**

- **H3 (state-check and re-fetch tool calls):** fewer per task in the with arm. Target: point estimate a reduction of at least 50%, same estimand. Codex baseline: 169 `vaults ctx` polls, 32 `git status --short`, 29 `vaults repo`, 314 gh calls with 142 extra repeated fetches across 12 Codex sessions (Report Part 1, Codex).
- **H5 (preflight):** no attempt is launched with a dead credential in the with arm. Target: zero observed events, reported with a finite-sample interval, never as proof of a zero rate, and backed by fault-injection tests (expired, missing, unknown, and mid-run-expiring credentials; Plan R5). Baseline: 10 runner attempts died on OAuth or authentication failures in 6.8 days (Report Part 1, runner); a Codex-only split NOT MEASURED.
- **H6 (recall adoption, Codex units):** recall runs in at least 80% of with-arm Codex sessions (a design decision). Codex baseline: recall in 6 of 193 recent Codex commands (Report Part 1, recent sessions); `agentdb recall` 3x as a top repeat among 217 agentdb calls across 12 Codex sessions (Report Part 1, Codex). Session-level Codex adoption rate NOT MEASURED, measured on the task pool.
- **H7 (sleep and wait loops):** zero sleep commands in with-arm sessions, reported descriptively with a finite-sample interval. Codex baseline: sleep-command count NOT MEASURED in the Codex sample; the measured Codex polling behavior is 782 `wait`/`wait_agent` calls, `bin/codex-lane await` 14x for one lane, and `clock__curr_time` 141x (Report Part 1, Codex). The Codex sleep baseline is measured on the task pool before the freeze (Plan R6).

**Replay targets (deterministic replays, Section 5.4):** each replay's good-result bar comes from Report Part 4 and is a target, not a measured result.

- **R1 (Exemplar):** repeat bytes under 5% of prompt bytes (baseline: 27.3%, Report Part 4, Idea 1).
- **R2 (Issue Context):** one fetch per unique issue per session; structured JSON instead of CLI dumps; no foot-gun writes (baseline: 500 gh calls across 12 Claude sessions, 314 across 12 Codex sessions, 142 extra repeated fetches; Report Part 4, Idea 4).
- **R3 (Verify):** one check run per unique file hash; launches only for changed content; deploy-status checks catch a failed build before the verify step (baseline: gate 18x plus locale 15x plus hero 17x plus promotion 15x plus verify 14x; 327 Playwright launches; Report Part 4, Idea 3).
- **R4 (Fleet Status):** 80% fewer state-check calls, no sleep loops, zero attempts launched with a dead credential (baseline: 179 sqlite3 plus 131 wait/listen plus 311 sleep plus 500 gh calls across 12 Claude sessions; 169 `vaults ctx` polls across 12 Codex sessions; Report Part 4, Idea 2).
- **R5 (Handoff):** zero re-done work; the retry reads the prior attempt's state instead of re-fetching the issue and re-reading the repo (baseline: 7 duplicate-task pairs; 76 compactions plus 209 post-compaction re-reads; 488 re-attempts; 77 worker deaths; Report Part 4, Idea 6).
- **R6 (Brief):** the retry reads the brief once plus the prior run's outcome, and does not repeat the first attempt's error (baseline: 91 pointer prompts; 7 duplicate-task pairs; Report Part 4, Idea 8).
- **R7 (Recall):** recall works from any MCP client with latency under the bash equivalent, and adoption is measurable instead of assumed (baseline: 91 agentdb calls via bash across 12 Claude sessions; recall in only 3 of 9 recent sessions; Report Part 4, Idea 5).

### 5.3 Control group

The "without" side is two things, kept distinct (PRD Section 8.2). (a) The transcript baselines from the report: the measured counts in Section 2 are the "without" numbers for the deterministic replays in Section 5.4. (b) A live control arm: the same tasks run without the server, by the same model, from the same brief and the same starting state, with arm order randomized (the KERNEL design in Report Part 3). The live control arm is what makes the agent experiment causal; the transcript baselines alone cannot, because the fleet already uses KERNEL almost everywhere and the transcript data has almost no control group (the observational KERNEL split had a control group of n=1; Report Part 3).

**Control-arm rule (preregistered decision, needs reviewer sign-off, PRD Section 9.2 question 8):** the control arm works the way agents work today: brief plus files plus CLI, including bash `agentdb` access, because that is the honest "today" baseline. The claim under test is "the server improves on today's workflow", not "the server improves on an agent stripped of its memory". The treatment arm adds the MCP server on top of the same baseline. This rule is written into the preregistration before any run.

**Blinding:** outcome correctness is scored without the scorer knowing which arm produced the result, wherever the scoring method allows it. The scoring script reads session artifacts by run id, and the arm mapping is held separately until scoring is complete (PRD Section 8.2).

### 5.4 Deterministic replays (no agent runs; exact numbers)

These replays use the already-measured baselines as the "without" side and the server as the "with" side. They need no agent runs, produce exact counts rather than estimates, and run first, before the agent experiment (PRD Section 8.3).

| Replay | Baseline (measured) | With-side method | Good-result bar (target) |
|---|---|---|---|
| Exemplar | 148,020 redundant bytes, 27.3% of prompt bytes (134 lanes) | Replace each pasted block with a fetch reference; measure prompt bytes plus tokens | R1: repeat bytes under 5% |
| Issue Context | 500 gh calls (Claude) plus 314 (Codex), 142 extra repeated fetches | Route each call through `issue_get` / `issue_list`; measure calls plus bytes | R2: one fetch per unique issue per session |
| Verify | 32 lanes re-running the same checks; gate 18x plus locale 15x plus hero 17x plus promotion 15x plus verify 14x; 327 Playwright launches | Run each check once per file hash; render once per content hash; measure check invocations plus launches | R3: one check run per unique file hash |
| Fleet Status | 179 sqlite3 plus 131 wait/listen plus 311 sleep plus 500 gh calls (Claude); 169 `vaults ctx` polls (Codex) | Replace each poll loop with `fleet_wait_for` plus `fleet_what_changed_since`; measure state-check calls plus wall-clock time | R4: 80% fewer state-check calls, no sleep loops |
| Handoff | 7 duplicate-task pairs; 76 compactions plus 209 post-compaction re-reads; 488 re-attempts; 77 worker deaths | Kill a worker mid-task, resume via `handoff_resume`; measure re-done work | R5: zero re-done work |
| Brief | 91 pointer prompts; 7 duplicate-task pairs | The retry reads the brief once plus the prior run's outcome | R6: retry does not repeat the first attempt's error |
| Recall | 91 agentdb calls via bash; recall in only 3 of 9 recent sessions; errors tables dead; 15 of 77 DBs with stale schema | Measure MCP call latency vs bash spawn latency; measure adoption from MCP clients; check store health visibility | R7: recall works from any MCP client, latency under bash |

Replay results are exact counts, so they carry no confidence intervals, but they are still independently re-verified (Section 5.6) and their raw inputs and outputs are archived (Section 8). A replay is not a substitute for the agent experiment: replays prove the mechanism saves bytes and calls; only the agent experiment proves agents get faster and cheaper in practice (PRD Section 8.3).

### 5.5 Controlled agent experiment

**Tasks (PRD Section 8.4).** Real personal-project jobs with a recorded brief and a verifiable outcome, drawn from the runner's personal-project queues. The exact task list is preregistered, not chosen in the PRD and not chosen in this skeleton. Task families (illustrative, not the list): a deploy verification on a personal project, a triage pass over a personal repo's queue, a docs update, a bug fix with a verifiable outcome, a cold-read verification. No TBS tasks, no TBS lesson work. Tasks are chosen for representativeness across the waste classes in Section 2, not cherry-picked for server-friendly shapes; the selection rule is written into the preregistration.

**Arms.** (A) With the server: the agent has the Fleet MCP tools plus today's baseline. (B) Without: the agent has today's baseline only (brief, files, CLI, bash agentdb). Same model, same brief, same starting state. Arm order randomized per task. The agent in each arm is a fresh agent; no agent runs both arms of the same task (PRD Section 8.4).

**Single-model scope (Plan R6).** One model only: Codex solo, the most recent version at freeze time. The exact model ID is pinned and frozen in `bench-prereg-v1`, and every run records the CLI version, reasoning setting, limits, tool configuration, and prompts. Multi-model work is out of scope. The single-model scope is a stated limitation: the results generalize to Codex on these task families.

**Cohort-stop rule (Plan R6).** If the provider changes the model under the pinned ID mid-study, the affected cohort stops and all its data is preserved. The study then either retains the pinned snapshot, or amends the protocol (dated amendment under a new tag) and restarts the affected paired cohort under the new version. Versions are never pooled into one confirmatory claim. If immutable model identity cannot be verified, the limitation is disclosed and unsupported model-controlled claims are withheld.

**Cache condition (Plan R5).** The preregistered default is a cold reset of the KV, verification, and render stores before every run. Warm-cache reuse is a separate descriptive factor, never pooled into the primary. Every cache hit is recorded with the run id of the run that produced the cached entry.

**Contamination controls (Plan R5).** Isolated worktrees, fixtures, deployments, checkpoints, and memory writes between arms; pilot runs do not teach the treatment corpus; the baseline agentdb state and the treatment corpus are snapshotted; scheduling is randomized so shared-worker contention cannot systematically favor an arm; provider and model changes are recorded.

**Task pool (Plan R5).** A ranked pool of at least 60 personal-project tasks with disjoint pilot and confirmatory sets (10 pilot, up to 50 confirmatory), a fixed draw order, a recorded seed, stratified by waste class. The full task list, arm prompt delta, cache condition, server commit hash, and starting-state snapshot per task are frozen in the preregistration.

**Sample size (PRD Section 8.4).** The KERNEL design (10 tasks x 2 arms) is the pilot, not the confirmatory sample. It is not enough, for three measured reasons: task-level variance is large and heterogeneous (extra repeat executions ranged from 21 in the tidiest Codex session to 392 in the messiest; re-read rates ranged from near zero to 55.4%; GitHub waste concentrated in 2 of 12 sessions); the observational precedent failed on sample size (the KERNEL split had a control group of n=1); and agent runs are nondeterministic, so a single run per task-arm confounds the server's effect with run-to-run noise.

The design runs in three phases:

- **Phase 1, pilot: 10 tasks x 2 arms = 20 runs.** Validates the harness (scoring script, token capture, outcome verification), estimates the paired-difference standard deviation for each primary metric, and catches design flaws before the confirmatory run. Pilot data is reported separately and is NOT pooled into the confirmatory result.
- **Phase 2, confirmatory: sample size computed from the pilot variance, with a floor of 30 tasks x 2 arms = 60 runs.** The computation is a standard paired power analysis on the primary endpoint's log ratio: 80% power at a two-sided alpha of 0.05 to detect the preregistered minimum effect (Section 5.2), using an upper confidence limit of the pilot standard deviation (or a preregistered inflation rule), not the point estimate (Plan R5). The confirmatory N is frozen after the pilot and before any confirmatory outcome is observed; there is no stopping or expanding on observed significance. The floor of 30 tasks is a labeled design decision, not a statistical fact. If the power computation demands more than 30 tasks, the run expands to that number, up to a preregistered cap of 50 tasks x 2 arms = 100 runs. If the pilot variance is so large that even 50 tasks cannot power the preregistered effect, the result is reported as UNPROVEN for that metric with the required sample size stated, not run until something looks significant.
- **Phase 3, repeatability substudy: 10 of the confirmatory tasks, each re-run twice more per arm = 40 additional runs.** This gives 3 observations per task-arm for those 10 tasks, which measures run-to-run variance directly and lets the analysis separate the server's effect from agent nondeterminism. The substudy tasks are chosen at random from the confirmatory set and named in the preregistration.

**Repeatability model (Plan R5, decided in advance).** The primary analysis uses the first paired run per task only, so every confirmatory task contributes exactly one paired observation. The repeat runs are analyzed secondarily with a mixed-effects model on the log scale (arm as a fixed effect, task as a random effect), which reports run-to-run variance and checks that the primary estimate is not an artifact of a single nondeterministic draw. [DESIGN DECISION recorded here for the freeze; the preregistration may instead adopt the mixed-effects model as primary, by dated choice before the pilot.]

**Missing data (Plan R5).** Aborted runs, timeouts, and harness failures are outcomes, not exclusions, unless they are harness faults defined in advance in the preregistration.

**Minimum total: 120 agent runs** (20 pilot plus 60 confirmatory floor plus 40 repeatability). At the report's estimate of 10 to 60 minutes per run (Report Part 3), that is 20 to 120 hours of agent compute, parallelizable across the runner's workers. The actual compute cost is measured and reported as part of the result.

**Analysis (Plan R5).** Per task, the log ratio (with over without) for every ratio metric. Reported for each: the back-transformed mean log ratio as a percent change, the BCa bootstrap 95% CI (primary), the paired t-interval (robustness check), the effect size (Cohen's dz on the log ratios), and the full per-task table, not just the aggregate. H1 is the single primary endpoint; H2 and H4 are Holm-corrected key secondaries; everything else is exploratory. A confirmatory result is claimed only when its interval excludes zero in the claimed direction. Variance is reported, never hidden: the per-task differences, the standard deviation, and the repeatability substudy's run-to-run variance all appear in the final report.

### 5.6 Independent verification, traceability, and UNPROVEN labeling

**Independent verification (PRD Section 8.8).** The numbers are re-checked by a party other than the one that produced them. A separate verifier (a different agent or operator from the benchmark runner, assigned before confirmatory execution, with read-only archive access, the frozen protocol, and scorer provenance, and no responsibility for delivering a positive verdict) re-runs the scoring script from the archived raw data and compares its output against the reported numbers, within a preregistered tolerance (exact match for counts; stated tolerance for derived statistics), and independently re-derives a random sample of raw metrics without the scoring script. A mismatch blocks the efficacy claim until resolved; it does not suppress an honest report of an instrument failure, and the instrument can return NOT CERTIFIED.

**Judge-panel resolution (Plan R6).** The two PRD reviews disagreed on grading: one held that a different model family as verifier does not conflict with Codex solo; the other required programmatic checks plus a separate operator using the same pinned Codex model. This study adopts the stricter reading. Outcome correctness is scored by programmatic verifiers first (the llm-bench model: a file exists, a check passes, a URL serves expected text). Where judgment is needed, the judge is the same pinned Codex model run under a separate independent operator, with a frozen rubric, arm-blinded artifacts where feasible, and reported agreement against a preregistered agreement floor; below the floor, judged correctness is reported as UNPROVEN. The judge is a verifier, not a second task solver. Keeping one model family in the entire evidence chain keeps the single-model claim airtight. The multi-family judge panel (the MFE model) is deferred to later multi-model work and is not used here.

**Traceability (PRD Section 8.8).** Every reported number is traceable to its raw data. Preserved and archived: the raw session transcripts for every benchmark run, the run logs, the raw measurement files, the scoring script, and the analysis. Small files live in the repo under `benchmark/data/`; large transcripts live in R2, with their content hashes and R2 keys recorded in the repo. The scoring script recomputes every reported number from the raw data with one command, so anyone can reproduce the result. The final report cites the source file for every number. See Section 8.

**UNPROVEN labeling (PRD Section 8.8).** If a result cannot be proven to this standard, it is reported as UNPROVEN, with what it would take to prove it (more runs, a better instrument, a different task set). Never inflate, never round up, never present a suggestive result as a proven one. A null result is a result and is reported as such, following the KERNEL design's own rule (Report Part 3: "If arm A is not better, report that too; a null result is a result").

**Reporting (PRD Section 8.8).** The final report includes the method, the sample sizes, the confidence intervals, the effect sizes, the per-task differences, and where the raw data lives, not just the headline percentages. A headline percentage without its confidence interval and sample size is not published.

**Existing benchmark material reused (PRD Section 8.5).** llm-bench (42 tests, programmatic verifiers) is the model for outcome verification, with the caveat carried forward that the Oct 1-2 scores are pre-grading-revision and superseded. MFE (9 preregistered gates, Experiment 0 NOT CERTIFIED) is the model for preregistration and honest instrument verdicts. The transcript baselines are the "without" numbers for the replays and the variance evidence for the sample size. KERNEL effectiveness is NOT YET MEASURED and is not claimed here.

### 5.7 Preregistration

Artifact: `benchmark/preregistration.md` in the `fleet-mcp` repo, plus a machine-readable `benchmark/preregistration.json` with the same content. It contains: the hypotheses in Section 5.2 with their resolved estimands and thresholds, the ranked task pool with selection rule and seed, the arm definitions and the control-arm rule, the exact system-prompt delta between arms, the cache condition per run, the model ID and CLI version, the server commit hash, the starting-state snapshot per task, the metric definitions and how each is captured, the sample size rule (pilot, power computation with the upper CL of the pilot SD, floor of 30, cap of 50), the success thresholds, the analysis plan (paired log ratio, BCa bootstrap primary, t-interval robustness check, Holm correction, repeatability model), the exclusion and missing-data rules (which runs are excluded and why, decided before seeing results), the repeatability substudy task selection, the verification plan and judge-agreement floor, and the stated tolerance for derived statistics (PRD Section 8.6; Plan R5, R6).

Freezing: the preregistration is committed and tagged (`bench-prereg-v1`) with its SHA-256 hash recorded in the tag message and in the final report, BEFORE the first "with" run (pilot included), plus a remote timestamped registration record, since a local tag and a self-recorded hash establish artifact identity, not independently trustworthy chronology. The tag is the proof that the criteria predated the results.

Amendments: if the preregistration must change, the change is a dated amendment entry appended to the artifact, stating what changed and why, committed under a new tag (`bench-prereg-v2`). The original stays in the repo. Any result affected by an amendment is flagged as such in the final report, with the amendment quoted.

[PREREGISTRATION STATUS: NOT YET FROZEN. The tag, the hash, and the freeze date are recorded here when `bench-prereg-v1` lands. No "with" run starts before that tag exists.]

---

## 6. Results

[ALL RESULTS ARE [PENDING]. NO "WITH" NUMBER EXISTS YET. THE BASELINE ("WITHOUT") COLUMN IN EACH TABLE IS FILLED FROM THE REPORT WHERE THE REPORT MEASURED IT; THE "WITH" COLUMN STAYS [PENDING] UNTIL THE EXPERIMENT RUNS AND PASSES INDEPENDENT VERIFICATION. NO TABLE IS COMPLETED FROM MEMORY, ESTIMATION, OR EXTRAPOLATION.]

### 6.1 Deterministic replay results

[PENDING. Replays run first, before the agent experiment (PRD Section 8.3). Each row is filled with the exact replay count when its replay runs.]

| Replay | Baseline (measured, "without") | With server (replay) | Target | Verdict |
|---|---|---|---|---|
| Exemplar: repeat prompt bytes | 148,020 bytes, 27.3% of 542,897 prompt bytes (134 lanes) | [PENDING] | R1: under 5% | [PENDING] |
| Issue Context: gh calls | 500 (Claude) + 314 (Codex); 142 extra repeated fetches | [PENDING] | R2: one fetch per unique issue per session | [PENDING] |
| Verify: check invocations | Gate 18x + locale 15x + hero 17x + promotion 15x + verify 14x | [PENDING] | R3: one run per unique file hash | [PENDING] |
| Verify: Playwright launches | 327 across 12 Claude sessions (286 in one) | [PENDING] | R3: launches only for changed content | [PENDING] |
| Fleet Status: state-check calls | 179 sqlite3 + 131 wait/listen + 311 sleep + 500 gh (Claude); 169 `vaults ctx` (Codex) | [PENDING] | R4: 80% fewer state-check calls | [PENDING] |
| Handoff: re-done work after worker death | 7 duplicate-task pairs; 488 re-attempts; 77 worker deaths | [PENDING] | R5: zero re-done work | [PENDING] |
| Brief: retry repeats first error | 7 duplicate-task pairs; 91 pointer prompts | [PENDING] | R6: retry does not repeat the first attempt's error | [PENDING] |
| Recall: MCP latency vs bash | 91 agentdb calls via bash; recall in 3 of 9 recent sessions | [PENDING] | R7: latency under bash equivalent; adoption measurable | [PENDING] |

### 6.2 Token usage (H1)

[PENDING. Confirmatory run: 30 tasks minimum x 2 arms, paired per task.]

| Metric | Without (control arm) | With (server arm) | Mean paired difference | 95% CI | Cohen's dz | Verdict vs H1 |
|---|---|---|---|---|---|---|
| Input tokens per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Output tokens per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Cache-read tokens per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Total tokens per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H1 bar (primary): back-transformed mean log ratio a reduction of at least 20% AND BCa 95% CI excludes 0 |

Baseline context (not a result): the report measured 23.5M cache-read tokens vs about 215k output tokens across 9 recent Claude sessions, and at least 215,615 output tokens re-fed from repeat executions across 12 Codex sessions (lower bound). Those are "without" measurements from the transcripts, not control-arm measurements from this experiment (Report Part 1, recent Claude and Codex).

Full per-task table (one row per task, both arms, all three token classes): [PENDING].

### 6.3 Speed (H2) and wall time per task

[PENDING. Confirmatory run: 30 tasks minimum x 2 arms, paired per task.]

| Metric | Without (control arm) | With (server arm) | Mean paired difference | 95% CI | Cohen's dz | Verdict vs H2 |
|---|---|---|---|---|---|---|
| Wall-clock time per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H2 bar (key secondary, Holm): reduction of at least 15% AND 95% CI excludes 0 |
| Tool time per task (subset of wall time) | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Wall time per task, by task family | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |

Baseline context (not a result): tool time was 75% of wall time (9,097 s of 12,058 s) across 9 recent Claude sessions (Report Part 1, recent Claude).

Full per-task wall-time table: [PENDING].

### 6.4 Tool calls, cache behavior, and error rates (H3, H7)

[PENDING. Confirmatory run: 30 tasks minimum x 2 arms, paired per task.]

| Metric | Without (control arm) | With (server arm) | Mean paired difference | 95% CI | Verdict |
|---|---|---|---|---|---|
| State-check and re-fetch calls per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H3 target (exploratory): reduction of at least 50% |
| Total tool calls per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Re-reads per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Verification runs per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Sleep commands per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H7 target (exploratory): zero in the with arm, with finite-sample interval |
| Failed commands per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Wrong-file reads per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Reverted edits per task | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Verification failures after done claims | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |

Cache behavior (with arm only): [PENDING]. Cache hits and misses per tool, hit rate per tool, bytes served from cache vs computed fresh.

Baseline context (not a result): 311 sleep commands, 179 sqlite3 queries, 131 wait/listen calls, 500 gh calls across 12 Claude sessions; 169 `vaults ctx` polls, 1,309 extra repeat executions, 858 extra re-reads across 12 Codex sessions; 48 runner verification failures after done claims (Report Part 1).

### 6.5 Accuracy and reliability (H4, H5, H6)

[PENDING. Confirmatory run: 30 tasks minimum x 2 arms. Outcome correctness scored blind where the scoring method allows it (PRD Section 8.2).]

| Metric | Without (control arm) | With (server arm) | Difference | 95% CI | Verdict |
|---|---|---|---|---|---|
| Outcome correctness rate | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H4 bar (key secondary, Holm): paired 95% interval lower bound above minus 5 points; likely UNPROVEN at N 30-50 |
| Re-attempt rate (tasks needing 2+ attempts) | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Attempts launched with a dead credential | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H5 target (exploratory): zero observed, with finite-sample interval |
| Recall adoption (sessions where recall ran) | [PENDING] | [PENDING] | [PENDING] | [PENDING] | H6 target (exploratory): at least 80% of with-arm Codex sessions |
| Checkpoint saved (sessions where a checkpoint exists) | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Preflight run (sessions where preflight ran) | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Worker deaths | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| 4-hour timeouts | [PENDING] | [PENDING] | [PENDING] | [PENDING] | [PENDING] |

Baseline context (not a result): 488 re-attempts (46% of 1,056 attempts), 195 tasks (34%) needing 2+ attempts, 77 worker deaths on 44 tasks, 27 four-hour timeouts (all failed), 10 attempts killed by OAuth/auth failures, 48 verification failures after done claims, all in 6.8 days of runner records; recall ran in 3 of 9 recent Claude sessions (Report Part 1, runner and recent sessions).

Independent verification of outcome correctness: [PENDING]. Programmatic verifier results and, where judgment was needed, agreement between the separate-operator pinned-Codex judge and the preregistered agreement floor (Section 5.6).

### 6.6 Cost

[PENDING. Dollars per task in each arm, computed from the session token counts and the model price at run time (PRD Section 8.1).]

| Metric | Without (control arm) | With (server arm) | Mean paired difference | 95% CI |
|---|---|---|---|---|
| Cost per task (dollars) | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Benchmark compute cost (total, all runs) | [PENDING] | [PENDING] | [PENDING] | [PENDING] |
| Server operating cost during the experiment | [PENDING] | [PENDING] | [PENDING] | [PENDING] |

Baseline context (not a result): the report could not supply dollars for the baseline (no cost or token column in runner.sqlite; no cost field in Codex rollouts). The 9 recent Claude sessions cost $16.74 total from their `cost-state` lines, and the weekly cost is bounded above at about $417 (Report Part 1, recent Claude; Report, Limitations). No baseline dollar figure is carried into the "with" comparison; the benchmark records cost itself.

### 6.7 Pilot results and repeatability substudy

[PILOT PENDING. 10 tasks x 2 arms = 20 runs. Reported separately, NOT pooled into the confirmatory result (PRD Section 8.4). The pilot's purposes are harness validation and paired-difference standard deviation estimation per primary metric.]

Pilot paired-difference standard deviations (per primary metric): [PENDING].

Confirmatory sample size computed from the pilot variance (80% power, two-sided alpha 0.05, floor 30 tasks, cap 50 tasks): [PENDING].

[REPEATABILITY SUBSTUDY PENDING. 10 confirmatory tasks, each re-run twice more per arm = 40 additional runs, 3 observations per task-arm. Run-to-run variance per task-arm, and the separation of the server's effect from agent nondeterminism: [PENDING].]

### 6.8 Independent verification receipt

[PENDING. Filled in only after the independent verifier re-runs the scoring script from the archived raw data and compares its output against the reported numbers (PRD Section 8.8).]

| Item | Value |
|---|---|
| Verifier (agent or operator) | [PENDING] |
| Scoring script re-run from archived raw data | [PENDING] |
| Counts match (exact) | [PENDING] |
| Derived statistics match (within preregistered tolerance) | [PENDING] |
| Outcome correctness: programmatic verifier results | [PENDING] |
| Outcome correctness: pinned-Codex judge agreement vs preregistered floor (where judgment was needed) | [PENDING] |
| Mismatches found and resolved | [PENDING] |
| Publication unblocked | [PENDING] |

---

## 7. Discussion

[TO BE WRITTEN AFTER RESULTS. NOTHING IN THIS SECTION IS WRITTEN UNTIL SECTIONS 6.1 THROUGH 6.8 EXIST AND HAVE PASSED INDEPENDENT VERIFICATION. THE OUTLINE BELOW STATES WHAT THE DISCUSSION WILL COVER, NOT WHAT IT WILL CONCLUDE.]

### 7.1 What the results would mean

[TO BE WRITTEN AFTER RESULTS. For each hypothesis H1 through H7: whether the preregistered bar was met, what the confidence interval supports, and what it does not support. A failed hypothesis is reported as failed, with the observed effect and interval stated. The replay targets R1 through R7 are assessed separately from the agent experiment: replays prove the mechanism saves bytes and calls; only the agent experiment proves agents get faster and cheaper in practice (PRD Section 8.3).]

### 7.2 Limitations

[TO BE WRITTEN AFTER RESULTS. The limitations below are carried forward from the report and the PRD and must appear in the final discussion, whatever the results are.]

- **Single model:** the experiment runs on Codex solo, most recent version (Section 5.5). The results generalize to Codex on these task families; any claim about other models requires a separate run.
- **Task families:** the tasks are real personal-project jobs, chosen for representativeness across the waste classes, but they are one fleet's jobs. The task list and selection rule are preregistered (Section 5.7), and task selection bias is a named risk (PRD Section 9.1).
- **Necessity is not provable from the transcripts alone:** the baseline counts measure repetition exactly, but a re-read cannot be classified as necessary or wasteful without knowing whether the file changed between reads. Avoidability is bounded, not proven. The cleanest avoidable cases are the no-argument state polls and same-issue re-fetches within minutes (Report, Limitations).
- **Sample coverage:** the Codex sample is the 12 largest of 936 rollout files (1.3% of files, 27% of bytes), and 5 of 12 are sibling overnight lanes from one Sep 23 cluster. Rates measured there (11.2% of commands repeated, 42.8% of reads re-reads) describe large multi-step sessions and should not be extrapolated to the whole archive without a random sample (Report, Limitations).
- **No baseline dollars:** runner attempt dollars are unmeasurable from the records, and Codex rollouts carry no cost field, so the cost comparison rests on the benchmark's own recording, not on a measured baseline (Report, Limitations).
- **Antigravity has no tool-call traces:** all Antigravity numbers are prompt/output text counts or reference counts, labeled as lower bounds where they undercount (Report, Limitations).
- **The server's own token cost:** tool schemas and MCP plumbing add context tokens, which could eat the savings. The benchmark measures the net effect, not gross savings, so a server that costs more than it saves shows up as a null or negative result (PRD Section 9.1).
- **Single point of failure and cache staleness:** if the server is down, agents lose state access (they fall back to today's CLI paths); a stale cache entry could serve wrong state (mitigated by content-addressed keys, short TTLs, webhook invalidation, and freshness metadata on every response) (PRD Section 9.1).
- **Stored-content prompt injection:** lessons and exemplars are agent-written text served back into agent context; a poisoned lesson could steer future agents. Stored content is data with provenance, never executed as instructions, and the server never auto-writes lessons (PRD Section 9.1).
- **The TBS boundary:** the server's corpus is personal-project repos and records only, enforced by an allowlist in code, tested by a test that proves a TBS repo is refused (PRD Sections 0, 6.4, 9.1).

### 7.3 Threats to validity

[TO BE WRITTEN AFTER RESULTS. The threats below are named now so the discussion cannot omit them later. Each is addressed with the design control that mitigates it, plus an honest statement of what remains unmitigated.]

- **Task selection bias:** mitigated by the preregistered task list and selection rule (Section 5.7). Remaining risk: [TO BE WRITTEN AFTER RESULTS].
- **Run-to-run agent nondeterminism:** mitigated by the repeatability substudy (3 observations per task-arm for 10 tasks) and by paired analysis (Section 5.5). Remaining risk: [TO BE WRITTEN AFTER RESULTS].
- **Outcome scoring bias:** mitigated by blinding (arm mapping held separately until scoring is complete) and by programmatic verifiers where possible (Sections 5.3 and 5.6). Remaining risk: [TO BE WRITTEN AFTER RESULTS].
- **Harness and measurement error:** mitigated by the pilot (harness validation before the confirmatory run) and by independent re-verification from archived raw data (Sections 5.5 and 5.6). Remaining risk: [TO BE WRITTEN AFTER RESULTS].
- **Novelty and adoption effects:** the with-arm agents are using a new tool set; adoption is measured alongside the outcome (Section 5.1), so a result driven by non-use is visible rather than hidden. Remaining risk: [TO BE WRITTEN AFTER RESULTS].
- **Generalization beyond one fleet:** the tasks, the corpus, and the waste classes come from one agent fleet. Remaining risk: [TO BE WRITTEN AFTER RESULTS].

### 7.4 Future work

[TO BE WRITTEN AFTER RESULTS. Candidates named in the PRD, to be assessed against the results: the Render split trigger (PRD Section 2.3, open question 3); client isolation (open question 2); multi-model replication; and the retention policy for benchmark raw data, audit logs, checkpoints, and renders (open question 5).]

---

## 8. Data availability

All data behind this paper is preserved and reproducible. Nothing is reported without a source file behind it, and the scoring script recomputes every reported number from the raw data with one command (PRD Section 8.8).

**Where the raw data lives:**

- **Repo (proposed):** `ariaxhan/fleet-mcp` (name to confirm). Small files live in the repo under `benchmark/data/`: the preregistration (`benchmark/preregistration.md` and `benchmark/preregistration.json`), the task list, the metric definitions, the scoring script, the analysis, and the per-task measurement files.
- **R2 archive:** large transcripts live in R2, with their content hashes and R2 keys recorded in the repo, so any transcript is retrievable by hash and verifiable against the record. The R2 bucket also holds the benchmark raw-data archive, the post-deploy sweep receipts, and the render PNGs (PRD Sections 2.5, 5.2, 8.8).
- **Archive index:** the repo holds the index that ties every reported number to its source file: transcript, run log, measurement file, or analysis output. The final report cites the source file for every number (PRD Section 8.8).

**What is preserved:** the raw session transcripts for every benchmark run (pilot, confirmatory, and repeatability substudy), the run logs, the raw measurement files, the scoring script, the analysis, the preregistration (including every dated amendment, with the original intact), the replay inputs and outputs, and the independent verification receipt (Section 6.8).

**Reproducibility:** the scoring script recomputes every reported number from the raw data with one command. The independent verifier re-runs it from the archived raw data and compares its output against the reported numbers, within a preregistered tolerance (exact match for counts; stated tolerance for derived statistics). A mismatch blocks publication until resolved (PRD Section 8.8).

**Retention:** benchmark raw data is kept indefinitely (traceability). Retention for audit logs, checkpoints, and renders is an open question (PRD Section 9.2, question 5) and is recorded here when decided.

**Baseline data:** the "without" measurements in Sections 2 and 6 come from `../report.md` and its `../analysis/` files (the Claude session analysis, the Codex rollout analysis, and the agentdb plus recent-sessions plus runner analysis), which record their sources, sample definitions, and scripts. The baseline report's own limitations (Report, Limitations) are carried into Section 7.2.

---

## Sources

- `../PRD.md`: Fleet MCP PRD, Nov 22, 2026. Architecture, tools, benchmark plan, evidence standard. Cited as (PRD Section N).
- `../report.md`: baseline report, Nov 22, 2026. Measured waste (the "without" baseline) and existing benchmark numbers. Cited as (Report Part N, source).
- `../analysis/antigravity-findings.md`, `../analysis/codex-findings.md`, `../analysis/agentdb-recent-findings.md`: the full findings behind Report Part 1.

## Skeleton changelog

- Nov 22, 2026: skeleton drafted (title, abstract skeleton, introduction, related work, system design, methods with preregistered hypotheses H1-H7 and replay targets R1-R7, empty results sections, discussion outline, data availability). No "with" result exists yet. Preregistration not yet frozen.
- Nov 22, 2026: methods aligned with the PRD revision items R5 and R6 (issue #10): H1-H7 restated with the log-ratio estimand, Holm multiplicity, and Codex-sample baselines; judge-panel resolution recorded (programmatic verifiers first, then the same pinned Codex model under a separate operator); cache condition, cohort-stop rule, power rule, and repeatability model added. All results remain [PENDING].
