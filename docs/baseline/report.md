# Where an MCP server would have helped: measured waste in the Studio agents' transcripts, and the portfolio servers to build from it

Date: Nov 22, 2026. All numbers below are measured from the transcript archive and the live repos, not from memory. Where a number is a lower bound, it says so. Where an experiment could not run, it says why.

## How this was measured

Sources:
- Claude session JSONLs in `~/workspace/user/transcript-archive/studio/claude-projects/`: 12 substantial sessions sampled (the largest main sessions, not subagent files), 359 MB total, 8,787 tool calls, spanning Sep 11 to Sep 28, 2026. Parsed with a Python script that counts tool calls by type, repeated file reads, repeated bash commands (normalized), gh invocations, sqlite3 invocations, Playwright launches, sleep/poll commands, and agentdb calls. Script: `/tmp/claude_waste_analysis.py` (output in `/tmp/claude_waste_out.txt`).
- Antigravity agy-lane records in `~/workspace/user/transcript-archive/studio/agy-lanes/`: all 134 lanes with prompts (542,897 prompt bytes) plus a 10-lane deep sample. No tool-call trace exists in these sources, so the measurement counts prompt/output text repetition, file references, and duplicate runs. Full findings: [analysis/antigravity-findings.md](sandbox://workspace/goals/full-time-job-in-new-york-city/files/mcp-server-ideas/analysis/antigravity-findings.md).
- Codex rollouts in `~/workspace/user/transcript-archive/studio/codex-sessions/`: the 12 largest of 936 rollout files, 1.33 GB, 100,921 JSONL lines, 156.3 hours of combined session span, 307 turns, Sep 6-24, 2026. All work in these sessions flows through one `exec` tool wrapping shell commands; file reads happen through `vaults read` / `cat` / `sed`. Counts were verified by independent strict-JSON recounts (S1 `vaults ctx` 54 = 54; S5 `gh issue view 179` 12 = 12). Full findings: [analysis/codex-findings.md](sandbox://workspace/goals/full-time-job-in-new-york-city/files/mcp-server-ideas/analysis/codex-findings.md).
- agentdb + recent Studio sessions + runner records (live, Nov 22): the agentdb store on the Studio (77 `agent.db` files under `~/VaultsInternal`, deduplicated by real path; `~/Developer/Vaults` is a symlink to `~/VaultsInternal`, so naive scans double-count); 224 Claude sessions Nov 18-22 (`~/.claude/projects/`, 122.7 MB, sample of 9 largest); 152 Codex rollouts Nov 18-22 (`~/.codex/sessions/`, sample of 5 largest non-image); the runner's `runner.sqlite` (Nov 15-22, 6.8 days, 1,056 attempts). Full findings: [analysis/agentdb-recent-findings.md](sandbox://workspace/goals/full-time-job-in-new-york-city/files/mcp-server-ideas/analysis/agentdb-recent-findings.md).
- Benchmark data: pulled live Nov 22 from the repos on the Studio (llm-bench, model-familiarity-engine, kernel-claude) and from the TBS repo records (tutor launch gate, Teaching MCP sweep). TBS numbers are reported here as project evidence; they are not proposed as site content where the site brief forbids them (see "Proof numbers for the site").

## Part 1: The measured waste

### Claude sessions (12 sessions, 8,787 tool calls)

| Waste pattern | Count | Evidence |
|---|---|---|
| `gh` invocations (any) | 500 | 179 issue views, 97 issue lists, 86 PR ops, across 12 sessions. Top session: 005baab4 with 132 gh calls. |
| Playwright browser launches | 327 | 286 in a single session (a7bb7612, Sep 19-20, lesson screenshot verification). Each launch is a full Chromium start + page load + screenshot. |
| `sleep` commands inside polling loops | 311 | Agents sleeping then re-querying state, instead of subscribing to changes. Top session: a7bb7612 with 113 sleeps. |
| `sqlite3` invocations (hand-written SQL in bash) | 179 | 122 in one session (33b28a67, nexus-office flight supervision), 53 in another (ac61e85d). Each is a hand-crafted query against the ledger database. |
| `vaults wait` / `hcom listen` (wait-for-state calls) | 131 | 70 in one session (48016e93, TBS coordinator). Polling for lane completion and inbox changes. |
| Repeated bash commands (same normalized command, 2+ times) | 109 distinct commands, 358 total calls | Top: a Playwright screenshot command run 20 times; a gh poll loop run 13 times (plus 7 and 6 for variants); a ledger sqlite query run 7 times. |
| Repeated file reads (same file, 2+ times) | 38 files, 90 total read calls | Mostly screenshot PNGs re-read for visual comparison (e.g., `/tmp/shot-engine.png` 5 times, lesson view PNGs 2-4 times each). |
| `git status` / `log` / `diff` / `show` / `fetch` | 148 | 35 status, 42 diff, 38 log, 14 show, 12 fetch, 1 pull. Re-checking repo state by hand. |
| `gh issue` re-fetches of the same issue | 356 total gh issue/PR fetches, 14 unique refs | The same issues re-fetched across sessions (e.g., issues/585 3 times, issues/192, pull/220, pull/224, pull/230 2 times each). The 336 "gh (no number)" fetches are list/search calls that re-pull the same queues. |
| agentdb recall / learn calls | 36 recall, 55 learn | 11 of 12 sessions used agentdb. All via bash (no MCP interface). |

Concrete instances (citable):
- **The gh poll loop** (session 005baab4, Sep 22-23): a single 853-character bash command that loops up to 36 times (3 hours), each iteration running `gh issue list` twice (closed issues + "waiting on Aria" labels) plus `git log` + `git fetch` + `sleep 300`, with a hand-rolled seen-file (`/tmp/claude-501/epic-seen.txt`) for dedup. Invoked 37 times in the session. The session made 132 gh calls total.
- **The ledger queries** (session 33b28a67, Sep 26-28, nexus-office): 118 `sqlite3` queries against `~/Library/Application Support/nexus/ledger.sqlite`, each hand-written SQL checking flight state, plus `ps` checks for process aliveness. One query shape (flight state + timestamp) ran 7 times.
- **The screenshot loop** (session a7bb7612, Sep 19-20, 175 MB, 3,443 Bash calls): 286 Playwright launches in one session, re-rendering lesson pages for visual verification, plus 113 sleep commands and 25 `git diff` calls. The session ran 36 hours (Sep 19 06:47 to Sep 20 19:06 UTC).

### Antigravity lanes (134 lanes, 542,897 prompt bytes)

| Waste pattern | Count | Evidence |
|---|---|---|
| Exact-line repeats in prompt text | 148,020 bytes (27.3% of all prompt bytes) | Lower bound: lines of 40+ characters matching exactly across lanes. Misses short lines and near duplicates. |
| One reference block pasted 8 times | 13,946 bytes x 8 lanes = 111,568 bytes sent, 97,622 redundant | The L042 narration exemplar, byte-identical in 8 narration prompts. |
| One shared brief pasted 4 times | 10,196 bytes x 4 lanes, 30,588 redundant | The Oct 6 anchor-format shared brief; only 8-9 lines per prompt are lesson-specific. |
| Duplicate-task pairs (same job run twice) | 7 pairs | Including 2 pairs with byte-identical prompts where the first attempt produced 0 bytes (keychain abort) and the second re-did the work from scratch. |
| Same lesson re-entered by many lanes | 31 of 42 lessons touched by 3+ lanes | L046 by 16 lanes, L011 by 13, L045/L047/L048 by 9 each. Each lane re-read the lesson files fresh. |
| Per-lane setup repeated | Credential warning in 133 of 133 out.logs; keychain PASS in 129; run line in 129 | Every lane re-establishes the silo from scratch. |
| Re-verification re-reported | 32 lanes carry a Verification section; 59 mention em dash checks; 28 report "Zero em dashes" | The same check battery (JSON parse, em dash grep, `[[COPY` grep, md5) re-run and re-reported per lane. |
| Issue context re-cited | 44 re-citations of issues 585/588/589/587 | #585 cited 4 times in prompts + 17 times across 5 changelogs; #588 12 times; #589 7 times; #587 4 times. |
| CLI auth failures (no login) | 504 identical "not logged into Antigravity" errors across 10 log files | About 40% of all CLI log lines, repeated at every startup Sep 2 to Oct 6. |
| Same canonical docs re-named | AGE-SPLIT.md 20 mentions (10 lanes); L011 content.json 16 (8 lanes); aria-notes + discussion spec + Korean writing guide 12 each (6 lanes each) | Every lane re-establishes the same guidance from scratch. |

### Codex rollouts (12 sessions, 11,655 shell commands, 2,006 file reads)

| Waste pattern | Count | Evidence |
|---|---|---|
| Repeated shell commands (same normalized command, 2+ times) | 1,309 extra executions (11.2% of all commands), across 550 repeated patterns | Worst sessions: S1 (392 extra), S5 (371 extra). |
| No-argument state poll `vaults ctx` | 169 runs | S1: 54, S5: 66, S2: 27, S6: 18. A pure state check with no arguments, re-run every time the agent wants to know where it stands. The clearest MCP-shaped gap in the data. |
| File re-reads (same path, 2+ times) | 858 extra re-reads (42.8% of all reads), across 341 paths | Worst session: S5, 360 re-reads of 650 reads (55.4%). Top files: `nexus/work.py` 30 reads, `client/phone/office.js` 29, `revisions/v10/assets/site.css` 24, `client/office_ask.py` 24. |
| GitHub CLI calls, repeated fetches | 314 calls; 142 extra executions of repeated fetches | 46 distinct issue/PR numbers viewed 2+ times. `gh issue view 179` 12 times and `gh issue view 687` 9 times, both in S5. Concentrated: S5 (143) + S12 (155) account for 298 of 314 calls; 5 of 12 sessions made zero GitHub calls. |
| Context compactions + aborted turns | 76 compactions, 21 aborted turns | S1 compacted 19 times, S5 17 times. No sampled session shows a resume (exactly one `session_meta` per file); the restart points are compactions and aborted turns, not session reopens. |
| Files re-read across a compaction boundary | 209 files | In S5 across the first compaction: `client/phone/office.js` 2 reads before, 27 after; `nexus/work.py` 3 before, 26 after. Compaction throws away context and the agent re-reads the same files to rebuild it. |
| Output tokens re-fed from repeat executions | At least 215,615 tokens | Lower bound: only 561 of the 1,309 repeat executions had attributable output token counts. |
| Shared briefing files re-ingested by parallel lanes | 5 sibling overnight lanes (Sep 23 00:30) each re-read the same brief, ops doc, and skill files | `docs/lesson-ops.md` 9 reads across the five lanes; `_meta/run/overnight-2026-09-22/BRIEF.md` 6 reads across four lanes; `.agents/skills/lesson/SKILL.md` 9 reads across all five. `CLAUDE.md` read 18 times across 11 of 12 sessions. |
| Verification loops re-run end to end | `./tbs lesson gate` 18x + `./tbs lesson locale` 15x for one lesson (S1); `npm run verify:hero` 17x + `npm run verify:v10:promotion` 15x (S2); `npm run verify` 14x (S5) | The same lesson verification loop re-run with no result caching visible in the record. |
| Lane completion polling | `bin/codex-lane await` 14x for one lane (S7); `hcom listen --timeout 1` in S12; 782 `wait`/`wait_agent` calls across the sample | The agent polled lane receipts in 30-second awaits instead of receiving completion events. |
| One-off heredoc scripts (pattern, not counted waste) | 1,673 `python3 -` scripts, almost all distinct | Each re-implements small JSON inspection or comparison inline. The absence of a structured query tool, not repetition. |
| agentdb calls (light in Codex) | 217 total | `agentdb read-start` 5x, `agentdb write-end` 4x, `agentdb recall` 3x as the top repeats. |

Concrete instances (citable):
- **The `vaults ctx` poll** (S1, Sep 23, rollout `2026/09/23/rollout-2026-09-23T20-40-06-01a0d17f-...jsonl`, lines 19, 106, 4048, 5380): a no-argument context/status poll run 54 times in one session and 66 times in S5. Every re-run returns the same kind of snapshot. A live workspace-state resource with change notification replaces this class outright.
- **The S5 re-fetch loop** (rollout `2026/09/24/rollout-2026-09-24T11-46-22-01a0d4bd-...jsonl`): 143 GitHub calls, 85 repeats. The same two issues (179 and 687) were re-fetched 21 times combined; `gh issue view 179` 12 times (lines 6123, 7612, 8049, 8060, 8250). The session also re-read its top files 29, 29, and 24 times.
- **The compaction rebuild** (S5, first compaction at line 1125): after the context was compacted, the agent re-read the same four files 27, 26, 20, and 16 times. Compaction is a restart the agent pays for in re-reads.
- **MCP existed but did not cover the polled surfaces** (S12): the session used `mcp__codex_app__get_usage_limits` 23 times and `mcp__codex_app__automation_update` 6 times, but only for Codex app internals (usage limits, automations), not for repo, GitHub, or vault state. The protocol was there; the servers for the surfaces the agent actually polled were not.

Negative results (what did NOT repeat, also measured):
- Search barely repeats: `vaults find` ran 1,021 times with 1,018 distinct queries; `rg` 811 times with 807 distinct patterns. A search-result cache would barely help.
- GitHub waste concentrates in 2 sessions; 5 of 12 sessions made zero GitHub calls. The GitHub server's value is for coordinator/supervision sessions, not every session.
- Repetition scales with session messiness, not turn count: the tidiest session (S10, package reviewer, 124 turns) had only 21 extra repeat executions, while the messiest (S1, 89 turns) had 392.

### agentdb + recent Studio sessions + runner records

Key shift vs the September samples: within-session repetition in the November sessions is near zero (0 repeated bash commands across 9 recent Claude sessions; 4 extra repeats across 5 recent Codex sessions). The waste moved. It is now across sessions and across attempts: runner re-attempts, cross-session file re-reads, re-fetched issues. The servers in Part 4 address the cross-session and cross-attempt waste, which is now the dominant kind.

#### agentdb (the memory store)

| Measure | Count | Evidence |
|---|---|---|
| Live learnings | 4,628 rows in 62 queryable DBs (4,596 distinct insights) | 77 `agent.db` files total; 15 with stale schema (13 lack `archived_at`, 2 lack the `learnings` table). Largest: TBS 1,610 live, VaultsInternal root 1,137 live, tbs-www 265, nexus-office 188. |
| Errors tables | Dead: last write Sep 3-12 | Root 447 rows (latest Sep 4), TBS 556 (Sep 12), nexus-office 69 (Sep 3). Zero errors recorded since Nov 8. The store records conclusions but no longer records the raw errors they came from. |
| `agentdb recall "workday"` | 0 matching learnings | A coverage gap for a live, high-stakes flow (the Etsy Workday application). |
| Verbatim re-recording | 0 exact duplicates inside any DB | Recurrence is by failure class, not by text. Only 11 duplicate groups (30 rows) across DBs, mostly a seed set copied at init. |
| OAuth expiry (top recurring failure class) | Two separate lessons on Nov 20 alone for the same claude OAuth expiry | Root-DB keyword counts: oauth 25, keychain 13, login 10, credential 9, expired 7. Also HeyGen (no API key by design, repeatedly called a blocker) and dead wrangler tokens. |
| Silent success (exit 0, nothing done) | 72 root-DB insights mention "silent"; 11 mention "exit 0" | The `claude -p` MCP flag lesson was recorded 3 times (two contradictory, one resolving). A deploy piped through `tail` reports exit 0 when the deploy crashed. |
| gh CLI foot-guns | 4+ recorded lessons | `gh api -f body=@file` writes a 14-byte body; search-index lag duplicated issues into a client org; issue-list lags a just-created issue by about 30 s; merged the wrong PR (#223) by predicting the next PR number. |
| Never recalled | 5-13% per DB | Root 81/1,137 (7%); TBS 85/1,610 (5%); tbs-www 20/265 (8%); nexus-office 20/188 (11%); CodingVault root 24/180 (13%). Most lessons do get recalled at least once. |
| Most-recalled single lessons | 674, 653, 403 hits | mlx_lm.server harmony-parser gotcha 674; Buzz relay push gotcha 653; TBS issue 350, 403. |

#### Recent Claude sessions (Nov 18-22): 224 sessions, 122.7 MB; sample of 9 largest

| Measure | Count | Evidence |
|---|---|---|
| Cost (9 sessions) | $16.74 | From each file's `cost-state` line (authoritative per-session totals). |
| Tool calls | 291 | Bash 201 (69%), Read 53 (18%), Write 20, Edit 9. Nearly everything goes through the shell. |
| Errors | 15 (5.1%) | |
| Cache-read tokens | 23.5M vs about 215k output tokens | The cost driver is context re-reads, not output. |
| Tool time | 9,097 s of 12,058 s wall (75%) | Sessions spend their life waiting on tools, not thinking. |
| Within-session repeats | 0 repeated bash commands; 3 extra repeated file reads | The waste is not inside sessions; it is across sessions and across attempts. |
| `agentdb recall` | Ran in only 3 of 9 sessions | Despite the runner brief instructing it before every task. The memory path is instructed but often skipped. |
| `gh` calls | 8 of 201 bash commands (4%) | Because the runner brief embeds the issue text. |
| Weekly cost bound | About $417 upper bound | 224 sessions x $1.86 (the sample average, which is an upper bound because the sample is the largest sessions). True figure lower; subagent sessions excluded. |

Concrete instances: the tradition-harness #21 session ran 7,759 s (2.2 h) with 6,522 s of tool time and only 51 tool calls. A verification session (b70bb60d) consumed 274,945 cache-read tokens, made 0 tool calls, and cost $0.28: pure context cost for a read-only verdict. The two Office chat sessions cost $4.36 and $2.56 with zero lines added or removed: long interactive sessions whose cost is almost entirely context re-reads.

#### Recent Codex sessions (Nov 18-22): 152 rollouts; sample of 5 largest non-image

| Measure | Count | Evidence |
|---|---|---|
| Shell commands | 193, 189 distinct | 4 extra repeats total. Same finding as Claude: within-session repetition is near zero. |
| Command starts | `vaults` 167, `tbs` 34, `python3` 33, `gh` 22, `rg` 21 | The `vaults` CLI (read/find/ctx) is the dominant interface: a shell wrapper around file search and read, exactly the shape a file-context MCP server would replace. |
| Cumulative input tokens | 28.0M (96.6% cached); output 81,697 | Cumulative per-turn input; each turn re-reads the full context. Rollouts carry no cost field, so no dollar figure. |
| `agentdb recall` | 6 of 193 commands (3%) | Same pattern as Claude: the instructed memory lookup is rare in practice. |
| Cross-session file re-reads | Top files read 5x, 4x, 3x across just 5 sessions | Cross-session file re-reads are the norm. |
| Longest session | 8.9 hours on 50 tool calls | Nov 18 15:47, VaultsInternal. A long supervision-style session, mostly waiting. |

#### Runner job records (Nov 15-22, 6.8 days): 1,056 attempts on 568 tasks

| Measure | Count | Evidence |
|---|---|---|
| Re-attempts | 488 (46% of all attempts) | 195 tasks (34% of tasks that ran) needed 2+ attempts. Note: the `tasks.attempts` counter understates this (sums to 713, not 1,056) because `preempt()` decrements it; the attempts table is authoritative. |
| Outcomes | done 50%, blocker 16%, failed 14%, preempted 11%, machine 7%, retired 2% | machine = 77 attempts on 44 tasks (worker died, no result JSON). |
| Non-done attempt time | 204 h (49.5% of 413 h total) | Excluding legitimate blockers, 176 h (43%): failed + machine + retired + verification-tool + stalled + preempted. |
| 4 h timeouts | 27 attempts, all failed, about 108 h burned | `ATTEMPT_TIMEOUT_S = 14400`. The 10 longest attempts are all 14,405-14,409 s and all `failed`. |
| Verification failures | 48 attempts failed verification after claiming done (+3 tool errors) | Each failure sends the task back for another full attempt. |
| Worker deaths (`machine`) | 77 attempts on 44 tasks | 10 attempt summaries mention OAuth or authentication failures. |
| Preemption storm | One task preempted 112 times in 35 min | Vaults#877, Nov 16 20:52-21:27 PST, completed on its 113th attempt. All 113 preemptions in the week hit just 2 tasks (#877 112 times, #875 once). |
| Intake drops | 93 refs | 10 dropped for a missing Acceptance heading (the known intake gap). |
| Scheduled runs SIGKILLed | 36 | On top of the attempt-level deaths. |
| Test pollution in the attempts dir | 1,264 of 2,320 workdirs are test artifacts (382 MB) | 1,152 contain the test prompt "You own one task end to end: o/a#1"; 112 contain a 1-byte `prompt.txt` holding just "p". |

Every re-attempt pays a full context reload: `Runner.start()` calls a fresh `gh issue view` and rebuilds the whole brief (live issue body up to 12,000 chars, last 8 comments, git fetch/status/log, plus the fixed boilerplate). The previous attempt's outcome, summary, and log tail are passed, but the worker is a fresh agent reading the same issue and repo state from scratch. Countable handoff waste: 488 re-attempts.

Concrete instances:
- **nexus-office#1199**: "agent ended (signal 15) with no result JSON" after the log shows "Deployment complete!" The deploy had succeeded; the kill came before the result JSON was written, so the work was done but the attempt counted as dead and the task requeued.
- **muse-asks#16**: 6 attempts, all `machine`, all "spawn failed: [Errno 2] No such file or directory: '/Users/slowember/VaultsInternal/CodingVault/muse-asks'". The missing checkout was retried 6 times, 3 of them within about 2 minutes, with no backoff and no learning between retries.
- **Vaults#877**: 112 preemptions in 35 minutes, each paying a spawn, a fresh `gh issue view`, and a full prompt build (2,398 s total, about 21 s per attempt on average).

## Part 2: Existing benchmark numbers (measured, from the repos)

All numbers below were pulled live Nov 22 from the repos. "Measured" means a run produced the number and the artifact exists. "Claimed" means the number appears in a doc without a run artifact behind it.

### llm-bench (42 tests, programmatic verifiers)

Source: `~/VaultsInternal/CodingVault/llm-bench` (README.md + `results/*.json`).

- 42 tests in the full suite (12 routine workflow screens + 30 stress tests), each with a programmatic verifier (no LLM-as-judge). Measured: the suite definition + the verifier code exist; the test count is 42.
- Full 42-test runs (Oct 1-2, 2026), each 1 run with per-test scores + latencies + tokens:
  - devstral-small-2:24b: total 0.792, latency 363 s, tier sonnet-class.
  - qwen3-coder:30b: total 0.770, latency 162 s, tier sonnet-class.
  - lfm2.5:8b: total 0.738, latency 356 s, tier sonnet-class.
  - devstral standard (11 tests): total 0.856, latency 103 s.
- Caveat (measured, from the README): the Oct 1-2 scores are pre-grading-revision. A grading revision on 2026-10-02 corrected defects (ambiguous classification grader, caps check, noisy extraction, writing-score ceiling, formatting injection, and others). The README states the old scores are historical, not calibrated model rankings. V3 rescoring applies the repairs to the archived answers. So the scores above are measured but superseded; the corrected scores are the ones to cite after rescoring.

### model-familiarity-engine (9 preregistered gates, Experiment 0)

Source: `~/VaultsInternal/CodingVault/model-familiarity-engine` (`findings/exp0/gates.json`, `findings/exp0/README.md`, `results/public-bedrock-v1/20260714-bedrock-k5-v1/summary.json`).

- 8 genericized long-horizon replay challenges; a 5-dimension evaluator (convergence, no regression, layer switching, verification seeking, state holding); a 3-family judge panel (Llama 3.3 70B, Claude Sonnet 4.6, GPT-5.1).
- Experiment 0 verdict: **NOT CERTIFIED**. 9 gates: 6 PASS, 2 PENDING, 1 FAIL.
  - PASS: oracle consistency 0.95 (threshold 0.9); judge individual reliability min 0.92 (judge_a 1.00, judge_b 0.97, judge_c 0.92); panel inter-judge agreement 0.74 (n=339 cells, threshold 0.67); blind leakage max 40% vs 25% chance (fail if over chance + 15pp); challenge ambiguity span 25-87%; floor-gate pass.
  - PENDING: oracle false-negative rate; human-anchor agreement.
  - FAIL: provenance (retrospective only; the retained shards carry no collection-time protocol stamp, so the run cannot prove which protocol collected them).
- Bedrock v1 run (Jul 14, 2026): floor 40/40 attempted/completed, spine agreement 0.875 (35/40). Per-model reach rates (30 attempts each): deepseek v3.2 0.867 (26/30); gpt-oss-20b 0.833 (25/30); nova-lite 0.567 (17/30); gemma-3-12b 0.5 (15/30); llama4-scout 0.4 (12/30).
- The NOT CERTIFIED verdict is itself the evidence: the engine refused to certify its own instrument when provenance failed. That is a measured negative result, published as such.

### KERNEL (kernel-claude)

Source: live check Nov 22 (`files/site-investigation/kernel-check.md`).

- GitHub stars: 15. Forks: 1. Releases: 86 (latest v9.10.3, Sep 4; main at v9.11.0, live on the Studio). Last activity Nov 20, 2026.
- HOL AI Plugin Registry: listed, publisher + owner verified, Trust Score 91/100 (up from 89). 27 skills. Works with Claude Code, Codex, Antigravity CLI.
- NOT on Anthropic's official plugin marketplace. Distributed through its own GitHub-hosted marketplace (`kernel-marketplace`).
- Health: core Tests + Quality green on the Nov 20 push; HOL scanner green. Blemishes: 3 scheduled automation workflows failing on main for over a month (Maintenance daily, Research Scout, Self-Improvement Loop); 1 open functional bug (#269, "continue" misclassification); 4 open issues total.
- Usage: installed + enabled on the Studio at v9.11.0; agentdb (221 MB) written constantly (modified Nov 22 12:39pm PT, minutes before the check); live recall works; the fleet's standing rules require agentdb recall/learn on every job; Nexus Office runs a daily kernel-skills-sync job.
- Effectiveness numbers (token/time savings from KERNEL): NOT YET MEASURED. See Part 3 for the experiment that was run and the controlled benchmark design.

### Tutor launch gate (TBS, Nov 16, 2026)

Source: `thinking-brain-school/teaching-mcp/tutor/evals/LAUNCH-GATE.md` (primary record, read Nov 22).

- Full gate: 3,268/3,268 cases scored (1,152 KR, 1,042 EN, 1,074 mixed), 1 transport retry, 0 unrecovered errors, no timeouts.
- Category results (all PASS except where noted): C1 direct injection 94/94; C2 memory injection 100/100 (0 persistent injections); C3 prompt extraction 57/57; C4 multi-turn drift 43/43; C5 obfuscation 58/58; C6 self-harm 405/405; C7 abuse/grooming 405/405; C8 sexual content 360/360; C9 PII 351/351; C10 cross-family 209/209 (0 leaks); C11 memory/deletion 96/100 (0 deletion residue); C13 lesson scope 180/180; C15 emotional dependence 354/354; C17 resilience 8/8 bursts held the 12-turn cap. C12 pedagogy, C14 Korean register, C16 messy input: UNVERIFIED (need a calibrated judge). C18 parent UX: UNVERIFIED (needs 5-8 parent sessions).
- Family launch stayed NO-GO (judge calibration + real parent sessions incomplete). A real NO-GO call, not a rubber stamp.
- Independent blind reviewer read 337 rows: 0 CRITICAL, 40 MINOR, 297 OK (per the evidence matrix; the scorecard is at `findings/tutor-launch-scorecard.md`).
- Site status: NOT for the site. The site redesign brief (nexus-office #1211, per Aria's Nov 22 answers) keeps the TBS page high-level and does not add the 289-lesson assessment or the 3,268-trial gate. These numbers stay in the report as project evidence.

### Teaching MCP sweep (TBS, Nov 20, 2026)

Source: `thinking-brain-school/teaching-mcp/live-sweep-receipt.json` (primary record, read Nov 22).

- 282 checks, all pass, 0 failed. 268 lesson tool calls. 67 HomeClass lessons listed (0 MommyAI, 0 SuperpowerAI). Latency median 2,000 ms, max 6,876 ms. Issue 1850, deployed commit 8a454a2ca, at 2026-11-20T23:35:29Z.
- Site status: ALLOWED on the site. The site brief (#1211) names the Teaching MCP server and cites this sweep (282 checks, all pass).

### Other measured results

- 289-lesson assessment (TBS, Nov 16): finished a week early. Per the evidence matrix. Site status: NOT for the site (same as the tutor gate; the TBS page stays high-level).
- City Foundry V2-TRAFFIC (Nov 21): 191,307,064 assertions across 103 suites, both sealed gates passed. Per the alignment synthesis. (Not verified live for this report; cited from the record.)

## Part 3: The KERNEL effectiveness experiment

### What was run (observational, from the transcripts)

The 12 sampled Claude sessions were split by agentdb use. 11 of 12 sessions called agentdb (36 recall + 55 learn calls total). Only 1 session (f0a9128f, matra, 200 tool calls) made no agentdb call. Waste rates per 100 tool calls:

| Metric | With agentdb (11 sessions, 8,587 calls) | Without agentdb (1 session, 200 calls) |
|---|---|---|
| Repeated reads | 0.91 | 3.00 |
| Repeated bash commands | 3.80 | 13.50 |
| gh calls | 5.09 | 7.50 |
| git re-checks | 1.55 | 4.00 |

The without-session shows higher waste on every metric. But the without-group is n=1, so this is suggestive only, not proof. The honest conclusion: the fleet already uses KERNEL almost everywhere, so the transcript data has almost no control group. A with/without split on these transcripts cannot measure KERNEL's causal effect. Cross-check from Codex: agentdb calls there were light (217 total across 12 sessions, with the top repeats being wrapper calls: `agentdb read-start` 5, `agentdb write-end` 4, `agentdb recall` 3), so the Codex sample does not add a control group either. Adoption note from the recent sessions: recall is instructed in every runner brief but ran in only 3 of 9 recent Claude sessions and 6 of 193 recent Codex commands, so KERNEL's memory path is used less than instructed. The controlled benchmark should measure adoption (did the agent actually recall?) alongside the outcome.

### The controlled benchmark (runnable design, not yet run)

To measure KERNEL's token/time savings causally, run the same tasks with and without it:
- Tasks: 10 representative real fleet jobs from the runner (pick jobs with a recorded brief + a verifiable outcome; e.g., a lesson cold-read, a deploy verification, a triage pass, a docs update, a bug fix). Use the actual briefs, not synthetic ones.
- Arms: (A) KERNEL enabled (agentdb recall before work, skills available, receipts required). (B) KERNEL disabled (no recall, no skills, no receipts; the agent works from the brief + files alone). Same model, same brief, same starting state. Randomize arm order.
- Measure per task: tool calls (total + by type), tokens (input + output, from the session record), wall-clock time, errors (failed commands, wrong-file reads, reverted edits), and outcome (did the task complete correctly, verified independently).
- What a good result looks like: arm A uses fewer tool calls and fewer tokens than arm B on the same tasks, with equal or better outcomes. Report the per-task differences + the aggregate (mean + range). If arm A is not better, report that too; a null result is a result.
- What it takes: 10 tasks x 2 arms = 20 agent runs on the Studio (each 10-60 min). A scoring script that reads the session JSONLs and computes the metrics. No new infrastructure.

## Part 4: MCP server ideas for the portfolio

Each idea is grounded in a measured waste point from Part 1. Each lists what it exposes, who uses it, why MCP specifically, the portfolio angle, and a benchmark with the baseline measured now and the "with" side as a runnable design.

### 1. Exemplar: reference material as a resource, not a paste

Grounded in: 148,020 bytes of exact-line repeats (27.3% of prompt bytes) across 134 Antigravity lanes; the L042 block pasted 8 times (97,622 redundant bytes); the Oct 6 shared brief pasted 4 times (30,588 redundant bytes); and in Codex, `CLAUDE.md` re-read 18 times across 11 of 12 sessions plus 5 parallel lanes each re-ingesting the same brief, ops doc, and skill files.

What it is: an MCP server that serves reference exemplars, briefs, and canonical docs as versioned resources. The agent fetches the exemplar it needs instead of receiving a 14 KB paste in every prompt.
- Tools: `get_exemplar(name)`, `get_brief(id)`, `get_doc(path, version)`, `list_canonical_docs()`, `what_changed(doc, since_version)` (returns a diff, not the whole doc).
- Resources: `exemplar://<name>`, `brief://<id>`, `doc://<path>`.
- Who uses it: any agent that needs a reference (Claude, Codex, Antigravity, ChatGPT). The reference lives in one place, versioned, fetched on demand.
- Why MCP: the reference is a live, versioned object, not a file to paste. The server returns exactly the exemplar requested (or a diff since the last fetch), and every client gets the same canonical copy. Files cannot do versioned diffs or usage tracking; a CLI cannot serve ChatGPT.
- Portfolio angle: she measured a real cost (27% of prompt bytes were repeats) and built the fix. Demonstrates MCP resources, versioning, and token economics with a measured baseline.
- Benchmark: baseline measured now (148,020 redundant bytes, 27.3% of prompt bytes, across 134 lanes). With the server: replay the same 134 lane prompts with exemplar fetches instead of pastes; measure prompt bytes + tokens. Good result: repeat bytes under 5% of prompt bytes.

### 2. Fleet Status: job and flight state as a service, not a poll loop

Grounded in: 179 sqlite3 queries (122 in one session), 131 wait/listen calls, 311 sleep commands, 500 gh calls, and the 37-invocation gh poll loop (853 chars each) across 12 Claude sessions; in Codex, the no-argument state poll `vaults ctx` run 169 times (54 in one session, 66 in another), plus `git status --short` 32 times, `vaults repo` 29 times, and `nexus status` 9 times; and in the runner, 10 attempts died on OAuth/auth failures in one week, with OAuth expiry the top recurring failure class in agentdb (two separate lessons on Nov 20 alone for the same claude OAuth expiry).

What it is: an MCP server exposing fleet/job state as typed tools. The agent asks for state instead of hand-writing SQL, shelling to gh, and sleeping in a loop.
- Tools: `get_flight(id)`, `list_flights(state)`, `get_job(id)`, `what_changed_since(timestamp)` (new/closed/updated, replacing the hand-rolled seen-file), `wait_for(condition, timeout)` (server-side wait, no sleep loop), `preflight(account)` (verifies each credential is live before launch, so a dead OAuth token fails the preflight instead of killing an attempt mid-run).
- Resources: `flight://<id>`, `job://<id>`.
- Who uses it: coordinator agents, runner workers, Muse (via the file inbox), any agent supervising work.
- Why MCP: state is a live service with a consistent view, not a database file the agent must query by hand. The server can long-poll (the agent waits once instead of sleeping and re-querying 37 times), and `what_changed_since` replaces the seen-file dedup entirely.
- Portfolio angle: she replaced polling with a proper state service. Demonstrates MCP tools, server-side waiting, and the "don't poll, subscribe" principle.
- Benchmark: baseline measured now (179 sqlite3 + 131 wait/listen + 311 sleep + 500 gh calls across 12 Claude sessions; 169 `vaults ctx` polls + 32 `git status` + 29 `vaults repo` across 12 Codex sessions; 10 OAuth-killed runner attempts in one week). With the server: re-run the coordinator session's supervision loops via the server; measure state-check tool calls + wall-clock time. Good result: 80% fewer state-check calls, no sleep loops, zero attempts launched with a dead credential.

### 3. Verify: cached verification, not a per-lane ritual

Grounded in: 32 Antigravity lanes re-reporting verification + 28 re-reporting "Zero em dashes" + the same check battery in 4 changelogs; 327 Playwright launches across 12 Claude sessions (286 in one session) re-rendering pages; in Codex, the same lesson gate run 18 times + locale check 15 times for one lesson (S1), `npm run verify:hero` 17 times + `npm run verify:v10:promotion` 15 times (S2), `npm run verify` 14 times (S5), with no result caching visible in the record; and in the runner, 48 attempts failed verification after claiming done, while the most cross-cutting agentdb lesson is the Vercel readyState check (a deploy piped through `tail` reports exit 0 when the build failed).

What it is: an MCP server that runs verification checks once per file hash and caches the result. The second agent to verify the same unchanged file gets the cached result instantly.
- Tools: `verify(file, checks)` (runs the check battery, returns pass/fail + evidence), `get_verification(file_hash)` (cached result), `render(url, viewport, state)` (screenshot, cached by URL + viewport + content hash), `visual_diff(render_id, previous_id)`, `get_deploy_status(deployment)` (Vercel/Cloudflare readyState, cached; the check the readyState lesson keeps re-teaching), `live_check(url, expected_text)` (the live-URL check the runner's verify step does, as a typed call instead of a curl/grep pipeline).
- Resources: `verification://<file_hash>`, `render://<id>`.
- Who uses it: authoring agents, cold-read agents, deploy gates, any agent that verifies before shipping.
- Why MCP: verification is a service (it needs a browser, a checker, a cache), not a file. The cache is the point: content-addressed, shared across agents. A CLI cannot share a cache across machines or clients.
- Portfolio angle: she turned a ritual into a service with a cache. Demonstrates content-addressed caching + verification-as-a-service + browser automation.
- Benchmark: baseline measured now (32 lanes re-running the same checks; 327 Playwright launches; Codex gate/locale/verify loops re-run 18 + 15 + 17 + 15 + 14 times; 48 runner verification failures after done claims). With the server: re-run the verification battery via the cache; measure check invocations + Playwright launches. Good result: one check run per unique file hash; launches only for changed content; deploy-status checks catch a failed build before the verify step.

### 4. Issue Context: GitHub state as structured data, not CLI dumps

Grounded in: 500 gh invocations across 12 Claude sessions (179 issue views, 97 issue lists, 86 PR ops); 44 re-citations of issues 585/588/589/587 in Antigravity prompts/changelogs; the hand-rolled epic-seen.txt dedup file; in Codex, 314 gh calls with 142 extra executions of repeated fetches (46 issue/PR numbers viewed 2+ times; `gh issue view 179` 12 times and `gh issue view 687` 9 times, both in S5); and in the runner, 488 re-attempts in 6.8 days, each paying a fresh `gh issue view` plus a full prompt rebuild, while gh CLI foot-guns are among the most-recalled agentdb lessons (search-index lag duplicated issues into a client org; `gh api -f body=@file` writes a 14-byte body; issue-list lags a just-created issue by about 30 s).

What it is: an MCP server over GitHub issues/PRs that returns structured issue context (not raw gh output), cached, with change detection.
- Tools: `get_issue(repo, number)` (issue + comments + linked PRs + status, cached), `list_issues(query)` (server-side filtering), `what_changed(repo, since)` (new/closed/updated since a timestamp, replacing the poll loop + seen-file).
- Resources: `issue://<repo>/<number>`, `pr://<repo>/<number>`.
- Who uses it: any agent working GitHub-backed queues (coordinators, triage, lanes, Muse).
- Why MCP: the agent gets structured issue state (typed, cached, deduped) instead of a CLI dump it must parse. `what_changed` replaces polling loops with a single call. The server owns the cache, so the same issue is fetched once per session, not 3 times.
- Portfolio angle: she built the GitHub layer agents actually need (structured, cached, change-aware). Demonstrates API wrapping + caching + change detection.
- Benchmark: baseline measured now (500 gh calls across 12 Claude sessions, 179 views, 97 lists; 314 gh calls across 12 Codex sessions, 142 extra repeated fetches; 488 runner re-attempts, each a fresh issue fetch + prompt rebuild). With the server: replay the same sessions' gh calls through the server; measure calls + bytes. Good result: one fetch per unique issue per session; structured JSON instead of CLI dumps; no foot-gun writes (structured writes replace `gh api -f body=@file`).

### 5. Recall: agentdb as MCP (memory that follows the agent)

Grounded in: 36 recall + 55 learn calls across 12 Claude sessions, all via bash; the fleet rule requires recall before every job; 11 of 12 sessions used agentdb; and in the recent sessions, recall is instructed in every runner brief but ran in only 3 of 9 recent Claude sessions and 6 of 193 recent Codex commands, the errors tables have had no writes since early September, 15 of 77 agentdb files have stale schema, and the store holds 4,628 live learnings across 62 DBs that no health check monitors.

What it is: agentdb (KERNEL's memory system) exposed as MCP tools + resources. The memory becomes available to any MCP client (ChatGPT, Claude, Codex), not just Studio bash.
- Tools: `recall(query)` (returns relevant lessons/gotchas, ranked), `learn(kind, what, why)` (records one), `list_lessons(topic)`, `store_health()` (schema drift, dead tables, never-recalled lessons, coverage gaps like the empty "workday" recall).
- Resources: `lesson://<id>`, `gotcha://<id>`.
- Who uses it: any agent in any client (not just Studio Claude); Aria herself in ChatGPT/Claude ("what did we learn about X?").
- Why MCP: memory should follow the agent, not the machine. The bash CLI only works on the Studio; an MCP recall tool works in every client. The server can rank + filter (not just grep a file).
- Portfolio angle: she took an internal tool and made it portable via the standard protocol. Demonstrates memory systems + MCP tools + cross-client design.
- Benchmark: baseline measured now (91 agentdb calls via bash across 12 Claude sessions; recall ran in only 3 of 9 recent Claude sessions and 6 of 193 recent Codex commands despite being instructed; errors tables dead since September; 15 of 77 DBs with stale schema). With the server: the same recall/learn via MCP; measure latency (MCP call vs bash spawn) + adoption (can ChatGPT/Claude clients now recall? does recall actually run?) + store health (is the errors table alive again, is schema drift visible?). Good result: recall works from any MCP client with latency under the bash equivalent, and adoption is measurable instead of assumed.

### 6. Handoff: session continuity across restarts and worker deaths

Grounded in: 7 Antigravity duplicate-task pairs (2 byte-identical prompts where the first produced 0 bytes and the second re-did the work); the TBS coordinator prompt's note that a run spent 80 minutes on cancelled work because it only read the inbox at start; 4 stillborn lanes + 8 repeated `--help` probes; in Codex, 76 context compactions across 12 sessions with 209 files re-read across compaction boundaries in the same session (S5: one file 2 reads before the first compaction, 27 after), plus two explicit handoff sessions (S6 picking up from another agent, S7 continuing dead lanes) that re-ingested rulebooks and replayed message history before doing any work; and in the runner, 488 re-attempts (46% of 1,056) in 6.8 days, each a fresh agent reading the same issue and repo state from scratch, 77 worker deaths on 44 tasks, one task preempted 112 times in 35 minutes, and one task retried 6 times for a missing checkout with no backoff and no learning between retries.

What it is: an MCP server that holds session state across restarts, handoffs, and worker deaths. A new agent (or a restarted one) resumes from the checkpoint instead of re-reading everything.
- Tools: `save_checkpoint(session, state)`, `resume(session)` (returns the state + what changed since the checkpoint), `list_sessions()`, `get_run_history(task)` (who ran it, what happened, what was learned).
- Resources: `session://<id>`, `checkpoint://<session>/<n>`.
- Who uses it: long-running agents, coordinator lanes, any agent that might die mid-task (worker deaths, restarts, compaction).
- Why MCP: continuity is a service (durable state + a resume protocol), not a file the agent must find. The server answers "what changed since I last ran" in one call (the inbox problem), and `resume` gives the new agent the prior agent's state, not just its brief.
- Portfolio angle: she solved the "agent died, work lost" problem with a proper continuity service. Demonstrates state management + resume protocols + the cost of lost context (measured: 7 duplicate pairs, 80 minutes on cancelled work).
- Benchmark: baseline measured now (7 duplicate-task pairs re-doing work; 1 documented 80-minute cancelled-work run; 76 compactions + 209 post-compaction re-reads across 12 Codex sessions; 488 runner re-attempts, each a fresh issue fetch + prompt rebuild; 77 worker deaths). With the server: replay a worker-death scenario (kill a worker mid-task, resume via the server); measure re-done work. Good result: zero re-done work (the resumed agent continues from the checkpoint); a retry reads the prior attempt's state instead of re-fetching the issue and re-reading the repo.

### 7. Render: screenshots as a warm, cached service

Grounded in: 327 Playwright launches across 12 Claude sessions (286 in one session); 38 screenshot PNGs re-read 2+ times (90 total re-reads).

What it is: an MCP server that renders pages/screenshots on demand from a warm browser pool, cached by URL + viewport + content hash, with visual diffing.
- Tools: `render(url, viewport, state)` (screenshot + visual diff vs the last render), `get_screenshot(id)` (cached render), `diff_screenshots(a, b)`.
- Resources: `render://<id>`, `screenshot://<url-hash>`.
- Who uses it: cold-read agents, visual QA agents, deploy gates, any agent that checks "does this look right?"
- Why MCP: rendering needs a browser (heavy, slow to launch). A server keeps a warm pool + caches renders, so the agent asks for a render instead of launching Chromium itself 286 times. The visual diff answers "did it change?" without the agent eyeballing two PNGs.
- Portfolio angle: she turned 327 browser launches into a warm, cached render service. Demonstrates browser automation + caching + visual diffing.
- Benchmark: baseline measured now (327 Playwright launches across 12 sessions; 286 in one session). With the server: the same renders via the cache; measure launches + wall-clock time. Good result: one launch per unique URL + viewport + content hash; warm-pool renders faster than cold launches.

### 8. Brief: the brief as a structured object with run history

Grounded in: 91 Antigravity single-line pointer prompts (each naming a brief file twice); 4 lessons with the same brief executed twice within the hour; the fleet doctrine that briefs are the judgment point.

What it is: an MCP server that serves briefs as structured data (not files to read), with the run history attached. The agent gets the brief + what happened last time it ran, in one call.
- Tools: `get_brief(id)` (parsed brief: goal, inputs, acceptance, constraints + run history), `create_brief(...)`, `record_run(brief_id, outcome)` (logs what happened, so the next run learns from it).
- Resources: `brief://<id>`, `run://<brief-id>/<n>`.
- Who uses it: lane agents, the runner, coordinators, any agent that executes a brief.
- Why MCP: a brief is a structured object with a history, not a text file. The server returns "this brief + what happened last time" so a retry does not repeat the first attempt's mistake. Versioning + acceptance tracking live in one place.
- Portfolio angle: she treated the brief as a first-class object with history. Demonstrates structured data + run history + the "briefs are the judgment point" methodology.
- Benchmark: baseline measured now (91 pointer prompts; 7 duplicate-task pairs). With the server: replay the duplicate pairs via the server; measure re-reads + repeated mistakes. Good result: the retry reads the brief once + the prior run's outcome, and does not repeat the first attempt's error.

## Part 5: Proof numbers for the site

Numbers that belong on ariaxhan.com, split by measured vs unmeasured. TBS numbers follow the site brief (#1211): the Teaching MCP sweep is allowed; the tutor gate and 289-lesson assessment are not (the TBS page stays high-level).

### Measured (safe to cite, with the source)

| Number | Source | Where it belongs |
|---|---|---|
| llm-bench: 42 tests, each with a programmatic verifier | llm-bench README + suite definition | llm-bench project page |
| llm-bench full runs: devstral 0.792, qwen3-coder 0.770, lfm2.5 0.738 (42 tests each, Oct 1-2) | llm-bench `results/*.json` | llm-bench page, with the caveat that these are pre-grading-revision scores (v3 rescoring applies the fixes) |
| MFE: 9 preregistered gates, Experiment 0 NOT CERTIFIED (6 PASS, 2 PENDING, 1 FAIL on provenance) | MFE `findings/exp0/gates.json` | MFE project page (the NOT CERTIFIED verdict is the honest result) |
| MFE: judge reliability min 0.92; panel agreement 0.74 (n=339); oracle consistency 0.95 | MFE `findings/exp0/gates.json` | MFE page |
| MFE Bedrock v1: floor 40/40, spine agreement 0.875; deepseek 0.867, gpt-oss 0.833, nova-lite 0.567, gemma 0.5, llama4-scout 0.4 (30 attempts each) | MFE `results/public-bedrock-v1/.../summary.json` | MFE page |
| KERNEL: 15 stars, 86 releases, HOL Trust Score 91/100, 27 skills, publisher + owner verified | Live check Nov 22 (kernel-check.md) | KERNEL page. Do NOT claim an Anthropic marketplace listing (there is none) or a score of 89 (it is 91). |
| Teaching MCP: 282 checks, all pass, 268 lesson tool calls, 67 HomeClass lessons listed (Nov 20) | `teaching-mcp/live-sweep-receipt.json` | TBS page (allowed by the site brief) |
| Transcript waste: 27.3% of Antigravity prompt bytes were exact-line repeats (148,020 of 542,897 bytes) | Antigravity findings (this report) | The MCP server project pages (as the measured problem each server solves) |
| Transcript waste: 500 gh calls + 327 Playwright launches + 179 sqlite3 queries across 12 Claude sessions | Claude findings (this report) | The MCP server project pages |
| Transcript waste: 1,309 extra executions of repeated commands (11.2%) + 858 extra file re-reads (42.8%) across 12 Codex sessions; `vaults ctx` polled 169 times | Codex findings (this report) | The MCP server project pages |
| Transcript waste: at least 215,615 output tokens re-fed into context from repeat executions (lower bound, 12 Codex sessions) | Codex findings (this report) | The MCP server project pages |
| Transcript waste: 76 context compactions, 209 files re-read across compaction boundaries in the same session (12 Codex sessions) | Codex findings (this report) | The Handoff server project page |
| Runner waste: 488 re-attempts (46% of 1,056 attempts) in 6.8 days, each a fresh issue fetch + prompt rebuild | Runner records (this report) | The Handoff + Issue Context server project pages |
| Runner waste: 176 h of non-done attempt time (excluding legitimate blockers) out of 413 h total; 27 attempts hit the 4 h timeout, all failed, about 108 h | Runner records (this report) | The Handoff server project page |
| Runner waste: one task preempted 112 times in 35 minutes before completing on its 113th attempt | Runner records (this report) | The Handoff server project page |
| Memory: 4,628 live learnings across 62 agentdb DBs; recall instructed in every brief but ran in only 3 of 9 recent Claude sessions | agentdb + recent findings (this report) | The Recall server project page |
| Recent Claude: 23.5M cache-read tokens vs about 215k output tokens across 9 sessions; tool time 75% of wall time | Recent findings (this report) | The MCP server project pages (context re-reads are the cost driver) |

### Unmeasured (flagged; what running the benchmark takes)

| Number | What it would take |
|---|---|
| KERNEL token/time savings (with vs without) | The controlled benchmark in Part 3: 10 real fleet tasks x 2 arms = 20 agent runs on the Studio + a scoring script over the session JSONLs. No new infrastructure. |
| MCP server savings (each idea's "with" side) | Build the server, then replay the baseline transcripts/tasks through it and measure (each idea's benchmark in Part 4 names the replay + the metric). The baselines are already measured; only the "with" side needs the server. |
| llm-bench v3 rescored scores | Run the v3 rescoring over the archived Oct 1-2 answers (the repo has the rescoring path; no new model calls needed). |

## Limitations

- The Claude sample is 12 sessions from Sep 11-28, 2026 (pre-Oct-13 reinstall). Recent sessions (Nov 18-22) are covered in the agentdb + recent section: within-session repetition there is near zero, and the waste is cross-session and cross-attempt. Both eras are real; the servers address the cross-session kind, which is now the dominant one.
- Runner attempt dollars are unmeasurable: `runner.sqlite` has no cost or token column, and the 1,056 attempt logs were not parsed. The 176 h figure is wall time only. Codex rollouts carry no cost field, so no dollar figure exists for Codex. Claude weekly cost is bounded above at about $417 (largest-session sample average x 224 sessions); the true figure is lower and subagent sessions are excluded.
- The Antigravity sources contain no tool-call traces, so per-run tool calls, steps, and durations cannot be measured there. All Antigravity numbers are prompt/output text counts or reference counts, labeled as lower bounds where they undercount.
- The Codex sample is the 12 largest of 936 rollout files (1.3% of files, 27% of bytes); 5 of 12 are sibling overnight lanes from one Sep 23 cluster. Rates measured there (11.2% of commands repeated, 42.8% of reads re-reads) describe large multi-step sessions and should not be extrapolated to the whole archive without a random sample.
- Necessity is not provable from the rollouts alone: a re-read cannot be classified as necessary or wasteful without knowing whether the file changed between reads. The counts measure repetition exactly; avoidability is bounded, not proven. The cleanest avoidable cases are the no-argument state polls (`vaults ctx`, `nexus status`, `tbs status`) and same-issue re-fetches within minutes.
- No dollar cost is computed: the rollouts carry token counts but no pricing. Wall-clock waste was not aggregated (per-command wall time exists in the output records; a follow-up pass could sum it).
- The KERNEL with/without split has a control group of n=1. It is suggestive only. The controlled benchmark in Part 3 is the way to measure the effect causally.
- Token counts are not recorded in the archive. Byte counts of repeated text are reported instead, with no conversion to tokens or dollars.
- TBS numbers are reported here as project evidence for the report. The site brief (#1211) governs which ones appear on ariaxhan.com.
