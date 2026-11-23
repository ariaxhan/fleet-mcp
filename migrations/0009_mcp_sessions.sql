-- Opaque transport sessions isolate request IDs across clients sharing one bearer token.
CREATE TABLE mcp_sessions (
  session_id TEXT PRIMARY KEY,
  owner_scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX mcp_sessions_expiry ON mcp_sessions(expires_at);
ALTER TABLE mcp_requests ADD COLUMN session_id TEXT;
CREATE INDEX mcp_requests_session ON mcp_requests(session_id);
