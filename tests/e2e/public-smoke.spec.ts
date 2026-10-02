import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/',
  '/pricing',
  '/how-it-works',
  '/client/login',
  '/guard/login',
  '/privacy',
  '/terms',
  '/cookie-policy',
];

for (const path of publicRoutes) {
  test(`@smoke ${path} returns a usable page`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response, `${path} should return an HTTP response`).not.toBeNull();
    expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(400);
    await expect(page.locator('body')).not.toContainText(/application error|internal server error/i);
  });
}

test('@smoke homepage exposes client and guard journeys', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href*="/client/"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/guard/"]').first()).toBeVisible();
});

test('@mobile homepage has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBeFalsy();
});

