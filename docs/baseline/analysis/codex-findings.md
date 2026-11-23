# Codex session analysis: where an MCP server would have helped

Date: 2026-11-22. Source: `~/workspace/user/transcript-archive/studio/codex-sessions/` (936 rollout files, 4.9 GB) and `~/workspace/user/transcript-archive/studio/codex-meta/session_index.jsonl` for thread names. Read only; nothing under the archive was modified.

## Method

Sample: the 12 largest rollout files by byte size, 1.33 GB total, 100,921 JSONL lines, 156.3 hours of combined session span, 307 turns. Each file is one Codex CLI session record: one JSON object per line, with `type`, `timestamp`, `ordinal`, and `payload`.

How work happens in these sessions: essentially everything goes through one tool, `custom_tool_call` named `exec`, whose input is JavaScript wrapping `tools.exec_command({cmd: "..."})`. There are no dedicated file read or write tools in this setup. File reads happen through shell commands (`vaults read <path>`, `cat`, `sed -n`), file writes through `tools.apply_patch` (723 calls in the sample) and `tools.write_stdin` (2,164 calls). Other tool calls inside the exec JavaScript: `view_image` (425), `web__run` (65), `clock__curr_time` (141), `image_gen__imagegen` (17). Agent coordination uses function calls: `wait` / `wait_agent` (782), `send_message` (264), `followup_task` (108), `spawn_agent` (12).

Extraction: a Python parser read every line, pulled `cmd` strings from both the direct form (`cmd:"..."`) and the batch form (`const cmds=[...]; cmds.map(cmd => tools.exec_command({cmd,...}))`), normalized whitespace, and counted. Extraction coverage: 11,655 commands extracted against 11,426 textual `tools.exec_command` mentions; the extracted count is higher because one batch mention expands to several commands. Two independent checks confirmed the parser: a strict JSON parse counted `vaults ctx` 54 times in S1 tool-call records (parser: 54) and `gh issue view 179` 12 times in S5 tool-call records (parser: 12). Raw grep over the files overcounts badly because `compacted` records re-embed earlier history; only top-level tool-call records were counted.

Counting rules, stated so the numbers can be reproduced:

- A "repeat" means the same normalized command string, or the same file path, occurring 2 or more times within one session. "Extra executions" means occurrences beyond the first.
- File reads are counted once per command string, first path only. A command string that chains two reads of the same file (for example S5 line 4612: `vaults read nexus/work.py --range 950,1020 && vaults read nexus/work.py --range 1060,1095`) counts as one read. Read totals are therefore lower bounds. A substring check found 34 mentions of `vaults read nexus/work.py` in S5 versus 29 counted reads.
- GitHub "fetches" means `gh issue|pr view|diff|checks|status`, `gh issue|pr list`, `gh api`, and direct `github.com/.../issues|pull/...` URLs. `gh issue|pr comment` is a write and is counted separately.
- Repetition counts are exact measurements. Whether a given repeat was avoidable is an interpretation: a `git status` re-run after an edit is legitimate, a `vaults ctx` re-poll usually is not. This report separates the count from the interpretation.

## Sample

Base path for all files below: `~/workspace/user/transcript-archive/studio/codex-sessions/`. Thread names come from `codex-meta/session_index.jsonl` where present.

| ID | File | Size | Lines | Span | Turns | Topic |
|----|------|------|-------|------|-------|-------|
| S1 | `2026/09/23/rollout-2026-09-23T20-40-06-01a0d17f-c2ca-7150-ad5f-23ffc2e12cb4.jsonl` | 225.9 MB | 26,070 | 43.4 h | 89 | Teach hidden assumptions; finalize HomeClass L040/L041 live plus frozen |
| S2 | `2026/09/16/rollout-2026-09-16T20-30-00-01a0ad69-feff-7bd2-a6eb-4c1fb714504f.jsonl` | 140.5 MB | 13,303 | 43.1 h | 22 | Ingest v10 handoff (TBS site v10) |
| S3 | `2026/09/23/rollout-2026-09-23T00-31-26-01a0cd2d-31bc-7bc2-bcf4-fb2ea7969658.jsonl` | 135.1 MB | 1,848 | 1.9 h | 1 | Overnight lesson lane, L009 (Sep 23 00:30 cluster) |
| S4 | `2026/09/23/rollout-2026-09-23T00-30-52-01a0cd2c-ae32-7162-ac1a-9b479dda5968.jsonl` | 125.4 MB | 1,741 | 1.6 h | 1 | Overnight lesson lane, L005 (Sep 23 00:30 cluster) |
| S5 | `2026/09/24/rollout-2026-09-24T11-46-22-01a0d4bd-790a-7b30-be0a-c71e71eea1f1.jsonl` | 116.8 MB | 23,832 | 27.6 h | 30 | Investigate Ask request errors (nexus-office) |
| S6 | `2026/09/16/rollout-2026-09-16T21-07-31-01a0ad8c-5934-7313-819b-eea5bc199df7.jsonl` | 94.8 MB | 9,460 | 16.2 h | 8 | Revise five engaging lessons (pickup from another agent) |
| S7 | `2026/09/08/rollout-2026-09-08T22-30-53-01a084a5-cadc-7310-aa3c-d1ce765e6639.jsonl` | 91.0 MB | 7,161 | 5.7 h | 1 | Continuation of dead lanes fuza and rile, L015/L016/L017 |
| S8 | `2026/09/23/rollout-2026-09-23T00-31-13-01a0cd2c-feff-75d3-bbd4-5e06b264d982.jsonl` | 85.3 MB | 1,969 | 0.6 h | 1 | Overnight lesson lane, L012 (Sep 23 00:30 cluster) |
| S9 | `2026/09/23/rollout-2026-09-23T00-30-48-01a0cd2c-9e54-7c70-ad2b-6d7df2e52e22.jsonl` | 81.7 MB | 1,866 | 1.2 h | 1 | Overnight lesson lane, L017 (Sep 23 00:30 cluster) |
| S10 | `2026/09/08/rollout-2026-09-08T17-28-01-01a08390-84c7-7a63-9c82-d7607369374c.jsonl` | 81.4 MB | 5,359 | 6.5 h | 124 | Standing independent package reviewer (read-only) |
| S11 | `2026/09/23/rollout-2026-09-23T00-31-11-01a0cd2c-f684-7070-9207-d8471f535d61.jsonl` | 79.4 MB | 1,279 | 1.3 h | 1 | Overnight lesson lane, L013 (Sep 23 00:30 cluster) |
| S12 | `2026/09/06/rollout-2026-09-06T17-48-15-01a07956-5272-77b0-8a6d-6e1cfa65c430.jsonl` | 72.9 MB | 7,033 | 7.4 h | 28 | Review vault work and execute fixes |

Note on the sample: S3, S4, S8, S9, S11 are five parallel single-turn lesson lanes that all started within one minute of each other (2026-09-23 00:30-00:31 PDT) under the same overnight brief. They are legitimately large sessions, but they are siblings, not independent jobs. Cross-session duplication between them is measured separately below.

## Headline numbers (aggregate across 12 sessions)

- 11,655 shell commands executed; 10,136 distinct command strings.
- 1,309 extra executions of repeated commands (11.2 percent of all commands), across 550 repeated command patterns (per-session sum).
- 2,006 file reads detected (lower bound, see counting rules); 1,016 distinct paths; 341 paths read 2 or more times; 858 extra re-read executions, which is 42.8 percent of all reads.
- 314 GitHub CLI invocations: 212 issue/PR views or diffs, 35 list queries, 46 comment writes, 21 `gh api` calls or direct github.com URL fetches. 142 extra executions of repeated GitHub fetches. 46 distinct issue/PR numbers were viewed 2 or more times.
- 76 context compactions and 21 aborted turns. 209 files (per-session file counts summed) were read both before and after at least one compaction in the same session.
- Repeated commands whose output token counts could be attributed: at least 215,615 output tokens re-fed into context from repeat executions. This is a lower bound: only 561 of the 1,309 repeat executions had attributable output token counts.
- Total model output tokens across the sample: 3,806,002. Cumulative thread input tokens: 1,836,891,941, of which 1,807,762,048 (98.4 percent) were cached input. These input figures are cumulative per-response sums, not unique tokens, so they are not a cost figure on their own.

## Top 5 most-repeated files (all occurrences across the sample)

| File | Reads | Where |
|------|-------|-------|
| `nexus/work.py` | 30 | S5: 29 (lines 507, 2835, 2856, 3428, 3515, ...); S12: 1 |
| `client/phone/office.js` | 29 | S5: 29 (lines 9123, 9151, 9167, ...) |
| `revisions/v10/assets/site.css` | 24 | S2: 24 (lines 2678, 2810, 3175, ...) |
| `client/office_ask.py` | 24 | S5: 24 (lines 370, 1184, 1195, 1648, 1659, ...) |
| `bin/preview-hub.py` | 20 | S1: 16 (lines 12925, 12962, 12969, 13046, 13213, ...); S9: 3; S12: 1 |

Just below the top 5: `bin/lesson-media.py` 18, `docs/lesson-facts/homeclass/L040.md` 18 (all S1), `CLAUDE.md` 18 (spread across 11 of the 12 sessions), `nexus/tower.py` 18 (all S5), `bin/lessonview.mjs` 17 (spread across 6 sessions).

## Top 5 most-repeated command patterns (all occurrences across the sample)

| Command | Runs | Where |
|---------|------|-------|
| `vaults ctx` | 169 | S1: 54, S5: 66, S2: 27, S6: 18, plus 1 each in S3, S8, S9, S11 |
| `git status --short` | 32 | S5: 13, S11: 4, S3/S8/S9: 3 each, S1/S2: 2 each, S4/S12: 1 each |
| `vaults repo` | 29 | S2: 24, S1: 4, S5: 1 |
| `./tbs lesson gate homeclass L043-conditional-reasoning` | 18 | S1: 18 (lines 1279, 1322, 1357, 1737, 1750, ...) |
| `ls -lh docs/lesson-facts/homeclass/L040.md docs/lesson-facts/homeclass/L041.md 2>&1` | 17 | S1: 17 (lines 8113, 8614, 8648, 8801, 8846, ...) |

Tied at 17: `npm run verify:hero` (S2) and `vaults services restart com.aria.office-serve` (S5). Next: `vaults live --list` 16, `./tbs lesson locale homeclass L043-conditional-reasoning` 15 (S1), `npm run verify:v10:promotion` 15 (S2).

`vaults ctx` is the single largest repeat in the sample: a context/status poll re-run 54 times in one session (S1) and 66 times in another (S5). It is a pure state check with no arguments, so every re-run returns the same kind of snapshot. That is the clearest MCP-shaped gap in the data: a live workspace-state resource would replace polling with one read plus change notification.

## Per-session findings

| ID | Exec cmds | Repeat cmd extra | Reads | Re-read extra | GH calls | GH repeat extra | Compactions | Aborted turns | Post-compaction re-read files |
|----|-----------|------------------|-------|---------------|----------|-----------------|-------------|---------------|---------------|
| S1 | 3,306 | 392 | 573 | 273 | 0 | 0 | 19 | 11 | 77 |
| S2 | 1,081 | 210 | 170 | 79 | 0 | 0 | 8 | 5 | 20 |
| S3 | 159 | 20 | 29 | 7 | 3 | 1 | 2 | 0 | 3 |
| S4 | 152 | 14 | 33 | 8 | 5 | 0 | 2 | 0 | 3 |
| S5 | 3,160 | 371 | 650 | 360 | 143 | 85 | 17 | 3 | 64 |
| S6 | 700 | 79 | 70 | 22 | 0 | 0 | 6 | 2 | 7 |
| S7 | 1,236 | 121 | 132 | 32 | 0 | 0 | 5 | 0 | 15 |
| S8 | 210 | 25 | 35 | 11 | 3 | 1 | 2 | 0 | 3 |
| S9 | 162 | 15 | 37 | 13 | 1 | 0 | 2 | 0 | 1 |
| S10 | 594 | 21 | 122 | 16 | 0 | 0 | 5 | 0 | 3 |
| S11 | 180 | 17 | 43 | 12 | 4 | 0 | 2 | 0 | 2 |
| S12 | 715 | 24 | 112 | 25 | 155 | 55 | 6 | 0 | 11 |
| Total | 11,655 | 1,309 | 2,006 | 858 | 314 | 142 | 76 | 21 | 209 |

### S1: hidden assumptions lesson, L040/L041 freeze (43.4 h, 19 compactions, 11 aborted turns)

The longest session and the worst for repetition: 392 extra command executions and 273 extra re-reads. Top repeats: `vaults ctx` 54x (lines 19, 106, 4048, 5380); `./tbs lesson gate homeclass L043-conditional-reasoning` 18x (lines 1279-2415); `ls -lh` of the two lesson-facts files 17x (lines 8113-8846); `./tbs lesson locale homeclass L043-conditional-reasoning` 15x; `node _meta/services/tbs/l043-drip-flip.mjs --check` 11x (lines 4599-5555); `python3 bin/lesson-facts.py homeclass L040` 10x; `python3 bin/sensitive_window.py release --dry-run` 9x; `tbs status` 7x; `./tbs lesson ship homeclass L043-conditional-reasoning --no-deploy` 7x. The gate/locale/ship/facts/drip-check cluster is the same lesson verification loop re-run end to end many times. Top re-reads: `bin/preview-hub.py` 16x, `docs/lesson-facts/homeclass/L040.md` 18x, `CodingVault/thinking-brain-school/bin/preview-hub.py` 12x (same file reached by two path spellings; the counts above treat path spellings as distinct, so true per-file repetition is higher than the per-spelling counts). No GitHub calls at all in this session.

### S2: TBS site v10 handoff (43.1 h, 8 compactions, 5 aborted turns)

Orchestrator session: 6 `spawn_agent`, 150 `wait_agent`, 59 `send_message`, 23 `followup_task`. Top repeats: `vaults ctx` 27x; `vaults repo` 24x; `npm run verify:hero` 17x (lines 3913-4173); `npm run verify:v10:promotion` 15x; `tbs lock acquire .../tbs-www` 9x; `tbs publish --check --repo .../tbs-www` 8x. Top re-read: `revisions/v10/assets/site.css` 24x (lines 2678, 2810, 3175), plus `revisions/v10/assets/site.js` 7x and `scripts/check-hero-fullscreen.mjs` 7x. The verify loops (hero, v10 promotion) re-ran 32 times combined with no result caching visible in the record.

### S5: nexus-office Ask errors (27.6 h, 17 compactions, 3 aborted turns)

The GitHub-heaviest session and the worst for re-reads: 650 reads, 360 of them re-reads (55.4 percent). Top repeats: `vaults ctx` 66x; `vaults services restart com.aria.office-serve` 17x (lines 237, 1063, 2103, 4939, 5276); `npm run verify` 14x; `git status --short` 13x; `npm run complexity` 8x; `vaults live --list` 8x; `git fetch origin main` 7x; `vaults services status` 9x; `vaults live office` 7x. Top re-reads: `nexus/work.py` 29x, `client/phone/office.js` 29x, `client/office_ask.py` 24x, `nexus/tower.py` 18x, `nexus/ledger.py` 12x. GitHub: 143 calls, 85 of them repeats. `gh issue view 179 --repo ariaxhan/nexus-office --json title,body,state,comments,labels,url` 12x (lines 6123, 7612, 8049, 8060, 8250); `gh issue view 687` (repo `Thinking-Brain-School/tbs-www`) 9x (lines 15675, 15936, 16578, 16701, 17075); `gh issue comment 179` 8x (writes, not fetches); `gh issue view ${n}` 5x (a loop variable, meaning the same loop re-ran); `gh issue view 161` 5x; `gh issue view 692` 4x; `gh issue view 178` and `186` 4x each. The same two issues (179, 687) were re-fetched 21 times combined.

### S12: vault review and fixes (7.4 h, 6 compactions)

The other GitHub-heavy session: 155 calls, 55 repeats. `gh issue list` 15x, `gh pr list` 7x, `gh pr view 214` 4x, `gh pr diff 220` 4x, `gh pr view 220` 4x, `gh pr view 15` 3x, `gh issue view 16` 3x, `gh issue view 3` 5x across the sample. Status polling: `nexus status` 6x plus `nexus status --json` 3x; `hcom listen --name mame --timeout 1` 5x, a one-second listen poll. Top re-read: `_meta/reports/recovery-2026-09-06/session-clock.json` 7x (lines 4821, 4926, 5005, 5092, 5167), a status file re-read as a clock. Notable: this session already used MCP tools, `mcp__codex_app__get_usage_limits` 23x and `mcp__codex_app__automation_update` 6x, but only for Codex app internals (usage limits, automations), not for repo, GitHub, or vault state. MCP existed in this environment; it just did not cover the surfaces the agent polled most.

### S7: dead-lane continuation (5.7 h, 5 compactions)

Lane polling dominates: `bin/codex-lane await 873 --timeout 30` 14x (lines 330, 366, 409); `bin/codex-lane receipt 924` 10x; `bin/codex-lane receipt 873` 7x; `bin/codex-lane receipt 877; bin/codex-lane receipt 878` 6x; `bin/codex-lane await 877 --timeout 30` 6x; `bin/codex-lane receipt 925` 6x. The agent polled lane receipts in 30-second awaits instead of receiving completion events. The brief itself documents a handoff: lanes fuza and rile died, and this session re-ingested their state (`hcom events --agent kinu --type message --last 60`, `--agent fuza`, and similar history replays; `hcom` appears 402 times across the sample).

### S6: five-lesson revision pickup (16.2 h, 6 compactions, 2 aborted turns)

Explicit handoff session ("youre picking up for a different codex agent"): it re-reads `CLAUDE.md`, skills, and prior findings before doing anything, including `.claude/skills/homeclass-revise/SKILL.md` 3x and `findings/2026-09-16-homeclass-audit/FIVE-LESSON-REVISIONS.md` 4x. Top repeats: `vaults ctx` 18x; `pgrep -fl 'tbs-board.mjs'` 6x; `git log --oneline origin/main..HEAD` 6x; `tbs preview deploy` 6x. Also an orchestrator: 156 `wait_agent`, 75 `send_message`, 41 `followup_task`.

### S10: package reviewer (6.5 h, 124 turns, 5 compactions)

The highest turn count with the lowest repetition: 594 commands, only 21 extra repeat executions. The most repeated command is `date -u '+%Y-%m-%dT%H:%M:%SZ'` 12x (lines 1955, 2208, 2653), a clock poll; the session also used `clock__curr_time` and, unusually, 106 `js` function calls. `CLAUDE.md` re-read 4x (lines 16, 32, 38). Repetition scales with session messiness, not with turn count: this tidy review loop barely repeats anything.

### S3/S4/S8/S9/S11: Sep 23 00:30 overnight lesson lanes

Five parallel single-turn lanes (L005, L009, L012, L013, L017), each 0.6 to 1.9 hours, each starting from the same brief. Within-session repetition is modest (14 to 25 extra command executions each), but the same briefing files were ingested separately by every lane: `docs/lesson-ops.md` 9 reads across the five lanes (10 including S1); `_meta/run/overnight-2026-09-22/BRIEF.md` 6 reads across four lanes; `.agents/skills/lesson/SKILL.md` 9 reads across all five lanes; `bin/lessonview.mjs` 17 reads across six sessions; `bin/lesson-media.py` 18 reads across six sessions. Each lane also re-ran its own lesson facts command (`python3 bin/homeclass-lane.py facts 009` 7x in S3, `facts 012` 7x in S8, `facts 005` 4x in S4, `facts 013` 4x in S11, `facts 017` 7x in S9) and re-fetched its own issue (`gh issue view 487` 2x in S3, `gh issue view 490` 2x in S8). A shared briefing resource would have served all five lanes once instead of five times.

## Context loss and restarts

- No sampled session shows a resume: every file has exactly one `session_meta` record. The restart points are compactions and aborted turns, not session reopens.
- 76 compactions across 12 sessions. S1 compacted 19 times (lines 965, 2619, 4004, 5455, 6329, 7781, 9767, 11804, 13461, 14027, 14622, 15968, 17272, 18624, 19669, 21294, 22282, 23795, 25090); S5 compacted 17 times (lines 1125, 1946, 3758, 5163, 5968, 7174, 9077, 10223, 12114, 14052, 15339, 16446, 17427, 18421, 19869, 21234, 22649).
- 209 files were read both before and after a compaction in the same session. Concrete cases in S5 across the first compaction (line 1125): `client/phone/office.js` 2 reads before, 27 after; `nexus/work.py` 3 before, 26 after; `client/office_ask.py` 4 before, 20 after; `nexus/tower.py` 2 before, 16 after. In S1 across the first compaction (line 965): `CodingVault/tbs-homeclass/tools/hc-teachability.py` 2 before, 4 after; `CodingVault/thinking-brain-school/bin/lesson-new.py` 2 before, 1 after; `CodingVault/thinking-brain-school/docs/lesson-ops.md` 1 before, 1 after.
- 21 aborted turns (S1: 11, S2: 5, S5: 3, S6: 2). Aborts cluster in the two longest sessions.
- Handoff re-ingestion appears twice as brief text, not as a counted repeat: S6 picks up from another agent and re-reads the rulebooks; S7 continues dead lanes and replays their message history. Both are context loss across agents rather than within one session.

## Negative results (what did NOT repeat)

- Search is high volume but almost never repeated verbatim: `vaults find` ran 1,021 times with 1,018 distinct queries; `rg` ran 811 times with 807 distinct patterns. A search-result cache would barely help; the waste is in state checks, reads, and verifications, not searches.
- Ad-hoc `python3 - <<'PY'` heredoc scripts ran 1,673 times, almost all distinct (S1 alone: 455 occurrences, 443 distinct). Each one re-implements small JSON inspection or comparison logic inline. This is not repetition; it is the absence of a structured query tool, so it is listed as an observed pattern, not counted waste.
- GitHub waste is concentrated, not general: 5 of the 12 sessions made zero GitHub calls. S5 (143) and S12 (155) account for 298 of the 314 GitHub invocations.
- `agentdb` memory calls are light: 217 total, with `agentdb read-start` 5x, `agentdb write-end` 4x, `agentdb recall` 3x as the top repeats.

## What an MCP server would address, mapped to the measurements

1. Workspace state as a live resource. `vaults ctx` 169x, `vaults repo` 29x, `nexus status` 9x (6 plain plus 3 `--json` in S12), `tbs status` 7x (S1), `git status --short` 32x, `vaults live --list` 16x, `vaults services status` 9x (S5). One state resource with change notification replaces this polling class outright.
2. GitHub issues and PRs as cached resources. 212 view/diff fetches, 46 issue/PR numbers viewed 2 or more times, `gh issue view 179` 12x and `gh issue view 687` 9x in S5, plus 35 list queries. An MCP GitHub resource that serves cached issue bodies and invalidates on change removes the re-fetch loop.
3. File content as a resource with staleness tracking. 2,006 reads, 858 re-reads (42.8 percent), top files read 20 to 30 times per session, 209 files re-read across compactions. A resource that returns content once and notifies on change removes both the polling re-reads and the post-compaction re-reads.
4. Lane and agent completion as events, not polls. `bin/codex-lane await/receipt` polling in S7 (14x for one lane await), `hcom listen --timeout 1` in S12, 782 `wait`/`wait_agent` calls, `clock__curr_time` 141x plus `date -u` 12x in S10. Push notification for lane completion and agent messages replaces the await loops.
5. Lesson gates and verifications as cached checks. `./tbs lesson gate` 18x and `./tbs lesson locale` 15x for L043 in S1, `npm run verify:hero` 17x and `npm run verify:v10:promotion` 15x in S2, `npm run verify` 14x in S5. A check that records its inputs and reuses a green result until an input changes removes the re-verification loop.
6. Briefing and rule content as shared resources. `CLAUDE.md` read 18 times across 11 of 12 sessions; the five overnight lanes each re-ingested the same brief, ops doc, and skill files. One shared resource serves every lane and every handoff.
7. Structured data queries instead of heredoc scripts. 1,673 one-off `python3 -` scripts, nearly all distinct, mostly JSON inspection. A query tool over lesson content and release state would replace the script-per-question pattern. This is a pattern observation, not a counted repeat.

## What could not be measured

- Dollar cost: rollouts carry token counts but no pricing, so no dollar figure is computed here. At least 215,615 output tokens from repeat executions were re-fed into context (lower bound, 561 attributed occurrences); the full repeat cost is higher, since only 561 of 1,309 repeat executions had attributable output token counts, and re-read input tokens are not separated from the 1.84 billion cumulative input tokens.
- Wall-clock waste: per-command wall time exists in the output records but was not aggregated in this pass. A follow-up pass could sum `wall_time_seconds` for repeat executions.
- Necessity: the rollouts do not record whether a file changed between two reads of it, so a re-read cannot be classified as necessary or wasteful from the record alone. The counts above measure repetition exactly; avoidability is bounded, not proven. The cleanest avoidable cases are the no-argument state polls (`vaults ctx`, `nexus status`, `tbs status`) and same-issue re-fetches within minutes.
- Scope: the sample is the 12 largest of 936 files (1.3 percent of files, 27 percent of bytes). Rates measured here (11.2 percent of commands repeated, 42.8 percent of reads re-reads) describe large multi-step sessions and should not be extrapolated to the whole archive without a random sample. The Sep 23 00:30 cluster (5 of 12 files) also weights the sample toward parallel lesson lanes.
