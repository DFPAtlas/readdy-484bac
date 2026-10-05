import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

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
    .eq('event_type', 'resend_verification')
    .eq('ip_address', ip)
    .gte('created_at', oneHourAgo);
  if (ipCount !== null && ipCount >= 10) {
    return { allowed: false, reason: 'Too many verification requests from this IP. Please try again in an hour.' };
  }
  const { count: emailCount } = await supabase
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'resend_verification')
    .eq('email', email.toLowerCase().trim())
    .gte('created_at', oneHourAgo);
  if (emailCount !== null && emailCount >= 3) {
    return { allowed: false, reason: 'Too many verification requests for this email. Please try again in an hour.' };
  }
  return { allowed: true, reason: '' };
}

async function logRateLimitEvent(supabase: any, ip: string, email: string, userAgent: string, blocked: boolean, reason: string) {
  try {
    await supabase.from('rate_limit_events').insert({
      event_type: 'resend_verification',
      email: email.toLowerCase().trim(),
      ip_address: ip,
      user_agent: userAgent,
      blocked,
      reason,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[resend-verification-link] Failed to log rate limit event:', err);
  }
}

async function findAuthUserByEmail(supabase: any, email: string): Promise<any | null> {
  const target = email.toLowerCase().trim();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error('[resend-verification-link] listUsers failed:', error.message);
        return null;
      }
      const users = data?.users || [];
      const match = users.find((u: any) => (u.email || '').toLowerCase() === target);
      if (match) return match;
      if (users.length < 1000) break;
    }
  } catch (err) {
    console.error('[resend-verification-link] Failed to look up user by email:', err);
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
      console.error(`[resend-verification-link] generateLink failed for ${email}: ${linkError?.message || 'no token'}`);
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
      console.error(`[resend-verification-link] Verification email send failed (${res.status}): ${errText}`);
      return false;
    }
    console.log(`[resend-verification-link] Verification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('[resend-verification-link] Failed to send verification email:', err);
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
    const { email, role } = await req.json();
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

    const { allowed, reason } = await checkRateLimit(supabase, ip, normalizedEmail);
    if (!allowed) {
      await logRateLimitEvent(supabase, ip, normalizedEmail, userAgent, true, reason);
      return new Response(JSON.stringify({ error: reason }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await logRateLimitEvent(supabase, ip, normalizedEmail, userAgent, false, 'resend_verification_request');

    const existingUser = await findAuthUserByEmail(supabase, normalizedEmail);
    if (existingUser && !existingUser.email_confirmed_at) {
      const { data: profile } = await supabase
        .from(normalizedRole === 'client' ? 'clients' : 'guards')
        .select('user_id')
        .eq('user_id', existingUser.id)
        .maybeSingle();
      if (profile?.user_id) {
        const fullName = `${existingUser.user_metadata?.first_name || ''} ${existingUser.user_metadata?.last_name || ''}`.trim();
        await sendVerificationEmail(supabase, supabaseUrl, supabaseServiceKey, existingUser.id, normalizedEmail, fullName, normalizedRole);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('resend-verification-link error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
