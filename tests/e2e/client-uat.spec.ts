import { test, expect } from '@playwright/test';

function isoDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test('existing QuickGuard client UAT account can post and see a job', async ({ page }) => {
  const email = process.env.QG_UAT_CLIENT_EMAIL;
  const password = process.env.QG_UAT_CLIENT_PASSWORD;

  test.skip(!email || !password, 'QuickGuard client UAT credentials are not configured');

  const jobTitle = `QG AUTO UAT ${Date.now()}`;

  await page.goto('/client/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(email!);
  await page.locator('input[name="password"]').fill(password!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/client\/login(?:\?|$)/, { timeout: 20_000 });

  await page.goto('/client/post-job', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /post a security job/i })).toBeVisible({ timeout: 20_000 });

  await page.locator('input[name="jobTitle"]').fill(jobTitle);
  await page.locator('select[name="securityType"]').selectOption('security-guard');
  await page.locator('input[name="numberOfGuards"]').fill('1');
  await page.locator('textarea[name="jobDescription"]').fill('Automated QuickGuard UAT job. Safe synthetic test data only.');
  await page.getByRole('button', { name: /next: location/i }).click();

  await page.locator('input[name="venue"]').fill('QuickGuard Automated Test Site');
  await page.locator('input[name="addressLine1"]').fill('1 Test Street');
  await page.locator('input[name="city"]').fill('London');
  await page.locator('input[name="postcode"]').fill('SW1A 1AA');
  await page.getByRole('button', { name: /next: shift times/i }).click();

  await page.locator('input[name="startDate"]').fill(isoDate(8));
  await page.locator('input[name="endDate"]').fill(isoDate(8));
  await page.locator('input[name="startTime"]').fill('18:00');
  await page.locator('input[name="endTime"]').fill('23:00');
  await page.locator('select[name="numberOfDays"]').selectOption('1');
  await page.getByRole('button', { name: /next: guard requirements/i }).click();

  await page.locator('input[name="siaLicenceRequired"][value="yes"]').check();
  await page.locator('select[name="experienceLevel"]').selectOption('entry');
  await page.locator('input[name="uniformRequired"][value="no"]').check();
  await page.locator('input[name="drivingRequired"][value="no"]').check();
  await page.getByRole('button', { name: /next: pay & budget/i }).click();

  await page.locator('input[name="hourlyRate"]').fill('15');
  await page.locator('input[name="contactName"]').fill('QuickGuard UAT Client');
  await page.locator('input[name="contactPhone"]').fill('07000000000');
  await page.locator('input[name="contactEmail"]').fill(email!);
  await page.getByRole('button', { name: /next: review & post/i }).click();

  await expect(page.getByRole('heading', { name: /review & post/i })).toBeVisible();
  await expect(page.locator('body')).toContainText(jobTitle);

  await page.getByRole('button', { name: /^post job$/i }).click();
  await expect(page.locator('body')).toContainText(/job posted successfully/i, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/client\/jobs/, { timeout: 10_000 });
  await expect(page.locator('body')).toContainText(jobTitle, { timeout: 15_000 });
});
