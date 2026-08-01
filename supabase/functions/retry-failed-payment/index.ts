import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || 'https://quickguard.uk';
  const allowedOrigins = ['https://quickguard.uk', 'https://app.readdy.ai', 'http://localhost:3000'];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

interface RetryPaymentPayload {
  subscription_id: string;
  payment_id?: string;
  payment_method_id?: string;
}

async function isActiveFinanceOrSuperAdmin(supabase: any, userId: string): Promise<{ allowed: boolean; role?: string; adminName?: string; adminEmail?: string }> {
  const { data } = await supabase
    .from('admin_users')
    .select('role, full_name, email')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return { allowed: false };

  const allowed = data.role === 'super_admin' || data.role === 'finance_admin';
  return { allowed, role: data.role, adminName: data.full_name, adminEmail: data.email };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  let adminInfo: { adminName?: string; adminEmail?: string; role?: string } = {};
  let clientName = 'Unknown';
  let planName = 'Unknown Plan';
  let stripeSubscriptionId = '';

  try {
    const payload: RetryPaymentPayload = await req.json();
    stripeSubscriptionId = payload.subscription_id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const authCheck = await isActiveFinanceOrSuperAdmin(supabase, user.id);
    if (!authCheck.allowed) {
      throw new Error('Only super_admin or finance_admin can retry failed payments');
    }

    adminInfo = { adminName: authCheck.adminName, adminEmail: authCheck.adminEmail, role: authCheck.role };

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', payload.subscription_id)
      .maybeSingle();

    if (!subscription) {
      throw new Error('Subscription not found for Stripe ID: ' + payload.subscription_id);
    }

    planName = subscription.plan_name || 'Unknown Plan';

    let stripeCustomerId = subscription.stripe_customer_id;

    if (subscription.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('company_name, first_name, last_name, stripe_customer_id')
        .eq('id', subscription.client_id)
        .maybeSingle();

      if (client) {
        clientName = client.company_name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown';
        if (!stripeCustomerId && client.stripe_customer_id) {
          stripeCustomerId = client.stripe_customer_id;
        }
      }
    }

    if (!stripeCustomerId) {
      throw new Error('No Stripe customer ID found for this subscription');
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(payload.subscription_id);

    if (payload.payment_method_id) {
      await stripe.paymentMethods.attach(payload.payment_method_id, {
        customer: stripeCustomerId,
      });

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: payload.payment_method_id,
        },
      });
    }

    const latestInvoice = await stripe.invoices.retrieve(stripeSubscription.latest_invoice as string);

    if (latestInvoice.status === 'open' || latestInvoice.status === 'uncollectible') {
      const paidInvoice = await stripe.invoices.pay(latestInvoice.id, {
        payment_method: payload.payment_method_id,
      });

      const updateQuery = supabase
        .from('subscription_payments')
        .update({
          status: 'succeeded',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paidInvoice.payment_intent as string,
        });

      if (payload.payment_id) {
        await updateQuery.eq('id', payload.payment_id);
      } else {
        await updateQuery.eq('stripe_invoice_id', latestInvoice.id);
      }

      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', payload.subscription_id);

      await supabase
        .from('notifications')
        .insert({
          user_id: subscription.user_id,
          title: 'Payment Successful',
          message: 'Your subscription payment has been processed successfully.',
          type: 'success',
          is_read: false,
        });

      await supabase
        .from('admin_activity_log')
        .insert({
          admin_username: adminInfo.adminEmail || adminInfo.adminName || 'unknown',
          admin_name: adminInfo.adminName || adminInfo.adminEmail || 'unknown',
          action_type: 'payment_retry',
          action_description: `Retried failed payment for ${clientName} (${planName}) — Success`,
          target_type: 'subscription',
          target_name: clientName,
          metadata: {
            stripe_subscription_id: payload.subscription_id,
            stripe_invoice_id: latestInvoice.id,
            payment_id: payload.payment_id,
            amount: subscription.plan_amount || 0,
            client_name: clientName,
            admin_role: adminInfo.role,
          },
        });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment retry successful',
          invoice_id: paidInvoice.id,
          payment_id: payload.payment_id,
          client_name: clientName,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invoice is already paid or cannot be retried',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Payment retry error:', error);

    try {
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_username: adminInfo.adminEmail || adminInfo.adminName || 'unknown',
          admin_name: adminInfo.adminName || adminInfo.adminEmail || 'unknown',
          action_type: 'payment_retry',
          action_description: `Retried failed payment for ${clientName} (${planName}) — Failed: ${error.message}`,
          target_type: 'subscription',
          target_name: clientName,
          metadata: {
            stripe_subscription_id: stripeSubscriptionId,
            error_message: error.message,
            admin_role: adminInfo.role,
            client_name: clientName,
          },
        });
    } catch {}

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payment retry failed',
        message: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
