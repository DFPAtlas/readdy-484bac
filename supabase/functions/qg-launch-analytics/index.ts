
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

  async function writeAuditLog(actorUserId: string | null, action: string, targetType: string) {
    await supabaseAdmin.from("qg_launch_reward_audit_log").insert({
      actor_user_id: actorUserId,
      actor_role: "admin",
      action,
      target_type: targetType,
    });
  }

  try {
    // ---- GET OVERVIEW ----
    if (action === "get_overview") {
      const { data: refs } = await supabaseAdmin.from("qg_referrals").select("status,approved_tokens,pending_tokens,tokens_redeemed,referred_role");

      const totalClicks = refs?.filter((r: any) => ["clicked", "profile_started", "account_created", "verified", "approved"].includes(r.status)).length || 0;
      const guardSignups = refs?.filter((r: any) => r.referred_role === "guard" && r.status !== "clicked").length || 0;
      const clientSignups = refs?.filter((r: any) => r.referred_role === "client" && r.status !== "clicked").length || 0;
      const verifiedGuards = refs?.filter((r: any) => r.referred_role === "guard" && ["verified", "approved"].includes(r.status)).length || 0;
      const verifiedClients = refs?.filter((r: any) => r.referred_role === "client" && ["verified", "approved"].includes(r.status)).length || 0;
      const pendingTokens = refs?.filter((r: any) => r.status === "verified").reduce((s: number, r: any) => s + (r.pending_tokens || 0), 0) || 0;
      const approvedTokens = refs?.filter((r: any) => r.status === "approved").reduce((s: number, r: any) => s + (r.approved_tokens || 0), 0) || 0;

      const { data: reds } = await supabaseAdmin.from("qg_token_redemptions").select("tokens_used,credit_pence,status");
      const redeemedTokens = reds?.filter((r: any) => r.status === "confirmed").reduce((s: number, r: any) => s + (r.tokens_used || 0), 0) || 0;
      const redeemedCredit = reds?.filter((r: any) => r.status === "confirmed").reduce((s: number, r: any) => s + (r.credit_pence || 0), 0) || 0;

      const liabilityPence = (approvedTokens / 100) * 1000;

      const { count: invitesSent } = await supabaseAdmin.from("qg_launch_invites").select("id", { count: "exact", head: true });
      const { count: inviteClicks } = await supabaseAdmin.from("qg_launch_invites").select("id", { count: "exact", head: true }).not("clicked_at", "is", null);
      const { count: campaignSignups } = await supabaseAdmin.from("qg_launch_invites").select("id", { count: "exact", head: true }).eq("status", "verified");
      const { count: fraudEvents } = await supabaseAdmin.from("qg_fraud_events").select("id", { count: "exact", head: true }).neq("review_status", "cleared");

      const verificationRate = (verifiedGuards + verifiedClients) / Math.max(totalClicks, 1) * 100;
      const inviteConversionRate = (campaignSignups || 0) / Math.max(invitesSent || 1, 1) * 100;

      return new Response(JSON.stringify({
        totalClicks, guardSignups, clientSignups, verifiedGuards, verifiedClients,
        pendingTokens, approvedTokens, redeemedTokens,
        liabilityPence, redeemedCredit,
        invitesSent, inviteClicks, campaignSignups, fraudEvents,
        verificationRate: verificationRate.toFixed(1),
        inviteConversionRate: inviteConversionRate.toFixed(1),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- GET DAILY STATS ----
    if (action === "get_daily_stats") {
      const days = body.days || 30;
      const { data } = await supabaseAdmin.from("qg_launch_reward_daily_stats").select("*").order("stat_date", { ascending: false }).limit(days);
      return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- GET FUNNEL ----
    if (action === "get_funnel") {
      const { data: refs } = await supabaseAdmin.from("qg_referrals").select("status");
      const clicked = refs?.filter((r: any) => r.status === "clicked").length || 0;
      const profileStarted = refs?.filter((r: any) => r.status === "profile_started").length || 0;
      const accountCreated = refs?.filter((r: any) => r.status === "account_created").length || 0;
      const verified = refs?.filter((r: any) => r.status === "verified").length || 0;
      const approved = refs?.filter((r: any) => r.status === "approved").length || 0;

      const { data: invs } = await supabaseAdmin.from("qg_launch_invites").select("status");
      const invSent = invs?.length || 0;
      const invClicked = invs?.filter((i: any) => i.status === "clicked" || i.status === "signed_up" || i.status === "verified").length || 0;
      const invSignedUp = invs?.filter((i: any) => i.status === "signed_up" || i.status === "verified").length || 0;
      const invVerified = invs?.filter((i: any) => i.status === "verified").length || 0;

      return new Response(JSON.stringify({
        referralFunnel: { clicked, profileStarted, accountCreated, verified, approved },
        inviteFunnel: { sent: invSent, clicked: invClicked, signedUp: invSignedUp, verified: invVerified },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- GET TOP REFERRERS ----
    if (action === "get_top_referrers") {
      const limit = body.limit || 20;
      const { data: refs } = await supabaseAdmin.from("qg_referrals").select("referrer_user_id,status,approved_tokens,referred_role").not("referrer_user_id", "is", null);

      const userMap: Record<string, any> = {};
      if (refs) {
        for (const r of refs) {
          if (!userMap[r.referrer_user_id]) {
            userMap[r.referrer_user_id] = { userId: r.referrer_user_id, total: 0, verified: 0, approvedTokens: 0 };
          }
          userMap[r.referrer_user_id].total++;
          if (["verified", "approved"].includes(r.status)) userMap[r.referrer_user_id].verified++;
          if (r.status === "approved") userMap[r.referrer_user_id].approvedTokens += (r.approved_tokens || 0);
        }
      }

      const top = Object.values(userMap).sort((a, b) => b.verified - a.verified).slice(0, limit);
      return new Response(JSON.stringify({ data: top }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- GET TOKEN LIABILITY ----
    if (action === "get_token_liability") {
      const { data: approved } = await supabaseAdmin.from("qg_token_ledger").select("tokens").eq("status", "approved");
      const totalApproved = approved?.reduce((s: number, r: any) => s + r.tokens, 0) || 0;
      const { data: redeemed } = await supabaseAdmin.from("qg_token_redemptions").select("tokens_used").eq("status", "confirmed");
      const totalRedeemed = redeemed?.reduce((s: number, r: any) => s + r.tokens_used, 0) || 0;
      const outstanding = totalApproved - totalRedeemed;

      return new Response(JSON.stringify({
        totalApproved,
        totalRedeemed,
        outstanding,
        liabilityPence: (outstanding / 100) * 1000,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- GET CAMPAIGN PERFORMANCE ----
    if (action === "get_campaign_performance") {
      const { data: campaigns } = await supabaseAdmin.from("qg_launch_campaigns").select("*").order("created_at", { ascending: false });
      return new Response(JSON.stringify({ data: campaigns || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- REFRESH DAILY STATS ----
    if (action === "refresh_daily_stats") {
      const targetDate = body.stat_date || new Date().toISOString().slice(0, 10);
      const { error } = await supabaseAdmin.rpc("refresh_qg_launch_reward_daily_stats", { target_date: targetDate });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (authUser) await writeAuditLog(authUser.id, "refresh_stats", "daily_stats");

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---- EXPORT CSV ----
    if (action === "export_report_csv") {
      if (!authUser) return new Response(JSON.stringify({ error: "Admin auth required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const exportType = body.export_type || "referrals";
      let csv = "";

      if (exportType === "referrals") {
        const { data } = await supabaseAdmin.from("qg_referrals").select("*").order("created_at", { ascending: false }).limit(1000);
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]).join(",");
          const rows = data.map((r: any) => Object.values(r).map((v: any) => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v !== null ? v : "").join(","));
          csv = [headers, ...rows].join("\n");
        }
      } else if (exportType === "invites") {
        const { data } = await supabaseAdmin.from("qg_launch_invites").select("*").order("created_at", { ascending: false }).limit(1000);
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]).join(",");
          const rows = data.map((r: any) => Object.values(r).map((v: any) => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v !== null ? v : "").join(","));
          csv = [headers, ...rows].join("\n");
        }
      } else if (exportType === "fraud") {
        const { data } = await supabaseAdmin.from("qg_fraud_events").select("*").order("created_at", { ascending: false }).limit(1000);
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]).filter(k => k !== "metadata").join(",");
          const rows = data.map((r: any) => {
            const { metadata, ...rest } = r;
            return Object.values(rest).map((v: any) => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v !== null ? v : "").join(",");
          });
          csv = [headers, ...rows].join("\n");
        }
      }

      await writeAuditLog(authUser.id, "export_csv", exportType);

      return new Response(JSON.stringify({ csv }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
