import { supabase } from "./supabase";

export interface LogActivityParams {
  action_type: string;
  action_description: string;
  category?: string;
  related_job_id?: string | null;
  related_payment_id?: string | null;
  related_ticket_id?: string | null;
  related_guard_id?: string | null;
  related_site_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logClientActivity(params: LogActivityParams) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!client) return;

    await supabase.from("client_activity_log").insert({
      client_id: client.id,
      user_id: user.id,
      action_type: params.action_type,
      action_description: params.action_description,
      category: params.category || "account",
      related_job_id: params.related_job_id || null,
      related_payment_id: params.related_payment_id || null,
      related_ticket_id: params.related_ticket_id || null,
      related_guard_id: params.related_guard_id || null,
      related_site_id: params.related_site_id || null,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Failed to log client activity:", e);
  }
}

export const ACTIVITY_TYPES = {
  ACCOUNT_CREATED: "account_created",
  PROFILE_UPDATED: "profile_updated",
  JOB_CREATED: "job_created",
  JOB_EDITED: "job_edited",
  JOB_POSTED: "job_posted",
  APPLICANT_REVIEWED: "applicant_reviewed",
  APPLICANT_RECEIVED: "applicant_received",
  GUARD_SELECTED: "guard_selected",
  GUARD_CONFIRMED: "guard_confirmed",
  PAYMENT_MADE: "payment_made",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_REFUNDED: "payment_refunded",
  MESSAGE_SENT: "message_sent",
  TICKET_CREATED: "ticket_created",
  TICKET_UPDATED: "ticket_updated",
  CANCELLATION_REQUESTED: "cancellation_requested",
  JOB_CANCELLED: "job_cancelled",
  REFUND_REQUESTED: "refund_requested",
  DOCUMENT_UPLOADED: "document_uploaded",
  SITE_CREATED: "site_created",
  SITE_UPDATED: "site_updated",
  REVIEW_SUBMITTED: "review_submitted",
  CHECK_IN: "check_in",
  CHECK_OUT: "check_out",
  BOOKING_CONFIRMED: "booking_confirmed",
  JOB_COMPLETED: "job_completed",
  TERMS_ACCEPTED: "terms_accepted",
  COMPLAINT_RAISED: "complaint_raised",
  REPLACEMENT_REQUESTED: "replacement_requested",
  ENTITLEMENT_BLOCKED: "client_entitlement_blocked",
  PROTECTED_ROUTE_BLOCKED: "client_protected_route_blocked",
  UPGRADE_REDIRECTED: "client_upgrade_redirected",
  FEATURE_UNLOCKED: "client_feature_unlocked_after_upgrade",
  JOB_LIMIT_REACHED: "client_job_limit_reached",
  PLAN_VERIFICATION_FAILED: "client_plan_verification_failed",
} as const;

export const ACTIVITY_CATEGORIES = {
  ACCOUNT: "account",
  JOB: "job",
  APPLICANT: "applicant",
  GUARD: "guard",
  PAYMENT: "payment",
  MESSAGE: "message",
  SUPPORT: "support",
  CANCELLATION: "cancellation",
  REFUND: "refund",
  DOCUMENT: "document",
  SITE: "site",
  REVIEW: "review",
  ENTITLEMENT: "entitlement",
} as const;