# PRD: Fleet MCP, a unified MCP server for fleet state

**Status:** PRD v2 in revision (Phase 0). Revision sweeps are logged as dated notes in Appendix C. Originally a draft for review. Author: Muse (PRD author, per Aria's commission Nov 22, 2026, 16:40 PT).
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
- **Cache layer.** One cache layer governed by the cache identity and safety contract (Section 7.5): complete computation identities, caller-enforced freshness, durable snapshots in D1 or R2, transactional events with an outbox, and idempotent, fenced writes. Every response carries `cache_status` (`hit`, `miss`, `stale`, `bypass`), `content_hash`, `version`, and the four distinct timestamps of Section 7.5.3, so the agent and the benchmark can tell a cached answer from a fresh one.
- **Delta engine.** For versioned text resources, the server computes a diff between any two versions and returns the diff, not the whole object, when the caller already holds a version. This is the mechanism that turns the 27.3% repeat prompt bytes into a small delta (Report Part 1, Antigravity).
- **Auth and audit.** One token check and one audit log for every call (Section 6).

### 2.3 Render placement (design decision)

**Render lives on the State side as a tool group inside Verify, not as a separate server or a separate side.** Reasons:

1. The baseline report already places `render(url, viewport, state)` inside Verify's tool list (Report Part 4, Idea 3), and Render's own tools (`render`, `get_screenshot`, `diff_screenshots`) duplicate Verify's (`render`, `visual_diff`). One render implementation serves both.
2. A render is a verification artifact: it is identified by the Render identity of Section 7.5.7 (URL, viewport, state profile, renderer and browser version, readiness rule, normalization version), stored with its evidence, diffed against the previous render, and consumed by the same cold-read and deploy-gate agents that consume verification results. It shares Verify's storage, freshness contract, and evidence shape. Under the supported model (always-observe, Section 7.5.7) every `verify_render` call observes the live page; the cache deduplicates identical screenshots, it never skips the observation.
3. A separate Render server would duplicate the cache, the versioning, and the browser pool for no functional gain.

Render keeps its own tool names (`verify_render`, `verify_get_render`, `verify_visual_diff`) and its own resource namespace (`render://`), so it can be split into its own Worker later without renaming anything the agents call. The split trigger is defined in Section 5.3 on three metrics the daily audit summary already computes; its numeric thresholds are set from Phase 3 measurements and recorded as a dated amendment, never invented in this PRD. When the trigger fires, Render splits out behind the same tool names.

### 2.4 How tools compose across sides

The sides are not silos. The composition paths are first-class behaviors, not emergent accidents:

- **Handoff resume pulls from Exemplar plus Recall plus Issue Context plus Brief.** `handoff_resume` returns the checkpoint, then attaches: the brief version pinned at checkpoint time (Brief), a diff of the brief if it changed since (Brief, delta engine), lessons recorded since the checkpoint (Recall), and the issue delta since the checkpoint (Issue Context, change feed). This is the direct fix for the 488 runner re-attempts, each of which today pays a fresh `gh issue view` plus a full prompt rebuild (Report Part 1, runner).
- **Brief record_run feeds Handoff and Recall.** When a run is recorded on a brief, the run history becomes visible to `handoff_get_run_history`, and a failed run with a recorded lesson is offered to Recall as a `learn` candidate (the agent confirms; the server never writes a lesson on its own).
- **Fleet Status preflight gates Verify and Handoff.** Before a verify run launches a deploy check or a resumed worker starts, `fleet_preflight` confirms each credential the run needs is live. A dead credential fails the preflight instead of killing an attempt mid-run (Report Part 1, runner: 10 attempts died on OAuth/auth failures in one week; Report Part 4, Idea 2).
- **Verify results are Handoff state.** A verification result is stored with its complete computation identity (Section 7.5.1), so a resumed agent reuses the prior attempt's green checks only when that identity still matches its current workspace (same tree or dependency hashes, lockfile, check-suite version, and environment); any mismatch is a miss and the checks re-run (Report Part 1, Codex: gate 18x plus locale 15x for one lesson, no result caching visible).
- **Issue Context feeds Fleet Status.** `fleet_what_changed_since` includes issue state changes from the change feed, so a supervision loop makes one call instead of polling `gh issue list` twice per iteration (Report Part 1, Claude: the 853-character poll loop).

### 2.5 Component map

- **One Cloudflare Worker** serving the MCP endpoint (Streamable HTTP) plus health and version routes. One codebase, one deploy, one domain. Internal modules per area (exemplar, recall, issue, brief, fleet, verify, handoff) share the core in Section 2.2.
- **Durable Objects** for the two genuinely stateful behaviors: `fleet_wait_for` subscriptions (server-side wait, one object per waited condition) and Handoff checkpoint coordination (one object per session, serializing checkpoint writes).
- **D1** for structured records: version registry, change feed, briefs, run history, checkpoints index, verification records, issue cache index, lessons index, audit log.
- **KV** for disposable copies only: immutable bodies keyed by content hash or (resource, version), plus disposable copies of D1 or R2 records. KV never holds a mutable pointer or the only copy of anything (Section 7.5.4).
- **R2** for blobs: exemplar and doc bodies, lesson attachments, render PNGs, benchmark raw-data archive (Section 8.8).
- **Cloudflare Browser Rendering** for `verify_render`: a warm browser pool behind the render tool, so agents stop launching Chromium themselves (Report Part 1, Claude: 327 Playwright launches, 286 in one session).
- **Upstream APIs, server-side only:** GitHub API (issues, PRs), Vercel and Cloudflare deployment APIs (deploy status), and the agentdb store (Recall reads the live store; see Section 4.4 for the sync design). Upstream credentials live in Workers secrets, never in the repo and never in prompts (Section 6).

## 3. Tools and resources

Naming: flat MCP tool names, `<area>_<verb>`, matching the MCP tool-name rule (letters, digits, underscore, hyphen only; no dots). Every tool response is a JSON object with a `meta` block: `content_hash`, `version`, `cache_status`, the four timestamps of Section 7.5.3 (`served_at`, `source_observed_at`, `last_validated_at`, `computed_at`), and `source` (which upstream or store served it). Every tool that takes a `since_version` or `cursor` parameter returns a delta when the caller already holds a version, and the full object only when it does not.

**Delta cursor semantics (one rule everywhere).** The change-feed sequence number (Section 4.3) is the canonical cursor. Cross-resource change tools (`issue_what_changed`, `fleet_what_changed_since`) take an opaque, scoped `cursor` (it encodes the sequence number plus the caller's scope, so a cursor minted under one token or repo filter is rejected under another) and always return `next_cursor`. A call with no cursor returns the current state summary plus `next_cursor` (bootstrap); timestamps are never accepted as cursors. Single-resource diffs (`exemplar_what_changed`, `brief_get`, `issue_get`) take a resource `since_version`, the resource's own monotonic version. A cursor older than the retained feed window (Section 4.6) returns `cursor_expired` with a fresh `next_cursor`, never a silently partial delta.

**Idempotency (every write tool).** Every write tool (`recall_learn`, `issue_comment`, `brief_create`, `brief_record_run`, `handoff_save_checkpoint`, `verify_render`, and every control-plane write) takes a required `idempotency_key` (caller-generated string, scoped to the caller token). The server stores the key with the request hash and the result in D1; a retry with the same key and the same request returns the original result without a second side effect, and the same key with a different request is rejected with `idempotency_conflict`. This matters most for `issue_comment`, which is outward-facing: a retried worker never posts a duplicate comment.

Two dedup decisions from the report's Part 4 tool lists: `get_brief` appears in both Exemplar (Idea 1) and Brief (Idea 8); it lives once, under Brief, and Exemplar cross-references it. `render` appears in both Verify (Idea 3) and Render (Idea 7); it lives once, under Verify, per Section 2.3. `diff_screenshots` (Idea 7) and `visual_diff` (Idea 3) are the same operation; it is `verify_visual_diff`.

### 3.1 Context side

#### Exemplar: reference material as a versioned resource

Grounded in: 27.3% repeat prompt bytes; the L042 block pasted 8 times (97,622 redundant bytes); the shared brief pasted 4 times (30,588 redundant bytes); `CLAUDE.md` re-read 18 times (Report Part 4, Idea 1).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `exemplar_get` | `name` (string, required), `version` (optional; default current) | Exemplar body, `version`, `content_hash`, `created_at`, `change_note` | Immutable by version; KV cached indefinitely per version; current-version pointer cached with a 60 s TTL |
| `exemplar_list` | `prefix` (optional), `limit` (default 50) | Name, current version, hash, size, updated time per exemplar | List cached 60 s |
| `exemplar_what_changed` | `name`, `since_version` (required) | Diff between versions (unified diff for text, field-level diff for JSON), `from_version`, `to_version` | Diffs computed on demand and cached per (name, from, to) triple |
| `exemplar_get_doc` | `path`, `version` (optional) | Canonical doc body plus version metadata (same shape as `exemplar_get`) | Same as `exemplar_get` |
| `exemplar_list_docs` | none | The canonical doc set (the docs every lane re-establishes from scratch today) | List cached 60 s |
| `doc_what_changed` | `path`, `since_version` (required) | Diff between canonical doc versions, same shape as `exemplar_what_changed` | Cached per (path, from, to) triple |
| `ref_publish` | `kind` (exemplar or doc), `name` or `path`, `body`, `base_version` (required for an update, absent for a create; mismatch returns `version_conflict`), `change_note` (required), `source` (repo plus commit SHA and path, must be allowlisted), `idempotency_key` | New `version`, `content_hash`, `change_feed_seq` | Write-through: body to R2, metadata to D1, then the current-version pointer; invalidates the pointer and list caches; requires `write` scope plus the `publish` grant (Section 3.3) |

Resources: `exemplar://<name>`, `doc://<path>`. A resource read returns the current version; a resource read with a version fragment returns that version.

#### Recall: agentdb as MCP, with store health

Grounded in: 36 recall plus 55 learn calls via bash across 12 Claude sessions; recall ran in only 3 of 9 recent Claude sessions and 6 of 193 recent Codex commands despite being instructed in every brief; 4,628 live learnings; 15 of 77 DBs with stale schema; errors tables dead since early September (Report Part 4, Idea 5; Report Part 1, agentdb).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `recall_query` | `query` (string, required), `limit` (default 8), `kinds` (optional filter: failure, gotcha, pattern, preference) | Ranked lessons: `id` (stable), `content_hash`, `kind`, `what`, `why`, `hit_count`, `last_recalled`, `source_db`, `score`, plus `total_matches` | Query results cached 5 min per normalized query; recall also bumps `hit_count` in D1 (the usage telemetry the bash path never produced) |
| `recall_learn` | `kind` (required), `what` (required), `why` (required), `source` (optional: session or task ref), `supersedes` (optional: lesson id to correct; keeps that id and creates a new version, Section 3.3), `idempotency_key` | Created or corrected lesson `id`, `version`, `content_hash` | Write-through: D1 first, then the agentdb store sync (Section 4.4); invalidates matching query caches |
| `recall_list_lessons` | `topic` (required), `limit` (default 20) | Lessons on the topic, newest first, with hit counts | Cached 5 min per topic |
| `recall_quarantine` | `lesson_id`, `action` (flag, quarantine, release), `reason` (required), `idempotency_key` | Lesson `id`, new `status` (active, flagged, quarantined), `version` | Write-through; a quarantined lesson is excluded from `recall_query` results (an `admin` token may pass `include_quarantined: true`); a flagged lesson is still served, marked `flagged: true`; invalidates query caches. `flag` needs `write`; `quarantine` and `release` need `admin` |
| `recall_store_health` | none | Per-DB: schema version, drift flags, learnings count, never-recalled count and rate, errors-table last-write timestamp, coverage gaps (queries with 0 results in the last 7 days, e.g. the empty "workday" recall), top failure classes by keyword | Computed on demand, cached 1 h; the health snapshot itself is versioned and stored |

Resources: `lesson://<id>`. One namespace for every lesson kind (failure, gotcha, pattern, preference); the kind is a field, not a scheme, so a gotcha is `lesson://<id>` with `kind: gotcha`.

Design note: Recall is the adoption instrument as well as the memory tool. The benchmark measures whether recall actually runs through MCP (adoption) alongside the outcome, because the report's finding is that the instructed memory path is often skipped (Report Part 3). Every `recall_query` call is logged with its query, result count, and caller, so adoption is measured, not assumed.

#### Issue Context: GitHub state as structured, cached data

Grounded in: 500 gh calls across 12 Claude sessions; 314 gh calls with 142 extra repeated fetches across 12 Codex sessions; 488 runner re-attempts each paying a fresh issue fetch; gh CLI foot-guns among the most-recalled agentdb lessons (Report Part 4, Idea 4). Scope: personal repos on the allowlist only (Section 6). No TBS repos.

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `issue_get` | `repo` (required, must be allowlisted), `number` (required), `include_comments` (default true, capped at the last 8, matching the runner brief shape), `since_version` (optional) | Structured issue: title, body, state, labels, assignees, linked PRs, comments, `version`, `content_hash`, `github_updated_at` | Every observed version persisted in D1 (Section 7.5.4); KV holds disposable copies keyed by version; 60 s default freshness, overridable per call with `max_age_s`, `allow_stale`, `consistency` (Section 7.5.3); stale served only when the caller allows it; a GitHub webhook commits a new D1 version immediately, and KV copies follow via the outbox (Section 7.5.5), with reconciliation covering missed webhooks (below) |
| `issue_list` | `query` (structured filters: repo, state, labels, assignee, updated-since), `limit` (default 50) | Matching issues, summary fields only (no bodies), `total_count` | Cached 60 s per normalized query |
| `issue_what_changed` | `repo`, `cursor` (optional; opaque scoped feed cursor, Section 3) | New, closed, updated, and commented issues since `since`, with per-issue field-level change summaries, plus `next_cursor` and the repo's `covered_through` high-water mark; replaces the poll loop plus seen-file | Reads the change feed; no upstream call when the feed covers the window |
| `pr_get` | `repo` (allowlisted), `number`, `since_version` (optional) | Structured PR: title, body, state, base and head refs, head SHA, merge state, review decisions, check-run summary, changed files (paths plus additions and deletions), linked issues, `version`, `content_hash` | Same caching, webhook invalidation, and reconciliation as `issue_get`; snapshots persisted in D1 like issue snapshots |
| `pr_list` | `repo`, `state` (optional), `head` or `base` (optional), `limit` (default 30) | PR summaries, no bodies | Cached 60 s per normalized query |
| `issue_comment` | `repo`, `number`, `body`, `idempotency_key` (required) | Created comment id and URL | Write-through to GitHub; invalidates the issue cache. Structured write, replacing `gh api -f body=@file`, which the report records as writing a 14-byte literal body (Report Part 1, agentdb) |

Resources: `issue://<repo>/<number>`, `pr://<repo>/<number>` (read handler is `pr_get`; `issue_what_changed` reports PR events in the same feed).

**Webhook reconciliation.** Webhooks are an accelerator, not the source of completeness. The server keeps a coverage high-water mark per allowlisted repo (`covered_through`: the latest GitHub `updated_at` for which the feed is known complete). A periodic reconciliation fetch lists issues and PRs updated since `covered_through`, appends any change event the webhooks missed, and only then advances the mark. `issue_what_changed` answers from the feed only when the requested window ends at or before `covered_through`; otherwise it runs a reconciliation fetch first, or returns the result marked `coverage: partial` with `covered_through`. The reconciliation interval is a design parameter set in the build phase and recorded in the deploy config, not a measured number.

#### Brief: the brief as a structured object with run history

Grounded in: 91 single-line pointer prompts each naming a brief file twice; 4 lessons with the same brief executed twice within the hour; 7 duplicate-task pairs; the fleet doctrine that briefs are the judgment point (Report Part 4, Idea 8).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `brief_get` | `id` (required), `version` (optional), `include_runs` (default true, last 5 runs) | Parsed brief: goal, inputs, acceptance criteria, constraints, plus run history (each run: outcome, duration, worker, summary, lesson links) | Immutable by version; current-version pointer cached 60 s |
| `brief_create` | `goal`, `inputs`, `acceptance`, `idempotency_key` (required), `constraints`, `source_ref` (optional: issue or task ref) | Created brief `id`, `version` | Write-through to D1; new brief starts at version 1 |
| `brief_record_run` | `brief_id`, `brief_version` (required: the version the run executed against), `idempotency_key`, `outcome` (done, failed, blocked, machine, preempted, retired), `summary`, `duration_s`, `lesson_ids` (optional), `bench_session` (optional: benchmark session tag, Section 3.3) | Run record id `n` and its `run://<brief-id>/<n>` URI; the brief `version` is unchanged | Write-through to the run table; appends to the change feed so Handoff sees it; never versions the brief body and never invalidates the immutable brief-version cache (only the run-history slice of `brief_get`) |
| `brief_revise` | `brief_id`, `base_version` (required; optimistic concurrency, mismatch returns `version_conflict`), `changes` (goal, inputs, acceptance, constraints), `change_note` (required), `idempotency_key` | New brief `version`, `content_hash` | Write-through to D1 plus R2 body; the only operation that creates a brief version; appends to the change feed |
| `brief_list` | `state` (optional: open, done, retired), `source_ref` (optional), `limit` (default 50), `cursor` (optional) | Briefs with id, current version, goal summary, last run outcome, `next_cursor` | Cached 60 s |

Resources: `brief://<id>`, `run://<brief-id>/<n>`.

Revisions and runs are separate records (R4). A brief version changes only through `brief_revise`. A run is an append-only row in the run table, addressed as `run://<brief-id>/<n>`, pinned to the brief version it executed against, and announced on the change feed; recording a run never creates a brief version. `brief_get(since_version)` therefore diffs only the brief body, and run history is read through `include_runs` or `handoff_get_run_history`.

### 3.2 State side

#### Fleet Status: job and flight state as a service, plus credential preflight

Grounded in: 179 sqlite3 queries, 131 wait/listen calls, 311 sleep commands, 500 gh calls, and the 37-invocation poll loop across 12 Claude sessions; `vaults ctx` 169 times in Codex; 10 runner attempts died on OAuth/auth failures in one week, with OAuth expiry the top recurring failure class (Report Part 4, Idea 2).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `fleet_get_flight` | `id` (required) | Flight state: status, started, updated, worker, task ref, progress, last event | Live read from the state store; cached 10 s by default, overridable with `max_age_s` / `consistency` (Section 7.5.3); `source_observed_at` always present so the agent knows the freshness |
| `fleet_list_flights` | `state` (optional filter), `limit` (default 50) | Flights matching the filter, summary fields | Cached 10 s |
| `fleet_get_job` | `id` (required) | Job state: status, attempts, last outcome, next scheduled run | Live read; cached 10 s |
| `fleet_list_jobs` | `state` (optional filter), `limit` (default 50), `cursor` (optional) | Jobs matching the filter, summary fields, `next_cursor` | Cached 10 s |
| `fleet_what_changed_since` | `cursor` (optional; opaque scoped feed cursor, Section 3) | New, closed, updated, and failed flights and jobs since the cursor, including issue state changes from the change feed, plus `next_cursor` | Reads the change feed; no polling |
| `fleet_wait_for` | `condition` (structured: flight id plus target state, or job id plus target state, or change-feed pattern), or `wait_id` (resume an existing wait); `timeout_s` (bounded: the cap is set below the Codex client's measured tool-call timeout, measured in the Phase 1 spike, criterion 4) | Returns when the condition is met or the bounded call window ends: `met` (bool), `final_state`, `waited_s`, `wait_id`, and `next_cursor`. On `met: false` the caller re-calls with the same `wait_id`; the wait's state lives in the Durable Object, so it survives client disconnects, client timeouts, and deploys, and an event that lands between calls is not lost | Server-side wait via Durable Object; the agent makes one bounded call (or a short chain of resumed calls) instead of sleeping and re-querying. Verified against the Codex client before the build (Phase 1 spike, S5 and S6). This replaces the 311 sleep commands and the 37-invocation poll loop (Report Part 1, Claude) |
| `fleet_preflight` | `account` (required), `needs` (list of required credentials and checkouts, e.g. claude-oauth, codex-oauth, github, wrangler, repo checkout path) | Per-credential status: `live`, `expired`, `missing`, or `unknown`, with `checked_at` and a non-sensitive detail string (never a token, never a secret). Overall `go` / `no_go` | One rule: credential liveness is probed live on every call and never served from cache, so there is no `fresh` parameter. A dead credential fails the preflight instead of killing an attempt mid-run |

Resources: `flight://<id>`, `job://<id>`.

#### Verify: cached verification, deploy and live-state checks, and Render

Grounded in: 32 Antigravity lanes re-reporting verification; 327 Playwright launches; Codex gate/locale/verify loops re-run 18 plus 15 plus 17 plus 15 plus 14 times; 48 runner verification failures after done claims; the Vercel readyState lesson as the most cross-cutting agentdb lesson (Report Part 4, Idea 3). Render grounded in: 327 Playwright launches; 38 screenshot PNGs re-read 2 or more times (90 total re-reads) (Report Part 4, Idea 7).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `verify_check` | `file` (path or content hash) or `bytes`, `checks` (list: json-parse, em-dash-scan, copy-slot-scan, md5, plus named check suites), `force` (default false), `max_age_s`, `allow_stale`, `consistency` (Section 7.5.3) | Pass/fail per check, evidence (counts, first failing line, hashes), the full computation identity, `run_id`, the four timestamps | Server-runnable pure byte checks only (Section 7.5.2): key is the complete computation identity (input bytes hash plus check name and version plus runtime identity). Workspace checks are never run here; their results are read from Studio-pushed records whose identity must match the caller's current tree, lockfile, suite version, and environment. A hit returns `cache_status: hit` with the original evidence; `force: true` creates a distinct new record and never overwrites the old one |
| `verify_get` | `identity` (the full computation identity, or its hash), `checks` (optional filter) | Stored verification result whose identity matches exactly, or `not_found`; never a result keyed by a subset of the identity (for example, file hash alone) | Direct read of the D1 record, KV copy optional |
| `verify_list_checks` | none | Every named check and check suite `verify_check` accepts: name, version, description, input kinds | Static per deploy; cached until the next deploy |
| `verify_deploy_status` | `deployment` (provider plus deployment id or URL) | `readyState`, build status, deploy URL, `checked_at`; catches a failed build before the verify step (the readyState lesson) | Cached 30 s; a failed build result is cached 5 min to stop re-probing |
| `verify_live_check` | `url` (required), `expected_text` (required) | `found` (bool), HTTP status, response excerpt, `checked_at` | Cached 60 s per (url, expected_text) |
| `verify_render` | `url` (required), `idempotency_key` (required), `viewport` (default 390x844 phone width, matching the fleet's phone-screen verification habit), `state` (optional: signed-in, locale, theme), `full_page` (default false) | `render_id`, screenshot (as an MCP image content part or an R2 URL, caller chooses), `render_identity`, normalized `screenshot_hash`, `rendered_at` | Always-observe (Section 7.5.7): every call renders the live page under the full Render identity; if the normalized screenshot hash matches the latest stored render for that identity, the response reuses the stored PNG and `render_id` with `cache_status: hit` and a fresh `last_validated_at`, otherwise it stores a new render. Warm browser pool via Cloudflare Browser Rendering |
| `verify_get_render` | `render_id` (required) | Cached render (screenshot plus metadata), or `not_found` | Direct cache read |
| `verify_visual_diff` | `render_id` (required), `previous_id` (required) | `changed` (bool), diff percentage, diff image (optional), changed regions | Diff computed on demand, cached per (render_id, previous_id) |

Resources: `verification://<identity_hash>`, `render://<id>`, `screenshot://<url-hash>`.

Design note: `verify_check` never trusts its own cache blindly. A cached result carries its complete computation identity (Section 7.5.1); the caller supplies its current identity components, and any mismatch, including a missing component, is a miss. The 48 runner verification failures after done claims (Report Part 1, runner) are the failure mode this design targets: verification runs against the actual current workspace, or the cache says so explicitly.

#### Handoff: session continuity across restarts and worker deaths

Grounded in: 7 Antigravity duplicate-task pairs; one documented 80-minute run spent on cancelled work because the run only read the inbox at start; 76 compactions plus 209 post-compaction re-reads in Codex; 488 runner re-attempts; 77 worker deaths; one task preempted 112 times in 35 minutes; one task retried 6 times for a missing checkout with no backoff and no learning between retries (Report Part 4, Idea 6).

| Tool | Inputs | Outputs | Caching |
|---|---|---|---|
| `handoff_save_checkpoint` | `session`, `idempotency_key` (required), `state` (structured: current step, files touched with hashes, decisions made, pending items, brief version pinned), `note` (optional) | `checkpoint_id`, `checkpoint_n`, `saved_at` | Write-through to D1 plus R2 (state blob); appends to the change feed |
| `handoff_resume` | `session` (required) | Latest checkpoint, plus the composition from Section 2.4: brief diff since the checkpoint, lessons recorded since the checkpoint, issue delta since the checkpoint, and `what_changed` for every file the checkpoint names (hash comparison, so the resumed agent re-reads only changed files) | Composed live from D1 plus the change feed; the checkpoint itself is immutable |
| `handoff_list_sessions` | `state` (optional filter: active, dead, completed), `limit` (default 50) | Sessions with last checkpoint time, last worker, status | Cached 30 s |
| `handoff_get_run_history` | `task` (required: task or brief ref) | Every run of the task: worker, outcome, duration, summary, checkpoint ids, lesson links; includes the prior attempt's outcome so a retry reads state instead of re-fetching the issue and re-reading the repo | Read from D1; cached 60 s |

Resources: `session://<id>`, `checkpoint://<session>/<n>`.

Design note: checkpoints are written by the agent at natural boundaries (after each completed step, before any long wait, before any risky operation) and by the runner on worker death when a last state is recoverable. The server never fabricates a checkpoint. A session with no checkpoint resumes to its brief plus run history, which is still strictly better than today's fresh-issue-fetch plus full prompt rebuild.

### 3.3 Control-plane operations (R4)

Every operation the system needs beyond agent reads has exactly one surface. Surfaces: **public tool** (MCP tool in Appendix A, token-scoped), **resource read** (MCP resource handler), **admin endpoint** (HTTPS route under `/admin/*` on the same Worker, `admin` scope only, never listed as an MCP tool), **connector operation** (server-internal: webhook receiver, cron trigger, queue consumer, or an upstream connector the Worker runs itself), **CLI** (`fleetctl`, a thin client in this repo that calls admin endpoints with Aria's admin token from her own secret store). Every write on every surface takes an `idempotency_key` and appends to the change feed.

| Operation | Surface | Name | Notes |
|---|---|---|---|
| Publish or update an exemplar or canonical doc | Public tool, plus CLI for bulk | `ref_publish`; `fleetctl ref publish <path>...` (loops over `POST /admin/ref/publish`) | The write path. Optimistic concurrency on `base_version`; source must be an allowlisted personal repo plus commit SHA |
| Seed the corpus | CLI | `fleetctl ref seed --manifest corpus-seed.json` | Publishes every entry of a committed manifest (name or path, source repo, commit SHA, SHA-256); idempotent per entry; the manifest and resulting version hashes are frozen in `bench-prereg-v1` so the benchmark starts from a known corpus (closes Claude G7 preregistration ask) |
| Retire an exemplar or doc | Admin endpoint | `POST /admin/ref/retire` | Tombstone version (Section 4.3); never deletes history |
| Revise a brief | Public tool | `brief_revise` | Only operation that creates a brief version |
| Record a run | Public tool | `brief_record_run` | Run row plus `run://` plus change feed; never versions the brief body (Section 3.1, Brief) |
| List briefs | Public tool | `brief_list` | |
| Flag a lesson | Public tool | `recall_quarantine(action: flag)` | `recall:flag` scope (Section 6.2) |
| Quarantine or release a lesson | Public tool | `recall_quarantine(action: quarantine or release)` | `recall:moderate` plus `admin` (Section 6.2) |
| Correct a lesson | Public tool | `recall_learn` with `supersedes: <lesson_id>` | Keeps the stable id, new `content_hash` and version (Section 4.3); prior text stays readable by version only when moderation policy permits (Section 6.5) |
| Revoke a lesson | Admin endpoint | `POST /admin/lessons/<id>/revoke` | Tombstone version with reason; excluded from all reads; agentdb sync marks it revoked upstream |
| Ingest fleet events (flight and job transitions) | Connector operation | `POST /ingest/fleet` (runner-signed, `connector:fleet` scope) | The runner pushes state transitions; idempotent on (source, event id); feeds `fleet_*` reads and the change feed |
| Create or update session status | Public tool | `handoff_set_status(session, status: active, completed, abandoned, note)` | Agents mark their own session; `dead` is reserved for the worker-death operation |
| Record worker death | Connector operation | `POST /ingest/fleet` event `worker_dead` (session, worker, last heartbeat, cause) | Runner-only; sets session `dead`, links the last checkpoint if one exists, never fabricates one (Section 3.2, Handoff) |
| Tag a benchmark session | Public tool | `bench_tag_session(session, bench_run_id, arm, task_id, phase)` | Write-once per session (a second different tag returns `idempotency_conflict`); tags flow into every log line and `brief_record_run.bench_session`, so the archive (Section 11.4) joins server logs to runs |
| Issue, rotate, revoke tokens | CLI over admin endpoint | `fleetctl token issue/rotate/revoke`; `POST /admin/tokens/*` | Plaintext shown once at issue; D1 stores the verifier (Section 6.3) |
| Manage resource allowlists | CLI over admin endpoint | `fleetctl allowlist add/remove/list`; `POST /admin/allowlist/*` | Each change recorded with actor and reason; TBS repos refused (Section 6.4) |
| Sync reconciliation (GitHub coverage, agentdb sync) | Connector operation, plus admin trigger | Cron trigger; `POST /admin/sync/run?target=github or agentdb` | Advances `covered_through` (Section 3.1) and the agentdb sync cursor (Section 4.4); manual trigger for recovery only |
| GitHub webhook intake | Connector operation | `POST /webhooks/github` | Signature-verified; non-allowlisted repos dropped |
| Upload or reference a file artifact | Public tool argument, plus admin endpoint | `verify_check.file` accepts a content hash or an `r2://` reference; `POST /admin/artifacts` (or a presigned R2 upload URL from it) for bytes over the MCP payload limit | Stored content-addressed in R2; returns the hash used everywhere else |
| Cancel durable render work | Public tool | `verify_render_cancel(render_id, idempotency_key)` | Cancels a queued or running render in its Durable Object; returns `cancelled`, `already_complete`, or `not_found`; a cancelled render is never cached as a result |
| Read PR state | Public tool, plus resource read | `pr_get`, `pr_list`; `pr://<repo>/<number>` | Section 3.1, Issue Context |
| Store health | Public tool | `recall_store_health` | Section 3.1 |

Section 6.2 assigns per-operation capabilities, including `context:publish` and `connector:fleet`; coarse write/ingest grants are not accepted. Admin endpoints and `fleetctl` are not part of the agent-facing API and are excluded from the benchmark's with-arm tool schema (Section 8.6).

## 4. Data model

### 4.1 Entities

Every key below is prefixed by `(tenant_id, namespace_id)` and every row carries `owner_principal_id`; Section 6.1 governs ownership and authorization for all stores, caches, feeds and blobs.

| Entity | Key | Stored in | Notes |
|---|---|---|---|
| Exemplar version | (name, version) | D1 (registry) + R2 (body) | Immutable. Body addressed by content hash. |
| Doc version | (path, version) | D1 (registry) + R2 (body) | Same shape as exemplars. |
| Lesson | id (stable, assigned once at creation, never recomputed) plus `content_hash` (SHA-256 of the canonical lesson text, changes on edit) | D1 (index) + agentdb store (source of truth, see 4.4) | Kind, what, why, hit count, source DB, created and last-recalled timestamps. |
| Issue snapshot | (repo, number, version) | D1 (every version body, plus the current-version pointer) + KV (disposable copy keyed by version) | Version allocated in the same D1 transaction as the change-feed append (Section 7.5.5); body is the structured issue JSON with `source_observed_at`. |
| Brief version | (id, version) | D1 | Parsed fields plus run history links. |
| Run record | (brief_id, n) | D1 | Outcome, duration, worker, summary, lesson links. |
| Checkpoint | (session, n) | D1 (index) + R2 (state blob) | Immutable. State blob is structured JSON, not a transcript dump. |
| Session | id | D1 + Durable Object | Status, last checkpoint, last worker, task ref. |
| Flight | id | D1 | Status, worker, task ref, progress, last event. |
| Job | id | D1 | Status, attempts, last outcome, next run. |
| Verification result | complete computation identity hash (Section 7.5.1) | D1 (record and evidence) + KV (disposable copy) | Check kind (`pure`, `workspace`, `live`), identity components, pass/fail per check, evidence, run id, producer, computed and validated timestamps. |
| Render | id, plus Render identity hash (Section 7.5.7) | D1 (metadata) + R2 (PNG keyed by screenshot hash) | URL, final URL, viewport, state profile, renderer and browser version, readiness rule, normalization version, screenshot hash, rendered and last-validated timestamps. |
| Change event | sequence number (monotonic) | D1 | Resource, version, timestamp, change kind, actor. The single ordered log every `what_changed` tool reads. |
| Outbox entry | sequence number | D1 | Written in the same transaction as the change event; drives cache changes and waiter wakeups after commit (Section 7.5.5). |
| Idempotency record | (token id, tool, idempotency_key) | D1 | Request hash, result reference, status, created timestamp (Section 7.5.6). |
| Audit entry | id | D1 | Caller token id, tool, result class, latency, timestamp, plus inputs passed through a field-allowlist sanitizer: only fields named in a per-tool allowlist are stored (identifiers, enums, sizes, hashes); free text, bodies, and any unlisted field are dropped; length/digest only for explicitly allowed non-secret content (Section 6.5). Retention per Section 4.6. |
| Credential status | (account, credential) | Not stored; each preflight result is recorded only as an audit entry | Liveness only. No agent credential material is stored; upstream credentials use Workers secrets (Section 6.3). |

### 4.2 Storage choices and why

- **D1** holds everything that needs querying, ordering, or joining: the version registry, the change feed, briefs, runs, checkpoints index, verification records, issue cache index, lessons index, audit log. One database, one schema, migrations in the repo.
- **KV** holds disposable copies only: immutable bodies keyed by content hash or (resource, version), and disposable copies of D1 or R2 records. Every KV entry has a D1, R2, or upstream source of truth; losing KV loses speed, not data. Mutable pointers (current version, coverage marks, leases) live in D1 or a Durable Object, never in KV, because KV is eventually consistent (Section 7.5.4).
- **R2** holds blobs that are large or rarely read: exemplar and doc bodies, checkpoint state blobs, render PNGs, and the benchmark raw-data archive (Section 8.8). R2 objects are named by tenant, namespace and content hash, so deduplication never crosses ownership boundaries (Section 6.1).
- **Durable Objects** hold only coordination state: `fleet_wait_for` subscriptions and per-session checkpoint serialization. They hold no long-lived data; everything durable lands in D1 or R2.

### 4.3 Versioning scheme

- Every versioned resource has a monotonic integer version (1, 2, 3, ...) plus a SHA-256 content hash of its canonical bytes. The version orders changes; the hash proves identity.
- Versions are append-only. An update creates a new version; no version is ever edited or deleted. A deletion is a new version with `status: deleted` (tombstone), so `what_changed` can report it.
- Every tool response carries `version`, `content_hash`, and the Section 7.5.3 timestamps. A caller that holds version N asks for the delta since N; the server answers with the diff or with `unchanged: true`.
- The change feed assigns a single monotonic sequence number across all resources, so `fleet_what_changed_since(cursor)` and `issue_what_changed(repo, cursor)` are answered from one log with a consistent ordering. The sequence number is the canonical cursor (Section 3).
- Lesson identity: a lesson's `id` is stable for its lifetime; its `content_hash` identifies the text version. An edit keeps the id and changes the hash, so recall telemetry (`hit_count`) and links survive edits, while caches and the benchmark can still tell two versions apart.

### 4.4 Recall and the agentdb store

The live agentdb store is a set of SQLite files on the Studio (77 `agent.db` files under `~/VaultsInternal`, deduplicated by real path; Report Part 1, agentdb). The server does not move the store and does not replace it. The design:

- The server keeps a D1 index of lessons (id, kind, text hash, source DB, hit count, timestamps), synced from the Studio by a small sync job that runs on the Studio and pushes changes to the server. The sync is incremental (new and changed rows only, keyed by row id plus content hash) and runs on a schedule plus on demand after a `recall_learn` write.
- `recall_learn` writes to D1 first (so the lesson is visible to every client immediately), then the sync job writes it back to the owning agentdb DB on the Studio. If the write-back fails, the lesson stays in D1 and the failure is recorded in the health snapshot; the server never silently drops a lesson. The response carries `writeback_status` (`pending`, `done`, `failed`), so a caller can see when a lesson exists only server-side (see the degraded mode in Section 9.1).
- `recall_store_health` reads the D1 index plus the sync job's own report (schema versions per DB, errors-table last-write timestamps, never-recalled counts). This is what makes the store's health visible: today 15 of 77 DBs have stale schema and the errors tables have had no writes since early September, and no health check monitors any of it (Report Part 1, agentdb).
- Scope: the sync covers personal-project DBs only. TBS DBs are excluded from the sync allowlist (Section 0). The report's agentdb counts include TBS DBs as measurement context; the server's recall corpus does not include them.

### 4.5 Cache invalidation rules

| Cache | Invalidation trigger |
|---|---|
| Exemplar/doc current-version pointer | New version published (immediate, write-through) |
| Exemplar/doc version body | Never (immutable by version) |
| Recall query results | New lesson recorded that matches the query terms, or 5 min TTL, whichever comes first |
| Issue body | GitHub webhook event for that issue or PR (new D1 version, outbox-driven copy update), reconciliation fetch (Section 3.1), or the caller's `max_age_s` (default 60 s) |
| Issue list | 60 s TTL (lists are cheap to recompute and change often) |
| Flight/job state | State change event (immediate, write-through) or 10 s TTL |
| Verification result | Keyed by the complete computation identity (Section 7.5.1): any changed identity component is a different key. Freshness still applies: callers bound reuse with `max_age_s`; live probes are never reused beyond their freshness window. `force: true` creates a distinct record. |
| Render | Not reused without observation: always-observe (Section 7.5.7); the stored PNG is deduplicated by normalized screenshot hash under the full Render identity. |
| Deploy status | 30 s TTL; failed-build results cached 5 min |
| Live check | 60 s TTL per (url, expected_text) |
| Credential liveness | Never cached: probed live on every preflight call (one rule, Section 3.2) |

The governing rule: a cache entry is valid only while its complete identity matches the caller's current inputs AND it satisfies the caller's freshness requirement (Section 7.5). No entry is safe merely because its key contains a content hash: a key is only as safe as the identity it covers, so identities are complete by contract and freshness is enforced, never assumed.

### 4.6 Retention per record class

Retention is set per class. Durations below are design decisions, not measured numbers, reviewable at any amendment and fixed before Phase 4 starts.

| Record class | Policy |
|---|---|
| Benchmark-linked records (any record referenced by a benchmark run, replay, preregistration, scored dataset, or verification receipt: transcripts, run logs, checkpoints, renders, verification results, audit entries, versions, change events) | Never pruned. A benchmark link pins the record and everything it references. Mirrored per Section 8.8. |
| Version history (exemplar, doc, brief, lesson versions; tombstones) | Never pruned: versions are append-only and diffs, pins, and handoff composition depend on them. Bodies are content-addressed and deduplicated in R2. |
| Change feed | Never pruned while any retained record references its range; cursors older than the retained window return `cursor_expired` (Section 3). |
| Audit entries (sanitized, Section 4.1) | Raw entries kept 180 days (design decision), then pruned; the daily summary records computed from them are versioned and kept indefinitely. |
| Checkpoints | Kept while the session is active and for 30 days (design decision) after the session completes or dies, then pruned; the latest checkpoint of a completed session is kept with its run history. |
| Renders (PNG blobs) | Unreferenced PNGs pruned 30 days (design decision) after last read; render metadata (URL, viewport, state, content hash) kept so a re-render is detectable. |
| Idempotency keys | Kept at least as long as the longest retry window of any caller; set in the build phase. |
| Cache entries (KV) | Not records; governed by TTLs and invalidation (Section 4.5). |

## 5. Cloudflare deployment

### 5.1 Workers and transport

- **One Worker** (`fleet-mcp`) serves the whole server. Modules per area share the core in Section 2.2. The Worker is the unit of deploy, the unit of rollback, and the unit of the post-deploy sweep.
- **Transport: Streamable HTTP**, the current MCP transport. `POST /mcp` accepts JSON-RPC requests and returns JSON-RPC responses, with an optional SSE stream for server-initiated messages (used by `fleet_wait_for` progress and by resource change notifications). `GET /mcp` opens the SSE stream for clients that subscribe. No WebSocket, no legacy SSE endpoint.
- **Routes:**
  - `POST /mcp` and `GET /mcp`: the MCP endpoint.
  - `GET /health`: public liveness only; authenticated `ops:read` adds namespace-scoped dependency status (D1, KV, R2, GitHub API reachability, Browser Rendering reachability), per Section 6.2.
  - `GET /version`: deployed commit hash, build time, and the MCP protocol version the server speaks.
  - `POST /webhooks/github`: GitHub webhook receiver (issue and PR events) for cache invalidation. Verified with the webhook secret; events outside the repo allowlist are dropped.
  - `POST /internal/sync`: the agentdb sync endpoint, authenticated with a separate identity-bound sync token plus registered sign-in/service identity (Section 6.3), accepting only the authorized Studio sync job.
- **Domain (proposed):** `mcp.ariaxhan.com` for production, `staging.mcp.ariaxhan.com` for the staging Worker. Final domain choice is Aria's call (Section 9).
- **Browser Rendering:** `verify_render` uses the Cloudflare Browser Rendering API (Puppeteer-compatible) for a warm browser pool. Renders run in the same Worker request when fast, or as a queued render with a pollable `render_id` when slow; the tool response always says which path was taken.

### 5.2 Deploy pipeline

- Repo (proposed): `ariaxhan/fleet-mcp`. `wrangler.toml` defines the Worker, the D1 database, the KV namespaces, the R2 buckets, the Durable Object classes, and the Browser Rendering binding. Secrets are set with `wrangler secret put`, never committed.
- Pipeline: pull request opens a preview deployment (staging Worker plus a staging D1); merge to `main` deploys to production via `wrangler deploy`. Every deploy is a single deliberate deploy per environment, verified after, following the fleet's deploy discipline.
- Post-deploy gate: a live sweep, modeled on the Teaching MCP sweep pattern (282 checks, all pass, Nov 20, 2026; Report Part 2), runs twice per release: against staging before promotion, and against production after deploy. The sweep never writes to real repos or real records: it uses a dedicated fixture repo on the allowlist (personal, empty of real work) and a fixture namespace (fixture sessions, briefs, lessons, flights, and renders tagged `fixture`, excluded from recall results, audit summaries, and benchmark data). Read-only tools run against real data; write tools run only against the fixture repo and namespace, each with a fresh `idempotency_key`, plus one replay of a key to prove idempotency. The sweep checks `/health` and `/version` and verifies the deployed commit hash matches `main`. The sweep receipt (checks run, pass/fail, latencies) is stored in R2 and linked from the deploy record. A failed sweep blocks the deploy from being called done; rollback is `wrangler rollback`.
- D1 migrations run as part of deploy (`wrangler d1 migrations apply`), forward-only, with the migration files in the repo. No manual schema edits.
- Observability: Workers Logs plus structured per-call logging to D1 (the audit log, Section 4.1). A daily summary (calls per tool, cache hit rates, error rates, p50/p95 latency) is computed from the audit log and stored as a versioned record, so the server's own usage is measurable without a separate analytics service. The summary also records per-tool Cloudflare cost attribution (Browser Rendering minutes and Worker CPU time per tool), which Section 5.3 uses.

### 5.3 Render split trigger

Render splits into its own Worker (same tool names, same `render://` namespace, Section 2.3) when the trigger fires on metrics the daily audit summary (Section 5.2) already computes:

1. **Render share of Cloudflare spend:** `verify_render` attributed cost divided by total server Cloudflare cost, per day.
2. **Render share of total call latency:** summed `verify_render` latency divided by summed latency of all tool calls, per day.
3. **Impact on non-render tool p95:** p95 latency of all non-render tools on days with render load versus days without, or in hours with concurrent renders versus without.

The numeric thresholds for each metric and the persistence rule (how many consecutive days over threshold) are NOT set in this PRD. They are set from Phase 3 measurements and recorded as a dated amendment to this section before Phase 4; inventing them now would violate the evidence standard.

## 6. Auth model (R3, normative)

### 6.1 Principals, tenants, and namespaces

Aria, each agent, each client, and each connector have distinct principal IDs and tokens. Start with one personal tenant and explicit namespaces; client tenants are separate ownership domains. Shared D1 is a design decision, not a claim of proven isolation. No client token receives fleet, handoff, or credential visibility by default. Aria grants access explicitly within the personal-project boundary, which even an admin cannot override.

Every entity in Section 4.1, historical version, artifact, upload, cache entry, feed event, subscription, durable job, credential profile, browser profile, and benchmark fixture has immutable `tenant_id`, `namespace_id`, and `owner_principal_id`. Tenant and namespace prefix all logical keys, unique constraints, joins, KV keys, R2 object keys and Durable Object identities. Authorization partitions feed queries and cursor output even if the internal event sequence is global; expose opaque cursors, not foreign sequence gaps. Content hashes deduplicate only within a namespace and never confer access. D1 ownership rows govern every blob download. No public R2 bucket or reusable signed download bypasses current authorization.

Every request resolves the principal from authentication, then intersects token grants, principal membership, namespace policy, operation capability, and resource allowlists. Caller-supplied ownership is never trusted. Default deny applies to missing ownership, unknown operations, unlisted resources, and cross-namespace references. Admin is a separate capability, never an implicit cross-tenant bypass. Cross-namespace sharing requires an explicit grant on the source object and destination principal, with provenance retained. Composite responses, historical reads, cache hits, diffs, counts and feed queries check every constituent before pagination or aggregation. Unauthorized IDs return indistinguishable `not_found`; no foreign counts, cursors, names or cache-hit hints escape. Cursors bind tenant, namespace, principal, effective filter and policy revision; changed grants invalidate them.

### 6.2 Per-operation capability matrix

Each row requires its named capability plus Section 6.4 resource filters. No coarse `read`, `write`, `publish`, `preflight`, or `ingest` grant remains valid. Tool/resource discovery is filtered, but execution always rechecks. `admin` is required on every `/admin/*` route in addition to the row's capability. CLI uses the same routes and checks. Unknown future operations are denied until added to this matrix.

| Operations (including resource equivalents) | Required capability | Additional restriction |
|---|---|---|
| Exemplar/doc get, list, diff; `exemplar://`, `doc://` | `context:read` | Explicit document/exemplar IDs, versions and source repos |
| `ref_publish`, corpus seed, reference retire | `context:publish` | Source commit, manifest and destination namespace; retire via admin only |
| `recall_query`, `recall_list_lessons`, lesson resource | `recall:read` | Allowed lesson IDs or explicitly granted collection; quarantine rules below |
| `recall_store_health` | `recall:health` | Owned enumerated source DBs, no global store totals |
| `recall_learn`, correction | `recall:write` | Owned lesson collection; correction requires access to original |
| `recall_quarantine(action: flag)` | `recall:flag` | Allowed lesson, no release permission |
| Quarantine, release, lesson revoke | `recall:moderate` plus `admin` | Audited reason; revoke via admin route |
| Issue/PR get, list, delta; `issue://`, `pr://` | `issue:read` | Stable repository identity and issue/PR filter |
| `issue_comment` | `issue:comment` | Explicit external-comment permission on destination repo |
| Brief get, list, diff; `brief://`, brief-linked `run://` | `brief:read` | Allowed briefs and linked content |
| `brief_create`, `brief_revise` | `brief:write` | Destination owner and base version checked |
| `brief_record_run` | `brief:record` | Owned attempt and brief, no body revision permission |
| Fleet get/list/status/delta/wait and flight/job resources | `fleet:read` | Explicit jobs/flights and namespace; waits and feeds inherit same filter |
| `fleet_preflight` | `preflight:probe` | Principal-owned account, machine and credential-profile tuple |
| `verify_check`, `verify_get`, `verify_list_checks`, verification resources | `verify:check` | Allowed upload/file IDs and named checkers; local suite additionally `verify:suite` and owned machine |
| `verify_deploy_status`, `verify_live_check` | `verify:deploy`, `verify:live` respectively | Explicit deploy IDs or URL origins/paths, including redirects |
| `verify_render`, `verify_get_render`, `verify_visual_diff`, render/screenshot resources | `verify:render` | Explicit URLs, upload IDs and browser profile; no arbitrary browsing |
| `verify_render_cancel` | `verify:cancel` | Own job or explicit delegated job grant |
| Handoff resume/list/history; `session://`, `checkpoint://`, `run://` | `handoff:read` | Explicit session/checkpoint/attempt filters, every composed area separately authorized |
| `handoff_save_checkpoint`, `handoff_set_status` | `handoff:write` | Own session and fenced attempt; worker death reserved for connector |
| `bench_tag_session`, fixture/archive operations | `benchmark:write` (reads: `benchmark:read`) | Owned run, fixture namespace and personal-only manifest; cannot authorize a benchmark before its gates |
| Artifact upload, lookup, download | `artifact:write`, `artifact:read` respectively | Explicit upload grant and owning namespace; consuming operation capability also required |
| `/ingest/fleet`, worker-death events | `connector:fleet` | Registered runner identity, assigned machines and namespaces only |
| `/internal/sync`, agentdb reconciliation | `connector:sync` | Registered sync identity and enumerated DBs; no token-management authority |
| GitHub reconciliation/webhook intake | `connector:github` | Registered integration and stable repo allowlist; webhook signature required |
| Token issue/rotate/revoke; policy/allowlist changes | `auth:manage` plus `admin` | Cannot delegate beyond actor's grant ceiling; reason and audit mandatory |
| Authenticated health, audit reads | `ops:read`, `audit:read` respectively | Tenant/namespace filters; audit metadata only |
| Manual sync trigger | `connector:sync` or `connector:github`, plus `admin` | Target-specific; cannot broaden connector source grants |

Public liveness returns only service availability. Connector queues and cron tasks run as registered service principals, not ambient Worker authority. Internal calls carry the originating principal and grant snapshot IDs but reauthorize against current policy. Webhook authentication verifies raw payload signatures and delivery IDs, then maps the integration to its tenant and allowed stable repo ID before processing. No caller-selected tenant routing.

### 6.3 Token lifecycle and upstream credentials

Caller tokens are opaque bearer credentials: generate a cryptographically random 256-bit secret and random public token ID (design decisions), return `id.secret` once over authenticated TLS, never in a URL. D1 stores the ID, HMAC-SHA-256 verifier, key version, principal, tenant, namespaces, capabilities, filters, issuer, timestamps, expiry, predecessor and revocation metadata. A Worker secret holds only the HMAC key for caller-token verification, never a caller-token list. Lookup by public ID, recompute the HMAC over the complete token, compare in constant time, then read current policy from authoritative D1. Unknown IDs and failed comparisons have the same generic authentication response. Rate-limit failures. No positive authorization cache or KV policy decision; inability to read authoritative policy fails closed.

Tokens are per agent/client, injected from that principal's secret store, never prompts, briefs, logs or source. Issuance requires `auth:manage` plus `admin`; the issuer cannot grant beyond its delegation ceiling or Section 0. Default expiry is 90 days; rotation overlap is at most 24 hours and cannot extend the old expiry (design decisions). Rotation issues a distinct token, records its predecessor and overlap deadline, and revokes the predecessor at that deadline. Expiry is checked using server time on every protected action. HMAC key rotation keeps versioned old keys only through valid-token overlap, then removes them; emergency key compromise revokes all affected tokens before replacement.

Revocation, expiry, membership removal and filter narrowing increment an authoritative policy revision. Revocation is effective at the committed D1 change: new requests, reconnects, cache hits, result reads and blob fetches fail. Active streams/subscriptions register token IDs and receive cancellation; they also recheck before each event, response chunk and bounded wait renewal, so missed cancellation cannot leak another payload. Outstanding jobs recheck before dequeue, each protected stage, upstream side effect and result publication. Queued jobs cancel, running jobs stop at the next boundary, browser contexts close, and unpublished artifacts remain inaccessible. There is no resumable authority in a `wait_id`, session ID or artifact hash. Already delivered bytes or an upstream side effect accepted before revocation cannot be recalled; record the race and outcome, never claim rollback. In-flight side effects serialize their authorization boundary with policy mutation; no new dispatch is permitted after revocation commits. Persist cancellation state so deploy/reconnect cannot resurrect authority.

Upstream service credentials live in Workers secrets alongside the separate caller-verification HMAC key, separate per environment and minimum-permission integration. D1 holds only profile references and ownership, never OAuth material. GitHub comment permission is separate from read permission. Upstream credential rotation/revocation cancels affected work and denies further dispatch until a valid replacement is bound. Never return headers, partial tokens, upstream error bodies or credential-bearing URLs. Screenshots/page content remain restricted artifacts, never audit fields.

Preflight `account` resolves only through a principal-owned `(account_id, machine_id, credential_profile_id)` registry, with an explicit delegation for any shared probe. Local probes use the registered connector, never arbitrary paths or credentials supplied by the caller. Responses expose only liveness, observation time and fixed reason codes; offline or unsupported probes return `unknown`. A successful preflight does not authorize later actions or survive credential expiry.

The separate sync token is bound to a registered signed-in identity or service-token identity, its audience, machine and credential profile. `/internal/sync` requires both that independently verified identity and its bound Fleet token with `connector:sync`; a bare bearer is insufficient. Recheck identity status on each sync request. Signed connector requests bind method, path, body hash, timestamp and single-use nonce to the registered machine key; reject replays. Sync enumerates authorized personal-project DBs, never scans an excluded tree then filters.

### 6.4 Full resource allowlists and ingestion boundary

D1 policy maps tenant, namespace and principal to allowed stable repo IDs, document/exemplar IDs and source paths, lesson collections and enumerated source DBs, upload/artifact IDs and purposes, checkpoint/session IDs, URL origins and paths, immutable deployment IDs and projects, resource schemes/IDs/versions, browser profile IDs, and benchmark run/fixture manifests. Missing entries deny. Explicit collection grants are scoped collections, never global wildcards. Policy changes use audited admin endpoints; removal applies to retained history and caches too. Repo membership alone does not authorize mixed-source content: every ingestion has permitted-source provenance and rejects or quarantines unresolved sources before serving.

URL checks cover normalization, every redirect and subresource, private/local/metadata addresses, and allowed schemes; browser egress cannot escape the allowlist. Profiles are owned, isolated per tenant/namespace/principal, never shared cookies across clients. Upload completion validates namespace, declared purpose, size and digest before registration. No direct R2 upload grants read permission. Resource reads use the same matrix as tools, including historical versions and composed links.

The personal-project boundary is non-overridable by tokens or admin policy: excluded sources cannot be added, ingested, rendered, synced or served. Webhooks outside the allowlist are dropped. Boundary acceptance uses synthetic excluded identifiers only and never contacts excluded systems.

### 6.5 Audit ownership, sanitizer and served text

The service owns append-only audit integrity; each row carries tenant, namespace, actor principal, token ID, operation, target ID, policy revision, request/job correlation ID, fixed result/reason enum, timestamp, latency, size and content digest where explicitly allowed. Tenant-scoped `audit:read` exposes only authorized rows; clients cannot edit or delete them. Token/policy mutations record issuer, affected token ID, changed capability/filter IDs and fixed reason code, never secret values. Audit-write failure denies protected operations before dispatch; completed effects with failed completion logging enter a durable reconciliation outbox and raise an operator alert.

The sanitizer is a versioned per-operation field allowlist, not a blacklist or free-text scrubber. Only typed IDs, approved enums, timestamps, counts/sizes and approved artifact digests may pass. Unknown fields, nested objects without an explicit schema, bodies, lessons, prompts, queries, notes, headers, cookies, URL queries/fragments and raw upstream errors are dropped. Do not hash secret or arbitrary dropped fields: even hashes can disclose low-entropy values. Only explicitly designated non-secret content may contribute a length/digest. Sanitization precedes logs, traces, metrics and audit persistence; errors use fixed codes. Sanitized entries retain 180 days, daily sanitized aggregate summaries indefinitely (design decisions, Section 4.6). Benchmark-linked sanitized records are pinned indefinitely under Section 4.6; this exception never permits raw secrets or bodies in audit.

Served lesson text is structured `data`, never authoritative instructions, with source DB/repo and commit where available, author principal, timestamps, version, digest, trust label and moderation status. Design caps: 8 KiB UTF-8 per lesson, 32 KiB total lesson text per response; pagination/truncation is explicit and never drops provenance. Oversize writes fail with `payload_too_large`. Agent text is never auto-promoted to canonical instructions. Flagging immediately quarantines the lesson pending moderation. Query, direct ID/version reads, resources, cache hits, feeds, handoff composition and sync write-back all enforce quarantine/revocation before serving text. Quarantine evicts cached compositions and bumps corpus/policy revisions. Only `recall:moderate` plus `admin` can inspect quarantined text via a dedicated audited moderation view or release it with a reason and provenance review; revoked text is never served. These controls reduce exposure, not a claim that data labels prevent prompt injection.

## 7. Caching, versioning, and delta strategy

### 7.1 Content-addressed caching

- The cache key for a computed result is the hash of its complete computation identity (Section 7.5.1): for pure byte checks, the input bytes hash plus check name and version plus runtime identity; for workspace checks, the repo tree hash (or dependency-file hashes plus lockfile hash) plus suite version plus environment identity; for renders, the Render identity (Section 7.5.7); for versioned bodies, the content hash itself. Two agents asking the same question with the same complete identity get the same stored result, with `cache_status: hit` and the original evidence attached.
- The second agent does not re-run work the first agent already did for the same complete identity, within the caller's freshness bound. The benchmark counts cache hits per tool and reports the hit rate alongside the token and time savings (Section 8).
- Cache entries carry their key, their full identity components, and the timestamps of Section 7.5.3. A new check version is a new key, so a changed checker never serves a result computed by the old one.

### 7.2 `what_changed` and diff semantics

- Every `what_changed` tool takes a `since` (timestamp, version, or change-feed sequence number) and returns three lists: `added`, `changed`, `removed`, each with per-item field-level change summaries. For text resources, `changed` items include a unified diff; for structured resources, a field-level diff (old value, new value, per field).
- If nothing changed, the response is `unchanged: true` with the current version and timestamp, and no body. The agent pays for a tiny response instead of a full re-fetch. This is the direct replacement for the re-read class: 858 extra re-reads (42.8% of all reads) in the Codex sample, and the 209 files re-read across compaction boundaries (Report Part 1, Codex).
- The change feed is the single source for all `what_changed` answers. A tool never re-derives changes by comparing two full fetches; it reads the log. The log is append-only and sequence-numbered, so a `since` value is unambiguous.

### 7.3 How a second agent gets a cached result instead of re-running work

1. Agent A calls `verify_check` on a file with a pure byte check. Miss: the server runs the check, stores the result under the complete identity in D1, returns it with `cache_status: miss`.
2. Agent B calls `verify_check` on the same bytes with the same check version and runtime, within its `max_age_s`. Hit: the server returns the stored result with `cache_status: hit`, the original evidence, and the original `run_id`. No check runs.
3. The file, a dependency, the lockfile, the check version, or the environment changes. The identity differs: miss, fresh run (or, for workspace checks, `not_found` until the Studio pushes a matching result), new stored record. No stale green.
4. Renders always observe and only deduplicate the stored screenshot (Section 7.5.7); issue bodies obey the caller's freshness requirement over D1 snapshots; exemplars are pinned by version; recall queries use a 5 min TTL plus write invalidation.

### 7.4 Freshness contract

Every response states its freshness in the `meta` block: `cache_status` (`hit`, `miss`, `stale`, `bypass`), `content_hash`, `version`, and the four distinct timestamps (`served_at`, `source_observed_at`, `last_validated_at`, `computed_at`). `stale` is returned only when the caller allowed it (`allow_stale: true`); a freshness requirement the server cannot meet returns an explicit error, never a silent downgrade. The full contract is Section 7.5.3; stale-while-revalidate is never used for verification results or renders.

### 7.5 Cache identity and safety contract (R2)

This contract replaces every unconditional cache-safety claim in earlier drafts. No cached answer is safe by construction; it is safe only when its identity is complete and its freshness meets the caller's stated requirement. Any tool, store, or suite that cannot satisfy a clause below reports a miss or an explicit error.

#### 7.5.1 Complete computation identities

A stored computed result is keyed by the SHA-256 of a canonical identity record. Every component is stored with the result and returned in the response. A missing component is a miss, never a wildcard.

| Result class | Identity components (all required) |
|---|---|
| Pure byte check | input bytes hash; check name; check implementation version; check config hash; runtime identity (Worker deploy id and check library versions) |
| Workspace check | check-suite name and version; repo tree hash (git tree of the working copy including uncommitted changes) or, where a suite declares its inputs, the hashes of every declared dependency file; lockfile hash; runtime identity (language runtime and tool versions); environment identity (OS, architecture, relevant env-var names and value hashes, Node or Python version, locale) |
| Live probe (deploy status, live check) | probe name and version; target (provider plus deployment id, or URL plus expected text); environment identity of the prober |
| Render | the Render identity (Section 7.5.7) |
| Versioned body | content hash |

One file hash plus a check list is never a valid key. A forced rerun (`force: true`) produces a distinct record with its own `run_id`; it never overwrites or hides the earlier one.

#### 7.5.2 Pure byte checks versus workspace checks and live probes

- **Pure byte checks** (json-parse, em-dash-scan, copy-slot-scan, md5, and any check whose output is a pure function of supplied bytes plus its version and config) run on the server. A check qualifies only if it reads no file, network, clock, or environment beyond the supplied bytes; `verify_list_checks` labels each check `pure`, `workspace`, or `live`.
- **Workspace checks** (tests, builds, type checks, lint, locale and gate suites that read a repo) never run on the server. The Studio runs them and pushes results through the sync path keyed by tree hash (or dependency-file hashes plus lockfile hash), suite version, and environment identity. The server stores and serves them; it never extends a pushed result to a different tree or environment.
- **Live probes** observe external state. Their results are time-bound observations, reusable only within the caller's freshness bound (Section 7.5.3), never keyed as if immutable.

#### 7.5.3 Enforceable freshness

- Every read tool accepts `max_age_s` (maximum acceptable age of the source observation), `allow_stale` (default false), and `consistency` (`cached`: any entry within `max_age_s`; `validated`: revalidate against the source of truth before serving; `strong`: read the authoritative D1 row or upstream, no copy). Defaults per tool are the TTLs in Section 4.5.
- A requirement the server cannot meet (upstream down, rate-limited, Studio push absent, revalidation timed out) returns an explicit error (`freshness_unmet`, with the best available `source_observed_at` and the reason), never a silent downgrade to an older entry. Stale data is returned only when `allow_stale: true`, and then marked `cache_status: stale`.
- Four timestamps are kept distinct on every record and response: `served_at` (when this response left the server), `source_observed_at` (when the underlying source state was last read from GitHub, the Studio, or the live page), `last_validated_at` (when the entry was last confirmed still current against its source), and `computed_at` (when the check or render ran). These replace the single `fetched_at` of earlier drafts.

#### 7.5.4 Durable historical snapshots

- Every issue and PR version body persists in D1 (or R2 for large bodies, referenced from D1). Historical snapshots, `since_version` deltas, and `handoff_resume` issue deltas read from D1 or R2, never from KV alone. Open question 4 is resolved: bodies live in D1.
- KV holds only immutable bodies keyed by content hash or (resource, version), plus disposable copies of D1 or R2 records. Losing all of KV loses latency, never history.
- Mutable pointers (current version, `covered_through` marks, leases, fencing tokens, wait state) live in D1 or a Durable Object, never in KV, because KV reads are eventually consistent and can return an old pointer after an update.

#### 7.5.5 Transactional events and the outbox

- A resource update, its version allocation, its change-feed append, and an outbox entry commit in one D1 transaction (batch). Either all four exist or none do; a feed reader can never see a version without its body or a body without its event.
- After commit, an outbox worker applies cache changes (KV copy writes and evictions) and wakes Durable Object waiters (`fleet_wait_for`). Outbox entries are retried until acknowledged and are idempotent by sequence number, so a crash between commit and delivery delays a wakeup or copy update; it never loses one. Waiters also re-check the feed on reconnect, so a missed wakeup costs latency, not correctness.

#### 7.5.6 Concurrency and idempotency

- **Idempotency keys** are required on every write tool and stored in D1 keyed by (token id, tool, key) with the request hash and the result. A replay with the same key and request returns the stored result; the same key with a different request is rejected (`idempotency_conflict`). The retention window is a build-phase parameter recorded in deploy config.
- **Optimistic concurrency:** every update to a versioned resource carries `expected_version`; a mismatch returns `version_conflict` with the current version, never a lost update.
- **Single-flight cache fills:** concurrent misses for the same identity coalesce on one computation through a per-identity lease row in D1 (or a Durable Object); followers wait for the leader's result or time out with an explicit error.
- **Stale-worker fencing:** each lease, session, and Studio push carries a monotonic fencing token; the server rejects writes (checkpoints, verification pushes, run records) whose token is older than the current one, so a worker presumed dead cannot overwrite its successor.

#### 7.5.7 Render identity (circularity resolved)

The earlier key (URL plus viewport plus state plus rendered content hash) was circular: the content hash is known only after rendering, so it cannot decide whether to render. **Supported model: always-observe with screenshot deduplication.** Every `verify_render` call renders the live page; the cache deduplicates storage and diffing, it never substitutes for observation. The other candidate models (an application-provided deployment or asset fingerprint, or a bounded freshness interval) are not supported in v1; adding one is a dated amendment with documented coverage.

- **Render identity** (the key that groups comparable renders): normalized requested URL; final URL after redirects; viewport (width, height, device scale factor); state profile id and version (signed-in identity, locale, theme, cookies and storage fixture hash); renderer version (Fleet MCP render module version plus Browser Rendering API version) and browser name and version as reported by the browser; readiness rule (for example network idle for N ms plus a named selector visible, with a hard timeout; the rule and its parameters are part of the identity); normalization profile version; `full_page`.
- **Readiness:** a render that hits the timeout before the readiness rule holds is stored as `ready: false` and never certifies anything.
- **Dynamic content normalization:** before hashing, the normalization profile freezes or masks clocks and relative dates, animations and transitions (disabled), carets, random ids, ads and third-party embeds, and declared dynamic regions (selectors listed in the state profile). The screenshot hash is computed over the normalized PNG; the raw PNG is kept for evidence.
- **Dedup:** if the normalized screenshot hash equals the latest stored render for the same Render identity, the call returns that `render_id` with `cache_status: hit` and updates `last_validated_at`; otherwise it stores a new render. `verify_visual_diff` compares only renders whose identities match except for time.

#### 7.5.8 Adversarial acceptance

The cache correctness suite (execution plan K4) must show, before any "with" run: a dependency or lockfile change misses; an environment change misses; a forced rerun is a distinct record; an unmeetable freshness requirement returns `freshness_unmet`; a KV wipe loses no history; a crash between commit and outbox delivery loses no event; duplicate idempotency keys produce one effect; a fenced stale worker cannot write; a changed page under the same Render identity produces a new render.

## 8. Benchmark plan

This section is governed by Aria's binding evidence standard (Nov 22, 2026, 16:42 PT): the final results must be solid, verified, and backed by enough data that they could go in a research paper and prove to anyone that they are real. No hallucinations. No invented numbers. No exaggeration. The standard has six parts, and each is an explicit requirement below: preregistration, controlled experiments with confidence intervals, traceability to raw data, independent verification, UNPROVEN labeling, and full reporting.

### 8.1 What to measure

Per task, in both arms (the metric set extends the KERNEL controlled benchmark design in Report Part 3):

- **Tokens (single primary endpoint):** total tokens per task across all attempts, with input, output, cache-read, and applicable cache-write tokens always reported separately. Normalize provider fields into disjoint uncached input U, cache-read R, cache-write W, and output O, then define primary total T = U + R + W + O. Validate the pinned provider schema against raw usage records before the pilot: if input I includes R and W, U = I - R - W and T = I + O; if cache writes are a subset of uncached input, split them out only once. Never add cached input to inclusive input or reasoning output to inclusive output. Archive the mapping, reconciliation checks, and raw fields; unresolved accounting blocks analysis. Include tool schemas, resource descriptors, tool-response context, and retries in input. Report schema overhead separately without subtracting it. This resolves the former Section 8.1 versus 8.7 conflict.
- **Wall-clock time:** task start to task end, plus tool time as a subset (tool time was 75% of wall time in the recent Claude sample; Report Part 1, recent Claude).
- **Tool calls:** total, by type, and by class (state checks, re-fetches, re-reads, verification runs, renders, sleeps). Sleep commands are counted explicitly: the "with" arm should show zero sleep loops.
- **Cache behavior (with arm only):** cache hits and misses per tool, hit rate, bytes served from cache vs computed fresh.
- **Errors:** failed commands, wrong-file reads, reverted edits, verification failures after done claims.
- **Outcome correctness:** did the task complete correctly, verified independently (Section 8.8, using the Section 8.5 programmatic verifier model). A faster wrong answer is a failure, not a saving.
- **Adoption:** did the agent actually use the server tools (recall ran? checkpoint saved? preflight run?). The report's finding is that the instructed memory path is often skipped (recall in only 6 of 193 recent Codex commands; Report Part 1, recent sessions), so adoption is measured alongside the outcome, as Report Part 3 requires, in Codex units (Section 8.7).
- **Cost:** model cost from disjoint token classes and archived run-time prices, separately from allocated server cost. Freeze the allocation denominator and treatment of idle capacity before runs; report both components and their sum.
- **Measurement contract:** freeze `benchmark/metrics.md` before any run: each metric's unit, numerator, denominator, capture source, aggregation, interval method, and missing-data rule. Accuracy is independently verified binary correct completion per assigned task (failed or timed-out tasks are incorrect), plus a rubric-based graded score only where frozen. Reliability reports first-attempt successes / assigned tasks, eventual successes within the retry budget / assigned tasks, tasks requiring retry / assigned tasks, extra attempts / all attempts, and worker deaths, timeouts, auth failures, and stale results / eligible attempts. Keep denominators distinct. Report control, treatment, absolute difference, relative change (undefined for zero control), CI, N, and evidence links for tokens, time, accuracy, and reliability.

### 8.2 Control group

- **The "without" side is two things, kept distinct.** (a) The transcript baselines from the report: the measured counts in Section 1.2 are the "without" numbers for the deterministic replays in Section 8.3. (b) A live control arm: the same tasks run without the server, by the same pinned Codex model (Section 8.4, Model), from the same brief and the same starting state, with arm order randomized (the KERNEL design in Report Part 3). The live control arm is what makes the agent experiment causal; the transcript baselines alone cannot, because the fleet already uses KERNEL almost everywhere and the transcript data has almost no control group (the observational KERNEL split had a control group of n=1; Report Part 3).
- **Control-arm rule (preregistered decision, needs reviewer sign-off, Section 9):** the control arm works the way agents work today: brief plus files plus CLI, including bash `agentdb` access, because that is the honest "today" baseline. The claim under test is "the server improves on today's workflow", not "the server improves on an agent stripped of its memory". The treatment arm adds the MCP server on top of the same baseline. This rule is written into the preregistration (Section 8.6) before any run.
- **Blinding:** outcome correctness is scored without the scorer knowing which arm produced the result, wherever the scoring method allows it. The scoring script reads session artifacts by run id, and the arm mapping is held separately until scoring is complete.

### 8.3 Deterministic replays (no agent runs; mechanism upper bounds)

These replays use the already-measured baselines as the "without" side and the server as the "with" side. They need no agent runs and run first, before the agent experiment. **Every replay result is labeled a mechanism upper bound, not a measured saving:** a replay assumes each repeated fetch, read, or check was avoidable, and the report states that necessity cannot be proven from transcripts alone (Section 1.2). Where file hashes are available, the replay checks whether the file changed between reads and counts a changed-file re-read as necessary, not as waste. Replays report counts (calls, bytes, invocations) only; wall-clock is dropped from replays, and any time figure a replay shows is labeled simulated. Each replay's good-result bar comes from Report Part 4 and is a target, not a measured result.

**Scope check before running (Section 0).** Before any replay runs, each replay input set is verified in scope: every transcript, prompt, and session in it must come from personal-project work. Any input that is not in scope, or whose scope cannot be established, is excluded, and the replay is rebuilt from personal-project transcripts of the same waste class. The per-replay scope check is recorded with the replay's archived inputs.

| Replay | Baseline (measured) | With-side method | Good-result bar (target, from Report Part 4) |
|---|---|---|---|
| Exemplar: replay the 134 Antigravity lane prompts with exemplar fetches instead of pastes | 148,020 redundant bytes, 27.3% of prompt bytes | Replace each pasted block with a fetch reference; measure prompt bytes plus tokens | Repeat bytes under 5% of prompt bytes (Idea 1) |
| Issue Context: replay the sampled sessions' gh calls through the server | 500 gh calls (Claude) plus 314 (Codex), 142 extra repeated fetches | Route each call through `issue_get` / `issue_list`; measure calls plus bytes | One fetch per unique issue per session; structured JSON instead of CLI dumps; no foot-gun writes (Idea 4) |
| Verify: replay the verification battery through the cache | 32 lanes re-running the same checks; gate 18x plus locale 15x plus hero 17x plus promotion 15x plus verify 14x; 327 Playwright launches | Run each check once per file hash; render once per content hash; measure check invocations plus launches | One check run per unique file hash; launches only for changed content; deploy-status checks catch a failed build before the verify step (Idea 3) |
| Fleet Status: re-run the coordinator session's supervision loops via the server | 179 sqlite3 plus 131 wait/listen plus 311 sleep plus 500 gh calls (Claude); 169 `vaults ctx` polls (Codex) | Replace each poll loop with `fleet_wait_for` plus `fleet_what_changed_since`; count state-check calls (wall-clock, if shown, is labeled simulated) | 80% fewer state-check calls, no sleep loops, zero attempts launched with a dead credential (Idea 2) |
| Handoff: replay a worker-death scenario | 7 duplicate-task pairs; 76 compactions plus 209 post-compaction re-reads; 488 re-attempts; 77 worker deaths | Kill a worker mid-task, resume via `handoff_resume`; measure re-done work | Zero re-done work; the retry reads the prior attempt's state instead of re-fetching the issue and re-reading the repo (Idea 6) |
| Brief: replay the duplicate pairs via the server | 91 pointer prompts; 7 duplicate-task pairs | The retry reads the brief once plus the prior run's outcome | The retry does not repeat the first attempt's error (Idea 8) |
| Recall: same recall/learn via MCP | 91 agentdb calls via bash; recall in only 3 of 9 recent sessions; errors tables dead; 15 of 77 DBs with stale schema | Measure MCP call latency vs bash spawn latency; measure adoption from MCP clients; check store health visibility | Recall works from any MCP client with latency under the bash equivalent; adoption is measurable instead of assumed (Idea 5) |

Replay results are deterministic counts under stated avoidability assumptions, so they carry no confidence intervals and are reported as upper bounds; they are still independently re-verified (Section 8.8) and their raw inputs and outputs are archived (Section 8.8). A replay is not a substitute for the agent experiment: replays prove the mechanism saves bytes and calls; only the agent experiment proves agents get faster and cheaper in practice.

### 8.4 Controlled agent experiment

**Tasks.** Real personal-project jobs with a recorded brief and a verifiable outcome, drawn from the runner's personal-project queues. The exact task list is preregistered (Section 8.6), not chosen in this PRD. Task families (illustrative, not the list): a deploy verification on a personal project, a triage pass over a personal repo's queue, a docs update, a bug fix with a verifiable outcome, a cold-read verification. No TBS tasks, no TBS lesson work (Section 0). Tasks are chosen for representativeness across the waste classes in Section 1.2, not cherry-picked for server-friendly shapes; the selection rule is written into the preregistration.

**Model (single-model scope, R6).** One model only: Codex solo, the most recent version at freeze time. The exact model ID is pinned and frozen in `bench-prereg-v1` (Section 8.6). Every run records the model ID, the Codex CLI version, the reasoning setting, limits (timeouts, turn and token caps), the tool configuration, and the exact prompts. Multi-model work is out of scope for this benchmark and is deferred to later work; results generalize to Codex on these task families only.

**Cohort-stop rule on provider change.** If the provider changes the model behind the pinned ID, or the pinned ID becomes unavailable, mid-study: stop the affected cohort and preserve all its data. Then either retain the pinned snapshot, or amend the protocol (dated amendment under a new tag, Section 8.6) and restart the affected paired cohort under the new version. Versions are never pooled into one confirmatory claim. If immutable model identity cannot be verified, the limitation is disclosed and unsupported model-controlled claims are withheld (reported as UNPROVEN, Section 8.8).

**Codex token capture (confirmed before the pilot).** Before the first pilot run, the harness confirms that the token fields (input, cached input, output, reasoning output) exist in Codex rollouts for the pinned model. Codex rollouts carry no cost field, so cost is computed from tokens and the model price recorded at run time.

**Arms.** (A) With the server: the agent has the Fleet MCP tools plus today's baseline. (B) Without: the agent has today's baseline only (brief, files, CLI, bash agentdb). Same pinned Codex model, same brief, same starting state. Arm order randomized per task. The agent in each arm is a fresh agent; no agent runs both arms of the same task.

**Task pool and baseline measurement.** Freeze a ranked pool of at least 60 personal-project tasks, the ranking, eligibility and selection rule, seed, and disjoint pilot and confirmatory assignments before the first with run. These counts are design decisions. Reserve 10 pilot tasks and up to 50 confirmatory tasks; no outcome-based substitution. Measure personal-project baseline waste rates on the pool before preregistration, with archived task IDs, sources, counts and denominators, including repeat reads, polling, recall adoption and sleep commands. Historical mixed-corpus rates do not stand in for this measurement. Baseline observations cannot teach the treatment corpus.

**Isolation and scheduling.** The later benchmark harness uses isolated worktrees, fixtures, deployment namespaces, checkpoints, and memory writes per task-arm. This is an experimental isolation requirement, not permission for revision agents to create worktrees now. Snapshot and hash baseline agentdb state and the treatment corpus; restore starting snapshots between arms. Pilot outputs and lessons never enter the confirmatory corpus or baseline memory. Block scheduling by worker and time window and randomize arm order within blocks using the frozen seed, so shared-worker contention cannot systematically favor an arm. Record load, scheduling deviations, provider incidents and model changes; apply the cohort-stop rule above.

**Cache condition per run.** Primary runs are cold: reset KV, verification and render stores in the run namespace, verify emptiness with archived receipts before launch, and record condition and reset receipt in every run record. Within-run reuse is allowed and measured. Provider prompt caching is a separate recorded condition, balanced by the frozen scheduling policy and included in token accounting. Warm-cache reuse is a separate descriptive factor, never pooled into the primary. Record each hit's origin run ID and cache key, including within-run origins; unexplained cross-run hits are protocol deviations, not silent exclusions.

**Design and power (all counts and thresholds below are design decisions).**

- Pilot: 10 tasks x 2 arms = 20 runs, used for harness validation and variance estimation only, never pooled with confirmatory outcomes.
- Primary power calculation: paired log ratios d_i = log(T_with,i / T_without,i). Before the pilot, freeze executable simulation code, seed, distributional assumptions and sensitivity cases. Estimate SD s from pilot d_i, use its one-sided 95% upper confidence limit, and simulate power for a two-sided alpha 0.05 improvement test at a true ratio of 0.80, targeting 80% power. Under the normal-log-ratio planning assumption use s_upper = s * sqrt((m-1) / chi2_quantile(0.05, m-1)); disclose sensitivity to nonnormal pilot data. Simulate the actual BCa decision rule as well as the paired t approximation. Power for excluding zero is distinct from power for meeting the point-estimate target; report both. At a true reduction exactly at the target, 80% power for the joint success rule is not promised.
- Confirmatory N is the smallest N meeting the frozen primary improvement power rule, bounded by floor 30 and cap 50 tasks. The floor is a design decision, never a statistical guarantee of stable means or meaningful intervals. If required N exceeds the cap, execute the cap, disclose achieved power and required N, and label the target-sized-effect claim UNPROVEN. Freeze the computed N and calculation receipt in a dated post-pilot registration before any confirmatory outcome, without changing the pre-pilot selection rule or analysis. No optional stopping or expansion based on confirmatory effects.
- Repeatability: select 10 confirmatory tasks with the frozen seed and selection algorithm, each with two extra runs per arm, each reset cold. This adds 40 runs to the 20 pilot and at least 60 confirmatory runs, a design minimum of 120. Analyze log tokens using a prespecified mixed model with fixed arm, order and scheduling-block effects, task random intercept and task-specific random arm effect, and residual run variance. Report arm effect, between-task variation and within-task-arm variance with task-cluster bootstrap intervals. If singular or nonconvergent, report descriptive within-task-arm variances and paired task means with task bootstrap intervals, label model decomposition UNPROVEN. Do not count repetitions as independent tasks or pool them into the primary result.

**Primary estimand and analysis.** The sole primary endpoint is total tokens per task, paired over the frozen confirmatory task sample. Estimate mu = mean(d_i), with d_i the with-minus-without log total. Report signed percent change 100 * (exp(mu) - 1), negative for improvement, and reduction 100 * (1 - exp(mu)). This is a geometric mean ratio, not a ratio of arithmetic means or an arithmetic mean of percentages. Primary interval: task-pair BCa bootstrap, 95%, with 10,000 resamples and frozen seed (design decisions), recomputing mu on whole pairs; transform endpoints monotonically, reversing order for reduction. Paired t-interval on d_i is the robustness check. Report both without selecting the favorable interval. Degenerate BCa output is an analysis failure, no substitution of the t-interval for primary success. Report per-task totals, log ratios, raw differences, SD and intervals.

**Multiplicity and correctness.** Wall-clock and binary correctness are the two key secondaries, tested as a Holm family at familywise alpha 0.05 (design decision), ordered p-values compared with 0.025 then 0.05. Wall-clock uses paired log ratios and a two-sided paired t test, with effect and interval reported. Correctness uses the non-inferiority procedure below; report raw and Holm-adjusted p-values and decision-compatible bounds, not just unadjusted intervals. Other metrics, graded scores, reliability comparisons, adoption and thresholds are exploratory. Primary success alone never establishes correctness or an overall safe efficiency improvement.

**Correctness non-inferiority.** Define Delta = P(correct_with) - P(correct_control), margin -0.05 (five percentage points, design decision). Null: Delta <= -0.05; alternative: Delta > -0.05. Freeze an exact unconditional paired-binomial test with tail ordering by observed with-minus-control success proportion: enumerate the four paired outcome cells, maximize the upper-tail probability over nuisance probabilities under each candidate null, and invert that same test for one-sided lower and upper bounds. Report the two-sided 95% paired interval from tail alpha 0.025 and use a one-sided 97.5% lower bound as the conservative Holm-compatible non-inferiority rule (design confidence levels); also report the Holm-adjusted test decision. Freeze the numerical optimizer, boundary handling and validation cases before runs. Report the with-minus-control interval and discordant cell counts. Require the multiplicity-adjusted lower bound strictly above -0.05, never merely two point estimates within five points. Before runs, freeze a separate power simulation over plausible discordance rates and true differences, using the conservative Holm first-step alpha 0.025 and target 80% power. At N 30-50 this narrow margin is preregistered as likely UNPROVEN; absence of observed discordance is not proof of non-inferiority. Report required N and achieved power scenarios; do not widen the margin or borrow repetitions to claim power. A powered future cohort requires a new registration.

**Missing data and failures.** Assigned tasks remain in the ledger. Aborts, timeouts, credential failures, worker deaths, exhausted retries and product failures are outcomes, not exclusions. Count tokens consumed across attempts and wall time through the frozen timeout/retry budget; score correctness false when incomplete. Positive observed totals remain in the primary even for failed tasks, with a failure-stratified sensitivity table so early failures cannot be advertised as efficiency. Never log-transform zero or fabricate missing usage. Missing or zero totals make the primary claim UNPROVEN; report affected pairs and prespecified sensitivity bounds using archived per-run token caps and a positive lower bound only where capture proves one. Sensitivity analysis cannot repair missing raw evidence. A missing raw artifact is a data-loss failure. Only objectively defined harness faults (capture process failure before task launch, or fixture initialization failing its hash check before agent exposure) permit a replacement under the frozen same-task rerun rule. Archive the original and replacement, reason and blinded adjudication; post-launch faults remain outcomes. Freeze caps and adjudication rules before any run.

**Zero-event criteria and fault injection.** Before experiments, exercise expired, missing, unknown and mid-run-expiring synthetic credentials in isolated personal-project fixtures. Record expected deny/stop behavior, actual launches and failures, and eligible opportunities for each condition. A mid-run expiry must stop further protected actions, not rely on an initial successful preflight. Report each zero-event count with its finite-sample exact binomial interval and denominator: for zero of n independent opportunities the one-sided 95% upper bound is 1 - 0.05**(1/n) (design confidence level); n = 0 is uninformative. Cluster repeated opportunities by task and disclose dependence rather than claim an independent-event bound. Zero observed events never proves a zero population rate.

### 8.5 Existing benchmark material reused

- **llm-bench (42 tests, programmatic verifiers):** the model for outcome verification. Where a task's outcome can be checked programmatically (a file exists, a check passes, a URL serves expected text), the verifier is code, not a judge. Caveat carried forward from the report: the Oct 1-2 scores (devstral 0.792, qwen3-coder 0.770, lfm2.5 0.738) are pre-grading-revision and superseded; the corrected scores come from v3 rescoring (Report Part 2).
- **model-familiarity-engine (9 preregistered gates, Experiment 0):** the model for preregistration and for honest instrument verdicts. MFE's Experiment 0 returned NOT CERTIFIED (6 PASS, 2 PENDING, 1 FAIL on provenance) because the run could not prove which protocol collected its shards (Report Part 2). This benchmark's instrument must be able to return the same verdict: if provenance fails, the result is NOT CERTIFIED, not quietly published.
- **Transcript baselines:** the "without" numbers for the replays (Section 8.3) and the variance evidence for the sample size (Section 8.4).
- **KERNEL effectiveness:** NOT YET MEASURED (Report Part 2). This benchmark does not claim to measure KERNEL's effect; it measures Fleet MCP's effect over today's baseline, which includes KERNEL as installed.

### 8.6 Preregistration

- **Artifact:** `benchmark/preregistration.md` in the `fleet-mcp` repo, plus a machine-readable `benchmark/preregistration.json` with the same content. It contains: one primary hypothesis and the two key secondary hypotheses, the full task list with selection rule, the arm definitions and the control-arm rule, the metric definitions and how each is captured, the sample size rule (pilot, power computation, floor of 30, cap of 50), the success thresholds (Section 8.7), the complete Section 8.4 analysis plan (log-ratio estimand, BCa primary interval, t robustness interval, Holm family, paired non-inferiority, missing-data and repeatability rules), the exclusion rules (which runs are excluded and why, decided before seeing results), the repeatability substudy task selection, the pinned Codex model ID with the CLI version, reasoning setting, limits, tool configuration, and prompts recorded per run (Section 8.4, Model), the cohort-stop rule, the exact with-arm tool set (which tools and resources the with arm sees, whether the tool list is scope-filtered per task, and whether pure reads are exposed as resources only to cut schema tokens; all three options are evaluated during the spike and the chosen configuration is frozen here), and the verification plan (Section 8.5 and 8.8).
- **Freezing:** the preregistration is committed and tagged (`bench-prereg-v1`) with its SHA-256 hash recorded in the tag message and in the final report, BEFORE the first "with" run (pilot included). A remote timestamped registration record containing the tag, commit and SHA-256 is also required before the first with run; a local tag alone is insufficient proof of timing. No moving the goalposts after seeing the results.
- **Amendments:** if the preregistration must change, the change is a dated amendment entry appended to the artifact, stating what changed and why, committed under a new tag (`bench-prereg-v2`). The original stays in the repo. Any result affected by an amendment is flagged as such in the final report, with the amendment quoted.

### 8.7 Success criteria (preregistered targets, not measured results)

These thresholds are written into the preregistration before any run. Each is a target; the experiment may fail any of them, and a failed threshold is reported as failed.

| Metric | Success threshold (target) |
|---|---|
| Token reduction (input plus output with cache reads counted once, paired per task) | Geometric-mean reduction point estimate at least 20% AND primary BCa 95% CI excludes 0 in the improvement direction |
| Wall-clock reduction (paired per task) | Key secondary: geometric-mean reduction target 15%, with Holm-corrected improvement test passing |
| State-check and re-fetch tool calls (paired per task) | Exploratory target: mean reduction of at least 50% |
| Outcome correctness | Key secondary: with-minus-control paired lower bound above -0.05 under Holm adjustment; likely UNPROVEN at N 30-50 |
| Preflight | Zero attempts launched with a dead credential in the with arm |
| Recall adoption (with arm) | Recall runs in at least 80% of with-arm Codex sessions (Codex baseline: recall in 6 of 193 recent Codex commands, Report Part 1, recent sessions; session-level Codex adoption NOT MEASURED, measured on the task pool before the freeze) |
| Sleep loops (with arm) | Zero sleep commands in with-arm sessions (Codex baseline: sleep-command count NOT MEASURED in the Codex sample, measured on the task pool before the freeze; measured Codex polling: 782 `wait`/`wait_agent` calls and 141 `clock__curr_time` calls across 12 Codex sessions, Report Part 1, Codex) |

The token rule establishes improvement with a target-sized point estimate. It does NOT establish that the true reduction is at least 20%. That stronger claim requires the entire reduction interval to support at least 20%. Preflight, recall and sleep targets are exploratory; zero counts use Section 8.4 finite-sample bounds. These protocol choices are not measured results.

### 8.8 Traceability, independent verification, and UNPROVEN labeling

- **Traceability:** every reported number is traceable to its raw data. Preserved and archived: the raw session transcripts for every benchmark run, the run logs, the raw measurement files, the scoring script, and the analysis. Small files live in the repo under `benchmark/data/`; large transcripts live in R2, with their content hashes and R2 keys recorded in the repo. The scoring script recomputes every reported number from the raw data with one command, so anyone can reproduce the result. The final report cites the source file for every number.
- **Independent verification:** the numbers are re-checked by a party other than the one that produced them. A separate verifier (a different agent or operator from the benchmark runner; the exact assignment is an open question in Section 9) re-runs the scoring script from the archived raw data and compares its output against the reported numbers, within a preregistered tolerance (exact match for counts; stated tolerance for derived statistics). Outcome correctness is scored by programmatic verifiers first (the llm-bench model). Where agent judgment is needed, the judge is a separate independent operator using the same pinned Codex model, with a frozen rubric and arm-blinded artifacts where feasible (judge-panel resolution, R6). The judge is a verifier, not a second task solver; keeping one model family in the whole evidence chain keeps the single-model claim airtight. The multi-family judge panel (the MFE model) is deferred to later multi-model work and is not used here. A mismatch between the verifier's numbers and the reported numbers blocks publication until resolved.
- **UNPROVEN labeling:** if a result cannot be proven to this standard, it is reported as UNPROVEN, with what it would take to prove it (more runs, a better instrument, a different task set). Never inflate, never round up, never present a suggestive result as a proven one. A null result is a result and is reported as such, following the KERNEL design's own rule (Report Part 3: "If arm A is not better, report that too; a null result is a result").
- **Reporting:** the final report includes the method, the sample sizes, the confidence intervals, the effect sizes, the per-task differences, and where the raw data lives, not just the headline percentages. A headline percentage without its confidence interval and sample size is not published.

## 9. Risks and open questions

### 9.1 Risks

| Risk | What happens | Mitigation |
|---|---|---|
| Single point of failure | If the server is down, agents lose state access | The server is an accelerator, never a hard dependency, made true by a defined degraded mode for the two server-held records. (1) Checkpoints: `handoff_save_checkpoint` callers also write a local checkpoint mirror (the same structured state JSON) in the run's workspace; when the server is unreachable, resume reads the local mirror, and the mirror is uploaded on recovery. (2) D1-first lessons: when the server is unreachable, agents write lessons with bash `agentdb learn` directly to the local store (the source of truth, Section 4.4); a lesson whose `writeback_status` is `pending` or `failed` at outage time is listed by `recall_store_health` on recovery and written back by the sync job. Everything else falls back to today's CLI paths. `/health` plus the post-deploy sweep catch outages; the runner keeps working without the server, just slower. |
| Cache staleness serves wrong state | An agent acts on an outdated issue body, flight state, or a green check computed for different inputs | The Section 7.5 contract: complete computation identities, caller-enforced freshness with explicit `freshness_unmet` errors, always-observe renders, durable D1 snapshots, transactional feed plus outbox, fencing; verified by the adversarial suite (Section 7.5.8). |
| GitHub API rate limits | Heavy polling through the server exhausts the per-token hourly limit | The server is the fix, not the cause: caching plus the change feed cut upstream calls. The server tracks its remaining quota and reports it in `/health`; on quota exhaustion it serves stale cache with `cache_status: stale` only to callers that set `allow_stale: true`; all other callers get `freshness_unmet` (Section 7.5.3). |
| Browser Rendering cost and latency | Renders are the most expensive tool; a runaway render loop costs real money | Content-hash dedup plus cache-first behavior; per-token render quotas; the audit log records every render with its caller, so a runaway caller is visible. |
| Stored-content prompt injection | Lessons and exemplars are agent-written text served back into agent context; a poisoned lesson could steer future agents | Stored content is data with provenance (author, source, timestamp), never executed as instructions. The server never auto-writes lessons. A review path exists for lessons (flag and quarantine by id). |
| Scope creep | 8 ideas in one server; the build sprawls | Phased rollout (Section 10), one area at a time, each with its replay benchmark before the next starts. The agent-facing API (the public tools and resource reads in Section 3 and Appendix A) is the v1 scope; any agent-facing tool or resource not listed is out. The rule bounds the agent-facing API only: the control-plane operations in Section 3.3 and implementation necessities (migrations, cron reconciliation, webhook receivers, internal queues, deploy and sweep scripts) are in scope without an Appendix A entry, provided none exposes a new agent-facing capability. |
| Benchmark cost and time | 120 or more agent runs at 10 to 60 minutes each is real compute | Parallelize across runner workers; the compute cost is measured and reported as part of the result, so the cost of proving the saving is itself public. |
| The server's own token cost | Tool schemas and MCP plumbing add context tokens, which could eat the savings | Schema overhead is measured separately (Section 8.1) and the with-arm tool set is preregistered (Section 8.6). The benchmark measures the net effect (with-server total tokens vs without), not gross savings. A server that costs more than it saves shows up as a null or negative result. |
| Task selection bias | Benchmark tasks cherry-picked for server-friendly shapes | The task list and selection rule are preregistered; tasks are real runner jobs, chosen for representativeness across waste classes. |
| TBS boundary failure | A misconfiguration exposes TBS data through the server | The allowlist is a whitelist enforced in code, tested by a test that proves a TBS repo is refused, and reviewed in the preregistration. The webhook receiver drops non-allowlisted repos. |

### 9.2 Open questions (for the reviewers)

1. **Name and domain:** is Fleet MCP the name, and is `mcp.ariaxhan.com` the domain? Both are proposals in this PRD.
2. **Client isolation:** resolved in R3: ownership keys and default-deny authorization in shared storage (Section 6); client rollout requires negative isolation acceptance, with separate deployments where contractual requirements demand it.
3. **Render split trigger:** resolved in v2 (R8): defined on three measured metrics in Section 5.3; numeric thresholds come from Phase 3 measurements as a dated amendment.
4. **Issue cache storage:** resolved in v2 (R2): every issue and PR version body persists in D1; KV holds only disposable copies (Section 7.5.4).
5. **Retention:** resolved in v2 (R8): set per record class in Section 4.6; benchmark-linked records are never pruned.
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

## 11. Binding deliverables and measurement contract

This section implements `docs/execution-plan.md` Sections 1.2, 3.1 (R7), 3.5, and 10. Paths below are required deliverable targets, not claims that artifacts exist or gates have passed. Phase numbers and gates follow that execution plan, superseding the proposed sequencing in Section 10: Phase 0 revision (G0), Phase 1 spike (G1), Phase 2 build (G2), Phase 3 benchmarks (G3), Phase 4 commission (G4). No build before G0; no full build before a dated G1 go verdict; no agent experiment before G2; no "with" run, pilot included, before `bench-prereg-v1` plus SHA-256 and remote timestamped registration; no result publication before G3 and independent verification. This revision does not pass G0 by itself.

### 11.1 Deliverable register

The Unified MCP Server chat owns delivery and surface verification; Studio runner lanes implement, and an independent verifier verifies benchmark evidence. All inputs and real-data acceptance use the personal-project corpus only (Section 0).

| # | Binding deliverable and required paths | Phase gate and acceptance surface |
|---|---|---|
| 1 | Full report: `report/report.md` and tables under `report/` | Phase 3 draft begins with verified scoring output; Phase 4 finalization after G3, accepted at G4. Report tokens, speed, accuracy, reliability, error and re-attempt rates, cost, and wall time per task under Section 11.2. Every headline has CI, N, and evidence links; null and adverse results included. |
| 2 | Full unified MCP server: `src/`, `sidecar/`, `wrangler.toml`, `migrations/` | Phase 1 spike after G0; full build after G1. G2 requires the full-v1 acceptance matrix on deployed real personal-project data: every tool, resource, ingestion/admin path, cross-side workflow, and Render operation has component, authorized source, test, build receipt, and evidence location. A Context slice alone is insufficient. |
| 3 | Runnable benchmarks: `benchmark/README.md`, `benchmark/metrics.md`, `benchmark/harness/`, `benchmark/replays/`, `benchmark/suites/`, `benchmark/tasks/`, `benchmark/fixtures/`, `benchmark/reuse-matrix.md` | Phase 3, G3: a fresh environment reproduces scoring and runs each suite using documented commands and pinned dependencies; reuse matrix complete (Section 11.3). Replays may run as areas land, with authorized inputs and archive capture ready; all "with" runs await the freeze. |
| 4 | Data archive: `benchmark/data/DATA_INDEX.md`, `benchmark/data/index.jsonl`, `benchmark/data/ledger.md`, `benchmark/data/collection-matrix.md`, `benchmark/data/retention-policy.md`, R2 archive, off-Cloudflare mirror | Capture infrastructure and mirror live before the first run. G3 requires complete capture and verifier receipt; Phase 4 audit at G4 verifies every indexed hash, expected-run accounting, independent copy, and restore drill (Section 11.4). Missing evidence is a recorded data-loss failure. |
| 5 | Single model first, Codex solo: `benchmark/preregistration.md` and `benchmark/preregistration.json` | Phase 3 freeze after G2 plus task pool, harness, and archive readiness, before the first "with" run. Resolve the most recent available Codex model to an exact ID, pin CLI version and model ID, and record cache condition per run. Provider/model changes stop the cohort, preserve data, and require a dated amendment under a new tag; versions never pool. |
| 6 | Self-contained HTML deliverable: `docs/report/index.html` | Phase 0 scaffold before experiments, updated through each phase; final only after G3, accepted at G4 by opening the rendered page and checking links/assets. Reads end to end without the repo: build, architecture diagram, methods, preregistration link/hash, results with CIs and N, UNPROVEN items, data index, verification instructions, costs, limitations, unfinished work. Numbers generated from the same scored data as report and paper. |
| 7 | Research paper: `paper/skeleton.md`, `paper/manuscript.md`, `paper/references.bib`, `paper/figures/`, `paper/evidence-map.csv`, `paper/README.md` | Aria Han sole author, Muse drafting support. Written during experiments, with Section 11.5 writing gates; final claims only after independent verification and G3, accepted at G4. A Phase 0 skeleton is not a finished paper. |

G4 requires all seven deliverables and execution-plan Section 10 acceptance, not merely documents naming them. All numeric budgets, formula constants, and gate criteria below are design decisions until frozen; none is a measured result.

### 11.2 Measurement contract

Before the freeze, `benchmark/metrics.md` specifies every metric's unit, denominator, capture source, aggregation, missing-data rule, and interval method. Freeze task rubrics, expected artifacts, attempt identity/restart rules, time origin/end, fixed elapsed-time budget, and fixed maximum attempt budget per task, identical across arms. Budgets cannot expand after an outcome is seen. Preserve assignment in intent-to-treat analysis, including tool non-adoption and failures; pilot and repeatability results remain separately identified. Missing capture cannot become success or disappear from denominators: retain its ledger row, report missingness, and label affected inference UNPROVEN pending evidence.

**Accuracy.** Each task has an acceptance rubric and expected artifacts fixed before runs; deterministic artifact/surface checks wherever possible. Binary correct completion is the shared endpoint across tasks, independently scored against all required acceptance items, not an agent's done claim. Accuracy rate is correctly completed task-arm observations divided by all assigned task-arm observations in the specified cohort. A graded score is a separate endpoint with a frozen scale, weights, aggregation, and judgment procedure, never silently substituted for binary correctness. Where judgment is needed, use the pinned Codex model under a separate operator, frozen rubric, arm-blinded artifacts where feasible, and reported agreement; agreement below the preregistered floor makes judged correctness UNPROVEN. Report treatment minus control accuracy in percentage points and relative percent change, with paired uncertainty and N. Correctness non-inferiority requires its own frozen directional margin, interval rule, and power assessment; proximity of point estimates alone proves nothing.

**Reliability.** Success means independently verified correct completion within both the fixed elapsed-time and attempt budgets. A new worker execution is a stable attempt ID, including a restart after death; transport retries are logged separately and cannot conceal worker attempts. Per arm and cohort define S = tasks started, A = all attempts for those tasks (including failed attempts), C = tasks completed successfully within budget, F = tasks completed successfully on the first attempt, R = tasks that require another attempt because the first does not complete successfully (including those whose retry is never launched), and E = extra attempts beyond each task's first. Report:

| Endpoint | Explicit denominator |
|---|---|
| First-attempt success | F / S |
| Eventual success within budget | C / S |
| Tasks requiring another attempt | R / S |
| Extra-attempt fraction | E / A |
| Attempts per completed task | A / C, including attempts spent on unsuccessful tasks in A |

Also report assigned-but-never-started tasks separately, with assigned-task counts and reasons; do not hide them behind S. When a denominator is zero, report undefined with numerator and denominator, never zero success or a fabricated rate. Keep worker deaths, authentication failures, timeouts, stale-cache results, and infrastructure failures as separate failure classes. Record task ID, attempt ID, phase, arm, timestamps, evidence, primary cause, and contributing causes; specify overlap rules so class totals are not mistaken for disjoint counts. Planned fault injection is tagged and analyzed separately from naturally occurring failures, never pooled into efficacy rates.

**Errors.** Report failed commands, wrong-file reads, reverted edits, and verification failures after done claims by class. Call-level error rate = failed calls / all eligible calls in that class; task-level error rate = tasks with at least one such error / tasks started. Name the eligible call population, count each affected task once per class, report overlap, and never mix call and task denominators. Classify infrastructure errors separately from product/correctness errors, without excluding either from assigned-arm outcomes.

**Speed and change conventions.** Let t_control and t_with be elapsed times from task start to verified completion or fixed-budget termination, including retries, queue/wait time, and verification; tool time is a subset, reported separately. Speed improvement means elapsed-time reduction: 100 * (t_control - t_with) / t_control, positive for faster, negative for slower. It is not throughput increase. If t_control is zero, relative reduction is undefined; retain the task, report absolute seconds and counts, and follow the frozen zero-handling rule rather than inserting an epsilon or dropping it silently. A non-completion's elapsed time is termination time, not a successful completion time; report completion status alongside time to avoid calling early failures faster completion.

For rate outcomes, percentage-point difference = 100 * (p_with - p_control); relative percent change = 100 * (p_with - p_control) / p_control. A zero control rate makes relative change undefined, with absolute difference still reported. Token reduction uses the same reduction sign convention as elapsed time. These per-task definitions do not replace the frozen primary token estimand (mean paired log ratio, back-transformed) or its CI; Section 8 statistics must be resolved under R5 before G0 and frozen before runs. No averaging of percentages or endpoint switching after seeing outcomes.

The report table for each outcome includes control, treatment, absolute difference, relative percent change or explicitly signed reduction, CI, N, denominator, and raw evidence link. Include token components and schema overhead, tool calls by class, cache hits/misses and origin run, adoption, model cost, allocated server cost, wall time, reliability, and errors. Analysis and multiplicity follow the frozen protocol; unsupported claims remain UNPROVEN with the evidence needed to resolve them.

### 11.3 Suites and reuse matrix

`benchmark/README.md` must document environment setup and runnable commands for harness, scoring, each replay R1-R7, and suites for cache correctness/invalidation, source freshness, interruption/resume, credential/connector faults, Render, cross-side workflows, and controlled end-to-end tasks. Preserve fixtures, expected outputs, dependency versions, and raw outputs. Boundary tests use synthetic excluded identifiers and never contact excluded systems. Replays are mechanism upper bounds, not measured agent savings; record input authorization, changed-file handling, and simulated-time labels.

`benchmark/reuse-matrix.md` has a row for llm-bench (programmatic verification), model-familiarity-engine (preregistration/verdict pattern), KERNEL (pilot design), transcript baselines (authorized replay inputs), and each new suite. Each row names applicability, pinned source revision, license, reused code or protocol, adaptations, exclusions, runnable entry point, and evidence output. Reuse is subject to the personal-only boundary, never permission to read an excluded source. A descriptive reference without a runnable applicable component or an explicit exclusion is not acceptance.

### 11.4 Archive and data-loss policy

The collection matrix covers baseline fixtures, pilot, confirmatory, repeats, failures, interruptions, exclusions, amendments, transcripts, tool/server/upstream logs, measurements, outcome artifacts, renders, analysis inputs/outputs, and verifier receipts. The append-only `index.jsonl` and readable `DATA_INDEX.md` record artifact ID, task/run/attempt IDs, arm, phase, timestamps, provenance, protocol/model/build versions, location, bytes, and checksum. The expected-run ledger is created before execution and reconciled against capture, including never-started and interrupted runs.

Use continuous durable capture, local spooling, resumable uploads, checksum/completeness verification, archive acknowledgements, and an independent off-Cloudflare mirror. Do not delete local capture before verified archive and independent backup acknowledgements. Commit mirror locations, access/restore procedure, integrity-check schedule, and retention policy before collection. Retain experiment evidence indefinitely, including failed, null, negative, excluded, amended, and superseded runs; never prune benchmark-linked records or enable destructive lifecycle rules for evidence. Encrypt raw transcripts; keep redacted copies separately with a redaction manifest; avoid capturing secrets. G4 audit verifies every hash and mirror, reconciles every expected run, and passes a restore drill. Missing artifacts are recorded data-loss failures, never silently reconstructed; affected claims remain UNPROVEN and cannot pass the no-data-loss acceptance by relabeling them.

### 11.5 Paper writing and publication gates

- Phase 0: align `paper/skeleton.md` with resolved PRD hypotheses/methods for G0; scaffold manuscript, references, evidence map, and HTML before collection.
- Before collection: methods and analysis reflect the frozen protocol; unresolved results remain pending, never invented.
- After pilot: record pilot findings separately and dated amendments under new tags, preserving the original registration; fix confirmatory N before confirmatory outcomes.
- During every experiment batch: contemporaneous notes link protocol, runs, failures, and deviations; figures/tables generated from archived measurements; results text only from verified scoring output.
- After G3: independent verifier re-runs scoring and independently re-derives sampled raw metrics, issues a receipt, and records CERTIFIED or NOT CERTIFIED. Unresolved mismatch blocks efficacy claims. Final report, HTML, and paper agree with the same scored data and retain null/adverse findings and UNPROVEN labels; an instrument failure is reported honestly.
- G4: each quantitative claim in `paper/evidence-map.csv` maps to protocol version, raw artifact IDs, analysis revision, and verification receipt. `paper/README.md` documents reproduction and writing-gate evidence. Final manuscript covers the full experiment, costs, limitations, and unfinished work; draft existence alone cannot satisfy deliverable 7.

## Appendix A: Tool inventory

45 public tools, 14 resource types. Control-plane operations that are not public tools (CLI, admin endpoint, connector operation) are listed in Section 3.3, not here.

- Exemplar (7): `exemplar_get`, `exemplar_list`, `exemplar_what_changed`, `exemplar_get_doc`, `exemplar_list_docs`, `doc_what_changed`, `ref_publish`. Resources: `exemplar://`, `doc://`.
- Recall (5): `recall_query`, `recall_learn`, `recall_list_lessons`, `recall_quarantine`, `recall_store_health`. Resources: `lesson://`.
- Issue Context (6): `issue_get`, `issue_list`, `issue_what_changed`, `issue_comment`, `pr_get`, `pr_list`. Resources: `issue://`, `pr://`.
- Brief (5): `brief_get`, `brief_list`, `brief_create`, `brief_revise`, `brief_record_run`. Resources: `brief://`, `run://`.
- Fleet Status (7): `fleet_get_flight`, `fleet_list_flights`, `fleet_get_job`, `fleet_list_jobs`, `fleet_what_changed_since`, `fleet_wait_for`, `fleet_preflight`. Resources: `flight://`, `job://`.
- Verify, including Render (9): `verify_check`, `verify_get`, `verify_list_checks`, `verify_deploy_status`, `verify_live_check`, `verify_render`, `verify_get_render`, `verify_render_cancel`, `verify_visual_diff`. Resources: `verification://`, `render://`, `screenshot://`.
- Handoff (6): `handoff_save_checkpoint`, `handoff_resume`, `handoff_list_sessions`, `handoff_get_run_history`, `handoff_set_status`, `bench_tag_session`. Resources: `session://`, `checkpoint://`.

## Appendix B: Number provenance

Every measured number in this PRD comes from `report.md` in this directory (and its `analysis/` files) and is cited inline with its report section. Numbers labeled as targets, thresholds, or design decisions are not measured results. No number in this PRD is invented. Where the report states a limitation (necessity not provable from transcripts alone; runner dollars unmeasurable; the KERNEL observational control group of n=1), this PRD carries the limitation forward instead of smoothing it over.

## Appendix C: Revision notes

### 2026-11-22: R2 cache identity and safety contract (execution plan Section 3.1, item R2; issue #3)

Closes these review gaps: **Codex top change 2** and **Codex ranked risk 1** (unconditional cache-safety claims; false verification or freshness), **Claude G3** (verification and render cache keys too narrow) and **Claude G10** (`docs/reviews/claude-review.md`).

- New Section 7.5: complete computation identities per result class; pure byte checks split from Studio-pushed workspace checks and live probes; `max_age_s` / `allow_stale` / `consistency` with explicit `freshness_unmet`; four distinct timestamps; D1 snapshots with KV for disposable copies only and no mutable pointers in KV; one-transaction update plus version plus feed plus outbox; idempotency keys in D1, optimistic concurrency, single-flight fills, fencing; adversarial acceptance list.
- Render circularity resolved: supported model is always-observe with screenshot deduplication; identity includes renderer and browser version, readiness rule, state profile, viewport, and normalization profile.
- Unconditional claims removed or rewritten in Sections 2.2, 2.3, 2.4, 2.5, 3.1 (`issue_get`), 3.2 (Verify table and design note), 4.1, 4.2, 4.5, 7.1, 7.3, 7.4, 9.1; Open question 4 resolved.

### 2026-11-22: R6 single-model scope (execution plan Section 3.1, item R6; issue #7)

Closes these review gaps: **Claude G4** (single-model scope missing from the PRD) and the **Codex deliverable 5 gap** (Codex solo, most recent version, not stated or pinned).

- Codex solo, exact model ID pinned and frozen in `bench-prereg-v1`; CLI version, reasoning setting, limits, tool configuration, and prompts recorded in every run; multi-model work out of scope (Sections 8.2, 8.4, 8.6).
- Cohort-stop rule on provider change; no pooling of versions into one confirmatory claim; unverifiable identity disclosed and model-controlled claims withheld (Section 8.4).
- Baselines and adoption targets restated from the Codex sample: token cost driver, recall adoption in Codex units, sleep-loop baseline from Codex behavior (Sections 8.1, 8.7).
- Codex token capture confirmed before the pilot; cost computed from tokens and run-time model price (Section 8.4).
- Judge-panel resolution, stricter (Codex) reading: programmatic verifiers first, then the same pinned Codex model under a separate independent operator; multi-family panel deferred (Section 8.8).
- Paper skeleton already carries the same text (`paper/skeleton.md` Sections 5.2, 5.5, 5.6; issue #10).

### 2026-11-22: R8 remaining review fixes sweep (execution plan Section 3.1, item R8; issue #9)

Closes these review gaps (Claude review gap table, `docs/reviews/claude-review.md`):

- **G11** webhook loss: per-repo `covered_through` high-water mark plus periodic reconciliation fetch (Section 3.1, Issue Context; Section 4.5).
- **G12** waits vs client timeouts: bounded `fleet_wait_for` with a resumable `wait_id`, cap set from the Codex client timeout measured in the spike (Section 3.2).
- **G13** write idempotency: required `idempotency_key` on every write tool (Section 3).
- **G14** sweep target: fixture repo plus fixture namespace; staging pre-promotion and production post-deploy sweeps, read-only plus fixture writes (Section 5.2).
- **G15** credential liveness: one rule, probed live on every call, never cached, no `fresh` parameter (Sections 3.2, 4.1, 4.5).
- **G17** schema overhead: measured separately; with-arm tool set preregistered, scope filtering and resources-only reads evaluated (Sections 8.1, 8.6, 9.1).
- **G18** replays: relabeled mechanism upper bounds; changed-file check where hashes exist; wall-clock dropped or labeled simulated (Section 8.3).
- **G19** replay scope: every replay input verified in scope under Section 0, rebuilt from personal-project transcripts where not (Section 8.3).
- **G22** cross-references: archive pointers now Section 8.8 (Sections 2.5, 4.2, 8.3); verification pointer now Section 8.8 (Sections 8.1, 8.3); "preregistered as an open question" replaced by the Section 5.3 trigger (Section 2.3).
- **G23** lesson identity: stable id plus `content_hash` (Sections 3.1, 4.1, 4.3).
- **G24** naming: `gotcha://` merged into `lesson://`; `doc_get` and `doc_list_canonical` renamed `exemplar_get_doc` and `exemplar_list_docs` (Section 3.1, Appendix A).
- **G25** audit: field-allowlist sanitizer plus retention (Sections 4.1, 4.6).
- Plan-level R8 items: delta cursor semantics standardized (Section 3, Section 4.3); Render split trigger defined on measured metrics with no invented numerics (Section 5.3; Open question 3 resolved); "accelerator, never a hard dependency" reconciled with D1-first lessons and server-only checkpoints via a local checkpoint mirror and a defined lesson degraded mode (Sections 4.4, 9.1); retention set per class with benchmark-linked records never pruned (Section 4.6; Open question 5 resolved).

Deferred, with reason: numeric Render split thresholds (set from Phase 3 measurements by dated amendment, per the evidence standard); the reconciliation interval and idempotency-key retention window (build-phase parameters recorded in deploy config); the `fleet_wait_for` cap value (measured in the Phase 1 spike, criterion 4).

### 2026-11-22: R7 binding deliverables (issue #8)

Closes **Claude G8** and **Codex ranked gap 3** (`docs/execution-plan.md` Section 3.1, R7): Section 11 adds all seven deliverables with paths and phase gates, the accuracy/reliability contract with explicit denominators and failure classes, error rates and elapsed-time reduction conventions, runnable suites and reuse matrix, indexed mirrored archive with indefinite evidence retention, self-contained HTML acceptance, and contemporaneous paper writing gates. Assumption: this Phase 0 task specifies future deliverables; it does not implement them, pass G0, freeze preregistration, run experiments, or publish results.

### 2026-11-22: R5 benchmark statistics (issue #6)

Closes **Codex top change 3** and **Claude G2, G5, G6, G20**: Sections 8.1, 8.4, 8.6 and 8.7 now specify one primary token endpoint, log-ratio estimand, BCa primary interval, t robustness check, explicit 20% semantics, Holm key secondaries, directional paired correctness non-inferiority and separate power planning (likely UNPROVEN at N 30-50). Also closes token double-counting, cold/warm cache separation, contamination and contention controls, ranked disjoint task sets, pre-freeze personal-project waste measurement, conservative pilot-SD power planning and frozen N, missing-data and failure handling, repeatability model, reliability/accuracy measurement contracts, and credential fault injection with finite-sample zero-event bounds. The task floor and all protocol numbers are design decisions. This revision runs no benchmark, freezes no preregistration and does not assert G0 or any later gate has passed.

### 2026-11-22: R4 control-plane operations (execution plan Section 3.1, item R4; issue #5)

Closes these review gaps: **Claude G7** (exemplar and doc write path missing; corpus seeding undefined) and the **Codex missing-capabilities list** (`docs/reviews/codex-review.md`, "Missing capabilities do not all need new public tools").

- Every control-plane operation assigned one surface (public tool, resource read, admin endpoint, connector operation, CLI) in a single table (Section 3.3).
- Write path: `ref_publish` plus `fleetctl ref seed` from a committed corpus manifest frozen in `bench-prereg-v1` (Sections 3.1, 3.3).
- Brief revisions separated from run records: `brief_revise` is the only versioning write; `brief_record_run` appends to the run table, `run://`, and the change feed without versioning the brief body (Section 3.1, Brief).
- Lessons: flag, quarantine, release (`recall_quarantine`), correct (`recall_learn` with `supersedes`), revoke (admin endpoint) (Sections 3.1, 3.3).
- Fleet events, session status, worker death, tokens, allowlist, sync reconciliation, file artifacts, render cancellation specified (Section 3.3).
- Tools added (33 to 45): `ref_publish`, `doc_what_changed`, `pr_get`, `pr_list`, `recall_quarantine`, `brief_list`, `brief_revise`, `fleet_list_jobs`, `verify_list_checks`, `verify_render_cancel`, `handoff_set_status`, `bench_tag_session` (Appendix A).
- "Anything not listed is out" bounded to the agent-facing API; implementation necessities are not prohibited (Section 9.1).

### 2026-11-22: R3 auth rewrite (issue #4)

Closes **Codex ranked risk 3** (unauthorized corpus or credential exposure) and **Claude G16** (coarse read scope exposes fleet state): Section 6 specifies tenant/namespace ownership through cache, feed, history and blob access; per-operation capabilities and complete resource allowlists; D1 caller-token verifiers with a Worker HMAC key; generation, lookup, expiry, rotation overlap and active-work revocation; identity-bound sync and owned preflight profiles; audit ownership, field allowlists and retention; provenance-marked capped lesson data and enforced quarantine. Section 4.1 makes ownership part of every entity key. Section 3.3 uses the replacement capabilities. Assumption: this is a Phase 0 specification, not an implementation or a passed G0; security behavior remains UNPROVEN until independent real-surface isolation, lifecycle and quarantine acceptance after the build.
