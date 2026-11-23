-- Expand-only spike read paths. Namespace ownership is checked on every query.
CREATE TABLE issue_snapshots (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, repo TEXT NOT NULL,
 number INTEGER NOT NULL, version INTEGER NOT NULL, content_hash TEXT NOT NULL,
 body TEXT NOT NULL, source_observed_at TEXT NOT NULL, computed_at TEXT NOT NULL,
 PRIMARY KEY (tenant_id, namespace_id, repo, number, version)
);
CREATE TABLE issue_heads (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, repo TEXT NOT NULL,
 number INTEGER NOT NULL, version INTEGER NOT NULL, invalidated INTEGER NOT NULL DEFAULT 0,
 source_observed_at TEXT NOT NULL,
 PRIMARY KEY (tenant_id, namespace_id, repo, number)
);
CREATE TABLE issue_coverage (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, repo TEXT NOT NULL,
 covered_through TEXT NOT NULL, reconciled_at TEXT NOT NULL,
 PRIMARY KEY (tenant_id, namespace_id, repo)
);
CREATE TABLE recall_collections (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, source_repo TEXT NOT NULL,
 source_db TEXT NOT NULL, generation INTEGER NOT NULL, content_hash TEXT NOT NULL,
 observed_at TEXT NOT NULL, report TEXT NOT NULL,
 PRIMARY KEY (tenant_id, namespace_id, source_db)
);
CREATE TABLE recall_lessons (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, source_db TEXT NOT NULL,
 id TEXT NOT NULL, content_hash TEXT NOT NULL, kind TEXT NOT NULL,
 what TEXT NOT NULL, why TEXT NOT NULL, hit_count INTEGER NOT NULL,
 last_recalled TEXT, status TEXT NOT NULL DEFAULT 'active',
 PRIMARY KEY (tenant_id, namespace_id, source_db, id)
);
CREATE TABLE recall_queries (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, source_db TEXT NOT NULL,
 query_hash TEXT NOT NULL, matches INTEGER NOT NULL, observed_at TEXT NOT NULL
);
