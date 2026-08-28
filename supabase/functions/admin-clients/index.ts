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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

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

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = body?.action || 'list';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'app' }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (getAal(token) !== 'aal2') {
      return new Response(
        JSON.stringify({ error: 'MFA required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('id, email, full_name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      const page = Math.max(1, parseInt(body?.page || '1', 10));
      const pageSize = Math.max(1, Math.min(100, parseInt(body?.pageSize || '12', 10)));
      const search = (body?.search || '').trim();
      const filter = body?.filter || 'all';
      const sortBy = body?.sortBy || 'joined';

      let query = supabase.from('clients').select('*', { count: 'exact' });

      if (search) {
        const s = `%${search}%`;
        query = query.or(
          `first_name.ilike.${s},last_name.ilike.${s},contact_name.ilike.${s},email.ilike.${s},company_name.ilike.${s},city.ilike.${s},industry.ilike.${s}`
        );
      }

      if (filter === 'verified') {
        query = query.eq('verified', true);
      } else if (filter === 'unverified') {
        query = query.eq('verified', false);
      } else if (filter === 'suspended') {
        query = query.eq('is_suspended', true);
      } else if (filter === 'complete') {
        query = query.eq('profile_completed', true);
      } else if (filter === 'incomplete') {
        query = query.eq('profile_completed', false);
      }

      if (sortBy === 'name') {
        query = query.order('contact_name', { ascending: true });
      } else if (sortBy === 'jobs') {
        query = query.order('total_jobs_posted', { ascending: false });
      } else if (sortBy === 'spent') {
        query = query.order('total_spent', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: clients, error: queryError, count } = await query;

      if (queryError) {
        return new Response(
          JSON.stringify({ error: queryError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const totalCount = count || 0;

      const statsQuery = supabase.from('clients').select('verified, profile_completed, is_suspended, total_spent');
      const { data: allStats, error: statsError } = await statsQuery;

      let stats = { total: 0, verified: 0, profileComplete: 0, suspended: 0, totalSpent: 0 };
      if (!statsError && allStats) {
        stats = {
          total: allStats.length,
          verified: allStats.filter((c: any) => c.verified).length,
          profileComplete: allStats.filter((c: any) => c.profile_completed).length,
          suspended: allStats.filter((c: any) => c.is_suspended).length,
          totalSpent: allStats.reduce((s: number, c: any) => s + (c.total_spent || 0), 0),
        };
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalCount,
          page,
          pageSize,
          data: clients || [],
          stats,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      const { id, updates } = body;
      if (!id || !updates || typeof updates !== 'object') {
        return new Response(
          JSON.stringify({ error: 'Missing id or updates' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
    return new Response(
      JSON.stringify({ error: msg || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});