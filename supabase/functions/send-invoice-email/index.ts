import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { job_id, recipient_email, recipient_name, sent_by_admin, caller_email } = await req.json();
    if (!job_id || !recipient_email) {
      return new Response(JSON.stringify({ error: 'job_id and recipient_email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: jobData } = await supabase.from('jobs').select('*, job_assignments(id, guard_id, payment_amount, guards(id, full_name))').eq('id', job_id).maybeSingle();
    if (!jobData) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: clientData } = await supabase.from('clients').select('*').eq('id', jobData.client_id).maybeSingle();

    const startDt = new Date(`${jobData.start_date}T${jobData.start_time}`);
    const endDt = new Date(`${(jobData.end_date || jobData.start_date)}T${jobData.end_time}`);
    let hours = (endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60);
    if (hours < 0) hours += 24;
    const startD = new Date(jobData.start_date);
    const endD = new Date(jobData.end_date || jobData.start_date);
    const days = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    hours = hours * days;

    const numGuards = jobData.job_assignments?.length || jobData.number_of_guards || 1;
    const guardFees = Math.round(hours * jobData.hourly_rate * numGuards * 100) / 100;
    const serviceFee = Math.round(guardFees * 0.10 * 100) / 100;
    const subtotal = guardFees + serviceFee;
    const vat = Math.round(subtotal * 0.20 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;

    const invoiceDate = new Date();
    const invoiceNumber = `INV-${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}${String(invoiceDate.getDate()).padStart(2, '0')}-${job_id.slice(0, 6).toUpperCase()}`;

    const variables: Record<string, string> = {
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({
        template_slug: 'invoice',
        to: recipient_email,
        variables,
        from: 'QuickGuard <billing@quickguard.uk>',
      }),
    });

    if (!renderRes.ok) {
      const errText = await renderRes.text();
      throw new Error(`Template render failed: ${errText}`);
    }

    const renderData = await renderRes.json();

    await supabase.from('email_queue').insert({
      email_type: 'invoice_email',
      recipient_email,
      subject: `Invoice ${invoiceNumber} – £${total.toFixed(2)} – ${jobData.job_title || 'Security Job'}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: { job_id, invoice_number: invoiceNumber, total, sent_by_admin: sent_by_admin || false, caller_email: caller_email || null },
    });

    return new Response(JSON.stringify({ success: true, invoice_number: invoiceNumber, email_id: renderData.email_id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
