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

Release orchestration separates `NNNN_contract_NAME.sql` from compatible expansion
files in temporary migration directories, preserving the original filenames and
D1's applied-file ledger. Expand runs first against the previous Worker; its live
fixture sweep must pass before contract runs. Deployment and a second fixture
sweep follow. Contract requires a release-bound independent recovery receipt;
see docs/deploy.md. Never use the standalone `migrate:*` commands for a release
containing contract migrations, since they apply the entire directory together.
