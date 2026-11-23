import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle, type Env } from '../src/handler';
import { hmacHex } from '../src/auth';
import { PERSONAL_SOURCE_REPOS } from '../src/core';

// Real SQLite under a minimal D1 surface; R2 and KV as in-memory maps.
function d1(db: DatabaseSync) {
  const stmt = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...a: unknown[]) => stmt(sql, a.map(v => v === undefined ? null : v)),
    first: async () => (db.prepare(sql).get(...(args as never[])) ?? null),
    all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    run: async () => db.prepare(sql).run(...(args as never[])),
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: ReturnType<typeof stmt>[]) => {
      db.exec('BEGIN');
      try { for (const s of list) db.prepare(s.sql).run(...(s.args as never[])); db.exec('COMMIT'); }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
const store = () => {
  const m = new Map<string, ArrayBuffer>();
  return { m,
    put: async (k: string, v: ArrayBuffer | Uint8Array) => { m.set(k, v instanceof Uint8Array ? v.slice().buffer : v); },
    get: async (k: string, type?: string) => {
      const v = m.get(k); if (!v) return null;
      return type === 'arrayBuffer' ? v : { arrayBuffer: async () => v };
    },
    delete: async (k: string) => { m.delete(k); },
  };
};

export const KEY = 'test-hmac-key';
export async function setup() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort())
    db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  const env = { DB: d1(db), CACHE: store(), BLOBS: store(), TOKEN_HMAC_KEY: KEY, ENVIRONMENT: 'staging' } as unknown as Env;
  const tokens: Record<string, string> = {};
  for (const [name, caps, repos, expires] of [
    ['publisher', ['context:publish', 'context:read'], ['ariaxhan/fleet-mcp'], '2099-01-01T00:00:00Z'],
    ['reader', ['context:read'], ['ariaxhan/fleet-mcp'], '2099-01-01T00:00:00Z'],
    ['norepo', ['context:read'], [], '2099-01-01T00:00:00Z'],
    ['expired', ['context:read'], ['ariaxhan/fleet-mcp'], '2000-01-01T00:00:00Z'],
    ['fleet', ['fleet:read', 'context:read'], PERSONAL_SOURCE_REPOS, '2099-01-01T00:00:00Z'],
  ] as [string, string[], string[], string][]) {
    const id = name.padEnd(32, '0').replace(/[^a-f0-9]/g, 'a').slice(0, 32);
    const token = `fmt_${id}.${'A'.repeat(43)}`;
    db.prepare(`INSERT INTO tokens VALUES (?, ?, 1, ?, 'personal', 'personal-docs', ?, ?, 'test', '2026-01-01', ?, NULL)`)
      .run(id, await hmacHex(KEY, token), name, JSON.stringify(caps), JSON.stringify(repos), expires);
    tokens[name] = token;
  }
  const call = async (token: string, path: string, body?: unknown) => {
    const r = await handle(new Request(`https://fixture${path}`, {
      method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined }), env);
    return { status: r.status, body: await r.json() as any };
  };
  return { db, env, tokens, call };
}
