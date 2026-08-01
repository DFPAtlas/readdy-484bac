import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FailedPaymentPayload {
  transaction_id: string;
  client_id: string;
  job_id: string;
  failure_reason: string;
  retry_count: number;
  amount: number;
  stripe_payment_intent?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  try {
    const payload: FailedPaymentPayload = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    const { data: client } = await supabase.from('clients').select('email, contact_name, company_name').eq('id', payload.client_id).maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: job } = await supabase.from('jobs').select('job_title, venue_name, venue_city, start_date').eq('id', payload.job_id).maybeSingle();
    const jobTitle = job?.job_title || 'Your job';
    const venue = job ? `${job.venue_name}, ${job.venue_city}` : 'N/A';
    const amount = payload.amount ? parseFloat(String(payload.amount)).toFixed(2) : '0.00';

    const variables: Record<string, string> = {
      client_name: client.contact_name || client.company_name || 'there',
      job_title: jobTitle,
      venue: venue,
      amount: amount,
      failure_reason: payload.failure_reason || 'Your payment method was declined.',
      retry_url: `${siteUrl}/client/jobs/${payload.job_id}/payment`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: 'payment_failed', to: client.email, variables, from: 'QuickGuard <billing@quickguard.co.uk>' }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();

    return new Response(
      JSON.stringify({ success: true, message: 'Failed payment email sent', email_id: renderData.email_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Failed payment email error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send email', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
