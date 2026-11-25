// Native Auth/API acceptance only, hard-locked to the isolated sandbox.
// Fixtures must be newly created, tagged in protected Auth app_metadata, and
// removed by the operator afterwards. Never use retained closed fixtures.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const statePath = process.env.QG_NATIVE_UAT_STATE;
if (!statePath) throw Error('QG_NATIVE_UAT_STATE private fixture file is required');
if ((fs.statSync(statePath).mode & 0o077) !== 0) throw Error('Fixture file must be private (0600)');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
assert.equal(state.project, 'alfwwggavmyerjyqumuo');
assert.match(state.run, /^qg-native-[a-f0-9]{16}$/);
assert.equal(JSON.parse(Buffer.from(state.publicKey.split('.')[1], 'base64url')).role, 'anon');
const base = 'https://alfwwggavmyerjyqumuo.supabase.co';
const save = () => fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
function request(path, { method = 'POST', token, body, schema } = {}) {
  assert.ok(path.startsWith('/auth/v1/') || path.startsWith('/rest/v1/') || path.startsWith('/functions/v1/'));
  const q = value => '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
  const config = ['silent', 'show-error', 'max-time = 30', `url = ${q(base + path)}`, `request = ${q(method)}`, `header = ${q('apikey: ' + state.publicKey)}`, 'header = "Content-Type: application/json"', 'header = "Origin: https://quickguard.uk"', 'write-out = "\\n%{http_code}"'];
  if (token) config.push(`header = ${q('Authorization: Bearer ' + token)}`);
  if (schema) config.push(`header = ${q('Accept-Profile: ' + schema)}`, `header = ${q('Content-Profile: ' + schema)}`, 'header = "Prefer: return=representation"');
  if (body !== undefined) config.push(`data = ${q(JSON.stringify(body))}`);
  // Credentials, JWTs and contact payloads are passed over stdin, never argv.
  let output;
  try { output = execFileSync('curl', ['--config', '-'], { input: config.join('\n') + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch { throw Error('Sandbox HTTP transport failed'); }
  const split = output.lastIndexOf('\n');
  return { status: Number(output.slice(split + 1)), body: output.slice(0, split) ? JSON.parse(output.slice(0, split)) : null };
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) { const n = alphabet.indexOf(char); assert.ok(n >= 0); bits += n.toString(2).padStart(5, '0'); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest(); const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
const guest = (body, token) => request('/functions/v1/guest-booking', { body, token });
const checks = [];
try {
  for (const [role, account] of Object.entries(state.accounts)) {
    assert.equal(account.email, `${state.run}-${role}@example.invalid`);
    const r = request('/auth/v1/token?grant_type=password', { body: { email: account.email, password: account.password } });
    assert.equal(r.status, 200, `Native ${role} sign-in failed`); assert.equal(r.body.user.id, account.id);
    assert.equal(r.body.user.app_metadata.uat_run_id, state.run); assert.equal(r.body.user.app_metadata.uat_persona, role);
    account.accessToken = r.body.access_token; save();
  }
  checks.push('three real password sign-ins with protected fixture provenance');
  const owner = state.accounts.owner, other = state.accounts.other, admin = state.accounts.admin;
  for (const account of [owner, other]) {
    const r = request('/rest/v1/clients?select=id&user_id=eq.' + account.id, { method: 'GET', token: account.accessToken, schema: 'app' });
    assert.equal(r.status, 200); assert.equal(r.body.length, 1); account.clientId = r.body[0].id; save();
  }
  const hiddenMode = request('/rest/v1/settings?select=value&key=eq.job_posted_email_delivery_mode', { method: 'GET', token: owner.accessToken, schema: 'app' });
  assert.equal(hiddenMode.status, 200); assert.deepEqual(hiddenMode.body, []);
  const blockedModeWrite = request('/rest/v1/settings?key=eq.job_posted_email_delivery_mode', { method: 'PATCH', token: owner.accessToken, schema: 'app', body: { value: 'dry_run' } });
  assert.ok(blockedModeWrite.status === 403 || (blockedModeWrite.status === 200 && blockedModeWrite.body.length === 0));
  checks.push('ordinary client cannot read or change private delivery control');
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  state.receipts = [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')];
  state.submissions = state.receipts.map(() => 'qgb_' + crypto.randomBytes(16).toString('hex')); save();
  const contact = index => ({ action: 'save_enquiry', receipt: state.receipts[index], submissionId: state.submissions[index], email: owner.email, contactName: 'Synthetic native enquiry', postcodeArea: 'SW1A', startDate: date, followupConsent: true, consentVersion: 'booking-followup-2026-11-25' });
  for (const index of [0, 1]) assert.equal(guest(contact(index)).status, 200);
  const listPath = '/rest/v1/guest_booking_enquiries?select=id,email,contact_name&email=eq.' + encodeURIComponent(owner.email);
  for (const account of [owner, admin]) {
    const r = request(listPath, { method: 'GET', token: account.accessToken, schema: 'app' }); assert.equal(r.status, 200); assert.deepEqual(r.body, []);
  }
  assert.equal(guest({ action: 'admin_remove_enquiry', id: crypto.randomUUID(), role: 'super_admin', aal: 'aal2' }, owner.accessToken).status, 403);
  checks.push('native client/admin AAL1 cannot read guest contacts or spoof removal');
  const postBody = { clientId: owner.clientId, submissionId: state.submissions[0], formData: { jobTitle: 'Synthetic native acceptance', jobDescription: 'Temporary isolated sandbox acceptance fixture only.', securityType: 'security-guard', venue: 'Synthetic venue', addressLine1: '1 Test Road', city: 'London', postcode: 'SW1A 1AA', startDate: date, endDate: date, startTime: '09:00', endTime: '17:00', numberOfDays: '1', numberOfGuards: '1', hourlyRate: '15', siaLicenceRequired: 'yes', specificLicences: ['Security Guard'], contactName: 'Synthetic client', contactEmail: owner.email } };
  assert.equal(request('/functions/v1/create-job', { token: other.accessToken, body: postBody }).status, 403);
  const post = request('/functions/v1/create-job', { token: owner.accessToken, body: postBody });
  assert.equal(post.status, 200, 'Native posting failed'); assert.equal(post.body.success, true); assert.ok(post.body.warnings.includes('email_failed'), 'Sandbox preview must not claim delivery');
  assert.match(post.body.jobId, /^[a-f0-9-]{36}$/); state.jobId = post.body.jobId; save();
  const replay = request('/functions/v1/create-job', { token: owner.accessToken, body: postBody }); assert.equal(replay.status, 200); assert.equal(replay.body.idempotent, true); assert.equal(replay.body.jobId, state.jobId);
  checks.push('owned job posted with string rate; foreign posting blocked; replay returns same job');
  assert.equal(guest({ action: 'complete_enquiry', receipt: state.receipts[0], jobId: state.jobId }, other.accessToken).status, 404);
  assert.equal(guest({ action: 'complete_enquiry', receipt: state.receipts[1], jobId: state.jobId }, owner.accessToken).status, 409);
  const completed = guest({ action: 'complete_enquiry', receipt: state.receipts[0], jobId: state.jobId }, owner.accessToken); assert.equal(completed.status, 200); assert.equal(completed.body.removed, true);
  assert.equal(guest(contact(0)).status, 410);
  checks.push('native conversion binds client and submission; removed enquiry cannot return');
  const enroll = request('/auth/v1/factors', { token: admin.accessToken, body: { factor_type: 'totp', friendly_name: state.run, issuer: 'QuickGuard isolated UAT' } });
  assert.equal(enroll.status, 200, 'Native TOTP enrollment failed'); admin.factorId = enroll.body.id; admin.totpSecret = enroll.body.totp.secret; save();
  const challenge = request('/auth/v1/factors/' + admin.factorId + '/challenge', { token: admin.accessToken, body: {} }); assert.equal(challenge.status, 200);
  const verified = request('/auth/v1/factors/' + admin.factorId + '/verify', { token: admin.accessToken, body: { challenge_id: challenge.body.id, code: totp(admin.totpSecret) } });
  assert.equal(verified.status, 200, 'Native TOTP challenge failed'); admin.mfaToken = verified.body.access_token; save();
  assert.equal(JSON.parse(Buffer.from(admin.mfaToken.split('.')[1], 'base64url')).aal, 'aal2');
  const visible = request(listPath, { method: 'GET', token: admin.mfaToken, schema: 'app' }); assert.equal(visible.status, 200); assert.equal(visible.body.length, 1);
  const protectedHash = request('/rest/v1/guest_booking_enquiries?select=receipt_hash', { method: 'GET', token: admin.mfaToken, schema: 'app' }); assert.equal(protectedHash.status, 403);
  assert.equal(guest({ action: 'admin_remove_enquiry', id: visible.body[0].id }, admin.accessToken).status, 403);
  const removed = guest({ action: 'admin_remove_enquiry', id: visible.body[0].id }, admin.mfaToken); assert.equal(removed.status, 200); assert.equal(removed.body.removed, true);
  assert.equal(guest(contact(1)).status, 410);
  checks.push('real TOTP AAL2 grants scoped admin read/removal; receipt hashes remain private');
  console.log(JSON.stringify({ passed: true, run: state.run, checks, scope: 'Native Auth, real TOTP MFA, API posting/idempotency, consent conversion and admin access. No browser, signup email, actual email delivery or payments.' }, null, 2));
} finally {
  for (const receipt of state.receipts || []) { try { assert.equal(guest({ action: 'withdraw_enquiry', receipt }).status, 200); } catch { console.error('Synthetic enquiry cleanup needs operator verification'); process.exitCode = 1; } }
  for (const account of Object.values(state.accounts)) {
    const token = account.mfaToken || account.accessToken;
    if (token) { try { const r = request('/auth/v1/logout?scope=global', { token }); assert.equal(r.status, 204); } catch { console.error('Fixture session logout needs operator verification'); process.exitCode = 1; } }
  }
}
