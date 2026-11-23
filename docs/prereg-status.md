# Preregistration status, issue #33

Observed at 2026-11-23T01:12:11Z on main at `7d2744c`. Status: NOT FROZEN, gate prerequisites absent.
This is a readiness record, not a preregistration. No `bench-prereg-v1` tag was created.

## Evidence

- `PRD.md` is still v1 ("Draft for review"); G0 revision issues #2 to #10 are OPEN. The statistics contract (R5) that the preregistration must restate does not exist yet.
- G1 (#16) and G2 build issues (#17 to #27) are OPEN. No `src/`, `sidecar/`, or deployed server exists, so no server commit hash can be frozen.
- Task pool (#28), harness and capture (#29), and archive (#32) are OPEN. No ranked pool, seed, starting-state snapshots, or capture definitions exist to freeze.
- `git tag -l` and `git ls-remote --tags origin` return no `bench-prereg-v1`.
- No "with" run has occurred (see [pilot status](pilot-status.md), [confirmatory status](confirmatory-status.md)), so the ordering rule still holds.

## Acceptance disposition

| Issue acceptance | Disposition |
|---|---|
| prereg md and json committed, tagged, SHA-256 in tag | NOT DONE: freezing placeholders would register a protocol that cannot be run |
| Remote timestamped registration record | NOT DONE: nothing to register |
| Freeze predates first "with" run | HOLDS so far: zero "with" runs exist |
| PRD 8.6 contents present (model ID, pool and seed, analysis, verification plan) | NOT DONE: pool, server commit, revised 8.6 absent |

## Resume condition

Freeze only after G2 passes and #28, #29, #32 land. Then write `benchmark/preregistration.md` and `.json` from revised PRD Section 8.6, commit, compute SHA-256 of both, create annotated tag `bench-prereg-v1` carrying the hashes, push the tag, and register a remote timestamped record (for example OSF or a public GitHub release plus an RFC 3161 timestamp) before any pilot arm runs.

Scope boundary: personal-project corpus only. No TBS data, repos, issues, or MCP content may be read, ingested, quoted, or served.
