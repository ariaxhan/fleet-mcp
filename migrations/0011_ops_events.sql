-- Expansion (#27): operational samples for observability and alerts. No existing reader changes.
CREATE TABLE ops_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  correlation_id TEXT,
  observed_at TEXT NOT NULL
);
CREATE INDEX ops_events_kind ON ops_events (kind, observed_at);
