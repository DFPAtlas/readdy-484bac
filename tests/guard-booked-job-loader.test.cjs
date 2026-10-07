const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('app/guard/jobs/[id]/GuardJobDetailClient.tsx', 'utf8');
const body = source.split('  const load = useCallback(async () => {')[1].split('  }, [jobId, router]);')[0];
async function run(result) {
  const state = {}, calls = [];
  const user = { id: 'guard-user' };
  const guard = { id: 'guard', full_name: 'UAT Guard', verification_status: 'verified' };
  const db = {
    auth: { getUser: async () => ({ data: { user } }) },
    functions: { invoke: async (name, args) => {
      calls.push({ name, args });
      if (result instanceof Error) throw result;
      return result;
    }},
    from(table) {
      assert.notEqual(table, 'jobs', 'booked job must not depend on public jobs RLS');
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'guards' ? guard : null }) };
      return q;
    }
  };
  const names = ['setGuardUserId','setGuardId','setGuardName','setGuardProfile','setJobError','setJob','setClientUserId','setHasApplied','setIsAssigned','setHasInvite','setIsSaved','setLoading'];
  const setters = names.map(name => value => { state[name] = value; });
  const fn = new Function('supabase','router','loadPaymentFlow','jobId', ...names, 'return (async () => {' + body + '})();');
  await fn(db, { push: () => { throw Error('unexpected redirect'); } }, () => {}, 'booked-job', ...setters);
  return { state, calls };
}
test('assigned confirmed booking loads through authenticated endpoint', async () => {
  const job = { id: 'booked-job', status: 'confirmed' };
  const { state, calls } = await run({ data: { job }, error: null });
  assert.deepEqual(state.setJob, job);
  assert.deepEqual(calls, [{ name: 'get-job-detail', args: { body: { jobId: 'booked-job' } } }]);
  assert.equal(state.setLoading, false);
  assert.equal(state.setJobError, null);
});
test('authorization and transport failures remain errors, not missing bookings', async () => {
  for (const result of [{ data: null, error: { message: 'Forbidden' } }, { data: { error: 'Forbidden' }, error: null }, new Error('Network failed')]) {
    const { state } = await run(result);
    assert.equal(state.setJob, null);
    assert.match(state.setJobError, /Unable to load/);
    assert.equal(state.setLoading, false);
  }
});
test('genuinely missing job remains a not-found state', async () => {
  const { state } = await run({ data: { job: null }, error: null });
  assert.equal(state.setJob, null);
  assert.equal(state.setJobError, null);
});
