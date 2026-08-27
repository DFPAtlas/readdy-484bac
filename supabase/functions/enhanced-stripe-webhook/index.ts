import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://quickguard.uk',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

async function logPlanChange(appSupabase: any, userId: string, oldPlanSlug: string | null, newPlanSlug: string, oldPlanName: string | null, newPlanName: string, accountType: string, changeSource: string, prorationApplied: boolean, stripeSubId: string | null) {
  if (!oldPlanSlug || oldPlanSlug === newPlanSlug) return;
  await appSupabase.from('plan_change_history').insert({ user_id: userId, old_plan_slug: oldPlanSlug, new_plan_slug: newPlanSlug, old_plan_name: oldPlanName, new_plan_name: newPlanName, account_type: accountType, changed_by: 'system', change_source: changeSource, proration_applied: prorationApplied, stripe_subscription_id: stripeSubId });
}

async function sendAdminAlert(supabaseUrl: string, supabaseServiceKey: string, userId: string, oldPlanSlug: string | null, newPlanSlug: string, oldPlanName: string | null, newPlanName: string, accountType: string, changeSource: string, prorationApplied: boolean) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-plan-change-alert`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` }, body: JSON.stringify({ user_id: userId, old_plan_slug: oldPlanSlug, new_plan_slug: newPlanSlug, old_plan_name: oldPlanName, new_plan_name: newPlanName, account_type: accountType, change_source: changeSource, proration_applied: prorationApplied }) });
  } catch (alertErr: any) { console.error('[EnhancedWebhook] Failed to send admin alert:', alertErr.message); }
}

async function finalizeJobPayment(appSupabase: any, supabaseUrl: string, supabaseServiceKey: string, session: any) {
  const sessionId = session.id;
  const paymentIntent = session.payment_intent as string;
  console.log(`[EnhancedWebhook] Finalizing job payment. session=${sessionId}, pi=${paymentIntent}`);

  const { data: existingTx } = await appSupabase.from('transactions').select('status, id').eq('stripe_session_id', sessionId).maybeSingle();
  if (existingTx?.status === 'completed') {
    console.log(`[EnhancedWebhook] Transaction ${existingTx.id} already completed, skipping finalization`);
    return;
  }

  await appSupabase.from('transactions').update({
    status: 'completed',
    stripe_payment_intent: paymentIntent,
    payment_status: 'completed',
    completed_at: new Date().toISOString(),
  }).eq('stripe_session_id', sessionId);

  const { data: transaction } = await appSupabase.from('transactions').select('job_id, client_id, amount').eq('stripe_session_id', sessionId).maybeSingle();
  if (!transaction?.job_id) { console.error('[EnhancedWebhook] No job_id found for session:', sessionId); return; }

  const jobId = transaction.job_id;
  const now = new Date().toISOString();

  await appSupabase.from('jobs').update({
    payment_status: 'funded',
    updated_at: now,
  }).eq('id', jobId);

  await appSupabase.from('job_assignments').update({
    payment_status: 'funded',
    updated_at: now,
  }).eq('job_id', jobId);

  if (transaction.client_id) {
    await appSupabase.from('notifications').insert([{ user_id: transaction.client_id, title: 'Payment Received — Job Funded', message: `Your payment of £${Number(transaction.amount || 0).toFixed(2)} has been processed and is held by QuickGuard. Guards have been notified and can now check in.`, type: 'success', related_id: jobId, is_read: false }]);
  }

  const { data: assignments } = await appSupabase.from('job_assignments').select('guard_id').eq('job_id', jobId);
  const { data: job } = await appSupabase.from('jobs').select('job_title, venue_name, venue_city, start_date, start_time, end_time, hourly_rate, client_id').eq('id', jobId).maybeSingle();
  let clientName = 'the client';
  if (job?.client_id) {
    const { data: client } = await appSupabase.from('clients').select('company_name, contact_name').eq('id', job.client_id).maybeSingle();
    clientName = client?.company_name || client?.contact_name || 'the client';
  }

  if (assignments && assignments.length > 0) {
    for (const assignment of assignments) {
      const { data: guard } = await appSupabase.from('guards').select('user_id, email, full_name').eq('id', assignment.guard_id).maybeSingle();
      if (guard?.user_id) {
        await appSupabase.from('notifications').insert([{ user_id: guard.user_id, user_type: 'guard', title: 'Booking Funded', message: `Your booking for "${job?.job_title || 'Job'}" at ${job?.venue_city || 'location'} has been funded. Payment is held by QuickGuard until completion is confirmed.`, type: 'booking_confirmed', related_id: jobId, link: '/guard/dashboard', is_read: false }]);
      }
      if (guard?.email) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-guard-booking-confirmation`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ guard_id: assignment.guard_id, guard_email: guard.email, guard_name: guard.full_name, job_id: jobId, job_title: job?.job_title, venue: job ? `${job.venue_name || ''}${job.venue_city ? ', ' + job.venue_city : ''}` : '', start_date: job?.start_date, start_time: job?.start_time?.slice(0, 5), end_time: job?.end_time?.slice(0, 5), hourly_rate: job?.hourly_rate, client_name: clientName }),
          });
        } catch (emailErr: any) { console.error('[EnhancedWebhook] Failed to send guard booking confirmation:', emailErr.message); }
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeSecretKey || !supabaseUrl || !supabaseKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const appSupabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'app' } });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response(JSON.stringify({ error: 'No signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log(`[EnhancedWebhook] Received event: ${event.type} (${event.id})`);

    const { data: already } = await appSupabase.from('processed_events').select('id').eq('id', event.id).maybeSingle();
    if (already) {
      return new Response(JSON.stringify({ received: true, idempotent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const stripeAccountId = account.id;
        if (!stripeAccountId) break;

        const detailsSubmitted = account.details_submitted ?? false;
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const requirementsDue = account.requirements?.currently_due || [];
        const restrictedReason = account.requirements?.disabled_reason || null;

        let status: string;
        if (chargesEnabled && payoutsEnabled) {
          status = 'ready';
        } else if (detailsSubmitted) {
          status = 'pending';
        } else if (requirementsDue.length > 0 || restrictedReason) {
          status = 'restricted';
        } else {
          status = 'not_started';
        }

        const now = new Date().toISOString();
        const { data: guard } = await appSupabase.from('guards').select('id, stripe_connect_verified_at').eq('stripe_account_id', stripeAccountId).maybeSingle();

        if (guard) {
          const updatePayload: any = {
            stripe_account_status: status,
            stripe_details_submitted: detailsSubmitted,
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
            stripe_requirements_due: requirementsDue,
            stripe_last_checked_at: now,
            stripe_connect_status: status === 'ready' ? 'verified' : status === 'pending' ? 'pending' : status === 'restricted' ? 'restricted' : 'not_started',
            stripe_connect_restricted_reason: restrictedReason,
            updated_at: now,
          };
          if (status === 'ready' && !guard.stripe_connect_verified_at) {
            updatePayload.stripe_connect_verified_at = now;
          }
          await appSupabase.from('guards').update(updatePayload).eq('id', guard.id);
          console.log(`[EnhancedWebhook] account.updated: guard=${guard.id} status=${status} details=${detailsSubmitted} charges=${chargesEnabled} payouts=${payoutsEnabled}`);
        } else {
          console.log(`[EnhancedWebhook] account.updated: No guard found for stripe_account_id=${stripeAccountId}`);
        }

        await appSupabase.from('payment_audit_logs').insert({
          event_type: 'account.updated',
          stripe_event_id: event.id,
          reference_type: 'guard',
          reference_id: guard?.id || stripeAccountId,
          details: JSON.stringify({ stripe_account_id: stripeAccountId, status, details_submitted: detailsSubmitted, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled, requirements_due: requirementsDue, restricted_reason: restrictedReason }),
          created_at: now,
        });
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const isJobPayment = session.metadata?.paymentType === 'job_payment';
        const isSubscription = session.metadata?.paymentType === 'subscription' || session.mode === 'subscription';
        if (isJobPayment) await finalizeJobPayment(appSupabase, supabaseUrl, supabaseKey, session);
        if (isSubscription) {
          const userId = session.client_reference_id;
          const planName = session.metadata?.planName || session.metadata?.plan_name || 'Unknown';
          const planSlug = session.metadata?.planSlug || session.metadata?.plan_id || session.metadata?.plan_slug || null;
          const stripeSubId = session.subscription as string;
          const stripeCustomerId = session.customer as string;
          const accountType = session.metadata?.account_type || session.metadata?.accountType || 'guard';
          const billingCycle = session.metadata?.billing_cycle || 'monthly';
          if (!userId) { console.error('[EnhancedWebhook] checkout.session.completed missing client_reference_id'); break; }
          if (!stripeSubId) { console.error('[EnhancedWebhook] checkout.session.completed missing subscription'); break; }

          const { data: oldSub } = await appSupabase.from('subscriptions').select('plan_slug, plan_name').eq('user_id', userId).maybeSingle();
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
          const subStatus = stripeSub.status;
          const trialStart = stripeSub.trial_start ? new Date(stripeSub.trial_start * 1000).toISOString() : null;
          const trialEnd = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null;
          const periodStart = new Date(stripeSub.current_period_start * 1000).toISOString();
          const periodEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
          let stripePriceId: string | null = null;
          const subItems = stripeSub.items?.data;
          if (subItems && subItems.length > 0) stripePriceId = subItems[0].price?.id || null;

          const isPaidUpfront = subStatus === 'active' && !stripeSub.trial_end;
          const paymentStatus = isPaidUpfront ? 'succeeded' : (subStatus === 'trialing' ? 'pending' : 'pending');
          const lastPaymentDate = isPaidUpfront ? new Date().toISOString() : null;

          let planAmount: number | null = null;
          let planFeatures: any = '[]';
          if (planSlug) {
            const { data: planData } = await appSupabase.from('plans').select('monthly_price_pence, features').eq('slug', planSlug).maybeSingle();
            if (planData) { planAmount = planData.monthly_price_pence; planFeatures = planData.features || '[]'; }
          }

          const subPayload: any = { user_id: userId, plan_name: planName, plan_slug: planSlug, status: subStatus, stripe_subscription_id: stripeSubId, stripe_customer_id: stripeCustomerId, stripe_session_id: session.id, stripe_price_id: stripePriceId, billing_cycle: billingCycle, account_type: accountType, current_period_start: periodStart, current_period_end: periodEnd, trial_start: trialStart, trial_end: trialEnd, trial_end_date: trialEnd, plan_amount: planAmount, payment_status: paymentStatus, last_payment_date: lastPaymentDate, payment_failure_count: 0, updated_at: new Date().toISOString() };
          const { error: subUpsertError } = await appSupabase.from('subscriptions').upsert(subPayload, { onConflict: 'user_id' });
          if (subUpsertError) throw new Error(`Subscription upsert failed: ${subUpsertError.message}`);

          const { data: subRecord } = await appSupabase.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
          const subscriptionDbId = subRecord?.id || null;

          const amountForPayment = isPaidUpfront ? ((planAmount || 0) / 100) : 0;
          if (isPaidUpfront && amountForPayment > 0 && subscriptionDbId) {
            const { data: existingPayment } = await appSupabase.from('subscription_payments').select('id').eq('stripe_invoice_id', stripeSub.latest_invoice as string).maybeSingle();
            if (!existingPayment) {
              await appSupabase.from('subscription_payments').insert({ subscription_id: subscriptionDbId, user_id: userId, stripe_payment_intent_id: session.payment_intent as string || null, stripe_invoice_id: stripeSub.latest_invoice as string || null, amount: amountForPayment, currency: stripeSub.currency || 'gbp', status: 'succeeded', billing_reason: 'subscription_create', period_start: periodStart, period_end: periodEnd, paid_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
              console.log(`[EnhancedWebhook] Created subscription_payments record for checkout, user=${userId}`);
            }
          }

          const profileUpdate: any = { subscription_status: subStatus, subscription_plan: planSlug, subscription_tier: planSlug, plan_slug: planSlug, plan_name: planName, stripe_customer_id: stripeCustomerId, stripe_subscription_id: stripeSubId, updated_at: new Date().toISOString() };
          if (accountType === 'guard') { profileUpdate.profile_completed = true; profileUpdate.onboarding_status = 'active'; await appSupabase.from('guards').update(profileUpdate).eq('user_id', userId); }
          else { profileUpdate.profile_completed = true; profileUpdate.onboarding_status = 'active'; await appSupabase.from('clients').update(profileUpdate).eq('user_id', userId); }

          const { data: existingEnt } = await appSupabase.from('user_entitlements').select('user_id').eq('user_id', userId).maybeSingle();
          if (existingEnt) {
            await appSupabase.from('user_entitlements').update({ plan_slug: planSlug, plan_name: planName, subscription_status: subStatus, stripe_subscription_id: stripeSubId, monthly_price_pence: planAmount || 0, features: planFeatures, current_period_end: periodEnd, cancel_at_period_end: stripeSub.cancel_at_period_end || false, updated_at: new Date().toISOString() }).eq('user_id', userId);
          } else {
            await appSupabase.from('user_entitlements').insert({ user_id: userId, plan_slug: planSlug, plan_name: planName, audience: accountType, features: planFeatures, monthly_price_pence: planAmount || 0, subscription_status: subStatus, stripe_subscription_id: stripeSubId, current_period_end: periodEnd, cancel_at_period_end: stripeSub.cancel_at_period_end || false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          }

          if (oldSub && oldSub.plan_slug && oldSub.plan_slug !== planSlug) {
            await logPlanChange(appSupabase, userId, oldSub.plan_slug, planSlug, oldSub.plan_name, planName, accountType, 'webhook', false, stripeSubId);
            await sendAdminAlert(supabaseUrl, supabaseKey, userId, oldSub.plan_slug, planSlug, oldSub.plan_name, planName, accountType, 'webhook', false);
          }
          await appSupabase.from('notifications').insert([{ user_id: userId, title: 'Subscription Activated', message: `Your ${planName} subscription is now active. Welcome aboard!`, type: 'success', is_read: false }]);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const updateData: any = { status: subscription.status, current_period_start: new Date(subscription.current_period_start * 1000).toISOString(), current_period_end: new Date(subscription.current_period_end * 1000).toISOString(), cancel_at_period_end: subscription.cancel_at_period_end, updated_at: new Date().toISOString() };
        if (subscription.trial_start) updateData.trial_start = new Date(subscription.trial_start * 1000).toISOString();
        if (subscription.trial_end) { updateData.trial_end = new Date(subscription.trial_end * 1000).toISOString(); updateData.trial_end_date = new Date(subscription.trial_end * 1000).toISOString(); }
        const subscriptionItems = (subscription as any).items?.data;
        if (subscriptionItems && subscriptionItems.length > 0) updateData.stripe_price_id = subscriptionItems[0].price?.id || null;
        const priceId = subscriptionItems?.[0]?.price?.id;
        let planFeatures: any = null; let newPlanSlug: string | null = null; let newPlanName: string | null = null;
        if (priceId) {
          const { data: planMatch } = await appSupabase.from('plans').select('slug, name, monthly_price_pence, features').eq('stripe_price_id', priceId).maybeSingle();
          if (planMatch) { updateData.plan_slug = planMatch.slug; updateData.plan_name = planMatch.name; updateData.plan_amount = planMatch.monthly_price_pence; planFeatures = planMatch.features; newPlanSlug = planMatch.slug; newPlanName = planMatch.name; }
        }
        const { data: oldSub } = await appSupabase.from('subscriptions').select('plan_slug, plan_name, user_id, account_type').eq('stripe_subscription_id', subscription.id).maybeSingle();
        await appSupabase.from('subscriptions').update(updateData).eq('stripe_subscription_id', subscription.id);
        const { data: subRecord } = await appSupabase.from('subscriptions').select('user_id, account_type').eq('stripe_subscription_id', subscription.id).maybeSingle();
        if (subRecord?.user_id) {
          const table = subRecord.account_type === 'client' ? 'clients' : (subRecord.account_type === 'guard' ? 'guards' : 'clients');
          const profileUpdate: any = { subscription_status: subscription.status, updated_at: new Date().toISOString() };
          if (updateData.plan_slug) { profileUpdate.subscription_plan = updateData.plan_slug; profileUpdate.subscription_tier = updateData.plan_slug; profileUpdate.plan_slug = updateData.plan_slug; profileUpdate.plan_name = updateData.plan_name; }
          await appSupabase.from(table).update(profileUpdate).eq('user_id', subRecord.user_id);
          const entUpdate: any = { subscription_status: subscription.status, current_period_end: new Date(subscription.current_period_end * 1000).toISOString(), cancel_at_period_end: subscription.cancel_at_period_end || false, updated_at: new Date().toISOString() };
          if (updateData.plan_slug) { entUpdate.plan_slug = updateData.plan_slug; entUpdate.plan_name = updateData.plan_name; entUpdate.monthly_price_pence = updateData.plan_amount || 0; }
          if (planFeatures !== null) entUpdate.features = planFeatures;
          await appSupabase.from('user_entitlements').update(entUpdate).eq('user_id', subRecord.user_id);
          if (oldSub && oldSub.plan_slug && newPlanSlug && oldSub.plan_slug !== newPlanSlug) {
            await logPlanChange(appSupabase, subRecord.user_id, oldSub.plan_slug, newPlanSlug, oldSub.plan_name, newPlanName || newPlanSlug, subRecord.account_type || 'unknown', 'webhook', true, subscription.id);
            await sendAdminAlert(supabaseUrl, supabaseKey, subRecord.user_id, oldSub.plan_slug, newPlanSlug, oldSub.plan_name, newPlanName || newPlanSlug, subRecord.account_type || 'unknown', 'webhook', true);
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        const invoiceId = invoice.id;
        const chargeId = invoice.charge as string;
        const paymentIntentId = invoice.payment_intent as string;
        const amountPaid = (invoice.amount_paid || 0) / 100;
        const currency = invoice.currency || 'gbp';
        const billingReason = invoice.billing_reason || 'subscription_cycle';
        const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null;
        const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null;
        const invoiceUrl = invoice.hosted_invoice_url || invoice.invoice_pdf || null;

        if (subId) {
          await appSupabase.from('subscriptions').update({ last_payment_date: new Date(invoice.created * 1000).toISOString(), payment_status: 'succeeded', payment_failure_count: 0, last_payment_error: null, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subId);
          const { data: sub } = await appSupabase.from('subscriptions').select('user_id, plan_name, id').eq('stripe_subscription_id', subId).maybeSingle();
          const userId = sub?.user_id || null;
          const subscriptionDbId = sub?.id || null;

          if (amountPaid > 0) {
            const { data: existingPayment } = await appSupabase.from('subscription_payments').select('id').eq('stripe_invoice_id', invoiceId).maybeSingle();
            if (!existingPayment) {
              await appSupabase.from('subscription_payments').insert({ subscription_id: subscriptionDbId, user_id: userId, stripe_payment_intent_id: paymentIntentId, stripe_invoice_id: invoiceId, stripe_charge_id: chargeId, amount: amountPaid, currency: currency, status: 'succeeded', billing_reason: billingReason, period_start: periodStart, period_end: periodEnd, paid_at: new Date().toISOString(), invoice_url: invoiceUrl, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
              console.log(`[EnhancedWebhook] Created subscription_payments record, invoice=${invoiceId}, amount=${amountPaid}`);
            }
          }

          if (sub?.user_id) {
            await appSupabase.from('notifications').insert([{ user_id: sub.user_id, title: 'Payment Received', message: `Your ${sub.plan_name || 'subscription'} payment was successful.`, type: 'success', is_read: false }]);
            await appSupabase.from('user_entitlements').update({ subscription_status: 'active', updated_at: new Date().toISOString() }).eq('user_id', sub.user_id);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        const { data: sub } = await appSupabase.from('subscriptions').select('user_id, payment_failure_count, plan_name').eq('stripe_subscription_id', subId).maybeSingle();
        if (sub) {
          const newCount = (sub.payment_failure_count || 0) + 1;
          const newStatus = newCount >= 3 ? 'canceled' : 'past_due';
          await appSupabase.from('subscriptions').update({ status: newStatus, last_payment_error: 'Payment failed', payment_failure_count: newCount, updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subId);
          await appSupabase.from('notifications').insert([{ user_id: sub.user_id, title: 'Payment Failed', message: `Your ${sub.plan_name || 'subscription'} payment could not be processed. Please update your payment method.`, type: 'error', is_read: false }]);
          await appSupabase.from('user_entitlements').update({ subscription_status: newStatus, updated_at: new Date().toISOString() }).eq('user_id', sub.user_id);
          await appSupabase.from('subscription_payments').insert({ subscription_id: sub.id, user_id: sub.user_id, stripe_payment_intent_id: invoice.payment_intent as string || null, stripe_invoice_id: invoice.id, stripe_charge_id: invoice.charge as string || null, amount: (invoice.amount_due || 0) / 100, currency: invoice.currency || 'gbp', status: 'failed', billing_reason: invoice.billing_reason || 'subscription_cycle', period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null, period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null, failed_at: new Date().toISOString(), failure_reason: 'Payment declined', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const failureReason = (paymentIntent as any).last_payment_error?.message || 'Payment declined by bank';
        const { data: transaction } = await appSupabase.from('transactions').select('client_id, job_id, id, retry_count, amount').eq('stripe_payment_intent', paymentIntent.id).maybeSingle();
        if (transaction) {
          const newRetryCount = (transaction.retry_count || 0) + 1;
          await appSupabase.from('transactions').update({ status: 'failed', failure_reason: failureReason, retry_count: newRetryCount, updated_at: new Date().toISOString() }).eq('id', transaction.id);
          await appSupabase.from('notifications').insert([{ user_id: transaction.client_id, title: 'Payment Failed', message: `Your payment of £${transaction.amount} failed: ${failureReason}. Please retry or contact support.`, type: 'error', related_id: transaction.job_id, is_read: false }]);
          try { await fetch(`${supabaseUrl}/functions/v1/send-failed-payment-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify({ transaction_id: transaction.id, client_id: transaction.client_id, job_id: transaction.job_id, failure_reason: failureReason, retry_count: newRetryCount, amount: transaction.amount, stripe_payment_intent: paymentIntent.id }) }); } catch (e: any) { console.error('Failed to send failed payment email:', e); }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: sub } = await appSupabase.from('subscriptions').select('user_id, account_type').eq('stripe_subscription_id', subscription.id).maybeSingle();
        if (sub) {
          await appSupabase.from('subscriptions').update({ status: 'cancelled', cancel_at_period_end: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('stripe_subscription_id', subscription.id);
          const table = sub.account_type === 'client' ? 'clients' : 'guards';
          await appSupabase.from(table).update({ subscription_status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', sub.user_id);
          await appSupabase.from('user_entitlements').update({ subscription_status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', sub.user_id);
          await appSupabase.from('notifications').insert([{ user_id: sub.user_id, title: 'Subscription Cancelled', message: 'Your subscription has been cancelled. You can resubscribe anytime.', type: 'info', is_read: false }]);
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as any;
        const jobId = transfer.metadata?.jobId; const guardId = transfer.metadata?.guardId; const assignmentId = transfer.metadata?.assignmentId;
        if (jobId && guardId) {
          await appSupabase.from('guard_payouts').update({ stripe_transfer_id: transfer.id, stripe_transfer_status: 'created', status: 'processing', updated_at: new Date().toISOString(), transfer_webhook_updated_at: new Date().toISOString() }).eq('job_id', jobId).eq('guard_id', guardId).eq('status', 'pending');
          if (assignmentId) {
            await appSupabase.from('job_assignments').update({ stripe_transfer_id: transfer.id, updated_at: new Date().toISOString() }).eq('id', assignmentId);
          }
          await appSupabase.from('payment_audit_logs').insert({ event_type: 'transfer.created', stripe_event_id: transfer.id, reference_type: 'guard_payout', reference_id: jobId, details: JSON.stringify({ transfer_id: transfer.id, amount: transfer.amount, currency: transfer.currency, guard_id: guardId, job_id: jobId, assignment_id: assignmentId }), created_at: new Date().toISOString() });
        }
        break;
      }

      case 'transfer.paid': {
        const transfer = event.data.object as any;
        const jobId = transfer.metadata?.jobId; const guardId = transfer.metadata?.guardId; const assignmentId = transfer.metadata?.assignmentId;
        if (jobId && guardId) {
          await appSupabase.from('guard_payouts').update({ stripe_transfer_status: 'paid', status: 'paid_out', completed_date: new Date().toISOString(), updated_at: new Date().toISOString(), transfer_webhook_updated_at: new Date().toISOString() }).eq('job_id', jobId).eq('guard_id', guardId);
          if (assignmentId) {
            await appSupabase.from('job_assignments').update({ payment_status: 'paid_out', updated_at: new Date().toISOString() }).eq('id', assignmentId);
          }
        }
        break;
      }

      case 'transfer.failed': {
        const transfer = event.data.object as any;
        const jobId = transfer.metadata?.jobId; const guardId = transfer.metadata?.guardId; const assignmentId = transfer.metadata?.assignmentId;
        const failureReason = (transfer as any).failure_message || 'Transfer failed';
        if (jobId && guardId) {
          await appSupabase.from('guard_payouts').update({ stripe_transfer_status: 'failed', status: 'failed', failure_reason: failureReason, updated_at: new Date().toISOString(), transfer_webhook_updated_at: new Date().toISOString() }).eq('job_id', jobId).eq('guard_id', guardId);
          if (assignmentId) {
            await appSupabase.from('job_assignments').update({ payment_status: 'failed', updated_at: new Date().toISOString() }).eq('id', assignmentId);
          }
          await appSupabase.from('payment_audit_logs').insert({ event_type: 'transfer.failed', stripe_event_id: transfer.id, reference_type: 'guard_payout', reference_id: jobId, details: JSON.stringify({ transfer_id: transfer.id, guard_id: guardId, job_id: jobId, failure_reason: failureReason }), created_at: new Date().toISOString() });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        console.log(`[EnhancedWebhook] Charge refunded: ${charge.id}, amount_refunded=${charge.amount_refunded}`);
        await appSupabase.from('processed_stripe_events').insert({ id: event.id, event_type: event.type, stripe_event_id: event.id, processed_at: new Date().toISOString() });
        const paymentIntentId = charge.payment_intent as string;

        if (paymentIntentId) {
          const { data: subPmt } = await appSupabase.from('subscription_payments').select('id, amount').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
          if (subPmt) {
            const refundAmount = (charge.amount_refunded || 0) / 100;
            await appSupabase.from('subscription_payments').update({ refunded: true, refund_amount: refundAmount, refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', subPmt.id);
            console.log(`[EnhancedWebhook] Refund applied to subscription_payments id=${subPmt.id}`);
          }
        }

        if (!paymentIntentId) { console.log('[EnhancedWebhook] charge.refunded — no payment_intent, skipping'); break; }

        const { data: transaction } = await appSupabase.from('transactions').select('id, job_id, client_id, amount, status').eq('stripe_payment_intent', paymentIntentId).maybeSingle();
        if (!transaction) { console.log(`[EnhancedWebhook] No transaction for pi ${paymentIntentId}, likely subscription charge (already handled above)`); break; }

        const refundAmount = (charge.amount_refunded || 0) / 100;
        await appSupabase.from('transactions').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('id', transaction.id);

        if (transaction.job_id) {
          await appSupabase.from('jobs').update({ payment_status: 'refunded', updated_at: new Date().toISOString() }).eq('id', transaction.job_id);
          await appSupabase.from('job_assignments').update({ payment_status: 'refunded', updated_at: new Date().toISOString() }).eq('job_id', transaction.job_id);
        }

        await appSupabase.from('payment_audit_logs').insert({ event_type: 'charge.refunded', stripe_event_id: charge.id, reference_type: 'transaction', reference_id: transaction.id, details: JSON.stringify({ charge_id: charge.id, payment_intent: paymentIntentId, refund_amount: refundAmount, currency: charge.currency, job_id: transaction.job_id, reason: (charge as any).refunds?.data?.[0]?.reason || 'unknown' }), created_at: new Date().toISOString() });

        if (transaction.client_id) {
          await appSupabase.from('notifications').insert([{ user_id: transaction.client_id, title: 'Payment Refunded', message: `A refund of £${refundAmount.toFixed(2)} has been processed for your job payment.`, type: 'warning', related_id: transaction.job_id || undefined, is_read: false }]);
        }

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-refund-notification`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` }, body: JSON.stringify({ transaction_id: transaction.id, client_id: transaction.client_id, job_id: transaction.job_id, refund_amount: refundAmount, charge_id: charge.id }) });
        } catch (e: any) { console.error('[EnhancedWebhook] Failed to send refund notification:', e.message); }

        console.log(`[EnhancedWebhook] Refund processed: tx=${transaction.id}, job=${transaction.job_id}, amount=£${refundAmount.toFixed(2)}`);
        break;
      }

      default: {
        console.log(`[EnhancedWebhook] Unhandled event type: ${event.type}`);
      }
    }

    await appSupabase.from('processed_events').insert({ id: event.id, event_type: event.type, processed_at: new Date().toISOString() });
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[EnhancedWebhook] ERROR:', error);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
});