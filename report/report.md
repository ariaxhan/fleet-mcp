# Fleet MCP: full report (deliverable 1)

Status: DRAFT. Phase 0. Gate G0 not passed; no server build, no preregistration freeze (`bench-prereg-v1`), no "with" run, no verification receipt exists as of 2026-11-22.
Every value below is read from `report/scored.json`, the single source of scored numbers, which only the scoring script writes from archived raw data. No measured value exists yet, so every result cell is PENDING or UNPROVEN. This document is the frozen report shape; it is filled in only from verified scoring output and finalized only after independent verification (gate G3). A headline percentage without its CI and N is never published here.

Scope: personal-project corpus only. No TBS data, repos, issues, or MCP content.

## Provenance

| Item | Value | Evidence |
|---|---|---|
| Preregistration tag | `bench-prereg-v1`, not frozen | `report/scored.json` `preregistration` |
| Preregistration SHA-256 | PENDING | tag message (once frozen) |
| Remote timestamped record | PENDING | `report/scored.json` |
| Independent verification | PENDING (no verifier, no receipt) | `report/scored.json` `verification` |
| Raw data archive | none yet (0 runs) | `report/scored.json` `runs` |

## 1. Four outcomes

Estimand (primary): mean of per-task log ratios (with minus without), back-transformed to percent change; BCa bootstrap 95% CI primary, paired t-interval robustness check; Holm correction on key secondaries (docs/execution-plan.md R5).

| Outcome | Metric (hypothesis) | Control | Treatment | Abs. diff | Rel. % change | 95% CI | N | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|
| Tokens | Total tokens per task, primary (H1) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json#H1` | UNPROVEN |
| Speed | Wall-clock time per task, key secondary (H2) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json#H2` | UNPROVEN |
| Accuracy | Outcome correctness, non-inferiority (H4) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json#H4` | UNPROVEN (expected even after runs) |
| Reliability | Dead-credential launches (H5), sleep commands (H7), state-check and re-fetch calls (H3) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json#H3,H5,H7` | UNPROVEN |
| Adoption (context) | Recall adoption in with-arm sessions (H6) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json#H6` | UNPROVEN |

Bars (preregistered targets, not results): H1 point estimate at least 20% reduction AND 95% CI excludes 0 (this establishes improvement with a target-sized point estimate, not that the true reduction is at least 20%); H2 at least 15% AND CI excludes 0; H3 at least 50% (exploratory); H4 with minus control within 5 percentage points; H5 and H7 zero, reported with a finite-sample interval, never as proof of a zero rate; H6 at least 80%.

## 2. Error rates, re-attempt rates, cost, wall time per task

| Measure | Control | Treatment | Abs. diff | Rel. % change | 95% CI | N | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| Error rate per task (aborts, timeouts, harness failures counted as outcomes) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | raw run ledger (not yet created) | UNPROVEN |
| Re-attempt rate per task | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | raw run ledger (not yet created) | UNPROVEN |
| Model cost per task (dollars, tokens x model price at run time) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json` `costs[0]` | UNPROVEN |
| Benchmark compute cost, all runs | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json` `costs[1]` | UNPROVEN |
| Server operating cost during experiment | n/a | PENDING | n/a | n/a | PENDING | PENDING | `report/scored.json` `costs[2]` | UNPROVEN |
| Wall time per task | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | `report/scored.json#H2` | UNPROVEN |

Token breakdown (input, output, cache-read, cache-write, schema overhead in the with arm) is reported separately per R5 once runs exist.

## 3. Run completeness

| Cohort | Planned | Done |
|---|---|---|
| Pilot | 20 (10 x 2) | 0 |
| Confirmatory | 60 to 100 (30 to 50 x 2) | 0 |
| Repeatability | 40 (10 x 2 x 2) | 0 |

## 4. Null and adverse changes

Reported as results, never omitted. Any outcome whose CI includes 0 is listed here as null; any outcome where the treatment is worse is listed here as adverse, with its CI and N. None can be listed yet because no run exists.

## 5. UNPROVEN items and what it would take to prove them

- H1 to H7, error, re-attempt, cost, wall time (all): UNPROVEN because no run exists. Proof requires: G0 then G2 (full-v1 acceptance matrix green), preregistration frozen at `bench-prereg-v1` with SHA-256 and a remote timestamp, pilot 10 x 2, confirmatory N from the pilot power computation (floor 30, cap 50 per arm), repeatability substudy, every run archived in the raw ledger, scoring script output in `report/scored.json`, and an independent verification receipt (G3).
- H4 accuracy non-inferiority: preregistered as likely UNPROVEN even after the full run, because a 5 percentage point margin cannot be shown with 30 to 50 paired binary outcomes. Proof requires its own power analysis from the pilot and a sample sized to it.
- H5 and H7 zero-event criteria: zero observed events cannot prove a zero rate. Proof is bounded: report zero with its finite-sample upper bound plus the fault-injection preflight results (expired, missing, unknown, mid-run-expiring credentials).
