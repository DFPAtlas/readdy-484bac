import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID().replace(/-/g, '');
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const adminRegSecret = Deno.env.get('ADMIN_REGISTRATION_SECRET');

  if (!supabaseUrl || !supabaseKey || !adminRegSecret) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'app' } });
    const body = await req.json();
    const email = body.email;
    const password = body.password;
    const full_name = body.full_name || body.fullName || '';
    const role = body.role;

    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let isAuthorized = false;
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.replace('Bearer ', '').trim() || '';

    if (jwt && jwt !== Deno.env.get('SUPABASE_ANON_KEY')) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
      if (!userError && user) {
        const { data: callerAdmin } = await supabase
          .from('admin_users')
          .select('id, role, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (callerAdmin && ['admin', 'super_admin'].includes(callerAdmin.role)) {
          isAuthorized = true;
          console.log('[AdminRegister] Authorized via admin JWT:', user.email);
        }
      }
    }

    if (!isAuthorized) {
      const secretKey = body.secretKey || body.secret;
      if (!secretKey || secretKey !== adminRegSecret) {
        return new Response(
          JSON.stringify({ error: 'Invalid registration secret' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[AdminRegister] Authorized via secret key');
    }

    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin user with this email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      console.error('[AdminRegister] Auth create failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user: ' + (authError?.message || 'Unknown error') }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hashedPassword = await hashPassword(password);

    const { data: newAdmin, error: insertError } = await supabase
      .from('admin_users')
      .insert({
        user_id: authData.user.id,
        email,
        password_hash: hashedPassword,
        full_name,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[AdminRegister] Admin insert failed:', insertError.message);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create admin user: ' + insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AdminRegister] Created admin user:', newAdmin.id, email);

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          full_name: newAdmin.full_name,
          role: newAdmin.role,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[AdminRegister] Edge function error:', error.message || error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
