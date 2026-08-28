import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

  try {
    const { user_id, user_type, reason, dry_run } = await req.json();

    if (!user_id || !user_type || !reason) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, user_type, reason" }),
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

    const { data: adminUser } = await adminClient
      .from("admin_users")
      .select("id, role, is_active, full_name, email, user_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!adminUser || !adminUser.is_active || adminUser.role !== "super_admin") {
      return new Response(
        JSON.stringify({ error: "Only active super_admin users can delete accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetRecord: any = null;
    let targetUserId = user_id;

    if (user_type === "guard") {
      const { data } = await adminClient
        .from("guards")
        .select("id, user_id, email, full_name, profile_image_url, sia_licence_number")
        .eq("id", user_id)
        .maybeSingle();
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Guard not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetRecord = data;
      targetUserId = data.user_id || user_id;
    } else {
      const { data } = await adminClient
        .from("clients")
        .select("id, user_id, email, contact_name, company_name, logo_url")
        .eq("id", user_id)
        .maybeSingle();
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

    const { count: superAdminCount } = await adminClient
      .from("admin_users")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("is_active", true);

    const { data: targetAdmin } = await adminClient
      .from("admin_users")
      .select("id, role")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetAdmin && targetAdmin.role === "super_admin" && (superAdminCount || 0) <= 1) {
      return new Response(
        JSON.stringify({ error: "Cannot delete the last active super_admin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const summary: {
      tables: { name: string; rowCount: number }[];
      storageFiles: string[];
      financialRowsAnonymised: { table: string; rowCount: number }[];
      totalRows: number;
      totalFiles: number;
    } = { tables: [], storageFiles: [], financialRowsAnonymised: [], totalRows: 0, totalFiles: 0 };

    async function countRows(table: string, column: string, value: string): Promise<number> {
      const { count } = await adminClient.from(table).select("*", { count: "exact", head: true }).eq(column, value);
      return count || 0;
    }

    async function listStorageFiles(bucket: string, searchPaths: string[]): Promise<string[]> {
      const files: string[] = [];
      for (const searchPath of searchPaths) {
        try {
          const { data } = await adminClient.storage.from(bucket).list(searchPath, { limit: 1000, offset: 0 });
          if (data) {
            for (const f of data) {
              const fullPath = searchPath ? `${searchPath}/${f.name}` : f.name;
              files.push(`${bucket}/${fullPath}`);
            }
          }
        } catch (_) {}
      }
      return files;
    }

    const guardTablesToDelete = [
      { table: "guard_bank_details", column: "guard_id" },
      { table: "guard_payouts", column: "guard_id" },
      { table: "job_applications", column: "guard_id" },
      { table: "job_assignments", column: "guard_id" },
      { table: "job_matches", column: "guard_id" },
      { table: "job_invites", column: "guard_id" },
      { table: "saved_jobs", column: "guard_id" },
      { table: "job_completion_requests", column: "guard_id" },
      { table: "job_completion_tasks", column: "guard_id" },
      { table: "reviews", column: "guard_id" },
      { table: "client_reviews", column: "guard_id" },
      { table: "messages", column: "sender_id" },
      { table: "messages", column: "receiver_id" },
      { table: "notifications", column: "user_id" },
      { table: "notification_preferences", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "support_tickets", column: "guard_id" },
      { table: "sia_verifications", column: "guard_id" },
      { table: "announcement_reads", column: "user_id" },
      { table: "consent_records", column: "user_id" },
      { table: "tax_disclaimers_accepted", column: "user_id" },
      { table: "user_entitlements", column: "user_id" },
      { table: "guards", column: "id" },
    ];

    const clientTablesToDelete = [
      { table: "job_applications", column: "client_id" },
      { table: "job_assignments", column: "client_id" },
      { table: "job_matches", column: "client_id" },
      { table: "job_invites", column: "client_id" },
      { table: "saved_jobs", column: "client_id" },
      { table: "job_completion_requests", column: "client_id" },
      { table: "job_completion_tasks", column: "client_id" },
      { table: "jobs", column: "client_id" },
      { table: "client_activity_log", column: "client_id" },
      { table: "client_contacts", column: "client_id" },
      { table: "client_documents", column: "client_id" },
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
      { table: "clients", column: "id" },
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

    const financialTables = [
      { table: "subscriptions", column: "user_id" },
      { table: "subscription_payments", column: "user_id" },
      { table: "transactions", column: "user_id" },
      { table: "transactions", column: user_type === "guard" ? "guard_id" : "client_id" },
      { table: "payment_events", column: "user_id" },
      { table: "payment_audit_logs", column: user_type === "guard" ? "guard_id" : "client_id" },
      { table: "payment_fee_breakdowns", column: user_type === "guard" ? "guard_id" : "client_id" },
    ];

    for (const entry of financialTables) {
      const idToUse = entry.column === "user_id" ? targetUserId : targetRecord.id;
      const cnt = await countRows(entry.table, entry.column, idToUse);
      if (cnt > 0) summary.financialRowsAnonymised.push({ table: entry.table, rowCount: cnt });
    }

    const { count: userCount } = await adminClient.from("users").select("*", { count: "exact", head: true }).eq("id", targetUserId);
    if (userCount && userCount > 0) {
      summary.tables.push({ name: "users", rowCount: userCount });
      summary.totalRows += userCount;
    }

    const storagePaths = [targetRecord.id, targetUserId];
    const buckets = user_type === "client"
      ? ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences", "quickguard-email-assets"]
      : ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences"];
    for (const bucket of buckets) {
      const files = await listStorageFiles(bucket, storagePaths);
      summary.storageFiles.push(...files);
    }
    summary.totalFiles = summary.storageFiles.length;

    if (isDryRun) {
      const auditEntry = {
        admin_user_id: adminUser.user_id,
        admin_username: adminUser.email || adminUser.full_name || "unknown",
        admin_name: adminUser.full_name || adminUser.email || "unknown",
        action_type: "delete_user_dry_run",
        action_description: `Dry run deletion of ${user_type} ${targetRecord.email || targetRecord.id}`,
        target_type: user_type,
        target_name: targetRecord.email || targetRecord.full_name || targetRecord.contact_name || "unknown",
        ip_address: clientIp,
        metadata: { user_id: targetRecord.id, target_user_id: targetUserId, reason, summary },
      };
      await adminClient.from("admin_activity_log").insert(auditEntry);

      await adminClient.from("admin_deletion_audit_log").insert({
        admin_user_id: adminUser.user_id,
        target_user_id: targetUserId,
        target_type: user_type,
        reason,
        dry_run: true,
        deleted_tables: summary.tables.reduce((acc: any, t) => { acc[t.name] = t.rowCount; return acc; }, {}),
        retained_records: summary.financialRowsAnonymised.reduce((acc: any, t) => { acc[t.table] = t.rowCount; return acc; }, {}),
        deleted_storage_files: summary.storageFiles,
        status: "dry_run",
        ip_address: clientIp,
        user_agent: clientUa,
      });

      return new Response(
        JSON.stringify({ success: true, dry_run: true, summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const failedItems: string[] = [];
    const deletedTables: string[] = [];
    const deletionResult: Record<string, number> = {};
    const retainedResult: Record<string, number> = {};

    for (const entry of tablesToDelete) {
      try {
        const idToUse = ["sender_id", "receiver_id", "user_id"].includes(entry.column) ? targetUserId : targetRecord.id;
        const { error } = await adminClient.from(entry.table).delete().eq(entry.column, idToUse);
        if (error) {
          failedItems.push(`${entry.table} (${entry.column}=${idToUse}): ${error.message}`);
        } else {
          deletedTables.push(entry.table);
          deletionResult[entry.table] = summary.tables.find((t) => t.name === entry.table)?.rowCount || 0;
        }
      } catch (e: any) {
        failedItems.push(`${entry.table}: ${e.message}`);
      }
    }

    try {
      await adminClient.from("users").delete().eq("id", targetUserId);
      deletedTables.push("users");
    } catch (e: any) {
      failedItems.push(`users: ${e.message}`);
    }

    const anonymisedEmail = `deleted-user-${targetUserId}@quickguard.local`;
    for (const entry of financialTables) {
      try {
        const idToUse = entry.column === "user_id" ? targetUserId : targetRecord.id;
        const { data: rows } = await adminClient.from(entry.table).select("id").eq(entry.column, idToUse);
        if (rows && rows.length > 0) {
          const updatePayload: any = { user_email_anonymised: anonymisedEmail };
          if (entry.table === "subscriptions") {
            updatePayload.status = "deleted";
            updatePayload.cancel_at_period_end = true;
          }
          await adminClient.from(entry.table).update(updatePayload).eq(entry.column, idToUse);
          retainedResult[entry.table] = rows.length;
        }
      } catch (e: any) {
        failedItems.push(`anonymise ${entry.table}: ${e.message}`);
      }
    }

    const deletedFiles: string[] = [];
    for (const filePath of summary.storageFiles) {
      try {
        const [bucket, ...pathParts] = filePath.split("/");
        const path = pathParts.join("/");
        const { error } = await adminClient.storage.from(bucket).remove([path]);
        if (error) failedItems.push(`storage ${filePath}: ${error.message}`);
        else deletedFiles.push(filePath);
      } catch (e: any) {
        failedItems.push(`storage ${filePath}: ${e.message}`);
      }
    }

    let authAction = "none";
    try {
      const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId);
      if (authUser && authUser.user) {
        try {
          await adminClient.auth.admin.deleteUser(targetUserId);
          authAction = "deleted";
        } catch {
          await adminClient.auth.admin.updateUserById(targetUserId, {
            email: anonymisedEmail,
            phone: "",
            user_metadata: { deleted: true, deleted_at: new Date().toISOString(), deleted_by: adminUser.user_id },
            ban_duration: "876600h",
          });
          authAction = "anonymised_and_banned";
        }
      }
    } catch (e: any) {
      failedItems.push(`auth user: ${e.message}`);
      authAction = "failed";
    }

    const finalStatus = failedItems.length > 0 ? "partial" : "completed";

    await adminClient.from("admin_activity_log").insert({
      admin_user_id: adminUser.user_id,
      admin_username: adminUser.email || adminUser.full_name || "unknown",
      admin_name: adminUser.full_name || adminUser.email || "unknown",
      action_type: "delete_user_permanent",
      action_description: `Permanently deleted ${user_type} account: ${targetRecord.email || targetRecord.id}. Reason: ${reason}`,
      target_type: user_type,
      target_name: targetRecord.email || targetRecord.full_name || targetRecord.contact_name || "unknown",
      ip_address: clientIp,
      metadata: {
        user_id: targetRecord.id,
        target_user_id: targetUserId,
        reason,
        deleted_tables: deletedTables,
        deleted_storage_files: deletedFiles,
        financial_anonymised: summary.financialRowsAnonymised,
        failed_items: failedItems,
        auth_action: authAction,
        admin_user_id: adminUser.user_id,
        user_agent: clientUa,
      },
    });

    await adminClient.from("admin_deletion_audit_log").insert({
      admin_user_id: adminUser.user_id,
      target_user_id: targetUserId,
      target_type: user_type,
      reason,
      dry_run: false,
      deleted_tables: deletionResult,
      deleted_storage_files: deletedFiles,
      retained_records: retainedResult,
      anonymised_records: retainedResult,
      failed_items: failedItems,
      status: finalStatus,
      ip_address: clientIp,
      user_agent: clientUa,
    });

    return new Response(
      JSON.stringify({
        success: true,
        status: finalStatus,
        deleted_tables: deletedTables,
        deleted_files: deletedFiles,
        financial_anonymised: summary.financialRowsAnonymised,
        auth_action: authAction,
        failed_items: failedItems.length > 0 ? failedItems : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
