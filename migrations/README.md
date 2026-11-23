# Forward-only migrations

Applied SQL is immutable. Add the next numbered migration, never a down migration.
Use expand, backfill, switch readers, then contract in a later release after old
readers are retired. The initial migration expands only fixture storage; it does
not prematurely define the full-v1 schema. No real corpus is seeded.

Before any future destructive contract: export the database to a protected backup,
record its location, verify restore in an isolated database, prove old-reader
retirement and retained-record preservation. Worker rollback does not roll back D1.
Fix schema mistakes with another forward migration. No manual schema edits.

`npm run migrate:local` applies locally. Remote commands are in docs/deploy.md.
D1 tracks applied filenames in d1_migrations and skips them on repeat application.
