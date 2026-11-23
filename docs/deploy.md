# Scaffold deployment

G0 is GO: [owner sign-off](gates/g0-signoff.md), committed at eab8f3c.
The earlier #1 attempt correctly stopped before that sign-off. This scaffold is
infrastructure for the spike, not a G1 verdict or an implemented MCP server.
No benchmark is run, preregistered or published by these commands.

## Fresh checkout

Prerequisites: Node 22 or newer, npm, Python 3, Git, and an authorized Cloudflare
API token for this account's Workers, D1, KV, R2 and Browser Rendering bindings.
Use the canonical checkout on main. Bindings in wrangler.toml are the provisioned
personal-project staging and production resources. No other corpus is connected.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run migrate:local
npm run migrate:local
npm run deploy:staging
npm run sweep -- https://fleet-mcp-staging.ariaxhan.workers.dev "$(git rev-parse HEAD)" staging
```

Deploy requires a clean checkout and embeds HEAD plus build time. It waits for
that exact deployed SHA within a bounded readiness budget before the sweep.
The budget is a design decision, not a measured propagation guarantee. Export
CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID through the credential manager.
FLEET_SWEEP_TOKEN must match Worker secret SWEEP_TOKEN. The probe credential
permits only fixed fixture dependency reads, no corpus access or arbitrary input.
Set it with `npx wrangler secret put SWEEP_TOKEN --env staging` and separately
for production. Never put secret values in command arguments or committed files.
The same fixture probe credential is stored as a GitHub Actions secret.

## Pipeline and promotion

CI runs on pushes and pull requests: clean npm install, dependency audit, unit and
SQLite migration tests, typecheck, dry-run bundle and repeated local migration.
Deploy runs its own test gates before staging. Same-repository pull requests deploy
to staging only. Main pushes and manual dispatch deploy staging, require its live
sweep to pass, then deploy production and sweep again. Deploy concurrency is
serialized. Fork pull requests never receive deployment credentials.
GitHub environments staging and production provide the environment control points.

GitHub secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, FLEET_SWEEP_TOKEN.
The workflow archives every generated sweep receipt as an Actions artifact and
in the matching R2 bucket at fixture-ENV/sweeps/RUN-ATTEMPT.json. Workflow records
link to both. A failed sweep fails the release, including when receipt upload fails.

For a deliberate manual production release, first sweep staging at the same SHA,
then `npm run deploy:production`, then:

```sh
npm run sweep -- https://fleet-mcp.ariaxhan.workers.dev "$(git rev-parse HEAD)" production
npx wrangler r2 object put fleet-mcp-production-blobs/fixture-production/sweeps/manual-SHA.json --file artifacts/sweep-production.json --remote
```

Archive staging receipts likewise to fleet-mcp-staging-blobs under fixture-staging.
Use a unique release identifier instead of manual-SHA for each manual invocation.
Rollback Worker code with `npx wrangler rollback --env staging` (or production),
then sweep against the rolled-back SHA. D1 is forward-only: follow migrations/README.md.

## Surfaces and limits

- Staging: https://fleet-mcp-staging.ariaxhan.workers.dev/health
- Production: https://fleet-mcp.ariaxhan.workers.dev/health
- `/version`: exact deployed commit, build time, environment, scaffold stage.
- `/health`: public liveness only. No dependency details or credentials.
- `/internal/fixture`: credential-protected fixed fixture namespace checks for
  migrated D1, KV, R2 and both Durable Object classes, plus Browser binding presence.
- All other GET routes return 404; mutations return 501. No corpus input accepted.

Sweep reads deployed HTTP responses only, never local source files. Each check
records pass/fail and latency in artifacts/sweep-ENV.json. Failures still produce
a receipt and a failing exit status. Expected SHA and environment are mandatory;
HTTPS and redirect rejection prevent accidental credential forwarding.

## Core slice (spike S1, issue #11)

Migration 0002 adds tokens, blobs, resources, versions, change_events, outbox,
idempotency and audit. Routes (all require a caller token, default deny):

- `GET /v1/docs/get?name=REPO/PATH[&version=N][&since_version=N][&max_age_s=S][&allow_stale=true][&consistency=cached|validated|strong]`
  (`context:read`): body plus `meta` (content_hash, version, cache_status,
  served_at, source_observed_at, last_validated_at, computed_at, source).
- `POST /v1/docs/publish` (`context:publish`): content-addressed body to R2, then
  one D1 batch for version, pointer, change event, outbox and idempotency record.
- `GET /v1/changes[?cursor=C]` (`context:read`): bootstrap summary or events after
  an opaque cursor bound to tenant, namespace, principal, policy revision and filter.

Worker secret TOKEN_HMAC_KEY (keychain item fleet-mcp-token-hmac-ENV) verifies
caller tokens; without it protected routes fail closed with 503. Issue a token:
`FLEET_TOKEN_HMAC_KEY=... node scripts/issue-token.mjs ENV PRINCIPAL CAPS REPOS`.
Publish real files at HEAD: `FLEET_PUBLISH_TOKEN=... node scripts/publish.mjs ORIGIN DIR OWNER/REPO PATH...`.
The sweep adds core read, strong read, freshness_unmet and change feed checks
when FLEET_CORE_TOKEN is set. Source repos are limited by PERSONAL_SOURCE_REPOS
in src/core.ts. Not yet built: MCP transport, diffs, single-flight leases, fencing.

Browser execution, MCP negotiation, fixture write/idempotency
checks, auth matrix and runtime tools belong to the spike/build issues. Binding
presence is not Browser execution proof. No G1 or benchmark claim follows from
this infrastructure sweep. Custom domains await the owner's domain decision;
workers.dev origins are the scaffold deployment default.

## Minimal Studio sidecar (spike, issue #12)

`sidecar/fleet-sidecar.mjs` is the outbound-only connector (PRD 2.6). It reads the
nexus-office runner DB read-only (rows for `sidecar/allowlist.toml` repos only; others
are counted in SQL, never read), runs the github credential probe (fixed status and
reason code, never CLI output) and hashes registered working-tree files under
realpath path protection. Requests are signed with an Ed25519 machine key held in
the keychain (`fleet-sidecar-machine-key-ENV`); the server stores only the public key.

```sh
node sidecar/fleet-sidecar.mjs enroll staging   # once: key to keychain, machine row via wrangler
node sidecar/fleet-sidecar.mjs once staging     # collect and push; outbox replays on failure
```

- `POST /ingest/fleet`: signed push (method, path, body SHA-256, timestamp, single-use nonce).
  Fleet events enter `/v1/changes` as `fleet_event` with the original `source_observed_at`;
  duplicates (by machine and event key) append nothing.
- `GET /v1/fleet/status` (`fleet:read`): connector `fresh|stale|offline`, probes, recent events.
  Probe liveness is never served stale: non-fresh reports `unknown` with `connector_offline`.
- `GET /v1/fleet/file-compare?repo=R&path=P` (`fleet:read`, `context:read`): sidecar working-tree
  hash vs the published core version: `match|diverged|unknown_local|unknown_published`, labeled
  `freshness` with the observation time.

Thresholds: stale after 180 s, offline after 900 s without a heartbeat (design decisions, src/connector.ts).
