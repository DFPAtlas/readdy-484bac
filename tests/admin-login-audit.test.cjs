const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

function loadHandler(harness) {
  let handler;
  const source = fs.readFileSync('supabase/functions/admin-login/index.ts', 'utf8')
    .replace(/^import .*;\n/gm, '');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const Deno = {
    env: {
      get(name) {
        return {
          SUPABASE_URL: 'https://project.test',
          SUPABASE_ANON_KEY: 'anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        }[name];
      },
    },
    serve(fn) { handler = fn; },
  };
  new Function('createClient', 'Deno', code)(harness.createClient, Deno);
  return handler;
}

function makeHarness({ authSuccess = true, admin = 'valid', emailFailures = 0, ipFailures = 0 } = {}) {
  const writes = [];
  let signedOut = false;
  const adminRecord = admin === 'valid'
    ? { id: 'admin-row', user_id: 'auth-user', email: 'admin@example.com', full_name: 'Admin User', role: 'admin', is_active: true }
    : admin === 'inactive'
      ? { id: 'admin-row', user_id: 'auth-user', email: 'admin@example.com', full_name: 'Admin User', role: 'admin', is_active: false }
      : null;

  const service = {
    schema() { return this; },
    from(table) {
      let operation = 'select';
      let payload;
      let wantsCount = false;
      const filters = [];
      const query = {
        select(_columns, options) { operation = 'select'; wantsCount = options?.count === 'exact'; return query; },
        insert(value) { operation = 'insert'; payload = value; return query; },
        update(value) { operation = 'update'; payload = value; return query; },
        eq(column, value) { filters.push([column, value]); return query; },
        gte(column, value) { filters.push([column, value]); return query; },
        maybeSingle() { return query; },
        then(resolve, reject) {
          if (operation === 'insert') {
            writes.push({ table, operation, payload });
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (operation === 'update') {
            writes.push({ table, operation, payload, filters });
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          if (table === 'admin_login_attempts' && wantsCount) {
            const count = filters.some(([column]) => column === 'email') ? emailFailures : ipFailures;
            return Promise.resolve({ data: null, count, error: null }).then(resolve, reject);
          }
          if (table === 'admin_users') {
            return Promise.resolve({ data: adminRecord, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  const auth = {
    auth: {
      async signInWithPassword() {
        if (!authSuccess) return { data: { user: null, session: null }, error: { message: 'bad credentials' } };
        return {
          data: {
            user: { id: 'auth-user' },
            session: {
              access_token: 'access-token',
              refresh_token: 'refresh-token',
              expires_in: 3600,
              expires_at: 123456,
              token_type: 'bearer',
            },
          },
          error: null,
        };
      },
      async signOut() { signedOut = true; return { error: null }; },
    },
  };

  return {
    writes,
    get signedOut() { return signedOut; },
    createClient(_url, key) { return key === 'service-key' ? service : auth; },
  };
}

function request(body, method = 'POST') {
  return new Request('https://project.test/functions/v1/admin-login', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://quickguard.uk',
      'X-Forwarded-For': '203.0.113.10, 10.0.0.1',
      'User-Agent': 'QuickGuard test',
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

test('successful active-admin login is audited before a session is returned', async () => {
  const harness = makeHarness();
  const handler = loadHandler(harness);
  const response = await handler(request({ email: 'ADMIN@example.com ', password: 'secret' }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.session.access_token, 'access-token');
  assert(harness.writes.some((write) =>
    write.table === 'admin_login_attempts'
    && write.payload.email === 'admin@example.com'
    && write.payload.ip_address === '203.0.113.10'
    && write.payload.success === true
  ));
  assert(harness.writes.some((write) =>
    write.table === 'admin_activity_log'
    && write.payload.action_type === 'login'
    && write.payload.admin_user_id === 'admin-row'
  ));
  assert(harness.writes.some((write) =>
    write.table === 'admin_users' && write.operation === 'update' && write.payload.last_login
  ));
});

test('bad credentials and authenticated non-admins are recorded as failed attempts', async () => {
  const invalidCredentials = makeHarness({ authSuccess: false });
  let response = await loadHandler(invalidCredentials)(request({ email: 'person@example.com', password: 'wrong' }));
  assert.equal(response.status, 401);
  assert(invalidCredentials.writes.some((write) =>
    write.table === 'admin_login_attempts' && write.payload.success === false
  ));
  assert(invalidCredentials.writes.some((write) =>
    write.table === 'admin_activity_log' && write.payload.action_type === 'login_failed'
  ));

  const nonAdmin = makeHarness({ admin: 'missing' });
  response = await loadHandler(nonAdmin)(request({ email: 'person@example.com', password: 'valid-password' }));
  assert.equal(response.status, 401);
  assert.equal(nonAdmin.signedOut, true);
  assert(nonAdmin.writes.some((write) =>
    write.table === 'admin_login_attempts' && write.payload.success === false
  ));
});

test('repeated failures are rate-limited and the block is audited', async () => {
  const harness = makeHarness({ emailFailures: 5 });
  const response = await loadHandler(harness)(request({ email: 'admin@example.com', password: 'secret' }));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '900');
  assert(harness.writes.some((write) => write.table === 'rate_limit_events' && write.payload.blocked));
  assert(harness.writes.some((write) => write.table === 'admin_login_attempts' && !write.payload.success));
});

test('cleanup migration removes only the orphaned completion-task table and view', async () => {
  const migration = fs.readFileSync(
    'supabase/migrations/20261006125836_restore_admin_login_audit_and_remove_orphaned_completion_tasks.sql',
    'utf8',
  );
  const db = new PGlite();
  try {
    await db.exec(`
      create schema app;
      create table app.admin_login_attempts (
        id uuid primary key,
        email text not null,
        ip_address text,
        attempted_at timestamptz,
        success boolean
      );
      create table app.job_completion_tasks (id uuid primary key);
      create view public.job_completion_tasks as select * from app.job_completion_tasks;
    `);
    await db.exec(migration);
    await db.exec(migration);

    const relations = await db.query(`
      select n.nspname as schema_name, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where (n.nspname, c.relname) in (
        ('app', 'admin_login_attempts'),
        ('app', 'job_completion_tasks'),
        ('public', 'job_completion_tasks')
      )
      order by 1, 2
    `);
    assert.deepEqual(relations.rows, [{ schema_name: 'app', relname: 'admin_login_attempts' }]);

    const indexes = await db.query(`
      select indexname from pg_indexes
      where schemaname = 'app' and tablename = 'admin_login_attempts'
    `);
    assert(indexes.rows.some((row) => row.indexname === 'idx_admin_login_attempts_ip_attempted_at'));
  } finally {
    await db.close();
  }
});

test('runtime cleanup lists no longer reference job_completion_tasks', () => {
  assert(!fs.readFileSync('supabase/functions/admin-delete-user/index.ts', 'utf8').includes('job_completion_tasks'));
  assert(!fs.readFileSync('components/admin/DeleteUserModal.tsx', 'utf8').includes('job_completion_tasks'));
});
