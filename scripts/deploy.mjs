import { execFileSync } from 'node:child_process';
const environment = process.argv[2];
if (!['staging', 'production'].includes(environment)) throw new Error('Use staging or production');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Deploy requires a clean checkout');
const sha = git('rev-parse', 'HEAD');
const wrangler = (...args) => execFileSync('node_modules/.bin/wrangler', args, { stdio: 'inherit' });
wrangler('d1', 'migrations', 'apply', `fleet-mcp-${environment}`, '--env', environment, '--remote');
wrangler('deploy', '--env', environment, '--var', `BUILD_SHA:${sha}`, '--var', `BUILD_TIME:${new Date().toISOString()}`);

// First deployment can return Cloudflare HTML before its routes propagate.
// Wait for this exact build; the subsequent sweep remains a separate release gate.
const host = environment === 'staging' ? 'fleet-mcp-staging' : 'fleet-mcp';
const url = `https://${host}.ariaxhan.workers.dev/version`;
let ready = false;
const deadline = Date.now() + 45000; // Readiness budget, a design decision.
while (Date.now() < deadline) {
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(3000) });
    const body = await response.json();
    if (response.ok && body.commit === sha && body.environment === environment) {
      ready = true;
      break;
    }
  } catch { /* Unavailable routes are expected during bounded propagation. */ }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
if (!ready) throw new Error(`Deployed build did not become ready: ${url}`);
console.log(`Ready: ${url} at ${sha}`);
