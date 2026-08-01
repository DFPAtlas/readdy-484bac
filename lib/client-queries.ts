import { supabase } from './supabase';
import type {
  Client,
  Job,
  JobAssignment,
  JobApplication,
  Guard,
  Payment,
  NotificationItem,
  SupportTicket,
  SavedSite,
  ActivityLogEntry,
  ClientContact,
  ClientDocument,
  SubscriptionInfo,
  NotificationPrefs,
  JobStat,
  DashboardData,
  PipelineData,
  RecentJobSummary,
} from './client-types';

// ---------------------------------------------------------------------------
// Auth / Session
// ---------------------------------------------------------------------------

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export async function getCurrentClient(): Promise<{ client: Client | null; error: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { client: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { client: null, error: error.message };
  if (!data) return { client: null, error: 'Client not found' };

  return { client: data as Client, error: null };
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function getClientJobs(
  clientId: string,
  opts?: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    status?: string[];
    columns?: string;
  }
): Promise<{ jobs: Job[]; error: string | null }> {
  let query = supabase
    .from('jobs')
    .select(opts?.columns || '*, job_assignments(id, guard_id, status, assigned_at, attendance_status, check_in_time, issue_reported, replacement_requested, late_minutes)')
    .eq('client_id', clientId)
    .eq('is_deleted', false);

  if (opts?.status && opts.status.length > 0) {
    query = query.in('status', opts.status);
  }

  const orderCol = opts?.orderBy || 'created_at';
  query = query.order(orderCol, { ascending: opts?.ascending ?? false });

  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) return { jobs: [], error: error.message };
  return { jobs: (data || []) as Job[], error: null };
}

export async function getJobAssignments(jobIds: string[]): Promise<{ assignments: JobAssignment[]; error: string | null }> {
  if (jobIds.length === 0) return { assignments: [], error: null };
  const { data, error } = await supabase
    .from('job_assignments')
    .select('id, job_id, guard_id, status, assigned_at, completed_at, payment_status, payment_amount, attendance_status, check_in_time, issue_reported, replacement_requested, late_minutes')
    .in('job_id', jobIds);

  if (error) return { assignments: [], error: error.message };
  return { assignments: (data || []) as JobAssignment[], error: null };
}

export async function getJobApplications(jobIds: string[]): Promise<{ applications: JobApplication[]; error: string | null }> {
  if (jobIds.length === 0) return { applications: [], error: null };
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, guards(id, full_name, rating, sia_licence_number, years_experience, profile_image_url)')
    .in('job_id', jobIds);

  if (error) return { applications: [], error: error.message };
  return { applications: (data || []) as JobApplication[], error: null };
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export async function getGuardsByIds(guardIds: string[]): Promise<{ guards: Guard[]; error: string | null }> {
  if (guardIds.length === 0) return { guards: [], error: null };
  const { data, error } = await supabase
    .from('guards')
    .select('id, full_name, sia_licence_number, rating, total_reviews, years_experience, location, profile_image_url, sia_expiry_date, sia_verified, is_active, verification_status, user_id, phone, email, postcode')
    .in('id', guardIds);

  if (error) return { guards: [], error: error.message };
  return { guards: (data || []) as Guard[], error: null };
}

export async function getRecommendedGuards(limit = 5): Promise<{ guards: Guard[]; error: string | null }> {
  const { data, error } = await supabase
    .from('guards')
    .select('id, full_name, sia_licence_number, rating, total_reviews, years_experience, location, profile_image_url')
    .eq('sia_verified', true)
    .eq('is_active', true)
    .order('rating', { ascending: false })
    .limit(limit);

  if (error) return { guards: [], error: error.message };
  return { guards: (data || []) as Guard[], error: null };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
// SECURITY: subscription_payments are scoped by user_id = auth user ID
// SECURITY: transactions are scoped by client_id = client record ID (NOT auth.uid())
// The create-job-payment edge function verifies job.client_id === clientData.id
// before creating any transaction, ensuring payment isolation.
// ---------------------------------------------------------------------------

export async function getClientSubscriptionPayments(userId: string): Promise<{ payments: Payment[]; error: string | null }> {
  // userId = auth.uid() — subscription_payments stores auth user ID
  const { data, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { payments: [], error: error.message };
  return { payments: (data || []) as Payment[], error: null };
}

export async function getClientJobPayments(clientId: string): Promise<{ payments: Payment[]; error: string | null }> {
  // clientId = clients.id (NOT auth.uid()) — transactions stores client record ID
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return { payments: [], error: error.message };
  return { payments: (data || []) as Payment[], error: null };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getClientNotifications(
  userId: string,
  opts?: { limit?: number; unreadOnly?: boolean; category?: string }
): Promise<{ notifications: NotificationItem[]; error: string | null }> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (opts?.unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (opts?.category) {
    query = query.eq('category', opts.category);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) return { notifications: [], error: error.message };
  return { notifications: (data || []) as NotificationItem[], error: null };
}

// ---------------------------------------------------------------------------
// Support Tickets
// ---------------------------------------------------------------------------

export async function getClientSupportTickets(
  clientId: string,
  opts?: { status?: string[]; limit?: number }
): Promise<{ tickets: SupportTicket[]; error: string | null }> {
  let query = supabase
    .from('support_tickets')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (opts?.status && opts.status.length > 0) {
    query = query.in('status', opts.status);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) return { tickets: [], error: error.message };
  return { tickets: (data || []) as SupportTicket[], error: null };
}

// ---------------------------------------------------------------------------
// Saved Sites
// ---------------------------------------------------------------------------

export async function getClientSavedSites(clientId: string): Promise<{ sites: SavedSite[]; error: string | null }> {
  const { data, error } = await supabase
    .from('saved_sites')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return { sites: [], error: error.message };
  return { sites: (data || []) as SavedSite[], error: null };
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export async function getClientActivityLog(
  clientId: string,
  opts?: { limit?: number; category?: string; relatedJobId?: string }
): Promise<{ entries: ActivityLogEntry[]; error: string | null }> {
  let query = supabase
    .from('client_activity_log')
    .select('id, action_type, action_description, category, related_job_id, related_payment_id, related_ticket_id, metadata, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (opts?.category) {
    query = query.eq('category', opts.category);
  }
  if (opts?.relatedJobId) {
    query = query.eq('related_job_id', opts.relatedJobId);
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const { data, error } = await query;
  if (error) return { entries: [], error: error.message };
  return { entries: (data || []) as ActivityLogEntry[], error: null };
}

// ---------------------------------------------------------------------------
// Contacts & Documents
// ---------------------------------------------------------------------------

export async function getClientContacts(clientId: string): Promise<{ contacts: ClientContact[]; error: string | null }> {
  const { data, error } = await supabase
    .from('client_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });

  if (error) return { contacts: [], error: error.message };
  return { contacts: (data || []) as ClientContact[], error: null };
}

export async function getClientDocuments(clientId: string): Promise<{ documents: ClientDocument[]; error: string | null }> {
  const { data, error } = await supabase
    .from('client_documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) return { documents: [], error: error.message };
  return { documents: (data || []) as ClientDocument[], error: null };
}

// ---------------------------------------------------------------------------
// Subscription & Preferences
// ---------------------------------------------------------------------------

export async function getClientSubscription(userId: string): Promise<{ subscription: SubscriptionInfo | null; error: string | null }> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { subscription: null, error: error.message };
  return { subscription: data as SubscriptionInfo | null, error: null };
}

export async function getClientNotificationPrefs(userId: string): Promise<{ prefs: NotificationPrefs | null; error: string | null }> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { prefs: null, error: error.message };
  return { prefs: data as NotificationPrefs | null, error: null };
}

// ---------------------------------------------------------------------------
// Dashboard Aggregated Stats
// ---------------------------------------------------------------------------

export async function getClientDashboardStats(clientId: string, userId: string): Promise<{
  stats: JobStat;
  actionData: Partial<DashboardData>;
  error: string | null;
}> {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Fetch jobs in one query
  const { data: jobsData, error: jobsError } = await supabase
    .from('jobs')
    .select('id, status, start_date, start_time, created_at, updated_at, applications_count, assigned_count, hourly_rate, number_of_guards, risk_level, emergency_contact_name, emergency_contact_phone, sia_licence_required, lone_worker_flag, job_title, venue_city, postcode, payment_status, agreed_amount')
    .eq('client_id', clientId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (jobsError) return { stats: { total_jobs: 0, active_jobs: 0, completed_jobs: 0, pending_payments: 0 }, actionData: {}, error: jobsError.message };

  const jobs = (jobsData || []) as Job[];
  const jobIds = jobs.map(j => j.id);

  const stats: JobStat = {
    total_jobs: jobs.length,
    active_jobs: jobs.filter(j => j.status === 'active' || j.status === 'open').length,
    completed_jobs: jobs.filter(j => j.status === 'completed').length,
    pending_payments: jobs.filter(j => j.status === 'payment_pending' || j.status === 'awaiting_payment').length,
  };

  // Pipeline data computed from the same jobs fetch
  const pipelineData: PipelineData = {
    draftCount: jobs.filter(j => j.status === "draft").length,
    postedCount: jobs.filter(j => j.status === "open").length,
    applicationsCount: jobs.filter(j => (j.applications_count || 0) > 0).length,
    selectedCount: jobs.filter(j => (j.assigned_count || 0) > 0).length,
    paymentPendingCount: jobs.filter(j => j.status === "payment_pending" || j.status === "awaiting_payment").length,
    activeCount: jobs.filter(j => j.status === "active" || j.status === "in_progress").length,
    completedCount: jobs.filter(j => j.status === "completed").length,
  };

  const jobsAwaitingPayment = stats.pending_payments;
  const jobsStartingSoon = jobs.filter(j => {
    if (!j.start_date) return false;
    const d = new Date(j.start_date);
    return d >= now && d <= in48h;
  }).length;

  // Fetch counts in parallel
  const [
    assignmentsRes,
    reviewsRes,
    unreadMessagesRes,
    openTicketsRes,
    failedPaymentsRes,
    txRes,
    distinctGuardsRes,
  ] = await Promise.all([
    jobIds.length > 0
      ? supabase
          .from('job_assignments')
          .select('job_id, guard_id, status, assigned_at, attendance_status, check_in_time, issue_reported, replacement_requested, late_minutes')
          .in('job_id', jobIds)
      : Promise.resolve({ data: [] }),
    jobIds.length > 0
      ? supabase.from('reviews').select('job_id, guard_id').eq('client_id', userId).in('job_id', jobIds)
      : Promise.resolve({ data: [] }),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', userId).eq('read', false),
    supabase
      .from('support_tickets')
      .select('priority, status')
      .eq('client_id', clientId)
      .eq('is_deleted', false)
      .in('status', ['open', 'awaiting_client', 'escalated', 'under_review']),
    supabase.from('subscription_payments').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'failed'),
    supabase.from('transactions').select('amount').eq('client_id', clientId).gte('created_at', startOfMonth),
    jobIds.length > 0
      ? supabase.from('job_assignments').select('guard_id').in('job_id', jobIds)
      : Promise.resolve({ data: [] }),
  ]);

  const assignments = (assignmentsRes.data || []) as JobAssignment[];
  const reviews = (reviewsRes.data || []) as { job_id: string; guard_id: string }[];
  const unreadMessages = unreadMessagesRes.count || 0;
  const openTickets = (openTicketsRes.data || []) as { priority: string; status: string }[];
  const failedPayments = failedPaymentsRes.count || 0;
  const txData = (txRes.data || []) as { amount: number }[];
  const distinctGuards = (distinctGuardsRes.data || []) as { guard_id: string }[];

  // Count attendance issues
  let lateGuards = 0;
  let noShows = 0;
  let guardsNotCheckedIn = 0;
  let jobsNeedingReplacement = 0;

  assignments.forEach(a => {
    if (a.attendance_status === 'late') lateGuards++;
    if (a.attendance_status === 'no_show') noShows++;
    if (a.attendance_status === 'confirmed' || a.attendance_status === 'not_checked_in' || a.attendance_status === 'awaiting_confirmation') {
      const job = jobs.find(j => j.id === a.job_id);
      if (job && job.start_date && job.start_time) {
        const start = new Date(`${job.start_date}T${job.start_time}`);
        if (now >= start) {
          guardsNotCheckedIn++;
        }
      }
    }
    if (a.replacement_requested) jobsNeedingReplacement++;
  });

  const guardIds = [...new Set(assignments.map(a => a.guard_id).filter(Boolean))];

  let expiringLicences = 0;
  let pendingGuardConfirmations = 0;

  if (guardIds.length > 0) {
    const { count: expCount } = await supabase
      .from('guards')
      .select('*', { count: 'exact', head: true })
      .in('id', guardIds)
      .lte('sia_expiry_date', in30d.toISOString().split('T')[0])
      .gte('sia_expiry_date', now.toISOString().split('T')[0]);
    expiringLicences = expCount || 0;

    const { count: pendingCount } = await supabase
      .from('job_assignments')
      .select('*', { count: 'exact', head: true })
      .in('job_id', jobIds)
      .eq('status', 'pending');
    pendingGuardConfirmations = pendingCount || 0;
  }

  const assignmentMap: Record<string, Set<string>> = {};
  assignments.forEach(a => {
    if (!assignmentMap[a.job_id]) assignmentMap[a.job_id] = new Set();
    assignmentMap[a.job_id].add(a.guard_id);
  });

  const reviewMap: Record<string, Set<string>> = {};
  reviews.forEach(r => {
    if (!reviewMap[r.job_id]) reviewMap[r.job_id] = new Set();
    reviewMap[r.job_id].add(r.guard_id);
  });

  let guardsAwaitingReview = 0;
  Object.keys(assignmentMap).forEach(jid => {
    const assigned = assignmentMap[jid].size;
    const reviewed = reviewMap[jid]?.size || 0;
    guardsAwaitingReview += Math.max(0, assigned - reviewed);
  });

  // Build recentJobs (top 5) using the same assignment/review maps
  const recentJobs: RecentJobSummary[] = jobs.slice(0, 5).map(j => {
    const riAssigned = assignmentMap[j.id]?.size || 0;
    const riReviewed = reviewMap[j.id]?.size || 0;
    const needsPayment = (j.status === "payment_pending" || j.status === "awaiting_payment") && j.payment_status !== 'funded';
    return {
      id: j.id,
      job_title: j.job_title,
      venue_city: j.venue_city,
      postcode: j.postcode,
      start_date: j.start_date,
      status: j.status,
      payment_status: j.payment_status,
      agreed_amount: j.agreed_amount,
      applications_count: j.applications_count || 0,
      assigned_count: j.assigned_count || 0,
      needs_payment: needsPayment,
      needs_review: j.status === "completed" && riAssigned > 0 && riReviewed < riAssigned,
      reviewed_count: riReviewed,
    } as RecentJobSummary;
  });

  const urgentTickets = openTickets.filter(t => t.priority === 'urgent').length;
  const awaitingReplyTickets = openTickets.filter(t => t.status === 'awaiting_client').length;

  const totalSpend = txData.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalGuardsHired = [...new Set(distinctGuards.map(a => a.guard_id))].length;

  // Safety counts
  let missingSafetyInfo = 0;
  let highRiskJobs = 0;
  let complianceWarnings = 0;
  let missingEmergencyContacts = 0;

  jobs.forEach(j => {
    if (j.risk_level === 'high' || j.risk_level === 'urgent') {
      highRiskJobs++;
    }
    if (!j.emergency_contact_name && !j.emergency_contact_phone) {
      missingEmergencyContacts++;
    }
  });

  const [cancellationsRes, refundsRes, cancelledMonthRes] = await Promise.all([
    jobIds.length > 0
      ? supabase
          .from('support_tickets')
          .select('id, status')
          .eq('client_id', clientId)
          .in('status', ['open', 'awaiting_client', 'escalated', 'under_review'])
          .eq('category', 'cancellation')
      : Promise.resolve({ data: [] }),
    jobIds.length > 0
      ? supabase
          .from('support_tickets')
          .select('id, status')
          .eq('client_id', clientId)
          .in('status', ['open', 'awaiting_client', 'escalated', 'under_review'])
          .eq('category', 'refund')
      : Promise.resolve({ data: [] }),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('is_deleted', false)
      .eq('status', 'cancelled')
      .gte('created_at', startOfMonth),
  ]);

  const cancellationRequestsOpen = (cancellationsRes.data || []).length;
  const refundRequestsPending = (refundsRes.data || []).length;
  const cancelledJobsThisMonth = cancelledMonthRes.count || 0;

  const emergencyReplacements = 0;
  const replacementRequestsOpen = 0;
  const replacementAwaitingApproval = 0;
  const replacementUnableToFill = 0;
  const jobsUnderAdminReview = 0;

  const actionData: Partial<DashboardData> = {
    actionData: {
      guardsAwaitingReview,
      jobsAwaitingPayment,
      jobsStartingSoon,
      unreadMessages,
      expiringLicences,
      openTickets: openTickets.length,
      urgentTickets,
      awaitingReplyTickets,
      pendingGuardConfirmations,
      failedPayments,
      guardsNotCheckedIn,
      lateGuards,
      noShows,
      jobsNeedingReplacement,
      emergencyReplacements,
      replacementRequestsOpen,
      replacementAwaitingApproval,
      replacementUnableToFill,
      cancellationRequestsOpen,
      refundRequestsPending,
      jobsUnderAdminReview,
      cancelledJobsThisMonth,
    },
    businessData: {
      activeJobs: stats.active_jobs,
      totalGuardsHired,
      totalSpendThisMonth: totalSpend,
      averageFillTime: 0, // TODO: calculate fill times if needed
      completedThisMonth: jobs.filter(j => j.status === 'completed' && j.updated_at && new Date(j.updated_at) >= new Date(startOfMonth)).length,
    },
    safetyCounts: {
      missingSafetyInfo,
      highRiskJobs,
      complianceWarnings,
      missingEmergencyContacts,
    },
    pipelineData,
    recentJobs,
  };

  return { stats, actionData, error: null };
}