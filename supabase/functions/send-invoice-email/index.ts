import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';
  const authHeader = req.headers.get('Authorization') || '';

  if (authHeader !== `Bearer ${serviceKey}`) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      db: { schema: 'app' },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: admin } = await userClient.from('admin_users').select('id,is_active').eq('user_id', user.id).maybeSingle();
    if (!admin?.is_active) {
      return new Response(JSON.stringify({ error: 'Active admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'app' } });

  try {
    const { job_id, recipient_email, recipient_name } = await req.json();
    if (!job_id || !recipient_email) {
      return new Response(JSON.stringify({ error: 'job_id and recipient_email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: jobData } = await supabase
      .from('jobs')
      .select('*, job_assignments(id, guard_id, payment_amount, guards(id, full_name))')
      .eq('id', job_id)
      .maybeSingle();
    if (!jobData) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: clientData } = await supabase
      .from('clients')
      .select('company_name, contact_name, user_id')
      .eq('id', jobData.client_id)
      .maybeSingle();

    const startDt = new Date(`${jobData.start_date}T${jobData.start_time}`);
    const endDt = new Date(`${jobData.end_date || jobData.start_date}T${jobData.end_time}`);
    let hours = (endDt.getTime() - startDt.getTime()) / 3600000;
    if (hours < 0) hours += 24;

    const startD = new Date(jobData.start_date);
    const endD = new Date(jobData.end_date || jobData.start_date);
    const days = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / 86400000) + 1);
    hours *= days;

    const numGuards = jobData.job_assignments?.length || jobData.number_of_guards || 1;
    const guardFees = Math.round(hours * jobData.hourly_rate * numGuards * 100) / 100;
    const serviceFee = Math.round(guardFees * 0.10 * 100) / 100;
    const subtotal = guardFees + serviceFee;
    const vat = Math.round(subtotal * 0.20 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;

    const invoiceDate = new Date();
    const invoiceNumber = `INV-${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}${String(invoiceDate.getDate()).padStart(2, '0')}-${job_id.slice(0, 6).toUpperCase()}`;

    const variables = {
      client_name: clientData?.company_name || recipient_name || 'Client',
      job_title: jobData.job_title || 'Security Job',
      invoice_number: invoiceNumber,
      total: total.toFixed(2),
      amount: total.toFixed(2),
      dashboard_url: `${siteUrl}/client/payment-history`,
      year: String(new Date().getFullYear()),
    };

    const renderRes = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
      body: JSON.stringify({
        template_slug: 'invoice',
        to: recipient_email,
        variables,
        from: 'QuickGuard <billing@quickguard.uk>',
        related_user_id: clientData?.user_id || null,
        related_job_id: job_id,
      }),
    });

    if (!renderRes.ok) throw new Error(`Invoice send failed: ${await renderRes.text()}`);
    const renderData = await renderRes.json();

    return new Response(JSON.stringify({ success: true, invoice_number: invoiceNumber, email_id: renderData.email_id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
