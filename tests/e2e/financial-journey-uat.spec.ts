import { createClient } from '@supabase/supabase-js';
import { expect, Page, test } from '@playwright/test';
import { appUrl } from './app-url';
import { login, plusAddress, requireUatEnv, UAT_RUN_ID } from './uat-helpers';

test.describe.configure({ retries: 0 });

async function dismissCookieConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: /essential only/i });
  try {
    await essentialOnly.waitFor({ state: 'visible', timeout: 3_000 });
    await essentialOnly.click();
  } catch {
    // Consent was already recorded for this synthetic browser context.
  }
}

test('@uat synthetic client-to-guard booking completes a Stripe test payment', async ({ browser }) => {
  const env = requireUatEnv();
  test.skip(!env, 'Set QG_UAT_INBOX and QG_UAT_SHARED_PASSWORD');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL is required').toBeTruthy();
  expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required').toBeTruthy();

  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'app' },
  });
  const clientEmail = plusAddress(env!.inbox, 'client-free');
  const guardEmail = plusAddress(env!.inbox, 'guard-door');

  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id')
    .eq('email', clientEmail)
    .maybeSingle();
  expect(clientError, clientError?.message).toBeNull();
  expect(client?.id, 'Seeded UAT client was not found').toBeTruthy();

  const { data: jobs, error: jobsError } = await admin
    .from('jobs')
    .select('id, job_title, status, payment_status, created_at')
    .eq('client_id', client!.id)
    .like('job_title', `[UAT ${UAT_RUN_ID}]%`)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1);
  expect(jobsError, jobsError?.message).toBeNull();
  expect(jobs?.length, 'The job-post UAT must create an open synthetic job first').toBe(1);
  const job = jobs![0];

  const guardContext = await browser.newContext();
  const guardPage = await guardContext.newPage();
  await login(guardPage, 'guard', guardEmail, env!.password);
  await guardPage.goto(appUrl(`/guard/jobs/detail?id=${encodeURIComponent(job.id)}`));
  await dismissCookieConsent(guardPage);
  const applyNow = guardPage.getByRole('button', { name: /apply now/i }).filter({ visible: true }).first();
  await expect(applyNow).toBeVisible();
  await applyNow.click();
  await guardPage.getByPlaceholder(/tell the client why/i).fill('Synthetic launch-gate application. No real shift or customer.');
  await guardPage.getByRole('button', { name: /submit application/i }).click();
  await expect(guardPage.locator('body')).toContainText(/application submitted/i);

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await login(clientPage, 'client', clientEmail, env!.password);
  await clientPage.goto(appUrl(`/client/jobs/applicants?id=${encodeURIComponent(job.id)}`));
  await dismissCookieConsent(clientPage);
  await expect(clientPage.getByText('UAT Door Supervisor', { exact: true }).first()).toBeVisible();
  const applicantCard = clientPage
    .locator('div.rounded-xl.border-2')
    .filter({ hasText: 'UAT Door Supervisor' })
    .first();
  await applicantCard.getByRole('button', { name: /select/i }).click();
  await clientPage.getByRole('button', { name: /continue to payment/i }).first().click();
  await expect(clientPage.getByRole('heading', { name: /confirm guard selection/i })).toBeVisible();
  await clientPage.getByRole('button', { name: /continue to payment/i }).last().click();
  await clientPage.waitForURL(/\/client\/jobs\/payment\?id=/, { timeout: 30_000 });

  await clientPage
    .locator('label')
    .filter({ hasText: 'I confirm I am responsible for my own tax' })
    .getByRole('checkbox')
    .check();
  await clientPage
    .locator('label')
    .filter({ hasText: 'I authorise payment to confirm this booking' })
    .getByRole('checkbox')
    .check();
  const payButton = clientPage.getByRole('button', { name: /pay & confirm booking/i });
  await expect(payButton).toBeEnabled();
  await payButton.click();
  await clientPage.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 });
  expect(clientPage.url(), 'Refusing to use anything except a Stripe test Checkout session').toContain('cs_test_');

  const checkoutEmail = clientPage.getByLabel(/email/i);
  if (await checkoutEmail.count() && await checkoutEmail.isVisible()) {
    await checkoutEmail.fill(clientEmail);
  }
  await clientPage.getByLabel(/card number/i).fill('4242424242424242');
  await clientPage.getByLabel(/expiration|expiry/i).fill('1230');
  await clientPage.getByLabel(/cvc|security code/i).fill('123');
  const cardholder = clientPage.getByLabel(/cardholder name|name on card/i);
  if (await cardholder.count() && await cardholder.isVisible()) {
    await cardholder.fill('QuickGuard UAT Client');
  }
  const postalCode = clientPage.getByLabel(/postal code|postcode|zip/i);
  if (await postalCode.count() && await postalCode.isVisible()) {
    await postalCode.fill('EN11 8HD');
  }
  await clientPage.getByRole('button', { name: /pay/i }).click();
  await clientPage.waitForURL(/quickguard\.uk\/client\/payment\/success/, { timeout: 60_000 });
  await expect(clientPage.locator('body')).toContainText(/payment successful|booking confirmed|payment received/i, {
    timeout: 90_000,
  });

  await expect.poll(async () => {
    const { data } = await admin
      .from('transactions')
      .select('status, stripe_session_id, stripe_payment_intent')
      .eq('job_id', job.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.status;
  }, { timeout: 90_000 }).toMatch(/completed|succeeded/);

  const { data: fundedJob, error: fundedJobError } = await admin
    .from('jobs')
    .select('status, payment_status, stripe_session_id, stripe_payment_intent_id')
    .eq('id', job.id)
    .single();
  expect(fundedJobError, fundedJobError?.message).toBeNull();
  expect(fundedJob?.status).toMatch(/confirmed|funded|awaiting_client_confirmation/);
  expect(fundedJob?.payment_status).toMatch(/funded|completed|succeeded/);
  expect(fundedJob?.stripe_session_id).toContain('cs_test_');
  expect(fundedJob?.stripe_payment_intent_id).toBeTruthy();

  await guardContext.close();
  await clientContext.close();
});
