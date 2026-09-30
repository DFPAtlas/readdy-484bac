import { test, expect } from '@playwright/test';

test('existing QuickGuard client UAT account can reach post job', async ({ page }) => {
  const email = process.env.QG_UAT_CLIENT_EMAIL;
  const password = process.env.QG_UAT_CLIENT_PASSWORD;

  test.skip(!email || !password, 'QuickGuard client UAT credentials are not configured');

  await page.goto('/client/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).not.toHaveURL(/\/client\/login(?:\?|$)/, { timeout: 20_000 });

  await page.goto('/client/post-job', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/client\/post-job/);
  await expect(page.locator('body')).toContainText(/post job|create job|job details/i);
});
