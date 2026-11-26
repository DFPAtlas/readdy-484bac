// Built-page validation with synthetic data only. Never use production APIs.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';
const origin = new URL(base);
assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname));
const ID = '0c6f00bc-f7c2-4c61-ae21-a850218fcaa1';
const metrics = [
  { key: 'total_guard_profiles', value: 75 }, { key: 'total_completed_jobs', value: 60 },
  { key: 'total_active_clients', value: 55 }, { key: 'completed_assignment_rate', value: 90 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      let statsMode = 'published';
      const violations = [], errors = [], reads = [];
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === origin.origin) return route.continue();
        if (url.origin !== 'http://127.0.0.1:9') return route.abort();
        const headers = { 'content-type': 'application/json', 'access-control-allow-origin': origin.origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        reads.push(url.pathname);
        let data = [], status = 200;
        if (/\/rest\/v1\/(jobs|guards|clients|job_assignments)$/.test(url.pathname)) {
          violations.push(url.pathname); status = 401; data = { message: 'Private table access is forbidden' };
        } else if (url.pathname.endsWith('/qg_launch_public_stats')) {
          assert.equal(url.searchParams.get('is_public'), 'eq.true');
          assert.equal(url.searchParams.get('select'), 'key,value');
          data = statsMode === 'published' ? metrics : [];
          if (statsMode === 'failure') { status = 503; data = { message: 'Synthetic optional metric outage' }; }
        } else if (url.pathname.endsWith('/rpc/get_public_jobs')) {
          const id = url.searchParams.get('id');
          if (id && !/^eq\.[0-9a-f-]{36}$/i.test(id)) violations.push('Invalid UUID request: ' + id);
          data = null;
        } else if (url.pathname.endsWith('/qg-public-launch-settings')) {
          data = { settings: { programme_enabled: false, exit_popup_enabled: false, exit_popup_test_icon_enabled: false } };
        } else if (url.pathname.endsWith('/public-site-media')) data = { publications: [] };
        return route.fulfill({ status, headers, body: JSON.stringify(data) });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/');
      const stats = page.getByRole('group', { name: 'Platform statistics', exact: true });
      await expect(stats).toBeVisible();
      await stats.scrollIntoViewIfNeeded();
      await expect(stats).toHaveCSS('opacity', '1');
      await expect(stats.getByText('75+', { exact: true })).toBeVisible();
      assert.equal(reads.filter(path => path.endsWith('/qg_launch_public_stats')).length, 1);
      statsMode = 'empty';
      await Promise.all([page.waitForResponse(response => response.url().includes('/qg_launch_public_stats')), page.reload()]);
      await expect(stats).toHaveCount(0);
      statsMode = 'failure';
      await Promise.all([page.waitForResponse(response => response.url().includes('/qg_launch_public_stats')), page.reload()]);
      await expect(stats).toHaveCount(0);
      const before = reads.filter(path => path.endsWith('/rpc/get_public_jobs')).length;
      await page.goto(base + '/jobs/detail?id=1');
      await expect(page.getByRole('heading', { name: /job not found/i })).toBeVisible();
      assert.equal(reads.filter(path => path.endsWith('/rpc/get_public_jobs')).length, before);
      await page.goto(base + '/jobs/detail?id=' + ID);
      await expect(page.getByRole('heading', { name: /job not found/i })).toBeVisible();
      assert.equal(reads.filter(path => path.endsWith('/rpc/get_public_jobs')).length, before + 1);
      assert.deepEqual(violations, []); assert.deepEqual(errors, []);
      console.log(`PASS public query boundaries ${width}px: published/absent/failed metrics, no private count requests, invalid UUID suppression and valid public lookup; synthetic APIs only`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
