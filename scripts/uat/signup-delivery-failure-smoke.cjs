// Real API failure/retry acceptance in the isolated sandbox with no mail key.
// Never substitute a deliverable address: this checks failure, not delivery.
// Inspect/clean up the exact newly created Auth rows and related app data after
// running; the private state file records the generated run and addresses.
const fs = require('node:fs'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const statePath = process.env.QG_SIGNUP_UAT_STATE;
if (!statePath || (fs.statSync(statePath).mode & 0o077) !== 0) throw Error('Private QG_SIGNUP_UAT_STATE fixture file (0600) required');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
assert.equal(state.project, 'alfwwggavmyerjyqumuo');
assert.equal(JSON.parse(Buffer.from(state.publicKey.split('.')[1], 'base64url')).role, 'anon');
if (state.run || state.emails) throw Error('Use a fresh state file for each run');
state.run = 'qg-signup-' + crypto.randomBytes(8).toString('hex');
state.startedAt = new Date().toISOString();
state.emails = Object.fromEntries(['client', 'guard'].map(role => [role, `${state.run}-${role}@example.invalid`]));
fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
function request(slug, body) {
  const q = value => JSON.stringify(String(value));
  const config = ['silent', 'show-error', 'max-time = 30', `url = ${q('https://alfwwggavmyerjyqumuo.supabase.co/functions/v1/' + slug)}`, 'request = "POST"', `header = ${q('Authorization: Bearer ' + state.publicKey)}`, 'header = "Content-Type: application/json"', 'header = "Origin: https://quickguard.uk"', `data = ${q(JSON.stringify(body))}`, 'write-out = "\\n%{http_code}"'];
  const raw = execFileSync('curl', ['--config', '-'], { input: config.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const split = raw.lastIndexOf('\n'); return { status: Number(raw.slice(split + 1)), body: JSON.parse(raw.slice(0, split)) };
}
const config = request('render-email-template', { template_slug: 'signup_verification', to: 'synthetic@example.invalid', dry_run: true });
assert.equal(config.status, 500, 'This probe requires the isolated email-unconfigured sandbox');
assert.equal(config.body.error, 'Email service is not configured');
const results = [];
for (const [role, email] of Object.entries(state.emails)) {
  assert.ok(email.endsWith('@example.invalid'));
  const body = { email, role, first_name: 'Synthetic', last_name: 'Signup', wizard_data: {}, tax_disclaimer_accepted: false };
  for (const attempt of ['new', 'retry']) {
    const r = request('register-magic-link', body); assert.equal(r.status, 503, `${role} ${attempt} must not claim email acceptance`); assert.equal(r.body.success, false); assert.equal(r.body.verification_sent, false); assert.equal(r.body.code, 'verification_delivery_failed'); results.push(`${role} ${attempt}: honest delivery failure`);
  }
}
for (const email of [state.emails.client, state.run + '-unknown@example.invalid']) {
  const r = request('resend-verification-link', { email, role: 'client' }); assert.equal(r.status, 200); assert.deepEqual(r.body, { success: true, request_received: true });
}
console.log(JSON.stringify({ passed: true, run: state.run, results, resendPrivacy: 'Known and unknown accounts have identical request acknowledgements', scope: 'Native failed-delivery/retry only. Operator must verify unconfirmed identities, no sessions, one identity per email and remove exact run fixtures.' }, null, 2));
