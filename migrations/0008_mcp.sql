-- Bounded spike cancellation registry. No corpus bodies or bearer credentials are stored.
CREATE TABLE mcp_requests (
  request_key TEXT PRIMARY KEY,
  generation TEXT NOT NULL,
  cancelled INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0, 1)),
  expires_at INTEGER NOT NULL
);
CREATE INDEX mcp_requests_expiry ON mcp_requests(expires_at);
