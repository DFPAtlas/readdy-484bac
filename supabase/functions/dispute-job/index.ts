
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { job_id, assignment_id, reason, details } = body;

    if (!job_id || !assignment_id || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: job_id, assignment_id, reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, user_id, company_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Only clients can raise disputes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('id, client_id, payment_status, status, agreed_amount, stripe_payment_intent_id, disputed')
      .eq('id', job_id)
      .maybeSingle();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (job.client_id !== client.id) {
      return new Response(JSON.stringify({ error: 'You can only dispute your own jobs' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (job.disputed) {
      return new Response(JSON.stringify({ error: 'This job already has an active dispute' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('id, guard_id, status')
      .eq('id', assignment_id)
      .maybeSingle();

    if (!assignment) {
      return new Response(JSON.stringify({ error: 'Assignment not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date().toISOString();

    const { data: dispute } = await supabase.from('disputes').insert({
      job_id: job.id,
      client_id: client.id,
      guard_id: assignment.guard_id,
      assignment_id: assignment.id,
      raised_by: 'client',
      reason: reason,
      details: details || null,
      status: 'open',
      created_at: now,
      updated_at: now,
    }).select().single();

    await supabase.from('jobs').update({
      disputed: true,
      disputed_at: now,
      disputed_reason: reason,
      payment_status: 'disputed',
      updated_at: now,
    }).eq('id', job.id);

    await supabase.from('payment_audit_logs').insert({
      job_id: job.id,
      guard_id: assignment.guard_id,
      action: 'dispute_raised',
      previous_status: job.payment_status,
      new_status: 'disputed',
      performed_by: client.id,
      notes: `Client dispute: ${reason}`,
      created_at: now,
    });

    const { data: guard } = await supabase
      .from('guards')
      .select('user_id, full_name')
      .eq('id', assignment.guard_id)
      .maybeSingle();

    if (guard?.user_id) {
      await supabase.from('notifications').insert([{
        user_id: guard.user_id,
        user_type: 'guard',
        type: 'dispute',
        title: 'Payment Dispute Raised',
        message: `The client has raised a dispute on a completed job. Reason: ${reason}`,
        link: '/guard/dashboard#notifications',
        is_read: false,
      }]);
    }

    await supabase.from('notifications').insert([{
      user_id: user.id,
      user_type: 'client',
      type: 'dispute',
      title: 'Dispute Raised',
      message: `Your dispute has been logged. Our team will review it within 24 hours.`,
      link: '/client/dashboard',
      is_read: false,
    }]);

    return new Response(
      JSON.stringify({
        success: true,
        disputeId: dispute.id,
        status: 'open',
        message: 'Dispute raised successfully. An admin will review it shortly.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[DisputeJob] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to raise dispute' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
