-- Expand only. Full Studio sidecar (issue #18, PRD 2.6): checkout state,
-- checkpoint hash comparisons, the pull-only typed work queue (which is also
-- the lesson write-back outbox) and sync reconciliation status.
CREATE TABLE checkout_states (
  machine_id TEXT NOT NULL,
  checkout_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  head_commit TEXT NOT NULL CHECK (length(head_commit) = 40),
  branch TEXT NOT NULL,
  dirty INTEGER NOT NULL CHECK (dirty IN (0, 1)),
  tree_hash TEXT NOT NULL CHECK (length(tree_hash) = 64),
  source_observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (machine_id, checkout_id)
);

-- Server-side Handoff checkpoint index (authoritative, PRD 3.2). Populated by Handoff.
CREATE TABLE handoff_checkpoints (
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, namespace_id, checkpoint_id)
);

CREATE TABLE checkpoint_reports (
  machine_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  local_hash TEXT NOT NULL CHECK (length(local_hash) = 64),
  source_observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (machine_id, checkpoint_id)
);

CREATE TABLE connector_jobs (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('probe', 'checkout_state', 'file_upload', 'suite_run', 'lesson_writeback')),
  params_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'leased', 'done', 'failed', 'unsupported', 'refused', 'unavailable')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  lease_until TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reason_code TEXT,
  result_json TEXT,
  source_observed_at TEXT
);
CREATE INDEX connector_jobs_queue ON connector_jobs (machine_id, status, created_at);

ALTER TABLE connector_status ADD COLUMN observations_json TEXT;
ALTER TABLE connector_status ADD COLUMN last_reconciled_at TEXT;
ALTER TABLE connector_status ADD COLUMN reconcile_missing INTEGER;
