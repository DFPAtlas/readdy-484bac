// Sandbox only. Real Auth/TOTP with a fresh, run-tagged finance administrator.
// Payment endpoint probes are check_mode or rejected requests without job IDs.
// Authorization-denial probes deliberately omit every job/assignment ID; no
// financial resource is supplied for a charge, refund, payout or funding action.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const statePath = process.env.QG_ADMIN_MFA_STATE, phase = process.argv[2];
assert.ok(['baseline', 'aal1', 'aal2', 'revoked', 'logout'].includes(phase));
if (!statePath || (fs.statSync(statePath).mode & 0o077) !== 0) throw Error('Private QG_ADMIN_MFA_STATE file (0600) required');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
assert.equal(state.project, 'alfwwggavmyerjyqumuo'); assert.match(state.run, /^qg-admin-mfa-[a-f0-9]{16}$/); assert.equal(state.email, state.run + '@example.invalid');
assert.equal(JSON.parse(Buffer.from(state.publicKey.split('.')[1], 'base64url')).role, 'anon');
const save = () => fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
function request(path, body, token) {
  assert.ok(path.startsWith('/auth/v1/') || path === '/functions/v1/admin-test-job-payment');
  const q = value => JSON.stringify(String(value));
  const config = ['silent', 'show-error', 'max-time = 30', `url = ${q('https://alfwwggavmyerjyqumuo.supabase.co' + path)}`, 'request = "POST"', `header = ${q('apikey: ' + state.publicKey)}`, 'header = "Content-Type: application/json"', `data = ${q(JSON.stringify(body))}`, 'write-out = "\\n%{http_code}"'];
  if (token) config.push(`header = ${q('Authorization: Bearer ' + token)}`);
  const raw = execFileSync('curl', ['--config', '-'], { input: config.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); const split = raw.lastIndexOf('\n'); return { status: Number(raw.slice(split + 1)), body: raw.slice(0, split) ? JSON.parse(raw.slice(0, split)) : null };
}
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) { const n = alphabet.indexOf(char); assert.ok(n >= 0); bits += n.toString(2).padStart(5, '0'); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest(); return String((h.readUInt32BE(h[h.length - 1] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
const payment = (token, body = { action: 'check_mode' }) => request('/functions/v1/admin-test-job-payment', body, token);
if (phase === 'baseline') {
  assert.ok(!state.accessToken, 'Fresh baseline required');
  const r = request('/auth/v1/token?grant_type=password', { email: state.email, password: state.password }); assert.equal(r.status, 200); assert.equal(r.body.user.id, state.id); assert.equal(r.body.user.app_metadata.uat_run_id, state.run); state.accessToken = r.body.access_token; save();
  assert.equal(JSON.parse(Buffer.from(state.accessToken.split('.')[1], 'base64url')).aal, 'aal1');
  const mode = payment(state.accessToken); assert.equal(mode.status, 200); assert.equal(mode.body.isTestMode, true); console.log(JSON.stringify({ phase, run: state.run, reproduced: 'Original endpoint accepts finance admin AAL1 for read-only check_mode', mode: mode.body.mode }));
} else if (phase === 'aal1') {
  for (const action of ['check_mode', 'simulate_funded']) { const r = payment(state.accessToken, { action, role: 'super_admin', aal: 'aal2' }); assert.equal(r.status, 403); }
  console.log(JSON.stringify({ phase, passed: true, run: state.run, scope: 'Original AAL1 token and spoofed request MFA are denied before input processing' }));
} else if (phase === 'aal2') {
  if (!state.mfaToken) {
  const enroll = request('/auth/v1/factors', { factor_type: 'totp', friendly_name: state.run, issuer: 'QuickGuard isolated UAT' }, state.accessToken); assert.equal(enroll.status, 200); state.factorId = enroll.body.id; state.totpSecret = enroll.body.totp.secret; save();
  const challenge = request('/auth/v1/factors/' + state.factorId + '/challenge', {}, state.accessToken); assert.equal(challenge.status, 200);
  const verified = request('/auth/v1/factors/' + state.factorId + '/verify', { challenge_id: challenge.body.id, code: totp(state.totpSecret) }, state.accessToken); assert.equal(verified.status, 200); state.mfaToken = verified.body.access_token; save(); assert.equal(JSON.parse(Buffer.from(state.mfaToken.split('.')[1], 'base64url')).aal, 'aal2');
  }
  assert.equal(payment(state.accessToken).status, 403); const mode = payment(state.mfaToken); assert.equal(mode.status, 200); assert.equal(mode.body.isTestMode, true);
  console.log(JSON.stringify({ phase, passed: true, run: state.run, scope: 'Genuine TOTP AAL2 permits finance read-only mode check; old token stays blocked', mode: mode.body.mode }));
} else if (phase === 'revoked') {
  // Authenticate again after fixture membership removal, so denial cannot be
  // attributed merely to a previously logged-out session.
  const login = request('/auth/v1/token?grant_type=password', { email: state.email, password: state.password }); assert.equal(login.status, 200); assert.equal(login.body.user.id, state.id); assert.equal(login.body.user.app_metadata.uat_run_id, state.run); state.accessToken = login.body.access_token; save();
  const challenge = request('/auth/v1/factors/' + state.factorId + '/challenge', {}, state.accessToken); assert.equal(challenge.status, 200);
  const verified = request('/auth/v1/factors/' + state.factorId + '/verify', { challenge_id: challenge.body.id, code: totp(state.totpSecret) }, state.accessToken); assert.equal(verified.status, 200); state.mfaToken = verified.body.access_token; save(); assert.equal(JSON.parse(Buffer.from(state.mfaToken.split('.')[1], 'base64url')).aal, 'aal2');
  const denied = payment(state.mfaToken); assert.equal(denied.status, 403); assert.equal(denied.body.error, 'Active administrator with MFA required');
  console.log(JSON.stringify({ phase, passed: true, run: state.run, scope: 'Removed current membership blocks a fresh genuine AAL2 session' }));
} else {
  assert.equal(request('/auth/v1/logout?scope=global', {}, state.mfaToken || state.accessToken).status, 204); console.log(JSON.stringify({ phase, passed: true, run: state.run }));
}
