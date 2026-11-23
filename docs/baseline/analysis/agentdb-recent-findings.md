# AgentDB + recent sessions: measured pain points and waste

Date of measurement: 2026-11-22. All reads were done on the Studio via
`~/workspace/scripts/studio-ssh.sh`, read-only. SQLite files were opened with
`mode=ro`. The one exception to strict read-only: the task asked for
`agentdb recall` queries, and recall bumps `hit_count` on matched learnings by
design (9 queries run from `~/VaultsInternal`).

## Headline numbers

| Measure | Value | Source |
|---|---|---|
| agentdb learnings, live DBs | 4,628 rows in 62 queryable DBs (4,596 distinct insights) | `~/VaultsInternal/**/_meta/agentdb/agent.db` |
| agentdb files with stale schema | 15 of 77 (13 lack `archived_at`, 2 lack the `learnings` table) | same scan |
| agentdb errors tables | Dead: last write 2026-09-03 to 2026-09-12 across root, TBS, nexus-office | `errors` table `MAX(ts)` |
| `agentdb recall "workday"` | 0 matching learnings | recall, 2026-11-22 |
| Claude sessions, Nov 18-22 | 224 top-level sessions, 122.7 MB | `~/.claude/projects/` |
| Claude sample (9 largest) | $16.74, 291 tool calls, 15 errors (5.1%), 23.5M cache-read tokens | `cost-state` lines in each JSONL |
| Within-session repeats, Claude | 0 repeated bash commands; 3 extra repeated file reads | same 9 sessions |
| Codex rollouts, Nov 18-22 | 152 (71 image jobs, 81 other); Nov 18 alone had 89 | `~/.codex/sessions/2026/11/` |
| Codex sample (5 non-image) | 193 shell commands, 189 distinct; `vaults` is 167 of the command starts | rollout JSONL `exec` inputs |
| Runner attempts, Nov 15-22 | 1,056 attempts on 568 tasks; 488 re-attempts (46%) | `~/Library/Application Support/runner/runner.sqlite` |
| Runner non-done attempt time | 735,853 s (204 h, 49.5% of all attempt wall time) | `attempts` table |
| Runner worker deaths (`machine`) | 77 attempts on 44 tasks | `attempts.outcome` |
| Runner 4 h timeouts | 27 attempts, all failed, about 108 h burned | `attempts`, `ATTEMPT_TIMEOUT_S = 14400` |
| Preemption storm | 1 task preempted 112 times in 35 min (Nov 16, 20:52-21:27 PST) | `attempts`, task 393 |
| Verification failures | 48 attempts failed verification after claiming done (+3 tool errors) | `attempts.summary` |
| Intake drops | 93 refs; 10 dropped for a missing Acceptance heading | `dropped_refs` |
| Test dirs in live attempts dir | 1,264 of 2,320 workdirs are test artifacts (382 MB total) | `~/Library/Application Support/runner/attempts/` |

## 1. agentdb

### Store shape

- `agentdb` is a bash wrapper at `/Users/slowember/.local/bin/agentdb`. It finds
  the project root by walking up from the working directory for `_meta/` or
  `.claude/`, and opens `<root>/_meta/agentdb/agent.db`. There is no single
  global DB; every repo has its own.
- `~/Developer/Vaults` is a symlink to `~/VaultsInternal` (confirmed by
  `readlink` and identical md5 of both paths), so counts that include both
  paths double-count. All numbers below are deduplicated by real path.
- 77 unique `agent.db` files exist under `~/VaultsInternal`. 15 cannot be
  queried with the current schema: 13 lack the `archived_at` column
  (pre-migration-014: armature, company-site, intelligence-architecture,
  latent-diagnostics, llm-bench, modelmind-site, neural-polygraph,
  poetrytracker, the-agent-library, the-correction,
  CollabVault/content/instagram, CollabVault/content/our4cuts,
  /Volumes/Vaults4TB/Projects/ariacam) and 2 have no `learnings` table at all
  (job-technicals/nunchi-config, CollabVault/self/introspect). The memory
  store itself has schema drift no migration sweep has fixed.

### Counts

- 62 queryable live DBs hold 4,628 live learnings, 4,596 distinct after
  normalizing text (lowercase, punctuation stripped). Including the Oct 18
  backup snapshot at `~/agentdb-ingest/agentdb-before-requests.sqlite`
  (1,068 learnings), the total is 5,739 rows across 63 files: 968 failure,
  2,670 gotcha, 1,957 pattern, 98 preference, 1 design; 5,694 live, 45
  archived.
- Largest DBs (`agentdb status` from `~/VaultsInternal` agrees with the
  direct count):
  - thinking-brain-school: 1,643 total, 1,610 live (396 failure, 826 gotcha,
    366 pattern, 22 preference), 556 error rows.
  - VaultsInternal root: 1,144 total, 1,137 live (170 failure, 493 gotcha,
    440 pattern, 34 preference), 447 error rows, 26,888 total recall hits.
  - tbs-www: 265, all live (31 failure, 180 gotcha, 54 pattern).
  - nexus-office: 188, all live (30 failure, 97 gotcha, 54 pattern,
    7 preference).
  - CodingVault root: 180, all live.
- Recent (recorded since the Oct 13 reinstall): root 221 (6 failure,
  75 gotcha, 123 pattern, 17 preference); TBS 97; tbs-www 177 of 265
  (67% post-reinstall, 146 of them gotchas); nexus-office 68. The store is
  actively written; tbs-www is the most active per row.
- Never recalled (`hit_count = 0`): root 81 of 1,137 (7%); TBS 85 of 1,610
  (5%); tbs-www 20 of 265 (8%); nexus-office 20 of 188 (11%); CodingVault
  root 24 of 180 (13%). Most lessons do get recalled at least once.
- Lessons containing "never": root 213 of 1,144 (19%); TBS 104 of 1,643
  (6%); tbs-www 1; nexus-office 8.

### Duplication: verbatim re-recording is rare; recurrence is by failure class

- No exact duplicates exist inside any single DB (0 exact-duplicate groups in
  every DB with 30+ learnings, including the root and TBS DBs).
- Across DBs, only 11 duplicate groups (30 rows) survive once the Oct 18
  backup snapshot and the `VaultsInternal/_meta/_meta` mirror DB are
  excluded. Most are a seed set copied into project DBs at init, e.g.
  "Email design principles: specificity (names/numbers/attributions), grid
  layouts for metrics, cross-domain collision detection, night questions for
  subconscious processing" and "Worktree parallelism dangerous on shared
  files: agents contaminate each other's working tree" each appear in 6 DBs
  (CodingVault root, augur, kernel-claude, lhcr, modelmind, CollabVault).
- The real recurrence signal is the same failure class recorded as separate
  lessons after separate incidents (see below), not the same text twice.

### The errors tables are dead

- Root DB `errors`: 447 rows, latest 2026-09-04. TBS DB: 556 rows, latest
  2026-09-12. nexus-office DB: 69 rows, latest 2026-09-03. Zero errors
  recorded since 2026-11-08 in any of them. The error-recording path stopped
  in early September while `learn` kept working, so the store records
  conclusions but no longer records the raw errors they came from.

### Recall results (run 2026-11-22 from `~/VaultsInternal`)

- `gh issue`, `deploy`, `vercel`, `lesson`, `tbs`, `runner`, `auth`, `token`:
  each returned 6 to 8 top hits.
- `workday`: "(no matching learnings)". The Etsy Workday application flow has
  no recorded lessons at all, a coverage gap for a live, high-stakes flow.

### Recurring gotchas, with quotes

Auth and OAuth expiry, the most repeated class. Separate lessons record the
same failure on different days and systems:

- "Default ~/.claude headless OAuth expires (claude auth status
  loggedIn=false); scheduled claude -p jobs fail. Keychain item
  claude-setup-token (sk-ant-oat) works via CLAUDE_CODE_OAUTH_TOKEN"
  (news-ingest web_search_failed 2026-11-20).
- "kernel-skills-sync rc1 2026-11-20 = default claude OAuth expired; fixed
  with keychain claude-setup-token like news-ingest. Other claude -p jobs
  likely need the same." Two jobs, same day, same fix, recorded as two
  lessons.
- "HeyGen has NO API key by design: it runs on the MCP rail ... Aria
  2026-09-22: we keep forgetting and calling a missing HEYGEN_API_KEY a
  blocker."
- "codex-lane headless runs failing NOW with 'refresh token was already
  used' - the ~/.codex-cli headless OAuth is stale again".
- "puzzle-forge/tiredlillies Cloudflare deploy: both keychain wrangler
  tokens (default, matra) are dead - re-auth via wrangler login OAuth, not
  a static token".
- Root-DB keyword counts (substring counts, so upper bounds): oauth 25,
  keychain 13, login 10, credential 9, expired 7.

Silent success, exit 0 with nothing done (root DB: 'silent' in 72 insights,
'exit 0' in 11):

- "claude -p --setting-sources user is CONDITIONAL, not wrong. It drops
  local-scope MCP servers entirely, so a job needing an MCP tool exits 0
  having done nothing". This was recorded three times: two contradictory
  lessons (one said always pass the flag, one said never) and a third
  resolving them.
- "Never pipe a long deploy through tail: without 'set -o pipefail' the
  pipeline exit status is tail's, so a crashed deploy reports exit 0".
- "Daily podcast outage 2026-09-06..09-11 was a deliberate pause left in
  code ... launchd job exited 0 nightly and two schedule fixes could not
  fix it".
- "issue-pipeline dispatch.sh holds ONE GLOBAL lock ... a second run exits 0
  with only a log line".

gh CLI foot-guns:

- "gh api -f body=@file does NOT read the file: it sets the literal string
  '@file'. Patching issue/comment bodies that way writes a 14-byte body".
- "gh issue list --search 'marker in:body' cannot be used for idempotency:
  GitHub's search index lags issue creation by minutes ... It duplicated
  two issues into a client's production org on first real use."
- "GitHub issues list lags a just-created issue by ~30s".
- "Merged the wrong nexus-office PR (#223, a review-FAILed #191) by
  predicting the next PR number instead of using the URL gh pr create
  returned".

Deploy and verify gaps. The single most cross-cutting lesson, surfacing in
the `deploy`, `vercel`, and `lesson` recalls:

- "Piping release-controller stage through tail hides a failed Vercel build;
  exit 0 is the pipe's. Check deployment state (readyState) or the
  deploy.json receipt."
- "tbs preview hub: Vercel refuses a deploy over 500 MB total; copying
  HomeClass lesson directories (videos, images, assets) into dist hit
  732 MB."
- "Vercel cleanUrls owns .html AND .md ... Cost an hour of misdiagnosis on
  SPA L016".
- "Repo-tree absence is not system absence: HomeClass 'missing' cover videos
  were a deliberate 2026-07 cutover ... Cost 6 wrong answers in one
  session."
- "preview-hub revision routes are LNNNvN (L024v2), so re.sub(r'\D','',
  lesson) reads L024v2 as lesson 242 ... Cost 20 broken images that I had
  already reported as fixed".

Practices that kept happening after the lesson was written:

- "Worktrees have NEVER produced merged work here: 60 worktree branches
  across urban-atlas, 949 commits, zero merged to main, 33GB disk,
  42 permanently-dirty parent entries".
- "never wrap load-bearing queries in 2>/dev/null || true without reporting
  degradation: both historical agentdb recall outages ... were hidden this
  way". The lesson exists because the pattern recurred twice before it was
  written.

Most-recalled single lessons (hit counts): mlx_lm.server harmony-parser
gotcha, 674 hits; Buzz relay push gotcha, 653; TBS "Issue 350 HomeClass quiz
implementation blocked by dirty canonical tbs-homeclass checkout", 403.

## 2. Recent Claude sessions

### Census

- 224 top-level session JSONLs under `~/.claude/projects/` modified Nov 18-22,
  122.7 MB total (subagent sessions and the repetitive
  `office-feed-images-work` project dirs excluded from the sample, not from
  this census count of top-level files). Per day: Nov 18: 86, Nov 19: 30,
  Nov 20: 51, Nov 21: 37, Nov 22: 20. Nov 18 was a spike day in both Claude
  and Codex.

### Sample: 9 largest substantial sessions, Nov 18-22

| Session (project, date) | Bytes | Tool calls | Errors | Cost | Wall time | Cache-read tokens |
|---|---|---|---|---|---|---|
| nexus-office 270b4789, Nov 18 (site v2 #1170) | 9.3 MB | 43 | 1 | $1.91 | 596 s | 1.41M |
| VaultsInternal 6352d56d, Nov 18 (Office chat) | 8.2 MB | 71 | 4 | $4.36 | 1,689 s | 7.12M |
| nexus-office 9e0c730f, Nov 20 (site #1199) | 2.4 MB | 8 | 0 | $0.51 | 155 s | 0.40M |
| VaultsInternal ba2cb628, Nov 21 (Office chat) | 2.3 MB | 59 | 2 | $2.56 | 1,458 s | 4.58M |
| tradition-harness b70bb60d, Nov 18 (verification, no tools) | 1.7 MB | 0 | 0 | $0.28 | 29 s | 0.27M |
| tradition-harness 54d03d86, Nov 18 (#21) | 1.7 MB | 51 | 1 | $4.24 | 7,759 s | 7.24M |
| CollabVault 93f935b4, Nov 18 (distillation scrape) | 1.2 MB | 35 | 5 | $1.61 | 210 s | 1.13M |
| bwon-membership 12f2e8df, Nov 20 (#3) | 1.1 MB | 16 | 1 | $0.75 | 96 s | 0.74M |
| VaultsInternal cdbe36f2, Nov 22 (cross-vault report) | 0.9 MB | 8 | 1 | $0.51 | 67 s | 0.62M |
| **Total** | **28.8 MB** | **291** | **15 (5.1%)** | **$16.74** | **12,058 s** | **23.5M** |

Costs and token counts come from each file's `cost-state` line (authoritative
per-session totals). Output tokens across the 9 sessions: about 215k. The
cost driver is context re-reads (23.5M cache-read tokens), not output.

### What the sample shows

- Tool time dominates wall time: 9,097 s of tool time out of 12,058 s wall
  (75%). The tradition-harness #21 session ran 7,759 s (2.2 h) with 6,522 s
  of tool time and only 51 tool calls: the session spent its life waiting on
  tools, not thinking.
- Tool mix: Bash 201 of 291 calls (69%), Read 53 (18%), Write 20, Edit 9,
  WebFetch 6, Glob 1, ToolSearch 1. Nearly everything goes through the shell.
- Within-session repetition is essentially zero: 0 repeated bash commands
  across all 9 sessions, 3 extra repeated file reads total (one file read
  twice in each of 3 sessions). The waste is not inside sessions; it is
  across sessions and across attempts (section 4).
- `gh` appears in only 8 of 201 bash commands (4%), because the runner brief
  embeds the issue text. `agentdb recall` ran in only 3 of the 9 sessions
  even though the runner brief instructs it before starting every task
  (`agent.py` AGENTDB block). The memory path is instructed but often
  skipped.
- The verification session b70bb60d (1.7 MB, 26 s, 0 tool calls, $0.28,
  274,945 cache-read tokens) consumed a large injected context and did no
  tool work at all: pure context cost for a read-only verdict.
- The two Office chat sessions (6352d56d, ba2cb628) cost $4.36 and $2.56
  with zero lines added or removed: long interactive sessions whose cost is
  almost entirely context re-reads.

### Cost bound

The 9 sampled sessions are the largest of 224, so their $1.86 average cost
is an upper bound on the average session, not an estimate. A hard upper
bound on the week's Claude cost for these 224 sessions is 224 x $1.86, about
$417; the true figure is lower, and it excludes subagent sessions.

## 3. Recent Codex sessions

### Census

- 152 rollout files under `~/.codex/sessions/2026/11/18` through `11/22`:
  71 with an `office-feed-images` working directory (47%), 81 other.
  Per day: Nov 18: 89, Nov 19: 11, Nov 20: 19, Nov 21: 18, Nov 22: 15.
  Recent rollouts are plain `.jsonl`; older ones are `.jsonl.zst`
  (`zstd` is available at `/opt/homebrew/bin/zstd`).

### Sample: 5 largest non-image sessions, Nov 18-20

| Session (cwd, date) | Bytes | Tool calls | Input tokens (cached) | Span |
|---|---|---|---|---|
| maerai-production, Nov 20 | 26.3 MB | 17 | 1.47M (1.37M) | 1.2 h |
| CodingVault, Nov 18 05:55 | 8.8 MB | 70 | 10.73M (10.57M) | 24 min |
| VaultsInternal, Nov 18 15:47 | 8.7 MB | 50 | 10.82M (10.33M) | 8.9 h |
| CodingVault, Nov 18 06:02 | 5.7 MB | 26 | 2.61M (2.52M) | 5 min |
| VaultsInternal, Nov 20 18:25 | 5.8 MB | 28 | 2.37M (2.27M) | 13 min |
| **Total** | **55.3 MB** | **191** | **28.0M (27.0M)** | |

Token figures are cumulative per-turn input from `token_usage_record`
entries: each turn re-reads the full context, so 28.0M is cumulative context
processed, not unique tokens. Output tokens total 81,697; reasoning tokens
16,248. Rollouts carry no cost field, so no dollar figure is available for
Codex.

### What the sample shows

- Every tool call goes through the `exec` custom tool (171 calls) plus a few
  function calls (`wait`, `spawn_agent`, `followup_task`, `send_message`).
  The `exec` input is a JS-ish string wrapping
  `tools.exec_command({cmd:"..."})`; commands were extracted from the `cmd`
  values.
- 193 shell commands extracted, 189 distinct. Repeats within sessions: 4
  extra calls total (a k-coffee UI script run twice, a Playwright script run
  twice, `python3.12 -m runner status` run 3 times in one session). Same
  finding as Claude: within-session repetition is near zero.
- Command starts (compound commands split on `;`, `&&`, `||`): `vaults` 167,
  `tbs` 34, `python3` 33, `gh` 22, `rg` 21, `python3.12` 12. The `vaults`
  CLI (read/find/ctx) is the dominant interface; it is a shell wrapper
  around file search and read, exactly the shape a file-context MCP server
  would replace.
- `vaults read` of the same file across sessions: the top files were read
  5x (`findings/lesson-parent-use-review-1822.md`), 4x
  (`client/office_ask.py`), and 3x each for five more files, across just
  5 sampled sessions. Cross-session file re-reads are the norm.
- `gh` appears in 12 of 193 commands (6%); `agentdb recall` in 6 of 193
  (3%). Same pattern as Claude: the instructed memory lookup is rare in
  practice.
- The Nov 18 05:55 CodingVault session used `spawn_agent` 3 times and
  `followup_task` 5 times: multi-agent fan-out inside one session.
- The Nov 18 15:47 VaultsInternal session ran 8.9 hours with 50 tool calls
  and 10.8M input tokens: a long supervision-style session, mostly waiting.

## 4. Runner job records

### Schema and window

- Store: `~/Library/Application Support/runner/runner.sqlite` (1.9 MB).
  Tables: `tasks` (id, source, ref UNIQUE, title, body_hash, repo, state,
  attempts, note, updated, size, options, priority, prio_reason, created,
  owner), `attempts` (id, task_id, started, ended, outcome, log_path,
  summary, pid, result_path, account), `decisions`, `runs`, `asks`,
  `dropped_refs`. Code: `~/VaultsInternal/CodingVault/nexus-office/runner/`
  (`intake.py` 206 lines, `loop.py` 603, `store.py` 130, `agent.py` 171).
- Window: the DB covers the post-cutover period only. First attempt
  2026-11-15 18:31:35 PST, last 2026-11-22 12:55:44 PST: 6.8 days.
- Config: `~/Library/Application Support/runner/config.json`: 12 workers,
  1 reserved, intake repos `ariaxhan/muse-asks` plus 8 workspace `.nexus.py`
  collectors, 9 skipped refs.

### Tasks and attempts

- 726 tasks: done 451 (62%), retired 210 (29%), blocked 48 (7%), hold 16
  (2%), running 1, queued 0 at snapshot time. By repo: TBS 214, tbs-www 170,
  nexus-office 70, muse-asks 64, tbs-care 52, tbs-homeclass 34, Vaults 31,
  city-foundry-app 17, tradition-harness 15, paper-rooms 14.
- 1,056 attempts on 568 distinct tasks. Outcomes: done 529 (50%), blocker
  164 (16%), failed 143 (14%), preempted 113 (11%), machine 77 (7%), retired
  24 (2%), verification-tool 3, stalled 2, in flight 1.
- Attempts per task, from the attempts table (authoritative): 1 attempt:
  373 tasks; 2: 120; 3: 35; 4: 13; 5: 9; 6: 8; 7: 3; 8: 2; 10: 2; 11: 1;
  12: 1; 113: 1. So 195 tasks (34% of tasks that ran) needed 2 or more
  attempts, and re-attempts beyond the first total 488 (46% of all
  attempts). Note: the `tasks.attempts` counter understates this (it sums
  to 713, not 1,056) because `preempt()` decrements it on every preemption
  (`loop.py`, preempt); do not use the counter for re-attempt counts.
- Every re-attempt pays a full context reload: `Runner.start()`
  (`loop.py`) calls `self.issue(t['ref'])` (a fresh `gh issue view`,
  `agent.py:82`) and rebuilds the whole brief with `agent.prompt()`
  (live issue body up to 12,000 chars, last 8 comments, `primary_state()`
  git fetch/status/log, plus the fixed MUSE/AGENTDB/LAND/RESULT
  boilerplate). `start()` does pass the previous attempt's outcome, summary,
  and log tail, but the worker is a fresh agent reading the same issue and
  repo state from scratch. Countable handoff waste: 488 re-attempts, each
  one a fresh issue fetch plus prompt rebuild.

### Worker deaths (outcome `machine`): 77 attempts, 44 tasks

- `machine` means the agent ended with no result JSON, or the spawn failed
  (`loop.py` poll/finish, recover). Recent examples from attempt summaries:
  - `ariaxhan/nexus-office#1199`: "agent ended (signal 15) with no result
    JSON" after the log shows "Deployment complete!" The deploy had
    succeeded; the kill came before the result JSON was written, so the
    work was done but the attempt counted as dead and the task requeued.
  - `Thinking-Brain-School/tbs-www#1688`: signal 15, "stream disconnected
    before completion: IO error: Broken pipe".
  - `ariaxhan/Vaults#893`: signal 15 with a git `index.lock` conflict.
  - `ariaxhan/our4cuts#319`, `#322`, `ariaxhan/nexus-office#1185`:
    "Failed to authenticate: OAuth token revoked" / "OAuth session expired
    and could not be refreshed". 10 attempt summaries mention OAuth or
    authentication failures.
  - `ariaxhan/muse-asks#16`: 6 attempts, all `machine`, all "spawn failed:
    [Errno 2] No such file or directory:
    '/Users/slowember/VaultsInternal/CodingVault/muse-asks'". The missing
    checkout was retried 6 times, 3 of them within about 2 minutes, with no
    backoff and no learning between retries.

### The preemption storm: 112 kills of one task in 35 minutes

- `ariaxhan/Vaults#877` (priority 4) was launched and preempted 112 times
  between 2026-11-16 20:52:18 and 21:27:11 PST, then completed on its 113th
  attempt. Its 113 attempts together consumed 2,398 s (about 21 s per
  attempt on average). The `tasks.attempts` counter for it reads 1.
- Only 2 tasks were ever preempted: Vaults#877 (112 times) and Vaults#875
  (once). All 113 preemptions in the week are this one storm plus one.
- Preempted attempts are cheap individually (5,346 s total across 113
  attempts, about 47 s each) because preemption hits young attempts, but
  each cycle still paid a spawn, a fresh `gh issue view`, and a full prompt
  build, 112 times in 35 minutes. `preempt()` (`loop.py`) kills a running
  P4 agent for a queued P0; the victim requeues and can be picked again.

### Timeouts and long jobs

- `ATTEMPT_TIMEOUT_S = 4 * 3600` (`loop.py:90`). 27 attempts ran to
  14,390 s or more and all failed: about 108 hours of agent compute burned
  on timeouts. The 10 longest attempts are all 14,405-14,409 s and all
  `failed`.
- 113 attempts ran over 1 hour (11%); 41 over 3 hours (4%). Mean finished
  attempt: 1,409 s (23.5 min). Max: 14,409 s.
- Wall time by outcome (1,055 finished attempts, 1,486,870 s = 413 h):
  done 751,017 s (209 h, 51%); failed 504,372 s (140 h, 34%); blocker
  101,255 s (28 h, 7%); machine 50,802 s (14 h, 3%); retired 41,705 s
  (12 h, 3%); verification-tool 16,327 s (5 h); stalled 16,046 s (4 h);
  preempted 5,346 s (1 h).
- Non-done outcomes total 735,853 s (204 h, 49.5% of all attempt wall
  time). Excluding `blocker`, which is a legitimate outcome (the work
  correctly identified as blocked), failed + machine + retired +
  verification-tool + stalled + preempted total 634,598 s (176 h, 43%).

### Verification failures: 51 attempts

- 48 attempts carry summaries starting "verification failed" and 3
  "verification tool failed". `verify()` (`loop.py:204`) runs on every
  done claim: the commit must be on origin/main, the live URL must serve
  the expected text, and the evidence must include a fresh PNG captured
  during that attempt. Each failure sends the task back for another full
  attempt. Verification does not repeat within an attempt (one verify per
  done claim by code reading); it repeats across attempts.
- `tracker_baseline()` (`loop.py`) exists because issue #1116 "was split 8
  times": a re-split loop that has since been fixed by hashing the tracker.

### Intake drops: 93 refs

- `dropped_refs`: hold label 63, missing Acceptance / Done when heading 10,
  hold label blocked 10, hold title 6, blocked+hold 2, parked 1,
  needs-aria/on-hold 1. The 10 missing-Acceptance drops are the known
  intake gap: `has_acceptance()` (`intake.py:34`) requires both an
  Acceptance heading and an unchecked checkbox, and `drop_reason()`
  (`intake.py:38`) silently files the rest into `dropped_refs`.

### Scheduled runs and accounts

- `runs`: 5,651 rows. Return codes: 0: 5,503 (97%); 1: 87; -9 (SIGKILL):
  36; 2: 20; NULL: 3; -1: 2. So 36 scheduled runs were SIGKILLed in the
  week on top of the attempt-level deaths.
- Attempts by account: tbs-claude 288, tbs-codex 277, personal-codex 213,
  personal-claude 191, blank 87.

### Attempt workdirs: half are test artifacts

- `~/Library/Application Support/runner/attempts/` holds 2,320 dirs,
  382 MB total. Each real attempt gets one dir (`agent.log`, `prompt.txt`,
  `result.json`, `schema.json`).
- 1,264 dirs have no attempt row: 1,152 contain the test prompt "You own
  one task end to end: o/a#1" (repo `o/a`, checkout `/tmp`) and 112 contain
  a 1-byte `prompt.txt` holding just "p". Both are runner test-suite runs
  writing into the live attempts directory. The remaining 1,056 dirs match
  the 1,056 attempt rows exactly.

## 5. What this grounds for MCP server ideas

Each candidate below is tied to a measured count above, not to a hunch.

1. GitHub state MCP (issues, comments, PRs, with caching). Evidence: every
   runner attempt re-fetches the same issue fresh (`gh issue view` in
   `start()`), 488 re-attempts in 6.8 days; gh CLI foot-guns are among the
   most-recalled lessons (search-index lag duplicated issues into a client
   org; `gh api -f body=@file` writes a 14-byte body; issue-list 30 s lag).
   A stateful tool that serves cached issue state and takes structured
   writes would cut both the re-fetch cost and the CLI foot-gun class.
2. agentdb as a real MCP tool, not a shell call. Evidence: recall is
   instructed in every runner brief but ran in only 3 of 9 sampled Claude
   sessions and 6 of 193 sampled Codex commands; the errors table has had
   no writes since early September; 15 of 77 DBs have stale schema. The
   memory system is used less than instructed and its health is
   unmonitored. A recall/learn tool with usage telemetry and schema health
   would make the path actually traveled and observable.
3. Credential freshness preflight. Evidence: OAuth expiry is the top
   recurring failure class in agentdb (two separate lessons on 2026-11-20
   alone for the same claude OAuth expiry) and killed 10 runner attempts
   in the week; the HeyGen and wrangler token lessons record the same
   class across months. A preflight check that verifies each account's
   credential before launch would prevent dead attempts instead of
   recording them afterwards.
4. Deploy and live-state MCP (Vercel/Cloudflare status, rendered checks).
   Evidence: 48 attempts failed verification after claiming done; the
   most cross-cutting agentdb lesson is the Vercel readyState check;
   Vercel 500 MB and cleanUrls lessons each cost hours; agents probe
   deployments with curl/grep pipelines (visible in the sampled sessions).
   A structured deploy-status and live-check tool would replace the
   probing and catch the readyState class before the verify step.
5. Runner state MCP (jobs, attempts, status). Evidence: `python3.12 -m
   runner status` was re-run 3 times inside one sampled Codex session;
   workers poll runner state through the CLI; the attempts table already
   holds the structured data (outcomes, durations, summaries) that agents
   currently re-derive by reading logs. Structured job and attempt reads
   would cut the polling and make the 488 re-attempts visible to the next
   worker without a log-tail paste.

## 6. Bounds and what could not be measured

- Dollar cost of runner attempts: not measurable from available records.
  `runner.sqlite` has no cost or token column, and attempt logs were not
  parsed (1,056 logs). The 176 h of failed/dead/preempted/retired attempt
  time is a wall-time figure only.
- Dollar cost of Codex sessions: rollouts carry no cost field. Only the
  token counts in section 3 are available.
- Claude weekly cost: bounded above at about $417 for the 224 top-level
  sessions (sample average $1.86 x 224), but the sample is the largest
  sessions, so the true figure is lower; subagent sessions are excluded.
- Repeated verification steps within a single attempt: not observed. By
  code reading, `verify()` runs once per done claim per attempt; the
  repetition is across attempts (48 verification failures, each followed
  by a fresh attempt and a fresh verify).
- Whether re-attempt workers re-read the same PRs (as opposed to issues):
  not counted. The brief includes the issue and its last 8 comments; PR
  re-reads would need attempt-log parsing.

## Appendix: exact sources

- agentdb CLI: `/Users/slowember/.local/bin/agentdb` (bash; DB at
  `$PROJECT_ROOT/_meta/agentdb/agent.db`).
- agentdb counts: direct sqlite queries over all realpath-deduplicated
  `agent.db` files under `/Users/slowember/VaultsInternal`, plus
  `~/agentdb-ingest/agentdb-before-requests.sqlite`; `agentdb status` and
  `agentdb recall` from `~/VaultsInternal`.
- Claude sessions: `~/.claude/projects/` JSONL files listed in section 2;
  per-session cost from each file's `cost-state` line.
- Codex sessions: `~/.codex/sessions/2026/11/{18,20}/rollout-*.jsonl`
  listed in section 3; commands extracted from `custom_tool_call` inputs
  (`exec_command({cmd:"..."})`).
- Runner: `~/Library/Application Support/runner/runner.sqlite` (tables
  `tasks`, `attempts`, `dropped_refs`, `runs`) and
  `~/VaultsInternal/CodingVault/nexus-office/runner/{intake,loop,store,
  agent}.py`, plus `~/Library/Application Support/runner/config.json` and
  `.../runner/attempts/`.
