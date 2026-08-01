import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const { category, page_url, browser_info, user_email, feedback } = await req.json();

    const variables: Record<string, string> = {
      category: category || '',
      page_url: page_url || '',
      browser_info: browser_info || '',
      user_email: user_email || '',
      feedback: feedback || '',
      year: String(new Date().getFullYear()),
    };

    const adminEmail = Deno.env.get('ADMIN_ALERT_EMAIL') || 'admin@quickguard.uk';

    await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: 'accessibility_feedback', to: adminEmail, variables, from: 'QuickGuard <noreply@quickguard.uk>' }),
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
