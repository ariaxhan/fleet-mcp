// Backup and restore drill (#27). Usage: node scripts/backup.mjs staging|production
// 1. counts every table remotely, 2. exports D1 to SQL, 3. archives the export in R2 under ops/backups/,
// 4. restores the export into an isolated in-memory SQLite and checks schema and row counts, 5. writes a receipt.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const env = process.argv[2];
if (!['staging', 'production'].includes(env)) throw new Error('usage: backup.mjs staging|production');
const db = `fleet-mcp-${env}`, bucket = `fleet-mcp-${env}-blobs`;
const wrangler = (...a) => execFileSync('npx', ['wrangler', ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
const remote = sql => JSON.parse(wrangler('d1', 'execute', db, '--env', env, '--remote', '--json', '--command', sql))[0].results;
const skip = n => n.startsWith('_cf_') || n.startsWith('sqlite_') || n === 'd1_migrations';
const counts = () => Object.fromEntries(remote("SELECT name FROM sqlite_master WHERE type='table'")
  .map(r => r.name).filter(n => !skip(n)).sort()
  .map(n => [n, remote(`SELECT COUNT(*) AS n FROM "${n}"`)[0].n]));

export function restoreDrill(sql, before, after) {
  const local = new DatabaseSync(':memory:');
  local.exec(sql);
  const tables = local.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name).filter(n => !skip(n)).sort();
  const restored = Object.fromEntries(tables.map(n => [n, local.prepare(`SELECT COUNT(*) AS n FROM "${n}"`).get().n]));
  // Writes may land during export: a restored count must lie between the counts taken before and after it.
  const mismatches = Object.keys(before).filter(n => !(n in restored) || restored[n] < before[n] || restored[n] > (after[n] ?? Infinity));
  const integrity = local.prepare('PRAGMA integrity_check').get().integrity_check;
  return { restored, mismatches, integrity, pass: mismatches.length === 0 && integrity === 'ok' };
}

if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith('scripts/backup.mjs')) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync('artifacts/backup', { recursive: true });
  const file = `artifacts/backup/${env}-${stamp}.sql`;
  const before = counts();
  wrangler('d1', 'export', db, '--env', env, '--remote', '--output', file, '--skip-confirmation');
  const after = counts();
  const sql = readFileSync(file, 'utf8');
  const sha = createHash('sha256').update(sql).digest('hex');
  const location = `r2://${bucket}/ops/backups/${stamp}-${sha.slice(0, 12)}.sql`;
  wrangler('r2', 'object', 'put', location.slice(5), '--file', file, '--remote');
  const drill = restoreDrill(sql, before, after);
  const receipt = { environment: env, database: db, exported_at: stamp, backup_sha256: sha, backup_bytes: Buffer.byteLength(sql),
    backup_location: location, counts_before: before, counts_after: after, restore_pass: drill.pass, restore: drill };
  writeFileSync(`artifacts/backup-${env}-${stamp}.json`, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${drill.pass ? 'PASS' : 'FAIL'} restore drill ${env} sha256=${sha} -> ${location}`);
  if (!drill.pass) process.exitCode = 1;
}
