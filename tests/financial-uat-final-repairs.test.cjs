const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

test('completion review closes immediately after a successful server response', () => {
  const source = fs.readFileSync('app/client/dashboard/CompletionReviewModal.tsx', 'utf8');
  const successBlock = source.slice(source.indexOf('if (!response.ok)'), source.indexOf('} catch'));
  assert.match(successBlock, /onSuccess\(\);\s*onClose\(\);/);
  assert.doesNotMatch(successBlock, /setTimeout/);
});

test('transient Edge Function 404s are retried before recording a notification failure', async () => {
  const source = fs.readFileSync('supabase/functions/_shared/fetchWithTransientRetry.ts', 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', compiled)(mod, mod.exports);

  let calls = 0;
  const response = await mod.exports.fetchWithTransientRetry('https://example.test', {}, {
    delaysMs: [0, 0],
    fetcher: async () => {
      calls += 1;
      return new Response('{}', { status: calls < 3 ? 404 : 200 });
    },
    sleep: async () => {},
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 3);

  for (const path of [
    'supabase/functions/create-job/index.ts',
    'supabase/functions/admin-job-mutate/index.ts',
  ]) {
    const caller = fs.readFileSync(path, 'utf8');
    assert.match(caller, /fetchWithTransientRetry/);
    assert.match(caller, /'apikey': supabaseServiceKey/);
  }
});

test('payout receipts record both provider acceptance and configuration failures', () => {
  const source = fs.readFileSync('supabase/functions/create-guard-payout/index.ts', 'utf8');
  assert.match(source, /payout_receipt_email_accepted/);
  assert.match(source, /payout_receipt_email_failed/);
  assert.match(source, /provider_message_id: providerMessageId/);
  assert.match(source, /RESEND_API_KEY is not configured/);
  assert.match(source, /QuickGuard <payments\.quickguard@digital-footprint\.uk>/);
});
