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
        icon: payload.icon || 'https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/d77a7e7e-ca7e-482b-8c82-eb899404ecd8_compressed_Copy-of-Untitled.webp',
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