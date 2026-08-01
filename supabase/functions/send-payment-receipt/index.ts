import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptPayload {
  client_email: string;
  client_name: string;
  amount: number;
  currency: string;
  invoice_number: string;
  payment_date: string;
  subscription_plan: string;
  billing_period: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  try {
    const payload: ReceiptPayload = await req.json();

    const variables: Record<string, string> = {
      client_name: payload.client_name,
      amount: (payload.amount / 100).toFixed(2),
      invoice_number: payload.invoice_number,
      payment_date: new Date(payload.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      subscription_plan: payload.subscription_plan,
      billing_period: payload.billing_period,
      dashboard_url: `${siteUrl}/client/dashboard`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ template_slug: 'payment_receipt', to: payload.client_email, variables, from: 'QuickGuard <info@quickguard.uk>' }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();

    return new Response(
      JSON.stringify({ success: true, message: 'Receipt sent successfully', email_id: renderData.email_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Receipt email error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send receipt', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
