import { supabase } from './supabase'

export type QuickGuardRole = 'client' | 'guard' | 'admin' | null

export type QuickGuardAccountStatus =
  | 'active'
  | 'pending'
  | 'suspended'
  | 'disabled'
  | 'deletion_requested'

export type QuickGuardVerificationStatus =
  | 'not_required'
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'pending'
  | 'more_information_required'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'suspended'

export interface QuickGuardAccountState {
  userId: string
  email: string | null
  role: QuickGuardRole
  accountStatus: QuickGuardAccountStatus
  onboardingComplete: boolean
  profileExists: boolean
  verificationStatus: QuickGuardVerificationStatus
  requiredNextStep: string | null
}

const VERIFICATION_STATUS_MAP: Record<string, QuickGuardVerificationStatus> = {
  approved: 'verified',
  verified: 'verified',
  manual_review: 'in_progress',
  pending_sia_check: 'in_progress',
  pending: 'pending',
  in_progress: 'in_progress',
  submitted: 'submitted',
  not_started: 'not_started',
  rejected: 'rejected',
  expired: 'expired',
  suspended: 'suspended',
  more_information_required: 'more_information_required',
}

function normalizeVerificationStatus(raw: string | null | undefined): QuickGuardVerificationStatus {
  if (!raw) return 'not_started'
  return VERIFICATION_STATUS_MAP[raw] || 'pending'
}

export async function resolveAccountState(): Promise<QuickGuardAccountState> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      userId: '',
      email: null,
      role: null,
      accountStatus: 'disabled',
      onboardingComplete: false,
      profileExists: false,
      verificationStatus: 'not_required',
      requiredNextStep: '/login',
    }
  }

  const userId = user.id
  const email = user.email ?? null

  try {
    const [adminResult, guardResult, clientResult, userResult, subscriptionResult] = await Promise.allSettled([
      supabase.from('admin_users').select('id, is_active, role').eq('user_id', userId).maybeSingle(),
      supabase.from('guards').select('id, verification_status, profile_completed, is_active, onboarding_status, subscription_status, sia_licence_number, sia_expiry_date').eq('user_id', userId).maybeSingle(),
      supabase.from('clients').select('id, profile_completed, is_active, is_suspended, onboarding_status, subscription_status').eq('user_id', userId).maybeSingle(),
      supabase.from('users').select('user_type').eq('id', userId).maybeSingle(),
      supabase.from('subscriptions').select('status, plan_slug').eq('user_id', userId).maybeSingle(),
    ])

    const adminData = adminResult.status === 'fulfilled' ? adminResult.value.data : null
    const guardData = guardResult.status === 'fulfilled' ? guardResult.value.data : null
    const clientData = clientResult.status === 'fulfilled' ? clientResult.value.data : null
    const userRow = userResult.status === 'fulfilled' ? userResult.value.data : null
    const subData = subscriptionResult.status === 'fulfilled' ? subscriptionResult.value.data : null

    const hasAnyError = [adminResult, guardResult, clientResult, userResult, subscriptionResult].some(r => r.status === 'rejected')

    if (hasAnyError && !adminData && !guardData && !clientData && !userRow) {
      return {
        userId,
        email,
        role: null,
        accountStatus: 'disabled',
        onboardingComplete: false,
        profileExists: false,
        verificationStatus: 'not_required',
        requiredNextStep: '/login?error=service_unavailable',
      }
    }

    if (adminData && adminData.is_active) {
      return {
        userId,
        email,
        role: 'admin',
        accountStatus: 'active',
        onboardingComplete: true,
        profileExists: true,
        verificationStatus: 'not_required',
        requiredNextStep: null,
      }
    }

    let role: QuickGuardRole = null
    if (guardData) role = 'guard'
    else if (clientData) role = 'client'
    else if (userRow?.user_type === 'guard') role = 'guard'
    else if (userRow?.user_type === 'client') role = 'client'

    let accountStatus: QuickGuardAccountStatus = 'active'
    let onboardingComplete = false
    let profileExists = false
    let verificationStatus: QuickGuardVerificationStatus = 'not_required'
    let requiredNextStep: string | null = null

    if (role === 'guard') {
      profileExists = !!guardData
      onboardingComplete = guardData?.profile_completed === true
      verificationStatus = normalizeVerificationStatus(guardData?.verification_status)

      if (!profileExists) {
        accountStatus = 'pending'
        requiredNextStep = '/guard/complete-profile-wizard'
      } else if (guardData?.is_active === false) {
        accountStatus = 'disabled'
        requiredNextStep = '/guard/account-status?reason=disabled'
      } else if (subData?.status === 'suspended' || subData?.status === 'cancelled') {
        accountStatus = 'suspended'
        requiredNextStep = '/guard/account-status?reason=suspended'
      } else if (!onboardingComplete) {
        accountStatus = 'pending'
        requiredNextStep = '/guard/complete-profile-wizard'
      } else if (verificationStatus === 'rejected') {
        accountStatus = 'pending'
        requiredNextStep = '/guard/verification-failed'
      } else if (verificationStatus === 'expired') {
        accountStatus = 'pending'
        requiredNextStep = '/guard/account-status?reason=licence_expired'
      } else if (verificationStatus === 'suspended') {
        accountStatus = 'suspended'
        requiredNextStep = '/guard/account-status?reason=suspended'
      } else if (verificationStatus === 'not_started' || verificationStatus === 'in_progress' || verificationStatus === 'submitted' || verificationStatus === 'pending' || verificationStatus === 'more_information_required') {
        accountStatus = 'pending'
        requiredNextStep = '/guard/verification-pending'
      } else if (verificationStatus === 'verified') {
        accountStatus = 'active'
        requiredNextStep = null
      } else {
        requiredNextStep = '/guard/onboarding'
      }
    } else if (role === 'client') {
      profileExists = !!clientData
      onboardingComplete = clientData?.profile_completed === true
      verificationStatus = 'not_required'

      if (!profileExists) {
        accountStatus = 'pending'
        requiredNextStep = '/client/complete-profile-wizard'
      } else if (clientData?.is_active === false || clientData?.is_suspended === true) {
        accountStatus = 'suspended'
        requiredNextStep = '/client/account-status?reason=suspended'
      } else if (subData?.status === 'suspended' || subData?.status === 'cancelled') {
        accountStatus = 'suspended'
        requiredNextStep = '/client/account-status?reason=suspended'
      } else if (!onboardingComplete) {
        accountStatus = 'pending'
        requiredNextStep = '/client/complete-profile-wizard'
      } else {
        accountStatus = 'active'
        requiredNextStep = null
      }
    } else {
      const metaRole = user.user_metadata?.role || user.user_metadata?.user_type
      if (metaRole === 'guard') {
        accountStatus = 'pending'
        profileExists = false
        verificationStatus = 'not_started'
        requiredNextStep = '/guard/complete-profile-wizard'
      } else if (metaRole === 'client') {
        accountStatus = 'pending'
        profileExists = false
        verificationStatus = 'not_required'
        requiredNextStep = '/client/complete-profile-wizard'
      } else {
        accountStatus = 'pending'
        profileExists = false
        verificationStatus = 'not_required'
        requiredNextStep = '/login'
      }
    }

    return {
      userId,
      email,
      role,
      accountStatus,
      onboardingComplete,
      profileExists,
      verificationStatus,
      requiredNextStep,
    }
  } catch {
    return {
      userId,
      email,
      role: null,
      accountStatus: 'disabled',
      onboardingComplete: false,
      profileExists: false,
      verificationStatus: 'not_required',
      requiredNextStep: '/login?error=service_unavailable',
    }
  }
}

export function getAccountStatusDisplay(status: QuickGuardAccountStatus): string {
  const labels: Record<QuickGuardAccountStatus, string> = {
    active: 'Active',
    pending: 'Pending',
    suspended: 'Suspended',
    disabled: 'Disabled',
    deletion_requested: 'Deletion Requested',
  }
  return labels[status] || status
}

export function getVerificationStatusDisplay(status: QuickGuardVerificationStatus): string {
  const labels: Record<QuickGuardVerificationStatus, string> = {
    not_required: 'Not Required',
    not_started: 'Not Started',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    pending: 'Pending Review',
    more_information_required: 'More Info Required',
    verified: 'Verified',
    rejected: 'Rejected',
    expired: 'Expired',
    suspended: 'Suspended',
  }
  return labels[status] || status
}

export function detectPartialAccount(state: QuickGuardAccountState): {
  isPartial: boolean
  missingProfile: boolean
  missingConsent: boolean
  missingOnboarding: boolean
  missingVerification: boolean
} {
  return {
    isPartial: !!state.userId && !state.profileExists,
    missingProfile: !state.profileExists,
    missingConsent: false,
    missingOnboarding: state.profileExists && !state.onboardingComplete,
    missingVerification: state.role === 'guard' && state.profileExists && state.verificationStatus === 'not_started',
  }
}