-- Expand only. Minimal Studio sidecar (issue #12, PRD 2.6): machine registry,
-- single-use request nonces, fleet events, probe attestations, file hash
-- reports and connector heartbeat. Every observed row keeps source_observed_at.
ALTER TABLE change_events ADD COLUMN source_observed_at TEXT;

CREATE TABLE machines (
  machine_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (tenant_id, namespace_id) REFERENCES namespaces (tenant_id, namespace_id)
);

CREATE TABLE connector_nonces (
  machine_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (machine_id, nonce)
);

CREATE TABLE fleet_events (
  machine_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_key TEXT NOT NULL,
  task_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('started', 'done', 'failed', 'blocker', 'stalled', 'preempted', 'retired', 'ended')),
  source_observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  change_seq INTEGER,
  PRIMARY KEY (machine_id, event_key)
);

CREATE TABLE probe_results (
  machine_id TEXT NOT NULL,
  probe TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('live', 'expired', 'missing', 'unknown')),
  reason_code TEXT NOT NULL,
  source_observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (machine_id, probe)
);

CREATE TABLE file_hashes (
  machine_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  path TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  size INTEGER NOT NULL,
  head_commit TEXT NOT NULL CHECK (length(head_commit) = 40),
  source_observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (machine_id, repo, path)
);

CREATE TABLE connector_status (
  machine_id TEXT PRIMARY KEY,
  sidecar_version TEXT NOT NULL,
  last_seq INTEGER NOT NULL,
  outbox_depth INTEGER NOT NULL,
  dropped_for_boundary INTEGER NOT NULL,
  last_heartbeat_at TEXT NOT NULL
);
