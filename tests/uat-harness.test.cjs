const assert = require('node:assert/strict');
const test = require('node:test');

test('synthetic UAT guards use the deployed starter entitlement', async () => {
  const { personas } = await import('../scripts/uat/personas.mjs');
  const guards = personas.filter((persona) => persona.kind === 'guard');

  assert.ok(guards.length > 0);
  for (const guard of guards) {
    assert.equal(guard.planSlug, 'guard_starter', `${guard.key} has an unknown guard plan`);
    assert.equal(guard.planName, 'Starter');
  }
});
