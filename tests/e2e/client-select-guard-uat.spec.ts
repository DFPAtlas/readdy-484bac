import { test, expect } from '@playwright/test';

test('client can select the guard who applied to the latest automated UAT job', async ({ page }) => {
  const email = process.env.QG_UAT_CLIENT_EMAIL;
  const password = process.env.QG_UAT_CLIENT_PASSWORD;

  test.skip(!email || !password, 'QuickGuard client UAT credentials are not configured');

  await page.goto('/client/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/client\/login(?:\?|$)/, { timeout: 20_000 });

  await page.goto('/client/jobs', { waitUntil: 'domcontentloaded' });

  const search = page.locator('input').filter({ has: page.locator('[placeholder]') }).first();
  if (await search.count()) {
    const placeholder = await search.getAttribute('placeholder');
    if (placeholder?.toLowerCase().includes('search')) {
      await search.fill('QG AUTO UAT');
    }
  }

  const jobCard = page.locator('div.bg-\[\#111d35\]').filter({ hasText: 'QG AUTO UAT' }).first();
  await expect(jobCard).toBeVisible({ timeout: 20_000 });

  const selectGuards = jobCard.getByRole('button', { name: /select guards/i });
  await expect(selectGuards).toBeVisible({ timeout: 15_000 });
  await selectGuards.click();

  await expect(page).toHaveURL(/\/client\/jobs\/[^/]+\/select-guards/, { timeout: 15_000 });
  await expect(page.locator('body')).toContainText(/applicant|guard/i);

  const applicantCard = page.locator('div.bg-\[\#111d35\]').filter({ has: page.getByRole('button', { name: /^select$/i }) }).first();
  await expect(applicantCard).toBeVisible({ timeout: 15_000 });

  await applicantCard.getByRole('button', { name: /^select$/i }).click();

  const selectedPanel = page.locator('div.bg-\[\#111d35\]').filter({ hasText: 'Selected Guards' });
  await expect(selectedPanel).toContainText(/1\/1|1 selected/i);

  await selectedPanel.getByRole('button', { name: /continue to payment/i }).click();

  await expect(page.getByRole('heading', { name: /confirm guard selection/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /continue to payment/i }).last().click();

  await expect(page.locator('body')).toContainText(/selected.*awaiting payment/i, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/client\/jobs\/[^/]+\/payment/, { timeout: 10_000 });
});
