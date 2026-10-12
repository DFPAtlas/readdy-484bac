import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { listAccountStorageFiles, removeAccountStorageFiles } from "./storage-cleanup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { user_id, user_type, reason, dry_run } = await req.json();

    if (typeof user_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id) || typeof reason !== "string" || !reason.trim() || reason.length > 500 || typeof dry_run !== "boolean") {
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
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
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

    if (adminError || !adminUser || !adminUser.is_active || adminUser.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Only active super_admin users can delete accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetRecord: any = null;
    let targetUserId = user_id;

    if (user_type === "guard") {
      const { data, error } = await adminClient
        .from("guards")
        .select("id, user_id, email, full_name, profile_image_url, sia_licence_number")
        .eq("id", user_id)
        .maybeSingle();
      if (error) throw new Error(`Cannot load account: ${error.message}`);
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Guard not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetRecord = data;
      targetUserId = data.user_id || user_id;
    } else {
      const { data, error } = await adminClient
        .from("clients")
        .select("id, user_id, email, contact_name, company_name, logo_url")
        .eq("id", user_id)
        .maybeSingle();
      if (error) throw new Error(`Cannot load account: ${error.message}`);
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Client not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetRecord = data;
      targetUserId = data.user_id || user_id;
    }

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

    if (adminCountError || targetAdminError) throw new Error("Cannot verify administrator protections");

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
      { table: "job_applications", column: "guard_id" },
      { table: "job_matches", column: "guard_id" },
      { table: "job_invites", column: "guard_id" },
      { table: "saved_jobs", column: "guard_id" },
      { table: "job_completion_requests", column: "guard_id" },
      { table: "reviews", column: "guard_id" },
      { table: "client_reviews", column: "guard_id" },
      { table: "messages", column: "sender_id" },
      { table: "messages", column: "receiver_id" },
      { table: "notifications", column: "user_id" },
      { table: "notification_preferences", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "support_tickets", column: "guard_id" },
      { table: "sia_verifications", column: "guard_id" },
      { table: "sia_verifications", column: "user_id" },
      { table: "client_favorites", column: "guard_id" },
      { table: "client_responses", column: "guard_id" },
      { table: "announcement_reads", column: "user_id" },
      { table: "consent_records", column: "user_id" },
      { table: "tax_disclaimers_accepted", column: "user_id" },
      { table: "user_entitlements", column: "user_id" },
    ];

    const clientTablesToDelete = [
      { table: "job_invites", column: "client_id" },
      { table: "job_completion_requests", column: "client_id" },
      { table: "client_activity_log", column: "client_id" },
      { table: "client_contacts", column: "client_id" },
      { table: "client_favorites", column: "client_id" },
      { table: "client_responses", column: "client_id" },
      { table: "reviews", column: "client_id" },
      { table: "client_reviews", column: "client_id" },
      { table: "messages", column: "sender_id" },
      { table: "messages", column: "receiver_id" },
      { table: "notifications", column: "user_id" },
      { table: "notification_preferences", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "support_tickets", column: "client_id" },
      { table: "announcement_reads", column: "user_id" },
      { table: "consent_records", column: "user_id" },
      { table: "tax_disclaimers_accepted", column: "user_id" },
      { table: "user_entitlements", column: "user_id" },
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
      { table: "subscriptions", column: "user_id" },
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
      // These legacy public tables also have foreign keys into app profiles.
      { table: "payment_audit_logs", column: roleColumn, schema: "public" },
      { table: "payment_fee_breakdowns", column: roleColumn, schema: "public" },
    ];
    for (const entry of retainedChecks) {
      const id = entry.column === "user_id" || ('userId' in entry && entry.userId) ? targetUserId : targetRecord.id;
      const schema = 'schema' in entry ? entry.schema as string : 'app';
      const count = await countRows(entry.table, entry.column, id, schema);
      if (count > 0) summary.retainedRecords.push({ table: `${schema}.${entry.table} (${entry.column})`, rowCount: count });
    }
    const retentionReviewRequired = summary.retainedRecords.length > 0;
    const userCount = await countRows("users", "id", targetUserId);
    if (userCount > 0) { summary.tables.push({ name: "users", rowCount: userCount }); summary.totalRows += userCount; }
    summary.tables.push({ name: user_type === "guard" ? "guards" : "clients", rowCount: 1 });
    summary.totalRows += 1;

    const storagePaths = [targetRecord.id, targetUserId];
    const buckets = user_type === "client"
      ? ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences", "quickguard-email-assets"]
      : ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences"];
    summary.storageFiles = await listAccountStorageFiles(adminClient, buckets, storagePaths);
    summary.totalFiles = summary.storageFiles.length;
    const auditId = crypto.randomUUID();
    const auditTable = adminClient.schema("public").from("admin_deletion_audit_log");
    // Establish the audit before destructive work. A crash leaves a non-success
    // record instead of an unaudited, falsely completed deletion.
    const { error: auditError } = await auditTable.insert({
      id: auditId, admin_user_id: adminUser.user_id, target_user_id: targetUserId,
      target_type: user_type, reason: reason.trim(), dry_run: isDryRun,
      status: isDryRun ? "dry_run" : "failed", ip_address: clientIp, user_agent: clientUa,
      retained_records: Object.fromEntries(summary.retainedRecords.map(row => [row.table, row.rowCount])),
      failed_items: isDryRun ? [] : ["Deletion has not completed"],
    });
    if (auditError) throw new Error(`Cannot write deletion audit: ${auditError.message}`);

    if (isDryRun) {
      return new Response(JSON.stringify({ success: true, dry_run: true, summary: { ...summary, financialRowsAnonymised: [] }, retentionReviewRequired }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (retentionReviewRequired) {
      const message = "Account has booking, financial or review records. Retention review is required before erasure; no account data or files were deleted.";
      const { error } = await adminClient.schema("public").from("admin_deletion_audit_log")
        .update({ failed_items: [message] }).eq("id", auditId);
      if (error) throw new Error(`Cannot record retention block: ${error.message}`);
      return new Response(JSON.stringify({ success: false, error: message, retentionReviewRequired: true, summary }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const failedItems: string[] = [];
    const deletedTables: string[] = [];
    const deletionResult: Record<string, number> = {};
    let deletedFiles: string[] = [];
    let authAction = "none";
    try {
      // Leave account/profile anchors intact on Storage failure so it can be retried.
      deletedFiles = await removeAccountStorageFiles(adminClient, summary.storageFiles, async (progress) => {
        deletedFiles = [...progress];
        const { error } = await adminClient.schema("public").from("admin_deletion_audit_log")
          .update({ deleted_storage_files: progress, status: "partial" }).eq("id", auditId);
        if (error) throw new Error(`Cannot record storage cleanup progress: ${error.message}`);
      });
      const remaining = await listAccountStorageFiles(adminClient, buckets, storagePaths);
      if (remaining.length) throw new Error("Storage cleanup incomplete; account remains available for retry");
      for (const entry of tablesToDelete) {
        const idToUse = ["sender_id", "receiver_id", "user_id"].includes(entry.column) ? targetUserId : targetRecord.id;
        const { error } = await adminClient.from(entry.table).delete().eq(entry.column, idToUse);
        if (error) throw new Error(`Cannot delete ${entry.table}: ${error.message}`);
        deletedTables.push(entry.table);
        deletionResult[entry.table] = summary.tables.find(row => row.name === entry.table)?.rowCount || 0;
      }
      const { data: authUser, error: authLookupError } = await adminClient.auth.admin.getUserById(targetUserId);
      if (authLookupError && authLookupError.status !== 404 && authLookupError.code !== "user_not_found") throw new Error(`Cannot inspect Auth account: ${authLookupError.message}`);
      if (authUser?.user) {
        const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (error) throw new Error(`Cannot delete Auth account: ${error.message}`);
        authAction = "deleted";
      }
      // Auth deletion may cascade the profile. Explicit deletion also covers
      // legacy profiles whose user_id is missing. Check every returned error.
      for (const entry of [
        { table: user_type === "guard" ? "guards" : "clients", id: targetRecord.id },
        { table: "users", id: targetUserId },
      ]) {
        const { error } = await adminClient.from(entry.table).delete().eq("id", entry.id);
        if (error) throw new Error(`Cannot delete ${entry.table}: ${error.message}`);
        deletedTables.push(entry.table);
        deletionResult[entry.table] = summary.tables.find(row => row.name === entry.table)?.rowCount || 0;
      }
    } catch (error: any) {
      failedItems.push(error.message || "Deletion failed");
    }

    const finalStatus = failedItems.length > 0 ? "partial" : "completed";

    const { error: finalAuditError } = await adminClient.schema("public").from("admin_deletion_audit_log").update({
      deleted_tables: deletionResult, deleted_storage_files: deletedFiles,
      failed_items: failedItems, status: finalStatus,
    }).eq("id", auditId);
    if (finalAuditError) failedItems.push(`Cannot finalise deletion audit: ${finalAuditError.message}`);

    return new Response(
      JSON.stringify({
        success: failedItems.length === 0,
        status: failedItems.length ? "partial" : "completed",
        deleted_tables: deletedTables,
        deleted_files: deletedFiles,
        retained_records: summary.retainedRecords,
        auth_action: authAction,
        failed_items: failedItems.length > 0 ? failedItems : undefined,
      }),
      { status: failedItems.length ? 409 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
