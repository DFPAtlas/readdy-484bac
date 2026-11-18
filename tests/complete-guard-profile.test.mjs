import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/complete-guard-profile/index.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source.replace(/^import .*;\r?\n/, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
});
const userId = 'signed-in-guard';
const updatedAt = '2026-11-16T10:00:00+00:00';

async function submit({ overrides, token = 'valid-token', input = { updatedAt }, missingObject, stale } = {}) {
  const writes = [];
  const guard = {
    id: 'guard-row',
    updated_at: updatedAt,
    profile_completed: false,
    full_name: 'Alex Smith',
    sia_licence_number: '1234567812345678',
    sia_expiry_date: '2027-11-16',
    phone: '01234567890',
    sia_licence_front_url: `${userId}/front-1.jpg`,
    sia_licence_back_url: `${userId}/back-1.jpg`,
    driving_licence_front_url: `${userId}/front-2.jpg`,
    driving_licence_back_url: `${userId}/back-2.jpg`,
    proof_of_address_url: `${userId}/poa-1.jpg`,
    ...overrides,
  };
  const caller = {
    auth: { getUser: async token => ({ data: { user: token === 'valid-token' ? { id: userId } : null } }) },
    from(table) {
      assert.equal(table, 'guards');
      return {
        select: () => ({
          eq(column, value) {
            assert.deepEqual([column, value], ['user_id', userId]);
            return { maybeSingle: async () => ({ data: guard }) };
          },
        }),
      };
    },
    rpc: async name => {
      assert.equal(name, 'ensure_my_free_entitlement');
      return { data: [{ user_id: userId }] };
    },
  };
  const service = {
    from(table) {
      if (table === 'wizard_fields') {
        const query = { select: () => query, eq: () => query, data: [
          { field_key: 'phone', field_label: 'Phone', is_required: true },
        ] };
        return query;
      }
      assert.equal(table, 'guards');
      return {
        update(values) {
          const filters = {};
          writes.push({ values, filters });
          const query = {
            eq(column, value) { filters[column] = value; return query; },
            select: () => query,
            maybeSingle: async () => ({ data: stale ? null : { id: guard.id } }),
          };
          return query;
        },
      };
    },
    storage: {
      from: () => ({
        list: async (folder, { search }) => {
          assert.equal(folder, userId);
          return { data: search === missingObject ? [] : [{ name: search, id: 'storage-object' }] };
        },
      }),
    },
  };
  let handler;
  new Function('Deno', 'createClient', outputText)(
    { serve: fn => { handler = fn; }, env: { get: name => name } },
    (_url, key) => key === 'SUPABASE_ANON_KEY' ? caller : service,
  );
  const response = await handler(new Request('https://example.com/complete-guard-profile', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  }));
  return { status: response.status, writes };
}

test('Finish marks only the signed-in guard’s validated draft complete', async () => {
  const result = await submit();
  assert.equal(result.status, 200);
  assert.equal(result.writes.length, 1);
  const [{ values, filters }] = result.writes;
  assert.deepEqual({ ...values, updated_at: typeof values.updated_at }, {
    profile_completed: true, onboarding_status: 'completed', updated_at: 'string',
  });
  assert.deepEqual(filters, { id: 'guard-row', user_id: userId, updated_at: updatedAt, profile_completed: false });
});

test('Finish rejects unauthenticated, incomplete and stale applications', async () => {
  for (const [options, status] of [
    [{ token: 'invalid' }, 401],
    [{ input: { updatedAt, user_id: 'another-guard' } }, 400],
    [{ overrides: { phone: ' ' } }, 400],
    [{ overrides: { sia_licence_back_url: 'another-guard/back-1.jpg' } }, 400],
    [{ missingObject: 'poa-1.jpg' }, 400],
    [{ input: { updatedAt: 'older-draft' } }, 409],
  ]) {
    assert.deepEqual(await submit(options), { status, writes: [] });
  }
  assert.equal((await submit({ stale: true })).status, 409);
  assert.deepEqual(await submit({ overrides: { profile_completed: true } }), { status: 200, writes: [] });
});

test('the production trigger rejects direct completion and permits the service update', async () => {
  const migration = readFileSync(new URL(
    '../supabase/migrations/20261114174659_require_recorded_guard_admin_approval.sql',
    import.meta.url,
  ), 'utf8');
  const trigger = migration.match(/CREATE OR REPLACE FUNCTION app\.protect_guard_server_fields\(\)[\s\S]+?\$function\$;/)[0];
  const otherFields = [...new Set(Array.from(trigger.matchAll(/\b(?:NEW|OLD)\.(\w+)/g), match => match[1]))]
    .filter(name => name !== 'profile_completed')
    .map(name => `${name} text`);
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA app;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS
        $$ SELECT current_setting('test.role') $$;
      CREATE FUNCTION app.is_active_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
      CREATE TABLE app.guards (profile_completed boolean, ${otherFields.join(', ')});
      ${trigger}
      CREATE TRIGGER protect_guard BEFORE UPDATE ON app.guards
        FOR EACH ROW EXECUTE FUNCTION app.protect_guard_server_fields();
      INSERT INTO app.guards (profile_completed) VALUES (false);
      SET test.role = 'authenticated';
    `);
    await assert.rejects(
      db.exec('UPDATE app.guards SET profile_completed = true'),
      { code: '42501', message: 'Attempt to modify protected guard fields' },
    );
    await assert.rejects(db.exec("UPDATE app.guards SET subscription_status = 'active'"), { code: '42501' });
    await db.exec("SET test.role = 'service_role'; UPDATE app.guards SET profile_completed = true;");
    assert.deepEqual((await db.query('SELECT profile_completed FROM app.guards')).rows, [{ profile_completed: true }]);
  } finally {
    await db.close();
  }
});
