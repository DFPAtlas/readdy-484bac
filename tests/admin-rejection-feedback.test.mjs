import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('app/admin/guard-verifications/GuardVerificationsClient.tsx', 'utf8');
const handler = source.slice(source.indexOf('  const handleReject ='), source.indexOf('  const handleRetrySiaCheck ='));
const compiled = ts.transpileModule(handler + '\nreturn handleReject;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

test('rejection feedback distinguishes provider acceptance, deduplication and missing email evidence', async () => {
  for (const notification_status of ['accepted', 'already_sent', 'failed', undefined, 'unknown']) {
    const toasts = [], closed = [], refreshed = [];
    const dependencies = {
      selectedGuard: { id: 'synthetic-guard' }, rejectionReason: 'Synthetic reason',
      verificationChecks: { documents: false }, admin: { name: 'Test admin' }, activeTab: 'pending',
      supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } },
      process: { env: {} },
      fetch: async () => ({ ok: true, json: async () => ({ success: true, notification_status }) }),
      showToast: (message, type) => toasts.push({ message, type }), setProcessing() {},
      setShowRejectModal() {}, setRejectionReason() {}, closeGuardDetails: () => closed.push(true),
      fetchGuards: tab => refreshed.push(tab), fetchAllCounts() {},
    };
    await new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies))();
    assert.equal(closed.length, 1);
    assert.deepEqual(refreshed, ['pending']);
    assert.equal(toasts.length, 1);
    if (notification_status === 'accepted') {
      assert.match(toasts[0].message, /accepted for sending/);
      assert.equal(toasts[0].type, 'success');
    } else if (notification_status === 'already_sent') {
      assert.match(toasts[0].message, /already sent within the last 24 hours/);
    } else {
      assert.match(toasts[0].message, /Guard rejected, but.*could not be confirmed/);
      assert.equal(toasts[0].type, 'error');
      assert.doesNotMatch(toasts[0].message, /email sent|Failed to reject/);
    }
  }
});
