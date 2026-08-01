import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { guardId, guardCreatedAt } = await req.json();
    if (!guardId) {
      return new Response(
        JSON.stringify({ error: 'guardId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }
    });

    const { data: config, error: configError } = await supabase
      .from('promo_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (configError || !config) {
      const { data: countData } = await supabase
        .from('guards')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'approved');
      
      const signupNumber = (countData?.length || 0) + 1;
      
      const { error: updateErr } = await supabase
        .from('guards')
        .update({
          signup_number: signupNumber,
          promo_tier: 'standard',
          lifetime_fee_percentage: null,
          founding_badge: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', guardId);

      if (updateErr) throw updateErr;

      return new Response(
        JSON.stringify({ success: true, tier: 'standard', signupNumber, message: 'Standard tier assigned (no promo config)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (config.is_paused) {
      const { count } = await supabase
        .from('guards')
        .select('*', { count: 'exact', head: true })
        .eq('verification_status', 'approved');
      
      const signupNumber = (count || 0) + 1;
      
      await supabase.from('guards').update({
        signup_number: signupNumber,
        promo_tier: 'standard',
        lifetime_fee_percentage: null,
        founding_badge: false,
        updated_at: new Date().toISOString(),
      }).eq('id', guardId);

      return new Response(
        JSON.stringify({ success: true, tier: 'standard', signupNumber, message: 'Standard tier assigned (promo paused)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const signupDate = guardCreatedAt ? new Date(guardCreatedAt) : now;
    const daysSinceSignup = (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24);
    const effectiveDate = daysSinceSignup <= 14 ? signupDate : now;

    const launchDate = new Date(config.launch_date);
    const tier3EndDate = new Date(launchDate);
    tier3EndDate.setDate(tier3EndDate.getDate() + config.tier3_window_days);

    const withinLaunchWindow = now <= tier3EndDate;
    const withinTier3Cap = true;

    const { data: existing } = await supabase
      .from('guards')
      .select('signup_number')
      .eq('id', guardId)
      .maybeSingle();

    if (existing?.signup_number) {
      return new Response(
        JSON.stringify({ success: true, alreadyAssigned: true, signupNumber: existing.signup_number }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { count } = await supabase
      .from('guards')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'approved')
      .not('signup_number', 'is', null);

    const signupNumber = (count || 0) + 1;

    let tier = 'standard';
    let promoStartsAt = now.toISOString();
    let promoEndsAt: string | null = null;
    let lifetimeFee: number | null = null;
    let foundingBadge = false;

    if (signupNumber <= config.tier1_cap) {
      tier = 'founding';
      const end = new Date(now);
      end.setMonth(end.getMonth() + 12);
      promoEndsAt = end.toISOString();
      lifetimeFee = config.tier1_lifetime_fee;
      foundingBadge = true;
    } else if (signupNumber <= config.tier2_cap) {
      tier = 'early';
      const end = new Date(now);
      end.setMonth(end.getMonth() + 6);
      promoEndsAt = end.toISOString();
    } else if (signupNumber <= config.tier3_cap && withinLaunchWindow) {
      tier = 'launch';
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      promoEndsAt = end.toISOString();
    }

    const { error: updateError } = await supabase
      .from('guards')
      .update({
        signup_number: signupNumber,
        promo_tier: tier,
        promo_starts_at: promoStartsAt,
        promo_ends_at: promoEndsAt,
        lifetime_fee_percentage: lifetimeFee,
        founding_badge: foundingBadge,
        updated_at: now.toISOString(),
      })
      .eq('id', guardId);

    if (updateError) throw updateError;

    try {
      const { data: guardData } = await supabase
        .from('guards')
        .select('full_name, email')
        .eq('id', guardId)
        .maybeSingle();

      if (guardData?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-guard-promo-welcome`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            guardId,
            guardName: guardData.full_name,
            guardEmail: guardData.email,
            tier,
            signupNumber,
            promoEndsAt,
            lifetimeFee,
          }),
        });
      }
    } catch (emailErr) {
      console.error('Promo welcome email failed:', emailErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tier,
        signupNumber,
        promoEndsAt,
        lifetimeFee,
        foundingBadge,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Assign promo tier error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
