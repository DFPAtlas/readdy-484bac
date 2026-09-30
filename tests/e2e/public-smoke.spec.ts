import { test, expect } from '@playwright/test';

const publicRoutes = [
  { path: '/', title: /QuickGuard/i },
  { path: '/pricing', title: /Pricing|QuickGuard/i },
  { path: '/client/login', title: /QuickGuard/i },
  { path: '/guard/login', title: /QuickGuard/i },
];

for (const route of publicRoutes) {
  test(`${route.path} loads successfully`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });

    expect(response, `${route.path} should return an HTTP response`).not.toBeNull();
    expect(response!.status(), `${route.path} should not return an error status`).toBeLessThan(400);
    await expect(page).toHaveTitle(route.title);
  });
}

test('homepage exposes client and guard journeys', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toContainText(/QuickGuard/i);
  await expect(page.locator('a[href*="/client/"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/guard/"]').first()).toBeVisible();
});

test('pricing page renders plan content', async ({ page }) => {
  await page.goto('/pricing', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toContainText(/pricing|plan|client|guard/i);
});
