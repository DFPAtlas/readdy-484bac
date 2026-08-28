import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

async function computeStats(supabase: any) {
  const [totalRes, siaRes, approvedRes, pendingRes, earningsRes] = await Promise.all([
    supabase.from('guards').select('*', { count: 'exact', head: true }),
    supabase.from('guards').select('*', { count: 'exact', head: true }).eq('sia_verified', true),
    supabase.from('guards').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
    supabase.from('guards').select('*', { count: 'exact', head: true }).in('verification_status', ['pending', 'manual_review', 'pending_sia_check']),
    supabase.from('guards').select('total_earnings, rating'),
  ]);

  const earningsData = Array.isArray(earningsRes?.data) ? earningsRes.data : (Array.isArray(earningsRes) ? earningsRes : []);

  const total = totalRes.count || 0;
  const siaVerified = siaRes.count || 0;
  const approved = approvedRes.count || 0;
  const pending = pendingRes.count || 0;

  const ratingsArr = earningsData.filter((g: any) => g.rating && g.rating > 0).map((g: any) => Number(g.rating));
  const totalEarnings = earningsData.reduce((s: number, g: any) => s + (g.total_earnings || 0), 0);
  const avgRating = ratingsArr.length > 0 ? ratingsArr.reduce((a: number, b: number) => a + b, 0) / ratingsArr.length : 0;

  return {
    total,
    siaVerified,
    approved,
    pending,
    totalEarnings,
    avgRating,
    scope: 'platform_wide',
  };
}

Deno.serve(async (req) => {
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
    let body: Record<string, any> = {};
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

      let query = supabase.from('guards').select('*', { count: 'exact' });

      if (search) {
        const s = `%${search}%`;
        query = query.or(
          `full_name.ilike.${s},email.ilike.${s},location.ilike.${s},postcode.ilike.${s},sia_licence_number.ilike.${s}`
        );
      }

      if (filter === 'approved') {
        query = query.eq('verification_status', 'approved');
      } else if (filter === 'pending') {
        query = query.in('verification_status', ['pending', 'manual_review', 'pending_sia_check']);
      } else if (filter === 'rejected') {
        query = query.eq('verification_status', 'rejected');
      } else if (filter === 'sia_verified') {
        query = query.eq('sia_verified', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (sortBy === 'name') {
        query = query.order('full_name', { ascending: true });
      } else if (sortBy === 'rating') {
        query = query.order('rating', { ascending: false, nullsLast: true });
      } else if (sortBy === 'jobs') {
        query = query.order('total_jobs_completed', { ascending: false, nullsLast: true });
      } else if (sortBy === 'earnings') {
        query = query.order('total_earnings', { ascending: false, nullsLast: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const [{ data: guards, error: queryError, count }, stats] = await Promise.all([
        query,
        computeStats(supabase),
      ]);

      if (queryError) {
        return new Response(
          JSON.stringify({ error: queryError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          totalCount: count || 0,
          page,
          pageSize,
          data: guards || [],
          stats,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'stats') {
      const stats = await computeStats(supabase);
      return new Response(
        JSON.stringify({ success: true, stats }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-reviews') {
      const guardId = body?.guardId;
      if (!guardId) {
        return new Response(
          JSON.stringify({ error: 'Missing guardId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, review_text, created_at')
        .eq('guard_id', guardId)
        .order('created_at', { ascending: false })
        .limit(10);

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

    if (action === 'get-payouts') {
      const guardId = body?.guardId;
      if (!guardId) {
        return new Response(
          JSON.stringify({ error: 'Missing guardId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('guard_payouts')
        .select('id, net_amount, status, reference_number, created_at')
        .eq('guard_id', guardId)
        .order('created_at', { ascending: false })
        .limit(10);

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

    if (action === 'update') {
      const { id, updates } = body;
      if (!id || !updates || typeof updates !== 'object') {
        return new Response(
          JSON.stringify({ error: 'Missing id or updates' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('guards')
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