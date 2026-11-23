---
type: plan
status: active
created: 2026-11-23
---

# Operations, issue #27

- Goal: release gates, bounded execution, observable failure, recoverable storage.
- Inputs: PRD 5.2, execution plan B11, G1 review 2 GO.
- Constraints: personal corpus only; no benchmark execution; canonical main; preserve concurrent paths.
- Output target: serialized operations coordinator, entry middleware, upstream guard, migration release gates, recovery commands and receipts.
- Done when: configured checks pass, main lands, deployed fixture operations and restore drill pass, owning surface inspected.
- Choice: one Durable Object serializes admission globally. In-memory counters lose state on eviction; KV counters are not atomic.
- Thresholds are design decisions. Missing observations remain unknown and alert, never become zero.
- Recovery retains authoritative D1/R2 and durable job records. Disposable cache is rebuilt.
- Independent review required before claiming complete.

## 2026-11-23 attempt

- Prior blocker resolved: G1 review 2 GO at `384814b` supersedes historical NO-GO.
- Implemented slice: expand, intervening fixture sweep, guarded contract, deploy,
  post-deploy sweep; no readiness polling; verify-only resumption; phase receipts.
- Runtime integration blocked by active ownership of `src/handler.ts` by another
  session. Guard rejected the edit; no override attempted. Draft runtime module
  removed before landing. Foreign sidecar and handler changes preserved.
- Remaining #27 acceptance is UNPROVEN: runtime limits, metrics and alerts,
  full backup/restore exercise, live release of this pipeline, independent review.
- Resume after the sidecar lane (#18) lands and frees the shared handler. Recheck
  core #17 and storage owners before defining recovery inventory or metrics.
- Verification: `node_modules/.bin/tsx --test tests/deploy-ops.test.ts`,
  `npm run typecheck`, and `npm run build` passed. `npm test` failed in the shared
  tree: fleet and verification fixtures insert positional connector-status rows,
  while the concurrent untracked `0010_sidecar_full.sql` adds columns. Source:
  this attempt's test output and that migration. No failing fixture was modified.
- Live release not attempted: deploy requires a clean checkout; active foreign
  sidecar changes and handler ownership are present. No deployment was repeated.
