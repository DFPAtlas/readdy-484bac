import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { listAccountStorageFiles, removeAccountStorageFiles, assertAccountStorageReferences } from "./storage-cleanup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function readRequest(req: Request): Promise<any> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) throw new Error("Request body too large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("Invalid request");
    return body;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function getAal(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.match(/^Bearer ([^\s]+)$/i);
    if (!bearer) return new Response(JSON.stringify({ error: "Not authenticated" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = bearer[1];
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const clientUa = req.headers.get("user-agent") || null;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      db: { schema: "app" },
    });

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (getAal(token) !== "aal2") {
      return new Response(
        JSON.stringify({ error: "Multi-factor authentication required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: adminUser, error: adminError } = await adminClient
      .from("admin_users")
      .select("id, role, is_active, full_name, email, user_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (adminError || !adminUser || adminUser.user_id !== caller.id || adminUser.is_active !== true || adminUser.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Only active super_admin users can delete accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any;
    try { body = await readRequest(req); }
    catch { return new Response(JSON.stringify({ error: "Invalid or oversized request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const { user_id, user_type, reason, dry_run, confirmation, expected_user_id } = body;

    if (typeof user_id !== "string" || !UUID.test(user_id) || typeof reason !== "string" || !reason.trim() || reason.length > 500 || typeof dry_run !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Valid user_id, reason (1–500 characters) and explicit dry_run are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["guard", "client"].includes(user_type)) {
      return new Response(
        JSON.stringify({ error: "user_type must be 'guard' or 'client'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDryRun = dry_run === true;
    if (!isDryRun && confirmation !== (user_type === "guard" ? "DELETE GUARD" : "DELETE CLIENT")) {
      return new Response(JSON.stringify({ error: "Explicit account deletion confirmation required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const profileTable = user_type === "guard" ? "guards" : "clients";
    const profileColumns = user_type === "guard"
      ? "id, user_id, profile_image_url, profile_image_path, sia_licence_front_url, sia_licence_back_url, sia_licence_front_path, sia_licence_back_path, sia_supporting_document_path, sia_licence_photo_url, driving_licence_front_url, driving_licence_back_url, proof_of_address_url, stripe_account_id, stripe_customer_id, stripe_subscription_id, stripe_session_id"
      : "id, user_id, logo_url, stripe_customer_id, stripe_subscription_id, stripe_session_id, payment_method_id";

    const { data: targetRecord, error: targetError } = await adminClient.from(profileTable)
      .select(profileColumns).eq("id", user_id).maybeSingle();
    if (targetError) throw new Error("Cannot load account");
    if (!targetRecord) return new Response(JSON.stringify({ error: "Account profile not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const targetUserId = targetRecord.user_id;

    if (targetRecord.id !== user_id || typeof targetUserId !== "string" || !UUID.test(targetUserId)) {
      throw new Error("Cannot verify profile to Auth binding");
    }
    if (!isDryRun && expected_user_id !== targetUserId) return new Response(JSON.stringify({ error: "Account identity differs from the impact check. Check impact again before deleting." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    async function authExists(): Promise<boolean> {
      const { data, error } = await adminClient.auth.admin.getUserById(targetUserId);
      if (error) {
        if (error.status === 404 || error.code === "user_not_found") return false;
        throw new Error("Cannot inspect Auth account");
      }
      if (!data?.user || data.user.id !== targetUserId) throw new Error("Cannot verify Auth identity");
      return true;
    }
    await authExists();

    if (adminUser.user_id === targetUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { count: superAdminCount, error: adminCountError } = await adminClient
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("is_active", true);

    const { data: targetAdmin, error: targetAdminError } = await adminClient
      .from("admin_users")
      .select("id, role")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (adminCountError || superAdminCount == null || targetAdminError) throw new Error("Cannot verify administrator protections");

    if (targetAdmin && targetAdmin.role === "super_admin" && (superAdminCount || 0) <= 1) {
      return new Response(
        JSON.stringify({ error: "Cannot delete the last active super_admin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetAdmin) return new Response(JSON.stringify({ error: "Accounts with administrator access require a separate reviewed deletion" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { count: otherProfiles, error: otherProfileError } = await adminClient
      .from(user_type === "guard" ? "clients" : "guards").select("id", { count: "exact", head: true }).eq("user_id", targetUserId);
    if (otherProfileError || otherProfiles == null) throw new Error("Cannot inspect linked account profiles");
    if (otherProfiles > 0) return new Response(JSON.stringify({ error: "Account has another role profile. Review both roles before deleting shared documents or Auth access." }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const summary: {
      tables: { name: string; rowCount: number }[];
      storageFiles: string[];
      retainedRecords: { table: string; rowCount: number }[];
      totalRows: number;
      totalFiles: number;
    } = { tables: [], storageFiles: [], retainedRecords: [], totalRows: 0, totalFiles: 0 };

    async function countRows(table: string, column: string, value: string, schema = "app"): Promise<number> {
      const { count, error } = await adminClient.schema(schema).from(table).select("*", { count: "exact", head: true }).eq(column, value);
      if (error || count == null) throw new Error(`Cannot inspect ${schema}.${table}: ${error?.message || 'missing count'}`);
      return count;
    }

    const guardTablesToDelete = [
      { table: "guard_bank_details", column: "guard_id" },
      { table: "job_matches", column: "guard_id" },
      { table: "saved_jobs", column: "guard_id" },
      { table: "messages", column: "sender_id" },
      { table: "messages", column: "receiver_id" },
      { table: "notifications", column: "user_id" },
      { table: "notification_preferences", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "sia_verifications", column: "guard_id" },
      { table: "sia_verifications", column: "user_id" },
      { table: "client_favorites", column: "guard_id" },
      { table: "announcement_reads", column: "user_id" },
      { table: "consent_records", column: "user_id" },
      { table: "tax_disclaimers_accepted", column: "user_id" },
      { table: "user_entitlements_data", column: "user_id" },
    ];

    const clientTablesToDelete = [
      { table: "client_contacts", column: "client_id" },
      { table: "client_favorites", column: "client_id" },
      { table: "messages", column: "sender_id" },
      { table: "messages", column: "receiver_id" },
      { table: "notifications", column: "user_id" },
      { table: "notification_preferences", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "announcement_reads", column: "user_id" },
      { table: "consent_records", column: "user_id" },
      { table: "tax_disclaimers_accepted", column: "user_id" },
      { table: "user_entitlements_data", column: "user_id" },
    ];

    const tablesToDelete = user_type === "guard" ? guardTablesToDelete : clientTablesToDelete;

    for (const entry of tablesToDelete) {
      const idToUse = ["sender_id", "receiver_id", "user_id"].includes(entry.column) ? targetUserId : targetRecord.id;
      const cnt = await countRows(entry.table, entry.column, idToUse);
      if (cnt > 0) {
        summary.tables.push({ name: entry.table, rowCount: cnt });
        summary.totalRows += cnt;
      }
    }

    // The old flow deleted ledgers/cascaded jobs and tried to update columns
    // that do not exist. Do not erase accounts with retention evidence until
    // an explicit financial/legal retention workflow can preserve it.
    const roleColumn = user_type === "guard" ? "guard_id" : "client_id";
    const retainedChecks = [
      { table: "account_closures", column: "user_id" },
      // Auth deletion cascades these records; preserve review/reward evidence.
      { table: "privacy_requests", column: "user_id" },
      { table: "qg_token_ledger", column: "user_id" },
      { table: "qg_token_redemptions", column: "user_id" },
      { table: "qg_referral_codes", column: "owner_user_id", userId: true },
      { table: "client_activity_log", column: "user_id" },
      { table: "subscriptions", column: "user_id" },
      ...(user_type === "client" ? [{ table: "subscriptions", column: "client_id" }] : []),
      ...["job_invites", "job_completion_requests", "reviews", "client_reviews", "support_tickets", "client_responses"].map(table => ({ table, column: roleColumn })),
      ...(user_type === "guard" ? [{ table: "job_applications", column: "guard_id" }] : [{ table: "client_activity_log", column: "client_id" }]),
      { table: "subscription_payments", column: "user_id" },
      { table: "transactions", column: "user_id" },
      { table: "transactions", column: roleColumn },
      { table: "payment_events", column: "user_id" },
      { table: "payment_audit_logs", column: roleColumn },
      { table: "disputes", column: roleColumn },
      ...(user_type === "guard" ? [
        { table: "guard_payouts", column: "guard_id" },
        { table: "guard_bank_payouts", column: "guard_id" },
        { table: "job_assignments", column: "guard_id" },
        { table: "incidents", column: "guard_id" },
        { table: "company_staff", column: "guard_id" },
        { table: "rotas", column: "guard_id" },
        { table: "training_records", column: "guard_id" },
        { table: "replacement_requests", column: "guard_id" },
      ] : [
        { table: "payment_fee_breakdowns", column: "client_id" },
        { table: "jobs", column: "client_id" },
        { table: "refund_requests", column: "client_id" },
        { table: "replacement_requests", column: "client_id" },
        { table: "job_safety_checks", column: "client_id" },
        { table: "job_drafts", column: "client_id" },
        { table: "job_templates", column: "client_id" },
        { table: "client_documents", column: "client_id" },
      ]),
      { table: "complaints", column: "filed_by_id", userId: true },
      { table: "complaints", column: "filed_against_id", userId: true },
    ];
    function providerBindings(record: any): number {
      return ["stripe_customer_id", "stripe_subscription_id", "stripe_account_id", "stripe_session_id", "payment_method_id"]
        .filter(key => record[key] != null && record[key] !== "").length;
    }
    async function retainedEvidence(record: any) {
      const retained: { table: string; rowCount: number }[] = [];
      for (const entry of retainedChecks) {
        const id = entry.column === "user_id" || ('userId' in entry && entry.userId) ? targetUserId : targetRecord.id;
        const count = await countRows(entry.table, entry.column, id);
        if (count > 0) retained.push({ table: `app.${entry.table} (${entry.column})`, rowCount: count });
      }
      const bindings = providerBindings(record);
      if (bindings) retained.push({ table: "Billing provider bindings (manual review)", rowCount: bindings });
      const { data: appUser, error: appUserError } = await adminClient.from("users")
        .select("id, stripe_customer_id, stripe_subscription_id, stripe_session_id, profile_photo_url").eq("id", targetUserId).maybeSingle();
      if (appUserError || (appUser && appUser.id !== targetUserId)) throw new Error("Cannot inspect user billing binding");
      const userBindings = appUser ? providerBindings(appUser) : 0;
      if (userBindings) retained.push({ table: "User billing bindings (manual review)", rowCount: userBindings });
      if (appUser) assertAccountStorageReferences(appUser, [user_id, targetUserId], "profile");
      const { data: entitlement, error } = await adminClient.from("user_entitlements_data")
        .select("user_id, stripe_subscription_id").eq("user_id", targetUserId).maybeSingle();
      if (error || (entitlement && entitlement.user_id !== targetUserId)) throw new Error("Cannot inspect entitlement binding");
      if (entitlement?.stripe_subscription_id) retained.push({ table: "Entitlement billing binding (manual review)", rowCount: 1 });
      return retained;
    }
    async function assertEligible() {
      const { data: current, error } = await adminClient.from(profileTable).select(profileColumns).eq("id", user_id).maybeSingle();
      if (error || !current || current.id !== user_id || current.user_id !== targetUserId) throw new Error("Account binding changed; manual review required");
      if (await countRows(profileTable, "user_id", targetUserId) !== 1 ||
          await countRows(user_type === "guard" ? "clients" : "guards", "user_id", targetUserId) !== 0 ||
          await countRows("admin_users", "user_id", targetUserId) !== 0) throw new Error("Linked account access changed; manual review required");
      const { data: currentAdmin, error: currentAdminError } = await adminClient.from("admin_users")
        .select("user_id, role, is_active").eq("user_id", caller.id).maybeSingle();
      if (currentAdminError || currentAdmin?.user_id !== caller.id || currentAdmin?.role !== "super_admin" || currentAdmin?.is_active !== true) throw new Error("Administrator access changed");
      const retained = await retainedEvidence(current);
      if (retained.length) throw new Error("Account now requires retention review; cleanup stopped");
      assertAccountStorageReferences(current, [user_id, targetUserId], "profile");
      assertAccountStorageReferences(current, [user_id, targetUserId], "documents");
      await authExists();
    }
    if (await countRows(profileTable, "user_id", targetUserId) !== 1) throw new Error("Cannot verify unique profile binding");
    summary.retainedRecords = await retainedEvidence(targetRecord);
    const retentionReviewRequired = summary.retainedRecords.length > 0;
    const userCount = await countRows("users", "id", targetUserId);
    if (userCount > 0) { summary.tables.push({ name: "users", rowCount: userCount }); summary.totalRows += userCount; }
    summary.tables.push({ name: user_type === "guard" ? "guards" : "clients", rowCount: 1 });
    summary.totalRows += 1;

    const storagePaths = [targetRecord.id, targetUserId];
    assertAccountStorageReferences(targetRecord, storagePaths, "profile");
    assertAccountStorageReferences(targetRecord, storagePaths, "documents");
    const buckets = user_type === "client"
      ? ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences", "quickguard-email-assets", "client-files"]
      : ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences"];
    summary.storageFiles = await listAccountStorageFiles(adminClient, buckets, storagePaths);
    summary.totalFiles = summary.storageFiles.length;
    const auditId = crypto.randomUUID();
    const auditTable = adminClient.schema("public").from("admin_deletion_audit_log");
    // Establish the audit before destructive work. A crash leaves a non-success
    // record instead of an unaudited, falsely completed deletion.
    const { data: insertedAudit, error: auditError } = await auditTable.insert({
      id: auditId, admin_user_id: adminUser.user_id, target_user_id: targetUserId,
      target_type: user_type, reason: reason.trim(), dry_run: isDryRun,
      status: isDryRun ? "dry_run" : "failed", ip_address: clientIp, user_agent: clientUa,
      retained_records: Object.fromEntries(summary.retainedRecords.map(row => [row.table, row.rowCount])),
      failed_items: isDryRun ? [] : ["Deletion has not completed"],
    }).select("id, status").maybeSingle();
    if (auditError || insertedAudit?.id !== auditId || insertedAudit?.status !== (isDryRun ? "dry_run" : "failed")) throw new Error("Cannot confirm deletion audit");
    async function updateAudit(payload: Record<string, unknown>) {
      const { data, error } = await adminClient.schema("public").from("admin_deletion_audit_log")
        .update(payload).eq("id", auditId).select("id, status").maybeSingle();
      if (error || data?.id !== auditId || (payload.status != null && data.status !== payload.status)) throw new Error("Cannot confirm deletion audit update");
    }

    if (isDryRun) {
      return new Response(JSON.stringify({ success: true, audit_id: auditId, target_user_id: targetUserId, dry_run: true, summary: { ...summary, financialRowsAnonymised: [] }, retentionReviewRequired }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (retentionReviewRequired) {
      const message = "Account has operational, financial or billing-provider links. Retention review is required before erasure; no account data or files were deleted.";
      await updateAudit({ failed_items: [message] });
      return new Response(JSON.stringify({ success: false, audit_id: auditId, error: message, retentionReviewRequired: true, summary }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const failedItems: string[] = [];
    const deletedTables: string[] = [];
    const deletionResult: Record<string, number> = {};
    let deletedFiles: string[] = [];
    let authAction = "none";
    try {
      await assertEligible();
      // Leave account/profile anchors intact on Storage failure so it can be retried.
      deletedFiles = await removeAccountStorageFiles(adminClient, summary.storageFiles, async (progress) => {
        deletedFiles = [...progress];
        await updateAudit({ deleted_storage_files: progress, status: "partial" });
      }, assertEligible);
      const remaining = await listAccountStorageFiles(adminClient, buckets, storagePaths);
      if (remaining.length) throw new Error("Storage cleanup incomplete; account remains available for retry");
      await assertEligible();
      for (const entry of tablesToDelete) {
        const idToUse = ["sender_id", "receiver_id", "user_id"].includes(entry.column) ? targetUserId : targetRecord.id;
        const { error } = await adminClient.from(entry.table).delete().eq(entry.column, idToUse);
        if (error) throw new Error(`Cannot delete ${entry.table}`);
        if (await countRows(entry.table, entry.column, idToUse) !== 0) throw new Error(`Cannot confirm ${entry.table} deletion`);
        deletedTables.push(entry.table);
        deletionResult[entry.table] = summary.tables.find(row => row.name === entry.table)?.rowCount || 0;
      }
      await assertEligible();
      if ((await listAccountStorageFiles(adminClient, buckets, storagePaths)).length) throw new Error("Storage changed during cleanup; review required");
      if (await authExists()) {
        const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (error) throw new Error("Cannot delete Auth account");
        if (await authExists()) throw new Error("Cannot confirm Auth deletion");
        authAction = "deleted";
      } else authAction = "already_absent";
      // Auth deletion may cascade the profile. Explicit deletion also covers
      // legacy profiles with a verified binding. Check absence after every call.
      for (const entry of [
        { table: user_type === "guard" ? "guards" : "clients", id: targetRecord.id },
        { table: "users", id: targetUserId },
      ]) {
        let deletion = adminClient.from(entry.table).delete().eq("id", entry.id);
        if (entry.table === profileTable) deletion = deletion.eq("user_id", targetUserId);
        const { error } = await deletion;
        if (error) throw new Error(`Cannot delete ${entry.table}`);
        if (await countRows(entry.table, "id", entry.id) !== 0) throw new Error(`Cannot confirm ${entry.table} deletion`);
        deletedTables.push(entry.table);
        deletionResult[entry.table] = summary.tables.find(row => row.name === entry.table)?.rowCount || 0;
      }
      // Recheck the remaining personal rows/files after profile/Auth cleanup too.
      for (const entry of tablesToDelete) {
        const id = ["sender_id", "receiver_id", "user_id"].includes(entry.column) ? targetUserId : user_id;
        if (await countRows(entry.table, entry.column, id) !== 0) throw new Error("Personal records changed during cleanup; review required");
      }
      if ((await listAccountStorageFiles(adminClient, buckets, storagePaths)).length) throw new Error("Files remain after account cleanup; review required");
    } catch (error: any) {
      failedItems.push(error.message || "Deletion failed");
    }

    const finalStatus = failedItems.length > 0 ? "partial" : "completed";

    try {
      await updateAudit({ deleted_tables: deletionResult, deleted_storage_files: deletedFiles,
        failed_items: failedItems, status: finalStatus });
    } catch { failedItems.push("Cannot confirm final deletion audit; manual review required"); }

    return new Response(
      JSON.stringify({
        success: failedItems.length === 0,
        audit_id: auditId,
        status: failedItems.length ? "partial" : "completed",
        deleted_tables: deletedTables,
        deleted_files: deletedFiles,
        retained_records: summary.retainedRecords,
        auth_action: authAction,
        failed_items: failedItems.length > 0 ? failedItems : undefined,
      }),
      { status: failedItems.length ? 409 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Account deletion could not be verified. Review the account and audit before retrying." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
