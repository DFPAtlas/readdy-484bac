import { expect, Page } from '@playwright/test';
import { appUrl } from './app-url';

export const UAT_RUN_ID = process.env.QG_UAT_RUN_ID || 'launch-2026-11';

export function plusAddress(inbox: string, tag: string) {
  const at = inbox.lastIndexOf('@');
  if (at < 1) throw new Error('QG_UAT_INBOX must be a valid email address');
  return `${inbox.slice(0, at)}+qg-${UAT_RUN_ID}-${tag}${inbox.slice(at)}`.toLowerCase();
}

export function requireUatEnv() {
  const inbox = process.env.QG_UAT_INBOX;
  const password = process.env.QG_UAT_SHARED_PASSWORD;
  if (!inbox || !password) return null;
  return { inbox, password };
}

export async function login(page: Page, role: 'client' | 'guard', email: string, password: string) {
  await page.goto(appUrl(`/${role}/login`), { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(new RegExp(`/${role}/login(?:\\?|$)`), { timeout: 25_000 });
}
