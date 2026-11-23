# Antigravity Findings: Where an MCP Server Would Have Helped

Date: 2026-11-22. Analyst: Muse (subagent measurement task).
Sources: `~/workspace/user/transcript-archive/studio/` (read only; nothing under the archive was modified).

## Headline

No tool-call transcript exists in any of the named sources, so per-run tool-call counts, step counts, and durations cannot be measured. What can be measured is substantial: prompt text and file references repeat heavily across runs, and the same setup, lookup, and verification work recurs in every lane.

- **148,020 bytes of prompt text are exact-line repeats**, 27.3% of all 542,897 prompt bytes across 134 lanes. This is a lower bound: the count covers only lines of 40+ characters that match exactly, and misses short lines and near duplicates.
- **The single largest repeat is one 13,946-byte reference block** (the L042 narration exemplar) pasted byte-identically into 8 narration prompts. Seven of the eight copies are redundant: 97,622 bytes.
- **The same 10,196-byte shared brief** sits inside each of 4 Oct 6 anchor-format prompts; only 8-9 lines per prompt are lesson-specific. Three copies are redundant: 30,588 bytes.
- **Every lane re-runs the same setup**: the credential warning appears in 133 of 133 out.logs, the keychain PASS line in 129, the run line in 129.
- **7 duplicate-task pairs** ran the same job twice, including 2 pairs with byte-identical prompts where the first attempt produced nothing (0-byte output, keychain abort) and the second re-did the work from scratch.
- **31 of 42 lessons were touched by 3 or more lanes**; L046 by 16 lanes, L011 by 13. Each lane re-read the lesson files fresh; no shared read cache is visible in the records.
- **504 identical "not logged into Antigravity" errors** across 10 CLI log files, about 50 per startup, with no tool-call record in any of them.

## What the sources actually contain

The task named four sources. Two of them hold no run records at all. This shapes everything below.

| Source | What is there | What is missing |
|---|---|---|
| `antigravity/history/` (14 project dirs) | Only a `.project_root` file per project (one path line each). 14 files total. | No run histories, no transcripts, no tool calls. |
| `antigravity/antigravity-cli/conversations/` | Empty directory (0 files). | No conversation records. |
| `antigravity/antigravity-cli/conversation_summaries.db` | SQLite table `conversation_summaries`, schema present. | 0 rows. |
| `antigravity/antigravity-cli/log/` | 10 CLI startup logs, 1,252 lines total, Sep 2 to Oct 6 2026. | Server startup lines only; 1-2 lines per file mention "tool" and none is a tool call. |
| `antigravity/antigravity-cli/implicit/` | One 624-byte protobuf file (`411819c6-...ec1c4.pb`), opaque binary. | Not parseable as a transcript. |
| `agy-lanes/agy-lanes/` | 138 lane dirs; 134 with `prompt.txt`, 133 with `out.log`, 130 with `rc`. | No tool-call trace. `meta.txt` is 1 byte (a newline) in all 134 lanes. No timestamps inside any lane file; only the directory name carries a date. |
| `output-rollout/rollout/` | 13 changelog files across 9 lessons (L001, L002, L003, L004, L007, L011, L015, L019, L051) plus TA-CANON docs. | Changelogs record outcomes, not agent steps. |

Consequence for measurement: `out.log` is the agent's final output text only (a report, a JSON payload, a copy draft). It is not a trace. Repeated file reads inside a run cannot be observed directly; they can only be bounded from below by repeated references in the prompt and output text, which is what this report does. Every number below is either a direct count from these files or is labeled as a lower bound.

Lane outcomes, for context: 129 of 138 lanes exited 0 (127 `rc` files read `0` with newline, 2 read `0` without), 1 exited 143 (`agy20261001T00394710868`, a `--help` probe), and 8 lanes have no `rc` file at all. Four of those 8 are the stillborn Sep 21 lanes described below.

## Sample

10 substantial lanes, picked by size and spread across task types and dates. Total sample: 211,710 prompt bytes (39.0% of all prompt bytes) and 48,766 output bytes.

| # | Lane | Task | Prompt | Output | rc |
|---|---|---|---|---|---|
| 1 | `agy20260928T07451456934` | Narration script, HomeClass L018 (Little Prince) | 47,921 B / 304 lines | 2,494 B / 20 lines | 0 |
| 2 | `agy20260928T07451456899` | Narration script, HomeClass L006 (Gatsby) | 42,515 B / 284 lines | 1,555 B / 18 lines | 0 |
| 3 | `agy20260928T07515182843` | Narration script, HomeClass L010 (Odyssey) | 36,518 B / 287 lines | 537 B / 5 lines | 0 |
| 4 | `agy20260928T07451556966` | Narration script, HomeClass L022 (Animal Farm) | 34,291 B / 256 lines | 1,578 B / 12 lines | 0 |
| 5 | `agy20260928T07451456912` | Narration script, HomeClass L014 (Crime and Punishment) | 33,650 B / 216 lines | 1,690 B / 16 lines | 0 |
| 6 | `agy20260930T02333394190` | Gamification copy JSON (XP/badges/draw, KR+EN) | 2,233 B / 16 lines | 10,658 B / 253 lines | 0 |
| 7 | `agy20261002T17435547419` | HomeClass L016 Gen 2 copy fixes (11 items) | 472 B / 1 line | 10,969 B / 137 lines | 0 |
| 8 | `agy20261002T1738003386` | Copy author, HomeClass L028 (fill [[COPY]] slots) | 745 B / 1 line | 6,866 B / 75 lines | 0 |
| 9 | `agy20261006T16031377957` | Anchor-format revision, HomeClass L007 | 12,886 B / 85 lines | 5,121 B / 55 lines | 0 |
| 10 | `agy20261002T17475749074` | HomeClass L004 Gen 2 copy fixes (7 items) | 479 B / 1 line | 7,298 B / 65 lines | 0 |

Two prompt shapes dominate the corpus and both appear in the sample. Pointer-style: a single line naming a brief file to read (91 of 134 prompts, including 8 `--help` probes). Inline: the whole brief, reference material, and lesson text pasted into the prompt (14 prompts are 10 KB or larger; 29 more are multi-line under 10 KB).

## Per-run findings

### Run 1: narration L018, `agy20260928T07451456934`

- Size: prompt 47,921 B, output 2,494 B. No duration or step count recorded.
- Repeated file reads: the output path `output/narration-L018.json` is named 2 times in the prompt (task line and "Write ONLY output/narration-L018.json" line) and 2 times in the output. No other file is named.
- Repeated lookups: the full L042 reference narration block (13,946 B, 94 lines, section "REFERENCE L042 NARRATION:" in `prompt.txt`) is pasted inline. The same block appears in 7 other lanes (see aggregate).
- Within-prompt duplication: 6 field pairs carry identical values under both `young_kr` and `kr` keys (for example `text.young_kr` equals `text.kr` on page 1, and the same for `explain`, `lead`, `story`, `after` fields across pages). The lesson page dump repeats the same sentence twice whenever the young and standard texts match.
- Re-verification: none visible in the output (20 lines, a short completion note).
- No issue references, no handoff point.

### Run 2: narration L006, `agy20260928T07451456899`

- Size: prompt 42,515 B, output 1,555 B.
- Repeated file reads: `output/narration-L006.json` named 2 times in the prompt and 2 times in the output.
- Repeated lookups: identical 13,946 B L042 reference block, byte-identical to run 1.
- Within-prompt duplication: 2 lines of 40+ characters appear twice each (2 extra occurrences), plus 3 identical `young_kr`/`kr` field pairs.
- Re-verification: none visible.

### Run 3: narration L010, `agy20260928T07515182843`

- Size: prompt 36,518 B, output 537 B (5 lines, the shortest output in the sample).
- Repeated file reads: `output/narration-L010.json` named 2 times in the prompt, 0 times in the output.
- Repeated lookups: identical 13,946 B L042 reference block.
- Within-prompt duplication: the highest in the sample. 9 distinct lines of 40+ characters repeat, 10 extra occurrences total, including one line appearing 3 times ("almost 2,800 years..." Odyssey framing sentence). Plus 6 identical `young_kr`/`kr` field pairs.
- Re-verification: none visible.

### Run 4: narration L022, `agy20260928T07451556966`

- Size: prompt 34,291 B, output 1,578 B.
- Repeated file reads: `output/narration-L022.json` named 2 times in the prompt and 2 times in the output.
- Repeated lookups: identical 13,946 B L042 reference block.
- Within-prompt duplication: 2 repeated lines (2 extra occurrences), plus 2 identical `young_kr`/`kr` field pairs.

### Run 5: narration L014, `agy20260928T07451456912`

- Size: prompt 33,650 B, output 1,690 B.
- Repeated file reads: `output/narration-L014.json` named 2 times in the prompt and 2 times in the output.
- Repeated lookups: identical 13,946 B L042 reference block.
- Within-prompt duplication: 1 repeated line (1 extra occurrence), plus 4 identical `young_kr`/`kr` field pairs.

Narration subtotal (runs 1-5): 21 identical `young_kr`/`kr` field pairs across 5 prompts; 15 extra repeated-line occurrences; 5 extra output-path mentions in prompts; and 4 redundant copies of the L042 block within the sample alone (55,784 bytes).

### Run 6: gamification copy, `agy20260930T02333394190`

- Size: prompt 2,233 B, output 10,658 B / 253 lines (the longest output in the sample; a JSON payload of XP levels, badges, and draw copy in Korean and English).
- Repeated file reads: none. The prompt names no file; the output names no file.
- Repeated lookups: none.
- Re-verification: none visible; the output is pure payload with no verification section.
- This run is the clean case: a short brief, no reference paste, no repeated reads. It shows the waste is concentrated in the reference-heavy task families, not spread evenly.

### Run 7: L016 Gen 2 fixes, `agy20261002T17435547419`

- Size: prompt 472 B (1 line), output 10,969 B / 137 lines.
- Repeated file reads: the brief path `.../thinking-brain-school/output/lesson/homeclass/L016-rev/copy-brief.md` is named 2 times in the single-line prompt ("Read ... in full, then apply ONLY its final section..."). The prompt also orders the agent to re-read the one canonical `content.json` the brief names, so the run's file reads are: brief (named twice), then content.json. The output's before/after report names the L016 content.json once, as a link in the opening line.
- Repeated lookups: none beyond the brief double mention.
- Re-verification: explicit. The output ends with a "Verification" section reporting JSON parses cleanly, zero remaining `[[COPY` slots (grep count = 0), and zero em dashes. The prompt itself orders this re-check ("Finish by confirming the JSON parses, there are zero em dashes"). The same three checks recur across lanes (see aggregate).
- Output duplication: 3 lines of 40+ characters repeat in the output (4 extra occurrences), all repeated "After:" sentences where the same replacement text was applied to multiple age arms. This is report duplication, not re-reading, and is noted for completeness.
- Handoff point: this lane is the second of a duplicate pair. An earlier lane the same day (`agy20261002T1738013626`, 38 minutes earlier) ran the same L016 brief with a shorter prompt (381 B) and produced a much shorter output (2,855 B vs 10,969 B). The second agent re-read the brief and re-did the work. See "Context loss and handoff points".

### Run 8: copy author L028, `agy20261002T1738003386`

- Size: prompt 745 B (1 line), output 6,866 B / 75 lines.
- Repeated file reads: the brief path `.../output/lesson/homeclass/L028-rev/copy-brief.md` is named 2 times in the prompt ("Read the brief at ... completely and execute it exactly. It names the one file...").
- Repeated lookups: none beyond the brief double mention.
- Re-verification: the prompt orders the finish conditions (zero `[[COPY` remaining, JSON parses, zero em dashes). The output contains no separate verification section.
- No issue references, no handoff point.

### Run 9: anchor-format revision L007, `agy20261006T16031377957`

- Size: prompt 12,886 B / 85 lines, output 5,121 B / 55 lines. The densest run in the sample for repeated references.
- Repeated file reads in the prompt (28 total path mentions, 16 unique): 8 paths are named 2 or more times.
  - `.../tbs-homeclass/_review/homeclass-next-ten-2026-09/L011/content.json` x2 (the L011 exemplar)
  - `.../thinking-brain-school/findings/2026-10-02-homeclass-discussion-format-spec.md` x2
  - `.../tbs-homeclass/_review/AGE-SPLIT.md` x2
  - `.../thinking-brain-school/findings/homeclass-aria-notes.md` x2
  - `.../thinking-brain-school/output/rollout/L0NN/rollout-additions-changelog.md` x2
  - `content.json` x4, `TA-CONTEXT.md` x4, `SOURCES.md` x2 (basenames; see caveat in aggregate section)
- Repeated file reads in the output: the four L007 lesson files are each named twice (`content.json`, `narration.json`, `narration.en.json`, `TA-CONTEXT.md` under `.../homeclass-sixteen-2026-09/L007/`), once as a plain path and once as a `file:///` link.
- Repeated lookups: issue #585 is cited once in the prompt (guided discussion format). L011 is cited as the model lesson, and L003/L007 appear as rollout references.
- Re-verification: none visible as a verification section.
- Handoff point: this prompt shares 60 non-empty lines (10,196 bytes) verbatim with the 3 other Oct 6 anchor-format lanes. Only 8 lines of its 68 non-empty prompt lines are unique to this lane. See aggregate.

### Run 10: L004 Gen 2 fixes, `agy20261002T17475749074`

- Size: prompt 479 B (1 line), output 7,298 B / 65 lines.
- Repeated file reads: the brief path `.../output/lesson/homeclass/L004-rev/copy-brief.md` is named 2 times in the single-line prompt. The prompt orders the same finish checks as run 7 (JSON parses, zero em dashes, list each field changed).
- Repeated lookups, re-verification: same shape as run 7, no separate verification section in the output.
- Handoff point: second of a duplicate pair. An earlier lane (`agy20261002T17391724172`, 48 minutes earlier) ran the same L004 brief with a shorter prompt (308 B) and a shorter output (3,751 B vs 7,298 B).

### Sample totals

- Repeated file-path mentions inside single runs: at least 20 extra mentions across the 10 sampled prompts (5 narration output paths x1 extra each, 3 copy-brief paths x1 extra each, 12 extra mentions in the run 9 prompt). Lower bound: this counts references in prompt text, not actual reads, which are unrecorded.
- Repeated lines inside single runs: 15 extra occurrences in sampled prompts (all in narration runs), 4 extra in sampled outputs (all in run 7).
- Repeated lookups inside the sample: 5 copies of the identical 13,946 B L042 block (4 redundant, 55,784 bytes); the L011 exemplar, AGE-SPLIT.md, aria-notes, and discussion spec each named twice in run 9 alone.
- Re-verification inside the sample: 1 explicit verification section (run 7); 3 prompts ordering the same finish checks (runs 7, 8, 10).

## Aggregate across the sample and the full corpus

All corpus figures below cover all 134 lanes with prompts (542,897 prompt bytes, 3,288 prompt lines) and all 133 lanes with outputs (312,846 output bytes, 3,668 output lines), unless stated.

### Total repeated reads and lookups

- Exact-line prompt duplication: 155 distinct lines of 40+ characters appear in 2 or more lanes (44 lines in exactly 2 lanes, 5 in 3 lanes, 60 in 4 lanes, 46 in 8 lanes). Extra copies total **148,020 bytes**, 27.3% of all prompt bytes. Lower bound for the reasons stated above.
- Of that 148,020, the L042 block lines account for 92,358 bytes by the line method; by whole-block math the block is 13,946 B x 8 lanes = 111,568 B sent, 97,622 B redundant.
- The Oct 6 anchor-format shared brief accounts for a further 30,588 redundant bytes (10,196 B shared x 3 extra copies), inside the 60-lines-in-4-lanes bucket.
- Repeated path mentions in prompts, whole corpus: `content.json` 68 mentions in 40 lanes; the L046 suno-pack 20 mentions in 12 lanes; AGE-SPLIT.md 20 mentions in 10 lanes; L011 content.json 16 mentions in 8 lanes; TA-CONTEXT.md 16 mentions; homeclass-korean-writing.md, homeclass-aria-notes.md, and the discussion format spec 12 mentions each in 6 lanes each.
- Setup lines in outputs: the credential warning ("no tbs-gh-readonly credential found; gh will be unauthenticated in this silo") appears in 133 of 133 out.logs; the keychain PASS line in 129; the `tbs-agy run:` line in 129. The keychain-db path is the single most repeated path in outputs (129 lanes).
- Verification repetition in outputs: 32 lanes carry a "Verification" section; 59 mention "em dash"; 28 report "Zero em dashes"; 5 mention "grep"; 3 mention "JSON.parse"; 4 mention "md5"; 21 use the word "verified". Each lane re-runs the same checks on its own file with no shared result.
- Issue lookups: issue #585 is cited 4 times in prompts and 17 times across 5 rollout changelogs; #588 12 times and #589 7 times across the authoring changelogs. The same issue context is re-established per lesson.

### Top 5 most-repeated files (prompts, whole corpus)

By total mentions, basename matches included. Caveat: `content.json` and `TA-CONTEXT.md` are basenames that refer to different lesson files in different lanes, so their counts measure the repeated pattern (every lane names its lesson content file), not repeated reads of one file. The full-path rows are exact.

| Rank | File | Total mentions | Lanes |
|---|---|---|---|
| 1 | `content.json` (basename; many lesson files) | 68 | 40 |
| 2 | `output/lesson/littlehello/L046-media/suno-pack.md` | 20 | 12 |
| 3 | `.../tbs-homeclass/_review/AGE-SPLIT.md` | 20 | 10 |
| 4 | `.../tbs-homeclass/_review/homeclass-next-ten-2026-09/L011/content.json` | 16 | 8 |
| 5 | `TA-CONTEXT.md` (basename; many lesson files) | 16 | (see note) |

Top 5 by exact full path only: AGE-SPLIT.md (20 mentions, 10 lanes), L011 content.json (16, 8 lanes), `.../thinking-brain-school/docs/homeclass-korean-writing.md` (12, 6 lanes), `.../thinking-brain-school/findings/homeclass-aria-notes.md` (12, 6 lanes), `.../thinking-brain-school/findings/2026-10-02-homeclass-discussion-format-spec.md` (12, 6 lanes). The L046 suno-pack path is relative but refers to one file (20, 12 lanes).

### Top 5 most-repeated lookup patterns (whole corpus)

| Rank | Pattern | Count |
|---|---|---|
| 1 | L042 reference narration block pasted inline (13,946 B each) | 8 lanes, 1 distinct text, 97,622 redundant bytes |
| 2 | Oct 6 anchor-format shared brief (10,196 B shared per prompt) | 4 lanes, 60 shared lines, 30,588 redundant bytes |
| 3 | Copy-brief pointer: single-line prompt naming a `.../L0NN-rev/copy-brief.md` twice | 91 single-line prompts corpus-wide; 4 lessons re-run as duplicate pairs (L016, L004, L032, L044) |
| 4 | Per-lane silo setup (credential warning + keychain PASS + run line) | 133 / 129 / 129 lanes; the keychain path is the top output path |
| 5 | Same-lesson re-entry: one lesson touched by many lanes, each re-reading its files | L046 in 16 lanes, L011 in 13, L045/L047/L048 in 9 each; 31 of 42 lessons in 3+ lanes |

### Cross-lane lesson rework

42 distinct lessons are referenced across prompts. 31 appear in 3 or more lanes. The top counts: L046 (16 lanes, LittleHello suno-pack and review wave), L011 (13, the v2 exemplar and revision target), L045, L047, L048 (9 each), L042 (8, the narration reference), L014, L001, L004 (7 each). L042's 8 appearances are all as the pasted reference, not as work targets; the rest are work targets re-entered lane after lane.

## Context loss and handoff points

No compaction or handoff event is recorded in the lane files (no transcript, no continuation marker). The following are visible from prompt and output comparison.

1. **L011 revision, byte-identical prompt run twice.** `agy20261004T19530699872` (prompt 4,045 B) produced a 0-byte out.log and has no `rc` file. `agy20261004T195421895` (identical prompt, 4,045 B, 15 minutes later) produced a 3,807 B output. The second agent started from the same brief with no record of the first attempt.
2. **LittleHello 46 Suno pack, byte-identical prompt run twice.** `agy20260930T20325593003` (prompt 1,072 B) aborted at launch: "aborting launch, silo keychain is not the writable default" (307 B out.log, no `rc` file). `agy20260930T20434596276` (identical prompt, 50 minutes later) ran and produced a 1,293 B output. Setup failed, then the whole job re-ran.
3. **Copy-brief second passes, 4 lessons.** L016, L004, L032, and L044 each have two lanes on Oct 2 reading the same `copy-brief.md`, the second 35 to 50 minutes after the first, with a longer prompt each time (L016: 381 B then 472 B; L004: 308 B then 479 B; L032: 224 B then 416 B; L044: 248 B then 302 B) and a different-length output. The pattern reads as retry after an insufficient first attempt, with the second agent re-reading the full brief and re-doing the work rather than continuing from the first agent's state.
4. **V2 exemplar revision pair.** `agy20261005T16453992538` and `agy20261005T16453992547` ran the same minute with near-identical prompts (3,067 B vs 3,173 B) and different outputs (2,387 B vs 3,409 B). Two agents doing the same revision in parallel or in immediate succession.
5. **Eight `--help` probe lanes.** Eight lanes carry the 6-byte prompt `--help`, spread over Sep 28 to Oct 2. Six produced near-identical ~3.2 KB help output and exited 0; one was killed (rc 143, `agy20261001T00394710868`, 87 B output); one has no `rc` file (`agy20261001T0205572360`, 87 B output). Same smoke check, repeated across 5 days, each re-running the silo setup lines.
6. **Four stillborn Sep 21 lanes.** `agy20260921T08281924225`, `agy20260921T08291730035`, `agy20260921T08303037573`, `agy20260921T08335952318` have 0-byte prompts, 0-byte outputs, and no `rc` file. Lane records created with no work in them.
7. **No lane reuses another lane's session.** Every out.log re-establishes the silo from scratch (credential warning, keychain check, run id). There is no record of any lane reading a prior lane's output as input, except the duplicate pairs above, which re-read the original brief instead.

## CLI logs: repeated failure, no usable trace

The 10 files in `antigravity/antigravity-cli/log/` total 1,252 lines, all language-server startup logging. The dominant repeated content is the auth failure "You are not logged into Antigravity": 504 occurrences total (58, 50, 42, 62, 46, 53, 42, 47, 54, 50 per file), roughly 40% of all log lines, repeated identically at every startup across Sep 2 to Oct 6. No tool call, agent step, or conversation event appears in any of the 10 files. The logs establish that the CLI started repeatedly without a login; they cannot support any per-run measurement.

## Rollout changelogs: same issues, same checks, per lesson

13 changelog files across 9 lessons. The 4 authoring changelogs (L001, L002, L004, L011) each repeat the same verification battery in a "Verification Evidence" section: `hc-teachability.py` PASS, em dash scan 0, British spelling scan 0, say-it-out-loud scan 0 (3 of 4), physical materials scan 0 (3 of 4). Issue citations repeat per lesson rather than living in one place: #585 is cited 17 times across 5 changelogs (L001 x5, L002 x6, L004 x2, L011 x3, L015 x1), #588 12 times across 4, #589 7 times across 4, #587 4 times across 4. Each authoring changelog also re-states the same exemplar model (L004 persuasion benchmark, L011 logic exemplar) and the same standardized ending suite (`learned`, `callout`, `questionbank`, `aiprompts`, `wonder`). Example: `output-rollout/rollout/L001/authoring-changelog.md`, sections "Per-Page Changes" and "Verification Evidence".

## Where an MCP server would have helped

Each item below is tied to a measured count. No time or token savings are claimed, because durations and token counts are not recorded anywhere in the sources.

1. **Reference exemplar as a retrievable resource, not a paste.** The 13,946 B L042 block was sent 8 times (111,568 B) when one fetch would do. An MCP resource (`narration-exemplar://L042`) removes 97,622 redundant bytes from this corpus alone, and the same shape recurs with the L011 exemplar (16 mentions, 8 lanes) and the Oct 6 shared brief (30,588 redundant bytes). Bound: at least 128,210 redundant bytes across these two blocks in this corpus (97,622 + 30,588).
2. **Shared lesson state.** 31 lessons were re-entered by 3+ lanes each, and the same canonical docs (AGE-SPLIT.md, aria-notes, discussion spec, Korean writing guide) were re-named 12 to 20 times each. A lesson-state MCP (get lesson files, get canonical guidance, get exemplar) replaces per-lane re-reads with one cached read per lesson per change. Bound: at least 68 `content.json` mentions across 40 lanes and 56 mentions of the four canonical docs combined.
3. **Brief as a structured lookup, not a re-read.** 91 of 134 prompts are single-line pointers at a brief file, and 4 lessons had the same brief executed twice within the hour. An MCP tool that returns the brief's parsed sections (and the run history for that lesson) would let a retry continue from the first attempt instead of re-reading and re-doing it. Bound: at least 7 duplicate-task pairs in this corpus.
4. **Verification as a shared check, not a per-lane ritual.** The same checks (JSON parse, em dash grep, `[[COPY` grep, md5, hc-teachability) were re-run and re-reported in 32 verification sections and 4 authoring changelogs. An MCP verification tool returning a cached pass/fail per file hash would cut the re-checking to changed files only. Bound: at least 32 lanes re-reporting verification, 28 re-reporting "Zero em dashes".
5. **Session and setup state.** Every lane re-ran the credential warning and keychain check (133 and 129 lanes), and one launch aborted on a keychain default that a prior lane had already established. A persistent session or environment-status resource would make the second through 133rd setup checks unnecessary. Bound: at least 129 repeated keychain verifications.
6. **Issue context.** #585, #588, #589, and #587 were re-cited 44 times across prompts and changelogs (#585: 4 in prompts plus 17 in changelogs; #588: 12; #589: 7; #587: 4). An issue-context resource would let each lane fetch the issue once instead of re-establishing its meaning per lesson.

## Limitations: what cannot be measured from these sources

- Tool calls per run, steps per run, and run duration: not recorded anywhere. `meta.txt` is empty, `out.log` has no timestamps, and no trace files exist. Do not quote step or duration figures for these runs; none exist.
- Actual file reads: only references in prompt and output text are countable. A file named twice in a prompt was not necessarily read twice, and a file read but never named is invisible. All read counts here are reference counts and are labeled as lower bounds.
- Token or cost figures: no token counts exist in the archive. Byte counts of repeated text are reported instead, with no conversion to tokens or dollars.
- Whether duplicate pairs were retries, parallel runs, or deliberate re-runs: the records do not say. The timing and prompt growth are consistent with retries, but intent is not recorded.
- The history dirs and conversation store are empty, so Antigravity IDE runs (as opposed to agy-lane CLI runs) contribute zero measurable data. All findings above come from agy-lanes, the CLI logs, and the rollout changelogs.

## Method note

Counts were produced by two Python scripts (`/tmp/measure_agy.py`, `/tmp/measure_agy2.py`) reading the archive read-only. Repeated lines were counted on exact matches of stripped lines 40+ characters long. Paths were matched with regexes for absolute `/Users/...` paths, `output/`-style relative paths, and `*.json|md|py|js|ts|html|css|txt|sh` filenames. Issue references were matched as `#` followed by 2-4 digits. Lesson references were matched as `L0NN`. Byte counts are UTF-8 bytes. The L042 block was measured as the text between `REFERENCE L042 NARRATION:` and the `LESSON L` page dump header in each prompt; all 8 copies are byte-identical (1 distinct text). The Oct 6 shared brief was measured as the intersection of non-empty prompt lines across the 4 lanes (60 lines, 10,196 bytes).
