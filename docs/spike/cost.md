# Platform spike workload cost and budget

Date: 2026-11-23. **Measured functional usage and a costed future workload projection are available.** This is planning evidence, not a pilot result or an invoice. No pilot or treatment task ran.

The stated budget is **USD 30 total**, with an infrastructure target of **USD 25**, both design decisions. The explicit rounding and concurrency reserve scenario is **USD 27.8072492256 total**, derived in the [projection](evidence/platform-cost-projection.json). The proportional allocation is **USD 8.304157955872**, from the same artifact. These figures include a full account subscription allocation, storage, API-equivalent model use and an upstream reserve. No spending or experiment authorization is inferred.

## Measurement and scope

The [latest raw provider capture](evidence/platform-cost-usage-2026-11-23T17-49-19-111Z.json) retains every exact scoped query, timestamp, response and fleet namespace binding. Earlier captures are preserved. The capture begins at the design window boundary recorded in its `window` field and ends at its recorded capture time. Only fleet-mcp staging and production scripts, databases, KV namespaces, R2 buckets, bound Durable Object namespaces and exact recorded fleet browser sessions were queried. No account-wide usage or other project data was read.

| Component | Measured functional usage | Raw source in latest capture |
|---|---|---|
| Workers | 291 requests, 1,926,164 CPU microseconds, 498 subrequests, zero invocation errors | `staging-workers` plus `production-workers` |
| D1 | 11,971 rows read, 2,206 rows written, 1,196 read queries, 1,293 write queries | `staging-d1` plus `production-d1` |
| KV | 10 read operations | `staging-kv` plus `production-kv` |
| R2 | 12 PutObject operations, 28 HeadObject/GetObject/HeadBucket operations | Both R2 action-group series |
| Durable Objects | 30 invocations, 1 provider error; 6.788521088 GB-seconds; 17 SQLite rows read and 4 written | Both invocation series and bound namespace periodic series |
| Browser | 72,338 milliseconds for the exact older fleet session, with maximum and average observed concurrency of 1 | `fleet-browser-time-5f9809a6-110a-4362-b6f5-3640a7895f25` and its binding-session series |

[Provider metric definitions](evidence/platform-cost-metric-definitions.json) identify Durable Object periodic duration as GB-seconds. Request wall time was not substituted for that billing dimension. The browser session's provider start and end timestamps are included in the raw capture. A second, newer exact fleet browser session and both RenderCoordinator periodic series remain empty in this capture. Empty series are unavailable, not measured zero; the scenario allocates explicit reserves for them.

[Recorded render timings](evidence/platform-cost-render-timings.json) preserve exact complete-job timestamps, source paths and source hashes for the supplied functional render receipts. The larger observed sum of active job elapsed times is **14,121 milliseconds**, computed from those records. It establishes elapsed functional render work, not billed browser occupancy: startup, warm idle time, cleanup and provider lifetime may differ. Provider browser time above is measured separately.

## Costed workload

The design workload is **20 functional baskets**, not a forecast of an unspecified agent benchmark task. Each basket reuses the entire measured component usage above, adds a single measured model calibration request, and reserves two browser sessions. All workload counts and reserves are design assumptions in `design` in the [projection](evidence/platform-cost-projection.json). This multiplier provides a reproducible planning scenario without running a pilot before preregistration.

The per-session browser allocation is the larger of measured provider browser duration and measured active render work plus the configured idle reserve and one full render deadline. The code sets the idle reserve to **60 seconds** and total deadline to **30 seconds**, design decisions in [src/render.ts](../../src/render.ts). This produces **104.121 seconds per session**, derived in the projection. The future browser allocation is therefore **1.1569 hours**, from the exact formula in `projected_units.browser_hours`. These are allocated future units, not additional measured sessions.

The missing RenderCoordinator meter receives an additional design allowance of **120 seconds per basket** at **0.128 GB**: two full render deadlines plus idle reserve. This allowance is added to the measured Durable Object basket duration. The memory allocation is a planning decision consistent with the returned duration/active-time ratio. Actual missing namespace duration remains UNPROVEN, while its planning cost is covered explicitly.

Storage is a design allowance of **one GB-month in each storage product**, with indefinite retention beyond that planning horizon excluded from this near-term workload projection. The full monthly Workers subscription is allocated despite being shared. Shared included allowances are not deducted. No account-wide allowance or billing data was requested.

## Rates and arithmetic

These are paid-plan list rates checked on the document date. Exact rates, source URLs, unit conversions, projected units and component costs are saved in the projection JSON.

| Component | Pricing used | Official source |
|---|---|---|
| Workers | USD 0.30 per million requests; USD 0.02 per million CPU milliseconds; USD 5 monthly subscription. Subrequests have no separate Workers request fee. | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 | USD 0.001 per million rows read; USD 1 per million written; USD 0.75 per GB-month | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| KV | USD 0.50 per million reads and per GB-month | [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| R2 Standard | USD 4.50 per million Class A operations; USD 0.36 per million Class B; USD 0.015 per GB-month | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Durable Objects | USD 0.15 per million requests; USD 12.50 per million GB-seconds; SQLite row rates match D1; storage USD 0.20 per GB-month | [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) |
| Browser Sessions | USD 0.09 per hour beyond included hours; USD 2 per additional monthly concurrent browser beyond inclusion | [Browser Run pricing](https://developers.cloudflare.com/browser-run/pricing/) |
| gpt-6.1-sol | Standard USD 2 input, USD 0.10 cached input, USD 10 output per million tokens; Fast mode multiplier of 2 used for the planning allocation | [Official OpenAI model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol) |

The [actual calibration token record](evidence/token-calibration-metadata.json) contains **20,137 input tokens**, including **12,288 cached input tokens**, and **10 output tokens**, with **zero cache-write tokens**. The projection charges uncached input as input minus cached input, then cached input separately, avoiding double counting. Its Standard API-equivalent calibration cost is **USD 0.0170268**; the design workload uses the Fast multiplier, producing **USD 0.6810719999999999** for the workload. These are list-rate allocations, not a claim about the user's Codex subscription invoice.

All measured units are multiplied by the design basket count and by the corresponding list rate. Browser, missing RenderCoordinator duration, storage and upstream allocations use the explicit reserves above. The proportional total is the sum of `linear_allocated_usd` in the projection. The rounding scenario replaces proportional R2 Class A/Class B and Durable Object request/duration charges with whole documented billing units, and adds a design reserve for one extra concurrent-browser month. It does not claim to reproduce an account invoice.

Upstream planning conservatively treats every measured Worker subrequest as an upstream API call, producing a **9,960-call workload allowance**, derived in the projection. This is deliberately not labeled a measured GitHub request count, because subrequests include other services. The existing GitHub REST integration has no new metered service provisioned by this scenario; a **USD 1 reserve** is a design decision. GitHub rate limits constrain scheduling separately from price and are documented in [official REST rate-limit guidance](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api). No account-wide rate-limit usage was queried.

## Interpretation and reproduction

The stated workload fits the stated planning budget under the documented reserves. Future task complexity, storage growth beyond the planning horizon, and actual billing attribution can differ. The budget is a target for this defined workload, not a certified billing ceiling, a configured spending limit, or a measured efficacy result. Missing newer browser and RenderCoordinator analytics remain UNPROVEN provider meters, covered by planning reserves rather than reported as zero.

Reproduce the scoped read-only capture and arithmetic with `node scripts/platform-cost.mjs`. The script reads Cloudflare credentials from the environment without writing them, captures only allowed fleet usage, and writes a timestamped raw response plus the derived scenario. It never launches an agent experiment or alters platform state.
