import { expect, test } from '@playwright/test';
import { appUrl } from './app-url';

test('@smoke app URL builder supports root deployments', () => {
  expect(appUrl('/client/login', 'https://quickguard.uk')).toBe('https://quickguard.uk/client/login');
});

test('@smoke app URL builder preserves path-based preview roots', () => {
  expect(appUrl('/client/login', 'https://readdy.ai/preview/project/version')).toBe(
    'https://readdy.ai/preview/project/version/client/login',
  );
  expect(appUrl('/', 'https://readdy.ai/preview/project/version')).toBe(
    'https://readdy.ai/preview/project/version/',
  );
});
