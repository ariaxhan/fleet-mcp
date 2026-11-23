-- Append-only workspace observations from the bounded scheduled sidecar suite.
CREATE TABLE verification_runs (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, run_id TEXT NOT NULL,
 machine_id TEXT NOT NULL, repo TEXT NOT NULL, suite TEXT NOT NULL,
 identity_hash TEXT NOT NULL, identity_json TEXT NOT NULL, passed INTEGER NOT NULL,
 evidence_json TEXT NOT NULL, computed_at TEXT NOT NULL, source_observed_at TEXT NOT NULL,
 received_at TEXT NOT NULL, PRIMARY KEY (tenant_id, namespace_id, run_id)
);
CREATE INDEX verification_identity ON verification_runs(tenant_id, namespace_id, identity_hash, computed_at);
