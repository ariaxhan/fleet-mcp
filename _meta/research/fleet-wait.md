---
type: research
status: active
created: 2026-11-22
---

# Fleet wait failure map

2026-11-22. Existing contracts: src/auth.ts Caller, src/connector.ts ingestion,
src/core.ts scoped HMAC cursors, installed workers-types DurableObjectStorage.
Lost notification: durable D1 is checked on registration/resume; persisted wait baseline never advances on timeout.
Register/change race: install local wake listener before querying durable state.
Disconnect: timeout only ends one call; persisted wait survives and resume checks intervening events.
Cross-scope resume: bind ID to caller token, principal, namespace, policy and repo allowlist.
Revoked machine: every query joins nonrevoked machine registry.
Late event: flight summary orders original observation time, then feed sequence.
Notification failure: ingestion retry notifies even for duplicate events; resume always rechecks D1.
Tests are producer checks only. Live receipts do not certify G1 or benchmark effects.
