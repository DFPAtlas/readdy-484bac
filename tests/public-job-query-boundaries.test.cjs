const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/enterprise-module.cjs');
const { hooksHarness, nodes, content, flush } = require('./helpers/guard-ui-fixture.cjs');
const ID = '0c6f00bc-f7c2-4c61-ae21-a850218fcaa1';
const child = { __esModule: true, default: () => null };

test('all six private static job shells avoid anonymous database reads and preserve the runtime job prop', async () => {
  const pages = [
    ['app/client/jobs/[id]/page.tsx', './JobDetailClient'],
    ['app/client/jobs/[id]/confirmation/page.tsx', './BookingConfirmationClient'],
    ['app/client/jobs/[id]/payment/page.tsx', './PaymentClient'],
    ['app/client/jobs/[id]/select-guards/page.tsx', './SelectGuardsClient'],
    ['app/guard/jobs/[id]/page.tsx', './GuardJobDetailClient'],
    ['app/guard/jobs/[id]/apply/page.tsx', './GuardApplyClient'],
  ];
  for (const [file, component] of pages) {
    let creates = 0;
    const page = load(file, { [component]: child, '@supabase/supabase-js': {
      createClient() { creates++; throw new Error('No build-time access to private jobs'); },
    } });
    assert.deepEqual(await page.generateStaticParams(), [{ id: '1' }, { id: '2' }, { id: '3' }]);
    assert.equal(creates, 0, file);
    const tree = await page.default({ params: Promise.resolve({ id: ID }) });
    assert.ok(nodes(tree).some(node => node.props?.jobId === ID), file);
  }
});

function publicPage(rows = [], job = null) {
  const calls = [];
  const query = { select(fields) { calls.push(['select', fields]); return query; },
    eq(key, value) { calls.push(['eq', key, value]); return query; },
    limit() { return Promise.resolve({ data: rows, error: null }); },
    maybeSingle() { return Promise.resolve({ data: job, error: null }); } };
  const page = load('app/jobs/[id]/page.tsx', { './JobDetailClient': child,
    '@supabase/supabase-js': { createClient() { calls.push(['client']); return {
      rpc(name) { assert.equal(name, 'get_public_jobs'); calls.push(['rpc', name]); return query; },
    }; } },
  });
  return { page, calls };
}

test('invalid/fallback job metadata never reaches a UUID query; valid public metadata keeps its title and canonical URL', async () => {
  const f = publicPage([], { job_title: 'Synthetic public role', venue_city: 'London', job_description: 'Synthetic public description' });
  for (const id of ['1', '2', '3', '', 'undefined', 'not-a-job', `${ID}x`, ` ${ID}`]) {
    const metadata = await f.page.generateMetadata({ params: Promise.resolve({ id }) });
    assert.equal(metadata.title, 'Security Guard Job | QuickGuard UK');
  }
  assert.equal(f.calls.length, 0);
  const metadata = await f.page.generateMetadata({ params: Promise.resolve({ id: ID }) });
  assert.equal(metadata.title, 'Synthetic public role | QuickGuard UK');
  assert.equal(metadata.alternates.canonical, `https://quickguard.uk/jobs/detail?id=${ID}`);
  assert.ok(f.calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === ID));
});

test('public static generation rejects malformed database IDs while retaining valid public listings', async () => {
  const f = publicPage([{ id: ID }, { id: '1' }, { id: null }, { id: 'not-a-job' }]);
  assert.deepEqual(await f.page.generateStaticParams(), [{ id: ID }]);
  assert.deepEqual(await publicPage([]).page.generateStaticParams(), [{ id: '1' }, { id: '2' }, { id: '3' }]);
});

test('the actual public job component rejects malformed IDs without auth or database traffic; valid IDs still load', async () => {
  let reads = 0, authReads = 0;
  const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: null, error: null }) };
  const make = () => hooksHarness('app/jobs/[id]/JobDetailClient.tsx', {
    '@/hooks/useSafeRouter': { useSafeRouter: () => ({ replace() {} }) },
    '../../../components/NavSidebar': child, '../../../components/Footer': child,
    'next/link': child, '@/components/JobPostingSchema': { JobPostingSchema: () => null }, './SimilarJobs': child,
    '@/lib/supabase': { supabase: { auth: { async getSession() { authReads++; return { data: { session: null } }; } },
      rpc(name) { assert.equal(name, 'get_public_jobs'); reads++; return query; } } },
  });
  const invalid = make(); invalid.render({ jobId: '1' }); await invalid.effects();
  assert.match(content(invalid.render({ jobId: '1' })), /not found/i);
  assert.equal(reads, 0); assert.equal(authReads, 0); invalid.unmount();
  const valid = make(); valid.render({ jobId: ID }); await valid.effects();
  assert.equal(reads, 1); assert.equal(authReads, 1); valid.unmount();
});

function statsFixture(data, error = null) {
  const calls = [];
  const query = { select(fields) { calls.push(['select', fields]); return query; },
    eq(key, value) { calls.push(['eq', key, value]); return query; },
    in(key, values) { calls.push(['in', key, values]); return Promise.resolve({ data, error }); } };
  return { calls, client: { from(table) { assert.equal(table, 'qg_launch_public_stats'); calls.push(['from', table]); return query; } } };
}

test('homepage statistics read only published, explicitly named public metrics and never count private tables', async () => {
  const api = load('lib/public-platform-stats.ts');
  const f = statsFixture([{ key: 'total_guard_profiles', value: 75 }, { key: 'total_completed_jobs', value: 60 },
    { key: 'total_active_clients', value: 55 }, { key: 'completed_assignment_rate', value: 88.5 }]);
  assert.deepEqual(await api.loadPublicPlatformStats(f.client), { totalGuards: 75, completedJobs: 60, activeClients: 55, successRate: 88.5 });
  assert.deepEqual(f.calls.find(call => call[0] === 'eq'), ['eq', 'is_public', true]);
  assert.deepEqual(f.calls.find(call => call[0] === 'in')[2].sort(), ['completed_assignment_rate', 'total_active_clients', 'total_completed_jobs', 'total_guard_profiles']);
  assert.deepEqual(await api.loadPublicPlatformStats(statsFixture([]).client), api.EMPTY_PUBLIC_PLATFORM_STATS);
});

test('unpublished, unrelated, malformed or failed optional statistics never become invented zeroes or claims', async () => {
  const api = load('lib/public-platform-stats.ts');
  for (const rows of [[{ key: 'total_verified_guards', value: 9999 }], [{ key: 'total_guard_profiles', value: '100' }],
    [{ key: 'total_completed_jobs', value: -1 }], [{ key: 'total_active_clients', value: 1.5 }],
    [{ key: 'completed_assignment_rate', value: 101 }], [{ key: 'total_guard_profiles', value: Infinity }], [null]]) {
    assert.deepEqual(await api.loadPublicPlatformStats(statsFixture(rows).client), api.EMPTY_PUBLIC_PLATFORM_STATS);
  }
  await assert.rejects(api.loadPublicPlatformStats(statsFixture(null).client), /could not be loaded/);
  await assert.rejects(api.loadPublicPlatformStats(statsFixture([], { message: 'private detail' }).client), /could not be loaded/);
});

function homepage(client) {
  return hooksHarness('app/HomepageClient.tsx', {
    'next/link': child, './TrustBadges': child, '@/lib/supabase': { supabase: client },
  }, { IntersectionObserver: class { observe() {} disconnect() {} }, document: { querySelectorAll: () => [] } });
}

test('actual homepage preserves the minimum display threshold and hides absent or failed public metrics', async () => {
  for (const [rows, visible] of [[[], false], [[{ key: 'total_guard_profiles', value: 49 }], false],
    [[{ key: 'total_guard_profiles', value: 50 }], true]]) {
    const f = statsFixture(rows), h = homepage(f.client); h.render(); await h.effects();
    assert.equal(nodes(h.render()).some(node => node.props?.['aria-label'] === 'Platform statistics'), visible);
    assert.equal(f.calls.filter(call => call[0] === 'from').length, 1); h.unmount();
  }
  const h = homepage(statsFixture(null, { message: 'unavailable' }).client); h.render(); await h.effects();
  assert.equal(nodes(h.render()).some(node => node.props?.['aria-label'] === 'Platform statistics'), false); h.unmount();
});

test('retired homepage responses cannot update an unmounted component', async () => {
  let resolve;
  const deferred = new Promise(done => { resolve = done; });
  const query = { select() { return query; }, eq() { return query; }, in: () => deferred };
  const h = homepage({ from: () => query }); h.render(); await h.effects(); h.unmount(); const before = h.writes;
  resolve({ data: [{ key: 'total_guard_profiles', value: 75 }], error: null }); await flush();
  assert.equal(h.writes, before);
});
