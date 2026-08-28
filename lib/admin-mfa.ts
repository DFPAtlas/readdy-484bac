import { supabase } from './supabase';

export type MfaRoute = 'authorized' | 'mfa' | 'setup' | 'deny';

export async function resolveAdminMfaRoute(): Promise<MfaRoute> {
  try {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return 'deny';

    const current = aal?.currentLevel;
    const next = aal?.nextLevel;

    if (current === 'aal2' && next === 'aal2') return 'authorized';
    if (current === 'aal1' && next === 'aal2') return 'mfa';
    if (current === 'aal1' && next === 'aal1') return 'setup';
    return 'deny';
  } catch {
    return 'deny';
  }
}

export function mapMfaErrorMessage(message?: string): string {
  const msg = (message || '').toLowerCase();
  if (msg.includes('expired')) {
    return 'This verification code has expired. Please try again.';
  }
  if (msg.includes('challenge')) {
    return 'Verification challenge is no longer valid. Please try again.';
  }
  if (msg.includes('factor') || msg.includes('not found')) {
    return 'Multi-factor authentication factor not found. Please sign in again.';
  }
  if (msg.includes('invalid') || msg.includes('incorrect')) {
    return 'That code is incorrect. Please check your authenticator app and try again.';
  }
  return message || 'Verification failed. Please try again.';
}