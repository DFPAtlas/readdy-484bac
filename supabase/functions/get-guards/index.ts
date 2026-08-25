import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const PROD_ORIGINS = ['https://quickguard.uk', 'https://www.quickguard.uk'];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (origin === 'https://readdy.ai' || origin.endsWith('.readdy.ai')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : PROD_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Vary': 'Origin',
  };
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(base64 + padding);
}

function decodeJwtPayload(jwt: string): any {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const jwt = authHeader.replace('Bearer ', '').trim();

  if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) {
    return new Response(
      JSON.stringify({ error: 'Missing authentication token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const payload = decodeJwtPayload(jwt);
  if (!payload || !payload.sub) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = payload.sub;
  const email = payload.email || null;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, role, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (!adminUser) {
    if (email) {
      const { data: adminByEmail } = await supabase
        .from('admin_users')
        .select('id, role, is_active')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();
      
      if (adminByEmail) {
        await supabase
          .from('admin_users')
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq('id', adminByEmail.id);
        
        if (!adminByEmail.is_active) {
          return new Response(
            JSON.stringify({ error: 'Account not active' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } else if (!adminUser.is_active) {
    return new Response(
      JSON.stringify({ error: 'Account not active' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let status = 'pending';
    let incompleteOnly = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.status && typeof body.status === 'string') {
          status = body.status;
        }
        if (body?.incompleteOnly === true) {
          incompleteOnly = true;
        }
      } catch {
        // ignore parse errors
      }
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const queryStatus = url.searchParams.get('status');
      if (queryStatus && typeof queryStatus === 'string') {
        status = queryStatus;
      }
      if (url.searchParams.get('incomplete') === 'true') {
        incompleteOnly = true;
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseQ = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

    let query = supabaseQ.from('guards').select('*');

    if (status !== 'all') {
      if (status === 'pending') {
        query = query.in('verification_status', ['pending', 'manual_review', 'pending_sia_check']);
      } else if (status === 'approved') {
        query = query.in('verification_status', ['approved', 'verified']);
      } else if (status === 'suspended') {
        query = query.eq('verification_status', 'suspended');
      } else {
        query = query.eq('verification_status', status);
      }
    }

    if (incompleteOnly) {
      query = query.eq('profile_completed', false);
    }

    const { data: guards, error: queryError } = await query.order('created_at', { ascending: false });

    if (queryError) {
      return new Response(
        JSON.stringify({ error: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, count: guards?.length || 0, data: guards || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
    return new Response(
      JSON.stringify({ error: msg || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
