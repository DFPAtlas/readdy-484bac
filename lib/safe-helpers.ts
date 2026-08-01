import { supabase } from './supabase'

export interface SafeClientProfile {
  id: string
  userId: string
  contactName: string
  email: string
  companyName: string
  phone: string
  subscriptionTier: string
  subscriptionStatus: string
  profileCompleted: boolean
  isActive: boolean
  onboardingStatus: string | null
}

export interface SafeGuardProfile {
  id: string
  userId: string
  fullName: string
  email: string
  phone: string
  verificationStatus: string
  profileCompleted: boolean
  isActive: boolean
  dashboardAccess: boolean
  onboardingStatus: string | null
  subscriptionStatus: string
}

export interface SafeSubscription {
  id: string
  userId: string
  planName: string
  planSlug: string
  status: string
  currentPeriodEnd: string | null
  trialEndDate: string | null
}

export interface OwnershipCheck {
  isOwner: boolean
  reason: string | null
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function getSafeClientProfile(): Promise<SafeClientProfile | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data } = await supabase
    .from('clients')
    .select('id, user_id, contact_name, email, company_name, phone, subscription_tier, subscription_status, profile_completed, is_active, onboarding_status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    contactName: data.contact_name,
    email: data.email,
    companyName: data.company_name || '',
    phone: data.phone || '',
    subscriptionTier: data.subscription_tier || 'Free',
    subscriptionStatus: data.subscription_status || 'trialing',
    profileCompleted: data.profile_completed || false,
    isActive: data.is_active !== false,
    onboardingStatus: data.onboarding_status || null,
  }
}

export async function getSafeGuardProfile(): Promise<SafeGuardProfile | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data } = await supabase
    .from('guards')
    .select('id, user_id, full_name, email, phone, verification_status, profile_completed, is_active, dashboard_access, onboarding_status, subscription_status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone || '',
    verificationStatus: data.verification_status || 'not_started',
    profileCompleted: data.profile_completed || false,
    isActive: data.is_active !== false,
    dashboardAccess: data.dashboard_access !== false,
    onboardingStatus: data.onboarding_status || null,
    subscriptionStatus: data.subscription_status || 'trialing',
  }
}

export async function getSafeSubscription(): Promise<SafeSubscription | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_name, plan_slug, status, current_period_end, trial_end_date')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    planName: data.plan_name || 'Free Trial',
    planSlug: data.plan_slug || 'trial',
    status: data.status || 'trialing',
    currentPeriodEnd: data.current_period_end || null,
    trialEndDate: data.trial_end_date || null,
  }
}

export async function checkJobOwnership(jobId: string): Promise<OwnershipCheck> {
  const userId = await getCurrentUserId()
  if (!userId) return { isOwner: false, reason: 'Not authenticated' }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!client) return { isOwner: false, reason: 'Not a client' }

  const { data: job } = await supabase
    .from('jobs')
    .select('client_id')
    .eq('id', jobId)
    .maybeSingle()

  if (!job) return { isOwner: false, reason: 'Job not found' }
  if (job.client_id !== client.id) return { isOwner: false, reason: 'Not your job' }

  return { isOwner: true, reason: null }
}

export async function checkAssignmentMembership(assignmentId: string): Promise<OwnershipCheck> {
  const userId = await getCurrentUserId()
  if (!userId) return { isOwner: false, reason: 'Not authenticated' }

  const { data: guard } = await supabase
    .from('guards')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: assignment } = await supabase
    .from('job_assignments')
    .select('guard_id, job_id')
    .eq('id', assignmentId)
    .maybeSingle()

  if (!assignment) return { isOwner: false, reason: 'Assignment not found' }

  const { data: job } = await supabase
    .from('jobs')
    .select('client_id')
    .eq('id', assignment.job_id)
    .maybeSingle()

  if (guard && assignment.guard_id === guard.id) return { isOwner: true, reason: null }
  if (client && job && job.client_id === client.id) return { isOwner: true, reason: null }

  return { isOwner: false, reason: 'Not your assignment' }
}

export async function checkConversationMembership(conversationId: string): Promise<OwnershipCheck> {
  const userId = await getCurrentUserId()
  if (!userId) return { isOwner: false, reason: 'Not authenticated' }

  const { data } = await supabase
    .from('messages')
    .select('sender_id, recipient_id')
    .eq('conversation_id', conversationId)
    .limit(1)
    .maybeSingle()

  if (!data) return { isOwner: false, reason: 'Conversation not found' }
  if (data.sender_id === userId || data.recipient_id === userId) return { isOwner: true, reason: null }

  return { isOwner: false, reason: 'Not your conversation' }
}

export async function checkNotificationOwnership(notificationId: string): Promise<OwnershipCheck> {
  const userId = await getCurrentUserId()
  if (!userId) return { isOwner: false, reason: 'Not authenticated' }

  const { data } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('id', notificationId)
    .maybeSingle()

  if (!data) return { isOwner: false, reason: 'Notification not found' }
  if (data.user_id === userId) return { isOwner: true, reason: null }

  return { isOwner: false, reason: 'Not your notification' }
}