

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const DISPOSABLE_DOMAINS = [
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','throwaway.email',
  'sharklasers.com','trashmail.com','yopmail.com','dispostable.com','maildrop.cc',
  'getnada.com','temp-mail.org','fakeinbox.com','emailondeck.com','spam4.me',
  'wegwerfemail.de','emkei.cz','anonbox.net','bum.net','mailcatch.com'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const headers: Record<string,string> = {};
  Object.keys(corsHeaders).forEach(k => { headers[k] = corsHeaders[k]; });
  headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function ensurePreAccountTokens(supabase: any, emailNormalised: string, originalEmail: string, intendedRole: string, referralCode: string, referrerUserId: string | null, rewardTokens: number) {
  try {
    const { data: existing } = await supabase
      .from('qg_pre_account_tokens')
      .select('id, pending_tokens, status, referrer_user_id')
      .eq('email_normalised', emailNormalised)
      .order('created_at', { ascending: true })
      .limit(1);

    if (existing && existing.length > 0) {
      const row = existing[0];
      if (row.status === 'pre_account') {
        const newPending = Math.min((row.pending_tokens || 0) + rewardTokens, 5000);
        await supabase.from('qg_pre_account_tokens')
          .update({
            pending_tokens: newPending,
            intended_role: intendedRole !== 'unknown' ? intendedRole : row.intended_role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        console.log(`[send-qg-launch-invite] Updated pre-account tokens for ${emailNormalised}: ${newPending} pending`);
      }
    } else {
      await supabase.from('qg_pre_account_tokens').insert({
        email: originalEmail,
        email_normalised: emailNormalised,
        intended_role: intendedRole,
        referral_code: referralCode,
        referrer_user_id: referrerUserId,
        pending_tokens: rewardTokens,
        source: 'qg_launch_rewards',
        status: 'pre_account',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log(`[send-qg-launch-invite] Created pre-account token row for ${emailNormalised}: ${rewardTokens} pending`);
    }
  } catch (err) {
    console.error('[send-qg-launch-invite] Failed to ensure pre-account tokens:', err);
  }
}

Deno.serve(async function(req) {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const body = await req.json();
    const { recipient_email, recipient_name, recipient_role, message_optional } = body;
    if (!recipient_email) {
      return new Response(JSON.stringify({ error: 'recipient_email is required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });
    const jwtToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwtToken);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const emailLower = recipient_email.toLowerCase().trim();
    const settingsRes = await supabase.from('qg_launch_reward_settings').select('key,value');
    const settings: Record<string, any> = {};
    if (settingsRes.data) {
      settingsRes.data.forEach((r: any) => { try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; } });
    }
    if (settings.invite_system_enabled !== true && settings.invite_system_enabled !== 'true') {
      return new Response(JSON.stringify({ error: 'Invite system is currently disabled' }), {
        status: 403, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    if (emailLower === user.email?.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'You cannot send an invite to yourself' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return new Response(JSON.stringify({ error: 'Invalid email address format' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const domain = emailLower.split('@')[1] || '';
    if (settings.block_disposable_email_domains === true || settings.block_disposable_email_domains === 'true') {
      if (DISPOSABLE_DOMAINS.includes(domain)) {
        return new Response(JSON.stringify({ error: 'Disposable email domains are not accepted' }), {
          status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    const { data: suppressed } = await supabase.from('email_suppression_list').select('id').eq('email', emailLower).maybeSingle();
    if (suppressed) {
      return new Response(JSON.stringify({ error: 'This email is on the suppression list and cannot receive invites' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const maxPerDay = parseInt(settings.max_user_invites_per_day) || 25;
    const { data: rateData } = await supabase.from('qg_invite_rate_limits').select('invite_count').eq('user_id', user.id).eq('date', today).maybeSingle();
    const todayCount = rateData?.invite_count || 0;
    if (todayCount >= maxPerDay) {
      return new Response(JSON.stringify({ error: `Daily invite limit reached (${maxPerDay} per day). Try again tomorrow.` }), {
        status: 429, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const cooldownMins = parseInt(settings.invite_cooldown_minutes) || 2;
    const cooldownAgo = new Date(Date.now() - cooldownMins * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase.from('qg_launch_invites').select('id', { count: 'exact', head: true }).eq('sender_user_id', user.id).gte('created_at', cooldownAgo);
    if (recentCount !== null && recentCount > 0) {
      return new Response(JSON.stringify({ error: `Please wait ${cooldownMins} minutes between invites` }), {
        status: 429, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const { count: dupCount } = await supabase.from('qg_launch_invites').select('id', { count: 'exact', head: true }).eq('sender_user_id', user.id).eq('recipient_email', emailLower).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (dupCount !== null && dupCount > 0) {
      return new Response(JSON.stringify({ error: 'You already sent an invite to this email in the last 24 hours' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    const { data: codeData } = await supabase.from('qg_referral_codes').select('id, code, status').eq('owner_user_id', user.id).maybeSingle();
    let referralCode: string;
    let referralCodeId: string | null = null;
    if (codeData && codeData.status === 'active') {
      referralCode = codeData.code;
      referralCodeId = codeData.id;
    } else {
      const { data: nameRes } = await supabase.from('guards').select('full_name').eq('user_id', user.id).maybeSingle();
      const { data: clientRes } = await supabase.from('clients').select('contact_name,company_name').eq('user_id', user.id).maybeSingle();
      const namePart = (nameRes?.full_name || clientRes?.contact_name || clientRes?.company_name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 12);
      const newCode = namePart
        ? `QG-${namePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        : `QG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: insertData } = await supabase.from('qg_referral_codes').insert({
        owner_user_id: user.id, owner_role: 'guard', code: newCode, status: 'active',
      }).select('id, code').single();
      referralCode = insertData?.code || newCode;
      referralCodeId = insertData?.id || null;
    }
    const role = recipient_role && ['guard','client'].includes(recipient_role) ? recipient_role : 'unknown';
    const senderRole = 'guard';
    const { data: inviteData, error: inviteErr } = await supabase.from('qg_launch_invites').insert({
      sender_user_id: user.id, sender_role: senderRole,
      recipient_email: emailLower, recipient_name: recipient_name || null,
      recipient_role: role, referral_code_id: referralCodeId,
      referral_code: referralCode, invite_url: '',
      status: 'queued',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).select('id').single();
    if (inviteErr) {
      console.error('Failed to create invite row:', inviteErr);
      return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const rewardTokens = role === 'client' ? 500 : 250;
    ensurePreAccountTokens(supabase, emailLower, recipient_email, role, referralCode, user.id, rewardTokens)
      .catch(err => console.error('[send-qg-launch-invite] Pre-account token creation error:', err));

    const clickTrackUrl = `https://quickguard.uk/api/qg-click?invite=${inviteData.id}&ref=${encodeURIComponent(referralCode)}`;
    const directUrl = `https://quickguard.uk/qg-launch-rewards?ref=${referralCode}`;
    const unsubToken = btoa(`qg_unsub_${emailLower}_2025`).replace(/=/g, '').substring(0, 32);
    const unsubUrl = `https://quickguard.uk/api/qg-unsubscribe?email=${encodeURIComponent(emailLower)}&token=${unsubToken}`;
    await supabase.from('qg_launch_invites').update({ invite_url: clickTrackUrl, updated_at: new Date().toISOString() }).eq('id', inviteData.id);
    const greetName = recipient_name || 'there';
    let subject = '';
    let previewText = '';
    let bodySpecific = '';
    if (role === 'guard') {
      subject = "You're invited to join QuickGuard's launch network";
      previewText = 'Create your guard profile and earn QG Tokens towards future QuickGuard discounts.';
      bodySpecific = `Hi ${greetName},<br><br>You&rsquo;ve been invited to join QuickGuard&rsquo;s launch network.<br><br>QuickGuard is building a faster way for verified security guards and businesses to connect. As part of QG Launch Rewards, you can create a basic guard profile, help grow the network, and earn QG Tokens towards future QuickGuard discounts.`;
    } else if (role === 'client') {
      subject = 'QuickGuard early access for businesses';
      previewText = 'Join the QuickGuard launch network and earn QG Tokens towards platform discounts.';
      bodySpecific = `Hi ${greetName},<br><br>You&rsquo;ve been invited to join QuickGuard&rsquo;s early access launch network.<br><br>QuickGuard helps businesses find trusted, verified security guards for temporary and ongoing security work. By joining QG Launch Rewards, you can create a basic client profile, refer trusted businesses or guards, and earn QG Tokens towards future QuickGuard discounts.`;
    } else {
      subject = 'Help build the QuickGuard launch network';
      previewText = 'Invite trusted guards and businesses and earn QG Tokens towards QuickGuard discounts.';
      bodySpecific = `Hi ${greetName},<br><br>You&rsquo;ve been invited to QG Launch Rewards.<br><br>QuickGuard is building a trusted network of security guards and businesses before launch. You can join, create a basic profile, and invite genuine guards or clients to the platform.<br><br>When your referral creates a verified QuickGuard account, you can earn QG Tokens towards future QuickGuard discounts.`;
    }
    const optionalNote = message_optional
      ? `<p style="color:#94a3b8;font-style:italic;margin-top:16px;padding:16px;background:#1e293b;border-radius:8px;border-left:3px solid #14b8a6">"${message_optional.replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</p>`
      : '';
    const templateName = role === 'guard' ? 'qg_launch_rewards_guard_invite' : role === 'client' ? 'qg_launch_rewards_client_invite' : 'qg_launch_rewards_mixed_invite';
    const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B1933;border-radius:16px;overflow:hidden;color:#e2e8f0">
<div style="background:linear-gradient(135deg,#0d9488,#14b8a6);padding:32px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:24px">QG Launch Rewards</h1>
<p style="color:rgba(255,255,255,0.9);margin-top:8px;font-size:14px">${previewText}</p>
</div>
<div style="padding:32px">
${bodySpecific}
${optionalNote}
<div style="background:#0d9488/10;border:1px solid #14b8a6/20;border-radius:12px;padding:20px;margin:24px 0;text-align:center">
<p style="color:#14b8a6;font-weight:bold;font-size:16px;margin:0">100 QG Tokens = &pound;10 QuickGuard Credit</p>
<p style="color:#94a3b8;font-size:12px;margin-top:8px">Tokens are discount credits only and become active after verified account activity. They have no cash value and cannot be withdrawn or transferred.</p>
<p style="color:#64748b;font-size:12px;margin-top:12px">If you already have QG Tokens linked to this email, they will appear in your QuickGuard account after you sign up.</p>
</div>
<a href="${clickTrackUrl}" style="display:inline-block;background:#14b8a6;color:#0f172a;padding:14px 36px;border-radius:12px;font-weight:bold;font-size:16px;text-decoration:none;text-align:center">Join QG Launch Rewards</a>
<p style="color:#64748b;font-size:12px;margin-top:24px;line-height:1.5">
You are receiving this because you were invited to QuickGuard&rsquo;s launch network. QG Tokens are discount credits only and have no cash value.<br>
<a href="${unsubUrl}" style="color:#64748b;text-decoration:underline">Unsubscribe from QG Launch Rewards emails</a>
</p>
</div></div>`;
    let sendSuccess = false;
    let failureReason = '';
    try {
      const { error: queueErr } = await supabase.from('email_queue').insert({
        to_email: emailLower, subject, html_body: htmlBody,
        template_name: templateName, status: 'pending',
        created_at: new Date().toISOString(),
      });
      if (queueErr) {
        failureReason = `Email queue error: ${queueErr.message}`;
        console.error('Failed to queue invite email:', queueErr);
      } else {
        sendSuccess = true;
      }
    } catch (e: any) {
      failureReason = `Email send error: ${e.message}`;
      console.error('Failed to send invite email:', e);
    }
    await supabase.from('qg_launch_invites').update({
      status: sendSuccess ? 'sent' : 'failed',
      sent_at: sendSuccess ? new Date().toISOString() : null,
      failure_reason: sendSuccess ? null : failureReason,
      updated_at: new Date().toISOString(),
    }).eq('id', inviteData.id);
    await supabase.from('qg_invite_rate_limits').upsert({
      user_id: user.id, date: today, invite_count: todayCount + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id, date' });
    if (!sendSuccess) {
      return new Response(JSON.stringify({ success: false, error: failureReason }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      success: true, message: 'Invite sent successfully',
      invite_id: inviteData.id, daily_remaining: maxPerDay - (todayCount + 1),
    }), {
      status: 200, headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-qg-launch-invite] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
});

