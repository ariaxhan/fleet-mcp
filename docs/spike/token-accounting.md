# Spike token capture and schema accounting

Date: 2026-11-23. Functional calibration only, no pilot or efficacy experiment.
Owner spike pin is `gpt-6.1-sol`, low effort. The formal benchmark pin remains #33.

## Capture semantics

The fresh [session metadata](evidence/token-calibration-metadata.json) records
CLI `0.163.0`, the exact model and effort. Its raw provider-reported fields are
input 20137, cached input 12288, output 10, total 20147. The total equals input
plus output, with cached input contained within input. Adding cached input again
would double count it. Reasoning output is a subset of output, not an additional
primary-total term. This calibration observed no cache-write or reasoning tokens,
so nonzero cache-write behavior remains untested. No cost field was observed.
Raw CLI events: [token-calibration.jsonl](evidence/token-calibration.jsonl).

## Schema accounting

The [final serialized catalog](evidence/tool-schemas-final.json) is inert JSON
from the implemented tool descriptions, input schemas and annotations. The same
fixed prompt with `[]` and with that JSON was sent to the exact pinned model,
with plugins and apps disabled. No tools or files were used by either model turn.
The [empty payload](evidence/schema-final-empty.jsonl) reports input 19719 and
output 11; the [catalog payload](evidence/schema-final-schemas.jsonl) reports input
20793 and output 11. Incremental serialized-schema payload: **1074 input tokens**
(the exact subtraction, no tokenizer approximation). Cached input is 12032 in
both captures and is already included in input. [Model and raw token metadata](evidence/schema-final-metadata.json)
records the exact model/effort and total=input+output identities.

This measures serialized schema payload tokens in a message, not unknown
provider role framing or a future benchmark tool configuration. Earlier actual
client empty/full discovery calibrations both reported input 24533:
[empty catalog](evidence/schema-empty-catalog.jsonl),
[full catalog](evidence/schema-full-catalog.jsonl). Observed initial-input delta
is zero in that client configuration. It does not establish zero first-use
cost: Codex can expose tools lazily. Actual task totals include discovery,
schemas, tool responses and all later turns; they must be captured per run.
No savings or significance claim follows from these descriptive calibrations.

## Real client use

[First actual client capture](evidence/codex-mcp.jsonl) preserved an approval
configuration failure for tools, plus a successful resource read. With the
explicit server-local `default_tools_approval_mode="approve"` appropriate for
these authorized read-only tools, [the next capture](evidence/codex-mcp-approved.jsonl)
returned real fleet data and a real personal document, then the expected
missing-document tool error. Later app-server captures isolate fleet and disable
plugins/apps. Do not treat discovery alone or a failed approved call as a
successful tool invocation.

Official configuration sources: [MCP options](https://learn.chatgpt.com/docs/extend/mcp),
[CLI reference](https://learn.chatgpt.com/docs/cli/reference). Provider-reported
raw token fields above, rather than an assumed tokenizer, establish the observed
accounting. API-equivalent model cost uses [the pinned model rate card](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
not a claimed subscription invoice.
