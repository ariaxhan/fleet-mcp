# Confirmatory experiment status, issue #35

Observed 2026-11-23 (UTC). Status: NOT RUN, gate not met.
Readiness record, not an experimental result.

## Evidence

- `git ls-remote --tags origin` returns no tags: `bench-prereg-v1` is not frozen.
  No "with" run is permitted before it (AGENTS.md, preregistration rule).
- [Pilot status](pilot-status.md): pilot (#34) NOT RUN, so no paired-difference
  SD and no frozen confirmatory N exist. Issue #35's gate waits on that power computation.
- No `benchmark/` harness, task pool, or archive ledger on `origin/main`
  (only `benchmark/verification/`).
- Owner evidence ask `20261123T010940Z_b285f0` (Muse inbox, from #34) has no reply
  (`runner muse find b285f0`). No duplicate ask sent.

## Acceptance disposition

| Acceptance | Disposition |
|---|---|
| 60 to 100 runs at frozen N, complete capture | NOT RUN: no frozen protocol, N, harness, or task pool |
| Intent-to-treat analysis, adoption reported | NOT EVALUATED: no runs |
| Unpowered metrics reported UNPROVEN with required N | All metrics UNPROVEN; required N not computable without pilot variance |
| No stopping or expanding on observed significance | Held: zero confirmatory outcomes observed |

## Resume condition

Run only after `bench-prereg-v1` (tag, SHA-256, remote registration) and the
pilot's frozen confirmatory N exist. Then execute floor 30 x 2 arms up to the
frozen N (cap 50 x 2), ITT, no peeking. No invented protocol or task pool.

Scope boundary: personal-project corpus only. No TBS data, repos, issues, or MCP content.
