---
type: research
status: active
created: 2026-11-22
---

# Scaffold research, 2026-11-22

Goal: #1 infrastructure skeleton after G0, before the architecture spike.
Constraints: personal corpus only, no MCP implementation or benchmark execution.
Input: PRD Section 5 and execution-plan scaffold acceptance.
Output: Worker bindings, forward migration, CI/deploy, live sweep and templates.
Done when: landed main, green CI and live staging sweep at the landed SHA.

Failure map: environment bindings do not inherit; declare each environment fully.
Migration rollback cannot follow Worker rollback; expand first, contract later.
A local build cannot verify deployment identity; require exact SHA from /version.
Binding presence cannot prove Browser execution; explicitly defer that to spike.
Fixture probe secrets grant no corpus access. Unknown routes fail closed.

Sources consulted this attempt:
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/d1/reference/migrations/
- Installed wrangler config-schema.json and dry-run build.

No excluded project source or server was consulted. The live sweep is infrastructure
verification, not a treatment run or a benchmark result.
