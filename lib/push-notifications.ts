import { supabase } from '@/lib/supabase';

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
}

export async function sendPushToUser(userId: string, role: 'guard' | 'client', payload: PushPayload) {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        role,
        title: payload.title,
        body: payload.body,
        tag: payload.tag || 'quickguard-notification',
        url: payload.url || '/',
        icon: payload.icon || '/quickguard_logo_192x192.png',
      },
    });
    if (error) throw error;
    return data;
  } catch {
    return null;
  }
}

export async function sendPushToSelf(role: 'guard' | 'client', payload: PushPayload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;
  return sendPushToUser(userId, role, payload);
}