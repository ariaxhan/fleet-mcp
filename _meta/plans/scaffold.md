---
type: plan
status: active
created: 2026-11-22
---

# #1 scaffold decisions

Use native Wrangler Worker plus TypeScript and Node tests, with real D1 migration
application locally and live dependency reads after deploy. Avoid a framework and
full MCP SDK until the spike chooses transport behavior. Avoid a custom deploy
service: Actions plus Wrangler provide staging and production sequencing.

Assumption: workers.dev origins satisfy scaffold deployment while custom domains
remain an owner decision. Fixture probes are read-only fixed paths; real tool
writes and their idempotency checks stay in the build acceptance, not this skeleton.

Owned paths: src, tests, scripts, migrations, .github, wrangler.toml, package files,
tsconfig.json, .gitignore, README.md, docs/deploy.md, these scaffold notes.
No benchmark, paper or pre-existing gate artifacts are modified.
