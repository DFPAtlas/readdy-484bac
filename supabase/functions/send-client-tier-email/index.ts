import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { client_email, client_name, tier, signup_number, ends_at, discount, jobs_remaining } = await req.json();
    if (!client_email || !tier) return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const num = signup_number ? String(signup_number).padStart(3, '0') : '';
    const endDate = ends_at ? new Date(ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const tierMap: Record<string, string> = {
      founding_client: 'client_tier_founding',
      early_client: 'client_tier_early',
      launch_client: 'client_tier_launch',
    };

    const templateSlug = tierMap[tier];
    if (!templateSlug) return new Response(JSON.stringify({ error: 'Unknown tier' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const variables: Record<string, string> = {
      client_name: client_name || 'there',
      signup_number: num,
      promo_ends_at: endDate,
      jobs_remaining: String(jobs_remaining || 0),
      dashboard_url: 'https://quickguard.uk/client/dashboard',
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: templateSlug, to: client_email, variables, from: Deno.env.get('FROM_EMAIL') || 'hello@quickguard.uk' }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      return new Response(JSON.stringify({ error: 'Failed to send', details: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ sent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
