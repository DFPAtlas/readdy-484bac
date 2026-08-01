
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const action = body.action;
  if (!action) return new Response(JSON.stringify({ error: "action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "app" } });
  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { db: { schema: "app" } });

  let authUser: any = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    authUser = user;
  }

  const isServiceRole = req.headers.get("authorization")?.startsWith("Bearer eyJ") && !authUser;

  async function writeAuditLog(actorUserId: string | null, actorRole: string | null, action: string, targetType: string, targetId: string | null, beforeData?: any, afterData?: any) {
    await supabaseAdmin.from("qg_launch_reward_audit_log").insert({
      actor_user_id: actorUserId,
      actor_role: actorRole,
      action,
      target_type: targetType,
      target_id: targetId,
      before_data: beforeData || null,
      after_data: afterData || null,
    });
  }

  async function getRiskScore(referralId: string) {
    const { data } = await supabaseAdmin.rpc("calculate_qg_referral_risk_score", { referral_uuid: referralId });
    return data;
  }

  try {
    // ---- SCAN REFERRAL ----
    if (action === "scan_referral") {
      const refId = body.referral_id;
      if (!refId) return new Response(JSON.stringify({ error: "referral_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const risk = await getRiskScore(refId);
      if (!risk || risk.error) return new Response(JSON.stringify({ error: risk?.error || "Scan failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const existingFlag = risk.fraud_flags && Array.isArray(risk.fraud_flags) ? risk.fraud_flags : [];

      // Update referral fraud_flags
      if (existingFlag.length > 0) {
        await supabaseAdmin.from("qg_referrals").update({ fraud_flags: existingFlag, updated_at: new Date().toISOString() }).eq("id", refId);
      }

      // Upsert fraud event
      const { data: existingEvent } = await supabaseAdmin.from("qg_fraud_events").select("id").eq("referral_id", refId).eq("event_type", "risk_score").maybeSingle();

      if (existingEvent) {
        await supabaseAdmin.from("qg_fraud_events").update({
          score: risk.risk_score,
          severity: risk.risk_level,
          reason: existingFlag.join(", "),
          review_status: risk.risk_level === "low" ? "cleared" : "open",
          metadata: risk,
        }).eq("id", existingEvent.id);
      } else {
        await supabaseAdmin.from("qg_fraud_events").insert({
          referral_id: refId,
          event_type: "risk_score",
          severity: risk.risk_level,
          score: risk.risk_score,
          reason: existingFlag.join(", "),
          metadata: risk,
          review_status: risk.risk_level === "low" ? "cleared" : "open",
        });
      }

      // Auto-pause if configured
      const { data: settings } = await supabaseAdmin.from("qg_launch_reward_settings").select("key,value");
      const settingMap: Record<string, any> = {};
      if (settings) settings.forEach((s: any) => { try { settingMap[s.key] = typeof s.value === "string" ? JSON.parse(s.value) : s.value; } catch { settingMap[s.key] = s.value; } });

      if (settingMap.auto_pause_high_risk_referrals && risk.recommended_action === "pause_and_review") {
        await supabaseAdmin.from("qg_referrals").update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", refId);
      }

      if (authUser) await writeAuditLog(authUser.id, "admin", "scan_referral", "referral", refId, null, risk);

      return new Response(JSON.stringify({ success: true, risk }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- SCAN USER ----
    if (action === "scan_user") {
      const userId = body.user_id;
      if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: refs } = await supabaseAdmin.from("qg_referrals").select("id").eq("referrer_user_id", userId);
      const results: any[] = [];
      if (refs) {
        for (const r of refs) {
          const risk = await getRiskScore(r.id);
          if (risk && !risk.error) {
            results.push(risk);
            const existingFlag = risk.fraud_flags && Array.isArray(risk.fraud_flags) ? risk.fraud_flags : [];
            if (existingFlag.length > 0) {
              await supabaseAdmin.from("qg_referrals").update({ fraud_flags: existingFlag, updated_at: new Date().toISOString() }).eq("id", r.id);
            }
          }
        }
      }
      return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- SCAN PENDING REFERRALS ----
    if (action === "scan_pending_referrals") {
      const { data: pendingRefs } = await supabaseAdmin.from("qg_referrals").select("id").in("status", ["verified", "account_created", "profile_started"]);
      const results: any[] = [];
      if (pendingRefs) {
        for (const r of pendingRefs) {
          const risk = await getRiskScore(r.id);
          if (risk && !risk.error && risk.risk_level !== "low") {
            results.push(risk);
          }
        }
      }
      return new Response(JSON.stringify({ success: true, scanned: pendingRefs?.length || 0, flagged: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- CLEAR FRAUD EVENT ----
    if (action === "clear_fraud_event") {
      if (!authUser) return new Response(JSON.stringify({ error: "Admin auth required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const eventId = body.event_id;
      if (!eventId) return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: event } = await supabaseAdmin.from("qg_fraud_events").select("*").eq("id", eventId).maybeSingle();
      if (!event) return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await supabaseAdmin.from("qg_fraud_events").update({
        review_status: "cleared",
        reviewed_by: authUser.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", eventId);

      if (event.referral_id) {
        await supabaseAdmin.from("qg_referrals").update({ fraud_flags: null, updated_at: new Date().toISOString() }).eq("id", event.referral_id);
      }

      await writeAuditLog(authUser.id, "admin", "clear_fraud_event", "fraud_event", eventId);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- CONFIRM FRAUD EVENT ----
    if (action === "confirm_fraud_event") {
      if (!authUser) return new Response(JSON.stringify({ error: "Admin auth required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const eventId = body.event_id;
      if (!eventId) return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await supabaseAdmin.from("qg_fraud_events").update({
        review_status: "confirmed",
        reviewed_by: authUser.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", eventId);

      await writeAuditLog(authUser.id, "admin", "confirm_fraud_event", "fraud_event", eventId);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- IGNORE FRAUD EVENT ----
    if (action === "ignore_fraud_event") {
      if (!authUser) return new Response(JSON.stringify({ error: "Admin auth required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const eventId = body.event_id;
      if (!eventId) return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await supabaseAdmin.from("qg_fraud_events").update({
        review_status: "ignored",
        reviewed_by: authUser.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", eventId);

      await writeAuditLog(authUser.id, "admin", "ignore_fraud_event", "fraud_event", eventId);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
