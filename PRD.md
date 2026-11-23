# PRD: Fleet MCP, a unified MCP server for fleet state

**Status:** Draft for review. Author: Muse (PRD author, per Aria's commission Nov 22, 2026, 16:40 PT).
**Working name:** Fleet MCP. **Proposed repo:** `ariaxhan/fleet-mcp` (name to confirm). **Proposed domain:** `mcp.ariaxhan.com` (name to confirm).
**Source of every measured number:** `report.md` in this directory and its `analysis/` files. Citations use the form (Report Part 1, Codex). Any number without a citation is labeled as a target, a threshold, or a design decision, never as a measured result.
**Evidence standard:** Aria's binding evidence standard of Nov 22, 2026, 16:42 PT governs the benchmark plan in Section 8 and the reporting of all results from this project.

## 0. Scope boundary (read first)

This is a personal project with its own corpus. It does not touch TBS data, TBS repos, TBS issues, or the TBS MCP server's content. The TBS Teaching MCP server is a pattern reference only (hosted, typed tools, live data; its Nov 20 live sweep of 282 checks, all pass, is cited in Report Part 2 as project evidence). This server's corpus is Aria's personal-project repos and records only, enforced by an explicit allowlist (Section 6). The baseline report's numbers are aggregate measurements used as the problem evidence; the server never reads TBS data at runtime, and the benchmark tasks in Section 8 are drawn from personal-project work only.

## 1. What it is, and the problem it solves

### 1.1 What it is

Fleet MCP is one unified MCP server, hosted on Cloudflare, that gives agents structured, cached, versioned access to fleet state, so they stop re-reading, re-fetching, re-polling, and rebuilding context. It mirrors the TBS Teaching MCP pattern (hosted, typed tools, live data) for a different use case: the working state of Aria's agent fleet. It has two sides. The Context side serves reference material, memory, issue state, and briefs as versioned resources. The State side serves job and flight state, cached verification, and session continuity as live services. Both sides share one caching, versioning, and delta layer, so a second agent gets a cached result instead of re-running work, and a resumed agent gets what changed instead of the whole world again. The goal is faster runs, fewer tokens, and more reliable and accurate results, with statistically proven numbers, real and verified to the evidence standard in Section 8.

### 1.2 The measured problem

The baseline report measured the waste in the Studio agents' transcripts and runner records. The waste is no longer inside sessions. Within-session repetition in the November sessions is near zero (0 repeated bash commands across 9 recent Claude sessions; 4 extra repeats across 5 recent Codex sessions). The waste moved across sessions and across attempts, and that is exactly what a shared, cached, versioned server addresses (Report Part 1, agentdb + recent sessions).

**Prompt and reference waste (the Context side's problem)**

| Measured waste | Number | Source |
|---|---|---|
| Exact-line repeats in Antigravity prompt bytes | 148,020 bytes, 27.3% of all 542,897 prompt bytes across 134 lanes (lower bound) | Report Part 1, Antigravity |
| One reference block (L042 narration exemplar) pasted 8 times | 13,946 bytes x 8 lanes = 111,568 bytes sent, 97,622 redundant | Report Part 1, Antigravity |
| One shared brief pasted 4 times | 10,196 bytes x 4 lanes, 30,588 redundant | Report Part 1, Antigravity |
| `CLAUDE.md` re-read across sessions | 18 times across 11 of 12 Codex sessions | Report Part 1, Codex |
| Five parallel lanes each re-ingesting the same brief, ops doc, and skill files | `docs/lesson-ops.md` 9 reads, `BRIEF.md` 6 reads, `SKILL.md` 9 reads across the five lanes | Report Part 1, Codex |
| Single-line pointer prompts naming a brief file twice | 91 of 134 Antigravity prompts | Report Part 4, Idea 8 |
| Same canonical docs re-named per lane | AGE-SPLIT.md 20 mentions (10 lanes); L011 content.json 16 (8 lanes) | Report Part 1, Antigravity |

**Re-execution and re-read waste**

| Measured waste | Number | Source |
|---|---|---|
| Extra repeated shell executions | 1,309 (11.2% of all commands) across 550 repeated patterns, 12 Codex sessions | Report Part 1, Codex |
| Extra file re-reads | 858 (42.8% of all reads) across 341 paths; worst session S5: 360 re-reads of 650 reads (55.4%) | Report Part 1, Codex |
| Output tokens re-fed from repeat executions | At least 215,615 tokens (lower bound; only 561 of 1,309 repeat executions had attributable output token counts) | Report Part 1, Codex |
| Cache-read tokens vs output tokens, 9 recent Claude sessions | 23.5M cache-read tokens vs about 215k output tokens; tool time 75% of wall time | Report Part 1, recent Claude |
| Repeated bash commands and re-reads, 12 Claude sessions | 109 distinct commands repeated (358 total calls); 38 files re-read (90 total read calls) | Report Part 1, Claude |

**Polling and state-check waste (the State side's problem)**

| Measured waste | Number | Source |
|---|---|---|
| No-argument state poll `vaults ctx` | 169 runs (S1: 54, S5: 66) | Report Part 1, Codex |
| `sleep` commands inside polling loops | 311 across 12 Claude sessions | Report Part 1, Claude |
| `vaults wait` / `hcom listen` wait-for-state calls | 131 | Report Part 1, Claude |
| Hand-written `sqlite3` ledger queries | 179 (122 in one session) | Report Part 1, Claude |
| `gh` invocations, 12 Claude sessions | 500 (179 issue views, 97 issue lists, 86 PR ops); top session 132 gh calls | Report Part 1, Claude |
| `gh` calls, 12 Codex sessions | 314 calls, 142 extra executions of repeated fetches; `gh issue view 179` 12 times in S5 | Report Part 1, Codex |
| One gh poll loop | A single 853-character bash command looping up to 36 times, invoked 37 times in one session, with a hand-rolled seen-file for dedup | Report Part 1, Claude |
| Lane completion polling | `bin/codex-lane await` 14x for one lane; 782 `wait`/`wait_agent` calls across the Codex sample | Report Part 1, Codex |

**Cross-attempt and continuity waste**

| Measured waste | Number | Source |
|---|---|---|
| Runner re-attempts | 488 (46% of 1,056 attempts) in 6.8 days; 195 tasks (34% of tasks that ran) needed 2+ attempts | Report Part 1, runner |
| Non-done attempt time | 204 h (49.5% of 413 h total); excluding legitimate blockers, 176 h (43%) | Report Part 1, runner |
| 4 h timeouts | 27 attempts, all failed, about 108 h burned | Report Part 1, runner |
| Worker deaths | 77 attempts on 44 tasks; 10 attempt summaries mention OAuth or authentication failures | Report Part 1, runner |
| Preemption storm | One task preempted 112 times in 35 minutes, completing on its 113th attempt | Report Part 1, runner |
| Verification failures after done claims | 48 attempts (+3 verification tool errors) | Report Part 1, runner |
| Context compactions and post-compaction re-reads | 76 compactions; 209 files re-read across compaction boundaries in the same session | Report Part 1, Codex |
| Duplicate-task pairs (Antigravity) | 7 pairs, including 2 byte-identical prompts where the first attempt produced 0 bytes and the second re-did the work | Report Part 1, Antigravity |
| Playwright browser launches | 327 across 12 Claude sessions, 286 in one session | Report Part 1, Claude |
| Verification loops re-run end to end | Lesson gate 18x + locale check 15x for one lesson (S1); `npm run verify:hero` 17x + `npm run verify:v10:promotion` 15x (S2); `npm run verify` 14x (S5); 32 Antigravity lanes re-reporting verification, 28 re-reporting "Zero em dashes" | Report Part 1, Codex and Antigravity |

**Memory waste**

| Measured waste | Number | Source |
|---|---|---|
| Recall instructed but skipped | Recall ran in only 3 of 9 recent Claude sessions and 6 of 193 recent Codex commands, despite being instructed in every runner brief | Report Part 1, recent sessions |
| agentdb store size and health | 4,628 live learnings across 62 queryable DBs; 15 of 77 DBs with stale schema; errors tables dead (last write Sep 3-12); `agentdb recall "workday"` returns 0 matching learnings for a live, high-stakes flow | Report Part 1, agentdb |
| agentdb calls via bash, 12 Claude sessions | 36 recall + 55 learn, all via bash, no MCP interface | Report Part 1, Claude |
| OAuth expiry as the top recurring failure class | Two separate lessons on Nov 20 alone for the same claude OAuth expiry; root-DB keyword counts: oauth 25, keychain 13, login 10, credential 9, expired 7 | Report Part 1, agentdb |

**Negative results that bound the design (also measured)**

- Search barely repeats: `vaults find` ran 1,021 times with 1,018 distinct queries; `rg` 811 times with 807 distinct patterns. A search-result cache would barely help, so this server does not build one (Report Part 1, Codex).
- GitHub waste concentrates in coordinator and supervision sessions (S5 and S12 account for 298 of 314 Codex gh calls; 5 of 12 sessions made zero GitHub calls). Issue Context's value is for those sessions, not every session (Report Part 1, Codex).
- Repetition scales with session messiness, not turn count: the tidiest session (S10, 124 turns) had only 21 extra repeat executions, while the messiest (S1, 89 turns) had 392. This variance drives the benchmark sample size in Section 8 (Report Part 1, Codex).
- Necessity is not provable from the transcripts alone: a re-read cannot be classified as necessary or wasteful without knowing whether the file changed between reads. The counts measure repetition exactly; avoidability is bounded, not proven. The cleanest avoidable cases are the no-argument state polls and same-issue re-fetches within minutes (Report, Limitations).
- Runner attempt dollars are unmeasurable from the records (no cost or token column in `runner.sqlite`; Codex rollouts carry no cost field). The 176 h figure is wall time only. The benchmark in Section 8 must record tokens and cost itself; it cannot inherit them from the baseline (Report, Limitations).

## 2. Architecture

### 2.1 The two sides

One server, one endpoint, two sides that share a core.

**Context side: what the agent needs to know.** Serves reference material, memory, issue state, and briefs as versioned resources. The agent fetches on demand instead of receiving pastes, and fetches a diff instead of the whole object when it already has a version. Areas: Exemplar, Recall, Issue Context, Brief.

**State side: what is true right now.** Serves live job and flight state, cached verification, renders, and session continuity as services. The agent asks once and waits server-side instead of sleeping in a loop, and gets a cached result instead of re-running work. Areas: Fleet Status, Verify (including Render, see 2.3), Handoff.

### 2.2 The shared core

Both sides are built on one core, not two stacks. The core owns:

- **Content-addressed store.** Every stored object is keyed by the SHA-256 hash of its canonical bytes, plus a human-readable name and a monotonic version number. A fetch by name resolves to the current version; a fetch by hash or version is exact and immutable.
- **Version registry.** Every resource has a version history (version number, content hash, created timestamp, author, change note). Nothing is overwritten in place; a new version is appended.
- **Change feed.** Every write appends an event (resource, version, timestamp, change kind) to a single ordered log. All `what_changed` and `what_changed_since` tools read this log. This is what replaces the hand-rolled seen-file dedup from the report (Report Part 1, Claude: the gh poll loop's `/tmp/claude-501/epic-seen.txt`).
- **Cache layer.** One cache with per-class TTLs and explicit invalidation (Section 7). Every response carries `cache_status` (`hit`, `miss`, `stale`, `bypass`), `content_hash`, `version`, and `fetched_at`, so the agent and the benchmark can tell a cached answer from a fresh one.
- **Delta engine.** For versioned text resources, the server computes a diff between any two versions and returns the diff, not the whole object, when the caller already holds a version. This is the mechanism that turns the 27.3% repeat prompt bytes into a small delta (Report Part 1, Antigravity).
- **Auth and audit.** One token check and one audit log for every call (Section 6).

### 2.3 Render placement (design decision)

**Render lives on the State side as a tool group inside Verify, not as a separate server or a separate side.** Reasons:

1. The baseline report already places `render(url, viewport, state)` inside Verify's tool list (Report Part 4, Idea 3), and Render's own tools (`render`, `get_screenshot`, `diff_screenshots`) duplicate Verify's (`render`, `visual_diff`). One render implementation serves both.
2. A render is a verification artifact: it is keyed by URL plus viewport plus content hash, cached, diffed against the previous render, and consumed by the same cold-read and deploy-gate agents that consume verification results. It shares Verify's content-addressed cache, its invalidation rules (re-render only when the content hash changed), and its evidence shape.
3. A separate Render server would duplicate the cache, the versioning, and the browser pool for no functional gain.

Render keeps its own tool names (`verify_render`, `verify_get_render`, `verify_visual_diff`) and its own resource namespace (`render://`), so it can be split into its own Worker later without renaming anything the agents call. The split trigger is preregistered as an open question in Section 9: if render volume or browser-rendering cost dominates the server's bill or latency budget, Render splits out behind the same tool names.

### 2.4 How tools compose across sides

The sides are not silos. The composition paths are first-class behaviors, not emergent accidents:

- **Handoff resume pulls from Exemplar plus Recall plus Issue Context plus Brief.** `handoff_resume` returns the checkpoint, then attaches: the brief version pinned at checkpoint time (Brief), a diff of the brief if it changed since (Brief, delta engine), lessons recorded since the checkpoint (Recall), and the issue delta since the checkpoint (Issue Context, change feed). This is the direct fix for the 488 runner re-attempts, each of which today pays a fresh `gh issue view` plus a full prompt rebuild (Report Part 1, runner).
- **Brief record_run feeds Handoff and Recall.** When a run is recorded on a brief, the run history becomes visible to `handoff_get_run_history`, and a failed run with a recorded lesson is offered to Recall as a `learn` candidate (the agent confirms; the server never writes a lesson on its own).
- **Fleet Status preflight gates Verify and Handoff.** Before a verify run launches a deploy check or a resumed worker starts, `fleet_preflight` confirms each credential the run needs is live. A dead credential fails the preflight instead of killing an attempt mid-run (Report Part 1, runner: 10 attempts died on OAuth/auth failures in one week; Report Part 4, Idea 2).
- **Verify results are Handoff state.** A verification result is stored with its file hash, so a resumed agent reuses the prior attempt's green checks instead of re-running the battery (Report Part 1, Codex: gate 18x plus locale 15x for one lesson, no result caching visible).
- **Issue Context feeds Fleet Status.** `fleet_what_changed_since` includes issue state changes from the change feed, so a supervision loop makes one call instead of polling `gh issue list` twice per iteration (Report Part 1, Claude: the 853-character poll loop).

### 2.5 Component map

- **One Cloudflare Worker** serving the MCP endpoint (Streamable HTTP) plus health and version routes. One codebase, one deploy, one domain. Internal modules per area (exemplar, recall, issue, brief, fleet, verify, handoff) share the core in Section 2.2.
- **Durable Objects** for the two genuinely stateful behaviors: `fleet_wait_for` subscriptions (server-side wait, one object per waited condition) and Handoff checkpoint coordination (one object per session, serializing checkpoint writes).
- **D1** for structured records: version registry, change feed, briefs, run history, checkpoints index, verification records, issue cache index, lessons index, audit log.
- **KV** for the hot cache: cached issue bodies, cached verification results, cached state snapshots, with per-class TTLs.
- **R2** for blobs: exemplar and doc bodies, lesson attachments, render PNGs, benchmark raw-data archive (Section 8.4).
- **Cloudflare Browser Rendering** for `verify_render`: a warm browser pool behind the render tool, so agents stop launching Chromium themselves (Report Part 1, Claude: 327 Playwright launches, 286 in one session).
- **Upstream APIs, server-side only:** GitHub API (issues, PRs), Vercel and Cloudflare deployment APIs (deploy status), and the agentdb store (Recall reads the live store; see Section 4.4 for the sync design). Upstream credentials live in Workers secrets, never in the repo and never in prompts (Section 6).

## 3. Tools and resources

Naming: flat MCP tool names, `<area>_<verb>`, matching the MCP tool-name rule (letters, digits, underscore, hyphen only; no dots). Every tool response is a JSON object with a `meta` block: `content_hash`, `version`, `cache_status`, `fetched_at`, and `source` (which upstream or store served it). Every tool that takes a `since_version` or `since` parameter returns a delta when the caller already holds a version, and the full object only when it does not.

Two dedup decisions from the report's Part 4 tool lists: `get_brief` appears in both Exemplar (Idea 1) and Brief (Idea 8); it lives once, under Brief, and Exemplar cross-references it. `render` appears in both Verify (Idea 3) and Render (Idea 7); it lives once, under Verify, per Section 2.3. `diff_screenshots` (Idea 7) and `visual_diff` (Idea 3) are the same operation; it is `verify_visual_diff`.

### 3.1 Context side

#### Exemplar: reference material as a versioned resource

Grounded in: 27.3% repeat prompt bytes; the L042 block pasted 8 times (97,622 redundant bytes); the shared brief pasted 4 times (30,588 redundant bytes); `CLAUDE.md` re-read 18 times (Report Part 4, Idea 1).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `exemplar_get` | `name` (string, required), `version` (optional; default current) | Exemplar body, `version`, `content_hash`, `created_at`, `change_note` | Immutable by version; KV cached indefinitely per version; current-version pointer cached with a 60 s TTL |
| `exemplar_list` | `prefix` (optional), `limit` (default 50) | Name, current version, hash, size, updated time per exemplar | List cached 60 s |
| `exemplar_what_changed` | `name`, `since_version` (required) | Diff between versions (unified diff for text, field-level diff for JSON), `from_version`, `to_version` | Diffs computed on demand and cached per (name, from, to) triple |
| `doc_get` | `path`, `version` (optional) | Canonical doc body plus version metadata (same shape as `exemplar_get`) | Same as `exemplar_get` |
| `doc_list_canonical` | none | The canonical doc set (the docs every lane re-establishes from scratch today) | List cached 60 s |

Resources: `exemplar://<name>`, `doc://<path>`. A resource read returns the current version; a resource read with a version fragment returns that version.

#### Recall: agentdb as MCP, with store health

Grounded in: 36 recall plus 55 learn calls via bash across 12 Claude sessions; recall ran in only 3 of 9 recent Claude sessions and 6 of 193 recent Codex commands despite being instructed in every brief; 4,628 live learnings; 15 of 77 DBs with stale schema; errors tables dead since early September (Report Part 4, Idea 5; Report Part 1, agentdb).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `recall_query` | `query` (string, required), `limit` (default 8), `kinds` (optional filter: failure, gotcha, pattern, preference) | Ranked lessons: `id`, `kind`, `what`, `why`, `hit_count`, `last_recalled`, `source_db`, `score`, plus `total_matches` | Query results cached 5 min per normalized query; recall also bumps `hit_count` in D1 (the usage telemetry the bash path never produced) |
| `recall_learn` | `kind` (required), `what` (required), `why` (required), `source` (optional: session or task ref) | Created lesson `id`, `version`, `content_hash` | Write-through: D1 first, then the agentdb store sync (Section 4.4); invalidates matching query caches |
| `recall_list_lessons` | `topic` (required), `limit` (default 20) | Lessons on the topic, newest first, with hit counts | Cached 5 min per topic |
| `recall_store_health` | none | Per-DB: schema version, drift flags, learnings count, never-recalled count and rate, errors-table last-write timestamp, coverage gaps (queries with 0 results in the last 7 days, e.g. the empty "workday" recall), top failure classes by keyword | Computed on demand, cached 1 h; the health snapshot itself is versioned and stored |

Resources: `lesson://<id>`, `gotcha://<id>`.

Design note: Recall is the adoption instrument as well as the memory tool. The benchmark measures whether recall actually runs through MCP (adoption) alongside the outcome, because the report's finding is that the instructed memory path is often skipped (Report Part 3). Every `recall_query` call is logged with its query, result count, and caller, so adoption is measured, not assumed.

#### Issue Context: GitHub state as structured, cached data

Grounded in: 500 gh calls across 12 Claude sessions; 314 gh calls with 142 extra repeated fetches across 12 Codex sessions; 488 runner re-attempts each paying a fresh issue fetch; gh CLI foot-guns among the most-recalled agentdb lessons (Report Part 4, Idea 4). Scope: personal repos on the allowlist only (Section 6). No TBS repos.

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `issue_get` | `repo` (required, must be allowlisted), `number` (required), `include_comments` (default true, capped at the last 8, matching the runner brief shape), `since_version` (optional) | Structured issue: title, body, state, labels, assignees, linked PRs, comments, `version`, `content_hash`, `github_updated_at` | Cached in KV with a 60 s TTL; served stale-while-revalidate when GitHub is slow; invalidated immediately by the GitHub webhook (Section 7) |
| `issue_list` | `query` (structured filters: repo, state, labels, assignee, updated-since), `limit` (default 50) | Matching issues, summary fields only (no bodies), `total_count` | Cached 60 s per normalized query |
| `issue_what_changed` | `repo`, `since` (timestamp or version, required) | New, closed, updated, and commented issues since `since`, with per-issue field-level change summaries; replaces the poll loop plus seen-file | Reads the change feed; no upstream call when the feed covers the window |
| `issue_comment` | `repo`, `number`, `body` (required) | Created comment id and URL | Write-through to GitHub; invalidates the issue cache. Structured write, replacing `gh api -f body=@file`, which the report records as writing a 14-byte literal body (Report Part 1, agentdb) |

Resources: `issue://<repo>/<number>`, `pr://<repo>/<number>`.

#### Brief: the brief as a structured object with run history

Grounded in: 91 single-line pointer prompts each naming a brief file twice; 4 lessons with the same brief executed twice within the hour; 7 duplicate-task pairs; the fleet doctrine that briefs are the judgment point (Report Part 4, Idea 8).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `brief_get` | `id` (required), `version` (optional), `include_runs` (default true, last 5 runs) | Parsed brief: goal, inputs, acceptance criteria, constraints, plus run history (each run: outcome, duration, worker, summary, lesson links) | Immutable by version; current-version pointer cached 60 s |
| `brief_create` | `goal`, `inputs`, `acceptance` (required), `constraints`, `source_ref` (optional: issue or task ref) | Created brief `id`, `version` | Write-through to D1; new brief starts at version 1 |
| `brief_record_run` | `brief_id`, `outcome` (done, failed, blocked, machine, preempted, retired), `summary`, `duration_s`, `lesson_ids` (optional) | Updated brief version, run record id | Write-through; invalidates the brief cache; appends to the change feed so Handoff sees it |

Resources: `brief://<id>`, `run://<brief-id>/<n>`.

### 3.2 State side

#### Fleet Status: job and flight state as a service, plus credential preflight

Grounded in: 179 sqlite3 queries, 131 wait/listen calls, 311 sleep commands, 500 gh calls, and the 37-invocation poll loop across 12 Claude sessions; `vaults ctx` 169 times in Codex; 10 runner attempts died on OAuth/auth failures in one week, with OAuth expiry the top recurring failure class (Report Part 4, Idea 2).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `fleet_get_flight` | `id` (required) | Flight state: status, started, updated, worker, task ref, progress, last event | Live read from the state store; cached 10 s; `fetched_at` always present so the agent knows the freshness |
| `fleet_list_flights` | `state` (optional filter), `limit` (default 50) | Flights matching the filter, summary fields | Cached 10 s |
| `fleet_get_job` | `id` (required) | Job state: status, attempts, last outcome, next scheduled run | Live read; cached 10 s |
| `fleet_what_changed_since` | `timestamp` (required) | New, closed, updated, and failed flights and jobs since the timestamp, including issue state changes from the change feed | Reads the change feed; no polling |
| `fleet_wait_for` | `condition` (structured: flight id plus target state, or job id plus target state, or change-feed pattern), `timeout_s` (default 300, max 3,600) | Returns when the condition is met or the timeout expires: `met` (bool), `final_state`, `waited_s` | Server-side wait via Durable Object; the agent makes one call instead of sleeping and re-querying. This replaces the 311 sleep commands and the 37-invocation poll loop (Report Part 1, Claude) |
| `fleet_preflight` | `account` (required), `needs` (list of required credentials and checkouts, e.g. claude-oauth, codex-oauth, github, wrangler, repo checkout path) | Per-credential status: `live`, `expired`, `missing`, or `unknown`, with `checked_at` and a non-sensitive detail string (never a token, never a secret). Overall `go` / `no_go` | Credential liveness is probed live on every call (never cached past 60 s); a dead credential fails the preflight instead of killing an attempt mid-run |

Resources: `flight://<id>`, `job://<id>`.

#### Verify: cached verification, deploy and live-state checks, and Render

Grounded in: 32 Antigravity lanes re-reporting verification; 327 Playwright launches; Codex gate/locale/verify loops re-run 18 plus 15 plus 17 plus 15 plus 14 times; 48 runner verification failures after done claims; the Vercel readyState lesson as the most cross-cutting agentdb lesson (Report Part 4, Idea 3). Render grounded in: 327 Playwright launches; 38 screenshot PNGs re-read 2 or more times (90 total re-reads) (Report Part 4, Idea 7).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `verify_check` | `file` (path or content hash), `checks` (list: json-parse, em-dash-scan, copy-slot-scan, md5, plus named check suites), `force` (default false) | Pass/fail per check, evidence (counts, first failing line, hashes), `file_hash`, `run_id` | Content-addressed: if the file hash and check list match a stored result, return the cached result with `cache_status: hit` and the original evidence; run only on a miss or `force: true` |
| `verify_get` | `file_hash` (required), `checks` (optional filter) | Stored verification result, or `not_found` | Direct cache read |
| `verify_deploy_status` | `deployment` (provider plus deployment id or URL) | `readyState`, build status, deploy URL, `checked_at`; catches a failed build before the verify step (the readyState lesson) | Cached 30 s; a failed build result is cached 5 min to stop re-probing |
| `verify_live_check` | `url` (required), `expected_text` (required) | `found` (bool), HTTP status, response excerpt, `checked_at` | Cached 60 s per (url, expected_text) |
| `verify_render` | `url` (required), `viewport` (default 390x844 phone width, matching the fleet's phone-screen verification habit), `state` (optional: signed-in, locale, theme), `full_page` (default false) | `render_id`, screenshot (as an MCP image content part or an R2 URL, caller chooses), `content_hash` of the rendered page, `rendered_at` | Content-addressed: same URL plus viewport plus state plus content hash returns the cached render; a new render runs only when the content hash changed. Warm browser pool via Cloudflare Browser Rendering |
| `verify_get_render` | `render_id` (required) | Cached render (screenshot plus metadata), or `not_found` | Direct cache read |
| `verify_visual_diff` | `render_id` (required), `previous_id` (required) | `changed` (bool), diff percentage, diff image (optional), changed regions | Diff computed on demand, cached per (render_id, previous_id) |

Resources: `verification://<file_hash>`, `render://<id>`, `screenshot://<url-hash>`.

Design note: `verify_check` never trusts its own cache blindly. A cached result carries the file hash it was computed against; the caller passes the current hash, and a mismatch is a miss. The 48 runner verification failures after done claims (Report Part 1, runner) are the failure mode this design targets: verification runs against the actual current bytes, or the cache says so explicitly.

#### Handoff: session continuity across restarts and worker deaths

Grounded in: 7 Antigravity duplicate-task pairs; one documented 80-minute run spent on cancelled work because the run only read the inbox at start; 76 compactions plus 209 post-compaction re-reads in Codex; 488 runner re-attempts; 77 worker deaths; one task preempted 112 times in 35 minutes; one task retried 6 times for a missing checkout with no backoff and no learning between retries (Report Part 4, Idea 6).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `handoff_save_checkpoint` | `session` (required), `state` (structured: current step, files touched with hashes, decisions made, pending items, brief version pinned), `note` (optional) | `checkpoint_id`, `checkpoint_n`, `saved_at` | Write-through to D1 plus R2 (state blob); appends to the change feed |
| `handoff_resume` | `session` (required) | Latest checkpoint, plus the composition from Section 2.4: brief diff since the checkpoint, lessons recorded since the checkpoint, issue delta since the checkpoint, and `what_changed` for every file the checkpoint names (hash comparison, so the resumed agent re-reads only changed files) | Composed live from D1 plus the change feed; the checkpoint itself is immutable |
| `handoff_list_sessions` | `state` (optional filter: active, dead, completed), `limit` (default 50) | Sessions with last checkpoint time, last worker, status | Cached 30 s |
| `handoff_get_run_history` | `task` (required: task or brief ref) | Every run of the task: worker, outcome, duration, summary, checkpoint ids, lesson links; includes the prior attempt's outcome so a retry reads state instead of re-fetching the issue and re-reading the repo | Read from D1; cached 60 s |

Resources: `session://<id>`, `checkpoint://<session>/<n>`.

Design note: checkpoints are written by the agent at natural boundaries (after each completed step, before any long wait, before any risky operation) and by the runner on worker death when a last state is recoverable. The server never fabricates a checkpoint. A session with no checkpoint resumes to its brief plus run history, which is still strictly better than today's fresh-issue-fetch plus full prompt rebuild.

## 4. Data model

### 4.1 Entities

| Entity | Key | Stored in | Notes |
|---|---|---|---|
| Exemplar version | (name, version) | D1 (registry) + R2 (body) | Immutable. Body addressed by content hash. |
| Doc version | (path, version) | D1 (registry) + R2 (body) | Same shape as exemplars. |
| Lesson | id (stable, content-derived) | D1 (index) + agentdb store (source of truth, see 4.4) | Kind, what, why, hit count, source DB, created and last-recalled timestamps. |
| Issue cache entry | (repo, number, version) | D1 (index) + KV (body) | Version increments on every GitHub change event; body is the structured issue JSON. |
| Brief version | (id, version) | D1 | Parsed fields plus run history links. |
| Run record | (brief_id, n) | D1 | Outcome, duration, worker, summary, lesson links. |
| Checkpoint | (session, n) | D1 (index) + R2 (state blob) | Immutable. State blob is structured JSON, not a transcript dump. |
| Session | id | D1 + Durable Object | Status, last checkpoint, last worker, task ref. |
| Flight | id | D1 | Status, worker, task ref, progress, last event. |
| Job | id | D1 | Status, attempts, last outcome, next run. |
| Verification result | (file_hash, check list hash) | D1 + KV | Pass/fail per check, evidence, run id, computed timestamp. |
| Render | id | D1 (metadata) + R2 (PNG) | URL, viewport, state, content hash, rendered timestamp. |
| Change event | sequence number (monotonic) | D1 | Resource, version, timestamp, change kind, actor. The single ordered log every `what_changed` tool reads. |
| Audit entry | id | D1 | Caller token id, tool, inputs (sanitized: no secrets), result class, latency, timestamp. |
| Credential status | (account, credential) | KV (60 s TTL only, never persisted long-term) | Liveness only. No secret material is ever stored by this server. |

### 4.2 Storage choices and why

- **D1** holds everything that needs querying, ordering, or joining: the version registry, the change feed, briefs, runs, checkpoints index, verification records, issue cache index, lessons index, audit log. One database, one schema, migrations in the repo.
- **KV** holds the hot cache only: cached issue bodies, cached verification results, cached state snapshots, cached query results. KV is a cache, never the record: every KV entry has a D1 or upstream source of truth, and losing KV loses speed, not data.
- **R2** holds blobs that are large or rarely read: exemplar and doc bodies, checkpoint state blobs, render PNGs, and the benchmark raw-data archive (Section 8.4). R2 objects are named by content hash, so they are immutable and deduplicated by construction.
- **Durable Objects** hold only coordination state: `fleet_wait_for` subscriptions and per-session checkpoint serialization. They hold no long-lived data; everything durable lands in D1 or R2.

### 4.3 Versioning scheme

- Every versioned resource has a monotonic integer version (1, 2, 3, ...) plus a SHA-256 content hash of its canonical bytes. The version orders changes; the hash proves identity.
- Versions are append-only. An update creates a new version; no version is ever edited or deleted. A deletion is a new version with `status: deleted` (tombstone), so `what_changed` can report it.
- Every tool response carries `version`, `content_hash`, and `fetched_at`. A caller that holds version N asks for the delta since N; the server answers with the diff or with `unchanged: true`.
- The change feed assigns a single monotonic sequence number across all resources, so `fleet_what_changed_since(timestamp)` and `issue_what_changed(repo, since)` can be answered from one log with a consistent ordering.

### 4.4 Recall and the agentdb store

The live agentdb store is a set of SQLite files on the Studio (77 `agent.db` files under `~/VaultsInternal`, deduplicated by real path; Report Part 1, agentdb). The server does not move the store and does not replace it. The design:

- The server keeps a D1 index of lessons (id, kind, text hash, source DB, hit count, timestamps), synced from the Studio by a small sync job that runs on the Studio and pushes changes to the server. The sync is incremental (new and changed rows only, keyed by row id plus content hash) and runs on a schedule plus on demand after a `recall_learn` write.
- `recall_learn` writes to D1 first (so the lesson is visible to every client immediately), then the sync job writes it back to the owning agentdb DB on the Studio. If the write-back fails, the lesson stays in D1 and the failure is recorded in the health snapshot; the server never silently drops a lesson.
- `recall_store_health` reads the D1 index plus the sync job's own report (schema versions per DB, errors-table last-write timestamps, never-recalled counts). This is what makes the store's health visible: today 15 of 77 DBs have stale schema and the errors tables have had no writes since early September, and no health check monitors any of it (Report Part 1, agentdb).
- Scope: the sync covers personal-project DBs only. TBS DBs are excluded from the sync allowlist (Section 0). The report's agentdb counts include TBS DBs as measurement context; the server's recall corpus does not include them.

### 4.5 Cache invalidation rules

| Cache | Invalidation trigger |
|---|---|
| Exemplar/doc current-version pointer | New version published (immediate, write-through) |
| Exemplar/doc version body | Never (immutable by version) |
| Recall query results | New lesson recorded that matches the query terms, or 5 min TTL, whichever comes first |
| Issue body | GitHub webhook event for that issue or PR (immediate), or 60 s TTL |
| Issue list | 60 s TTL (lists are cheap to recompute and change often) |
| Flight/job state | State change event (immediate, write-through) or 10 s TTL |
| Verification result | Never invalidated by time; keyed by file hash, so a changed file is a different key. Explicit `force: true` re-runs. |
| Render | Never invalidated by time; keyed by URL plus viewport plus state plus content hash. A changed page is a different key. |
| Deploy status | 30 s TTL; failed-build results cached 5 min |
| Live check | 60 s TTL per (url, expected_text) |
| Credential liveness | 60 s TTL maximum; preflight probes live on every call when the caller passes `fresh: true` |

The governing rule: a cache entry is valid only while its key is valid. Content-addressed entries (verification, render, versioned bodies) cannot go stale because the key includes the content. Time-based entries (issue bodies, state snapshots) carry `fetched_at` and a TTL, and every response says whether it is fresh, cached, or stale, so the agent can decide whether to trust it.

## 5. Cloudflare deployment

### 5.1 Workers and transport

- **One Worker** (`fleet-mcp`) serves the whole server. Modules per area share the core in Section 2.2. The Worker is the unit of deploy, the unit of rollback, and the unit of the post-deploy sweep.
- **Transport: Streamable HTTP**, the current MCP transport. `POST /mcp` accepts JSON-RPC requests and returns JSON-RPC responses, with an optional SSE stream for server-initiated messages (used by `fleet_wait_for` progress and by resource change notifications). `GET /mcp` opens the SSE stream for clients that subscribe. No WebSocket, no legacy SSE endpoint.
- **Routes:**
  - `POST /mcp` and `GET /mcp`: the MCP endpoint.
  - `GET /health`: liveness plus dependency status (D1, KV, R2, GitHub API reachability, Browser Rendering reachability). Returns per-dependency status, not just a bare 200.
  - `GET /version`: deployed commit hash, build time, and the MCP protocol version the server speaks.
  - `POST /webhooks/github`: GitHub webhook receiver (issue and PR events) for cache invalidation. Verified with the webhook secret; events outside the repo allowlist are dropped.
  - `POST /internal/sync`: the agentdb sync endpoint, authenticated with a separate sync token, accepting only the Studio sync job.
- **Domain (proposed):** `mcp.ariaxhan.com` for production, `staging.mcp.ariaxhan.com` for the staging Worker. Final domain choice is Aria's call (Section 9).
- **Browser Rendering:** `verify_render` uses the Cloudflare Browser Rendering API (Puppeteer-compatible) for a warm browser pool. Renders run in the same Worker request when fast, or as a queued render with a pollable `render_id` when slow; the tool response always says which path was taken.

### 5.2 Deploy pipeline

- Repo (proposed): `ariaxhan/fleet-mcp`. `wrangler.toml` defines the Worker, the D1 database, the KV namespaces, the R2 buckets, the Durable Object classes, and the Browser Rendering binding. Secrets are set with `wrangler secret put`, never committed.
- Pipeline: pull request opens a preview deployment (staging Worker plus a staging D1); merge to `main` deploys to production via `wrangler deploy`. Every deploy is a single deliberate deploy per environment, verified after, following the fleet's deploy discipline.
- Post-deploy gate: a live sweep runs against the production endpoint after every deploy, modeled on the Teaching MCP sweep pattern (282 checks, all pass, Nov 20, 2026; Report Part 2). The sweep for this server exercises every tool once against staging data, checks `/health` and `/version`, and verifies the deployed commit hash matches `main`. The sweep receipt (checks run, pass/fail, latencies) is stored in R2 and linked from the deploy record. A failed sweep blocks the deploy from being called done; rollback is `wrangler rollback`.
- D1 migrations run as part of deploy (`wrangler d1 migrations apply`), forward-only, with the migration files in the repo. No manual schema edits.
- Observability: Workers Logs plus structured per-call logging to D1 (the audit log, Section 4.1). A daily summary (calls per tool, cache hit rates, error rates, p50/p95 latency) is computed from the audit log and stored as a versioned record, so the server's own usage is measurable without a separate analytics service.

## 6. Auth model

### 6.1 Who can call it

- **Aria's agents:** the Studio runner, Claude and Codex lanes, and Muse. Each gets its own token, so usage and abuse are attributable per caller.
- **Aria's clients:** scoped tokens per client, limited to that client's repos and to read-only tools unless Aria grants write scope. A client token can never see another client's data, and can never see Aria's personal fleet state (flights, jobs, checkpoints) unless explicitly granted.
- **Aria herself:** an admin token with full scope, used from ChatGPT or Claude for ad-hoc recall and status checks.

### 6.2 Token model

- Bearer tokens, issued by Aria, stored as Workers secrets (a hashed token table in D1; the server stores hashes, never plaintext tokens). Each token carries: owner, scope list, repo allowlist, expiry, and a revocation flag.
- Scopes: `read` (all get/list/what_changed tools), `write` (learn, create, comment, record_run, save_checkpoint), `preflight` (credential checks), `admin` (token management, health, sync). A token with only `read` cannot write anything, even if the agent asks it to.
- Tokens are per-client and per-agent, never shared, never pasted into prompts, never committed to any repo. An agent receives its token from its own environment (the runner injects it; a lane reads it from its own secret store), never from a brief or a prompt.
- Rotation: tokens expire after 90 days by default (a design choice, not a measured number) and can be revoked immediately. Revocation is a D1 flag, effective on the next call.

### 6.3 Upstream credentials

- The server's own upstream credentials (GitHub token, Vercel token, Cloudflare API token) live in Workers secrets. They are never in the repo, never in a prompt, never in a tool response, and never in a log. Tool responses that describe credential status (preflight) return liveness only (`live`, `expired`, `missing`), never any secret material and never a partial token.
- The GitHub token is scoped to the repo allowlist and to the minimum permissions the tools need (read issues and PRs; write comments only where the `issue_comment` tool is enabled). The token's scope is documented in the repo's README so a reviewer can check it.
- The preflight concept from Fleet Status (Section 3.2) is the credential story for the agents, not just for the server: before a lane launches, `fleet_preflight` verifies each credential that lane needs (Claude OAuth, Codex OAuth, GitHub, wrangler, repo checkout) and returns a go or no-go. A dead credential fails the preflight instead of killing an attempt mid-run. This addresses the measured failure class directly: OAuth expiry is the top recurring failure class in agentdb, and 10 runner attempts died on OAuth/auth failures in one week (Report Part 1, agentdb and runner).

### 6.4 Repo allowlist (the TBS boundary, enforced in code)

- Issue Context, Recall sync, and Fleet Status operate only on repos named in an explicit allowlist in D1, managed by Aria. The allowlist is a whitelist, not a blacklist: a repo not on the list is refused, with an error that names the repo and the allowlist, so a misconfiguration is visible instead of silent.
- The Thinking-Brain-School org and every TBS repo are not on the allowlist and cannot be added without an explicit, recorded decision by Aria. The webhook receiver drops events for repos outside the allowlist. This is the code-level enforcement of the scope boundary in Section 0.

## 7. Caching, versioning, and delta strategy

### 7.1 Content-addressed caching

- The cache key for a computed result is the hash of its canonical inputs: for verification, the file hash plus the check list; for renders, the URL plus viewport plus state plus content hash; for versioned bodies, the content hash itself. Two agents asking the same question with the same inputs get the same cached result, with `cache_status: hit` and the original evidence attached.
- The second agent never re-runs work the first agent already did. That is the whole point, and it is measurable: the benchmark counts cache hits per tool and reports the hit rate alongside the token and time savings (Section 8).
- Cache entries carry their key, their computed timestamp, and the identity of the computation (tool version, check version). A new check version is a new key, so a changed checker never serves a stale result computed by the old one.

### 7.2 `what_changed` and diff semantics

- Every `what_changed` tool takes a `since` (timestamp, version, or change-feed sequence number) and returns three lists: `added`, `changed`, `removed`, each with per-item field-level change summaries. For text resources, `changed` items include a unified diff; for structured resources, a field-level diff (old value, new value, per field).
- If nothing changed, the response is `unchanged: true` with the current version and timestamp, and no body. The agent pays for a tiny response instead of a full re-fetch. This is the direct replacement for the re-read class: 858 extra re-reads (42.8% of all reads) in the Codex sample, and the 209 files re-read across compaction boundaries (Report Part 1, Codex).
- The change feed is the single source for all `what_changed` answers. A tool never re-derives changes by comparing two full fetches; it reads the log. The log is append-only and sequence-numbered, so a `since` value is unambiguous.

### 7.3 How a second agent gets a cached result instead of re-running work

1. Agent A calls `verify_check` on a file. Miss: the server runs the checks, stores the result under the file hash, returns it with `cache_status: miss`.
2. Agent B calls `verify_check` on the same unchanged file. Hit: the server returns the stored result with `cache_status: hit`, the original evidence, and the original `run_id`. No check runs. The response is byte-identical to what Agent A got, plus the cache metadata.
3. The file changes. Agent C calls `verify_check`. The file hash differs, so the key differs: miss, fresh run, new stored result. No stale green.
4. The same shape holds for renders (content hash), issue bodies (webhook invalidation plus TTL), exemplars (version pinning), and recall queries (5 min TTL plus write invalidation).

### 7.4 Freshness contract

Every response states its freshness in the `meta` block: `cache_status` (`hit`, `miss`, `stale`, `bypass`), `fetched_at`, `content_hash`, `version`, and `ttl_remaining_s` where a TTL applies. `stale` means the entry exceeded its TTL but was served while a refresh runs in the background (stale-while-revalidate, used only for issue bodies and state snapshots, never for verification or renders). The agent decides whether `stale` is acceptable for its purpose; the server never hides staleness.

## 8. Benchmark plan

This section is governed by Aria's binding evidence standard (Nov 22, 2026, 16:42 PT): the final results must be solid, verified, and backed by enough data that they could go in a research paper and prove to anyone that they are real. No hallucinations. No invented numbers. No exaggeration. The standard has six parts, and each is an explicit requirement below: preregistration, controlled experiments with confidence intervals, traceability to raw data, independent verification, UNPROVEN labeling, and full reporting.

### 8.1 What to measure

Per task, in both arms (the metric set extends the KERNEL controlled benchmark design in Report Part 3):

- **Tokens:** input tokens, output tokens, and cache-read tokens, from the session record. Cache-read tokens are the cost driver in the baseline (23.5M cache-read vs about 215k output tokens across 9 recent Claude sessions; Report Part 1, recent Claude), so they are reported separately, never folded into a single token total.
- **Wall-clock time:** task start to task end, plus tool time as a subset (tool time was 75% of wall time in the recent Claude sample; Report Part 1, recent Claude).
- **Tool calls:** total, by type, and by class (state checks, re-fetches, re-reads, verification runs, renders, sleeps). Sleep commands are counted explicitly: the "with" arm should show zero sleep loops.
- **Cache behavior (with arm only):** cache hits and misses per tool, hit rate, bytes served from cache vs computed fresh.
- **Errors:** failed commands, wrong-file reads, reverted edits, verification failures after done claims.
- **Outcome correctness:** did the task complete correctly, verified independently (Section 8.5). A faster wrong answer is a failure, not a saving.
- **Adoption:** did the agent actually use the server tools (recall ran? checkpoint saved? preflight run?). The report's finding is that the instructed memory path is often skipped (recall in only 3 of 9 recent Claude sessions; Report Part 1), so adoption is measured alongside the outcome, as Report Part 3 requires.
- **Cost:** dollars per task, computed from the session token counts and the model price at run time. The baseline cannot supply dollars (runner.sqlite has no cost or token column; Codex rollouts carry no cost field; Report, Limitations), so the benchmark records cost itself from the start.

### 8.2 Control group

- **The "without" side is two things, kept distinct.** (a) The transcript baselines from the report: the measured counts in Section 1.2 are the "without" numbers for the deterministic replays in Section 8.3. (b) A live control arm: the same tasks run without the server, by the same model, from the same brief and the same starting state, with arm order randomized (the KERNEL design in Report Part 3). The live control arm is what makes the agent experiment causal; the transcript baselines alone cannot, because the fleet already uses KERNEL almost everywhere and the transcript data has almost no control group (the observational KERNEL split had a control group of n=1; Report Part 3).
- **Control-arm rule (preregistered decision, needs reviewer sign-off, Section 9):** the control arm works the way agents work today: brief plus files plus CLI, including bash `agentdb` access, because that is the honest "today" baseline. The claim under test is "the server improves on today's workflow", not "the server improves on an agent stripped of its memory". The treatment arm adds the MCP server on top of the same baseline. This rule is written into the preregistration (Section 8.6) before any run.
- **Blinding:** outcome correctness is scored without the scorer knowing which arm produced the result, wherever the scoring method allows it. The scoring script reads session artifacts by run id, and the arm mapping is held separately until scoring is complete.

### 8.3 Deterministic replays (no agent runs; exact numbers)

These replays use the already-measured baselines as the "without" side and the server as the "with" side. They need no agent runs, produce exact counts rather than estimates, and run first, before the agent experiment. Each replay's good-result bar comes from Report Part 4 and is a target, not a measured result.

| Replay | Baseline (measured) | With-side method | Good-result bar (target, from Report Part 4) |
|---|---|---|---|
| Exemplar: replay the 134 Antigravity lane prompts with exemplar fetches instead of pastes | 148,020 redundant bytes, 27.3% of prompt bytes | Replace each pasted block with a fetch reference; measure prompt bytes plus tokens | Repeat bytes under 5% of prompt bytes (Idea 1) |
| Issue Context: replay the sampled sessions' gh calls through the server | 500 gh calls (Claude) plus 314 (Codex), 142 extra repeated fetches | Route each call through `issue_get` / `issue_list`; measure calls plus bytes | One fetch per unique issue per session; structured JSON instead of CLI dumps; no foot-gun writes (Idea 4) |
| Verify: replay the verification battery through the cache | 32 lanes re-running the same checks; gate 18x plus locale 15x plus hero 17x plus promotion 15x plus verify 14x; 327 Playwright launches | Run each check once per file hash; render once per content hash; measure check invocations plus launches | One check run per unique file hash; launches only for changed content; deploy-status checks catch a failed build before the verify step (Idea 3) |
| Fleet Status: re-run the coordinator session's supervision loops via the server | 179 sqlite3 plus 131 wait/listen plus 311 sleep plus 500 gh calls (Claude); 169 `vaults ctx` polls (Codex) | Replace each poll loop with `fleet_wait_for` plus `fleet_what_changed_since`; measure state-check calls plus wall-clock time | 80% fewer state-check calls, no sleep loops, zero attempts launched with a dead credential (Idea 2) |
| Handoff: replay a worker-death scenario | 7 duplicate-task pairs; 76 compactions plus 209 post-compaction re-reads; 488 re-attempts; 77 worker deaths | Kill a worker mid-task, resume via `handoff_resume`; measure re-done work | Zero re-done work; the retry reads the prior attempt's state instead of re-fetching the issue and re-reading the repo (Idea 6) |
| Brief: replay the duplicate pairs via the server | 91 pointer prompts; 7 duplicate-task pairs | The retry reads the brief once plus the prior run's outcome | The retry does not repeat the first attempt's error (Idea 8) |
| Recall: same recall/learn via MCP | 91 agentdb calls via bash; recall in only 3 of 9 recent sessions; errors tables dead; 15 of 77 DBs with stale schema | Measure MCP call latency vs bash spawn latency; measure adoption from MCP clients; check store health visibility | Recall works from any MCP client with latency under the bash equivalent; adoption is measurable instead of assumed (Idea 5) |

Replay results are exact counts, so they carry no confidence intervals, but they are still independently re-verified (Section 8.5) and their raw inputs and outputs are archived (Section 8.4). A replay is not a substitute for the agent experiment: replays prove the mechanism saves bytes and calls; only the agent experiment proves agents get faster and cheaper in practice.

### 8.4 Controlled agent experiment

**Tasks.** Real personal-project jobs with a recorded brief and a verifiable outcome, drawn from the runner's personal-project queues. The exact task list is preregistered (Section 8.6), not chosen in this PRD. Task families (illustrative, not the list): a deploy verification on a personal project, a triage pass over a personal repo's queue, a docs update, a bug fix with a verifiable outcome, a cold-read verification. No TBS tasks, no TBS lesson work (Section 0). Tasks are chosen for representativeness across the waste classes in Section 1.2, not cherry-picked for server-friendly shapes; the selection rule is written into the preregistration.

**Arms.** (A) With the server: the agent has the Fleet MCP tools plus today's baseline. (B) Without: the agent has today's baseline only (brief, files, CLI, bash agentdb). Same model, same brief, same starting state. Arm order randomized per task. The agent in each arm is a fresh agent; no agent runs both arms of the same task.

**Sample size: the KERNEL design (10 tasks x 2 arms) is the pilot, not the confirmatory sample.** It is not enough, for three measured reasons:

1. **Task-level variance is large and heterogeneous.** In the Codex sample, extra repeat executions ranged from 21 (S10, the tidiest session) to 392 (S1, the messiest); re-read rates ranged from near zero in tidy sessions to 55.4% in S5; GitHub waste concentrated in 2 of 12 sessions (Report Part 1, Codex). With that spread, 10 paired tasks yield wide confidence intervals that will often include zero even when a real effect exists.
2. **The observational precedent failed on sample size.** The KERNEL with/without split had a control group of n=1, which the report calls suggestive only, not proof (Report Part 3). A confirmatory experiment that repeats that mistake with n=10 tasks would be suggestive at a larger scale, not proof.
3. **Agent runs are nondeterministic.** The same task run twice by the same model can differ in tool calls, tokens, and time. A single run per task-arm confounds the server's effect with run-to-run noise. The design below measures that noise directly.

**The design, in three phases:**

- **Phase 1, pilot: 10 tasks x 2 arms = 20 runs.** This is the KERNEL design, reused as the pilot. Its purposes are to validate the harness (scoring script, token capture, outcome verification), to estimate the paired-difference standard deviation for each primary metric, and to catch design flaws before the confirmatory run. Pilot data is reported separately and is NOT pooled into the confirmatory result, so the pilot cannot inflate the confirmatory sample after the fact.
- **Phase 2, confirmatory: sample size computed from the pilot variance, with a floor of 30 tasks x 2 arms = 60 runs.** The computation is a standard paired power analysis: 80% power at a two-sided alpha of 0.05 to detect the preregistered minimum effect (Section 8.7) given the pilot's paired-difference standard deviation. The floor of 30 tasks applies regardless of what the power computation says, because 30 paired observations is the minimum for a stable mean estimate and a meaningful confidence interval under the observed heterogeneity. If the power computation demands more than 30 tasks, the run expands to that number, up to a preregistered cap of 50 tasks x 2 arms = 100 runs. If the pilot variance is so large that even 50 tasks cannot power the preregistered effect, the result is reported as UNPROVEN for that metric with the required sample size stated (Section 8.8), not run until something looks significant.
- **Phase 3, repeatability substudy: 10 of the confirmatory tasks, each re-run twice more per arm = 40 additional runs.** This gives 3 observations per task-arm for those 10 tasks, which measures run-to-run variance directly and lets the analysis separate the server's effect from agent nondeterminism. The substudy tasks are chosen at random from the confirmatory set and named in the preregistration.

**Minimum total: 120 agent runs** (20 pilot plus 60 confirmatory floor plus 40 repeatability). At the report's estimate of 10 to 60 minutes per run (Report Part 3), that is 20 to 120 hours of agent compute, parallelizable across the runner's workers. The actual compute cost is measured and reported as part of the result.

**Analysis.** Paired differences per task (with minus without) for each metric. Report the mean paired difference, the 95% confidence interval (paired t-interval, plus a bootstrap interval as a robustness check), the effect size (Cohen's dz for paired data), and the full per-task table, not just the aggregate. A result is claimed only when the 95% confidence interval excludes zero in the claimed direction. Variance is reported, never hidden: the per-task differences, the standard deviation, and the repeatability substudy's run-to-run variance all appear in the final report.

### 8.5 Existing benchmark material reused

- **llm-bench (42 tests, programmatic verifiers):** the model for outcome verification. Where a task's outcome can be checked programmatically (a file exists, a check passes, a URL serves expected text), the verifier is code, not a judge. Caveat carried forward from the report: the Oct 1-2 scores (devstral 0.792, qwen3-coder 0.770, lfm2.5 0.738) are pre-grading-revision and superseded; the corrected scores come from v3 rescoring (Report Part 2).
- **model-familiarity-engine (9 preregistered gates, Experiment 0):** the model for preregistration and for honest instrument verdicts. MFE's Experiment 0 returned NOT CERTIFIED (6 PASS, 2 PENDING, 1 FAIL on provenance) because the run could not prove which protocol collected its shards (Report Part 2). This benchmark's instrument must be able to return the same verdict: if provenance fails, the result is NOT CERTIFIED, not quietly published.
- **Transcript baselines:** the "without" numbers for the replays (Section 8.3) and the variance evidence for the sample size (Section 8.4).
- **KERNEL effectiveness:** NOT YET MEASURED (Report Part 2). This benchmark does not claim to measure KERNEL's effect; it measures Fleet MCP's effect over today's baseline, which includes KERNEL as installed.

### 8.6 Preregistration

- **Artifact:** `benchmark/preregistration.md` in the `fleet-mcp` repo, plus a machine-readable `benchmark/preregistration.json` with the same content. It contains: the hypotheses (one per primary metric), the full task list with selection rule, the arm definitions and the control-arm rule, the metric definitions and how each is captured, the sample size rule (pilot, power computation, floor of 30, cap of 50), the success thresholds (Section 8.7), the analysis plan (paired differences, 95% CIs, effect sizes, bootstrap check), the exclusion rules (which runs are excluded and why, decided before seeing results), the repeatability substudy task selection, and the verification plan (Section 8.5 and 8.8).
- **Freezing:** the preregistration is committed and tagged (`bench-prereg-v1`) with its SHA-256 hash recorded in the tag message and in the final report, BEFORE the first "with" run (pilot included). The tag is the proof that the criteria predated the results. No moving the goalposts after seeing the results.
- **Amendments:** if the preregistration must change, the change is a dated amendment entry appended to the artifact, stating what changed and why, committed under a new tag (`bench-prereg-v2`). The original stays in the repo. Any result affected by an amendment is flagged as such in the final report, with the amendment quoted.

### 8.7 Success criteria (preregistered targets, not measured results)

These thresholds are written into the preregistration before any run. Each is a target; the experiment may fail any of them, and a failed threshold is reported as failed.

| Metric | Success threshold (target) |
|---|---|
| Token reduction (input plus output plus cache-read, paired per task) | Mean reduction of at least 20%, with the 95% CI lower bound above 0 |
| Wall-clock reduction (paired per task) | Mean reduction of at least 15%, with the 95% CI lower bound above 0 |
| State-check and re-fetch tool calls (paired per task) | Mean reduction of at least 50% |
| Outcome correctness | Non-inferior: the with-arm correctness rate within 5 percentage points of the control arm (a faster wrong answer fails) |
| Preflight | Zero attempts launched with a dead credential in the with arm |
| Recall adoption (with arm) | Recall runs in at least 80% of with-arm sessions (baseline: 3 of 9 recent Claude sessions; Report Part 1) |
| Sleep loops (with arm) | Zero sleep commands in with-arm sessions (baseline: 311 across 12 Claude sessions; Report Part 1) |

### 8.8 Traceability, independent verification, and UNPROVEN labeling

- **Traceability:** every reported number is traceable to its raw data. Preserved and archived: the raw session transcripts for every benchmark run, the run logs, the raw measurement files, the scoring script, and the analysis. Small files live in the repo under `benchmark/data/`; large transcripts live in R2, with their content hashes and R2 keys recorded in the repo. The scoring script recomputes every reported number from the raw data with one command, so anyone can reproduce the result. The final report cites the source file for every number.
- **Independent verification:** the numbers are re-checked by a party other than the one that produced them. A separate verifier (a different agent or operator from the benchmark runner; the exact assignment is an open question in Section 9) re-runs the scoring script from the archived raw data and compares its output against the reported numbers, within a preregistered tolerance (exact match for counts; stated tolerance for derived statistics). Outcome correctness is scored by programmatic verifiers where possible (the llm-bench model) and by an independent judge panel where judgment is needed (the MFE model: a multi-family panel, with inter-judge agreement reported; MFE's panel agreement was 0.74 across n=339 cells, Report Part 2). A mismatch between the verifier's numbers and the reported numbers blocks publication until resolved.
- **UNPROVEN labeling:** if a result cannot be proven to this standard, it is reported as UNPROVEN, with what it would take to prove it (more runs, a better instrument, a different task set). Never inflate, never round up, never present a suggestive result as a proven one. A null result is a result and is reported as such, following the KERNEL design's own rule (Report Part 3: "If arm A is not better, report that too; a null result is a result").
- **Reporting:** the final report includes the method, the sample sizes, the confidence intervals, the effect sizes, the per-task differences, and where the raw data lives, not just the headline percentages. A headline percentage without its confidence interval and sample size is not published.

## 9. Risks and open questions

### 9.1 Risks

| Risk | What happens | Mitigation |
|---|---|---|
| Single point of failure | If the server is down, agents lose state access | The server is an accelerator, never a hard dependency. Agents fall back to today's CLI paths. `/health` plus the post-deploy sweep catch outages; the runner keeps working without the server, just slower. |
| Cache staleness serves wrong state | An agent acts on an outdated issue body or flight state | Content-addressed keys for computed results (a changed input is a different key); short TTLs plus webhook invalidation for live state; freshness metadata on every response so the agent can see staleness. |
| GitHub API rate limits | Heavy polling through the server exhausts the per-token hourly limit | The server is the fix, not the cause: caching plus the change feed cut upstream calls. The server tracks its remaining quota and reports it in `/health`; on quota exhaustion it serves stale cache with `cache_status: stale` instead of failing. |
| Browser Rendering cost and latency | Renders are the most expensive tool; a runaway render loop costs real money | Content-hash dedup plus cache-first behavior; per-token render quotas; the audit log records every render with its caller, so a runaway caller is visible. |
| Stored-content prompt injection | Lessons and exemplars are agent-written text served back into agent context; a poisoned lesson could steer future agents | Stored content is data with provenance (author, source, timestamp), never executed as instructions. The server never auto-writes lessons. A review path exists for lessons (flag and quarantine by id). |
| Scope creep | 8 ideas in one server; the build sprawls | Phased rollout (Section 10), one area at a time, each with its replay benchmark before the next starts. The PRD's tool list is the v1 scope; anything not listed is out. |
| Benchmark cost and time | 120 or more agent runs at 10 to 60 minutes each is real compute | Parallelize across runner workers; the compute cost is measured and reported as part of the result, so the cost of proving the saving is itself public. |
| The server's own token cost | Tool schemas and MCP plumbing add context tokens, which could eat the savings | The benchmark measures the net effect (with-server total tokens vs without), not gross savings. A server that costs more than it saves shows up as a null or negative result. |
| Task selection bias | Benchmark tasks cherry-picked for server-friendly shapes | The task list and selection rule are preregistered; tasks are real runner jobs, chosen for representativeness across waste classes. |
| TBS boundary failure | A misconfiguration exposes TBS data through the server | The allowlist is a whitelist enforced in code, tested by a test that proves a TBS repo is refused, and reviewed in the preregistration. The webhook receiver drops non-allowlisted repos. |

### 9.2 Open questions (for the reviewers)

1. **Name and domain:** is Fleet MCP the name, and is `mcp.ariaxhan.com` the domain? Both are proposals in this PRD.
2. **Client isolation:** do clients get isolated namespaces (separate D1 partitions or separate Workers) or a shared corpus with per-token scoping? The PRD proposes per-token scoping; a reviewer may prefer hard isolation.
3. **Render split trigger:** Section 2.3 places Render inside Verify with a split trigger of "render volume or browser-rendering cost dominates the server's bill or latency budget". What is the numeric trigger (share of bill, share of latency, renders per day)?
4. **Issue cache storage:** the PRD proposes a D1 index plus KV body. Is that the right split, or should issue bodies live in D1 as well for queryability?
5. **Retention:** how long are benchmark raw data, audit logs, checkpoints, and renders kept? The PRD proposes keeping benchmark raw data indefinitely (traceability) but does not set retention for the rest.
6. **Independent verifier:** who runs the independent verification in Section 8.8 (which agent or operator), and how is independence enforced (separate account, separate machine, no shared prompt)?
7. **Benchmark task list:** the exact tasks are preregistered later, not decided here. Who authors the list, and who checks it for representativeness?
8. **Control-arm rule:** Section 8.2 proposes that the control arm keeps bash agentdb access as the honest "today" baseline. Does the reviewer agree, or should the control arm be stripped (the KERNEL design's arm B)?
9. **Preflight scope:** which credentials and checkouts are in scope for v1 (Claude OAuth, Codex OAuth, GitHub, wrangler, repo checkouts)? Which are deferred?
10. **Rollout order:** Section 10 proposes the Context side first. Should Fleet Status go first instead, given that polling waste is the largest single class (311 sleeps, 169 `vaults ctx` polls, 179 sqlite3 queries)?
11. **Recall write-back failure mode:** if the Studio write-back of a lesson fails, the lesson stays in D1 and the failure is recorded (Section 4.4). Is D1-first acceptable as the source of truth in that window, or must the write fail loudly to the caller?
12. **Success thresholds:** are the Section 8.7 thresholds (20% tokens, 15% wall-clock, 50% state-check calls) the right bars, or should they be set from the pilot's measured variance instead of fixed in advance?

## 10. Rollout plan (proposed)

- **Phase 1, Context side:** Exemplar, Recall, Issue Context, Brief. Highest measured waste (27.3% repeat prompt bytes; 858 extra re-reads; 488 re-attempts each re-fetching the issue), lowest operational risk (no live waiting, no browser). Replay benchmarks for all four areas run at the end of this phase.
- **Phase 2, State side, no browser:** Fleet Status (including preflight) and Handoff. Replaces the polling loops and the re-attempt rebuild. Replay benchmarks for both areas.
- **Phase 3, Verify and Render:** cached verification, deploy and live-state checks, warm renders. Replay benchmarks for verification and render.
- **Phase 4, controlled agent experiment:** preregistration frozen, pilot, confirmatory run, repeatability substudy, independent verification, final report (Section 8).
- **Phase 5, clients:** scoped client tokens, per-client allowlists, client-facing documentation. Only after the benchmark is published, so client claims rest on proven numbers.

## Appendix A: Tool inventory

33 tools, 15 resource types.

- Exemplar (5): `exemplar_get`, `exemplar_list`, `exemplar_what_changed`, `doc_get`, `doc_list_canonical`. Resources: `exemplar://`, `doc://`.
- Recall (4): `recall_query`, `recall_learn`, `recall_list_lessons`, `recall_store_health`. Resources: `lesson://`, `gotcha://`.
- Issue Context (4): `issue_get`, `issue_list`, `issue_what_changed`, `issue_comment`. Resources: `issue://`, `pr://`.
- Brief (3): `brief_get`, `brief_create`, `brief_record_run`. Resources: `brief://`, `run://`.
- Fleet Status (6): `fleet_get_flight`, `fleet_list_flights`, `fleet_get_job`, `fleet_what_changed_since`, `fleet_wait_for`, `fleet_preflight`. Resources: `flight://`, `job://`.
- Verify, including Render (7): `verify_check`, `verify_get`, `verify_deploy_status`, `verify_live_check`, `verify_render`, `verify_get_render`, `verify_visual_diff`. Resources: `verification://`, `render://`, `screenshot://`.
- Handoff (4): `handoff_save_checkpoint`, `handoff_resume`, `handoff_list_sessions`, `handoff_get_run_history`. Resources: `session://`, `checkpoint://`.

## Appendix B: Number provenance

Every measured number in this PRD comes from `report.md` in this directory (and its `analysis/` files) and is cited inline with its report section. Numbers labeled as targets, thresholds, or design decisions are not measured results. No number in this PRD is invented. Where the report states a limitation (necessity not provable from transcripts alone; runner dollars unmeasurable; the KERNEL observational control group of n=1), this PRD carries the limitation forward instead of smoothing it over.
