import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_ACTIONS = ['approve', 'reject', 'suspend', 'restore', 'manual_sia_verify'];

function getAal(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(base64 + pad)).aal || null;
  } catch {
    return null;
  }
}

async function updateGuard(supabase: any, guardId: string, changes: Record<string, unknown>) {
  const { data, error } = await supabase.from('guards').update(changes).eq('id', guardId).select('id').maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Guard update was not confirmed');
}

async function safeExecute(fn: () => Promise<void>) {
  try { await fn(); } catch (e) { console.error('Non-blocking operation failed:', e); }
}

async function handlePreAccountVerification(supabaseQ: any, guard: any) {
  if (!guard.user_id || !guard.email) return;
  try {
    const emailNorm = guard.email.toLowerCase().trim();
    const { data: preRow } = await supabaseQ.from('qg_pre_account_tokens').select('id, pending_tokens, status').eq('linked_user_id', guard.user_id).eq('email_normalised', emailNorm).eq('status', 'linked').maybeSingle();
    if (!preRow) return;
    await supabaseQ.from('qg_pre_account_tokens').update({ status: 'verified', verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', preRow.id);
    if (preRow.pending_tokens > 0) {
      const { data: existingLedger } = await supabaseQ.from('qg_token_ledger').select('id').eq('user_id', guard.user_id).eq('event_type', 'pre_account_tokens_linked').eq('pre_account_token_id', preRow.id).eq('status', 'pending').maybeSingle();
      if (existingLedger) {
        await supabaseQ.from('qg_token_ledger').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', existingLedger.id);
        await supabaseQ.from('qg_token_ledger').insert({ user_id: guard.user_id, event_type: 'pre_account_tokens_verified', tokens: preRow.pending_tokens, status: 'approved', pre_account_token_id: preRow.id, created_at: new Date().toISOString() });
        await supabaseQ.from('qg_pre_account_tokens').update({ approved_tokens: preRow.pending_tokens, pending_tokens: 0, updated_at: new Date().toISOString() }).eq('id', preRow.id);
      }
    }
  } catch (err) {
    console.error('[admin-verify-guard] Pre-account verification error:', err);
  }
}

async function handleQGReferralOnApproval(supabaseQ: any, guard: any, supabaseUrl: string, supabaseServiceKey: string) {
  if (!guard.user_id) return;
  try {
    const { data: refData } = await supabaseQ.from('qg_referrals').select('id, referrer_user_id, referred_role, fraud_flags').eq('referred_user_id', guard.user_id).eq('status', 'account_created').maybeSingle();
    if (!refData) return;
    await supabaseQ.from('qg_referrals').update({ status: 'verified', updated_at: new Date().toISOString() }).eq('id', refData.id);
    const hasFraudFlags = refData.fraud_flags && refData.fraud_flags.length > 0;
    if (!hasFraudFlags) {
      const pendingTokens = refData.referred_role === 'client' ? 500 : 250;
      await supabaseQ.from('qg_referrals').update({ status: 'approved', approved_tokens: pendingTokens, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', refData.id);
      await supabaseQ.from('qg_token_ledger').insert({ user_id: refData.referrer_user_id, event_type: 'referral_approved', tokens: pendingTokens, status: 'approved', related_referral_id: refData.id });
    }
    const { data: matchingInvites } = await supabaseQ.from('qg_launch_invites').select('id, campaign_id').eq('recipient_email', guard.email?.toLowerCase().trim()).in('status', ['sent', 'opened', 'clicked', 'signed_up']);
    if (matchingInvites && matchingInvites.length > 0) {
      for (const inv of matchingInvites) {
        await supabaseQ.from('qg_launch_invites').update({ status: 'verified', verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', inv.id);
        if (inv.campaign_id) {
          try {
            const { data: camp } = await supabaseQ.from('qg_launch_campaigns').select('verified_count').eq('id', inv.campaign_id).maybeSingle();
            if (camp) await supabaseQ.from('qg_launch_campaigns').update({ verified_count: (camp.verified_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', inv.campaign_id);
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error('[admin-verify-guard] QG referral/invite handling error:', err);
  }
}

Deno.serve(async function(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    const isServiceRole = authHeader === 'Bearer ' + supabaseServiceKey;
    if (!isServiceRole) {
      const jwtToken = authHeader.replace('Bearer ', '').trim();
      if (!jwtToken || jwtToken === Deno.env.get('SUPABASE_ANON_KEY')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
      const userResult = await supabaseAuth.auth.getUser(jwtToken);
      if (userResult.error || !userResult.data.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      if (getAal(jwtToken) !== 'aal2') {
        return new Response(JSON.stringify({ error: 'MFA required' }), { status: 403, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      const userId = userResult.data.user.id;
      const adminResult = await supabaseAuth.from('admin_users').select('id, role, is_active').eq('user_id', userId).maybeSingle();
      const adminUser = adminResult.data;
      if (!adminUser || !adminUser.is_active) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
    }
    let body;
    try {
      body = await req.json();
    } catch (parseErr: any) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    const guardId = body.guardId;
    const action = body.action;
    const rejectionReason = body.rejectionReason;
    const unconfirmedSections = body.unconfirmedSections;
    const suspensionReason = body.suspensionReason;
    if (!guardId) {
      return new Response(JSON.stringify({ error: 'guardId is required' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    if (!action || VALID_ACTIONS.indexOf(action) === -1) {
      return new Response(JSON.stringify({ error: 'Invalid action. Must be: approve, reject, suspend, restore, or manual_sia_verify' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    const supabaseQ = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
    const guardResult = await supabaseQ.from('guards').select('id, user_id, full_name, email, verification_status').eq('id', guardId).maybeSingle();
    if (guardResult.error) {
      return new Response(JSON.stringify({ error: 'Guard lookup failed' }), { status: 500, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    if (!guardResult.data) {
      return new Response(JSON.stringify({ error: 'Guard not found' }), { status: 404, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    const guard = guardResult.data;
    const now = new Date().toISOString();
    if (action === 'manual_sia_verify') {
      await updateGuard(supabaseQ, guardId, { sia_check_status: 'passed', sia_verified: true, sia_verified_at: now, sia_confidence_score: 100, sia_mismatch_reason: 'Manual override by admin', sia_checked_at: now, updated_at: now });
      return new Response(JSON.stringify({ success: true, message: 'SIA manually verified', action: 'manual_sia_verified' }), { status: 200, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    if (action === 'approve') {
      if (guard.verification_status === 'approved' || guard.verification_status === 'verified') {
        return new Response(JSON.stringify({ error: 'Guard is already verified/approved' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      const isOverride = body.override === true;
      await updateGuard(supabaseQ, guardId, { verification_status: 'approved', is_active: true, sia_verified: true, sia_verified_at: now, verified_at: now, dashboard_access: true, profile_completed: true, rejection_reason: null, rejected_at: null, updated_at: now });
      if (guard.user_id) {
        await safeExecute(async function() { await supabaseQ.from('users').update({ verification_status: 'approved', updated_at: now }).eq('id', guard.user_id); });
      }
      await safeExecute(async function() {
        const promoResult = await supabaseQ.from('guards').select('created_at').eq('id', guardId).maybeSingle();
        const guardForPromo = promoResult ? promoResult.data : null;
        await fetch(supabaseUrl + '/functions/v1/assign-guard-promo-tier', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + supabaseServiceKey }, body: JSON.stringify({ guardId: guardId, guardCreatedAt: guardForPromo ? guardForPromo.created_at : null }) });
      });
      await safeExecute(async function() {
        await supabaseQ.from('notifications').insert({ user_id: guard.user_id, user_type: 'guard', title: 'Application Approved', message: 'Congratulations! Your guard application has been approved. You can now start accepting jobs.', type: 'success', read: false, link: '/guard/dashboard', created_at: now });
      });
      await safeExecute(async function() {
        await fetch(supabaseUrl + '/functions/v1/send-guard-approval-email', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + supabaseServiceKey }, body: JSON.stringify({ guardId: guard.id, guardName: guard.full_name, guardEmail: guard.email, approved: true }) });
      });
      await safeExecute(async function() { await handleQGReferralOnApproval(supabaseQ, guard, supabaseUrl, supabaseServiceKey); });
      await safeExecute(async function() { await handlePreAccountVerification(supabaseQ, guard); });
      return new Response(JSON.stringify({ success: true, guard_id: guardId, status: 'approved', message: 'Guard approved successfully', action: 'approved' }), { status: 200, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    if (action === 'reject') {
      if (guard.verification_status === 'rejected') {
        return new Response(JSON.stringify({ error: 'Guard is already rejected' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      const reason = rejectionReason || 'Unable to verify provided information';
      await updateGuard(supabaseQ, guardId, { verification_status: 'rejected', is_active: false, sia_verified: false, dashboard_access: false, rejection_reason: reason, rejected_at: now, updated_at: now });
      if (guard.user_id) {
        await safeExecute(async function() { await supabaseQ.from('users').update({ verification_status: 'rejected', updated_at: now }).eq('id', guard.user_id); });
      }
      return new Response(JSON.stringify({ success: true, message: 'Guard rejected successfully', action: 'rejected' }), { status: 200, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    if (action === 'suspend') {
      if (guard.verification_status === 'suspended') {
        return new Response(JSON.stringify({ error: 'Guard is already suspended' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      const suspendReason = suspensionReason || 'Account suspended by administrator';
      await updateGuard(supabaseQ, guardId, { verification_status: 'suspended', is_active: false, dashboard_access: false, rejection_reason: suspendReason, updated_at: now });
      return new Response(JSON.stringify({ success: true, message: 'Guard suspended successfully', action: 'suspended' }), { status: 200, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    if (action === 'restore') {
      if (guard.verification_status !== 'suspended') {
        return new Response(JSON.stringify({ error: 'Only suspended guards can be restored' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
      }
      await updateGuard(supabaseQ, guardId, { verification_status: 'approved', is_active: true, dashboard_access: true, profile_completed: true, rejection_reason: null, updated_at: now });
      return new Response(JSON.stringify({ success: true, message: 'Guard restored successfully', action: 'restored' }), { status: 200, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin-verify-guard] FATAL:', message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' }) });
  }
});
