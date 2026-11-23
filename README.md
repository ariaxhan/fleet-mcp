# Fleet MCP

One unified MCP server on Cloudflare serving the working state of an agent fleet: the context agents re-read (exemplars, lessons, issue context, briefs) and the live state they poll for (flights, jobs, verification, renders, handoffs). Built as a personal project with its own corpus, with a preregistered benchmark measuring its effect on token use, speed, accuracy, and reliability.

## Status: revision first

The PRD (v1, `PRD.md`) was reviewed independently by Codex and Claude on Nov 22, 2026. Both reviews agree: the direction is sound, but the PRD is not yet an implementation-ready contract. So the order is:

1. **Phase 0, Revision.** Fix the PRD per both reviews (Studio connector spec, cache identity contract, auth model, control plane, benchmark statistics, single-model scope, deliverables section, remaining fixes sweep), then align the paper skeleton.
2. **Phase 1, Spike.** A bounded architecture spike: core slice, minimal sidecar, Issue Context and Recall read paths, read-only Fleet Status with a bounded wait, platform proof. Eight proof criteria gate the full build.
3. **Phase 2, Build.** The full v1 server: Context plus State plus Render inside Verify, with the Studio sidecar and the control plane.
4. **Phase 3, Benchmarks.** Deterministic replays, preregistration freeze, then a 3-phase agent experiment (pilot 10x2, confirmatory floor 30x2 with a 50x2 cap, repeatability substudy), then independent verification. Minimum 120 runs.
5. **Phase 4, Deliverables.** The full report, the HTML page, the research paper, and the data archive audit.

Hard ordering rules: no build work before the revision gate (G0); no "with" run before the preregistration freeze; no result published before independent verification; no result claimed from a run whose raw data is missing.

## The seven binding deliverables

| # | Deliverable | Path | Gate |
|---|---|---|---|
| 1 | Full report: percent change in token usage, speed, accuracy, reliability, plus error rates, re-attempt rates, cost, wall time per task | `report/report.md` | Finalized only after independent verification passes (G4) |
| 2 | The full MCP server (Context plus State plus Render), grounded on real data | `src/`, `sidecar/`, `wrangler.toml`, `migrations/` | Full-v1 acceptance matrix green on real personal-project data (G2) |
| 3 | Benchmarks: existing suites where they apply plus new ones; the suites themselves are deliverables | `benchmark/` | Runnable from a fresh environment; reuse matrix complete with pinned revisions (G3) |
| 4 | Data: gather as much as possible, ensure none is lost; archive with a clear index; data loss is a failure | `benchmark/data/` plus R2 archive plus off-Cloudflare mirror | Archive infrastructure live before the first run; final audit green (G3 into G4) |
| 5 | Single model first: Codex solo, most recent version | Pinned in `benchmark/preregistration.md` and `benchmark/preregistration.json` | Exact model ID pinned and frozen in `bench-prereg-v1` before the first "with" run |
| 6 | HTML deliverable: readable end to end without reading the repo | `docs/report/index.html` | Scaffolded before experiments; finalized after independent verification (G4) |
| 7 | Research paper, written DURING the experiments | `paper/` | Writing gates at each phase; final claims only after independent verification |

## Evidence standard (binding throughout)

Aria's evidence standard of Nov 22, 2026 governs every phase:

1. **Preregister** hypotheses, methods, and success criteria before the "with" side runs.
2. **Controlled experiments** with a real control group, enough runs for significance, and confidence intervals, not just point estimates.
3. **Traceability:** every number traceable to raw data (archive transcripts, run logs, measurements, analysis).
4. **Independent verification** by a party other than the producer.
5. **UNPROVEN labeling:** if a result cannot be proven, report it as UNPROVEN with what it would take to prove it.
6. **Full reporting:** never inflate, never round up, never present a suggestive result as a proven one. Null results are reported as results.

## Scope boundary

This is a personal project with its own corpus. It does not touch TBS data, TBS repos, TBS issues, or the TBS MCP server's content. The TBS Teaching MCP server is a pattern reference only (hosted, typed tools, live data). This server's corpus is Aria's personal-project repos and records only, enforced by an explicit allowlist in code. Benchmark tasks are drawn from personal-project work only. Boundary tests use synthetic excluded identifiers and never contact excluded systems.

## Docs

- `PRD.md`: the PRD v1 (pre-revision; Phase 0 produces v2).
- `docs/execution-plan.md`: the execution plan (phases, gates, the 41-issue list, runner integration).
- `_meta/chronicles/2026/fleet-mcp-2026-11-22-001.md`: the decision chronicle (revise before building).
- `docs/baseline/report.md` plus `docs/baseline/analysis/`: the baseline report and the transcript analysis behind it.
- `docs/reviews/codex-review.md`, `docs/reviews/claude-review.md`: the two independent PRD reviews.
- `paper/skeleton.md`: the paper skeleton (all results sections marked [PENDING]).

## Repo layout (target)

```text
fleet-mcp/
  PRD.md                      # PRD v2 (revised per the execution plan, Phase 0)
  _meta/chronicles/           # decision chronicles
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

## Ownership

The Unified MCP Server chat owns this domain end to end. Build and benchmark work runs as runner issues in this repo. Questions for Aria go to `ariaxhan/muse-asks`, never in chat.
