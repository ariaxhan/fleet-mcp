// Issues a caller token: D1 stores only the HMAC verifier; the token prints once to stdout.
// Usage: FLEET_TOKEN_HMAC_KEY=... node scripts/issue-token.mjs <env> <principal> <cap,cap> <repo,repo> [days]
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
const [environment, principal, caps, repos, days = '90'] = process.argv.slice(2);
const key = process.env.FLEET_TOKEN_HMAC_KEY;
if (!['staging', 'production'].includes(environment) || !/^[\w:-]+$/.test(principal ?? '') || !caps || !repos || !key)
  throw new Error('Usage: FLEET_TOKEN_HMAC_KEY=... issue-token.mjs <env> <principal> <caps> <repos> [days]');
const list = s => JSON.stringify(s.split(',').filter(Boolean));
const id = randomBytes(16).toString('hex');
const token = `fmt_${id}.${randomBytes(32).toString('base64url')}`;
const verifier = createHmac('sha256', key).update(token).digest('hex');
const now = new Date(), expires = new Date(now.getTime() + Number(days) * 86400_000); // 90 day default, PRD 6.3.
const q = s => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO tokens VALUES (${[id, verifier].map(q)}, 1, ${q(principal)}, 'personal', 'personal-docs', `
  + `${q(list(caps))}, ${q(list(repos))}, 'issue-token-script', ${q(now.toISOString())}, ${q(expires.toISOString())}, NULL)`;
execFileSync('node_modules/.bin/wrangler', ['d1', 'execute', `fleet-mcp-${environment}`, '--env', environment, '--remote', '--command', sql],
  { stdio: ['ignore', 'ignore', 'inherit'] });
process.stdout.write(token + '\n');
