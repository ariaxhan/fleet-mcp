-- Expand only. This table contains synthetic deployment fixtures, never corpus data.
CREATE TABLE scaffold_fixture (
  namespace_id TEXT PRIMARY KEY CHECK (namespace_id IN ('fixture-staging', 'fixture-production')),
  owner_principal_id TEXT NOT NULL DEFAULT 'deployment-sweep'
);
INSERT INTO scaffold_fixture (namespace_id) VALUES ('fixture-staging'), ('fixture-production');
