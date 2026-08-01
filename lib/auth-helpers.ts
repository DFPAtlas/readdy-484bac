import { supabase } from './supabase';

export async function checkAdminAuth() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isAdmin: false, user: null, adminData: null };
    }

    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError || !adminData || !adminData.is_active) {
      return { isAdmin: false, user, adminData: null };
    }

    return { isAdmin: true, user, adminData };
  } catch (error) {
    console.error('Admin auth check error:', error);
    return { isAdmin: false, user: null, adminData: null };
  }
}

export async function checkClientAuth() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isClient: false, user: null, clientData: null };
    }

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (clientError || !clientData) {
      return { isClient: false, user, clientData: null };
    }

    return { isClient: true, user, clientData };
  } catch (error) {
    console.error('Client auth check error:', error);
    return { isClient: false, user: null, clientData: null };
  }
}

export async function checkGuardAuth() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isGuard: false, user: null, guardData: null };
    }

    const { data: guardData, error: guardError } = await supabase
      .from('guards')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (guardError || !guardData) {
      return { isGuard: false, user, guardData: null };
    }

    return { isGuard: true, user, guardData };
  } catch (error) {
    console.error('Guard auth check error:', error);
    return { isGuard: false, user: null, guardData: null };
  }
}

export async function logAdminActivity(adminUserId: string, actionType: string, actionDescription: string, metadata?: any, adminUsername?: string) {
  try {
    await supabase
      .from('admin_activity_log')
      .insert({
        admin_user_id: adminUserId,
        admin_username: adminUsername || 'system',
        action_type: actionType,
        action_description: actionDescription,
        metadata: metadata || {},
      });
  } catch (error) {
    console.error('Error logging admin activity:', error);
  }
}

export async function requireAdminAuth() {
  const { isAdmin, adminData } = await checkAdminAuth();
  
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  
  return adminData;
}

export async function requireClientAuth() {
  const { isClient, clientData } = await checkClientAuth();
  
  if (!isClient) {
    throw new Error('Unauthorized: Client access required');
  }
  
  return clientData;
}

export async function requireGuardAuth() {
  const { isGuard, guardData } = await checkGuardAuth();
  
  if (!isGuard) {
    throw new Error('Unauthorized: Guard access required');
  }
  
  return guardData;
}

// ─── Signup & Profile Creation Helpers ─────────────────────────────────────

export async function ensureUserRow(
  userId: string,
  email: string,
  userType: 'guard' | 'client',
  fullName?: string
) {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id, user_type')
      .eq('id', userId)
      .maybeSingle();

    const now = new Date().toISOString();
    if (!existing) {
      await supabase.from('users').insert({
        id: userId,
        email,
        full_name: fullName || '',
        user_type: userType,
        created_at: now,
        updated_at: now,
      });
    } else if (existing.user_type !== userType) {
      await supabase
        .from('users')
        .update({ user_type: userType, updated_at: now })
        .eq('id', userId);
    }
  } catch (err) {
    console.error('[ensureUserRow] error:', err);
  }
}

export async function ensureSubscriptionRow(
  userId: string,
  userType: 'guard' | 'client'
) {
  try {
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const now = new Date().toISOString();
      const trialEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_name: 'Free Trial',
        plan_slug: 'trial',
        status: 'trialing',
        account_type: userType,
        current_period_start: now,
        current_period_end: trialEnd,
        trial_start: now,
        trial_end: trialEnd,
        trial_end_date: trialEnd,
        created_at: now,
        updated_at: now,
      });
    }
  } catch (err) {
    console.error('[ensureSubscriptionRow] error:', err);
  }
}

export async function ensureGuardProfile(userId: string, email: string, metadata: any) {
  try {
    const { data: existing } = await supabase
      .from('guards')
      .select('id, profile_completed, verification_status, subscription_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const firstName = metadata?.first_name || metadata?.full_name?.split(' ')[0] || '';
      const lastName = metadata?.last_name || metadata?.full_name?.split(' ').slice(1).join(' ') || '';
      const fullName = `${firstName} ${lastName}`.trim() || metadata?.full_name || 'Guard';
      const now = new Date().toISOString();
      await supabase.from('guards').insert({
        user_id: userId,
        email,
        full_name: fullName,
        phone: metadata?.phone || '',
        verification_status: 'manual_review',
        sia_verified: false,
        is_active: false,
        profile_completed: false,
        subscription_status: 'trialing',
        created_at: now,
        updated_at: now,
      });
      return { created: true, profile: null };
    }
    return { created: false, profile: existing };
  } catch (err) {
    console.error('[ensureGuardProfile] error:', err);
    return { created: false, profile: null };
  }
}

export async function ensureClientProfile(userId: string, email: string, metadata: any) {
  try {
    const { data: existing } = await supabase
      .from('clients')
      .select('id, profile_completed, subscription_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) {
      const firstName = metadata?.first_name || metadata?.full_name?.split(' ')[0] || '';
      const lastName = metadata?.last_name || metadata?.full_name?.split(' ').slice(1).join(' ') || '';
      const contactName = `${firstName} ${lastName}`.trim() || metadata?.full_name || metadata?.contact_name || metadata?.contactName || email?.split('@')[0] || 'Client';
      const now = new Date().toISOString();
      await supabase.from('clients').insert({
        user_id: userId,
        email,
        contact_name: contactName,
        first_name: firstName,
        last_name: lastName,
        company_name: metadata?.company_name || '',
        phone: metadata?.phone || '',
        profile_completed: false,
        subscription_status: 'trialing',
        created_at: now,
        updated_at: now,
      });
      return { created: true, profile: null };
    }
    return { created: false, profile: existing };
  } catch (err) {
    console.error('[ensureClientProfile] error:', err);
    return { created: false, profile: null };
  }
}