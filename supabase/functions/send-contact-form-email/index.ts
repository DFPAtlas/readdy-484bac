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
    const { name, email, subject, message } = await req.json();

    const variables: Record<string, string> = {
      name: name || '',
      email: email || '',
      subject: subject || 'No subject',
      message: message || '',
      year: String(new Date().getFullYear()),
    };

    const adminEmail = Deno.env.get('ADMIN_ALERT_EMAIL') || 'admin@quickguard.uk';

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: 'contact_form', to: adminEmail, variables, from: 'QuickGuard <noreply@quickguard.uk>' }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      console.error('Contact form email error:', errText);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
