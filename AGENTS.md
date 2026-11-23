# AGENTS.md: fleet-mcp repo rules

## Writing

- No em dashes in any writing: docs, code comments, commit messages, issue text, paper text. Use commas, colons, or parentheses instead.
- Every measured number cites its source. A number without a citation is labeled as a target, a threshold, or a design decision, never as a measured result.

## Scope boundary (hard)

- This is a personal project with its own corpus. Never read, ingest, quote, or serve TBS data, TBS repos, TBS issues, or TBS MCP server content.
- Benchmark tasks are drawn from personal-project work only.
- Boundary tests use synthetic excluded identifiers and never contact excluded systems.
- The TBS Teaching MCP server is a pattern reference only (hosted, typed tools, live data). Its content is never copied into this repo.

## Evidence standard (binding, Aria Nov 22, 2026)

1. Preregister hypotheses, methods, and success criteria before the "with" side runs.
2. Controlled experiments with a real control group, enough runs for significance, and confidence intervals, not just point estimates.
3. Traceability: every number traceable to raw data (archive transcripts, run logs, measurements, analysis).
4. Independent verification by a party other than the producer.
5. UNPROVEN labeling: if a result cannot be proven, report it as UNPROVEN with what it would take to prove it.
6. Full reporting: never inflate, never round up, never present a suggestive result as a proven one. Null results are reported as results.

## Preregistration rule

- Hypotheses, methods, success criteria, the ranked task pool with its selection rule and seed, the exact model ID, the cache condition per run, and the analysis plan freeze in `bench-prereg-v1` (git tag plus SHA-256 plus a remote timestamped registration record) BEFORE the first "with" run, pilot included.
- Amendments are dated entries under a new tag. The original preregistration stays in the repo.

## Gates (hard ordering)

- G0 revision gate: PRD v2 committed, every review item addressed with a dated revision note, paper skeleton aligned. No build work starts before G0.
- G1 spike verdict: all eight proof criteria from the execution plan evaluated, dated go/no-go recorded. No full build on an unproven platform claim.
- G2 build gate: the full-v1 acceptance matrix green on real personal-project data.
- G3 benchmark gate: preregistration frozen before the first "with" run; all 120-plus runs executed per the frozen protocol with complete capture; independent verification complete with a receipt. No result published before G3.
- G4 commission gate: all seven deliverables meet their acceptance criteria (execution plan Section 10).

## Verification

- Done means a commit on main, verified on its surface by the owning chat, never from another agent's report.
- An implementing agent's own tests are not evidence. Reviewers use the system for real results.
- A missing artifact is a recorded data-loss failure, never silently reconstructed evidence.

## Issues

- Every issue carries a `## Acceptance` heading plus at least one unchecked checkbox. Runner intake silently drops issues that lack them.
- Every issue body carries the scope boundary from this file.

## Ownership

- The Unified MCP Server chat owns this domain. Main routes to it and never orders execution into a non-owning chat. No chat chains.
- Questions for Aria go to `ariaxhan/muse-asks` with the full template, never in chat and never in a digest.
