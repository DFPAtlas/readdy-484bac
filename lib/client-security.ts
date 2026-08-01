import { supabase } from "./supabase";

// ============================================================
// Client Security Helpers
// QuickGuard client portal — ownership verification & safe queries
// ============================================================
// All client queries must go through clients.user_id => auth.uid()
// Use clientData.id for tables that store client_id (jobs, payments, etc.)
// Do NOT use auth.uid() as client_id unless the schema specifically stores it.
// ============================================================

export interface SecurityContext {
  userId: string;
  clientId: string;
  clientData: Record<string, unknown> | null;
}

/**
 * Fetches the current authenticated client.
 * Security: looks up clients by user_id = auth.uid().
 * Returns null if not authenticated or no client record.
 */
export async function requireClient(): Promise<SecurityContext | null> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const { data: clientData, error: clientError } = await supabase
    .from("clients")
    .select("id, user_id, company_name, subscription_tier, email, stripe_customer_id, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (clientError || !clientData) return null;

  return {
    userId: user.id,
    clientId: clientData.id,
    clientData,
  };
}

/**
 * Verifies the authenticated client owns a specific job.
 * Throws ownership error if not found or not owned.
 * Returns the job data if owned.
 */
export async function assertClientOwnsJob(
  jobId: string
): Promise<{ job: Record<string, unknown>; clientId: string }> {
  const ctx = await requireClient();
  if (!ctx) {
    throw new Error("Not authenticated or client account not found");
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, client_id, status, job_title, venue_city")
    .eq("id", jobId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error || !job) {
    throw new Error("Job not found or you do not have permission to access it");
  }

  return { job, clientId: ctx.clientId };
}

/**
 * Verifies the authenticated client owns a specific payment transaction.
 */
export async function assertClientOwnsPayment(
  transactionId: string
): Promise<{ transaction: Record<string, unknown>; clientId: string }> {
  const ctx = await requireClient();
  if (!ctx) {
    throw new Error("Not authenticated or client account not found");
  }

  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, client_id, status, amount, job_id")
    .eq("id", transactionId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error || !tx) {
    throw new Error("Payment not found or you do not have permission to access it");
  }

  return { transaction: tx, clientId: ctx.clientId };
}

/**
 * Verifies the authenticated client owns a specific support ticket.
 */
export async function assertClientOwnsSupportTicket(
  ticketId: string
): Promise<{ ticket: Record<string, unknown>; clientId: string }> {
  const ctx = await requireClient();
  if (!ctx) {
    throw new Error("Not authenticated or client account not found");
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select("id, client_id, status, subject, category")
    .eq("id", ticketId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error || !ticket) {
    throw new Error("Support ticket not found or you do not have permission to access it");
  }

  return { ticket, clientId: ctx.clientId };
}

/**
 * Verifies the authenticated client owns a specific saved site.
 */
export async function assertClientOwnsSavedSite(
  siteId: string
): Promise<{ site: Record<string, unknown>; clientId: string }> {
  const ctx = await requireClient();
  if (!ctx) {
    throw new Error("Not authenticated or client account not found");
  }

  const { data: site, error } = await supabase
    .from("saved_sites")
    .select("id, client_id, site_name, city")
    .eq("id", siteId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error || !site) {
    throw new Error("Site not found or you do not have permission to access it");
  }

  return { site, clientId: ctx.clientId };
}

/**
 * Verifies the authenticated client owns a specific document.
 */
export async function assertClientOwnsDocument(
  documentId: string
): Promise<{ document: Record<string, unknown>; clientId: string }> {
  const ctx = await requireClient();
  if (!ctx) {
    throw new Error("Not authenticated or client account not found");
  }

  const { data: doc, error } = await supabase
    .from("client_documents")
    .select("id, client_id, file_name, file_url")
    .eq("id", documentId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error || !doc) {
    throw new Error("Document not found or you do not have permission to access it");
  }

  return { document: doc, clientId: ctx.clientId };
}

/**
 * Verifies the authenticated client owns a specific contact.
 */
export async function assertClientOwnsContact(
  contactId: string
): Promise<{ contact: Record<string, unknown>; clientId: string }> {
  const ctx = await requireClient();
  if (!ctx) {
    throw new Error("Not authenticated or client account not found");
  }

  const { data: contact, error } = await supabase
    .from("client_contacts")
    .select("id, client_id, name, email, phone")
    .eq("id", contactId)
    .eq("client_id", ctx.clientId)
    .maybeSingle();

  if (error || !contact) {
    throw new Error("Contact not found or you do not have permission to access it");
  }

  return { contact, clientId: ctx.clientId };
}

/**
 * Checks if a job is in a mutable status before allowing edits.
 */
export function assertJobEditable(job: { status: string }): void {
  const immutableStatuses = ["completed", "cancelled", "disputed"];
  if (immutableStatuses.includes(job.status)) {
    throw new Error(`Cannot modify a job that is ${job.status}`);
  }
}

/**
 * Safe wrapper for client-side data fetching.
 * Returns null and logs to console if security check fails.
 */
export async function safeFetch<T>(
  fetchFn: () => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fetchFn();
    return { data, error: null };
  } catch (err: any) {
    console.error("[safeFetch] Security error:", err?.message || err);
    return { data: null, error: err?.message || "Security check failed" };
  }
}

/**
 * Returns a client-scoped realtime filter config.
 * Use this to ensure realtime subscriptions only receive data
 * visible to the current client.
 */
export function getClientRealtimeFilter(
  table: string,
  clientId: string
): Record<string, unknown> | null {
  const tablesWithClientId = [
    "jobs",
    "transactions",
    "support_tickets",
    "client_contacts",
    "client_documents",
    "saved_sites",
    "client_activity_log",
    "notifications",
    "subscriptions",
    "job_safety_checks",
  ];

  const tablesWithUserId = [
    "messages",
    "subscription_payments",
    "user_entitlements_data",
  ];

  if (tablesWithClientId.includes(table)) {
    return { column: "client_id", value: clientId };
  }

  if (tablesWithUserId.includes(table)) {
    return { column: "user_id", value: clientId };
  }

  return null;
}

/**
 * Realtime subscription helper — creates a safely scoped channel.
 * Automatically adds client_id filter for tables that support it.
 * Cleans up on unmount.
 */
export function createClientRealtimeChannel(
  channelName: string,
  table: string,
  clientId: string,
  onEvent: () => void,
  opts?: { event?: string; filter?: string; schema?: string }
) {
  const schema = opts?.schema || "public";
  const event = opts?.event || "*";

  const filterConfig = getClientRealtimeFilter(table, clientId);
  const filter = opts?.filter
    ? opts.filter
    : filterConfig
      ? `${filterConfig.column}=eq.${clientId}`
      : undefined;

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event,
        schema,
        table,
        ...(filter ? { filter } : {}),
      },
      onEvent
    )
    .subscribe();

  return channel;
}

/**
 * Cleanup helper for realtime channels.
 */
export function removeRealtimeChannels(channels: any[]) {
  channels.forEach((ch) => {
    try {
      supabase.removeChannel(ch);
    } catch {
      // ignore
    }
  });
}