export interface Client {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  business_address: string | null;
  subscription_tier: string;
  subscription_status: string;
  verification_status: string;
  profile_completed: boolean;
  created_at: string;
  updated_at: string | null;
  stripe_customer_id: string | null;
  billing_email: string | null;
  vat_number: string | null;
  billing_address_line1: string | null;
  first_name: string | null;
  last_name: string | null;
  client_promo_tier: string | null;
  client_signup_number: number | null;
  client_promo_ends_at: string | null;
  client_promo_jobs_remaining: number | null;
  client_lifetime_fee_discount: number | null;
  founding_client_badge: boolean;
  onboarding_status: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  current_period_end: string | null;
  plan_name: string | null;
  logo_url: string | null;
  total_jobs_posted: number;
  total_spent: number;
  company_type: string | null;
  trading_name: string | null;
  company_registration_number: string | null;
  website: string | null;
  description: string | null;
  industry: string | null;
  company_size: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postcode: string | null;
  verified: boolean;
}

export interface Job {
  id: string;
  client_id: string;
  job_title: string;
  security_type: string;
  job_description: string | null;
  venue_name: string | null;
  venue_address_line1: string | null;
  venue_address_line2: string | null;
  venue_city: string | null;
  venue_postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  number_of_guards: number;
  number_of_days: number;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hourly_rate: number;
  sia_licence_required: boolean;
  required_licence_types: string[] | null;
  uniform_required: boolean;
  uniform_details: string | null;
  experience_level: string | null;
  dress_code: string | null;
  special_instructions: string | null;
  additional_requirements: string | null;
  urgency: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: JobStatus;
  applications_count: number;
  assigned_count: number;
  checked_in_count: number;
  late_count: number;
  no_show_count: number;
  issue_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
  booking_reference: string | null;
  risk_level: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  repeat_pattern: string | null;
  repeat_frequency: string | null;
  repeat_end_date: string | null;
  is_recurring: boolean;
  saved_site_id: string | null;
  geocoded_at: string | null;
}

export type JobStatus =
  | 'draft'
  | 'open'
  | 'pending'
  | 'awaiting_guard_selection'
  | 'awaiting_payment'
  | 'in_progress'
  | 'active'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'awaiting_client_confirmation'
  | 'payment_pending';

export interface ClientJob extends Job {
  is_featured?: boolean;
  is_urgent?: boolean;
  expires_at?: string | null;
  publish_at?: string | null;
  is_draft?: boolean;
  cancellation_status?: string | null;
  cancellation_reason?: string | null;
  refund_status?: string | null;
  site_instructions?: string | null;
  title?: string | null;
  agreed_amount?: number | null;
  payment_status?: string | null;
  safety_check?: Record<string, unknown> | null;
  job_assignments?: Array<{ id: string; guard_id: string }> | null;
  job_applications?: Array<{ count: number }> | null;
}

export interface JobAssignment {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  assigned_at: string | null;
  completed_at: string | null;
  payment_status: string | null;
  payment_amount: number | null;
  attendance_status: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  issue_reported: boolean;
  replacement_requested: boolean;
  late_minutes: number | null;
  guards?: Guard | null;
}

export interface Guard {
  id: string;
  user_id: string | null;
  full_name: string;
  sia_licence_number: string | null;
  sia_expiry_date: string | null;
  sia_verified: boolean;
  licence_types: string[] | null;
  rating: number | null;
  total_reviews: number;
  years_experience: number | null;
  location: string | null;
  profile_image_url: string | null;
  is_active: boolean;
  verification_status: string | null;
  phone: string | null;
  email: string | null;
  postcode: string | null;
  distance_km?: number | null;
  availability?: string[] | null;
  compliance_status?: string | null;
  hourly_rate?: number | null;
}

export interface JobApplication {
  id: string;
  job_id: string;
  guard_id: string;
  status: string;
  cover_letter: string | null;
  proposed_rate: number | null;
  created_at: string;
  updated_at: string | null;
  guards?: Guard | null;
}

export interface Payment {
  id: string;
  client_id: string;
  user_id: string;
  job_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  receipt_url: string | null;
  stripe_invoice_id: string | null;
  billing_reason: string | null;
  period_start: string | null;
  period_end: string | null;
  failure_reason: string | null;
  refunded: boolean;
  refund_amount: number | null;
  created_at: string;
  updated_at: string | null;
  jobs?: { job_title: string | null } | null;
}

export type PaymentStatus =
  | 'succeeded'
  | 'completed'
  | 'paid'
  | 'pending'
  | 'pending_payment'
  | 'processing'
  | 'failed'
  | 'refunded'
  | 'disputed'
  | 'invoice_sent'
  | 'none';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  priority: number;
  is_read: boolean;
  read: boolean;
  created_at: string;
  link: string | null;
  data: Record<string, unknown> | null;
  related_job_id: string | null;
  related_guard_id: string | null;
}

export interface SupportTicket {
  id: string;
  client_id: string;
  ticket_reference: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: SupportTicketStatus;
  related_job_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  job_title?: string | null;
}

export type SupportTicketStatus =
  | 'open'
  | 'awaiting_client'
  | 'under_review'
  | 'escalated'
  | 'resolved'
  | 'closed';

export interface SavedJob {
  id: string;
  guard_id: string;
  job_id: string;
  saved_at: string;
  notes: string | null;
}

export interface JobInvite {
  id: string;
  job_id: string;
  guard_id: string;
  client_id: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
  responded_at: string | null;
  message: string | null;
}

export interface SavedSite {
  id: string;
  client_id: string;
  site_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  access_instructions: string | null;
  parking_details: string | null;
  risk_notes: string | null;
  created_at: string;
  updated_at: string | null;
  status: 'active' | 'inactive';
}

export interface ActivityLogEntry {
  id: string;
  client_id: string;
  action_type: string;
  action_description: string;
  category: string;
  related_job_id: string | null;
  related_payment_id: string | null;
  related_ticket_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  job_title?: string | null;
}

export interface ClientContact {
  id: string;
  client_id: string;
  contact_type: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  is_default: boolean;
  created_at: string;
}

export interface ClientDocument {
  id: string;
  client_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  expiry_date: string | null;
  created_at: string;
}

export interface SubscriptionInfo {
  id: string;
  user_id: string;
  plan_name: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end_date: string | null;
  billing_cycle: string | null;
  amount_paid: number;
  payment_status: string;
  stripe_subscription_id: string;
  next_payment_date: string | null;
}

export interface NotificationPrefs {
  new_applicants: boolean;
  guard_confirmations: boolean;
  payment_updates: boolean;
  job_reminders: boolean;
  support_tickets: boolean;
  messages: boolean;
  in_app_alerts: boolean;
  sms_notifications: boolean;
  email_frequency: string;
}

export interface JobDraft {
  id: string;
  client_id: string;
  draft_name: string;
  form_data: Record<string, unknown>;
  last_saved_at: string;
  created_at: string;
}

export interface JobTemplate {
  id: string;
  client_id: string;
  template_name: string;
  job_title: string;
  security_type: string;
  number_of_guards: number;
  hourly_rate: string;
  venue: string;
  city: string;
  postcode: string;
  job_description: string;
  uniform_required: string;
  uniform_details: string;
  sia_licence_required: string;
  specific_licences: string[];
  experience_level: string;
  dress_code: string;
  special_instructions: string;
  additional_requirements: string;
  urgency: string;
  start_time: string;
  end_time: string;
  number_of_days: string;
  address_line1: string;
  address_line2: string;
  use_count: number;
  created_at: string;
}

export interface JobStat {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  pending_payments: number;
}

export interface PipelineData {
  draftCount: number;
  postedCount: number;
  applicationsCount: number;
  selectedCount: number;
  paymentPendingCount: number;
  activeCount: number;
  completedCount: number;
}

export interface BusinessData {
  activeJobs: number;
  totalGuardsHired: number;
  totalSpendThisMonth: number;
  averageFillTime: number;
  completedThisMonth: number;
}

export interface SafetyCounts {
  missingSafetyInfo: number;
  highRiskJobs: number;
  complianceWarnings: number;
  missingEmergencyContacts: number;
}

export interface ActionData {
  guardsAwaitingReview: number;
  jobsAwaitingPayment: number;
  jobsStartingSoon: number;
  unreadMessages: number;
  expiringLicences: number;
  openTickets: number;
  urgentTickets: number;
  awaitingReplyTickets: number;
  pendingGuardConfirmations: number;
  failedPayments: number;
  guardsNotCheckedIn: number;
  lateGuards: number;
  noShows: number;
  jobsNeedingReplacement: number;
  emergencyReplacements: number;
  replacementRequestsOpen: number;
  replacementAwaitingApproval: number;
  replacementUnableToFill: number;
  cancellationRequestsOpen: number;
  refundRequestsPending: number;
  jobsUnderAdminReview: number;
  cancelledJobsThisMonth: number;
}

export interface RecommendedGuard {
  id: string;
  full_name: string;
  sia_licence_number: string | null;
  rating: number | null;
  total_reviews: number;
  years_experience: number | null;
  location: string | null;
  profile_image_url: string | null;
}

export interface DashboardData {
  client: Client;
  subscription: SubscriptionInfo | null;
  stats: JobStat;
  actionData: ActionData;
  recentJobs: RecentJobSummary[];
  pipelineData: PipelineData;
  businessData: BusinessData;
  recommendedGuards: RecommendedGuard[];
  safetyCounts: SafetyCounts;
}

export interface RecentJobSummary {
  id: string;
  job_title: string;
  venue_city: string | null;
  postcode: string | null;
  start_date: string;
  status: string;
  payment_status: string | null;
  agreed_amount: number | null;
  applications_count: number;
  assigned_count: number;
  needs_payment: boolean;
  needs_review: boolean;
  reviewed_count: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'dateRange' | 'search';
  options?: FilterOption[];
  placeholder?: string;
  icon?: string;
}