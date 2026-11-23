-- Transient compare-and-swap assertions, inserted and deleted in one D1 batch.
-- A stale producer violates the check and rolls back its entire observation.
CREATE TABLE observation_guards (
 tenant_id TEXT NOT NULL, namespace_id TEXT NOT NULL, id TEXT NOT NULL,
 actual TEXT NOT NULL, expected TEXT NOT NULL, CHECK (actual=expected),
 PRIMARY KEY (tenant_id,namespace_id,id)
);
