import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'app' } });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const jwt = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (getAal(jwt) !== 'aal2') {
    return new Response(JSON.stringify({ error: 'MFA required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const { data: adminUser } = await supabase.from('admin_users').select('id, is_active, role').eq('user_id', user.id).maybeSingle();
  if (!adminUser || !adminUser.is_active) {
    return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const {
      page = 1,
      pageSize = 25,
      search = '',
      status = 'all',
      type = 'all',
      planSlug = 'all',
      sortBy = 'created_at',
      sortDir = 'desc',
      exportMode = false,
    } = body;

    let matchingUserIds: string[] | null = null;
    let typeUserIds: string[] | null = null;

    if (type !== 'all') {
      const { data: typeUsers } = await supabase.from('users').select('id').eq('user_type', type);
      typeUserIds = (typeUsers || []).map(u => u.id);
    }

    if (search) {
      const { data: searchUsers } = await supabase
        .from('users')
        .select('id')
        .or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      matchingUserIds = (searchUsers || []).map(u => u.id);

      if (typeUserIds !== null) {
        const typeSet = new Set(typeUserIds);
        matchingUserIds = matchingUserIds.filter(id => typeSet.has(id));
      }
    } else if (typeUserIds !== null) {
      matchingUserIds = typeUserIds;
    }

    let query = supabase
      .from('subscriptions')
      .select('*', { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (planSlug !== 'all') {
      query = query.eq('plan_slug', planSlug);
    }

    if (search || matchingUserIds !== null) {
      const orParts: string[] = [];
      if (search) {
        const s = '%' + search + '%';
        orParts.push(`plan_name.ilike.${s}`);
        orParts.push(`stripe_subscription_id.ilike.${s}`);
      }
      if (matchingUserIds && matchingUserIds.length > 0 && matchingUserIds.length <= 500) {
        orParts.push(`user_id.in.(${matchingUserIds.join(',')})`);
      } else if (matchingUserIds && matchingUserIds.length > 500) {
        query = query.in('user_id', matchingUserIds);
      }
      if (orParts.length > 0) {
        query = query.or(orParts.join(','));
      } else if ((search || type !== 'all') && (!matchingUserIds || matchingUserIds.length === 0)) {
        return new Response(JSON.stringify({
          subscriptions: [],
          users: {},
          totalCount: 0,
          page,
          pageSize,
          stats: { total: 0, active: 0, pending: 0, pastDue: 0, cancelled: 0, withStripe: 0 },
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const validSortColumns: Record<string, string> = {
      'period_end': 'current_period_end',
      'created_at': 'created_at',
      'status': 'status',
    };
    const sortColumn = validSortColumns[sortBy] || 'created_at';
    query = query.order(sortColumn, { ascending: sortDir === 'asc' });

    if (!exportMode) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    } else {
      query = query.limit(5000);
    }

    const { data: rawSubs, error, count } = await query;
    if (error) throw error;

    const subscriptions = (rawSubs || []) as any[];

    const userIds = [...new Set(subscriptions.map(s => s.user_id).filter(Boolean))];
    let users: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, full_name, user_type')
        .in('id', userIds);
      (userData || []).forEach((u: any) => { users[u.id] = u; });
    }

    const { data: plans } = await supabase
      .from('plans')
      .select('slug, name, audience, monthly_price_pence')
      .eq('active', true);

    let statsTotal = count || 0;
    let statsActive = 0;
    let statsPending = 0;
    let statsPastDue = 0;
    let statsCancelled = 0;
    let statsWithStripe = 0;

    if (!exportMode && statsTotal <= pageSize) {
      statsActive = subscriptions.filter((s: any) => s.status === 'active' || s.status === 'trialing').length;
      statsPending = subscriptions.filter((s: any) => s.status === 'pending').length;
      statsPastDue = subscriptions.filter((s: any) => s.status === 'past_due').length;
      statsCancelled = subscriptions.filter((s: any) => s.status === 'cancelled' || s.status === 'canceled').length;
      statsWithStripe = subscriptions.filter((s: any) => !!s.stripe_subscription_id).length;
    } else {
      const statsQueries = await Promise.all([
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).in('status', ['active','trialing']),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'past_due'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).in('status', ['cancelled','canceled']),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }).not('stripe_subscription_id', 'is', null),
      ]);
      statsActive = statsQueries[0].count || 0;
      statsPending = statsQueries[1].count || 0;
      statsPastDue = statsQueries[2].count || 0;
      statsCancelled = statsQueries[3].count || 0;
      statsWithStripe = statsQueries[4].count || 0;
    }

    const stats = {
      total: count || 0,
      active: statsActive,
      pending: statsPending,
      pastDue: statsPastDue,
      cancelled: statsCancelled,
      withStripe: statsWithStripe,
    };

    return new Response(JSON.stringify({
      subscriptions,
      users,
      plans: plans || [],
      totalCount: count || 0,
      page,
      pageSize,
      stats,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('admin-subscriptions error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});