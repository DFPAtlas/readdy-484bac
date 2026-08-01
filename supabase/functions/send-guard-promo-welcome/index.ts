const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { guardName, guardEmail, tier, signupNumber, promoEndsAt, lifetimeFee } = await req.json();

    const tierMap: Record<string, string> = {
      founding: 'guard_promo_founding',
      early: 'guard_promo_early',
      launch: 'guard_promo_launch',
    };

    const templateSlug = tierMap[tier] || 'guard_promo_launch';

    const variables: Record<string, string> = {
      guard_name: guardName || 'Guard',
      signup_number: String(signupNumber || '').padStart(3, '0'),
      promo_ends_at: promoEndsAt ? new Date(promoEndsAt).toLocaleDateString('en-GB') : '12 months from now',
      dashboard_url: 'https://quickguard.uk/guard/dashboard',
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: templateSlug, to: guardEmail, variables, from: Deno.env.get('FROM_EMAIL') || 'hello@quickguard.uk' }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Resend failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
