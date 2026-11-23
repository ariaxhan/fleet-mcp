# Platform functional probe protocol (#15)

Recorded 2026-11-23 before this attempt's new runtime functional probes.
Personal-project corpus only. These are platform acceptance probes, not a pilot,
benchmark task, treatment arm, efficacy estimate, or preregistration freeze.
No benchmark or pilot is authorized before bench-prereg-v1.

## Decisions and expected observations

- Owner spike pin: gpt-6.1-sol, low reasoning. Read local configured values and
  codex --version, then require the same model in a fresh functional transcript.
- Token capture: emit a fixed trivial response without tools as a calibration.
  Archive only that new session. Require input, cached-input, output and total
  fields; test total=input+output and cached-input<=input. No cost field is
  assumed. Schema serialization accounting is reported separately and its
  tokenizer identity and limitations are explicit.
- MCP: initialize with the actual Codex client; list and invoke tools, read an
  allowed personal resource, produce an expected tool error, observe progress,
  interrupt and reconnect. HTTP-only evidence is labeled separately.
- Wait: retain wait_id, disconnect, deploy, resume that same ID; require bounded
  timeout or a real sidecar state change. No reconstructed observations.
- Browser: enqueue concurrent bounded synthetic fixture jobs, end initiating
  requests before execution completes, observe durable completion, browser
  reuse and isolated context cleanup; retain a real screenshot.
- Sidecar: fixed named suite on fleet-mcp only; dependency identity mutation
  misses, force creates distinct run, expired green returns freshness_unmet.
- Connector: observe stale/offline with original observation time, then a signed
  real heartbeat restores freshness. Fault injection is labeled as such.
- Deploy: canonical custom-domain staging sweep before production deployment
  and fixture sweep. Each receipt names its build SHA.
- Cost: component counters from these functional probes, with current source
  rates and a separate proposed workload budget. Missing component usage is
  UNPROVEN, never inferred from binding presence. Pilot execution remains held.

## Reporting

Every outcome links raw captures and exact commands. Functional failures and
missing evidence remain visible. Producer regression checks are not independent
acceptance. G1 review belongs to #43 after #15, no full build is authorized here.
