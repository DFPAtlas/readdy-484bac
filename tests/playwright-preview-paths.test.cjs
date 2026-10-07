const test = require('node:test');
const assert = require('node:assert/strict');
const { appUrl, normalizeBaseURL } = require('./e2e/app-url');

test('normalizes the application target as a directory URL', () => {
  assert.equal(
    normalizeBaseURL('https://preview.example.test/view/2232'),
    'https://preview.example.test/view/2232/',
  );
});

test('keeps Readdy preview prefixes for application routes', () => {
  const baseURL = 'https://preview.example.test/view/2232';

  assert.equal(appUrl('/', baseURL), 'https://preview.example.test/view/2232/');
  assert.equal(
    appUrl('/client/login', baseURL),
    'https://preview.example.test/view/2232/client/login',
  );
  assert.equal(
    appUrl('/client/post-job', baseURL),
    'https://preview.example.test/view/2232/client/post-job',
  );
});

test('preserves a preview query token unless the route supplies a query', () => {
  const baseURL = 'https://preview.example.test/view/2232?preview_token=test-token';

  assert.equal(
    appUrl('/guard/login', baseURL),
    'https://preview.example.test/view/2232/guard/login?preview_token=test-token',
  );
  assert.equal(
    appUrl('/client/jobs?tab=open', baseURL),
    'https://preview.example.test/view/2232/client/jobs?tab=open',
  );
});

test('rejects non-rooted application paths', () => {
  assert.throws(() => appUrl('client/login'), /must start with/);
});
