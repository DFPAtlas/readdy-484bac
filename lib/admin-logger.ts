import { supabase } from '@/lib/supabase';

async function resolveAdminIdentity(): Promise<{ adminUsername: string; adminName: string }> {
  if (typeof window === 'undefined') return { adminUsername: 'server', adminName: 'server' };

  const storedUsername = sessionStorage.getItem('admin_username');
  const storedName = sessionStorage.getItem('admin_name');

  if (storedUsername && storedUsername !== 'unknown') {
    return { adminUsername: storedUsername, adminName: storedName || storedUsername };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const email = session.user.email || 'unknown';
      return { adminUsername: email, adminName: email };
    }
  } catch {}

  return { adminUsername: 'unknown', adminName: 'unknown' };
}

export async function logAdminAction({
  actionType,
  actionDescription,
  targetType,
  targetName,
  metadata = {},
}: {
  actionType: string;
  actionDescription: string;
  targetType?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { adminUsername, adminName } = await resolveAdminIdentity();

    await supabase.from('admin_activity_log').insert({
      admin_username: adminUsername,
      admin_name: adminName,
      action_type: actionType,
      action_description: actionDescription,
      target_type: targetType || null,
      target_name: targetName || null,
      metadata,
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}