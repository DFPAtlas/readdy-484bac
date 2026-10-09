const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const payout = fs.readFileSync('supabase/functions/create-guard-payout/index.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261009143011_refresh_receipt_email_branding.sql', 'utf8');

test('guard and client receipts use the QuickGuard navy and teal brand', () => {
  for (const source of [payout, migration]) {
    assert.match(source, /#0B1933/i);
    assert.match(source, /#14B8A6/i);
    assert.match(source, /c10b9a7b-68d7-4ace-860f-4fe6cdb37c9d\.png/);
    assert.match(source, /The UK(?:&rsquo;|’)s security staffing marketplace/);
    assert.match(source, /Operated by/);
    assert.match(source, /digital-footprint\.uk/);
  }
});

test('receipt markup stays compatible with major email clients', () => {
  for (const source of [payout, migration]) {
    assert.match(source, /role="presentation"/);
    assert.match(source, /max-width:600px/);
    assert.doesNotMatch(source, /display:flex|display:grid|linear-gradient/i);
  }
  assert.match(payout, /text: receiptText/);
  assert.match(payout, /function buildPayoutReceiptText/);
});

test('guard receipt escapes database and Stripe values before placing them in HTML', () => {
  assert.match(payout, /function escapeReceiptHtml/);
  assert.match(payout, /const guardName = escapeReceiptHtml\(params\.guardName\)/);
  assert.match(payout, /const jobTitle = escapeReceiptHtml\(params\.jobTitle\)/);
  assert.match(payout, /const transferId = escapeReceiptHtml\(params\.transferId\)/);
});

test('client receipt migration refuses to overwrite an unexpected template', () => {
  assert.match(migration, /template_slug = 'payment_receipt'/);
  assert.match(migration, /md5\(body_html\) = '6f01c71767e1db5f2696031debc052df'/);
  assert.match(migration, /changed <> 1/);
});

test('committed receipt previews contain resolved sample data', () => {
  for (const path of [
    'docs/email-preview/payment_receipt.html',
    'docs/email-preview/payout_receipt.html',
  ]) {
    const preview = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(preview, /\$\{/);
    assert.doesNotMatch(preview, /{{[^}]+}}/);
  }
});
