export interface GuardVerification {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  sia_licence_number: string;
  license_cardholder_name: string | null;
  sia_expiry_date: string | null | undefined;
  sia_licence_front_url: string | null;
  sia_licence_back_url: string | null;
  sia_licence_uploaded_at: string | null;
  driving_licence_front_url: string | null;
  driving_licence_back_url: string | null;
  driving_licence_uploaded_at: string | null;
  proof_of_address_url: string | null;
  proof_of_address_uploaded_at: string | null;
  years_experience: number;
  hourly_rate: number;
  certifications: string[];
  available_days: string[];
  available_hours_from: string;
  available_hours_to: string;
  bio: string | null;
  profile_image_url: string | null;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
  rejection_reason: string | null;
  rejected_at: string | null;
  verified_at: string | null;
  verification_status: string;
  sia_check_status: string | null;
  sia_checked_at: string | null;
  sia_scraped_name: string | null;
  sia_scraped_status: string | null;
  sia_confidence_score: number | null;
  sia_mismatch_reason: string | null;
  sia_raw_result_json: any;
  user_id: string;
  verification_checks: {
    personal_info: boolean;
    sia_license: boolean;
    professional_details: boolean;
    availability: boolean;
    subscription: boolean;
  };
  // Address & location
  location?: string | null;
  postcode?: string | null;
  city?: string | null;
  // Transport
  willing_to_travel?: boolean | null;
  has_transport?: boolean | null;
  max_distance_miles?: number | null;
  // SIA additional
  licence_types?: string[] | null;
  sia_licence_type?: string | null;
  sia_scraped_licence_type?: string | null;
  sia_scraped_expiry_date?: string | null;
  sia_verified?: boolean | null;
  sia_verified_at?: string | null;
  // Stripe / Connect
  stripe_account_id?: string | null;
  stripe_connect_status?: string | null;
  stripe_connect_restricted_reason?: string | null;
  stripe_connect_onboarded_at?: string | null;
  stripe_connect_verified_at?: string | null;
  // Subscription
  subscription_plan?: string | null;
  subscription_status?: string | null;
  plan_name?: string | null;
  plan_slug?: string | null;
  // Stats
  total_jobs_completed?: number | null;
  total_earnings?: number | null;
  rating?: number | null;
  total_reviews?: number | null;
  // Activity
  is_active?: boolean | null;
  is_test_account?: boolean | null;
  dashboard_access?: boolean | null;
  verified_by?: string | null;
  // Promo / Other
  founding_badge?: boolean | null;
  promo_tier?: string | null;
  signup_number?: number | null;
  nudge_sent_at?: string | null;
  onboarding_status?: string | null;
  sia_verification_details?: any;
}

export type GuardStatus = 'pending' | 'approved' | 'rejected' | 'incomplete' | 'suspended' | 'all';

export function getGuardName(guard: GuardVerification): string {
  return guard.full_name || 'Unknown Guard';
}

export function getMissingProfileItems(guard: GuardVerification): string[] {
  const missing: string[] = [];
  if (!guard.full_name?.trim()) missing.push('Full name');
  if (!guard.phone?.trim()) missing.push('Phone number');
  if (!guard.date_of_birth) missing.push('Date of birth');
  if (!guard.sia_licence_number?.trim()) missing.push('SIA licence number');
  if (!guard.license_cardholder_name?.trim()) missing.push('Licence cardholder name');
  if (!guard.sia_expiry_date) missing.push('SIA expiry date');
  if (guard.years_experience == null || guard.years_experience === 0) missing.push('Years of experience');
  if (!guard.hourly_rate) missing.push('Hourly rate');
  if (!guard.certifications || guard.certifications.length === 0) missing.push('Certifications');
  if (!guard.available_days || guard.available_days.length === 0) missing.push('Available days');
  if (!guard.available_hours_from || !guard.available_hours_to) missing.push('Working hours');
  if (!guard.bio?.trim()) missing.push('Bio / About');
  if (!guard.profile_image_url?.trim()) missing.push('Profile photo');
  if (!guard.driving_licence_front_url?.trim()) missing.push('Driving licence front');
  if (!guard.driving_licence_back_url?.trim()) missing.push('Driving licence back');
  if (!guard.proof_of_address_url?.trim()) missing.push('Proof of address');
  return missing;
}

export function hasMissingDocuments(guard: GuardVerification): boolean {
  return !guard.driving_licence_front_url || !guard.driving_licence_back_url || !guard.proof_of_address_url;
}

export function getApprovalBlockers(guard: GuardVerification): string[] {
  const blockers: string[] = [];
  if (!guard.full_name?.trim()) blockers.push('Full name');
  if (!guard.phone?.trim()) blockers.push('Phone number');
  if (!guard.sia_licence_number?.trim()) blockers.push('SIA licence number');
  if (!guard.sia_expiry_date) blockers.push('SIA expiry date');
  if (!guard.sia_licence_front_url?.trim()) blockers.push('SIA licence front image');
  if (!guard.sia_licence_back_url?.trim()) blockers.push('SIA licence back image');
  if (!guard.driving_licence_front_url?.trim()) blockers.push('Driving licence front');
  if (!guard.driving_licence_back_url?.trim()) blockers.push('Driving licence back');
  if (!guard.proof_of_address_url?.trim()) blockers.push('Proof of address');
  return blockers;
}

export function hasExpiredLicence(guard: GuardVerification): boolean {
  if (!guard.sia_expiry_date) return false;
  return new Date(guard.sia_expiry_date) < new Date();
}

export function isExpiringSoon(guard: GuardVerification, days = 30): boolean {
  if (!guard.sia_expiry_date) return false;
  const expiry = new Date(guard.sia_expiry_date);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= days;
}

export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getWarningBadges(guard: GuardVerification): { label: string; color: string }[] {
  const badges: { label: string; color: string }[] = [];
  if (hasExpiredLicence(guard)) {
    badges.push({ label: 'Expired Licence', color: 'bg-red-500/10 text-red-400 ring-red-500/30' });
  } else if (isExpiringSoon(guard)) {
    badges.push({ label: 'Expiring Soon', color: 'bg-amber-500/10 text-amber-400 ring-amber-500/30' });
  }
  if (hasMissingDocuments(guard)) {
    badges.push({ label: 'Missing Documents', color: 'bg-orange-500/10 text-orange-400 ring-orange-500/30' });
  }
  if (!guard.profile_completed) {
    badges.push({ label: 'Incomplete Profile', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/30' });
  }
  return badges;
}

export function getStatusBadge(verification_status: string): { label: string; color: string } {
  switch (verification_status) {
    case 'verified':
      return { label: 'Verified', color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' };
    case 'approved':
      return { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' };
    case 'rejected':
      return { label: 'Rejected', color: 'bg-red-500/10 text-red-400 ring-red-500/30' };
    case 'suspended':
      return { label: 'Suspended', color: 'bg-orange-500/10 text-orange-400 ring-orange-500/30' };
    case 'pending_sia_check':
      return { label: 'SIA Check', color: 'bg-blue-500/10 text-blue-400 ring-blue-500/30' };
    case 'manual_review':
      return { label: 'Manual Review', color: 'bg-purple-500/10 text-purple-400 ring-purple-500/30' };
    case 'pending':
      return { label: 'Pending', color: 'bg-amber-500/10 text-amber-400 ring-amber-500/30' };
    case 'expired':
      return { label: 'Expired', color: 'bg-red-500/10 text-red-400 ring-red-500/30' };
    case 'incomplete':
      return { label: 'Incomplete', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/30' };
    default:
      return { label: verification_status?.replace(/_/g, ' ') || 'Unknown', color: 'bg-slate-500/10 text-slate-400 ring-slate-500/30' };
  }
}

interface SiaStatusContext {
  is_test_account?: boolean | null;
  sia_mismatch_reason?: string | null;
}

function getSiaCheckDisplay(rawStatus: string | null, verificationStatus: string, context: SiaStatusContext) {
  const status = (rawStatus || '').trim().toLowerCase();
  let label = 'Unknown status';
  let color = 'bg-slate-500/10 text-slate-400 ring-slate-500/30';
  let icon = 'ri-question-line';
  let text = `Unrecognised stored SIA status: ${status || 'not recorded'}. Review the register evidence.`;
  const positive = ['passed', 'verified', 'valid'].includes(status);
  if (!status) {
    label = 'Not recorded';
    text = 'No SIA check status is recorded on this profile.';
    if (verificationStatus === 'manual_review') text += ' The profile awaits manual admin review.';
  } else if (positive) {
    label = status.charAt(0).toUpperCase() + status.slice(1);
    color = 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30';
    icon = 'ri-check-double-line';
    text = `A completed SIA result is recorded as ${status}. Review its date and matching licence evidence before approval.`;
  } else if (['pending', 'queued', 'processing', 'claimed'].includes(status)) {
    label = status === 'pending' || status === 'queued' ? 'Pending' : 'In progress';
    color = 'bg-blue-500/10 text-blue-400 ring-blue-500/30';
    icon = 'ri-loader-4-line';
    text = `The stored SIA check status is ${status}. Check the queue and register evidence for its latest progress.`;
  } else if (['failed', 'rejected', 'not_found', 'expired', 'invalid_licence_format'].includes(status)) {
    const labels: Record<string, string> = { failed: 'Failed', rejected: 'Rejected', not_found: 'Not found', expired: 'Expired', invalid_licence_format: 'Invalid licence format' };
    label = labels[status];
    color = 'bg-red-500/10 text-red-400 ring-red-500/30';
    icon = 'ri-close-circle-line';
    text = `The recorded SIA result is ${label.toLowerCase()}. Review the licence and register evidence.`;
  } else if (['webhook_missing', 'webhook_error', 'queue_error', 'error', 'review', 'manual_review', 'name_mismatch'].includes(status)) {
    const labels: Record<string, string> = { webhook_missing: 'Webhook Missing', webhook_error: 'Webhook Error', queue_error: 'Queue error', error: 'Check error', review: 'Review required', manual_review: 'Review required', name_mismatch: 'Name mismatch' };
    label = labels[status];
    color = 'bg-amber-500/10 text-amber-400 ring-amber-500/30';
    icon = 'ri-alert-line';
    text = status === 'webhook_missing'
      ? 'The stored SIA result reports a missing webhook configuration. Manual admin review is required.'
      : `The stored SIA result reports ${label.toLowerCase()}. Review the recorded error or register evidence.`;
  } else if (status === 'verified_test') {
    label = 'Recorded result';
    text = 'A test verification result is recorded. Review the original register evidence separately.';
  }

  const mismatch = context.sia_mismatch_reason?.trim();
  if (mismatch && /\bmanual[\s_-]+override\b/i.test(mismatch)) {
    label = 'Manual override';
    color = 'bg-amber-500/10 text-amber-400 ring-amber-500/30';
    icon = 'ri-user-voice-line';
    text = `A manual override is recorded. Stored check status: ${status.replace(/_/g, ' ') || 'not recorded'}. Review the override and original register evidence.`;
  } else if (mismatch) {
    if (positive) {
      label = 'Evidence needs review';
      color = 'bg-amber-500/10 text-amber-400 ring-amber-500/30';
      icon = 'ri-alert-line';
    }
    text += ` Recorded mismatch: ${mismatch}.`;
  }
  const testResult = context.is_test_account === true || status === 'verified_test';
  if (testResult) {
    if (positive || status === 'verified_test') color = 'bg-amber-500/10 text-amber-400 ring-amber-500/30';
    text = `Test account/result. ${text}`;
  }
  return { label: `${testResult ? 'SIA test' : 'SIA'}: ${label}`, color, icon, text };
}

export function getSiaCheckStatusBadge(sia_check_status: string | null, verification_status: string, context: SiaStatusContext = {}): { label: string; color: string; icon: string } {
  return getSiaCheckDisplay(sia_check_status, verification_status, context);
}

export function getSiaCheckStatusText(sia_check_status: string | null, verification_status: string, context: SiaStatusContext = {}): string {
  return getSiaCheckDisplay(sia_check_status, verification_status, context).text;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

export function matchesSearch(guard: GuardVerification, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  return (
    guard.full_name?.toLowerCase().includes(q) ||
    guard.email?.toLowerCase().includes(q) ||
    guard.sia_licence_number?.toLowerCase().includes(q) ||
    guard.phone?.toLowerCase().includes(q)
  );
}