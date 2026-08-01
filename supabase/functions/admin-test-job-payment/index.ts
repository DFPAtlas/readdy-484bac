import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isTestKey(key: string): boolean {
  return key.startsWith('sk_test_');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: adminCheck } = await supabaseAdmin
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminCheck || !adminCheck.is_active) {
      return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allowedRoles = ['super_admin', 'finance_admin'];
    if (!allowedRoles.includes(adminCheck.role)) {
      return new Response(JSON.stringify({ success: false, error: 'Only super_admin and finance_admin can use this test console' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isTest = isTestKey(stripeSecretKey);
    const body = await req.json();
    const { action } = body;
    const now = new Date().toISOString();

    async function writeAuditLog(eventType: string, referenceType: string, referenceId: string, details: Record<string, unknown>) {
      try {
        const { data: auditLog, error: insertErr } = await supabaseAdmin
          .from('payment_audit_logs')
          .insert({
            event_type: eventType,
            reference_type: referenceType,
            reference_id: referenceId,
            changed_by: user.id,
            changed_by_role: 'admin',
            details: JSON.stringify(details),
            created_at: now,
          })
          .select('id')
          .maybeSingle();

        if (insertErr) {
          console.error('[AuditLog] Insert failed:', insertErr.message);
        }
        return auditLog?.id || null;
      } catch (err: any) {
        console.error('[AuditLog] Write failed:', err.message);
        return null;
      }
    }

    switch (action) {

      case 'check_mode': {
        return new Response(JSON.stringify({
          success: true,
          mode: isTest ? 'test' : 'live',
          isLiveMode: !isTest,
          isTestMode: isTest,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'get_status_snapshot': {
        const { jobId, assignmentId } = body;
        if (!jobId) return new Response(JSON.stringify({ success: false, error: 'jobId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const [
          { data: job },
          { data: assignment },
          { data: transaction },
          { data: completionRequest },
          { data: payout },
        ] = await Promise.all([
          supabaseAdmin.from('jobs').select('id, job_title, status, payment_status, stripe_session_id, stripe_payment_intent_id, agreed_amount, platform_fee, guard_payout_amount, currency, client_id').eq('id', jobId).maybeSingle(),
          assignmentId ? supabaseAdmin.from('job_assignments').select('id, status, payment_status, guard_net_payout, stripe_transfer_id, gross_guard_amount, guard_id').eq('id', assignmentId).maybeSingle() : Promise.resolve({ data: null }),
          supabaseAdmin.from('transactions').select('id, status, stripe_session_id, stripe_payment_intent, amount, created_at').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabaseAdmin.from('job_completion_requests').select('id, status, guard_id').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          assignmentId ? supabaseAdmin.from('guard_payouts').select('id, status, stripe_transfer_id, amount, net_amount').eq('assignment_id', assignmentId).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        return new Response(JSON.stringify({
          success: true,
          action: 'get_status_snapshot',
          data: {
            job: job ? { id: job.id, title: job.job_title, status: job.status, payment_status: job.payment_status, stripe_session_id: job.stripe_session_id, stripe_payment_intent_id: job.stripe_payment_intent_id, agreed_amount: job.agreed_amount, platform_fee: job.platform_fee, guard_payout_amount: job.guard_payout_amount, currency: job.currency, client_id: job.client_id } : null,
            assignment: assignment ? { id: assignment.id, status: assignment.status, payment_status: assignment.payment_status, guard_net_payout: assignment.guard_net_payout, stripe_transfer_id: assignment.stripe_transfer_id, gross_guard_amount: assignment.gross_guard_amount, guard_id: assignment.guard_id } : null,
            transaction: transaction ? { id: transaction.id, status: transaction.status, stripe_session_id: transaction.stripe_session_id, stripe_payment_intent: transaction.stripe_payment_intent, amount: transaction.amount, created_at: transaction.created_at } : null,
            completionRequest: completionRequest ? { id: completionRequest.id, status: completionRequest.status, guard_id: completionRequest.guard_id } : null,
            payout: payout ? { id: payout.id, status: payout.status, stripe_transfer_id: payout.stripe_transfer_id, amount: payout.amount, net_amount: payout.net_amount } : null,
          },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'create_checkout': {
        if (!isTest) {
          return new Response(JSON.stringify({ success: false, error: 'LIVE_MODE_BLOCKED: This test console requires Stripe test mode. Current key is live.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { jobId, clientId, amount, assignmentId: asgnId } = body;
        if (!jobId || !clientId || !amount) {
          return new Response(JSON.stringify({ success: false, error: 'jobId, clientId, and amount are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: jobData } = await supabaseAdmin.from('jobs').select('job_title, stripe_session_id').eq('id', jobId).maybeSingle();
        if (!jobData) return new Response(JSON.stringify({ success: false, error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const { data: clientData } = await supabaseAdmin.from('clients').select('email, stripe_customer_id').eq('id', clientId).maybeSingle();
        if (!clientData) return new Response(JSON.stringify({ success: false, error: 'Client not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const finalAmountInCents = Math.round(Number(amount) * 100);
        const stripeFeeEstimate = (Number(amount) * 0.015) + 0.20;
        const platformFeeEstimate = Number(amount) * 0.1;

        const sessionPayload: any = {
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'gbp',
              product_data: { name: `[TEST] Security Job: ${jobData.job_title}`, description: 'Admin test payment — no real funds involved' },
              unit_amount: finalAmountInCents,
            },
            quantity: 1,
          }],
          success_url: `${req.headers.get('origin') || 'https://quickguard.uk'}/admin/payment-management?test_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.get('origin') || 'https://quickguard.uk'}/admin/payment-management?test_checkout=cancelled`,
          client_reference_id: clientId,
          metadata: {
            jobId,
            clientId,
            paymentType: 'job_payment',
            guardFees: Number(amount).toFixed(2),
            serviceFeePct: '10',
            platformFee: platformFeeEstimate.toFixed(2),
            stripeFeeEstimate: stripeFeeEstimate.toFixed(2),
            clientTotalCharge: Number(amount).toFixed(2),
            adminTest: 'true',
          },
        };

        if (clientData.stripe_customer_id) sessionPayload.customer = clientData.stripe_customer_id;
        else sessionPayload.customer_email = clientData.email;

        const session = await stripe.checkout.sessions.create(sessionPayload);

        await supabaseAdmin.from('transactions').insert({
          job_id: jobId,
          client_id: clientId,
          amount: Number(amount),
          transaction_type: 'job_payment',
          payment_method: 'stripe',
          status: 'pending',
          stripe_session_id: session.id,
          description: `[TEST] Admin test payment for job: ${jobData.job_title}`,
          metadata: { admin_test: true, guard_fees: Number(amount), service_fee_pct: 10, platform_fee: platformFeeEstimate, stripe_fee_estimate: stripeFeeEstimate, client_total_charge: Number(amount) },
          created_at: now,
          updated_at: now,
        });

        await supabaseAdmin.from('jobs').update({
          payment_status: 'payment_pending',
          stripe_session_id: session.id,
          updated_at: now,
        }).eq('id', jobId);

        if (asgnId) {
          await supabaseAdmin.from('job_assignments').update({
            payment_status: 'payment_pending',
            updated_at: now,
          }).eq('id', asgnId);
        }

        const auditLogId = await writeAuditLog('admin_test_checkout_created', 'transaction', jobId, {
          job_id: jobId,
          client_id: clientId,
          amount: Number(amount),
          stripe_session_id: session.id,
          assignment_id: asgnId || null,
        });

        return new Response(JSON.stringify({
          success: true,
          action: 'create_checkout',
          message: 'Stripe test checkout session created',
          data: { sessionId: session.id, url: session.url, amount: Number(amount) },
          auditLogId,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'simulate_funded': {
        if (!isTest) {
          return new Response(JSON.stringify({ success: false, error: 'LIVE_MODE_BLOCKED: Cannot simulate funded status in live mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { jobId, assignmentId: asgnId, sessionId } = body;
        if (!jobId) return new Response(JSON.stringify({ success: false, error: 'jobId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const fakePaymentIntent = `pi_test_admin_${Date.now()}`;

        if (sessionId) {
          await supabaseAdmin.from('transactions').update({
            status: 'completed',
            stripe_payment_intent: fakePaymentIntent,
            payment_status: 'completed',
            completed_at: now,
            updated_at: now,
          }).eq('stripe_session_id', sessionId);
        } else {
          await supabaseAdmin.from('transactions').update({
            status: 'completed',
            stripe_payment_intent: fakePaymentIntent,
            payment_status: 'completed',
            completed_at: now,
            updated_at: now,
          }).eq('job_id', jobId).eq('status', 'pending');
        }

        await supabaseAdmin.from('jobs').update({
          payment_status: 'funded',
          stripe_payment_intent_id: fakePaymentIntent,
          status: 'confirmed',
          updated_at: now,
        }).eq('id', jobId);

        if (asgnId) {
          await supabaseAdmin.from('job_assignments').update({
            payment_status: 'funded',
            status: 'confirmed',
            updated_at: now,
          }).eq('id', asgnId);
        } else {
          await supabaseAdmin.from('job_assignments').update({
            payment_status: 'funded',
            status: 'confirmed',
            updated_at: now,
          }).eq('job_id', jobId);
        }

        const auditLogId = await writeAuditLog('admin_test_payment_funded', 'job', jobId, {
          job_id: jobId,
          assignment_id: asgnId || null,
          simulated_payment_intent: fakePaymentIntent,
          session_id: sessionId || null,
        });

        const updates: string[] = ['transactions→completed', 'jobs→funded/confirmed'];
        if (asgnId) updates.push('job_assignments→funded/confirmed');

        return new Response(JSON.stringify({
          success: true,
          action: 'simulate_funded',
          message: 'Payment funded simulation completed',
          data: { fakePaymentIntent, updated: updates },
          auditLogId,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'simulate_completion': {
        if (!isTest) {
          return new Response(JSON.stringify({ success: false, error: 'LIVE_MODE_BLOCKED: Cannot simulate completion in live mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { jobId, guardId, assignmentId: asgnId, clientId } = body;
        if (!jobId || !guardId) {
          return new Response(JSON.stringify({ success: false, error: 'jobId and guardId are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: existing } = await supabaseAdmin.from('job_completion_requests').select('id').eq('job_id', jobId).eq('guard_id', guardId).maybeSingle();

        let completionRequestId: string;
        if (existing) {
          await supabaseAdmin.from('job_completion_requests').update({
            status: 'pending',
            updated_at: now,
          }).eq('id', existing.id);
          completionRequestId = existing.id;
        } else {
          const { data: inserted } = await supabaseAdmin.from('job_completion_requests').insert({
            job_id: jobId,
            guard_id: guardId,
            client_id: clientId || null,
            status: 'pending',
            requested_at: now,
            created_at: now,
            updated_at: now,
          }).select('id').maybeSingle();
          completionRequestId = inserted?.id || '';
        }

        if (asgnId) {
          await supabaseAdmin.from('job_assignments').update({
            status: 'completed',
            payment_status: 'awaiting_client_release',
            completed_at: now,
            updated_at: now,
          }).eq('id', asgnId);
        }

        await supabaseAdmin.from('jobs').update({
          payment_status: 'awaiting_client_release',
          completion_status: 'pending_confirmation',
          updated_at: now,
        }).eq('id', jobId);

        const auditLogId = await writeAuditLog('admin_test_completion_requested', 'job_completion_request', completionRequestId, {
          job_id: jobId,
          guard_id: guardId,
          assignment_id: asgnId || null,
          client_id: clientId || null,
        });

        return new Response(JSON.stringify({
          success: true,
          action: 'simulate_completion',
          message: 'Job completion request created',
          data: { completionRequestId },
          auditLogId,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'release_guard': {
        if (!isTest) {
          return new Response(JSON.stringify({ success: false, error: 'LIVE_MODE_BLOCKED: Cannot release guard payment in live mode from test console' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { jobId, guardId, assignmentId: asgnId, amount, adminNotes } = body;
        if (!jobId || !guardId || !asgnId || !amount) {
          return new Response(JSON.stringify({ success: false, error: 'jobId, guardId, assignmentId, and amount are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: guard } = await supabaseAdmin.from('guards').select('stripe_account_id, full_name, email').eq('id', guardId).maybeSingle();
        if (!guard?.stripe_account_id) {
          return new Response(JSON.stringify({ success: false, error: 'Guard has no Stripe Connect account', code: 'NO_CONNECT_ACCOUNT' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const account = await stripe.accounts.retrieve(guard.stripe_account_id);
        if (!account.charges_enabled || !account.payouts_enabled) {
          return new Response(JSON.stringify({ success: false, error: 'Guard Stripe account is not fully set up', code: 'ACCOUNT_NOT_READY' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data: jobData } = await supabaseAdmin.from('jobs').select('job_title').eq('id', jobId).maybeSingle();
        const jobTitle = jobData?.job_title || 'Job';

        const netAmountPence = Math.round(Number(amount) * 100);
        const idempotencyKey = `admin_test_release_${asgnId}_${Date.now()}`;

        const transfer = await stripe.transfers.create({
          amount: netAmountPence,
          currency: 'gbp',
          destination: guard.stripe_account_id,
          description: `[TEST] Payout for job: ${jobTitle} (Guard: ${guard.full_name || guardId})`,
          metadata: {
            guardId,
            jobId,
            assignmentId: asgnId,
            jobTitle,
            netAmount: Number(amount),
            adminTest: 'true',
          },
        }, { idempotencyKey });

        await supabaseAdmin.from('guard_payouts').upsert({
          guard_id: guardId,
          assignment_id: asgnId,
          job_id: jobId,
          amount: Number(amount),
          fee_deducted: 0,
          net_amount: Number(amount),
          status: 'payout_processing',
          stripe_transfer_id: transfer.id,
          stripe_transfer_status: 'created',
          notes: `[TEST] ${adminNotes || 'Admin test release'}`,
          created_at: now,
          updated_at: now,
        }, { onConflict: 'assignment_id', ignoreDuplicates: false });

        await supabaseAdmin.from('job_assignments').update({
          payment_status: 'payout_processing',
          stripe_transfer_id: transfer.id,
          payout_released: true,
          payout_released_at: now,
          updated_at: now,
        }).eq('id', asgnId);

        await supabaseAdmin.from('jobs').update({
          payment_status: 'payout_processing',
          updated_at: now,
        }).eq('id', jobId);

        await supabaseAdmin.from('job_completion_requests').update({
          status: 'approved',
          updated_at: now,
        }).eq('job_id', jobId).eq('guard_id', guardId).eq('status', 'pending');

        const auditLogId = await writeAuditLog('admin_test_guard_payment_released', 'guard_payout', asgnId, {
          transfer_id: transfer.id,
          job_id: jobId,
          guard_id: guardId,
          assignment_id: asgnId,
          net_amount: Number(amount),
          admin_notes: adminNotes || '',
        });

        return new Response(JSON.stringify({
          success: true,
          action: 'release_guard',
          message: `£${Number(amount).toFixed(2)} test transfer created to ${guard.full_name || 'guard'}`,
          data: { transferId: transfer.id, idempotencyKey },
          auditLogId,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      case 'reset_test_flow': {
        if (!isTest) {
          return new Response(JSON.stringify({ success: false, error: 'LIVE_MODE_BLOCKED: Cannot reset in live mode' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { jobId, assignmentId: asgnId } = body;
        if (!jobId) return new Response(JSON.stringify({ success: false, error: 'jobId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const updatesApplied: string[] = [];

        await supabaseAdmin.from('jobs').update({
          payment_status: 'unpaid',
          stripe_session_id: null,
          stripe_payment_intent_id: null,
          status: 'open',
          completion_status: null,
          updated_at: now,
        }).eq('id', jobId);
        updatesApplied.push('jobs→unpaid/open');

        if (asgnId) {
          await supabaseAdmin.from('job_assignments').update({
            payment_status: 'unpaid',
            status: 'assigned',
            stripe_transfer_id: null,
            payout_released: false,
            payout_released_at: null,
            completed_at: null,
            updated_at: now,
          }).eq('id', asgnId);
          updatesApplied.push('job_assignments→unpaid/assigned');
        } else {
          await supabaseAdmin.from('job_assignments').update({
            payment_status: 'unpaid',
            stripe_transfer_id: null,
            payout_released: false,
            payout_released_at: null,
            completed_at: null,
            updated_at: now,
          }).eq('job_id', jobId);
          updatesApplied.push('all job_assignments→unpaid');
        }

        await supabaseAdmin.from('transactions').update({
          status: 'cancelled',
          updated_at: now,
        }).eq('job_id', jobId).neq('status', 'refunded');
        updatesApplied.push('transactions→cancelled');

        await supabaseAdmin.from('job_completion_requests').update({
          status: 'cancelled',
          updated_at: now,
        }).eq('job_id', jobId).neq('status', 'cancelled');
        updatesApplied.push('completion_requests→cancelled');

        if (asgnId) {
          await supabaseAdmin.from('guard_payouts').update({
            status: 'cancelled',
            updated_at: now,
          }).eq('assignment_id', asgnId).neq('status', 'cancelled');
          updatesApplied.push('guard_payouts→cancelled');
        }

        const auditLogId = await writeAuditLog('admin_test_payment_reset', 'job', jobId, {
          job_id: jobId,
          assignment_id: asgnId || null,
          updates_applied: updatesApplied,
        });

        return new Response(JSON.stringify({
          success: true,
          action: 'reset_test_flow',
          message: 'Test flow reset to initial state',
          data: { updatesApplied },
          auditLogId,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('[admin-test-job-payment] ERROR:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
