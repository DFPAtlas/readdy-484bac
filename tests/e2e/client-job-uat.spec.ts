import { expect, test } from '@playwright/test';
import { appUrl } from './app-url';
import { login, plusAddress, requireUatEnv, UAT_RUN_ID } from './uat-helpers';

function isoDate(daysFromNow: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

test('@uat free client can post a synthetic door-supervisor job through the UI', async ({ page }) => {
  const env = requireUatEnv();
  test.skip(!env, 'Set QG_UAT_INBOX and QG_UAT_SHARED_PASSWORD');

  const email = plusAddress(env!.inbox, 'client-free');
  const title = `[UAT ${UAT_RUN_ID}] Pub Door Supervisor ${Date.now()}`;
  await login(page, 'client', email, env!.password);
  await page.goto(appUrl('/client/post-job'));

  await page.locator('input[name="jobTitle"]').fill(title);
  await page.locator('select[name="securityType"]').selectOption('security-guard');
  await page.locator('input[name="numberOfGuards"]').fill('1');
  await page.locator('textarea[name="jobDescription"]').fill('Synthetic UAT booking. No real shift or customer.');
  await page.getByRole('button', { name: /next: location/i }).click();

  await page.locator('input[name="venue"]').fill('QuickGuard UAT Venue');
  await page.locator('input[name="addressLine1"]').fill('1 Test Street');
  await page.locator('input[name="city"]').fill('Hoddesdon');
  await page.locator('input[name="postcode"]').fill('EN11 8HD');
  await page.getByRole('button', { name: /next: shift times/i }).click();

  await page.locator('input[name="startDate"]').fill(isoDate(14));
  await page.locator('input[name="endDate"]').fill(isoDate(14));
  await page.locator('input[name="startTime"]').fill('18:00');
  await page.locator('input[name="endTime"]').fill('23:00');
  const numberOfDays = page.locator('select[name="numberOfDays"]');
  if (await numberOfDays.count()) await numberOfDays.selectOption('1');
  await page.getByRole('button', { name: /next: guard requirements/i }).click();

  await page.locator('input[name="siaLicenceRequired"][value="yes"]').check();
  await page.locator('select[name="experienceLevel"]').selectOption('entry');
  await page.locator('input[name="uniformRequired"][value="yes"]').check();
  await page.locator('input[name="drivingRequired"][value="no"]').check();
  await page.getByRole('button', { name: /next: pay & budget/i }).click();

  await page.locator('input[name="hourlyRate"]').fill('15');
  await page.locator('input[name="contactName"]').fill('QuickGuard UAT Client');
  await page.locator('input[name="contactPhone"]').fill('07000000000');
  await page.locator('input[name="contactEmail"]').fill(email);
  await page.getByRole('button', { name: /next: review & post/i }).click();
  await expect(page.locator('body')).toContainText(title);
  await page.getByRole('button', { name: /^post job$/i }).click();
  await expect(page.locator('body')).toContainText(/job posted successfully/i, { timeout: 25_000 });
  await expect(page).toHaveURL(/\/client\/jobs/);
  await expect(page.locator('body')).toContainText(title);
});
