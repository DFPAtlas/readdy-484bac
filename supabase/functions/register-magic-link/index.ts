import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

function generateRandomPassword(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

async function checkRateLimit(supabase: any, ip: string, email: string): Promise<{ allowed: boolean; reason: string }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: ipCount } = await supabase
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'register_magic_link')
    .eq('ip_address', ip)
    .gte('created_at', oneHourAgo);
  if (ipCount !== null && ipCount >= 10) {
    return { allowed: false, reason: 'Too many registration attempts from this IP. Please try again in an hour.' };
  }
  const { count: emailCount } = await supabase
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'register_magic_link')
    .eq('email', email.toLowerCase().trim())
    .gte('created_at', oneHourAgo);
  if (emailCount !== null && emailCount >= 5) {
    return { allowed: false, reason: 'Too many registration attempts for this email. Please try again in an hour.' };
  }
  return { allowed: true, reason: '' };
}

async function logRateLimitEvent(supabase: any, ip: string, email: string, userAgent: string, blocked: boolean, reason: string) {
  try {
    await supabase.from('rate_limit_events').insert({
      event_type: 'register_magic_link',
      email: email.toLowerCase().trim(),
      ip_address: ip,
      user_agent: userAgent,
      blocked,
      reason,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log rate limit event:', err);
  }
}

async function provisionUser(supabase: any, userId: string, accountType: string): Promise<void> {
  const now = new Date().toISOString();
  const isClient = accountType === 'client';
  const { data: existingEnt } = await supabase.from('user_entitlements_data').select('user_id').eq('user_id', userId).maybeSingle();
  if (!existingEnt) {
    const { error } = await supabase.from('user_entitlements_data').insert({
      user_id: userId,
      plan_slug: isClient ? 'client_free' : 'guard_starter',
      plan_name: isClient ? 'Free Starter' : 'Free Starter',
      audience: accountType,
      features: isClient
        ? JSON.stringify(['client.post_job', 'client.view_guard_profiles', 'client.escrow_payments'])
        : JSON.stringify(['guard.apply_job', 'guard.view_jobs', 'guard.create_profile', 'guard.advanced_alerts']),
      monthly_price_pence: 0,
      subscription_status: 'active',
      created_at: now,
      updated_at: now,
    });
    if (error) console.error('[register-magic-link] Entitlement insert error:', error.message);
  }
  const { data: existingNotif } = await supabase.from('notification_preferences').select('id').eq('user_id', userId).maybeSingle();
  if (!existingNotif) {
    await supabase.from('notification_preferences').insert({
      user_id: userId,
      job_matches: true,
      application_updates: true,
      payment_notifications: true,
      messages: true,
      sia_reminders: true,
      email_frequency: 'daily',
      new_applicants: true,
      guard_confirmations: true,
      job_reminders: true,
      support_tickets: true,
      payment_updates: true,
      in_app_alerts: true,
      sms_notifications: false,
      created_at: now,
      updated_at: now,
    });
  }
  const { data: existingSub } = await supabase.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
  if (!existingSub) {
    await supabase.from('subscriptions').insert({
      user_id: userId,
      status: 'active',
      plan_slug: isClient ? 'client_free' : 'guard_starter',
      plan_name: isClient ? 'Free Starter' : 'Free Starter',
      billing_cycle: 'monthly',
      auto_renew: false,
      payment_failure_count: 0,
      account_type: accountType,
      created_at: now,
      updated_at: now,
    });
  }
}

async function handlePreAccountLinking(supabase: any, userId: string, email: string): Promise<any> {
  try {
    const { data: linkResult, error: linkErr } = await supabase.rpc('link_qg_pre_account_tokens', {
      user_uuid: userId,
      user_email: email,
    });
    if (linkErr) {
      console.error('[register-magic-link] Pre-account token linking SQL error:', linkErr);
      return null;
    }
    if (linkResult?.linked) {
      console.log(`[register-magic-link] Pre-account tokens linked for ${email}: ${linkResult.pending_tokens} pending tokens`);
    }
    return linkResult;
  } catch (err) {
    console.error('[register-magic-link] Pre-account token linking failed:', err);
    return null;
  }
}

async function handleReferral(supabase: any, userId: string, email: string, accountType: string, referralCode: string, ipHash: string, userAgentHash: string) {
  if (!referralCode) return;
  const { data: refCode } = await supabase
    .from('qg_referral_codes')
    .select('id, owner_user_id, status')
    .eq('code', referralCode)
    .maybeSingle();
  if (!refCode || refCode.status !== 'active') {
    console.log(`[register-magic-link] Referral code not found or inactive: ${referralCode}`);
    return;
  }
  if (refCode.owner_user_id === userId) {
    console.log(`[register-magic-link] Self-referral blocked: ${userId}`);
    return;
  }
  const { data: existing } = await supabase
    .from('qg_referrals')
    .select('id')
    .eq('referral_code_id', refCode.id)
    .eq('referred_email', email)
    .maybeSingle();
  if (existing) return;
  const pendingTokens = accountType === 'client' ? 500 : 250;
  await supabase.from('qg_referrals').insert({
    referral_code_id: refCode.id,
    referrer_user_id: refCode.owner_user_id,
    referred_user_id: userId,
    referred_email: email,
    referred_role: accountType,
    status: 'account_created',
    source: 'qg_launch_rewards',
    ip_hash: ipHash,
    user_agent_hash: userAgentHash,
    pending_tokens: pendingTokens,
  });
  console.log(`[register-magic-link] Referral created: ${email} via ${referralCode}, pending=${pendingTokens}`);
  try {
    const { data: matchingInvites } = await supabase
      .from('qg_launch_invites')
      .select('id')
      .eq('recipient_email', email.toLowerCase().trim())
      .eq('referral_code', referralCode)
      .in('status', ['sent', 'opened', 'clicked']);
    if (matchingInvites && matchingInvites.length > 0) {
      for (const inv of matchingInvites) {
        await supabase.from('qg_launch_invites').update({
          status: 'signed_up',
          signed_up_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', inv.id);
        console.log(`[register-magic-link] Invite ${inv.id} marked as signed_up`);
      }
    }
  } catch (trackErr) {
    console.error('[register-magic-link] Failed to update invite signup status:', trackErr);
  }
}

async function findAuthUserByEmail(supabase: any, email: string): Promise<any | null> {
  const target = email.toLowerCase().trim();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error('[register-magic-link] listUsers failed:', error.message);
        return null;
      }
      const users = data?.users || [];
      const match = users.find((u: any) => (u.email || '').toLowerCase() === target);
      if (match) return match;
      if (users.length < 1000) break;
    }
  } catch (err) {
    console.error('[register-magic-link] Failed to look up user by email:', err);
  }
  return null;
}

async function sendVerificationEmail(supabase: any, supabaseUrl: string, supabaseServiceKey: string, userId: string, email: string, fullName: string, role: string): Promise<boolean> {
  try {
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      console.error(`[register-magic-link] generateLink failed for ${email}: ${linkError?.message || 'no token'}`);
      return false;
    }
    const verify_url = 'https://quickguard.uk/auth/email-dashboard#' + new URLSearchParams({
      token_hash: link.properties.hashed_token,
      role,
    }).toString();
    const res = await fetch(`${supabaseUrl}/functions/v1/render-email-template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_slug: 'signup_verification',
        to: email,
        variables: {
          user_name: fullName || 'there',
          verify_url,
          year: String(new Date().getFullYear()),
        },
        related_user_id: userId,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[register-magic-link] Verification email send failed (${res.status}): ${errText}`);
      return false;
    }
    console.log(`[register-magic-link] Verification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('[register-magic-link] Failed to send verification email:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const { email, role, first_name, last_name, wizard_data, referral_code, source, tax_disclaimer_accepted } = await req.json();
    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'Email and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedRole = String(role).trim().toLowerCase();
    if (!['client', 'guard'].includes(normalizedRole)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' },
    });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const { allowed, reason } = await checkRateLimit(supabase, ip, email);
    if (!allowed) {
      await logRateLimitEvent(supabase, ip, email, userAgent, true, reason);
      return new Response(JSON.stringify({ error: reason }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await logRateLimitEvent(supabase, ip, email, userAgent, false, 'registration_success');
    const password = generateRandomPassword(32);
    const fullName = `${first_name || ''} ${last_name || ''}`.trim();
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
      user_metadata: {
        role: normalizedRole,
        first_name: first_name || '',
        last_name: last_name || '',
        email: normalizedEmail,
      },
      app_metadata: {
        account_type: normalizedRole,
      },
    });
    if (userError) {
      const looksExisting = userError.message?.toLowerCase().includes('already') || userError.message?.toLowerCase().includes('exists');
      if (looksExisting) {
        const existingUser = await findAuthUserByEmail(supabase, normalizedEmail);
        if (existingUser && !existingUser.email_confirmed_at) {
          const existingName = `${existingUser.user_metadata?.first_name || ''} ${existingUser.user_metadata?.last_name || ''}`.trim();
          await sendVerificationEmail(supabase, supabaseUrl, supabaseServiceKey, existingUser.id, normalizedEmail, existingName || fullName, normalizedRole);
          return new Response(JSON.stringify({ success: true, verification_sent: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'An account with this email already exists. Please sign in instead.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Failed to create user: ' + userError.message);
    }
    const userId = userData.user.id;
    if (normalizedRole === 'client') {
      const clientRecord: any = {
        user_id: userId,
        email,
        first_name: first_name || '',
        last_name: last_name || '',
        contact_name: fullName || '',
        company_name: wizard_data?.company_name || wizard_data?.companyName || '',
        phone: wizard_data?.phone || '',
        company_type: wizard_data?.company_type || wizard_data?.companyType || '',
        industry: wizard_data?.industry || '',
        company_size: wizard_data?.company_size || wizard_data?.companySize || '',
        city: wizard_data?.city || '',
        postcode: wizard_data?.postcode || '',
        address: wizard_data?.address || '',
        website: wizard_data?.website || '',
        vat_number: wizard_data?.vat_number || wizard_data?.vatNumber || '',
        billing_email: wizard_data?.billing_email || wizard_data?.billingEmail || '',
        preferred_contact_method: wizard_data?.preferred_contact_method || wizard_data?.preferredContactMethod || '',
        hear_about_us: wizard_data?.hear_about_us || wizard_data?.hearAboutUs || '',
        additional_notes: wizard_data?.additional_notes || wizard_data?.additionalNotes || '',
        profile_completed: false,
        subscription_status: 'incomplete',
        verification_status: 'pending',
        is_active: true,
        onboarding_status: 'provisioned',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('clients').upsert(clientRecord, { onConflict: 'user_id' });
      await provisionUser(supabase, userId, 'client');
    } else if (normalizedRole === 'guard') {
      const guardRecord: any = {
        user_id: userId,
        email,
        full_name: fullName || '',
        phone: wizard_data?.phone || '',
        date_of_birth: wizard_data?.date_of_birth || wizard_data?.dateOfBirth || null,
        location: wizard_data?.city || wizard_data?.location || '',
        postcode: wizard_data?.postcode || '',
        years_experience: wizard_data?.years_experience || wizard_data?.yearsExperience || null,
        hourly_rate: wizard_data?.hourly_rate || wizard_data?.hourlyRate || null,
        availability: wizard_data?.availability || null,
        willing_to_travel: wizard_data?.willing_to_travel || wizard_data?.willingToTravel || null,
        has_transport: wizard_data?.has_transport || wizard_data?.hasTransport || null,
        licence_types: wizard_data?.licence_types || wizard_data?.licenceTypes || null,
        certifications: wizard_data?.certifications || null,
        available_days: wizard_data?.available_days || wizard_data?.availableDays || null,
        available_hours_from: wizard_data?.available_hours_from || wizard_data?.availableHoursFrom || null,
        available_hours_to: wizard_data?.available_hours_to || wizard_data?.availableHoursTo || null,
        max_distance_miles: wizard_data?.max_distance_miles || wizard_data?.maxDistanceMiles || null,
        min_hourly_rate: wizard_data?.min_hourly_rate || wizard_data?.minHourlyRate || null,
        sia_licence_number: wizard_data?.sia_licence_number || wizard_data?.sia_license_number || wizard_data?.siaNumber || '',
        license_cardholder_name: wizard_data?.license_cardholder_name || wizard_data?.licence_cardholder_name || wizard_data?.cardholder_name || '',
        sia_expiry_date: wizard_data?.sia_expiry_date || wizard_data?.sia_license_expiry || wizard_data?.siaExpiryDate || null,
        driving_licence_front_url: wizard_data?.driving_licence_front_url || wizard_data?.drivingLicenceFrontUrl || null,
        driving_licence_back_url: wizard_data?.driving_licence_back_url || wizard_data?.drivingLicenceBackUrl || null,
        proof_of_address_url: wizard_data?.proof_of_address_url || wizard_data?.proofOfAddressUrl || null,
        profile_completed: false,
        subscription_status: 'incomplete',
        verification_status: 'manual_review',
        sia_verified: false,
        is_active: false,
        dashboard_access: false,
        onboarding_status: 'provisioned',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('guards').upsert(guardRecord, { onConflict: 'user_id' });
      await provisionUser(supabase, userId, 'guard');
    }

    handlePreAccountLinking(supabase, userId, normalizedEmail)
      .then((linkResult) => {
        if (linkResult?.linked) {
          console.log(`[register-magic-link] Pre-account tokens linked: ${linkResult.pending_tokens} pending`);
        }
      })
      .catch(err => console.error('[register-magic-link] Pre-account linking async error:', err));

    if (typeof referral_code === 'string' && referral_code.length > 0) {
      const ipHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
        .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''));
      const uaHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userAgent.slice(0, 100)))
        .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''));
      handleReferral(supabase, userId, normalizedEmail, normalizedRole, referral_code, ipHash, uaHash)
        .catch(err => console.error('[register-magic-link] Referral handling failed:', err));
    }

    if (tax_disclaimer_accepted === true) {
      const { error: taxError } = await supabase.from('tax_disclaimers_accepted').insert({
        user_id: userId,
        user_type: normalizedRole,
        disclaimer_type: 'general',
        accepted_at: new Date().toISOString(),
      });
      if (taxError) console.error('[register-magic-link] Tax disclaimer insert error:', taxError.message);
    }

    const verificationSent = await sendVerificationEmail(supabase, supabaseUrl, supabaseServiceKey, userId, normalizedEmail, fullName, normalizedRole);
    if (!verificationSent) {
      console.error(`[register-magic-link] Verification email did not complete for ${normalizedEmail}; will retry via queue/health check if configured.`);
    }

    return new Response(JSON.stringify({ success: true, verification_sent: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('register-magic-link error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
