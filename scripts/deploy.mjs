import { execFileSync } from 'node:child_process';
const environment = process.argv[2];
if (!['staging', 'production'].includes(environment)) throw new Error('Use staging or production');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Deploy requires a clean checkout');
const sha = git('rev-parse', 'HEAD');
const wrangler = (...args) => execFileSync('node_modules/.bin/wrangler', args, { stdio: 'inherit' });
wrangler('d1', 'migrations', 'apply', `fleet-mcp-${environment}`, '--env', environment, '--remote');
wrangler('deploy', '--env', environment, '--var', `BUILD_SHA:${sha}`, '--var', `BUILD_TIME:${new Date().toISOString()}`);
