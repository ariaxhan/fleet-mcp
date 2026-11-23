import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Release orchestration is a Node ESM script.
import { release, isContract } from '../scripts/deploy.mjs';

test('release contracts only after the old reader passes expanded schema, then sweeps new build', async () => {
  const calls: string[] = [];
  const actions = Object.fromEntries(['expand','sweepOld','contract','deploy','sweepNew'].map(name => [name, async () => { calls.push(name); }]));
  await release(actions);
  assert.deepEqual(calls, ['expand','sweepOld','contract','deploy','sweepNew']);
  assert.equal(isContract('0011_contract_old_column.sql'), true);
  assert.equal(isContract('0011_expand_new_column.sql'), false);
});
test('each failure prevents every later release effect', async () => {
  const phases = ['expand','sweepOld','contract','deploy','sweepNew'];
  for (const failure of phases) {
    const calls: string[] = [];
    const actions = Object.fromEntries(phases.map(name => [name, async () => {
      calls.push(name); if (name === failure) throw new Error('fixture failure');
    }]));
    await assert.rejects(release(actions), /fixture failure/);
    assert.deepEqual(calls, phases.slice(0, phases.indexOf(failure) + 1));
  }
});
