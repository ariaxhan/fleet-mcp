-- Expand only. Spike core slice (issue #11): auth, content store index, version
-- registry, change feed, outbox, idempotency and audit. Every row is owned by
-- (tenant_id, namespace_id, owner_principal_id). No corpus rows are seeded here.
CREATE TABLE namespaces (
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  policy_revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, namespace_id)
);
INSERT INTO namespaces (tenant_id, namespace_id) VALUES ('personal', 'personal-docs');

CREATE TABLE tokens (
  token_id TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  principal_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  source_repos TEXT NOT NULL,
  issuer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (tenant_id, namespace_id) REFERENCES namespaces (tenant_id, namespace_id)
);

CREATE TABLE blobs (
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  size INTEGER NOT NULL,
  owner_principal_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, namespace_id, content_hash)
);

CREATE TABLE resources (
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('doc', 'exemplar')),
  name TEXT NOT NULL,
  current_version INTEGER NOT NULL,
  owner_principal_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, namespace_id, kind, name)
);

CREATE TABLE versions (
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  content_hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
  change_note TEXT NOT NULL,
  source_repo TEXT NOT NULL,
  source_commit TEXT NOT NULL CHECK (length(source_commit) = 40),
  source_path TEXT NOT NULL,
  source_observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  owner_principal_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, namespace_id, kind, name, version),
  FOREIGN KEY (tenant_id, namespace_id, content_hash) REFERENCES blobs (tenant_id, namespace_id, content_hash)
);

CREATE TABLE change_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('created', 'updated', 'deleted')),
  source_repo TEXT NOT NULL,
  actor_principal_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX change_events_scope ON change_events (tenant_id, namespace_id, seq);

CREATE TABLE outbox (
  seq INTEGER PRIMARY KEY REFERENCES change_events (seq),
  applied_at TEXT
);

CREATE TABLE idempotency (
  token_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (token_id, tool, idempotency_key)
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT,
  namespace_id TEXT,
  principal_id TEXT,
  token_id TEXT,
  operation TEXT NOT NULL,
  target_id TEXT,
  policy_revision INTEGER,
  correlation_id TEXT NOT NULL,
  result TEXT NOT NULL,
  latency_ms INTEGER,
  size INTEGER,
  content_digest TEXT,
  created_at TEXT NOT NULL
);
