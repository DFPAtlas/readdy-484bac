import { test, expect } from '@playwright/test';

for (const accountType of ['client', 'guard'] as const) {
  test(`${accountType} login form has the required controls`, async ({ page }) => {
    await page.goto(`/${accountType}/login`, { waitUntil: 'domcontentloaded' });

    const form = page.locator(`#${accountType}-login-form`);
    await expect(form).toBeVisible();

    await expect(form.locator('input[name="email"]')).toBeVisible();
    await expect(form.locator('input[name="password"]')).toBeVisible();
    await expect(form.getByRole('button', { name: /sign in/i })).toBeVisible();

    const switchAccountHref = accountType === 'client' ? '/guard/login' : '/client/login';
    await expect(page.locator(`a[href="${switchAccountHref}"]`).first()).toBeVisible();
  });

  test(`${accountType} login links to registration and password recovery`, async ({ page }) => {
    await page.goto(`/${accountType}/login`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator(`a[href="/${accountType}/register"]`).first()).toBeVisible();
    await expect(page.locator(`a[href="/${accountType}/forgot-password"]`).first()).toBeVisible();
  });
}
