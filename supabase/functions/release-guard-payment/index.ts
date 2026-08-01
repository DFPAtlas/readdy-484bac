import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const siteUrl = Deno.env.get('SITE_URL') || 'https://quickguard.uk';

  if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser || !adminUser.is_active || !['super_admin', 'finance_admin'].includes(adminUser.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required', code: 'FORBIDDEN' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { assignmentId, jobId, guardId, amount, jobTitle, guardEmail, guardName, adminNotes, completionRequestId, triggeredBy } = await req.json();

    if (!assignmentId || !guardId || !amount || !jobId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: assignmentId, guardId, amount, jobId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const idempotencyKey = `release_${assignmentId}`;

    const { data: existingPayout } = await supabase
      .from('guard_payouts')
      .select('id, status, stripe_transfer_id')
      .eq('assignment_id', assignmentId)
      .in('status', ['completed', 'paid_out', 'processing', 'payout_processing'])
      .maybeSingle();

    if (existingPayout) {
      return new Response(JSON.stringify({
        success: true,
        idempotent: true,
        message: 'Payout already processed for this assignment',
        existingPayoutId: existingPayout.id,
        existingStatus: existingPayout.status,
        existingTransferId: existingPayout.stripe_transfer_id,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('payment_status, guard_net_payout')
      .eq('id', assignmentId)
      .maybeSingle();

    if (!assignment) {
      return new Response(JSON.stringify({ error: 'Assignment not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (assignment.payment_status !== 'client_released') {
      return new Response(JSON.stringify({
        error: 'This payment has not been released by the client yet. The client must approve the job completion and release funds before a payout can be made.',
        code: 'NOT_CLIENT_RELEASED',
        currentStatus: assignment.payment_status,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payoutAmount = assignment.guard_net_payout ? Number(assignment.guard_net_payout) : Number(amount);

    const { data: guard } = await supabase
      .from('guards')
      .select('stripe_account_id, stripe_account_status, stripe_payouts_enabled, stripe_charges_enabled, stripe_details_submitted, stripe_requirements_due, email, full_name')
      .eq('id', guardId)
      .maybeSingle();

    if (!guard?.stripe_account_id) {
      await supabase.from('payment_audit_logs').insert({
        event_type: 'release_blocked_no_stripe_account',
        reference_type: 'guard_payout',
        reference_id: jobId,
        details: JSON.stringify({ guard_id: guardId, assignment_id: assignmentId, job_id: jobId, amount: payoutAmount }),
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        error: 'Guard payout setup is not complete',
        code: 'NO_CONNECT_ACCOUNT',
        detail: 'Guard has not connected a Stripe account. They must set up payouts from their payment page.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!guard.stripe_payouts_enabled) {
      const reason = guard.stripe_account_status === 'pending'
        ? 'Onboarding is still pending verification. The guard must complete their Stripe Express setup.'
        : guard.stripe_account_status === 'restricted'
        ? 'Guard Stripe account is restricted. Requirements are due.'
        : 'Guard has not completed Stripe onboarding.';

      await supabase.from('payment_audit_logs').insert({
        event_type: 'release_blocked_payouts_disabled',
        reference_type: 'guard_payout',
        reference_id: jobId,
        details: JSON.stringify({
          guard_id: guardId,
          assignment_id: assignmentId,
          job_id: jobId,
          amount: payoutAmount,
          stripe_account_status: guard.stripe_account_status,
          stripe_payouts_enabled: guard.stripe_payouts_enabled,
          stripe_charges_enabled: guard.stripe_charges_enabled,
          requirements_due: guard.stripe_requirements_due,
        }),
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        error: 'Guard payout setup is not complete',
        code: 'PAYOUTS_NOT_ENABLED',
        detail: reason,
        stripeAccountStatus: guard.stripe_account_status,
        requirementsDue: guard.stripe_requirements_due,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (guard.stripe_account_status !== 'ready') {
      await supabase.from('payment_audit_logs').insert({
        event_type: 'release_blocked_status_not_ready',
        reference_type: 'guard_payout',
        reference_id: jobId,
        details: JSON.stringify({
          guard_id: guardId,
          assignment_id: assignmentId,
          job_id: jobId,
          amount: payoutAmount,
          stripe_account_status: guard.stripe_account_status,
          stripe_payouts_enabled: guard.stripe_payouts_enabled,
          stripe_charges_enabled: guard.stripe_charges_enabled,
        }),
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        error: 'Guard payout setup is not complete',
        code: 'ACCOUNT_NOT_READY',
        detail: `Guard Stripe account status is "${guard.stripe_account_status}". Must be "ready" for payouts.`,
        stripeAccountStatus: guard.stripe_account_status,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const account = await stripe.accounts.retrieve(guard.stripe_account_id);
    if (!account.charges_enabled || !account.payouts_enabled) {
      await supabase.from('payment_audit_logs').insert({
        event_type: 'release_blocked_stripe_check_failed',
        reference_type: 'guard_payout',
        reference_id: jobId,
        details: JSON.stringify({
          guard_id: guardId,
          stripe_account_id: guard.stripe_account_id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          requirements: account.requirements?.currently_due,
        }),
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        error: 'Guard payout setup is not complete',
        code: 'STRIPE_ACCOUNT_NOT_READY',
        detail: 'Stripe account exists but is not fully set up for payouts.',
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirementsDue: account.requirements?.currently_due,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const netAmountInPence = Math.round(payoutAmount * 100);

    const now = new Date().toISOString();
    const { data: payoutRecord } = await supabase.from('guard_payouts').upsert({
      guard_id: guardId,
      assignment_id: assignmentId,
      job_id: jobId,
      amount: payoutAmount,
      fee_deducted: 0,
      net_amount: payoutAmount,
      status: 'pending',
      platform_fee: 0,
      notes: adminNotes || null,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'assignment_id', ignoreDuplicates: false }).select('id').maybeSingle();

    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: netAmountInPence,
        currency: 'gbp',
        destination: guard.stripe_account_id,
        description: `Payout for job: ${jobTitle || 'Job'} (Guard: ${guardName || guardId})`,
        metadata: {
          guardId,
          jobId,
          assignmentId,
          jobTitle: jobTitle || '',
          netAmount: payoutAmount,
        },
      }, { idempotencyKey });
    } catch (transferError: any) {
      console.error('[ReleaseGuardPayment] Stripe transfer failed:', transferError);

      await supabase.from('guard_payouts').update({
        status: 'failed',
        failure_reason: transferError.message || 'Stripe transfer creation failed',
        updated_at: new Date().toISOString(),
      }).eq('assignment_id', assignmentId);

      await supabase.from('payment_audit_logs').insert({
        event_type: 'transfer.create_failed',
        reference_type: 'guard_payout',
        reference_id: payoutRecord?.id || jobId,
        details: JSON.stringify({ error: transferError.message, job_id: jobId, guard_id: guardId, amount: payoutAmount }),
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ error: 'Stripe transfer failed', details: transferError.message, code: 'TRANSFER_FAILED' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('guard_payouts').update({
      status: 'payout_processing',
      stripe_transfer_id: transfer.id,
      stripe_transfer_status: 'created',
      updated_at: new Date().toISOString(),
    }).eq('assignment_id', assignmentId);

    await supabase.from('job_assignments').update({
      payment_status: 'payout_processing',
      stripe_transfer_id: transfer.id,
      payout_released: true,
      payout_released_at: now,
      updated_at: now,
    }).eq('id', assignmentId);

    await supabase.from('jobs').update({
      payment_status: 'payout_processing',
      updated_at: now,
    }).eq('id', jobId);

    if (completionRequestId) {
      await supabase.from('job_completion_requests').update({
        status: 'approved',
        updated_at: now,
      }).eq('id', completionRequestId);
    }

    await supabase.from('payment_audit_logs').insert({
      event_type: 'guard_payout_initiated',
      reference_type: 'guard_payout',
      reference_id: payoutRecord?.id || jobId,
      details: JSON.stringify({
        transfer_id: transfer.id,
        idempotency_key: idempotencyKey,
        job_id: jobId,
        guard_id: guardId,
        assignment_id: assignmentId,
        net_amount: payoutAmount,
        triggered_by: adminUser.id,
        admin_email: user.email,
        admin_notes: adminNotes || '',
      }),
      created_at: now,
    });

    const guardEmailAddr = guardEmail || guard.email;
    const guardFullName = guardName || guard.full_name;
    let emailSent = false;
    let emailFailureReason: string | null = null;

    if (resendApiKey && guardEmailAddr) {
      try {
        const emailHtml = buildPayoutReceiptHtml({
          guardName: guardFullName || 'Guard',
          jobTitle: jobTitle || 'Job',
          grossAmount: payoutAmount,
          feePercentage: 0,
          feeAmount: 0,
          netAmount: payoutAmount,
          transferId: transfer.id,
          payoutDate: now,
          siteUrl,
        });

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: 'QuickGuard <payments@quickguard.uk>',
            to: [guardEmailAddr],
            subject: `Payout Receipt: £${payoutAmount.toFixed(2)} for ${jobTitle || 'Job'}`,
            html: emailHtml,
          }),
        });
        emailSent = true;
      } catch (e: any) {
        console.error('[ReleaseGuardPayment] Receipt email error:', e);
        emailFailureReason = e?.message || 'Unknown Resend error';

        await supabase.from('payment_audit_logs').insert({
          event_type: 'receipt_email_failed',
          reference_type: 'guard_payout',
          reference_id: payoutRecord?.id || jobId,
          details: JSON.stringify({
            error: emailFailureReason,
            guard_id: guardId,
            assignment_id: assignmentId,
            job_id: jobId,
            guard_email: guardEmailAddr,
            transfer_id: transfer.id,
          }),
          created_at: new Date().toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transferId: transfer.id,
      idempotencyKey,
      netAmount: payoutAmount.toFixed(2),
      message: `£${payoutAmount.toFixed(2)} released to ${guardFullName || 'guard'}. ${emailSent ? 'Receipt emailed.' : 'Receipt email could not be sent.'}`,
      emailSent,
      emailFailureReason,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[ReleaseGuardPayment] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Payment release failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

function buildPayoutReceiptHtml({ guardName, jobTitle, grossAmount, feePercentage, feeAmount, netAmount, transferId, payoutDate, siteUrl }: { guardName: string; jobTitle: string; grossAmount: number; feePercentage: number; feeAmount: number; netAmount: number; transferId: string; payoutDate: string; siteUrl: string }) {
  const dateStr = new Date(payoutDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = new Date(payoutDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payout Receipt</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f3f4f6;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><tr><td style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:40px 30px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:28px;font-weight:bold;">QuickGuard</h1><p style="margin:10px 0 0;color:#D1FAE5;font-size:16px;">Payout Receipt</p></td></tr><tr><td style="padding:40px 30px;"><div style="background:linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 100%);border:2px solid #10B981;border-radius:10px;padding:30px;text-align:center;margin-bottom:30px;"><p style="margin:0;color:#047857;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Net Payout</p><p style="margin:10px 0 0;color:#065F46;font-size:42px;font-weight:bold;">£${netAmount.toFixed(2)}</p></div><p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">Hi <strong>${guardName}</strong>,</p><p style="margin:0 0 30px;color:#374151;font-size:16px;line-height:1.6;">Your payment for <strong>${jobTitle}</strong> has been transferred to your connected account.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;"><tr><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Job Title</strong></td><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">${jobTitle}</td></tr><tr><td style="padding:14px;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Gross Amount</strong></td><td style="padding:14px;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">£${grossAmount.toFixed(2)}</td></tr><tr><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Platform Fee (${feePercentage}%)</strong></td><td style="padding:14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">£${feeAmount.toFixed(2)}</td></tr><tr><td style="padding:16px;background:#F0FDF4;"><strong style="color:#065F46;font-size:18px;">Net Payout</strong></td><td style="padding:16px;background:#F0FDF4;text-align:right;"><strong style="color:#10B981;font-size:22px;">£${netAmount.toFixed(2)}</strong></td></tr><tr><td style="padding:14px;border-bottom:1px solid #E5E7EB;"><strong style="color:#374151;">Transfer ID</strong></td><td style="padding:14px;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;font-family:monospace;font-size:12px;">${transferId}</td></tr><tr><td style="padding:14px;background:#F9FAFB;"><strong style="color:#374151;">Date &amp; Time</strong></td><td style="padding:14px;background:#F9FAFB;text-align:right;color:#6B7280;">${dateStr} at ${timeStr}</td></tr></table><div style="background:#DBEAFE;border-left:4px solid #2563EB;padding:16px;margin-bottom:30px;border-radius:4px;"><p style="margin:0;color:#1E40AF;font-size:14px;line-height:1.6;"><strong>Payment Timing:</strong> Funds typically arrive in your bank account within 1-3 business days depending on your bank.</p></div><p style="margin:30px 0 0;color:#6B7280;font-size:14px;text-align:center;">Questions? Contact us at <a href="mailto:support@quickguard.uk" style="color:#1a237e;">support@quickguard.uk</a></p></td></tr><tr><td style="background:#111827;padding:20px 30px;text-align:center;"><p style="margin:0;color:#9CA3AF;font-size:12px;">&copy; ${new Date().getFullYear()} QuickGuard. All rights reserved. This is an automated receipt.</p></td></tr></table></td></tr></table></body></html>`;
}
