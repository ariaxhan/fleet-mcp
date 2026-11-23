# Issue Context and Recall spike (#13)

## Contract and decisions (2026-11-22)

Goal: serve real personal-project issues and lessons through authenticated read paths.
Inputs: fleet-mcp GitHub issues and this checkout's enumerated agentdb collection.
Outputs: durable snapshots, freshness metadata, ranked recall and store health.
Done when: local gates pass, main lands, deployed routes serve real data, signed
webhook invalidation and reconciliation are exercised, raw latency receipts exist.
G0: docs/gates/g0-signoff.md. Core dependency: commit 511dd80 (#11).
G1 NO-GO blocks full v1, not these remaining spike slices. No benchmark runs.

Decision: D1 snapshots and HTTP routes matching src/handler.ts, no new framework.
Rejected: KV-only history (eventual pointers lose correctness); full MCP transport
(belongs to platform spike #15). Recall uses an explicitly owned collection,
never a global agentdb scan. This checkout is the only source DB.
All limits and schedules in source are spike design decisions, not measurements.

## API references

- https://docs.github.com/en/rest/issues/issues
- https://docs.github.com/en/rest/issues/comments
- https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

## Run and verify

- `npm test`, `npm run typecheck`, `npm run build`.
- Land through `python3.12 -m runner land` in nexus-office, then the existing
  GitHub deploy workflow migrates, stages, sweeps and promotes production.
- Configure Worker secrets `GITHUB_TOKEN` (read-only use of the existing GitHub
  credential) and `GITHUB_WEBHOOK_SECRET` for each environment.
- GitHub repo webhook: `/webhooks/github`, issues and issue_comment events,
  JSON content type, SHA-256 signature required. Non-allowlisted payloads dropped.
- Reconciliation: full sweep on the configured cron, incremental admin recovery
  `POST /admin/sync/github?repo=ariaxhan/fleet-mcp` (admin plus issue:read).
- Read token: issue:read, recall:read, recall:health, recall:sync, admin, with only
  ariaxhan/fleet-mcp in source_repos. Sync capabilities are for the operator;
  readers need only their per-operation read capability.
- `FLEET_READ_PATH_TOKEN=... python3 scripts/sync-recall.py ORIGIN` syncs only
  `_meta/agentdb/agent.db` in this checkout. It never walks the vault or imports
  global lessons. The collection is explicitly the project-tagged, active,
  agent-visible, low-sensitivity rows. Other rows are outside this spike.
- `FLEET_READ_PATH_TOKEN=... FLEET_GITHUB_WEBHOOK_SECRET=... node scripts/read-paths-sweep.mjs ORIGIN SHA`
  captures raw deployed responses and client latency under artifacts/. This is
  functional validation, not a treatment arm or an estimate of benchmark effect.

Routes: `GET /v1/issues/get?repo=ariaxhan/fleet-mcp&number=13`,
`GET /v1/issues/list?repo=ariaxhan/fleet-mcp&state=all`,
`GET /v1/recall/query?query=fleet-mcp`, `GET /v1/recall/health`.
Issue reads accept max_age_s, allow_stale and consistency. Recall refuses an old
sync by default; allow_stale=true exposes it with stale metadata. Health counts
are the owned collection, not global totals. Query telemetry is D1-local; bash
write-back, semantic ranking and full v1 query caches remain out of spike scope.
Linked PR extraction is limited to GitHub's issue pull_request field, explicitly
marked in responses; cross-reference expansion is deferred to full v1 (#21).

## Evidence limits

Unit tests are producer checks, not independent verification. Raw live receipts
are functional observations, not benchmark claims. G1 remains NO-GO until its
owning chat evaluates the complete platform evidence. No comparative result is
published here. No screenshot is applicable to these backend JSON routes.

## Live validation fixes

- Python's default user agent was rejected with edge code 1010. The sync client
  now identifies itself as fleet-mcp-recall-sync/0.1.
- Workers rejects fetch redirect=error at runtime despite the DOM TypeScript
  type accepting it. Upstream reads use manual redirects and reject every
  non-success response, so credentials never follow redirects. Raw diagnostic
  receipt: artifacts/issue-debug-tail.json (operator-local, contains request metadata).
- Live sweep receipts have unique timestamps; failed captures are retained.

Independent review identified issue-observation and recall-sync ordering races.
Migration 0005 adds transient transaction assertions: each observation compares
its pre-fetch/pre-sync identity inside the same atomic D1 batch as all writes.
A concurrent update or invalidation rolls the older batch back. Regression tests
interleave the older request after the newer commit and check no stale content
or membership survives. The guard rows are removed in the successful batch.
Repeated invalidations also advance a monotonic epoch (migration 0006), even
when already invalidated, so an in-flight observation cannot clear a newer event.
The regression includes repeated invalidation while the upstream read is pending.

## Acceptance receipt

[Machine-readable receipt](read-paths-receipt.json) links the final staging and
production raw HTTP captures, latency sources, checksums and verified R2 copies.
The independent reviewer used staging directly, exercised signed webhook intake
and reconciliation, and approved the scoped concurrency fixes. Both configured
GitHub webhooks reported successful delivery after the live fixes. This is
functional spike evidence only. Benchmark effect and full v1 remain UNPROVEN.

Operator credentials are stored in keychain items fleet-mcp-read-path-token-ENV
and fleet-mcp-github-webhook-ENV, never in the repo or receipt.
