# fleet-sidecar

Outbound-only Studio connector (PRD 2.6). Nothing listens; every request is signed with the machine's Ed25519 key from the keychain.

```sh
node sidecar/fleet-sidecar.mjs enroll staging   # once per machine
node sidecar/fleet-sidecar.mjs once staging     # one cycle
node sidecar/fleet-sidecar.mjs loop staging 60  # launchd entry point
node scripts/sidecar-sweep.mjs staging "$(git rev-parse HEAD)"   # live check, receipt in artifacts/
```

One cycle: reconcile delivered event keys with `POST /connector/reconcile` (keys the server lacks are re-queued), collect runner flight events, four credential probes (`github`, `wrangler`, `codex-oauth`, `claude-oauth`; fixed status and reason enums only, never a token or CLI output), checkout state (HEAD, branch, dirty, tree hash including uncommitted bytes), configured file hashes and checkpoint hashes, then lease up to 10 jobs from `GET /connector/work` (the lease is the ack), push records plus heartbeat (`observations` holds per-class last successful observation), then post job results. Unacked records stay in the on-disk outbox and replay in `seq` order.

Job kinds (queued with `POST /v1/connector/jobs`, read with `GET /v1/connector/job?id=`): `probe`, `checkout_state`, `file_upload` (bytes to R2, content-addressed, size and SHA-256 rechecked server-side; `include=bytes` serves them), `suite_run` (name only; registry in `verification.mjs`), `lesson_writeback` (queued by `POST /v1/recall/learn`, written with `agentdb learn` in the owning checkout; D1 is authoritative until `writeback_status` is `done`). Unknown kinds and suites end `unsupported`; paths outside the root, in `.git/`, or on the deny list end `refused`. Undelivered jobs end `unavailable` at expiry; lease expiry retries up to 3 times, then `failed`/`lease_expired`.

Config (`~/Library/Application Support/fleet-sidecar/<env>/config.json`): `checkouts` (repo to absolute root), `hash_files`, optional `checkpoint_dirs` (`{repo, path}`). Every repo must be in `allowlist.toml`; anything else is never opened, and an excluded-domain entry stops startup.
