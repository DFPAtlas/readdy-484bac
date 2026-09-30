import { test, expect } from '@playwright/test';

test('job payment function does not write removed transactions.description column', async ({ request }) => {
  const source = await request.get('https://raw.githubusercontent.com/DFPAtlas/readdy-484bac/test/playwright-e2e-foundation/supabase/functions/create-job-payment/index.ts');
  expect(source.ok()).toBeTruthy();
  const body = await source.text();

  expect(body).not.toContain('description: `Payment for job:');
  expect(body).toContain('job_title: jobData.job_title');
  expect(body).toContain("stripe_session_id: session.id");
});
