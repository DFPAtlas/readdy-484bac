const fs = require('node:fs');
const ts = require('typescript');
const schema = require('../fixtures/client-history-schema.json');
const relations = require('../fixtures/client-history-relations.json');

function loadEndpoint(slug, db) {
  let handler;
  const compiled = ts.transpileModule(fs.readFileSync(`supabase/functions/${slug}/index.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const createClient = (_url, _key, options) => {
    if (options?.db?.schema !== 'app') throw new Error('Application reads must explicitly select app schema');
    return db;
  };
  new Function('require', 'Deno', 'exports', compiled)(() => ({ createClient }), {
    serve: fn => { handler = fn; }, env: { get: () => 'test-placeholder' },
  }, {});
  return async (body = {}, token = 'test-token', method = 'POST') => {
    const response = await handler(new Request('https://example.invalid', {
      method, headers: token ? { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    }));
    return { status: response.status, body: method === 'OPTIONS' ? null : await response.json() };
  };
}

function databaseFixture(rows, { failTable, failSelect, signedOut = false } = {}) {
  const calls = [];
  const db = {
    calls, auth: { async getUser(token) { return { data: { user: !signedOut && token === 'test-token' ? { id: 'user-client' } : null }, error: null }; } },
    from(table) {
      const call = { table, fields: '*', filters: [], orders: [], offset: 0, end: Infinity, single: false, count: false };
      calls.push(call);
      const valueAt = (row, key) => key.split('.').reduce((value, part) => value?.[part], row);
      const query = {
        select(fields, opts) { call.fields = fields; call.count = opts?.count === 'exact'; return query; },
        eq(key, value) { call.filters.push(row => valueAt(row, key) === value); return query; },
        in(key, values) { call.filters.push(row => values.includes(valueAt(row, key))); return query; },
        ilike(key, value) { call.filters.push(row => String(valueAt(row, key) || '').toLowerCase().includes(value.replaceAll('%', '').toLowerCase())); return query; },
        gte(key, value) { call.filters.push(row => valueAt(row, key) >= value); return query; },
        lte(key, value) { call.filters.push(row => valueAt(row, key) <= value); return query; },
        or(expression) {
          if (expression === 'is_deleted.is.null,is_deleted.eq.false') call.filters.push(row => row.is_deleted !== true);
          else {
            const term = expression.split('.ilike.%')[1].split('%')[0].toLowerCase();
            call.filters.push(row => [row.job_title, row.venue_city, row.venue_postcode].some(value => String(value || '').toLowerCase().includes(term)));
          }
          return query;
        },
        order(key, options) { call.orders.push([key, options.ascending]); return query; },
        range(start, end) { call.offset = start; call.end = end; return query; },
        limit(value) { call.end = value - 1; return query; },
        maybeSingle() { call.single = true; return query; },
        then(resolve, reject) {
          const run = () => {
            if (table === failTable || failSelect?.(call)) return { data: null, error: { message: 'simulated database failure' } };
            // PostgREST validates embedded relationships even when the table
            // has no rows. This must precede row filtering/projection.
            const embedded = [...call.fields.matchAll(/\b(\w+)(?:!inner)?\s*\(/g)].map(match => match[1]);
            for (const relation of embedded) {
              if (!relations[table]?.includes(relation)) return { data: null, error: { code: 'PGRST200', message: `Missing relationship: ${table} -> ${relation}` } };
            }
            const columns = call.fields.replace(/guards(?:!inner)?\s*\([^)]*\)/g, '').split(',').map(value => value.trim()).filter(Boolean);
            for (const field of columns) {
              if (field !== '*' && !schema[table]?.includes(field.split(':').at(-1))) return { data: null, error: { message: `Unknown ${table} field ${field}` } };
            }
            let data = (rows[table] || []).filter(row => call.filters.every(filter => filter(row)));
            data = [...data].sort((a, b) => {
              for (const [key, ascending] of call.orders) {
                const diff = String(a[key] || '').localeCompare(String(b[key] || ''));
                if (diff) return ascending ? diff : -diff;
              }
              return 0;
            });
            const count = data.length;
            data = data.slice(call.offset, call.end + 1).map(row => {
              const copy = { ...row };
              for (const column of columns) if (column.includes(':')) {
                const [alias, source] = column.split(':'); copy[alias] = row[source];
              }
              return copy;
            });
            return { data: call.single ? data[0] || null : data, count: call.count ? count : null, error: null };
          };
          return Promise.resolve().then(run).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return db;
}

function sampleRows() {
  const client = { id: 'client-owned', user_id: 'user-client', company_name: 'Synthetic Events', total_spent: 0 };
  const guard = { id: 'guard-assigned', full_name: 'Synthetic Inactive Guard', is_active: false, verification_status: 'approved', sia_verified: true, sia_licence_number: 'TEST-LICENCE', phone: 'private', bank_account_number: 'private', sia_licence_front_url: 'private' };
  const jobs = Array.from({ length: 12 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, client_id: client.id,
    job_title: `Job ${i + 1}`, venue_city: i % 2 ? 'London' : 'Hertford',
    start_date: '2026-11-20', created_at: `2026-11-${String(i + 1).padStart(2, '0')}`,
    status: i === 0 ? 'completed' : 'open', payment_status: i === 0 ? 'paid' : 'pending', is_deleted: i === 1 ? null : false,
  }));
  jobs.push({ ...jobs[0], id: 'foreign-job', client_id: 'other-client' }, { ...jobs[0], id: 'deleted-job', is_deleted: true });
  const assignment = { id: 'assignment-test', job_id: jobs[0].id, guard_id: guard.id, status: 'completed', guards: guard };
  return {
    clients: [client], jobs, guards: [guard], job_assignments: [assignment],
    job_applications: [{ id: 'application', job_id: jobs[2].id, guard_id: guard.id, guards: guard }],
    reviews: [{ id: 'review', job_id: jobs[0].id, client_id: client.id, guard_id: guard.id, rating: 5, review_text: 'Synthetic review', guards: guard }],
    transactions: [{ id: 'transaction', job_id: jobs[0].id, client_id: client.id, amount: 11, status: 'completed', stripe_payment_intent: 'pi_synthetic', refund_amount: 3 }],
  };
}

module.exports = { loadEndpoint, databaseFixture, sampleRows };
