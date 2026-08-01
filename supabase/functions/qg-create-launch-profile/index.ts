import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false },
        db: { schema: "app" },
      }
    );

    const body = await req.json();
    const {
      full_name,
      email,
      phone,
      location_text,
      role_interest,
      sia_licence_type,
      business_type,
      referral_code,
      qg_terms_accepted,
      marketing_consent,
    } = body;

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!qg_terms_accepted) {
      return new Response(JSON.stringify({ error: "You must accept the QG Launch Rewards terms" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailNormalised = email.trim().toLowerCase();

    let referrerUserId: string | null = null;

    if (referral_code) {
      const { data: codeData } = await supabase
        .from("qg_referral_codes")
        .select("owner_user_id, owner_role, status")
        .eq("code", referral_code)
        .eq("status", "active")
        .maybeSingle();

      if (codeData) {
        referrerUserId = codeData.owner_user_id;

        const { data: existingRef } = await supabase
          .from("qg_referrals")
          .select("id")
          .eq("referred_email_normalised", emailNormalised)
          .eq("referral_code", referral_code)
          .maybeSingle();

        if (!existingRef) {
          await supabase.from("qg_referrals").insert({
            referred_email: email,
            referred_email_normalised: emailNormalised,
            referred_role: role_interest === "guard" ? "guard" : role_interest === "client" ? "client" : "unknown",
            referrer_user_id: referrerUserId,
            referral_code,
            status: "profile_started",
            source: "qg_launch_rewards_temp_profile",
          });
        }
      }
    }

    const { data: existingProfile } = await supabase
      .from("qg_launch_profiles")
      .select("id, profile_status, name")
      .eq("email_normalised", emailNormalised)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateErr } = await supabase
        .from("qg_launch_profiles")
        .update({
          full_name: full_name || undefined,
          name: full_name || undefined,
          phone: phone || undefined,
          location_text: location_text || undefined,
          intended_role: role_interest,
          sia_licence_type: sia_licence_type || undefined,
          business_type: business_type || undefined,
          referral_code: referral_code || undefined,
          referrer_user_id: referrerUserId || undefined,
          qg_terms_accepted: true,
          qg_terms_accepted_at: qg_terms_accepted ? new Date().toISOString() : undefined,
          marketing_consent: marketing_consent || false,
          newsletter_consent: marketing_consent || false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);

      if (updateErr) {
        console.error("Profile update error:", updateErr);
        return new Response(JSON.stringify({ error: "Failed to update profile" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: insertErr } = await supabase
        .from("qg_launch_profiles")
        .insert({
          email,
          email_normalised: emailNormalised,
          full_name: full_name || null,
          name: full_name || null,
          phone: phone || null,
          location_text: location_text || null,
          intended_role: role_interest || "unsure",
          sia_licence_type: sia_licence_type || null,
          business_type: business_type || null,
          referral_code: referral_code || null,
          referrer_user_id: referrerUserId || null,
          profile_status: "temporary",
          qg_terms_accepted: true,
          qg_terms_accepted_at: qg_terms_accepted ? new Date().toISOString() : null,
          marketing_consent: marketing_consent || false,
          newsletter_consent: marketing_consent || false,
          source: "qg_launch_rewards",
        });

      if (insertErr) {
        console.error("Profile insert error:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to create profile" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: existingTokens } = await supabase
      .from("qg_pre_account_tokens")
      .select("id, status, pending_tokens")
      .eq("email_normalised", emailNormalised)
      .maybeSingle();

    if (!existingTokens || existingTokens.status === "cancelled" || existingTokens.status === "rejected") {
      const intendedRole = role_interest === "guard" || role_interest === "both" ? "guard" : role_interest === "client" ? "client" : "unknown";

      if (!existingTokens) {
        await supabase.from("qg_pre_account_tokens").insert({
          email,
          email_normalised: emailNormalised,
          intended_role: intendedRole,
          referral_code: referral_code || null,
          referrer_user_id: referrerUserId || null,
          pending_tokens: 0,
          approved_tokens: 0,
          cancelled_tokens: 0,
          status: "pre_account",
          source: "qg_launch_rewards_temp_profile",
        });
      } else {
        await supabase.from("qg_pre_account_tokens")
          .update({
            status: "pre_account",
            intended_role: intendedRole,
            referral_code: referral_code || undefined,
            referrer_user_id: referrerUserId || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingTokens.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: emailNormalised,
        profile_created: !existingProfile,
        profile_updated: !!existingProfile,
        has_referral: !!referral_code,
        message: "Your QG Launch Rewards profile has been created. Your QG Tokens will be linked to this email address.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});