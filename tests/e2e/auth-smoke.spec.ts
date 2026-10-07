import { expect, test } from '@playwright/test';
import { appUrl } from './app-url';

for (const accountType of ['client', 'guard'] as const) {
  test(`@smoke ${accountType} login exposes required controls`, async ({ page }) => {
    await page.goto(appUrl(`/${accountType}/login`));
    const form = page.locator(`#${accountType}-login-form`);
    await expect(form).toBeVisible();
    await expect(form.locator('input[name="email"]')).toBeVisible();
    await expect(form.locator('input[name="password"]')).toBeVisible();
    await expect(form.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(page.locator(`a[href$="/${accountType}/register"]`).first()).toBeVisible();
    await expect(page.locator(`a[href$="/${accountType}/forgot-password"]`).first()).toBeVisible();
  });

  test(`@smoke ${accountType} login rejects invalid credentials safely`, async ({ page }) => {
    await page.goto(appUrl(`/${accountType}/login`));
    await page.locator('input[name="email"]').fill(`not-a-user-${Date.now()}@example.invalid`);
    await page.locator('input[name="password"]').fill('WrongPassword!123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(new RegExp(`/${accountType}/login`));
    await expect(page.locator('body')).toContainText(/invalid|incorrect|unable|failed/i);
  });
}
