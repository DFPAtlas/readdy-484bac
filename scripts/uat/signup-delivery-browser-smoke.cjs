// Built public registration pages, synthetic APIs, zero external traffic.
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict'), fs = require('node:fs');
const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100', origin = new URL(base);
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
let latestPage;
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const width of [1440, 390]) for (const role of ['client', 'guard']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
      let outcome = 'failed'; const posts = [], unexpected = [], errors = [];
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === origin.origin) return route.continue();
        if (url.origin !== 'http://127.0.0.1:9') return route.abort();
        const headers = { 'content-type': 'application/json', 'access-control-allow-origin': origin.origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        let data = null, status = 200;
        if (url.pathname === '/functions/v1/register-magic-link') {
          posts.push({ path: url.pathname, body: req.postDataJSON() });
          if (outcome === 'failed') { status = 503; data = { success: false, verification_sent: false, error: 'Your account is awaiting verification. Please retry.' }; }
          else data = { success: true, verification_sent: outcome === 'accepted' };
        } else if (url.pathname === '/functions/v1/resend-verification-link') {
          posts.push({ path: url.pathname, body: req.postDataJSON() }); data = { success: true, request_received: true };
        } else if (req.method() === 'GET' && url.pathname === '/functions/v1/qg-public-launch-settings') data = { settings: { programme_enabled: false, exit_popup_enabled: false, exit_popup_test_icon_enabled: false } };
        else if (req.method() === 'GET' && url.pathname === '/functions/v1/public-site-media') data = { publications: [] };
        else if (req.method() === 'POST' && url.pathname === '/rest/v1/rpc/get_guard_promotion_summary') data = [];
        else if (url.pathname.endsWith('/wizard_fields')) data = ['email', 'first_name', 'last_name'].map((field_key, i) => ({ id: field_key, field_key, field_label: field_key, field_type: field_key === 'email' ? 'email' : 'text', is_required: true, is_enabled: true, sort_order: i }));
        else if (url.pathname.includes('/functions/') || req.method() !== 'GET') { unexpected.push(req.method() + ' ' + url.pathname); status = 409; data = { error: 'Unexpected provider call' }; }
        return route.fulfill({ status, headers, body: JSON.stringify(data) });
      });
      const page = await context.newPage(); latestPage = page; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/' + role + '/register');
      const essential = page.getByRole('button', { name: 'Essential Only', exact: true }); await essential.click(); await expect(essential).not.toBeVisible();
      await page.locator('input[name="email"]').fill('synthetic@example.invalid');
      await page.locator('input[name="first_name"]').fill('Synthetic'); await page.locator('input[name="last_name"]').fill('Tester');
      const form = page.locator('form'); for (const checkbox of await form.locator('input[type="checkbox"]').all()) await checkbox.check();
      await form.locator('button[type="submit"]').click();
      await expect(page.getByText('Your account is awaiting verification. Please retry.', { exact: true })).toBeVisible();
      await expect(page.locator('input[name="email"]')).toHaveValue('synthetic@example.invalid'); await expect(form.locator('button[type="submit"]')).toBeEnabled();
      assert.equal(new URL(page.url()).pathname, '/' + role + '/register');
      fs.mkdirSync('uat-results/signup-delivery', { recursive: true }); await page.screenshot({ path: `uat-results/signup-delivery/${role}-failure-${width}.png`, fullPage: true });
      outcome = 'unconfirmed'; await form.locator('button[type="submit"]').click(); await expect(page.getByText('We could not confirm a verification email. Please try again.', { exact: true })).toBeVisible(); assert.equal(new URL(page.url()).pathname, '/' + role + '/register');
      outcome = 'accepted'; await form.locator('button[type="submit"]').click(); await page.waitForURL('**/auth/verify-email?**');
      await expect(page.getByText('Check this inbox for your verification link:', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /Resend/i }).click(); await expect(page.getByText(/Verification request received\./)).toBeVisible();
      await expect(page.getByText('Verification email sent successfully!', { exact: true })).toHaveCount(0);
      assert.equal(posts.filter(p => p.path.endsWith('/register-magic-link')).length, 3); assert.equal(posts.filter(p => p.path.endsWith('/resend-verification-link')).length, 1);
      assert.ok(posts.every(p => p.body.role === role)); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      await page.screenshot({ path: `uat-results/signup-delivery/${role}-verify-${width}.png`, fullPage: true });
      console.log(`PASS signup ${role} ${width}px: failed/unconfirmed delivery retains form; explicit acceptance navigates; private resend acknowledgement; no unexpected API or runtime errors; synthetic APIs only`);
      await context.close();
    }
  } catch (error) {
    if (latestPage && !latestPage.isClosed()) { fs.mkdirSync('uat-results/signup-delivery', { recursive: true }); await latestPage.screenshot({ path: 'uat-results/signup-delivery/failure.png', fullPage: true }); console.error('Signup diagnostic', JSON.stringify({ url: latestPage.url(), body: (await latestPage.locator('body').innerText()).slice(-3500) })); }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
