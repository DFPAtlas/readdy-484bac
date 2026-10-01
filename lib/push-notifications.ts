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
        icon: payload.icon || 'https://public.readdy.ai/ai/img_res/66933a83-eb29-486f-86a7-dac739aa1e53.png',
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