import { test, expect } from '@playwright/test';

test('existing verified QuickGuard guard can apply to latest automated UAT job', async ({ page }) => {
  const email = process.env.QG_UAT_GUARD_EMAIL;
  const password = process.env.QG_UAT_GUARD_PASSWORD;

  test.skip(!email || !password, 'QuickGuard guard UAT credentials are not configured');

  await page.goto('/guard/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).not.toHaveURL(/\/guard\/login(?:\?|$)/, { timeout: 20_000 });

  await page.goto('/guard/jobs', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /find jobs/i })).toBeVisible({ timeout: 20_000 });

  const search = page.locator('input[placeholder*="Search jobs"]');
  await search.fill('QG AUTO UAT');

  const cards = page.locator('div.bg-\[\#111d35\]').filter({ hasText: 'QG AUTO UAT' });
  await expect(cards.first()).toBeVisible({ timeout: 15_000 });

  const card = cards.first();
  const appliedBadge = card.getByText(/^Applied$/i);

  if (await appliedBadge.count()) {
    await expect(appliedBadge).toBeVisible();
    return;
  }

  await card.getByRole('button', { name: /quick apply/i }).click();

  await expect(page.locator('body')).toContainText(/application submitted successfully/i, { timeout: 15_000 });
  await expect(card.getByText(/^Applied$/i)).toBeVisible({ timeout: 15_000 });
});
