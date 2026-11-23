-- Monotonic epoch prevents repeated webhook invalidations from sharing a fence.
ALTER TABLE issue_heads ADD COLUMN invalidation_epoch INTEGER NOT NULL DEFAULT 0;
